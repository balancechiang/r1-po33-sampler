process.chdir(require('node:path').resolve(__dirname,'..'));
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const root=new EventTarget(),doc=new EventTarget();doc.hidden=false;doc.body={dataset:{}};let requests=0,releases=0;
 const navigator={wakeLock:{request:async()=>{requests++;const s=new EventTarget();s.release=async()=>{releases++;s.dispatchEvent(new Event('release'));};return s;}}};
 vm.runInNewContext(fs.readFileSync('runtime-lifecycle.js','utf8'),{window:root,document:doc,navigator,Promise,Set,Map,WeakMap,WeakSet,Event});const r=root.PO33Runtime,tick=()=>new Promise(resolve=>setImmediate(resolve));
 r.setActive('music',true);await tick();assert.equal(requests,1);r.setActive('capture',true);r.setActive('music',false);await tick();assert.equal(releases,0);r.setActive('capture',false);await tick();assert.equal(releases,1);
 r.setActive('transfer',true);await tick();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await tick();doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(requests,3);
 let calls=0;const music={state:'suspended',resume(){calls++;if(calls===1)return new Promise(()=>{});this.state='running';return Promise.resolve();}},critical={state:'interrupted',resume(){throw Error('Critical stream must not resume');}};
 r.register(music);r.register(critical,true);r.resume(music);root.dispatchEvent(new Event('pointerdown'));await tick();assert.equal(calls,2);assert.equal(r.isBlocked(music),false);r.unregister(music);r.unregister(critical);
 for(const phase of ['pointerup','touchend','click']){let retries=0;const gated={state:'suspended',resume(){retries++;if(retries===1)return new Promise(()=>{});this.state='running';return Promise.resolve();}};r.register(gated);r.resume(gated);root.dispatchEvent(new Event(phase));await tick();assert.equal(gated.state,'running');assert.equal(retries,2);r.unregister(gated);}
 r.setActive('transfer',false);await tick();navigator.wakeLock.request=()=>{throw Error('unsupported')};r.setActive('music',true);await tick();assert.equal(doc.body.dataset.wakeLock,'unavailable');
 console.log('PASS screen-lease reference counts, visibility reacquisition, denied API fallback, autoplay pending resume retried on gesture, critical backup never auto-resumed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
