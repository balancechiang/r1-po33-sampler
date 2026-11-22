"""Release-gated audio unlock: prove real output after the very first touch."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required'])
  for release_gated,release_retry in [(False,True),(True,False),(True,True)]:
   c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   c.add_init_script("""window.audioContexts=[];window.outputAnalysers=[];window.phase='none';window.resumeAttempts=[];
   for(const event of ['pointerdown','pointerup','touchend','click'])window.addEventListener(event,()=>phase=event,{capture:true});
   const AC=window.AudioContext,originalResume=AC.prototype.resume;
   window.AudioContext=new Proxy(AC,{construct(C,args){const ctx=Reflect.construct(C,args);audioContexts.push(ctx);if(gated)ctx.suspend();return ctx;}});
   const gated="""+str(release_gated).lower()+""";
   AC.prototype.resume=function(){resumeAttempts.push(phase);if(gated&&!['pointerup','touchend','click'].includes(phase))return new Promise(()=>{});return originalResume.call(this);};
   const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(node,...rest){const result=connect.call(this,node,...rest);if(node instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;connect.call(this,meter);outputAnalysers.push(meter);}return result;};""")
   page=c.new_page();errors=[];
   if not release_retry:
    old=(root/'runtime-lifecycle.js').read_text(encoding='utf-8').replace("'pointerup','touchend','click',",'')
    page.route('**/runtime-lifecycle.js?*',lambda route:route.fulfill(body=old,content_type='application/javascript'))
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui16.html');page.wait_for_function('document.body.dataset.loading==="false"')
   if release_gated:assert page.evaluate('audioContexts.at(-1).state')=='suspended'
   page.locator('[data-act="play"]').tap()
   if not release_retry:
    page.wait_for_timeout(650);assert page.evaluate('audioContexts.at(-1).state')=='suspended'
    assert page.evaluate('outputAnalysers.every(m=>{const x=new Float32Array(m.fftSize);m.getFloatTimeDomainData(x);return x.every(v=>Math.abs(v)<.00001);})')
    print('PASS regression reproduced: pointerdown-only wake leaves first touch silent')
    c.close();continue
   page.wait_for_function('audioContexts.at(-1).state==="running"',timeout=3000)
   page.wait_for_function('outputAnalysers.some(m=>{const x=new Float32Array(m.fftSize);m.getFloatTimeDomainData(x);return x.some(v=>Math.abs(v)>.002);})',timeout=3000)
   assert page.locator('#lcdNumber').get_attribute('data-value')=='P01'
   page.wait_for_timeout(2100);assert page.locator('#lcdNumber').get_attribute('data-value')=='P02'
   page.locator('[data-act="play"]').tap();assert page.locator('#lcdNumber').get_attribute('data-value')=='132'
   # Expired context after lock: returning must rebuild, preserving project state.
   if release_retry:
    page.evaluate('window.dispatchEvent(new Event("scrollUp"))');page.wait_for_timeout(1300)
    for was_playing in [False,True]:
     if was_playing:page.locator('[data-act="play"]').tap()
     page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));")
     page.wait_for_timeout(100)
     page.evaluate("async()=>{const stale=audioContexts.at(-1);await stale.suspend();Object.defineProperty(stale,'state',{configurable:true,get:()=> 'running'});stale.resume=()=>Promise.resolve();}")
     count=page.evaluate('audioContexts.length')
     page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));")
     page.locator('[data-act="play"]').tap()
     assert page.evaluate('audioContexts.length')==count+1
     page.wait_for_function('audioContexts.at(-1).state==="running"')
     page.wait_for_function('outputAnalysers.filter(m=>m.context===audioContexts.at(-1)).some(m=>{const x=new Float32Array(m.fftSize);m.getFloatTimeDomainData(x);return x.some(v=>Math.abs(v)>.002);})')
     assert page.locator('#lcdNumber').get_attribute('data-value')=='P01'
     page.locator('[data-act="play"]').tap()
     assert page.locator('#lcdNumber').get_attribute('data-value')=='133'
     print('PASS first post-lock tap rebuilds graph with real audio, previously playing:',was_playing)
   assert not errors,errors
   print('PASS first touch has measured output > .002 and advances chain; second touch stops; release-gated:',release_gated,'attempts:',page.evaluate('resumeAttempts'))
   c.close()
  b.close()
finally:server.shutdown();server.server_close()
