const assert=require('node:assert/strict');
const {transientSlices,allocate,choke}=require('./po33-sampling.js');
for(const rate of [23437.5,44100,48000]){
 const onsets=[.1,.37,.9,1.3],data=new Float32Array(Math.ceil(1.65*rate));
 for(const [n,time] of onsets.entries())for(let j=0;j<rate*.09;j++){const i=Math.round(time*rate)+j;if(i<data.length)data[i]+=(n===2?.18:.7)*Math.sin(2*Math.PI*700*j/rate)*Math.exp(-j/(rate*.018));}
 const regions=transientSlices(data,rate).filter(Boolean);
 assert.equal(regions.length,5,JSON.stringify(regions));
 assert.equal(regions[0].start,0);regions.slice(1).forEach((r,n)=>{assert.ok(Math.abs(r.start/rate-onsets[n])<.006,JSON.stringify(regions));assert.equal(r.end,n===3?data.length:regions[n+2].start);});
 assert.equal(transientSlices(new Float32Array(1000),rate).filter(Boolean).length,0);
 const tone=Float32Array.from({length:Math.round(rate)},(_,i)=>.4*Math.sin(i*2*Math.PI*220/rate));assert.equal(transientSlices(tone,rate).filter(Boolean).length,1);
 const hits=new Float32Array(Math.round(rate*2));for(let n=0;n<20;n++)for(let j=0;j<rate*.02;j++)hits[Math.round((.03+n*.09)*rate)+j]=.8*Math.exp(-j/(rate*.004));assert.equal(transientSlices(hits,rate).filter(Boolean).length,16);
}
// Global Top-N keeps strong events near the end; 0 is a reserved first slice.
for(const rate of [23437.5,44100,48000]){
 const signal=new Float32Array(Math.ceil(rate*2.5)),originalOnsets=[];
 for(let n=0;n<25;n++){const t=.08+n*.09;originalOnsets.push(t);for(let j=0;j<rate*.025;j++){const i=Math.round(t*rate)+j;if(i<signal.length)signal[i]+=(n>=20?.8:.2)*Math.sin(j*2*Math.PI*900/rate)*Math.exp(-j/(rate*.006));}}
 const original=signal.slice(),slices=transientSlices(signal,rate),used=slices.filter(Boolean);assert.equal(used.length,16);assert.equal(used[0].start,0);assert.deepEqual(signal,original);
 for(let n=20;n<25;n++)assert(used.some(r=>Math.abs(r.start/rate-originalOnsets[n])<.006),'strong late transient lost');
 for(let n=1;n<used.length;n++){assert(used[n].start-used[n-1].start>=Math.round(rate*.055));const i=used[n].start;assert(Math.abs(signal[i])<=Math.min(Math.abs(signal[i-1]),Math.abs(signal[i+1]))+1e-5);}
 assert.deepEqual(slices,transientSlices(signal,rate));
 const roll=new Float32Array(Math.ceil(rate*.6));for(const [t,g] of [[.1,.8],[.14,.2],[.3,.8]])for(let j=0;j<rate*.02;j++)roll[Math.round(t*rate)+j]=g*Math.sin(j*2*Math.PI*900/rate)*Math.exp(-j/(rate*.004));
 const hits=transientSlices(roll,rate).filter(Boolean);assert.equal(hits.length,3);assert(hits.every(r=>Math.abs(r.start/rate-.14)>.02));
}
console.log('PASS global strongest-15 selection plus anchor, late accents, 55ms masking, backward zero-crossing minima, unused slots, deterministic non-destructive slicing');

let voices=[],cuts=[];const cut=(v,t)=>cuts.push([v.slot,t]);
for(let slot=1;slot<=5;slot++)allocate(voices,{slot,start:slot*.1,end:5},cut,4);
assert.equal(voices[0].end,.5);assert.equal(voices.filter(v=>v.end>.5).length,4);
allocate(voices,{slot:5,start:.6,end:6},cut,4);assert.equal(voices[4].end,.6);
choke(voices,5,.7,cut);assert.equal(voices.at(-1).end,.7);
voices=[{slot:9,start:1,end:3}];const live={slot:9,start:.2,end:4};allocate(voices,live,()=>{},4);assert.equal(live.end,1);assert.equal(voices[0].end,3);
voices=[1,2,3,4].map(slot=>({slot,start:1,end:3}));const hit={slot:8,start:.2,end:4};allocate(voices,hit,()=>{},4);assert.equal(hit.end,1);
// Out-of-order lookahead and live scheduling: every event interval stays <=4 voices and one per slot.
voices=[];let seed=33;for(let i=0;i<400;i++){seed=(seed*1664525+1013904223)>>>0;const start=(seed%500)/100;allocate(voices,{slot:1+(seed%16),start,end:start+.2+(seed%120)/100},()=>{},4);}
for(const time of voices.flatMap(v=>[v.start+.000001,v.end-.000001])){const active=voices.filter(v=>v.start<=time&&v.end>time);assert.ok(active.length<=4);assert.equal(new Set(active.map(v=>v.slot)).size,active.length);}
console.log('PASS transient onsets at 3 rates, quiet/sustained/16-hit boundaries; choke, oldest stealing, future lookahead, 400-event concurrency invariants.');
