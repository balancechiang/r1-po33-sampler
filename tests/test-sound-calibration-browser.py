import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
"""Audible path scale, overlapping trim, latching, filter bypass and tone switch."""
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
   if(!localStorage.getItem('calibration')){const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[0][0]=4;lanes[0][1]=4;lanes[0][2]=4;
    const tweaks=Array.from({length:16},()=>({pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}})),extras=Array.from({length:16},()=>({effects:[],locks:{}}));extras[0].locks={'0:0':{pitch:7,volume:30,filter:-100,resonance:25},'0:2':{volume:60}};
    localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,slot:1,tweaks,extras,chain:[1]})));localStorage.setItem('po33.install.web-sampler-20261126.po33.pat1',btoa(JSON.stringify(lanes)));localStorage.setItem('calibration','1');}
   window.notes=[];const edges=new WeakMap(),connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
   AudioNode.prototype.connect=function(to,...rest){const list=edges.get(this)||[];list.push(to);edges.set(this,list);return connect.call(this,to,...rest)};
   AudioBufferSourceNode.prototype.start=function(...args){const env=edges.get(this)?.[0],paths=edges.get(env)||[],filter=paths.find(x=>x instanceof BiquadFilterNode),dry=paths.find(x=>x instanceof GainNode),volume=edges.get(dry)?.[0];
    if(filter){window.lastBuffer=this.buffer;notes.push({rate:this.playbackRate.value,time:args[0],offset:args[1],duration:args[2],volume:volume.gain.value,bypass:dry.gain.value,filter:filter.type,frequency:filter.frequency.value,q:filter.Q.value});}return start.apply(this,args);};
  """)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(650);page.mouse.click(10,10)
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel,i=1):down(sel,i);up(i)
  def pad(n):tap(f'[data-pad="{n}"]')
  def wheel(knob,direction=1):page.locator('#knob'+knob).evaluate('(e,d)=>e.dispatchEvent(new WheelEvent("wheel",{deltaY:-d,bubbles:true,cancelable:true}))',direction)
  # Explicit multi-pointer selection helpers preserve the modifier pointer.
  def select(n):down('[data-act="sound"]');tap(f'[data-pad="{n}"]',2);up()
  for n in range(1,17):pad(n)
  notes=page.evaluate('notes');offsets=[-5,-4,-2,-1,0,2,3,5,7,8,10,11,12,14,15,17]
  assert len(notes)==16
  for note,offset in zip(notes,offsets):assert abs(note['rate']-2**(offset/12))<.00001
  assert notes[4]['bypass']==1
  page.evaluate('window.originalBuffer=lastBuffer;window.originalPCM=lastBuffer.getChannelData(0).slice()')
  down('[data-act="sound"]');down('[data-act="write"]',2);tap('[data-pad="9"]',3);up(2);up();select(9)
  pad(1);pad(2);before=page.evaluate('notes.slice(-2)')
  tap('[data-act="fx"]');tap('[data-act="fx"]');pad(1);wheel('B',1);pad(1)
  longer=page.evaluate('notes.at(-1)');assert longer['offset']+longer['duration']>before[1]['offset']
  assert page.evaluate('originalPCM.every((x,i)=>x===originalBuffer.getChannelData(0)[i])')
  # Return tone page, then play partial locks: pitch/filter persist through the volume-only lock.
  tap('[data-act="fx"]');select(1);page.evaluate('notes=[]');tap('[data-act="play"]');page.wait_for_timeout(330);tap('[data-act="play"]')
  notes=page.evaluate('notes');assert len(notes)>=3,notes
  for note in notes[:3]:assert abs(note['rate']-2**(7/12))<.00001 and note['filter']=='lowpass' and abs(note['frequency']-100)<.001 and note['bypass']==0
  assert abs(notes[0]['volume']-.3)<.0001 and abs(notes[1]['volume']-.3)<.0001 and abs(notes[2]['volume']-.6)<.0001
  wheel('A');pad(5);assert abs(page.evaluate('notes.at(-1).rate')-2**(7.1/12))<.00001
  down('[data-act="rec"]');wheel('A');up();pad(5);assert page.evaluate('notes.at(-1).rate')==1
  tap('[data-act="fx"]');down('[data-act="rec"]');wheel('A');up();pad(5);assert page.evaluate('notes.at(-1).bypass')==1
  page.evaluate('PO33Transfer.open("receive")');page.locator('#transferDeviceToggle').click()
  assert page.locator('#transferTone').get_attribute('aria-pressed')=='true'
  page.locator('#transferTone').click();assert page.locator('#transferTone').get_attribute('aria-pressed')=='false'
  page.wait_for_timeout(550);page.reload();page.wait_for_timeout(600);page.evaluate('PO33Transfer.open("receive")');page.locator('#transferDeviceToggle').click()
  assert page.locator('#transferTone').get_attribute('aria-pressed')=='false'
  page.add_script_tag(path=str(root/'tone.js'))
  assert page.evaluate("""async()=>{const c=new OfflineAudioContext(1,4096,48000);await c.audioWorklet.addModule('./hardware-tone-worklet.js');const b=c.createBuffer(1,4096,48000),pcm=b.getChannelData(0);for(let i=0;i<pcm.length;i++)pcm[i]=.3*Math.sin(i*.17);const before=pcm.slice(),src=c.createBufferSource(),tone=new AudioWorkletNode(c,'po33-hardware-tone',{outputChannelCount:[1]});src.buffer=b;src.connect(tone);tone.connect(c.destination);src.start();const result=await c.startRendering(),expected=new Float32Array(4096);new PO33Tone.Tone(48000).process(before,expected);return result.getChannelData(0).every((x,i)=>Math.abs(x-expected[i])<1e-6)&&pcm.every((x,i)=>x===before[i]);}""")
  assert not errors,errors
  browser.close();print('PASS 16 scale rates, center filter bypass, overlapping drum trim with unchanged PCM, partial P-lock hold/manual reset, persisted tone toggle.')
finally:server.shutdown();server.server_close()
