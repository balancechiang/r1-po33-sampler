from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--autoplay-policy=no-user-gesture-required','--mute-audio'])
  page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   r=route.fetch();s=r.text().rsplit('})();',1)[0]+"window.syncTest={mode:setSyncMode,start:startSeq,stop:stopSeq,state:()=>({mode:syncMode,playing:seq.playing,steps:seq.totalSteps,bpm:params.bpm,stream:!!syncController?.stream}),controller:()=>syncController};})();";route.fulfill(response=r,body=s)
  page.route('**/app.js?*',instrument);page.goto(f'http://127.0.0.1:{server.server_port}/creation.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.evaluate('syncTest.mode(1)');page.evaluate('syncTest.start()');page.wait_for_timeout(650);assert page.evaluate('syncTest.state().steps')>0;page.evaluate('syncTest.stop()');assert not page.evaluate('syncTest.controller().active');print('PASS master mode starts actual AudioWorklet and music sequencer, then stops')
  page.evaluate('''()=>{window.inputTracks=[];navigator.mediaDevices.getUserMedia=async()=>{const c=syncTest.controller().ctx,d=c.createMediaStreamDestination();d.channelCount=2;const buf=c.createBuffer(2,c.sampleRate*4,c.sampleRate);for(let i=0;i<buf.length;i++){buf.getChannelData(0)[i]=i%(c.sampleRate/4)<c.sampleRate*.003?.7:0;buf.getChannelData(1)[i]=.1*Math.sin(2*Math.PI*220*i/c.sampleRate);}const s=c.createBufferSource();s.buffer=buf;s.loop=true;s.connect(d);s.start(c.currentTime+.06);const t=d.stream.getAudioTracks()[0];t.getSettings=()=>({channelCount:2});inputTracks.push(t);return d.stream;};}''')
  for mode in [2,3,4,5]:
   page.evaluate('m=>syncTest.mode(m)',mode);page.evaluate('syncTest.start()');page.wait_for_timeout(1350);state=page.evaluate('syncTest.state()');assert state['playing'] and state['steps']>=8 and abs(state['bpm']-120)<1,state
   assert state['stream'];page.evaluate('syncTest.stop()');assert page.evaluate('inputTracks.at(-1).readyState')=='ended';assert not page.evaluate('syncTest.state().stream')
  print('PASS actual stereo capture -> pulse reception -> 16th-note interpolation at 120 BPM for SY2–5; Stop releases tracks')
  page.evaluate('''()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=syncTest.controller().ctx,d=c.createMediaStreamDestination();const t=d.stream.getAudioTracks()[0];t.getSettings=()=>({channelCount:1});inputTracks.push(t);return d.stream;};}''');page.evaluate('syncTest.start()');assert not page.evaluate('syncTest.state().playing');assert page.evaluate('inputTracks.at(-1).readyState')=='ended';print('PASS mono input rejected without starting playback and without leaked capture')
  page.evaluate('syncTest.mode(0)');page.evaluate('syncTest.start()');page.wait_for_timeout(200);assert page.evaluate('syncTest.state().playing');page.evaluate('syncTest.stop()');assert not errors,errors
  page.locator('[data-act="rec"]').dispatch_event('pointerdown',{'pointerId':11,'pointerType':'touch','button':0,'bubbles':True})
  for expected in [1,2]:
   page.locator('#bpmMode').dispatch_event('pointerdown',{'pointerId':12,'pointerType':'touch','button':0,'bubbles':True});page.wait_for_function('n=>syncTest.state().mode===n',arg=expected)
   page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:12,bubbles:true}))')
  page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:11,bubbles:true}))');print('PASS ordered RECORD + repeated BPM cycles modes while RECORD stays physically held')
  routes=page.evaluate("""async()=>{
    syncTest.stop();const c=new AudioContext();await c.resume();const bus=c.createGain(),constant=c.createConstantSource();constant.offset.value=.2;constant.connect(bus);constant.start();bus.connect(c.destination);const unit=new PO33Sync(c,bus,()=>{}),rows=[];
    navigator.mediaDevices.getUserMedia=async()=>{const d=c.createMediaStreamDestination(),buf=c.createBuffer(2,c.sampleRate*2,c.sampleRate);for(let i=0;i<buf.length;i++){buf.getChannelData(0)[i]=i%(c.sampleRate/4)<c.sampleRate*.003?.7:0;buf.getChannelData(1)[i]=.1;}const src=c.createBufferSource();src.buffer=buf;src.loop=true;src.connect(d);src.start();d.stream.getAudioTracks()[0].getSettings=()=>({channelCount:2});return d.stream;};
    for(let mode=1;mode<=5;mode++){await unit.setMode(mode);const split=c.createChannelSplitter(2),meters=[c.createAnalyser(),c.createAnalyser()];unit.merger.connect(split);meters.forEach((m,i)=>{m.fftSize=32768;split.connect(m,i);});await unit.start(c.currentTime+.04,120);await new Promise(r=>setTimeout(r,850));const mean=meters.map(m=>{const a=new Float32Array(m.fftSize);m.getFloatTimeDomainData(a);return a.reduce((x,y)=>x+y,0)/a.length;});rows.push({mode,mean});unit.stop();split.disconnect();}await unit.setMode(0);constant.stop();await c.close();return rows;
  }""")
  for row in routes:
   left,right=row['mean'];expected=.3 if row['mode']>=4 else .2
   assert abs(right-expected)<.01,row
   assert abs(left-(expected if row['mode'] in [2,4] else .0084))<.01,row
  print('PASS actual output graph isolates clock-left/music-right and mixes external right audio only in SY4/5:',routes)
  b.close()
finally:server.shutdown()
