const assert = require('node:assert/strict');
const { SEGMENT_COUNT, segments } = require('./lcd-indicator.js');
const lit = props => segments(props).flatMap((on, i) => on ? [i] : []);
assert.equal(SEGMENT_COUNT, 32);
assert.deepEqual(lit({mode:'pitch',pitch:0}), [15,16]);
assert.deepEqual(lit({mode:'pitch',pitch:2}), [16,17,18,19]);
assert.deepEqual(lit({mode:'pitch',pitch:-2}), [12,13,14,15]);
assert.deepEqual(lit({mode:'pitch',pitch:NaN}), [15,16]);
assert.equal(lit({mode:'pitch',pitch:12}).length,16);
assert.equal(lit({mode:'pitch',pitch:-12}).length,16);
assert.deepEqual(lit({mode:'trim',start:25,length:50}), Array.from({length:16},(_,i)=>i+8));
assert.equal(lit({mode:'trim',start:0,length:100}).length,32);
assert.deepEqual(lit({mode:'trim',start:25,length:0}), []);
assert.deepEqual(lit({mode:'trim',start:100,length:50}), []);
assert.equal(lit({mode:'trim',start:90,length:100}).at(-1),31);
assert.deepEqual(lit({mode:'level',value:5}), [0,1,2,3,4]);
assert.equal(lit({mode:'level',value:100}).length,32);
assert.deepEqual(lit({mode:'level',value:-10}), []);
assert.deepEqual(lit({mode:'level',value:4,origin:'center'}), [14,15,16,17]);
assert.deepEqual(lit({mode:'level',value:1,origin:'center'}), [15,16]);
assert.deepEqual(lit({mode:'level',value:0,origin:'center'}), []);
for(let value=0;value<=32;value++){
  const states=segments({mode:'level',value,origin:'center'});
  assert(states.every((on,i)=>on===states[31-i]));
  assert.equal(states.filter(Boolean).length,Math.ceil(value/2)*2);
}
assert.throws(()=>segments({mode:'unknown'}), TypeError);
console.log('PASS: 32 states; signed centered pitch at 2 cells/semitone; neutral and saturation; trim intervals, clipping and empty ranges; proportional level and invalid mode.');
