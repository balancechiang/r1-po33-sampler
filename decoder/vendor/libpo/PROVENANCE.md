# Source provenance

Source: https://github.com/ericlewis/libpo

Revision: `bd56423d1ab20a36870a94c9373da5938ebadf34`.

`../../modem-pll.ts` ports/adapts the pilot-clock stereo decoder in
`core/src/po_stereo.c` to dependency-free TypeScript. Test waveform synthesis
also follows that file's modulation equations. `core/src/po33.c`,
`po33_data.c`, `po33_audio.c` and `core/docs/formats/PO33.md` were consulted
for framing, CRC, pattern records, pool references and signed mu-law.

The complete upstream MIT license is preserved in LICENSE.
