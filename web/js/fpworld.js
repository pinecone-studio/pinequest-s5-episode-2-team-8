/* First-person aimag trips, part 1: the voxel world. Block textures are painted in code as 16×16 pixel art,
   the province map (1 tile = 4×4 blocks) becomes hills, lakes, forests and mountains, and every landmark
   is built as a 3D model: Turtle Rock, the Chinggis Khaan statue, temples, stupas, gers you can walk into... */
(function (TG) {
  const TILE = 4, M = 16, G = 12, YS = 64;           // blocks per map tile, margin round the map, ground level, world height
  // ---------------------------------------------------------------- textures (16×16 each, on a 16×16 atlas)
  const hash = (x, y, s = 0) => { let n = x * 374761393 + y * 668265263 + s * 2147483647; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; };
  const TEX = [];                                     // name -> painter(x, X, Y)
  const T = (name, paint) => { TEX.push({ name, paint }); return TEX.length - 1; };
  const px = (x, X, Y, i, j, c) => { x.fillStyle = c; x.fillRect(X + i, Y + j, 1, 1); };
  const fill = (x, X, Y, c) => { x.fillStyle = c; x.fillRect(X, Y, 16, 16); };
  const noise = (cols, s, amt = 0.35) => (x, X, Y) => { fill(x, X, Y, cols[0]); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const r = hash(i, j, s); if (r < amt) px(x, X, Y, i, j, cols[1 + Math.floor((r / amt) * (cols.length - 1)) % (cols.length - 1)]); } };
  const t = {};
  t.grass = T('grass', noise(['#6aa83f', '#5c9a36', '#7cbc4a', '#4f8a2e'], 1, 0.5));
  t.grassSide = T('grassSide', (x, X, Y) => { noise(['#8c5a33', '#7a4d2a', '#a06a3e'], 2)(x, X, Y); for (let i = 0; i < 16; i++) { const d = 3 + Math.floor(hash(i, 9) * 3); for (let j = 0; j < d; j++) px(x, X, Y, i, j, j === d - 1 ? '#5c9a36' : '#6aa83f'); } });
  t.dirt = T('dirt', noise(['#8c5a33', '#7a4d2a', '#a06a3e', '#6b4220'], 3));
  t.stone = T('stone', noise(['#8a8a94', '#77778a', '#9d9da8', '#6a6a76'], 4, 0.45));
  t.sand = T('sand', noise(['#e2c48a', '#d4b070', '#eed6a2'], 5));
  t.snow = T('snow', noise(['#f4f8fc', '#e2ebf4', '#ffffff'], 6, 0.3));
  t.snowSide = T('snowSide', (x, X, Y) => { noise(['#8c5a33', '#7a4d2a'], 7)(x, X, Y); for (let i = 0; i < 16; i++) { const d = 3 + Math.floor(hash(i, 4) * 3); for (let j = 0; j < d; j++) px(x, X, Y, i, j, '#f4f8fc'); } });
  t.gravel = T('gravel', noise(['#a8a296', '#8f897e', '#bdb7aa', '#76716a'], 8, 0.6));
  t.path = T('path', noise(['#c99a5e', '#b78a4f', '#d8ab6c'], 9, 0.45));
  t.water = T('water', (x, X, Y) => { fill(x, X, Y, '#3a88c8'); for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i++) if (hash(i, j, 10) < 0.4) px(x, X, Y, i, j + (i % 2), '#5aa6e2'); });
  t.log = T('log', (x, X, Y) => { fill(x, X, Y, '#6b4220'); for (let i = 0; i < 16; i += 3) for (let j = 0; j < 16; j++) if (hash(i, j, 11) < 0.7) px(x, X, Y, i, j, '#4f3018'); });
  t.logTop = T('logTop', (x, X, Y) => { fill(x, X, Y, '#a46d3b'); x.strokeStyle = '#7a4d2a'; for (let r = 2; r < 8; r += 2) { x.strokeRect(X + 8 - r + 0.5, Y + 8 - r + 0.5, r * 2 - 1, r * 2 - 1); } });
  t.birch = T('birch', (x, X, Y) => { fill(x, X, Y, '#ece8dc'); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (hash(i >> 1, j, 12) < 0.12) px(x, X, Y, i, j, '#2b2a2e'); });
  const leaves = (cols, s) => (x, X, Y) => { x.clearRect(X, Y, 16, 16); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const r = hash(i, j, s); if (r < 0.88) px(x, X, Y, i, j, cols[Math.floor(r * 10) % cols.length]); } };
  t.leaves = T('leaves', leaves(['#3f8a3a', '#2f7030', '#4f9a44', '#2a6028'], 13));
  t.larch = T('larch', leaves(['#5aa04a', '#4a8a3c', '#6fb456', '#3f7a34'], 14));
  t.birchLeaves = T('birchLeaves', leaves(['#7cbc4a', '#6aa83f', '#94d260', '#5c9a36'], 15));
  t.autumn = T('autumn', leaves(['#e9b13a', '#d9963a', '#f2c45a', '#c97a2a'], 16));
  t.felt = T('felt', (x, X, Y) => { noise(['#f4efe3', '#e8e1d0', '#fbf8f1'], 17, 0.25)(x, X, Y); for (const j of [4, 10]) for (let i = 0; i < 16; i++) px(x, X, Y, i, j, i % 2 ? '#a8957a' : '#c2b296'); }); // canvas with a rope
  t.feltRoof = T('feltRoof', noise(['#f8f5ee', '#ece6d8', '#ffffff'], 18, 0.2));
  t.trim = T('trim', (x, X, Y) => { fill(x, X, Y, '#2b52a5'); for (let i = 0; i < 16; i += 4) { px(x, X, Y, i + 1, 7, '#ffffff'); px(x, X, Y, i + 2, 6, '#ffffff'); px(x, X, Y, i + 2, 8, '#ffffff'); px(x, X, Y, i + 3, 7, '#ffffff'); } for (let i = 0; i < 16; i++) { px(x, X, Y, i, 1, '#f7c646'); px(x, X, Y, i, 14, '#f7c646'); } });
  t.door = T('door', (x, X, Y) => { fill(x, X, Y, '#e8892b'); x.fillStyle = '#f7c646'; x.fillRect(X + 2, Y + 2, 12, 1); x.fillRect(X + 2, Y + 13, 12, 1); x.fillRect(X + 2, Y + 2, 1, 12); x.fillRect(X + 13, Y + 2, 1, 12); for (const [i, j] of [[7, 6], [8, 6], [6, 7], [9, 7], [6, 8], [9, 8], [7, 9], [8, 9]]) px(x, X, Y, i, j, '#2b52a5'); });
  t.orange = T('orange', (x, X, Y) => { noise(['#d9762b', '#c9692a', '#e8892b'], 19, 0.2)(x, X, Y); for (let i = 1; i < 16; i += 5) { px(x, X, Y, i, 4, '#2b52a5'); px(x, X, Y, i + 1, 4, '#f7c646'); px(x, X, Y, i, 11, '#2b52a5'); px(x, X, Y, i + 1, 11, '#f7c646'); } });
  t.plaster = T('plaster', noise(['#f2eee4', '#e8e2d4', '#fbf8f1'], 20, 0.2));
  t.red = T('red', noise(['#a8312a', '#962a24', '#b8382e'], 21, 0.25));
  t.greenTile = T('greenTile', (x, X, Y) => { fill(x, X, Y, '#2f7d5b'); for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i++) { px(x, X, Y, i, j, '#1d5a40'); if ((i + j) % 4 === 1) px(x, X, Y, i, j + 2, '#46a077'); } });
  t.gold = T('gold', noise(['#f7c646', '#e9a91f', '#fde08a'], 22, 0.3));
  t.window = T('window', (x, X, Y) => { fill(x, X, Y, '#e8dfc8'); x.fillStyle = '#4aa6e2'; x.fillRect(X + 3, Y + 3, 10, 10); x.fillStyle = '#93d4f6'; x.fillRect(X + 4, Y + 4, 3, 3); x.fillStyle = '#e8dfc8'; x.fillRect(X + 7, Y + 3, 1, 10); x.fillRect(X + 3, Y + 8, 10, 1); });
  t.concrete = T('concrete', noise(['#c9c1ad', '#b9b19d', '#d6cfbd'], 23, 0.25));
  t.concreteWin = T('concreteWin', (x, X, Y) => { noise(['#c9c1ad', '#b9b19d'], 24, 0.2)(x, X, Y); x.fillStyle = hash(X, Y, 1) < 0.3 ? '#f7c646' : '#4a7ab8'; x.fillRect(X + 4, Y + 4, 8, 8); x.fillStyle = '#93b4d6'; x.fillRect(X + 5, Y + 5, 2, 2); });
  t.granite = T('granite', noise(['#b0a090', '#9a8c7c', '#c4b6a6', '#8a7c6c', '#d0c2b2'], 25, 0.55));
  t.graniteDark = T('graniteDark', noise(['#8a7c6c', '#76695a', '#9a8c7c'], 26, 0.5));
  t.basalt = T('basalt', noise(['#4a3e3e', '#3a3030', '#5a4e4e'], 27, 0.5));
  t.ice = T('ice', noise(['#dcefff', '#c4e2fa', '#ffffff'], 28, 0.3));
  t.redRock = T('redRock', (x, X, Y) => { fill(x, X, Y, '#d8643a'); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (hash(i, j, 29) < 0.3) px(x, X, Y, i, j, j % 5 < 2 ? '#c4502a' : '#e2804a'); });
  t.whiteRock = T('whiteRock', (x, X, Y) => { fill(x, X, Y, '#f0e6d8'); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (hash(i, j, 30) < 0.3) px(x, X, Y, i, j, j % 6 < 2 ? '#f0c9b8' : '#e2d2c0'); });
  t.silver = T('silver', noise(['#c9ccd6', '#b4b8c4', '#e6e8ee', '#9a9eac'], 31, 0.35));
  t.iron = T('iron', noise(['#4a4a55', '#3a3a44', '#5d5d6b'], 32, 0.3));
  t.wheat = T('wheat', (x, X, Y) => { x.clearRect(X, Y, 16, 16); for (let i = 1; i < 16; i += 3) { const h0 = 6 + Math.floor(hash(i, 1, 33) * 8); for (let j = 16 - h0; j < 16; j++) px(x, X, Y, i, j, j < 16 - h0 + 3 ? '#e8c84a' : '#c9b34a'); } });
  t.farmland = T('farmland', (x, X, Y) => { fill(x, X, Y, '#6b4220'); for (let j = 1; j < 16; j += 4) { x.fillStyle = '#5a361a'; x.fillRect(X, Y + j, 16, 1); } });
  t.saxaul = T('saxaul', leaves(['#7f9a5a', '#6a8a4a', '#94ac6a'], 34));
  t.khadag = T('khadag', noise(['#5a86d6', '#3f76db', '#7fa6ee'], 35, 0.3));
  t.bronze = T('bronze', noise(['#8a6a3a', '#76582e', '#a07a44'], 36, 0.3));
  t.planks = T('planks', (x, X, Y) => { fill(x, X, Y, '#a46d3b'); x.fillStyle = '#7a4d2a'; for (let j = 3; j < 16; j += 4) x.fillRect(X, Y + j, 16, 1); for (let j = 0; j < 4; j++) x.fillRect(X + ((j * 7) % 16), Y + j * 4, 1, 3); });
  t.hide = T('hide', (x, X, Y) => { noise(['#e8dcc0', '#d8c8a8', '#c9b898'], 37, 0.35)(x, X, Y); for (let i = 0; i < 16; i++) px(x, X, Y, i, 7, '#a8957a'); });
  t.rail = T('rail', (x, X, Y) => { noise(['#8f897e', '#76716a'], 38, 0.5)(x, X, Y); x.fillStyle = '#6b4220'; for (let j = 1; j < 16; j += 4) x.fillRect(X, Y + j, 16, 2); x.fillStyle = '#9a9eac'; x.fillRect(X + 3, Y, 1, 16); x.fillRect(X + 12, Y, 1, 16); });
  t.train = T('train', (x, X, Y) => { fill(x, X, Y, '#2e8a5a'); x.fillStyle = '#f2eee4'; x.fillRect(X, Y + 2, 16, 2); x.fillStyle = '#93d4f6'; x.fillRect(X + 3, Y + 6, 10, 5); });
  t.yellow = T('yellow', noise(['#f7c646', '#e9b13a'], 39, 0.2));
  t.clay = T('clay', noise(['#b9a07a', '#a8906a', '#c9b08a'], 40, 0.4));
  t.cobble = T('cobble', (x, X, Y) => { fill(x, X, Y, '#77778a'); for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i += 4) { x.fillStyle = ['#a5a5b0', '#8a8a94', '#bdbdc8'][Math.floor(hash(i, j, 41) * 3)]; x.fillRect(X + i + ((j / 4) % 2) * 2, Y + j, 3, 3); } });
  t.reed = T('reed', (x, X, Y) => { x.clearRect(X, Y, 16, 16); for (let i = 1; i < 16; i += 3) { const h0 = 8 + Math.floor(hash(i, 2, 42) * 7); for (let j = 16 - h0; j < 16; j++) px(x, X, Y, i, j, '#357a28'); px(x, X, Y, i, 16 - h0, '#8a5a33'); px(x, X, Y, i, 17 - h0, '#8a5a33'); } });
  t.carpet = T('carpet', (x, X, Y) => { fill(x, X, Y, '#b8322a'); x.fillStyle = '#f7c646'; x.fillRect(X, Y, 16, 1); x.fillRect(X, Y + 15, 16, 1); for (let r = 0; r < 4; r++) { x.fillStyle = r % 2 ? '#f7c646' : '#2b52a5'; x.fillRect(X + 8 - r, Y + 4 + r, r * 2 + 1, 1); x.fillRect(X + 8 - r, Y + 11 - r, r * 2 + 1, 1); } });
  t.egg = T('egg', noise(['#f3e6c4', '#e2d2a8', '#fff6dc'], 43, 0.3));
  t.darkStone = T('darkStone', noise(['#5a4a4a', '#4a3e3e', '#6a5a5a'], 44, 0.5));
  t.white = T('white', noise(['#ffffff', '#f2f2f6', '#e8e8ee'], 45, 0.15));
  t.cloud = T('cloud', (x, X, Y) => fill(x, X, Y, '#ffffff'));
  t.saltwater = T('saltwater', (x, X, Y) => { fill(x, X, Y, '#4fb8c4'); for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i++) if (hash(i, j, 51) < 0.4) px(x, X, Y, i, j + (i % 2), '#86d0d6'); });
  t.saltcrust = T('saltcrust', noise(['#f4f2ea', '#e8e4d8', '#ffffff'], 52, 0.3));
  t.deepwater = T('deepwater', (x, X, Y) => { fill(x, X, Y, '#2b5aa8'); for (let j = 0; j < 16; j += 4) for (let i = 0; i < 16; i++) if (hash(i, j, 53) < 0.4) px(x, X, Y, i, j + (i % 2), '#4a7ac8'); });
  t.pine = T('pine', leaves(['#2c6a44', '#3f8a57', '#235a38'], 46));
  t.carving = T('carving', (x, X, Y) => { noise(['#8a6a5a', '#7a5a4a', '#9a7a6a'], 47, 0.4)(x, X, Y); x.fillStyle = '#e8d8c0'; x.fillRect(X + 3, Y + 6, 7, 2); x.fillRect(X + 3, Y + 8, 1, 4); x.fillRect(X + 9, Y + 8, 1, 4); x.fillRect(X + 9, Y + 3, 1, 3); x.fillRect(X + 10, Y + 2, 2, 1); });
  t.deerStone = T('deerStone', (x, X, Y) => { noise(['#a5a5b0', '#8a8a94'], 48, 0.4)(x, X, Y); x.strokeStyle = '#5a5a66'; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(X + 2, Y + 5 + k * 4); x.lineTo(X + 13, Y + 2 + k * 4); x.stroke(); } });
  t.shrine = T('shrine', (x, X, Y) => { fill(x, X, Y, '#a8312a'); x.fillStyle = '#f7c646'; x.fillRect(X + 3, Y + 3, 4, 6); x.fillStyle = '#ffffff'; x.fillRect(X + 9, Y + 3, 4, 5); x.fillStyle = '#9fd8f7'; x.fillRect(X + 10, Y + 4, 2, 2); });
  t.toono = T('toono', (x, X, Y) => { fill(x, X, Y, '#8fd0ff'); x.fillStyle = '#d9762b'; x.fillRect(X, Y, 16, 2); x.fillRect(X, Y + 14, 16, 2); x.fillRect(X, Y, 2, 16); x.fillRect(X + 14, Y, 2, 16); x.fillRect(X + 7, Y, 2, 16); x.fillRect(X, Y + 7, 16, 2); });
  t.flower = T('flower', (x, X, Y) => { x.clearRect(X, Y, 16, 16); for (const [i, c] of [[3, '#ff8fb1'], [8, '#ffd34e'], [12, '#ffffff']]) { for (let j = 9; j < 16; j++) px(x, X, Y, i, j, '#4f8a2e'); px(x, X, Y, i, 8, c); px(x, X, Y, i - 1, 8, c); px(x, X, Y, i + 1, 8, c); px(x, X, Y, i, 7, c); px(x, X, Y, i, 9, c); } });
  t.tallgrass = T('tallgrass', (x, X, Y) => { x.clearRect(X, Y, 16, 16); for (let i = 1; i < 16; i += 2) { const h0 = 5 + Math.floor(hash(i, 3, 60) * 8); for (let j = 16 - h0; j < 16; j++) px(x, X, Y, i, j, j < 16 - h0 + 2 ? '#7cbc4a' : '#5c9a36'); } });
  t.lantern = T('lantern', (x, X, Y) => { fill(x, X, Y, '#f7c646'); x.fillStyle = '#fff6c8'; x.fillRect(X + 4, Y + 4, 8, 8); x.fillStyle = '#2b1e2e'; x.fillRect(X, Y, 16, 2); x.fillRect(X, Y + 14, 16, 2); });
  t.lattice = T('lattice', (x, X, Y) => { fill(x, X, Y, '#efe1c3'); for (let i = 0; i < 16; i++) { px(x, X, Y, i, i, '#d9762b'); px(x, X, Y, 15 - i, i, '#d9762b'); px(x, X, Y, (i + 8) % 16, i, '#d9762b'); px(x, X, Y, (23 - i) % 16, i, '#d9762b'); } });

  // ---------------------------------------------------------------- blocks: [top, side, bottom], solid (you bump into it), cut (see-through pixels)
  const BLOCKS = [null];
  const B = {};
  const def = (name, top, side = top, bot = side, o = {}) => { B[name] = BLOCKS.length; BLOCKS.push({ name, tex: [top, side, bot], solid: o.solid !== false, cut: !!o.cut, water: !!o.water }); };
  def('grass', t.grass, t.grassSide, t.dirt); def('dirt', t.dirt); def('stone', t.stone); def('sand', t.sand); def('snow', t.snow, t.snowSide, t.dirt);
  def('gravel', t.gravel); def('path', t.path, t.dirt, t.dirt); def('water', t.water, t.water, t.water, { solid: false, water: true });
  def('log', t.logTop, t.log, t.logTop); def('birch', t.logTop, t.birch, t.logTop);
  def('leaves', t.leaves, t.leaves, t.leaves, { cut: true }); def('larch', t.larch, t.larch, t.larch, { cut: true }); def('birchLeaves', t.birchLeaves, t.birchLeaves, t.birchLeaves, { cut: true });
  def('autumn', t.autumn, t.autumn, t.autumn, { cut: true }); def('pine', t.pine, t.pine, t.pine, { cut: true });
  def('felt', t.feltRoof, t.felt, t.feltRoof); def('feltRoof', t.feltRoof, t.feltRoof, t.orange); // from inside, the roof shows its orange poles
  def('trim', t.trim); def('door', t.orange, t.door, t.orange); def('orange', t.orange);
  def('plaster', t.plaster); def('red', t.red); def('greenTile', t.greenTile); def('gold', t.gold); def('window', t.plaster, t.window, t.plaster);
  def('concrete', t.concrete); def('concreteWin', t.concrete, t.concreteWin, t.concrete); def('granite', t.granite); def('graniteDark', t.graniteDark); def('basalt', t.basalt);
  def('ice', t.ice); def('redRock', t.redRock); def('whiteRock', t.whiteRock); def('silver', t.silver); def('iron', t.iron);
  def('wheat', t.wheat, t.wheat, t.wheat, { solid: false, cut: true }); def('farmland', t.farmland, t.dirt, t.dirt); def('saxaul', t.saxaul, t.saxaul, t.saxaul, { cut: true });
  def('khadag', t.khadag); def('steel', t.iron, t.iron, t.iron); def('bronze', t.bronze); def('planks', t.planks); def('hide', t.hide); def('rail', t.rail, t.gravel, t.gravel); def('train', t.iron, t.train, t.iron);
  def('yellow', t.yellow); def('clay', t.clay); def('cobble', t.cobble); def('reed', t.reed, t.reed, t.reed, { solid: false, cut: true }); def('carpet', t.carpet, t.red, t.red);
  def('egg', t.egg); def('darkStone', t.darkStone); def('white', t.white); def('cloud', t.cloud); def('carving', t.carving); def('deerStone', t.deerStone);
  def('saltwater', t.saltwater, t.saltwater, t.saltwater, { solid: false, water: true }); def('deepwater', t.deepwater, t.deepwater, t.deepwater, { solid: false, water: true }); def('saltcrust', t.saltcrust, t.saltcrust, t.dirt);
  def('flower', t.flower, t.flower, t.flower, { solid: false, cut: true }); def('tallgrass', t.tallgrass, t.tallgrass, t.tallgrass, { solid: false, cut: true }); def('lantern', t.lantern);
  def('shrine', t.orange, t.shrine, t.orange); def('toono', t.toono, t.orange, t.toono); def('lattice', t.feltRoof, t.lattice, t.feltRoof);

  let atlasCache = null;
  function atlas() {
    if (atlasCache) return atlasCache;
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    TEX.forEach((tx, i) => tx.paint(x, (i % 16) * 16, Math.floor(i / 16) * 16));
    return (atlasCache = c);
  }

  // ---------------------------------------------------------------- the world
  function create(map, opts) {
    const MWt = map.g[0].length, MHt = map.g.length, X = MWt * TILE + M * 2, Z = MHt * TILE + M * 2;
    const vox = new Uint8Array(X * YS * Z), top = new Int16Array(X * Z);
    const idx = (x, y, z) => (y * Z + z) * X + x;
    const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < X && y < YS && z < Z;
    const set = (x, y, z, b) => { if (b === undefined) throw new Error('fpworld: unknown block type'); x = Math.round(x); y = Math.round(y); z = Math.round(z); if (inside(x, y, z)) vox[idx(x, y, z)] = b; };
    const get = (x, y, z) => (inside(x, y, z) ? vox[idx(x, y, z)] : 0);
    const box = (x0, y0, z0, x1, y1, z1, b) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, z, b); };
    const ellipsoid = (cx, cy, cz, rx, ry, rz, b, keep) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (d <= 1 && (!keep || !get(x, y, z))) set(x, y, z, typeof b === 'function' ? b(x, y, z, d) : b); } };
    const cyl = (cx, cz, r, y0, y1, b, hollow) => { for (let y = y0; y <= y1; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, z - cz); if (d <= r + 0.2 && (!hollow || d > r - 1.5)) set(x, y, z, typeof b === 'function' ? b(x, y, z) : b); } };
    const cone = (cx, cz, r0, y0, hgt, b) => { for (let k = 0; k < hgt; k++) { const r = r0 * (1 - k / hgt); cyl(cx, cz, Math.max(0.4, r), y0 + k, y0 + k, typeof b === 'function' ? (x, y, z) => b(x, y, z, k) : b); } };
    const has = map.has, desert = map.desert, snow = map.snow || (TG.seasons && TG.seasons.current().id === 'winter'), autumn = TG.seasons && TG.seasons.current().id === 'autumn';
    const groundTop = desert ? B.sand : snow ? B.snow : B.grass;
    const tileAt = (bx, bz) => { const tx = Math.floor((bx - M) / TILE), ty = Math.floor((bz - M) / TILE); return map.g[ty] && map.g[ty][tx] !== undefined ? map.g[ty][tx] : null; };
    const near = (bx, bz, r, cs) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const c = tileAt(bx + dx, bz + dz); if (c && cs.includes(c)) return true; } return false; };
    const smooth = (x, z, s) => { const fx = x / s, fz = z / s, x0 = Math.floor(fx), z0 = Math.floor(fz), u = fx - x0, v = fz - z0, a = hash(x0, z0, 7), b2 = hash(x0 + 1, z0, 7), c = hash(x0, z0 + 1, 7), d = hash(x0 + 1, z0 + 1, 7), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b2 - a) * su + (c - a) * sv + (a - b2 - c + d) * su * sv; };
    const column = (x, z, h, topB, under) => { for (let y = 0; y < h; y++) set(x, y, z, y === h - 1 ? topB : y > h - 4 ? under : B.stone); };
    // 1) ground for every column
    for (let z = 0; z < Z; z++) for (let x = 0; x < X; x++) {
      const tl = tileAt(x, z);
      if (tl === null || tl === 'm' || (tl === 't' && has('forest') && (x < M + TILE || z < M + TILE || x >= X - M - TILE || z >= Z - M - TILE))) {
        // the hills and mountains all round the province (and the map's own mountain border)
        const ex = Math.max(0, M + TILE - x, x - (X - M - TILE - 1)), ez = Math.max(0, M + TILE - z, z - (Z - M - TILE - 1)), e = Math.max(ex, ez);
        const mountains = has('mountains') || snow || tl === 'm', ramp = Math.min(1, e / 12), hgt = G + Math.round(1 + e * (mountains ? 0.55 : 0.25) + smooth(x, z, 9) * (mountains ? 16 : 5) * ramp + smooth(x, z, 4) * 2.5 * ramp);
        const h2 = Math.min(YS - 4, hgt), capped = h2 > G + 15;
        column(x, z, h2, capped || (snow && h2 > G + 6) ? B.snow : desert ? B.sand : h2 > G + 10 ? B.stone : B.grass, desert ? B.sand : mountains && h2 > G + 8 ? B.stone : B.dirt);
        if (!desert && !capped && h2 < G + 9 && hash(x, z, 3) < (has('forest') ? 0.05 : 0.008)) tree(x, h2, z, map.det.trees);
        top[z * X + x] = h2; continue;
      }
      let h = G, tb = groundTop, under = desert ? B.sand : B.dirt;
      if (tl === 'p') { tb = map.city ? B.gravel : desert ? B.path : B.path; }
      else if (tl === 'w') { h = G - 4; tb = B.sand; under = B.sand; }
      else if (map.lake && map.lake.salt && near(x, z, 1, 'w')) tb = B.saltcrust;   // the white salt crust round a salt lake
      else if (tl === 'f') tb = B.farmland;
      else if (tl === 's') h = G + Math.round(smooth(x, z, 3) * 2.4);
      else if (tl === 'g' && !near(x, z, 2, 'pLGOwb')) h = G + (smooth(x, z, 6) > 0.62 ? 1 : 0) + (smooth(x, z, 11) > 0.8 ? 1 : 0);   // gentle grassy rises
      column(x, z, h, tb, under);
      if (tl === 'w') { const wb = map.lake && map.lake.salt ? B.saltwater : map.id === 'khuvsgul' ? B.deepwater : B.water; for (let y = G - 4; y < G; y++) set(x, y, z, wb); }   // water: four blocks deep, its surface level with the shore so you see it from afar
      if (tl === 'f') set(x, G, z, B.wheat);
      top[z * X + x] = tl === 'w' ? G - 4 : h;
    }
    const groundAt = (x, z) => top[Math.round(z) * X + Math.round(x)] || G;
    // reeds on the lake shores
    for (let z = M; z < Z - M; z++) for (let x = M; x < X - M; x++) if (tileAt(x, z) === 'w' && hash(x, z, 5) < 0.12 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tileAt(x + dx, z + dz) !== 'w')) set(x, G - 1, z, B.reed);

    // 2) things on the tiles: trees, rocks, shrubs, city blocks
    function tree(x, y, z, kind) {
      if (kind === 'birch') { box(x, y, z, x, y + 4, z, B.birch); ellipsoid(x, y + 5, z, 2, 2.2, 2, autumn ? B.autumn : B.birchLeaves, true); return; }
      if (kind === 'poplar') { box(x, y, z, x, y + 3, z, B.log); ellipsoid(x, y + 6, z, 1.6, 3.4, 1.6, autumn ? B.autumn : B.leaves, true); return; }
      if (kind === 'larch' || has('forest') || snow) { box(x, y, z, x, y + 6, z, B.log); for (let k = 0; k < 6; k++) cyl(x, z, Math.max(0.5, 2.6 - k * 0.45), y + 2 + k, y + 2 + k, kind === 'larch' ? (autumn ? B.autumn : B.larch) : B.pine); set(x, y + 8, z, kind === 'larch' ? (autumn ? B.autumn : B.larch) : B.pine); return; }
      box(x, y, z, x, y + 3, z, B.log); ellipsoid(x, y + 4.5, z, 2.2, 2, 2.2, B.leaves, true);
    }
    for (let ty = 0; ty < MHt; ty++) for (let tx = 0; tx < MWt; tx++) {
      const c = map.g[ty][tx], bx = M + tx * TILE, bz = M + ty * TILE, cx = bx + 1.5, cz = bz + 1.5, y = groundAt(cx, cz);
      if (c === 't' && !(tx === 0 || ty === 0 || tx === MWt - 1 || ty === MHt - 1)) tree(Math.round(cx), y, Math.round(cz), map.det.trees);
      else if (c === 'r') ellipsoid(cx, G + 0.5, cz, 1.8, 1.4, 1.6, desert ? B.redRock : map.has('volcano') ? B.darkStone : B.stone);
      else if (c === 'z') { box(Math.round(cx), G, Math.round(cz), Math.round(cx), G + 1, Math.round(cz), B.log); ellipsoid(cx, G + 2, cz, 1.5, 1, 1.5, B.saxaul, true); }
      else if (c === 'b') { const hgt = 8 + Math.floor(hash(tx, ty, 9) * 9); box(bx, G, bz, bx + 3, G + hgt, bz + 3, B.concrete); for (let yy = G + 1; yy < G + hgt; yy += 2) for (let k = 0; k <= 3; k++) { set(bx + k, yy, bz + 3, B.concreteWin); set(bx + k, yy, bz, B.concreteWin); set(bx, yy, bz + k, B.concreteWin); set(bx + 3, yy, bz + k, B.concreteWin); } box(bx, G + hgt, bz, bx + 3, G + hgt, bz + 3, B.gravel); }
    }

    // 3) gers (walk inside!), the ovoo, the welcome board, the bus stop
    const sprites = [];                                 // extra animals/people standing at landmarks: { kind, x, z }
    function ger(cx, cz, r, opts = {}) {
      const y0 = G, wallTop = y0 + 1, peak = y0 + 2 + Math.max(1, Math.round(r * 0.75));
      box(Math.floor(cx - r), y0 - 1, Math.floor(cz - r), Math.ceil(cx + r), y0 - 1, Math.ceil(cz + r), B.planks);
      cyl(cx, cz, r, y0, wallTop, B.felt, true);                                   // the lattice walls under felt and canvas
      cyl(cx, cz, r, wallTop, wallTop, B.trim, true);                              // the patterned band at the top of the wall
      cyl(cx, cz, r - 1.6, y0, wallTop, 0);                                        // hollow inside (walls thick enough to have no gaps)
      cyl(cx, cz, r - 1.2, y0 - 1, y0 - 1, B.carpet);                              // carpets on the floor
      for (let k = 0; peak - k > wallTop; k++) { const rr = Math.max(0.6, (r + 0.3) * ((k + 1) / (peak - wallTop))); cyl(cx, cz, rr, peak - k, peak - k, B.feltRoof); }   // a low cone roof with a small eave
      set(cx, peak, cz, B.toono);
      set(cx + (r >= 3 ? 1 : 0), peak + 1, cz, B.iron);                            // the stovepipe beside the toono
      const dz = Math.round(cz + r);                                               // the door faces south
      for (const z of [dz, dz - 1]) { set(cx, y0, z, 0); set(cx, y0 + 1, z, 0); }  // the doorway: walk in
      set(cx + 1, y0, dz, B.door); set(cx + 1, y0 + 1, dz, B.door);                // the painted door, swung open
      if (r >= 3) {
        set(cx, y0, cz, B.iron); for (let y = y0 + 1; y < peak; y++) set(cx + (y > y0 + 1 ? 1 : 0), y, cz, B.iron); // the stove and its pipe up to the roof
        for (const dx of [-1, 1]) for (let y = y0; y < peak; y++) set(cx + dx, y, cz - 1, B.orange);       // the two painted bagana posts beside the stove
        set(cx - 1, y0, Math.round(cz - r + 2), B.shrine); set(cx + 1, y0, Math.round(cz - r + 2), B.shrine); set(cx, y0, Math.round(cz - r + 2), B.orange); // khoimor: chests and shrine
        box(Math.round(cx - r + 1.6), y0, Math.round(cz - 1), Math.round(cx - r + 1.6), y0, Math.round(cz + 1), B.orange); // beds west and east
        box(Math.round(cx + r - 1.6), y0, Math.round(cz - 1), Math.round(cx + r - 1.6), y0, Math.round(cz + 1), B.orange);
        set(cx, y0, cz - 2, B.planks);                                             // the low table in front of the khoimor
      }
      if (opts.fence) { const x0 = Math.floor(cx - r - 1.5), x1 = Math.ceil(cx + r + 1.5), z0 = Math.floor(cz - r - 1.5), z1 = Math.ceil(cz + r + 1.5); for (let x = x0; x <= x1; x++) { set(x, G, z0, B.planks); if (Math.abs(x - cx) > 1.5) set(x, G, z1, B.planks); } for (let z = z0; z <= z1; z++) { set(x0, G, z, B.planks); set(x1, G, z, B.planks); } }
    }
    const tc = (tile, n) => M + tile * TILE + Math.floor((n * TILE) / 2);           // centre of an n-tile area, in whole blocks
    const TR = TG.travel;
    TR.CAMP.forEach((cp) => ger(tc(cp.x, 3), tc(cp.y, 3) - 1, 4));
    ger(tc(TR.FAM.x, 3), tc(TR.FAM.y, 3) - 1, 4, { fence: true });
    (map.district || []).forEach((d) => ger(tc(d.x, 1), tc(d.y, 1), 1.6));
    { const ox = tc(TR.OVOO.x, 2), oz = tc(TR.OVOO.y, 2); cone(ox, oz, 3.2, G, 4, (x, y, z, k) => (hash(x, y + z, 2) < 0.5 ? B.cobble : B.stone)); box(ox, G + 4, oz, ox, G + 8, oz, B.log); set(ox + 1, G + 7, oz, B.khadag); set(ox - 1, G + 6, oz, B.khadag); set(ox, G + 6, oz + 1, B.white); }
    { const sx = M + TR.SIGN.x * TILE + 1, sz = M + TR.SIGN.y * TILE; box(sx, G, sz, sx, G + 1, sz, B.log); box(sx - 1, G + 2, sz, sx + 1, G + 3, sz, B.planks); }
    { const bx = M + map.start.x * TILE, bz = M + map.start.y * TILE - 1; box(bx, G, bz, bx, G + 2, bz, B.iron); box(bx - 1, G + 3, bz, bx + 1, G + 3, bz, B.khadag); }

    // 4) the landmarks, each as a 3D model in its 16×12 block lot
    for (const mk of map.marks) {
      const LWb = (TG.travel.LW || 4) * TILE, LHb = (TG.travel.LH || 3) * TILE, x0 = M + mk.sx * TILE, z0 = M + mk.sy * TILE, cx = x0 + (LWb >> 1), cz = z0 + (LHb >> 1);
      const L = LAND[mk.kind] || LAND.sacredmtn;
      L({ id: map.id, x0, z0, cx, cz, x1: x0 + LWb - 1, z1: z0 + LHb - 1, G, B, set, get, box, ellipsoid, cyl, cone, tree: (x, z, k) => tree(x, G, z, k || map.det.trees), hash, ger, add: (kind, x, z) => sprites.push({ kind, x, z }) });
    }
    return { X, Z, YS, vox, idx, get, set, groundAt, sprites, M, TILE, G, BLOCKS, B };
  }

  // ---------------------------------------------------------------- Нутаг in 3D: the village map (1 tile = 4×4 blocks)
  function createVillage(WD, lots, R) {
    const Wt = WD.W, Ht = WD.H, X = Wt * TILE + M * 2, Z = Ht * TILE + M * 2;
    const vox = new Uint8Array(X * YS * Z), top = new Int16Array(X * Z);
    const idx = (x, y, z) => (y * Z + z) * X + x, inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < X && y < YS && z < Z;
    const set = (x, y, z, b) => { if (b === undefined) throw new Error('fpworld: unknown block type'); x = Math.round(x); y = Math.round(y); z = Math.round(z); if (inside(x, y, z)) vox[idx(x, y, z)] = b; };
    const get = (x, y, z) => (inside(x, y, z) ? vox[idx(x, y, z)] : 0);
    const box = (x0, y0, z0, x1, y1, z1, b) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, z, b); };
    const ellipsoid = (cx, cy, cz, rx, ry, rz, b, keep) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (d <= 1 && (!keep || !get(x, y, z))) set(x, y, z, typeof b === 'function' ? b(x, y, z) : b); } };
    const cyl = (cx, cz, r, y0, y1, b, hollow) => { for (let y = y0; y <= y1; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, z - cz); if (d <= r + 0.2 && (!hollow || d > r - 1.5)) set(x, y, z, typeof b === 'function' ? b(x, y, z) : b); } };
    const cone = (cx, cz, r0, y0, hgt, b) => { for (let k = 0; k < hgt; k++) cyl(cx, cz, Math.max(0.4, r0 * (1 - k / hgt)), y0 + k, y0 + k, typeof b === 'function' ? (x, y, z) => b(x, y, z, k) : b); };
    const tileAt = (bx, bz) => { const tx = Math.floor((bx - M) / TILE), ty = Math.floor((bz - M) / TILE); return WD.g[ty] && WD.g[ty][tx] !== undefined ? WD.g[ty][tx] : null; };
    const snow = TG.seasons && TG.seasons.current().id === 'winter', autumn = TG.seasons && TG.seasons.current().id === 'autumn';
    const smooth = (x, z, s) => { const fx = x / s, fz = z / s, x0 = Math.floor(fx), z0 = Math.floor(fz), u = fx - x0, v = fz - z0, a = hash(x0, z0, 7), b2 = hash(x0 + 1, z0, 7), c = hash(x0, z0 + 1, 7), d = hash(x0 + 1, z0 + 1, 7), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b2 - a) * su + (c - a) * sv + (a - b2 - c + d) * su * sv; };
    const column = (x, z, h, topB, under) => { for (let y = 0; y < h; y++) set(x, y, z, y === h - 1 ? topB : y > h - 4 ? under : B.stone); };
    // ground, water, roads and the hills round the village
    for (let z = 0; z < Z; z++) for (let x = 0; x < X; x++) {
      const tl = tileAt(x, z);
      if (tl === null || ((tl === 'T') && (x < M + TILE * 2 || z < M + TILE * 2 || x >= X - M - TILE || z >= Z - M - TILE))) {
        const ex = Math.max(0, M + TILE - x, x - (X - M - TILE - 1)), ez = Math.max(0, M + TILE - z, z - (Z - M - TILE - 1)), e = Math.max(ex, ez), ramp = Math.min(1, e / 12);
        const h = G + Math.round(1 + e * 0.4 + smooth(x, z, 9) * 10 * ramp + smooth(x, z, 4) * 2 * ramp), hh = Math.min(YS - 4, h);
        column(x, z, hh, snow || hh > G + 12 ? B.snow : hh > G + 9 ? B.stone : B.grass, B.dirt); top[z * X + x] = hh;
        if (hh < G + 8 && hash(x, z, 3) < 0.04) villageTree(x, hh, z, hash(x, z, 9) > 0.6);
        continue;
      }
      let h = G, tb = snow ? B.snow : B.grass;
      if (tl === 'p') tb = B.path; else if (tl === 's') tb = B.cobble; else if (tl === 'a') tb = B.sand; else if (tl === 'k') tb = B.path;
      if (tl === 'w' || tl === 'd') { h = G - 4; tb = B.sand; }
      column(x, z, h, tb, tl === 'a' ? B.sand : B.dirt);
      if (tl === 'w' || tl === 'd') for (let y = G - 4; y < G; y++) set(x, y, z, B.water);
      if (tl === 'd') set(x, G - 1, z, B.planks);
      top[z * X + x] = h;
      if ((tl === 'g') && hash(x, z, 11) < 0.04) set(x, G, z, B.flower);          // wildflowers
      if (tl === 'g' && hash(x, z, 12) < 0.05) set(x, G, z, B.tallgrass);
    }
    function villageTree(x, y, z, pine) {
      if (pine) { box(x, y, z, x, y + 5, z, B.log); for (let k = 0; k < 5; k++) cyl(x, z, Math.max(0.5, 2.4 - k * 0.45), y + 2 + k, y + 2 + k, B.pine); set(x, y + 7, z, B.pine); return; }
      box(x, y, z, x, y + 3, z, B.log); ellipsoid(x, y + 4.5, z, 2.3, 2, 2.3, autumn ? B.autumn : B.leaves, true);
    }
    const c = (o) => [M + o.x * TILE, M + o.y * TILE];                                   // an object’s top-left corner in blocks
    for (const t of WD.trees) if (t.x > 1 && t.y > 1 && t.x < Wt - 2 && t.y < Ht - 2) villageTree(M + t.x * TILE + 2, G, M + t.y * TILE + 2, t.pine);
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      const ch = WD.g[ty][tx], bx = M + tx * TILE, bz = M + ty * TILE;
      if (ch === 'r') ellipsoid(bx + 2, G + 0.4, bz + 2, 1.6, 1.2, 1.4, B.stone);
      if (ch === 'f') { const nb = (dx, dy) => (WD.g[ty + dy] || [])[tx + dx] === 'f'; set(bx + 2, G, bz + 2, B.log); if (nb(1, 0)) box(bx + 2, G, bz + 2, bx + 4, G, bz + 2, B.planks); if (nb(0, 1)) box(bx + 2, G, bz + 2, bx + 2, G, bz + 4, B.planks); set(bx + 2, G + 1, bz + 2, B.log); }
    }
    // a ger like the real thing (walkable inside); door to the south
    function ger(cx, cz, r, roofB) {
      const y0 = G, wallTop = y0 + 1, peak = y0 + 2 + Math.max(1, Math.round(r * 0.75));
      box(Math.floor(cx - r), y0 - 1, Math.floor(cz - r), Math.ceil(cx + r), y0 - 1, Math.ceil(cz + r), B.planks);
      cyl(cx, cz, r, y0, wallTop, B.felt, true); cyl(cx, cz, r, wallTop, wallTop, roofB || B.trim, true); cyl(cx, cz, r - 1.6, y0, wallTop, 0); cyl(cx, cz, r - 1.2, y0 - 1, y0 - 1, B.carpet);
      for (let k = 0; peak - k > wallTop; k++) cyl(cx, cz, Math.max(0.6, (r + 0.3) * ((k + 1) / (peak - wallTop))), peak - k, peak - k, B.feltRoof);
      set(cx, peak, cz, B.toono); set(cx + 1, peak + 1, cz, B.iron);
      const dz = Math.round(cz + r); for (const z of [dz, dz - 1]) { set(cx, y0, z, 0); set(cx, y0 + 1, z, 0); } set(cx + 1, y0, dz, B.door); set(cx + 1, y0 + 1, dz, B.door);
      set(cx, y0, cz, B.iron); for (const dx of [-1, 1]) box(cx + dx, y0, cz - 1, cx + dx, peak - 1, cz - 1, B.orange);
    }
    const ROOFB = { blue: B.trim, red: B.red, green: B.greenTile, purple: B.trim, orange: B.orange, teal: B.trim };
    for (const o of WD.objects) {
      const [x0, z0] = c(o), w = o.w * TILE, d = o.h * TILE, cx = x0 + (w >> 1), cz = z0 + (d >> 1);
      switch (o.kind) {
        case 'ger': ger(cx, cz - 1, 4); break;
        case 'shop': { for (let x = x0 + 1; x < x0 + w - 1; x++) box(x, G, z0 + 2, x, G + 3, z0 + d - 3, ((x - x0) >> 1) % 2 ? B.red : B.white); box(x0 + 1, G + 4, z0 + 1, x0 + w - 2, G + 4, z0 + d - 2, B.red); box(x0 + 3, G + 5, z0 + 3, x0 + w - 4, G + 5, z0 + d - 4, B.red); box(x0 + 2, G, z0 + d - 2, x0 + w - 3, G, z0 + d - 2, B.planks); for (let x = x0 + 3; x < x0 + w - 3; x += 3) set(x, G + 1, z0 + d - 2, [B.yellow, B.red, B.white][x % 3]); box(cx - 1, G, z0 + d - 3, cx, G + 2, z0 + d - 3, 0); break; }
        case 'board': box(x0 + 1, G, z0 + 2, x0 + 1, G + 2, z0 + 2, B.log); box(x0 + w - 2, G, z0 + 2, x0 + w - 2, G + 2, z0 + 2, B.log); box(x0 + 1, G + 3, z0 + 2, x0 + w - 2, G + 4, z0 + 2, B.planks); set(x0 + 3, G + 3, z0 + 3, B.white); set(x0 + 5, G + 4, z0 + 3, B.white); break;
        case 'well': cyl(cx, cz, 1.6, G, G, B.cobble, true); set(cx, G - 1, cz, B.water); box(cx - 2, G, cz, cx - 2, G + 3, cz, B.log); box(cx + 2, G, cz, cx + 2, G + 3, cz, B.log); box(cx - 2, G + 4, cz - 1, cx + 2, G + 4, cz + 1, B.red); break;
        case 'lantern': box(cx, G, cz, cx, G + 3, cz, B.log); set(cx, G + 4, cz, B.lantern); break;
        case 'lot': { const i = o.i, l = lots && lots[i]; if (l) ger(cx, cz - 1, 4, ROOFB[l.roof] || B.trim); else { box(x0 + 1, G - 1, z0 + 1, x0 + w - 2, G - 1, z0 + d - 2, B.path); box(cx, G, z0 + d - 2, cx, G + 2, z0 + d - 2, B.log); box(cx - 1, G + 3, z0 + d - 2, cx + 1, G + 3, z0 + d - 2, B.planks); } break; }
        case 'bleachers': for (let k = 0; k < 3; k++) box(x0, G + k, z0 + k, x0 + w - 1, G + k, z0 + d - 1 + 2, B.planks); for (let x = x0; x < x0 + w; x += 6) { box(x, G + 3, z0 + 2, x, G + 7, z0 + 2, B.log); set(x + 1, G + 7, z0 + 2, [B.khadag, B.red, B.yellow][(x >> 1) % 3]); } break;
        case 'ovoo': cone(cx, cz, 3.4, G, 4, (x, y, z) => (hash(x, y + z, 2) < 0.5 ? B.cobble : B.stone)); box(cx, G + 4, cz, cx, G + 8, cz, B.log); set(cx + 1, G + 7, cz, B.khadag); set(cx - 1, G + 6, cz, B.khadag); break;
        case 'uya': box(x0 + 1, G, cz, x0 + 1, G + 2, cz, B.log); box(x0 + w - 2, G, cz, x0 + w - 2, G + 2, cz, B.log); box(x0 + 1, G + 2, cz, x0 + w - 2, G + 2, cz, B.planks); break;
        case 'archery': for (let x = x0 + 2; x < x0 + w - 2; x++) box(x, G, z0 + 1, x, G + (x % 4 === 0 ? 1 : 0), z0 + 1, x % 3 ? B.red : B.white); box(x0, G - 1, z0, x0 + w - 1, G - 1, z0 + d - 1, B.path); break;
        case 'academy': box(x0 + 1, G, z0 + 3, x0 + w - 2, G + 4, z0 + d - 2, B.plaster); for (let x = x0 + 2; x < x0 + w - 2; x += 3) box(x, G, z0 + d - 2, x, G + 4, z0 + d - 2, B.red); for (let k = 0; k < 3; k++) box(x0 + k, G + 5 + k, z0 + 1 + k, x0 + w - 1 - k, G + 5 + k, z0 + d - 1 - k, B.greenTile); box(cx - 1, G, z0 + d - 2, cx, G + 2, z0 + d - 2, B.door); set(cx, G + 8, cz, B.gold); break;
        case 'zel': box(x0 + 1, G, cz, x0 + 1, G + 1, cz, B.log); box(x0 + w - 2, G, cz, x0 + w - 2, G + 1, cz, B.log); box(x0 + 1, G + 1, cz, x0 + w - 2, G + 1, cz, B.planks); break;
        case 'churn': box(cx, G, cz, cx, G, cz, B.planks); set(cx, G + 1, cz, B.bronze); set(cx, G + 2, cz, B.log); break;
        case 'tulga': set(cx, G, cz, B.iron); set(cx, G + 1, cz, B.silver); break;
        case 'rack': box(x0 + 1, G, cz, x0 + 1, G + 2, cz, B.log); box(x0 + w - 2, G, cz, x0 + w - 2, G + 2, cz, B.log); box(x0 + 1, G + 2, cz - 1, x0 + w - 2, G + 2, cz + 1, B.white); break;
      }
    }
    const groundAt = (x, z) => top[Math.round(z) * X + Math.round(x)] || G;
    return { X, Z, YS, vox, idx, get, set, groundAt, sprites: [], M, TILE, G, BLOCKS, B };
  }

  // ---------------------------------------------------------------- landmark models (lot: x0..x0+15, z0..z0+11, front = south = z1)
  const stupa = (W, x, z, s = 1) => { const { G, B } = W; W.box(x - 2 * s, G, z - 2 * s, x + 2 * s, G + s, z + 2 * s, B.white); W.box(x - s, G + s + 1, z - s, x + s, G + s + 1, z + s, B.white); W.ellipsoid(x, G + 2 * s + 2, z, 1.6 * s, 1.6 * s, 1.6 * s, B.white); W.box(x, G + 3 * s + 3, z, x, G + 3 * s + 5, z, B.gold); };
  const hill = (W, cx, cz, rx, h, rz, b = W.B.grass) => W.ellipsoid(cx, W.G - 1, cz, rx, h, rz, (x, y, z) => (W.get(x, y + 1, z) ? W.B.dirt : b));
  const LAND = {
    turtle(W) { // Мэлхий хад: the granite Turtle Rock in Gorkhi-Terelj, about 24 m tall
      const { cx, cz, G, B } = W;
      W.ellipsoid(cx + 1, G + 3, cz, 6.5, 6, 5, (x, y, z) => (W.hash(x >> 1, y + (z >> 1), 3) < 0.25 ? B.graniteDark : B.granite));
      W.ellipsoid(cx - 6.5, G + 2.5, cz + 0.5, 2.6, 2.2, 2.2, B.granite); W.set(cx - 8.6, G + 3, cz - 0.5, B.graniteDark); W.set(cx - 8.6, G + 3, cz + 1.5, B.graniteDark);
      for (const [dx, dz] of [[-3, 4], [4, 4], [-3, -4], [4, -4]]) W.ellipsoid(cx + dx, G, cz + dz, 1.6, 1.3, 1.4, B.graniteDark);
      W.tree(W.x0, W.z0 + 1, 'larch'); W.tree(W.x1, W.z0 + 2, 'larch'); W.tree(W.x1 - 1, W.z1 - 1, 'larch');
    },
    statue(W) { // the 40 m stainless-steel Chinggis Khaan on horseback at Tsonjin Boldog, on a round visitor centre
      const { cx, cz, G, B } = W;
      W.cyl(cx, cz, 6, G, G + 3, (x, y) => (y === G + 2 && W.hash(x, 0, 1) < 0.6 ? B.window : B.plaster)); W.cyl(cx, cz, 6.4, G + 4, G + 4, B.gravel);
      W.box(cx - 4, G + 8, cz - 1, cx + 3, G + 10, cz + 1, B.silver);                 // horse body
      for (const [lx, lz] of [[-4, -1], [-4, 1], [2, -1], [2, 1]]) W.box(cx + lx, G + 5, cz + lz, cx + lx, G + 7, cz + lz, (lx + lz) % 2 ? B.silver : B.steel);
      W.box(cx + 3, G + 10, cz, cx + 5, G + 13, cz, B.silver); W.box(cx + 5, G + 12, cz, cx + 7, G + 13, cz, B.silver); W.box(cx + 3, G + 13, cz, cx + 4, G + 14, cz, B.steel); W.box(cx - 5, G + 7, cz, cx - 5, G + 10, cz, B.steel);   // neck, head, mane, tail
      W.box(cx - 1, G + 11, cz - 1, cx + 1, G + 15, cz + 1, B.silver); W.box(cx - 1, G + 11, cz - 2, cx, G + 12, cz + 2, B.steel); W.box(cx - 1, G + 16, cz, cx, G + 17, cz, B.silver); W.box(cx - 1, G + 18, cz, cx, G + 18, cz, B.steel); W.set(cx, G + 19, cz, B.steel);   // the rider, his legs and hat
      W.box(cx + 2, G + 14, cz + 1, cx + 4, G + 14, cz + 1, B.silver); W.box(cx + 5, G + 13, cz + 1, cx + 5, G + 15, cz + 1, B.gold);   // arm and golden whip
    },
    palace(W) { // Government Palace with the seated Chinggis Khaan, Sükhbaatar Square
      const { x0, z0, x1, z1, cx, G, B } = W;
      W.box(x0, G - 1, z0, x1, G - 1, z1, B.gravel); W.box(x0 + 1, G, z0 + 1, x1 - 1, G + 6, z0 + 6, B.plaster);
      for (let x = x0 + 1; x <= x1 - 1; x += 2) W.box(x, G, z0 + 7, x, G + 5, z0 + 7, B.white);
      W.box(x0, G + 6, z0, x1, G + 6, z0 + 8, B.concrete); W.box(x0 + 4, G + 7, z0 + 1, x1 - 4, G + 8, z0 + 6, B.plaster);
      W.box(cx - 1, G, z0 + 8, cx + 1, G + 1, z0 + 9, B.stone); W.box(cx - 1, G + 2, z0 + 8, cx + 1, G + 4, z0 + 8, B.bronze); W.box(cx, G + 5, z0 + 8, cx, G + 5, z0 + 8, B.bronze);
      W.box(cx, G + 9, z0 + 3, cx, G + 12, z0 + 3, B.iron); W.set(cx + 1, G + 12, z0 + 3, B.red); W.set(cx + 2, G + 12, z0 + 3, B.khadag); W.set(cx + 3, G + 12, z0 + 3, B.red);
    },
    temple(W) { // a monastery hall: white walls, dark red frieze, layered green roofs with a gold top
      const { x0, z0, x1, z1, cx, cz, G, B } = W;
      W.box(x0 + 1, G - 1, z0 + 1, x1 - 1, G - 1, z1 - 1, B.stone); W.box(x0 + 3, G, z0 + 2, x1 - 3, G + 4, z1 - 3, B.plaster);
      W.box(x0 + 3, G + 4, z0 + 2, x1 - 3, G + 4, z1 - 3, B.red); W.box(cx - 1, G, z1 - 3, cx, G + 2, z1 - 3, B.door);
      for (const wx of [x0 + 5, x1 - 5]) W.set(wx, G + 2, z1 - 3, B.window);
      for (let k = 0; k < 4; k++) W.box(x0 + 1 + k * 2, G + 5 + k, z0 + k, x1 - 1 - k * 2, G + 5 + k, z1 - 1 - k, k === 3 ? B.gold : B.greenTile);
      W.box(cx - 1, G + 9, cz - 1, cx, G + 10, cz, B.gold); W.box(cx, G + 11, cz, cx, G + 12, cz, B.gold);
    },
    gate(W) { // the painted gate of the Bogd Khan Palace
      const { x0, z0, x1, cx, cz, G, B } = W;
      for (const px of [x0 + 2, x0 + 5, x1 - 5, x1 - 2]) W.box(px, G, cz, px, G + 5, cz, B.red);
      W.box(x0 + 1, G + 6, cz - 1, x1 - 1, G + 6, cz + 1, B.orange); W.box(x0, G + 7, cz - 2, x1, G + 7, cz + 2, B.greenTile); W.box(x0 + 3, G + 8, cz - 1, x1 - 3, G + 8, cz + 1, B.greenTile);
      W.box(x0 + 4, G + 9, cz - 1, x1 - 4, G + 9, cz + 1, B.greenTile); W.box(cx - 1, G + 10, cz, cx, G + 10, cz, B.gold); W.box(x0 - 0, G + 8, cz - 2, x0, G + 8, cz - 2, B.greenTile); W.box(x1, G + 8, cz - 2, x1, G + 8, cz - 2, B.greenTile);
      W.box(x0 + 3, G - 1, W.z0, x1 - 3, G - 1, W.z1, B.cobble);
    },
    takhi(W) { hill(W, W.cx - 3, W.cz - 2, 7, 3, 5); hill(W, W.cx + 5, W.cz, 5, 2, 4); W.add('horse', W.cx - 2, W.cz + 3); W.add('horse', W.cx + 3, W.cz + 4); W.add('horse', W.cx + 6, W.cz + 2); },
    sacredmtn(W) { // a sacred mountain with an ovoo and blue khadags on the summit
      const { cx, cz, G, B } = W;
      W.cone(cx, cz - 1, 8, G - 1, 13, (x, y, z, k) => (k > 9 ? B.stone : W.get(x, y + 1, z) ? B.dirt : B.grass));
      W.cone(cx, cz - 1, 1.6, G + 12, 3, B.cobble); W.box(cx, G + 15, cz - 1, cx, G + 18, cz - 1, B.log); W.set(cx + 1, G + 17, cz - 1, B.khadag); W.set(cx - 1, G + 16, cz - 1, B.khadag);
    },
    snowpeak(W) { const { cx, cz, G, B } = W; for (const [dx, r, hh] of [[-5, 6, 16], [2, 8, 24], [7, 5, 13]]) W.cone(cx + dx, cz - 2, r, G - 1, hh, (x, y, z, k) => (k > hh * 0.55 ? B.snow : B.stone)); W.box(W.cx - 3, G - 1, W.z1 - 2, W.cx + 3, G - 1, W.z1, B.ice); },
    birthplace(W) { const { cx, cz, G, B } = W; hill(W, cx, cz, 8, 3, 5); W.box(cx, G + 2, cz, cx + 1, G + 8, cz, B.white); W.box(cx - 1, G + 2, cz - 1, cx + 2, G + 2, cz + 1, B.stone); W.set(cx + 2, G + 5, cz, B.khadag); },
    lake(W, swans) {
      const { cx, cz, G, B } = W;
      for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const d = ((x - cx) / 7.5) ** 2 + ((z - cz) / 5) ** 2; if (d <= 1) { W.box(x, G - 3, z, x, G + 3, z, 0); W.set(x, G - 4, z, B.sand); W.set(x, G - 3, z, B.water); W.set(x, G - 2, z, B.water); } else if (d <= 1.35) { W.box(x, G, z, x, G + 3, z, 0); W.set(x, G - 1, z, B.sand); if (W.hash(x, z, 4) < 0.25) W.set(x, G, z, B.reed); } }
      if (swans) for (const [dx, dz] of [[-2, 0], [1, 1], [3, -1]]) { W.set(cx + dx, G - 1, cz + dz, B.white); W.set(cx + dx + 1, G, cz + dz, B.white); }
      else { W.box(cx + 2, G - 1, cz, cx + 4, G - 1, cz, B.planks); W.set(cx + 3, G, cz, B.log); }
    },
    swans(W) { LAND.lake(W, true); },
    river(W) {
      const { G, B } = W;
      for (let z = W.z0; z <= W.z1; z++) { const c = W.cx + Math.round(Math.sin(z / 2) * 3); for (let x = c - 2; x <= c + 2; x++) { W.box(x, G - 3, z, x, G + 2, z, 0); W.set(x, G - 4, z, B.sand); W.set(x, G - 3, z, B.water); W.set(x, G - 2, z, B.water); } }
      const bz = W.cz; W.box(W.x0 + 2, G, bz - 1, W.x1 - 2, G, bz + 1, B.planks); for (const x of [W.x0 + 2, W.x1 - 2]) W.box(x, G, bz - 1, x, G + 1, bz + 1, B.log);
    },
    gazelle(W) { W.add('gazelle', W.cx - 4, W.cz); W.add('gazelle', W.cx, W.cz + 2); W.add('gazelle', W.cx + 4, W.cz - 1); W.add('gazelle', W.cx + 1, W.cz - 3); },
    stupahill(W) { hill(W, W.cx, W.cz, 7, 4, 5); const W2 = { ...W, G: W.G + 3 }; stupa(W2, W.cx, W.cz, 1); },
    stupas(W) { const { cx, cz, G, B } = W; W.box(W.x0, G - 1, W.z0, W.x1, G - 1, W.z1, B.sand); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * 6.5), z = Math.round(cz + Math.sin(a) * 4.5); W.box(x, G, z, x, G, z, B.white); W.set(x, G + 1, z, B.white); W.set(x, G + 2, z, B.gold); } stupa(W, cx, cz, 1); },
    train(W) {
      const { x0, z0, x1, z1, G, B } = W;
      W.box(x0 + 1, G, z0 + 1, x0 + 8, G + 4, z0 + 5, B.plaster); W.box(x0, G + 5, z0, x0 + 9, G + 5, z0 + 6, B.red); for (const x of [x0 + 2, x0 + 4, x0 + 6]) W.set(x, G + 2, z0 + 5, B.window);
      W.box(x0, G - 1, z1 - 2, x1, G - 1, z1 - 1, B.rail); W.box(x0 + 7, G, z1 - 2, x1, G + 2, z1 - 1, B.train);
    },
    mine(W) { const { x0, z0, x1, z1, G, B } = W; for (let k = 0; k < 4; k++) W.box(x0 + k * 2, G - 1 - k, z0 + k, x1 - k * 2, G + 2, z1 - k, 0); for (let k = 0; k < 4; k++) W.box(x0 + k * 2, G - 2 - k, z0 + k, x1 - k * 2, G - 2 - k, z1 - k, [B.clay, B.redRock, B.dirt, B.clay][k]); W.box(x0 + 1, G, z0 + 1, x0 + 3, G + 1, z0 + 2, B.yellow); },
    factory(W) { const { x0, z0, x1, G, B } = W; W.box(x0 + 1, G, z0 + 3, x1 - 1, G + 5, z0 + 9, B.concrete); for (let x = x0 + 2; x < x1 - 1; x += 2) W.set(x, G + 3, z0 + 9, B.window); for (const [cx2, hh] of [[x0 + 3, 12], [x0 + 7, 15], [x1 - 3, 10]]) { W.box(cx2, G + 6, z0 + 5, cx2, G + hh, z0 + 5, B.concrete); W.set(cx2, G + hh - 1, z0 + 5, B.red); } },
    cliffRed(W) { cliff(W, [W.B.redRock, W.B.redRock, W.B.clay]); for (const [dx, dz] of [[-1, 0], [0, 1], [1, 0]]) W.set(W.cx + dx, W.G, W.z1 - 2 + dz, W.B.egg); },
    cliffWhite(W) { cliff(W, [W.B.whiteRock, W.B.whiteRock, W.B.clay]); },
    rocks(W) { const { cx, cz, G, B } = W; for (const [dx, dz, r] of [[-4, 0, 3.5], [2, -1, 4.5], [6, 2, 2.6], [-1, 3, 2.4]]) W.ellipsoid(cx + dx, G + r * 0.4, cz + dz, r, r * 0.9, r * 0.8, (x, y, z) => (W.hash(x, y, z) < 0.3 ? B.graniteDark : B.granite)); },
    dunes(W) { const { G, B } = W; for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const hh = Math.round(3 + Math.sin(x / 3) * 2 + Math.sin(z / 2 + x / 5) * 1.5); W.box(x, G, z, x, G + hh - 1, z, B.sand); } W.add('camel', W.cx + 3, W.z1 + 1); },
    camel(W) { W.add('camel', W.cx - 3, W.cz); W.add('camel', W.cx + 3, W.cz + 2); },
    gorge(W) { const { G, B, x0, x1, z0, z1, cx } = W; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const w = Math.abs(x - cx); if (w > 2) W.box(x, G, z, x, G + 8 + Math.round(W.hash(x, z, 1) * 3) - Math.round(w / 3), z, w > 5 ? B.stone : B.graniteDark); else W.set(x, G - 1, z, B.ice); } },
    cave(W) { const { cx, cz, G, B } = W; W.ellipsoid(cx, G, cz - 1, 8, 7, 5.5, (x, y, z) => (W.hash(x, y, z) < 0.3 ? B.graniteDark : B.stone)); W.ellipsoid(cx, G + 1, cz + 1, 2.4, 2.6, 6, 0); W.set(cx - 2, G + 2, cz - 3, B.red); W.set(cx + 2, G + 3, cz - 3, B.red); },
    stoneturtle(W) { const { cx, cz, G, B } = W; W.ellipsoid(cx, G + 0.5, cz, 3.5, 1.8, 2.5, B.stone); W.ellipsoid(cx - 4, G + 0.5, cz, 1.4, 1.2, 1.2, B.stone); W.box(cx + 4, G, cz, cx + 5, G + 4, cz, B.stone); W.set(cx + 5, G + 4, cz + 1, B.khadag); },
    stupawall(W) { const { x0, z0, x1, z1, G, B } = W; for (let x = x0; x <= x1; x++) { W.box(x, G, z0, x, G + 2, z0, B.white); W.box(x, G, z1, x, G + 2, z1, B.white); } for (let z = z0; z <= z1; z++) { W.box(x0, G, z, x0, G + 2, z, B.white); W.box(x1, G, z, x1, G + 2, z, B.white); } for (let x = x0; x <= x1; x += 3) { W.set(x, G + 3, z0, B.white); W.set(x, G + 4, z0, B.gold); W.set(x, G + 3, z1, B.white); W.set(x, G + 4, z1, B.gold); } W.box(W.cx - 1, G, z1, W.cx, G + 1, z1, 0); W.box(x0 + 4, G, z0 + 3, x1 - 4, G + 3, z0 + 7, B.plaster); for (let k = 0; k < 3; k++) W.box(x0 + 3 + k * 2, G + 4 + k, z0 + 2 + k, x1 - 3 - k * 2, G + 4 + k, z0 + 8 - k, B.greenTile); },
    waterfall(W) { const { x0, z0, x1, cx, G, B } = W; W.box(x0, G, z0, x1, G + 9, z0 + 4, B.basalt); W.box(x0, G + 9, z0, x1, G + 9, z0 + 4, B.grass); for (let y = G - 3; y <= G + 9; y++) { W.set(cx, y, z0 + 4, B.water); W.set(cx + 1, y, z0 + 4, B.water); } W.box(cx, G + 9, z0, cx + 1, G + 9, z0 + 3, B.water); for (let z = z0 + 5; z <= z0 + 9; z++) for (let x = cx - 3; x <= cx + 4; x++) { W.box(x, G - 3, z, x, G + 1, z, 0); W.set(x, G - 3, z, B.water); W.set(x, G - 2, z, B.water); W.set(x, G - 4, z, B.sand); } },
    volcano(W) { const { cx, cz, G, B } = W; W.cone(cx, cz - 1, 8, G - 1, 9, (x, y, z, k) => (k > 6 ? B.darkStone : W.hash(x, y, z) < 0.4 ? B.basalt : B.darkStone)); W.cyl(cx, cz - 1, 2.5, G + 4, G + 8, 0); W.cyl(cx, cz - 1, 2.5, G + 3, G + 3, B.basalt); W.tree(W.x0, W.z1 - 1); W.tree(W.x1, W.z1 - 1); },
    bigrock(W) { W.ellipsoid(W.cx, W.G + 4, W.cz, 6, 6, 4.5, (x, y, z) => (W.hash(x >> 1, y, z) < 0.25 ? W.B.graniteDark : W.B.granite)); for (let k = 0; k < 4; k++) W.set(W.cx + (k % 2), W.G + 2 + k * 2, W.cz + 4, W.B.red); },
    ruins(W) { const { x0, z0, G, B } = W; for (const [dx, dz, hh, w] of [[1, 2, 3, 3], [6, 1, 5, 2], [11, 3, 2, 3], [3, 7, 4, 2], [9, 8, 3, 3]]) W.box(x0 + dx, G, z0 + dz, x0 + dx + w, G + hh, z0 + dz, W.hash(dx, dz, 1) < 0.5 ? B.clay : B.cobble); },
    city(W) { const { x0, z0, G, B } = W; for (const [dx, w, hh] of [[0, 3, 10], [5, 3, 14], [10, 4, 9]]) { W.box(x0 + dx, G, z0 + 2, x0 + dx + w, G + hh, z0 + 6, B.concrete); for (let y = G + 1; y < G + hh; y += 2) for (let k = 0; k <= w; k++) W.set(x0 + dx + k, y, z0 + 6, B.concreteWin); } },
    fields(W) { const { G, B } = W; for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { W.set(x, G - 1, z, B.farmland); W.set(x, G, z, B.wheat); } W.box(W.cx, G, W.cz, W.cx + 2, G + 1, W.cz + 1, B.red); },
    fort(W) { const { x0, z0, x1, z1, G, B } = W; for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) { W.box(x, G, z, x, G + 3, z, B.clay); if (x % 2) W.set(x, G + 4, z, B.clay); } for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) { W.box(x, G, z, x, G + 3, z, B.clay); if (z % 2) W.set(x, G + 4, z, B.clay); } W.box(W.cx - 1, G, z1, W.cx + 1, G + 2, z1, 0); },
    urts(W) { const { cx, cz, G, B } = W; W.cone(cx - 3, cz, 3.4, G, 7, B.hide); W.cyl(cx - 3, cz, 1.6, G, G + 1, 0); W.box(cx - 3, G, cz + 1, cx - 3, G + 1, cz + 3, 0); W.box(cx - 3, G + 7, cz, cx - 3, G + 8, cz, B.log); W.set(cx - 3, G - 1, cz, B.dirt); W.add('reindeer', cx + 4, cz + 2); W.add('reindeer', cx + 2, cz - 2); }, // a Tsaatan urts: a cone of poles under hides, with a low doorway
    deerstone(W) { const { cx, cz, G, B } = W; for (const [dx, hh] of [[-5, 4], [0, 5], [5, 3]]) W.box(cx + dx, G, cz, cx + dx + 1, G + hh, cz, B.deerStone); },
    rockart(W) { const { cx, cz, G, B } = W; W.ellipsoid(cx, G + 1, cz - 1, 7, 3.5, 3, B.graniteDark); W.box(cx - 5, G + 1, cz + 2, cx + 5, G + 3, cz + 2, B.carving); },
    eagle(W) { const { cx, cz, G, B } = W; W.box(cx + 2, G, cz, cx + 2, G + 2, cz, B.log); W.box(cx + 1, G + 2, cz, cx + 3, G + 2, cz, B.log); W.add('eagle', cx + 2, cz); W.add('hunter', cx - 2, cz + 1); W.add('horse', cx - 5, cz - 1); },
  };
  // ---- the bigger lots (24×16 blocks) and each province's own attractions in 3D
  const peak3 = (W, cx, cz, r, hgt, rock, snowFrom) => W.cone(cx, cz, r, W.G - 1, hgt, (x, y, z, k) => (snowFrom !== undefined && k >= snowFrom ? W.B.snow : k < 2 && rock === W.B.stone ? W.B.grass : rock));
  Object.assign(LAND, {
    statue(W) { // Tsonjin Boldog: the 40 m Chinggis Khaan statue (about 22 blocks) on its round visitor centre, facing east
      const { cx, cz, G, B } = W;
      W.cyl(cx, cz, 8, G, G + 4, (x, y) => (y === G + 2 && W.hash(x, 0, 1) < 0.7 ? B.window : B.plaster)); W.cyl(cx, cz, 8.5, G + 5, G + 5, B.gravel); W.cyl(cx, cz, 3, G + 6, G + 7, B.plaster);
      for (let k = 0; k < 4; k++) W.box(cx - 2, G + k - 3, W.z1 - k, cx + 2, G - 1 + k - 3 + 3, W.z1 - k, B.stone);   // steps up from the south
      const S = B.silver, D = B.steel;
      W.box(cx - 5, G + 12, cz - 2, cx + 4, G + 15, cz + 2, S);                       // the horse’s body
      for (const [lx, lz] of [[-5, -2], [-5, 1], [3, -2], [3, 1]]) W.box(cx + lx, G + 8, cz + lz, cx + lx + 1, G + 11, cz + lz + 1, (lx + lz) % 2 ? S : D);
      W.box(cx + 4, G + 15, cz - 1, cx + 6, G + 19, cz + 1, S); W.box(cx + 6, G + 18, cz - 1, cx + 9, G + 20, cz + 1, S); W.box(cx + 4, G + 19, cz, cx + 5, G + 21, cz, D); W.box(cx - 6, G + 10, cz, cx - 6, G + 14, cz, D);
      W.box(cx - 1, G + 16, cz - 1, cx + 1, G + 21, cz + 1, S); W.box(cx - 1, G + 16, cz - 3, cx, G + 17, cz + 3, D); W.box(cx - 1, G + 22, cz - 1, cx + 1, G + 23, cz + 1, S); W.box(cx - 1, G + 24, cz, cx + 1, G + 24, cz, D);
      W.box(cx + 2, G + 20, cz + 2, cx + 4, G + 20, cz + 2, S); W.box(cx + 5, G + 19, cz + 2, cx + 5, G + 22, cz + 2, B.gold);   // arm and golden whip
      for (const fx of [W.x0 + 1, W.x1 - 1]) { W.box(fx, G, W.z1 - 1, fx, G + 5, W.z1 - 1, B.log); W.set(fx + 1, G + 5, W.z1 - 1, B.red); W.set(fx + 1, G + 4, W.z1 - 1, B.khadag); W.set(fx + 1, G + 3, W.z1 - 1, B.red); }
    },
    turtle(W) { // Turtle Rock, about 24 m of granite, and the Ariyabal temple on the slope behind
      const { cx, cz, G, B } = W, gr = (x, y, z) => (W.hash(x >> 1, y + (z >> 1), 3) < 0.25 ? B.graniteDark : B.granite);
      W.ellipsoid(cx, G + 4, cz, 8, 8, 6, gr); W.ellipsoid(cx - 9, G + 3, cz + 1, 3.2, 2.8, 2.6, B.granite); W.set(cx - 12, G + 4, cz, B.graniteDark); W.set(cx - 12, G + 4, cz + 2, B.graniteDark);
      for (const [dx, dz] of [[-5, 5], [5, 5], [-5, -5], [5, -5]]) W.ellipsoid(cx + dx, G, cz + dz, 2, 1.5, 1.7, B.graniteDark);
      hill(W, W.x1 - 3, W.z0 + 2, 6, 5, 4); W.box(W.x1 - 6, G + 4, W.z0, W.x1 - 2, G + 6, W.z0 + 3, B.plaster); W.box(W.x1 - 7, G + 7, W.z0 - 1, W.x1 - 1, G + 7, W.z0 + 4, B.red); W.set(W.x1 - 4, G + 8, W.z0 + 1, B.gold);
      for (const [tx, tz] of [[W.x0 + 1, W.z0 + 1], [W.x0 + 3, W.z1 - 1], [W.x1 - 1, W.z1 - 2], [W.x0 + 6, W.z0]]) W.tree(tx, tz, 'larch');
    },
    gandan(W) { // Gandan: the tall white Migjid Janraisig temple with layered green-and-gold roofs, white stupas either side
      const { cx, cz, G, B } = W;
      W.box(W.x0, G - 1, W.z0, W.x1, G - 1, W.z1, B.cobble);
      W.box(cx - 6, G, cz - 5, cx + 6, G + 10, cz + 3, B.plaster); W.box(cx - 6, G + 10, cz - 5, cx + 6, G + 10, cz + 3, B.red);
      for (let y = G + 2; y < G + 10; y += 3) for (let x = cx - 5; x <= cx + 5; x += 2) W.set(x, y, cz + 3, B.window);
      W.box(cx - 1, G, cz + 3, cx + 1, G + 2, cz + 3, B.door);
      for (let k = 0; k < 4; k++) W.box(cx - 8 + k * 2, G + 11 + k, cz - 7 + k, cx + 8 - k * 2, G + 11 + k, cz + 5 - k, k === 3 ? B.gold : B.greenTile);
      W.box(cx - 1, G + 15, cz - 2, cx + 1, G + 16, cz, B.gold); W.box(cx, G + 17, cz - 1, cx, G + 19, cz - 1, B.gold);
      for (const sx of [W.x0 + 2, W.x0 + 5, W.x1 - 5, W.x1 - 2]) stupa(W, sx, W.z1 - 3, 1);
    },
    burkhan(W) { // Burkhan Khaldun: a sacred mountain clad in larch forest, ovoos on its top
      const { cx, cz, G, B } = W;
      W.cone(cx, cz - 2, 12, G - 1, 18, (x, y, z, k) => (k > 15 ? B.stone : W.get(x, y + 1, z) ? B.dirt : B.grass));
      for (let i = 0; i < 26; i++) { const a = i * 2.39, r = 3 + (i % 9); const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz - 2 + Math.sin(a) * r * 0.9); let y = G + 18; while (y > G && !W.get(x, y - 1, z)) y--; if (y < G + 14) { W.box(x, y, z, x, y + 3, z, B.log); W.cone(x, z, 1.8, y + 2, 4, B.larch); } }
      W.cone(cx, cz - 2, 1.8, G + 17, 3, B.cobble); W.box(cx, G + 20, cz - 2, cx, G + 23, cz - 2, B.log); W.set(cx + 1, G + 22, cz - 2, B.khadag); W.set(cx - 1, G + 21, cz - 2, B.khadag);
    },
    khokh(W) { // Khökh Lake: a small deep-blue lake in the forest, with the memorial where Temüjin was proclaimed khan
      const { cx, cz, G, B } = W;
      for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const d = ((x - cx + 2) / 8) ** 2 + ((z - cz) / 5) ** 2; if (d <= 1) { W.box(x, G - 3, z, x, G + 3, z, 0); W.set(x, G - 4, z, B.sand); W.set(x, G - 3, z, B.water); W.set(x, G - 2, z, B.water); } else if (d < 2.2 && W.hash(x, z, 6) < 0.18) W.tree(x, z, 'larch'); }
      W.box(W.x1 - 3, G, cz, W.x1 - 2, G + 7, cz, B.white); W.box(W.x1 - 4, G, cz - 1, W.x1 - 1, G, cz + 1, B.stone); W.set(W.x1 - 2, G + 4, cz + 1, B.khadag);
    },
    shore(W) { // a big lake’s south shore: beach, jetty, boats (the lake itself is real terrain beyond the lot)
      const { G, B } = W, s = (TG.landmarks.SHORE || {})[W.id] || {};
      for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { W.box(x, G, z, x, G + 3, z, 0); W.set(x, G - 1, z, s.salt ? B.saltcrust : B.sand); }
      for (let z = W.z0 - 6; z <= W.z0 + 4; z++) W.set(W.cx, G - 1, z, B.planks);                 // the jetty out over the water
      if (s.boat === 'ship') { W.box(W.cx + 3, G - 2, W.z0 - 9, W.cx + 12, G - 1, W.z0 - 6, B.white); W.box(W.cx + 3, G - 2, W.z0 - 9, W.cx + 12, G - 2, W.z0 - 6, B.red); W.box(W.cx + 5, G, W.z0 - 8, W.cx + 9, G + 1, W.z0 - 7, B.white); W.box(W.cx + 7, G + 2, W.z0 - 8, W.cx + 7, G + 3, W.z0 - 8, B.iron); }
      if (s.boat === 'fish') for (const bx of [W.cx - 6, W.cx + 5]) { W.box(bx, G - 2, W.z0 - 5, bx + 3, G - 2, W.z0 - 4, B.planks); W.box(bx + 1, G - 1, W.z0 - 5, bx + 1, G + 1, W.z0 - 5, B.log); W.set(bx + 2, G, W.z0 - 5, B.white); }
      if (s.reeds) for (let x = W.x0; x <= W.x1; x += 2) W.set(x, G - 1 + 1, W.z0, B.reed);
      W.box(W.x0 + 1, G, W.z1 - 2, W.x0 + 2, G + 1, W.z1 - 2, B.planks); W.add(s.birds === 'pelican' ? 'swan' : 'gull', W.cx - 4, W.z0 - 3);
    },
    memorial(W) { // the Khalkhin Gol victory memorial
      const { cx, cz, G, B } = W;
      for (let z = W.z1 - 3; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { W.box(x, G - 3, z, x, G + 2, z, 0); W.set(x, G - 4, z, B.sand); W.set(x, G - 3, z, B.water); W.set(x, G - 2, z, B.water); }
      for (let k = 0; k < 3; k++) W.box(cx - 5 + k, G + k, cz - 4 + k, cx + 5 - k, G + k, cz + 2 - k, k % 2 ? B.stone : B.plaster);
      W.box(cx - 1, G + 3, cz - 2, cx, G + 18, cz - 1, B.white); W.set(cx, G + 19, cz - 1, B.gold);
      for (const fx of [cx - 7, cx + 7]) { W.box(fx, G, cz, fx, G + 6, cz, B.log); W.set(fx + 1, G + 6, cz, B.red); W.set(fx + 1, G + 5, cz, B.khadag); W.set(fx + 1, G + 4, cz, B.red); }
    },
    shiliin(W) { const { cx, cz, G, B } = W; W.cone(cx, cz - 2, 11, G - 1, 14, (x, y, z, k) => (k > 11 ? B.darkStone : B.grass)); W.cyl(cx, cz - 2, 2, G + 11, G + 13, 0); for (const dx of [-3, 0, 3]) { W.cone(cx + dx, cz - 4, 1.2, G + 11, 2, B.cobble); } W.box(cx, G + 13, cz - 4, cx, G + 16, cz - 4, B.log); W.set(cx + 1, G + 15, cz - 4, B.khadag); },
    ganga(W) { const { cx, cz, G, B } = W; for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const d = ((x - cx) / 7) ** 2 + ((z - cz - 2) / 4) ** 2; if (d <= 1) { W.set(x, G - 2, z, B.water); W.set(x, G - 1, z, 0); W.set(x, G - 3, z, B.sand); } } for (let x = W.x0; x <= W.x1; x++) for (let z = W.z0; z < W.z0 + 4; z++) { const hh = 2 + Math.round(Math.abs(Math.sin(x / 3)) * 3); W.box(x, G, z, x, G + hh - (z - W.z0 > 2 ? 1 : 0), z, B.sand); } for (const [dx, dz] of [[-2, 2], [1, 3], [3, 1]]) W.add('swan', cx + dx, cz + dz); },
    altanovoo(W) { const { cx, cz, G } = W; hill(W, cx, cz, 10, 6, 7); const W2 = { ...W, G: G + 5 }; stupa(W2, cx, cz, 1); for (const sx of [W.x0 + 2, W.x0 + 5, W.x1 - 3]) { W.box(sx, G, W.z1 - 1, sx, G + 2, W.z1 - 1, W.B.stone); W.set(sx, G + 3, W.z1 - 1, W.B.cobble); } },
    khamar(W) { LAND.temple(W); for (let x = W.x0; x <= W.x1; x += 2) { W.set(x, W.G, W.z1, W.B.white); W.set(x, W.G + 1, W.z1, W.B.white); W.set(x, W.G + 2, W.z1, W.B.gold); } },
    granitemtn(W) { const { cx, cz, G, B } = W; for (const [dx, dz, r] of [[-7, -2, 4.5], [0, -3, 6.5], [7, -1, 5], [-3, 3, 3.2], [4, 3, 3.6], [10, 4, 2.6]]) W.ellipsoid(cx + dx, G + r * 0.5, cz + dz, r, r * 0.95, r * 0.8, (x, y, z) => (W.hash(x, y, z) < 0.3 ? B.graniteDark : B.granite)); },
    ejkhairkhan(W) { LAND.granitemtn(W); for (let x = W.cx - 2; x <= W.cx + 2; x++) for (let z = W.z1 - 3; z <= W.z1 - 1; z++) { W.set(x, W.G - 1, z, W.B.water); W.set(x, W.G, z, 0); } },
    bagagazar(W) { LAND.granitemtn(W); for (const [dx, hh] of [[-10, 3], [-8, 4], [10, 3]]) W.box(W.cx + dx, W.G, W.z1 - 1, W.cx + dx + 1, W.G + hh, W.z1 - 1, W.B.clay); },
    khongor(W) { // the towering dunes of Khongoryn Els, with the green Khongor stream at their foot
      const { G, B } = W;
      for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const back = W.z1 - z, hh = Math.round(Math.max(0, (back - 4) * 1.4) + Math.abs(Math.sin(x / 4)) * 5 + Math.sin(x / 2 + z / 3)); if (back < 4) { W.set(x, G - 1, z, back === 1 ? B.water : B.grass); continue; } W.box(x, G, z, x, G + hh, z, B.sand); }
      W.add('camel', W.cx - 4, W.z1 - 2); W.add('camel', W.cx, W.z1 - 3);
    },
    ikhbogd(W) { peak3(W, W.cx - 4, W.cz - 2, 10, 20, W.B.stone, 12); peak3(W, W.cx + 7, W.cz - 3, 7, 14, W.B.stone, 9); },
    otgon(W) { LAND.ikhbogd(W); const { cx, cz, G, B } = W; W.set(cx - 4, G + 19, cz - 2, B.khadag); W.set(cx - 3, G + 18, cz - 2, B.white); },
    kharkhiraa(W) { peak3(W, W.cx - 6, W.cz - 2, 9, 19, W.B.stone, 11); peak3(W, W.cx + 5, W.cz - 3, 9, 21, W.B.stone, 12); },
    tavanbogd(W) { LAND.kharkhiraa(W); const { cx, G, B } = W; for (let z = W.cz; z <= W.z1; z++) for (let x = cx - 3 - (z - W.cz); x <= cx + 3 + (z - W.cz); x++) { W.set(x, G - 1, z, B.ice); W.set(x, G, z, (x + z) % 3 ? 0 : B.ice); } },   // the Potanin glacier flowing down
    whitecave(W) { const { cx, cz, G, B } = W; W.cone(cx, cz - 2, 11, G - 1, 12, (x, y, z) => (W.hash(x, y, z) < 0.3 ? B.whiteRock : B.white)); W.ellipsoid(cx, G + 1, cz + 2, 2.6, 2.8, 7, 0); },
    khogno(W) { const { cx, cz, G, B } = W; peak3(W, cx - 6, cz - 2, 8, 14, B.graniteDark); for (let z = W.z0; z <= W.z1; z++) for (let x = cx + 3; x <= W.x1; x++) { const hh = 1 + Math.round(Math.abs(Math.sin(x / 3 + z / 5)) * 3); W.box(x, G, z, x, G + hh - 1, z, B.sand); } for (const [tx, tz] of [[W.x0 + 1, W.z1 - 1], [W.x0 + 4, W.z1]]) W.tree(tx, tz, 'birch'); },
    amar(W) { // Amarbayasgalant: a walled, symmetrical monastery with green-and-gold roofs
      const { x0, z0, x1, z1, cx, G, B } = W;
      for (let x = x0; x <= x1; x++) { W.box(x, G, z0, x, G + 2, z0, B.clay); W.box(x, G, z1, x, G + 2, z1, B.clay); } for (let z = z0; z <= z1; z++) { W.box(x0, G, z, x0, G + 2, z, B.clay); W.box(x1, G, z, x1, G + 2, z, B.clay); }
      W.box(cx - 2, G, z1, cx + 2, G + 2, z1, 0); W.box(cx - 3, G + 3, z1, cx + 3, G + 3, z1, B.greenTile);
      for (const [hx, hw, hz, hh] of [[cx - 4, 4, z0 + 3, 6], [x0 + 3, 3, z0 + 6, 4], [x1 - 3, 3, z0 + 6, 4]]) { W.box(hx - hw, G, hz - 2, hx + hw, G + hh, hz + 2, B.plaster); W.box(hx - hw, G + hh, hz - 2, hx + hw, G + hh, hz + 2, B.red); for (let k = 0; k < 3; k++) W.box(hx - hw - 1 + k, G + hh + 1 + k, hz - 3 + k, hx + hw + 1 - k, G + hh + 1 + k, hz + 3 - k, k === 2 ? B.gold : B.greenTile); }
      W.box(cx - 4, G, z0 + 5, cx - 4, G + 2, z0 + 5, 0); W.box(cx + 4, G, z0 + 5, cx + 4, G + 2, z0 + 5, B.door);
    },
    altanbulag(W) { const { x0, z0, cx, cz, G, B } = W; W.box(x0 + 1, G, z0 + 2, x0 + 9, G + 4, z0 + 8, B.planks); W.box(x0, G + 5, z0 + 1, x0 + 10, G + 5, z0 + 9, B.red); for (let x = x0 + 2; x <= x0 + 8; x += 2) W.set(x, G + 2, z0 + 8, B.window); W.box(cx + 4, G, cz, cx + 8, G, cz + 3, B.stone); W.box(cx + 6, G + 1, cz + 1, cx + 6, G + 14, cz + 1, B.white); W.set(cx + 6, G + 15, cz + 1, B.red); },
    pavilion(W) { const { cx, cz, G, B } = W; hill(W, cx, cz, 11, 7, 7); const y = G + 6; for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) W.box(cx + dx, y, cz + dz, cx + dx, y + 3, cz + dz, B.red); W.box(cx - 3, y + 4, cz - 3, cx + 3, y + 4, cz + 3, B.greenTile); W.box(cx - 2, y + 5, cz - 2, cx + 2, y + 5, cz + 2, B.greenTile); W.set(cx, y + 6, cz, B.gold); },
    mazaalai(W) { const { cx, cz, G, B } = W; W.box(W.x0, G - 1, W.z0, W.x1, G - 1, W.z1, B.sand); for (let x = cx - 4; x <= cx; x++) for (let z = cz + 1; z <= cz + 3; z++) { W.set(x, G - 1, z, B.water); } for (const [dx, dz] of [[-6, 1], [-6, 4], [2, 4]]) W.set(cx + dx, G, cz + dz, B.saxaul); peak3(W, W.x1 - 4, W.z0 + 2, 6, 7, B.redRock); W.add('bear', cx + 3, cz + 1); W.add('camel', W.x1 - 6, cz + 3); W.add('camel', W.x1 - 3, cz + 4); },
    eaglefest(W) { const { cx, cz, G, B } = W; for (let x = W.x0; x <= W.x1; x += 3) { W.set(x, G, W.z0, B.planks); W.set(x, G, W.z1, B.planks); } W.add('hunter', cx - 6, cz); W.add('horse', cx - 6, cz + 2); W.add('hunter', cx + 2, cz - 2); W.add('horse', cx + 2, cz); W.add('eagle', cx - 2, cz - 1); W.add('eagle', cx + 6, cz + 1); W.ger(W.x1 - 4, W.z0 + 4, 3); },
    swans(W) { const { cx, cz, G, B } = W; for (let z = W.z0; z <= W.z1; z++) for (let x = W.x0; x <= W.x1; x++) { const d = ((x - cx) / 11) ** 2 + ((z - cz) / 7) ** 2; if (d <= 1) { W.box(x, G - 3, z, x, G + 3, z, 0); W.set(x, G - 4, z, B.sand); W.set(x, G - 3, z, B.saltwater); W.set(x, G - 2, z, B.saltwater); } else if (d < 1.35) { W.set(x, G - 1, z, B.saltcrust); } } for (const [dx, dz] of [[-4, 0], [-1, 2], [3, -1], [5, 2]]) W.add('swan', cx + dx, cz + dz); },
    waterfall(W) { // the 20 m Orkhon waterfall into its basalt canyon
      const { x0, z0, x1, cx, G, B } = W;
      W.box(x0, G, z0, x1, G + 10, z0 + 6, B.basalt); W.box(x0, G + 10, z0, x1, G + 10, z0 + 6, B.grass);
      for (let y = G - 4; y <= G + 10; y++) for (let x = cx - 1; x <= cx + 1; x++) W.set(x, y, z0 + 6, B.water);
      W.box(cx - 1, G + 10, z0, cx + 1, G + 10, z0 + 5, B.water);
      for (let z = z0 + 7; z <= W.z1; z++) for (let x = x0; x <= x1; x++) { const pool = Math.hypot((x - cx) / 6, (z - z0 - 9) / 3) <= 1; W.box(x, G - 5, z, x, G + 1, z, 0); W.set(x, G - 6, z, B.basalt); if (pool || Math.abs(x - cx - Math.sin(z) * 2) < 3) { W.set(x, G - 5, z, B.water); W.set(x, G - 4, z, B.water); } else W.box(x, G - 5, z, x, G - 4, z, B.basalt); }
      for (const tx of [x0 + 1, x0 + 4, x1 - 2]) W.tree(tx, z0 + 3);
    },
    stupawall(W) { const { x0, z0, x1, z1, G, B } = W; for (let x = x0; x <= x1; x++) { W.box(x, G, z0, x, G + 2, z0, B.white); W.box(x, G, z1, x, G + 2, z1, B.white); } for (let z = z0; z <= z1; z++) { W.box(x0, G, z, x0, G + 2, z, B.white); W.box(x1, G, z, x1, G + 2, z, B.white); }
      for (let x = x0 + 1; x < x1; x += 3) for (const z of [z0, z1]) { W.box(x - 1, G + 3, z, x + 1, G + 3, z, B.white); W.set(x, G + 4, z, B.white); W.set(x, G + 5, z, B.gold); }
      W.box(W.cx - 1, G, z1, W.cx + 1, G + 2, z1, 0);
      for (const [hx, hw] of [[W.cx - 5, 3], [W.cx + 4, 4]]) { W.box(hx - hw, G, z0 + 3, hx + hw, G + 4, z0 + 8, B.plaster); for (let k = 0; k < 3; k++) W.box(hx - hw - 1 + k, G + 5 + k, z0 + 2 + k, hx + hw + 1 - k, G + 5 + k, z0 + 9 - k, k === 2 ? B.gold : B.greenTile); }
    },
  });
  function cliff(W, layers) { const { G } = W; for (let z = W.z0; z <= W.z0 + 6; z++) for (let x = W.x0; x <= W.x1; x++) { const hh = 6 + Math.round(Math.abs(Math.sin(x / 2.5)) * 4 + W.hash(x, z, 2) * 2) - Math.max(0, z - W.z0 - 3) * 2; for (let y = 0; y < hh; y++) W.set(x, G + y, z, layers[Math.floor(y / 2) % layers.length]); } }

  TG.fpworld = { create, createVillage, atlas, BLOCKS, B, TILE, M, G, YS, hash, tex: t };
})(window.TG);
