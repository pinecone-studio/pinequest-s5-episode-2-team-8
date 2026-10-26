/* Renders the Mongol script academy's letters and words with the web version's own layout() and drawGlyph() and the
   Noto Sans Mongolian font, in Microsoft Edge (headless), so Unity gets correctly shaped glyphs (Unity can't shape
   Mongol script). Output: Assets/Resources/Art/bichig_glyphs.png.bytes (a grid of 240×312 cells, black on white) and
   Assets/Resources/Data/bichig.json (the letters, their order and the grid).
   Run from the repo root:  node NaadamyUnity/Tools/render-bichig.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..', '..'), out = path.join(__dirname, '..', 'Assets', 'Resources');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!EDGE) { console.error('Needs Microsoft Edge or Google Chrome to render the Mongol script.'); process.exit(1); }

// the letters, from the web file itself
const TG = { h: () => ({}), L: (m) => m, tx: (t) => t.mn, store: {} };
const sb = { window: { TG }, TG, document: {}, console }; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root, 'js/bichig.js'), 'utf8'), sb);
const UNITS = TG.bichig.UNITS, ALL = TG.bichig.ALL, W = 240, H = 312, COLS = 7, ROWS = Math.ceil(ALL.length / COLS) + 1; // the last row: the unit icons
const icons = UNITS.map((u) => u.icon);

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bichig-'));
const fontUrl = 'file:///' + path.join(root, 'assets/fonts/NotoSansMongolian-Regular.ttf').split(path.sep).join('/');
const bichigUrl = 'file:///' + path.join(root, 'js/bichig.js').split(path.sep).join('/');
fs.writeFileSync(path.join(tmp, 'page.html'), `<!doctype html><meta charset="utf-8">
<style>@font-face{font-family:"Noto Sans Mongolian";src:url("${fontUrl}")} html,body{margin:0;background:#fff;overflow:hidden} canvas{position:absolute}</style>
<body><script>window.TG={h:()=>({}),L:(m)=>m,tx:(t)=>t.mn,store:{}};</script><script src="${bichigUrl}"></script>
<script>
(async () => {
  await document.fonts.load('40px "Noto Sans Mongolian"', 'ᠠᠮᠣᠩᠭᠣᠯ'); await document.fonts.ready;
  const texts = ${JSON.stringify(ALL.map((i) => i.g))}.concat(${JSON.stringify(icons)});
  texts.forEach((t, i) => {
    const c = document.createElement('canvas'); c.width = ${W}; c.height = ${H};
    c.style.left = (i % ${COLS}) * ${W} + 'px'; c.style.top = Math.floor(i / ${COLS}) * ${H} + 'px'; document.body.appendChild(c);
    const lay = TG.bichig.layout(t, ${W}, ${H}); if (lay) TG.bichig.drawGlyph(c.getContext('2d'), t, lay, ${W}, ${H}, '#000');
  });
  document.title = 'done';
})();
</script>`);
const shot = path.join(tmp, 'shot.png');
execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', '--virtual-time-budget=8000',
  `--window-size=${W * COLS},${H * ROWS}`, `--screenshot=${shot}`, 'file:///' + path.join(tmp, 'page.html').split(path.sep).join('/')], { stdio: 'ignore', timeout: 60000 });
fs.copyFileSync(shot, path.join(out, 'Art', 'bichig_glyphs.png.bytes'));
const plain = (v) => JSON.parse(JSON.stringify(v));
fs.writeFileSync(path.join(out, 'Data', 'bichig.json'), JSON.stringify({ W, H, COLS, UNITS: plain(UNITS).map((u) => ({ id: u.id, icon: u.icon, name: u.name, items: u.items.map((i) => i.id) })), ALL: plain(ALL), icons }));
console.log(`rendered ${ALL.length} letters and words + ${icons.length} icons with ${path.basename(EDGE)}`);
