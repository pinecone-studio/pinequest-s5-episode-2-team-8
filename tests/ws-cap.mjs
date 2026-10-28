// Per-address WebSocket caps: open connections at once and new connections per minute; over either the upgrade gets a 429,
// a closed connection gives its slot back (close frame, bare drop, or the server destroying it), and a server-wide total gives a 503.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [], servers = [];
const fails = [], ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('✗ ' + m); fails.push(m); } };

async function start(extra) {
  const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-wscap-')); dirs.push(dataDir);
  const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, DATABASE_URL: '', ...extra }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  servers.push(server);
  const port = await new Promise((resolveP, reject) => {
    server.on('message', (m) => m.port && resolveP(m.port));
    server.once('exit', (c) => reject(new Error('server exited ' + c)));
  });
  return { port };
}
/** Opens a raw WebSocket; resolves { status, text, socket } from the first response (status 0 if it never answers). */
const open = ({ port }) => new Promise((resolveP) => {
  const s = net.connect(port, '127.0.0.1');
  const done = (status, text = '') => { clearTimeout(timer); resolveP({ status, text, socket: s }); };
  const timer = setTimeout(() => done(0), 3000);
  s.on('connect', () => s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
  s.once('data', (d) => done(Number(String(d).slice(9, 12)), String(d)));
  s.on('error', () => done(0));
  s.on('close', () => done(0));
});
const gone = (c) => new Promise((r) => (c.socket.destroyed ? r() : c.socket.once('close', r)));
// give the server a moment to run its close handler after we see the socket end
const settle = () => new Promise((r) => setTimeout(r, 50));
// a masked close frame: the server ends the socket
const bye = async (c) => { c.socket.write(Buffer.from([0x88, 0x80, 0, 0, 0, 0])); await gone(c); await settle(); };

try {
  // 1. open-connection cap, slot returned on close frame
  const A = await start({ WS_MAX_PER_IP: '3', WS_NEW_PER_MIN: '6' });
  const a = [await open(A), await open(A), await open(A)];
  ok(a.every((c) => c.status === 101), 'three connections from one address are accepted');
  const over = await open(A);
  ok(over.status === 429 && /Retry-After: 60/.test(over.text), 'the fourth open connection gets 429 with Retry-After');
  await bye(a[0]);
  const again = await open(A);
  ok(again.status === 101, 'after a close frame, a new connection is accepted');

  // 2. a client that drops the connection without a close frame frees its slot
  a[1].socket.destroy(); await gone(a[1]); await settle();
  const afterDrop = await open(A);
  ok(afterDrop.status === 101, 'after a bare drop (no close frame), a new connection is accepted');

  // 3. the server destroying the socket (an unmasked frame is a protocol error) frees the slot
  // open now: a[2], again, afterDrop = 3; accepted this minute: 5
  a[2].socket.write(Buffer.from([0x81, 0x01, 0x78])); await gone(a[2]); await settle();
  const afterKick = await open(A);
  ok(afterKick.status === 101, 'after the server destroys a socket, a new connection is accepted');

  // 4. per-minute cap: 6 accepted this minute, so the next is refused though only 3 are open
  const sixth = await open(A);
  ok(sixth.status === 429, 'the seventh new connection in a minute gets 429 though few are open');
  for (const c of [again, afterDrop, afterKick, over, sixth]) c.socket.destroy();

  // 5. server-wide total
  const T = await start({ WS_MAX_TOTAL: '2' });
  const t = [await open(T), await open(T)];
  const full = await open(T);
  ok(t.every((c) => c.status === 101) && full.status === 503 && /Retry-After: 30/.test(full.text), 'over the server-wide total the upgrade gets 503 with Retry-After');
  await bye(t[0]);
  const room = await open(T);
  ok(room.status === 101, 'after one closes, the server-wide total has room again');
  for (const c of [t[1], full, room]) c.socket.destroy();
} finally {
  for (const s of servers) s.kill();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
if (fails.length) { console.log(fails.length + ' failed'); process.exit(1); }
console.log('all ws-cap checks passed');
