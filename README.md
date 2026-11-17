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

The original procedural factory sounds and sequences are offered under CC0-1.0. This does not assign that license to the entire application or its artwork. The bundled DSEG font retains its SIL OFL-1.1 license; see [the font license](fonts/DSEG-LICENSE.txt).

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)
