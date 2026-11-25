/* Local QR scanner, camera lifecycle and URL fallback. */
(function(root){'use strict';
  function create(parent){
    const dialog=document.createElement('dialog');dialog.id='transferQR';
    dialog.innerHTML='<p>Scan project download QR / 扫描工程下载码</p><video id="transferQRVideo" autoplay muted playsinline></video><p id="transferQRStatus" role="status">Opening camera / 正在打开摄像头…</p><form id="transferQRForm"><label>Project URL / 工程直链<input id="transferQRURL" type="url" inputmode="url" autocomplete="off" placeholder="https://…/backup.wav"></label><button type="submit">Import URL / 导入网址</button><button id="transferQRCancel" type="button">Cancel / 取消</button></form>';
    parent.append(dialog);
    const video=dialog.querySelector('video'),status=dialog.querySelector('#transferQRStatus'),input=dialog.querySelector('input');
    let stream=null,worker=null,timer=null,finish=null,session=0,busy=false;
    function cleanup(){clearTimeout(timer);timer=null;if(worker)worker.terminate();worker=null;if(stream)stream.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;video.srcObject=null;busy=false;}
    function settle(text){root.dispatchEvent(new CustomEvent('po33-scan-state',{detail:{active:false}}));session++;cleanup();if(dialog.open)dialog.close();const resolve=finish;finish=null;resolve?.(text);}
    dialog.querySelector('#transferQRCancel').onclick=()=>settle(null);
    dialog.addEventListener('cancel',e=>{e.preventDefault();settle(null);});
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(input.value.trim())settle(input.value.trim());};
    document.addEventListener('visibilitychange',()=>{if(document.hidden && finish)settle(null);});
    async function camera(token){
      try{
        if(!root.isSecureContext)throw Error('Camera requires HTTPS or localhost');
        if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API unavailable');
        const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
        if(token!==session){acquired.getTracks().forEach(t=>t.stop());return;}
        stream=acquired;stream.getVideoTracks().forEach(t=>{t.onended=()=>{cleanup();status.textContent='Camera disconnected. Paste URL or reopen scanner / 摄像头已断开，可输入网址。';};});
        video.setAttribute('webkit-playsinline','');video.disablePictureInPicture=true;video.srcObject=stream;await video.play();if(token!==session || !stream)return;
        worker=new Worker((root.PO33_RESOURCE?root.PO33_RESOURCE('./qr-camera-worker.js'):'./qr-camera-worker.js'));
        worker.onerror=()=>{cleanup();status.textContent='QR decoder unavailable. Paste URL below / 扫码不可用，请输入网址。';};
        worker.onmessage=async({data:m})=>{
          if(token!==session)return;
          if(m.error){cleanup();status.textContent=m.error;return;}
          busy=false;if(m.text)settle(m.text);
        };
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
        if(!context)throw Error('Camera image access unavailable');
        status.textContent='Aim at project download QR / 对准工程下载二维码';
        function frame(){
          if(token!==session || !worker)return;
          timer=setTimeout(frame,200);
          if(busy || video.readyState<2 || !video.videoWidth)return;
          const scale=Math.min(1,480/Math.max(video.videoWidth,video.videoHeight));
          canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
          try{context.drawImage(video,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;busy=true;worker.postMessage({width:canvas.width,height:canvas.height,pixels:pixels.buffer},[pixels.buffer]);}
          catch(error){cleanup();status.textContent='Camera frame access failed. Paste URL / 无法读取画面，请输入网址。';}
        }
        frame();
      }catch(error){if(token!==session)return;cleanup();status.textContent=`${error.name || 'Camera'}: ${error.message || 'Unavailable'}. Paste URL below / 可在下方输入网址。`;}
    }
    return {get active(){return !!finish;},close:()=>settle(null),
      open(){if(finish)settle(null);root.dispatchEvent(new CustomEvent('po33-scan-state',{detail:{active:true}}));const token=++session;input.value='';status.textContent='Opening camera / 正在打开摄像头…';dialog.show();const result=new Promise(resolve=>{finish=resolve;});camera(token);return result;}
    };
  }
  root.PO33QRCamera={create};
})(window);
