from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required'])
  for bridge in [False,True]:
   c=b.new_context(viewport={'width':240,'height':282},is_mobile=True,has_touch=True)
   if bridge:c.add_init_script("window.creationStorage={plain:{getItem:async k=>{await new Promise(r=>setTimeout(r,35));return localStorage.getItem(k);},setItem:async(k,v)=>{await new Promise(r=>setTimeout(r,60));localStorage.setItem(k,v);},removeItem:async k=>{await new Promise(r=>setTimeout(r,20));localStorage.removeItem(k);}}};")
   c.add_init_script("window.testAudioContexts=[];const AC=window.AudioContext;window.AudioContext=new Proxy(AC,{construct(C,args){const ctx=Reflect.construct(C,args);testAudioContexts.push(ctx);return ctx;}});window.voiceStarts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){voiceStarts.push({state:this.context.state,time:this.context.currentTime,at:args[0]});return start.apply(this,args);};")
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui13.html');page.wait_for_function('document.body.dataset.loading==="false"')
   k='po33.install.flowers-20261120.po33.meta'
   def meta():return page.evaluate('k=>JSON.parse(atob(localStorage.getItem(k)))',k)
   def sample():return page.locator('#lcdNumber').get_attribute('data-value')
   page.wait_for_function('k=>!!localStorage.getItem(k)',arg=k)
   assert meta()['chain']==list(range(1,9)),meta()['chain']
   page.locator('[data-act="play"]').tap();seen=[]
   for i in range(48):
    seen.append(sample());page.wait_for_timeout(200)
   assert page.evaluate('testAudioContexts.some(c=>c.state==="running" && c.currentTime>5) && voiceStarts.some(s=>s.state==="running")')
   print('FIRST',bridge,list(dict.fromkeys(seen)),meta()['chain'])
   assert all('P'+str(i).zfill(2) in seen for i in range(1,6)),seen
   page.locator('[data-act="play"]').tap();page.wait_for_timeout(100);assert sample()=='132',sample()
   page.locator('[data-act="play"]').tap();page.wait_for_timeout(100);assert sample()=='P01',sample()
   page.locator('[data-act="play"]').tap()
   # Corrupt the saved current selection/chain, then use the real rabbit hold.
   page.evaluate('k=>{const m=JSON.parse(atob(localStorage.getItem(k)));m.pattern=2;m.chain=[2];localStorage.setItem(k,btoa(JSON.stringify(m)));}',k)
   page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
   head=page.locator('#factoryReset').bounding_box();x=head['x']+head['width']/2;y=head['y']+head['height']/2
   with page.expect_navigation(timeout=20000):
    page.locator('#factoryReset').dispatch_event('pointerdown',{'pointerId':91,'pointerType':'touch','button':0,'bubbles':True})
   page.wait_for_function('document.body.dataset.loading==="false"');assert meta()['chain']==list(range(1,9)),meta()['chain']
   page.wait_for_timeout(1600);page.locator('[data-act="play"]').tap();seen=[]
   for i in range(25):seen.append(sample());page.wait_for_timeout(200)
   assert 'P01' in seen and 'P02' in seen and 'P03' in seen,seen
   assert not errors,errors
   print('PASS first physical touch plays chain; stop BPM and restart at head; reset replaces saved [2] with demo chain:',bridge)
   c.close()
  b.close()
finally:server.shutdown();server.server_close()
