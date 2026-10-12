import json, urllib.request, sys
URL="https://starknet-rpc.publicnode.com"
def rpc(method, params, url=URL):
    req=urllib.request.Request(url, data=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode(), headers={"content-type":"application/json","user-agent":"curl/8.7.1"})
    r=json.load(urllib.request.urlopen(req, timeout=30))
    if "error" in r: raise Exception(json.dumps(r["error"])[:500])
    return r["result"]

RC=[0x0000000000000001,0x0000000000008082,0x800000000000808A,0x8000000080008000,0x000000000000808B,0x0000000080000001,0x8000000080008081,0x8000000000008009,0x000000000000008A,0x0000000000000088,0x0000000080008009,0x000000008000000A,0x000000008000808B,0x800000000000008B,0x8000000000008089,0x8000000000008003,0x8000000000008002,0x8000000000000080,0x000000000000800A,0x800000008000000A,0x8000000080008081,0x8000000000008080,0x0000000080000001,0x8000000080008008]
ROT=[[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]]
M=(1<<64)-1
def _rol(x,n): return ((x<<n)|(x>>(64-n)))&M if n else x
def _f(A):
    for rc in RC:
        C=[A[x][0]^A[x][1]^A[x][2]^A[x][3]^A[x][4] for x in range(5)]
        D=[C[(x-1)%5]^_rol(C[(x+1)%5],1) for x in range(5)]
        A=[[A[x][y]^D[x] for y in range(5)] for x in range(5)]
        B=[[0]*5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                B[y][(2*x+3*y)%5]=_rol(A[x][y],ROT[x][y])
        A=[[B[x][y]^((~B[(x+1)%5][y])&B[(x+2)%5][y]) for y in range(5)] for x in range(5)]
        A[0][0]^=rc
    return A
def keccak256(data):
    rate=136
    p=bytearray(data)+b"\x01"
    while len(p)%rate: p+=b"\x00"
    p[-1]|=0x80
    A=[[0]*5 for _ in range(5)]
    for i in range(0,len(p),rate):
        blk=p[i:i+rate]
        for j in range(rate//8):
            x,y=j%5,j//5
            A[x][y]^=int.from_bytes(blk[8*j:8*j+8],"little")
        A=_f(A)
    out=b"".join(A[j%5][j//5].to_bytes(8,"little") for j in range(4))
    return out
def sel(name):
    return hex(int.from_bytes(keccak256(name.encode()),"big") & ((1<<250)-1))
