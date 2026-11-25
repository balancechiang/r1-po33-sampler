# Garage 16 variations — 132 BPM

Original synthesized drums and original UK garage / 2-step patterns, CC0-1.0. No song samples, vocals or accompaniment are included.

Scan `garage-16-import-qr.png` from the sampler's receive menu → Scan QR to download `garage-16.po33.gz`. This is a project-import code, not a Creation installation code. Import replaces the current project; save it first if needed.

- 132 BPM, Pattern 1–16 sequential chain, 29.09-second cycle.
- All 16 patterns differ; step 1 kick and steps 5/13 snare remain anchored.
- Sound 9 kick, 10 snare/clap, 11 hats, 12 rim/shaker. Three timbre/level variants repeat across each slot's pads.
- Existing drum synthesis unchanged; no source audio. Sample memory approximately 2.56 seconds.
- `Garage-16-Variations-132BPM.po33.wav`: 44.1 kHz / PCM16 stereo hardware backup, approximately 25-second transfer. This file is modem data, not listening audio.
- `LISTEN-CLEAN-DRUMS.wav`: decoded-sample music audition.
- `patterns.json`: zero-based step positions; k=kick, h=delayed weak hats, o=open hats, p=percussion [step,pad], g=ghost snare.
- `clean-drums-validation.json`: decoder checks and resource usage. Zero checksum errors and unresolved sample ranges. Hardware import remains subject to device testing.

Rebuild locally: `node scripts/build-clean-garage.mjs - OUTPUT_DIR --variations --drums-only`.
The 132 BPM timing and chain length match the private vocal test projects, which are not distributed here.
