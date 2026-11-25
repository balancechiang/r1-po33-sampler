"""Create original and playful synth variants from a supplied aligned vocal stem.
Usage: python scripts/prepare-clean-vocals.py VOCALS_MP3 ORIGINAL_PREP SYNTH_PREP
"""
import sys,json,subprocess,importlib.util
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'t/audio-analysis-tools'))
import numpy as np
import imageio_ffmpeg
spec=importlib.util.spec_from_file_location('vocoder',Path(__file__).with_name('vocode-sync-pair.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
raw=subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',sys.argv[1],'-ac','1','-ar','24000','-f','f32le','pipe:1'])
x=np.frombuffer(raw,dtype='<f4').astype(float);duration=16*4*60/132;n=round(duration*24000)
if abs(len(x)/24000-duration)>.1:raise ValueError('Expected the aligned 29.09-second vocal excerpt; no automatic trim of a full song')
x=np.pad(x,(0,max(0,n-len(x))))[:n];gain=min(1,.5/max(np.max(np.abs(x)),1e-12));x*=gain
for folder,label,data,description in [
    (sys.argv[2],'02-CLEAN-ORIGINAL-VOCAL',x,'Supplied vocal stem; original pitch and timing, mono fold-down and constant headroom gain only.'),
    (sys.argv[3],'03-PLAYFUL-SYNTH-VOCAL',module.vocode(x,24000,playful=True),'Zero-dry 18-band vocoder; continuous-phase D-minor hopping synthetic carrier, vibrato and eighth-note tremolo.')]:
    out=Path(folder);out.mkdir(parents=True,exist_ok=True);np.asarray(data,dtype='<f4').tofile(out/'vocal.f32')
    info={'bpm':132,'rate':24000,'bars':16,'durationSeconds':duration,'vocalLabel':label,'processing':description,'originalGain':gain,'sourceLagSeconds':0,'peak':float(np.max(np.abs(data)))}
    (out/'preparation.json').write_text(json.dumps(info,indent=2),encoding='utf-8');print(json.dumps(info))
