/* Serverless WebRTC project transfer. SDP is exchanged manually as QR; files stay peer-to-peer. */
(function(root){'use strict';
  const MAX_BYTES=32*1024*1024,MAX_SIGNAL=24000,CHUNK=16*1024;
  function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
  function base64ToBytes(value){const binary=atob(value);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
  async function streamTransform(bytes,StreamType,format){if(!StreamType)throw Error('This browser cannot compress connection QR codes. Update the browser or use Save JSON.');const stream=new Blob([bytes]).stream().pipeThrough(new StreamType(format));return new Uint8Array(await new Response(stream).arrayBuffer());}
  async function packSignal(description){const json=new TextEncoder().encode(JSON.stringify({v:1,type:description.type,sdp:description.sdp}));const packed=await streamTransform(json,root.CompressionStream,'deflate');return 'WS1:'+bytesToBase64(packed);}
  async function unpackSignal(value){if(typeof value!=='string'||!value.startsWith('WS1:')||value.length>MAX_SIGNAL)throw Error('This is not a valid Web Sampler pairing QR.');const raw=await streamTransform(base64ToBytes(value.slice(4)),root.DecompressionStream,'deflate');if(raw.length>MAX_SIGNAL)throw Error('Pairing QR is too large.');const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(data.v!==1||!['offer','answer'].includes(data.type)||typeof data.sdp!=='string'||data.sdp.length>MAX_SIGNAL)throw Error('Invalid or unsupported pairing QR.');return data;}
  function create(options={}){
    let pc=null,channel=null,received=null,expected=0,parts=[],closed=false,lastProgressAt=0;
    const callbacks={state:options.onState||(()=>{}),progress:options.onProgress||(()=>{}),file:options.onFile||(()=>{}),open:options.onOpen||(()=>{}),ack:options.onAck||(()=>{}),error:options.onError||(()=>{})};
    function state(value,detail){callbacks.state(value,detail||'');}
    function progress(done,total){const now=performance.now();if(done===total || now-lastProgressAt>=100){lastProgressAt=now;callbacks.progress(done,total);}}
    function cleanup(){closed=true;received=null;parts=[];expected=0;if(channel){channel.onopen=channel.onmessage=channel.onerror=channel.onclose=null;try{channel.close();}catch(e){}channel=null;}if(pc){pc.onconnectionstatechange=pc.ondatachannel=pc.oniceconnectionstatechange=null;try{pc.close();}catch(e){}pc=null;}}
    function ensure(){if(!root.isSecureContext)throw Error('Direct transfer requires HTTPS (or localhost).');if(!root.RTCPeerConnection)throw Error('WebRTC is unavailable in this browser.');closed=false;pc=new RTCPeerConnection({iceServers:[]});pc.onconnectionstatechange=()=>{const s=pc?.connectionState;if(s==='failed'||s==='disconnected')state('error','Direct connection failed. Check that both devices share Wi-Fi and allow local connections.');else if(s==='connected')state('connected','Direct connection established.');};pc.oniceconnectionstatechange=()=>{if(pc?.iceConnectionState==='failed')state('error','Local peer connection failed; this network may block direct connections.');};return pc;}
    function waitGathering(){return new Promise((resolve,reject)=>{if(!pc) return reject(Error('Connection was closed.'));if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(()=>reject(Error('Local connection setup timed out.')),20000);pc.onicegatheringstatechange=()=>{if(pc?.iceGatheringState==='complete'){clearTimeout(timer);resolve();}};});}
    function channelSetup(ch){channel=ch;channel.binaryType='arraybuffer';channel.bufferedAmountLowThreshold=256*1024;channel.onopen=()=>{state('connected','Direct connection established. Preparing project…');callbacks.open();};channel.onclose=()=>{if(!closed)state('closed','Peer connection closed.');};channel.onerror=()=>callbacks.error(Error('Peer data channel failed.'));channel.onmessage=e=>receiveMessage(e.data).catch(error=>{try{if(channel?.readyState==='open')channel.send(JSON.stringify({type:'error',message:error?.message||'Transfer failed.'}));}catch(e){}callbacks.error(error);});}
    async function waitForChannel(){if(channel?.readyState==='open')return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No direct connection. Keep both pairing screens open and on the same Wi-Fi.')),25000);const prior=callbacks.open;const done=()=>{clearTimeout(timer);callbacks.open=prior;resolve();};callbacks.open=()=>{done();prior();};if(channel?.readyState==='open')done();});}
    async function offer(){const connection=ensure();channelSetup(connection.createDataChannel('web-sampler-project',{ordered:true}));state('pairing','Creating local pairing QR…');const offer=await connection.createOffer();await connection.setLocalDescription(offer);await waitGathering();return packSignal(connection.localDescription);}
    async function answer(value){const data=await unpackSignal(value);if(data.type!=='offer')throw Error('Scan the sender’s offer QR first.');const connection=ensure();connection.ondatachannel=e=>channelSetup(e.channel);state('pairing','Preparing response QR…');await connection.setRemoteDescription({type:data.type,sdp:data.sdp});const reply=await connection.createAnswer();await connection.setLocalDescription(reply);await waitGathering();return packSignal(connection.localDescription);}
    async function acceptAnswer(value){const data=await unpackSignal(value);if(data.type!=='answer'||!pc)throw Error('Scan the reply QR from the receiving device.');await pc.setRemoteDescription({type:data.type,sdp:data.sdp});state('connecting','Connecting directly over Wi-Fi…');await waitForChannel();}
    async function waitBuffered(){if(!channel||channel.readyState!=='open')throw Error('Peer connection closed during transfer.');if(channel.bufferedAmount<1024*1024)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Peer transfer stalled.')),30000);channel.addEventListener('bufferedamountlow',()=>{clearTimeout(timer);resolve();},{once:true});});}
    async function sendFile(buffer,name='web-sampler-project.json'){
      if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<1||buffer.byteLength>MAX_BYTES)throw Error('Project size is empty or exceeds 32 MB.');await waitForChannel();
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));channel.send(JSON.stringify({type:'file',name,size:buffer.byteLength,sha256:bytesToBase64(digest)}));
      const bytes=new Uint8Array(buffer);for(let at=0;at<bytes.length;at+=CHUNK){await waitBuffered();channel.send(bytes.slice(at,Math.min(bytes.length,at+CHUNK)));progress(Math.min(bytes.length,at+CHUNK),bytes.length);}
      state('sending','Project sent directly. Waiting for receiver confirmation…');
    }
    async function receiveMessage(data){
      if(typeof data==='string'){
        const message=JSON.parse(data);if(message.type==='file'){
          if(!Number.isSafeInteger(message.size)||message.size<1||message.size>MAX_BYTES||typeof message.sha256!=='string')throw Error('Invalid project transfer header.');
          received=message;expected=0;parts=[];state('receiving','Receiving project directly…');callbacks.progress(0,message.size);return;
        }
        if(message.type==='received'){state('success','Project delivered and verified by receiver.');callbacks.ack();return;}
        if(message.type==='error')throw Error(message.message||'Receiver could not import the project.');
        throw Error('Unknown peer transfer message.');
      }
      if(!received)throw Error('Project data arrived before its header.');
      const bytes=data instanceof ArrayBuffer?new Uint8Array(data):data instanceof Blob?new Uint8Array(await data.arrayBuffer()):null;if(!bytes)throw Error('Unsupported peer data format.');
      if(expected+bytes.length>received.size)throw Error('Peer sent more bytes than declared.');parts.push(bytes);expected+=bytes.length;progress(expected,received.size);
      if(expected===received.size){const all=new Uint8Array(expected);let at=0;for(const part of parts){all.set(part,at);at+=part.length;}const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',all));if(bytesToBase64(digest)!==received.sha256)throw Error('Project checksum mismatch; the current project was not changed.');const name=/^[\w .-]{1,100}\.json$/i.test(received.name)?received.name:'web-sampler-project.json';state('validating','Transfer complete. Checking project…');const complete=(ok,message)=>channel?.readyState==='open'&&channel.send(JSON.stringify(ok?{type:'received'}:{type:'error',message:message||'Project validation failed.'}));await callbacks.file(name,all.buffer,complete);received=null;parts=[];expected=0;}
    }
    return {offer,answer,acceptAnswer,sendFile,close:cleanup,get connected(){return channel?.readyState==='open';},get state(){return pc?.connectionState||'new';}};
  }
  root.PO33PeerTransfer={create,packSignal,unpackSignal};
})(window);
