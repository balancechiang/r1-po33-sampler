const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const base=resolve(__dirname,'..'),fixtures=resolve(base,'t/official-backup-tests');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

(async()=>{
  const api=await import('../src/codec/po33Codec.ts');
  const {crcUpdate}=await import('./vendor/so-sample/crc.ts');
  const {decodeFrame,encodePackets}=await import('./vendor/so-sample/packets.ts');
  const {parseFrame,serializeState}=await import('./vendor/so-sample/state.ts');
  const {parseWav,wavFromPcm16}=await import('./vendor/so-sample/wav.ts');
  const {recoverFrame}=await import('./vendor/so-sample/modem/decode.ts');
  const {decodeMulaw,encodeMulawSample}=await import('./vendor/so-sample/mulaw.ts');
  const {emptyPattern,writeCell,writeEffects}=await import('./vendor/so-sample/pattern.ts');
  let crc=0x1d0f;for(const x of Buffer.from('123456789'))crc=crcUpdate(crc,x);assert.equal(crc,0xe5cc);
  // Independent integer formula from libpo po33_sample_decode; exhaust all codes.
  for(let code=0;code<256;code++){
    const negative=code&128,magnitude=negative?(~code)&127:code;
    const value=(((magnitude&15)*8+132)*2**(magnitude>>4)-132)*(negative?-1:1);
    assert.equal(decodeMulaw(code),value===0?0:value/32768);
    assert.equal(decodeMulaw(encodeMulawSample(decodeMulaw(code))),decodeMulaw(code));
  }
  // Independent test-only carrier generator follows libpo's documented modulation.
  function render(wire,rate){
    const phase=[0,0],next=[0,0],nibble=s=>s<wire.length*2?(wire[s>>1]>>((s&1)*4))&15:0;
    next[0]=nibble(0)>>2;next[1]=nibble(0)&3;let symbol=0;
    const active=Math.ceil((wire.length*2+129)*rate/7812.5),lead=rate/4,total=active+2*lead;
    const left=new Float32Array(total),right=new Float32Array(total);
    const wave=(p,s,c)=>[s,c,-s,-c][p&3];
    for(let j=0;j<active;j++){
      const position=j*7812.5/rate,s=Math.floor(position),fraction=position-s;
      while(symbol<s){phase[0]=next[0];phase[1]=next[1];const v=nibble(++symbol);next[0]=(phase[0]+(v>>2))&3;next[1]=(phase[1]+(v&3))&3;}
      const sine=Math.sin(2*Math.PI*fraction),cosine=Math.cos(2*Math.PI*fraction),mix=fraction<.6?0:fraction>.9?1:(fraction-.6)/.3;
      left[lead+j]=.6*((1-mix)*wave(phase[0],sine,cosine)+mix*wave(next[0],sine,cosine));
      right[lead+j]=.6*((1-mix)*wave(phase[1],sine,cosine)+mix*wave(next[1],sine,cosine));
    }
    return {left,right,sampleRate:rate};
  }
  const globals=[new Uint8Array(255),new Uint8Array(255)];globals[1][0]=0;globals[1][1]=1;globals[1][128]=2;globals[1][129]=137;globals[1][130]=9;
  const patterns=Array.from({length:16},emptyPattern);
  writeCell(patterns[0],1,1,{key:4,timing:2,pitch:13,volume:36,filter:63,resonance:1,bit5:1});
  writeCell(patterns[0],3,2,{key:null,pitch:0,volume:41,filter:0,resonance:0});
  writeCell(patterns[0],2,9,{key:2,timing:5,pitch:13,volume:36,filter:63,resonance:1});
  writeEffects(patterns[0],[7,...Array(15).fill(null)]);
  const sounds=Array(136).fill(null);sounds[0]={start:128,end:1024,owner:0,codes:Uint8Array.from({length:4096},(_,i)=>i&255)};
  sounds[8]={start:0,end:256,owner:0,codes:new Uint8Array(0)};sounds[9]={start:256,end:512,owner:0,codes:new Uint8Array(0)};
  const body=encodePackets(serializeState({globals,patterns,sounds})),wire=new Uint8Array(4096+body.length);
  for(let i=0;i<4092;i++)wire[i]=i&255;wire.set([0x4d,0xb8,0x16,0x5d],4092);wire.set(body,4096);
  for(const rate of [44100,48000]){
    const pcm=render(wire,rate),project=api.decodePO33Backup(pcm);
    assert.equal(project.validation.checksumErrors,0);assert.equal(project.slots.length,16);assert.equal(project.patterns.length,16);
    assert.equal(project.meta.bpm,137);assert.deepEqual(project.patternChain,[1,2]);assert.equal(project.meta.swing,50);
    assert.equal(project.slots[0].audioBuffer.length,896);assert.equal(project.slots[8].audioBuffer.length,512);
    assert.equal(project.slots[8].slices[1].sourcePoolId,0);assert.equal(project.slots[8].slices[1].startSample,256);
    assert.equal(project.patterns[0].steps[0].triggers[0].sliceOrNote,3);assert.equal(project.patterns[0].steps[0].triggers[0].lengthSteps,2);
    assert.equal(project.patterns[0].steps[0].triggers[0].paramLocks.bit5,1);assert.equal(project.patterns[0].steps[0].fx,7);
    assert.equal(project.patterns[0].steps[1].triggers[0].retriggers,6);
    assert.equal(project.patterns[0].steps[2].parameterOnly[0].paramLocks.volumeCode,41);
    const demodulated=api.demodulateToBitstream(pcm.left,pcm.right,rate);assert.deepEqual(demodulated.rawBytes,wire);
    const swapped=api.decodePO33Backup({left:pcm.right,right:pcm.left,sampleRate:rate});assert.equal(swapped.validation.channelOrder,'swapped');
    if(rate===44100){
      const interleaved=new Int16Array(pcm.left.length*2);for(let i=0;i<pcm.left.length;i++){interleaved[2*i]=Math.round(pcm.left[i]*32768);interleaved[2*i+1]=Math.round(pcm.right[i]*32768);}
      const bytes=wavFromPcm16(interleaved,2,rate),parsed=api.parseWavStereo(bytes.buffer);
      assert.equal(parsed.numChannels,2);assert.equal(parsed.sampleRate,rate);assert.equal(api.decodePO33Backup(bytes.buffer).meta.bpm,137);
      const mono=bytes.slice();new DataView(mono.buffer).setUint16(22,1,true);assert.throws(()=>api.decodePO33Backup(mono),/two-channel/);
      assert.throws(()=>api.decodePO33Backup(bytes.subarray(0,-1)),/Truncated/);
    }
  }
  const badBody=wire.slice();badBody[4110]^=1;assert.throws(()=>decodeFrame(badBody,4096),/checksum/);
  const badPcm=render(badBody,44100);assert.throws(()=>api.demodulateToBitstream(badPcm.left,badPcm.right,44100),/checksum-valid/);
  const shortened=wire.slice(0,-5);assert.throws(()=>decodeFrame(shortened,4096),/final|Truncated/);
  assert.throws(()=>api.decodePO33Backup({left:new Float32Array([NaN]),right:new Float32Array(1),sampleRate:48000}),/Non-finite/);
  const expected={
    escalate:{packets:4453,pools:16,poolCodes:987136,bpm:120,bits:24,unresolved:10,triggers:274,hash:'1580c178c32b2f0d57bccd6f0a912ad0bf02dc7a653fcc5b6ffd3e82e1fe3f50',wavHash:'6847d14da8a7c7438e84d0f16278988e1db7666c4d8f9942c1ad562efab166e5'},
    frekvens:{packets:3393,pools:39,poolCodes:749568,bpm:128,bits:16,unresolved:0,triggers:300,hash:'6fc4fe6a3786a66c58f448de453c16c389b1c3f4ab423b25f4a4f3c0f20a49a2',wavHash:'f6c62965940f68b9b22882c954be64e0dfc7e705904fe8d65b92a6de52dafa1f'},
    '16operators':{packets:4164,pools:16,poolCodes:917504,bpm:120,bits:16,unresolved:0,triggers:0,hash:'2a0179e0904b5fa030b37ebc1db953f29df9362df1a71266e13bf1f15130b041',wavHash:'c167b73d0d2afd1f7cf4261e2e4424bbd623d930394b4ae2851360d61e664110'}
  };
  const report=[];
  for(const [name,golden] of Object.entries(expected)){
    const source=readFileSync(resolve(fixtures,name+'.wav'));assert.equal(sha(source),golden.wavHash);
    const started=performance.now(),project=api.decodePO33Backup(source);
    assert.equal(project.slots.length,16);assert.equal(project.patterns.length,16);
    assert(project.patterns.every(p=>p.raw.length===1032&&p.steps.length===16));
    assert.equal(project.validation.packetCount,golden.packets);assert.equal(project.validation.checksumErrors,0);
    assert.equal(project.validation.unresolvedAudioRanges,golden.unresolved);assert.equal(project.validation.inputBitsPerSample,golden.bits);
    assert.equal(project.pools.length,golden.pools);assert.equal(project.pools.reduce((n,p)=>n+p.codes.length,0),golden.poolCodes);
    assert.equal(project.meta.bpm,golden.bpm);assert.equal(sha(project.raw.frameBytes),golden.hash);
    const triggers=project.patterns.reduce((n,p)=>n+p.steps.reduce((n,s)=>n+s.triggers.length,0),0);assert.equal(triggers,golden.triggers);
    for(const pool of project.pools){assert(pool.codes.length%4096===0);assert(pool.audioBuffer.every(Number.isFinite));}
    assert.deepEqual(encodePackets(decodeFrame(project.raw.frameBytes,4096).packets),project.raw.frameBytes.subarray(4096));
    assert.deepEqual(parseFrame(decodeFrame(project.raw.frameBytes,4096)).patterns,project.raw.state.patterns);
    if(name!=='escalate'){
      // Independent sign-crossing modem versus the pilot PLL modem.
      const independent=recoverFrame(parseWav(source));assert.deepEqual(independent.frame.encodedBody,project.raw.frameBytes.subarray(4096));
    }else{
      const flagged=project.slots.flatMap(s=>s.slices).filter(s=>s.rangeStatus==='out-of-pool');assert.equal(flagged.length,10);
      assert(flagged.every(s=>s.recordId>=126&&s.sourceEndSample>project.pools.find(p=>p.id===s.sourcePoolId).codes.length));
    }
    writeFileSync(resolve(fixtures,name+'.frame.bin'),project.raw.frameBytes);
    assert.equal(sha(source),golden.wavHash,'Input WAV must remain unchanged');
    const row={name,packets:golden.packets,checksumErrors:0,slots:16,patterns:16,nonemptySlots:project.slots.filter(s=>s.audioBuffer?.length).length,pools:golden.pools,poolCodes:golden.poolCodes,triggers,unresolvedAudioRanges:golden.unresolved,frameSHA256:golden.hash,elapsedSeconds:(performance.now()-started)/1000};
    const audioHashes=project.slots.map(s=>({id:s.id,frames:s.audioBuffer?.length??0,pcmSHA256:s.audioBuffer?sha(new Uint8Array(s.audioBuffer.buffer,s.audioBuffer.byteOffset,s.audioBuffer.byteLength)):null}));
    report.push({...row,audioHashes,patternHashes:project.patterns.map(p=>sha(p.raw))});console.log(JSON.stringify(row));global.gc?.();
  }
  mkdirSync(fixtures,{recursive:true});writeFileSync(resolve(fixtures,'decoder-results.json'),JSON.stringify(report,null,2));
  console.log('PASS: strict TS API, three official full backups and every packet CRC, raw state and pool preservation; independent modem agreement; codec all-256-code check; 44.1/48 kHz synthetic waveform/PCM APIs, swapped channels, note/timing/FX/parameter-only cells, malformed/checksum/truncation rejection. Escalate out-of-pool coordinates reported, not invented.');
})().catch(error=>{console.error(error);process.exitCode=1;});
