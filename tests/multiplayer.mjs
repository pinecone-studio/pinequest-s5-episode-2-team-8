// Multiplayer test: starts server.js, opens two separate players in the village,
// and checks they see each other, share the village, and can talk with preset phrases.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); } throw new Error(`timed out waiting for: ${label}`); };

const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, HEARTBEAT_MS: '600' }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
// connect over the computer's Wi-Fi address like a second device would (falls back to localhost without a network)
const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
const base = `http://${lan ? lan.address : 'localhost'}:${port}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
const errors = [];
const results = [`(connected over ${base})`];
const ok = (label) => { results.push('✓ ' + label); };

async function player(name, look, room, ctxIn) {
  const ctx = ctxIn || await browser.createBrowserContext();       // separate storage = separate person
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  if (ctxIn) await page.evaluate(() => TG.go('village'));   // same storage: the same profile again
  else await page.evaluate((name, look, room) => {
    localStorage.clear();
    const p = TG.store.addProfile({ name, age: 9, avatar: '🐎' }); TG.store.state.loggedIn = true;
    TG.store.state.settings.sound = false;
    p.village = { tips: true, tutorial: true, look, xp: 200, coins: 600, room: room || 'NUTAG' };
    TG.go('village');
  }, name, look, room);
  await until(() => page.evaluate(() => TG._village.live() && TG._village.live().online), `${name} online`);
  if (!(await page.evaluate(() => TG._village.live().serverV === TG.vrules.VERSION))) throw new Error('the server and the game report different versions');
  return page;
}

try {
  const a = await player('Бат', { deel: 'red', hat: 'mongol', pet: 'lamb' });
  const b = await player('Сарнай', { deel: 'green', hat: 'flower', neck: 'khadag' });
  ok('both players connected to the server');
  if (!/^[\w-]{40,}$/.test(await a.evaluate(() => TG.store.active().village.pass || ''))) throw new Error('the profile did not keep its village pass');
  ok('the server gives each new player a pass, kept with the profile');

  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Сарнай')), 'A sees B');
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && o.look.hat === 'mongol')), 'B sees A with hat');
  ok('players see each other (names and outfits)');

  await a.evaluate(() => TG._village.mount('black'));
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && o.look.ride === 'horse' && o.look.coat === 'black')), 'B sees A on a black horse');
  await a.evaluate(() => TG._village.dismount());
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && !o.look.ride)), 'B sees A get off the horse');
  ok('riding a horse is visible to friends');

  await a.evaluate(() => TG._village.goTo({ x: 15, y: 13 }, null));
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && Math.abs(o.x - 15) < 0.01 && Math.abs(o.y - 13) < 0.01; }), 'B sees A move', 12000);
  ok('movement is shared live');


  await a.evaluate(() => document.querySelector('.v-bottom .v-round[aria-label="talk"]').click());
  await sleep(300);
  await a.evaluate(() => document.querySelector('.v-phrases .v-chip').click());
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && o.bubble && /Сайн уу/.test(o.bubble.text); }), 'B sees A say hi');
  ok('preset phrases appear as speech bubbles');

  await until(() => b.evaluate(() => document.querySelector('.v-talk .v-badge').textContent === '1'), 'B gets an unread badge');
  await b.evaluate(() => document.querySelector('.v-talk').click());
  await until(() => b.evaluate(() => [...document.querySelectorAll('.v-chatlog .v-chat-line')].some((x) => /Бат/.test(x.textContent) && /Сайн уу/.test(x.textContent))), "B sees A's phrase in the chat log");
  if (!(await b.evaluate(() => [...document.querySelectorAll('.v-chatlog .v-chat-line.sys')].some((x) => /Бат/.test(x.textContent))))) throw new Error('the chat log has no join line');
  if (await b.evaluate(() => !document.querySelector('.v-talk .v-badge').classList.contains('hidden'))) throw new Error('opening the chat log did not clear the badge');
  await b.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await sleep(300);
  ok('the chat log shows phrases and joins, inside the talk window, with an unread badge');

  await a.evaluate(() => document.querySelector('.v-jump').click());
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && performance.now() - (o.jt || -1e9) < 2000; }), 'B sees A jump');
  ok('jumping shows for everyone');

  await a.evaluate(() => TG._village.buyLot(2, 'red', 'gold'));
  await until(() => b.evaluate(() => { const l = TG._village.lots()[2]; return l && l.n === 'Бат' && l.roof === 'red'; }), 'B sees A\'s new ger');
  if ((await a.evaluate(() => TG.store.active().village.coins)) !== 550) throw new Error('buying a ger did not cost 50 coins');
  await b.evaluate(() => TG._village.buyLot(2, 'blue', 'red'));
  await sleep(400);
  if ((await b.evaluate(() => TG._village.lots()[2].n)) !== 'Бат') throw new Error('a taken lot was overwritten');
  ok('owning a ger syncs to everyone; taken lots are protected');

  // live wrestling: A invites B, B accepts, both play exchanges until someone wins
  const bId = await b.evaluate(() => TG.store.active().village.id);
  await a.evaluate((id) => TG._village.invite(id), bId);
  await until(() => b.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].some((x) => /Барилдъя/.test(x.textContent))), 'B gets the invitation');
  await b.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /Барилдъя/.test(x.textContent)).click());
  await until(() => a.evaluate(() => !!document.querySelector('.v-wrestle')) && b.evaluate(() => !!document.querySelector('.v-wrestle')), 'both see the match');
  for (let round = 0; round < 15; round++) {
    const over = await a.evaluate(() => !!document.querySelector('.v-wrestle .row-btns'));
    if (over) break;
    for (const [pg, k] of [[a, 0], [b, 1]]) {
      await until(() => pg.evaluate(() => { const m = document.querySelector('.v-wr-moves'); return (m && !m.classList.contains('hidden')) || !!document.querySelector('.v-wrestle .row-btns'); }), 'move buttons', 6000);
      await pg.evaluate((k) => { const btns = document.querySelectorAll('.v-wr-moves .btn'); if (btns.length && !document.querySelector('.v-wrestle .row-btns')) { btns[[0, 4, 12][(k + Math.floor(Math.random() * 3)) % 3]].click(); /* timing moves: push, hip throw, knee grab */ setTimeout(() => { const go = document.querySelector('.v-wr-timing .btn'); if (go) go.click(); }, 120 + Math.random() * 300); } }, k);
    }
    await sleep(1600);
  }
  await until(() => a.evaluate(() => !!document.querySelector('.v-wrestle .row-btns')) && b.evaluate(() => !!document.querySelector('.v-wrestle .row-btns')), 'match finishes for both', 10000);
  const recs = [await a.evaluate(() => TG.store.active().village.wr), await b.evaluate(() => TG.store.active().village.wr)];
  if ((recs[0].pvpW + recs[1].pvpW) !== 1 || (recs[0].pvpL + recs[1].pvpL) !== 1) throw new Error('wrestling result not recorded exactly once: ' + JSON.stringify(recs));
  ok('live wrestling match: invite, exchanges, one winner, records saved');
  await a.screenshot({ path: join(process.env.SHOT_DIR || tmpdir(), 'village-wrestle.png') });
  await a.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await b.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await sleep(300);

  await a.screenshot({ path: join(process.env.SHOT_DIR || tmpdir(), 'village-two-players.png') });

  // a third friend whose profile remembers an old private room: they are told others are here and can join in one tap
  const c = await player('Тэмүүлэн', { deel: 'blue' }, 'ABCDE');
  await until(() => c.evaluate(() => document.querySelector('.v-net').classList.contains('alert') && /\(\+2\)/.test(document.querySelector('.v-net').textContent)), 'C is shown 2 people in another room');
  await c.evaluate(() => document.querySelector('.v-net').click()); await sleep(300);
  await c.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /NUTAG|Үндсэн Нутаг|main village/.test(x.textContent)).click());
  await until(() => c.evaluate(() => TG._village.live().online && TG._village.live().room === 'NUTAG' && TG._village.live().others.size === 2), 'C joins the main village and sees both');
  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Тэмүүлэн')), 'A sees C');
  ok('a player stuck in another room is pointed to the main village and joins in one tap');
  if (!(await c.evaluate(() => (TG._village.live().chat || []).some((l) => l.k === 'p' && l.n === 'Бат' && l.i === 0)))) throw new Error('a late joiner did not get the recent chat');
  ok("a player who joins later gets the room's recent chat");

  // the same profile opened in a second tab: the old tab steps aside, no reconnect fight
  const c2 = await player('Тэмүүлэн', null, null, c.browserContext());
  await until(() => c.evaluate(() => TG._village.live().status === 'solo'), 'old tab steps aside');
  await sleep(4000);
  if (!(await c2.evaluate(() => TG._village.live().online))) throw new Error('the newest tab lost its connection (reconnect loop)');
  if ((await a.evaluate(() => [...TG._village.live().others.values()].filter((o) => o.name === 'Тэмүүлэн').length)) !== 1) throw new Error('the same profile shows up twice');
  ok('opening the same profile twice keeps the newest tab without a reconnect loop');
  await c.close(); await c2.close();
  await until(() => a.evaluate(() => TG._village.live().others.size === 1), 'C left');

  // a phone that drops off the Wi-Fi without closing: removed by the heartbeat instead of staying as a frozen ghost
  const ghost = net.connect(port, '127.0.0.1');
  await new Promise((r) => ghost.on('connect', r));
  ghost.write(`GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\n\r\n`);
  await sleep(200);
  const payload = Buffer.from(JSON.stringify({ t: 'join', room: 'NUTAG', id: 'ghost-1', name: 'Сүнс', look: {}, x: 20, y: 13 })), mask = crypto.randomBytes(4);
  ghost.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, Buffer.from(payload.map((x, i) => x ^ mask[i & 3]))]));
  ghost.pause();                                                // never answers the server's pings again
  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Сүнс')), 'A sees the ghost join');
  await until(() => a.evaluate(() => ![...TG._village.live().others.values()].some((o) => o.name === 'Сүнс')), 'the silent player is removed', 6000);
  ghost.destroy();
  ok('a player whose connection silently died is removed automatically');

  // player pass: an id that has a pass only gets in with it
  const rawJoin = (id, pass) => new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: 'PASS', id, pass, name: 'P', look: {}, x: 20, y: 13 }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome' || m.t === 'error') { ws.close(); res(m); } };
  });
  const first = await rawJoin('pass-test-1');
  if (first.t !== 'welcome' || !first.pass) throw new Error('a new id did not get a pass');
  if ((await rawJoin('pass-test-1')).why !== 'bad-pass') throw new Error('a taken id got in without its pass');
  if ((await rawJoin('pass-test-1', first.pass.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')))).why !== 'bad-pass') throw new Error('a taken id got in with a wrong pass');
  if ((await rawJoin('pass-test-1', first.pass)).t !== 'welcome') throw new Error('the right pass was refused');
  const aId = await a.evaluate(() => TG.store.active().village.id);
  if ((await rawJoin(aId)).why !== 'bad-pass') throw new Error("someone could join as another player's id");
  ok('a taken id only gets in with its own pass');

  // a profile whose pass doesn't match is told so, and can start fresh with a new id
  const d = await player('Дорж', { deel: 'teal' }, 'PASS');
  await d.evaluate((id) => { const v = TG.store.active().village; v.id = id; v.pass = 'wrong'; TG.store.save(); TG.go('village'); }, aId);
  await until(() => d.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].some((x) => /Шинээр эхлэх/.test(x.textContent))), 'D is told the pass does not match');
  await d.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /Шинээр эхлэх/.test(x.textContent)).click());
  await until(() => d.evaluate((id) => TG._village.live().online && TG.store.active().village.id !== id && !!TG.store.active().village.pass, aId), 'D starts fresh and gets online');
  await d.close();
  ok('a profile with a wrong pass can start fresh with a new id');

  // parent backup code: only with the child's pass, 8 pictures, a new one replaces the old
  const backup = (body) => fetch(`http://127.0.0.1:${port}/api/backup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  if ((await backup({ id: 'pass-test-1' })).ok) throw new Error('a backup code was given without a pass');
  const code1 = await backup({ id: 'pass-test-1', pass: first.pass, name: 'P' });
  if (!code1.ok || !/^\d{4}$/.test(code1.code)) throw new Error('bad backup code: ' + JSON.stringify(code1));
  await a.evaluate(() => TG.go('family'));
  await until(() => a.evaluate(() => !!document.querySelector('.gate-q')), 'grown-up check');
  await a.evaluate(() => { const [x, y] = document.querySelector('.gate-q').textContent.match(/\d+/g).map(Number); document.querySelector('.gate-input').value = x * y; document.querySelector('.gate .btn.primary').click(); });
  await until(() => a.evaluate(() => [...document.querySelectorAll('.child-row .link-btn')].some((x) => /Нөөц код/.test(x.textContent))), 'A sees the backup code button');
  await a.evaluate(() => [...document.querySelectorAll('.child-row .link-btn')].find((x) => /Нөөц код/.test(x.textContent)).click());
  const makeBtn = () => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /Код гаргах/.test(x.textContent));
  await until(() => a.evaluate(`!!(${makeBtn})()`), 'backup window');
  await a.evaluate(`(${makeBtn})().click()`);
  await until(() => a.evaluate(() => document.querySelectorAll('.modal .backup-code span').length === 4 && /^\d{4}$/.test((TG.store.active().village.backup || {}).code) && TG.store.active().village.backup.name === 'Бат'), 'A gets a 4-digit code with the name, kept with the profile');
  await a.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG.go('village'); });
  await until(() => a.evaluate(() => TG._village.live() && TG._village.live().online), 'A back in the village');
  ok('a parent can make a name + 4-digit backup code (only with the pass), kept on the device');

  // chat flood guard: only one phrase a second gets through
  const spam = new WebSocket(`ws://127.0.0.1:${port}/ws`), heard = [];
  await new Promise((r) => (spam.onopen = r));
  spam.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'say' && m.id === 'spam-1') heard.push(m); };
  spam.send(JSON.stringify({ t: 'join', room: 'SPAM', id: 'spam-1', name: 'Spam', look: {}, x: 20, y: 13 }));
  await sleep(200);
  for (let k = 0; k < 5; k++) spam.send(JSON.stringify({ t: 'say', k: 'e', i: 0 }));
  await sleep(400);
  spam.close();
  if (heard.length !== 1) throw new Error(`chat flood guard let ${heard.length} phrases through instead of 1`);
  ok('sending many phrases at once only lets one through');

  await b.close();
  await until(() => a.evaluate(() => TG._village.live().others.size === 0), 'A sees B leave');
  if (!(await a.evaluate(() => (TG._village.live().chat || []).some((l) => l.k === 'leave' && l.n === 'Сарнай')))) throw new Error('the chat log has no leave line');
  ok('leaving removes the player for others');
} catch (e) {
  errors.push(e.message);
}
await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
console.log(results.join('\n'));
if (errors.length) { console.error('Multiplayer test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Multiplayer test passed.');
