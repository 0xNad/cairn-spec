import sys, json
sys.path.insert(0, "sn-research")
from rpc import rpc, sel
STK="0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7"
ATT="0x10398fe631af9ab2311840432d507bf7ef4b959ae967f1507928f5afe888a99"
def call(addr, fn, cd=[]):
    return rpc("starknet_call", {"request":{"contract_address":addr,"entry_point_selector":sel(fn),"calldata":cd},"block_id":"latest"})
head=rpc("starknet_blockNumber",[])
print("head",head, "spec", rpc("starknet_specVersion",[]))
print("current_epoch", call(STK,"get_current_epoch"))
print("epoch_info", call(STK,"get_epoch_info"))
ev=rpc("starknet_getEvents",{"filter":{"from_block":{"block_number":head-300},"to_block":"latest","address":ATT,"keys":[[sel("StakerAttestationSuccessful")]],"chunk_size":20}})
e=ev["events"][0]; print("attest event", json.dumps({k:e[k] for k in ("keys","data")}))
staker=e["keys"][1]
print("staker_pool_info", call(STK,"staker_pool_info",[staker]))
print("get_staker_info_v1", call(STK,"get_staker_info_v1",[staker]))
print("last_epoch_att", call(ATT,"get_last_epoch_attestation_done",[staker]))
print("done_curr", call(ATT,"is_attestation_done_in_curr_epoch",[staker]))
