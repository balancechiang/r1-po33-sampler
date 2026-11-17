"""Share one explicitly selected WAV and its QR on a specific LAN interface."""
import argparse,hashlib,html,json,shutil
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit,quote
parser=argparse.ArgumentParser()
parser.add_argument('--bind',required=True)
parser.add_argument('--port',type=int,default=8766)
parser.add_argument('--file',type=Path,default=Path.home()/'Documents/Rabbit R1 PO-33/qr-import-tests/Escalate.wav')
args=parser.parse_args();wav=args.file.resolve(strict=True)
if not wav.is_file() or wav.suffix.lower()!='.wav':raise SystemExit('Choose a WAV file')
url=f'http://{args.bind}:{args.port}/Escalate.wav'
qr=wav.parent/'Escalate-lan-wav-qr.png'
class Handler(BaseHTTPRequestHandler):
 def send_common_headers(self,status,length,kind):
  self.send_response(status)
  self.send_header('Content-Length',str(length));self.send_header('Content-Type',kind)
  self.send_header('Access-Control-Allow-Origin','*')
  self.send_header('Access-Control-Allow-Methods','GET, HEAD, OPTIONS')
  self.send_header('Access-Control-Allow-Headers','Range')
  self.send_header('Access-Control-Allow-Private-Network','true')
  self.send_header('Cache-Control','no-store')
 def do_OPTIONS(self):self.send_common_headers(204,0,'text/plain');self.end_headers()
 def do_HEAD(self):self.reply(False)
 def do_GET(self):self.reply(True)
 def reply(self,body):
  path=urlsplit(self.path).path
  file=wav if path=='/Escalate.wav' else qr if path=='/Escalate-qr.png' and qr.exists() else None
  if file:
   self.send_common_headers(200,file.stat().st_size,'audio/wav' if file==wav else 'image/png')
   if file==wav:self.send_header('Content-Disposition','attachment; filename="Escalate.wav"')
   self.end_headers()
   if body:
    try:
     with file.open('rb') as source:shutil.copyfileobj(source,self.wfile)
    except ConnectionError:pass
  elif path=='/':
   page=f'''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Escalate LAN download test</title><style>body{{font:16px/1.5 Arial;max-width:650px;margin:auto;padding:20px}}img{{max-width:100%;width:420px}}</style><h1>Escalate LAN download test</h1><p>电脑与 R1 保持同一 Wi-Fi，电脑需保持开机。</p><img src="/Escalate-qr.png" alt="WAV LAN URL QR"><p><a href="{html.escape(url)}" download>下载 Escalate.wav</a></p><p>{html.escape(url)}</p><p>在 HTTPS Creation 的接收菜单中选择 Scan QR。若 WebView 禁止访问 HTTP 局域网，需改用文件导入或可信 HTTPS 地址。</p><p>此 HTTP 页面仅用于查看二维码和测试下载，不提供摄像头扫码。</p>'''.encode()
   self.send_common_headers(200,len(page),'text/html; charset=utf-8');self.end_headers()
   if body:self.wfile.write(page)
  else:self.send_common_headers(404,0,'text/plain');self.end_headers()
print(json.dumps({'bind':args.bind,'port':args.port,'wav':str(wav),'url':url,'bytes':wav.stat().st_size}),flush=True)
ThreadingHTTPServer((args.bind,args.port),Handler).serve_forever()
