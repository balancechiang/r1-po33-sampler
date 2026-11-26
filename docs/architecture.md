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
