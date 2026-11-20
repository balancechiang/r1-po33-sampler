"""Binary asset migration/dedup/failure and frame-accurate R1 wheel editing."""
import base64,struct
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
n=4000;body=struct.pack('<'+'h'*n,*([1200]*n));wav=base64.b64encode(b'RIFF'+struct.pack('<I',36+len(body))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,16000,32000,2,16)+b'data'+struct.pack('<I',len(body))+body).decode()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("(()=>{const wav="+__import__('json').dumps(wav)+";if(!localStorage.getItem('stability')){localStorage.setItem('stability','1');localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,slot:5})));localStorage.setItem('po33.slot5',btoa(JSON.stringify(wav)));}})();")
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('localStorage.getItem("po33.slot5") && JSON.parse(atob(localStorage.getItem("po33.slot5"))).format===4');page.mouse.click(10,10)
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel,i=1):down(sel,i);up(i)
  def select(n):down('[data-act="sound"]');tap(f'[data-pad="{n}"]',2);up()
  def copy(n):down('[data-act="sound"]');down('[data-act="write"]',2);tap(f'[data-pad="{n}"]',3);up(2);up()
  def indexed(n):return page.evaluate('n=>JSON.parse(atob(localStorage.getItem("po33.slot"+n)))',n)
  original=page.evaluate('localStorage.getItem("po33.slot5")');assert len(original)<1200
  select(5);copy(6);page.wait_for_function('!!localStorage.getItem("po33.slot6")');assert indexed(5)['base']['asset']==indexed(6)['base']['asset']
  count=page.evaluate('''()=>new Promise((resolve,reject)=>{const r=indexedDB.open(PO33SampleAssets.databaseName,1);r.onsuccess=()=>{const db=r.result,q=db.transaction('assets').objectStore('assets').count();q.onsuccess=()=>{resolve(q.result);db.close()};q.onerror=()=>reject(q.error)}})''');assert count==1,count
  # Failed replacement leaves the verified old index intact.
  page.evaluate('()=>{window.originalPack=PO33SampleAssets.pack;PO33SampleAssets.pack=async()=>{throw Error("quota")};}');select(2);copy(5);page.wait_for_function('document.querySelector("#hint").textContent.includes("IN MEMORY ONLY")');assert page.evaluate('localStorage.getItem("po33.slot5")')==original
  page.evaluate('()=>{PO33SampleAssets.pack=originalPack;}');page.reload();page.wait_for_timeout(700);page.mouse.click(10,10);assert indexed(5)['base']['asset']==indexed(6)['base']['asset']
  # Rapid replacements must keep the newest pending write, not an intermediate take.
  page.evaluate("()=>{window.packBeforeBurst=PO33SampleAssets.pack;PO33SampleAssets.pack=async(...args)=>{await new Promise(r=>setTimeout(r,100));return packBeforeBurst(...args);};}")
  for source in [1,2,3]:select(source);copy(5)
  page.wait_for_function('JSON.parse(atob(localStorage.getItem("po33.slot5"))).base.origin==="factory-2-3"')
  page.evaluate('()=>{PO33SampleAssets.pack=packBeforeBurst;}')
  # A focused trim knob owns the hardware wheel; no focus leaves default BPM intact.
  select(1);copy(9);select(9);tap('[data-act="fx"]');tap('[data-act="fx"]');tap('[data-pad="1"]')
  box=page.locator('#knobA').bounding_box();page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
  page.evaluate('window.dispatchEvent(new Event("scrollUp"))');page.wait_for_timeout(450)
  start=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).tweaks[8].slices[0].frames.start');assert start==1,start
  page.evaluate('for(let i=0;i<30;i++)window.dispatchEvent(new Event("scrollUp"))');page.wait_for_timeout(450)
  coarse=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).tweaks[8].slices[0].frames.start');assert coarse>start+4000,coarse
  page.mouse.click(10,10);before=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).bpm');page.evaluate('window.dispatchEvent(new Event("scrollUp"))');page.wait_for_timeout(450);assert page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).bpm')==before+1
  isolated=browser.new_page();isolated.goto(f'http://127.0.0.1:{server.server_port}/index.html');isolated.wait_for_timeout(600)
  assert isolated.evaluate("""async()=>{const context=new AudioContext(),buffer=context.createBuffer(1,256,48000);buffer.getChannelData(0).set(Float32Array.from({length:256},(_,i)=>i/512));const sample={buffer,offset:0,duration:buffer.duration};const a=await PO33SampleAssets.pack(1,sample),copy=await PO33SampleAssets.pack(2,sample);await PO33SampleAssets.finish(2,copy);const restored=await PO33SampleAssets.unpack(a,context,{});if(!restored.buffer.getChannelData(0).every((x,i)=>x===buffer.getChannelData(0)[i]))return false;await PO33SampleAssets.finish(2,null);const count=()=>new Promise(resolve=>{const r=indexedDB.open(PO33SampleAssets.databaseName,1);r.onsuccess=()=>{const db=r.result,q=db.transaction('assets').objectStore('assets').count();q.onsuccess=()=>{resolve(q.result);db.close()};};});if(await count()!==1)return false;await PO33SampleAssets.reconcile([[1,null],[2,null]]);await context.close();return await count()===0;}""")
  shared=browser.new_context(viewport={'width':240,'height':282});scopes=[];tabs=[]
  for label,source in [('creationA',1),('creationB',2)]:
   tab=shared.new_page();tab.add_init_script("const prefix="+__import__('json').dumps(label+':')+";window.creationStorage={plain:{getItem:k=>localStorage.getItem(prefix+k),setItem:(k,v)=>localStorage.setItem(prefix+k,v),removeItem:k=>localStorage.removeItem(prefix+k)}};")
   tab.goto(f'http://127.0.0.1:{server.server_port}/index.html');tab.wait_for_function('!!PO33SampleAssets.databaseName');tab.wait_for_timeout(400);tab.mouse.click(10,10)
   tab.evaluate("""source=>{const down=(q,i)=>document.querySelector(q).dispatchEvent(new PointerEvent('pointerdown',{pointerId:i,button:0,bubbles:true})),up=i=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:i,bubbles:true}));down('[data-act=sound]',1);down('[data-pad="'+source+'"]',2);up(2);up(1);down('[data-act=sound]',1);down('[data-act=write]',2);down('[data-pad="5"]',3);up(3);up(2);up(1);}""",source)
   tab.wait_for_function("label=>!!localStorage.getItem(label+':po33.slot5')",arg=label);scopes.append(tab.evaluate('PO33SampleAssets.databaseName'));tabs.append(tab)
  assert scopes[0]!=scopes[1]
  tabs[1].evaluate('PO33SampleAssets.clear()');tabs[0].reload();tabs[0].wait_for_timeout(700)
  assert tabs[0].locator('[data-pad="5"]').evaluate('e=>e.classList.contains("sampled")')
  assert 'UNREADABLE' not in tabs[0].locator('#hint').text_content()
  shared.close()
  assert not errors,errors
  browser.close();print('PASS legacy PCM migration, small KV indexes, binary asset dedup across copies/reload, failed-save rollback, fine one-frame wheel and accelerated coarse edits, default BPM preserved.')
finally:server.shutdown();server.server_close()
