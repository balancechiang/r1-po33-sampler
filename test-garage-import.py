"""Scan the published project QR image, download the native frame and import it."""
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
url='https://balancechiang.github.io/web-sampler/demo/garage-16/garage-16.po33.gz'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];downloads=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   response=route.fetch();code=response.text().rsplit('})();',1)[0]+'window.garageSnapshot=snapshotProject;})();';route.fulfill(response=response,body=code)
  page.route('**/app.js?*',instrument)
  def download(route):
   downloads.append(route.request.url);route.fulfill(body=(root/'demo/garage-16/garage-16.po33.gz').read_bytes(),headers={'Content-Type':'application/gzip','Access-Control-Allow-Origin':'*'})
  page.route(url,download)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_function('document.body.dataset.loading==="false"')
  page.evaluate('''()=>{
   navigator.mediaDevices.getUserMedia=async constraints=>{
    if(constraints.audio!==false)throw Error('Scanner must not request microphone');
    const image=new Image();image.src='demo/garage-16/garage-16-import-qr.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,600,600);c.drawImage(image,20,20,560,560);window.garageCamera=canvas.captureStream(6);return garageCamera;
   };PO33Transfer.open('receive');
  }''')
  page.locator('#transferScan').click();page.wait_for_function('["success","error"].includes(document.body.dataset.transfer)',timeout=30000)
  assert page.evaluate('document.body.dataset.transfer')=='success',page.locator('#transferHint').text_content()
  assert downloads==[url],downloads
  state=page.evaluate('garageSnapshot()');assert state['bpm']==132 and state['chain']==list(range(1,17))
  signatures=[str(p['lanes']) for p in state['patterns']];assert len(set(signatures))==16
  assert sum(x is not None for x in state['slots'])==4
  assert sum(sum(n>=0 for n in lane) for p in state['patterns'] for lane in p['lanes'])==261
  for p in state['patterns']:assert p['lanes'][8][0]>=0 and p['lanes'][9][4]>=0 and p['lanes'][9][12]>=0
  assert page.evaluate('garageCamera.getTracks().every(t=>t.readyState==="ended")');assert not errors,errors
  print('PASS actual QR image -> jsQR -> HTTPS download -> gzip frame import: 132 BPM, full chain, 16 distinct patterns, 261 notes, original beat anchors, camera released')
  browser.close()
finally:server.shutdown();server.server_close()
