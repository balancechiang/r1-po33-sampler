from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(600);page.mouse.click(10,10)
    def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
    def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i}))',i)
    def tap(sel,i=1):down(sel,i);up(i)
    def select_pattern(n):down('[data-act="pattern"]');tap(f'[data-pad="{n}"]',2);up()
    def meta():page.wait_for_timeout(400);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
    # The rabbit control covers only its head; short presses do not reset.
    head=page.locator('#factoryReset').bounding_box()
    assert head['width']<25 and head['height']<24,head
    down('#factoryReset');page.wait_for_timeout(150);up()
    assert not page.evaluate('localStorage.getItem("po33.reset")')
    assert page.locator('#lcdNumber').get_attribute('data-value')!='RST'
    # New factory tracks have distinct tempo/swing and real rhythm distributions.
    for n,bpm in [(1,120),(2,132),(3,84),(4,140)]:
        select_pattern(n);assert meta()['bpm']==bpm
    assert page.evaluate('new Set(PO33_FACTORY.patterns.map(p=>JSON.stringify(p.lanes))).size')==4
    # Manual tempo edits are per pattern and survive selection/reload.
    select_pattern(2);page.evaluate('window.dispatchEvent(new Event("scrollUp"))')
    assert meta()['bpm']==133
    select_pattern(3);assert meta()['bpm']==84
    select_pattern(2);assert meta()['bpm']==133
    # Dirty sounds, patterns, FX and settings to ensure reset clears everything.
    down('[data-act="write"]');down('[data-act="sound"]',2);tap('[data-pad="5"]',3);up(2);up()
    tap('[data-act="write"]');tap('[data-pad="2"]');tap('[data-act="write"]')
    page.evaluate('localStorage.setItem("unrelated-setting","keep me")')
    page.wait_for_timeout(500)
    assert page.evaluate('localStorage.getItem("po33.slot5")')
    # A long hold cancelled by a drag out, cancellation or blur remains inert.
    down('#factoryReset');page.evaluate('window.dispatchEvent(new PointerEvent("pointermove",{pointerId:1,clientX:20,clientY:80}))')
    page.wait_for_timeout(50);up()
    down('#factoryReset');page.evaluate('window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:1}))')
    down('#factoryReset');page.evaluate('window.dispatchEvent(new Event("blur"))');up()
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    assert page.evaluate('localStorage.getItem("po33.slot5")')
    tap('[data-act="play"]');down('#factoryReset')
    page.wait_for_timeout(4750)
    assert page.locator('#lcdNumber').get_attribute('data-value')!='RST'
    assert page.evaluate('localStorage.getItem("po33.slot5")')
    page.wait_for_function('document.body.dataset.resetting==="true"',timeout=1500)
    assert page.locator('#lcdNumber').get_attribute('data-value')=='RST'
    page.wait_for_event('framenavigated',timeout=6000)
    page.wait_for_function('document.querySelectorAll(".pad.sampled").length===8 && document.querySelector("#lcdNumber").dataset.value==="RST"',timeout=6000)
    assert page.locator('#lcdNumber').text_content()=='RST'
    page.screenshot(path=str(root/'factory-reset-preview.png'))
    assert not page.evaluate('localStorage.getItem("po33.slot5")')
    assert not page.evaluate('localStorage.getItem("po33.reset")')
    assert page.evaluate('localStorage.getItem("unrelated-setting")')=='keep me'
    assert page.locator('body').get_attribute('data-mode')=='PLAY'
    assert page.locator('#lcdPlay').get_attribute('fill')=='#222'
    restored=meta()
    assert restored['slot']==restored['pattern']==1 and restored['bpm']==120
    assert restored['chain']==[] and restored['masterVolume']==8
    assert all(not x for x in restored['factoryMuted'])
    assert restored['patternSettings'][1]['bpm']==132
    assert page.evaluate('''PO33_FACTORY.patterns.every((p,i)=>JSON.stringify(p.lanes)===JSON.stringify(JSON.parse(atob(localStorage.getItem('po33.pat'+(i+1))))))''')
    assert page.evaluate('!localStorage.getItem("po33.pat5") || JSON.parse(atob(localStorage.getItem("po33.pat5"))).every(l=>l.every(v=>v===-1))')
    page.reload();page.wait_for_timeout(700)
    assert page.locator('.pad.sampled').evaluate_all('es=>es.map(e=>+e.dataset.pad)')==[1,2,3,4,9,10,11,12]
    select_pattern(2);assert meta()['bpm']==132
    assert not errors,errors
    # Simulate a reset interrupted before clearing: startup finishes it safely.
    context=browser.new_context(viewport={'width':240,'height':282});recovery=context.new_page()
    recovery.add_init_script('''if(!localStorage.getItem('recover-test')){
      localStorage.setItem('recover-test','1');localStorage.setItem('unrelated-setting','keep');
      localStorage.setItem('po33.reset','1');localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:211})));
      localStorage.setItem('po33.slot5','old-recording');
    }''')
    recovery.goto((root/'index.html').as_uri());recovery.wait_for_timeout(700)
    assert recovery.locator('#lcdNumber').get_attribute('data-value')=='RST'
    assert not recovery.evaluate('localStorage.getItem("po33.slot5")')
    assert recovery.evaluate('localStorage.getItem("unrelated-setting")')=='keep'
    assert recovery.locator('.pad.sampled').count()==8
    # A storage failure keeps the reset marker, reports err, and recovers on reload.
    failure=browser.new_page(viewport={'width':240,'height':282})
    failure.add_init_script('''
      if(!localStorage.getItem('failure-test')){localStorage.setItem('failure-test','1');localStorage.setItem('po33.reset','1');}
      window.creationStorage={plain:{
        getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v),
        removeItem:async k=>{await new Promise(r=>setTimeout(r,10));if(k==='po33.slot7'&&!localStorage.getItem('failed-once')){
          localStorage.setItem('failed-once','1');throw Error('simulated failure');
        }localStorage.removeItem(k);}
      }};
    ''')
    failure.goto((root/'index.html').as_uri());failure.wait_for_timeout(400)
    assert failure.locator('#lcdNumber').get_attribute('data-value')=='err'
    assert failure.evaluate('localStorage.getItem("po33.reset")')=='1'
    failure.reload();failure.wait_for_timeout(600)
    assert failure.locator('.pad.sampled').count()==8
    assert not failure.evaluate('localStorage.getItem("po33.reset")')
    # Virtual time isolates each cancellation from the next gesture: no delayed
    # reset may run after an otherwise valid hold has been cancelled.
    cancelled=browser.new_page(viewport={'width':240,'height':282})
    cancelled.goto((root/'index.html').as_uri());cancelled.wait_for_timeout(500)
    cancelled.clock.install()
    cancelled.evaluate('localStorage.setItem("po33.slot5","sentinel")')
    for kind in ['pointerup','pointercancel','move','blur']:
        cancelled.locator('#factoryReset').dispatch_event('pointerdown',{'pointerId':1,'button':0,'bubbles':True})
        cancelled.clock.fast_forward(4900)
        if kind=='move':cancelled.evaluate('window.dispatchEvent(new PointerEvent("pointermove",{pointerId:1,clientX:10,clientY:90}))')
        elif kind=='blur':cancelled.evaluate('window.dispatchEvent(new Event("blur"))')
        else:cancelled.evaluate('t=>window.dispatchEvent(new PointerEvent(t,{pointerId:1}))',kind)
        cancelled.clock.fast_forward(1100)
        assert cancelled.evaluate('localStorage.getItem("po33.slot5")')=='sentinel',kind
        assert not cancelled.evaluate('localStorage.getItem("po33.reset")'),kind
    cancelled.locator('#factoryReset').dispatch_event('keydown',{'key':'Enter','bubbles':True})
    cancelled.clock.fast_forward(4900)
    cancelled.locator('#factoryReset').dispatch_event('keyup',{'key':'Enter','bubbles':True})
    cancelled.clock.fast_forward(1100)
    assert cancelled.evaluate('localStorage.getItem("po33.slot5")')=='sentinel'
    print('PASS: five-second threshold and head-only hold; short/drag/cancel/blur aborts; RST and clean reload; sound/pattern/parameter clearing; unrelated storage preserved; interrupted-reset recovery; distinct rhythms/tempos and per-pattern tempo memory.')
    browser.close()
