"""Exercise chained factory arrangement, real panel WAV export, protocol checks and re-import."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import subprocess,sys,base64,wave,struct,numpy as np
root=Path.cwd();output=Path(sys.argv[1]).resolve()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.musicOut=null;window.musicStarts=[];const connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;AudioNode.prototype.connect=function(to,...a){if(this instanceof GainNode && to instanceof AudioDestinationNode && !musicOut)musicOut=this;return connect.call(this,to,...a);};AudioBufferSourceNode.prototype.start=function(...a){musicStarts.push({id:this.buffer?._po33id,args:a,rate:this.playbackRate.value});return start.apply(this,a);};")
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(1100)
  def down(act,i=1):page.locator(act).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def combo(act):
   down('[data-act="write"]');down('[data-act="sound"]',2);down('[data-act="'+act+'"]',3);up(3);up(2);up()
  meta=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
  assert meta['bpm']==132 and meta['chain']==list(range(1,9))
  assert abs(meta['swing']-4/18)<1e-8
  assert page.evaluate('PO33_FACTORY.patterns.every((p,i)=>JSON.stringify(JSON.parse(atob(localStorage.getItem("po33.pat"+(i+1)))))===JSON.stringify(p.lanes))')
  assert meta['extras'][0]['steps']['1:0']['length']==2
  # Tap the actual frontend output with an AudioWorklet; this is listening audio,
  # separate from the stereo modem backup generated below.
  worklet=root/'t/flowers/capture-worklet.js';worklet.parent.mkdir(parents=True,exist_ok=True)
  worklet.write_text("class Capture extends AudioWorkletProcessor{constructor(){super();this.left=0;this.chunks=[];this.n=0;this.port.onmessage=e=>{this.left=Math.round(e.data.seconds*sampleRate);};}process(inputs,outputs){const ch=inputs[0]?.[0];if(ch&&this.left>0){const n=Math.min(ch.length,this.left),copy=ch.slice(0,n);this.chunks.push(copy);this.n+=n;this.left-=n;if(!this.left){const pcm=new Float32Array(this.n);let at=0;for(const a of this.chunks){pcm.set(a,at);at+=a.length;}this.port.postMessage({pcm,rate:sampleRate},[pcm.buffer]);this.chunks=[];}}return true;}}registerProcessor('flowers-capture',Capture);",encoding='utf-8')
  page.mouse.click(2,2)
  page.evaluate("""async()=>{const c=musicOut.context;await c.resume();await c.audioWorklet.addModule('./t/flowers/capture-worklet.js');const node=new AudioWorkletNode(c,'flowers-capture');musicOut.connect(node);const silent=c.createGain();silent.gain.value=0;node.connect(silent);silent.connect(c.destination);window.recordingDone=new Promise(resolve=>node.port.onmessage=e=>resolve(e.data));node.port.postMessage({seconds:14.9});}""")
  down('[data-act="play"]');up()
  captured=page.evaluate("""async()=>{const {pcm,rate}=await recordingDone;const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return {rate,pcm:btoa(binary)};}""")
  down('[data-act="play"]');up()
  pcm=np.frombuffer(base64.b64decode(captured['pcm']),dtype='<f4');assert np.isfinite(pcm).all();peak=float(abs(pcm).max());assert .02<peak<1,peak
  first=np.flatnonzero(abs(pcm)>.002)[0];pcm=pcm[first:first+14*captured['rate']];assert len(pcm)==14*captured['rate'];pcm=pcm*.88/peak
  preview=output.with_name('Flowers-synth-14s-preview.wav')
  with wave.open(str(preview),'wb') as w:w.setparams((1,2,captured['rate'],len(pcm),'NONE','NONE'));w.writeframes((np.clip(pcm,-1,1)*32767).astype('<i2').tobytes())
  assert page.evaluate('Array.from(new Set(musicStarts.map(s=>s.id))).sort().join(",")==="factory-2-1,factory-2-10,factory-2-2,factory-2-9"')
  page.screenshot(path=str(output.with_name('Flowers-page.png')))
  print('PASS 8-pattern chain and actual frontend AudioWorklet capture: 14 seconds, peak',round(peak,4),flush=True)
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
assert.equal(p.meta.bpm,132);assert.equal(p.meta.swingRaw,4);assert.deepEqual(p.patternChain,[1,2,3,4,5,6,7,8]);assert.equal(p.slots.filter(s=>s.audioBuffer?.length).length,8);assert.equal(p.patterns.length,16);
assert.equal(p.validation.complete,true);assert.equal(p.validation.checksumErrors,0);assert.equal(p.validation.unresolvedAudioRanges,0);
for(let i=0;i<f.patterns.length;i++)for(let slot=0;slot<16;slot++)for(let step=0;step<16;step++)assert.equal(readCell(p.patterns[i].raw,step+1,slot+1)?.key??null,f.patterns[i].lanes[slot][step]<0?null:f.patterns[i].lanes[slot][step]+1);
assert.deepEqual(encodePackets(serializeState(p.raw.state)),p.raw.frameBytes.subarray(4096));
const again=decodePO33Backup(encodePO33Backup(p));assert.deepEqual(again.raw.frameBytes,p.raw.frameBytes);
console.log(JSON.stringify({bytes:bytes.length,bpm:p.meta.bpm,swingRaw:p.meta.swingRaw,patternNotes:p.patterns.map(p=>p.steps.reduce((n,s)=>n+s.triggers.length,0)),validation:p.validation}));
"""
  subprocess.run(['node','--expose-gc','--input-type=module','-e',check,str(output)],cwd=root,check=True)
  page.wait_for_timeout(2800);combo('rec');page.locator('#transferFileInput').set_input_files(str(output))
  page.wait_for_function('document.body.dataset.transfer==="success"',timeout=90000)
  assert page.locator('#lcdNumber').get_attribute('data-value')=='End';assert page.evaluate('PO33Transfer.hasSession');assert page.locator('.pad.sampled').count()==8
  page.wait_for_timeout(2800);page.evaluate('musicStarts=[]')
  down('[data-act="play"]');up();page.wait_for_timeout(1100);down('[data-act="play"]');up()
  # Imported pools lack the factory tag: locate the drum starts by slice-3 and slice-5 offsets.
  pair=page.evaluate('(()=>{const a=musicStarts.find(s=>Math.abs(s.args[1]-.72)<.001),b=musicStarts.find(s=>Math.abs(s.args[1]-1.2)<.001);return a&&b?[a.args[0],b.args[0]]:null;})()')
  assert pair and abs(pair[1]-pair[0]-(7+4/18)*60/132/4)<.002,pair
  assert not errors,errors
  browser.close();print('PASS actual 8-pattern factory chain -> stereo backup WAV -> complete checksum/16-pattern/8-slot validation -> exact frame re-encode -> actual page restore End.')
finally:server.shutdown();server.server_close()
