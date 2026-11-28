# Verification

Run the core deterministic checks from the repository root:

```sh
node scripts/check.mjs
```

Browser checks use Python Playwright with a local Chromium/Edge installation. They serve the repository root; private fixtures and outputs remain in ignored `t/`. Relevant checks:

```sh
python tests/test-resource-layout.py
python tests/test-wide-layout.py
python tests/test-hold-repress.py
python tests/test-stable-update.py
python tests/test-first-tap-audio.py
python tests/test-creation-qr.py
python tests/test-garage-import.py
python tests/test-transfer-layout.py
python tests/test-transfer-result.py
python tests/test-sync-browser.py
python tests/test-sync-fx.py
```

`test-m4a-pwa.py` additionally uses imageio-ffmpeg to generate lossless ALAC fixtures. Sampling analysis utilities use NumPy/SciPy. Private official backup fixtures are not distributed.

Synthetic capture and desktop browser tests validate application logic and payloads; physical hardware, mobile WebViews and audio-interface voltage/latency need device testing. Historical page snapshots are retained in Git history rather than as served pages or fixture copies.

- `python tests/test-copy-chord.py`: sound/pattern copy arming, blink, immediate overwrite, repeated destinations and HOLD.

- `python tests/test-step-selection.py`: selected-note LED levels, long-held step audition/template, erase/refill, per-step locks, retrigger cycling and copied filter.

- `python tests/test-melodic-step.py`: note/gate controls on all pages, padded displays, wraparound gate preview, fill priority and gate-template insertion.

- `python tests/test-preview-meter.py`: manual preview meter suppression with playback and knob parameter indicators retained.

- `python tests/test-tone-neutral.py`: centered factory pitch/unity-gain startup and tone scale endpoints/center.

- `python tests/test-pwa-safe-area.py`: stale innerHeight, delayed safe-area padding, visual viewport/body size changes and restored PWA layout.


- `node scripts/build-calibration.mjs <output-dir>` generates original automatic comparison material; validates native backup checksums, slice references, tempo, chain and all 15 stored FX. Generated WAV is a hardware backup signal, not an audition recording.

- `python tests/test-calibration-import.py <generated-backup.wav>` checks the actual frontend import, chain, all FX and initial playback.

- `node tests/test-native-hardware-calibration.mjs`: recorded melodic key mapping, nonlinear native level fit and inverse volume-code export.
- `node scripts/build-calibration.mjs <output-dir> --fx-isolated`: automatic single-source FX diagnostic project (all 15 FX, no competing sounds).

Native PCM import/restore bypasses additional master coloration by default; the optional tone switch may explicitly enable it. The calibration import browser test also checks that this state survives reload and that the browser-built edited export preserves volume codes.

- `python tests/test-unison-source.py`: measured four-layer rates, live enter/switch/release, grouped choke and global four-voice stealing.

- `node scripts/build-calibration.mjs <output-dir> --filter-isolated`: original 5 Hz–10.5 kHz multisine; 60 BPM, 64-second automatic filter/resonance sweep, 128 verified native cells and no FX.
- `python tests/test-calibration-import.py <filter-backup.wav> --filter`: actual browser import/reload/play and exact filter/resonance code re-export.

- `python tests/test-filter-response.py`: actual browser biquad magnitude error against recorded fixtures, Q dB units, filter gain and 31/32 mapping.
- `python scripts/fit-filter-calibration.py`: regenerate fitted filter tables (offline numpy/scipy required).
