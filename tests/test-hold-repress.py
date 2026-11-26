"""An already latched modifier distinguishes a tap from another held press."""
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
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def button(key):return page.locator('#bpmMode' if key=='bpm' else '[data-act="'+key+'"]')
  def down(key,i=1,kind='touch'):button(key).dispatch_event('pointerdown',{'pointerId':i,'pointerType':kind,'button':0,'bubbles':True})
  def up(i=1,cancel=False):page.evaluate('d=>window.dispatchEvent(new PointerEvent(d.cancel?"pointercancel":"pointerup",{pointerId:d.id,bubbles:true}))',{'id':i,'cancel':cancel})
  def held(key):return 'hold-active' in (button(key).get_attribute('class') or '')
  for key in ['sound','pattern','bpm','fx','write','rec']:
   down(key);page.wait_for_timeout(850);up();assert held(key),key
   down(key);assert held(key),('unlatched on down',key)
   page.wait_for_timeout(850);up();assert held(key),('rehold release',key)
   down(key);up(cancel=True);assert held(key),('cancel',key)
   down(key);up();assert not held(key),('short tap did not unlock',key)
  print('PASS all six modifiers: repeat long press stays HOLD, canceled press preserves HOLD, short tap unlocks only on release')
  down('sound',kind='mouse');page.wait_for_timeout(850);up()
  down('sound',kind='mouse');page.wait_for_timeout(850);up();assert held('sound')
  # A second action consumes the short press; selecting a sound does not unlock.
  down('sound');page.locator('[data-pad="2"]').dispatch_event('pointerdown',{'pointerId':2,'pointerType':'touch','button':0,'bubbles':True});up(2);up();assert held('sound')
  down('sound');up();assert not held('sound')
  # PLAY can clear a latch while its repeat press is still physically down.
  down('fx');page.wait_for_timeout(850);up();down('fx')
  down('play',2);up(2);up();assert not held('fx')
  down('play');up()
  assert not errors,errors
  print('PASS mouse repeat hold, consumed chord retains latch and PLAY clears a physically repressed latch cleanly')
  browser.close()
finally:server.shutdown();server.server_close()
