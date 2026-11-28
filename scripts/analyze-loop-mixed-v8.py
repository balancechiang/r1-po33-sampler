"""Offline Loop v8 marker extraction: hardware.wav before.f32 after.f32 report.json."""
from pathlib import Path
import sys,json,wave
import numpy as np
from scipy import signal
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=a.mean(1)
def origin(x,rate):
 e=signal.convolve(x*x,np.ones(round(rate*.01))/round(rate*.01),'same');return float(np.where(e>max(1e-8,e.max()*.001))[0][0]/rate)
def markers(x,rate,on,p):
 y=x[round((on+(p-1)*4)*rate):round((on+p*4)*rate)];e=np.sqrt(np.maximum(0,signal.convolve(y*y,np.ones(round(rate*.005))/round(rate*.005),'same')));ii,_=signal.find_peaks(e,height=e.max()*.1,prominence=e.max()*.07,distance=round(rate*.035));rows=[]
 for i in ii:
  q=y[i:min(len(y),i+round(rate*.04))];z=abs(np.fft.rfft(q*np.hanning(len(q)),16384));ff=np.fft.rfftfreq(16384,1/rate);ids=np.where((ff>160)&(ff<1200))[0];hz=float(ff[ids[z[ids].argmax()]]);rows.append({'time':float(i/rate),'slice':int(round((hz-220)/55))+1,'frequencyHz':hz})
 return rows
ho=origin(hw,r);report={'profile':'loops-v8','hardwareOnsetSeconds':ho,'quality':{'seconds':len(hw)/r,'peakDbFS':float(20*np.log10(abs(a).max())),'clippedSamples':int(np.sum(abs(a)>=32767/32768))},'hardwareMarkers':{str(p):markers(hw,r,ho,p) for p in range(1,17)},'browserComparisons':{},'scope':'Saved Loop1–4 interior markers and complete mixed-switch P15, matched within40ms. Marker matching is not waveform equivalence; extra artifacts and live gestures are not assessed.'}
for label,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');rate=json.loads(Path(file+'.json').read_text())['rate'];on=origin(web,rate);results=[]
 for p,start in [(2,1),(3,1),(4,1),(5,1),(6,1.25),(7,1.25),(8,1.25),(9,1.25),(11,1),(12,1),(13,1),(14,1),(15,0)]:
  actual=[m for m in report['hardwareMarkers'][str(p)] if start<=m['time']<start+(4 if p==15 else 2)];predicted=markers(web,rate,on,p);matched=[]
  for m in actual:
   nearest=min(predicted,key=lambda q:abs(q['time']-m['time']));matched.append({'hardwareTime':m['time'],'hardwareSlice':m['slice'],'webTime':nearest['time'],'webSlice':nearest['slice'],'match':abs(m['time']-nearest['time'])<.04 and m['slice']==nearest['slice']})
  results.append({'pattern':p,'matchedFraction':float(np.mean([m['match'] for m in matched])),'markers':matched})
 report['browserComparisons'][label]=results
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print({label:[(p['pattern'],p['matchedFraction']) for p in rows] for label,rows in report['browserComparisons'].items()})
