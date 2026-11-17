"""Offline regression against separately downloaded official Transfer fixtures.
Audio files are kept under ignored t/official-backup-tests, never committed.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import hashlib, wave, json
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
fixtures=root/'t'/'official-backup-tests'
expected={
    'escalate':(24,268.3333333333333,'6847d14da8a7c7438e84d0f16278988e1db7666c4d8f9942c1ad562efab166e5'),
    'frekvens':(16,206.0,'f6c62965940f68b9b22882c954be64e0dfc7e705904fe8d65b92a6de52dafa1f'),
    '16operators':(16,250.6095238095238,'c167b73d0d2afd1f7cf4261e2e4424bbd623d930394b4ae2851360d61e664110'),
}
for name,(_,_,digest) in expected.items():
    path=fixtures/(name+'.wav')
    if not path.exists():raise SystemExit(f'Missing {path}. Download the corresponding official Transfer file; see OFFICIAL-BACKUP-TESTS.md.')
    with path.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==digest,name

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
        context=browser.new_context(viewport={'width':900,'height':850},accept_downloads=True)
        sampler=context.new_page();sampler.goto(url+'index.html');sampler.wait_for_timeout(900)
        before=sampler.evaluate('JSON.stringify(Object.entries(localStorage).sort())')
        errors=[];results=[]
        for name,(bits,seconds,digest) in expected.items():
            path=fixtures/(name+'.wav')
            with wave.open(str(path),'rb') as w:
                assert (w.getnchannels(),w.getframerate(),w.getsampwidth()*8)==(2,44100,bits)
                assert abs(w.getnframes()/44100-seconds)<.00001
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url+'backup.html');page.locator('#file').set_input_files(str(path))
            page.wait_for_function('document.querySelector("#status").textContent!=="Ready. Hardware acceptance has not been verified."',timeout=30000)
            status=page.locator('#status').text_content()
            if bits==24:
                assert page.locator('#status').get_attribute('data-error')=='true',status
                assert '16-bit PCM' in status and page.locator('#play').is_disabled(),status
                result='rejected: 24-bit input unsupported'
            else:
                assert page.locator('#status').get_attribute('data-error')=='false',status
                assert not page.locator('#play').is_disabled()
                assert f'{seconds:.2f} seconds' in page.locator('#fileInfo').text_content()
                with page.expect_download() as saved:page.locator('#save').click()
                with Path(saved.value.path()).open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==digest
                result='raw WAV loaded; saved file hash identical'
            assert page.evaluate('JSON.stringify(Object.entries(localStorage).sort())')==before
            results.append({'pack':name,'bits':bits,'seconds':seconds,'rawResult':result,'editableProjectImported':False})
            page.close()
        assert not errors,errors
        assert sampler.locator('.pad.sampled').count()==8
        (fixtures/'browser-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        for r in results:print(json.dumps(r))
        print('PASS: all three original official Transfer files tested; supported raw downloads are byte-identical, 24-bit fails explicitly, sampler project unchanged. No playback or hardware transmission performed. Editable project decoding is not implemented.')
        browser.close()
finally:server.shutdown();server.server_close()
