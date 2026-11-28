"""Compare entry-specific Unison tuning against recorded fixed/up/down sources.
Usage: hardware.wav before.f32 after.f32 report.json. numpy/scipy offline only.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal

def origin(x,r):
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');return float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
sources={'hardware':(raw.mean(1),r)}
for name,file in [('before',sys.argv[2]),('after',sys.argv[3])]:sources[name]=(np.fromfile(file,'<f4'),json.loads(Path(file+'.json').read_text())['rate'])
prepared={}
for name,(x,r) in sources.items():
 on=origin(x,r);y=signal.resample_poly(x,8000,r);prepared[name]=(y,on)
f=np.fft.rfftfreq(16384,1/8000);ids=(f>700)&(f<2300);step=f[1]-f[0]
def spectrum(name,p,t):
 x,on=prepared[name];i=round((on+(p-1)*4+t-.11)*8000);y=x[i:i+1760];a=abs(np.fft.rfft(y*np.hanning(len(y)),16384))**2;a=a[ids];return a/max(a.sum(),1e-30)
report={'profile':'unison-entry-fit-v14','comparisons':{},'scope':'Normalized spectral-distribution distance on interior rising/falling chirp windows; lower is better. Phase and gain are normalized out; no bit-exact or gain claim.'}
for name in ['before','after']:
 rows=[]
 for p,start,end in [(9,.5,2.5),(10,1,2.5),(13,.5,2.5),(15,.5,1.5)]:
  distances=[]
  for t in np.arange(start+.25,end-.15,.2):
   a=spectrum('hardware',p,t);b=spectrum(name,p,t);distances.append(float(abs(np.cumsum(a-b)).sum()*step))
  rows.append({'pattern':p,'probes':len(distances),'medianSpectralDistanceHz':float(np.median(distances))})
 report['comparisons'][name]=rows
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['comparisons'])
