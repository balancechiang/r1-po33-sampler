const file=document.querySelector('#projectFile'),status=document.querySelector('#status');
const frame=document.querySelector('#sampler'),details=document.querySelector('#details'),warnings=document.querySelector('#warnings');
let worker=null,ready=false,pending=null;
function send(){if(ready && pending){frame.contentWindow.postMessage({type:'po33-preview-project',project:pending},location.origin);pending=null;}}
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow || event.origin!==location.origin)return;
  if(event.data.type==='po33-preview-ready'){ready=true;send();}
  if(event.data.type==='po33-preview-loaded'){
    const s=event.data.summary;
    status.textContent='Loaded · 已加载。Click play on the panel to audition.';
    details.textContent=`${s.slots} sound slots · ${s.patterns} patterns · ${s.notes} notes · ${s.bpm} BPM · ${s.unavailableSlices} unavailable slices`;
    document.querySelector('#rangeNotice').textContent=s.unavailableSlices ? `${s.unavailableSlices} slices have unresolved source ranges and are silent in this preview. / ${s.unavailableSlices} 个切片地址尚未解析，试听中保持静音。` : 'All sample ranges resolved. / 所有采样范围均已解析。';
    status.dataset.state='loaded';file.disabled=false;
  }
  if(event.data.type==='po33-preview-error')fail(event.data.error);
});
function fail(message){status.textContent='Import failed · 导入失败：'+message;status.dataset.state='error';file.disabled=false;}
async function load(buffer){
  if(worker)worker.terminate();
  status.textContent='Decoding and validating · 正在解码与校验…';status.dataset.state='decoding';
  file.disabled=true;details.textContent='';warnings.replaceChildren();
  worker=new Worker('./project-import-worker.js',{type:'module'});
  worker.onerror=()=>{worker.terminate();fail('Decoder could not run. Serve this folder with HTTP/HTTPS and build the browser codec.');};
  worker.onmessage=event=>{
    worker.terminate();
    if(event.data.error){fail(event.data.error);return;}
    const p=event.data.project;
    for(const message of p.warnings){const li=document.createElement('li');li.textContent=message;warnings.append(li);}
    pending=p;send();
  };
  worker.postMessage(buffer,[buffer]);
}
file.addEventListener('change',async()=>{try{if(file.files[0])await load(await file.files[0].arrayBuffer());}catch(error){fail(error.message);}});
// Local-only test fixture; the copyrighted audio is deliberately excluded from Git/releases.
if(new URLSearchParams(location.search).get('fixture')==='escalate'){
  try{const response=await fetch('./t/official-backup-tests/escalate.wav');if(!response.ok)throw Error('Local Escalate fixture unavailable. Choose your WAV above.');await load(await response.arrayBuffer());}
  catch(error){fail(error.message);}
}
