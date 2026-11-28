"""Panel terminal display persistence and bright modifier LEDs in the real app."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   r=route.fetch();s=r.text().replace('return {open,close,readFile,moveFocus,','root.resultTest={end,fail,set};return {open,close,readFile,moveFocus,')
   route.fulfill(response=r,body=s)
  page.route('**/transfer-panel.js*',instrument)
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def down(sel):page.locator(sel).dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True})
  def up():page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:1,bubbles:true}))')
  for sel,reason in [('[data-act=pattern]','pattern'),('#bpmMode','volume')]:
   down(sel);lights=page.locator('[data-led-reason="'+reason+'"]')
   assert lights.count()>0
   assert lights.evaluate_all('a=>a.every(e=>e.dataset.ledLevel==="bright")')
   up()
  def code():return page.locator('#lcdNumber').get_attribute('data-value')
  page.evaluate('PO33Transfer.open("receive")')
  page.evaluate('resultTest.end("done")');assert code()=='end'
  page.wait_for_timeout(2800);assert code()=='end'
  page.keyboard.press('x');page.wait_for_function('document.querySelector("#lcdNumber").dataset.value!=="end"')
  page.evaluate('resultTest.set("sending","test")');page.locator('#transferStop').click()
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="stp"')
  page.wait_for_timeout(2800);assert code()=='stp'
  page.locator('#transferClose').click();page.wait_for_function('document.querySelector("#lcdNumber").dataset.value!=="stp"')
  page.evaluate('PO33Transfer.open("receive")');page.evaluate('resultTest.fail(new Error("test failure"))')
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="err"')
  page.wait_for_timeout(2800);assert code()=='err'
  page.locator('#transferClose').click();page.wait_for_function('document.querySelector("#lcdNumber").dataset.value!=="err"')
  assert not errors,errors
  browser.close();print('PASS bright PATTERN/volume LEDs and persistent end/stp/err until another control/key; explicit Stop cancels transfer.')
finally:server.shutdown();server.server_close()
