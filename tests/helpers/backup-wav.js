/* Original strict PCM16 stereo codec. No decodeAudioData or resampling. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.PO33BackupWav=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RATE=44100;
  function parse(buffer){
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<44)throw Error('Invalid WAV file.');
    const v=new DataView(buffer),text=(o,n)=>String.fromCharCode(...new Uint8Array(buffer,o,n));
    if(text(0,4)!=='RIFF'||text(8,4)!=='WAVE'||v.getUint32(4,true)+8>buffer.byteLength)throw Error('Invalid RIFF/WAVE header.');
    const end=v.getUint32(4,true)+8;let fmt=null,data=null;
    for(let p=12;p+8<=end;){
      const tag=text(p,4),size=v.getUint32(p+4,true),at=p+8;
      if(at+size>end)throw Error('Truncated WAV chunk.');
      if(tag==='fmt '){if(fmt||size<16)throw Error('Invalid format chunk.');fmt={code:v.getUint16(at,true),channels:v.getUint16(at+2,true),rate:v.getUint32(at+4,true),bytes:v.getUint32(at+8,true),align:v.getUint16(at+12,true),bits:v.getUint16(at+14,true)};}
      if(tag==='data'){if(data)throw Error('Multiple data chunks are not supported.');data={at,size};}
      p=at+size+(size&1);
    }
    if(!fmt||!data||fmt.code!==1||fmt.channels!==2||fmt.rate!==RATE||fmt.bits!==16||fmt.align!==4||fmt.bytes!==RATE*4||data.size%4||!data.size)throw Error('Use 16-bit PCM, 44.1 kHz, stereo WAV. No format conversion is applied.');
    const frames=data.size/4;if(frames>RATE*600)throw Error('Backup exceeds the 10 minute limit.');
    const left=new Float32Array(frames),right=new Float32Array(frames);let peakL=0,peakR=0,clipped=0;
    for(let i=0;i<frames;i++){
      const l=v.getInt16(data.at+i*4,true),r=v.getInt16(data.at+i*4+2,true);
      left[i]=l/32768;right[i]=r/32768;peakL=Math.max(peakL,Math.abs(left[i]));peakR=Math.max(peakR,Math.abs(right[i]));
      if(l===-32768||l===32767||r===-32768||r===32767)clipped++;
    }
    return {left,right,frames,seconds:frames/RATE,peakL,peakR,clipped};
  }
  function encode(chunks){
    let frames=0;
    for(const c of chunks){if(!(c.left instanceof Float32Array)||!(c.right instanceof Float32Array)||c.left.length!==c.right.length)throw Error('Two independent equal-length channels required.');frames+=c.left.length;}
    if(!frames||frames>RATE*600)throw Error('Recording must contain audio and be at most 10 minutes.');
    const buffer=new ArrayBuffer(44+frames*4),v=new DataView(buffer);
    const word=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
    word(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,RATE,true);
    v.setUint32(28,RATE*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,frames*4,true);
    let p=44;const quantize=x=>{if(!Number.isFinite(x))throw Error('Invalid audio sample.');return Math.max(-32768,Math.min(32767,Math.round(x*32768)));};
    for(const c of chunks)for(let i=0;i<c.left.length;i++){v.setInt16(p,quantize(c.left[i]),true);v.setInt16(p+2,quantize(c.right[i]),true);p+=4;}
    return buffer;
  }
  return {RATE,parse,encode};
});
