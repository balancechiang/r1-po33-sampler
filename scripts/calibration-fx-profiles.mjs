// Original deterministic material. These profiles collect evidence; they do not change runtime FX.
import fs from 'node:fs';
import path from 'node:path';
import {emptyPattern,writeEffects,readCell} from '../decoder/vendor/so-sample/pattern.ts';
export function buildFxProfile(c){
 const {profile,model,library,sound,hit,section,sections,out}=c;
 model.tempo=60;model.melodic=Array(8).fill(null);model.drums=Array(8).fill(null);model.patterns=Array.from({length:16},emptyPattern);sections.length=0;library.clear();
 const cells=[];
 function note(p,step,slot=1,key=5,parameters={}){hit(p,step,slot,key,{timing:slot<=8?4:1,...parameters});cells.push({pattern:p,step,slot,cell:readCell(model.patterns[p-1],step,slot)});}
 function fx(p,kind,first=5,last=12){const a=Array(16).fill(null);for(let i=first;i<=last;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
 function rich(id,hz,seconds=4){return sound(id,seconds,t=>{let v=0;for(let h=1;h<=24;h++)v+=Math.sin(2*Math.PI*hz*h*t)/h;return .09*v;});}
 let allowedFX;
 if(profile==='unison'){
  const base=rich('unison-110',110);for(let i=0;i<5;i++)model.melodic[i]={...base};
  const slices=[110,165,220,330].map(f=>rich('drum-tone-'+f,f,1));model.drums[0]={slices:Array.from({length:16},(_,i)=>({...slices[i%4]}))};
  const keys=[13,5,1,9],pitches=[1,9,17,25];
  for(let p=1;p<=3;p++){keys.forEach((key,i)=>note(p,1+i*4,1,key));if(p>1)fx(p,p===2?5:6,1,16);section(p,['','Note-key dry','Unison / note keys','Unison Low / note keys'][p],'Same key sequence13,5,1,9; no pitch locks. Distinguishes note preservation from root clamping.');}
  for(let p=4;p<=6;p++){pitches.forEach((pitch,i)=>note(p,1+i*4,1,5,{pitch}));if(p>4)fx(p,p===5?5:6,1,16);section(p,'Pitch-lock '+(p===4?'dry':'FX'+(p===5?5:6)),'Root key5 with native pitch codes1,9,17,25; identical control notes.');}
  for(let p=7;p<=9;p++){[1,2,3,4].forEach((key,i)=>note(p,1+i*4,9,key));if(p>7)fx(p,p===8?5:6,1,16);section(p,'Drum slices '+(p===7?'dry':'FX'+(p===8?5:6)),'Four distinct drum tones110/165/220/330Hz; tests slice selection and source layers.');}
  for(const [p,kind] of [[10,5],[11,6]]){note(p,1,1,13,{timing:15});fx(p,kind);section(p,'Held non-root enter/release FX'+kind,'One key13 note, no new note at FX entry or release.');}
  note(12,1,1,9,{timing:15});const a=Array(16).fill(null);for(let i=4;i<8;i++)a[i]=5;for(let i=8;i<12;i++)a[i]=6;writeEffects(model.patterns[11],a);section(12,'Held note switch5→6→off','Single key9 note; tests reader continuity and gain on switch.');
  for(let p=13;p<=15;p++){for(let slot=1;slot<=4;slot++)note(p,1,slot,5,{timing:15,pitch:[13,16,18,21][slot-1]});note(p,9,5,5,{timing:15,pitch:24});if(p>13)fx(p,p===14?5:6,1,16);section(p,'Voice stealing '+(p===13?'dry':'FX'+(p===14?5:6)),'Four separately addressed slots with pitch codes13/16/18/21 start together; fifth slot with pitch24 joins at2s. Shared original PCM keeps the backup short. Identifies allocation/stealing without manually operating FX.');}
  keys.forEach((key,i)=>note(16,1+i*4,1,key));section(16,'Dry end reference','Identical to P01.');allowedFX=[5,6];
 }else{
  model.melodic[0]=rich('fx-harmonics',110);model.melodic[1]=sound('fx-chirp',4,t=>.2*(.4+.6*t/4)*Math.sin(2*Math.PI*220/(Math.log(16)/4)*(Math.exp(Math.log(16)/4*t)-1)));
  const slices=Array.from({length:4},(_,i)=>sound('fx-pulse-'+i,.4,t=>.22*Math.sin(2*Math.PI*(330+110*i)*t)*Math.exp(-t/.025)+.07*Math.sin(2*Math.PI*(1300+i*170)*t)*Math.exp(-t/.006)));
  model.drums[0]={slices:Array.from({length:16},(_,i)=>({...slices[i%4]}))};
  function grid(p){for(let i=0;i<16;i++)note(p,i+1,9,i%4+1);}
  grid(1);section(1,'Pulse-grid dry','Distinct tone marker on every sixteenth, repeats every four steps.');
  for(const [p,kind] of [[2,1],[3,2],[4,3],[5,4]]){grid(p);fx(p,kind,5,8);section(p,'Loop FX'+kind,'Dry1–4, saved FX5–8, then off; identifies timing window, progression and exit. Native traversal is not assumed validated.');}
  for(const [p,kind] of [[6,7],[7,8],[8,9],[9,10]]){note(p,1,1,5,{timing:15});fx(p,kind);section(p,'Held source FX'+kind,'Four-second harmonic source; FX on at1s, off at3s. Measures glide/gating and level.');}
  grid(10);fx(10,13);section(10,'6/8 quantize / middle span','Step markers at all16 positions, FX5–12; compare onset grid with P01.');
  for(const step of [1,5,9,13])note(11,step,2,5);fx(11,15);section(11,'Reverse melodic','Repeated one-second chirp windows; reverse active5–12.');
  grid(12);fx(12,15);section(12,'Reverse drum','Same pulse/slice sequence as P01; FX5–12.');
  for(const [p,a,b] of [[13,7,8],[14,9,10]]){note(p,1,1,5,{timing:15});const e=Array(16).fill(null);for(let i=4;i<8;i++)e[i]=a;for(let i=8;i<12;i++)e[i]=b;writeEffects(model.patterns[p-1],e);section(p,'Held switch'+a+'→'+b+'→off','No new note at effect changes; compare release continuity.');}
  grid(15);fx(15,13,1,16);section(15,'6/8 quantize / whole pattern','Dense markers; tests chain handoff into dry P16.');grid(16);section(16,'Dry end reference','Identical to P01.');allowedFX=[1,2,3,4,7,8,9,10,13,15];
 }
 const manifest={profile:profile==='unison'?'unison-v6':'other-fx-v7',bpm:60,allowedFX,cells,notes:'Original synthesized sources; hardware capture pending. FX14 requires a separate sync test.'};
 fs.writeFileSync(path.join(out,'fx-source.json'),JSON.stringify(manifest,null,2));return manifest;
}
