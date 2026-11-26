"""Creation install QR must carry the SDK JSON object, not its download URL."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True);page=browser.new_page()
  page.goto(f'http://127.0.0.1:{server.server_port}/demo/qr-test/index.html');page.add_script_tag(url='/vendor/jsqr/jsQR.js')
  images=list((root/'install').glob('creation*-qr.png'))+[root/'install/web-sampler-install-qr.png']
  for image in images:
   expected=root/'install/creation.json' if image.name=='web-sampler-install-qr.png' else image.with_name(image.name.replace('-qr.png','.json'))
   for size in ([None,300] if image.name=='web-sampler-install-qr.png' else [None]):
    text=page.evaluate('''async data=>{const img=new Image();img.src='/'+data.path;await img.decode();const c=document.createElement('canvas');c.width=data.size||img.width;c.height=data.size||img.height;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(img,0,0,c.width,c.height);return jsQR(x.getImageData(0,0,c.width,c.height).data,c.width,c.height)?.data;}''',{'path':image.relative_to(root).as_posix(),'size':size})
    actual=json.loads(text);assert actual==json.loads(expected.read_text()),image.name
    assert set(actual)=={'title','url','description','iconUrl','themeColor'}
    assert actual['title']=='Web Sampler' and actual['url'].startswith('https://balancechiang.github.io/web-sampler/')
  print('PASS all installation QR images encode complete SDK creation JSON; fresh install code also decodes at 300px')
  browser.close()
finally:server.shutdown();server.server_close()
