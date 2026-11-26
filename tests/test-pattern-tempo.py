import os as _test_os
from pathlib import Path as _TestPath
_test_os.chdir(_TestPath(__file__).resolve().parents[1])
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''
      if(!localStorage.getItem('tempo-test')){
        const settings=Array(16).fill(null);settings[0]={bpm:120,swing:0};settings[1]={bpm:180,swing:0};
        const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[0].fill(0);
        localStorage.setItem('tempo-test','1');
        localStorage.setItem('po33.install.web-sampler-20261126.po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,patternSettings:settings})));
        for(const n of [1,2])localStorage.setItem('po33.install.web-sampler-20261126.po33.pat'+n,btoa(JSON.stringify(lanes)));
      }
      window.noteTimes=[];const start=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){noteTimes.push(args[0]);return start.apply(this,args);};
    ''')
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(500);page.mouse.click(10,10)
    def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
    def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i}))',i)
    def tap(sel,i=1):down(sel,i);up(i)
    down('[data-act="pattern"]');tap('[data-pad="1"]',2);tap('[data-pad="2"]',2);up()
    tap('[data-act="play"]');page.wait_for_timeout(3600);tap('[data-act="play"]')
    times=page.evaluate('noteTimes');assert len(times)>=33,len(times)
    assert all(abs(times[i+1]-times[i]-.125)<.001 for i in range(16))
    assert all(abs(times[i+1]-times[i]-1/12)<.001 for i in range(16,32))
    # Copying a pattern also copies its BPM/swing settings.
    down('[data-act="pattern"]');tap('[data-pad="2"]',2);up()
    down('[data-act="write"]');down('[data-act="pattern"]',2);tap('[data-pad="5"]',3);up(2);up()
    page.wait_for_timeout(450)
    settings=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.install.web-sampler-20261126.po33.meta"))).patternSettings')
    assert settings[4]==settings[1]=={'bpm':180,'swing':0},settings
    assert not errors,errors
    print('PASS: chained patterns change actual note timing at bar boundaries (120/180 BPM), return to the earlier tempo without drift, and copied patterns retain BPM/swing.')
    browser.close()
