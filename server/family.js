'use strict';
/* Family login: a parent makes a family code, the family's children are added to it with their 3 secret pictures, and on any
   other device a child logs in with the family code and the same pictures. A login gives that device its own ticket for the
   child's player id, so the device plays as the same child: same coins, XP and clothes. See docs/PROTOCOL.md. */

const crypto = require('node:crypto');

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 letters, so a random byte % 32 is fair; no I/O/0/1 to mix up
const FAMILY_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const PLAYER_ID = /^[\w-]{4,24}$/;
const PLAYER_TICKET = /^[a-f0-9]{64}$/i;
const MEMBERS_MAX = 8;
const TRIES = 5; // wrong picture tries before the child has to wait
const LOCK_MS = 15 * 60 * 1000;
const PICTURES = 9;
const MASCOTS = 12;

/** "abcd-2345" or "ABCD2345" → "ABCD2345"; anything else → "". */
function familyCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return FAMILY_CODE.test(code) ? code : '';
}

function newFamilyCode() {
  return Array.from(crypto.randomBytes(8), (byte) => CODE_LETTERS[byte % 32]).join('');
}

/** Three picture indexes (0-8), in order, or null. */
function pictures(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  return value.every((i) => Number.isInteger(i) && i >= 0 && i < PICTURES) ? value : null;
}

function hashPictures(pics, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pics.join('-'), Buffer.from(salt, 'hex'), 32, (error, key) => (error ? reject(error) : resolve(key.toString('hex'))));
  });
}

function childOf(message) {
  const name = String(message.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  const age = Number.isInteger(message.age) && message.age >= 1 && message.age <= 120 ? message.age : 8;
  const avatar = Number.isInteger(message.avatar) && message.avatar >= 0 && message.avatar < MASCOTS ? message.avatar : 0;
  return name ? { name, age, avatar } : null;
}

const shown = (member, now) => ({ id: member.id, name: member.name, age: member.age, avatar: member.avatar, locked: (member.until || 0) > now });

module.exports = function createFamily(roomStore, { now = () => Date.now(), cloudOf = async () => null } = {}) {
  // a few requests a minute per address: family codes and pictures cannot be guessed by trying many
  const hits = new Map();
  function allow(ip) {
    const t = now(), recent = (hits.get(ip) || []).filter((at) => t - at < 60_000);
    if (recent.length >= 30) return false;
    recent.push(t); hits.set(ip, recent);
    if (hits.size > 5000) for (const [key, list] of hits) if (!list.some((at) => t - at < 60_000)) hits.delete(key);
    return true;
  }

  /** The child's member record, with a fresh salt and the hash of the pictures. */
  async function member(id, child, pics) {
    const salt = crypto.randomBytes(16).toString('hex');
    return { id, ...child, salt, hash: await hashPictures(pics, salt), fails: 0, until: 0 };
  }

  async function add(message, create) {
    const id = String(message.id || ''), child = childOf(message), pics = pictures(message.pics);
    if (!PLAYER_ID.test(id) || !PLAYER_TICKET.test(message.ticket || '') || !child || !pics) return { ok: false, reason: 'invalid' };
    // only the device that plays as this child can add it to a family
    if (!(await roomStore.authenticatePlayer(id, message.ticket))) return { ok: false, reason: 'identity' };
    const record = await member(id, child, pics);
    if (create) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newFamilyCode();
        if (await roomStore.createFamily(code, record)) return { ok: true, code };
      }
      throw new Error('Could not find a free family code');
    }
    const code = familyCode(message.code);
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      const index = family.members.findIndex((m) => m.id === id);
      if (index < 0 && family.members.length >= MEMBERS_MAX) return { changed: false, result: { ok: false, reason: 'full' } };
      if (index < 0) family.members.push(record); else family.members[index] = record;
      return { changed: true, result: { ok: true, code } };
    });
  }

  /** A grown-up on any device of the family (one that plays as one of its children, `by`) gives another child new pictures
   *  (they forgot them; this also lifts a lock) or takes a child out of the family. The last child out deletes the family. */
  async function manage(message, act) {
    const code = familyCode(message.code), by = String(message.by || ''), id = String(message.id || '');
    const pics = act === 'pictures' ? pictures(message.pics) : null;
    if (!code || !PLAYER_ID.test(by) || !PLAYER_ID.test(id) || !PLAYER_TICKET.test(message.ticket || '') || (act === 'pictures' && !pics)) return { ok: false, reason: 'invalid' };
    if (!(await roomStore.authenticatePlayer(by, message.ticket))) return { ok: false, reason: 'identity' };
    const salt = crypto.randomBytes(16).toString('hex'), hash = pics ? await hashPictures(pics, salt) : '';
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      if (!family.members.some((m) => m.id === by)) return { changed: false, result: { ok: false, reason: 'identity' } };
      const i = family.members.findIndex((m) => m.id === id);
      if (i < 0) return { changed: false, result: { ok: false, reason: 'no-member' } };
      if (act === 'remove') family.members.splice(i, 1);
      else Object.assign(family.members[i], { salt, hash, fails: 0, until: 0 });
      return { changed: true, result: { ok: true, code, left: family.members.length } };
    });
  }

  async function members(message) {
    const family = await roomStore.getFamily(familyCode(message.code));
    if (!family) return { ok: false, reason: 'no-family' };
    return { ok: true, members: family.members.map((m) => shown(m, now())) };
  }

  async function login(message) {
    const code = familyCode(message.code), id = String(message.id || ''), pics = pictures(message.pics);
    if (!code || !PLAYER_ID.test(id) || !pics) return { ok: false, reason: 'invalid' };
    const family = await roomStore.getFamily(code);
    const stored = family && family.members.find((m) => m.id === id);
    if (!stored) return { ok: false, reason: 'no-family' };
    const tried = await hashPictures(pics, stored.salt);
    const result = await roomStore.mutateFamily(code, (current) => {
      const m = current && current.members.find((x) => x.id === id);
      if (!m) return { changed: false, result: { ok: false, reason: 'no-family' } };
      const t = now();
      if ((m.until || 0) > t) return { changed: false, result: { ok: false, reason: 'locked', wait: Math.ceil((m.until - t) / 1000) } };
      // the pictures were changed while this try was being checked: count it as wrong
      const right = m.salt === stored.salt && crypto.timingSafeEqual(Buffer.from(m.hash, 'hex'), Buffer.from(tried, 'hex'));
      if (right) {
        const changed = (m.fails || 0) > 0;
        m.fails = 0;
        return { changed, result: { ok: true } };
      }
      m.fails = (m.fails || 0) + 1;
      if (m.fails >= TRIES) {
        m.fails = 0; m.until = t + LOCK_MS;
        return { changed: true, result: { ok: false, reason: 'locked', wait: LOCK_MS / 1000 } };
      }
      return { changed: true, result: { ok: false, reason: 'wrong', left: TRIES - m.fails } };
    });
    if (!result.ok) return result;
    const ticket = crypto.randomBytes(32).toString('hex');
    await roomStore.addDeviceTicket(id, ticket);
    // the child's cloud save comes along, so the new device has their character and lessons before the first join
    return { ok: true, id, ticket, ...childOf(stored), code, cloud: await cloudOf(id) };
  }

  /** HTTP handler for POST /api/family with { act: 'create' | 'join' | 'members' | 'login', ... }. */
  function handle(req, res) {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' });
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 4000) req.destroy(); });
    req.on('end', async () => {
      let message; try { message = JSON.parse(raw); } catch { return send(400, { ok: false, reason: 'invalid' }); }
      if (!message || typeof message !== 'object') return send(400, { ok: false, reason: 'invalid' });
      // behind Render's proxy the socket is the proxy; the proxy appends the real address last
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean);
      const ip = forwarded.length ? forwarded[forwarded.length - 1] : (req.socket && req.socket.remoteAddress) || '?';
      if (!allow(ip)) return send(429, { ok: false, reason: 'busy' });
      try {
        if (message.act === 'create') return send(200, await add(message, true));
        if (message.act === 'join') return send(200, await add(message, false));
        if (message.act === 'members') return send(200, await members(message));
        if (message.act === 'login') return send(200, await login(message));
        if (message.act === 'pictures' || message.act === 'remove') return send(200, await manage(message, message.act));
        send(400, { ok: false, reason: 'invalid' });
      } catch (error) {
        console.error('Family:', error.message);
        send(500, { ok: false, reason: 'storage' });
      }
    });
  }

  return { handle };
};
