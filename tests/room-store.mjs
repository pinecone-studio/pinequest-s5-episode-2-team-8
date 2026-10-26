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
    this.progress = new Map();
  }
  async connect() {
    return {
      query: async (sql, values = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        this.calls.push(statement);
        if (/^(CREATE (TABLE|INDEX)|ALTER TABLE)/.test(statement) || /^(BEGIN|COMMIT|ROLLBACK)$/.test(statement)) return { rows: [] };
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
          if (!this.wallets.has(values[0])) this.wallets.set(values[0], {
            coins: values[1], xp: values[2], revision: 0, inventory: JSON.parse(values[3]), inventoryMigrated: true,
          });
          return { rows: [] };
        }
        if (/^UPDATE naadamy_wallets SET inventory =/.test(statement)) {
          const wallet = this.wallets.get(values[0]);
          if (wallet && !wallet.inventoryMigrated) {
            wallet.inventory = JSON.parse(values[1]);
            wallet.inventoryMigrated = true;
            return { rows: [{ inventory: wallet.inventory }] };
          }
          return { rows: [] };
        }
        if (/^SELECT coins, xp, revision, inventory FROM naadamy_wallets/.test(statement)) {
          const wallet = this.wallets.get(values[0]);
          return { rows: wallet ? [{ ...wallet }] : [] };
        }
        if (/^SELECT result FROM naadamy_wallet_ops/.test(statement)) {
          const result = this.walletOperations.get(`${values[0]}:${values[1]}`);
          return { rows: result ? [{ result }] : [] };
        }
        if (/^INSERT INTO naadamy_player_progress/.test(statement)) {
          if (!this.progress.has(values[0])) this.progress.set(values[0], { revision: 0, state: JSON.parse(values[1]) });
          return { rows: [] };
        }
        if (/^SELECT revision, state FROM naadamy_player_progress/.test(statement)) {
          const record = this.progress.get(values[0]);
          return { rows: record ? [{ ...record }] : [] };
        }
        if (/^UPDATE naadamy_player_progress SET revision =/.test(statement)) {
          const record = { revision: values[1], state: JSON.parse(values[2]) };
          this.progress.set(values[0], record);
          return { rows: [{ ...record }] };
        }
        if (/^UPDATE naadamy_wallets SET coins =/.test(statement)) {
          this.wallets.set(values[0], {
            coins: values[1], xp: values[2], revision: values[3],
            inventory: JSON.parse(values[4]), inventoryMigrated: true,
          });
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
  const pgAccount = await store.getAccount('inventory-player', { coins: 500, xp: 250 }, { owned: ['deel-blue', 'hat-cap', 'not-a-real-item'], rod: 2 });
  assert.deepEqual(pgAccount.inventory, { owned: ['deel-blue', 'hat-cap'], rod: 2 }, 'PostgreSQL inventory migration accepts only known shop items');
  pool.wallets.set('legacy-inventory', {
    coins: 80, xp: 10, revision: 0, inventory: { owned: ['deel-blue'], rod: 1 }, inventoryMigrated: false,
  });
  const legacyInventory = await store.getAccount('legacy-inventory', {}, { owned: ['deel-blue', 'pet-lamb'], rod: 1 });
  assert.deepEqual(legacyInventory.inventory, { owned: ['deel-blue', 'pet-lamb'], rod: 1 }, 'existing PostgreSQL wallets import inventory once');
  assert.deepEqual((await store.getAccount('legacy-inventory', {}, { owned: ['deel-blue'], rod: 1 })).inventory, legacyInventory.inventory,
    'PostgreSQL ignores later client inventory seeds after migration');
  const pgOperation = '1'.repeat(32);
  const pgSpend = await store.mutateWallet('identity-player', pgOperation, (wallet, inventory) => ({
    changed: true,
    wallet: { ...wallet, coins: wallet.coins - 125 },
    inventory: { ...inventory, owned: [...inventory.owned, 'hat-cap'] },
    result: { accepted: true },
  }));
  assert.deepEqual(pgSpend.wallet, { coins: 375, xp: 250, revision: 1 }, 'PostgreSQL wallet mutations advance the revision');
  assert.deepEqual(pgSpend.inventory, { owned: ['deel-blue', 'hat-cap'], rod: 1 }, 'PostgreSQL mutations persist a whitelisted inventory with the wallet');
  const pgReplay = await store.mutateWallet('identity-player', pgOperation, () => { throw new Error('duplicate operation was applied twice'); });
  assert.equal(pgReplay.duplicate, true, 'PostgreSQL wallet operations are idempotent');
  const pgQuestClaim = await store.mutateWallet('identity-player', 'quest:2026-10-26:fish', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 25 }, result: { accepted: true },
  }));
  assert.equal(pgQuestClaim.wallet.coins, 400, 'PostgreSQL stores namespaced daily quest claims');
  assert.equal((await store.mutateWallet('identity-player', 'quest:2026-10-26:fish', () => {
    throw new Error('daily quest reward was applied twice');
  })).duplicate, true, 'PostgreSQL daily quest claims remain idempotent');
  assert.deepEqual(pgReplay.wallet, pgSpend.wallet, 'a replay returns the current canonical wallet');
  assert.deepEqual(pgReplay.inventory, pgSpend.inventory, 'a replay returns the current canonical inventory');
  const pgRejected = await store.mutateWallet('identity-player', '2'.repeat(32), () => ({ changed: false, result: { accepted: false, reason: 'insufficient' } }));
  assert.equal(pgRejected.wallet.coins, 400, 'rejected PostgreSQL spends leave the wallet unchanged');
  assert.equal((await store.mutateWallet('identity-player', '2'.repeat(32), () => { throw new Error('rejected operation was retried'); })).duplicate, true,
    'rejected PostgreSQL operations are also idempotent');
  const pgProgress = await store.getProgress('identity-player', { produce: { milk: 2 } });
  assert.deepEqual(pgProgress, { revision: 0, state: { produce: { milk: 2 } } }, 'PostgreSQL creates initial player progress');
  const pgProgressSaved = await store.saveProgress('identity-player', 0, { produce: { milk: 3 } });
  assert.deepEqual(pgProgressSaved, { accepted: true, revision: 1, state: { produce: { milk: 3 } } }, 'PostgreSQL persists player progress and advances revision');
  const pgProgressConflict = await store.saveProgress('identity-player', 0, { produce: { milk: 4 } });
  assert.deepEqual(pgProgressConflict, { accepted: false, revision: 1, state: { produce: { milk: 3 } } }, 'PostgreSQL rejects stale progress writes and returns canonical data');
  assert.deepEqual(await store.getProgress('identity-player', { produce: { milk: 1 } }),
    { revision: 1, state: { produce: { milk: 3 } } }, 'PostgreSQL ignores later initial progress seeds');
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
  const jsonAccount = await jsonStore.getAccount('json-player', { coins: 80, xp: 10 }, { owned: ['deel-blue', 'pet-lamb'], rod: 1 });
  const jsonWallet = jsonAccount.wallet;
  assert.deepEqual(jsonWallet, { coins: 80, xp: 10, revision: 0 }, 'JSON mode seeds a profile wallet');
  assert.deepEqual(jsonAccount.inventory, { owned: ['deel-blue', 'pet-lamb'], rod: 1 }, 'JSON mode imports only whitelisted shop ownership');
  const jsonOperation = '3'.repeat(32);
  const jsonReward = await jsonStore.mutateWallet('json-player', jsonOperation, (wallet, inventory) => ({
    changed: true,
    wallet: { ...wallet, coins: wallet.coins + 15, xp: wallet.xp + 20 },
    inventory: { ...inventory, rod: 2 },
    result: { accepted: true },
  }));
  assert.deepEqual(jsonReward.wallet, { coins: 95, xp: 30, revision: 1 }, 'JSON mode persists wallet balances and revisions');
  assert.deepEqual(jsonReward.result, { accepted: true }, 'JSON mutations return the operation result separately from the wallet envelope');
  assert.deepEqual(jsonReward.inventory, { owned: ['deel-blue', 'pet-lamb'], rod: 2 }, 'JSON mode atomically saves shop ownership with the wallet');
  assert.deepEqual(await restartedJsonStore.getWallet('json-player'), jsonReward.wallet, 'JSON wallet balances survive a server restart');
  assert.deepEqual((await restartedJsonStore.getAccount('json-player')).inventory, jsonReward.inventory, 'JSON inventory survives a server restart');
  const jsonQuestClaim = await jsonStore.mutateWallet('json-player', 'quest:2026-10-26:fish', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 25 }, result: { accepted: true },
  }));
  assert.equal(jsonQuestClaim.wallet.coins, 120, 'JSON mode stores namespaced daily quest claims');
  const jsonProgress = await jsonStore.getProgress('json-player', { fish: { perch: 1 } });
  const jsonProgressSaved = await jsonStore.saveProgress('json-player', jsonProgress.revision, { fish: { perch: 2 } });
  assert.deepEqual(jsonProgressSaved, { accepted: true, revision: 1, state: { fish: { perch: 2 } } }, 'JSON mode persists revisioned player progress');
  assert.deepEqual(await jsonStore.saveProgress('json-player', 0, { fish: { perch: 3 } }),
    { accepted: false, revision: 1, state: { fish: { perch: 2 } } }, 'JSON mode rejects stale progress writes');
  assert.deepEqual(await restartedJsonStore.getProgress('json-player'),
    { revision: 1, state: { fish: { perch: 2 } } }, 'JSON progress survives a server restart');
  const jsonReplay = await restartedJsonStore.mutateWallet('json-player', jsonOperation, () => { throw new Error('duplicate operation was applied twice'); });
  assert.equal(jsonReplay.duplicate, true, 'JSON wallet operations are idempotent');
  const jsonQuestReplay = await restartedJsonStore.mutateWallet('json-player', 'quest:2026-10-26:fish', () => {
    throw new Error('daily quest reward was applied twice');
  });
  assert.equal(jsonQuestReplay.duplicate, true, 'JSON daily quest claims remain idempotent after restart');
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
