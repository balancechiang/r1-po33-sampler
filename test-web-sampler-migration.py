"""Rename/reset migration: remove owned legacy data, retain unrelated/new data."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  base=f'http://127.0.0.1:{server.server_port}/'
  page.goto(base+'demo/qr-test/index.html')
  page.evaluate('''async()=>{
   const old='po33.install.flowers-20261120.';localStorage.setItem(old+'po33.meta','old-test-project');localStorage.setItem(old+'po33.asset-scope','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');localStorage.setItem('po33.meta','older-test-project');localStorage.setItem('unrelated-project','keep');localStorage.setItem('po33.micGainDb','18');
   for(const name of ['po33-sample-assets-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','po33-hardware-project-flowers-20261120','unrelated-app-db'])await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>{r.result.close();resolve();};r.onerror=reject;});
  }''')
  def instrument(route):
   response=route.fetch();code=response.text().rsplit('})();',1)[0]+"window.migrationSnapshot=snapshotProject;window.migrationEdit=()=>{params.bpm=147;patternChain=[4,2,4];flushPersist();};})();";route.fulfill(response=response,body=code)
  page.route('**/app.js?*',instrument)
  page.add_init_script("window.creationStorage={plain:{getItem:k=>Promise.resolve(localStorage.getItem(k)),setItem:(k,v)=>Promise.resolve(localStorage.setItem(k,v)),removeItem:k=>Promise.resolve(localStorage.removeItem(k))}};")
  page.goto(base+'creation.html');page.wait_for_function('document.body.dataset.loading==="false"')
  assert page.title()=='Web Sampler';assert page.locator('html').get_attribute('data-po33-install')=='web-sampler-20261126'
  snapshot=page.evaluate('migrationSnapshot()');assert snapshot['bpm']==132 and snapshot['chain']==list(range(1,9))
  result=page.evaluate('''async()=>({old:localStorage.getItem('po33.install.flowers-20261120.po33.meta'),plain:localStorage.getItem('po33.meta'),other:localStorage.getItem('unrelated-project'),dbs:(await indexedDB.databases()).map(d=>d.name),marker:localStorage.getItem('web-sampler.cleanup.20261126')})''')
  assert result['old'] is None and result['plain'] is None and result['other']=='keep' and result['marker']=='done',result
  assert 'unrelated-app-db' in result['dbs'] and 'po33-sample-assets-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' not in result['dbs'] and 'po33-hardware-project-flowers-20261120' not in result['dbs'],result
  page.evaluate('migrationEdit()');page.wait_for_timeout(1200);page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
  snapshot=page.evaluate('migrationSnapshot()');assert snapshot['bpm']==147 and snapshot['chain']==[4,2,4],snapshot['bpm']
  assert not errors,errors
  for name in ['README.md','README.zh-CN.md','README.ja.md','README.ko.md']:
   text=(root/name).read_text(encoding='utf-8');assert '# Web Sampler' in text and 'Teenage Engineering' in text[:1500]
  descriptor=json.loads((root/'install/creation.json').read_text());assert descriptor['title']=='Web Sampler' and '/web-sampler/creation.html' in descriptor['url']
  manifest=json.loads((root/'manifest.webmanifest').read_text());assert manifest['name']==manifest['short_name']=='Web Sampler'
  print('PASS Web Sampler title/installation/manifest/four-language notices; clean factory on migration; old sampler KV/DB removed; unrelated data preserved; subsequent user edits retained')
  browser.close()
finally:server.shutdown();server.server_close()
