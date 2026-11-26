/* Wide-screen presentation only; the instrument remains a single shared surface. */
(function(root){'use strict';
 let qrLibrary;
 function loadQR(){if(root.QRCode)return Promise.resolve();if(!qrLibrary)qrLibrary=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=root.PO33_RESOURCE('./vendor/qrcodejs/qrcode.min.js');script.onload=resolve;script.onerror=()=>reject(Error('QR unavailable'));document.head.append(script);});return qrLibrary;}
 root.WebSamplerWorkbench={create(stage){
  const shell=document.createElement('div');shell.id='workbench';stage.before(shell);
  const hints=document.createElement('aside');hints.id='inputHints';hints.setAttribute('aria-label','HOLD controls');
  hints.innerHTML='<p class="workbench-label" id="inputKind"></p><h2>HOLD</h2><p id="holdHint"></p><p id="releaseHint"></p><p id="combineHint"></p>';
  const share=document.createElement('aside');share.id='pageShare';share.setAttribute('aria-label','Open this page on another device');
  share.innerHTML='<div id="pageQRCode" role="img" aria-label="QR code for this page"></div>';
  shell.append(hints,stage,share);
  const footer=document.createElement('footer');footer.id='wideDisclaimer';footer.textContent='Not affiliated with Teenage Engineering.';shell.after(footer);
  function inputMode(touch){hints.dataset.input=touch?'touch':'keyboard';hints.querySelector('#inputKind').textContent=touch?'TOUCH':'MOUSE + KEYS';hints.querySelector('#holdHint').textContent=touch?'Long press to latch.':'Hold click to latch.';hints.querySelector('#releaseHint').textContent=touch?'Tap again to release.':'Click again to release.';hints.querySelector('#combineHint').textContent=touch?'Then tap another key.':'Shift + click to combine.';}
  inputMode(matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints>0&&!matchMedia('(pointer:fine)').matches));
  root.addEventListener('pointerdown',event=>{if(event.pointerType)inputMode(event.pointerType==='touch'||event.pointerType==='pen');},true);
  root.addEventListener('keydown',event=>{if(['Shift','Control','Alt','Meta','Tab','ArrowUp','ArrowDown'].includes(event.key))inputMode(false);},true);
  let qrStarted=false;
  return {setWide(wide){document.body.dataset.wide=String(wide);hints.hidden=share.hidden=footer.hidden=!wide;
    if(wide&&!qrStarted){qrStarted=true;const url=new URL(location.href);url.search='';url.hash='';url.pathname=url.pathname.replace(/(?:index|creation)\.html$/,'');share.dataset.url=url.href;
      loadQR().then(()=>{const box=share.querySelector('#pageQRCode');new root.QRCode(box,{text:url.href,width:128,height:128,colorDark:'#000000',colorLight:'#ffffff',correctLevel:root.QRCode.CorrectLevel.M});const img=box.querySelector('img');if(img)img.alt='Open Web Sampler on another device';}).catch(()=>{share.querySelector('#pageQRCode').textContent='QR unavailable';});
    }
  }};
 }};
})(window);
