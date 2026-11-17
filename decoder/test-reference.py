"""Independent stdlib reference cross-check of TS output, from libpo wire facts.
No use of the TypeScript CRC, state parser or mu-law implementation.
Run the TS fixture test first; only ignored derived artifacts are read.
"""
from pathlib import Path
import binascii,hashlib,json,struct

fixtures=Path(__file__).resolve().parent.parent/'t'/'official-backup-tests'
results=json.loads((fixtures/'decoder-results.json').read_text())
def pcm(codes):
    out=bytearray(len(codes)*4)
    for i,code in enumerate(codes):
        neg=code&128;mag=(~code)&127 if neg else code
        value=(((mag&15)*8+132)<<(mag>>4))-132
        struct.pack_into('<f',out,4*i,(-value if neg else value)/32768)
    return out
for result in results:
    wire=(fixtures/(result['name']+'.frame.bin')).read_bytes()
    assert wire[:4092]==bytes(i&255 for i in range(4092))
    assert wire[4092:4096]==bytes.fromhex('4db8165d')
    pos=4096;state=0x1d0f;packets=[]
    def take(n):
        global pos,state
        out=bytearray()
        for _ in range(n):
            raw=(wire[pos]-(state&255))&255;pos+=1
            state=binascii.crc_hqx(bytes([raw]),state);out.append(raw)
        return bytes(out)
    while pos<len(wire):
        tag,n=struct.unpack('<HB',take(3));payload=take(n);expected=state
        assert struct.unpack('<H',take(2))[0]==expected
        packets.append((tag,payload))
        if tag==0x826f:break
    assert pos==len(wire) and packets[0]==(0x985b,b'') and packets[-1]==(0x826f,b'')
    assert len(packets)==result['packets']
    patterns={};records={};active_pattern=None;active_sound=None;parts=[]
    for tag,payload in packets:
        if tag==0xa041:active_pattern=payload[0];patterns[active_pattern]=bytearray()
        elif tag==0xc498:patterns[active_pattern]+=payload
        elif tag==0x68b5:active_sound=payload[0];records[active_sound]=bytearray()
        elif tag==0xef78:records[active_sound]+=payload
    assert len(records)==136 and len(patterns)==16
    assert [hashlib.sha256(patterns[i]).hexdigest() for i in range(16)]==result['patternHashes']
    pools={i:bytes(v[9:]) for i,v in records.items() if len(v)>9}
    def clip(i):
        data=records[i]
        if not data:return None
        start,end,owner=struct.unpack('<IIB',data[:9]);return pools[owner][start:end]
    for slot in range(1,17):
        if slot<=8:codes=clip(slot-1)
        else:
            slices=[clip(8+16*(slot-9)+k) for k in range(16)]
            codes=b''.join(x for x in slices if x is not None) if any(x is not None for x in slices) else None
        expected=result['audioHashes'][slot-1]
        assert expected['frames']==(len(codes) if codes is not None else 0)
        digest=hashlib.sha256(pcm(codes)).hexdigest() if codes is not None else None
        assert digest==expected['pcmSHA256'],(result['name'],slot)
    events=sum(patterns[p][768+16*s+i]!=0 for p in range(16) for s in range(16) for i in range(16))
    assert events==result['triggers']
    print(f"PASS independent Python/libpo-facts reference: {result['name']}, {len(packets)} CRCs, 16 pattern byte hashes, 16 slot Float32 audio hashes, {events} notes.")
