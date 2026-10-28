// Server hardening: a malformed upgrade URL and broken WebSocket framing do not take the server down, a ger claim ignores the
// stage the client sends, and wrestling pay (none for a quit before any round, and capped per day) is decided by the server.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = createRequire(import.meta.url)('../web/js/village/rules.js');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-hardening-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('✗ ' + m); fails.push(m); } };

const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, DATABASE_URL: '' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
const port = await new Promise((resolveP, reject) => {
  server.on('message', (m) => m.port && resolveP(m.port));
  server.once('exit', (c) => reject(new Error('server exited ' + c)));
});
let alive = true;
server.once('exit', () => { alive = false; });

/** A raw HTTP upgrade request; resolves true when the server closes the connection. When `frames` is given they are sent after the handshake. */
function raw(requestLine, frames = []) {
  return new Promise((resolveP) => {
    const s = net.connect(port, '127.0.0.1');
    let handshook = false;
    s.on('connect', () => s.write(`${requestLine}\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    s.on('data', (d) => { if (!handshook && String(d).includes('101')) { handshook = true; for (const f of frames) s.write(f); } });
    s.on('close', () => resolveP(true));
    s.on('error', () => resolveP(true));
    setTimeout(() => { s.destroy(); resolveP(false); }, 1500);
  });
}
/** A masked client frame (mask key is all zeros, so the payload is sent as is). */
function clientFrame(op, payload, fin = true) {
  const data = Buffer.from(payload), len = data.length;
  const head = len < 126 ? Buffer.from([(fin ? 0x80 : 0) | op, 0x80 | len]) : Buffer.from([(fin ? 0x80 : 0) | op, 0x80 | 126, len >> 8, len & 255]);
  return Buffer.concat([head, Buffer.alloc(4), data]);
}

// 1. `GET //[` made `new URL` throw inside the upgrade handler and killed the process
ok(await raw('GET //[ HTTP/1.1'), 'an upgrade with an unparseable URL is closed');
await sleep(100);
ok(alive, 'the server survives an unparseable upgrade URL');

// 2. fragments: continuation with nothing open, new message inside one, unknown opcode, unbounded growth
ok(await raw('GET /ws HTTP/1.1', [clientFrame(0, 'x')]), 'a continuation frame with no open message closes the connection');
ok(await raw('GET /ws HTTP/1.1', [clientFrame(1, '{"t":', false), clientFrame(1, '"x"}')]), 'a new text message inside an open one closes the connection');
ok(await raw('GET /ws HTTP/1.1', [clientFrame(3, 'x')]), 'an unknown opcode closes the connection');
ok(await raw('GET /ws HTTP/1.1', [clientFrame(9, 'x'.repeat(126))]), 'a ping over 125 bytes closes the connection');
ok(await raw('GET /ws HTTP/1.1', [clientFrame(9, 'x', false)]), 'a split ping closes the connection');
const big = 'a'.repeat(10000);
ok(await raw('GET /ws HTTP/1.1', [clientFrame(1, big, false), clientFrame(0, big, false)]), 'fragments adding up past the size limit close the connection');
ok(alive, 'the server survives broken framing');

// a normal fragmented message still works
const sock = (id) => new Promise((resolveP, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), box = { ws, seen: [], id };
  ws.addEventListener('message', (e) => box.seen.push(JSON.parse(e.data)));
  ws.addEventListener('error', () => reject(new Error('websocket failed')));
  ws.addEventListener('open', () => resolveP(box));
});
const send = (box, obj) => box.ws.send(JSON.stringify(obj));
const waitFor = async (box, pred, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { const f = box.seen.find(pred); if (f) return f; await sleep(20); } return null; };
const joinRoom = async (id, x = 5) => {
  const box = await sock(id);
  send(box, { t: 'join', room: 'HARDN', id, ticket: randomBytes(32).toString('hex'), name: id, look: {}, x, y: 13 });
  const welcome = await waitFor(box, (m) => m.t === 'welcome');
  if (!welcome) throw new Error('no welcome for ' + id);
  box.wallet = welcome.wallet;
  return box;
};
{
  const fragmented = await new Promise((resolveP) => {
    const s = net.connect(port, '127.0.0.1');
    let hs = false;
    s.on('connect', () => s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
    s.on('data', (d) => {
      const text = d.toString('latin1');
      if (!hs && text.includes('101')) {
        hs = true;
        const m = JSON.stringify({ t: 'join', room: 'HARDN', id: 'frag-player', ticket: randomBytes(32).toString('hex'), name: 'F', look: {}, x: 5, y: 13 });
        s.write(clientFrame(1, m.slice(0, 20), false)); s.write(clientFrame(0, m.slice(20)));
      }
      if (text.includes('welcome')) { s.destroy(); resolveP(true); }
    });
    setTimeout(() => { s.destroy(); resolveP(false); }, 2000);
  });
  ok(fragmented, 'a message split over two frames still arrives');
}

// 4. ger-claim ignores the submitted stage
{
  const g = await joinRoom('ger-player');
  send(g, { t: 'ger-claim', i: 3, roof: 'blue', door: 'red', stage: 9 });
  const lot = await waitFor(g, (m) => m.t === 'lot' && m.act === 'claim');
  ok(lot && lot.lot.stage === 1, 'a new ger claim starts at stage 1 whatever stage was sent');
  g.ws.close();
}

// 6. wrestling pay
async function pair(a, b) {
  const A = await joinRoom(a), B = await joinRoom(b);
  send(A, { t: 'wr-invite', to: b });
  await waitFor(B, (m) => m.t === 'wr-invite');
  send(B, { t: 'wr-accept', from: a });
  await waitFor(A, (m) => m.t === 'wr-start');
  return [A, B];
}
const rewards = (box) => box.seen.filter((m) => m.t === 'wallet-result' && String(m.op).startsWith('wrestle:'));
{
  const [A, B] = await pair('quit-a', 'quit-b');
  send(A, { t: 'wr-quit' });
  await waitFor(B, (m) => m.t === 'wr-end');
  await sleep(500);
  ok(rewards(A).length === 0 && rewards(B).length === 0, 'a quit before any round was played pays nobody');
  A.ws.close(); B.ws.close();
}
{
  // a drawn round scores nobody, but it was played: quitting after it still pays
  const [A, B] = await pair('draw-a', 'draw-b');
  send(A, { t: 'wr-move', m: R.MOVES[0].id, p: 0.5 }); send(B, { t: 'wr-move', m: R.MOVES[0].id, p: 0.5 });
  const drawn = await waitFor(A, (m) => m.t === 'wr-result');
  send(A, { t: 'wr-quit' });
  await waitFor(B, (m) => m.t === 'wr-end');
  await sleep(500);
  ok(drawn && drawn.r === 0 && rewards(B).length === 1, 'a quit after a drawn round still pays the one who stayed');
  A.ws.close(); B.ws.close();
}
async function playOut(A, B) {
  for (let round = 0; round < 40 && !A.seen.some((m) => m.t === 'wr-end'); round++) {
    const had = A.seen.filter((m) => m.t === 'wr-result').length;
    send(A, { t: 'wr-move', m: R.MOVES[0].id, p: 1 }); send(B, { t: 'wr-move', m: R.MOVES[1].id, p: 0.2 });
    for (let i = 0; i < 100 && A.seen.filter((m) => m.t === 'wr-result').length === had && !A.seen.some((m) => m.t === 'wr-end'); i++) await sleep(20);
    await sleep(60);
  }
  await waitFor(A, (m) => m.t === 'wr-end');
  await sleep(400);
}
{
  const [A, B] = await pair('play-a', 'play-b');
  await playOut(A, B);
  const paid = [...rewards(A), ...rewards(B)];
  ok(paid.length === 2 && paid.every((m) => m.accepted) && paid.some((m) => m.wallet.coins >= 25), 'a played match still pays both players');
  A.ws.close(); B.ws.close();
}
{
  const A = await joinRoom('cap-a'), B = await joinRoom('cap-b');
  const fill = (box, op) => { send(box, { t: 'sync', op, coins: R.DAILY_EARN_CAP.coins, xp: R.DAILY_EARN_CAP.xp }); return waitFor(box, (m) => m.t === 'sync-result' && m.op === op); };
  const fa = await fill(A, 'a'.repeat(32)), fb = await fill(B, 'b'.repeat(32));
  ok(fa && fa.accepted && fb && fb.accepted, 'both players reach the daily cap through sync');
  const before = { a: A.seen.filter((m) => m.wallet).pop().wallet, b: B.seen.filter((m) => m.wallet).pop().wallet };
  send(A, { t: 'wr-invite', to: 'cap-b' });
  await waitFor(B, (m) => m.t === 'wr-invite');
  send(B, { t: 'wr-accept', from: 'cap-a' });
  await waitFor(A, (m) => m.t === 'wr-start');
  await playOut(A, B);
  const paid = [...rewards(A), ...rewards(B)];
  ok(paid.length === 2 && paid.every((m) => m.accepted === false && m.reason === 'limit'), 'wrestling pay stops at the daily earn cap');
  const same = (m, w) => m.wallet.coins === w.coins && m.wallet.xp === w.xp;
  ok(rewards(A).every((m) => same(m, before.a)) && rewards(B).every((m) => same(m, before.b)), 'the wallets did not grow past the cap');
  A.ws.close(); B.ws.close();
}

await new Promise((r) => { if (server.exitCode !== null) return r(); server.once('exit', r); server.kill(); }); // it saves on the way out: wait before removing its folder
rmSync(dataDir, { recursive: true, force: true });
if (fails.length) { console.error(`Server hardening test failed: ${fails.length}`); process.exit(1); }
console.log('Server hardening test passed.');
