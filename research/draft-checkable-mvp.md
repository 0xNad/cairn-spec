# Cairn: a read-only Starknet bot for Telegram, built in rounds on Hotpod

Spec v0.1, 2026-10-12. Approach: checks come first. Status: draft for the project creator.

**Source keys.**
- [L] the landscape research
- [S] the Starknet technical reference
- [T] the Telegram Bot API reference
- [C] the checkability design note
- [V] facts I re-checked on mainnet today for this spec, using `starknet-rpc.publicnode.com` (Juno, spec 0.10.3) and the keccak helper from the research folder

Confidence is stated as high, moderate, low or unknown.

---

## 1. Name, pitch, personas

**Name: Cairn** (working name). A cairn is a pile of stones that marks a trail and warns walkers. That is the bot's job on Starknet, and the word also sounds like Cairo.

I avoided two kinds of name:
- "StarkBot", because an AI DeFi bot with that name already exists (@starkbotapp) [L§1].
- Any name built on "Stark" or "Starknet". Those are likely marks of StarkWare and the Starknet Foundation. I have not checked their trademark status.

No trademark search was run on "Cairn" (unknown). Fallback names: Kestrel, Feltwatch.

**Pitch.** Cairn is an open-source Telegram bot for Starknet that you host yourself. It covers six jobs:
- It looks up balances and transactions.
- It alerts you when a watched wallet moves funds or grants a token approval.
- It posts token buys and large transfers ("whale" moves) in project groups.
- It tells delegators when their validator misses an epoch or when their unstaked tokens unlock.
- It warns everyone when the chain stalls or reorganises, and corrects alerts that a reorg made false.

It is read-only by design:
- It never holds a key, never signs, and never asks for a seed phrase.
- It has no Mini App, so it stays inside Telegram's exemption for plain bots on chains other than TON (https://core.telegram.org/bots/blockchain-guidelines) [L§TL;DR, T§0].

To run it you need one Node.js process, two secrets (a bot token and an RPC URL), and no database server. After every round it is a bot you can actually use.

**One-line pitch for `.launchpad/project.md`:** A read-only Telegram bot for Starknet that you host yourself: lookups, wallet and approval alerts, group buy and whale feeds, staking reminders and chain-stall warnings, with no keys, no Mini App and no custody.

| Persona | Job to be done | What Cairn gives them | Why they would add it (evidence) |
|---|---|---|---|
| **H: Holder** (self-custody wallet user) | Know when their money moves or a spender gets approval | Direct-message alerts for watched wallets, `/balance`, `/tx`, `/track` | Cielo, DeBank and Zerion do not cover Starknet. Forum users have asked for this since 2023 [L§4.7]. Braavos sends push alerts only for its own wallet [L§1] |
| **A: Community admin** (token, project and DAO groups, including Hotpod's own community once it launches on Starknet) | Show live on-chain activity in the group without spam | Buy feed, whale alerts, admin-only settings | No Starknet buy bot was found [L§4.1]. On other chains every group that installs such a bot spreads it [L§2]. StarkWare's Trading Guild recruits traders on Telegram, which makes it a likely pilot group [L§5] (moderate) |
| **D: Delegator** | Not miss rewards, unlocks or a validator that stopped working | `/staking`, `/stakewatch`, missed-epoch and unlock alerts | Rewards must be claimed by hand. An epoch without an attestation pays nothing, and an exit takes 7 days [S§3]. About 1.54B STRK is staked [S§3, V] |
| **V: Validator operator** | Keep liveness above the delegation-program thresholds | Missed-attestation and low-operational-balance alerts | Track A requires 99% liveness and Track B 99.5% [L§1]. A May 2026 forum guide says uptime data is hard to find [L§4.3] |
| **B: Builder** | Follow a transaction and know when the chain is down | `/tx`, `/track`, stall and reorg alerts | Outages on 2 Sep 2025 (about 9 h, two reorgs) and 5 Jan 2026 (about 4 h, a revert). The community learned of them from independent bots [L§1, L§4.4] |
| **O: Operator** (whoever runs an instance: a person, a DAO, Hotpod) | Run it unattended, safely and cheaply | One process, environment-only secrets, health endpoint, failover | It holds no keys, so it is not custody (MiCA reading, moderate [L§3]). It contacts no hosts except the ones configured |

---

## 2. Product principles and non-goals

**Principles** (each one is enforced by a check where that is possible):

1. **Read-only, no custody.** Cairn never calls any `starknet_add*` method, never holds key material, and never builds a signing link in rounds 1 to 5. Custodial bots account for the Maestro, Unibot, Banana Gun, Solareum, Nova and SIGMA losses [L§3] (high). *Check:* the fake node records any write method as a violation.
2. **A plain bot.** No Mini App, no `web_app` or `login_url` buttons, no wallet connection, no Stars payments [T§0, T§1] (high).
3. **Facts, not advice.** Alerts state what happened on-chain. Cairn offers no recommendations, predictions, "trending" lists, rankings of tokens, or buy/sell buttons. `/help` says "on-chain facts, not financial advice". *Rubric.*
4. **Opt-in and bounded noise.** Cairn writes only to chats that started it or added it. It has no broadcast command. Group settings belong to admins. There are caps per chat and per user, and a message budget per group. *Check.*
5. **Privacy by keeping little.** Cairn stores chat ids, settings, watches, the update offset and delivery keys. It never stores message text, usernames or display names. `/export` and `/forget` exist from round 2. The README warns that an operator can link a Telegram chat to a wallet address. *Check and rubric.*
6. **Only configured hosts.** Cairn contacts only `TELEGRAM_API_ROOT` and the RPC URL(s). It has no telemetry, no fallback public RPC, and no price API. A new host can only be added as an opt-in `*_URL` variable that is off when unset. *Check, through a network trap.*
7. **The chain is the clock.** "Now" means the timestamp of the latest block Cairn has read, and per-user rate limits use `message.date`. The only feature that uses the wall clock is stall detection in round 5 [C§1]. *Check:* tests move time by adding blocks.
8. **The interface is frozen in round 1, and later rounds only add.** Commands, environment variables, file formats and JSON shapes are never renamed or removed. *Check:* every round re-runs all earlier checks.

**Non-goals.** Out for good unless the creator reverses one explicitly:
- custodial trading, sniping, MEV, copy trading that executes on its own
- importing keys or seed phrases
- STRK20 viewing keys
- airdrop farming and sybil tooling
- paid "trending" slots and volume bots
- custodial tipping
- a free-text AI agent that signs
- a new general anti-spam engine
- a project token or paid tier
- multiple chains

Out of rounds 1 to 5, possibly later:
- signing links, which would come only after wallets agree on the session-key SNIP [L§1, S§6]
- token-gated groups

Sources for these exclusions: [L§7, S§6].

---

## 3. Feature list

**Personas:** H holder, A group admin, D delegator, V validator, B builder, O operator.

**Checked by:**
- *check* means a test in the round's `run.mjs` runs it.
- *rubric* means judges assess it.
- *check + rubric* means a test checks that it works and judges assess the copy or design.

| id | Feature | Command or trigger | Persona | Round | Priority | Checked by |
|---|---|---|---|---|---|---|
| F01 | Setup self-test | `node cairn.mjs doctor` | O | 1 | must | check |
| F02 | One pass or long-running | `node cairn.mjs tick`, `node cairn.mjs run` | O | 1 | must | check |
| F03 | Configuration validation with exit codes | environment, network file | O | 1 | must | check |
| F04 | Onboarding and help; command menu | `/start`, `/help`, `setMyCommands` | all | 1 | must | check + rubric |
| F05 | Chain status | `/status` | B, H | 1 | must | check |
| F06 | Balance lookup over the token registry | `/balance <address>` | H | 1 | must | check |
| F07 | Transaction lookup | `/tx <hash>` | H, B | 1 | must | check |
| F08 | Group command addressing | `/cmd@bot` in groups | A | 1 | must | check |
| F09 | Resilience: RPC retry and backoff, RPC requests-per-second cap, Telegram 429, 403 | automatic | O | 1 | must | check |
| F10 | Secret hygiene, host allowlist, file modes | automatic | O | 1 | must | check |
| F11 | Starter network files (SN_MAIN, SN_SEPOLIA) | `networks/*.json` | O | 1 | must | check (well-formed) + rubric (accuracy) |
| F12 | Wallet watch list | `/watch <address> [label]`, `/unwatch`, `/list` | H, A | 2 | must | check |
| F13 | Transfer alerts in and out, both event layouts | automatic | H | 2 | must | check + rubric |
| F14 | Approval alerts (watched owner), "unlimited" flag | automatic | H | 2 | should | check |
| F15 | Transaction tracking to L2 acceptance, L1 acceptance or revert | `/track <hash>` | B, H | 2 | must | check |
| F16 | Paste to look up, with Watch and Track buttons | paste in a private chat | H | 2 | should | check |
| F17 | Delivery exactly once across restarts and kills | automatic | all | 2 | must | check |
| F18 | Admin-only settings in groups | `getChatMember` | A | 2 | must | check |
| F19 | Data rights | `/export`, `/forget` | H, A | 2 | must | check |
| F20 | Group-to-supergroup migration keeps watches | `migrate_to_chat_id` | A | 2 | should | check |
| F21 | Per-chat watch cap | `CAIRN_MAX_WATCHES` | O | 2 | must | check |
| F22 | Token buy and sell feed (Ekubo and AVNU), netted per transaction | `/feed <SYMBOL> [min] [buys\|all]`, `/unfeed` | A | 3 | must | check + rubric |
| F23 | Whale transfer alerts, with mints and burns labelled | `/whale <SYMBOL> <min>`, `/unwhale` | A | 3 | must | check |
| F24 | Price and USD values from the Pragma oracle | `/price <SYMBOL>`; values shown in pings | H, A | 3 | should | check |
| F25 | Starknet ID names: `.stark` accepted as input and shown for addresses | any address argument; display | all | 3 | should | check |
| F26 | Group message budget (bursts summarised) | automatic | A | 3 | must | check |
| F27 | Per-user command rate limit | automatic | A, O | 3 | should | check |
| F28 | Staking position (delegator or validator) | `/staking <address> [validator]` | D, V | 4 | must | check + rubric |
| F29 | Staking watch | `/stakewatch …`, `/unstakewatch` | D, V | 4 | must | check |
| F30 | Missed-attestation alert, once per epoch | automatic | D, V | 4 | must | check |
| F31 | Commission change and validator exit-intent alerts | automatic | D | 4 | must | check |
| F32 | Unclaimed-rewards reminder | `min=` on a staking watch | D | 4 | should | check |
| F33 | Unlock complete (7-day exit window over) | automatic | D | 4 | must | check |
| F34 | Low operational balance for a validator | `low=` on a staking watch | V | 4 | should | check |
| F35 | Quiet hours with a digest at the end | `/quiet HH:MM-HH:MM`, `/quiet off` | H, A | 4 | should | check |
| F36 | Chain stall and recovery alerts | `/network on\|off` | B, A | 5 | must | check + rubric |
| F37 | Reorg detection and corrected alerts | automatic | all | 5 | must | check |
| F38 | Confirmation depth | `CAIRN_CONFIRMATIONS` | O | 5 | should | check |
| F39 | RPC failover | `STARKNET_RPC_URLS` | O | 5 | must | check |
| F40 | Health and metrics endpoint | `CAIRN_HTTP_PORT` | O | 5 | should | check |
| F41 | Seed-phrase guard (delete and warn) | automatic | all | 5 | should | check |
| F42 | Deploy guide (BotFather, choosing an RPC, Docker, systemd) | README | O | 5 | must | rubric |
| F43 | Webhook mode with a secret-token header | `CAIRN_WEBHOOK_*` | O | later | could | check (feasible [C§1]) |
| F44 | Governance alerts: Snapshot X proposals opening and closing; "your delegate has not voted" | opt-in `CAIRN_SNAPSHOT_URL` | H, D | later | should | check (fake GraphQL server) |
| F45 | Lending health factor and oracle-deviation alerts (Vesu, Nostra) | — | H | later | should | the protocols' ABIs have not been researched |
| F46 | Price-threshold, depeg and LST-ratio alerts | — | H | later | could | check |
| F47 | Token-gated groups (join requests plus a signature on an external page) | — | A | later | could | needs a web page and SNIP-12 hashing |
| F48 | Ekubo position out-of-range alerts | — | LPs | later | could | check |
| F49 | Guest-mode `@bot price` (Bot API 10.0) | — | all | later | could | check |
| F50 | Managed per-project bots (Bot API 9.6) | — | A | later | could | — |
| F51 | History CSV export for tax tools | — | H | later | could | check |
| F52 | Signing links for swaps or staking (the user signs on an external page) | — | H | later | could | only after the session-key SNIP converges |
| F53 | Phishing-domain link filter | — | A | later | could | check |
| F54 | Custodial trading, sniping, copy-trade execution | — | — | out | — | — |
| F55 | Telegram Mini App of any kind | — | — | out | — | — |
| F56 | Importing keys or seed phrases; STRK20 viewing keys | — | — | out | — | — |
| F57 | Paid trending, volume bots, Stars paid tier | — | — | out | — | — |
| F58 | Free-text AI agent that signs | — | — | out | — | — |
| F59 | Airdrop farming and sybil automation | — | — | out | — | — |

---

## 4. Architecture

### 4.1 Shape

Cairn is one Node.js process. Each pass does the same steps, in this order:

```
pass():
  1. updates: getUpdates from saved offset+1 → handle commands → save state
  2. head:    starknet_getBlockWithTxHashes("latest") → chain time = head.timestamp
  3. scan:    blocks (cursor, min(head − CONFIRMATIONS, cursor + MAX_BLOCKS)] → events → alerts saved as pending
  4. periodic: once-per-epoch staking reads (R4); stall and reorg checks (R5)
  5. deliver: pending alerts → sendMessage → marked sent only after ok; release digests (R4)
  6. save the cursor; confirm the offset
run  = pass every CAIRN_POLL_MS, long-polling getUpdates in between
tick = one pass with getUpdates timeout 0, then print the summary line
```

On the first start the cursor is set to the head, so Cairn does not backfill old blocks.

**Suggested modules.** Entrants choose their own internal structure; only the interface in 4.2 to 4.10 is fixed.

| Module | Job |
|---|---|
| `cli` | parse the command, dispatch |
| `config` | read environment and network file, validate |
| `telegram` | fetch client, long poll, send queue that honours `retry_after`, HTML escaping, splitting long text |
| `rpc` | JSON-RPC client, timeouts, backoff, requests-per-second limiter, failover |
| `decode` | u256, the two Transfer layouts, Approval, Ekubo `Swapped`, AVNU `Swap`, staking structs, Pragma result, names |
| `scan` | cursor, event paging, catch-up bound |
| `alerts` + `ledger` | alert records, deduplication, delivery state |
| `store` | persistence |
| `format` | amounts, addresses, times, links |
| `commands/*` | one handler per command |

### 4.2 Fixed files

| File | Purpose |
|---|---|
| `cairn.mjs` | entry point |
| `networks/SN_MAIN.json`, `networks/SN_SEPOLIA.json` | network files (4.5) |
| `wordlists/bip39-english.txt` | round 5 |
| `ARCHITECTURE.md` | the specification the checks follow to the letter, including the layouts in 4.9 |
| `README.md`, `.env.example` | placeholders that do not match the token pattern, e.g. `TELEGRAM_BOT_TOKEN=123456:replace-me` |
| `package.json`, `package-lock.json` | lockfile only if `starknet` is used |
| `LICENSE` | MIT recommended (see section 6) |

### 4.3 Commands and exit codes

```
node cairn.mjs run      # until SIGTERM or SIGINT, then exit 0 within 3 s (abort an in-flight long poll)
node cairn.mjs tick     # one pass; prints ONE line: {"updates":<n>,"sent":<n>,"head":<n>|null}
node cairn.mjs doctor   # getMe, starknet_chainId, starknet_blockNumber, starknet_specVersion
                        # prints ONE line: {"bot":"<username>","chain_id":"SN_MAIN","block":<n>,"spec":"0.10.3"}
```

- `sent` counts the messages Telegram accepted.
- In `tick`, an unreachable node gives `"head":null`, replies that say the node is busy, and exit 0.
- Later rounds may add keys to these JSON lines. They never rename or remove one.

| Exit code | Meaning |
|---|---|
| 0 | ok |
| 1 | Telegram unreachable (any command), or the node unreachable (`doctor` only). The reason goes to stderr and state stays consistent |
| 2 | bad command line or configuration, detected before any network call; a node on another chain; RPC endpoints that disagree on the chain (round 5). Reason on stderr, nothing on stdout |
| 3 | Telegram rejected the token (401). This is separate from 1 so a supervisor does not restart in a loop |

### 4.4 Environment variables

Secrets come only from the environment, never from flags, because flags show up in `ps` [C§1]. A value out of range exits 2.

| Variable | Round | Default | Rule |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | 1 | required | `^\d+:[A-Za-z0-9_-]{30,}$`; secret |
| `TELEGRAM_API_ROOT` | 1 | `https://api.telegram.org` | http(s) origin, no path, no trailing slash |
| `STARKNET_RPC_URL` | 1 | required | http(s) URL; secret, since providers put keys in the path. Logs show only its origin |
| `CAIRN_NETWORK` | 1 | `SN_MAIN` | `SN_MAIN` or `SN_SEPOLIA`; must match `starknet_chainId` (0x534e5f4d41494e or 0x534e5f5345504f4c4941 [S§1]) |
| `CAIRN_NETWORK_FILE` | 1 | `networks/<CAIRN_NETWORK>.json` next to `cairn.mjs` | 4.5 |
| `CAIRN_DATA` | 1 | `./data` | created with mode 700, files 600; nothing written anywhere else |
| `CAIRN_EXPLORER_URL` | 1 | `https://voyager.online` | used to build links only, never fetched |
| `CAIRN_POLL_MS` | 1 | 10000 | at least 50; checks use 100 |
| `CAIRN_TG_TIMEOUT` | 1 | 30 | long-poll seconds in `run`; checks use 1 |
| `CAIRN_RPC_RPS` | 1 | 5 | maximum RPC calls in any 1 s window; each call in a batch counts |
| `CAIRN_RPC_TIMEOUT_MS` | 1 | 10000 | checks use 1500 |
| `CAIRN_LOG` | 1 | `info` | `error`, `warn`, `info` or `debug`; JSON lines on stderr |
| `CAIRN_MAX_BLOCKS` | 2 | 500 | blocks scanned per pass |
| `CAIRN_MAX_WATCHES` | 2 | 20 | watches per chat |
| `STARKNET_RPC_URLS` | 5 | unset | comma-separated failover list; when set it replaces `STARKNET_RPC_URL` |
| `CAIRN_CONFIRMATIONS` | 5 | 0 | scan this many blocks behind the head |
| `CAIRN_STALL_SECONDS` | 5 | 120 | stall threshold |
| `CAIRN_REORG_DEPTH` | 5 | 64 | block hashes kept, and the maximum walk-back |
| `CAIRN_HTTP_PORT` | 5 | unset (off) | `0` means any free port, logged as `{"event":"http","port":n}` |
| `CAIRN_HTTP_HOST` | 5 | `127.0.0.1` | bind address |

### 4.5 Network file

Example:

```json
{"chain_id":"SN_MAIN",
 "tokens":[{"symbol":"STRK","address":"0x04718f5a…c938d","decimals":18,"pragma_pair":"STRK/USD"}],
 "contracts":{"ekubo_core":"0x…","avnu_exchange":"0x…","pragma":"0x…","naming":"0x…","staking":"0x…","attestation":"0x…"}}
```

Validation rules:
- Round 1 validates `chain_id` and `tokens` and ignores every other key. A bad entry exits 2 and names its index.
- `symbol` must match `^[A-Za-z0-9.]{1,11}$` and be unique, ignoring case.
- `address` must be a valid address (4.9) and unique once normalised.
- `decimals` is an integer from 0 to 36.
- `pragma_pair` (round 3) must match `^[A-Z0-9]{1,10}/[A-Z0-9]{1,10}$`.
- From round 3, a missing contract switches its feature off, and the bot replies saying so. It does not exit 2. This lets the Sepolia file work without DEX contracts.

**Starter values.** All are from the research; [V] marks the ones I re-checked today.

| Key | SN_MAIN | SN_SEPOLIA |
|---|---|---|
| STRK (18) | 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d [S§2, V] | same |
| ETH (18) | 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7 [S§2] | same |
| USDC (6, native) | 0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb [S§2, V] | 0x512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343 |
| USDC.e (6, legacy layout) | 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8 [S§2, V] | 0x53b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080 |
| USDT (6) | 0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8 [S§2] | — |
| WBTC (8, legacy layout) | 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac [S§2, V] | — |
| tBTC (18), SolvBTC (18), strkBTC (8): added in R4 | 0x4daa17763b286d1e59b97c283c0b8c949994c361e426a28f743c67bdfe9a32f [V]; 0x593e034dda23eea82d2ba9a30960ed42cf4a01502cc2351dc9b9881f9931a68 [V]; 0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135 [S§3] | — |
| `ekubo_core` (R3) | 0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b [S§5, V] | not researched |
| `avnu_exchange` (R3) | 0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f [S§5] | not researched |
| `pragma` (R3) | 0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b [S§5, V] | 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a |
| `naming` (R3) | 0x06ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678 [S§4, V] | the research value has only 60 hex digits: **verify** |
| `staking` (R4) | 0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7 [S§3, V] | 0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1 |
| `attestation` (R4) | 0x10398fe631af9ab2311840432d507bf7ef4b959ae967f1507928f5afe888a99 [S§3, V] | 0x03f32e152b9637c31bfcf73e434f78591067a01ba070505ff6ee195642c9acfb |

The tBTC and SolvBTC addresses come from today's `staker_pool_info` output [V].

Checks always write their own network file pointing at fake contracts. The only check on the committed files is that they are well-formed and contain at least the symbols listed. Accuracy of the real addresses is a rubric item [C§8].

### 4.6 Data directory and persistence

- **Recommended:** `node:sqlite` at `$CAIRN_DATA/state.db`. It works in the runner's Node v24.20.0 with no flag and no warning [C§0]. It is transactional and survives SIGKILL in WAL mode.
- **Also allowed:** a JSON file written to a temporary file, fsynced, then renamed.
- **Not allowed:** `better-sqlite3`, because it is a native binary and only adds 27 MB [C§3].
- **The format is the entrant's own.** Checks never parse it. They check behaviour:
  - state survives a restart and a SIGKILL;
  - "a change is saved before its confirmation is sent";
  - directory mode 700 and file modes 600;
  - no file is written outside `CAIRN_DATA` (the check snapshots the entry tree, HOME and TMPDIR before and after);
  - neither secret appears in any file;
  - no fixture user's name or username appears in any file (from round 2).

### 4.7 Output conventions

These are fixed so that checks can match exactly. Before comparing, checks strip tags, unescape entities and remove commas from numbers.

- **Logs:** stderr only, one JSON object per line, with at least `level` and `event`. Never the token, never the RPC path or query.
- **Messages:**
  - always `parse_mode: "HTML"`;
  - at most 4096 UTF-16 units after entity parsing; longer replies are split at line breaks;
  - every string from outside (labels, revert reasons, names, symbols) is escaped: `&`, `<`, `>`, and `"` inside attributes [T§4].
- **Amounts:** an exact decimal computed with BigInt, trailing zeros trimmed, `.` as the decimal point, `,` grouping allowed in the integer part, then a space and the symbol (`1,234.5 STRK`). Fees in FRI are shown in STRK (FRI ÷ 10^18).
- **Addresses:** padded to 64 hex digits in lower case. Shown as `0x` plus the first 4 digits, `…`, and the last 4 digits. Linked as `${CAIRN_EXPLORER_URL}/contract/0x<64 hex>`. A label (R2) or a `.stark` name (R3) may replace the short form.
- **Transactions:** linked as `${CAIRN_EXPLORER_URL}/tx/0x<64 hex>`. Voyager's path format is moderate confidence.
- **Times:** `YYYY-MM-DD HH:MM:SS UTC`.
- **Commission:** in the contract 10,000 means 100% [S§3]; shown as a percentage with up to 2 decimals (1000 → `10%`).
- **Gas prices:** the exact FRI integer.

### 4.8 Telegram transport

- **Requests:** `POST ${TELEGRAM_API_ROOT}/bot${TOKEN}/<method>` with a JSON body. Never hard-code `api.telegram.org` [T§10].
- **Updates:** long polling only in rounds 1 to 5. Never call `setWebhook`.
- **Offsets:**
  - `getUpdates` uses `offset` = last handled `update_id` + 1, and `timeout` = `CAIRN_TG_TIMEOUT` in `run` or 0 in `tick`.
  - `tick` ends by confirming: `getUpdates{offset:last+1,limit:1,timeout:0}`.
  - A handled update is never handled twice, even across restarts [T§2, C§4].
- **`allowed_updates`:** round 1 uses `["message"]`; round 2 adds `"callback_query"` and `"my_chat_member"`.
- **Bot API methods.** This is the complete list for all rounds. Any other method gets a 404 from the fake and fails a test.

  | Round | Methods |
  |---|---|
  | R1 | `getMe`, `deleteWebhook`, `getUpdates`, `sendMessage`, `setMyCommands`, `sendChatAction` |
  | R2 | `answerCallbackQuery`, `editMessageText`, `getChatMember` |
  | R5 | `deleteMessage` |

- **Groups:**
  - Cairn answers `/cmd` and `/cmd@<username from getMe>` and ignores `/cmd@other_bot` and plain text [T§5].
  - In groups, admin rights mean `getChatMember` returns status `creator` or `administrator`.
- **Buttons:** `callback_data` is `<verb>:<server id>`, at most 64 bytes, and never contains a full address (an address is 66 characters, while `callback_data` allows 64 bytes [T§0]). Every `callback_query` is answered exactly once.
- **Telegram errors:**

  | Error | Handling |
  |---|---|
  | 429 | wait `retry_after`, then resend that message exactly once |
  | 403 | mark the chat inactive and keep going |
  | 400 with `migrate_to_chat_id` | move the chat's data to the new id and resend (R2) |
  | 400 "message is not modified" | ignore |
  | 401 | exit 3 |

### 4.9 Starknet access

- **Transport:** HTTP JSON-RPC polling only. A fake WebSocket server would cost about 80 lines, and free WSS event delivery tested unreliable [S§1, C§1]. Cairn targets spec 0.10, and `doctor` prints the node's version. Round 2 needs a 0.10 node, because `event_index` arrived in 0.10.0 [S§1]. Today's publicnode (0.10.3) returns `event_index` and `transaction_index` [V].
- **Block ids:** only `"latest"`, `{"block_number":n}` or `{"block_hash":h}`. Never `"pending"` (removed in 0.9 [S§1]) or `"pre_confirmed"`. The fake rejects both with -32602.
- **Validating input:**
  - an address is `0x` plus 1 to 64 hex digits in any case, with 0 < v < 2^251 − 256 [S§2];
  - a hash is a felt with 0 < v < P = 2^251 + 17·2^192 + 1;
  - values are compared only after padding;
  - u256 = low + high·2^128, computed with BigInt.
- **Node errors.** Codes are from spec 0.10.4 [V]:

  | Code | Meaning | Cairn's response |
  |---|---|---|
  | 20 | contract not found | "not deployed" |
  | 21 | entry point not found | fall back to `balanceOf` |
  | 24 | block not found | — |
  | 29 | transaction hash not found | "not found" |
  | 33 | invalid continuation token | — |
  | 40 | contract error | an error for that one token only |
  | HTTP 429, 5xx, timeout | — | backoff of at least `Retry-After`, 3 tries |

**RPC methods by round:**

| Round | Methods |
|---|---|
| 1 | `starknet_chainId`, `starknet_specVersion`, `starknet_blockNumber`, `starknet_getBlockWithTxHashes`, `starknet_call`, `starknet_getClassHashAt`, `starknet_getTransactionStatus`, `starknet_getTransactionReceipt` |
| 2 | `starknet_getEvents`, `starknet_blockHashAndNumber` |
| 3 | `starknet_getTransactionByHash` (`sender_address`) |
| 4 | `starknet_call` only, on the staking and attestation contracts |
| 5 | `starknet_getBlockWithTxHashes` by number, to compare hashes |

**Header fields used by `/status`:** `timestamp`, `l1_gas_price.price_in_fri`, `l2_gas_price.price_in_fri` [V].

**Event layouts.** Each layout is decided by `keys.length`.

| Event | Layout | Status |
|---|---|---|
| `Transfer` (modern: STRK, ETH, USDC, USDT) | keys `[sel, from, to]`, data `[low, high]` | [S§2] high |
| `Transfer` (legacy: USDC.e, WBTC) | keys `[sel]`, data `[from, to, low, high]` | [S§2] high |
| `Approval` | same split, owner and spender in place of from and to | [V]: STRK and USDC have 3 keys and 2 data; USDC.e and WBTC have 1 key and 4 data |
| Ekubo `Swapped` | keys `[sel]`; 21 data felts: 0 locker; 1 token0; 2 token1; 3 fee; 4 tick_spacing; 5 extension; 6–7 params.amount (mag, sign); 8 is_token1; 9–10 sqrt_ratio_limit; 11 skip_ahead; **12–13 delta.amount0 (mag, sign); 14–15 delta.amount1 (mag, sign)**; 16–17 sqrt_ratio_after; 18–19 tick_after; 20 liquidity_after | indexes derived from the layout in [S§5]. Sign: positive means paid into the pool, sign 1 means paid out to the swapper. Consistent with one multi-hop transaction checked today [V] (moderate) |
| AVNU `Swap` | keys `[sel]`; data `[taker, sell_token, sell_low, sell_high, buy_token, buy_low, buy_high, beneficiary]` | [S§5] high |

**Call layouts.** Cairo `Option` is encoded as tag 0 = Some, 1 = None [V].

| Call | Calldata | Result felts | Status |
|---|---|---|---|
| `staking.get_current_epoch()` | — | `[epoch]` (13,592 today) | [V] |
| `staking.staker_pool_info(staker)` | `[staker]` | `[comm_tag, comm?, n, (pool_contract, token, amount)×n]`; sample `[0x0, 0x3e8, 0x5, …]` | [V] |
| `staking.get_staker_info_v1(staker)` | `[staker]` | `[tag, reward_addr, operational_addr, unstake_tag, unstake_s?, amount_own, unclaimed_own, pool_tag, pool_contract?, amount?, commission?]` | [V] |
| `pool.get_pool_member_info_v1(member)` | `[member]` | `[tag, reward_addr, amount, unclaimed_rewards, commission, unpool_amount, unpool_tag, unpool_s?]` | [V] |
| `attestation.get_last_epoch_attestation_done(staker)` | `[staker]` | `[epoch]` | [V] |
| `pragma.get_data_median(SpotEntry)` | `[0x0, shortstring("STRK/USD")]` | `[price, decimals, last_updated_ts, num_sources, exp_tag, exp]`. Decimals are 8 for STRK/USD and ETH/USD, 6 for USDC/USD | [V] |
| `naming.domain_to_address` | `[1, encode(label), 0]` | `[address]` | [V] for starknet, ben, fricoben, vitalik |
| `naming.address_to_domain` | `[address, 0]` | `[n, label…]` | [V] |

Starknet ID notes:
- `encode` is base 38, little-endian, over `abcdefghijklmnopqrstuvwxyz0123456789-` [S§4].
- **Unverified:** the starknetid.js special rule for a name ending in "a", subdomains, and what an unknown name returns.

**Selectors.** Computed with sn_keccak. Each one matched the research or returned data on mainnet today [V]. `ARCHITECTURE.md` lists them so that no entry needs keccak, which `node:crypto` does not provide [C§0].

```
Transfer                         0x0099cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9
Approval                         0x0134692b230b9e1ffa39098904722134159652b09c5bc41d88d6698779d228ff
balance_of                       0x035a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33
balanceOf                        0x02e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e
Swapped (Ekubo)                  0x0157717768aca88da4ac4279765f09f4d0151823d573537fbbeb950cdbd9a870
Swap (AVNU)                      0x00e316f0d9d2a3affa97de1d99bb2aac0538e2666d0d8545545ead241ef0ccab
get_data_median                  0x0024b869ce68dd257b370701ca16e4aaf9c6483ff6805d04ba7661f3a0b6ce59
domain_to_address                0x02e269d930f6d7ab92b15ce8ff9f5e63709391617e3465fff79ba6baf278ce60
address_to_domain                0x038b679fb029cc3f953635ed16ae4123da8214e726943920ba7706a0473e326a
staker_pool_info                 0x027aca223b48bc87a94edf580fbe4ad386c81bb31f6810b3dcfa60bf65f8f7f8
get_staker_info_v1               0x01ffac027da63178bc6dfbc131df9716162b4369e8e023533c792bbfa5ae2b22
get_pool_member_info_v1          0x00a0ec7d248e7cac7ad635c76ae431955a3ded9d7d9da3f80ee03c5c2383d9bf
get_current_epoch                0x03beab8392e2cc92168265cc5aa060880965965816c1cbaf14549912838c9896
get_last_epoch_attestation_done  0x02bb03b5ea47189033e304a516edc6e44fdc7cb118253be200677182ec4c46bd
```

### 4.10 Dependency policy

- The runtime is Node.js 24 (the runner has v24.20.0 [C§0]).
- `package.json` `dependencies` must be either empty or exactly `{"starknet": "<exact version ≥ 10.8.0>"}`.
- No version ranges, no other packages, no `devDependencies`.
- The round 1 check enforces this, and every later round re-runs that check, so the rule is frozen.
- The version floor allows security upgrades: starknet.js versions 7 to 9 are end-of-life, and on 28 Sep 2026 the project published three high-severity advisories about its paymaster and SNIP-12 code [S§6, S§7].
- Telegram libraries are not allowed. A `fetch` long-poll loop is about 60 lines, and grammY would not take care of 429s on `sendMessage` anyway [C§6].

### 4.11 Check harness, and rules that keep earlier checks valid

The fakes live in `run.mjs` and its folder, listen on loopback with `listen(0)`, and use Node built-ins only.

**Fake Telegram** (about 150 to 170 lines [C§2]):
- returns 401 on a wrong token;
- validates HTML strictly, enforces the 4096 limit and `callback_data` of at most 64 bytes;
- implements `getUpdates` with offset confirmation and requests held for up to 1 s;
- can inject 429 with `retry_after`, 403, 400 with `migrate_to_chat_id`, and a `hold` for kill tests;
- records every call.

**Fake node** (about 220 to 260 lines):
- a chain model of blocks, contracts, transactions and events;
- `getEvents` returns **at most 5 events per page** with a continuation token;
- accepts batches and both named and positional parameters;
- returns spec error codes and rejects `pending` and `pre_confirmed`;
- can inject 429, 503, timeouts, garbage and a node that is down;
- `reorg(fromBlock, newBlocks)` for round 5;
- records any `starknet_add*` call as a violation.

**`trap.mjs`** (about 35 lines), passed as `NODE_OPTIONS=--import=…`, logs DNS lookups and `net`/`tls` connections [C§0, C§2].

Compatibility rules, so that round n's winner keeps passing rounds 1 to n−1:
1. **The round 1 fakes already serve every method any round uses**: the full Bot API list in 4.8 and every RPC method in 4.9, with empty or plausible answers.
2. **Checks assert "at least"** for anything later rounds grow: the command list, help text, JSON keys, network-file keys.
3. **Checks look only at calls about the input under test**, never at total call counts, because later rounds add background scanning.
4. **Unknown-command tests use `/zz_unknown`**, a name no round will claim.
5. **No round adds an outbound host** except through an opt-in `*_URL` variable that is off when unset.
6. **Each round copies the fakes into its own folder** and extends the copy. Earlier folders never change.

Sizing and timing:
- Round 1's `run.mjs` will be about 800 to 1,000 lines. Toddler Buddy's round 1 was 584 [C§2].
- Set `timeoutSeconds: 300`.
- About 80% of tests use `tick`, which needs no sleeps.
- `run` tests use a barrier (send `/status` and wait for its reply) rather than a quiet window [C§4].
- Ordering is checked only within a chat.

---

## 5. Rounds

**Suggested front matter:**

```
title: Cairn
payout: top3-60-25-15
pick: creator-in-judging
build_hours: 48
reveal_hours: 12
rank_hours: 12
```

| n | Title | What it adds | How it is checked | Prize | Reference build (my estimate, low confidence) | Usable bot after the round |
|---|---|---|---|---|---|---|
| 1 | Lookups | Frozen interface, `tick`/`run`/`doctor`, `/status` `/balance` `/tx`, resilience, security baseline | About 26 tests against fake Telegram, fake node and trap | 7,000,000 | 5–7 h | A private Starknet lookup bot |
| 2 | Wallet alerts | Watches, transfer and approval alerts, `/track`, buttons, exactly-once delivery, admin gating, `/export` `/forget` | Event fixtures in both layouts, paging, kill during send, restarts | 7,000,000 | 5–7 h | Personal wallet alerts, the top-ranked gap [L§6] |
| 3 | Group feeds | Ekubo and AVNU buy feed, whale alerts, Pragma USD, `.stark` names, group message budget, rate limits | Swap fixtures (direct, aggregator, multi-hop, arbitrage), fake Pragma and naming contracts | 6,000,000 | 4–6 h | A buy and whale bot for project groups |
| 4 | Stakers and quiet hours | `/staking`, staking watches, missed attestation, commission and exit, unlocks, reward reminders, quiet hours | Fake staking and attestation contracts across epochs and chain time | 6,000,000 | 4–6 h | A staking monitor for delegators and validators |
| 5 | Network guard and operations | Stall and recovery alerts, reorg corrections, confirmations, failover, `/healthz` `/metrics`, seed-phrase guard, deploy guide | Old head timestamps, fake reorgs, two fake nodes, HTTP probes | 6,000,000 | 4–6 h | An instance a community can run unattended |

**Total: 32,000,000 points**, which leaves 3,000,000 under the 35,000,000 cap for a fix-up or bonus round.

### Round 1: Lookups

**Summary.** Build `node cairn.mjs`, a plain Telegram bot (no Mini App) that answers Starknet lookups and never writes to the chain. `ARCHITECTURE.md` is the specification, and the checks follow it to the letter.

- **Commands:**
  - `run` long-polls Telegram and polls the chain until SIGTERM or SIGINT, then exits 0 within 3 s.
  - `tick` drains pending updates (`getUpdates` with `timeout` 0 until it returns nothing), reads the head once, saves state, confirms the offset and prints `{"updates":n,"sent":n,"head":n|null}`.
  - `doctor` prints `{"bot","chain_id","block","spec"}`.
  - Exit codes: 0 ok; 1 unreachable; 2 bad command line or configuration (before any network call) or a chain mismatch; 3 token rejected.
- **Configuration** comes only from the environment: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ROOT`, `STARKNET_RPC_URL`, `CAIRN_NETWORK`, `CAIRN_NETWORK_FILE`, `CAIRN_DATA`, `CAIRN_EXPLORER_URL`, `CAIRN_POLL_MS`, `CAIRN_TG_TIMEOUT`, `CAIRN_RPC_RPS`, `CAIRN_RPC_TIMEOUT_MS`, `CAIRN_LOG`. Commit `networks/SN_MAIN.json` (ETH, STRK, USDC, USDC.e, USDT, WBTC) and `networks/SN_SEPOLIA.json`.
- **Chat:**
  - `/start` and `/help`.
  - `/status`: chain, head block, its UTC time, L1 and L2 gas prices in FRI.
  - `/balance <address>`: `balance_of`, falling back to `balanceOf`, on every registry token in order; exact u256 amounts; "not deployed" when `starknet_getClassHashAt` returns error 20.
  - `/tx <hash>`: finality, execution status, block, fee in STRK, revert reason, explorer link.
  - A bad address or hash is refused with a reason before any call about it.
  - In groups, only `/cmd` and `/cmd@<bot>` are answered.
  - Every message is Telegram HTML of at most 4096 characters, with every outside string escaped.
- **Robustness:**
  - RPC 429, 5xx and timeouts are retried with backoff up to 3 tries, then answered with a "node busy" reply.
  - At most `CAIRN_RPC_RPS` requests per second.
  - A Telegram 429 is honoured with `retry_after`, and the message is sent exactly once.
  - A chat that blocked the bot is skipped.
- **Security:**
  - no `starknet_add*`;
  - only the two configured hosts;
  - secrets never appear in output, logs, messages or files;
  - `CAIRN_DATA` has mode 700 and its files 600;
  - runtime dependencies are none, or only `starknet` at an exact version ≥ 10.8.0.

**Criteria:**
- Usefulness of replies (**counts double**): `/status`, `/balance` and `/tx` tell a Starknet user what they need at a glance, with exact amounts and working explorer links
- Robustness: every bad input, flaky node and Telegram error gets a reason a user or operator can act on, and nothing crashes
- Security posture: secrets, hosts and data are handled as the brief says, including in places the checks cannot see
- Code quality: small, readable modules, ready for round 2's scanner and delivery ledger

**Key checks:**
1. A bad command line or configuration exits 2 with a reason on stderr, nothing on stdout, and no network call.
2. A node on a chain other than `CAIRN_NETWORK` exits 2, naming both chains.
3. A bad network file exits 2, naming the bad token entry.
4. `doctor` prints the bot's username, the chain, the head block and the RPC spec version as one JSON line.
5. A token Telegram rejects exits 3, and the token appears nowhere in the output.
6. `tick` answers every pending update, in order within each chat, and prints its JSON summary.
7. A handled update is never answered twice, across ticks and restarts.
8. It registers at least its own commands with `setMyCommands`.
9. In groups it answers only commands addressed to it, and ignores plain text and other bots' commands.
10. `/status` shows the chain, the head block, its UTC time and both gas prices read from the node.
11. `/balance` calls `balance_of` on every registry token in order and prints exact amounts, including a u256 above 2^128 and a balance of 1 wei.
12. `/balance` falls back to `balanceOf` and flags an undeployed address.
13. `/balance` or `/tx` with an invalid address or hash explains why and makes no call about it.
14. `/tx` shows finality, execution status, block, fee and an explorer link, plus an HTML-escaped revert reason.
15. It never uses the `pending` or `pre_confirmed` block tag.
16. An RPC 429 or 5xx is retried with backoff, then answered with a "node busy" reply.
17. It never sends more RPC requests in one second than `CAIRN_RPC_RPS`.
18. A Telegram 429 is retried after `retry_after`, and the message is sent exactly once.
19. A chat that blocked the bot is skipped, and other chats still get their answers.
20. Every message is valid Telegram HTML of at most 4096 characters.
21. `run` answers within 3 s, survives a node that is down for 2 s, and exits 0 within 3 s of SIGTERM, even during a long poll.
22. It never calls a Starknet write method, and contacts only the two configured hosts.
23. The bot token and the secret in the RPC path appear in no output, log, message, data file or request to the other host.
24. It writes only inside `CAIRN_DATA`, a directory of mode 700 with files of mode 600.
25. The repository holds no Telegram token or private key, and runtime dependencies are only the allowed ones.
26. The committed network files are well-formed, and SN_MAIN lists at least ETH, STRK, USDC, USDC.e, USDT and WBTC.

**How to run it (for judges):** `TELEGRAM_BOT_TOKEN=… STARKNET_RPC_URL=… CAIRN_NETWORK=SN_SEPOLIA node cairn.mjs doctor && node cairn.mjs run`, using a BotFather test bot.
- C1: `/start`, `/status`, `/balance` on a busy address and an empty one, `/tx` on a success and a revert.
- C2: a bad address, a bad hash and a wrong RPC URL, then kill and restart.
- C3: read where the token and RPC URL flow, then grep the logs.
- C4: imagine adding `/watch`.

### Round 2: Wallet alerts

**Summary.** Cairn watches wallets for a chat and delivers every alert exactly once. Round 1's commands, formats and checks stay as they are.

- **Commands:**
  - `/watch <address> [label]` (a label of up to 32 characters), `/unwatch <address|label>`.
  - `/list`: each watch with a Remove button.
  - `/track <hash>`, `/export`, `/forget`.
  - In a private chat, a pasted address gets the `/balance` reply with a Watch button, and a pasted hash gets the `/tx` reply with a Track button.
  - In groups, `/watch`, `/unwatch` and `/forget` need `creator` or `administrator` status from `getChatMember`.
- **Alerts:**
  - A registry-token `Transfer` into or out of a watched address, in either layout.
  - An `Approval` whose owner is watched, with the amount, or "unlimited" when the amount is 2^128 − 1 or more.
  - One alert per chat, transaction hash and `event_index`.
  - A transfer between two addresses watched in the same chat gives one alert naming both.
  - Nothing from blocks at or before the head at the time the watch was added.
- **Scanning:**
  - `starknet_getEvents`, paged until the last `continuation_token`.
  - At most `CAIRN_MAX_BLOCKS` (500) blocks per pass, and `CAIRN_MAX_WATCHES` (20) watches per chat.
  - Needs a JSON-RPC 0.10 node.
- **Delivery:**
  - An alert is saved before it is sent, and marked sent only after Telegram accepts it. After a kill every alert arrives, and none arrives twice once accepted.
  - `/track` posts L2 acceptance (with execution status and fee), then L1 acceptance, or the revert.
  - It says "not found" after 600 s of chain time. At most 10 tracked transactions per chat.
- **Telegram:**
  - Adds `answerCallbackQuery`, `editMessageText` and `getChatMember`.
  - `callback_data` stays within 64 bytes and never contains a full address.
  - A 403 pauses the chat until it sends `/start`.
  - `migrate_to_chat_id` moves the chat's watches to the new id.
- **Data rights:**
  - `/export` replies with `<pre>{"chat":…,"watches":[{"address","label","since_block"}],"tracks":[…]}</pre>`.
  - `/forget` deletes all of it.
  - Only chat ids, settings, watches and delivery keys are stored.

**Criteria:**
- Alert quality (**counts double**): an alert says what moved, how much, between whom and where to check, and a busy wallet does not bury the reader
- Delivery correctness: no lost alerts and no duplicates through restarts, kills, node outages and paging
- Privacy: only what the brief allows is stored, `/export` is complete, and `/forget` leaves nothing behind
- Code quality: round 1 reused; the scanner and ledger are ready for round 3's feeds

**Key checks:**
1. After `/watch`, `/list` shows the address and label, and `/unwatch` by address or by label removes it.
2. It alerts a received and a sent transfer for a modern-layout token and for a legacy-layout token, with exact amounts.
3. It alerts an approval granted by a watched address, and says "unlimited" for an amount of at least 2^128 − 1.
4. A transfer between two addresses watched in the same chat gives one alert naming both.
5. It sends nothing for transfers in blocks at or before the block where the watch was added.
6. It reads every page of `getEvents` and scans at most `CAIRN_MAX_BLOCKS` per pass.
7. After a SIGKILL during a send, every alert arrives, and none arrives twice once Telegram accepted it.
8. `/track` reports L2 acceptance with execution status and fee, then L1 acceptance, or a revert with its reason.
9. A pasted address or hash in a private chat gets its lookup with a Watch or Track button, and every button press is answered exactly once.
10. In groups only administrators can change watches, and a refusal says why.
11. It refuses a watch beyond `CAIRN_MAX_WATCHES`.
12. `/export` lists everything stored for the chat as JSON, and after `/forget` the export is empty.
13. A group upgraded to a supergroup keeps its watches under the new chat id.
14. A chat that blocked the bot gets no alerts until it sends `/start` again.
15. No fixture user's name or username appears in any data file.

**How to run it (for judges):** on Sepolia, watch two of your own addresses, send STRK between them and approve a spender.
- C1: read the alerts as a busy holder would.
- C2: kill the bot during a burst and restart it.
- C3: `/export`, then `/forget`, then inspect `CAIRN_DATA`.
- C4: imagine adding a swap feed.

### Round 3: Group feeds

**Summary.** Project groups get a token feed and whale alerts, with names and prices. Earlier rounds stay as they are.

- **Commands:**
  - Admins only in groups: `/feed <SYMBOL> [min] [buys|all]`, `/unfeed <SYMBOL>`, `/whale <SYMBOL> <min>`, `/unwhale <SYMBOL>`.
  - For everyone: `/price <SYMBOL>`.
  - Minimums are token amounts.
  - The network file gains `contracts.ekubo_core`, `contracts.avnu_exchange`, `contracts.pragma`, `contracts.naming` and a `pragma_pair` per token. A missing contract switches its feature off, and the bot replies saying so.
- **Feed rule, per transaction:**
  - **With AVNU.** If the AVNU exchange emitted `Swap` events, the token's net amount is Σ`buy_amount` where it is the `buy_token`, minus Σ`sell_amount` where it is the `sell_token`. The trader is the last `beneficiary`, and Ekubo events in that transaction are ignored.
  - **Without AVNU.** The net amount is the sum of the token's Ekubo `Swapped` deltas, where sign 1 means paid out of the pool (bought). The trader is the transaction's `sender_address`, from `starknet_getTransactionByHash`.
  - **Result.** A net amount above zero is a buy. Below zero is a sell, posted only with `all`. Zero posts nothing.
  - **Ping content:** side, exact amount, approximate USD value, trader, venue and transaction link.
- **Whales:** a `Transfer` of the token at or above the minimum; mints (from 0) and burns (to 0) are labelled.
- **Prices:** `get_data_median(SpotEntry(pair))` on Pragma, applying the `decimals` in the response. A price older than 1 hour of chain time is marked stale.
- **Names:**
  - `name.stark` is accepted wherever an address is (`domain_to_address`).
  - Addresses with a reverse name (`address_to_domain`) are shown by that name.
  - `ARCHITECTURE.md` gives the encoding with test vectors.
- **Volume:**
  - At most 3 feed or whale messages per group per pass; the rest go into one summary.
  - A user's commands beyond 10 in 60 s of `message.date` get one "slow down" reply and are then ignored.

**Criteria:**
- Group fit (**counts double**): pings are short, accurate and readable in a busy group, and bursts never flood it
- Decoding correctness: buys, sells, aggregator routes, multi-hop and arbitrage transactions are counted as the brief defines
- Names and prices: they appear where they help, and fail quietly when a contract has none
- Code quality: round 2's scanner reused for swaps and whales

**Key checks:**
1. An Ekubo swap that pays the feed token out of the pool is posted as a buy, with the exact amount and the transaction sender as buyer.
2. An AVNU route is posted once, from its `Swap` event, with its beneficiary, and the Ekubo hops in the same transaction are not posted again.
3. A transaction that buys and sells the same amount of the token posts nothing.
4. Sells are posted only with `all`, and swaps below the minimum are skipped.
5. A ping shows a USD value from Pragma's median, using the decimals in its response.
6. `/price` shows the median, its time, and says when it is stale.
7. A transfer at or above the whale minimum is posted, with mints and burns labelled.
8. More than 3 pings in one pass become 3 messages and one summary.
9. `/watch` accepts a `name.stark`, and alerts show the name of any address that has one.
10. An unknown name is refused with a reason, and no watch is added.
11. Only administrators can set or remove a feed or a whale alert.
12. A user's commands beyond 10 a minute get one "slow down" reply and are then ignored.

**How to run it (for judges):** a mainnet test group with `/feed STRK 1000` and `/whale STRK 1000000`.
- C1: watch an hour of pings.
- C2: compare five pings with the explorer.
- C3: `/watch` a `.stark` name; check `/price` against Pragma.
- C4: imagine adding a third DEX.

### Round 4: Stakers and quiet hours

**Summary.** Delegators and validators see their position and get the alerts the protocol otherwise makes them watch for by hand. Earlier rounds stay as they are.

- **`/staking <address> [validator]`:**
  - **Validator** (when `get_staker_info_v1` returns Some): own stake, unclaimed own rewards, commission, pools, operational address and its STRK balance, last attested epoch, and exit time if any.
  - **Delegator with its validator:** for each pool from `staker_pool_info`, read via `get_pool_member_info_v1`: amount, unclaimed rewards, commission, pending unpool amount and unlock time.
  - **Delegator without a validator:** told how to name one, because no on-chain lookup lists a delegator's pools [S§3].
- **Other commands:** `/stakewatch <address> [validator] [min=<STRK>] [low=<STRK>]`, `/unstakewatch <address>`, `/quiet <HH:MM-HH:MM>` (UTC) and `/quiet off`.
- **Network file:** gains `contracts.staking` and `contracts.attestation`. SN_MAIN gains tBTC, SolvBTC and strkBTC.
- **Alerts** are read once per epoch per watch (when `get_current_epoch` changes) and checked against chain time on every pass:
  - **Missed attestation:** `get_last_epoch_attestation_done` is below the epoch that just ended ("that epoch pays no rewards").
  - **Commission change and validator exit intent,** with old and new values.
  - **Unclaimed rewards** at or above `min`, at most once per 7 days of chain time.
  - **Unlock complete,** at the first block whose timestamp reaches `unpool_time`.
  - **Operational balance below `low`** (default 10 STRK), sent once until the balance recovers.
- **Quiet hours:** alerts inside the window are held, saved, and sent in order as one digest when the window ends, split at 4096 characters.

Cairn never prepares, links or signs a staking transaction. The unlock alert names `exit_delegation_pool_action`, and the user's wallet does the rest. `ARCHITECTURE.md` lists each call's felt layout as verified on mainnet (4.9), and the fake contracts in the checks return exactly those layouts.

**Criteria:**
- Staker usefulness (**counts double**): a delegator or validator learns what changed, what it costs them and what to do next, without being told what to buy or sell
- Correctness on chain time: epochs, unlocks, reminders and quiet hours fire once, at the right block
- Noise control: digests and reminders keep alerts few and complete
- Code quality: staking reads sit cleanly beside rounds 2 and 3

**Key checks:**
1. `/staking` of a validator shows its own stake, commission as a percentage, its pools and its last attested epoch.
2. `/staking` of a delegator with its validator shows each pool's amount, unclaimed rewards and pending unlock.
3. `/staking` of a delegator without a validator explains how to name one, and makes no pool calls.
4. A validator that did not attest in the epoch that just ended triggers one alert per watching chat.
5. A commission change and an exit intent are each alerted once, with old and new values.
6. An unlock alert arrives at the first block whose timestamp reaches `unpool_time`, and only once.
7. An unclaimed-rewards reminder fires at the threshold, and not again within 7 days of chain time.
8. A low operational balance is alerted once, until it recovers.
9. Outside commands, staking contracts are read at most once per epoch per watch.
10. Alerts inside quiet hours arrive as one digest when the window ends, in order, and none is lost across a restart.
11. It never calls a write method and never sends a signing link.

**How to run it (for judges):** on mainnet, run `/staking` on a known validator and on one of its delegators, then `/stakewatch` both overnight with `/quiet` set.
- C1: read as a delegator.
- C2: compare with the contracts' values.
- C3: read the morning digest.
- C4: imagine Staking v3 entrypoints.

### Round 5: Network guard and operations

**Summary.** Cairn says when the chain itself misbehaves, corrects itself after reorgs, and runs unattended. Earlier rounds stay as they are.

- **Network alerts:**
  - `/network on|off` subscribes a chat (admins only in groups).
  - **Stall:** if the latest block's timestamp is more than `CAIRN_STALL_SECONDS` (120) behind the wall clock on two passes in a row, subscribed chats get one "stalled since" alert.
  - **Recovery:** when blocks resume, they get one "recovered" alert with the stall's length.
  - This is the only place the wall clock counts.
- **Reorgs:**
  - Cairn keeps the hashes of the last `CAIRN_REORG_DEPTH` (64) processed blocks.
  - When the node's hash for one of them differs, Cairn walks back to the common ancestor and rescans.
  - For each alert it sent from a replaced block whose transaction the node no longer finds, it sends one correction as a reply to that alert.
  - A re-included transaction gets no correction and no second alert.
  - Subscribed chats are told which blocks were replaced.
  - `CAIRN_CONFIRMATIONS` (0) keeps scanning that many blocks behind the head.
- **Failover:**
  - `STARKNET_RPC_URLS` (comma-separated) replaces `STARKNET_RPC_URL`.
  - When an endpoint's retries fail, Cairn moves to the next one.
  - Endpoints that report different chains exit 2.
- **Health:** with `CAIRN_HTTP_PORT` set (0 means any free port, logged as `{"event":"http","port":n}`), served on `CAIRN_HTTP_HOST` (127.0.0.1):
  - `GET /healthz` returns 200 `{"ok":true,"head":n,"lag_s":n}`, or 503 `{"ok":false,"reason":"stalled"|"rpc"|"telegram"}`.
  - `GET /metrics` returns Prometheus text with `cairn_head_block`, `cairn_updates_total`, `cairn_messages_sent_total`, `cairn_alerts_total` and `cairn_rpc_errors_total`.
- **Seed-phrase guard:**
  - A message of 12, 15, 18, 21 or 24 words, all from `wordlists/bip39-english.txt`, is deleted with `deleteMessage`.
  - It is answered with a warning that repeats none of the words.
  - The words are never stored or logged.
  - In groups the bot needs admin rights to see and delete such messages.
- **Deploy guide** in the README: BotFather setup, choosing an RPC, Docker and systemd.

**Criteria:**
- Trustworthiness under failure (**counts double**): stalls, reorgs and dead endpoints are reported once and accurately, and alerts are corrected when the chain changes its mind
- Operability: health, metrics, failover and the deploy guide let a community run it unattended
- User safety: the seed-phrase guard and corrections protect users without leaking what they protect
- Code quality: earlier rounds reused; one loop, not five

**Key checks:**
1. A head older than `CAIRN_STALL_SECONDS` on two passes sends one stall alert, and one recovery alert when blocks resume.
2. A reorg that drops a transaction sends one correction replying to its alert, and none for a transaction re-included in another block.
3. After a reorg, transfers in the new blocks are alerted, and those already alerted are not alerted twice.
4. With `CAIRN_CONFIRMATIONS=3`, a transfer is alerted only once its block is 3 deep.
5. A dead first endpoint fails over to the second, and endpoints on different chains exit 2.
6. `/healthz` returns 200 when healthy, and 503 with a reason during a stall or when no node is reachable; `/metrics` counts sent messages.
7. The HTTP endpoint listens on 127.0.0.1 only, on the port it logs.
8. A pasted 12- or 24-word seed phrase is deleted and answered with a warning that contains none of its words, and the phrase appears in no file or log.
9. A sentence of ordinary words is not mistaken for a seed phrase.

**How to run it (for judges):** use the README alone to deploy with Docker against two RPC endpoints.
- C1: stop one endpoint, then read `/healthz`.
- C2: follow the guide from scratch on a fresh VM.
- C3: paste a made-up 12-word phrase in a private chat and in a group.
- C4: read how reorg handling touches round 2's ledger.

---

## 6. Risks and open decisions for the creator

| # | Risk or decision | Recommended default | Confidence |
|---|---|---|---|
| 1 | **The name.** "Cairn" has had no trademark search. "StarkBot" is already taken [L§1] | Use Cairn; run a search before the launch form; fall back to Kestrel | unknown |
| 2 | **The dependency allowlist is frozen forever by round 1's check** | Built-ins plus optional `starknet` at an exact version ≥ 10.8.0. A zero-dependency alternative is feasible because 4.9 supplies every selector, and round 3's name encoding is BigInt arithmetic | moderate |
| 3 | **Whether the entry can reach the check's loopback port when the two run as different users.** This has not been tested in the gate [T§10] | Before committing round 1, prove it with a 30-line probe through the gate script. Everything depends on it | unknown |
| 4 | **Whether `NODE_OPTIONS=--import=trap.mjs` survives the kit's clean environment** | Pass it explicitly in `env`. If it is stripped, fall back to the fakes' own logs plus a static scan for URLs | moderate |
| 5 | **Round 1 is big**: about 26 tests and a check of 800–1,000 lines, against 584 for Toddler Buddy | Keep it. If the private reference build takes more than 6 h, move the RPS-cap test and the `/status` gas prices to round 2 | low |
| 6 | **Feed coverage is partial**: only Ekubo and AVNU. JediSwap V1, 10KSwap, Nostra, StarkDefi and an unidentified prop-AMM (165 swaps in 5,000 blocks) are missed [S§5] | Say "Ekubo and AVNU only" in `/help` and the README; add venues in a later round | high |
| 7 | **Ekubo's sign convention and per-transaction netting** were checked against only one multi-hop transaction [V] | Verify on 3 more swaps (one direct, one AVNU route, one arbitrage) before writing round 3's checks | moderate |
| 8 | **Starknet ID edge cases**: the trailing-"a" rule, subdomains, and what an unknown name returns are all unverified; the Sepolia naming address looks truncated | Round 3 accepts single-label names only. `ARCHITECTURE.md` copies starknetid.js 5.0.0's encoder and decoder with test vectors, including a trailing "a", and one is verified on-chain | moderate |
| 9 | **Staking v3 has slipped** (target Sep 2026, no new date) and may change the entrypoints [S§1, S§3] | Round 4 uses the v1 entrypoints verified today. If v3 deploys before round 4 opens, re-verify and amend the brief; keep staking reads behind one adapter | high (that it has slipped) |
| 10 | **Each check runs under a 600 s cap, while every round re-runs earlier rounds** | Each round's checks stay under 300 s on 2 CPUs; about 80% of tests use `tick` | moderate |
| 11 | **Hosting a public instance.** An operator can link Telegram ids to wallet addresses; Telegram may disclose data on valid orders [L§3]. Vercel cannot run a poller that must stay up | Self-hosting is the main path. Hotpod may run one mainnet instance after round 2, on a small VM, with a published privacy note and `/forget` | moderate |
| 12 | **RPC provider.** Public endpoints publish no rate limits; Blast and Lava are gone [S§7] | Hosted instance: one keyed provider plus publicnode in `STARKNET_RPC_URLS`. README: use a `/rpc/v0_10` URL, because round 2 needs `event_index` | moderate |
| 13 | **STRK20 privacy**: shielded transfers emit no per-user `Transfer` events, so wallet alerts are partial [S§2] | Say so in `/help`; never ask for viewing keys | high |
| 14 | **Licence of the BIP-39 wordlist** | Confirm before round 5. If unclear, ship a heuristic the creator writes and checks test | unknown |
| 15 | **A buy feed reads as promotion** | Neutral copy, opt-in by admins, no "trending" lists or rankings, no buy buttons, "not financial advice" in `/help`. A hosted instance is never paid to feature a token | moderate |
| 16 | **Telegram tightens rules for plain bots** (today's TON-only rule exempts bots without a Mini App) [T§0] | Stay a plain, read-only bot with no wallet connection or payments, which is the least exposed shape | low |
| 17 | **Prize split** | 7 / 7 / 6 / 6 / 6 = 32M, with 3M kept under the 35M cap for a fix-up or bonus round. Alternative: 7M flat = 35M, no headroom | moderate |
| 18 | **Licence** | MIT, matching unrug-tg-bot and Starky, the closest Starknet bot projects [L§1] | moderate |
| 19 | **Default explorer and link formats** (`/tx/`, `/contract/` on Voyager) | Default to `https://voyager.online`, configurable; the judges' C1 confirms the links open | moderate |
| 20 | **Scratch-only research files**: the fake Bot API, probes, `trap.mjs` and the keccak helper live in the session scratchpad and will be lost | Copy `scratchpad/tg/verify/`, `tgprobe/` and `sn-research/rpc.py` into the creator's private folder now. The round 1 reference implementation is never published | high |