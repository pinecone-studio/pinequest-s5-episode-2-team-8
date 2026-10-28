// The LISTEN connection drops (pooler restart, network blip): the store must reconnect, back off, and stop on close().
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import roomStoreModule from '../server/room-store.js';
import resyncModule from '../server/realtime-resync.js';

const { createRoomStore } = roomStoreModule;
const { resyncRealtime } = resyncModule;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn) => { for (let i = 0; i < 200 && !fn(); i++) await sleep(5); assert.ok(fn(), 'timed out'); };
const silence = (fn) => async () => { const e = console.error, l = console.log; console.error = console.log = () => {}; try { await fn(); } finally { console.error = e; console.log = l; } };

class FakeClient extends EventEmitter {
  constructor(pool) { super(); this.pool = pool; this.released = []; this.listens = 0; }
  async query(sql) {
    if (/^LISTEN/.test(sql)) {
      if (this.pool.gate) await this.pool.gate;
      if (this.pool.failListen) throw new Error('listen refused');
      this.listens++;
    }
    return { rows: [] };
  }
  release(destroy) { this.released.push(destroy); }
}
class FakePool extends EventEmitter {
  constructor() { super(); this.clients = []; this.connects = 0; this.failConnects = 0; this.failListen = false; }
  async connect() {
    this.connects++;
    if (this.failConnects > 0) { this.failConnects--; throw new Error('connect refused'); }
    const client = new FakeClient(this);
    this.clients.push(client);
    return client;
  }
  async query() { return { rows: [] }; }
  async end() {}
}
function make(pool) {
  return createRoomStore({
    dataDir: mkdtempSync(join(tmpdir(), 'naadamy-listen-')),
    databaseUrl: 'postgres://test',
    Pool: class { constructor() { return pool; } },
    reconnectMs: [20, 80],
  });
}
const note = (client, payload) => client.emit('notification', { channel: 'naadamy_realtime', payload: JSON.stringify(payload) });

await silence(async () => {
  // delivery, error -> reconnect, onReconnect only on re-connect
  let pool = new FakePool(), store = make(pool), events = [], reconnects = 0;
  await store.startRealtime('me', (e) => events.push(e), () => reconnects++);
  assert.equal(reconnects, 0);
  note(pool.clients[0], { instanceId: 'other', n: 1 });
  note(pool.clients[0], { instanceId: 'me', n: 2 }); // own events are skipped
  assert.deepEqual(events, [{ instanceId: 'other', n: 1 }]);
  pool.clients[0].emit('error', new Error('boom'));
  pool.clients[0].emit('end'); // a dead socket emits both: one drop only
  assert.deepEqual(pool.clients[0].released, [true]);
  await until(() => pool.clients.length === 2 && reconnects === 1);
  assert.equal(pool.clients[1].listens, 1);
  note(pool.clients[1], { instanceId: 'other', n: 3 });
  assert.equal(events.length, 2);
  await store.close();
  assert.deepEqual(pool.clients[1].released, [true]);

  // connect and LISTEN failures back off and retry, never two loops at once
  pool = new FakePool(); store = make(pool); reconnects = 0;
  await store.startRealtime('me', () => {}, () => reconnects++);
  pool.failConnects = 2;
  const t0 = Date.now();
  pool.clients[0].emit('end');
  pool.clients[0].emit('end');
  await until(() => reconnects === 1);
  assert.equal(pool.connects, 4); // 1 first + 2 refused + 1 good
  assert.ok(Date.now() - t0 >= 50, 'backoff 20ms then 40ms');
  pool.failListen = true;
  pool.clients.at(-1).emit('error', new Error('x'));
  await until(() => pool.connects >= 6);
  assert.ok(pool.clients.slice(2).every((c) => c.released.length === 1), 'failed LISTEN clients are discarded');
  pool.failListen = false;
  await until(() => reconnects === 2);
  await store.close();

  // first LISTEN failure still throws to the caller (server.js exits on it)
  pool = new FakePool(); store = make(pool); pool.failListen = true;
  await assert.rejects(store.startRealtime('me', () => {}), /listen refused/);
  await sleep(60);
  assert.equal(pool.connects, 1, 'no retry loop after a failed start');
  await store.close();

  // close() during a pending retry stops it
  pool = new FakePool(); store = make(pool);
  await store.startRealtime('me', () => {});
  pool.clients[0].emit('end');
  await store.close();
  await sleep(100);
  assert.equal(pool.connects, 1, 'no connect after close');

  // close() while the first LISTEN is still pending: the client is given back when it resolves, nothing reconnects
  pool = new FakePool(); store = make(pool);
  let open; pool.gate = new Promise((resolve) => { open = resolve; });
  const started = store.startRealtime('me', () => {});
  await until(() => pool.clients.length === 1);
  await store.close();
  open(); await started;
  assert.deepEqual(pool.clients[0].released, [true]);
  await sleep(60);
  assert.equal(pool.connects, 1);

  // an 'error' between connect and LISTEN: only logged, LISTEN's own failure reaches the caller, no retry loop
  pool = new FakePool(); store = make(pool);
  let fail; pool.gate = new Promise((_, reject) => { fail = reject; });
  const doomed = store.startRealtime('me', () => {});
  await until(() => pool.clients.length === 1);
  pool.clients[0].emit('error', new Error('reset'));
  assert.deepEqual(pool.clients[0].released, []);
  fail(new Error('connection terminated'));
  await assert.rejects(doomed, /connection terminated/);
  assert.deepEqual(pool.clients[0].released, [true]);
  await sleep(60);
  assert.equal(pool.connects, 1);
  await store.close();

  // resync: everything held in memory is checked, the erase finishes before the presence diff, erased ids get no leave/join
  const handled = [];
  const rooms = new Map([
    ['AAAA', { code: 'AAAA', players: new Map([['me1', {}]]), remotePlayers: new Map([['gone', {}], ['stay', {}], ['kid2', {}]]),
      chat: [{ k: 'p', id: 'kid2' }, { k: 'p', id: 'chatter' }], lots: [null, { by: 'owner' }] }],
    ['BBBB', { code: 'BBBB', players: new Map(), remotePlayers: new Map([['ignored', {}]]), chat: [], lots: [] }],
  ]);
  const savedState = { CCCC: { chat: [{ id: 'old' }], lots: [{ by: 'savedowner' }] } };
  let asked;
  const roomStore = {
    erasedAmong: async (ids) => { asked = ids; return ['kid', 'kid2', 'savedowner']; },
    listPresence: async (code) => { assert.equal(code, 'AAAA'); return [{ id: 'me1' }, { id: 'stay' }, { id: 'new', x: 3 }, { id: 'kid2' }]; },
  };
  let erasedDone = false;
  await resyncRealtime({
    roomStore, rooms, saved: () => savedState, localIds: () => ['me1', 'kid'],
    handle: async (e) => {
      handled.push(e);
      if (e.t === 'family-erased') { await sleep(10); erasedDone = true; } else assert.ok(erasedDone, 'erase finished before the presence diff');
    },
  });
  assert.deepEqual(asked.slice().sort(), ['chatter', 'gone', 'ignored', 'kid', 'kid2', 'me1', 'old', 'owner', 'savedowner', 'stay']);
  assert.deepEqual(handled, [
    { t: 'family-erased', ids: ['kid', 'kid2', 'savedowner'] },
    { room: 'AAAA', instanceId: '', message: { t: 'leave', id: 'gone' } },
    { room: 'AAAA', instanceId: '', message: { t: 'join', p: { id: 'new', x: 3 } } },
  ]);
  // a join/leave event arriving while listPresence is awaited makes the room be asked again (max 3 times)
  let asks = 0;
  const busy = { code: 'DDDD', players: new Map([['me1', {}]]), remotePlayers: new Map(), chat: [], lots: [] };
  await resyncRealtime({
    roomStore: { erasedAmong: async () => [], listPresence: async () => { asks++; busy.presenceRev = (busy.presenceRev || 0) + 1; return []; } },
    rooms: new Map([['DDDD', busy]]), saved: () => ({}), localIds: () => [], handle: () => {},
  });
  assert.equal(asks, 3);
  handled.length = 0;
  await resyncRealtime({ roomStore: { erasedAmong: async () => assert.fail('nothing held, no query'), listPresence: async () => [] }, rooms: new Map(), saved: () => ({}), localIds: () => [], handle: (e) => handled.push(e) });
  assert.deepEqual(handled, []);

  // erasedAmong: the postgres store asks once with ANY(), the JSON store (one process) answers []
  const sqls = [];
  class QueryPool extends FakePool {
    async query(sql, params) { sqls.push([sql.replace(/\s+/g, ' '), params]); return { rows: [{ id: 'a' }, { id: 'b' }] }; }
  }
  const pgStore = make(new QueryPool());
  assert.deepEqual(await pgStore.erasedAmong(['a', 'b']), ['a', 'b']);
  const [sql, params] = sqls.at(-1);
  assert.match(sql, /naadamy_erased/);
  assert.match(sql, /ANY\(\$1::text\[\]\)/);
  assert.match(sql, /30 days/);
  assert.deepEqual(params, [['a', 'b']]);
  const jsonStore = createRoomStore({ dataDir: mkdtempSync(join(tmpdir(), 'naadamy-listen-')), databaseUrl: '' });
  assert.deepEqual(await jsonStore.erasedAmong(['a']), []);
})();
console.log('listen-reconnect: ok');
