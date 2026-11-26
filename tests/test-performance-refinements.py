import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
import base64,struct,math,json
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
rate=16000;pcm=struct.pack('<'+'h'*(rate*2),*[int(8000*math.sin(2*math.pi*220*i/rate)) for i in range(rate*2)]);wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(pcm))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,rate,rate*2,2,16)+b'data'+struct.pack('<I',len(pcm))+pcm).decode()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=b.new_page(viewport={'width':390,'height':844},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("const wav="+json.dumps(wav)+";if(!localStorage.getItem('fixture')){localStorage.setItem('fixture','1');const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[0][0]=4;localStorage.setItem('po33.install.web-sampler-20261126.po33.pat1',btoa(JSON.stringify(lanes)));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,hardwareTone:false,tweaks:Array.from({length:16},()=>({pitch:0,volume:15,filter:-90,resonance:0,start:0,length:100,slices:{}}))})));localStorage.setItem('po33.install.web-sampler-20261126.po33.slot1',btoa(JSON.stringify(wav)));}")
  page.add_init_script("""window.sources=[];window.micRequests=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){sources.push({src:this,args,ahead:args[0]===undefined?0:args[0]-this.context.currentTime,ended:false});const s=sources.at(-1);this.addEventListener('ended',()=>s.ended=true);return start.apply(this,args);};navigator.mediaDevices.getUserMedia=async()=>{micRequests++;const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();g.gain.value=.2;o.connect(g);g.connect(d);o.start();await c.resume();return d.stream;};""")
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  def el(k):return page.locator('[data-pad="'+k[3:]+'"]' if k.startswith('pad') else '[data-act="'+k+'"]')
  def down(k,i=1):el(k).dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,pointerType:"touch",bubbles:true}))',i)
  def tap(k,i=1):down(k,i);up(i)
  def knob(i,n):page.locator('#knob'+i).evaluate('(e,n)=>{for(let i=0;i<Math.abs(n);i++)e.dispatchEvent(new WheelEvent("wheel",{deltaY:n>0?-1:1,bubbles:true,cancelable:true}));}',n)
  def meta():page.wait_for_timeout(400);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.install.web-sampler-20261126.po33.meta")))')
  tap('pad5');page.wait_for_timeout(120);assert not page.evaluate('sources.at(-1).ended')
  tap('pad5');page.wait_for_timeout(80);assert page.evaluate('sources.at(-2).ended && !sources.at(-1).ended && sources.at(-1).args[1]===0')
  tap('play');assert page.evaluate('sources.at(-1).ahead')<.03
  down('rec');down('pad1',2);page.wait_for_timeout(120);assert page.evaluate('micRequests')==0 and not page.locator('body').evaluate('e=>e.classList.contains("recording")');up(2);up();tap('play')
  assert page.locator('#lcdMeter').get_attribute('data-indicator-origin')=='center'
  down('sound');tap('pad1',2);page.wait_for_timeout(120);assert page.locator('#lcdMeter [data-active="true"]').count()==0;up();page.wait_for_timeout(120);assert page.locator('#lcdMeter [data-active="true"]').count()==0
  knob('B',-110);assert page.locator('#knobB').evaluate('e=>e.style.getPropertyValue("--knob-angle")')=='0deg'
  knob('B',110);assert page.locator('#knobB').evaluate('e=>e.style.getPropertyValue("--knob-angle")')=='270deg'
  down('pattern');page.wait_for_timeout(600);assert el('pattern').evaluate('e=>!e.classList.contains("hold-active")');page.wait_for_timeout(300);assert el('pattern').evaluate('e=>e.classList.contains("hold-active")');up();tap('pattern')
  # Restore the deliberately low old parameters, then record over that same slot.
  knob('B',-85);down('rec');down('pad1',2);page.wait_for_function('document.body.classList.contains("recording")');page.wait_for_timeout(300);tap('play',3);assert page.locator('body').evaluate('e=>e.classList.contains("recording")');up(2);up();page.wait_for_function('!document.body.classList.contains("recording")')
  t=meta()['tweaks'][0];assert t['volume']==100 and t['filter']==0 and t['pitch']==0,t
  tap('pad5');assert page.evaluate('(()=>{const d=sources.at(-1).src.buffer.getChannelData(0);const peak=d.reduce((m,v)=>Math.max(m,Math.abs(v)),0);return peak>.18 && peak<.22;})()')
  before=page.locator('.pad.sampled').count();down('rec');down('sound',2);page.wait_for_timeout(30);assert page.locator('.pad.sampled').count()==before-1;up(2);up()
  assert page.evaluate('(()=>{const e=new MouseEvent("dblclick",{bubbles:true,cancelable:true});document.dispatchEvent(e);return e.defaultPrevented;})()')
  assert not errors,errors
  print('PASS one-shot/retrigger, <30ms scheduled onset, no sampling during playback, center meter at rest, suppressed SOUND meter, 800ms HOLD, 0–270 knob, fresh recording parameters, immediate deletion and double-tap suppression')
  b.close()
finally:server.shutdown();server.server_close()
