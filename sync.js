(function(root){
  // Position is separate from the audible FX cursor. Audio clocks do not carry
  // pattern-position resets, so an FX must never move this background timeline.
  class Timeline {
    constructor(time,bpm,pattern,external){this.time=time;this.position=0;this.duration=15/bpm;this.bpm=bpm;this.pattern=pattern;this.external=external;this.ready=!external;this.pulses=0;}
    at(time){return this.position+(time-this.time)/this.duration;}
    tempo(bpm,time){if(this.external||bpm===this.bpm)return;this.position=this.at(time);this.time=time;this.duration=15/bpm;this.bpm=bpm;}
    pulse(time,period){this.position=this.pulses*2;this.pulses++;this.time=time;this.duration=period/2;this.ready=true;}
    point(index,order){const list=order.length?order:[this.pattern],chain=Math.floor(index/16)%list.length;return {index,step:index%16,chain,pattern:list[chain],time:this.time+(index-this.position)*this.duration};}
    frame(time,order){if(!this.ready)return null;const position=Math.max(0,this.at(time)),index=Math.floor(position+1e-7);return {...this.point(index,order),phase:position-index};}
    next(time,order,division=1){if(!this.ready)return null;if(this.at(time)<0)return this.time;const position=Math.max(0,this.at(time)),index=Math.floor(position*division+1e-7)+1;return this.time+(index/division-this.position)*this.duration;}
  }
  class Sync {
    constructor(ctx,bus,onEvent){this.ctx=ctx;this.bus=bus;this.onEvent=onEvent;this.mode=0;this.gain=.7;this.bpm=120;this.generation=0;this.active=false;this.outputNeedsPrime=true;}
    playbackSession(){try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}}
    async prepareOutput(token){
      // Select the output category before resume; microphone teardown can otherwise
      // leave iOS on its capture route until a physical adapter reconnect.
      this.playbackSession();
      const destination=this.ctx.destination;
      if(destination.maxChannelCount && destination.maxChannelCount<2)throw Error('Sync needs a stereo output');
      destination.channelCount=2;
      const resume=this.ctx.resume();
      let timer;
      try{await Promise.race([resume,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio output did not resume. Tap PLAY to retry.')),1800);})]);}finally{clearTimeout(timer);}
      if(token!==this.generation)return false;
      if(this.ctx.state!=='running')throw Error('Audio output is not running. Tap PLAY to retry.');
      if(this.outputNeedsPrime){
        // Render silence through the actual stereo output, without sending
        // clock pulses or advancing music while the USB route settles.
        const buffer=this.ctx.createBuffer(2,Math.ceil(this.ctx.sampleRate*.12),this.ctx.sampleRate),source=this.ctx.createBufferSource();
        source.buffer=buffer;source.connect(destination);source.start();
        await new Promise(resolve=>setTimeout(resolve,140));source.disconnect();
        if(token!==this.generation)return false;
        this.playbackSession();this.outputNeedsPrime=false;
      }
      return true;
    }
    async init(){if(this.node)return;if(this.pending)return this.pending;this.pending=(async()=>{await this.ctx.audioWorklet.addModule(root.PO33_RESOURCE?root.PO33_RESOURCE('./sync-worklet.js'):'./sync-worklet.js');this.node=new AudioWorkletNode(this.ctx,'po33-sync',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});this.node.port.onmessage=({data})=>{if(this.active)this.onEvent(data);};this.route();})();return this.pending;}
    route(){try{this.bus.disconnect(this.ctx.destination);}catch{}if(this.split)this.split.disconnect();if(this.mono){try{this.bus.disconnect(this.mono);}catch{}this.mono.disconnect();}if(this.merger)this.merger.disconnect();if(this.node)this.node.disconnect();
      if(!this.mode){this.bus.connect(this.ctx.destination);return;}
      this.mono=this.ctx.createGain();this.mono.channelCount=1;this.mono.channelCountMode='explicit';this.bus.connect(this.mono);
      this.merger=this.ctx.createChannelMerger(2);this.split=this.ctx.createChannelSplitter(2);this.node.connect(this.split);
      this.mono.connect(this.merger,0,1);this.split.connect(this.merger,1,1);
      if([1,3,5].includes(this.mode))this.split.connect(this.merger,0,0);else{this.mono.connect(this.merger,0,0);this.split.connect(this.merger,1,0);}
      this.merger.connect(this.ctx.destination);this.config();
    }
    config(){this.node?.port.postMessage({type:'config',mode:this.mode,bpm:this.bpm,gain:this.gain});}
    async setMode(mode){if(!Number.isInteger(mode)||mode<0||mode>5)throw Error("Invalid sync mode");this.stop();if(mode===1)this.playbackSession();await this.init();this.mode=mode;this.outputNeedsPrime=true;this.route();}
    async start(time,bpm,inputId){const token=++this.generation;const outputReady=this.mode===1?this.prepareOutput(token):null;const ready=await Promise.all([this.init(),outputReady]);if(outputReady && !ready[1])return false;if(token!==this.generation)return false;this.bpm=bpm;this.config();
      if(this.mode>=2){let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:inputId?{exact:inputId}:undefined,channelCount:{exact:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false}});}catch(e){throw Error('Stereo sync input unavailable: '+e.message);}
        if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
        if(stream.getAudioTracks()[0].getSettings().channelCount!==2){stream.getTracks().forEach(t=>t.stop());throw Error('Sync requires verified stereo input');}
        this.stream=stream;this.source=this.ctx.createMediaStreamSource(stream);this.source.connect(this.node);
      }
      if(token!==this.generation)return false;this.active=true;this.startTime=Math.max(time,this.ctx.currentTime+.04);this.node.port.postMessage({type:'start',time:this.startTime});return true;
    }
    stop(){this.generation++;this.active=false;this.node?.port.postMessage({type:'stop'});this.source?.disconnect();this.source=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
  }
  root.PO33Sync=Sync;
  root.PO33SyncTimeline=Timeline;
})(window);
