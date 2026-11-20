"""Exercise UKG preset selection, real panel WAV export, protocol checks and re-import."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import subprocess,sys
root=Path.cwd();output=Path(sys.argv[1]).resolve()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(1100)
  def down(act,i=1):page.locator(act).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def combo(act):
   down('[data-act="write"]');down('[data-act="sound"]',2);down('[data-act="'+act+'"]',3);up(3);up(2);up()
  down('[data-act="pattern"]');down('[data-pad="4"]',2);up(2);up();page.wait_for_timeout(500)
  assert page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).bpm')==134
  assert page.evaluate('JSON.stringify(JSON.parse(atob(localStorage.getItem("po33.pat4"))))===JSON.stringify(PO33_FACTORY.patterns[3].lanes)')
  assert page.evaluate('PO33_FACTORY.patterns[3].style')=='UK Garage / 2-step'
  combo('play');page.wait_for_function('document.body.dataset.transfer==="ready"',timeout=90000)
  with page.expect_download() as download:page.locator('#transferSave').click()
  download.value.save_as(str(output))
  check=r"""
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {decodePO33Backup,encodePO33Backup} from './src/codec/po33Codec.ts';
import {readCell} from './decoder/vendor/so-sample/pattern.ts';
import {serializeState} from './decoder/vendor/so-sample/state.ts';
import {encodePackets} from './decoder/vendor/so-sample/packets.ts';
const bytes=fs.readFileSync(process.argv[1]),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),44100);assert.equal(view.getUint16(34,true),16);
const p=decodePO33Backup(bytes),c={window:{}};vm.runInNewContext(fs.readFileSync('presets.js','utf8'),c);const f=c.window.PO33_FACTORY;
assert.equal(p.meta.bpm,134);assert.equal(p.slots.filter(s=>s.audioBuffer?.length).length,8);assert.equal(p.patterns.length,16);
assert.equal(p.validation.complete,true);assert.equal(p.validation.checksumErrors,0);assert.equal(p.validation.unresolvedAudioRanges,0);
for(let i=0;i<4;i++)for(let slot=0;slot<16;slot++)for(let step=0;step<16;step++)assert.equal(readCell(p.patterns[i].raw,step+1,slot+1)?.key??null,f.patterns[i].lanes[slot][step]<0?null:f.patterns[i].lanes[slot][step]+1);
assert.deepEqual(encodePackets(serializeState(p.raw.state)),p.raw.frameBytes.subarray(4096));
const again=decodePO33Backup(encodePO33Backup(p));assert.deepEqual(again.raw.frameBytes,p.raw.frameBytes);
console.log(JSON.stringify({bytes:bytes.length,bpm:p.meta.bpm,swingRaw:p.meta.swingRaw,pattern4Notes:p.patterns[3].steps.reduce((n,s)=>n+s.triggers.length,0),validation:p.validation}));
"""
  subprocess.run(['node','--expose-gc','--input-type=module','-e',check,str(output)],cwd=root,check=True)
  page.wait_for_timeout(2800);combo('rec');page.locator('#transferFileInput').set_input_files(str(output))
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=90000)
  assert page.locator('#lcdNumber').get_attribute('data-value')=='End';assert page.evaluate('PO33Transfer.hasSession');assert page.locator('.pad.sampled').count()==8
  assert not errors,errors
  browser.close();print('PASS actual Pattern 4 selection -> stereo backup WAV -> complete checksum/16-pattern/8-slot validation -> exact frame re-encode -> actual page restore End.')
finally:server.shutdown();server.server_close()
