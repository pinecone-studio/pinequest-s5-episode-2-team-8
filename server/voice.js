'use strict';
/* Voice clips of the memory book (Unity's MemoryForm records a WAV), kept for the family on the server so they survive a new
   device and play on every device of the family. The server is the gatekeeper: clips sit in a PRIVATE Supabase Storage
   bucket (or, for local play without SUPABASE_URL, under DATA_DIR/voice/), and only a child of the family on its own device
   (family code, player id and that device's ticket, as for the family acts) can upload, list, play or delete them. Their
   metadata (size, uploader, time) is in roomStore (naadamy_voice or voice.json), so the list and the quotas are one read.
   See docs/PROTOCOL.md. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, pipeline } = require('node:stream');
const clientIp = require('./client-ip.js');

const FAMILY_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const PLAYER_ID = /^[\w-]{4,24}$/;
const PLAYER_TICKET = /^[a-f0-9]{64}$/i;
const VOICE_ID = /^m\d{10,16}$/; // a memory id: "m" and the time in ms
const BUCKET = /^[a-z0-9][a-z0-9_-]{2,62}$/;
const MAX_BYTES = 44 + 300 * 22050 * 2 + 4096; // Unity's longest clip: 300 s of 22050 Hz mono 16-bit (13.2 MB), a header and a little room
const DRAIN_MAX = 64 * 1024; // a refused upload this small is read to the end, so the client hears why; a bigger one is cut off
const WAV_TYPES = ['', 'audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'];
const STATUS = { invalid: 400, identity: 403, pin: 403, 'pin-locked': 403, 'needs-pin': 403, 'no-family': 404, 'no-clip': 404, method: 405,
  timeout: 408, taken: 409, 'too-big': 413, 'not-wav': 415, busy: 429, storage: 500, 'storage-off': 503, quota: 507, 'storage-full': 507 };
const posInt = (value, fallback) => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback);
const familyCode = (value) => { const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return FAMILY_CODE.test(code) ? code : ''; };
const keyOf = (code, id) => `${code}/${id}.wav`; // only ever from a checked code and id: no path can be smuggled in
const logged = (what) => (error) => console.error(`Voice: could not ${what}:`, error.message);

/** A real PCM WAV: RIFF/WAVE, a "fmt " chunk of format 1 (PCM), 1-2 channels, 8-48 kHz, 8/16/24/32 bits, then a "data"
 *  chunk that fits in the file. */
function isWav(buf) {
  if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') return false;
  let fmt = null;
  for (let at = 12, n = 0; at + 8 <= buf.length && n < 64; n++) {
    const id = buf.toString('latin1', at, at + 4), size = buf.readUInt32LE(at + 4), body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + size > buf.length) return false;
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), align: buf.readUInt16LE(body + 12), bits: buf.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      return !!fmt && fmt.format === 1 && fmt.channels >= 1 && fmt.channels <= 2 && fmt.rate >= 8000 && fmt.rate <= 48000
        && [8, 16, 24, 32].includes(fmt.bits) && fmt.align === fmt.channels * fmt.bits / 8 && size > 0 && body + size <= buf.length;
    }
    at = body + size + (size & 1); // chunks are padded to an even length
  }
  return false;
}

/** The request body in one buffer (its declared size, else grown by doubling), or why not: 'too-big' as soon as it passes
 *  `cap` (the rest is never read), 'timeout' after `idleMs` with no byte or after 3 minutes in all (a trickle can't hold an
 *  upload slot for long), 'gone' when the client went away. */
function readBody(req, cap, idleMs) {
  return new Promise((resolve) => {
    const declared = Number(req.headers['content-length']);
    let buf = Buffer.allocUnsafe(Number.isSafeInteger(declared) && declared > 0 && declared <= cap ? declared : 64 * 1024), size = 0, done = false, timer;
    const deadline = setTimeout(() => finish('timeout'), 180_000);
    const finish = (value) => { if (done) return; done = true; clearTimeout(timer); clearTimeout(deadline); if (typeof value === 'string') req.pause(); resolve(value); };
    const idle = () => { clearTimeout(timer); timer = setTimeout(() => finish('timeout'), idleMs); };
    req.on('data', (chunk) => {
      if (done) return;
      if (size + chunk.length > cap) return finish('too-big');
      if (size + chunk.length > buf.length) { const next = Buffer.allocUnsafe(Math.min(cap, Math.max(buf.length * 2, size + chunk.length))); buf.copy(next, 0, 0, size); buf = next; }
      chunk.copy(buf, size); size += chunk.length; idle();
    });
    req.on('end', () => finish(buf.subarray(0, size)));
    req.on('error', () => finish('gone')); req.on('close', () => finish('gone'));
    idle();
  });
}

/** Clips as files, DATA_DIR/voice/<family code>/<memory id>.wav: for local play with the JSON store. */
function diskBackend(dir) {
  const file = (key) => path.join(dir, key);
  return {
    kind: 'disk',
    async init() {},
    async put(key, buf) {
      await fs.promises.mkdir(path.dirname(file(key)), { recursive: true });
      const tmp = `${file(key)}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      try { await fs.promises.writeFile(tmp, buf, { mode: 0o600 }); await fs.promises.rename(tmp, file(key)); } catch (error) { await fs.promises.rm(tmp, { force: true }); throw error; }
    },
    async get(key) {
      const st = await fs.promises.stat(file(key)).catch(() => null);
      return st && st.isFile() ? { stream: fs.createReadStream(file(key)), size: st.size } : null;
    },
    async remove(key) { await fs.promises.rm(file(key), { force: true }); },
    async purge(code) { await fs.promises.rm(path.join(dir, code), { recursive: true, force: true }); },
  };
}

/** Clips in a private Supabase Storage bucket, over its REST API with the service role key (which never leaves the server:
 *  not in a log, not in an answer). */
function supabaseBackend(url, key, bucket, fetch) {
  const base = url.replace(/\/+$/, '') + '/storage/v1';
  const call = (method, p, { json, body, headers = {} } = {}) => fetch(base + p, { method,
    headers: { authorization: `Bearer ${key}`, apikey: key, ...(json !== undefined && { 'content-type': 'application/json' }), ...headers },
    body: json !== undefined ? JSON.stringify(json) : body });
  const fail = (what, r) => { throw new Error(`Supabase Storage ${what}: HTTP ${r.status}`); };
  return {
    kind: 'supabase',
    /** Makes the bucket, private, if it is missing; one already there is made private if it was public. */
    async init() {
      const made = await call('POST', '/bucket', { json: { id: bucket, name: bucket, public: false, file_size_limit: MAX_BYTES, allowed_mime_types: ['audio/wav'] } });
      if (made.ok) return;
      if (made.status !== 409 && !/already exists|duplicate/i.test(await made.text().catch(() => ''))) fail('create bucket', made);
      const got = await call('GET', `/bucket/${bucket}`);
      if (!got.ok) fail('read bucket', got);
      if ((await got.json()).public !== false) { const set = await call('PUT', `/bucket/${bucket}`, { json: { public: false } }); if (!set.ok) fail('make bucket private', set); }
    },
    async put(objectKey, buf) {
      const r = await call('POST', `/object/${bucket}/${objectKey}`, { body: buf, headers: { 'content-type': 'audio/wav', 'x-upsert': 'true' } });
      if (!r.ok) fail('upload', r);
    },
    /** null only for "not found" (404, or Storage's 400 with a not-found error); anything else is an error. */
    async get(objectKey) {
      const r = await call('GET', `/object/authenticated/${bucket}/${objectKey}`, { headers: { 'accept-encoding': 'identity' } });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        if (r.status === 404 || (r.status === 400 && /not.?found|"404"/i.test(text))) return null;
        fail('download', r);
      }
      if (!r.body) fail('download', r);
      // fetch unpacks a compressed answer itself, so its content-length would be wrong
      return { stream: Readable.fromWeb(r.body), size: r.headers.get('content-encoding') ? 0 : Number(r.headers.get('content-length')) || 0 };
    },
    async remove(objectKey) {
      const r = await call('DELETE', `/object/${bucket}`, { json: { prefixes: [objectKey] } });
      if (!r.ok) fail('delete', r);
    },
    /** Every clip under the family's folder: listed, then deleted, a thousand at a time. */
    async purge(code) {
      for (let round = 0; round < 10; round++) {
        const listed = await call('POST', `/object/list/${bucket}`, { json: { prefix: code, limit: 1000, offset: 0 } });
        if (!listed.ok) fail('list', listed);
        const names = (await listed.json()).map((o) => o && o.name).filter((name) => /^m\d{10,16}\.wav$/.test(name || ''));
        if (!names.length) return;
        const r = await call('DELETE', `/object/${bucket}`, { json: { prefixes: names.map((name) => `${code}/${name}`) } });
        if (!r.ok) fail('delete', r);
        if (names.length < 1000) return;
      }
    },
  };
}

module.exports = function createVoice(roomStore, { dataDir, env = process.env, fetch = globalThis.fetch, checkPin = async () => ({ ok: false, reason: 'pin' }),
  now = () => Date.now(), idleMs = 15_000 } = {}) {
  const max = { clips: posInt(env.VOICE_MAX_CLIPS, 200), bytes: posInt(env.VOICE_MAX_MB, 500) * 1024 * 1024, total: posInt(env.VOICE_MAX_TOTAL_MB, 900) * 1024 * 1024 };
  const uploadsMax = posInt(env.VOICE_MAX_UPLOADS, 3); // each holds up to MAX_BYTES in memory
  let bucket = env.SUPABASE_VOICE_BUCKET || 'naadamy-voice';
  if (!BUCKET.test(bucket)) { console.error('Voice: SUPABASE_VOICE_BUCKET is not a valid bucket name; using naadamy-voice'); bucket = 'naadamy-voice'; }
  if (env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY) console.error('Voice: SUPABASE_URL is set without SUPABASE_SERVICE_ROLE_KEY');
  const backend = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseBackend(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, bucket, fetch) : diskBackend(path.join(dataDir, 'voice'));
  // on Render (its small data disk) or with a shared database (records shared, files only on this instance) clips need
  // Supabase: without it, uploads are refused (`storage-off`) unless VOICE_ON_DISK=true says this disk is meant for them
  const uploadsOff = backend.kind === 'disk' && (!!env.RENDER || roomStore.kind === 'postgres') && env.VOICE_ON_DISK !== 'true';
  if (uploadsOff) console.error('Voice: no Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY): voice uploads are off');

  // a request a second per address on average: uploads are big, and a list is fetched once per opening of the book
  const hits = new Map();
  function allow(ip) {
    const t = now(), recent = (hits.get(ip) || []).filter((at) => t - at < 60_000);
    if (recent.length >= 60) return false;
    recent.push(t); hits.set(ip, recent);
    if (hits.size > 5000) for (const [key, list] of hits) if (!list.some((at) => t - at < 60_000)) hits.delete(key);
    return true;
  }
  let uploads = 0;
  const uploadingFamilies = new Set(); // one upload per family at a time

  /** The caller as a child of the family on this device: x-family, x-player and x-ticket. An unknown family and a child not
   *  in it get the same answer, and the ticket is checked only for a member (as the family acts with `by` do: an erased
   *  child's old device registers nothing). */
  async function member(req) {
    const code = familyCode(req.headers['x-family']), by = String(req.headers['x-player'] || ''), ticket = String(req.headers['x-ticket'] || '');
    if (!code || !PLAYER_ID.test(by) || !PLAYER_TICKET.test(ticket)) return { reason: 'invalid' };
    const family = await roomStore.getFamily(code);
    if (!family || !family.members.some((m) => m.id === by) || !(await roomStore.authenticatePlayer(by, ticket))) return { reason: 'identity' };
    return { code, by, ticket };
  }

  /** The record is decided first (voicePut, with the quotas), then the clip is written; if writing fails the record goes
   *  back as it was. A clip written after the family was erased is deleted again. */
  async function upload(req, send, who, id, mark) {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (uploadsOff) return send(503, { ok: false, reason: 'storage-off' });
    if (Number(req.headers['content-length']) > MAX_BYTES) return send(413, { ok: false, reason: 'too-big' });
    if (!WAV_TYPES.includes(type)) return send(415, { ok: false, reason: 'not-wav' });
    if (uploads >= uploadsMax || uploadingFamilies.has(who.code)) return send(429, { ok: false, reason: 'busy' });
    uploads++; uploadingFamilies.add(who.code);
    try {
      const body = await readBody(req, MAX_BYTES, idleMs);
      mark(typeof body === 'string' ? 'cut' : 'read');
      if (body === 'timeout') return send(408, { ok: false, reason: 'timeout' });
      if (typeof body === 'string') return send(413, { ok: false, reason: 'too-big' });
      if (!isWav(body)) return send(415, { ok: false, reason: 'not-wav' });
      const put = await roomStore.voicePut(who.code, id, body.length, who.by, max);
      if (!put.ok) return send(STATUS[put.reason] || 400, put);
      const key = keyOf(who.code, id);
      try { await backend.put(key, body); } catch (error) {
        await (put.old ? roomStore.voicePut(who.code, id, put.old.size, put.old.by, null, put.old.ts) : roomStore.voiceDelete(who.code, id)).catch(logged('put a record back'));
        throw error;
      }
      if (!(await roomStore.getFamily(who.code))) { // erased meanwhile: its records and clips are gone, so this one goes too
        await backend.remove(key).catch(logged('delete the clip of an erased family'));
        return send(404, { ok: false, reason: 'no-family' });
      }
      send(200, { ok: true, id, size: body.length });
    } finally {
      uploads--; uploadingFamilies.delete(who.code);
    }
  }

  async function play(res, send, who, id) {
    const clip = (await roomStore.voiceList(who.code)).find((c) => c.id === id);
    const got = clip && await backend.get(keyOf(who.code, id));
    if (!got) return send(404, { ok: false, reason: 'no-clip' });
    res.writeHead(200, { 'content-type': 'audio/wav', ...(got.size && { 'content-length': got.size }), 'cache-control': 'private, no-cache',
      'content-disposition': `inline; filename="${id}.wav"` });
    // pipeline closes the file (or the Storage socket) when the client goes away
    pipeline(got.stream, res, (error) => { if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') logged('send a clip')(error); });
  }

  /** The uploader deletes their own clip with their ticket; any other child of the family needs the family PIN (x-pin),
   *  checked (and its wrong tries counted) by family.js's check-pin. */
  async function remove(req, send, who, id) {
    const clip = (await roomStore.voiceList(who.code)).find((c) => c.id === id);
    if (!clip) return send(404, { ok: false, reason: 'no-clip' });
    if (clip.by !== who.by) {
      const checked = await checkPin({ code: who.code, by: who.by, ticket: who.ticket, pin: String(req.headers['x-pin'] || '') });
      if (!checked.ok) return send(STATUS[checked.reason] || 403, checked);
    }
    await roomStore.voiceDelete(who.code, id);
    await backend.remove(keyOf(who.code, id)).catch(logged('delete a clip'));
    send(200, { ok: true });
  }

  /** HTTP handler for /api/voice (GET: the family's clips) and /api/voice/<memory id> (PUT or POST: upload a WAV; GET: play
   *  it; DELETE). */
  function handle(req, res, pathname) {
    const reading = req.method === 'PUT' || req.method === 'POST';
    let state = reading ? 'unread' : 'read', known = false; // the body: 'unread', 'read' or 'cut'; known: the caller passed member()
    const send = (status, body) => {
      if (res.headersSent) return res.destroy();
      let answered = false;
      const answer = (close) => {
        if (answered) return; answered = true;
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(close && { connection: 'close' }) });
        res.end(JSON.stringify(body));
      };
      if (state === 'read' || req.complete) return answer(false);
      // an unread body is thrown away to its end only for a known caller's refused upload of at most 64 KB, so it hears
      // why; else (a stranger, too many requests, a big body) the connection is closed and the rest never read
      if (state === 'cut' || !known || status === 429 || !(Number(req.headers['content-length']) <= DRAIN_MAX)) { req.pause(); return answer(true); }
      state = 'read'; let size = 0;
      req.on('data', (chunk) => { size += chunk.length; if (size > DRAIN_MAX) { req.pause(); answer(true); } });
      req.on('end', () => answer(false)); req.on('error', () => answer(true));
      req.resume();
    };
    const match = /^\/api\/voice(?:\/([^/]*))?$/.exec(pathname), id = match && match[1];
    if (!match || (id !== undefined && !VOICE_ID.test(id))) return send(400, { ok: false, reason: 'invalid' });
    const act = id === undefined ? (req.method === 'GET' ? 'list' : '') : req.method === 'GET' ? 'play' : reading ? 'upload' : req.method === 'DELETE' ? 'delete' : '';
    if (!act) return send(405, { ok: false, reason: 'method' });
    if (!allow(clientIp(req))) return send(429, { ok: false, reason: 'busy' });
    (async () => {
      const who = await member(req);
      if (who.reason) return send(STATUS[who.reason], { ok: false, reason: who.reason });
      known = true;
      if (act === 'upload') return upload(req, send, who, id, (read) => { state = read; });
      if (act === 'play') return play(res, send, who, id);
      if (act === 'delete') return remove(req, send, who, id);
      const clips = await roomStore.voiceList(who.code);
      send(200, { ok: true, clips: clips.map(({ id: clip, size, by, ts }) => ({ id: clip, size, by, ts })), used: clips.reduce((sum, c) => sum + c.size, 0),
        max: { clips: max.clips, bytes: max.bytes } });
    })().catch((error) => { console.error('Voice:', error.message); send(500, { ok: false, reason: 'storage' }); });
  }

  /** The family is gone (erased, or its last child taken out; its metadata went with it): its clips are deleted too. Best
   *  effort: a failure is logged, never thrown. Safe twice (each instance hears the erase). */
  async function purge(code) {
    if (!FAMILY_CODE.test(code || '')) return;
    try { await backend.purge(code); } catch (error) { logged('delete the clips of a deleted family')(error); }
  }

  /** At start: the Supabase bucket (private) is made if missing. A failure is logged; uploads then fail with `storage`. */
  async function init() {
    try { await backend.init(); } catch (error) { console.error('Voice:', error.message); }
  }

  return { handle, purge, init, kind: backend.kind };
};
module.exports.isWav = isWav;
module.exports.MAX_BYTES = MAX_BYTES;
