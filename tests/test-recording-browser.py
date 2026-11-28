import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
"""Real AudioWorklet capture levels, metering, stop-drain and failure isolation."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""
   window.captureMessages=[];window.legacyRecorders=0;
   const legacy=AudioContext.prototype.createScriptProcessor;
   AudioContext.prototype.createScriptProcessor=function(n,...args){if(n===4096)legacyRecorders++;return legacy.call(this,n,...args)};
   const Original=AudioWorkletNode;
   window.AudioWorkletNode=new Proxy(Original,{construct(Target,args){const node=new Target(...args);if(args[1]==='po33-recorder'){window.captureNode=node;node.port.addEventListener('message',e=>captureMessages.push(e.data));}return node;}});
   navigator.mediaDevices.getUserMedia=async opts=>{
    window.inputOptions=opts;const c=new AudioContext(),dest=c.createMediaStreamDestination(),b=c.createBuffer(1,c.sampleRate,c.sampleRate);b.getChannelData(0).fill(1);
    const src=c.createBufferSource();src.buffer=b;src.loop=true;window.inputGain=c.createGain();inputGain.gain.value=window.nextInput===undefined?.04:window.nextInput;src.connect(inputGain);inputGain.connect(dest);src.start();await c.resume();window.inputStream=dest.stream;return dest.stream;
   };
  """)
  page.route('**/app.js?*',lambda route:route.fulfill(response=route.fetch(),body=(root/'app.js').read_text().replace('  function startRec(slotNum) {','  window.armTest={remember:()=>{window.oldSample=samples[8];},status:()=>({phase:rec.phase,frames:rec.frames,mem:memLeft(),same:samples[8]===window.oldSample})};\n  function startRec(slotNum) {')))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(600);page.mouse.click(10,10)
  page.evaluate("""()=>{const detect=PO33Sampling.transientSlices;PO33Sampling.transientSlices=(data,rate)=>{window.takePeak=data.reduce((a,v)=>Math.max(a,Math.abs(v)),0);return detect(data,rate);}}""")
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def start(slot):down('[data-act="rec"]');down(f'[data-pad="{slot}"]',2);page.wait_for_function('document.body.dataset.captureState==="recording"')
  def finish():up(2);up();page.wait_for_function('!document.body.classList.contains("recording")')
  # Silent waiting must preserve both old PCM and memory until the threshold is crossed.
  page.evaluate('window.nextInput=0;armTest.remember()')
  down('[data-act="rec"]');down('[data-pad="9"]',2)
  page.wait_for_function('document.body.dataset.captureState==="armed"')
  before=page.evaluate('armTest.status()');page.wait_for_timeout(180);after=page.evaluate('armTest.status()')
  assert before['same'] and after['same'] and after['frames']==0 and before['mem']==after['mem'],(before,after)
  assert page.locator('#lcdNumber').get_attribute('data-value')=='rec'
  assert 'record-armed-blink' in page.locator('#lcdNumber').get_attribute('class')
  finish();assert page.evaluate('armTest.status().same')
  # Trigger, release only the pad, then retain silence until RECORD itself is released.
  page.evaluate('window.nextInput=0')
  down('[data-act="rec"]');down('[data-pad="9"]',2)
  page.wait_for_function('document.body.dataset.captureState==="armed"')
  page.evaluate('inputGain.gain.value=.04')
  page.wait_for_function('document.body.dataset.captureState==="recording"')
  up(2);page.wait_for_timeout(120)
  assert page.locator('body').get_attribute('data-capture-state')=='recording'
  page.evaluate('inputGain.gain.value=0');page.wait_for_timeout(100)
  assert page.locator('body').get_attribute('data-capture-state')=='recording'
  up();page.wait_for_function('!document.body.classList.contains("recording")')
  page.evaluate('window.nextInput=.04')
  start(9);page.wait_for_timeout(200)
  assert page.evaluate('inputOptions.audio')=={'echoCancellation':False,'noiseSuppression':False,'autoGainControl':False}
  assert page.evaluate('legacyRecorders')==0
  assert '.' in page.locator('#lcdNumber').get_attribute('data-value')
  finish();assert abs(page.evaluate('takePeak')-.04)<.0001
  start(9);page.evaluate('inputGain.gain.value=.99')
  page.wait_for_function('document.querySelector("#lcdMode").textContent==="CLP"')
  page.evaluate('inputGain.gain.value=0');page.wait_for_timeout(70)
  assert page.locator('#lcdMode').text_content()=='CLP'
  page.wait_for_timeout(260);assert page.locator('#lcdMode').text_content()!='CLP'
  assert page.locator('body').evaluate('e=>e.classList.contains("recording")') # no silence auto-stop
  finish();assert abs(page.evaluate('takePeak')-.99)<.0001
  # Enter transfer while capture is active: final partial chunk must be drained before mic teardown.
  start(5);page.wait_for_timeout(150);page.evaluate('PO33Transfer.open("receive")')
  assert page.locator('[data-pad="5"]').evaluate('e=>e.classList.contains("sampled")')
  assert page.evaluate('inputStream.getTracks().every(t=>t.readyState==="ended")')
  assert not page.locator('body').evaluate('e=>e.classList.contains("recording")')
  up(2);up();page.evaluate('PO33Transfer.close()')
  # A disconnect must restore the replaced sound and must not apply a delayed finish message.
  start(9);page.wait_for_timeout(100)
  page.evaluate('inputStream.getAudioTracks()[0].dispatchEvent(new Event("ended"))')
  page.wait_for_function('!document.body.classList.contains("recording")');page.wait_for_timeout(100)
  assert page.locator('[data-pad="9"]').evaluate('e=>e.classList.contains("sampled")')
  assert page.locator('#hint').text_content()=='INPUT DISCONNECTED'
  up(2);up();assert not errors,errors
  # A single-finger RECORD HOLD still ends the take when its pad is released.
  down('[data-act="rec"]')
  page.wait_for_function("document.querySelector('[data-act=rec]').classList.contains('hold-active')")
  up();down('[data-pad="9"]',2)
  page.wait_for_function('document.body.dataset.captureState==="recording"');page.wait_for_timeout(120);up(2)
  page.wait_for_function('!document.body.classList.contains("recording")')
  assert page.evaluate('inputStream.getTracks().every(t=>t.readyState==="ended")')
  unsupported=browser.new_page(viewport={'width':240,'height':282})
  unsupported.add_init_script("Object.defineProperty(window,'AudioWorkletNode',{value:undefined});navigator.mediaDevices.getUserMedia=()=>{throw Error('Input should not be requested')}")
  unsupported.goto(f'http://127.0.0.1:{server.server_port}/index.html');unsupported.wait_for_timeout(500);unsupported.mouse.click(10,10)
  unsupported.locator('[data-act="rec"]').dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True})
  unsupported.locator('[data-pad="9"]').dispatch_event('pointerdown',{'pointerId':2,'button':0,'bubbles':True})
  unsupported.wait_for_function('document.querySelector("#hint").textContent==="AUDIO WORKLET REQUIRED"')
  assert unsupported.locator('[data-pad="9"]').evaluate('e=>e.classList.contains("sampled")')
  assert not unsupported.locator('body').evaluate('e=>e.classList.contains("recording")')
  browser.close();print('PASS ARMED preserves PCM/memory, threshold trigger, physical pad release continues, HOLD finish releases mic; actual worklet: quiet/full-scale amplitudes preserved, requested DSP off, decimal countdown, RMS/CLP hold, silence retained, transfer drains recording, disconnect rolls back replacement.')
finally:server.shutdown();server.server_close()
