# Offline animated QR project transfer

Open this directory's index.html on the computer through HTTPS or localhost.
On R1 open Receive → Scan QR. Choose Small test first; it is the existing
original CC0 108 BPM, slot-1, four-note synthetic project. The current fixture
uses 53 blocks (about 37 seconds per loop at 700 ms). Missing blocks are
collected on subsequent loops; there is no receiver acknowledgement channel.
Use 1200/2000 ms if the physical camera needs more time.

WAV and the app's lossless project JSON are accepted on the sender. Files stay
on the computer. The sender checks the project, extracts the original native
frame and gzip-compresses it. PO33QR1 packets carry SHA-256, total compressed
size, block index/count and 360-byte Base64 payloads. Receiver deduplicates,
reassembles out of order, validates SHA-256, bounded-decompresses (8 MiB), and
runs the existing native frame/CRC parser before adopting any project.
This preserves native project bytes; derived PCM/JSON views are reconstructed.
It is not arbitrary JSON transfer or live incremental Pattern synchronization.

Cancellation discards incomplete data and stops the camera. Completed import
replaces the active project using the existing checkpoint/Undo restore flow.
A different project during reception requires cancel/restart. SHA-256 detects
corruption, not sender authenticity. Only scan projects you intend to import.
Large sample projects may require many minutes and are not yet recommended.
Requires camera access, secure context, Web Crypto and CompressionStream /
DecompressionStream support. R1 hardware compatibility remains unverified.

QRCode.js encoder: vendored MIT, see vendor/qrcodejs/PROVENANCE.md and LICENSE.
Existing jsQR camera decoder remains local, Apache-2.0. No CDN or upload.

Validation: python -X utf8 test-animated-qr.py verifies actual QR rendering and
jsQR decoding, duplicate/reverse-order exact reassembly, corruption rejection,
native frame decoding and a synthetic live-camera sequence through the real
scanner worker into the app, including camera shutdown. Existing URL QR tests
remain in test-qr-import.py. Synthetic camera tests are not physical R1 tests.
