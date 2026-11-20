"""Selected-slot live controls, moving rate deadlines, deferred Trim and RECORD overlay."""
import base64,struct,math,json
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
rate=16000;n=rate*2;body=struct.pack('<'+'h'*n,*[int(9000*math.sin(i*2*math.pi*220/rate)) for i in range(n)])
wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(body))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,rate,rate*2,2,16)+b'data'+struct.pack('<I',len(body))+body).decode()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("const testWave="+json.dumps(wav)+";if(!localStorage.getItem('live-test')){localStorage.setItem('live-test','1');localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,hardwareTone:false})));const lanes=Array.from({length:16},()=>Array(16).fill(-1));localStorage.setItem('po33.pat1',btoa(JSON.stringify(lanes)));const view={asset:'long',offset:0,duration:2};for(const slot of [1,9])localStorage.setItem('po33.slot'+slot,btoa(JSON.stringify({format:3,base:view,slices:slot===9?Array(16).fill(view):null,assets:{long:testWave}})));}")
  page.add_init_script("""
   window.voices=[];const edges=new WeakMap(),connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
   AudioNode.prototype.connect=function(to,...args){edges.set(this,[...(edges.get(this)||[]),to]);return connect.call(this,to,...args);};
   AudioBufferSourceNode.prototype.start=function(...args){const env=edges.get(this)?.[0],nodes=edges.get(env)||[],low=nodes.find(n=>n instanceof BiquadFilterNode&&n.type==='lowpass'),high=nodes.find(n=>n instanceof BiquadFilterNode&&n.type==='highpass'),dry=nodes.find(n=>n instanceof GainNode);if(low&&high){const record={src:this,args,env,low,high,dry,volume:edges.get(dry)[0],lowGain:edges.get(low)[0],highGain:edges.get(high)[0],ended:false};this.addEventListener('ended',()=>record.ended=true);voices.push(record);}return start.apply(this,args);};
  """)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(700);page.mouse.click(10,10)
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel,i=1):down(sel,i);up(i)
  def select(n):down('[data-act="sound"]');tap(f'[data-pad="{n}"]',2);up()
  def wheel(knob,count=1,direction=1):page.locator('#knob'+knob).evaluate('(e,a)=>{for(let i=0;i<a[0];i++)e.dispatchEvent(new WheelEvent("wheel",{deltaY:-a[1],bubbles:true,cancelable:true}));}',[count,direction])
  select(1);tap('[data-pad="5"]');page.evaluate('window.originalPCM=voices[0].src.buffer.getChannelData(0).slice()')
  select(9);tap('[data-pad="1"]');select(1)
  wheel('A',120,-1);wheel('B',20,-1);page.wait_for_timeout(120)
  assert page.evaluate('Math.abs(voices[0].src.playbackRate.value-.5)<.001 && voices[1].src.playbackRate.value===1')
  assert page.evaluate('Math.abs(voices[0].volume.gain.value-.8)<.001 && voices[1].volume.gain.value===1')
  tap('[data-act="fx"]');wheel('A',80);wheel('B',30);page.wait_for_timeout(140)
  assert page.evaluate('voices[0].highGain.gain.value>.99 && voices[0].dry.gain.value<.001 && Math.abs(voices[0].high.Q.value-5.2)<.01')
  assert page.evaluate('voices[1].dry.gain.value===1 && Math.abs(voices[1].low.Q.value-.7)<.0001')
  wheel('A',160,-1);page.wait_for_timeout(140)
  assert page.evaluate('voices[0].lowGain.gain.value>.99 && voices[0].highGain.gain.value<.001')
  wheel('A',80);page.wait_for_timeout(140);assert page.evaluate('voices[0].dry.gain.value>.99')
  assert page.evaluate('voices.length===2') # live modulation must not restart any active source
  page.wait_for_timeout(1500);assert page.evaluate('!voices[0].ended') # slowed tail survives original 2-second deadline
  # BPM adjusts clock only, never the current source rate.
  down('#bpmMode');wheel('B',5);up();assert page.evaluate('Math.abs(voices[0].src.playbackRate.value-.5)<.001')
  tap('[data-act="fx"]');wheel('A',10);assert page.evaluate('voices.length===2 && !voices[0].ended && voices[0].args[1]===0')
  wheel('B',95,-1);page.wait_for_timeout(50);assert page.evaluate('voices[0].ended')
  tap('[data-pad="5"]');assert page.evaluate('voices.length===3 && Math.abs(voices[2].args[1]-.2)<.001 && voices[2].args[2]<.1')
  assert page.evaluate('originalPCM.every((x,i)=>x===voices[0].src.buffer.getChannelData(0)[i])')
  # RECORD overlay supersedes running step lights and reports actual remaining seconds.
  tap('[data-act="write"]');tap('[data-act="play"]');down('[data-act="rec"]');page.wait_for_timeout(100)
  assert page.locator('.pad[data-led-reason="record-slots"][data-led-level="bright"]').count()==page.locator('.pad.sampled').count()
  assert page.locator('.pad:not(.sampled)[data-led-level="bright"]').count()==0
  assert abs(float(page.locator('#lcdNumber').get_attribute('data-value'))-float(page.locator('#mem').text_content().rstrip('s')))<.11
  up();assert page.locator('[data-led-reason="record-slots"]').count()==0;tap('[data-act="play"]');tap('[data-act="write"]')
  down('[data-act="sound"]');value=page.locator('#lcdNumber').get_attribute('data-value');tap('#bpmMode',2);page.wait_for_timeout(100);assert page.locator('#lcdNumber').get_attribute('data-value')==value;up()
  scheduled=browser.new_page(viewport={'width':240,'height':282})
  scheduled.goto(f'http://127.0.0.1:{server.server_port}/index.html');scheduled.wait_for_timeout(500)
  scheduled.add_init_script("const wave="+json.dumps(wav)+";"+"""{localStorage.clear();const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[0][0]=4;const extras=Array.from({length:16},()=>({effects:[],locks:{}}));extras[0].locks['0:3']={volume:25,filter:80};localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,hardwareTone:false,extras,chain:[1],pattern:1,patternSettings:Array(16).fill(null)})));localStorage.setItem('po33.pat1',btoa(JSON.stringify(lanes)));localStorage.setItem('po33.slot1',btoa(JSON.stringify(wave)));}""")
  scheduled.reload();scheduled.wait_for_timeout(600);scheduled.mouse.click(10,10)
  scheduled.evaluate("""()=>{window.liveNotes=[];const edges=new WeakMap(),connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;AudioNode.prototype.connect=function(to,...a){edges.set(this,[...(edges.get(this)||[]),to]);return connect.call(this,to,...a);};AudioBufferSourceNode.prototype.start=function(...a){const nodes=edges.get(edges.get(this)?.[0])||[],dry=nodes.find(n=>n instanceof GainNode),hp=nodes.find(n=>n instanceof BiquadFilterNode&&n.type==='highpass');if(hp)liveNotes.push({args:a,volume:edges.get(dry)[0],wet:edges.get(hp)[0],src:this});return start.apply(this,a);};}""")
  scheduled.locator('[data-act="play"]').click();scheduled.wait_for_timeout(620)
  assert scheduled.evaluate('liveNotes.length===1 && Math.abs(liveNotes[0].volume.gain.value-.25)<.005 && liveNotes[0].wet.gain.value>.99')
  scheduled.close()
  assert not errors,errors
  browser.close();print('PASS live slot-only pitch/gain/LP-HP/Q smoothing without restart, slowed-tail deadline, BPM rate isolation, delayed Start/Length truncation, immutable PCM, RECORD sample-map/free-time overlay and removed system menu.')
finally:server.shutdown();server.server_close()
