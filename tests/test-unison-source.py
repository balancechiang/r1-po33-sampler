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
  def active():return page.evaluate('fxVoices.filter(v=>v.start<=v.src.context.currentTime && v.end>v.src.context.currentTime && (v.cutAt===undefined || v.cutAt>v.src.context.currentTime)).map(v=>({rate:v.src.playbackRate.value,slot:v.slot,note:v.note,group:v.group}))')
  page.evaluate('uniTest.slotPitch();uniTest.fire(1,4,0);uniTest.on(5)');page.wait_for_timeout(40)
  voices=active();assert len(voices)==4,voices
  expected=[.98372,.99407,1.00439,1.01453]
  assert all(abs(v['rate']/2**(3/12)-r)<1e-5 for v,r in zip(voices,expected)),voices
  assert len({v['group'] for v in voices})==1
  routing=page.evaluate('uniTest.routing()');assert routing['engine']==0 and routing['dry']>.99 and routing['wet']<.001
  page.evaluate('uniTest.on(6)');page.wait_for_timeout(30);voices=active();assert len(voices)==4
  assert all(abs(v['rate']/2**(3/12)-r)<1e-5 for v,r in zip(voices,[1,1,.497,.503])),voices
  page.evaluate('uniTest.off()');page.wait_for_timeout(30);voices=active();assert len(voices)==1 and abs(voices[0]['rate']-2**(3/12))<1e-5
  page.evaluate('uniTest.fire(3,4,5)');page.wait_for_timeout(20);voices=active();assert len(voices)==4 and all(v['slot']==3 for v in voices)
  page.evaluate('uniTest.fire(9,8,6)');page.wait_for_timeout(20);voices=active();assert len(voices)==4 and all(v['slot']==9 and v['note']==8 for v in voices)
  assert not errors,errors
  print('PASS measured four-layer Unison/Low, live enter/switch/release, shared choke group, drum index and global four-voice stealing')
  b.close()
finally:server.shutdown();server.server_close()
