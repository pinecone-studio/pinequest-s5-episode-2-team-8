// Multiplayer test: starts server.js, opens two separate players in the village,
// and checks they see each other, share one garden, and can talk with preset phrases.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); } throw new Error(`timed out waiting for: ${label}`); };

const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
const base = `http://localhost:${port}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
const errors = [];
const results = [];
const ok = (label) => { results.push('✓ ' + label); };

async function player(name, look) {
  const ctx = await browser.createBrowserContext();       // separate storage = separate person
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  await page.evaluate((name, look) => {
    localStorage.clear();
    const p = TG.store.addProfile({ name, age: 9, avatar: '🐎' });
    TG.store.state.settings.screenLimit = 999; TG.store.state.settings.sound = false;
    p.village = { tips: true, look, seeds: { carrot: 5 }, xp: 200, coins: 600 };
    TG.go('village');
  }, name, look);
  await until(() => page.evaluate(() => TG._village.live() && TG._village.live().online), `${name} online`);
  return page;
}

try {
  const a = await player('Бат', { deel: 'red', hat: 'mongol', pet: 'lamb' });
  const b = await player('Сарнай', { deel: 'green', hat: 'flower', neck: 'khadag' });
  ok('both players connected to the server');

  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Сарнай')), 'A sees B');
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && o.look.hat === 'mongol')), 'B sees A with hat');
  ok('players see each other (names and outfits)');

  await a.evaluate(() => TG._village.goTo({ x: 15, y: 13 }, null));
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && Math.abs(o.x - 15) < 0.01 && Math.abs(o.y - 13) < 0.01; }), 'B sees A move', 12000);
  ok('movement is shared live');

  await a.evaluate(() => TG._village.act('plant', 0, 'carrot'));
  await until(() => b.evaluate(() => { const p = TG._village.live().plots[0]; return p && p.c === 'carrot' && p.n === 'Бат'; }), 'B sees A\'s carrot');
  ok('planting appears in the shared garden for everyone');

  await b.evaluate(() => TG._village.act('water', 0));
  await until(() => a.evaluate(() => TG._village.live().plots[0].w > 0), 'A sees B watered');
  const helped = await b.evaluate(() => TG.store.active().village.quests.list.find((q) => q.k === 'help').p);
  if (helped !== 1) throw new Error('watering a friend\'s plant did not count as helping');
  ok('watering a friend\'s plant syncs and counts as helping');

  const seedsBefore = await b.evaluate(() => TG.store.active().village.seeds.carrot);
  await b.evaluate(() => TG._village.act('plant', 0, 'carrot'));   // plot is taken: must be refused
  await sleep(400);
  if ((await b.evaluate(() => TG.store.active().village.seeds.carrot)) !== seedsBefore) throw new Error('a refused plant still used a seed');
  ok('planting on a taken plot is refused without losing a seed');

  await a.evaluate(() => document.querySelector('.v-bottom .v-round[aria-label="talk"]').click());
  await sleep(300);
  await a.evaluate(() => document.querySelector('.v-phrases .v-chip').click());
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && o.bubble && /Сайн уу/.test(o.bubble.text); }), 'B sees A say hi');
  ok('preset phrases appear as speech bubbles');

  await a.evaluate(() => TG._village.buyLot(2, 'red', 'gold'));
  await until(() => b.evaluate(() => { const l = TG._village.lots()[2]; return l && l.n === 'Бат' && l.roof === 'red'; }), 'B sees A\'s new ger');
  if ((await a.evaluate(() => TG.store.active().village.coins)) !== 400) throw new Error('buying a ger did not cost 200 coins');
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
    const over = await a.evaluate(() => !!document.querySelector('.v-wrestle .v-zasuul, .v-wrestle .row-btns'));
    if (over) break;
    for (const [pg, k] of [[a, 0], [b, 1]]) {
      await until(() => pg.evaluate(() => { const m = document.querySelector('.v-wr-moves'); return (m && !m.classList.contains('hidden')) || !!document.querySelector('.v-wrestle .row-btns'); }), 'move buttons', 6000);
      await pg.evaluate((k) => { const btns = document.querySelectorAll('.v-wr-moves .btn'); if (btns.length && !document.querySelector('.v-wrestle .row-btns')) { btns[(k + Math.floor(Math.random() * 3)) % 3].click(); setTimeout(() => { const go = document.querySelector('.v-wr-timing .btn'); if (go) go.click(); }, 120 + Math.random() * 300); } }, k);
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

  await b.close();
  await until(() => a.evaluate(() => TG._village.live().others.size === 0), 'A sees B leave');
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
