# How to build a Telegram bot on Starknet

As of 2026-10-12. This guide is for the Hotpod PM and for the agents who will build the bot as an open-source, self-hostable Hotpod project.

**Sources.** It draws only on three build research reports (reading the chain, acting on it, operations) and a fact-check that confirmed 38 claims, corrected 7 and refuted none.
- Every correction has been applied.
- **[unverified]** marks claims that could not be checked.
- Confidence is given as **high**, **moderate** or **low**.
- Live chain figures are snapshots from 2026-10-12.
- Code snippets target **starknet.js 10.8.0**. Most of the read-path code also ran unchanged on 11.2.0.

---

## 0. Bottom line

1. **Ship a plain bot with no Mini App.**
   - Telegram ToS §7 requires any Mini App with crypto features to use TON only, and that rule covers the Mini App's connected bot too. Regular bots with no Mini App are exempt ([ToS](https://telegram.org/tos/bot-developers), [guidelines](https://core.telegram.org/bots/blockchain-guidelines)) (high).
   - For signing, send users to an external web page through a `url` button. Never use `web_app` buttons or a menu Mini App.
2. **Default to non-custody, in this order:**
   - (a) read-only alerts and portfolio views for an address the user has linked with a SNIP-12 signature;
   - (b) "prepare and sign": the bot builds the calldata, the user signs in their own wallet, and gas is sponsored through an allow-listing paymaster proxy;
   - (c) delegated automation through AVNU DCA orders or SNIP-9 pre-signed executions;
   - (d) session keys, only last.
   - Never hold raw user keys (moderate; this is a design judgement backed by the incident record).
3. **Read the chain by polling `starknet_getEvents` against a block cursor.** WebSocket subscriptions are an optional latency booster. Treat `ACCEPTED_ON_L2` as final for notifications, and dedupe on `(tx_hash, event_index)` (high).
4. **Use grammY 1.46 on Node 24 LTS, with SQLite on a single always-on machine.** Costs come to roughly $5/month at 1k users and roughly $125–270/month at 100k (low–moderate).
5. **Make every external dependency injectable.** The Telegram API root, the RPC URL, and the AVNU and paymaster clients should all be swappable. That way Hotpod's offline checks can run against a fake Bot API and a fake JSON-RPC server (§6).
6. **The market is small.** Starknet's 30-day DEX volume is $472.7M ([DefiLlama](https://api.llama.fi/overview/dexs/starknet), 2026-10-12). Build for safety and Starknet-specific utility, not fee revenue.

---

## 1. Reference architecture and stack

```
                       Telegram Bot API (getUpdates long polling; webhook + queue later)
                                   ▲  │
                                   │  ▼
┌──────────────────────────── one container / Fly machine (start as 1 process) ─────────────────────────────┐
│ bot: grammY + @grammyjs/runner                                                                            │
│   plugins: auto-retry, ratelimiter, conversations (wrap I/O in conversation.external), menu, i18n        │
│   commands: /start /link /watch /unwatch /portfolio /price /stake /swap /settings /forget /export         │
│             /terms /paysupport ; Stars invoices + successful_payment                                      │
│   group: admin-only config, ephemeral replies for private data, approveChatJoinRequest for gating        │
│                                                                                                           │
│ ingestor (single leader): every 2–6 s                                                                     │
│   getBlockLatestAccepted → check stored (block_number, block_hash) → getEvents(cursor+1..head)            │
│   tokens/contracts list, keys=[[Transfer]] / Ekubo Core Swapped / staking events, paging by token         │
│   decode (new + legacy Transfer layouts) → match Map<address, subscribers> → INSERT outbox (UNIQUE key)   │
│   optional WS subscribeEvents as "pending" hint; backfill via getEvents on reconnect                      │
│                                                                                                           │
│ notifier: drain outbox · global ≤25/s · per-chat 1/s · per-group 20/min · coalesce bursts into digests    │
│   429 → retry_after · 403 → users.blocked_at                                                              │
│                                                                                                           │
│ web (same process or separate): https://app.example.com                                                   │
│   /link   SNIP-12 challenge + verify (is_valid_signature)                                                 │
│   /sign   load server-built intent → wallet signs → paymaster / relayer submits                          │
│   /api/paymaster  allow-listing proxy to AVNU (holds API key, per-user quota)                             │
│                                                                                                           │
│ scheduler: croner (digests, staking checks, data purge, plan expiry)                                      │
└───────────────┬───────────────────────────────────────┬──────────────────────────────────────────────────┘
                ▼                                       ▼
  SQLite (WAL) on volume + off-host backup     Starknet RPC primary + fallback (JSON-RPC /rpc/v0_10)
  → Postgres (+ pg-boss) at ~10k users           Pragma (on-chain), AVNU API/SDK, AVNU paymaster
  → Redis only for shared limiter / BullMQ       User wallets: Ready, Braavos, Cartridge (via starknetkit)
```

**Stack and versions** (npm and GitHub as of 2026-10-12; high unless marked otherwise):

| Layer | Choice | Version / note |
|---|---|---|
| Runtime | Node.js | **24 LTS** now. Node 24 enters maintenance 2026-10-20 (EOL 2028-04-30); Node 26 becomes LTS 2026-10-28 ([schedule](https://github.com/nodejs/Release/blob/main/schedule.json)) |
| Bot library | grammY | **1.46.0** (2026-08-26), Bot API 10.3 ([npm](https://registry.npmjs.org/grammy)) |
| grammY plugins | runner 2.0.3, auto-retry 2.0.2, ratelimiter 1.2.1, conversations 2.1.1, menu 1.5.0, i18n 1.1.2, parse-mode 2.3.0 | [npm](https://registry.npmjs.org/) |
| Starknet SDK | starknet.js | **10.8.0** on the `latest` tag, needs Node ≥22. 11.2.0 is a prerelease on `next` (Node ≥22.12). Versions 7.x–9.x are end-of-life, and six advisories were published 2026-09-28 ([release](https://github.com/starknet-io/starknet.js/releases/tag/v10.8.0)) |
| RPC spec | JSON-RPC 0.10 (`/rpc/v0_10`) | Spec tag v0.10.4 (2026-09-10) changed only the wallet API. Live nodes report 0.10.2, 0.10.3 or 0.10.3-rc.0, so **do not hard-check one patch version** ([release](https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.4)) |
| Swaps / staking calls | `@avnu/avnu-sdk` | **4.2.0**, peer `starknet ^10` ([migration](https://docs.avnu.fi/docs/migration/sdk-v4-migration)) |
| Wallet connect (web page) | starknetkit | **3.4.3** (2026-01-06), peer `starknet ^8`. Compatibility with starknet 10 is unknown, so test it ([npm](https://www.npmjs.com/package/starknetkit)) |
| Optional SDK | starkzap | 4.0.1 (2026-10-01) ([docs](https://docs.starknet.io/build/starkzap/overview.md)) |
| Optional sessions | `@cartridge/controller` | 0.14.2 (2026-09-08) |
| Indexer (optional) | Apibara DNA v2 | `dna-starknet` v2.1.4 (2026-05-18). Quiet since then (moderate) |
| DB | `node:sqlite` or `better-sqlite3` 13.0.3 | `node:sqlite` needs no flag since 22.13/23.4 and is RC in 24.15 ([docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)) |
| Queue / cron | croner 10.0.1; pg-boss 12.37.1 or BullMQ 6.3.13 when you scale | — |
| Observability | pino 10.4.0, `@sentry/node` 11.7.0, `@opentelemetry/sdk-node` 0.223.0 | — |
| Local chain | starknet-devnet **v0.10.0** (2026-09-03; Starknet 0.14.4, RPC 0.10.2; Docker `shardlabs/starknet-devnet-rs:0.10.0`) | [release](https://github.com/0xSpaceShard/starknet-devnet/releases/tag/v0.10.0) |

---

## 2. Reading the chain

### 2.1 RPC vs WebSocket vs indexer

| Approach | Use when | Caveats |
|---|---|---|
| **Polled `starknet_getEvents` + `starknet_call`** (default) | Watching known tokens and contracts for a bounded set of addresses; reading balances, prices and staking state; anything from signup onward | No "transfers by address" index. Legacy-layout tokens can't be key-filtered by recipient. Paging is provider-specific (§2.2) |
| **WebSocket subscriptions** (`starknet_subscribeEvents`, `subscribeNewHeads`, `subscribeTransactionStatus`, `subscribeNewTransactionReceipts`, `subscribeNewTransactions`, reorg notice `starknet_subscriptionReorg`) | Lower latency as an addition to polling | Backfill reaches at most **1024 blocks** (error 68). `PRE_CONFIRMED` events "might appear multiple times". Free WebSocket coverage is thin and inconsistent ([spec](https://github.com/starkware-libs/starknet-specs/tree/v0.10.4/api)) (high) |
| **Indexer** (Apibara, Checkpoint `v0.1.0-beta.80`, Starkscan API beta) | Full wallet history across all tokens, thousands of watched addresses, point-in-time portfolios, "which pools is this delegator in?" | Apibara's hosted streams need a `DNA_TOKEN`. Starkscan's history routes are beta ([launch matrix](https://starkscan.co/docs/build/launch-matrix)) (moderate) |

Spec history worth knowing (high):
- v0.8.0 (2025-03-17) introduced the WebSocket API.
- v0.9.0 (2025-08-11) added `PRE_CONFIRMED` and `CANDIDATE` and renamed the `pending` tag to `pre_confirmed`.
- v0.10.0 (2025-11-25) added `transaction_index` and `event_index` to emitted events.
- v0.10.1 (2026-03-13) lets `getEvents.address` and `subscribeEvents.from_address` accept **arrays**.

Whether the starknet.js 10.8 `getEvents` typings accept an address array is [unverified], so the snippets below loop per token.

Node notes:
- Pathfinder 0.23.0 (2026-07-20) removed RPC 0.6, 0.7 and 0.8 ([release](https://github.com/software-mansion/pathfinder/releases/tag/v0.23.0)).
- The starknet.js v11 notes say Starknet v0.14.4 deletes the feeder-gateway endpoints (high).
- The roadmap lists Starknet 0.15, which deprecates RPC 0.9, for September 2026. It had not shipped as of 2026-10-12, when the chain reported 0.14.4 ([roadmap](https://www.starknet.io/developers/version-releases/)) (high).

### 2.2 Providers and limits (observed 2026-10-12)

| Provider | Status | Limits / notes |
|---|---|---|
| **Alchemy** | Works on `/starknet/version/rpc/v0_10` (its FAQ lists only v0_6–v0_9, which is stale). WebSocket works with the demo key | Free tier is 30M CU/month. `getEvents` and `call` cost 20 CU, `blockNumber` 10 CU, WebSocket 0.04 CU/byte; pay-as-you-go is $0.525 per 1M CU ([pricing](https://www.alchemy.com/pricing), [CU](https://www.alchemy.com/docs/reference/compute-unit-costs)). WebSocket events **omit `finality_status`, `transaction_index` and `event_index`**. `chunk_size` is capped at 1024. Key-only scans cover about 81,920 blocks per call and return empty pages that still carry a continuation token (high) |
| **Cartridge** | `https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_10`, spec 0.10.2. No WebSocket at the paths tried | `chunk_size` ≤1024 (1025 → error 31). ~81,920-block scan window. Accepted 1025+ OR'd values in one key position (high) |
| **ZAN** (starknet.js default node) | `https://api.zan.top/public/starknet-mainnet/rpc/v0_10`. No WebSocket found | Same caps as Cartridge (high) |
| **PublicNode** | `https://starknet-rpc.publicnode.com`, spec 0.10.3, HTTP + WSS | **No 1024 chunk cap** (1025 worked). Accepts up to **1021** OR'd values in a key position; 1022 or more → error 34. In one test a 300k-block key-only range returned in a single call; in another, a full-history scan timed out. The WebSocket streamed heads but delivered almost no events in a 40 s probe, so it is unreliable for events (high) |
| Blast | Shut down: "use Alchemy" | high |
| Lava | HTTP 410 "discontinued" | high |
| dRPC | **Mainnet** not on the free plan; **Sepolia is free** | high |
| OnFinality public | Rate-limited after one call | high |
| Infura, QuickNode, Chainstack | Routes exist or are documented. Starknet free-tier details unknown | low |
| Starkscan RPC | Keyed, 0.10 only, batches ≤50, no WebSocket ([docs](https://starkscan.co/docs/rpc)) | moderate |
| Nethermind free RPC, Voyager API | No answer / 403. Status unknown | low |

No public endpoint publishes an SLA. Use a keyed primary provider and a public fallback. **Always pass `nodeUrl`**: with no `nodeUrl`, starknet.js silently falls back to the public ZAN node, which also breaks offline tests.

### 2.3 Finality, block time and reorgs

- **Statuses:** `RECEIVED → CANDIDATE → PRE_CONFIRMED → ACCEPTED_ON_L2 → ACCEPTED_ON_L1`. The `latest` tag means the latest block finalized by L2 consensus ([spec](https://github.com/starkware-libs/starknet-specs/blob/v0.10.2/api/starknet_api_openrpc.json)) (high).
- **Block time:** about **1.78 s** averaged over 10,000 blocks (head 16,287,830, Starknet 0.14.4) (high, measured). The docs still say ~6 s for v0.14.0, so they are stale.
- **L1 acceptance lag** is volatile. It was 5,789 blocks (~2.85 h) in one check and 6,655 blocks (~3.3 h) in another (moderate).
- **Reorgs:** with three sequencers running Tendermint consensus, pre-confirmed transactions may be dropped "only when consensus fails to finalize the proposal" ([forum](https://community.starknet.io/t/starknet-v0-14-0-pre-release-notes/115618)) (moderate). Rules:
  - Notify on `ACCEPTED_ON_L2`. You may show `PRE_CONFIRMED` as "pending".
  - Store `(block_number, block_hash)` with the cursor and re-check it each poll. Rewind on a mismatch.
  - On a WebSocket `starknet_subscriptionReorg`, rewind to `starting_block_number`. In starknet.js the reorg payload arrives through the **same** `sub.on()` handler as events, so branch on `'starting_block_number' in m` (moderate, from reading the source).

### 2.4 Events: the ERC-20 `Transfer` layout

- **Selector:** `Transfer` = `0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9` (`starknetKeccak("Transfer")`).
- **Two layouts are live on mainnet** (high):
  - **New:** `keys=[sel, from, to]`, `data=[low, high]`. Used by STRK, ETH, native USDC and USDT.
  - **Legacy:** `keys=[sel]`, `data=[from, to, low, high]`. Used by USDC.e and WBTC.
- **When the switch happened:**
  - STRK switched inside block **8,987,785** (2026-04-20 16:37 UTC, Starknet 0.14.2). That block contains both layouts.
  - ETH switched slightly earlier, between blocks 8,987,636 and 8,987,682.
  - A backfill must branch on `keys.length`.

| Token | Mainnet address | Decimals | Layout |
|---|---|---|---|
| STRK | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` (same on Sepolia) | 18 | new |
| ETH | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` (same on Sepolia) | 18 | new |
| USDC (native, Circle) | `0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb`; Sepolia `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343` | 6 | new |
| USDC.e (bridged) | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` | 6 | legacy |
| USDT | `0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8` | 6 | new |
| WBTC | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` | 8 | legacy |

Address sources: [chain-info](https://docs.starknet.io/learn/cheatsheets/chain-info), [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses), [StarkGate list](https://github.com/starknet-io/starknet-addresses/blob/master/bridged_tokens/mainnet.json).

**Three gotchas:**
- **Validate tokens by chain-specific address, never by symbol.** Circle's Sepolia USDC address also exists *on mainnet* as a contract with symbol "USDC", 6 decimals and zero supply (high).
- **The USDC address on Starkzap's paymaster docs page** (`0x053c91253bc96bfed3be…f78f`) is not deployed on mainnet (high).
- **Every transaction pays its fee in STRK** through a `Transfer` to the fee collector. In one sample, 95 of 145 STRK Transfers went to an address with prefix `0x1176a1bd…`. Filter or label fee transfers. The full fee-collector address was not recorded in this research, so look it up before hard-coding it.

```ts
// chain/ingest.ts — polled Transfer ingestion with reorg check (starknet.js 10.8)
import { RpcProvider, num, hash, uint256 } from 'starknet';

export const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC! }); // never rely on the default node
const TRANSFER = num.toHex(hash.starknetKeccak('Transfer'));
export const norm = (a: string) => '0x' + num.toBigInt(a).toString(16).padStart(64, '0');

function decodeTransfer(e: { keys: string[]; data: string[] }) {
  if (e.keys.length === 3) return { from: e.keys[1], to: e.keys[2], amount: uint256.uint256ToBN({ low: e.data[0], high: e.data[1] }) };
  if (e.keys.length === 1) return { from: e.data[0], to: e.data[1], amount: uint256.uint256ToBN({ low: e.data[2], high: e.data[3] }) }; // legacy (USDC.e, WBTC)
  return null;
}

export async function tick(db: Db, tokens: string[], watched: Map<string, number[]>) {
  const cur = db.getCursor();                                         // { block_number, block_hash } | null
  if (cur) {
    const b: any = await provider.getBlockWithTxHashes(cur.block_number);
    if (num.toBigInt(b.block_hash) !== num.toBigInt(cur.block_hash)) {  // reorg: rewind; outbox dedupe prevents repeats
      db.rewindTo(Math.max(0, cur.block_number - 20)); return;
    }
  }
  const head: any = await provider.getBlockLatestAccepted();          // ACCEPTED_ON_L2
  const from = cur ? cur.block_number + 1 : head.block_number;
  if (from > head.block_number) return;
  for (const token of tokens) {
    let continuation_token: string | undefined;
    do {
      const page = await provider.getEvents({
        address: token, keys: [[TRANSFER]], chunk_size: 1000, continuation_token,  // most providers cap at 1024
        from_block: { block_number: from }, to_block: { block_number: head.block_number },
      });
      page.events.forEach((e: any, i: number) => {
        const t = decodeTransfer(e); if (!t) return;
        for (const side of [norm(t.from), norm(t.to)]) {
          for (const userId of watched.get(side) ?? []) {
            db.enqueueOutbox({ userId, dedupeKey: `${e.transaction_hash}:${e.event_index ?? i}:${userId}`,
                               payload: { token, ...t, block: e.block_number, tx: e.transaction_hash } });
          }
        }
      });
      continuation_token = page.continuation_token;                   // empty pages can still carry a token
    } while (continuation_token);
  }
  db.setCursor(head.block_number, head.block_hash);                    // persist only after enqueueing
}
```

The `?? i` fallback in the dedupe key is weaker than a real `event_index`. RPC 0.10 `getEvents` should return `event_index`; Alchemy's WebSocket stream does not.

**Optional WebSocket booster** (tested against the Alchemy demo key):

```ts
import { WebSocketChannel } from 'starknet';
const ch = new WebSocketChannel({ nodeUrl: process.env.STARKNET_WSS! }); // Node 22+: global WebSocket; autoReconnect default true
await ch.waitForConnection();
const sub = await ch.subscribeEvents({ fromAddress: STRK, keys: [[TRANSFER]], finalityStatus: 'ACCEPTED_ON_L2' });
sub.on((m: any) => {
  if ('starting_block_number' in m) return db.rewindTo(Number(m.starting_block_number)); // reorg notice shares the handler
  hintPending(m);   // show as "pending"; the poller remains the source of truth
});
```

### 2.5 Balances

```ts
import { Contract, validateAndParseAddress } from 'starknet';
const ERC20_ABI = [{ type: 'function', name: 'balance_of', state_mutability: 'view',
  inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
  outputs: [{ type: 'core::integer::u256' }] }];
export async function balanceOf(token: string, owner: string): Promise<bigint> {
  const c = new Contract({ abi: ERC20_ABI as any, address: token, providerOrAccount: provider });
  return BigInt(await c.balance_of(validateAndParseAddress(owner)));
}
```

`balance_of` and `balanceOf` both answered on STRK, USDC, USDC.e and WBTC (high, observed).

### 2.6 Prices with Pragma

- **Contracts:**
  - Mainnet `0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b`
  - Sepolia `0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a`
  - Source: [docs](https://docs.pragma.build/starknet/development).
- **Call:** `get_data_median(SpotEntry(pair))` with calldata `[0, felt('STRK/USD')]`. It returns `price, decimals, last_updated_timestamp, num_sources_aggregated, …`.
- **Observed on 2026-10-12** (volatile):
  - STRK/USD about 0.095 (11 sources, 8 decimals)
  - ETH/USD about 2,520
  - BTC/USD about 82,700–82,960
- **SOL/USD reverts** with "No pair found".
- **The Sepolia feed was about 5.35 days stale.** Always check age and source count (high).

```ts
const PRAGMA = '0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b';
const asFelt = (s: string) => '0x' + Buffer.from(s, 'ascii').toString('hex'); // works on v10 and v11
export async function pragmaSpot(pair: string, maxAgeSec = 1800, minSources = 3) {
  const r = await provider.callContract({ contractAddress: PRAGMA, entrypoint: 'get_data_median', calldata: ['0x0', asFelt(pair)] });
  const [price, dec, ts, n] = r.slice(0, 4).map(BigInt);
  const ageSec = Math.floor(Date.now() / 1000) - Number(ts);
  if (ageSec > maxAgeSec || Number(n) < minSources) throw new Error(`STALE_PRICE ${pair}`);
  return Number(price) / 10 ** Number(dec);
}
```

### 2.7 Starknet ID

- Resolve names on-chain, because `api.starknet.id` refused connections on 2026-10-12.
- Naming contract: `0x6ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678`.
- Observed: `vitalik.stark` and `starknet.stark` resolve both ways (high).
- In v11, characters outside the Starknet ID alphabet make the call throw.

```ts
export const resolveStark = (s: string) => s.endsWith('.stark')
  ? provider.getAddressFromStarkName(s)                         // throws if unregistered
  : provider.getStarkName(validateAndParseAddress(s));          // throws if no main domain
```

### 2.8 Staking positions

**Contracts and parameters** (on-chain, 2026-10-12; [chain-info](https://docs.starknet.io/learn/cheatsheets/chain-info)) (high):
- Staking contract, mainnet: `0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7`
- Staking contract, Sepolia: `0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1`
- `version()` = 3.0.0
- `min_stake` = 20,000 STRK
- `exit_wait_window` = 604,800 s (7 days)
- Active tokens: STRK, WBTC, tBTC, SolvBTC, strkBTC. LBTC is registered but disabled.
- Total staked: about 1,542.79M STRK, 354.77 SolvBTC, 165.27 WBTC

**How to read a position:**
- **Validator side:** `staking.staker_pool_info(staker)` returns `{commission, pools:[{pool_contract, token_address, amount}]}`.
- **Delegator side:**
  - Store the pool when the user onboards. The alternative is to scan the pool's `NewPoolMember` events, which is slow without an indexer.
  - `pool.get_pool_member_info_v1(member)` returns `Option<PoolMemberInfoV1>`. `pool.pool_member_info_v1(member)` returns the struct directly.
  - The struct fields are `reward_address`, `amount`, `unclaimed_rewards`, `commission`, `unpool_amount` and `unpool_time`.
- **Rewards are paid in STRK (18 dp), even in BTC pools** ([staking docs](https://docs.starknet.io/learn/protocol/staking)) (high).
- **Events worth alerting on:**
  - on the staking contract: `RewardsSuppliedToDelegationPool`, `StakeDelegatedBalanceChanged`, `RemoveFromDelegationPoolIntent`
  - on the pool: `PoolMemberRewardClaimed`, `PoolMemberExitIntent`

```ts
export async function delegatorPosition(pool: string, member: string) {
  const { abi } = await provider.getClassAt(pool);                     // let the ABI decode the Option/struct
  const c = new Contract({ abi, address: pool, providerOrAccount: provider });
  return c.get_pool_member_info_v1(validateAndParseAddress(member));   // None if not a member
}
```

### 2.9 Ekubo buy alerts (group feature)

- **Contract:** Ekubo Core, mainnet `0x00000005dd3D2F4429AF886cD1a3b08289DBcEa99A294197E9eB43b0e0325b4b`.
- **Event:** `Swapped { locker, pool_key, params, delta, sqrt_ratio_after, tick_after, liquidity_after }` ([docs](https://github.com/EkuboProtocol/docs/blob/main/src/content/docs/reference/contracts/starknet.md), [core.cairo](https://github.com/EkuboProtocol/starknet-contracts/blob/main/src/core.cairo)) (high).
- **Who swapped:** `locker` is the router or aggregator contract, not the user. Take the buyer from the transaction's `sender_address`, and group events by transaction hash so that multi-hop AVNU/Fibrous routes post as one buy.
- **Check before going live:**
  - the event key: compute `starknetKeccak('Swapped')` and compare it with a real Core event;
  - the sign convention of `delta`, against Ekubo's source or tests.

---

## 3. Acting on chain without custody

### 3.1 Custody models compared

| Model | How users act | Who can lose funds, and how | UX in Telegram | Legal exposure (not legal advice) |
|---|---|---|---|---|
| **Read-only** | Bot shows alerts, balances and prices for a SNIP-12-linked address; links out to dapps | No key risk. Remaining risks: lookalike phishing bots, and a leak of the Telegram-id ↔ address mapping | Low friction; no in-bot actions | Lowest; mainly data protection (moderate) |
| **Prepare-and-sign** (recommended) | Bot builds the calls → user reviews and signs in their own wallet → paymaster or relayer submits | Each action needs a fresh user signature. A compromised bot can only *propose* bad calldata. Defences: wallet previews, SNIP-29 call-equality checks, server allow-lists | One wallet hop per action; sponsored gas means the user needs no STRK | Non-custodial wallet software is generally not money transmission under FinCEN 2019 (moderate). Order routing plus integrator fees may still draw scrutiny (low) |
| **Session keys held by the bot** | User approves a policy once; the bot executes within it | The bot can do anything the policy allows until expiry or revocation. Arguments the policy does not constrain are the danger (§3.6) | Best for frequent, small actions | Grey area: the bot has unilateral power within limits (unknown) |
| **Embedded TEE or server wallets** (Privy, Turnkey; StarkFi, Tengu) | Operator backend triggers signing | A compromised operator auth path can sign while a session is live | Very good | Custodial-adjacent (moderate) |
| **Fully custodial generated wallets** (Maestro, Banana Gun style) | Bot signs everything | A single hot-key honeypot. Banana Gun lost ~$3M from 11 users on 2024-09-19 ([The Block](https://www.theblock.co/post/318074/banana-gun-exploit-refund)) | Best ("/buy 10 STRK") | Highest. US: hosted wallet = money transmitter. EU: MiCA CASP authorisation required since 2026-07-01 |

**Why Starknet makes non-custody practical** (high):
- Every account is a contract. Under SNIP-6, `is_valid_signature(hash, signature)` returns `'VALID'` (`0x56414c4944`) for any signer type: multisig, guardian or passkey ([SNIP-6](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-6.md)).
- SNIP-9 outside execution uses unordered nonces, so pre-signed actions can run in any order.
- SNIP-6, SNIP-9, SNIP-12 and SNIP-29 are all still in "Review" status.

### 3.2 Linking a Telegram user to an address with SNIP-12 sign-in

**Flow:**
1. The user sends `/link`. The bot stores a one-time code, the Telegram user id, a nonce and an expiry.
2. The bot replies with a **`url` button** (not `web_app`).
3. The web page fetches the challenge, and the wallet signs SNIP-12 **revision 1** typed data.
4. The server rebuilds the typed data from its own database (never from the client's copy) and calls `is_valid_signature` on the account ([SNIP-12](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-12.md)) (high).

**Caveats:**
- An undeployed (counterfactual) account cannot be verified on-chain. Either deploy it first through the paymaster (`deploymentData`) or refuse the link.
- `provider.verifyMessageInStarknet()` in 10.8.0 treats any non-zero response as valid. Check for `'VALID'` explicitly ([source](https://github.com/starknet-io/starknet.js/blob/v10.8.0/src/provider/modules/verifyMessageInStarknet.ts)) (high).

```ts
// bot/link.ts — regular bot, URL button only
import { Bot, InlineKeyboard } from 'grammy';
import { randomBytes } from 'node:crypto';
bot.command('link', async (ctx) => {
  const code = randomBytes(16).toString('hex');                       // opaque; no personal data in the URL
  await db.linkCodes.insert({ code, tgUserId: ctx.from!.id, nonce: '0x' + randomBytes(31).toString('hex'),
                              expiresAt: Date.now() + 10 * 60_000, used: false });
  await ctx.reply('Sign a message to link your Starknet wallet. This is not a transaction and costs nothing.', {
    reply_markup: new InlineKeyboard().url('Link wallet', `${process.env.WEB_ORIGIN}/link?code=${code}`),
  });
});
```

```ts
// shared/loginTypedData.ts — SNIP-12 revision 1
import { constants, TypedDataRevision, type TypedData } from 'starknet';
export function loginTypedData(r: { tgUserId: number; nonce: string; issuedAt: number; expiresAt: number }): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: 'name', type: 'shortstring' }, { name: 'version', type: 'shortstring' },
        { name: 'chainId', type: 'shortstring' }, { name: 'revision', type: 'shortstring' },
      ],
      LinkTelegram: [
        { name: 'statement', type: 'string' }, { name: 'telegramUserId', type: 'u128' },
        { name: 'nonce', type: 'felt' }, { name: 'issuedAt', type: 'timestamp' }, { name: 'expiresAt', type: 'timestamp' },
      ],
    },
    primaryType: 'LinkTelegram',
    domain: { name: 'HotpodStarkBot', version: '1', chainId: constants.StarknetChainId.SN_MAIN, revision: TypedDataRevision.ACTIVE },
    message: { statement: 'Link this Starknet account to my Telegram account. Not a transaction.',
               telegramUserId: r.tgUserId, nonce: r.nonce, issuedAt: r.issuedAt, expiresAt: r.expiresAt },
  };
}
```

```ts
// web/link.ts — external signing page (starknetkit 3.4.3)
import { connect } from 'starknetkit';
import { WalletAccount, stark } from 'starknet';
const { wallet } = await connect({ modalMode: 'alwaysAsk' });
const account = await WalletAccount.connect({ nodeUrl: RPC_URL }, wallet!);
const { typedData } = await (await fetch(`/api/link/challenge?code=${code}`)).json();
const signature = stark.formatSignature(await account.signMessage(typedData)); // keep the full array (guardian co-sigs)
await fetch('/api/link/verify', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, address: account.address, signature }) });
```

```ts
// server/verify.ts
import { typedData, CallData, type TypedData } from 'starknet';
const VALID = 0x56414c4944n;                                           // 'VALID' (SNIP-6); avoids shortString, removed in v11
export async function isValidStarknetSignature(address: string, td: TypedData, signature: string[]) {
  const msgHash = typedData.getMessageHash(td, address);                // binds domain + chainId + account + message
  for (const entrypoint of ['is_valid_signature', 'isValidSignature']) { // camelCase for legacy accounts
    try {
      const [res] = await provider.callContract({ contractAddress: address, entrypoint,
        calldata: CallData.compile({ hash: msgHash, signature }) });
      return BigInt(res) === VALID;
    } catch (e) {
      const m = String((e as Error).message);
      if (/not found|not deployed/i.test(m)) throw new Error('ACCOUNT_NOT_DEPLOYED');
      if (/invalid-signature|INVALID_SIG|is invalid/i.test(m)) return false;
    }
  }
  return false;
}
// Route: load row by code; reject if used/expired; td = loginTypedData(row) built server-side;
// on success mark used and upsert (tgUserId, address, accountClassHash, linkedAt).
```

**Wallet options for the signing page:**
- starknetkit connectors: injected Ready X / Braavos extensions, the Ready web wallet, `argentMobile` over WalletConnect, `braavosMobile` (`https://link.braavos.app/dapp/<origin>`), Cartridge `controller`, plus Keplr, Xverse and Fordefi ([npm](https://www.npmjs.com/package/starknetkit)) (high).
- Ready now runs its new app on Base, but **Ready X (the Starknet extension) is still listed** ([Ready](https://www.ready.co/blog/community-finance)).
- Whether passkeys work inside Telegram's in-app browser is unknown, so offer an "open in browser" fallback.

### 3.3 Prepare-and-sign: swap calldata via AVNU

- `@avnu/avnu-sdk` 4.2.0: `getQuotes` → `quoteToCalls({ executeApprove: true })` returns `{calls, chainId}`, including an exact-amount `approve` ([docs](https://docs.avnu.fi/docs/swap/get-quotes)).
- REST equivalent: `POST https://starknet.api.avnu.fi/swap/v3/build`.
- **Integrator fee:** set in bps (`100n` = 1%) and paid on-chain to your recipient ([add-fees](https://docs.avnu.fi/docs/swap/add-fees)). This is how to monetize without a custom router.
- **Quotes go stale after about 1 block (~2 s).** Re-quote when the signing page opens (high).
- **Exchange contract:** `0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f` ([contracts](https://docs.avnu.fi/resources/contracts)).
- **Output can't be redirected:** the published source asserts `beneficiary == caller` in `multi_route_swap`. Whether the deployed class matches that source was not verified (moderate).
- **Public API rate limit:** 300 requests per 5 minutes without a key.

```ts
// server/buildSwap.ts
import { getQuotes, quoteToCalls } from '@avnu/avnu-sdk';
import { num, type Call } from 'starknet';
const STRK = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const USDC = '0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb';
const AVNU_EXCHANGE = '0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f';
const eq = (a: string, b: string) => num.toBigInt(a) === num.toBigInt(b);

export async function buildSwap(user: string, sellAmount: bigint) {
  const [quote] = await getQuotes({ sellTokenAddress: STRK, buyTokenAddress: USDC, sellAmount,
    takerAddress: user, integratorName: 'HotpodStarkBot' /*, integratorFees: 10n, integratorFeeRecipient: FEE_ADDR */ });
  if (!quote) throw new Error('NO_ROUTE');
  const { calls, chainId } = await quoteToCalls({ quoteId: quote.quoteId, slippage: 0.005, takerAddress: user, executeApprove: true });
  if (!eq(chainId, '0x534e5f4d41494e')) throw new Error('WRONG_CHAIN');   // SN_MAIN
  for (const c of calls as Call[]) {                                     // defence in depth
    if (eq(c.contractAddress, STRK) && c.entrypoint === 'approve') {
      const [spender, low, high] = c.calldata as string[];
      if (!eq(spender, AVNU_EXCHANGE)) throw new Error('BAD_SPENDER');
      if (num.toBigInt(low) + (num.toBigInt(high) << 128n) > sellAmount) throw new Error('APPROVE_TOO_LARGE');
    } else if (!eq(c.contractAddress, AVNU_EXCHANGE)) throw new Error('UNEXPECTED_CALL');
  }
  return { quote, calls };  // store as intent {id, tgUserId, calls, expiresAt ~2 min}; send a URL button to /sign?intent=id
}
```

**Direct Ekubo route** (alternative to AVNU):
- Router V3.0.13: `0x0199741822c2dc722f6f605204f35e56dbc23bceed54818168c4c49e4fb8737e`.
- Call pattern: transfer to the router → `multihop_swap` → `clear_minimum(token, min)`.
- Quotes: `GET https://prod-api-quoter.ekubo.org/{chainId}/{amount}/{specifiedToken}/{otherToken}` ([docs](https://docs.ekubo.org/reference/quoter-api)) (high).

### 3.4 Stake calldata

**Delegating STRK** ([staking docs](https://docs.starknet.io/learn/protocol/staking)):
- First time: `approve(pool, amount)`, then `pool.enter_delegation_pool(reward_address, amount)`.
- Later top-ups: `add_to_delegation_pool(pool_member, amount)`.
- Exit: `exit_delegation_pool_intent(amount)`, then `exit_delegation_pool_action(member)` once the lockup ends.

**AVNU SDK equivalents:** `stakeToCalls`, `initiateUnstakeToCalls`, `unstakeToCalls`, `claimRewardsToCalls`. AVNU's STRK pool is `0x362dc7da60bfddc8e3146028dfd94941c6e22403c98b5947104e637543b475d`.

**Lockup conflict:** AVNU's API docs say "21-day unbonding", but on-chain `exit_wait_window` is **7 days**. Show 7 days for direct protocol staking (high).

```ts
import { CallData, cairo, type Call } from 'starknet';
export function delegateCalls(pool: string, user: string, amount: bigint, firstTime: boolean): Call[] {
  // Check the pool ABI (getClassAt) for the exact amount type before shipping.
  return [
    { contractAddress: STRK, entrypoint: 'approve', calldata: CallData.compile({ spender: pool, amount: cairo.uint256(amount) }) },
    firstTime
      ? { contractAddress: pool, entrypoint: 'enter_delegation_pool', calldata: CallData.compile({ reward_address: user, amount }) }
      : { contractAddress: pool, entrypoint: 'add_to_delegation_pool', calldata: CallData.compile({ pool_member: user, amount }) },
  ];
}
```

### 3.5 Paymaster (SNIP-29 / AVNU) and SNIP-9 outside execution

**SNIP-29** ([spec](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-29.md), created 2025-02-05, API 0.1.0-rc0) (high):
- **Methods:** `paymaster_isAvailable`, `getSupportedTokens`, `trackingIdToLatestHash`, `buildTransaction`, `executeTransaction`.
- **Fee modes:** `sponsored`, or `default` with a `gas_token`. Sponsorship is not guaranteed; the provider decides.
- **Safety check:** the client must verify that the returned calls equal the submitted ones, plus at most one gas-token transfer. starknet.js 10.8.0 `executePaymasterTransaction` does this through `assertPaymasterTransactionSafety`, which checks chain, gas token, max fee and strict call equality.
- **SNIP-9 requirement:** the account must support SNIP-9. That check is skipped when `deploymentData` is passed for an undeployed account.

**AVNU paymaster** ([docs](https://docs.avnu.fi/docs/paymaster/index)) (high):
- **Endpoints:** `https://starknet.paymaster.avnu.fi`; Sepolia `https://sepolia.paymaster.avnu.fi`.
- **Gasless mode:** the user pays gas in a token (USDC, USDT, DAI, ETH, STRK, WBTC, solvBTC, LBTC, EKUBO, NSTR, LORDS, wstETH). No API key needed.
- **Gasfree mode:** you sponsor the gas. It needs the `x-paymaster-api-key` header and prepaid STRK credits on mainnet; Sepolia is free and unlimited.
- **Markup over raw gas:** unknown.
- **Self-hosting:** the paymaster is open source under AGPL-3.0. Its webhook sponsorship mode lets you approve each sponsored transaction, which is how to enforce per-user quotas ([repo](https://github.com/avnu-labs/paymaster)).
- **Gas grants:** the Starknet Foundation Propulsion Program covers up to $1M of gas ([docs](https://docs.avnu.fi/docs/paymaster/propulsion-program)).
- **Doc discrepancy:** AVNU's docs show `account.execute(calls, { paymaster })`. In starknet.js 10.8.0, use `executePaymasterTransaction` instead.
- **Gas-token addresses:** read them from `getSupportedTokens()` at runtime.

```ts
// web/sign.ts — user signs; your proxy holds the AVNU key
import { connect } from 'starknetkit';
import { WalletAccount, PaymasterRpc, type PaymasterDetails } from 'starknet';
const paymaster = new PaymasterRpc({ nodeUrl: `${location.origin}/api/paymaster` });
const { wallet } = await connect({ modalMode: 'alwaysAsk' });
const account = await WalletAccount.connect({ nodeUrl: RPC_URL }, wallet!, undefined, paymaster);
const { calls } = await (await fetch(`/api/intents/${intentId}`)).json();          // server-built and validated
const details: PaymasterDetails = { feeMode: { mode: 'sponsored' }, timeBounds: { executeBefore: Math.floor(Date.now() / 1000) + 120 } };
const { transaction_hash } = await account.executePaymasterTransaction(calls, details); // asserts call equality
await fetch(`/api/intents/${intentId}/submitted`, { method: 'POST', body: JSON.stringify({ transaction_hash }) });
```

```ts
// server/paymasterProxy.ts — anyone can POST here, so allow-list sponsored calls and rate-limit per linked user
const ALLOWED = new Set([AVNU_EXCHANGE, STRK, USDC].map((a) => BigInt(a)));
const calledAddrs = (tx: any): bigint[] => {
  const inv = tx?.invoke ?? {};
  if (inv.calls) return inv.calls.map((c: any) => BigInt(c.to));                     // buildTransaction
  const m = inv.typed_data?.message ?? {};                                           // executeTransaction
  return (m.Calls ?? m.calls ?? []).map((c: any) => BigInt(c.To ?? c.to));           // SNIP-9 v2 / v1
};
app.post('/api/paymaster', async (req, res) => {
  const { method, params } = req.body;
  if (method === 'paymaster_buildTransaction' || method === 'paymaster_executeTransaction') {
    const [tx, p] = Array.isArray(params) ? params : [params?.transaction, params?.parameters];
    if (p?.fee_mode?.mode === 'sponsored') {
      if (!calledAddrs(tx).every((a) => ALLOWED.has(a))) return res.status(403).json({ error: 'not sponsorable' });
      // also: map tx.invoke.user_address → linked tgUserId and enforce a daily quota
    }
  }
  const r = await fetch('https://starknet.paymaster.avnu.fi', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paymaster-api-key': process.env.AVNU_API_KEY! }, body: JSON.stringify(req.body) });
  res.status(r.status).json(await r.json());
});
```

**SNIP-9 outside execution** (self-hosted relayer instead of SNIP-29) ([SNIP-9](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-9.md), [starknet.js guide](https://github.com/starknet-io/starknet.js/blob/develop/www/versioned_docs/version-10.8.0/guides/account/outsideExecution.md)) (high):
- **Struct:** `OutsideExecution { caller, nonce, execute_after, execute_before, calls }`.
- **Versions:**
  - v1: `execute_from_outside`, SNIP-12 rev 0. Supported by ArgentX v0.3.0.
  - v2: `execute_from_outside_v2`, SNIP-12 rev 1. Supported by ArgentX v0.4.0, Braavos v1.1.0, and OpenZeppelin v1.0.0 builds that include the `src9` component.
  - v3: used by Cartridge.
- **Rules:**
  - Bind `caller` to your relayer, never `ANY_CALLER`.
  - Keep `execute_before` short.
  - Simulate before submitting.

```ts
// browser
const now = Math.floor(Date.now() / 1000);
const outsideTx = await account.getOutsideTransaction({ caller: RELAYER_ADDRESS, execute_after: now - 60, execute_before: now + 300 }, calls);
// server (relayer pays STRK gas)
const relayer = new Account({ provider, address: RELAYER_ADDRESS, signer: process.env.RELAYER_PK! });
const { transaction_hash } = await relayer.executeFromOutside(outsideTx);
```

### 3.6 Session keys (use last)

| | Ready (`@argent/x-sessions`) | Braavos (`starknet-sessions`) | Cartridge Controller |
|---|---|---|---|
| Package | 8.0.1 (2025-07-11); `next` 10.0.0 (2026-06-02) | 0.0.2 (2024-11-21); likely stale | 0.14.2 (2026-09-08) |
| Scope | Contract + selector | Contract + entrypoint; per-ERC-20 `spendingLimits` | Contract → methods as a Merkle root. `approve` needs spender + amount; whether the amount is enforced on-chain is unknown |
| Expiry | `expiry` | `executeAfter` / `executeBefore` | `expires_at`, checked on-chain |
| Who executes | Session key **plus a Ready backend co-signature**. Mainnet contracts must be whitelisted by Ready | Only `callerAddress` (your dapp account). Braavos describes this as "aligned with SNIP-9 … additional flexibility" | Session key plus an optional guardian. A `wildcard-policy` root allows any call, so never use it for a bot |
| Revoke | On-chain | Wallet UI | `revoke_session` |
| Sources | [Ready docs](https://docs.ready.co/aa-use-cases/session-keys) | [Braavos](https://braavos.app/braavos-session-keys/) | [Cartridge](https://docs.cartridge.gg/controller/architecture) |

**Risks:**
- **Policies are method-level, so arguments are free.** Allowing `transfer` or an unbounded `approve` effectively hands over the whole token balance.
- **AVNU swaps** still let the session holder pick `buy_token_min_amount` and the route. A minimum of zero through a thin pool is a plausible value-extraction attack (low–moderate).
- **Wallets are incompatible with each other.** A 2026-02-17 forum draft SNIP calls the implementations "all mutually incompatible" ([forum](https://community.starknet.io/t/snip-session-keys-for-smart-accounts/116131)). The author's Chipi Pay affiliation was not confirmed (moderate).

**If you must use session keys:**
- Use short expiries and per-token caps.
- Use a caller-bound design.
- Give each user their own KMS-encrypted key.
- Consider a thin intent contract that pins recipient = user and minimum output ≥ oracle price.
- Put a one-tap revoke link in the chat.

**Alternatives with less risk:**
- AVNU DCA orders (the orchestrator executes them)
- Ekubo limit orders or TWAMM
- starknet-agentic's agent account (per-token daily limits, expiry, emergency revoke). Its factory is Sepolia-only per the 2026-02-22 truth sheet, so mainnet would need a self-deploy ([repo](https://github.com/keep-starknet-strange/starknet-agentic)) (high).

### 3.7 If an LLM is added

- The LLM may only turn text into a typed command, using the user's own API key.
- Amounts, recipients and calls come from deterministic code and the user's signature, never from model output, memory or group messages.
- No plugin marketplace.
- No third-party LLM router anywhere near keys.

These rules come from the Freysa, AIXBT, Grok/Bankr, ElizaOS and ClawHub incidents (see the bots report) (moderate).

---

## 4. Telegram side

### 4.1 Library choice

| | grammY | Telegraf | node-telegram-bot-api |
|---|---|---|---|
| Latest | 1.46.0 (2026-08-26), Bot API 10.3 | 4.16.3 (2024-02-29); README says Bot API 7.1 | 2.1.0 (2026-08-24); v2 is a from-scratch rewrite, and 2.2.0-rc2 is on `next` |
| Verdict | **Use this.** Monthly releases and official plugins | Effectively frozen; missing Stars subscriptions and 10.x features | Interesting, but too new |

Sources: [grammY](https://github.com/grammyjs/grammY/releases), [Telegraf](https://registry.npmjs.org/telegraf), [ntba](https://github.com/yagop/node-telegram-bot-api/releases) (high).

**grammY conversations replay the builder function on every update.** Wrap every RPC call and database read in `conversation.external(...)`, or they run again on each replay (high).

### 4.2 Polling vs webhook

- `getUpdates` and webhooks are mutually exclusive, and Telegram keeps updates for at most 24 h ([Bot API](https://core.telegram.org/bots/api)).
- Only one poller per token can run. A second gets a 409 (moderate; this was not found in a primary source).
- **Start with long polling through `@grammyjs/runner`**, with `sequentialize` per chat and a clean SIGTERM stop. grammY says long polling has "no major drawbacks" ([deployment](https://grammy.dev/guide/deployment-types)).
- **Webhooks:**
  - Allowed ports are 443, 80, 88 and 8443.
  - Set `secret_token`; Telegram sends it back in `X-Telegram-Bot-Api-Secret-Token`.
  - A slow handler gets the update redelivered, and `webhookCallback` times out after 10 s. Queue slow work.
  - A webhook bot does run on Vercel or Cloudflare Workers. A persistent poller or chain ingestor does not run on Vercel Hobby (high).

### 4.3 Rate limits and alert fan-out

**Limits** ([FAQ](https://core.telegram.org/bots/faq)) (high):
- About 1 message/s per chat.
- 20 messages/min per group.
- About 30 messages/s overall.
- 429 responses carry `retry_after`.
- **Paid broadcasts** allow up to 1,000 messages/s. They cost 0.1 Stars per message, charged only above the free 30/s, and require 100,000 Stars on balance plus 100,000 MAU. grammY's docs still say 10,000 Stars, which is stale.

**Fan-out pattern:**
- Write alerts to an outbox with `UNIQUE(dedupe_key)`.
- Drain it with one sender at ≤25/s globally, 1/s per chat and 20/min per group.
- **Merge bursts into a single digest message.**
- On a 429, honour `retry_after` (auto-retry plugin). On a 403, set `blocked_at` and stop sending; `my_chat_member` updates report blocks.
- Bots cannot message users first.

**Time to send one alert to every user at 30/s:** 1k users ≈ 33 s; 10k ≈ 5.6 min; 100k ≈ 56 min.

```ts
import { autoRetry } from '@grammyjs/auto-retry';
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }));
// notifier loop: take due rows from outbox ordered by id; per-chat token bucket (1/s; groups 20/min);
// global bucket 25/s; group several pending rows for the same chat into one HTML digest; on 403 → users.blocked_at = now
```

### 4.4 Formatting

- **Use `parse_mode: "HTML"`.** Only `& < >` (plus `"` inside attributes) need escaping. MarkdownV2 needs 18 characters escaped, and decimals and minus signs make it brittle.
- **Text limit:** 1–4096 characters.
- **`callback_data` is 1–64 bytes**, so a 66-character address does not fit. Store a short database id instead.
- **Deep-link `start` parameter:** `A-Za-z0-9_-`, up to 64 characters. Strip `0x` (64 hex fits exactly) or base64url-encode the address.
- **Explorer links:** every alert should carry an explorer link and a USD value.

Sources: [Bot API](https://core.telegram.org/bots/api), [features](https://core.telegram.org/bots/features) (high).

### 4.5 Groups and admin checks

**Defaults:**
- Bots in groups run in privacy mode and only see commands addressed to them.
- Restrict configuration commands to admins.
- Send private data (portfolio, linked address) as **ephemeral messages** (Bot API 10.2, 2026-07-14; `ephemeral_message_parameters` in 10.3, 2026-08-24) or by DM ([changelog](https://core.telegram.org/bots/api-changelog)) (high).

```ts
async function isGroupAdmin(ctx: Context) {
  if (ctx.chat?.type === 'private') return true;
  const m = await ctx.getChatMember(ctx.from!.id);
  return m.status === 'administrator' || m.status === 'creator';
}
```

**Token-gated groups without a Mini App:**
1. The group links to `t.me/<bot>?start=join_<groupRef>`.
2. The user links a wallet through the external SNIP-12 page.
3. The bot checks `balance_of` (or a staking position).
4. The bot issues a join-request invite link.
5. When the `chat_join_request` arrives from a verified user, the bot calls `approveChatJoinRequest`; otherwise `declineChatJoinRequest`.
6. Re-check holdings on a schedule.

Notes on this flow:
- The parameters of `createChatInviteLink` were not checked in this research.
- Bot API 10.1's guard-bot `sendChatJoinRequestWebApp` shows a **Mini App**. Using it to connect a Starknet wallet falls under ToS §7, so do not use it for that.
- `answerChatJoinRequestQuery` with `queue` must be answered within 10 s. What `queue` does afterwards is [unverified].
- Leave captcha and anti-spam to Rose, Safeguard or Combot.

**Other Bot API features worth knowing:**
- **Managed bots** (9.6, 2026-04-03) allow a branded bot per project.
- **Guest mode** (10.0, 2026-05-08) lets a bot answer `/price` in chats it has not joined (high).

### 4.6 Stars payments

**Rules** ([ToS](https://telegram.org/tos/bot-developers), [Stars](https://core.telegram.org/bots/payments-stars), [Bot API](https://core.telegram.org/bots/api)) (high):
- Any premium tier is a digital good, so it must be sold in Stars (§6.2).
- Use `currency: "XTR"`, an empty provider token, and exactly one price item.
- Answer `pre_checkout_query` within 10 s.
- Grant access on `successful_payment`.
- Refund with `refundStarPayment`.
- Support `/terms` (or a similarly easy route to them) and `/paysupport`.

**Subscriptions:**
- Create them with `createInvoiceLink` and `subscription_period = 2592000`, with a price of at most 10,000 Stars.
- Toggle renewal with `editUserStarSubscription`.
- Reconcile with `getStarTransactions`.

**Payouts and keys:**
- Rewards are about $0.013 per Star, held up to 21 days, and paid via Fragment.
- Make handlers idempotent on `telegram_payment_charge_id`.

```ts
bot.command('pro', async (ctx) => {
  const link = await bot.api.raw.createInvoiceLink({ title: 'Pro alerts', description: '50 watched addresses, 500 alerts/hour',
    payload: `pro:${ctx.from!.id}`, currency: 'XTR', prices: [{ label: 'Pro (30 days)', amount: 250 }],
    subscription_period: 2592000 });
  await ctx.reply('Upgrade:', { reply_markup: new InlineKeyboard().url('Pay with Stars', link) });
});
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));          // within 10 s
bot.on('message:successful_payment', async (ctx) => {
  const p = ctx.message.successful_payment;
  await db.payments.insertIgnore({ id: p.telegram_payment_charge_id, tgUserId: ctx.from!.id, amount: p.total_amount,
    isRecurring: !!p.is_recurring, expiresAt: p.subscription_expiration_date });
  await db.users.setPlan(ctx.from!.id, 'pro', p.subscription_expiration_date);
});
```

The 250-Star price is a placeholder, not a recommendation.

---

## 5. Operations

### 5.1 Hosting

| Host | Fit | Numbers (fetched 2026-10-12) |
|---|---|---|
| **Fly.io** (default) | Always-on machine plus a volume for SQLite | shared-cpu-1x: 256 MB $2.19/mo, 512 MB $3.69/mo, 1 GB $6.70/mo; volumes $0.15/GB-mo; egress $0.02/GB. A volume lives on one server and is not replicated, so back up off-host. No free tier ([pricing](https://fly.io/docs/about/pricing/)) (high) |
| Railway | Good, usage-based | Hobby $5/mo with $5 of usage included ([pricing](https://railway.com/pricing)) |
| Render | Paid instances only | Free web services sleep after 15 min, which kills a poller |
| Hetzner-class VPS | Cheapest at 10k+ users if you run ops yourself | Price unknown |
| Cloudflare Workers | Webhook mode only | Cron at 1-minute granularity; free plan has 10 ms CPU per invocation ([limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| Vercel | Webhook handler; Pro allows a per-minute cron poller | Max function duration 300 s on Hobby, 800 s on Pro; Hobby cron runs once a day ([limits](https://vercel.com/docs/functions/limitations)) |

For self-hosters, ship one Docker image and a `docker-compose.yml` with a volume. Keep the ingestor as a single leader.

### 5.2 State

- **Database choice:**
  - Up to about 10k users: SQLite in WAL mode with Litestream or LiteFS backups.
  - Beyond that: Postgres with pg-boss. Neon costs about $19/month for 0.25 CU always on, or about $77/month for 1 CU ([Neon](https://neon.com/pricing)) (moderate arithmetic).
  - Redis: only for a shared rate limiter or BullMQ.
- **`node:sqlite`:** the `DatabaseSync`/`StatementSync` classes are synchronous, but `sqlite.backup()` returns a Promise.
- **Minimal schema:**
  - `users(tg_user_id PK, chat_id, lang, plan, plan_expires_at, created_at, blocked_at)`
  - `links(tg_user_id, address, class_hash, linked_at)`
  - `watches(id, tg_user_id, address_felt, label, min_usd, tokens)`
  - `chain_cursor(stream, block_number, block_hash)`
  - `outbox(id, chat_id, dedupe_key UNIQUE, payload, not_before, attempts, status)`
  - `intents(id, tg_user_id, calls_json, expires_at, tx_hash)`
  - `payments(telegram_payment_charge_id PK, …)`

### 5.3 Secrets

- **Bot token:**
  - It sits in the request URL path, so proxy and access logs leak it.
  - grammY keeps it out of error logs by default (`sensitiveLogs: false`).
  - Rotate it with BotFather `/revoke`.
- **Storage:** keep secrets in the platform store (`fly secrets`, `wrangler secret put`). Never commit them to config files.
- **Server-only keys:** the RPC key, the AVNU paymaster key and any relayer key stay on the server. Fund the relayer with a small balance only.
- **What the bot must never ask for:** seed phrases or private keys. ToS §6.3 also makes you responsible for securing any financial assets the bot handles (high).

### 5.4 Observability

- **Tooling:** pino for logs (hash user ids), Sentry, and OpenTelemetry.
- **Metrics to emit:**
  - chain lag (head − cursor)
  - outbox depth and oldest-item age
  - counts of 429s and `retry_after`
  - count of 403s
  - RPC errors and compute units per method
  - paymaster spend and runway (AVNU `/paymaster/v1/sponsor-activity`)
  - Stars payments and refunds
- **Alerts:** chain lag over ~60 s, or outbox age over ~5 min (moderate).

### 5.5 Abuse protection

- **Per-user limits:** `@grammyjs/ratelimiter` (default 1 request/s per user); cap free-tier watches; validate addresses before saving.
- **Paymaster quotas:** set them per linked user, through the proxy or the self-hosted webhook mode.
- **Alert filtering:** drop zero and dust `Transfer` events and fee transfers. Prevalence of address-poisoning on Starknet is unknown.
- **Impersonation:** publish the official @username and state "never DMs first; never asks for seeds; linking is a free signature, not a transaction". Fake "Safeguard" portals drained wallets with exactly this kind of flow ([PCrisk](https://www.pcrisk.com/removal-guides/34117-fake-telegram-safeguard-scam)).

### 5.6 Privacy

**Telegram ToS §4** (high):
- Have a privacy policy.
- Collect only what is essential.
- Delete data on request, when it is no longer needed, and when the bot shuts down.

**What to store and offer:**
- Store `tg_user_id`, `chat_id`, language, plan, watches and links.
- Do not store names, usernames, phone numbers or message history.
- Offer `/forget` (hard delete) and `/export`.
- Never put personal data in URLs; use opaque codes.

**Sensitivity:** linking a Telegram id to an address de-anonymises the wallet. Treat `links` and `watches` as sensitive personal data under GDPR: encrypt disks and backups and limit admin access (moderate).

### 5.7 Cost estimates

**Assumptions** (low–moderate; arithmetic on cited prices):
- One shared ingestor polls every 6 s on Alchemy at about 14M CU/month. This does not grow with user count.
- 20% of users are active daily, each making 5 reads/day.
- Half of users get a daily digest.
- Infura's Starknet per-method costs are unknown.

| Users | RPC CU/month (naive → optimised) | RPC $/month | Hosting + DB | Hosting $/month | One alert to all users at 30/s |
|---|---|---|---|---|---|
| 1k | ~16M | $0 (Alchemy free tier) | 1 Fly 512 MB machine, SQLite + backup | ~$4–6 | ~33 s |
| 10k | ~35M → ~22M | ~$0–19 | 1–2 Fly 1 GB machines; SQLite or Neon 0.25 CU | ~$7–35 | ~5.6 min |
| 100k | ~224M → ~47M | ~$25–118 | Separate bot, ingestor and notifier; Postgres ~1 CU; optional Redis | ~$100–150 | ~56 min, or a paid broadcast |

**Totals and other costs:**
- Excluding observability SaaS: about **$5/month at 1k**, **$10–55 at 10k**, **$125–270 at 100k**.
- Egress is negligible: about $0.18/month at 300k messages/day on Fly.
- One paid broadcast to 100k chats costs about 10,000 Stars, roughly $130 in forgone rewards.
- **Not included:** sponsored gas. AVNU's markup and typical sponsored-transaction cost are unknown. Budget it per action, and apply to the Propulsion Program for gas coverage.

---

## 6. Testing offline (Hotpod checks run with no network)

**Rules:**
- Every network boundary must be configurable: Telegram `apiRoot`, `STARKNET_RPC`, the AVNU client, and the paymaster URL.
- Behind those boundaries, run in-process fakes.
- Use **only `apiRoot`** for grammY. `environment: "test"` points at Telegram's separate *test servers* and changes the request path, so it is not an offline setup (high).
- Never leave `nodeUrl` unset, or starknet.js reaches for the public ZAN node.

```ts
// test/fakeBotApi.ts — ~40 lines; records calls, lets tests script failures
import { createServer } from 'node:http';
export const FAKE_ME = { id: 1, is_bot: true, first_name: 'TestBot', username: 'test_bot',
  can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } as any;
export function startFakeBotApi(port = 8081) {
  const calls: { method: string; body: any }[] = [];
  const script = new Map<string, any[]>();                              // method -> queued responses
  const srv = createServer(async (req, res) => {
    const method = req.url!.match(/^\/bot[^/]+\/(\w+)/)?.[1] ?? '';
    let raw = ''; for await (const c of req) raw += c;
    let body: any = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
    calls.push({ method, body });
    const reply = script.get(method)?.shift() ?? { ok: true, result:
      method === 'getMe' ? FAKE_ME
      : method === 'sendMessage' ? { message_id: calls.length, date: 0, chat: { id: body.chat_id, type: 'private' }, text: body.text }
      : true };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(reply));
  });
  return new Promise<{ calls: typeof calls; script: typeof script; close: () => void }>((ok) =>
    srv.listen(port, '127.0.0.1', () => ok({ calls, script, close: () => srv.close() })));
}
// usage
// const api = await startFakeBotApi();
// api.script.set('sendMessage', [{ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } }]);
// const bot = new Bot('123:TEST', { botInfo: FAKE_ME, client: { apiRoot: 'http://127.0.0.1:8081' } });
// await bot.handleUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat: { id: 42, type: 'private' },
//   from: { id: 42, is_bot: false, first_name: 'T' }, text: '/link', entities: [{ type: 'bot_command', offset: 0, length: 5 }] } });
// assert(api.calls.some(c => c.method === 'sendMessage' && /Link wallet/.test(JSON.stringify(c.body))));
```

```ts
// test/fakeRpc.ts — JSON-RPC 2.0 fake for the methods the bot uses
import { createServer } from 'node:http';
export function startFakeRpc(state: { head: number; hashes: Record<number, string>; events: any[];
                                       calls: Record<string, string[]> }, port = 5050) {
  const handlers: Record<string, (p: any) => any> = {
    starknet_specVersion: () => '0.10.2',
    starknet_chainId: () => '0x534e5f4d41494e',
    starknet_blockNumber: () => state.head,
    starknet_blockHashAndNumber: () => ({ block_number: state.head, block_hash: state.hashes[state.head] }),
    starknet_getBlockWithTxHashes: (p) => {
      const id = (Array.isArray(p) ? p[0] : p.block_id);
      const n = id === 'latest' ? state.head : id.block_number;
      return { status: 'ACCEPTED_ON_L2', block_number: n, block_hash: state.hashes[n], parent_hash: state.hashes[n - 1] ?? '0x0',
               timestamp: 1_760_000_000 + n * 2, transactions: [] };
    },
    starknet_getEvents: (p) => {
      const f = Array.isArray(p) ? p[0] : p.filter;
      const from = f.from_block.block_number, to = f.to_block.block_number;
      if (f.chunk_size > 1024) throw { code: 31, message: 'Requested page size is too big' };
      const hits = state.events.filter((e) => e.block_number >= from && e.block_number <= to &&
        (!f.address || BigInt(e.from_address) === BigInt(f.address)));
      const start = Number(f.continuation_token ?? 0), page = hits.slice(start, start + f.chunk_size);
      return { events: page, ...(start + f.chunk_size < hits.length ? { continuation_token: String(start + f.chunk_size) } : {}) };
    },
    starknet_call: (p) => {
      const r = Array.isArray(p) ? p[0] : p.request;
      return state.calls[`${BigInt(r.contract_address)}:${r.entry_point_selector}`] ?? ['0x0'];
    },
  };
  return createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const one = async (m: any) => { try { return { jsonrpc: '2.0', id: m.id, result: handlers[m.method]!(m.params) }; }
      catch (e: any) { return { jsonrpc: '2.0', id: m.id, error: e?.code ? e : { code: -32601, message: String(e) } }; } };
    const msg = JSON.parse(raw);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Array.isArray(msg) ? await Promise.all(msg.map(one)) : await one(msg)));
  }).listen(port, '127.0.0.1');
}
```

**Notes on the fakes:**
- Key `state.calls` by the contract plus the **selector** (`hash.getSelectorFromName('balance_of')`), because that is what goes over the wire.
- To fake a wallet link, make `is_valid_signature` return `['0x56414c4944']`.
- Whether starknet.js sends named or positional params can vary by method, so the fake accepts both. This is not verified per method.

**Scenarios Hotpod's checks should cover:**
- **Reorg:** change `hashes[n]` between ticks. The cursor rewinds and the outbox sends no duplicates.
- **Pre-confirmed duplicates:** the same event delivered twice. Dedupe holds.
- **Paging:** `PAGE_SIZE_TOO_BIG`, and empty pages that still carry a `continuation_token`.
- **Both Transfer layouts**, including a block that contains both.
- **Fake "USDC" by symbol** at the wrong address: rejected.
- **Stale Pragma price**, or too few sources: refused.
- **Telegram errors:** 429 with `retry_after` (backoff) and 403 "bot was blocked" (`blocked_at` set).
- **Callback data** over 64 bytes: rejected at build time.
- **SNIP-12 link:** expired code, reused code, wrong signature, undeployed account.
- **`buildSwap`:** a bad spender, an over-large approve or an unexpected call all throw. Inject a fake AVNU client.
- **Paymaster proxy:** a sponsored request to a non-allow-listed contract returns 403.
- **Stars:** a duplicate `successful_payment` is processed only once.

**Integration tier:**
- starknet-devnet v0.10.0 (Starknet 0.14.4, RPC 0.10.2; forking, dump/load, time control) supports real signing and real `is_valid_signature` checks ([compatibility](https://raw.githubusercontent.com/0xSpaceShard/starknet-devnet/main/website/docs/compatibility.md)).
- With no network it only works if the Docker image or binary is already present. Its fork mode needs network. Keep the pure in-process fakes as the default check (inference).
- `telegram-test-api` exists but was last pushed in June 2024, so prefer the 40-line fake above.

---

## 7. Legal and regulatory notes (not legal advice)

**Telegram:**
- No Mini App for Starknet features (§7). Stars for digital goods (§6.2).
- Privacy duties (§4). Responsibility for any assets the bot handles (§6.3) ([ToS](https://telegram.org/tos/bot-developers)) (high).

**EU (MiCA, Regulation 2023/1114):**
- **Definitions:**
  - Custody (Art. 3(1)(17)) covers "safekeeping or controlling, on behalf of clients, … the means of access … in the form of private cryptographic keys".
  - Advice (Art. 3(1)(24)) means personalised recommendations.
  - Transfer services and reception/transmission of orders are separate regulated services.
- **Transitional period:** ended 2026-07-01 under Art. 143(3). Several member states ended it earlier (NL, FI, LV, HU, SI on 2025-06-30; SE on 2025-09-30).
- **ESMA statement of 2026-06-23:** unauthorised CASPs must "immediately stop" onboarding EU clients ([ESMA single rulebook](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-3-definitions), [Elliptic](https://www.elliptic.co/blog/the-end-of-micas-transitional-period)) (high).
- **Implications:**
  - A bot that generates and holds user keys is very likely a custodial CASP (moderate).
  - The non-custodial position rests on the "on behalf of clients" wording and Recital 22. Recital 83 is about custody policies, not a wallet-software carve-out (high on the text; moderate on the interpretation).
  - Keep alerts factual and triggered by thresholds the user sets. No "buy" or "sell" signals.

**United States:**
- **FinCEN FIN-2019-G001:** hosted wallet providers are money transmitters; users of unhosted wallets acting for themselves are not ([FinCEN PDF](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf)) (high).
- **DOJ memo "Ending Regulation By Prosecution" (2025-04-07):** deprioritises §1960(b)(1)(A)/(B) charges absent willfulness. It is enforcement policy, not law ([DOJ](https://www.justice.gov/dag/media/1395781/dl?inline)) (high). State money-transmitter licensing still applies.
- **CLARITY Act:** Senate cloture failed 49–50 on 2026-09-15 ([The Defiant](https://thedefiant.io/news/regulation/senate-blocks-clarity-act-49-50-with-no-democratic-votes-to-proceed)). That it includes BRCA developer protections, and that there is still no federal safe harbour, are both moderate.

**Practical stance:**
- Stay non-custodial and informational.
- Integrator fees and order routing are the grey zone.
- Geo-fence or get counsel before adding custody, transfers or automated trading.
- Screen for sanctions if the bot ever touches funds.

---

## 8. Open questions and what could not be verified

**Telegram:**
- Whether Telegram will extend §7 to plain bots that link to non-TON dapps.
- What `answerChatJoinRequestQuery` `queue` does afterwards.
- `createChatInviteLink` parameters (not checked in this research).

**Wallets and SDKs:**
- Whether starknetkit 3.4.3 (peer `starknet ^8`) works alongside starknet 10.8 on the signing page.
- Whether passkeys and wallet deep links work inside Telegram's in-app browser.
- How Ready mobile and Braavos mobile display SNIP-9/SNIP-29 typed data to users.
- Whether the starknet.js 10.8 `getEvents` typings accept an address array.
- The Ready session-key whitelisting process.
- Whether Cartridge `approve` caps are enforced on-chain.
- Whether starknet-agentic has deployed a mainnet AgentAccountFactory since 2026-02-22.

**Contracts:**
- Whether AVNU's deployed exchange class matches the published source.
- The Ekubo `Swapped` event key and the `delta` sign convention (verify against real events).
- The amount type in the staking pool's entrypoints (read it from the ABI).

**Costs and providers:**
- AVNU and Cartridge paymaster markup, and the typical cost of a sponsored transaction on mainnet.
- Starknet free-tier details at Infura, QuickNode and Chainstack.
- Whether provider WebSocket quality and `getEvents` limits hold over time; they were observed on a single day.
- Voyager API status.
- The full fee-collector address.

**Other:**
- No official announcement was found for the April 2026 STRK/ETH Transfer layout change; the block numbers come from on-chain bisection.
- Snapshot values that change daily: block time, L1 lag, Pragma prices, staking totals.
