# Punch-in FX

Numbering and names follow the [official PO-33 guide](https://teenage.engineering/guides/po-33/en).
The guide does not publish DSP algorithms or numerical tuning. This implementation
recreates the effect families below; it is not a measured or bit-exact firmware emulation.

| Key | Official effect | App implementation |
| --- | --- | --- |
| 01 | Loop 16 | Saved: repeat a one-step source-read window four times, then advance it; live legacy hold still requires verification. |
| 02 | Loop 12 | Saved: repeat a 4/3-step read window three times, then advance it; live legacy hold remains uncalibrated. |
| 03 | Loop short | Saved: four half-step hits, recapture after two steps. Live: held-step approximation, not hardware-verified. |
| 04 | Loop shorter | Saved: repeat a third-step source-read window eight times, then advance it. Live legacy hold remains uncalibrated. |
| 05 | Unison | Four source layers with measured slight detuning and fitted gains; each layer consumes a voice. |
| 06 | Unison low | Three measured near-original layers plus one near-half-rate layer; relative phase remains approximate. |
| 07 | Octave up | Reset to base rate and advance through semitones toward double rate over about260ms; preserve the source cursor. |
| 08 | Octave down | Same measured progression toward half rate; release returns promptly to base. |
| 09 | Stutter 8 | 50% amplitude shutter at 8 Hz at 120 BPM (one sixteenth period), tempo-scaled; no captured audio loop. |
| 10 | Stutter 6 | 50% amplitude shutter at 6 Hz at 120 BPM (4/3 sixteenth period), tempo-scaled; no captured audio loop. |
| 11 | Scratch | Forward/reverse reading of an active source; empty steps can process an existing tail. Transport continues. |
| 12 | Scratch fast | Same source-reader family at twice the oscillation rate. |
| 13 | 6/8 quantize | Play the first three steps of each beat at thirds; suppress each fourth step while keeping the bar clock. |
| 14 | Retrigger pattern | A manual rising edge queues step zero at the next nominal sixteenth boundary. Holding does not repeat the command. Cancel only unheard lookahead; existing tails use normal slot choke and four-voice stealing. Preserve the chain index. WRITE stores one jump flag at the pressed step, not a span; saved flags jump on every visit. |
| 15 | Reverse | Play each sound backwards from the end of its own trimmed region, preserving pitch, slice selection and step duration. Cached reversed audio is derived only; original samples remain unchanged. |
| 16 / 00 | No effect | Bypass/release. In write mode the existing FX+16 action clears saved pattern effects. |

The loop sizes, stutter divisions, detuning, grain window, scratch trajectory and
triplet interpretation are explicit app tuning choices requiring comparison with
hardware recordings. In particular, official effect names alone do not establish
these exact constants. No delay, bitcrusher, auto-pan or independent FX knob mapping
from the supplied third-party implementation guide has been added.

## Audio and controls

- A legacy mixed-input history remains for compatibility; current saved Loop readers and Scratch do not replay that master history.
- Master volume follows the FX mix; source-reader resets leave original PCM unchanged.
- 09/10 run on the master stream. 05/06 layer individual voices. Saved01/02/04 reset source read positions; legacy live holds and saved03 use the shadow-cursor scheduler. 07/08 change source rates;11/12 oscillate source readers;13/14 operate on events;15 reverses individual regions.
- Unison no longer uses the master-stream granular shifter. Four layers share a trigger group, preserving same-slot choke between triggers while counting every layer toward the four-voice limit. Live transitions resume the source position.
  The existing 512-frame ScriptProcessor path for the amplitude shutters is retained
  for r1/browser compatibility; device performance and sound still need listening tests.
- On-screen FX remains momentary. Shake FX remains latched and uses the same
  numbering. A held screen FX key takes priority over shake and saved effects.
- Holding an effect in write mode records its span across the steps visited by the
  scheduler. Saved effects are applied at their audio-clock times, with obsolete
  callbacks cancelled on stop/restart/blur. Repeated saved numbers do not recapture
  the same loop on every step.
- Changing pitch/trim/filter with the knobs keeps the existing sound parameter
  behavior. The official guide does not establish separate A/B controls for each FX.
- Existing stored FX numbers are retained and interpreted using official numbering.
  Saved sounds, trim data and note lanes are not migrated or erased.

## Checks

`node test-fx-dsp.cjs` checks bounded output, loop periods, bypass, early-trigger
recovery, pitch frequency, scratch movement rate and the quantization grid.
`python -X utf8 test-fx-browser.py` checks the actual audio graph, all 15 controls,
source-level reversal, transport retrigger and saved-event timing in Edge.

These checks establish working DSP and control behavior, not perceptual equivalence
to a physical PO-33. Hardware A/B recordings remain the reference for further tuning.

## Display aliases (2026-11-22)

The app now shows L16, L12, L32, L48, uni, uno, ocu, ocd, st8, st6, scr,
scf, 6-8, rtr, rev and non. These are compact app display aliases, not a claim
that every glyph or the precise loop length matches measured firmware.
FX 9/10 use the user's hardware-confirmed Stutter 8/6 naming and corresponding eighth-/sixth-beat repeat periods.

## Step-based performance model (2026-11-22)

The Loop and Scratch behavior above follows the user's specified performance model,
not a verified reverse engineering of the firmware DSP. Current Loop playback does
not capture mixed output or construct repeated-audio cells. Every retrigger references
the original slot/slice PCM and passes through the same slot choke and four-voice allocator.
A tiny edge fade avoids a discontinuity without adding reverberation or sustained overlap.

A shadow cursor retains the original chain index (including repeated pattern entries),
pattern, step and fractional step phase. It progresses using audio-clock time independently
of the foreground Loop cursor. Releasing a Loop joins that position, then schedules
subsequent notes on the original grid. Changing Loop type preserves the same shadow
clock; tempo changes advance it with the old tempo before accepting the new value.
Recorded Loop automation uses the shadow position to detect the end of its effect span,
so a foreground hold does not trap the song permanently in an automated effect.

Scratch now processes individual ringing sample sources rather than freezing the
transport and retriggering the current step. A short forward/reverse source buffer
loops on the audio clock: at 60 BPM FX11 has a 0.5-second cycle and FX12 a 0.25-second
cycle. An empty step retains an existing tail; an empty step without a voice remains
silent. Saved automation and live gestures use the same reader. Effect transitions
preserve the sample cursor and resume normal reading on release; same-slot choke and
four-voice allocation still apply. No synthetic pitch ramp or master-bus audio capture
is used. The original sample buffer and backup bytes are unchanged.

Octave glides also use the source-rate trajectory used for live knob changes, keeping
trim deadlines, choke and four-voice limits in sync.

## Recorded Unison and shutter calibration (2026-11-27)

The isolated harmonic-source hardware capture replaces the earlier unverified root-pitch-clamping model. FX5 shows four resolvable detuned bands (harmonic 8: 865.70, 874.79, 883.87, 892.79 Hz for an 880 Hz dry harmonic). FX6 retains original and lower-octave components. The source-layer ratios/gains are fitted approximations at the tested base pitch; wider note/pitch behavior and exact phase/interpolation remain unverified.

A trigger's layers share a choke group, so they coexist but the next hit in the same slot replaces the group. All layers count toward the four-voice allocator. Live enter/switch/release resumes the current sample position; future scheduled notes remain on their clock grid. Note pitch is preserved rather than forcibly replaced with the slot root.

FX9/10 are live amplitude gates, not recorded fragment loops. At 120 BPM the measured families are approximately 8/6 Hz with near 50% on time; the app uses a 1 ms edge. Source-layer and gate changes use the same paths for live and recorded FX.

On the isolated test's analysis windows, wet/dry RMS differences versus hardware are about +0.19 dB (FX5), +0.18 dB (FX6), -0.30 dB (FX9), +0.14 dB (FX10). This is not a claim of waveform/phase identity or full calibration on arbitrary material. Scratch, filters and other FX still require further modeling.

## Isolated Scratch capture (2026-11-27)

The v4 original-chirp recording at 60 BPM / master 12 contradicts the earlier per-step retrigger model. Fresh FX11 notes expose a reverse leg from the opposite sample boundary; ongoing non-boundary voices follow a continuous forward/backward window. FX12 has half the cycle length. The implementation models this distinction, with interpolated sample reads.

`scripts/analyze-scratch-calibration.py` compares private hardware WAV and actual browser Float32 captures; only numerical results enter Git. Its eight effect-interior chirp windows separate missing audio from dominant-frequency error: actual browser captures have full audible coverage and roughly 2–17 cents median error per section after correction. It excludes reversals, effect release, drum behavior and phase from accuracy claims. Hardware release transients, short drum slices, tempo/pitch changes while holding Scratch and arbitrary trim boundaries remain pending. The earlier isolated filter-magnitude calibration is documented separately.

### Scratch boundary refinement

The v5 shared-versus-independent allocation comparison shows the same drum behavior: native saved FX11/12 reads the first drum slice regardless of the current note's slice number. A temporary source-pad override models this without rewriting pattern notes. Reader continuation retains the source actually being played. FX11's starting direction follows the transport's sixteenth phase; an ongoing reverse reader reaching its origin terminates. Turning off Scratch at that terminated origin does not start the sample again.

The v5 recording validates these specific saved-automation cases at60BPM/base pitch, not arbitrary live gestures. Four drum chirp windows now have roughly2–4 cents median error (previously899–903); the two erroneous long tails are gone. Reversal clicks and edge-phase identity are not fitted.

## Unison v6 multi-pitch refinement

The longer 60BPM capture resolves high partials across four note keys, four native pitch locks and four drum slices. FX5's median fitted rate ratios are0.98388644/0.99413750/1.00627777/1.01660276. FX6 shows three near-original bands (0.99459477/1.00292946/1.00437673) plus one low band (0.49609343), superseding the earlier two-original/two-low approximation. Source gains use0.35/0.4667/0.35/0.35; the higher central gain follows the observed approximately4:3 partial-amplitude ratio. Low-band gain is kept conservative because its frequency response differs from the high dry reference. These are fitted source-layer approximations, not a firmware algorithm claim.

At a saved step containing simultaneous sound slots, hardware P14/P15 retains the first addressed sound as its four-layer group; the app previously ended up with the last. `fireStep` now gives the first sound priority for FX5/6; a later step can still replace it through normal four-voice stealing. No pattern data is rewritten. Multi-source live FX entry has not been proven by this saved-automation capture.

Relative beating phase, window-dependent RMS, exact start offsets, gain under arbitrary signal levels and live multi-source switching remain incomplete. In particular, equal-pitch sections at different pattern positions do not have identical recorded short-window RMS, so a per-note gain patch or invented random detune is not used.

## Octave and6/8 v7 refinement

A held source's octave effect ramps through semitones over about260ms, resetting to base speed when7↔8 changes and returning to base when released. The source cursor is retained. `Speed.octave` schedules4ms constant-rate pieces and integrates their consumed PCM length, so source endings follow the same trajectory as audio. Pending pieces are removed by manual/future parameter changes. This is a measured approximation, not a claim of exact firmware tick timing.

FX13 selects the first three steps of each four-step beat and spreads them at thirds: twelve hits per bar. The fourth note is suppressed instead of overwriting the third at a shared rounded timestamp. The global sixteen-step song and sync clocks still advance normally. Loop1–4's detailed native capture/recapture behavior remains pending and should not be described as hardware-calibrated.

## Saved Loop3 recapture, v8

Unique step markers establish that saved FX3 captures a new source every two original sixteenths: four hits of step5 at half-step intervals, then four of step7, then9 and11. Starting one step later yields6/8/10/12. The alternating-empty-step case has the same recapture order. `scheduleLoop` now advances this captured step for automatic FX3 only; live held-step behavior is left unverified.

Do not generalize this rule to other Loop numbers: short v8 samples let FX1 pass normal notes, FX2 adds selected repeats, and FX4 reads/repeats differently from the simple frozen-step model. Earlier long-source v7 behavior differs. Length-dependent reader behavior needs a separate isolated-source test; no claim of complete Loop1–4 reconstruction is made.

## Loop source readers, v9

Saved FX1/2/4 now reset each active voice's read position rather than replacing the song cursor. At60BPM, the read interval/repetition count is250ms×4,333.33ms×3 and83.33ms×8 respectively. After each group, the read window advances one interval through the original PCM. A source that reaches its physical end before a reset stays ended. Turning FX off leaves the latest read position running forward.

Intervening notes are ordered against reset ticks. A reset of an active same-slot voice can retain the captured start while a new note updates its end; a voice already finished can accept a fresh start. This fits the v8 independent marker windows as well as v9 single-source durations. Sources share immutable native bank buffers, so this operates on bounded views without copying or rewriting samples. Four-voice stealing and same-slot choke still apply. Reset events are scheduled on the audio clock; tempo changes rescale future intervals without rescaling already-consumed chunks.

This path is for saved automation. The existing live hold path is retained and still needs hardware gesture verification. Mixed mode switches, pitch/tempo edits while active, cross-bank web samples, parameter locks, and external-sync timing are not fully calibrated. The v8 mixed-switch segment still differs.
