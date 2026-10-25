import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import roomStoreModule from '../room-store.js';

const { createRoomStore } = roomStoreModule;
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-room-store-'));

class FakePool {
  constructor({ state, failOnUpsert } = {}) {
    this.state = state || new Map();
    this.failOnUpsert = failOnUpsert;
    this.calls = [];
    this.notifications = [];
    this.identities = new Map();
  }
  async connect() {
    return {
      query: async (sql, values = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        this.calls.push(statement);
        if (/^CREATE (TABLE|INDEX)/.test(statement) || /^(BEGIN|COMMIT|ROLLBACK)$/.test(statement)) return { rows: [] };
        if (/^INSERT INTO naadamy_rooms/.test(statement)) {
          if (this.failOnUpsert && /DO UPDATE/.test(statement)) throw new Error('injected database outage');
          if (/DO NOTHING/.test(statement) && this.state.has(values[0])) return { rows: [] };
          const nextState = JSON.parse(values[1]);
          if (/jsonb_set/.test(statement) && this.state.has(values[0])) {
            this.state.set(values[0], { ...this.state.get(values[0]), chat: nextState.chat || [] });
          } else {
            this.state.set(values[0], nextState);
          }
          return { rows: [] };
        }
        if (/^SELECT code, state FROM naadamy_rooms$/.test(statement)) {
          return { rows: [...this.state].map(([code, state]) => ({ code, state })) };
        }
        if (/^SELECT state FROM naadamy_rooms WHERE code =/.test(statement)) {
          const state = this.state.get(values[0]);
          return { rows: state ? [{ state }] : [] };
        }
        if (/^INSERT INTO naadamy_identities/.test(statement)) {
          if (this.identities.has(values[0])) return { rows: [] };
          this.identities.set(values[0], values[1]);
          return { rows: [{ id: values[0] }] };
        }
        if (/^SELECT ticket_hash FROM naadamy_identities/.test(statement)) {
          const ticketHash = this.identities.get(values[0]);
          return { rows: ticketHash ? [{ ticket_hash: ticketHash }] : [] };
        }
        if (/^SELECT pg_notify/.test(statement)) {
          this.notifications.push({ channel: values[0], payload: JSON.parse(values[1]) });
          return { rows: [] };
        }
        if (/^UPDATE naadamy_rooms SET state =/.test(statement)) {
          this.state.set(values[0], JSON.parse(values[1]));
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL in room-store test: ${statement}`);
      },
      release() {},
    };
  }
  async end() {}
}

try {
  const legacyRooms = {
    NUTAG: { lots: [null, { by: 'player-1', n: 'Хүүхэд' }], chat: [{ k: 'p', id: 'player-1', n: 'Хүүхэд', i: 0 }] },
    BAT25: { lots: [null], chat: [] },
    'NOT-VALID': { lots: [], chat: [] },
  };
  writeFileSync(join(dataDir, 'rooms.json'), JSON.stringify(legacyRooms));
  const dbState = new Map([['NUTAG', { lots: ['database wins'], chat: [] }]]);
  const pool = new FakePool({ state: dbState });
  const store = createRoomStore({ dataDir, databaseUrl: 'postgres://test', Pool: class { constructor() { return pool; } } });
  const loaded = await store.load();
  assert.deepEqual(loaded.NUTAG, { lots: ['database wins'], chat: [] }, 'database records take precedence over stale JSON');
  assert.deepEqual(loaded.BAT25, legacyRooms.BAT25, 'valid legacy rooms are imported');
  assert.equal(loaded['NOT-VALID'], undefined, 'invalid legacy room codes are not imported');
  const ticket = 'a'.repeat(64);
  assert.equal(await store.authenticatePlayer('identity-player', ticket), true, 'a new player identity can register');
  assert.equal(await store.authenticatePlayer('identity-player', ticket), true, 'the registered ticket authenticates again');
  assert.equal(await store.authenticatePlayer('identity-player', 'b'.repeat(64)), false, 'a different ticket cannot claim an existing identity');
  assert.notEqual(pool.identities.get('identity-player'), ticket, 'the database stores only a ticket hash');
  assert.equal(await store.authenticatePlayer('other-player', 'invalid'), false, 'malformed tickets are rejected');
  assert.equal(await store.authenticatePlayer('__proto__', ticket), true, 'special object-property names can register safely');
  assert.equal(await store.authenticatePlayer('__proto__', 'b'.repeat(64)), false, 'special object-property names remain protected');
  const concurrentClaims = await Promise.all([
    store.authenticatePlayer('registration-race', 'e'.repeat(64)),
    store.authenticatePlayer('registration-race', 'f'.repeat(64)),
  ]);
  assert.equal(concurrentClaims.filter(Boolean).length, 1, 'only one concurrent ticket can register an identity');

  const persisted = {
    ...loaded,
    BAT25: { lots: [null], chat: [{ k: 'e', id: 'player-2', n: 'Найз', i: 0 }] },
  };
  const mutation = await store.mutateRoom('NUTAG', { lots: [], chat: [] }, (state) => {
    state.lots = ['atomic update'];
    return { changed: true };
  });
  assert.deepEqual(mutation.state.lots, ['atomic update'], 'room mutations return the updated shared state');
  assert.deepEqual(await store.getRoomState('NUTAG'), mutation.state, 'shared state can be reloaded from PostgreSQL');
  await store.mutateRoom('NUTAG', { lots: [], chat: [] }, (state) => {
    state.wrestling = { invites: [{ from: 'player-a', to: 'player-b' }], matches: [] };
    return {
      changed: true,
      events: [{ t: 'wrestle', to: ['player-b'], message: { t: 'wr-invite', from: 'player-a', name: 'Хүүхэд' } }],
    };
  }, 'instance-a');
  assert.equal(pool.notifications.length, 1, 'transactional room mutation publishes its realtime event');
  assert.equal(pool.notifications[0].payload.instanceId, 'instance-a', 'realtime event identifies its origin instance');
  assert.equal(pool.calls.indexOf('SELECT pg_notify($1, $2)') < pool.calls.lastIndexOf('COMMIT'), true,
    'realtime notification is enqueued before the room transaction commits');
  await store.save(persisted);
  assert.deepEqual(dbState.get('BAT25'), persisted.BAT25, 'new and updated room chat is upserted');
  assert.deepEqual(dbState.get('NUTAG').lots, ['atomic update'], 'chat snapshots do not overwrite shared lot state');
  assert.ok(pool.calls.some((sql) => sql === 'COMMIT'), 'database writes are committed');
  await store.close();

  const failingPool = new FakePool({ state: new Map(), failOnUpsert: true });
  const brokenStore = createRoomStore({
    dataDir,
    databaseUrl: 'postgres://test',
    Pool: class { constructor() { return failingPool; } },
  });
  await assert.rejects(brokenStore.save({ NUTAG: { lots: [], chat: [] } }), /Could not save room data to PostgreSQL/);
  assert.ok(failingPool.calls.includes('ROLLBACK'), 'failed database writes are rolled back');
  await brokenStore.close();

  const jsonStore = createRoomStore({ dataDir, databaseUrl: '' });
  assert.deepEqual(await jsonStore.load(), legacyRooms, 'local JSON storage remains backward-compatible');
  const jsonTicket = 'c'.repeat(64);
  assert.equal(await jsonStore.authenticatePlayer('json-player', jsonTicket), true, 'JSON mode registers player identities');
  const restartedJsonStore = createRoomStore({ dataDir, databaseUrl: '' });
  assert.equal(await restartedJsonStore.authenticatePlayer('json-player', jsonTicket), true, 'JSON identity credentials survive a server restart');
  assert.equal(await restartedJsonStore.authenticatePlayer('json-player', 'd'.repeat(64)), false, 'JSON mode rejects a different ticket');
  await jsonStore.save({ NUTAG: { lots: [], chat: [] } });
  assert.deepEqual(await jsonStore.load(), { NUTAG: { lots: [], chat: [] } }, 'JSON storage still saves snapshots');
  const jsonMutation = await jsonStore.mutateRoom('NUTAG', { lots: [], chat: [] }, (state) => {
    state.lots = ['saved immediately'];
    return { changed: true };
  });
  assert.deepEqual(jsonMutation.state.lots, ['saved immediately'], 'JSON storage supports atomic room mutation API');
  assert.deepEqual((await jsonStore.load()).NUTAG.lots, ['saved immediately'], 'JSON mutations persist without waiting for the snapshot timer');
  console.log('Room storage: PostgreSQL migration/upserts/errors and local JSON compatibility passed.');
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
