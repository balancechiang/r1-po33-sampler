import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../qr-transfer.js',import.meta.url),'utf8');
await import(`data:text/javascript,${encodeURIComponent(source)}`);
const block=crypto.getRandomValues(new Uint8Array(12_000)),original=new Uint8Array(48_000);
for(let offset=0;offset<original.length;offset+=block.length)original.set(block,offset);
const encoded=await globalThis.PO33QRTransfer.encode(original);
assert(encoded.frames.length>1);
assert(encoded.compressedBytes<encoded.rawBytes);
assert(encoded.frames.every(frame=>frame.length<900),'adaptive chunk size should keep QR modules readable on small displays');

const rx=globalThis.PO33QRTransfer.receiver();
let result;
for(const packet of [...encoded.frames].reverse())result=await rx.add(packet);
assert.equal(result.complete,true);
assert.equal(result.filename,'camera.po33frame');
assert.deepEqual(new Uint8Array(result.buffer),original);

const retry=globalThis.PO33QRTransfer.receiver();
const corrupted=encoded.frames[0].slice(0,-1)+(encoded.frames[0].endsWith('A')?'B':'A');
await retry.add(corrupted);
for(const packet of encoded.frames)result=await retry.add(packet);
assert.equal(result.complete,true,'repeated good fragments recover a damaged scan');
assert.deepEqual(new Uint8Array(result.buffer),original);
assert.equal(await retry.add('https://example.test/project.wav'),null);
await assert.rejects(retry.add('PO33Q3.invalid.packet'),/Invalid animated QR packet/);
console.log(`PASS animated QR gzip (${encoded.rawBytes} → ${encoded.compressedBytes} bytes), ${encoded.frames.length} chunks, out-of-order/duplicate recovery and SHA-256 verification`);
