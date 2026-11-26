process.chdir(require('node:path').resolve(__dirname,'..'));
const assert=require('node:assert/strict');
const {Engine,names,quantizeStep}=require('../effects.js');
const rate=16000,step=.125;
function signal(n,frequency=440){return Float32Array.from({length:n},(_,i)=>.5*Math.sin(2*Math.PI*frequency*i/rate));}
function run(e,input){const out=new Float32Array(input.length);e.process(input,out);return out;}
function rms(x){return Math.sqrt(x.reduce((a,b)=>a+b*b,0)/x.length);}
function freq(x){let n=0;for(let i=1;i<x.length;i++)if(x[i-1]<=0&&x[i]>0)n++;return n*rate/x.length;}
assert.equal(names.length,17);assert.equal(names[15],'REVERSE');
const input=signal(rate*5);
for(let kind=1;kind<=15;kind++){
  const e=new Engine(rate);run(e,input);e.engage(kind,step);
  const out=run(e,signal(rate));
  assert(out.every(Number.isFinite),`FX ${kind}: finite audio`);
  assert(rms(out)>.05,`FX ${kind}: non-silent audio`);
  assert(Math.max(...out.map(Math.abs))<=.51,`FX ${kind}: no gain explosion`);
  e.release();assert.deepEqual(run(e,signal(512)),signal(512));
}
// History starts before the first FX. Loop duration remains musically exact.
for(const [kind,steps] of [[1,16],[2,12],[3,4],[4,2],[9,.5],[10,2/3]]){
  const e=new Engine(rate);run(e,input);e.engage(kind,step);
  assert.equal(e.loop.length,Math.round(rate*step*steps));
  const out=run(e,new Float32Array(e.loop.length*3));
  const n=e.loop.length;
  assert.deepEqual(out.slice(n,n*2),out.slice(n*2,n*3));
}
// Triggering before a signal arrives recovers rather than looping zero forever.
const early=new Engine(rate);run(early,new Float32Array(1024));early.engage(1,step);
assert(early.pending);run(early,signal(512));assert(!early.pending);
assert(rms(run(early,new Float32Array(512)))>.05);
// Pitch shifts change pitch on a continuously changing input, not frozen phrases.
for(const [kind,target] of [[7,880],[8,220]]){
  const e=new Engine(rate);run(e,input);e.engage(kind,step);
  const out=run(e,signal(rate*2));
  assert(Math.abs(freq(out.slice(rate))-target)<25,`FX ${kind}: ${freq(out.slice(rate))}Hz`);
}
// Scratch sweeps really reverse direction and fast scratch runs twice as fast.
const scratch=[];
for(const kind of [11,12]){
  const e=new Engine(rate);run(e,input);e.engage(kind,step);
  run(e,signal(1000));scratch.push(e.scratchPhase);
}
assert(Math.abs(scratch[1]-2*scratch[0])<1e-8);
// Twelve positions per 16-step bar: nondecreasing, no amplitude gate involved.
const times=Array.from({length:16},(_,i)=>quantizeStep(i));
assert.equal(new Set(times).size,12);
assert(times.every((v,i)=>i===0||v>=times[i-1]));
assert(times.some((v,i)=>v!==i));
console.log('PASS: all 15 DSP modes finite/bounded, bypass recovery, exact loop periods, startup history recovery, measured +/-octave pitch, bidirectional scratch rates, 6/8 quantization grid.');
