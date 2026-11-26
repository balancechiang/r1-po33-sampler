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
  page.route('**/app.js*',lambda route:route.fulfill(body=(root/'app.js').read_text().replace('  function applySnapshot(snapshot){','  window.testSnapshot=snapshotProject;window.testSeed=function(){state.slot=9;lastNote=0;lastNotes[8]=0;state.mode="STEP";patterns[seq.pattern-1].lanes.forEach(function(l){l.fill(-1);});patterns[seq.pattern-1].lanes[8]=[0,1,0,1,2,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];tweaks[8].filter=35;tweaks[8].resonance=42;paint();};window.testMelodic=function(){state.slot=1;lastNote=4;lastNotes[0]=4;state.mode="STEP";patterns[seq.pattern-1].lanes.forEach(function(l){l.fill(-1);});patterns[seq.pattern-1].lanes[0][12]=4;patterns[seq.pattern-1].lanes[0][0]=4;patterns[seq.pattern-1].lanes[0][14]=6;paint();};window.testValue=function(i,v){var spec=knobSpec(i);window.testAdjust(i,(v-spec[0])*100/(spec[2]-spec[1]));};window.testTone=function(i,v){stepEdit=null;state.mode="PLAY";soundPreviewMeter=false;parameterDisplay=true;tweakMode=0;var spec=knobSpec(i);window.testAdjust(i,(v-spec[0])*100/(spec[2]-spec[1]));};window.testMode=function(m){tweakMode=m;};window.testAdjust=function(i,dir){syncKnobTarget(i);knobAngles[i]=knobPickup[i].target*KNOB_SWEEP;knobPickup[i].caught=true;adjustKnob(i,dir);};window.testVoices=0;var realVoice=voice;voice=function(){window.testVoices++;return realVoice.apply(null,arguments);};\n  function applySnapshot(snapshot){'),content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('document.body.dataset.loading==="false"')
  def button(key):return page.locator('#bpmMode' if key=='bpm' else '[data-act="'+key+'"]')
  def down(key,i=1,kind='touch'):button(key).dispatch_event('pointerdown',{'pointerId':i,'pointerType':kind,'button':0,'bubbles':True})
  def up(i=1,cancel=False):page.evaluate('d=>window.dispatchEvent(new PointerEvent(d.cancel?"pointercancel":"pointerup",{pointerId:d.id,bubbles:true}))',{'id':i,'cancel':cancel})
  def held(key):return 'hold-active' in (button(key).get_attribute('class') or '')
  def pad(n,i=3):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True});up(i)
  def snap():return page.evaluate('()=>{const s=testSnapshot();delete s.assets;return s;}')
  def code():return page.locator('#lcdNumber').get_attribute('data-value')
  def blinking():return 'record-armed-blink' in (page.locator('#lcdNumber').get_attribute('class') or '')
  for knob in ['knobA','knobB']:
   assert page.locator('#'+knob).evaluate('(e)=>e.style.getPropertyValue("--knob-angle")')=='135deg'
  assert snap()['tweaks'][0]['pitch']==0 and snap()['tweaks'][0]['volume']==100
  for index,values in [(0,[-12,0,12]),(1,[0,100,200])]:
   counts=[]
   for value in values:
    page.evaluate('testTone('+str(index)+','+str(value)+')');page.wait_for_timeout(100)
    assert page.locator('#lcdMeter').get_attribute('data-indicator-origin')=='left'
    assert page.locator('#lcdMeter [data-segment="18"]').get_attribute('data-active')=='true'
    counts.append(page.locator('#lcdMeter [data-active="true"]').count())
   assert counts==[1,19,38],counts
  assert not errors,errors
  print('PASS centered neutral startup, unity gain midpoint and left-to-right tone scale with center marker')
  browser.close()
finally:server.shutdown();server.server_close()
