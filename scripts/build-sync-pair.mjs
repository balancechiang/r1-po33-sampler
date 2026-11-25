// Build two complementary native projects from locally prepared PCM stems.
// Usage: node scripts/build-sync-pair.mjs PREPARED_DIR OUTPUT_DIR
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {emptyProject,compileProject,projectPages} from '../decoder/vendor/so-sample/project.ts';
import {emptyPattern,writeCell,DEFAULT_PARAMETERS} from '../decoder/vendor/so-sample/pattern.ts';
import {encodeMulaw,SAMPLE_RATE} from '../decoder/vendor/so-sample/mulaw.ts';
import {toNativeRate} from '../decoder/vendor/so-sample/resample.ts';
import {EMPTY_GLOBALS} from '../src/codec/po33Template.ts';
import {encodePO33Backup} from '../src/codec/po33Encode.ts';
import {decodePO33Backup} from '../src/codec/po33Codec.ts';
import {projectToJSON} from '../src/codec/po33JSON.ts';
const input=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);fs.mkdirSync(output,{recursive:true});
const info=JSON.parse(fs.readFileSync(path.join(input,'preparation.json'),'utf8')),eighth=30/info.bpm;
const reports=[],previews=[];
function pcmWav(a){const b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(a.length*2,40);a.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+2*i));return b;}
for(const [role,label] of [['rhythm','01-DRUMS-BASS'],['vocal','02-VOCAL-CHOPS']]){
 const bytes=fs.readFileSync(path.join(input,role+'.f32')),pcm=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const native=toNativeRate(pcm,info.rate),model=emptyProject(info.bpm),library=new Map();model.chain=Array.from({length:16},(_,i)=>i+1);model.swing=0;
 for(let kit=0;kit<8;kit++){
  const a=Math.round(kit*16*eighth*SAMPLE_RATE),b=Math.min(native.length,Math.round((kit+1)*16*eighth*SAMPLE_RATE)),clip=native.slice(a,b),id=role+'-'+kit;
  library.set(id,encodeMulaw(clip));
  model.drums[kit]={slices:Array.from({length:16},(_,k)=>({sampleId:id,start:Math.round(k*clip.length/16),end:Math.round((k+1)*clip.length/16)}))};
  for(let half=0;half<2;half++){const pattern=model.patterns[kit*2+half];for(let k=0;k<8;k++)writeCell(pattern,1+k*2,9+kit,{...DEFAULT_PARAMETERS,key:1+half*8+k,timing:1});}
 }
 const template={globals:EMPTY_GLOBALS.map(a=>Uint8Array.from(a)),patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)};
 const pages=projectPages(model,id=>library.get(id)),state=compileProject(model,id=>library.get(id),template),wav=encodePO33Backup({raw:{state}},44100),file=`Bump-Sync-${label}-132BPM.po33.wav`;
 fs.writeFileSync(path.join(output,file),Buffer.from(wav));
 const decoded=decodePO33Backup(wav);assert.equal(decoded.validation.checksumErrors,0);assert.equal(decoded.validation.unresolvedAudioRanges,0);assert.equal(decoded.meta.bpm,132);assert.deepEqual(decoded.patternChain,model.chain);assert.equal(decoded.slots.length,16);assert.equal(decoded.patterns.length,16);
 for(let p=0;p<16;p++){const hits=decoded.patterns[p].steps.flatMap(s=>s.triggers);assert.equal(hits.length,8);assert(hits.every(h=>h.slotId===9+Math.floor(p/2)));}
 assert.equal(decoded.slots.slice(8).flatMap(s=>s.slices).filter(s=>s.rangeStatus==='complete').length,128);
 fs.writeFileSync(path.join(output,`Bump-Sync-${label}-132BPM.json`),projectToJSON(decoded));
 // Audition the actual decoded hardware slices at 44.1 kHz, including tiny
 // de-click envelopes; this is music, unlike the modem backup WAV above.
 const preview=new Float32Array(Math.round(info.durationSeconds*44100));
 for(let p=0;p<16;p++)for(let k=0;k<8;k++){
  const slice=decoded.slots[8+Math.floor(p/2)].slices[(p%2)*8+k].audioBuffer;
  const start=Math.round((p*8+k)*eighth*44100),end=Math.round((p*8+k+1)*eighth*44100);
  for(let j=0;j<end-start&&start+j<preview.length;j++){const at=j*SAMPLE_RATE/44100,l=Math.floor(at),frac=at-l;if(l>=slice.length)break;const v=slice[l]*(1-frac)+(slice[Math.min(l+1,slice.length-1)]||0)*frac;const fade=Math.min(1,j/(.0007*44100),(end-start-j)/(.0007*44100));preview[start+j]=v*fade;}
 }
 previews.push(preview);fs.writeFileSync(path.join(output,`LISTEN-${label}.wav`),pcmWav(preview));
 reports.push({file,bpm:decoded.meta.bpm,chain:decoded.patternChain,pages,memorySeconds:[...library.values()].reduce((n,a)=>n+a.length,0)/SAMPLE_RATE,patternCount:16,triggers:128,validSlices:128,checksumErrors:0,unresolvedAudioRanges:0,backupSeconds:(wav.byteLength-44)/4/44100,packets:decoded.validation.packetCount});
}
const mix=Float32Array.from(previews[0],(v,i)=>v+previews[1][i]);assert(Math.max(...Array.from({length:100},(_,i)=>Math.max(...mix.subarray(i*Math.ceil(mix.length/100),(i+1)*Math.ceil(mix.length/100)).map(Math.abs))))<1);
fs.writeFileSync(path.join(output,'LISTEN-BOTH-SYNCHRONIZED.wav'),pcmWav(mix));
fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({sourceWindow:info,projects:reports},null,2));console.log(JSON.stringify(reports,null,2));
