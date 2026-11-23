/* Decode M4A containers without routing audio through the device mixer. */
(function(root){
  function info(buffer){
    const v=new DataView(buffer);let rate=0;
    const text=(p,n)=>String.fromCharCode(...new Uint8Array(buffer,p,n));
    function boxes(start,end){const out=[];for(let p=start;p+8<=end;){let n=v.getUint32(p),head=8;if(n===1){if(p+16>end)throw Error('Invalid M4A atom');n=v.getUint32(p+8)*4294967296+v.getUint32(p+12);head=16;}if(n===0)n=end-p;if(n<head||p+n>end)throw Error('Invalid M4A atom');out.push({type:text(p+4,4),start:p+head,end:p+n});p+=n;}return out;}
    const moov=boxes(0,buffer.byteLength).find(b=>b.type==='moov');
    if(!moov)throw Error('Invalid M4A container');
    for(const track of boxes(moov.start,moov.end).filter(b=>b.type==='trak')){
      const media=boxes(track.start,track.end).find(b=>b.type==='mdia');if(!media)continue;
      const children=boxes(media.start,media.end),handler=children.find(b=>b.type==='hdlr'),header=children.find(b=>b.type==='mdhd');
      if(handler && handler.start+12<=handler.end && text(handler.start+8,4)==='soun' && header){const offset=header.start+(v.getUint8(header.start)===1?20:12);if(offset+4<=header.end)rate=v.getUint32(offset);break;}
    }
    if(![44100,48000].includes(rate))throw Error('Backup M4A must be recorded at 44.1 or 48 kHz');
    return {sampleRate:rate};
  }
  async function decode(buffer){
    const {sampleRate}=info(buffer),Context=root.OfflineAudioContext||root.webkitOfflineAudioContext;
    if(!Context)throw Error('This browser cannot decode M4A; export a stereo PCM WAV instead');
    const context=new Context(2,1,sampleRate);let audio;
    try{audio=await new Promise((resolve,reject)=>{const result=context.decodeAudioData(buffer.slice(0),resolve,reject);if(result&&result.then)result.then(resolve,reject);});}
    catch(error){return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./alac-worker.js',document.baseURI));
      const timer=setTimeout(()=>{worker.terminate();reject(Error('M4A decoding timed out'));},60000);
      worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(Error(data.error)):resolve(data.pcm);};
      worker.onerror=(event)=>{clearTimeout(timer);worker.terminate();reject(Error('M4A decoder unavailable; use stereo PCM WAV: '+event.message));};
      worker.postMessage({buffer,sampleRate},[buffer]);
    });}
    if(audio.numberOfChannels!==2)throw Error('PO-33 backup requires two independent stereo channels');
    if(audio.sampleRate!==sampleRate)throw Error('M4A sample rate changed during decoding');
    return {left:audio.getChannelData(0).slice(),right:audio.getChannelData(1).slice(),sampleRate};
  }
  root.PO33BackupAudio={decode,info};
})(globalThis);
