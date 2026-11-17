// Real WAV -> modem -> CRC -> original header bytes -> slice diagnostics.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const {decodePO33Backup}=await import('../src/codec/po33Codec.ts');
  const file=path.resolve(__dirname,'../t/official-backup-tests/escalate.wav');
  const logs=[];
  const project=decodePO33Backup(fs.readFileSync(file),{onSliceDiagnostic:d=>{
    logs.push(d);console.log(JSON.stringify({...d,'buffer.length':d.bufferLength}));
  }});
  assert.equal(logs.length,10);assert.deepEqual(logs,project.sliceDiagnostics);
  const expected=[
    ['DF 00 01 00 34 53 01 00 78',65759,86836],['5B 26 01 00 34 5A 01 00 78',75355,88628],
    ['55 56 01 00 CA A9 01 00 78',87637,109002],['D0 78 01 00 69 A9 01 00 78',96464,108905],
    ['AA AB 01 00 E0 F8 01 00 78',109482,129248],['C6 CE 01 00 81 F1 01 00 78',118470,127361],
    ['F2 5D 01 00 FD 6F 01 00 78',89586,94205],['FD 6F 01 00 DC 8F 01 00 78',94205,102364],
    ['DC 8F 01 00 FA AD 01 00 78',102364,110074],['FA AD 01 00 C0 FD 01 00 78',110074,130496]
  ];
  logs.forEach((d,i)=>{
    assert.equal(d.slotId,16);assert.equal(d.slotType,'drum');assert.equal(d.padIndex,6+i);
    assert.equal(d.recordId,126+i);assert.equal(d.sourcePoolId,120);
    assert.equal(d.bufferLength,65536);assert.equal(d.encodedByteLength,65536);
    assert.deepEqual([d.rawHex,d.startSample,d.endSample],expected[i]);
    const h=Buffer.from(d.rawHex.replaceAll(' ',''),'hex');
    assert.equal(h.readUInt32LE(0),d.startSample);assert.equal(h.readUInt32LE(4),d.endSample);
    assert.notEqual(d.startSample,0);assert.notEqual(d.startSample,0xffff);
    assert.notEqual(d.endSample,0);assert.notEqual(d.endSample,0xffff);
  });
  const valid=project.slots[15].slices.slice(0,6);
  assert.equal(valid[0].sourceStartSample,0);assert(valid.every(s=>s.rangeStatus==='complete'));
  assert(project.patterns.every(p=>p.steps.every(s=>!s.triggers.some(t=>t.slotId===16))));
  assert(project.pools.every(p=>p.audioBuffer.length===p.codes.length));
  // Bit16 is real address data in valid slices elsewhere in the very same WAV.
  const high=project.raw.state.sounds[19];
  assert.equal(high.start,67347);assert.equal(high.end,81919);
  assert.equal(project.pools.find(p=>p.id===high.owner).audioBuffer.length,90112);
  assert(high.start>0xffff && high.end<=90112);
  fs.writeFileSync(path.resolve(__dirname,'../t/official-backup-tests/escalate-slice-diagnostics.json'),JSON.stringify(logs,null,2));
  console.log('PASS: ten original headers, LE32 coordinates, source pool/code/PCM lengths, drum mapping, valid zero start and no slot16 notes in all sixteen patterns. No address masks or recovery guesses applied.');
})().catch(e=>{console.error(e);process.exitCode=1;});
