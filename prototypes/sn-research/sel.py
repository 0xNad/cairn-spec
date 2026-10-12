import sys
sys.path.insert(0, "/private/tmp/claude-501/-Volumes-Crucial-X9-Project-Zero/d800fe91-298c-4880-a918-3f58ce7625b8/scratchpad/sn-research")
from rpc import sel
names=["Transfer","Approval","balance_of","balanceOf","decimals","symbol","Swapped","Swap",
"staker_pool_info","get_pool_member_info_v1","get_staker_info_v1","get_current_epoch","get_epoch_info",
"get_last_epoch_attestation_done","is_attestation_done_in_curr_epoch","attestation_window",
"get_data_median","domain_to_address","address_to_domain","StakerAttestationSuccessful","NewPoolMember","NewDelegationPool","CommissionChanged","contract_parameters_v1"]
for n in names: print(f"{n:36s} 0x{int(sel(n),16):064x}")
