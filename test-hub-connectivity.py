from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
  context=browser.new_context(ignore_https_errors=True,viewport={'width':240,'height':282})
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
  page.evaluate('PO33Transfer.open("receive")');page.locator('#transferHub').click()
  page.locator('#hubIP').fill('localhost')
  for button,endpoint in [('#hubConnect','https://localhost:33033'),('#hubTestHTTP','http://localhost:33034')]:
   page.locator(button).click()
   page.wait_for_function('document.querySelector("#hubStatus").textContent.includes("Bridge OK")')
   assert endpoint in page.locator('#hubStatus').text_content()
   assert page.locator('#hubFiles button').count()>=1
  page.route('http://127.0.0.2:33034/bridge',lambda r:r.abort())
  page.locator('#hubIP').fill('127.0.0.2');page.locator('#hubTestHTTP').click()
  page.wait_for_function('document.querySelector("#hubStatus").textContent.includes("3s timeout")',timeout=7000)
  assert 'http://127.0.0.2:33034' in page.locator('#hubStatus').text_content()
  assert page.locator('#hubTestHTTP').is_enabled()
  page.locator('#hubLoadFile').click();assert not page.locator('#localHubPanel').is_visible()
  assert not errors,errors
  browser.close();print('PASS HTTPS and HTTP bridge list, endpoint reporting, timeout/retry and Load File. Physical R1 unverified.')
finally:server.shutdown();server.server_close()
