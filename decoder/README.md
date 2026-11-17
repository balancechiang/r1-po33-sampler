# PO-33 offline backup decoder

The first decoder milestone of the Rabbit R1 hardware compatibility spec.
Entry point: [`../src/codec/po33Codec.ts`](../src/codec/po33Codec.ts).
Runtime code is pure TypeScript without Node, Web Audio, native or WASM calls.
It is connected to the isolated [project audition page](../project-import.html),
not to persistent project replacement or USB live decoding.

```ts
import { decodePO33Backup, parseWavStereo, demodulateToBitstream }
  from '../src/codec/po33Codec.ts';

const project = decodePO33Backup(await file.arrayBuffer());
console.log(project.meta.bpm, project.slots, project.patterns);
console.log(project.validation, project.warnings);

// Also accepts { left: Float32Array, right: Float32Array, sampleRate: number }.
const pcm = parseWavStereo(await file.arrayBuffer());
const transport = demodulateToBitstream(
  pcm.leftChannel, pcm.rightChannel, pcm.sampleRate);
```

## Interface and interpretation

- Exports `PO33Project`, `PO33Slot`, `PO33Pattern` and supporting interfaces.
- Strict stereo RIFF parsing supports PCM16/24/32 and float32; actual sample
  rate is retained, without resampling. Input limits: 128 MB, ten minutes,
  32000–192000 Hz. Tested physical-file rate: 44100; synthetic tests: 44100/48000.
- Pilot-clock recovery uses 7812.5 Hz and tests normal/swapped channels.
  A complete preamble and END frame with every packet CRC valid are required.
  Invalid, truncated or checksum-failing input throws; it is never a partial success.
- Sixteen slot descriptors map all 136 native sound records, including shared
  sample pools. PCM uses the native 23437.5 Hz signed mu-law decoding rate.
  Empty slots remain null. Drum previews concatenate available slices; use
  slice source coordinates and pool IDs for the original layout. Do not sum
  duplicated slot preview lengths to calculate hardware memory usage.
- Sixteen patterns retain all 1032 raw bytes each, decoded triggers, timing,
  FX, parameter-only cells and raw parameter codes. Codes are not guessed
  into physical filter frequency, gain or resonance units.
- Slice preview settings and master volume are explicitly marked defaults,
  not values proven recovered from hardware. Swing preserves its raw code.
- `raw.state` retains both global records, all headers and all pool codes,
  including unused allocation/padding. `raw.frameBytes` retains the transport.
  `validation.complete` means a complete CRC-valid transport, not proof that
  every source sample reference resolves or every parameter is understood.
- Decoding is synchronous and memory intensive. Run in a worker when adding
  R1 UI integration; desktop test timings are not R1 performance evidence.

`encodePO33Backup`, live Worklet demodulation, USB 48 kHz capture integration,
persistent sampler import and physical hardware acceptance remain pending.
There is deliberately no encoder placeholder returning an ordinary audio WAV.
The existing raw PCM16 replay page keeps its original format restrictions.

## Browser audition

Serve the repository with HTTP/HTTPS and open `project-import.html`. Choose a
backup WAV, wait for validation, then use the original panel in the iframe.
The decoder runs in a module worker; checked-in browser JS is generated from
the same TypeScript. Rebuild after codec changes with `npm run build:browser`
in this directory (or `node decoder/build-browser.cjs path/to/tsc.js` from root).

The embedded panel's `backupPreview=1` mode never reads/writes project storage.
Reopening the normal sampler restores the previously saved project. Preview
edits are discarded on reload. No transmission, playback or save occurs
automatically. Local ignored fixtures can be loaded for testing with
`project-import.html?fixture=escalate`, `?fixture=frekvens` or `?fixture=16operators`;
the audio is not included in releases.

`project-preview-adapter.js` maps native shared pools to shared Web Audio
buffers and uses slice offsets instead of equal-sized drum slicing. Unresolved
source ranges are silent. Notes, note lengths, retriggers, pitch locks, chain
and FX map into the existing web engine. Filter/volume/resonance locks and
parameter-only changes are not yet mapped; native swing is previewed straight.
This is an audition of recovered data, not verified hardware-identical playback.
Run `python -X utf8 test-project-import.py` for all three real imports, all
sixteen patterns per pack, populated slots' manual playback, invalid/empty
pad silence and storage isolation checks. To check only selected packs, add
`--packs frekvens 16operators`.

## Actual official fixture results (2026-11-17)

| Pack | Valid packets | Slots / nonempty | Patterns / note triggers | Unresolved ranges |
| --- | ---: | ---: | ---: | ---: |
| Escalate | 4453 | 16 / 16 | 16 / 274 | 10 |
| Frekvens | 3393 | 16 / 10 | 16 / 300 | 0 |
| #16operators | 4164 | 16 / 16 | 16 / 0 | 0 |

All packet checksum error counts are zero. Escalate records 126–135 (slot16,
keys7–16) reference ranges beyond received pool120. These retain their exact
raw addresses and are flagged `out-of-pool`; preview audio contains only
available data, without invented padding or guessed cross-pool correction.
This is an interpretation limitation, not a waived CRC failure. #16operators
really contains sixteen empty patterns. Frekvens has six empty sound slots.

See the [Escalate slice audit](ESCALATE-SLICES.md) for exact original hex,
slot/pad mapping, full source buffer lengths and checks of sentinel, flag-mask
and compressed-offset hypotheses. Run `node decoder/inspect-escalate.cjs`
to log them using the optional `onSliceDiagnostic` decoder callback.

## Validation

Fixtures live in ignored `t/official-backup-tests/`; original and decoded audio
are not redistributed. See [fixture sources and hashes](../OFFICIAL-BACKUP-TESTS.md).
With Node >=24.12 (native TypeScript stripping) from the repository root:

```sh
node --expose-gc decoder/test-decoder.cjs
python -X utf8 decoder/test-reference.py
```

For static checks, install the pinned development TypeScript in `decoder`
and run its `typecheck` script. Do not use the workstation's legacy system tsc.
No package installation is required to run the decoder or its Node tests.

Tests pin all three WAV hashes, validate every packet, round-trip packet
bytes, verify sample pools and patterns, compare two modem implementations
on two packs, and test every mu-law code. Synthetic 44.1/48 kHz stereo tests
cover swapped channels, note/timing/FX/parameter-only records, shared slices,
corruption and truncated data. A separate Python standard-library parser
independently checks packet CRCs, all pattern hashes and all slot PCM hashes.
It checks decoded frame files written by the TypeScript tests; it is not an
independent physical-layer decoder or a hardware acceptance test.

## References and licenses

Pinned MIT code and adaptations from
[danilnagy/so_sample](vendor/so-sample/PROVENANCE.md) and
[ericlewis/libpo](vendor/libpo/PROVENANCE.md).
See [third-party notices](../THIRD-PARTY-NOTICES.md).
