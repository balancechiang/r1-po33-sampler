"""Real mouse/Shift selection gestures, audition, fixed LCD cells and contextual LEDs."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import time,json
root=Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  page=browser.new_page(viewport={'width':240,'height':282});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.testStarts=[];const originalStart=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){testStarts.push({rate:this.playbackRate.value,offset:a[1],duration:a[2]});return originalStart.apply(this,a);};")
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.wait_for_timeout(800)
  def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
  def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i,bubbles:true}))',i)
  def tap(sel,i=1):down(sel,i);up(i)
  def value():return page.locator('#lcdNumber').get_attribute('data-value')
  def choose(n):down('[data-act="sound"]');tap(f'[data-pad="{n}"]',2)
  choose(2);assert value()=='2';assert page.evaluate('testStarts.length===1 && testStarts[0].rate===1');assert page.locator('#lcdNumber tspan').count()==4;up()
  down('[data-act="sound"]');assert value()=='2';assert page.evaluate('testStarts.length===1');up()
  choose(9);assert value()=='0901';assert page.evaluate('testStarts.at(-1).offset===0');up()
  choose(9);assert value()=='0902';assert abs(page.evaluate('testStarts.at(-1).offset')-.24)<.001;up()
  for _ in range(15):choose(9);up()
  assert value()=='0901'
  choose(10);assert value()=='1001';up();choose(9);assert value()=='0901';up()
  # Real mouse long press locks SOUND, then another mouse click completes the chord.
  sound=page.locator('[data-act="sound"]').bounding_box();page.mouse.move(sound['x']+sound['width']/2,sound['y']+sound['height']/2);page.mouse.down();page.wait_for_timeout(560);page.mouse.up()
  assert page.locator('[data-act="sound"]').evaluate('e=>e.classList.contains("transfer-latched")')
  page.locator('[data-pad="1"]').click();assert value()=='1';assert page.evaluate('testStarts.at(-1).rate===1');page.mouse.click(2,2)
  assert not page.locator('.transfer-latched').count();assert page.locator('body').get_attribute('data-mode')=='PLAY'
  # Shift still supplies separate held fingers without the long-press timer.
  page.keyboard.down('Shift');page.locator('[data-act="sound"]').click();page.locator('[data-pad="2"]').click();page.keyboard.up('Shift');assert value()=='2'
  assert not page.locator('.transfer-latched').count()
  down('[data-act="rec"]');assert page.locator('[data-pad="2"]').get_attribute('data-led-reason')=='record-selected'
  assert page.locator('.pad[data-led-reason="record-slots"][data-led-level="bright"]').count()==7
  colors=set()
  for _ in range(10):colors.add(page.locator('[data-pad="2"] .led').evaluate('e=>getComputedStyle(e).backgroundColor'));page.wait_for_timeout(80)
  assert len(colors)==2,colors;assert page.locator('[data-pad="1"] .led').evaluate('e=>getComputedStyle(e).animationName')=='none';up()
  assert page.locator('[data-led-reason="record-selected"]').count()==0
  tap('[data-act="play"]');levels=[];rises=[];prior='off'
  for _ in range(60):
   level=page.locator('[data-act="play"]').get_attribute('data-led-level');levels.append(level)
   if level=='bright' and prior=='off':rises.append(time.monotonic())
   prior=level;page.wait_for_timeout(30)
  assert set(levels)=={'bright','off'},levels
  assert len(rises)>=3,rises
  assert all(.35<b-a<.65 for a,b in zip(rises,rises[1:])),rises
  tap('[data-act="play"]');assert page.locator('[data-act="play"]').get_attribute('data-led-level')=='off'
  assert not errors,errors
  browser.close();print('PASS real mouse hold/Shift chords; melodic root audition; drum first/next/wrap/switch; four independent LCD places; RECORD occupancy/selected blink; audio-clock PLAY beat pulse and stop.')
finally:server.shutdown();server.server_close()
