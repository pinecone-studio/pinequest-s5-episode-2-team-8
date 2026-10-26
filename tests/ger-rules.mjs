// Ger rules shared by the browser and server.js: the building order, the parts each step uses,
// Grandpa Craftsman's trades, felt making, and how lots saved before hands-on building are read.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const R = createRequire(import.meta.url)('../js/village/rules.js');
assert.equal(R.GER_STEPS.length, 9); assert.equal(R.GER_DONE, 9);
assert.deepEqual(R.gerTry(0, 'shal', {}), { ok: true });
assert.deepEqual(R.gerTry(0, 'esgii', { esgii: 2 }), { ok: false, why: 'order', next: 'shal' });
assert.deepEqual(R.gerTry(1, 'khana', { khana: 3 }), { ok: false, why: 'parts', missing: { khana: 2 } });
assert.deepEqual(R.gerTry(9, 'tulga', {}), { ok: false, why: 'done' });
assert.deepEqual(R.gerUse({ toono: 1, bagana: 2, uni: 9 }, 'toono'), { toono: 0, bagana: 0, uni: 9 });
assert.deepEqual(R.tradeCost('khana', 'goods'), { wool: 2, aaruul: 2 });
assert.deepEqual(R.tradeCost('uni', 'coins'), { coins: 15 });
assert.equal(R.lotStage(null), 0); assert.equal(R.lotStage({ by: 'u1' }), 9); assert.equal(R.lotStage({ by: 'u1', stage: 4 }), 4); assert.equal(R.lotStage({ by: 'u1', stage: 12 }), 9);
assert.equal(R.unisTilt([0, 2, 0]), false); assert.equal(R.unisTilt([1, 1, 1]), true); assert.equal(R.unisTilt([1, 1]), false);
assert.equal(R.GER_PRICE, undefined); // gers are built by hand now, never bought
const daily = R.dailyQuests('player-test', '2026-10-26');
assert.deepEqual(R.dailyQuests('player-test', '2026-10-26'), daily, 'daily quests are deterministic for a profile and date');
assert.ok(daily.length >= 3 && daily.length <= 4, 'daily assignments contain the standard quests and optional seasonal quest');
assert.equal(new Set(daily.map((quest) => quest.k)).size, daily.length, 'daily assignments do not repeat a quest');
assert.deepEqual(R.dailyQuests('player-test', '2026-02-31'), [], 'invalid dates do not create assignments');
console.log('Ger rules: all checks passed.');
