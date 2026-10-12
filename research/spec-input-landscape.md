# Starknet Telegram bots: landscape, gaps and candidate features (as of 2026-10-12)

**Confidence key:** H = high, M = moderate, L = low. The confidence label applies to the claim it follows.

**Limits of this research.** X/Twitter pages returned HTTP 402, and I could not read the contents of Telegram groups. That means the demand evidence is mostly indirect: forum threads, governance minutes, polls, feedback boards and gaps between products. I found no thread where Starknet users ask for "a Telegram bot" by name (M).

---

## TL;DR

1. **The rule that decides the design.** Since 21 Jan 2025, Telegram Mini Apps may use only TON for tokens and wallets. Existing apps had to migrate by 21 Feb 2025. The rules exempt "regular Telegram bots that do not have a Mini App component." A Starknet bot must therefore be a plain bot with **no Mini App**, and any signing must happen on an external web page (H). Source: https://core.telegram.org/bots/blockchain-guidelines
2. **The best-funded Starknet Telegram effort is dead.** Argent/Ready's Telegram Wallet and SDK are marked "DEPRECATED … due to new Telegram rules" (H). Sources: https://docs.ready.co/argent-wallets/telegram-wallet and https://www.npmjs.com/package/@argent/tma-wallet
3. **What exists on Starknet today is thin.** I found Tengu (Extended perps over Telegram), the Unruggable `/unrug` checker, hobby news and AI-chat bots, and airdrop-farming bots, some of which look like malware lures. I found no Starknet buy bot, whale or wallet-alert bot, staking monitor, or Telegram token-gating (M, based on absence of evidence).
4. **Other chains show what works.** The killer features are fast action from an alert, wallet following and PnL, social proof in groups (buy pings, leaderboards), and referral revenue share. Almost all the big trading bots hold users' keys. That custody model is the main source of losses: Maestro, Unibot, Banana Gun, Solareum, Nova and SIGMA (H).
5. **The Starknet-specific gaps with the best evidence:**
   - staking monitoring (rewards must be claimed by hand, an epoch with no attestation pays zero, exit takes 7 days)
   - network outage and reorg alerts
   - lending health and oracle-anomaly alerts after the September 2026 Vesu and Nostra incidents
   - governance notifications (only 8–9% of delegates voted)
   - group token feeds and token-gating (M)
6. **Recommended shape.** A read-only, open-source, self-hostable alert and community bot first. Transactions, if any, go through signing links, or later through scoped session keys (spending limits, expiry). The bot never holds keys (M).

---

## 1. Existing Starknet Telegram bots and Mini Apps

| Name | What it does | Open source | Status (Oct 2026) | Source | Conf. |
|---|---|---|---|---|---|
| Argent / Ready Telegram Wallet + SDK | Self-custody wallet embedded in Telegram: send, gift, add funds, biometric unlock, session keys for Mini Apps | SDK on npm | **Deprecated.** The docs say it stopped working "due to new Telegram rules"; the npm package is marked unsupported | https://docs.ready.co/argent-wallets/telegram-wallet, https://www.npmjs.com/package/@argent/tma-wallet | H |
| Argent Telegram Accelerator (late 2024) | $25k grants for up to 20 Mini App teams built on the Argent TG wallet and Starknet; applications closed 1 Nov 2024 | n/a | Cohort lost its wallet SDK when the TON rule took effect | https://mpost.io/argent-launches-telegram-accelerator-program-offering-25000-grants-to-mini-app-developers/, https://www.ready.co/blog/argent-telegram-accelerator | M |
| Zap-Stark (@ZapStarkBot) | Mini App for AVNU swaps with Dynamic self-custody wallets and sponsored gas; prize winner at ETHGlobal StarkHack | Yes (github.com/Open-Sorcerer/zap-stark) | Unknown. As a non-TON Mini App it has been non-compliant since Feb 2025 | https://ethglobal.com/showcase/zap-stark-8w8q6 | L (status) |
| Unruggable Meme bot (@unruggable_meme_bot) | `/unrug <address>` returns an "unruggability" verdict, market cap and team allocation for tokens launched via Unruggable | Yes, MIT, TypeScript, 5 stars (keep-starknet-strange) | Repo not archived; usage unknown | https://github.com/keep-starknet-strange/unrug-tg-bot | M / L (activity) |
| Tengu | Telegram trading bot for Extended perps: market and limit orders, leverage, positions; wallet via Turnkey auth | Not found | Live; named in Starknet's 2025 Year in Review (22 Dec 2025) | https://www.starknet.io/blog/starknet-2025-year-in-review/, https://www.alchemy.com/dapps/tengu | M |
| StarkBot (@starkbotapp) | AI DeFi chatbot: balances, transfers, Ekubo swaps (Voyager API); Brian-AI MVP Nov 2024; fees paid in STRKBOT token | Hackathon code only | Unclear (X unreachable) | https://ethglobal.com/showcase/starkbot-k5ema | L |
| StarknetFeed | Sends scraped Starknet news and tweets to subscribers on Telegram | MIT, 1 star | Hobby project | https://github.com/Signor1/StarknetFeed | M |
| Starky | Token-gating with Starknet assets (signature verification) | MIT, 35 stars, 88 forks, hosted at starky.wtf | Active, but **Discord only** | https://github.com/nmalzieu/starky | M |
| Collab.Land | Telegram token gating | No | Starknet support not documented | https://docs.collab.land/help-docs/set-up-the-bot/telegram-setup | L |
| @starknetairdropbot and GitHub "starknet-airdrop-bot-2026" | Airdrop-farming automation (swaps, LP, mints, multiple accounts) | The GitHub repo has no source code | The repo points users to an `.exe` on an outside domain inside a password-protected archive, from a 0-star throwaway account. These are malware-lure signs | https://github.com/validmozzarel/starknet-airdrop-bot-2026 | M–H (red flags) |
| Snak (KasarLabs), starknet-agentic (keep-starknet-strange) | Agent frameworks for Starknet; Snak sends alerts to **Discord**; starknet-agentic has session-key and Controller skills | Yes | Active as frameworks; not end-user Telegram bots | https://glama.ai/mcp/servers/KasarLabs/snak, https://tomevault.io/tome/keep-starknet-strange/starknet-agentic | M |
| Braavos, Ready, Starknet ID, AVNU, Ekubo | No official Telegram bots found. Braavos has mobile push notifications; Starknet ID is active | — | — | https://braavos.app/enhanced-smart-contract-wallet-experience-with-braavos-3-latest-features-and-starknet-update/, https://thegrid.id/profiles/starknet_id | M |

**Building blocks that exist today**
- **Starkscan API**, public beta since 15 Jun 2026. Decoded balances, transfers, events and privacy-pool activity; free API key during beta; explicitly aimed at agents and monitoring (M). https://www.starknet.io/blog/starkscan-explorer-data-api/
- **Voyager API.** Event activity and token transfers; contract transfer queries are capped at a 90-day window; free key via a request form (M). https://docs.voyager.online/
- **Starknet RPC WebSockets.** Juno supports `subscribeEvents`, `subscribeNewHeads` and `subscribeTransactionStatus`; Pathfinder has `pathfinder_subscribe` (H). https://juno.nethermind.io/websocket/
- **Apibara DNA v2.** Default version since mid-2025; hosted cloud available (M). https://www.apibara.com/docs/networks/starknet
- **AVNU APIs.** Swap, DCA and Staking on v3, plus a gasless/"gasfree" Paymaster (M). https://docs.avnu.fi/api/overview
- **Starkzap SDK.** Privy or Cartridge social login; swap, stake, lend, bridge and private transfers (M). https://docs.starknet.io/build/starkzap/
- **Session keys.**
  - Braavos session keys (27 Nov 2024) scope contracts and methods, spending limits and time windows, and the post cites "algorithmic investment bots" as a use case (H). https://braavos.app/braavos-session-keys/
  - A standard session-key SNIP was drafted on 17 Feb 2026. It is pre-audit and no wallet has committed to it; current implementations differ across Argent, Braavos and Cartridge (M). https://community.starknet.io/t/snip-session-keys-for-smart-accounts/116132

**Ecosystem context that matters for bot design**
- **Activity (Nansen H1 2026 report, 4 Aug 2026):** about 50k daily active addresses and about 239k daily transactions in Q2 2026. AVNU accounts for 62% of transactions. STRK20 privacy and strkBTC launched. Perps on Extended, edgeX and Paradex total about $980B cumulative (M). https://nansen.ai/post/starknet-h1-2026-report
- **Staking:** 1.1B STRK staked (23% of circulating supply) and 1,700 BTC staked by Dec 2025 (M). https://www.starknet.io/blog/starknet-2025-year-in-review/
- **Staking v2 mechanics** (H). https://docs.starknet.io/learn/protocol/staking.md
  - one attestation per epoch; an epoch without one pays the validator nothing ("all or nothing")
  - delegators and validators must claim rewards by hand
  - 7-day lockup after an unstake intent
  - commission increases are governed by commitments
  - Staking v3, with validators validating blocks, is targeted for late 2026
- **Delegation program:** requires 99% liveness on Track A and 99.5% on Track B (2026-02-03) (M). https://starkware.co/blog/the-starkware-delegation-program-enters-its-next-phase/
- **Outages:**
  - 2 Sep 2025: about 9 hours after the Grinta upgrade, with two reorgs (M). https://www.theblock.co/post/384294/starknet-outage-second-major-disruption-since-grinta-rollout
  - 5 Jan 2026: about 4 hours, with a revert to block 5,187,263 (M). https://decrypt.co/353625/ethereum-layer-2-starknet-back-online-outage
- **Oracle incidents:**
  - 4 Sep 2026: a bad Pragma price feed caused 47 abnormal liquidations on Vesu, about $3M of collateral (M). https://whale-alert.io/stories/c1e301a7eefe69/Vesu-says-faulty-Pragma-oracle-caused-3-million-in-abnormal-liquidations-on-Starknet-lending-pools
  - 18 Sep 2026: NSTR oracle manipulation on Nostra let an attacker borrow $3.5M (M). https://www.altcoinbuzz.io/nostra-s-3-5m-oracle-borrow-is-starknet-s-second-in-two-weeks
- **STRK20 privacy** (since 10 Mar 2026): shielded balances and transfers, with viewing keys. Wallet trackers will see only flows into and out of the shielded pool (M). https://www.theblock.co/post/404008

---

## 2. The most-used Telegram crypto bots on other chains

| Bot | Type | Chains | Custody | Killer features | Scale | Source | Conf. |
|---|---|---|---|---|---|---|---|
| Trojan | Trading | Solana | Hot wallet held by the bot | Copy trading, limit orders, DCA, MEV protection, up to 10 wallets, referrals up to 35%; web "Terminal" added in 2026 | $23.4B volume, 1.7M users (Jul 2025) | https://www.coingecko.com/learn/top-telegram-trading-bots | M |
| BONKbot | Trading | Solana | Hot wallet | Simple UX, limit orders, DCA, trailing stop, MoonPay on-ramp | $13.8B, 519k users | same | M |
| Maestro | Trading | 9 chains incl. ETH, BSC, SOL, Base, TON | Hot wallet | Sniping, copy trading, wallet tracking, call-channel integration, $200/mo premium | $12.8B, 573k users | same | M |
| Banana Gun | Trading | SOL, ETH, Base, BSC and others | Hot wallet | Auto-snipe, anti-rug, MEV-resistant swaps, token rebates | $11.4B, 502k users (Jul 2025); about $16B and 1.3M users reported Mar 2026 | same; https://ambcrypto.com/top-11-telegram-trading-bots-of-march-2026/ | M / L |
| Cielo | Wallet tracker | "30+ chains"; **no Starknet** in the Sep 2026 refresh | Read-only | Live feed of followed wallets, PnL per wallet and token, Telegram/Discord/email alerts. Free tier: 1 bot, 120 alerts/hr. Pro $59/mo, Whale $199/mo | 500k users | https://madeonsol.com/blog/how-to-use-cielo-wallet-tracking, https://www.quicknode.com/builders-guide/tools/cielo-finance-by-cielo | M |
| Whale Alert | Large-transfer feed | Many chains; Starknet not found | Read-only | Public channel of big transfers | 3M+ users | https://chainstack.com/how-whale-alert-scaled-blockchain-alerts/amp/ | L (coverage) |
| Buy bots (BuyBot, D.BuyBot, Balancer Pool Buy Bot) | Community | EVM and SOL | Read-only | Buy pings in the group (size, USD value, truncated buyer address, emoji) as social proof; caller and buyer leaderboards ("Sect"-style) | Used by nearly every token group | https://docs.balancer.fi/tools/core/buy-bot.html, https://medium.com/@tripwireonfire/how-to-successfully-launch-a-memecoin-in-2025-using-bots-and-tools-to-build-early-momentum-197c2170818a | M |
| Combot, Shieldy, Rose | Moderation | n/a | n/a | CAPTCHA, CAS global spam list, antiflood and antiraid, analytics. Shieldy is open source (1inch). Combot is free up to 200 members, then $5/mo+ | Shieldy 200k+ monthly users | https://metricgram.com/blog/telegram-anti-spam-bots | M |
| Collab.Land | Token gating | EVM and others | Signature-based | Telegram and Discord roles by balance or NFT attributes | Large | https://docs.collab.land/help-docs/key-features/token-gate-communities | H |

**The features that drive adoption, in short:**
1. One tap from an alert to an action.
2. Following other wallets, with PnL.
3. Visible activity in groups: buy pings and leaderboards. Every group that installs the bot also spreads it.
4. Referral revenue share.
5. Safety checks on tokens (anti-rug, honeypot).
6. Limit, DCA and stop orders.
7. Very simple UX.

Trading volume is moving from Telegram toward web terminals such as Trojan Terminal, GMGN and Axiom (L–M).

---

## 3. Incidents and risks

| Date | Incident | Loss | Cause | Source | Conf. |
|---|---|---|---|---|---|
| 24 Oct 2023 | Maestro | about 280 ETH (about $500k); 610 ETH reimbursed | Arbitrary call in the router contract | https://cryptowatchdog.net/blog/are-telegram-trading-bots-safe-a-crypto-watchdog-investigation-2026-05-09 | M |
| 31 Oct 2023 | Unibot | about $600–640k | Approval flaw in an unverified router | https://blockworks.com/news/telegram-trading-tool-unibot-suffers-exploit | H |
| Mar 2024 | BONKbot users; Solareum | about $208k; about 2,800 SOL ($523k), and Solareum shut down | Key and infrastructure compromise | https://forklog.com/en/telegram-bots-bonkbot-and-solareum-users-suffer-520000-losses-due-to-hacks/ | M |
| 19 Sep 2024 | Banana Gun | about $3M (563 ETH), 11–12 users | Flaw in its Telegram message oracle | https://www.quillaudits.com/blog/hack-analysis/banana-gun-exploit | H |
| 16 Sep 2025 | Nova (Solana TG bot) | about $500k | Manual drain | https://www.cyberdefensemagazine.com/nova-trading-platform-security-breach-half-a-million-dollars-drained-in-manual-attack/ | M |
| 11 May 2026 | SIGMA bot user (Unihax0r) | >$200k across ETH, Base and BSC | Suspected leak of private keys for wallets the bot generated; no team response documented | https://www.cryptotimes.io/2026/05/11/crypto-trader-drained-of-200k-in-telegram-bot-linked-crypto-hack/ | M |
| 2024–Jan 2025 | Fake "Safeguard" verification bots | >$3M for two victims | A fake CAPTCHA tells users to run PowerShell, which installs the Lumma stealer | https://cointelegraph.com/news/telegram-verification-bots-carry-crypto-stealing-malware/, https://bleepingcomputer.com/news/security/telegram-captcha-tricks-you-into-running-malicious-powershell-scripts | H |
| 2025 | Fake "trading bot" repos on GitHub (GitVenom, solana-pumpfun-bot) | One victim lost 5 BTC | Stars faked; malicious dependencies | https://cointelegraph.com/news/hackers-fake-github-projects-steal-crypto-kaspersky | H |
| 2026 | Phishing domains imitating Starknet (starknet-bot.com, flagged 18 Jan 2026; app-stark.online; starknet.portal-drops.icu) | — | Phishing | https://phishdestroy.io/domain/starknet-bot.com/ | M |

**Structural risks**
- **Custody is the main failure point.** Private-key compromise was 43.8% of about $2.2B stolen in 2024, and the top theft cause in Q1 2025. Reimbursements are goodwill, not a contractual guarantee. (M) https://cryptowatchdog.net/blog/are-telegram-trading-bots-safe-a-crypto-watchdog-investigation-2026-05-09, https://slowmist.medium.com/slowmist-2025-q1-misttrack-stolen-funds-analysis-d5abca19c997
- **Telegram platform rules:**
  - TON-only rule for Mini Apps, including no linking from a Mini App to non-TON platforms (H).
  - Since Sep 2024, Telegram may give IP addresses and phone numbers to authorities on valid orders (H). https://www.darkreading.com/cybersecurity-operations/telegram-sahe-user-info-policy-shift
  - Digital goods sold inside bots must be paid in Stars, which affects paid tiers (M). https://telegram.org/blog/telegram-stars
  - Durov announced a native non-custodial Gram (ex-Toncoin) wallet in Telegram on 21 Jul 2026. Competition inside Telegram is TON-native (M). https://www.theblock.co/post/409099/telegram-plans-largest-rollout-non-custodial-crypto-wallet-in-history
- **Regulation:**
  - Under MiCA, a service where only the client holds the keys is not custody. A bot that holds keys is a custody service and needs CASP licensing (M). https://forklog.com/en/how-mica-will-change-tracing-of-crypto-transfers-in-the-eu/
  - The XRP Tip Bot nearly shut down over Dutch custodian registration rules (M). https://theinformerpost.beehiiv.com/p/crypto-trading-network-uphold-revives-popular-xrp-payments-platform
- **Starknet-specific:**
  - Reorgs during outages drop transactions, so alerts must wait for confirmations and de-duplicate (M).
  - Oracle faults cause false or real liquidation waves (M).
  - STRK20 hides balances, so trackers are partial by design, and viewing keys are extremely sensitive (M).

---

## 4. Gaps on Starknet that an open-source, self-hostable bot could fill

1. **No group token-activity feed or buy bot for Starknet tokens.** I found none, and the multichain trackers do not list Starknet (M).
2. **No Telegram token-gating with Starknet assets.** Starky is Discord-only, yet its 88 forks show demand; Collab.Land does not document Starknet. Bot API 10.1 (11 Jun 2026) added join-request query support, and 9.6 (3 Apr 2026) added managed bots (H for the API facts, M for the gap). https://core.telegram.org/bots/api-changelog
3. **No staking monitor for delegators or validators.** Rewards must be claimed by hand, a missed attestation zeroes the epoch, commissions can change through commitments, and exits take 7 days. The May 2026 forum guide on choosing a validator admits uptime data is hard to find (M). https://community.starknet.io/t/how-to-choose-a-starknet-validator/116199
4. **No outage or reorg alerting aimed at users.** The Sept 2025 governance minutes say the community detected outages through independent monitoring bots and social media rather than official channels (M). https://community.starknet.io/t/17-09-2025-monthly-starknet-governance-call-meeting-minutes/115972
5. **No health-factor or oracle-deviation alerts for Vesu and Nostra borrowers**, despite two incidents in September 2026 (M).
6. **Governance reach.** Only 8–9% of 210 delegates voted, with "no contact data collected initially." The Foundation's fix is email (M–H). Same source as gap 4, plus https://community.starknet.io/t/starknet-governance-call-january-2026-meeting-minutes/116104
7. **No DeBank-style wallet and LP visibility.** Users have asked since 2023, and DeBank, Zerion and Cielo do not cover Starknet (M). https://community.starknet.io/t/best-starknet-ecosystem-dashboard-metrics/100968/4
8. **A non-custodial way to act from Telegram.** Starknet's native account abstraction (signing links plus session keys with spending limits plus the AVNU paymaster) allows actions without the bot ever holding keys. Other chains' bots cannot do this easily (M on feasibility, L on UX today because wallets implement session keys differently).

---

## 5. What Starknet communities ask for

- **Q3 2025 poll** (1,202–1,425 voters; results posted 2 Dec 2025): trading is the main activity, stablecoin payments are the top payment use, and "anonymous accounts" is the top privacy ask (M). https://community.starknet.io/t/q3-poll-results/116077
- **Q4 2025 polls:** privacy was the top 2026 priority (>50%), and 75% say they use Starknet daily (M). Same January 2026 minutes as above.
- **Governance:** delegates were not being reached, and the Foundation plans a direct-messaging system for future votes. Outage communication is a recurring theme (M).
- **Holders:** portfolio and LP-location dashboards (forum, 2023 onward) and Starknet support in tax tools (Koinly, CoinTracker and Coinpanda feedback boards) (M). https://feedback.koinly.io/integrations/p/add-support-for-starknet
- **Fibrous feedback board:** price-threshold alerts, token info, and a staking-tools dashboard. All have 0 votes, so this is weak evidence (L). https://fibrous.userjot.com/
- **Traders:** StarkWare's "Trading Guild" (8 Dec 2025) recruits traders over Telegram to study trading UX on Starknet. This is a likely pilot audience (M). https://community.starknet.io/t/announcing-starkware-s-defi-trading-exploration-initiative/116082
- **Stakers and validators:** liveness thresholds in the delegation program and validator-choice guides point to uptime and commission transparency (M).

---

## 6. Candidate features, ranked

Ranking criteria: evidence of demand, absence of an existing tool, safety without custody, compliance with Telegram's rules, and whether the feature can be checked with recorded on-chain fixtures (suits judged launchpad rounds).

| # | Feature | Who wants it | Evidence | Conf. |
|---|---|---|---|---|
| 1 | **Wallet watch (DM).** Alerts for transfers in/out, approvals and new contract interactions on any address or .stark name; filters by token and minimum USD; quiet hours; waits for confirmations | Holders, treasuries, builders | Cielo's core feature; Starknet absent from Cielo, DeBank and Zerion; 2023+ forum asks | M |
| 2 | **Group token feed (buy bot).** Ekubo and AVNU buys and sells for a configured token: size, USD, buyer's .stark name, market cap, chart link; buyer leaderboards | Project Telegram groups, including launchpad projects | Standard feature on other chains; none found on Starknet; installs spread through groups | M |
| 3 | **Staking monitor.** For delegators: validator missed attestations, commission commitments and changes, exit intent, unclaimed-reward reminders, 7-day unlock complete. For validators: missed attestation, low balance in the attestation account | 1.1B STRK and 1,700 BTC stakers; delegation-program validators | Staking v2 mechanics; 99%/99.5% liveness requirements; validator data hard to find | M |
| 4 | **Network status and reorg alerts.** Block stall, halts, reorg depth; "your transaction was dropped, resubmit" | Everyone, especially builders | Outages on 2 Sep 2025 and 5 Jan 2026; community bots detected outages first | M |
| 5 | **Lending health and oracle-anomaly alerts.** Vesu and Nostra health-factor thresholds; oracle price compared with a reference, with deviation alerts | Borrowers, curators | Incidents of 4 and 18 Sep 2026 | M |
| 6 | **Token-gated groups.** Approve join requests by STRK, staked STRK, NFTs or Starknet ID, with an off-chain signature on an external page | DAOs, holder groups, launchpad projects | Starky is Discord-only (88 forks); new join-request API | M |
| 7 | **`/scan` token card in groups.** Price, liquidity, holders, deployer, LP lock, Unruggable status | Members of token groups | Common on other chains; the Unruggable bot covers only Unruggable launches | M |
| 8 | **Governance alerts.** Snapshot / Snapshot X proposals opening and closing; "your delegate has not voted" | STRK holders, delegates | 8–9% delegate turnout; the Foundation moved to email | M |
| 9 | **Price and depeg alerts.** STRK and BTC wrappers; LST/STRK ratio for xSTRK and sSTRK | Holders, LST users | Fibrous ask; the Nostra xSTRK/sSTRK price-feed issue | L–M |
| 10 | **Whale and unlock channel.** A public feed of large STRK moves to and from exchanges around the monthly 127M STRK unlocks | Traders | Media coverage of STRK whale moves; no Starknet whale feed found | L–M |
| 11 | **Ekubo LP alerts.** Position out of range; TWAMM or limit order filled | LPs | Ekubo docs; no tool found | L |
| 12 | **Non-custodial actions.** The bot prepares a swap, DCA or stake and the user signs on a web page. Later, opt-in session keys with spending caps and expiry | Traders (the main activity) | AVNU DCA and Paymaster APIs; Braavos session keys; SNIP draft | M (feasible) / L (UX) |
| 13 | **Moderation add-ons.** Link filter fed by a list of Starknet phishing domains; fake-admin detection; warnings about fake "verify" bots. Integrate with Rose or Shieldy rather than replace them | Group admins | Safeguard malware; phishing domains | M |
| 14 | **Managed per-project bots.** Uses Bot API 9.6 so a project gets its own branded bot from one manager bot; Docker for self-hosting | Launchpad projects, communities | Bot API 9.6 (3 Apr 2026) | M |
| 15 | **History CSV export** for tax tools | Holders | Tax-tool feedback requests | L |

---

## 7. Do not build

| Item | Reason | Conf. |
|---|---|---|
| Custodial trading or sniper bot (bot-generated or imported keys) | This model produced the Maestro, Unibot, Solareum, Banana Gun, Nova and SIGMA losses; it is custody under MiCA; and a server compromise is a total loss | H |
| Any Telegram Mini App component | Non-TON chains and wallet protocols are banned in Mini Apps, and a bot with a Mini App loses the exemption. Argent's wallet was killed by this rule | H |
| Seed-phrase or private-key import, or storage of STRK20 viewing keys | Leaked keys are the top theft cause; viewing keys reveal shielded activity | H |
| Airdrop-farming or sybil automation | The category is full of malware lures (including a Starknet one) and has a sybil-abuse reputation | H |
| Sniping, MEV, or tools to evade anti-snipe protection | Harms the projects the launchpad serves (Unruggable deliberately blocks snipers); thin liquidity at about 50k daily active addresses | M |
| Paid "trending" slots or volume bots | Market-manipulation and regulatory exposure | M |
| Custodial tip or "send to @username" bot | Custody and money-transmission licensing; past tip bots shut down over custodian registration or low use | M |
| Free-text AI agent that signs transactions | Prompt injection leads straight to fund loss; StarkBot-era demos did not stick | M |
| Copy trading that executes automatically | Needs custody or broad session keys; thin Starknet liquidity | M |
| A new general anti-spam engine | Rose, Shieldy and Combot already cover it well; integrate instead | M |
| Release binaries without signatures, or putting core safety alerts behind token holdings | Fake-repo malware makes signed, reproducible builds a trust requirement. Putting safety behind a token weakens the open-source pitch (opinion) | H / L |

**Suggested phasing (opinion, M).**
- **Phase 1:** features 1–4 plus 6, read-only, built on Starkscan or Voyager plus RPC WebSockets, shipped as Docker and as a hosted instance.
- **Phase 2:** features 5 and 7–11.
- **Phase 3:** feature 12, only after wallets converge on the session-key SNIP.

**Why this suits launchpad rounds.** Every Phase 1 feature can be judged against recorded event fixtures, for example a reorg replay, a missed-attestation epoch, or an Ekubo swap log.