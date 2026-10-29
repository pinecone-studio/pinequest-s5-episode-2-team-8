// Memory book voice clips over HTTP (/api/voice): a child of the family on its device uploads a WAV, every child of the
// family lists and plays it, the uploader (or the PIN) deletes it, and erasing the family deletes its clips. First on disk
// (the server with DATA_DIR, as with the JSON store), then with the Supabase Storage backend against a stubbed fetch (never
// the real Supabase). Run with DATABASE_URL='' to use JSON files.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-voice-'));
const unitDir = mkdtempSync(join(tmpdir(), 'naadamy-voice-unit-'));
const env = { ...process.env, PORT: '0', DATA_DIR: dataDir, RENDER: 'true', VOICE_ON_DISK: 'true', VOICE_MAX_CLIPS: '3', VOICE_MAX_MB: '1' };
for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_VOICE_BUCKET']) env[key] = '';
const server = spawn(process.execPath, [join(root, 'server', 'server.js')], { env, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
const results = [];
const ok = (label) => results.push('✓ ' + label);
const ticket = () => crypto.randomBytes(32).toString('hex');
const PIN = '1234', RECOVERY = 'ABCDEFGH23';
let address = 0;
const from = () => `10.7.${++address >> 8}.${address & 255}`; // each step its own address, so the limits don't mix in

/** A PCM WAV like Unity's Wav.Save: 16-bit, `channels`, `rate`, `samples` frames of a quiet tone; `format` 3 is float. */
function wav(samples = 2205, { rate = 22050, channels = 1, format = 1 } = {}) {
  const bytes = samples * channels * 2, b = Buffer.alloc(44 + bytes);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + bytes, 4); b.write('WAVEfmt ', 8, 'latin1');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(format, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'latin1'); b.writeUInt32LE(bytes, 40);
  for (let i = 0; i < samples * channels; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 3000), 44 + i * 2);
  return b;
}

function suite(base) {
  const family = async (body) => (await fetch(`${base}/api/family`, { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': from() } })).json();
  const auth = (who, extra = {}) => ({ 'x-family': who.code, 'x-player': who.id, 'x-ticket': who.ticket, 'x-forwarded-for': from(), ...extra });
  const voice = async (method, p, who, { body, headers = {} } = {}) => {
    const r = await fetch(`${base}/api/voice${p}`, { method, body, headers: { ...(who ? auth(who) : { 'x-forwarded-for': from() }), ...(body && { 'content-type': 'audio/wav' }), ...headers } });
    const type = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, ...(type.startsWith('application/json') ? { json: await r.json() } : { bytes: Buffer.from(await r.arrayBuffer()) }) };
  };
  /** A family with child `a` (who made it) and child `b` (joined with the PIN). */
  async function makeFamily() {
    const a = { id: 'va-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() }, b = { id: 'vb-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
    const made = await family({ act: 'create', ...a, name: 'Ana', pics: [1, 2, 3], pin: PIN, recovery: RECOVERY });
    assert.equal(made.ok, true, JSON.stringify(made));
    assert.equal((await family({ act: 'join', code: made.code, ...b, name: 'Bat', pics: [4, 5, 6], pin: PIN })).ok, true);
    return { code: made.code, a: { ...a, code: made.code }, b: { ...b, code: made.code } };
  }
  return { family, auth, voice, makeFamily };
}

/** A raw upload with node's http: `declared` content-length (or chunked when null), then `chunks` of `size` bytes, as long
 *  as the server reads. Resolves with the status (or 'reset' when the socket was cut) and how many bytes were written. */
function rawUpload(base, p, headers, { declared, chunks, size = 64 * 1024 }) {
  return new Promise((res) => {
    const url = new URL(`${base}/api/voice${p}`);
    let written = 0, settled = false;
    const done = (v) => { if (!settled) { settled = true; res({ ...v, written }); } };
    const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method: 'PUT', agent: false, // a socket of its own each time
      headers: { 'content-type': 'audio/wav', ...headers, ...(declared != null && { 'content-length': declared }) } }, (r) => {
      let text = ''; r.on('data', (d) => (text += d)); r.on('end', () => done({ status: r.statusCode, headers: r.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', () => done({ status: 'reset' }));
    const chunk = Buffer.alloc(size, 7);
    (function pump(n) {
      if (settled || n >= chunks) return declared == null ? req.end() : undefined;
      written += size;
      if (req.write(chunk)) setImmediate(() => pump(n + 1)); else req.once('drain', () => pump(n + 1));
    })(0);
  });
}

async function diskTests() {
  const base = `http://localhost:${port}`, { family, auth, voice, makeFamily } = suite(base);
  const { code, a, b } = await makeFamily();
  const clip = wav(), id = 'm1730000000001';

  // upload, list, play
  const up = await voice('PUT', `/${id}`, a, { body: clip });
  assert.deepEqual(up.json, { ok: true, id, size: clip.length });
  assert.ok(existsSync(join(dataDir, 'voice', code, `${id}.wav`)), 'stored under DATA_DIR/voice/<code>/<id>.wav');
  const listed = await voice('GET', '', b);
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal(listed.json.clips.length, 1);
  assert.deepEqual({ ...listed.json.clips[0], ts: 0 }, { id, size: clip.length, by: a.id, ts: 0 });
  assert.ok(Math.abs(listed.json.clips[0].ts - Date.now()) < 60_000, 'ts is the upload time in ms');
  assert.equal(listed.json.used, clip.length);
  const played = await voice('GET', `/${id}`, b);
  assert.equal(played.status, 200);
  assert.equal(played.headers.get('content-type'), 'audio/wav');
  assert.match(played.headers.get('cache-control'), /^private/);
  assert.equal(Number(played.headers.get('content-length')), clip.length);
  assert.ok(played.bytes.equals(clip), 'the clip comes back byte for byte');
  assert.equal((await voice('POST', '/m1730000000002', b, { body: wav(100) })).json.ok, true, 'POST uploads too');
  ok('a child uploads a WAV; another child of the family lists it (id, size, uploader, ts) and plays it back byte for byte');

  // auth
  assert.deepEqual((await voice('GET', '', null)).json, { ok: false, reason: 'invalid' });
  const noAuth = await voice('PUT', `/m1730000000009`, null, { body: clip });
  assert.equal(noAuth.status, 400);
  assert.deepEqual((await voice('GET', `/${id}`, { ...b, ticket: ticket() })).json, { ok: false, reason: 'identity' });
  const stranger = { id: 'vs-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
  const other = await family({ act: 'create', ...stranger, name: 'Stranger', pics: [7, 8, 0], pin: '9999', recovery: RECOVERY });
  assert.equal((await voice('GET', `/${id}`, { ...stranger, code })).status, 403, 'a child of another family can not play it');
  assert.deepEqual((await voice('GET', '', { ...stranger, code: other.code })).json.clips, [], 'nor see it in their own family');
  assert.equal((await voice('GET', `/${id}`, { ...stranger, code: other.code })).status, 404, 'nor fetch it through their own family');
  assert.equal((await voice('PUT', `/${id}`, { ...stranger, code }, { body: clip })).status, 403);
  assert.deepEqual((await voice('GET', '', { ...a, code: 'ZZZZ2345' })).json, { ok: false, reason: 'identity' }, 'an unknown family answers as a non-member does');
  ok('no headers, a wrong ticket, a child of another family or an unknown family code are refused');

  // validation
  const junk = crypto.randomBytes(5000);
  assert.deepEqual((await voice('PUT', '/m1730000000003', a, { body: junk })).json, { ok: false, reason: 'not-wav' });
  assert.equal((await voice('PUT', '/m1730000000003', a, { body: wav(2000, { format: 3 }) })).status, 415, 'float WAV is not PCM');
  const cut = wav(); cut.writeUInt32LE(10_000_000, 40);
  assert.equal((await voice('PUT', '/m1730000000003', a, { body: cut })).status, 415, 'a data chunk longer than the file');
  assert.equal((await voice('PUT', '/m1730000000003', a, { body: clip, headers: { 'content-type': 'text/html' } })).status, 415);
  assert.equal((await voice('GET', '', a)).json.clips.length, 2, 'nothing refused was recorded');
  ok('random bytes, a float WAV, a cut-off WAV and a wrong content-type are refused (415)');

  // too large: a declared length is refused before the body; an undeclared one is cut at 15 MB
  let t0 = Date.now();
  const declared = await rawUpload(base, '/m1730000000004', auth(a), { declared: 20 * 1024 * 1024, chunks: 1 });
  assert.equal(declared.status, 413); assert.equal(declared.body.reason, 'too-big');
  assert.ok(Date.now() - t0 < 3000, 'answered at once');
  t0 = Date.now();
  const chunked = await rawUpload(base, '/m1730000000004', auth(a), { declared: null, chunks: 400 }); // 25 MB if all were read
  assert.ok(chunked.status === 413 || chunked.status === 'reset', `cut off: ${chunked.status}`);
  assert.ok(chunked.written < 24 * 1024 * 1024, 'the server stopped reading before the end');
  assert.ok(!existsSync(join(dataDir, 'voice', code, 'm1730000000004.wav')));
  assert.equal((await voice('GET', '', a)).status, 200, 'the server is still fine');
  ok('a body over the cap (13.2 MB) is refused (413): a declared one before it is read, a chunked one as soon as it passes it');

  // path traversal: only "m" + digits, the family code only from its alphabet
  for (const bad of ['/..%2F..%2Ffamilies.json', '/m1730000000001.wav', '/M1730000000001', '/m17', '/m1730000000001%00', '/m1730000000001/x', '/m1730000000001%2F..%2F..', '/']) {
    const r = await voice('GET', bad, a);
    assert.equal(r.status, 400, `${bad} → ${r.status}`);
  }
  for (const dots of ['/../family', '/%2e%2e', '/%2e%2e/families.json']) {
    const r = await fetch(`${base}/api/voice${dots}`, { headers: auth(a) });
    assert.ok(r.status >= 400 && r.status < 500, `a dot path is normalised by the URL and never reaches a file: ${dots} → ${r.status}`);
  }
  assert.equal((await voice('GET', '', { ...a, code: '../../etc' })).status, 400);
  assert.equal((await voice('GET', '', { ...a, id: '../x' })).status, 400);
  ok('memory ids other than m + 10-16 digits, encoded dots and slashes, and a bad family code are refused (400)');

  // taken and delete
  assert.deepEqual((await voice('PUT', `/${id}`, b, { body: wav(300) })).json, { ok: false, reason: 'taken' }, 'b can not overwrite a\'s clip');
  assert.equal((await voice('PUT', `/${id}`, a, { body: clip })).json.ok, true, 'a can upload the same clip again (a retry)');
  assert.equal((await voice('DELETE', `/${id}`, b)).json.reason, 'pin', 'b deletes a\'s clip only with the PIN');
  assert.deepEqual((await voice('DELETE', `/${id}`, b, { headers: { 'x-pin': '0000' } })).json, { ok: false, reason: 'pin', left: 4 });
  assert.deepEqual((await voice('DELETE', `/${id}`, b, { headers: { 'x-pin': PIN } })).json, { ok: true });
  assert.equal((await voice('GET', `/${id}`, a)).status, 404);
  assert.ok(!existsSync(join(dataDir, 'voice', code, `${id}.wav`)));
  assert.deepEqual((await voice('DELETE', '/m1730000000002', b)).json, { ok: true }, 'the uploader deletes their own clip without the PIN');
  assert.deepEqual((await voice('DELETE', '/m1730000000002', b)).json, { ok: false, reason: 'no-clip' });
  ok('another child can not overwrite a clip; the uploader deletes it with their ticket, anyone else of the family needs the PIN');

  // quota (VOICE_MAX_CLIPS=3, VOICE_MAX_MB=1)
  for (let i = 0; i < 3; i++) assert.equal((await voice('PUT', `/m173000000010${i}`, a, { body: wav(100) })).json.ok, true);
  assert.deepEqual((await voice('PUT', '/m1730000000110', a, { body: wav(100) })).json, { ok: false, reason: 'quota' });
  assert.equal((await voice('PUT', '/m1730000000100', a, { body: wav(200) })).json.ok, true, 'replacing a clip doesn\'t count it twice');
  await voice('DELETE', '/m1730000000101', a); await voice('DELETE', '/m1730000000102', a);
  assert.equal((await voice('PUT', '/m1730000000111', a, { body: wav(300_000) })).json.ok, true, '600 KB fits in 1 MB');
  const over = await voice('PUT', '/m1730000000112', a, { body: wav(300_000) });
  assert.equal(over.status, 507, 'bytes: 600 KB + 600 KB > 1 MB'); assert.deepEqual(over.json, { ok: false, reason: 'quota' });
  assert.equal((await voice('GET', '', a)).json.clips.length, 2);
  assert.ok(!existsSync(join(dataDir, 'voice', code, 'm1730000000112.wav')), 'a clip over the quota is not kept');
  ok('the family quota (clips and bytes) refuses more (507) and keeps nothing of it');

  // rate limit per address
  const one = { ...auth(a), 'x-forwarded-for': '10.99.0.1' };
  const statuses = [];
  for (let i = 0; i < 62; i++) statuses.push((await fetch(`${base}/api/voice`, { headers: one })).status);
  assert.equal(statuses.filter((s) => s === 200).length, 60); assert.equal(statuses.at(-1), 429);
  ok('each address gets 60 voice requests a minute (429)');

  // erase deletes the family's clips and their records
  const erased = await family({ act: 'erase', code, by: a.id, ticket: a.ticket, pin: PIN, confirm: code });
  assert.equal(erased.ok, true, JSON.stringify(erased));
  for (let i = 0; i < 50 && existsSync(join(dataDir, 'voice', code)); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(!existsSync(join(dataDir, 'voice', code)), 'the family\'s clip folder is gone');
  const records = JSON.parse(readFileSync(join(dataDir, 'voice.json'), 'utf8'));
  assert.ok(!Object.hasOwn(records, code), 'and its records');
  assert.equal((await voice('GET', '', a)).json.reason, 'identity');
  ok('erasing the family deletes its clips (files and records)');

  // the last child taken out deletes the family, and its clips go too
  const solo = { id: 'vo-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
  const made = await family({ act: 'create', ...solo, name: 'Solo', pics: [2, 2, 2], pin: PIN, recovery: RECOVERY });
  assert.equal((await voice('PUT', '/m1730000000200', { ...solo, code: made.code }, { body: clip })).json.ok, true);
  assert.equal((await family({ act: 'remove', code: made.code, by: solo.id, ticket: solo.ticket, id: solo.id, pin: PIN })).left, 0);
  assert.ok(!existsSync(join(dataDir, 'voice', made.code)));
  assert.ok(!Object.hasOwn(JSON.parse(readFileSync(join(dataDir, 'voice.json'), 'utf8')), made.code));
  ok('taking out the last child deletes the family\'s clips too');
}

/** voice.js in this process with the Supabase backend; fetch is a stub that plays Supabase Storage. */
async function supabaseTests() {
  const { createRoomStore } = require('../server/room-store.js');
  const createVoice = require('../server/voice.js');
  const KEY = 'service-role-test-key-' + crypto.randomBytes(8).toString('hex'), URL_ = 'https://stub.supabase.co/';
  const store = createRoomStore({ dataDir: unitDir, databaseUrl: '' });
  const objects = new Map(), buckets = new Map(), calls = [];
  let failUpload = false, failGet = 0, onUpload = null;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  async function stub(url, { method = 'GET', headers = {}, body } = {}) {
    calls.push({ url, method, headers });
    assert.equal(headers.authorization, `Bearer ${KEY}`); assert.equal(headers.apikey, KEY);
    assert.ok(url.startsWith('https://stub.supabase.co/storage/v1/'), url);
    const p = url.slice('https://stub.supabase.co/storage/v1'.length);
    let m;
    if (method === 'POST' && p === '/bucket') {
      const b = JSON.parse(body);
      if (buckets.has(b.id)) return json(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      buckets.set(b.id, b); return json(200, { name: b.id });
    }
    if ((m = /^\/bucket\/([\w-]+)$/.exec(p))) {
      if (!buckets.has(m[1])) return json(404, { message: 'Bucket not found' });
      if (method === 'PUT') { Object.assign(buckets.get(m[1]), JSON.parse(body)); return json(200, { message: 'Successfully updated' }); }
      return json(200, buckets.get(m[1]));
    }
    if (method === 'POST' && (m = /^\/object\/list\/([\w-]+)$/.exec(p))) {
      const { prefix } = JSON.parse(body);
      return json(200, [...objects.keys()].filter((k) => k.startsWith(`${m[1]}/${prefix}/`)).map((k) => ({ name: k.slice(`${m[1]}/${prefix}/`.length) })));
    }
    if (method === 'POST' && (m = /^\/object\/([\w-]+\/[A-Z0-9]{8}\/m\d+\.wav)$/.exec(p))) {
      if (failUpload) return json(500, { message: 'boom' });
      if (onUpload) await onUpload();
      assert.equal(headers['content-type'], 'audio/wav'); assert.equal(headers['x-upsert'], 'true');
      objects.set(m[1], Buffer.from(body)); return json(200, { Key: m[1] });
    }
    if (method === 'GET' && (m = /^\/object\/authenticated\/([\w-]+\/[A-Z0-9]{8}\/m\d+\.wav)$/.exec(p))) {
      assert.equal(headers['accept-encoding'], 'identity');
      if (failGet) return json(failGet, { message: 'down' });
      const o = objects.get(m[1]);
      return o ? new Response(o, { status: 200, headers: { 'content-type': 'audio/wav', 'content-length': String(o.length) } }) : json(400, { error: 'not_found' });
    }
    if (method === 'DELETE' && (m = /^\/object\/([\w-]+)$/.exec(p))) {
      const gone = JSON.parse(body).prefixes.filter((k) => objects.delete(`${m[1]}/${k}`));
      return json(200, gone.map((name) => ({ name })));
    }
    throw new Error(`unexpected Supabase call ${method} ${p}`);
  }
  const logged = [], error = console.error;
  console.error = (...args) => { logged.push(args.join(' ')); };
  let httpServer;
  try {
    const voice = createVoice(store, { dataDir: unitDir, env: { SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY }, fetch: stub, checkPin: async (m) => (m.pin === PIN ? { ok: true } : { ok: false, reason: 'pin', left: 4 }) });
    assert.equal(voice.kind, 'supabase');
    await voice.init();
    assert.deepEqual(buckets.get('naadamy-voice'), { id: 'naadamy-voice', name: 'naadamy-voice', public: false, file_size_limit: createVoice.MAX_BYTES, allowed_mime_types: ['audio/wav'] });
    buckets.get('naadamy-voice').public = true; // someone made it public by hand
    await voice.init();
    assert.equal(buckets.get('naadamy-voice').public, false, 'a bucket already there is made private again');
    assert.equal(logged.length, 0, 'an existing bucket is not an error');
    ok('Supabase: the bucket is made private at start; "already exists" is fine, and a public one is made private');

    httpServer = http.createServer((req, res) => voice.handle(req, res, new URL(req.url, 'http://x').pathname));
    await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${httpServer.address().port}`;
    const kid = { id: 'sk-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() }, kid2 = { id: 'sl-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
    const code = 'SUPA2345';
    assert.equal(await store.createFamily(code, { id: kid.id, name: 'K' }), true);
    await store.mutateFamily(code, (f) => { f.members.push({ id: kid2.id, name: 'L' }); return { changed: true, result: null }; });
    assert.equal(await store.authenticatePlayer(kid.id, kid.ticket), true); assert.equal(await store.authenticatePlayer(kid2.id, kid2.ticket), true);
    const h = (who, extra = {}) => ({ 'x-family': code, 'x-player': who.id, 'x-ticket': who.ticket, ...extra });
    const clip = wav(4000);
    const texts = [];
    const call = async (method, p, who, opts = {}) => {
      const r = await fetch(`${base}/api/voice${p}`, { method, headers: h(who, opts.headers), body: opts.body });
      const buf = Buffer.from(await r.arrayBuffer());
      texts.push(buf.toString('latin1'), JSON.stringify([...r.headers]));
      return { status: r.status, buf, json: (r.headers.get('content-type') || '').startsWith('application/json') ? JSON.parse(buf) : null, headers: r.headers };
    };

    assert.deepEqual((await call('PUT', '/m1730000000001', kid, { body: clip, headers: { 'content-type': 'audio/wav' } })).json, { ok: true, id: 'm1730000000001', size: clip.length });
    assert.ok(objects.get(`naadamy-voice/${code}/m1730000000001.wav`).equals(clip), 'stored in the bucket at <code>/<id>.wav');
    const played = await call('GET', '/m1730000000001', kid2);
    assert.equal(played.status, 200); assert.equal(played.headers.get('content-type'), 'audio/wav'); assert.ok(played.buf.equals(clip), 'streamed back from Storage');
    assert.equal((await call('GET', '', kid2)).json.clips[0].by, kid.id);
    ok('Supabase: upload goes to the private bucket, play streams it back through the server');

    failUpload = true;
    const failed = await call('PUT', '/m1730000000002', kid, { body: clip });
    failUpload = false;
    assert.deepEqual(failed.json, { ok: false, reason: 'storage' });
    assert.equal((await call('GET', '', kid)).json.clips.length, 1, 'a failed upload is not recorded');
    assert.ok(logged.some((line) => /Supabase Storage upload: HTTP 500/.test(line)), 'the failure is logged');
    ok('Supabase: a Storage error answers 500 storage and records nothing');

    const before = objects.get(`naadamy-voice/${code}/m1730000000001.wav`), size = (await call('GET', '', kid)).json.clips[0].size;
    failUpload = true;
    assert.equal((await call('PUT', '/m1730000000001', kid, { body: wav(9000) })).status, 500);
    failUpload = false;
    assert.equal((await call('GET', '', kid)).json.clips[0].size, size, 'a failed replace puts the old record back');
    assert.ok(objects.get(`naadamy-voice/${code}/m1730000000001.wav`).equals(before), 'and the old clip is kept');
    ok('Supabase: the record is decided first; a failed write puts it back (deleted if new, the old size if replaced)');

    failGet = 503;
    assert.deepEqual((await call('GET', '/m1730000000001', kid)).json, { ok: false, reason: 'storage' }, 'only "not found" means no-clip');
    failGet = 0;
    assert.ok(logged.some((line) => /download: HTTP 503/.test(line)));
    ok('Supabase: a download asks for no compression; an error other than not-found is a 500, logged');

    const race = { id: 'sr-' + crypto.randomBytes(4).toString('hex'), ticket: ticket() };
    assert.equal(await store.createFamily('RACE2345', { id: race.id, name: 'R' }), true);
    await store.authenticatePlayer(race.id, race.ticket);
    onUpload = () => store.eraseFamily('RACE2345', () => ({ erase: true, result: null })); // erased while the clip is written
    const raced = await fetch(`${base}/api/voice/m1730000000050`, { method: 'PUT', body: clip, headers: { 'x-family': 'RACE2345', 'x-player': race.id, 'x-ticket': race.ticket } });
    onUpload = null;
    assert.equal(raced.status, 404); assert.equal((await raced.json()).reason, 'no-family');
    assert.ok(![...objects.keys()].some((k) => k.includes('RACE2345')), 'the clip written after the erase is deleted');
    assert.deepEqual(await store.voiceList('RACE2345'), []);
    ok('Supabase: a clip written while its family was erased is deleted again (no-family)');

    assert.equal((await call('DELETE', '/m1730000000001', kid2, { headers: { 'x-pin': '0000' } })).json.reason, 'pin');
    assert.deepEqual((await call('DELETE', '/m1730000000001', kid2, { headers: { 'x-pin': PIN } })).json, { ok: true });
    assert.equal(objects.size, 0, 'deleted from the bucket');
    assert.equal((await call('GET', '/m1730000000001', kid)).status, 404);
    ok('Supabase: delete (with the PIN for a clip of another child) removes the object');

    for (const n of [3, 4]) assert.equal((await call('PUT', `/m173000000000${n}`, kid, { body: clip })).json.ok, true);
    await store.eraseFamily(code, () => ({ erase: true, result: null }));
    assert.deepEqual(await store.voiceList(code), [], 'the erase drops the records with the family');
    await voice.purge(code);
    assert.equal(objects.size, 0, 'purge lists the family folder and deletes every clip');
    await voice.purge(code); // a second instance hearing the same erase
    assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/object/list/naadamy-voice')));
    ok('Supabase: erasing the family deletes its records, and purge deletes its objects (safe twice)');

    assert.ok(!texts.some((t) => t.includes(KEY)), 'the key is in no answer');
    assert.ok(!logged.some((line) => line.includes(KEY)), 'the key is in no log line');
    assert.ok(calls.every((c) => !c.url.includes(KEY)), 'nor in a URL');
    ok('Supabase: the service role key appears in no answer, URL or log line');
  } finally {
    console.error = error;
    if (httpServer) await new Promise((r) => httpServer.close(r));
  }

  const { isWav } = createVoice;
  assert.equal(isWav(wav()), true); assert.equal(isWav(wav(10, { channels: 2, rate: 44100 })), true);
  assert.equal(isWav(wav(10, { rate: 96000 })), false); assert.equal(isWav(Buffer.from('RIFF....WAVE')), false);
  const noFmt = wav(100); noFmt.write('junk', 12, 'latin1');
  assert.equal(isWav(noFmt), false);
  ok('isWav: mono or stereo PCM 8-48 kHz yes; no fmt, a too-short file or 96 kHz no');
}

/** voice.js in this process on disk: the upload limits (one per family, 3 at a time, idle timeout), the total cap,
 *  uploads off on Render or with a shared database, and which refused bodies are read on. */
async function limitTests() {
  const { createRoomStore } = require('../server/room-store.js');
  const createVoice = require('../server/voice.js');
  const dir = mkdtempSync(join(tmpdir(), 'naadamy-voice-limits-'));
  const store = createRoomStore({ dataDir: dir, databaseUrl: '' });
  const logged = [], error = console.error;
  console.error = (...args) => { logged.push(args.join(' ')); };
  const servers = [];
  const serve = async (voice) => {
    const s = http.createServer((req, res) => voice.handle(req, res, new URL(req.url, 'http://x').pathname));
    await new Promise((r) => s.listen(0, '127.0.0.1', r)); servers.push(s);
    return `http://127.0.0.1:${s.address().port}`;
  };
  const kids = [];
  for (let i = 0; i < 5; i++) {
    const kid = { id: `lk${i}-` + crypto.randomBytes(3).toString('hex'), ticket: ticket(), code: `LMT${'ABCDE'[i]}2345` };
    assert.equal(await store.createFamily(kid.code, { id: kid.id, name: 'L' }), true);
    await store.authenticatePlayer(kid.id, kid.ticket); kids.push(kid);
  }
  const h = (kid) => ({ 'x-family': kid.code, 'x-player': kid.id, 'x-ticket': kid.ticket });
  const put = async (base, kid, id, body, headers = {}) => { const r = await fetch(`${base}/api/voice/${id}`, { method: 'PUT', body, headers: { ...h(kid), 'content-type': 'audio/wav', ...headers } }); return { status: r.status, json: await r.json() }; };
  try {
    for (const [label, voice] of [['on Render', createVoice(store, { dataDir: dir, env: { RENDER: 'true' } })], ['with a shared database', createVoice({ ...store, kind: 'postgres' }, { dataDir: dir, env: {} })]]) {
      const base = await serve(voice);
      assert.deepEqual((await put(base, kids[0], 'm1730000000001', wav())).json, { ok: false, reason: 'storage-off' }, label);
      assert.equal((await put(base, kids[0], 'm1730000000001', wav())).status, 503);
      assert.equal((await fetch(`${base}/api/voice`, { headers: h(kids[0]) })).status, 200, 'listing still works');
    }
    assert.ok(!existsSync(join(dir, 'voice')), 'nothing was written to the disk');
    assert.ok(logged.some((line) => /voice uploads are off/.test(line)));
    ok('without Supabase, on Render or with a shared database, uploads are off (503 storage-off) and nothing goes to the disk');

    const capped = await serve(createVoice(store, { dataDir: dir, env: { VOICE_MAX_TOTAL_MB: '1' } }));
    assert.equal((await put(capped, kids[0], 'm1730000000001', wav(300_000))).json.ok, true);
    assert.deepEqual((await put(capped, kids[1], 'm1730000000001', wav(300_000))).json, { ok: false, reason: 'storage-full' }, 'two families: 600 KB + 600 KB > 1 MB');
    assert.ok(!existsSync(join(dir, 'voice', kids[1].code)), 'the refused clip was never written');
    ok('the total of every family is capped too (507 storage-full), checked with the record before anything is written');

    const base = await serve(createVoice(store, { dataDir: dir, env: {}, idleMs: 400 }));
    const hold = (kid, id) => rawUpload(base, `/${id}`, h(kid), { declared: 200_000, chunks: 1, size: 1000 }); // sends 1 KB of 200 KB, then waits
    const first = hold(kids[0], 'm1730000000002');
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual((await put(base, kids[0], 'm1730000000003', wav(100))).json, { ok: false, reason: 'busy' }, 'one upload per family at a time');
    const held = [first, hold(kids[1], 'm1730000000002'), hold(kids[2], 'm1730000000002')];
    await new Promise((r) => setTimeout(r, 100));
    assert.equal((await put(base, kids[3], 'm1730000000002', wav(100))).status, 429, 'at most 3 uploads at a time');
    for (const r of await Promise.all(held)) { assert.equal(r.status, 408); assert.equal(r.body.reason, 'timeout'); assert.equal(r.headers.connection, 'close'); }
    assert.equal((await put(base, kids[3], 'm1730000000002', wav(100))).json.ok, true, 'the slots are free again');
    ok('one upload per family and 3 in all at a time (429 busy); a body that stalls for the idle time gets 408 and is closed');

    // refused bodies: a known caller's small one is read on (it hears why), anything else closes the connection
    assert.deepEqual((await put(base, kids[4], 'm1730000000002', Buffer.alloc(1000, 1), { 'content-type': 'text/plain' })).json, { ok: false, reason: 'not-wav' });
    const big = await rawUpload(base, '/m1730000000002', { ...h(kids[4]), 'content-type': 'text/plain' }, { declared: 2_000_000, chunks: 31 });
    assert.ok(big.status === 'reset' || (big.status === 415 && big.headers.connection === 'close'), `a big refused body is cut off: ${big.status}`);
    const stranger = await rawUpload(base, '/m1730000000002', { ...h(kids[4]), 'x-ticket': ticket() }, { declared: 2_000_000, chunks: 31 });
    assert.ok(stranger.status === 'reset' || (stranger.status === 403 && stranger.headers.connection === 'close'), `a stranger's body is cut off: ${stranger.status}`);
    const small = await rawUpload(base, '/m1730000000002', { ...h(kids[4]), 'x-ticket': ticket() }, { declared: 1000, chunks: 1, size: 1000 });
    assert.equal(small.status, 403); assert.equal(small.headers.connection, 'close', 'even a small one of a stranger');
    assert.equal((await fetch(`${base}/api/voice`, { headers: h(kids[4]) })).status, 200, 'the server is fine');
    ok('a refused body is read on only for a known caller and up to 64 KB; a stranger\'s or a bigger one closes the connection');
  } finally {
    console.error = error;
    for (const s of servers) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
    rmSync(dir, { recursive: true, force: true });
  }
}

try {
  await diskTests();
  await supabaseTests();
  await limitTests();
  console.log(results.join('\n'));
  console.log(`Voice: ${results.length} checks passed.`);
} finally {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(unitDir, { recursive: true, force: true });
}
