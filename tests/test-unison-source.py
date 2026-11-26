import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
import base64,struct,math,json
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
r=16000;pcm=struct.pack('<'+'h'*(r*2),*[int(12000*(.4+.6*i/(r*2))*math.sin(2*math.pi*220*i/r)) for i in range(r*2)]);wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(pcm))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,r,r*2,2,16)+b'data'+struct.pack('<I',len(pcm))+pcm).decode()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=b.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.fxVoices=[];const alloc=()=>{if(!window.PO33Sampling)return setTimeout(alloc,5);const a=PO33Sampling.allocate;PO33Sampling.allocate=(vs,v,c,n)=>{fxVoices.push(v);return a(vs,v,c,n);};};alloc();const wav="+json.dumps(wav)+";if(!localStorage.getItem('step-fx')){localStorage.setItem('step-fx','1');for(const slot of [1,2,3,4,5,9])localStorage.setItem('po33.install.web-sampler-20261126.po33.slot'+slot,btoa(JSON.stringify(wav)));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,hardwareTone:false,chain:[1]})));}")
  base=f'http://127.0.0.1:{server.server_port}/'
  def instrument(route):
   r=route.fetch();code=r.text().rsplit('})();',1)[0]+"window.uniTest={fire:(slot,pad,effect)=>voice(slot,pad,undefined,undefined,effect),on:n=>fxEngage(n),off:()=>fxRelease(),slotPitch:()=>{tweaks[0].pitch=3;manualParameter(1,'pitch',3)},routing:()=>({engine:fx.engine.kind,dry:dryGain.gain.value,wet:fx.wet.gain.value})};})();";route.fulfill(response=r,body=code)
  page.route('**/app.js?*',instrument)
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes)lanes[0][i]=4;localStorage.setItem('po33.install.web-sampler-20261126.po33.pat1',btoa(JSON.stringify(lanes)));const m=JSON.parse(atob(localStorage.getItem('po33.install.web-sampler-20261126.po33.meta')));m.pattern=1;m.chain=[1];m.extras=Array.from({length:16},()=>({effects:Array(16).fill(a.kind),locks:{}}));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify(m)));}")
  def configure(kind,notes):
   page.evaluate("a=>localStorage.setItem('step-fx-config',JSON.stringify(a))",{'kind':kind,'notes':list(notes)});page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
  def down(act,i=1):page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def pad(n,i=2):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def play():page.locator('[data-act="play"]').click()
  configure(0,[])
  page.evaluate("uniTest.slotPitch();uniTest.fire(1,15,0);uniTest.fire(2,0,0);window.firstVoices=fxVoices.slice(-2);window.baseRates=firstVoices.map(v=>v.src.playbackRate.value)")
  page.evaluate('uniTest.on(5)');page.wait_for_timeout(30)
  rates=page.evaluate('firstVoices.map(v=>v.src.playbackRate.value)');assert abs(rates[0]-2**(3/12))<1e-5 and abs(rates[1]-1)<1e-5,rates
  assert page.evaluate('fxVoices.length')==2
  routing=page.evaluate('uniTest.routing()');assert routing['engine']==0 and routing['dry']>.99 and routing['wet']<.001,routing
  page.evaluate('uniTest.on(6)');page.wait_for_timeout(10)
  rates=page.evaluate('firstVoices.map(v=>v.src.playbackRate.value)');assert abs(rates[0]-2**(3/12)*.5)<1e-5 and abs(rates[1]-.5)<1e-5
  page.evaluate('uniTest.off()');page.wait_for_timeout(10)
  assert page.evaluate('firstVoices.every((v,i)=>Math.abs(v.src.playbackRate.value-baseRates[i])<1e-5)')
  assert page.evaluate('fxVoices.length')==2
  print('PASS live 05/06 align existing source rates to slot base / lower octave, no restart, no master-bus effect, release restores note rates')
  page.evaluate('uniTest.on(5);uniTest.fire(3,0,5);uniTest.fire(4,15,5);uniTest.fire(5,8,5)');assert page.evaluate('fxVoices.slice(-3).every(v=>Math.abs(v.src.playbackRate.value-1)<1e-6)')
  page.evaluate('uniTest.fire(9,8,6)');assert page.evaluate('fxVoices.at(-1).note===8 && fxVoices.at(-1).src.playbackRate.value===.5')
  events=page.evaluate('fxVoices.map(v=>({start:v.start,end:Math.min(v.end,v.cutAt===undefined?Infinity:v.cutAt)}))')
  assert all(sum(v['start']<=t+1e-7 and v['end']>t+1e-7 for v in events)<=4 for t in [v['start'] for v in events])
  assert not errors,errors;print('PASS future note mapping ignores pad offsets, drum index preserved, normal four-voice stealing retained')
  b.close()
finally:server.shutdown();server.server_close()
