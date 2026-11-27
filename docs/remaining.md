# Remaining validation

- Hardware sync: measure pulse level/width and test long-term phase, tempo changes, Swing and chain edits. User-confirmed first-start SY1 and post-FX sync are recorded below; other configurations remain unverified.
- Slave timing: calibrate the 40 ms scheduling cushion against direct audio and physical interfaces. Validate real stereo capture on target browsers.
- Sampling: threshold-triggered ARMED state is not implemented. Confirm recording-release semantics on hardware.
- Sound fidelity: compare transient slices, four-voice arbitration, same-slot choke, coloration, filter curves and all punch-in effects with identical hardware material.
- Protocol: hardware round trips after editing slice boundaries and parameter locks. Some new web parameter mappings are approximations.
- Display: meter ballistics and parameter feedback durations remain visual approximations.
- Browser lifecycle: iPhone/iPad lock/unlock, first play, route changes, microphone gain/permissions, camera orientation and PWA behavior need real-device coverage.
- Optional rabbit r1 host: verify USB stereo input/output, audio recovery and storage behavior on-device.

## User-confirmed device checks

On 2026-11-26 the user reported both previously requested checks passed:

- SY1 first start in the reported iPhone/adapter → PO-33 setup.
- Synchronization after using FX in that setup.

This confirms the reported scenarios. The report does not enumerate every FX, test duration, adapter model or other device configurations; those details are not inferred.

## Recorded hardware calibration — 2026-11-27

A user line-out capture of the original automatic test project (master volume 12, USB PnP capture, 44.1 kHz stereo) establishes these scoped corrections:

- Physical melodic key offsets: `[7,8,10,11,0,2,3,5,-5,-4,-2,-1,-12,-10,-9,-7]`. The earlier ascending reference was incorrect. Existing web-authored melodic patterns may consequently sound different; note indices/data are not rewritten.
- Native volume-code gain, relative to code 36, fits `(code² + 240) / 1536` within 0.1 dB for the eight recorded levels. Decoder audition no longer caps high gain, and edited export uses the inverse fit. The knob still places unity at its midpoint; its upper half now covers the recorded native maximum (about 2.74×). Re-import native projects saved under the previous audition mapping to pick up the corrected adapter. This is one hardware/interface measurement, not a published firmware specification.
- Native backup audio is already decoded μ-law PCM. Its default audition now bypasses the extra master coloration, which otherwise compressed the calibrated high levels. The optional tone switch remains available; the native PCM flag survives session restore/undo. New web factory/sampled projects keep their prior optional tone behavior.
- Actual web output: relative gain error was approximately -14.95 to +2.73 dB before; after curve correction and bypass, measured errors range -0.081 to 0 dB at the tested levels. Measured melodic pitch differences are below one cent on the same test windows after correction, versus one/two-octave errors previously.
- Filter/resonance and FX remain incomplete: the low-resonance hardware filter sweep differs substantially from the current two-pole browser model; Unison and Scratch mixed-source sections do not match. No arbitrary compensating gain or pitch was added. A second automatic single-source FX project removes competing voices to resolve these algorithms in a follow-up hardware capture.
- Absolute analog gain, LCD meter values and physical knob angles cannot be inferred solely from this soundcard recording.

Private recordings and captured PCM remain outside Git. Regression measurements are in `tests/fixtures/hardware-calibration-20261127.json`.
