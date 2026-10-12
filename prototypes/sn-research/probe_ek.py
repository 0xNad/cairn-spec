import sys, json
sys.path.insert(0, "sn-research")
from rpc import rpc, sel
CORE="0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b"
TR=int(sel("Transfer"),16)
head=rpc("starknet_blockNumber",[])
ev=rpc("starknet_getEvents",{"filter":{"from_block":{"block_number":head-40},"to_block":"latest","address":CORE,"keys":[["0x0157717768aca88da4ac4279765f09f4d0151823d573537fbbeb950cdbd9a870"]],"chunk_size":4}})
coreint=int(CORE,16)
for e in ev["events"][:3]:
    d=[int(x,16) for x in e["data"]]
    t0,t1=d[1],d[2]
    a0=(d[12], d[13]); a1=(d[14],d[15])
    print("tx",e["transaction_hash"][:12],"token0",hex(t0)[:10],"token1",hex(t1)[:10],"delta0 mag,sign",a0,"delta1",a1)
    rc=rpc("starknet_getTransactionReceipt",[e["transaction_hash"]])
    for x in rc["events"]:
        if int(x["keys"][0],16)!=TR: continue
        k=[int(y,16) for y in x["keys"]]; dd=[int(y,16) for y in x["data"]]
        if len(k)==3: fr,to,amt=k[1],k[2],dd[0]+(dd[1]<<128)
        else: fr,to,amt=dd[0],dd[1],dd[2]+(dd[3]<<128)
        tok=int(x["from_address"],16)
        if coreint in (fr,to) and tok in (t0,t1):
            print("   transfer tok",hex(tok)[:10],"core_is", "sender" if fr==coreint else "receiver", "amt",amt)
    tx=rpc("starknet_getTransactionByHash",[e["transaction_hash"]])
    print("   tx type",tx.get("type"),"version",tx.get("version"),"sender",tx.get("sender_address","")[:12])
