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
  context=browser.new_context(viewport={'width':393,'height':852},has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('Object.defineProperty(window,"innerHeight",{get:()=>1000});')
  page.goto(base);page.wait_for_function('document.body.dataset.loading==="false"')
  def check(top,bottom,height):
   page.wait_for_timeout(150)
   box=page.locator('#instrument').bounding_box()
   assert box['y']>=top-1,(top,box)
   assert box['y']+box['height']<=height-bottom+1,(bottom,height,box)
  check(0,0,852)
  # Safe-area insets can settle after startup without a window resize.
  page.evaluate('document.body.style.padding="59px 0px 34px"')
  check(59,34,852)
  page.evaluate('document.body.style.height="780px"')
  check(59,34,780)
  page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));document.dispatchEvent(new Event("visibilitychange"))')
  check(59,34,780)
  page.evaluate('document.body.style.height="852px";document.body.style.padding="62px 0px 34px"')
  check(62,34,852)
  page.evaluate('document.body.style.height="";Object.defineProperty(visualViewport,"height",{value:780,configurable:true});visualViewport.dispatchEvent(new Event("resize"))')
  check(62,34,780)
  page.screenshot(path=str(root/'t/pwa-safe-area-preview.png'))
  assert not errors,errors
  print('PASS stale innerHeight, late safe areas, actual body height and restored PWA layout')
  browser.close()
finally:server.shutdown();server.server_close()
