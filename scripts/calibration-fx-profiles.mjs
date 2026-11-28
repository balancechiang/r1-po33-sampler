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
 let allowedFX,expectedOwners;
 if(profile==='clock-phase'){
  const option=process.argv.find(a=>a.startsWith('--bpm='));model.tempo=option?Number(option.slice(6)):90;
  if(![90,137].includes(model.tempo))throw Error('Clock-phase calibration requires --bpm=90 or --bpm=137');
  const durations=[.055,.16];
  durations.forEach((seconds,kit)=>{model.drums[kit]={slices:Array.from({length:16},(_,i)=>{const f=220+55*i;return sound('clock-marker-'+kit+'-'+i,seconds,t=>.22*Math.sin(2*Math.PI*f*t)*Math.exp(-t/(kit?.035:.012))+.055*Math.sin(2*Math.PI*f*2.7*t)*Math.exp(-t/(kit?.009:.004)));})};});
  function grid(p,slot){for(let i=1;i<=16;i++)note(p,i,slot,i);}
  function windows(p,items){const a=Array(16).fill(null);for(const [kind,first,last] of items)for(let i=first;i<=last;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
  for(const [base,slot,label] of [[0,9,'55ms short sources'],[8,10,'160ms original-length sources']]){
   grid(base+1,slot);section(base+1,label+' dry reference','Sixteen distinct markers; no saved FX.');
   for(const shift of [0,1,2,3]){const p=base+2+shift;grid(p,slot);windows(p,[[1,1+shift,4+shift],[1,9+shift,12+shift]]);section(p,label+' Loop1 entry shift'+shift,'Two four-step windows, second8steps later; four dry steps between. Offsets expressed in steps so tempo is the only project difference.');}
   grid(base+6,slot);windows(base+6,[[4,1,16]]);section(base+6,label+' Loop4 conditioning','FX4 remains active to the next bar.');
   for(const p of [base+7,base+8]){grid(p,slot);windows(p,[[1,1,4],[1,9,12]]);section(p,label+' exact zero-shift probe','Byte-identical to P'+(base+2)+'; first follows full-bar FX4, second follows a probe with dry tail.');}
   for(const p of [base+7,base+8])if(JSON.stringify(model.patterns[p-1])!==JSON.stringify(model.patterns[base+1]))throw Error('Clock-phase probe patterns must be identical');
  }
  fs.writeFileSync(path.join(out,'clock-source.json'),JSON.stringify({bpm:model.tempo,sliceDurationsSeconds:durations,shorterThanFastestStep:true,fastestStepSeconds:15/137,identicalPatternGroups:[[2,7,8],[10,15,16]],recommendedPasses:2},null,2));allowedFX=[1,4];
 }else if(profile==='ownership-phase'){
  const rate=23437.5,k=Math.log(2)/3;
  const original=sound('isolation-original',3,t=>.10*Math.sin(2*Math.PI*997/k*(Math.exp(k*t)-1)));
  const selected=library.get(original.sampleId),gap=Math.round(rate*.25),second=selected.length+gap,packed=new Uint8Array(second+selected.length);
  packed.set(selected);packed.set(selected,second);library.delete(original.sampleId);library.set('isolation-container',packed);library.set('isolation-independent',selected.slice());
  const first={sampleId:'isolation-container',start:0,end:selected.length},later={sampleId:'isolation-container',start:second,end:packed.length},independent={sampleId:'isolation-independent',start:0,end:selected.length};
  model.melodic[0]={...first};model.melodic[1]={...first};model.melodic[2]={...later};model.melodic[3]={...later};model.melodic[4]={...independent};model.melodic[5]={...independent};
  expectedOwners=[[0,0],[1,0],[2,0],[3,0],[4,4],[5,4]];
  const slices=Array.from({length:16},(_,i)=>{const f=220+55*i;return sound('phase-marker-'+i,.16,t=>.22*Math.sin(2*Math.PI*f*t)*Math.exp(-t/.035)+.055*Math.sin(2*Math.PI*f*2.7*t)*Math.exp(-t/.009));});model.drums[0]={slices};
  function effects(p,items){const a=Array(16).fill(null);for(const [kind,from,to] of items)for(let i=from;i<=to;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
  function grid(p){for(let i=1;i<=16;i++)note(p,i,9,i);}
  note(1,1,1,5,{timing:12});section(1,'Dry first shared view','Three-second chirp at pool start; alignment and dry reference.');
  for(const [p,slot,label] of [[2,1,'first owner, zero start'],[3,2,'different slot, same owner and zero start'],[4,3,'same owner, later window'],[5,4,'different slot, same later window'],[6,5,'independent owner, zero start'],[7,6,'different slot, same independent owner']]){
   note(p,1,slot,5,{timing:12});effects(p,[[5,3,6],[6,7,10]]);section(p,'Unison5→6→off: '+label,'All selected PCM byte-identical. Note0s, FX5 0.5–1.5s, FX6 1.5–2.5s, off2.5–3s.');
  }
  note(8,1,5,5,{timing:12});section(8,'Dry independent view','Same PCM as P01, different owner, no effect.');
  for(const [p,shift] of [[9,0],[10,1],[11,2],[12,3]]){grid(p);effects(p,[[1,1+shift,4+shift],[1,9+shift,12+shift]]);section(p,'Loop1 phase '+(shift*.25)+'s','Two one-second FX1 windows at'+(shift*.25)+'s and'+(2+shift*.25)+'s, with1s dry between; grid/source unchanged.');}
  grid(13);effects(13,[[4,1,16]]);section(13,'Loop4 full-bar conditioning','FX4 remains active to the P14 entry.');
  grid(14);effects(14,[[1,1,4],[1,9,12]]);section(14,'Exact P09 probe after full FX4','Byte-identical to P09, only preceding history differs.');
  grid(15);effects(15,[[4,1,12]]);section(15,'Loop4 conditioning plus dry gap','FX4 for3s, then1s dry before P16.');
  grid(16);effects(16,[[1,1,4],[1,9,12]]);section(16,'Exact P09 probe after dry-gap FX4','Byte-identical to P09/P14.');
  for(const slot of model.melodic.filter(Boolean)){const data=library.get(slot.sampleId).slice(slot.start,slot.end);if(data.length!==selected.length || !data.every((v,i)=>v===selected[i]))throw Error('Ownership contrast selected PCM mismatch');}
  for(const p of [14,16])if(JSON.stringify(model.patterns[p-1])!==JSON.stringify(model.patterns[8]))throw Error('Phase control patterns must be identical');
  fs.writeFileSync(path.join(out,'ownership-source.json'),JSON.stringify({sampleRate:rate,selectedPCMIdentical:true,selectedFrames:selected.length,slots:model.melodic.slice(0,6),expectedOwners,identicalLoopPatterns:[9,14,16],recommendedPasses:2},null,2));allowedFX=[1,4,5,6];
 }else if(profile==='history-boundaries'){
  const rate=23437.5,k=Math.log(2)/3;
  const chirp=sound('history-chirp',3,t=>.10*Math.sin(2*Math.PI*997/k*(Math.exp(k*t)-1)));
  function padded(id,source){const input=library.get(source.sampleId),prefix=Math.round(rate),codes=new Uint8Array(prefix+input.length);codes.set(input,prefix);library.set(id,codes);return {sampleId:id,start:prefix,end:codes.length};}
  const chirpOffset=padded('history-chirp-offset',chirp);
  const sine=sound('history-sine997',3,t=>.085*Math.sin(2*Math.PI*997*t));
  const sineOffset=padded('history-sine-offset',sine);
  model.melodic[0]=chirp;model.melodic[1]=chirpOffset;model.melodic[2]=sine;model.melodic[3]=sineOffset;
  const slices=Array.from({length:16},(_,i)=>{const f=220+55*i;return sound('history-marker-'+i,.16,t=>.22*Math.sin(2*Math.PI*f*t)*Math.exp(-t/.035)+.055*Math.sin(2*Math.PI*f*2.7*t)*Math.exp(-t/.009));});
  model.drums[0]={slices};
  function grid(p){for(let step=1;step<=16;step++)note(p,step,9,step);}
  function effects(p,items){const a=Array(16).fill(null);for(const [kind,first,last] of items)for(let i=first;i<=last;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
  note(1,1,9,1);note(1,9,9,16);section(1,'Dry lead-in / timing markers','Two short markers at0/2s; no FX throughout the first bar. Not assumed to erase all firmware history.');
  for(const p of [2,4,6,8]){grid(p);effects(p,[[1,1,4],[2,5,8],[3,9,12],[4,13,16]]);section(p,'Identical Loop1→2→3→4 probe','Exact same native pattern bytes after different preceding histories; compare first1s as well as all transitions.');}
  grid(3);effects(3,[[4,1,16]]);section(3,'History: Loop4 held to bar end','No dry gap before the P04 probe.');
  grid(5);effects(5,[[4,1,12]]);section(5,'History: Loop4 then one dry second','Matches the previous v8 boundary shape before P06 probe.');
  grid(7);effects(7,[[1,1,16]]);section(7,'History: Loop1 held to bar end','Same history length, different effect before P08 probe.');
  for(const [dry,wet,slot,label] of [[9,10,1,'first-allocation chirp'],[11,12,2,'byte-identical chirp with1s trim offset'],[13,14,3,'later-allocation997Hz'],[15,16,4,'byte-identical997Hz with1s trim offset']]){
   for(const p of [dry,wet])note(p,1,slot,5,{timing:12});
   section(dry,'Dry '+label,'Three-second selected PCM, gate3s, one-second clear interval.');
   effects(wet,[[5,3,6],[6,7,10]]);section(wet,'FX5→6→off '+label,'One note: dry0–0.5s; FX5 0.5–1.5s; FX6 1.5–2.5s; off2.5–3s. Identifies early termination versus content and allocation order.');
  }
  if(![4,6,8].every(p=>JSON.stringify(model.patterns[p-1])===JSON.stringify(model.patterns[1])))throw Error('Loop probe patterns must be byte-identical');
  for(const [a,b] of [[chirp,chirpOffset],[sine,sineOffset]]){const x=library.get(a.sampleId).slice(a.start,a.end),y=library.get(b.sampleId).slice(b.start,b.end);if(x.length!==y.length || !x.every((v,i)=>v===y[i]))throw Error('Offset pair PCM mismatch');}
  fs.writeFileSync(path.join(out,'history-source.json'),JSON.stringify({melodicSlots:model.melodic.slice(0,4),identicalSelectedPairs:[[1,2],[3,4]],identicalProbePatterns:[2,4,6,8],conditioningPatterns:[1,3,5,7],sampleRate:rate},null,2));
  allowedFX=[1,2,3,4,5,6];
 }else if(profile==='unison-layers'){
  model.melodic[0]=sound('layers-fixed997',3,t=>.085*Math.sin(2*Math.PI*997*t));
  const k=Math.log(2)/3;
  model.melodic[1]=sound('layers-up',3,t=>.10*Math.sin(2*Math.PI*997/k*(Math.exp(k*t)-1)));
  model.melodic[2]=sound('layers-down',3,t=>.10*Math.sin(2*Math.PI*1994/k*(1-Math.exp(-k*t))));
  const levels=[.10,.035,.085,.025,.065,.045];
  model.melodic[3]=sound('layers-amplitude-tags',3,t=>{const i=Math.min(5,Math.floor(t/.5)),u=t-i*.5,a=levels[i],old=i?levels[i-1]:a;return (u<.003?old+(a-old)*u/.003:a)*Math.sin(2*Math.PI*997*t);});
  function tone(p,slot){note(p,1,slot,5,{timing:12});}
  function spans(p,items){const a=Array(16).fill(null);for(const [kind,first,last] of items)for(let i=first;i<=last;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
  tone(1,1);section(1,'997Hz dry reference','3s fixed-amplitude tone, one-second tail-clear interval.');
  for(const [p,kind] of [[2,5],[3,6]]){tone(p,1);spans(p,[[kind,1,12]]);section(p,'997Hz FX'+kind+' before note','Three-second analysis window resolves individual layer frequencies and levels.');}
  for(const [p,kind] of [[4,5],[5,6]]){tone(p,1);spans(p,[[kind,3,10]]);section(p,'997Hz ringing entry FX'+kind,'Dry0–0.5s, effected0.5–2.5s, dry2.5–3s. Detects layer phase/gain continuity.');}
  tone(6,1);spans(6,[[5,3,6],[6,7,10]]);section(6,'997Hz Unison to Low','FX5 at0.5s, FX6 at1.5s, off2.5s; same note, no retrigger.');
  tone(7,2);section(7,'Rising chirp dry','997→1994Hz over3s. Wider separated layer ridges than earlier low-frequency sources.');
  for(const [p,kind,first] of [[8,5,1],[9,5,3],[10,5,5],[11,6,3]]){tone(p,2);spans(p,[[kind,first,10]]);section(p,'Rising chirp FX'+kind+' entry'+((first-1)*.25)+'s','Single note; compares source-head restart with retained read position and layer rates. Off at2.5s.');}
  tone(12,3);section(12,'Falling chirp dry','1994→997Hz over3s, complementary trajectory for reader-rate estimation.');
  for(const [p,kind] of [[13,5],[14,6]]){tone(p,3);spans(p,[[kind,3,10]]);section(p,'Falling chirp ringing entry FX'+kind,'FX at0.5–2.5s; reversed frequency slope disambiguates pitch ratio from cursor offset.');}
  tone(15,2);spans(15,[[5,3,6],[6,7,10]]);section(15,'Rising chirp FX5 to6','FX5 at0.5s, FX6 at1.5s, off2.5s. Tests inter-effect cursor and rate inheritance.');
  tone(16,4);spans(16,[[5,3,10]]);section(16,'Amplitude-tagged997Hz Unison','Six known half-second amplitude levels, smoothed3ms boundaries, FX5 at0.5–2.5s. Adds read-position landmarks independent of pitch.');
  fs.writeFileSync(path.join(out,'layers-source.json'),JSON.stringify({fixedHz:997,seconds:3,upStartHz:997,upEndHz:1994,downStartHz:1994,downEndHz:997,tagPeriodSeconds:.5,tagAmplitudes:levels},null,2));
  allowedFX=[5,6];
 }else if(profile==='unison-order'){
  [233,349,487,653].forEach((hz,i)=>{model.melodic[i]=sound('order-tone-'+hz,2.5,t=>.13*Math.sin(2*Math.PI*hz*t));});
  const k=Math.log(4)/3;model.melodic[4]=sound('order-chirp',3,t=>.13*Math.sin(2*Math.PI*220/k*(Math.exp(k*t)-1)));
  function tone(p,slot,step=1,length=12){note(p,step,slot,5,{timing:length});}
  function effect(p,kind,first=4,last=7){fx(p,kind,first,last);}
  const cases=[[1,2,1,0],[2,2,1,5],[3,1,2,5],[4,4,1,5],[5,4,3,5],[6,1,4,5],[7,2,1,6],[8,1,2,6]];
  for(const [p,first,second,kind] of cases){tone(p,first);tone(p,second,2);if(kind)effect(p,kind);section(p,'Arrival '+first+' then '+second+(kind?' FX'+kind:' dry'),'First source0s, second0.25s; FX0.75–1.75s. Distinguishes arrival order, lowest slot and last selected source. No pitch locks.');}
  for(const [p,order] of [[9,[4,3,2,1]],[10,[1,2,3,4]]]){order.forEach((slot,i)=>tone(p,slot,i+1,8));effect(p,5,5,8);section(p,'Four-source order '+order.join('→'),'Sources enter0/0.25/0.5/0.75s, FX5 at1–2s. Every original gate remains2s from its own onset.');}
  tone(11,5);effect(11,5,1,8);section(11,'Single chirp Unison from onset','Three-second rising pure chirp; FX5 on0–2s, followed by release. Reference for four reader rates.');
  for(const [p,kind,first,last] of [[12,5,3,6],[13,5,5,8],[14,6,3,6]]){tone(p,5);effect(p,kind,first,last);section(p,'Single chirp FX'+kind+' entry'+((first-1)*.25)+'s','Same source with different effect entry time; identifies current-cursor continuation versus source-head restart and rate changes.');}
  tone(15,5);tone(15,3,2);effect(15,5);section(15,'Chirp first, fixed tone second','Chirp0s,487Hz0.25s; FX5 at0.75–1.75s. Identifies both source identity and reader position.');
  tone(16,3);tone(16,5,2);effect(16,5);section(16,'Fixed tone first, chirp second','487Hz0s, chirp0.25s; same FX interval as P15. All sources/gates end before next pattern.');
  allowedFX=[5,6];
 }else if(profile==='unison-memory'){
  const rate=23437.5,k=Math.log(4)/4;
  const full=sound('memory-chirp',4,t=>.14*Math.sin(2*Math.PI*220/k*(Math.exp(k*t)-1)));
  const offset={...full,start:Math.round(rate),end:Math.round(rate*3)};
  const codes=library.get(full.sampleId).slice(offset.start,offset.end);
  library.set('memory-independent',codes.slice());
  const independent={sampleId:'memory-independent',start:0,end:codes.length};
  model.melodic[0]={...full,end:Math.round(rate*2)};
  model.melodic[1]=offset;model.melodic[2]=independent;model.melodic[3]=full;
  function tone(p,slot,step=1){note(p,step,slot,5,{timing:12});}
  function effect(p,kind,first=3,last=6){fx(p,kind,first,last);}
  for(const [p,slot] of [[1,2],[2,3]]){tone(p,slot);section(p,'PCM-identical dry '+(slot===2?'shared offset':'independent'),'Source1–3 seconds from the same original chirp; selected PCM is byte-identical. Only backing allocation differs.');}
  for(const [p,slot] of [[3,2],[4,3]]){tone(p,slot);effect(p,5,1,6);section(p,'Unison note-on '+(slot===2?'shared offset':'independent'),'FX5 active before note; release1.5s. Compares identical content at different absolute memory offsets.');}
  for(const [p,slot,kind] of [[5,2,5],[6,3,5],[7,2,6],[8,3,6]]){tone(p,slot);effect(p,kind);section(p,'Ringing entry FX'+kind+' '+(slot===2?'shared offset':'independent'),'Note0s; effect0.5–1.5s, then off. Detect restart, retained cursor, reads before trim start and allocation boundaries.');}
  for(const [p,slots,label] of [[9,[1,2],'shared backing / different starts'],[10,[1,3],'independent replacement for P09 second source'],[11,[2,3],'identical selected content / different backing']]){
   slots.forEach(slot=>tone(p,slot));effect(p,5);section(p,'Two ringing sources: '+label,'FX5 enters0.5s, exits1.5s. Source identities and read positions differ without adding pitch locks.');
  }
  tone(12,3);tone(12,2,2);effect(12,5);section(12,'Reversed arrival: independent then shared','Independent starts0s, shared offset starts0.25s, FX5 enters0.5s. Tests arrival identity rather than ascending slot order.');
  tone(13,4);effect(13,3,5,10);section(13,'Full-source held Loop3','Four-second chirp with3s gate, FX3 at1–2.5s. No new notes during effect.');
  for(const [p,slot,label] of [[14,1,'zero-offset shared'],[15,2,'nonzero-offset shared'],[16,3,'independent matched copy']]){tone(p,slot);effect(p,3);section(p,'Held Loop3 '+label,'FX3 at0.5–1.5s, selected source2s, gate3s; compare read origin, recapture and release.');}
  const selected=library.get(full.sampleId).slice(offset.start,offset.end);
  if(!selected.every((v,i)=>v===library.get(independent.sampleId)[i]))throw Error('Independent PCM must match shared selection');
  fs.writeFileSync(path.join(out,'memory-source.json'),JSON.stringify({sourceRate:rate,full,offset,independent,identicalSelectedPCM:true,slots:model.melodic.slice(0,4),sourceStartHz:220,sourceEndHz:880},null,2));
  allowedFX=[3,5,6];
 }else if(profile==='voice-priority'){
  const hz=[233,349,487,653,887];
  hz.forEach((f,i)=>{model.melodic[i]=sound('priority-sine-'+f,3.5,t=>.13*Math.sin(2*Math.PI*f*t));});
  const k=Math.log(4)/3.5;
  model.melodic[5]=sound('priority-position',3.5,t=>.13*Math.sin(2*Math.PI*220/k*(Math.exp(k*t)-1)));
  function schedule(p,spans){const a=Array(16).fill(null);for(const [kind,first,last] of spans)for(let i=first;i<=last;i++)a[i-1]=kind;writeEffects(model.patterns[p-1],a);}
  function tone(p,step,slot,length=12){note(p,step,slot,5,{timing:length});}
  function group(p,slots,lengths){slots.forEach((slot,i)=>tone(p,1,slot,lengths?lengths[i]:12));}
  for(let p=1;p<=3;p++){tone(p,1,6);if(p>1)schedule(p,[[p===2?5:6,1,12]]);section(p,['','Chirp dry','Unison before note','Unison Low before note'][p],'Pure increasing chirp, twelve-step gate (3 seconds). Single source; final second allows tails to clear.');}
  for(const [p,kind] of [[4,5],[5,6]]){tone(p,1,6);schedule(p,[[kind,5,10]]);section(p,'Ringing chirp enters FX'+kind,'Note at0s, effect1–2.5s, then release. Separates original reader position from additional copy starts.');}
  tone(6,1,6);schedule(6,[[5,5,8],[6,9,12]]);section(6,'Ringing chirp Unison to Low','FX5 at1s, FX6 at2s, off at3s. No new note during changes.');
  for(const [p,kind] of [[7,5],[8,6]]){group(p,[1,2]);schedule(p,[[kind,5,12]]);section(p,'Two ringing sine slots enter FX'+kind,'Distinct233/349Hz sources before effect entry; free channels versus occupied channels are distinguishable.');}
  group(9,[1,2,3,4]);schedule(9,[[5,5,8],[6,9,12]]);section(9,'Four occupied channels enter FX5 then6','Four unrelated sine frequencies, no shared PCM or harmonic ambiguity.');
  group(10,[1,2,3,4,5],[4,4,4,4,4]);section(10,'Five simultaneous dry notes','All five pure tones have1s gates. Tests initial channel admission without harmonic overlap.');
  group(11,[1,2,3,4],[4,8,12,12]);tone(11,3,5,12);section(11,'Priority resume versus dropped note','Fifth tone arrives0.5s; original channels expire at1/2/3s. Fifth gate ends3.5s. Detect whether it becomes audible later.');
  group(12,[4,3,2,1],[4,8,12,12]);tone(12,3,5,12);section(12,'Reverse slot order / same expiries','Reverse source identities with same gate-expiry order as P11; separates slot priority from arrival order.');
  group(13,[1,2,3,4]);tone(13,5,1,4);tone(13,7,5,4);section(13,'Same-slot replacement frees channel','Slot1 restarts at1s and ends2s; fifth starts1.5s and ends2.5s. Other initial notes end3s.');
  group(14,[1,2]);tone(14,5,3,4);schedule(14,[[5,1,12]]);section(14,'Unison note-on then third slot','Effect precedes first notes. A new distinct487Hz source enters1s later.');
  group(15,[1,2,3,4]);tone(15,5,5,4);schedule(15,[[5,1,12]]);section(15,'Unison four slots then fifth','Effect active before note-on, fifth887Hz slot enters at1s. Compare with P09 active entry.');
  tone(16,1,6,15);schedule(16,[[3,5,12]]);section(16,'Held-source Loop3 boundary','Chirp starts dry, Loop3 enters at1s on an empty step, exits3s; source3.5s, no cross-pattern tail.');
  allowedFX=[3,5,6];
 }else if(profile==='unison'){
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
 }else if(profile==='mixed-voices'){
  const base=rich('mix-voice-110',110);for(let i=0;i<5;i++)model.melodic[i]={...base};
  const k=Math.log(8)/6;
  model.melodic[5]=sound('mix-position-chirp',6,t=>{const phase=2*Math.PI*220/k*(Math.exp(k*t)-1);return .12*(Math.sin(phase)+.25*Math.sin(2*phase));});
  function held(p){note(p,1,6,5,{timing:15});}
  function pair(p,a,b){const effects=Array(16).fill(null);for(let i=4;i<8;i++)effects[i]=a;for(let i=8;i<12;i++)effects[i]=b;writeEffects(model.patterns[p-1],effects);}
  held(1);section(1,'Dry position reference','Six-second chirp; next pattern retriggers the same slot to choke the tail.');
  const pairs=[[1,2],[3,4],[11,12],[5,6],[7,8],[1,11],[11,5],[15,1]];
  pairs.forEach(([a,b],i)=>{const p=i+2;held(p);pair(p,a,b);section(p,'Held source '+a+'→'+b+'→off','Single note only. Dry0–1s; first FX1–2s; second FX2–3s; off3–4s. Changes in source position and tails remain audible.');});
  note(10,1,6,5,{timing:1});section(10,'Tail cleanup / separation','A dry quarter-second gate on the chirp slot chokes prior tails, followed by silence before voice tests.');
  const pitch=[13,16,18,21,24];
  function stagger(p,order){order.forEach((slot,i)=>note(p,i+1,slot,5,{timing:8,pitch:pitch[slot-1]}));note(p,5,5,5,{timing:8,pitch:pitch[4]});}
  stagger(11,[1,2,3,4]);section(11,'Oldest voice stealing','Four slots enter at0/0.25/0.5/0.75s; slot5 at1s. Each gate is2s and each slot has a distinct pitch.');
  stagger(12,[4,3,2,1]);section(12,'Reverse arrival order','Same pitches as P11, reversed arrival order distinguishes oldest-first stealing from fixed slot priority.');
  for(let slot=1;slot<=4;slot++)note(13,slot,slot,5,{timing:8,pitch:pitch[slot-1]});note(13,5,1,5,{timing:8,pitch:25});note(13,7,5,5,{timing:8,pitch:pitch[4]});section(13,'Same-slot choke before a fifth slot','Slot1 retriggers at1s with new pitch; slot5 joins at1.5s. Identifies which other voice survives.');
  for(let slot=1;slot<=5;slot++)note(14,1,slot,5,{timing:8,pitch:pitch[slot-1]});section(14,'Five simultaneous notes','All five slots start on the same step; gates end at2s. Tests event-order versus allocator priority.');
  for(let slot=1;slot<=4;slot++)note(15,1,slot,5,{timing:12,pitch:pitch[slot-1]});pair(15,5,6);section(15,'Four ringing voices →Unison→Low→off','Four existing voices before FX entry at1s, switch at2s, release/gate end at3s; distinct from FX active before note-on.');
  stagger(16,[1,2,3,4]);section(16,'Dry voice end reference','Identical to P11; all gates end before the next chain cycle.');allowedFX=[1,2,3,4,5,6,7,8,11,12,15];
 }else if(profile==='loop-source'){
  const durations=[.16,.4,1,2],silent=sound('loop-source-silence',.02,()=>0),k=Math.log(8)/2;
  durations.forEach((seconds,i)=>{const take=sound('loop-source-'+i,seconds,t=>.2*(.5+t/4)*Math.sin(2*Math.PI*220/k*(Math.exp(k*t)-1)));model.drums[i]={slices:Array.from({length:16},(_,pad)=>({...(pad===15?silent:take)}))};});
  for(let p=1;p<=16;p++){const i=(p-1)%4,group=Math.floor((p-1)/4),kind=[0,1,2,4][group];note(p,1,9+i,1);note(p,16,9+i,16);if(kind)fx(p,kind,1,12);section(p,'Single source '+durations[i]+'s '+(kind?'FX'+kind:'dry'),'One initial note only; effect off at3s, valid silent pad at3.75s chokes any remaining tail. No intervening note can change the capture.');}allowedFX=[1,2,4];
 }else if(profile==='loops'){
  const slices=Array.from({length:16},(_,i)=>{const f=220+55*i;return sound('loop-marker-'+i,.16,t=>.22*Math.sin(2*Math.PI*f*t)*Math.exp(-t/.035)+.055*Math.sin(2*Math.PI*f*2.7*t)*Math.exp(-t/.009));});
  model.drums[0]={slices};
  function grid(p,holes=false){for(let i=0;i<16;i++)if(!holes || i%2===0)note(p,i+1,9,i+1);}
  grid(1);section(1,'Unique marker dry','Sixteen different slice tones220–1045Hz; every step has a unique identity.');
  for(let kind=1;kind<=4;kind++){grid(kind+1);fx(kind+1,kind,5,12);section(kind+1,'Loop'+kind+' / even-index entry','FX5–12. Tests whether normal steps continue, repeat window and recapture boundaries.');grid(kind+5);fx(kind+5,kind,6,13);section(kind+5,'Loop'+kind+' / odd-index entry','FX6–13. Distinguishes global clock phase from effect-relative phase.');}
  grid(10,true);section(10,'Alternating silence dry','Only odd numbered steps contain unique tone markers.');
  for(let kind=1;kind<=4;kind++){grid(kind+10,true);fx(kind+10,kind,5,12);section(kind+10,'Loop'+kind+' / alternating silence','FX5–12, empty even steps; checks which source is captured and whether silence clears it.');}
  grid(15);writeEffects(model.patterns[14],Array.from({length:16},(_,i)=>1+Math.floor(i/4)));section(15,'Loop1→2→3→4','Unique markers, four steps per effect.');grid(16);section(16,'Unique marker end reference','Identical to P01.');allowedFX=[1,2,3,4];
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
 const manifest={profile:profile==='clock-phase'?'clock-phase-v17':profile==='ownership-phase'?'ownership-phase-v16':profile==='history-boundaries'?'history-boundaries-v15':profile==='unison-layers'?'unison-layers-v14':profile==='unison-order'?'unison-order-v13':profile==='unison-memory'?'unison-memory-v12':profile==='voice-priority'?'voice-priority-v11':profile==='mixed-voices'?'mixed-voices-v10':profile==='unison'?'unison-v6':profile==='loops'?'loops-v8':profile==='loop-source'?'loop-sources-v9':'other-fx-v7',bpm:model.tempo,allowedFX,cells,...(expectedOwners?{expectedOwners}:{}),notes:'Original synthesized sources; hardware capture pending. FX14 requires a separate sync test.'};
 fs.writeFileSync(path.join(out,'fx-source.json'),JSON.stringify(manifest,null,2));return manifest;
}
