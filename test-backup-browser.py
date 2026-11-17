from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import io, math, struct, wave
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
raw=io.BytesIO()
with wave.open(raw,'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(44100)
    out.writeframes(b''.join(struct.pack('<hh',int(10000*math.sin(2*math.pi*700*i/44100)),int(18000*math.sin(2*math.pi*1300*i/44100))) for i in range(11025)))
fixture=raw.getvalue()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
        page=browser.new_page(viewport={'width':900,'height':850},accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'backup.html')
        page.locator('#file').set_input_files({'name':'backup.wav','mimeType':'audio/wav','buffer':fixture})
        page.wait_for_function('!document.querySelector("#play").disabled')
        with page.expect_download() as download:page.locator('#save').click()
        assert Path(download.value.path()).read_bytes()==fixture
        page.locator('#play').click()
        page.wait_for_function('document.querySelector("#status").textContent.startsWith("Playback finished")')
        assert page.locator('#status').get_attribute('data-error')=='false'
        page.locator('#devices').click()
        page.wait_for_function('document.querySelector("#status").textContent.startsWith("Devices refreshed")')
        assert page.locator('#input option').count()>1
        # Fake browser mono input must fail closed instead of being duplicated.
        page.evaluate('''()=>{const original=MediaStreamTrack.prototype.getSettings;
          MediaStreamTrack.prototype.getSettings=function(){return {...original.call(this),channelCount:1};};}''')
        page.locator('#record').click()
        page.wait_for_function('document.querySelector("#status").dataset.error==="true"')
        assert not page.locator('#record').is_disabled()
        # Simulate a compliant interface while feeding a real stereo Web Audio
        # source through the actual AudioWorklet (not the microphone hardware).
        capture=browser.new_page(viewport={'width':900,'height':850},accept_downloads=True)
        capture.on('pageerror',lambda e:errors.append(str(e)))
        capture.add_init_script('''
          const settings=MediaStreamTrack.prototype.getSettings;
          MediaStreamTrack.prototype.getSettings=function(){return {...settings.call(this),channelCount:2,sampleRate:44100,echoCancellation:false,noiseSuppression:false,autoGainControl:false};};
          AudioContext.prototype.createMediaStreamSource=function(){
            const b=this.createBuffer(2,44100,44100);
            for(let c=0;c<2;c++){let d=b.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(c?.5:.25)*Math.sin(2*Math.PI*(c?1300:700)*i/44100);}
            const s=this.createBufferSource();s.buffer=b;s.loop=true;s.start();return s;
          };
        ''')
        capture.goto(url+'backup.html');capture.locator('#record').click()
        capture.wait_for_function('document.querySelector("#status").textContent.startsWith("Recording raw")')
        capture.wait_for_timeout(500);capture.locator('#stop').click()
        capture.wait_for_function('!document.querySelector("#save").disabled')
        with capture.expect_download() as saved:capture.locator('#save').click()
        with wave.open(str(saved.value.path()),'rb') as w:
            assert (w.getnchannels(),w.getframerate(),w.getsampwidth())==(2,44100,2)
            data=w.readframes(w.getnframes());assert len(data)>44100*.2*4
            pairs=list(struct.iter_unpack('<hh',data))
            left=max(abs(l) for l,r in pairs);right=max(abs(r) for l,r in pairs)
            assert 8000<left<8300 and 16200<right<16500,(left,right)
        # Sampler combination now opens the integrated transfer state machine.
        panel=browser.new_page(viewport={'width':240,'height':282});panel.goto(url+'index.html');panel.wait_for_timeout(500)
        panel.keyboard.down('Shift')
        panel.locator('[data-act="write"]').click(force=True);panel.locator('[data-act="sound"]').click(force=True)
        panel.locator('[data-act="play"]').click(force=True)
        assert panel.locator('#transferControls').is_visible()
        assert panel.locator('#lcdNumber').get_attribute('data-value')=='Snd'
        panel.locator('#transferClose').click()
        panel.keyboard.up('Shift')
        assert not errors,errors
        page.screenshot(path=str(root/'backup-preview.png'),full_page=True)
        print('PASS: localhost AudioWorklet stereo replay, byte-identical WAV download, device enumeration, incompatible input rejection; simulated stereo interface capture through real worklet preserves channel amplitudes and PCM format; sampler combo opens integrated transfer controls. No JS errors. No physical hardware acceptance tested.')
        browser.close()
finally:server.shutdown();server.server_close()
