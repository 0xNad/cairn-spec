# Starknet technical reference for a Telegram bot (as of 12 Oct 2026)

Method: I read the official specs and docs, then checked the facts against mainnet and Sepolia over public RPC (`https://starknet-rpc.publicnode.com`, which runs Juno v0.16.8 and reports spec 0.10.3). "Verified on-chain" means I called the contract or pulled live events myself today.

## 0. What matters most for the bot design

1. **A Telegram Mini App cannot be the Starknet wallet surface.** Telegram's Blockchain Guidelines say Mini Apps must use TON only, and must talk to wallets only through TON Connect. They also may not promote non-TON wallets. Plain bots without a Mini App are explicitly exempt. Design implication: build a normal bot that links out to an external web signing page or a wallet's in-app browser, not a Mini App wallet.
   - The Argent Telegram wallet SDK `@argent/tma-wallet` is marked **deprecated** on npm ("Package no longer supported"; last version 1.19.3, Jan 2025).
   - Confidence: high. Sources: https://core.telegram.org/bots/blockchain-guidelines, `npm view @argent/tma-wallet`
2. **Blocks are about 1.8 s now, not 6 s.** Measured: 1.781 s average over 1,000 mainnet blocks and 1.70 s on Sepolia. Pre-confirmations arrive in under a second. Plan event polling and push rates for this. Confidence: high.
3. **Use JSON-RPC 0.10.** RPC 0.6–0.8 were removed in Pathfinder 0.23 (July 2026). RPC 0.9 deprecation is planned for v0.15. Confidence: high.
4. **The official docs tables are stale on staking parameters.** On-chain values differ: epoch length 1,961 blocks (docs say 1,132), attestation window 60 blocks (docs say 50), LBTC is disabled, and strkBTC is an active stakable token. Read parameters from the contracts, not the docs. Confidence: high (verified on-chain).
5. **ERC-20 Transfer events come in two layouts.** STRK, ETH, native USDC and USDT use one layout; USDC.e and WBTC use the legacy one (section 2). A parser must handle both. Confidence: high (verified on-chain).

## 1. Network and JSON-RPC

### Versions
| Item | Value | Confidence | Source |
|---|---|---|---|
| Starknet version, mainnet and Sepolia | **0.14.4**. Mainnet 5 Oct 2026, testnet 15 Sep 2026. `starknet_version` in the latest block header is "0.14.4" | high | https://community.starknet.io/t/starknet-v0-14-4-prerelease-notes/116341, docs chain-info, on-chain |
| Recent upgrades | 0.14.0 (1 Sep 2025): Tendermint, 3 sequencers, pre-confirmations, EIP-1559 L2 gas, RPC 0.9. 0.14.1 (10 Dec 2025): Blake class hashes. 0.14.2 (≈Mar–Apr 2026): Stwo verification, L1 finality under 3 h. 0.14.3 (mainnet 6–8 Jul 2026): SNIP-35 dynamic min base fee, SNIP-40 faster blocks, RPC 0.8 dropped. 0.14.4: SNIP-36 full-block proving, small gas repricing, feeder-gateway `call`/`get_storage_at`/`get_nonce`/`get_class_hash_at`/`get_code`/`get_full_contract` removed | high | https://docs.starknet.io/learn/cheatsheets/version-notes.md, https://community.starknet.io/t/starknet-0-14-3-pre-release-notes/116211, https://community.starknet.io/t/snip-40-more-frequent-blocks/116203 |
| Next version | v0.15: decentralized validation (Staking v3), 2x throughput, L1 finality under 1.5 h, RPC 0.9 deprecation. Target was **Sep 2026 and it has slipped**: the chain is still on 0.14.4 and the deployed staking contract has no v3 entrypoints | high (that it slipped) | https://www.starknet.io/developers/version-releases/, on-chain |
| Spec repo | `starkware-libs/starknet-specs`. Latest tag v0.10.4. Each spec is now versioned separately: full-node RPC 0.10.2, Wallet API 0.10.4, Proving API 0.10.3. `master` `api/*.json` reports 0.10.4 | high | https://github.com/starkware-libs/starknet-specs |
| Versions served by nodes | Pathfinder ≥0.23 serves 0.9 at `/` and `/rpc/v0_9`, and 0.10 at `/rpc/v0_10`. Required for 0.14.4: Pathfinder v0.24.0 or Juno v0.16.6. Live `starknet_specVersion` results: publicnode 0.10.3, Cartridge 0.10.2, ZAN root 0.9.0, ZAN `/rpc/v0_10` 0.10.3-rc.0 | high | https://docs.chainstack.com/reference/starknet-pathfinder-0-23-0-rpc-version-removal, on-chain |
| Chain IDs | `SN_MAIN` = 0x534e5f4d41494e; `SN_SEPOLIA` = 0x534e5f5345504f4c4941 | high | on-chain |

### Methods a bot needs (spec 0.10.x)
- `starknet_getEvents(filter)`
  - Filter fields: `from_block`, `to_block`, `address`, `keys: [[...]]`, `chunk_size` (required), `continuation_token`.
  - `address` accepts a single address or, **from 0.10.1, a list**. Multi-address filtering verified.
  - Result: `{events[], continuation_token?}`. The token is absent on the last page.
  - Each emitted event carries `block_hash`, `block_number`, `transaction_hash`, and, **new in 0.10.0**, `transaction_index` and `event_index`.
  - Events from the pre-confirmed block have no `block_hash`.
  - Errors: `PAGE_SIZE_TOO_BIG`, `INVALID_CONTINUATION_TOKEN`, `TOO_MANY_KEYS_IN_FILTER`, `BLOCK_NOT_FOUND`.
  - Page limits: Pathfinder `EVENT_PAGE_SIZE_LIMIT = 1024`. Juno (publicnode) accepted 10,240 and rejected 10,241.
  - Continuation tokens are opaque and node-specific (Juno returns e.g. `16283672-6`). Don't move a pagination between providers. Confidence: high.
- `starknet_call(request, block_id)` → felt array. Errors: `ENTRYPOINT_NOT_FOUND`, `CONTRACT_ERROR`.
- `starknet_getTransactionReceipt(hash)`: receipt plus `block_number`. `block_hash` is missing if the receipt is from the pre-confirmed block.
- `starknet_getTransactionStatus(hash)` → `{finality_status: RECEIVED|CANDIDATE|PRE_CONFIRMED|ACCEPTED_ON_L2|ACCEPTED_ON_L1, execution_status?: SUCCEEDED|REVERTED, failure_reason?}`. `REJECTED` was removed in 0.9.
- `starknet_blockNumber`, `starknet_blockHashAndNumber`, `starknet_getBlockWithTxHashes(block_id)`.
- Block tags: `l1_accepted`, `latest`, `pre_confirmed`. `pending` was renamed in 0.9.
- `starknet_getClassAt(block_id, address)` gives the ABI. Useful for detecting Cairo-0 versus Cairo-1 token layouts.
- `starknet_estimateFee(request[], simulation_flags (required, e.g. ["SKIP_VALIDATE"] for unsigned), block_id)`. Fees are **FRI (STRK) only**, and only v3 transactions are accepted.
- New in 0.10: `starknet_getStorageProof`, `response_flags` on `getStorageAt`, `starknet_getMessagesStatus`.
- Source: `api/starknet_api_openrpc.json` at tags v0.9.0, v0.10.0, v0.10.1, v0.10.2 and master. Confidence: high.

### WebSocket API (`api/starknet_ws_api.json`)
- **Methods:**
  - `starknet_subscribeNewHeads(block_id?)`
  - `starknet_subscribeEvents(from_address (single or list from 0.10.1), keys, block_id?, finality_status: PRE_CONFIRMED|ACCEPTED_ON_L2 (default))`
  - `starknet_subscribeTransactionStatus(transaction_hash)`
  - `starknet_subscribeNewTransactionReceipts(finality_status[], sender_address[])`
  - `starknet_subscribeNewTransactions`
  - `starknet_unsubscribe`
  - Notifications use the `starknet_subscription*` names. `starknet_subscriptionReorg` carries `REORG_DATA` (start and end block hash and number).
- **Limits:** backfill is capped at **1024 blocks back** (`TOO_MANY_BLOCKS_BACK`). The subscription `block_id` cannot be `pre_confirmed` or `l1_accepted`.
- **Duplicates:** with `PRE_CONFIRMED`, the same event can arrive once per finality change. Deduplicate on `(tx_hash, event_index)`.
- **Provider support:**
  - publicnode (`wss://starknet-rpc.publicnode.com`): `subscribeNewHeads` works. One `subscriptionEvents` notification arrived, with `finality_status` and `event_index` in the payload, but event delivery was inconsistent in 15–25 s tests. Confidence: low on reliability.
  - Pathfinder 0.24 sends server-initiated pings that clients must answer (Chainstack handles this for you).
  - Infura, QuickNode and OnFinality advertise WSS, per Starknet docs and provider pages. Not tested.
  - Sources: https://docs.chainstack.com/changelog/chainstack-updates-september-3-2026, https://docs.starknet.io/learn/cheatsheets/integrations.md

### Finality, reorgs and timing
| Item | Value | Confidence |
|---|---|---|
| Consensus | 3 StarkWare-operated sequencers, Tendermint, 1-block finality. `ACCEPTED_ON_L2` is final in practice | high (SNIP-30) |
| `CANDIDATE` | Can fall back to `RECEIVED`; a roughly constant small share does | high |
| `PRE_CONFIRMED` | Executed with a receipt. Can be dropped only if consensus fails to finalize the proposal ("very rare") | high |
| Reorgs | The spec keeps the reorg notification. Practically, reorg risk applies only to pre-confirmed data | moderate |
| Block time | Docs: closes at 2 s if idle, 9.5 s maximum. Measured average 1.78 s on mainnet. SNIP-40 cut the execution slot from 2 s to 1.5 s | high |
| L1 finality | Measured lag of `l1_accepted` behind `latest`: 5,432 blocks, about 2.7 h | high (one sample) |
| Block limits | Max L2 gas per tx 1.11e9; 500 tx per block; 1,000 events per tx; 5,000 calldata felts | high (docs chain-info) |

Sources: https://community.starknet.io/t/snip-30-v0-14-0/115756, https://community.starknet.io/t/sn-0-14-0-pre-release-notes/115618, https://docs.starknet.io/resources/chain-info.md

## 2. Tokens

| Token | Mainnet | Sepolia | Decimals | Transfer layout | Confidence |
|---|---|---|---|---|---|
| STRK | 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d | same | 18 | keys=[sel, from, to], data=[low, high] | high (on-chain) |
| ETH | 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7 | same | 18 | keys=[sel, from, to], data=[low, high] | high |
| USDC (native, Circle, CCTP) | 0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb | 0x512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343 | 6 | keys=[sel, from, to], data=[low, high] | high |
| USDC.e (bridged, legacy) | 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8 | 0x53b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080 | 6 | **keys=[sel], data=[from, to, low, high]** | high |
| USDT | 0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8 | — | 6 | keys=[sel, from, to] | high |
| WBTC | 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac | — | 8 | **legacy, all in data** | high |
| vSTRK (voting) | 0x0782f0ddca11d9950bc3220e35ac82cf868778edb67a5e58b39838544bc4cd0f | 0x035c332b8de00874e702b4831c84b22281fb3246f714475496d74e644f35d492 | 18 | — | high (docs) |
| strkBTC | 0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135 | — | 8 | not sampled | high (address and decimals) |

- **Native USDC:** launched 3 Dec 2025. USDC.e migration contract: mainnet 0x07bffc7f6bda62b7bee9b7880579633a38f7ef910e0ad5e686b0b8712e216a19, Sepolia 0x431cba89859cfd85283cf34b99ad53bf53d66c41844a7698d9179900b103813. Token lists now label the old token "USDC.e".
  - Note: AVNU's paymaster docs example still uses the USDC.e address and labels it "USDC".
  - Sources: https://www.circle.com/blog/now-available-native-usdc-cctp-on-starknet, https://docs.avnu.fi/updates/circle-usdc-migration
- **Full bridged list:** https://github.com/starknet-io/starknet-addresses/blob/master/bridged_tokens/mainnet.json (126 entries).
- **Selectors** (`sn_keccak`, the low 250 bits of keccak256 of the name):
  - Transfer 0x0099cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9
  - Approval 0x0134692b230b9e1ffa39098904722134159652b09c5bc41d88d6698779d228ff
  - `balance_of` 0x035a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33
  - `balanceOf` 0x02e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e
  - `transfer` 0x0083afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e
- **Amounts:** u256 is two felts, `low` (u128) then `high` (u128). value = low + high·2^128.
- **Address normalization:**
  - RPC returns lowercase hex **without leading zeros** (e.g. `0x4718f5a0…` and `0x5dd3d2f4…`).
  - Normalize with `addAddressPadding` (pads to 64 hex chars) and `validateAndParseAddress`. Valid range is [0, 2^251 − 256) (`ADDR_BOUND = 2n**251n − 256n`).
  - `getChecksumAddress` and `validateChecksumAddress` give mixed-case display forms.
  - Subscription and filter matching worked with both padded and unpadded input in testing, but compare stored values only after normalizing.
  - Source: starknet.js 11.2.0 `dist/index.mjs`. Confidence: high.
- **Privacy caveat:** STRK20, the protocol-level shielded ERC-20 pool, launched in May 2026 (one source says 2025, which conflicts with strkBTC on 12 May 2026 being built on it). Private transfers will not show up as normal per-user Transfer events. **Not verified:** the pool address and its event shapes. Sources: https://www.starknet.io/blog/privacy-live-on-starknet/, https://community.starknet.io/t/snip-39-strkbtc-as-a-stakable-token-on-starknet/116180

## 3. Staking (BTC staking is live; v3 is not)

### Addresses
Source: https://docs.starknet.io/resources/chain-info.md. Confidence: high, cross-checked on-chain.

| Contract | Mainnet | Sepolia |
|---|---|---|
| Staking | 0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7 | 0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1 |
| Attestation | 0x10398fe631af9ab2311840432d507bf7ef4b959ae967f1507928f5afe888a99 | 0x03f32e152b9637c31bfcf73e434f78591067a01ba070505ff6ee195642c9acfb |
| L2 Reward supplier | 0x009035556d1ee136e7722ae4e78f92828553a45eed3bc9b2aba90788ec2ca112 | 0x02ebbebb8ceb2e07f30a5088f5849afd4f908f04f3f9c97c694e5d83d2a7cc61 |
| Minting curve | 0x00ca1705e74233131dbcdee7f1b8d2926bf262168c7df339004b3f46015b6984 | 0x06043928ca93cff6d6f39378ba391d7152eea707bdd624c1b2074e71af2abaca |

### Live state on mainnet (12 Oct 2026, verified on-chain)
- The staking contract returns `identify` = "Staking Core Contract" and `version` = "3.0.0" (class 0x5a93367d…63a7). Pool and attestation contracts also report versions; despite "3.0.0", this is not Staking v3 (next bullet).
- **The deployed ABI has none of these:** `staker_info_v3`, `staker_pool_info_v3`, `get_stakers`, `set_public_key`, `update_rewards`. The `main` branch spec does. Treat the main-branch spec as future v3 work.
- `get_epoch_info` = [duration 3600 s, length **1961** blocks, starting_block 16280708, starting_epoch 13589, previous_length 2022, previous_duration 3600]. `get_current_epoch` = 13592.
- `attestation_window` = **60** blocks. `contract_parameters_v1`: `min_stake` 20,000 STRK; exit wait window 604,800 s (7 days); commission is expressed so that 10,000 = 100%.
- `get_active_tokens` = STRK, WBTC, tBTC (0x04daa177…a32f, 18 dec), SolvBTC (0x0593e034…1a68, 18 dec), strkBTC. `get_tokens` shows LBTC (0x036834a4…61a4) present but **disabled**.
- `get_total_stake` ≈ 1.54 B STRK.
- BTC weight α = 0.25 (docs). strkBTC was added as stakable via SNIP-38/39 (votes 30 Apr–7 May 2026).

### Reading a delegator's position
1. Find the pool:
   - `staking.staker_pool_info(staker)` → `{commission: Option<u16>, pools: Span<{pool_contract, token_address, amount}>}`
   - or index `NewDelegationPool` events from the staking contract: keys `[sel, staker, pool, token]`, data `[commission]`
   - or index `NewPoolMember` events from pools: keys `[sel, pool_member, staker]`, data `[reward_address, amount]`
   - There is no on-chain "pools by delegator" lookup.
2. `pool.get_pool_member_info_v1(member)` → `Option<PoolMemberInfoV1>`. The deployed fields are `reward_address`, `amount`, `unclaimed_rewards`, `commission`, `unpool_amount`, `unpool_time: Option<Timestamp>`. There is **no `index` field**, unlike the spec doc. `pool_member_info_v1` panics if the member doesn't exist.
3. `pool.contract_parameters_v1` → `{staker_address, staker_removed, staking_contract, token_address, commission}`.
4. Pool writes the bot might prepare:
   - `enter_delegation_pool(reward_address, amount: u128)` (approve first)
   - `add_to_delegation_pool(pool_member, amount)`
   - `exit_delegation_pool_intent(amount)`, then `exit_delegation_pool_action(pool_member)` after 7 days
   - `claim_rewards(pool_member)`
   - `switch_delegation_pool(to_staker, to_pool, amount)`
   - `change_reward_address`
5. Off-chain alternative: AVNU `GET https://starknet.api.avnu.fi/staking/v3/pools/{pool}/members/{user}`. Confidence: moderate. AVNU docs mention a "21-day unbonding", which conflicts with the 7-day protocol window; that is unexplained.

### Validators, attestation and uptime
- `staking.get_staker_info_v1(staker)` → `Option<StakerInfoV1{reward_address, operational_address, unstake_time, amount_own, unclaimed_rewards_own, pool_info}>`.
- Attestation contract:
  - `is_attestation_done_in_curr_epoch(staker) → bool`
  - `get_last_epoch_attestation_done(staker) → u64`
  - `get_current_epoch_target_attestation_block(operational_address) → u64`
  - `attestation_window() → u16`
  - `attest(block_hash: felt252)`
- Rewards are all-or-nothing per epoch, depending on whether the validator attested.
- **Event selectors:**
  - StakerAttestationSuccessful 0x0091c3ab09c7f8e43ee51b47e1d70a51504cd3eb502772b2e2e3468c1ff6101d (key staker; data epoch)
  - PoolMemberRewardClaimed 0x00c4a5eb3afec3e38cbe8f43f66c46bb0ca74ae6f10bfbd7c7f0f461d5cdb9f4
  - PoolMemberBalanceChanged 0x03b0fee275c2f63e42b158a5cc9b25763eae5e381838169c0d71894c17dd28f7
  - PoolMemberExitIntent 0x002e309d31f742f40d496b60a19924887d14030b501c6e3cbeee4527ed7afb66
  - StakerRewardsUpdated 0x028b7fe11255d1d3dd57160f700d3a9f7b51d41e927d09d064883fb2cb45a8a8
  - RewardsSuppliedToDelegationPool 0x0099f25da3a1ac61dd57efe764c2d59fe1c7a46f1af83f02cacb02788604e458
  - CommissionChanged 0x015afa36592893e022dad8dc82366d172f358329e7011d0ab5a62c9ef2cf8548
  - StakerExitIntent 0x039e60bdd93051093edfb85be43db7de37436b5c537c8fd6ec2a69ac31175ee0
- Sources: https://docs.starknet.io/learn/protocol/staking.md, https://github.com/starkware-libs/starknet-staking/blob/main/docs/spec.md (main is ahead of what's deployed), on-chain ABI.

## 4. Starknet ID (.stark)

Verified on-chain on mainnet and Sepolia.
- **Naming contract:** mainnet 0x06ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678 (class 0x27bb37f5…66b7); Sepolia 0x0154bc2e1af9260b9e66af0e9c46fc757ff893b3ff6a85718a810baf1474.
- **Entrypoints:**
  - `domain_to_address(domain: Span<felt252>, hint: Span<felt252>) → ContractAddress`
  - `address_to_domain(address, hint: Span<felt252>) → Span<felt252>`
  - also `resolve`, `domain_to_expiry`, `domain_to_data`, `domain_to_id`
- **Encoding:** each label is one felt in base 38 (alphabet `abcdefghijklmnopqrstuvwxyz0123456789-` plus special rules). Pass an empty `hint` (`0x0`).
- **Tested:** starknet.stark, ben.stark, vitalik.stark and fricoben.stark all round-trip forward and reverse.
- **Libraries:** starknet.js `provider.getStarkName(address)`, `getAddressFromStarkName(name)`, `getStarkProfile`; `starknetid.js` 5.0.0 (Jan 2026).
- I found no sunset notice. Confidence: high.

## 5. Prices and DEX events

### Pragma oracle
Verified on-chain.
- Mainnet 0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b; Sepolia 0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a.
- `get_data_median(DataType)`, where `DataType` is `SpotEntry(felt)` = variant 0, `FutureEntry` = 1, `GenericEntry` = 2.
- Calldata for spot ETH/USD: `["0x0", shortstring("ETH/USD")]`.
- Returns `PragmaPricesResponse{price: u128, decimals: u32, last_updated_timestamp: u64, num_sources_aggregated: u32, expiration_timestamp: Option<u64>}`.
- Also available: `get_data(DataType, AggregationMode{Median|Mean|ConversionRate})`, `get_data_with_USD_hop`, `get_data_median_multi`.
- **Decimals differ by pair:** STRK/USD, ETH/USD and BTC/USD have 8; USDC/USD has 6. Always read `decimals`.
- Update freshness at check time: ETH/STRK about 11 s, BTC/USDC about 4 min.
- Other on-chain oracles listed in Starknet docs: Chainlink and Pyth.

### Swap events
All verified on mainnet over the last 500–5,000 blocks.

**Ekubo Core** 0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b
- Event `Swapped`, selector 0x0157717768aca88da4ac4279765f09f4d0151823d573537fbbeb950cdbd9a870.
- keys = [sel]; data has 21 felts:
  - `locker`
  - `pool_key{token0, token1, fee, tick_spacing, extension}`
  - `params{amount: i129{mag, sign}, is_token1, sqrt_ratio_limit: u256, skip_ahead}`
  - `delta{amount0: i129, amount1: i129}`
  - `sqrt_ratio_after: u256`
  - `tick_after: i129`
  - `liquidity_after`
- Activity: 942 swaps in 500 blocks.

**AVNU Exchange** 0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f
- Event `Swap`, selector 0x00e316f0d9d2a3affa97de1d99bb2aac0538e2666d0d8545545ead241ef0ccab (all events named "Swap" share this selector).
- keys = [sel]; data = [taker, sell_token, sell_amount(low, high), buy_token, buy_amount(low, high), beneficiary].
- Aggregator swaps also fire events in the underlying DEXes, so deduplicate per transaction.

**JediSwap V1 pairs and 10KSwap pairs** (legacy Uniswap-V2 style)
- keys = [sel]; data has 10 felts: [sender, amount0In(lo, hi), amount1In(lo, hi), amount0Out(lo, hi), amount1Out(lo, hi), to].
- Factories: JediSwap V1 0x00dad44c139a476c7a17fc8141e6db680e9abc9f56fe249a105094c44382c2fd; 10KSwap 0x01c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2. Both still have low but non-zero swap activity.
- JediSwap V2 factory 0x01aa950c9b974294787de8df8880ecf668840a6ab8fa8290bf2952212b375148 is deployed. I did not decode its pool event layout.

**Other active swap emitters**
- Nostra pools: Cairo-1 `Swap` with all fields in data.
- StarkDefi (`vStarkDefi Pair`): sender and to are keys.
- An unidentified "prop_amm" contract at 0x20d2431b…fb6 (keys = [sel, pool_id, trader]): 165 swaps in 5,000 blocks.

## 6. Account abstraction and user-signed flows (bot never holds keys)

### SNIP-9 outside execution
- Status: Review.
- V2 interface ID 0x1d1144bb2138366ff28d8e9ab57456b1d332ac42196230c3a602003c89872.
- `execute_from_outside_v2(OutsideExecution{caller, nonce, execute_after: u64, execute_before: u64, calls}, signature)` and `is_valid_outside_execution_nonce`.
- Signed as SNIP-12 rev 1, domain name "Account.execute_from_outside", version 2.
- `caller` = `'ANY_CALLER'` (0x414e595f43414c4c4552) allows any relayer.
- The deployed Ready (Argent) account ABI exposes `execute_from_outside_v2` and `ISessionable`.
- Source: https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-9.md. Confidence: high.

### SNIP-29 paymaster API
- Status: Review. API version 0.1.0-rc0.
- Methods: `paymaster_isAvailable`, `paymaster_getSupportedTokens`, `paymaster_buildTransaction`, `paymaster_executeTransaction`, `paymaster_trackingIdToLatestHash`.
- Flow: the service returns SNIP-9 typed data, the user signs it, the relayer submits.
- AVNU endpoints: `https://starknet.paymaster.avnu.fi` and `https://sepolia.paymaster.avnu.fi` (also the starknet.js `PAYMASTER_RPC_NODES` defaults).
- Live `paymaster_isAvailable` returned true, and 34 gas tokens are supported, including native USDC.
- Modes:
  - "gasless": the user pays in a token; no API key.
  - "gasfree": the dApp sponsors; needs an API key from portal.avnu.fi.
- `@avnu/gasless-sdk` is deprecated on npm. Use starknet.js `PaymasterRpc` or `@avnu/avnu-sdk` 4.2.0.
- Sources: https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-29.md, https://docs.avnu.fi/docs/paymaster.md. Confidence: high.
- **starknet.js advisories (28 Sep 2026)** include three paymaster/SNIP-12 issues rated High: GHSA-wcqp-4fff-8rjj, GHSA-h32h-x935-6345, GHSA-qc84-vrxf-5cqj. Use ≥10.8.0. Source: https://github.com/starknet-io/starknet.js/security/advisories

### Session keys
- There is no common standard. Ready (Argent: `@argent/x-sessions` 8.0.1), Braavos, Cartridge (Controller 0.14.2, policy-scoped `{target, method}`, sponsorable) and Chipi each use their own format and are mutually incompatible.
- A draft SNIP (Chipi, 17 Feb 2026) has no number yet.
- Granting a session to a bot-held key gives the bot limited signing authority. Treat that as custody-adjacent.
- Source: https://community.starknet.io/t/snip-session-keys-for-smart-accounts/116132. Confidence: moderate.

### Wallets and connection
- Argent is now **Ready** ("Ready Wallet (formerly Argent)").
- starknetkit 3.4.3 has a `ReadyConnector`: QR on desktop, app redirect on mobile, automatic connection in the in-app browser. Needs a WalletConnect `projectId`.
- Other packages: `@starknet-io/get-starknet` 4.0.8.
- Wallet API 0.10.4 methods include `wallet_requestAccounts`, `wallet_addInvokeTransaction`, `wallet_signTypedData`, `wallet_switchStarknetChain`, `wallet_watchAsset`, and STRK20 methods.
- Braavos: dApps are opened from its in-app browser.
- **Not verified:** deep-link URL schemes for either Ready or Braavos.
- Official TS SDK **Starkzap** (`starkzap` 4.0.1, keep-starknet-strange) wraps Privy, Cartridge, AVNU paymaster, staking, swaps and Vesu.
- Source: https://www.starknetkit.com/docs/latest/connectors/ready. Confidence: moderate.

### Recommended non-custodial pattern
1. The bot stores an intent server-side (calls array or typed data).
2. The bot sends a link to an external web page, not a Mini App, carrying only an opaque intent ID.
3. The page connects with starknetkit or get-starknet and calls `wallet_addInvokeTransaction`. For gasless, the user signs SNIP-29 typed data and AVNU relays it.
4. The bot tracks the result with `subscribeTransactionStatus` or `getTransactionStatus`.

This is my synthesis from the sources above; moderate confidence.

## 7. Libraries and providers

### starknet.js
- npm `latest` = **10.8.0** (10 Sep 2026); `next` = **11.2.0** (12 Oct 2026); 11.0.0 released 14 Sep 2026.
- Node **>=22** for v8–10, and **>=22.12** for v11.
- Supports RPC 0.9.0 and 0.10.0/0.10.2/0.10.3/0.10.4. Default `rpcVersion` "0.10.0". Default public node is ZAN (`api.zan.top/public/starknet-mainnet/rpc/`).
- v10 breaking change: Account no longer extends Provider (use `account.provider.*`), and default providers were removed.
- v11 breaking changes: `@noble` 2.x, signatures as `{r, s}`, a pluggable transport including a WebSocket transport, `Provider` alias deprecated (use `RpcProvider`), `WalletAccount` deprecated in favor of `WalletAccountV6`.
- 7.x–9.x are end-of-life with six advisories (28 Sep 2026).
- Confidence: high. Sources: `npm view starknet`, https://github.com/starknet-io/starknet.js/releases

### Alternatives
- starknet.go, starknet-rs, starknet-jvm, starknet.swift.
- `@starknet-io/types-js` 0.10.4 (types only).
- starknetid.js 5.0.0.
- Starkzap (higher-level SDK).
- Lightweight route: raw JSON-RPC plus `@scure/starknet` for hashing and signatures. starknet.js 11 depends on it.

### Public endpoints, tested 12 Oct 2026
| Endpoint | Status |
|---|---|
| `https://starknet-rpc.publicnode.com` (+ `wss://`) | OK, spec 0.10.3, Juno v0.16.8. Sepolia: `starknet-sepolia-rpc.publicnode.com` |
| `https://api.cartridge.gg/x/starknet/mainnet` | OK, 0.10.2 |
| `https://api.zan.top/public/starknet-mainnet` | OK, root 0.9.0, `/rpc/v0_10` 0.10.3-rc.0; 25 fast requests all returned 200 |
| Blast API | **Shut down** ("Blast API is no longer available… use Alchemy") |
| Lava public endpoint | **Discontinued** |
| dRPC free tier | Starknet not on the free plan |
| Nethermind free-rpc | No response |

- **Rate limits:** no published numbers for these public endpoints. Commercial free tiers from secondary sources (low confidence): Alchemy 30M CU/month, Infura 3M credits/day, QuickNode 10M credits/month, Chainstack 3M RU/month.
- **Provider list (docs):** Alchemy, All That Node, BlockPI, Chainstack, dRPC, Dwellir, GetBlock, Infura, Lava, NOWNodes, OMNIA, OnFinality (open WSS), QuickNode, Spectrum, Zan.
- Source: https://docs.starknet.io/learn/cheatsheets/integrations.md

### Explorers
starkscan.co, explorer.cartridge.gg, OKLink and ViewBlock respond. voyager.online returns 403 to scripted requests (bot protection).

## 8. Governance
- **On-chain votes: Snapshot X on Starknet.** Space `0x009fedaf0d7a480d21a27683b0965c0f8ded35b3f1cac39827a25a06a8a682a4`. Readable from the `api.snapshot.box` GraphQL; the web UI is snapshot.box.
  - Recent proposals: #15 "Starknet v0.14.3 (Updated)", 19–26 Jun 2026; #14 v0.14.3; #12/#13 strkBTC (SNIP-38/39), from 30 Apr 2026; #11 v0.14.2, Apr 2026; #9 v0.14.0, Aug 2025.
  - **I found no v0.14.4 proposal.**
  - Confidence: high.
- **Off-chain polls: Snapshot space `starknet.eth`** (hub.snapshot.org). Voting strategies: vSTRK on Starknet (`erc20-votes-starknet`), STRK on L1, `strk-staked-balance`, and a whitelist for Starknet Foundation-delegated weight. Latest polls ran 30 Mar–6 Apr 2026. Confidence: high.
- **Front end:** https://governance.starknet.io. Hub V1 is meant to merge both vote types. Delegate model: about 1.7B STRK of voting power across 180 tiered delegates in 2026, and holders must delegate before a vote. Confidence: moderate. Source: https://community.starknet.io/t/starknet-governance-call-january-2026-meeting-minutes/116104

## Could not verify / open flags
- Event-subscription reliability on any free WSS endpoint; WSS support at Alchemy and Chainstack beyond their own documentation.
- Ready and Braavos mobile deep-link URL formats.
- The STRK20 privacy pool address and its events; its exact launch date (sources disagree on 2025 versus 2026).
- The identity of the "prop_amm" swap contract (0x20d2431b…fb6), and the JediSwap V2 pool event layout.
- Whether v0.14.4 went through a governance vote.
- Free-tier rate limits (secondary sources only).
- AVNU's "21-day unbonding" versus the 7-day protocol exit window.
- The new v0.15 / Staking v3 date. The September 2026 target has passed and I found no replacement date.

The working files from these checks (spec JSONs, staking spec, and `rpc.py` with a pure-Python keccak and selector helper) are in `/private/tmp/claude-501/-Volumes-Crucial-X9-Project-Zero/d800fe91-298c-4880-a918-3f58ce7625b8/scratchpad/sn-research/`.