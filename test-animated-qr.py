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
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
  page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/demo/animated-qr/')
  page.evaluate('()=>{const original=PO33QRTransfer.encode;PO33QRTransfer.encode=async x=>{window.nativeFrame=x;return window.packets=await original(x)}}')
  page.locator('#sample').click();page.wait_for_function('window.packets?.length>0',timeout=60000)
  page.locator('#pause').click()
  count=page.evaluate('packets.length');assert count>1
  page.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/vendor/jsqr/jsQR.js')
  assert page.evaluate('''()=>{const c=document.querySelector('#qr canvas'),ctx=c.getContext('2d');return JSON.parse(jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height).data).q}''')=='PO33QR1'
  result=page.evaluate('''async()=>{const r=PO33QRTransfer.receiver();await r.add(packets[0]);await r.add(packets[0]);let last;for(const p of [...packets].reverse()){const x=await r.add(p);if(x.buffer)last=x;}const out=new Uint8Array(last.buffer);if(out.length!==nativeFrame.length||out.some((v,i)=>v!==nativeFrame[i]))throw Error('Frame mismatch');return await new Promise((resolve,reject)=>{const w=new Worker('../../transfer-worker.js',{type:'module'});w.onmessage=e=>{if(e.data.type==='decoded'){w.terminate();resolve({bpm:e.data.project.meta.bpm})}else if(e.data.type==='error')reject(Error(e.data.message))};w.postMessage({command:'decode',filename:'camera.po33frame',wav:last.buffer},[last.buffer]);});}''')
  rejected=page.evaluate('''async()=>{const r=PO33QRTransfer.receiver();try{for(const p of packets){const m=JSON.parse(p);m.id='0'.repeat(64);await r.add(JSON.stringify(m));}}catch(e){return e.message.includes('checksum')}return false;}''')
  assert result['bpm']==108
  assert rejected
  camera=b.new_page(viewport={'width':240,'height':282});camera.goto(f'http://127.0.0.1:{server.server_port}/index.html')
  camera.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/vendor/qrcodejs/qrcode.min.js')
  camera.evaluate("window.testPackets="+__import__('json').dumps(page.evaluate('packets')))
  camera.evaluate('''()=>{navigator.mediaDevices.getUserMedia=async()=>{const holder=document.createElement('div'),canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;const ctx=canvas.getContext('2d');let i=0;function draw(){holder.replaceChildren();new QRCode(holder,{text:testPackets[i++%testPackets.length],width:420,height:420,correctLevel:QRCode.CorrectLevel.L});ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.drawImage(holder.querySelector('canvas'),30,30);}draw();window.frameTimer=setInterval(draw,450);const stream=canvas.captureStream(12);window.testStream=stream;return stream;};PO33Transfer.open('receive');}''')
  camera.locator('#transferScan').click()
  camera.wait_for_function('["success","error"].includes(document.body.dataset.transfer)',timeout=60000)
  assert camera.evaluate('document.body.dataset.transfer')=='success',camera.locator('#transferHint').text_content()
  assert camera.locator('.pad.sampled').count()==1
  assert camera.evaluate('testStream.getTracks().every(t=>t.readyState==="ended")')
  camera.evaluate('clearInterval(frameTimer)')
  assert not errors,errors
  print(f'PASS {count} QR packets; displayed QR decoded; duplicate/reverse reassembly exact; native frame codec import; corrupt SHA rejected; live synthetic camera import and track shutdown. Result: {result}. Physical camera unverified.')
  b.close()
finally:server.shutdown();server.server_close()


