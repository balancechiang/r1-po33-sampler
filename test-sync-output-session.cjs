const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const changes=[],messages=[];let primes=0;
const node=()=>({connect(){},disconnect(){}});
const session={set type(v){changes.push(v);this.value=v;},get type(){return this.value;}};
const ctx={state:'suspended',sampleRate:48000,destination:{maxChannelCount:2,channelCount:1},audioWorklet:{async addModule(){}},resume(){return new Promise(r=>setTimeout(()=>{this.state='running';r();},30));},createGain:node,createChannelMerger:node,createChannelSplitter:node,createBuffer:()=>({}),createBufferSource:()=>({...node(),start(){primes++;}})};
const origin=Date.now();Object.defineProperty(ctx,'currentTime',{get:()=>(Date.now()-origin)/1000});
const sandbox={window:{},navigator:{audioSession:session},AudioWorkletNode:class{constructor(){this.port={postMessage:d=>messages.push({...d,wall:Date.now()})};}connect(){}disconnect(){}},setTimeout,clearTimeout};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('po33-sync.js','utf8'),sandbox);
(async()=>{
 const s=new sandbox.window.PO33Sync(ctx,node(),()=>{});await s.setMode(1);const before=Date.now();assert(await s.start(0,132));
 assert.equal(session.type,'playback');assert.equal(ctx.destination.channelCount,2);assert.equal(primes,1);const first=messages.filter(m=>m.type==='start').at(-1);assert(first.wall-before>=140);assert(first.time>=ctx.currentTime+.02);
 s.stop();assert(await s.start(0,132));assert.equal(primes,1);
 await s.setMode(0);await s.setMode(1);assert(await s.start(0,132));assert.equal(primes,2);
 await s.setMode(0);await s.setMode(1);const count=messages.filter(m=>m.type==='start').length,pending=s.start(0,132);s.stop();assert.equal(await pending,false);assert.equal(messages.filter(m=>m.type==='start').length,count);
 assert(changes.every(x=>x==='playback'));console.log('PASS SY1 sets playback before resume, primes explicit stereo before first clock, reprimes after mode change, and cancels without sending stale clocks');
})().catch(e=>{console.error(e);process.exitCode=1;});
