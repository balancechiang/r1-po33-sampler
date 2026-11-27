"""Fit a browser biquad approximation to measured native filter magnitudes.
Requires numpy/scipy for this offline calibration only, not the web app.
"""
import json,sys
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'tests/fixtures/filter-hardware-response-20261127.json'
d=json.loads(source.read_text());freq=np.array(d['frequencies']);groups={}
for row in d['rows']:
 if row['filter']==63 or not row.get('steady',True):continue
 groups.setdefault((row['filter'],row['resonance']),[]).append(row)
tables={};stats=[]
for rate in [44100,48000,96000]:
 table={}
 for (code,res),rows in sorted(groups.items()):
  target=np.median([r['db'] for r in rows],axis=0);mask=np.array(rows[0]['usable'])
  for row in rows[1:]:mask &= np.array(row['usable'])
  f=freq[mask];db=target[mask];low=code<=31
  def response(x):
   fc,q=np.exp(x[:2]);ratio=np.tan(np.pi*f/rate)/np.tan(np.pi*fc/rate)
   den=(1-ratio**2)**2+(ratio/q)**2
   return 20*np.log10((1 if low else ratio**2)/np.sqrt(den))+(x[2] if len(x)>2 else 0)
  best=None
  for fc in [100,500,1500,5000,15000]:
   start=np.log([min(fc,rate*.45),.15]).tolist()+([0] if res>1 else [])
   bounds=(np.log([1,.002]).tolist()+([-6] if res>1 else []),np.log([rate*.49,15]).tolist()+([3] if res>1 else []))
   fit=least_squares(lambda x:response(x)-db,start,bounds=bounds,max_nfev=200)
   rms=float(np.sqrt(np.mean((response(fit.x)-db)**2)))
   if best is None or rms<best[0]:best=(rms,fit.x)
  rms,x=best;table[str(code)+':'+str(res)]=[round(float(np.exp(x[0])),6),round(float(np.exp(x[1])),8),round(float(x[2] if len(x)>2 else 0),6)]
  stats.append({'rate':rate,'filter':code,'resonance':res,'bins':len(f),'rmsDB':rms})
 tables[str(rate)]=table
payload=json.dumps(tables,separators=(',',':'))
module='''/* Measured 2026-11-27 magnitude fit. Offline source: scripts/fit-filter-calibration.py.
   Tested 60 Hz–7.04 kHz bins only; not a firmware or phase-identical model. */
(function(root){'use strict';
const tables=DATA;
const resonance=[1,9,18,27,36,45,54,63];
function mix(a,b,t){return [Math.exp(Math.log(a[0])*(1-t)+Math.log(b[0])*t),Math.exp(Math.log(a[1])*(1-t)+Math.log(b[1])*t),a[2]*(1-t)+b[2]*t];}
function span(list,value){let i=0;while(i<list.length-2&&value>list[i+1])i++;return [list[i],list[i+1],Math.max(0,Math.min(1,(value-list[i])/(list[i+1]-list[i])))];}
function at(table,code,res){
 const low=code<=31,lo=Math.floor(code),hi=Math.ceil(code),base=mix(table[lo+':1'],table[hi+':1'],code-lo);
 if(res<=1)return base;
 const anchors=low?[8,16,24]:[39,47,55],s=span(anchors,code),r=span(resonance,res);
 function delta(c){const a=mix(table[c+':'+r[0]],table[c+':'+r[1]],r[2]),b=table[c+':1'];return [Math.log(a[0]/b[0]),Math.log(a[1]/b[1]),a[2]-b[2]];}
 const a=delta(s[0]),b=delta(s[1]);return [base[0]*Math.exp(a[0]*(1-s[2])+b[0]*s[2]),base[1]*Math.exp(a[1]*(1-s[2])+b[1]*s[2]),base[2]+a[2]*(1-s[2])+b[2]*s[2]];
}
function shape(value,rate,res){
 value=Math.max(-100,Math.min(100,value||0));if(Math.abs(value)<=4)return {bypass:true,type:'lowpass',frequency:Math.min(20000,rate*.45),q:Math.SQRT1_2,gain:1};
 const low=value<0,code=low?Math.max(1,Math.min(31,1+(value+100)*30/95)):Math.max(32,Math.min(62,32+(value-5)*30/95)),r=1+Math.max(0,Math.min(100,res||0))*.62;
 const s=span([44100,48000,96000],rate),a=at(tables[s[0]],code,r),b=at(tables[s[1]],code,r),v=mix(a,b,s[2]);
 return {bypass:false,type:low?'lowpass':'highpass',frequency:Math.max(1,Math.min(rate*.49,v[0])),q:Math.max(.002,Math.min(15,v[1])),gain:Math.pow(10,v[2]/20)};
}
const api={shape};root.PO33FilterCalibration=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
'''.replace('DATA',payload)
(root/'filter-calibration.js').write_text(module)
(root/'t').mkdir(exist_ok=True)
(root/'t/filter-fit-statistics.json').write_text(json.dumps(stats,indent=2))
print('Fitted',len(groups),'settings x',len(tables),'sample rates; median RMS',round(float(np.median([s['rmsDB'] for s in stats])),3),'dB')
print('Worst settings',sorted(stats,key=lambda s:-s['rmsDB'])[:4])
