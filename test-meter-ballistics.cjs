const assert=require('node:assert/strict');
const {Meter,segments}=require('./lcd-indicator.js');
const m=new Meter();let p=m.update(0,0,0);assert.equal(p.value,0);assert.equal(p.peak,0);
for(let t=20;t<=100;t+=20)p=m.update(.15,.8,t);
assert(p.peak>p.value);const peak=p.peak;
p=m.update(0,0,200);assert.equal(p.peak,peak);assert(p.value<30);
assert(p.trail.some((v,i)=>v>.1 && !segments(p)[i]));
p=m.update(0,0,400);assert(p.peak<peak);
for(let t=420;t<2200;t+=20)p=m.update(0,0,t);
assert.equal(p.value,0);assert.equal(p.peak,0);assert(p.trail.every(v=>v<.001));
for(let t=2200;t<2500;t+=20){p=m.update(.2,.7,t);const cells=segments(p);assert.equal(cells.length,38);assert(cells.every((v,i)=>v===cells[37-i]));}
m.reset();p=m.update(0,0,2600);assert.equal(p.peak,0);assert(p.trail.every(v=>v===0));
console.log('PASS symmetric RMS fill, held peak, delayed fall, fading LCD trail, silence and mode reset');
