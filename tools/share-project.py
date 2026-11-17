"""Read-only single-project endpoint for an explicitly chosen HTTPS tunnel origin."""
import argparse,json,secrets,shutil
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import quote,urlsplit
parser=argparse.ArgumentParser()
parser.add_argument('--file',required=True,type=Path)
parser.add_argument('--port',type=int,default=33035)
args=parser.parse_args();project=args.file.resolve(strict=True)
if not project.is_file():raise SystemExit('Choose one regular project file')
route='/'+secrets.token_urlsafe(24)+'/'+quote(project.name)
class Handler(BaseHTTPRequestHandler):
 def do_OPTIONS(self):
  self.send_response(204);self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');self.end_headers()
 def do_HEAD(self):self.reply(False)
 def do_GET(self):self.reply(True)
 def reply(self,body):
  if urlsplit(self.path).path!=route:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(project.stat().st_size));self.send_header('Access-Control-Allow-Origin','*');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers()
  if body:
   try:
    with project.open('rb') as f:shutil.copyfileobj(f,self.wfile)
   except ConnectionError:pass
print(json.dumps({'origin':f'http://127.0.0.1:{args.port}','path':route,'bytes':project.stat().st_size}),flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
