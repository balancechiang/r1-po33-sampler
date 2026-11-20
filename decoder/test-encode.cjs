const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {decodePO33Backup,encodePO33Backup,transferTimeline}=await import('../src/codec/po33Codec.ts');
 const {buildHardwareProject}=await import('../src/codec/po33WebProject.ts');
 const {serializeState}=await import('./vendor/so-sample/state.ts');
 const {encodePackets}=await import('./vendor/so-sample/packets.ts');
 const {parseWav}=await import('./vendor/so-sample/wav.ts');
 const {adapt}=require('../project-preview-adapter.js');
 function snapshot(p){
  let serial=0;const assets=[];
  const c={createBuffer(ch,n,rate){const pcm=new Float32Array(n),id='asset'+serial++;assets.push({id,rate,data:pcm});return {sampleRate:rate,length:n,id,copyToChannel(a){pcm.set(a);}};}};
  const a=adapt(p,c),view=s=>s?{asset:s.buffer.id,offset:s.offset||0,duration:s.duration}:null;
  return {assets,slots:a.samples.map(s=>s?{...view(s),...(s.sliceViews?{slices:s.sliceViews.map(view)}:{})}:null),patterns:a.patterns,extras:a.extras,tweaks:a.tweaks,bpm:a.bpm,swing:0,chain:a.chain,pattern:1};
 }
 for(const name of ['escalate','frekvens','16operators']){
  let p=decodePO33Backup(fs.readFileSync(path.join(root,'t/official-backup-tests/'+name+'.wav')));
  const s=snapshot(p),built=buildHardwareProject(s,p,s);
  assert.deepEqual(encodePackets(serializeState(built.raw.state)),p.raw.frameBytes.subarray(4096),'Untouched raw state must survive UI export');
  const rate=name==='frekvens'?48000:44100,wav=encodePO33Backup(built,rate),again=decodePO33Backup(wav);
  assert.deepEqual(again.raw.frameBytes,p.raw.frameBytes);
  const timeline=transferTimeline(built.raw.state,rate);assert(timeline.find(e=>e.phase==='pattern').frame<timeline.find(e=>e.phase==='sound').frame);
  assert.equal(new DataView(wav).getUint32(24,true),rate);
  const changed=structuredClone(s);changed.patterns[0].lanes[0][0]=changed.patterns[0].lanes[0][0]===4?5:4;
  const edit=buildHardwareProject(changed,p,s);
  assert.deepEqual(edit.raw.state.sounds,p.raw.state.sounds);
  assert.deepEqual(edit.raw.state.patterns.slice(1),p.raw.state.patterns.slice(1));
  assert.notDeepEqual(edit.raw.state.patterns[0],p.raw.state.patterns[0]);
  console.log('PASS '+name+': UI -> stereo PCM16 '+rate+' -> decoder; identical frame including all unknown fields/ranges, accurate timeline, note edit preserves samples and other patterns.');
  global.gc?.();
 }
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'presets.js'),'utf8'),context);
 const f=context.window.PO33_FACTORY,assets=[],slots=Array(16).fill(null);
 f.slots.forEach(a=>{const w=parseWav(Buffer.from(a.wav,'base64')),data=Float32Array.from(w.channels[0]),id='factory'+a.slot;assets.push({id,rate:w.sampleRate,data});slots[a.slot-1]={asset:id,offset:0,duration:data.length/w.sampleRate};});
 const patterns=Array.from({length:16},(_,i)=>({lanes:i<f.patterns.length?JSON.parse(JSON.stringify(f.patterns[i].lanes)):Array.from({length:16},()=>Array(16).fill(-1))}));
 const s={assets,slots,patterns,extras:Array.from({length:16},(_,i)=>f.patterns[i]?.extras||({effects:[],locks:{}})),tweaks:Array.from({length:16},()=>({pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}})),bpm:f.bpm,swing:f.swing,chain:f.chain,pattern:1};
 const built=buildHardwareProject(s),wav=encodePO33Backup(built),p=decodePO33Backup(wav);
 assert.equal(p.slots.filter(s=>s.audioBuffer?.length).length,8);assert(p.patterns[0].steps.some(s=>s.triggers.length));assert.equal(p.validation.unresolvedAudioRanges,0);
 assert.throws(()=>encodePO33Backup(built,32000),/rate/);
 fs.writeFileSync(path.join(root,'t/official-backup-tests/generated-factory-backup.wav'),Buffer.from(wav));
 const tiny={globals:built.raw.state.globals,patterns:Array.from({length:16},()=>{const p=new Uint8Array(1032);p.fill(255,1024);return p;}),sounds:Array(136).fill(null)};
 tiny.sounds[0]={start:0,end:4096,owner:0,codes:Uint8Array.from({length:4096},(_,i)=>40+Math.floor(20*Math.sin(i*.1)))};
 fs.writeFileSync(path.join(root,'t/official-backup-tests/tiny-transfer-48000.wav'),Buffer.from(encodePO33Backup({raw:{state:tiny}},48000)));
 console.log('PASS fresh web factory -> resampling/mu-law/page allocation/pattern frames -> stereo backup -> valid decoded samples/notes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
