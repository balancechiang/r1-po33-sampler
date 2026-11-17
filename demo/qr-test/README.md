# Scan-to-import test

The QR in `wav-url-qr.png` contains this WAV download URL:
https://balancechiang.github.io/r1-po33-sampler/demo/qr-test/po33-backup.wav

In the sampler, hold WRITE + SOUND and tap RECORD, choose **Scan QR**, then
point the r1 camera at the QR displayed on another screen. Successful download
and CRC validation show End. Close the controls and press play to hear pattern1.
The test replaces the current in-memory project; Undo restore is available.

Expected: 108 BPM, one populated melodic slot1, four notes in pattern1, fifteen
empty patterns. The tone is original procedural audio, not a Teenage Engineering
sound pack or hardware recording. The tone and four-note sequence are dedicated
to the public domain under CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/).
`node demo/qr-test/generate.cjs` regenerates the verified 44100 Hz stereo PCM16
modulated backup, using Node >=24.12.

The QR is a **WAV download code**, not a Creation installation code. Camera
frames stay on device. External WAV hosts must permit CORS and direct downloads;
ordinary webpage/share links and regular music WAVs are not project backups.
This does not test USB audio capture or physical PO-33 restore acceptance.
