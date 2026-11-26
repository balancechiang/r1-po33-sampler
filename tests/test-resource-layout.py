"""Load static and dynamically fetched assets from both supported entry points."""
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
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--autoplay-policy=no-user-gesture-required'])
  for entry in ['index.html','creation.html']:
   page=browser.new_page(viewport={'width':390,'height':844});missing=[];errors=[]
   page.on('response',lambda r:missing.append((r.status,r.url)) if r.status>=400 else None)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/'+entry)
   page.wait_for_function('document.body?.dataset.loading==="false"')
   page.wait_for_function('document.querySelectorAll("#tapeHead [data-part]").length>=5')
   page.locator('[data-act="play"]').click();page.wait_for_timeout(350)
   assert not missing,missing;assert not errors,errors
   print('PASS',entry,'static UI, articulated mascot and audio modules load without missing resources')
   page.close()
  browser.close()
finally:server.shutdown();server.server_close()
