import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
"""Synthetic live recording, persisted slicing, choke and four-voice scheduling."""
import os
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
assets=Path(os.environ.get('PO33_TEST_ASSET_ROOT',str(root)))
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def translate_path(self,path):
  local=Path(super().translate_path(path))
  if local.is_file():return str(local)
  return str(assets/local.relative_to(root))
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""
   window.notes=[];window.voiceStops=[];let serial=0;
   const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
   AudioBufferSourceNode.prototype.start=function(...a){this.testId=++serial;notes.push({id:this.testId,args:a,duration:this.buffer.duration});return start.apply(this,a)};
   AudioBufferSourceNode.prototype.stop=function(t){voiceStops.push({id:this.testId,time:t});return stop.call(this,t)};
   navigator.mediaDevices.getUserMedia=async()=>{
    const c=new AudioContext(),dest=c.createMediaStreamDestination(),b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=b.getChannelData(0);
    for(const onset of [.3,.67,1.23])for(let j=0;j<c.sampleRate*.1;j++){const i=Math.round(onset*c.sampleRate)+j;d[i]=.6*Math.sin(2*Math.PI*440*j/c.sampleRate)*Math.exp(-j/(c.sampleRate*.025));}
    const src=c.createBufferSource();src.buffer=b;src.connect(dest);src.start();window.fakeMic=c;await c.resume();return dest.stream;
   };
  """)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(600)
  page.mouse.click(10,10)
  page.evaluate("""()=>{const original=PO33Sampling.transientSlices;PO33Sampling.transientSlices=(data,rate)=>{const r=original(data,rate);window.detected=r;window.recordRate=rate;window.recordPeak=data.reduce((a,v)=>Math.max(a,Math.abs(v)),0);return r;};const alloc=PO33Sampling.allocate;PO33Sampling.allocate=(voices,v,cut,n)=>{alloc(voices,v,cut,n);window.allocation=voices.map(x=>({slot:x.slot,start:x.start,end:x.end}));};}""")
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel,i=1):down(sel,i);up(i)
  def select(n):down('[data-act="sound"]');tap(f'[data-pad="{n}"]',2);up()
  def pad(n):tap(f'[data-pad="{n}"]')
  down('[data-act="rec"]');down('[data-pad="9"]',2)
  page.wait_for_function('document.body.classList.contains("recording")');page.wait_for_timeout(1600);up(2);up()
  page.wait_for_function('!document.body.classList.contains("recording") && !!window.detected')
  assert .5<page.evaluate('recordPeak')<.65 # no post-capture normalization to .9
  assert page.locator('[data-led-reason="slice-result"][data-led-level="bright"]').count()==4
  detected=page.evaluate('detected.filter(Boolean)');assert len(detected)==4,detected
  assert abs((detected[2]['start']-detected[1]['start'])/page.evaluate('recordRate')-.37)<.015
  select(9);page.evaluate('notes=[];voiceStops=[]');pad(1);page.wait_for_timeout(25);pad(2)
  notes=page.evaluate('notes');stops=page.evaluate('voiceStops');assert len(notes)==2,notes
  assert any(x['id']==notes[0]['id'] and abs(x['time']-notes[1]['args'][0]-.002)<.015 for x in stops),stops
  second=notes[1]['args'][1];pad(16);assert len(page.evaluate('notes'))==2 # unused pad is silent but chokes
  for slot in [1,2,3,4]:select(slot);pad(1)
  select(9);pad(1)
  entries=page.evaluate('allocation');t=max(x['start'] for x in entries)
  assert len([x for x in entries if x['start']<=t and x['end']>t])<=4
  select(1);pad(1)
  down('[data-act="sound"]');down('[data-act="write"]',2);tap('[data-pad="13"]',3);up(2);up()
  select(13);page.evaluate('notes=[]');pad(1);pad(2)
  copied=page.evaluate('notes');assert len(copied)==2
  assert abs(copied[0]['args'][2]-copied[1]['args'][2])<.0001
  assert abs(copied[1]['args'][1]-copied[0]['args'][1]-copied[0]['args'][2])<.0001
  page.wait_for_timeout(800);page.reload();page.wait_for_timeout(700)
  select(9);page.evaluate('notes=[]');pad(2)
  assert abs(page.evaluate('notes.at(-1).args[1]')-second)<.0001
  assert not errors,errors
  browser.close();print('PASS real synthetic microphone take -> zero anchor + 3 irregular slices, unused-pad choke, live same-slot cut, global voice cap, equal melodic-copy slices, persisted slice offsets on reload.')
finally:server.shutdown();server.server_close()

