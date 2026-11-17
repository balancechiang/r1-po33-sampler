// Original procedural test tone + four-note pattern, CC0-1.0. No hardware recording.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {encodePO33Backup,decodePO33Backup}=await import('../../src/codec/po33Codec.ts');
 const {EMPTY_GLOBALS}=await import('../../src/codec/po33Template.ts');
 const {emptyPattern,writeCell,DEFAULT_PARAMETERS}=await import('../../decoder/vendor/so-sample/pattern.ts');
 const {encodeMulaw,SAMPLE_RATE}=await import('../../decoder/vendor/so-sample/mulaw.ts');
 const pcm=Float32Array.from({length:4096},(_,i)=>.5*Math.sin(2*Math.PI*220*i/SAMPLE_RATE)*Math.sin(Math.PI*i/4095)**2);
 const state={globals:EMPTY_GLOBALS.map(g=>Uint8Array.from(g)),patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)};
 state.globals[1][129]=108;state.globals[1][130]=0;
 state.sounds[0]={start:0,end:pcm.length,owner:0,codes:encodeMulaw(pcm)};
 [0,4,7,12].forEach((note,k)=>writeCell(state.patterns[0],k*4+1,1,{...DEFAULT_PARAMETERS,key:note+1}));
 const wav=encodePO33Backup({raw:{state}}),project=decodePO33Backup(wav);
 if(project.meta.bpm!==108 || project.patterns[0].steps.reduce((n,s)=>n+s.triggers.length,0)!==4)throw Error('Test backup verification failed');
 fs.writeFileSync(path.join(__dirname,'po33-backup.wav'),Buffer.from(wav));
 console.log('Verified original test backup: one 220 Hz sample, pattern1 with four notes, 108 BPM; all packet CRCs pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
