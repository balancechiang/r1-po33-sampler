# Hardware Backup I/O — implementation and evidence

## Current status

The three official Transfer packs have now been tested against this page:
two PCM16 packs load and save byte-identically; the 24-bit Escalate pack is
rejected. None imports as an editable project. See [actual fixture results](OFFICIAL-BACKUP-TESTS.md).

Stage 1 software is implemented in `backup.html`, `backup-ui.js`,
`backup-worklet.js` and `backup-wav.js`. Physical PO-33 loopback acceptance has
**not** been tested. Stages 2 and 3 — DQPSK modem, frame codec and editable
hardware-project import/export — are **not implemented**. There is no claim
that the web sampler's beat WAV export is a hardware backup.

The new path records/replays an existing raw backup audio signal. It never
imports that signal into sample slots and never overwrites the web project.
It does not transmit anything automatically. Device permissions and playback
always require user actions. No audio or device identifiers are uploaded.

## Open and test

Serve this repository with HTTPS or localhost. For local development, run
`python -m http.server 8765` in this folder and open
`http://localhost:8765/backup.html`. AudioWorklet module loading is not supported
reliably from `file://`; there is no ScriptProcessor fallback.

The main panel's WRITE + SOUND + PLAY opens the raw replay page, and
WRITE + SOUND + RECORD opens the raw receive page. Shift+mouse holds work for
these combinations. The sampler output is stopped/suspended first, so its
musical processing does not mix with a transfer. The transfer page is separate
from the established 240×282 panel.

1. Select the USB audio interface. Device enumeration requires permission;
   the permission-only stream is stopped immediately. Output selection requires
   `AudioContext.setSinkId`; otherwise explicitly choose the desired default
   output in the operating system.
2. Record from PO-33 line out using WRITE + SOUND + PLAY on the hardware.
   The capture context explicitly requests 44100 Hz; the track requests exactly
   44100 Hz and two channels, with echo cancellation, noise suppression and AGC
   disabled. Reported settings must confirm these values. Unknown settings fail
   closed. The worklet independently rejects a mono source; it never duplicates
   it to stereo. Monitoring output remains silent to avoid feedback.
3. Stop after the hardware finishes. The worklet flushes the final partial
   block before acknowledging stop. The main thread checks block sequence and
   frame counts. Gaps, channel mismatch or device disconnection discard capture.
4. Save the original stereo PCM16/44100 WAV. Or open/drop an existing file in
   that format. The strict parser does not call `decodeAudioData` and rejects
   MP3, mono, other rates/bit depths and malformed/truncated input.
5. Connect output to PO-33 line in. Put hardware in receive mode with
   WRITE + SOUND + RECORD. Receiving replaces its sounds/patterns. Replay the
   raw WAV and verify progress/no `Err` on the hardware. Configure system
   volume and disable EQ/spatial/effects manually; the page uses unity gain.

The browser checks its context/track format, not the physical ADC/DAC or OS
audio engine. A 44100 Hz context alone cannot prove absence of resampling in
the OS/interface. The explicit requirements are enforced as far as observable;
hardware loopback remains the acceptance criterion.

There is a 10-minute audio limit and a 128 MB input-file limit. Recording is
memory-backed; use a desktop for long transfers. Tab hiding aborts recording.
Peak meters and rising-crossing frequency estimates are calibration aids,
**not** SNR measurement, modem lock, frame CRC validation or proof of completion.
The page does not automatically stop at a presumed END frame.

## Reference audit and corrections to the proposed plan

Consulted on 2026-11-17:

- [cspotcode/PO-33-KO-backup-re](https://github.com/cspotcode/PO-33-KO-backup-re)
  and its [original discussion](https://www.reddit.com/r/pocketoperators/comments/d1hd9o/deconstructing_po33_backup_format/)
  are early phase/symbol observations and partial tooling, not a complete
  editable-project specification. The README's 7800 Hz is an approximation.
- [rileyjshaw/po-33](https://github.com/rileyjshaw/po-33) plays ordinary audio
  sample chains into a drum bank. It is not the backup modem or complete
  samples/patterns binary project serializer. No source code from it is copied.
- [ericlewis/libpo](https://github.com/ericlewis/libpo), observed revision
  `bd56423d1ab20a36870a94c9373da5938ebadf34`, provides more recent MIT-licensed
  [stereo transport](https://github.com/ericlewis/libpo/blob/bd56423d1ab20a36870a94c9373da5938ebadf34/core/docs/api/STEREO.md)
  and [PO-33 format evidence](https://github.com/ericlewis/libpo/blob/bd56423d1ab20a36870a94c9373da5938ebadf34/core/docs/formats/PO33.md).
  Its modem uses **7812.5 symbols/s**, not an exact 7800 constant. The sample
  data lead is 8-bit mu-law at 23437.5 Hz, distinct from transfer WAV PCM16/44100.
  This repository's new Stage 1 code is original; no libpo C code is vendored.
- The libpo format notes establish 510-byte settings and 1032-byte pattern
  records, while explicitly retaining raw/unknown fields. Numerical note,
  timing, retrigger and some knob mappings are unresolved. A carrier alone is
  insufficient: channel order, differential mapping, clock recovery, framing,
  whitening, CRC and termination must all agree.
- Sample capacity accounting includes shared pools, allocation rounding and
  audio outside trims. An array of independently copied Float32 samples and
  a naive sum of visible slice lengths is not a hardware-equivalent schema.

Relevant platform references: [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode),
[track settings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings),
[output selection](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).

## Next gated milestones

1. **Hardware loopback:** save a real capture, replay it unchanged, and record
   the physical acceptance result plus interface/browser/settings. This is
   still required to complete Stage 1 acceptance.
2. **Opaque transport first:** implement/port the pinned modem and packet
   validation, with original raw frame retention. Compare against known
   captures and an independent decoder. Re-modulate unchanged bytes and test
   hardware acceptance before enabling edits. A generated self-roundtrip alone
   cannot establish protocol correctness. Preserve left/right order and raw
   unknown packet tags, boundaries and fields.
3. **Editable records:** keep raw settings, pattern cells, FX nibbles and source
   pool topology alongside any semantic project view. Use controlled hardware
   changes/readbacks to resolve displayed note/length/retrigger/parameter units.
   Do not guess them, normalize raw zeros, discard parameter-only rows, or map
   web FX button numbers to stored codes without evidence. Reject unsupported
   edits explicitly. Preserve per-pattern web BPM/swing as web extensions;
   hardware settings expose a global tempo, not these app-specific values.
4. **Sample conversion and complete serialization:** separately validate mu-law
   conversion, rate adaptation for ordinary sample audio, shared aliases, guard
   and allocation limits, raw retained state, full frame checksums/termination,
   and hardware edited-project acceptance. Resampling ordinary sample PCM to
   the internal sample rate is distinct from and must never alter the modem
   transfer audio path.

## Automated checks

`node test-backup.cjs` exhaustively roundtrips all 65536 signed PCM16 values,
checks exact stereo WAV bytes and strict format rejection, then tests worklet
capture/flush, mono and frame-gap rejection, silent monitoring and exact replay.

`python -X utf8 test-backup-browser.py` serves localhost and tests actual Edge
AudioWorklet playback/capture, file saving, devices, rejection, and the panel
entry. Capture uses a simulated compliant interface fed by a real stereo Web
Audio source. Audio is muted by the test browser. This does not test physical
USB ADC/DAC fidelity or PO-33 acceptance.

简体中文：现阶段只完成原始备份音频的双声道录制、WAV 保存和回放。尚未实现调制解调、工程解码、编辑后生成硬件备份，也没有通过实体 PO-33 验收。请使用 localhost／HTTPS 打开 `backup.html`；不要将普通 beat WAV 当作硬件备份。下一阶段需要真实备份录音及原样回写的硬件结果作基准。
