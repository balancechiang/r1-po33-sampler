[English](PRESETS.md) | [简体中文](PRESETS.zh-CN.md) | [日本語](PRESETS.ja.md) | [한국어](PRESETS.ko.md)

# Factory sounds & patterns

All factory sounds are generated from sine waves, harmonics, FM and deterministic noise. No third-party recordings or existing songs are used.

| Slot | Name | Sound |
| --- | --- | --- |
| 1 | Sub Bloom | C2 synth bass |
| 2 | Amber Pluck | C3 harmonic pluck |
| 3 | Glass FM | C4 FM bell |
| 4 | Soft Fifth | Soft fifth pad |
| 9 | Analog Kit | Analog drum kit |
| 10 | Dust Kit | Noise and drum-body kit |
| 11 | Electro Kit | Electronic drum kit |
| 12 | Perc Kit | Percussion kit |

Each drum kit contains 16 equal-length slices: kick, snare, closed hat, clap, rim, tom, shaker, open hat and variations. Slots **5–8 and 13–16 are empty** until you record or copy into them.

Patterns **1–4** use original C-minor sequences with different grooves:

| Pattern | Name | Style | BPM | Swing |
| --- | --- | --- | --- | --- |
| 1 | Night Circuit | Four-on-the-floor house | 120 | 0% |
| 2 | Broken Glass | Syncopated breakbeat | 132 | 8% |
| 3 | Velvet Steps | Relaxed lo-fi | 84 | 28% |
| 4 | Moon Return | Half-time electronic | 140 | 0% |

Hold pattern and press 1, 2, 3, 4 to chain all four. Selecting/chaining patterns recalls their BPM and swing. Manual tempo/swing changes are saved for that pattern; pattern copies include these settings. Blank patterns inherit the current tempo until edited.

Factory assets load from the bundled presets.js, without an external sound service. They count toward the 40-second sample pool. Deleting a factory sound keeps it deleted after reload. Initialization preserves existing recordings and non-empty patterns.

To load these revised presets over an existing saved setup, continuously hold the rabbit head for **5 seconds**. `RST` appears, this sampler's saved recordings/patterns/settings are erased, and the page reloads into the factory setup. Releasing early, moving outside the head, cancelling the touch or leaving the page cancels the hold. Other websites' data and the published URL are untouched. An interrupted reset resumes on startup; a storage failure shows `err` and can be retried by holding the head again. The same hold is available with Enter/Space while the head control has keyboard focus.

The original generated sounds and these four sequences are offered under **CC0-1.0**. This statement applies only to those preset assets, not to the whole app or its artwork.

[Controls](R1-CONTROLS.md) · [Factory sounds & patterns](PRESETS.md) · [Publishing](DEPLOY.md)
