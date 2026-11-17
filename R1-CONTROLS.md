[English](R1-CONTROLS.md) | [简体中文](R1-CONTROLS.zh-CN.md) | [日本語](R1-CONTROLS.ja.md) | [한국어](R1-CONTROLS.ko.md)

# Controls

## Screen controls

| Control | Action |
| --- | --- |
| sound + 1–16 | Select a sound. Release sound to play the numbered pads. |
| record + 1–16 | Record into that slot; release either key to stop. |
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
| write + sound + pad | Copy the entire selected sample. |
| record + sound | Delete the selected sample. |

In drum TRIM mode, edit the last-triggered slice. While playing, hold write and adjust TONE or FILTER to save parameter locks at the current step.

## rabbit r1 controls

- **Scroll wheel:** always adjusts BPM; it does not switch to sound browsing or another parameter.
- **Side button, short press:** play/stop.
- **Side button, held:** hold record. Hold a numbered pad at the same time to sample; release either input to stop.
- **Two shakes while playing:** latch a random FX from 1–15. Another pair selects a different FX.
- **Three or more shakes in one group:** cancel the latched FX. A single shake does nothing.
- The detector waits for 550ms of quiet before committing a pair. Stop, blur or hide the page to clear motion sensing and latched FX. The on-screen FX key takes priority. In write mode, shake FX is recorded into the current step.

## Indicators

- **IN:** highlighted when the microphone is available and record is held or recording is active. The meter shows input; OUT is dimmed.
- **OUT:** highlighted when output is detected outside input-monitoring mode, including manually triggered notes and their tails.
- **Red LEDs:** show recorded samples, selection, steps, patterns or FX according to the current mode.
- Rabbit and glove motion follows the audio clock/BPM. It resets on stop and respects reduced-motion settings.

IN/OUT highlight thresholds are an app implementation, not a verified frame-for-frame recreation of the hardware. All keys request a 12ms vibration pulse where supported, without a transient pressed-color effect. Shake sensitivity and vibration require real-device testing.

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)
