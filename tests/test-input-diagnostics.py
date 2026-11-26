import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
"""Opaque R1 constraint errors become actionable; diagnostic mono is never recorded."""
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
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(800)
  page.evaluate('''()=>{
    window.probeStops=0;window.probeChannels=1;window.failedConstraint='channelCount';window.requests=[];
    navigator.mediaDevices.getUserMedia=async c=>{
      requests.push(c);
      if(c.audio.channelCount.exact===2)throw {name:'OverconstrainedError',constraint:failedConstraint,message:''};
      return {getAudioTracks:()=>[{label:'USB Audio test',getSettings:()=>({channelCount:probeChannels,sampleRate:48000,echoCancellation:false,noiseSuppression:false,autoGainControl:false}),getCapabilities:()=>({channelCount:{min:1,max:probeChannels}})}],getTracks:()=>[{stop:()=>probeStops++}]};
    };
    PO33Transfer.open('receive');
  }''')
  page.locator('#transferRecord').click();page.wait_for_function('document.body.dataset.transfer==="error"')
  assert 'channelCount' in page.locator('#transferHint').text_content()
  assert '[object' not in page.locator('#transferHint').text_content()
  assert page.locator('#lcdNumber').get_attribute('data-value')=='err'
  assert not page.evaluate('PO33Transfer.hasSession')
  page.locator('#transferDeviceToggle').click()
  page.locator('#transferCheckInput').click();page.wait_for_function('window.probeStops===1')
  report=page.locator('#transferInputReport').text_content()
  assert 'channels=1' in report and '48000' in report and 'Only mono' in report,report
  assert page.evaluate('requests.at(-1).audio.channelCount.ideal===2 && !requests.at(-1).audio.channelCount.exact')
  assert page.locator('.pad.sampled').count()==8
  page.evaluate('probeChannels=2');page.locator('#transferCheckInput').click();page.wait_for_function('window.probeStops===2')
  assert 'Stereo reported' in page.locator('#transferInputReport').text_content()
  page.evaluate('failedConstraint="deviceId"');page.locator('#transferRecord').click();page.wait_for_function('document.body.dataset.transfer==="error"')
  assert 'reselect USB input' in page.locator('#transferHint').text_content()
  assert not errors,errors
  print('PASS empty-message OverconstrainedError exposes channelCount/deviceId; ideal-stereo diagnostic reports actual mono/stereo and 48 kHz/capabilities, stops probes, leaves project unchanged; real backup request remains exact stereo.')
  browser.close()
finally:server.shutdown();server.server_close()
