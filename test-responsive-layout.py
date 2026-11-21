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
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  for w,h in [(240,282),(390,844),(430,932),(844,390),(1024,768)]:
   page=b.new_page(viewport={'width':w,'height':h},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui11.html');page.wait_for_function('document.body.dataset.loading==="false"')
   page.wait_for_timeout(450)
   box=page.locator('#instrument').bounding_box();assert box['x']>=-.1 and box['y']>=-.1 and box['x']+box['width']<=w+.1 and box['y']+box['height']<=h+.1,box
   assert page.locator('.pad').count()==16
   assert page.locator('#lcdNumber').evaluate('e=>getComputedStyle(e).fontFamily').startswith('DSEG7')
   # Display and controls have no overlapping content; only the intended reset area is interactive.
   meter=page.locator('#lcdMeter').bounding_box();sound=page.locator('[data-act="sound"]').bounding_box();assert meter['y']+meter['height']<sound['y']+sound['height']/2
   if w==240:assert page.locator('#instrument').get_attribute('data-layout')=='compact' and abs(sound['y']-33.8)<.2,sound
   if w==390:
    assert abs(page.locator('#tapeHead').evaluate('e=>e.parentElement.transform.baseVal.consolidate().matrix.a')-2.5185)<.001
    screen=page.locator('#samplerScreen').bounding_box();assert screen['y']+screen['height']-(meter['y']+meter['height'])>12*box['width']/240
   if w==390:page.screenshot(path=str(root/'t/mobile-ui9.png'))
   if w==240:page.screenshot(path=str(root/'t/r1-ui9.png'))
   page.locator('[data-act="play"]').tap();page.wait_for_timeout(2300);assert page.locator('#lcdNumber').get_attribute('data-value')=='P02'
   page.locator('[data-act="play"]').tap();assert page.locator('#lcdNumber').get_attribute('data-value')=='132'
   page.locator('[data-act="write"]').tap();assert page.locator('body').get_attribute('data-mode')=='STEP'
   assert not errors,errors
   print('PASS',w,h,box)
   page.close()
  b.close()
finally:server.shutdown();server.server_close()
