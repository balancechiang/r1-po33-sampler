import base64,struct,math,json
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
r=16000;pcm=struct.pack('<'+'h'*(r*2),*[int(12000*(.4+.6*i/(r*2))*math.sin(2*math.pi*220*i/r)) for i in range(r*2)]);wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(pcm))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,r,r*2,2,16)+b'data'+struct.pack('<I',len(pcm))+pcm).decode()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=b.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.fxVoices=[];const alloc=()=>{if(!window.PO33Sampling)return setTimeout(alloc,5);const a=PO33Sampling.allocate;PO33Sampling.allocate=(vs,v,c,n)=>{fxVoices.push(v);return a(vs,v,c,n);};};alloc();const wav="+json.dumps(wav)+";if(!localStorage.getItem('step-fx')){localStorage.setItem('step-fx','1');localStorage.setItem('po33.slot1',btoa(JSON.stringify(wav)));localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,hardwareTone:false,chain:[1]})));}")
  base=f'http://127.0.0.1:{server.server_port}/'
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes)lanes[0][i]=4;localStorage.setItem('po33.pat1',btoa(JSON.stringify(lanes)));const m=JSON.parse(atob(localStorage.getItem('po33.meta')));m.pattern=1;m.chain=[1];m.extras=Array.from({length:16},()=>({effects:Array(16).fill(a.kind),locks:{}}));localStorage.setItem('po33.meta',btoa(JSON.stringify(m)));}")
  def configure(kind,notes):
   page.evaluate("a=>localStorage.setItem('step-fx-config',JSON.stringify(a))",{'kind':kind,'notes':list(notes)});page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
  def down(act,i=1):page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def pad(n,i=2):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def play():page.locator('[data-act="play"]').click()
  for kind,count in [(3,2),(4,3)]:
   configure(kind,range(16));play();page.wait_for_timeout(430)
   entries=page.evaluate('fxVoices.filter(v=>v.performance.loop && v.end>v.start).map(v=>({start:v.start,gate:v.gateEnd-v.start,kind:v.performance.kind,step:v.performance.step,loop:v.src.loop,buffer:v.src.buffer._po33id}))')
   assert len(entries)>=5,(entries,errors)
   assert all(not e['loop'] and e['buffer'] and abs(e['gate']-.125/count)<1e-6 for e in entries),entries
   assert all(e['step']==entries[0]['step'] for e in entries),entries
   assert all(abs(b['start']-a['start']-.125/count)<1e-5 for a,b in zip(entries,entries[1:])),entries
   play();print('PASS native per-note retriggers every',.125/count,'seconds with original PCM and no mixed-audio loop')
  configure(0,[]);pad(5);up(2);play();page.evaluate('window.originalVoice=fxVoices.at(-1)');down('fx');pad(7);page.wait_for_timeout(25)
  mid=page.evaluate('originalVoice.src.playbackRate.value');assert 1<mid<2,mid
  page.wait_for_timeout(180);assert page.evaluate('originalVoice.src.playbackRate.value')>1.98
  pad(8,3);page.wait_for_timeout(180);assert .49<page.evaluate('originalVoice.src.playbackRate.value')<.52
  up(3);up(2);up(1);play();print('PASS octave glides on the same live source, no restart')
  configure(0,[0]);play();down('fx');pad(11);page.wait_for_timeout(330)
  slow=page.evaluate('fxVoices.filter(v=>v.performance.scratch).map(v=>({time:v.start,reverse:v.performance.reverse}))');assert len(slow)>=5,slow
  assert page.locator('[data-pad="1"]').evaluate('e=>e.classList.contains("cur")')
  assert page.evaluate('(()=>{const base=fxVoices.find(v=>v.performance.scratch&&!v.performance.reverse).src.buffer;return fxVoices.filter(v=>v.performance.scratch).every(v=>v.speed.events.length>=2 && (v.performance.reverse ? v.src.buffer.getChannelData(0)[123]===base.getChannelData(0)[base.length-124] : v.src.buffer===base));})()')
  assert all(slow[i]['reverse']!=slow[i-1]['reverse'] and abs(slow[i]['time']-slow[i-1]['time']-.0625)<.002 for i in range(1,len(slow))),slow
  page.evaluate('fxVoices=[]');pad(12,3);page.wait_for_timeout(180)
  fast=page.evaluate('fxVoices.filter(v=>v.performance.scratch).map(v=>v.start)');assert len(fast)>=5 and all(abs(fast[i]-fast[i-1]-.03125)<.002 for i in range(1,len(fast))),fast
  up(3);up(2);up(1);page.wait_for_function('document.getElementById("grid").children[1].classList.contains("cur")')
  down('fx');page.evaluate('fxVoices=[]');pad(11);page.wait_for_timeout(300);assert page.evaluate('fxVoices.length')==0
  up(2);up(1);play();assert not errors,errors
  print('PASS Scratch freezes current note or silence, alternates direction, Fast doubles hit rate, release resumes next step')
  geometry=page.evaluate('''async()=>{const doc=new DOMParser().parseFromString(await (await fetch('./panel-art.svg')).text(),'image/svg+xml');return ['fx','write'].every(key=>{const circle=doc.querySelector('[data-control="'+key+'"] circle');return circle.getAttribute('r')===doc.querySelector('[data-control="play"] circle').getAttribute('r')&&!circle.hasAttribute('stroke');})&&doc.querySelector('#stripes').getAttribute('patternTransform')==='rotate(45)';}''')
  assert geometry
  print('PASS FX/WRITE share normal backdrop radius, no rim stroke, 45-degree hatching')
  b.close()
finally:server.shutdown();server.server_close()
