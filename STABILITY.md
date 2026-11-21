# Storage and runtime behavior

## Import

Receive → Scan QR scans one project download URL (HTTPS recommended). The
camera only decodes the URL; downloaded WAV/JSON/gzip native frames still
pass their existing validation before loading. Offline animated QR playback
and chunk collection were removed. Hardware stereo backup audio I/O remains.

## Binary sample assets

New ordinary samples use a scoped IndexedDB `po33-sample-assets-<scope>`: Float32 PCM buffers
are content-addressed by SHA-256 including sample rate. Each `po33.slotN`
Creation/localStorage key is a small version-4 view manifest; metadata and
patterns keep their original keys. Copies reference the same binary asset.
A random lightweight `po33.asset-scope` marker isolates separate Creation
stores that happen to share a hosting origin. Reset retains that identifier
while clearing audio and project content. Old WAV/Base64/version-3 keys are still readable and migrate after decoding.

Assets are written and hashed on readback before replacing a KV index.
Confirmed refs and pending index switches protect buffers during collection.
Startup reconciles only successfully read indexes. An index write failure
leaves its previous value available; failures stay visible as memory-only
until a later successful save. Unreferenced assets are collected after index
updates; factory reset clears only this sampler database and its own KV keys.
There is no fallback that writes new large audio strings into small KV storage.
If IndexedDB is unavailable, new takes stay in memory with an explicit warning.

Storage is scoped to the page origin. Export before changing hosting origin;
Creation metadata does not make IndexedDB portable between different domains.
The existing native-project IndexedDB checkpoint is a separate mechanism.

## Screen/audio lifecycle

Visible performance, held recording, active sample tails and an open transfer
panel request a screen wake lock. Multiple activities share one lease; idle
and hidden documents release it. Visibility restoration and gestures can
reacquire it. Denied/unsupported requests do not block audio. Device/WebView
support must still be tested on R1.

User gestures retry suspended/interrupted music contexts, including an initial
resume promise that was left pending by autoplay policy. Critical backup
contexts are excluded: a suspended/interrupted backup fails and must restart,
rather than continuing a corrupt partial stream. This cannot control system
notification audio or guarantee background execution.

## Wheel and envelopes

In TRIM, touch knob A (start) or B (length) to focus the R1 wheel for eight
seconds. Orange outline indicates that edit focus. Slow turns move one sample
frame; sustained fast turns accelerate without dropping events. Direction
changes reset acceleration. Clicking outside knobs/pads or timeout exits;
the normal wheel default remains BPM. Metadata frame boundaries are clamped
and remain non-destructive, including melodic trim exported to native frames.
Samples use up to 2 ms attack and 3 ms release, shortened for tiny regions;
this reduces discontinuities but is not a guarantee against every click.

## Backup lead-in

The pure TS stereo PCM16 encoder now inserts 1.5 seconds of silence before
its preamble and 0.25 seconds after the signal. Timelines use those actual
frame offsets. Standard file output remains 44.1 kHz by default. This permits
output settling; it cannot suppress OS sounds or guarantee a clean hardware
mixer/USB path. Encoded frames are still validated independently.

## Checks

- `node test-runtime-lifecycle.cjs`: wake lease lifecycle, denial, gesture retry,
  no automatic critical-stream resume.
- `python -X utf8 test-stability-browser.py`: legacy migration, binary dedup,
  exact Float32 restore, pending-ref collection, failed-save preservation and
  fine/accelerated wheel editing.
- Existing recording, copying/reload, reset, single URL QR, transfer, calibration
  and three real-fixture encoder tests cover unchanged behavior.

## 待 R1 真机确认：扫码安装后的 Chain（2026-11-21）

用户报告 Creation 扫码安装后仅循环 Pattern 2，长按兔头恢复出厂后仍如此。
目前原因未确认，不能据此认定是 Creation SDK 或缓存的既定限制。
`test-mobile-chain.py` 使用真实浏览器触屏输入、手势自动播放限制，分别检查
普通存储与延迟的模拟 creationStorage：首次播放应自动前进 P01、P02、P03 等；
停止显示 132；再播放从 P01 开始；保存为单项 [2] 后恢复出厂应重新载入 1–8 Chain。
模拟存储不等于 R1 的实际 WebView、存储桥或缓存行为。

待真机复测：使用新版专用二维码，首次只按一次 PLAY 并持续等待至少 6 秒，
观察 P01 是否自动经过 P02 进入 P03；长按兔头恢复出厂后重复检查。
若仍只循环 P02，记录实际扫码入口、启动与重置画面、PTT/触屏输入方式及视频，
再排查加载旧脚本、旧存储/工程检查点覆盖、音频时钟挂起或设备桥差异。
首次按 PLAY 显示 P01、第二次停止显示 132、第三次开始显示 P01，本身是启停行为，
不能单凭这三个显示值判定 Chain 丢失。
