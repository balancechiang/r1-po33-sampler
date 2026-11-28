"""Animated project QR sender UI, cadence controls and receive protocol in-browser."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'t/qr-tools'))
import qrcode

root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(800)
  assert page.evaluate('typeof PO33QRTransfer.encode==="function" && typeof QRCode==="function"')
  page.evaluate('PO33Transfer.open("send")')
  page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  page.evaluate('''()=>{const encode=PO33QRTransfer.encode;window.qrEncodedFrames=null;window.qrEncodingStats=null;PO33QRTransfer.encode=async(frame,options)=>{const result=await encode(frame,options);window.qrEncodedFrames=result.frames;window.qrEncodingStats={rawBytes:result.rawBytes,compressedBytes:result.compressedBytes,chunkBytes:result.chunkBytes};return result;};}''')
  page.locator('#transferAnimatedQR').click()
  page.wait_for_function('document.querySelector("#transferAnimatedQRDialog").open && document.querySelector("#animatedQRCode canvas, #animatedQRCode img")')
  assert page.locator('#transferAnimatedQRDialog').is_visible()
  bounds=page.locator('#animatedQRCode').bounding_box()
  assert bounds['width']>=150 and bounds['height']>=150 and bounds['width']<=240,(bounds)
  controls=page.locator('.animatedQRControls').bounding_box()
  assert bounds['y']+bounds['height']<=controls['y']+1,(bounds,controls)
  assert page.locator('#animatedQRPause').is_visible() and page.locator('#animatedQRStop').is_visible()
  first=page.locator('#animatedQRStatus').text_content()
  assert 'Frame 1/' in first and 'loop 1' in first,first
  page.locator('#animatedQRPause').click();paused=page.locator('#animatedQRStatus').text_content();page.wait_for_timeout(700)
  assert page.locator('#animatedQRStatus').text_content()==paused
  page.locator('#animatedQRSpeed').select_option('120');page.locator('#animatedQRPause').click();page.wait_for_timeout(200)
  assert page.locator('#animatedQRStatus').text_content()!=paused
  page.wait_for_function('qrEncodedFrames && qrEncodedFrames.length>1',timeout=30000)
  decoded=page.evaluate('''async()=>{
    const receiver=PO33QRTransfer.receiver();let result;
    for(const packet of qrEncodedFrames)result=await receiver.add(packet);
    if(!result?.complete)throw Error(`QR sender did not show every frame (${result?.received}/${result?.total})`);
    const worker=new Worker(PO33_RESOURCE('./transfer-worker.js'),{type:'module'});
    const project=await new Promise((resolve,reject)=>{worker.onerror=e=>reject(Error(`worker failed: ${e.message} ${e.filename}:${e.lineno}`));worker.onmessage=({data})=>{if(data.type==='decoded'){worker.terminate();resolve(data.project);}else if(data.type==='error'){worker.terminate();reject(Error(data.message||data.type));}};worker.postMessage({command:'decode',filename:result.filename,wav:result.buffer});});
    return {packets:qrEncodedFrames.length,rawBytes:qrEncodingStats.rawBytes,compressedBytes:qrEncodingStats.compressedBytes,chunkBytes:qrEncodingStats.chunkBytes,slots:project.slots.length,patterns:project.patterns.length,bpm:project.meta.bpm};
  }''')
  assert decoded['packets']>1 and decoded['packets']<1000 and decoded['slots']==16 and decoded['patterns']==16 and decoded['bpm']==132,decoded
  page.screenshot(path=str(root/'t/animated-qr-preview.png'))
  page.locator('#animatedQRStop').click()
  assert page.locator('#transferAnimatedQRDialog').count()==1 and not page.locator('#transferAnimatedQRDialog').is_visible()
  assert page.locator('#lcdNumber').get_attribute('data-value')=='stp'
  assert page.locator('#transferAnimatedQR').is_enabled()
  packets=page.evaluate('''async()=>PO33QRTransfer.encode(crypto.getRandomValues(new Uint8Array(1500)),{chunkBytes:600}).then(x=>x.frames)''')
  assert len(packets)==3,len(packets)
  for i,packet in enumerate(packets):qrcode.make(packet).save(root/f't/animated-rx-{i}.png')
  mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=3)
  mobile.on('pageerror',lambda e:errors.append(str(e)))
  mobile.goto(f'http://127.0.0.1:{server.server_port}/index.html');mobile.wait_for_timeout(500)
  mobile.evaluate('''async count=>{
    window.qrCameraStops=0;
    const images=await Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=`t/animated-rx-${i}.png`;})));
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;
    const ctx=canvas.getContext('2d');let index=0;
    const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.drawImage(images[index],0,0,480,480);index=(index+1)%images.length;};draw();window.qrCameraTimer=setInterval(draw,1100);
    const stream=canvas.captureStream(10);stream.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{qrCameraStops++;stop();};});window.qrCameraStream=stream;
    navigator.mediaDevices.getUserMedia=async c=>{if(c.audio!==false)throw Error('camera must not request audio');return stream;};
  }''',len(packets))
  mobile.evaluate('PO33Transfer.open("receive")');mobile.locator('#transferScan').click()
  mobile.wait_for_function('document.querySelector("#transferQRStatus").textContent.includes("Receiving 1/3")',timeout=30000)
  assert 0.25<=mobile.locator('#transferQRProgress').evaluate('(e)=>e.value')<=0.4
  mobile.wait_for_function('document.body.dataset.transfer==="error"',timeout=30000)
  assert 'CRC' in mobile.locator('#transferHint').text_content() or 'frame' in mobile.locator('#transferHint').text_content().lower(),mobile.locator('#transferHint').text_content()
  assert mobile.locator('#transferQRStatus').text_content().startswith('All 3 ')
  assert mobile.evaluate('qrCameraStops>0 && qrCameraStream.getTracks().every(t=>t.readyState==="ended")')
  mobile.evaluate('clearInterval(qrCameraTimer)')
  assert not errors,errors
  print(f"PASS 240×282 sender roundtrip: {decoded['compressedBytes']} compressed bytes in {decoded['packets']} × {decoded['chunkBytes']}-byte frames; phone-sized mobile camera gets visible 1/3 progress, reassembles/checksums, and native CRC rejects invalid test frame; camera released; pause/resume/speed/stop and STP")
  mobile.close()
  browser.close()
finally:
 server.shutdown();server.server_close()
