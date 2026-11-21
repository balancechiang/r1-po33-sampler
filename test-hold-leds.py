"""Idle/edit/play lamps and real long-press replacement of button/knob faces."""
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
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  page=b.new_page(viewport={'width':720,'height':846});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui7.html');page.wait_for_function('document.body.dataset.loading==="false"')
  def idle():assert page.locator('.pad:not([data-led-level="off"])').count()==0
  def click(act):page.locator('[data-act="'+act+'"]').click()
  def hold(selector):
   r=page.locator(selector).bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.wait_for_timeout(570);return r
  idle();click('write');assert page.locator('.pad[data-led-level="dim"],.pad[data-led-level="low"]').count()>0
  click('play');page.wait_for_timeout(150);assert page.locator('.pad[data-led-level="dim"],.pad[data-led-level="low"]').count()>0
  click('play');click('write');idle();click('play')
  for _ in range(15):
   assert page.locator('.pad[data-led-level="dim"],.pad[data-led-level="low"]').count()==0
   page.wait_for_timeout(40)
  click('play');idle()
  click('sound');assert page.locator('.hold-active').count()==0
  hold('[data-act="sound"]');page.mouse.up()
  assert page.locator('[data-act="sound"]').evaluate('e=>e.classList.contains("hold-active") && e.classList.contains("transfer-latched")')
  def label_info(selector):return page.locator(selector+' .hold-indicator').evaluate('e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return {text:e.textContent,display:s.display,color:s.color,weight:s.fontWeight,inside:t.left>=r.left-.1 && t.right<=r.right+.1 && t.top>=r.top-.1 && t.bottom<=r.bottom+.1,transform:s.transform,box:[r.left,r.top,r.right,r.bottom],ink:[t.left,t.top,t.right,t.bottom]};}')
  page.screenshot(path=r'C:/Users/Chiang-Workstation/Documents/ChatGPT/rabbit r1/ui5-stage/hold-debug.png')
  info=label_info('[data-act="sound"]');assert info['text']=='HOLD' and info['display']=='flex' and info['color']=='rgb(255, 0, 0)' and info['weight']=='900' and info['inside'],info
  assert page.locator('[data-act="sound"]').evaluate('e=>getComputedStyle(e).outlineStyle')=='none'
  r=hold('#knobA');assert page.locator('#knobA .knob-rotor').evaluate('e=>getComputedStyle(e).visibility')=='hidden'
  info=label_info('#knobA');assert info['display']=='flex' and info['inside'] and info['transform']=='none',info
  page.screenshot(path=r'C:/Users/Chiang-Workstation/Documents/ChatGPT/rabbit r1/ui5-stage/hold-preview.png')
  page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2-36);page.mouse.up()
  assert page.locator('#knobA .knob-rotor').evaluate('e=>getComputedStyle(e).visibility')=='visible'
  assert not page.locator('#knobA').evaluate('e=>e.classList.contains("hold-active")')
  click('sound');assert page.locator('.hold-active').count()==0;idle()
  # Dragging immediately still shows the moving rotor; it does not become a stationary hold.
  r=page.locator('#knobB').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2-30);page.wait_for_timeout(600)
  assert page.locator('#knobB .knob-rotor').evaluate('e=>getComputedStyle(e).visibility')=='visible';page.mouse.up()
  hold('#knobB');page.evaluate('window.dispatchEvent(new Event("blur"))');page.mouse.up();assert page.locator('.hold-active').count()==0
  assert not errors,errors
  b.close();print('PASS idle all off; occupancy only in editing; play has chase/voice lamps only; sticky modifier HOLD badge; knob HOLD hides rotor; labels stay inside, drag/release/blur cleanup intact.')
finally:server.shutdown();server.server_close()
