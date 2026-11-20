/* Binary asset storage. KV indexes switch only after verified asset transactions. */
(function(root){'use strict';
 let opening,namespace=null;const cache=new WeakMap();
 function db(){if(!namespace)return Promise.reject(Error('Sample storage scope unavailable'));if(opening)return opening;opening=new Promise((resolve,reject)=>{const r=indexedDB.open('po33-sample-assets-'+namespace,1),timer=setTimeout(()=>reject(Error('Asset storage timeout')),4000);r.onupgradeneeded=()=>{for(const name of ['assets','refs','pending'])r.result.createObjectStore(name);};r.onsuccess=()=>{clearTimeout(timer);r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};r.onblocked=()=>{clearTimeout(timer);reject(Error('Asset storage blocked'));};}).catch(e=>{opening=null;throw e;});return opening;}
 async function tx(names,mode,action){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(names,mode);let result;try{result=action(t);}catch(e){t.abort();reject(e);return;}const timer=setTimeout(()=>{try{t.abort();}catch{}reject(Error('Asset transaction timeout'));},5000);t.oncomplete=()=>{clearTimeout(timer);resolve(result?.result);};t.onerror=()=>{clearTimeout(timer);reject(t.error);};t.onabort=()=>{clearTimeout(timer);reject(t.error||Error('Asset transaction aborted'));};});}
 async function digest(rate,pcm){const bytes=new Uint8Array(8+pcm.byteLength);new DataView(bytes.buffer).setFloat64(0,rate,true);bytes.set(new Uint8Array(pcm),8);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function asset(buffer){if(!cache.has(buffer))cache.set(buffer,(async()=>{const pcm=buffer.getChannelData(0).slice().buffer;return {id:await digest(buffer.sampleRate,pcm),rate:buffer.sampleRate,pcm};})());return cache.get(buffer);}
 async function pack(slot,sample){
  const views=[sample,...(sample.sliceViews||[])].filter(Boolean),records=new Map();for(const v of views){const r=await asset(v.buffer);records.set(r.id,r);}
  const missing=[];for(const r of records.values())if(!await tx(['assets'],'readonly',t=>t.objectStore('assets').get(r.id)))missing.push(r);
  if(missing.length)await tx(['assets'],'readwrite',t=>{const store=t.objectStore('assets');for(const r of missing)store.put(r,r.id);});
  // Read back and hash before publishing any reference to the new buffers.
  for(const r of records.values()){const read=await tx(['assets'],'readonly',t=>t.objectStore('assets').get(r.id));if(!read || await digest(read.rate,read.pcm)!==r.id)throw Error('Asset verification failed');}
  async function view(v){if(!v)return null;return {asset:(await asset(v.buffer)).id,origin:v.buffer._po33id || null,offset:v.offset||0,duration:v.duration};}
  const manifest={format:4,base:await view(sample),slices:sample.sliceViews?await Promise.all(sample.sliceViews.map(view)):null};
  await tx(['pending'],'readwrite',t=>t.objectStore('pending').put(manifest,slot));return manifest;
 }
 function ids(m){return m?[m.base,...(m.slices||[])].filter(Boolean).map(v=>v.asset):[];}
 async function finish(slot,manifest){
  await tx(['refs','pending'],'readwrite',t=>{if(manifest)t.objectStore('refs').put(manifest,slot);else t.objectStore('refs').delete(slot);t.objectStore('pending').delete(slot);});
  await collect();
 }
 async function collect(){
  // Atomic collection protects both confirmed indexes and unfinished index switches.
  await tx(['assets','refs','pending'],'readwrite',t=>{const keep=new Set(),refs=t.objectStore('refs').getAll(),pending=t.objectStore('pending').getAll();let completed=0;
   function collect(){if(++completed!==2)return;for(const m of [...refs.result,...pending.result])for(const id of ids(m))keep.add(id);const cursor=t.objectStore('assets').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(!keep.has(c.key))c.delete();c.continue();};}refs.onsuccess=collect;pending.onsuccess=collect;});
 }
 async function reconcile(entries){
  await tx(['refs','pending'],'readwrite',t=>{for(const [slot,m] of entries){if(m)t.objectStore('refs').put(m,slot);else t.objectStore('refs').delete(slot);t.objectStore('pending').delete(slot);}});await collect();
 }
 async function unpack(m,context,pool){
  if(m.format!==4 || !m.base)throw Error('Invalid sample index');
  for(const id of new Set(ids(m))){if(!pool[id])pool[id]=(async()=>{const r=await tx(['assets'],'readonly',t=>t.objectStore('assets').get(id));if(!r || !(r.pcm instanceof ArrayBuffer) || await digest(r.rate,r.pcm)!==id)throw Error('Sample asset missing or corrupted');const pcm=new Float32Array(r.pcm),b=context.createBuffer(1,pcm.length,r.rate);b.copyToChannel(pcm,0);b._po33id=id;return b;})();}
  async function view(v){if(!v)return null;const b=await pool[v.asset];if(v.origin && String(v.origin).startsWith('factory-'))b._po33id=v.origin;if(!(v.duration>=0) || v.offset<0 || v.offset+v.duration>b.duration+.002)throw Error('Invalid asset region');return {buffer:b,offset:v.offset||0,duration:Math.min(v.duration,b.duration-(v.offset||0)),trim:0,pitch:0};}
  const sample=await view(m.base);if(m.slices)sample.sliceViews=await Promise.all(m.slices.map(view));return sample;
 }
 async function clear(){if(!namespace)return;await tx(['assets','refs','pending'],'readwrite',t=>{for(const n of ['assets','refs','pending'])t.objectStore(n).clear();});}
 root.PO33SampleAssets={configure(value){if(!/^[a-f0-9]{32}$/.test(value))throw Error('Invalid asset scope');if(namespace && namespace!==value)throw Error('Asset scope already selected');namespace=value;},get databaseName(){return namespace?'po33-sample-assets-'+namespace:null;},pack,unpack,finish,reconcile,clear};
})(window);
