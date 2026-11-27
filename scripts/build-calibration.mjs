// Original, deterministic calibration material; no external recordings.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {emptyProject,compileProject} from '../decoder/vendor/so-sample/project.ts';
import {emptyPattern,writeCell,writeEffects,DEFAULT_PARAMETERS,readEffects} from '../decoder/vendor/so-sample/pattern.ts';
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
function section(p,name,detail){sections.push({pattern:p,startSeconds:(p-1)*2,endSeconds:p*2,name,detail});}
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
const template={globals:EMPTY_GLOBALS.map(a=>Uint8Array.from(a)),patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)};
const state=compileProject(model,id=>library.get(id),template),wav=encodePO33Backup({raw:{state}},44100),decoded=decodePO33Backup(wav);
assert.equal(decoded.validation.checksumErrors,0);assert.equal(decoded.validation.unresolvedAudioRanges,0);assert.equal(decoded.meta.bpm,120);assert.deepEqual(decoded.patternChain,model.chain);
const expected=model.patterns.map(readEffects);assert.deepEqual(state.patterns.map(readEffects),expected);assert.deepEqual(decoded.raw.state.patterns.map(readEffects),expected);
assert.deepEqual([...new Set(expected.flat().filter(Boolean))].sort((a,b)=>a-b),Array.from({length:15},(_,i)=>i+1));
const file='Web-Sampler-Calibration-v1-120BPM.po33.wav';fs.writeFileSync(path.join(out,file),Buffer.from(wav));
const report={file,bpm:120,chain:model.chain,firstPassSeconds:32,recommendedRecordingSeconds:40,sampleSeconds:[...library.values()].reduce((n,v)=>n+v.length,0)/SAMPLE_RATE,backupSeconds:(wav.byteLength-44)/4/44100,checksumErrors:0,unresolvedAudioRanges:0,sections,nativeFX:expected};fs.writeFileSync(path.join(out,'calibration-map.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({file:path.join(out,file),bytes:wav.byteLength,sampleSeconds:report.sampleSeconds,backupSeconds:report.backupSeconds,checks:'checksum, slice references, tempo, chain and all 15 stored FX passed'},null,2));
