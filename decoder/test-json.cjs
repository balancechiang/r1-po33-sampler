const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {decodePO33Backup,encodePO33Backup}=await import('../src/codec/po33Codec.ts');
 const {projectToJSON,projectFromJSON}=await import('../src/codec/po33JSON.ts');
 for(const name of ['escalate','frekvens','16operators']){
  const p=decodePO33Backup(fs.readFileSync(path.join(__dirname,'../t/official-backup-tests/'+name+'.wav')));
  const text=projectToJSON(p),round=projectFromJSON(text);
  assert.deepEqual(round.raw.frameBytes,p.raw.frameBytes);assert.deepEqual(round.raw.state,p.raw.state);
  for(let i=0;i<p.pools.length;i++)assert.deepEqual(new Uint8Array(round.pools[i].audioBuffer.buffer),new Uint8Array(p.pools[i].audioBuffer.buffer));
  const wav=encodePO33Backup(round),again=decodePO33Backup(wav);assert.deepEqual(again.raw.frameBytes,p.raw.frameBytes);
  const invalid=JSON.parse(text);invalid.project.pools[0].audioBuffer.base64=Buffer.alloc(4).toString('base64');assert.throws(()=>projectFromJSON(JSON.stringify(invalid)),/audio differs/);
  assert.throws(()=>projectFromJSON('{"raw":{"frameBytes":[0]}}'),/frame size/);
  fs.writeFileSync(path.join(__dirname,'../t/official-backup-tests/'+name+'.project.json'),text);
  console.log('PASS '+name+': Float32 byte-identical Base64 JSON, raw frame/state retained, JSON -> standard WAV -> identical checked frame; stale PCM rejected; JSON bytes '+Buffer.byteLength(text));global.gc?.();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
