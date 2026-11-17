export const manager=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PO-33 Local Hub</title><style>body{background:#111;color:#eee;font:16px/1.5 system-ui;max-width:850px;margin:auto;padding:24px}button,input{font:inherit;padding:8px;background:#333;color:white;border:1px solid #777}a{color:#ff742e}#drop{border:2px dashed #777;padding:35px;text-align:center}#drop.over{border-color:#fe5000}li{display:flex;gap:15px;align-items:center;flex-wrap:wrap;padding:12px;border-bottom:1px solid #333}li a{flex:1;overflow-wrap:anywhere}small{color:#bbb}#status{white-space:pre-wrap}</style><h1>PO-33 Local Hub · :33033</h1><p>Local files only · No login · 不上传到 GitHub 或云端</p><div id="drop">Drop .wav / .json here<br>拖入工程文件，或选择文件<br><input id="files" type="file" accept=".wav,.json" multiple></div><p id="status" role="status"></p><button id="refresh">Refresh / 刷新</button><ul id="list"></ul><p>R1: Receive → LAN HUB → enter this computer's IP. HTTPS uses a local self-signed certificate; accept it manually in your browser if permitted. A separate WebView may still refuse it. Use Load File if necessary.</p><script>
const $=id=>document.getElementById(id);let busy=false;
async function list(){const r=await fetch('/api/list');if(!r.ok)throw Error(await r.text());const files=await r.json();$('list').replaceChildren();for(const f of files){const li=document.createElement('li'),a=document.createElement('a'),size=document.createElement('small'),del=document.createElement('button');a.href='/api/file?name='+encodeURIComponent(f.name);a.textContent=f.name;a.download=f.name;size.textContent=(f.sizeBytes/1048576).toFixed(2)+' MB · '+new Date(f.updatedAt).toLocaleString();del.textContent='Delete / 删除';del.onclick=async()=>{if(!confirm('Delete '+f.name+'?'))return;try{const r=await fetch(a.href,{method:'DELETE'});if(!r.ok)throw Error(await r.text());await list();}catch(e){$('status').textContent=e.message;}};li.append(a,size,del);$('list').append(li);}}
async function upload(files){if(busy)return;busy=true;try{for(const file of files){$('status').textContent='Uploading '+file.name;const r=await fetch('/api/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});if(!r.ok)throw Error(await r.text());}$('status').textContent='Saved locally / 已保存到电脑本地';await list();}catch(e){$('status').textContent=e.message;}finally{busy=false;$('files').value='';}}
$('files').onchange=e=>upload(e.target.files);$('refresh').onclick=()=>list().catch(e=>$('status').textContent=e.message);$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over')};$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');upload(e.dataTransfer.files)};list().catch(e=>$('status').textContent=e.message);
</script></html>`;
export const bridge=String.raw`<!doctype html><meta charset="utf-8"><title>PO-33 local bridge</title><script>
// Receive from this frame's actual parent only. Replies always go back to it.
window.addEventListener('message',async e=>{
 if(e.source!==window.parent || !e.data || e.data.target!=='po33-local-hub')return;
 let origin;try{origin=new URL(e.origin);}catch{return;}
 const allowed=e.origin===location.origin || e.origin==='https://balancechiang.github.io' || ['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
 if(!allowed)return;
 const m=e.data;if(!['GET_LIST','GET_FILE'].includes(m.type))return;
 try{
  const r=await fetch(m.type==='GET_LIST'?'/api/list':'/api/file?name='+encodeURIComponent(m.filename),{credentials:'omit'});
  if(!r.ok)throw Error(await r.text());
  if(m.type==='GET_LIST')window.parent.postMessage({source:'po33-local-hub',type:'LIST_RESULT',payload:await r.json()},'*');
  else{const buffer=await r.arrayBuffer();window.parent.postMessage({source:'po33-local-hub',type:'FILE_RESULT',filename:m.filename,buffer},'*',[buffer]);}
 }catch(error){window.parent.postMessage({source:'po33-local-hub',type:'ERROR',filename:m.filename,message:error.message},'*');}
});
window.parent.postMessage({source:'po33-local-hub',type:'READY'},'*');
</script>`;
