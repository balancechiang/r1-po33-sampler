"""Camera frames -> real jsQR worker -> direct WAV download -> CRC restore."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import sys
root=Path(__file__).parent
sys.path.insert(0,str(root/'t/qr-tools'))
import qrcode
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path=='/invalid.wav':
   self.send_response(200);self.send_header('Content-Type','audio/wav');self.end_headers();self.wfile.write(b'not a backup');return
  try:super().do_GET()
  except ConnectionError:pass # expected when the browser aborts a blocked cross-origin body
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
other=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
for s in [server,other]:Thread(target=s.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
qrcode.make(base+'demo/qr-test/po33-backup.wav').save(root/'t/qr-camera-test.png')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'index.html');page.wait_for_timeout(800)
  page.evaluate('''()=>{
    window.cameraMode='qr';window.cameraStops=0;window.peak=0;window.states=[];
    const read=AnalyserNode.prototype.getFloatTimeDomainData;
    AnalyserNode.prototype.getFloatTimeDomainData=function(a){read.call(this,a);for(const x of a)peak=Math.max(peak,Math.abs(x));};
    new MutationObserver(()=>states.push(document.body.dataset.transfer)).observe(document.body,{attributes:true,attributeFilter:['data-transfer']});
    navigator.mediaDevices.getUserMedia=async c=>{
      if(c.audio!==false)throw Error('QR must not request microphone audio');
      if(cameraMode==='denied')throw new DOMException('Camera permission denied','NotAllowedError');
      const image=new Image();image.src='t/qr-camera-test.png';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,480,480);if(cameraMode!=='blank')context.drawImage(image,16,16,448,448);
      const stream=canvas.captureStream(6);window.cameraStream=stream;
      stream.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{cameraStops++;stop();};});return stream;
    };
    PO33Transfer.open('receive');
  }''')
  page.locator('#transferScan').click()
  page.wait_for_function('["success","error"].includes(document.body.dataset.transfer)',timeout=30000)
  assert page.evaluate('document.body.dataset.transfer')=='success',page.locator('#transferHint').text_content()
  assert page.evaluate('cameraStops>0 && cameraStream.getTracks().every(t=>t.readyState==="ended")')
  assert page.evaluate('["scanning","downloading","decoding","success"].every(s=>states.includes(s))')
  assert page.locator('#lcdNumber').get_attribute('data-value')=='End'
  assert page.locator('#lcdMeter rect[data-active=true]').count()==38
  assert page.locator('.pad.sampled').count()==1
  page.screenshot(path=str(root/'t/official-backup-tests/qr-import-end-preview.png'))
  page.wait_for_timeout(2800)
  page.locator('[data-act="play"]').dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True})
  page.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:1,bubbles:true}))');page.wait_for_timeout(800)
  assert page.evaluate('peak>0')
  # Permission denial keeps manual URL import usable; invalid downloads do not restore.
  page.evaluate('cameraMode="denied";PO33Transfer.open("receive")');page.locator('#transferScan').click()
  page.wait_for_function('document.querySelector("#transferQRStatus").textContent.includes("NotAllowedError")')
  page.locator('#transferQRURL').fill(base+'invalid.wav');page.locator('#transferQR button[type=submit]').click()
  page.wait_for_function('document.body.dataset.transfer==="error"')
  assert 'not RIFF/WAV' in page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==1
  page.locator('#transferClose').click()
  page.evaluate('PO33Transfer.open("receive")');page.locator('#transferScan').click()
  page.locator('#transferQRURL').fill(f'http://127.0.0.1:{other.server_port}/demo/qr-test/po33-backup.wav')
  page.locator('#transferQR button[type=submit]').click();page.wait_for_function('document.body.dataset.transfer==="error"')
  assert 'CORS' in page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==1
  page.locator('#transferClose').click()
  page.evaluate('cameraMode="blank";PO33Transfer.open("receive")');page.locator('#transferScan').click()
  page.wait_for_function('document.querySelector("#transferQRStatus").textContent.includes("Aim at")')
  page.screenshot(path=str(root/'t/official-backup-tests/qr-camera-preview.png'))
  page.locator('#transferQRCancel').click();page.wait_for_function('document.body.dataset.transfer==="waiting"')
  page.wait_for_timeout(200);assert not page.locator('#transferQR').is_visible()
  assert page.evaluate('cameraStream.getTracks().every(t=>t.readyState==="ended")')
  assert not errors,errors
  print('PASS real camera MediaStream frames -> local jsQR worker -> WAV URL -> download/CRC/one-slot restore and audible 4-note pattern; camera released, denied-camera URL fallback, invalid WAV/CORS preserve project, cancel works; 38 squares/End. No physical R1 camera validation.')
  browser.close()
finally:
 for s in [server,other]:s.shutdown();s.server_close()
