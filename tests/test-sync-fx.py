import sys
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
r=16000;pcm=struct.pack('<'+'h'*(r*2),*[int(12000*(.4+.6*i/(r*2))*math.sin(2*math.pi*220*i/r)) for i in range(r*2)]);wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(pcm))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,r,r*2,2,16)+b'data'+struct.pack('<I',len(pcm))+pcm).decode()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=b.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.fxVoices=[];const alloc=()=>{if(!window.PO33Sampling)return setTimeout(alloc,5);const a=PO33Sampling.allocate;PO33Sampling.allocate=(vs,v,c,n)=>{fxVoices.push(v);return a(vs,v,c,n);};window.spyReady=true;};alloc();const wav="+json.dumps(wav)+";if(!localStorage.getItem('step-fx')){localStorage.setItem('step-fx','1');for(let i=1;i<=5;i++)localStorage.setItem('po33.install.web-sampler-20261126.po33.slot'+i,btoa(JSON.stringify(wav)));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,hardwareTone:false,chain:[1]})));}")
  base=f'http://127.0.0.1:{server.server_port}/'
  def instrument(route):
   r=route.fetch();code=r.text().replace('var period=event.period;params.bpm=', 'window.syncPulseAudit.push({time:event.time+.04,period:event.period});var period=event.period;params.bpm=').rsplit('})();',1)[0]+"window.syncFX={mode:setSyncMode,saved:()=>{patternExtras[0].effects[4]=14;},start:startSeq,stop:stopSeq,clock:()=>syncClock,origin:()=>syncClock.time-syncClock.position*syncClock.duration,state:()=>({playing:seq.playing,mode:syncMode}),active:()=>syncController.active};})();";route.fulfill(response=r,body=code)
  page.route('**/app.js?*',instrument)
  page.add_init_script("navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext(),dest=c.createMediaStreamDestination();dest.channelCount=2;const a=c.createBuffer(2,c.sampleRate*2,c.sampleRate);for(let i=0;i<a.length;i++)a.getChannelData(0)[i]=(i%(c.sampleRate/8))<c.sampleRate*.003?.7:0;const src=c.createBufferSource();src.buffer=a;src.loop=true;src.connect(dest);src.start();c.resume();dest.stream.getAudioTracks()[0].getSettings=()=>({channelCount:2});return dest.stream;};")
  page.add_init_script('window.syncPulseAudit=[]')
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){for(let p=1;p<=3;p++){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes){lanes[p-1][i]=i;if(p===1&&a.dense)for(let s=0;s<5;s++)lanes[s][i]=i;}localStorage.setItem('po33.install.web-sampler-20261126.po33.pat'+p,btoa(JSON.stringify(lanes)));}const m=JSON.parse(atob(localStorage.getItem('po33.install.web-sampler-20261126.po33.meta')));m.bpm=240;m.swing=0;m.pattern=1;m.chain=a.chain;m.extras=Array.from({length:16},()=>({effects:[],locks:{}}));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify(m)));}")
  def configure(notes=range(16),chain=[1,2,3],dense=False):
   page.evaluate("a=>localStorage.setItem('step-fx-config',JSON.stringify(a))",{'notes':list(notes),'chain':chain,'dense':dense});page.reload();page.wait_for_function('document.body.dataset.loading==="false" && window.spyReady')
  def down(act,i=1):page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def pad(n,i=2):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def play():page.locator('[data-act="play"]').click()
  def begin():
   play();page.wait_for_function('fxVoices.length>0');page.evaluate('window.origin=fxVoices[0].start')
  def at_step(n):page.wait_for_function('n=>document.getElementById("grid").children[n].classList.contains("cur")',arg=n)
  def resumed():
   page.evaluate('window.resumeIndex=fxVoices.length');up(2);up(1);page.wait_for_timeout(50)
   values=page.evaluate('fxVoices.slice(resumeIndex).filter(v=>!v.performance.loop && v.end>v.start).map(v=>({slot:v.slot,note:v.note,time:v.start,origin:window.origin}))')
   assert values,values
   first=values[0];step=int((first['time']-first['origin'])/.0625+1e-5);assert first['slot']==(step//16)%3+1 and first['note']==step%16,(first,step)
   page.wait_for_timeout(200)
   assert page.evaluate('fxVoices.slice(resumeIndex+1).filter(v=>!v.performance.loop&&v.end>v.start).every(v=>Math.abs((v.start-window.origin)/.0625-Math.round((v.start-window.origin)/.0625))<.03)')
   play()
  def position_of(e,mode,pulses):
   if mode==1:return (e['t']-e['origin'])/.0625
   # Slave input is a separate AudioContext/MediaStream. Its actual detected
   # edges can drift from the nominal8Hz fixture; test the received clock,
   # not a frozen origin and assumed62.5ms duration.
   choices=[(abs(e['t']-(q['time']+k*q['period']/2)),i*2+k+(e['t']-(q['time']+k*q['period']/2))/(q['period']/2)) for i,q in enumerate(pulses) for k in [0,1]]
   assert choices,('missing pulse audit',e)
   return min(choices,key=lambda q:q[0])[1]
  assert abs(position_of({'t':.2315},2,[{'time':.04,'period':.129},{'time':.169,'period':.125}])-3)<1e-9
  for mode in ([] if "--saved-only" in sys.argv else [1,2]):
   for kind in range(1,16):
    configure(chain=[1,1,2,3]);page.evaluate('m=>syncFX.mode(m)',mode);play();page.wait_for_function('syncFX.state().playing && syncFX.clock()?.ready')
    if mode>=2:page.wait_for_function('syncFX.clock().pulses>=4')
    page.wait_for_timeout(160);page.evaluate('window.origin=syncFX.origin()');down('fx');pad(kind)
    page.wait_for_timeout(1150 if kind in [1,2,3,4,11,12,14] else 250)
    page.evaluate('window.resumeIndex=fxVoices.length')
    up(2);up(1);page.wait_for_timeout(420)
    data=page.evaluate('fxVoices.slice(resumeIndex).filter(v=>v.end>v.start&&!v.performance.loop&&!v.scratch&&!v.performance.scratchContinuation).map(v=>({slot:v.slot,note:v.note,t:v.start,origin:window.origin}))')
    # Ignore a release-time transient and examine the next several stable ticks.
    assert data,(mode,kind,'no restored notes')
    pulses=page.evaluate('syncPulseAudit')
    tail=data[-3:];indices=[]
    for e in tail:
     position=position_of(e,mode,pulses);index=round(position);expected_slot=[1,1,2,3][(index//16)%4]
     assert abs(position-index)<.06,(mode,kind,e,position)
     assert e['slot']==expected_slot and e['note']==index%16,(mode,kind,e,index,expected_slot)
     indices.append(index)
    assert all(b==a+1 for a,b in zip(indices,indices[1:])),(mode,kind,'missing or duplicate restored tick',indices)
    assert page.evaluate('syncFX.active()'),(mode,kind,'clock stopped')
    play()
   print('PASS mode',mode,'all 15 live FX restore the original clock grid, repeated chain order and step; sync clock remains active')
  for mode in [1,2]:
   configure(chain=[1,2,3]);page.evaluate('m=>syncFX.mode(m)',mode);page.evaluate('syncFX.saved()');play();page.wait_for_function('syncFX.state().playing && syncFX.clock()?.ready');page.wait_for_function('syncFX.clock().external ? syncFX.clock().pulses>=4 : true');page.evaluate('window.origin=syncFX.origin()');page.wait_for_timeout(1400)
   values=page.evaluate('fxVoices.filter(v=>v.end>v.start).map(v=>({slot:v.slot,note:v.note,t:v.start,origin:window.origin}))')
   assert any(v['slot']==2 for v in values),values
   pulses=page.evaluate('syncPulseAudit')
   for e in values:
    pos=position_of(e,mode,pulses);index=round(pos);slot=[1,2,3][(index//16)%3];note=0 if slot==1 and index%16==4 else index%16
    assert abs(pos-index)<.06 and e['slot']==slot and e['note']==note,(mode,e,index,slot,note)
   play()
  print('PASS saved FX14 retriggers sound without trapping the synced chain or moving its position')
  assert not errors,errors
  b.close()
finally:server.shutdown();server.server_close()
