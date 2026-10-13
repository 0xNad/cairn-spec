# Cairn: feature list

Extracted from [SPEC.md](SPEC.md) §3 (2026-10-12). Internal draft: not published.

**Revision, 12 Oct:** the Stakers round (F36–F45: staking cards and alerts, quiet hours, digest, time zones) is dropped by PM decision. Network guard is now round 4. Prizes: 9M / 9M / 9M / 8M = 35M.

**Revision, 13 Oct (review):**
- **Round 2 covers every token.** It watches every ERC-20 on Starknet, not only the registry (F13, F15–F17), using one chain-wide events filter.
- **Unverified tokens are handled.** Tokens outside the registry are read from their contract, marked unverified, and can be muted (F56). `/balance` takes any token (F57).
- **Round 3's trader comes from the token's `Transfer` flows**, never from the transaction's sender (F26).
- **Judging is longer:** `rank_hours` is 48.

**Priority**
- **must:** in the round's brief, and checked.
- **should:** in the brief and checked, but the first item to move to a later round. It moves if the creator's private reference build of that round runs past about 6 h, and the call is made before the round's checks are committed.
- **could:** not in rounds 1 to 4.

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

### Round 2: Wallet alerts, every token

| ID | Feature | Command or trigger | Persona | Priority | Verified by |
|---|---|---|---|---|---|
| F12 | Watch list with labels, and a list with Remove buttons | `/watch <address> [label]`, `/unwatch <address\|label>`, `/list` | H, A | must | check |
| F13 | Transfer alerts in and out for **every ERC-20 on Starknet**, registry or not, in both event layouts, through one chain-wide events filter; one message per transaction per chat | `Transfer` event | H | must | check + rubric |
| F14 | Noise floor: zero-amount transfers (address poisoning) and fee transfers are never alerted | automatic | H, A | must | check |
| F15 | Per-chat token floor, for any token | `/min <SYMBOL\|token address> <amount>` | H, A | should | check |
| F16 | Approval alerts for a watched owner, on any token, with an "unlimited" flag | `Approval` event | H | must | check |
| F17 | Whale alerts on any token, with mints and burns labelled | `/whale <SYMBOL\|token address> <amount>`, `/unwhale <SYMBOL\|token address>` | A | must | check |
| F56 | Tokens outside the registry: symbol and decimals read from the contract and cached; shown as unverified, in code, with the contract linked; contracts without valid decimals (legacy NFTs) ignored; per-chat mute | `/mute <token address>`, `/unmute <token address>` | H, A | must | check + rubric |
| F57 | Any-token balances: an optional token argument, and the tokens seen moving for a watched address | `/balance <address> [SYMBOL\|token address]` | H | should | check |
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
| F26 | Post content: side, amount, amount paid, USD value, trader (the account whose balance of the token changed, never the transaction's sender), venue, time, link | each trade | A, H | must | check (fields) + rubric (look) |
| F27 | New-holder flag | the trader's balance was 0 in the previous block | A | should | check |
| F28 | Feeds on tokens outside the registry, reusing round 2's contract reading (F56) | `/feed <address>` | A | must | check |
| F29 | On-chain price from Pragma with its age and source count; stale flag; "no price" for an unknown pair | `/price [SYMBOL…]` | H, A | must | check |
| F30 | USD values in alerts and posts, from fresh prices only | display | all | must | check |
| F31 | Starknet ID names accepted wherever an address is | `name.stark` | all | must | check |
| F32 | Reverse names shown only when they round-trip | display | all | must | check |
| F33 | Group budget: at most 3 messages per group per pass, the last one a summary | automatic | A | must | check |
| F34 | Posts go to the forum topic where they were set up | `message_thread_id` | A | should | check |
| F35 | A feature whose contract is absent says so, without exiting | network file | O | must | check |

### Round 4: Network guard and operations

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

| ID | Feature | Why not in rounds 1 to 4 |
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


### Dropped 12 Oct (was round 4, "Stakers and calm")


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

