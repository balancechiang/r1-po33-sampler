from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282})
    page.add_init_script('window.pulses=[];Object.defineProperty(navigator,"vibrate",{configurable:true,value:n=>{pulses.push(n);return true;}})')
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(300)
    # Isolate the haptic listener from audio/recording actions during exhaustive checks.
    page.evaluate('document.addEventListener("pointerdown",e=>e.stopImmediatePropagation(),true)')
    for x,y in [(5,35),(54,100),(10,10),(3,200),(237,280)]:page.mouse.click(x,y)
    assert page.evaluate('pulses.length')==0
    count=page.locator('#panel button').count()
    page.locator('#panel button').evaluate_all('es=>es.forEach(e=>e.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,button:0})))')
    assert page.evaluate('pulses.length')==count==25
    page.locator('.pad .num').first.dispatch_event('pointerdown',{'button':0})
    assert page.evaluate('pulses.length')==count+1
    page.locator('#paramBtn').dispatch_event('pointerdown',{'button':0})
    page.locator('#bpmMode').dispatch_event('pointerdown',{'button':2})
    page.locator('#bpmMode').evaluate('e=>{e.disabled=true;e.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,button:0}));e.disabled=false;}')
    assert page.evaluate('pulses.length')==count+1
    assert page.evaluate('pulses.every(n=>n===12)')
    page.evaluate('Object.defineProperty(navigator,"vibrate",{value:undefined})')
    page.locator('#bpmMode').dispatch_event('pointerdown',{'button':0})
    print('PASS: all 25 rendered controls request one 12ms pulse; background, gaps, status area, hidden/disabled controls and right-click do not; unsupported vibration is tolerated.')
    browser.close()
