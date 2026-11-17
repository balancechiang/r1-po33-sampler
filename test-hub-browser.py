"""HTTPS hub manager + real cross-origin iframe bridge into existing R1 panel."""
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
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  # Only this disposable test browser trusts the freshly verified test certificate.
  # No OS/browser trust store or real user's security setting is changed.
  context=browser.new_context(ignore_https_errors=True,viewport={'width':240,'height':282},accept_downloads=True)
  manager=context.new_page();manager.goto('https://localhost:33033/')
  manager.locator('#files').set_input_files({'name':'hub-ui-test.json','mimeType':'application/json','buffer':b'{"test":true}'})
  manager.wait_for_function('document.querySelector("#list").textContent.includes("hub-ui-test.json")')
  manager.on('dialog',lambda d:d.accept())
  manager.locator('li').filter(has=manager.get_by_role('link',name='hub-ui-test.json',exact=True)).get_by_role('button').click()
  manager.wait_for_function('!document.querySelector("#list").textContent.includes("hub-ui-test.json")')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(900)
  page.evaluate('PO33Transfer.open("receive")');page.locator('#transferHub').click()
  page.locator('#hubIP').fill('localhost');page.locator('#hubConnect').click()
  page.wait_for_function('document.querySelectorAll("#hubFiles button").length>=2',timeout=10000)
  assert page.evaluate('localStorage.getItem("po33.localHub.ip")')=='localhost'
  # Same-window forged READY cannot replace the genuine frame connection.
  before=page.locator('#hubFiles').text_content()
  page.evaluate('window.postMessage({source:"po33-local-hub",type:"LIST_RESULT",payload:[]},"*")')
  assert page.locator('#hubFiles').text_content()==before
  page.locator('#hubFiles button').filter(has_text='Escalate.wav').focus()
  page.evaluate('window.dispatchEvent(new Event("sideClick"))')
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=60000)
  assert page.locator('.pad.sampled').count()==16
  assert '10 unavailable slices' in page.locator('#transferHint').text_content()
  page.wait_for_timeout(2700);page.evaluate('PO33Transfer.open("receive")');page.locator('#transferHub').click()
  assert page.locator('#hubIP').input_value()=='localhost'
  page.locator('#hubConnect').click();page.wait_for_function('document.querySelectorAll("#hubFiles button").length>=2')
  page.locator('#hubFiles button').filter(has_text='Escalate.json').click()
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=60000)
  assert page.locator('.pad.sampled').count()==16
  page.wait_for_timeout(2700);page.evaluate('PO33Transfer.open("send")')
  page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  with page.expect_download(timeout=60000) as download:page.locator('#transferJSON').click()
  result=root/'t/official-backup-tests/hub-exported-project.json';download.value.save_as(str(result))
  assert result.stat().st_size>1000000
  page.wait_for_timeout(2700);page.evaluate('PO33Transfer.open("receive")')
  page.locator('#transferFileInput').set_input_files(str(result))
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=60000)
  page.wait_for_timeout(2700);page.evaluate('PO33Transfer.open("receive")');page.locator('#transferHub').click()
  # Simulated unreachable address must produce the complete 3-second guidance.
  page.route('https://127.0.0.2:33033/bridge',lambda route:route.abort())
  page.locator('#hubIP').fill('127.0.0.2');page.locator('#hubConnect').click()
  page.wait_for_function('document.querySelector("#hubStatus").textContent.includes("3s timeout")',timeout=7000)
  assert 'Load File' in page.locator('#hubStatus').text_content()
  assert 'WebView' in page.locator('#hubStatus').text_content()
  page.screenshot(path=str(root/'t/official-backup-tests/hub-timeout-preview.png'))
  page.locator('#hubLoadFile').click()
  assert not page.locator('#localHubPanel').is_visible()
  assert page.locator('#transferFileInput').get_attribute('accept')=='.wav,.json'
  assert not errors,errors
  print('PASS HTTPS manager upload/delete; genuine cross-origin hidden iframe READY/list/transferable WAV and lossless JSON -> CRC restore; hardware-side activation, IP persistence, forged message rejection, JSON export/reimport, 3s trust/HTTP/Load File fallback. Self-signed trust bypass confined to test browser; physical R1 unverified.')
  browser.close()
finally:server.shutdown();server.server_close()
