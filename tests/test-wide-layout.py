"""Desktop/tablet shell, input-specific hints, current-page QR and compact fallback."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  for width,height,touch in [(1400,800,False),(1920,1080,False),(1024,768,True),(1366,1024,True),(390,844,True),(932,430,True),(768,1024,True),(240,282,True)]:
   context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch);page=context.new_page();errors=[];missing=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:missing.append(r.url) if r.status>=400 else None)
   page.goto(base+'index.html?check=layout');page.wait_for_function('document.body.dataset.loading==="false"');wide=width>=900 and (not touch or height>=600)
   assert page.locator('body').get_attribute('data-wide')==str(wide).lower()
   panel=page.locator('#instrument').bounding_box();assert panel['x']>=0 and panel['y']>=0 and panel['x']+panel['width']<=width and panel['y']+panel['height']<=height
   if wide:
    page.wait_for_function('document.querySelector("#pageQRCode canvas")')
    frame=page.locator('#portraitStage').bounding_box();assert abs(frame['x']+frame['width']/2-width/2)<1
    assert page.locator('#portraitStage').get_attribute('data-rotated')=='false'
    assert page.locator('#inputHints').get_attribute('data-input')==('touch' if touch else 'keyboard')
    assert page.locator('#pageShare').inner_text()==''
    assert page.locator('#wideDisclaimer').inner_text()=='Not affiliated with Teenage Engineering.'
    assert page.locator('#wideDisclaimer').is_visible() and 'Teenage Engineering' in page.locator('#wideDisclaimer').text_content()
    left=page.locator('#inputHints').bounding_box();right=page.locator('#pageShare').bounding_box();assert left['x']+left['width']<frame['x'] and right['x']>frame['x']+frame['width']
    assert page.locator('#wideDisclaimer').bounding_box()['y']>frame['y']+frame['height']
    page.add_script_tag(url=base+'vendor/jsqr/jsQR.js')
    decoded=page.evaluate('''()=>{const q=document.querySelector('#pageQRCode canvas'),c=document.createElement('canvas');c.width=q.width+32;c.height=q.height+32;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.drawImage(q,16,16);return jsQR(x.getImageData(0,0,c.width,c.height).data,c.width,c.height)?.data;}''');assert decoded==base,decoded
    if touch:
     page.mouse.click(left['x']+5,left['y']+5);assert page.locator('#inputHints').get_attribute('data-input')=='keyboard'
     page.touchscreen.tap(left['x']+5,left['y']+5);assert page.locator('#inputHints').get_attribute('data-input')=='touch'
    page.screenshot(path=str(root/f't/wide-{width}-preview.png'))
   else:
    assert not page.locator('#inputHints').is_visible() and not page.locator('#pageShare').is_visible() and not page.locator('#wideDisclaimer').is_visible()
    assert abs(page.locator('#instrument').evaluate('e=>parseFloat(e.style.width)')-min(width,height))<1
   assert not errors,errors;assert not missing,missing;print('PASS',width,height,'touch' if touch else 'mouse','wide' if wide else 'compact/fullscreen');context.close()
  browser.close()
finally:server.shutdown();server.server_close()
