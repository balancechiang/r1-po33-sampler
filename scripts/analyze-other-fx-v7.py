"""Offline v7 analysis: hardware WAV, before.f32, after.f32, report.json.
Requires numpy/scipy. Only numerical results enter the repository.
"""
from pathlib import Path
import json,sys,wave
import numpy as np
from scipy import signal,optimize
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=a.mean(1)
def origin(x,rate):
 e=signal.convolve(x*x,np.ones(round(rate*.01))/round(rate*.01),'same');return np.where(e>max(1e-8,e.max()*.001))[0][0]/rate
def pulses(x,rate,on,p):
 y=x[round((on+(p-1)*4)*rate):round((on+p*4)*rate)];e=np.sqrt(np.maximum(0,signal.convolve(y*y,np.ones(round(rate*.005))/round(rate*.005),'same')));ii,_=signal.find_peaks(e,height=e.max()*.12,distance=round(.04*rate),prominence=e.max()*.08);result=[]
 for i in ii:
  q=y[i:min(len(y),i+round(.025*rate))];z=abs(np.fft.rfft(q*np.hanning(len(q)),8192));f=np.fft.rfftfreq(8192,1/rate);ids=np.where((f>250)&(f<750))[0];hz=float(f[ids[z[ids].argmax()]]);result.append({'time':float(i/rate),'frequencyHz':hz,'slice':int(np.argmin(abs(np.array([330,440,550,660])-hz)))+1})
 return result
def pitch(x,rate,t):
 a=x[round((t-.025)*rate):round((t+.025)*rate)].copy();a-=a.mean();a*=np.hanning(len(a));c=signal.correlate(a,a,method='fft')[len(a)-1:];ids,_=signal.find_peaks(c);ids=ids[(ids>rate/250)&(ids<rate/45)];i=ids[np.argmax(c[ids])];d=.5*(c[i-1]-c[i+1])/(c[i-1]-2*c[i]+c[i+1]);return rate/(i+d)
ho=origin(hw,r);probes=[];fits=[]
for p,sign,start in [(6,1,1),(7,-1,1),(13,1,1),(13,-1,2)]:
 ts=np.arange(start+.06,start+.25,.01);hz=np.array([pitch(hw,r,ho+(p-1)*4+t) for t in ts]);hz[hz<(100 if sign==1 else 52)]*=2;octaves=sign*np.log2(hz/110);v=(octaves>0)&(octaves<1.05)
 b=optimize.least_squares(lambda b:b[0]*(ts[v]-start)+b[1]-octaves[v],[4,-.03],loss='soft_l1',f_scale=.01).x
 fits.append({'pattern':p,'start':start,'direction':sign,'durationSeconds':float(1/b[0]),'onsetOffsetSeconds':float(-b[1]/b[0])})
 probes.extend({'pattern':p,'time':float(t),'hz':float(f),'direction':sign} for t,f in zip(ts,hz))
report={'profile':'other-fx-v7','hardwareOnsetSeconds':float(ho),'quality':{'seconds':len(hw)/r,'peakDbFS':float(20*np.log10(abs(a).max())),'clippedSamples':int(np.sum(abs(a)>=32767/32768))},'glideFits':fits,'glideProbes':probes,'hardwarePulses':{str(p):pulses(hw,r,ho,p) for p in [1,2,3,4,5,10,15,16]},'browserComparisons':{},'shutterMeasurements':[]}
for pattern in [8,9]:
 y=hw[round((ho+(pattern-1)*4)*r):round((ho+pattern*4)*r)];env=np.sqrt(np.maximum(0,signal.convolve(y*y,np.ones(round(r*.01))/round(r*.01),'same')));mask=env>np.median(env[:round(.8*r)])*.25;rise=np.where((~mask[:-1])&mask[1:])[0]/r;rise=rise[(rise>1.05)&(rise<2.95)]
 report['shutterMeasurements'].append({'pattern':pattern,'risingEdges':rise.tolist(),'medianPeriodSeconds':float(np.median(np.diff(rise)))})
for label,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');rate=json.loads(Path(file+'.json').read_text())['rate'];on=origin(web,rate);errors=[]
 for p in probes:
  hz=pitch(web,rate,on+(p['pattern']-1)*4+p['time']);hz=hz*2 if hz<(100 if p['direction']==1 else 52) else hz;errors.append(float(abs(1200*np.log2(hz/p['hz']))))
 report['browserComparisons'][label]={'medianGlideErrorCents':float(np.median(errors)),'pulses':{str(p):pulses(web,rate,on,p) for p in [10,15]}}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print('glide fits',fits);print('median pitch errors',{k:v['medianGlideErrorCents'] for k,v in report['browserComparisons'].items()})
