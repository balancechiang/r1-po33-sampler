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
  page=b.new_page(viewport={'width':480,'height':564});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  def el(k):return page.locator('#bpmMode' if k=='bpm' else '[data-pad="'+k[3:]+'"]' if k.startswith('pad') else '[data-act="'+k+'"]')
  def down(k,i=1):el(k).dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,pointerType:"touch",bubbles:true}))',i)
  def latch(k):down(k);page.wait_for_timeout(550);up();assert 'hold-active' in (el(k).get_attribute('class') or ''),k
  def tap(k):down(k);up()
  def meta():page.wait_for_timeout(400);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
  for k in ['bpm','fx','pattern','sound','rec','write']:
   latch(k);tap(k);assert 'hold-active' not in (el(k).get_attribute('class') or ''),k
  latch('fx');latch('pattern');assert 'hold-active' not in el('fx').get_attribute('class');tap('pattern')
  down('bpm');down('pad8',2);page.wait_for_timeout(600);up(2);up();assert 'hold-active' not in el('bpm').get_attribute('class')
  down('bpm');page.wait_for_timeout(350);up();assert meta()['bpm']==132
  latch('pattern');tap('pad3');tap('pad1');tap('pad3');tap('pattern');assert meta()['chain']==[3,1,3]
  # Real combinations consume the pending latch, including knob movement.
  down('bpm');page.locator('#knobA').dispatch_event('wheel',{'deltaY':-1,'bubbles':True});page.wait_for_timeout(550);up();assert 'hold-active' not in el('bpm').get_attribute('class')
  down('pad5');page.wait_for_timeout(550);up();assert 'hold-active' not in el('pad5').get_attribute('class')
  # A latched recording ends on the target finger release and drops only RECORD.
  latch('rec');down('pad6',2);page.wait_for_function('document.body.classList.contains("recording")');up(2)
  page.wait_for_function('!document.body.classList.contains("recording")');assert 'hold-active' not in el('rec').get_attribute('class')
  # FX remains armed across momentary punches.
  tap('play');latch('fx');down('pad5',2);page.wait_for_timeout(80);up(2);assert 'hold-active' in el('fx').get_attribute('class');tap('fx');tap('play')
  # Both fingers can arm the explicitly allowed pair concurrently.
  down('write');down('sound',2);page.wait_for_timeout(550);up(2);up();assert page.locator('.transfer-latched').count()==2
  tap('sound');tap('write')
  latch('sound');page.screenshot(path=str(root/'t/touch-state-preview.png'));tap('sound')
  # Virtual RECORD must never delete a sample by touching SOUND.
  before=page.locator('.pad.sampled').count();latch('rec');down('sound');page.wait_for_timeout(1900);up();assert page.locator('.pad.sampled').count()==before
  if 'hold-active' in el('sound').get_attribute('class'):tap('sound')
  # Physical deletion requires the entire 1.8 second overlap; early release aborts.
  down('rec');down('sound',2);page.wait_for_timeout(800);up(2);up();assert page.locator('.pad.sampled').count()==before
  down('rec');down('sound',2);page.wait_for_timeout(1900);up(2);up();assert page.locator('.pad.sampled').count()==before-1
  # Sequential one-finger triple command, consumed latches clear immediately.
  latch('write');latch('sound');tap('rec');page.wait_for_timeout(200);assert page.locator('.transfer-latched').count()==0
  assert page.locator('body').get_attribute('data-transfer')=='waiting'
  import sys,json;sys.path.insert(0,str(root/'t/qr-tools'));from PIL import Image
  img=Image.open(root/'install/creation-flowers-20261120-ui8-qr.png').convert('RGBA');w,h=img.size
  page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/vendor/jsqr/jsQR.js')
  decoded=page.evaluate('a=>jsQR(new Uint8ClampedArray(a.pixels),a.w,a.h).data',{'pixels':list(img.tobytes()),'w':w,'h':h})
  assert json.loads(decoded)==json.loads((root/'install/creation-flowers-20261120-ui8.json').read_text(encoding='utf-8'))
  assert not errors,errors
  print('PASS all six touch latches, replacement, action cancellation, short tap window, repeated chain, physical-only delayed deletion and triple receive')
  b.close()
finally:server.shutdown();server.server_close()

