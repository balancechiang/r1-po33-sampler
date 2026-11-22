from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));cdp=c.new_cdp_session(page)
  page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui15.html');page.wait_for_function('document.body.dataset.loading==="false"')
  key='po33.install.flowers-20261120.po33.meta'
  def meta():page.wait_for_timeout(350);return page.evaluate('k=>JSON.parse(atob(localStorage.getItem(k)))',key)
  def latch():
   r=page.locator('[data-act="pattern"]').bounding_box();cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']/2,'y':r['y']+r['height']/2}]});page.wait_for_timeout(560);page.wait_for_function("document.querySelector('[data-act=\"pattern\"]').classList.contains('hold-active')");cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert page.locator('[data-act="pattern"].hold-active').count()==1
  def pad(n):page.locator('[data-pad="'+str(n)+'"]').tap()
  def wait():page.wait_for_function("!document.querySelector('[data-act=\"pattern\"]').classList.contains('hold-active')");page.wait_for_timeout(400)
  latch();pad(1);page.wait_for_timeout(700);pad(1);page.wait_for_timeout(700);pad(1);pad(4);wait();assert meta()['chain']==[1,1,1,4]
  assert page.locator('body').get_attribute('data-mode')=='PLAY'
  page.evaluate('()=>{for(let i=0;i<108;i++)window.dispatchEvent(new Event("scrollUp"));}');page.wait_for_timeout(1300)
  page.locator('[data-act="play"]').tap();page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P04"',timeout=4500);page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P01"',timeout=1800);page.locator('[data-act="play"]').tap()
  latch();pad(7);page.wait_for_timeout(700);assert page.locator('[data-act="pattern"].hold-active').count()==1;wait();assert meta()['chain']==[7] and meta()['pattern']==7
  # A fresh edit replaces the old sequence and preserves all 128 repeated entries.
  latch();page.evaluate("""()=>{const e=document.querySelector('[data-pad="2"]');for(let i=0;i<130;i++){e.dispatchEvent(new PointerEvent('pointerdown',{pointerId:71,pointerType:'touch',button:0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:71,pointerType:'touch',bubbles:true}));}}""");wait();assert meta()['chain']==[2]*128
  # Real two-finger hold ignores the single-finger idle window.
  el=page.locator('[data-act="pattern"]');el.dispatch_event('pointerdown',{'pointerId':41,'pointerType':'touch','button':0,'bubbles':True});pad(3);page.wait_for_timeout(1450);assert page.locator('body').get_attribute('data-mode')=='PATTERN';pad(5);page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:41,pointerType:"touch",bubbles:true}))');assert meta()['chain']==[3,5]
  # PLAY explicitly confirms a pending one-finger sequence without waiting.
  latch();pad(4);pad(2);page.locator('[data-act="play"]').tap();assert meta()['chain']==[4,2]
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P02"',timeout=2000);page.locator('[data-act="play"]').tap()
  # Editing an already playing song starts at the first new entry at the boundary.
  page.locator('[data-act="play"]').tap();latch();pad(5);pad(6);wait();assert meta()['chain']==[5,6]
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P05"',timeout=2000)
  page.wait_for_function('document.querySelector("#lcdNumber").dataset.value==="P06"',timeout=1800)
  page.locator('[data-act="play"]').tap()
  page.reload();page.wait_for_function('document.body.dataset.loading==="false"');assert meta()['chain']==[5,6]
  assert not errors,errors
  print('PASS real touch HOLD: 1.2s rearmed input window, [1,1,1,4] cycles, one-item selection, overwrite, 128 cap, physical hold, immediate PLAY confirmation, reload')
  b.close()
finally:server.shutdown();server.server_close()
