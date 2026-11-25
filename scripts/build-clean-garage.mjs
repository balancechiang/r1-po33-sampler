// Original deterministic drum synthesis; no source recording or samples used.
// Usage: node scripts/build-clean-garage.mjs VOCODER_OUTPUT_DIR OUTPUT_DIR
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gzipSync,gunzipSync} from 'node:zlib';
import {emptyProject,compileProject,projectPages} from '../decoder/vendor/so-sample/project.ts';
import {emptyPattern,writeCell,DEFAULT_PARAMETERS} from '../decoder/vendor/so-sample/pattern.ts';
import {encodeMulaw,SAMPLE_RATE} from '../decoder/vendor/so-sample/mulaw.ts';
import {EMPTY_GLOBALS} from '../src/codec/po33Template.ts';
import {encodePO33Backup,encodePO33Frame} from '../src/codec/po33Encode.ts';
import {decodePO33Backup,decodePO33Frame} from '../src/codec/po33Codec.ts';
import {projectToJSON} from '../src/codec/po33JSON.ts';
const input=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const variations=process.argv.includes('--variations'),drumsOnly=process.argv.includes('--drums-only');
const bpm=132,step=60/bpm/4,seconds=16*16*step,rate=SAMPLE_RATE;
let seed=132;function noise(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1;}
function synth(kind,level=1,delay=0){
 const duration={kick:.38,snare:.23,hat:.10,open:.21,rim:.09,shaker:.11}[kind],a=new Float64Array(Math.ceil((duration+delay)*rate));let phase=0,previous=0,lp=0;
 for(let i=Math.round(delay*rate);i<a.length;i++){const t=i/rate-delay,n=noise(),hp=n-previous;previous=n;lp=.7*lp+.3*n;let v=0;
  if(kind==='kick'){phase+=2*Math.PI*(48+115*Math.exp(-t/.012))/rate;v=Math.sin(phase)*Math.exp(-t/.072)*.72+hp*Math.exp(-t/.002)*.05;}
  if(kind==='snare'){const env=Math.exp(-t/.039)+(t>.012?.45*Math.exp(-(t-.012)/.027):0)+(t>.023?.25*Math.exp(-(t-.023)/.025):0);v=(n-lp)*env*.38+Math.sin(2*Math.PI*183*t)*Math.exp(-t/.026)*.19;}
  if(kind==='hat'||kind==='open')v=hp*Math.exp(-t/(kind==='open'?.052:.016))*.12;
  if(kind==='rim')v=(Math.sin(2*Math.PI*1680*t)+.55*Math.sin(2*Math.PI*2440*t))*Math.exp(-t/.009)*.17;
  if(kind==='shaker')v=hp*(1-Math.exp(-t/.003))*Math.exp(-t/.025)*.075;
  a[i]=Math.tanh(v*level)*Math.min(1,t/.0006,(a.length-i)/(rate*.002));
 }return a;
}
const banks=[['kick','kick','kick'],['snare','snare','snare'],['hat','hat','open'],['rim','shaker','rim']];
const model=emptyProject(bpm);model.chain=Array.from({length:16},(_,i)=>i+1);model.swing=0;const library=new Map();
for(let bank=0;bank<4;bank++){
 for(let v=0;v<3;v++){const delayed=bank===2&&v===1?.019:bank===3&&v===1?.014:0;library.set(`${bank}-${v}`,encodeMulaw(synth(banks[bank][v],v===1?.65:v===2?1.08:1,delayed)));}
 model.drums[bank]={slices:Array.from({length:16},(_,k)=>{const id=`${bank}-${k%3}`;return{sampleId:id,start:0,end:library.get(id).length};})};
}
const events=[];
function hit(bar,bank,st,key=1){writeCell(model.patterns[bar],st+1,bank+9,{...DEFAULT_PARAMETERS,key,timing:1});events.push({bar,bank,st,key});}
const variationTable=[
 {name:'Pocket foundation',k:[0,6,10],h:[3,11],o:[],p:[[9,1]],g:[]},
 {name:'Late pickup',k:[0,7,10],h:[3,7,15],o:[14],p:[[5,2]],g:[]},
 {name:'Rim conversation',k:[0,6,10],h:[7,11,15],o:[],p:[[5,1],[13,2]],g:[11]},
 {name:'First turnaround',k:[0,7,10,14],h:[3,7,11],o:[14],p:[[13,1],[15,2]],g:[15]},
 {name:'Airy reset',k:[0,6,10],h:[3,15],o:[6],p:[[9,2]],g:[]},
 {name:'Kick response',k:[0,7,10,15],h:[7,11],o:[],p:[[3,1],[13,2]],g:[]},
 {name:'Shaker weave',k:[0,6,10,14],h:[3,7,11],o:[14],p:[[5,2],[9,2],[13,2]],g:[3]},
 {name:'Second turnaround',k:[0,7,10,14],h:[3,7,11,15],o:[],p:[[9,1],[14,2]],g:[13,15]},
 {name:'Back to the pocket',k:[0,6,10],h:[7,15],o:[10],p:[[5,1],[13,1]],g:[]},
 {name:'Offbeat answer',k:[0,7,10],h:[3,11,15],o:[14],p:[[3,2],[9,1]],g:[11]},
 {name:'Low ghost pickup',k:[0,3,6,10],h:[3,7,11],o:[],p:[[5,2],[15,1]],g:[]},
 {name:'Third turnaround',k:[0,7,10,15],h:[3,7,11,15],o:[14],p:[[9,2],[13,1]],g:[3,15]},
 {name:'Open hat space',k:[0,6,10],h:[3,7,15],o:[6,14],p:[[9,1],[13,2]],g:[]},
 {name:'Rolling conversation',k:[0,7,10,14],h:[3,11,15],o:[],p:[[5,2],[9,1],[13,2]],g:[3]},
 {name:'Final lift',k:[0,6,10,15],h:[3,7,11],o:[14],p:[[5,1],[9,2],[13,1]],g:[11]},
 {name:'Loop-home fill',k:[0,7,10,14],h:[3,7,11,15],o:[10],p:[[9,1],[13,2],[15,1]],g:[13,15]}
];
if(variations){
 variationTable.forEach((v,bar)=>{v.k.forEach(st=>hit(bar,0,st,st===0?1:2));[4,12].forEach(st=>hit(bar,1,st,1));v.g.forEach(st=>hit(bar,1,st,2));[2,6,8,10,14].forEach(st=>hit(bar,2,st,v.o.includes(st)?3:1));v.h.forEach(st=>hit(bar,2,st,2));v.p.forEach(([st,key])=>hit(bar,3,st,key));});
 assert.equal(new Set(model.patterns.map(p=>Buffer.from(p).toString('hex'))).size,16);
 for(const p of model.patterns){assert.notEqual(p[768+8],0);for(const st of [4,12])assert.notEqual(p[768+16*st+9],0);}
}else{
for(let bar=0;bar<16;bar++){
 const kicks=bar%2?[0,7,10]:[0,6,10];if(bar%4===3)kicks.push(14);if(bar===7||bar===15)kicks.push(15);
 kicks.forEach(st=>hit(bar,0,st,st===0?1:2));[4,12].forEach(st=>hit(bar,1,st,1));
 if(bar%4===3)hit(bar,1,15,2);
 for(const st of [2,6,8,10,14])hit(bar,2,st,st===14&&bar%2?3:1);
 for(const st of [3,7,11,15])if((st+bar)%3!==0)hit(bar,2,st,2);
 if(bar%2)hit(bar,3,9,1);if(bar%4===2){hit(bar,3,5,2);hit(bar,3,13,2);}if(bar%4===3){hit(bar,3,13,3);hit(bar,3,14,2);}
}
}
const template={globals:EMPTY_GLOBALS.map(a=>Uint8Array.from(a)),patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)};
const state=compileProject(model,id=>library.get(id),template),wav=encodePO33Backup({raw:{state}},44100),project=decodePO33Backup(wav);
assert.equal(project.validation.checksumErrors,0);assert.equal(project.validation.unresolvedAudioRanges,0);assert.deepEqual(project.patternChain,model.chain);assert.equal(project.meta.bpm,132);
const count=project.patterns.flatMap(p=>p.steps.flatMap(s=>s.triggers)).length;assert.equal(count,events.length);assert.equal(project.slots.filter(s=>s.audioBuffer?.length||s.slices.some(c=>c.audioBuffer?.length)).length,4);
const file=variations?'Garage-16-Variations-132BPM.po33.wav':'Bump-Sync-01-CLEAN-SYNTH-DRUMS-132BPM.po33.wav';fs.writeFileSync(path.join(out,file),Buffer.from(wav));fs.writeFileSync(path.join(out,file.replace('.po33.wav','.json')),projectToJSON(project));
// Render the actual decoded one-shot samples with same-bank choke and <=4 voices.
const preview=new Float32Array(Math.round(seconds*44100));
const sorted=events.sort((a,b)=>(a.bar*16+a.st)-(b.bar*16+b.st)||a.bank-b.bank);
for(let i=0;i<sorted.length;i++){
 const e=sorted[i],at=(e.bar*16+e.st)*step,source=project.slots[e.bank+8].slices[e.key-1].audioBuffer,next=sorted.slice(i+1).find(x=>x.bank===e.bank),end=Math.min(seconds,at+source.length/rate,next?(next.bar*16+next.st)*step:Infinity);
 const start=Math.round(at*44100),n=Math.round((end-at)*44100);
 for(let j=0;j<n;j++){const p=j*rate/44100,l=Math.floor(p),f=p-l,v=(source[l]||0)*(1-f)+(source[l+1]||0)*f;preview[start+j]+=v*Math.min(1,j/(44100*.0007),(n-j)/(44100*.002));}
}
function writeWav(name,a){const b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(a.length*2,40);let peak=0;for(let i=0;i<a.length;i++){peak=Math.max(peak,Math.abs(a[i]));b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,a[i]))*32767),44+2*i);}assert(peak<1,`clipping: ${peak}`);fs.writeFileSync(path.join(out,name),b);return peak;}
const peak=writeWav('LISTEN-CLEAN-DRUMS.wav',preview);let mixPeak=null;
if(!drumsOnly){
// Match the retained vocoder preview exactly in time, with no auto-normalization.
const vocalFile='LISTEN-02-VOCODER-NO-DRY.wav',vocalBytes=fs.readFileSync(path.join(input,vocalFile));assert.equal(vocalBytes.readUInt32LE(24),44100);assert.equal(vocalBytes.readUInt16LE(22),1);
const vocal=Float32Array.from({length:(vocalBytes.length-44)/2},(_,i)=>vocalBytes.readInt16LE(44+2*i)/32768);assert.equal(vocal.length,preview.length);
mixPeak=writeWav('LISTEN-CLEAN-DRUMS-AND-VOCODER.wav',Float32Array.from(preview,(v,i)=>v+vocal[i]));
for(const name of fs.readdirSync(input).filter(n=>n.includes('02-VOCODER-NO-DRY')))fs.copyFileSync(path.join(input,name),path.join(out,name));
}
if(variations){
 const compressed=gzipSync(encodePO33Frame(state)),restored=decodePO33Frame(gunzipSync(compressed));
 assert.deepEqual(restored.raw.state.patterns,project.raw.state.patterns);assert.deepEqual(restored.patternChain,project.patternChain);
 assert.equal(restored.validation.unresolvedAudioRanges,0);
 fs.writeFileSync(path.join(out,'garage-16.po33.gz'),compressed);
 fs.writeFileSync(path.join(out,'patterns.json'),JSON.stringify(variationTable.map((v,i)=>({pattern:i+1,...v})),null,2));
}
const report={uniquePatterns:new Set(model.patterns.map(p=>Buffer.from(p).toString("hex"))).size,bpm,chain:model.chain,seconds,synthesized:true,sourceRecordingRead:false,activeSlots:[9,10,11,12],maxConcurrentSlots:4,notes:count,pages:projectPages(model,id=>library.get(id)),sampleSeconds:[...library.values()].reduce((n,a)=>n+a.length/rate,0),checksumErrors:project.validation.checksumErrors,unresolvedAudioRanges:project.validation.unresolvedAudioRanges,backupSeconds:(wav.byteLength-44)/4/44100,drumPeak:peak,mixPeak};
fs.writeFileSync(path.join(out,'clean-drums-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
