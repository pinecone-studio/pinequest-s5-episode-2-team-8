// What a child learns by doing it by hand in Нутаг (shown on the parent dashboard), read from the village save.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const R = createRequire(import.meta.url)('../web/js/village/rules.js');

assert.deepEqual(R.HANDS_ON.map((a) => a.id), ['ger', 'aaruul', 'urum', 'tarag', 'airag', 'emee']);
for (const a of R.HANDS_ON) {
  assert.ok(a.icon && a.name.mn && a.name.en, `${a.id}: needs an icon and a name in both languages`);
  assert.ok(a.learned.length >= 2 && a.learned.every((t) => t.mn && t.en), `${a.id}: needs at least two things learned, in both languages`);
  assert.ok(['ger', 'idee', 'customs'].includes(a.lesson), `${a.id}: needs the lesson whose home activity goes with it`);
}

assert.deepEqual(R.handsOn(null), []);
assert.deepEqual(R.handsOn({}), []);
assert.deepEqual(R.handsOn({ ger: { stage: 4 } }), [], 'a half-built ger is not learned yet');
assert.deepEqual(R.handsOn({ ger: { stage: R.GER_DONE } }), ['ger']);
assert.deepEqual(R.handsOn({ gerBuilt: true, ger: { stage: 0 } }), ['ger'], 'a ger finished before is still learned');
assert.deepEqual(R.handsOn({ seen: { made_tarag: 1, made_airag: 1, sheep: 1 } }), ['tarag', 'airag']);
assert.deepEqual(R.handsOn({ emee: { visits: 0 } }), [], 'starting a visit to Grandma is not finishing it');
assert.deepEqual(R.handsOn({ emee: { visits: 2 } }), ['emee']);
assert.deepEqual(R.handsOn({ gerBuilt: true, seen: { made_aaruul: 1, made_urum: 1, made_tarag: 1, made_airag: 1 }, emee: { visits: 1 } }), R.HANDS_ON.map((a) => a.id));

console.log('Learned by hand: all checks passed.');
