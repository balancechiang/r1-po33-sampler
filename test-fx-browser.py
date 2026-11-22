from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':240,'height':282})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''
      if(!localStorage.getItem('fx-test')){
        const lanes=Array.from({length:16},()=>Array(16).fill(-1));lanes[0]=Array.from({length:16},(_,i)=>i);
        const tweaks=Array.from({length:16},()=>({pitch:0,volume:60,filter:0,resonance:0,start:20,length:50,slices:{}}));
        localStorage.setItem('po33.meta',btoa(JSON.stringify({factoryRevision:1,bpm:120,swing:0,tweaks})));
        localStorage.setItem('po33.pat1',btoa(JSON.stringify(lanes)));localStorage.setItem('fx-test','1');
      }
      const saved=+localStorage.getItem('fx-saved-mode');
      if(saved){
        const m=JSON.parse(atob(localStorage.getItem('po33.meta')));
        m.extras=Array.from({length:16},()=>({effects:Array(16).fill(saved===14?0:saved),locks:{}}));
        if(saved===14)m.extras[0].effects[4]=14;
        localStorage.setItem('po33.meta',btoa(JSON.stringify(m)));
      }
      window.starts=[];window.voiceStops=[];window.fxBlocks=[];window.forwardBuffers={};window.meterPeaks=[];
      const meter=AnalyserNode.prototype.getFloatTimeDomainData;
      AnalyserNode.prototype.getFloatTimeDomainData=function(data){
        meter.call(this,data);meterPeaks.push(Math.max(...data.map(Math.abs)));
        if(meterPeaks.length>200)meterPeaks.shift();
      };
      const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.start=function(...args){
        const ch=this.buffer.getChannelData(0);
        if(this.buffer._po33id)forwardBuffers[this.buffer._po33id]=this.buffer;
        const normal=Object.values(forwardBuffers).find(b=>/-1$/.test(b._po33id));
        starts.push({time:args[0],offset:args[1],duration:args[2],rate:this.playbackRate.value,
          total:this.buffer.duration,first:ch[0],last:ch.at(-1),id:this.buffer._po33id,
          mirrored:normal && !this.buffer._po33id ? [123,456,789].every(i=>ch[i]===normal.getChannelData(0)[ch.length-1-i]) : null});
        return start.apply(this,args);
      };
      AudioBufferSourceNode.prototype.stop=function(...args){voiceStops.push(args[0]);return stop.apply(this,args);};
      const proc=AudioContext.prototype.createScriptProcessor;
      AudioContext.prototype.createScriptProcessor=function(...args){
        const node=proc.apply(this,args);
        const desc=Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype,'onaudioprocess');
        Object.defineProperty(node,'onaudioprocess',{set(fn){desc.set.call(node,e=>{
          fn(e);let peak=0;for(const x of e.outputBuffer.getChannelData(0))peak=Math.max(peak,Math.abs(x));
          fxBlocks.push(peak);if(fxBlocks.length>200)fxBlocks.shift();
        });}});
        return node;
      };
    ''')
    page.goto((root/'index.html').as_uri());page.wait_for_timeout(600);page.mouse.click(10,10)
    def down(sel,i=1):page.locator(sel).dispatch_event('pointerdown',{'pointerId':i,'button':0,'bubbles':True})
    def up(i=1):page.evaluate('i=>window.dispatchEvent(new PointerEvent("pointerup",{pointerId:i}))',i)
    def tap(sel,i=1):down(sel,i);up(i)
    def pad(n):return f'[data-pad="{n}"]'
    original=page.evaluate('localStorage.getItem("po33.pat1")')
    # First-ever FX has signal, and the history runs even before PLAY is used.
    tap(pad(1));page.wait_for_timeout(120)
    assert page.evaluate('fxBlocks.length')>0
    tap('[data-act="play"]');page.wait_for_timeout(150)
    down('[data-act="fx"]');down(pad(1),2);page.wait_for_timeout(150)
    assert max(page.evaluate('fxBlocks.slice(-5)'))>0
    up(2);up()
    page.wait_for_timeout(2100)
    # Master volume affects a frozen FX loop, and another pad's volume touch
    # must not release the FX pad that is still physically held.
    down('[data-act="fx"]');down(pad(1),2)
    down('#bpmMode',3);tap(pad(1),4);up(3)
    page.evaluate('meterPeaks=[]');page.wait_for_timeout(400)
    quiet=max(page.evaluate('meterPeaks'))
    assert page.locator('[data-pad="1"]').get_attribute('data-led-reason')=='effect'
    down('#bpmMode',3);tap(pad(16),4);up(3)
    page.evaluate('meterPeaks=[]');page.wait_for_timeout(400)
    loud=max(page.evaluate('meterPeaks'))
    assert loud>quiet*2,(quiet,loud)
    up(2);up()
    # All official numbers select the right label, process audio, and release.
    down('[data-act="fx"]')
    for n in range(1,16):
        down(pad(n),2)
        assert page.locator('#lcdNumber').get_attribute('data-value')==page.evaluate(f'PO33FX.codes[{n}]')
        assert page.locator('#hint').text_content()=='FX: '+page.evaluate(f'PO33FX.names[{n}]')
        page.wait_for_timeout(180)
        assert max(page.evaluate('fxBlocks.slice(-8)'))>0,n
        up(2)
        assert not page.locator('[data-led-reason="effect"]').count()
    up()
    # 14 resets the transport to actual step zero, cancels old lookahead voices.
    page.wait_for_timeout(450);down('[data-act="fx"]')
    page.evaluate('starts=[];voiceStops=[]');down(pad(14),2);page.wait_for_timeout(55)
    starts=page.evaluate('starts')
    assert starts and abs(min(starts,key=lambda v:v['time'])['rate']-2**(-5/12))<.00001,starts
    assert page.evaluate('voiceStops.length')>0
    assert 'cur' in page.locator('[data-pad="1"]').get_attribute('class')
    up(2);up()
    # Reverse uses a reversed buffer and the mirrored trimmed region, not a bar loop.
    down('[data-act="fx"]');page.evaluate('starts=[]');down(pad(15),2);page.wait_for_timeout(50)
    reverse=page.evaluate('starts')
    assert reverse,reverse
    for v in reverse:
        assert abs(v['offset']/v['total']-.4)<.001,v
        assert v.get('id') is None,v
        assert v['mirrored'],v
    up(2);up()
    # A held effect in write mode saves a span, rather than a single pressed step.
    tap('[data-act="write"]');down('[data-act="fx"]');down(pad(3),2)
    page.wait_for_timeout(450);up(2);up();page.wait_for_timeout(400)
    saved=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).extras[0].effects')
    assert saved.count(3)>=2,saved
    down('[data-act="fx"]');tap(pad(16),2);up();page.wait_for_timeout(400)
    cleared=page.evaluate('JSON.parse(atob(localStorage.getItem("po33.meta"))).extras[0].effects')
    assert all(v is None or v==16 for v in cleared),cleared
    tap('[data-act="play"]')
    assert page.evaluate('localStorage.getItem("po33.pat1")')==original
    # Saved FX13 moves notes onto a real triplet grid; it does not gate output.
    page.evaluate('localStorage.setItem("fx-saved-mode","13")')
    page.reload();page.wait_for_timeout(600);page.mouse.click(10,10)
    page.evaluate('starts=[]');tap('[data-act="play"]');page.wait_for_timeout(1950)
    starts=page.evaluate('starts.slice(0,16)')
    assert len(starts)==16,len(starts)
    gaps=[starts[i+1]['time']-starts[i]['time'] for i in range(15)]
    assert any(abs(t)<.001 for t in gaps),gaps
    assert any(abs(t-1/6)<.001 for t in gaps),gaps
    tap('[data-act="play"]');page.wait_for_timeout(250)
    assert not page.locator('[data-led-reason="effect"]').count()
    assert page.locator('#lcdPlay').get_attribute('fill')=='#222'
    # Saved retrigger and reverse use the same event/source paths as live FX.
    page.evaluate('localStorage.setItem("fx-saved-mode","14")');page.reload();page.wait_for_timeout(600);page.mouse.click(10,10)
    page.evaluate('starts=[]');tap('[data-act="play"]');page.wait_for_timeout(650)
    starts=page.evaluate('starts')
    assert len(starts)>=5 and abs(starts[4]['rate']-2**(-5/12))<.00001,starts
    tap('[data-act="play"]')
    page.evaluate('localStorage.setItem("fx-saved-mode","15")');page.reload();page.wait_for_timeout(600);page.mouse.click(10,10)
    page.evaluate('starts=[]');tap('[data-act="play"]');page.wait_for_timeout(450)
    starts=page.evaluate('starts');assert starts and all(abs(v['offset']/v['total']-.4)<.001 for v in starts),starts
    tap('[data-act="play"]')
    assert not errors,errors
    print('PASS: warm first FX, all official numbers and real audio, momentary release, 14 restarts/cancels lookahead, 15 mirrors per-sound trims, stored pattern unchanged, saved 13 changes actual note timing, stop clears automation. No JS errors.')
    browser.close()
