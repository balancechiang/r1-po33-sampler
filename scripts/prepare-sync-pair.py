"""Prepare complementary percussion/bass and vocal/harmony study stems locally.
Requires numpy, scipy and imageio_ffmpeg. No audio is uploaded or bundled in Git.
Usage: python scripts/prepare-sync-pair.py INPUT_MP3 OUTPUT_DIR
"""
import sys, subprocess, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'t/audio-analysis-tools'))
import numpy as np
from scipy import signal, ndimage
import imageio_ffmpeg

source,folder=Path(sys.argv[1]),Path(sys.argv[2]);folder.mkdir(parents=True,exist_ok=True)
rate=24000;bpm=132;start=43.9818181818;duration=16*4*60/bpm
raw=subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-ss',str(start-.3),'-t',str(duration+.6),'-i',str(source),'-ac','1','-ar',str(rate),'-f','f32le','pipe:1'])
x=np.frombuffer(raw,dtype='<f4').astype(float)
f,t,z=signal.stft(x,fs=rate,nperseg=2048,noverlap=1792)
mag=np.abs(z);harm=ndimage.median_filter(mag,size=(1,31));perc=ndimage.median_filter(mag,size=(17,1))
mask=perc**2/(harm**2+perc**2+1e-15)
# Retain sub/bass in the rhythm project, and leave more speech-band articulation
# in the vocal project. This is spectral separation, not isolated multitracks.
bass=1/(1+(f/170)**8)
speech=np.exp(-((np.log(np.maximum(f,1)/1200)/1.1)**4))
mask=bass[:,None]+(1-bass[:,None])*mask*(1-.3*speech[:,None])
_,drums=signal.istft(z*mask,fs=rate,nperseg=2048,noverlap=1792)
drums=drums[:len(x)];vocals=x-drums
first=round(.3*rate);n=round(duration*rate);x=x[first:first+n];drums=drums[first:first+n];vocals=vocals[first:first+n]
# One shared gain preserves relative level and bounds the recombined signal.
gain=.82/max(np.max(np.abs(x)),np.max(np.abs(drums)),np.max(np.abs(vocals)),1e-6)
for name,a in [('rhythm',drums),('vocal',vocals)]:
 a=np.asarray(a*gain,dtype='<f4');a.tofile(folder/(name+'.f32'))
info={'bpm':bpm,'rate':rate,'startSeconds':start,'endSeconds':start+duration,'bars':16,'durationSeconds':duration,'gain':gain,'separation':'Complementary time-frequency masks; vocal/harmony stem is not an isolated vocal.'}
(folder/'preparation.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
print(json.dumps(info))
