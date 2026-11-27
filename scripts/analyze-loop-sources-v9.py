"""Measure v9 saved source readers: hardware.wav before.f32 after.f32 report.json.
Private audio is input only. Offline analysis requires numpy/scipy.
"""
from pathlib import Path
import sys,json,wave
import numpy as np
from scipy import signal
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=a.mean(1)
def origin(x,rate):
 e=signal.convolve(x*x,np.ones(round(rate*.01))/round(rate*.01),'same');return float(np.where(e>max(1e-8,e.max()*.001))[0][0]/rate)
def track(x,rate):
 f,t,z=signal.stft(x,rate,nperseg=2048,noverlap=1792);a=np.log(abs(z)+1e-12);ids=np.where((f>180)&(f<2000))[0];ii=ids[np.argmax(a[ids],0)];j=np.arange(len(ii));den=a[ii-1,j]-2*a[ii,j]+a[ii+1,j];d=np.divide(.5*(a[ii-1,j]-a[ii+1,j]),den,out=np.zeros(len(ii)),where=abs(den)>1e-10)
 return t,(ii+np.clip(d,-.5,.5))*rate/2048,np.max(abs(z[ids]),0)
def ending(x,rate):
 e=np.sqrt(np.maximum(0,signal.convolve(x*x,np.ones(round(rate*.005))/round(rate*.005),'same')));ids=np.where(e>max(1e-7,e.max()*.02))[0];return float(ids[-1]/rate) if len(ids) else 0
ho=origin(hw,r);probes=[];ends=[]
for pattern in range(5,17):
 kind=[1,2,4][(pattern-5)//4];period={1:.25,2:1/3,4:1/12}[kind];span=[.16,.4,1,2][(pattern-1)%4]
 y=hw[round((ho+(pattern-1)*4)*r):round((ho+pattern*4)*r)];t,f,amp=track(y,r);ends.append({'pattern':pattern,'kind':kind,'span':span,'hardwareEndSeconds':ending(y,r)})
 for at in np.arange(.04,3.7,.04):
  if at%period<.025 or at%period>period-.025:continue
  hz=float(np.interp(at,t,f));power=float(np.interp(at,t,amp));active=power>max(1e-7,amp.max()*.02)
  probes.append({'pattern':pattern,'kind':kind,'span':span,'time':float(at),'active':bool(active),'frequencyHz':hz if active else None})
report={'profile':'loop-sources-v9','hardwareOnsetSeconds':ho,'quality':{'seconds':len(hw)/r,'sampleRate':r,'channels':a.shape[1],'peakDbFS':float(20*np.log10(abs(a).max())),'clippedSamples':int(np.sum(abs(a)>=32767/32768))},'sourceProbes':probes,'endings':ends,'browserComparisons':{},'scope':'Saved60BPM loops, non-boundary single-source probes; not waveform, gain or live-gesture equivalence.'}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');rate=json.loads(Path(file+'.json').read_text())['rate'];on=origin(web,rate);rows=[]
 for pattern in range(5,17):
  y=web[round((on+(pattern-1)*4)*rate):round((on+pattern*4)*rate)];t,f,amp=track(y,rate);points=[p for p in probes if p['pattern']==pattern and p['active']];errors=[];present=0
  for q in points:
   if np.interp(q['time'],t,amp)<=max(1e-7,amp.max()*.02):continue
   present+=1;errors.append(float(abs(1200*np.log2(np.interp(q['time'],t,f)/q['frequencyHz']))))
  rows.append({'pattern':pattern,'activeHardwareProbes':len(points),'audibleFraction':present/len(points) if points else None,'medianPitchErrorCents':float(np.median(errors)) if errors else None,'webEndSeconds':ending(y,rate)})
 report['browserComparisons'][name]=rows
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print({name:[(q['pattern'],round(q['audibleFraction'],3) if q['audibleFraction'] is not None else None,round(q['medianPitchErrorCents'],1) if q['medianPitchErrorCents'] is not None else None) for q in rows] for name,rows in report['browserComparisons'].items()})
