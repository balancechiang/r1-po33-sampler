"""Two-tempo hardware marker audit; fits measured clock before source-ID comparisons.
Usage: python scripts/analyze-clock-v17.py capture-root report.json
No private audio is included in the report.
"""
import json, sys, wave
from pathlib import Path
import numpy as np
from scipy import signal

def audit(folder, bpm, browser=None):
 meta=json.loads((folder/'active-recording.json').read_text())
 assert meta['status']=='saved'
 file=Path(meta['file']);assert not Path(str(file)+'.cancelled.json').exists()
 if browser:
  r=json.loads(Path(str(browser)+'.json').read_text())['rate'];a=np.fromfile(browser,'<f4').astype(float).reshape(-1,1)
 else:
  with wave.open(str(file)) as w:
   r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
 x=a.mean(1)
 env=np.sqrt(np.maximum(0,signal.convolve(x*x,np.ones(round(r*.005))/round(r*.005),'same')))
 peaks=signal.find_peaks(env,height=env.max()*.075,prominence=env.max()*.055,distance=round(r*.025))[0]
 times=peaks/r
 # Initial dry bar has sixteen consecutive short, separated markers.
 step=15/bpm;initial=times[0]
 for i in range(len(times)-16):
  if np.max(abs(np.diff(times[i:i+16])-step))<step*.06:
   initial=times[i];break
 # Refit against dry references P01/P09 in each of two passes. Iterate to absorb drift.
 intercept=initial;slope=step;residual=[]
 for _ in range(3):
  xx=[];yy=[]
  for cycle in range(2):
   for p in [1,9]:
    for s in range(16):
     n=cycle*256+(p-1)*16+s;t=intercept+slope*n
     j=int(np.argmin(abs(times-t)))
     if abs(times[j]-t)<step*.2:xx.append(n);yy.append(times[j])
  slope,intercept=np.polyfit(xx,yy,1);residual=np.array(yy)-(intercept+slope*np.array(xx))
 def source(t):
  i=round(t*r);y=x[i:i+round(r*.022)]
  z=abs(np.fft.rfft(y*np.hanning(len(y)),32768));f=np.fft.rfftfreq(32768,1/r)
  keep=np.flatnonzero((f>180)&(f<1100));hz=float(f[keep[np.argmax(z[keep])]])
  return int(round((hz-220)/55))+1
 rows=[]
 for c in range(2):
  for p in [2,3,4,5,7,8,10,11,12,13,15,16]:
   shift=(p-2)%8 if p in [2,3,4,5,10,11,12,13] else 0
   for extra in [0,8]:
    start=shift+extra;n=c*256+(p-1)*16+start;ids=[];offsets=[]
    for k in range(4):
     target=intercept+slope*(n+k);j=int(np.argmin(abs(times-target)));err=float(times[j]-target)
     ids.append(source(times[j]) if abs(err)<step*.2 else None);offsets.append(round(err*1000,3))
    rows.append({'cycle':c,'pattern':p,'startStep':start+1,'sourceIDs':ids,'peakOffsetMs':offsets,'expectedIDs':list(range(start+1,start+5))})
 pairs={}
 for row in rows:pairs.setdefault((row['pattern'],row['startStep']),[]).append(row)
 differences=[{'pattern':p,'startStep':s,'pass0':v[0]['sourceIDs'],'pass1':v[1]['sourceIDs']} for (p,s),v in pairs.items() if v[0]['sourceIDs']!=v[1]['sourceIDs']]
 return {'bpm':bpm,'quality':{'seconds':len(x)/r,'clippedSamples':int((abs(a)>=32767/32768).sum())},'clock':{'firstMarkerPeakSeconds':intercept,'measuredStepSeconds':slope,'measuredBPM':15/slope,'dryFitMaxResidualMs':float(max(abs(residual))*1000),'dryFitPoints':len(xx)},'windows':rows,'differentBetweenPasses':differences}

root=Path(sys.argv[1]);report={'profile':'clock-phase-v17','tempos':[audit(root/f'{b}BPM',b) for b in [90,137]],'scope':'Measured source identities at step-boundary peaks; timing fit uses dry reference bars. Does not prove firmware reset ordering.'}
if len(sys.argv)>3:
 for q in report['tempos']:
  b=q['bpm'];web=audit(root/f'{b}BPM',b,Path(sys.argv[3])/f'web-clock-v17-{b}.f32')
  q['browserClock']=web['clock'];q['browserWindows']=web['windows']
  for bank in [0,8]:
   pairs=[(h,w) for h,w in zip(q['windows'],web['windows']) if bank<h['pattern']<=bank+8]
   q.setdefault('browserAgreement',[]).append({'sliceDurationMs':55 if bank==0 else 160,'stepSourcesMatching':sum(a==b for h,w in pairs for a,b in zip(h['sourceIDs'],w['sourceIDs'])),'totalStepSources':len(pairs)*4})
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n')
for q in report['tempos']:
 print(q['bpm'],q['clock'],'pass differences',len(q['differentBetweenPasses']))
 for bank in [0,8]:
  rows=[w for w in q['windows'] if bank<w['pattern']<=bank+8]
  print('bank',bank,'non-sequential',sum(w['sourceIDs']!=w['expectedIDs'] for w in rows),'/',len(rows))
 print(q['differentBetweenPasses'])
