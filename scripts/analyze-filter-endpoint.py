"""Lowest filter endpoint cross-validation and actual browser audit.
Usage: hardware.wav before.f32 after.f32 report.json. Offline numpy/scipy only.
"""
import json,sys,wave
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.optimize import least_squares
root=Path(__file__).resolve().parents[1];fixture=json.loads((root/'tests/fixtures/filter-hardware-response-20261127.json').read_text());freq=np.array(fixture['frequencies']);row=next(v for v in fixture['rows'] if v['filter']==1);mask=np.array(row['usable']);target=np.array(row['db'])[mask];f=freq[mask]
def response(z,ff):
 fc,q=np.exp(z[:2]);v=np.tan(np.pi*ff/48000)/np.tan(np.pi*fc/48000);return -10*np.log10((1-v*v)**2+(v/q)**2)+(z[2] if len(z)>2 else 0)
report={'profile':'lowest-filter-endpoint','frequenciesHz':f.tolist(),'targetDB':target.tolist(),'holdouts':[],'measurements':{},'scope':'Native code1/resonance1, seven usable magnitude bins about80–660Hz. No phase, sub-60Hz, other-resonance or bit-exact claim.'}
for hold in [np.array([0,2,4,6]),np.array([1,3,5])]:
 train=np.ones(len(f),bool);train[hold]=False;z=least_squares(lambda p:response(p,f)[train]-target[train],np.log([340,.45]).tolist()+[-35],bounds=(np.log([1,.002]).tolist()+[-48],np.log([20000,15]).tolist()+[3]))
 report['holdouts'].append({'withheldIndices':hold.tolist(),'rmsDB':float(np.sqrt(np.mean((response(z.x,f)[hold]-target[hold])**2)))})
for file,name in [(sys.argv[1],'hardware'),(sys.argv[2],'before'),(sys.argv[3],'after')]:
 if name=='hardware':
  with wave.open(file,'rb') as w:r=w.getframerate();x=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).mean(1)/32768
 else:r=json.loads(Path(file+'.json').read_text())['rate'];x=np.fromfile(file,'<f4')
 e=signal.convolve(x*x,np.ones(round(r*.01))/round(r*.01),'same');on=np.flatnonzero(e>e.max()*.001)[0]/r;ff=freq if name=='hardware' else freq/.99995
 def amplitude(at):
  y=x[round((on+at+.12)*r):round((on+at+.46)*r)];t=np.arange(len(y))/r;b=np.column_stack([*[np.cos(2*np.pi*f*t) for f in ff],*[np.sin(2*np.pi*f*t) for f in ff],np.ones(len(y))]);v=np.linalg.lstsq(b,y,rcond=None)[0];return np.hypot(v[:len(ff)],v[len(ff):2*len(ff)])
 dry=np.median([amplitude(i*.5) for i in range(8)],axis=0);db=20*np.log10(amplitude(4)/dry)[mask];report['measurements'][name]={'db':db.tolist(),'rmsAgainstFixtureDB':float(np.sqrt(np.mean((db-target)**2)))}
for name in ['before','after']:
 a=np.array(report['measurements'][name]['db']);b=np.array(report['measurements']['hardware']['db']);report['measurements'][name]['rmsAgainstRemeasuredHardwareDB']=float(np.sqrt(np.mean((a-b)**2)))
Path(sys.argv[4]).write_text(json.dumps(report,indent=2)+'\n');print(report['holdouts']);print({name:{k:v for k,v in a.items() if k!='db'} for name,a in report['measurements'].items()})
