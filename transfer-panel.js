/* Backup/restore state machine. Audio transfer bypasses the music/FX graph. */
(function(root){'use strict';
  function create(hooks){
    const box=document.createElement('section');box.id='transferControls';box.setAttribute('aria-label','Hardware project transfer');
    box.innerHTML='<p id="transferHint" role="status" aria-live="polite"></p><div><button id="transferFile">Open WAV</button><input id="transferFileInput" type="file" accept=".wav,audio/wav"><button id="transferRecord">Line in</button><button id="transferSend" class="primary">Line out</button><button id="transferSave">Save WAV</button><button id="transferStop">Stop</button><button id="transferClose">Close</button><button id="transferUndo">Undo restore</button><button id="transferDeviceToggle">I/O</button></div><div id="transferDevices" hidden><button id="transferRefresh">Find devices</button><label>Input <select id="transferInput"><option value="">System default</option></select></label><label>Output <select id="transferOutput"><option value="">System default</option></select></label></div>';
    document.body.append(box);const $=id=>document.getElementById(id);
    let view={active:false,state:'idle',mode:'receive',progress:0,level:0,record:0,phase:''};
    let worker=null,audio=null,node=null,stream=null,source=null,chunks=[],sequence=0,encoded=null,timeline=[];
    let native=null,baseline=null,session=false,undo=null,timer=null,saveTimer=null,waitTimer=null,signalStarted=false,lastSignal=0,captured=0;
    let generation=0,saveChain=Promise.resolve();
    const storage=root.PO33TransferStorage;
    function moveFocus(direction){
      if(!view.active || !direction)return;
      const choices=[...box.querySelectorAll('button,select')].filter(e=>!e.disabled && e.getClientRects().length);
      if(!choices.length)return;
      const previous=document.activeElement,index=choices.indexOf(previous);
      const next=choices[index<0?(direction>0?0:choices.length-1):(index+(direction>0?1:-1)+choices.length)%choices.length];
      if(next===previous)return;
      box.querySelectorAll('.wheel-focused').forEach(e=>e.classList.remove('wheel-focused'));
      next.focus({preventScroll:true});
      if(document.activeElement!==next)return;
      next.classList.add('wheel-focused');next.scrollIntoView({block:'nearest',inline:'nearest'});
      try{if(typeof navigator.vibrate==='function')navigator.vibrate(12);}catch(error){}
    }
    function render(){
      document.body.classList.toggle('transfer-open',view.active);document.body.dataset.transfer=view.state;
      const busy=['encoding','decoding','sending','receiving','listening'].includes(view.state);
      $('transferFile').hidden=view.mode!=='receive';$('transferRecord').hidden=view.mode!=='receive';
      $('transferSend').hidden=view.mode!=='send';$('transferSave').hidden=view.mode!=='send';
      $('transferFile').disabled=busy;$('transferRecord').disabled=busy;$('transferSend').disabled=!encoded||busy;$('transferSave').disabled=!encoded||busy;
      $('transferStop').disabled=!['receiving','listening','sending'].includes(view.state);$('transferUndo').hidden=!undo;
      $('transferUndo').disabled=busy;$('transferRefresh').disabled=busy;
      $('transferInput').disabled=busy;$('transferOutput').disabled=busy;
      if(view.active)document.body.style.setProperty('--transfer-height',(box.offsetHeight+4)+'px');
      hooks.paint();
    }
    function set(state,hint,extra={}){Object.assign(view,{state},extra);$('transferHint').textContent=hint;render();}
    async function closeAudio(){
      if(waitTimer)clearInterval(waitTimer);waitTimer=null;
      if(stream){stream.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;}
      if(source){source.disconnect();source=null;}if(node){node.port.onmessage=null;node.disconnect();node.port.close();node=null;}
      const context=audio;audio=null;if(context)await context.close();
    }
    function terminate(){if(worker)worker.terminate();worker=null;}
    async function fail(error){generation++;terminate();await closeAudio();chunks=[];set('error',error.message||String(error),{progress:0,level:0});}
    function end(hint){set('success',hint,{progress:1,level:0,record:0});clearTimeout(timer);timer=setTimeout(()=>{view.active=false;view.state='idle';render();},2500);}
    function checkpoint(){
      if(!session||hooks.preview)return;
      clearTimeout(saveTimer);saveTimer=setTimeout(()=>writeCheckpoint(),500);
    }
    function writeCheckpoint(){
      if(!session||hooks.preview)return Promise.resolve();
      const value={native,baseline,snapshot:hooks.snapshot()};
      saveChain=saveChain.catch(()=>{}).then(()=>storage.put(value));
      saveChain.catch(()=>hooks.hint('PROJECT IN MEMORY · CHECKPOINT FULL'));return saveChain;
    }
    async function accept(project){
      const previous=hooks.snapshot(),previousNative=native,previousBaseline=baseline,previousSession=session;
      hooks.adopt(project);native=project;baseline=hooks.snapshot();session=true;
      undo={snapshot:previous,native:previousNative,baseline:previousBaseline,session:previousSession};
      let saved=true;try{await writeCheckpoint();}catch(error){saved=false;}
      const unresolved=project.validation.unresolvedAudioRanges;
      end((saved?'End · Project restored / 工程已恢复': 'End · Restored in memory; storage unavailable / 仅本次有效')+(unresolved?` · ${unresolved} unavailable slices / 异常切片`:''));
    }
    function run(command,data){
      terminate();worker=new Worker('./transfer-worker.js',{type:'module'});const token=generation;
      worker.onerror=()=>{if(token===generation)fail(Error('Codec worker unavailable. Use HTTP/HTTPS.'));};
      worker.onmessage=async({data:m})=>{
        if(token!==generation)return;
        if(m.type==='error'){await fail(Error(m.message));return;}
        if(m.type==='progress'){
          const value=m.completed/Math.max(1,m.total);
          view.phase=m.phase;view.progress=command==='encode'?value*.9:m.phase==='validated'?1:m.phase==='demodulate'?.2+.75*value:m.phase==='clock'?.2:.1;
          render();return;
        }
        terminate();
        if(m.type==='decoded'){try{await accept(m.project);}catch(error){await fail(error);}}
        if(m.type==='encoded'){
          encoded=m;timeline=m.timeline;set('ready',`Backup ready · ${m.packets} checked packets. ${m.warnings.join(' ')} Put PO-33 in receive mode before Line out.`,{progress:0,phase:'ready'});
        }
      };
      worker.postMessage({command,...data});
    }
    async function open(mode){
      if(['encoding','decoding','receiving','listening','sending'].includes(view.state))return;
      clearTimeout(timer);generation++;encoded=null;view={active:true,state:'waiting',mode,progress:0,level:0,record:0,phase:''};
      hooks.stop();
      set('waiting',mode==='receive'?'rcv · Choose WAV or Line in / 选择工程 WAV 或立体声输入':'Preparing current project / 正在准备当前工程');
      if(mode==='send'){set('encoding','Encoding project / 工程编码中');run('encode',{snapshot:hooks.snapshot(),native,baseline});}
    }
    async function readFile(file){
      if(!file || !view.active)return;
      const token=++generation;set('decoding','Reading backup WAV / 读取工程音频',{progress:0});
      try{
        if(file.size>128*1024*1024)throw Error('Backup exceeds 128 MB');
        const reader=file.stream().getReader(),parts=[];let received=0;
        for(;;){const {value,done}=await reader.read();if(token!==generation){await reader.cancel();return;}if(done)break;parts.push(value);received+=value.length;view.progress=received/file.size;render();}
        const bytes=new Uint8Array(received);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
        view.progress=0;set('decoding','Checking carrier, packets and CRC / 解调与校验');run('decode',{wav:bytes.buffer});
      }catch(error){if(token===generation)await fail(error);}
    }
    async function makeAudio(rate,token){
      const context=new (root.AudioContext||root.webkitAudioContext)({sampleRate:rate,latencyHint:'playback'});audio=context;
      if(![44100,48000].includes(context.sampleRate))throw Error('A 44.1/48 kHz stereo audio path is required');
      if(rate && context.sampleRate!==rate)throw Error('Output sample rate mismatch; no transfer resampling allowed');
      if(context.destination.maxChannelCount<2)throw Error('Stereo output is unavailable');
      context.destination.channelCount=2;context.destination.channelInterpretation='discrete';
      if($('transferOutput').value){if(!context.setSinkId)throw Error('Select audio output in system settings');await context.setSinkId($('transferOutput').value);}
      await context.audioWorklet.addModule('./backup-worklet.js');
      if(token!==generation){if(context.state!=='closed')await context.close();return false;}
      node=new AudioWorkletNode(context,'po33-backup',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCountMode:'max',channelInterpretation:'discrete'});
      node.connect(context.destination);node.port.onmessage=e=>{if(token===generation)onAudio(e);};await context.resume();
      context.onsinkchange=()=>{if(audio===context && view.state==='sending')fail(Error('Output route changed during transfer'));};
      context.onstatechange=()=>{if(audio===context && context.state==='suspended' && ['sending','receiving','listening'].includes(view.state))fail(Error('Audio context interrupted during transfer'));};
      return token===generation;
    }
    async function record(){
      const token=++generation;signalStarted=false;lastSignal=0;chunks=[];sequence=0;captured=0;
      set('listening','rcv · Waiting for stereo backup · 60 s / 等待立体声输入',{progress:0,level:0});
      try{
        if(!await makeAudio(undefined,token))return;
        const constraints={channelCount:{exact:2},sampleRate:{ideal:audio.sampleRate},echoCancellation:false,noiseSuppression:false,autoGainControl:false};
        if($('transferInput').value)constraints.deviceId={exact:$('transferInput').value};
        const acquired=await navigator.mediaDevices.getUserMedia({audio:constraints});
        if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
        const track=stream.getAudioTracks()[0],s=track.getSettings();
        if(s.channelCount!==2 || s.sampleRate!==audio.sampleRate)throw Error('Input must report independent stereo at the context rate');
        if(['echoCancellation','noiseSuppression','autoGainControl'].some(k=>s[k]!==false))throw Error('Cannot verify disabled input processing');
        track.onended=()=>fail(Error('Audio input disconnected'));
        source=audio.createMediaStreamSource(stream);node.port.postMessage({command:'record',waitForSignal:true});source.connect(node);
        const waitingAt=performance.now();
        waitTimer=setInterval(()=>{
          const now=performance.now();
          if(!signalStarted && now-waitingAt>60000)fail(Error('Receive timed out: no input within 60 seconds'));
          else if(signalStarted && now-lastSignal>2000)stopCapture();
        },200);
      }catch(error){if(token===generation)await fail(error);}
    }
    function stopCapture(){if(node){clearInterval(waitTimer);waitTimer=null;set('receiving','Finishing input / 正在结束输入');node.port.postMessage({command:'stop'});}}
    async function onAudio({data:m}){
      if(m.type==='error'){await fail(Error(m.message));return;}
      if(m.type==='chunk'){
        if(m.sequence!==sequence++){await fail(Error('Recording block order mismatch'));return;}
        chunks.push({left:m.left,right:m.right});captured+=m.left.length;return;
      }
      if(m.type==='meter'){
        view.level=Math.max(...m.peak);
        if(view.state==='sending'){
          view.progress=m.frames/encoded.left.length;
          const event=timeline.findLast(e=>e.frame<=m.frames);if(event){view.record=event.record;view.phase=event.phase;}
        }else if(['listening','receiving'].includes(view.state)){
          if(view.level>=.999){await fail(Error('Input overloaded / 输入削波，请降低音量'));return;}
          if(view.level>.005){lastSignal=performance.now();if(!signalStarted){signalStarted=true;set('receiving','Receiving · Input level shown / 正在接收，方块显示输入电平');}}
          view.progress=null;
        }
        render();return;
      }
      if(m.type==='stopped' && ['listening','receiving'].includes(view.state)){
        if(captured!==m.frames){await fail(Error('Recording length mismatch'));return;}
        const rate=audio.sampleRate;await closeAudio();
        if(!signalStarted){await fail(Error('No backup input detected'));return;}
        const left=new Float32Array(captured),right=new Float32Array(captured);let at=0;
        for(const c of chunks){left.set(c.left,at);right.set(c.right,at);at+=c.left.length;}chunks=[];
        set('decoding','Validating received backup / 正在校验接收工程',{progress:0,level:0});run('decode',{pcm:{left,right,sampleRate:rate}});
      }else if(m.type==='ended' && view.state==='sending'){
        await closeAudio();end('End · Signal sent. Confirm reception on PO-33 / 已发送，请核对真机');
      }
    }
    async function send(){
      if(!encoded)return;
      const token=++generation;
      try{set('sending','Opening stereo output / 正在打开输出',{progress:0,level:0});if(!await makeAudio(encoded.rate,token))return;set('sending','Sending stereo backup / 正在发送立体声工程');node.port.postMessage({command:'play',left:encoded.left,right:encoded.right});}
      catch(error){if(token===generation)await fail(error);}
    }
    async function close(){generation++;clearTimeout(timer);terminate();await closeAudio();chunks=[];view.active=false;view.state='idle';render();}
    async function devices(){
      let permission;
      try{
        permission=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        for(const [id,kind] of [['transferInput','audioinput'],['transferOutput','audiooutput']]){
          const select=$(id),list=await navigator.mediaDevices.enumerateDevices();select.replaceChildren(new Option('System default',''));
          list.filter(d=>d.kind===kind).forEach(d=>select.add(new Option(d.label||kind,d.deviceId)));
        }
      }catch(error){$('transferHint').textContent=error.message;}finally{permission?.getTracks().forEach(t=>t.stop());}
    }
    $('transferFile').onclick=()=>$('transferFileInput').click();$('transferFileInput').onchange=e=>{const file=e.target.files[0];e.target.value='';readFile(file);};
    $('transferRecord').onclick=record;$('transferSend').onclick=send;$('transferClose').onclick=close;
    $('transferStop').onclick=()=>view.state==='sending'?close():stopCapture();
    $('transferSave').onclick=()=>{if(!encoded)return;const url=URL.createObjectURL(new Blob([encoded.wav],{type:'audio/wav'})),a=document.createElement('a');a.href=url;a.download='po33-project-backup.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);end('End · Backup WAV saved / 工程音频已保存');};
    $('transferUndo').onclick=async()=>{
      if(!undo)return;hooks.restoreSnapshot(undo.snapshot);native=undo.native;baseline=undo.baseline;session=undo.session;undo=null;
      try{if(session)await writeCheckpoint();else {await saveChain.catch(()=>{});await storage.clear();}}catch(error){hooks.hint('RESTORED IN MEMORY');}
      await close();
    };
    $('transferDeviceToggle').onclick=()=>$('transferDevices').hidden=!$('transferDevices').hidden;$('transferRefresh').onclick=devices;
    document.addEventListener('visibilitychange',()=>{if(document.hidden && ['listening','receiving','sending'].includes(view.state))fail(Error('Transfer interrupted: keep the page visible'));});
    root.addEventListener('pagehide',()=>{closeAudio();terminate();});
    root.addEventListener('resize',()=>{if(view.active)render();});
    navigator.mediaDevices?.addEventListener('devicechange',async()=>{
      if(!['sending','receiving','listening'].includes(view.state))return;
      const input=view.state!=='sending',id=$(input?'transferInput':'transferOutput').value;
      if(!id)return;
      try{const devices=await navigator.mediaDevices.enumerateDevices();if(!devices.some(d=>d.deviceId===id && d.kind===(input?'audioinput':'audiooutput')))await fail(Error('Selected audio interface disconnected'));}catch(error){await fail(error);}
    });
    return {open,close,readFile,moveFocus,get view(){return view;},get hasSession(){return session;},checkpoint,
      flush:writeCheckpoint,
      async restore(){if(hooks.preview)return;try{const saved=await storage.get();if(saved){undo={snapshot:hooks.snapshot(),native:null,baseline:null,session:false};native=saved.native;baseline=saved.baseline;session=true;hooks.restoreSnapshot(saved.snapshot);}}catch(error){hooks.hint('CHECKPOINT UNAVAILABLE');}},
      async reset(){clearTimeout(saveTimer);await close();session=false;native=null;baseline=null;undo=null;await saveChain.catch(()=>{});if(!hooks.preview)await storage.clear();}
    };
  }
  root.PO33TransferFactory={create};
})(window);
