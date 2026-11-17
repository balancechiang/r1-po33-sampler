# Hardware project audio transfer

Implemented locally on 2026-11-17. Serve this folder with HTTPS or localhost
(for example `python -m http.server 8765`) and open `index.html`.
No release package or deployment has been prepared.

## Panel controls

- **WRITE + SOUND + RECORD** opens receive mode, with `rcv` on the existing LCD.
  Choose **Open WAV** for a backup file, or **Line in** for a stereo interface.
- **Scan QR / 扫码** opens a camera preview. Scan a QR containing a public
  HTTPS WAV direct-download URL (plain URL or JSON `wavUrl`/`url`). The camera
  stops before download; the downloaded file must pass full frame CRC before
  replacing the project. Camera frames are decoded locally by a worker running
  bundled jsQR; there is no camera upload or external QR service. Denied camera
  access leaves a manual URL field available. Cancel/Close releases camera tracks.
  Cross-origin hosts must allow CORS; links requiring cookies/login, ordinary
  share pages, non-WAV responses and non-project WAVs are not supported. Downloads
  use omitted credentials, a 120-second timeout and a streamed 128 MB limit.
  Unknown Content-Length shows no invented download percentage.
- A fully original test QR and WAV are at `demo/qr-test/`. Open that page on
  another screen and scan inside receive mode. Expected: 108 BPM, one populated
  melodic slot and four notes in pattern1. This is separate from the Creation
  installation QR under `install/`, and does not exercise USB audio capture.
- **WRITE + SOUND + PLAY** encodes the current project. Choose **Save WAV**
  or put the hardware in receive mode and choose **Line out**.
- Keep the two modifiers held and tap the third key. Shift+mouse holds work.
  For one-finger touch, hold WRITE for 500 ms and release, hold SOUND for
  500 ms and release, then tap RECORD or PLAY. Latched keys have a thin orange
  outline, clear on another tap/outside tap/blur, and expire after eight seconds.
- **I/O → Find devices** lists interface inputs/outputs. Where output selection
  is unsupported, choose the system default in OS settings. Permissions are
  requested only for an explicit input/device action.
- In transfer mode, the R1 wheel moves focus through visible, enabled controls;
  each actual move requests one 12 ms vibration and shows an orange outline.
  Outside transfer mode the wheel keeps its normal BPM/held-step behavior.
- **I/O → Check input** probes the selected input with an ideal stereo request,
  reports actual channels/rate/channel capability range and processing flags,
  then stops the track. It does not record or relax the real backup input's
  strict stereo requirement. Overconstrained errors show the failed constraint;
  they do not by themselves prove that the Creation SDK forbids USB audio.
- **Stop / Close** cancels transfer. No signal plays automatically.
  **Undo restore**, available in the current session, returns to the preceding
  project; it is distinct from factory reset.

These combinations match the [official data-transfer controls](https://teenage.engineering/guides/po-33/en).
Original geometry and ordinary performance controls are unchanged outside
transfer mode. Transfer controls temporarily share the small screen with a
scaled instance of the same panel.

## Display state machine

| State | Seven-segment display | 32 squares | Numeric-key LEDs / I/O |
| --- | --- | --- | --- |
| Receive ready | `rcv` | Empty | Off; input icon activates when capture opens |
| Listening | `rcv` | Real input peak level | IN white; 60-second no-signal timeout |
| Receiving stream | `rcv` | Real input peak level | IN white; no fabricated total percentage |
| Reading local file | `rcv` | Actual bytes read | Off |
| Validating audio | `rcv`, CHECK label | Carrier-recovery processing progress | Processing cursor |
| Preparing send | `Snd` | Actual synthesized sample count | Processing cursor |
| Send ready | `Snd` | Empty | No audio output yet |
| Sending | `Snd` | Output frame count / total, left-to-right | OUT white; LEDs follow actual selectors |
| Successful restore / saved or sent backup | `End` | All 32 | All 16 LEDs bright; return after 2.5 seconds |
| Failure | `err` | Empty | No transfer lights; reason in controls |

There is **no duration-derived percentage for a stream of unknown length**.
The current non-streaming decoder verifies the full signal after recording
stops. It cannot know an exact remaining-byte count while listening.
After two seconds below the input threshold, recording stops and validation
starts; Stop can finish input manually. A silent/no-signal capture, overload,
track disconnection, active-signal render gap, hidden page or bad CRC cannot
result in a successful restore. Empty startup quanta before carrier arrival
are outside the signal; active-signal gaps remain errors.

The observed packet layout is globals → patterns → sound records, not a
hard-coded sound-first animation. Sending LEDs use byte-derived selector
positions in the encoded stream. LED/display timing and terminal duration
are an app simulation, not verified captures of every hardware transition.

`End` on receive means complete frame, CRC and state parsing passed and the
project was loaded. `End` on send means output finished; **the browser cannot
confirm that a physical PO-33 accepted it**. Check the receiving hardware.

## Codec and audio path

`src/codec/po33Codec.ts` exports the decoder and `encodePO33Backup`.
`po33Encode.ts` serializes/whitens packets, emits a 4096-byte preamble and
7812.5-symbol/s stereo DQPSK, and constructs a 44-byte PCM16 RIFF header.
The same source builds the checked-in `decoder/browser` modules. A module
worker does CPU-heavy work. Newly generated WAVs are signal-decoded and
validated before Save or Line out becomes available.

`po33WebProject.ts` translates current web samples, slices, notes, lengths,
retriggers, FX and chain. New samples use polyphase conversion to 23437.5 Hz,
signed mu-law, shared-pool allocation and the 241-page capacity check.
Fresh web projects additionally enforce a 40-second source budget. These
musical-sample conversions never touch the modem output signal.

An unchanged received project re-exports every original frame byte, including
unknown fields, parameter-only cells and Escalate's unresolved references.
Note edits preserve unrelated raw patterns and original sample allocation.
Sample/trim edits rebuild allocation; unresolved pads cannot be recreated,
and the send UI reports this limitation. New or edited web parameter locks
use approximate mappings and are not hardware calibrated. Native filter,
level/resonance automation and swing survive untouched exports but remain
incompletely reproduced by musical playback.

`backup-worklet.js` transports independent stereo channels, monitors input
silently, checks block ordering/frame continuity and reports real peaks.
The transfer context bypasses sampler volume, filters, saturation and FX.
Live capture accepts verified stereo at the actual 44100/48000 context rate,
disables echo cancellation/noise suppression/AGC, and rejects mono. Output
requires the encoded rate; no modem resampling/downmix is used. Browser
settings cannot prove the OS or USB converter is unprocessed. Actual USB
routing in R1 Creation remains unverified.

## Storage and recovery

Only a complete validated receive replaces the in-memory project. Cancel or
failure leaves it intact. Original `po33.*` creationStorage/localStorage keys
are retained. Received projects and subsequent edits checkpoint in the
separate `po33-hardware-project` IndexedDB database, retaining native raw
state and full-rate sample assets; startup restores that checkpoint. Undo
returns to the preceding session project. Factory reset clears the checkpoint
and usual sampler keys. Checkpoint failure is reported as memory-only restore.

Large backups are memory intensive. R1 memory limits and WebView support
must be measured on device. No audio or device identifiers are uploaded.

## Tests and evidence

- `node --expose-gc decoder/test-encode.cjs`: all three real official WAVs →
  UI snapshot → encode → decode, with identical full source frames; 44.1/48 kHz,
  preserved unknown ranges, isolated note edits, fresh web-factory encoding.
  Generates the short synthetic 48 kHz fixture used below.
- `node test-backup.cjs`: stereo preservation, Worklet output, ordered capture,
  mono rejection and pre/post-carrier gap behavior.
- `python -X utf8 test-transfer-panel.py`: actual three-key and one-finger
  combinations; rcv/err/End/Snd, 32 squares, LEDs/OUT, validated file restore,
  cancel, checkpoint reload, downloads and protected original storage keys.
- `python -X utf8 test-transfer-live.py`: real browser MediaStream → Worklet →
  decoder at 48 kHz with synthetic modulation, silence stop, meter/IN and mono
  rejection, 60-second timeout, overload/disconnection, undo and reload.
  This is not physical USB/PO-33 acceptance.
- `python -X utf8 test-qr-import.py`: real camera video frames from a browser
  canvas MediaStream → jsQR worker → WAV HTTP download → validated restore and
  measured playback. Also checks camera release, permission-denied URL fallback,
  invalid WAV, CORS rejection, cancellation and preservation of the prior project.
  This does not validate the physical R1 camera or its permission flow.
- `python -X utf8 test-backup-browser.py`: legacy raw-page capture/replay
  regression and integrated entry. `backup.html` remains a separate strict
  PCM16/44100 raw recorder/replayer, not the main restore interface.

The panel's downloaded Escalate backup decodes to source frame SHA-256
`1580c178c32b2f0d57bccd6f0a912ad0bf02dc7a653fcc5b6ffd3e82e1fe3f50`.
See [fixture results](OFFICIAL-BACKUP-TESTS.md), [codec details](decoder/README.md),
[slice audit](decoder/ESCALATE-SLICES.md) and [licenses](THIRD-PARTY-NOTICES.md).

简体中文：主面板组合键已整合工程 WAV 导入、导出和独立双声道音频传输。
接收只有校验成功才载入工程；七段码显示 rcv／End／err，32 格分别显示真实
电平、处理进度或已知长度的发送进度。已做浏览器模拟回环与真实备份回读，
尚未通过 R1 USB 声卡与实体 PO-33 验收。普通 beat WAV 不等于工程备份。
