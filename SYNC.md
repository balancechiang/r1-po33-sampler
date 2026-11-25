# Analog sync implementation reference

Status: not implemented. User-supplied code is a design reference, not verified firmware behavior. Playback and backup routing are unchanged.

Official source: https://teenage.engineering/guides/po-33/en (section 9, checked 2026-11-25).

Hold RECORD and press BPM to cycle modes. PLAY arms the receiving unit to wait for the master clock. Split signals use left sync and right audio. Official maximum sync input is 5 V peak-to-peak.

| Mode | Input | Output |
| --- | --- | --- |
| SY0 | stereo | stereo |
| SY1 | stereo | mono/sync |
| SY2 | sync | stereo |
| SY3 | sync | mono/sync |
| SY4 | mono/sync | stereo |
| SY5 | mono/sync | mono/sync |

The reference conflates sync-only and mono/sync input. Verify exact pass-through behavior on hardware.

## Additional routing references

- https://www.spongefile.com/pocket-operator-sync-modes-explained/
- https://www.soundtech.co.uk/musicians-blog/pocket-operator-sync-modes.html

These explain the practical distinction in the official table: SY2/3 receive clock without incoming audio pass-through; SY4/5 receive left clock plus right audio and mix that audio with the instrument. SY3/5 send clock onward; SY2/4 end the chain with audio-only output. SY0/1 allow incoming audio pass-through. Thus a master carrying both music and clock should feed SY4, rather than SY2, when its music must remain audible.

Both references describe hardware input-cable detection: without a line-in cable only SY0/1 are selectable. A browser cannot equate microphone permission or an enumerated audio device with physical cable detection; explicit stereo-input setup will be needed instead.

Clock pulses carry timing, not separate transport or pattern-position commands. Receivers must first be armed with PLAY. Do not treat a proposed fixed timeout as a verified hardware STOP/reset command. Confirm loss-of-clock and resume behavior on a real unit.

The articles corroborate 2 PPQN. Sound Technology reports a tested pulse-width range of 3–67 ms, which is an experiment rather than a universal device specification. Use measured hardware waveforms to calibrate pulse width and detection. Keep the official 5 V peak-to-peak limit; do not infer required physical voltage from floating-point audio amplitude.

Implementation criteria:

- Use one audio timeline for music and proposed 2 PPQN pulses. Generate pulses in AudioWorklet with fractional timing; flooring each step causes accumulated drift.
- Worklet messages cannot trigger main-thread notes at the original exact render time. External reception needs latency-aware scheduling and measured interpolation.
- Read receiver audio from inputs[0][0], validate actual stereo input, disable audio processing, and use edge hysteresis with a refractory period.
- Treat 3 ms width, gain, thresholds and timeout as calibration starting points. Normalized digital amplitude does not specify physical volts.
- Validate all six routes, start/stop, missing pulses, tempo changes, swing and channel isolation on hardware.
- Keep sync exclusive with backup transport and conflicting microphone capture; release tracks when reception ends.
- Confirm browser/WebView support on each target, including R1 and iOS. Do not promise zero latency or universal support.

Factory reset now remains in the receive menu (WRITE + SOUND + RECORD). The rabbit mascot has no pointer or keyboard reset action as of UI36.
