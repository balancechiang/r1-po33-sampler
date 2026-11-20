/* Best-effort visible screen lease and guarded audio resume; never resume a partial backup. */
(function(root){'use strict';
 const reasons=new Set(),contexts=new Map(),pendingResume=new WeakMap(),blocked=new WeakSet();let lease=null,request=null,revision=0;
 function mark(state){if(document.body.dataset.wakeLock!==state)document.body.dataset.wakeLock=state;}
 function sync(){const wanted=reasons.size>0 && !document.hidden;
  if(!wanted){revision++;if(lease){lease.release().catch(()=>{});lease=null;}mark('idle');return;}
  if(lease || request)return;if(!navigator.wakeLock?.request){mark('unavailable');return;}
  const token=revision;
  request=Promise.resolve().then(()=>navigator.wakeLock.request('screen')).then(async value=>{if(token!==revision || !reasons.size || document.hidden){await value.release();return;}lease=value;mark('active');value.addEventListener('release',()=>{if(lease===value){lease=null;mark('released');}});}).catch(()=>mark('unavailable')).finally(()=>{request=null;if(token!==revision && reasons.size && !document.hidden)sync();});
 }
 function resume(context,force=false){if(!context || context.state==='closed')return Promise.resolve(false);if(context.state==='running'){blocked.delete(context);return Promise.resolve(true);}if(pendingResume.has(context) && !force)return pendingResume.get(context);
  blocked.add(context);let action;try{action=context.resume();}catch(error){return Promise.resolve(false);}
  const p=Promise.resolve(action).then(()=>{const ok=context.state==='running';if(ok)blocked.delete(context);return ok;}).catch(()=>false).finally(()=>{if(pendingResume.get(context)===p)pendingResume.delete(context);});pendingResume.set(context,p);return p;
 }
 function register(context,critical=false){contexts.set(context,critical);}
 function unregister(context){contexts.delete(context);blocked.delete(context);}
 function activate(){sync();if(document.hidden)return;for(const [c,critical] of contexts)if(!critical)resume(c,true);}
 for(const type of ['pointerdown','keydown','sideClick','longPressStart','scrollUp','scrollDown'])root.addEventListener(type,activate,{capture:true});
 document.addEventListener('visibilitychange',()=>{sync();if(!document.hidden)activate();});root.addEventListener('pagehide',()=>{reasons.clear();sync();});
 root.PO33Runtime={setActive(reason,active){if(active)reasons.add(reason);else reasons.delete(reason);sync();},register,unregister,resume,isBlocked:c=>blocked.has(c)};
})(window);
