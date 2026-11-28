"""v12 held Loop3 and matched-storage audit. hardware.wav before.f32 after.f32 report.json.
Offline numpy/scipy only. Does not copy private audio into the repository.
"""
import json,sys,wave
from pathlib import Path
import numpy as np
from scipy import signal

def origin(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
def track(x,r):
 f,t,z=signal.stft(x,r,nperseg=2048,noverlap=1920);a=np.log(abs(z)+1e-12);ids=np.flatnonzero((f>150)&(f<1000));ii=ids[np.argmax(a[ids],axis=0)];j=np.arange(len(ii));den=a[ii-1,j]-2*a[ii,j]+a[ii+1,j];d=np.divide(.5*(a[ii-1,j]-a[ii+1,j]),den,out=np.zeros(len(ii)),where=abs(den)>1e-10)
 return t,(ii+np.clip(d,-.5,.5))*r/2048,np.max(abs(z[ids]),axis=0)
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=raw.mean(1);ho=origin(hw,r);probes=[];tracks={}
for p in range(1,17):
 y=hw[round((ho+(p-1)*4)*r):round((ho+p*4)*r)];tracks[p]=track(y,r)
 if p<13:continue
 start,end=(1,2.5) if p==13 else (.5,1.5)
 for at in np.arange(start+.06,end,.125):
  t,f,a=tracks[p];probes.append({'pattern':p,'time':float(at),'frequencyHz':float(np.interp(at,t,f)),'amplitude':float(np.interp(at,t,a))})
report={'profile':'unison-memory-v12','quality':{'seconds':len(hw)/r,'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int((abs(raw)>=32767/32768).sum())},'hardwareOnsetSeconds':ho,'heldLoop3Probes':probes,'storagePairs':[],'comparisons':{},'scope':'Saved60BPM held-source Loop3 interior probes and matched-content hardware pairs; not complete mixed-FX, gain/phase or live-gesture equivalence.'}
for left,right in [(1,2),(3,4),(5,6),(7,8),(9,10),(15,16)]:
 ts=np.arange(.1,1.9,.02);tl,fl,al=tracks[left];tr,fr,ar=tracks[right];a=np.interp(ts,tl,fl);b=np.interp(ts,tr,fr);report['storagePairs'].append({'patterns':[left,right],'medianDominantFrequencyDifferenceCents':float(np.median(abs(1200*np.log2(a/b))))})
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 x=np.fromfile(file,'<f4');r=json.loads(Path(file+'.json').read_text())['rate'];on=origin(x,r);rows=[]
 for p in range(13,17):
  y=x[round((on+(p-1)*4)*r):round((on+p*4)*r)];t,f,a=track(y,r);q=[v for v in probes if v['pattern']==p];errors=[]
  for v in q:
   if np.interp(v['time'],t,a)>max(1e-7,a.max()*.02):errors.append(float(abs(1200*np.log2(np.interp(v['time'],t,f)/v['frequencyHz']))))
  rows.append({'pattern':p,'hardwareProbes':len(q),'audibleProbes':len(errors),'medianPitchErrorCents':float(np.median(errors)) if errors else None})
 report['comparisons'][name]=rows
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['comparisons']);print(report['storagePairs'])
