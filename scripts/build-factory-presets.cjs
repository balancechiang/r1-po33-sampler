/** Reproducible procedural palette + approximate instrumental transcription.
 * No recording, lyric, vocal or extracted PCM is used by this generator.
 * Run: node scripts/build-factory-presets.cjs
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),RATE=24000,BPM=132,SWING=4/18;
let seed=0x464c4f57;const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1;};
const hz=m=>440*2**((m-69)/12),TAU=2*Math.PI;
function tone(notes,seconds=.48,kind='keys'){
 const n=Math.round(RATE*seconds),a=new Float32Array(n);
 for(let i=0;i<n;i++){const t=i/RATE;let v=0;
  for(let j=0;j<notes.length;j++){const f=hz(notes[j]),p=TAU*f*t,attack=1-Math.exp(-t/.003);
   if(kind==='bass')v+=(Math.sin(p)+.20*Math.sin(2*p)+.055*Math.sin(3*p))*attack*Math.exp(-t/.18);
   else if(kind==='organ')v+=(Math.sin(p)+.35*Math.sin(2*p)+.19*Math.sin(3*p)+.06*Math.sin(4*p))*attack*Math.exp(-t/.19);
   else v+=(Math.sin(p+.35*Math.sin(p*2)*Math.exp(-t/.06))+.38*Math.sin(2*p)+.16*Math.sin(3.997*p)*Math.exp(-t/.07)+.08*Math.sin(6*p))*attack*Math.exp(-t/(kind==='bell'?.18:.105));
  }
  const tail=Math.min(1,(n-i)/(.012*RATE));a[i]=Math.tanh(v/Math.sqrt(notes.length)*.75)*tail*.7;
 }
 return a;
}
const sliceSeconds=.24,sliceFrames=Math.round(RATE*sliceSeconds);
function drum(kind,level=1){const a=new Float32Array(sliceFrames);let kickPhase=0,last=0,filtered=0;
 for(let i=0;i<a.length;i++){const t=i/RATE,r=noise(),hp=r-last;last=r;filtered=.72*filtered+.28*r;let v=0;
  if(kind.includes('kick')){const f=46+105*Math.exp(-t/.014);kickPhase+=TAU*f/RATE;v+=Math.sin(kickPhase)*Math.exp(-t/.058)*.98+hp*Math.exp(-t/.002)*.07;}
  if(kind.includes('snare')||kind.includes('clap')){const clap=kind.includes('clap');let env=Math.exp(-t/.041);if(clap)env+=(Math.exp(-Math.max(0,t-.012)/.023)*(t>.012)+Math.exp(-Math.max(0,t-.021)/.025)*(t>.021))*.3;v+=(r-filtered)*env*.62+Math.sin(TAU*178*t)*Math.exp(-t/.025)*.3;}
  if(kind.includes('hat'))v+=hp*Math.exp(-t/(kind.includes('open')?.075:.018))*.23;
  if(kind.includes('rim'))v+=(Math.sin(TAU*1640*t)+Math.sin(TAU*2310*t))*Math.exp(-t/.009)*.18;
  if(kind.includes('shaker'))v+=hp*(1-Math.exp(-t/.004))*Math.exp(-t/.029)*.14;
  if(kind.includes('tom'))v+=Math.sin(TAU*(110*t+1.9*(1-Math.exp(-t/.035))))*Math.exp(-t/.06)*.55;
  a[i]=Math.tanh(v*level)*Math.min(1,i/(RATE*.0005),(a.length-i)/(RATE*.003));
 }return a;}
function kit(parts){const out=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function wav(a){const b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(RATE,24);b.writeUInt32LE(RATE*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(a.length*2,40);for(let i=0;i<a.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,a[i]))*32767),44+i*2);return b.toString('base64');}
const drums=['kick','snare','hat','kick hat','snare hat','open hat','kick open hat','snare open hat','rim','rim hat','shaker','kick rim','clap','clap hat','snare','tom'];
const chords=[[60,63,67,70,74],[56,60,63,67,70],[55,58,62,65],[53,56,60,63,67],[60,63,67],[58,62,65,69],[63,67,70,74],[60,65,67,70],[72,75,79],[68,72,75,79],[67,70,74,77],[65,68,72,75],[60,63,67,74],[56,60,63,70],[55,58,62,69],[60,63,67,70]];
const chordSeconds=.42;
const assets=[
 [1,'Rounded C2 sub',tone([36],.48,'bass')],
 [2,'Tine keys C5',tone([72],.52)],
 [3,'Soft organ C4',tone([60],.52,'organ')],
 [4,'Glass bell C5',tone([72],.48,'bell')],
 [9,'2-step composite kit',kit(drums.map((s,i)=>drum(s,i===14?.35:1)))],
 [10,'Minor / soul chord stabs',kit(chords.map(c=>tone(c,chordSeconds)))],
 [11,'Hat / shaker variations',kit(Array.from({length:16},(_,i)=>drum(i%4===0?'open hat':i%3===0?'shaker':'hat',.5+i*.025)))],
 [12,'Rim / clap / tom kit',kit(Array.from({length:16},(_,i)=>drum(['rim','clap','tom','rim hat'][i%4],.55+i*.02)))]
];
const patterns=[];
for(let bar=0;bar<8;bar++){
 const lanes=Array.from({length:16},()=>Array(16).fill(-1)),extras={effects:[],locks:{},steps:{}};
 const set=(slot,step,note,volume,length)=>{lanes[slot-1][step]=note;if(volume!==undefined)extras.locks[(slot-1)+':'+step]={volume};if(length)extras.steps[(slot-1)+':'+step]={length,retrigs:1};};
 // Four active slots total: sub, keys, composite drums and sampled chord voicings.
 const rhythm=bar%2===0?{0:3,2:2,4:4,7:5,8:2,10:3,12:4,14:2,15:10}:{0:3,2:2,4:4,6:2,7:9,10:3,12:4,14:6,15:10};
 if(bar===3 || bar===7){rhythm[13]=14;rhythm[15]=9;}
 for(const [k,pad] of Object.entries(rhythm))set(9,+k,pad,80+(+k%4===0?10:0));
 if(bar%2===0){
  for(const [st,n,v] of [[0,0,70],[2,0,83],[7,14,63],[9,0,77],[12,bar===4?10:0,76],[14,bar===4?2:0,67]])set(2,st,n,v,2);
  set(10,0,0,42);set(10,7,1,33);set(10,12,0,34);
  set(1,0,4,70,2);set(1,10,4,62,2);
 }else{
  const line=bar===3?[[1,0,72],[4,1,73],[6,0,65],[9,4,78],[15,7,64]]:bar===7?[[1,0,65],[2,6,84],[4,5,84],[7,1,75],[9,0,72]]:[[1,0,65],[2,6,84],[4,5,84],[7,2,70],[9,4,78],[15,7,64]];
  for(const [st,n,v] of line)set(2,st,n,v,2);
  set(10,0,1,39);set(10,4,2,32);set(10,9,0,34);set(10,14,3,30);
  set(1,0,1,66,2);set(1,10,0,64,2);set(1,14,7,51,1);
 }
 patterns.push({name:'Flowers study '+String(bar+1).padStart(2,'0'),style:'UK Garage / 2-step',bpm:BPM,swing:SWING,lanes,extras});
}
const f={revision:2,patternRevision:4,title:'Flowers — Sunship intro instrumental study',reference:'Sweet Female Attitude / Sunship, Flowers (Sunship Edit), supplied local reference; approximate first-14-second transcription.',bpm:BPM,swing:SWING,chain:[1,2,3,4,5,6,7,8],slots:assets.map(([slot,name,a])=>({slot,name,wav:wav(a)})),patterns,license:'Procedural sound synthesis is original (CC0-1.0); arrangement is a reference-based instrumental study, not a claim of ownership of Flowers. No source recording or vocals are embedded.'};
fs.writeFileSync(path.join(root,'presets.js'),'/* Procedural sounds; reference-based instrumental arrangement. See license field. */\nwindow.PO33_FACTORY = '+JSON.stringify(f)+';\n');
console.log(JSON.stringify({title:f.title,bpm:BPM,seconds:8*4*60/BPM,memorySeconds:assets.reduce((n,a)=>n+a[2].length/RATE,0),slots:assets.map(a=>({slot:a[0],name:a[1],seconds:a[2].length/RATE})),notes:patterns.map(p=>p.lanes.flat().filter(n=>n>=0).length)}));
