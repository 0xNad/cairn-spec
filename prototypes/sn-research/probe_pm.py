import sys, json
sys.path.insert(0, "sn-research")
from rpc import rpc, sel
def call(addr, fn, cd=[]):
    return rpc("starknet_call", {"request":{"contract_address":addr,"entry_point_selector":sel(fn),"calldata":cd},"block_id":"latest"})
head=rpc("starknet_blockNumber",[])
POOL="0x2cb02c72e8a0975e69e88298443e984d965a49eab38f5bdde1f5072daa09cfe"
for nm,s in [("PoolMemberBalanceChanged","0x03b0fee275c2f63e42b158a5cc9b25763eae5e381838169c0d71894c17dd28f7"),("PoolMemberRewardClaimed","0x00c4a5eb3afec3e38cbe8f43f66c46bb0ca74ae6f10bfbd7c7f0f461d5cdb9f4")]:
    ev=rpc("starknet_getEvents",{"filter":{"from_block":{"block_number":head-200000},"to_block":"latest","address":POOL,"keys":[[s]],"chunk_size":5}})
    if ev["events"]:
        e=ev["events"][0]; print(nm, json.dumps({k:e[k] for k in ("keys","data")}))
        member=e["keys"][1]
print("member", member)
print("pool_member_info_v1", call(POOL,"get_pool_member_info_v1",[member]))
print("contract_parameters_v1", call(POOL,"contract_parameters_v1"))
# approval layouts
for sym,tok in [("STRK","0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"),("USDC.e","0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8"),("USDC","0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb"),("WBTC","0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac")]:
    ev=rpc("starknet_getEvents",{"filter":{"from_block":{"block_number":head-3000},"to_block":"latest","address":tok,"keys":[[sel("Approval")]],"chunk_size":3}})
    if ev["events"]:
        e=ev["events"][0]; print("Approval", sym, "keys", len(e["keys"]), "data", len(e["data"]), e.get("event_index"), e.get("transaction_index"))
    else: print("Approval", sym, "none in 3000 blocks")
