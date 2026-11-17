# Official PO-33 Transfer fixture test

Tested 2026-11-17 against the actual Transfer WAV sources embedded in the
[official sound-pack page](https://teenage.engineering/downloads/po-33).
The demo MP3 files were not used.

## Offline project decoder added

The separate pure TypeScript API now validates and parses all three files,
including the PCM24 Escalate source. Every packet passes CRC: Escalate 4453,
Frekvens 3393, #16operators 4164. Each returns 16 slot descriptors and 16
patterns. Escalate has ten unresolved source sample ranges (preserved and
flagged); #16operators has sixteen genuinely empty patterns. See
[decoder API, tests and limitations](decoder/README.md).

The isolated `project-import.html` audition now loads Escalate into the original
panel: 16 slots, 16 patterns, 274 notes and 120 BPM. Browser tests measure
nonzero output for all 16 patterns, silence for invalid slice16/key7 and output
for valid slice16/key1. Import, playback and reload preserve saved project
storage. See `test-project-import.py`. This is preview-only: native filter,
volume/resonance locks, parameter-only events and swing remain unmapped.

The same browser path was also tested with Frekvens and #16operators:

| Pack | Populated sample slots | Pattern notes | BPM | Unresolved slices | Browser result |
| --- | ---: | ---: | ---: | ---: | --- |
| Frekvens | 10 | 300 | 128 | 0 | 14 populated patterns produce measured output; empty patterns12/16 add no voices; all ten sample slots manually trigger |
| #16operators | 16 | 0 | 120 | 0 | All sixteen patterns add no voices; all sixteen sample slots manually trigger |

All sixteen patterns per file were selected and tested in the actual panel.
Empty patterns can retain a previous sound's tail, so the empty-pattern check
counts new AudioBufferSource starts rather than misclassifying a decay as a
stored note. Both imports and the final reload preserve saved project storage,
and generate no page errors. Tests: `python -X utf8 test-project-import.py
--packs frekvens 16operators`. Machine-readable results stay in ignored
`t/official-backup-tests/project-import-browser-results.json`.

Local audition links use `project-import.html?fixture=frekvens` or
`?fixture=16operators`; only the three known fixture names are accepted.
These URLs require the local ignored WAVs, which are not distributed.

The table below describes the existing raw replay page, which remains separate.

## Raw replay page results

| Pack | PCM format | Duration | Current raw backup page | Editable sampler project |
| --- | --- | --- | --- | --- |
| Escalate | Stereo, 44100 Hz, 24-bit | 268.333333 s | Explicitly rejected by the PCM16 requirement | Not imported |
| Frekvens | Stereo, 44100 Hz, 16-bit | 206.000000 s | Loaded successfully; saved WAV byte-identical | Not imported |
| #16operators | Stereo, 44100 Hz, 16-bit | 250.609524 s | Loaded successfully; saved WAV byte-identical | Not imported |

The current `backup.html` file input reads raw modulation audio only. It does
not demodulate bytes, validate PO-33 frame CRCs, decode samples, or populate
the web sampler's 16 slots/patterns. Successful WAV loading is not successful
project import. This test confirms that limitation rather than working around it.

For both accepted packs, downloaded output SHA-256 equals the original file.
The sampler's full localStorage snapshot and eight factory sample indicators
remained unchanged throughout testing. Tests used headless Edge on localhost,
with audio muted. No Transfer signal was played and no hardware was written.

## Source identity

| Pack | Original bytes | Source |
| --- | ---: | --- |
| Escalate | 71,097,474 | [Official WAV](https://assets.teenage.engineering/_img/63580398d7d4c7df33b6af4a_original.wav) |
| Frekvens | 36,338,444 | [Official WAV](https://assets.teenage.engineering/_img/5e454633fda17e000475bb1c_original.wav) |
| #16operators | 44,215,066 | [Official WAV](https://assets.teenage.engineering/_img/5ff490f4fd7ad60004ae8beb_original.wav) |

SHA-256 values:

```text
escalate     6847d14da8a7c7438e84d0f16278988e1db7666c4d8f9942c1ad562efab166e5
frekvens     f6c62965940f68b9b22882c954be64e0dfc7e705904fe8d65b92a6de52dafa1f
16operators  c167b73d0d2afd1f7cf4261e2e4424bbd623d930394b4ae2851360d61e664110
```

Fixtures are local test downloads in ignored `t/official-backup-tests/`, named
`escalate.wav`, `frekvens.wav` and `16operators.wav`. They are not committed,
published or used as application presets. With these exact files present, run
`python -X utf8 test-official-backups.py` to reproduce header checks and browser
loading/saving tests. The script intentionally does not download or play audio.
Results are written beside the fixtures as `browser-results.json`.

The main panel now performs validated project restore and re-encoding; see
[BACKUP-IO.md](BACKUP-IO.md). All three official frames survive UI translation
and stereo encode/decode byte-identically. The panel-downloaded Escalate WAV
also recovers the exact original frame hash listed in the codec tests.
The legacy raw page retains its PCM16-only restriction; re-encoding a decoded
project is a separate operation, not a claim of byte-identical source WAV replay.

简体中文：三份官方 Transfer 文件均可通过主面板解码并载入工程，未经修改时重新编码回读可保留完整原始帧。旧版 raw 页面仍仅接收 PCM16；这不限制主面板接收 Escalate 的 PCM24 原文件。实体 PO-33／R1 USB 声卡验收尚未完成。
