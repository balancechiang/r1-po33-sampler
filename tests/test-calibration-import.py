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
  import sys
  for act,i in [('write',1),('sound',2),('rec',3)]:down(act,i)
  for i in [3,2,1]:up(i)
  page.locator('#transferFileInput').set_input_files(sys.argv[1])
  page.wait_for_function('document.body.dataset.transfer==="success" || document.body.dataset.transfer==="error"',timeout=90000)
  assert page.locator('body').get_attribute('data-transfer')=='success',page.locator('#transferHint').text_content()
  data=snap();assert data['nativePCM'] is True
  assert page.locator('#transferTone').text_content().endswith('OFF')
  assert data['bpm']==120 and data['chain']==list(range(1,17)),(data['bpm'],data['chain'])
  exported=page.evaluate('''async()=>{const m=await import("./decoder/browser/src/codec/po33WebProject.js"),p=await import("./decoder/browser/decoder/vendor/so-sample/pattern.js");const state=m.buildHardwareProject(testSnapshot()).raw.state;return Array.from({length:8},(_,i)=>p.readCell(state.patterns[2],i*2+1,1).volume);}''')
  assert exported==[1,9,18,27,36,45,54,63],exported
  fx={n for e in data['extras'] for n in e['effects'] if n};assert fx==set(range(1,16)),fx
  page.wait_for_timeout(3200);down('play');up();page.wait_for_timeout(300)
  assert page.locator('#lcdNumber').get_attribute('data-value')=='P01'
  down('play');up()
  page.evaluate('PO33Transfer.flush()');page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
  assert snap()['nativePCM'] is True
  assert not errors,errors
  print('PASS actual frontend import/play: 120BPM, 16-pattern chain, all 15 FX preserved')
  browser.close()
finally:server.shutdown();server.server_close()
