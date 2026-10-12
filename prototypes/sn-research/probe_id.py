import sys, json
sys.path.insert(0, "sn-research")
from rpc import rpc, sel
NAMING="0x06ac597f8116f886fa1c97a23fa4e08299975ecaf6b598873ca6792b9bbfb678"
PRAGMA="0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b"
A="abcdefghijklmnopqrstuvwxyz0123456789-"
def enc(s):
    v=0;m=1
    for i,c in enumerate(s):
        if i==len(s)-1 and c=="a": v+=m*37; m*=38*38
        else: v+=m*A.index(c); m*=38
    return v
def dec(v):
    s=""
    while v:
        d=v%38; v//=38
        if d==37:
            # trailing 'a' special (only valid at end)
            s+="a"; v//=38 if False else 1; 
        else: s+=A[d]
    return s
def call(addr, fn, cd=[]):
    return rpc("starknet_call", {"request":{"contract_address":addr,"entry_point_selector":sel(fn),"calldata":cd},"block_id":"latest"})
for name in ["starknet","ben","fricoben","vitalik"]:
    addr=call(NAMING,"domain_to_address",["0x1",hex(enc(name)),"0x0"])
    back=call(NAMING,"address_to_domain",[addr[0],"0x0"])
    print(name, hex(enc(name)), "->", addr, "reverse raw", back)
ss=lambda s: hex(int.from_bytes(s.encode(),"big"))
for p in ["STRK/USD","ETH/USD","USDC/USD"]:
    print(p, call(PRAGMA,"get_data_median",["0x0",ss(p)]))
