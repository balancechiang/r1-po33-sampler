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
hw=raw.mean(1);ho=onset(hw,r);report={'profile':'loop-mixed-v10','comparisons':{},'scope':'Single held chirp entering saved Loop1→2 and Loop3→4. Before is a historical pre-v12 capture, not the immediate pre-change baseline. Interior frequency/coverage only; not arbitrary mixed notes, live gestures or waveform equivalence.'}
references={}
for p in [2,3]:
 y=hw[round((ho+(p-1)*4)*r):round((ho+p*4)*r)];t,f=track(y,r);times=np.arange(1.06,3.8,.08);references[p]=(times,np.interp(times,t,f))
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=onset(web,wr);rows=[]
 for p,(times,reference) in references.items():
  y=web[round((wo+(p-1)*4)*wr):round((wo+p*4)*wr)];t,f=track(y,wr);errors=abs(1200*np.log2(np.interp(times,t,f)/reference));rms=[]
  for at in times:
   z=y[round((at-.01)*wr):round((at+.01)*wr)];rms.append(float(np.sqrt(np.mean(z*z))))
  active=np.array(rms)>1e-5;rows.append({'pattern':p,'probes':len(times),'audibleProbes':int(active.sum()),'medianPitchErrorCents':float(np.median(errors[active])) if active.any() else None})
 report['comparisons'][name]=rows
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['comparisons'])
