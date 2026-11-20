"""A versioned install bypasses old preset URLs and isolates both saved-project stores."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  for bridge in [False,True]:
   context=browser.new_context(viewport={'width':240,'height':282})
   if bridge:context.add_init_script("window.creationStorage={plain:{getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v),removeItem:async k=>localStorage.removeItem(k)}};")
   legacy=context.new_page();legacy.goto(base+'index.html');legacy.wait_for_timeout(800)
   legacy.evaluate("""async()=>{localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:84})));localStorage.setItem('po33.slot5','legacy recording sentinel');localStorage.setItem('unrelated-setting','keep');await PO33TransferStorage.put({legacy:'checkpoint sentinel'});}""")
   # Main preset can be stale OR change after installation; the fixed edition must never fetch it.
   context.route('**/presets.js*',lambda route:route.fulfill(content_type='text/javascript',body='window.PO33_FACTORY={revision:99,slots:[],patterns:[]};'))
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));requested=[];page.on('request',lambda r:requested.append(r.url))
   page.goto(base+'flowers-20261120-play2.html');page.wait_for_timeout(1000)
   prefix='po33.install.flowers-20261120.'
   def meta():return page.evaluate('key=>JSON.parse(atob(localStorage.getItem(key)))',prefix+'po33.meta')
   assert meta()['bpm']==132 and meta()['chain']==list(range(1,9))
   assert page.locator('.pad.sampled').count()==8 and not page.evaluate('PO33Transfer.hasSession')
   assert page.evaluate('PO33_FACTORY.revision')==2
   assert not any('/presets.js' in u for u in requested)
   assert any('/install/presets-flowers-20261120.js?v=flowers-20261120-play2' in u for u in requested)
   assert page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).bpm')==84
   # Normal reopening keeps this edition's own work, instead of treating every launch as a fresh install.
   page.evaluate('()=>{for(let i=0;i<31;i++)window.dispatchEvent(new Event("scrollDown"));}');page.wait_for_timeout(500)
   page.reload();page.wait_for_timeout(850);assert meta()['bpm']==101
   # Imported checkpoints must also stay in this edition's database and survive reopening.
   for act,i in [('write',1),('sound',2),('rec',3)]:page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
   for i in [3,2,1]:page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
   page.wait_for_function('document.body.dataset.transfer==="waiting"')
   page.locator('#transferFileInput').set_input_files(str(root/'t/official-backup-tests/tiny-transfer-48000.wav'))
   page.wait_for_function('document.body.dataset.transfer==="success"',timeout=60000);page.wait_for_timeout(2800)
   page.reload();page.wait_for_timeout(900)
   assert page.evaluate('PO33Transfer.hasSession') and page.locator('.pad.sampled').count()==1
   # Rabbit reset restores the edition's immutable Flowers baseline, not today's live main preset.
   page.locator('#factoryReset').dispatch_event('pointerdown',{'pointerId':9,'button':0,'bubbles':True});page.wait_for_timeout(6800)
   page.wait_for_function('document.querySelectorAll(".pad.sampled").length===8',timeout=5000)
   assert meta()['bpm']==132 and meta()['chain']==list(range(1,9))
   assert not page.evaluate('PO33Transfer.hasSession')
   assert page.evaluate('localStorage.getItem("po33.slot5")')=='legacy recording sentinel'
   assert page.evaluate('localStorage.getItem("unrelated-setting")')=='keep'
   checkpoint=legacy.evaluate('PO33TransferStorage.get()');assert checkpoint=={'legacy':'checkpoint sentinel'},checkpoint
   assert not errors,errors
   context.close();print('PASS fixed Flowers install, stale main URL bypass, preserved legacy data/checkpoint, own save/reopen, immutable reset baseline:', 'creationStorage' if bridge else 'localStorage')
  # The published QR really encodes the new Creation descriptor.
  import sys;sys.path.insert(0,str(root/'t/qr-tools'));from PIL import Image
  img=Image.open(root/'install/creation-flowers-20261120-play2-qr.png').convert('RGBA');w,h=img.size
  context=browser.new_context();page=context.new_page();page.goto(base+'index.html');page.add_script_tag(url=base+'vendor/jsqr/jsQR.js')
  text=page.evaluate('a=>jsQR(new Uint8ClampedArray(a.pixels),a.w,a.h).data',{'pixels':list(img.tobytes()),'w':w,'h':h})
  expected=json.loads((root/'install/creation-flowers-20261120-play2.json').read_text(encoding='utf-8'));assert json.loads(text)==expected
  print('PASS real jsQR decoded the new versioned Creation installation QR')
  browser.close()
finally:server.shutdown();server.server_close()
