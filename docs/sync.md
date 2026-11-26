# Analog clock sync

Experimental 2 PPQN audio clock compatible with the PO-33 workflow. Left carries clock and right carries audio in split modes. Mode and pulse gain are retained through audio-context recovery; reload defaults to SY0.

| Mode | Input | Output |
| --- | --- | --- |
| SY0 | no sync capture | webpage audio |
| SY1 | internal clock | left clock / right webpage audio |
| SY2 | external clock only | webpage audio on both channels |
| SY3 | external clock only | forwarded clock / webpage audio |
| SY4 | left clock + right audio | mixed audio on both channels |
| SY5 | left clock + right audio | forwarded clock / mixed audio |

SY0/1 do not capture optional external audio pass-through. The I/O panel selects sync mode and pulse gain. The RECORD + BPM shortcut is retained for compatibility. Stereo input must actually supply two independent channels.

The master uses fractional sample timing for 3 ms pulses, default normalized amplitude 0.7. Digital amplitude does not specify physical volts. The receiving hardware's official maximum sync input is 5 V peak-to-peak. Pulse width/level and hardware routes still require measurement.

The slave detects hysteretic edges in AudioWorklet and schedules audio with a 40 ms cushion plus interface/browser latency. Late callbacks skip missed notes instead of moving the original grid. A missing-clock watchdog stops input after at least 850 ms; this is application policy, not a verified hardware transport command.

A background timeline remains independent of FX. Loop/Scratch restore the correct global step and chain position on release. During sync, FX14 retriggers the first step's sounds at the next boundary without resetting chain position; outside sync its structural jump remains available. Clock pulses do not carry pattern-position reset commands.

SY1 selects a playback audio session and primes stereo output before its first clock, to address reported iPhone USB-adapter first-start issues. This is software-tested; specific iPhone/adapter behavior still requires retesting.

Software checks cover pulse timing, stereo isolation, capture release, mono rejection, all 15 live FX and saved FX14 under master/simulated slave timing. See [tests](../tests/README.md) and [remaining hardware validation](remaining.md).

References: [official guide](https://teenage.engineering/guides/po-33/en), [routing explanation](https://www.soundtech.co.uk/musicians-blog/pocket-operator-sync-modes.html), [Spongefile diagrams](https://www.spongefile.com/pocket-operator-sync-modes-explained/).
