'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOM_CODE = /^[A-Z0-9]{3,8}$/;

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
      async load() {
        return readLegacyFile(dataFile);
      },
      async save(rooms) {
        fs.mkdirSync(dataDir, { recursive: true });
        const temporaryFile = `${dataFile}.tmp`;
        fs.writeFileSync(temporaryFile, JSON.stringify(rooms));
        fs.renameSync(temporaryFile, dataFile);
      },
      async close() {},
    };
  }

  const Pool = PoolOverride || require('pg').Pool;
  const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5000 });

  return {
    kind: 'postgres',
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
    async close() {
      await pool.end();
    },
  };
}

module.exports = { createRoomStore };
