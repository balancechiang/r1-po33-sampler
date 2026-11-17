from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282})
    page.add_init_script('''
      const pattern=()=>Array.from({length:16},()=>Array(16).fill(-1));
      const a=pattern(),b=pattern();a[0][0]=0;a[0][4]=3;a[8][2]=0;a[8][4]=0;
      b[0][1]=0;b[9][3]=1;
      localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,slot:1,pattern:1,bpm:120})));
      localStorage.setItem('po33.pat1',btoa(JSON.stringify(a)));
      localStorage.setItem('po33.pat2',btoa(JSON.stringify(b)));
    ''')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(400);page.mouse.click(10,10)
    def down(sel,i):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0})
    def up(i):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i}))',i)
    def tap(sel,i=1):down(sel,i);up(i)
    def level(n):return page.locator(f'[data-pad="{n}"]').get_attribute('data-led-level')
    def reason(n):return page.locator(f'[data-pad="{n}"]').get_attribute('data-led-reason')
    tap('[data-act="write"]')
    assert [level(n) for n in [1,2,3,5]]==['dim','off','low','dim']
    colors=[page.locator(f'[data-pad="{n}"] .led').evaluate('e=>getComputedStyle(e).backgroundColor') for n in [1,2,3]]
    assert len(set(colors))==3,colors
    # Selected slot changes the lane priority; a shared step is not counted twice.
    down('[data-act="sound"]',1);tap('[data-pad="9"]',2)
    assert not page.locator('[data-led-reason="cursor"]').count()
    up(1)
    assert [reason(n) for n in [1,3,5]]==['other-step','own-step','own-step']
    down('[data-act="sound"]',1);tap('[data-pad="1"]',2);up(1)
    # Playback overlays a bright audio-clock cursor, with a distinct downbeat pulse.
    tap('[data-act="play"]')
    page.wait_for_function('document.querySelector("[data-led-reason=downbeat]")!==null')
    assert level(1)=='bright'
    assert page.locator('[data-pad="1"] .led').evaluate('e=>getComputedStyle(e).animationName')=='step-downbeat'
    page.wait_for_function('document.querySelector("[data-led-reason=cursor]")!==null')
    assert page.locator('[data-led-level="bright"]').count()==1
    # Changing to pattern 2 refreshes the skeleton only when that pattern is audible.
    down('[data-act="pattern"]',1);tap('[data-pad="2"]',2);up(1)
    page.wait_for_function('document.querySelector(\'[data-pad="1"]\').dataset.ledPattern==="2"')
    tap('[data-act="play"]')
    assert [reason(n) for n in [1,2,4,5]]==['empty','own-step','other-step','empty']
    assert not page.locator('[data-led-reason="cursor"],[data-led-reason="downbeat"]').count()
    assert not errors,errors
    print('PASS: off/other-track/selected-track/bright states; actual distinct colors; lane switching; shared steps; downbeat and chase; audio-aligned pattern transitions; stop cleanup. No JS errors.')
    browser.close()
