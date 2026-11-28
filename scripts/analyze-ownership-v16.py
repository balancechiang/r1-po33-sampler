"""V16 two-pass slot/owner/trim and Loop-phase audit.
Usage: hardware.wav before.f32 after.f32 report.json. Offline numpy/scipy only.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal

def origin(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');active=e>max(1e-8,e.max()*.001);edges=np.diff(np.r_[False,active,False].astype(int));runs=zip(np.flatnonzero(edges==1),np.flatnonzero(edges==-1));return float(next(a/r for a,b in runs if b-a>r))
def seg(x,r,on,p,a,b,c=0):return x[round((on+c*64+(p-1)*4+a)*r):round((on+c*64+(p-1)*4+b)*r)]
def rms(y):return float(np.sqrt(np.mean(y*y)))
def markers(y,r):
 e=np.sqrt(np.maximum(0,signal.convolve(y*y,np.ones(round(r*.005))/round(r*.005),'same')));ii=signal.find_peaks(e,height=e.max()*.1,prominence=e.max()*.07,distance=round(r*.035))[0];rows=[]
 for i in ii:
  a=y[i:i+round(r*.04)];z=abs(np.fft.rfft(a*np.hanning(len(a)),16384));f=np.fft.rfftfreq(16384,1/r);ids=np.flatnonzero((f>160)&(f<1200));hz=f[ids[np.argmax(z[ids])]];rows.append({'time':float(i/r),'slice':int(round((hz-220)/55))+1})
 return rows
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
x=a.mean(1);on=origin(x,r);report={'profile':'ownership-phase-v16','quality':{'seconds':len(x)/r,'programOnsetSeconds':on,'peakDbFS':float(20*np.log10(abs(a).max())),'clippedSamples':int((abs(a)>=32767/32768).sum())},'sourceCases':[{'slot':1,'owner':0,'start':'zero'},{'slot':2,'owner':0,'start':'zero'},{'slot':3,'owner':0,'start':'later'},{'slot':4,'owner':0,'start':'later'},{'slot':5,'owner':4,'start':'zero'},{'slot':6,'owner':4,'start':'zero'}],'hardwareRelease':[],'loopWindows':[],'browserComparisons':{},'scope':'Two passes, one native saved5→6→off route; not a proven general firmware mechanism or live/edited-project rule. Program onset uses the first sustained1s+ signal to reject a short pre-play transient.'}
for c in [0,1]:
 for p in range(2,8):
  before=rms(seg(x,r,on,p,2.15,2.35,c));after=rms(seg(x,r,on,p,2.6,2.85,c));report['hardwareRelease'].append({'cycle':c,'pattern':p,'slot':p-1,'beforeRms':before,'afterRms':after,'continues':after>max(5e-5,before*.03)})
 for p,shift in [(9,0),(10,.25),(11,.5),(12,.75),(14,0),(16,0)]:
  for extra in [0,2]:report['loopWindows'].append({'cycle':c,'pattern':p,'start':shift+extra,'markers':markers(seg(x,r,on,p,shift+extra,shift+extra+1,c),r)})
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=origin(web,wr);rows=[]
 for q in report['hardwareRelease']:
  p=q['pattern'];before=rms(seg(web,wr,wo,p,2.15,2.35));after=rms(seg(web,wr,wo,p,2.6,2.85));present=after>max(5e-5,before*.03);rows.append({'cycle':q['cycle'],'pattern':p,'continues':present,'matches':bool(present==q['continues'])})
 report['browserComparisons'][name]={'releaseCases':rows,'releaseMatches':sum(q['matches'] for q in rows),'totalReleaseCases':len(rows)}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['quality']);print([(q['cycle'],q['slot'],q['continues']) for q in report['hardwareRelease']]);print({n:q['releaseMatches'] for n,q in report['browserComparisons'].items()})
