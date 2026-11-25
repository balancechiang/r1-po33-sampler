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
  page.add_init_script("window.sessionTypes=[];let mode='auto';Object.defineProperty(navigator,'audioSession',{value:{get type(){return mode;},set type(v){mode=v;sessionTypes.push(v);}},configurable:true});window.workletOptions=[];const Node=window.AudioWorkletNode;window.AudioWorkletNode=class extends Node{constructor(c,n,o){super(c,n,o);if(n==='po33-recorder')workletOptions.push(o);}};")
  page.add_init_script("window.micStreams=[];window.micRequests=0;window.micDelay=0;const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{micRequests++;if(micDelay)await new Promise(r=>setTimeout(r,micDelay));const s=await gum(c);micStreams.push(s);return s;};")
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  def el(k):return page.locator('#bpmMode' if k=='bpm' else '[data-pad="'+k[3:]+'"]' if k.startswith('pad') else '[data-act="'+k+'"]')
  def down(k,i=1):el(k).dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,pointerType:"touch",bubbles:true}))',i)
  def latch(k):down(k);page.wait_for_timeout(850);up();assert 'hold-active' in (el(k).get_attribute('class') or ''),k
  def tap(k):down(k);up()
  def meta():page.wait_for_timeout(400);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
  def live():return page.evaluate('micStreams.flatMap(s=>s.getAudioTracks()).filter(t=>t.readyState==="live").length')
  page.wait_for_timeout(200);assert page.evaluate('micRequests')==0
  down('write');down('sound',2);down('rec',3);up(3);up(2);up();page.wait_for_timeout(220);page.locator('#transferDeviceToggle').click();page.locator('#sampleMicGain').select_option('12');page.locator('#transferClose').click();page.wait_for_timeout(220)
  down('rec');page.wait_for_function('document.body.dataset.captureState==="monitoring"');assert live()==1
  assert page.evaluate('navigator.audioSession.type')=='play-and-record';assert abs(page.evaluate('workletOptions.at(-1).processorOptions.inputGain')-3.9810717)<1e-6
  up();page.wait_for_timeout(100);assert live()==0;assert page.evaluate('navigator.audioSession.type')=='playback'
  latch('rec');assert live()==1;page.wait_for_timeout(200);assert live()==1
  tap('rec');page.wait_for_timeout(100);assert live()==0
  # Keep the worklet alive only long enough to commit its final buffered frames.
  down('rec');page.wait_for_function('document.body.dataset.captureState==="monitoring"');down('pad6',2);page.wait_for_function('document.body.classList.contains("recording")');page.wait_for_timeout(200);up(1)
  page.wait_for_function('!document.body.classList.contains("recording")');assert live()==0;up(2)
  # Permission resolving after release must never connect an inactive recorder.
  page.evaluate('micDelay=300');down('rec');up();page.wait_for_timeout(650);assert live()==0
  assert not errors,errors
  print('PASS no idle mic request; release and HOLD cancellation stop all tracks; final sample drains; late grant immediately stopped')
  b.close()
finally:server.shutdown();server.server_close()

