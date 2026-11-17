# Official PO-33 Transfer fixture test

Tested 2026-11-17 against the actual Transfer WAV sources embedded in the
[official sound-pack page](https://teenage.engineering/downloads/po-33).
The demo MP3 files were not used.

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

Next steps are the modem/frame stages in [BACKUP-IO.md](BACKUP-IO.md). These
official files now provide genuine reference signals. Supporting Escalate's
raw playback would require an explicit 24-bit-preserving path; silently reducing
it to PCM16 is not part of this test or the current transfer implementation.

简体中文：三份官方 Transfer 文件均已实测。两份 16-bit WAV 可作为原始音频载入且原样保存；Escalate 的 24-bit WAV 被拒绝。当前均不能解码成可编辑工程，已有音色／Pattern 未变。本轮只增加测试与结果记录，没有放宽格式校验或修改音频文件。
