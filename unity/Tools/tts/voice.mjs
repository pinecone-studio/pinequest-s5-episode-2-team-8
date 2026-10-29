// The story chapters' spoken lines (Voice.cs): every Say/Ask line in Assets/Scripts/Story*.cs is spoken in Mongolian by
// Chimege text-to-speech, in the speaker's voice (Story.cs WHO: child, temujin, chinggis, woman, man, elder, guide), into
// Assets/Resources/Voice/<id>.wav. id = the first 12 hex digits of SHA-1("who|words"), as Voice.Id computes it in the game.
// Lines that already have a clip are skipped, so after editing a line just run it again.
//   CHIMEGE_TOKEN=... node unity/Tools/tts/voice.mjs            make the missing clips (the token may also sit in .env)
//   node unity/Tools/tts/voice.mjs --list                       only list the lines, their voices and ids
//   node unity/Tools/tts/voice.mjs --sample <dir>               one clip per speaker type into <dir>, to hear the voices first
//   node unity/Tools/tts/voice.mjs --voices <dir> [line]        one line (default the first) in each of Chimege's 8 voices
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const unity = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scripts = join(unity, 'Assets', 'Scripts'), out = join(unity, 'Assets', 'Resources', 'Voice');
const API = 'https://api.chimege.com/v1.2/synthesize';

// the speaker types and their Chimege voices (speed and pitch tune age; checked by ear with --sample)
const VOICES = {
  guide: { id: 'FEMALE2v2', speed: 1, pitch: 1 },
  chinggis: { id: 'MALE2v2', speed: 0.95, pitch: 0.9 },
  temujin: { id: 'MALE2v2', speed: 1, pitch: 1 },
  child: { id: 'MALE3v2', speed: 1.05, pitch: 1.5 },
  woman: { id: 'FEMALE4v2', speed: 1, pitch: 1 },
  man: { id: 'MALE2v2', speed: 1, pitch: 1 },
  elder: { id: 'MALE1v2', speed: 0.85, pitch: 0.85 },
};

function token() {
  if (process.env.CHIMEGE_TOKEN) return process.env.CHIMEGE_TOKEN;
  try {
    const m = /^\s*CHIMEGE_TOKEN\s*=\s*(.+?)\s*$/m.exec(readFileSync(join(unity, '..', '.env'), 'utf8'));
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  } catch { /* no .env */ }
  return '';
}
const lit = String.raw`"((?:[^"\\]|\\.)*)"`; // a C# string literal
const unquote = (s) => JSON.parse('"' + s + '"');
export const id = (who, mn) => createHash('sha1').update(who + '|' + mn, 'utf8').digest('hex').slice(0, 12);

/** Every spoken line: { who, voice, mn, id, file }. */
export function lines() {
  const story = readFileSync(join(scripts, 'Story.cs'), 'utf8'), kinds = {};
  for (const m of story.matchAll(new RegExp(String.raw`\["(\w+)"\]\s*=\s*new Who\s*\{[^}]*voice\s*=\s*` + lit, 'g'))) kinds[m[1]] = unquote(m[2]);
  const said = [
    new RegExp(String.raw`\.Say\(\s*` + lit + String.raw`\s*,[^,]*,\s*` + lit, 'g'),          // Say(who, expr, mn, en); expr may be code
    new RegExp(String.raw`\.Ask\(\s*` + lit + String.raw`\s*,[^,]*,\s*T\(\s*` + lit, 'g'),     // Ask(who, expr, T(mn, en), …)
  ];
  const all = [], seen = new Set();
  for (const f of readdirSync(scripts).filter((n) => /^Story.*\.cs$/.test(n)).sort()) {
    const src = readFileSync(join(scripts, f), 'utf8');
    for (const re of said) for (const m of src.matchAll(re)) {
      const who = unquote(m[1]), mn = unquote(m[2]), i = id(who, mn);
      if (seen.has(i)) continue; seen.add(i);
      all.push({ who, voice: kinds[who] || 'guide', mn, id: i, file: f });
    }
  }
  return all;
}

// Chimege reads only Cyrillic, spaces and ? ! . - ' " : , so numbers become words and other marks a pause
const ONE = ['', 'нэг', 'хоёр', 'гурав', 'дөрөв', 'тав', 'зургаа', 'долоо', 'найм', 'ес'], ONE_N = ['', 'нэг', 'хоёр', 'гурван', 'дөрвөн', 'таван', 'зургаан', 'долоон', 'найман', 'есөн'];
const TEN = ['', 'арав', 'хорь', 'гуч', 'дөч', 'тавь', 'жар', 'дал', 'ная', 'ер'], TEN_N = ['', 'арван', 'хорин', 'гучин', 'дөчин', 'тавин', 'жаран', 'далан', 'наян', 'ерэн'];
/** A number in Mongolian words; joined: it stands before a word ("1206 онд" -> "мянга хоёр зуун зургаан онд"). */
export function words(n, joined) {
  if (n === 0) return 'тэг';
  const parts = [], th = Math.floor(n / 1000) % 10, h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
  const last = o ? 'o' : t ? 't' : h ? 'h' : 'th', end = (k) => k === last && !joined; // the last part takes the plain form unless a word follows
  if (th) parts.push((th > 1 ? ONE_N[th] + ' ' : '') + (end('th') || last !== 'th' ? 'мянга' : 'мянган')); // "мянга хоёр зуун", "мянган хүн"
  if (h) parts.push((h > 1 ? ONE_N[h] + ' ' : th ? 'нэг ' : '') + (end('h') ? 'зуу' : 'зуун'));
  if (t) parts.push(end('t') ? TEN[t] : TEN_N[t]);
  if (o) parts.push(end('o') ? ONE[o] : ONE_N[o]);
  return parts.join(' ');
}
export function spoken(text) {
  return text.replace(/\d+(?=(\s+[А-Яа-яЁёӨөҮү])?)/g, (d, next) => words(Number(d) % 10000, !!next))
    .replace(/[—–…;()«»“”„]/g, ', ').replace(/[^А-Яа-яЁёӨөҮү ?!.\-'":,]/g, ' ').replace(/\s*,[\s,]*/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
}

async function speak(tok, text, v, tries = 3) {
  text = spoken(text);
  for (let i = 1; ; i++) {
    try { return await speakOnce(tok, text, v); }
    catch (e) { if (i >= tries || e.status === 403) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); } // "Reached max decoder steps" comes and goes
  }
}
async function speakOnce(tok, text, v) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'plain/text', Token: tok, 'voice-id': v.id, speed: String(v.speed), pitch: String(v.pitch), 'sample-rate': '22050' },
    body: text,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw Object.assign(new Error(`Chimege ${res.status} ${res.headers.get('error-code') || ''}: ${buf.toString('utf8').slice(0, 200)}`), { status: res.status });
  if (buf.slice(0, 4).toString() !== 'RIFF') throw new Error('Chimege did not send a WAV file: ' + buf.slice(0, 80).toString('utf8'));
  return buf;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(); // run, not imported

async function main() {
  const args = process.argv.slice(2), all = lines();
  if (args[0] === '--list') {
    for (const l of all) console.log(`${l.id}  ${l.voice.padEnd(8)} ${l.who.padEnd(14)} ${l.mn}`);
    console.log(`${all.length} lines, ${all.reduce((n, l) => n + l.mn.length, 0)} characters`);
    return;
  }
  const tok = token();
  if (!tok) { console.error('No Chimege token: set CHIMEGE_TOKEN (or put CHIMEGE_TOKEN=... in the repo .env).'); process.exit(1); }
  if (args[0] === '--voices') {
    const dir = resolve(args[1] || '.'), l = all[Number(args[2] || 0)] || all[0]; mkdirSync(dir, { recursive: true });
    for (const v of ['FEMALE1v2', 'FEMALE2v2', 'FEMALE3v2', 'FEMALE4v2', 'MALE1v2', 'MALE2v2', 'MALE3v2', 'MALE4v2']) writeFileSync(join(dir, v + '.wav'), await speak(tok, l.mn, { id: v, speed: 1, pitch: 1 }));
    console.log('8 voices: ' + spoken(l.mn)); return;
  }
  if (args[0] === '--sample') {
    const dir = resolve(args[1] || '.'); mkdirSync(dir, { recursive: true });
    for (const [kind, v] of Object.entries(VOICES)) {
      const l = all.find((x) => x.voice === kind) || all[0];
      writeFileSync(join(dir, `${kind}.wav`), await speak(tok, l.mn, v)); console.log(`${kind}: ${l.mn.slice(0, 60)}`);
    }
    return;
  }
  mkdirSync(out, { recursive: true });
  let made = 0;
  for (const l of all) {
    const f = join(out, l.id + '.wav'); if (existsSync(f)) continue;
    writeFileSync(f, await speak(tok, l.mn, VOICES[l.voice] || VOICES.guide)); made++;
    console.log(`${l.id} ${l.voice} ${l.mn.slice(0, 50)}`);
  }
  console.log(`${made} new clips, ${all.length - made} already there.`);
}
