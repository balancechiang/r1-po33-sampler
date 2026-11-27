import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const tests=['test-runtime-lifecycle.cjs','test-recording-worklet.cjs','test-sampling.cjs','test-live-voice.cjs','test-scratch-hardware.cjs','test-sync-worklet.cjs','test-sync-output-session.cjs','test-meter-ballistics.cjs','test-lcd-indicator.cjs','test-sound-calibration.cjs','test-fx-dsp.cjs','test-native-hardware-calibration.mjs'];
for(const test of tests){const result=spawnSync(process.execPath,['tests/'+test],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
