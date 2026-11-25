# Remaining fidelity and device validation

Updated 2026-11-25, UI37. Implemented behavior is not automatically verified firmware behavior.

## Highest priority: sync hardware test

- SY1 webpage → PO-33: verify 2 PPQN, phase, stable tempo and minutes-long drift at multiple BPM values; calibrate physical pulse level/width.
- PO-33 → webpage: verify real stereo input, latency and first two pulses, clock loss/resume, rapid BPM changes and Swing.
- Verify SY2/3 mute external audio while SY4/5 mix right input; SY3/5 clock forwarding. Confirm hardware chain and headphone isolation.
- Calibrate slave audio alignment; current note scheduling has a 40 ms cushion, direct audio does not. No zero-latency guarantee.
- Integrate optional external audio pass-through in SY0/1 if required; currently not captured.
- Stress-test external-clock Loop, Scratch, retrigger, saved FX, P-Lock and repeated Pattern chains. Recheck phase after master tempo changes.
- R1 USB stereo capture and iOS Safari capture remain device-dependent. Mode and gain intentionally reset on page reload/audio rebuild.

## Sampling and sound

- Threshold-triggered ARMED → RECORDING is still missing; current recorder writes immediately. Calibrate threshold against hardware rather than claiming a fixed -32 dBFS or 15 ms pre-roll as official.
- Confirm whether releasing the numbered key after trigger must keep recording while RECORD remains held; current touch behavior ends on pad release.
- Auto-slicing is an approximation (global onset ranking, 55 ms mask, 2 ms backward snap); compare identical material and actual slice tables on hardware.
- A/B four-voice stealing, same-slot choke, tail behavior and click prevention.
- A/B μ-law/rate coloration, filter curves, resonance, live pitch/volume and Trim cutoff behavior.
- A/B all 15 FX, especially event-rate Unison, Loop windows, Scratch envelopes, octave glide, quantize and retrigger markers.

## Project / transport

- Real hardware round-trip exports after edited slice, pitch, volume, filter and resonance locks. Some web parameters use approximate native-field mappings/quantization.
- Keep reporting unresolved native slice references instead of silently repairing official backups. Retest existing official fixtures when codec logic changes.
- Test clipping, channel swaps, system audio enhancement and resampling on actual backup send/receive paths.

## UI and device lifecycle

- Calibrate meter response/peak hold, parameter display durations and animation with real video; current timing is approximate.
- Confirm R1 fixed-entry forced update, app removal/reinstall cache behavior and menu factory reset on-device. Browser tests do not prove Creation cache behavior.
- Repeat iPhone/iPad lock/unlock, first PLAY, route changes, mic auto-gain and permission-release tests. OS audio indicators cannot be reliably hidden by a webpage.
- Verify camera rotation, safe area and receive/send sheets on actual R1/iPad/PWA installations.
