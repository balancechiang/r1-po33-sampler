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

### Scratch boundaries v5 capture — 2026-11-27

The valid stereo capture at volume12 has zero clipped samples. In both shared and independently allocated drum groups, recorded FX11/12 reads slice1 even when the pattern addresses another slice. The app now models that temporary reader selection without changing stored note/slice data; dry selection is unchanged. Live drum-release continuation keeps the actual reader's slice. Manual live hardware verification remains pending.

FX11 entry on the opposite sixteenth phase starts with reverse reading; the P05 voice reaches the origin and ends instead of wrapping indefinitely. In P04, disabling FX12 when its reverse leg has reached the origin does not revive the voice. The app now retains these endings. P02/P03 continuation, the nonzero-offset cases and the 11→12 switch remain included as controls.

In selected interior windows, four drum cases improved from approximately899–903 cents median dominant-frequency error to2–4 cents. P04/P05's unwanted browser tails are now digital silence, matching the absence of a hardware signal (hardware noise floor about66dB below dry reference). This does not claim matching reversal clicks, sample-level phase, arbitrary timing, alternate pitches or trim ranges. Measurements: `tests/fixtures/scratch-boundary-calibration-20261127.json`; analysis: `scripts/analyze-scratch-boundaries.py`. Raw audio remains private.

Remaining: live/manual gestures and mobile hardware, FX onset at fractional-step timings, alternate BPM/pitch during Scratch, other slice ranges and non-first-slice live release, precise switching transients, plus the previously documented saved-FX14 external-slave issue. Lowest filter cutoff error remains explicitly deferred.

## Next FX captures: Unison v6 and other FX v7

Both profiles use original synthesized material at60BPM and a nominal64-second sixteen-pattern chain. Generate with `node scripts/build-calibration.mjs <directory> --unison-extended` or `--other-fx`. All native note/lock cells, expected FX, audio allocations and checksum round-trip are verified; frontend tests use `tests/test-calibration-import.py <wav> --extended-fx`. No runtime effect coefficients are changed before the new hardware measurements.

| Area | Existing evidence | Next capture |
| --- | --- | --- |
| Unison5/6 | Layers and relative level fitted at root note | v6: non-root note keys, native pitch locks, drum slices, held enter/switch/release, four slots plus a fifth event |
| Loop1–4 | Software scheduling tests; hardware precision incomplete | v7: distinguishable step markers, middle-span on/off |
| Octave7/8 | Smooth source-rate implementation; exact glide curve unmeasured | v7: one held harmonic source, on/off and7→8 switch |
| Shutter9/10 | Root-source rate/duty/level calibrated at120BPM | v7:60BPM, held switching and release |
| Quantize13 | Approximate step mapping | v7: dense timing markers, middle-span and whole-pattern handoff |
| Retrigger14 | Live timing tests; saved external-slave grid failure documented | Separate synchronized capture/debugging, excluded from v7 to avoid trapping an unattended chain |
| Reverse15 | Reverse buffer implementation; hardware boundary/selection incomplete | v7: melodic chirp and distinct drum slices |
| Scratch11/12 | v4/v5 measured corrections | Fractional live entry, other pitches/tempo/trim and switching edges still pending |

Use master12/SY0 and saved chain1–16. Capture the two projects separately; do not operate knobs or FX during capture. Keep the lowest filter cutoff discrepancy deferred. The nominal chain duration is a reference; a native Loop/quantize traversal change itself is evidence, not a reason to force pattern selection during recording.

### Unison v6 capture — 2026-11-27

Valid recording:115seconds total,44.1kHz stereo/16-bit, no clipping, peak about−14.7dBFS. Twelve isolated note-key/pitch-lock/drum cases refine FX5's four rates and resolve FX6 as three near-original rates plus one near-half rate. Numerical partial measurements are in `tests/fixtures/unison-v6-calibration-20261127.json`, produced by `scripts/analyze-unison-v6.py`. The former v2 short-window peaks are superseded for these source layers.

P14/P15 identify first-slot priority when simultaneous saved events compete for Unison's four voices. The application now keeps the first event; later-time events retain stealing behavior. Root clamping is not reintroduced: the isolated note/pitch cases still preserve their different pitches.

Still pending: relative phase/beat envelope, absolute and short-window gain, exact per-note rate quantization, live multi-source entry/switch/release, other signal levels, and mobile/R1 verification. The v7 other-FX project is prepared but not yet recorded. Saved-FX14 slave synchronization remains separately pending; lowest filter cutoff error remains deferred.

V6 actual browser captures: median absolute wet/dry RMS error across24 isolated windows improves from0.68 to0.42dB; this is a median, not a worst-case bound. In P14/P15's80–240Hz dominant-band check, hardware is109.14/110.27Hz, old browser175.37/174.64Hz, new browser109.22/110.23Hz. Per-partial matched rate-fit errors (median of each case's mean error) improve1.83→0.13cents for FX5 and299.04→0.27cents for FX6; these are fitted spectral rates, not whole-waveform pitch accuracy.

### Other FX v7 capture — 2026-11-27

The valid recording has no clipping and reaches the final dry reference. Fitted octave glide times are approximately0.26seconds, with near-linear semitone change; activating the opposite effect resets to the base rate before its new glide. Releasing returns promptly to the base rate. The old35ms exponential-to-target model is replaced by4ms stepped exponential-rate progression over260ms, integrated by the same source-position model. Manual/future parameter changes cancel remaining glide events.

Native6/8 output at60BPM gives twelve evenly spaced hits per bar, selecting source steps1/2/3,5/6/7,9/10/11,13/14/15. The previous rounded mapping retained the wrong fourth note at a colliding timestamp. It now suppresses every fourth note while preserving the song/sync clock. SY1 and external paths apply the audio offset without moving the physical clock. Physical external-sync quantize remains to be checked.

Loop recordings contradict the current macro-loop approximation: FX1 repeats the captured slice during the tested span, FX2 interleaves normal and extra hits, and FX3/4 show recapture/termination behavior not explained by a constant frozen step. The four-step repeating test markers do not disambiguate full loop-window rules. Loop1–4 remain uncalibrated pending a longer nonrepeating diagnostic; no guessed rewrite is claimed.

Shutter9/10 rates at60BPM are consistent with4/3Hz. Reverse melodic direction is consistent and short reverse drums become largely inaudible before same-slot retrigger; exact trim/gate/click behavior remains pending. FX14 slave automation is still separately open. Lowest filter cutoff error remains deferred.

V7 actual browser captures reduce median pitch error across selected glide probes from440.8 to30.9cents; the remaining onset/control-delay and contour differences are not claimed fixed. Measured Shutter periods are0.25023/0.33418seconds. Numerical source/timing evidence is in `tests/fixtures/other-fx-v7-calibration-20261127.json`, generated by `scripts/analyze-other-fx-v7.py`.

Sync regression this round: all15 live FX passed in SY1 master mode. The current simulated slave run failed the live-FX7 grid assertion. A read-only baseline run serving pre-change HEAD app/effects/sampling/voice passed its live cases but failed the saved slave-FX14 grid assertion. Thus the external-slave family remains unreliable, but the exact FX7 failure is not proven pre-existing or fixed by this comparison. No complete slave pass is claimed.

Next diagnostic: `--loop-isolated` builds v8 with sixteen distinct220–1045Hz slice markers, dry references, FX1–4 spans starting on both step parities, alternating empty steps and a1→2→3→4 switch. Nominal64seconds at60BPM,2.56seconds sample pool. Protocol cells, allocations, FX and browser import/export checks pass; native capture is pending.

### Loop v8 capture — 2026-11-27

The stereo capture is143.35seconds with no clipped samples and peak about−21.93dBFS. Sixteen unique short tone markers expose a verified saved-FX3 recapture window: four half-step repeats per captured note, recapture after two nominal steps. This matches the even-entry, odd-entry and alternating-empty-step cases. The previous app repeated only the original captured note for the whole FX span. Only this saved-FX3 case is corrected; live gestures are not measured.

FX1/2/4 remain open. FX1 appears unchanged with160ms notes but held a400ms note in v7; FX2 interleaves regular notes and source-reset hits; FX4's grouped repeats and changing read identity are not reproduced by the current event-level model. These observations suggest length/read-position dependence but do not identify the firmware algorithm. A single-note/duration matrix is needed before replacing those engines. FX14 slave synchronization and the deferred lowest filter cutoff discrepancy remain open. Numerical evidence is stored in `tests/fixtures/loops-v8-calibration-20261127.json`; private audio stays outside Git.

In three saved Loop3 interior windows (even entry, odd entry and alternating empty steps), actual browser marker matching improves25%→100% within a40ms matching window. This validates slice identity/onset proximity, not sample-level waveform or exact transient identity.

Next capture v9 (`--loop-source`) isolates FX1/2/4 on single160ms/400ms/1s/2s chirps, with four dry reference patterns. Each pattern triggers one note only; a valid20ms silent pad at3.75s chokes tails before the next pattern. Effect spans end at3s. Nominal64seconds/60BPM; native allocation/checksum and browser import/export pass, hardware capture pending. This removes the intervening-note ambiguity from v7/v8.

### Loop source v9 capture — 2026-11-27

Valid142.85-second stereo capture, no clipping, peak about−20.91dBFS. Four durations (160ms/400ms/1s/2s) establish advancing read windows for saved FX1/2/4: period=step,4/3step,1/3step and repetition count4,3,8 respectively. The event-level macro-loop path is replaced for these saved modes; live holds are retained pending a hardware gesture test. The song/chain cursor continues normally.

Across the twelve selected v9 cases, the new actual browser capture has100% coverage of audible hardware probes and roughly2–13cents per-case median frequency error on non-boundary windows. End times differ by about2–13ms in this recording. Old coverage was partial in several cases, with large pitch/path errors. These are not worst-case waveform or gain bounds. Numerical data: `tests/fixtures/loop-sources-v9-calibration-20261127.json`; analysis: `scripts/analyze-loop-sources-v9.py`.

V8 cross-check: independent even/odd-entry and empty-step marker windows for all four Loop types now find matching source IDs/onsets within40ms. The initial2seconds of the mixed switch case improve70%→80% matching but remain incomplete. This cross-check does not assess extra low-level transients or phase identity.

Remaining: live touch/hold gestures, mixed-effect entry and switching, alternate tempo/pitch/locks and cross-pattern/bank behavior, mobile/R1 runtime and external-slave synchronization including FX14. Lowest filter cutoff discrepancy remains deferred.

Reader automation keeps original PCM/bank data unchanged. Filter tails across resets, live overrides and suspended-page recovery are software approximations rather than hardware-calibrated behavior; stale reset schedules are discarded after a long scheduling gap instead of replayed in a burst.
