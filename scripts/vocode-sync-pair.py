"""Resynthesize local study vocal envelopes with a synthetic carrier, zero dry mix.
Usage: python scripts/vocode-sync-pair.py PREPARED_DIR NEW_PREPARED_DIR
This is a robot-voice approximation, not an isolated original vocal stem.
"""
import sys,json,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'t/audio-analysis-tools'))
import numpy as np
from scipy import signal,ndimage

def vocode(x,rate):
    # Fixed-pitch synthetic excitation deliberately does not inherit the
    # recording's pitches, chords, bass or percussion waveforms.
    t=np.arange(len(x))/rate;phase=2*np.pi*146.832384*t
    carrier=np.zeros(len(x))
    for harmonic in range(1,int(6500/146.832384)+1):
        carrier+=np.sin(phase*harmonic)/harmonic**.75
    carrier/=np.sqrt(np.mean(carrier**2))
    noise=np.random.default_rng(132).standard_normal(len(x))
    edges=np.geomspace(220,6400,19);out=np.zeros(len(x));mod_energy=np.zeros(len(x))
    for lo,hi in zip(edges[:-1],edges[1:]):
        sos=signal.butter(2,[lo,hi],btype='bandpass',fs=rate,output='sos')
        analysis=signal.sosfilt(sos,x)
        envelope=signal.sosfilt(signal.butter(2,35,fs=rate,output='sos'),np.abs(analysis))
        # Suppress persistent sustained energy in the control signal; this
        # reduces accompaniment-driven sustains, without adding a dry path.
        hop=120;small=envelope[::hop]
        floor=ndimage.percentile_filter(small,percentile=25,size=71,mode='nearest')
        floor=np.interp(np.arange(len(x)),np.arange(len(small))*hop,floor)
        envelope=np.maximum(0,envelope-.6*floor)
        excitation=carrier if hi<4000 else .8*carrier+.2*noise
        band=signal.sosfilt(sos,excitation)
        rms=np.sqrt(np.mean(band**2))+1e-12
        out+=band/rms*envelope;mod_energy+=envelope
    # Zero input -> zero synthesized output. No source samples are mixed in.
    target=min(.115,float(np.sqrt(np.mean(x*x))))
    rms=np.sqrt(np.mean(out*out))
    if rms>0:out*=target/rms
    peak=np.max(np.abs(out))
    if peak>.58:out*=.58/peak
    return out

if __name__=='__main__':
    source,dest=Path(sys.argv[1]),Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
    info=json.loads((source/'preparation.json').read_text(encoding='utf-8'));rate=info['rate']
    x=np.fromfile(source/'vocal.f32',dtype='<f4').astype(float);y=vocode(x,rate)
    assert len(y)==len(x) and np.isfinite(y).all()
    assert np.max(np.abs(vocode(np.zeros(rate),rate)))==0
    np.asarray(y,dtype='<f4').tofile(dest/'vocal.f32');shutil.copyfile(source/'rhythm.f32',dest/'rhythm.f32')
    info['vocalLabel']='02-VOCODER-NO-DRY'
    info['vocalProcessing']={'method':'18-band envelope vocoder','carrierHz':146.832384,'dryMix':0,'originalAccompanimentPCM':False,'limitation':'The mixed-source envelope may retain accompaniment rhythms. This is synthesized robot voice, not a guaranteed isolated or intelligible original vocal.','rms':float(np.sqrt(np.mean(y*y))),'peak':float(np.max(np.abs(y)))}
    (dest/'preparation.json').write_text(json.dumps(info,indent=2),encoding='utf-8');print(json.dumps(info['vocalProcessing']))
