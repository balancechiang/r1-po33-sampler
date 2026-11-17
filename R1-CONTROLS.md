[English](R1-CONTROLS.md) | [简体中文](R1-CONTROLS.zh-CN.md) | [日本語](R1-CONTROLS.ja.md) | [한국어](R1-CONTROLS.ko.md)

# Controls

## Screen controls

| Control | Action |
| --- | --- |
| sound + 1–16 | Select a sound. Release sound to play the numbered pads. |
| record + 1–16 | Start recording into that slot. The number can be released; release record to stop. |
| write | Toggle step editing. Press numbered pads to add/remove steps. |
| play | Start/stop playback. Write mode remains active. |
| write + numbered pad, while playing | Record a live note, quantized to the sequencer. |
| FX, tapped | Cycle TONE → FILTER → TRIM. |
| Knobs A / B | TONE: pitch / volume. FILTER: cutoff / resonance. TRIM: start / length. Drag vertically; each knob has 280° of travel. |
| FX + 1–15, while playing | Hold a punch-in effect; release to return. FX + 16 releases FX. |
| FX + pad, in write mode while playing | Record the effect into the pattern. FX + 16 clears the pattern's saved effects. |
| BPM, tapped | Cycle 80 / 120 / 140 BPM. |
| BPM + A / B | Adjust swing / tempo, from 60 to 240 BPM. |
| BPM + 1–16 | Set master volume. |
| pattern + pad(s) | Select a pattern, or enter a repeating chain of up to 128 selections. Repeated pattern numbers are allowed. |
| write + pattern + pad | Copy the current pattern. |
| record + pattern | Clear the current pattern. |
| write + sound + pad | Stage a sound copy; release sound or write to commit. After selecting a drum target, tap another number to choose an individual target slice. |
| record + sound | Delete the selected sample. |

In drum TRIM mode, edit the last-triggered slice. While playing, hold write and adjust TONE or FILTER to save parameter locks at the current step.

Punch-in FX now follow official numbering: 01–04 loop, 05–06 unison, 07–08 octave, 09–10 stutter, 11–12 scratch, 13 6/8 quantize, 14 retrigger pattern, 15 reverse, 16/00 bypass. Reverse follows each sound's trimmed region; retrigger restarts the actual pattern. See [FX behavior and emulation limits](FX.md). The knobs retain their TONE/FILTER/TRIM roles.

### Step editing and sound copying

- In write mode, hold an existing step: A chooses note/slice (1–16); B chooses melodic duration (1–16 steps) or drum retriggers (1, 2, 3, 4, 6, 8). Hold a drum step and tap BPM to cycle retriggers. Short tap removes the step on release; a cancelled touch preserves it.
- Hold an existing step for one second to copy its note, duration/retriggers and parameter locks as defaults for new steps in that lane. An orange outline confirms the long hold or knob edit. Ordinary taps have no pressed-color effect. Starting another edit or selecting/playing a sound replaces these defaults.
- SOUND shows two digits for the selected slot followed by two for its last note/slice. SOUND + BPM cycles actual free recording seconds and the app revision; unavailable battery/CPU values are not simulated.
- RECORD + A/B resets pitch/volume on TONE or cutoff/resonance on FILTER. TRIM remains editable and is not reset by this shortcut.
- Sound copy uses the trimmed melodic region, the last-played drum slice, or the entire kit if the drum slot was just selected. A melodic region copied into a drum slot divides evenly into 16 slices. Copies preserve target pitch, volume, filter and resonance, and reset only the copied region's trim. Empty sources clear a slot or an individual slice. Cancellation discards a staged copy.
- Copied regions share their underlying audio in the simulated 40-second pool, including after reload. A small cropped region keeps its source recording allocated until all references are removed. Each saved slot is self-contained so deleting/replacing the source does not break copies. Existing recordings and pattern keys remain readable.

## rabbit r1 controls

- **Scroll wheel:** adjusts BPM by default; while holding an existing step in write mode, edits its note/slice (knob A).
- **Side button, short press:** play/stop.
- **Side button, held:** hold record. Tap a numbered pad to begin sampling; release the side button to stop.
- **Two shakes while playing:** latch a random FX from 1–15. Another pair selects a different FX.
- **Three or more shakes in one group:** cancel the latched FX. A single shake does nothing.
- The detector waits for 550ms of quiet before committing a pair. Stop, blur or hide the page to clear motion sensing and latched FX. The on-screen FX key takes priority. In write mode, shake FX is recorded into the current step.

## Indicators

- **IN:** highlighted when the microphone is available and record is held or recording is active. The meter shows input; OUT is dimmed.
- **OUT:** highlighted when output is detected outside input-monitoring mode, including manually triggered notes and their tails.
- **Red LEDs:** show recorded samples, selection, steps, patterns or FX according to the current mode.
- **Step LED brightness:** in write mode or during playback, programmed steps in the selected sound lane are dim red; events in other lanes are a fainter red; empty steps are off. The currently playing step is bright, with a short brighter pulse on step 1. Pattern chains follow the pattern currently heard. Sound, pattern, FX and volume selection temporarily take priority over the step display.
- Rabbit and glove motion follows the audio clock/BPM. It resets on stop and respects reduced-motion settings.

IN/OUT highlight thresholds are an app implementation, not a verified frame-for-frame recreation of the hardware. All keys request a 12ms vibration pulse where supported, without a transient pressed-color effect. Shake sensitivity and vibration require real-device testing.

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)
