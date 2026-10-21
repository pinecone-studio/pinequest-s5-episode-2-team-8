/* Нутаг pixel art: every tile, sprite and icon is drawn pixel by pixel in code.
   Original art in a cozy farm-game style. No image files, no licenses. */
(function (TG) {
  const K = {
    out: '#2b1e2e', grass: '#76b947', grassD: '#5c9a36', grassL: '#94d260',
    leaf: '#57963a', leafD: '#3f7a2c', leafL: '#7cc04e', treeOut: '#2a4f1f', pine: '#3f8a57', pineD: '#2c6a44', pineL: '#5aaa6e',
    dirt: '#d8ab6c', dirtD: '#b78a4f', dirtL: '#ebc792', stone: '#d9cdb5', stoneD: '#b6a68a', stoneL: '#ece3d0',
    soil: '#8c5a33', soilD: '#6e4425', wet: '#5b361a', wetD: '#43260f',
    wood: '#a46d3b', woodD: '#6b4220', woodL: '#c99257',
    water: '#4aa6e2', waterD: '#3a88c8', waterL: '#93d4f6', foam: '#e6f7ff',
    rock: '#a5a5b0', rockD: '#77778a', rockL: '#d3d3dc',
    white: '#ffffff', felt: '#f4efe3', feltD: '#d8cfba', red: '#e14b3d', redD: '#a8312a', blue: '#3f76db', blueD: '#2b52a5',
    gold: '#f7c646', goldD: '#c98f22', orange: '#f39b2c', orangeD: '#c46d12', pink: '#f492ba', purple: '#a97de9', purpleD: '#7d57c4',
    brown: '#8a5a33', fur: '#ecd2a8', paper: '#f6dca8', eye: '#1e1a22', boot: '#4a3426', hair: '#3a2516', hairL: '#5a3a22', blush: '#f2a0a0',
    sky: '#9fd8f7', crop: '#4fa03a', cropD: '#357a28', cropL: '#86d05a', light: '#8fd0ff',
  };
  const DEEL = { blue: ['#3f76db', '#2b52a5', '#7fa6ee'], red: ['#e14b3d', '#a8312a', '#f08a7e'], green: ['#2ea35f', '#1d7442', '#6fd096'],
    purple: ['#9466e0', '#6a42b5', '#c2a2f2'], pink: ['#f06ca8', '#c2427e', '#f8a8cc'], gold: ['#e9a91f', '#b07a10', '#f7d071'] };
  const SKIN = { '#F6D3B3': ['#f6d3b3', '#e0b18c'], '#EDBB93': ['#edbb93', '#d29a6e'], '#D9A06E': ['#d9a06e', '#b9824f'], '#B97A4A': ['#b97a4a', '#94592f'] };

  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  // ------------------------------------------------------------ pixel helpers (integer coordinates only)
  const hash = (x, y) => { let n = x * 374761393 + y * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return { c, x }; };
  const R = (x, X, Y, w, h, col) => { if (w <= 0 || h <= 0) return; x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); };
  const P = (x, X, Y, col) => R(x, X, Y, 1, 1, col);
  function ell(x, cx, cy, rx, ry, col, maxY) {
    for (let dy = -ry; dy <= ry; dy++) {
      if (maxY !== undefined && cy + dy > maxY) continue;
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))));
      R(x, cx - hw, cy + dy, hw * 2 + 1, 1, col);
    }
  }
  function line(x, x0, y0, x1, y1, col) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (let i = 0; i < 200; i++) { P(x, x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  /** Outlined blob: dark ring then fill. */
  const blob = (x, cx, cy, rx, ry, fill, out) => { ell(x, cx, cy, rx + 1, ry + 1, out || K.out); ell(x, cx, cy, rx, ry, fill); };

  // ------------------------------------------------------------ terrain tiles (16×16)
  function grass(x, X, Y, tx, ty) {
    R(x, X, Y, 16, 16, K.grass);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const n = hash(tx * 16 + px, ty * 16 + py); if (n < 0.06) P(x, X + px, Y + py, K.grassD); else if (n > 0.96) P(x, X + px, Y + py, K.grassL); }
    if (hash(tx, ty) > 0.55) { const ox = X + 3 + Math.floor(hash(ty, tx) * 9), oy = Y + 4 + Math.floor(hash(tx + 7, ty) * 8); [[0, 2], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [3, 1], [3, 2], [4, 2]].forEach(([a, b]) => P(x, ox + a, oy + b, K.grassD)); P(x, ox + 2, oy, K.grassL); }
  }
  function dirt(x, X, Y, tx, ty, nb) {
    R(x, X, Y, 16, 16, K.dirt);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const n = hash(tx * 16 + px + 999, ty * 16 + py); if (n < 0.07) P(x, X + px, Y + py, K.dirtD); else if (n > 0.95) P(x, X + px, Y + py, K.dirtL); }
    const edge = (side) => {
      for (let i = 0; i < 16; i++) {
        const d = hash(tx * 31 + i, ty * 17 + side) > 0.55 ? 2 : 1;
        for (let k = 0; k < d; k++) {
          const [px, py] = side === 0 ? [i, k] : side === 1 ? [i, 15 - k] : side === 2 ? [k, i] : [15 - k, i];
          P(x, X + px, Y + py, k === d - 1 ? K.grassD : K.grass);
        }
      }
    };
    nb.forEach((isGrass, side) => isGrass && edge(side));
  }
  function plaza(x, X, Y, tx, ty) {
    R(x, X, Y, 16, 16, K.stone);
    for (let row = 0; row < 2; row++) {
      R(x, X, Y + row * 8, 16, 1, K.stoneD);
      const off = (ty * 2 + row) % 2 ? 4 : 0;
      for (const vx of [off, off + 8]) R(x, X + (vx % 16), Y + row * 8, 1, 8, K.stoneD);
      for (let i = 0; i < 3; i++) P(x, X + Math.floor(hash(tx + i, ty + row) * 15), Y + row * 8 + 2 + Math.floor(hash(ty, tx + i) * 4), K.stoneL);
    }
  }
  function water(x, X, Y, tx, ty, nb) {
    R(x, X, Y, 16, 16, K.water);
    for (let py = 0; py < 16; py++) if ((py + tx * 3 + ty * 5) % 9 === 0) for (let px = 0; px < 16; px++) if (hash(tx * 16 + px, ty * 16 + py) > 0.35) P(x, X + px, Y + py, K.waterD);
    const [up, down, left, right] = nb;
    if (up) { R(x, X, Y, 16, 1, K.foam); R(x, X, Y + 1, 16, 1, K.waterL); }
    if (down) { R(x, X, Y + 15, 16, 1, K.waterL); }
    if (left) { R(x, X, Y, 1, 16, K.foam); R(x, X + 1, Y, 1, 16, K.waterL); }
    if (right) { R(x, X + 15, Y, 1, 16, K.foam); R(x, X + 14, Y, 1, 16, K.waterL); }
  }
  function soil(x, X, Y, tx, ty) {
    R(x, X, Y, 16, 16, K.soil);
    for (let r = 0; r < 3; r++) { R(x, X + 1, Y + 3 + r * 5, 14, 1, K.soilD); for (let i = 0; i < 3; i++) P(x, X + 2 + Math.floor(hash(tx + r, ty + i) * 12), Y + 1 + r * 5, K.dirtD); }
    R(x, X, Y, 16, 1, K.soilD); R(x, X, Y, 1, 16, K.soilD); R(x, X + 15, Y, 1, 16, '#9c6a40'); R(x, X, Y + 15, 16, 1, '#9c6a40');
  }
  function fence(x, X, Y, nb) {
    const [up, down, left, right] = nb;
    if (left) { R(x, X, Y + 5, 8, 3, K.woodD); R(x, X, Y + 5, 8, 2, K.wood); R(x, X, Y + 10, 8, 3, K.woodD); R(x, X, Y + 10, 8, 2, K.wood); }
    if (right) { R(x, X + 8, Y + 5, 8, 3, K.woodD); R(x, X + 8, Y + 5, 8, 2, K.wood); R(x, X + 8, Y + 10, 8, 3, K.woodD); R(x, X + 8, Y + 10, 8, 2, K.wood); }
    if (up) { R(x, X + 6, Y, 4, 4, K.woodD); R(x, X + 7, Y, 2, 4, K.wood); }
    if (down) { R(x, X + 6, Y + 12, 4, 4, K.woodD); R(x, X + 7, Y + 12, 2, 4, K.wood); }
    R(x, X + 5, Y + 2, 6, 13, K.woodD); R(x, X + 6, Y + 2, 4, 12, K.wood); R(x, X + 6, Y + 2, 1, 12, K.woodL); R(x, X + 6, Y + 2, 4, 1, K.woodL);
  }
  function dock(x, X, Y) {
    R(x, X, Y + 2, 16, 12, K.woodD); R(x, X, Y + 3, 16, 10, K.wood);
    for (let i = 0; i < 16; i += 4) { R(x, X + i, Y + 3, 1, 10, K.woodD); R(x, X + i + 1, Y + 3, 1, 10, K.woodL); }
    R(x, X + 1, Y + 13, 2, 3, K.woodD); R(x, X + 13, Y + 13, 2, 3, K.woodD);
  }
  function rock(x, X, Y) { blob(x, X + 8, Y + 10, 5, 3, K.rock); ell(x, X + 7, Y + 9, 3, 1, K.rockL); P(x, X + 11, Y + 12, K.rockD); P(x, X + 5, Y + 12, K.rockD); }
  function flower(x, X, Y, col) { P(x, X, Y - 1, col); P(x, X - 1, Y, col); P(x, X + 1, Y, col); P(x, X, Y + 1, col); P(x, X, Y, K.gold); P(x, X, Y + 2, K.grassD); }

  // ------------------------------------------------------------ big sprites
  function tree(x, tx, ty, pine) {
    const X = tx * 16, Y = ty * 16;
    ell(x, X + 8, Y + 14, 6, 2, 'rgba(20,40,10,.25)');
    R(x, X + 6, Y + 5, 4, 10, K.woodD); R(x, X + 7, Y + 5, 2, 9, K.wood); P(x, X + 7, Y + 7, K.woodL);
    if (pine) {
      for (let t = 0; t < 4; t++) {
        const top = Y - 12 + t * 5, w = 2 + t * 2;
        for (let r = 0; r < 6; r++) { const hw = Math.round((w * (r + 1)) / 6) + 1; R(x, X + 8 - hw - 1, top + r, hw * 2 + 3, 1, K.treeOut); }
        for (let r = 0; r < 6; r++) { const hw = Math.round((w * (r + 1)) / 6); R(x, X + 8 - hw, top + r, hw * 2 + 1, 1, r < 2 ? K.pineL : K.pine); R(x, X + 8, top + r, hw + 1, 1, r < 2 ? K.pine : K.pineD); }
      }
      return;
    }
    blob(x, X + 8, Y - 3, 9, 8, K.leafD, K.treeOut);
    ell(x, X + 7, Y - 5, 7, 6, K.leaf);
    ell(x, X + 5, Y - 8, 3, 2, K.leafL);
    for (let i = 0; i < 9; i++) P(x, X + 2 + Math.floor(hash(tx * 3 + i, ty) * 12), Y - 9 + Math.floor(hash(ty * 5 + i, tx) * 10), i % 3 ? K.leafD : K.leafL);
  }
  const ICON7 = {
    heart: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
    pad: ['.kkkkk.', 'kwkwwgk', 'kkkwgwk', 'kwkwwgk', '.kkkkk.'],
    coin: ['.yyy.', 'yYyYy', 'yyYyy', 'yYyYy', '.yyy.'],
  };
  function glyph(x, X, Y, rows, map) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && map[ch]) P(x, X + i, Y + j, map[ch]); })); }
  function ger(x, o) {
    const X = o.x * 16, Y = o.y * 16, acc = o.roof ? [o.roof, shade(o.roof, -0.3)] : o.accent === '#7A5AF8' ? [K.purple, K.purpleD] : [K.blue, K.blueD], dc = o.doorCol || K.red;
    ell(x, X + 24, Y + 46, 22, 2, 'rgba(20,40,10,.25)');
    R(x, X + 3, Y + 24, 42, 22, K.out); R(x, X + 4, Y + 25, 40, 20, K.felt); R(x, X + 36, Y + 25, 8, 20, K.feltD);
    R(x, X + 4, Y + 28, 40, 3, acc[0]); for (let i = 5; i < 44; i += 3) P(x, X + i, Y + 29, K.white);
    for (let cx = 1; cx < 47; cx++) { const dx = (cx - 24) / 23; const top = Y + 26 - Math.round(19 * Math.sqrt(Math.max(0, 1 - dx * dx))); P(x, X + cx, top - 1, K.out); R(x, X + cx, top, 1, Y + 26 - top, cx > 36 ? '#ece6d8' : K.white); }
    for (let i = 0; i < 6; i++) line(x, X + 24, Y + 9, X + 5 + i * 7.6 | 0, Y + 25, acc[0]);
    R(x, X + 1, Y + 25, 46, 1, K.out);
    blob(x, X + 24, Y + 8, 3, 1, '#e8a33d');
    R(x, X + 19, Y + 32, 10, 14, K.out); R(x, X + 20, Y + 33, 8, 13, dc); R(x, X + 21, Y + 34, 6, 11, shade(dc, -0.3)); R(x, X + 22, Y + 35, 4, 9, dc);
    R(x, X + 21, Y + 34, 6, 1, K.gold); P(x, X + 26, Y + 40, K.gold);
    if (o.id === 'arcade' || o.id === 'home') glyph(x, X + 33, Y + 34, o.id === 'arcade' ? ICON7.pad : ICON7.heart, { x: K.red, k: K.out, w: K.white, g: K.gold });
    else { R(x, X + 33, Y + 33, 7, 5, K.out); R(x, X + 34, Y + 34, 5, 3, acc[0]); P(x, X + 36, Y + 35, K.gold); }
  }
  function shop(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    ell(x, X + 32, Y + 46, 30, 2, 'rgba(20,40,10,.25)');
    R(x, X + 1, Y + 19, 62, 28, K.out);
    for (let i = 0; i < 15; i++) R(x, X + 2 + i * 4, Y + 20, 4, 26, i % 2 ? K.white : K.blue);
    for (let col = 0; col < 64; col++) { const top = Y + 2 + Math.round((Math.abs(col - 32) * 18) / 32); P(x, X + col, top - 1, K.out); R(x, X + col, top, 1, Y + 22 - top, col > 32 ? K.redD : K.red); }
    for (let i = 0; i < 8; i++) { ell(x, X + 4 + i * 8, Y + 22, 3, 1, K.redD); }
    [[32, 1, K.gold], [2, 19, K.crop], [61, 19, K.blue]].forEach(([fx, fy, col]) => { R(x, X + fx, Y + fy - 8, 1, 8, K.woodD); for (let r = 0; r < 4; r++) R(x, X + fx + 1, Y + fy - 8 + r, 4 - Math.abs(r - 1.5) * 1.5 | 0 || 1, 1, col); });
    R(x, X + 8, Y + 34, 48, 12, K.out); R(x, X + 9, Y + 35, 46, 10, K.wood); R(x, X + 9, Y + 35, 46, 1, K.woodL);
    [[12, K.orange], [17, K.red], [22, K.crop], [27, K.gold]].forEach(([gx, col]) => { R(x, X + gx, Y + 32, 4, 3, col); P(x, X + gx + 1, Y + 31, K.crop); });
    R(x, X + 36, Y + 31, 6, 3, K.red); R(x, X + 35, Y + 33, 8, 1, K.redD);
    R(x, X + 46, Y + 31, 6, 3, K.white); R(x, X + 47, Y + 30, 2, 1, K.eye);
    R(x, X + 22, Y + 23, 20, 8, K.out); R(x, X + 23, Y + 24, 18, 6, K.paper); glyph(x, X + 30, Y + 24, ICON7.coin, { y: K.gold, Y: K.goldD });
  }
  function board(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    R(x, X + 4, Y + 2, 2, 13, K.woodD); R(x, X + 26, Y + 2, 2, 13, K.woodD);
    R(x, X + 1, Y - 8, 30, 13, K.out); R(x, X + 2, Y - 7, 28, 11, K.wood); R(x, X + 2, Y - 7, 28, 1, K.woodL);
    [[4, -6, K.red], [12, -5, K.blue], [20, -6, K.crop]].forEach(([dx, dy, pin]) => { R(x, X + dx, Y + dy, 7, 8, K.white); R(x, X + dx + 1, Y + dy + 3, 5, 1, K.feltD); R(x, X + dx + 1, Y + dy + 5, 4, 1, K.feltD); P(x, X + dx + 3, Y + dy + 1, pin); });
  }
  function well(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    blob(x, X + 8, Y + 11, 6, 3, K.rock); ell(x, X + 8, Y + 11, 4, 1, K.waterD); P(x, X + 6, Y + 11, K.waterL);
    R(x, X + 2, Y - 3, 2, 13, K.woodD); R(x, X + 12, Y - 3, 2, 13, K.woodD);
    for (let r = 0; r < 5; r++) R(x, X + 7 - r * 2, Y - 8 + r, 2 + r * 4, 1, r === 0 ? K.out : K.red);
    R(x, X - 1, Y - 3, 18, 1, K.out);
  }
  function lantern(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    R(x, X + 7, Y - 2, 2, 17, K.out);
    R(x, X + 5, Y - 9, 6, 7, K.out); R(x, X + 6, Y - 8, 4, 5, K.gold); P(x, X + 6, Y - 8, K.white); R(x, X + 4, Y - 10, 8, 1, K.out);
  }

  function sand(x, X, Y, tx, ty, nb) {
    R(x, X, Y, 16, 16, '#e8c994');
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const n = hash(tx * 16 + px + 77, ty * 16 + py); if (n < 0.08) P(x, X + px, Y + py, '#d4ae72'); else if (n > 0.95) P(x, X + px, Y + py, '#f6e2b8'); }
    const [up, down, left, right] = nb;
    if (up) R(x, X, Y, 16, 2, '#b98a50'); if (down) R(x, X, Y + 14, 16, 2, '#b98a50'); if (left) R(x, X, Y, 2, 16, '#b98a50'); if (right) R(x, X + 14, Y, 2, 16, '#b98a50');
  }
  function lot(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    R(x, X + 2, Y + 6, 44, 40, '#c8a06a'); for (let i = 0; i < 40; i++) P(x, X + 3 + Math.floor(hash(o.i, i) * 42), Y + 7 + Math.floor(hash(i, o.i) * 38), i % 2 ? '#b38a55' : '#d8b47e');
    for (const [cx, cy] of [[2, 6], [44, 6], [2, 44], [44, 44]]) { R(x, X + cx, Y + cy - 4, 2, 6, K.woodD); }
    R(x, X + 21, Y + 22, 2, 12, K.woodD); R(x, X + 14, Y + 16, 16, 8, K.out); R(x, X + 15, Y + 17, 14, 6, K.paper); glyph(x, X + 20, Y + 17, ICON7.coin, { y: K.gold, Y: K.goldD });
  }
  function bleachers(x, o) {
    const X = o.x * 16, Y = o.y * 16 - 10;
    R(x, X, Y, o.w * 16, 42, K.out); R(x, X + 1, Y + 1, o.w * 16 - 2, 40, K.woodD);
    for (let row = 0; row < 3; row++) {
      const ry = Y + 4 + row * 12; R(x, X + 2, ry + 8, o.w * 16 - 4, 3, K.wood); R(x, X + 2, ry + 8, o.w * 16 - 4, 1, K.woodL);
      for (let i = 0; i < o.w * 2 - 1; i++) {
        if (hash(i, row + 3) < 0.25) continue;
        const sx = X + 6 + i * 8 + (row % 2) * 3, shirt = [K.red, K.blue, K.gold, K.crop, K.purple, K.white][Math.floor(hash(i * 3, row) * 6)];
        R(x, sx - 2, ry + 4, 5, 4, shirt); R(x, sx - 1, ry + 1, 3, 3, hash(i, row) > 0.5 ? '#edbb93' : '#d9a06e'); R(x, sx - 1, ry, 3, 1, K.hair);
      }
    }
    for (let i = 0; i < 6; i++) { const fx = X + 8 + i * 36; R(x, fx, Y - 10, 1, 11, K.woodD); for (let r = 0; r < 4; r++) R(x, fx + 1, Y - 10 + r, 4 - Math.abs(r - 1.5) * 1.5 | 0 || 1, 1, [K.red, K.blue, K.gold][i % 3]); }
  }
  function ovoo(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    ell(x, X + 16, Y + 28, 14, 3, 'rgba(20,40,10,.25)');
    for (let r = 0; r < 10; r++) { const w = 3 + r * 1.3 | 0; for (let i = -w; i <= w; i += 3) blob(x, X + 16 + i + (r % 2), Y + 6 + r * 2, 1, 1, [K.rock, K.rockL, K.rockD][(i + r + 9) % 3]); }
    R(x, X + 15, Y - 10, 2, 18, K.woodD);
    [[-8, 2, K.light], [6, 4, K.blue], [-4, -3, K.light], [3, -6, K.white]].forEach(([dx, dy, c]) => line(x, X + 16, Y - 8, X + 16 + dx, Y + dy + 4, c));
    R(x, X + 13, Y - 12, 6, 2, K.blue);
  }
  function arenaFlags(x, A) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, fx = Math.round((A.cx + Math.cos(a) * (A.rx + 0.6)) * 16), fy = Math.round((A.cy + Math.sin(a) * (A.ry + 0.6)) * 16);
      R(x, fx, fy - 12, 1, 12, K.woodD); const col = [K.blue, K.red, K.gold, K.white][i % 4];
      for (let r = 0; r < 4; r++) R(x, fx + 1, fy - 12 + r, 5 - Math.abs(r - 1.5) * 2 | 0 || 1, 1, col);
    }
  }
  /** Player ger sprite (48×48), cached by colours. */
  const gerCache = new Map();
  function gerSprite(roof, door) {
    const key = roof + door; if (gerCache.has(key)) return gerCache.get(key);
    const m = mk(48, 50); m.x.translate(0, 2); ger(m.x, { x: 0, y: 0, roof, doorCol: door, id: 'own' }); gerCache.set(key, m.c); return m.c;
  }
  /** Ger interior for the home panel. Items appear when owned. */
  function interior(canvas, roof, furn) {
    const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false; const W2 = canvas.width, H2 = canvas.height, cx = W2 / 2;
    R(x, 0, 0, W2, H2, '#3a2a1e');
    ell(x, cx, H2 / 2 + 6, W2 / 2 - 6, H2 / 2 - 10, '#8c6a46'); ell(x, cx, H2 / 2 + 6, W2 / 2 - 10, H2 / 2 - 14, '#e9dcc0');
    for (let a = 0; a < 28; a++) { const t = (a / 28) * Math.PI * 2; line(x, cx, 22, Math.round(cx + Math.cos(t) * (W2 / 2 - 8)), Math.round(H2 / 2 + 6 + Math.sin(t) * (H2 / 2 - 12)), 'rgba(181,118,58,.35)'); }
    ell(x, cx, H2 / 2 + 6, W2 / 2 - 6, H2 / 2 - 10, 'rgba(0,0,0,0)');
    for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2, px = Math.round(cx + Math.cos(t) * (W2 / 2 - 8)), py = Math.round(H2 / 2 + 6 + Math.sin(t) * (H2 / 2 - 12)); R(x, px - 1, py - 1, 3, 3, roof); }
    blob(x, cx, 22, 7, 4, '#e8a33d'); line(x, cx - 7, 22, cx + 7, 22, K.woodD); line(x, cx, 18, cx, 26, K.woodD);
    R(x, cx - 9, H2 - 12, 18, 10, shade(roof, -0.2)); R(x, cx - 7, H2 - 10, 14, 8, K.red);
    const has = (id) => furn.includes(id);
    if (has('shirdeg')) { R(x, cx - 26, H2 / 2 + 12, 52, 22, K.out); R(x, cx - 25, H2 / 2 + 13, 50, 20, K.red); R(x, cx - 22, H2 / 2 + 16, 44, 14, K.gold); R(x, cx - 18, H2 / 2 + 19, 36, 8, K.blue); for (let i = 0; i < 5; i++) P(x, cx - 14 + i * 7, H2 / 2 + 22, K.white); }
    if (has('tulga')) { R(x, cx - 8, H2 / 2 - 6, 16, 14, K.out); R(x, cx - 7, H2 / 2 - 5, 14, 12, '#5a5a66'); R(x, cx - 5, H2 / 2 + 1, 10, 4, K.orange); P(x, cx - 2, H2 / 2 + 2, K.gold); R(x, cx - 1, 26, 3, H2 / 2 - 32, '#4a4a55'); }
    if (has('avdar')) { R(x, cx - 22, 30, 44, 16, K.out); R(x, cx - 21, 31, 42, 14, K.orange); R(x, cx - 21, 31, 42, 3, K.red); for (let i = 0; i < 4; i++) R(x, cx - 17 + i * 10, 36, 6, 6, K.blue); }
    if (has('morinkhuur')) { R(x, cx + 26, 26, 4, 30, K.out); R(x, cx + 27, 27, 2, 28, K.wood); blob(x, cx + 28, 56, 4, 6, K.wood); R(x, cx + 25, 24, 6, 4, K.woodD); }
    if (has('or')) { R(x, 18, H2 / 2 - 8, 22, 40, K.out); R(x, 19, H2 / 2 - 7, 20, 38, K.wood); R(x, 21, H2 / 2 - 5, 16, 34, K.white); R(x, 21, H2 / 2 - 5, 16, 8, K.light); R(x, W2 - 40, H2 / 2 - 8, 22, 40, K.out); R(x, W2 - 39, H2 / 2 - 7, 20, 38, K.wood); R(x, W2 - 37, H2 / 2 - 5, 16, 34, K.white); R(x, W2 - 37, H2 / 2 - 5, 16, 8, K.pink); }
    if (has('shagai')) { blob(x, cx + 34, H2 - 26, 5, 4, K.woodL); P(x, cx + 32, H2 - 27, K.white); P(x, cx + 35, H2 - 25, K.white); }
  }
  /** Wrestler in zodog-shuudag (vest and briefs) with gutal boots, facing right. pose: grip | push | fall | dance */
  function wrestler(col, skin, pose, frame) {
    const key = ['w', col, skin, pose, frame].join(); if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(28, 32), D = shade(col, -0.3);
    if (pose === 'fall') {
      R(x, 2, 24, 24, 6, K.out); R(x, 3, 25, 6, 4, skin); R(x, 9, 25, 6, 4, col); R(x, 15, 25, 6, 4, skin); R(x, 21, 24, 5, 5, K.boot); blob(x, 4, 23, 3, 3, skin); P(x, 3, 22, K.hair);
      cache.set(key, c); return c;
    }
    const lean = pose === 'push' ? 3 : pose === 'grip' ? 1 : 0, up = pose === 'dance' ? (frame ? -3 : 1) : 0;
    R(x, 7, 26, 5, 5, K.out); R(x, 8, 27, 4, 4, '#8a4a22'); R(x, 15, 26, 6, 5, K.out); R(x, 16, 27, 5, 4, '#8a4a22'); P(x, 21, 27, '#8a4a22');
    R(x, 8, 20, 3, 7, skin); R(x, 16, 20, 3, 7, skin);
    R(x, 7 + lean, 17, 13, 5, K.out); R(x, 8 + lean, 18, 11, 3, col);
    R(x, 8 + lean, 9, 11, 9, K.out); R(x, 9 + lean, 10, 9, 7, skin); R(x, 9 + lean, 10, 3, 7, col); R(x, 9 + lean, 10, 9, 2, col); R(x, 15 + lean, 12, 3, 4, shade(skin, -0.12));
    if (pose === 'dance') { R(x, 1, 10 + up, 8, 3, col); R(x, 19, 10 + up, 8, 3, col); R(x, 0, 11 + up, 2, 2, skin); R(x, 26, 11 + up, 2, 2, skin); }
    else { R(x, 17 + lean, 11, 8, 3, col); R(x, 24 + lean > 26 ? 25 : 24 + lean, 11, 3, 3, skin); R(x, 6 + lean, 11, 4, 5, D); }
    blob(x, 13 + lean, 6, 3, 3, skin); R(x, 11 + lean, 2, 6, 2, K.hair); P(x, 15 + lean, 6, K.eye);
    if (pose === 'dance') { R(x, 10, 0, 7, 2, K.red); R(x, 12, -1, 3, 2, K.gold); }
    cache.set(key, c); return c;
  }

  /** Static world layer at 1 pixel per art pixel (16 px tiles). */
  function renderStatic(W) {
    const { g, objects, trees } = W, w = W.W, h = W.H;
    const { c, x } = mk(w * 16, h * 16);
    const at = (tx, ty) => (g[ty] || [])[tx];
    const grassy = (ch) => ch && 'gTrfB'.includes(ch);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const ch = g[ty][tx], X = tx * 16, Y = ty * 16, nb4 = [at(tx, ty - 1), at(tx, ty + 1), at(tx - 1, ty), at(tx + 1, ty)];
      const inPlaza = tx >= 15 && tx <= 20 && ty >= 10 && ty <= 15;
      if (ch === 'p') dirt(x, X, Y, tx, ty, nb4.map(grassy));
      else if (ch === 's' || (ch === 'B' && inPlaza)) plaza(x, X, Y, tx, ty);
      else if (ch === 'w' || ch === 'd') { water(x, X, Y, tx, ty, nb4.map((n) => n && n !== 'w' && n !== 'd')); if (ch === 'd') dock(x, X, Y); }
      else if (ch === 'o') soil(x, X, Y, tx, ty);
      else if (ch === 'a') sand(x, X, Y, tx, ty, nb4.map((n) => n !== 'a'));
      else { grass(x, X, Y, tx, ty); if (ch === 'f') fence(x, X, Y, nb4.map((n) => n === 'f')); if (ch === 'r') rock(x, X, Y); }
    }
    for (let ty = 2; ty < h - 1; ty++) for (let tx = 1; tx < w - 1; tx++) if (g[ty][tx] === 'g' && hash(tx * 3, ty * 7) < 0.1) flower(x, tx * 16 + 4 + Math.floor(hash(tx, ty) * 8), ty * 16 + 5 + Math.floor(hash(ty, tx) * 7), [K.pink, K.gold, K.white, K.purple][Math.floor(hash(tx, ty * 5) * 4)]);
    if (W.ARENA) arenaFlags(x, W.ARENA);
    const draws = [...trees.map((t) => ({ y: t.y, f: () => tree(x, t.x, t.y, t.pine) })), ...objects.filter((o) => o.kind !== 'npc').map((o) => ({ y: o.y + o.h - 1, f: () => ({ ger, shop, board, well, lantern, lot, bleachers, ovoo })[o.kind](x, o) }))];
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());
    return c;
  }

  // ------------------------------------------------------------ crops (drawn every frame on the pixel buffer)
  function crop(x, X, Y, c, s, wetSoil, blink) {
    if (wetSoil && s < 3) { x.fillStyle = 'rgba(55,28,10,.38)'; x.fillRect(X + 1, Y + 1, 14, 14); }
    if (s === 0) { P(x, X + 4, Y + 9, K.wetD); P(x, X + 8, Y + 6, K.wetD); P(x, X + 11, Y + 10, K.wetD); return; }
    if (s === 1) { R(x, X + 7, Y + 8, 1, 4, K.cropD); P(x, X + 6, Y + 8, K.crop); P(x, X + 5, Y + 7, K.cropL); P(x, X + 8, Y + 8, K.crop); P(x, X + 9, Y + 7, K.cropL); return; }
    if (s === 2) { blob(x, X + 8, Y + 9, 4, 2, K.crop, K.cropD); P(x, X + 6, Y + 8, K.cropL); P(x, X + 10, Y + 8, K.cropL); return; }
    switch (c) {
      case 'carrot': for (let i = 0; i < 5; i++) line(x, X + 8, Y + 9, X + 4 + i * 2, Y + 3 + (i % 2), i % 2 ? K.crop : K.cropL); R(x, X + 6, Y + 9, 5, 3, K.orangeD); R(x, X + 6, Y + 9, 4, 2, K.orange); break;
      case 'potato': blob(x, X + 8, Y + 7, 5, 3, K.crop, K.cropD); P(x, X + 6, Y + 6, K.cropL); R(x, X + 3, Y + 11, 3, 2, '#c8a26b'); R(x, X + 10, Y + 12, 3, 2, '#c8a26b'); P(x, X + 4, Y + 11, '#e0c08a'); break;
      case 'sunflower': R(x, X + 7, Y + 2, 2, 12, K.cropD); P(x, X + 5, Y + 8, K.crop); P(x, X + 6, Y + 9, K.crop); P(x, X + 10, Y + 9, K.crop); P(x, X + 9, Y + 10, K.crop); blob(x, X + 8, Y + 2, 3, 3, K.gold, K.goldD); ell(x, X + 8, Y + 2, 1, 1, K.brown); break;
      case 'cabbage': blob(x, X + 8, Y + 9, 5, 4, '#9fd67a', K.cropD); ell(x, X + 8, Y + 9, 3, 2, '#c6eba5'); line(x, X + 8, Y + 6, X + 8, Y + 12, K.crop); break;
      case 'tomato': R(x, X + 7, Y + 1, 1, 13, K.woodD); for (let i = 0; i < 4; i++) { P(x, X + 6, Y + 3 + i * 3, K.crop); P(x, X + 9, Y + 4 + i * 3, K.crop); } [[4, 5], [10, 7], [5, 10], [10, 11]].forEach(([a, b]) => { R(x, X + a, Y + b, 2, 2, K.red); P(x, X + a, Y + b, '#ff8a7a'); }); break;
      case 'strawberry': blob(x, X + 8, Y + 9, 5, 2, K.crop, K.cropD); [[3, 11], [8, 12], [11, 10]].forEach(([a, b]) => { R(x, X + a, Y + b, 2, 2, '#e8445a'); P(x, X + a + 1, Y + b, K.gold); }); break;
      case 'seabuckthorn': line(x, X + 8, Y + 14, X + 8, Y + 2, K.woodD); line(x, X + 8, Y + 8, X + 3, Y + 4, K.woodD); line(x, X + 8, Y + 6, X + 13, Y + 3, K.woodD); P(x, X + 5, Y + 3, K.cropL); P(x, X + 11, Y + 2, K.cropL); [[4, 5], [5, 6], [7, 3], [9, 5], [11, 4], [12, 5], [7, 9], [9, 10], [8, 7]].forEach(([a, b]) => P(x, X + a, Y + b, K.orange)); [[5, 5], [12, 4], [9, 9]].forEach(([a, b]) => P(x, X + a, Y + b, K.gold)); break;
    }
    if (blink) { P(x, X + 13, Y + 2, K.white); P(x, X + 12, Y + 2, K.gold); P(x, X + 14, Y + 2, K.gold); P(x, X + 13, Y + 1, K.gold); P(x, X + 13, Y + 3, K.gold); }
  }
  function drop(x, X, Y) { R(x, X + 1, Y, 1, 1, K.out); R(x, X, Y + 1, 3, 1, K.out); R(x, X - 1, Y + 2, 5, 3, K.out); R(x, X, Y + 5, 3, 1, K.out); R(x, X, Y + 2, 3, 3, K.blue); P(x, X + 1, Y + 1, K.blue); P(x, X, Y + 2, K.light); }

  // ------------------------------------------------------------ characters (16×28, feet at y=27), cached per look/dir/frame
  const cache = new Map();
  function char(look, dir, frame) {
    const key = JSON.stringify([look.deel, look.skin, look.hat, look.face, look.neck, dir, frame]);
    if (cache.has(key)) return cache.get(key);
    let out;
    if (dir === 1) { const r = char(look, 2, frame); const m = mk(16, 28); m.x.translate(16, 0); m.x.scale(-1, 1); m.x.drawImage(r, 0, 0); out = m.c; }
    else out = drawChar(look, dir, frame);
    cache.set(key, out);
    return out;
  }
  function drawChar(look, dir, frame) {
    const { c, x } = mk(16, 28);
    const [D, DD, DL] = DEEL[look.deel] || DEEL.blue, [S, SD] = SKIN[look.skin] || SKIN['#F6D3B3'];
    const front = dir === 0, back = dir === 3, side = dir === 2;
    // boots
    const lift = (n) => (frame === n ? 1 : 0);
    if (side) { R(x, 6, 24 - lift(1), 3, 3, K.boot); R(x, 8, 24 - lift(2), 3, 3, '#3a2a1e'); }
    else { R(x, 5, 24 - lift(1), 3, 3, K.boot); R(x, 8, 24 - lift(2), 3, 3, K.boot); }
    // deel body
    const bx = side ? 4 : 3, bw = side ? 9 : 10;
    R(x, bx, 15, bw, 10, K.out); R(x, bx + 1, 16, bw - 2, 8, D); R(x, bx + bw - 3, 16, 2, 8, DD); R(x, bx + 1, 23, bw - 2, 1, DD);
    R(x, bx + 1, 20, bw - 2, 1, K.gold);
    if (front) { P(x, 7, 16, DL); P(x, 8, 17, DL); P(x, 9, 18, DL); P(x, 10, 19, DL); }
    if (side) { P(x, 10, 16, DL); P(x, 11, 17, DL); }
    // arms
    if (side) { const sw = frame === 1 ? -1 : frame === 2 ? 1 : 0; R(x, 7 + sw, 16, 3, 6, K.out); R(x, 8 + sw, 16, 1, 5, DD); P(x, 8 + sw, 21, S); }
    else { R(x, 1, 16, 3, 6, K.out); R(x, 12, 16, 3, 6, K.out); R(x, 2, 16, 1, 5, D); R(x, 13, 16, 1, 5, DD); if (front) { P(x, 2, 21, S); P(x, 13, 21, S); } }
    // neck accessories under the head
    if (look.neck === 'scarf') { R(x, bx + 1, 15, bw - 2, 2, K.red); if (front) R(x, 9, 17, 2, 3, K.redD); }
    if (look.neck === 'khadag' && !back) { [[4, 15], [5, 16], [6, 17], [7, 18], [8, 18], [9, 17], [10, 16], [11, 15]].forEach(([a, b]) => { if (side && a < 7) return; R(x, a, b, 1, 2, K.light); }); if (front) { R(x, 4, 17, 1, 5, K.light); R(x, 11, 17, 1, 5, K.light); } }
    if (look.neck === 'medal' && !back) { line(x, 6, 15, 8, 18, K.blue); line(x, 10, 15, 8, 18, K.blue); R(x, 7, 18, 3, 2, K.gold); P(x, 8, 18, K.white); }
    // head
    blob(x, 8, 10, 4, 4, S);
    if (back) ell(x, 8, 10, 4, 4, K.hair);
    else {
      ell(x, 8, 8, 4, 2, K.hair, 8); P(x, 4, 9, K.hair); P(x, 12, 9, K.hair);
      if (side) { ell(x, 6, 10, 2, 3, K.hair); P(x, 11, 11, K.eye); P(x, 12, 12, K.blush); P(x, 7, 9, K.hairL); }
      else { P(x, 6, 11, K.eye); P(x, 10, 11, K.eye); P(x, 5, 12, K.blush); P(x, 11, 12, K.blush); P(x, 6, 7, K.hairL); }
      if (look.face === 'glasses') { if (side) { R(x, 10, 10, 3, 1, K.out); R(x, 10, 12, 3, 1, K.out); P(x, 12, 11, K.out); } else { [[5, 10], [6, 10], [7, 10], [5, 12], [6, 12], [7, 12], [5, 11], [7, 11], [9, 10], [10, 10], [11, 10], [9, 12], [10, 12], [11, 12], [9, 11], [11, 11], [8, 11]].forEach(([a, b]) => P(x, a, b, K.out)); } }
      if (look.face === 'sun') { if (side) R(x, 10, 10, 3, 2, K.out); else { R(x, 5, 10, 3, 2, K.out); R(x, 9, 10, 3, 2, K.out); P(x, 8, 10, K.out); P(x, 6, 10, '#5b6b8a'); P(x, 10, 10, '#5b6b8a'); } }
    }
    // hats
    switch (look.hat) {
      case 'mongol': R(x, 2, 6, 12, 2, K.redD); ell(x, 8, 5, 4, 3, K.red, 6); P(x, 6, 3, '#f08a7e'); R(x, 7, 0, 2, 2, K.gold); if (back) { R(x, 6, 8, 1, 5, K.redD); R(x, 9, 8, 1, 5, K.redD); } break;
      case 'cap': ell(x, 8, 7, 5, 3, K.blue, 7); P(x, 6, 5, '#7fa6ee'); if (front) R(x, 4, 8, 8, 1, K.blueD); if (side) R(x, 11, 7, 4, 2, K.blueD); break;
      case 'flower': for (let i = 3; i <= 13; i++) P(x, i, 6, i % 2 ? [K.pink, K.gold, K.white][i % 3] : K.crop); P(x, 5, 5, K.pink); P(x, 9, 5, K.gold); P(x, 12, 5, K.white); break;
      case 'loovuuz': ell(x, 8, 6, 6, 4, K.brown, 7); P(x, 6, 3, '#a8784a'); R(x, 2, 7, 12, 2, K.fur); if (!side) { R(x, 2, 8, 2, 5, K.fur); R(x, 12, 8, 2, 5, K.fur); } else R(x, 3, 8, 2, 5, K.fur); P(x, 8, 1, K.red); break;
      case 'crown': R(x, 4, 4, 9, 3, K.gold); R(x, 4, 6, 9, 1, K.goldD); [[4, 2], [4, 3], [8, 1], [8, 2], [8, 3], [12, 2], [12, 3]].forEach(([a, b]) => P(x, a, b, K.gold)); P(x, 8, 5, K.red); break;
    }
    return c;
  }
  // animals (facing right; flipped by the caller)
  const ANIMALS = {
    sheep: { w: 16, h: 13, draw: (x, f) => { blob(x, 7, 6, 5, 3, K.white, '#8a8274'); ell(x, 7, 8, 4, 1, K.felt); R(x, 11, 3, 4, 4, '#3b3236'); P(x, 13, 4, K.white); R(x, 10, 3, 1, 2, '#3b3236'); [3, 6, 8, 11].forEach((lx, i) => R(x, lx, 10 + ((f + i) % 2 ? 0 : 0), 1, 3 - ((f + i) % 2), '#3b3236')); } },
    lamb: { w: 12, h: 11, draw: (x, f) => { blob(x, 5, 5, 3, 2, K.white, '#8a8274'); R(x, 8, 2, 3, 3, '#f0d8c0'); P(x, 10, 3, K.eye); [2, 4, 6, 7].forEach((lx, i) => R(x, lx, 8, 1, 3 - ((f + i) % 2), '#8a6a5a')); } },
    puppy: { w: 12, h: 11, draw: (x, f) => { R(x, 1, 4, 8, 4, K.out); R(x, 2, 4, 6, 3, '#2d2629'); R(x, 7, 1, 4, 4, '#2d2629'); P(x, 7, 0, '#2d2629'); P(x, 9, 2, K.white); P(x, 8, 1, K.woodL); P(x, 10, 1, K.woodL); P(x, 11, 3, K.woodL); P(x, 0, 2 + f % 2, '#2d2629'); P(x, 1, 3, '#2d2629'); [2, 3, 6, 7].forEach((lx, i) => R(x, lx, 8, 1, 3 - ((f + i) % 2), '#2d2629')); P(x, 3, 7, K.woodL); } },
    kitten: { w: 12, h: 11, draw: (x, f) => { R(x, 1, 5, 7, 3, K.orange); R(x, 2, 5, 1, 3, K.orangeD); R(x, 4, 5, 1, 3, K.orangeD); R(x, 7, 2, 4, 4, K.orange); P(x, 7, 1, K.orange); P(x, 10, 1, K.orange); P(x, 9, 3, K.eye); P(x, 0, 3 + f % 2, K.orange); P(x, 0, 4, K.orange); [2, 3, 5, 6].forEach((lx, i) => R(x, lx, 8, 1, 3 - ((f + i) % 2), K.orangeD)); } },
    camel: { w: 14, h: 13, draw: (x, f) => { R(x, 2, 6, 8, 3, '#d9a86a'); ell(x, 4, 5, 1, 1, '#d9a86a'); ell(x, 8, 5, 1, 1, '#d9a86a'); R(x, 10, 2, 2, 6, '#d9a86a'); R(x, 10, 1, 4, 2, '#d9a86a'); P(x, 12, 1, K.eye); [3, 4, 8, 9].forEach((lx, i) => R(x, lx, 9, 1, 4 - ((f + i) % 2), '#b98a50')); } },
    foal: { w: 14, h: 13, draw: (x, f) => { R(x, 2, 5, 8, 3, K.wood); R(x, 9, 2, 2, 5, K.wood); R(x, 10, 1, 4, 3, K.wood); P(x, 12, 2, K.eye); R(x, 8, 1, 2, 4, K.woodD); P(x, 1, 5, K.woodD); P(x, 1, 6 + f % 2, K.woodD); [3, 4, 8, 9].forEach((lx, i) => R(x, lx, 8, 1, 5 - ((f + i) % 2), K.woodD)); } },
  };
  function animal(kind, frame) {
    const key = 'a:' + kind + frame; if (cache.has(key)) return cache.get(key);
    const A = ANIMALS[kind]; const { c, x } = mk(A.w, A.h); A.draw(x, frame); cache.set(key, c); return c;
  }

  // ------------------------------------------------------------ UI icons (16×16) for shop, bag, HUD
  const iconCache = new Map();
  function iconCanvas(key) {
    const { c, x } = mk(16, 16);
    const [kind, id] = key.split(':');
    if (kind === 'crop') {
      ({
        carrot: () => { for (let i = 0; i < 3; i++) line(x, 9, 6, 7 + i * 3, 1, K.crop); for (let r = 0; r < 9; r++) R(x, 7 + Math.round(r / 3), 6 + r, 5 - Math.round(r / 2.2), 1, r % 3 ? K.orange : K.orangeD); },
        potato: () => { blob(x, 8, 9, 5, 4, '#c8a26b', '#7a5a33'); P(x, 6, 8, '#7a5a33'); P(x, 10, 10, '#7a5a33'); P(x, 6, 7, '#e8cc98'); },
        sunflower: () => { R(x, 7, 9, 2, 6, K.cropD); P(x, 9, 12, K.crop); for (let a = 0; a < 8; a++) { const ax = Math.round(8 + Math.cos(a * 0.785) * 4), ay = Math.round(6 + Math.sin(a * 0.785) * 4); R(x, ax - 1, ay - 1, 2, 2, K.gold); } blob(x, 8, 6, 2, 2, K.brown); },
        cabbage: () => { blob(x, 8, 9, 6, 5, '#9fd67a', K.cropD); ell(x, 8, 9, 3, 3, '#c6eba5'); line(x, 8, 5, 8, 13, K.crop); },
        tomato: () => { blob(x, 8, 9, 5, 5, K.red, K.redD); P(x, 6, 7, '#ff9a8a'); R(x, 6, 3, 5, 2, K.crop); P(x, 8, 2, K.cropD); },
        strawberry: () => { for (let r = 0; r < 8; r++) R(x, 4 + Math.round(r / 2), 6 + r, 9 - Math.round(r / 1), 1, '#e8445a'); [[6, 8], [9, 8], [7, 10], [10, 10], [8, 12]].forEach(([a, b]) => P(x, a, b, K.gold)); R(x, 5, 4, 7, 2, K.crop); },
        seabuckthorn: () => { line(x, 3, 14, 12, 2, K.woodD); [[6, 9], [7, 10], [8, 8], [9, 7], [10, 6], [5, 11], [9, 5], [11, 4], [7, 7], [10, 8]].forEach(([a, b]) => R(x, a, b, 2, 2, K.orange)); P(x, 8, 8, K.gold); P(x, 10, 6, K.gold); },
      })[id]();
    } else if (kind === 'fish') {
      const col = { perch: ['#8fbf4a', '#5e8a2a', '#3a5a1a'], pike: ['#7a9a5a', '#4e6e36', '#2e4a20'], lenok: ['#c49a6a', '#8a6a42', '#5a3a1e'], taimen: ['#d9705a', '#a8483a', '#6e2a20'] }[id];
      ell(x, 7, 8, 6, 3, K.out); ell(x, 7, 8, 5, 2, col[0]); R(x, 2, 9, 10, 1, col[1]);
      for (let r = -3; r <= 3; r++) R(x, 13, 8 + r, 1 + (3 - Math.abs(r)) * 0 + 1, 1, col[1]);
      R(x, 12, 5, 1, 7, K.out); R(x, 13, 5, 2, 2, col[1]); R(x, 13, 10, 2, 2, col[1]);
      P(x, 3, 7, K.white); P(x, 3, 7, K.eye);
      if (id === 'perch') [5, 8, 10].forEach((sx) => R(x, sx, 6, 1, 4, col[2]));
      if (id === 'lenok' || id === 'taimen') [[5, 7], [8, 6], [9, 9], [6, 9]].forEach(([a, b]) => P(x, a, b, col[2]));
    } else if (kind === 'deel') {
      const [D, DD, DL] = DEEL[id];
      R(x, 4, 2, 8, 13, K.out); R(x, 1, 3, 4, 7, K.out); R(x, 11, 3, 4, 7, K.out);
      R(x, 5, 3, 6, 11, D); R(x, 2, 4, 3, 5, D); R(x, 11, 4, 3, 5, DD); R(x, 9, 3, 2, 11, DD);
      R(x, 5, 9, 6, 1, K.gold); line(x, 6, 3, 9, 6, DL);
    } else if (kind === 'wear' || kind === 'pet') {
      const look = { deel: 'blue', skin: '#F6D3B3', hat: null, face: null, neck: null };
      if (kind === 'wear') look[id.split('-')[0]] = id.split('-')[1];
      if (kind === 'pet') { const a = animal(id, 0); x.drawImage(a, Math.round((16 - a.width) / 2), Math.round((16 - a.height) / 2) + 1); }
      else { const s = char(look, 0, 0); x.drawImage(s, 0, look.neck ? -10 : -1); }
    } else if (kind === 'tool') {
      if (id.startsWith('can')) { const col = id === 'can-3' ? K.blue : id === 'can-2' ? '#5aa0e8' : K.rock; R(x, 3, 6, 9, 8, K.out); R(x, 4, 7, 7, 6, col); R(x, 11, 7, 4, 2, K.out); P(x, 14, 6, K.out); R(x, 5, 3, 5, 1, K.out); R(x, 4, 4, 1, 3, K.out); R(x, 10, 4, 1, 3, K.out); P(x, 5, 8, K.white); }
      else { line(x, 3, 14, 12, 2, K.woodD); line(x, 4, 14, 13, 2, K.wood); line(x, 13, 2, 14, 12, '#cfe8ff'); P(x, 14, 12, K.red); P(x, 14, 13, K.red); }
    } else if (kind === 'furn') {
      ({
        tulga: () => { R(x, 3, 5, 10, 9, K.out); R(x, 4, 6, 8, 7, '#5a5a66'); R(x, 5, 9, 6, 3, K.orange); P(x, 7, 10, K.gold); R(x, 7, 1, 2, 5, '#4a4a55'); },
        shirdeg: () => { R(x, 1, 4, 14, 9, K.out); R(x, 2, 5, 12, 7, K.red); R(x, 3, 6, 10, 5, K.gold); R(x, 5, 7, 6, 3, K.blue); P(x, 7, 8, K.white); P(x, 8, 8, K.white); },
        or: () => { R(x, 1, 5, 14, 8, K.out); R(x, 2, 6, 12, 6, K.wood); R(x, 3, 6, 10, 4, K.white); R(x, 3, 6, 4, 4, K.light); R(x, 1, 12, 2, 3, K.woodD); R(x, 13, 12, 2, 3, K.woodD); },
        avdar: () => { R(x, 2, 4, 12, 9, K.out); R(x, 3, 5, 10, 7, K.orange); R(x, 3, 5, 10, 2, K.red); R(x, 4, 8, 3, 3, K.blue); R(x, 9, 8, 3, 3, K.blue); P(x, 8, 7, K.gold); },
        morinkhuur: () => { R(x, 7, 1, 2, 10, K.wood); R(x, 6, 0, 4, 2, K.woodD); P(x, 9, 1, K.woodD); blob(x, 8, 12, 3, 3, K.wood); line(x, 7, 2, 7, 12, K.white); },
        shagai: () => { blob(x, 8, 9, 5, 4, K.woodL); R(x, 6, 3, 4, 3, K.woodD); [[6, 9], [9, 8], [8, 11]].forEach(([a, b]) => R(x, a, b, 2, 1, K.white)); },
      })[id]();
    } else if (kind === 'ui') {
      ({
        coin: () => { blob(x, 8, 8, 5, 5, K.gold, K.goldD); ell(x, 8, 8, 3, 3, '#f9d76a'); R(x, 7, 5, 3, 1, K.goldD); R(x, 8, 5, 1, 6, K.goldD); R(x, 6, 7, 5, 1, K.goldD); P(x, 6, 5, K.white); },
        drop: () => { for (let r = 0; r < 11; r++) { const w = r < 4 ? r : Math.round(4 * Math.sqrt(1 - ((r - 7) / 4.5) ** 2)); R(x, 8 - w - 1, 3 + r, w * 2 + 3, 1, K.out); } for (let r = 1; r < 10; r++) { const w = r < 4 ? r - 1 : Math.round(3 * Math.sqrt(Math.max(0, 1 - ((r - 7) / 4) ** 2))); R(x, 8 - w, 3 + r, w * 2 + 1, 1, K.blue); } P(x, 6, 9, K.light); P(x, 6, 10, K.light); },
        bag: () => { R(x, 3, 6, 10, 9, K.out); R(x, 4, 7, 8, 7, K.wood); R(x, 4, 7, 8, 2, K.woodL); R(x, 6, 3, 4, 4, K.out); R(x, 7, 4, 2, 2, K.wood); R(x, 7, 9, 2, 2, K.gold); },
        chat: () => { R(x, 2, 3, 12, 8, K.out); R(x, 3, 4, 10, 6, K.white); R(x, 4, 11, 3, 2, K.out); P(x, 5, 11, K.white); [5, 8, 11].forEach((d) => P(x, d, 7, K.out)); },
        scroll: () => { R(x, 3, 2, 10, 12, K.out); R(x, 4, 3, 8, 10, K.paper); R(x, 2, 2, 12, 2, K.woodD); R(x, 2, 12, 12, 2, K.woodD); [5, 7, 9].forEach((ly) => R(x, 5, ly, 6, 1, K.woodL)); },
        seed: () => { R(x, 3, 3, 10, 11, K.out); R(x, 4, 4, 8, 9, K.paper); R(x, 4, 4, 8, 2, K.woodL); P(x, 7, 9, K.crop); P(x, 8, 8, K.crop); P(x, 9, 9, K.cropL); R(x, 8, 9, 1, 3, K.cropD); },
        star: () => { [[7, 2], [8, 2], [7, 3], [8, 3], [6, 4], [9, 4], [2, 6], [13, 6], [3, 7], [12, 7], [5, 8], [10, 8], [4, 11], [11, 11], [3, 13], [12, 13]].forEach(([a, b]) => P(x, a, b, K.goldD)); ell(x, 7.5 | 0, 8, 4, 4, K.gold); P(x, 7, 6, K.white); },
        house: () => { for (let r = 0; r < 6; r++) R(x, 8 - r - 1, 2 + r, r * 2 + 2, 1, K.red); R(x, 3, 8, 10, 6, K.out); R(x, 4, 8, 8, 5, K.felt); R(x, 7, 10, 2, 3, K.woodD); },
        play: () => { R(x, 2, 4, 12, 8, K.out); R(x, 3, 5, 10, 6, K.purple); R(x, 4, 7, 3, 1, K.white); R(x, 5, 6, 1, 3, K.white); P(x, 10, 7, K.gold); P(x, 11, 8, K.gold); },
        shop: () => { for (let r = 0; r < 5; r++) R(x, 8 - r * 1.4 - 1 | 0, 2 + r, (r * 1.4 | 0) * 2 + 3, 1, K.red); R(x, 3, 7, 10, 7, K.out); for (let i = 0; i < 4; i++) R(x, 4 + i * 2, 8, 2, 5, i % 2 ? K.white : K.blue); },
        heart: () => { glyph(x, 4, 5, ICON7.heart, { x: K.red }); },
        fish: () => { const f = iconCanvas('fish:perch'); x.drawImage(f, 0, 0); },
        lock: () => { R(x, 4, 7, 8, 7, K.out); R(x, 5, 8, 6, 5, K.gold); R(x, 5, 3, 6, 5, K.out); R(x, 6, 4, 4, 4, 'rgba(0,0,0,0)'); x.clearRect(6, 4, 4, 3); P(x, 8, 10, K.out); },
        ger: () => { const g = gerSprite(K.blue, K.red); x.drawImage(g, 0, 0, 48, 50, 0, 0, 16, 17); },
        wrestle: () => { const w = wrestler('#e14b3d', '#edbb93', 'dance', 0); x.drawImage(w, 0, 0, 28, 32, 0, 1, 14, 16); const w2 = wrestler('#3f76db', '#d9a06e', 'grip', 0); x.save(); x.translate(16, 1); x.scale(-1, 1); x.drawImage(w2, 0, 0, 28, 32, 0, 0, 10, 12); x.restore(); },
        ovoo: () => { for (let r = 0; r < 5; r++) for (let i = -r; i <= r; i++) R(x, 7 + i * 1.5 | 0, 7 + r * 2, 2, 2, [K.rock, K.rockL, K.rockD][(i + r + 6) % 3]); R(x, 7, 1, 1, 7, K.woodD); line(x, 7, 2, 3, 7, K.light); line(x, 8, 2, 12, 6, K.blue); },
        logo: () => { ell(x, 8, 15, 8, 3, K.grass); blob(x, 12, 3, 2, 2, K.gold, K.goldD); for (let c2 = 2; c2 < 14; c2++) { const dx = (c2 - 8) / 6; const top = 9 - Math.round(4 * Math.sqrt(Math.max(0, 1 - dx * dx))); R(x, c2, top, 1, 10 - top, K.white); P(x, c2, top - 1, K.out); } R(x, 3, 9, 10, 4, K.out); R(x, 4, 9, 8, 3, K.felt); R(x, 4, 9, 8, 1, K.blue); R(x, 7, 10, 2, 3, K.red); },
      })[id]();
    }
    return c;
  }
  function icon(key, size = 32, cls = '') {
    if (!iconCache.has(key)) { try { iconCache.set(key, iconCanvas(key).toDataURL()); } catch (e) { iconCache.set(key, ''); } }
    const img = document.createElement('img');
    img.src = iconCache.get(key); img.width = size; img.height = size; img.alt = ''; img.className = 'px-icon ' + cls; img.draggable = false;
    return img;
  }

  TG.pixel = { K, DEEL, hash, mk, R, P, ell, blob, line, shade, renderStatic, crop, drop, char, animal, icon, iconCanvas, gerSprite, interior, wrestler };
})(window.TG);
