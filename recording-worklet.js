/* Mono musical-sampling capture; native backup stereo transport stays separate. */
class PO33Recorder extends AudioWorkletProcessor {
 constructor(options={}){super();this.inputGain=Math.max(1,Math.min(8,Number(options.processorOptions?.inputGain)||1));this.active=false;this.id=0;this.frames=0;this.limit=0;this.chunk=new Float32Array(1024);this.used=0;this.meterFrames=0;this.energy=0;this.peak=0;
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
   const value=Math.max(-1,Math.min(1,(data?data[i]:0)*this.inputGain));this.peak=Math.max(this.peak,Math.abs(value));this.energy+=value*value;this.meterFrames++;
   if(this.active){this.chunk[this.used++]=value;this.frames++;if(this.used===this.chunk.length)this.flush();if(this.frames>=this.limit)this.finish('memory-full');}
  }
  if(this.meterFrames>=sampleRate*.02){this.port.postMessage({type:'meter',peak:this.peak,rms:Math.sqrt(this.energy/this.meterFrames),clipped:this.peak>=.98});this.meterFrames=0;this.energy=0;this.peak=0;}
  return true;
 }
}
registerProcessor('po33-recorder',PO33Recorder);
