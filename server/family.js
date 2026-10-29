'use strict';
/* Family login: a parent makes a family code, the family's children are added to it with their 3 secret pictures, and on any
   other device a child logs in with the family code and the same pictures. A login gives that device its own ticket for the
   child's player id, so the device plays as the same child: same coins, XP and clothes. See docs/PROTOCOL.md. */

const crypto = require('node:crypto');
const clientIp = require('./client-ip.js');

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 letters, so a random byte % 32 is fair; no I/O/0/1 to mix up
const FAMILY_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const PLAYER_ID = /^[\w-]{4,24}$/;
const PLAYER_TICKET = /^[a-f0-9]{64}$/i;
const MEMBERS_MAX = 8;
const TRIES = 5; // wrong picture (or PIN) tries before the child (or grown-up) has to wait
const LOCK_MS = 15 * 60 * 1000;
const PIN = /^\d{4,6}$/;
const RECOVERY = /^[A-HJ-NP-Z2-9]{10}$/; // the recovery code: 10 letters of CODE_LETTERS, made by the app
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

function hashSecret(text, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(text, Buffer.from(salt, 'hex'), 32, (error, key) => (error ? reject(error) : resolve(key.toString('hex'))));
  });
}
const hashPictures = (pics, salt) => hashSecret(pics.join('-'), salt);
const same = (a, b) => crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

/** A PIN is a string of 4-6 digits (a number would lose its leading zeros); anything else → "". */
const pinText = (value) => (typeof value === 'string' && PIN.test(value) ? value : '');
/** "abcd-efgh-23" → "ABCDEFGH23"; anything else → "". */
function recoveryCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return RECOVERY.test(code) ? code : '';
}

/** The grown-up PIN as stored on the family row: a fresh salt and the scrypt hash, and with `recovery` the recovery code's
 *  own salt and hash; the lock counts are kept by the caller. */
async function pinRecord(pin, recovery) {
  const salt = crypto.randomBytes(16).toString('hex'), record = { pinHash: await hashSecret(pin, salt), pinSalt: salt, pinFails: 0, pinUntil: 0 };
  if (recovery) { record.recoverySalt = crypto.randomBytes(16).toString('hex'); record.recoveryHash = await hashSecret(recovery, record.recoverySalt); record.recFails = 0; record.recUntil = 0; }
  return record;
}
/* What a try is checked against, and which counter its wrong tries go to. Three counters, so nobody without a member's
   ticket can lock the grown-up out: `pin` (check-pin, pin, pictures, remove, erase: all need a ticket), `join` (a new child
   joining with the PIN: anyone with the code can try) and `rec` (recover: anyone with the code can try). */
const SECRET = {
  pin: { hash: 'pinHash', salt: 'pinSalt', clean: pinText, counter: 'pin', reason: 'pin', locked: 'pin-locked' },
  join: { hash: 'pinHash', salt: 'pinSalt', clean: pinText, counter: 'join', reason: 'pin', locked: 'join-locked' },
  recovery: { hash: 'recoveryHash', salt: 'recoverySalt', clean: recoveryCode, counter: 'rec', reason: 'recovery', locked: 'recovery-locked' },
};
const DAY = 24 * 60 * 60 * 1000;
const ERASE_WAIT = 3 * DAY; // an old family's first PIN can't erase it at once: its grown-ups have 3 days to notice

function childOf(message) {
  const name = String(message.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  const age = Number.isInteger(message.age) && message.age >= 1 && message.age <= 120 ? message.age : 8;
  const avatar = Number.isInteger(message.avatar) && message.avatar >= 0 && message.avatar < MASCOTS ? message.avatar : 0;
  return name ? { name, age, avatar } : null;
}

const shown = (member, now) => ({ id: member.id, name: member.name, age: member.age, avatar: member.avatar, locked: (member.until || 0) > now });

module.exports = function createFamily(roomStore, { now = () => Date.now(), cloudOf = async () => null, onErase = async () => {}, email = null } = {}) {
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

  /** Before any hashing: a locked counter answers at once (a lock costs no scrypt), a missing or malformed try is not
   *  counted. Else the try hashed with the family's salt, for pinCheck. A family with no PIN needs none. */
  async function pinTry(family, value, kind = 'pin') {
    const k = SECRET[kind], c = k.counter, t = now();
    if (!family[k.hash]) return { attempt: null };
    if (family[c + 'Until'] > t) return { refusal: { ok: false, reason: k.locked, wait: Math.ceil((family[c + 'Until'] - t) / 1000) } };
    const clean = k.clean(value);
    if (!clean) return { refusal: { ok: false, reason: k.reason, left: TRIES - family[c + 'Fails'] } };
    return { attempt: { salt: family[k.salt], tried: await hashSecret(clean, family[k.salt]) } };
  }
  /** Inside mutateFamily: null when the try is right, else the refusal. The 5th wrong try locks for 15 min × 2^(locks - 1),
   *  at most a day; a right try takes one lock off the count, and a day with no wrong try forgets the count. */
  function pinCheck(family, attempt, kind = 'pin') {
    const k = SECRET[kind], c = k.counter, t = now();
    if (family[c + 'Until'] > t) return { ok: false, reason: k.locked, wait: Math.ceil((family[c + 'Until'] - t) / 1000) };
    if (t - Math.max(family[c + 'WrongAt'], family[c + 'Until']) >= DAY) family[c + 'Locks'] = 0; // the quiet day starts when the lock ends
    if (!attempt || !family[k.hash]) return { ok: false, reason: k.reason, left: TRIES - family[c + 'Fails'] }; // set while this was on its way
    // the PIN was changed while this try was being checked: count it as wrong
    if (attempt.salt === family[k.salt] && same(family[k.hash], attempt.tried)) {
      family[c + 'Fails'] = 0; family[c + 'Locks'] = Math.max(0, family[c + 'Locks'] - 1);
      return null;
    }
    family[c + 'WrongAt'] = t;
    if (++family[c + 'Fails'] < TRIES) return { ok: false, reason: k.reason, left: TRIES - family[c + 'Fails'] };
    family[c + 'Fails'] = 0; family[c + 'Locks'] += 1;
    const ms = Math.min(DAY, LOCK_MS * 2 ** (family[c + 'Locks'] - 1));
    family[c + 'Until'] = t + ms;
    return { ok: false, reason: k.locked, wait: ms / 1000 };
  }

  async function add(message, create) {
    const id = String(message.id || ''), child = childOf(message), pics = pictures(message.pics);
    if (!PLAYER_ID.test(id) || !PLAYER_TICKET.test(message.ticket || '') || !child || !pics) return { ok: false, reason: 'invalid' };
    // a new family always gets a PIN and its recovery code
    if (create && (!pinText(message.pin) || !recoveryCode(message.recovery))) return { ok: false, reason: 'invalid' };
    if (create) {
      // only the device that plays as this child can add it to a family (a new id is taken on first sight, unless erased)
      if (!(await roomStore.authenticatePlayer(id, message.ticket))) return { ok: false, reason: (await roomStore.isErased(id)) ? 'erased' : 'identity' };
      const record = await member(id, child, pics), pin = { ...(await pinRecord(message.pin, recoveryCode(message.recovery))), pinLocks: 0 };
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newFamilyCode();
        if (await roomStore.createFamily(code, record, pin)) return { ok: true, code };
      }
      throw new Error('Could not find a free family code');
    }
    const code = familyCode(message.code);
    const known = await roomStore.getFamily(code); // the family first, so a stale device of an erased one registers nothing
    if (!known) return { ok: false, reason: 'no-family' };
    if (!(await roomStore.authenticatePlayer(id, message.ticket))) return { ok: false, reason: (await roomStore.isErased(id)) ? 'erased' : 'identity' };
    // a child already in the family changing their own pictures (with their own ticket, checked above) needs no PIN; a new
    // child's PIN tries count on their own (`join`), so strangers with the code can't lock the grown-up's PIN
    const { attempt, refusal } = known.members.some((m) => m.id === id) ? { attempt: null } : await pinTry(known, message.pin, 'join');
    if (refusal) return refusal;
    const record = await member(id, child, pics);
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      const index = family.members.findIndex((m) => m.id === id);
      if (index < 0 && family.pinHash) { const no = pinCheck(family, attempt, 'join'); if (no) return { changed: true, result: no }; }
      if (index < 0 && family.members.length >= MEMBERS_MAX) return { changed: true, result: { ok: false, reason: 'full' } };
      if (index < 0) family.members.push(record); else family.members[index] = record;
      return { changed: true, result: { ok: true, code } };
    });
  }

  /** `by` is a child of the family and this device plays as it (its ticket): the family with the PIN tried, or a refusal.
   *  The family and the membership come before the ticket, so an erased child's stale device registers nothing anew. */
  async function grownUp(message, code, by, pin = message.pin) {
    const family = await roomStore.getFamily(code);
    if (!family) return { refusal: { ok: false, reason: 'no-family' } };
    if (!family.members.some((m) => m.id === by)) return { refusal: { ok: false, reason: 'identity' } };
    if (!(await roomStore.authenticatePlayer(by, message.ticket))) return { refusal: { ok: false, reason: 'identity' } };
    return { family, ...(await pinTry(family, pin)) };
  }

  /** A grown-up on any device of the family (one that plays as one of its children, `by`) gives another child new pictures
   *  (they forgot them; this also lifts a lock) or takes a child out of the family. The last child out deletes the family.
   *  Both need the family's PIN; a family made before the PIN must get one first (`needs-pin`), else anyone who joined it
   *  with the code could reset its oldest child's pictures and take the family over. */
  async function manage(message, act) {
    const code = familyCode(message.code), by = String(message.by || ''), id = String(message.id || '');
    const pics = act === 'pictures' ? pictures(message.pics) : null;
    if (!code || !PLAYER_ID.test(by) || !PLAYER_ID.test(id) || !PLAYER_TICKET.test(message.ticket || '') || (act === 'pictures' && !pics)) return { ok: false, reason: 'invalid' };
    const { family: known, attempt, refusal } = await grownUp(message, code, by);
    if (refusal) return refusal;
    if (!known.pinHash) return { ok: false, reason: 'needs-pin' };
    const salt = crypto.randomBytes(16).toString('hex'), hash = pics ? await hashPictures(pics, salt) : '';
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      if (!family.members.some((m) => m.id === by)) return { changed: false, result: { ok: false, reason: 'identity' } };
      if (!family.pinHash) return { changed: false, result: { ok: false, reason: 'needs-pin' } };
      const no = pinCheck(family, attempt);
      if (no) return { changed: true, result: no };
      const i = family.members.findIndex((m) => m.id === id);
      if (i < 0) return { changed: true, result: { ok: false, reason: 'no-member' } };
      if (act === 'remove') family.members.splice(i, 1);
      else Object.assign(family.members[i], { salt, hash, fails: 0, until: 0 });
      return { changed: true, result: { ok: true, code, left: family.members.length } };
    });
  }

  /** Sets the family's PIN (`pin`): with the old one (`old`), or, for a family made before the PIN, by its oldest child,
   *  who then also sends its first `recovery` code (and the family can't be erased for 3 days). A change keeps the
   *  recovery code unless a new one is sent. */
  async function setPin(message) {
    const code = familyCode(message.code), by = String(message.by || ''), recovery = recoveryCode(message.recovery);
    if (!code || !PLAYER_ID.test(by) || !PLAYER_TICKET.test(message.ticket || '') || !pinText(message.pin)
      || (message.recovery !== undefined && !recovery)) return { ok: false, reason: 'invalid' };
    const { family: known, attempt, refusal } = await grownUp(message, code, by, message.old);
    if (refusal) return refusal;
    if (!known.pinHash && known.members[0].id !== by) return { ok: false, reason: 'not-first' };
    if (!known.pinHash && !recovery) return { ok: false, reason: 'invalid' };
    const next = await pinRecord(message.pin, recovery);
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      if (!family.members.some((m) => m.id === by)) return { changed: false, result: { ok: false, reason: 'identity' } };
      if (family.pinHash) { const no = pinCheck(family, attempt); if (no) return { changed: true, result: no }; }
      else if (family.members[0].id !== by) return { changed: false, result: { ok: false, reason: 'not-first' } };
      else family.pinSetAt = now();
      Object.assign(family, next);
      return { changed: true, result: { ok: true, code } };
    });
  }

  /** Is `pin` the family's PIN? For a device whose own copy of the PIN is out of date (it was changed on another device). */
  async function checkPin(message) {
    const code = familyCode(message.code), by = String(message.by || '');
    if (!code || !PLAYER_ID.test(by) || !PLAYER_TICKET.test(message.ticket || '')) return { ok: false, reason: 'invalid' };
    const { family: known, attempt, refusal } = await grownUp(message, code, by);
    if (refusal) return refusal;
    if (!known.pinHash) return { ok: false, reason: 'needs-pin' };
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      if (!family.pinHash) return { changed: false, result: { ok: false, reason: 'needs-pin' } };
      const no = pinCheck(family, attempt);
      return { changed: true, result: no || { ok: true } };
    });
  }

  /** A grown-up who forgot the PIN sets a new one with the recovery code, which is then replaced by `newRecovery`: each
   *  code works once. The code is the secret here, so no ticket is needed; its tries have their own counter and lock, so a
   *  locked PIN can still be recovered (10 letters from 32 is 50 bits: safe at a few tries a day). */
  async function recover(message) {
    const code = familyCode(message.code), recovery = recoveryCode(message.newRecovery);
    if (!code || !pinText(message.pin) || !recovery || recovery === recoveryCode(message.recovery)) return { ok: false, reason: 'invalid' };
    const known = await roomStore.getFamily(code);
    if (!known) return { ok: false, reason: 'no-family' };
    if (!known.recoveryHash) return { ok: false, reason: 'no-recovery' };
    const { attempt, refusal } = await pinTry(known, message.recovery, 'recovery');
    if (refusal) return refusal;
    const next = await pinRecord(message.pin, recovery);
    return roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      const no = pinCheck(family, attempt, 'recovery');
      if (no) return { changed: true, result: no };
      Object.assign(family, next); // the PIN's own wrong tries and lock start again too
      return { changed: true, result: { ok: true, code } };
    });
  }

  /** Deletes the whole family: every child's account on the server (see roomStore.eraseFamily), then their live
   *  connections (onErase). Needs a child's ticket, the PIN and the family code typed again (`confirm`). */
  async function erase(message) {
    const code = familyCode(message.code), by = String(message.by || '');
    if (!code || !PLAYER_ID.test(by) || !PLAYER_TICKET.test(message.ticket || '')) return { ok: false, reason: 'invalid' };
    if (familyCode(message.confirm) !== code) return { ok: false, reason: 'confirm' };
    const { family: known, attempt, refusal } = await grownUp(message, code, by);
    if (refusal && refusal.reason !== 'pin' && refusal.reason !== 'pin-locked') return refusal;
    if (!known.pinHash) return { ok: false, reason: 'needs-pin' };
    const soon = known.pinSetAt + ERASE_WAIT - now();
    if (soon > 0) return { ok: false, reason: 'too-soon', wait: Math.ceil(soon / 1000) };
    if (refusal) return refusal;
    const checked = await roomStore.mutateFamily(code, (family) => {
      if (!family) return { changed: false, result: { ok: false, reason: 'no-family' } };
      if (!family.pinHash) return { changed: false, result: { ok: false, reason: 'needs-pin' } };
      const no = pinCheck(family, attempt);
      return { changed: true, result: no || { ok: true } };
    });
    if (!checked.ok) return checked;
    let ids = [];
    const result = await roomStore.eraseFamily(code, (family) => {
      if (!family) return { erase: false, result: { ok: false, reason: 'no-family' } };
      if (!family.members.some((m) => m.id === by)) return { erase: false, result: { ok: false, reason: 'identity' } };
      if (family.pinSalt !== attempt.salt) return { erase: false, result: { ok: false, reason: 'pin', left: TRIES - family.pinFails } }; // the PIN changed meanwhile
      ids = family.members.map((m) => m.id);
      return { erase: true, result: { ok: true, erased: ids.length } };
    });
    if (!result.ok) return result;
    console.log(`Family erased: ${crypto.createHash('sha256').update(code).digest('hex').slice(0, 16)} at ${new Date(now()).toISOString()}`);
    await onErase(ids);
    return result;
  }

  /** A grown-up adds (`set-email`, with `email`) or takes away (`remove-email`) the address for the weekly report
   *  (parent-email.js). Both need the PIN, checked as for check-pin (same tries and lock). */
  async function emailAct(message, act, ip) {
    if (!email || (act === 'set-email' && !email.enabled)) return { ok: false, reason: 'email-off' };
    if (act === 'set-email' && !email.address(message.email)) return { ok: false, reason: 'invalid' };
    const checked = await checkPin(message);
    if (!checked.ok) return checked;
    return act === 'set-email' ? email.set(familyCode(message.code), message.email, ip) : email.remove(familyCode(message.code));
  }
  // { to: 'k***@gmail.com', confirmed } with `full` (login, which needs a child's pictures), else { confirmed }; or null
  const emailOf = async (code, full) => (email ? email.shownFor(code, full) : null);

  async function members(message) {
    const family = await roomStore.getFamily(familyCode(message.code));
    if (!family) return { ok: false, reason: 'no-family' };
    return { ok: true, members: family.members.map((m) => shown(m, now())), needsPin: !family.pinHash, email: await emailOf(familyCode(message.code)) };
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
    return { ok: true, id, ticket, ...childOf(stored), code, cloud: await cloudOf(id), needsPin: !family.pinHash, email: await emailOf(code, true) };
  }

  /** HTTP handler for POST /api/family with { act: 'create' | 'join' | 'members' | 'login' | 'pictures' | 'remove' | 'pin' | 'check-pin' | 'recover' | 'erase' | 'set-email' | 'remove-email', ... }. */
  function handle(req, res) {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' });
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 4000) req.destroy(); });
    req.on('end', async () => {
      let message; try { message = JSON.parse(raw); } catch { return send(400, { ok: false, reason: 'invalid' }); }
      if (!message || typeof message !== 'object') return send(400, { ok: false, reason: 'invalid' });
      if (!allow(clientIp(req))) return send(429, { ok: false, reason: 'busy' });
      try {
        if (message.act === 'create') return send(200, await add(message, true));
        if (message.act === 'join') return send(200, await add(message, false));
        if (message.act === 'members') return send(200, await members(message));
        if (message.act === 'login') return send(200, await login(message));
        if (message.act === 'pictures' || message.act === 'remove') return send(200, await manage(message, message.act));
        if (message.act === 'pin') return send(200, await setPin(message));
        if (message.act === 'check-pin') return send(200, await checkPin(message));
        if (message.act === 'recover') return send(200, await recover(message));
        if (message.act === 'erase') return send(200, await erase(message));
        if (message.act === 'set-email' || message.act === 'remove-email') return send(200, await emailAct(message, message.act, clientIp(req)));
        send(400, { ok: false, reason: 'invalid' });
      } catch (error) {
        console.error('Family:', error.message);
        send(500, { ok: false, reason: 'storage' });
      }
    });
  }

  return { handle };
};
