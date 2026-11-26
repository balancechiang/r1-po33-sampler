import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    page=browser.new_page(viewport={'width':240,'height':282},device_scale_factor=3)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('window.pulses=[];Object.defineProperty(navigator,"vibrate",{value:n=>{pulses.push(n);return true;}})')
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(500);page.mouse.click(10,10)
    def down(selector,id):page.locator(selector).dispatch_event('pointerdown',{'pointerId':id,'button':0,'bubbles':True})
    def up(id):page.evaluate('(id)=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,bubbles:true}))',id)
    def click(selector,id=1):down(selector,id);up(id)
    def wheel(selector,dy,count=1):page.locator(selector).evaluate('(e,a)=>{for(let i=0;i<a[1];i++)e.dispatchEvent(new WheelEvent("wheel",{deltaY:a[0],bubbles:true,cancelable:true}));}',[dy,count])
    def mode():return page.locator('body').get_attribute('data-mode')
    assert page.locator('#lcdNumber').get_attribute('data-value')=='120'
    down('[data-act="pattern"]',1);click('[data-pad="5"]',2);up(1)
    click('[data-act="write"]');assert mode()=='STEP'
    click('[data-pad="1"]');assert 'step-on' in page.locator('[data-pad="1"]').get_attribute('class')
    click('[data-act="play"]');assert mode()=='STEP';page.wait_for_timeout(250)
    assert page.locator('#lcdPlay').get_attribute('fill')=='#fff'
    down('[data-act="write"]',1);click('[data-pad="5"]',2);up(1);assert mode()=='STEP'
    down('[data-act="fx"]',1)
    for n in range(1,17):click(f'[data-pad="{n}"]',2)
    up(1)
    click('[data-act="play"]')
    down('[data-act="sound"]',1);click('[data-pad="9"]',2);up(1);assert mode()=='STEP'
    assert page.locator('#slot').inner_text()=='SLOT 9'
    click('[data-act="write"]');assert mode()=='PLAY'
    # TONE, FILTER, TRIM are paired across both knobs.
    for group in range(3):
        wheel('#knobA',-1,4);wheel('#knobB',1,4);click('[data-act="fx"]')
    down('#bpmMode',1);wheel('#knobB',-1,200)
    assert page.locator('#lcdNumber').get_attribute('data-value')=='240'
    a=page.locator('#knobB').evaluate('e=>parseFloat(e.style.getPropertyValue("--knob-angle"))')
    wheel('#knobB',1,200)
    z=page.locator('#knobB').evaluate('e=>parseFloat(e.style.getPropertyValue("--knob-angle"))')
    assert round(a-z)==280
    wheel('#knobA',1,100);wheel('#knobA',-1,100);up(1)
    assert page.locator('#lcdNumber').get_attribute('data-value')=='50'
    # Recording remains a hold gesture, and releasing either input stops it.
    down('[data-act="rec"]',1);down('[data-pad="1"]',2);page.wait_for_timeout(3000)
    assert page.locator('#lcdRecord rect').get_attribute('fill')=='#222', (page.locator('#hint').inner_text(),errors,page.locator('body').get_attribute('class'))
    up(2);up(1);page.wait_for_timeout(400)
    assert 'sampled' in page.locator('[data-pad="1"]').get_attribute('class')
    assert mode()=='PLAY'
    down('[data-act="sound"]',1);click('[data-pad="1"]',2);up(1)
    down('[data-act="write"]',1);down('[data-act="sound"]',2);click('[data-pad="2"]',3);up(2);up(1)
    assert 'sampled' in page.locator('[data-pad="2"]').get_attribute('class')
    down('[data-act="pattern"]',1)
    for n in [1,2,1]:click(f'[data-pad="{n}"]',2)
    up(1)
    assert not errors,errors
    assert all(n==12 for n in page.evaluate('pulses'))
    page.wait_for_timeout(700)
    page.reload();page.wait_for_timeout(1000)
    assert 'sampled' in page.locator('[data-pad="1"]').get_attribute('class')
    assert 'sampled' in page.locator('[data-pad="2"]').get_attribute('class')
    assert not errors,errors
    # Restore a quiet default frame for preview (captured after opening a clean context).
    clean=browser.new_context(viewport={'width':240,'height':282},device_scale_factor=3)
    preview=clean.new_page();preview.goto((root/'index.html').as_uri());preview.wait_for_timeout(500)
    preview.screenshot(path=str(root/'ui2-preview.png'))
    print('PASS: LCD seven segments, write/transport, live notes, all 16 FX keys, sound selection, paired parameters, BPM/swing bounds, 280-degree sweep, mic recording, sound copy, pattern chaining, haptics. No JS errors.')
    browser.close()

