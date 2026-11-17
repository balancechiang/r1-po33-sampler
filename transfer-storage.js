/* A separate lossless checkpoint. Existing creationStorage keys stay untouched. */
(function(root){
  let database;
  async function db(){if(database)return database;database=await new Promise((resolve,reject)=>{const r=indexedDB.open('po33-hardware-project',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return database;}
  async function transaction(mode,action){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('projects',mode),r=action(t.objectStore('projects'));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error || Error('Checkpoint aborted'));});}
  root.PO33TransferStorage={get:()=>transaction('readonly',s=>s.get('current')),put:v=>transaction('readwrite',s=>s.put(v,'current')),clear:()=>transaction('readwrite',s=>s.delete('current'))};
})(window);
