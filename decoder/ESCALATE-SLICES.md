# Escalate slice-range audit — 2026-11-17

The original official PCM24 WAV decodes with 4,453 valid packets and zero CRC
errors. Source SHA-256:
`6847d14da8a7c7438e84d0f16278988e1db7666c4d8f9942c1ad562efab166e5`.

## Actual diagnostic output

Every row belongs to **slotId 16, drum**, sourcePoolId 120. The source pool's
encoded byte length and decoded `buffer.length` are both **65,536**. This is
the complete referenced allocation, not the owner's first slice's 21,205-point
trim or the UI's concatenated preview length. padIndex is zero-based.

Raw Hex is the original nine-byte sound header extracted from CRC-validated,
unwhitened SOUND_DATA payloads, before slice resolution. It is not reconstructed
from parsed integers or taken from still-modulated WAV samples.

| padIndex | Panel key | Record | Raw Hex: LE32 start, LE32 end, owner | startSample | endSample |
| ---: | ---: | ---: | --- | ---: | ---: |
| 6 | 7 | 126 | DF 00 01 00 34 53 01 00 78 | 65759 | 86836 |
| 7 | 8 | 127 | 5B 26 01 00 34 5A 01 00 78 | 75355 | 88628 |
| 8 | 9 | 128 | 55 56 01 00 CA A9 01 00 78 | 87637 | 109002 |
| 9 | 10 | 129 | D0 78 01 00 69 A9 01 00 78 | 96464 | 108905 |
| 10 | 11 | 130 | AA AB 01 00 E0 F8 01 00 78 | 109482 | 129248 |
| 11 | 12 | 131 | C6 CE 01 00 81 F1 01 00 78 | 118470 | 127361 |
| 12 | 13 | 132 | F2 5D 01 00 FD 6F 01 00 78 | 89586 | 94205 |
| 13 | 14 | 133 | FD 6F 01 00 DC 8F 01 00 78 | 94205 | 102364 |
| 14 | 15 | 134 | DC 8F 01 00 FA AD 01 00 78 | 102364 | 110074 |
| 15 | 16 | 135 | FA AD 01 00 C0 FD 01 00 78 | 110074 | 130496 |

## Four hypotheses checked

1. **Empty-pad sentinels:** None of these start/end fields is 0, 65535 or
   4294967295. Neither referenced parser defines 0x0000/0xFFFF as a universal
   empty-pad sentinel. A SOUND_SELECT with no following SOUND_DATA is empty
   in this full-bank layout. Start=0 is legitimate: slot16/key1 is a valid
   example. Blindly dropping zero-start records would erase real samples.
2. **High-byte flags / missing bitmask:** Both parsers read complete LE32
   integers and the owner as a separate ninth byte. Neither declares a flag
   mask for these slice coordinates. These ten ranges do all contain bit16,
   but that alone does not identify a flag. In the same Escalate file, valid
   record19 has start=67347, end=81919 in a 90112-point pool; clearing bit16
   would corrupt it. No evidence supports wrapping by 65536 or applying 0xFFFF.
3. **Compressed-byte vs decoded-sample units:** Each signed mu-law byte
   expands to one PCM sample (stored here as one Float32 value). Pool120 has
   65536 codes and 65536 PCM points, not 131072 points. PCM16 output would
   occupy twice as many bytes, but this does not double its sample count.
   Neither dividing addresses by two nor multiplying the pool length is justified.
4. **Melodic vs drum mapping:** Selectors0..7 map to melodic slots1..8.
   For drum slots, recordId=8+16*(slotId-9)+padIndex. Thus records126..135
   map precisely to slot16/pad6..15, referencing owner120 (0x78). They are
   header-only aliases, not independent empty sample buffers; pool120 is used.

## Conclusion and limits

No omitted sentinel, address mask, compression expansion factor or slot-type
mapping error was found for these ten entries. The out-of-allocation addresses
are present in the checksum-valid source file. The pinned libpo format notes
explicitly describe Escalate's out-of-allocation references and say their sound
is unused by all its patterns. Our independent inspection confirms no slot16
note triggers in any of the sixteen patterns.

Retained ranges from an earlier edit/allocation are a plausible explanation,
not established fact. True hardware handling remains unverified. Keep the raw
bytes and unresolved status; do not fabricate a repair. The preview continues
to make these unresolved pads silent. This does not remove any of Escalate's
274 stored pattern triggers.

## Reproduce

From repository root, Node >=24.12:

```sh
node decoder/inspect-escalate.cjs
```

This runs the actual WAV decoder, logs the ten diagnostics at slice resolution,
asserts exact raw headers and ranges, and saves JSON to ignored
`t/official-backup-tests/escalate-slice-diagnostics.json`. `decodePO33Backup`
now exposes `sliceDiagnostics` and an optional second argument
`{ onSliceDiagnostic(d) { console.log(d); } }`. Default operation stays quiet.

## Pinned references

- [libpo header decoder](https://github.com/ericlewis/libpo/blob/bd56423d1ab20a36870a94c9373da5938ebadf34/core/src/po33_data.c):
  `po33_sound_header_decode` and `read32`.
- [libpo format notes](https://github.com/ericlewis/libpo/blob/bd56423d1ab20a36870a94c9373da5938ebadf34/core/docs/formats/PO33.md#sample-pools-ranges-and-copy-behavior):
  allocation ranges, source selection and Escalate caveat.
- [so_sample state parser](https://github.com/danilnagy/so_sample/blob/eb5e2617eae746d4fd9bd4f60aaf86e3ae65bc0e/web/src/core/state.ts):
  `parseFrame` reads full start/end and owner, without a slice-address mask.
- [so_sample signed mu-law](https://github.com/danilnagy/so_sample/blob/eb5e2617eae746d4fd9bd4f60aaf86e3ae65bc0e/web/src/core/mulaw.ts):
  one code to one PCM sample.
