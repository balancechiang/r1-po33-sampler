import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
  for w,h in [(240,282),(390,844),(768,1024),(1024,1366),(1024,768)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('document.body.dataset.loading==="false"')
   before=page.locator('#samplerScreen').bounding_box();controls=page.locator('#samplerControls').bounding_box()
   wide=w>=900 and w>h
   panelWidth=page.locator('#instrument').evaluate('e=>parseFloat(e.style.width)')
   assert panelWidth<min(w,h) if wide else panelWidth==min(w,h),(w,h)
   for act,i in [('write',1),('sound',2),('rec',3)]:page.locator('[data-act='+act+']').dispatch_event('pointerdown',{'pointerId':i,'bubbles':True})
   for i in [3,2,1]:page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
   page.wait_for_timeout(220)
   assert page.locator('#samplerScreen').bounding_box()==before
   page.wait_for_function('Math.abs(new DOMMatrix(getComputedStyle(document.getElementById("transferControls")).transform).m42)<.01')
   sheet=page.locator('#transferControls').bounding_box()
   assert all(abs(sheet[k]-controls[k])<1 for k in ['x','y','width','height']),(sheet,controls)
   assert page.locator('#panel').evaluate('e=>getComputedStyle(e).visibility')=='hidden'
   if w in [240,768]:page.screenshot(path=str(root/('t/transfer-'+str(w)+'-preview.png')))
   page.locator('#transferHub').click();dialog=page.locator('#localHubPanel').bounding_box();assert all(abs(dialog[k]-controls[k])<1 for k in ['x','y','width','height'])
   page.locator('#hubClose').click()
   if w==390:
    page.locator('#transferScan').click();page.wait_for_timeout(100)
    oldWidth=page.locator('#instrument').evaluate('e=>e.style.width')
    page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(100)
    assert page.locator('#instrument').evaluate('e=>e.style.width')==oldWidth
    assert page.locator('#portraitStage').get_attribute('data-rotated')=='true'
    camera=page.locator('#transferQRVideo').bounding_box()
    assert camera['x']<=1 and camera['y']<=1 and camera['x']+camera['width']>=844-1 and camera['y']+camera['height']>=390-1
    assert page.evaluate('document.activeElement.id')=='transferQRCancel'
    form=page.locator('#transferQRForm').bounding_box();assert form['y']+form['height']>=390-1
    page.locator('#transferQRCancel').click();page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
   page.locator('#transferClose').click();page.wait_for_timeout(220)
   assert page.locator('#panel').evaluate('e=>getComputedStyle(e).visibility')=='visible'
   assert page.locator('#samplerScreen').bounding_box()==before
   for act,i in [('write',1),('sound',2),('play',3)]:page.locator('[data-act='+act+']').dispatch_event('pointerdown',{'pointerId':i,'bubbles':True})
   for i in [3,2,1]:page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
   page.wait_for_timeout(220)
   assert page.locator('#samplerScreen').bounding_box()==before
   assert page.locator('#transferSend').is_visible() and page.locator('#transferSave').is_visible()
   if w==240:
    page.locator('#transferPeerSend').click();page.wait_for_function('document.querySelector("#transferPeer")?.open===true',timeout=20000)
    pair=page.locator('#peerQR').bounding_box();assert pair['width']>=w*.8 and pair['width']==pair['height'],pair
    peer_dialog=page.locator('#transferPeer').bounding_box();assert peer_dialog['width']>=w-1 and peer_dialog['height']>=h-1,peer_dialog
    page.locator('#peerCancel').click();page.wait_for_function('!document.querySelector("#transferPeer")?.open')
   page.locator('#transferClose').click();page.wait_for_timeout(220)
   assert page.locator('#portraitStage').get_attribute('data-rotated')==str(w>h and not wide).lower()
   assert not errors,errors
   if w==768:page.screenshot(path=str(root/'t/ipad-layout-preview.png'))
   print('PASS keyboard sheet, stable LCD, nested hub, portrait layout',w,h);context.close()
  browser.close()
finally:server.shutdown();server.server_close()
