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
| 05 | Unison | Force source rates to slot base pitch, ignoring pad-note offsets; existing voices retain their sample position. No synthetic detuned layer. |
| 06 | Unison low | Same source-rate alignment, one octave below slot base pitch. |
| 07 | Octave up | Glide each active source from its current playback rate toward twice its neutral rate (35ms exponential time constant); new notes start at their base rate and glide too. |
| 08 | Octave down | Same continuous source-rate glide toward half the neutral rate; preserve current source position. |
| 09 | Stutter 8 | Capture a eighth-beat fragment and repeat it eight times per beat. |
| 10 | Stutter 6 | Capture a sixth-beat fragment and repeat it six times per beat. |
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
- 09 and 10 run on the master stream. 05/06 align source rates at the voice layer. 01–04 use source-level sequencer retriggers and a separate shadow clock; 07–08 glide source rates; live 11–12 freeze a captured step. 13–14 operate on sequencer events. 15 operates on
  individual source regions, including independently copied drum slices.
- Unison no longer uses the master-stream granular shifter. Existing logical voices
  are retained without adding layers; normal same-slot choke and the four-voice limit apply.
  The existing 512-frame ScriptProcessor path for Stutter is retained
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

Live Scratch cancels unheard lookahead, freezes the audible pattern/step, preserves
its silence if empty, and alternates real forward/reversed sample buffers. Each hit
has an upward then downward rate envelope. Switching 11/12 keeps the same captured
step; releasing resumes at its successor. Saved Scratch automation applies the same
subdivision/direction/envelope within each saved step, allowing the song to progress.
Octave glides also use the source-rate trajectory used for live knob changes, keeping
trim deadlines, choke and four-voice limits in sync.

## Unison source-rate model (2026-11-25)

The 05/06 behavior is a user-specified, hardware-unverified model. Manual and saved
FX use the same source-rate mapping. 05 ignores pad pitch and retains slot pitch;
06 applies an additional 0.5 ratio. Existing sources change rate immediately without
restarting. Release restores the original note plus current slot pitch. Drum slice
indices are never replaced. No invented timing jitter or detuned clones are added.
07/08 retain the earlier requested octave glides; the instant-switch model is not
generalized to all effects. Legacy DSP Engine modes 05/06 remain for compatibility
but are bypassed by the current app routing.
