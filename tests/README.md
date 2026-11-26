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
python tests/test-sync-browser.py
python tests/test-sync-fx.py
```

`test-m4a-pwa.py` additionally uses imageio-ffmpeg to generate lossless ALAC fixtures. Sampling analysis utilities use NumPy/SciPy. Private official backup fixtures are not distributed.

Synthetic capture and desktop browser tests validate application logic and payloads; physical hardware, mobile WebViews and audio-interface voltage/latency need device testing. Historical page snapshots are retained in Git history rather than as served pages or fixture copies.

- `python tests/test-copy-chord.py`: sound/pattern copy arming, blink, immediate overwrite, repeated destinations and HOLD.

- `python tests/test-step-selection.py`: selected-note LED levels, long-held step audition/template, erase/refill, per-step locks, retrigger cycling and copied filter.

- `python tests/test-melodic-step.py`: note/gate controls on all pages, padded displays, wraparound gate preview, fill priority and gate-template insertion.

- `python tests/test-preview-meter.py`: manual preview meter suppression with playback and knob parameter indicators retained.
