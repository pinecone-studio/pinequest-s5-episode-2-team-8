'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const R = require('../web/js/village/rules.js');

const ROOM_CODE = /^[A-Z0-9]{3,8}$/;
const PLAYER_ID = /^[\w-]{4,24}$/;
const PLAYER_TICKET = /^[a-f0-9]{64}$/i;
const WALLET_OPERATION = /^(?:[a-f0-9]{32}|(?:quest|activity):\d{4}-\d{2}-\d{2}:[a-z]{1,16}|wrestle:[\w-]{1,64})$/i;
const WALLET_MAX = 2_000_000_000;
const REALTIME_CHANNEL = 'naadamy_realtime';
const FAMILY_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const DEVICE_TICKETS_MAX = 8;

function ticketHash(ticket) {
  return crypto.createHash('sha256').update(ticket).digest('hex');
}

function sameTicketHash(expected, actual) {
  if (!/^[a-f0-9]{64}$/i.test(expected || '') || !PLAYER_TICKET.test(actual || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(ticketHash(actual), 'hex'));
}

function readDatabaseUrl() {
  if (Object.hasOwn(process.env, 'DATABASE_URL')) return process.env.DATABASE_URL;
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
      const match = /^\s*DATABASE_URL\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !line.trim().startsWith('#')) return match[1].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Could not read DATABASE_URL from .env: ${error.message}`, { cause: error });
  }
  return '';
}

function readLegacyFile(file, label = 'room data') {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${label} must be a JSON object`);
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Could not read ${label} from ${file}: ${error.message}`, { cause: error });
  }
}

function readIdentityFile(file) {
  let identities;
  try {
    identities = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Could not read player identities from ${file}: ${error.message}`, { cause: error });
  }
  if (!identities || typeof identities !== 'object' || Array.isArray(identities)) {
    throw new Error(`Could not read player identities from ${file}: expected an object`);
  }
  for (const [id, hash] of Object.entries(identities)) {
    if (!PLAYER_ID.test(id) || !/^[a-f0-9]{64}$/i.test(hash)) {
      throw new Error(`Could not read player identities from ${file}: invalid identity record`);
    }
  }
  return identities;
}

function writeIdentityFile(file, identities) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(identities), { mode: 0o600 });
  fs.renameSync(temporaryFile, file);
}

/** A family as stored: its children, each with a hashed picture password and the count of wrong tries, and the grown-up
 *  PIN (scrypt hash and salt) with its recovery code (hash and salt), and their counters (PIN_COUNTS).
 *  A family made before the PIN has neither. */
function cleanFamily(family) {
  if (!isRecord(family) || !Array.isArray(family.members)) throw new Error('Invalid stored family');
  const count = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);
  const pin = /^[a-f0-9]{64}$/.test(family.pinHash || '') && /^[a-f0-9]{32}$/.test(family.pinSalt || '');
  const recovery = /^[a-f0-9]{64}$/.test(family.recoveryHash || '') && /^[a-f0-9]{32}$/.test(family.recoverySalt || '');
  return {
    members: family.members.filter((member) => isRecord(member) && PLAYER_ID.test(member.id || '')),
    pinHash: pin ? family.pinHash : '', pinSalt: pin ? family.pinSalt : '',
    recoveryHash: recovery ? family.recoveryHash : '', recoverySalt: recovery ? family.recoverySalt : '',
    ...Object.fromEntries(PIN_COUNTS.map((key) => [key, count(family[key])])),
  };
}
// the wrong tries, lock end, lock count and last wrong try of the PIN, of joining with it and of the recovery code; when
// the first PIN was set on a family made before the PIN
const PIN_COUNTS = ['pin', 'join', 'rec'].flatMap((c) => [c + 'Fails', c + 'Until', c + 'Locks', c + 'WrongAt']).concat('pinSetAt');
const pinOf = (family) => ({ pinHash: family.pinHash, pinSalt: family.pinSalt, recoveryHash: family.recoveryHash, recoverySalt: family.recoverySalt,
  ...Object.fromEntries(PIN_COUNTS.map((key) => [key, family[key]])) });
const ERASED_KEEP_MS = 30 * 24 * 60 * 60 * 1000; // an erased child's id can't be taken again for 30 days: an old device can't bring it back

/** Takes erased players out of a room's state ({ lots, chat }, changed in place): their ger lots are freed and the chat
 *  lines they wrote (each line carries the writer's id) are dropped. Returns the freed lot indexes and whether anything changed. */
function scrubRoom(state, ids) {
  const freed = [];
  if (Array.isArray(state.lots)) state.lots.forEach((lot, i) => { if (lot && ids.has(lot.by)) { state.lots[i] = null; freed.push(i); } });
  const chat = Array.isArray(state.chat) ? state.chat.filter((line) => !(line && ids.has(line.id))) : null;
  const dropped = chat ? state.chat.length - chat.length : 0;
  if (chat) state.chat = chat;
  return { freed, changed: freed.length > 0 || dropped > 0 };
}

function cleanWallet(wallet) {
  if (!wallet || typeof wallet !== 'object' || Array.isArray(wallet)) throw new Error('Invalid stored player wallet');
  const coins = Number(wallet && wallet.coins), xp = Number(wallet && wallet.xp);
  const revision = Number(wallet && wallet.revision);
  if (!Number.isSafeInteger(coins) || coins < 0 || coins > WALLET_MAX
    || !Number.isSafeInteger(xp) || xp < 0 || xp > WALLET_MAX
    || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid stored player wallet');
  return { coins, xp, revision };
}

function initialWallet(wallet) {
  const integer = (value, fallback) => Number.isSafeInteger(value) ? Math.max(0, Math.min(WALLET_MAX, value)) : fallback;
  return { coins: integer(wallet && wallet.coins, 40), xp: integer(wallet && wallet.xp, 0), revision: 0 };
}

function cleanInventory(inventory) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)
    || !Array.isArray(inventory.owned) || !Number.isInteger(inventory.rod) || inventory.rod < 1 || inventory.rod > 2) {
    throw new Error('Invalid stored player inventory');
  }
  const allowed = new Set(R.ITEMS.filter((item) => item.cat !== 'tool').map((item) => item.id));
  const owned = [...new Set(inventory.owned.filter((id) => typeof id === 'string' && allowed.has(id)))];
  if (!owned.includes('deel-blue')) owned.unshift('deel-blue');
  return { owned: owned.slice(0, allowed.size), rod: inventory.rod };
}

function initialInventory(inventory) {
  const seed = inventory && typeof inventory === 'object' && !Array.isArray(inventory) ? inventory : {};
  const owned = Array.isArray(seed.owned) ? seed.owned.slice(0, R.ITEMS.length) : [];
  const rod = Number.isInteger(seed.rod) ? Math.max(1, Math.min(2, seed.rod)) : 1;
  return cleanInventory({ owned, rod });
}

/** How much this player's devices have added to the account today ({ d: Mongolia day, coins, xp }), for the daily earn cap. */
function cleanEarned(earned) {
  const count = (value) => Number.isSafeInteger(value) && value > 0 ? Math.min(WALLET_MAX, value) : 0;
  if (!earned || typeof earned !== 'object' || Array.isArray(earned) || !/^\d{4}-\d{2}-\d{2}$/.test(earned.d || '')) return { d: '', coins: 0, xp: 0 };
  return { d: earned.d, coins: count(earned.coins), xp: count(earned.xp) };
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanProgressRecord(record) {
  if (!isRecord(record) || !Number.isSafeInteger(record.revision) || record.revision < 0 || !isRecord(record.state)) {
    throw new Error('Invalid stored player progress');
  }
  return { revision: record.revision, state: record.state };
}

function createRoomStore({ dataDir, databaseUrl = readDatabaseUrl(), Pool: PoolOverride } = {}) {
  const dataFile = path.join(dataDir, 'rooms.json');
  const identityFile = path.join(dataDir, 'identities.json');
  const walletFile = path.join(dataDir, 'wallets.json');
  const progressFile = path.join(dataDir, 'progress.json');
  const familyFile = path.join(dataDir, 'families.json');
  const deviceTicketFile = path.join(dataDir, 'device-tickets.json');
  const erasedFile = path.join(dataDir, 'erased.json');

  if (!databaseUrl) {
    return {
      kind: 'json',
      sharedRealtime: false,
      async load() {
        return readLegacyFile(dataFile);
      },
      async save(rooms) {
        fs.mkdirSync(dataDir, { recursive: true });
        const temporaryFile = `${dataFile}.tmp`;
        fs.writeFileSync(temporaryFile, JSON.stringify(rooms));
        fs.renameSync(temporaryFile, dataFile);
      },
      async getRoomState() { return null; },
      async authenticatePlayer(id, ticket) {
        if (!PLAYER_ID.test(id || '') || !PLAYER_TICKET.test(ticket || '')) return false;
        const identities = readIdentityFile(identityFile);
        const digest = ticketHash(ticket);
        if (Object.hasOwn(identities, id)) {
          if (sameTicketHash(identities[id], ticket)) return true;
          const devices = readLegacyFile(deviceTicketFile, 'device tickets');
          return Object.hasOwn(devices, id) && Array.isArray(devices[id]) && devices[id].some((hash) => sameTicketHash(hash, ticket));
        }
        const erased = readLegacyFile(erasedFile, 'erased players');
        if (Object.hasOwn(erased, id) && Date.now() - erased[id] < ERASED_KEEP_MS) return false;
        Object.defineProperty(identities, id, { value: digest, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(identityFile, identities);
        return true;
      },
      /** Was this id erased with its family lately (so authenticatePlayer refuses it)? For the reason given to the device. */
      async isErased(id) {
        const erased = readLegacyFile(erasedFile, 'erased players');
        return PLAYER_ID.test(id || '') && Object.hasOwn(erased, id) && Date.now() - erased[id] < ERASED_KEEP_MS;
      },
      async addDeviceTicket(id, ticket) {
        if (!PLAYER_ID.test(id || '') || !PLAYER_TICKET.test(ticket || '')) throw new Error('Invalid device ticket');
        const devices = readLegacyFile(deviceTicketFile, 'device tickets');
        const hashes = Object.hasOwn(devices, id) && Array.isArray(devices[id]) ? devices[id] : [];
        hashes.push(ticketHash(ticket));
        Object.defineProperty(devices, id, { value: hashes.slice(-DEVICE_TICKETS_MAX), writable: true, configurable: true, enumerable: true });
        writeIdentityFile(deviceTicketFile, devices);
      },
      async createFamily(code, member, pin = {}) {
        if (!FAMILY_CODE.test(code || '')) throw new Error('Invalid family code');
        const families = readLegacyFile(familyFile, 'families');
        if (Object.hasOwn(families, code)) return false;
        Object.defineProperty(families, code, { value: { members: [member], ...pin }, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(familyFile, families);
        return true;
      },
      async getFamily(code) {
        if (!FAMILY_CODE.test(code || '')) return null;
        const families = readLegacyFile(familyFile, 'families');
        return Object.hasOwn(families, code) ? cleanFamily(families[code]) : null;
      },
      /** mutate(family or null) returns { changed, result }; a changed family is saved. */
      async mutateFamily(code, mutate) {
        if (!FAMILY_CODE.test(code || '')) return mutate(null).result;
        const families = readLegacyFile(familyFile, 'families');
        const family = Object.hasOwn(families, code) ? cleanFamily(families[code]) : null;
        const outcome = mutate(family);
        if (family && outcome.changed) {
          if (family.members.length) Object.defineProperty(families, code, { value: family, writable: true, configurable: true, enumerable: true });
          else delete families[code]; // the last child left
          writeIdentityFile(familyFile, families);
        }
        return outcome.result;
      },
      /** decide(family or null) returns { erase, result }. Erasing removes the family and, for each of its children, the
       *  wallet (with its operations), cloud save, identity, device tickets, ger lots and chat lines. Every file is read
       *  before any is written, and the family goes last, so a failed write can be finished by asking again. */
      async eraseFamily(code, decide) {
        if (!FAMILY_CODE.test(code || '')) return decide(null).result;
        const families = readLegacyFile(familyFile, 'families');
        const family = Object.hasOwn(families, code) ? cleanFamily(families[code]) : null;
        const outcome = decide(family);
        if (!family || !outcome.erase) return outcome.result;
        const ids = new Set(family.members.map((member) => member.id));
        const wallets = readLegacyFile(walletFile, 'player wallets'), progress = readLegacyFile(progressFile, 'player progress');
        const identities = readIdentityFile(identityFile), devices = readLegacyFile(deviceTicketFile, 'device tickets'), rooms = readLegacyFile(dataFile);
        const erased = readLegacyFile(erasedFile, 'erased players'), at = Date.now();
        for (const [id, when] of Object.entries(erased)) if (!(at - when < ERASED_KEEP_MS)) delete erased[id];
        for (const id of ids) Object.defineProperty(erased, id, { value: at, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(erasedFile, erased); // first: no device can take an erased id again, even if a later write fails
        for (const records of [wallets, progress, identities, devices]) for (const id of ids) delete records[id];
        let roomsChanged = false;
        for (const state of Object.values(rooms)) if (isRecord(state) && scrubRoom(state, ids).changed) roomsChanged = true;
        writeIdentityFile(walletFile, wallets); writeIdentityFile(progressFile, progress);
        writeIdentityFile(identityFile, identities); writeIdentityFile(deviceTicketFile, devices);
        if (roomsChanged) {
          const temporaryFile = `${dataFile}.tmp`;
          fs.writeFileSync(temporaryFile, JSON.stringify(rooms));
          fs.renameSync(temporaryFile, dataFile);
        }
        delete families[code];
        writeIdentityFile(familyFile, families);
        return outcome.result;
      },
      async getAccount(id, initial = {}, inventorySeed = {}) {
        if (!PLAYER_ID.test(id || '')) throw new Error('Invalid player id for wallet');
        const wallets = readLegacyFile(walletFile, 'player wallets');
        const stored = Object.hasOwn(wallets, id) ? wallets[id] : null;
        if (stored && (!stored.operations || typeof stored.operations !== 'object' || Array.isArray(stored.operations))) {
          throw new Error('Invalid stored player wallet operations');
        }
        const wallet = stored ? cleanWallet(stored) : initialWallet(initial);
        const migrated = stored && !stored.inventory;
        const inventory = migrated ? initialInventory(inventorySeed) : stored ? cleanInventory(stored.inventory) : initialInventory(inventorySeed);
        if (stored) stored.inventory = inventory;
        else Object.defineProperty(wallets, id, { value: { ...wallet, inventory, operations: {} }, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(walletFile, wallets);
        return { wallet, inventory };
      },
      async getWallet(id, initial = {}) {
        return (await this.getAccount(id, initial)).wallet;
      },
      async mutateWallet(id, operation, mutate) {
        if (!PLAYER_ID.test(id || '') || !WALLET_OPERATION.test(operation || '')) throw new Error('Invalid player wallet operation');
        const wallets = readLegacyFile(walletFile, 'player wallets');
        const stored = Object.hasOwn(wallets, id) ? wallets[id] : { ...initialWallet({}), inventory: initialInventory({}), operations: {} };
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)
          || !stored.operations || typeof stored.operations !== 'object' || Array.isArray(stored.operations)) {
          throw new Error('Invalid stored player wallet operations');
        }
        const inventory = stored.inventory ? cleanInventory(stored.inventory) : initialInventory({});
        if (Object.hasOwn(stored.operations, operation)) {
          return { wallet: cleanWallet(stored), inventory, result: stored.operations[operation], duplicate: true };
        }
        const earned = cleanEarned(stored.earned);
        const outcome = mutate(cleanWallet(stored), inventory, earned);
        const current = cleanWallet(stored);
        const wallet = {
          ...cleanWallet(outcome && outcome.changed ? { ...outcome.wallet, revision: current.revision + 1 } : stored),
          operations: stored.operations,
        };
        wallet.inventory = outcome && outcome.changed && outcome.inventory ? cleanInventory(outcome.inventory) : inventory;
        wallet.earned = outcome && outcome.changed && outcome.earned ? cleanEarned(outcome.earned) : earned;
        const result = outcome && outcome.result ? outcome.result : { accepted: false };
        wallet.operations[operation] = result;
        const oldOperations = Object.keys(wallet.operations).filter((key) => !key.startsWith('quest:') && !key.startsWith('activity:') && !key.startsWith('wrestle:'));
        for (const old of oldOperations.slice(0, Math.max(0, oldOperations.length - 200))) delete wallet.operations[old];
        Object.defineProperty(wallets, id, { value: wallet, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(walletFile, wallets);
        return { wallet: cleanWallet(wallet), inventory: wallet.inventory, result, duplicate: false };
      },
      async getProgress(id, initial = {}) {
        if (!PLAYER_ID.test(id || '')) throw new Error('Invalid player id for progress');
        const records = readLegacyFile(progressFile, 'player progress');
        if (Object.hasOwn(records, id)) return cleanProgressRecord(records[id]);
        const record = { revision: 0, state: initial };
        Object.defineProperty(records, id, { value: record, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(progressFile, records);
        return record;
      },
      async saveProgress(id, revision, state) {
        if (!PLAYER_ID.test(id || '') || !Number.isSafeInteger(revision) || revision < 0 || !isRecord(state)) {
          throw new Error('Invalid player progress update');
        }
        const records = readLegacyFile(progressFile, 'player progress');
        const current = Object.hasOwn(records, id) ? cleanProgressRecord(records[id]) : { revision: 0, state: {} };
        if (current.revision !== revision) return { accepted: false, ...current };
        const record = { revision: revision + 1, state };
        Object.defineProperty(records, id, { value: record, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(progressFile, records);
        return { accepted: true, ...record };
      },
      async mutateRoom(roomCode, initialState, mutate, instanceId) {
        const rooms = readLegacyFile(dataFile);
        const state = rooms[roomCode] || { ...initialState };
        const result = mutate(state);
        if (result && result.changed) {
          rooms[roomCode] = state;
          fs.mkdirSync(dataDir, { recursive: true });
          const temporaryFile = `${dataFile}.tmp`;
          fs.writeFileSync(temporaryFile, JSON.stringify(rooms));
          fs.renameSync(temporaryFile, dataFile);
        }
        return { state, result };
      },
      async startRealtime() {},
      async listPresence() { return []; },
      async registerPresence() { return null; },
      async updatePresence() {},
      async removePresence() {},
      async refreshPresence() { return []; },
      async close() {},
    };
  }

  const Pool = PoolOverride || require('pg').Pool;
  const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5000 });
  pool.on('error', (error) => console.error('PostgreSQL pool error:', error.message)); // an idle client dropping must not crash the server
  let subscriber = null;

  return {
    kind: 'postgres',
    sharedRealtime: true,
    async load() {
      const legacy = readLegacyFile(dataFile);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_rooms (
            code text PRIMARY KEY,
            state jsonb NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_players (
            id text PRIMARY KEY,
            room_code text NOT NULL,
            instance_id text NOT NULL,
            state jsonb NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_identities (
            id text PRIMARY KEY,
            ticket_hash text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_wallets (
            id text PRIMARY KEY,
            coins bigint NOT NULL CHECK (coins >= 0),
            xp bigint NOT NULL CHECK (xp >= 0),
            revision bigint NOT NULL DEFAULT 0,
            inventory jsonb NOT NULL DEFAULT '{"owned":["deel-blue"],"rod":1}'::jsonb,
            inventory_migrated boolean NOT NULL DEFAULT false,
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`ALTER TABLE naadamy_wallets ADD COLUMN IF NOT EXISTS inventory jsonb NOT NULL DEFAULT '{"owned":["deel-blue"],"rod":1}'::jsonb`);
        await client.query('ALTER TABLE naadamy_wallets ADD COLUMN IF NOT EXISTS inventory_migrated boolean NOT NULL DEFAULT false');
        await client.query(`ALTER TABLE naadamy_wallets ADD COLUMN IF NOT EXISTS earned jsonb NOT NULL DEFAULT '{}'::jsonb`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_wallet_ops (
            player_id text NOT NULL,
            operation_id text NOT NULL,
            result jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (player_id, operation_id)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_player_progress (
            player_id text PRIMARY KEY,
            revision bigint NOT NULL DEFAULT 0,
            state jsonb NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_player_tickets (
            player_id text NOT NULL,
            ticket_hash text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (player_id, ticket_hash)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_families (
            code text PRIMARY KEY,
            members jsonb NOT NULL DEFAULT '[]'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`ALTER TABLE naadamy_families ADD COLUMN IF NOT EXISTS pin jsonb NOT NULL DEFAULT '{}'::jsonb`); // the grown-up PIN
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_erased (
            id text PRIMARY KEY,
            erased_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS naadamy_players_room_idx ON naadamy_players (room_code)');
        // Supabase serves every public table over its REST API to anyone with the project's anon key. Row level security with
        // no policies closes that door; the server connects as the tables' owner, which RLS does not apply to.
        for (const table of ['naadamy_rooms', 'naadamy_players', 'naadamy_identities', 'naadamy_wallets', 'naadamy_wallet_ops', 'naadamy_player_progress',
          'naadamy_player_tickets', 'naadamy_families', 'naadamy_erased']) {
          await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        }
        for (const [code, state] of Object.entries(legacy)) {
          if (!ROOM_CODE.test(code)) continue;
          await client.query(
            'INSERT INTO naadamy_rooms (code, state) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING',
            [code, JSON.stringify(state)],
          );
        }
        const result = await client.query('SELECT code, state FROM naadamy_rooms');
        await client.query('COMMIT');
        return Object.fromEntries(result.rows.map(({ code, state }) => [code, state]));
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back room database initialization:', rollbackError.message);
        }
        throw new Error(`Could not load room data from PostgreSQL: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async startRealtime(instanceId, onEvent) {
      subscriber = await pool.connect();
      subscriber.on('error', (error) => console.error('PostgreSQL realtime listener error:', error.message));
      subscriber.on('notification', (notification) => {
        if (notification.channel !== REALTIME_CHANNEL) return;
        try {
          const event = JSON.parse(notification.payload);
          if (event.instanceId !== instanceId) onEvent(event);
        } catch (error) {
          console.error('Could not process PostgreSQL realtime event:', error.message);
        }
      });
      await subscriber.query(`LISTEN ${REALTIME_CHANNEL}`);
    },
    async getRoomState(roomCode) {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT state FROM naadamy_rooms WHERE code = $1', [roomCode]);
        return result.rows[0] ? result.rows[0].state : null;
      } finally {
        client.release();
      }
    },
    async authenticatePlayer(id, ticket) {
      if (!PLAYER_ID.test(id || '') || !PLAYER_TICKET.test(ticket || '')) return false;
      const digest = ticketHash(ticket);
      const client = await pool.connect();
      try {
        // an erased child's id is not taken again on first sight (an old device must not bring the account back)
        const inserted = await client.query(
          `INSERT INTO naadamy_identities (id, ticket_hash) SELECT $1, $2
           WHERE NOT EXISTS (SELECT 1 FROM naadamy_erased WHERE id = $1 AND erased_at > now() - interval '30 days')
           ON CONFLICT (id) DO NOTHING RETURNING id`,
          [id, digest],
        );
        if (inserted.rows.length) return true;
        const existing = await client.query('SELECT ticket_hash FROM naadamy_identities WHERE id = $1', [id]);
        if (!existing.rows[0]) return false;
        if (sameTicketHash(existing.rows[0].ticket_hash, ticket)) return true;
        // another device this player logged in on with the family code
        const device = await client.query('SELECT 1 FROM naadamy_player_tickets WHERE player_id = $1 AND ticket_hash = $2', [id, digest]);
        return device.rows.length > 0;
      } catch (error) {
        throw new Error(`Could not authenticate player identity: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async isErased(id) {
      if (!PLAYER_ID.test(id || '')) return false;
      const result = await pool.query("SELECT 1 FROM naadamy_erased WHERE id = $1 AND erased_at > now() - interval '30 days'", [id]);
      return result.rows.length > 0;
    },
    async addDeviceTicket(id, ticket) {
      if (!PLAYER_ID.test(id || '') || !PLAYER_TICKET.test(ticket || '')) throw new Error('Invalid device ticket');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO naadamy_player_tickets (player_id, ticket_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, ticketHash(ticket)]);
        await client.query(
          `DELETE FROM naadamy_player_tickets WHERE player_id = $1 AND ticket_hash NOT IN (
             SELECT ticket_hash FROM naadamy_player_tickets WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2)`,
          [id, DEVICE_TICKETS_MAX],
        );
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Could not roll back device ticket:', rollbackError.message); }
        throw new Error(`Could not save device ticket: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async createFamily(code, member, pin = {}) {
      if (!FAMILY_CODE.test(code || '')) throw new Error('Invalid family code');
      const result = await pool.query(
        'INSERT INTO naadamy_families (code, members, pin) VALUES ($1, $2::jsonb, $3::jsonb) ON CONFLICT (code) DO NOTHING RETURNING code',
        [code, JSON.stringify([member]), JSON.stringify(pin)],
      );
      return result.rows.length > 0;
    },
    async getFamily(code) {
      if (!FAMILY_CODE.test(code || '')) return null;
      const result = await pool.query('SELECT members, pin FROM naadamy_families WHERE code = $1', [code]);
      return result.rows[0] ? cleanFamily({ ...result.rows[0].pin, members: result.rows[0].members }) : null;
    },
    async mutateFamily(code, mutate) {
      if (!FAMILY_CODE.test(code || '')) return mutate(null).result;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const row = await client.query('SELECT members, pin FROM naadamy_families WHERE code = $1 FOR UPDATE', [code]);
        const family = row.rows[0] ? cleanFamily({ ...row.rows[0].pin, members: row.rows[0].members }) : null;
        const outcome = mutate(family);
        if (family && outcome.changed && family.members.length) {
          await client.query('UPDATE naadamy_families SET members = $2::jsonb, pin = $3::jsonb, updated_at = now() WHERE code = $1',
            [code, JSON.stringify(family.members), JSON.stringify(pinOf(family))]);
        } else if (family && outcome.changed) {
          await client.query('DELETE FROM naadamy_families WHERE code = $1', [code]); // the last child left
        }
        await client.query('COMMIT');
        return outcome.result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Could not roll back family change:', rollbackError.message); }
        throw new Error(`Could not save family: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    /** As in JSON mode, in one transaction: all of it goes, or nothing does. */
    async eraseFamily(code, decide) {
      if (!FAMILY_CODE.test(code || '')) return decide(null).result;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const row = await client.query('SELECT members, pin FROM naadamy_families WHERE code = $1 FOR UPDATE', [code]);
        const family = row.rows[0] ? cleanFamily({ ...row.rows[0].pin, members: row.rows[0].members }) : null;
        const outcome = decide(family);
        if (!family || !outcome.erase) {
          await client.query('COMMIT');
          return outcome.result;
        }
        const ids = family.members.map((member) => member.id), gone = new Set(ids);
        await client.query('DELETE FROM naadamy_families WHERE code = $1', [code]);
        await client.query('DELETE FROM naadamy_wallet_ops WHERE player_id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM naadamy_wallets WHERE id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM naadamy_player_progress WHERE player_id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM naadamy_player_tickets WHERE player_id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM naadamy_identities WHERE id = ANY($1::text[])', [ids]);
        await client.query('DELETE FROM naadamy_players WHERE id = ANY($1::text[])', [ids]);
        await client.query("DELETE FROM naadamy_erased WHERE erased_at < now() - interval '30 days'");
        await client.query(
          'INSERT INTO naadamy_erased (id) SELECT unnest($1::text[]) ON CONFLICT (id) DO UPDATE SET erased_at = now()', [ids]);
        // rooms in code order, as save() locks them, so the two never wait on each other
        const rooms = await client.query('SELECT code, state FROM naadamy_rooms ORDER BY code FOR UPDATE');
        for (const { code: room, state } of rooms.rows) {
          if (isRecord(state) && scrubRoom(state, gone).changed) {
            await client.query('UPDATE naadamy_rooms SET state = $2::jsonb, updated_at = now() WHERE code = $1', [room, JSON.stringify(state)]);
          }
        }
        // every server instance closes these children's sockets and drops them from its rooms (sent when this commits)
        await client.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify({ t: 'family-erased', ids })]);
        await client.query('COMMIT');
        return outcome.result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Could not roll back family erase:', rollbackError.message); }
        throw new Error(`Could not erase family: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async getAccount(id, initial = {}, inventorySeed = {}) {
      if (!PLAYER_ID.test(id || '')) throw new Error('Invalid player id for wallet');
      const wallet = initialWallet(initial);
      const inventory = initialInventory(inventorySeed);
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO naadamy_wallets (id, coins, xp, inventory, inventory_migrated) VALUES ($1, $2, $3, $4::jsonb, true) ON CONFLICT (id) DO NOTHING',
          [id, wallet.coins, wallet.xp, JSON.stringify(inventory)],
        );
        const migration = await client.query(
          'UPDATE naadamy_wallets SET inventory = $2::jsonb, inventory_migrated = true WHERE id = $1 AND inventory_migrated = false RETURNING inventory',
          [id, JSON.stringify(inventory)],
        );
        const selected = await client.query('SELECT coins, xp, revision, inventory FROM naadamy_wallets WHERE id = $1', [id]);
        if (!selected.rows[0]) throw new Error('wallet record was not created');
        const storedInventory = migration.rows[0] ? migration.rows[0].inventory : selected.rows[0].inventory;
        return { wallet: cleanWallet(selected.rows[0]), inventory: cleanInventory(storedInventory) };
      } catch (error) {
        throw new Error(`Could not load player wallet: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async getWallet(id, initial = {}) {
      return (await this.getAccount(id, initial)).wallet;
    },
    async mutateWallet(id, operation, mutate) {
      if (!PLAYER_ID.test(id || '') || !WALLET_OPERATION.test(operation || '')) throw new Error('Invalid player wallet operation');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const selected = await client.query('SELECT coins, xp, revision, inventory, earned FROM naadamy_wallets WHERE id = $1 FOR UPDATE', [id]);
        if (!selected.rows[0]) throw new Error('wallet record does not exist');
        const previous = cleanWallet(selected.rows[0]);
        const inventory = cleanInventory(selected.rows[0].inventory);
        const priorOperation = await client.query(
          'SELECT result FROM naadamy_wallet_ops WHERE player_id = $1 AND operation_id = $2',
          [id, operation],
        );
        if (priorOperation.rows[0]) {
          await client.query('COMMIT');
          return { wallet: previous, inventory, result: priorOperation.rows[0].result, duplicate: true };
        }
        const earned = cleanEarned(selected.rows[0].earned);
        const outcome = mutate(previous, inventory, earned);
        if (!outcome || !outcome.changed) {
          const result = outcome && outcome.result ? outcome.result : { accepted: false };
          await client.query(
            'INSERT INTO naadamy_wallet_ops (player_id, operation_id, result) VALUES ($1, $2, $3::jsonb)',
            [id, operation, JSON.stringify(result)],
          );
          await client.query('COMMIT');
          return { wallet: previous, inventory, result, duplicate: false };
        }
        const wallet = cleanWallet({ ...outcome.wallet, revision: previous.revision + 1 });
        const nextInventory = outcome.inventory ? cleanInventory(outcome.inventory) : inventory;
        const nextEarned = outcome.earned ? cleanEarned(outcome.earned) : earned;
        await client.query(
          'UPDATE naadamy_wallets SET coins = $2, xp = $3, revision = $4, inventory = $5::jsonb, earned = $6::jsonb, updated_at = now() WHERE id = $1',
          [id, wallet.coins, wallet.xp, wallet.revision, JSON.stringify(nextInventory), JSON.stringify(nextEarned)],
        );
        await client.query(
          'INSERT INTO naadamy_wallet_ops (player_id, operation_id, result) VALUES ($1, $2, $3::jsonb)',
          [id, operation, JSON.stringify(outcome.result)],
        );
        await client.query('COMMIT');
        return { wallet, inventory: nextInventory, result: outcome.result, duplicate: false };
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back player wallet update:', rollbackError.message);
        }
        throw new Error(`Could not update player wallet: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async getProgress(id, initial = {}) {
      if (!PLAYER_ID.test(id || '') || !isRecord(initial)) throw new Error('Invalid player progress seed');
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO naadamy_player_progress (player_id, revision, state) VALUES ($1, 0, $2::jsonb) ON CONFLICT (player_id) DO NOTHING',
          [id, JSON.stringify(initial)],
        );
        const selected = await client.query(
          'SELECT revision, state FROM naadamy_player_progress WHERE player_id = $1',
          [id],
        );
        if (!selected.rows[0]) throw new Error('player progress record was not created');
        return cleanProgressRecord({ revision: Number(selected.rows[0].revision), state: selected.rows[0].state });
      } catch (error) {
        throw new Error(`Could not load player progress: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async saveProgress(id, revision, state) {
      if (!PLAYER_ID.test(id || '') || !Number.isSafeInteger(revision) || revision < 0 || !isRecord(state)) {
        throw new Error('Invalid player progress update');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const selected = await client.query(
          'SELECT revision, state FROM naadamy_player_progress WHERE player_id = $1 FOR UPDATE',
          [id],
        );
        if (!selected.rows[0]) throw new Error('player progress record does not exist');
        const current = cleanProgressRecord({ revision: Number(selected.rows[0].revision), state: selected.rows[0].state });
        if (current.revision !== revision) {
          await client.query('COMMIT');
          return { accepted: false, ...current };
        }
        const updated = await client.query(
          'UPDATE naadamy_player_progress SET revision = $2, state = $3::jsonb, updated_at = now() WHERE player_id = $1 RETURNING revision, state',
          [id, revision + 1, JSON.stringify(state)],
        );
        await client.query('COMMIT');
        return { accepted: true, ...cleanProgressRecord({ revision: Number(updated.rows[0].revision), state: updated.rows[0].state }) };
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back player progress update:', rollbackError.message);
        }
        throw new Error(`Could not save player progress: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async mutateRoom(roomCode, initialState, mutate, instanceId) {
      if (!ROOM_CODE.test(roomCode)) throw new Error(`Invalid room code: ${roomCode}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO naadamy_rooms (code, state) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING',
          [roomCode, JSON.stringify(initialState)],
        );
        const selected = await client.query('SELECT state FROM naadamy_rooms WHERE code = $1 FOR UPDATE', [roomCode]);
        const state = selected.rows[0].state;
        const result = mutate(state);
        if (result && result.changed) {
          await client.query(
            'UPDATE naadamy_rooms SET state = $2::jsonb, updated_at = now() WHERE code = $1',
            [roomCode, JSON.stringify(state)],
          );
          for (const event of result.events || []) {
            const payload = JSON.stringify({ room: roomCode, instanceId, message: event });
            if (Buffer.byteLength(payload, 'utf8') > 7000) throw new Error('realtime event exceeds the PostgreSQL notification limit');
            await client.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, payload]);
          }
        }
        await client.query('COMMIT');
        return { state, result };
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back shared room update:', rollbackError.message);
        }
        throw new Error(`Could not update shared room ${roomCode}: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async publishRealtime(event) {
      const payload = JSON.stringify(event);
      if (Buffer.byteLength(payload, 'utf8') > 7000) throw new Error('realtime event exceeds the PostgreSQL notification limit');
      await pool.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, payload]);
    },
    async listPresence(roomCode) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT id, state FROM naadamy_players WHERE room_code = $1 AND updated_at >= now() - interval '60 seconds' ORDER BY updated_at",
          [roomCode],
        );
        return result.rows.map(({ id, state }) => ({ id, ...state }));
      } finally {
        client.release();
      }
    },
    async registerPresence(instanceId, roomCode, player) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [player.id]);
        const existing = await client.query('SELECT instance_id FROM naadamy_players WHERE id = $1 FOR UPDATE', [player.id]);
        await client.query(
          `INSERT INTO naadamy_players (id, room_code, instance_id, state, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, now())
           ON CONFLICT (id) DO UPDATE SET room_code = EXCLUDED.room_code,
             instance_id = EXCLUDED.instance_id, state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
          [player.id, roomCode, instanceId, JSON.stringify(player)],
        );
        await client.query('COMMIT');
        return existing.rows[0] ? existing.rows[0].instance_id : null;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back presence registration:', rollbackError.message);
        }
        throw new Error(`Could not register multiplayer presence: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async updatePresence(instanceId, player) {
      await pool.query(
        `UPDATE naadamy_players SET state = $3::jsonb, updated_at = now()
         WHERE id = $1 AND instance_id = $2`,
        [player.id, instanceId, JSON.stringify(player)],
      );
    },
    async removePresence(instanceId, playerId) {
      await pool.query('DELETE FROM naadamy_players WHERE id = $1 AND instance_id = $2', [playerId, instanceId]);
    },
    async refreshPresence(instanceId) {
      await pool.query('UPDATE naadamy_players SET updated_at = now() WHERE instance_id = $1', [instanceId]);
      const result = await pool.query(`
        DELETE FROM naadamy_players WHERE updated_at < now() - interval '60 seconds'
        RETURNING id, room_code
      `);
      return result.rows;
    },
    async save(rooms) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // always in the same order: two servers saving the same rooms in different orders would wait on each other (deadlock)
        for (const [code, state] of Object.entries(rooms).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
          if (!ROOM_CODE.test(code)) continue;
          await client.query(
            `INSERT INTO naadamy_rooms (code, state, updated_at)
             VALUES ($1, $2::jsonb, now())
             ON CONFLICT (code) DO UPDATE SET
               state = jsonb_set(naadamy_rooms.state, '{chat}', COALESCE(EXCLUDED.state -> 'chat', '[]'::jsonb), true),
               updated_at = EXCLUDED.updated_at`,
            [code, JSON.stringify(state)],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Could not roll back room data save:', rollbackError.message);
        }
        throw new Error(`Could not save room data to PostgreSQL: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async close(instanceId) {
      if (instanceId) await pool.query('DELETE FROM naadamy_players WHERE instance_id = $1', [instanceId]);
      // the LISTEN connection is checked out for the server's whole life; pool.end() waits forever unless it is given back
      if (subscriber) { subscriber.release(true); subscriber = null; }
      await pool.end();
    },
  };
}

module.exports = { createRoomStore, scrubRoom };
