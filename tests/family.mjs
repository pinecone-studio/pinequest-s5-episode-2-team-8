// Family login over HTTP: make a family code, add children with their 3 secret pictures, log in on "another device" with
// the code and the pictures, and play as the same child there. Run with DATABASE_URL='' to use JSON files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); } throw new Error(`timed out waiting for: ${label}`); };
let browser = null;
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-family-'));
const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
const base = `http://localhost:${port}`;
const results = [];
const ok = (label) => results.push('✓ ' + label);

const api = async (body) => (await fetch(`${base}/api/family`, { method: 'POST', body: JSON.stringify(body) })).json();
const ticket = () => crypto.randomBytes(32).toString('hex');
/** Joins a room over the WebSocket and resolves with the server's first answer: welcome or error. */
function joinRoom(id, t) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timer = setTimeout(() => rej(new Error('no answer to join')), 5000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: 'FAMTEST', id, ticket: t, name: 'Test', look: {}, lvl: 1, x: 10, y: 10, dir: 0 }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome' || m.t === 'error') { clearTimeout(timer); ws.close(); res(m); } };
    ws.onerror = () => rej(new Error('socket error'));
  });
}

try {
  const a = { id: 'fam-a-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  const b = { id: 'fam-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };

  assert.equal((await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 9] })).reason, 'invalid');
  assert.equal((await api({ act: 'create', ...a, name: '', age: 8, avatar: 3, pics: [0, 1, 2] })).reason, 'invalid');
  ok('pictures out of range and empty names are refused');

  const made = await api({ act: 'create', ...a, name: 'Сараа', age: 8, avatar: 3, pics: [0, 1, 2] });
  assert.equal(made.ok, true);
  assert.match(made.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const code = made.code, typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
  ok(`a family code is made (${code})`);

  assert.equal((await api({ act: 'join', code, id: a.id, ticket: ticket(), name: 'Other', age: 8, avatar: 0, pics: [1, 1, 1] })).reason, 'identity');
  ok("a device without the child's ticket cannot change that child");

  assert.equal((await api({ act: 'join', code: typed, ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3] })).ok, true);
  assert.equal((await api({ act: 'join', code: 'ZZZZZZZZ', ...b, name: 'Бат', age: 6, avatar: 0, pics: [5, 4, 3] })).reason, 'no-family');
  ok('a second child joins with the code typed in lower case with a dash; an unknown code is refused');

  const listed = await api({ act: 'members', code });
  assert.deepEqual(listed.members.map((m) => [m.id, m.name, m.age, m.avatar, m.locked]), [[a.id, 'Сараа', 8, 3, false], [b.id, 'Бат', 6, 0, false]]);
  assert.ok(!JSON.stringify(listed).includes('hash') && !JSON.stringify(listed).includes('salt'), 'the list never shows the picture hashes');
  ok('the family lists its children without their pictures');

  // the other device: the right pictures give a new ticket for the same player
  const bLogin = await api({ act: 'login', code: typed, id: b.id, pics: [5, 4, 3] });
  assert.equal(bLogin.ok, true);
  assert.equal(bLogin.id, b.id);
  assert.match(bLogin.ticket, /^[a-f0-9]{64}$/);
  assert.notEqual(bLogin.ticket, b.ticket);
  assert.deepEqual([bLogin.name, bLogin.age, bLogin.avatar, bLogin.code], ['Бат', 6, 0, code]);
  assert.equal((await joinRoom(b.id, bLogin.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, b.ticket)).t, 'welcome');
  assert.equal((await joinRoom(b.id, ticket())).why, 'identity');
  ok('logging in on another device plays as the same child; the first device still works, a random ticket does not');

  for (let left = 4; left >= 1; left--) {
    const wrong = await api({ act: 'login', code, id: a.id, pics: [2, 1, 0] });
    assert.deepEqual([wrong.ok, wrong.reason, wrong.left], [false, 'wrong', left]);
  }
  const locked = await api({ act: 'login', code, id: a.id, pics: [2, 1, 0] });
  assert.deepEqual([locked.reason, locked.wait], ['locked', 900]);
  const stillLocked = await api({ act: 'login', code, id: a.id, pics: [0, 1, 2] });
  assert.equal(stillLocked.reason, 'locked');
  assert.ok(stillLocked.wait > 0 && stillLocked.wait <= 900);
  assert.equal((await api({ act: 'members', code })).members.find((m) => m.id === a.id).locked, true);
  ok('5 wrong tries lock the child for 15 minutes, even with the right pictures after');

  // the child's own device can set new pictures, which also unlocks
  assert.equal((await api({ act: 'join', code, ...a, name: 'Сараа', age: 9, avatar: 3, pics: [8, 8, 8] })).ok, true);
  assert.equal((await api({ act: 'login', code, id: a.id, pics: [0, 1, 2] })).reason, 'wrong');
  const aLogin = await api({ act: 'login', code, id: a.id, pics: [8, 8, 8] });
  assert.deepEqual([aLogin.ok, aLogin.age], [true, 9]);
  ok("new pictures from the child's own device replace the old ones and lift the lock");

  assert.equal((await fetch(`${base}/api/family`)).status, 405);
  assert.equal((await api({ act: 'nope' })).reason, 'invalid');
  ok('other methods and actions are refused');

  // ---- in the browser: one device makes the code, another logs in with it and gets the same child
  browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const device = async (name) => {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport({ width: 390, height: 844 });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    return page;
  };
  const clickText = (page, selector, text) => page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((x) => x.textContent.includes(text));
    if (!el) throw new Error(`no ${selector} with "${text}"`);
    el.click();
  }, selector, text);
  const tapPictures = async (page, indexes) => {
    for (const i of indexes) { await page.evaluate((i) => document.querySelectorAll('.pic-key')[i].click(), i); await sleep(60); }
  };

  const home = await device('home');
  await home.evaluate(() => {
    localStorage.clear();
    const p = TG.store.addProfile({ name: 'Номин', age: 7, avatar: '🦅', code: '🐎🥛🌙' });
    TG.store.state.loggedIn = true; TG.store.state.settings.sound = false; TG.store.state.lang = 'en';
    p.village = { tips: true, tutorial: true, coins: 600, xp: 200, room: 'FAMWEB' };
    TG.go('village');
  });
  await until(() => home.evaluate(() => { const v = TG.store.active().village; return v.srv && v.srv.coins === 600 && !v.syncOp; }), 'the first device uploads its coins');
  await home.evaluate(() => TG.go('family'));
  await home.waitForSelector('.gate-q');
  const answer = await home.evaluate(() => document.querySelector('.gate-q').textContent.match(/\d+/g).reduce((a, b) => a * b));
  await home.type('.gate-input', String(answer));
  await home.evaluate(() => document.querySelector('.gate .btn.primary').click());
  await home.waitForSelector('[data-family="none"]');
  await clickText(home, '[data-family] button', 'family code');
  await home.waitForSelector('[data-family]:not([data-family="none"])');
  const webCode = await home.evaluate(() => TG.store.state.familyCode);
  const shownCode = await home.evaluate(() => document.querySelector('.fam-code').textContent);
  assert.equal(shownCode, `${webCode.slice(0, 4)}-${webCode.slice(4)}`);
  const homeId = await home.evaluate(() => TG.store.active().village.id);
  assert.equal((await api({ act: 'members', code: webCode })).members[0].id, homeId);
  ok(`the parent dashboard makes a family code with the child in it (${shownCode})`);

  const other = await device('other');
  await other.evaluate(() => { TG.store.state.lang = 'en'; TG.go('auth'); });
  await until(() => other.evaluate(() => [...document.querySelectorAll('.auth-about')].some((x) => x.textContent.includes('family code'))), 'the login page in English');
  await clickText(other, '.auth-about', 'family code');
  await other.waitForSelector('.fam-code-input');
  await other.type('.fam-code-input', shownCode.toLowerCase());
  await clickText(other, '.auth-card button', '→');
  await other.waitForSelector('.auth-prof');
  await clickText(other, '.auth-prof', 'Номин');
  await other.waitForSelector('.pic-key');
  await tapPictures(other, [0, 0, 0]);
  await until(() => other.evaluate(() => /4/.test(document.querySelector('.auth-card .err').textContent)), 'a wrong try says how many are left');
  await tapPictures(other, [1, 2, 4]);
  await until(() => other.evaluate(() => TG.store.state.loggedIn && TG.store.active() && TG.store.active().village && TG.store.active().village.id), 'the other device logs in');
  const joined = await other.evaluate(() => { const p = TG.store.active(); return { id: p.village.id, name: p.name, age: p.age, avatar: p.avatar, code: p.code, fam: p.fam }; });
  assert.deepEqual(joined, { id: homeId, name: 'Номин', age: 7, avatar: '🦅', code: '🐎🥛🌙', fam: webCode });
  await other.evaluate(() => { const v = TG.store.active().village; v.tips = true; v.tutorial = true; v.room = 'FAMWEB'; TG.store.state.settings.sound = false; TG.go('village'); });
  await until(() => other.evaluate(() => { const v = TG.store.active().village; return v.coins === 600 && v.xp === 200 && v.srv.coins === 600; }), 'the other device gets the same coins and XP');
  ok('another device logs in with the code and the pictures, and has the same coins and XP');
  assert.deepEqual(errors, []);

  console.log(results.join('\n'));
  console.log('\nFAMILY LOGIN: PASS');
} catch (error) {
  console.log(results.join('\n'));
  console.error('\nFAMILY LOGIN: FAIL', error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((res) => { server.once('exit', res); server.kill(); });
  rmSync(dataDir, { recursive: true, force: true });
}
