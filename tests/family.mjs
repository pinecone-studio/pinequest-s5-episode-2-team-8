// Family login over HTTP: make a family code, add children with their 3 secret pictures, log in on "another device" with
// the code and the pictures, and play as the same child there with the same cloud save. The grown-up PIN guards joining,
// new pictures, removing and erasing; a recovery code resets it. Run with DATABASE_URL='' to use JSON files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-family-'));
const unitDir = mkdtempSync(join(tmpdir(), 'naadamy-family-unit-'));
const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, RENDER: 'true' }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
const base = `http://localhost:${port}`;
const results = [];
const ok = (label) => results.push('✓ ' + label);

// `from`: the address the request seems to come from (behind a proxy, as RENDER says), each with its own limit of requests a minute
const api = async (body, from) => (await fetch(`${base}/api/family`, { method: 'POST', body: JSON.stringify(body), headers: from ? { 'x-forwarded-for': from } : {} })).json();
const ticket = () => crypto.randomBytes(32).toString('hex');
const file = (name) => { try { return JSON.parse(readFileSync(join(dataDir, name), 'utf8')); } catch { return {}; } };
const PIN = '1234', RECOVERY = 'ABCDEFGH23';
/** Joins a room over the WebSocket and resolves with the server's first answer: welcome or error. With `cloud`, it then
 *  sends that cloud save and resolves with the server's `cloud` answer instead. */
function joinRoom(id, t, cloud, room = 'FAMTEST') {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timer = setTimeout(() => rej(new Error('no answer to join')), 5000);
    const done = (m) => { clearTimeout(timer); ws.close(); res(m); };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room, id, ticket: t, name: 'Test', look: {}, lvl: 1, x: 10, y: 10, dir: 0 }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome' && cloud) ws.send(JSON.stringify({ t: 'cloud-save', cloud }));
      else if (m.t === 'welcome' || m.t === 'error' || m.t === 'cloud') done(m);
    };
    ws.onerror = () => rej(new Error('socket error'));
  });
}
/** A socket that stays in the room: `next(test)` waits for a message that passes `test`; `closed` resolves when it closes. */
function stay(id, t, room) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`), seen = [], waiting = [];
  const closed = new Promise((res) => { ws.onclose = res; });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); seen.push(m); for (const w of [...waiting]) if (w.test(m)) { waiting.splice(waiting.indexOf(w), 1); w.res(m); } };
  const next = (test) => { const hit = seen.find(test); if (hit) { seen.splice(seen.indexOf(hit), 1); return Promise.resolve(hit); } return new Promise((res, rej) => { waiting.push({ test, res }); setTimeout(() => rej(new Error('no such message')), 5000); }); };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room, id, ticket: t, name: 'Erase', look: {}, lvl: 1, x: 10, y: 10, dir: 0 }));
  return { ws, next, closed, send: (m) => ws.send(JSON.stringify(m)) };
}

/** family.js in this process, with a clock the test moves and a count of scrypt calls: for the PIN locks. */
async function unitTests() {
  const { createRoomStore } = require('../server/room-store.js');
  let t = Date.parse('2026-10-28T00:00:00Z'), hashes = 0, n = 0;
  const scrypt = crypto.scrypt;
  crypto.scrypt = (...args) => { hashes++; return scrypt(...args); };
  try {
    const fam = require('../server/family.js')(createRoomStore({ dataDir: unitDir, databaseUrl: '' }), { now: () => t });
    const call = (body) => new Promise((res) => {
      const req = new EventEmitter(); Object.assign(req, { method: 'POST', headers: {}, socket: { remoteAddress: `10.9.${++n >> 8}.${n & 255}` }, destroy() {} });
      fam.handle(req, { writeHead() {}, end: (text) => res(JSON.parse(text)) });
      req.emit('data', JSON.stringify(body)); req.emit('end');
    });
    const u = { id: 'unit-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
    const { code } = await call({ act: 'create', ...u, name: 'Unit', pics: [1, 2, 3], pin: '4321', recovery: RECOVERY });
    const check = (pin) => call({ act: 'check-pin', code, by: u.id, ticket: u.ticket, pin });
    const lockOut = async () => { for (let left = 4; left >= 1; left--) assert.deepEqual(await check('0000'), { ok: false, reason: 'pin', left }); return check('0000'); };
    assert.deepEqual(await lockOut(), { ok: false, reason: 'pin-locked', wait: 900 });
    const before = hashes;
    assert.equal((await check('4321')).reason, 'pin-locked');
    assert.equal(hashes - before, 0, 'a locked PIN is answered before anything is hashed');
    ok('5 wrong PIN tries lock for 15 minutes; while locked, even the right PIN waits and nothing is hashed');
    t += 901_000;
    assert.deepEqual(await check('4321'), { ok: true });
    assert.deepEqual(await lockOut(), { ok: false, reason: 'pin-locked', wait: 900 });
    t += 901_000;
    assert.deepEqual(await lockOut(), { ok: false, reason: 'pin-locked', wait: 1800 });
    ok('a right PIN takes one lock off the count (15 minutes again); two locks in a row make 30 minutes');
    let wait = 1800;
    for (const minutes of [60, 120, 240, 480, 960, 1440]) { t += wait * 1000 + 1000; wait = (await lockOut()).wait; assert.equal(wait, minutes * 60); }
    ok('each lock doubles, up to a day');
    t += wait * 1000 + 1000;
    assert.deepEqual(await lockOut(), { ok: false, reason: 'pin-locked', wait: 1440 * 60 });
    ok('right after a day-long lock the next one is a day again (the quiet day starts when the lock ends)');
    t += 2 * 86_400_000 + 1000;
    assert.deepEqual(await lockOut(), { ok: false, reason: 'pin-locked', wait: 900 });
    ok('a day without a wrong try after the lock ends forgets the lock count');

    // the recovery code has its own tries and lock: a locked PIN can still be reset
    assert.equal((await check('4321')).reason, 'pin-locked');
    assert.equal((await call({ act: 'recover', code, recovery: RECOVERY, pin: '1111', newRecovery: RECOVERY })).reason, 'invalid');
    assert.deepEqual(await call({ act: 'recover', code, recovery: RECOVERY, pin: '1111', newRecovery: 'ZZZZZZZZZZ' }), { ok: true, code });
    assert.deepEqual(await check('1111'), { ok: true });
    ok('a locked PIN can still be reset with the recovery code (a new code must differ from the old one)');
    const recover = (recovery) => call({ act: 'recover', code, recovery, pin: '2222', newRecovery: 'XXXXXXXXXX' });
    for (let left = 4; left >= 1; left--) assert.deepEqual(await recover('YYYYYYYYYY'), { ok: false, reason: 'recovery', left });
    assert.deepEqual(await recover('YYYYYYYYYY'), { ok: false, reason: 'recovery-locked', wait: 900 });
    assert.equal((await recover('ZZZZZZZZZZ')).reason, 'recovery-locked');
    assert.deepEqual(await check('1111'), { ok: true });
    ok('wrong recovery codes lock only the recovery code, not the PIN');

    // a stranger with the code trying to join: their wrong PINs lock joining, not the grown-up's PIN
    const stranger = { id: 'unit-x-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
    const join = (pin) => call({ act: 'join', code, ...stranger, name: 'X', pics: [1, 1, 1], pin });
    for (let left = 4; left >= 1; left--) assert.deepEqual(await join('9999'), { ok: false, reason: 'pin', left });
    assert.deepEqual(await join('9999'), { ok: false, reason: 'join-locked', wait: 900 });
    assert.equal((await join('1111')).reason, 'join-locked');
    assert.deepEqual(await check('1111'), { ok: true });
    assert.equal((await call({ act: 'pictures', code, by: u.id, ticket: u.ticket, id: u.id, pics: [2, 2, 2], pin: '1111' })).ok, true);
    ok("wrong PINs from joining lock only joining: the grown-up's PIN still works for check-pin and pictures");
  } finally {
    crypto.scrypt = scrypt;
  }
}

try {
  const a = { id: 'fam-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  const b = { id: 'fam-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };

  assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 9], pin: PIN, recovery: RECOVERY })).reason, 'invalid');
  assert.equal((await api({ act: 'create', ...a, name: '', age: 8, avatar: 3, pics: [0, 1, 2], pin: PIN, recovery: RECOVERY })).reason, 'invalid');
  ok('pictures out of range and empty names are refused');
  const badPin = '10.0.0.9';
  for (const pin of [undefined, '', '123', '1234567', '12a4', 1234]) {
    assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2], pin, recovery: RECOVERY }, badPin)).reason, 'invalid');
  }
  assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2], pin: PIN }, badPin)).reason, 'invalid');
  assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2], pin: PIN, recovery: 'ABCDEFGHI1' }, badPin)).reason, 'invalid');
  ok('a family needs a PIN of 4-6 digits and a 10-letter recovery code');

  const made = await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2], pin: PIN, recovery: RECOVERY.toLowerCase() });
  assert.equal(made.ok, true);
  assert.match(made.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const code = made.code, typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
  const stored = file('families.json')[code];
  assert.match(stored.pinHash, /^[a-f0-9]{64}$/); assert.match(stored.recoveryHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(stored).includes(PIN) && !JSON.stringify(stored).includes(RECOVERY), 'the PIN and recovery code are kept only as hashes');
  ok(`a family code is made (${code}), with the PIN and recovery code stored as hashes`);

  assert.equal((await api({ act: 'join', code, id: a.id, ticket: ticket(), name: 'Other', age: 8, avatar: 0, pics: [1, 1, 1] })).reason, 'identity');
  ok("a device without the child's ticket cannot change that child");

  const joinB = (extra) => api({ act: 'join', code: typed, ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3], ...extra });
  assert.deepEqual(await joinB({}), { ok: false, reason: 'pin', left: 5 });
  assert.deepEqual(await joinB({ pin: '9999' }), { ok: false, reason: 'pin', left: 4 });
  assert.equal((await joinB({ pin: PIN })).ok, true);
  assert.equal((await api({ act: 'join', code: 'ZZZZZZZZ', ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3], pin: PIN })).reason, 'no-family');
  ok('joining needs the PIN (none or a wrong one is refused); a second child joins with the code typed in lower case with a dash; an unknown code is refused');

  const listed = await api({ act: 'members', code });
  assert.deepEqual(listed.members.map((m) => [m.id, m.name, m.age, m.avatar, m.locked]), [[a.id, 'Сараа', 8, 3, false], [b.id, 'Бат', 6, 0, false]]);
  assert.equal(listed.needsPin, false);
  assert.ok(!/hash|salt|pin[A-Z]|recovery/.test(JSON.stringify(listed)), 'the list never shows the picture or PIN hashes');
  ok('the family lists its children without their pictures or the PIN');

  // the other device: the right pictures give a new ticket for the same player
  const bLogin = await api({ act: 'login', code: typed, id: b.id, pics: [5, 4, 3] });
  assert.equal(bLogin.ok, true);
  assert.equal(bLogin.id, b.id);
  assert.match(bLogin.ticket, /^[a-f0-9]{64}$/);
  assert.notEqual(bLogin.ticket, b.ticket);
  assert.deepEqual([bLogin.name, bLogin.age, bLogin.avatar, bLogin.code, bLogin.needsPin], ['Бат', 6, 0, code, false]);
  assert.equal((await joinRoom(b.id, bLogin.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, b.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, ticket())).why, 'identity');
  ok('logging in (no PIN) on another device plays as the same child; the first device still works, a random ticket does not');

  // the cloud save: each device adds what it earned, nothing is lost, and the newest character choice wins
  const first = await joinRoom(b.id, b.ticket, { eth: 'khalkh', aimag: 'tuv', charAt: 1000, learn: { ger: { done: true, best: 3, family: 2000 } },
    ach: { character: 3000 }, stamps: { tuv: 4000 }, bichig: { a: 2 }, bichigMem: { a: 1 }, hist: 2, story: { ch1: 2 } });
  assert.deepEqual([first.cloud.eth, first.cloud.stamps, first.cloud.hist], ['khalkh', { tuv: 4000 }, 2]);
  const second = await joinRoom(b.id, bLogin.ticket, { eth: 'oold', aimag: 'khovd', charAt: 900, learn: { ger: { done: false, best: 1, family: 0 } },
    stamps: { uvs: 5000, tuv: 4500 }, hist: 1, story: { ch1: 1, 'ch2:done': 1, ch2: 3 } });
  assert.deepEqual([second.cloud.eth, second.cloud.aimag, second.cloud.learn.ger, second.cloud.stamps, second.cloud.ach, second.cloud.hist, second.cloud.story],
    ['khalkh', 'tuv', { done: true, best: 3, family: 2000 }, { tuv: 4000, uvs: 5000 }, { character: 3000 }, 2, { ch1: 2, 'ch2:done': 1 }]);
  const again = await api({ act: 'login', code, id: b.id, pics: [5, 4, 3] });
  assert.deepEqual(again.cloud, second.cloud);
  ok('the cloud save from either device is merged and comes along with the next login');

  for (let left = 4; left >= 1; left--) {
    const wrong = await api({ act: 'login', code, id: a.id, pics: [2, 1, 0] });
    assert.deepEqual([wrong.ok, wrong.reason, wrong.left], [false, 'wrong', left]);
  }
  const locked = await api({ act: 'login', code, id: a.id, pics: [2, 1, 0] });
  assert.deepEqual([locked.reason, locked.wait], ['locked', 900]);
  const stillLocked = await api({ act: 'login', code, id: a.id, pics: [0, 1, 2] });
  assert.equal(stillLocked.reason, 'locked');
  assert.ok(stillLocked.wait > 0 && stillLocked.wait <= 900);
  assert.equal((await api({ act: 'members', code })).members.find((m) => m.id === a.id).locked, true);
  ok('5 wrong tries lock the child for 15 minutes, even with the right pictures after');

  // the child's own device can set new pictures, which also unlocks, with no PIN
  const grownUp = '10.0.0.2';
  assert.equal((await api({ act: 'join', code, ...a, name: 'Сараа', age: 9, avatar: 3, pics: [8, 8, 8] }, grownUp)).ok, true);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [0, 1, 2] }, grownUp)).reason, 'wrong');
  const aLogin = await api({ act: 'login', code, id: a.id, pics: [8, 8, 8] }, grownUp);
  assert.deepEqual([aLogin.ok, aLogin.age], [true, 9]);
  ok("new pictures from the child's own device replace the old ones and lift the lock, without the PIN");

  // a grown-up on Бат's device helps Сараа, who forgot her pictures
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: ticket(), id: a.id, pics: [6, 6, 6], pin: PIN }, grownUp)).reason, 'identity');
  const stranger = { id: 'stranger-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  assert.equal((await api({ act: 'pictures', code, by: stranger.id, ticket: stranger.ticket, id: a.id, pics: [6, 6, 6], pin: PIN }, grownUp)).reason, 'identity');
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: b.ticket, id: a.id, pics: [6, 6, 6] }, grownUp)).reason, 'pin');
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: b.ticket, id: a.id, pics: [6, 6, 6], pin: '0000' }, grownUp)).reason, 'pin');
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: b.ticket, id: a.id, pics: [6, 6, 6], pin: PIN }, grownUp)).ok, true);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [6, 6, 6] }, grownUp)).ok, true);
  ok("a grown-up on another child's device gives new pictures with the PIN; without it, or as a stranger or with a wrong ticket, they cannot");

  // the PIN: checked, changed, and reset with the recovery code
  const other = '10.0.0.3';
  assert.deepEqual(await api({ act: 'check-pin', code, by: b.id, ticket: b.ticket, pin: PIN }, other), { ok: true });
  assert.deepEqual(await api({ act: 'check-pin', code, by: b.id, ticket: b.ticket, pin: '0000' }, other), { ok: false, reason: 'pin', left: 4 });
  assert.equal((await api({ act: 'check-pin', code, by: stranger.id, ticket: stranger.ticket, pin: PIN }, other)).reason, 'identity');
  ok('check-pin answers whether the PIN is right, only to a device of the family');
  assert.equal((await api({ act: 'pin', code, by: b.id, ticket: b.ticket, pin: '5555', old: '0000' }, other)).reason, 'pin');
  assert.equal((await api({ act: 'pin', code, by: b.id, ticket: b.ticket, pin: '55', old: PIN }, other)).reason, 'invalid');
  assert.deepEqual(await api({ act: 'pin', code, by: b.id, ticket: b.ticket, pin: '5555', old: PIN }, other), { ok: true, code });
  assert.equal((await api({ act: 'check-pin', code, by: b.id, ticket: b.ticket, pin: PIN }, other)).reason, 'pin');
  assert.deepEqual(await api({ act: 'check-pin', code, by: b.id, ticket: b.ticket, pin: '5555' }, other), { ok: true });
  assert.equal(file('families.json')[code].recoveryHash, stored.recoveryHash, 'a PIN change keeps the recovery code');
  ok("act 'pin' changes the PIN with the old one; the old PIN stops working");
  const recover = (recovery, pin, newRecovery) => api({ act: 'recover', code, recovery, pin, newRecovery }, other);
  assert.equal((await recover('YYYYYYYYYY', '7777', 'NEWCQDE234')).reason, 'recovery');
  assert.equal((await recover(RECOVERY, '7777', 'bad')).reason, 'invalid');
  assert.deepEqual(await recover(`${RECOVERY.slice(0, 5)}-${RECOVERY.slice(5)}`, '7777', 'NEWCQDE234'), { ok: true, code });
  assert.equal((await recover(RECOVERY, '8888', 'NEWCQDE567')).reason, 'recovery');
  assert.deepEqual(await api({ act: 'check-pin', code, by: b.id, ticket: b.ticket, pin: '7777' }, other), { ok: true });
  assert.notEqual(file('families.json')[code].recoveryHash, stored.recoveryHash);
  ok('the recovery code sets a new PIN with no ticket and works once; a wrong one is refused');
  const NEWPIN = '7777';

  assert.equal((await api({ act: 'remove', code, by: b.id, ticket: b.ticket, id: a.id }, grownUp)).reason, 'pin');
  assert.deepEqual(await api({ act: 'remove', code, by: b.id, ticket: b.ticket, id: a.id, pin: NEWPIN }, grownUp), { ok: true, code, left: 1 });
  assert.deepEqual((await api({ act: 'members', code }, grownUp)).members.map((m) => m.id), [b.id]);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [6, 6, 6] }, grownUp)).reason, 'no-family');
  assert.deepEqual(await api({ act: 'remove', code, by: b.id, ticket: b.ticket, id: b.id, pin: NEWPIN }, grownUp), { ok: true, code, left: 0 });
  assert.equal((await api({ act: 'members', code }, grownUp)).reason, 'no-family');
  ok('taking a child out needs the PIN (the recovered one works); the last one out deletes the family');

  // a family made before the PIN: it keeps working with the code only and asks for a PIN
  const old = { a: { id: 'old-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() }, b: { id: 'old-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() } };
  const legacy = '10.0.0.4';
  const oldCode = (await api({ act: 'create', ...old.a, name: 'Old', pics: [1, 1, 1], pin: PIN, recovery: RECOVERY }, legacy)).code;
  const families = file('families.json');
  families[oldCode] = { members: families[oldCode].members };
  writeFileSync(join(dataDir, 'families.json'), JSON.stringify(families));
  assert.equal((await api({ act: 'members', code: oldCode }, legacy)).needsPin, true);
  assert.equal((await api({ act: 'join', code: oldCode, ...old.b, name: 'Old B', pics: [2, 2, 2] }, legacy)).ok, true);
  assert.equal((await api({ act: 'login', code: oldCode, id: old.b.id, pics: [2, 2, 2] }, legacy)).needsPin, true);
  assert.equal((await api({ act: 'pictures', code: oldCode, by: old.b.id, ticket: old.b.ticket, id: old.a.id, pics: [3, 3, 3] }, legacy)).reason, 'needs-pin');
  assert.equal((await api({ act: 'remove', code: oldCode, by: old.b.id, ticket: old.b.ticket, id: old.a.id }, legacy)).reason, 'needs-pin');
  assert.equal((await api({ act: 'login', code: oldCode, id: old.a.id, pics: [1, 1, 1] }, legacy)).ok, true, "the oldest child's pictures were not reset");
  assert.equal((await api({ act: 'erase', code: oldCode, by: old.a.id, ticket: old.a.ticket, pin: PIN, confirm: oldCode }, legacy)).reason, 'needs-pin');
  assert.equal((await api({ act: 'pin', code: oldCode, by: old.b.id, ticket: old.b.ticket, pin: PIN, recovery: RECOVERY }, legacy)).reason, 'not-first');
  assert.equal((await api({ act: 'pin', code: oldCode, by: old.a.id, ticket: old.a.ticket, pin: PIN }, legacy)).reason, 'invalid');
  assert.deepEqual(await api({ act: 'pin', code: oldCode, by: old.a.id, ticket: old.a.ticket, pin: PIN, recovery: RECOVERY }, legacy), { ok: true, code: oldCode });
  assert.match(file('families.json')[oldCode].recoveryHash, /^[a-f0-9]{64}$/);
  assert.equal((await api({ act: 'members', code: oldCode }, legacy)).needsPin, false);
  assert.equal((await api({ act: 'pictures', code: oldCode, by: old.b.id, ticket: old.b.ticket, id: old.a.id, pics: [4, 4, 4] }, legacy)).reason, 'pin');
  const soon = await api({ act: 'erase', code: oldCode, by: old.a.id, ticket: old.a.ticket, pin: PIN, confirm: oldCode }, legacy);
  assert.equal(soon.reason, 'too-soon');
  assert.ok(soon.wait > 3 * 86400 - 60 && soon.wait <= 3 * 86400);
  assert.equal((await api({ act: 'members', code: oldCode }, legacy)).members.length, 2, 'too soon: nothing is erased');
  ok('a family without a PIN: joining works with the code only, pictures and remove need a PIN first; only its oldest child sets it, with a recovery code; it can be erased only 3 days later');

  // erasing everything: two children, each in a room with a ger and a chat line
  const e1 = { id: 'erase-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() }, e2 = { id: 'erase-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  const eraser = '10.0.0.5';
  const eCode = (await api({ act: 'create', ...e1, name: 'E1', pics: [1, 2, 3], pin: PIN, recovery: RECOVERY }, eraser)).code;
  assert.equal((await api({ act: 'join', code: eCode, ...e2, name: 'E2', pics: [3, 2, 1], pin: PIN }, eraser)).ok, true);
  const e2Login = await api({ act: 'login', code: eCode, id: e2.id, pics: [3, 2, 1] }, eraser);
  const s1 = stay(e1.id, e1.ticket, 'ERASE1'), s2 = stay(e2.id, e2Login.ticket, 'ERASE1');
  await s1.next((m) => m.t === 'welcome'); await s2.next((m) => m.t === 'welcome');
  s1.send({ t: 'ger-claim', i: 0, roof: 'blue', door: 'red' }); s2.send({ t: 'ger-claim', i: 1, roof: 'blue', door: 'red' });
  await s1.next((m) => m.t === 'lot' && m.by === e1.id); await s1.next((m) => m.t === 'lot' && m.by === e2.id);
  s1.send({ t: 'say', k: 'p', i: 0 }); await s1.next((m) => m.t === 'say');
  const erase = (extra) => api({ act: 'erase', code: eCode, by: e1.id, ticket: e1.ticket, pin: PIN, confirm: eCode.toLowerCase(), ...extra }, eraser);
  assert.equal((await erase({ confirm: undefined })).reason, 'confirm');
  assert.equal((await erase({ confirm: 'ZZZZZZZZ' })).reason, 'confirm');
  assert.equal((await erase({ ticket: undefined })).reason, 'invalid');
  assert.equal((await erase({ ticket: ticket() })).reason, 'identity');
  assert.equal((await erase({ pin: undefined })).reason, 'pin');
  assert.equal((await erase({ pin: '0000' })).reason, 'pin');
  assert.equal((await erase({ by: stranger.id, ticket: stranger.ticket })).reason, 'identity');
  assert.ok(file('identities.json')[e1.id], 'nothing is erased by a refused request');
  ok('erasing needs the family code typed again, a child\'s ticket and the PIN');
  assert.deepEqual(await erase({}), { ok: true, erased: 2 });
  assert.equal((await s1.next((m) => m.t === 'error')).why, 'erased');
  await Promise.all([s1.closed, s2.closed]);
  ok('erasing closes the live connections of every child in the family');
  for (const name of ['identities.json', 'wallets.json', 'progress.json', 'device-tickets.json']) {
    const records = file(name);
    assert.ok(!records[e1.id] && !records[e2.id], `${name} keeps nothing of the family`);
  }
  assert.equal(file('families.json')[eCode], undefined);
  assert.equal((await api({ act: 'members', code: eCode }, eraser)).reason, 'no-family');
  assert.equal((await api({ act: 'login', code: eCode, id: e2.id, pics: [3, 2, 1] }, eraser)).reason, 'no-family');
  assert.equal((await erase({})).reason, 'no-family');
  assert.equal(file('identities.json')[e1.id], undefined, 'asking again does not register the erased child anew');
  assert.equal((await api({ act: 'check-pin', code: eCode, by: e1.id, ticket: e1.ticket, pin: PIN }, eraser)).reason, 'no-family');
  assert.equal((await api({ act: 'pin', code: eCode, by: e1.id, ticket: e1.ticket, pin: '4444', old: PIN }, eraser)).reason, 'no-family');
  assert.equal((await joinRoom(e1.id, e1.ticket)).why, 'erased');
  assert.equal((await joinRoom(e2.id, ticket())).why, 'erased');
  assert.equal((await api({ act: 'create', ...e1, name: 'E1', pics: [1, 2, 3], pin: PIN, recovery: RECOVERY }, eraser)).reason, 'erased');
  assert.equal((await joinRoom(b.id, ticket())).why, 'identity', 'a wrong ticket of a child who was not erased is still just identity');
  assert.ok(!file('identities.json')[e1.id] && !file('identities.json')[e2.id] && file('erased.json')[e1.id], 'erased ids are remembered and not taken again');
  ok("an old device of an erased child cannot bring it back: check-pin and pin find no family, the room hello and create answer 'erased'");
  const watcher = await joinRoom('erase-watch-' + crypto.randomBytes(3).toString('hex'), ticket(), null, 'ERASE1');
  assert.ok(!watcher.lots.some((lot) => lot && (lot.by === e1.id || lot.by === e2.id)), 'their gers are gone');
  assert.ok(!watcher.chat.some((line) => line.id === e1.id || line.id === e2.id), 'their chat lines are gone');
  await new Promise((res) => setTimeout(res, 5500)); // the server's periodic save must not write them back
  const savedRoom = file('rooms.json').ERASE1;
  assert.ok(!savedRoom.lots.some((lot) => lot && (lot.by === e1.id || lot.by === e2.id)) && !savedRoom.chat.some((line) => line.id === e1.id || line.id === e2.id));
  ok('erasing removes every child\'s account, tickets, cloud save, gers and chat lines; login and members fail; a second erase finds no family');

  assert.equal((await fetch(`${base}/api/family`)).status, 405);
  assert.equal((await api({ act: 'nope' })).reason, 'invalid');
  ok('other methods and actions are refused');

  await unitTests();

  console.log(results.join('\n'));
  console.log('\nFAMILY LOGIN: PASS');
} catch (error) {
  console.log(results.join('\n'));
  console.error('\nFAMILY LOGIN: FAIL', error);
  process.exitCode = 1;
} finally {
  await new Promise((res) => { server.once('exit', res); server.kill(); });
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(unitDir, { recursive: true, force: true });
}
