process.chdir(require('node:path').resolve(__dirname,'..'));
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const wav=require('./helpers/backup-wav.js');
const left=Float32Array.from({length:65536},(_,i)=>(i-32768)/32768);
const right=Float32Array.from(left,x=>x===0?0:(-x===1?32767/32768:-x));
const encoded=wav.encode([{left,right}]),decoded=wav.parse(encoded),v=new DataView(encoded);
assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint16(34,true),16);assert.equal(encoded.byteLength,44+65536*4);
assert.deepEqual(decoded.left,left);assert.deepEqual(decoded.right,right);
assert.deepEqual(new Uint8Array(wav.encode([decoded])),new Uint8Array(encoded));
for(const [offset,value,wide] of [[22,1,false],[24,48000,true],[34,24,false],[32,2,false]]){
  const invalid=encoded.slice(0);new DataView(invalid)[wide?'setUint32':'setUint16'](offset,value,true);assert.throws(()=>wav.parse(invalid));
}
assert.throws(()=>wav.parse(encoded.slice(0,-1)));assert.throws(()=>wav.encode([{left:new Float32Array([NaN]),right:new Float32Array(1)}]));
let Processor;
const sandbox={AudioWorkletProcessor:class{constructor(){this.messages=[];this.port={postMessage:m=>this.messages.push(m)};}},Float32Array,sampleRate:44100,currentFrame:0,registerProcessor:(name,C)=>Processor=C};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('backup-worklet.js','utf8'),sandbox);
const recorder=new Processor();recorder.port.onmessage({data:{command:'record'}});
for(let block=0;block<35;block++){
  sandbox.currentFrame=block*128;const l=left.slice(block*128,(block+1)*128),r=right.slice(block*128,(block+1)*128);
  const out=[new Float32Array(128),new Float32Array(128)];recorder.process([[l,r]],[out]);assert(out.every(c=>c.every(x=>x===0)));
}
recorder.port.onmessage({data:{command:'stop'}});
const chunks=recorder.messages.filter(m=>m.type==='chunk');assert.equal(chunks.length,2);
assert.deepEqual(chunks[0].left,left.slice(0,4096));assert.deepEqual(chunks[1].right,right.slice(4096,4480));
assert.equal(recorder.messages.at(-1).frames,4480);
const mono=new Processor();mono.port.onmessage({data:{command:'record'}});mono.process([[new Float32Array(128)]],[[new Float32Array(128),new Float32Array(128)]]);assert.equal(mono.messages.at(-1).type,'error');
const gap=new Processor();gap.port.onmessage({data:{command:'record'}});sandbox.currentFrame=0;gap.process([[left.slice(0,128),right.slice(0,128)]],[[new Float32Array(128),new Float32Array(128)]]);sandbox.currentFrame=256;gap.process([[left.slice(0,128),right.slice(0,128)]],[[new Float32Array(128),new Float32Array(128)]]);assert.equal(gap.messages.at(-1).type,'error');
const player=new Processor();player.port.onmessage({data:{command:'play',left:left.slice(0,129),right:right.slice(0,129)}});
let output=[new Float32Array(128),new Float32Array(128)];player.process([],[output]);assert.deepEqual(output[0],left.slice(0,128));assert.deepEqual(output[1],right.slice(0,128));
output=[new Float32Array(128),new Float32Array(128)];player.process([],[output]);assert.equal(output[0][0],left[128]);assert(output[0].slice(1).every(x=>x===0));assert(player.messages.some(m=>m.type==='ended'));
console.log('PASS: exhaustive PCM16 stereo byte roundtrip, strict headers/format rejection; independent channels, silent monitor, ordered chunk/final flush, mono and frame-gap rejection, exact stereo worklet playback.');
const armed=new Processor();armed.port.onmessage({data:{command:'record',waitForSignal:true}});
const zero=new Float32Array(128),tone=new Float32Array(128).fill(.25);
for(const frame of [0,256]){sandbox.currentFrame=frame;armed.process([[zero,zero]],[[new Float32Array(128),new Float32Array(128)]]);}
assert(!armed.messages.some(m=>m.type==='error'));
sandbox.currentFrame=512;armed.process([[tone,tone]],[[new Float32Array(128),new Float32Array(128)]]);
sandbox.currentFrame=768;armed.process([[tone,tone]],[[new Float32Array(128),new Float32Array(128)]]);
assert(armed.messages.some(m=>m.type==='error'));
console.log('PASS receive arming ignores silent startup gaps but rejects gaps after signal starts.');
