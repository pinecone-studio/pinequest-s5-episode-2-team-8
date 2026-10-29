// Tests Basar's server bridge against a fake Claude API: the key stays on the server, the request
// uses the right model / effort / structured output, refusals are handled, and no key = offline mode.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], ok = (c, m) => { if (c) console.log('✓ ' + m); else { console.log('✗ ' + m); fails.push(m); } };
const seen = [];
const sys = (b) => (Array.isArray(b.system) ? b.system.map((x) => x.text).join('\n') : String(b.system)); // the system prompt's text, block by block
let mode = 'normal';
const fake = createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
    const body = JSON.parse(b); seen.push({ headers: req.headers, body });
    const quiz = body.output_config && body.output_config.format;
    const text = quiz ? JSON.stringify({ question: 'Q?', options: ['a', 'b', 'c', 'd'], answer: 2, explanation: 'because' }) : 'Вуф! Сайн уу!';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(mode === 'refuse' ? { stop_reason: 'refusal', content: [] } : { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] }));
  });
});
await new Promise((r) => fake.listen(0, r));

function start(env) {
  return new Promise((resolveP, reject) => {
    const child = spawn(process.execPath, [join(root, 'server', 'server.js')], { env: { ...process.env, PORT: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.on('message', (m) => m.port && resolveP({ child, base: `http://127.0.0.1:${m.port}` }));
    child.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
}
const post = (base, body) => fetch(base + '/api/basar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

const a = await start({ ANTHROPIC_API_KEY: 'secret-test-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${fake.address().port}` });
try {
  const info = await fetch(a.base + '/api/basar').then((r) => r.json());
  ok(info.ai === true && !JSON.stringify(info).includes('secret'), 'AI is on and the key is never sent to the browser');
  const chat = await post(a.base, { mode: 'chat', messages: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: 'Нууц товчоо гэж юу вэ?' }], name: 'Сараа', age: 7 });
  ok(chat.ok && chat.reply === 'Вуф! Сайн уу!' && chat.source === 'ai', 'chat answer comes back from Claude');
  const r1 = seen[0];
  ok(r1.headers['x-api-key'] === 'secret-test-key' && r1.headers['anthropic-version'] === '2023-06-01', 'API key and version header are sent server-side');
  ok(r1.body.model === 'claude-opus-5-5' && r1.body.output_config.effort === 'low' && r1.body.fallbacks === 'default', 'model, effort and refusal fallback are set');
  ok(r1.body.messages.length === 1 && r1.body.messages[0].role === 'user', 'history is cleaned to start with the child');
  ok(Array.isArray(r1.body.system) && r1.body.system.length === 2 && r1.body.system[0].cache_control && r1.body.system[0].cache_control.type === 'ephemeral' && !r1.body.system[1].cache_control, 'the fixed part of the system prompt is cached, the child’s part comes after it');
  ok(/Delüün Boldog/.test(r1.body.system[0].text) && /Boorchu/.test(r1.body.system[0].text) && !/7 years old/.test(r1.body.system[0].text), 'the cached part carries the Chinggis Khaan history sheet and nothing about the child');
  ok(/Bankhar/.test(sys(r1.body)) && /7 years old/.test(sys(r1.body)) && /personal information/.test(sys(r1.body)), 'kid-safe Basar system prompt with the child’s age');
  await post(a.base, { mode: 'chat', messages: [{ role: 'user', content: 'What is a ger?' }], lang: 'en' });
  ok(/same language/.test(sys(seen[1].body)) && /right now that is English/.test(sys(seen[1].body)) && /anything a curious child asks/.test(sys(seen[1].body)), 'Basar answers in English when asked in English, and helps with any topic');
  const quiz = await post(a.base, { mode: 'quiz', topic: 'nuuts', age: 9 });
  ok(quiz.ok && quiz.quiz.answer === 2 && quiz.quiz.options.length === 4, 'quiz returns 4 options and the right answer');
  ok(seen[2].body.output_config.format.type === 'json_schema', 'quiz uses structured JSON output');
  mode = 'refuse';
  const ref = await post(a.base, { mode: 'chat', messages: [{ role: 'user', content: 'x' }] });
  ok(!ref.ok && ref.reason === 'refusal', 'a refusal is reported so the app answers kindly');
  const blocked = await fetch(a.base + '/basar-ai.js').then((r) => r.status);
  ok(blocked === 404, 'server-side code is not downloadable');
} finally { a.child.kill(); }

const b = await start({ ANTHROPIC_API_KEY: '' });
try {
  const info = await fetch(b.base + '/api/basar').then((r) => r.json());
  const r = await post(b.base, { mode: 'chat', messages: [{ role: 'user', content: 'hi' }] });
  ok(info.ai === false && r.reason === 'nokey', 'without a key Basar falls back to offline mode');
} finally { b.child.kill(); }
// behind Render's proxy both AI limits (10 a minute and 30 a quarter hour) count the player's real address: Cloudflare's
// cf-connecting-ip, else the last forwarded one. Faking the first forwarded address doesn't help.
const c = await start({ RENDER: 'true', ANTHROPIC_API_KEY: 'secret-test-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${fake.address().port}` });
try {
  const ask = async (headers) => { const r = await fetch(c.base + '/api/basar', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ mode: 'chat', messages: [{ role: 'user', content: 'hi' }] }) }); return r.status === 200 ? (await r.json()).reason || 'ok' : r.status; };
  mode = 'normal';
  const got = [];
  for (let i = 0; i < 31; i++) got.push(await ask({ 'x-forwarded-for': `1.2.3.${i}, 9.9.9.9` }));
  ok(got.slice(0, 10).every((x) => x === 'ok') && got.slice(10, 30).every((x) => x === 'busy') && got[30] === 429, 'a faked first forwarded address gets around neither AI limit');
  ok(await ask({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }) === 'ok', 'another real address still gets answers');
  ok(await ask({ 'x-forwarded-for': '9.9.9.9', 'cf-connecting-ip': '5.5.5.5' }) === 'ok', "Cloudflare's address counts before the forwarded one");
} finally { c.child.kill(); }

fake.close();
if (fails.length) { console.error(`Basar API test failed: ${fails.length}`); process.exit(1); }
console.log('Basar API test passed.');
