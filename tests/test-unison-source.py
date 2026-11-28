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
  page.add_init_script("window.fxVoices=[];const alloc=()=>{if(!window.PO33Sampling)return setTimeout(alloc,5);const a=PO33Sampling.allocate;PO33Sampling.allocate=(vs,v,c,n)=>{fxVoices.push(v);return a(vs,v,c,n);};};alloc();const wav="+json.dumps(wav)+";if(!localStorage.getItem('step-fx')){localStorage.setItem('step-fx','1');for(const slot of [1,2,3,4,5,9])localStorage.setItem('po33.install.web-sampler-20261126.po33.slot'+slot,btoa(JSON.stringify(wav)));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,hardwareTone:false,chain:[1]})));}")
  base=f'http://127.0.0.1:{server.server_port}/'
  def instrument(route):
   r=route.fetch();code=r.text().rsplit('})();',1)[0]+"window.uniTest={native:v=>{nativeAudition=v;},onSaved:n=>fxEngage(n,true),offSaved:()=>fxRelease(true),queueFuture:()=>{voice(3,4,ctx().currentTime+.07,undefined,0);window.futureAfterRelease=fxVoices.at(-1);},cancelEnvelope:async()=>{const c=new OfflineAudioContext(1,480,48000),s=c.createBufferSource(),b=c.createBuffer(1,480,48000),g=c.createGain();b.getChannelData(0).fill(1);s.buffer=b;s.connect(g);g.connect(c.destination);g.gain.setValueAtTime(0,0);g.gain.linearRampToValueAtTime(.95,.002);s.start();cancelVoice({start:0,end:.01,gain:g,src:s},.001);const out=await c.startRendering();return Math.max(...out.getChannelData(0));},earlyAdmission:()=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));const t=ctx().currentTime+.01;for(let slot=1;slot<=5;slot++)voice(slot,4,t,undefined,0);window.waitingDry=sampleVoices.find(v=>v.slot===5);window.firstDry=sampleVoices.find(v=>v.slot===1);},cancelFirst:()=>cancelVoice(firstDry,ctx().currentTime),cutFirst:()=>cutSampleVoice(firstDry,ctx().currentTime),mixedReader:()=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));window.fxVoices=[];readerLoop=null;seq.pattern=1;const t=ctx().currentTime+.03;prepareReaders(3,t);readerNote(1,4,t);drainReaders(t+stepDur(),true);readerNote(1,5,t+stepDur());drainReaders(t+2*stepDur(),true);readerNote(1,6,t+2*stepDur());const notes=fxVoices.map(v=>v.note);prepareReaders(4,t+3*stepDur());readerNote(1,7,t+3*stepDur());drainReaders(t+3*stepDur()+stepDur()/3,true);return {notes,origin:readerLoop.slots.get(1).origin,lastAnchor:fxVoices.at(-1).anchor};},position:v=>voicePosition(v,ctx().currentTime),fire:(slot,pad,effect,performance)=>voice(slot,pad,undefined,undefined,effect,undefined,performance),step:n=>{seq.pattern=1;patterns[0].lanes=Array.from({length:16},(_,i)=>Array(16).fill(-1));for(let i=0;i<4;i++)patterns[0].lanes[i][0]=4;fireStep(0,ctx().currentTime+.01,n);},offAt:t=>fxRelease(true,t),stop:()=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));fx.kind=0;},on:n=>fxEngage(n),off:()=>fxRelease(),slotPitch:()=>{tweaks[0].pitch=3;manualParameter(1,'pitch',3)},routing:()=>({engine:fx.engine.kind,dry:dryGain.gain.value,wet:fx.wet.gain.value})};})();";route.fulfill(response=r,body=code)
  original_instrument=instrument
  def instrument_late_reader(route):
   class ModifiedRoute:
    def fetch(self):return route.fetch()
    def fulfill(self, response, body):
     hook="queuedScratch:n=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));window.fxVoices=[];fx.kind=0;visQueue=[];seq.step=0;seq.visualStepTime=ctx().currentTime-stepDur()*(n===11?1:.5);const at=ctx().currentTime+.08;voice(1,4,at,.4,0);fxEngage(n);return at;},futureUnison:()=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));window.fxVoices=[];fx.kind=0;voice(3,4,ctx().currentTime,undefined,0);const at=ctx().currentTime+.5;voice(1,4,at,.3,0);return at;},fallbackCut:async()=>{const at=ctx().currentTime+.02,c=new OfflineAudioContext(1,Math.ceil((at+.02)*48000),48000),src=c.createBufferSource(),b=c.createBuffer(1,480,48000),g=c.createGain();b.getChannelData(0).fill(1);src.buffer=b;src.loop=true;src.connect(g);g.connect(c.destination);g.gain.value=.2;Object.defineProperty(g.gain,'cancelAndHoldAtTime',{value:undefined});src.start();cutSampleVoice({start:0,end:at+.01,gain:g,src},at);const out=await c.startRendering();return out.getChannelData(0).reduce((a,b)=>Math.max(a,b),0);},lateReader:(ticks=1)=>{sampleVoices.slice().forEach(v=>cancelVoice(v,ctx().currentTime));readerLoop=null;const period=stepDur(),boundary=ctx().currentTime-.01,t=boundary-period*ticks;prepareReaders(1,t);readerNote(1,4,t);drainReaders(boundary,true);const s=readerLoop.slots.get(1),position=s.resetPosition;readerNote(1,5,boundary);return {position,origin:s.origin,anchor:s.entry?.anchor,finite:Number.isFinite(s.entry?.anchor)};},"
     body=body.replace('position:v=>voicePosition',hook+'position:v=>voicePosition')
     route.fulfill(response=response,body=body)
   original_instrument(ModifiedRoute())
  page.route('**/app.js?*',instrument_late_reader)
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes)lanes[0][i]=4;localStorage.setItem('po33.install.web-sampler-20261126.po33.pat1',btoa(JSON.stringify(lanes)));const m=JSON.parse(atob(localStorage.getItem('po33.install.web-sampler-20261126.po33.meta')));m.pattern=1;m.chain=[1];m.extras=Array.from({length:16},()=>({effects:Array(16).fill(a.kind),locks:{}}));localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify(m)));}")
  def configure(kind,notes):
   page.evaluate("a=>localStorage.setItem('step-fx-config',JSON.stringify(a))",{'kind':kind,'notes':list(notes)});page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
  def down(act,i=1):page.locator('[data-act="'+act+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def pad(n,i=2):page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
  def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def play():page.locator('[data-act="play"]').click()
  configure(0,[])
  def active():return page.evaluate('fxVoices.filter(v=>v.start<=v.src.context.currentTime && v.end>v.src.context.currentTime && (v.cutAt===undefined || v.cutAt>v.src.context.currentTime)).map(v=>({rate:v.src.playbackRate.value,slot:v.slot,note:v.note,group:v.group}))')
  page.evaluate('uniTest.slotPitch();uniTest.fire(1,4,0);uniTest.on(5)');page.wait_for_timeout(40)
  voices=active();assert len(voices)==4,voices
  expected=[.98388644,.99413750,1.00437673,1.01464844]
  assert all(abs(v['rate']/2**(3/12)-r)<1e-5 for v,r in zip(voices,expected)),voices
  assert len({v['group'] for v in voices})==1
  routing=page.evaluate('uniTest.routing()');assert routing['engine']==0 and routing['dry']>.99 and routing['wet']<.001
  page.evaluate('uniTest.on(6)');page.wait_for_timeout(30);voices=active();assert len(voices)==4
  assert all(abs(v['rate']/2**(3/12)-r)<1e-5 for v,r in zip(voices,[.99459477,1.00292946,1.00437673,.49609343])),voices
  page.evaluate('uniTest.off()');page.wait_for_timeout(30);voices=active();assert len(voices)==1 and abs(voices[0]['rate']-2**(3/12))<1e-5
  page.evaluate('uniTest.fire(3,4,5)');page.wait_for_timeout(20);voices=active();assert len(voices)==4 and all(v['slot']==3 for v in voices)
  page.evaluate('uniTest.fire(9,8,6)');page.wait_for_timeout(20);voices=active();assert len(voices)==4 and all(v['slot']==9 and v['note']==8 for v in voices)
  page.evaluate('uniTest.fire(9,8,11);uniTest.on(11)');page.wait_for_timeout(20)
  v=page.evaluate('fxVoices.at(-1) && ({note:fxVoices.at(-1).note,sourcePad:fxVoices.at(-1).sourcePad,scratch:!!fxVoices.at(-1).scratch})')
  assert v=={'note':8,'sourcePad':0,'scratch':True},v
  page.evaluate('uniTest.off()');page.wait_for_timeout(20)
  assert page.evaluate('fxVoices.at(-1).sourcePad')==0
  page.evaluate('uniTest.fire(9,8,0)');assert page.evaluate('fxVoices.at(-1).sourcePad')==8
  page.evaluate('uniTest.fire(9,5,12)');assert page.evaluate('fxVoices.at(-1).sourcePad')==0
  print('PASS recorded Scratch drum slice-one selection, continuation source and unchanged dry drum selection')
  page.evaluate('uniTest.stop();uniTest.on(12);uniTest.fire(1,4,12);window.boundaryVoice=fxVoices.at(-1)');page.wait_for_timeout(160)
  page.evaluate('uniTest.offAt(boundaryVoice.start+boundaryVoice.scratch.half*2/boundaryVoice.speed.rate)');page.wait_for_timeout(15)
  assert not [v for v in active() if v['slot']==1]
  page.evaluate('uniTest.stop();uniTest.fire(1,4,11,{resumeSeconds:.04,scratchContinuation:true,scratchNegative:true});window.reverseVoice=fxVoices.at(-1)');page.wait_for_timeout(100)
  assert page.evaluate('reverseVoice.end<=reverseVoice.src.context.currentTime')
  print('PASS Scratch release at the origin stays silent; reverse-phase continuation terminates at the source boundary')
  for kind in [5,6]:
   page.evaluate('n=>{uniTest.stop();uniTest.step(n)}',kind);page.wait_for_timeout(30)
   voices=active();assert len(voices)==4 and all(v['slot']==1 for v in voices),voices
   page.evaluate('n=>uniTest.fire(5,4,n)',kind);page.wait_for_timeout(15)
   voices=active();assert len(voices)==4 and all(v['slot']==5 for v in voices),voices
  print('PASS native first-slot priority for simultaneous Unison events; later slot still steals four voices')
  for order in [[3,1],[1,3]]:
   page.evaluate('a=>{uniTest.stop();for(const slot of a)uniTest.fire(slot,4,0);uniTest.on(5)}',order);page.wait_for_timeout(25)
   voices=active();assert len(voices)==4 and all(v['slot']==1 for v in voices),(order,voices)
   page.evaluate('uniTest.off()');page.wait_for_timeout(25)
   voices=active();assert len(voices)==1 and voices[0]['slot']==1,(order,voices)
  print('PASS recorded v13 active Unison selects the lowest sounding slot in both arrival orders; release does not revive discarded slots')
  page.evaluate('uniTest.stop();uniTest.fire(1,4,0)');page.wait_for_timeout(180)
  page.evaluate('uniTest.on(15);window.reversed=fxVoices.at(-1)');page.wait_for_timeout(30)
  rev=page.evaluate('({reverse:reversed.reverse,span:reversed.span,cursor:uniTest.position(reversed),buffer:reversed.src.buffer.length})')
  assert rev['reverse'] and .13<rev['span']<.3 and rev['cursor']<rev['span'],rev
  page.evaluate('uniTest.off();window.forward=fxVoices.at(-1)');page.wait_for_timeout(15)
  fwd=page.evaluate('({reverse:forward.reverse,anchor:forward.anchor,sourceStart:forward.sourceStart,cursor:uniTest.position(forward)})')
  assert not fwd['reverse'] and 0<fwd['anchor']-fwd['sourceStart']<.3,fwd
  page.evaluate('uniTest.stop();uniTest.fire(1,4,0)');page.wait_for_timeout(100)
  page.evaluate('uniTest.on(15)');page.wait_for_timeout(180)
  assert not active(),active()
  print('PASS active Reverse starts at the current cursor, changes direction without jumping to the sample end, and terminates at the origin')
  page.evaluate('uniTest.stop();uniTest.fire(1,4,0);window.originalDry=fxVoices.at(-1)');page.wait_for_timeout(100)
  page.evaluate('uniTest.on(5)');page.wait_for_timeout(450)
  page.evaluate('uniTest.off();window.restoredDry=fxVoices.at(-1)')
  restored=page.evaluate('({actual:restoredDry.anchor-restoredDry.sourceStart,expected:(restoredDry.start-originalDry.start)*Math.pow(2,(originalDry.semitones+originalDry.tweak.pitch)/12)})')
  assert abs(restored['actual']-restored['expected'])<.003,restored
  print('PASS Unison release restores the original dry read timeline instead of inheriting a detuned layer cursor')
  envelope_peak=page.evaluate('uniTest.cancelEnvelope()')
  assert envelope_peak<.49,envelope_peak
  print('PASS cancellation during attack preserves the current gain instead of boosting it before release')
  for method in ['cancelFirst','cutFirst']:
   page.evaluate('uniTest.stop();uniTest.earlyAdmission()');page.wait_for_timeout(40)
   before_admission=page.evaluate('({gain:waitingDry.priorityMask.gain.value,start:waitingDry.start,end:waitingDry.end})')
   page.evaluate('method=>uniTest[method]()',method);page.wait_for_timeout(25)
   after_admission=page.evaluate('({gain:waitingDry.priorityMask.gain.value,start:waitingDry.start,end:waitingDry.end})')
   assert before_admission['gain']==0 and after_admission['gain']==1,(method,before_admission,after_admission)
   assert before_admission['start']==after_admission['start'] and before_admission['end']==after_admission['end']
  print('PASS early cancellation and cutoff admit the waiting fifth source without restarting its gate')
  mixed=page.evaluate('uniTest.mixedReader()')
  assert 5 not in mixed['notes'] and mixed['notes'][-1]==6,mixed
  assert mixed['origin']==0 and mixed['lastAnchor']==0,mixed
  print('PASS unified Loop3 window ignores intermediate notes, captures the next window, and Loop4 entry repeats the new source instead of a stale cursor')
  fallback_peak=page.evaluate('uniTest.fallbackCut()')
  assert fallback_peak<=.201,fallback_peak
  print('PASS fallback same-slot/four-voice choke fades the current gain without a forced full-level spike')
  for ticks in [1,4,8]:
   late=page.evaluate('n=>uniTest.lateReader(n)',ticks)
   assert late['finite'] and abs(late['anchor']-late['origin'])<=1/r,(ticks,late)
   assert abs(late['position']-late['origin'])<1e-6,(ticks,late)
   if ticks>=4:assert late['origin']>0,(ticks,late)
  print('PASS delayed Loop boundary keeps a finite source cursor instead of reusing an absent reset position')
  for scratch_kind in [11,12]:
   for release_early in [False,True]:
    queued_at=page.evaluate('n=>uniTest.queuedScratch(n)',scratch_kind)
    if release_early:page.evaluate('uniTest.off()')
    pending=page.evaluate('fxVoices.filter(v=>v.end>v.start && (v.cutAt===undefined || v.cutAt>v.start)).map(v=>({start:v.start,gate:v.scratch?v.scratchGate:v.gateEnd-v.start,fresh:v.scratch?.fresh,effect:v.effect}))')
    assert len(pending)==1 and abs(pending[0]['start']-queued_at)<1e-6,(scratch_kind,release_early,pending)
    assert abs(pending[0]['gate']-.4)<1e-6,(scratch_kind,release_early,pending)
    assert pending[0]['effect']==(0 if release_early else scratch_kind),(scratch_kind,release_early,pending)
    if not release_early:assert pending[0]['fresh'],pending
    page.wait_for_timeout(110);assert active(),(scratch_kind,release_early)
  print('PASS live Scratch/Fast entry and early release preserve queued onset/gate instead of ending a fresh note at the old reverse origin')
  for target in [5,6,0]:
   page.evaluate('uniTest.stop();uniTest.native(false);window.queuedAt=uniTest.futureUnison();uniTest.on(5)')
   if target==6:page.evaluate('uniTest.on(6)')
   if target==0:page.evaluate('uniTest.off()')
   page.wait_for_timeout(25);voices=active()
   assert len(voices)==(1 if target==0 else 4) and all(v['slot']==3 for v in voices),(target,voices)
   pending=page.evaluate('n=>fxVoices.filter(v=>v.slot===1 && v.effect===n && v.end>v.start && (v.cutAt===undefined || v.cutAt>v.start)).map(v=>({start:v.start,gate:v.gateEnd}))',target)
   queued_at=page.evaluate('queuedAt')
   assert len(pending)==(1 if target==0 else 4),(target,pending)
   assert all(abs(v['start']-queued_at)<1e-6 and abs(v['gate']-queued_at-.3)<1e-6 for v in pending),(target,pending,queued_at)
   page.wait_for_timeout(520);voices=active()
   assert (len(voices)==2 and {v['slot'] for v in voices}=={1,3}) if target==0 else (len(voices)==4 and all(v['slot']==1 for v in voices)),(target,voices)
  print('PASS live Unison enter/switch/release preserves ringing slots and queued note onset/gate with fresh group sizes')
  for native in [False,True]:
   for saved in [False,True]:
    for slot in [1,2]:
     page.evaluate('a=>{uniTest.stop();uniTest.native(a.native);uniTest.fire(a.slot,4,0)}',{'native':native,'slot':slot})
     page.evaluate('s=>s?uniTest.onSaved(5):uniTest.on(5)',saved);page.wait_for_timeout(20)
     page.evaluate('s=>s?uniTest.onSaved(6):uniTest.on(6)',saved);page.wait_for_timeout(20)
     page.evaluate('s=>s?uniTest.offSaved():uniTest.off()',saved);page.wait_for_timeout(20)
     should_stop=native and saved and slot!=1
     assert bool(active())!=should_stop,(native,saved,slot,active())
  for kind in [5,6]:
   page.evaluate('n=>{uniTest.stop();uniTest.native(true);uniTest.fire(2,4,0);uniTest.onSaved(n)}',kind);page.wait_for_timeout(20)
   page.evaluate('uniTest.offSaved()');page.wait_for_timeout(20);assert active(),kind
  page.evaluate('uniTest.stop();uniTest.native(true);uniTest.fire(2,4,0);uniTest.onSaved(5)');page.wait_for_timeout(20)
  page.evaluate('uniTest.onSaved(6)');page.wait_for_timeout(20)
  page.evaluate('uniTest.queueFuture();uniTest.offSaved()');page.wait_for_timeout(110)
  assert page.evaluate('futureAfterRelease.priorityMask.gain.value')==1
  assert any(v['slot']==3 for v in active())
  page.evaluate('uniTest.stop();uniTest.native(true);uniTest.fire(9,4,0);uniTest.onSaved(5)');page.wait_for_timeout(15)
  page.evaluate('uniTest.onSaved(6)');page.wait_for_timeout(15)
  page.evaluate('uniTest.offSaved()');page.wait_for_timeout(15)
  assert any(v['slot']==9 for v in active()),'unmeasured drum release must retain the existing path'
  page.evaluate('uniTest.stop();uniTest.native(true);uniTest.fire(2,4,0);uniTest.onSaved(5)');page.wait_for_timeout(15)
  page.evaluate('uniTest.onSaved(6)');page.wait_for_timeout(15)
  page.evaluate('uniTest.fire(2,4,6)');page.wait_for_timeout(15)
  page.evaluate('uniTest.offSaved()');page.wait_for_timeout(20)
  assert any(v['slot']==2 for v in active()),'a new note during FX6 must not inherit the old note switch history'
  page.evaluate('uniTest.stop();uniTest.native(false)')
  print('PASS v16 native saved5→6 release scope, unchanged live/non-native/single-FX behavior, and audible queued notes after release')
  assert not errors,errors
  print('PASS measured four-layer Unison/Low, live enter/switch/release, shared choke group, drum index and global four-voice stealing')
  b.close()
finally:server.shutdown();server.server_close()
