from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  for w,h in [(240,282),(390,844)]:
   page=b.new_page(viewport={'width':w,'height':h});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui12.html');page.wait_for_function('document.body.dataset.loading==="false" && document.querySelectorAll("#tapeHead [data-part]").length===6')
   # Mouth width equals the original .388 glove stroke after nested SVG scaling.
   widths=page.evaluate("""()=>{const m=document.querySelector('#tapeHead [data-part="mouth"]'),g=document.querySelector('#tapeLeft').parentElement;return [+m.getAttribute('stroke-width')*m.getScreenCTM().a,.388*g.getScreenCTM().a];}""")
   assert abs(widths[0]-widths[1])<.02,widths
   assert page.locator('#tapeHead [data-part="eyes"] path').evaluate_all('es=>es.every(e=>e.getAttribute("fill")==="#000")')
   page.screenshot(path=str(root/f't/mascot-ui12-{w}.png'))
   # Actual transport generates independent, nonzero facial transforms.
   page.locator('[data-act="play"]').click();seen=set()
   for i in range(90):
    changes=page.evaluate("""()=>{const p=n=>document.querySelector('#tapeHead [data-part="'+n+'"]').getAttribute('transform')||'';return [(!p('eyes')||p('eyes').includes('scale(1 1)')),(!p('ear-left')||p('ear-left')==='rotate(0 428 504)'),(!p('nose')||p('nose')==='translate(0 0)')];}""")
    for n,neutral in zip(['blink','ears','sniff'],changes):
     if not neutral:seen.add(n)
    if len(seen)==3:break
    page.wait_for_timeout(100)
   assert seen=={'blink','ears','sniff'},seen
   page.locator('[data-act="play"]').click()
   assert page.locator('#tapeHead [data-part][transform]').count()==0
   page.wait_for_timeout(500);assert page.locator('#tapeHead [data-part][transform]').count()==0
   page.locator('[data-act="play"]').click();page.evaluate('window.dispatchEvent(new Event("blur"))');assert page.locator('#tapeHead [data-part][transform]').count()==0
   assert not errors,errors
   print('PASS',w,'matching mouth/glove stroke, black eyes, random blink/ears/sniff, stop and blur cleanup')
   page.close()
  page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.goto(f'http://127.0.0.1:{server.server_port}/flowers-20261120-ui12.html');page.wait_for_function('document.body.dataset.loading==="false" && !!document.querySelector("#tapeHead [data-part]")');page.locator('[data-act="play"]').click();page.wait_for_timeout(500);assert page.locator('#tapeHead [data-part][transform]').count()==0
  print('PASS reduced-motion preference');b.close()
finally:server.shutdown();server.server_close()
