// Family login over HTTP: make a family code, add children with their 3 secret pictures, log in on "another device" with
// the code and the pictures, and play as the same child there with the same cloud save. Run with DATABASE_URL='' to use JSON files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-family-'));
const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, RENDER: 'true' }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
const base = `http://localhost:${port}`;
const results = [];
const ok = (label) => results.push('✓ ' + label);

// `from`: the address the request seems to come from (behind a proxy, as RENDER says), each with its own limit of requests a minute
const api = async (body, from) => (await fetch(`${base}/api/family`, { method: 'POST', body: JSON.stringify(body), headers: from ? { 'x-forwarded-for': from } : {} })).json();
const ticket = () => crypto.randomBytes(32).toString('hex');
/** Joins a room over the WebSocket and resolves with the server's first answer: welcome or error. With `cloud`, it then
 *  sends that cloud save and resolves with the server's `cloud` answer instead. */
function joinRoom(id, t, cloud) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timer = setTimeout(() => rej(new Error('no answer to join')), 5000);
    const done = (m) => { clearTimeout(timer); ws.close(); res(m); };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: 'FAMTEST', id, ticket: t, name: 'Test', look: {}, lvl: 1, x: 10, y: 10, dir: 0 }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome' && cloud) ws.send(JSON.stringify({ t: 'cloud-save', cloud }));
      else if (m.t === 'welcome' || m.t === 'error' || m.t === 'cloud') done(m);
    };
    ws.onerror = () => rej(new Error('socket error'));
  });
}

try {
  const a = { id: 'fam-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  const b = { id: 'fam-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };

  assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 9] })).reason, 'invalid');
  assert.equal((await api({ act: 'create', ...a, name: '', age: 8, avatar: 3, pics: [0, 1, 2] })).reason, 'invalid');
  ok('pictures out of range and empty names are refused');

  const made = await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2] });
  assert.equal(made.ok, true);
  assert.match(made.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const code = made.code, typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
  ok(`a family code is made (${code})`);

  assert.equal((await api({ act: 'join', code, id: a.id, ticket: ticket(), name: 'Other', age: 8, avatar: 0, pics: [1, 1, 1] })).reason, 'identity');
  ok("a device without the child's ticket cannot change that child");

  assert.equal((await api({ act: 'join', code: typed, ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3] })).ok, true);
  assert.equal((await api({ act: 'join', code: 'ZZZZZZZZ', ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3] })).reason, 'no-family');
  ok('a second child joins with the code typed in lower case with a dash; an unknown code is refused');

  const listed = await api({ act: 'members', code });
  assert.deepEqual(listed.members.map((m) => [m.id, m.name, m.age, m.avatar, m.locked]), [[a.id, 'Сараа', 8, 3, false], [b.id, 'Бат', 6, 0, false]]);
  assert.ok(!JSON.stringify(listed).includes('hash') && !JSON.stringify(listed).includes('salt'), 'the list never shows the picture hashes');
  ok('the family lists its children without their pictures');

  // the other device: the right pictures give a new ticket for the same player
  const bLogin = await api({ act: 'login', code: typed, id: b.id, pics: [5, 4, 3] });
  assert.equal(bLogin.ok, true);
  assert.equal(bLogin.id, b.id);
  assert.match(bLogin.ticket, /^[a-f0-9]{64}$/);
  assert.notEqual(bLogin.ticket, b.ticket);
  assert.deepEqual([bLogin.name, bLogin.age, bLogin.avatar, bLogin.code], ['Бат', 6, 0, code]);
  assert.equal((await joinRoom(b.id, bLogin.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, b.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, ticket())).why, 'identity');
  ok('logging in on another device plays as the same child; the first device still works, a random ticket does not');

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

  // the child's own device can set new pictures, which also unlocks
  assert.equal((await api({ act: 'join', code, ...a, name: 'Сараа', age: 9, avatar: 3, pics: [8, 8, 8] })).ok, true);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [0, 1, 2] })).reason, 'wrong');
  const aLogin = await api({ act: 'login', code, id: a.id, pics: [8, 8, 8] });
  assert.deepEqual([aLogin.ok, aLogin.age], [true, 9]);
  ok("new pictures from the child's own device replace the old ones and lift the lock");

  // a grown-up on Бат's device helps Сараа, who forgot her pictures, then they leave the family
  const grownUp = '10.0.0.2';
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: ticket(), id: a.id, pics: [6, 6, 6] }, grownUp)).reason, 'identity');
  const stranger = { id: 'stranger-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  assert.equal((await api({ act: 'pictures', code, by: stranger.id, ticket: stranger.ticket, id: a.id, pics: [6, 6, 6] }, grownUp)).reason, 'identity');
  assert.equal((await api({ act: 'pictures', code, by: b.id, ticket: b.ticket, id: a.id, pics: [6, 6, 6] }, grownUp)).ok, true);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [6, 6, 6] }, grownUp)).ok, true);
  ok("a grown-up on another child's device gives new pictures; a stranger or a wrong ticket cannot");
  assert.deepEqual(await api({ act: 'remove', code, by: b.id, ticket: b.ticket, id: a.id }, grownUp), { ok: true, code, left: 1 });
  assert.deepEqual((await api({ act: 'members', code }, grownUp)).members.map((m) => m.id), [b.id]);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [6, 6, 6] }, grownUp)).reason, 'no-family');
  assert.deepEqual(await api({ act: 'remove', code, by: b.id, ticket: b.ticket, id: b.id }, grownUp), { ok: true, code, left: 0 });
  assert.equal((await api({ act: 'members', code }, grownUp)).reason, 'no-family');
  ok('a child can be taken out of the family; the last one out deletes it');

  assert.equal((await fetch(`${base}/api/family`)).status, 405);
  assert.equal((await api({ act: 'nope' })).reason, 'invalid');
  ok('other methods and actions are refused');

  console.log(results.join('\n'));
  console.log('\nFAMILY LOGIN: PASS');
} catch (error) {
  console.log(results.join('\n'));
  console.error('\nFAMILY LOGIN: FAIL', error);
  process.exitCode = 1;
} finally {
  await new Promise((res) => { server.once('exit', res); server.kill(); });
  rmSync(dataDir, { recursive: true, force: true });
}
