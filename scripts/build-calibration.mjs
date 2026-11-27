// Original, deterministic calibration material; no external recordings.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {emptyProject,compileProject} from '../decoder/vendor/so-sample/project.ts';
import {emptyPattern,writeCell,writeEffects,DEFAULT_PARAMETERS,readEffects,readCell} from '../decoder/vendor/so-sample/pattern.ts';
import {encodeMulaw,SAMPLE_RATE} from '../decoder/vendor/so-sample/mulaw.ts';
import {EMPTY_GLOBALS} from '../src/codec/po33Template.ts';
import {encodePO33Backup} from '../src/codec/po33Encode.ts';
import {decodePO33Backup} from '../src/codec/po33Codec.ts';
const out=path.resolve(process.argv[2]||'t/calibration');fs.mkdirSync(out,{recursive:true});
const model=emptyProject(120);model.swing=0;model.chain=Array.from({length:16},(_,i)=>i+1);const library=new Map();let seed=20261127;
function noise(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1;}
function sound(id,seconds,fn){const a=new Float64Array(Math.round(seconds*SAMPLE_RATE));for(let i=0;i<a.length;i++){const t=i/SAMPLE_RATE,edge=Math.min(1,t/.003,(a.length-i)/SAMPLE_RATE/.005);a[i]=fn(t)*edge;}const codes=encodeMulaw(a);library.set(id,codes);return {sampleId:id,start:0,end:codes.length};}
model.melodic[0]=sound('sine220',4,t=>.24*Math.sin(2*Math.PI*220*t));
model.melodic[1]=sound('harmonics110',4,t=>{let v=0;for(let k=1;k<=32;k++)v+=Math.sin(2*Math.PI*110*k*t)/k;return v*.13;});
model.melodic[2]=sound('chirp',2,t=>.22*Math.sin(2*Math.PI*(180*t+180*t*t)));
model.melodic[3]=sound('sine330',4,t=>.18*Math.sin(2*Math.PI*330*t));
const slices=[];
for(let k=0;k<16;k++){const type=k%4;const clip=sound('drum'+k,.32,t=>type===0?.5*Math.sin(2*Math.PI*(48*t+90*.015*(1-Math.exp(-t/.015))))*Math.exp(-t/.085):type===1?(noise()*.28+Math.sin(2*Math.PI*180*t)*.16)*Math.exp(-t/.055):type===2?noise()*.17*Math.exp(-t/.025):.25*Math.sin(2*Math.PI*(700+k*43)*t)*Math.exp(-t/.08));slices.push(clip);}
model.drums[0]={slices};
const sections=[];function hit(p,step,slot,key=5,extra={}){writeCell(model.patterns[p-1],step,slot,{...DEFAULT_PARAMETERS,key,...extra});}
function section(p,name,detail){const bar=240/model.tempo;sections.push({pattern:p,startSeconds:(p-1)*bar,endSeconds:p*bar,name,detail});}
for(let i=0;i<16;i++)hit(1,i+1,1,i+1,{timing:1});section(1,'Melodic key map','Keys 1..16, one per sixteenth; 220 Hz source.');
const pitches=[1,4,7,10,13,16,19,22,25];for(let i=0;i<pitches.length;i++)hit(2,i+1,1,5,{pitch:pitches[i],timing:1});section(2,'Pitch lock map','Native pitch codes 1,4,7,10,13,16,19,22,25 on steps 1..9. Remaining steps silent.');
const volumes=[1,9,18,27,36,45,54,63];volumes.forEach((v,i)=>hit(3,i*2+1,1,5,{volume:v,timing:1}));section(3,'Volume lock map','Native volume codes 1,9,18,27,36,45,54,63 on odd steps.');
const filters=[1,8,16,24,63,39,47,62];filters.forEach((v,i)=>hit(4,i*2+1,2,5,{filter:v,timing:2}));section(4,'Filter map','Harmonic source; filter codes 1,8,16,24,63,39,47,62.');
[1,9,18,27,36,45,54,63].forEach((v,i)=>hit(5,i*2+1,2,5,{filter:16,resonance:v,timing:2}));section(5,'Resonance map','Filter code 16; resonance codes 1..63 at eight levels.');
hit(6,1,1,5,{timing:1});hit(6,5,1,5,{timing:2});hit(6,9,1,5,{timing:4});section(6,'Melodic gate','Step 1 length 1, step 5 length 2, step 9 length 4.');
for(let i=0;i<16;i++)hit(7,i+1,9,i+1,{timing:i>=12?[2,3,4,6][i-12]:1});section(7,'Drum slices / choke / retrigger','Slices 1..16; last four steps retrigger 2,3,4,6.');
for(let slot=1;slot<=4;slot++)hit(8,1,slot,5,{timing:15});hit(8,5,9,1);hit(8,9,1,12,{timing:8});section(8,'Four voice allocation','Four sustained sounds on step 1, fifth slot on step 5, same-slot replacement step 9.');
const pairs=[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,15],[14]];
pairs.forEach((pair,i)=>{const p=i+9;for(let st=1;st<=16;st++){hit(p,st,9,(st-1)%4+1);if(st%4===1)hit(p,st,2,[5,8,12,15][Math.floor((st-1)/4)],{timing:4});}
 const fx=Array(16).fill(null);if(pair[0]===14)fx[15]=14;else{for(let j=4;j<8;j++)fx[j]=pair[0];for(let j=8;j<12;j++)fx[j]=pair[1];}writeEffects(model.patterns[p-1],fx);section(p,'FX '+pair.join(' / '),pair[0]===14?'FX14 only at step16; placed last because retrigger can loop this pattern.':'Steps1-4 dry;5-8 FX'+pair[0]+';9-12 FX'+pair[1]+';13-16 dry.');});
const isolated=process.argv.includes('--fx-isolated');
if(isolated){
 const rich=model.melodic[1],chirp=model.melodic[2];model.melodic=Array(8).fill(null);model.melodic[0]=rich;model.melodic[1]=chirp;model.drums=Array(8).fill(null);model.patterns=Array.from({length:16},emptyPattern);sections.length=0;
 for(const id of [...library.keys()])if(!['harmonics110','chirp'].includes(id))library.delete(id);
 const order=[null,1,2,3,4,5,6,7,8,9,10,11,12,13,15,14];
 order.forEach((effect,i)=>{const p=i+1,steady=[5,6,7,8,9,10].includes(effect),slot=effect===15?2:1;
  const steps=steady?[1]:[1,5,9,13];steps.forEach(st=>hit(p,st,slot,5,{timing:steady?15:4}));
  const fx=Array(16).fill(null);if(effect===14)fx[15]=14;else if(effect)for(let st=4;st<12;st++)fx[st]=effect;writeEffects(model.patterns[i],fx);
  section(p,effect?'Isolated FX '+effect:'Dry reference',effect===14?'Final step only; last pattern.':steady?'One sustained source; FX steps5-12, no competing voices.':'One source only; FX steps5-12; dry steps1-4/13-16.');
 });
}
const filterTest=process.argv.includes('--filter-isolated');
const filterCells=[];
if(filterTest){
 if(isolated)throw Error('Choose either FX or filter profile');
 model.tempo=60;model.melodic=Array(8).fill(null);model.drums=Array(8).fill(null);model.patterns=Array.from({length:16},emptyPattern);sections.length=0;library.clear();
 const frequencies=[5,10,15,20,30,40,60,80,110,150,220,330,440,660,880,1320,1760,2640,3520,5280,7040,9000,10500];
 const phases=frequencies.map((_,i)=>((i*0.6180339887498949)%1)*2*Math.PI),n=Math.round(2*SAMPLE_RATE),pcm=new Float64Array(n);let peak=0;
 for(let i=0;i<n;i++){const t=i/SAMPLE_RATE;let v=0;for(let k=0;k<frequencies.length;k++)v+=Math.sin(2*Math.PI*frequencies[k]*t+phases[k]);pcm[i]=v;peak=Math.max(peak,Math.abs(v));}
 for(let i=0;i<n;i++)pcm[i]=pcm[i]/peak*.16*Math.min(1,i/(SAMPLE_RATE*.003),(n-i)/(SAMPLE_RATE*.003));
 const codes=encodeMulaw(pcm);library.set('filter-multisine',codes);model.melodic[0]={sampleId:'filter-multisine',start:0,end:codes.length};
 function block(p,filter,resonance=Array(8).fill(1)){
  filter.forEach((code,i)=>{const step=i*2+1;hit(p,step,1,5,{filter:code,resonance:resonance[i],timing:2});filterCells.push({pattern:p,step,filter:code,resonance:resonance[i]});});
 }
 block(1,Array(8).fill(63));section(1,'Dry reference','Filter 63, resonance 1; repeated 0.5-second source windows.');
 const low=Array.from({length:31},(_,i)=>i+1).concat(63),high=Array.from({length:31},(_,i)=>i+32).concat(63);
 for(let i=0;i<4;i++){const a=low.slice(i*8,i*8+8),b=high.slice(i*8,i*8+8);block(i+2,a);section(i+2,'Filter codes '+a.join(','),'Resonance 1, fixed volume/pitch; 0.5 seconds per value.');block(i+6,b);section(i+6,'Filter codes '+b.join(','),'Resonance 1, fixed volume/pitch; 0.5 seconds per value.');}
 const resonance=[1,9,18,27,36,45,54,63];[8,16,24,39,47,55].forEach((code,i)=>{block(i+10,Array(8).fill(code),resonance);section(i+10,'Resonance at filter '+code,'Resonance codes '+resonance.join(',')+'; 0.5 seconds per value.');});
 block(16,Array(8).fill(63));section(16,'Dry reference / end marker','Same source and codes as P01; confirms gain stability and chain completion.');
 sections.sort((a,b)=>a.pattern-b.pattern);
 fs.writeFileSync(path.join(out,'filter-source.json'),JSON.stringify({frequencies,phases,peakBeforeMulaw:.16,sourceSeconds:2,parameterSeconds:.5,filterCells},null,2));
}
const template={globals:EMPTY_GLOBALS.map(a=>Uint8Array.from(a)),patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)};
const state=compileProject(model,id=>library.get(id),template),wav=encodePO33Backup({raw:{state}},44100),decoded=decodePO33Backup(wav);
assert.equal(decoded.validation.checksumErrors,0);assert.equal(decoded.validation.unresolvedAudioRanges,0);assert.equal(decoded.meta.bpm,model.tempo);assert.deepEqual(decoded.patternChain,model.chain);
const expected=model.patterns.map(readEffects);assert.deepEqual(state.patterns.map(readEffects),expected);assert.deepEqual(decoded.raw.state.patterns.map(readEffects),expected);
if(filterTest){assert(expected.flat().every(f=>f===null));for(const cell of filterCells){const c=readCell(decoded.raw.state.patterns[cell.pattern-1],cell.step,1);assert.equal(c.filter,cell.filter);assert.equal(c.resonance,cell.resonance);assert.equal(c.volume,36);assert.equal(c.pitch,13);assert.equal(c.timing,2);}assert(decoded.patterns.every(p=>p.steps.reduce((n,s)=>n+s.triggers.length,0)===8));}else assert.deepEqual([...new Set(expected.flat().filter(Boolean))].sort((a,b)=>a-b),Array.from({length:15},(_,i)=>i+1));
const file=filterTest?'Web-Sampler-Calibration-Filter-v3-60BPM.po33.wav':isolated?'Web-Sampler-Calibration-FX-v2-120BPM.po33.wav':'Web-Sampler-Calibration-v1-120BPM.po33.wav';fs.writeFileSync(path.join(out,file),Buffer.from(wav));
const report={file,bpm:model.tempo,chain:model.chain,firstPassSeconds:16*240/model.tempo,recommendedRecordingSeconds:filterTest?75:40,sampleSeconds:[...library.values()].reduce((n,v)=>n+v.length,0)/SAMPLE_RATE,backupSeconds:(wav.byteLength-44)/4/44100,checksumErrors:0,unresolvedAudioRanges:0,sections,nativeFX:expected};fs.writeFileSync(path.join(out,'calibration-map.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({file:path.join(out,file),bytes:wav.byteLength,sampleSeconds:report.sampleSeconds,backupSeconds:report.backupSeconds,checks:filterTest?'checksum, audio references, tempo, chain and all 128 native filter/resonance cells passed':'checksum, slice references, tempo, chain and all 15 stored FX passed'},null,2));
