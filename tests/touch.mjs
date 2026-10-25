// Phone controls test: a headless phone with real multi-touch (through the DevTools protocol) steers the village
// joystick and presses the on-screen buttons with a second finger. Fails on any JavaScript error. Needs puppeteer-core and Chrome.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

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
const errors = [];
let step = 'load';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
page.on('pageerror', (e) => errors.push(`${step}: ${e.message}`));

// CDP touch: on touchStart/touchMove list every finger that is down; on touchEnd list the fingers that lift
const cdp = await page.createCDPSession();
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
const state = () => page.evaluate(() => { const l = TG._village.live(); return { x: l.me.px, y: l.me.py, stick: l.stick, drag: l.drag, vx: l.me.vx, vy: l.me.vy }; });
const place = (x, y) => page.evaluate((x, y) => { const l = TG._village.live(); l.me.path = []; l.me.vx = l.me.vy = 0; l.me.px = x; l.me.py = y; l.keys.clear(); l.pending = null; }, x, y);
const centre = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }, sel);
const steer = async () => { await touch('touchStart', [[150, 500, 1]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[150 + i * 10, 500, 1]]); await sleep(16); } await sleep(100); };
const tap2 = async (sel, held = [[210, 500, 1]]) => { const [x, y] = await centre(sel); await touch('touchStart', [...held, [x, y, 2]]); await sleep(60); await touch('touchEnd', [[x, y, 2]]); await sleep(120); };
const liftAll = async () => { await touch('touchCancel', []).catch(() => {}); await sleep(250); await page.evaluate(() => { const l = TG._village.live(); l.runLock = false; l.els.run.classList.remove('on'); document.querySelectorAll('.modal-back').forEach((m) => m.remove()); }); };
const fail = (name, detail) => errors.push(`${name}: ${detail}`);
const jumpedRecently = () => page.evaluate(() => { const jt = TG._village.live().me.jt || 0; return jt > 0 && performance.now() - jt < 900; });
const V = (fn, ...a) => page.evaluate(fn, ...a);

try {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // register through the real screens: name -> age -> mascot -> picture password -> character
  step = 'register';
  await page.type('.big-input', 'Хуруу');
  const next = () => page.evaluate(() => [...document.querySelectorAll('.auth-card .btn.primary')].pop().click());
  await next(); await sleep(200);
  await page.evaluate(() => document.querySelectorAll('.age-btn')[5].click()); await next(); await sleep(200);
  await page.evaluate(() => document.querySelectorAll('.mascot')[2].click()); await next(); await sleep(200);
  for (const k of [0, 4, 8]) await page.evaluate((k) => document.querySelectorAll('.pic-key')[k].click(), k);
  await sleep(600);
  await page.evaluate(() => document.querySelectorAll('.eth')[0].click()); await sleep(150);
  const cnext = () => page.evaluate(() => [...document.querySelectorAll('.create-card .btn.primary')].pop().click());
  for (let i = 0; i < 4; i++) { await cnext(); await sleep(250); }
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!(window.TG && TG._village && TG._village.live()))); i++) await sleep(100);
  await sleep(500);
  await page.evaluate(() => { TG.tutorial.stop(); const v = TG.store.active().village; v.tutorial = 1; v.tutorialSeen = 1; TG.store.save(); document.querySelectorAll('.modal-back').forEach((m) => m.remove()); });
  await sleep(500);
  const open = { x: 17, y: 13 };

  step = 'mouse click acts once';
  { const [x, y] = await centre('.v-run'); await page.mouse.click(x, y); await sleep(100);
    if (!(await V(() => TG._village.live().runLock === true))) fail(step, 'one mouse click on Run did not switch running on exactly once');
    await page.mouse.click(x, y); await sleep(100);
    if (!(await V(() => TG._village.live().runLock === false))) fail(step, 'a second mouse click on Run did not switch running off'); }
  await liftAll();

  step = 'keyboard click acts';
  await V(() => { TG._village.live().me.jt = 0; document.querySelector('.v-jump').click(); });
  if (!(await jumpedRecently())) fail(step, 'a keyboard click (element.click) on Jump did not jump');
  await liftAll();

  step = 'tap still walks';
  await place(open.x, open.y);
  await touch('touchStart', [[300, 420, 1]]); await sleep(60); await touch('touchEnd', [[300, 420, 1]]); await sleep(80);
  if (!(await V(() => TG._village.live().me.path.length > 0))) fail(step, 'a quick tap on the map did not walk there');
  await liftAll();

  // these already worked; they must keep working
  const stopped = async (name) => { await sleep(450); const s = await state(); if (s.stick || s.drag || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05) fail(name, `still steering or moving afterwards (stick ${JSON.stringify(s.stick)}, vx ${s.vx.toFixed(2)})`); };
  step = 'touch cancel stops';
  await place(open.x, open.y); await steer(); await touch('touchCancel', []); await stopped(step); await liftAll();

  step = 'lifting over a button stops';
  await place(open.x, open.y); await steer();
  { const [jx, jy] = await centre('.v-jump'); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[210 + (jx - 210) * i / 8, 500 + (jy - 500) * i / 8, 1]]); await sleep(16); } await touch('touchEnd', [[jx, jy, 1]]); }
  await stopped(step); await liftAll();

  step = 'modal mid-drag stops';
  await place(open.x, open.y); await steer();
  await V(() => document.querySelector('.v-pill').click()); await sleep(250); await touch('touchEnd', [[210, 500, 1]]);
  await V(() => document.querySelectorAll('.modal-back').forEach((m) => m.click())); await stopped(step); await liftAll();

  step = 'rotate mid-drag stops';
  await place(open.x, open.y); await steer();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await sleep(300);
  await touch('touchEnd', [[210, 500, 1]]); await stopped(step);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await sleep(300); await liftAll();

  // touch positions are screen points (CSS pixels) on every phone, whatever its pixel density
  step = 'joystick ring sits under the thumb';
  await place(open.x, open.y);
  await touch('touchStart', [[150, 500, 1]]); await touch('touchMove', [[170, 500, 1]]); await sleep(80);
  { const c = await V(() => { const r = document.querySelector('.v-stick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    if (Math.abs(c[0] - 150) > 4 || Math.abs(c[1] - 500) > 4) fail(step, `the ring was drawn at (${c.map(Math.round)}) instead of under the thumb at (150,500)`); }
  await liftAll();

  step = 'a shaky tap still walks';
  await place(open.x, open.y);
  await touch('touchStart', [[300, 420, 1]]); await touch('touchMove', [[306, 423, 1]]); await sleep(40); await touch('touchEnd', [[306, 423, 1]]); await sleep(80);
  if (!(await V(() => TG._village.live().me.path.length > 0))) fail(step, 'a tap that wobbled 7 px became a drag instead of walking there');
  await liftAll();

  step = 'together: the left half steers player 1';
  await place(open.x, open.y); await V(() => TG._village.together('')); await sleep(300);
  await touch('touchStart', [[150, 500, 1]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[150 + i * 10, 500, 1]]); await sleep(16); } await sleep(80);
  if (!(await V(() => !!TG._village.live().stick && !TG._village.live().drag2))) fail(step, "a thumb on the left half of the screen steered player 2 instead of player 1");
  await liftAll(); await V(() => TG._village.together(null)); await sleep(200);
} catch (e) {
  errors.push(`${step}: ${e.stack || e.message}`);
}

await browser.close(); server.close();
if (errors.length) { console.log('Touch test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Touch test passed.');
