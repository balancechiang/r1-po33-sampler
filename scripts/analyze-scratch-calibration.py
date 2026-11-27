"""Compare Scratch v4 chirp trajectories. Raw captures are private inputs, never fixtures.
Usage: python scripts/analyze-scratch-calibration.py hardware.wav before.f32 after.f32 output.json
Each .f32 needs a sibling .f32.json containing its sample rate.
"""
from pathlib import Path
import sys,json,wave
import numpy as np
from scipy import signal

def track(x,rate):
 f,t,z=signal.stft(x,rate,nperseg=4096,noverlap=3072)
 a=np.log(abs(z)+1e-12);ids=np.where((f>180)&(f<4000))[0]
 k=ids[np.argmax(a[ids],axis=0)];j=np.arange(len(k))
 denominator=a[k-1,j]-2*a[k,j]+a[k+1,j]
 d=np.divide(.5*(a[k-1,j]-a[k+1,j]),denominator,out=np.zeros(len(k)),where=abs(denominator)>1e-12)
 return t,(k+np.clip(d,-.5,.5))*rate/4096,np.max(abs(z[ids]),axis=0)
def onset(x,rate):
 energy=np.convolve(x*x,np.ones(round(.01*rate))/round(.01*rate),'same')
 rough=np.where(energy>max(1e-8,float(energy.max())*.0005))[0][0]/rate
 start=max(0,rough-.15);t,f,_=track(x[round(start*rate):round((start+1)*rate)],rate)
 v=(t>.35)&(t<.8)
 return float(np.median(start+t[v]-np.log(f[v]/220)/(np.log(16)/2)))
with wave.open(sys.argv[1],'rb') as w:
 assert w.getsampwidth()==2
 rate=w.getframerate();hardware=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).mean(1)/32768
origin=onset(hardware,rate)
report={'profile':'scratch-v4','hardwareOnsetSeconds':origin,'bpm':60,'notes':'Dominant-frequency error on effect-interior chirp windows only; missing energy reported separately. Not phase, boundary, release or drum calibration.','results':{},'hardwareProbes':[]}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=onset(web,wr);rows=[]
 for pattern in [2,3,4,5,8,9,11,12]:
  p=pattern-1
  t,h,ha=track(hardware[round((origin+p*4)*rate):round((origin+(p+1)*4)*rate)],rate)
  tw,v,va=track(web[round((wo+p*4)*wr):round((wo+(p+1)*4)*wr)],wr)
  points=np.arange(1.07,2.95,.025);half=.25 if pattern in [2,4,8,11] else .125
  phase=points%half;points=points[(phase>.04)&(phase<half-.04)]
  hf=np.interp(points,t,h);vf=np.interp(points,tw,v);amplitude=np.interp(points,tw,va)
  if name=='after':
   for point,hz in zip(points,hf):report['hardwareProbes'].append({'pattern':pattern,'seconds':float(point),'frequencyHz':float(hz)})
  valid=amplitude>max(float(va.max())*.015,1e-7)
  errors=np.abs(1200*np.log2(vf/hf))
  rows.append({'pattern':pattern,'samples':len(points),'audibleFraction':float(valid.mean()),'medianPitchErrorCents':float(np.median(errors[valid])) if valid.any() else None})
 report['results'][name]={'webOnsetSeconds':wo,'patterns':rows}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
