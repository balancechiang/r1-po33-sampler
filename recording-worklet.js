/* Mono musical-sampling capture; native backup stereo transport stays separate. */
class PO33Recorder extends AudioWorkletProcessor {
 constructor(options={}){super();this.inputGain=Math.max(1,Math.min(8,Number(options.processorOptions?.inputGain)||1));this.autoLevel=!!options.processorOptions?.autoLevel;this.autoGain=1;this.detectorEnergy=0;this.detectorPeak=0;this.inputClipped=false;this.energyAlpha=1-Math.exp(-1/(sampleRate*.05));this.peakDecay=Math.exp(-1/(sampleRate*.15));this.gainDown=1-Math.exp(-1/(sampleRate*.008));this.gainUp=1-Math.exp(-1/(sampleRate*.3));this.gainQuiet=1-Math.exp(-1/(sampleRate*.8));this.active=false;this.id=0;this.frames=0;this.limit=0;this.chunk=new Float32Array(1024);this.used=0;this.meterFrames=0;this.energy=0;this.peak=0;
  this.port.onmessage=({data:m})=>{
   if(m.type==='start' && !this.active){this.id=m.id;this.frames=0;this.limit=Math.max(0,Math.floor(m.maxFrames));this.used=0;this.active=true;this.port.postMessage({type:'started',id:this.id});if(!this.limit)this.finish('memory-full');}
   else if(m.type==='stop' && this.active && m.id===this.id)this.finish('released');
  };
 }
 flush(){if(!this.used)return;const data=this.chunk.slice(0,this.used);this.port.postMessage({type:'chunk',id:this.id,frames:this.frames,data:data.buffer},[data.buffer]);this.used=0;}
 finish(reason){this.flush();this.active=false;this.port.postMessage({type:'finished',id:this.id,reason,frames:this.frames});}
 process(inputs,outputs){
  for(const output of outputs)for(const channel of output)channel.fill(0);
  const data=inputs[0]?.[0],length=data?.length || outputs[0]?.[0]?.length || 128;
  for(let i=0;i<length;i++){
   const raw=data?data[i]:0;if(Math.abs(raw)>=.98)this.inputClipped=true;let value;
   if(this.autoLevel){
    this.detectorEnergy+=(raw*raw-this.detectorEnergy)*this.energyAlpha;
    this.detectorPeak=Math.max(Math.abs(raw),this.detectorPeak*this.peakDecay);
    const rms=Math.sqrt(this.detectorEnergy),desired=rms>.003?Math.min(16,.126/rms,.94/Math.max(.00001,this.detectorPeak)):1;
    const coefficient=desired<this.autoGain?(rms>.003?this.gainDown:this.gainQuiet):this.gainUp;
    this.autoGain+=(desired-this.autoGain)*coefficient;
    value=raw*Math.min(this.autoGain,.94/Math.max(.00001,Math.abs(raw)));
   }else value=Math.max(-1,Math.min(1,raw*this.inputGain));this.peak=Math.max(this.peak,Math.abs(value));this.energy+=value*value;this.meterFrames++;
   if(this.active){this.chunk[this.used++]=value;this.frames++;if(this.used===this.chunk.length)this.flush();if(this.frames>=this.limit)this.finish('memory-full');}
  }
  if(this.meterFrames>=sampleRate*.02){this.port.postMessage({type:'meter',peak:this.peak,rms:Math.sqrt(this.energy/this.meterFrames),clipped:this.inputClipped||this.peak>=.98});this.meterFrames=0;this.energy=0;this.peak=0;this.inputClipped=false;}
  return true;
 }
}
registerProcessor('po33-recorder',PO33Recorder);
