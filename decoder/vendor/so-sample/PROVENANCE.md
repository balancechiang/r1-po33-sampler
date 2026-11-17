# Source provenance

Source: https://github.com/danilnagy/so_sample

Revision: `eb5e2617eae746d4fd9bd4f60aaf86e3ae65bc0e`.

Files copied from `web/src/core`: bytes.ts, crc.ts, globals.ts, labels.ts,
mulaw.ts, packets.ts, pattern.ts, state.ts, wav.ts, modem/decode.ts,
project.ts and resample.ts.
Changes are attribution headers, explicit `.ts` relative import extensions,
and removal of trailing blank lines.
The complete upstream MIT license is preserved in LICENSE.

`src/codec/po33Template.ts` contains only the two global setting records from
`web/src/core/__fixtures__/template-empty.json` at this revision. Template
capture SHA256: fcd6d5e6772440342c1d19eee3c3c0a3f3064541ed21b6dfcc6964aa2aec1309.
These settings seed new projects; no upstream audio is embedded.

This snapshot is used for packet whitening/CRC, raw state parsing, signed
mu-law, pattern/global interpretation, WAV parsing, and a second modem check.
