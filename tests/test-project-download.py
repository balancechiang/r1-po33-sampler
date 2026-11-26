import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
"""Scan one URL QR, download compressed native frame, validate and adopt."""
import sys,gzip
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
  page=b.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
  page.add_script_tag(path=str(root/'vendor/qrcodejs/qrcode.min.js'))
  page.evaluate('''url=>{navigator.mediaDevices.getUserMedia=async()=>{const holder=document.createElement('div'),canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;new QRCode(holder,{text:url,width:420,height:420,correctLevel:QRCode.CorrectLevel.L});const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,480,480);ctx.drawImage(holder.querySelector('canvas'),30,30);window.qrStream=canvas.captureStream(6);return qrStream;};PO33Transfer.open('receive');}''',sys.argv[1])
  page.locator('#transferScan').click()
  page.wait_for_function('["success","error"].includes(document.body.dataset.transfer)',timeout=90000)
  assert page.evaluate('document.body.dataset.transfer')=='success',page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==16
  assert '10 unavailable slices' in page.locator('#transferHint').text_content()
  assert page.evaluate('qrStream.getTracks().every(t=>t.readyState==="ended")')
  page.wait_for_timeout(2700)
  bad='https://invalid.example/bad.po33.gz'
  page.route(bad,lambda r:r.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/octet-stream'},body=gzip.compress(b'not a native frame')))
  page.evaluate("PO33Transfer.open('receive')")
  page.locator('#transferScan').click()
  page.locator('#transferQRURL').fill(bad);page.locator('#transferQR button[type=submit]').click()
  page.wait_for_function('document.body.dataset.transfer==="error"')
  assert page.locator('.pad.sampled').count()==16
  assert not errors,errors
  print('PASS URL QR camera -> HTTPS/CORS compressed download -> gzip -> native CRC -> Escalate 16 slots; original 10 unresolved slices retained; camera stopped. Physical R1 unverified.')
  b.close()
finally:server.shutdown();server.server_close()
