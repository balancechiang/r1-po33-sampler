# Project I/O and audio compatibility

The main application contains the receive/send panel; no separate backup or audition page is required.

Supported project inputs include native backup WAV, stereo lossless M4A (including tested iOS Voice Memos ALAC), lossless project JSON, raw `.po33frame` and gzip-compressed `.po33.gz` frames. URL QR codes download these files; camera images are decoded locally. Stereo input files must preserve both modem channels.

Exports use the TypeScript native-state serializer and offline stereo DQPSK encoder. The default hardware WAV is 44.1 kHz / 16-bit stereo with a 1.5-second silent lead-in. It is a modem signal, not listening audio. Native frames/JSON preserve raw state; new web parameter mappings may be approximate. A single QR can open a hosted project download link; multi-frame QR transfer is not supported.

Real-time backup capture uses its own AudioWorklet and unprocessed stereo input, isolated from sample-recording gain and playback coloration. File import is the fallback when a browser cannot supply independent stereo capture. Browser/driver processing and physical hardware acceptance require device testing.

The decoder reports packet checksums and unresolved sample references. A valid software round trip does not establish physical-device acceptance. See [codec implementation and provenance](../decoder/README.md), [sync](sync.md) and [remaining validation](remaining.md).


Transfer result codes are latched: `end` for completion, `stp` for explicit termination, and `err` for failure. There is no automatic result timeout. Another control/key acknowledges the result; tapping unused background does not. Stop cancels the active operation and releases transfer audio rather than attempting to decode a partial receive. Silence-based automatic receive completion still validates and imports the captured stream normally.
