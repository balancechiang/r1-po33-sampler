from pathlib import Path
import atexit
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
atexit.register(server.server_close);atexit.register(server.shutdown)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    page=browser.new_page(viewport={'width':240,'height':282},device_scale_factor=3)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''window.sensorStarts=0;window.sensorStops=0;window.sensorCallback=null;
      window.creationSensors={accelerometer:{isAvailable:async()=>true,start(cb,options){window.sensorCallback=cb;window.sensorStarts++;},stop(){window.sensorStops++;window.sensorCallback=null;}}};''')
    page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(600);page.mouse.click(10,10)
    factory_bpm=page.evaluate('PO33_FACTORY.bpm || 120')
    def event(name):page.evaluate('(name)=>window.dispatchEvent(new Event(name))',name)
    def down(sel,id):page.locator(sel).dispatch_event('pointerdown',{'pointerId':id,'button':0,'bubbles':True})
    def up(id):page.evaluate('(id)=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,bubbles:true}))',id)
    def sampled(n):return 'sampled' in page.locator(f'[data-pad="{n}"]').get_attribute('class')
    def active(id):return page.locator('#'+id).get_attribute('data-active')=='true'
    def shake():
        # One physical burst, followed by quiet samples to re-arm the detector.
        page.evaluate('sensorCallback && sensorCallback({x:1,y:0,z:1})')
        for _ in range(7):
            page.wait_for_timeout(32);page.evaluate('sensorCallback && sensorCallback({x:0,y:0,z:1})')
    def group(n):
        for _ in range(n):shake()
        page.wait_for_timeout(650)
    assert not active('lcdIn') and not active('lcdOut')
    # Hardware wheel always controls tempo, even inside SOUND and after FX selection.
    down('[data-act="sound"]',1);event('scrollUp');assert page.locator('#lcdNumber').get_attribute('data-value')=='1';up(1)
    assert page.locator('#lcdNumber').get_attribute('data-value')==str(factory_bpm+1)
    down('[data-act="fx"]',1);up(1);event('scrollDown');assert page.locator('#lcdNumber').get_attribute('data-value')==str(factory_bpm)
    # Side long press plus screen pad records into an empty slot; duplicate click is suppressed.
    event('longPressStart');down('[data-pad="5"]',2);page.wait_for_timeout(1500)
    assert active('lcdIn') and not active('lcdOut')
    assert page.locator('#lcdRecord rect').get_attribute('fill')=='#222'  # WRITE indicator, not microphone recording
    event('longPressEnd');up(2);event('sideClick');page.wait_for_timeout(250)
    assert sampled(5)
    assert page.locator('#lcdRecord rect').get_attribute('fill')=='#222'
    page.wait_for_timeout(350);assert not active('lcdIn')
    # Discrete shakes while stopped must not start sensor capture or an effect.
    assert page.evaluate('sensorStarts')==0
    event('sideClick');page.wait_for_timeout(250)
    assert page.evaluate('sensorStarts')==1
    assert active('lcdOut') and not active('lcdIn')
    first=page.locator('#tapeLeft').get_attribute('transform');page.wait_for_timeout(100)
    assert page.locator('#tapeLeft').get_attribute('transform')!=first
    page.evaluate('sensorCallback({x:0,y:0,z:1})')
    group(1);assert page.locator('.fx-live').count()==0
    group(2);assert page.locator('.fx-live').count()==1
    fx1=page.locator('.fx-live').get_attribute('data-pad')
    page.wait_for_timeout(550);assert page.locator('.fx-live').get_attribute('data-pad')==fx1
    group(2);assert page.locator('.fx-live').count()==1
    assert page.locator('.fx-live').get_attribute('data-pad')!=fx1
    group(3);assert page.locator('.fx-live').count()==0
    group(4);assert page.locator('.fx-live').count()==0
    group(2);assert page.locator('.fx-live').count()==1
    event('sideClick');page.wait_for_timeout(300)
    assert page.locator('.fx-live').count()==0
    assert page.locator('#tapeLeft').get_attribute('transform') is None
    assert page.evaluate('sensorCallback') is None
    page.wait_for_timeout(1800) # OUT remains active while previously started voices decay.
    assert not active('lcdOut')
    # Blur stops sensors and latches; retry timer must not reopen them while unfocused.
    page.locator('[data-act="play"]').click();page.wait_for_timeout(100)
    starts=page.evaluate('sensorStarts');event('blur');page.wait_for_timeout(1100)
    assert page.evaluate('sensorStarts')==starts
    assert page.evaluate('sensorCallback') is None
    event('focus');page.wait_for_timeout(100);assert page.evaluate('sensorStarts')==starts+1
    page.screenshot(path=str(root/'r1-playing-preview.png'))
    assert not errors,errors
    print('PASS: idle/input/output indicators; wheel context independence; short-side playback and held-side recording; BPM mascot motion; 1/2/3/4 shake groups; different FX selection; hold persistence; cancellation; stop/blur/focus lifecycle. No JS errors.')
    browser.close()
