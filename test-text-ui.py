from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282},device_scale_factor=3)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'index.html').as_uri());page.evaluate('document.fonts.ready');page.wait_for_timeout(300)
    assert page.locator('#lcd > rect').count()==0 # no black masking layers
    assert page.locator('#lcdNumber').count()==1
    assert page.locator('#lcdNumber polygon').count()==0
    assert page.locator('#lcdNumber').evaluate('e=>e.children.length')==0
    assert page.locator('#panelText .panel-label').count()==23
    assert page.evaluate('document.fonts.check("14.5px DSEG7")')
    # All relevant readouts must fit their dedicated number zone.
    extents=page.locator('#lcdNumber').evaluate('''e=>{
      const old=e.textContent, out=[];
      for(const text of ['60','120','240','-12','40.0','100','ton','FLt','tri']){
        e.textContent=text;let b=e.getBBox();out.push([text,b.x,b.x+b.width,b.y,b.y+b.height]);
      }e.textContent=old;return out;
    }''')
    for text,left,right,top,bottom in extents:
        assert left>=199 and right<=239 and top>=0 and bottom<=22,(text,left,right,top,bottom)
    page.evaluate('window.originalNumber=document.getElementById("lcdNumber");window.originalIn=document.getElementById("lcdIn")')
    page.evaluate('window.dispatchEvent(new Event("scrollUp"))')
    assert page.evaluate('originalNumber===document.getElementById("lcdNumber") && originalIn===document.getElementById("lcdIn")')
    page.screenshot(path=str(root/'text-ui-preview.png'))
    # Text remains aligned when the panel is doubled in size.
    first=page.locator('.panel-label').first.bounding_box()
    page.set_viewport_size({'width':480,'height':564});page.wait_for_timeout(100)
    doubled=page.locator('.panel-label').first.bounding_box()
    assert abs(doubled['width']-first['width']*2)<.1
    assert not errors,errors
    print('PASS: one text element per readout, no mask rectangles or segment overlays; DSEG loaded locally; nine number/parameter strings fit; 23 labels use text; responsive alignment preserved.')
    browser.close()
