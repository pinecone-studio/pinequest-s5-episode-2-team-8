import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import roomStoreModule from '../server/room-store.js';

const { createRoomStore } = roomStoreModule;
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-room-store-'));

class FakePool {
  constructor({ state, failOnUpsert } = {}) {
    this.state = state || new Map();
    this.failOnUpsert = failOnUpsert;
    this.calls = [];
    this.notifications = [];
    this.identities = new Map();
    this.handlers = {};
    this.wallets = new Map();
    this.walletOperations = new Map();
    this.progress = new Map();
    this.deviceTickets = new Map();
    this.families = new Map();
    this.erased = new Set();
  }
  on(event, handler) { this.handlers[event] = handler; }

  async query(sql, values) {
    return (await this.connect()).query(sql, values);
  }
  async connect() {
    return {
      query: async (sql, values = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        this.calls.push(statement);
        if (/^(CREATE (TABLE|INDEX)|ALTER TABLE|DELETE FROM naadamy_room_players WHERE seen_at)/.test(statement) || /^(BEGIN|COMMIT|ROLLBACK)$/.test(statement)) return { rows: [] };
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
          if (this.identities.has(values[0]) || (/NOT EXISTS \(SELECT 1 FROM naadamy_erased/.test(statement) && this.erased.has(values[0]))) return { rows: [] };
          this.identities.set(values[0], values[1]);
          return { rows: [{ id: values[0] }] };
        }
        if (/^SELECT ticket_hash FROM naadamy_identities/.test(statement)) {
          const ticketHash = this.identities.get(values[0]);
          return { rows: ticketHash ? [{ ticket_hash: ticketHash }] : [] };
        }
        if (/^INSERT INTO naadamy_player_tickets/.test(statement)) {
          const hashes = this.deviceTickets.get(values[0]) || [];
          if (!hashes.includes(values[1])) hashes.push(values[1]);
          this.deviceTickets.set(values[0], hashes);
          return { rows: [] };
        }
        if (/^DELETE FROM naadamy_player_tickets WHERE player_id = \$1 AND ticket_hash NOT IN/.test(statement)) {
          this.deviceTickets.set(values[0], (this.deviceTickets.get(values[0]) || []).slice(-values[1]));
          return { rows: [] };
        }
        if (/^SELECT 1 FROM naadamy_player_tickets/.test(statement)) {
          return { rows: (this.deviceTickets.get(values[0]) || []).includes(values[1]) ? [{ '?column?': 1 }] : [] };
        }
        if (/^INSERT INTO naadamy_families/.test(statement)) {
          if (this.families.has(values[0])) return { rows: [] };
          this.families.set(values[0], { members: JSON.parse(values[1]), pin: JSON.parse(values[2]) });
          return { rows: [{ code: values[0] }] };
        }
        if (/^SELECT members, pin FROM naadamy_families WHERE code = \$1( FOR UPDATE)?$/.test(statement)) {
          const row = this.families.get(values[0]);
          return { rows: row ? [structuredClone(row)] : [] };
        }
        if (/^UPDATE naadamy_families SET members = \$2::jsonb, pin = \$3::jsonb/.test(statement)) {
          this.families.set(values[0], { members: JSON.parse(values[1]), pin: JSON.parse(values[2]) });
          return { rows: [] };
        }
        if (/^DELETE FROM naadamy_families WHERE code = \$1$/.test(statement)) {
          this.families.delete(values[0]);
          return { rows: [] };
        }
        const erased = /^DELETE FROM (naadamy_\w+) WHERE (?:player_)?id = ANY\(\$1::text\[\]\)$/.exec(statement);
        if (erased) {
          const ids = new Set(values[0]);
          const maps = { naadamy_wallets: this.wallets, naadamy_player_progress: this.progress, naadamy_player_tickets: this.deviceTickets, naadamy_identities: this.identities, naadamy_players: new Map(), naadamy_room_players: new Map() };
          if (erased[1] === 'naadamy_wallet_ops') { for (const key of [...this.walletOperations.keys()]) if (ids.has(key.slice(0, key.lastIndexOf(':')).split(':')[0])) this.walletOperations.delete(key); }
          else for (const id of ids) maps[erased[1]].delete(id);
          return { rows: [] };
        }
        if (/^DELETE FROM naadamy_erased WHERE erased_at </.test(statement)) return { rows: [] };
        if (/^INSERT INTO naadamy_erased \(id\) SELECT unnest/.test(statement)) { for (const id of values[0]) this.erased.add(id); return { rows: [] }; }
        if (/^SELECT code, state FROM naadamy_rooms ORDER BY code FOR UPDATE$/.test(statement)) {
          return { rows: [...this.state].sort(([x], [y]) => (x < y ? -1 : 1)).map(([code, state]) => ({ code, state: structuredClone(state) })) };
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
        if (/^SELECT coins, xp, revision, inventory(, earned)? FROM naadamy_wallets/.test(statement)) {
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
            inventory: JSON.parse(values[4]), earned: JSON.parse(values[5]), inventoryMigrated: true,
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
  await store.addDeviceTicket('identity-player', 'c'.repeat(64));
  assert.equal(await store.authenticatePlayer('identity-player', 'c'.repeat(64)), true, 'a ticket from a family login works on its device');
  assert.equal(await store.authenticatePlayer('identity-player', ticket), true, 'the first device keeps working');
  assert.equal(await store.authenticatePlayer('__proto__', 'c'.repeat(64)), false, 'a device ticket only works for its own player');
  const familyMember = { id: 'identity-player', name: 'Сараа', age: 8, avatar: 1, salt: '00', hash: '11', fails: 0, until: 0 };
  assert.equal(await store.createFamily('ABCD2345', familyMember), true, 'PostgreSQL stores a new family');
  assert.equal(await store.createFamily('ABCD2345', familyMember), false, 'a family code is never given twice');
  const familyResult = await store.mutateFamily('ABCD2345', (family) => { family.members[0].fails = 2; return { changed: true, result: 'saved' }; });
  assert.equal(familyResult, 'saved');
  assert.equal((await store.getFamily('ABCD2345')).members[0].fails, 2, 'a family change is saved');
  assert.equal(await store.getFamily('bad'), null, 'malformed family codes are not looked up');
  assert.equal(await store.mutateFamily('ZZZZ2222', (family) => ({ changed: false, result: family })), null, 'an unknown family reaches mutate as null');
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
  assert.deepEqual(pgRejected.result, { accepted: false, reason: 'insufficient' }, 'a rejected PostgreSQL operation reports its own result');
  await store.mutateWallet('legacy-inventory', '6'.repeat(32), (wallet, inventory, earned) => {
    assert.deepEqual(earned, { d: '', coins: 0, xp: 0 }, 'a PostgreSQL wallet starts with nothing earned today');
    return { changed: true, wallet: { ...wallet, xp: wallet.xp + 5 }, earned: { d: '2026-10-27', coins: 0, xp: 5 }, result: { accepted: true } };
  });
  await store.mutateWallet('legacy-inventory', '7'.repeat(32), (wallet, inventory, earned) => {
    assert.deepEqual(earned, { d: '2026-10-27', coins: 0, xp: 5 }, 'PostgreSQL keeps the daily earned tally');
    return { changed: false, result: { accepted: true } };
  });
  assert.equal((await store.mutateWallet('identity-player', '2'.repeat(32), () => { throw new Error('rejected operation was retried'); })).duplicate, true,
    'rejected PostgreSQL operations are also idempotent');
  const pgMatchReward = await store.mutateWallet('identity-player', 'wrestle:w-match-0001', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 25, xp: wallet.xp + 30 }, result: { accepted: true },
  }));
  assert.deepEqual(pgMatchReward.wallet, { coins: 425, xp: 280, revision: 3 }, 'PostgreSQL stores server-validated match rewards');
  assert.equal((await store.mutateWallet('identity-player', 'wrestle:w-match-0001', () => {
    throw new Error('wrestling reward was applied twice');
  })).duplicate, true, 'PostgreSQL match rewards remain idempotent');
  const pgActivityReward = await store.mutateWallet('identity-player', 'activity:2026-10-26:rest', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 5, xp: wallet.xp + 10 }, result: { accepted: true },
  }));
  assert.deepEqual(pgActivityReward.wallet, { coins: 430, xp: 290, revision: 4 }, 'PostgreSQL stores daily activity rewards');
  assert.equal((await store.mutateWallet('identity-player', 'activity:2026-10-26:rest', () => {
    throw new Error('daily activity reward was applied twice');
  })).duplicate, true, 'PostgreSQL daily activity rewards remain idempotent');
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

  // erasing a family: every table, its gers and chat lines, in one transaction
  const pin = { pinHash: 'a'.repeat(64), pinSalt: 'b'.repeat(32), pinFails: 0, pinUntil: 0, pinLocks: 1, recoveryHash: 'c'.repeat(64), recoverySalt: 'd'.repeat(32) };
  assert.equal(await store.createFamily('ERAS2345', { ...familyMember, id: 'erase-one' }, pin), true);
  assert.equal((await store.getFamily('ERAS2345')).recoveryHash, pin.recoveryHash, 'PostgreSQL keeps the PIN and recovery code with the family');
  await store.mutateFamily('ERAS2345', (family) => { family.members.push({ ...familyMember, id: 'erase-two' }); family.pinFails = 2; return { changed: true, result: null }; });
  assert.equal((await store.getFamily('ERAS2345')).pinFails, 2, 'a PIN change is saved with the family');
  for (const id of ['erase-one', 'erase-two']) {
    await store.authenticatePlayer(id, 'e'.repeat(64)); await store.addDeviceTicket(id, 'f'.repeat(64));
    await store.getAccount(id); await store.mutateWallet(id, '9'.repeat(32), () => ({ changed: false, result: { accepted: false } })); await store.getProgress(id, {});
  }
  await store.mutateRoom('ERASE', { lots: [], chat: [] }, (state) => {
    state.lots = [{ by: 'erase-one', n: 'A' }, { by: 'someone', n: 'B' }, { by: 'erase-two', n: 'C' }];
    state.chat = [{ k: 'p', id: 'erase-two', n: 'C', i: 0 }, { k: 'p', id: 'someone', n: 'B', i: 1 }];
    return { changed: true };
  });
  assert.equal(await store.eraseFamily('ERAS2345', () => ({ erase: false, result: 'kept' })), 'kept');
  assert.ok(pool.families.has('ERAS2345'), 'a refused erase keeps the family');
  const callsBefore = pool.calls.length;
  assert.deepEqual(await store.eraseFamily('ERAS2345', (family) => ({ erase: true, result: family.members.length })), 2);
  const eraseCalls = pool.calls.slice(callsBefore);
  assert.equal(eraseCalls[0], 'BEGIN'); assert.equal(eraseCalls.at(-1), 'COMMIT');
  assert.equal(eraseCalls.filter((sql) => sql === 'BEGIN').length, 1, 'the erase is one transaction');
  assert.ok(!pool.families.has('ERAS2345'));
  for (const map of [pool.identities, pool.wallets, pool.progress, pool.deviceTickets]) assert.ok(!map.has('erase-one') && !map.has('erase-two'));
  assert.ok(![...pool.walletOperations.keys()].some((key) => key.startsWith('erase-')), 'wallet operations are erased');
  assert.ok(pool.identities.has('identity-player') && pool.wallets.has('identity-player'), 'other players are kept');
  assert.deepEqual(dbState.get('ERASE').lots, [null, { by: 'someone', n: 'B' }, null], 'their gers are freed');
  assert.deepEqual(dbState.get('ERASE').chat, [{ k: 'p', id: 'someone', n: 'B', i: 1 }], 'their chat lines are dropped');
  assert.equal(await store.eraseFamily('ERAS2345', (family) => ({ erase: false, result: family })), null, 'a second erase finds no family');
  assert.deepEqual(pool.notifications.at(-1).payload, { t: 'family-erased', ids: ['erase-one', 'erase-two'] }, 'every instance is told which children were erased');
  assert.equal(await store.authenticatePlayer('erase-one', 'e'.repeat(64)), false, 'an erased id is not taken again with its old ticket');
  assert.equal(await store.authenticatePlayer('erase-two', '9'.repeat(64)), false, 'nor with a new one');
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
  assert.equal(typeof failingPool.handlers.error, 'function', 'the pool has an error listener so an idle-client error cannot crash the server');
  assert.doesNotThrow(() => failingPool.handlers.error(new Error('idle client lost')), 'a pool error is logged, not thrown');

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
  const jsonMatchReward = await jsonStore.mutateWallet('json-player', 'wrestle:w-match-0001', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 25, xp: wallet.xp + 30 }, result: { accepted: true },
  }));
  assert.deepEqual(jsonMatchReward.wallet, { coins: 145, xp: 60, revision: 3 }, 'JSON mode stores server-validated match rewards');
  const jsonActivityReward = await jsonStore.mutateWallet('json-player', 'activity:2026-10-26:rest', (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 5, xp: wallet.xp + 10 }, result: { accepted: true },
  }));
  assert.deepEqual(jsonActivityReward.wallet, { coins: 150, xp: 70, revision: 4 }, 'JSON mode stores daily activity rewards');
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
  const jsonMatchReplay = await restartedJsonStore.mutateWallet('json-player', 'wrestle:w-match-0001', () => {
    throw new Error('wrestling reward was applied twice');
  });
  assert.equal(jsonMatchReplay.duplicate, true, 'JSON match rewards remain idempotent after restart');
  const jsonActivityReplay = await restartedJsonStore.mutateWallet('json-player', 'activity:2026-10-26:rest', () => {
    throw new Error('daily activity reward was applied twice');
  });
  assert.equal(jsonActivityReplay.duplicate, true, 'JSON daily activity rewards remain idempotent after restart');
  await jsonStore.mutateWallet('json-player', '6'.repeat(32), (wallet) => ({
    changed: true, wallet: { ...wallet, coins: wallet.coins + 7 }, earned: { d: '2026-10-27', coins: 7, xp: 0 }, result: { accepted: true },
  }));
  await restartedJsonStore.mutateWallet('json-player', '7'.repeat(32), (wallet, inventory, earned) => {
    assert.deepEqual(earned, { d: '2026-10-27', coins: 7, xp: 0 }, 'JSON mode keeps the daily earned tally across a restart');
    return { changed: false, result: { accepted: true } };
  });
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
