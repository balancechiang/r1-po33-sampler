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
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   r=route.fetch();s=r.text().rsplit('})();',1)[0]+"window.knobTest={rotate:adjustKnob,mode:n=>{tweakMode=n;paint()},slot:n=>{state.slot=n;paint()},bpm:v=>{bpmHeld=v;paint()},external:v=>{tweaks[state.slot-1].pitch=v;manualParameter(state.slot,'pitch',v);paint()},write:v=>{writeHeld=v;seq.playing=v;paint()},state:()=>({extras:JSON.parse(JSON.stringify(patternExtras)),angles:knobAngles.slice(),pickup:JSON.parse(JSON.stringify(knobPickup)),tweaks:JSON.parse(JSON.stringify(tweaks)),bpm:params.bpm})};})();";route.fulfill(response=r,body=s)
  page.route('**/app.js?*',instrument);page.goto(f'http://127.0.0.1:{server.server_port}/creation.html');page.wait_for_function('document.body?.dataset.loading==="false" && window.knobTest')
  def state():return page.evaluate('knobTest.state()')
  def rotate(i,n):page.evaluate('a=>knobTest.rotate(...a)',[i,n])
  angles=state()['angles'];page.wait_for_timeout(250);assert state()['angles']==angles
  page.evaluate('knobTest.mode(1)');assert state()['angles']==angles
  rotate(0,30);assert abs(state()['tweaks'][0]['filter']-60)<.01;assert abs(state()['angles'][0]-216)<.01
  page.evaluate('knobTest.mode(0)');assert abs(state()['angles'][0]-216)<.01
  display=page.locator('#lcdNumber').get_attribute('data-value');rotate(0,-10);assert page.locator('#lcdNumber').get_attribute('data-value')==display;assert state()['tweaks'][0]['pitch']==0 and not state()['pickup'][0]['caught']
  rotate(0,-25);assert abs(state()['tweaks'][0]['pitch']+1.2)<.01 and state()['pickup'][0]['caught']
  page.evaluate('knobTest.slot(2)');old=state()['angles'];rotate(0,-10);assert state()['tweaks'][1]['pitch']==0
  rotate(0,20);assert abs(state()['tweaks'][1]['pitch']-1.2)<.01 and abs(state()['tweaks'][0]['pitch']+1.2)<.01
  old=state()['angles'];page.evaluate('knobTest.external(7)');assert state()['angles']==old
  rotate(0,1);assert state()['tweaks'][1]['pitch']==7 and not state()['pickup'][0]['caught']
  baseline=state()['extras'][0]['locks'];page.evaluate('knobTest.write(true)');rotate(0,1);assert state()['extras'][0]['locks']==baseline
  rotate(0,30);assert state()['extras'][0]['locks']!=baseline;page.evaluate('knobTest.write(false)')
  old=state()['angles'];page.evaluate('knobTest.bpm(true)');assert state()['angles']==old
  tempo=state()['bpm'];rotate(1,-10);assert state()['bpm']==tempo
  rotate(1,-55);assert state()['bpm']!=tempo and state()['pickup'][1]['caught']
  old=state()['angles'];page.evaluate('knobTest.bpm(false)');assert state()['angles']==old
  rotate(1,-1000);assert state()['angles'][1]==0;rotate(1,1000);assert state()['angles'][1]==270
  assert not errors,errors;print('PASS fixed physical angles, mode/slot/external-value pickup, no pre-catch parameter changes, both knobs and 0–270 degree stops');b.close()
finally:server.shutdown();server.server_close()
