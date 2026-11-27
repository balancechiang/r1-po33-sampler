"""Measure isolated Unison v6 partials. Input: private hardware WAV; output: numerical JSON."""
from pathlib import Path
import sys,json,wave
import numpy as np
with wave.open(sys.argv[1],'rb') as w:
 rate=w.getframerate();assert w.getsampwidth()==2
 x=np.frombuffer(w.readframes(w.getnframes()),'<i2').reshape(-1,w.getnchannels()).mean(1)/32768
energy=np.convolve(x*x,np.ones(round(rate*.01))/round(rate*.01),'same');on=np.where(energy>max(1e-8,float(energy.max())*.001))[0][0]/rate
N=2**20;freq=np.fft.rfftfreq(N,1/rate)
def spectrum(p,n):
 y=x[round((on+(p-1)*4+n+.2)*rate):round((on+(p-1)*4+n+.9)*rate)]
 return abs(np.fft.rfft(y*np.hanning(len(y)),N))
def peak(z,center,width):
 lo=np.searchsorted(freq,center*(1-width));hi=np.searchsorted(freq,center*(1+width));i=lo+np.argmax(z[lo:hi]);a=np.log(z[i-1:i+2]+1e-15);d=.5*(a[0]-a[2])/(a[0]-2*a[1]+a[2]);return float((i+np.clip(d,-.5,.5))*rate/N),float(z[i])
rows=[];h=23
for dry,wet5,wet6,roots in [(1,2,3,[55,110,110*2**(7/12),110*2**(-5/12)]),(4,5,6,[55,110*2**(-4/12),110*2**(4/12),220]),(7,8,9,[110,165,220,330])]:
 for note,root in enumerate(roots):
  df,da=peak(spectrum(dry,note),root*h,.009);base=df/h
  for kind,pattern,guesses in [(5,wet5,[.98384,.99413,1.0063,1.01656]),(6,wet6,[.99458,1.00286,1.00435,.49607])]:
   z=spectrum(pattern,note);parts=[]
   for index,guess in enumerate(guesses):
    f,amp=peak(z,base*h*guess,.002 if kind==5 or index==3 else .00065)
    parts.append({'frequencyHz':f,'ratio':f/(base*h),'relativeAmplitude':amp/da})
   rows.append({'pattern':pattern,'second':note,'dryPattern':dry,'baseHz':base,'harmonic':h,'kind':kind,'partials':parts})
summary={str(kind):{'ratios':[float(np.median([r['partials'][i]['ratio'] for r in rows if r['kind']==kind])) for i in range(4)],'gains':[float(np.median([r['partials'][i]['relativeAmplitude'] for r in rows if r['kind']==kind])) for i in range(4)]} for kind in [5,6]}
report={'profile':'unison-v6','onsetSeconds':float(on),'partialMeasurements':rows,'medianFits':summary,'scope':'Twelve isolated notes/pitch locks/drum slices; 23rd partial, 0.2–0.9 seconds. Gain and phase interference remain approximate. No raw audio.'}
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(summary,indent=2))

# Optional actual-browser captures: before.f32 after.f32, each with .json sample rate.
if len(sys.argv)>=5:
 import itertools
 comparisons={}
 for label,file in zip(['before','after'],sys.argv[3:5]):
  web=np.fromfile(file,'<f4');wr=json.loads(Path(file+'.json').read_text())['rate'];wo=np.where(abs(web)>.0001)[0][0]/wr;windows=[]
  for dry,wet in [(1,2),(1,3),(4,5),(4,6),(7,8),(7,9)]:
   for note in range(4):
    def rms(pcm,r,origin,p):
     a=pcm[round((origin+(p-1)*4+note+.2)*r):round((origin+(p-1)*4+note+.9)*r)];return np.sqrt(np.mean(a*a))
    h=float(20*np.log10(rms(x,rate,on,wet)/rms(x,rate,on,dry)));w=float(20*np.log10(rms(web,wr,wo,wet)/rms(web,wr,wo,dry)))
    windows.append({'pattern':wet,'second':note,'hardwareWetDryDb':h,'webWetDryDb':w,'errorDb':w-h})
  priority=[]
  for pattern in [14,15]:
   def dominant(pcm,r,origin):
    a=pcm[round((origin+(pattern-1)*4+.2)*r):round((origin+(pattern-1)*4+1.8)*r)];n=2**20;z=abs(np.fft.rfft(a*np.hanning(len(a)),n));ff=np.fft.rfftfreq(n,1/r);ix=np.where((ff>80)&(ff<240))[0];return float(ff[ix[z[ix].argmax()]])
   priority.append({'pattern':pattern,'hardwareDominantHz':dominant(x,rate,on),'webDominantHz':dominant(web,wr,wo)})
  comparisons[label]={'rmsWindows':windows,'medianAbsoluteRmsErrorDb':float(np.median([abs(row['errorDb']) for row in windows])),'priority':priority}
 report['actualPlaybackComparisons']=comparisons
 for kind in [5,6]:
  fits=[];old={5:[.98372,.99407,1.00439,1.01453],6:[1,1,.497,.503]}[kind]
  for model in [old,summary[str(kind)]['ratios']]:
   errors=[]
   for row in rows:
    if row['kind']!=kind:continue
    actual=[p['ratio'] for p in row['partials']];errors.append(min(sum(abs(1200*np.log2(a/b)) for a,b in zip(actual,perm))/4 for perm in itertools.permutations(model)))
   fits.append(float(np.median(errors)))
  report['medianFits'][str(kind)]['matchedMeanErrorCentsBeforeAfter']=fits
 Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+'\n')
 print('Actual playback median absolute RMS error:',{k:v['medianAbsoluteRmsErrorDb'] for k,v in comparisons.items()})
