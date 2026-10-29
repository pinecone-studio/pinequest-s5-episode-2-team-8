import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import roomStoreModule from '../server/room-store.js';

const { createRoomStore } = roomStoreModule;
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-shared-presence-'));

class FakePool {
  constructor() {
    this.players = new Map();
    this.families = new Map();
    this.listeners = [];
    this.handlers = {};
  }

  on(event, handler) { this.handlers[event] = handler; }

  async connect() {
    const client = new EventEmitter();
    client.query = (sql, values = []) => this.run(sql, values, client);
    client.release = () => {};
    return client;
  }

  async query(sql, values = []) {
    return this.run(sql, values, null);
  }

  async run(sql, values, client) {
    const statement = sql.replace(/\s+/g, ' ').trim();
    if (/^(CREATE (TABLE|INDEX)|ALTER TABLE)/.test(statement) || /^(BEGIN|COMMIT|ROLLBACK)$/.test(statement)) return { rows: [] };
    if (/^SELECT pg_advisory_xact_lock/.test(statement)) return { rows: [] };
    if (/^SELECT code, state FROM naadamy_rooms/.test(statement)) return { rows: [] };
    if (/^LISTEN /.test(statement)) {
      this.listeners.push(client);
      return { rows: [] };
    }
    if (/^SELECT pg_notify/.test(statement)) {
      const notification = { channel: values[0], payload: values[1] };
      for (const listener of this.listeners) listener.emit('notification', notification);
      return { rows: [] };
    }
    if (/^SELECT members, pin FROM naadamy_families WHERE code = \$1 FOR UPDATE$/.test(statement)) {
      const row = this.families.get(values[0]);
      return { rows: row ? [structuredClone(row)] : [] };
    }
    if (/^DELETE FROM naadamy_families WHERE code/.test(statement)) { this.families.delete(values[0]); return { rows: [] }; }
    if (/^DELETE FROM naadamy_\w+ WHERE (player_)?id = ANY|^DELETE FROM naadamy_erased|^INSERT INTO naadamy_erased|^DELETE FROM naadamy_voice WHERE family_code/.test(statement)) return { rows: [] };
    if (/^SELECT instance_id FROM naadamy_players/.test(statement)) {
      const player = this.players.get(values[0]);
      return { rows: player ? [{ instance_id: player.instance_id }] : [] };
    }
    if (/^INSERT INTO naadamy_players/.test(statement)) {
      const [id, room_code, instance_id, state] = values;
      this.players.set(id, { id, room_code, instance_id, state: JSON.parse(state), updated_at: Date.now() });
      return { rows: [] };
    }
    if (/^UPDATE naadamy_players SET state/.test(statement)) {
      const player = this.players.get(values[0]);
      if (player && player.instance_id === values[1]) {
        player.state = JSON.parse(values[2]);
        player.updated_at = Date.now();
      }
      return { rows: [] };
    }
    if (/^UPDATE naadamy_players SET updated_at/.test(statement)) {
      for (const player of this.players.values()) {
        if (player.instance_id === values[0]) player.updated_at = Date.now();
      }
      return { rows: [] };
    }
    if (/^DELETE FROM naadamy_players WHERE updated_at/.test(statement)) {
      const rows = [];
      for (const [id, player] of this.players) {
        if (player.updated_at < Date.now() - 60000) {
          rows.push({ id, room_code: player.room_code });
          this.players.delete(id);
        }
      }
      return { rows };
    }
    if (/^SELECT id, state FROM naadamy_players/.test(statement)) {
      return { rows: [...this.players.values()]
        .filter((player) => player.room_code === values[0] && player.updated_at >= Date.now() - 60000)
        .map(({ id, state }) => ({ id, state })) };
    }
    if (/^DELETE FROM naadamy_players WHERE id =/.test(statement)) {
      const player = this.players.get(values[0]);
      if (player && player.instance_id === values[1]) this.players.delete(values[0]);
      return { rows: [] };
    }
    if (/^DELETE FROM naadamy_players WHERE instance_id/.test(statement)) {
      for (const [id, player] of this.players) if (player.instance_id === values[0]) this.players.delete(id);
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in shared-presence test: ${statement}`);
  }

  async end() {}
}

try {
  const pool = new FakePool();
  const Pool = class { constructor() { return pool; } };
  const storeA = createRoomStore({ dataDir, databaseUrl: 'postgres://test', Pool });
  const storeB = createRoomStore({ dataDir, databaseUrl: 'postgres://test', Pool });
  await Promise.all([storeA.load(), storeB.load()]);

  const eventsA = [], eventsB = [];
  await Promise.all([
    storeA.startRealtime('instance-a', (event) => eventsA.push(event)),
    storeB.startRealtime('instance-b', (event) => eventsB.push(event)),
  ]);

  const player = { id: 'player-1', name: 'Найз', x: 12, y: 8, dir: 2 };
  assert.equal(await storeA.registerPresence('instance-a', 'ABC12', player), null);
  assert.deepEqual(await storeB.listPresence('ABC12'), [player], 'another instance sees active presence');
  assert.equal(await storeB.registerPresence('instance-b', 'ABC12', { ...player, name: 'Найз 2' }), 'instance-a',
    'registering the same player reports the previous instance');

  await storeA.updatePresence('instance-a', { ...player, x: 14 });
  assert.equal((await storeA.listPresence('ABC12'))[0].x, 12,
    'a replaced instance cannot overwrite the current owner presence');
  await storeB.updatePresence('instance-b', { ...player, x: 14 });
  assert.equal((await storeA.listPresence('ABC12'))[0].x, 14, 'presence updates are shared');

  const event = { room: 'ABC12', instanceId: 'instance-a', message: { t: 'move', id: player.id, x: 14, y: 8, dir: 2 } };
  await storeA.publishRealtime(event);
  assert.equal(eventsA.length, 0, 'a sender does not receive its own event');
  assert.deepEqual(eventsB, [event], 'other instances receive published realtime events');

  await storeB.removePresence('instance-b', player.id);
  assert.deepEqual(await storeA.listPresence('ABC12'), [], 'disconnect removes shared presence');
  pool.players.set('stale-player', {
    id: 'stale-player', room_code: 'ABC12', instance_id: 'stopped-instance',
    state: { id: 'stale-player', name: 'Offline' }, updated_at: Date.now() - 61000,
  });
  assert.deepEqual(await storeA.listPresence('ABC12'), [], 'stale players are excluded from new join snapshots');
  assert.equal(pool.players.has('stale-player'), true, 'snapshot reads leave cleanup to the heartbeat sweeper');
  assert.deepEqual(await storeA.refreshPresence('instance-a'), [{ id: 'stale-player', room_code: 'ABC12' }],
    'heartbeat cleanup reports expired players for leave broadcasts');
  assert.equal(pool.players.has('stale-player'), false, 'heartbeat removes expired presence rows');
  // an erase on one instance reaches every instance, so each can close those children's sockets and drop their chat
  pool.families.set('ERAS2345', { members: [{ id: 'kid-one' }, { id: 'kid-two' }], pin: {} });
  eventsA.length = 0; eventsB.length = 0;
  assert.equal(await storeA.eraseFamily('ERAS2345', () => ({ erase: true, result: 'erased' })), 'erased');
  assert.deepEqual(eventsB, [{ t: 'family-erased', ids: ['kid-one', 'kid-two'], code: 'ERAS2345' }], 'the other instance hears which children were erased');
  assert.deepEqual(eventsA, eventsB, 'the erasing instance hears it too (dropping them twice is harmless)');
  await storeA.close();
  console.log('Shared presence: instance discovery, replacement safety, updates, event fanout and family erase fanout passed.');
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
