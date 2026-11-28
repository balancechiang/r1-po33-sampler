class PO33SyncProcessor extends AudioWorkletProcessor {
  constructor(){super();this.mode=0;this.run=false;this.next=Infinity;this.width=0;this.gain=.7;this.bpm=120;this.high=false;this.last=-Infinity;this.period=sampleRate*.25;this.seen=false;
    // Before two input edges establish tempo, interpolate using the current BPM.
    // Reset on every start so a previous connection cannot seed the new run.
    this.port.onmessage=({data:d})=>{if(d.type==='config'){this.mode=d.mode;this.bpm=d.bpm;this.gain=d.gain;}if(d.type==='start'){this.period=sampleRate*30/this.bpm;this.run=true;this.next=d.time*sampleRate;this.last=-Infinity;this.seen=false;this.high=false;}if(d.type==='stop'){this.run=false;this.width=0;this.next=Infinity;}};
  }
  process(inputs,outputs){const out=outputs[0],input=inputs[0]||[],left=input[0],right=input[1];
    for(let i=0;i<out[0].length;i++){const frame=currentFrame+i;let pulse=0;
      if(this.run&&this.mode===1&&frame>=this.next){this.width=Math.round(sampleRate*.003);this.next+=sampleRate*30/this.bpm;}
      if(this.run&&this.mode>=2){const x=left?left[i]:0;
        if(!this.high&&x>=.3){this.high=true;if(frame-this.last>=sampleRate*.08){const delta=frame-this.last;if(this.seen&&delta<sampleRate*.8)this.period=delta;this.last=frame;this.seen=true;this.width=Math.round(sampleRate*.003);this.port.postMessage({type:'pulse',time:frame/sampleRate,period:this.period/sampleRate});}}
        else if(this.high&&x<=.1)this.high=false;
        if(this.seen&&frame-this.last>Math.max(sampleRate*.85,this.period*2.5)){this.seen=false;this.port.postMessage({type:'timeout'});}
      }
      if(this.run&&this.width>0){pulse=this.gain;this.width--;}
      out[0][i]=[1,3,5].includes(this.mode)?pulse:0;
      out[1][i]=this.run&&this.mode>=4&&right?right[i]:0;
    }return true;
  }
}
registerProcessor('po33-sync',PO33SyncProcessor);
