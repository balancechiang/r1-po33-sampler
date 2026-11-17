"""Real Escalate worker -> original panel -> audible output, isolated storage."""
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
        context=browser.new_context(viewport={'width':900,'height':1100})
        context.add_init_script('''
          window.__peak=0;window.__starts=0;window.__imports=[];
          const read=AnalyserNode.prototype.getFloatTimeDomainData;
          AnalyserNode.prototype.getFloatTimeDomainData=function(a){read.call(this,a);for(const x of a)window.__peak=Math.max(window.__peak,Math.abs(x));};
          const start=AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start=function(...args){window.__starts++;return start.apply(this,args);};
          window.addEventListener('message',e=>{if(e.data.type==='po33-preview-loaded')window.__imports.push(e.data.summary)});
        ''')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url+'index.html');page.wait_for_timeout(800)
        page.evaluate('localStorage.setItem("test.keep","existing-project")')
        page.goto(url+'project-import.html')
        before=page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')
        page.locator('#projectFile').set_input_files(str(root/'t/official-backup-tests/escalate.wav'))
        page.wait_for_function('document.querySelector("#status").dataset.state==="loaded"',timeout=60000)
        assert page.evaluate('window.__imports[0]')=={'slots':16,'patterns':16,'notes':274,'bpm':120,'unavailableSlices':10}
        assert page.locator('#warnings li').count()>=10
        frame=page.frames[1]
        assert frame.locator('.pad.sampled').count()==16
        def down(sel,id=1):frame.locator(sel).dispatch_event('pointerdown',{'pointerId':id,'button':0,'bubbles':True})
        def up(id=1):frame.evaluate('id=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,bubbles:true}))',id)
        def select(kind,n):
            down(f'[data-act="{kind}"]',1);down(f'[data-pad="{n}"]',2);up(2);up(1)
        peaks=[]
        for n in range(1,17):
            select('pattern',n)
            frame.evaluate('window.__peak=0')
            down('[data-act="play"]');up();page.wait_for_timeout(2250)
            down('[data-act="play"]');up()
            peak=frame.evaluate('window.__peak');peaks.append(round(peak,5));assert peak>0,(n,peak)
        # Missing slot16 key7 remains silent; valid key1 still plays.
        select('sound',16);page.wait_for_timeout(500)
        starts=frame.evaluate('window.__starts');down('[data-pad="7"]');up()
        assert frame.evaluate('window.__starts')==starts
        down('[data-pad="1"]');up();assert frame.evaluate('window.__starts')>starts
        assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==before
        frame.locator('body').screenshot(path=str(root/'t/official-backup-tests/escalate-panel-preview.png'))
        page.screenshot(path=str(root/'t/official-backup-tests/escalate-import-preview.png'),full_page=True)
        page.reload();page.wait_for_timeout(500)
        assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==before
        assert not errors,errors
        print('PASS Escalate browser import: 16 slots, 16 patterns, 274 notes, 120 BPM; all 16 patterns produce measured audio:',peaks)
        print('PASS invalid slices silent, valid slice playable; saved project byte-identical after import, playback and reload; no page errors.')
        browser.close()
finally:server.shutdown();server.server_close()
