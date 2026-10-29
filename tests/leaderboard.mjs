// XP leaderboards: ranking, privacy (no ids, no erased children), the 30 s cache, the PostgreSQL queries and the WebSocket `board`.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import roomStoreModule from '../server/room-store.js';
import createLeaderboard from '../server/leaderboard.js';

const { createRoomStore } = roomStoreModule;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [];
const tempDir = () => { const dir = mkdtempSync(join(tmpdir(), 'naadamy-board-')); dirs.push(dir); return dir; };
const op = () => randomBytes(16).toString('hex');
const silence = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const ROOM_KEYS = ['look', 'me', 'name', 'rank', 'xp'], FAMILY_KEYS = ['avatar', 'me', 'name', 'rank', 'xp'];
const onlyKeys = (rows, keys) => rows.forEach((row) => assert.ok(Object.keys(row).every((key) => keys.includes(key)), `unexpected field in ${JSON.stringify(row)}`));

try {
  // ---- JSON store: room board = top 10 and me, equal XP equal rank, erased children never shown
  {
    const dataDir = tempDir(), store = createRoomStore({ dataDir, databaseUrl: '' });
    const setXp = (id, xp) => store.mutateWallet(id, op(), (wallet) => ({ changed: true, wallet: { ...wallet, xp }, result: { accepted: true } }));
    for (let i = 1; i <= 13; i++) {
      const id = `kid-${String(i).padStart(2, '0')}`;
      await store.getAccount(id, { coins: 40, xp: 0 }, { owned: ['deel-blue'], rod: 1 });
      await setXp(id, i === 13 ? 1 : 1000 - i * 10);
      await store.noteRoomPlayer('NUTAG', { id, name: `Kid ${i}`, look: { deel: 'blue' } });
    }
    await setXp('kid-03', 980); // ties kid-02 at 980
    await store.noteRoomPlayer('OTHER', { id: 'kid-01', name: 'Kid 1', look: {} });
    const board = await store.roomBoard('NUTAG', 'kid-13');
    assert.equal(board.length, 11, 'top 10 and me');
    assert.deepEqual(board.slice(0, 4).map((row) => [row.rank, row.name, row.xp]), [[1, 'Kid 1', 990], [2, 'Kid 2', 980], [2, 'Kid 3', 980], [4, 'Kid 4', 960]]);
    assert.deepEqual(board.at(-1), { rank: 13, name: 'Kid 13', look: { deel: 'blue' }, xp: 1, me: true });
    onlyKeys(board, ROOM_KEYS);
    assert.ok(!JSON.stringify(board).includes('kid-'), 'no player ids');
    assert.equal((await store.roomBoard('NUTAG', 'kid-02')).length, 10, 'me inside the top 10: no extra row');
    assert.equal((await store.roomBoard('NUTAG', 'kid-02')).filter((row) => row.me).length, 1);
    assert.deepEqual((await store.roomBoard('OTHER', 'kid-01')).map((row) => row.name), ['Kid 1'], 'per room');
    assert.deepEqual(await store.roomBoard('EMPTY', 'kid-01'), []);
    // a stale entry (over 30 days) drops out; a player with no wallet is not shown
    const seen = JSON.parse(readFileSync(join(dataDir, 'room-players.json'), 'utf8'));
    seen.NUTAG['kid-12'].at = Date.now() - 31 * 24 * 3600 * 1000;
    seen.NUTAG['ghost-1'] = { name: 'Ghost', look: {}, at: Date.now() };
    writeFileSync(join(dataDir, 'room-players.json'), JSON.stringify(seen));
    assert.ok(!(await store.roomBoard('NUTAG', 'kid-13')).some((row) => row.name === 'Kid 12' || row.name === 'Ghost'));
    seen.OTHER['kid-01'].at = 0; writeFileSync(join(dataDir, 'room-players.json'), JSON.stringify(seen));
    await store.noteRoomPlayer('NUTAG', { id: 'kid-13', name: 'Kid 13', look: { deel: 'blue' } });
    const pruned = JSON.parse(readFileSync(join(dataDir, 'room-players.json'), 'utf8'));
    assert.ok(!pruned.NUTAG['kid-12'] && !('OTHER' in pruned), 'stale players and empty rooms are forgotten');
    await store.noteRoomPlayer('OTHER', { id: 'kid-01', name: 'Kid 1', look: {} });

    // family board: only the family's children; erased ones never appear
    const member = (id, name, avatar) => ({ id, name, age: 8, avatar, salt: '00'.repeat(16), hash: '00'.repeat(32), fails: 0, until: 0 });
    assert.equal(await store.createFamily('ABCD2345', member('kid-01', 'Kid 1', 3)), true);
    await store.mutateFamily('ABCD2345', (family) => { family.members.push(member('kid-05', 'Kid 5', 7), member('new-kid', 'New', 1)); return { changed: true, result: null }; });
    const family = await store.familyBoard('kid-05');
    assert.deepEqual(family, [
      { rank: 1, name: 'Kid 1', avatar: 3, xp: 990 },
      { rank: 2, name: 'Kid 5', avatar: 7, xp: 950, me: true },
      { rank: 3, name: 'New', avatar: 1, xp: 0 }, // never joined: no wallet yet
    ]);
    onlyKeys(family, FAMILY_KEYS);
    assert.equal(await store.familyBoard('kid-02'), null, 'not in a family');
    writeFileSync(join(dataDir, 'erased.json'), JSON.stringify({ 'kid-05': Date.now(), 'kid-04': Date.now() }));
    assert.deepEqual((await store.familyBoard('kid-01')).map((row) => row.name), ['Kid 1', 'New']);
    assert.ok(!(await store.roomBoard('NUTAG', 'kid-01')).some((row) => row.name === 'Kid 4' || row.name === 'Kid 5'));
    // erasing a family forgets its children's room entries too
    await store.eraseFamily('ABCD2345', () => ({ erase: true, result: { ok: true } }));
    const after = JSON.parse(readFileSync(join(dataDir, 'room-players.json'), 'utf8'));
    assert.ok(!after.NUTAG['kid-01'] && !after.OTHER['kid-01'] && after.NUTAG['kid-02']);
    console.log('Leaderboard JSON store: ok');
  }

  // ---- leaderboard.js: answers are kept 30 s, failures are not, unknown kinds are refused
  {
    let t = 0, calls = 0, fail = false;
    const store = {
      async roomBoard(room, id) { calls++; if (fail) throw new Error('down'); return [{ rank: 1, name: room + id, look: {}, xp: 5, me: true }]; },
      async familyBoard(id) { calls++; return id === 'lonely' ? null : [{ rank: 1, name: 'A', avatar: 0, xp: 1, me: true }]; },
    };
    const board = createLeaderboard(store, { now: () => t });
    assert.deepEqual(await board.reply('kid-1', 'NUTAG', 'room'), { t: 'board', k: 'room', rows: [{ rank: 1, name: 'NUTAGkid-1', look: {}, xp: 5, me: true }] });
    await Promise.all([board.reply('kid-1', 'NUTAG', 'room'), board.reply('kid-1', 'NUTAG', 'room')]);
    assert.equal(calls, 1, 'cached');
    await board.reply('kid-2', 'NUTAG', 'room');
    assert.equal(calls, 2, 'per player');
    t = 30_000; await board.reply('kid-1', 'NUTAG', 'room');
    assert.equal(calls, 3, 'expires after 30 s');
    board.clear(); await board.reply('kid-1', 'NUTAG', 'room');
    assert.equal(calls, 4, 'clear() forgets');
    fail = true; t = 70_000;
    assert.deepEqual(await silence(() => board.reply('kid-1', 'NUTAG', 'room')), { t: 'board', k: 'room', rows: [], reason: 'storage' });
    fail = false; await board.reply('kid-1', 'NUTAG', 'room');
    assert.equal(calls, 6, 'a failure is not kept');
    assert.deepEqual(await board.reply('lonely', 'NUTAG', 'family'), { t: 'board', k: 'family', rows: [], reason: 'no-family' });
    assert.equal((await board.reply('kid-1', 'NUTAG', 'family')).rows.length, 1);
    const before = calls; await board.reply('kid-1', 'NUTAG', 'family'); board.forget(['kid-1']); await board.reply('kid-1', 'NUTAG', 'family');
    assert.equal(calls, before + 1, 'forget() drops the family answer');
    assert.equal((await board.reply('kid-1', 'NUTAG', 'nope')).reason, 'invalid');
    console.log('Leaderboard cache: ok');
  }

  // ---- PostgreSQL: one query per board, erased children filtered in SQL, bigint strings become numbers
  {
    const queries = [];
    let answer = { rows: [] };
    const pool = { on() {}, async query(sql, values) { queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values }); return answer; }, async end() {} };
    const store = createRoomStore({ dataDir: tempDir(), databaseUrl: 'postgres://test', Pool: class { constructor() { return pool; } } });
    await store.noteRoomPlayer('NUTAG', { id: 'kid-1', name: 'Kid', look: { deel: 'red' } });
    assert.match(queries[0].sql, /^INSERT INTO naadamy_room_players .* ON CONFLICT \(room_code, player_id\) DO UPDATE/);
    assert.deepEqual(queries[0].values, ['NUTAG', 'kid-1', 'Kid', '{"deel":"red"}']);
    await store.noteRoomPlayer('bad code!', { id: 'kid-1', name: 'Kid', look: {} });
    assert.equal(queries.length, 1, 'a bad room code is not stored');

    answer = { rows: [{ name: 'A', look: {}, xp: '900', place: '1', me: false }, { name: 'Me', look: { deel: 'blue' }, xp: '3', place: '42', me: true }] };
    assert.deepEqual(await store.roomBoard('NUTAG', 'kid-1'), [{ rank: 1, name: 'A', look: {}, xp: 900 }, { rank: 42, name: 'Me', look: { deel: 'blue' }, xp: 3, me: true }]);
    assert.equal(queries.length, 2, 'one query for the room board');
    const room = queries[1];
    assert.deepEqual(room.values, ['NUTAG', 'kid-1']);
    assert.match(room.sql, /FROM naadamy_room_players r JOIN naadamy_wallets w ON w\.id = r\.player_id/);
    assert.match(room.sql, /NOT EXISTS \(SELECT 1 FROM naadamy_erased e WHERE e\.id = r\.player_id AND e\.erased_at > now\(\) - interval '30 days'\)/);
    assert.match(room.sql, /WHERE n <= 10 OR me ORDER BY n$/);
    assert.match(room.sql, /^SELECT name, look, xp, place, me FROM/, 'selects no ids');

    answer = { rows: [{ name: 'Big', avatar: 4, xp: '50', place: '1', me: true }, { name: 'Small', avatar: 2, xp: 0, place: '2', me: false }] };
    assert.deepEqual(await store.familyBoard('kid-1'), [{ rank: 1, name: 'Big', avatar: 4, xp: 50, me: true }, { rank: 2, name: 'Small', avatar: 2, xp: 0 }]);
    assert.equal(queries.length, 3, 'one query for the family board');
    const fam = queries[2];
    assert.deepEqual(fam.values, ['kid-1']);
    assert.match(fam.sql, /WHERE members @> jsonb_build_array\(jsonb_build_object\('id', \$1::text\)\)/);
    assert.match(fam.sql, /NOT EXISTS \(SELECT 1 FROM naadamy_erased e WHERE e\.id = m->>'id'/);
    assert.match(fam.sql, /^SELECT m->>'name' AS name, m->'avatar' AS avatar, COALESCE\(w\.xp, 0\) AS xp, m->>'id' = \$1 AS me,/, 'selects no ids or codes');
    answer = { rows: [] };
    assert.equal(await store.familyBoard('kid-1'), null, 'no family');

    // load() creates the table idempotently; erasing a family deletes its children's room entries
    const statements = [];
    const client = { async query(sql) { statements.push(sql.replace(/\s+/g, ' ').trim()); return { rows: /SELECT members, pin/.test(sql) ? [{ members: [{ id: 'kid-1' }], pin: {} }] : [] }; }, release() {} };
    const store2 = createRoomStore({ dataDir: tempDir(), databaseUrl: 'postgres://test', Pool: class { constructor() { return { on() {}, connect: async () => client, query: client.query, end: async () => {} }; } } });
    await store2.load();
    assert.ok(statements.some((sql) => /^CREATE TABLE IF NOT EXISTS naadamy_room_players \(/.test(sql)));
    assert.ok(statements.includes('ALTER TABLE naadamy_room_players ENABLE ROW LEVEL SECURITY'));
    assert.ok(statements.includes("DELETE FROM naadamy_room_players WHERE seen_at < now() - interval '30 days'"), 'pruned at start');
    await store2.eraseFamily('ABCD2345', () => ({ erase: true, result: { ok: true } }));
    assert.ok(statements.includes('DELETE FROM naadamy_room_players WHERE player_id = ANY($1::text[])'));
    console.log('Leaderboard PostgreSQL queries: ok');
  }

  // ---- the server: `board` over the WebSocket, JSON store
  {
    const dataDir = tempDir();
    const server = spawn(process.execPath, [join(root, 'server', 'server.js')], {
      env: { ...process.env, PORT: '0', DATA_DIR: dataDir, DATABASE_URL: '' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    try {
      const port = await new Promise((done, reject) => {
        const timer = setTimeout(() => reject(new Error('server did not start')), 8000);
        server.on('message', (message) => { if (message.port) { clearTimeout(timer); done(message.port); } });
        server.once('exit', (code) => reject(new Error(`server exited (${code})`)));
      });
      const connect = async (id, name) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`), inbox = [], waiters = [];
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);
          const i = waiters.findIndex((w) => w.t === message.t);
          if (i >= 0) waiters.splice(i, 1)[0].done(message); else inbox.push(message);
        });
        const next = (t) => new Promise((done, reject) => {
          const i = inbox.findIndex((m) => m.t === t);
          if (i >= 0) return done(inbox.splice(i, 1)[0]);
          const timer = setTimeout(() => reject(new Error(`no ${t}`)), 5000);
          waiters.push({ t, done: (m) => { clearTimeout(timer); done(m); } });
        });
        await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        const ticket = randomBytes(32).toString('hex');
        socket.send(JSON.stringify({ t: 'join', room: 'BOARD1', id, ticket, name, look: {} }));
        await next('welcome');
        return { socket, next, ticket, send: (m) => socket.send(JSON.stringify(m)) };
      };
      const a = await connect('board-aa', 'Ану'), b = await connect('board-bb', 'Бат');
      a.send({ t: 'sync', op: op(), coins: 0, xp: 120, owned: [] });
      assert.equal((await a.next('sync-result')).accepted, true);
      b.send({ t: 'board', k: 'room' });
      const room = await b.next('board');
      assert.equal(room.k, 'room');
      assert.deepEqual(room.rows.map((row) => [row.rank, row.name, row.xp, Boolean(row.me)]), [[1, 'Ану', 120, false], [2, 'Бат', 0, true]]);
      onlyKeys(room.rows, ROOM_KEYS);
      assert.ok(!JSON.stringify(room).includes('board-'), 'no player ids on the wire');
      b.send({ t: 'board', k: 'family' });
      assert.deepEqual(await b.next('board'), { t: 'board', k: 'family', rows: [], reason: 'no-family' });

      const post = async (body) => (await fetch(`http://127.0.0.1:${port}/api/family`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
      const created = await post({ act: 'create', id: 'board-aa', ticket: a.ticket, name: 'Ану', age: 9, avatar: 5, pics: [0, 1, 2], pin: '1234', recovery: 'ABCDEFGH23' });
      assert.equal(created.ok, true);
      b.send({ t: 'board', k: 'family' }); // cached before the join
      assert.equal((await b.next('board')).reason, 'no-family');
      assert.equal((await post({ act: 'join', code: created.code, id: 'board-bb', ticket: b.ticket, name: 'Бат', age: 7, avatar: 2, pics: [3, 4, 5], pin: '1234' })).ok, true);
      b.send({ t: 'board', k: 'family' });
      assert.equal((await b.next('board')).rows.length, 2, 'joining the family drops the cached answer');
      a.send({ t: 'board', k: 'family' });
      const fam = await a.next('board');
      assert.deepEqual(fam.rows, [{ rank: 1, name: 'Ану', avatar: 5, xp: 120, me: true }, { rank: 2, name: 'Бат', avatar: 2, xp: 0 }]);
      assert.ok(!JSON.stringify(fam).includes(created.code), 'no family code');
      a.socket.close(); b.socket.close();
      console.log('Leaderboard over the WebSocket: ok');
    } finally {
      if (server.exitCode === null) { const exited = new Promise((done) => server.once('exit', done)); server.kill(); await exited; } // it saves on the way out
    }
  }
  console.log('Leaderboards: all passed.');
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
