"""Delayed R1 startup, Flowers tempo repair, audible Pattern LCD and real voice lamps."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""window.creationStorage={plain:{getItem:async k=>{await new Promise(r=>setTimeout(r,200));return localStorage.getItem(k);},setItem:async(k,v)=>localStorage.setItem(k,v),removeItem:async k=>localStorage.removeItem(k)}};window.starts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){starts.push({id:this.buffer?._po33id,when:a[0],ctx:this.context});return start.apply(this,a);};""")
  page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-play2.html')
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel):down(sel);up()
  assert page.locator('body').get_attribute('data-loading')=='true'
  tap('#bpmMode');tap('[data-act="play"]');page.evaluate('window.dispatchEvent(new Event("scrollDown"))')
  page.wait_for_function('document.body.dataset.loading==="false"')
  key='po33.install.flowers-20261120.po33.meta'
  page.wait_for_timeout(450)
  def meta():return page.evaluate('k=>JSON.parse(atob(localStorage.getItem(k)))',key)
  assert meta()['bpm']==132 and not page.evaluate('starts.length')
  # Simulate the previously shipped, unedited factory project saved incorrectly at 80.
  page.add_init_script("""(()=>{const k='po33.install.flowers-20261120.po33.meta';if(!localStorage.getItem('tempo-fixture')){const m=JSON.parse(atob(localStorage.getItem(k)));m.bpm=80;m.patternSettings[0].bpm=80;delete m.factoryTempoRevision;localStorage.setItem(k,btoa(JSON.stringify(m)));localStorage.setItem('tempo-fixture','1');}})();""")
  page.reload();page.wait_for_function('document.body.dataset.loading==="false"');page.wait_for_timeout(450)
  assert meta()['bpm']==132 and meta()['patternSettings'][0]['bpm']==132 and meta()['factoryTempoRevision']==1
  tap('[data-act="play"]');page.wait_for_function('document.querySelector(\'[data-pad="2"]\').dataset.ledReason==="sound-trigger"')
  assert page.locator('#lcdNumber').get_attribute('data-value')=='P01'
  page.screenshot(path=str(root/'playback-indicators-preview.png'))
  assert page.locator('[data-pad="1"]').get_attribute('data-led-reason')=='sound-trigger'
  assert page.locator('[data-pad="9"]').get_attribute('data-led-reason')=='sound-trigger'
  lengths=[];onsets=set();levels=set()
  for _ in range(25):
   attrs=page.locator('[data-pad="2"]').evaluate('e=>({...e.dataset})')
   if attrs.get('ledReason')=='sound-trigger':
    onsets.add(float(attrs['ledOnset']));levels.add(attrs['ledLevel']);lengths.append(float(attrs['ledEnd'])-float(attrs['ledOnset']))
   page.wait_for_timeout(25)
  assert len(onsets)>=2 and 'bright' in levels and 'off' in levels,(onsets,levels)
  assert all(0<x<=2*60/132/4+.002 for x in lengths),lengths
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P02"',timeout=2500)
  # Lookahead may already prepare the next pattern, but LCD changes at its audible first note.
  assert page.evaluate('starts[0].ctx.currentTime-starts[0].when>=16*60/132/4-.03')
  tap('[data-act="play"]');assert page.locator('[data-led-reason="sound-trigger"]').count()==0
  # A later deliberate tempo edit is preserved; the repair is only applied once.
  page.evaluate('window.dispatchEvent(new Event("scrollUp"))');page.wait_for_timeout(500);assert meta()['bpm']==133
  page.reload();page.wait_for_function('document.body.dataset.loading==="false"');assert meta()['bpm']==133
  private=browser.new_page(viewport={'width':240,'height':282})
  private.add_init_script("const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[1][0]=4;lanes[8][0]=2;const extras=Array.from({length:16},()=>({effects:[],locks:{},steps:{}}));extras[15].steps['8:0']={length:0,retrigs:4};localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:80,pattern:16,chain:[16],extras})));localStorage.setItem('po33.pat16',btoa(JSON.stringify(lanes)));")
  private.goto(f'http://127.0.0.1:{server.server_port}/index.html');private.wait_for_function('document.body.dataset.loading==="false"');private.locator('[data-act="play"]').click()
  private.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P16"')
  assert private.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).bpm')==80
  retriggers=set()
  for _ in range(30):
   onset=private.locator('[data-pad="9"]').get_attribute('data-led-onset')
   if onset:retriggers.add(round(float(onset),5))
   private.wait_for_timeout(10)
  assert len(retriggers)==4,retriggers
  assert not errors,errors
  browser.close();print('PASS slow SDK startup ignores premature BPM/play input; untouched Flowers 80->132 one-time repair; manual tempo retained; audible P01/P02; simultaneous slot lamps override chase, follow gates and retriggers, clear at stop.')
finally:server.shutdown();server.server_close()
