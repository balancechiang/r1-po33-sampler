import {decodePO33Backup,encodePO33Backup,transferTimeline,parseWavStereo} from './decoder/browser/src/codec/po33Codec.js';
import {buildHardwareProject} from './decoder/browser/src/codec/po33WebProject.js';
self.onmessage=({data:m})=>{
  try{
    if(m.command==='decode'){
      const project=decodePO33Backup(m.wav || m.pcm,{onProgress:(phase,completed,total)=>self.postMessage({type:'progress',phase,completed,total})});
      self.postMessage({type:'decoded',project});
    }else if(m.command==='encode'){
      const built=buildHardwareProject(m.snapshot,m.native,m.baseline);
      const wav=encodePO33Backup(built,m.rate || 44100,p=>self.postMessage({type:'progress',...p}));
      // Validate the emitted signal, not only the state used to construct it.
      const decoded=decodePO33Backup(wav);
      const audio=parseWavStereo(wav);
      self.postMessage({type:'encoded',wav,rate:audio.sampleRate,left:audio.leftChannel,right:audio.rightChannel,
        timeline:transferTimeline(built.raw.state,audio.sampleRate),warnings:built.warnings,packets:decoded.validation.packetCount},[wav,audio.leftChannel.buffer,audio.rightChannel.buffer]);
    }else throw Error('Unknown transfer request');
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
