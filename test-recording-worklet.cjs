const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const rate of [44100,48000]){
 let Processor;
 const context={sampleRate:rate,Float32Array,Math,AudioWorkletProcessor:class{constructor(){this.messages=[];this.port={postMessage:m=>this.messages.push(m)};}},registerProcessor:(name,p)=>{Processor=p;}};
 vm.runInNewContext(fs.readFileSync('recording-worklet.js','utf8'),context);
 const p=new Processor(),out=[[new Float32Array(128).fill(1)]];
 const feed=d=>p.process([[d]],out),send=m=>p.port.onmessage({data:m});
 feed(new Float32Array(128).fill(.2));assert.equal(p.frames,0); // monitoring consumes no pool
 send({type:'start',id:1,maxFrames:300});
 const wave=Float32Array.from({length:128},(_,i)=>i%2?.07:-.02);
 feed(wave);feed(new Float32Array(128));feed(wave);feed(wave);
 assert.equal(p.frames,300);assert.equal(p.active,false);assert.ok(out[0][0].every(x=>x===0));
 const chunks=p.messages.filter(m=>m.type==='chunk'),recorded=chunks.flatMap(m=>Array.from(new Float32Array(m.data)));
 assert.equal(recorded.length,300);assert.deepEqual(recorded,[...wave,...new Float32Array(128),...wave.slice(0,44)]);
 assert.equal(p.messages.find(m=>m.type==='finished').reason,'memory-full');
 send({type:'start',id:2,maxFrames:rate});feed(wave);send({type:'stop',id:1});assert.equal(p.active,true);send({type:'stop',id:2});
 assert.equal(p.messages.filter(m=>m.type==='finished').at(-1).frames,128);
 assert.equal(p.messages.filter(m=>m.type==='finished').at(-1).reason,'released');
 send({type:'start',id:3,maxFrames:rate});for(let i=0;i<10;i++)feed(new Float32Array(128).fill(.99));send({type:'stop',id:3});
 assert.ok(p.messages.some(m=>m.type==='meter'&&m.clipped&&m.rms>.9));
 assert.ok(p.messages.filter(m=>m.type==='chunk'&&m.id===3).every(m=>new Float32Array(m.data).every(v=>Math.abs(v-.99)<1e-6)));
}
console.log('PASS worklet raw quiet PCM, retained silence, exact non-block-aligned capacity cutoff, stop drain, stale-stop isolation, silent monitoring output and RMS/near-clipping at 44.1/48 kHz.');
