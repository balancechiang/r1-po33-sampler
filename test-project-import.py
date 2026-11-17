"""Real official WAV -> worker -> original panel -> audio, isolated storage."""
import argparse,json
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
parser=argparse.ArgumentParser()
parser.add_argument('--packs',nargs='+',default=['escalate','frekvens','16operators'],choices=['escalate','frekvens','16operators'])
packs=parser.parse_args().packs
expected={
    'escalate':{'slots':16,'patterns':16,'notes':274,'bpm':120,'unavailableSlices':10},
    'frekvens':{'slots':10,'patterns':16,'notes':300,'bpm':128,'unavailableSlices':0},
    '16operators':{'slots':16,'patterns':16,'notes':0,'bpm':120,'unavailableSlices':0}}
counts={
    'escalate':[15,16,13,20,22,17,19,14,12,22,18,15,16,14,22,19],
    'frekvens':[19,21,21,22,19,21,21,8,22,26,26,0,22,26,26,0],
    '16operators':[0]*16}
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
        frame=page.frames[1]
        def down(sel,id=1):frame.locator(sel).dispatch_event('pointerdown',{'pointerId':id,'button':0,'bubbles':True})
        def up(id=1):frame.evaluate('id=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,bubbles:true}))',id)
        def select(kind,n):
            down(f'[data-act="{kind}"]',1);down(f'[data-pad="{n}"]',2);up(2);up(1)
        results=[]
        for name in packs:
            previous_imports=page.evaluate('window.__imports.length')
            page.locator('#projectFile').set_input_files(str(root/f't/official-backup-tests/{name}.wav'))
            page.wait_for_function('n=>window.__imports.length>n',arg=previous_imports,timeout=60000)
            assert page.evaluate('window.__imports.at(-1)')==expected[name]
            assert frame.locator('.pad.sampled').count()==expected[name]['slots']
            peaks=[];starts_per_pattern=[]
            for n,notes in enumerate(counts[name],1):
                select('pattern',n)
                frame.evaluate('window.__peak=0');starts=frame.evaluate('window.__starts')
                down('[data-act="play"]');up()
                page.wait_for_timeout(60/expected[name]['bpm']*4000+250 if notes else 200)
                down('[data-act="play"]');up()
                peak=frame.evaluate('window.__peak');new_starts=frame.evaluate('window.__starts')-starts
                peaks.append(round(peak,5));starts_per_pattern.append(new_starts)
                if notes:assert peak>0 and new_starts>0,(name,n,peak,new_starts)
                else:assert new_starts==0,(name,n,new_starts)
            # Every decoded populated slot should allow at least one manual pad voice.
            populated=frame.locator('.pad.sampled').evaluate_all('es=>es.map(e=>+e.dataset.pad)')
            playable=[]
            for slot in populated:
                select('sound',slot);starts=frame.evaluate('window.__starts')
                for pad in range(1,17):down(f'[data-pad="{pad}"]');up()
                if frame.evaluate('window.__starts')>starts:playable.append(slot)
            assert playable==populated,(name,playable,populated)
            if name=='escalate':
                select('sound',16);starts=frame.evaluate('window.__starts')
                down('[data-pad="7"]');up();assert frame.evaluate('window.__starts')==starts
                down('[data-pad="1"]');up();assert frame.evaluate('window.__starts')>starts
            if name=='frekvens':
                empty=[i for i in range(1,17) if i not in populated]
                for slot in empty:
                    select('sound',slot);starts=frame.evaluate('window.__starts')
                    down('[data-pad="1"]');up();assert frame.evaluate('window.__starts')==starts
            assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==before
            page.screenshot(path=str(root/f't/official-backup-tests/{name}-import-preview.png'),full_page=True)
            results.append({'pack':name,**expected[name],'patternPeaks':peaks,'patternSourceStarts':starts_per_pattern,'manuallyPlayableSlots':playable,'storageUnchanged':True})
            print('PASS '+json.dumps(results[-1]),flush=True)
        page.reload();page.wait_for_timeout(500)
        assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==before
        assert not errors,errors
        (root/'t/official-backup-tests/project-import-browser-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        print('PASS selected packs: real worker imports, all sixteen patterns checked, all populated slots manually playable, empty patterns add no voices; storage unchanged after imports/playback/reload; no page errors.')
        browser.close()
finally:server.shutdown();server.server_close()
