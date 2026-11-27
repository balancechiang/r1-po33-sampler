/* Original PO-33-style DSP approximations. Official names do not specify
   firmware algorithms; tuning choices below are documented in FX.md. */
(function(root,factory){
  if(typeof module==="object" && module.exports)module.exports=factory();
  else root.PO33FX=factory();
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  var names=["NO EFFECT","LOOP 16","LOOP 12","LOOP SHORT","LOOP SHORTER",
    "UNISON","UNISON LOW","OCTAVE UP","OCTAVE DOWN","STUTTER 8","STUTTER 6",
    "SCRATCH","SCRATCH FAST","6/8 QUANTIZE","RETRIGGER PATTERN","REVERSE","NO EFFECT"];
  function wrap(x,n){return ((x%n)+n)%n;}
  function read(data,pos){
    pos=wrap(pos,data.length);var i=Math.floor(pos),f=pos-i;
    return data[i]*(1-f)+data[(i+1)%data.length]*f;
  }
  function Engine(rate){
    this.sampleRate=rate;this.history=new Float32Array(Math.ceil(rate*5));
    this.write=0;this.filled=0;this.kind=0;this.loop=null;this.pos=0;
    this.grainPhase=0;this.scratchPhase=0;this.stepSamples=rate*.125;
    this.pending=false;this.waitingForSignal=false;this.last=0;this.transition=0;this.requested=0;
  }
  Engine.prototype.capture=function(){
    var n=Math.min(this.filled,this.requested);
    if(n<64){this.pending=true;return;}
    var out=new Float32Array(n),peak=0,first=-1;
    for(var i=0;i<n;i++){
      out[i]=this.history[wrap(this.write-n+i,this.history.length)];peak=Math.max(peak,Math.abs(out[i]));
      if(first<0 && Math.abs(out[i])>1e-7)first=i;
    }
    // A press at startup must not freeze the unwritten/silent pre-roll forever.
    if(peak<1e-7){this.pending=true;this.waitingForSignal=true;return;}
    if(first>0 && (this.waitingForSignal || this.filled<this.requested))out=out.slice(first);
    this.waitingForSignal=false;
    this.loop=out;this.pos=0;this.pending=false;
  };
  Engine.prototype.engage=function(kind,stepSeconds){
    this.kind=kind>=1&&kind<=15?kind:0;
    this.stepSamples=Math.max(1,stepSeconds*this.sampleRate);
    this.loop=null;this.pending=false;this.waitingForSignal=false;this.pos=0;this.scratchPhase=0;
    this.transition=Math.max(1,Math.round(this.sampleRate*.005));
    var steps={1:16,2:12,3:4,4:2,11:4,12:4};
    this.requested=steps[kind]?Math.round(this.stepSamples*steps[kind]):0;
    if(this.requested){this.pending=true;this.capture();}
  };
  Engine.prototype.setStepDuration=function(seconds){var next=Math.max(1,seconds*this.sampleRate);if((this.kind===9 || this.kind===10) && this.stepSamples)this.pos*=next/this.stepSamples;this.stepSamples=next;};
  Engine.prototype.release=function(){this.kind=0;this.loop=null;this.pending=false;};
  Engine.prototype.pitch=function(ratio){
    var span=Math.round(this.sampleRate*.04),base=Math.round(this.sampleRate*.012);
    var p=this.grainPhase,p2=(p+.5)%1;
    var w=.5-.5*Math.cos(2*Math.PI*p);
    var a=read(this.history,this.write-base-p*span);
    var b=read(this.history,this.write-base-p2*span);
    this.grainPhase=wrap(p+(1-ratio)/span,1);
    return a*w+b*(1-w);
  };
  Engine.prototype.process=function(input,output){
    var kind=this.kind,n=input.length,blockPeak=0;
    // Bypass still records history, even when no effect has ever been pressed.
    for(var i=0;i<n;i++){
      var x=input[i];this.history[this.write]=x;
      blockPeak=Math.max(blockPeak,Math.abs(x));
      this.write=(this.write+1)%this.history.length;this.filled=Math.min(this.history.length,this.filled+1);
      var y=x;
      if(kind===9 || kind===10){
        var period=this.stepSamples*(kind===9?1:4/3),phase=this.pos/period;
        var edge=Math.min(this.sampleRate*.001,period*.02),position=this.pos;
        var gate=phase<.5?Math.max(0,Math.min(1,position/edge,(period*.5-position)/edge)):0;
        y=x*gate;this.pos=(this.pos+1)%period;
      } else if(kind>=5&&kind<=8 && this.filled>this.sampleRate*.055){
        var ratio=kind===5?1.008:kind===7?2:.5;
        var shifted=this.pitch(ratio);
        y=kind===5?x*.55+shifted*.45:kind===6?x*.45+shifted*.55:shifted;
      } else if(this.loop && this.requested){
        var len=this.loop.length;
        if(kind===11 || kind===12){
          // Bidirectional continuous motion, not a fixed negative playback rate.
          var position=(.5+.48*Math.sin(this.scratchPhase))*Math.max(1,len-1);
          y=read(this.loop,position);
          this.scratchPhase+=2*Math.PI/(this.stepSamples*(kind===11?8:4));
          if(this.scratchPhase>2*Math.PI)this.scratchPhase-=2*Math.PI;
        } else {
          // Short edge fades suppress clicks without shortening musical loops.
          var fade=Math.min(Math.round(this.sampleRate*.003),Math.floor(len/8));
          var p=this.pos;
          y=read(this.loop,p);
          if(fade)y*=Math.sin(Math.PI*.5*Math.min(1,p/fade,(len-1-p)/fade));
          this.pos=(p+1)%len;
        }
      }
      if(this.transition>0){
        var mix=1-this.transition/Math.max(1,Math.round(this.sampleRate*.005));
        y=this.last*(1-mix)+y*mix;this.transition--;
      }
      if(!Number.isFinite(y))y=0;
      output[i]=y;this.last=y;
    }
    // Retry once per block; do not allocate in the inner sample loop.
    if(this.pending && blockPeak>1e-7)this.capture();
  };
  function quantizeStep(step){return Math.floor(step/4)*4+Math.min(step%4,2)*4/3;}
  var codes=["non","L16","L12","L32","L48","uni","uno","ocu","ocd","st8","st6","scr","scf","6-8","rtr","rev","non"];
  function stepRepeats(kind){return ({3:2,4:3})[kind] || 0;}
  function readerSpec(kind,step){return kind===1?{period:step,repeats:4}:kind===2?{period:step*4/3,repeats:3}:kind===4?{period:step/3,repeats:8}:null;}
  function readerPosition(seconds,rate,period,repeats){var tick=Math.floor(seconds/period);return (Math.floor(tick/repeats)*period+(seconds-tick*period))*rate;}
  function loopCell(pcm,offset,available,rate,period,playbackRate){
    var frames=Math.max(2,Math.ceil(period*rate*playbackRate)+1),out=new Float32Array(frames),start=Math.max(0,Math.round(offset*rate)),count=Math.min(frames,Math.round(available*rate),pcm.length-start);
    if(count>0)out.set(pcm.subarray(start,start+count));
    var fade=Math.max(1,Math.min(Math.round(.001*rate*playbackRate),Math.floor(count*.15)));
    for(var i=0;i<fade;i++){out[i]*=i/fade;if(count>i)out[count-1-i]*=i/fade;}
    return out;
  }
  // V6 multi-pitch harmonic capture; low mode resolves three near-unity layers and one half-rate layer.
  function unisonLayers(kind){return kind===5?[.98388644,.99413750,1.00627777,1.01660276]:kind===6?[.99459477,1.00292946,1.00437673,.49609343]:[1];}
  return {readerSpec:readerSpec,readerPosition:readerPosition,unisonLayers:unisonLayers,unisonGains:function(kind){return [.35,.46666667,.35,.35];},Engine:Engine,names:names,codes:codes,quantizeStep:quantizeStep,stepRepeats:stepRepeats,loopCell:loopCell};
});
