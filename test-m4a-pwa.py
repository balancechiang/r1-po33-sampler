from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import tempfile,subprocess,base64,struct,math,json,sys,os
import imageio_ffmpeg
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with tempfile.TemporaryDirectory() as d:
  d=Path(d);n=44100;values=[(int(12000*math.sin(i*.1)),int(8000*math.cos(i*.07))) for i in range(n)];data=b''.join(struct.pack('<hh',*v) for v in values);wav=b'RIFF'+struct.pack('<I',36+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,2,44100,176400,4,16)+b'data'+struct.pack('<I',len(data))+data;(d/'source.wav').write_bytes(wav)
  subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(d/'source.wav'),'-c:a','alac',str(d/'lossless.m4a')],check=True)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(os.environ.get('PO33_TEST_URL') or f'http://127.0.0.1:{server.server_port}/'+os.environ.get('PO33_TEST_ENTRY','flowers-20261120-ui21.html'));page.wait_for_function('document.body.dataset.loading==="false"')
   result=page.evaluate('''async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;const p=await PO33BackupAudio.decode(b);return {rate:p.sampleRate,left:Array.from(p.left),right:Array.from(p.right)};}''',base64.b64encode((d/'lossless.m4a').read_bytes()).decode())
   assert result['rate']==44100 and len(result['left'])==n,(result['rate'],len(result['left']))
   assert all(abs(result['left'][i]-v[0]/32768)<1e-7 and abs(result['right'][i]-v[1]/32768)<1e-7 for i,v in enumerate(values))
   print('PASS real ALAC M4A decoded sample-for-sample, independent stereo, original 44100 Hz')
   values24=[(v[0]*256+(i%251),v[1]*256-(i%239)) for i,v in enumerate(values)]
   (d/'source24.raw').write_bytes(b''.join((v & 0xffffff).to_bytes(3,'little') for pair in values24 for v in pair))
   subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-f','s24le','-ar','48000','-ac','2','-i',str(d/'source24.raw'),'-c:a','alac',str(d/'lossless24.m4a')],check=True)
   result=page.evaluate('''async b64=>{const p=await PO33BackupAudio.decode(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);return {rate:p.sampleRate,left:Array.from(p.left),right:Array.from(p.right)};}''',base64.b64encode((d/'lossless24.m4a').read_bytes()).decode())
   assert result['rate']==48000 and len(result['left'])==n
   assert all(abs(result['left'][i]-v[0]/8388608)<1e-8 and abs(result['right'][i]-v[1]/8388608)<1e-8 for i,v in enumerate(values24)), '24-bit PCM mismatch'
   print('PASS 24-bit ALAC, nonzero low bits preserved, independent stereo at 48000 Hz')
   assert page.evaluate('typeof PO33BackupAudio.decode==="function"')
   assert page.locator('link[rel=apple-touch-icon]').get_attribute('href').endswith('apple-touch-icon-ui21.png')
   manifest=page.evaluate('''async()=>await (await fetch(document.querySelector('link[rel=manifest]').href)).json()''');assert manifest['display']=='standalone' and len(manifest['icons'])==2
   from PIL import Image
   for name,size in [('apple-touch-icon.png',180),('pwa-icon-192.png',192),('pwa-icon-512.png',512)]:
    image=Image.open(root/name).convert('RGB');assert image.size==(size,size);assert image.getpixel((0,0))==(153,153,153)
   page.locator('[data-act=write]').dispatch_event('pointerdown',{'pointerId':1,'bubbles':True});page.locator('[data-act=sound]').dispatch_event('pointerdown',{'pointerId':2,'bubbles':True});page.locator('[data-act=rec]').dispatch_event('pointerdown',{'pointerId':3,'bubbles':True})
   assert '.m4a' in page.locator('#transferFileInput').get_attribute('accept')
   assert not errors,errors;print('PASS PWA manifest, opaque gray icons, Apple touch icon and M4A file picker')
   fixture=root/'t/official-backup-tests/tiny-transfer-48000.wav'
   if fixture.exists():
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(fixture),'-c:a','alac',str(d/'backup.m4a')],check=True)
    page.locator('#transferFileInput').set_input_files(str(d/'backup.m4a'))
    page.wait_for_function('document.body.dataset.transfer==="success" || document.body.dataset.transfer==="error"',timeout=60000)
    assert page.locator('body').get_attribute('data-transfer')=='success',page.locator('#transferHint').text_content()
    assert page.evaluate('PO33Transfer.hasSession')
    print('PASS valid stereo backup WAV -> ALAC M4A -> file picker -> hardware checksum -> restored project')
   if len(sys.argv)>1:
    page.reload();page.wait_for_function('document.body.dataset.loading==="false"')
    for act,i in [('write',1),('sound',2),('rec',3)]:page.locator('[data-act='+act+']').dispatch_event('pointerdown',{'pointerId':i,'bubbles':True})
    page.locator('#transferFileInput').set_input_files(sys.argv[1]);page.wait_for_function('document.body.dataset.transfer==="success" || document.body.dataset.transfer==="error"',timeout=120000)
    assert page.locator('body').get_attribute('data-transfer')=='success',page.locator('#transferHint').text_content()
    print('PASS supplied private iOS backup restored and checksum-validated')
   browser.close()
finally:server.shutdown();server.server_close()
