# Architecture

Web Sampler is a static browser application. `index.html` is the single application page; `creation.html` is a small compatibility loader. GitHub Pages serves the repository root directly.

- `app.js`: application state, input gestures, sequencer lookahead and persistence coordination.
- `sampling.js`, `voice.js`, `effects.js`, `tone.js`: slicing, voice scheduling, punch-in effects and optional playback coloration.
- `sync.js`, `sync-worklet.js`: independent sync timeline, stereo routing and audio-thread clock generation/detection.
- `transfer-panel.js`, `transfer-worker.js`, `backup-audio.js`: project I/O, codec worker and lossless stereo file decoding. Capture and transfer Worklets are separate.
- `src/codec/`, `decoder/`: TypeScript protocol model, binary serialization and modem code; `decoder/browser/` is the browser build.
- `responsive-layout.js`, `workbench.js`, `workbench.css`: shared portrait surface plus a framed desktop/tablet-landscape shell, input hints, local page-sharing QR and independent-project footer.
- `assets/`, `fonts/`: panel/mascot artwork and licensed display font. Root PNG icons provide PWA and host metadata.
- `sample-assets.js`, `transfer-storage.js`: IndexedDB audio assets/checkpoints. Lightweight metadata uses browser storage or the optional Creation bridge. See [storage policy](storage-policy.json).
- `presets.js`: the single factory preset source. No dated copies are generated.
- `docs/`, `tests/`, `scripts/`: documentation, verification and offline tools.
- `compat/rabbit-r1/`: optional host descriptor and installation QR, outside the core web design.

Use `node scripts/build.mjs` after changing the application version in `package.json`. It stamps imports/worker URLs and updates `app-release.json`; the app and its page name remain stable. Normal updates preserve user projects. No install-time data cleanup runs.

## Hosting

Use HTTPS for microphone/camera access, or localhost during development. Publish the repository root as a static site. User recordings, certificates and local test outputs are excluded from Git. No OS3 model connection or API key is required.

Copy commands capture the selected sound or pattern when WRITE + SOUND / PATTERN is held. CPY blinks until a numbered destination is pasted, then stays steady until the chord is released. Destinations are overwritten immediately. SOUND/WRITE and PATTERN/WRITE accept either order, retain a captured source and select the pasted destination. Its LED blinks at 625 ms (normal selection: 312.5 ms). For sound copy, a drum destination followed by another number pastes the last-triggered source slice at that pad while preserving the other destination slices. Drum-to-melodic uses the last-triggered slice; full sound copy inherits filter and resonance.

WRITE LEDs distinguish the selected note/slice (bright) from other notes in the same sound (dim). Holding an occupied step for one second auditions it once, adopts its note and locks as the insertion template, and displays CPy for one second. Short taps remove occupied steps. Held melodic-step knob A always selects note 1–16 (display 001–016); knob B sets gate 1–16 steps (L01–L16), independently of the sound editing page. During gate adjustment, subsequent covered steps wrap modulo 16 and show temporary dim LEDs only where no existing fill indicator is present. Releasing the step removes the preview without altering gate metadata. Held drum-step knob A selects its slice (display 001–016) in all edit pages and adopts that selection for LED comparison and subsequent insertion; knob B has no parameter action. Held drum step + BPM cycles 1/2/3/4/6/8 retriggers and displays tr1…tr8 without changing global BPM.

WRITE displays only the selected sound’s lane: other sounds do not create dim editable indicators. Occupied steps in WRITE always use the held-step editor, including playback with WRITE held; live note entry remains available outside the STEP editing view. Each sound lane stores one note/slice per step and uses same-slot voice choke.

Pattern selection and playback consistently display P01–P16. Copy source LEDs retain the 312.5 ms selection blink; the pasted target uses 625 ms. Step knob A auditions only on a quantized note/slice transition, releases the previous same-slot voice before starting the next preview, and gate knob B remains silent.

`filter-calibration.js` provides measured magnitude-fit biquad frequency/Q/gain tables for native cutoff/resonance codes at 44.1/48/96 kHz. `scripts/fit-filter-calibration.py` regenerates them from the numerical fixture (offline numpy/scipy only). Runtime interpolation stays in native JavaScript; Web Audio low/high-pass Q receives dB, converted from fitted linear Q. Native codes 31/32 map to -5/+5 outside the no-filter dead zone, with matching inverse export.

Scratch 11/12 uses `PO33LiveVoice.scratchLoop` to create a short source-region forward/reverse reader. Each reader is one normal allocated voice, with a retained original-source cursor for enter/switch/release. Saved transitions use their scheduled audio timestamp even when the UI callback arrives late. The transport, chain and sync clock are not replaced by a separate Scratch sequencer. Only the short reader buffer is derived; original PCM and native backup data stay immutable.

Saved Loop1–4 use a small source-reader state per slot: source origin, bounded end, repetition tick and current voice. The normal sequencer continues; reset ticks are inserted into its audio lookahead. Only active voices reset, end pointers can follow same-bank note events, and the original PCM is never transformed or duplicated. Entering a live Loop hold clears the saved reader schedule; live holds remain a separately scoped path. Stop/transfer closes the state. Software and hardware-capture tests cover fixed-tempo source trajectories; live and mixed transitions remain scoped limitations.
