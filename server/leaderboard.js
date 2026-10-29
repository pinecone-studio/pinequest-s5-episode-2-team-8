'use strict';
/* XP leaderboards for a joined player (WebSocket `board`, see docs/PROTOCOL.md): `room` = the players who joined this room
   in the last 30 days (top 10 and the asker), `family` = the children of the asker's family. Rows carry only rank, name,
   look (room) or mascot (family), XP and `me`: never ids or codes. Each answer is kept 30 s, so asking again costs no query. */

const CACHE_MS = 30_000;
const CACHE_MAX = 5000;

module.exports = function createLeaderboard(roomStore, { now = () => Date.now() } = {}) {
  const cache = new Map(); // 'room:CODE:id' | 'family:id' → { at, rows: Promise }

  function cached(key, load) {
    const t = now(), hit = cache.get(key);
    if (hit && t - hit.at < CACHE_MS) return hit.rows;
    cache.delete(key);
    if (cache.size >= CACHE_MAX) for (const [k, v] of cache) if (t - v.at >= CACHE_MS) cache.delete(k);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // the oldest
    const rows = load();
    cache.set(key, { at: t, rows });
    rows.catch(() => { if (cache.get(key) && cache.get(key).rows === rows) cache.delete(key); }); // a failed read is not kept
    return rows;
  }

  /** The `board` answer for player `id` in room `roomCode`: { t: 'board', k, rows } or with `reason`. Never rejects. */
  async function reply(id, roomCode, k) {
    if (k !== 'room' && k !== 'family') return { t: 'board', k: String(k).slice(0, 8), rows: [], reason: 'invalid' };
    try {
      const rows = k === 'room'
        ? await cached(`room:${roomCode}:${id}`, () => roomStore.roomBoard(roomCode, id))
        : await cached(`family:${id}`, () => roomStore.familyBoard(id));
      return rows ? { t: 'board', k, rows } : { t: 'board', k, rows: [], reason: 'no-family' };
    } catch (error) {
      console.error('Could not read the leaderboard:', error.message);
      return { t: 'board', k, rows: [], reason: 'storage' };
    }
  }

  // clear: a family was erased, its children must leave every board now; forget: these children's family changed
  return { reply, clear: () => cache.clear(), forget: (ids) => { for (const id of ids) cache.delete(`family:${id}`); } };
};
