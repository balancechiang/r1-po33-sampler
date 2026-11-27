# Punch-in FX

Numbering and names follow the [official PO-33 guide](https://teenage.engineering/guides/po-33/en).
The guide does not publish DSP algorithms or numerical tuning. This implementation
recreates the effect families below; it is not a measured or bit-exact firmware emulation.

| Key | Official effect | App implementation |
| --- | --- | --- |
| 01 | Loop 16 | Hold the audible pattern and cycle its 16 sequencer steps; the original chain clock continues independently. |
| 02 | Loop 12 | Cycle a 12-step window starting at the audible step captured on press, within the captured pattern. |
| 03 | Loop short | Hold the captured step and retrigger its notes every half-step (32nd notes, two hits per original step). |
| 04 | Loop shorter | Hold the captured step and retrigger its notes every third-step (48th notes, three hits per original step). |
| 05 | Unison | Four source layers with measured slight detuning and fitted gains; each layer consumes a voice. |
| 06 | Unison low | Four source layers combining the original pitch with two slightly detuned lower-octave layers. |
| 07 | Octave up | Glide each active source from its current playback rate toward twice its neutral rate (35ms exponential time constant); new notes start at their base rate and glide too. |
| 08 | Octave down | Same continuous source-rate glide toward half the neutral rate; preserve current source position. |
| 09 | Stutter 8 | 50% amplitude shutter at 8 Hz at 120 BPM (one sixteenth period), tempo-scaled; no captured audio loop. |
| 10 | Stutter 6 | 50% amplitude shutter at 6 Hz at 120 BPM (4/3 sixteenth period), tempo-scaled; no captured audio loop. |
| 11 | Scratch | Live: freeze the audible step and retrigger its notes at half-step intervals, alternating forward/reverse with a pitch envelope. An empty step stays silent. |
| 12 | Scratch fast | Same held-step playback at quarter-step intervals, twice the retrigger rate. |
| 13 | 6/8 quantize | Move sequenced triggers onto 12 equally spaced positions per normal 16-step bar; collisions sound together. Keep the bar duration. |
| 14 | Retrigger pattern | A manual rising edge queues step zero at the next nominal sixteenth boundary. Holding does not repeat the command. Cancel only unheard lookahead; existing tails use normal slot choke and four-voice stealing. Preserve the chain index. WRITE stores one jump flag at the pressed step, not a span; saved flags jump on every visit. |
| 15 | Reverse | Play each sound backwards from the end of its own trimmed region, preserving pitch, slice selection and step duration. Cached reversed audio is derived only; original samples remain unchanged. |
| 16 / 00 | No effect | Bypass/release. In write mode the existing FX+16 action clears saved pattern effects. |

The loop sizes, stutter divisions, detuning, grain window, scratch trajectory and
triplet interpretation are explicit app tuning choices requiring comparison with
hardware recordings. In particular, official effect names alone do not establish
these exact constants. No delay, bitcrusher, auto-pan or independent FX knob mapping
from the supplied third-party implementation guide has been added.

## Audio and controls

- A five-second ring buffer continuously records the original mixed input, including
  manually played sounds before transport starts. It never records its own FX return.
- Master volume is applied after the dry/FX mix so captured loops still respond to
  BPM + 1–16. The bypass signal keeps the same gain before the output filter/saturator.
- If a loop is requested before enough history exists, use the available material.
  A request made before any signal waits for the first sound instead of freezing
  silence. Short edge fades keep captured loop periods intact.
- 09 and 10 run on the master stream. 05/06 layer source rates at the voice layer. 01–04 use source-level sequencer retriggers and a separate shadow clock; 07–08 glide source rates; live 11–12 freeze a captured step. 13–14 operate on sequencer events. 15 operates on
  individual source regions, including independently copied drum slices.
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
