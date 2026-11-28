"""Hardware-only v14 spectral audit. Usage: hardware.wav report.json
Requires numpy/scipy offline. Records observations, does not fit global runtime gains.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal
with wave.open(sys.argv[1],'rb') as w:
 r=w.getframerate();raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
x=raw.mean(1);e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');on=float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
N=1048576;f=np.fft.rfftfreq(N,1/r)
def measure(p,start,end):
 y=x[round((on+(p-1)*4+start)*r):round((on+(p-1)*4+end)*r)];z=abs(np.fft.rfft(y*np.hanning(len(y)),N))*4/len(y)
 ids=signal.find_peaks(z)[0];ids=ids[(f[ids]>450)&(f[ids]<1100)];ids=sorted(ids,key=lambda i:z[i],reverse=True)[:8];threshold=max(z[ids])*.08
 return {'pattern':p,'startSeconds':start,'endSeconds':end,'rms':float(np.sqrt(np.mean(y*y))),'peaks':[{'frequencyHz':float(f[i]),'windowedAmplitude':float(z[i])} for i in sorted(ids) if z[i]>threshold]}
windows=[(1,.2,2.7),(2,.2,2.7),(3,.2,2.7),(4,.7,2.3),(5,.7,2.3),(6,.7,1.4),(6,1.7,2.3)]
rows=[measure(*a) for a in windows];dry=rows[0]['rms'];base=rows[0]['peaks'][0]['frequencyHz']
for row in rows:
 row['rmsRelativeToDry']=row['rms']/dry
 for peak in row['peaks']:peak['ratioToDryFrequency']=peak['frequencyHz']/base
report={'profile':'unison-layers-v14','quality':{'seconds':len(x)/r,'sampleRate':r,'channels':raw.shape[1],'peakDbFS':float(20*np.log10(abs(raw).max())),'clippedSamples':int((abs(raw)>=32767/32768).sum())},'onsetSeconds':on,'fixedToneWindows':rows,'scope':'997Hz hardware observations at 60BPM/volume12. FFT peaks are spectral components, not proof of one independent layer each. RMS includes beating and capture gain. No fitted global gain/rate update; chirp per-layer phase and rate remain unresolved.'}
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n')
print([(a['pattern'],a['startSeconds'],round(a['rmsRelativeToDry'],3),[round(p['frequencyHz'],2) for p in a['peaks']]) for a in rows])
