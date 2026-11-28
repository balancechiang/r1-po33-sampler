"""V14 low-reader fit and dry-release comparison. hardware.wav before.f32 after.f32 report.json
Offline numpy/scipy; private PCM remains external.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal

def origin(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
def track(x,r,lo,hi,n=4096):
 f,t,z=signal.stft(x,r,nperseg=n,noverlap=n-128);a=np.log(abs(z)+1e-14);ids=np.flatnonzero((f>lo)&(f<hi));ix=ids[np.argmax(a[ids],axis=0)];j=np.arange(len(ix));den=a[ix-1,j]-2*a[ix,j]+a[ix+1,j];d=np.divide(.5*(a[ix-1,j]-a[ix+1,j]),den,out=np.zeros(len(ix)),where=abs(den)>1e-12)
 return t,(ix+np.clip(d,-.5,.5))*r/n
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
hw=raw.mean(1);ho=origin(hw,r);k=np.log(2)/3
report={'profile':'unison-release-v14','lowReaderFits':[],'releaseReference':[],'comparisons':{},'scope':'V14 isolated single-source low-octave leg and post-release chirp frequencies; no full multi-layer, gain, switching-chain or live-hardware equivalence.'}
for p,start,sign,base in [(11,.5,1,997),(14,.5,-1,1994)]:
 y=hw[round((ho+(p-1)*4)*r):round((ho+p*4)*r)];t,f=track(y,r,450,990,8192);ok=(t>start+.2)&(t<2.35);slope,intercept=np.polyfit(t[ok]-start,np.log(f[ok]),1);rate=slope/(sign*k);resume=(intercept-np.log(base*rate))/(sign*k)
 report['lowReaderFits'].append({'pattern':p,'playbackRate':float(rate),'sourcePositionAtEntrySeconds':float(resume),'residualMedianCents':float(np.median(abs(1200/np.log(2)*(np.log(f[ok])-(intercept+slope*(t[ok]-start))))))})
times=np.arange(2.66,2.86,.025)
for p in [8,9,10,11,13,14]:
 y=hw[round((ho+(p-1)*4)*r):round((ho+p*4)*r)];t,f=track(y,r,900,2200);report['releaseReference'].append({'pattern':p,'times':times.tolist(),'frequenciesHz':np.interp(times,t,f).tolist()})
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:
 x=np.fromfile(file,'<f4');r=json.loads(Path(file+'.json').read_text())['rate'];on=origin(x,r);rows=[]
 for q in report['releaseReference']:
  p=q['pattern'];y=x[round((on+(p-1)*4)*r):round((on+p*4)*r)];t,f=track(y,r,900,2200);errors=abs(1200*np.log2(np.interp(times,t,f)/np.array(q['frequenciesHz'])))
  rows.append({'pattern':p,'medianPitchErrorCents':float(np.median(errors))})
 report['comparisons'][name]=rows
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['lowReaderFits']);print(report['comparisons'])
