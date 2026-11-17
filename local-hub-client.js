/* Hidden-frame LAN bridge; no direct cross-origin fetch or external service. */
(function(root){'use strict';
 root.PO33LocalHub={create(parent,hooks){
  const dialog=document.createElement('dialog');dialog.id='localHubPanel';
  dialog.innerHTML='<h2>LAN HUB (:33033)</h2><label>Computer IP / 电脑 IP<input id="hubIP" inputmode="decimal" placeholder="192.168.1.x" autocomplete="off"></label><p>Port :33033 · <select id="hubProtocol" aria-label="Hub protocol"><option value="https">HTTPS (default)</option><option value="http">HTTP fallback</option></select></p><div><button id="hubConnect">CONNECT / 连接</button><button id="hubTestHTTP">TEST HTTP :33034</button><button id="hubLoadFile">Load File</button><button id="hubClose">Close</button></div><p id="hubStatus" role="status"></p><a id="hubTrust" target="_blank" rel="noopener" hidden>Open hub / 打开证书信任页面</a><div id="hubFiles" role="list" aria-label="Local projects"></div>';
  parent.append(dialog);const $=id=>dialog.querySelector('#'+id);
  let frame=null,origin='',timer=null,pending=null,connected=false,generation=0;
  function hint(text){$('hubStatus').textContent=text;}
  function cleanup(){generation++;clearTimeout(timer);frame?.remove();frame=null;pending=null;connected=false;}
  function controls(busy){$('hubConnect').disabled=busy;$('hubTestHTTP').disabled=busy;for(const b of $('hubFiles').querySelectorAll('button'))b.disabled=busy;}
  function error(message){clearTimeout(timer);pending=null;controls(false);hint(message);}
  function send(message){frame?.contentWindow.postMessage({target:'po33-local-hub',...message},'*');}
  function open(){cleanup();$('hubFiles').replaceChildren();$('hubTrust').hidden=true;try{$('hubIP').value=localStorage.getItem('po33.localHub.ip')||'';}catch{}$('hubProtocol').value='https';controls(false);hint('Enter computer IP. Start npm run hub on computer. / 输入电脑 IP，电脑运行 npm run hub。');dialog.showModal();}
  function close(){cleanup();if(dialog.open)dialog.close();}
  async function connect(testHTTP=false){
   cleanup();const ip=$('hubIP').value.trim();
   if(ip!=='localhost' && !(/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)&&ip.split('.').every(n=>Number(n)<=255)))return error('Enter IPv4 only, without port / 仅输入 IPv4，无需端口');
   try{localStorage.setItem('po33.localHub.ip',ip);}catch{}
   origin=(testHTTP?'http':$('hubProtocol').value)+'://'+ip+':'+(testHTTP?'33034':'33033');$('hubTrust').href=origin;$('hubTrust').hidden=false;$('hubFiles').replaceChildren();
   frame=document.createElement('iframe');frame.hidden=true;frame.title='PO-33 Local Hub bridge';frame.src=origin+'/bridge';dialog.append(frame);
   controls(true);hint('Connecting '+origin+' / 正在连接…');
   timer=setTimeout(()=>{frame?.remove();frame=null;connected=false;error('3s timeout · '+origin+' / 未收到桥接回应。电脑需启动对应端口服务，并与 R1 同一 Wi-Fi。Creation 没有浏览器证书确认入口：HTTPS 可能因证书被拒绝；HTTP 可能被混合内容策略拦截。超时本身无法区分网络、证书或 WebView 限制。请尝试另一协议，或用 Load File。');},3000);
  }
  function requestFile(file){
   if(!connected)return;pending=file.name;controls(true);hint('Loading '+file.name+' / 正在读取本地工程');
   clearTimeout(timer);timer=setTimeout(()=>error('File transfer timed out. Retry or Load File / 文件传输超时，请重试或选择文件。'),120000);
   send({type:'GET_FILE',filename:file.name});
  }
  root.addEventListener('message',async e=>{
   if(!frame || e.source!==frame.contentWindow || e.origin!==origin || e.data?.source!=='po33-local-hub')return;
   const m=e.data;
   if(m.type==='READY'){
    clearTimeout(timer);connected=true;hint('Reading projects / 正在读取工程列表…');send({type:'GET_LIST'});
    timer=setTimeout(()=>error('List timed out / 工程列表超时'),10000);
   }else if(m.type==='LIST_RESULT'){
    if(!connected || !Array.isArray(m.payload))return;
    clearTimeout(timer);controls(false);$('hubFiles').replaceChildren();
    const files=m.payload.filter(f=>typeof f?.name==='string' && /\.(wav|json)$/i.test(f.name) && Number.isFinite(f.sizeBytes));
    hint(origin+' · '+files.length+' projects / 个工程 · Bridge OK');
    for(const file of files){const button=document.createElement('button');button.type='button';button.textContent=file.name+' · '+(file.sizeBytes/1048576).toFixed(1)+' MB';button.setAttribute('role','listitem');button.onclick=()=>requestFile(file);$('hubFiles').append(button);}
    $('hubFiles button')?.focus({preventScroll:true});
   }else if(m.type==='FILE_RESULT'){
    if(!pending || m.filename!==pending || !(m.buffer instanceof ArrayBuffer))return;
    clearTimeout(timer);if(m.buffer.byteLength>128*1024*1024)return error('File exceeds 128 MB');
    const name=pending,buffer=m.buffer;close();hooks.onFile(name,buffer);
   }else if(m.type==='ERROR')error(m.message || 'Hub error');
  });
  document.addEventListener('securitypolicyviolation',e=>{
   if(frame && e.blockedURI && (e.blockedURI===origin || e.blockedURI.startsWith(origin+'/'))){cleanup();controls(false);hint('Blocked by page security policy / 页面安全策略阻止连接：'+e.effectiveDirective+'。可改用 Load File。');}
  });
  $('hubConnect').onclick=()=>connect(false);$('hubTestHTTP').onclick=()=>connect(true);$('hubClose').onclick=()=>{close();hooks.onClose();};
  $('hubLoadFile').onclick=()=>{close();hooks.onClose();hooks.loadFile();};
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();hooks.onClose();});
  return {open,close,get active(){return dialog.open;},moveFocus(direction){
   const buttons=[...$('hubFiles').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
   if(index<0 || buttons.length<2)return false;
   buttons[(index+(direction>0?1:-1)+buttons.length)%buttons.length].focus({preventScroll:true});document.activeElement.scrollIntoView({block:'nearest'});
   try{navigator.vibrate?.(12);}catch{}return true;
  }};
 }};
})(window);
