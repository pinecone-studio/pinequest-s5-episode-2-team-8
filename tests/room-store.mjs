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
    this.wallets = new Map();
    this.walletOperations = new Map();
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
        if (/^INSERT INTO naadamy_wallets/.test(statement)) {
          if (!this.wallets.has(values[0])) this.wallets.set(values[0], { coins: values[1], xp: values[2], revision: 0 });
          return { rows: [] };
        }
        if (/^SELECT coins, xp, revision FROM naadamy_wallets/.test(statement)) {
          const wallet = this.wallets.get(values[0]);
          return { rows: wallet ? [{ ...wallet }] : [] };
        }
        if (/^SELECT result FROM naadamy_wallet_ops/.test(statement)) {
          const result = this.walletOperations.get(`${values[0]}:${values[1]}`);
          return { rows: result ? [{ result }] : [] };
        }
        if (/^UPDATE naadamy_wallets SET coins =/.test(statement)) {
          this.wallets.set(values[0], { coins: values[1], xp: values[2], revision: values[3] });
          return { rows: [] };
        }
        if (/^INSERT INTO naadamy_wallet_ops/.test(statement)) {
          this.walletOperations.set(`${values[0]}:${values[1]}`, JSON.parse(values[2]));
          return { rows: [] };
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
  const pgWallet = await store.getWallet('identity-player', { coins: 500, xp: 250 });
  assert.deepEqual(pgWallet, { coins: 500, xp: 250, revision: 0 }, 'PostgreSQL creates the wallet from the one-time profile migration');
  const pgOperation = '1'.repeat(32);
  const pgSpend = await store.mutateWallet('identity-player', pgOperation, (wallet) => ({
    changed: true,
    wallet: { ...wallet, coins: wallet.coins - 125 },
    result: { accepted: true },
  }));
  assert.deepEqual(pgSpend.wallet, { coins: 375, xp: 250, revision: 1 }, 'PostgreSQL wallet mutations advance the revision');
  const pgReplay = await store.mutateWallet('identity-player', pgOperation, () => { throw new Error('duplicate operation was applied twice'); });
  assert.equal(pgReplay.duplicate, true, 'PostgreSQL wallet operations are idempotent');
  assert.deepEqual(pgReplay.wallet, pgSpend.wallet, 'a replay returns the current canonical wallet');
  const pgRejected = await store.mutateWallet('identity-player', '2'.repeat(32), () => ({ changed: false, result: { accepted: false, reason: 'insufficient' } }));
  assert.equal(pgRejected.wallet.coins, 375, 'rejected PostgreSQL spends leave the wallet unchanged');
  assert.equal((await store.mutateWallet('identity-player', '2'.repeat(32), () => { throw new Error('rejected operation was retried'); })).duplicate, true,
    'rejected PostgreSQL operations are also idempotent');
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
  const jsonWallet = await jsonStore.getWallet('json-player', { coins: 80, xp: 10 });
  assert.deepEqual(jsonWallet, { coins: 80, xp: 10, revision: 0 }, 'JSON mode seeds a profile wallet');
  const jsonOperation = '3'.repeat(32);
  const jsonReward = await jsonStore.mutateWallet('json-player', jsonOperation, (wallet) => ({
    changed: true,
    wallet: { ...wallet, coins: wallet.coins + 15, xp: wallet.xp + 20 },
    result: { accepted: true },
  }));
  assert.deepEqual(jsonReward.wallet, { coins: 95, xp: 30, revision: 1 }, 'JSON mode persists wallet balances and revisions');
  assert.deepEqual(jsonReward.result, { accepted: true }, 'JSON mutations return the operation result separately from the wallet envelope');
  assert.deepEqual(await restartedJsonStore.getWallet('json-player'), jsonReward.wallet, 'JSON wallet balances survive a server restart');
  const jsonReplay = await restartedJsonStore.mutateWallet('json-player', jsonOperation, () => { throw new Error('duplicate operation was applied twice'); });
  assert.equal(jsonReplay.duplicate, true, 'JSON wallet operations are idempotent');
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
