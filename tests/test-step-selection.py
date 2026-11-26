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
  page.route('**/app.js*',lambda route:route.fulfill(body=(root/'app.js').read_text().replace('  function applySnapshot(snapshot){','  window.testSnapshot=snapshotProject;window.testSeed=function(){state.slot=9;lastNote=0;lastNotes[8]=0;state.mode="STEP";patterns[seq.pattern-1].lanes.forEach(function(l){l.fill(-1);});patterns[seq.pattern-1].lanes[8]=[0,1,0,1,2,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];tweaks[8].filter=35;tweaks[8].resonance=42;paint();};window.testAdjust=function(i,dir){syncKnobTarget(i);knobAngles[i]=knobPickup[i].target*KNOB_SWEEP;knobPickup[i].caught=true;adjustKnob(i,dir);};window.testVoices=0;var realVoice=voice;voice=function(){window.testVoices++;return realVoice.apply(null,arguments);};\n  function applySnapshot(snapshot){'),content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def button(key):return page.locator('#bpmMode' if key=='bpm' else '[data-act="'+key+'"]')
  def down(key,i=1,kind='touch'):button(key).dispatch_event('pointerdown',{'pointerId':i,'pointerType':kind,'button':0,'bubbles':True})
  def up(i=1,cancel=False):page.evaluate('d=>window.dispatchEvent(new PointerEvent(d.cancel?"pointercancel":"pointerup",{pointerId:d.id,bubbles:true}))',{'id':i,'cancel':cancel})
  def held(key):return 'hold-active' in (button(key).get_attribute('class') or '')
  def pad(n,i=3):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True});up(i)
  def snap():return page.evaluate('()=>{const s=testSnapshot();delete s.assets;return s;}')
  def code():return page.locator('#lcdNumber').get_attribute('data-value')
  def blinking():return 'record-armed-blink' in (page.locator('#lcdNumber').get_attribute('class') or '')
  page.evaluate('testSeed()')
  def level(n):return page.locator('[data-pad="'+str(n)+'"]').get_attribute('data-led-level')
  assert [level(n) for n in range(1,7)]==['bright','dim','bright','dim','dim','dim']
  page.locator('[data-pad="2"]').dispatch_event('pointerdown',{'pointerId':3,'pointerType':'touch','bubbles':True})
  page.wait_for_timeout(1050)
  assert code()=='CPy' and page.evaluate('testVoices')==1
  assert [level(n) for n in range(1,7)]==['dim','bright','dim','bright','dim','dim']
  up(3);pad(7);assert snap()['patterns'][0]['lanes'][8][6]==1 and level(7)=='bright'
  pad(1);assert level(1)=='off';pad(1);assert level(1)=='bright'
  # BPM cycles per-step retriggers without changing tempo or deleting the step.
  tempo=snap()['bpm']
  page.locator('[data-pad="2"]').dispatch_event('pointerdown',{'pointerId':3,'pointerType':'touch','bubbles':True})
  for count in [2,3,4,6,8,1]:
   down('bpm',4);up(4);assert code()=='tr'+str(count)
   assert snap()['extras'][0]['steps']['8:1']['retrigs']==count
  volume=snap()['tweaks'][8]['volume']
  page.evaluate('testAdjust(1,-10)');assert snap()['extras'][0]['locks']['8:1']['volume']==max(0,volume-10)
  assert snap()['tweaks'][8]['volume']==volume
  up(3);assert snap()['bpm']==tempo and snap()['patterns'][0]['lanes'][8][1]==1
  # Copy inherits the source filter and resonance.
  down('write');down('sound',2);pad(8);up(2);up()
  assert snap()['tweaks'][7]['filter']==35 and snap()['tweaks'][7]['resonance']==42
  assert not errors,errors
  print('PASS step note brightness, held-step audition/copy, remove/refill and copied filter')
  browser.close()
finally:server.shutdown();server.server_close()
