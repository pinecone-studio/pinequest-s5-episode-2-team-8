#!/usr/bin/env node
/* Naadamy server: serves the app and links players into a shared village (Нутаг).
   Default JSON storage uses Node built-ins; PostgreSQL storage is enabled with DATABASE_URL.

   Run:  node server.js            (port 8000)
         PORT=3000 node server.js
   Everyone on the same Wi-Fi opens http://<this-computer-ip>:8000 and plays together.
   For PostgreSQL storage, install dependencies with npm ci and set DATABASE_URL. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const R = require('./js/village/rules.js');
const QR = require('./js/qr.js');
const basar = require('./basar-ai.js')(__dirname);
const { createRoomStore } = require('./room-store');

const ROOT = __dirname;
const INSTANCE_ID = crypto.randomUUID();
const PORT = Number(process.env.PORT || process.argv[2] || 8000);
const lanIPs = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
let actualPort = PORT;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const roomStore = createRoomStore({ dataDir: DATA_DIR });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const BLOCKED = [/^\/data(\/|$)/, /^\/\.git/, /^\/\.env/, /^\/server\.js$/, /^\/basar-ai\.js$/, /^\/node_modules/];

// ---------------------------------------------------------------- static files
function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/hello') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    const c = counts();
    return res.end(JSON.stringify({ naadamy: true, rooms: rooms.size, players: c.total, nutag: c.nutag, urls: lanIPs().map((ip) => `http://${ip}:${actualPort}/`) }));
  }
  if (url.pathname === '/api/basar') return basar.handle(req, res);
  let p = decodeURIComponent(url.pathname);
  if (BLOCKED.some((re) => re.test(p))) { res.writeHead(404); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const cache = /\.(woff2|ttf|m4a|mp3|ogg|wav)$/.test(file) ? 'public, max-age=604800' : 'no-cache';
    // byte ranges: Safari and iPhones refuse to play audio from servers without them
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${st.size}`, 'accept-ranges': 'bytes', 'cache-control': cache });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', 'cache-control': cache });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------- rooms + saved gers
const rooms = new Map(); // code -> { code, players: Map(id -> player), lots: [] }
let saved = {};
let dirty = false;
let dirtyVersion = 0;
let persistPromise = null;
function markDirty() { dirty = true; dirtyVersion++; }
function normalizeLots(lots) {
  const normalized = Array.isArray(lots) ? lots.slice(0, R.LOTS) : [];
  while (normalized.length < R.LOTS) normalized.push(null);
  return normalized;
}
function room(code) {
  if (!rooms.has(code)) {
    const lots = normalizeLots(saved[code] && saved[code].lots);
    rooms.set(code, { code, players: new Map(), remotePlayers: new Map(), lots, matches: new Map(), wrestlingTimers: new Map(), chat: restoreChat(saved[code] && saved[code].chat) });
  }
  return rooms.get(code);
}
async function persist() {
  if (!dirty) return true;
  if (persistPromise) {
    const previousSaveSucceeded = await persistPromise;
    return previousSaveSucceeded && dirty ? persist() : previousSaveSucceeded;
  }
  const version = dirtyVersion;
  const snapshot = { ...saved };
  for (const r of rooms.values()) snapshot[r.code] = { lots: r.lots, chat: r.chat, t: Date.now() };
  persistPromise = (async () => {
    try {
      await roomStore.save(snapshot);
      saved = snapshot;
      if (dirtyVersion === version) dirty = false;
      return true;
    } catch (e) {
      console.error('Could not save the rooms:', e.message);
      return false;
    } finally {
      persistPromise = null;
    }
  })();
  return persistPromise;
}
setInterval(() => { void persist(); }, 5000).unref();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await Promise.all([...conns].map((connection) => leave(connection)));
  const savedOnShutdown = await persist();
  try {
    await roomStore.close(INSTANCE_ID);
  } catch (e) {
    console.error('Could not close room storage:', e.message);
    process.exit(1);
  }
  process.exit(savedOnShutdown ? 0 : 1);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ---------------------------------------------------------------- minimal WebSocket (RFC 6455)
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 16 * 1024;
function frame(op, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : null;
  if (!head) return null;
  return Buffer.concat([head, data]);
}
function upgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const conn = { socket, buf: Buffer.alloc(0), frag: [], alive: true, tokens: 30, last: Date.now(), player: null, room: null };
  conn.send = (obj) => { if (!socket.destroyed) { const f = frame(1, JSON.stringify(obj)); if (f) socket.write(f); } };
  socket.on('data', (chunk) => {
    conn.buf = Buffer.concat([conn.buf, chunk]);
    if (conn.buf.length > MAX_PAYLOAD * 4) return socket.destroy();
    while (conn.buf.length >= 2) {
      const b0 = conn.buf[0], b1 = conn.buf[1], op = b0 & 0x0f, fin = !!(b0 & 0x80), masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (conn.buf.length < 4) return; len = conn.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) return socket.destroy(); // far too big for this game
      if (len > MAX_PAYLOAD || !masked) return socket.destroy();
      if (conn.buf.length < off + 4 + len) return;
      const mask = conn.buf.subarray(off, off + 4), data = Buffer.from(conn.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      conn.buf = conn.buf.subarray(off + 4 + len);
      if (op === 8) { try { socket.end(frame(8, Buffer.alloc(0))); } catch { /* closing */ } return; }
      if (op === 9) { socket.write(frame(10, data)); continue; }
      if (op === 10) { conn.alive = true; continue; }
      if (op === 1 || op === 0) {
        conn.frag.push(data);
        if (fin) { const text = Buffer.concat(conn.frag).toString('utf8'); conn.frag = []; onMessage(conn, text); }
      }
    }
  });
  socket.on('close', () => { conns.delete(conn); leave(conn); });
  socket.on('error', () => { conns.delete(conn); leave(conn); });
  conns.add(conn);
}
const conns = new Set();
setInterval(() => {
  for (const c of conns) {
    if (!c.alive) { c.socket.destroy(); continue; }
    c.alive = false;
    try { c.socket.write(frame(9, Buffer.alloc(0))); } catch { c.socket.destroy(); }
  }
  refreshPresence().catch((error) => console.error('Could not refresh multiplayer presence:', error.message));
}, Number(process.env.HEARTBEAT_MS) || 20000).unref(); // a phone that drops off Wi-Fi without saying goodbye is removed after one or two missed pings

// ---------------------------------------------------------------- game protocol
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo);
const numf = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : lo); // positions with 2 decimals for smooth movement
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Найз';
const pub = (p) => ({ id: p.id, name: p.name, look: p.look, lvl: p.lvl, x: p.x, y: p.y, dir: p.dir });
const WALLET_MAX = 2_000_000_000;
const walletLevel = (wallet) => num(R.level(wallet.xp).l, 1, 99);
function walletSeed(value) {
  const integer = (amount, fallback, maximum) => Number.isSafeInteger(amount) ? Math.max(0, Math.min(maximum, amount)) : fallback;
  return { coins: integer(value && value.coins, 40, 100_000), xp: integer(value && value.xp, 0, 1_000_000) };
}
function inventorySeed(value) {
  return {
    owned: value && Array.isArray(value.owned) ? value.owned.slice(0, R.ITEMS.length) : [],
    rod: value && Number.isInteger(value.rod) ? Math.max(1, Math.min(2, value.rod)) : 1,
  };
}
function sanitizeProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { produce: {}, fish: {}, quests: { d: '', list: [] } };
  const counts = (source, allowed) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    return Object.fromEntries(Object.entries(source)
      .filter(([key, amount]) => Object.hasOwn(allowed, key) && Number.isSafeInteger(amount) && amount >= 0)
      .map(([key, amount]) => [key, Math.min(1000, amount)]));
  };
  const rawQuests = value.quests && typeof value.quests === 'object' && !Array.isArray(value.quests) ? value.quests : {};
  const parsedDay = typeof rawQuests.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawQuests.d)
    ? new Date(`${rawQuests.d}T00:00:00Z`) : null;
  const day = parsedDay && !Number.isNaN(parsedDay.getTime()) && parsedDay.toISOString().slice(0, 10) === rawQuests.d ? rawQuests.d : '';
  const list = Array.isArray(rawQuests.list) ? rawQuests.list.slice(0, 4).flatMap((quest) => {
    if (!quest || typeof quest !== 'object' || Array.isArray(quest)
      || typeof quest.k !== 'string' || !Object.hasOwn(R.QUEST_TARGETS, quest.k)) return [];
    const target = R.QUEST_TARGETS[quest.k];
    const progress = Number.isSafeInteger(quest.p) ? Math.max(0, Math.min(target, quest.p)) : 0;
    const saved = { k: quest.k, p: progress, done: quest.done === true && progress >= target };
    if (typeof quest.season === 'string' && /^[a-z0-9-]{1,32}$/i.test(quest.season)) saved.season = quest.season;
    return [saved];
  }) : [];
  return {
    produce: counts(value.produce, R.DAIRY),
    fish: counts(value.fish, R.FISH),
    quests: { d: day, list },
  };
}
function ownedLook(look, inventory) {
  const clean = R.cleanLook(look);
  for (const slot of ['deel', 'hat', 'face', 'neck', 'pet']) {
    const value = clean[slot];
    if (value === null || value === undefined) continue;
    const item = R.ITEMS.find((candidate) => candidate.slot === slot && candidate.val === value);
    if (!item || !inventory.owned.includes(item.id)) clean[slot] = slot === 'deel' ? 'blue' : null;
  }
  return clean;
}
/** How many people are on the whole server and in the main village, so players in different rooms can find each other. */
function counts() {
  let total = 0, nutag = 0;
  for (const r of rooms.values()) {
    total += r.players.size + r.remotePlayers.size;
    if (r.code === 'NUTAG') nutag = r.players.size + r.remotePlayers.size;
  }
  return { total, nutag };
}
function census() { const c = counts(); for (const r of rooms.values()) if (r.players.size) broadcast(r, { t: 'census', ...c }); }
const REALTIME_TYPES = new Set(['join', 'leave', 'move', 'jump', 'look', 'say', 'lot', 'replaced']);
function broadcastLocal(r, msg, except) {
  for (const p of r.players.values()) if (p.conn !== except) p.conn.send(msg);
}
function broadcast(r, msg, except) {
  broadcastLocal(r, msg, except);
  if (roomStore.sharedRealtime && REALTIME_TYPES.has(msg.t)) {
    roomStore.publishRealtime({ room: r.code, instanceId: INSTANCE_ID, message: msg }).catch((error) => {
      console.error('Could not publish multiplayer event:', error.message);
    });
  }
}
function handleRealtime(event) {
  if (!event || !R.ROOM_RE.test(event.room || '') || !event.message || typeof event.message.t !== 'string') return;
  const { room: code, message } = event;
  if (message.t === 'wrestle') {
    const r = room(code);
    deliverWrestleEvent(r, message);
    return;
  }
  if (message.t === 'replaced') {
    for (const r of rooms.values()) {
      if (r.remotePlayers.delete(message.id)) broadcastLocal(r, { t: 'leave', id: message.id });
    }
    for (const connection of conns) {
      if (connection.player && connection.player.id === message.id) {
        connection.send({ t: 'replaced' });
        setTimeout(() => connection.socket.destroy(), 50);
      }
    }
    return;
  }
  if (!REALTIME_TYPES.has(message.t)) return;
  const r = room(code);
  if (message.t === 'join' && message.p) {
    r.remotePlayers.set(message.p.id, message.p);
    if (!message.replace) logChat(r, { k: 'join', id: message.p.id, n: cleanName(message.p.name) });
  } else if (message.t === 'leave') {
    const player = r.remotePlayers.get(message.id);
    r.remotePlayers.delete(message.id);
    if (player) logChat(r, { k: 'leave', id: player.id, n: cleanName(player.name) });
  } else if (message.t === 'move') {
    const player = r.remotePlayers.get(message.id);
    if (player) Object.assign(player, { x: message.x, y: message.y, dir: message.dir });
  } else if (message.t === 'look') {
    const player = r.remotePlayers.get(message.id);
    if (player) Object.assign(player, { look: message.look, lvl: message.lvl });
  } else if (message.t === 'say' && Number.isInteger(message.i) && typeof message.id === 'string') {
    const kind = message.k === 'e' ? 'e' : 'p';
    const max = kind === 'e' ? R.EMOTES.length : R.PHRASES.length;
    if (message.i >= 0 && message.i < max) logChat(r, { k: kind, id: message.id, n: cleanName(message.n), i: message.i });
  } else if (message.t === 'lot' && Number.isInteger(message.i) && message.i >= 0 && message.i < R.LOTS
    && ['claim', 'stage', 'style'].includes(message.act)) {
    r.lots[message.i] = message.lot || null;
    saved[code] = { ...(saved[code] || {}), lots: r.lots };
  }
  broadcastLocal(r, message);
  if (message.t === 'join' || message.t === 'leave') census();
}
function wrestlingEvent(to, message) {
  return { t: 'wrestle', to, message };
}
function deliverWrestleEvent(r, event) {
  const message = event.message;
  const timerKey = message.id && `${r.code}:${message.id}`;
  if (message.t === 'wr-end' && timerKey) {
    clearTimeout(r.wrestlingTimers.get(timerKey));
    r.wrestlingTimers.delete(timerKey);
  } else if ((message.t === 'wr-start' || message.t === 'wr-result') && timerKey && message.deadline) {
    clearTimeout(r.wrestlingTimers.get(timerKey));
    const delay = Math.max(0, message.deadline - Date.now());
    const timer = setTimeout(() => {
      r.wrestlingTimers.delete(timerKey);
      resolveSharedWrestlingTimeout(r, message.id).catch((error) => {
        console.error('Could not resolve shared wrestling timeout:', error.message);
      });
    }, delay);
    if (timer.unref) timer.unref();
    r.wrestlingTimers.set(timerKey, timer);
  }
  for (const id of event.to || []) {
    const player = r.players.get(id);
    if (player) player.conn.send(message);
  }
  if (message.t === 'wr-end') awardWrestlingResult(r, message);
}
function awardWrestlingResult(r, message) {
  if (!message.winner || typeof message.id !== 'string' || !/^w[\w-]{1,64}$/.test(message.id)
    || !Array.isArray(message.playerIds) || message.playerIds.length !== 2 || !message.playerIds.includes(message.winner)) return;
  for (const id of message.playerIds) {
    const player = r.players.get(id);
    if (player) grantWrestlingReward(player, message.id, id === message.winner);
  }
}
async function grantWrestlingReward(player, matchId, won) {
  const operation = `wrestle:${matchId}`;
  const coins = won ? 25 : 0, xp = won ? 30 : 10;
  try {
    const outcome = await roomStore.mutateWallet(player.id, operation, (wallet) => {
      if (wallet.coins > WALLET_MAX - coins || wallet.xp > WALLET_MAX - xp) {
        return { changed: false, result: { accepted: false, reason: 'limit' } };
      }
      return {
        changed: true,
        wallet: { coins: wallet.coins + coins, xp: wallet.xp + xp },
        result: { accepted: true },
      };
    });
    player.conn.wallet = outcome.wallet;
    player.conn.inventory = outcome.inventory;
    syncPlayerLevel(player.conn);
    player.conn.send({ t: 'wallet-result', op: operation, ...outcome.result, wallet: outcome.wallet });
  } catch (error) {
    console.error('Could not grant server-validated wrestling reward:', error.message);
    player.conn.send({ t: 'wallet-result', op: operation, accepted: false, reason: 'storage', wallet: player.conn.wallet });
  }
}
async function mutateSharedWrestling(r, mutate) {
  const { result } = await roomStore.mutateRoom(
    r.code,
    { lots: r.lots, chat: r.chat, wrestling: { invites: [], matches: [] } },
    (state) => {
      if (!state.wrestling || typeof state.wrestling !== 'object') state.wrestling = {};
      if (!Array.isArray(state.wrestling.invites)) state.wrestling.invites = [];
      if (!Array.isArray(state.wrestling.matches)) state.wrestling.matches = [];
      const now = Date.now();
      const oldInviteCount = state.wrestling.invites.length;
      state.wrestling.invites = state.wrestling.invites.filter((invite) => invite.expiresAt > now);
      const changed = state.wrestling.invites.length !== oldInviteCount;
      const outcome = mutate(state.wrestling);
      return {
        changed: changed || Boolean(outcome && outcome.changed),
        events: outcome && outcome.events || [],
        value: outcome && outcome.value,
      };
    },
    INSTANCE_ID,
  );
  for (const event of result.events) deliverWrestleEvent(r, event);
  return result.value;
}
function resolveSharedRound(wrestling, match, timedOut) {
  if (timedOut) {
    for (const side of ['a', 'b']) {
      if (!match.moves[side]) match.moves[side] = { m: R.MOVES[Math.floor(Math.random() * R.MOVES.length)].id, p: 0.15 };
    }
  }
  const a = match.moves.a, b = match.moves.b;
  if (!a || !b) return { changed: false, events: [] };
  const result = R.exchange(a.m, a.p, b.m, b.p);
  if (result > 0) match.score.a++;
  else if (result < 0) match.score.b++;
  match.moves = {};
  const finished = match.score.a >= 2 || match.score.b >= 2;
  match.deadline = finished ? null : Date.now() + 25000;
  const events = [wrestlingEvent([match.a, match.b], {
    t: 'wr-result', id: match.id, ma: a.m, pa: a.p, mb: b.m, pb: b.p,
    r: result, score: match.score, ...(finished ? {} : { deadline: match.deadline }),
  })];
  if (finished) {
    wrestling.matches = wrestling.matches.filter((entry) => entry.id !== match.id);
    events.push(wrestlingEvent([match.a, match.b], {
      t: 'wr-end', id: match.id, winner: match.score.a > match.score.b ? match.a : match.b,
      playerIds: [match.a, match.b], reason: '',
    }));
  }
  return { changed: true, events };
}
async function resolveSharedWrestlingTimeout(r, matchId) {
  if (!roomStore.sharedRealtime) return;
  await mutateSharedWrestling(r, (wrestling) => {
    const match = wrestling.matches.find((entry) => entry.id === matchId);
    if (!match || match.deadline > Date.now()) return { changed: false };
    return resolveSharedRound(wrestling, match, true);
  });
}
async function handleSharedWrestling(conn, type, message) {
  const p = conn.player, r = conn.room;
  if (!p || !r) return;
  try {
    await mutateSharedWrestling(r, (wrestling) => {
      const events = [];
      if (type === 'wr-invite') {
        const toId = String(message.to || '').slice(0, 24);
        const target = r.players.get(toId) || r.remotePlayers.get(toId);
        if (!target || toId === p.id || wrestling.matches.some((match) => match.a === p.id || match.b === p.id || match.a === toId || match.b === toId)) {
          conn.send({ t: 'deny', act: 'wr', why: 'busy' });
          return { changed: false };
        }
        if (wrestling.invites.some((invite) => invite.from === p.id && invite.to === toId)) return { changed: false };
        wrestling.invites.push({ from: p.id, to: toId, fromName: p.name, expiresAt: Date.now() + 60000 });
        events.push(wrestlingEvent([toId], { t: 'wr-invite', from: p.id, name: p.name }));
        return { changed: true, events };
      }
      if (type === 'wr-decline') {
        const fromId = String(message.from || '').slice(0, 24);
        const index = wrestling.invites.findIndex((invite) => invite.from === fromId && invite.to === p.id);
        if (index < 0) return { changed: false };
        wrestling.invites.splice(index, 1);
        events.push(wrestlingEvent([fromId], { t: 'wr-declined', by: p.id, name: p.name }));
        return { changed: true, events };
      }
      if (type === 'wr-accept') {
        const fromId = String(message.from || '').slice(0, 24);
        const invitationIndex = wrestling.invites.findIndex((invite) => invite.from === fromId && invite.to === p.id);
        const opponent = r.players.get(fromId) || r.remotePlayers.get(fromId);
        if (invitationIndex < 0 || !opponent || wrestling.matches.some((match) => match.a === p.id || match.b === p.id || match.a === fromId || match.b === fromId)) {
          conn.send({ t: 'deny', act: 'wr', why: 'busy' });
          return { changed: false };
        }
        const invitation = wrestling.invites[invitationIndex];
        wrestling.invites = wrestling.invites.filter((invite) => invite.from !== p.id && invite.to !== p.id && invite.from !== fromId && invite.to !== fromId);
        const id = `w${crypto.randomUUID()}`;
        const match = {
          id, a: fromId, b: p.id, score: { a: 0, b: 0 }, moves: {}, deadline: Date.now() + 25000,
          aInfo: { id: fromId, name: invitation.fromName, look: opponent.look },
          bInfo: { id: p.id, name: p.name, look: p.look },
        };
        wrestling.matches.push(match);
        events.push(wrestlingEvent([match.a, match.b], {
          t: 'wr-start', id, a: match.aInfo, b: match.bInfo, deadline: match.deadline,
        }));
        return { changed: true, events };
      }
      if (type === 'wr-move') {
        const match = wrestling.matches.find((entry) => entry.a === p.id || entry.b === p.id);
        const side = match && (match.a === p.id ? 'a' : 'b');
        if (!match || !side || match.deadline <= Date.now() || match.moves[side] || !R.MOVES.some((move) => move.id === message.m)) {
          if (match && match.deadline <= Date.now()) return resolveSharedRound(wrestling, match, true);
          return { changed: false };
        }
        const power = Number(message.p);
        match.moves[side] = { m: message.m, p: Math.max(0, Math.min(1, Number.isFinite(power) ? power : 0)) };
        const opponentId = side === 'a' ? match.b : match.a;
        if (!match.moves[side === 'a' ? 'b' : 'a']) {
          events.push(wrestlingEvent([opponentId], { t: 'wr-wait', id: match.id }));
          return { changed: true, events };
        }
        return resolveSharedRound(wrestling, match, false);
      }
      if (type === 'wr-quit') {
        const index = wrestling.matches.findIndex((match) => match.a === p.id || match.b === p.id);
        if (index < 0) return { changed: false };
        const [match] = wrestling.matches.splice(index, 1);
        const winner = match.a === p.id ? match.b : match.a;
        events.push(wrestlingEvent([match.a, match.b], { t: 'wr-end', id: match.id, winner, playerIds: [match.a, match.b], reason: 'left' }));
        return { changed: true, events };
      }
      return { changed: false };
    });
  } catch (error) {
    console.error(`Could not process ${type} in shared wrestling:`, error.message);
    conn.send({ t: 'error', why: 'storage' });
  }
}
async function endSharedWrestlingOnLeave(r, playerId) {
  if (!roomStore.sharedRealtime) return;
  try {
    await mutateSharedWrestling(r, (wrestling) => {
      const before = wrestling.invites.length;
      wrestling.invites = wrestling.invites.filter((invite) => invite.from !== playerId && invite.to !== playerId);
      const index = wrestling.matches.findIndex((match) => match.a === playerId || match.b === playerId);
      if (index < 0) return { changed: wrestling.invites.length !== before };
      const [match] = wrestling.matches.splice(index, 1);
      const winner = match.a === playerId ? match.b : match.a;
      return {
        changed: true,
        events: [wrestlingEvent([match.a, match.b], { t: 'wr-end', id: match.id, winner, playerIds: [match.a, match.b], reason: 'left' })],
      };
    });
  } catch (error) {
    console.error('Could not finish shared wrestling after player left:', error.message);
  }
}
async function refreshPresence() {
  if (!roomStore.sharedRealtime) return;
  const stale = await roomStore.refreshPresence(INSTANCE_ID);
  for (const player of stale) {
    const r = rooms.get(player.room_code) || room(player.room_code);
    const wasOnline = r.remotePlayers.delete(player.id);
    await endSharedWrestlingOnLeave(r, player.id);
    if (wasOnline) broadcast(r, { t: 'leave', id: player.id });
  }
}
/** The room's bounded history of phrases, emotes, joins and leaves. */
const CHAT_KEEP = 30, SAY_GAP = 1000;
function cleanChatLine(line) {
  if (!line || typeof line !== 'object' || Array.isArray(line)) return null;
  const { k } = line;
  if (!['p', 'e', 'join', 'leave'].includes(k)) return null;
  const id = String(line.id || '').slice(0, 24);
  if (!/^[\w-]{4,24}$/.test(id)) return null;
  const clean = { k, id, n: cleanName(line.n) };
  if (k === 'p' || k === 'e') {
    const max = k === 'e' ? R.EMOTES.length : R.PHRASES.length;
    if (!Number.isInteger(line.i) || line.i < 0 || line.i >= max) return null;
    clean.i = line.i;
  }
  return clean;
}
function restoreChat(lines) {
  return Array.isArray(lines) ? lines.map(cleanChatLine).filter(Boolean).slice(-CHAT_KEEP) : [];
}
function logChat(r, line) {
  r.chat.push(line);
  if (r.chat.length > CHAT_KEEP) r.chat.splice(0, r.chat.length - CHAT_KEEP);
  markDirty();
}
function updatePresence(p) {
  const now = Date.now();
  if (now - (p.presenceUpdatedAt || 0) < 500) return;
  p.presenceUpdatedAt = now;
  roomStore.updatePresence(INSTANCE_ID, pub(p)).catch((error) => console.error('Could not update player presence:', error.message));
}
function syncPlayerLevel(conn) {
  const p = conn.player;
  if (!p || !conn.room || !conn.wallet) return;
  const level = walletLevel(conn.wallet);
  if (p.lvl === level) return;
  p.lvl = level;
  updatePresence(p);
  broadcast(conn.room, { t: 'look', id: p.id, look: p.look, lvl: level }, conn);
}

async function joinPlayer(conn, message, code, id, now) {
  const account = await roomStore.getAccount(id, walletSeed(message.wallet), inventorySeed(message.inventory));
  const storedProgress = await roomStore.getProgress(id, sanitizeProgress(message.progress));
  const progress = { revision: storedProgress.revision, state: sanitizeProgress(storedProgress.state) };
  await leave(conn);
  const r = room(code);
  const latestState = await roomStore.getRoomState(code);
  if (latestState) {
    r.lots = normalizeLots(latestState.lots);
    r.chat = restoreChat(latestState.chat);
    saved[code] = latestState;
  }
  const old = r.players.get(id);
  const replacingRemote = r.remotePlayers.has(id);
  if (old) {
    old.conn.player = null; old.conn.room = null;
    old.conn.send({ t: 'replaced' });
    setTimeout(() => old.conn.socket.destroy(), 50);
  }
  const p = { id, conn, name: cleanName(message.name), look: ownedLook(message.look, account.inventory), lvl: walletLevel(account.wallet), x: numf(message.x, 0.5, R.W - 2), y: numf(message.y, 0.5, R.H - 2), dir: num(message.dir, 0, 3) };
  const previousInstance = await roomStore.registerPresence(INSTANCE_ID, code, pub(p));
  if (conn.socket.destroyed) {
    await roomStore.removePresence(INSTANCE_ID, p.id);
    return;
  }
  if (roomStore.sharedRealtime && (old || replacingRemote || previousInstance)) {
    await endSharedWrestlingOnLeave(r, p.id);
  }
  if (previousInstance && previousInstance !== INSTANCE_ID) {
    await roomStore.publishRealtime({ room: code, instanceId: INSTANCE_ID, message: { t: 'replaced', id } });
  }
  const online = await roomStore.listPresence(code);
  if (conn.socket.destroyed) {
    await roomStore.removePresence(INSTANCE_ID, p.id);
    return;
  }
  r.remotePlayers.clear();
  for (const player of online) if (player.id !== id && !r.players.has(player.id)) r.remotePlayers.set(player.id, player);
  r.players.set(id, p); conn.player = p; conn.room = r;
  if (!old && !replacingRemote && !previousInstance) logChat(r, { k: 'join', id, n: p.name });
  const players = [
    ...[...r.players.values()].filter((player) => player !== p).map(pub),
    ...r.remotePlayers.values(),
  ];
  conn.wallet = account.wallet;
  conn.inventory = account.inventory;
  conn.progressRevision = progress.revision;
  conn.send({ t: 'welcome', v: R.VERSION, now, day: villageDay(), room: code, players, lots: r.lots, chat: r.chat, wallet: account.wallet, inventory: account.inventory, progress });
  const replacing = Boolean(old || replacingRemote || previousInstance);
  broadcast(r, { t: 'join', p: pub(p), ...(replacing ? { replace: true } : {}) }, conn);
  census();
}

async function handleWalletOperation(conn, message) {
  const p = conn.player;
  if (!p) return;
  const operation = String(message.op || '');
  const action = message.action;
  const coins = message.coins, xp = message.xp;
  if (!/^[a-f0-9]{32}$/i.test(operation)) return conn.send({ t: 'wallet-result', op: operation.slice(0, 40), accepted: false, reason: 'invalid', wallet: conn.wallet });
  const valid = action === 'reward'
    ? Number.isInteger(coins) && coins >= 0 && coins <= 10_000 && Number.isInteger(xp) && xp >= 0 && xp <= 100 && (coins > 0 || xp > 0)
    : action === 'spend' && Number.isInteger(coins) && coins > 0 && coins <= 10_000 && xp === 0;
  if (!valid) return conn.send({ t: 'wallet-result', op: operation, accepted: false, reason: 'invalid', wallet: conn.wallet });

  try {
    const outcome = await roomStore.mutateWallet(p.id, operation, (wallet) => {
      if (action === 'spend' && wallet.coins < coins) {
        return { changed: false, result: { accepted: false, reason: 'insufficient' } };
      }
      if (action === 'reward' && (wallet.coins > WALLET_MAX - coins || wallet.xp > WALLET_MAX - xp)) {
        return { changed: false, result: { accepted: false, reason: 'limit' } };
      }
      return {
        changed: true,
        wallet: { coins: wallet.coins + (action === 'reward' ? coins : -coins), xp: wallet.xp + xp },
        result: { accepted: true },
      };
    });
    conn.wallet = outcome.wallet;
    conn.inventory = outcome.inventory;
    syncPlayerLevel(conn);
    conn.send({ t: 'wallet-result', op: operation, ...outcome.result, wallet: outcome.wallet });
  } catch (error) {
    console.error('Could not update player wallet:', error.message);
    conn.send({ t: 'wallet-result', op: operation, accepted: false, reason: 'storage', wallet: conn.wallet });
  }
}

function villageDay(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function villageSeason(day) {
  const [year, month, date] = day.split('-').map(Number);
  const index = Math.floor(Date.UTC(year, month - 1, date) / 864e5) % 4;
  return ['spring', 'summer', 'autumn', 'winter'][index];
}
async function handleQuestClaim(conn, message) {
  const p = conn.player;
  if (!p) return;
  const quest = typeof message.quest === 'string' && message.quest.length <= 16 ? message.quest : '';
  const reward = Object.hasOwn(R.DAILY_QUEST_REWARDS, quest) ? R.DAILY_QUEST_REWARDS[quest] : null;
  if (!reward || !Number.isSafeInteger(message.revision) || message.revision < 0
    || !message.state || typeof message.state !== 'object' || Array.isArray(message.state)) {
    return conn.send({ t: 'quest-claim-result', quest, accepted: false, reason: 'invalid', wallet: conn.wallet });
  }
  let progress;
  try {
    progress = await roomStore.saveProgress(p.id, message.revision, sanitizeProgress(message.state));
    conn.progressRevision = progress.revision;
    if (!progress.accepted) {
      return conn.send({
        t: 'quest-claim-result', quest, accepted: false, reason: 'stale',
        wallet: conn.wallet, progress: { revision: progress.revision, state: progress.state },
      });
    }
    const day = villageDay();
    const daily = progress.state.quests;
    if (daily.d !== day) {
      return conn.send({
        t: 'quest-claim-result', quest, accepted: false, reason: 'day',
        wallet: conn.wallet, progress: { revision: progress.revision, state: progress.state },
      });
    }
    const task = daily.list.find((entry) => entry.k === quest);
    const assigned = R.dailyQuests(p.id, day).find((entry) => entry.k === quest);
    const target = R.QUEST_TARGETS[quest];
    if (!assigned) {
      return conn.send({
        t: 'quest-claim-result', quest, accepted: false, reason: 'not-assigned',
        wallet: conn.wallet, progress: { revision: progress.revision, state: progress.state },
      });
    }
    if (!task || task.p < target) {
      return conn.send({
        t: 'quest-claim-result', quest, accepted: false, reason: 'incomplete',
        wallet: conn.wallet, progress: { revision: progress.revision, state: progress.state },
      });
    }
    const multiplier = assigned.season && assigned.season === villageSeason(day) ? 1.5 : 1;
    const coins = Math.round(reward.coins * multiplier), xp = Math.round(reward.xp * multiplier);
    const operation = `quest:${day}:${quest}`;
    const outcome = await roomStore.mutateWallet(p.id, operation, (wallet) => {
      if (wallet.coins > WALLET_MAX - coins || wallet.xp > WALLET_MAX - xp) {
        return { changed: false, result: { accepted: false, reason: 'limit' } };
      }
      return {
        changed: true,
        wallet: { coins: wallet.coins + coins, xp: wallet.xp + xp },
        result: { accepted: true },
      };
    });
    conn.wallet = outcome.wallet;
    conn.inventory = outcome.inventory;
    syncPlayerLevel(conn);
    conn.send({
      t: 'quest-claim-result', quest, ...outcome.result, duplicate: outcome.duplicate, wallet: outcome.wallet,
      progress: { revision: progress.revision, state: progress.state },
      reward: outcome.result.accepted ? { coins, xp } : undefined,
    });
  } catch (error) {
    console.error('Could not claim daily quest reward:', error.message);
    conn.send({
      t: 'quest-claim-result', quest, accepted: false, reason: 'storage', wallet: conn.wallet,
      ...(progress && { progress: { revision: progress.revision, state: progress.state } }),
    });
  }
}

async function handleShopPurchase(conn, message) {
  const p = conn.player;
  if (!p) return;
  const operation = String(message.op || '');
  const itemId = message.item;
  if (!/^[a-f0-9]{32}$/i.test(operation)) {
    return conn.send({ t: 'inventory-result', op: operation.slice(0, 40), accepted: false, reason: 'invalid', wallet: conn.wallet, inventory: conn.inventory });
  }
  const item = typeof itemId === 'string' && itemId.length <= 32 ? R.ITEMS.find((entry) => entry.id === itemId) : null;
  if (!item) return conn.send({ t: 'inventory-result', op: operation, accepted: false, reason: 'invalid', wallet: conn.wallet, inventory: conn.inventory });
  try {
    const outcome = await roomStore.mutateWallet(p.id, operation, (wallet, inventory) => {
      const alreadyOwned = item.cat === 'tool' ? inventory.rod >= item.val : inventory.owned.includes(item.id);
      if (alreadyOwned) return { changed: false, result: { accepted: false, reason: 'owned' } };
      if (R.level(wallet.xp).l < item.lvl) return { changed: false, result: { accepted: false, reason: 'level' } };
      if (wallet.coins < item.price) return { changed: false, result: { accepted: false, reason: 'insufficient' } };
      const nextInventory = item.cat === 'tool'
        ? { ...inventory, rod: item.val }
        : { ...inventory, owned: [...inventory.owned, item.id] };
      return {
        changed: true,
        wallet: { ...wallet, coins: wallet.coins - item.price },
        inventory: nextInventory,
        result: { accepted: true },
      };
    });
    conn.wallet = outcome.wallet;
    conn.inventory = outcome.inventory;
    conn.send({ t: 'inventory-result', op: operation, ...outcome.result, wallet: outcome.wallet, inventory: outcome.inventory });
  } catch (error) {
    console.error('Could not purchase player shop item:', error.message);
    conn.send({ t: 'inventory-result', op: operation, accepted: false, reason: 'storage', wallet: conn.wallet, inventory: conn.inventory });
  }
}

async function handleProgressSave(conn, message) {
  if (!conn.player) return;
  if (!Number.isSafeInteger(message.revision) || message.revision < 0
    || !message.state || typeof message.state !== 'object' || Array.isArray(message.state)) {
    return conn.send({ t: 'progress-result', accepted: false, reason: 'invalid', revision: conn.progressRevision });
  }
  try {
    const result = await roomStore.saveProgress(conn.player.id, message.revision, sanitizeProgress(message.state));
    conn.progressRevision = result.revision;
    conn.send({ t: 'progress-result', ...result });
  } catch (error) {
    console.error('Could not save player progress:', error.message);
    conn.send({ t: 'progress-result', accepted: false, reason: 'storage', revision: conn.progressRevision });
  }
}

async function persistLotAction(conn, action, message) {
  const p = conn.player, r = conn.room;
  if (!p || !r) return;
  const i = message.i;
  if (action === 'claim' && (!Number.isInteger(i) || i < 0 || i >= R.LOTS)) return;
  if (action !== 'claim' && (!Number.isInteger(i) || i < 0 || i >= R.LOTS)) return;

  try {
    const { state, result } = await roomStore.mutateRoom(
      r.code,
      { lots: r.lots, chat: r.chat },
      (current) => {
        const lots = normalizeLots(current.lots);
        let lot = lots[i];
        if (action === 'claim') {
          if (lot) return { changed: false, deny: 'taken' };
          if (lots.some((owned) => owned && owned.by === p.id)) return { changed: false, deny: 'own' };
          lot = {
            by: p.id,
            n: p.name,
            roof: Object.hasOwn(R.ROOF, message.roof) ? message.roof : 'blue',
            door: Object.hasOwn(R.DOOR, message.door) ? message.door : 'red',
            furn: [],
            stage: Number.isInteger(message.stage) ? Math.max(1, Math.min(R.GER_DONE, message.stage)) : 1,
          };
          lots[i] = lot;
        } else {
          if (!lot || lot.by !== p.id) return { changed: false };
          if (action === 'stage') {
            if (!Number.isInteger(message.stage)) return { changed: false };
            lot.stage = Math.max(1, Math.min(R.GER_DONE, message.stage));
          } else {
            if (Object.hasOwn(R.ROOF, message.roof)) lot.roof = message.roof;
            if (Object.hasOwn(R.DOOR, message.door)) lot.door = message.door;
            if (Array.isArray(message.furn)) {
              lot.furn = [...new Set(message.furn.filter((furniture) => R.FURNITURE.some((item) => item.id === furniture)))].slice(0, 12);
            }
            lot.n = p.name;
          }
        }
        current.lots = lots;
        return { changed: true, event: { t: 'lot', act: action, i, lot, by: p.id } };
      },
    );
    r.lots = normalizeLots(state.lots);
    saved[r.code] = { ...(saved[r.code] || {}), lots: r.lots };
    if (result.deny) conn.send({ t: 'deny', act: 'ger', why: result.deny });
    if (result.event) broadcast(r, result.event);
  } catch (error) {
    console.error('Could not save shared ger state:', error.message);
    conn.send({ t: 'error', why: 'storage' });
  }
}

function onMessage(conn, text) {
  const t = Date.now();                                     // simple rate limit: ~20 messages per second
  conn.tokens = Math.min(30, conn.tokens + ((t - conn.last) / 1000) * 20); conn.last = t;
  if ((conn.tokens -= 1) < 0) return;
  let m; try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m.t !== 'string') return;

  if (m.t === 'join') {
    const code = String(m.room || '').toUpperCase();
    const id = String(m.id || '').slice(0, 24);
    if (!R.ROOM_RE.test(code) || !/^[\w-]{4,24}$/.test(id)) return conn.send({ t: 'error', why: 'bad-join' });
    roomStore.authenticatePlayer(id, m.ticket).then((authenticated) => {
      if (!authenticated) {
        conn.send({ t: 'error', why: 'identity' });
        setTimeout(() => conn.socket.destroy(), 50);
        return;
      }
      return joinPlayer(conn, m, code, id, t);
    }).catch((error) => {
      console.error('Could not join multiplayer room:', error.message);
      conn.send({ t: 'error', why: 'storage' });
    });
    return;
  }
  const p = conn.player, r = conn.room;
  if (!p || !r) return;
  switch (m.t) {
    case 'move':
      p.x = numf(m.x, 0.5, R.W - 2); p.y = numf(m.y, 0.5, R.H - 2); p.dir = num(m.dir, 0, 3);
      updatePresence(p);
      broadcast(r, { t: 'move', id: p.id, x: p.x, y: p.y, dir: p.dir }, conn);
      break;
    case 'jump': { // show other players your jump, at most a few times a second
      const t = Date.now(); if (t - (p.jt || 0) < 300) return; p.jt = t;
      broadcast(r, { t: 'jump', id: p.id }, conn);
      break;
    }
    case 'look':
      p.look = ownedLook(m.look, conn.inventory); p.lvl = walletLevel(conn.wallet);
      updatePresence(p);
      broadcast(r, { t: 'look', id: p.id, look: p.look, lvl: p.lvl }, conn);
      break;
    case 'say': {
      const kind = m.k === 'e' ? 'e' : 'p', max = kind === 'e' ? R.EMOTES.length : R.PHRASES.length;
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= max) return;
      const t = Date.now(); if (t - (p.st || 0) < SAY_GAP) return; p.st = t; // one phrase a second, so nobody floods the room
      logChat(r, { k: kind, id: p.id, n: p.name, i: m.i });
      broadcast(r, { t: 'say', id: p.id, n: p.name, k: kind, i: m.i });   // to everyone, including the sender
      break;
    }
    case 'wallet-op':
      handleWalletOperation(conn, m);
      break;
    case 'quest-claim':
      handleQuestClaim(conn, m);
      break;
    case 'shop-buy':
      handleShopPurchase(conn, m);
      break;
    case 'progress-save':
      handleProgressSave(conn, m);
      break;
    // ---- own ger
    case 'ger-claim':
      persistLotAction(conn, 'claim', m);
      break;
    case 'ger-stage': {
      const i = r.lots.findIndex((lot) => lot && lot.by === p.id);
      if (i >= 0) persistLotAction(conn, 'stage', { ...m, i });
      break;
    }
    case 'ger-style': {
      const i = r.lots.findIndex((l) => l && l.by === p.id); if (i < 0) return;
      persistLotAction(conn, 'style', { ...m, i });
      break;
    }
    // ---- live wrestling
    case 'wr-invite': {
      if (roomStore.sharedRealtime) {
        handleSharedWrestling(conn, 'wr-invite', m);
        break;
      }
      const to = r.players.get(String(m.to));
      if (!to || to === p || to.match || p.match) return conn.send({ t: 'deny', act: 'wr', why: 'busy' });
      (to.invites = to.invites || new Set()).add(p.id);
      to.conn.send({ t: 'wr-invite', from: p.id, name: p.name });
      break;
    }
    case 'wr-decline': {
      if (roomStore.sharedRealtime) {
        handleSharedWrestling(conn, 'wr-decline', m);
        break;
      }
      const from = r.players.get(String(m.from)); if (p.invites) p.invites.delete(String(m.from));
      if (from) from.conn.send({ t: 'wr-declined', by: p.id, name: p.name });
      break;
    }
    case 'wr-accept': {
      if (roomStore.sharedRealtime) {
        handleSharedWrestling(conn, 'wr-accept', m);
        break;
      }
      const from = r.players.get(String(m.from));
      if (!from || !p.invites || !p.invites.has(from.id) || from.match || p.match) return conn.send({ t: 'deny', act: 'wr', why: 'busy' });
      p.invites.delete(from.id);
      const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const match = { id, a: from.id, b: p.id, score: { a: 0, b: 0 }, moves: {}, timer: null };
      r.matches.set(id, match); from.match = p.match = id;
      const info = (q) => ({ id: q.id, name: q.name, look: q.look });
      for (const q of [from, p]) q.conn.send({ t: 'wr-start', id, a: info(from), b: info(p) });
      armMatch(r, match);
      break;
    }
    case 'wr-move': {
      if (roomStore.sharedRealtime) {
        handleSharedWrestling(conn, 'wr-move', m);
        break;
      }
      const match = p.match && r.matches.get(p.match); if (!match) return;
      const side = match.a === p.id ? 'a' : 'b';
      if (match.moves[side] || !R.MOVES.some((x) => x.id === m.m)) return;
      match.moves[side] = { m: m.m, p: Math.max(0, Math.min(1, Number(m.p) || 0)) };
      const other = r.players.get(side === 'a' ? match.b : match.a); if (other) other.conn.send({ t: 'wr-wait' });
      if (match.moves.a && match.moves.b) resolveMatch(r, match);
      break;
    }
    case 'wr-quit': {
      if (roomStore.sharedRealtime) {
        handleSharedWrestling(conn, 'wr-quit', m);
        break;
      }
      const match = p.match && r.matches.get(p.match); if (!match) return;
      endMatch(r, match, match.a === p.id ? match.b : match.a, 'left');
      break;
    }
  }
}
function armMatch(r, match) {
  clearTimeout(match.timer);
  match.timer = setTimeout(() => {          // a player who never answers gets a weak random move
    for (const side of ['a', 'b']) if (!match.moves[side]) match.moves[side] = { m: R.MOVES[Math.floor(Math.random() * R.MOVES.length)].id, p: 0.15 };
    resolveMatch(r, match);
  }, 25000);
  match.timer.unref && match.timer.unref();
}
function resolveMatch(r, match) {
  const { a, b } = match.moves, res = R.exchange(a.m, a.p, b.m, b.p);
  if (res > 0) match.score.a++; else if (res < 0) match.score.b++;
  match.moves = {};
  for (const id of [match.a, match.b]) { const q = r.players.get(id); if (q) q.conn.send({ t: 'wr-result', ma: a.m, pa: a.p, mb: b.m, pb: b.p, r: res, score: match.score }); }
  if (match.score.a >= 2 || match.score.b >= 2) endMatch(r, match, match.score.a > match.score.b ? match.a : match.b, '');
  else armMatch(r, match);
}
function endMatch(r, match, winner, reason) {
  clearTimeout(match.timer); r.matches.delete(match.id);
  const message = { t: 'wr-end', id: match.id, winner, playerIds: [match.a, match.b], reason };
  for (const id of [match.a, match.b]) { const q = r.players.get(id); if (q) { q.match = null; q.conn.send(message); } }
  awardWrestlingResult(r, message);
}
function leave(conn) {
  const p = conn.player, r = conn.room;
  conn.player = null; conn.room = null;
  if (!p || !r || r.players.get(p.id) !== p) return Promise.resolve();
  if (!roomStore.sharedRealtime && p.match && r.matches.get(p.match)) {
    const match = r.matches.get(p.match);
    endMatch(r, match, match.a === p.id ? match.b : match.a, 'left');
  }
  r.players.delete(p.id);
  const removed = roomStore.removePresence(INSTANCE_ID, p.id).catch((error) => console.error('Could not remove player presence:', error.message));
  const endedWrestling = endSharedWrestlingOnLeave(r, p.id);
  logChat(r, { k: 'leave', id: p.id, n: p.name });
  broadcast(r, { t: 'leave', id: p.id });
  census();
  return Promise.all([removed, endedWrestling]);
}

// ---------------------------------------------------------------- start
const server = http.createServer(serveStatic);
server.on('upgrade', upgrade);
let tries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && PORT !== 0 && tries < 10) {
    // the port is taken (often another copy of Naadamy): say so and use the next free port
    const busy = actualPort;
    http.get({ host: '127.0.0.1', port: busy, path: '/api/hello', timeout: 800 }, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => { if (/naadamy/.test(b)) console.log(`  Note: Naadamy is already running on port ${busy}. You can just open http://localhost:${busy}`); }); }).on('error', () => {});
    tries++; actualPort++;
    console.log(`  Port ${busy} is busy, trying ${actualPort}…`);
    return setTimeout(() => server.listen(actualPort, '0.0.0.0'), 150);
  }
  console.error('  Could not start the server:', err.message);
  process.exit(1);
});
server.on('listening', () => {
  const port = actualPort = server.address().port, ips = lanIPs();
  console.log(`\n  \x1b[1mNaadamy is running!\x1b[0m\n\n  On this computer:  http://localhost:${port}`);
  ips.forEach((ip) => console.log(`  Same Wi-Fi:        \x1b[1mhttp://${ip}:${port}\x1b[0m`));
  if (ips.length && process.stdout.isTTY) { console.log('\n  Friends on the same Wi-Fi can scan this with their phone camera:\n'); console.log(QR.toTerminal(`http://${ips[0]}:${port}/`).split('\n').map((l) => '  ' + l).join('\n')); }
  console.log(basar.enabled ? `\n  Basar AI: on (${basar.model})` : '\n  Basar AI: offline mode (add ANTHROPIC_API_KEY to a .env file to turn on the AI buddy)');
  console.log('\n  If friends cannot connect: some school/guest Wi-Fi blocks devices from');
  console.log('  seeing each other. Use a phone hotspot or a home router instead.');
  console.log('\n  Press Ctrl+C to stop.\n');
  if (process.send) process.send({ port });
});
roomStore.load().then(async (state) => {
  saved = state;
  await roomStore.startRealtime(INSTANCE_ID, handleRealtime);
  server.listen(PORT, '0.0.0.0');
}).catch(async (error) => {
  console.error('Could not initialize room storage:', error.message);
  try { await roomStore.close(); } catch (closeError) { console.error('Could not close room storage:', closeError.message); }
  process.exit(1);
});
