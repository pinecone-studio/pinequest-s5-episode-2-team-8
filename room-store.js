'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOM_CODE = /^[A-Z0-9]{3,8}$/;
const REALTIME_CHANNEL = 'naadamy_realtime';

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

function readLegacyFile(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('room data must be a JSON object');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Could not read room data from ${file}: ${error.message}`, { cause: error });
  }
}

function createRoomStore({ dataDir, databaseUrl = readDatabaseUrl(), Pool: PoolOverride } = {}) {
  const dataFile = path.join(dataDir, 'rooms.json');

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
             ON CONFLICT (code) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
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
