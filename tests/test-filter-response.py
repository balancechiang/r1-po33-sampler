"""Desktop/tablet shell, input-specific hints, current-page QR and compact fallback."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
  import json,math,statistics
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def instrument(route):
   response=route.fetch();code=response.text().rsplit('})();',1)[0]+"window.testFilterControls=(value,res)=>{const c=ctx(),g=c.createGain();voiceTweak={pitch:0,volume:100,filter:value,resonance:res};const nodes=connectVoice(g,1,c.currentTime);return {q:nodes.low.Q.value,gain:nodes.volume.gain.value};};})();";route.fulfill(response=response,body=code)
  page.route('**/app.js*',instrument);page.goto(base);page.wait_for_function('document.body.dataset.loading==="false"')
  data=json.loads((root/'tests/fixtures/filter-hardware-response-20261127.json').read_text())
  results=page.evaluate('''async data=>{
   const output=[];
   for(const rate of [44100,48000,96000]){
    const c=new AudioContext({sampleRate:rate}),f=c.createBiquadFilter(),freq=Float32Array.from(data.frequencies),mag=new Float32Array(freq.length),phase=new Float32Array(freq.length);
    for(const row of data.rows){if(!row.steady)continue;
     const value=row.filter===63?0:row.filter<=31?-100+(row.filter-1)*95/30:5+(row.filter-32)*95/30,res=(row.resonance-1)/62*100,s=PO33Sampling.filterShape(value,rate,res);
     f.type=s.type;f.frequency.value=s.frequency;f.Q.value=20*Math.log10(s.q);f.getFrequencyResponse(freq,mag,phase);
     const err=[];row.usable.forEach((yes,i)=>{if(yes)err.push((s.bypass?0:20*Math.log10(mag[i]*s.gain))-row.db[i]);});
     output.push({rate,code:row.filter,res:row.resonance,rms:Math.sqrt(err.reduce((a,b)=>a+b*b,0)/err.length)});
    }await c.close();
   }return output;
  }''',data)
  rms=[v['rms'] for v in results];assert statistics.median(rms)<.3
  for row in results:assert row['rms']<(3 if row['code']==1 else 1.2),row
  for value,res in [(-50,0),(-50,100),(30,50)]:
   expected=page.evaluate('a=>PO33Sampling.filterShape(a[0],new AudioContext().sampleRate,a[1])',[value,res])
   controls=page.evaluate('a=>testFilterControls(a[0],a[1])',[value,res])
   assert abs(controls['q']-20*math.log10(expected['q']))<.0001
   assert abs(controls['gain']-expected['gain'])<.0001
  assert not errors,errors
  print('PASS actual browser biquad response: median %.3f dB; 31/32 mapping, Q dB units and filter gain checked'%statistics.median(rms))
  browser.close()
finally:server.shutdown();server.server_close()
