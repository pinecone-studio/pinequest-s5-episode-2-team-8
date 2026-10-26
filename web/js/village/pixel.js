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
    purple: ['#9466e0', '#6a42b5', '#c2a2f2'], pink: ['#f06ca8', '#c2427e', '#f8a8cc'], gold: ['#e9a91f', '#b07a10', '#f7d071'],
    teal: ['#1fa3a3', '#137474', '#6fd0cf'], brown: ['#8a5a33', '#5e3b1e', '#b98a5a'], white: ['#f2eee4', '#c9c1ad', '#ffffff'], black: ['#2d2a33', '#17151b', '#5a5566'] };
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
  /** Trampled earth of a herding yard, with scattered straw and dung. */
  function yard(x, X, Y, tx, ty, nb) {
    R(x, X, Y, 16, 16, '#b89462');
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) { const n = hash(tx * 16 + px + 333, ty * 16 + py); if (n < 0.06) P(x, X + px, Y + py, '#9a7a4e'); else if (n > 0.97) P(x, X + px, Y + py, '#cfae7a'); }
    for (let i = 0; i < 3; i++) { const sx = X + 2 + Math.floor(hash(tx + i, ty * 3) * 12), sy = Y + 2 + Math.floor(hash(ty + i, tx * 5) * 12); line(x, sx, sy, sx + 3, sy - 1, '#e8c86a'); }   // straw
    if (hash(tx, ty + 9) < 0.3) { R(x, X + 9, Y + 10, 3, 2, '#6b4a2a'); P(x, X + 10, Y + 9, '#6b4a2a'); }                                   // dried dung (аргал), the old fuel of the steppe
    nb.forEach((isGrass, side) => { if (!isGrass) return; for (let i = 0; i < 16; i++) { const [px, py] = side === 0 ? [i, 0] : side === 1 ? [i, 15] : side === 2 ? [0, i] : [15, i]; P(x, X + px, Y + py, hash(i, side + tx) > 0.5 ? K.grass : K.grassD); } });
  }
  /** зэл: the rope line between two posts where the foals are tied while their mothers are milked. */
  function zel(x, o) {
    const X = o.x * 16, Y = o.y * 16, w = o.w * 16;
    R(x, X + 2, Y - 2, 3, 16, K.out); R(x, X + 3, Y - 1, 1, 15, K.wood); R(x, X + w - 5, Y - 2, 3, 16, K.out); R(x, X + w - 4, Y - 1, 1, 15, K.wood);
    for (let i = X + 4; i < X + w - 4; i++) P(x, i, Y + 1 + Math.round(Math.sin(((i - X) / w) * Math.PI) * 2), '#8a7a64');
  }
  /** хөхүүр: the leather airag bag on its wooden stand, with the churning stick. */
  function churn(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    R(x, X + 3, Y + 12, 10, 3, K.out); R(x, X + 4, Y + 12, 8, 2, K.wood);
    blob(x, X + 8, Y + 6, 5, 6, '#6b4220', K.out); ell(x, X + 6, Y + 4, 2, 3, '#8a5a33'); P(x, X + 5, Y + 2, '#a46d3b');
    R(x, X + 9, Y - 8, 2, 10, K.out); R(x, X + 9, Y - 7, 1, 9, K.woodL); R(x, X + 7, Y - 9, 6, 2, K.woodD);
  }
  /** тулга: the outdoor iron stove with a big pot, for boiling milk. */
  function tulga(x, o) {
    const X = o.x * 16, Y = o.y * 16;
    for (const lx of [3, 8, 12]) line(x, X + lx, Y + 15, X + 8, Y + 6, K.out);
    R(x, X + 5, Y + 10, 6, 3, '#f39b2c'); P(x, X + 7, Y + 9, '#f7c646'); P(x, X + 9, Y + 11, '#fff2c8');
    blob(x, X + 8, Y + 4, 6, 3, '#77778a', K.out); ell(x, X + 8, Y + 2, 5, 1, '#f6f2e9'); P(x, X + 5, Y + 3, '#a5a5b0');
  }
  /** тавиур: the wooden drying rack with pieces of aaruul drying in the sun. */
  function rack(x, o) {
    const X = o.x * 16, Y = o.y * 16, w = o.w * 16;
    for (const lx of [2, w - 4]) { R(x, X + lx, Y - 4, 2, 18, K.out); R(x, X + lx, Y - 3, 1, 17, K.wood); }
    R(x, X + 1, Y - 2, w - 2, 6, K.out); R(x, X + 2, Y - 1, w - 4, 4, '#c99257');
    for (let i = 4; i < w - 4; i += 3) for (let j = 0; j < 2; j++) { R(x, X + i, Y - 1 + j * 2, 2, 1, '#fff6dc'); P(x, X + i + 1, Y + j * 2, '#e8d6b0'); }
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
    book: ['kkk.kkk', 'kwwkwwk', 'kwwkwwk', 'kwwkwwk', 'kkkkkkk'],
    coin: ['.yyy.', 'yYyYy', 'yyYyy', 'yYyYy', '.yyy.'],
  };
  function glyph(x, X, Y, rows, map) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && map[ch]) P(x, X + i, Y + j, map[ch]); })); }
  /** A real Mongol ger seen from the south: white canvas over felt on a round lattice wall, three wall ropes (бүслүүр),
      a low cone roof with a patterned trim band, the toono crown with its felt flap (өрх) folded back, the stovepipe,
      and a short carved, painted wooden door with its threshold (босго). Lit from the left so it reads as a cylinder. */
  function ger(x, o) {
    const X = o.x * 16, Y = o.y * 16, cx = X + 24;
    const acc = o.roof ? o.roof : o.accent === '#7A5AF8' ? K.purple : o.accent === '#E9A91F' ? '#2f7d5b' : K.blue, accD = shade(acc, -0.32), dc = o.doorCol || '#e8892b';
    const WR = 20, RR = 23;                                                       // wall and roof-eave half widths
    const arc = (i, r, d) => Math.round(d * Math.sqrt(Math.max(0, 1 - (i / r) ** 2)));
    const eaveY = (i) => Y + 25 + arc(i, RR, 3), baseY = (i) => Y + 43 + arc(i, WR, 2);
    const tone = (f, a, b, c, d) => (f < -0.55 ? a : f < 0.15 ? b : f < 0.6 ? c : d);
    ell(x, cx + 2, Y + 46, 24, 3, 'rgba(20,40,10,.22)');
    // wall: felt + canvas, shaded round
    for (let i = -WR; i <= WR; i++) {
      const f = i / WR, top = eaveY(i), bot = baseY(i);
      R(x, cx + i, top, 1, bot - top, tone(f, '#fbf8f1', '#f2ede1', '#e4dccb', '#d2c7b0'));
      R(x, cx + i, bot - 3, 1, 3, tone(f, '#b9aa88', '#ab9b7a', '#998a6a', '#857659'));        // хаяавч: the skirt round the bottom
      P(x, cx + i, bot, K.out);
      for (const off of [5, 10, 15]) P(x, cx + i, top + off, (i + off) % 2 ? tone(f, '#a8957a', '#9c896e', '#8a7860', '#776650') : tone(f, '#c2b296', '#b4a488', '#a29276', '#8e7e64')); // twisted hair ropes
    }
    R(x, cx - WR - 1, eaveY(-WR), 1, baseY(-WR) - eaveY(-WR) + 1, K.out); R(x, cx + WR + 1, eaveY(WR), 1, baseY(WR) - eaveY(WR) + 1, K.out);
    // roof: shallow cone with slightly rounded shoulders
    for (let i = -RR; i <= RR; i++) {
      const a = Math.abs(i), t = a <= 5 ? 0 : (a - 5) / (RR - 5), top = Y + 12 + Math.round(13 * Math.pow(t, 1.25)), bot = eaveY(i), f = i / RR;
      P(x, cx + i, top - 1, K.out);
      R(x, cx + i, top, 1, bot - top, tone(f, '#ffffff', '#f6f2e9', '#e8e1d2', '#d6ccb7'));
      R(x, cx + i, bot - 3, 1, 3, f > 0.55 ? accD : acc);                                      // trim band of the roof cover
      if ((i + 40) % 4 === 0) P(x, cx + i, bot - 2, '#ffffff'); else if ((i + 40) % 4 === 2) { P(x, cx + i, bot - 3, shade(acc, 0.45)); P(x, cx + i, bot - 1, shade(acc, 0.45)); } // хээ pattern
      P(x, cx + i, bot, K.out);
      if (Math.abs(i) <= WR) P(x, cx + i, bot + 1, tone(f, '#d9cfbb', '#cfc4ae', '#bfb39b', '#ad9f86'));  // the eave's shadow on the wall
    }
    for (const s of [-1, 1]) for (const r of [8, 16]) line(x, cx + s * 5, Y + 13, cx + s * r, eaveY(r) - 4, '#cbbfa5');   // roof ropes running down from the crown
    // toono crown and the felt flap folded back over its north half
    ell(x, cx, Y + 12, 6, 2, K.out); ell(x, cx, Y + 12, 5, 1, '#c9772f'); R(x, cx - 3, Y + 12, 7, 1, '#5a3a22');
    R(x, cx - 6, Y + 8, 12, 4, K.out); R(x, cx - 5, Y + 8, 10, 3, '#f1ece0'); R(x, cx + 1, Y + 8, 4, 3, '#ddd5c3');
    line(x, cx - 6, Y + 10, cx - 11, Y + 17, '#9c896e'); line(x, cx + 6, Y + 10, cx + 11, Y + 17, '#9c896e');
    // stovepipe
    R(x, cx + 2, Y + 1, 4, 11, K.out); R(x, cx + 3, Y + 2, 2, 10, '#5d5d6b'); P(x, cx + 3, Y + 3, '#8a8a99'); R(x, cx + 1, Y, 6, 2, '#3a3a44');
    // door: carved frame, painted leaf with a gold border and a knot ornament, wooden threshold
    const dB = baseY(0), dT = dB - 15, fr = shade(dc, -0.4);
    R(x, cx - 6, dT - 1, 13, dB - dT + 1, K.out); R(x, cx - 5, dT, 11, dB - dT, fr);
    R(x, cx - 4, dT + 2, 9, dB - dT - 2, dc); R(x, cx - 4, dT + 2, 9, 1, shade(dc, 0.3));
    R(x, cx - 3, dT + 3, 7, 1, K.gold); R(x, cx - 3, dB - 2, 7, 1, K.gold); R(x, cx - 3, dT + 3, 1, dB - dT - 5, K.gold); R(x, cx + 3, dT + 3, 1, dB - dT - 5, K.gold);
    P(x, cx, dT + 6, '#2b52a5'); P(x, cx - 1, dT + 7, '#2b52a5'); P(x, cx + 1, dT + 7, '#2b52a5'); P(x, cx, dT + 8, '#2b52a5'); P(x, cx, dT + 7, K.gold); // үлзий knot
    P(x, cx - 1, dT + 11, '#2b52a5'); P(x, cx + 1, dT + 11, '#2b52a5'); P(x, cx + 2, dT + 9, shade(dc, -0.25));
    for (let i = -5; i <= 5; i += 2) P(x, cx + i, dT, K.gold);
    R(x, cx - 6, dB, 13, 2, '#6b4220'); R(x, cx - 6, dB, 13, 1, '#a46d3b');
    // little plaque for the town gers
    if (o.id === 'arcade' || o.id === 'home') glyph(x, cx + 9, Y + 32, o.id === 'arcade' ? ICON7.book : ICON7.heart, { x: K.red, k: K.out, w: K.white, g: K.gold });
  }
  /** Монгол бичгийн академи: a traditional hall with a curved green roof, red posts, carved doors and a signboard in vertical script. */
  function academy(x, o) {
    const X = o.x * 16, Y = o.y * 16, G = '#2f7d5b', GL = '#46a077', GD = '#1d5a40';
    ell(x, X + 32, Y + 46, 32, 3, 'rgba(20,40,10,.25)');
    R(x, X + 2, Y + 40, 60, 7, K.out); R(x, X + 3, Y + 41, 58, 5, K.stone); R(x, X + 3, Y + 41, 58, 1, K.stoneL); R(x, X + 24, Y + 45, 16, 2, K.stoneD);
    R(x, X + 6, Y + 19, 52, 22, K.out); R(x, X + 7, Y + 20, 50, 20, '#f2e8d2'); R(x, X + 7, Y + 36, 50, 4, '#c9b48c');
    for (const wx of [11, 45]) { R(x, X + wx, Y + 24, 8, 9, K.out); R(x, X + wx + 1, Y + 25, 6, 7, '#7a4a2a'); for (let i = 0; i < 3; i++) { R(x, X + wx + 1, Y + 26 + i * 2, 6, 1, K.goldD); } R(x, X + wx + 3, Y + 25, 1, 7, K.goldD); }
    for (const px of [7, 21, 40, 54]) { R(x, X + px, Y + 20, 3, 20, K.redD); R(x, X + px, Y + 20, 1, 20, K.red); }
    R(x, X + 25, Y + 24, 14, 16, K.out); R(x, X + 26, Y + 25, 12, 15, '#c2302a'); R(x, X + 31, Y + 25, 2, 15, K.redD);
    for (let i = 0; i < 3; i++) { P(x, X + 28, Y + 28 + i * 4, K.gold); P(x, X + 35, Y + 28 + i * 4, K.gold); }
    R(x, X + 5, Y + 18, 54, 3, GD); for (let i = 7; i < 58; i += 4) { P(x, X + i, Y + 19, K.gold); P(x, X + i + 2, Y + 19, '#e14b3d'); }
    for (let i = -2; i <= 66; i++) {                                         // curved roof with upturned eaves
      const d = i < 16 ? 16 - i : i > 48 ? i - 48 : 0, top = Y + 5 + Math.round(d * 0.7), lift = i < 3 ? 3 - i : i > 61 ? i - 61 : 0, bot = Y + 18 - lift;
      P(x, X + i, top - 1, K.out);
      for (let y = top; y < bot; y++) P(x, X + i, y, (y - Y) % 3 === 0 ? GD : (i + 70) % 4 === 0 ? G : GL);
      P(x, X + i, bot, K.out); P(x, X + i, bot - 1, K.gold);
    }
    R(x, X + 15, Y + 4, 34, 2, K.out); R(x, X + 16, Y + 4, 32, 1, K.gold);
    R(x, X + 30, Y - 3, 4, 8, K.out); R(x, X + 31, Y - 2, 2, 6, K.gold); R(x, X + 29, Y - 5, 6, 3, K.out); R(x, X + 30, Y - 4, 4, 1, K.gold);
    R(x, X + 22, Y + 9, 20, 9, K.out); R(x, X + 23, Y + 10, 18, 7, '#24307a');                                   // signboard: vertical script
    for (let k = 0; k < 4; k++) { const sx = X + 26 + k * 4; R(x, sx, Y + 11, 1, 5, K.gold); P(x, sx - 1, Y + 12 + (k % 2), K.gold); P(x, sx + 1, Y + 14 - (k % 2), K.gold); }
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
  /** A sheep just after shearing: its white wool becomes short, pinkish fleece. */
  const shornCache = new Map();
  function shorn(img) {
    if (shornCache.has(img)) return shornCache.get(img);
    const { c, x } = mk(img.width, img.height); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 0 && p[i] > 200 && p[i + 1] > 195 && p[i + 2] > 180) { const k = p[i] > 235 ? 0 : 1; p[i] = k ? 214 : 236; p[i + 1] = k ? 178 : 204; p[i + 2] = k ? 160 : 186; }
    x.putImageData(d, 0, 0); shornCache.set(img, c); return c;
  }
  /** The felt-making spot by the pasture: a hide on the ground, a wool pile, a water bucket and the roller. */
  let feltMatC = null;
  function feltMat() {
    if (feltMatC) return feltMatC;
    const { c, x } = mk(32, 16), O = K.out;
    ell(x, 14, 10, 13, 5, O); ell(x, 14, 10, 12, 4, '#a46d3b'); ell(x, 14, 9, 10, 3, '#b98250');
    for (const [X, Y] of [[8, 8], [13, 7], [18, 8]]) { R(x, X - 1, Y - 1, 5, 4, O); R(x, X, Y, 3, 2, '#f6f2e9'); }
    R(x, 26, 6, 6, 8, O); R(x, 27, 7, 4, 6, '#8a5a33'); R(x, 27, 7, 4, 2, '#4aa6e2');
    R(x, 2, 13, 22, 3, O); R(x, 3, 14, 20, 1, '#d8c8a8');
    feltMatC = c; return c;
  }
  /** A ger part-way up, as it stands on its plot while being built (stage = steps done; 9 is the finished ger). */
  const stageCache = new Map();
  function gerStage(stage, roof, door) {
    if (stage >= 9) return gerSprite(roof, door);
    const key = stage + roof + door; if (stageCache.has(key)) return stageCache.get(key);
    const { c, x } = mk(48, 50), OUT = K.out, ORG = '#d9762b', ORGD = '#9a4a1a', WOOD = '#c9a26b', WOODD = '#8a5a33';
    const floor = () => { R(x, 3, 43, 42, 5, OUT); R(x, 4, 44, 40, 3, WOOD); for (let X = 7; X < 44; X += 5) R(x, X, 44, 1, 3, WOODD); R(x, 4, 46, 40, 1, WOODD); };
    const posts = () => { for (const X of [21, 26]) { R(x, X, 14, 2, 31, OUT); R(x, X, 15, 1, 29, ORG); } };
    const lattice = () => {
      for (let X = 3; X <= 45; X++) for (let Y = 30; Y <= 43; Y++) if ((X + Y) % 5 === 0 || (X - Y + 50) % 5 === 0) P(x, X, Y, (X + Y) % 10 === 0 ? ORGD : ORG);
      R(x, 3, 29, 43, 1, ORGD); R(x, 2, 29, 1, 15, OUT); R(x, 46, 29, 1, 15, OUT);
    };
    const doorway = () => { R(x, 17, 30, 14, 18, OUT); R(x, 18, 31, 12, 16, ORG); R(x, 20, 33, 8, 13, door); R(x, 22, 36, 4, 6, '#f7c646'); };
    const crown = () => { ell(x, 24, 13, 8, 3, OUT); ell(x, 24, 13, 7, 2, ORG); R(x, 21, 13, 6, 1, '#8fd0ff'); };
    const poles = () => { for (let j = 0; j < 9; j++) { const ex = 3 + Math.round((j * 42) / 8); line(x, 24 + Math.round((ex - 24) / 5), 14, ex, 29, ORG); } };
    if (stage <= 5) {
      floor(); if (stage >= 4) posts(); if (stage >= 2) lattice(); if (stage >= 5) poles(); if (stage >= 3) doorway(); if (stage >= 4) crown();
    } else {
      // felt, then the white cover, then the ropes: the finished shape without its stove pipe yet
      x.drawImage(gerSprite(roof, door), 0, 0); x.clearRect(24, 0, 8, 10);
      if (stage === 6) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(150,118,78,.55)'; x.fillRect(0, 0, 48, 50); x.globalCompositeOperation = 'source-over'; doorway(); }
      if (stage === 8) for (const Y of [33, 38, 43]) { R(x, 4, Y, 13, 1, '#5a3a22'); R(x, 31, Y, 13, 1, '#5a3a22'); }
    }
    stageCache.set(key, c); return c;
  }
  // ------------------------------------------------------------ inside a ger: 320×210, standing at the south door looking north to the khoimor.
  // West (left) is the men's side: saddle and the airag bag. East (right) is the women's side: cupboard and water.
  const ROOM = { W: 320, H: 210, cx: 160, fy: 142, frx: 146, fry: 56 };
  function gerRoom(roof, door, furn) {
    const { W, H, cx, fy, frx, fry } = ROOM, has = (id) => (furn || []).includes(id), dc = door || '#e8892b';
    const ORG = '#d9762b', ORGD = '#9a4a1a', ORGL = '#f3a457', BLU = '#2b52a5', BLUL = '#6a92de', GLD = '#f7c646', OUT = '#2a1a10';
    const { c, x } = mk(W, H);
    const floorTop = (X) => fy - fry * Math.sqrt(Math.max(0, 1 - ((X - cx) / frx) ** 2)), wallTop = (X) => floorTop(X) - 44;
    const TY = 16, TRX = 24, TRY = 9, EDGE = wallTop(cx - frx);
    R(x, 0, 0, W, H, '#1e140c');
    // ceiling: felt lining seen between the roof poles
    for (let X = cx - frx; X <= cx + frx; X++) {
      const a = Math.abs(X - cx), top = a <= TRX ? TY : TY + ((a - TRX) / (frx - TRX)) * (EDGE - TY), f = a / frx;
      R(x, X, Math.round(top), 1, Math.round(wallTop(X) - top) + 1, f < 0.35 ? '#efe4cc' : f < 0.65 ? '#e3d5b8' : f < 0.85 ? '#d3c2a0' : '#bba987');
    }
    // уни: the roof poles, painted orange, running from the toono down to the head of the wall
    for (let j = 0; j < 38; j++) {
      const ex = Math.round(cx - frx + (j * 2 * frx) / 37), ey = Math.round(wallTop(ex)), sx = Math.round(cx + ((ex - cx) / frx) * (TRX - 3)), sy = TY + 4;
      line(x, sx, sy, ex, ey, ORG); line(x, sx + 1, sy, ex + 1, ey, ORGD);
      const bx = Math.round(sx + (ex - sx) * 0.86), by = Math.round(sy + (ey - sy) * 0.86); P(x, bx, by, BLU); P(x, bx + 1, by, GLD);
    }
    // sunlight falling through the toono
    x.fillStyle = 'rgba(255,238,190,.10)'; x.beginPath(); x.moveTo(cx - 14, TY + 3); x.moveTo(cx - 14, TY + 3); x.lineTo(cx + 12, TY + 3); x.lineTo(cx - 4, fy + 30); x.lineTo(cx - 46, fy + 30); x.closePath(); x.fill();
    // тооно: the crown, with sky and a cloud showing through and its bent spokes
    ell(x, cx, TY, TRX + 1, TRY + 1, OUT); ell(x, cx, TY, TRX, TRY, ORG); ell(x, cx, TY + 1, TRX, TRY - 1, ORGD); ell(x, cx, TY, TRX - 4, TRY - 3, '#8fd0ff');
    R(x, cx - 9, TY - 3, 7, 2, '#ffffff'); R(x, cx - 7, TY - 4, 3, 1, '#ffffff');
    R(x, cx - TRX + 4, TY - 1, 2 * TRX - 8, 2, ORG); R(x, cx - 1, TY - TRY + 3, 2, 2 * TRY - 6, ORG);
    for (const s of [-1, 1]) { line(x, cx + s * 11, TY - 5, cx + s * 8, TY - 1, ORG); line(x, cx + s * 8, TY + 1, cx + s * 11, TY + 5, ORG); }
    // хана: the lattice wall behind, over its felt
    for (let X = cx - frx; X <= cx + frx; X++) {
      const top = Math.round(wallTop(X)), bot = Math.round(floorTop(X)), f = Math.abs(X - cx) / frx, felt = f < 0.5 ? '#efe1c3' : f < 0.8 ? '#e2d0ad' : '#cdb994';
      for (let y = top; y <= bot; y++) { const u = (X + y) % 7, v = ((X - y) % 7 + 7) % 7; P(x, X, y, u === 0 || v === 0 ? (f > 0.75 ? ORGD : ORG) : felt); }
      R(x, X, top, 1, 2, ORGD); R(x, X, bot - 1, 1, 2, '#5a3a22');
    }
    // wall carpet behind the khoimor
    for (let X = 112; X <= 208; X++) {
      const top = Math.round(wallTop(X)) + 6, bot = Math.round(floorTop(X)) - 4, edge = X < 115 || X > 205;
      R(x, X, top, 1, bot - top, edge ? GLD : '#a8312a'); R(x, X, top, 1, 2, GLD); R(x, X, bot - 2, 1, 2, GLD);
      if (!edge && (X - 112) % 8 < 2) { P(x, X, top + 4, BLUL); P(x, X, bot - 5, BLUL); }
    }
    for (let r = 0; r < 8; r++) { R(x, cx - r, 56 + r, r * 2 + 1, 1, r < 2 ? GLD : BLU); R(x, cx - r, 71 - r, r * 2 + 1, 1, r < 2 ? GLD : BLU); }
    // floor: wooden boards
    ell(x, cx, fy, frx + 1, fry + 1, OUT);
    for (let dy = -fry; dy <= fry; dy++) {
      const hw = Math.round(frx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((fry + 0.5) * (fry + 0.5))))), y = fy + dy;
      R(x, cx - hw, y, hw * 2 + 1, 1, y % 6 === 0 ? '#9a6c3e' : '#b98a55');
      for (let i = 0; i < 6; i++) { const gx = cx - hw + Math.floor(hash(i, y) * hw * 2); P(x, gx, y, y % 6 === 3 ? '#c99a62' : '#a87a48'); }
    }
    for (let X = cx - frx; X <= cx + frx; X++) { const y = Math.round(fy + fry * Math.sqrt(Math.max(0, 1 - ((X - cx) / frx) ** 2))); if (Math.abs(X - cx) > 16) R(x, X, y - 2, 1, 4, OUT); }
    // the big carpet in front of the stove
    R(x, 92, 158, 136, 32, OUT); R(x, 93, 159, 134, 30, '#b8322a'); R(x, 95, 161, 130, 26, GLD); R(x, 97, 163, 126, 22, '#b8322a'); R(x, 99, 165, 122, 18, BLU); R(x, 100, 166, 120, 16, '#b8322a');
    for (let i = 0; i < 5; i++) { const mx = 112 + i * 24; for (let r = 0; r < 5; r++) { R(x, mx - r, 169 + r, r * 2 + 1, 1, r % 2 ? GLD : BLUL); R(x, mx - r, 179 - r, r * 2 + 1, 1, r % 2 ? GLD : BLUL); } }
    for (let i = 0; i < 33; i++) { P(x, 94 + i * 4, 189, '#f6dca8'); P(x, 94 + i * 4, 157, '#f6dca8'); }
    if (has('shirdeg')) { // quilted felt rug with stitched хээ
      R(x, 66, 136, 58, 22, OUT); R(x, 67, 137, 56, 20, '#ecdcb8'); R(x, 69, 139, 52, 16, '#7a4a2a'); R(x, 70, 140, 50, 14, '#ecdcb8');
      for (let i = 0; i < 4; i++) { const sx = 76 + i * 12; R(x, sx, 143, 6, 1, '#7a4a2a'); R(x, sx + 5, 143, 1, 5, '#7a4a2a'); R(x, sx + 2, 147, 4, 1, '#7a4a2a'); R(x, sx + 2, 145, 1, 3, '#7a4a2a'); }
    }
    ell(x, cx - 26, fy + 24, 18, 5, 'rgba(255,238,190,.16)');                 // sun spot on the floor
    if (has('shagai')) [[206, 164], [212, 166], [218, 163], [224, 166]].forEach(([sx, sy], i) => { R(x, sx, sy, 4, 3, OUT); R(x, sx, sy, 3, 2, i % 2 ? '#f6ecd8' : '#e2cfa8'); });
    // the door to the south, open to the bright steppe
    const dT = fy + fry - 8;
    R(x, cx - 17, dT - 3, 34, H - dT + 3, OUT); R(x, cx - 16, dT - 2, 32, H - dT + 2, ORGD); R(x, cx - 14, dT, 28, H - dT, '#fff2c8'); R(x, cx - 14, H - 7, 28, 7, '#94d260'); R(x, cx - 14, H - 9, 28, 2, '#c5ec9a');
    for (let i = -14; i <= 13; i += 3) P(x, cx + i, dT - 2, GLD);
    R(x, cx - 16, H - 3, 32, 3, '#6b4220'); R(x, cx - 16, H - 3, 32, 1, '#a46d3b');

    // ---- props: standing things, depth-sorted with the people by their base line (y)
    const props = [], blocks = [];
    const prop = (x0, y0, w, h2, base, draw, block) => { const m = mk(w, h2); draw(m.x, w, h2); props.push({ x: x0, y: y0, base, c: m.c }); if (block) blocks.push(block); };
    // two багана posts holding up the toono, painted with bands of ornament
    for (const px of [149, 171]) prop(px - 3, TY + 6, 7, 136 - TY - 6, 136, (q, w, hh) => {
      R(q, 1, 0, 5, hh, OUT); R(q, 2, 0, 3, hh, ORG); R(q, 2, 0, 1, hh, ORGL); R(q, 4, 0, 1, hh, ORGD);
      R(q, 0, 0, 7, 4, OUT); R(q, 1, 1, 5, 2, GLD);
      for (let y = 12; y < hh - 8; y += 18) { R(q, 2, y, 3, 2, BLU); P(q, 3, y + 2, GLD); R(q, 2, y + 3, 3, 1, '#a8312a'); }
      R(q, 0, hh - 3, 7, 3, OUT); R(q, 1, hh - 3, 5, 2, '#6b4220');
    });
    if (has('tulga')) prop(cx - 15, TY + 8, 30, 150 - TY - 8, 150, (q, w, hh) => {   // iron stove with the tea pot, pipe up through the toono
      const sb = hh - 16;
      R(q, 13, 0, 5, sb - 6, OUT); R(q, 14, 0, 3, sb - 6, '#4a4a55'); R(q, 14, 0, 1, sb - 6, '#7a7a88');
      for (let y = 10; y < sb - 6; y += 22) R(q, 13, y, 5, 1, '#2f2f38');
      ell(q, 15, sb - 3, 9, 4, OUT); ell(q, 15, sb - 3, 8, 3, '#8a8a99'); ell(q, 14, sb - 5, 6, 1, '#b4b4c2'); R(q, 6, sb - 3, 18, 1, '#5d5d6b');   // тогоо pot
      R(q, 2, sb, 26, 12, OUT); R(q, 3, sb + 1, 24, 10, '#3a3a44'); R(q, 3, sb + 1, 24, 2, '#5d5d6b');
      R(q, 9, sb + 4, 12, 6, OUT); R(q, 10, sb + 5, 10, 4, '#f39b2c'); R(q, 12, sb + 6, 6, 2, '#f7c646');
      R(q, 4, hh - 4, 3, 4, OUT); R(q, 23, hh - 4, 3, 4, OUT);
    }, [146, 134, 174, 150]);
    else { prop(cx - 15, 136, 30, 14, 150, (q) => { ell(q, 15, 8, 12, 4, '#77778a'); ell(q, 15, 8, 9, 3, '#4a3e3e'); ell(q, 15, 8, 5, 1, '#7a6a5a'); }, [148, 138, 172, 150]); }
    // low table with aaruul, boortsog and a cup of milk tea, and two little stools
    prop(cx - 18, 104, 36, 18, 120, (q) => {
      R(q, 1, 3, 34, 8, OUT); R(q, 2, 4, 32, 6, ORG); R(q, 2, 4, 32, 1, ORGL); R(q, 5, 6, 26, 2, BLU); for (let i = 7; i < 30; i += 5) P(q, i, 7, GLD);
      R(q, 3, 11, 2, 6, OUT); R(q, 31, 11, 2, 6, OUT);
      ell(q, 9, 2, 4, 1, '#ffffff'); P(q, 8, 1, '#f3e6c4'); P(q, 10, 1, '#f3e6c4');                  // aaruul bowl
      ell(q, 19, 2, 4, 1, '#d8b47e'); P(q, 18, 1, '#a46d3b'); P(q, 20, 1, '#a46d3b');                // boortsog
      R(q, 27, 0, 3, 3, '#ffffff'); P(q, 28, 0, '#e8d6b0');                                         // tea cup
    }, [142, 110, 178, 121]);
    // хоймор: the place of honour, with the family shrine and photos
    prop(118, 62, 84, 40, 100, (q) => {
      if (has('avdar')) for (const ax of [0, 44]) {                                                 // two painted chests
        R(q, ax, 22, 40, 18, OUT); R(q, ax + 1, 23, 38, 16, ORG); R(q, ax + 1, 23, 38, 2, ORGL);
        for (const px2 of [4, 22]) { R(q, ax + px2, 27, 14, 9, BLU); R(q, ax + px2 + 1, 28, 12, 7, BLUL); R(q, ax + px2 + 5, 30, 4, 3, GLD); }
      } else { R(q, 14, 26, 56, 14, OUT); R(q, 15, 27, 54, 12, ORG); R(q, 15, 27, 54, 1, ORGL); R(q, 20, 30, 44, 6, BLU); }
      R(q, 26, 6, 32, 17, OUT); R(q, 27, 7, 30, 15, ORGD); R(q, 28, 8, 28, 13, '#a8312a');           // shrine cabinet
      R(q, 30, 10, 7, 9, GLD); R(q, 31, 11, 5, 7, '#fff2c8'); R(q, 33, 13, 1, 3, '#c98f22');        // framed picture
      R(q, 39, 11, 6, 8, '#ffffff'); R(q, 40, 12, 4, 4, '#9fd8f7'); R(q, 40, 16, 4, 2, '#76b947');   // family photo
      R(q, 47, 10, 7, 9, GLD); R(q, 48, 11, 5, 7, '#f6dca8'); P(q, 50, 13, '#2b1e2e');
      R(q, 20, 18, 3, 4, GLD); P(q, 21, 16, '#ffd34e'); P(q, 21, 17, '#f39b2c');                     // butter lamps
      R(q, 61, 18, 3, 4, GLD); P(q, 62, 16, '#ffd34e'); P(q, 62, 17, '#f39b2c');
      R(q, 34, 3, 16, 4, '#ffffff'); R(q, 34, 3, 16, 1, '#dce8f5');                                  // a khadag over the shrine
    }, [120, 86, 200, 101]);
    if (has('morinkhuur')) prop(100, 60, 12, 44, 104, (q) => {                                      // morin khuur on the west of the khoimor
      R(q, 4, 0, 4, 5, OUT); R(q, 5, 1, 3, 3, '#6b4220'); P(q, 7, 2, '#2b1e2e'); P(q, 3, 3, OUT);    // the horse head
      R(q, 5, 5, 2, 22, OUT); R(q, 5, 5, 1, 22, '#8a5a33');
      R(q, 1, 27, 10, 14, OUT); R(q, 2, 28, 8, 12, '#a46d3b'); R(q, 2, 28, 8, 1, '#c99257'); R(q, 5, 28, 2, 12, '#f6dca8');
    }, null);
    if (has('or')) for (const [bx, blanket] of [[22, BLU], [248, '#c2427e']]) prop(bx, 104, 50, 32, 134, (q) => { // painted beds along the wall
      R(q, 0, 0, 50, 12, OUT); R(q, 1, 1, 48, 10, ORG); R(q, 4, 3, 42, 6, BLU); for (let i = 7; i < 44; i += 6) P(q, i, 5, GLD);
      R(q, 0, 12, 50, 18, OUT); R(q, 1, 12, 48, 16, '#f2eee4'); R(q, 1, 17, 48, 11, blanket); R(q, 1, 17, 48, 1, shade(blanket, 0.3)); R(q, 4, 13, 12, 4, '#ffffff');
      R(q, 0, 28, 50, 4, OUT); R(q, 1, 28, 48, 2, ORGD);
    }, [bx, 114, bx + 50, 135]);
    prop(52, 158, 30, 22, 180, (q) => {                                                            // эмээл: a saddle on its stand (men's side)
      R(q, 2, 12, 26, 3, OUT); R(q, 3, 12, 24, 2, '#8a5a33'); R(q, 4, 15, 2, 7, OUT); R(q, 24, 15, 2, 7, OUT);
      R(q, 6, 6, 18, 7, OUT); R(q, 7, 7, 16, 5, '#a8312a'); R(q, 4, 2, 5, 9, OUT); R(q, 5, 3, 3, 7, ORG); R(q, 21, 2, 5, 9, OUT); R(q, 22, 3, 3, 7, ORG);
      P(q, 6, 4, '#d3d3dc'); P(q, 23, 4, '#d3d3dc'); P(q, 10, 9, '#d3d3dc'); P(q, 15, 9, '#d3d3dc'); P(q, 20, 9, '#d3d3dc');
      R(q, 9, 13, 1, 5, '#5a3a22'); R(q, 7, 18, 5, 2, '#77778a'); R(q, 20, 13, 1, 5, '#5a3a22'); R(q, 18, 18, 5, 2, '#77778a');
    }, [54, 170, 80, 181]);
    prop(32, 128, 22, 32, 160, (q) => {                                                            // хөхүүр: the leather airag bag with its churn stick
      R(q, 10, 0, 2, 14, '#c99257'); R(q, 9, 0, 4, 2, '#a46d3b');
      blob(q, 11, 18, 8, 9, '#6b4220', OUT); ell(q, 8, 15, 3, 4, '#8a5a33'); R(q, 4, 27, 14, 3, OUT); R(q, 5, 27, 12, 2, '#a46d3b');
    }, [34, 150, 52, 161]);
    prop(248, 140, 32, 36, 176, (q) => {                                                           // painted cupboard with the tea things (women's side)
      R(q, 0, 8, 32, 28, OUT); R(q, 1, 9, 30, 26, ORG); R(q, 1, 9, 30, 2, ORGL);
      for (const dx2 of [3, 17]) { R(q, dx2, 13, 12, 18, BLU); R(q, dx2 + 1, 14, 10, 16, BLUL); R(q, dx2 + 4, 19, 4, 5, GLD); P(q, dx2 + 5, 21, '#a8312a'); }
      R(q, 3, 1, 5, 8, '#c2302a'); R(q, 3, 1, 5, 1, '#ffffff');                                     // thermos
      R(q, 12, 3, 9, 6, '#d6a23a'); R(q, 20, 4, 3, 2, '#d6a23a'); P(q, 16, 2, '#f7d071');           // brass dom tea pot
      ell(q, 27, 7, 3, 1, '#ffffff');                                                               // bowls
    }, [248, 162, 280, 177]);
    prop(216, 172, 20, 22, 194, (q) => {                                                           // water barrel and ladle
      R(q, 2, 4, 16, 18, OUT); R(q, 3, 5, 14, 16, '#a46d3b'); R(q, 3, 5, 3, 16, '#c99257'); R(q, 3, 8, 14, 1, '#77778a'); R(q, 3, 17, 14, 1, '#77778a');
      ell(q, 10, 4, 7, 2, OUT); ell(q, 10, 4, 6, 1, '#4aa6e2'); R(q, 12, 0, 1, 5, '#8a5a33'); R(q, 10, 0, 4, 1, '#8a5a33');
    }, [218, 184, 234, 195]);
    const inFloor = (px, py) => ((px - cx) / (frx - 8)) ** 2 + ((py - fy - 1) / (fry - 5)) ** 2 <= 1 || (Math.abs(px - cx) < 10 && py > fy && py < H - 6);
    const free = (px, py) => inFloor(px, py) && !blocks.some(([a, b, c2, d]) => px > a && px < c2 && py > b && py < d);
    return { bg: c, props, free, W, H };
  }
  /** Ger interior picture (decorate panel): the full room scaled into a small canvas. */
  function interior(canvas, roof, furn) {
    const rm = gerRoom(roof, null, furn), x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
    const k = Math.min(canvas.width / rm.W, canvas.height / rm.H), ox = (canvas.width - rm.W * k) / 2, oy = (canvas.height - rm.H * k) / 2;
    x.fillStyle = '#1e140c'; x.fillRect(0, 0, canvas.width, canvas.height);
    x.drawImage(rm.bg, ox, oy, rm.W * k, rm.H * k);
    rm.props.slice().sort((a, b) => a.base - b.base).forEach((p) => x.drawImage(p.c, ox + p.x * k, oy + p.y * k, p.c.width * k, p.c.height * k));
  }
  /** A wrestler seen from the front, arms reaching to grip you (40×56): open zodog over a bare chest, shuudag, gutal boots. */
  function wrestlerFront(col, skin, frame) {
    const key = ['wf', col, skin, frame].join(); if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(40, 56), D = shade(col, -0.32), Lt = shade(col, 0.22), skD = shade(skin, -0.16), skL = shade(skin, 0.14), bob = frame ? 1 : 0;
    // boots with upturned toes and ornament
    for (const bx of [12, 22]) { R(x, bx, 44, 7, 12, K.out); R(x, bx + 1, 45, 5, 10, '#5a3420'); R(x, bx + 1, 45, 5, 1, K.gold); R(x, bx + 1, 46, 5, 1, K.red); R(x, bx + 3, 47, 1, 8, K.goldD); R(x, bx, 54, 7, 2, '#24120a'); }
    // legs, then the shuudag
    for (const lx of [13, 23]) { R(x, lx, 36, 5, 9, K.out); R(x, lx + 1, 36, 3, 8, skin); P(x, lx + 1, 38, skL); }
    R(x, 12, 32, 17, 6, K.out); R(x, 13, 33, 15, 4, col); R(x, 13, 33, 15, 1, Lt); R(x, 19, 36, 3, 2, K.out); R(x, 20, 36, 1, 1, col);
    // bare chest and belly, with the zodog's open front and its cord
    R(x, 12, 16 + bob, 17, 17, K.out); R(x, 13, 17 + bob, 15, 15, skin);
    R(x, 15, 21 + bob, 4, 1, skD); R(x, 22, 21 + bob, 4, 1, skD); R(x, 20, 23 + bob, 1, 7, skD); P(x, 20, 30 + bob, skD); P(x, 16, 18 + bob, skL);
    R(x, 12, 16 + bob, 4, 17, col); R(x, 25, 16 + bob, 4, 17, col); R(x, 12, 16 + bob, 1, 17, D); R(x, 15, 17 + bob, 1, 15, K.gold); R(x, 25, 17 + bob, 1, 15, K.gold);
    R(x, 13, 29 + bob, 15, 1, D); P(x, 20, 29 + bob, K.gold);
    // shoulders and long sleeves reaching forward, hands open to grip
    R(x, 8, 13 + bob, 25, 5, K.out); R(x, 9, 14 + bob, 23, 3, col); R(x, 9, 14 + bob, 23, 1, Lt);
    for (const [ax, dir] of [[4, -1], [31, 1]]) { R(x, ax, 15 + bob, 6, 14, K.out); R(x, ax + 1, 16 + bob, 4, 12, col); R(x, ax + 1, 16 + bob, 1, 12, dir < 0 ? Lt : D); R(x, ax + 1, 26 + bob, 4, 1, K.gold);
      R(x, ax, 28 + bob, 6, 5, K.out); R(x, ax + 1, 29 + bob, 4, 3, skin); P(x, ax + (dir < 0 ? 1 : 4), 31 + bob, skD); }
    // head: hair, ears, determined eyes and brows
    R(x, 15, 3 + bob, 11, 12, K.out); R(x, 16, 4 + bob, 9, 10, skin); R(x, 16, 4 + bob, 9, 3, K.hair); P(x, 18, 4 + bob, K.hairL);
    R(x, 14, 8 + bob, 2, 3, skin); R(x, 25, 8 + bob, 2, 3, skin); P(x, 14, 8 + bob, K.out); P(x, 26, 8 + bob, K.out);
    R(x, 17, 8 + bob, 3, 1, K.hair); R(x, 21, 8 + bob, 3, 1, K.hair); P(x, 18, 9 + bob, K.eye); P(x, 22, 9 + bob, K.eye); P(x, 18, 10 + bob, '#ffffff'); P(x, 22, 10 + bob, '#ffffff');
    R(x, 19, 12 + bob, 3, 1, skD); P(x, 20, 11 + bob, skD);
    cache.set(key, c); return c;
  }
  /** Mongolian wrestler (32×48, facing right): open-front zodog jacket with long sleeves, back panel and waist cord,
      tight shuudag briefs, knee-high gutal boots with upturned toes, wrestling hat for the eagle dance.
      pose: idle | grip | push | dance | fall */
  function wrestler(col, skin, pose, frame) {
    const key = ['w2', col, skin, pose, frame].join(); if (cache.has(key)) return cache.get(key);
    if (pose === 'fall') {                                   // lying on the back: rotate the standing figure
      const s = wrestler(col, skin, 'lie', 0), m = mk(48, 32);
      m.x.translate(0, 32); m.x.rotate(-Math.PI / 2); m.x.drawImage(s, 0, 0);
      cache.set(key, m.c); return m.c;
    }
    const { c, x } = mk(32, 48);
    const D = shade(col, -0.32), Lt = shade(col, 0.22), sk = skin, skD = shade(skin, -0.16), skL = shade(skin, 0.14), leather = '#5a3420', leatherD = '#3a2012';
    const lean = pose === 'push' ? 3 : pose === 'grip' ? 1 : 0, dance = pose === 'dance', lift = dance && frame === 1;
    // ---- gutal boots: bulky knee-high leather, thick sole, ornament stripe, strongly upturned toe
    const boot = (bx, top) => {
      R(x, bx, top, 8, 46 - top, K.out); R(x, bx + 1, top + 1, 6, 44 - top, leather); R(x, bx + 6, top + 1, 1, 44 - top, leatherD);
      R(x, bx + 1, top + 1, 6, 1, K.gold); R(x, bx + 1, top + 2, 6, 1, K.red); R(x, bx + 3, top + 3, 2, 42 - top, K.goldD); P(x, bx + 3, top + 5, K.red); P(x, bx + 4, top + 8, K.red);
      R(x, bx + 6, 42, 3, 3, K.out); R(x, bx + 6, 43, 2, 1, leather); P(x, bx + 9, 41, K.out); P(x, bx + 9, 40, K.out); P(x, bx + 8, 42, leather); P(x, bx + 8, 41, K.out); // upturned toe
      R(x, bx, 45, 9, 2, '#24120a'); P(x, bx + 1, 45, '#4a2a18');                                           // thick felt sole
    };
    // ---- legs: bare, muscular thighs and knees (shuudag leaves them uncovered)
    const backTop = 36, frontTop = lift ? 33 : 36;
    R(x, 8, 28, 7, backTop - 28 + 1, K.out); R(x, 9, 28, 5, backTop - 28, sk); R(x, 13, 29, 1, backTop - 30, skD); P(x, 10, 31, skL); P(x, 10, 34, skD); P(x, 11, 34, skD);
    if (lift) { R(x, 16, 28, 8, 6, K.out); R(x, 17, 28, 6, 5, sk); R(x, 17, 32, 6, 1, skD); P(x, 18, 29, skL); }
    else { R(x, 16, 28, 7, frontTop - 28 + 1, K.out); R(x, 17, 28, 5, frontTop - 28, sk); R(x, 21, 29, 1, frontTop - 30, skD); P(x, 18, 31, skL); P(x, 18, 34, skD); P(x, 19, 34, skD); }
    boot(7, backTop); boot(15, frontTop);
    // ---- shuudag: very short, tight, high-cut briefs
    R(x, 8, 25, 16, 1, K.out); R(x, 8, 26, 16, 1, K.out); R(x, 9, 26, 14, 1, D);
    R(x, 8, 27, 1, 1, K.out); R(x, 23, 27, 1, 1, K.out); R(x, 9, 27, 14, 1, col); P(x, 11, 27, Lt);
    R(x, 9, 28, 2, 1, K.out); R(x, 21, 28, 2, 1, K.out); R(x, 11, 28, 10, 1, col); P(x, 15, 28, D);
    R(x, 11, 29, 10, 1, K.out); R(x, 13, 29, 6, 1, col); R(x, 13, 30, 6, 1, K.out);
    // ---- back arm (drawn behind the torso)
    const arm = (pts, cuffAt) => { pts.forEach(([ax, ay, w, h2]) => { R(x, ax - 1, ay - 1, w + 2, h2 + 2, K.out); }); pts.forEach(([ax, ay, w, h2]) => { R(x, ax, ay, w, h2, col); R(x, ax, ay + h2 - 1, w, 1, D); }); const [fx, fy] = cuffAt; R(x, fx - 1, fy - 1, 4, 4, K.out); R(x, fx, fy, 2, 2, sk); R(x, fx - 1, fy, 1, 2, K.gold); };
    if (dance) arm(frame ? [[1, 17, 9, 3]] : [[1, 13, 4, 3], [5, 14, 5, 3]], frame ? [0, 17] : [0, 12]);
    else if (pose === 'idle' || pose === 'lie') arm([[9, 16, 3, 8]], [10, 24]);
    else arm([[11 + lean, 19, 15, 3]], [26 + lean, 19]);
    // ---- zodog back panel (covers back and shoulders; the front is open)
    R(x, 6 + lean, 14, 7, 12, K.out); R(x, 7 + lean, 15, 5, 10, col); R(x, 7 + lean, 15, 1, 10, D); R(x, 7 + lean, 24, 5, 1, K.gold); R(x, 11 + lean, 16, 1, 9, K.gold);
    // ---- bare torso: chest and belly with muscle shading
    R(x, 11 + lean, 15, 12, 11, K.out); R(x, 12 + lean, 15, 10, 10, sk);
    R(x, 13 + lean, 19, 3, 1, skD); R(x, 17 + lean, 19, 3, 1, skD); P(x, 16 + lean, 18, skD);           // pectorals
    R(x, 16 + lean, 21, 1, 4, skD); P(x, 14 + lean, 22, skD); P(x, 18 + lean, 22, skD); P(x, 16 + lean, 25, skD); // abs + navel
    P(x, 14 + lean, 16, skL); P(x, 13 + lean, 17, skL); R(x, 21 + lean, 16, 1, 8, skD);
    // ---- shoulder yoke + open-front strap of the zodog, tied with a cord at the belly
    R(x, 7 + lean, 12, 17, 4, K.out); R(x, 8 + lean, 13, 15, 2, col); R(x, 8 + lean, 15, 15, 1, D); R(x, 8 + lean, 12, 15, 1, Lt);
    for (let i = 0; i < 9; i++) { const sx = 20 + lean - Math.round(i * 0.35); R(x, sx, 15 + i, 2, 1, col); P(x, sx - 1, 15 + i, K.gold); }
    R(x, 12 + lean, 23, 10, 1, D); P(x, 18 + lean, 23, K.gold); P(x, 18 + lean, 24, D); P(x, 19 + lean, 25, D);       // cord + knot
    // ---- front arm (over the torso)
    if (dance) arm(frame ? [[21 + lean, 17, 10, 3]] : [[21, 14, 5, 3], [26, 13, 5, 3]], frame ? [30, 17] : [30, 12]);
    else if (pose === 'idle' || pose === 'lie') arm([[20, 16, 3, 9]], [21, 25]);
    else arm([[20 + lean, 16, 9, 3], [27 + lean, 16, 2, 3]], [29 + lean > 29 ? 29 : 29 + lean, 16]);
    // ---- head: short hair, ear, eye, determined brow
    const hx = 16 + lean, hy = 9;
    blob(x, hx, hy, 4, 4, sk);
    R(x, hx - 4, hy - 4, 8, 3, K.hair); R(x, hx - 4, hy - 2, 3, 4, K.hair); P(x, hx - 1, hy - 4, K.hairL);
    P(x, hx - 1, hy + 1, skD); P(x, hx + 2, hy, K.eye); R(x, hx + 1, hy - 1, 3, 1, K.hair); P(x, hx + 3, hy + 3, skD); P(x, hx + 4, hy + 1, skD);
    // ---- wrestling hat (worn for the eagle dance): red dome, gold knot, dark brim with upturned points
    if (dance) {
      R(x, hx - 6, hy - 4, 13, 2, K.out); R(x, hx - 5, hy - 4, 11, 1, '#24307a'); P(x, hx - 6, hy - 5, '#24307a'); P(x, hx + 6, hy - 5, '#24307a');
      for (let r = 0; r < 4; r++) { const w = 4 - r; R(x, hx - w - 1, hy - 5 - r, w * 2 + 3, 1, K.out); R(x, hx - w, hy - 5 - r, w * 2 + 1, 1, r === 3 ? '#e35a4c' : K.red); }
      R(x, hx - 1, hy - 10, 2, 2, K.gold); P(x, hx, hy - 11, K.goldD);
    }
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
      else if (ch === 'k' || (ch === 'B' && tx >= 4 && tx <= 13 && ty >= 16 && ty <= 22)) yard(x, X, Y, tx, ty, nb4.map((n) => n !== 'k' && n !== 'B'));
      else if (ch === 'a') sand(x, X, Y, tx, ty, nb4.map((n) => n !== 'a'));
      else { grass(x, X, Y, tx, ty); if (ch === 'f') fence(x, X, Y, nb4.map((n) => n === 'f')); if (ch === 'r') rock(x, X, Y); }
    }
    for (let ty = 2; ty < h - 1; ty++) for (let tx = 1; tx < w - 1; tx++) if (g[ty][tx] === 'g' && hash(tx * 3, ty * 7) < 0.1) flower(x, tx * 16 + 4 + Math.floor(hash(tx, ty) * 8), ty * 16 + 5 + Math.floor(hash(ty, tx) * 7), [K.pink, K.gold, K.white, K.purple][Math.floor(hash(tx, ty * 5) * 4)]);
    if (W.ARENA) arenaFlags(x, W.ARENA);
    const draws = [...trees.map((t) => ({ y: t.y, f: () => tree(x, t.x, t.y, t.pine) })), ...objects.filter((o) => !['felt', 'npc', 'emee', 'npcq', 'cow', 'goat', 'general', 'historian'].includes(o.kind)).map((o) => ({ y: o.y + o.h - 1, f: () => ({ ger, shop, board, well, lantern, lot, bleachers, ovoo, uya, archery, academy, zel, churn, tulga, rack })[o.kind](x, o) }))];
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());
    return c;
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
      // traditional hats of Mongolia's peoples
      case 'kazakh': ell(x, 8, 5, 5, 4, K.white, 7); R(x, 3, 6, 10, 2, '#c9c1ad'); for (let i = 4; i <= 12; i += 2) P(x, i, 4, K.red); P(x, 6, 2, K.gold); P(x, 10, 2, K.gold); line(x, 9, 1, 12, -2, '#4a3426'); P(x, 12, -1, '#d8cfba'); break; // embroidered hat with an owl feather
      case 'buriad': for (let r = 0; r < 5; r++) R(x, 8 - r, 2 + r, r * 2 + 1, 1, K.blue); R(x, 2, 7, 12, 2, K.fur); P(x, 8, 1, K.red); P(x, 8, 0, K.red); if (back) { R(x, 7, 8, 1, 4, K.red); R(x, 9, 8, 1, 4, K.red); } break; // pointed hat, fur brim, red top
      case 'oirat': ell(x, 8, 5, 4, 3, K.blueD, 6); R(x, 2, 6, 12, 2, K.gold); R(x, 7, 0, 2, 3, K.red); P(x, 8, -1, K.red); if (back) { R(x, 6, 8, 1, 6, K.red); R(x, 9, 8, 1, 6, K.red); } break; // tall western hat with a red tassel
      case 'fur': ell(x, 8, 6, 6, 4, '#7a5a3a', 7); P(x, 6, 3, '#a8784a'); P(x, 10, 4, '#a8784a'); if (!side) { R(x, 2, 8, 3, 6, '#7a5a3a'); R(x, 11, 8, 3, 6, '#7a5a3a'); } else R(x, 3, 8, 3, 6, '#7a5a3a'); break; // reindeer-fur hat with ear flaps
      case 'crown': R(x, 4, 4, 9, 3, K.gold); R(x, 4, 6, 9, 1, K.goldD); [[4, 2], [4, 3], [8, 1], [8, 2], [8, 3], [12, 2], [12, 3]].forEach(([a, b]) => P(x, a, b, K.gold)); P(x, 8, 5, K.red); break;
    }
    return c;
  }
  // animals (facing right; flipped by the caller)
  // ------------------------------------------------------------ animals, drawn with care (facing right; frame 0 stands, 1 and 2 walk)
  // Mongolian breeds: fat-tailed sheep with dark heads, long-haired goats, short sturdy horses, shaggy yaks, two-humped camels.
  const BEAST = {};
  const hooves = (x, f, legs, top, len, col, hoof, dark) => legs.forEach((lx, i) => { const lift = f && (i + f) % 2 ? 1 : 0, sw = f ? ((i + f) % 2 ? 1 : -1) * (i < 2 ? 1 : -1) : 0; R(x, lx + sw, top, 2, len - lift, K.out); R(x, lx + sw, top, 1, len - lift - 1, i % 2 ? dark : col); P(x, lx + sw, top + len - lift - 1, hoof); });
  const eye = (x, X, Y) => { P(x, X, Y, K.eye); P(x, X, Y - 1, shade(K.eye, 0.5)); };
  const wool = (x, cx, cy, rx, ry, base, s) => { for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) if ((dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2 <= 1 && hash(dx + s, dy + 7 * s) < 0.3) P(x, cx + dx, cy + dy, (dx + dy) % 2 ? shade(base, -0.12) : shade(base, 0.25)); };
  BEAST.sheep = { w: 20, h: 16, draw: (x, f) => { // fat-tailed Mongolian sheep: cream wool, dark brown head
    hooves(x, f, [5, 8, 12, 14], 10, 6, '#3b3236', '#1e1a1e', '#2b2427');
    blob(x, 9, 7, 6, 4, '#efe6d4', '#6a5e52'); ell(x, 9, 9, 5, 1, '#d8ccb6'); ell(x, 8, 5, 4, 1, '#fbf6ec'); wool(x, 9, 7, 6, 4, '#efe6d4', 3);
    blob(x, 3, 9, 2, 2, '#e6dcc6', '#6a5e52'); P(x, 2, 10, '#c9bda6');                                  // the fat tail
    blob(x, 16, 5, 2, 3, '#3b3236', K.out); R(x, 17, 6, 2, 2, '#4a4044'); P(x, 18, 7, '#2b2427'); eye(x, 17, 4); R(x, 14, 3, 2, 1, '#2b2427'); P(x, 14, 4, '#3b3236'); // head, ear
  } };
  BEAST.lamb = { w: 14, h: 12, draw: (x, f) => { hooves(x, f, [3, 5, 8, 10], 8, 4, '#c9bda6', '#6a5e52', '#b6a890'); blob(x, 6, 5, 4, 3, '#fbf6ec', '#8a8274'); wool(x, 6, 5, 4, 3, '#fbf6ec', 5); blob(x, 11, 3, 2, 2, '#f2dcc8', '#8a8274'); eye(x, 12, 2); P(x, 13, 4, '#e8a0a0'); R(x, 9, 1, 2, 1, '#e8c8b0'); } };
  BEAST.goat = { w: 18, h: 16, draw: (x, f) => { // long-haired white goat with a beard and swept-back horns
    hooves(x, f, [4, 6, 10, 12], 10, 6, '#8a7a64', '#3a3030', '#6a5a4a');
    blob(x, 8, 7, 5, 3, '#f2eee4', '#7a7064'); for (let i = 3; i < 14; i++) if (i % 2) R(x, i, 10, 1, 2 + (i % 3), '#e2dccc');   // shaggy fringe
    ell(x, 7, 5, 3, 1, '#ffffff'); P(x, 2, 4, '#f2eee4'); P(x, 2, 3, '#f2eee4');                          // tail up
    R(x, 12, 4, 3, 3, '#f2eee4'); blob(x, 15, 4, 2, 2, '#f2eee4', K.out); R(x, 16, 7, 1, 3, '#d8d0c0'); eye(x, 15, 3); // neck, head, beard
    P(x, 14, 1, '#8a7a64'); P(x, 13, 0, '#8a7a64'); P(x, 13, 1, '#6a5a4a'); P(x, 12, 0, '#6a5a4a');           // horns
  } };
  BEAST.cow = { w: 24, h: 18, draw: (x, f) => { // brown and white cow with an udder
    hooves(x, f, [5, 8, 15, 18], 12, 6, '#5a3a22', '#1e1a1e', '#4a2e1a');
    blob(x, 11, 8, 8, 4, '#8a5a33', K.out); ell(x, 10, 6, 6, 1, '#a46d3b'); blob(x, 8, 8, 3, 2, '#f2eee4'); blob(x, 14, 9, 2, 2, '#f2eee4');
    R(x, 11, 12, 3, 2, '#f2a0a0'); P(x, 11, 14, '#e88080'); P(x, 13, 14, '#e88080');                   // udder
    R(x, 2, 6, 1, 7, '#5a3a22'); R(x, 1, 12, 3, 2, '#2b1e14');                                          // tail with tuft
    blob(x, 20, 7, 3, 3, '#8a5a33', K.out); R(x, 21, 9, 3, 2, '#f2d8c8'); P(x, 23, 10, '#5a3a22'); eye(x, 21, 6); R(x, 18, 4, 2, 1, '#6b4220'); R(x, 21, 3, 1, 2, '#e8dcc0'); R(x, 23, 3, 1, 2, '#e8dcc0'); // head, ear, horns
  } };
  BEAST.yak = { w: 24, h: 18, draw: (x, f) => { // shaggy yak: hump, long skirt of hair, pale horns
    hooves(x, f, [6, 9, 15, 18], 13, 5, '#2b2222', '#14100f', '#201a1a');
    blob(x, 12, 8, 8, 4, '#3a2c2c', K.out); blob(x, 15, 5, 4, 2, '#3a2c2c'); ell(x, 13, 5, 5, 1, '#5a4848');
    for (let i = 4; i < 21; i++) R(x, i, 11, 1, 3 + ((i * 7) % 3), i % 2 ? '#2b2222' : '#4a3c3c');      // the hair skirt
    for (let i = 0; i < 6; i++) P(x, 3 - (i % 2), 6 + i, i % 2 ? '#f2eee4' : '#d8d0c0');                // white tail plume
    blob(x, 20, 8, 2, 3, '#3a2c2c', K.out); R(x, 21, 10, 2, 2, '#2b2222'); eye(x, 21, 7); R(x, 19, 4, 1, 2, '#e8dcc0'); R(x, 22, 4, 1, 2, '#e8dcc0'); P(x, 18, 4, '#e8dcc0'); P(x, 23, 4, '#e8dcc0');
  } };
  // every horse in the game is the same Mongolian horse you ride and race (horse() below): the ones on the зэл line,
  // at the уяа, in 3D, in battles and on the trips. Only the coat differs. Frame 0 stands, 1–4 gallop.
  const horseBeast = (coat, saddle) => ({ w: 28, h: 22, draw: (x, f) => x.drawImage(horse(coat, Math.min(4, f || 0), saddle), 0, 0) });
  BEAST.horse = horseBeast('bay', true);
  BEAST.mare = horseBeast('chestnut', false);
  BEAST.takhi = horseBeast('dun', false);
  BEAST.foal = { w: 16, h: 15, draw: (x, f) => { hooves(x, f, [4, 6, 10, 11], 9, 6, '#a46d3b', '#2b1e14', '#8a5a33'); blob(x, 7, 7, 4, 2, '#b98a55', K.out); ell(x, 6, 6, 3, 1, '#d0a46a'); R(x, 10, 3, 2, 4, '#b98a55'); blob(x, 13, 3, 2, 1, '#b98a55', K.out); eye(x, 13, 2); R(x, 10, 1, 1, 3, '#6b4220'); P(x, 2, 6, '#6b4220'); P(x, 2, 7, '#6b4220'); } };
  BEAST.camel = { w: 26, h: 22, draw: (x, f) => { // two-humped Bactrian camel: woolly humps, long neck, shaggy throat
    const C = '#c99a5a', D = '#a07444', W = '#7a4f2c';
    hooves(x, f, [6, 9, 16, 19], 14, 8, C, '#6b4220', D);
    // body and humps as one outline, so the humps grow out of the back
    for (const [hx, hh] of [[8, 5], [15, 5]]) for (let i = -3; i <= 3; i++) { const top = 9 - Math.round(hh * Math.cos((i / 3.6) * (Math.PI / 2))); R(x, hx + i, top - 1, 1, 6, K.out); }
    blob(x, 12, 11, 8, 4, C, K.out);
    for (const [hx, hh] of [[8, 5], [15, 5]]) for (let i = -3; i <= 3; i++) { const top = 9 - Math.round(hh * Math.cos((i / 3.6) * (Math.PI / 2))); R(x, hx + i, top, 1, 5, C); P(x, hx + i, top, W); if (Math.abs(i) < 2) P(x, hx + i, top + 1, W); }
    ell(x, 12, 13, 6, 1, D); ell(x, 11, 9, 2, 0, shade(C, 0.15));
    for (let r = 0; r < 8; r++) { R(x, 19 + Math.round(r * 0.55), 11 - r, 3, 2, K.out); }
    for (let r = 0; r < 8; r++) { R(x, 20 + Math.round(r * 0.55), 11 - r, 2, 2, C); }                       // long curved neck
    for (let i = 0; i < 4; i++) { P(x, 19, 11 + i, W); P(x, 20, 12 + i, shade(W, 0.2)); }                     // woolly beard
    R(x, 23, 2, 4, 3, K.out); R(x, 23, 2, 3, 2, C); P(x, 26, 4, K.out); eye(x, 24, 2); P(x, 23, 1, K.out);     // head
    P(x, 2, 10, W); P(x, 2, 11, W); P(x, 3, 12, W);
  } };
  BEAST.botgo = { w: 16, h: 15, draw: (x, f) => { hooves(x, f, [4, 6, 10, 11], 9, 6, '#d9b07a', '#8a5a33', '#c99a5a'); blob(x, 7, 7, 4, 2, '#e2c08a', K.out); P(x, 5, 4, '#c99a5a'); P(x, 9, 4, '#c99a5a'); R(x, 11, 2, 2, 5, '#e2c08a'); blob(x, 14, 2, 2, 1, '#e2c08a', K.out); eye(x, 14, 1); } };
  BEAST.reindeer = { w: 20, h: 18, draw: (x, f) => { hooves(x, f, [5, 7, 12, 14], 11, 7, '#6a5240', '#2b1e14', '#5a4232'); blob(x, 9, 9, 5, 3, '#8a6a4a', K.out); ell(x, 9, 11, 4, 1, '#e8dcc0'); R(x, 13, 6, 3, 4, '#e8dcc0'); blob(x, 16, 5, 2, 2, '#8a6a4a', K.out); eye(x, 16, 4); P(x, 18, 6, '#2b2222');
    for (const [a, b] of [[14, 3], [14, 2], [13, 1], [15, 1], [16, 0], [17, 2], [18, 1], [18, 3], [19, 2]]) P(x, a, b, '#c9a87a'); P(x, 3, 8, '#e8dcc0'); } };
  BEAST.gazelle = { w: 18, h: 15, draw: (x, f) => { hooves(x, f, [5, 7, 11, 12], 9, 6, '#a07444', '#3a2516', '#8a5a33'); blob(x, 8, 7, 5, 2, '#d8a868', K.out); ell(x, 8, 9, 4, 0, '#f6ecd8'); R(x, 4, 8, 9, 1, '#6b4220'); R(x, 3, 6, 2, 3, '#ffffff');
    R(x, 12, 3, 2, 4, '#d8a868'); blob(x, 14, 2, 2, 1, '#d8a868', K.out); eye(x, 14, 1); P(x, 13, 0, '#3a2516'); P(x, 12, 0, '#3a2516'); } };
  BEAST.puppy = { w: 13, h: 11, draw: (x, f) => { hooves(x, f, [3, 4, 8, 9], 7, 4, '#2d2629', '#1a1618', '#3a3235'); blob(x, 6, 5, 4, 2, '#2d2629', K.out); ell(x, 6, 4, 2, 0, '#4a4044'); blob(x, 10, 3, 2, 2, '#2d2629', K.out); P(x, 11, 2, '#c98a4a'); P(x, 9, 2, '#c98a4a'); P(x, 12, 4, '#c98a4a'); eye(x, 11, 3); P(x, 9, 0, '#2d2629'); P(x, 1, 3, '#2d2629'); P(x, 1, 2, '#2d2629'); } };
  BEAST.kitten = { w: 12, h: 10, draw: (x, f) => { hooves(x, f, [3, 4, 7, 8], 6, 4, '#f39b2c', '#c46d12', '#e08a20'); blob(x, 5, 4, 3, 2, '#f39b2c', K.out); P(x, 4, 3, '#c46d12'); P(x, 6, 3, '#c46d12'); blob(x, 9, 3, 2, 2, '#f39b2c', K.out); P(x, 8, 0, '#f39b2c'); P(x, 10, 0, '#f39b2c'); eye(x, 10, 3); P(x, 1, 2, '#f39b2c'); P(x, 1, 1, '#c46d12'); } };
  BEAST.swan = { w: 14, h: 12, draw: (x, f) => { blob(x, 6, 8, 5, 3, '#ffffff', '#8a8a94'); ell(x, 5, 7, 3, 1, '#f2f2f6'); R(x, 10, 2, 1, 6, '#ffffff'); P(x, 9, 2, '#8a8a94'); R(x, 10, 1, 3, 2, '#ffffff'); P(x, 13, 2, '#f39b2c'); P(x, 11, 1, K.eye); if (f) P(x, 2, 6, '#ffffff'); } };
  BEAST.gull = { w: 12, h: 9, draw: (x, f) => { blob(x, 6, 5, 4, 2, '#f2f2f6', '#77778a'); R(x, 2 - (f ? 1 : 0), 3, 4, 1, '#a5a5b0'); R(x, 9, 3, 2, 2, '#f2f2f6'); P(x, 11, 4, '#f7c646'); P(x, 10, 3, K.eye); R(x, 5, 7, 1, 2, '#f39b2c'); R(x, 7, 7, 1, 2, '#f39b2c'); } };
  BEAST.bear = { w: 22, h: 16, draw: (x, f) => { // the Gobi bear (mazaalai), one of the rarest bears on Earth
    hooves(x, f, [5, 8, 14, 17], 11, 5, '#6b4a2a', '#2b1e14', '#5a3a22'); blob(x, 11, 8, 8, 4, '#8a6a4a', K.out); ell(x, 10, 6, 6, 1, '#a88a62'); blob(x, 18, 6, 3, 3, '#8a6a4a', K.out); P(x, 17, 3, '#6b4a2a'); P(x, 20, 3, '#6b4a2a'); R(x, 20, 7, 2, 2, '#c9a87a'); P(x, 21, 7, K.out); eye(x, 19, 5); } };
  /** Any animal sprite, cached. */
  function beast(kind, frame = 0) {
    const key = 'b:' + kind + frame; if (cache.has(key)) return cache.get(key);
    const A = BEAST[kind] || BEAST.sheep, { c, x } = mk(A.w, A.h); A.draw(x, frame); cache.set(key, c); return c;
  }
  const ANIMALS = { sheep: 'sheep', lamb: 'lamb', puppy: 'puppy', kitten: 'kitten', camel: 'botgo', foal: 'foal' }; // pets and village animals use the same drawings
  function animal(kind, frame) { return beast(ANIMALS[kind] || kind, frame); }

  // Mongolian horse for riding and racing (28×22, facing right). frame 0 stands, 1–4 gallop. saddle: draw a saddle.
  const COATS = { bay: ['#8a5a33', '#6b4220', '#2b1e14'], black: ['#3a2c2c', '#241a1a', '#120c0c'], white: ['#ece4d4', '#c9bda6', '#8a7a64'], chestnut: ['#b5652e', '#8a4a1e', '#5a2a10'], gray: ['#a0a0aa', '#7a7a86', '#3a3a44'] };
  const WILD = { dun: ['#c99a5a', '#a07444', '#3a2516'] }; // the takhi (Przewalski's horse): same horse, sandy dun coat
  function horse(coat, frame, saddle) {
    const key = ['h', coat, frame, saddle].join(); if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(28, 22), [B, BD, MN] = COATS[coat] || WILD[coat] || COATS.bay, bob = frame === 2 || frame === 4 ? 1 : 0;
    const legs = [[[7, 0], [9, 0], [17, 0], [19, 0]], [[5, -2], [8, 1], [18, 2], [21, -1]], [[7, 1], [10, -1], [16, -1], [19, 1]], [[9, -1], [6, 2], [20, 1], [17, -2]], [[8, 2], [10, 0], [18, -2], [16, 1]]][frame] || [];
    legs.forEach(([lx, sw], i) => { const top = 13 + bob, len = 7 - (sw < 0 ? 1 : 0); line(x, lx, top, lx + sw, top + len, K.out); line(x, lx + 1, top, lx + 1 + sw, top + len, i % 2 ? BD : B); P(x, lx + sw, top + len, MN); P(x, lx + 1 + sw, top + len, MN); });
    const sw = frame ? (frame % 2 ? 1 : -1) : 0; // tail swish
    line(x, 6, 9 + bob, 2 + sw, 15 + bob, K.out); line(x, 5, 9 + bob, 1 + sw, 14 + bob, MN); line(x, 6, 10 + bob, 3 + sw, 16 + bob, MN);
    blob(x, 13, 10 + bob, 8, 4, B, K.out); ell(x, 12, 9 + bob, 6, 1, shade(B, 0.15));
    for (let r = 0; r < 7; r++) R(x, 18 + Math.round(r * 0.7), 9 + bob - r, 4, 3, B); // neck
    line(x, 18, 8 + bob, 22, 2 + bob, MN); line(x, 19, 8 + bob, 23, 2 + bob, MN); // mane
    blob(x, 24, 3 + bob, 3, 2, B, K.out); R(x, 25, 4 + bob, 3, 2, BD); P(x, 27, 4 + bob, K.out); P(x, 23, 2 + bob, K.eye); P(x, 22, 0 + bob, B); P(x, 22, 1 + bob, K.out);
    if (saddle) { R(x, 10, 5 + bob, 8, 3, K.out); R(x, 11, 5 + bob, 6, 2, K.red); R(x, 11, 7 + bob, 6, 1, K.gold); R(x, 13, 8 + bob, 1, 4, K.woodD); P(x, 13, 12 + bob, K.gold); }
    cache.set(key, c); return c;
  }
  /** Race checkpoint flag (8×16). */
  function raceFlag(col, frame) {
    const key = 'rf:' + col + frame; if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(10, 16); R(x, 1, 1, 1, 15, K.woodD); R(x, 0, 15, 3, 1, K.out);
    for (let r = 0; r < 5; r++) R(x, 2, 1 + r, 7 - Math.abs(r - 2) - (frame && r % 2 ? 1 : 0), 1, col);
    blob(x, 1, 1, 1, 1, K.gold, K.goldD); cache.set(key, c); return c;
  }
  // уяа: the hitching line where race horses wait
  function uya(x, o) {
    const X = o.x * 16, Y = o.y * 16, w = o.w * 16;
    R(x, X + 2, Y + 2, 3, 14, K.out); R(x, X + 3, Y + 3, 1, 13, K.wood); R(x, X + w - 5, Y + 2, 3, 14, K.out); R(x, X + w - 4, Y + 3, 1, 13, K.wood);
    R(x, X + 3, Y + 4, w - 6, 1, K.woodD); [K.blue, K.red, K.gold, K.white].forEach((col, i) => R(x, X + 8 + i * Math.floor((w - 16) / 3), Y + 4, 3, 2, col));
    x.drawImage(horse('bay', 0, true), X + 3, Y - 10); x.drawImage(horse('white', 0, true), X + w - 31, Y - 9);
  }

  // сурын талбай: a Mongolian archery range with the low wall of leather "сур" targets at the far end
  function archery(x, o) {
    const X = o.x * 16, Y = o.y * 16, w = o.w * 16, hh = o.h * 16;
    R(x, X, Y + 6, w, hh - 10, K.dirtL); R(x, X, Y + 6, w, 1, K.dirtD); R(x, X, Y + hh - 5, w, 1, K.dirtD);
    for (let i = 0; i < 9; i++) P(x, X + 6 + i * 13, Y + 18 + (i % 3) * 6, K.dirtD);
    R(x, X + 4, Y + 10, 2, 24, K.woodD); R(x, X + 10, Y + 10, 2, 24, K.woodD); R(x, X + 3, Y + 12, 10, 2, K.wood); // bow rack
    line(x, X + 5, Y + 14, X + 5, Y + 30, K.woodL); line(x, X + 11, Y + 15, X + 11, Y + 29, K.woodL);
    const tx = X + w - 22; // target wall: three rows of small red, white and blue cylinders
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const cx = tx + c * 3 + (r % 2), cy = Y + 18 + r * 4; R(x, cx, cy, 3, 4, K.out); R(x, cx, cy, 2, 3, [K.red, K.white, K.blue][(c + r) % 3]); }
    R(x, tx - 2, Y + 30, 20, 2, K.woodD);
    R(x, X + w - 4, Y + 2, 1, 16, K.woodD); for (let r = 0; r < 5; r++) R(x, X + w - 3, Y + 2 + r, 6 - Math.abs(r - 2) * 2, 1, K.gold);
    R(x, X + 20, Y + 2, 1, 14, K.woodD); for (let r = 0; r < 5; r++) R(x, X + 21, Y + 2 + r, 6 - Math.abs(r - 2) * 2, 1, K.blue);
  }

  // Басар: a Mongolian Bankhar dog. Big, fluffy, black coat with tan "four-eye" spots above the eyes,
  // tan muzzle, chest and paws, and a bushy tail curled over the back. Faces right; frames 0–2 walk, 3 sit.
  const BK = { out: '#1a1418', coat: '#2a2326', coatL: '#4a3f44', tan: '#c98a4b', tanL: '#e2ab6c', tongue: '#e8687a' };
  function bankhar(frame) {
    const key = 'bk:' + frame; if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(22, 18);
    const sit = frame === 3;
    // tail: a fluffy curl over the back
    blob(x, 4, sit ? 9 : 5, 3, 2, BK.coat, BK.out); P(x, 2, sit ? 8 : 4, BK.coatL); P(x, 6, sit ? 8 : 4, BK.tanL);
    if (sit) {
      blob(x, 9, 11, 5, 4, BK.coat, BK.out);                 // haunch
      R(x, 4, 15, 9, 2, BK.out); R(x, 5, 15, 7, 1, BK.tan);  // folded back leg
      blob(x, 14, 8, 3, 5, BK.coat, BK.out);                  // upright chest
      R(x, 15, 9, 2, 4, BK.tan);
      [13, 16].forEach((lx) => { R(x, lx, 12, 2, 5, BK.out); R(x, lx, 12, 1, 4, BK.coat); R(x, lx, 15, 2, 2, BK.tan); });
    } else {
      const b = frame === 2 ? 1 : 0;
      [[5, 0], [7, 1], [12, 1], [14, 0]].forEach(([lx, ph]) => {
        const lift = frame && (ph ^ (frame - 1)) ? 1 : 0;
        R(x, lx, 11, 2, 6 - lift, BK.out); R(x, lx, 11, 1, 4 - lift, BK.coat); R(x, lx, 15 - lift, 2, 1, BK.tan);
      });
      blob(x, 10, 9 - b, 6, 3, BK.coat, BK.out);              // fluffy body
      ell(x, 9, 8 - b, 4, 1, BK.coatL);
      blob(x, 15, 8 - b, 3, 4, BK.coat, BK.out);              // thick mane around the neck
      R(x, 16, 10 - b, 2, 2, BK.tan);                          // tan chest
    }
    const hy = sit ? 0 : (frame === 2 ? 1 : 2);
    blob(x, 17, hy + 4, 3, 3, BK.coat, BK.out);               // head
    R(x, 14, hy + 2, 2, 5, BK.out); R(x, 15, hy + 3, 1, 3, BK.coatL); // floppy ear
    R(x, 19, hy + 5, 3, 2, BK.out); R(x, 19, hy + 5, 2, 2, BK.tan); P(x, 21, hy + 5, BK.out); // muzzle + nose
    P(x, 18, hy + 4, BK.out); P(x, 18, hy + 3, BK.tanL);       // eye + the tan "second eye" above it
    if (sit || frame === 0) P(x, 20, hy + 7, BK.tongue);
    cache.set(key, c); return c;
  }
  /** Basar's face for the chat window (24×22). mood: 0 happy, 1 talking, 2 thinking. */
  function bankharFace(mood) {
    const key = 'bkf:' + mood; if (cache.has(key)) return cache.get(key);
    const { c, x } = mk(24, 22);
    blob(x, 12, 12, 8, 7, BK.coat, BK.out);                   // head + fluffy cheeks
    ell(x, 12, 9, 5, 3, BK.coatL);
    [[2, 0], [18, 1]].forEach(([ex, i]) => { R(x, ex + (i ? 0 : 1), 6, 3, 9, BK.out); R(x, ex + (i ? 1 : 0), 8, 3, 8, BK.out); R(x, ex + 1, 7, 2, 8, i ? BK.coatL : BK.coat); P(x, ex + (i ? 1 : 2), 15, BK.out); }); // floppy ears hanging down
    R(x, 8, 8, 2, 1, BK.tanL); R(x, 14, 8, 2, 1, BK.tanL);   // the tan "four eyes"
    if (mood === 2) { R(x, 8, 10, 2, 1, BK.out); R(x, 14, 10, 2, 1, BK.out); }
    else { R(x, 8, 10, 2, 2, BK.out); R(x, 14, 10, 2, 2, BK.out); P(x, 8, 10, '#fff'); P(x, 14, 10, '#fff'); }
    blob(x, 12, 15, 4, 3, BK.tan, BK.out);                     // muzzle
    R(x, 11, 13, 3, 2, BK.out);                                // nose
    if (mood === 1) { R(x, 10, 17, 5, 2, BK.out); R(x, 11, 18, 3, 1, BK.tongue); }
    else { P(x, 10, 17, BK.out); P(x, 14, 17, BK.out); R(x, 11, 17, 3, 1, BK.out); }
    if (mood === 0) R(x, 12, 18, 2, 2, BK.tongue);
    cache.set(key, c); return c;
  }

  // ------------------------------------------------------------ UI icons (16×16) for shop, bag, HUD
  const iconCache = new Map();
  function iconCanvas(key) {
    const { c, x } = mk(16, 16);
    const [kind, id] = key.split(':');
    if (kind === 'beast') { const a = beast(id, 0), k = Math.min(16 / a.width, 16 / a.height); x.drawImage(a, Math.round((16 - a.width * k) / 2), Math.round((16 - a.height * k) / 2), Math.round(a.width * k), Math.round(a.height * k)); }
    else if (kind === 'dairy') {
      const bowl = (fill, top) => { R(x, 2, 8, 12, 5, K.out); R(x, 3, 8, 10, 4, '#f6f2e9'); R(x, 3, 11, 10, 1, '#d8cfba'); R(x, 2, 7, 12, 2, K.out); R(x, 3, 7, 10, 1, fill); if (top) top(); R(x, 5, 13, 6, 1, K.out); };
      ({
        milk: () => bowl('#ffffff', () => P(x, 6, 7, '#e8f0ff')),
        mare: () => { R(x, 4, 3, 8, 11, K.out); R(x, 5, 4, 6, 9, '#a46d3b'); R(x, 5, 4, 6, 2, '#ffffff'); R(x, 6, 1, 4, 3, K.out); R(x, 7, 2, 2, 1, '#6b4220'); P(x, 6, 7, '#c99257'); },
        aaruul: () => { for (const [ax, ay] of [[2, 8], [7, 9], [5, 4], [10, 5]]) { R(x, ax, ay, 5, 4, K.out); R(x, ax + 1, ay + 1, 3, 2, '#fff6dc'); P(x, ax + 1, ay + 1, '#ffffff'); } },
        urum: () => bowl('#f7d071', () => { R(x, 4, 6, 8, 1, '#f2c45a'); P(x, 6, 6, '#fde08a'); }),
        tarag: () => bowl('#f6f2e9', () => { P(x, 7, 6, '#ffffff'); P(x, 8, 6, '#ffffff'); }),
        airag: () => bowl('#efe8d4', () => { P(x, 5, 6, '#ffffff'); P(x, 9, 6, '#ffffff'); P(x, 7, 5, '#ffffff'); }),
      })[id]();
    } else if (kind === 'part') { // the parts of a ger, and the wool its felt is made from
      const O = K.out, ORG = '#d9762b', ORGD = '#9a4a1a', FELT = '#d8c8a8', FELTD = '#b8a47e';
      ({
        shal: () => { R(x, 1, 6, 14, 6, O); R(x, 2, 7, 12, 4, '#c9a26b'); for (const X of [5, 9, 12]) R(x, X, 7, 1, 4, '#8a5a33'); },
        khana: () => { R(x, 1, 3, 14, 11, O); R(x, 2, 4, 12, 9, '#f0e2c2'); for (let X = 2; X < 14; X++) for (let Y = 4; Y < 13; Y++) if ((X + Y) % 4 === 0 || (X - Y + 16) % 4 === 0) P(x, X, Y, ORG); },
        khaalga: () => { R(x, 4, 1, 8, 14, O); R(x, 5, 2, 6, 12, '#e14b3d'); R(x, 6, 4, 4, 7, '#f7c646'); P(x, 7, 7, '#2b52a5'); P(x, 8, 7, '#2b52a5'); },
        toono: () => { ell(x, 8, 8, 7, 5, O); ell(x, 8, 8, 6, 4, ORG); ell(x, 8, 8, 4, 2, '#8fd0ff'); R(x, 3, 8, 10, 1, ORGD); R(x, 8, 4, 1, 9, ORGD); },
        bagana: () => { for (const X of [4, 10]) { R(x, X, 1, 3, 14, O); R(x, X + 1, 2, 1, 12, ORG); R(x, X + 1, 3, 1, 1, '#f7c646'); R(x, X + 1, 11, 1, 1, '#2b52a5'); } },
        uni: () => { for (let i = 0; i < 5; i++) line(x, 2 + i * 2, 14, 6 + i * 2, 1, i % 2 ? ORGD : ORG); },
        esgii: () => { R(x, 1, 5, 12, 8, O); R(x, 2, 6, 10, 6, FELT); R(x, 2, 11, 10, 1, FELTD); ell(x, 12, 9, 3, 4, O); ell(x, 12, 9, 2, 3, FELTD); P(x, 12, 9, FELT); },
        buurees: () => { R(x, 1, 3, 14, 10, O); R(x, 2, 4, 12, 8, '#ffffff'); R(x, 2, 6, 12, 1, '#3f76db'); R(x, 2, 11, 12, 1, '#d8dde6'); },
        buslvvr: () => { ell(x, 8, 8, 6, 6, O); ell(x, 8, 8, 5, 5, '#a46d3b'); ell(x, 8, 8, 3, 3, O); ell(x, 8, 8, 2, 2, '#c99257'); P(x, 13, 13, O); P(x, 14, 14, '#a46d3b'); },
        tulga: () => { R(x, 3, 6, 10, 8, O); R(x, 4, 7, 8, 6, '#5a5a66'); R(x, 5, 9, 6, 3, '#f39b2c'); R(x, 7, 1, 2, 5, O); R(x, 6, 14, 1, 2, O); R(x, 9, 14, 1, 2, O); },
        wool: () => { for (const [bx, by, r] of [[5, 9, 4], [10, 9, 4], [8, 6, 4]]) ell(x, bx, by, r, r - 1, O); for (const [bx, by, r] of [[5, 9, 3], [10, 9, 3], [8, 6, 3]]) ell(x, bx, by, r, r - 1, '#f6f2e9'); P(x, 7, 5, '#ffffff'); },
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
        wrestle: () => { const w = wrestler('#d8342b', '#edbb93', 'dance', 0); x.drawImage(w, 0, 0, 32, 48, 2, 0, 11, 16); },
        ovoo: () => { for (let r = 0; r < 5; r++) for (let i = -r; i <= r; i++) R(x, 7 + i * 1.5 | 0, 7 + r * 2, 2, 2, [K.rock, K.rockL, K.rockD][(i + r + 6) % 3]); R(x, 7, 1, 1, 7, K.woodD); line(x, 7, 2, 3, 7, K.light); line(x, 8, 2, 12, 6, K.blue); },
        dog: () => { const f = bankharFace(0); x.drawImage(f, 0, 0, 24, 22, 0, 1, 16, 15); },
        book: () => { R(x, 1, 3, 14, 11, K.out); R(x, 2, 4, 6, 9, K.paper); R(x, 8, 4, 6, 9, '#fff3d6'); R(x, 7, 3, 2, 11, K.redD); [6, 8, 10].forEach((ly) => { R(x, 3, ly, 4, 1, K.woodL); R(x, 9, ly, 4, 1, K.woodL); }); },
        menu: () => { [4, 8, 12].forEach((ly) => { R(x, 2, ly - 1, 12, 3, K.out); R(x, 3, ly, 10, 1, K.paper); }); },
        horse: () => { const hs = horse('bay', 0, true); x.drawImage(hs, 0, 0, 28, 22, 0, 2, 16, 13); },
        trophy: () => { R(x, 4, 2, 8, 6, K.out); R(x, 5, 3, 6, 5, K.gold); R(x, 2, 3, 2, 3, K.goldD); R(x, 12, 3, 2, 3, K.goldD); R(x, 7, 8, 2, 3, K.goldD); R(x, 5, 11, 6, 3, K.out); R(x, 6, 12, 4, 1, K.woodL); P(x, 6, 4, K.white); },
        bow: () => { for (let r = 0; r < 13; r++) { const bx = 4 + Math.round(4 * Math.sin((r / 12) * Math.PI)); P(x, bx, 2 + r, K.woodD); P(x, bx + 1, 2 + r, K.wood); } line(x, 4, 2, 4, 14, K.white); line(x, 3, 8, 14, 8, K.woodD); R(x, 13, 7, 2, 3, '#8a8a99'); R(x, 2, 7, 2, 1, K.red); R(x, 2, 9, 2, 1, K.red); },
        tree: () => { R(x, 7, 9, 2, 6, K.woodD); line(x, 8, 10, 3, 5, K.woodD); line(x, 8, 10, 13, 5, K.woodD); line(x, 8, 8, 8, 3, K.woodD); [[3, 4], [13, 4], [8, 2], [5, 7], [11, 7]].forEach(([a, b]) => blob(x, a, b, 1, 1, K.gold, K.goldD)); },
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

  TG.pixel = { horse, raceFlag, COATS, bankhar, bankharFace, K, DEEL, hash, mk, R, P, ell, blob, line, shade, renderStatic, drop, char, animal, icon, iconCanvas, gerSprite, gerStage, shorn, feltMat, interior, gerRoom, ROOM, wrestler, wrestlerFront, beast, BEAST };
})(window.TG);
