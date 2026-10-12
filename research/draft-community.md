# Murmur: a community Telegram bot for Starknet (Hotpod project spec, draft 2026-10-12)

This spec takes a community-first angle. It draws on four research notes (landscape, Starknet reference, Telegram reference and checkability), cited below as L, S, T and C with section numbers, and it matches the precision of Toddler Buddy's `.launchpad/project.md`.

Confidence labels are H (high), M (moderate), L (low) and unknown. **(unverified)** marks a fact the research did not confirm. Each one must be checked before the round that depends on it is committed.

---

## 1. Name, pitch, personas

**Name: Murmur.** The project slug is `murmur`, the entry file is `murmur.mjs` and the env prefix is `MURMUR_`.
- A murmuration is a flock of starlings moving as one. The name says what the bot does for a group: everyone sees the same on-chain moves at the same time.
- It is a common English word and is not tied to any Starknet company.
- Keep "Stark" and "Starknet" out of the name and the @handle, so the bot does not look official.
- Trademark and handle availability: unknown, not searched. Fallback names are Flock and Tidings.
- Avoid Starling (a UK bank) and Lookout (a security company). Both are existing brands.

**Pitch** (for `# Pitch`):

> Murmur is the open-source, self-hostable Telegram bot for Starknet communities. Add it to your group and it posts each buy of your token, whale moves and treasury transfers as they land. It answers `/price`, `/balance` and `/tx` in the chat, sums the day up in one digest, and warns members who post a seed phrase or a known phishing link. It reads the chain over any Starknet RPC, never holds a key, and runs as one Node.js process with no dependencies.

**Why now**
- **No Starknet buy bot, whale bot or wallet-alert bot exists (M).** The multichain trackers do not cover Starknet: Cielo leaves it out after its September 2026 refresh, and DeBank, Zerion and Whale Alert don't list it (L §1, §2, §4).
- **The best-funded Starknet Telegram effort is dead (H).** Argent/Ready's Telegram wallet was deprecated "due to new Telegram rules" (L §1).
- **A plain read-only bot is the compliant shape (H).** Bots without a Mini App are exempt from the TON-only rule ([Blockchain Guidelines](https://core.telegram.org/bots/blockchain-guidelines)).
- **Groups install buy bots on other chains (M).** Buy bots appear in nearly every token group there, and every install advertises the bot to the group (L §2).

**Personas**

| Persona | Who | Why they add Murmur | Evidence |
|---|---|---|---|
| **Admin** | Runs a Starknet project's Telegram group, including projects that launch through Hotpod | Buy feed and buyer leaderboard as social proof; whale and treasury-wallet alerts for transparency; one daily digest instead of noise; seed-phrase and phishing guards; everything set up inside the chat | Buy pings and leaderboards are standard on other chains; none found on Starknet (L §2, §4.1) (M) |
| **Member** | Holder in those groups | `/price`, `/balance`, `/tx` and `.stark` names in the chat; a private watchlist for their own wallets; price and depeg alerts | Wallet following is Cielo's core feature and Cielo lacks Starknet; dashboard requests on the forum since 2023 (L §4.7) (M) |
| **Watcher** | DAO treasurer, team, builder | Watch multisigs and treasuries; network stall alerts; `/track` a transaction | Outages on 2 Sep 2025 (about 9 h) and 5 Jan 2026 (about 4 h). The community heard about them from independent bots before official channels (L §4.4) (M) |
| **Staker** | Delegator or validator | Alerts for a missed attestation, a commission change, a validator's exit intent, an unlock that is ready, unclaimed rewards and a low operational balance | Staking v2 pays nothing for an epoch without an attestation, rewards must be claimed by hand, and exit takes 7 days (S §3) (H). 1.1B STRK staked (L §1) (M) |
| **Operator** | Self-hoster: a project developer, Hotpod, any community member | One process configured by env, any RPC, no dependencies, no custody liability | Every big Telegram-bot loss came from custody (L §3) (H). Under MiCA a bot that holds keys is a custody service (M) |

---

## 2. Product principles and non-goals

**Principles.** A principle tagged *(check)* is enforced by a test in every round from the one that introduces it.

1. **Read-only, no custody.** No private keys, no signing, no `starknet_add*` call *(check)*. The bot never asks for a seed phrase. From round 4 it deletes one when a member posts it.
2. **A plain bot, never a Mini App.** Telegram's rules forbid non-TON wallets inside Mini Apps; plain bots are exempt (H). Any future signing goes through an ordinary URL button to an external page (S §0, T §0).
3. **Facts, not advice.** Every number comes with its source and age: block, Pragma's update time and number of sources. There are no "calls", no token rankings across groups, no trending lists and no buy or sell suggestions. `/help` says so.
4. **Quiet by default.** Nothing posts in a group until an admin turns it on.
   - Alerts are grouped one per transaction.
   - Dust, zero-value address-poisoning transfers and fee payments are never alerted *(check)*.
   - Per-chat caps and per-user rate limits apply *(check)*, and Telegram's limits are honoured *(check)*.
5. **Private by default.** The bot stores chat ids, settings, subscriptions, labels, the update offset and a delivery ledger. It never stores message text, names or usernames (rubric, plus a check that secrets are absent).
   - `/export` and `/forget` exist *(check)*.
   - Watch labels are private to the chat that set them.
6. **Honest data.** A USD value appears only when an on-chain price exists, and otherwise the bot says it is unknown. A `.stark` name appears only if it resolves back to the same address *(check)*.
7. **Verifiable and self-hostable.** Node.js 24 built-ins only, no runtime dependency *(check)*. Secrets come only from the environment *(check)*. The bot contacts only the hosts configured for it *(check)*.
8. **Chain time.** User-visible time comes from block timestamps, so digests, quiet hours, leaderboards and price windows can be tested exactly (C §1). Wall clock is used only for backoff, timeouts, logs and stall detection (round 5).

**Non-goals**

| Not built | Why | Conf. |
|---|---|---|
| Custodial trading, sniping, copy trading, key or seed import | These designs caused the Maestro, Unibot, Solareum, Banana Gun, Nova and SIGMA losses. Holding keys is custody under MiCA. Sniping harms the projects the launchpad serves (L §3, §7) | H |
| Any Mini App | TON-only rule; a Mini App would void the exemption (T §0) | H |
| Signing links or session keys | Out of scope for this project. Wallets implement session keys differently, and the SNIP is a pre-audit draft (S §6). It could be a separate later project | M |
| Free-text AI agent that acts | Prompt injection leads straight to fund loss (L §7) | M |
| Paid trending slots, volume bots, ads or sponsored lines in alerts | Market-manipulation and regulatory exposure, and it erodes trust in an open-source bot (L §7) | M |
| Paid tiers sold inside the bot | Digital goods sold in Telegram must be paid in Stars (T §1). The core stays free | M |
| General anti-spam or CAPTCHA engine | Rose, Shieldy and Combot already do this; Murmur only adds the Starknet-specific guards (L §2, §7) | M |
| STRK20 shielded tracking or viewing keys | Viewing keys reveal shielded activity. `/help` says shielded transfers are invisible to the bot (L §3) | H |
| Airdrop farming | The category is full of malware lures, including a Starknet one (L §1) | H |
| Indexer-based analytics (holder counts, deployer, LP lock) in rounds 1–5 | Needs an outside API key (Starkscan or Voyager) and cannot be faked fairly in round 1. Deferred | M |

---

## 3. Feature list

How each feature is verified:
- **check** means an offline test against a fake Telegram Bot API and a fake Starknet node.
- **rubric** means the judges decide.
- **check + rubric** means the facts are checked and the copy or feel is judged.

| ID | Feature | Command / trigger | Persona | Round | Priority | Checked by |
|---|---|---|---|---|---|---|
| F01 | Self-hosted process with `run`, `tick`, `doctor` and fixed exit codes | `node murmur.mjs run\|tick\|doctor` | Operator | 1 | must | check |
| F02 | Configuration from env only; bad config exits 2 before any network call | env (§4.2) | Operator | 1 | must | check |
| F03 | Network file holding contracts and the token registry; starter mainnet and Sepolia files | `networks/<chain>.json`, `MURMUR_NETWORK` | Operator | 1 | must | check (format, symbols) + rubric (addresses) |
| F04 | Onboarding and help, with an "Add to group" link (`?startgroup=setup`) | `/start`, `/help` | Member, Admin | 1 | must | check (valid HTML) + rubric (copy) |
| F05 | Group etiquette: answers only `/cmd` and `/cmd@<bot>`; works with privacy mode on | any group message | Admin | 1 | must | check |
| F06 | Network status: chain, head block and time, L1/L2/data gas prices | `/status` | Member, Watcher | 1 | should | check |
| F07 | On-chain price from Pragma with source count and age; stale flag | `/price [SYMBOL]` | Member | 1 | must | check |
| F08 | Balances across the registry: exact u256, `balanceOf` fallback for Cairo 0, "not deployed" flag | `/balance <address>` | Member | 1 | must | check |
| F09 | Transaction card: finality, execution, fee, block, revert reason, explorer link | `/tx <hash>` | Member, Watcher | 1 | must | check |
| F10 | Paste-to-lookup in private chats | a bare `0x…` sent in a DM | Member | 1 | could | check |
| F11 | Resilience: RPC retry and backoff, RPS cap, Telegram `retry_after`, skip 403, split long messages | automatic | Operator | 1 | must | check |
| F12 | Security baseline: no write methods; secrets never leak; only configured hosts contacted; data dir 700/600; no secrets in the repo; no dependencies | automatic | Operator | 1 | must | check + rubric |
| F13 | Watchlist with labels: personal in a DM, treasury or team wallets in a group | `/watch <address> [label]` | Watcher, Admin | 2 | must | check |
| F14 | Transfer alerts in and out, both Transfer layouts, one message per transaction | chain event | Watcher, Admin | 2 | must | check + rubric |
| F15 | Noise floor: zero-value and fee transfers never alerted; per-token minimum per chat | `/min <SYMBOL> <amount>` | Watcher | 2 | must | check |
| F16 | Whale alerts for a token above a threshold | `/whales <SYMBOL> <amount>\|off` | Admin, Member | 2 | must | check |
| F17 | List and remove any subscription | `/list`, `/remove <n\|address\|label>` | all | 2 | must | check |
| F18 | Admin gate for group configuration, including anonymous admins | config commands in groups | Admin | 2 | must | check |
| F19 | Delivery guarantees: nothing from before the subscription, at-least-once across SIGKILL, no repeats of confirmed sends, bounded catch-up | `MURMUR_MAX_BLOCKS` | Operator | 2 | must | check |
| F20 | Changing chats: re-key on supergroup migration; pause a chat on 403 or kick | automatic | Admin, Operator | 2 | must | check |
| F21 | Per-chat caps and per-user command rate limit | automatic | Operator | 2 | should | check |
| F22 | **Buy feed**: one token per group, from Ekubo and AVNU, one ping per transaction | `/buyfeed <SYMBOL\|address> [min_usd]\|off` | Admin | 3 | must | check + rubric |
| F23 | Ping content: amount bought, amount paid, USD, buyer, new-holder flag, market cap, size bar, tx link | on each buy | Member | 3 | must | check (fields) + rubric (look) |
| F24 | Optional sell pings | `/buyfeed sells on\|off` | Admin | 3 | should | check |
| F25 | Buyer leaderboard on chain time | `/top [24h\|7d]` | Member, Admin | 3 | should | check |
| F26 | Starknet ID: forward and reverse lookup; `.stark` accepted wherever an address is; names in alerts only when they round-trip | `/name <x>`, `<name>.stark` arguments | Member | 3 | must | check |
| F27 | Daily digest at a local time; digest-only mode | `/digest <HH:MM> [only]\|off` | Admin, Watcher | 4 | must | check + rubric |
| F28 | Time zone, and quiet hours with a summary of held alerts | `/tz <Area/City>`, `/quiet <HH:MM-HH:MM>\|off` | Admin, Watcher | 4 | should | check |
| F29 | Settings panel with inline buttons, admin-only | `/settings` | Admin | 4 | should | check + rubric |
| F30 | Alerts posted to a forum topic | `/topic` (sent inside a topic) | Admin | 4 | could | check |
| F31 | Seed-phrase guard: delete the message and warn without repeating it | 12+ BIP-39 words in a row | Admin, Member | 4 | must | check |
| F32 | Phishing-link guard from a blocklist file | link to a listed domain; `MURMUR_BLOCKLIST` | Admin | 4 | should | check |
| F33 | Guard switches | `/guard seed\|links on\|off` | Admin | 4 | should | check |
| F34 | Data rights | `/export`, `/forget` | all | 4 | must | check |
| F35 | Price and depeg alerts | `/alert <SYMBOL> above\|below <usd>`, `/alert <SYMBOL> move <pct>` | Member | 5 | should | check |
| F36 | Delegator watch: position; missed attestation; commission change; validator exit; unlock ready; unclaimed reminder | `/stakewatch <delegator> <validator>` | Staker | 5 | must | check + rubric |
| F37 | Validator self-watch: missed attestation, low operational balance | `/validator <staker> <min STRK>` | Staker | 5 | should | check |
| F38 | Stall and recovery alerts; node-down notices go only to the operator | `/netwatch on\|off`, `MURMUR_STALL_SECONDS`, `MURMUR_OPERATOR_CHAT` | Watcher, Admin | 5 | should | check |
| F39 | Reorg detection, with corrections to alerts already sent | automatic | all | 5 | should | check |
| F40 | Transaction tracking: landed, reverted, L1-accepted, dropped | `/track <hash>` | Member, Watcher | 5 | could | check |
| F41 | Deployment: Dockerfile, systemd unit, BotFather and RPC guide | README | Operator | 5 | should | rubric |
| F42 | Token-gated groups: join requests approved after a signature on an external page | `chat_join_request` | Admin | later | should | (needs SNIP-12 hashing; see §6 D2) |
| F43 | Governance alerts: Snapshot X proposals open and close; "your delegate has not voted" | `/gov` | Member | later | should | (needs a `MURMUR_SNAPSHOT_URL` host) |
| F44 | Token safety card: holders, deployer, LP lock, Unruggable status | `/scan <token>` | Member | later | could | (needs an indexer API) |
| F45 | Lending health and oracle-deviation alerts (Vesu, Nostra) | — | Member | later | could | (protocol ABIs not researched) |
| F46 | Ekubo LP out of range; TWAMM or limit order filled | — | Member | later | could | — |
| F47 | More pools in the buy feed: JediSwap V1/V2, 10KSwap, Nostra, StarkDefi | — | Admin | later | could | (V2 layout unverified, S §5) |
| F48 | Webhook mode, health endpoint, RPC failover | `MURMUR_WEBHOOK_*`, `MURMUR_RPC_URLS` | Operator | later | could | — |
| F49 | Guest-mode price answers (`@bot price STRK`, Bot API 10.0) | — | Member | later | could | — |
| F50 | Managed per-project branded bots (Bot API 9.6) | — | Admin | later | could | — |
| F51 | Translations | — | Member | later | could | rubric |
| F52 | Public STRK whale channel around the monthly unlocks | — | Member | later | could | (needs verified exchange labels) |
| F53 | Signing links (SNIP-9 / SNIP-29) | — | Member | out | — | — |
| F54 | Custody, key import, trading, sniping, copy trading | — | — | out | — | — |
| F55 | Mini App | — | — | out | — | — |
| F56 | Paid trending, volume bots, ads in alerts | — | — | out | — | — |
| F57 | AI agent that acts | — | — | out | — | — |
| F58 | STRK20 viewing keys or shielded tracking | — | — | out | — | — |
| F59 | General anti-spam or CAPTCHA engine | — | — | out | — | — |
| F60 | Airdrop farming | — | — | out | — | — |

---

## 4. Architecture

### 4.1 Shape

One Node.js 24 process runs three cooperating loops: Telegram updates, a chain scanner, and a delivery queue. All of them share one state store.

```
Telegram Bot API  <- long poll / send ->  telegram  -> commands -------------> store (node:sqlite)
Starknet JSON-RPC <- HTTP polling ----->  rpc -> scanner -> watchers -> deliver -> telegram
                                                    (transfers, whales, buys, prices, staking, network)
```

The module layout below is a suggestion. Checks never import entry code, and they run it only as child processes.

| Module | Job | From round |
|---|---|---|
| `murmur.mjs` | Command line, env validation, exit codes | 1 |
| `src/telegram.mjs` | Bot API client: fetch, long poll, offset, `retry_after`, error mapping, per-chat send queue, 4096 split | 1 |
| `src/rpc.mjs` | JSON-RPC client: RPS window, timeout, retry, spec and chain checks | 1 |
| `src/felt.mjs` | Address normalisation, u256, short strings, ByteArray, selector constants, event decoders | 1 |
| `src/format.mjs` | HTML escaping, amounts, addresses, times, links | 1 |
| `src/commands/*.mjs` | One file per command group | 1 |
| `src/scanner.mjs` | Cursor, `getEvents` paging, block-hash continuity | 2 (5) |
| `src/watchers/*.mjs` | Transfers, whales, buys, prices, staking, network | 2–5 |
| `src/deliver.mjs` | Delivery ledger, dedupe, quiet hours, digests | 2 (4) |
| `src/store.mjs` | `node:sqlite` schema and migrations | 1 |

### 4.2 Fixed interface (frozen in round 1; later rounds only add)

**Commands and exit codes**

```
node murmur.mjs run     # long-poll Telegram and poll the chain until SIGTERM/SIGINT; exit 0 within 3 s
node murmur.mjs tick    # one pass, then exit (order below); prints ONE JSON line
node murmur.mjs doctor  # getMe, starknet_specVersion, starknet_chainId, starknet_blockNumber; ONE JSON line
```

**`tick` order:**
1. Read the head and its timestamp.
2. Drain updates with `getUpdates` and `timeout=0` until a call returns nothing. Commands see the head from step 1.
3. Scan from cursor+1 up to min(head, cursor+`MURMUR_MAX_BLOCKS`). Round 1 does no scan.
4. Deliver.
5. Save state.
6. Confirm the update offset.
7. Print the JSON line.

**Output lines**
- `tick` prints `{"updates":n,"replies":n,"head":n}`. Round 2 adds `"alerts":n,"cursor":n`. Checks ignore unknown keys.
- `doctor` prints `{"bot":"<username>","chain":"SN_MAIN","block":n,"spec":"0.10.3"}`.

**Exit codes**

| Code | Meaning |
|---|---|
| 0 | OK |
| 1 | Telegram or the node is unreachable, or a 409 shows another instance is running. Reason on stderr; state stays consistent |
| 2 | Bad command line, env or network file, with no network call. Also a node on another chain than `MURMUR_CHAIN`, or one whose `starknet_specVersion` is below 0.10. Reason on stderr, nothing on stdout |
| 3 | Telegram rejected the token (401). Used so a supervisor does not restart-loop |

**Environment.** Secrets come only from env, never from flags.

| Var | Default | Rule | Round |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | required | `^\d+:[A-Za-z0-9_-]{30,}$` | 1 |
| `TELEGRAM_API_ROOT` | `https://api.telegram.org` | http(s) origin, no path, no trailing slash; calls go to `${root}/bot${token}/${method}` | 1 |
| `STARKNET_RPC_URL` | required | http(s) URL. Treated as a secret: logs show only its origin | 1 |
| `MURMUR_CHAIN` | `SN_MAIN` | `SN_MAIN` or `SN_SEPOLIA`, compared with the decoded `starknet_chainId` | 1 |
| `MURMUR_DATA` | `./data` | Created with mode 700, files 600; nothing is written elsewhere | 1 |
| `MURMUR_NETWORK` | `networks/<chain>.json` next to `murmur.mjs` | Network file (below) | 1 |
| `MURMUR_EXPLORER_URL` | `https://voyager.online` | Used only for links: `/tx/<hash>`, `/contract/<address>`. Never fetched | 1 |
| `MURMUR_POLL_MS` | `10000` | Minimum 50; checks use 100 | 1 |
| `MURMUR_TG_TIMEOUT` | `30` | Long-poll seconds in `run`, 0–50; checks use 1 | 1 |
| `MURMUR_RPC_RPS` | `5` | 1–100; most RPC requests in any 1 s window | 1 |
| `MURMUR_RPC_TIMEOUT_MS` | `10000` | Minimum 100; checks use 1500 | 1 |
| `MURMUR_LOG` | `info` | `error\|warn\|info\|debug`. One JSON line per event, on stderr only | 1 |
| `MURMUR_MAX_BLOCKS` | `500` | 1–10000 blocks scanned per poll | 2 |
| `MURMUR_BLOCKLIST` | `blocklist/domains.txt` | One domain per line; `#` starts a comment | 4 |
| `MURMUR_STALL_SECONDS` | `120` | Minimum 2 (wall clock) | 5 |
| `MURMUR_OPERATOR_CHAT` | unset | Chat id that receives node-down notices | 5 |

A round ignores variables that later rounds introduce, and round 1's checks never set them.

**Network file**

```json
{
  "chain": "SN_MAIN",
  "contracts": { "pragma": "0x02a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b" },
  "tokens": [
    { "symbol": "STRK", "address": "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      "decimals": 18, "pragma": "STRK/USD" }
  ]
}
```

Validation rules:
- `chain` must equal `MURMUR_CHAIN`.
- `contracts` maps names to addresses. Names a round does not use are ignored. Rounds add `ekubo_core`, `avnu_exchange` and `naming` (round 3), then `staking` and `attestation` (round 5).
- `tokens` holds 1–50 entries:
  - `symbol` matches `^[A-Za-z0-9.]{1,16}$` and is unique ignoring case.
  - `address` is a felt below 2^251, unique once normalised.
  - `decimals` is an integer from 0 to 36.
  - `pragma` is optional and matches `^[A-Z0-9]{1,16}/[A-Z0-9]{1,16}$`.
- Any error exits 2 with `<file>: tokens[3].decimals: <reason>`.

**Starter mainnet values** (S §2–§5; verified on-chain on 12 Oct 2026 unless marked):

| Key | Address | Notes |
|---|---|---|
| `pragma` | 0x2a85bd61…a875b | R1 |
| `ekubo_core` | 0x00000005dd3d2f44…0325b4b | R3 |
| `avnu_exchange` | 0x04270219d365d6b0…e93b0f | R3 |
| `naming` | 0x06ac597f8116f886…bbfb678 | R3 |
| `staking` | 0x00ca1702e64c81d9…e84a7 | R5 |
| `attestation` | 0x10398fe631af9ab2…8a99 | R5 |

Starter tokens:
- STRK, pair `STRK/USD`
- ETH, pair `ETH/USD`
- USDC (native), pair `USDC/USD`
- USDC.e, pair `USDC/USD` (assumed peg)
- USDT, pair (unverified)
- WBTC, pair `BTC/USD` (assumed peg)
- strkBTC, pair `BTC/USD` (assumed peg)

Checks assert the starter file's format and symbols, not its addresses. The creator reviews the addresses (C §9).

**Output formats** (so no check depends on locale):
- **Times:** `YYYY-MM-DD HH:MM:SS UTC`. From round 4, digests and quiet-hour summaries add the chat's zone.
- **Amounts:** computed with BigInt and printed as exact decimals. Trailing zeros are trimmed, `.` is the decimal point, `,` grouping is optional (checks strip commas), and scientific notation is never used. USD values are rounded half-up to cents.
- **Addresses:** links use `0x` plus 64 lowercase hex digits. Text shows `0x` plus the first 4 hex digits, `…`, and the last 4 (of the 64). From round 3 a verified `.stark` name is shown instead.
- **Messages:** `parse_mode: "HTML"`, with user text escaped (`& < >`, plus `"` in attributes). Link previews are disabled. Messages are split at 4096 UTF-16 units on line boundaries.

**Telegram commands**, registered with `setMyCommands`. Each round adds to the list:

| Round | Commands |
|---|---|
| R1 | `/start` `/help` `/status` `/price` `/balance` `/tx` |
| R2 | `/watch` `/whales` `/min` `/list` `/remove` |
| R3 | `/buyfeed` `/top` `/name` |
| R4 | `/settings` `/digest` `/tz` `/quiet` `/topic` `/guard` `/export` `/forget` |
| R5 | `/alert` `/stakewatch` `/validator` `/netwatch` `/track` |

In groups, every command that changes configuration is admin-only.

### 4.3 Telegram transport (T §2–§9)
- **Long polling only in rounds 1–5.** It is outbound only, the check owns the update queue, and it is how community members self-host (C §1).
  - `allowed_updates` is `["message","callback_query","my_chat_member"]`.
  - An update is confirmed by the next `getUpdates` offset.
  - In `run`, a held poll is aborted with an `AbortController` on SIGTERM.
  - A 409 exits 1 with "another instance is running".
- **Methods by round**
  - R1: `getMe`, `getUpdates`, `sendMessage`, `setMyCommands`, and `deleteWebhook` (optional at start).
  - R2: `getChatMember`.
  - R4: `editMessageText`, `answerCallbackQuery`, `deleteMessage`, and `sendDocument` (the only multipart call).
- **Sending**
  - Rates: one queue per chat at 1 message/s or less, groups at 20 messages/min or less, 25 messages/s or less overall.
  - On 429, wait exactly `retry_after`.
  - On 403, mark the chat inactive.
  - On a 400 that carries `migrate_to_chat_id`, re-key the chat and resend.
- **Privacy mode**
  - Rounds 1–3 and 5 work with privacy mode on.
  - The round 4 guards need the bot to be an admin, because admin bots see all messages.
  - Commands are parsed with `^/(\w+)(@(\w+))?` and ignored when addressed to another bot.
- **Deep links**
  - The `/start` payload must match `^[A-Za-z0-9_-]{1,64}$`; unknown payloads fall back to plain `/start`.
  - Addresses never go in `callback_data` (64-byte limit); use short server-side keys.

### 4.4 Starknet access (S §1)
- **Transport:** HTTP JSON-RPC 0.10 or later, checked at start with `starknet_specVersion`. Version 0.10 adds `event_index` to emitted events, which the dedupe key needs.
  - No WebSockets: free endpoints delivered events unreliably in tests (L), and a fake WebSocket costs about 80 more lines of check code (C §1).
  - No HTTP APIs other than the RPC (no Starkscan, Voyager or AVNU) in rounds 1–5. Prices come only from Pragma on-chain.
- **Block ids:** `"latest"`, `{"block_number":n}` or `{"block_hash":h}`. Never `pending`, which was removed in 0.9, and never `pre_confirmed`. The fake rejects both *(check)*.
- **Alerts come only from `ACCEPTED_ON_L2` blocks.** Blocks average about 1.8 s, so the extra delay is small, and pre-confirmed data can be dropped.

**Methods by round**

| Round | Methods |
|---|---|
| R1 | `starknet_specVersion`, `starknet_chainId`, `starknet_blockNumber`, `starknet_getBlockWithTxHashes` (header: timestamp, `l1_gas_price`, `l2_gas_price`, `l1_data_gas_price`, `sequencer_address`), `starknet_call`, `starknet_getClassHashAt`, `starknet_getTransactionStatus`, `starknet_getTransactionReceipt` |
| R2 | `starknet_getEvents` (one address per filter, `chunk_size` ≤ 1000, page until no `continuation_token`) |
| R3 | `starknet_getTransactionByHash` (`sender_address`). A standard spec method, not in the research's subset list |

The fake answers anything else with `-32601`. Every `starknet_add*` call is recorded as a violation.

**Selectors listed in ARCHITECTURE.md.** These are verified in S §2–§5 and C §0:

| Name | Selector |
|---|---|
| Transfer | `0x0099cd8b…6196e9` |
| `balance_of` | `0x035a73cd…7af33` |
| `balanceOf` | `0x02e4263a…c76e` |
| `decimals` | `0x04c4fb1a…518a9` |
| `symbol` | `0x0216b05c…1ea4` |
| Ekubo `Swapped` | `0x01577177…a870` |
| AVNU `Swap` | `0x00e316f0…ccab` |

The staking event selectors are in S §3.

**Selectors still to compute** with `sn_keccak` and test against mainnet before the round that uses them (unverified):
- `get_data_median` (R1)
- `total_supply` and `totalSupply` (R3)
- `domain_to_address` and `address_to_domain` (R3)
- `staker_pool_info`, `get_pool_member_info_v1`, `get_staker_info_v1`, `get_current_epoch` and `get_last_epoch_attestation_done` (R5)

**Event layouts**
- **Transfer, modern layout** (STRK, ETH, USDC, USDT): `keys=[sel,from,to]`, `data=[low,high]`.
- **Transfer, legacy layout** (USDC.e, WBTC): `keys=[sel]`, `data=[from,to,low,high]`.
- **AVNU `Swap`:** `data=[taker, sell_token, sell_lo, sell_hi, buy_token, buy_lo, buy_hi, beneficiary]`.
- **Ekubo `Swapped`:** 21 data felts.
  - `pool_key.token0` and `token1` are at data[1] and data[2].
  - `delta.amount0` is at data[12..13] and `delta.amount1` at data[14..15], each as (mag, sign) with sign 1 meaning negative.
  - The convention that positive means paid into the pool is **(unverified)**. Confirm it on a recorded mainnet swap before round 3 is written.

**Decoding rules**
- Amounts: value = low + high·2^128, computed with BigInt.
- Cairo `Option`: Some is variant 0 and None is variant 1 (M, confirm with recorded fixtures).
- `symbol`: a single felt is a short string; anything longer is a ByteArray.

**Fee transfers:** a STRK Transfer to the block header's `sequencer_address` is the fee payment and is never alerted. **(unverified, M)** Confirm on a recorded block before round 2's checks.

**RPC hygiene**
- At most `MURMUR_RPC_RPS` requests in any 1 s window.
- Up to 3 attempts, with backoff at 0.5, 1 and 2 s, honouring `Retry-After`. After that, the user gets a "node busy" reply.
- Addresses and hashes are validated (felt below 2^251) before any call.

### 4.5 State
- **Store:** `node:sqlite` (`DatabaseSync`) under `$MURMUR_DATA`. On the pinned image it runs with no flag and no warning (C §0, H). The format belongs to the entry; checks never parse it.
- **Write order:** a change is saved before its confirmation is sent. An alert is marked sent right after Telegram confirms it.
- **What is stored:** chat ids, settings, subscriptions, labels, cursor and last block hash, update offset, delivery ledger (7 days of chain time), buy records (7 days), price samples (24 h).
- **What is never stored:** message text, names, usernames, the token or the RPC URL.

### 4.6 Dependency policy
- **Recommended:** Node.js 24 built-ins only, with no `dependencies` and no `devDependencies`, and a committed `package-lock.json`. Round 1's check enforces this as an allowlist, so it holds forever. See decision D2 for the alternative of an exact `starknet@10.8.0`.
- **Checks:** the vendored kit plus built-ins.
- **Fakes:** both fakes are check-owned and use only `node:http`.
  - The fake Telegram is about 150 lines; round 4 adds multipart parsing through the built-in `Request.formData()`.
  - The fake node is about 190 lines.
  - `trap.mjs`, about 35 lines, is loaded through `NODE_OPTIONS=--import`.
  - Later rounds import these from `../round-1/` (C §2).

### 4.7 Copy out before it is lost
The research prototypes live only in the session scratchpad: `…/scratchpad/tg/verify/fake-bot-api.mjs`, `…/scratchpad/tgprobe/{fakes,probe,probe2,trap}.mjs` and `…/scratchpad/sn-research/rpc.py`, which has a pure-Python keccak and a selector helper. Copy them out now.

---

## 5. Rounds

**Recommended settings** (Toddler Buddy's values): `payout: top3-60-25-15`, `pick: creator-in-judging`, `build_hours: 48`, `reveal_hours: 12`, `rank_hours: 12`.

| n | Title | What it adds | How it is checked | Prize |
|---|---|---|---|---|
| 1 | Core and lookups | Process, config, network file, `/start` `/help` `/status` `/price` `/balance` `/tx`, resilience, security baseline | About 30 tests against the two fakes and the trap; `tick` for exact assertions, a few `run` tests | 7,000,000 |
| 2 | Watches and whale alerts | Chain scanner, transfer alerts in both layouts, whales, admin gate, delivery ledger | Fixture events across blocks, a paged `getEvents`, SIGKILL during a held send, migration and 403 | 7,000,000 |
| 3 | Buy feed and names | Ekubo and AVNU buy pings, leaderboard, `.stark` names everywhere | Recorded swap layouts in the fake node, block-aware balance calls, a fake naming contract | 8,000,000 |
| 4 | Group life | Digest, time zone, quiet hours, settings panel, topics, seed and phishing guards, export and forget | Block timestamps drive time; callback queries; `deleteMessage`; multipart `sendDocument` | 6,000,000 |
| 5 | Holder safety | Price and depeg alerts, staking and validator watch, stall and reorg alerts, `/track`, deploy guide | Staking fixtures, a frozen head, a block-hash change, an unreachable node | 6,000,000 |

The rounds total **34,000,000**, which leaves 1,000,000 under the 35,000,000 cap. Each round's checks are written once the previous round settles, on top of its winner.

### Round 1: Core and lookups (prize 7,000,000)

Build `node murmur.mjs`, a self-hosted Telegram bot that answers Starknet questions in private chats and groups. It reads the chain over JSON-RPC and never signs anything. ARCHITECTURE.md is the specification.

**Commands.**
- `run` long-polls Telegram and the chain until SIGTERM, then exits 0 within 3 s.
- `tick` makes one pass and prints `{"updates","replies","head"}`.
- `doctor` prints `{"bot","chain","block","spec"}`.
- Exit codes are 0, 1, 2 and 3 as in §4.2. A bad env exits 2 with no network call.

**Configuration.** The twelve round-1 variables in §4.2, plus the starter files `networks/SN_MAIN.json` and `networks/SN_SEPOLIA.json`.

**Telegram commands.**
- `/start` and `/help`, including an "Add to group" link.
- `/status`: chain, head block and its time, L1, L2 and data gas prices in FRI.
- `/price [SYMBOL]`: Pragma `get_data_median` for the token's pair, scaled by the returned `decimals`, with the number of sources and the update time. The price is marked stale when it is more than 10 minutes behind the head block. Without a symbol, every token that has a pair.
- `/balance <address>`: `balance_of` on every registry token, falling back to `balanceOf` on `ENTRYPOINT_NOT_FOUND`; exact amounts; "not deployed" when `getClassHashAt` says so.
- `/tx <hash>`: finality, execution status, fee in STRK, block, HTML-escaped revert reason, explorer link.

A bare address or hash pasted in a private chat is tried as a transaction first, then as an address. In groups the bot answers only `/cmd` and `/cmd@<its username>`.

**Ground rules.**
- Every reply is valid Telegram HTML of at most 4096 characters.
- RPC 429 and 5xx are retried, then answered with a "node busy" reply.
- Telegram `retry_after` is honoured, and a 403 skips the chat.
- At most `MURMUR_RPC_RPS` RPC requests a second.
- No write method and no `pending` tag.
- Secrets are never logged, stored, echoed or sent to the other host.
- Only the two configured hosts are contacted.
- State lives only in `MURMUR_DATA`.
- Node.js 24 built-ins only.

Run the checks with `node .launchpad/checks/round-1/run.mjs`.

**Criteria**
- **Usefulness in a group (counts double):** `/price`, `/balance`, `/tx` and `/status` answer what members actually ask, in messages that read well in a busy group.
- **Robustness:** bad input, a slow or failing node and Telegram limits get a clear reply, never a crash.
- **Security and privacy:** secrets flow only where they must, and nothing unneeded is stored.
- **Code quality:** small, readable, no dependency, and ready for round 2's scanner.

**Key checks**
1. a bad command line exits 2 with a reason on stderr and nothing on stdout
2. a missing or malformed token, API root or RPC URL exits 2 and contacts nothing
3. a node on another chain than MURMUR_CHAIN, or older than RPC 0.10, exits 2 naming what it found
4. a bad network file exits 2 naming the bad entry
5. doctor prints the bot's username, the chain, the head block and the RPC version as one JSON line
6. a token Telegram rejects exits 3, and the token appears nowhere in the output
7. tick answers every pending update in order per chat, confirms them and prints its JSON summary
8. a handled update is never answered again, across ticks, restarts and a SIGKILL
9. registers at least the round-1 commands with setMyCommands
10. in groups it answers only commands addressed to it, and ignores plain text and other bots' commands
11. /price scales Pragma's median by its decimals and shows its sources and age, and flags a stale price
12. /status shows the chain, the head block and its time, and the gas prices read from the node
13. /balance prints exact amounts for every registry token, including a u256 above 2^128 and 1 wei
14. /balance falls back to balanceOf, flags an undeployed address, and makes no RPC call for an invalid address
15. /tx shows finality, execution, fee, block, an escaped revert reason and an explorer link built from MURMUR_EXPLORER_URL
16. accepts addresses and hashes in any case and with or without leading zeros, and shows them normalised
17. never uses the pending or pre_confirmed block tag
18. an RPC 429 or 5xx is retried with backoff, then answered with a node-busy reply
19. never sends more RPC requests per second than MURMUR_RPC_RPS
20. a Telegram 429 is retried after retry_after, and the message is sent exactly once
21. a chat that blocked the bot is skipped, and other chats still get their answers
22. every reply is valid Telegram HTML of at most 4096 characters, with user text escaped
23. run answers within 3 s, survives a node that is down for 2 s, and exits 0 within 3 s of SIGTERM during a long poll
24. never calls a Starknet write method
25. the bot token and the RPC URL's secret appear in no output, log, message, data file or request to the other host
26. contacts only TELEGRAM_API_ROOT and STARKNET_RPC_URL
27. writes only inside MURMUR_DATA, a directory of mode 700 with files of mode 600
28. the repository holds no Telegram token or private key, and package.json has no dependency

**How to run it:** `TELEGRAM_BOT_TOKEN=<test bot> STARKNET_RPC_URL=https://starknet-rpc.publicnode.com node murmur.mjs doctor && node murmur.mjs run`. The publicnode endpoint answered on 12 Oct 2026 (S §7).
- C1: in a test group, run `/price`, `/status`, `/balance` on a busy and on an empty address, and `/tx` on a success and on a revert.
- C2: send a bad address, a bad hash and an unknown command; set a wrong RPC URL; then `kill -9` and restart.
- C3: follow the token and the RPC URL through the code; read the data dir and the logs.
- C4: read `murmur.mjs` and its imports, then imagine adding the scanner.

### Round 2: Watches and whale alerts (prize 7,000,000)

The bot starts reading the chain. A scanner follows `ACCEPTED_ON_L2` blocks from a stored cursor with `starknet_getEvents` and alerts chats about Transfer events of registry tokens. Round 1's commands, formats and checks stay.

**Commands.**
- `/watch <address> [label]` adds a watch; a label is at most 32 characters.
- `/whales <SYMBOL> <min>` alerts on every transfer of that token at or above `min`; `/whales <SYMBOL> off` stops it.
- `/min <SYMBOL> <amount>` sets the chat's floor for watch alerts. The default is any non-zero amount.
- `/list` numbers the chat's subscriptions, and `/remove <n|address|label>` deletes one.
- Caps per chat: 20 watches and 5 whale thresholds.
- In groups, everything except `/list` is admin-only. The sender's `getChatMember` status must be `creator` or `administrator`, or the message must be posted as the group itself (an anonymous admin).

**Scanning.**
- A subscription covers only blocks after the head the bot had read when it handled the command.
- Each poll scans at most `MURMUR_MAX_BLOCKS` blocks after the cursor. It filters each token by key `[[Transfer]]` and pages until no `continuation_token` is returned.
- Both layouts are parsed: from and to sit in the keys when there are 3 keys, and in the data when there is 1.
- Zero amounts and fee payments (STRK sent to the block's `sequencer_address`) are never alerted.

**Alerts.**
- One message per chat per transaction, in chain order. Each matching transfer shows the token, the exact amount, the direction, the counterparty, the watch label and a tx link.
- A send that Telegram has not confirmed is retried after a restart. A confirmed send is never repeated; the key is (transaction hash, `event_index`).
- `tick` adds `"alerts"` and `"cursor"` to its JSON line.

**Chats that change.**
- On `migrate_to_chat_id`, the chat's subscriptions move to the new id and the failed message is resent there.
- A 403 pauses the chat until it writes to the bot again or re-adds it.
- Each user may send at most 10 commands per 60 s of `message.date`, with one notice when the limit is hit.

**Criteria**
- **Signal over noise (counts double):** alerts are worth reading. Each is grouped per transaction, carries no dust or fee spam, and makes the direction, counterparty and label clear.
- **Reliability:** no missed alerts and no doubled ones, across restarts, kills and outages.
- **Admin experience:** setting up group watches and whale alerts is obvious, and members cannot change them.
- **Code quality:** round 1's clients reused; ready for round 3's event decoders.

**Key checks**
1. /watch alerts on incoming and outgoing transfers of every registry token, in both event layouts
2. transfers in one transaction reach a chat as one alert, with exact amounts, direction, counterparty and label
3. nothing is alerted for events in blocks up to the head read when the watch was added
4. zero-amount transfers and fee payments to the sequencer are never alerted, and /min filters smaller transfers
5. pages through getEvents until the continuation token runs out
6. scans at most MURMUR_MAX_BLOCKS per poll and catches up over later polls without a gap
7. an alert whose send was cut by a SIGKILL is sent after restart, and a confirmed alert is never sent twice
8. /whales alerts once for each transfer at or above the threshold, and stops on off
9. only group admins, including anonymous admins, can add, change or remove subscriptions; members get a refusal
10. /list and /remove by number, address or label
11. a chat at its cap is refused one more subscription
12. a group upgraded to a supergroup keeps its subscriptions under the new id and gets the alert there
13. a chat that returns 403 gets no more alerts until it writes again, and other chats are unaffected
14. a user over the command rate limit is ignored after one notice, measured by message dates

**How to run it:** watch a busy mainnet address you pick from the explorer, and set `/whales STRK 50000` in a test group.
- C1: read an hour of alerts in the group.
- C2: `kill -9` while alerts are flowing, restart, and compare with the explorer.
- C3: set things up as an admin, then try the same as a member.
- C4: read how the scanner is separated from the watchers.

### Round 3: Buy feed and names (prize 8,000,000)

This is the feature groups add a bot for: a ping for every buy of the group's token, carrying the buyer's `.stark` name. Earlier rounds stay. The network file gains `ekubo_core`, `avnu_exchange` and `naming`.

**`/buyfeed <SYMBOL|address> [min_usd]`**
- Admin-only in groups, one token per chat.
- `/buyfeed off` stops it. `/buyfeed sells on|off` toggles sell pings, which are off by default.
- A token outside the registry is read from its contract: `symbol` (short string or ByteArray), `decimals`, and `total_supply` or `totalSupply`.

**Detection, per transaction.**
- If the transaction has an AVNU `Swap` buying or selling the token, that is the trade, and its `beneficiary` is the trader.
- Otherwise the token's net Ekubo pool delta over the transaction decides:
  - paid out by the pools: a buy
  - paid in: a sell
  - zero (routed through): nothing
- In the Ekubo case, the tokens paid in are the price, and the trader is the transaction's `sender_address`.
- An AVNU swap routed through Ekubo produces one ping, not two.

**The ping**
- Amount bought and amount paid.
- USD value, from the paid token's Pragma pair or the token's own pair.
- Buyer.
- "New holder", when the buyer's `balance_of` in the previous block was zero.
- Market cap, as the implied USD price times total supply; left out when unknown.
- A size bar and a tx link.

Buys under `min_usd` are skipped. Buys with no USD value are posted only when `min_usd` is 0.

**`/top [24h|7d]`** lists the 10 biggest buyers by amount bought over that window of chain time, ending at the head block. Ties go to whoever bought first. Buy records are kept 7 days.

**Names.**
- `/name <name>.stark` uses `domain_to_address`, and `/name <address>` uses `address_to_domain`, with an empty hint. Labels are encoded in base 38 per ARCHITECTURE.md, with test vectors from starknetid.js 5.0.0. The edge rules are **(unverified)**.
- Every command that takes an address accepts a `.stark` name.
- Buy pings, whale alerts and transfer alerts show a name only when it resolves back to the same address.

**Criteria**
- **Group feel of the buy feed (counts double):** a ping is readable at a glance, scales with buy size, and suits a busy group without flooding it.
- **Accuracy:** amounts, USD, buyer, new-holder flag and market cap match the chain.
- **Names and leaderboard:** `.stark` names and `/top` make members recognisable without exposing anything off-chain.
- **Code quality:** the decoders reuse round 2's scanner and ledger.

**Key checks**
1. an AVNU swap buying the feed token gives one ping with amount bought, amount paid, USD value and the beneficiary as buyer
2. a direct Ekubo swap gives one ping from net pool deltas, with the transaction sender as buyer
3. an AVNU swap routed through Ekubo gives one ping, not two, and a multi-hop swap through the token gives none
4. sells are posted only after /buyfeed sells on
5. buys under min_usd are skipped, and buys without a USD price pass only when min_usd is 0
6. a buyer whose balance was zero in the previous block is marked as a new holder
7. market cap is the implied USD price times total supply, and is omitted when supply cannot be read
8. a token outside the registry is read from its contract, whether its symbol is a short string or a ByteArray
9. /top ranks the 10 biggest buyers of the last 24 h or 7 d of chain time
10. /name resolves a .stark name to an address and back, and every command taking an address accepts a name
11. a reverse name that does not resolve back to the same address is never shown
12. only an admin can set, change or stop a group's buy feed

**How to run it:** `/buyfeed STRK 100` in a test group on mainnet. Ekubo logged 942 swaps in 500 blocks (S §5).
- C1: watch the feed for 30 minutes on phone and desktop.
- C2: compare five pings with the explorer.
- C3: try `/top` and `/name` on a few known names.
- C4: read how the decoders sit on the scanner.

### Round 4: Group life (prize 6,000,000)

Turn a stream of alerts into something a busy group reads, give admins one panel, and protect members. Time is chain time.

**Time.**
- `/tz <Area/City>` sets the chat's zone; IANA names only, default UTC.
- `/digest <HH:MM> [only]` sends one digest a day, at the first block at or after that local time. It covers the previous 24 hours:
  - counts and totals per alert kind
  - the biggest transfer
  - buys and the top buyer
  - the feed token's price change
- With `only`, live alerts are held and folded into the digest. `/digest off` stops it.
- `/quiet <HH:MM-HH:MM>` holds alerts whose block falls inside the window and sends one summary at the first block after it. `/quiet off` stops it.

**`/settings`**
- Shows the chat's settings with inline buttons.
- `callback_data` is `s:<key>:<value>`, with the keys fixed in ARCHITECTURE.md and at most 64 bytes.
- A press edits the panel in place (handling "message is not modified") and is answered exactly once with `answerCallbackQuery`.
- A non-admin's press is refused and changes nothing.
- `/topic`, sent inside a forum topic, routes the chat's alerts there through `message_thread_id`.

**Guards.** On by default in groups; switched with `/guard seed|links on|off`.
- **Seed phrases:** a message holding 12 or more BIP-39 English words in a row (list numbering ignored) is deleted with `deleteMessage`. The bot answers with a warning that repeats none of the words.
- **Phishing links:** a `url` or `text_link` entity whose host is, or sits under, a domain in `MURMUR_BLOCKLIST` is deleted, with a warning. The starter list holds starknet-bot.com, app-stark.online and starknet.portal-drops.icu (L §3).
- Without the right to delete, the bot still warns, and `/settings` names the right it needs.

**Data rights.**
- `/export` sends `murmur-<chat id>.json` with `sendDocument`. It holds the settings and every subscription, in the shape ARCHITECTURE.md fixes; later rounds add keys.
- `/forget` deletes everything stored for the chat.
- Both are admin-only in groups.

**Criteria**
- **Admin control (counts double):** an admin configures everything from `/settings` in a minute, and members cannot change anything.
- **Calm groups:** digests and quiet hours turn alert streams into something people read.
- **Member safety:** guards catch seed phrases and listed links with no false alarms, and never repeat the secret.
- **Code quality:** time handling stays on chain time, and earlier rounds are reused.

**Key checks**
1. /digest sends one summary per chat per day at the local time, measured by block timestamps, and only holds live alerts
2. alerts during quiet hours are held and sent as one summary at the first block after the window
3. /tz accepts IANA zone names and refuses anything else
4. /settings buttons carry data of at most 64 bytes, each press is answered exactly once and the panel is edited in place
5. a member pressing a settings button is refused and nothing changes
6. /topic sends later alerts to that forum topic
7. a message with 12 or more BIP-39 words in a row is deleted and answered with a warning that repeats none of them
8. ordinary paragraphs, addresses and hashes never trigger the seed guard
9. a link to a blocklisted domain or its subdomain is deleted with a warning, and other links are untouched
10. without delete rights the bot still warns, and /settings says which right it needs
11. /export sends the chat's data as a JSON document in the documented shape
12. after /forget and a restart, the chat has no subscriptions, settings or alerts, and /forget in a group is admin-only

**How to run it:** set `/tz`, set `/digest` a few minutes ahead and a short `/quiet` window, then open `/settings` as an admin and as a member. Post a *generated* test phrase, never a real one, and a link to a listed domain.
- C1: configure a group from `/settings` alone.
- C2: read a digest and a quiet-hours summary.
- C3: paste ten normal messages and the two traps.
- C4: read how the held alerts and the digests share the delivery code.

### Round 5: Holder safety (prize 6,000,000)

Alerts for the moments holders lose money by not knowing: a price crossing, a validator that stops attesting, a stalled or reorganised chain. The network file gains `staking` and `attestation`. ARCHITECTURE.md records the deployed ABI subset and the layouts from mainnet, because the docs' staking tables are stale (S §0).

**Prices.**
- `/alert <SYMBOL> above|below <usd>` fires once when Pragma's median crosses the level. It re-arms after the price moves back past the level by 1%.
- `/alert <SYMBOL> move <pct>` fires when the price has moved by that percentage against a sample at least 60 minutes of chain time old, then rests for 60 minutes.
- A price more than 10 minutes behind the head fires nothing.
- Up to 10 alerts per chat, all listed in `/list`.

**Staking.**
- `/stakewatch <delegator> <validator>` shows the delegator's amount, unclaimed rewards, commission and pending exit across the validator's pools (`staker_pool_info`, `get_pool_member_info_v1`). It refuses an address that is not a member.
- At each new epoch (`get_current_epoch`), it alerts once each:
  - if the validator did not attest in the epoch that ended (`get_last_epoch_attestation_done`)
  - if the commission changed
  - if the validator signalled exit (`unstake_time` is set)
- It alerts once when the chain time passes the delegator's `unpool_time`.
- It reminds every 7 days of chain time while rewards are unclaimed.
- `/validator <staker> <min STRK>` alerts on missed attestations, and when the operational account's STRK balance falls below the minimum.

**Network.**
- `/netwatch on|off`.
- A head that stays unchanged for `MURMUR_STALL_SECONDS` (wall clock) gives one stall alert. The next block gives one recovery alert with the downtime.
- An unreachable node notifies only `MURMUR_OPERATOR_CHAT`.
- Every poll checks the stored hash of the last scanned block. On a mismatch the bot:
  - finds the fork point and rescans
  - tells netwatch chats the reorg depth
  - replies once to every alert whose transaction left the chain
- `/track <hash>` reports L2 acceptance or a revert, then L1 acceptance. A transaction that vanishes, or is not included within 300 blocks, is reported as dropped.

The README adds a Dockerfile, a systemd unit, BotFather setup and how to choose an RPC.

**Criteria**
- **Holder safety value (counts double):** staking, price and network alerts arrive when they matter, and each says what to do next.
- **Honest under failure:** stalls, recoveries and reorgs are each reported once, and corrections are clear.
- **Operability:** a community member can deploy from the README alone.
- **Code quality:** the new watchers fit the scanner and delivery code from earlier rounds.

**Key checks**
1. /alert above and below fire once on crossing and re-arm only after a 1% move back
2. /alert move fires when the price moved by the percentage against a 60-minute-old sample of chain time
3. a stale Pragma price fires no alert
4. /stakewatch shows the delegator's position and refuses an address that is not a member of the validator's pools
5. a validator that did not attest in an epoch gives one alert to each chat watching it
6. a commission change and a validator's exit intent are each alerted once
7. a delegator's exit is alerted once when the chain time passes its unpool time
8. /validator alerts when the operational account's STRK balance falls below the threshold
9. a head that stalls for MURMUR_STALL_SECONDS gives one stall alert, and the next block one recovery alert with the downtime
10. an unreachable node notifies only MURMUR_OPERATOR_CHAT, never subscribers
11. a reorg is found by block hash and rescanned, and each alert for a transaction that left the chain gets one correction replying to it
12. /track reports L2 acceptance or revert, L1 acceptance, and a vanished transaction as dropped

**How to run it:** `/stakewatch` a real delegator and validator pair from the explorer, `/alert STRK above` just over the current price, then `/netwatch on`.
- C1: read the staking and price alerts as a holder would.
- C2: point `STARKNET_RPC_URL` at a closed port, and read the stall and reorg checks' messages.
- C3: deploy from the README with Docker or systemd.
- C4: read how the new watchers sit on the scanner.

---

## 6. Risks and open decisions

| # | Decision or risk | Recommended default | Notes / confidence |
|---|---|---|---|
| D1 | Name and handle | **Murmur**, handle without "stark"/"starknet" | Trademark and handle availability unknown; check before the repo goes public |
| D2 | Dependency policy (round 1's allowlist holds forever) | **Zero runtime dependencies.** Alternative: exactly `starknet@10.8.0` | M. Reasons for zero: a crypto bot built by anonymous agents; fake-repo malware (L §3); starknet.js major-version churn and hidden RPC calls (C §6); every selector can be a constant. The cost: about 60 hand-written lines for Starknet ID encoding and ByteArray, and later token gating (F42) needs SNIP-12/Poseidon hashing. If gating is wanted within this project, allow starknet.js now |
| D3 | Prize split | **7 / 7 / 8 / 6 / 6 = 34M** | Under the 35M cap. Alternative: 4 rounds with round 5 dropped (28M) |
| D4 | Round 1 too big for one sitting | Keep as specified; fallback is to move paste-lookup (F10) and the RPS test to round 2 | C §8 calls round 1 the largest; its `run.mjs` is about 800–1,000 lines plus about 350 lines of fakes |
| D5 | Facts not yet verified that checks depend on | Settle each before writing that round's checks: fee transfer to `sequencer_address` (R2); Ekubo delta sign (R3); the computed selectors (R1/R3/R5); Starknet ID edge rules, with starknetid.js vectors (R3); staking return layouts, recorded from mainnet (R5); BIP-39 wordlist licence (R4); USDT and BTC-wrapper Pragma pairs (R1 starter file) | Each is marked (unverified) above |
| D6 | Staking v3 / Starknet v0.15 landing mid-project | Write round 5's checks against the ABI that is live when round 4 settles | The September 2026 target slipped, with no new date (S §1). v3 could rename the entrypoints round 5 uses |
| D7 | Minimum RPC version | **0.10 required** | `event_index` is needed for dedupe. Some providers serve 0.9 at the root (ZAN); the README points to `/rpc/v0_10`. Blast and Lava public endpoints are gone (S §7) (H) |
| D8 | Alert finality | **`ACCEPTED_ON_L2` only, never pre-confirmed** | Costs about 2 s of latency and avoids dropped-transaction alerts (S §1) (H) |
| D9 | Hosted instance | **Self-host first.** After round 3 merges, the creator may run one mainnet instance labelled community-run, on a paid RPC key | A hosted instance links Telegram ids to watched wallets, and Telegram can hand IPs and phone numbers to authorities (L §3) (H). It also draws spam and RPC cost |
| D10 | Abuse through public group adds | Nothing posts until an admin configures it; caps; rate limits; whales need an explicit threshold | Prevents the bot from becoming a spam vector |
| D11 | Buy feed and leaderboard read as hype or advice | Neutral pings; `/top` ranks by amount only; no trending, no cross-group rankings, no calls; a disclaimer in `/help` | Admins choose their own token. The bot does not judge tokens until `/scan` (later) |
| D12 | Privacy of DM watchlists | Store only chat id plus address and label; provide `/forget` and `/export`; no names stored | Rubric-checked each round; principle 5 |
| D13 | Telegram policy drift | No Mini App ever; any future signing page is a plain URL button; no paid features in the core | Telegram's Mini App rule is H; the Stars rule for paid features is M |
| D14 | Earlier checks clashing with later features | Round 1's tests use innocuous plain text, assert a superset in `setMyCommands`, ignore unknown `tick` keys, and use an obviously unknown command | Every round re-runs all earlier checks |
| D15 | Webhook vs polling | **Long polling for all 5 rounds**; webhook is F48, later | The bot is a long-running self-hosted process; Hotpod being on Vercel does not apply |
| D16 | Judges' setup | Each judge uses their own BotFather test bot, a throwaway group and the public mainnet RPC | Safe because the bot is read-only |
| D17 | STRK20 shielded flows | `/help` says shielded transfers are invisible; viewing keys are never accepted | Trackers see only flows into and out of the pool (L §3) (M) |
| D18 | Licence | **MIT** | The Unruggable bot, Starky and StarknetFeed are MIT (L §1) |
| D19 | Research prototypes lost with the scratchpad | Copy the fakes and `rpc.py` (paths in §4.7) into the creator's private workspace now | The round 1 reference implementation stays unpublished |