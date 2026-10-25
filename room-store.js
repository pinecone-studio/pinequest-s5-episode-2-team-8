'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOM_CODE = /^[A-Z0-9]{3,8}$/;
const PLAYER_ID = /^[\w-]{4,24}$/;
const PLAYER_TICKET = /^[a-f0-9]{64}$/i;
const WALLET_MAX = 2_000_000_000;
const REALTIME_CHANNEL = 'naadamy_realtime';

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
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
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

function createRoomStore({ dataDir, databaseUrl = readDatabaseUrl(), Pool: PoolOverride } = {}) {
  const dataFile = path.join(dataDir, 'rooms.json');
  const identityFile = path.join(dataDir, 'identities.json');
  const walletFile = path.join(dataDir, 'wallets.json');

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
        if (Object.hasOwn(identities, id)) return sameTicketHash(identities[id], ticket);
        Object.defineProperty(identities, id, { value: digest, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(identityFile, identities);
        return true;
      },
      async getWallet(id, initial = {}) {
        if (!PLAYER_ID.test(id || '')) throw new Error('Invalid player id for wallet');
        const wallets = readLegacyFile(walletFile, 'player wallets');
        if (Object.hasOwn(wallets, id)) return cleanWallet(wallets[id]);
        const wallet = initialWallet(initial);
        Object.defineProperty(wallets, id, { value: { ...wallet, operations: {} }, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(walletFile, wallets);
        return wallet;
      },
      async mutateWallet(id, operation, mutate) {
        if (!PLAYER_ID.test(id || '') || !/^[a-f0-9]{32}$/i.test(operation || '')) throw new Error('Invalid player wallet operation');
        const wallets = readLegacyFile(walletFile, 'player wallets');
        const stored = Object.hasOwn(wallets, id) ? wallets[id] : { ...initialWallet({}), operations: {} };
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)
          || !stored.operations || typeof stored.operations !== 'object' || Array.isArray(stored.operations)) {
          throw new Error('Invalid stored player wallet operations');
        }
        if (Object.hasOwn(stored.operations, operation)) {
          return { wallet: cleanWallet(stored), result: stored.operations[operation], duplicate: true };
        }
        const outcome = mutate(cleanWallet(stored));
        const current = cleanWallet(stored);
        const wallet = {
          ...cleanWallet(outcome && outcome.changed ? { ...outcome.wallet, revision: current.revision + 1 } : stored),
          operations: stored.operations,
        };
        const result = outcome && outcome.result ? outcome.result : { accepted: false };
        wallet.operations[operation] = result;
        const oldOperations = Object.keys(wallet.operations);
        for (const old of oldOperations.slice(0, Math.max(0, oldOperations.length - 200))) delete wallet.operations[old];
        Object.defineProperty(wallets, id, { value: wallet, writable: true, configurable: true, enumerable: true });
        writeIdentityFile(walletFile, wallets);
        return { wallet: cleanWallet(wallet), result, duplicate: false };
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
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS naadamy_wallet_ops (
            player_id text NOT NULL,
            operation_id text NOT NULL,
            result jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (player_id, operation_id)
          )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS naadamy_players_room_idx ON naadamy_players (room_code)');
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
        const inserted = await client.query(
          'INSERT INTO naadamy_identities (id, ticket_hash) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
          [id, digest],
        );
        if (inserted.rows.length) return true;
        const existing = await client.query('SELECT ticket_hash FROM naadamy_identities WHERE id = $1', [id]);
        return Boolean(existing.rows[0] && sameTicketHash(existing.rows[0].ticket_hash, ticket));
      } catch (error) {
        throw new Error(`Could not authenticate player identity: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async getWallet(id, initial = {}) {
      if (!PLAYER_ID.test(id || '')) throw new Error('Invalid player id for wallet');
      const wallet = initialWallet(initial);
      const client = await pool.connect();
      try {
        await client.query(
          'INSERT INTO naadamy_wallets (id, coins, xp) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [id, wallet.coins, wallet.xp],
        );
        const selected = await client.query('SELECT coins, xp, revision FROM naadamy_wallets WHERE id = $1', [id]);
        if (!selected.rows[0]) throw new Error('wallet record was not created');
        return cleanWallet(selected.rows[0]);
      } catch (error) {
        throw new Error(`Could not load player wallet: ${error.message}`, { cause: error });
      } finally {
        client.release();
      }
    },
    async mutateWallet(id, operation, mutate) {
      if (!PLAYER_ID.test(id || '') || !/^[a-f0-9]{32}$/i.test(operation || '')) throw new Error('Invalid player wallet operation');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const selected = await client.query('SELECT coins, xp, revision FROM naadamy_wallets WHERE id = $1 FOR UPDATE', [id]);
        if (!selected.rows[0]) throw new Error('wallet record does not exist');
        const previous = cleanWallet(selected.rows[0]);
        const priorOperation = await client.query(
          'SELECT result FROM naadamy_wallet_ops WHERE player_id = $1 AND operation_id = $2',
          [id, operation],
        );
        if (priorOperation.rows[0]) {
          await client.query('COMMIT');
          return { wallet: previous, result: priorOperation.rows[0].result, duplicate: true };
        }
        const outcome = mutate(previous);
        if (!outcome || !outcome.changed) {
          const result = outcome || { accepted: false };
          await client.query(
            'INSERT INTO naadamy_wallet_ops (player_id, operation_id, result) VALUES ($1, $2, $3::jsonb)',
            [id, operation, JSON.stringify(result)],
          );
          await client.query('COMMIT');
          return { wallet: previous, result, duplicate: false };
        }
        const wallet = cleanWallet({ ...outcome.wallet, revision: previous.revision + 1 });
        await client.query(
          'UPDATE naadamy_wallets SET coins = $2, xp = $3, revision = $4, updated_at = now() WHERE id = $1',
          [id, wallet.coins, wallet.xp, wallet.revision],
        );
        await client.query(
          'INSERT INTO naadamy_wallet_ops (player_id, operation_id, result) VALUES ($1, $2, $3::jsonb)',
          [id, operation, JSON.stringify(outcome.result)],
        );
        await client.query('COMMIT');
        return { wallet, result: outcome.result, duplicate: false };
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
        for (const [code, state] of Object.entries(rooms)) {
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
      await pool.end();
    },
  };
}

module.exports = { createRoomStore };
