#!/usr/bin/env node
/* Naadamy server: serves the app and links players into a shared village (Нутаг).
   Zero dependencies: only Node's built-in modules, so nothing to install and no licenses.

   Run:  node server.js            (port 8000)
         PORT=3000 node server.js
   Everyone on the same Wi-Fi opens http://<this-computer-ip>:8000 and plays together. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const R = require('./js/village/rules.js');
const QR = require('./js/qr.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || process.argv[2] || 8000);
const lanIPs = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
let actualPort = PORT;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const BLOCKED = [/^\/data(\/|$)/, /^\/\.git/, /^\/server\.js$/, /^\/node_modules/];

// ---------------------------------------------------------------- static files
function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/hello') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ naadamy: true, rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0), urls: lanIPs().map((ip) => `http://${ip}:${actualPort}/`) }));
  }
  let p = decodeURIComponent(url.pathname);
  if (BLOCKED.some((re) => re.test(p))) { res.writeHead(404); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const cache = /\.(woff2|m4a|mp3|ogg|wav)$/.test(file) ? 'public, max-age=604800' : 'no-cache';
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

// ---------------------------------------------------------------- rooms + saved gardens
const rooms = new Map(); // code -> { code, players: Map(id -> player), plots: [] }
let saved = {};
try { saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { saved = {}; }
let dirty = false;
function room(code) {
  if (!rooms.has(code)) {
    const plots = Array.isArray(saved[code] && saved[code].plots) ? saved[code].plots.slice(0, R.PLOTS) : [];
    while (plots.length < R.PLOTS) plots.push(null);
    const lots = Array.isArray(saved[code] && saved[code].lots) ? saved[code].lots.slice(0, R.LOTS) : [];
    while (lots.length < R.LOTS) lots.push(null);
    rooms.set(code, { code, players: new Map(), plots, lots, matches: new Map() });
  }
  return rooms.get(code);
}
function persist() {
  if (!dirty) return;
  dirty = false;
  for (const r of rooms.values()) saved[r.code] = { plots: r.plots, lots: r.lots, t: Date.now() };
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(saved)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); }
  catch (e) { console.error('Could not save gardens:', e.message); }
}
setInterval(persist, 5000).unref();
process.on('SIGINT', () => { persist(); process.exit(0); });
process.on('SIGTERM', () => { persist(); process.exit(0); });

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
  socket.on('close', () => leave(conn));
  socket.on('error', () => leave(conn));
  conns.add(conn);
}
const conns = new Set();
setInterval(() => {
  for (const c of conns) {
    if (!c.alive) { c.socket.destroy(); continue; }
    c.alive = false;
    try { c.socket.write(frame(9, Buffer.alloc(0))); } catch { c.socket.destroy(); }
  }
}, 20000).unref();

// ---------------------------------------------------------------- game protocol
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo);
const numf = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : lo); // positions with 2 decimals for smooth movement
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Найз';
const pub = (p) => ({ id: p.id, name: p.name, look: p.look, lvl: p.lvl, x: p.x, y: p.y, dir: p.dir });
function broadcast(r, msg, except) { for (const p of r.players.values()) if (p.conn !== except) p.conn.send(msg); }

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
    leave(conn);
    const r = room(code);
    const old = r.players.get(id);
    if (old) { old.conn.player = null; old.conn.socket.destroy(); }  // same player in another tab: keep the newest
    const p = { id, conn, name: cleanName(m.name), look: R.cleanLook(m.look), lvl: num(m.lvl, 1, 99), x: numf(m.x, 0.5, R.W - 2), y: numf(m.y, 0.5, R.H - 2), dir: num(m.dir, 0, 3) };
    r.players.set(id, p); conn.player = p; conn.room = r;
    r.plots.forEach((pl) => R.normalize(pl, t));
    conn.send({ t: 'welcome', now: t, room: code, players: [...r.players.values()].filter((x) => x !== p).map(pub), plots: r.plots, lots: r.lots });
    broadcast(r, { t: 'join', p: pub(p) }, conn);
    return;
  }
  const p = conn.player, r = conn.room;
  if (!p || !r) return;
  switch (m.t) {
    case 'move':
      p.x = numf(m.x, 0.5, R.W - 2); p.y = numf(m.y, 0.5, R.H - 2); p.dir = num(m.dir, 0, 3);
      broadcast(r, { t: 'move', id: p.id, x: p.x, y: p.y, dir: p.dir }, conn);
      break;
    case 'look':
      p.look = R.cleanLook(m.look); p.lvl = num(m.lvl, 1, 99);
      broadcast(r, { t: 'look', id: p.id, look: p.look, lvl: p.lvl }, conn);
      break;
    case 'say': {
      const kind = m.k === 'e' ? 'e' : 'p', max = kind === 'e' ? R.EMOTES.length : R.PHRASES.length;
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= max) return;
      broadcast(r, { t: 'say', id: p.id, k: kind, i: m.i });   // to everyone, including the sender
      break;
    }
    case 'plant': case 'water': case 'harvest': {
      const res = R.applyAction(r.plots, m.t, m.i, { c: m.c }, { id: p.id, name: p.name }, t);
      if (!res.ok) return conn.send({ t: 'deny', act: m.t, i: m.i, why: res.why });
      dirty = true;
      broadcast(r, { t: 'plot', act: m.t, i: m.i, plot: res.plot, by: p.id, byName: p.name, crop: res.crop, helped: !!res.helped, planter: res.planter || (res.plot && res.plot.by) });
      break;
    }
    // ---- own ger
    case 'ger-buy': {
      const i = m.i;
      if (!Number.isInteger(i) || i < 0 || i >= R.LOTS) return;
      if (r.lots[i]) return conn.send({ t: 'deny', act: 'ger', why: 'taken' });
      if (r.lots.some((l) => l && l.by === p.id)) return conn.send({ t: 'deny', act: 'ger', why: 'own' });
      r.lots[i] = { by: p.id, n: p.name, roof: R.ROOF[m.roof] ? m.roof : 'blue', door: R.DOOR[m.door] ? m.door : 'red', furn: [] };
      dirty = true;
      broadcast(r, { t: 'lot', act: 'buy', i, lot: r.lots[i], by: p.id });
      break;
    }
    case 'ger-style': {
      const i = r.lots.findIndex((l) => l && l.by === p.id); if (i < 0) return;
      const l = r.lots[i];
      if (R.ROOF[m.roof]) l.roof = m.roof;
      if (R.DOOR[m.door]) l.door = m.door;
      if (Array.isArray(m.furn)) l.furn = [...new Set(m.furn.filter((f) => R.FURNITURE.some((x) => x.id === f)))].slice(0, 12);
      l.n = p.name; dirty = true;
      broadcast(r, { t: 'lot', act: 'style', i, lot: l, by: p.id });
      break;
    }
    // ---- live wrestling
    case 'wr-invite': {
      const to = r.players.get(String(m.to));
      if (!to || to === p || to.match || p.match) return conn.send({ t: 'deny', act: 'wr', why: 'busy' });
      (to.invites = to.invites || new Set()).add(p.id);
      to.conn.send({ t: 'wr-invite', from: p.id, name: p.name });
      break;
    }
    case 'wr-decline': {
      const from = r.players.get(String(m.from)); if (p.invites) p.invites.delete(String(m.from));
      if (from) from.conn.send({ t: 'wr-declined', by: p.id, name: p.name });
      break;
    }
    case 'wr-accept': {
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
      const match = p.match && r.matches.get(p.match); if (!match) return;
      const side = match.a === p.id ? 'a' : 'b';
      if (match.moves[side] || !R.MOVES.some((x) => x.id === m.m)) return;
      match.moves[side] = { m: m.m, p: Math.max(0, Math.min(1, Number(m.p) || 0)) };
      const other = r.players.get(side === 'a' ? match.b : match.a); if (other) other.conn.send({ t: 'wr-wait' });
      if (match.moves.a && match.moves.b) resolveMatch(r, match);
      break;
    }
    case 'wr-quit': {
      const match = p.match && r.matches.get(p.match); if (!match) return;
      endMatch(r, match, match.a === p.id ? match.b : match.a, 'left');
      break;
    }
  }
}
function armMatch(r, match) {
  clearTimeout(match.timer);
  match.timer = setTimeout(() => {          // a player who never answers gets a weak random move
    for (const side of ['a', 'b']) if (!match.moves[side]) match.moves[side] = { m: R.MOVES[Math.floor(Math.random() * 3)].id, p: 0.15 };
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
  for (const id of [match.a, match.b]) { const q = r.players.get(id); if (q) { q.match = null; q.conn.send({ t: 'wr-end', winner, reason }); } }
}
function leave(conn) {
  conns.delete(conn);
  const p = conn.player, r = conn.room;
  conn.player = null; conn.room = null;
  if (!p || !r || r.players.get(p.id) !== p) return;
  if (p.match && r.matches.get(p.match)) { const match = r.matches.get(p.match); endMatch(r, match, match.a === p.id ? match.b : match.a, 'left'); }
  r.players.delete(p.id);
  broadcast(r, { t: 'leave', id: p.id });
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
  console.log('\n  If friends cannot connect: some school/guest Wi-Fi blocks devices from');
  console.log('  seeing each other. Use a phone hotspot or a home router instead.');
  console.log('\n  Press Ctrl+C to stop.\n');
  if (process.send) process.send({ port });
});
server.listen(PORT, '0.0.0.0');
