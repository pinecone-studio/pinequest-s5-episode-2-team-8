// The story chapters' spoken lines (Voice.cs): every Say/Ask line in Assets/Scripts/Story*.cs is spoken in Mongolian by
// Gemini text-to-speech (gemini-3.8-flash-tts, "Halh Mongolian"), in the speaker's voice (Story.cs WHO: child, temujin,
// chinggis, woman, man, elder, guide) and acted to the line's expression (smile, sad, stern…), into
// Assets/Resources/Voice/<id>.wav. id = the first 12 hex digits of SHA-1("who|words"), as Voice.Id computes it in the game.
// Lines that already have a clip are skipped, so after editing a line just run it again (delete a clip to remake it).
//   GEMINI_API_KEY=... node unity/Tools/tts/voice.mjs           make the missing clips (the key may also sit in the repo .env)
//   node unity/Tools/tts/voice.mjs --list                       only list the lines, their voices, moods and ids
//   node unity/Tools/tts/voice.mjs --sample <dir>               one clip per speaker type into <dir>, to hear the voices first
//   node unity/Tools/tts/voice.mjs --out <dir>                  make the missing clips into <dir> instead (a free-tier key makes
//                                                               10 a day: run it daily, then copy <dir>/*.wav into Resources/Voice)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const unity = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scripts = join(unity, 'Assets', 'Scripts'), out = join(unity, 'Assets', 'Resources', 'Voice');
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions', MODEL = 'gemini-3.8-flash-tts';

// the speaker types: a Gemini voice and who they are (picked by ear against Chimege, 2026-10-29)
const VOICES = {
  guide: { voice: 'Sulafat', who: 'a warm storyteller for children' },
  chinggis: { voice: 'Orus', who: 'a wise, proud old Mongol khan telling a child the story of his life; deep, warm, unhurried' },
  temujin: { voice: 'Charon', who: 'a determined young Mongol man' },
  child: { voice: 'Puck', who: 'a cheerful, eager 12-year-old Mongol boy' },
  woman: { voice: 'Gacrux', who: 'a brave, loving Mongol mother' },
  man: { voice: 'Algieba', who: 'a strong Mongol warrior' },
  elder: { voice: 'Algenib', who: 'a kind, wise old Mongol man; slow and gentle' },
};
// the expression a line is said with (Story.cs portraits), as a direction
const MOOD = { smile: 'warm, smiling', happy: 'happy', sad: 'quiet and sad', stern: 'serious and firm', shout: 'calling out loudly', angry: 'angry', surprised: 'surprised', neutral: 'calm' };

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const m = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m.exec(readFileSync(join(unity, '..', '.env'), 'utf8'));
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  } catch { /* no .env */ }
  return '';
}
const lit = String.raw`"((?:[^"\\]|\\.)*)"`; // a C# string literal
const unquote = (s) => JSON.parse('"' + s + '"');
export const id = (who, mn) => createHash('sha1').update(who + '|' + mn, 'utf8').digest('hex').slice(0, 12);

/** Every spoken line: { who, voice, mood, mn, id, file }. */
export function lines() {
  const story = readFileSync(join(scripts, 'Story.cs'), 'utf8'), kinds = {};
  for (const m of story.matchAll(new RegExp(String.raw`\["(\w+)"\]\s*=\s*new Who\s*\{[^}]*voice\s*=\s*` + lit, 'g'))) kinds[m[1]] = unquote(m[2]);
  const said = [
    new RegExp(String.raw`\.Say\(\s*` + lit + String.raw`\s*,([^,]*),\s*` + lit, 'g'),          // Say(who, expr, mn, en); expr may be code
    new RegExp(String.raw`\.Ask\(\s*` + lit + String.raw`\s*,([^,]*),\s*T\(\s*` + lit, 'g'),     // Ask(who, expr, T(mn, en), …)
  ];
  const all = [], seen = new Set();
  for (const f of readdirSync(scripts).filter((n) => /^Story.*\.cs$/.test(n)).sort()) {
    const src = readFileSync(join(scripts, f), 'utf8');
    for (const re of said) for (const m of src.matchAll(re)) {
      const who = unquote(m[1]), mn = unquote(m[3]), i = id(who, mn), expr = /^\s*"(\w+)"\s*$/.exec(m[2]); // an expression picked in code: calm
      if (seen.has(i)) continue; seen.add(i);
      all.push({ who, voice: kinds[who] || 'guide', mood: expr ? expr[1] : 'neutral', mn, id: i, file: f });
    }
  }
  return all;
}

// numbers are spoken as Mongolian words (the model reads "1206" unreliably), and odd marks become a pause
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

/** The line as a WAV (24 kHz mono), retried when the service is busy or slips. */
async function speak(k, text, v, mood, tries = 5) {
  text = spoken(text);
  for (let i = 1; ; i++) {
    try { return await speakOnce(k, text, v, mood); }
    catch (e) { if (i >= tries || e.status === 400 || e.status === 403 || e.daily) throw e; await new Promise((r) => setTimeout(r, (e.status === 429 ? 15000 : 2000) * i)); }
  }
}
async function speakOnce(k, text, v, mood) {
  const res = await fetch(API, {
    method: 'POST', headers: { 'x-goog-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: `Speak natural Khalkha Mongolian as ${v.who}; ${MOOD[mood] || 'calm'}.` }] }] }],
      response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: v.voice }] },
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}: ${JSON.stringify(j).slice(0, 200)}`), { status: res.status, daily: /per day/i.test(JSON.stringify(j)) });
  for (const s of j.steps || []) for (const c of s.content || []) if (c.type === 'audio' && c.data) {
    const buf = Buffer.from(c.data, 'base64');
    if (buf.slice(0, 4).toString() === 'RIFF') return buf;
  }
  throw new Error('Gemini sent no WAV audio: ' + JSON.stringify(j).slice(0, 200));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(); // run, not imported

async function main() {
  const args = process.argv.slice(2), all = lines();
  if (args[0] === '--list') {
    for (const l of all) console.log(`${l.id}  ${l.voice.padEnd(8)} ${l.mood.padEnd(8)} ${l.who.padEnd(14)} ${l.mn}`);
    console.log(`${all.length} lines, ${all.reduce((n, l) => n + l.mn.length, 0)} characters`);
    return;
  }
  const k = key();
  if (!k) { console.error('No Gemini key: set GEMINI_API_KEY (or put GEMINI_API_KEY=... in the repo .env).'); process.exit(1); }
  if (args[0] === '--sample') {
    const dir = resolve(args[1] || '.'); mkdirSync(dir, { recursive: true });
    for (const [kind, v] of Object.entries(VOICES)) {
      const l = all.find((x) => x.voice === kind) || all[0];
      writeFileSync(join(dir, `${kind}.wav`), await speak(k, l.mn, v, l.mood)); console.log(`${kind}: ${l.mn.slice(0, 60)}`);
    }
    return;
  }
  const dir = args[0] === '--out' ? resolve(args[1]) : out; mkdirSync(dir, { recursive: true });
  let made = 0, have = 0;
  for (const l of all) {
    const f = join(dir, l.id + '.wav'); if (existsSync(f)) { have++; continue; }
    try { writeFileSync(f, await speak(k, l.mn, VOICES[l.voice] || VOICES.guide, l.mood)); }
    catch (e) { if (!e.daily) throw e; console.log('The free daily limit is used up: run again tomorrow.'); break; }
    made++; console.log(`${l.id} ${l.voice} ${l.mood} ${l.mn.slice(0, 50)}`);
  }
  console.log(`${made} new clips; ${have + made} of ${all.length} done in ${dir}.`);
}
