(function(root){
  class Sync {
    constructor(ctx,bus,onEvent){this.ctx=ctx;this.bus=bus;this.onEvent=onEvent;this.mode=0;this.gain=.7;this.bpm=120;this.generation=0;this.active=false;}
    async init(){if(this.node)return;if(this.pending)return this.pending;this.pending=(async()=>{await this.ctx.audioWorklet.addModule(root.PO33_RESOURCE?root.PO33_RESOURCE('./po33-sync-worklet.js'):'./po33-sync-worklet.js');this.node=new AudioWorkletNode(this.ctx,'po33-sync',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});this.node.port.onmessage=({data})=>{if(this.active)this.onEvent(data);};this.route();})();return this.pending;}
    route(){try{this.bus.disconnect(this.ctx.destination);}catch{}if(this.split)this.split.disconnect();if(this.mono){try{this.bus.disconnect(this.mono);}catch{}this.mono.disconnect();}if(this.merger)this.merger.disconnect();if(this.node)this.node.disconnect();
      if(!this.mode){this.bus.connect(this.ctx.destination);return;}
      this.mono=this.ctx.createGain();this.mono.channelCount=1;this.mono.channelCountMode='explicit';this.bus.connect(this.mono);
      this.merger=this.ctx.createChannelMerger(2);this.split=this.ctx.createChannelSplitter(2);this.node.connect(this.split);
      this.mono.connect(this.merger,0,1);this.split.connect(this.merger,1,1);
      if([1,3,5].includes(this.mode))this.split.connect(this.merger,0,0);else{this.mono.connect(this.merger,0,0);this.split.connect(this.merger,1,0);}
      this.merger.connect(this.ctx.destination);this.config();
    }
    config(){this.node?.port.postMessage({type:'config',mode:this.mode,bpm:this.bpm,gain:this.gain});}
    async setMode(mode){if(!Number.isInteger(mode)||mode<0||mode>5)throw Error("Invalid sync mode");this.stop();await this.init();this.mode=mode;this.route();}
    async start(time,bpm,inputId){const token=++this.generation;await this.init();this.bpm=bpm;this.config();
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
})(window);
