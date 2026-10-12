# Starknet Telegram bot as a Hotpod project: design note for checks and interface

Working name **Starkbot**. The `STARKBOT_` prefix and the `bot.mjs` file name are placeholders; rename them before round 1 is committed. Everything here is checked against the pinned runner image unless marked as a judgement.

## 0. Facts I checked in the pinned image

All of these ran locally in `mcr.microsoft.com/playwright@sha256:eff16c30…` (the `v1.63.0-noble` digest in `runner/runner.json`) with `--network none`, read-only, user 1000.

| Item | Result | Confidence |
|---|---|---|
| Node version | **v24.20.0** (npm 11.19.0, Python 3.12.3, no gcc/make) | high |
| `node:sqlite` | `DatabaseSync` works with no flag and **no warning on stderr** | high |
| `better-sqlite3@13.0.3` with scripts off | **Works**: version 13 ships prebuilds in the tarball (linux-x64/arm64, musl, darwin, win). I ran the arm64 one; the linux-x64 file is present but not run. It adds 27 MB. | moderate (arch of the real runner unknown) |
| `grammy@1.46.0` + `starknet@10.8.0` | `npm ci` with the gate's install environment: 75 packages, ~76 MB (103 MB with better-sqlite3). Both ran offline against loopback fakes; the probe took 0.28 s in total. | high |
| What grammY sends on start | `getMe`, then `deleteWebhook`, then `getUpdates`, then `sendMessage`. The fake must answer the first two. Bodies are JSON. | high |
| What starknet.js 10.8 sends | Named params, e.g. `starknet_call {"request":{contract_address,entry_point_selector,calldata},"block_id":"latest"}` and `starknet_getEvents {"filter":{from_block,to_block,address,keys,chunk_size}}`. It sent no `starknet_specVersion` probe for these calls. | high |
| Keccak in `node:crypto` | **Not available**. It has `sha3-256`, which is a different hash and gives wrong selectors. A zero-dependency bot needs selector constants or a hand-written keccak. | high |
| Selectors (from starknet.js) | `Transfer` = `0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9`, `balance_of` = `0x35a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33`, `balanceOf` = `0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e`, `decimals` = `0x4c4fb1ab068f6039d5780c68dd0fa2f8742cceb3426d19667778ca7f3518a9`, `symbol` = `0x216b05c387bab9ac31918a3e61672f4618601f3c598a2f3f2710f37053e1ea4` | high |
| Unknown hosts offline | `fetch` fails fast: `EAI_AGAIN` for host names, `ENETUNREACH` for IPs, about 100 ms. A hard-coded fallback RPC does not hang a check. | high |
| `NODE_OPTIONS=--import=<trap.mjs>` | Loads into the entry and records DNS lookups. My hook on `Socket.prototype.connect` missed IP-literal connects, so `net.connect`/`tls.connect` also need hooking. | high (DNS part) |
| Install path | Only the entry's `package.json` and lockfile are installed; `node_modules` is mounted read-only at `/work/node_modules`. Check tools come from the base's lockfile. | high (read in `runner/gate.mjs`) |

## 1. Interface contract (round 1, frozen for all later rounds)

**Commands**
```
node bot.mjs run      # long-running: long-poll Telegram + poll the chain until SIGTERM/SIGINT, then exit 0 within 3 s
node bot.mjs tick     # one pass: drain pending updates (getUpdates timeout=0 until empty), one chain poll,
                      # save state, confirm the offset, print ONE JSON line, exit
node bot.mjs doctor   # getMe + starknet_chainId + starknet_blockNumber, print ONE JSON line, exit
```
- `tick` prints `{"updates":<n>,"replies":<n>,"head":<block>}`.
- `doctor` prints `{"bot":"<username>","chain_id":"SN_MAIN","block":<n>}`.
- Exit codes: 0 ok; 1 Telegram or the node could not be reached (reason on stderr, state left consistent); 2 bad command line or configuration, including a chain-id mismatch (reason on stderr, nothing on stdout, **no network call** for bad env); 3 Telegram rejected the token (401). Use 3 so a supervisor does not restart-loop.
- `tick` is the main testability lever. It needs no timers, and "the process exited" means "all work is done", so "no message was sent" can be asserted exactly. `run` must be the same loop with sleeps and a long poll; about 4 checks exercise it so the two paths cannot drift.

**Environment.** Secrets come only from the environment, never from flags (flags show in `ps`).

| Var | Default | Meaning |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | required | Must match `^\d+:[A-Za-z0-9_-]{30,}$`, else exit 2 |
| `TELEGRAM_API_ROOT` | `https://api.telegram.org` | Bot calls `${root}/bot${token}/${method}`. http/https URL with no path, else exit 2 |
| `STARKNET_RPC_URL` | required (no public default) | JSON-RPC endpoint. Treated as a **secret** because provider URLs embed API keys |
| `STARKBOT_CHAIN` | `SN_MAIN` | `SN_MAIN` or `SN_SEPOLIA`. A node whose `starknet_chainId` decodes to anything else means exit 2 |
| `STARKBOT_DATA` | `./data` | State directory. Created if missing with mode 700, files 600. Nothing is written anywhere else. Checks always pass a fresh non-existent path under `workspace().scratch`, so the bot (user 1000) creates it. |
| `STARKBOT_TOKENS` | `tokens/<chain>.json` | Token registry `[{"symbol","address","decimals"}]`. A bad entry means exit 2 naming its index |
| `STARKBOT_EXPLORER_URL` | `https://voyager.online` | Used only to build links (`/tx/<hash>`, `/contract/<addr>`), never fetched |
| `STARKBOT_POLL_MS` | `10000` | Chain poll interval in `run`. Minimum 50; checks use 100 |
| `STARKBOT_TG_TIMEOUT` | `30` | `getUpdates` long-poll seconds in `run`. Checks use 1 |
| `STARKBOT_RPC_RPS` | `5` | Most RPC requests in any 1-second window |
| `STARKBOT_RPC_TIMEOUT_MS` | `10000` | Per-request timeout. Checks use 1500 |
| `STARKBOT_LOG` | `info` | Logs go to **stderr** only, one JSON line per event; stdout is reserved for `tick`/`doctor` |

Added in later rounds (nothing in round 1 may depend on them):
- `STARKBOT_MAX_BLOCKS` (catch-up bound per poll, round 2)
- `STARKBOT_CONFIRMATIONS` (round 5)
- `STARKBOT_WEBHOOK_PORT`, `STARKBOT_WEBHOOK_SECRET`, `STARKBOT_WEBHOOK_URL` (round 5)
- `STARKNET_RPC_URLS` (failover, round 5)

**Clock: there is no clock variable.** User-visible time comes from the chain: "now" is the timestamp of the latest block read, and user rate limits use `message.date`. `Date.now()` is allowed only for backoff, timeouts and log lines. Checks control time by adding blocks. This fixes the timer problems Toddler Buddy round 4 had to solve with event times, and makes daily digests and mute hours (round 3) deterministic.

**Long polling, not webhooks**, for rounds 1 to 4:
- It is outbound only: no port, no TLS, no race on a free port.
- The check owns the update queue.
- It is how most community members will self-host.

A webhook mode is a round-5 option. It is testable (the check POSTs updates to the bot's port with `X-Telegram-Bot-Api-Secret-Token`, and the fake records `setWebhook`), but it adds port handling and replies sent in the webhook response, which the fake must also parse.

**Chain access is HTTP JSON-RPC polling only.** Starknet RPC has WebSocket subscriptions, but a fake WebSocket server needs about 80 lines of framing code, and many free endpoints do not offer it. Leave it out.

**Starknet RPC subset** (target spec 0.9/0.10; I know these methods' shapes are stable since 0.8 with moderate confidence):
- `starknet_chainId`, `starknet_blockNumber`, `starknet_blockHashAndNumber`, `starknet_getBlockWithTxHashes`
- `starknet_call`, `starknet_getClassHashAt`
- `starknet_getTransactionStatus`, `starknet_getTransactionReceipt`
- `starknet_getEvents` (round 2)

Block ids may only be `"latest"`, `{"block_number":n}` or `{"block_hash":h}`. **Never `"pending"`**: it was removed in 0.9 and agents trained on older specs will use it. The fake rejects it, and that is a check.

## 2. Fakes inside `run.mjs` (loopback, `listen(0)`, so no port race)

**Fake Telegram Bot API** (`fakeTelegram(token)`)
- Routes `POST|GET /bot<token>/<method>`. A wrong token gets `401 {"ok":false,"error_code":401,"description":"Unauthorized"}`.
- Bodies are parsed as JSON, `x-www-form-urlencoded` or query string. Multipart is not needed.
- `getMe` returns `{id:42,is_bot:true,username:"fake_bot"}`. `deleteWebhook`, `setMyCommands` and `answerCallbackQuery` return `true`, and all are recorded.
- `getUpdates` honours `offset` (it drops ids below it; this is the confirmation), `limit` and `timeout`:
  - It holds the request until an update is queued (a waiter list, not a sleep loop) or `min(timeout, 1 s)` passes. The 1 s cap keeps SIGTERM tests fast.
  - It returns 409 if a webhook is set (round 5).
- `sendMessage`, `editMessageText` and `deleteMessage` record `{chat_id, text, parse_mode, reply_markup, at}` and return a `Message`. The fake **validates like Telegram**:
  - With `parse_mode:"HTML"`, only tags b/strong/i/em/u/ins/s/strike/del/a[href]/code/pre/blockquote/tg-spoiler/span.tg-spoiler, balanced, and only `&lt; &gt; &amp; &quot; &#N;` entities. Otherwise it returns `400 "Bad Request: can't parse entities"`.
  - Text after entity parsing must be 1 to 4096 UTF-16 units, else 400 `message is too long` / `message text is empty`.
- **Builders**:
  - `tg.text(chat, text, {type:"private"|"group"|"supergroup", from, title})` adds the `bot_command` entities.
  - `tg.blocked(chat)` sends a `my_chat_member` update with status `kicked`.
- **Failure injection**:
  - `tg.fail("sendMessage", {code:429, retry_after:1}, times)` returns `{"parameters":{"retry_after":1}}`.
  - `{code:403, description:"Forbidden: bot was blocked by the user"}`.
  - `tg.hold("sendMessage")` never answers, for the "killed mid-send" tests in round 2.
- **Readers**:
  - `tg.sent` is the full log.
  - `await tg.next(chat, {ms:5000})` returns the next message to that chat or throws on timeout.
  - `tg.to(chat)` returns all messages to that chat.
  - `tg.calls` holds every method with its parameters, for checks on secrets and offsets.
- **Size**: about 30 lines minimal (my working probe), **about 140 to 170 lines** with the HTML validator (about 30) and failure injection.

**Fake Starknet JSON-RPC** (`fakeNode(chain)`)
- One `POST` route at any path, so the check can put a secret marker in the path: `http://127.0.0.1:<p>/v0_9/SECRET-RPC-KEY-7f3a`.
- It accepts single and **batch** requests, and **named or positional** params (hand-written fetch code often uses arrays).
- **Chain model**:
  - `chain.block(n, {timestamp, gas})`, plus `chain.head`.
  - `chain.contract(addr, {class_hash, calls:{[selector]: (calldata) => felts}})`.
  - `chain.tx(hash, {finality, execution, fee:{amount,unit:"FRI"}, block, revert_reason, events})`.
  - `chain.event(block, {from_address, keys, data, tx})`.
- `starknet_getEvents` filters by range, address and key positions (OR within a position, empty = wildcard). It returns **at most 5 per page plus a `continuation_token`** whatever `chunk_size` asks, which forces every entry to page.
- **Errors in spec form** (moderate confidence on the numbers):
  - 20 `Contract not found`, 21 `Requested entrypoint does not exist in the contract`, 24 `Block not found`
  - 29 `Transaction hash not found`, 31 `Page size is too big`, 33 `The supplied continuation token is invalid or unknown`
  - 34 `Too many keys provided in a filter`, 40 `Contract error` (with `data.revert_error`)
  - `-32601` for unknown methods, `-32602` for bad params (including `"pending"`).
- **Injection**:
  - `node.fail(method|"*", {http:429, retryAfter:1} | {http:503} | {code:24} | "garbage" | "drop", times)`
  - `node.delay(ms)`
  - `node.down(ms)` refuses connections by closing and re-listening on the same port.
- **Readers**: `node.log` holds `{method, params, t}` for every request. Every `starknet_add*` method is recorded as a **violation**.
- **Size**: about 25 lines minimal, **about 160 to 200 lines** with paging, errors and injection, plus about 60 lines of helpers (u256 split, short-string encoding, address padding).

**Also in the check**
- `trap.mjs` (about 35 lines, its own file in the check folder), passed as `NODE_OPTIONS=--import=<abs path>`. It hooks `dns.lookup`/`dns.promises.lookup`, `net.connect`, `tls.connect` and `Socket.prototype.connect`, and appends to a log in scratch.
- Run-mode helpers from `/docs/writing-checks` (`start`, a process-group kill, about 30 lines).

**Total for the round-1 `run.mjs`**: about 800 to 1,000 lines. Toddler Buddy's round 1 was 584.

## 3. State persistence

- **Recommended: `node:sqlite`** (Node 24.20, no flag, no warning, synchronous, transactional, survives SIGKILL with WAL). Store it at `$STARKBOT_DATA/state.db`. The file name is not checked.
- **Allowed: one JSON file**, written to a temp file, `fsync`ed, then `rename`d. It is simple for round 1, but rounds 2 and 3 (watches, delivery ledger, digests) push it toward sqlite.
- **Not recommended: better-sqlite3.** It works today only because version 13 ships prebuilds, adds 27 MB and a native binary, and gains nothing over `node:sqlite`.
- **The format is the entry's own; checks never parse it.** Checks assert behaviour:
  - It survives a restart with the same `STARKBOT_DATA`.
  - It survives a SIGKILL sent right after a confirmation is seen. The rule: "a change is saved before its confirmation is sent".
  - Mode 700/600.
  - No file appears outside `STARKBOT_DATA`: the check snapshots the entry tree, HOME and TMPDIR before and after.
  - The bot token and the RPC URL appear in no file.
- **Data minimisation rule (rubric, plus a check that the token is not stored)**: store chat ids, settings, watches and labels, the update offset and the delivery ledger. Do not store message text, usernames or names.

## 4. Determinism and how checks avoid flakiness

1. **Timers**: about 80% of tests use `tick` through the kit's `entry()` (10 s limit, waits for exit), with no sleeps. `run` tests set `STARKBOT_POLL_MS=100` and `STARKBOT_TG_TIMEOUT=1`, and wait with `tg.next(chat, {ms:5000})` deadline loops. There are no fixed sleeps.
2. **Proving something did not happen in `run`**: use a barrier, not a quiet window. Send `/status` (or add a block) after the action under test and wait for its reply. Updates are handled in order per chat, so the barrier proves the earlier one was processed.
3. **Ordering**:
   - Within a chat, replies follow update order (specified).
   - Across chats, order is unspecified, so checks match per chat.
   - Lists (`/balance`) follow registry order (specified).
4. **Offsets**: the fake re-serves unconfirmed updates, as Telegram does. Spec: `tick` confirms what it handled before exiting (a final `getUpdates` with `offset=last+1, timeout=0`) or persists the last `update_id`. The check restarts and asserts there is no second reply.
5. **Shutdown**: SIGTERM during a held `getUpdates` must exit 0 within 3 s. Entries must abort the fetch with an `AbortController`. The fake's 1 s hold cap keeps an entry that ignores this from passing only by luck.
6. **Number precision**: amounts must use BigInt. Fixtures include a u256 with a non-zero high part (`2^128 + 5`), 1 wei, and a balance above 2^53.
7. **Formatting**: `TZ=UTC` and `LANG=C.UTF-8` come from the kit. The brief fixes the formats, so no assertion depends on `Intl` or the locale:
   - Times: `YYYY-MM-DD HH:MM:SS UTC`.
   - Amounts: exact decimal, trailing zeros trimmed, `.` as the point, optional `,` grouping (checks strip commas).
   - Addresses: shortened `0x` + 4 hex + `…` + 4 hex after normalising to 64 hex, with the full value in links.
8. **Process cleanup**: the fakes close in `finally`, entries are killed by process group, and the kit also kills them on exit. Tests run sequentially (the harness is sequential), since there are only 2 CPUs.
9. **Rate-limit tests**: use loose bounds, e.g. at most `RPS + 1` requests in any 1 s window, and the request after a `Retry-After: 1` comes at least 900 ms later. Do not assert exact timings.
10. **Startup cost**: about 0.1 s with no dependencies, about 0.3 s with grammY and starknet.js. With about 100 entry runs in round 1 that is 10 to 40 s. Set `check.json` `timeoutSeconds` to 300.

## 5. Checkable vs rubric-only

**Checkable (run something, read the fakes, stdout/stderr and files)**
- CLI and configuration exit codes. A bad env makes no network call (trap log is empty).
- `doctor` output and the chain-id mismatch.
- Replies and their key content: exact amounts, block number, chain, finality and execution status, fee, revert reason, explorer link built from `STARKBOT_EXPLORER_URL`.
- Correct RPC calls: contract, selector and calldata. Invalid input makes no RPC call.
- Group addressing (`/cmd`, `/cmd@fake_bot`, ignore `/cmd@other_bot` and plain text).
- `setMyCommands` contents.
- HTML validity and length, through the strict fake. This includes escaping of user text echoed back, e.g. a label `<b>&`.
- Retry and backoff on RPC 429/5xx and on Telegram 429 `retry_after`; skipping a chat that returned 403; surviving a node outage; staying under the RPS limit.
- Exactly-once and at-least-once delivery across restarts and SIGKILL (round 2, with `tg.hold`).
- Paging through `getEvents`, both Transfer event layouts, and no alert for events older than the subscription (round 2).
- Secrets absent from outputs, files, messages and requests to the other host. Only configured hosts contacted (trap). No `starknet_add*` call. File modes. No writes outside `STARKBOT_DATA`. A repository scan for token-shaped strings (excluding `.launchpad/`). The dependency allowlist.

**Rubric only**
- Message copy: clarity, tone, emoji restraint, how alerts read in a busy group, onboarding with `/start` and `/help`.
- Sensible defaults and noise control.
- Code quality: structure, readability, readiness for the next round.
- README and deploy instructions (BotFather setup, choosing an RPC, systemd/Docker); a Docker build cannot run in the runner.
- Depth of the security posture beyond what the checks see, such as no hidden endpoints and log hygiene.
- Accessibility and i18n quality.

## 6. Dependency policy

Recommendation (moderate confidence): **Node 24 built-ins only, with one optional exception: `starknet` pinned to an exact version (e.g. `10.8.0`). No Telegram framework, no other runtime dependency, no dev dependencies needed.** The round-1 check enforces this as an allowlist read from `package.json` (`dependencies` ⊆ {starknet@<pinned>}). Because every later round re-runs that check, it must be decided before round 1 is committed.

**Why not grammY**
- The bot uses about 8 Bot API methods over plain HTTPS JSON. A `fetch` long-poll loop with offset handling, `retry_after` handling and an abort is about 60 lines.
- grammY's core does not retry 429 on `sendMessage` (that needs the auto-retry plugin), so it does not remove the hard part.
- It adds `node-fetch@2`, `debug` and `abort-controller` to a security-sensitive community bot.

**Why allow starknet.js (optional)**
- It provides keccak/selectors (missing from `node:crypto`), Cairo ABI decoding (u256, ByteArray symbols, structs) and Starknet ID helpers (round 3).
- Hand-writing a 70-line keccak in one sitting is a classic source of subtle bugs.

**Against starknet.js**
- About 70 MB; it is at major version 10 (agents trained on versions 6 and 7 will call renamed APIs).
- Hidden RPC calls are possible, so the fake must answer any read method with something plausible or a `-32601`.
- Mitigation: `ARCHITECTURE.md` lists the selector constants above, so a zero-dependency entry never needs keccak in rounds 1 and 2.

**Alternative**: strict zero dependencies, like Toddler Buddy. Simplest to audit, but round 3 (Starknet ID, events by name) then needs a hand-written keccak with test vectors.

**Checks have no dependency at all**: kit plus built-ins.

## 7. Security constraints for a bot built by anonymous agents

1. **No custody, ever** (check plus rubric): no private keys, no signing, no `starknet_add*` calls, no wallet connection in rounds 1 to 5. The bot never asks for a seed phrase or key. A round-3 guard detects a pasted BIP-39 phrase, deletes the message (`deleteMessage`, checkable) and warns without echoing it.
2. **Secrets only from the environment**: `TELEGRAM_BOT_TOKEN` and `STARKNET_RPC_URL`, both treated as secrets. Logs show only the RPC origin, never the path or query. There is a `.env.example` with placeholders, and the repository holds no real token (scan check).
3. **Never log or echo secrets** (check): markers in the token and the RPC path must be absent from stdout, stderr, every `sendMessage` text, every file in `STARKBOT_DATA`, and every request to the RPC. The token must also not appear in any request except the Telegram URL path.
4. **Only configured hosts** (check through the trap, plus rubric for code review):
   - No telemetry, no remote config or code, no fallback public RPC, no price APIs until a round adds a named `*_URL` variable.
   - The explorer URL is used only for links.
   - No `eval`, no `child_process` in the bot (rubric, plus an optional static grep check).
5. **Untrusted input everywhere** (check):
   - Every user string in HTML is escaped.
   - Addresses and hashes are validated (felt < 2^251, normalised) before any RPC call.
   - Per-chat caps (e.g. 20 watches) and a per-user command rate limit by `message.date` (round 2).
   - Bounded work per poll (`STARKBOT_MAX_BLOCKS`, bounded pages).
6. **Groups**: only chat admins (`getChatMember`, faked) change group settings (round 3).
7. **Data rights**: `/forget` wipes everything stored for a chat; `/export` returns it as a JSON document (round 3, checkable).
8. **Supply chain**: the allowlist plus lockfile and the gate's no-install-scripts rule; dependencies pinned exactly.

## 8. Feature list by round (proposal for the PM)

| Round | Title | Features |
|---|---|---|
| 1 | Core and lookups | Interface in §1; `/start`, `/help`, `/status` (chain, head block and time, L1/L2 gas prices); `/balance <address>` over the registry with exact u256 amounts and an "undeployed" flag; `/tx <hash>` (finality, execution, fee, block, revert reason, explorer link); pasted address or hash in a private chat triggers the lookup; group addressing; resilience to 429/5xx/403; security baseline; starter `tokens/SN_MAIN.json` (at least ETH, STRK, USDC, USDT, WBTC) |
| 2 | Watches and alerts | `/watch <address> [label]`, `/unwatch`, `/list`; incoming and outgoing Transfer alerts for registry tokens, parsing both layouts (from/to in keys when `keys.length==3`, in data when `keys.length==1`); `/track <hash>` notifies on L2 then L1 acceptance or a revert; paging; catch-up bound; nothing for events before the subscription; at-least-once delivery deduplicated by (tx hash, event position); pause a chat after 403; per-chat caps |
| 3 | Groups and community | Admin-gated group settings; whale alerts (`/whales STRK 100000`); contract event watch by name or selector; Starknet ID `.stark` lookup and reverse lookup (fake naming contract); daily digest and mute hours on chain time; seed-phrase guard; `/forget`, `/export`; per-user rate limits |
| 4 | Staking and validators | `/staking <address>` (delegations, unclaimed rewards); validator watch (stake and commission changes, unstake intent, missed attestations). `ARCHITECTURE.md` must spell out the staking ABI subset, because agents will not know the current one. |
| 5 | Production | Webhook mode with secret token; `/healthz` and `/metrics` on a port; `STARKNET_RPC_URLS` failover; `STARKBOT_CONFIRMATIONS` and reorg handling (block-hash check, corrected alert); deploy guide (rubric) |

Prize split is your call: 5 × 7,000,000 = 35M uses the whole cap, 4 × 8,000,000 = 32M leaves headroom.

Round 1 is the largest for one sitting. If it proves too big, move the paste lookup and the RPS-limit test to round 2.

## 9. Sketch of round 1 `run.mjs`

```js
// .launchpad/checks/round-1/run.mjs (structure only)
import { check, harness } from "./lib/harness.mjs";
import { entry, ROOT, workspace } from "./lib/entry.mjs";
import { fakeTelegram } from "./fake-telegram.mjs";   // ~150 lines, check-owned, Node built-ins
import { fakeNode, u256, shortString } from "./fake-starknet.mjs"; // ~190 lines
const TOKEN = "110201543:AAchecks-only-TOKEN-MARKER-x9Qk2";
const RPC_SECRET = "SECRET-RPC-KEY-7f3a";
const bot = entry("node", ["bot.mjs"]);
const { test, done } = harness();

/** A fresh world: fakes on loopback, a token registry file, a data dir the bot will create. */
async function world({ chain } = {}) {
  const tg = await fakeTelegram(TOKEN).listen();       // { url, sent, calls, text(), next(), fail(), hold(), close() }
  const node = await fakeNode(chain ?? defaultChain()).listen(`/v0_9/${RPC_SECRET}`);
  const data = `${workspace().scratch}/data-${++n}`;
  const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_API_ROOT: tg.url, STARKNET_RPC_URL: node.url,
    STARKBOT_DATA: data, STARKBOT_TOKENS: tokensFile, STARKBOT_RPC_TIMEOUT_MS: "1500",
    NODE_OPTIONS: `--import=${trapPath}`, TRAP_LOG: trapLog() };
  const tick = async () => { const r = await bot(["tick"], { env }); check(r.code === 0, why(r)); return JSON.parse(r.out); };
  return { tg, node, data, env, tick, close: () => Promise.all([tg.close(), node.close()]) };
}
```

Proposed test names for `check.json`, grouped by the criterion they serve:

**CLI and configuration**
1. a bad command line exits 2 with a reason on stderr and nothing on stdout
2. a missing or malformed token, API root or RPC URL exits 2 and contacts nothing
3. a node on another chain than STARKBOT_CHAIN exits 2 naming both chains
4. a bad token registry exits 2 naming the bad entry
5. doctor prints the bot's username, the chain and the head block as one JSON line
6. a token Telegram rejects exits 3, and the token appears nowhere in the output

**Telegram loop**
7. tick answers every pending update, in order per chat, and prints its JSON summary
8. a handled update is never answered again, across ticks and restarts
9. registers its commands with setMyCommands
10. /start and /help answer in private chats with valid HTML of at most 4096 characters
11. in groups it answers only commands addressed to it, and ignores plain text and other bots' commands
12. an unknown command gets a hint pointing to /help

**Starknet lookups**
13. /status shows the chain, the head block and its time, and gas prices read from the node
14. /balance calls balance_of on every registry token and prints exact amounts, including u256 above 2^128
15. /balance of an undeployed address still shows its balances and says it is not deployed
16. /balance with an invalid address explains why and makes no RPC call
17. /tx shows finality, execution status, fee, block and an explorer link
18. /tx of a reverted transaction shows its revert reason, HTML-escaped
19. /tx of an unknown hash says it was not found
20. a pasted hash or address in a private chat is looked up as a transaction, else as an address
21. addresses and hashes are accepted in any case and with or without leading zeros, and shown normalised
22. never uses the pending block tag, only latest, block numbers or hashes

**Robustness**
23. an RPC 429 or 5xx is retried with backoff, then answered with a "node busy" reply, never a crash
24. never sends more RPC requests per second than STARKBOT_RPC_RPS
25. a Telegram 429 is retried after retry_after, and the message is sent exactly once
26. a chat that blocked the bot (403) is skipped, and other chats still get their answers
27. user text echoed in a reply is HTML-escaped

**Run mode**
28. run answers a message within 3 s and keeps answering
29. run survives a node that is down for 2 s and answers once it is back
30. run exits 0 within 3 s of SIGTERM, even during a long poll

**Security**
31. never calls a Starknet write method
32. the bot token and the RPC URL's secret appear in no output, log, message, data file or request to the other host
33. contacts only TELEGRAM_API_ROOT and STARKNET_RPC_URL
34. writes only inside STARKBOT_DATA, a directory of mode 700 with files of mode 600
35. the repository holds no Telegram token or private key
36. runtime dependencies are only those allowed

`check.json` should set `"timeoutSeconds": 300`.

**Matching `## How to run it` (for judges)**
`TELEGRAM_BOT_TOKEN=… STARKNET_RPC_URL=… node bot.mjs doctor && node bot.mjs run`, using a BotFather test bot and a Sepolia RPC with `STARKBOT_CHAIN=SN_SEPOLIA`.
- C1 (usefulness and copy): `/start`, `/status`, `/balance` on a busy and an empty address, `/tx` on a success and a revert.
- C2 (robustness): a bad address, a bad hash and a wrong RPC URL, then kill and restart.
- C3 (security): read where the token and RPC URL flow, then grep the logs.
- C4 (code quality): imagine adding `/watch`.

Open risk to settle before writing round 1 (low confidence): the exact mainnet addresses beyond ETH (`0x049d3657…004dc7`) and STRK (`0x04718f5a…c938d`). USDC changed address in 2025, so verify the others before the starter registry check asserts them. Checks should assert symbols and well-formedness, not addresses.

Probe files (scratch, not for publishing): `/private/tmp/claude-501/-Volumes-Crucial-X9-Project-Zero/d800fe91-298c-4880-a918-3f58ce7625b8/scratchpad/tgprobe/fakes.mjs`, `probe.mjs`, `probe2.mjs`, `trap.mjs`.