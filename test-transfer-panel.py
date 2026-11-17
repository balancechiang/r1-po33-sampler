"""Actual panel combinations, CRC restore/send, display and checkpoint lifecycle."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'index.html');page.wait_for_timeout(1200)
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def combo(act):
   down('[data-act="write"]',1);down('[data-act="sound"]',2);down(f'[data-act="{act}"]',3);up(3);up(2);up(1)
  # First verify that the current factory project is a real hardware backup, not beat audio.
  # One-finger touch latch: hold WRITE, release, hold SOUND, release, tap PLAY.
  for selector,i in [('[data-act="write"]',1),('[data-act="sound"]',2)]:
   page.locator(selector).dispatch_event('pointerdown',{'pointerId':i,'pointerType':'touch','button':0,'bubbles':True})
   page.wait_for_timeout(550);up(i)
  assert page.locator('.transfer-latched').count()==2
  down('[data-act="play"]',3);up(3)
  page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  assert page.locator('.transfer-latched').count()==0
  assert page.locator('#lcdNumber').get_attribute('data-value')=='Snd'
  with page.expect_download() as saved:page.locator('#transferSave').click()
  path=root/'t/official-backup-tests/panel-factory-backup.wav';saved.value.save_as(str(path))
  page.wait_for_timeout(2800)
  combo('rec');assert page.locator('#lcdNumber').get_attribute('data-value')=='rcv'
  assert page.locator('#lcdMeter rect').count()==32
  page.screenshot(path=str(root/'t/official-backup-tests/transfer-wait-preview.png'))
  # A corrupt input cannot replace the current project or display End.
  page.locator('#transferFileInput').set_input_files({'name':'bad.wav','mimeType':'audio/wav','buffer':b'not a backup'})
  page.wait_for_function('document.body.dataset.transfer==="error"')
  assert page.locator('#lcdNumber').get_attribute('data-value')=='err'
  assert not page.evaluate('PO33Transfer.hasSession')
  page.locator('#transferClose').click()
  combo('rec')
  page.locator('#transferFileInput').set_input_files(str(root/'t/official-backup-tests/escalate.wav'))
  page.locator('#transferClose').click();page.wait_for_timeout(3500)
  assert not page.evaluate('PO33Transfer.hasSession')
  assert page.locator('.pad.sampled').count()==8
  page.wait_for_timeout(350)
  normal_storage=page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')
  combo('rec')
  page.locator('#transferFileInput').set_input_files(str(root/'t/official-backup-tests/escalate.wav'))
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=60000)
  assert page.locator('#lcdNumber').get_attribute('data-value')=='End'
  assert page.locator('#lcdMeter rect[data-active=true]').count()==32
  assert page.locator('.pad[data-led-level=bright]').count()==16
  assert page.locator('.pad.sampled').count()==16
  assert page.evaluate('PO33Transfer.hasSession')
  assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==normal_storage
  page.screenshot(path=str(root/'t/official-backup-tests/transfer-end-preview.png'))
  page.wait_for_timeout(2800)
  # Re-export the actual restored native source, including unresolved ranges.
  combo('play');page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  with page.expect_download() as saved:page.locator('#transferSave').click()
  saved.value.save_as(str(root/'t/official-backup-tests/panel-escalate-backup.wav'))
  page.wait_for_timeout(2800);page.reload();page.wait_for_timeout(1800)
  assert page.evaluate('PO33Transfer.hasSession')
  assert page.locator('.pad.sampled').count()==16
  combo('play');page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  page.locator('#transferSend').click();page.wait_for_timeout(700)
  assert page.locator('#lcdOut').get_attribute('data-active')=='true'
  assert page.locator('#lcdIn').get_attribute('data-active')=='false'
  assert page.locator('#lcdNumber').get_attribute('data-value')=='Snd'
  page.screenshot(path=str(root/'t/official-backup-tests/transfer-send-preview.png'))
  page.locator('#transferStop').click();page.wait_for_timeout(200)
  assert page.locator('#lcdOut').get_attribute('data-active')=='false'
  # Import cancellation is not success and leaves the current restored project intact.
  combo('rec');page.locator('#transferClose').click()
  assert page.evaluate('PO33Transfer.hasSession')
  assert page.locator('.pad.sampled').count()==16
  # Five-second factory reset also clears the separately persisted hardware project.
  down('#factoryReset');page.wait_for_timeout(6500);up()
  page.wait_for_function('window.PO33Transfer && !PO33Transfer.hasSession && document.querySelectorAll(".pad.sampled").length===8',timeout=10000)
  assert not errors,errors
  print('PASS panel WRITE+SOUND+PLAY/RECORD; generated and native backup downloads; malformed input err/no restore; rcv/End/Snd, 32 squares, success LEDs, stereo OUT and cancel; native checkpoint reload, original storage unchanged; no page errors.',flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
