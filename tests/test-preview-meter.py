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
  def active():return page.locator('#lcdMeter [data-active="true"]').count()
  for n in [1,5,9,16]:
   pad(n);page.wait_for_timeout(100);assert active()==0
   assert page.locator('#lcdOut').get_attribute('data-active')=='false'
  down('sound');pad(2);up();page.wait_for_timeout(100);assert active()==0
  down('play');up();page.wait_for_timeout(300)
  page.wait_for_function('document.querySelectorAll("#lcdMeter [data-active=true]").length>0')
  down('play');up();pad(5);page.wait_for_timeout(100);assert active()==0
  page.evaluate('testMelodic()')
  page.locator('[data-pad="13"]').dispatch_event('pointerdown',{'pointerId':3,'pointerType':'touch','bubbles':True})
  page.evaluate('testValue(0,16)');page.wait_for_timeout(100)
  assert page.locator('#lcdMeter').get_attribute('data-indicator-mode')=='level'
  up(3)
  assert not errors,errors
  print('PASS manual pad/SOUND previews blank, playback meter retained, parameter indicator retained')
  browser.close()
finally:server.shutdown();server.server_close()
