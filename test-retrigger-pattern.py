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
  page.add_init_script("window.fxVoices=[];const alloc=()=>{if(!window.PO33Sampling)return setTimeout(alloc,5);const a=PO33Sampling.allocate;PO33Sampling.allocate=(vs,v,c,n)=>{fxVoices.push(v);return a(vs,v,c,n);};window.spyReady=true;};alloc();const wav="+json.dumps(wav)+";if(!localStorage.getItem('step-fx')){localStorage.setItem('step-fx','1');for(let i=1;i<=5;i++)localStorage.setItem('po33.slot'+i,btoa(JSON.stringify(wav)));localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,hardwareTone:false,chain:[1]})));}")
  base=f'http://127.0.0.1:{server.server_port}/'
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){for(let p=1;p<=3;p++){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes){lanes[p-1][i]=i;if(p===1&&a.dense)for(let s=0;s<5;s++)lanes[s][i]=i;}localStorage.setItem('po33.pat'+p,btoa(JSON.stringify(lanes)));}const m=JSON.parse(atob(localStorage.getItem('po33.meta')));m.bpm=240;m.swing=0;m.pattern=1;m.chain=a.chain;m.extras=Array.from({length:16},()=>({effects:[],locks:{}}));if(a.jump)m.extras[0].effects[4]=14;localStorage.setItem('po33.meta',btoa(JSON.stringify(m)));}")
  def configure(notes=range(16),chain=[1,2,3],dense=False):
   page.evaluate("a=>localStorage.setItem('step-fx-config',JSON.stringify(a))",{'notes':list(notes),'chain':chain,'dense':dense});page.reload();page.wait_for_function('document.body.dataset.loading==="false" && window.spyReady')
  def down(act,i=1):page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def pad(n,i=2):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def play():page.locator('[data-act="play"]').click()
  def begin():
   play();page.wait_for_function('fxVoices.length>0');page.evaluate('window.origin=fxVoices[0].start')
  def at_step(n):page.wait_for_function('n=>document.getElementById("grid").children[n].classList.contains("cur")',arg=n)
  def resumed():
   page.evaluate('window.resumeIndex=fxVoices.length');up(2);up(1);page.wait_for_timeout(50)
   values=page.evaluate('fxVoices.slice(resumeIndex).filter(v=>!v.performance.loop && v.end>v.start).map(v=>({slot:v.slot,note:v.note,time:v.start,origin:window.origin}))')
   assert values,values
   first=values[0];step=int((first['time']-first['origin'])/.0625+1e-5);assert first['slot']==(step//16)%3+1 and first['note']==step%16,(first,step)
   page.wait_for_timeout(200)
   assert page.evaluate('fxVoices.slice(resumeIndex+1).filter(v=>!v.performance.loop&&v.end>v.start).every(v=>Math.abs((v.start-window.origin)/.0625-Math.round((v.start-window.origin)/.0625))<.03)')
   play()
  configure();begin();at_step(4);down('fx');page.evaluate('window.edgeIndex=fxVoices.length');pad(14);page.wait_for_timeout(350)
  es=page.evaluate('fxVoices.slice(edgeIndex).filter(v=>v.end>v.start).map(v=>({n:v.note,t:(v.start-window.origin)/.0625}))')
  assert es and es[0]['n']==0,es
  assert all(abs(e['t']-round(e['t']))<.03 for e in es),es
  assert [e['n'] for e in es[:5]]==list(range(5)),es
  up(2);up(1);page.wait_for_timeout(1100)
  assert page.evaluate('fxVoices.some(v=>v.slot===2)'), 'chain did not continue'
  play();print('PASS quantized rising edge resets once, held FX advances, chain continues')
  # A saved jump is evaluated every visit, even when consecutive ticks have FX14.
  page.evaluate("localStorage.setItem('step-fx-config',JSON.stringify({notes:Array.from({length:16},(_,i)=>i),chain:[1,2,3],jump:true}))");page.reload();page.wait_for_function('document.body.dataset.loading===\"false\" && window.spyReady');begin();page.wait_for_timeout(850)
  notes=page.evaluate('fxVoices.filter(v=>v.end>v.start).map(v=>v.note)')
  assert notes[:12]==[0,1,2,3,0,1,2,3,0,1,2,3],notes
  play();assert not errors,errors;print('PASS saved jump flag resets on every visit')
  b.close()
finally:server.shutdown();server.server_close()
