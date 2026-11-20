"""Global tempo, ordered/repeated chain restart and factory BPM recovery."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=b.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""if(!localStorage.getItem('global-chain-fixture')){const a=()=>Array.from({length:16},()=>Array(16).fill(-1));for(const [n,note] of [[1,4],[2,6],[3,8]]){const lanes=a();lanes[0][0]=note;localStorage.setItem('po33.pat'+n,btoa(JSON.stringify(lanes)));}localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:240,swing:0,pattern:2,chain:[3,1,3,2],patternSettings:[{bpm:80,swing:0},{bpm:132,swing:.3},{bpm:200,swing:.2}].concat(Array(13).fill(null))})));localStorage.setItem('global-chain-fixture','1');}window.starts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){starts.push({when:a[0],rate:this.playbackRate.value});return start.apply(this,a);};""")
  page.goto(base+'index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  def tap(act):page.locator('[data-act="'+act+'"]').click()
  def choose(n):
   page.locator('[data-act="pattern"]').dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True});page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':2,'button':0,'bubbles':True});page.evaluate('()=>{for(const i of [2,1])window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}));}')
  def chain(numbers):
   page.locator('[data-act="pattern"]').dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True})
   for n in numbers:
    page.locator('[data-pad="'+str(n)+'"]').dispatch_event('pointerdown',{'pointerId':2,'button':0,'bubbles':True});page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:2,bubbles:true}))')
   page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:1,bubbles:true}))')
  def meta():page.wait_for_timeout(350);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
  tap('play');page.wait_for_function('starts.length>=2');page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P01"')
  starts=page.evaluate('starts');assert abs(starts[0]['rate']-2**(7/12))<.001 and starts[1]['rate']==1,starts
  assert abs(starts[1]['when']-starts[0]['when']-1)<.003,starts
  tap('play');page.evaluate('starts=[]');tap('play');page.wait_for_function('starts.length>=1');assert abs(page.evaluate('starts[0].rate')-2**(7/12))<.001
  assert page.locator('#lcdNumber').get_attribute('data-value')=='P03';tap('play')
  page.evaluate('()=>{for(let i=0;i<48;i++)window.dispatchEvent(new Event("scrollDown"));}');assert meta()['bpm']==192
  choose(2);assert meta()['bpm']==192;choose(3);assert meta()['bpm']==192
  chain([3,1,3,2]);page.evaluate('starts=[]');tap('play');page.wait_for_function('starts.length>=4',timeout=6000)
  starts=page.evaluate('starts');assert all(abs(b['when']-a['when']-1.25)<.003 for a,b in zip(starts,starts[1:])),starts
  assert [round(s['rate'],3) for s in starts[:4]]==[round(2**(7/12),3),1,round(2**(7/12),3),round(2**(3/12),3)],starts
  tap('play');assert 'patternSettings' not in meta();page.reload();page.wait_for_function('document.body.dataset.loading==="false"');assert meta()['bpm']==192
  # Restore the actual cached factory demo after a speed edit; no per-pattern map survives.
  with page.expect_navigation(timeout=15000):page.locator('#factoryReset').dispatch_event('pointerdown',{'pointerId':9,'button':0,'bubbles':True})
  page.wait_for_function('document.body.dataset.loading==="false"');m=meta();assert m['bpm']==132 and m['chain']==list(range(1,9)) and 'patternSettings' not in m,m
  # Delayed creationStorage bridge follows the same reset and preserves the installation namespace.
  r1=b.new_page(viewport={'width':240,'height':282});r1.add_init_script("window.creationStorage={plain:{getItem:async k=>{await new Promise(r=>setTimeout(r,20));return localStorage.getItem(k);},setItem:async(k,v)=>{await new Promise(r=>setTimeout(r,40));localStorage.setItem(k,v);},removeItem:async k=>{await new Promise(r=>setTimeout(r,10));localStorage.removeItem(k);}}};")
  r1.goto(base+'flowers-20261120-ui6.html');r1.wait_for_function('document.body.dataset.loading==="false"');r1.evaluate('()=>{for(let i=0;i<52;i++)window.dispatchEvent(new Event("scrollDown"));}');r1.wait_for_timeout(500)
  k='po33.install.flowers-20261120.po33.meta';assert r1.evaluate('k=>JSON.parse(atob(localStorage.getItem(k))).bpm',k)==80
  with r1.expect_navigation(timeout=15000):r1.locator('#factoryReset').dispatch_event('pointerdown',{'pointerId':9,'button':0,'bubbles':True})
  r1.wait_for_function('document.body.dataset.loading==="false"');r1.wait_for_timeout(500);assert r1.evaluate('k=>JSON.parse(atob(localStorage.getItem(k))).bpm',k)==132
  assert not errors,errors
  b.close();print('PASS chain [3,1,3,2] restarts at head after stop, including repeats; one global BPM ignores legacy maps across selection/chain/reload; factory reset restores 132 through localStorage and delayed creationStorage.')
finally:server.shutdown();server.server_close()
