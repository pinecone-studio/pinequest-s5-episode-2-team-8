/* Copies the content of the web version of Naadamy into the Unity project, so both always tell the same stories:
   - data (questions, lessons, provinces, facts…) as JSON in Assets/Resources/Data
   - pixel art that is drawn by the web version's own code (province trip maps, animals, Nomin…) as PNGs in Assets/Resources/Art
   Run it from the repo root after changing the web content:  node NaadamyUnity/Tools/export-web-data.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), { Canvas, toPNG } = require('./fakecanvas');
const root = path.resolve(__dirname, '..', '..'), out = path.join(__dirname, '..', 'Assets', 'Resources', 'Data'), art = path.join(__dirname, '..', 'Assets', 'Resources', 'Art');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(art, { recursive: true });

// a tiny stand-in for the browser, enough for the web files to run
const TG = { h: () => ({}), icon: () => ({}), L: (mn) => mn, tx: (t) => (t && t.mn) || t, pick: (a) => a[0], store: { state: { lang: 'mn', settings: {} }, active: () => null }, sfx: {} };
const element = () => ({ style: {}, dataset: {}, appendChild() {}, append() {}, addEventListener() {}, setAttribute() {}, replaceChildren() {}, classList: { add() {}, remove() {}, toggle() {} } });
const sandbox = {
  window: { TG }, TG, console, Math, Date, JSON, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  document: { readyState: 'loading', createElement: (t) => (t === 'canvas' ? new Canvas() : element()), addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, body: element() },
  MutationObserver: function () { this.observe = () => {}; }, CanvasRenderingContext2D: function () {},
  matchMedia: () => ({ matches: false }), location: { protocol: 'file:', search: '' }, navigator: {}, performance: { now: () => 0 }, devicePixelRatio: 1,
};
sandbox.self = sandbox.window; sandbox.window.matchMedia = sandbox.matchMedia; vm.createContext(sandbox);
/** Run a web file; `patch` can expose things the file keeps private. */
const load = (f, patch) => { let src = fs.readFileSync(path.join(root, f), 'utf8'); if (patch) src = patch(src); vm.runInContext(src, sandbox, { filename: f }); };
const save = (name, data) => { const s = JSON.stringify(data); fs.writeFileSync(path.join(out, name + '.json'), s); console.log('wrote', name + '.json', (s.length / 1024).toFixed(1) + ' KB'); };
/** Save a canvas as a PNG the game loads from Resources/Art (the .bytes ending makes Unity keep the file exactly as it is). */
let pngBytes = 0, pngCount = 0;
const savePng = (name, c) => { const b = toPNG(c); pngBytes += b.length; pngCount++; fs.writeFileSync(path.join(art, name + '.png.bytes'), b); };
// functions can't go to JSON: drop them (their logic is ported to C# by hand)
const plain = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x)));

load('js/basar/knowledge.js');
const B = TG.BASAR;
save('basar', plain({ TOPICS: B.TOPICS, QUIZ: B.QUIZ, FAQ: B.FAQ, FACTS: B.FACTS, SUGGEST: B.SUGGEST }));

load('js/seasons.js');
save('seasons', plain(TG.seasons.SEASONS));

TG.scenes = {}; // the lesson pictures are drawn by Scenes.cs
load('js/learn/lessons.js');
save('lessons', plain(TG.learn.LESSONS));

load('js/data.js');
save('people', plain({ STORY_PROMPTS: TG.STORY_PROMPTS }));
load('js/aimags.js');
load('js/ethnic.js');
load('js/passport.js');
save('aimags', plain({ AIMAGS: TG.aimags.AIMAGS, ETHNIC: TG.ethnic.ETHNIC, J: TG.passport.J, ORDER: TG.passport.ORDER }));
load('js/battles.js');
save('battles', plain(TG.battles.CHAPTERS));
load('js/history.js');
save('history', plain(TG.history.STEPS));
load('js/achievements.js');
save('achievements', plain({ LIST: TG.achievements.LIST, CATS: TG.achievements.CATS }));

// pixel icons: the 14×14 grids, palette and the emoji → icon table (icons.js draws them instead of emoji)
load('js/icons.js');
save('icons', plain({ PAL: TG.icons.PAL, SPR: TG.icons.SPR, EMOJI: TG.icons.EMOJI }));

// ---------------------------------------------------------------- pictures drawn by the web version's own code
load('js/village/rules.js');
TG.vrules = sandbox.window.TG.vrules || TG.vrules;
{ // building a ger by hand, Grandpa Craftsman's trades, what is learned by hand, and the wrestling moves told simply
  const R = TG.vrules;
  save('vrules', plain({ VERSION: R.VERSION, GER_STEPS: R.GER_STEPS, GER_NEEDS: R.GER_NEEDS, TRADES: R.TRADES, COVER_PRICE: R.COVER_PRICE, SHEAR_WOOL: R.SHEAR_WOOL,
    SHEAR_REGROW_MS: R.SHEAR_REGROW_MS, FELT_WOOL: R.FELT_WOOL, HANDS_ON: R.HANDS_ON, KID: Object.fromEntries(R.MOVES.map((m) => [m.id, m.kid])) }));
}
load('js/village/pixel.js');
load('js/landmarks.js');
load('js/travel.js', (src) => src.replace('TG.travel = { open, build,', 'TG.travel = { paint, ANIMAL, ANAME, open, build,'));

// a walkable map for every province: its ground with the three landmarks, the ger camp, the herder family, the ovoo…
const realSeason = TG.seasons.current, trips = {};
for (const id of TG.passport.ORDER) {
  const m = TG.travel.build(id);
  trips[id] = { g: m.g.map((r) => r.join('')), marks: m.marks.map((q) => ({ x: q.x, y: q.y, sx: q.sx, sy: q.sy, i: q.i, kind: q.kind })), guide: m.guide, start: m.start, herd: m.herd,
    district: m.district, lake: m.lake || null, desert: m.desert, snow: m.snow, city: m.city, det: m.det };
  for (const autumn of [false, true]) { // the trees turn gold in autumn
    TG.seasons.current = () => TG.seasons.byId(autumn ? 'autumn' : 'summer');
    savePng('trip_' + id + (autumn ? '_autumn' : ''), TG.travel.paint(m));
  }
}
TG.seasons.current = realSeason;
const T = TG.travel;
save('travel', plain({ trips, CAMP: T.CAMP, FAM: T.FAM, OVOO: T.OVOO, SIGN: T.SIGN, TS: T.TS, LW: T.LW, LH: T.LH, ANIMAL: T.ANIMAL, ANAME: T.ANAME }));
// the animals you meet on the trips, two frames each
for (const k of TG.landmarks.critters) for (const f of [0, 1]) savePng('critter_' + k + '_' + f, TG.landmarks.critter(k, f));

// Guide Nomin: her faces for the story box (8 expressions × mouth open × blinking, 48×48 each) and her full body in three poses
load('js/dialog.js');
load('js/nomin.js');
const EXPR = ['happy', 'laugh', 'wink', 'surprised', 'think', 'sad', 'proud', 'tease'];
{ const sheet = new Canvas(48 * 4, 48 * EXPR.length), x = sheet.getContext('2d');
  EXPR.forEach((e, r) => [[false, false], [true, false], [false, true], [true, true]].forEach(([open, blink], c) => x.drawImage(TG.guideFace(e, open, blink), c * 48, r * 48)));
  savePng('nomin_faces', sheet); }
{ const POSES = ['wait', 'bye', 'yay'], N = 16, W = TG.nomin.W, H = TG.nomin.H, sheet = new Canvas(W * N, H * POSES.length), x = sheet.getContext('2d');
  POSES.forEach((pose, r) => { for (let i = 0; i < N; i++) { const c = new Canvas(W, H); TG.nomin.drawNomin(c.getContext('2d'), (i / N) * 2 * Math.PI / 1.2, pose); x.drawImage(c, i * W, r * H); } });
  savePng('nomin_body', sheet); }
save('nomin', { W: TG.nomin.W, H: TG.nomin.H, frames: 16, poses: ['wait', 'bye', 'yay'], faces: EXPR, period: 2 * Math.PI / 1.2 });

// ---------------------------------------------------------------- the 3D worlds (js/fpworld.js): Нутаг and every province as voxels
// Each world is one gzipped file in Resources/World: X, Z, YS (int32), the blocks (X·YS·Z bytes, index (y·Z + z)·X + x),
// then the ground height of every column (int16, X·Z). Built in summer; Unity turns it to snow or autumn leaves itself.
// Нутаг's lots are left empty: the gers children build are added in Unity.
load('js/village/world.js');
load('js/fpworld.js');
{
  const zlib = require('zlib'), wdir = path.join(__dirname, '..', 'Assets', 'Resources', 'World'); fs.mkdirSync(wdir, { recursive: true });
  TG.seasons.current = () => TG.seasons.byId('summer');
  const WF = TG.fpworld, sprites = {}; let bytes = 0;
  const pack = (name, w) => {
    const top = new Int16Array(w.X * w.Z); for (let z = 0; z < w.Z; z++) for (let x = 0; x < w.X; x++) top[z * w.X + x] = w.groundAt(x, z);
    const head = Buffer.alloc(12); head.writeInt32LE(w.X, 0); head.writeInt32LE(w.Z, 4); head.writeInt32LE(w.YS, 8);
    const gz = zlib.gzipSync(Buffer.concat([head, Buffer.from(w.vox.buffer, w.vox.byteOffset, w.vox.length), Buffer.from(top.buffer)]), { level: 9 });
    fs.writeFileSync(path.join(wdir, name + '.bytes'), gz); bytes += gz.length;
    sprites[name] = (w.sprites || []).map((q) => ({ kind: q.kind, x: q.x, z: q.z }));
  };
  pack('village', WF.createVillage(TG.vworld, [], TG.vrules));
  for (const id of TG.passport.ORDER) pack(id, WF.create(TG.travel.build(id)));
  TG.seasons.current = realSeason;
  savePng('fp_atlas', WF.atlas());
  save('fpworld', plain({ TILE: WF.TILE, M: WF.M, G: WF.G, YS: WF.YS, BLOCKS: WF.BLOCKS.map((b) => b && { name: b.name, tex: b.tex, solid: b.solid, cut: b.cut, water: b.water }), B: WF.B, cloud: WF.tex.cloud, sprites }));
  console.log(`built ${Object.keys(sprites).length} 3D worlds, ${(bytes / 1024).toFixed(0)} KB`);
}

console.log(`rendered ${pngCount} pictures, ${(pngBytes / 1024).toFixed(0)} KB`);
