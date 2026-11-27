const assert=require('node:assert/strict');
const {scratchCursor}=require('../voice.js');
const data=require('./fixtures/scratch-hardware-calibration-20261127.json');
const errors=new Map();
for(const p of data.hardwareProbes){
 const slow=[2,4,8,11].includes(p.pattern),kind=slow?11:12,half=slow?.25:.125;
 const ongoing=[4,5].includes(p.pattern),anchor=ongoing?1:0;
 const phase=ongoing?p.seconds-1:[8,9,11,12].includes(p.pattern)?p.seconds%1:p.seconds;
 let pos=scratchCursor(phase,half,anchor,2,!ongoing,kind);
 if([11,12].includes(p.pattern))pos=2-pos;
 const expected=220*Math.exp(Math.log(16)/2*pos),error=Math.abs(1200*Math.log2(expected/p.frequencyHz));
 if(!errors.has(p.pattern))errors.set(p.pattern,[]);errors.get(p.pattern).push(error);
}
for(const [pattern,list] of errors){list.sort((a,b)=>a-b);const median=list[Math.floor(list.length/2)];assert.ok(median<30,`P${pattern}: ${median} cents`);}
assert.equal(errors.size,8);
console.log('PASS Scratch source trajectories against eight recorded hardware chirp sections, median error under 30 cents per section');

// Derived readers never mutate original PCM; trimmed reads stay within their view.
for(const rate of [23437.5,44100,48000]){
 const input=Float32Array.from({length:Math.round(rate*2)},(_,i)=>Math.sin(i*.17)),copy=input.slice();
 const source={sampleRate:rate,numberOfChannels:1,getChannelData:()=>input};
 const context={createBuffer:(channels,length,sampleRate)=>{const a=new Float32Array(length);return {duration:length/sampleRate,getChannelData:()=>a};}};
 const {scratchLoop}=require('../voice.js');const view=scratchLoop(context,source,.2,1,.3,.25,false,11);
 assert.deepEqual(input,copy);assert.ok(view.buffer.getChannelData(0).every(Number.isFinite));
 assert.ok(Math.abs(view.half-.25)<1/rate);
}
console.log('PASS Scratch readers preserve source PCM at 23.4375/44.1/48 kHz');
