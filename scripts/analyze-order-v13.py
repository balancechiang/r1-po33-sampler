"""v13 active Unison source-identity audit: hardware.wav before.f32 after.f32 report.json.
Offline numpy/scipy. Private audio remains external.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal
ROOTS=np.array([233,349,487,653.])
def onset(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
def probe(x,r,t):
 y=x[round(t*r):round((t+.15)*r)];z=abs(np.fft.rfft(y*np.hanning(len(y)),131072))*4/len(y);f=np.fft.rfftfreq(131072,1/r);ids=np.flatnonzero((f>200)&(f<720));i=ids[np.argmax(z[ids])];return float(f[i]),float(z[i])
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
sources={'hardware':(raw.mean(1),r)}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:sources[name]=(np.fromfile(file,'<f4'),json.loads(Path(file+'.json').read_text())['rate'])
report={'profile':'unison-order-v13','quality':{'seconds':len(raw)/r,'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int((abs(raw)>=32767/32768).sum())},'probes':{},'scope':'Dominant fixed-tone source identity in P02–10/15–16, during and after saved FX. Does not establish per-layer phase, gain, all reader positions or live hardware behavior.'}
for name,(x,r) in sources.items():
 origin=onset(x,r);ref=probe(x,r,origin+.4)[1];rows=[]
 for p in [*range(2,11),15,16]:
  for t in [1.1,1.5,2.1]:
   hz,amp=probe(x,r,origin+(p-1)*4+t);slot=int(np.argmin(abs(np.log(hz/ROOTS))))+1 if amp>ref*.1 else None
   rows.append({'pattern':p,'time':t,'dominantFrequencyHz':hz,'dominantToneSlot':slot,'relativeAmplitude':amp/ref})
 report['probes'][name]=rows
for name in ['before','after']:report[name+'SourceMatches']=sum(a['dominantToneSlot']==b['dominantToneSlot'] for a,b in zip(report['probes'][name],report['probes']['hardware']))
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items() if k not in ['probes','scope']})
