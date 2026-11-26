/* One-time, explicitly authorized test-data reset for the Web Sampler rename.
   Only known sampler keys and their referenced databases are removed. */
(function(root){'use strict';
 const current='po33.install.web-sampler-20261126.',marker='web-sampler.cleanup.20261126',pending=marker+'.pending';
 const base=['po33.meta','po33.asset-scope','po33.reset',...Array.from({length:16},(_,i)=>'po33.slot'+(i+1)),...Array.from({length:16},(_,i)=>'po33.pat'+(i+1))];
 const preferences=['po33.localHub.ip','po33.micGainDb','po33.micAutoLevel'];
 function bounded(action){return new Promise(resolve=>{const timer=setTimeout(()=>resolve({ok:false}),1500);Promise.resolve().then(action).then(value=>{clearTimeout(timer);resolve({ok:true,value});},()=>{clearTimeout(timer);resolve({ok:false});});});}
 function deleteDB(name){return new Promise(resolve=>{let settled=false;const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);resolve(ok);};const timer=setTimeout(()=>done(false),1500);try{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>done(true);r.onerror=()=>done(false);r.onblocked=()=>done(false);}catch{done(false);}});}
 async function run(){
  let local;try{local=root.localStorage;}catch{}
  const apis=[];try{if(root.creationStorage?.plain)apis.push(root.creationStorage.plain);}catch{}
  if(local)apis.push(local);
  const dbs=new Set(['po33-hardware-project','po33-hardware-project-flowers-20261120']);let ok=true,needsWork=false;
  try{for(const name of JSON.parse(localStorage.getItem(pending)||'[]'))if(/^po33-sample-assets-[a-f0-9]{32}$/.test(name)||name==='po33-hardware-project'||name==='po33-hardware-project-flowers-20261120')dbs.add(name);}catch{}
  for(const api of apis){
   const done=await bounded(()=>api.getItem(marker));if(done.ok&&done.value==='done')continue;needsWork=true;
   const prefixes=['','po33.install.flowers-20261120.'];
   // Other historical local installations can be enumerated without touching
   // the new user namespace or unrelated applications on the same origin.
   if(api===local){for(let i=0;i<api.length;i++){const key=api.key(i),match=/^(po33\.install\.[a-z0-9-]+\.)(po33\.(meta|asset-scope|reset|slot\d+|pat\d+))$/.exec(key||'');if(match&&match[1]!==current&&!prefixes.includes(match[1]))prefixes.push(match[1]);}}
   for(const prefix of prefixes){
    const scope=await bounded(()=>api.getItem(prefix+'po33.asset-scope'));
    if(scope.ok&&/^[a-f0-9]{32}$/.test(scope.value||''))dbs.add('po33-sample-assets-'+scope.value);
   }
   const results=await Promise.all([...prefixes.flatMap(prefix=>base.map(key=>prefix+key)),...preferences].map(key=>bounded(()=>api.removeItem(key))));
   if(results.some(r=>!r.ok)||!done.ok)ok=false;
  }
  if(!needsWork)return;
  try{localStorage.setItem(pending,JSON.stringify([...dbs]));}catch{ok=false;}
  const deleted=await Promise.all([...dbs].map(deleteDB));if(deleted.some(value=>!value))ok=false;
  if(ok){const saved=await Promise.all(apis.map(api=>bounded(()=>api.setItem(marker,'done'))));ok=saved.every(r=>r.ok);}
  if(ok)try{localStorage.removeItem(pending);}catch{}
  document.body.dataset.legacyCleanup=ok?'done':'pending';
 }
 root.PO33LegacyCleanup={run};
})(window);
