(function(){
  'use strict';
  const $=id=>document.getElementById(id),codec=window.PO33BackupWav;
  let context=null,node=null,stream=null,source=null,bytes=null,chunks=[],state='idle',sequence=0,invalid=false,busy=false;
  let inputEnded=null;
  function status(message,error=false){$('status').textContent=message;$('status').dataset.error=String(error);}
  function controls(){
    const active=state!=='idle'||busy;
    for(const id of ['record','devices','file','input','output'])$(id).disabled=active;
    $('play').disabled=active||!bytes;$('save').disabled=active||!bytes;$('stop').disabled=state==='idle';
  }
  function disconnectInput(){
    if(stream){for(const track of stream.getTracks()){if(inputEnded)track.removeEventListener('ended',inputEnded);track.stop();}}
    if(source)source.disconnect();stream=null;source=null;inputEnded=null;
  }
  async function closeAudio(){
    disconnectInput();if(node){node.port.onmessage=null;node.disconnect();node.port.close();node=null;}
    if(context){await context.close();context=null;}
  }
  async function fail(error){
    invalid=true;chunks=[];state='idle';await closeAudio();status(error.message||String(error),true);controls();
  }
  function updateFile(buffer){
    const parsed=codec.parse(buffer);bytes=buffer;
    $('fileInfo').textContent=`${parsed.seconds.toFixed(2)} seconds · 2 channels · 44100 Hz · PCM16`+(parsed.clipped?' · Full-scale samples detected; check for clipping.':'');
    controls();
  }
  async function makeAudio(){
    if(!window.isSecureContext)throw Error('Open this page using HTTPS or localhost.');
    const AC=window.AudioContext||window.webkitAudioContext;
    context=new AC({sampleRate:44100,latencyHint:'playback'});
    if(context.sampleRate!==44100)throw Error('The browser did not provide 44100 Hz. Transfer stopped.');
    if(!context.audioWorklet)throw Error('AudioWorklet is unavailable. No legacy recording fallback is used.');
    if(context.destination.maxChannelCount<2)throw Error('A stereo output device is required.');
    context.destination.channelCount=2;context.destination.channelInterpretation='discrete';
    const output=$('output').value;
    if(output){if(!context.setSinkId)throw Error('Output selection is unavailable here. Select the output in system settings and use System default.');await context.setSinkId(output);}
    await context.audioWorklet.addModule('./backup-worklet.js');
    node=new AudioWorkletNode(context,'po33-backup',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCountMode:'max',channelInterpretation:'discrete'});
    node.port.onmessage=onMessage;node.connect(context.destination);await context.resume();
  }
  async function onMessage({data:m}){
    if(m.type==='error'){await fail(Error(m.message));return;}
    if(m.type==='meter'){
      for(const [i,id] of ['left','right'].entries()){$(id).value=m.peak[i];$(id+'Value').textContent=Math.round(m.peak[i]*100)+'%';}
      $('signal').textContent=`${(m.frames/44100).toFixed(1)} s · L/R rising-crossing estimates: ${Math.round(m.hz[0])} / ${Math.round(m.hz[1])} Hz`+(m.peak.some(p=>p>=.999)?' · Possible clipping':'');
    }
    if(m.type==='chunk'){
      if(invalid||m.sequence!==sequence++){await fail(Error('Recording block sequence mismatch. Recording discarded.'));return;}
      chunks.push({left:m.left,right:m.right});
    }
    if(m.type==='stopped'&&state==='recording'){
      disconnectInput();
      const received=chunks.reduce((n,c)=>n+c.left.length,0);
      if(received!==m.frames){await fail(Error('Recording length mismatch. Recording discarded.'));return;}
      try{const saved=codec.encode(chunks);chunks=[];state='idle';await closeAudio();updateFile(saved);status('Raw backup audio recorded. It has not been decoded or validated on hardware.');}
      catch(error){await fail(error);}
    }else if(m.type==='ended'||m.type==='stopped'){
      state='idle';await closeAudio();status('Playback finished. Confirm successful reception on the PO-33.');controls();
    }
  }
  async function record(){
    if(state!=='idle'||busy)return;busy=true;controls();
    try{
      await makeAudio();
      const audio={channelCount:{exact:2},sampleRate:{exact:44100},echoCancellation:false,noiseSuppression:false,autoGainControl:false};
      if($('input').value)audio.deviceId={exact:$('input').value};
      stream=await navigator.mediaDevices.getUserMedia({audio});
      const track=stream.getAudioTracks()[0],settings=track.getSettings();
      if(settings.channelCount!==2||settings.sampleRate!==44100)throw Error('The input did not report two channels at 44100 Hz. Recording stopped; no mono conversion is allowed.');
      if(['echoCancellation','noiseSuppression','autoGainControl'].some(k=>settings[k]!==false))throw Error('Cannot verify that input processing is disabled. Recording stopped.');
      $('format').textContent='Verified browser input: 44100 Hz · 2 channels · echo cancellation, noise suppression and automatic gain off.';
      chunks=[];sequence=0;invalid=false;state='recording';
      inputEnded=()=>fail(Error('Input device disconnected. Recording discarded.'));track.addEventListener('ended',inputEnded);
      source=context.createMediaStreamSource(stream);node.port.postMessage({command:'record'});source.connect(node);
      status('Recording raw stereo. Start transmission on the PO-33; stop here when it finishes.');
    }catch(error){await fail(error);}finally{busy=false;controls();}
  }
  async function play(){
    if(!bytes||state!=='idle'||busy)return;busy=true;controls();
    try{
      const audio=codec.parse(bytes);await makeAudio();invalid=false;state='playing';
      node.port.postMessage({command:'play',left:audio.left,right:audio.right},[audio.left.buffer,audio.right.buffer]);
      status('Playing raw stereo at unity gain. Check the hardware receive progress.');
    }catch(error){await fail(error);}finally{busy=false;controls();}
  }
  async function devices(){
    if(busy||state!=='idle')return;busy=true;controls();let permission=null;
    try{
      permission=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      const list=await navigator.mediaDevices.enumerateDevices();
      for(const [id,kind] of [['input','audioinput'],['output','audiooutput']]){
        const select=$(id),value=select.value;select.replaceChildren(new Option('System default',''));
        for(const device of list.filter(d=>d.kind===kind))select.add(new Option(device.label||`${kind} ${select.length}`,device.deviceId));
        if([...select.options].some(o=>o.value===value))select.value=value;
      }
      status('Devices refreshed. Select a stereo interface input/output.');
    }catch(error){status(error.message,true);}finally{if(permission)permission.getTracks().forEach(t=>t.stop());busy=false;controls();}
  }
  async function openFile(file){
    if(!file||busy||state!=='idle')return;busy=true;controls();
    try{if(file.size>128*1024*1024)throw Error('Backup WAV exceeds the 128 MB file limit.');updateFile(await file.arrayBuffer());status('Raw WAV loaded without resampling. No hardware frame validation has been performed.');}
    catch(error){status(error.message,true);}finally{busy=false;controls();}
  }
  $('record').onclick=record;$('play').onclick=play;$('devices').onclick=devices;
  $('stop').onclick=()=>{if(node){node.port.postMessage({command:'stop'});$('stop').disabled=true;}};
  $('file').onchange=e=>openFile(e.target.files[0]);
  $('drop').ondragover=e=>{e.preventDefault();};$('drop').ondrop=e=>{e.preventDefault();openFile(e.dataTransfer.files[0]);};
  $('save').onclick=()=>{if(!bytes)return;const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})),a=document.createElement('a');a.href=url;a.download='po33-raw-backup.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.addEventListener('pagehide',()=>{disconnectInput();if(context)context.close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='recording')fail(Error('Page hidden during recording. Capture discarded; keep this page visible during a transfer.'));});
  controls();
})();
