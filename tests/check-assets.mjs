// Checks that every file the app references exists, and that every script is
// both loaded by index.html and cached by sw.js (so offline mode never breaks).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const read = (p) => readFileSync(join(root, p), 'utf8');
const problems = [];
const local = (u) => !/^(https?:|data:|#|mailto:)/.test(u);
// Normalize to forward slashes so comparisons work on Windows (path.join uses \)
const norm = (u) => u.replace(/^\.\//, '').replace(/\\/g, '/');

const html = read('index.html');
const htmlRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(local).map(norm);
for (const r of htmlRefs) if (!existsSync(join(root, r))) problems.push(`index.html references missing file: ${r}`);
for (const ext of html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)) problems.push(`index.html loads an external resource (breaks offline): ${ext[1]}`);

const sw = read('sw.js');
const swFiles = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => norm(m[1])).filter(Boolean);
for (const f of swFiles) if (f && !existsSync(join(root, f))) problems.push(`sw.js caches missing file: ${f}`);

const walk = (d) => readdirSync(join(root, d)).flatMap((n) => (statSync(join(root, d, n)).isDirectory() ? walk(join(d, n)) : [norm(join(d, n))]));
for (const js of walk('js').filter((f) => f.endsWith('.js'))) {
  if (!htmlRefs.includes(js)) problems.push(`${js} is not loaded by index.html`);
  if (!swFiles.includes(js)) problems.push(`${js} is not in the sw.js offline cache`);
}

const fontsCss = read('assets/fonts/fonts.css');
for (const m of fontsCss.matchAll(/url\('([^']+)'\)/g)) {
  const f = norm(join('assets/fonts', m[1]));
  if (!existsSync(join(root, f))) problems.push(`fonts.css references missing font: ${f}`);
  if (!swFiles.includes(f)) problems.push(`${f} is not in the sw.js offline cache`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) if (!existsSync(join(root, norm(icon.src)))) problems.push(`manifest icon missing: ${icon.src}`);

if (problems.length) { console.error('Asset check failed:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`Asset check passed: ${htmlRefs.length} page references, ${swFiles.length} cached files, all present.`);
