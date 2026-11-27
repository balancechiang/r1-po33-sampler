process.chdir(require('node:path').resolve(__dirname,'..'));
const assert = require('node:assert/strict');
const { SEGMENT_COUNT, segments } = require('../lcd-indicator.js');
const lit = props => segments(props).flatMap((on, i) => on ? [i] : []);
assert.equal(SEGMENT_COUNT, 38);
assert.deepEqual(lit({mode:'pitch',pitch:0}), [18]);
assert.deepEqual(lit({mode:'pitch',pitch:2}), [19,20,21]);
assert.deepEqual(lit({mode:'pitch',pitch:-2}), [16,17,18]);
assert.deepEqual(lit({mode:'pitch',pitch:NaN}), [18]);
assert.equal(lit({mode:'pitch',pitch:12}).length,19);
assert.equal(lit({mode:'pitch',pitch:-12}).length,19);
assert.deepEqual(lit({mode:'trim',start:25,length:50}), Array.from({length:20},(_,i)=>i+9));
assert.equal(lit({mode:'trim',start:0,length:100}).length,38);
assert.deepEqual(lit({mode:'trim',start:25,length:0}), []);
assert.deepEqual(lit({mode:'trim',start:100,length:50}), []);
assert.equal(lit({mode:'trim',start:90,length:100}).at(-1),37);
assert.deepEqual(lit({mode:'level',value:5}), [0,1,2,3,4]);
assert.equal(lit({mode:'level',value:100}).length,38);
assert.deepEqual(lit({mode:'level',value:-10}), []);
assert.deepEqual(lit({mode:'level',value:4,origin:'center'}), [17,18,19,20]);
assert.deepEqual(lit({mode:'level',value:1,origin:'center'}), [18,19]);
assert.deepEqual(lit({mode:'level',value:0,origin:'center'}), []);
for(let value=0;value<=38;value++){
  const states=segments({mode:'level',value,origin:'center'});
  assert(states.every((on,i)=>on===states[37-i]));
  assert.equal(states.filter(Boolean).length,Math.ceil(value/2)*2);
}
assert.throws(()=>segments({mode:'unknown'}), TypeError);
console.log('PASS: 38 states; signed centered pitch across complete -12/+12 half-ranges; neutral and saturation; trim intervals, clipping and empty ranges; proportional level and invalid mode.');

assert.deepEqual(lit({mode:'filter',cutoff:0}),[18]);assert.equal(lit({mode:'filter',cutoff:-100}).length,0);assert.equal(lit({mode:'filter',cutoff:100}).length,0);assert.deepEqual(lit({mode:'filter',cutoff:-50}),Array.from({length:19},(_,i)=>i));assert.deepEqual(lit({mode:'filter',cutoff:50}),Array.from({length:19},(_,i)=>19+i));
