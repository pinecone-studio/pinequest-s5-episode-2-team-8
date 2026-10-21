// Headless browser smoke test: opens every screen, every game (solo and
// together) and every "Цэгцлэе!" level, and fails on any JavaScript error or
// any request to an outside server. Needs puppeteer-core and Chrome.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], external = [];
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.hostname !== 'localhost') { external.push(r.url()); r.abort(); } else r.continue(); });
let step = 'load';
page.on('pageerror', (e) => errors.push(`${step}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`${step}: console error: ${m.text()}`); });
const check = async (label, selector) => {
  step = label;
  if (selector && !(await page.$(selector))) errors.push(`${label}: expected "${selector}" to render`);
};

try {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await check('welcome screen', '.onboard');

  const ages = { '3-6': 5, '7-10': 8, '11-14': 12, '15-18': 16 };
  await page.evaluate(() => { TG.store.addProfile({ name: 'Тест', age: 8, avatar: '🐎' }); TG.store.state.settings.screenLimit = 999; TG.store.state.settings.sound = false; });

  for (const screen of ['home', 'satis', 'missions', 'memories', 'about']) {
    await page.evaluate((s) => TG.go(s), screen); await sleep(250);
    await check(`screen ${screen}`, screen === 'about' ? '.about' : '.shell');
  }

  // modal accessibility: focus moves into the dialog, Escape closes it, focus returns
  step = 'modal accessibility';
  await page.evaluate(() => TG.go('home'));
  await sleep(200);
  await page.evaluate(() => {
    window.__before = document.activeElement;
    window.__close = TG.modal(TG.h('div', null, TG.h('button', { class: 'btn', id: 'inside-modal' }, 'inside')));
  });
  await sleep(150);
  const a11y = await page.evaluate(() => {
    const box = document.querySelector('.modal');
    const x = box && box.querySelector('.modal-x');
    return {
      inDialog: !!(box && box.contains(document.activeElement)),
      closeLabel: x ? x.getAttribute('aria-label') : null,
      toastRole: (() => { TG.toast('test'); const t = document.querySelector('.toast'); const r = t ? t.getAttribute('role') : null; t && t.remove(); return r; })(),
    };
  });
  if (!a11y.inDialog) errors.push('modal accessibility: focus did not move into the dialog');
  if (!a11y.closeLabel) errors.push('modal accessibility: close button has no aria-label');
  if (a11y.toastRole !== 'status') errors.push(`modal accessibility: toast role is "${a11y.toastRole}", expected "status"`);
  await page.keyboard.press('Escape');
  await sleep(320);
  if (await page.evaluate(() => !!document.querySelector('.modal-back'))) errors.push('modal accessibility: Escape did not close the modal');
  const restored = await page.evaluate(() => document.activeElement === window.__before);
  if (!restored) errors.push('modal accessibility: focus was not restored after closing');

  step = 'village (solo mode, no server)';
  await page.evaluate(() => TG.go('village')); await sleep(900);
  await check('village screen', '.village canvas');
  const solo = await page.evaluate(() => { const L = TG._village.live(); return L && L.status; });
  if (solo !== 'solo') errors.push(`village: expected solo mode without a server, got "${solo}"`);
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); const v = TG.store.active().village; v.seeds.carrot = 2; TG._village.act('plant', 0, 'carrot'); });
  await sleep(300);
  if (!(await page.evaluate(() => { const p = TG.store.active().village.garden[0]; return p && p.c === 'carrot'; }))) errors.push('village: planting in solo mode did not work');
  for (const btn of ['bag', 'talk', 'quests']) { await page.evaluate((b) => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector(`.v-round[aria-label="${b}"]`).click(); }, btn); await sleep(300); await check(`village ${btn} panel`, '.modal'); }
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector('.v-pills .v-pill').click(); }); await sleep(250); await check('village shop', '.v-shop');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.arena(); }); await sleep(300); await check('village wrestling panel', '.v-wr-head');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.tournament(1); }); await sleep(400); await check('village wrestling match', '.v-wrestle canvas');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  const games = await page.evaluate(() => TG.gameOrder.map((id) => ({ id, ages: TG.games[id].ages })));
  for (const g of games) {
    for (const together of [false, true]) {
      await page.evaluate((age) => { TG.store.active().age = age; }, ages[g.ages[0]]);
      await page.evaluate((id, together) => {
        document.querySelectorAll('.modal-back,.timeout-back').forEach((m) => m.remove());
        const players = [{ name: 'Тест', emoji: '🐎', color: TG.PCOLORS[0] }];
        if (together) players.push({ name: 'Ээж', emoji: '👩', color: TG.PCOLORS[1] });
        TG.go('play', { g: TG.games[id], players, together });
      }, g.id, together);
      step = `game ${g.id} (${together ? 'together' : 'solo'})`;
      await sleep(350);
      await check(`game ${g.id} (${together ? 'together' : 'solo'})`, '.play-screen');
      for (let k = 0; k < 6; k++) {   // poke a few buttons to exercise game logic
        await page.evaluate(() => { const b = [...document.querySelectorAll('.stage button:not(:disabled)')].filter((x) => x.offsetParent); if (b.length) b[Math.floor(Math.random() * b.length)].click(); });
        await sleep(120);
      }
    }
  }

  const levels = await page.evaluate(() => Object.fromEntries(Object.entries(TG.SATIS).map(([ag, l]) => [ag, l.length])));
  let count = 0;
  for (const [ag, n] of Object.entries(levels)) {
    for (let i = 0; i < n; i++) {
      step = `puzzle ${ag} #${i + 1}`;
      await page.evaluate((ag, i) => TG.go('satisLevel', { ag, i }), ag, i); await sleep(200);
      await check(`puzzle ${ag} #${i + 1}`, '.satis-stage > *');
      count++;
    }
  }

  await page.evaluate(() => TG.go('result', { g: TG.games.shagai, players: [{ name: 'A', emoji: '🐎', color: '#000' }, { name: 'B', emoji: '👩', color: '#111' }], together: true, res: { stars: 3, scores: [15, 9] } }));
  await sleep(250); await check('result screen', '.result');

  // screen-time guardian: the rest screen must be dismissible, and the daily
  // limit must still stop a new game from starting.
  step = 'screen time rest screen';
  const rest = await page.evaluate(async () => {
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    TG.store.state.settings.screenLimit = 1;
    TG.store.state.usage[TG.store.dkey()] = 999999;   // far past the limit
    TG.go('home');
    await nap(250);
    const card = document.querySelector('.game-card');
    if (!card) return { error: 'no game card on the home screen' };
    card.click();
    await nap(350);
    const shown = !!document.querySelector('.timeout-back');
    const close = document.querySelector('.timeout-back [data-rest="close"]');
    const hasClose = !!close;
    if (close) close.click();
    await nap(350);
    const dismissed = !document.querySelector('.timeout-back');
    const onHome = !!document.querySelector('.shell');
    // and the limit must still be enforced after dismissing
    const card2 = document.querySelector('.game-card');
    if (card2) card2.click();
    await nap(350);
    const blocked = !!document.querySelector('.timeout-back');
    // clean up: remove the overlay and restore the limit
    const el = document.querySelector('.timeout-back');
    if (el) el.remove();
    TG.store.state.settings.screenLimit = 999;
    TG.store.state.usage[TG.store.dkey()] = 0;
    return { shown, hasClose, dismissed, onHome, blocked };
  });
  if (rest.error) errors.push(`screen time rest screen: ${rest.error}`);
  else {
    if (!rest.shown) errors.push('screen time rest screen: the rest screen did not appear when the limit was reached');
    if (!rest.hasClose) errors.push('screen time rest screen: the rest screen has no way to close it');
    if (!rest.dismissed) errors.push('screen time rest screen: the rest screen could not be dismissed');
    if (!rest.onHome) errors.push('screen time rest screen: dismissing the rest screen did not return to the home screen');
    if (!rest.blocked) errors.push('screen time rest screen: a game could still be started after the limit was reached');
  }

  // math duel: two-player mode used to award 3 stars no matter how badly it went
  step = 'math duel star grading';
  await page.evaluate(() => {
    document.querySelectorAll('.modal-back,.timeout-back').forEach((m) => m.remove());
    TG.store.active().age = 8;   // 7-10, so the questions use only + − ×
    const players = [{ name: 'Тест', emoji: '🐎', color: TG.PCOLORS[0] }, { name: 'Ээж', emoji: '👩', color: TG.PCOLORS[1] }];
    TG.go('play', { g: TG.games.mathduel, players, together: true });
  });
  await sleep(350);
  const duel = await page.evaluate(async () => {
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    const value = (t) => {
      const m = t.replace(' = ?', '').trim().match(/^(\d+)\s*(.+?)\s*(\d+)$/);
      if (!m) return null;
      const a = +m[1], op = m[2], b = +m[3];
      if (op === '+') return a + b;
      if (op === '×') return a * b;
      if (op === '÷') return a / b;
      return a - b;
    };
    for (let q = 0; q < 10; q++) {
      // the two panels are rendered in the opposite order to the player list,
      // so pick them by name rather than by position
      const panels = [...document.querySelectorAll('.duel-panel')];
      const child = panels.find((p) => p.querySelector('.dp-head').textContent.includes('Тест'));
      const grown = panels.find((p) => p.querySelector('.dp-head').textContent.includes('Ээж'));
      if (!child || !grown) return { error: 'could not find the two duel panels' };
      const answer = value(child.querySelector('.dp-q').textContent);
      if (answer == null) return { error: 'could not read the question' };
      const wrong = [...child.querySelectorAll('.dp-btn')].find((o) => +o.textContent !== answer);
      const right = [...grown.querySelectorAll('.dp-btn')].find((o) => +o.textContent === answer);
      if (!wrong || !right) return { error: 'could not find the options' };
      wrong.click();                 // the child answers wrong
      await nap(30);
      right.click();                 // the grown-up answers correctly
      await nap(1150);               // the duel moves on 1s after a correct answer
    }
    await nap(500);
    return { stars: document.querySelectorAll('.res-stars .on').length, onResult: !!document.querySelector('.result') };
  });
  if (duel.error) errors.push(`math duel star grading: ${duel.error}`);
  else if (!duel.onResult) errors.push('math duel star grading: the duel never reached the result screen');
  else if (duel.stars === 3) errors.push('math duel star grading: a run with no correct answers still got 3 stars');

  console.log(`Checked 5 screens, the village, ${games.length} games x 2 modes, ${count} puzzle levels.`);
} catch (e) {
  errors.push(`crashed during "${step}": ${e.message}`);
}

await browser.close(); server.close();
if (external.length) errors.push(`requests to outside servers (app must work offline): ${[...new Set(external)].join(', ')}`);
if (errors.length) { console.error('Smoke test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Smoke test passed: no errors, no outside requests.');
