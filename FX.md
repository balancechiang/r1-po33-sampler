# Punch-in FX

Numbering and names follow the [official PO-33 guide](https://teenage.engineering/guides/po-33/en).
The guide does not publish DSP algorithms or numerical tuning. This implementation
recreates the effect families below; it is not a measured or bit-exact firmware emulation.

| Key | Official effect | App implementation |
| --- | --- | --- |
| 01 | Loop 16 | Retrigger the current step 16 times within its original step duration; proceed to the next step on the original clock. |
| 02 | Loop 12 | Same per-step subdivision, 12 repeats per step. |
| 03 | Loop short | Same per-step subdivision, 32 repeats per step (L32). |
| 04 | Loop shorter | Same per-step subdivision, 48 repeats per step (L48). |
| 05 | Unison | Live dry signal plus a slightly detuned granular delay voice (ratio 1.008). |
| 06 | Unison low | Live dry signal plus a sub-octave granular delay voice (ratio 0.5). |
| 07 | Octave up | Glide each active source from its current playback rate toward twice its neutral rate (35ms exponential time constant); new notes start at their base rate and glide too. |
| 08 | Octave down | Same continuous source-rate glide toward half the neutral rate; preserve current source position. |
| 09 | Stutter 4 | Capture a quarter-beat fragment and repeat it four times per beat. |
| 10 | Stutter 3 | Capture a third-beat fragment and repeat it three times per beat. |
| 11 | Scratch | Live: freeze the audible step and retrigger its notes at half-step intervals, alternating forward/reverse with a pitch envelope. An empty step stays silent. |
| 12 | Scratch fast | Same held-step playback at quarter-step intervals, twice the retrigger rate. |
| 13 | 6/8 quantize | Move sequenced triggers onto 12 equally spaced positions per normal 16-step bar; collisions sound together. Keep the bar duration. |
| 14 | Retrigger pattern | Restart the audible pattern at step zero. Cancel obsolete scheduled voices and display events. Each new manual press restarts again. A saved 14 restarts when that step is reached. |
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
- 05, 06, 09 and 10 run on the master stream. 01–04 use short per-sound loop cells; 07–08 glide source rates; live 11–12 freeze a captured step. 13–14 operate on sequencer events. 15 operates on
  individual source regions, including independently copied drum slices.
- The Unison stream pitch shifter uses two overlapping 40ms delay grains; it preserves ongoing
  input timing rather than repeatedly replaying a frozen bar. Granular coloration
  and latency are expected. The existing 512-frame ScriptProcessor path is retained
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

The app now shows L16, L12, L32, L48, uni, uno, ocu, ocd, st4, st3, scr,
scf, 6-8, rtr, rev and non. These are compact app display aliases, not a claim
that every glyph or the precise loop length matches measured firmware.
Official FX 9/10 remain Stutter 4/3; the supplied Stutter 8/6 description is not
used to replace the official mapping. Display aliases do not establish exact firmware DSP constants.

## Step-based performance model (2026-11-22)

The Loop and Scratch behavior above follows the user's specified performance model,
not a verified reverse engineering of the firmware DSP. Loop uses a tiny derived PCM
cell and one native looping source per sounding slot per step. It does not allocate
16–48 complete voice chains per hit. Fractional loopEnd gives the exact subdivision
period, and the step gate still ends on the original BPM grid. Original PCM is unchanged.

Live Scratch cancels unheard lookahead, freezes the audible pattern/step, preserves
its silence if empty, and alternates real forward/reversed sample buffers. Each hit
has an upward then downward rate envelope. Switching 11/12 keeps the same captured
step; releasing resumes at its successor. Saved Scratch automation applies the same
subdivision/direction/envelope within each saved step, allowing the song to progress.
Octave glides also use the source-rate trajectory used for live knob changes, keeping
trim deadlines, choke and four-voice limits in sync.
