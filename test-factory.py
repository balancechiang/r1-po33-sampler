from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282},device_scale_factor=3)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(600)
    assert page.locator('.pad.sampled').evaluate_all('es=>es.map(e=>+e.dataset.pad)')==[1,2,3,4,9,10,11,12]
    def down(sel,id):page.locator(sel).dispatch_event('pointerdown',{'pointerId':id,'button':0,'bubbles':True})
    def up(id):page.evaluate('id=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,bubbles:true}))',id)
    def angles():return page.locator('.knob').evaluate_all('es=>es.map(e=>e.style.getPropertyValue("--knob-angle"))')
    initial=angles()
    for n in range(4):
        down('#bpmMode',1);assert angles()==initial
        up(1);assert angles()==initial
    # Exact crop centers must match the Illustrator circle centers.
    centers=page.locator('.knob-rotor').evaluate_all('es=>es.map(e=>{let r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,r.width,r.height]})')
    for actual,expected in zip(centers,[(163.8339,52.852),(208.0034,52.852)]):
        assert abs(actual[0]-expected[0])<.04 and abs(actual[1]-expected[1])<.04
        assert abs(actual[2]-actual[3])<.02
    page.evaluate('document.fonts.ready')
    assert page.evaluate('document.fonts.check("14.5px DSEG7")')
    assert page.locator('#lcdNumber').evaluate('e=>e.tagName')=='text'
    down('[data-act="pattern"]',1)
    assert page.locator('.pad.pat-on').evaluate_all('es=>es.map(e=>+e.dataset.pad)')==[1,2,3,4,5,6,7,8]
    up(1)
    # Empty slots produce no signal; populated slots and all patterns do.
    page.mouse.click(10,10)
    down('[data-act="sound"]',1);down('[data-pad="5"]',2);up(2);up(1)
    down('[data-pad="1"]',2);up(2);page.wait_for_timeout(100)
    assert page.locator('#lcdMeter rect[fill="#fff"]').count()==0
    for number in range(1,9):
        down('[data-act="pattern"]',1);down(f'[data-pad="{number}"]',2);up(2);up(1)
        down('[data-act="play"]',1);up(1)
        peak=0
        for _ in range(6):page.wait_for_timeout(130);peak=max(peak,page.locator('#lcdMeter rect[fill="#fff"]').count())
        assert peak>0,(number,peak)
        down('[data-act="play"]',1);up(1)
    # Deleted factory sound must stay deleted on reload; patterns must not reseed.
    down('[data-act="sound"]',1);down('[data-pad="1"]',2);up(2);up(1)
    down('[data-act="rec"]',1);down('[data-act="sound"]',2);up(2);up(1)
    page.wait_for_timeout(400);page.reload();page.wait_for_timeout(500)
    assert 'sampled' not in page.locator('[data-pad="1"]').get_attribute('class')
    assert not errors,errors
    fresh=browser.new_context(viewport={'width':240,'height':282},device_scale_factor=3).new_page()
    fresh.goto((root/'index.html').as_uri());fresh.wait_for_timeout(600)
    fresh.screenshot(path=str(root/'current-preview.png'))
    print('PASS: factory slot layout, only patterns 1–8 seeded, eight audible mixes, empty slots silent, deletion survives reload, wider digits, exact circular pivots, BPM modifier/tap never changes knob angles.')
    browser.close()

