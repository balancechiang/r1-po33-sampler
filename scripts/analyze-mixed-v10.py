"""Compare v10 held Reverse against actual browser output; private audio stays external.
Usage: python scripts/analyze-mixed-v10.py hardware.wav before.f32 after.f32 report.json
Requires numpy/scipy for offline measurement only.
"""
import json,sys,wave
from pathlib import Path
import numpy as np
from scipy import signal

def onset(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same')
 return np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r

def track(x,r):
 f,t,z=signal.stft(x,r,nperseg=4096,noverlap=3840)
 a=np.log(abs(z)+1e-12);ids=np.flatnonzero((f>180)&(f<650));ii=ids[np.argmax(a[ids],axis=0)];j=np.arange(len(ii))
 den=a[ii-1,j]-2*a[ii,j]+a[ii+1,j]
 d=np.divide(.5*(a[ii-1,j]-a[ii+1,j]),den,out=np.zeros(len(ii)),where=abs(den)>1e-10)
 return t,(ii+np.clip(d,-.5,.5))*r/4096

with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=raw.mean(1);ho=onset(hw,r);times=np.arange(1.1,1.9,.05)
y=hw[round((ho+32)*r):round((ho+36)*r)];t,f=track(y,r);reference=np.interp(times,t,f)
report={'profile':'mixed-voices-v10','quality':{'seconds':len(hw)/r,'sampleRate':r,'channels':raw.shape[1],'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int(np.sum(abs(raw)>=32767/32768))},'hardwareOnsetSeconds':float(ho),'reverseProbeTimesSeconds':times.tolist(),'hardwareFrequencyHz':reference.tolist(),'hardwareTailRmsAfterOrigin':float(np.sqrt(np.mean(y[round(2.15*r):round(2.8*r)]**2))),'comparisons':{},'scope':'P09 ringing-source Reverse, 1.1–1.9 seconds, before the source reaches its origin. Other mixed FX and allocation remain unresolved; no bit-exact or live hardware claim.'}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=onset(web,wr)
 y=web[round((wo+32)*wr):round((wo+36)*wr)];t,f=track(y,wr);freq=np.interp(times,t,f)
 report['comparisons'][name]={'frequencyHz':freq.tolist(),'medianPitchErrorCents':float(np.median(abs(1200*np.log2(freq/reference)))),'tailRmsAfterOrigin':float(np.sqrt(np.mean(y[round(2.15*wr):round(2.8*wr)]**2)))}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n')
print({k:{a:b for a,b in v.items() if a!='frequencyHz'} for k,v in report['comparisons'].items()})
