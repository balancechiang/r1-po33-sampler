const fs=require('fs'),vm=require('vm'),assert=require('assert');
let Processor;const env={AudioWorkletProcessor:class{constructor(){this.port={postMessage:x=>this.messages.push(x)};this.messages=[];}},registerProcessor:(n,p)=>Processor=p,sampleRate:48000,currentFrame:0};vm.createContext(env);vm.runInContext(fs.readFileSync('po33-sync-worklet.js','utf8'),env);
function send(p,d){p.port.onmessage({data:d});}
const p=new Processor();send(p,{type:'config',mode:1,bpm:137,gain:.7});send(p,{type:'start',time:0});let edges=[],prev=0;
for(let block=0;block<48000*60/128;block++){env.currentFrame=block*128;const out=[new Float32Array(128),new Float32Array(128)];p.process([], [out]);for(let i=0;i<128;i++){if(out[0][i]&&!prev)edges.push(env.currentFrame+i);prev=out[0][i];assert.equal(out[1][i],0);}}
edges.forEach((x,i)=>assert(Math.abs(x-i*48000*30/137)<1.01));assert(edges.length>270);console.log('PASS master 137 BPM / 60 seconds: fractional pulse phase within one sample, right channel silent');
for(let mode=2;mode<=5;mode++){let q=new Processor();send(q,{type:'config',mode,bpm:120,gain:.7});send(q,{type:'start',time:0});let peaks=0;
for(let b=0;b<48000/128;b++){env.currentFrame=b*128;const l=Float32Array.from({length:128},(_,i)=>(env.currentFrame+i)%12000<144?.7:0),r=new Float32Array(128).fill(.2),o=[new Float32Array(128),new Float32Array(128)];q.process([[l,r]],[o]);peaks+=o[0].some(x=>x>0)?1:0;assert(o[1].every(x=>Math.abs(x-(mode>=4?.2:0))<1e-6));}
assert.equal(q.messages.filter(x=>x.type==='pulse').length,4);assert.equal(peaks>0,mode===3||mode===5);send(q,{type:'stop'});let o=[new Float32Array(128),new Float32Array(128)];q.process([], [o]);assert(o.every(c=>c.every(x=>x===0)));}
console.log('PASS SY2–SY5 clock detection, clock-only suppression, right audio pass-through, clock forwarding and stop silence');

const timeout=new Processor();send(timeout,{type:'config',mode:2,bpm:120,gain:.7});send(timeout,{type:'start',time:0});for(let b=0;b<600;b++){env.currentFrame=b*128;let input=new Float32Array(128);if(b===0)input.fill(.7,0,100);timeout.process([[input,new Float32Array(128)]],[[new Float32Array(128),new Float32Array(128)]]);}assert.equal(timeout.messages.filter(e=>e.type==='timeout').length,1);console.log('PASS missing-clock watchdog reports once without fabricating new pulses');
