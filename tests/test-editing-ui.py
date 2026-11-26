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
   response=route.fetch();source=response.text();source=source.rsplit('})();',1)[0]+"window.uiTest={input:(r,p)=>{inputLevel=r;inputPeak=p;micReady=()=>true;updateLCD();},display:v=>{showNumber(v,'TEST');updateLCD();},mode:n=>{tweakMode=n;parameterDisplay=true;paint();},knob:(i,dir)=>{const spec=syncKnobTarget(i);knobAngles[i]=knobPickup[i].target*KNOB_SWEEP;knobPickup[i].caught=true;adjustKnob(i,dir*(tweakMode===0&&i===0&&!bpmHeld?.1:1)/(spec[2]-spec[1])*100);},snapshot:()=>({parameterDisplay,writeHeld,mode:state.mode,pattern:seq.pattern,slot:state.slot,tweaks,patterns,extras:patternExtras,samples:samples.map(Boolean)})};})();"
   route.fulfill(response=response,body=source)
  page.route('**/app.js*',instrument)
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.add_init_script("const a=JSON.parse(localStorage.getItem('step-fx-config')||'null');if(a){for(let p=1;p<=3;p++){const lanes=Array.from({length:16},()=>Array(16).fill(-1));for(const i of a.notes){lanes[p-1][i]=i;if(p===1&&a.dense)for(let s=0;s<5;s++)lanes[s][i]=i;}localStorage.setItem('po33.install.web-sampler-20261126.po33.pat'+p,btoa(JSON.stringify(lanes)));}const m=JSON.parse(atob(localStorage.getItem('po33.install.web-sampler-20261126.po33.meta')));m.bpm=240;m.swing=0;m.pattern=1;m.chain=a.chain;m.extras=Array.from({length:16},()=>({effects:[],locks:{}}));if(a.jump)m.extras[0].effects[4]=14;localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify(m)));}")
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
  configure();page.evaluate('uiTest.mode(1);uiTest.knob(0,0)')
  def display():return page.locator('#lcdNumber').get_attribute('aria-label') or page.locator('#lcdNumber').text_content()
  assert page.locator('#lcdMeter rect').count()==38
  geometry=page.locator('#lcdMeter').evaluate('e=>{const r=e.getBBox();return {width:r.width,height:r.height}}')
  assert abs(geometry['width']-199.8)<.01 and geometry['height']>3,geometry
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(80)
  assert page.locator('#lcdMeter rect').count()==38
  page.set_viewport_size({'width':240,'height':282})
  def lit():return page.locator('#lcdMeter rect[data-active="true"]').count()
  assert lit()==1
  page.evaluate('uiTest.knob(0,-50)');assert lit()==19
  page.evaluate('uiTest.knob(0,-50)');assert lit()==0
  page.evaluate('uiTest.knob(0,150)');assert lit()==19
  page.evaluate('uiTest.knob(1,1)');assert 'res' in display().lower(),display()
  page.evaluate('uiTest.mode(0);uiTest.knob(0,1)');assert 'ptc' in display().lower(),display()
  page.evaluate('uiTest.knob(1,1)');assert 'vol' in display().lower(),display()
  page.evaluate('uiTest.mode(2);uiTest.knob(0,0)');assert '000' in display(),display()
  page.evaluate('uiTest.knob(1,0)');assert '999' in display(),display()
  assert page.locator('#knobA').evaluate('e=>getComputedStyle(e).outlineStyle')=='none'
  play();assert page.evaluate('!uiTest.snapshot().parameterDisplay && uiTest.snapshot().mode==="PLAY"')
  play();down('write');up(1);play();assert page.evaluate('uiTest.snapshot().mode==="STEP"');play()
  print('PASS 38 squares, filter directions, parameter codes, trim 000–999, no knob outline; PLAY exits editing and preserves WRITE')
  configure()
  for w,h in [(240,282),(390,844),(768,1024)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
   for value in ['8888','39.8','0901','P16','nof','rcv']:
    page.evaluate('v=>uiTest.display(v)',value)
    record=page.locator('#lcdRecord').bounding_box();playRect=page.locator('#lcdPlay').bounding_box();number=page.locator('#lcdNumber').bounding_box();screen=page.locator('#samplerScreen').bounding_box()
    assert record['x']+record['width']<playRect['x'] and playRect['x']+playRect['width']<number['x'],(value,record,playRect,number)
    assert number['x']+number['width']<=screen['x']+screen['width']+.1,(value,number,screen)
   for bank in ['.melodic-bank','.drum-bank']:
    assert page.locator(bank+' .bank-text').evaluate('e=>getComputedStyle(e).writingMode')=='vertical-rl'
    geometry=page.locator(bank).evaluate('e=>{const p=getComputedStyle(e,"::before"),t=e.querySelector(".bank-text").getBoundingClientRect(),r=e.getBoundingClientRect();return {left:p.borderLeftStyle,right:p.borderRightWidth,gap:t.top-r.top-parseFloat(p.height)-parseFloat(p.borderTopWidth)}}')
    assert geometry['left']=='solid' and geometry['right']=='0px' and geometry['gap']>0,geometry
  page.screenshot(path=str(root/'t/panel-order-spacing-preview.png'))
  page.set_viewport_size({'width':240,'height':282})
  down('sound');down('rec',2);up(2);up(1)
  assert page.evaluate('uiTest.snapshot().samples[0]'), 'reverse SOUND then REC deleted sound'
  down('pattern');down('rec',2);up(2);up(1)
  assert page.evaluate('uiTest.snapshot().patterns[0].lanes.some(l=>l.some(n=>n>=0))'), 'reverse PATTERN then REC deleted pattern'
  print('PASS ordered delete ignores reversed chords; status elements never overlap at R1/phone/iPad sizes; brackets open right with text clearance')
  assert page.evaluate('uiTest.snapshot().patterns[0].lanes.some(l=>l.some(n=>n>=0))')
  down('rec');page.wait_for_timeout(100)
  assert display().lower()=='rec' and page.locator('#lcdNumber').evaluate('e=>getComputedStyle(e).animationName')=='record-code-blink'
  page.evaluate('uiTest.input(.2,.8)');page.wait_for_timeout(180)
  assert page.locator('#lcdMeter').get_attribute('data-indicator-origin')=='left'
  assert page.locator('#lcdMeter [data-peak=true]').count()==1
  peak=page.locator('#lcdMeter [data-peak=true]').get_attribute('data-segment');assert int(peak)>10
  down('pattern',2);page.wait_for_timeout(1400)
  assert display().lower()=='clr' and 'record-armed-blink' not in page.locator('#lcdNumber').get_attribute('class')
  up(2);page.wait_for_timeout(80);assert display().lower()=='rec';up(1)
  assert page.evaluate('uiTest.snapshot().patterns[0].lanes.every(l=>l.every(n=>n<0))')
  assert page.evaluate('uiTest.snapshot().patterns[1].lanes.some(l=>l.some(n=>n>=0))')
  down('rec');down('sound',2);page.wait_for_timeout(100)
  assert display().lower()=='del';page.wait_for_timeout(1300);assert display().lower()=='del'
  up(2);up(1);page.wait_for_timeout(80);assert 'record-armed-blink' not in (page.locator('#lcdNumber').get_attribute('class') or '')
  assert page.evaluate('!uiTest.snapshot().samples[0] && uiTest.snapshot().samples[1]')
  assert not errors,errors;print('PASS immediate REC+PATTERN and REC+SOUND clear selected target only')
  b.close()
finally:server.shutdown();server.server_close()
