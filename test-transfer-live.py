"""Synthetic real stereo MediaStream -> actual AudioWorklet -> CRC decoder, 48 kHz."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  page=browser.new_page(viewport={'width':240,'height':282})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'index.html');page.wait_for_timeout(1000)
  page.evaluate('''async()=>{
    const bytes=await (await fetch('t/official-backup-tests/tiny-transfer-48000.wav')).arrayBuffer();
    const view=new DataView(bytes),n=(bytes.byteLength-44)/4;
    window.testChannels=[new Float32Array(n),new Float32Array(n)];
    for(let i=0;i<n;i++)for(let c=0;c<2;c++)testChannels[c][i]=view.getInt16(44+4*i+2*c,true)/32768;
    window.testMode='valid';window.testClipping=false;
    navigator.mediaDevices.getUserMedia=async constraints=>{
      window.testConstraints=constraints;
      const c=new AudioContext({sampleRate:constraints.audio.sampleRate.ideal});await c.resume();
      const dest=c.createMediaStreamDestination();dest.channelCount=2;dest.channelInterpretation='discrete';
      const track=dest.stream.getAudioTracks()[0];
      track.getSettings=()=>({channelCount:testMode==='mono'?1:2,sampleRate:c.sampleRate,echoCancellation:false,noiseSuppression:false,autoGainControl:false});
      const buffer=c.createBuffer(2,testChannels[0].length,48000);
      for(let ch=0;ch<2;ch++)buffer.copyToChannel(testMode==='silent'?new Float32Array(n):testMode==='clip'?new Float32Array(n).fill(1):testChannels[ch],ch);
      const source=c.createBufferSource();source.buffer=buffer;source.connect(dest);source.start(c.currentTime+.5);
      window.testInputContext=c;window.testInputTrack=track;return dest.stream;
    };
    window.testStates=[];window.testBars=[];window.testIn=false;
    new MutationObserver(()=>{
      testStates.push(document.body.dataset.transfer);
      if(document.querySelector('#lcdIn').dataset.active==='true')testIn=true;
      if(document.body.dataset.transfer==='receiving')testBars.push(document.querySelectorAll('#lcdMeter rect[data-active=true]').length);
    }).observe(document.body,{attributes:true,subtree:true,attributeFilter:['data-transfer','data-active']});
  }''')
  page.evaluate('PO33Transfer.open("receive")');page.locator('#transferRecord').click()
  page.wait_for_function('["success","error"].includes(document.body.dataset.transfer)',timeout=30000)
  assert page.evaluate('document.body.dataset.transfer')=='success',page.locator('#transferHint').text_content()
  assert page.evaluate('testIn && testStates.includes("receiving") && testStates.includes("decoding")')
  assert page.evaluate('testBars.some(n=>n>0 && n<32)')
  assert page.locator('#lcdNumber').get_attribute('data-value')=='End'
  assert page.locator('.pad.sampled').count()==1
  assert page.evaluate('testConstraints.audio.echoCancellation===false && testConstraints.audio.noiseSuppression===false && testConstraints.audio.autoGainControl===false')
  page.screenshot(path=str(root/'t/official-backup-tests/transfer-live-end-preview.png'))
  page.wait_for_timeout(2700)
  page.evaluate('testInputContext.close();testMode="mono";PO33Transfer.open("receive")')
  page.locator('#transferRecord').click();page.wait_for_function('document.body.dataset.transfer==="error"')
  assert page.locator('#lcdNumber').get_attribute('data-value')=='err'
  assert page.locator('.pad.sampled').count()==1
  await_closed=page.evaluate('testInputContext.close()')
  # No input for 60 seconds must report err without replacing the project.
  page.locator('#transferClose').click();page.clock.install()
  page.evaluate('testMode="silent";PO33Transfer.open("receive")');page.locator('#transferRecord').click()
  page.wait_for_timeout(200);page.clock.fast_forward(61000)
  page.wait_for_function('document.body.dataset.transfer==="error"')
  assert '60 seconds' in page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==1
  page.evaluate('testInputContext.close()');page.locator('#transferClose').click()
  page.evaluate('testMode="clip";PO33Transfer.open("receive")');page.locator('#transferRecord').click()
  page.wait_for_function('document.body.dataset.transfer==="error"',timeout=10000)
  assert 'overloaded' in page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==1
  page.evaluate('testInputContext.close()')
  page.locator('#transferClose').click()
  page.evaluate('testMode="valid";PO33Transfer.open("receive")');page.locator('#transferRecord').click()
  page.wait_for_timeout(200);page.evaluate('testInputTrack.dispatchEvent(new Event("ended"))')
  page.wait_for_function('document.body.dataset.transfer==="error"')
  assert 'disconnected' in page.locator('#transferHint').text_content()
  assert page.locator('.pad.sampled').count()==1
  page.evaluate('testInputContext.close()')
  page.locator('#transferUndo').click();page.wait_for_timeout(200)
  assert not page.evaluate('PO33Transfer.hasSession')
  assert page.locator('.pad.sampled').count()==8
  page.reload();page.wait_for_timeout(1000)
  assert not page.evaluate('PO33Transfer.hasSession')
  assert page.locator('.pad.sampled').count()==8
  assert not errors,errors
  print('PASS actual 48 kHz stereo MediaStream/AudioWorklet receive -> silence stop -> carrier/CRC -> restore; real meter/IN, rcv/End/32 squares; mono, 60-second timeout, overload and disconnect err preserve prior project; undo and reload restore original factory. Synthetic browser loopback only, not physical USB acceptance.')
  browser.close()
finally:server.shutdown();server.server_close()
