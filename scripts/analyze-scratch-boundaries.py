"""Scratch v5 hardware/browser comparison. Private WAV/f32 captures are input arguments.
Usage: python scripts/analyze-scratch-boundaries.py hardware.wav before.f32 after.f32 output.json
Requires numpy/scipy for offline analysis only. No raw audio is stored in the report.
"""
from pathlib import Path
import sys,json,wave
import numpy as np
from scipy import signal

def track(x,rate):
 f,t,z=signal.stft(x,rate,nperseg=4096,noverlap=3072)
 a=np.log(abs(z)+1e-12);ids=np.where((f>180)&(f<4000))[0];k=ids[np.argmax(a[ids],axis=0)];j=np.arange(len(k))
 den=a[k-1,j]-2*a[k,j]+a[k+1,j]
 d=np.divide(.5*(a[k-1,j]-a[k+1,j]),den,out=np.zeros(len(k)),where=abs(den)>1e-12)
 return t,(k+np.clip(d,-.5,.5))*rate/4096,np.max(abs(z[ids]),axis=0)
def onset(x,rate):
 energy=np.convolve(x*x,np.ones(round(.01*rate))/round(.01*rate),'same')
 rough=np.where(energy>max(1e-8,float(energy.max())*.0005))[0][0]/rate
 start=max(0,rough-.15);t,f,_=track(x[round(start*rate):round((start+2.5)*rate)],rate)
 v=(t>.5)&(t<2)
 return float(np.median(start+t[v]-np.log(f[v]/220)/(np.log(16)/4)))
def rms(x):return float(np.sqrt(np.mean(x*x)))
with wave.open(sys.argv[1],'rb') as w:
 assert w.getsampwidth()==2
 rate=w.getframerate();hw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).mean(1)/32768
ho=onset(hw,rate)
report={'profile':'scratch-boundaries-v5','hardwareOnsetSeconds':ho,'bpm':60,'notes':'Frequency comparisons exclude reversal/step boundaries and silence. Occupancy compares selected windows to each recording dry reference. Not an exact phase/transient fit.','results':{}}
for label,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=onset(web,wr);rows=[]
 for p in [2,3,4,5,6,8,9,11,12,14,15,16]:
  h=hw[round((ho+(p-1)*4)*rate):round((ho+p*4)*rate)];v=web[round((wo+(p-1)*4)*wr):round((wo+p*4)*wr)]
  t,hf,ha=track(h,rate);tw,vf,va=track(v,wr)
  if p in [3,4,5]:
   # These complete tails are silent on hardware; old playback incorrectly revived them.
   hr=rms(h[round(1.4*rate):round(3.5*rate)]);vr=rms(v[round(1.4*wr):round(3.5*wr)])
   href=rms(hw[round((ho+.2)*rate):round((ho+.7)*rate)]);vref=rms(web[round((wo+.2)*wr):round((wo+.7)*wr)])
   rows.append({'pattern':p,'kind':'silent-tail','hardwareRelativeDb':float(20*np.log10(max(hr/href,1e-12))),'webRelativeDb':float(20*np.log10(max(vr/vref,1e-12)))})
  else:
   points=np.arange(1.065,2.95,.025) if p in [8,9,11,12] else np.arange(2.065,2.35,.025) if p in [14,15] else np.arange(1.065,2.95,.025)
   phase=points%.125;points=points[(phase>.035)&(phase<.09)]
   a=np.interp(points,t,hf);b=np.interp(points,tw,vf);amp=np.interp(points,tw,va);valid=amp>max(1e-7,float(va.max())*.015)
   errors=abs(1200*np.log2(b/a));rows.append({'pattern':p,'kind':'chirp','samples':len(points),'audibleFraction':float(valid.mean()),'medianPitchErrorCents':float(np.median(errors[valid])) if valid.any() else None})
 report['results'][label]={'webOnsetSeconds':wo,'patterns':rows}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
