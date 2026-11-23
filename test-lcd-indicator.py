from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282},device_scale_factor=3)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(500);page.mouse.click(10,10)
    def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
    def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i}))',i)
    def tap(sel):down(sel);up()
    def wheel(knob,n=1,dy=-1):page.locator('#knob'+knob).evaluate('(e,a)=>{for(let i=0;i<a[0];i++)e.dispatchEvent(new WheelEvent("wheel",{deltaY:a[1],bubbles:true,cancelable:true}));}',[n,dy])
    def mode():return page.locator('#lcdMeter').get_attribute('data-indicator-mode')
    def lit():return page.locator('#lcdMeter rect[data-active="true"]').evaluate_all('es=>es.map(e=>+e.dataset.segment)')
    assert page.locator('#lcdMeter rect').count()==38 and mode()=='meter'
    page.evaluate('window.originalSquares=Array.from(document.querySelector("#lcdMeter").children)')
    rects=page.locator('#lcdMeter rect').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height,y:r.y,bottom:r.bottom};})')
    assert all(abs(r['width']-r['height'])<.01 for r in rects)
    assert all(rects[i]['right']<rects[i+1]['x'] for i in range(37))
    end_in=page.locator('#lcdIn rect').bounding_box();start_out=page.locator('#lcdOut rect').bounding_box()
    assert rects[0]['x']>end_in['x']+end_in['width']
    assert rects[-1]['right']<start_out['x']
    # Standalone component can switch props and colors, without the app adapter.
    page.evaluate('''window.demoGroup=document.createElementNS('http://www.w3.org/2000/svg','g');
      window.demo=PO33Indicator.create(demoGroup,{mode:'trim',start:25,length:50});
      window.demoSquares=Array.from(demoGroup.children);demo.setProps({mode:'level',value:7,onColor:'#ff5705'});''')
    assert page.evaluate('demoGroup.querySelectorAll("[fill=\\"#ff5705\\"]").length')==7
    assert page.evaluate('demoSquares.every((e,i)=>e===demoGroup.children[i])')
    page.evaluate("demo.setProps({mode:'meter',origin:'center',value:4,peak:20,onColor:'#fff'})")
    assert page.evaluate('demoGroup.children.length')==38
    assert page.evaluate('demoGroup.querySelectorAll("circle").length')==0
    assert page.evaluate('Array.from(demoGroup.querySelectorAll("[data-peak=true]")).map(e=>+e.dataset.segment)')==[9,28]
    assert page.evaluate('Array.from(demoGroup.querySelectorAll("[data-peak=true]")).every(e=>e.getAttribute("fill")==="#fff")')
    assert page.evaluate('demoSquares.every((e,i)=>e===demoGroup.children[i])')
    page.evaluate('demo.destroy()');assert page.evaluate('demoGroup.children.length')==0
    page.screenshot(path=str(root/'lcd-indicator-preview.png'))
    assert not errors,errors
    print('PASS: exactly 38 separate squares, gaps and IN/OUT alignment; stable DOM across mode changes; standalone props/colors/destroy. No JS errors.')
    browser.close()
