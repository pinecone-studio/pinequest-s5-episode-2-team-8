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
  // no screen may ever show "null", "undefined" or "NaN" to a child
  const junk = await page.evaluate(() => { const out = []; const w = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3 && /\bnull\b|\bundefined\b|\bNaN\b|\[object /.test(c.textContent)) out.push(c.textContent.trim().slice(0, 60)); else if (c.nodeType === 1 && c.tagName !== 'SCRIPT') w(c); } }; w(document.body); return out; });
  junk.forEach((t) => errors.push(`${label}: shows broken text "${t}"`));
};

try {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
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
  if (!(await page.evaluate(() => /📍/.test(document.querySelector('.v-loc').textContent)))) errors.push('village: the home province chip is missing');
  const prof = await page.evaluate(() => { const p = TG.store.active(); return p && { name: p.name, age: p.age, avatar: p.avatar, code: p.code }; });
  if (!prof || prof.name !== 'Тест' || prof.age !== 8 || !prof.code) errors.push(`register: profile not saved correctly: ${JSON.stringify(prof)}`);
  await page.evaluate(() => { TG.store.state.settings.sound = false; document.querySelectorAll('.modal-x').forEach((x) => x.click()); });

  // modal accessibility: focus moves into the dialog, Escape closes it, focus returns
  step = 'modal accessibility';
  await sleep(400);
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
  const solo = await page.evaluate(() => { const L = TG._village.live(); return L && L.status; });
  if (solo !== 'solo') errors.push(`village: expected solo mode without a server, got "${solo}"`);
  if (!(await page.evaluate(() => !!TG._village.dog()))) errors.push('village: Basar the dog is not following the player');
  await page.evaluate(() => { const v = TG.store.active().village; v.seeds.carrot = 2; TG._village.act('plant', 0, 'carrot'); });
  await sleep(300);
  if (!(await page.evaluate(() => { const p = TG.store.active().village.garden[0]; return p && p.c === 'carrot'; }))) errors.push('village: planting in solo mode did not work');
  for (const btn of ['bag', 'talk', 'quests']) { await page.evaluate((b) => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector(`.v-round[aria-label="${b}"]`).click(); }, btn); await sleep(300); await check(`village ${btn} panel`, '.modal'); }
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); document.querySelector('.v-pills .v-pill').click(); }); await sleep(250); await check('village shop', '.v-shop');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.arena(); }); await sleep(300); await check('village wrestling panel', '.v-wr-head');
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.tournament(1); }); await sleep(400); await check('village wrestling match', '.v-wrestle canvas');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  step = 'ger locked before the lesson';
  await page.evaluate(() => TG._village.lot(0)); await sleep(300);
  if (!(await page.evaluate(() => /сур|Learn/i.test((document.querySelector('.modal h2') || {}).textContent || '')))) errors.push('village: building a ger should ask to finish the ger lesson first');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);

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
    for (let guard = 0; guard < 120 && !finished; guard++) {
      const st = await page.evaluate(() => {
        const panel = document.querySelector('.l-panel'); if (!panel) return 'none';
        if (panel.querySelector('.l-done')) return 'done';
        const solo = panel.querySelector('.with-opt'); if (solo) { solo.click(); return 'picker'; }
        const q = panel.querySelector('.b-opt:not(:disabled)'); if (q) { q.click(); return 'quiz'; }
        const nx = [...panel.querySelectorAll('.btn.primary')].find((b) => !b.classList.contains('hidden') && !b.disabled && !b.classList.contains('l-tap'));
        if (nx) { nx.click(); return 'next'; }
        const opt = panel.querySelector('.l-opt:not(:disabled)'); if (opt) { opt.click(); return 'opt'; }
        if (panel.querySelector('.l-gauge')) return 'gauge';
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
      } else if (st === 'gauge') {
        const hold = await page.evaluate(() => document.querySelector('.l-tap').textContent.includes('🔥'));
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

  step = 'ger unlocked after the lesson';
  await page.evaluate(() => TG.go('village')); await sleep(700);
  await page.evaluate(() => { document.querySelectorAll('.modal-x').forEach((x) => x.click()); TG._village.lot(0); }); await sleep(300);
  await check('ger builder unlocked', '.modal .v-gerbox + .label, .modal .v-chips');
  // buy it, furnish it and walk inside
  step = 'inside my ger';
  await page.evaluate(() => { TG.store.active().village.coins = 2000; TG.store.active().village.xp = 3000; [...document.querySelectorAll('.modal .btn.primary')].pop().click(); }); await sleep(700);
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
  if (!(await page.evaluate(() => /🍵/.test(document.querySelector('.ger-scene .scene-info').textContent)))) errors.push('ger interior: pressing E at the stove did not make tea');
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
  if (!(await page.evaluate(() => TG.store.active().village.quests.list.some((q) => q.season)))) errors.push('seasons: there is no season quest today');
  // townspeople: accept a task, do it, collect the reward
  step = 'townspeople quests';
  await page.evaluate(() => TG._village.npc('farmer')); await sleep(300);
  await check('townsperson dialogue', '.npc-talk .npc-head');
  await page.evaluate(() => [...document.querySelectorAll('.npc-talk .btn.primary')].pop().click()); await sleep(200);
  await page.evaluate(() => TG.villageQuest('plant', 4)); await sleep(200);
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  await page.evaluate(() => TG._village.npc('farmer')); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('.npc-talk .btn.primary')].pop().click()); await sleep(250);
  if ((await page.evaluate(() => TG.store.active().village.npc.farmer.step)) !== 1) errors.push('townspeople: finishing the first task did not advance the quest chain');
  await page.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click())); await sleep(250);
  step = 'wrestling techniques';
  await page.evaluate(() => TG._village.tournament(8)); await sleep(400);
  const nMoves = await page.evaluate(() => document.querySelectorAll('.v-wr-moves .btn').length);
  if (nMoves !== 7) errors.push(`wrestling: expected 7 techniques, found ${nMoves}`);
  if (!(await page.evaluate(() => /3/.test(document.querySelector('.v-wrestle .eyebrow').textContent)))) errors.push('wrestling: late rounds should need 3 falls');
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
  // family tree: fill one branch -> one star
  step = 'family tree';
  await page.evaluate(() => TG.go('tree')); await sleep(300);
  await check('family tree', '.tree .tree-node');
  await page.evaluate(() => document.querySelectorAll('.tree-node')[10].click()); await sleep(250);
  await page.evaluate(() => { document.querySelector('.form .input').value = 'Дорж'; [...document.querySelectorAll('.form .btn.primary')].pop().click(); }); await sleep(400);
  if ((await page.evaluate(() => TG.familyTree.filled(TG.store.active()))) !== 1) errors.push('family tree: saving a branch did not count');
  await check('a lit star on the tree', '.tree-node.on');

  for (const screen of ['memories', 'about']) {
    await page.evaluate((s) => TG.go(s), screen); await sleep(250);
    await check(`screen ${screen}`, screen === 'about' ? '.about' : '.shell');
  }

  // layout: the app must never scroll sideways. A 320px phone or a long profile
  // name used to widen the top bar, and the music credit link was a 19px sliver.
  step = 'layout: no sideways scrolling';
  const sideways = async (where) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) errors.push(`${where}: the page is ${over}px wider than the screen`);
  };
  await page.setViewport({ width: 320, height: 568 });
  await page.evaluate(() => TG.go('village')); await sleep(250);
  await sideways('layout on a 320px phone (Нутаг)');
  await page.evaluate(() => { TG.store.active().name = 'Анандбаярын Эрдэнэчулуун'; TG.go('village'); });
  await sleep(250);
  await sideways('layout with a long profile name (Нутаг)');
  for (const s of ['learn', 'achievements', 'passport', 'about']) {
    await page.evaluate((s) => TG.go(s), s); await sleep(250);
    await sideways(`layout on "${s}" at 320px`);
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => { TG.store.active().name = 'Тест'; });
  const creditLink = await page.evaluate(() => {
    const a = document.querySelector('.about .credits a');
    return a ? Math.round(a.getBoundingClientRect().height) : null;
  });
  if (creditLink === null) errors.push('layout: the about screen has no music credit source link');
  else if (creditLink < 24) errors.push(`layout: the music credit link is only ${creditLink}px tall, expected at least 24px (WCAG 2.5.8)`);

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
