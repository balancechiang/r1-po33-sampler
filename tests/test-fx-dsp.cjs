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
for(const [kind,steps] of [[1,16],[2,12],[3,4],[4,2]]){
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

// Recorded Shutter 8/6 are amplitude gates, not captured-audio loops.
for(const [kind,hz] of [[9,8],[10,6]]){
 const e=new Engine(rate);e.engage(kind,step);assert.equal(e.loop,null);
 const out=run(e,new Float32Array(rate*2).fill(.5));let rises=0,high=0;
 for(let i=rate;i<out.length;i++){if(out[i]>.2)high++;if(out[i-1]<.2 && out[i]>=.2)rises++;}
 assert.equal(rises,hz);assert(Math.abs(high/rate-.5)<.03);
 const silence=run(e,new Float32Array(rate));assert(silence.every(v=>v===0),'gate must not replay history');
}

const {unisonLayers,unisonGains}=require('../effects.js');
// The longer v6 high-harmonic capture supersedes the short v2 peak estimates.
const v6=require('./fixtures/unison-v6-calibration-20261127.json');
for(const kind of [5,6])for(let layer=0;layer<4;layer++){
 const errors=v6.partialMeasurements.filter(row=>row.kind===kind).map(row=>Math.abs(1200*Math.log2(unisonLayers(kind)[layer]/row.partials[layer].ratio))).sort((a,b)=>a-b);
 assert(errors[Math.floor(errors.length/2)]<1.5,JSON.stringify({kind,layer,errors}));
}
assert.equal(unisonLayers(5).length,4);assert(unisonLayers(6).some(r=>r>.99));assert(unisonLayers(6).some(r=>r<.51));
assert(unisonGains(5).every(v=>v>0&&v<=.5));

{const e=new Engine(rate);e.engage(9,.125);run(e,new Float32Array(500).fill(.5));const phase=e.pos/e.stepSamples;e.setStepDuration(.25);assert(Math.abs(e.pos/e.stepSamples-phase)<1e-12);}

{const native=require('./fixtures/other-fx-v7-calibration-20261127.json');
 const hits=native.hardwarePulses['15'];assert.equal(hits.length,12);
 const selected=Array.from({length:16},(_,i)=>i).filter(i=>i%4!==3);
 assert.deepEqual(selected.map(i=>i%4+1),hits.map(h=>h.slice));
 selected.forEach((step,index)=>assert(Math.abs((hits[index].time-hits[0].time)-quantizeStep(step)*.25)<.006));
 assert(native.glideFits.every(row=>Math.abs(row.durationSeconds-.260)<.02));
 console.log('PASS hardware 6/8 slice order and onset grid; measured octave glide duration');}

{const data=require('./fixtures/loops-v8-calibration-20261127.json');
for(const [pattern,start,slice] of [[4,1,5],[8,1.25,6],[13,1,5]]){
 const hits=data.hardwareMarkers[pattern].filter(h=>h.time>=start && h.time<start+2);assert.equal(hits.length,16);
 hits.forEach((hit,i)=>{assert.equal(hit.slice,slice+2*Math.floor(i/4));assert(Math.abs(hit.time-hits[0].time-i*.125)<.007);});
}
console.log('PASS recorded Loop3 recapture order and timing for even/odd entry and empty-step patterns');}

{const {readerSpec,readerPosition}=require('../effects.js'),d=require('./fixtures/loop-sources-v9-calibration-20261127.json');
for(const kind of [1,2,4]){const spec=readerSpec(kind,.25),errors=[];
 for(const p of d.sourceProbes.filter(q=>q.kind===kind&&q.active)){
  const position=p.time<3?readerPosition(p.time,1,spec.period,spec.repeats):readerPosition(3-1e-7,1,spec.period,spec.repeats)+p.time-3;
  errors.push(Math.abs(1200*Math.log2(220*Math.exp(Math.log(8)/2*position)/p.frequencyHz)));
 }errors.sort((a,b)=>a-b);assert(errors[Math.floor(errors.length/2)]<35,JSON.stringify({kind,median:errors[Math.floor(errors.length/2)]}));
}
console.log('PASS measured Loop1/2/4 advancing read windows across four source lengths');}

{
 const {readerSpec,readerPosition}=require('../effects.js'),d=require('./fixtures/unison-memory-v12-calibration-20261127.json'),spec=readerSpec(3,.25);
 assert.deepEqual(spec,{period:.125,repeats:4});
 for(const pattern of [13,14,15,16]){
  const start=pattern===13?1:.5,offset=pattern>=15?1:0;
  const errors=d.heldLoop3Probes.filter(p=>p.pattern===pattern).map(p=>{
   const position=offset+start+readerPosition(p.time-start,1,spec.period,spec.repeats);
   return Math.abs(1200*Math.log2((220*Math.pow(4,position/4))/p.frequencyHz));
  }).sort((a,b)=>a-b);
  assert(errors[Math.floor(errors.length/2)]<15,JSON.stringify({pattern,errors}));
 }
 console.log('PASS recorded v12 held-source Loop3 trajectories for full, zero-offset, nonzero-offset and independent matching PCM');
}

{
 const {unisonLayers}=require('../effects.js'),d=require('./fixtures/unison-layers-v14-observations-20261127.json');
 const base=d.fixedToneWindows[0].peaks[0].frequencyHz;
 for(const row of d.fixedToneWindows.filter(v=>v.pattern===4 || (v.pattern===6 && v.startSeconds<1))){
  const rates=unisonLayers(5,true);assert.equal(row.peaks.length,4);
  rates.forEach((rate,i)=>assert(Math.abs(base*rate-row.peaks[i].frequencyHz)<.12,JSON.stringify({rate,peak:row.peaks[i]})));
 }
 assert.deepEqual(unisonLayers(5,false),[.98388644,.99413750,1.00627777,1.01660276]);
 console.log('PASS v14 active Unison frequencies in two recorded windows; fresh-note tuning remains separate');
}

{
 const {unisonGains}=require('../effects.js'),base=unisonGains(5,false),active=unisonGains(5,true);
 for(let i=0;i<4;i++)assert(Math.abs(20*Math.log10(active[i]/base[i])-1.15)<1e-9);
 assert.deepEqual(unisonGains(6,true),unisonGains(6,false));
 console.log('PASS active-FX5 gain correction is isolated from fresh-note and FX6 profiles');
}
