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

  // memory: the turn must pass to the next player after every pair attempt,
  // otherwise one player can take every pair and the others finish on 0.
  step = 'memory turn rotation';
  await page.evaluate(() => {
    document.querySelectorAll('.modal-back,.timeout-back').forEach((m) => m.remove());
    const players = [{ name: 'Тест', emoji: '🐎', color: TG.PCOLORS[0] }, { name: 'Ээж', emoji: '👩', color: TG.PCOLORS[1] }];
    TG.go('play', { g: TG.games.memory, players, together: true });
  });
  await sleep(350);
  const turn = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll('.mcard')];
    const emojiOf = (c) => c.querySelector('.mc-e').textContent;
    const mate = cards.findIndex((c, i) => i > 0 && emojiOf(c) === emojiOf(cards[0]));
    const cur = () => [...document.querySelectorAll('.sb-p')].findIndex((p) => p.classList.contains('cur'));
    const before = cur();
    cards[0].click(); cards[mate].click();
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: cur(), scores: [...document.querySelectorAll('.sb-s')].map((s) => s.textContent) };
  });
  if (turn.before !== 0) errors.push(`memory turn rotation: first player was not current (got ${turn.before})`);
  if (turn.after !== 1) errors.push(`memory turn rotation: turn stayed on player ${turn.after}, expected it to pass to player 1`);
  if (turn.scores[0] !== '1') errors.push(`memory turn rotation: the player who matched scored ${turn.scores[0]}, expected 1`);

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
  console.log(`Checked 5 screens, ${games.length} games x 2 modes, ${count} puzzle levels.`);
} catch (e) {
  errors.push(`crashed during "${step}": ${e.message}`);
}

await browser.close(); server.close();
if (external.length) errors.push(`requests to outside servers (app must work offline): ${[...new Set(external)].join(', ')}`);
if (errors.length) { console.error('Smoke test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Smoke test passed: no errors, no outside requests.');
