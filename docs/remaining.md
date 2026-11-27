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

The second, single-source FX recording on 2026-11-27 calibrates Unison 5/6 source-layer spectra and Shutter 9/10 gating. The earlier root-clamping Unison model and repeated-buffer shutter model were removed. Isolated wet/dry RMS matches within about 0.3 dB for these four cases, but exact phase, arbitrary-note behavior, Scratch and filter/resonance remain unverified/incomplete.

During this FX calibration, the SY1 all-live-FX clock-grid regression passed. The simulated external-slave test still intermittently failed its strict grid/saved-FX14 assertions; a baseline run serving pre-change app/effects/sampling/voice files reproduced a failure. No slave-clock correction is claimed in this change; physical slave timing and Unison on non-root notes remain follow-up checks.

## Filter/resonance magnitude calibration — 2026-11-27

The third valid recording (not the cancelled take) uses a 60 BPM, 2-second original multisine and 128 parameter cells, master volume 12. Native codes 31/32 no longer fall into the no-filter dead zone. The low/high-pass Web Audio Q parameter is now correctly supplied in dB, converted from the fitted linear Q.

104 cutoff/resonance settings have recorded magnitude fits at 44.1/48/96 kHz. Actual browser node responses have roughly 0.2 dB median RMS fit error on eligible 60 Hz–7.04 kHz bins. A captured playback of the complete web test measures about 0.17 dB median versus the recorded hardware, compared with about 11.3 dB for the old model on the same bins. Code 1 is low-SNR/deep attenuation and remains around 2.3 dB error; bins below 60 Hz, above 7.04 kHz and near the noise floor are excluded. The first res=1 cell following each large cutoff jump is retained as transient evidence but excluded from steady fits. Interpolation away from the six measured resonance/cutoff anchors is an approximation. Phase, arbitrary signal levels, large-jump transition timing, unmeasured sample rates and physical Safari/R1 performance still require checks.

Raw samples are unchanged. New filter/resonance locks re-export with the same native codes. Re-import native projects saved with the previous audition mapping to receive the corrected near-center mapping. There is no claim of exact firmware/DSP reconstruction.

### Scratch diagnostic v4 (2026-11-27)

- The lowest filter cutoff discrepancy is explicitly deferred by the user pending hardware verification; no additional correction is applied.
- Generate the next automatic capture project with `node scripts/build-calibration.mjs <output-directory> --scratch-isolated`. It uses original ascending/reversed chirps, ordered tone tags and transient pulses; 16 chained patterns at 60 BPM take 64 seconds. FX11/12 are stored in the backup.
- Cases separate onset triggering, empty steps with/without a ringing voice, repeated notes, playback direction and drum FX switching. Capture at master volume 12 in SY0, without manual FX or knob changes. The valid capture has now informed the source-reader model; see the calibration notes below.

### Scratch source-reader calibration — 2026-11-27

- Valid v4 hardware capture: 44.1 kHz stereo / 16-bit, no clipped samples. The full automatic 16-pattern test was captured. Private audio remains outside Git.
- FX11/12 now oscillate an existing sample source instead of repeating an entire step and adding an arbitrary pitch envelope. At 60 BPM the cycles are 0.5 / 0.25 seconds. Empty steps can process a ringing tail; genuinely silent steps do not synthesize a new hit. The song clock and pattern chain keep advancing.
- In eight selected effect-interior chirp sections, actual browser playback now has 100% audible coverage and approximately 2–17 cents median dominant-frequency error per section. Previously P02/P03 were silent in these windows; the other sections had partial silence and roughly 1,187–4,688 cents median error on their audible samples. Reversal edges, release, drums and phase are excluded. Effect-interior chirp frequency measurements and missing-audio coverage are stored in `tests/fixtures/scratch-hardware-calibration-20261127.json`. These are not waveform identity or full FX validation.
- Still pending: effect-release transients, short drum slices / boundaries, alternate pitches, trim ranges, tempo changes during a held effect, physical mobile/R1 performance, and hardware live gestures (the recording uses saved FX). The lowest filter cutoff discrepancy remains deferred by user request.

This change's sync regression passed all 15 live FX in both simulated SY1 master and external-slave modes. The saved FX14 slave-grid assertion still failed (note/step offset); it is the previously documented baseline issue, not marked fixed here.

### Next capture: Scratch boundaries v5

Generate with `node scripts/build-calibration.mjs <output-directory> --scratch-boundaries`. The 64-second, 60 BPM chain requires no manual FX input. P01 is a four-second dry chirp; P02–06 isolate FX11/12 release and delayed onset on a single long note. P07–09 use half-second drum slices sharing one backing allocation; P10–12 use bit-identical PCM copied into independent allocations, with matching dry/FX11/FX12 patterns. P13–15 isolate a drum slice at physical source seconds 1–2, and P16 references that exact region as a melodic sample while switching 11→12→off. This can distinguish slice-boundary behavior from allocation behavior instead of fitting an arbitrary drum compensation. Native round-trip checks include all sound allocation bytes. Hardware recording/acceptance is still pending.

For capture, use volume12, SY0 and the saved chain1–16, allow about75 seconds. The existing FX14 slave automation issue requires a separate sync test and is not validated by this audio-only capture. Lowest filter cutoff error remains deferred.
