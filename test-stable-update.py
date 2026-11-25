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
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True);page=b.new_page(viewport={'width':390,'height':844},has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   r=route.fetch();s=r.text();s=s.rsplit('})();',1)[0]+"window.testSnapshot=snapshotProject;window.testChange=()=>{params.bpm=137;patternChain=[3,1,3];tweaks[0].pitch=7;flushPersist();};})();";route.fulfill(response=r,body=s)
  page.add_init_script("window.creationStorage={plain:{getItem:k=>new Promise(resolve=>window.dispatchEvent(new CustomEvent('nativeKV',{detail:{op:'get',k,resolve}}))),setItem:(k,v)=>new Promise(resolve=>window.dispatchEvent(new CustomEvent('nativeKV',{detail:{op:'set',k,v,resolve}}))),removeItem:k=>new Promise(resolve=>window.dispatchEvent(new CustomEvent('nativeKV',{detail:{op:'remove',k,resolve}})))}};window.addEventListener('nativeKV',({detail:d})=>setTimeout(()=>{const value=d.op==='get'?localStorage.getItem(d.k):d.op==='set'?localStorage.setItem(d.k,d.v):localStorage.removeItem(d.k);d.resolve(value);},2));")
  page.route('**/app.js?*',instrument)
  base=f'http://127.0.0.1:{server.server_port}/'
  def loaded():page.wait_for_function('document.body?.dataset.loading==="false" && window.testSnapshot')
  def receive():
   for act,i in [('write',1),('sound',2),('rec',3)]:page.locator('[data-act='+act+']').dispatch_event('pointerdown',{'pointerId':i,'bubbles':True})
   for i in [3,2,1]:page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
   page.wait_for_timeout(250)
  page.goto(base+'creation.html');loaded();assert page.url==base+'creation.html';assert page.evaluate('PO33_BUILD')==json.loads((root/'app-release.json').read_text())['version']
  page.evaluate('testChange()');page.wait_for_timeout(1200)
  head=page.locator('#rabbitMascot');assert head.get_attribute('role') is None and head.get_attribute('tabindex') is None
  head.dispatch_event('pointerdown',{'pointerId':91,'button':0,'bubbles':True});page.wait_for_timeout(5200)
  page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:91,bubbles:true}))')
  assert page.evaluate('testSnapshot().bpm')==137 and not page.locator('body').get_attribute('data-resetting')
  print('PASS long-holding mascot has no reset action; receive-menu reset remains available')
  page.evaluate('testChange();localStorage.setItem("unrelated-app","keep");localStorage.setItem("po33.localHub.ip","192.168.1.1")');page.wait_for_timeout(1200)
  page.route('**/app-release.json?*',lambda route:route.abort())
  receive();page.locator('#transferUpdate').click();page.wait_for_function('document.body?.dataset.transfer==="error"');assert page.evaluate('testSnapshot().bpm')==137
  page.unroute('**/app-release.json?*');page.locator('#transferClose').click()
  receive();page.locator('#transferUpdate').click();page.wait_for_url('**/creation.html?refresh=*');loaded();page.wait_for_function('location.search===""');s=page.evaluate('testSnapshot()');assert s['bpm']==137 and s['chain']==[3,1,3] and s['tweaks'][0]['pitch']==7,s['bpm']
  print('PASS fixed URL boot and forced update preserve user BPM, chain, pitch and storage identity')
  receive()
  page.locator('#transferFileInput').set_input_files(str(root/'t/official-backup-tests/tiny-transfer-48000.wav'))
  page.wait_for_function('document.body?.dataset.transfer==="success"');assert page.evaluate('PO33Transfer.hasSession');page.evaluate('PO33Transfer.close()');receive()
  page.locator('#transferFactoryReset').click();page.locator('#transferFactoryReset').click();page.wait_for_function('document.body?.dataset.resetting==="true"');page.wait_for_timeout(1100);loaded();page.wait_for_function('!document.body.hasAttribute("data-resetting")')
  s=page.evaluate('testSnapshot()');assert s['bpm']==132 and s['chain']==list(range(1,9)) and s['tweaks'][0]['pitch']==0
  assert page.evaluate('localStorage.getItem("unrelated-app")')=='keep';assert page.evaluate('localStorage.getItem("po33.localHub.ip")') is None
  assert not page.evaluate('PO33Transfer.hasSession');assert not errors,errors
  print('PASS factory reset restores full demo and removes user edits/preferences without clearing unrelated data')
  stalled=b.new_page()
  stalled.add_init_script("localStorage.setItem('user-project-probe','keep');window.creationStorage={plain:{getItem:()=>new Promise(()=>{}),setItem:()=>{throw Error('must not save')},removeItem:()=>{throw Error('must not delete')}}};")
  stalled.goto(base+'creation.html');stalled.locator('#startupRecovery').wait_for(state='visible',timeout=12000)
  assert stalled.locator('body').get_attribute('data-loading')=='true'
  assert stalled.evaluate('localStorage.getItem("user-project-probe")')=='keep'
  assert '重新打开' in stalled.locator('#startupRecovery').text_content()
  print('PASS stalled Creation bridge produces reopen guidance, keeps startup read-only and preserves user storage')
  b.close()
finally:server.shutdown();server.server_close()
