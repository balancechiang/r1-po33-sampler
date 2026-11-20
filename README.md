[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# PO-33 Sampler for rabbit r1

A compact sampler and 16-step sequencer for rabbit r1, inspired by the PO-33 workflow. Record a sound, shape it with two knobs, and build a beat on a 4×4 grid.

## Highlights

- A 240×282 interface with text labels and a locally bundled seven-segment font.
- 16 sound slots, 16 patterns and a shared 40-second sample pool.
- Four original synth sounds, four drum kits and four original patterns.
- TONE, FILTER and TRIM controls, live punch-in FX and pattern chaining.
- r1 scroll-wheel tempo control, side-button transport/recording and shake-controlled FX.
- Local sample/pattern storage and beat-synced rabbit and boxing-glove animation.

## Start playing

1. Press **play**, or short-press the r1 side button, to start or stop.
2. Hold **sound** and press **1–16** to choose a sound. Release **sound**, then play the numbered pads.
3. Hold **pattern** and press **1–4** to select a factory pattern.
4. Hold **record** and a numbered pad to sample. Release either key to stop.

The interface uses English labels. These documents are available in English, Simplified Chinese, Japanese and Korean.

## Creation card copy

**Title:** PO-33 Sampler

**Short description:** Original synths, drum kits and a 16-step sequencer. Sample, shape and perform on rabbit r1.

## Scope and credits

This is an independent PO-33-inspired web app, not the original hardware firmware. FX are Web Audio interpretations. Hardware-project WAV backup/restore and dedicated stereo transfer are implemented; physical PO-33/R1 USB acceptance and line-sync remain unverified. Musical parameter-lock playback is incomplete. Microphone permissions, vibration, motion sensitivity and audio latency still require r1 testing.

WRITE + SOUND + RECORD receives a backup; WRITE + SOUND + PLAY prepares one for saving or stereo output. For one-finger touch, hold and release WRITE and SOUND individually for 500 ms, then tap the third key. See [transfer controls, display states and limits](BACKUP-IO.md).

Receive → Scan QR imports a backup from its HTTPS WAV download code. Camera
decoding runs on device; a direct link with CORS support is required. Try the
[original WAV QR test](demo/qr-test/index.html) on another screen.

[LAN HUB (:33033)](LAN-HUB.md) adds an optional zero-dependency Node HTTPS
manager and iframe-based WAV/lossless JSON synchronization. Run `npm run hub`
or `node scripts/local-hub.mjs`; local projects and certificates stay out of Git.

The original procedural factory sounds and sequences are offered under CC0-1.0. This does not assign that license to the entire application or its artwork. The bundled DSEG font retains its SIL OFL-1.1 license; see [the font license](fonts/DSEG-LICENSE.txt).

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)

### Sampling playback compatibility

New recordings into drum slots use onset-based transient slicing (up to 16
regions); unused pads are silent. Melodic-to-drum copies still evenly divide
the trimmed source, and imported native slice addresses stay unchanged.
All slots choke their preceding voice; a global four-voice allocator steals
the oldest sounding voice when full. A 2 ms fade avoids abrupt click artifacts.
Future sequencer hits are preserved when a live hit arrives during lookahead.
Transient thresholds, padding of unused slices and oldest-voice arbitration
are behavioral approximations, not verified proprietary firmware algorithms.
Existing saved equal-slice takes are not automatically re-sliced.

Validation: `node test-sampling.cjs` covers onset positions at three sample
rates, silence/sustain, the 16-slice cap and out-of-order voice scheduling.
`python -X utf8 test-sampling-browser.py` records synthetic microphone audio
through the actual recorder, checks irregular slice positions, silent-pad
choke, live cutting, four-voice allocation, equal-copy slicing and persistence.
These checks do not establish bit-identical PO-33 firmware behavior.

### Audio-thread recording

Musical sampling now uses `recording-worklet.js` (mono AudioWorklet), separate
from the existing stereo hardware backup worklet. Recording starts with the
existing button combination; there is no amplitude trigger, pre-roll or silence
stop. Audio is captured at the actual AudioContext sample rate. The worklet
owns the frame limit, stops at the exact remaining 40-second pool capacity,
and flushes its final partial block before the main thread commits a take.
A recorder error/disconnection rolls back the replaced sample.

Saved PCM is no longer normalized to peak 0.9: quiet input and near-full-scale
input retain their captured levels. Echo cancellation, noise suppression and
AGC are requested off; reported active settings produce an input-DSP warning.
This does not guarantee bypassing all device/driver processing. The input
bar uses RMS, remaining capacity shows tenths, and a near-full-scale peak
(>=0.98) displays CLP for at least 150 ms. This is an overload warning, not a
claim to detect analog clipping reliably, and adds no soft-clipping effect.
After drum recording, effective slice-count LEDs appear for 1.2 seconds when
not playing/editing another context. Existing stored samples are unchanged.

AudioWorklet requires a supported secure browser context. If it cannot load,
recording fails explicitly rather than silently falling back to the old
ScriptProcessor recorder. FX processing and musical mix export still use
ScriptProcessor; this update only migrates sample capture.

Validation: `node test-recording-worklet.cjs`, `python -X utf8 test-recording-browser.py` cover exact frame
limits at 44.1/48 kHz, raw levels, retained silence, final-block drain,
RMS/CLP indication, transfer handoff and disconnect rollback. Physical R1
microphone/driver behavior still requires device testing.
