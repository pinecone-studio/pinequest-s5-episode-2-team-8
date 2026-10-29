// Weekly parent email: a grown-up adds an email behind the family PIN, confirms it from a link (double opt-in), then gets a
// report of each child's week, with a stop link in every one. Resend is never called: the mails go to a stub `send`.
// Run with DATABASE_URL='' to use JSON files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createRoomStore } = require('../server/room-store.js');
const createFamily = require('../server/family.js');
const createParentEmail = require('../server/parent-email.js');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-email-'));
const serverDir = mkdtempSync(join(tmpdir(), 'naadamy-email-server-'));
const results = [];
const ok = (label) => results.push('✓ ' + label);
const DAY = 86_400_000, PIN = '1234', RECOVERY = 'ABCDEFGH23';

let t = Date.now(), n = 0, fail = []; // `fail`: what the stub answers the next tries (an HTTP status, or undefined: no answer)
const mails = [], attempts = [];
const send = async (mail) => {
  attempts.push(mail);
  if (fail.length) { const status = fail.shift(); throw Object.assign(new Error('stub: Resend refused'), { status }); }
  mails.push(mail);
};
const store = createRoomStore({ dataDir, databaseUrl: '' });
const env = { PUBLIC_URL: 'https://naadamy.test/' };
const email = createParentEmail(store, { env, now: () => t, send });
const fam = createFamily(store, { now: () => t, email });
// a second server on the same data: it must never send a report the first one sent
const email2 = createParentEmail(createRoomStore({ dataDir, databaseUrl: '' }), { env, now: () => t, send });

const call = (body) => new Promise((res) => {
  const req = new EventEmitter(); Object.assign(req, { method: 'POST', headers: {}, socket: { remoteAddress: `10.8.${++n >> 8}.${n & 255}` }, destroy() {} });
  fam.handle(req, { writeHead() {}, end: (text) => res(JSON.parse(text)) });
  req.emit('data', JSON.stringify(body)); req.emit('end');
});
/** Opens a link from a mail (GET), or posts it (`act`: the page's button, or a one-click List-Unsubscribe-Post): { status, html, csp }. */
const open = (link, method = 'GET') => new Promise((res) => {
  let status = 0, csp = '';
  email.handle({ method }, { writeHead: (s, h) => { status = s; csp = h['content-security-policy']; }, end: (html) => res({ status, html, csp }) }, new URL(link));
});
const act = (link) => open(link, 'POST');
const linkIn = (mail, kind) => new RegExp(`https://naadamy\\.test/api/email/${kind}\\?t=[a-f0-9]{64}`).exec(mail.text)?.[0];
const ticket = () => crypto.randomBytes(32).toString('hex');
const emails = () => { try { return JSON.parse(readFileSync(join(dataDir, 'family-emails.json'), 'utf8')); } catch { return {}; } };
async function family(name) {
  const a = { id: 'pe-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
  const { code } = await call({ act: 'create', ...a, name, pics: [1, 2, 3], pin: PIN, recovery: RECOVERY });
  return { code, a, as: (extra) => ({ code, by: a.id, ticket: a.ticket, ...extra }) };
}
const secrets = (mail, code) => { for (const s of [code, PIN, RECOVERY]) assert.ok(!mail.text.includes(s) && !mail.html.includes(s), `a mail never has ${s}`); };

try {
  const f = await family('Сараа');
  const b = { id: 'pe-b-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  assert.equal((await call({ act: 'join', code: f.code, ...b, name: 'Бат', pics: [4, 4, 4], pin: PIN })).ok, true);

  // ---- the PIN guards it
  assert.equal((await call({ act: 'set-email', ...f.as({ email: 'kid@example.com' }) })).reason, 'pin');
  assert.deepEqual(await call({ act: 'set-email', ...f.as({ email: 'kid@example.com', pin: '0000' }) }), { ok: false, reason: 'pin', left: 4 });
  assert.equal((await call({ act: 'set-email', ...f.as({ email: 'kid@example.com', pin: PIN, ticket: ticket() }) })).reason, 'identity');
  assert.equal((await call({ act: 'remove-email', ...f.as({ pin: '0000' }) })).reason, 'pin');
  assert.equal(mails.length, 0);
  ok('set-email and remove-email need a member ticket and the PIN; wrong PINs count on the same lock');
  for (const bad of ['', 'kid', 'kid@', 'a b@example.com', 'kid@example', '<x>@example.com', 'k'.repeat(65) + '@example.com', 42]) {
    assert.equal((await call({ act: 'set-email', ...f.as({ email: bad, pin: PIN }) })).reason, 'invalid', String(bad));
  }
  ok('a malformed address is refused before the PIN is tried');

  // ---- double opt-in
  const set = await call({ act: 'set-email', ...f.as({ email: '  Kid@Example.COM ', pin: PIN }) });
  assert.deepEqual(set, { ok: true, email: { to: 'k***@example.com', confirmed: false } });
  assert.equal(mails.length, 1);
  const confirmMail = mails[0], confirmLink = linkIn(confirmMail, 'confirm');
  assert.equal(confirmMail.to, 'kid@example.com');
  assert.ok(confirmLink && confirmMail.html.includes(confirmLink), 'the confirm link is in both the text and the html');
  assert.match(confirmMail.text, /48 цагийн/); assert.match(confirmMail.text, /48 hours/);
  secrets(confirmMail, f.code);
  const stored = emails()[f.code];
  assert.equal(stored.data.confirmed, false);
  assert.ok(!JSON.stringify(stored).includes(confirmLink.split('t=')[1]), 'the link token is stored only hashed');
  assert.deepEqual((await call({ act: 'members', code: f.code })).email, { confirmed: false }, 'members (the code only) never shows the address');
  assert.deepEqual((await call({ act: 'login', code: f.code, id: b.id, pics: [4, 4, 4] })).email, { to: 'k***@example.com', confirmed: false });
  ok('set-email stores the address unconfirmed and mails a confirm link; login shows it masked, members only whether it is confirmed');

  // progress before the confirm is not this week's
  await store.saveProgress(f.a.id, (await store.getProgress(f.a.id, {})).revision, { cloud: { learn: { idee: { done: true } }, ach: { old: t - DAY } } });
  t += 1000;
  t += 7 * DAY + 1;
  assert.equal(await email.sendDue(), 0, 'nothing goes to an address that is not confirmed');
  t -= 7 * DAY + 1;
  assert.equal((await act('https://naadamy.test/api/email/confirm?t=' + 'a'.repeat(64))).status, 404);
  assert.equal((await open('https://naadamy.test/api/email/confirm?t=nope')).status, 404);
  const before0 = JSON.stringify(emails());
  for (const method of ['GET', 'HEAD']) {
    const shownPage = await open(confirmLink, method);
    assert.equal(shownPage.status, 200);
    assert.ok(shownPage.html.includes(`<form method="post" action="/api/email/confirm?t=${confirmLink.split('t=')[1]}">`));
    assert.match(shownPage.csp, /form-action 'self'/); assert.match(shownPage.csp, /frame-ancestors 'none'/);
  }
  assert.equal(JSON.stringify(emails()), before0, 'opening the link (GET or HEAD, as a mail scanner does) changes nothing');
  const confirmed = await act(confirmLink);
  assert.equal(confirmed.status, 200); assert.match(confirmed.html, /Баярлалаа/); assert.match(confirmed.html, /Thank you/);
  assert.equal((await act(confirmLink)).status, 404, 'a confirm link works once');
  assert.deepEqual((await call({ act: 'members', code: f.code })).email, { confirmed: true });
  assert.deepEqual(await call({ act: 'set-email', ...f.as({ email: 'kid@example.com', pin: PIN }) }), { ok: true, email: { to: 'k***@example.com', confirmed: true } });
  assert.equal(mails.length, 1, 'the confirmed address set again sends nothing');
  ok('GET/HEAD on the confirm link only shows a button; its POST confirms once (a small page in both languages)');

  // ---- this week's play; a child who joins now starts from what they have
  const xp = (id, add) => store.mutateWallet(id, crypto.randomBytes(16).toString('hex'), (w) => ({ changed: true, wallet: { ...w, xp: w.xp + add }, result: { accepted: true } }));
  const c = { id: 'pe-c-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
  await store.getWallet(c.id);
  await xp(c.id, 500);
  assert.equal((await call({ act: 'join', code: f.code, ...c, name: 'Цэцэг', pics: [5, 5, 5], pin: PIN })).ok, true);
  t += DAY;
  const p = await store.getProgress(f.a.id, {});
  await store.saveProgress(f.a.id, p.revision, { cloud: { learn: { idee: { done: true }, ger: { done: true }, nuuts: { best: 3 } }, ach: { old: t - 3 * DAY, first_ger: t, later: t + 30 * DAY }, stamps: { aimag1: t, aimag2: t } } });
  await xp(f.a.id, 120);
  assert.equal(await email.sendDue(), 0, 'not before the week is over');
  t += 6 * DAY;
  const [one, two] = await Promise.all([email.sendDue(), email2.sendDue()]);
  assert.equal(one + two, 1, 'two servers checking at once send one report');
  assert.equal(mails.length, 2);
  assert.equal(await email.sendDue() + await email2.sendDue(), 0, 'and nothing again until next week');
  ok('a report is claimed in the store before it is sent: two servers never send it twice');

  const report = mails[1];
  assert.equal(report.to, 'kid@example.com');
  assert.match(report.text, /Сараа: \+120 XP, 1 хичээл дуусгасан \(Монгол гэр\), 1 тэмдэг, 2 тамга/);
  assert.match(report.text, /Сараа: \+120 XP, 1 lesson finished \(The Mongol ger\), 1 badge, 2 stamps/);
  assert.match(report.text, /Бат: \+0 XP, 0 lessons finished, 0 badges, 0 stamps/);
  assert.match(report.text, /Цэцэг: \+0 XP/);
  assert.match(report.html, /<li>Сараа: \+120 XP/);
  secrets(report, f.code);
  const stopLink = linkIn(report, 'stop');
  assert.ok(stopLink && report.html.includes(stopLink));
  assert.deepEqual(report.headers, { 'List-Unsubscribe': `<${stopLink}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
  assert.match(report.key, /^[a-f0-9]{64}$/, 'an Idempotency-Key for Resend');
  ok("the report: each child's XP, lessons, badges and stamps of the week only (not dated later; a new child from now), MN + EN, a stop link");

  // a week where nobody played sends nothing
  t += 7 * DAY;
  assert.equal(await email.sendDue(), 0);
  assert.equal(mails.length, 2);
  ok('a week where no child did anything sends no mail');

  // the next week counts from the last check; a passing refusal is tried again in 6 hours, as the same mail
  await xp(b.id, 30);
  t += 7 * DAY;
  fail = [503];
  assert.equal(await email.sendDue(), 0);
  t += 6 * 60 * 60 * 1000;
  assert.equal(await email.sendDue(), 1);
  assert.equal(mails.length, 3);
  assert.match(mails[2].text, /Бат: \+30 XP/); assert.match(mails[2].text, /Сараа: \+0 XP, 0 хичээл дуусгасан, 0 тэмдэг, 0 тамга/);
  const [tried, retried] = attempts.slice(-2);
  assert.equal(retried.key, tried.key); assert.equal(linkIn(retried, 'stop'), linkIn(tried, 'stop')); assert.equal(retried.text, tried.text);
  ok('a refused report (5xx) is sent again 6 hours later as the same mail: same stop link and Idempotency-Key');

  // three refusals in a row, or a 4xx, wait for next week
  await xp(b.id, 1);
  t += 7 * DAY;
  fail = [500, undefined, 429];
  for (let i = 0; i < 3; i++) { assert.equal(await email.sendDue(), 0); t += 6 * 60 * 60 * 1000; }
  assert.equal(await email.sendDue(), 0, 'after 3 refusals it stops trying');
  t += 7 * DAY;
  assert.equal(await email.sendDue(), 1, 'and sends the next week');
  await xp(b.id, 1);
  t += 7 * DAY;
  fail = [422];
  assert.equal(await email.sendDue(), 0);
  t += 6 * 60 * 60 * 1000;
  assert.equal(await email.sendDue(), 0, 'a 4xx is not tried again');
  t += 7 * DAY;
  assert.equal(await email.sendDue(), 1);
  ok('3 refusals in a row, or a 4xx other than 429, go back to the weekly schedule');

  // ---- stop
  const lastStop = linkIn(mails.at(-1), 'stop');
  const before1 = JSON.stringify(emails());
  const stopPage = await open(stopLink);
  assert.equal(stopPage.status, 200); assert.match(stopPage.html, /<form method="post"/);
  await open(stopLink, 'HEAD');
  assert.equal(JSON.stringify(emails()), before1, 'GET/HEAD on the stop link changes nothing');
  const stopped = await act(stopLink);
  assert.equal(stopped.status, 200); assert.match(stopped.html, /no more reports/);
  assert.equal((await call({ act: 'members', code: f.code })).email, null);
  assert.equal(emails()[f.code], undefined);
  assert.equal((await act(stopLink)).status, 404);
  assert.equal((await act(lastStop)).status, 404, 'every link of the address is gone with it');
  t += 8 * DAY;
  assert.equal(await email.sendDue(), 0);
  ok('the stop link, posted (the button or the one-click POST), forgets the address and its links: no more reports');

  // ---- remove-email
  await call({ act: 'set-email', ...f.as({ email: 'mom@example.org', pin: PIN }) });
  assert.equal((await act(linkIn(mails.at(-1), 'confirm'))).status, 200);
  assert.deepEqual(await call({ act: 'remove-email', ...f.as({ pin: PIN }) }), { ok: true });
  assert.equal((await call({ act: 'members', code: f.code })).email, null);
  t += 8 * DAY;
  assert.equal(await email.sendDue(), 0);
  ok('remove-email with the PIN forgets the address');

  // ---- rate limits (in the store: every server and a restart see them) and old links
  const g = await family('Номин');
  for (const to of ['a@example.com', 'b@example.com', 'c@example.com']) assert.equal((await call({ act: 'set-email', ...g.as({ email: to, pin: PIN }) })).ok, true);
  const before = mails.length, busy = await call({ act: 'set-email', ...g.as({ email: 'd@example.com', pin: PIN }) });
  assert.equal(busy.reason, 'email-busy'); assert.ok(busy.wait > 0 && busy.wait <= 86400);
  assert.equal(mails.length, before);
  assert.equal((await act(linkIn(mails.at(-2), 'confirm'))).status, 404, 'a new address makes the old confirm link stop working');
  const restarted = createParentEmail(createRoomStore({ dataDir, databaseUrl: '' }), { env, now: () => t, send });
  const h = await family('Тэмүүлэн');
  assert.equal((await restarted.set(h.code, 'c@example.com', '10.1.1.1')).ok, true);
  assert.equal((await restarted.set(h.code, 'c@example.com', '10.1.1.2')).ok, true);
  assert.equal((await restarted.set(h.code, 'c@example.com', '10.1.1.3')).reason, 'email-busy', 'the address had 3 today (one from another family), after a restart too');
  const j = await family('Ж'), k = await family('К');
  for (let i = 0; i < 5; i++) assert.equal((await email.set(i < 3 ? j.code : k.code, `ip${i}@example.com`, '10.2.2.2')).ok, true);
  assert.equal((await email.set(k.code, 'ip5@example.com', '10.2.2.2')).reason, 'email-busy');
  assert.equal((await email.set(k.code, 'ip5@example.com', '10.2.2.3')).ok, true);
  ok('at most 3 confirm mails a day per family and per address, and 5 per sender address');
  const quotaDir = mkdtempSync(join(tmpdir(), 'naadamy-email-quota-')), quota = createRoomStore({ dataDir: quotaDir, databaseUrl: '' });
  for (let i = 0; i < 200; i++) assert.equal((await quota.takeEmailSend([{ key: 'ip:' + i, max: 5 }, { key: 'all', max: 200 }], t + i, DAY)).ok, true);
  assert.deepEqual(await quota.takeEmailSend([{ key: 'ip:x', max: 5 }, { key: 'all', max: 200 }], t + 500, DAY), { ok: false, wait: DAY - 500 });
  assert.equal((await quota.takeEmailSend([{ key: 'all', max: 200 }], t + DAY + 1, DAY)).ok, true, 'a day later the oldest count is forgotten');
  assert.ok(Object.keys(JSON.parse(readFileSync(join(quotaDir, 'email-sends.json'), 'utf8'))).length <= 200, 'old counts are pruned');
  assert.equal(JSON.parse(readFileSync(join(quotaDir, 'email-sends.json'), 'utf8'))['ip:0'], undefined, 'old counts are pruned');
  rmSync(quotaDir, { recursive: true, force: true });
  ok('200 confirm mails a day in all; counts older than a day are pruned');
  t += 2 * DAY + 1000;
  assert.equal((await act(linkIn(mails.at(-1), 'confirm'))).status, 404, 'a confirm link expires after 48 hours');
  assert.equal((await call({ act: 'set-email', ...g.as({ email: 'd@example.com', pin: PIN }) })).ok, true, 'a day later it can send again');
  ok('a confirm link expires after 48 hours; the limit resets after a day');

  // ---- erase and the last child out take the email with them
  const e = await family('Erase');
  await call({ act: 'set-email', ...e.as({ email: 'erase@example.com', pin: PIN }) });
  assert.equal((await act(linkIn(mails.at(-1), 'confirm'))).status, 200);
  assert.ok(emails()[e.code]);
  assert.equal((await call({ act: 'erase', ...e.as({ pin: PIN, confirm: e.code }) })).ok, true);
  assert.equal(emails()[e.code], undefined);
  t += 8 * DAY;
  const sentBefore = mails.length;
  await email.sendDue();
  assert.ok(!mails.slice(sentBefore).some((m) => m.to === 'erase@example.com'));
  const lone = await family('Lone');
  await call({ act: 'set-email', ...lone.as({ email: 'lone@example.com', pin: PIN }) });
  assert.equal((await call({ act: 'remove', ...lone.as({ id: lone.a.id, pin: PIN }) })).left, 0);
  assert.equal(emails()[lone.code], undefined);
  ok('erasing the family (or taking out its last child) deletes its email and links');

  // ---- the PostgreSQL store: tables made at load, links go with the family (CASCADE), one-statement claims
  const sqls = [];
  const answer = (sql) => {
    if (/FROM naadamy_families WHERE code/.test(sql)) return { rows: [{ '?column?': 1 }] };
    if (/SELECT data, due_at FROM naadamy_family_emails/.test(sql)) return { rows: [{ data: { email: 'x@example.com' }, due_at: '5' }] };
    if (/^UPDATE naadamy_family_emails/.test(sql)) return { rows: [{ code: 'ABCDEFGH', data: { email: 'x@example.com' }, due_at: '77' }] };
    return { rows: [] };
  };
  const fakePool = { on() {}, async end() {}, async query(sql, params) { sql = sql.replace(/\s+/g, ' ').trim(); sqls.push([sql, params]); return answer(sql); },
    async connect() { return { query: (sql, params) => fakePool.query(sql, params), release() {} }; } };
  const pg = createRoomStore({ dataDir, databaseUrl: 'postgres://test', Pool: class { constructor() { return fakePool; } } });
  await pg.load();
  const made = sqls.map(([sql]) => sql).join('\n');
  assert.match(made, /CREATE TABLE IF NOT EXISTS naadamy_family_emails \( code text PRIMARY KEY REFERENCES naadamy_families \(code\) ON DELETE CASCADE/);
  assert.match(made, /CREATE TABLE IF NOT EXISTS naadamy_email_tokens \( hash text PRIMARY KEY, code text NOT NULL REFERENCES naadamy_family_emails \(code\) ON DELETE CASCADE/);
  assert.match(made, /ALTER TABLE naadamy_family_emails ENABLE ROW LEVEL SECURITY/); assert.match(made, /ALTER TABLE naadamy_email_tokens ENABLE ROW LEVEL SECURITY/);
  assert.match(made, /CREATE TABLE IF NOT EXISTS naadamy_email_sends/); assert.match(made, /ALTER TABLE naadamy_email_sends ENABLE ROW LEVEL SECURITY/);
  sqls.length = 0;
  assert.deepEqual(await pg.takeEmailSend([{ key: 'all', max: 200 }], 1000, 100), { ok: true });
  assert.deepEqual(sqls.map(([sql]) => sql.split(' ').slice(0, 2).join(' ')), ['BEGIN', 'SELECT pg_advisory_xact_lock(hashtext(\'naadamy_email_sends\'))', 'DELETE FROM', 'SELECT key,', 'INSERT INTO', 'COMMIT']);
  assert.deepEqual(sqls[2][1], [900], 'counts older than the window are deleted');
  sqls.length = 0;
  assert.deepEqual(await pg.claimFamilyReport(100, 200), { code: 'ABCDEFGH', record: { email: 'x@example.com', dueAt: 77 } });
  assert.equal(sqls.length, 1); assert.match(sqls[0][0], /FOR UPDATE SKIP LOCKED/); assert.deepEqual(sqls[0][1], [100, 200]);
  sqls.length = 0;
  const seen = [];
  assert.equal(await pg.mutateFamilyEmail('ABCDEFGH', (r, has) => { seen.push(r, has); return { record: { email: 'y@example.com', dueAt: 9 }, clearTokens: true, token: { hash: 'h', kind: 'confirm', until: 1 }, result: 'done' }; }), 'done');
  assert.deepEqual(seen, [{ email: 'x@example.com', dueAt: 5 }, true]);
  assert.deepEqual(sqls.map(([sql]) => sql.split(' ').slice(0, 3).join(' ')),
    ['BEGIN', 'SELECT 1 FROM', 'SELECT data, due_at', 'INSERT INTO naadamy_family_emails', 'DELETE FROM naadamy_email_tokens', 'DELETE FROM naadamy_email_tokens', 'INSERT INTO naadamy_email_tokens', 'COMMIT']);
  assert.deepEqual(sqls[3][1], ['ABCDEFGH', JSON.stringify({ email: 'y@example.com' }), 9]);
  sqls.length = 0;
  await pg.mutateFamilyEmail('ABCDEFGH', () => ({ record: null, result: null }));
  assert.ok(sqls.some(([sql]) => sql === 'DELETE FROM naadamy_family_emails WHERE code = $1') && !sqls.some(([sql]) => /INSERT/.test(sql)));
  ok('PostgreSQL: the tables are made at load (CASCADE from the family, RLS on), a claim is one UPDATE … SKIP LOCKED');

  // ---- off without a key
  const off = createParentEmail(store, { env: {} });
  const offFam = createFamily(store, { email: off });
  const offCall = (body) => new Promise((res) => {
    const req = new EventEmitter(); Object.assign(req, { method: 'POST', headers: {}, socket: { remoteAddress: '10.7.0.1' }, destroy() {} });
    offFam.handle(req, { writeHead() {}, end: (text) => res(JSON.parse(text)) });
    req.emit('data', JSON.stringify(body)); req.emit('end');
  });
  assert.equal(off.enabled, false);
  const warn = console.warn; let warned = '';
  console.warn = (text) => { warned = text; };
  try { assert.equal(createParentEmail(store, { env: { RESEND_API_KEY: 're_test' } }).enabled, false, 'a key without EMAIL_FROM is off'); } finally { console.warn = warn; }
  assert.match(warned, /EMAIL_FROM/);
  assert.equal(createParentEmail(store, { env: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Naadamy <hi@example.com>' } }).enabled, true);
  assert.deepEqual(await offCall({ act: 'set-email', ...g.as({ email: 'x@example.com', pin: PIN }) }), { ok: false, reason: 'email-off' });
  assert.equal(await off.sendDue(), 0);
  ok("without RESEND_API_KEY set-email answers 'email-off' and nothing is sent");

  // ---- the real server: routes are wired, and with no key the feature is off
  const server = spawn(process.execPath, [(process.env.NAADAMY_SERVER || join(root, 'server', 'server.js'))], { env: { ...process.env, PORT: '0', DATA_DIR: serverDir, RENDER: 'true', RESEND_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  try {
    const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
    const base = `http://localhost:${port}`;
    const s = { id: 'pe-s-' + crypto.randomBytes(3).toString('hex'), ticket: ticket() };
    const api = async (body) => (await fetch(`${base}/api/family`, { method: 'POST', body: JSON.stringify(body) })).json();
    const { code } = await api({ act: 'create', ...s, name: 'Srv', pics: [1, 2, 3], pin: PIN, recovery: RECOVERY });
    assert.deepEqual(await api({ act: 'set-email', code, by: s.id, ticket: s.ticket, pin: PIN, email: 'x@example.com' }), { ok: false, reason: 'email-off' });
    assert.equal((await api({ act: 'members', code })).email, null);
    for (const kind of ['confirm', 'stop']) {
      const page = await fetch(`${base}/api/email/${kind}?t=${'b'.repeat(64)}`);
      assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /text\/html/); assert.match(await page.text(), /<form method="post"/);
      assert.match(page.headers.get('content-security-policy'), /form-action 'self'; frame-ancestors 'none'/);
      const posted = await fetch(`${base}/api/email/${kind}?t=${'b'.repeat(64)}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      assert.equal(posted.status, 404); assert.match(await posted.text(), /Naadamy/);
    }
    assert.equal((await fetch(`${base}/api/email/confirm?t=x`, { method: 'PUT' })).status, 405);
    ok('server.js serves /api/email/confirm and /api/email/stop; with no key set-email is off');
  } finally { server.kill(); }

  console.log(results.join('\n'));
  console.log('Parent email: all checks passed.');
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(serverDir, { recursive: true, force: true });
}
