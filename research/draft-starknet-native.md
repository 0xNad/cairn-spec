# Cairn: a Starknet bot for Telegram, as a Hotpod project

Spec draft, 2026-10-12.

- **Confidence labels.** Each label (high, moderate, low or unknown) applies to the claim it follows.
- **"(unverified)"** marks a fact the creator must confirm on-chain or in a primary source before the round that depends on it is committed.
- **Research sources.** The Starknet facts come from the research done for this spec. On-chain checks were made on 12 Oct 2026 over `starknet-rpc.publicnode.com`, which runs spec 0.10.3. Sources are linked inline.

---

## 1. Name, pitch and personas

**Name: Cairn.** A cairn is a pile of stones that marks a trail. The name says the bot marks what happens on your path, and it nods to Cairo.

- **Why not "Starkbot":** @starkbotapp already exists (StarkBot, an AI DeFi chatbot, https://ethglobal.com/showcase/starkbot-k5ema).
- **Why not "Stark" or "Starknet" in the name:** those names lean on StarkWare's marks.
- **Not yet checked:** I have not searched trademarks or Telegram handles (unknown). Fallback names: Waypost, Stoa.
- **Code names:** entry file `cairn.mjs`, environment prefix `CAIRN_`.

**Pitch.** Cairn is an open-source Telegram bot for Starknet that anyone can self-host.

- It reads the chain directly: token balances, transfers, STRK and BTC staking, the Pragma oracle and Starknet ID names.
- It alerts people and groups when something they care about happens.
- When the user wants to act, it turns the action into a transaction the user signs in their own wallet. The transaction is batched into one multicall and can pay its gas in USDC through a paymaster.
- It never holds, creates or asks for a key.
- It is a plain bot, not a Mini App. Telegram's rule that Mini Apps must use TON only does not apply to it. Regular bots without a Mini App are exempt (https://core.telegram.org/bots/blockchain-guidelines, high).

**Why this, why now.**

- **Starknet has no staking monitor, no wallet-alert bot and no group token feed** (moderate; based on absence of evidence).
- **Multichain trackers skip Starknet.** Cielo, DeBank and Zerion do not cover it (moderate).
- **The best-funded Starknet Telegram effort is dead.** Argent/Ready's Telegram wallet was deprecated "due to new Telegram rules" (high).
- **Staking is hands-on.**
  - Rewards must be claimed by hand.
  - An epoch with no attestation pays the validator nothing.
  - An exit takes 7 days.
  - 1.1B STRK and 1,700 BTC were staked by Dec 2025.
- **The custodial alternatives keep losing user funds:** Maestro, Unibot, Banana Gun, Nova and SIGMA (high).

| Persona | What they get | Why they add it |
|---|---|---|
| **Holder (H)**: self-custody STRK, ETH and BTC holder | Balances, prices, transfer and approval alerts, `.stark` names, send-and-sign | DeBank, Zerion and Cielo do not cover Starknet; users have asked since 2023 |
| **Delegator (D)**: STRK or BTC staker | Staking card, alerts for missed epochs, commission changes and validator exits, reward and withdrawal reminders, claim-and-restake in one signature | Rewards are claimed by hand, a missed epoch pays zero, exits take 7 days, and validator uptime data is hard to find |
| **Validator operator (V)** | An alert when the attestation window closes without an attestation, and low-balance alerts for the operational account | The delegation program requires 99% (Track A) or 99.5% (Track B) liveness |
| **Group admin (G)**: project and community groups, including Hotpod projects | Token buy/sell feed, whale alerts, network stall and reorg alerts, all under admin control | No buy bot exists for Starknet. Every group that installs it spreads it |
| **Builder or self-hoster (B)** | `/tx`, `/track`, `/status`, network watch, one-process self-hosting | Outages were spotted first by community bots, not official channels (Sept 2025 governance minutes) |
| **Trader (T)** | Prices, price alerts, feeds | The main on-chain activity (Q3 2025 poll). The StarkWare Trading Guild is a pilot audience |

---

## 2. Principles and non-goals

**Principles** (each is enforced by a check where it can be, and by the rubric otherwise):

1. **No custody, ever.**
   - Cairn never holds, generates, imports, stores or asks for a private key, seed phrase, session key or viewing key.
   - It never calls a `starknet_add*` method and never signs a transaction.
   - Transactions are prepared by Cairn and signed by the user in their own wallet on a web page Cairn serves. Gasless relaying forwards the user's signature over typed data that Cairn has checked; it confers no authority.
   - Rationale: custody is the top cause of Telegram-bot losses, and under MiCA, holding keys counts as custody that needs a licence (moderate).
2. **No Mini App, no in-bot payments.** Wallets connect only on an external page reached by an ordinary link. Paid tiers are out of scope: digital goods sold in Telegram must use Stars.
3. **No financial advice.**
   - Cairn reports facts: amounts, prices, statuses and deadlines.
   - It does not rank validators or recommend trades. It makes no predictions.
   - The validator directory is alphabetical.
4. **No spam.**
   - Everything is opt-in. Direct messages go only to users who started the bot.
   - Group posts appear only after an admin enables them.
   - There are no referral rewards, paid "trending" slots, volume bots or promotional messages.
   - Cairn respects Telegram's limits: 1 message/s per chat and 20 messages/min per group.
5. **Privacy by minimisation.**
   - Stored: chat ids, settings, watched addresses and labels, the update offset and the delivery ledger.
   - Never stored: message text, names, usernames or phone numbers.
   - No analytics and no telemetry. Cairn contacts only the hosts that are configured.
   - `/export` and `/forget` are available from round 2.
   - `/start` explains that the operator learns which Telegram chat watches which address.
6. **Self-hostable and open.**
   - One Node 24 process, with no database server.
   - It works with any JSON-RPC 0.10 endpoint.
   - No feature needs a token, and safety features are never gated.
7. **Starknet-native, chain over docs.**
   - Cairn reads protocol contracts directly: staking, attestation, Pragma and Starknet ID.
   - It reads protocol parameters from the contracts. The docs are stale: the epoch length is 1,961 blocks on mainnet, while the docs say 1,132 (high).
   - It shows off account abstraction through multicall and the paymaster.

**Non-goals** (from the research, §7 "Do not build"):

- custodial trading or sniper bots;
- importing keys or seed phrases;
- storing STRK20 viewing keys;
- airdrop farming or sybil automation;
- sniping and MEV;
- copy trading that executes automatically;
- paid trending and volume bots;
- custodial tipping;
- a free-text AI agent that signs transactions;
- a general anti-spam engine (integrate with Rose or Shieldy instead);
- any Mini App;
- session keys held by the bot (see risk R3).

---

## 3. Feature list

**Personas:** H holder, D delegator, V validator operator, G group admin, B builder or self-hoster, T trader.

**"Checked by":**
- **check:** asserted by `.launchpad/checks/round-<n>/run.mjs` against loopback fakes.
- **rubric:** judged by people.

| ID | Feature | Command or trigger | Persona | Round | Priority | Checked by |
|---|---|---|---|---|---|---|
| F01 | Self-hosted runtime: three commands, fixed exit codes | `node cairn.mjs run / tick / doctor` | B | 1 | must | check |
| F02 | Configuration from the environment and a network file, validated before any network call; chain-id guard | env vars, `networks/<chain>.json` | B | 1 | must | check |
| F03 | Onboarding and command menu | `/start`, `/help`, `setMyCommands` | all | 1 | must | check (HTML, menu) + rubric (copy) |
| F04 | Network card: head block, block time, L1, L1-data and L2 gas prices, node spec version | `/status` | B, all | 1 | must | check |
| F05 | Balances across the token registry: exact u256 amounts, USD values, "not deployed" flag | `/balance <address>` | H | 1 | must | check |
| F06 | On-chain prices from Pragma with age, number of sources and a stale flag; Refresh button | `/price [SYMBOL…]` | H, T | 1 | must | check |
| F07 | Transaction card: finality, execution, fee in STRK, block, revert reason, explorer link | `/tx <hash>` | B, H | 1 | must | check |
| F08 | Paste to look up, in private chats | a bare address or hash | H | 1 | should | check |
| F09 | Group-safe command handling, working with privacy mode on | `/cmd`, `/cmd@<bot>` | G | 1 | must | check |
| F10 | Resilience: RPC retry and backoff, RPS cap, Telegram `retry_after`, skipping chats that return 403, splitting at 4096 characters | — | all | 1 | must | check |
| F11 | Security baseline: secrets only from the environment and never echoed; only configured hosts; read-only RPC; data directory 700 with files 600; repository scan; dependency allowlist | — | all | 1 | must | check |
| F12 | Starter registries for mainnet and Sepolia | `networks/SN_MAIN.json`, `networks/SN_SEPOLIA.json` | B | 1 | must | check (shape) + rubric (accuracy) |
| F13 | Starknet ID input: `name.stark` accepted wherever an address is | any command | H | 2 | must | check |
| F14 | Verified reverse names in replies and alerts | — | H, G | 2 | must | check |
| F15 | Wallet watches with labels and a minimum-USD filter, at most 20 per chat | `/watch`, `/unwatch`, `/watches` | H, B | 2 | must | check |
| F16 | Transfer alerts in and out, for both event layouts, with USD value and counterparty | `Transfer` event | H | 2 | must | check |
| F17 | Warning on unlimited approvals by a watched address | `Approval` event | H | 2 | should | check (layout unverified) |
| F18 | Transaction tracker | `/track <hash>` | B, H | 2 | must | check |
| F19 | Price alerts on Pragma prices, once per crossing | `/alert <SYMBOL> above\|below <usd>` | H, T | 2 | should | check |
| F20 | Delivery guarantees: nothing from before the watch, one alert per (transaction, event index), never lost on a kill, a notice when a gap is skipped | — | all | 2 | must | check |
| F21 | Per-user rate limit and per-chat caps | — | all | 2 | must | check |
| F22 | Data rights | `/export`, `/forget` | all | 2 | must | check |
| F23 | Delegation card for STRK and BTC pools | `/staking <address\|name> [validator…]` | D | 3 | must | check |
| F24 | Pool discovery from `NewPoolMember` events and named validators | — | D | 3 | must | check |
| F25 | Validator card: stake per token, commission, attestation status, operational balance, exit intent | `/validator <staker\|name>` | V, D | 3 | must | check |
| F26 | Delegator alerts: missed epoch, commission change, validator exit | `/stakewatch <address\|name>` | D | 3 | must | check |
| F27 | Reward reminder; "withdraw ready" once the exit wait has passed | `/stakewatch … min=<STRK>` | D | 3 | must | check |
| F28 | Operator alerts: attestation window closed with no attestation; low operational balance | `/validatorwatch <staker\|name> [low=<STRK>]` | V | 3 | must | check |
| F29 | Staking parameters read from the contracts, never hardcoded | — | D, V | 3 | must | check |
| F30 | Neutral validator directory: alphabetical, no ranking | `validators` in the network file | D | 3 | should | check (order) + rubric |
| F31 | Group settings only for chat admins | any group setting command | G | 4 | must | check |
| F32 | Token feed: Ekubo and AVNU buys and sells, one post per transaction | `/feed <SYMBOL\|address> [min=<usd>]` | G, T | 4 | must | check |
| F33 | Whale alerts for a token | `/whales <SYMBOL> <amount>` | G, T | 4 | should | check |
| F34 | Network watch: stall and recovery; reorgs with corrections | `/netwatch` | B, all | 4 | must | check |
| F35 | Per-group send budget, with a summary for bursts | — | G | 4 | must | check |
| F36 | Forum topics and supergroup migration | — | G | 4 | should | check |
| F37 | Quiet hours, with a summary of held alerts | `/quiet HH:MM-HH:MM [±HH:MM]` | H, G | 4 | should | check |
| F38 | Seed-phrase guard: delete and warn, never echo | a message of 12 to 24 BIP-39 words | all | 4 | should | check |
| F39 | Set your account (a public address only) | `/wallet <address\|name>` | H, D | 5 | must | check |
| F40 | Signing links: an opaque, single-use, expiring intent on a page Cairn serves | `${CAIRN_PUBLIC_URL}/i/<id>` | all | 5 | must | check |
| F41 | Send tokens to an address or `.stark` name | `/send <amount> <SYMBOL> <to>` | H | 5 | must | check |
| F42 | Staking actions as multicalls: claim, claim-and-restake, delegate (approve + enter) | buttons on `/staking`, `/delegate` | D | 5 | must | check |
| F43 | Exit and withdraw | buttons on `/staking` | D | 5 | should | check |
| F44 | Simulation before signing and a fee estimate; a revert reason instead of a link | — | H, D | 5 | should | check |
| F45 | Submitted transaction checked against the intent, then tracked | page POSTs the hash; `/start done_<id>` | all | 5 | must | check |
| F46 | Gasless: pay the fee in USDC or another token through the SNIP-29 paymaster | option on the page | H, D | 5 | should | check |
| F47 | Signing-page hardening: CSP, no third-party code, chain and account must match, each call shown | — | all | 5 | must | check (headers; in-browser test conditional, R4 in §6) + rubric |
| F48 | Governance alerts: Snapshot X proposals on Starknet opening and closing; "your delegate has not voted" | `/govwatch` | H | later | should | (event layout unverified) |
| F49 | Token-gated groups: SNIP-12 sign-in verified through the account's `is_valid_signature`, which works for every account type | `chat_join_request` | G | later | should | (needs a Poseidon/SNIP-12 hash: starknet.js or vendored) |
| F50 | Lending health and oracle-deviation alerts for Vesu and Nostra | `/lendwatch` | H | later | should | (ABIs unverified) |
| F51 | Ekubo LP out of range; TWAMM or limit order filled | — | T | later | could | — |
| F52 | Webhook mode, health endpoint, RPC failover (`STARKNET_RPC_URLS`) | env | B | later | should | — |
| F53 | Guest-mode lookups in chats the bot has not joined | `@bot price STRK` | H | later | could | — |
| F54 | Buyer leaderboard for a feed | `/top` | G | later | could | — |
| F55 | Transaction history CSV for tax tools | `/history` | H | later | could | — |
| F56 | Scheduled withdrawal: a pre-signed SNIP-9 outside execution, relayed after the 7-day wait | — | D | later | could | (needs a funded relayer, or paymaster support for future time windows; unverified) |
| F57 | Managed per-project bots (Bot API 9.6) | — | G | later | could | — |
| F58 | Session keys held by the bot | — | T | **out** | — | Conflicts with principle 1; no standard (risk R3) |
| F59 | STRK20 shielded balances through viewing keys | — | H | **out** | — | Viewing keys are too sensitive to hold |
| F60 | A Telegram Mini App of any kind | — | — | **out** | — | TON-only rule |
| F61 | Custody, key import, sniping, automatic copy trading, airdrop farming, paid trending, an AI agent that signs, custodial tips | — | — | **out** | — | Research §7 |

---

## 4. Architecture

### 4.1 Modules (suggested; checks depend only on `cairn.mjs`, the files named below, and behaviour)

| Module | Job | Round |
|---|---|---|
| `cairn.mjs` | Parses the command line and environment, validates the network file, maps outcomes to exit codes | 1 |
| `lib/telegram` | `fetch`-based Bot API client: long poll with `AbortController`, offset confirmation, `retry_after`, handling of 403 and migration, per-chat send queue, HTML escaping, splitting at 4096 characters | 1 |
| `lib/rpc` | JSON-RPC 0.10 client: rate limiter, timeout, retry with backoff, mapping of spec errors, block-id guard | 1 |
| `lib/felt` | Felts, u256 values (`low + high·2^128`), i129 values, address normalisation, short-string encoding, Starknet ID encoding (R2), multicall calldata (R5) | 1 |
| `lib/state` | Persistent state in `CAIRN_DATA` | 1 |
| `lib/commands/*` | One file per command | 1+ |
| `lib/indexer` | Block cursor, paged `getEvents`, dedup ledger, gap skipping (R2), reorg detection (R4) | 2 |
| `lib/staking` | Pool discovery, member and validator reads, epoch logic | 3 |
| `lib/feeds` | Ekubo and AVNU swap decoding, whale filter, group budget | 4 |
| `lib/web` + `web/sign.html` | Intent store, HTTP API, signing page, paymaster relay | 5 |
| `ARCHITECTURE.md` | The specification the checks follow to the letter, as in Toddler Buddy | 1+ |

### 4.2 Commands, outputs and exit codes (frozen in round 1)

```
node cairn.mjs run      # long-poll Telegram; poll the chain every CAIRN_POLL_MS; serve the signing page if CAIRN_WEB_PORT is set (R5);
                        # SIGTERM/SIGINT → exit 0 within 3 s, even during a held getUpdates
node cairn.mjs tick     # drain pending updates (getUpdates timeout=0 until empty), handle them, one chain poll,
                        # save state, confirm the offset, print ONE JSON line, exit
node cairn.mjs doctor   # getMe, starknet_chainId, starknet_specVersion, starknet_blockNumber; print ONE JSON line; exit
```

- **`tick`** prints `{"updates":3,"replies":3,"head":812345}`.
  - Round 2 adds `"alerts":<n>`.
  - `head` is `null` when the node could not be reached.
  - Later rounds may add keys; checks ignore keys they do not know.
- **`doctor`** prints `{"bot":"cairn_test_bot","chain":"SN_MAIN","block":812345,"spec":"0.10.3"}`.
- **`run` and `tick`** call `setMyCommands` when the stored command list differs from the current one. They call `starknet_chainId` once per process, before any reply.
- **There are no other arguments or flags.** All configuration comes from the environment.
- **Exit codes:**

| Code | Meaning |
|---|---|
| 0 | OK. `tick` still exits 0 when the node failed: those commands got a "node unavailable" reply |
| 1 | Telegram could not be reached, or (for `doctor` only) the node could not be reached. Reason on stderr; state stays consistent |
| 2 | Bad command line or configuration: a missing or unknown command, a bad env value, a bad network file, or `starknet_chainId` ≠ `CAIRN_CHAIN`. Reason on stderr, nothing on stdout. **No network call** for bad env or a bad file |
| 3 | Telegram rejected the token (401). A supervisor should not restart-loop on this |

### 4.3 Environment

Secrets come only from the environment, never from flags, because flags show up in `ps`.

| Variable | Default | Round | Rule |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | required | 1 | `^\d+:[A-Za-z0-9_-]{30,}$`. Secret |
| `TELEGRAM_API_ROOT` | `https://api.telegram.org` | 1 | http(s) origin, no path, no trailing slash. Calls go to `${root}/bot${token}/${method}` |
| `STARKNET_RPC_URL` | required; no public default | 1 | JSON-RPC 0.10 endpoint, path included. **Secret** (provider URLs embed keys). Logs show only the origin |
| `CAIRN_CHAIN` | `SN_MAIN` | 1 | `SN_MAIN` or `SN_SEPOLIA` |
| `CAIRN_NETWORK` | `networks/<CAIRN_CHAIN>.json` next to `cairn.mjs` | 1 | The network file (§4.4) |
| `CAIRN_DATA` | `./data` | 1 | Created with mode 700, files 600. Nothing is written anywhere else |
| `CAIRN_EXPLORER_URL` | `https://voyager.online` (Sepolia: `https://sepolia.voyager.online`) | 1 | Used only to build links (`/tx/<hash>`, `/contract/<address>`); never fetched |
| `CAIRN_POLL_MS` | 10000 | 1 | Chain poll interval in `run`. Minimum 50; checks use 100 |
| `CAIRN_TG_TIMEOUT` | 30 | 1 | `getUpdates` long-poll seconds in `run`, 0–50. Checks use 1 |
| `CAIRN_RPC_RPS` | 5 | 1 | Most HTTP requests to the node in any 1-second window |
| `CAIRN_RPC_TIMEOUT_MS` | 10000 | 1 | Per request. Checks use 1500 |
| `CAIRN_PRICE_MAX_AGE` | 900 | 1 | Seconds of chain time before a price counts as stale |
| `CAIRN_LOG` | `info` | 1 | `error\|warn\|info\|debug`. One JSON line per event on **stderr**; stdout is reserved for `tick` and `doctor` |
| `CAIRN_MAX_BLOCKS` | 500 | 2 | Most blocks scanned per poll |
| `CAIRN_MAX_GAP` | 50000 | 2 | Blocks behind (about 25 h at 1.78 s per block) before skipping ahead with a notice |
| `CAIRN_NAME_TTL` | 2000 | 2 | Blocks a name lookup stays cached |
| `CAIRN_STALL_SECONDS` | 60 | 4 | Wall-clock seconds without a new block before a stall alert. Minimum 2 |
| `CAIRN_ACTIONS` | `off` | 5 | `on` enables `/wallet`, `/send`, `/delegate` and the action buttons |
| `CAIRN_WEB_PORT` | unset | 5 | Port for the signing page. Unset means no listening socket |
| `CAIRN_WEB_HOST` | `127.0.0.1` | 5 | Bind address. Put a TLS proxy in front |
| `CAIRN_PUBLIC_URL` | required when actions are on | 5 | Origin used in links. Must be https, except http for `127.0.0.1` or `localhost` |
| `CAIRN_INTENT_TTL` | 900 | 5 | Seconds of chain time an intent stays open |
| `CAIRN_PAYMASTER_URL` | unset | 5 | SNIP-29 endpoint (AVNU: `https://starknet.paymaster.avnu.fi`, `https://sepolia.paymaster.avnu.fi`). Unset means gasless is off |
| `CAIRN_PAYMASTER_API_KEY` | unset | 5 | Secret; only for sponsored ("gasfree") mode. The header name is unverified |

**Clock rule.**
- User-visible time is chain time: "now" is the timestamp of the latest block read. Per-user rate limits use `message.date`.
- `Date.now()` is allowed only for backoff, timeouts, logs and the stall detector (F34), because the chain clock stops when the chain does.
- Checks control time by adding blocks. This makes reminders, quiet hours and intent expiry deterministic.

### 4.4 Network file (`networks/<chain>.json`)

| Key | Round | Rule |
|---|---|---|
| `chain` | 1 | Must equal `CAIRN_CHAIN` |
| `tokens[]` | 1 | `{"symbol","address","decimals","price"?}`. Symbol matches `^[A-Za-z0-9.]{1,11}$` and is unique. Address is hex < 2^251. Decimals is an integer from 0 to 36. `price` names a Pragma spot pair, such as `"STRK/USD"` |
| `contracts.pragma` | 1 | Absent means no prices and no USD values |
| `contracts.starknet_id` | 2 | Absent means names are off, and round-1 replies are unchanged |
| `contracts.staking`, `contracts.attestation`, `staking_from_block`, `validators[]` (`{"name","staker"}`) | 3 | Absent means the staking commands say "not available on this network" |
| `contracts.ekubo_core`, `contracts.avnu_exchange` | 4 | Absent means that DEX is left out of feeds |

- Keys Cairn does not know are ignored, so later rounds can add keys.
- A bad entry exits 2 and names its JSON path, e.g. `tokens[3].decimals`.
- **Every feature turns itself off when its contract is absent.** That is how every round's checks keep passing as later rounds add features.

**Starter mainnet registry** (addresses verified on-chain in the research unless marked):

| Symbol | Address | Decimals | Transfer layout | Pragma pair |
|---|---|---|---|---|
| STRK | 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d | 18 | keys `[sel, from, to]` | STRK/USD (8 decimals) |
| ETH | 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7 | 18 | keys | ETH/USD (8) |
| USDC | 0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb | 6 | keys | USDC/USD (6) |
| USDC.e | 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8 | 6 | **legacy: all fields in data** | USDC/USD |
| USDT | 0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8 | 6 | keys | USDT/USD (pair unverified) |
| WBTC | 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac | 8 | **legacy** | BTC/USD (peg assumed) |
| strkBTC | 0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135 | 8 | not sampled (unverified) | BTC/USD (unverified choice) |

**Mainnet contracts:**

| Contract | Address |
|---|---|
| Pragma | 0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b |
| Starknet ID naming | 0x06ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678 |
| Staking | 0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7 |
| Attestation | 0x10398fe631af9ab2311840432d507bf7ef4b959ae967f1507928f5afe888a99 |
| Ekubo Core | 0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b |
| AVNU Exchange | 0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f |

**Sepolia:**

| Item | Address |
|---|---|
| STRK, ETH | Same as mainnet |
| USDC | 0x512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343 |
| USDC.e | 0x53b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080 |
| Pragma | 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a |
| Staking | 0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1 |
| Attestation | 0x03f32e152b9637c31bfcf73e434f78591067a01ba070505ff6ee195642c9acfb |
| Starknet ID naming | 0x0154bc2e1af9260b9e66af0e9c46fc757ff893b3ff6a85718a810baf1474 (**60 hex digits as recorded: verify that it is not truncated**) |

**Checks assert the registry's shape and symbols, not its addresses.**

### 4.5 Message and data formats (all rounds)

- **Every `sendMessage` and `editMessageText` uses `parse_mode: "HTML"`.**
  - User-supplied text is escaped: `&`, `<` and `>`, plus `"` inside attributes.
  - Allowed tags: `b`, `i`, `u`, `s`, `a href`, `code`, `pre`, `blockquote`, `tg-spoiler`.
- **Length:** each message is 1 to 4096 UTF-16 units after entity parsing. Longer replies are split at line breaks.
- **Amounts:** exact decimal computed with BigInt, trailing zeros trimmed, `.` as the decimal point, optional `,` grouping (checks strip commas), then a space and the symbol: `1,234.5 STRK`. Fees are shown in STRK (FRI ÷ 10^18).
- **USD values:** `amount × price ÷ 10^(token decimals + pair decimals)`, shown as `$1,234.57`, rounded half up to 2 decimals. A non-zero value below a cent is shown as `<$0.01`. No USD value is ever computed from a stale price.
- **Prices:** the exact oracle value, trimmed (`$0.1234`), plus its age in chain time and `num_sources_aggregated`.
- **Times:** `YYYY-MM-DD HH:MM:SS UTC`.
- **Addresses:**
  - Normalised to `0x` plus 64 lowercase hex digits.
  - Input is valid when it has 1 to 64 hex digits and is < 2^251 − 256.
  - Shown short as `0x0471…938d`, or as a verified `.stark` name from round 2.
  - The full form is used in links.
- **Hashes:** must be < the Stark prime.
- **Callback data:** `^[a-z]{1,8}:[A-Za-z0-9_-]{1,40}$`, at most 64 bytes. Longer values are stored server-side under a short key. Every `callback_query` is answered exactly once.
- **Deep-link payloads:** validated against `^[A-Za-z0-9_-]{1,64}$` and otherwise ignored with a hint.
- **`/export`:** one JSON document in a `<pre>` block, split if needed. Shape: `{"chat_id":-100…,"watches":[{"address","label","min_usd","since_block"}],"alerts":[…],"stakewatches":[…],"feeds":[…],"settings":{…}}`.
- **Logs:** stderr only, e.g. `{"level":"info","msg":"poll","head":812345}`. They never contain the token, the RPC path or query, or message text.

### 4.6 Telegram transport

- **Long polling only, in rounds 1 to 5.**
  - It is outbound only: no port and no TLS.
  - The check owns the update queue.
  - It is how most community members will self-host.
- **`run` startup:** calls `deleteWebhook` (with `drop_pending_updates` false), then loops `getUpdates{offset, timeout: CAIRN_TG_TIMEOUT, allowed_updates: ["message","callback_query","my_chat_member"]}`.
- **Offsets:** an offset is confirmed only after its effects are saved. Rule: "a change is saved before its confirmation is sent".
- **API root override:** `TELEGRAM_API_ROOT` exists so checks can point Cairn at a fake Bot API on loopback. The hostname `api.telegram.org` is never hardcoded in a request.
- **Methods by round:**
  - R1: `getMe`, `deleteWebhook`, `getUpdates`, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `setMyCommands`
  - R4: `getChatMember`, `deleteMessage`
  - Webhook mode is a later round (F52).
- **Sending:**
  - one queue per chat at about 1 message/s;
  - at most 20 messages/min per group;
  - about 25 messages/s overall;
  - on a 429, wait exactly `parameters.retry_after` and resend once;
  - on a 403, mark the chat inactive until it writes again;
  - on a 400 with `migrate_to_chat_id`, move the chat's settings to the new id and resend (R4).
- **Groups:** Cairn works with privacy mode on.
  - It parses `^/(\w+)(@(\w+))?`.
  - It answers `/cmd` and `/cmd@<its username>`.
  - It ignores commands addressed to other bots, and plain text.
- **Library:** no Telegram framework (§4.10).

### 4.7 Starknet access

HTTP JSON-RPC 0.10 at `STARKNET_RPC_URL`. RPC 0.6 to 0.8 are removed in Pathfinder 0.23, and 0.9 is to be deprecated in v0.15 (high).

Blocks average about 1.78 s on mainnet.

- **Block ids:** only `"latest"`, `{"block_number":n}` or `{"block_hash":h}`.
  - **Never `"pending"`:** it was removed in 0.9, and agents trained on older specs will use it.
  - **Never `"pre_confirmed"`.**
  - `latest` means ACCEPTED_ON_L2. Tendermint gives 1-block finality, so it is final in practice (high).
- **No WebSockets.** Event delivery over free WSS endpoints was inconsistent in testing (low), and a fake WebSocket server would add about 80 lines to every check.
- **Batch requests:** allowed, at most 10 calls each. Each HTTP request counts once toward `CAIRN_RPC_RPS`.

| Round | Methods |
|---|---|
| 1 | `starknet_chainId`, `starknet_specVersion`, `starknet_blockNumber`, `starknet_blockHashAndNumber`, `starknet_getBlockWithTxHashes` (gas prices `l1_gas_price`, `l1_data_gas_price`, `l2_gas_price` in FRI), `starknet_call`, `starknet_getClassHashAt` (error 20 means "not deployed"), `starknet_getTransactionStatus`, `starknet_getTransactionReceipt` |
| 2 | `starknet_getEvents`: filter `{from_block, to_block, address, keys, chunk_size}`, following every `continuation_token`. Dedup on `(transaction_hash, event_index)` (`event_index` is new in 0.10) |
| 4 | `starknet_getTransactionByHash` (the trader in feeds); stored block hashes for reorg detection |
| 5 | `starknet_getNonce`, `starknet_estimateFee` (`simulation_flags: ["SKIP_VALIDATE"]`, a v3 invoke with an empty signature; fees in FRI only), `starknet_getTransactionByHash` |
| never | `starknet_add*`, WebSocket subscriptions, any non-configured host (no fallback RPC, no price API) |

**Calls and selectors** (`ARCHITECTURE.md` lists them as constants, so no entry needs keccak in rounds 1 to 3):

- **Transfer events**, selector 0x0099cd8b…6196e9:
  - 3 keys means from and to are in the keys and the value in data;
  - 1 key means from, to, low and high are all in data.
- **`balance_of`** is 0x035a73cd…7af33. The camelCase fallback `balanceOf` is 0x02e4263a…54c76e. Also used: `decimals` and `symbol`.
- **Pragma:** `get_data_median` with calldata `["0x0", shortstring("STRK/USD")]` returns `{price, decimals, last_updated_timestamp, num_sources_aggregated, expiration_timestamp: Option}`. Decimals differ by pair.
- **Starknet ID:** `domain_to_address(domain: Span<felt>, hint: Span<felt>)` and `address_to_domain(address, hint)`, with an empty hint.
  - Each label is encoded in base 38 over `abcdefghijklmnopqrstuvwxyz0123456789-`.
  - A trailing `a` needs the escape rule (moderate).
  - `ARCHITECTURE.md` must copy the algorithm and at least 10 test vectors from starknetid.js 5.0.0 (unverified here).
  - Names are limited to `[a-z0-9-]` labels.
- **Staking (R3):**
  - Selectors from the research: StakerAttestationSuccessful, PoolMemberRewardClaimed, PoolMemberBalanceChanged, PoolMemberExitIntent, CommissionChanged, StakerExitIntent.
  - **`NewPoolMember` and `NewDelegationPool` selectors still need computing and an on-chain check (unverified).**
- **Swaps (R4):**
  - Ekubo `Swapped` (0x0157717768…cd9a870) has 21 data felts. `delta.amount0` and `delta.amount1` are `i129 {mag, sign}`. Positive means paid into the pool (moderate; verify on one real swap).
  - AVNU `Swap` (0x00e316f0…0ccab) has data `[taker, sell_token, sell_amount(lo,hi), buy_token, buy_amount(lo,hi), beneficiary]`.

### 4.8 Signing links (round 5)

**Flow:**

1. Cairn stores an intent.
2. It replies with a summary and a link `${CAIRN_PUBLIC_URL}/i/<id>`. The id is 16 random bytes in base64url, 22 characters.
3. The page fetches the intent, connects the user's wallet and asks it to sign.
4. The page posts back the hash, or in gasless mode the signature.
5. Cairn verifies the transaction and posts the result in the chat.

**Routes:**

| Route | Request | Response |
|---|---|---|
| `GET /i/<id>` | — | The HTML page. Headers: `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` |
| `GET /api/intents/<id>` | — | `{"id","chain_id":"0x534e5f4d41494e","account":"0x…64","calls":[{"contract_address","entry_point","calldata":["0x…"]}],"summary":["Send 10 STRK to alice.stark (0x0123…cdef)"],"fee_estimate":{"amount":"0x…","unit":"FRI"},"gas_tokens":["0x…"],"expires_at":<unix>,"status":"open\|submitted\|accepted\|reverted\|expired"}`. 404 for an unknown id |
| `POST /api/intents/<id>/submitted` | `{"transaction_hash":"0x…"}` | 202 `{"status":"submitted"}`. 400 for a bad hash, 404 for an unknown id, 409 if already submitted, 410 if expired |
| `POST /api/intents/<id>/paymaster/build` | `{"gas_token":"0x…"}` | 200 `{"typed_data":{…},"fee":{…}}`. Cairn calls `paymaster_buildTransaction` |
| `POST /api/intents/<id>/paymaster/execute` | `{"signature":["0x…"]}` | 200 `{"transaction_hash":"0x…"}`. Cairn calls `paymaster_executeTransaction` with **the typed data it stored at build time**, never typed data supplied by the page |

**Verification of a submitted hash:**
- `starknet_getTransactionByHash` must show an INVOKE whose `sender_address` is the intent's account.
- Its calldata must equal the intent's calls in the Cairo 1 multicall encoding: `[n, to₁, selector₁, len₁, …data₁, …]`. Confidence moderate; confirm against starknet.js `CallData.getExecuteCalldata(calls, "1")`.

**Gasless check:** the paymaster's typed data must hold exactly the intent's calls plus one fee transfer in the chosen gas token.
- SNIP-29 shapes: research version 0.1.0-rc0 (moderate). **The exact JSON must be copied from the SNIP before round 5's checks (unverified).**

**Wallet call:** `wallet_addInvokeTransaction` with `{calls:[{contract_address, entry_point, calldata}]}`, or `wallet_signTypedData` in gasless mode.
- The call shape is per Wallet API 0.10.4 (moderate, unverified).
- The page uses wallets injected into `window` (browser extensions, and the in-app browsers of the Ready and Braavos wallets).
- WalletConnect via starknetkit, which needs a `projectId`, is for later.
- Ready and Braavos deep links are unverified.

**Back to Telegram:** after submitting, the page offers `https://t.me/<bot>?start=done_<id>`. `done_` plus 22 characters fits in the 64-character payload limit.

### 4.9 State

- **Recommended:** `node:sqlite` at `$CAIRN_DATA/state.db`. In Node 24.20 it is synchronous and transactional, needs no flag and prints no warning (high).
- **Allowed:** one JSON file, written to a temporary file, fsynced, then renamed.
- **Not allowed:** better-sqlite3 (allowlist).
- **The format is the entry's own; checks never parse it.** Checks assert behaviour instead:
  - state survives a restart and a SIGKILL;
  - modes are 700 and 600;
  - nothing is written outside `CAIRN_DATA`;
  - the token and the RPC URL appear in no file.
- **Stored:** chat ids and types, settings, watches, the update offset, the delivery ledger (with sent message ids, for reorg corrections), the name cache and intents.
- **Purged:** expired intents.

### 4.10 Dependency policy (decide before round 1, because every later round re-runs the allowlist check)

**Recommended default (moderate):**
- Node 24 built-ins only.
- One optional exception: `starknet`, pinned to an exact version of at least 10.8.0. Versions 7 to 9 are end-of-life with advisories, and 10.8.0 fixes the paymaster/SNIP-12 advisories of 28 Sep 2026.
- No Telegram framework and no other runtime dependency.

**How it is enforced:** the round-1 check reads `package.json` and requires `dependencies` ⊆ {`starknet`: exact semver ≥ 10.8.0}. Allowing any exact version at or above 10.8.0 avoids freezing a security-sensitive bot on one version forever.

**Why there is no grammY:**
- Cairn needs about 8 Bot API methods.
- A `fetch` loop with offsets, `retry_after` and an abort is about 60 lines.
- grammY's core does not retry a 429 on `sendMessage`.
- It would add `node-fetch@2`, `debug` and `abort-controller` to a bot that holds secrets.

**Checks have no dependencies:** the vendored kit plus built-ins.

### 4.11 What the checks contain (loopback only, `listen(0)`)

- **`fake-telegram.mjs` (about 150 lines):**
  - Routes `/bot<token>/<method>`. A wrong token returns 401.
  - `getUpdates` honours `offset`, holds for at most 1 s, and returns 409 on a second concurrent poll.
  - Validates HTML and length like Telegram, returning 400 "can't parse entities" or "message is too long".
  - Failure injection: 429 with `retry_after`, 403, a held send, `migrate_to_chat_id`.
  - Readers: `sent`, `next(chat, {ms})`, `calls`.
  - A tested reference version exists in the research scratchpad (`tg/verify/fake-bot-api.mjs`). Copy it out before the session is lost.
- **`fake-starknet.mjs` (about 190 lines plus 60 of helpers):**
  - Named and positional parameters, and batch requests.
  - A chain model with blocks, contracts, transactions and events.
  - `getEvents` returns **at most 5 events per page**, so every entry must page.
  - Spec error codes 20, 21, 24, 29, 31, 33, 34, 40, −32601 and −32602 (−32602 for `"pending"`).
  - Injection of 429, 503, garbage, dropped connections and downtime.
  - Any `starknet_add*` call is logged as a violation.
- **`trap.mjs` (about 35 lines):** loaded through `NODE_OPTIONS=--import`. It logs DNS lookups and `net`/`tls`/`Socket` connects, to prove that only the configured hosts are contacted.
- **Round 5 adds:**
  - `fake-paymaster.mjs`;
  - HTTP calls to Cairn's web port, chosen by the check;
  - optionally, a Chrome DevTools Protocol driver for Chromium (risk R4).
- **Limits:** `check.json` `timeoutSeconds: 300`. Tests run one after another (2 CPUs).

---

## 5. Rounds

Suggested front matter (same settings as Toddler Buddy):

```
---
title: Cairn
payout: top3-60-25-15
pick: creator-in-judging
build_hours: 48
reveal_hours: 12
rank_hours: 12
---
# Pitch
A self-hostable Telegram bot for Starknet: it watches wallets, staking and the network from the chain itself,
and prepares transactions you sign in your own wallet. It never holds a key.
```

| n | Title | What it adds | How it is checked | Prize |
|---|---|---|---|---|
| 1 | Lookups | The frozen interface; `/status`, `/balance`, `/price`, `/tx`; groups; resilience; security baseline | Fake Bot API and fake JSON-RPC on loopback, the host trap, about 31 tests | 7,000,000 |
| 2 | Names and watches | Starknet ID both ways; `/watch` with transfer and approval alerts; `/track`; price alerts; delivery guarantees; `/export`, `/forget` | Paged events in both layouts, restarts and a SIGKILL mid-send, a fake naming contract | 6,000,000 |
| 3 | Staking, STRK and BTC | `/staking`, `/validator`, delegator and operator alerts, reminders, parameters read from the chain | Fake staking, pool and attestation contracts; epochs advanced by adding blocks | 7,000,000 |
| 4 | Groups and the network | Admin gating; Ekubo and AVNU token feed; whales; stall and reorg alerts; group budget; topics; quiet hours; seed guard | Fake swap events, `getChatMember`, a reorg replay, a frozen head, bursts | 6,000,000 |
| 5 | Sign in your wallet | Signing links, `/send`, staking multicalls, simulation, transaction verification, gasless through the paymaster | HTTP calls to the bot's web port, a fake paymaster, `getTransactionByHash`; an in-browser test if the spike works | 8,000,000 |

**Prize total: 34,000,000, under the 35,000,000 cap.** Rounds 1, 3 and 5 are weighted up: round 1 freezes the interface, round 3 is the hardest ABI work, and round 5 is the security-critical one. That leaves 1,000,000 of headroom (decision D16).

### Round 1: Lookups (7,000,000)

**Brief.** Build `node cairn.mjs`, a self-hosted Telegram bot that answers Starknet questions from the chain itself. `ARCHITECTURE.md` is the specification, and the interface in §4.2 to §4.7 is frozen for every later round.

- **Commands and configuration.**
  - `run`, `tick` and `doctor`, with exit codes 0, 1, 2 and 3.
  - Configuration comes only from the environment: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ROOT`, `STARKNET_RPC_URL`, `CAIRN_CHAIN`, `CAIRN_NETWORK`, `CAIRN_DATA`, `CAIRN_EXPLORER_URL`, `CAIRN_POLL_MS`, `CAIRN_TG_TIMEOUT`, `CAIRN_RPC_RPS`, `CAIRN_RPC_TIMEOUT_MS`, `CAIRN_PRICE_MAX_AGE`, `CAIRN_LOG`.
  - A bad value exits 2 before any network call.
- **`/status`:** chain, head block, its time, the L1, L1-data and L2 gas prices in FRI, and the node's spec version.
- **`/balance <address>`:**
  - every registry token, read with `balance_of`;
  - exact u256 amounts;
  - USD values from Pragma `get_data_median`, using each pair's own `decimals`;
  - "not deployed" when `starknet_getClassHashAt` returns error 20.
- **`/price [SYMBOL…]`:**
  - price, age in chain time and the number of sources;
  - marked "stale" past `CAIRN_PRICE_MAX_AGE`;
  - a Refresh button that edits the message in place.
- **`/tx <hash>`:** finality, execution status, fee in STRK, block, the revert reason (escaped) and an explorer link.
- **`/start` and `/help`.** A bare address or hash sent in a private chat is looked up as a transaction first, then as an address. In groups, Cairn answers only `/cmd` and `/cmd@<bot>`.
- **Starter files:** `networks/SN_MAIN.json` and `networks/SN_SEPOLIA.json` (§4.4), `.env.example` with placeholders, and a README.
- **Ground rules:**
  - read-only JSON-RPC 0.10;
  - no other host;
  - state only in `CAIRN_DATA`;
  - Node 24 built-ins plus an optional exact `starknet`.

The checks are in `.launchpad/checks/round-1/`. Run them with `node .launchpad/checks/round-1/run.mjs`.

**Criteria:**
- **Usefulness and clarity (counts double):** the answer comes first; replies read well on a phone and in a busy group; amounts, prices and statuses are unambiguous.
- **Robustness:** every bad input, slow node or Telegram error ends in a helpful reply or a clear exit, never a crash.
- **Security posture:** secrets go only where they must, logs are clean, and input is validated before it reaches the node.
- **Code quality:** small, readable, and ready for round 2's watches.

**Key checks (test names):**

*Command line and configuration*
1. a bad command line exits 2 with a reason on stderr and nothing on stdout
2. a missing or malformed token, API root, RPC URL or chain exits 2 and contacts nothing
3. a bad network file exits 2 naming the bad entry's path
4. a node on another chain than CAIRN_CHAIN exits 2 naming both chains
5. doctor prints the bot's username, the chain, the head block and the spec version as one JSON line
6. a token Telegram rejects exits 3, and the token appears nowhere in the output

*Telegram loop*

7. tick answers every pending update in order per chat, prints its summary, and never answers an update twice across ticks and restarts
8. registers its commands with setMyCommands
9. in groups it answers only commands addressed to it, and ignores plain text and other bots' commands
10. /start, /help and an unknown command get valid HTML replies of at most 4096 characters

*Lookups*

11. /status shows the chain, head block, block time and the three gas prices read from the node
12. /balance prints exact amounts for every registry token, including a u256 above 2^128 and a single wei
13. /balance shows USD values computed with each pair's own decimals, and none from a stale price
14. /balance of an undeployed address still shows its balances and says it is not deployed
15. an invalid address or hash is explained and makes no RPC call
16. /price shows each price with its age and source count, and Refresh edits the message and answers the callback once
17. /tx shows finality, execution status, fee in STRK, block and an explorer link built from CAIRN_EXPLORER_URL
18. /tx of a reverted transaction shows its revert reason HTML-escaped, and an unknown hash says it was not found
19. a pasted hash or address in a private chat is looked up as a transaction, else as an address
20. addresses and hashes are accepted in any case, with or without leading zeros, and shown normalised
21. never uses the pending or pre_confirmed block tags

*Robustness*

22. an RPC 429, 5xx or timeout is retried with backoff and ends in a "node busy" reply, never a crash
23. never sends more RPC requests per second than CAIRN_RPC_RPS
24. a Telegram 429 is retried after retry_after and the message is delivered exactly once
25. a chat that blocked the bot is skipped and other chats still get their answers
26. run answers within 3 s, survives a node that is down for 2 s, and exits 0 within 3 s of SIGTERM during a long poll

*Security*

27. never calls a Starknet write method
28. the bot token and the RPC URL's secret appear in no output, log, message, data file or request to the other host
29. contacts only TELEGRAM_API_ROOT and STARKNET_RPC_URL
30. writes only inside CAIRN_DATA, a directory of mode 700 with files of mode 600
31. the repository holds no Telegram token, private key or seed phrase, and runtime dependencies are only those allowed

**How to run it.** Run `TELEGRAM_BOT_TOKEN=… STARKNET_RPC_URL=https://starknet-sepolia-rpc.publicnode.com CAIRN_CHAIN=SN_SEPOLIA node cairn.mjs doctor && node cairn.mjs run` with a BotFather test bot.
- C1: in a DM and in a group, try `/start`, `/status`, `/balance` on a busy and on an empty address, `/price STRK ETH`, and `/tx` on a success and on a revert.
- C2: send a bad address and a bad hash, set a wrong RPC URL, then kill and restart the bot.
- C3: follow the token and the RPC URL through the code, then grep the logs and `CAIRN_DATA`.
- C4: read the code and imagine adding `/watch`.

### Round 2: Names and watches (6,000,000)

**Brief.** Cairn learns names and starts watching. Round 1's commands, formats and checks stay as they are.

- **Starknet ID.** With `contracts.starknet_id` set:
  - a `name.stark` (labels `[a-z0-9-]`, subdomains allowed) is accepted wherever an address is, resolved with `domain_to_address`;
  - addresses in replies and alerts show their name from `address_to_domain`, **but only if the name's forward lookup returns the same address**;
  - lookups are cached for `CAIRN_NAME_TTL` blocks.
  - Without the contract, names are off and round-1 replies are unchanged.
- **Watches.**
  - Commands: `/watch <address|name> [label] [min=<usd>]`, `/unwatch <address|name|label>`, `/watches`.
  - At most 20 watches per chat.
  - Each poll reads registry `Transfer` events with `starknet_getEvents`:
    - both layouts are parsed (from and to in the keys when there are 3 keys, in data when there is 1);
    - every continuation page is followed;
    - at most `CAIRN_MAX_BLOCKS` blocks per poll.
  - An alert shows the direction, the exact amount, the USD value, the counterparty (name or short address), the time and an explorer link.
  - Nothing is alerted for blocks before the watch was added.
  - Each (transaction hash, event index) is alerted once per chat. An alert is never lost: one interrupted by a kill mid-send is sent again after the restart.
  - After a gap of more than `CAIRN_MAX_GAP` blocks, Cairn skips ahead and sends one notice per chat.
  - Should: an `Approval` by a watched address for an amount ≥ 2^128 is flagged as unlimited. The layout is unverified.
- **Also:**
  - `/track <hash>`: one message on L2 acceptance or on a revert, with its reason.
  - `/alert <SYMBOL> above|below <usd>`: fires once per crossing and re-arms when the price crosses back.
  - `/export` and `/forget`.
  - A per-user limit of 20 commands a minute, by `message.date`.
  - `tick` gains `"alerts":<n>`.

**Criteria:**
- **Alert quality (counts double):** who, what, how much and its USD value, with a link, readable in two seconds, no noise.
- **Reliability:** no lost or doubled alerts across kills, restarts and node trouble.
- **Privacy and data rights:** minimal storage; `/export` and `/forget` are complete.
- **Code quality:** round 1 reused, not copied.

**Key checks:**
1. a .stark name is accepted wherever an address is, and an unknown name is explained
2. a reverse name is shown only when its forward lookup returns the same address
3. with no starknet_id contract, names are off and round 1's replies are unchanged
4. /watch, /unwatch and /watches add, remove and list watches with labels, and a 21st watch is refused
5. an incoming and an outgoing transfer each produce one alert with the exact amount, USD value, counterparty and link, for both event layouts
6. transfers below the watch's minimum USD value produce no alert
7. events in blocks before the watch was added produce no alert
8. reads every page of events
9. an alert is never sent twice across ticks and restarts, and one interrupted by a SIGKILL mid-send is sent after restart
10. after more than CAIRN_MAX_GAP missed blocks it skips ahead with one notice per chat
11. /track posts once on acceptance and once on a revert with its reason
12. a price alert fires once per crossing
13. /export returns the chat's data as JSON, and after /forget it is empty
14. more than 20 commands in a minute get one slow-down notice

**How to run it.** On Sepolia, `/watch` your own address and move test STRK between two wallets.
- C1: read ten alerts in a group on a phone.
- C2: kill the bot mid-alert, restart it, and stop it for 10 minutes.
- C3: run `/export`, `/forget`, then inspect `CAIRN_DATA`.
- C4: imagine adding staking alerts.

### Round 3: Staking, STRK and BTC (7,000,000)

**Brief.** Cairn becomes the staking companion Starknet lacks. This round needs `contracts.staking` and `contracts.attestation` in the network file. `ARCHITECTURE.md` pins the **deployed** ABI subset, which is not the `main`-branch spec: there is no `index` field and there are no v3 entrypoints (high).

- **`/staking <address|name> [validator…]`:** every delegation of the address, STRK and BTC pools alike. For each: validator (name), token, amount, unclaimed rewards, commission, the pending exit amount with its unlock time, and USD values.
  - **Finding pools:** from the given validators' `staker_pool_info`, and from `NewPoolMember` events (keys `[sel, member, staker]`) read from `staking_from_block`.
  - **Reading members:** with `get_pool_member_info_v1` (an Option), never `pool_member_info_v1`, which panics.
  - **BTC tokens:** come from `get_active_tokens`.
  - **Reward token:** unclaimed rewards are shown in STRK (unverified for BTC pools).
- **`/validator <staker|name>`:** own and delegated stake per token, commission, whether it attested this epoch, its last attested epoch, its operational address and that address's STRK balance, and any unstake intent.
- **`/stakewatch <address|name> [min=<STRK>]`.** For each validator the address delegates to:
  - one alert when an epoch ends without that validator's attestation, naming the epoch;
  - one alert on a commission change;
  - one alert on an exit intent.
  - One reminder when unclaimed rewards pass `min`, repeated at most every 24 epochs.
  - One "withdraw ready" message when an exit's unlock time passes in chain time.
- **`/validatorwatch <staker|name> [low=<STRK>]`:**
  - an alert once the current epoch's attestation window closes without an attestation (target block + window < head);
  - an alert when the operational balance falls below `low` (default 10 STRK).
- **Parameters come from the contracts:** epoch length and start, the attestation window, the exit wait and the active tokens are read with `get_epoch_info`, `attestation_window`, `contract_parameters_v1` and `get_active_tokens`, never hardcoded.
- **Validators** are listed alphabetically. No ranking, no advice.

**Criteria:**
- **Staker value (counts double):** a delegator learns what to do (claim, switch or withdraw) and when; BTC and STRK pools are equally clear.
- **Correctness on a real network:** the card matches an explorer or staking dashboard on Sepolia or mainnet.
- **Neutrality:** facts only, no validator ranking or nudging.
- **Code quality.**

**Key checks:**
1. /staking lists every STRK and BTC delegation with amount, unclaimed rewards, commission and pending exit
2. pools are found from NewPoolMember events and from named validators, without double counting
3. a non-member pool is read through the Option getter, never the panicking one
4. epoch length, attestation window and exit wait are read from the contracts, and alerts follow them when they change
5. an epoch with no attestation by a watched validator produces one alert per watching chat, naming the epoch
6. a commission change and an exit intent each produce one alert
7. unclaimed rewards above the threshold produce one reminder, not repeated within 24 epochs
8. "withdraw ready" is sent once, when the unlock time passes in chain time, and never before
9. /validator shows own and delegated stake per token, commission, this epoch's status and the last attested epoch
10. an operator watch alerts once when the attestation window closes without an attestation, before the epoch ends
11. a low operational balance produces one alert
12. without staking contracts, the staking commands say so and earlier replies are unchanged

**How to run it.** On mainnet, run `/staking` for a known delegator and `/validator` for a known validator.
- C1: read the staking card and its reminders as a delegator.
- C2: compare the numbers with an explorer.
- C3: look for any wording that ranks or recommends a validator.
- C4: imagine adding a Claim button.

### Round 4: Groups and the network (6,000,000)

**Brief.** Cairn joins community groups. Group settings change only for chat admins, checked with `getChatMember` (`creator` or `administrator`).

- **`/feed <SYMBOL|token address> [min=<usd>]`:** buys and sells of the token on Ekubo Core (`Swapped`) and on AVNU (`Swap`).
  - **One post per transaction,** even when both emit events. AVNU's event wins, and its `taker` is the trader. Otherwise the trader is the transaction's sender.
  - **A post shows:** the side (a buy means the token leaves the pool), the amounts, the USD value, the trader's name and an explorer link.
  - Ekubo's `i129` values are a magnitude and a sign felt.
- **`/whales <SYMBOL> <amount>`:** transfers of the token at or above the amount.
- **`/netwatch`:**
  - **Stall:** one alert when no new block has arrived for `CAIRN_STALL_SECONDS` (wall clock), and one recovery notice with the gap's length.
  - **Reorg:** detected when a stored block hash no longer matches. Cairn sends one notice with the depth, a correction in reply to each alert that came from a dropped block, and alerts the replacement events once.
- **Group budget:** at most 20 messages a minute per group, Telegram's limit. The rest are merged into one summary.
- **Topics and migration:** posts go to the forum topic where the command was sent (`message_thread_id`). A group that migrates to a supergroup keeps its settings.
- **Quiet hours:** `/quiet HH:MM-HH:MM [±HH:MM]` holds alerts and sends one summary when the window ends, in chain time.
- **Seed-phrase guard:** a message made of 12, 15, 18, 21 or 24 BIP-39 English words is deleted (`deleteMessage`) and answered with a warning that does not repeat it.

**Criteria:**
- **Group fit (counts double):** feeds and alerts are welcome in a busy group: compact, never a flood, simple for admins to control.
- **Network-alert usefulness:** stall, recovery and reorg messages are timely and actionable.
- **Safety:** admin gating, the seed guard, and no hype mechanics.
- **Code quality.**

**Key checks:**
1. group settings from a non-admin are refused after a getChatMember check, and from an admin accepted
2. a swap emitted by both Ekubo and AVNU produces one post with side, amounts, USD value and trader
3. Ekubo buys and sells decode correctly from the i129 signs
4. swaps below the feed's minimum are not posted
5. a burst of 50 swaps never makes more than 20 messages a minute in one group, and the rest arrive as a summary
6. a whale watch posts transfers at or above its threshold only
7. a head that stops advancing produces one stall alert and one recovery notice
8. a reorg is detected by block hash, alerts from dropped blocks are corrected, and replacement events are alerted once
9. a feed set up in a forum topic posts into that topic
10. after a migration to a supergroup, settings move to the new chat id
11. alerts during quiet hours are held and sent as one summary when the window ends
12. a message holding a seed phrase is deleted and answered with a warning that does not repeat it

**How to run it.** Add the bot to a test group as an admin, run `/feed STRK min=1000` and `/netwatch`, then `/feed` again as a non-admin.
- C1: read an hour of feed in the group.
- C2: read the network alerts against a replayed outage (the checks' fixture).
- C3: post a fake seed phrase, and try the settings as a non-admin.
- C4: read the code.

### Round 5: Sign in your wallet (8,000,000)

**Brief.** Cairn prepares transactions, and the user signs them in their own wallet on a web page Cairn serves.

- **Off by default:** everything here needs `CAIRN_ACTIONS=on`.
- **Cairn never holds a key, never signs, and never calls `starknet_add*`.**
- **`/wallet <address|name>`** stores the chat's account, as a public address only. Anything shaped like a seed phrase is refused.
- **Actions:**
  - `/send <amount> <SYMBOL> <address|name>`: `transfer`.
  - On the staking card:
    - **Claim:** `claim_rewards`.
    - **Claim and restake:** `claim_rewards` + `approve` + `add_to_delegation_pool` in one multicall, offered when the reward address is the member.
    - **Delegate:** `/delegate <amount> <SYMBOL> <validator>`, i.e. `approve` + `enter_delegation_pool`, or `add_to_delegation_pool` for an existing member.
    - **Exit and Withdraw:** should.
  - The selectors are listed in `ARCHITECTURE.md`. They are still to be computed (unverified).
- **Simulation:** each action is simulated with `starknet_estimateFee` (`SKIP_VALIDATE`, a v3 invoke, an empty signature, the nonce from `getNonce`).
  - A revert gets its reason and no link.
  - Otherwise the reply holds the summary, the fee estimate and one link `${CAIRN_PUBLIC_URL}/i/<id>`. The link is single-use and expires after `CAIRN_INTENT_TTL` seconds of chain time.
- **Web API** as in §4.8.
- **Verification:** a submitted hash counts only if the sender is the intent's account and the calldata is exactly the intent's calls. Cairn then tracks the transaction and posts the result.
- **Gasless,** with `CAIRN_PAYMASTER_URL` set:
  - Cairn sends the intent's calls to the paymaster;
  - it checks that the typed data holds exactly those calls plus one fee transfer;
  - it relays that stored typed data with the user's signature, once.
- **The page:**
  - loads no third-party code;
  - checks the wallet's chain and account against the intent;
  - shows each call in words and in raw form;
  - then calls `wallet_addInvokeTransaction` or `wallet_signTypedData`.

**Criteria:**
- **Non-custodial safety (counts double):** the user always sees and signs exactly what Cairn prepared; nothing can be swapped in; every failure is safe.
- **Signing ease:** desktop extensions and wallet in-app browsers, gasless in USDC, and a clean return to Telegram.
- **Starknet showcase:** multicall and paymaster are used where they help the user, and explained in plain words.
- **Code quality.**

**Key checks:**
1. actions are refused unless CAIRN_ACTIONS is on, and no web port is opened without CAIRN_WEB_PORT
2. /wallet stores only a public address or name, and refuses a seed phrase without repeating it
3. /send replies with a summary and one link holding only an opaque id, and the intent JSON holds exactly the transfer call
4. claim, claim-and-restake and delegate build exactly the calls in ARCHITECTURE.md as one multicall
5. an action the simulation says will revert gets the reason and no link
6. an intent expires after CAIRN_INTENT_TTL seconds of chain time and accepts one submission
7. a submitted hash whose sender or calls differ from the intent is refused, and a matching one is tracked and its result posted
8. the gasless flow sends the intent's calls, refuses typed data with an extra call, and relays only its stored typed data, once
9. the page and API send no-store, no-referrer and a CSP that allows no other origin
10. the paymaster API key appears in no output, page, message or file
11. (conditional on decision R4) in headless Chromium with a test wallet, the page requests exactly the intent's calls on the intent's chain and posts back the returned hash

**How to run it.** On Sepolia, with `CAIRN_ACTIONS=on CAIRN_WEB_PORT=8080 CAIRN_PUBLIC_URL=http://127.0.0.1:8080`:
- C1: try to make the page sign anything other than what the chat shows, on the wrong chain and from the wrong account.
- C2: run `/send` and `/delegate` with Braavos and Ready, once paying gas in USDC.
- C3: read the summaries and the page as a newcomer.
- C4: read how intents, verification and relaying share one path.

---

## 6. Risks and open decisions

| # | Risk or decision | Why it matters | Recommended default | Confidence |
|---|---|---|---|---|
| R1 | **Can the entry reach the check's loopback fakes inside the real gate?** | Every check depends on it. The research flagged the case where entry and check run as different users as unknown | Run a 20-line spike through `runner/gate.mjs` before writing any round-1 check | unknown |
| R2 | **Dependency policy** | The allowlist check is re-run forever | Built-ins, plus optional `starknet` at an exact version ≥ 10.8.0; no Telegram framework | moderate |
| R3 | **Session keys (the brief's angle asks for them)** | A session key held by the bot is limited signing authority, which is custody-adjacent and contradicts principle 1. There is no standard yet: the SNIP draft of 17 Feb 2026 is pre-audit, and Ready, Braavos, Cartridge and Chipi formats are mutually incompatible | **Out** of rounds 1 to 5. Show account abstraction through multicall, the paymaster and, later, `is_valid_signature` (F49). Revisit as a separate opt-in round once the SNIP is final and two wallets ship it | high (risk), moderate (timing) |
| R4 | **In-browser check of the signing page** | The wallet call is the most security-critical line, and only a browser can exercise it | Drive the image's Chromium over the DevTools Protocol using Node's built-in `WebSocket`, with a fake `window.starknet_*` injected. Spike it first (Chromium path and `--network none` behaviour unverified). If the spike fails, judge it in the rubric | low to moderate |
| R5 | **Mainnet actions** | A bug in round 5 can cost user funds even without custody (for example, a wrong recipient in the intent) | `CAIRN_ACTIONS` off by default. The official instance enables actions on Sepolia first, and on mainnet only after an independent review of round 5's winner | moderate |
| R6 | **Unverified chain facts used in checks** | The fakes follow `ARCHITECTURE.md`. A wrong fact gives a bot that passes the checks and fails on mainnet | Before each round, verify on-chain and record in `ARCHITECTURE.md`: the Sepolia naming address (60 hex digits); Starknet ID test vectors; the `NewPoolMember` and `NewDelegationPool` selectors; `staking_from_block`; the Approval layout; the strkBTC layout; the USDT and BTC Pragma pairs; the reward token of BTC pools; Ekubo delta signs; SNIP-29 JSON; the Wallet API call shape; intent selectors; the multicall encoding. Checks assert real addresses for STRK and ETH only. Judges run a real-network smoke test | high (that verification is needed) |
| R7 | **Staking v3 or v0.15 upgrade during the project** | The September 2026 target has slipped with no new date, and the upgrade may change the ABI | Pin the deployed v2 subset. When an entrypoint is missing or a call errors, the card says the staking contract changed and Cairn needs an update. v3 goes in a later round | moderate |
| R8 | **Telegram policy change** | The TON-only rule could be extended to plain bots or to outbound links | No Mini App, no in-bot payments, no copy promoting wallets. Watch the Bot Developer Terms (§7) and the Blockchain Guidelines | moderate |
| R9 | **Hosting** | Hotpod runs on Vercel. Long polling needs an always-on process and sqlite needs a disk | Self-host first, with Docker and systemd documentation judged in the rubric. Run the official instance on a small VM. Webhook mode later (F52) | moderate |
| R10 | **RPC capacity** | Public endpoints publish no limits. Blast and Lava are gone, and dRPC's free tier lacks Starknet. STRK alone has about 942 Ekubo swaps per 500 blocks | No default RPC. The README lists publicnode, Cartridge, ZAN and paid providers. `CAIRN_RPC_RPS=5`. Feeds need a minimum-USD floor (default $100) | moderate |
| R11 | **Scam clones** | Fake "trading bot" repositories with malware are common, and Starknet phishing domains already exist | Publish the official handle and repository on the Hotpod project page; signed release tags. The bot never asks for keys (guard plus `/start` copy). The README carries a warning | high |
| R12 | **Privacy** | The operator learns which chat watches which address. Telegram may give IPs and phone numbers to authorities on valid orders | Data minimisation, `/export`, `/forget`, no analytics. `/start` says what is stored. Recommend self-hosting for sensitive addresses | high |
| R13 | **Financial-advice exposure** | Validator data and feeds can read as recommendations | Facts only; validators alphabetical; one line of disclaimer in `/help` | moderate |
| R14 | **Feeds as hype tools** | Market-manipulation risk and spam | No paid trending, no volume bots, no leaderboards before a later round. Feeds only at an admin's request; burst summaries | moderate |
| R15 | **Round 1 size** | About 31 tests and an 800 to 1,000-line `run.mjs`, against Toddler Buddy's 19 tests and 584 lines | If the private reference implementation takes more than about 6 hours, move paste lookup (F08) and the Refresh button to round 2 | moderate |
| R16 | **Prize split** | Must fit the 35M cap | 7 / 6 / 7 / 6 / 8 = 34M, keeping 1M for a re-run or a bonus round | high (arithmetic) |
| R17 | **Name** | Trademark or handle conflicts | Cairn. Run trademark and @handle searches before launch; fallbacks Waypost, Stoa | unknown |
| R18 | **BIP-39 wordlist in a public repository** | Licence not checked | Verify the licence in bitcoin/bips. If it is unclear, fetch the list at build time from a pinned npm package allowed only for checks, or detect by word count only | unknown |
| R19 | **Pilot audience** | A flagship project needs real users early | Install in Hotpod's own Starknet community group after round 2, then offer it to the StarkWare Trading Guild and two validator operators after round 3 | moderate |
| R20 | **STRK20 shielded activity** | Watches will not see shielded transfers, by design | Replies say "public balance" and alerts say "public transfers"; viewing keys stay out (F59) | moderate |