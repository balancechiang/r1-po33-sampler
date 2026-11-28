"""v11 dry-voice component audit. Inputs: hardware.wav before.f32 after.f32 report.json.
Offline numpy/scipy only; no private audio is copied into the repository.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal
ROOTS=[233,349,487,653,887]
def onset(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
def probe(x,r,t):
 y=x[round(t*r):round((t+.15)*r)];z=abs(np.fft.rfft(y*np.hanning(len(y)),131072))*4/len(y);f=np.fft.rfftfreq(131072,1/r)
 return [float(z[(f>hz-3)&(f<hz+3)].max()) for hz in ROOTS]
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
sources={'hardware':(raw.mean(1),r)}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:sources[name]=(np.fromfile(file,'<f4'),json.loads(Path(file+'.json').read_text())['rate'])
report={'profile':'voice-priority-v11','frequenciesHz':ROOTS,'quality':{'seconds':len(raw)/r,'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int((abs(raw)>=32767/32768).sum())},'probes':{},'scope':'Dry P10–13 component presence on this 60BPM file. Not waveform/phase agreement or arbitrary slot-priority, live-input, or Unison equivalence.'}
for name,(x,r) in sources.items():
 origin=onset(x,r);ref=max(probe(x,r,origin+36+.3));rows=[]
 for p in range(10,14):
  for t in [.3,.8,1.3,1.8,2.3,2.8,3.3]:
   levels=probe(x,r,origin+(p-1)*4+t)
   rows.append({'pattern':p,'time':t,'presentSlots':[i+1 for i,a in enumerate(levels) if a>ref*.12],'relativeLevels':[a/ref for a in levels]})
 report['probes'][name]=rows
for name in ['before','after']:
 rows=report['probes'][name];hw=report['probes']['hardware'];report[name+'ExactPresenceMatches']=sum(a['presentSlots']==b['presentSlots'] for a,b in zip(rows,hw))
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n')
print({k:v for k,v in report.items() if k not in ['probes','scope']})
