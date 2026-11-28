"""Cross-recording switch-end audit: v14.wav v10.wav v6.wav report.json.
Offline numpy/scipy; preserves private audio outside the repository.
"""
import sys,json,wave
from pathlib import Path
import numpy as np
from scipy import signal
rows=[]
for file,cases in [(sys.argv[1],[(6,2.5),(15,2.5)]),(sys.argv[2],[(5,3)]),(sys.argv[3],[(12,3)])]:
 with wave.open(file,'rb') as w:
  r=w.getframerate();a=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).astype(float)/32768
 x=a.mean(1);e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');on=float(np.flatnonzero(e>max(1e-8,e.max()*.001))[0]/r)
 for p,off in cases:
  def rms(t):
   i=round((on+(p-1)*4+t)*r);return float(np.sqrt(np.mean(x[i:i+round(r*.15)]**2)))
  before=rms(off-.3);after=[rms(off+t) for t in [.1,.4,.7]]
  rows.append({'recording':Path(file).name,'pattern':p,'fxOffSeconds':off,'beforeRms':before,'afterRms':after,'afterRelativeToBefore':[a/before for a in after]})
report={'cases':rows,'conclusion':'Some sources continue and some terminate on FX5→6→off. These recordings do not support an unconditional kill-on-second-switch rule. Gain/phase/source-boundary mechanism remains unresolved; no forced runtime rule applied.'}
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print([(a['pattern'],[round(v,4) for v in a['afterRelativeToBefore']]) for a in rows])
