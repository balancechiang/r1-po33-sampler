from pathlib import Path
import json,atexit
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
atexit.register(server.server_close);atexit.register(server.shutdown)
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        headless=True, args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    page = browser.new_page(viewport={'width': 240, 'height': 282})
    page.add_init_script('''
      if(!localStorage.getItem('hidden-test-seeded')) {
        const lanes=()=>Array.from({length:16},()=>Array(16).fill(-1));
        const a=lanes(),b=lanes();a[0][0]=2;b[8][0]=1;
        localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0})));
        localStorage.setItem('po33.pat1',btoa(JSON.stringify(a)));
        localStorage.setItem('po33.pat2',btoa(JSON.stringify(b)));
        localStorage.setItem('hidden-test-seeded','1');
      }
      window.starts=[];window.stops=[];
      const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.start=function(...args){
        window.lastSource=this;
        starts.push({args,buffer:this.buffer.duration,rate:this.playbackRate.value});
        return start.apply(this,args);
      };
      AudioBufferSourceNode.prototype.stop=function(...args){stops.push(args);this.testStopTimes=this.testStopTimes || [];this.testStopTimes.push(args[0]);return stop.apply(this,args);};
    ''')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url+'index.html')
    page.wait_for_timeout(600)
    page.mouse.click(10, 10)
    def down(sel, i=1):
        page.locator(sel).dispatch_event('pointerdown', {'pointerId': i, 'button': 0, 'bubbles': True})
    def up(i=1, cancel=False):
        page.evaluate('(a)=>window.dispatchEvent(new PointerEvent(a[1],{pointerId:a[0],bubbles:true}))', [i, 'pointercancel' if cancel else 'pointerup'])
    def tap(sel, i=1): down(sel,i); up(i)
    def pad(n): return f'[data-pad="{n}"]'
    def select(n): down('[data-act="sound"]'); tap(pad(n),2); up()
    def pattern(n): down('[data-act="pattern"]'); tap(pad(n),2); up()
    def wheel(knob, count=1, dy=-1):
        page.locator('#knob'+knob).evaluate('(e,a)=>{for(let i=0;i<a[0];i++)e.dispatchEvent(new WheelEvent("wheel",{deltaY:a[1],bubbles:true,cancelable:true}));}', [count,dy])
    def stored(key):
        page.wait_for_timeout(450)
        return page.evaluate('k=>JSON.parse(atob(localStorage.getItem(k)))',key)
    def meta(): return stored('po33.meta')
    def sampled(n): return 'sampled' in page.locator(pad(n)).get_attribute('class')
    def copy_to(n, slice_n=None, cancel=False):
        down('[data-act="sound"]',1);down('[data-act="write"]',2)
        tap(pad(n),3)
        if slice_n is not None: tap(pad(slice_n),3)
        up(2,cancel);up(1)

    # Existing steps remain intact during a hold; edits survive release/reload.
    tap('[data-act="write"]')
    down(pad(1));wheel('A');page.evaluate('window.dispatchEvent(new Event("scrollUp"))');wheel('B',3)
    assert page.locator('.step-edit').count()==1
    up()
    assert stored('po33.pat1')[0][0]==4
    assert meta()['extras'][0]['steps']['0:0']['length']==4
    assert meta()['bpm']==120
    assert page.locator('#knobA').evaluate('e=>parseFloat(e.style.getPropertyValue("--knob-angle"))')>0
    assert abs(page.evaluate('lastSource.testStopTimes.at(-1)-starts.at(-1).args[0]')-.53)<.005
    # Long press copies the edited step, then an empty step adopts its state.
    down(pad(1));page.wait_for_timeout(1050);up();tap(pad(2))
    assert stored('po33.pat1')[0][1]==4
    assert meta()['extras'][0]['steps']['0:1']['length']==4
    # A short tap deletes; cancellation preserves a step.
    tap(pad(2));assert stored('po33.pat1')[0][1]==-1
    down(pad(1));up(cancel=True);assert stored('po33.pat1')[0][0]==4
    select(9);pattern(2)
    for expected in [2,3,4,6,8,1,2]:
        down(pad(1));tap('#bpmMode',2);up()
        assert meta()['extras'][1]['steps']['8:0']['retrigs']==expected
    down(pad(1));wheel('A');up()
    assert stored('po33.pat2')[8][0]==2
    page.evaluate('starts=[]')
    tap('[data-act="play"]');page.wait_for_timeout(300);tap('[data-act="play"]')
    starts=page.evaluate('starts')
    assert len(starts)==2,starts
    assert abs(starts[1]['args'][0]-starts[0]['args'][0]-.0625)<.002,starts
    # Copy a cropped melodic sound into a slot without changing target tone.
    tap('[data-act="write"]');select(5);wheel('A',5);wheel('B',40,1)
    tap('[data-act="fx"]');wheel('A',3);wheel('B',4)
    tap('[data-act="fx"]');tap('[data-act="fx"]')
    select(1);tap('[data-act="fx"]');tap('[data-act="fx"]');wheel('A',10);wheel('B',20,1)
    before=page.locator('#mem').inner_text()
    down('[data-act="sound"]',1);down('[data-act="write"]',2);tap(pad(5),3)
    assert not sampled(5)
    up(2);up(1)
    assert sampled(5) and page.locator('#mem').inner_text()==before
    m=meta();assert abs(m['tweaks'][4]['pitch']-.5)<.00001 and m['tweaks'][4]['volume']==60
    assert m['tweaks'][4]['filter']==3 and m['tweaks'][4]['resonance']==4
    sound=stored('po33.slot5');assert sound['format']==4 and sound['base']['offset']>0
    # Whole melodic region -> evenly divided kit; replace just one slice.
    copy_to(13)
    kit=stored('po33.slot13');assert len(kit['slices'])==16
    assert abs(kit['slices'][0]['duration']*16-sound['base']['duration'])<.0001
    select(2);copy_to(13,4)
    changed=stored('po33.slot13')
    assert changed['slices'][0]==kit['slices'][0]
    assert changed['slices'][3]['asset']!=kit['slices'][3]['asset']
    # Empty source clears only the selected slice. Cancelled copy is inert.
    select(6);copy_to(13,4)
    assert stored('po33.slot13')['slices'][3] is None
    select(13);tap(pad(4));copy_to(8);assert not sampled(8)
    select(1);copy_to(6,cancel=True);assert not sampled(6)
    # Whole kits preserve slice views, and last-played slices can become melodic.
    select(13);copy_to(14)
    assert stored('po33.slot14')['slices'][3] is None
    tap(pad(1));copy_to(7)
    assert stored('po33.slot7')['base']['duration']<.2
    memory=page.locator('#mem').inner_text()
    page.reload();page.wait_for_timeout(900);page.mouse.click(10,10)
    assert sampled(5) and sampled(7) and sampled(13) and sampled(14)
    assert page.locator('#mem').inner_text()==memory
    assert meta()['extras'][1]['steps']['8:0']['retrigs']==2
    select(13);page.evaluate('starts=[]');tap(pad(4));page.wait_for_timeout(100)
    assert page.evaluate('starts.length')==0
    assert not errors,errors
    # RECORD + knobs reset tone/filter independently; TRIM is unchanged.
    select(5);down('[data-act="rec"]');wheel('A');wheel('B');up()
    assert meta()['tweaks'][4]['pitch']==0 and meta()['tweaks'][4]['volume']==100
    tap('[data-act="fx"]');wheel('A',5);wheel('B',5)
    down('[data-act="rec"]');wheel('A');wheel('B');up()
    assert meta()['tweaks'][4]['filter']==0 and meta()['tweaks'][4]['resonance']==0
    # Releasing the number leaves recording active; RECORD release saves it.
    down('[data-act="rec"]');down(pad(6),2);page.wait_for_timeout(400);up(2)
    assert page.locator('body').evaluate('e=>e.classList.contains("recording")')
    page.wait_for_timeout(350);up()
    assert not page.locator('body').evaluate('e=>e.classList.contains("recording")')
    assert sampled(6)
    assert stored('po33.slot6')['base']['duration']>.5
    # Copies remain audible after the original source is deleted and reloaded.
    select(1);down('[data-act="rec"]');tap('[data-act="sound"]',2);up()
    page.wait_for_timeout(500);page.reload();page.wait_for_timeout(900);page.mouse.click(10,10)
    assert not sampled(1) and sampled(5) and sampled(7)
    select(5);page.evaluate('starts=[]');tap(pad(1))
    assert page.evaluate('starts.length')==1
    # SOUND alone displays the slot in the fixed four-position display.
    select(9);tap(pad(8));down('[data-act="sound"]');page.wait_for_timeout(100)
    assert page.locator('#lcdNumber').get_attribute('data-value')=='9'
    assert page.evaluate('document.querySelector("#lcdNumber").getBoundingClientRect().left>document.querySelector("#lcdMode").getBoundingClientRect().right')
    tap('#bpmMode',2);page.wait_for_timeout(100)
    assert page.locator('#lcdMode').text_content()=='SOUND'
    assert page.locator('#lcdNumber').get_attribute('data-value')=='9'
    up()
    assert not errors,errors
    # Legacy per-slot WAV values still restore, and a released target pad can
    # wait for microphone permission without losing the recording request.
    wav=page.evaluate('PO33_FACTORY.slots[0].wav')
    legacy=browser.new_page(viewport={'width':240,'height':282})
    legacy.on('pageerror',lambda e:errors.append(str(e)))
    legacy.add_init_script('''
      localStorage.setItem('po33.meta',btoa(JSON.stringify({v:2,factoryRevision:1,slot:5})));
      localStorage.setItem('po33.slot5',btoa(JSON.stringify('''+json.dumps(wav)+''')));
      const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=(opts)=>gum(opts).then(s=>new Promise(r=>setTimeout(()=>r(s),300)));
    ''')
    legacy.goto(url+'index.html');legacy.wait_for_timeout(600);legacy.mouse.click(10,10)
    assert 'sampled' in legacy.locator(pad(5)).get_attribute('class')
    legacy.locator('[data-act="rec"]').dispatch_event('pointerdown',{'pointerId':1,'bubbles':True})
    legacy.locator(pad(6)).dispatch_event('pointerdown',{'pointerId':2,'bubbles':True})
    legacy.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:2}))')
    legacy.wait_for_timeout(1000)
    assert legacy.locator('body').evaluate('e=>e.classList.contains("recording")')
    legacy.evaluate('window.dispatchEvent(new PointerEvent("pointerup",{pointerId:1}))')
    legacy.wait_for_function('!document.body.classList.contains("recording")')
    assert 'sampled' in legacy.locator(pad(6)).get_attribute('class')
    assert not errors,errors
    print('PASS: held-step note/length, long-copy, delete/cancel, retrig cycle and audio timing; cropped/shared sound copies, kits, individual/empty slices, target tone retention, reload memory; parameter reset; recording release; four-digit slot/slice display. No JS errors.')
    browser.close()
