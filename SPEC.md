# Cairn: a read-only Starknet bot for Telegram, built in five rounds on Hotpod

Final spec, 2026-10-12.

> **Revision, 12 Oct (PM decision):** round 4 "Stakers and calm" is dropped. Round 5 "Network guard and operations" becomes round 4. Prizes are 9,000,000 / 9,000,000 / 9,000,000 / 8,000,000 = 35,000,000. The authoritative round list is `pod/.launchpad/project.md`; the round-4 sections below are kept for reference only.

 It is a synthesis of three drafts (community, Starknet-native and checkable MVP) and four research notes. The checkable-MVP draft is the base.

**How to read the labels**
- **Sources.** [L] landscape, [S] Starknet reference, [T] Telegram reference, [C] checkability note, each with a section number.
- **[V]** means the fact was re-checked on Starknet mainnet on 12 Oct 2026 while this spec was written, over `starknet-rpc.publicnode.com` (spec 0.10.3, Starknet 0.14.4). Selectors were computed with the research keccak helper, which reproduces every selector the research verified.
- **[unverified]** means the fact is grounded neither in the research nor in today's checks. Settle it before committing the round that depends on it.
- **Confidence** is stated as high, moderate, low or unknown.

---

## 1. Name, pitch, personas

**Name: Cairn** (working name). A cairn is a pile of stones that marks a trail and warns walkers, and the word also sounds like Cairo. The entry file is `cairn.mjs` and the environment prefix is `CAIRN_`.
- It is not called "StarkBot", because @starkbotapp already exists [L§1].
- Neither the name nor the @handle contains "Stark" or "Starknet", so the bot never looks official.
- No trademark or handle search has been run (unknown). Fallback names: Kestrel, Murmur.

**Pitch**, for the `# Pitch` section of `.launchpad/project.md`:

> Cairn is an open-source Telegram bot for Starknet that anyone can host. It answers balance and transaction lookups in chat. It alerts you when a watched wallet moves funds or grants an approval. It posts a project group's token buys and whale moves with USD values and .stark names. It tells delegators and validators about missed attestations, commission changes and unlocks. It warns everyone when the chain stalls or reorganises, and corrects any alert a reorg made false. It reads the chain over any JSON-RPC 0.10 node, never holds a key or signs anything, has no Mini App, and runs as one Node.js 24 process with no dependencies.

**Why this, and why now**
- **Nothing like it exists on Starknet.** The research found no buy bot, whale bot, wallet-alert bot or staking monitor, and Cielo, DeBank, Zerion and Whale Alert do not cover Starknet. Confidence moderate, since this rests on absence of evidence [L§1, §2, §4].
- **This shape is the one Telegram allows.** Plain bots without a Mini App are exempt from Telegram's TON-only rule, and that rule is what killed Argent/Ready's Telegram wallet. Confidence high [T§0, L§1].
- **Starknet makes holders watch things by hand.**
  - Rewards must be claimed manually.
  - An epoch without an attestation pays nothing.
  - An exit takes 7 days (high) [S§3].
  - About 1.54B STRK is staked today [S§3], and 1,700 BTC was staked by Dec 2025 (moderate) [L§1].
- **Outages are real.** The outages of 2 Sep 2025 (about 9 h, with two reorgs) and 5 Jan 2026 (about 4 h) were first reported by independent bots (moderate) [L§1, §4.4].
- **Custody is what goes wrong.** It caused the big Telegram-bot losses at Maestro, Unibot, Banana Gun, Solareum, Nova and SIGMA (high) [L§3]. Cairn holds nothing.
- **Hotpod launches on Starknet.** Each project that launches there needs a group feed on day one. Cairn is the launchpad's first Starknet project, and the tool its later projects install.

**Personas**

| Persona | Job to be done | What Cairn gives them | Evidence |
|---|---|---|---|
| **H: Holder** (self-custody wallet) | Know when their money moves or a spender gets an approval | Alerts in direct messages, `/balance`, `/tx`, `/track`, `/price`, .stark names | Cielo, DeBank and Zerion lack Starknet, and forum users have asked since 2023 [L§2, §4.7]. Braavos pushes alerts only for its own wallet [L§1] |
| **A: Community admin** (token, project and DAO groups, including Hotpod projects) | Show live on-chain activity and protect members, without spam | Buy feed, whale alerts, digests, quiet hours, seed-phrase and phishing guards, admin-only settings | No Starknet buy bot found [L§4.1]. Each install spreads the bot [L§2]. Phishing domains imitate Starknet [L§3] |
| **D: Delegator** (STRK or BTC) | Not miss rewards, unlocks, or a validator that stopped working | `/staking` and `/stakewatch`: missed-epoch, commission, exit, unlock and reward alerts | Staking v2 mechanics [S§3]. Validator uptime data is hard to find [L§4.3] |
| **V: Validator operator** | Keep liveness above the program thresholds | Missed-attestation and low operational-balance alerts | Track A requires 99% liveness and Track B 99.5% [L§1] |
| **B: Builder** | Follow a transaction, and know when the chain is down | `/tx`, `/track`, `/status`, stall and reorg alerts | The two outages above [L§1, §4.4] |
| **O: Operator** (whoever runs an instance: a person, a DAO, Hotpod) | Run it unattended, safely and cheaply | One process, secrets from the environment only, no dependencies, health endpoint, failover | Holds no keys, so under one reading of MiCA it is not a custody service (moderate) [L§3] |

---

## 2. Principles and non-goals

### Principles

A principle marked *check* is enforced by a test from the round that introduces it onwards. *Rubric* means the judges assess it.

1. **Read-only, no custody.**
   - Cairn never calls a `starknet_add*` method, never holds key material, never asks for a seed phrase, and never builds a signing link.
   - *Check:* the fake node records any write method as a violation.
2. **A plain bot.**
   - No Mini App, no `web_app` or `login_url` buttons, no wallet connection, and no Stars payments [T§0, T§1].
   - *Check:* the fake Telegram rejects those button types.
3. **Facts, not advice.**
   - Cairn makes no recommendations or predictions, keeps no trending lists, ranks no tokens or validators, and offers no buy or sell buttons.
   - `/help` says "On-chain facts, not financial advice." *Check* for the sentence, *rubric* for the tone.
4. **Opt-in, and quiet by default.**
   - Cairn writes only to chats that started it or added it, and has no broadcast command.
   - Nothing posts in a group until an admin turns it on.
   - It never alerts on zero-amount transfers or fee payments.
   - Caps apply per chat and per user, plus a message budget per group per pass. *Check.*
5. **Privacy by keeping little.**
   - Stored: chat ids, settings, subscriptions, labels, the update offset and delivery keys.
   - Never stored: message text, names or usernames.
   - `/export` and `/forget` exist from round 2.
   - `/start` says what the operator can see: which chat watches which address.
   - Replies say "public balances and transfers", because STRK20 shielded transfers are invisible [L§3, S§2].
   - *Check* and *rubric*.
6. **Only the hosts it is configured for.**
   - Cairn contacts only `TELEGRAM_API_ROOT` and its RPC URL or URLs.
   - No telemetry, no fallback public RPC, no price API.
   - The explorer URL only builds links. A new host can only arrive through an opt-in `*_URL` variable that is off when unset.
   - *Check*, through a network trap.
7. **The chain is the clock.**
   - "Now" is the timestamp of the latest block Cairn has read.
   - Per-user rate limits use `message.date`.
   - The wall clock is used only for backoff, timeouts, logs and stall detection (round 5) [C§1].
   - *Check:* tests move time by adding blocks.
8. **Chain over docs.**
   - Protocol values are read from the contracts: epoch, attestation status, commission, unlock time.
   - The docs are stale: they give an epoch length of 1,132 blocks, while mainnet has 1,961 [S§0, V].
9. **The interface is frozen in round 1, and later rounds only add.**
   - Commands, variables, file formats and JSON shapes are never renamed or removed.
   - *Check:* every round re-runs every earlier round's checks.

### Non-goals

**Out for good:**

| Not built | Why |
|---|---|
| Custodial trading, sniping, MEV, copy trading that executes on its own | These caused the Maestro, Unibot, Solareum, Banana Gun, Nova and SIGMA losses. Holding keys is custody under MiCA. Sniping harms the projects the launchpad serves [L§3, §7] (high) |
| Any Mini App | The TON-only rule; a Mini App would void the plain-bot exemption [T§0] (high) |
| Key or seed import, STRK20 viewing keys, session keys held by the bot | Leaked keys are the top theft cause. Viewing keys reveal shielded activity. A bot-held session key is custody-adjacent, and the SNIP is a pre-audit draft [L§3, S§6] |
| Paid trending slots, volume bots, ads in alerts, a project token or a Stars paid tier | Market-manipulation exposure, and digital goods sold in Telegram must be paid in Stars [L§7, T§1] |
| A free-text AI agent that acts | Prompt injection leads straight to fund loss [L§7] |
| Airdrop farming or sybil tooling | The category is full of malware lures, including a Starknet one [L§1] |
| A general anti-spam or CAPTCHA engine | Rose, Shieldy and Combot already do this. Cairn adds only the Starknet-specific guards [L§2, §7] |
| Multiple chains | Focus |

**Not in rounds 1 to 5:**
- Signing links and other ways to act on-chain. These would be a follow-up project (see L01).
- Token-gated groups (L02).

---

## 3. Feature list

**Priority**
- **must:** in the round's brief, and checked.
- **should:** in the brief and checked, but the first item to move to a later round. It moves if the creator's private reference build of that round runs past about 6 h, and the call is made before the round's checks are committed.
- **could:** not in rounds 1 to 5.

**How each feature is verified**
- **check:** an offline test against the fake Telegram API and the fake Starknet node.
- **rubric:** the judges decide.
- **check + rubric:** the test verifies the facts, and the judges assess the copy or the feel.

### Round 1: Lookups

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F01 | Setup self-test | `node cairn.mjs doctor` | O | must | check |
| F02 | One pass, or long-running | `node cairn.mjs tick`, `node cairn.mjs run` | O | must | check |
| F03 | Configuration from the environment and the network file, validated before any network call; chain guard and RPC-version guard | env vars, `networks/<chain>.json` | O | must | check |
| F04 | Onboarding, help and the command menu, with an "Add to group" link and the disclaimer | `/start`, `/help`, `setMyCommands` | all | must | check + rubric |
| F05 | Chain status: chain, head block and its time, L1, L1-data and L2 gas prices in FRI, the node's spec version | `/status` | B, H | must | check |
| F06 | Balances across the token registry: exact u256 amounts, `balanceOf` fallback, "not deployed" flag | `/balance <address>` | H | must | check |
| F07 | Transaction card: finality, execution status, fee in STRK, block, revert reason, explorer link | `/tx <hash>` | H, B | must | check |
| F08 | Group addressing that works with privacy mode on | `/cmd`, `/cmd@<bot>` | A | must | check |
| F09 | Resilience: RPC retry and backoff, RPS cap, Telegram `retry_after`, skipping a chat that returns 403, 4096 split | automatic | O | must | check |
| F10 | Security baseline: secrets only from the environment and never echoed; only configured hosts; read-only RPC; data directory 700 with files 600; repository scan; no dependencies | automatic | O | must | check + rubric |
| F11 | Starter network files | `networks/SN_MAIN.json`, `networks/SN_SEPOLIA.json` | O | must | check (shape, symbols) + rubric (addresses) |

### Round 2: Wallet alerts

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F12 | Watch list with labels, and a list with Remove buttons | `/watch <address> [label]`, `/unwatch <address\|label>`, `/list` | H, A | must | check |
| F13 | Transfer alerts in and out, for both event layouts, one message per transaction per chat | `Transfer` event | H | must | check + rubric |
| F14 | Noise floor: zero-amount transfers (address poisoning) and fee transfers are never alerted | automatic | H, A | must | check |
| F15 | Per-chat token floor | `/min <SYMBOL> <amount>` | H, A | should | check |
| F16 | Approval alerts for a watched owner, with an "unlimited" flag | `Approval` event | H | should | check |
| F17 | Whale alerts, with mints and burns labelled | `/whale <SYMBOL> <amount>`, `/unwhale <SYMBOL>` | A | must | check |
| F18 | Transaction tracking to L2 acceptance, L1 acceptance or revert | `/track <hash>` | B, H | must | check |
| F19 | Paste to look up, with Watch and Track buttons | a bare address or hash in a private chat | H | should | check |
| F20 | Delivery guarantees: nothing from before the subscription; at least once across SIGKILL; never twice once Telegram accepted it; bounded catch-up | `CAIRN_MAX_BLOCKS` | all | must | check |
| F21 | Group settings for admins only, including anonymous admins | `getChatMember` | A | must | check |
| F22 | Data rights | `/export`, `/forget` | H, A | must | check |
| F23 | Chats that change: re-key on supergroup migration; pause on 403 or removal | automatic | A, O | must | check |
| F24 | Per-chat caps and a per-user command rate limit | `CAIRN_MAX_WATCHES`; 10 commands per 60 s | O | must | check |

### Round 3: Group feeds, prices and names

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F25 | Token trade feed from Ekubo and AVNU, netted per transaction, one post per transaction | `/feed <SYMBOL\|address> [<min>\|$<usd>] [buys\|all]`, `/unfeed` | A | must | check + rubric |
| F26 | Post content: side, amount, amount paid, USD value, trader, venue, time, link | each trade | A, H | must | check (fields) + rubric (look) |
| F27 | New-holder flag | the trader's balance was 0 in the previous block | A | should | check |
| F28 | Tokens outside the registry, read from their contract (short-string or ByteArray symbol) | `/feed <address>` | A | should | check |
| F29 | On-chain price from Pragma with its age and source count; stale flag; "no price" for an unknown pair | `/price [SYMBOL…]` | H, A | must | check |
| F30 | USD values in alerts and posts, from fresh prices only | display | all | must | check |
| F31 | Starknet ID names accepted wherever an address is | `name.stark` | all | must | check |
| F32 | Reverse names shown only when they round-trip | display | all | must | check |
| F33 | Group budget: at most 3 messages per group per pass, the last one a summary | automatic | A | must | check |
| F34 | Posts go to the forum topic where they were set up | `message_thread_id` | A | should | check |
| F35 | A feature whose contract is absent says so, without exiting | network file | O | must | check |

### Round 4: Stakers and calm

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F36 | Staking card for a validator, or a delegator across STRK and BTC pools | `/staking <address\|name> [validator]` | D, V | must | check + rubric |
| F37 | Staking watch | `/stakewatch <address\|name> [validator] [min=<STRK>] [low=<STRK>]`, `/unstakewatch` | D, V | must | check |
| F38 | Missed-attestation alert, once per epoch | epoch change | D, V | must | check |
| F39 | Commission-change and exit-intent alerts | epoch change | D | must | check |
| F40 | Unlock complete | chain time reaches `unpool_time` | D | must | check |
| F41 | Unclaimed-rewards reminder | `min=` | D | should | check |
| F42 | Low operational balance | `low=` | V | should | check |
| F43 | Time zone as a UTC offset | `/tz ±HH:MM` | H, A | should | check |
| F44 | Quiet hours, with one summary afterwards | `/quiet HH:MM-HH:MM\|off` | H, A | must | check |
| F45 | Daily digest, with a digest-only mode | `/digest HH:MM [only]\|off` | A, H | should | check + rubric |

### Round 5: Network guard and operations

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F46 | Stall and recovery alerts | `/network on\|off` | B, A | must | check + rubric |
| F47 | Node-down notices sent only to the operator | `CAIRN_OPERATOR_CHAT` | O | should | check |
| F48 | Reorg detection, with corrections replying to the alerts it made false | automatic | all | must | check |
| F49 | Confirmation depth | `CAIRN_CONFIRMATIONS` | O | should | check |
| F50 | RPC failover | `STARKNET_RPC_URLS` | O | must | check |
| F51 | Skip a long gap, with a notice | `CAIRN_MAX_GAP` | O | should | check |
| F52 | Health and metrics endpoint | `CAIRN_HTTP_PORT`: `/healthz`, `/metrics` | O | should | check |
| F53 | Seed-phrase guard: delete and warn, never repeat the words | 12, 15, 18, 21 or 24 BIP-39 words; `/guard seed on\|off` | all | must | check |
| F54 | Phishing-link guard | a link to a blocklisted domain; `/guard links on\|off`; `CAIRN_BLOCKLIST` | A | should | check |
| F55 | Deploy guide: BotFather, choosing an RPC, Docker, systemd | README | O | must | rubric |

### Later (could), with reasons

| ID | Feature | Why not in rounds 1 to 5 |
|---|---|---|
| L01 | **Signing links**: Cairn prepares calls (send, claim, claim-and-restake, delegate) as one multicall; the user signs in their own wallet on a page Cairn serves; optional gasless mode through the SNIP-29 paymaster | This is the most Starknet-native idea, built on account abstraction, but it is security-critical. The Wallet API call shape, the SNIP-29 JSON and an in-browser check are all unverified, and a sixth round is impossible (a project has 2 to 5 rounds). Recommended as a follow-up project, "Cairn Actions", built on round 5's winner after an independent review. Draft 2's intent design is the blueprint: opaque single-use id, stored calls, calldata checked against the intent, stored typed data relayed once |
| L02 | Token-gated groups (join requests, Bot API 10.1; a SNIP-12 sign-in verified through `is_valid_signature`) | Needs a web page and Poseidon/SNIP-12 hashing; belongs with L01 [L§4.2] |
| L03 | Governance alerts (Snapshot X proposals; "your delegate has not voted") | Needs an opt-in `api.snapshot.box` host; event layout unverified [S§8] |
| L04 | Lending health and oracle-deviation alerts (Vesu, Nostra) | Strong demand after the September 2026 incidents, but the protocols' ABIs were not researched [L§1, §4.5] |
| L05 | Price-threshold, depeg and LST-ratio alerts | An easy follow-on to round 3; left out to keep round 3 one sitting [L§6 #9] |
| L06 | Buyer leaderboard `/top` | Standard on other chains, but it rewards wash buying and contradicts "no rankings" |
| L07 | Market cap in buy posts | Implied price times `total_supply` is easy to misread for thin new tokens. The `total_supply` selector is computed (§4.9) |
| L08 | More venues: JediSwap V1/V2, 10KSwap, Nostra, StarkDefi, the unidentified prop-AMM | Layouts partial or unverified [S§5] |
| L09 | Validator "attestation window closed" alert, before the epoch ends | The window's exact semantics around `get_current_epoch_target_attestation_block` are [unverified] |
| L10 | `/settings` panel with inline buttons | Commands are enough; a convenience |
| L11 | Webhook mode with a secret-token header | Long polling covers self-hosting; feasible later [C§1] |
| L12 | Guest-mode `@bot price STRK` (Bot API 10.0) and ephemeral group replies (10.2/10.3) | New, still-changing APIs [T§1] |
| L13 | Managed per-project bots (Bot API 9.6) | Product decision after the pilot |
| L14 | History CSV for tax tools | Weak demand evidence [L§6 #15] |
| L15 | Ekubo LP out of range; TWAMM or limit order filled | Low evidence [L§6 #11] |
| L16 | Public STRK whale and unlock channel | Needs verified exchange labels |
| L17 | Translations | After the copy settles |
| L18 | WebSocket subscriptions | A fake WebSocket costs about 80 lines, and free WSS event delivery tested unreliable [S§1, C§1] |
| L19 | IANA time-zone names, with daylight saving | Depends on ICU data in the runner [unverified]; round 4 uses fixed offsets |

**Out for good:** see §2 non-goals.

---

## 4. Architecture and fixed interface

### 4.1 Shape

One Node.js process. Every pass runs the same steps, in this order:

```
pass():
  1. head:     starknet_getBlockWithTxHashes("latest") -> number, hash, timestamp (chain time), sequencer_address
               (on failure head = null; commands that need the chain reply "node busy")
  2. updates:  getUpdates from the saved offset; handle each in order. A subscribing command records since_block = head.
               Each change and the update_id are saved before the reply is sent.
  3. scan:     (R2+) blocks (cursor, min(head - CAIRN_CONFIRMATIONS, cursor + CAIRN_MAX_BLOCKS)] -> events -> pending alerts saved
  4. periodic: (R4+) staking reads when the epoch changes; (R5) stall and reorg checks
  5. deliver:  pending -> sendMessage -> marked sent, with its message_id, only after Telegram accepts it
               (group budget R3, quiet hours and digests R4)
  6. save:     cursor and recent block hashes; confirm the offset
run  = pass every CAIRN_POLL_MS, long-polling getUpdates in between, so a command is answered within 3 s
tick = one pass with getUpdates timeout 0 (drained until empty), then one JSON line on stdout
```

- On the first start, the cursor is set to the head, so Cairn never backfills.
- The suggested modules are `cli`, `config`, `telegram`, `rpc`, `felt` (u256, i129, short strings, ByteArray, address normalisation, Starknet ID encoding), `decode`, `scan`, `ledger`, `store`, `format`, `commands/*` and, later, `staking` and `network`. Entrants choose their own structure. Only §4.2 to §4.10 are fixed.

### 4.2 Fixed files

| File | Purpose | Round |
|---|---|---|
| `cairn.mjs` | Entry point | 1 |
| `networks/SN_MAIN.json`, `networks/SN_SEPOLIA.json` | Network files (§4.5) | 1 |
| `ARCHITECTURE.md` | The specification the checks follow to the letter: this section plus every layout and selector in §4.9, and the Starknet ID encoding with test vectors | 1+ |
| `README.md`, `.env.example` | Placeholders that do not match the token pattern, e.g. `TELEGRAM_BOT_TOKEN=123456:replace-me` | 1 |
| `package.json`, `package-lock.json` | No dependencies (§4.10); `"engines":{"node":">=24"}` | 1 |
| `LICENSE` | MIT | 1 |
| `wordlists/bip39-english.txt` | Seed-phrase guard | 5 |
| `blocklist/domains.txt` | Phishing-link guard | 5 |

### 4.3 Commands, outputs and exit codes

```
node cairn.mjs run      # until SIGTERM/SIGINT, then exit 0 within 3 s (aborting a held getUpdates with AbortController)
node cairn.mjs tick     # one pass; prints ONE line: {"updates":<n>,"sent":<n>,"head":<n>|null}
                        #   round 2 adds "alerts":<n>,"cursor":<n>
node cairn.mjs doctor   # getMe, starknet_chainId, starknet_specVersion, starknet_blockNumber
                        # prints ONE line: {"bot":"<username>","chain":"SN_MAIN","block":<n>,"spec":"0.10.3"}
```

- `sent` counts the messages Telegram accepted during the pass.
- Later rounds may add keys to these lines. They never rename or remove one, and checks ignore keys they do not know.
- There are no flags. All configuration comes from the environment.
- `run` calls `deleteWebhook` (with `drop_pending_updates` false) once at start.
- `run` and `tick` call `setMyCommands` whenever the stored command list differs from the current one.
- `run` and `tick` check `starknet_chainId` and `starknet_specVersion` once per process, before the first chain call.

| Exit | Meaning |
|---|---|
| 0 | OK. `tick` also exits 0 when the node was unreachable: `head` is `null`, and commands got a "node busy" reply |
| 1 | Telegram unreachable (any command), the node unreachable (`doctor` only), or a 409 conflict ("another instance is running"). Reason on stderr; state stays consistent |
| 2 | A bad command line, a bad environment value or a bad network file, detected **before any network call**. Also: a node on another chain than `CAIRN_CHAIN`; a node whose spec version is below 0.10.0 (`event_index` is needed for deduplication) [S§1]; and, from round 5, endpoints that disagree on the chain. Reason on stderr, nothing on stdout |
| 3 | Telegram rejected the token (401). Kept apart from 1 so a supervisor does not restart in a loop |

### 4.4 Environment variables

Secrets come only from the environment, never from flags, because flags show up in `ps` [C§1].
- A value out of range exits 2.
- A round ignores variables that later rounds introduce, and earlier checks never set them.

| Variable | Round | Default | Rule |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | 1 | required | `^\d+:[A-Za-z0-9_-]{30,}$`. Secret |
| `TELEGRAM_API_ROOT` | 1 | `https://api.telegram.org` | http(s) origin, with no path and no trailing slash. Calls go to `${root}/bot${token}/${method}` |
| `STARKNET_RPC_URL` | 1 | required, no public default | http(s) URL. **Secret**, because providers put keys in the path. Logs show only its origin |
| `CAIRN_CHAIN` | 1 | `SN_MAIN` | `SN_MAIN` or `SN_SEPOLIA`. Compared with the decoded `starknet_chainId` (0x534e5f4d41494e or 0x534e5f5345504f4c4941) [S§1] |
| `CAIRN_NETWORK_FILE` | 1 | `networks/<CAIRN_CHAIN>.json`, next to `cairn.mjs` | §4.5 |
| `CAIRN_DATA` | 1 | `./data` | Created with mode 700, files 600. Nothing is written anywhere else |
| `CAIRN_EXPLORER_URL` | 1 | `https://voyager.online` (Sepolia: `https://sepolia.voyager.online`) | Used only to build links: `/tx/<hash>` and `/contract/<address>`. Never fetched. Link paths are moderate confidence |
| `CAIRN_POLL_MS` | 1 | 10000 | Minimum 50. Checks use 100 |
| `CAIRN_TG_TIMEOUT` | 1 | 30 | Long-poll seconds in `run`, 0 to 50. Checks use 1 |
| `CAIRN_RPC_RPS` | 1 | 5 | 1 to 100. The most JSON-RPC calls in any 1 s window; each call inside a batch counts |
| `CAIRN_RPC_TIMEOUT_MS` | 1 | 10000 | Minimum 100. Checks use 1500 |
| `CAIRN_LOG` | 1 | `info` | `error`, `warn`, `info` or `debug`. One JSON line per event, on stderr only |
| `CAIRN_MAX_BLOCKS` | 2 | 500 | 1 to 10000. Blocks scanned per pass |
| `CAIRN_MAX_WATCHES` | 2 | 20 | 1 to 200 per chat |
| `CAIRN_PRICE_MAX_AGE` | 3 | 900 | Seconds of chain time before a price counts as stale. Observed update age on 12 Oct was about 185 s [V] |
| `STARKNET_RPC_URLS` | 5 | unset | Comma-separated failover list. When set, it replaces `STARKNET_RPC_URL`. Every entry is a secret |
| `CAIRN_CONFIRMATIONS` | 5 | 0 | 0 to 100 |
| `CAIRN_STALL_SECONDS` | 5 | 120 | Minimum 2. Wall clock |
| `CAIRN_REORG_DEPTH` | 5 | 64 | 1 to 1000. Block hashes kept, and the deepest walk-back |
| `CAIRN_MAX_GAP` | 5 | 50000 | Blocks, about 25 h at 1.78 s per block [S§1] |
| `CAIRN_OPERATOR_CHAT` | 5 | unset | Chat id that receives node-down notices |
| `CAIRN_HTTP_PORT` | 5 | unset (off) | `0` means any free port, logged as `{"level":"info","event":"http","port":<n>}` |
| `CAIRN_HTTP_HOST` | 5 | `127.0.0.1` | Bind address |
| `CAIRN_BLOCKLIST` | 5 | `blocklist/domains.txt`, next to `cairn.mjs` | One domain per line; `#` starts a comment |

### 4.5 Network file

```json
{
  "chain": "SN_MAIN",
  "tokens": [
    {"symbol": "STRK", "address": "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
     "decimals": 18, "pragma_pair": "STRK/USD"}
  ],
  "contracts": {"pragma": "0x…", "ekubo_core": "0x…", "avnu_exchange": "0x…",
                "naming": "0x…", "staking": "0x…", "attestation": "0x…"}
}
```

**Validation**
- `chain` must equal `CAIRN_CHAIN`.
- `tokens` holds 1 to 50 entries:
  - `symbol` matches `^[A-Za-z0-9.]{1,11}$` and is unique, ignoring case;
  - `address` is valid (§4.9) and unique once normalised;
  - `decimals` is an integer from 0 to 36.
- Round 1 ignores every other key.
- From round 3, `pragma_pair` must match `^[A-Z0-9]{1,10}/[A-Z0-9]{1,10}$`, and each entry in `contracts` must be a valid address.
- A bad entry exits 2 and names its JSON path, e.g. `networks/SN_MAIN.json: tokens[3].decimals: …`.
- From round 3, a missing contract switches its feature off, and the bot replies saying so. It never exits 2 for a missing contract.

**Starter mainnet registry.** Checks assert the shape and symbols only. The creator and the judges review the addresses [C§8].

| Symbol | Address | Dec. | Transfer layout | Pragma pair | Round |
|---|---|---|---|---|---|
| STRK | 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d | 18 | modern [S§2] | STRK/USD, 8 decimals [V] | 1 |
| ETH | 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7 | 18 | modern [S§2] | ETH/USD, 8 [V] | 1 |
| USDC (native) | 0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb | 6 | modern [S§2] | USDC/USD, 6 [V] | 1 |
| USDC.e | 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8 | 6 | legacy [S§2] | USDC/USD (assumed peg, labelled) | 1 |
| USDT | 0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8 | 6 | modern [S§2, V] | USDT/USD, 6 [V] | 1 |
| WBTC | 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac | 8 | legacy [S§2] | WBTC/USD, 8 [V] | 1 |
| strkBTC | 0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135 | 8 | modern [V] | BTC/USD (assumed peg, labelled) | 4 |
| tBTC | 0x04daa17763b286d1e59b97c283c0b8c949994c361e426a28f743c67bdfe9a32f | 18 | modern [V]; symbol is a ByteArray [V] | none (TBTC/USD returns zeros) [V] | 4 |
| SolvBTC | 0x0593e034dda23eea82d2ba9a30960ed42cf4a01502cc2351dc9b9881f9931a68 | 18 | **legacy** [V] | none (SOLVBTC/USD returns zeros) [V] | 4 |

**Mainnet contracts**

| Key | Address | Round |
|---|---|---|
| `pragma` | 0x02a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b [S§5, V] | 3 |
| `ekubo_core` | 0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b [S§5, V] | 3 |
| `avnu_exchange` | 0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f [S§5, V] | 3 |
| `naming` | 0x06ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678 [S§4, V] | 3 |
| `staking` | 0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7 [S§3, V] | 4 |
| `attestation` | 0x010398fe631af9ab2311840432d507bf7ef4b959ae967f1507928f5afe888a99 [S§3, V] | 4 |

**Sepolia**

| Item | Value |
|---|---|
| STRK, ETH | Same addresses as mainnet [S§2] |
| USDC | 0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343 |
| USDC.e | 0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080 |
| `pragma` | 0x036031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a |
| `staking` | 0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1 |
| `attestation` | 0x03f32e152b9637c31bfcf73e434f78591067a01ba070505ff6ee195642c9acfb |
| `naming` | 0x00000154bc2e1af9260b9e66af0e9c46fc757ff893b3ff6a85718a810baf1474. The research value was not truncated, only missing leading zeros: its class equals the mainnet naming class [V] |
| Ekubo, AVNU | Not researched, so absent. The feed is off on Sepolia |

### 4.6 Data directory and state

- **Recommended store:** `node:sqlite` (`DatabaseSync`) at `$CAIRN_DATA/state.db`. It runs in the runner's Node v24.20.0 with no flag and no warning [C§0].
- **Also allowed:** one JSON file, written to a temporary file, fsynced, then renamed.
- **Not allowed:** `better-sqlite3`, because of the dependency policy.
- **The format is the entrant's own; checks never parse it.** They assert behaviour instead:
  - state survives a restart and a SIGKILL;
  - "a change is saved before its confirmation is sent";
  - the directory has mode 700 and its files mode 600;
  - nothing is written outside `CAIRN_DATA`: the check snapshots the entry tree, HOME and TMPDIR before and after;
  - neither secret appears in any file;
  - from round 2, no fixture user's name or username appears in any file.
- **Stored:**
  - chat ids and types, settings and subscriptions, labels;
  - the update offset and the command list sent;
  - the cursor and the last `CAIRN_REORG_DEPTH` block hashes;
  - the delivery ledger (key, state, `message_id`), kept for 7 days of chain time;
  - from round 3, price samples (24 h) and a name cache;
  - from round 4, staking snapshots;
  - from round 5, the time the head was first seen.
- **Never stored:** message text, names, usernames, the token, RPC URLs, or anything a seed guard matched.

### 4.7 Output conventions

These are fixed so checks can match exactly. Before comparing, checks strip tags, unescape entities and remove commas from numbers.

- **Messages:**
  - always `parse_mode: "HTML"` with `link_preview_options: {"is_disabled": true}`;
  - 1 to 4096 UTF-16 units after entity parsing; longer replies are split at line breaks [T§4];
  - every outside string (labels, symbols, names, revert reasons) is escaped: `&`, `<` and `>`, plus `"` inside attributes.
- **Amounts:**
  - an exact decimal computed with BigInt, with trailing zeros trimmed and `.` as the decimal point;
  - `,` grouping is optional in the integer part;
  - no scientific notation;
  - then a space and the symbol: `1,234.5 STRK`.
  - Fees in FRI are shown in STRK (FRI ÷ 10^18). Gas prices are exact FRI integers.
- **USD:**
  - `amount × price ÷ 10^(token decimals + pair decimals)`, rounded half up to cents, e.g. `$1,234.57`;
  - a non-zero value below a cent is `<$0.01`;
  - nothing is computed from a stale price or a missing one.
- **Prices:** the exact oracle value with trailing zeros trimmed, plus its age in chain time and `num_sources_aggregated`.
- **Addresses:**
  - normalised to `0x` plus 64 lowercase hex digits;
  - shown as `0x` plus the first 4 and last 4 of the 64 digits, joined by `…` (`0x0471…938d`);
  - linked as `${CAIRN_EXPLORER_URL}/contract/0x<64 hex>`;
  - a label (round 2) or a verified name (round 3) may replace the short form.
- **Transactions:** linked as `${CAIRN_EXPLORER_URL}/tx/0x<64 hex>`.
- **Times:**
  - `YYYY-MM-DD HH:MM:SS UTC`;
  - from round 4, digests and quiet-hour summaries also show the local time with its offset, e.g. `09:00 (UTC+02:00)`.
- **Commission:** the contract's 10,000 means 100%. It is shown as a percentage with up to 2 decimals: 500 becomes `5%` [S§3, V].
- **Logs:**
  - stderr only, one JSON object per line, with at least `level` and `event`;
  - never the token, an RPC path or query, or message text.

### 4.8 Telegram transport

- **Requests:** `POST ${TELEGRAM_API_ROOT}/bot${TOKEN}/<method>` with a JSON body. `api.telegram.org` is never hardcoded in a request [T§10].
- **Updates: long polling only, in rounds 1 to 5.** It is outbound only, the check owns the update queue, and it is how community members self-host [C§1]. `setWebhook` is never called.
- **Offsets:**
  - `getUpdates` takes `offset` = last handled `update_id` + 1, and `timeout` = `CAIRN_TG_TIMEOUT` in `run` or 0 in `tick`.
  - `tick` ends by confirming the offset with `getUpdates{offset:last+1,limit:1,timeout:0}`.
  - An update is never handled twice, even across restarts [T§2, C§4].
- **`allowed_updates`:** round 1 uses `["message"]`. Round 2 adds `"callback_query"` and `"my_chat_member"`.
- **Bot API methods.** This is the complete list. Anything else gets 404 from the fake and fails a test.

  | Round | Methods |
  |---|---|
  | R1 | `getMe`, `deleteWebhook`, `getUpdates`, `sendMessage`, `setMyCommands`, and `sendChatAction` (optional) |
  | R2 | `answerCallbackQuery`, `editMessageText`, `getChatMember` |
  | R5 | `deleteMessage` (corrections use `sendMessage` with `reply_parameters`) |

- **Groups:**
  - Commands are parsed with `^/(\w+)(@(\w+))?`.
  - Cairn answers `/cmd` and `/cmd@<username from getMe>`. It ignores `/cmd@other_bot` and plain text [T§5].
  - Admin means `getChatMember` returns status `creator` or `administrator`. A message whose `sender_chat.id` equals the chat id (an anonymous admin posting as the group) also counts [unverified].
  - Seeing every message, which the round-5 guards need, requires the bot to be an admin [T§5].
- **Buttons:**
  - `callback_data` is `<verb>:<server id>`, at most 64 bytes, and never holds a full address (a 66-character address does not fit [T§0]).
  - Every `callback_query` is answered exactly once.
  - Deep-link payloads must match `^[A-Za-z0-9_-]{1,64}$`. Any other payload falls back to the plain welcome [T§6].
  - `/help` carries `https://t.me/<username>?startgroup=setup`.
- **Errors:**

  | Error | Handling |
  |---|---|
  | 429 | Wait exactly `parameters.retry_after`, then resend that message once |
  | 403 (blocked or kicked) | Mark the chat inactive and carry on. From round 2 it stays paused until the chat writes again or re-adds the bot |
  | 400 with `migrate_to_chat_id` | (R2) Move the chat's data to the new id and resend |
  | 400 "message is not modified" | Ignore |
  | 401 | Exit 3 |
  | 409 | Exit 1, "another instance is running" |

- **Pacing:** Cairn does not throttle in advance, following grammY's guidance that `retry_after` is the signal [T§3]. Groups are protected by the per-pass budget from round 3. This keeps each `tick` fast.

### 4.9 Starknet access

**Transport and finality**
- **Transport:** HTTP JSON-RPC 0.10 or later, polled. No WebSockets: a fake WebSocket costs about 80 lines, and free WSS event delivery tested unreliable [S§1, C§1].
- **Block ids:** only `"latest"`, `{"block_number":n}` or `{"block_hash":h}`. Never `"pending"` (removed in 0.9 [S§1]) or `"pre_confirmed"`. The fake rejects both with -32602.
- **Finality:** `latest` is ACCEPTED_ON_L2, which is final in practice (Tendermint, 1-block finality [S§1]). Pre-confirmed data is never alerted.

**Input validation**
- An address is `0x` plus 1 to 64 hex digits in any case, with 0 < v < 2^251 − 256 [S§2].
- A hash is a felt with 0 < v < P = 2^251 + 17·2^192 + 1.
- Values are compared only after normalising.
- u256 = low + high·2^128, computed with BigInt.

**RPC hygiene**
- At most `CAIRN_RPC_RPS` calls per second.
- On HTTP 429, 5xx or a timeout: up to 3 tries, with backoff of at least `Retry-After`, then a "node busy" reply.
- One address per `getEvents` filter (works on 0.10.0). Every `continuation_token` is followed. Continuation tokens are never reused across endpoints [S§1].

**Errors** [C§2, S§1, moderate on the numbers]

| Code | Meaning | Cairn's response |
|---|---|---|
| 20 | Contract not found | "not deployed" |
| 21 | Entrypoint not found | Fall back to `balanceOf` |
| 24 | Block not found | Retry on the next pass |
| 29 | Transaction hash not found | "not found" |
| 33 | Invalid continuation token | Restart that range |
| 40 | Contract error | An error for that one item only |

**Methods by round**

| Round | Methods |
|---|---|
| 1 | `starknet_specVersion`, `starknet_chainId`, `starknet_blockNumber`, `starknet_getBlockWithTxHashes` (header: `timestamp`, `sequencer_address`, `l1_gas_price`, `l1_data_gas_price`, `l2_gas_price` in FRI [V]), `starknet_call`, `starknet_getClassHashAt`, `starknet_getTransactionStatus`, `starknet_getTransactionReceipt` |
| 2 | `starknet_getEvents`; `starknet_getBlockWithTxHashes` by number (for the fee rule) |
| 3 | `starknet_getTransactionByHash` (`sender_address`); `starknet_call` at `{block_number}` (new-holder flag) |
| 4 | `starknet_call` on the staking, attestation and pool contracts |
| 5 | `starknet_getBlockWithTxHashes` by number, to compare hashes |
| never | `starknet_add*`, WebSocket subscriptions, any host that is not configured |

**Event layouts.** The layout is chosen by `keys.length`.

| Event | Layout | Status |
|---|---|---|
| `Transfer`, modern (STRK, ETH, USDC, USDT, strkBTC, tBTC) | keys `[sel, from, to]`, data `[low, high]` | [S§2]; strkBTC and tBTC [V] |
| `Transfer`, legacy (USDC.e, WBTC, SolvBTC) | keys `[sel]`, data `[from, to, low, high]` | [S§2]; SolvBTC [V] |
| `Approval` | The same split, with owner and spender in place of from and to | [V] for all nine registry tokens' families: 3/2 for the modern ones, 1/4 for the legacy ones |
| Fee payment | The **last** event of a transaction: a STRK `Transfer` from the sender to the block header's `sequencer_address`, for exactly `actual_fee.amount` | [V] on 8 mainnet transactions |
| Ekubo `Swapped` | keys `[sel]`; 21 data felts: 0 locker; 1 token0; 2 token1; 3 fee; 4 tick_spacing; 5 extension; 6–7 params.amount (mag, sign); 8 is_token1; 9–10 sqrt_ratio_limit; 11 skip_ahead; **12–13 delta.amount0 (mag, sign); 14–15 delta.amount1 (mag, sign)**; 16–17 sqrt_ratio_after; 18–19 tick_after; 20 liquidity_after. Sign 1 means negative. **A positive delta means paid into the pool** | Layout [S§5]. Sign [V]: on 14 transactions, the per-transaction sum of deltas equals the net transfers into Ekubo Core |
| AVNU `Swap` | keys `[sel]`; data `[taker, sell_token, sell_low, sell_high, buy_token, buy_low, buy_high, beneficiary]` | [S§5]. In 15 sampled transactions taker equals beneficiary, and in 10 of them it is a contract driven by a bot account [V] |
| `NewPoolMember` (later use) | keys `[sel, member, staker]`, data `[reward_address, amount]` | [V] |

**Call layouts.** A Cairo `Option` is tag 0 for Some and 1 for None. A None is a single felt.

| Call | Calldata | Result felts | Status |
|---|---|---|---|
| `token.balance_of(owner)` / `balanceOf` | `[owner]` | `[low, high]` | [S§2] |
| `token.symbol()` | — | One felt for a short string, otherwise a ByteArray `[n_full_words, words…, pending_word, pending_len]` (tBTC returns `[0x0, 'tBTC', 0x4]`) | [V] |
| `token.decimals()` / `total_supply()` | — | `[d]` / `[low, high]` | selectors computed |
| `pragma.get_data_median(SpotEntry(pair))` | `[0x0, shortstring(pair)]` | `[price, decimals, last_updated_ts, num_sources, exp_tag, exp?]`. **A pair Pragma does not have returns price 0, decimals 0 and timestamp 0 (no error): treat it as "no price"** | [S§5, V] |
| `naming.domain_to_address(domain, hint)` | `[n_labels, encode(label)…, 0]` | `[address]`. **0x0 means the name is unknown** | [V] |
| `naming.address_to_domain(address, hint)` | `[address, 0]` | `[n, label…]`. **`[0]` means no name** | [V] |
| `staking.get_current_epoch()` | — | `[epoch]` (13,592 today) | [V] |
| `staking.get_epoch_info()` | — | `[duration_s, length_blocks, starting_block, starting_epoch, prev_length, prev_duration]` = `[3600, 1961, 16280708, 13589, 2022, 3600]` | [S§3, V] |
| `staking.staker_pool_info(staker)` | `[staker]` | `[comm_tag, commission?, n, (pool_contract, token, amount)×n]` | [V] |
| `staking.get_staker_info_v1(staker)` | `[staker]` | `[tag, reward_addr, operational_addr, unstake_tag, unstake_time?, amount_own, unclaimed_own, pool_tag, pool_contract?, pool_amount?, commission?]` | [V] |
| `pool.get_pool_member_info_v1(member)` | `[member]` | `[tag, reward_addr, amount, unclaimed_rewards, commission, unpool_amount, unpool_tag, unpool_time?]`. A non-member gets `[1]` (None). Never call `pool_member_info_v1`, which panics | [S§3, V] |
| `attestation.get_last_epoch_attestation_done(staker)` | `[staker]` | `[epoch]` | [V] |

**Starknet ID encoding**
- Each label is one felt in base 38, little-endian, over `abcdefghijklmnopqrstuvwxyz0123456789-` [S§4]. Verified forward and reverse for `starknet` and `ben` [V].
- Still [unverified]: starknetid.js's special rule for a label ending in `a`, and subdomains. `ARCHITECTURE.md` must copy the encoder and decoder from starknetid.js 5.0.0, with at least 10 vectors that include a trailing `a`. One of them must be verified on-chain before round 3's checks are committed.

**Selectors.** These are sn_keccak values, computed for this spec. Every one the research had verified matches. `ARCHITECTURE.md` lists them all, because `node:crypto` has no keccak [C§0].

```
Transfer                          0x0099cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9
Approval                          0x0134692b230b9e1ffa39098904722134159652b09c5bc41d88d6698779d228ff
balance_of                        0x035a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33
balanceOf                         0x02e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e
decimals                          0x004c4fb1ab068f6039d5780c68dd0fa2f8742cceb3426d19667778ca7f3518a9
symbol                            0x0216b05c387bab9ac31918a3e61672f4618601f3c598a2f3f2710f37053e1ea4
total_supply                      0x01557182e4359a1f0c6301278e8f5b35a776ab58d39892581e357578fb287836
totalSupply                       0x0080aa9fdbfaf9615e4afc7f5f722e265daca5ccc655360fa5ccacf9c267936d
Swapped (Ekubo)                   0x0157717768aca88da4ac4279765f09f4d0151823d573537fbbeb950cdbd9a870
Swap (AVNU)                       0x00e316f0d9d2a3affa97de1d99bb2aac0538e2666d0d8545545ead241ef0ccab
get_data_median                   0x0024b869ce68dd257b370701ca16e4aaf9c6483ff6805d04ba7661f3a0b6ce59
domain_to_address                 0x02e269d930f6d7ab92b15ce8ff9f5e63709391617e3465fff79ba6baf278ce60
address_to_domain                 0x038b679fb029cc3f953635ed16ae4123da8214e726943920ba7706a0473e326a
get_current_epoch                 0x03beab8392e2cc92168265cc5aa060880965965816c1cbaf14549912838c9896
get_epoch_info                    0x01bce7eb49c3de7ad94478dd49629ddeac6566c3f69ac5d4f692237b5bf2c0ff
staker_pool_info                  0x027aca223b48bc87a94edf580fbe4ad386c81bb31f6810b3dcfa60bf65f8f7f8
get_staker_info_v1                0x01ffac027da63178bc6dfbc131df9716162b4369e8e023533c792bbfa5ae2b22
get_pool_member_info_v1           0x00a0ec7d248e7cac7ad635c76ae431955a3ded9d7d9da3f80ee03c5c2383d9bf
get_last_epoch_attestation_done   0x02bb03b5ea47189033e304a516edc6e44fdc7cb118253be200677182ec4c46bd
NewPoolMember                     0x015cacaf40e1ed87da5ca636ad8371422b9763884d3ea9fb51a80deeb3efee17
```

### 4.10 Dependency policy and Node version

- **Node.js 24.** The runner has v24.20.0 [C§0]. `package.json` declares `"engines":{"node":">=24"}`.
- **Recommended: no runtime dependencies at all.**
  - `dependencies` and `devDependencies` are empty, and `package-lock.json` is committed.
  - Round 1's check enforces this, and every later round re-runs it, so the rule is frozen.
  - Reasons:
    - Every selector and layout is supplied in §4.9.
    - The Starknet ID encoding is BigInt arithmetic.
    - Nothing in rounds 1 to 5 hashes or signs.
    - Fake "trading bot" repositories with malicious dependencies are a known attack [L§3].
    - starknet.js changes its API across major versions and can make RPC calls the check does not expect [C§6].
- **Alternative:** allow exactly `{"starknet": "<exact version >= 10.8.0>"}`, because versions 7 to 9 are end-of-life with advisories [S§6, §7]. This is decision D2.
- **No Telegram framework.** A `fetch` long-poll loop is about 60 lines, and grammY's core does not retry a 429 on `sendMessage` [C§6].
- **Checks** use the vendored kit plus Node built-ins only.

---

## 5. Rounds

**Front matter**, with Toddler Buddy's settings:

```
---
title: Cairn
payout: top3-60-25-15
pick: creator-in-judging
build_hours: 48
reveal_hours: 12
rank_hours: 12
---
```

| n | Title | Adds | Checked by | Prize | Usable bot after the round |
|---|---|---|---|---|---|
| 1 | Lookups | Frozen interface; `tick`, `run` and `doctor`; `/status`, `/balance`, `/tx`; group addressing; resilience; security baseline | 29 tests against the fake Telegram, the fake node and the trap | 7,000,000 | A private Starknet lookup bot |
| 2 | Wallet alerts | Watches; transfer, approval and whale alerts; `/track`; buttons; exactly-once delivery; admin gating; rate limits; `/export` and `/forget` | Event fixtures in both layouts, paging, a kill during a send, restarts, migration, 403 | 7,000,000 | Personal and treasury wallet alerts, the top-ranked gap [L§6] |
| 3 | Group feeds, prices and names | Ekubo and AVNU buy feed; Pragma prices and USD; .stark names; group budget; topics | Recorded swap layouts (direct, aggregator, multi-hop, round trip); fake Pragma and naming contracts | 8,000,000 | A buy and whale bot for project groups |
| 4 | Stakers and calm | `/staking`, stake watches, missed attestation, commission and exit, unlocks, reminders, low balance; time zone, quiet hours, digest | Fake staking, pool and attestation contracts across epochs; block timestamps drive time | 6,000,000 | A staking monitor for delegators and validators |
| 5 | Network guard and operations | Stall and recovery, reorg corrections, confirmations, failover, gap skip, `/healthz` and `/metrics`, seed and phishing guards, deploy guide | A frozen head, a replayed reorg, two fake nodes, HTTP probes, guard fixtures | 7,000,000 | An instance a community can run unattended |

**Total: 35,000,000 points, exactly the cap.**
- Round 3 is weighted up: it has the hardest decoding, and it is the feature groups install the bot for.
- A reserve is only useful if Hotpod lets a creator raise a later round's prize [unverified], because the project already has the maximum of 5 rounds. If it does, use 7 / 7 / 7 / 6 / 6 = 33,000,000 (decision D3).

The briefs for rounds 2 to 5 are published now. Each of those rounds' checks is written once the previous round settles, on top of its winner, as in Toddler Buddy.

### Round 1: Lookups (prize 7,000,000)

**Brief.** Build `node cairn.mjs`, a plain Telegram bot (no Mini App) that answers Starknet lookups from the chain and never writes to it. `ARCHITECTURE.md` is the specification, and the interface in it is frozen for every later round.

**Commands**
- `run`, `tick` and `doctor`, with the output lines and exit codes 0, 1, 2 and 3 of §4.3.
- Configuration comes only from the twelve round-1 variables in §4.4.
- A bad value, or a bad network file, exits 2 before any network call.
- A node on another chain, or one whose spec version is below 0.10, exits 2 naming what it found.

**Chat**
- **`/start` and `/help`:**
  - list every command;
  - say "On-chain facts, not financial advice." and "Public balances and transfers only.";
  - say what the operator stores;
  - link `https://t.me/<username>?startgroup=setup`.
  - A malformed `/start` payload falls back to the plain welcome.
- **`/status`:** chain, head block, its UTC time, the L1, L1-data and L2 gas prices in FRI, and the node's spec version.
- **`/balance <address>`:**
  - calls `balance_of` on every registry token, in registry order;
  - on error 21, falls back to `balanceOf`;
  - prints exact amounts;
  - says "not deployed" when `getClassHashAt` returns 20, and still shows the balances;
  - a token whose call fails shows an error for that token only.
- **`/tx <hash>`:** finality, execution status, block, fee in STRK, the revert reason (escaped) and an explorer link. An unknown hash is "not found".
- **Bad input:** an invalid address or hash is refused with a reason, before any call about it. An unknown command gets a hint pointing to `/help`.
- **Groups:** Cairn answers only `/cmd` and `/cmd@<its username>`.

**Messages**
- Every message is HTML of at most 4096 characters, with outside text escaped and link previews off.

**Robustness**
- An RPC 429, 5xx or timeout is retried with backoff (up to 3 tries, at least `Retry-After`), then answered with "node busy".
- At most `CAIRN_RPC_RPS` calls per second.
- A Telegram 429 waits `retry_after` and sends once.
- A 403 skips that chat.
- A 409 exits 1.

**Security**
- No `starknet_add*`, and no `pending` or `pre_confirmed` tag.
- Only the two configured hosts.
- Secrets never appear in output, logs, messages, files or requests to the other host.
- `CAIRN_DATA` has mode 700 and its files 600, and nothing is written outside it.
- The repository holds no token, key or seed phrase, and `package.json` has no dependency.

**Starter files:** `networks/SN_MAIN.json` (STRK, ETH, USDC, USDC.e, USDT, WBTC) and `networks/SN_SEPOLIA.json`.

**Running the checks:** `node .launchpad/checks/round-1/run.mjs`.

**Criteria**
- **Usefulness of replies (counts double):** `/status`, `/balance` and `/tx` tell a Starknet user what they need at a glance, with exact amounts and working links, in a DM and in a busy group.
- **Robustness:** every bad input, flaky node and Telegram error gets a reason a user or operator can act on, and nothing crashes.
- **Security posture:** secrets, hosts and data are handled as the brief says, including where the checks cannot see.
- **Code quality:** small, readable modules with no dependency, ready for round 2's scanner and delivery ledger.

**Checks** (test names)
1. a bad command line exits 2 with a reason on stderr, nothing on stdout and no network call
2. a missing or malformed token, API root, RPC URL, chain or numeric setting exits 2 and contacts nothing
3. a bad network file exits 2 naming the bad entry's path
4. a node on another chain than CAIRN_CHAIN, or with an RPC spec below 0.10, exits 2 naming what it found
5. doctor prints the bot's username, the chain, the head block and the RPC spec version as one JSON line
6. a token Telegram rejects exits 3 with the token nowhere in the output, and a 409 conflict exits 1
7. tick answers every pending update in order within each chat and prints its JSON summary
8. a handled update is never answered twice, across ticks, restarts and a SIGKILL after its reply
9. registers at least its own commands with setMyCommands
10. in groups it answers only commands addressed to it, and ignores plain text and other bots' commands
11. /start and /help list the commands, say the replies are on-chain facts and not financial advice, and link to adding the bot to a group
12. an unknown command gets a hint pointing to /help, and a malformed /start payload gets the plain welcome
13. /status shows the chain, the head block, its UTC time, the three gas prices in FRI and the node's spec version
14. /balance calls balance_of on every registry token in registry order and prints exact amounts, including a u256 above 2^128 and 1 wei
15. /balance falls back to balanceOf, flags an undeployed address, and shows an error for one failing token without hiding the others
16. an invalid address or hash is explained and makes no call about it
17. /tx shows finality, execution status, block, fee in STRK and an explorer link built from CAIRN_EXPLORER_URL
18. /tx of a reverted transaction shows its revert reason HTML-escaped, and an unknown hash says it was not found
19. addresses and hashes are accepted in any case, with or without leading zeros, and shown normalised
20. an RPC 429, 5xx or timeout is retried with backoff, then answered with a node-busy reply, and tick still exits 0
21. never makes more RPC calls in any one second than CAIRN_RPC_RPS
22. a Telegram 429 is retried after retry_after and the message is sent exactly once
23. a chat that blocked the bot is skipped, and other chats still get their answers
24. every message is valid Telegram HTML of at most 4096 characters, with outside text escaped and link previews off
25. run answers within 3 s, survives a node that is down for 2 s, and exits 0 within 3 s of SIGTERM during a long poll
26. never calls a Starknet write method or uses the pending or pre_confirmed tag, and contacts only TELEGRAM_API_ROOT and STARKNET_RPC_URL
27. the bot token and the secret in the RPC URL appear in no output, log, message, data file or request to the other host
28. writes only inside CAIRN_DATA, a directory of mode 700 with files of mode 600
29. the repository holds no Telegram token, private key or seed phrase, package.json has no dependency, and the committed network files are well-formed, with at least STRK, ETH, USDC, USDC.e, USDT and WBTC on SN_MAIN

**How to run it**

```
TELEGRAM_BOT_TOKEN=<your BotFather test bot> STARKNET_RPC_URL=https://starknet-rpc.publicnode.com node cairn.mjs doctor && node cairn.mjs run
```

The publicnode endpoint serves spec 0.10.3 [S§7]. This is safe because the bot is read-only.
- C1: in a DM and in a test group, try `/start`, `/status`, `/balance` on a busy address and on an empty one, and `/tx` on a success and on a revert.
- C2: send a bad address, a bad hash and an unknown command; set a wrong RPC URL; then `kill -9` the bot and restart it.
- C3: follow the token and the RPC URL through the code, then grep the logs and `CAIRN_DATA`.
- C4: read `cairn.mjs` and its imports, and imagine adding `/watch`.

### Round 2: Wallet alerts (prize 7,000,000)

**Brief.** Cairn watches wallets for a chat and delivers every alert exactly once. Round 1's commands, formats and checks stay as they are.

**Commands**
- `/watch <address> [label]` adds a watch. A label is at most 32 characters and is escaped on output.
- `/unwatch <address|label>` removes one.
- `/list` shows every subscription (watches, whales, minimums, tracks), each with a Remove button.
- `/whale <SYMBOL> <amount>` posts every transfer of that registry token at or above the amount, in token units. Mints (from 0x0) and burns (to 0x0) are labelled. `/unwhale <SYMBOL>` stops it.
- `/min <SYMBOL> <amount>` sets the chat's floor for watch alerts on that token. The default is any non-zero amount.
- `/track <hash>`:
  - posts once on L2 acceptance, with execution status and fee;
  - then once on L1 acceptance, or once on a revert with its reason;
  - says "not found" after 600 s of chain time.
- `/export` replies with `<pre>{"chat_id":…,"watches":[{"address","label","since_block"}],"whales":[{"symbol","min"}],"minimums":{"<SYMBOL>":"<amount>"},"tracks":[{"hash","since_block"}]}</pre>`, split at 4096 characters. Later rounds add keys.
- `/forget` deletes everything stored for the chat.
- **Paste to look up**, in a private chat:
  - an address gets the `/balance` reply with a Watch button;
  - a hash gets the `/tx` reply with a Track button.
- **Groups:** everything except `/list` needs an admin (§4.8). A refusal says why.
- **Caps:**
  - `CAIRN_MAX_WATCHES` watches per chat, 5 whale thresholds and 10 tracks;
  - a user's commands beyond 10 in 60 s of `message.date` get one slow-down notice and are then ignored until the window passes.

**Scanning**
- Each pass scans the blocks after the cursor, up to `CAIRN_MAX_BLOCKS` of them.
- For each registry token it uses one `starknet_getEvents` filter with keys `[[Transfer, Approval]]`, paged until no `continuation_token` comes back.
- Both layouts are parsed, chosen by `keys.length` (§4.9).
- A subscription covers only blocks after the head that Cairn read in the pass that handled its command.
- **Never alerted:**
  - zero-amount transfers;
  - fee payments: the STRK `Transfer` from the sender to its block's `sequencer_address`, which is the last event of the transaction [V];
  - transfers below the chat's `/min`.

**Alerts**
- One message per chat per transaction, in chain order. It lists each matching transfer with:
  - the token and the exact amount;
  - the direction: in or out, or "between" naming both addresses when both are watched;
  - the counterparty and the label;
  - the block time and a transaction link.
- An `Approval` by a watched owner shows the spender and the amount, or "unlimited" for an amount of at least 2^128 − 1.
- **Delivery:**
  - The key is (chat, transaction hash, `event_index`).
  - An alert is saved before it is sent, and marked sent only after Telegram accepts it.
  - After a kill, every alert arrives, and none arrives twice once accepted.

**Telegram**
- `allowed_updates` adds `callback_query` and `my_chat_member`. The new methods are listed in §4.8.
- A 403, or a `my_chat_member` update with status `kicked` or `left`, pauses the chat until it writes again or re-adds the bot.
- `migrate_to_chat_id` moves the chat's data to the new id and resends.
- `tick` adds `"alerts"` and `"cursor"` to its line.

**Criteria**
- **Alert quality (counts double):** an alert says what moved, how much, between whom and where to check. There is no dust or fee noise, and a busy wallet does not bury the reader.
- **Delivery correctness:** no lost alerts and no duplicates, through restarts, kills, node outages and paging.
- **Admin control and privacy:** group setup is obvious and members cannot change it; only what the brief allows is stored; `/export` is complete and `/forget` leaves nothing.
- **Code quality:** round 1 is reused, not copied, and the scanner and ledger are ready for round 3's swap decoders.

**Checks**
1. /watch, /list and /unwatch by address or by label add, show and remove a watch, and a watch beyond CAIRN_MAX_WATCHES is refused
2. it alerts a received and a sent transfer for a modern-layout and a legacy-layout token, with exact amounts, direction, counterparty, label and link
3. transfers in one transaction reach a chat as one alert, and a transfer between two watched addresses names both
4. nothing is alerted for events in blocks up to the head read when the watch was added
5. zero-amount transfers and fee transfers to the block's sequencer are never alerted, and /min suppresses smaller transfers
6. an approval granted by a watched address is alerted, and an amount of at least 2^128 − 1 is called unlimited
7. /whale posts every transfer of the token at or above the amount, labels mints and burns, and stops after /unwhale
8. it reads every page of getEvents and scans at most CAIRN_MAX_BLOCKS per pass, catching up over later passes without a gap
9. an alert whose send was cut by a SIGKILL arrives after the restart, and an alert Telegram accepted is never sent again
10. /track reports L2 acceptance with execution status and fee, then L1 acceptance, or a revert with its reason, and says not found after 600 s of chain time
11. a pasted address or hash in a private chat gets its lookup with a Watch or Track button, and every button press is answered exactly once
12. in groups only administrators, including anonymous ones, can change subscriptions, and a member's refusal says why
13. /export lists everything stored for the chat as JSON in the documented shape, and after /forget the export is empty
14. a group upgraded to a supergroup keeps its subscriptions under the new id and gets the alert there
15. a chat that blocked or removed the bot gets nothing until it writes again or re-adds it, and other chats are unaffected
16. a user's commands beyond 10 in 60 s of message dates get one slow-down notice and are then ignored
17. no fixture user's name or username appears in any data file

**How to run it:** on mainnet, `/watch` two addresses you control, move a little STRK between them and approve a spender. In a test group, set `/whale STRK 1000000`.
- C1: read an hour of alerts as a busy holder would.
- C2: `kill -9` the bot during a burst, restart it, and compare with the explorer.
- C3: set up the group as an admin, try the same as a member, then run `/export` and `/forget` and inspect `CAIRN_DATA`.
- C4: read how the scanner is separated from the alert rules, and imagine adding a swap feed.

### Round 3: Group feeds, prices and names (prize 8,000,000)

**Brief.** Project groups get a live feed of their token's trades, priced in USD, with Starknet ID names. Earlier rounds stay as they are.
- The network file gains `contracts.ekubo_core`, `contracts.avnu_exchange`, `contracts.pragma`, `contracts.naming`, and a `pragma_pair` per token.
- A missing contract switches its feature off, and the bot replies saying so.

**`/feed <SYMBOL|address> [<min>] [buys|all]`**
- Admin-only in groups. One feed per chat: a new `/feed` replaces the old one, and `/unfeed` stops it.
- `<min>` is a token amount (`5000`) or a USD amount (`$100`). The default is 0.
- `buys` (the default) posts buys; `all` also posts sells.
- A token outside the registry is read from its contract: `symbol` (one felt is a short string, otherwise a ByteArray) and `decimals`.

**The per-transaction rule (fixed)**
- **With AVNU.** If the AVNU exchange emitted a `Swap` involving token T:
  - net(T) = Σ `buy_amount` where T is the `buy_token`, minus Σ `sell_amount` where T is the `sell_token`;
  - the paid (or received) tokens are the other side of those Swaps;
  - the trader is the `beneficiary` of the last such Swap;
  - the venue is AVNU;
  - Ekubo events in that transaction are ignored.
- **Without AVNU.** Over all Ekubo Core `Swapped` events in the transaction:
  - d(X) is the sum of the deltas for token X; a positive d means paid into the pool [V];
  - net(T) = −d(T);
  - the paid tokens are those with d > 0, and the received tokens are those other than T with d < 0;
  - the trader is the transaction's `sender_address` (`starknet_getTransactionByHash`);
  - the venue is Ekubo.
- **Result.** net > 0 is a buy; net < 0 is a sell, posted only with `all`; net = 0 (routed through, or a round trip) posts nothing.

**The post**
- side, the exact amount of T, and the amount or amounts paid;
- the USD value, marked as approximate;
- the trader: a verified name, or the short address;
- "new holder" when the trader's `balance_of(T)` at block n − 1 was 0;
- the venue, the block time and a transaction link.

USD comes from T's own `pragma_pair` if it has one, otherwise from the paid token's pair. A USD minimum skips any trade whose USD value is unknown.

**`/price [SYMBOL…]`**
- Calls `get_data_median(SpotEntry(pair))` and scales by the `decimals` in the response.
- Shows the price's age in chain time and its number of sources.
- A price is stale beyond `CAIRN_PRICE_MAX_AGE`.
- A response with price 0 and timestamp 0 means "no price" [V].
- With no arguments: every registry token that has a pair.
- From this round, watch and whale alerts show USD values, from fresh prices only.

**Names**
- **Input:** a `name.stark` (one label of `[a-z0-9-]`) is accepted wherever an address is, through `domain_to_address`. A result of 0x0 means the name is unknown, and it is refused [V].
- **Display:** an address is shown by its reverse name (`address_to_domain`) only if that name resolves forward to the same address.
- **Cache:** lookups are cached for at most 2,000 blocks.
- **Encoding:** as in `ARCHITECTURE.md`.

**Volume and topics**
- **Group budget:** per group per pass, at most 3 messages that are not command replies. When more are due, 2 are sent, and the third is a summary of the rest (counts, totals, block range).
- **Topics:** a feed, watch or whale set up inside a forum topic posts into that topic (`message_thread_id`).

**Criteria**
- **Group fit (counts double):** a post reads at a glance on a phone, scales with trade size, and bursts never flood the group.
- **Decoding accuracy:** buys, sells, aggregator routes, multi-hop routes and round trips are counted as the brief defines, and amounts and USD values match the chain.
- **Names and prices:** they appear where they help, are never wrong, and stay quiet when unknown.
- **Code quality:** the decoders sit on round 2's scanner and ledger.

**Checks**
1. a direct Ekubo swap that pays the feed token out of the pool is posted as a buy, with the exact amount, the amount paid and the transaction sender as trader
2. an AVNU route is posted once, from its Swap event, with its beneficiary, and the Ekubo hops in the same transaction are not posted again
3. a multi-hop route through the feed token, and a round trip that nets to zero, post nothing
4. sells are posted only with all, trades under a token or USD minimum are skipped, and a trade with no USD value is skipped under a USD minimum
5. a trader whose balance was zero in the previous block is marked as a new holder
6. a token outside the registry is read from its contract, whether its symbol is a short string or a ByteArray
7. /price shows the median scaled by its own decimals, with its age and source count, flags a stale price, and says when a pair has no price
8. posts and alerts show USD values from fresh prices only
9. a .stark name is accepted wherever an address is, and an unknown name is refused with no subscription added
10. an address is shown by its name only when that name resolves back to the same address
11. without a contract in the network file, its feature says it is unavailable, and earlier replies are unchanged
12. more than 3 messages due to one group in one pass become 2 messages and a summary
13. a feed set up in a forum topic posts into that topic
14. only administrators can set or stop a feed

**How to run it:** in a mainnet test group, run `/feed STRK $100 all`. Ekubo logged 942 swaps in 500 blocks [S§5]. Then `/watch` a known `.stark` name and run `/price`.
- C1: watch an hour of posts on a phone and on a desktop.
- C2: compare five posts with the explorer.
- C3: check `/price` against Pragma, and the names against Starknet ID.
- C4: read how the decoders sit on the scanner, and imagine adding a third venue.

### Round 4: Stakers and calm (prize 6,000,000)

**Brief.** Delegators and validators see their position, and get the alerts the protocol otherwise makes them watch for by hand. Busy chats get quiet hours and a digest. Earlier rounds stay as they are.
- The network file gains `contracts.staking` and `contracts.attestation`. SN_MAIN gains strkBTC, tBTC and SolvBTC.
- `ARCHITECTURE.md` lists every staking call's felt layout as read on mainnet (§4.9), and the fakes return exactly those.
- Nothing is hardcoded from the docs.

**`/staking <address|name> [validator]`**
- **A validator** (`get_staker_info_v1` returns Some):
  - own stake, unclaimed own rewards and commission;
  - its pools by token, with delegated amounts (`staker_pool_info`);
  - its operational address and that address's STRK balance;
  - its last attested epoch;
  - its exit time, if `unstake_time` is set.
- **A delegator, with its validator:** for each of that validator's pools (STRK and BTC), read through `get_pool_member_info_v1`:
  - amount, unclaimed rewards and commission;
  - the pending unpool amount and its unlock time.
  - Unclaimed rewards are shown in STRK; that BTC pools pay in STRK is [unverified].
  - A non-member is told so.
- **A delegator, without a validator:** Cairn explains how to name one, because there is no on-chain lookup of a delegator's pools [S§3], and makes no pool calls.

**`/stakewatch <address|name> [validator] [min=<STRK>] [low=<STRK>]`** and **`/unstakewatch <address|name>`**
- At most 5 per chat. Admin-only in groups.

**Alerts**

Contracts are read once per epoch per watch, when `get_current_epoch` changes. Chain-time conditions are checked on every pass, from the stored values.
- **Missed attestation:** `get_last_epoch_attestation_done(staker)` is below the epoch that just ended. The alert says "validator X did not attest in epoch E; that epoch pays it and its delegators nothing". Once per chat, staker and epoch.
- **Commission change** (old and new values) and **exit intent** (`unstake_time` becomes set): once each.
- **Unclaimed rewards** at or above `min`: one reminder, not repeated within 7 days of chain time.
- **Unlock complete:** at the first pass whose head timestamp reaches `unpool_time`, once. The alert names `exit_delegation_pool_action` and links nothing that signs.
- **Low operational balance:** below `low` (default 10 STRK), once until it recovers.

**Calm**
- **`/tz <±HH:MM>`** sets the chat's UTC offset. Allowed values run from −12:00 to +14:00; the default is +00:00. There is no daylight saving.
- **`/quiet <HH:MM-HH:MM>|off`**, in local time:
  - alerts whose block falls inside the window are held and saved;
  - they are sent in order, as one summary split at 4096 characters, at the first pass after the window.
- **`/digest <HH:MM> [only]|off`:** one digest a day, at the first pass whose head time is at or after that local time. It covers the previous 24 h of chain time:
  - counts and totals per alert kind;
  - the biggest transfer;
  - the number of buys and the biggest buyer;
  - the feed token's price change.
  - With `only`, live alerts are held and folded into the digest.
- All of these are admin-only in groups. `/export` and `/list` gain these keys.

**Criteria**
- **Staker usefulness (counts double):** a delegator or validator learns what changed, what it costs them and what to do next, without being told what to buy, sell or whom to pick.
- **Correctness on chain time:** epochs, unlocks, reminders, quiet hours and digests fire once, at the right block.
- **Calm:** digests, quiet hours and reminders keep alerts few, and lose none.
- **Code quality:** the staking reads sit cleanly beside rounds 2 and 3, behind one adapter for when Staking v3 arrives.

**Checks**
1. /staking of a validator shows its own stake, commission as a percentage, its pools by token, its operational balance and its last attested epoch
2. /staking of a delegator with its validator shows each STRK and BTC pool's amount, unclaimed rewards and pending unlock, read through the Option getter
3. /staking of a delegator without a validator explains how to name one and makes no pool calls, and a non-member is told so
4. a validator that did not attest in the epoch that just ended triggers one alert per watching chat, naming the epoch
5. a commission change and an exit intent are each alerted once, with old and new values
6. an unlock alert arrives at the first block whose timestamp reaches the unlock time, once, and never before
7. an unclaimed-rewards reminder fires at the threshold and not again within 7 days of chain time
8. a low operational balance is alerted once, until it recovers
9. outside commands, staking contracts are read at most once per epoch per watch
10. alerts inside quiet hours arrive as one summary after the window, in order, with none lost across a restart
11. a digest arrives once a day at the chat's local time by block timestamps, and digest-only mode holds live alerts for it
12. /tz accepts offsets from −12:00 to +14:00 and refuses anything else
13. only administrators can set stake watches, quiet hours and digests in groups, and the bot never sends a signing link

**How to run it:** on mainnet, run `/staking` on a known validator and on one of its delegators. Then `/stakewatch` both overnight, with `/tz`, a `/quiet` window and a `/digest` set.
- C1: read the card and the alerts as a delegator.
- C2: compare the numbers with the contracts or the explorer.
- C3: read the morning digest and the quiet-hours summary.
- C4: imagine Staking v3's entrypoints.

### Round 5: Network guard and operations (prize 7,000,000)

**Brief.** Cairn says when the chain itself misbehaves, corrects itself after reorgs, protects members, and runs unattended. Earlier rounds stay as they are.

**Network alerts**
- `/network on|off` subscribes a chat. Admin-only in groups.
- **Stall:** when the head block number has not changed for `CAIRN_STALL_SECONDS` of wall clock (measured across passes and restarts), subscribed chats get one "no new block since <time>" alert.
- **Recovery:** when blocks resume, they get one alert giving the stall's length.
- **Node unreachable:** when every endpoint fails, only `CAIRN_OPERATOR_CHAT` is told, once per outage. Subscribers never are.

**Reorgs**
- Cairn keeps the hashes of the last `CAIRN_REORG_DEPTH` processed blocks.
- When the node's hash for a stored block differs, Cairn walks back to the common ancestor and rescans from there.
- For every alert sent from a replaced block whose transaction the node no longer finds, Cairn sends one correction, as a reply to that alert.
- A transaction that was re-included gets no correction and no second alert.
- New events in the replacement blocks are alerted once.
- `/network` chats are told the reorg's depth.

**Other options**
- **`CAIRN_CONFIRMATIONS`:** scan only blocks that deep.
- **`CAIRN_MAX_GAP`:** when the cursor falls more than this many blocks behind, Cairn skips ahead and sends one notice per subscribed chat naming the skipped range.
- **Failover:**
  - `STARKNET_RPC_URLS` replaces `STARKNET_RPC_URL`;
  - when one endpoint's retries are exhausted, Cairn moves to the next;
  - endpoints that report different chains exit 2.
- **Health:** when `CAIRN_HTTP_PORT` is set, Cairn listens on `CAIRN_HTTP_HOST`:
  - `GET /healthz` returns 200 `{"ok":true,"head":n,"lag_s":n}`, or 503 `{"ok":false,"reason":"stalled"|"rpc"|"telegram"}`;
  - `GET /metrics` returns Prometheus text with `cairn_head_block`, `cairn_updates_total`, `cairn_messages_sent_total`, `cairn_alerts_total` and `cairn_rpc_errors_total`;
  - nothing else is served.

**Guards**

Both are on by default. In groups the bot must be an admin to see and delete messages.
- **Seed phrases:** a message containing a run of 12, 15, 18, 21 or 24 words, all from `wordlists/bip39-english.txt` (list numbering and punctuation ignored), is deleted with `deleteMessage`. The bot answers with a warning that repeats none of the words. The words are never stored or logged.
- **Phishing links:** a `url` or `text_link` entity whose host is, or sits under, a domain in `CAIRN_BLOCKLIST` is deleted, with a warning. The starter list is starknet-bot.com, app-stark.online and starknet.portal-drops.icu [L§3].
- **Switches:** `/guard seed|links on|off`, admin-only.
- **Without delete rights,** the bot still warns, and says which right it needs.

**README** adds BotFather setup, how to choose an RPC (a `/rpc/v0_10` path where the root serves 0.9 [S§1]), a Dockerfile and a systemd unit.

**Criteria**
- **Trustworthiness under failure (counts double):** stalls, reorgs and dead endpoints are each reported once and accurately, and alerts are corrected when the chain changes its mind.
- **Operability:** health, metrics, failover and the deploy guide let a community member run it unattended.
- **Member safety:** the guards catch seed phrases and listed links with no false alarms, and never repeat what they protect.
- **Code quality:** earlier rounds reused; one loop, not five.

**Checks**
1. a head that stops advancing for CAIRN_STALL_SECONDS gives one stall alert, and the next block one recovery alert with the stall's length
2. an unreachable node notifies only CAIRN_OPERATOR_CHAT, once per outage, never subscribers
3. a reorg that drops a transaction sends one correction replying to its alert, and none for a transaction re-included in another block
4. after a reorg, transfers in the replacement blocks are alerted once, and none already alerted is sent again
5. with CAIRN_CONFIRMATIONS=3, a transfer is alerted only once its block is 3 deep
6. a cursor more than CAIRN_MAX_GAP behind skips ahead with one notice per subscribed chat
7. a dead first endpoint fails over to the second, and endpoints on different chains exit 2
8. /healthz returns 200 when healthy, and 503 with a reason during a stall or when no node answers, and /metrics counts sent messages
9. the HTTP endpoint listens on 127.0.0.1 only, on the port it logs, and nothing listens without CAIRN_HTTP_PORT
10. a 12- or 24-word seed phrase is deleted and answered with a warning that holds none of its words, and the phrase appears in no file or log
11. ordinary sentences, addresses and hashes never trigger the seed guard
12. a link to a blocklisted domain or its subdomain is deleted with a warning, and other links are untouched
13. without delete rights the bot still warns and names the right it needs, and only administrators can switch guards

**How to run it:** deploy with Docker from the README alone, against two RPC endpoints, and run `/network on` in a test group.
- C1: stop one endpoint and read `/healthz`, then read the stall and reorg messages the checks' fixtures produce.
- C2: follow the guide from scratch on a fresh machine.
- C3: paste a made-up 12-word phrase (generated, never a real one) and a listed link, in a DM and in a group.
- C4: read how reorg handling touches round 2's ledger.

---

## 6. How the checks run offline

**Runner.**
- **Image:** `mcr.microsoft.com/playwright:v1.63.0-noble`, with Node v24.20.0 and Python 3 stdlib only.
- **Network:** `--network none`; loopback works.
- **Filesystem:** read-only, except scratch and HOME.
- **Resources:** 2 CPUs, 2 GB, at most 600 s per check.
- Each round's folder is `.launchpad/checks/round-<n>/`. It holds:
  - `run.mjs`;
  - `check.json`, with `"timeoutSeconds": 300` and the test names above;
  - `lib/` (the vendored kit);
  - `fake-telegram.mjs`, `fake-starknet.mjs` and `trap.mjs`;
  - `fixtures/`: recorded mainnet felts for every layout in §4.9.
- Checks never import entry code. They run `node cairn.mjs …` as child processes.

**Fake Telegram Bot API** (about 150–170 lines, `node:http` only; a tested 183-line prototype exists [T§10])
- Listens on `127.0.0.1:0` and routes `/bot<token>/<method>`. A wrong token gets 401 and an unknown method 404.
- Accepts JSON, urlencoded and query parameters.
- `getUpdates`:
  - honours `offset` (that is the confirmation), `limit`, `timeout` and `allowed_updates`;
  - holds a request until an update arrives or `min(timeout, 1 s)` passes;
  - returns 409 to a second concurrent poll.
- Validates like Telegram:
  - HTML tags and entities;
  - 1 to 4096 UTF-16 units after parsing;
  - `callback_data` at most 64 bytes;
  - rejects `web_app` and `login_url` buttons.
- **Failure injection:** 429 with `retry_after`, 403, 400 with `migrate_to_chat_id`, "message is not modified", and `hold` (never answers, for kill tests).
- **Builders:** private, group, supergroup and forum-topic messages; anonymous-admin messages; callbacks; `my_chat_member`; members with roles.
- **Readers:** `sent`, `to(chat)`, `next(chat, {ms})`, `calls`.

**Fake Starknet node** (about 220–260 lines plus about 60 lines of helpers)
- One POST route at any path, so the check can put a secret marker in the path: `http://127.0.0.1:<port>/rpc/v0_10/SECRET-RPC-KEY-7f3a`.
- Accepts batches, and named or positional parameters.
- **Chain model:**
  - blocks (number, hash, timestamp, `sequencer_address`, gas prices);
  - contracts (class hash; call handlers keyed by selector, block-aware);
  - transactions (finality, execution status, fee, sender, revert reason, events with `event_index`).
- `getEvents` returns **at most 5 events per page**, with a continuation token, so every entry must page.
- Spec error codes; rejects `pending` and `pre_confirmed` with -32602.
- **Injection:** 429, 503, delay, garbage, dropped connections, `down(ms)`, `freeze()` (the head stops), `reorg(fromBlock, newBlocks)`.
- Records every request. Any `starknet_add*` call is a violation.
- **Fake contracts:** ERC-20s in both layouts, Pragma (including the zero answer for an unknown pair), naming, Ekubo and AVNU event emitters, and staking, pool and attestation contracts that return exactly the §4.9 layouts.

**Trap** (`trap.mjs`, about 35 lines)
- Passed as `NODE_OPTIONS=--import=<absolute path>`.
- Logs `dns.lookup` and `dns.promises.lookup`, `net.connect`, `tls.connect` and `Socket.prototype.connect` to a file in scratch [C§0, C§2].
- An unknown host fails fast offline (`EAI_AGAIN` or `ENETUNREACH`, about 100 ms) [C§0].

**How a test runs**
1. `world()` starts both fakes on loopback.
2. It writes a network file that points at the fake contracts.
3. It picks a fresh, not-yet-existing `CAIRN_DATA` under scratch, which the bot creates as user 1000.
4. It sets an environment holding the token marker and the RPC secret marker.
5. About 80% of tests then drive `tick` through the kit's `entry()`, with no sleeps.
6. `run` tests set `CAIRN_POLL_MS=100` and `CAIRN_TG_TIMEOUT=1`, wait with deadline loops, and prove that something did *not* happen with a barrier: a later `/status` and its reply. They stop the bot by killing its process group.
7. Rate tests use loose bounds: at most RPS + 1 calls in any 1 s, and a resend no earlier than 900 ms after `retry_after: 1`.
8. Ordering is asserted only within a chat. Tests run one after another.

**Compatibility rules**, so that round n's winner keeps passing rounds 1 to n−1:
1. **Round 1's fakes already serve every method any round uses:** the full Bot API list in §4.8 and every RPC method in §4.9, with empty or plausible answers.
2. **Checks assert "at least"** for anything later rounds grow: command lists, help text, JSON keys, network-file keys, export keys.
3. **Checks look only at calls about the input under test,** never at total call counts, because later rounds add background scanning.
4. **Unknown-command tests use `/zz_unknown`.**
5. **No round adds an outbound host** except through an opt-in `*_URL` variable that is off when unset.
6. **Each round copies the fakes into its own folder** and extends the copy. Earlier folders never change.
7. **Fixture commands from one user are at least 7 s of `message.date` apart,** except in the rate-limit test. Round 2's limit is 10 per 60 s.
8. **No earlier check sends more than 3 non-reply messages to one group in one pass.** Multi-alert scenarios use private chats, because round 3's budget applies to groups.
9. **Fixture block timestamps start at a fixed 2026-10-20T00:00:00Z** and advance about 2 s per block. Nothing before round 5 depends on the wall clock, and round 5's stall rule uses the time the head stayed unchanged, not block timestamps.
10. **No earlier fixture contains a run of 12 or more BIP-39 words, or a link to a blocklisted domain.** Earlier checks never set quiet hours, digests or later variables.

**Size**
- Round 1's `run.mjs` will be about 800 to 1,000 lines plus the fakes, against Toddler Buddy's 584 [C§2].
- Each round's checks must finish within 300 s on 2 CPUs, since every round re-runs all earlier ones.

---

## 7. Risks and open decisions

| # | Risk or decision | Recommended default | Confidence |
|---|---|---|---|
| D1 | **Name and handle.** No trademark or @handle search has been run, and "StarkBot" is taken [L§1] | Cairn, with no "stark" or "starknet" in the handle. Search before the launch form; fall back to Kestrel or Murmur | unknown |
| D2 | **Dependency policy**, frozen forever by round 1's check | No runtime dependencies. Alternative: exactly `starknet` at a version of at least 10.8.0. Decide before round 1 is committed | moderate |
| D3 | **Prize split** | 7 / 7 / 8 / 6 / 7 = 35,000,000. With 5 rounds already, a reserve only helps if Hotpod lets a creator raise a later round's prize [unverified]; if so, use 7 / 7 / 7 / 6 / 6 = 33,000,000 | high (arithmetic) |
| D4 | **Can the entry reach the check's loopback fakes when the two run as different users inside the gate?** Everything depends on it [T§10] | Prove it with a 30-line probe through `runner/gate.mjs` before writing any round-1 check | unknown |
| D5 | **Does `NODE_OPTIONS=--import=trap.mjs` survive the kit's clean environment?** | Pass it explicitly in `env`. If it is stripped, fall back to the fakes' logs plus a static scan for URLs | moderate |
| D6 | **Round 1 is big:** 29 tests | Keep it. If the private reference build takes more than 6 h, move the `/status` gas prices and the RPS test to round 2 | low |
| D7 | **Facts still unverified that checks depend on** | Settle each before its round: the Starknet ID trailing-`a` rule and vectors (R3); the reward token of BTC pools (R4); the anonymous-admin rule (R2); the BIP-39 wordlist licence (R5); Voyager link paths (R1, links only). All other layouts in §4.9 were verified today | high (that each needs a check) |
| D8 | **Staking v3 / v0.15 lands mid-project.** The September 2026 target slipped, with no new date [S§1] | Round 4 pins the deployed entrypoints verified today, behind one adapter. If v3 deploys before round 4 opens, re-verify and amend the brief | high (that it slipped) |
| D9 | **Feed coverage is partial:** only Ekubo and AVNU. AVNU accounts for 62% of transactions [L§1]; JediSwap, 10KSwap, Nostra, StarkDefi and a prop-AMM are missed [S§5] | Say "Ekubo and AVNU only" in `/help` and the README; add venues later (L08) | high |
| D10 | **A buyer can be a contract.** In 10 of 15 sampled AVNU swaps, the taker and beneficiary was a contract driven by a bot account [V] | Show the beneficiary as the trader, as the rule defines. Judges assess how a contract trader reads | moderate |
| D11 | **Hosting a public instance.** An operator can link Telegram ids to wallets, and Telegram may disclose data on valid orders [L§3]. Vercel cannot host a long poller | Self-hosting is the main path. Hotpod may run one community mainnet instance on a small VM after round 2, with a privacy note and `/forget` | moderate |
| D12 | **RPC capacity.** Public endpoints publish no limits; Blast and Lava are gone; ZAN's root serves 0.9 [S§7] | No default RPC. The README lists publicnode, Cartridge and ZAN `/rpc/v0_10`; a hosted instance uses a keyed provider plus publicnode in `STARKNET_RPC_URLS` | moderate |
| D13 | **A buy feed reads as promotion or advice** | Neutral copy, admins opt in, no trending, rankings or buy buttons, and the disclaimer in `/help`. A hosted instance is never paid to feature a token | moderate |
| D14 | **Telegram tightens rules for plain bots** | Stay a plain read-only bot with no wallet connection and no payments: the least exposed shape [T§0] | low (that rules extend) |
| D15 | **Pacing** | No advance throttle: honour `retry_after`, and rely on the round-3 group budget. Revisit if the pilot sees frequent 429s | moderate |
| D16 | **Starknet account-abstraction showcase** (signing links, multicall, paymaster) | A follow-up project, "Cairn Actions", after an independent review of round 5's winner, and only once the Wallet API and SNIP-29 shapes are verified and an in-browser check has been proven in the runner | moderate |
| D17 | **Prices for BTC wrappers.** Pragma has no TBTC/USD or SOLVBTC/USD (zeros) [V] | No USD value for tBTC or SolvBTC. strkBTC uses BTC/USD, labelled as an assumed peg | moderate |
| D18 | **Pilot audience** | Hotpod's own Starknet community group after round 2; the StarkWare Trading Guild [L§5] and two validator operators after round 4 | moderate |
| D19 | **Judges' setup** | Each judge uses their own BotFather test bot, a throwaway group and the public mainnet RPC. This is safe because the bot is read-only | high |
| D20 | **Licence** | MIT, matching unrug-tg-bot, Starky and StarknetFeed [L§1] | moderate |
| D21 | **The research prototypes live only in this session's scratchpad** (the fake Bot API in `tg/verify/`, `tgprobe/` with `trap.mjs`, and `sn-research/rpc.py` with the keccak and selector helper) | Copy them into the creator's private folder now. The round-1 reference implementation is never published | high |

**Verified for this spec on 12 Oct 2026 [V]:**
- every selector in §4.9;
- the fee payment as a STRK Transfer to `sequencer_address` (8 transactions);
- the Ekubo delta sign (14 transactions);
- AVNU taker and beneficiary (15 transactions);
- Approval and Transfer layouts for all registry tokens, including SolvBTC (legacy), and strkBTC and tBTC (modern);
- Pragma pairs (USDT/USD and WBTC/USD exist; unknown pairs return zeros);
- Starknet ID unknown-name and no-name results;
- the staking, pool and attestation layouts and the epoch info;
- the Sepolia naming address.