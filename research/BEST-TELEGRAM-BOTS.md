# Best Telegram crypto bots and their offering

As of 2026-10-12. Written for the Hotpod PM. Hotpod is planning an open-source, self-hostable Starknet Telegram bot as one of its projects.

**How this was built.** This report draws only on five research reports (trading, tracking, community, wallets/Mini Apps, Starknet/AI) and on a separate fact-check pass over them.
- All fact-check corrections have been applied. No claims were refuted.
- **[unverified]** marks a claim that the fact-check could not confirm.
- Confidence is given as **high**, **moderate** or **low**.
- Fees, user counts and prices are snapshots. Each one names its source and date.
- Where the research recorded no URL for a fact, the text says so instead of supplying one.

---

## Summary

- **Fee revenue has moved from Telegram-only bots to web and mobile terminals.** In the 30 days to 2026-10-11, DefiLlama's "Telegram Bot" category took about **$2.58M** in fees, leaving out Pump.fun's web "Terminal" ($5.55M), which DefiLlama files there. Its "Trading App" category took **$92.61M** in the same period: Axiom $37.3M, GMGN $27.4M, fomo $24.3M, Propr $1.6M, Photon $0.36M. Every Telegram leader that is still active (Trojan, Maestro, BONKbot, Banana Gun) now also runs a web terminal. Source: [DefiLlama fees API](https://api.llama.fi/overview/fees?dataType=dailyFees), pulled 2026-10-12. (high)
- **A 1% trading fee is standard, so bots compete on rebates and referrals.** Maestro, Trojan, BONKbot, GMGN, Bloom, Sigma (on EVM chains) and Axiom (as its starting rate) all charge 1%. The real competition is in cashback and multi-level referral programs, so much of the 1% is effectively a distribution cost. (high on the fees; moderate on the "distribution cost" reading)
- **What users pay for:** reliable execution at peak load, a discovery and data layer, social or copy trading, onboarding without handling keys, and being early on whichever chain is hot. Buy/sell, limit/TP/SL, DCA, MEV toggles and PnL cards are commodity features. (moderate; inferred from where fees went)
- **Custody is where these products break.** Every large loss in the record (Maestro, Unibot, Thunder Terminal, Solareum, Banana Gun, DEXX) came from the operator side: a custom router, key storage, a session layer, message handling, or insider access. None came from a chain-level flaw. (high)
- **Alert and tracking bots compete on capacity, signal quality and latency.** None of the checked trackers list Starknet in their alert coverage: Cielo, Arkham, Nansen Smart Alerts, Whale Alert API, Zerion, DeFi Saver, Otomato. (moderate; chain lists change)
- **Generic group tooling is saturated, but Starknet support in it is missing.** Rose, Group Help, Combot and Safeguard already serve millions of users. Collab.Land, Galxe and Zealy do not verify Starknet wallets, Guild does not document a chain list, and the only Starknet buy bot found serves a single project. (moderate)
- **Telegram's TON-only rule for Mini Apps is still in force. Plain bots without a Mini App are exempt.** Every Starknet in-Telegram wallet effort has been shut down (Argent/Ready TMA SDK, Cartridge's Telegram provider). (high)
- **The Starknet market is small.** Starknet's 30-day DEX volume was **$472.7M** (Ekubo $466.5M). That is about 0.66% of Solana's $71.47B and 1.6% of Base's $29.24B ([DefiLlama](https://api.llama.fi/overview/dexs/starknet), 2026-10-12). Even if a bot captured all Starknet DEX volume at 1%, it would gross about $4.7M a month before rebates (arithmetic, not a forecast). A Starknet bot has to win on safety, Starknet-specific utility and per-project value, not on fee volume. (high on the data; moderate on the conclusion)

---

## 1. Trading bots

| Bot | Chains | Core offering | Custody model | Pricing / fees | Traction (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Maestro** | 12 per docs: Solana, BSC, Base, Ethereum, Monad, Sonic, Avalanche, Arbitrum, HyperEVM, Robinhood, Tron, TON ([docs](https://docs.maestrobots.com/sniper/faq/supported-chains-and-dexs)); high | Manual trading, auto-snipe, limits, copytrade, signals auto-buy, trade monitor with trailing sell, anti-MEV, honeypot checks, PnL cards, bridge | Bot-generated wallets; keys shown to the user and stored "AES encrypted" on Maestro servers; moderate | 1% per buy and sell (taken in the transaction on Solana; accrued and swept on other chains). Premium **$200/month**. Referral "up to 25% lifetime", split 50/50 if the user was already referred. Cashback 15/20/25/30% ([monetization](https://docs.maestrobots.com/sniper/monetization), [premium](https://docs.maestrobots.com/sniper/premium-subscription)); high | DefiLlama all-time fees $144.8M; 30d $1.10M (to 2026-10-11) ([API](https://api.llama.fi/overview/fees)); high. Dune: $14.4B volume, 677K users, about Dec 2025 (stale; dashboard URL not recorded); low | No |
| **Trojan** (bot + Terminal) | Solana | Market, limit, DCA, auto-sell, copy trading, Jito MEV protection, PnL cards, Hyperliquid perps; web Terminal with passkey or Google login (launched about 2026-01-12) | Trojan wallets with key import and export; Terminal marketed as "non-custodial"; moderate | 1% per successful trade (0.9% with a referral). Cashback up to 45%; referral up to 50% across 5 layers; 10% of fees go to a jackpot (docs disagree on whether it is daily or every two days) ([docs](https://docs.trojan.com/llms-full.txt)); high | DefiLlama: 2024 $126.8M, 2025 $87.3M, 2026 YTD $13.9M, all-time $228.0M, 30d $1.05M ([API](https://api.llama.fi/summary/fees/trojan)); high | No |
| **Banana Gun** | ETH, Solana, BSC, Base, Sonic, Unichain | Spot, auto-snipe, limits, copy trading, anti-rug, MEV protection; Banana Pro web app | Bot-generated wallets; moderate | 0.5% on manual and limit trades on ETH; 1% on ETH snipes; 1% on other chains. 40% of revenue after referrals goes to holders of 50+ BANANA ([docs](https://docs.bananagun.io/llms-full.txt), [rewards](https://docs.bananagun.io/banana-token/rewards)); high | Homepage (self-reported, undated): 26M+ trades, $16B+ volume, 1.5M+ users ([bananagun.io](https://bananagun.io)); moderate. DefiLlama tracked fees: Oct 2025 $1.63M/month; June 2026 about $25k; under $10k/month from July 2026; 30d to 2026-10-11 $4.2k ([API](https://api.llama.fi/summary/fees/banana-gun)); high. Unknown whether the business collapsed or Banana Pro revenue goes to wallets the adapter does not track | No |
| **BONKbot** | Solana | Buy/sell, limit/TP/SL, DCA, Nighthawk sniper, Telemetry web and mobile terminal | "Signer" key-management service on a TPM-measured unikernel; 2FA for seed export and withdrawals ([docs](https://docs.bonkbot.io)); moderate | 1% per swap. Referral 30% in month 1, 20% in month 2, then 10% for life. Telemetry: 30% across 3 levels, cashback up to 25%; moderate | DefiLlama all-time $95.0M, 30d $0.11M ([API](https://api.llama.fi/overview/fees)); high. Homepage claims (69.3M trades, $10.1B, 452K users) conflict with Dune ($14.5B, 536K, stale); low | No |
| **GMGN** | Telegram bots for SOL, ETH, Base, BSC, Tron; web app covers more chains | Web terminal plus Telegram bots: copy trading, limits, TP/SL, anti-MEV RPC, wallet alerts, an Agent API for AI agents | Telegram private-key wallet; the API uses a "GMGN hosted wallet"; moderate (source URL not recorded) | 1% handling fee; 30% referral rebate; moderate | DefiLlama 2025 $137.0M, 2026 YTD $177.5M, 30d $27.4M, all-time $339.9M ([API](https://api.llama.fi/summary/fees/gmgn)); high | No |
| **Axiom** (web) | Solana, BSC, Robinhood Chain (per DefiLlama) | Web terminal, wallet tracker pitched as a replacement for Telegram wallet bots, Hyperliquid perps, marginfi yield | Turnkey-based, described as "non-custodial"; moderate | 1% starting rate; referral 30/3/2% across 3 tiers; referred users get 10% off; moderate (source URL not recorded) | DefiLlama 2025 $546.7M, 2026 YTD $223.5M, all-time $770.2M, 30d $37.3M ([API](https://api.llama.fi/summary/fees/axiom)); high | No |
| **fomo** (mobile, not Telegram) | SOL, Monad, BSC, Base, ETH, Robinhood, Arc | Social copy trading (one tap to copy a public portfolio), perps | Non-custodial per press; low | About 0.5% on memecoins and 0.05% on blue chips (secondary source); low | $75M Series B led by Index at a $550M valuation, 2026-06-22 ([Fortune](https://www.fortune.com/2026/06/22/fomo-series-b-fundraise-index-ventures-union-square-ventures/)); high. Fortune cites about 3,500 new users a day. The "625K traders / $4B" figure is [unverified]. 46% of Solana trading-platform spot volume by 2026-08-24 ([Solana Compass citing Blockworks](https://solanacompass.com/news/fomo-captures-46-of-solana-trading-platform-spot-volume-as-weekly-revenue)); moderate | No |
| **Pump "Terminal"** (ex-Padre) | SOL, ETH, BSC, Base | Web trading terminal | Unknown | Cashback and referrals | DefiLlama 2026 YTD $39.4M, 30d $5.55M ([API](https://api.llama.fi/overview/fees)); high. Pump.fun bought Padre on 2025-10-24 ([Cointelegraph](https://cointelegraph.com/news/pumpfun-acquires-padre-trading-terminal-solana-memecoins)); high. "PADRE token lost its utility" is [unverified] | No |
| **Bloom** | SOL, ETH, BSC, Base, Robinhood, Arc, HyperEVM, Ink | Telegram bot, web Manager and Chrome extension: sniper, copy trading, AFK mode, X-triggered trades, trading API | Bot wallets; moderate | 1% (0.9% with a referral); referral 25/3/2% | Homepage (Apr 2026): 28M+ transactions, 70K+ active traders, $4.5B+ volume (self-reported); low. DefiLlama (filed as "Gaming") all-time $63.0M, 30d $0.33M; high | No |
| **Sigma** | ETH, Base, BSC, Avalanche, Arbitrum, Unichain, Berachain, Solana (lists vary by page) | Auto-sniper, limit/TP/SL, EVM copy trading, MEV and re-org protection | Bot-generated wallets; moderate | 1% on EVM; **0% on Solana**; 20% revenue share; moderate (source URL not recorded) | Not tracked by DefiLlama. Dune (stale): $4.9B volume, 296K users; low. A private-key leak of $200k+ was reported in May 2026 ([Cryptopolitan](https://www.cryptopolitan.com/crypto-trader-loses-200k-telegram-bot/)); moderate | No |
| **Photon** (web) | Solana | Web terminal | Unknown | Unknown | DefiLlama 2025 $179.4M, 30d $0.36M, all-time $442.0M; high | No |
| **BullX** | Solana-led | Web plus Telegram login, sniping, copy trading | Platform-managed wallets | Unknown | All-time $203.0M (DefiLlama). **Trading suspended 2026-06-01**; withdrawals kept open ([Phemex](https://phemex.com/news/article/bullx-suspends-trading-functionality-to-focus-on-future-development-87410)); moderate | No |
| **Unibot** | Ethereum | Telegram trading and sniping | Bot wallets | 1%; revenue share to holders | All-time $29.3M; $0 in the last 30d (DefiLlama); effectively dead; high | No |

**What the trading data shows:**
- **Discovery tooling moved share fast.** Axiom went from 3.5% to 42.2% of Solana bot volume in two months (to 2025-04-10) ([PANews/Dune via TechFlow](https://www.techflowpost.com/en-US/article/24953); moderate). fomo then overtook Axiom on 2026-08-06 (moderate). Whoever controls the discovery and social layer takes the flow.
- **Supporting the hot chain early pays.** During the October 2025 BSC memecoin spike, GMGN took $44.6M and Maestro $6.8M in one month (DefiLlama; high).
- **Subscriptions are rare.** Maestro Premium at $200/month is the only one documented. Its subscriber count is unknown.

## 2. Tracking and alert bots

| Product | Chains (alerts) | Core offering | Custody | Pricing | Traction (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Cielo** | 30+ incl. BTC, Solana, Sui, Tron, Hyperliquid, EVM chains. Docs name Ethereum, Base, Solana, Robinhood, HyperEVM, BNB plus unspecified "other chains"; "Starknet" appears 0 times in the full docs ([docs](https://docs.cielo.finance/llms-full.txt)); moderate | Wallet, token and list alerts; trade buttons; wallet discovery | Read-only alerts | Free: 250 EVM + 50 SOL wallets, 1 TG bot, 120 alerts/hr. Pro **$59/mo**: 1,000/200 wallets, 4 TG bots (2 private), 1K alerts/hr. Whale **$199/mo**: 10,000/1,000 wallets, 18 TG bots (9 private), 3K alerts/hr, API. Prices are on an annual basis ([cielo.finance](https://cielo.finance/), 2026-10-12); high | Self-reported 500,000 users and 4M wallets tracked, undated; moderate | No public repo found |
| **RayBot** (@ray_cyan_bot) | Solana-first | Wallet tracker with one-tap trades | Read-only | Free 10 wallets (third-party claim) | 400k+ users per a third-party directory (Aug 2026); low | No public repo found |
| **Arkham Alerts** (@arkham_official_bot) | 18 chains as of June 2025, no Starknet ([codex](https://codex.arkm.com/the-platform/multichain-support)). HyperEVM added 2026-04-28 ([announcement](https://info.arkm.com/announcements/hyperevm-is-now-on-arkham)). TON removed "April 8"; the year is [unverified] | Entity-labelled alerts filtered by entity, token, USD value or chain; delivered by email, Telegram or webhook | Read-only | Core alerts free; API about $900/mo (third-party listing); moderate | 200M+ Telegram alerts since Jan 2023; 2.1B labelled addresses; 700k entities (self-reported, 2025-05-28) ([announcement](https://info.arkm.com/announcements/arkham-telegram-mini-app)); moderate | No |
| **Nansen Smart Alerts** | 21 chains with published latency: <5 s on Base, BNB, ETH; 10–20 s on Solana; **17 chains** at 30–60 s; 1–2 min on Tron. Starknet is not in the alert table ([academy](https://academy.nansen.ai/articles/6239622-ai-smart-alerts-101)); high | Token transfers, smart-money flows, Hyperliquid perps; natural-language alert creation; Telegram, Discord, Slack, HMAC-signed webhooks ([docs](https://docs.nansen.ai/api/smart-alerts)) | Read-only | Free: 1 active alert. Pro $49/mo annual or $69/mo monthly, unlimited alerts ([academy](https://academy.nansen.ai/articles/9412804-about-nansen-pro)); high. Launch date of this pricing [unverified] | User count unknown | No |
| **Whale Alert** | 14 chains (API) | Large-transfer feed; custom alerts go to push, not Telegram | Read-only | Alerts $14.95/mo; Alerts API $29.95/mo (100 alerts/hr, $100k minimum); Enterprise $699/mo ([developer](https://developer.whale-alert.io/)); high | Telegram channel: 298,501 subscribers ([t.me/whale_alert_io](https://t.me/whale_alert_io), 2026-10-12); high | No |
| **Lookonchain** | Editorial | Human-curated analyst feed | n/a | Free | Channel 18,786 subscribers / group 36,810 members ([channel](https://t.me/lookonchainchannel), [group](https://t.me/lookonchain), 2026-10-12); high | n/a |
| **DeFi Saver Notify** (@DeFiSaverBot) | Mainnet, Base, Arbitrum, Optimism | Health-factor thresholds, Liquity debt-in-front, automation runs, Aave v3 supply caps ([help](https://help.defisaver.com/features/notify/telegram-bot-for-monitoring-your-position)) | Read-only | Not stated | Unknown | Contracts yes; notifier unknown |
| **Otomato** | Ethereum, Arbitrum, Base, Polygon, Avalanche, Monad, HyperEVM | Portfolio-aware DeFi alerts: Aave health factor, depegs, Pendle maturities | Read-only | Core Aave alerts free | $2M from Improbable (2026-05-26); 2,000+ users; a Dec 2025 HyperEVM campaign converted 81.6% of 3,690 users into Telegram bot users with no paid promotion ([Improbable](https://www.improbable.io/news/improbable-invests-2m-in-otomato-to-scale-the-first-portfolio-aware-intelligence-layer-for-defi)); high (self-reported) | No |
| **Zerion** | EVM + Solana (API) | Address alerts by app push only, no Telegram ([blog](https://zerion.io/blog/multichain-notifications/)); webhooks flag spam with `is_trash` but do not filter it ([docs](https://developers.zerion.io/webhooks)) | Read-only | API $149–$999/mo (date unknown) | Unknown | No |
| **Etherscan** | Ethereum | Watch list, email only, 50 addresses ([KB](https://kbadm.etherscan.com/watch-list/)) | Read-only | Free | n/a | No |
| **Cryptocurrency Alerting** | Unknown list | Price, wallet, gas and listing alerts across 9 channels including Telegram | Read-only | Free (3 alerts) / $3.99 / $19.99 / $49 per month | Unknown | No |
| **Tenderly Alerts** | Starknet not confirmed | 12 trigger types; Telegram via @TenderlyRobot | Read-only | Paid, through sales | n/a | No |
| **HAL** | n/a | Former no-code alerts; acquired by ConsenSys 2023-02-21 ([blog](https://consensys.com/blog/consensys-acquires-hal-to-augment-infuras-blockchain-notification-and-automation-capabilities)) | n/a | n/a | hal.xyz did not resolve on 2026-10-12; defunct in practice; moderate | n/a |

**What users value** (inferred from paid tiers; moderate):
- capacity: wallets and alerts per hour
- speed: private bots, published latency
- signal: entity labels, USD thresholds, spam filtering
- a trade button inside the alert
- position-aware risk alerts, which have shown the strongest pull (Otomato's 81.6% conversion)

**Common complaints:**
- **Noise from exchange hot-wallet shuffles.**
- **Alerts delayed by Telegram rate limits.** Cielo sells private bots as the fix (Bitrue, 2025-04-16; third-party; moderate).
- **Hourly caps.**
- **Spam tokens.**
- **Fake "official" bots.**

## 3. Community and group bots

MAU is the "monthly users" counter on each bot's t.me page, read 2026-10-12. It counts only direct interactions, so it understates the reach of group bots. All MAU figures were confirmed by the fact-check (high).

| Bot | Chains | Core offering | Custody | Pricing | Traction (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Safeguard** (@safeguard) | 7 chains per docs (ETH, BSC, Arbitrum, Avalanche, Polygon, Solana confirmed); no Starknet ([docs](https://docs.safeguard.run/llms-full.txt)) | Buy bot ("completely ad free"), portal verification, Scam Blocker, Clone on your own token | None | Free. Paid `/trend` boosts on @Trending and @SOLTrending; that this is the revenue model is an inference | 251,743 MAU ([t.me/safeguard](https://t.me/safeguard)); @Trending ~468.7k and @SOLTrending ~414.2k subscribers (2026-10-12) | No |
| **Rose** (@MissRose_bot) | n/a | Captcha, locks, antiflood, federations | None | Free; paid clones | 2,266,240 MAU ([t.me](https://t.me/MissRose_bot)) | Unknown |
| **Group Help** | n/a | All-round group management | None | Unknown | 2,798,558 MAU ([t.me](https://t.me/GroupHelpBot)) | Unknown |
| **Combot** | n/a | Moderation, CAS anti-spam, analytics, API/MCP, AI replies | None | Free; Pro €9.99/mo (non-commercial only); Business €100/mo or €900/yr ([combot.org](https://combot.org/)) | 720,371 MAU; site: 480k+ groups, 800k+ users | No |
| **Shieldy** | n/a | Join captcha | None | Free + Stripe premium | 197,658 MAU ([t.me](https://t.me/Shieldy_Bot)); sold to 1inch for $329,000 in 2021 ([Habr](https://habr.com/en/articles/581212)) | **Yes, MIT** ([repo](https://github.com/backmeupplz/shieldy), last commit 2026-02-09) |
| **Major Buy Bot** | Not documented | Buy alerts, whale pins, buy competitions | None | Free; paid @MajorTrending exposure | 42,179 MAU ([t.me](https://t.me/MajorBuyBot)) | No |
| **SpyDefi BuyBot** | Unknown | Buy alerts | None | Unknown | 27,833 MAU ([t.me](https://t.me/SpyDefiBuyBot)) | No |
| **Bobby** | Avalanche, Base, Solana, L2s (no formal list) | Buy alerts, "intelligence layer", trending | None | Unknown | Vendor: "over 1 million users", undated ([site](https://www.bobbybuybot.com/)); low | No |
| **Collab.Land** | 40+ chains; **no Starknet** ([list](https://developer.collab.land/help-docs/key-features/supported-blockchains-wallets)) | Wallet check and token gating; removes members who drop below the threshold | Read-only signature | Discord plans free–$449/mo (2025-11-12); Telegram pricing "in progress"; 1 group per subscription ([doc](https://doc.collab.land/help-docs/key-features/bot-subscription)); high | "Tens of thousands of communities" (undated) | No |
| **Guild.xyz** | Not documented; a "custom API call" requirement can check any chain | Role requirements, then a join button | Read-only | Free to start | "1000+ teams" (undated) | No |
| **Zealy** | 18 wallet-verified chains; **no Starknet** ([docs](https://docs.zealy.io/llms-full.txt)) | Quests with Telegram tasks | n/a | Free tier capped at 100 members from 2026-10-01; Standard $149/mo, Plus $359/mo, billed yearly ([pricing](https://zealy.io/pricing)); high | No dated figures | No |
| **Galxe** | OAT/NFT network list has no Starknet ([help, 2026-09-08](https://help.galxe.com/en/articles/9728885-create-quest-tasks-settings)) | Telegram join tasks | n/a | Not published | "Over 22 million users" (undated) | No |
| **Rick** (@RickBurpBot) | Uses Codex data; Codex covers Starknet, but Rick's own Starknet support is [unverified] | Price cards, scans, AI chat summaries | None | Unknown | 72,374 MAU ([t.me](https://t.me/RickBurpBot)) | No |
| **Phanes** (@PhanesGreenBot) | No Starknet | Charts, call tracking | None | Free with ads; paid Group Boost | 11,371 MAU | No |
| **RaidSharksBot** | EVM airdrops | X raid leaderboards | n/a | Free; ads from $25 ([docs](https://docs.raidsharksbot.com/)) | Unknown | No |

**Pattern:** buy alerts are free. Money comes from paid placement on large "trending" channels, and that only works with heavy memecoin volume (high on the pattern; inference on the economics).

## 4. Wallets and Mini Apps

| Product | Chains | Core offering | Custody | Pricing | Traction (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Walt** (ex-Wallet, @walt) | "Four blockchains" (unnamed) | 300+ assets, perps on 70+ assets, tokenized stocks and gold | Custodial trading app, with TON Space as the self-custodial part | Unknown | Renamed 2026-09-28 ([crypto.news](https://crypto.news/wallet-in-telegram-rebrands-as-walt/)); 40% of new users start with tokenized RWAs ([The Block, 2026-09-30](https://www.theblock.co/podcasts/the-starting-block/2026-09-30-unpacking-telegrams-evolving-crypto-ecosystem-417337)); moderate | No |
| **Gram Wallet** (native) | TON (Gram) | Buy and hold Gram, gifts, Stars, P2P, payments inside Telegram | Non-custodial | Unknown | Announced 2026-07-21 ([Cointelegraph](https://cointelegraph.com/news/telegram-launch-native-self-custody-gram-wallet-for-over-1-billion-users-durov)); staged rollout from 2026-08-31 ([Meduza](https://meduza.io/en/news/2026/08/31/telegram-s-new-crypto-wallet-and-why-it-skips-id-checks)); current reach unknown; moderate | No |
| **Telegram as a TON Connect wallet** | TON | The Telegram client registered as a wallet | n/a | n/a | Added 2026-09-15 with an SSE bridge only; JS bridge added 2026-10-10; moved to the top of the list 2026-10-11, the same day as `@tonconnect/sdk` 5.0.0 ([wallets-list commits](https://github.com/ton-connect/wallets-list/commits/main)); high | Registry is public |
| **Keeper** (ex-Tonkeeper) | TON, TRON, ETH, BTC, Arbitrum, Base, BNB; **no Starknet** | Multichain wallet; "Battery" gasless transactions | Non-custodial | Unknown | Unknown ([tonkeeper.com](https://tonkeeper.com)) | Unknown |
| **Notcoin** | TON | Tap-to-earn, then "Earn" launchpool and Not Games | n/a | n/a | 35M players in H1 2024 ([Decrypt](https://decrypt.co/223640/what-is-notcoin-telegram-based-game-airdrop)). Co-founder Vladimir Plotvinov told Cointelegraph clickers are "probably already dead" ([ForkLog, 2025-05-05](https://forklog.com/en/notcoin-declares-the-end-of-clicker-games/)). Current users unknown; moderate | No |
| **Hamster Kombat** | TON | Tap-to-earn | n/a | n/a | About 300M monthly players, falling to 40.9M by early Nov 2024 after the 2024-09-26 listing; only 131M received tokens ([ForkLog](https://forklog.com/en/hamster-kombat-loses-nearly-260-million-players-post-listing/)); high | No |
| **Catizen** | TON | Game center, launchpool | n/a | Stars and in-game purchases | 35M+ players and $26M+ revenue (~Sept 2024, [Binance Research](https://www.binance.com/research/projects/catizen)); 2025–26 status unknown; moderate | No |
| **Argent/Ready TMA SDK** (`@argent/tma-wallet`) | Starknet | Self-custody wallet inside Mini Apps using session keys | Argent smart account | n/a | **Dead.** All 46 versions deprecated (registry modified 2025-01-27); last publish 1.22.0 on 2025-01-07 under the `next` tag; `latest` is 1.19.3 ([npm](https://registry.npmjs.org/@argent/tma-wallet)). Ready's docs say it can no longer be used "due to new Telegram rules" ([Ready docs](https://docs.ready.co/argent-wallets/telegram-wallet)); high | Package |
| **Cartridge Controller (Telegram provider)** | Starknet | Stark key kept in CloudStorage plus a Controller session | Session policies | n/a | **Removed** by PR #2461, merged 2026-03-03 ([PR](https://github.com/cartridge-gg/controller/pull/2461)); high | Yes |

**Mini App reach:** Telegram said 500M+ monthly Mini App users in June 2024. A peak of 1.44B "MAU" in Sept 2024, settling at 150–190M by mid-2025, comes from FindMiniApp via [PropellerAds](https://propellerads.com/blog/adv-telegram-mini-app-advertising-report/). The 1.44B figure likely double-counts, since it exceeds Telegram's total user base (low–moderate).

**TON context:**
- CoinShares reported 1.78M monthly active wallets on 2026-05-08, about 0.12% of Telegram's MAU ([CoinShares, 2026-06-11](https://coinshares.com/insights/research-data/the-open-network-ton-an-institutional-research-note/)).
- TON TVL was $91.0M then, but **$50.3M on DefiLlama on 2026-10-12** ([API](https://api.llama.fi/v2/chains)) (moderate).

**Pattern:** invite loops plus a promised airdrop drive huge top-of-funnel growth, then MAU collapses by about 85–90% at the token event. Copy the referral deep links and share cards. Do not copy the farming loop. (moderate)

## 5. Starknet ecosystem bots

Starknet context, from DefiLlama on 2026-10-12 ([chains](https://api.llama.fi/v2/chains), [DEX](https://api.llama.fi/overview/dexs/starknet), [aggregators](https://api.llama.fi/overview/aggregators/starknet)) (high):
- TVL: $165.85M
- 30-day DEX volume: $472.7M, of which Ekubo $466.5M (98.7%)
- 30-day AVNU aggregator volume: $30.45M

| Bot | Chains | Core offering | Custody | Pricing | Traction / status (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Tengu** (@TenguTradeBot) | Starknet (Extended perps) | Telegram trading for Extended perps: market and limit orders, leverage ([t.me](https://t.me/tengutradebot), [tengutrade.xyz](https://tengutrade.xyz)) | Turnkey-authenticated wallets ([Alchemy listing](https://www.alchemy.com/dapps/tengu)) | Unknown | The only Starknet Telegram trading bot named in [Starknet's 2025 review](https://www.starknet.io/blog/starknet-2025-year-in-review/). Traction unknown; moderate | No public repo found (closed source likely, unconfirmed) |
| **StarkFi** (@starkfi_bot) | Starknet | AI chat for swaps (Fibrous/AVNU/Ekubo), staking, Endur LST, Vesu, DCA, Troves, Tongo; quote → confirm → execute; users bring their own LLM key | Privy TEE wallets created via email OTP; the operator's auth server relays signing under a 7-day JWT ([security doc](https://docs.starkfi.app/docs/architecture/security)). The project calls this non-custodial; while a session is live the operator path can request signatures (assessment) | Unknown | Bot repo: **0 stars, no LICENSE file** (README says MIT), last push 2026-04-28 ([repo](https://github.com/ahmetenesdur/starkfi-telegram-bot)). The core `starkfi` repo is MIT, 2 stars, pushed 2026-05-20; 177 npm downloads in 30 days. Likely unmaintained after 5+ months idle; moderate | Partly (core MIT; bot repo unlicensed) |
| **Brother Eli Assistant** (@brotherelibuybot) | Starknet | Buy alerts from Ekubo Core `Swapped` events, nets AVNU/Fibrous multi-hop routes, `/chart`, ±N% price alerts | None | Unknown | Built for one project; created 2026-08-18; 0 stars ([repo](https://github.com/CudanSvat/brother-eli-assistant)); moderate | Public, **no LICENSE** |
| **StarkPulse** (AVNU team) | Starknet | Site lists wallet tracking, new tokens and pools, APY; no group buy alerts ([starkpulse.xyz](https://www.starkpulse.xyz/)) | Read-only | Unknown | Site exists. Telegram product status and traction unknown; GitHub repos found were empty; low | No |
| **Unruggable Meme bot** | Starknet | `/unrug <token>` safety check | Read-only | Free | Telegram page live; repo last push 2024-04-17, 5 stars ([repo](https://github.com/keep-starknet-strange/unrug-tg-bot)); moderate | Yes (MIT) |
| **starknet-mini-pay skill** | Starknet | Payment links, QR codes, invoices via a Telegram bot (`telegram_bot.py`) | Non-custodial per its docs | n/a | Part of the active starknet-agentic repo ([path](https://github.com/keep-starknet-strange/starknet-agentic/tree/main/skills/starknet-mini-pay)); high | Yes (Apache-2.0) |
| **ask-starknet-bot** | Starknet | Q&A bot for Telegram, X and Discord (LangGraph + MCP) | None | n/a | Pushed 2026-08-27, 0 stars ([repo](https://github.com/frytegg/ask-starknet-bot)) | Public, no license |
| **telegram-starknet-support-bot** | Starknet | AI Q&A for groups | None | n/a | Oct 2025, 0 stars ([repo](https://github.com/omarespejel/telegram-starknet-support-bot)) | Public |
| **StarkFinder** | Starknet | Multi-agent AI with a `tg_bot` and a Mini App | Not documented | n/a | Dormant, last push 2025-09-10, 23 stars ([repo](https://github.com/Shonen-Labs/StarkFinder)) | Public, no license file |
| **AgentProtocol Starknet-AgentKit** | Starknet | LangChain Telegram template that creates accounts automatically | Bot-generated keys (custodial) | n/a | Dead, Nov 2024 ([repo](https://github.com/AgentProtocol/Starknet-AgentKit)) | Public |
| **Zap-Stark** | Starknet | Mini App for AVNU swaps with Dynamic wallets | Dynamic embedded wallet | n/a | Dead (StarkHack, June 2024) ([ETHGlobal](https://ethglobal.com/showcase/zap-stark-8w8q6)) | Public, no license |
| **starknet-tg-alerts** | Starknet | Telegram alerts | Read-only | n/a | Dead, Mar 2024 ([repo](https://github.com/enitrat/starknet-tg-alerts)) | Public |
| **Starky** | Starknet | Token gating on Starknet assets, **Discord only** | Read-only | Free | 35 stars ([repo](https://github.com/nmalzieu/starky)) | Yes (MIT) |

**Searched, nothing found** (moderate; absence is hard to prove):
- faucet bots (the faucet is web-only: [faucet.starknet.io](https://faucet.starknet.io))
- staking or validator alert bots (the [attestation tool](https://github.com/eqlabs/starknet-validator-attestation) has no notifications)
- governance alert bots
- Telegram token-gating bots

**[unverified]:**
- "StarkBot" (@Starkbot_strk / @starkbotapp), which claims to be the "#1 Telegram trading bot on Starknet"
- Starktrade (@starktradebot)
- `@starknetairdropbot`: no description; treat as suspicious

## 6. AI-agent bots and frameworks

| Bot / framework | Chains | Core offering | Custody model | Pricing | Traction (source, date) | Open source |
|---|---|---|---|---|---|---|
| **Bankr** | Base | Chat-to-trade on X, Farcaster and Telegram | Operator-controlled wallets. In the Grok incident, Bankr parsed Grok's replies as commands ([CryptoTimes](https://www.cryptotimes.io/2026/05/04/xais-grok-ai-loses-175k-in-crypto-heist-via-clever-prompt-injection-then-gets-it-all-back/)) | Fees | DefiLlama (category "Interface"): 30d $3.01M, 1y $39.9M ([API](https://api.llama.fi/overview/fees)); high | No |
| **GMGN Agent API** | Multichain | Trading API for AI agents | "GMGN hosted wallet" | 1% | Part of GMGN | No |
| **ElizaOS** + `plugin-starknet` | Multi; Starknet plugin 1.0.0 | Agent framework with a Telegram plugin; Starknet transfer, AVNU swap, Unruggable deploy | `STARKNET_PRIVATE_KEY` in env; shared memory across platforms enables memory injection ([arXiv](https://arxiv.org/abs/2503.16248)) | Free | 19.6k stars ([repo](https://github.com/elizaOS/eliza)); plugin-starknet 123 npm downloads/30d; high | Yes (MIT) |
| **Virtuals GAME** | Multi | Telegram plugin; actions through GOAT SDK | Usually `WALLET_PRIVATE_KEY` | Free | [repo](https://github.com/game-by-virtuals/game-node) | Yes (MIT) |
| **Coinbase AgentKit** | EVM, Solana; **no Starknet** | Agent toolkit; no official Telegram example | CDP TEE server wallets with policy spend limits; a guardrails example adds human approval ([docs](https://docs.cdp.coinbase.com/server-wallets/v2/introduction/welcome)) | CDP usage | npm 0.10.4, 26.3k downloads/30d ([repo](https://github.com/coinbase/agentkit)); high | Yes |
| **Daydreams** | Multi incl. Starknet adapter | Agent framework with a Telegram package | Raw `privateKey` | Free | Repo pushed 2026-10-09, 620 stars; npm last published 2025-09-03 ([repo](https://github.com/daydreamsai/daydreams)) | Yes |
| **OpenClaw** | Any, via skills | Local agent with 20+ channels including Telegram; its README says to treat inbound messages as untrusted | Whatever skills hold | Free | 391k stars ([repo](https://github.com/openclaw/openclaw)); hit by the ClawHub malicious-skills campaign (§7) | Yes (MIT) |
| **starknet-agentic** (Starknet Foundation) | Starknet | MCP server, agent account with session keys, per-token daily limits, expiry, emergency revoke; ERC-8004 registries | `NODE_ENV=production` requires `STARKNET_SIGNER_MODE=proxy` (keyring proxy). AgentAccountFactory is Sepolia-only per the 2026-02-22 truth sheet | Free | MCP server 0.2.0 (2026-10-05), 222 downloads/30d, 81 stars ([repo](https://github.com/keep-starknet-strange/starknet-agentic)); high | Yes (MIT) |
| **Snak** (Kasar Labs) | Starknet | Agent engine (NestJS/Postgres/Redis) | Private key in env | Free | Last push 2025-10-31; no Telegram code ([repo](https://github.com/KasarLabs/snak)); high | Yes (MIT) |
| **ask-starknet** (Kasar) | Starknet | LLM router across 18 Starknet MCP servers | Private key in env | Free | Pushed 2026-01-12 ([repo](https://github.com/KasarLabs/ask-starknet)) | Yes |
| **Starkzap** (StarkWare) | Starknet | TypeScript SDK: Privy/Cartridge/Argent/Braavos/local signers, AVNU paymaster, swaps, DCA, Vesu lending, bridging, confidential transfers | Depends on signer; Privy server keys are custodial-adjacent | Free | 4.0.1 (2026-10-01), 1,798 downloads/30d ([npm](https://registry.npmjs.org/starkzap), [v2 blog](https://www.starknet.io/blog/starkzap-v2/)); high | Yes |

**Gap:** the building blocks for a non-custodial agent path exist. These include starknet-agentic's session-key account, Cartridge sessions, SNIP-9 outside execution, the SNIP-29 paymaster and AVNU. Nobody has wired them into a maintained Telegram bot (high on the components; moderate on the gap).

---

## 7. Incidents and lessons

| Date | Product | Loss | Root cause | Response | Source; confidence |
|---|---|---|---|---|---|
| 2023-10-24/25 | Maestro | 280+ ETH (~$500K) | Router2 allowed arbitrary calls, so attackers could `transferFrom` on user approvals | Logic swapped in ~30 min; 610 ETH refunded from revenue in ~10 h; CertiK confirmed | [The Block](https://www.theblock.co/news/ecosystems/2023-10-25-maestro-telegram-bot-suffers-a-contract-exploit-500000-of-eth-stolen-259338), [Decrypt](https://decrypt.co/204444/maestro-trading-bot-refunds-610-eth-to-users-following-router-exploit); high |
| 2023-10-31 | Unibot | ~$580–640K | Approval exploit in a router deployed 2023-10-28 | Router paused. **Users revoked approvals themselves**; Unibot paid gas for users who could not afford it. ~$1.78M compensation; token −33% | [The Block](https://www.theblock.co/news/regulation/2023-10-31-unibot-confirms-exploit-and-promises-compensation-as-token-price-plunges-260133), [Revoke.cash](https://revoke.cash/exploits/unibot); high |
| 2023-12-26 | Thunder Terminal | ~$240K, 114 wallets | Leaked session tokens allowed "authorized" withdrawals | Full refund | Trading report (URL not recorded); moderate |
| 2024-03-29 | Solareum | ~$523K, 302 users | Suspected key or Telegram-history leak | Shut down 2024-03-31 | Trading report (URL not recorded); moderate |
| 2024-09-19 | Banana Gun | **~$3M from 11 users**; an early "563 ETH" figure is [unverified] | Flaw in the Telegram "message oracle" | Full refund from treasury with no token sales; 2-hour transfer delay, transfer 2FA, audits | [The Block](https://www.theblock.co/news/ecosystems/2024-09-25-banana-gun-exploit-refund-318074); high |
| 2024-11-16 | DEXX | $21M+ | Private-key leak | 80% of daily revenue pledged to repayment. The cited source says **12,000+ wallets** were affected; "900+ victims" is [unverified] | [mpost](https://mpost.io/dexx-commits-to-compensating-users-for-losses-following-21m-hack); moderate |
| 2024-11-29 | Freysa (AI challenge) | $47,316 | Prompt injection: the agent was convinced `approveTransfer` handled incoming funds | n/a | [The Block](https://www.theblock.co/post/328747/human-player-outwits-freysa-ai-agent-in-47000-crypto-challenge); high |
| 2025-03-18 | AIXBT | 55.5 ETH (~$106k) | Attacker got into the operator dashboard and queued transfer prompts; the AI itself was not manipulated | n/a | [AIID](https://incidentdatabase.ai/reports/5012); high |
| 2025-10 | Fake "Safeguard" portals | Unknown | Fake verification page asks users to connect a wallet and sign a draining transaction | n/a | [PCrisk, 2025-10-16](https://www.pcrisk.com/removal-guides/34117-fake-telegram-safeguard-scam); moderate. A SlowMist clipboard-malware variant is [unverified] |
| 2025-10 (~10-28) | GMGN | ~107 users | Phishing through a fake third-party token site | 100% compensated the same day | Trading report (URL not recorded); moderate |
| 2026-01-27 → 02-01 | OpenClaw ClawHub skills | Credential and wallet theft (no total) | 341 of 2,857 skills malicious (Koi Security). Payload: a NovaStealer variant per BleepingComputer; the AMOS attribution is [unverified] | n/a | [BleepingComputer](https://www.bleepingcomputer.com/news/security/malicious-moltbot-skills-used-to-push-password-stealing-malware/); moderate |
| 2026-02-26 | Axiom | None | ZachXBT: an employee misused support tools to track wallets | Access removed | Trading report (URL not recorded); moderate |
| 2026-04 | LLM routers (research) | One client lost $500k | 26 third-party LLM routers injected tool calls or stole credentials | n/a | [CoinDesk](https://www.coindesk.com/tech/2026/04/13/ai-agents-are-set-to-power-crypto-payments-but-a-hidden-flaw-could-expose-wallets); moderate |
| 2026-05-04 | Grok / Bankr | ~$150–200k in DRB; mostly or fully returned | An inbound NFT raised the wallet's permissions; a Morse-code "send" in Grok's reply was executed by Bankr | Returned | [AIID 1556](https://incidentdatabase.ai/cite/1556/); moderate |
| 2026-05 | SIGMA | $200k+ | Private-key leak | Unknown | [Cryptopolitan](https://www.cryptopolitan.com/crypto-trader-loses-200k-telegram-bot/); moderate |

**Lessons for Hotpod's bot:**
1. **Custody.** Server-held hot keys are the main single point of failure. Several bots marketed as "non-custodial" still hold exportable keys on their servers. Do not hold user keys (high).
2. **Router exploits.** Do not deploy a custom router that can make arbitrary calls. On Starknet, AVNU takes integrator fees in bps ([AVNU fees](https://docs.avnu.fi/docs/swap/add-fees)), so no router is needed (high).
3. **Prompt injection.** System prompts are not access control. LLM output, persistent memory and group messages must never decide transfer parameters or authorize a transfer. Do not ship a plugin marketplace, and keep keys out of any third-party LLM path (high on the incidents; moderate on the design rule).
4. **Phishing and impersonation.** Verification should only ever ask for an off-chain signed message, never a transaction, and should say so in plain words. Publish the official @username. State that the bot never DMs first and never asks for seeds (moderate).
5. **Response.** Bots that refunded fast and in full out of revenue survived. Withdrawal 2FA and time delays became standard afterwards (high).

---

## 8. Telegram platform policy relevant to a Starknet bot

**Scope of the TON exclusivity rule.** Source: the live ToS §7, fetched 2026-10-12 ([ToS](https://telegram.org/tos/bot-developers)). Confidence high.
- **Preamble.** "All Mini Apps which implement cryptocurrency functionality, either within the Mini App itself or within its connected bot, are required to be based exclusively on The Open Network (TON) blockchain."
- **§7.1.** Tokens and NFTs issued or distributed must be on TON.
- **§7.2.** Wallets connect only through the TON Connect SDK. *Exception:* other protocols are allowed only to bridge assets from other chains.
- **§7.3.** A multichain-wallet Mini App may manage other-chain assets, but only inside its own interface. Any interaction with other apps must go through TON Connect. This is a second carve-out besides bridging.
- **§7.4.** No promotion of non-TON wallets or assets. This covers branding, paid Telegram Ads, and channels affiliated with the Mini App.
- **Deadlines.**
  - New assets: comply from 2025-01-21.
  - §7.1–7.4: comply by 2025-02-01.
  - Existing Mini Apps: migrate by 2025-02-21.
- The ToS text still uses TON/Toncoin-era wording.

**Exemption.** The blockchain guidelines say these rules "only apply to Mini Apps and their bots… Regular Telegram bots that do not have a Mini App component are exempt" ([guidelines](https://core.telegram.org/bots/blockchain-guidelines)) (high). Examples the guidelines forbid:
- connecting an Ethereum wallet to sign inside the app
- rewarding users for connecting non-TON wallets
- announcing a token launch on another chain

**Current status.** In force and becoming more entrenched (high):
- Telegram became TON's largest validator ([Cointelegraph, 2026-05-05](https://cointelegraph.com/news/telegram-to-become-tons-largest-validator-durov-says)).
- Toncoin was renamed Gram on 2026-06-15 after an 81.22% vote ([AMBCrypto](https://ambcrypto.com/ton-officially-rebrands-toncoin-to-gram-as-telegram-deepens-role-in-network/)).
- The Gram Wallet is rolling out, and Telegram itself is now a TON Connect wallet.
- Enforcement is not published. Developers report non-TON Mini Apps losing search visibility (PropellerAds, 2025-12-18) (low–moderate).

**What it means for a Starknet bot:**

| Design | Status | Risk |
|---|---|---|
| Mini App that connects a Starknet wallet, shows or sends Starknet assets, or issues a Starknet token | Violates §7.1/7.2/7.4 | High |
| Bot plus Mini App, with Starknet logic only "in the bot" | The preamble covers the connected bot | High |
| **Plain bot with no `web_app` buttons or menu; signing on an external page opened with a normal `url` button** | Exempt | Low today. Moderate over time, because the exemption could be narrowed (inference) |
| Guard-bot join gating that shows a Mini App via `sendChatJoinRequestWebApp` (Bot API 10.1) to connect a Starknet wallet | That is a Mini App with crypto functionality, so it falls under §7. The community report recommended this flow; **this report drops that recommendation** | High |

**Other rules that apply to plain bots too:**
- **§6.2:** all digital goods and services must be sold in Telegram Stars. Rewards come at about $0.013 per Star, can be held up to 21 days, and are paid out via Fragment. Bots must offer /terms (or a similarly easy way to reach the terms) and /paysupport ([ToS](https://telegram.org/tos/bot-developers), [Stars](https://core.telegram.org/bots/payments-stars)) (high).
- Whether on-chain trading fees count as "digital goods" is an open question.
- **§6.3:** you are responsible for securely storing any financial assets your bot handles (high).
- Telegram's ad policy for bots promoting Starknet assets was not researched.

---

## 9. What to copy, what to avoid, and the gaps on Starknet

### Copy
1. **Plain-language confirmation before value moves** (Maestro, BONKbot), plus withdrawal 2FA and a delay after incidents (Banana Gun).
2. **Integrator fee instead of a custom router** (AVNU `integratorFees`).
3. **Capacity-based tiers sold in Stars**: watched wallets and alerts per hour (Cielo, Nansen).
4. **USD and direction filters, explorer links in every alert, spam-token flags** (Arkham, Zerion).
5. **Position-aware risk alerts** (Otomato, DeFi Saver), which have the strongest measured pull.
6. **White-label or "clone" bots for each project** (Safeguard Clone, Rose clones). Telegram's managed bots (Bot API 9.6, 2026-04-03) make this native ([changelog](https://core.telegram.org/bots/api-changelog)).
7. **Ephemeral messages** (Bot API 10.2/10.3) for private balances inside groups, and **referral deep links** (`t.me/<bot>?start=<code>`).
8. **Gasless by default** (Keeper "Battery"; on Starknet, the AVNU paymaster).

### Avoid
1. Server-generated, exportable user keys (every major loss).
2. A Mini App for anything Starknet (§8).
3. LLM output, memory or group text as authorization (Freysa, Grok/Bankr, ElizaOS memory injection).
4. Plugin or skill marketplaces and third-party LLM routers in the signing path (ClawHub, router research).
5. Free buy alerts funded by trending-channel boosts. This needs memecoin volume Starknet does not have.
6. Token-farming growth loops (the Hamster Kombat cliff).
7. Rebuilding generic captcha and anti-spam; Rose, Safeguard and Combot already cover it.
8. Matching tokens by symbol. A zero-supply "USDC" contract exists on mainnet at Circle's Sepolia address (see build guide).

### Gaps on Starknet, ranked

Ranking factors: unmet need, custody risk, effort to build and test offline, and fit for a self-hostable open-source project. The ranking is a judgement (moderate).

1. **Read-only wallet and whale alerts and portfolio.** No keys means no custody risk. No major tracker covers Starknet, and no maintained open-source example exists (the [LedgerHQ watcher](https://github.com/LedgerHQ) was archived 2024-07-08; `starknet-tg-alerts` is dead). RPC polling makes this cheap to self-host.
2. **Position and staking alerts.** Targets:
   - Vesu, Nostra or Opus health factors (protocol names are a suggestion)
   - STRK and BTC delegator rewards, exit intents and validator commission changes
   - attestation misses

   STRK staked is about 1.54B (on-chain, 2026-10-12), and the attestation tool has no notifications.
3. **Telegram holder verification and token gating with a SNIP-12 signature on an external page.** Starky is Discord-only. Collab.Land, Zealy and Galxe do not verify Starknet.
4. **Ekubo-native group buy alerts plus /price and /chart cards.** Ekubo is about 98.7% of DEX volume, so one contract covers almost the whole market. Only a single-project, unlicensed bot exists.
5. **Prepare-and-sign swap and stake commands.** The bot builds AVNU/Ekubo/staking calls and the user signs in their own wallet, with sponsored gas. StarkFi is the only live attempt; its signing runs through the operator, and its repo has been idle since spring 2026.
6. **Delegated automation (DCA, stop-loss)** via AVNU DCA orders or scoped session keys. Valuable, but it carries the most risk and depends on fragmented wallet support. Build it last.
7. **On-chain-verified quests** (swapped on Ekubo, staked STRK). No incumbent verifies Starknet. Demand is unproven.

---

## 10. Data freshness and unverified items

- DefiLlama figures run through 2026-10-11 and measure inflows to tracked fee wallets only (untracked: Banana Pro; Bloom is filed as "Gaming").
- The Dune "DEX Trading Bot Wars" figures are about 42 weeks stale (about Dec 2025), and the dashboard URL was not recorded.
- Homepage figures (Banana Gun, BONKbot, Bloom, Cielo, Arkham) are self-reported and unaudited.
- **[unverified]:**
  - Nansen pricing launch date
  - the year Arkham removed TON
  - PADRE token utility ending
  - fomo's 625K traders / $4B
  - Banana Gun's "563 ETH"
  - DEXX "900+ victims"
  - the SlowMist clipboard-malware report
  - the ClawHub AMOS attribution
  - Rick's Starknet support
  - StarkBot / Starktrade
  - whether Whale Alert custom alerts can go to Telegram
- **Unknown:**
  - Photon and BullX fee rates
  - Sigma revenue
  - Maestro Premium subscribers
  - Tengu traction
  - current MAU for Notcoin, Hamster Kombat and Catizen
  - which "four blockchains" Walt supports
  - whether Telegram will extend §7 to plain bots
