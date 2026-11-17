/* Dedicated raw stereo path: never connected to the sampler's FX or mono bus. */
class PO33BackupProcessor extends AudioWorkletProcessor {
  constructor(){
    super();this.recording=false;this.playing=false;this.frames=0;this.sequence=0;
    this.left=new Float32Array(4096);this.right=new Float32Array(4096);this.used=0;
    this.meterFrames=0;this.peak=[0,0];this.cross=[0,0];this.previous=[0,0];this.expected=null;
    this.port.onmessage=({data:m})=>{
      if(m.command==='record'){this.frames=0;this.sequence=0;this.used=0;this.expected=null;this.recording=true;}
      if(m.command==='stop'){
        this.recording=false;this.playing=false;this.audio=null;this.flush();
        this.port.postMessage({type:'stopped',frames:this.frames});
      }
      if(m.command==='play'){
        if(!(m.left instanceof Float32Array)||!(m.right instanceof Float32Array)||m.left.length!==m.right.length){this.fail('Invalid stereo playback.');return;}
        this.audio=[m.left,m.right];this.cursor=0;this.playing=true;
      }
    };
  }
  fail(message){this.recording=false;this.playing=false;this.audio=null;this.port.postMessage({type:'error',message});}
  flush(){
    if(!this.used)return;
    const left=this.left.slice(0,this.used),right=this.right.slice(0,this.used);
    this.port.postMessage({type:'chunk',sequence:this.sequence++,left,right},[left.buffer,right.buffer]);this.used=0;
  }
  process(inputs,outputs){
    const output=outputs[0];if(output)for(const c of output)c.fill(0);
    const input=inputs[0]||[];let source=null;
    if(this.playing&&this.audio&&output&&output.length===2){
      const count=Math.min(output[0].length,this.audio[0].length-this.cursor);
      for(let c=0;c<2;c++)output[c].set(this.audio[c].subarray(this.cursor,this.cursor+count));
      source=output;this.cursor+=count;
      if(this.cursor===this.audio[0].length){this.playing=false;this.audio=null;this.port.postMessage({type:'ended'});}
    } else if(this.recording&&input.length){
      if(input.length!==2){this.fail('Input is not stereo. Recording discarded.');return true;}
      if(this.expected!==null&&this.expected!==currentFrame){this.fail('Render-frame gap detected. Recording discarded.');return true;}
      this.expected=currentFrame+input[0].length;source=input;
      for(let i=0;i<input[0].length;i++){
        this.left[this.used]=input[0][i];this.right[this.used]=input[1][i];this.used++;this.frames++;
        if(this.used===4096)this.flush();
        if(this.frames===44100*600){this.recording=false;break;}
      }
      if(this.frames>=44100*600){this.recording=false;this.flush();this.port.postMessage({type:'stopped',frames:this.frames});}
    }
    if(source){
      for(let c=0;c<2;c++)for(const x of source[c]){this.peak[c]=Math.max(this.peak[c],Math.abs(x));if(this.previous[c]<=0&&x>0)this.cross[c]++;this.previous[c]=x;}
      this.meterFrames+=source[0].length;
      if(this.meterFrames>=2048){
        this.port.postMessage({type:'meter',peak:this.peak,hz:this.cross.map(x=>x*sampleRate/this.meterFrames),frames:source===output?this.cursor:this.frames});
        this.peak=[0,0];this.cross=[0,0];this.meterFrames=0;
      }
    }
    return true;
  }
}
registerProcessor('po33-backup',PO33BackupProcessor);
