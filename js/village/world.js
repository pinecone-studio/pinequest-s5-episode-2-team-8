/* Нутаг world: map layout, collision and path finding. Drawing is in pixel.js. */
(function (TG) {
  const R = TG.vrules, W = R.W, H = R.H, T = 16;
  let seed = 20261021;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hash = (x, y) => { let n = x * 374761393 + y * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; };

  // ---------------------------------------------------------------- map
  // g grass · p path · s plaza · w water · d dock · o soil (garden plot) · f fence · T tree · B building · r rock
  const g = Array.from({ length: H }, () => Array(W).fill('g'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  for (let x = 0; x < W; x++) { set(x, 0, 'T'); set(x, 1, 'T'); set(x, H - 1, 'T'); }
  for (let y = 0; y < H; y++) { set(0, y, 'T'); set(W - 1, y, 'T'); }
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (((x + 0.5 - 30) / 4.6) ** 2 + ((y + 0.5 - 5.5) / 3.3) ** 2 <= 1) set(x, y, 'w');
  rect(1, 12, W - 2, 13, 'p'); rect(17, 2, 18, H - 2, 'p');
  rect(15, 10, 20, 15, 's');
  rect(19, 5, 24, 5, 'p'); rect(25, 5, 26, 5, 'd');
  rect(4, 6, 4, 11, 'p'); rect(11, 6, 11, 11, 'p'); rect(22, 11, 23, 11, 'p');
  // garden (fenced) with 24 shared plots
  for (let x = 3; x <= 14; x++) { set(x, 15, 'f'); set(x, 23, 'f'); }
  for (let y = 15; y <= 23; y++) { set(3, y, 'f'); set(14, y, 'f'); }
  rect(9, 14, 10, 15, 'p');
  const plots = [];
  for (const y of [17, 18, 20, 21]) for (let x = 5; x <= 10; x++) { set(x, y, 'o'); plots.push({ x, y }); }
  // sheep pasture
  for (let x = 22; x <= 33; x++) { set(x, 18, 'f'); set(x, 24, 'f'); }
  for (let y = 18; y <= 24; y++) { set(22, y, 'f'); set(33, y, 'f'); }
  rect(27, 14, 27, 18, 'p');
  // ger neighborhood (south): 8 lots along a lane
  const LOT_X = [3, 7, 11, 21, 25, 29, 33, 37];
  rect(2, 31, 40, 32, 'p');
  // decorative pond in the south meadow
  for (let y = 33; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (((x + 0.5 - 30.5) / 4.2) ** 2 + ((y + 0.5 - 35.8) / 2.2) ** 2 <= 1) set(x, y, 'w');
  // Naadam wrestling arena (east): sand ring, reached from the main road
  const ARENA = { cx: 47.5, cy: 12.5, rx: 6, ry: 4.6 };
  for (let y = 2; y < H - 1; y++) for (let x = 36; x < W - 1; x++) if (((x + 0.5 - ARENA.cx) / ARENA.rx) ** 2 + ((y + 0.5 - ARENA.cy) / ARENA.ry) ** 2 <= 1) set(x, y, 'a');
  rect(46, 18, 47, 24, 'p');

  const objects = [
    { id: 'home', kind: 'ger', x: 3, y: 3, w: 3, h: 3, door: { x: 4, y: 6 }, accent: '#2F6BFF', sign: '🏠' },
    { id: 'arcade', kind: 'ger', x: 10, y: 3, w: 3, h: 3, door: { x: 11, y: 6 }, accent: '#7A5AF8', sign: '🎮' },
    { id: 'shop', kind: 'shop', x: 21, y: 8, w: 4, h: 3, door: { x: 22, y: 11 } },
    { id: 'board', kind: 'board', x: 19, y: 10, w: 2, h: 1, door: { x: 19, y: 11 } },
    { id: 'well', kind: 'well', x: 12, y: 17, w: 1, h: 1, door: { x: 12, y: 18 } },
    { id: 'lantern1', kind: 'lantern', x: 15, y: 10, w: 1, h: 1 },
    { id: 'lantern2', kind: 'lantern', x: 15, y: 15, w: 1, h: 1 },
    { id: 'lantern3', kind: 'lantern', x: 20, y: 15, w: 1, h: 1 },
    { id: 'bleachers', kind: 'bleachers', x: 42, y: 5, w: 12, h: 2 },
    { id: 'zasuul', kind: 'npc', x: 47, y: 8, w: 1, h: 1, door: { x: 47, y: 9 } },
    { id: 'ovoo', kind: 'ovoo', x: 46, y: 25, w: 2, h: 2, door: { x: 46, y: 24 } },
    { id: 'lantern4', kind: 'lantern', x: 40, y: 11, w: 1, h: 1 },
    { id: 'lantern5', kind: 'lantern', x: 40, y: 14, w: 1, h: 1 },
    ...LOT_X.map((x, i) => ({ id: 'lot' + i, kind: 'lot', i, x, y: 28, w: 3, h: 3, door: { x: x + 1, y: 31 } })),
  ];
  const lots = objects.filter((o) => o.kind === 'lot');
  const occ = {};
  for (const o of objects) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) { set(x, y, 'B'); occ[x + ',' + y] = o; }
  const DOCK = { x: 26, y: 5 };

  // trees, flowers, rocks
  const trees = [], flowers = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'T') trees.push({ x, y, pine: hash(x, y) > 0.7 });
  const clearAround = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = (g[y + dy] || [])[x + dx]; if (c && c !== 'g' && c !== 'T') return false; } return true; };
  const reserved = (x, y) => (x >= 13 && x <= 22 && y >= 9 && y <= 16) || (y >= 2 && y <= 7 && x >= 2 && x <= 14) || (x >= 22 && x <= 33 && y >= 18 && y <= 25) || (x >= 3 && x <= 14 && y >= 14 && y <= 24) || (x >= 38 && y >= 3 && y <= 19) || (x >= 1 && x <= 41 && y >= 26 && y <= 33) || (x >= 43 && x <= 50 && y >= 22 && y <= 28);
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== 'g' || reserved(x, y) || !clearAround(x, y)) continue;
    const r = rnd();
    if (r < 0.1) { set(x, y, 'T'); trees.push({ x, y, pine: rnd() > 0.6 }); }
    else if (r < 0.13) set(x, y, 'r');
  }
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === 'g' && hash(x * 3, y * 7) < 0.09) flowers.push({ x, y, c: ['#FF8FB1', '#FFD34E', '#FFFFFF', '#B49CFF'][Math.floor(hash(x, y * 5) * 4)] });

  const blocked = (x, y) => x < 0 || y < 0 || x >= W || y >= H || 'TwfBr'.includes(g[y][x]);
  const plotAt = (x, y) => plots.findIndex((p) => p.x === x && p.y === y);

  /** A* path on the tile grid with 8 directions (no corner cutting). Returns tiles after the start, or null. */
  function findPath(sx, sy, tx, ty) {
    if (blocked(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    const key = (x, y) => y * W + x, open = [[sx, sy]], g0 = new Map([[key(sx, sy), 0]]), prev = new Map(), done = new Set();
    const hf = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    for (let guard = 0; open.length && guard < 6000; guard++) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (g0.get(key(...open[i])) + hf(...open[i]) < g0.get(key(...open[bi])) + hf(...open[bi])) bi = i;
      const [x, y] = open.splice(bi, 1)[0], k = key(x, y);
      if (done.has(k)) continue; done.add(k);
      if (x === tx && y === ty) { const path = []; let c = k; while (c !== key(sx, sy)) { path.unshift({ x: c % W, y: Math.floor(c / W) }); c = prev.get(c); } return path; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (blocked(nx, ny) || (dx && dy && (blocked(x + dx, y) || blocked(x, y + dy)))) continue;
        const nk = key(nx, ny), ng = g0.get(k) + (dx && dy ? 1.41 : 1);
        if (!g0.has(nk) || ng < g0.get(nk)) { g0.set(nk, ng); prev.set(nk, k); open.push([nx, ny]); }
      }
    }
    return null;
  }
  /** Nearest walkable tile next to (x,y), preferring ones close to (fx,fy). */
  function nearestOpen(x, y, fx, fy) {
    let best = null, bd = 1e9;
    for (let r = 1; r <= 3 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (blocked(nx, ny)) continue;
      const d = Math.abs(nx - fx) + Math.abs(ny - fy) + Math.abs(dx) + Math.abs(dy) * 1.01;
      if (d < bd) { bd = d; best = { x: nx, y: ny }; }
    }
    return best;
  }

  // drawing lives in pixel.js (16-pixel tiles, pure pixel art)
  const api = { W, H, T, g, plots, objects, occ, trees, DOCK, ARENA, lots, blocked, plotAt, findPath, nearestOpen, hash };
  api.renderStatic = () => TG.pixel.renderStatic(api);
  TG.vworld = api;
})(window.TG);
