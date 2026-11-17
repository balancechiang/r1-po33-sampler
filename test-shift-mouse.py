from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    page=browser.new_page(viewport={'width':240,'height':282})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(600)
    def click(sel):page.locator(sel).click(force=True)
    def pad(n):return f'[data-pad="{n}"]'
    def shift():page.keyboard.down('Shift')
    def release():page.keyboard.up('Shift')
    def mode():return page.locator('body').get_attribute('data-mode')
    def meta():page.wait_for_timeout(400);return page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta")))')
    # One mouse can select a slot, then release the modifier with Shift.
    shift();click('[data-act="sound"]');assert mode()=='SOUND'
    click(pad(9));assert mode()=='SOUND'
    release();assert mode()=='PLAY' and meta()['slot']==9
    # Multiple held modifiers use separate virtual pointers and release in reverse order.
    shift();click('[data-act="sound"]');click('[data-act="write"]');click(pad(13));click(pad(4))
    assert not page.evaluate('localStorage.getItem("po33.slot13")')
    release();assert mode()=='PLAY'
    assert meta()['slot']==9 and page.evaluate('!!localStorage.getItem("po33.slot13")')
    # Repeat Shift-click toggles one held key off; a delayed click must not
    # fall through the browser click handler and toggle WRITE twice.
    shift();click('[data-act="write"]');page.wait_for_timeout(700);click('[data-act="write"]')
    assert mode()=='STEP'
    release();assert mode()=='STEP'
    # Hold a step without keeping the mouse down, then use its knob.
    shift();click('[data-act="sound"]');click(pad(1));release()
    active=page.locator('.pad.step-on').first
    n=int(active.get_attribute('data-pad'));before=page.evaluate('n=>JSON.parse(atob(localStorage.getItem("po33.pat1")))[0][n-1]',n)
    shift();click(pad(n))
    page.locator('#knobA').evaluate('e=>e.dispatchEvent(new WheelEvent("wheel",{deltaY:-1,bubbles:true,cancelable:true}))')
    release()
    assert not page.locator('.step-edit').count()
    assert meta()['extras'][0]['steps']
    assert page.evaluate('n=>JSON.parse(atob(localStorage.getItem("po33.pat1")))[0][n-1]',n)==before+1
    click('[data-act="write"]');assert mode()=='PLAY'
    # Shift-held RECORD continues after the target pad click and stops at Shift-up.
    shift();click('[data-act="rec"]');click(pad(6));page.wait_for_timeout(500)
    assert page.locator('body').evaluate('e=>e.classList.contains("recording")')
    release();assert not page.locator('body').evaluate('e=>e.classList.contains("recording")')
    assert 'sampled' in page.locator(pad(6)).get_attribute('class')
    # Shift-held BPM plus a knob adjusts swing without a tap-tempo side effect.
    shift();click('#bpmMode')
    page.locator('#knobA').evaluate('e=>e.dispatchEvent(new WheelEvent("wheel",{deltaY:-1,bubbles:true,cancelable:true}))')
    release();assert meta()['bpm']==120 and meta()['swing']>0
    # Hold FX and a number simultaneously with one mouse; playback level is centered.
    click('[data-act="play"]');page.wait_for_timeout(400)
    assert page.locator('#lcdMeter').get_attribute('data-indicator-origin')=='center'
    for _ in range(5):
        page.wait_for_timeout(70)
        states=page.locator('#lcdMeter rect').evaluate_all('es=>es.map(e=>e.dataset.active==="true")')
        assert states==states[::-1]
    shift();click('[data-act="fx"]');click(pad(5));page.wait_for_timeout(120)
    assert page.locator('#lcdNumber').get_attribute('data-value')=='05'
    assert page.locator('[data-led-reason="effect"]').count()==1
    release();assert not page.locator('[data-led-reason="effect"]').count()
    # Focus loss cancels unused sticky WRITE rather than toggling mode on return.
    shift();click('[data-act="write"]');page.evaluate('window.dispatchEvent(new Event("blur"))')
    assert mode()=='PLAY'
    release();page.evaluate('window.dispatchEvent(new Event("focus"))')
    click('[data-act="play"]')
    assert page.locator('#lcdMeter').get_attribute('data-indicator-origin')=='left'
    assert not errors,errors
    print('PASS: real Shift+mouse slot selection, two-modifier slice copy, delayed toggle-off, held step+knob, held recording, BPM+knob, FX+pad, Shift-up/blur cleanup; symmetric 32-cell playback meter and stopped-mode origin. No JS errors.')
    browser.close()
