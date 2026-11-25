import {decodePO33Backup,decodePO33Frame,encodePO33Backup,transferTimeline,parseWavStereo} from './decoder/browser/src/codec/po33Codec.js?v=flowers-20261120-ui30';
import {projectFromJSON,projectToJSON} from './decoder/browser/src/codec/po33JSON.js?v=flowers-20261120-ui30';
import {encodePO33Frame} from './decoder/browser/src/codec/po33Encode.js?v=flowers-20261120-ui30';
import {buildHardwareProject} from './decoder/browser/src/codec/po33WebProject.js?v=flowers-20261120-ui30';
import './project-compression.js?v=flowers-20261120-ui30';
self.onmessage=async({data:m})=>{
  try{
    if(m.command==='decode'){
      const project=m.filename?.endsWith('.po33.gz')?decodePO33Frame(await globalThis.PO33ProjectCompression.unpackFrame(new Uint8Array(m.wav))):m.filename?.endsWith('.po33frame')?decodePO33Frame(new Uint8Array(m.wav)):m.filename?.toLowerCase().endsWith('.json')?projectFromJSON(new TextDecoder('utf-8',{fatal:true}).decode(m.wav)):decodePO33Backup(m.wav || m.pcm,{onProgress:(phase,completed,total)=>self.postMessage({type:'progress',phase,completed,total})});
      self.postMessage({type:'decoded',project});
    }else if(m.command==='export-json'){
      const built=buildHardwareProject(m.snapshot,m.native,m.baseline);
      const project=decodePO33Frame(encodePO33Frame(built.raw.state));
      const buffer=new TextEncoder().encode(projectToJSON(project)).buffer;
      self.postMessage({type:'json-exported',buffer},[buffer]);
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
