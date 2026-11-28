# Local Hub · 33033

This optional service does not replace GitHub Pages. The Creation remains at
https://balancechiang.github.io/web-sampler/. Your local files and private
certificate key are never committed or uploaded by the hub.

## Start on the computer

From the repository root:

```sh
npm run hub
# Equivalent, and sufficient if npm is not installed:
node scripts/local-hub.mjs
```

The service uses **only Node built-in modules**, without npm installation,
openssl, external accounts or a cloud service. Use Node >=24.12 for this
repository's codec tools. It listens on `0.0.0.0:33033` and prints all local
IPv4 URLs. A read-only HTTP download endpoint on port `33034` serves QR links
to phones that cannot accept the self-signed manager certificate. Keep this
process running and put the computer and phone/R1 on the same LAN.
Stop it with Ctrl+C. There is no background installer or firewall modification.

Open the printed HTTPS address on the computer. Drag WAV/JSON files onto the
dark manager or use its picker. Click **Show QR** beside a file; scan it from a
phone on the same Wi-Fi to download that file over the isolated read-only HTTP
port. This QR is local-network-only and works while the hub is running. Files
are stored in `my-po33-projects/`.
Names, file sizes and modification times are listed newest first. Delete asks
for confirmation. Duplicate names are rejected instead of silently overwritten.
Uploads/downloads are limited to 128 MB. Only `.wav` and `.json` names are
accepted, with traversal/symlink checks. Uploading does not automatically prove
that a file is a valid PO-33 backup; the Creation validates it when loading.

`my-po33-projects/` and `.certs/` are ignored by Git. This computer's local
test folder contains Escalate.wav and Escalate.json, copied from verified
local test data; neither is distributed with the repository.

## HTTPS and trust

On startup, native Node crypto generates an RSA/SHA256 self-signed X.509
certificate in `.certs/cert.pem` and `.certs/key.pem`. SAN contains all current
non-internal IPv4 addresses, 127.0.0.1 and localhost. Validity is 3650 days.
The key/certificate pair is verified and reused; expiration or changed IPs
cause regeneration. A SHA256 fingerprint is printed. Generation failure
falls back to HTTP on the same port, with an explicit warning.

A self-signed certificate is **not automatically trusted**. On your device,
open the printed hub URL directly. If your browser permits and you choose to
trust this local test endpoint, use its Advanced / Continue option yourself,
then return to the Creation. This does not install a CA or weaken settings
automatically. A browser exception may not be shared with Creation's Android
WebView; some WebViews refuse self-signed certificates completely. Use Load
File in that case. HTTP fallback may also be blocked as mixed content.
Local-network permissions, firewall reachability and TLS trust are separate
from CORS; iframe messaging cannot bypass those controls.

## Load on r1

1. WRITE + SOUND + RECORD → **LAN HUB (:33033)**.
2. Enter the computer IPv4 only (for example `192.168.1.213`). The port is fixed;
   HTTPS is default. The IP persists in `localStorage` as `po33.localHub.ip`.
3. Press CONNECT. Select HTTP fallback only if the server actually fell back.
4. After the list arrives, turn the hardware wheel to choose a file; press
   the side button or tap the row to load. Actual focus changes have a short
   haptic pulse and an orange outline. The normal panel's BPM wheel is unchanged.
5. WAV is demodulated and packet-validated; JSON is rehydrated and its native
   frame checked. Only then is the current project replaced and End displayed.
   Undo restore and normal checkpoint persistence continue to work.

If READY does not arrive within **3000 ms**, the panel explains the startup,
Wi-Fi, certificate and mixed-content checks. Load File remains available for
`.wav,.json`, without a network bridge. File requests have a 120-second timeout.
Closing the panel removes the iframe and ignores stale messages.

## Bridge and API

`GET /` serves the manager; `GET /bridge` serves the hidden-frame bridge.
`GET /api/list` returns `{name,type,sizeBytes,updatedAt}[]` sorted by mtime.
`GET /api/file?name=...` streams `application/octet-stream`.
`POST /api/upload?name=...` atomically stores the binary body.
`DELETE /api/file?name=...` deletes a selected regular project file.

The bridge fetches those APIs on its own origin and uses the requested
READY / GET_LIST / LIST_RESULT / GET_FILE / FILE_RESULT protocol. File buffers
use `postMessage(..., '*', [buffer])`, transferring ownership; the parent then
transfers the buffer to the codec worker. This avoids extra message-channel
copies, but the file must still be read into an ArrayBuffer; it is not a
zero-memory streaming decoder.

The parent checks the actual iframe window, origin and pending filename.
The bridge accepts requests only from its actual parent at the production
GitHub Pages origin, its own origin, or localhost development origins. It
does not grant arbitrary remote websites access to private files. No login
is used; ordinary LAN clients can access the service's selected project
directory. The server rejects cross-origin browser writes and unexpected Host
headers. It does not expose arbitrary filesystem paths or certificate files.

## Lossless JSON v1

`src/codec/po33JSON.ts` exports `projectToJSON` and `projectFromJSON`.
The file envelope is `{format:"po33-project",version:1,project:...}`.
Every Uint8Array is tagged as `{$po33:"u8",base64:...}`. Every Float32Array is
tagged `{$po33:"f32le",base64:...}` with explicit little-endian sample bytes.
This includes the original frame, mu-law codes, raw patterns and PCM previews;
samples are never rounded through JSON decimal text.

Import reconstructs typed arrays, validates the complete original preamble,
packet CRC and layout, and rebuilds derived views from that checked frame.
Stored native pool PCM/codes must match the frame. JSON with stale edited
sample pools is rejected; edit in the app and export again. A full legacy
PO33Project containing numeric `raw.frameBytes` is also accepted and validated.
Receiving a JSON has no original WAV input rate, so its diagnostic
`inputSampleRate` is 0; this does not change the native 23437.5 Hz sample rate.

**Send → Save JSON** compiles current web edits and downloads this format.
The three official fixtures pass WAV → JSON → WAV with identical native
frame bytes and Float32 pool bytes, including Escalate's unresolved headers.
The newly synthesized WAV waveform need not equal the original recorded
waveform. Existing hardware-parameter playback/encoding calibration limits
remain as documented in audio-backup.md.

## Verification

- `node test-local-hub.mjs`: native TLS/SAN/signature, routes, atomic upload,
  delete, path/host/origin rejection and HTTP fallback.
- `node --expose-gc decoder/test-json.cjs`: three real backups' binary JSON,
  exact frame/Float32 preservation, standard WAV re-encoding, stale PCM rejection.
- `python -X utf8 test-hub-browser.py`: with the hub running and local fixtures,
  actual HTTPS manager upload/delete and cross-origin iframe messages, WAV/JSON
  restore, side-button confirmation, JSON export, spoof rejection and timeout.
  Certificate exceptions exist only in the disposable test browser context;
  this is not physical R1 certificate or WebView validation.

简体中文：电脑运行 `node scripts/local-hub.mjs`（有 npm 时也可 `npm run hub`），
打开终端显示的 HTTPS 地址管理本地文件。R1 接收菜单打开 LAN HUB、输入电脑 IP，
滚轮选文件、侧键确认。自签名证书需要设备侧手动处理信任，且浏览器的信任例外
不保证适用于 Creation WebView；失败时用 Load File。目录和证书不会上传 GitHub。

## R1 in-panel connection test

Creation may have no standalone browser or certificate confirmation screen.
CONNECT tests the selected protocol on port 33033. TEST HTTP :33034 tests
a separate plain HTTP diagnostic server; start it on the computer with:

```powershell
node --input-type=module -e "import {startHub} from './scripts/local-hub.mjs'; await startHub({port:33034,forceHTTP:true});"
```

The status shows the exact endpoint and reports Bridge OK only after receiving
a valid bridge list. A timeout cannot distinguish TLS, network or WebView restrictions.
Page CSP violations are reported when the browser exposes them; other iframe
failures do not provide a reliable detailed error to the parent page. No security
restrictions or certificate checks are bypassed. Load File remains available.

## Offline animated QR transfer

The transfer panel supports direct, offline project handoff in either direction.
On the sending device choose **Send → Animated QR**. The current editable project
is validated and compiled to the native project frame, gzip-compressed, split
into checksum-protected packets and shown as a repeating QR sequence. On the
receiving device choose **Receive → Scan QR** and keep the camera aimed at the
sender until the complete frame has been received and verified. The usual native
decoder then validates the frame CRC before replacing the current project.

No project data is uploaded to a server. The camera permission is used only on
the receiving device; QR decoding stays local. A missed frame is sent again on
the next loop. Fragment capacity scales to the sender's display area (600 bytes
on a 240 px R1 display; larger screens can use up to 1,400 bytes per frame).
The default 200 ms cadence is a speed/reliability compromise; 120 ms is fastest,
while 300 or 500 ms can help when camera focus or display refresh misses frames.
Pause/resume and Stop are available. Keep both pages in the foreground. HTTPS
(or localhost during development), camera permission,
`CompressionStream`/`DecompressionStream`, and Web Crypto are required.

On the current full factory demo, local browser verification compressed the
native frame to about 492 KB and 820 fragments at 600 bytes each: a full loop is
about 98 seconds at 120 ms/frame or 164 seconds at 200 ms/frame. Actual camera
retries and device speed can increase the time; larger phone/desktop sender
screens use larger fragments and reduce the count.

The phone/R1 camera path is not considered hardware-verified until tested on the
device. QR size and cadence can vary by display density and camera focus; start
at 200 ms, then use 300/500 ms if the receive count stalls. Cancel/reopen the
scanner before starting a different sender project.

## Camera download link

Receive → Scan QR also continues to accept a single project download URL. WAV,
M4A, JSON and compressed native-frame file imports remain available.

## Single-QR HTTPS compressed project download

Receive → Scan QR accepts HTTPS direct links to `.po33.gz` gzip-compressed
native frames. The response is bounded to 128 MiB, decompression to 8 MiB,
then the native preamble/layout/packet CRC is verified before adoption.
Load File also accepts `.po33.gz` and `.po33frame`, besides WAV/JSON.
A gzip header is detected on downloaded files; downloaded JSON needs a `.json`
URL suffix. The server must permit CORS. No trust or browser policy is bypassed.

For a temporary test, `python tools/share-project.py --file <selected-file>`
binds a read-only single-file endpoint to 127.0.0.1:33035. Only the random
printed path serves the chosen file; there is no directory listing, upload,
delete or Hub bridge. Point a separately installed trusted HTTPS tunnel at
that origin, then encode its HTTPS hostname plus the printed path as a URL QR.
Anyone who obtains the URL can download this file while the server and tunnel
remain running. Do not expose the management Hub through a public tunnel.
Temporary provider hostnames expire when the tunnel stops and can be blocked
by networks; this is not a permanent distribution URL.

Verification: `python -X utf8 test-project-download.py <Escalate-HTTPS-URL>`
checks a real QR camera pipeline, cross-origin compressed download and native
restore of all 16 slots, plus rejection of an invalid decompressed frame
without replacing the loaded project. This is not physical R1 validation.
