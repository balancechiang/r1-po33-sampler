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
  page.route('**/app.js*',lambda route:route.fulfill(body=(root/'app.js').read_text().replace('  function applySnapshot(snapshot){','  window.testSnapshot=snapshotProject;\n  function applySnapshot(snapshot){'),content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def button(key):return page.locator('#bpmMode' if key=='bpm' else '[data-act="'+key+'"]')
  def down(key,i=1,kind='touch'):button(key).dispatch_event('pointerdown',{'pointerId':i,'pointerType':kind,'button':0,'bubbles':True})
  def up(i=1,cancel=False):page.evaluate('d=>window.dispatchEvent(new PointerEvent(d.cancel?"pointercancel":"pointerup",{pointerId:d.id,bubbles:true}))',{'id':i,'cancel':cancel})
  def held(key):return 'hold-active' in (button(key).get_attribute('class') or '')
  def pad(n,i=3):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True});up(i)
  def snap():return page.evaluate('()=>{const s=testSnapshot();delete s.assets;return s;}')
  def code():return page.locator('#lcdNumber').get_attribute('data-value')
  def blinking():return 'record-armed-blink' in (page.locator('#lcdNumber').get_attribute('class') or '')
  initial=snap()
  for kind,target in [('sound',2),('pattern',2)]:
   before=snap();down('write');down(kind,2)
   assert code()=='CPy' and blinking(),(kind,code())
   page.wait_for_timeout(100);assert snap()==before,'copy modified data before paste'
   pad(target);assert code()=='CPy' and not blinking()
   source=page.locator('[data-pad="1"]');assert source.get_attribute('data-led-reason')=='copy-source'
   assert source.locator('.led').evaluate('(e)=>getComputedStyle(e).animationDuration')=='0.6s'
   after=snap()
   if kind=='sound':assert after['slots'][1]==before['slots'][0]
   else:assert after['patterns'][1]==before['patterns'][0] and after['extras'][1]==before['extras'][0]
   pad(3);assert code()=='CPy' and not blinking()
   after=snap()
   if kind=='sound':assert after['slots'][2]==before['slots'][0]
   else:assert after['patterns'][2]==before['patterns'][0]
   up(2);up();assert code()!='CPy' and not blinking()
  # Either order also arms pattern copy; no destination means no data changes.
  before=snap();down('pattern');down('write',2);assert code()=='CPy' and blinking();up(2);up();assert snap()==before
  # Destination stays selected when the modifier is opened next time.
  down('sound');assert snap()['slot']==3;up()
  down('pattern');assert snap()['pattern']==3 and code()=='P03';pad(16);assert code()=='P16';up()
  # Drum -> melodic extracts the last played slice, not slice 1.
  down('sound');pad(9);up();pad(5)
  before=snap();down('sound');down('write',2);pad(7)
  copied=snap()['slots'][6];source=before['slots'][8]
  assert abs(copied['offset']-(source['offset']+4*source['duration']/16))<.0001
  up(2);up()
  # Official two-stage slice paste: destination sound then destination slice.
  down('sound');pad(9);up();pad(5)
  original=snap()['slots'][9];down('write');down('sound',2);pad(10);pad(3)
  copied=snap()['slots'][9]['slices'][2]
  assert abs(copied['offset']-(source['offset']+4*source['duration']/16))<.0001
  untouched=snap()['slots'][9]['slices'][0]
  assert untouched['asset']==original['asset'] and abs(untouched['offset']-original['offset'])<.0001
  assert page.locator('[data-pad="10"]').get_attribute('data-led-reason')=='copy-target'
  assert page.locator('[data-pad="10"] .led').evaluate('(e)=>getComputedStyle(e).animationDuration')=='1.2s'
  up(2);up()
  # Single-finger latch still works.
  down('write');page.wait_for_timeout(850);up();down('sound');page.wait_for_timeout(850);up()
  assert held('write') and held('sound') and blinking()
  pad(4);assert not blinking();down('sound');up();down('write');up();assert code()!='CPy'
  assert not errors,errors
  print('PASS sound/pattern: armed blink, immediate overwrite, selected destination, drum extraction, slice paste and latched copy')
  browser.close()
finally:server.shutdown();server.server_close()
