"""Wheel focus moves request haptics once; performance wheel retains BPM behavior."""
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
  page=browser.new_page(viewport={'width':240,'height':282})
  page.add_init_script('window.pulses=[];Object.defineProperty(navigator,"vibrate",{configurable:true,value:n=>{pulses.push(n);return true;}})')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(700)
  def event(name):page.evaluate('name=>window.dispatchEvent(new Event(name))',name)
  def focus():return page.evaluate('document.activeElement.id')
  event('scrollUp');assert page.locator('#lcdNumber').get_attribute('data-value')=='121'
  assert page.evaluate('pulses.length')==0
  page.evaluate('PO33Transfer.open("receive")')
  event('scrollDown');assert focus()=='transferFile'
  event('scrollDown');assert focus()=='transferRecord'
  event('scrollDown');assert focus()=='transferClose' # skips hidden/disabled controls
  event('scrollUp');assert focus()=='transferRecord'
  assert page.evaluate('pulses')==[12]*4
  page.evaluate('window.dispatchEvent(new WheelEvent("wheel",{deltaY:1,cancelable:true}))')
  assert focus()=='transferClose';assert page.evaluate('pulses.length')==5
  page.locator('#transferDeviceToggle').click()
  event('scrollDown');assert focus()=='transferRefresh'
  assert page.evaluate('pulses.length')==6
  page.evaluate('document.querySelectorAll("#transferControls button,#transferControls select").forEach(e=>e.disabled=e.id!=="transferRefresh")')
  event('scrollDown');assert focus()=='transferRefresh';assert page.evaluate('pulses.length')==6
  page.evaluate('document.querySelector("#transferRefresh").disabled=true')
  event('scrollUp');assert page.evaluate('pulses.length')==6
  page.evaluate('Object.defineProperty(navigator,"vibrate",{value:undefined});document.querySelector("#transferFile").disabled=false')
  event('scrollDown');assert focus()=='transferFile'
  page.evaluate('PO33Transfer.close()')
  event('scrollUp');assert page.locator('#lcdNumber').get_attribute('data-value')=='122'
  assert not errors,errors
  print('PASS wheel focus order/wrap direction, mouse wheel, hidden/disabled skip, one 12ms pulse per actual move, no pulse with unchanged/no available focus, unsupported vibration tolerated, normal BPM control preserved.')
  browser.close()
finally:server.shutdown();server.server_close()
