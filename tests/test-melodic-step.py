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
  page.route('**/app.js*',lambda route:route.fulfill(body=(root/'app.js').read_text().replace('  function applySnapshot(snapshot){','  window.testSnapshot=snapshotProject;window.testSeed=function(){state.slot=9;lastNote=0;lastNotes[8]=0;state.mode="STEP";patterns[seq.pattern-1].lanes.forEach(function(l){l.fill(-1);});patterns[seq.pattern-1].lanes[8]=[0,1,0,1,2,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];tweaks[8].filter=35;tweaks[8].resonance=42;paint();};window.testMelodic=function(){state.slot=1;lastNote=4;lastNotes[0]=4;state.mode="STEP";patterns[seq.pattern-1].lanes.forEach(function(l){l.fill(-1);});patterns[seq.pattern-1].lanes[0][12]=4;patterns[seq.pattern-1].lanes[0][0]=4;patterns[seq.pattern-1].lanes[0][14]=6;paint();};window.testValue=function(i,v){var spec=knobSpec(i);window.testAdjust(i,(v-spec[0])*100/(spec[2]-spec[1]));};window.testMode=function(m){tweakMode=m;};window.testAdjust=function(i,dir){syncKnobTarget(i);knobAngles[i]=knobPickup[i].target*KNOB_SWEEP;knobPickup[i].caught=true;adjustKnob(i,dir);};window.testVoices=0;var realVoice=voice;voice=function(){window.testVoices++;return realVoice.apply(null,arguments);};\n  function applySnapshot(snapshot){'),content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def button(key):return page.locator('#bpmMode' if key=='bpm' else '[data-act="'+key+'"]')
  def down(key,i=1,kind='touch'):button(key).dispatch_event('pointerdown',{'pointerId':i,'pointerType':kind,'button':0,'bubbles':True})
  def up(i=1,cancel=False):page.evaluate('d=>window.dispatchEvent(new PointerEvent(d.cancel?"pointercancel":"pointerup",{pointerId:d.id,bubbles:true}))',{'id':i,'cancel':cancel})
  def held(key):return 'hold-active' in (button(key).get_attribute('class') or '')
  def pad(n,i=3):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True});up(i)
  def snap():return page.evaluate('()=>{const s=testSnapshot();delete s.assets;return s;}')
  def code():return page.locator('#lcdNumber').get_attribute('data-value')
  def blinking():return 'record-armed-blink' in (page.locator('#lcdNumber').get_attribute('class') or '')
  page.evaluate('testMelodic()')
  def level(n):return page.locator('[data-pad="'+str(n)+'"]').get_attribute('data-led-level')
  page.locator('[data-pad="13"]').dispatch_event('pointerdown',{'pointerId':3,'pointerType':'touch','bubbles':True})
  before=snap()['tweaks'][0]
  for mode in [0,1,2]:
   page.evaluate('testMode('+str(mode)+')')
   page.evaluate('testValue(0,16)');assert code()=='016' and snap()['patterns'][0]['lanes'][0][12]==15
   page.evaluate('testValue(0,5)');assert code()=='005'
   for length in [1,2,3,4,5,16]:
    page.evaluate('testValue(1,'+str(length)+')');assert code()=='L'+str(length).zfill(2)
    for n in range(1,17):
     distance=(n-13)%16
     if n in [1,13]:assert level(n)=='bright'
     elif n==15:assert level(n)=='dim' and page.locator('[data-pad="15"]').get_attribute('data-led-reason')=='other-note'
     else:assert level(n)==('dim' if 0<distance<length else 'off'),(length,n,level(n))
  assert snap()['tweaks'][0]==before
  up(3);assert level(14)=='off' and level(16)=='off' and level(1)=='bright'
  assert snap()['extras'][0]['steps']['0:12']['length']==16
  pad(8);assert snap()['patterns'][0]['lanes'][0][7]==4 and snap()['extras'][0]['steps']['0:7']['length']==16
  assert not errors,errors
  print('PASS melodic note/gate in all modes, 001-016/L01-L16, wrapped temporary LEDs, filled LED priority and copied gate')
  browser.close()
finally:server.shutdown();server.server_close()
