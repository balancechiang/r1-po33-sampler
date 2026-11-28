# Remaining validation

## Current calibration summary — 2026-11-28

- V17 two-tempo comparison: actual browser source-ID agreement is90BPM86/96(short)/80/96(long),137BPM85/96(short)/96/96(long). These counts measure source selection, not full waveform fidelity. Remaining short-source differences vary across hardware passes; no deterministic firmware reset-order model is established.
- Saved native5→6→off: the bounded melodic-slot release policy passes the v16 two-pass set12/12; this supersedes older unresolved notes below, without claiming a universal Unison rule.
- Browser fixes after v17: late Loop callbacks advance the source clock before skipping historical emission; fallback same-slot/four-voice choke preserves current gain instead of forcing0.95. Both have failing-before/passing-after browser regressions.
- The sections below retain the chronological calibration history. The user requested a checkpoint commit/push on2026-11-28; version0.2.22 includes the accumulated calibration and ARMED work. Remaining hardware checks stay open. No release archive is prepared.

## Latest existing-recording pass — 2026-11-28

- Lowest filter code1/resonance1: magnitude fit improved; actual browser versus remeasured hardware RMS2.46→0.85dB on seven usable80–660Hz bins. Other resonance/phase behavior is not established by this result.
- Explicit Loop resets retain their measured retrigger envelope; ordinary stops use the smooth held-gain fade. Fresh output restores all independent Loop marker controls.
- Cancelling a voice during attack/fade: fixed a forced0.95 gain jump before release. Offline-render regression reproduces the old0.95 peak and bounds the corrected peak below0.49 for a1ms cancellation during a2ms attack.
- Unison global gain and5→6 termination: contradictory material-dependent observations retained; no universal rescaling or stop rule applied.
- Mixed Loop:27/29 markers matched; two early short-source reads remain unresolved.
- No new recordings, commits, pushes, deployment or release packages.


## Current sync software status — 2026-11-27

After the local first-pulse/restart fix, full browser integration passes all15 live FX in SY1 and simulated SY2, including restored step continuity/repeated chain order, plus saved FX14 in both modes. Synthetic slave assertions use the actual accepted pulse anchors/periods, not a frozen nominal240BPM origin. This supersedes earlier simulated-grid failures below. Physical slave timing/latency and stereo capture remain unverified; no new recording or deployment was made.

- Hardware sync: measure pulse level/width and test long-term phase, tempo changes, Swing and chain edits. User-confirmed first-start SY1 and post-FX sync are recorded below; other configurations remain unverified.
- Slave timing: calibrate the 40 ms scheduling cushion against direct audio and physical interfaces. Validate real stereo capture on target browsers.
- Sampling: ARMED threshold capture is implemented and browser-tested. The internal−32dBFS threshold and physical RECORD/pad-release behavior still need hardware comparison.
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

## Deferred-commit hardware validation batch

User instruction after ac7afca: keep subsequent calibration changes local; do not commit or push each round. Batch the changes only after the remaining feasible hardware verification is complete.

### Mixed FX and voice arbitration v10 — prepared, capture pending

Generate with `node scripts/build-calibration.mjs <directory> --mixed-voices`. The project uses10seconds of original synthesized PCM and a nominal64-second chain at60BPM. P01 is a position-chirp dry reference. P02–09 hold one chirp while switching1→2,3→4,11→12,5→6,7→8,1→11,11→5,15→1 respectively: dry0–1s, first effect1–2s, second2–3s, off3–4s. P10 uses a quarter-second dry gate on the same slot to clear tails before polyphony tests.

P11 staggers four pitched slots and introduces a fifth; P12 reverses the first four arrival orders; P13 retriggers the same slot before the fifth enters; P14 starts five slots simultaneously; P15 switches four already-ringing voices into Unison/Low; P16 repeats the dry voice reference. These cases distinguish onset-order stealing, fixed-slot priority, choke and multi-source FX entry. Native cells/locks, audio allocations, checksum, chain and frontend import/export checks pass. Hardware validation remains pending. No new runtime correction or public deployment is included in preparation. Use volume12/SY0/60BPM and keep the saved chain; record about75seconds without manual FX/knob operations.


### Mixed v10 recorded — local calibration batch, 2026-11-27

The134.1-second stereo recording has no clipped samples and a peak of−13.33dBFS. P09 confirms that entering Reverse on an existing note reverses its current read cursor, rather than ignoring the change or restarting at the sample end. The local runtime now handles active entry/release and stops at the source origin; fresh reverse note-on still reads from the trimmed end. Original PCM/native frames remain unchanged. Actual browser output is compared with hardware in `tests/fixtures/mixed-voices-v10-calibration-20261127.json`; the comparison covers only the selected P09 interior frequency probes, not all FX or bit-exact output.

Unresolved evidence from this capture: P11/P12/P14 retain the first four pitched components when a fifth is introduced; P13 makes the fifth component audible later. This contradicts a simple universal oldest-first stealing rule, but does not yet distinguish muted read-head continuation, priority mixing or deferred event behavior. Do not replace the allocator with a drop-only rule from this observation. P15 retains multiple pre-existing sound identities when Unison is engaged, unlike the current recreate-each-group path. P05 shows separated source positions under active Unison; P03 exposes a held-source Loop3 case missing from the event-only recapture model. These are recorded mismatches, not completed corrections. Existing native note-on Unison and prior Loop marker calibrations remain scoped to their measured cases.

No commit, push, release package or public deployment in this round. The lowest filter cutoff discrepancy and external-slave FX14 remain open as before.

P09 measured interior pitch error falls from a median564.2cents before correction to2.1cents after correction. The post-origin browser tail becomes silent in the2.15–2.8second window, matching the observed termination instead of being recaptured by the following Loop1. This is one saved60BPM transition case, not a general error bound. Core checks, step-FX browser regression, source/Unison/Reverse regression and both entry-page resource checks pass.


### Voice priority v11 — prepared, hardware capture pending

`--voice-priority` produces16patterns at60BPM (64seconds),21seconds of original PCM and about142.39seconds of backup audio. Five separately allocated pure sine sources233/349/487/653/887Hz remove the harmonic/shared-buffer ambiguity from v10. A sixth3.5-second ascending pure chirp distinguishes source position from pitch. P01–06 isolate dry, pre-note and ringing-source Unison/Low entry/switch; P07–09 use two/four occupied sources; P10–13 test five-note admission, staggered gate expiry, reversed identity and same-slot replacement; P14–15 add notes after Unison note-on; P16 isolates ringing-source Loop3. Gates/source lengths avoid cross-pattern tails. Capture with SY0, master volume12, unchanged60BPM/chain1–16. All native cells, allocation bytes, checksum, chain and frontend import/export/play checks pass. No runtime changes, commit or push for this preparation.


### Voice priority v11 capture — local corrections, 2026-11-27

The122.75-second stereo capture has peak−16.07dBFS and zero clipped samples. Dry P10–13 establish that the first four sounding sources remain audible when a fifth starts; the fifth becomes audible after an existing gate expires, without another note-on, and still ends at its original gate deadline. Reversing the original source identities and same-slot replacement reproduce this. The local dry allocator now masks excess sources rather than killing the oldest sound; selected voices are admitted in start order, keeping at most four audible. Scheduled gain masks retain the source clock and gate; original PCM and backup bytes are unchanged. Arbitrary slot-priority and hidden-source phase/cursor equivalence are not established by these cases.

Across28 interior probes on these four dry patterns, actual browser component-presence matches improve17/28→28/28. This measures binary presence at the five known pure-tone frequencies, not sample-exact amplitude, phase or transition clicks. Source and measurements: `scripts/analyze-priority-v11.py`, `tests/fixtures/voice-priority-v11-calibration-20261127.json`. Unit coverage includes fifth-source masking, delayed admission, same-slot choke and original gate preservation. Existing FX allocation remains separate pending calibration; dry pitch/gate replanning refreshes masks instead of applying legacy stealing.

Unison is NOT resolved: separately allocated sine sources show that entering FX on multiple already-ringing slots differs from independent four-layer recreation per slot. P07–09 contain identity/read-offset changes, while P14–15 confirm a later Unison note can replace the current group. V10 shared backing PCM versus v11 separate source allocations also changes the observable mixtures; do not infer a simple root-clamping or bus-chorus algorithm. Additional analysis of captured positions/allocation boundaries is needed before replacing this path. Held-source Loop3 P16 also remains open. No new capture is required merely to retain these unresolved observations.

Checks: core suite, actual frontend capture/import/play, source/Unison/Reverse and step-FX regressions pass. All work remains local and uncommitted; no push or deployment.


### Unison memory v12 — prepared, capture pending

`--unison-memory` generates a64-second16-pattern60BPM chain,6seconds of original PCM, and about44.99seconds of backup audio. A four-second220→880Hz exponential chirp supplies shared zero-offset/nonzero-offset views. A separately allocated byte-identical copy of the1–3second selection tests absolute backing offsets without content changes. P01–02 dry references; P03–04 pre-note Unison; P05–08 ringing-source Unison/Low entry; P09–12 two-source shared/independent and arrival-order comparisons; P13–16 held-source Loop3 with full/zero-offset/nonzero-offset/independent source selections. Effects are saved; no manual performance gestures required. Each note uses a3-second gate to leave a tail-clear interval before the next pattern. Native checksum, exact sound allocation bytes, all cells/locks, FX and frontend import/export/play checks pass. Capture with SY0, volume12, unchanged chain and tempo. No runtime change, commit or push for this preparation.


### Unison memory v12 recorded — local Loop3 correction

The104.2-second stereo recording has peak−15.36dBFS, zero clipped samples, and a complete first pass. Matched selected PCM in shared/nonzero-offset versus independently allocated storage gives near-identical dominant-frequency trajectories: median differences below0.8cents across P01/02,03/04,05/06,07/08,09/10 and15/16 pairs. These comparisons do not establish identical waveforms, but do not support a backing-memory-only explanation for the earlier multi-source Unison mismatch. Multi-source active Unison remains unresolved; no speculative source-identity rewrite was applied.

P13–16 establish the missing saved held-source Loop3 path. An existing ringing source continues through half-step read windows, each repeated four times, then advancing. The runtime now uses that reader when the current pattern contains no new notes during its FX3 spans; patterns with recorded FX3 notes retain the v8 measured event-recapture path. This is intentionally limited to measured cases: hybrid note/tail spans, cross-pattern differences and live holds remain open.

Actual browser output improves from0/36 audible held-FX probes to36/36, with per-pattern median pitch error3.5–4.2cents. Tests cover the measured read trajectory on full, zero-offset, nonzero-offset and independent-copy selections, plus existing event-based Loop/Scratch/Reverse regressions. Evidence is in `tests/fixtures/unison-memory-v12-calibration-20261127.json`; reproducible offline comparison in `scripts/analyze-memory-v12.py`. Original PCM and native frames remain unchanged. No commit, push, release package or deployment.


### Unison order v13 — prepared, hardware capture pending

`--unison-order`:13seconds of original PCM, about91.01seconds of backup audio,64-second16-pattern chain at60BPM. Four separately allocated233/349/487/653Hz pure tones and a3-second220→880Hz chirp isolate source identity from reader position. P01–08 exchange first/second arrival and slot numbers with FX5/6 entering0.75s; P09–10 reverse the four-source arrival order; P11–14 compare single-chirp Unison onset/entry times; P15–16 swap chirp/fixed-tone arrival. Gates and source lengths clear before the next pattern. All saved FX; no manual gestures. Checksum, native allocation bytes, all note/lock cells, chain and actual browser import/export/play checks pass. Capture at SY0/volume12 without changing tempo/chain. No runtime change, commit or push in preparation.


### Unison order v13 recorded — local source-selection correction

The129.95-second stereo capture has peak−16.19dBFS and zero clipped samples. Swapping entry order and slot identities resolves the active-source selection ambiguity: FX5/6 retain the lowest-numbered ringing sound in the tested combinations (1/2,1/4,3/4 and3/5), regardless of which entered first. Other original sources do not return after release. Four-source reverse/forward arrival and fixed-tone/chirp exchanges corroborate this. The previous runtime recreated each source in list order, leaving the final source group; active Unison now explicitly selects the lowest eligible slot, preserves its cursor/gate and removes the other ringing entries. Already scheduled future notes are retained. Fresh-note Unison allocation is unchanged.

Across33 fixed-tone dominant-source probes during and after FX, actual browser matches improve19/33→33/33. Evidence: `tests/fixtures/unison-order-v13-calibration-20261127.json`, reproducible analysis `scripts/analyze-order-v13.py`. This classification does not measure all per-layer trajectories, phase, gain or subdominant components. V11's residual components and fine single-chirp phase/rate behavior remain open; no claim of bit-exact Unison. Browser tests cover both source arrival orders and non-revival on release; existing source/Reverse/Scratch, step-FX and core checks pass. No commit, push, package or deployment.


### Unison layers v14 — prepared, capture pending

`--unison-layers`:12seconds of original PCM, about84.59seconds of backup audio;16patterns/64seconds at60BPM. P01–06 use a997Hz pure tone to resolve close Unison layer frequencies/gains and entry/switch phases. P07–11 use a997→1994Hz exponential chirp with different FX entry times. P12–14 use the complementary descending chirp to distinguish pitch ratio from cursor offsets. P15 switches FX5→6 on a rising chirp; P16 adds known half-second amplitude landmarks with3ms smoothing. Each note has a3-second gate and a one-second clearing interval. All FX are saved; capture at SY0/volume12 with unchanged tempo/chain. Native checksum, exact allocation bytes/cells/locks and frontend import/export/play pass. No runtime change, commit or push during preparation.


### Unison layers v14 recorded — measurements retained, no runtime fit

The113.95-second stereo recording contains the full chain, peaks at−19.95dBFS and has zero clipped samples. The997Hz source resolves distinct spectral components: fresh FX5 around980.90/991.12/1001.34/1013.49Hz versus ringing-source FX5 around980.90/991.12/1001.34/1011.56Hz in the selected windows. Fresh FX6 includes494.59/991.58/997.93/1001.34Hz; active/switch windows have different nearby upper components. Peaks must not automatically be labeled independent voices: modulation, beating and residual components can produce additional spectral maxima.

Selected-window RMS relative to P01 dry is about2.28 for fresh FX5,2.40 for fresh FX6,1.22 for active FX5 and1.31 for active FX6. These are recording/window observations, not fitted per-layer gain constants. The difference exposes a limitation of a single fixed four-layer gain/rate model across note-on versus active entry. Earlier110Hz harmonic fits and current997Hz pure-tone observations do not justify blindly replacing all runtime gains or detune rates. A consistent entry-sensitive model and cross-frequency validation are still required. Chirp per-layer cursor/rate/phase decomposition remains unresolved; no bit-exact claim.

Reproducible audit: `scripts/analyze-layers-v14.py`; data `tests/fixtures/unison-layers-v14-observations-20261127.json`. This round stores measured evidence only and makes no runtime correction, commit, push or release. Existing v13 source-selection and v12 held-Loop3 corrections remain local. No further hardware action is needed until the existing chirp recordings have been analyzed or a specific unresolved hypothesis requires a new capture.


### V14 existing-recording analysis — entry-specific Unison tuning

Fixed997Hz windows P04 and the FX5 portion of P06 independently show active-entry rate ratios approximately[0.98388644,0.99413750,1.00437673,1.01464844]. The last two differ from the prior shared/fresh-note profile. Active FX5 entry/switch now carries an explicit entry flag and uses these rates; fresh note-on, FX6 rates and all gains remain unchanged. The four predicted fixed-tone frequencies are within0.12Hz of both selected recorded windows. Source cursor, PCM and gate are preserved.

Actual browser before/after comparison against existing rising/falling chirps uses normalized spectral-distribution distance, not waveform or gain matching. Median distance in rising P09 falls3.80→2.92Hz, later-entry rising P10 falls3.82→3.17Hz, rising P15 before its FX6 switch falls3.76→2.82Hz; descending P13 changes3.65→3.70Hz (slightly worse). Thus this is a supported fixed-tone/entry-rate correction, not a complete reader-trajectory fit. Phase, source-position dynamics, FX6 and entry-dependent gain remain unresolved. No broad gain adjustment was inferred from RMS/beat differences.

Evidence `tests/fixtures/unison-entry-fit-v14-calibration-20261127.json`, analysis `scripts/analyze-layers-fit-v14.py`; prior hardware observations remain in the v14 observations fixture. Tests check the two measured fixed-tone windows, separate fresh tuning, application entry profile, source-selection/Reverse/Scratch regressions and core behavior. All changes remain local/uncommitted/unpushed; no public deployment or release package.


### Existing v14 recordings — Unison release cursor correction

An isolated low-octave chirp fit gives playback rates0.496002 (ascending) and0.496151 (descending), source positions0.49854/0.49820s at the0.5s entry, residual median errors below0.05cents within those fitted windows. This supports the existing0.49609343 low-leg rate and current-position entry; no low-rate adjustment was made.

Post-release single-source chirps instead reveal a real cursor error: dry output returns near the original normal-speed timeline, not the first detuned layer position. The runtime now retains a separate dry cursor across Unison/Low and restores it on release. A separate analytical Speed timeline also follows manual/locked pitch targets with the same15ms smoothing, while the original note gate remains unchanged. Stored PCM/native frames are untouched. Complex inter-FX switch termination remains unvalidated; v14 P15 has no usable post-release signal and is excluded from the release comparison.

Six actual browser release-window comparisons improve median pitch errors from[19.95,15.41,11.61,5.23,15.76,4.26]cents to[3.71,2.51,1.92,0.12,2.84,0.06]cents (P08/09/10/11/13/14). Evidence: `tests/fixtures/unison-release-v14-calibration-20261127.json`; analysis `scripts/analyze-unison-release-v14.py`. These are selected post-release frequency windows, not general waveform/gain accuracy bounds. Core, source selection, dry cursor restoration, Reverse/Scratch and step-FX regressions pass. Gain, multi-layer phase and mixed-effect termination remain open. No commit, push, release package or deployment.


### Saved mixed Loop correction — existing v8/v10 recordings

Loop3 now shares the source-reader clock with Loop1/2/4 instead of choosing a held-source or event-recapture engine based on all notes in the entire pattern. New notes are accepted at each four-reset window boundary; intermediate note events do not replace the captured source. Existing ringing tails can continue through empty steps. At a change of Loop type, a coincident new note also resets the stored repeat origin, preventing later resets from reverting to the previous source. Normal transport/chain timing continues. Live/manual holds remain on the prior uncalibrated path.

V8 independent even/odd-entry and alternating-empty-step cases for all four Loop types retain100% matching of selected hardware marker identities/onsets within40ms. Complete P15 (Loop1→2→3→4) improves25/29→27/29 matches; an intermediate prototype regressed to17/29 and was corrected before retaining the final change. Two early Loop1 source markers remain mismatched (around0.764/0.925s). Do not infer a special wrap rule from this one recording. Matching recall does not measure extra artifacts, waveform identity or all gain envelopes. Report: `tests/fixtures/loop-mixed-v8-calibration-20261127.json`; analysis: `scripts/analyze-loop-mixed-v8.py`.

V10 held-source cross-check: Loop1→2 and Loop3→4 each have35/35 audible interior probes, median frequency errors about2.1 and5.0cents. The report's before capture predates the v12 held-source fix, so the missing-to-audible improvement is historical and is not attributed wholly to this change. Report/analysis: `loop-mixed-v10-calibration-20261127.json` / `scripts/analyze-loop-mixed-v10.py`.

Application tests cover intermediate-note suppression, next-window capture and new-source repeat origin at a Loop4 boundary. Existing step-FX tests now assert scheduled source cutoffs rather than the removed artificial per-hit gate. Core checks and source/Unison/Reverse/Scratch regression pass. Arbitrary long-tail-plus-new-note combinations, cross-pattern/bank changes, alternate tempo/parameter locks, live gestures and the two remaining markers are not hardware-verified. Original PCM/backup format untouched. No commit, push, package or deployment.


### No-new-recording validation pass — 2026-11-27

Reproduced a software resource-lifecycle defect with five dry sources: after explicitly cancelling the first source, the waiting fifth source's mask stayed at0 until the old planned end. Cancellation and early cutoff now update the logical end and rebalance the remaining output masks at the effective audio time. The waiting source becomes audible without restarting its gate or cursor. Browser regression first failed (gain0 before and after cancellation) and passes after correction for both cancellation and cutoff. This is a software scheduling correction, not new evidence of arbitrary hardware slot priority.

Existing recordings were also re-audited for Unison5→6→off termination. V14 P06 fixed tone continues immediately after off (RMS ratio about0.48/0.71 at+0.1/+0.4s); V14 P15 and v10 P05 chirps fall to the noise floor; v6 P12 continues. An unconditional kill-on-switch rule would break measured cases and was not applied. Reproducible analysis: `scripts/analyze-unison-switch-end.py`; measurements: `tests/fixtures/unison-switch-end-audit-20261127.json`. Gain decomposition and the two remaining v8 Loop markers remain insufficiently determined; no one-recording special cases were added. Lowest filter cutoff remains deferred as requested.

Latest checks: core suite, both entry-page resources, step-FX, source/Unison/Reverse/Scratch/mixed-reader tests and v14 native import/export/play all pass. `tests/test-sync-fx.py` passes SY1 with all15 live FX, but fails simulated SY2 at FX1 with a restored tick around33.64 instead of an integer grid position. This is an integration-test failure in the synthetic two-AudioContext input setup; it is not proof of hardware failure and is not waived. The full script stops there, so later slave/saved-FX14 checks are not claimed to pass in this run. External-slave clock alignment remains open; sample-thread sync unit tests pass.

All work remains local, uncommitted and unpushed. No recording, release package or public deployment was performed in this pass.


### Slave startup timing — no new recording

Separated two issues in the earlier synthetic-clock failures. The integration test incorrectly compared external voices to a frozen nominal62.5ms grid, although its input runs through a separate AudioContext/MediaStream and the receiver updates each pulse period. Slave assertions now compare against the accepted even/odd pulse grid, retain the original0.06-step tolerance, check exact note/chain identity, and additionally require consecutive restored ticks. This is a test-oracle correction, not a claim that every previous failure was a runtime defect.

With that correction all15 live FX passed in both SY1 and simulated SY2, but the saved-FX14 startup check exposed a real receiver defect: the first received pulse used a hardcoded120BPM or stale period to predict the intervening odd step. The worklet now seeds period=30/currentBPM on every start. The next measured edge still updates the estimate normally. Unit tests cover first pulse and restart at60/132/240BPM, plus160 changing pulse intervals preserving repeated chain indices.

After the runtime correction the complete browser suite passes SY1/SY2 all15 live FX and saved FX14 in both modes, including the new missing/duplicate-tick assertion. Core and source/Unison/Reverse/Scratch/mixed-reader checks also pass. Actual initial external tempo cannot be known from one pulse if it differs from the configured BPM; fast tempo changes, device stereo input and physical latency remain hardware checks. No microphone recording, commit, push or deployment.


### Lowest filter endpoint and cancellation envelope — 2026-11-28

Reopened the previously deferred lowest-cutoff discrepancy using the existing filter-v3 recording. The old fitter fixed gain at0dB for all resonance1 entries, forcing code1 into an almost-first-order pole approximation with about2.31dB RMS error. Only this deepest measured endpoint now permits an attenuation parameter. Fitted magnitude RMS is about0.735dB at44.1/48/96kHz. Alternating withheld frequency sets yield1.46/1.53dB, so neither the fitted nor withheld errors are zero and the single observation is not treated as a general firmware model. Only the three sample-rate table entries for1:1 changed; all other measured entries are identical.

Actual browser output was captured and compared with the original hardware WAV using identical0.12–0.46s per-cell least-squares multisine windows, normalized to the first dry pattern. Against the stored fixture, endpoint error falls2.29→0.735dB; against hardware remeasured in those windows it falls2.46→0.851dB. The hardware remeasurement differs from the prior fixture by0.49dB, documenting window/noise uncertainty. Scope: seven usable bins around80–660Hz, native code1/resonance1. No low-frequency/phase/high-resonance guarantee. Evidence `tests/fixtures/filter-endpoint-calibration-20261127.json`; analysis `scripts/analyze-filter-endpoint.py`. Tests cover all three output sample rates and withheld-bin checks; native filter/resonance export remains unchanged.

A separate cancellation-envelope regression rendered a constant source with a2ms0→0.95 attack and cancellation at1ms. The old cancellation code reset gain to0.95, creating a discontinuity and an unnecessary peak. Cancellation now holds the scheduled gain at that audio time and fades from it; fallback uses current gain instead of a fixed full level. The rendered old peak0.95 fails the new<0.49 assertion; the corrected envelope passes. This verifies elimination of the software gain boost, not hardware-identical transient shape. Loop/source/Unison/Reverse/Scratch regressions and filter native import/export/play checks pass.

Unison gain audit `tests/fixtures/unison-gain-cross-audit-20261127.json` preserves the incompatible selected-harmonic/pure-tone ratios instead of overwriting all gains. Existing switch-end recordings still show both continued and terminated cases. Nonzero source allocation correlates with the two terminating chirp cases, but does not establish cause or justify a pointer-dependent stop rule. Remaining Loop markers likewise lack a verified general replacement rule. These remain documented limits; no new audio was requested or recorded. Everything stays local/uncommitted/unpushed.


### Follow-up cross-check and retained retrigger fix — 2026-11-28

A prototype retained the Loop1 origin through incoming short notes and gave it priority at the fourth reset. It reproduced the two missing mixed markers (P15 becomes29/29), but independent even/odd-entry Loop1 controls fell100%→37.5%. It therefore fails cross-validation and is NOT retained in production. Audit: `tests/fixtures/loop-window-candidate-audit-20261128.json`. No pattern-specific workaround was added.

Fresh actual-output comparison also caught a regression introduced by generic cancellation smoothing: the three independent Loop4 windows dropped to about69.6% marker matching. This was not caused by the Loop1 prototype. Ordinary stopping and explicit source-window retriggering now use separate cancellation policies. Ordinary cancellation retains the held-gain fade (including the offline attack-cancellation regression); only `emitReader` requests the previously calibrated retrigger envelope. Final fresh browser capture restores all12 independent Loop1/2/3/4 windows to100% selected-marker recall within40ms, while complete mixed P15 remains27/29. Data: `tests/fixtures/loop-retrigger-envelope-calibration-20261128.json`. This is marker recall, not waveform identity or a guarantee of no extra transients.

Core, source/Unison/Reverse/Scratch, mixed-reader and step-FX regressions pass with the explicit reset policy. Existing lowest-filter and slave startup corrections are retained. No new microphone recording, commit, push, release package or deployment. The two mixed Loop markers and material-dependent Unison gain/termination still lack a universal model supported by the current recordings; they are not marked complete.


### History/boundary v15 — new automatic capture prepared, 2026-11-28

`--history-boundaries`:16.56seconds of original PCM,111.40seconds of backup audio;64-second16-pattern chain, recommended two passes (~128s music,145s recording allowance). P02/04/06/08 are byte-identical Loop1→2→3→4 probes preceded respectively by dry markers, full-bar FX4, FX4 with a1s dry gap, and full-bar FX1. P09–16 compare dry versus5→6→off on a first-slot chirp, a byte-identical1s-offset chirp, a later-slot997Hz tone, and its byte-identical1s-offset pair. The chirp-first/sine-later arrangement reverses the earlier v14 allocation/content correlation. First pattern includes timing markers; selected note gates3s leave a clearing interval. Two passes allow repeatability checks rather than assuming a silent lead-in erases firmware state.

Assertions enforce identical selected PCM and identical Loop probe pattern bytes. Native checksum, exact allocation bytes, all note/lock cells and FX set1–6 pass, along with actual browser import/export/play. Capture pending at60BPM/SY0/volume12 with no manual gestures; do not start until recording is confirmed. No application runtime change, commit, push or release package during preparation.


### History/boundary v15 recorded — 2026-11-28

Valid167.1-second stereo capture, onset about14.165s, peak−20.79dBFS, zero clipped samples, two complete64-second passes analyzed. Byte-identical Loop probes confirm history/phase dependence, not a single predecessor rule: first pass P06 contains the anomalous1/2 source reread near0.75s; second pass P06 is normal while P08 rereads source1 at several boundaries. No deterministic predecessor lookup or random-reset behavior was added.

Switch-release contrast repeats in both passes: P10 first-slot chirp continues after5→6→off; P12 matched offset chirp and P14/P16 fixed tones terminate at release. This reverses the earlier content/allocation correlation, showing chirp content alone does not explain termination. Slot identity and allocation ownership are still confounded, so no blanket non-first-slot/address stop rule is claimed. These cases remain unresolved, not silently counted as corrected. Analysis/data: `scripts/analyze-history-v15.py`, `tests/fixtures/history-boundaries-v15-calibration-20261128.json`.

A small active-FX5 gain correction is retained. Pre-v15 held-source chirp/harmonic comparisons indicated roughly0.82–1.70dB under-gain; robust median rounded to0.05dB gives1.15dB. V15 was held out: actual browser versus the eight two-pass wet/dry comparisons improves median absolute error1.740→0.624dB. All four source arrangements improve, but CW and beating residuals remain. Only ringing-source FX5 gains change; fresh-note FX5 and all FX6 gains stay unchanged. This is not an individual-layer gain or complete nonlinear model. Training/scope: `tests/fixtures/active-unison-gain-calibration-20261128.json`.

Core, source selection, Unison/Reverse/Scratch, dry cursor, cancellation, mixed-reader and step-FX checks pass. Original PCM/native project data unchanged. No commit, push, release package or public deployment.


### Ownership/phase v16 prepared — 2026-11-28

`--ownership-phase`:11.81seconds of original PCM,81.44seconds of backup audio,64-second chain; two passes/128seconds music,145seconds capture allowance. Six melodic slots select byte-identical3-second997→1994Hz chirps. Slots1/2 reference owner0/start0; slots3/4 reference owner0/later identical window after3.25s; slots5/6 reference independent owner4/start0. P01/P08 are dry controls; P02–07 apply5→6→off to the six slots in order. These contrasts distinguish selected slot, same backing owner and within-owner read start without changing content.

P09–12 vary Loop1 entry phase0/.25/.5/.75s on the same marker grid, each with a second identical window2s later and1s dry between. P13 holds FX4 to the boundary; P14 is byte-identical to P09. P15 ends FX4 with1s dry; P16 again equals P09/P14. Source/PCM, exact owner records and identical probe bytes are asserted. Full native checksum/allocation/cell/FX/chain validation and browser import/export/play (including native owner references after export) pass. Capture pending; use60BPM/SY0/volume12, do not play until capture is confirmed. No runtime change, commit, push or release package for preparation.


### Ownership/phase v16 recorded — 2026-11-28

The166.55-second stereo capture has peak−15.83dBFS and zero clipped samples. A short pre-play transient at13.945s is excluded; the first sustained three-second chirp starts16.482s. Two complete64-second passes are analyzed. Alignment is based on the long known reference, not the first audible transient.

Both passes resolve the earlier ownership hypothesis: sound1 continues after saved5→6→off, while sounds2–6 stop. Sound2 shares the exact same owner0/start0 bytes as sound1, so storage location alone cannot explain it. Later owner0 windows and independent owner4 windows give the same non-first-slot termination. The retained compatibility policy reproduces this observed slot-dependent release only when nativePCM audition is active and the sequence is saved automation: after switching5→6, release stops the active non-first-slot tail. This is an empirically bounded behavior, not a claimed general firmware mechanism; other selected device state, live gestures and non-native synthesis are not inferred. The policy does not delete samples or alter patterns.

Actual browser before/after release-presence comparison improves2/12→12/12 against the two-pass hardware set. Tests verify sound1 continuation, non-first native saved-tail termination, unchanged live/non-native and single-FX release, and uninterrupted future note scheduling. A regression test caught queued future dry notes remaining muted when the active native tail was removed; the release branch now rebalances those masks, preserving their original start/gate. Core, source/Unison/Reverse/Scratch, step-FX and native v16 import/export (including owner references) pass. Evidence/analysis: `tests/fixtures/ownership-phase-v16-calibration-20261128.json`, `scripts/analyze-ownership-v16.py`.

Loop-phase results still reject a simple fixed predecessor/entry lookup: identical probes vary between passes, including normal P14 in one pass versus old-source repeats in the other, and second-window changes within the same bar. A separately clocked/reset-order mechanism is a hypothesis, not established by these recordings. No pseudo-random emulation or fixture-specific reset table was introduced; this part remains unresolved. No new recording was requested, and no commit, push, package or deployment was performed during analysis.


### V16 follow-up scope and phase audit — 2026-11-28

Narrowed the saved native5→6 tail compatibility rule to the melodic family. V16 measured only melodic sounds1–6; applying it to drum kits was unsupported. A new browser regression first reproduced unwanted drum-tail removal, then passes after excluding slots9–16. Another test confirms that a fresh note triggered during FX6 clears the prior note's switch history and survives normal release. Live, non-native, single-FX, queued-note and existing source/Loop/Reverse/Scratch checks remain passing. Melodic7/8 extrapolation is not an additional measured case.

Numerical phase audit over the v16 Loop windows finds8/12 identical window pairs differ between passes. All24 windows retain the original read origin after their first observed old-origin override, consistent with a persistent reader/reset ordering state. However, the triggering order itself is not identified by the current60BPM-only measurements; changing only the preceding FX or entry step cannot predict it. Source-ID marker timing is not a direct measurement of microsecond DSP callback order. Analysis/data: `scripts/analyze-loop-reset-order.py`, `tests/fixtures/loop-reset-order-v16-20261128.json`. No arbitrary predecessor table or randomized playback was introduced.

Further predictive Loop timing correction needs a non-60BPM counterexample (for example90/137BPM with identical note/FX layout and repeat passes), or direct firmware timing evidence. Current data can verify the persistent-reader behavior but cannot validate the missing timer-phase model. No new capture was started; user should be told before the next recording round. No commit, push or release package.


### Clock phase v17 prepared — 90/137BPM pair, 2026-11-28

`--clock-phase --bpm=90|137` generates two projects with identical native pattern/sound bytes. Decode comparison verifies the sole global-byte difference is second-record tempo offset129 (90 versus137); derived packet checksum/modulation naturally differ. Both use3.44seconds of original PCM and30.10seconds of backup audio. Two-pass music duration is85.33s at90BPM and56.06s at137BPM.

Each project has two8-pattern blocks:55ms distinct marker sources and original160ms markers. The short set ends before a step at either tempo, controlling tail overlap rather than treating all speed effects as clock evidence. Each block contains dry reference, Loop1 windows shifted0/1/2/3steps, full-bar FX4 conditioning and byte-identical zero-shift probes. Repeat two passes; no manual FX. Native checksum, sound allocation, all cells/FX/chain and actual browser import/export/play pass for both tempos. Test assertions now read expected BPM from the profile manifest rather than assuming every extended profile is60BPM. No application runtime modification, commit, push or release package in preparation. Record90BPM first, then137BPM separately; SY0/volume12.

### Clock phase v17 measured — 2026-11-28

Saved the 90BPM capture (153.65s, peak −21.87dBFS) and the valid 137BPM retake (99.50s, peak −22.14dBFS), both stereo44.1kHz and zero clipped samples. The cancelled first137BPM take is excluded. Each analysis uses two full passes. Linear clock fits to64 dry-reference markers give89.9943/136.9884BPM with maximum peak residual1.50/2.04ms; comparisons therefore do not accumulate nominal-clock drift.

Actual two-pass frontend captures preserve both imported chains and saved FX. Comparing the four step-boundary source identities in each Loop1 window gives90BPM short86/96 and long80/96 matches;137BPM short85/96 and long96/96. These are source-ID agreement counts, not waveform-fidelity percentages. In particular, all24 long-source137BPM windows retain the entry slice through the window and match the existing reader engine. The160ms source outlasts the109.5ms step here, whereas it ends before the166.7ms step at90BPM. This supports active-source survival as a relevant condition; a blanket replacement with note retriggers would regress the confirmed137BPM case.

Short-source windows still differ between passes at both speeds; across both source banks13/24 paired windows differ at90BPM and6/24 at137BPM. Some90BPM short-source windows resume a later new slice after an old-origin read, so the persistent-origin observation from v16 is not universal. Neither a fixed predecessor table nor permanently retaining the first origin explains this set. The exact sub-step reset/order mechanism remains unresolved; no fabricated jitter or tempo/pattern lookup was added. Existing runtime is retained. Core checks plus actual browser step-FX and source/Unison regression suites pass. Numerical evidence: `tests/fixtures/clock-phase-v17-calibration-20261128.json`; reproducible audit: `scripts/analyze-clock-v17.py`. No commit, push, release package or further recording started.


### Late Loop callback source-clock fix — 2026-11-28

A deterministic browser regression reproduced a separate scheduling fault: drainReaders marked a boundary as alive but skipped both source-position calculation and emission when the callback was more than2ms late. readerNote on that boundary then consumed an absent resetPosition (non-finite AudioParam exception), or an old resetPosition after earlier ticks. Source-window/chunk bookkeeping now advances even when historical sound emission is skipped. On-time scheduling and the calibrated reader transition envelope are unchanged.

The browser regression failed before the fix with a non-finite linearRampToValueAtTime exception and passes afterward. It covers the first missed boundary and4/8 missed ticks, checking finite positions and a source anchor within one source sample of the advanced window. Core checks, step-FX and full source/Unison regression pass. This fixes a real browser-delay error; it does not establish the unresolved firmware reset-order mechanism or claim new hardware source-ID agreement. No additional capture, commit, push or package.


### Fallback choke gain spike — 2026-11-28

When cancelAndHoldAtTime is unavailable, cutSampleVoice previously set a sounding voice to0.95 before its2ms release, regardless of its current gain. An offline-rendered constant-source test with gain0.2 and the API explicitly disabled reproduces an unwanted0.9401 peak. The fallback now captures AudioParam.value before cancelling future automation and fades from that value, consistent with ordinary cancelVoice. The regression bounds the rendered peak at0.201. This fallback is a conservative current-value approximation for future scheduled cuts; exact future envelope reconstruction is not claimed. The supported hold API path, future-voice zeroing, four-voice allocation, and explicitly calibrated reader-reset envelope are unchanged.

Core, source/Unison and step-FX suites pass. No new hardware recording was needed; no commit, push or package.


### Live Unison lookahead isolation — 2026-11-28

Live Unison entry previously selected the lowest slot across both ringing and queued voices, cancelled all of them, and recreated just that one source. A lower-slot future note could therefore silence the currently ringing slot before its intended onset and consume other queued musical events. Saved automation already excluded these future notes.

Live entry/switch/release now select ringing voices separately. Queued fresh events are regrouped at their original onset: Unison/Low use the lowest simultaneous slot with four fresh layers; release collapses each queued Unison group to one dry event. Original note/gate and source-pad selection are retained. A browser regression queues slot1 after ringing slot3 and confirms slot3 continues before the boundary, then slot1 starts at the original time with the original0.3s gate. It tests entry5, switch6 and release0; dry release permits both slots to sound under the normal four-voice limit. A routed pre-fix replay fails the isolated regression with no ringing voices; the fixed version passes. Existing saved native release scope and calibrated Unison rate/gain profiles are unchanged.

Core, source/Unison and step-FX tests pass. This is a lookahead event-preservation fix, not a new hardware timbre calibration. No additional recording, commit, push or package.

Full browser sync regression also passes: SY1 and simulated SY2 across all15 live FX, repeated-chain/grid restoration, and saved FX14. Physical slave input remains unverified.


### Sampling ARMED implementation — 2026-11-28

Musical capture now sends an `arm` command to the AudioWorklet. The three application phases are idle/armed/recording; `rec.on` continues to mean the entire busy session so playback/import/reset exclusion also covers waiting. Armed input is metered continuously but emits no PCM chunks and consumes no sample frames. The first processed mono sample whose absolute value reaches the internal−32dBFS constant starts capture, including that sample. Capture then retains silence until release or the exact worklet-owned capacity boundary. The existing internal `start` worklet command remains an immediate-capture compatibility path; application sampling uses only `arm`.

Threshold is evaluated after the selected musical-input gain/auto-level processing. Its value is an implementation calibration constant, not an official measured firmware specification. No unverified15ms pre-roll was introduced. Stereo backup capture is unchanged. Old slot PCM, trims and storage remain intact during waiting; replacement capacity excludes the target slot without freeing buffers still shared by other slots. Cancelled/too-short/error takes restore the previous sample; successful capture commits new PCM and resets its trim metadata.

LCD waiting uses blinking `rec`, input meter remains active and memory stays stationary. After trigger the remaining-seconds countdown starts. Physical RECORD may remain held after releasing the pad once recording has triggered. Releasing the pad while still armed cancels waiting. Single-finger latched RECORD keeps its existing pad-release-to-finish behavior and releases the microphone; pointer cancellation rolls back the active take. Releasing RECORD ends recording and microphone access. There is no silence auto-stop.

Worklet tests at44.1/48kHz verify subthreshold waiting, input metering, exact crossing sample, retained silence, hard capacity, stale stop IDs and empty cancellation. Actual browser tests verify unchanged old PCM/memory while armed, blinking LCD, trigger/countdown, physical pad release with continued recording, HOLD finish/mic release, transfer draining and disconnect rollback. Sampling integration now expects three real hits rather than an extra silence-anchor slice; its four-voice assertion counts audible masks rather than dormant allocated dry voices, matching the earlier v11 admission model. Core, recording and sampling integration pass. No new hardware recording, commit, push, deployment or release package.
