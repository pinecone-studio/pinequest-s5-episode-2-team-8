// Headless browser smoke test: registers a child, walks through Нутаг, Basar the AI
// dog (offline mode), every heritage lesson and the family screens. Fails on any
// JavaScript error or any request to an outside server. Needs puppeteer-core and Chrome.
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
const errors = [], external = [];
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); // software WebGL for the first-person trips
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.hostname !== 'localhost') { external.push(r.url()); r.abort(); } else r.continue(); });
let step = 'load';
page.on('pageerror', (e) => errors.push(`${step}: ${e.message}`));
// if the page ever reloads by itself, say when and whether the offline cache's take-over did it
await page.evaluateOnNewDocument(() => { if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', () => sessionStorage.setItem('smoke-cc', String(Date.now()))); });
let settled = false;
page.on('framenavigated', async (f) => { if (!settled || f !== page.mainFrame()) return; const cc = await page.evaluate(() => sessionStorage.getItem('smoke-cc')).catch(() => '?'); errors.push(`${step}: the page reloaded by itself (offline-cache take-over before it: ${cc ? 'yes' : 'no'})`); });
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`${step}: console error: ${m.text()}`); });
const check = async (label, selector) => {
  step = label;
  if (selector && !(await page.$(selector))) errors.push(`${label}: expected "${selector}" to render`);
  // no screen may ever show "null", "undefined" or "NaN" to a child
  const junk = await page.evaluate(() => { const out = []; const w = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3 && /\bnull\b|\bundefined\b|\bNaN\b|\[object /.test(c.textContent)) out.push(c.textContent.trim().slice(0, 60)); else if (c.nodeType === 1 && c.tagName !== 'SCRIPT') w(c); } }; w(document.body); return out; });
  junk.forEach((t) => errors.push(`${label}: shows broken text "${t}"`));
};

try {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  // let the offline cache finish installing first, so its take-over can never reload the page in the middle of a check
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  for (let i = 0; i < 100 && !(await page.evaluate(() => !navigator.serviceWorker || !!navigator.serviceWorker.controller)); i++) await sleep(100);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  settled = true;
  await check('register screen', '.auth .big-input');

  // register through the real screens: name -> age -> mascot -> picture password
  step = 'register';
  await page.type('.big-input', 'Тест');
  const next = () => page.evaluate(() => [...document.querySelectorAll('.auth-card .btn.primary')].pop().click());
  await next(); await sleep(200);
  await page.evaluate(() => document.querySelectorAll('.age-btn')[5].click()); await next(); await sleep(200);
  await check('mascot picker', '.mascot-grid');
  await page.evaluate(() => document.querySelectorAll('.mascot')[2].click()); await next(); await sleep(200);
  for (const k of [0, 4, 8]) await page.evaluate((k) => document.querySelectorAll('.pic-key')[k].click(), k);
  await sleep(600);
  // character creator: ethnic group -> home province -> outfit -> welcome
  step = 'character creator';
  await check('character creator', '.create .eth-grid');
  await page.evaluate(() => [...document.querySelectorAll('.eth')].find((x) => /Буриад/.test(x.textContent)).click()); await sleep(150);
  const cnext = () => page.evaluate(() => [...document.querySelectorAll('.create-card .btn.primary')].pop().click());
  await cnext(); await sleep(200); await check('home province step', '.create .aimag-grid .aimag.on');
  await cnext(); await sleep(200); await check('outfit step', '.create-preview canvas');
  await cnext(); await sleep(200); await check('welcome step', '.create-welcome');
  await cnext(); await sleep(900);
  await check('straight into Нутаг after creating the character', '.village canvas');
  const who = await page.evaluate(() => { const p = TG.store.active(); return { eth: p.eth, aimag: p.aimag, hat: p.village.look.hat }; });
  if (who.eth !== 'buriad' || !['dornod', 'khentii', 'selenge', 'bulgan', 'khuvsgul'].includes(who.aimag) || who.hat !== 'buriad') errors.push(`character creator: wrong result ${JSON.stringify(who)}`);
  if (!(await page.evaluate(() => !!document.querySelector('.v-loc img.emo[data-icon="pin"]')))) errors.push('village: the home province chip is missing');
  const prof = await page.evaluate(() => { const p = TG.store.active(); return p && { name: p.name, age: p.age, avatar: p.avatar, code: p.code }; });
  if (!prof || prof.name !== 'Тест' || prof.age !== 8 || !prof.code) errors.push(`register: profile not saved correctly: ${JSON.stringify(prof)}`);

  // the tutorial: Guide Nomin talks in the story box (portrait, typed text, voice), asks questions, and walks the player
  // through walking, jumping, talking to Basar and using the well, then answers questions and gives a gift
  step = 'tutorial';
  for (let i = 0; i < 40 && !(await page.evaluate(() => TG.dialog.active())); i++) await sleep(100);
  if (!(await page.evaluate(() => TG.dialog.active()))) errors.push('tutorial: the guide did not start talking on the first visit');
  else {
    await check('tutorial dialogue box', '.dlg .dlg-box .dlg-face canvas');
    if (!(await page.evaluate(() => !!(TG._village.live().tut || {}).guide))) errors.push('tutorial: the guide is not standing in the village');
    const coins0 = await page.evaluate(() => TG.store.active().village.coins);
    const faces = new Set();
    const tutState = () => page.evaluate(() => JSON.stringify({ goal: (document.querySelector('.tut-goal') || {}).textContent, say: ((document.querySelector('.dlg-text') || {}).textContent || '').slice(0, 50), modal: !!document.querySelector('.modal-back'), focus: document.activeElement && document.activeElement.tagName, walked: TG._village.live() && TG._village.live().walked }));
    const until = async (fn, n = 90) => {
      for (let i = 0; i < n; i++) {
        faces.add(await page.evaluate(() => { const c = document.querySelector('.dlg-face canvas'); return c ? c.toDataURL() : ''; }));
        if (await page.evaluate(fn)) return true;
        await page.keyboard.press('Space'); await sleep(140);
      }
      return false;
    };
    if (!(await until(() => !!document.querySelector('.dlg.asking .dlg-opt')))) errors.push('tutorial: the guide never asked a question with answers');
    else {
      if ((await page.$$('.dlg-opt')).length < 2) errors.push('tutorial: a question needs at least two answers');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await sleep(80);
      await page.keyboard.press('Enter'); // “Yes, let's go!”
      if (!(await until(() => !!document.querySelector('.tut-goal')))) errors.push('tutorial: the walking goal did not appear');
      // hold → until the walking goal is met (slow machines draw fewer frames, so never rely on a fixed time)
      await page.keyboard.down('KeyD');
      for (let i = 0; i < 80 && (await page.evaluate(() => /Алх|walk/i.test((document.querySelector('.tut-goal') || {}).textContent || ''))); i++) await sleep(100);
      await page.keyboard.up('KeyD');
      if (!(await until(() => /Басар|Basar/.test((document.querySelector('.tut-goal') || {}).textContent || '')))) errors.push('tutorial: walking and jumping goals did not complete: ' + await tutState());
      else {
        await page.keyboard.press('KeyB'); await sleep(500);
        if (!(await page.$('.modal .b-head'))) errors.push('tutorial: B did not open Basar');
        await page.keyboard.press('Escape'); await sleep(400);
        if (!(await until(() => /Худ[аг]|well/i.test((document.querySelector('.tut-goal') || {}).textContent || '')))) errors.push('tutorial: the well goal did not appear');
        await page.evaluate(() => { const l = TG._village.live(), w = TG._village.objects().find((o) => o.id === 'well'); l.me.path = []; l.me.vx = l.me.vy = 0; l.me.px = w.door.x; l.me.py = w.door.y - 0.7; });
        await sleep(300); await page.keyboard.press('KeyE'); await sleep(300);
        if (!(await until(() => !TG.dialog.active() && !document.querySelector('.tut-goal') && !TG.tutorial.active(), 140))) errors.push('tutorial: did not reach the end');
      }
    }
    if (faces.size < 4) errors.push(`tutorial: the guide's face should change while talking (saw ${faces.size} different faces)`);
    const done = await page.evaluate(() => ({ t: TG.store.active().village.tutorial, coins: TG.store.active().village.coins }));
    if (!done.t) errors.push('tutorial: finishing did not save it as done');
    if (done.coins < coins0 + 30) errors.push(`tutorial: the guide's gift was not given (${coins0} → ${done.coins})`);
    if (await page.evaluate(() => !!document.querySelector('.tut-glow'))) errors.push('tutorial: a button is still glowing after the end');
    await page.evaluate(() => TG.tutorial.stop()); // never let a stuck tutorial swallow the keys of the checks below
  }
  await page.evaluate(() => { TG.store.state.settings.sound = false; document.querySelectorAll('.modal-x').forEach((x) => x.click()); });

  // modal accessibility: focus moves into the dialog, Escape closes it, focus returns
  step = 'modal accessibility';
  await sleep(400);
  await page.evaluate(() => {
    window.__before = document.activeElement;
    window.__close = TG.modal(TG.h('div', null, TG.h('button', { class: 'btn', id: 'inside-modal' }, 'inside')));
  });
  for (let i = 0; i < 20 && !(await page.evaluate(() => { const b = document.querySelector('.modal'); return !!(b && b.contains(document.activeElement)); })); i++) await sleep(50); // focus moves on the next animation frame
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
  const solo = await page.evaluate(() => { const L = TG._village.live(); return L && L.status; });
  if (solo !== 'solo') errors.push(`village: expected solo mode without a server, got "${solo}"`);
  if (!(await page.evaluate(() => !!TG._village.dog()))) errors.push('village: Basar the dog is not following the player');

  step = 'phaser village';
  const ph = await page.evaluate(() => { const v = TG._village.phaser && TG._village.phaser(); return v ? { ver: Phaser.VERSION, active: v.scene.sys.isActive(), cv: !!document.querySelector('.village canvas.v-canvas'), n: v.scene.children.list.reduce((s, c) => s + (c.list ? c.list.length : 1), 0), pixelArt: v.game.config.pixelArt, aa: v.game.config.antialias } : null; });
  if (ph && (ph.pixelArt !== true || ph.aa !== false)) errors.push('village: pixel art must be drawn crisp (pixelArt on, no smoothing), got ' + JSON.stringify(ph));
  if (!ph || ph.ver !== '4.2.1' || !ph.active || !ph.cv || ph.n < 20) errors.push('village: Phaser 4.2.1 scene should be running and drawing the village, got ' + JSON.stringify(ph));
  // rotate the phone: the engine canvas refits
  await page.setViewport({ width: 844, height: 390 }); await sleep(400);
  if (!(await page.evaluate(() => { const c = document.querySelector('.village canvas.v-canvas'); if (!c) return false; const r = c.getBoundingClientRect(); return Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2; }))) errors.push('village: canvas should refit after rotating');
  await page.setViewport({ width: 390, height: 844 }); await sleep(400);
  // leave and come back five times: still exactly one engine
  for (let i = 0; i < 5; i++) { await page.evaluate(() => TG.go('learn')); await sleep(150); await page.evaluate(() => TG.go('village')); await sleep(300); }
  const games = await page.evaluate(() => document.querySelectorAll('.village canvas.v-canvas').length + ':' + (TG.villageView ? TG.villageView.count() : 'x'));
  if (games !== '1:1') errors.push('village: exactly one Phaser canvas and one game after re-entering, got canvases:games ' + games);
  // the player walks: the game loop runs inside the engine
  const x0 = await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); const l = TG._village.live(); l.me.path = []; l.me.px = l.me.x = 17; l.me.py = l.me.y = 13; TG._village.goTo({ x: 24, y: 13 }); return 17; }); await sleep(1500);
  const walked = await page.evaluate(() => { const l = TG._village.live(); return { px: l.me.px, py: l.me.py, path: l.me.path.length, modal: !!document.querySelector('.modal-back'), dlg: TG.dialog.active() }; });
  if (Math.abs(walked.px - x0) < 0.5) errors.push('village: the player should walk inside the Phaser loop, ' + JSON.stringify({ x0, ...walked }));
  // the dairy yard: let the calf suckle, milk the cow in rhythm, then make aaruul at the rack
  step = 'dairy yard';
  if (await page.evaluate(() => !!TG.store.active().village.garden)) errors.push('dairy yard: the old garden data was not removed');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.milk('cow1'); }); await sleep(300);
  await check('milking', '.modal .v-milk');
  await page.evaluate(() => document.querySelector('.modal .btn.primary').click()); await sleep(1600);   // the calf suckles first
  for (let i = 0; i < 5; i++) { await page.waitForFunction(() => { const m = TG._village.milkNow(); return m.phase === 'milk' && m.pos > 0.42 && m.pos < 0.58; }, { timeout: 5000 }); await page.evaluate(() => document.querySelector('.modal .btn.primary').click()); await sleep(60); }
  if ((await page.evaluate(() => TG.store.active().village.produce.milk || 0)) < 2) errors.push('dairy yard: milking the cow gave no milk');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => TG._village.station('rack')); await sleep(250);
  await check('aaruul rack', '.modal .v-list .v-row');
  await page.evaluate(() => document.querySelector('.modal .v-row .btn.primary').click()); await sleep(150);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { const b = document.querySelector('.modal .btn.primary.big'); if (b) b.click(); }); await sleep(120); }
  const yard = await page.evaluate(() => { const p = TG.store.active().village.produce; return { milk: p.milk || 0, aaruul: p.aaruul || 0 }; });
  if (yard.aaruul !== 3 || yard.milk !== 0) errors.push(`dairy yard: making aaruul did not work ${JSON.stringify(yard)}`);
  // every recipe at every station has its hands-on steps
  { const missing = await page.evaluate(() => TG._village.recipes().filter((r) => !(TG.dairywork.steps(r.id) > 0)).map((r) => r.id)); if (missing.length) errors.push(`dairy yard: no hands-on steps for ${missing.join(', ')}`); }
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => { const v = TG.store.active().village, e0 = v.energy = 50; TG.villageEat('aaruul'); }); await sleep(150);
  const ate = await page.evaluate(() => { const v = TG.store.active().village; return { aaruul: v.produce.aaruul, energy: v.energy }; });
  if (ate.aaruul !== 2 || ate.energy <= 50) errors.push(`dairy yard: eating your own aaruul did not work ${JSON.stringify(ate)}`);
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(200);
  for (const btn of ['bag', 'talk', 'quests']) { await page.evaluate((b) => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector(`.v-round[aria-label="${b}"]`).click(); }, btn); await sleep(300); await check(`village ${btn} panel`, '.modal'); }
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector('.v-pills .v-pill').click(); }); await sleep(250); await check('village shop', '.v-shop');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.arena(); }); await sleep(300); await check('village wrestling panel', '.v-wr-head');
  if ((await page.evaluate(() => document.querySelectorAll('.v-wr-mode').length)) !== 2) errors.push('wrestling: the arena should offer two ways to wrestle');
  // wrestling school: page through to the end, then a practice bout that explains the chosen move
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.school(); }); await sleep(300); await check('wrestling school', '.v-school .v-school-say');
  for (let i = 0; i < 12 && !(await page.evaluate(() => /🤼/.test(document.querySelector('.v-school').textContent))); i++) { await page.evaluate(() => [...document.querySelectorAll('.v-school .btn.primary')].pop().click()); await sleep(80); }
  if (!(await page.evaluate(() => document.querySelectorAll('.v-school .v-row').length === 0 && /🤼/.test(document.querySelector('.v-school').textContent)))) errors.push('wrestling school: did not reach the practice page');
  await page.evaluate(() => [...document.querySelectorAll('.v-school .btn.primary')].pop().click()); await sleep(400); await check('practice bout', '.v-wrestle .v-wr-coach');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.tournament(1); }); await sleep(400); await check('village wrestling match', '.v-wrestle canvas');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  step = 'ger is built by hand, not bought';
  await page.evaluate(() => { const v = TG.store.active().village; v.ger.parts = { khana: 5, khaalga: 1, toono: 1, bagana: 2, uni: 9, esgii: 2, buurees: 1, buslvvr: 3 }; v.coins = 40; });
  const build = page.evaluate(() => TG._village.build(0)).catch((e) => ({ error: e.message }));
  await sleep(400);
  if ((await page.evaluate(() => TG.tasks.active() && TG.tasks.active().kind)) !== 'choose') errors.push('ger: building should start by choosing what comes first');
  // wrong first step: felt before the floor → a hint, nothing lost
  await page.evaluate(() => TG.tasks.pick('esgii')); await sleep(500);
  if (!(await page.evaluate(() => TG.store.active().village.ger.mistakes === 1 && TG.store.active().village.ger.parts.esgii === 2))) errors.push('ger: a wrong step should count a mistake and keep the parts');
  for (const st of ['shal', 'khana', 'khaalga', 'toono', 'uni', 'esgii', 'buurees', 'buslvvr', 'tulga']) { await page.evaluate((x) => TG.tasks.pick(x), st); await sleep(300); await page.evaluate(() => TG.tasks.finish()); await sleep(450); }
  await Promise.race([build, sleep(3000)]);
  const g = await page.evaluate(() => ({ st: TG.store.active().village.ger.stage, coins: TG.store.active().village.coins, built: TG.store.active().village.gerBuilt, lot: TG._village.lots()[0] && TG.vrules.lotStage(TG._village.lots()[0]) }));
  if (g.st !== 9 || !g.built || g.lot !== 9 || g.coins !== 40) errors.push('ger: nine hands-on steps should finish the ger without spending coins, got ' + JSON.stringify(g));
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  // gathering for a ger: shear sheep, make felt, trade with Grandpa Craftsman
  step = 'gathering for a ger';
  await page.evaluate(() => { const v = TG.store.active().village; v.ger = { stage: 0, lot: -1, parts: {}, wool: 0, fluff: 0, mats: 0, mistakes: 0, perfect: false }; v.shorn = {}; v.produce.aaruul = 5; v.coins = 200; });
  for (let i = 0; i < 2; i++) { const p = page.evaluate((k) => TG._village.shear(k), i).catch((e) => ({ error: e.message })); await sleep(350); await page.evaluate(() => TG.tasks && TG.tasks.finish()); await Promise.race([p, sleep(2000)]); }
  if ((await page.evaluate(() => TG.store.active().village.ger.wool)) !== 4) errors.push('gathering: two shorn sheep should give 4 wool');
  if ((await page.evaluate(() => TG._village.shearable && TG._village.shearable(0))) !== false) errors.push('gathering: a shorn sheep should not be shearable again right away');
  for (let i = 0; i < 3; i++) { const p = page.evaluate(() => TG._village.felt()).catch((e) => ({ error: e.message })); await sleep(350); await page.evaluate(() => TG.tasks && TG.tasks.finish()); await Promise.race([p, sleep(2000)]); } // beat → lay & wet → roll
  const fe = await page.evaluate(() => TG.store.active().village.ger);
  if (fe.parts.esgii !== 1 || fe.fluff !== 0 || fe.mats !== 0) errors.push('gathering: beat → lay & wet → roll should make one felt, got ' + JSON.stringify(fe));
  await page.evaluate(() => TG._village.npc('craftsman')); await sleep(300);
  await check('grandpa craftsman trades', '.npc-talk .v-trade');
  const coinsBefore = await page.evaluate(() => TG.store.active().village.coins); // rolling the felt paid a little
  await page.evaluate(() => { const b = document.querySelector('.npc-talk .v-trade [data-trade="uni"][data-pay="coins"]'); if (b) b.click(); }); await sleep(200);
  const tr2 = await page.evaluate((c0) => ({ uni: TG.store.active().village.ger.parts.uni, paid: c0 - TG.store.active().village.coins }), coinsBefore);
  if (tr2.uni !== 9 || tr2.paid !== 15) errors.push('grandpa: buying roof poles for 15 coins should give 9 poles, got ' + JSON.stringify(tr2));
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(200);
  // two people on one screen: Mom joins as player 2, the arrow keys are hers, and the toono needs both
  step = 'play together on one screen';
  await page.evaluate(() => { const l = TG._village.live(); l.me.path = []; l.me.vx = l.me.vy = 0; l.me.px = l.me.x = 17; l.me.py = l.me.y = 13; TG._village.together && TG._village.together('f1'); }); await sleep(300);
  const p2 = await page.evaluate(() => { const l = TG._village.live(); if (!l.p2) return null; l.p2.px = 19; l.p2.py = 13; return { name: l.p2.name, x: l.p2.px }; });
  if (!p2 || !/Ээж|Mom/.test(p2.name)) errors.push('together: Mom should join as player 2, got ' + JSON.stringify(p2));
  else {
    await page.keyboard.down('ArrowRight'); await sleep(500); await page.keyboard.up('ArrowRight');
    const moved = await page.evaluate((x0) => { const l = TG._village.live(); return [l.p2.px > x0 + 0.5, Math.abs(l.me.px - 17) < 0.05]; }, p2.x);
    if (!moved[0] || !moved[1]) errors.push('together: arrow keys should move player 2 only, got ' + JSON.stringify(moved));
    await page.evaluate(() => { TG.store.active().village.ger.parts = { toono: 1, bagana: 2 }; });
    const hr = page.evaluate(() => TG.tasks.run(TG.gerwork.stepSpec('toono'))).catch((e) => ({ error: e.message })); await sleep(400);
    await page.keyboard.down('KeyE'); await sleep(500);
    if (await page.evaluate(() => { const a = TG.tasks.active(); return !a || a.progress > 0; })) errors.push('together: the toono should not rise with only one player holding');
    await page.keyboard.down('Enter'); await sleep(1900); await page.keyboard.up('Enter'); await page.keyboard.up('KeyE');
    const hres = await Promise.race([hr, sleep(2000).then(() => null)]);
    if (!hres || !hres.done || !hres.together) { errors.push('together: holding with both players should lift the toono together, got ' + JSON.stringify(hres)); await page.evaluate(() => TG.tasks.cancel()); }
    await page.evaluate(() => TG._village.together(null)); await sleep(200);
    if (await page.evaluate(() => !!TG._village.live().p2)) errors.push('together: calling it again should remove player 2');
  }
  // alone: a stray second finger changes nothing, and one finger lifts the toono because grandpa holds the other post
  const sr = page.evaluate(() => TG.tasks.run(TG.gerwork.stepSpec('toono'))).catch((e) => ({ error: e.message })); await sleep(400);
  const tc = await page.evaluate(() => TG.villageView.current().taskToCss(60, 60));
  if (tc) { await page.mouse.move(tc[0], tc[1]); await page.mouse.down(); await sleep(1900); await page.mouse.up(); } // one hand (headless desktop Chrome has no touch for Phaser)
  const sres = await Promise.race([sr, sleep(2000).then(() => null)]);
  if (!sres || !sres.done) { errors.push('solo: one finger should lift the toono with grandpa holding the other post, got ' + JSON.stringify(sres)); await page.evaluate(() => TG.tasks.cancel()); }
  await check('no player-2 controls in solo play', '.village:not(:has(.v-stick.p2.on))');
  // names stay on their characters when the camera zooms out for two players far apart
  step = 'labels while zoomed out';
  // the name sits beside the level box, so compare its offset from the character before and after zooming out
  const tagOff = () => page.evaluate(() => { const sc = TG._village.phaser().scene, cam = sc.cameras.main, sp = sc.pool.get('s:me'), tg = sc.pool.get('t:me:nm'); return sp && tg ? { zoom: cam.zoom, k: sc.m.k, d: tg.x - (sp.x + 8 - cam.scrollX) * cam.zoom } : null; });
  await page.evaluate(() => { const l = TG._village.live(); l.me.path = []; l.me.px = l.me.x = 17; l.me.py = l.me.y = 13; }); await sleep(600);
  const off0 = await tagOff();
  await page.evaluate(() => { TG._village.together('f1'); }); await sleep(200);
  await page.evaluate(() => { const l = TG._village.live(); l.p2.px = 30; l.p2.py = 13; }); await sleep(900);
  const off1 = await tagOff(), off = off0 && off1 ? { zoom: off1.zoom, k: off1.k, dx: Math.abs(off1.d - off0.d), off0, off1 } : null;
  if (!off || off.zoom >= off.k || off.dx > 4) errors.push('two players: the name tag should stay over its character when zoomed out, got ' + JSON.stringify(off));
  await page.evaluate(() => TG._village.together(null)); await sleep(200);
  // a step finished by real input (not the test helper) leads straight to choosing the next step
  step = 'ger step finished by hand';
  await page.evaluate(() => { const v = TG.store.active().village; v.ger = { stage: 0, lot: -1, parts: { khana: 5, khaalga: 1, toono: 1, bagana: 2, uni: 9, esgii: 2, buurees: 1, buslvvr: 3 }, wool: 0, fluff: 0, mats: 0, mistakes: 0, perfect: false }; });
  const bp = page.evaluate(() => TG._village.build(1)).catch((e) => ({ error: e.message }));
  await sleep(400); await page.evaluate(() => TG.tasks.pick('shal')); await sleep(500);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyE'); await sleep(120); }
  await sleep(900);
  const nextKind = await page.evaluate(() => TG.tasks.active() && TG.tasks.active().kind);
  if (nextKind !== 'choose') errors.push('ger: after laying the floor by hand, the next choice should open, got ' + JSON.stringify(nextKind) + ' ' + JSON.stringify(await Promise.race([bp, sleep(50).then(() => 'pending')])));
  await page.evaluate(() => TG.tasks.cancel()); await Promise.race([bp, sleep(1000)]);
  if (await page.evaluate(() => !!document.querySelector('.village.tasking'))) errors.push('ger: the village buttons should come back after a task');
  await page.evaluate(() => { const v = TG.store.active().village; v.lots[1] = null; v.ger.stage = 9; v.ger.lot = 0; TG.store.save(); });
  // leaving the village in the middle of a task frees the controls again
  step = 'leaving during a task';
  const lp = page.evaluate(() => TG.tasks.run({ kind: 'drag', title: { mn: 'Т', en: 'T' }, hint: { mn: 'Т', en: 'T' }, path: [[20, 60], [140, 60]], n: 2, art: () => {} })).catch((e) => ({ error: e.message }));
  await sleep(400); await page.evaluate(() => TG.go('learn')); await sleep(200); await page.evaluate(() => TG.go('village')); await sleep(800);
  const left = { active: await page.evaluate(() => !!TG.tasks.active()), res: await Promise.race([lp, sleep(1000).then(() => null)]) };
  if (left.active || !left.res || left.res.done !== false) errors.push('tasks: leaving the village should close the open task, got ' + JSON.stringify(left));
  // solo play never grows extra copies of your own ger
  step = 'one ger per player in solo play';
  await page.evaluate(() => { const v = TG.store.active().village; v.lots = v.lots.map((l) => (l && l.by === v.id ? null : l)); v.lots[0] = { by: v.id, n: 'Тест', roof: 'blue', door: 'red', furn: [], stage: 9 }; v.ger.stage = 9; v.ger.lot = 5; TG.store.save(); });
  for (let i = 0; i < 2; i++) { await page.evaluate(() => TG.go('learn')); await sleep(150); await page.evaluate(() => TG.go('village')); await sleep(500); }
  const mine = await page.evaluate(() => { const v = TG.store.active().village; return v.lots.filter((l) => l && l.by === v.id).length; });
  if (mine !== 1) errors.push('solo: re-entering the village should keep exactly one of your gers, got ' + mine);

  // Basar: offline answers and a quiz (no server here, so the offline knowledge must answer)
  step = 'Basar chat (offline)';
  await page.evaluate(() => document.querySelector('.v-basar').click()); await sleep(300);
  await check('Basar chat', '.basar-chat');
  await page.evaluate(() => { const i = document.querySelector('.b-input'); i.value = 'Тараг яаж хийдэг вэ?'; [...document.querySelectorAll('.b-send .btn')].pop().click(); });
  await sleep(500);
  const answer = await page.evaluate(() => { const b = [...document.querySelectorAll('.b-row.basar .b-bubble')].pop(); return b ? b.textContent : ''; });
  if (!/хөрөнгө|бүлээн/.test(answer)) errors.push(`Basar: offline answer about yogurt was "${answer.slice(0, 80)}"`);
  await page.evaluate(() => document.querySelector('.b-tray .b-chips .chip').click()); await sleep(500);
  await check('Basar quiz', '.b-quiz .b-opt');
  await page.evaluate(() => document.querySelector('.b-opt').click()); await sleep(200);
  await check('Basar quiz explanation', '.b-exp:not(.hidden)');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  // heritage school: play every lesson to the end
  await page.evaluate(() => TG.go('learn')); await sleep(300);
  await check('heritage school', '.l-grid .l-card');
  const ids = await page.evaluate(() => TG.learn.LESSONS.map((l) => l.id));
  for (const id of ids) {
    step = `lesson ${id}`;
    await page.evaluate((id) => TG.go('lesson', { id }), id); await sleep(300);
    let finished = false;
    for (let guard = 0; guard < 200 && !finished; guard++) {
      const st = await page.evaluate(() => {
        const panel = document.querySelector('.l-panel'); if (!panel) return 'none';
        if (panel.querySelector('.l-done')) return 'done';
        const solo = panel.querySelector('.with-opt'); if (solo) { solo.click(); return 'picker'; }
        const q = panel.querySelector('.b-opt:not(:disabled)'); if (q) { q.click(); return 'quiz'; }
        const nx = [...panel.querySelectorAll('.btn.primary')].find((b) => !b.classList.contains('hidden') && !b.disabled && !b.classList.contains('l-tap'));
        if (nx) { nx.click(); return 'next'; }
        const opt = panel.querySelector('.l-opt:not(:disabled)'); if (opt) { opt.click(); return 'opt'; }
        if (panel.querySelector('.l-gauge')) return 'gauge';
        if (panel.querySelector('.l-drag:not(.done)')) return 'drag';
        const tap = panel.querySelector('.l-tap:not(:disabled)'); if (tap) { tap.click(); return 'tap'; }
        if (panel.querySelector('.l-hint')) return 'zones';
        return 'wait';
      });
      if (st === 'done') finished = true;
      else if (st === 'zones') {
        const z = await page.evaluate(() => { const t = document.querySelector('.l-panel h2').textContent; const s = TG.learn.byId('customs').steps.find((x) => TG.tx(x.title) === t); return s.zone; });
        const [zx, zy] = { khoimor: [60, 14], hearth: [60, 40], west: [22, 40], east: [98, 40], door: [60, 72] }[z];
        const box = await (await page.$('.l-scene')).boundingBox();
        await page.mouse.click(box.x + (zx / 120) * box.width, box.y + (zy / 80) * box.height);
      } else if (st === 'drag') {   // a hand gesture: pull down / lift up / swipe sideways, alternating hands when asked
        const d = await page.evaluate(() => { const p = document.querySelector('.l-drag'); return { dir: ['down', 'up', 'side'].find((c) => p.classList.contains(c)), alt: p.classList.contains('alt'), n: parseInt(p.querySelector('small').textContent, 10) }; });
        const box = await (await page.$('.l-drag')).boundingBox();
        const x0 = box.x + box.width * (d.alt ? (d.n % 2 ? 0.75 : 0.25) : 0.5), y0 = box.y + (d.dir === 'up' ? box.height - 20 : d.dir === 'down' ? 20 : box.height / 2);
        const [dx, dy] = { down: [0, 1], up: [0, -1], side: [1, 0] }[d.dir];
        await page.mouse.move(x0, y0); await page.mouse.down();
        for (let k = 1; k <= 6; k++) await page.mouse.move(x0 + dx * k * 17, y0 + dy * k * 17);
        await page.mouse.up();
      } else if (st === 'gauge') {
        const hold = await page.evaluate(() => !!document.querySelector('.l-tap img.emo[data-icon="fire"]'));
        const box = await (await page.$('.l-tap')).boundingBox();
        const zone = await page.evaluate(() => { const b = document.querySelector('.l-gauge b'); return [parseFloat(b.style.left), parseFloat(b.style.left) + parseFloat(b.style.width)]; });
        if (hold) { await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); }
        for (let k = 0; k < 500; k++) { const v = await page.evaluate(() => parseFloat(document.querySelector('.l-gauge em').style.left)); if (v > zone[0] + 2 && v < zone[1] - 2) break; await sleep(10); }
        if (hold) await page.mouse.up(); else await page.mouse.click(box.x + 20, box.y + 20);
      }
      await sleep(st === 'quiz' ? 250 : 60);
    }
    if (!finished) errors.push(`lesson ${id}: could not be completed`);
    await check(`lesson ${id} family activity`, '.l-family');
  }
  const learned = await page.evaluate(() => TG.learn.LESSONS.every((l) => TG.learn.done(l.id)));
  if (!learned) errors.push('lessons: progress was not saved');
  // learn together: a lesson with family takes turns and counts for the parent dashboard
  step = 'lesson with family';
  await page.evaluate(() => TG.go('lesson', { id: 'nuuts' })); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('.with-opt')][1].click()); await sleep(150);
  await page.evaluate(() => document.querySelector('.with-picker .fam-chip').click()); await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll('.with-picker .btn.primary')].pop().click()); await sleep(250);
  await check('turn badge in a family lesson', '.l-panel .turn-badge');
  step = 'quiz party with a friend';
  await page.evaluate(() => TG.basar.quizParty('ger')); await sleep(250);
  await page.evaluate(() => [...document.querySelectorAll('.with-opt')][2].click()); await sleep(150);
  await page.evaluate(() => { const i = document.querySelector('.add-friend .input'); i.value = 'Ану'; document.querySelector('.add-friend .btn').click(); }); await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll('.with-picker .btn.primary')].pop().click()); await sleep(400);
  for (let k = 0; k < 4; k++) { await page.evaluate(() => { const o = document.querySelector('.b-opt:not(:disabled)'); if (o) o.click(); }); await sleep(120); await page.evaluate(() => { const n = [...document.querySelectorAll('.basar-modal .btn.primary')].find((x) => !x.classList.contains('hidden')); if (n) n.click(); }); await sleep(250); }
  await check('quiz party scoreboard', '.basar-modal .l-score');
  if (!(await page.evaluate(() => (TG.store.active().together || {}).friends >= 1))) errors.push('learn together: the friends quiz was not recorded');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  step = 'a save from before hands-on building keeps its ger';
  await page.evaluate(() => { const v = TG.store.active().village; delete v.ger; v.gerBuilt = true; TG.store.save(); });
  await page.evaluate(() => TG.go('learn')); await sleep(150); await page.evaluate(() => TG.go('village')); await sleep(700);
  if ((await page.evaluate(() => (TG.store.active().village.ger || {}).stage)) !== 9) errors.push('old save: a ger built before this update should load finished');
  // furnish it and walk inside
  step = 'inside my ger';
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => { const l = TG._village.lots()[0]; if (l) l.furn = ['tulga', 'or', 'avdar', 'morinkhuur', 'shirdeg', 'shagai']; TG._village.enterGer(0); }); await sleep(500);
  await check('full-screen ger interior', '.fscene.ger-scene .scene-cv');
  if (!(await page.evaluate(() => { const r = document.querySelector('.ger-scene').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }))) errors.push('ger interior: should fill the whole screen');
  // tap the floor to walk, then walk up to the stove and press E
  const p0 = await page.evaluate(() => ({ x: TG._village.ger.me.x, y: TG._village.ger.me.y }));
  await page.evaluate(() => { const c = document.querySelector('.ger-scene .scene-cv'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width * 0.35, clientY: r.top + r.height * 0.5, bubbles: true })); }); await sleep(900);
  if (await page.evaluate((p0) => Math.hypot(TG._village.ger.me.x - p0.x, TG._village.ger.me.y - p0.y) < 8, p0)) errors.push('ger interior: tapping the floor did not walk there');
  await page.evaluate(() => { const m = TG._village.ger.me; m.x = m.tx = 160; m.y = m.ty = 160; }); await sleep(250);
  await page.keyboard.press('KeyE'); await sleep(300);
  if (!(await page.evaluate(() => !!document.querySelector('.ger-scene .scene-info img.emo[data-icon="tea"]')))) errors.push('ger interior: pressing E at the stove did not make tea');
  await page.keyboard.down('Space'); await sleep(150); await page.keyboard.up('Space');
  if (!(await page.evaluate(() => TG._village.ger.me.z > 0))) errors.push('ger interior: Space did not jump');
  await page.evaluate(() => { const m = TG._village.ger.me; m.x = m.tx = 244; m.y = m.ty = 178; }); await sleep(250);
  await page.keyboard.press('KeyE'); await sleep(300);
  if (!(await page.evaluate(() => (TG.store.active().village.ate || {}).tsai >= 1))) errors.push('ger interior: milk tea from the cupboard did not work');
  await sleep(500); await page.keyboard.press('Escape'); await sleep(300);
  if (await page.evaluate(() => !!document.querySelector('.fscene'))) errors.push('ger interior: Escape did not leave the ger');
  // the village: Space jumps, E interacts, the minimap is shown
  step = 'village jump + minimap';
  await check('village minimap', '.village .v-mini');
  await page.keyboard.down('Space'); await sleep(100); await page.keyboard.up('Space');
  if (!(await page.evaluate(() => performance.now() - (TG._village.live().me.jt || 0) < 1000))) errors.push('village: Space did not jump');
  // the hands-on task scene (Phaser): a real two-stroke drag finishes a drag task
  step = 'hands-on task scene';
  const tr = page.evaluate(() => TG.tasks.run({ kind: 'drag', title: { mn: 'Тест', en: 'Test' }, hint: { mn: 'Чир', en: 'Drag' }, path: [[20, 60], [140, 60]], n: 2, art: () => {} })).catch((e) => ({ error: e.message }));
  await sleep(400);
  const act = await page.evaluate(() => TG.tasks.active());
  if (!act || act.kind !== 'drag' || act.n !== 2) errors.push('task scene: drag task should be active, got ' + JSON.stringify(act));
  for (let i = 0; i < 2; i++) { const [a, b] = await page.evaluate(() => [TG.villageView.current().taskToCss(20, 60), TG.villageView.current().taskToCss(140, 60)]); await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 12 }); await page.mouse.up(); await sleep(250); }
  const res = await Promise.race([tr, sleep(3000).then(() => null)]);
  if (!res || !res.done) { errors.push('task scene: two real drags should finish the task, got ' + JSON.stringify(res)); await page.evaluate(() => TG.tasks && TG.tasks.cancel && TG.tasks.cancel()); }
  if (await page.evaluate(() => !!TG.tasks.active())) errors.push('task scene: the task should close when finished');
  // walking into a rock hops over it
  const rock = await page.evaluate(() => {
    const W = TG.vworld; let r = null;
    for (let y = 2; y < W.H - 2 && !r; y++) for (let x = 2; x < W.W - 3 && !r; x++) if (W.g[y][x] === 'r' && !W.blocked(x - 1, y) && !W.blocked(x + 1, y) && !W.blocked(x + 2, y)) r = { x, y };
    if (r) { const l = TG._village.live(); l.me.path = []; l.me.vx = l.me.vy = 0; l.me.px = l.me.x = r.x - 1; l.me.py = l.me.y = r.y; }
    return r;
  });
  if (!rock) errors.push('village: no rock to jump over');
  else {
    await page.keyboard.down('KeyD'); await sleep(900); await page.keyboard.up('KeyD'); await sleep(200);
    const px = await page.evaluate(() => TG._village.live().me.px);
    if (!(px > rock.x + 0.4)) errors.push(`village: walking into a rock did not hop over it (rock at ${rock.x}, stopped at ${px.toFixed(2)})`);
  }
  // running (Shift, or the 🏃 button on phones) is faster and uses energy; food fills it back up
  step = 'running + eating';
  await page.evaluate(() => { TG.store.active().village.energy = 60; const l = TG._village.live(); l.me.px = l.me.x = 17; l.me.py = l.me.y = 13; });
  await page.evaluate(() => document.querySelector('.v-run').click());
  await page.evaluate(() => TG._village.goTo({ x: 30, y: 13 }, null)); await sleep(500);
  const ran = await page.evaluate(() => ({ running: TG._village.live().me.running, sp: Math.hypot(TG._village.live().me.vx, TG._village.live().me.vy) }));
  await sleep(1200);
  await page.evaluate(() => document.querySelector('.v-run').click());
  if (!ran.running || ran.sp < 6) errors.push(`running: the run toggle did not make you run (${JSON.stringify(ran)})`);
  if (!(await page.evaluate(() => TG.store.active().village.energy < 60))) errors.push('running: energy did not go down');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await sleep(400);
  if (!(await page.evaluate(() => TG._village.live().me.running))) errors.push('running: holding Shift did not run');
  await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft'); await sleep(200);
  const e0 = await page.evaluate(() => ({ en: TG.store.active().village.energy, coins: TG.store.active().village.coins }));
  await page.evaluate(() => document.querySelector('.v-energy').click()); await sleep(250);
  await check('food panel', '.modal .v-list .v-row');
  await page.evaluate(() => [...document.querySelectorAll('.modal .v-row')].find((r) => /Бууз/.test(r.textContent)).querySelector('.btn').click()); await sleep(250);
  const e1 = await page.evaluate(() => ({ en: TG.store.active().village.energy, coins: TG.store.active().village.coins, ate: (TG.store.active().village.ate || {}).buuz }));
  if (!(e1.en > e0.en && e1.coins === e0.coins - 12 && e1.ate === 1)) errors.push(`eating: buuz did not work ${JSON.stringify([e0, e1])}`);
  await page.evaluate(() => [...document.querySelectorAll('.modal .chip')].find((c) => /Уух/.test(c.textContent)).click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('.modal .v-row')].find((r) => /Айраг/.test(r.textContent)).querySelector('.btn').click()); await sleep(250);
  if (!(await page.evaluate(() => (TG.store.active().village.ate || {}).airag === 1))) errors.push('drinking: airag did not work');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  // horse riding and the Naadam horse race
  step = 'horse riding';
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.mount('chestnut'); }); await sleep(200);
  if (!(await page.evaluate(() => TG.store.active().village.look.ride === 'horse'))) errors.push('horse: mounting did not work');
  step = 'horse race';
  await page.evaluate(() => TG._village.race()); await sleep(3300);
  if ((await page.evaluate(() => TG._village.raceState() && TG._village.raceState().phase)) !== 'go') errors.push('horse race: the race did not start after the countdown');
  const nPts = await page.evaluate(() => TG._village.raceState().path.P.length);
  for (let i = 1; i < nPts; i++) { await page.evaluate((i) => { const L = TG._village.live(), q = L.race.path.P[i]; L.me.px = q.x - 0.5; L.me.py = q.y - 0.82; }, i); await sleep(120); }
  await sleep(300);
  if (!(await page.evaluate(() => TG.store.active().village.horse.races === 1))) errors.push('horse race: finishing the race was not recorded');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => TG._village.dismount()); await sleep(100);
  step = 'race classes';
  if (!(await page.evaluate(() => TG.store.active().village.horse.cls >= 1))) errors.push('horse race: winning the Daaga race should unlock the next class');
  await page.evaluate(() => TG._village.race(1)); await sleep(300);
  if ((await page.evaluate(() => TG._village.raceState().C.id)) !== 'shudlen') errors.push('horse race: could not start the Shüdlen class');
  await page.evaluate(() => { TG._village.live().race = null; }); await sleep(100);
  // Grandma's etiquette visit: wrong answers get a gentle explanation, then the visit continues
  step = 'grandma visit';
  await page.evaluate(() => TG._village.emee()); await sleep(400);
  await check('grandma visit', '.emee-visit .l-scene');
  for (let k = 0; k < 12; k++) {
    const done = await page.evaluate(() => !!document.querySelector('.emee-visit .l-reward'));
    if (done) break;
    const zone = await page.evaluate(() => !!document.querySelector('.emee-visit .l-hint'));
    if (zone) { const box = await (await page.$('.emee-visit .l-scene')).boundingBox(); await page.mouse.click(box.x + (22 / 120) * box.width, box.y + (40 / 80) * box.height); }
    else await page.evaluate((k) => { const o = [...document.querySelectorAll('.emee-visit .l-opt:not(:disabled)')]; const wrong = k === 0 ? o.find((b) => /гишгэнэ/.test(b.textContent)) : null; (wrong || o.find((b) => /давна|Сайн байна|Нар зөв|Баруун гараараа|Баярлалаа/.test(b.textContent)) || o[0]).click(); }, k);
    await sleep(600);
    if (k === 0) { const gentle = await page.evaluate(() => !!document.querySelector('.emee-say .gentle')); if (!gentle) errors.push('grandma visit: a wrong move should get a gentle explanation'); }
  }
  if (!(await page.evaluate(() => (TG.store.active().village.emee || {}).visits === 1))) errors.push('grandma visit: the visit was not completed');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  // archery: one arrow
  step = 'archery';
  await page.evaluate(() => TG._village.archery()); await sleep(400);
  await check('archery game', '.v-archery canvas');
  await page.evaluate(() => document.querySelector('.v-archery .btn.primary').click()); await sleep(400);
  await page.evaluate(() => document.querySelector('.v-archery .btn.primary').click()); await sleep(3200);
  if (!(await page.evaluate(() => (TG.store.active().village.arch || {}).shots === 1))) errors.push('archery: the arrow was not shot');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  step = 'seasons';
  await page.evaluate(() => TG.seasons.open()); await sleep(250);
  await check('season explainer', '.season-modal .season-wheel .sw-i.on');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(200);
  const fx = await page.evaluate(() => { const v = TG._village.phaser(), f = v && v.fx && v.fx(); return f && { ...f, want: TG._village.live().season }; });
  if (!fx || fx.season !== fx.want || fx.emitters < 1) errors.push('village: season particles should run on Phaser, got ' + JSON.stringify(fx));
  if (!(await page.evaluate(() => TG.store.active().village.quests.list.some((q) => q.season)))) errors.push('seasons: there is no season quest today');
  // townspeople: accept a task, do it, collect the reward
  step = 'townspeople quests';
  await page.evaluate(() => TG._village.npc('farmer')); await sleep(300);
  await check('townsperson dialogue', '.npc-talk .npc-head');
  await page.evaluate(() => [...document.querySelectorAll('.npc-talk .btn.primary')].pop().click()); await sleep(200);
  await page.evaluate(() => TG.villageQuest('milk', 3)); await sleep(200);
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => TG._village.npc('farmer')); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('.npc-talk .btn.primary')].pop().click()); await sleep(250);
  if ((await page.evaluate(() => TG.store.active().village.npc.farmer.step)) !== 1) errors.push('townspeople: finishing the first task did not advance the quest chain');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  step = 'wrestling techniques';
  await page.evaluate(() => TG._village.tournament(8)); await sleep(400);
  // the eagle dance (дэвээ) comes first: four flaps, then the move buttons appear
  if (!(await page.evaluate(() => /Засуул/.test(document.querySelector('.v-wrestle').textContent)))) errors.push('wrestling: the zasuul did not announce the wrestlers');
  for (let i = 0; i < 4; i++) { await page.evaluate(() => document.querySelector('.v-wr-devee .btn').click()); await sleep(150); }
  await sleep(1100);
  const nMoves = await page.evaluate(() => document.querySelectorAll('.v-wr-moves .btn').length);
  if (nMoves !== 13) errors.push(`wrestling: expected 13 techniques, found ${nMoves}`);
  // a footwork move (хавирах) needs the arrow combo, not Space
  await page.evaluate(() => [...document.querySelectorAll('.v-wr-moves .btn')].find((b) => /Хавирах/.test(b.querySelector('b').textContent)).click()); await sleep(200);
  if (!(await page.evaluate(() => document.querySelectorAll('.v-wr-combo .v-wr-arrow').length >= 3))) errors.push('wrestling: хавирах should ask for a footwork combo');
  for (let i = 0; i < 8 && (await page.evaluate(() => !!document.querySelector('.v-wr-arrow.next'))); i++) { const k = await page.evaluate(() => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][['←', '→', '↑', '↓'].indexOf(document.querySelector('.v-wr-arrow.next').textContent)]); await page.keyboard.press(k); await sleep(60); }
  await sleep(300);
  if (!(await page.evaluate(() => /%/.test(document.querySelector('.v-wr-msg').textContent)))) errors.push('wrestling: finishing the combo did not perform the move');
  // first-person wrestling view
  await page.evaluate(() => document.querySelector('.v-wr-view').click()); await sleep(400);
  if ((await page.evaluate(() => TG.store.active().village.wrView)) !== 'fp') errors.push('wrestling: the first-person view did not switch on');
  await page.evaluate(() => document.querySelector('.v-wr-view').click()); await sleep(100);
  if (!(await page.evaluate(() => /3/.test(document.querySelector('.v-wrestle .eyebrow').textContent)))) errors.push('wrestling: late rounds should need 3 falls');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  // defend the homeland: raiders ride in, whistling arrows break their courage, winning teaches the real history
  step = 'defend the homeland';
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.general(); }); await sleep(250);
  await check('general', '.modal .v-list .v-row');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.battle('merkit'); }); await sleep(2600);
  if (!(await page.evaluate(() => TG._village.battleState() && TG._village.battleState().enemies.length >= 1))) errors.push('battle: no raiders rode in');
  for (let i = 0; i < 30 && (await page.evaluate(() => TG._village.battleState().repelled < 1)); i++) { await page.evaluate(() => { const bt = TG._village.battleState(), L = TG._village.live(), e = bt.enemies.find((q) => !q.flee); if (e) { L.me.px = e.x - 1.5; L.me.py = e.y - 0.82; } }); await page.keyboard.press('KeyF'); await sleep(250); }
  if (!(await page.evaluate(() => TG._village.battleState().repelled >= 1))) errors.push('battle: arrows did not make a raider lose courage');
  await page.evaluate(() => { const bt = TG._village.battleState(); bt.wave = bt.ch.waves.length - 1; bt.toSpawn = 0; bt.enemies = []; }); await sleep(600);
  if (!(await page.evaluate(() => !!(TG.store.active().village.camp || {}).won && !!TG.store.active().village.camp.won.merkit))) errors.push('battle: winning the Merkit chapter was not recorded');
  if (!(await page.evaluate(() => /Нууц товчоо|Secret History/.test(document.querySelector('.modal').textContent)))) errors.push('battle: the history lesson after the battle is missing');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(800);
  // first-person battle: F looses an arrow in 3D too
  await page.evaluate(() => TG._village.battle('tatar')); await sleep(300);
  await page.evaluate(() => TG._village.fp()); await sleep(3500);
  if (!(await page.evaluate(() => !!document.querySelector('.village-fp .fp-cv')))) errors.push('first-person village: did not open');
  // phones: a thumb that lands on the info box must still work the joystick
  {
    const at = await page.evaluate(() => { const b = document.querySelector('.village-fp .scene-info').getBoundingClientRect(); return { x: Math.min(b.x + 20, innerWidth * 0.4), y: b.y + b.height / 2 }; });
    const me0 = await page.evaluate(() => [TG._village.fpScene.me.x, TG._village.fpScene.me.y]);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x, y: at.y - i * 8 }] }); await sleep(30); }
    await sleep(700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    if (await page.evaluate((a) => Math.hypot(TG._village.fpScene.me.x - a[0], TG._village.fpScene.me.y - a[1]) < 0.3, me0)) errors.push('first-person village: the touch joystick did not walk when started on the info box');
  }
  await sleep(1500);
  await page.evaluate(() => { const bt = TG._village.battleState(), e = bt && bt.enemies[0], sc = TG._village.fpScene; if (e) { sc.me.x = e.x - 1; sc.me.y = e.y; } }); await sleep(200);
  const shots0 = await page.evaluate(() => TG._village.battleState().shots || 0);
  await page.keyboard.press('KeyF'); await sleep(100);
  // a raider one step away is hit (and the arrow gone) within a frame or two, so count the shot itself
  if (!(await page.evaluate((n) => (TG._village.battleState().shots || 0) > n, shots0))) errors.push('first-person battle: F did not shoot, ' + (await page.evaluate(() => { const bt = TG._village.battleState(), L = TG._village.live(); return JSON.stringify({ over: bt.over, cd: bt.cd, herd: bt.herd, enemies: bt.enemies.map((e) => ({ x: +e.x.toFixed(1), y: +e.y.toFixed(1), flee: !!e.flee })), me: [+(L.me.px + 0.5).toFixed(1), +(L.me.py + 0.82).toFixed(1)] }); })));
  await page.evaluate(() => { const bt = TG._village.battleState(); bt.herd = 0; }); await sleep(600);
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(300);
  await page.evaluate(() => TG._village.fpScene.close()); await sleep(400);
  // the historian: find an arrowhead in Khentii, hand it in
  step = 'historian';
  await page.evaluate(() => { TG.store.active().aimagPass = { at: Date.now(), local: true }; TG.store.save(); }); // the first quest goes to Khentii, past the free aimags
  await page.evaluate(() => TG.history.open()); await sleep(250);
  await check('historian', '.modal .btn.primary');
  await page.evaluate(() => document.querySelector('.modal .btn.primary').click()); await sleep(1200);
  const art = await page.evaluate(() => { const c = TG.travel._cur, t = c.things.find((q) => q.kind === 'artifact'); if (!t) return false; c.me.x = c.me.tx = t.x; c.me.y = c.me.ty = t.y + 2; return true; });
  if (!art) errors.push('historian: the arrowhead is not in Khentii');
  else { await sleep(250); await page.keyboard.press('KeyE'); await sleep(300); }
  if (!(await page.evaluate(() => TG.store.active().hist && TG.store.active().hist.done))) errors.push('historian: finding the item did not count');
  await page.evaluate(() => TG.travel._cur.close()); await sleep(400);
  await page.evaluate(() => TG.history.open()); await sleep(250);
  await page.evaluate(() => document.querySelector('.modal .btn.primary').click()); await sleep(300);
  if ((await page.evaluate(() => TG.store.active().hist.step)) !== 1) errors.push('historian: handing in did not move to the next task');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  // Basar understands English and does simple maths offline
  step = 'Basar in English';
  await page.evaluate(() => TG.basar.open()); await sleep(250);
  for (const q of ['What is a ger?', '6 x 7']) { await page.evaluate((q) => { const i = document.querySelector('.b-input'); i.value = q; [...document.querySelectorAll('.b-send .btn')].pop().click(); }, q); await sleep(350); }
  const en = await page.evaluate(() => [...document.querySelectorAll('.b-row.basar .b-bubble')].slice(-2).map((b) => b.textContent));
  if (!/clever home|khana/.test(en[0] || '')) errors.push(`Basar: English question got "${(en[0] || '').slice(0, 60)}"`);
  if (!/42/.test(en[1] || '')) errors.push(`Basar: offline maths answer was "${(en[1] || '').slice(0, 60)}"`);
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

  step = 'achievements';
  await page.evaluate(() => TG.go('achievements')); await sleep(300);
  await check('achievements screen', '.ach-grid .ach.on');
  const achs = await page.evaluate(() => Object.keys(TG.store.active().ach || {}));
  for (const id of ['first_lesson', 'all_lessons', 'ger_master', 'nuuts', 'with_friends']) if (!achs.includes(id)) errors.push(`achievements: "${id}" was not awarded`);
  step = 'parent report';
  await page.evaluate(() => TG.go('family')); await sleep(250);
  await page.evaluate(() => { const g = document.querySelector('.gate-q'); if (!g) return; const q = g.textContent.match(/(\d+) × (\d+)/); document.querySelector('.gate-input').value = q[1] * q[2]; [...document.querySelectorAll('.gate .btn')].pop().click(); }); await sleep(400);
  await check('parent sees badges', '.ach-earned .ach-chip');
  await check('parent sees what was learned', '.learned li');

  // aimag passport: Ulaanbaatar first, then the next province unlocks
  step = 'aimag passport';
  await page.evaluate(() => TG.go('passport')); await sleep(300);
  await check('passport', '.pp-grid .pp-slot.next');
  await page.evaluate(() => TG.go('aimag', { id: 'tuv' })); await sleep(250);
  if (await page.evaluate(() => !!document.querySelector('.pp-visit'))) errors.push('passport: Töv should be locked before Ulaanbaatar is stamped');
  await page.evaluate(() => TG.go('aimag', { id: 'ub' })); await sleep(400);
  await check('aimag visit', '.pp-visit .pp-land');
  // actually travel there: visit the 3 places, then the local guide gives the stamp
  step = 'travel to Ulaanbaatar';
  await page.evaluate(() => document.querySelector('.pp-go .btn.primary').click()); await sleep(600);
  await check('travel map', '.travel-scene .scene-cv');
  await check('travel minimap', '.travel-scene .scene-mini');
  const goToThing = (sel) => page.evaluate((sel) => { const c = TG.travel._cur, t = sel === 'guide' ? c.things.find((q) => q.kind === 'guide') : c.things.filter((q) => q.kind === 'mark')[sel]; c.me.x = c.me.tx = t.x; c.me.y = c.me.ty = t.y + 4; }, sel);
  await goToThing('guide'); await sleep(250); await page.evaluate(() => document.querySelector('.travel-scene .scene-act').click()); await sleep(200);
  if (await page.evaluate(() => !!document.querySelector('.travel-scene .scene-info .l-opt'))) errors.push('travel: the guide should ask you to visit the 3 places first');
  for (let i = 0; i < 3; i++) { await goToThing(i); await sleep(250); await page.keyboard.press('KeyE'); await sleep(200); }
  if ((await page.evaluate(() => TG.travel._cur.seen.length)) !== 3) errors.push('travel: pressing E at the landmarks did not visit them');
  await goToThing('guide'); await sleep(250); await page.evaluate(() => document.querySelector('.travel-scene .scene-act').click()); await sleep(250);
  await page.evaluate(() => [...document.querySelectorAll('.travel-scene .scene-info .l-opt')].find((x) => /Өргөө/.test(x.textContent)).click()); await sleep(400);
  if (!(await page.evaluate(() => !!(TG.store.active().passport || { stamps: {} }).stamps.ub))) errors.push('travel: the guide did not give the Ulaanbaatar stamp');
  // the herder family offers their local food
  await page.evaluate(() => { const c = TG.travel._cur, t = c.things.find((q) => q.kind === 'family'); c.me.x = c.me.tx = t.x; c.me.y = c.me.ty = t.y + 2; }); await sleep(300);
  await page.keyboard.press('KeyE'); await sleep(250);
  await page.evaluate(() => [...document.querySelectorAll('.travel-scene .scene-info .btn')].find((b) => /амсах|Taste/.test(b.textContent)).click()); await sleep(250);
  if (!(await page.evaluate(() => !!(TG.store.active().travelFam || {}).ub && (TG.store.active().village.ate || {}).buuz >= 2))) errors.push('travel: the herder family did not share their food');
  await check('travel herds', '.travel-scene .scene-cv');
  if (!(await page.evaluate(() => TG.travel._cur.things.filter((q) => q.kind === 'animal').length >= 3))) errors.push('travel: no herd animals on the map');
  await page.evaluate(() => { const c = TG.travel._cur, t = c.things.find((q) => q.kind === 'animal'); c.me.x = c.me.tx = t.x; c.me.y = c.me.ty = t.y; }); await sleep(150);
  await page.keyboard.press('KeyE'); await sleep(250);
  await check('travel animal fact', '.travel-scene .scene-info');
  if (!(await page.evaluate(() => /Адуу/.test(document.querySelector('.travel-scene .scene-info').textContent)))) errors.push('travel: talking to a horse did not show its name and fact');
  // first person (3D): switch view, walk, jump, sprint, talk, switch back
  step = 'first-person trip';
  await page.evaluate(() => document.querySelector('.travel-view').click()); await sleep(3000);
  const fpOn = await page.evaluate(() => ({ view: TG.travel._cur.view, cv: !!document.querySelector('.fp .fp-cv'), verts: TG.travel._cur.sc.stats ? TG.travel._cur.sc.stats.verts : 0, gl: TG.fp.supported() }));
  if (!fpOn.gl) errors.push('first person: WebGL is not available in the test browser');
  else {
    if (fpOn.view !== 'fp' || !fpOn.cv || fpOn.verts < 20000) errors.push(`first person: the 3D view did not open ${JSON.stringify(fpOn)}`);
    const p0 = await page.evaluate(() => { const P = TG.travel._cur.sc.P; return { x: P.x, z: P.z, y: P.y }; });
    await page.keyboard.down('KeyW'); await sleep(800); await page.keyboard.up('KeyW'); await sleep(200);
    const p1 = await page.evaluate(() => { const P = TG.travel._cur.sc.P; return { x: P.x, z: P.z, y: P.y, ground: P.ground }; });
    if (Math.hypot(p1.x - p0.x, p1.z - p0.z) < 1.5) errors.push(`first person: W did not walk forward ${JSON.stringify([p0, p1])}`);
    if (!p1.ground) errors.push('first person: the player is not standing on the ground');
    await page.keyboard.press('Space'); await sleep(160);
    if (!(await page.evaluate((y0) => TG.travel._cur.sc.P.y > y0 + 0.4, p1.y))) errors.push('first person: Space did not jump');
    await sleep(700);
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await sleep(400);
    if (!(await page.evaluate(() => TG.travel._cur.sc.P.sprint))) errors.push('first person: Shift + W did not sprint');
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await sleep(300);
    await page.evaluate(() => { const c = TG.travel._cur, t = c.things.find((q) => q.kind === 'guide'); c.me.x = t.x; c.me.y = t.y + 4; }); await sleep(300);
    await page.keyboard.press('KeyE'); await sleep(300);
    if (!(await page.evaluate(() => /хөтөч|guide/i.test(document.querySelector('.fp .scene-info').textContent)))) errors.push('first person: pressing E at the guide did not talk');
    await check('first-person screen', '.fp .fp-hud');
    await page.evaluate(() => document.querySelector('.travel-view').click()); await sleep(1200);
    if ((await page.evaluate(() => TG.travel._cur.view)) !== '2d') errors.push('first person: switching back to the top view did not work');
  }
  await page.evaluate(() => TG.travel._cur.close()); await sleep(400);
  await page.evaluate(() => TG.go('aimag', { id: 'tuv' })); await sleep(700);
  await check('next province unlocked after the stamp', '.pp-visit + .card .pp-go, .pp-visit ~ .pp-go');
  // Mongol script academy: a good tracing earns stars, a scribble does not
  step = 'mongol script academy';
  await page.evaluate(() => TG.go('bichig')); await sleep(900);
  await check('academy', '.bichig .bc-cv');
  if (!(await page.evaluate(() => !!TG.bichig._cur.lay))) errors.push('academy: the Mongol script letter did not render');
  const scribble = await page.evaluate(() => { const c = TG.bichig._cur; c.setStrokes([[{ x: 4, y: 4 }, { x: 30, y: 10 }, { x: 10, y: 30 }]]); c.check(); return (TG.store.active().bichig || { s: {} }).s.a || 0; });
  if (scribble) errors.push('academy: a scribble in the corner should not pass');
  const traced = await page.evaluate(() => { const c = TG.bichig._cur, { W, H, lay, item } = c, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); TG.bichig.drawGlyph(x, item.g, lay, W, H, '#000'); const d = x.getImageData(0, 0, W, H).data, st = []; for (let y = 0; y < H; y += 5) for (let X = 0; X < W; X += 5) if (d[(y * W + X) * 4 + 3] > 100) st.push([{ x: X, y }]); c.setStrokes(st); c.check(); return (TG.store.active().bichig || { s: {} }).s.a || 0; });
  if (!traced) errors.push('academy: tracing the letter carefully did not earn a star');
  await check('academy after a good tracing', '.bc-tile.done');
  for (const screen of ['memories', 'about']) {
    await page.evaluate((s) => TG.go(s), screen); await sleep(250);
    await check(`screen ${screen}`, screen === 'about' ? '.about' : '.shell');
    if (screen === 'about' && !(await page.evaluate(() => /Phaser 4/.test((document.querySelector('.about') || {}).textContent || '')))) errors.push('about: the pitch page should say the village is built with Phaser 4');
  }

  step = 'log out and log in with the picture password';
  await page.evaluate(() => { TG.store.state.loggedIn = false; TG.go('auth', { tab: 'login' }); }); await sleep(300);
  await page.evaluate(() => document.querySelector('.auth-prof').click()); await sleep(200);
  for (const k of [0, 4, 7]) await page.evaluate((k) => document.querySelectorAll('.pic-key')[k].click(), k); // wrong
  await sleep(400);
  if (await page.evaluate(() => !!document.querySelector('.village'))) errors.push('login: a wrong picture password let the child in');
  for (const k of [0, 4, 8]) await page.evaluate((k) => document.querySelectorAll('.pic-key')[k].click(), k); // right
  await sleep(700);
  await check('village after login', '.village canvas');
  console.log(`Checked register/login, the village, Basar, ${ids.length} lessons, the ger unlock and the family screens.`);
} catch (e) {
  errors.push(`crashed during "${step}": ${e.message}`);
}

await browser.close(); server.close();
if (external.length) errors.push(`requests to outside servers (app must work offline): ${[...new Set(external)].join(', ')}`);
if (errors.length) { console.error('Smoke test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Smoke test passed: no errors, no outside requests.');
