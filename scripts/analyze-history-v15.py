"""V15 history/termination/gain audit: hardware.wav before.f32 [after.f32] report.json.
Offline numpy/scipy only. Private audio is not copied into the repository.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal

def origin(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
def segment(x,r,on,p,a,b,cycle=0):return x[round((on+cycle*64+(p-1)*4+a)*r):round((on+cycle*64+(p-1)*4+b)*r)]
def rms(x):return float(np.sqrt(np.mean(x*x)))
def markers(y,r):
 e=np.sqrt(np.maximum(0,signal.convolve(y*y,np.ones(round(r*.005))/round(r*.005),'same')));ii=signal.find_peaks(e,height=e.max()*.1,prominence=e.max()*.07,distance=round(r*.035))[0];rows=[]
 for i in ii:
  a=y[i:i+round(r*.04)];z=abs(np.fft.rfft(a*np.hanning(len(a)),16384));f=np.fft.rfftfreq(16384,1/r);ids=np.flatnonzero((f>160)&(f<1200));hz=f[ids[np.argmax(z[ids])]];rows.append({'time':float(i/r),'slice':int(round((hz-220)/55))+1})
 return rows
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
x=raw.mean(1);on=origin(x,r);report={'profile':'history-boundaries-v15','quality':{'seconds':len(x)/r,'onsetSeconds':on,'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int((abs(raw)>=32767/32768).sum())},'loopProbes':[],'soundProbes':[],'browserComparisons':{},'scope':'Two hardware passes of byte-identical probes; single-note FX5 wet/dry RMS and switch-release presence. No general phase or physical-address explanation is established.'}
for cycle in [0,1]:
 for p in [2,4,6,8]:report['loopProbes'].append({'cycle':cycle,'pattern':p,'firstSecondMarkers':markers(segment(x,r,on,p,0,1,cycle),r)})
 for wet,dry in [(10,9),(12,11),(14,13),(16,15)]:
  dryR=rms(segment(x,r,on,dry,.7,1.35,cycle));wetR=rms(segment(x,r,on,wet,.7,1.35,cycle));before=rms(segment(x,r,on,wet,2.15,2.35,cycle));after=rms(segment(x,r,on,wet,2.6,2.85,cycle))
  report['soundProbes'].append({'cycle':cycle,'pattern':wet,'dryPattern':dry,'fx5WetDryDB':float(20*np.log10(wetR/dryR)),'beforeReleaseRms':before,'afterReleaseRms':after,'continuesAfterRelease':after>max(5e-5,before*.03)})
files=[('before',sys.argv[2])]+([('after',sys.argv[3])] if len(sys.argv)>4 else [])
for name,file in files:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=origin(web,wr);rows=[]
 for q in report['soundProbes']:
  wet=q['pattern'];dry=q['dryPattern'];db=float(20*np.log10(rms(segment(web,wr,wo,wet,.7,1.35))/rms(segment(web,wr,wo,dry,.7,1.35))));after=rms(segment(web,wr,wo,wet,2.6,2.85));before=rms(segment(web,wr,wo,wet,2.15,2.35));rows.append({'cycle':q['cycle'],'pattern':wet,'fx5WetDryDB':db,'gainErrorDB':db-q['fx5WetDryDB'],'continuesAfterRelease':after>max(5e-5,before*.03),'releasePresenceMatches':bool((after>max(5e-5,before*.03))==q['continuesAfterRelease'])})
 report['browserComparisons'][name]={'rows':rows,'medianAbsoluteGainErrorDB':float(np.median([abs(q['gainErrorDB']) for q in rows]))}
Path(sys.argv[-1]).write_text(json.dumps(report,indent=2)+'\n');print(report['quality']);print([(q['cycle'],q['pattern'],round(q['fx5WetDryDB'],2),q['continuesAfterRelease']) for q in report['soundProbes']]);print({n:v['medianAbsoluteGainErrorDB'] for n,v in report['browserComparisons'].items()})
