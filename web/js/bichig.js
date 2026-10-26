/* Монгол бичгийн академи: a master scribe teaches the traditional Mongol script. Watch the letter being written top to
   bottom, trace it with a finger or trackpad, then write it from memory. Tracing is checked against the real letter shape
   (Noto Sans Mongolian): how much of the letter you covered, how well you stayed on it, and that you wrote downwards. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const FONT = '"Noto Sans Mongolian"';
  const I = (id, g, cyr, lat, tip) => ({ id, g, cyr, lat, tip });
  const UNITS = [
    { id: 'vowel', icon: 'ᠠ', name: T('Эгшиг үсэг', 'Vowels'), items: [
      I('a', 'ᠠ', 'а', 'a', T('Цагаан толгойн эхний үсэг. Титэм, шүд, сүүлтэй. Эр эгшиг.', 'The first letter of the alphabet, with a crown, a tooth and a tail. A “male” (back) vowel.')),
      I('e', 'ᠡ', 'э', 'e', T('Эм эгшиг. Эр, эм эгшиг нэг үгэнд холилддоггүй.', 'A “female” (front) vowel. Male and female vowels don’t mix in one word.')),
      I('i', 'ᠢ', 'и', 'i', T('Саармаг эгшиг: эр, эм аль ч үгэнд орж болно.', 'A neutral vowel: it can go in any word.')),
      I('o', 'ᠣ', 'о', 'o', T('“О”, “у” хоёр яг ижил хэлбэртэй бичигддэг. Эр эгшиг.', '“O” and “u” are written exactly the same. A male vowel.')),
      I('u', 'ᠤ', 'у', 'u', T('“О”-той адилхан! Үгийн утгаас аль нь болохыг танина.', 'Just like “o”! You tell which it is from the word’s meaning.')),
      I('oe', 'ᠥ', 'ө', 'ö', T('“Ө”, “ү” хоёр ижил хэлбэртэй. Эм эгшиг.', '“Ö” and “ü” share one shape. A female vowel.')),
      I('ue', 'ᠦ', 'ү', 'ü', T('“Ө”-тэй адил хэлбэртэй эм эгшиг.', 'A female vowel shaped like “ö”.')),
    ] },
    { id: 'syll', icon: 'ᠨᠠ', name: T('Үе: гийгүүлэгч + эгшиг', 'Syllables'), items: [
      I('na', 'ᠨᠠ', 'на', 'na', T('Н + а = на. Монгол бичигт гийгүүлэгчийг эгшигтэй нь хамт үеэр нь сурдаг.', 'N + a = na. Mongol script is learned in syllables: a consonant with its vowel.')),
      I('ba', 'ᠪᠠ', 'ба', 'ba', T('Б + а = ба. “Баатар” гэдэг үг ингэж эхэлнэ.', 'B + a = ba, as at the start of “baatar” (hero).')),
      I('ma', 'ᠮᠠ', 'ма', 'ma', T('М + а = ма. “Мал” гэдэг үг ингэж эхэлнэ.', 'M + a = ma, as at the start of “mal” (livestock).')),
      I('la', 'ᠯᠠ', 'ла', 'la', T('Л + а = ла.', 'L + a = la.')),
      I('sa', 'ᠰᠠ', 'са', 'sa', T('С + а = са. “Сар” (moon) гэдэг үг ингэж эхэлнэ.', 'S + a = sa, as at the start of “sar” (moon).')),
      I('qa', 'ᠬᠠ', 'ха', 'kha', T('Х + а = ха. “Хаан” гэдэг үг ингэж эхэлнэ.', 'Kh + a = kha, as at the start of “khaan” (king).')),
      I('ga', 'ᠭᠠ', 'га', 'ga', T('Г + а = га.', 'G + a = ga.')),
      I('ta', 'ᠲᠠ', 'та', 'ta', T('Т + а = та. “Та” гэж ахмад хүнийг хүндэлж хэлдэг.', 'T + a = ta. “Ta” is the polite “you” for elders.')),
      I('da', 'ᠳᠠ', 'да', 'da', T('Д + а = да.', 'D + a = da.')),
      I('cha', 'ᠴᠠ', 'ча', 'cha', T('Ч + а = ча. “Чанар” гэдэг үг ингэж эхэлнэ.', 'Ch + a = cha.')),
      I('ja', 'ᠵᠠ', 'жа', 'ja', T('Ж + а = жа.', 'J + a = ja.')),
      I('ya', 'ᠶᠠ', 'я', 'ya', T('Й + а = я.', 'Y + a = ya.')),
    ] },
    { id: 'word', icon: 'ᠭᠡᠷ', name: T('Анхны үгс', 'First words'), items: [
      I('ger', 'ᠭᠡᠷ', 'гэр', 'ger', T('Гэр: бидний уламжлалт орон байр.', 'Ger: our traditional home.')),
      I('mori', 'ᠮᠣᠷᠢ', 'морь', 'mori', T('Морь: монгол хүний хамгийн сайн нөхөр.', 'Horse: a Mongol’s best friend.')),
      I('eji', 'ᠡᠵᠢ', 'ээж', 'eej', T('Ээж. Монгол бичгээр “эжи” гэж бичдэг.', 'Mother. In Mongol script it is spelled “eji”.')),
      I('abu', 'ᠠᠪᠤ', 'аав', 'aav', T('Аав. Монгол бичгээр “абу” гэж бичдэг.', 'Father. In Mongol script it is spelled “abu”.')),
      I('nara', 'ᠨᠠᠷᠠ', 'нар', 'nar', T('Нар. Монгол бичгээр “нара” гэж бичдэг.', 'Sun. In Mongol script it is spelled “nara”.')),
      I('usu', 'ᠤᠰᠤ', 'ус', 'us', T('Ус. Монгол бичгээр “усу” гэж бичдэг.', 'Water. In Mongol script it is spelled “usu”.')),
      I('noqai', 'ᠨᠣᠬᠠᠢ', 'нохой', 'nokhoi', T('Нохой, яг Басар шиг! Вуф!', 'Dog, just like Basar! Woof!')),
      I('mongol', 'ᠮᠣᠩᠭᠣᠯ', 'монгол', 'mongol', T('Монгол! Үүнийг бичиж чадвал чи жинхэнэ бичээч боллоо.', 'Mongol! If you can write this, you are a real scribe.')),
    ] },
  ];
  const ALL = UNITS.flatMap((u) => u.items.map((it) => ({ ...it, unit: u.id })));
  const MASTER = { deel: 'brown', skin: '#D9A06E', hat: 'mongol', neck: null, face: null, pet: null };

  const data = (p) => { p.bichig = p.bichig || { s: {}, mem: {} }; return p.bichig; };
  const starsOf = (p, id) => data(p).s[id] || 0;
  const unlocked = (p, idx) => idx === 0 || starsOf(p, ALL[idx - 1].id) > 0;
  const done = (p) => ALL.filter((it) => starsOf(p, it.id) > 0).length;

  /** Where the glyph sits on a canvas: measured once from the real font so the letter fills the writing area. */
  function layout(text, W, H) {
    const M = 200, c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = `${M}px ${FONT}`;
    const len = Math.ceil(x.measureText(text).width) + M;
    c.width = M * 3; c.height = len + M; x.font = `${M}px ${FONT}`; x.textBaseline = 'middle';
    const MX = M * 1.5, MY = M / 2;
    x.save(); x.translate(MX, MY); x.rotate(Math.PI / 2); x.fillText(text, 0, 0); x.restore();   // vertical: the line runs downwards
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let X = 0; X < c.width; X += 2) if (d[(y * c.width + X) * 4 + 3] > 80) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return null;
    const s = Math.min((W * 0.62) / (x1 - x0), (H * 0.84) / (y1 - y0));
    let spX = x0, best = -1;                                         // the spine: the column with the most ink
    for (let X = x0; X <= x1; X += 2) { let n = 0; for (let y = y0; y <= y1; y += 2) if (d[(y * c.width + X) * 4 + 3] > 80) n++; if (n > best) { best = n; spX = X; } }
    return { s, spine: W / 2 + (spX - (x0 + x1) / 2) * s, bcx: (x0 + x1) / 2, bcy: (y0 + y1) / 2, MX, MY, M, top: H / 2 - ((y1 - y0) * s) / 2, bot: H / 2 + ((y1 - y0) * s) / 2, left: W / 2 - ((x1 - x0) * s) / 2, right: W / 2 + ((x1 - x0) * s) / 2 };
  }
  function drawGlyph(x, text, lay, W, H, style, strokeW) {
    x.save(); x.translate(W / 2, H / 2); x.scale(lay.s, lay.s); x.translate(-lay.bcx, -lay.bcy); x.translate(lay.MX, lay.MY); x.rotate(Math.PI / 2);
    x.font = `${lay.M}px ${FONT}`; x.textBaseline = 'middle'; x.fillStyle = style; x.fillText(text, 0, 0);
    if (strokeW) { x.strokeStyle = style; x.lineWidth = strokeW / lay.s; x.lineJoin = 'round'; x.strokeText(text, 0, 0); }
    x.restore();
  }
  /** Pixel-art version of anything drawn at full size: draw it small (1/cell), keep hard edges in one colour. */
  function pixLayer(lw, lh, cell, draw, color) {
    const c = document.createElement('canvas'); c.width = lw; c.height = lh;
    const x = c.getContext('2d'); x.save(); x.scale(1 / cell, 1 / cell); draw(x); x.restore();
    const img = x.getImageData(0, 0, lw, lh), d = img.data, n = parseInt(color.slice(1, 7), 16), a = color.length > 7 ? parseInt(color.slice(7), 16) : 255;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 96) { d[i] = n >> 16; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255; d[i + 3] = a; } else d[i + 3] = 0; }
    x.putImageData(img, 0, 0); return c;
  }
  const fontOk = () => !document.fonts || !document.fonts.check || document.fonts.check(`20px ${FONT}`, 'ᠠ');
  /** A small pixel-art glyph (letter tiles, headers): w×h CSS pixels, drawn on a grid of `cell` pixels. */
  function pixelGlyph(text, w, h, cell = 2, color = '#2b1e2e') {
    const lw = Math.ceil(w / cell), lh = Math.ceil(h / cell), cv = document.createElement('canvas');
    cv.width = lw; cv.height = lh; cv.className = 'bc-pix'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const paint = () => { const lay = layout(text, lw, lh); if (!lay) return; const layer = pixLayer(lw, lh, 1, (x) => drawGlyph(x, text, lay, lw, lh, '#000'), color); const x = cv.getContext('2d'); x.clearRect(0, 0, lw, lh); x.drawImage(layer, 0, 0); };
    if (fontOk()) paint(); else if (document.fonts) document.fonts.load(`20px ${FONT}`, 'ᠠ').then(paint);
    return cv;
  }
  const mask = (W, H, paint) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); paint(x); return x.getImageData(0, 0, W, H).data; };
  const BRUSH = 13, TOL = 9;

  /** Score a tracing: coverage of the letter, staying on the letter, writing from the top downwards. */
  function score(text, lay, W, H, strokes) {
    const pts = strokes.reduce((n, s) => n + s.length, 0);
    if (pts < 4) return { cov: 0, prec: 0, down: false, top: false, empty: true };
    const ink = (wd) => (x) => { x.strokeStyle = '#000'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = wd; for (const s of strokes) { x.beginPath(); s.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); if (s.length === 1) x.lineTo(s[0].x + 0.1, s[0].y); x.stroke(); } };
    const G = mask(W, H, (x) => drawGlyph(x, text, lay, W, H, '#000')), Gp = mask(W, H, (x) => drawGlyph(x, text, lay, W, H, '#000', TOL * 2));
    const Ik = mask(W, H, ink(BRUSH)), Ip = mask(W, H, ink(BRUSH + TOL * 2));
    let g = 0, gHit = 0, k = 0, kHit = 0;
    for (let i = 3; i < G.length; i += 8) { if (G[i] > 100) { g++; if (Ip[i] > 100) gHit++; } if (Ik[i] > 100) { k++; if (Gp[i] > 100) kHit++; } }
    const first = strokes[0][0], hgt = Math.max(1, lay.bot - lay.top);
    let dy = 0; for (const s of strokes) if (s.length > 1) dy += s[s.length - 1].y - s[0].y;
    return { cov: g ? gHit / g : 0, prec: k ? kHit / k : 0, top: first.y < lay.top + hgt * 0.4, down: dy >= 0 };
  }

  // ------------------------------------------------------------ the academy screen
  function screen({ shell }) {
    const p = S.active();
    let idx = Math.max(0, ALL.findIndex((it, i) => unlocked(p, i) && !starsOf(p, it.id))); if (idx < 0) idx = 0;
    let mode = 'trace';                                             // trace | memory
    const master = h('canvas', { class: 'bc-master', width: 16, height: 28 });
    { const m = master.getContext('2d'); m.imageSmoothingEnabled = false; m.drawImage(TG.pixel.char(MASTER, 0, 0), 0, 0); }
    const bubble = h('div', { class: 'bc-say' });
    const cv = h('canvas', { class: 'bc-cv', 'aria-label': L('Энд бичнэ', 'Write here') }), cx = cv.getContext('2d');
    const head = h('div', { class: 'bc-head' }), result = h('div', { class: 'bc-result' }), tiles = h('div', { class: 'bc-units' });
    const btnShow = h('button', { class: 'btn' }, '▶ ', L('Багш үзүүлэх', 'Show me')), btnClear = h('button', { class: 'btn' }, '↺ ', L('Арилгах', 'Clear'));
    const btnCheck = h('button', { class: 'btn primary' }, '✓ ', L('Шалгах', 'Check')), btnMode = h('button', { class: 'btn' });
    let W = 300, H = 420, dpr = 1, lay = null, strokes = [], cur = null, demoT = -1, raf = 0, item = ALL[idx];
    let cell = 4, lw = 75, lh = 105, guideL = null;          // the writing area is drawn as pixel art on a grid of `cell` CSS pixels
    const say = (txt) => { bubble.textContent = txt; };

    function size() {
      const r = cv.getBoundingClientRect(); W = Math.max(200, Math.round(r.width || 300)); H = Math.round(W * 1.3); dpr = Math.min(3, devicePixelRatio || 1);
      cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      lay = layout(item.g, W, H);
      cell = Math.max(3, Math.round(W / 70)); lw = Math.ceil(W / cell); lh = Math.ceil(H / cell);
      guideL = lay ? pixLayer(lw, lh, cell, (x) => drawGlyph(x, item.g, lay, W, H, '#000'), '#5a3c2833') : null;
      paint();
    }
    function paint(ts) {
      const x = cx; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(201,154,90,.35)'; for (let gy = cell * 6; gy < H; gy += cell * 6) x.fillRect(0, gy, W, Math.max(1, Math.round(cell / 3)));   // paper lines on the pixel grid
      x.imageSmoothingEnabled = false;
      const blit = (layer) => x.drawImage(layer, 0, 0, lw * cell, lh * cell);
      if (!lay) { x.fillStyle = '#7a5432'; x.font = '700 15px sans-serif'; x.fillText(L('Үсэг ачаалж байна…', 'Loading the letter…'), 20, 40); return; }
      // the spine (нуруу) every letter hangs from, and a "start here" arrow at the top
      x.fillStyle = 'rgba(225,75,61,.5)'; const sx0 = Math.floor(lay.spine / cell) * cell; for (let gy = cell * 2; gy < H - cell * 2; gy += cell * 3) x.fillRect(sx0, gy, cell, cell * 2);   // the spine, as a dashed pixel line
      x.fillStyle = '#e14b3d'; x.font = '800 13px sans-serif'; x.textAlign = 'center'; x.fillText(L('эхлэл ↓', 'start ↓'), Math.min(W - 34, lay.right + 34), lay.top + 10); x.textAlign = 'left';
      if (mode === 'trace' && guideL) blit(guideL);
      if (demoT >= 0) { // the master writes it from the top down
        const q = Math.min(1, ((ts || performance.now()) - demoT) / 2200), yy = lay.top - 6 + (lay.bot - lay.top + 12) * q;
        blit(pixLayer(lw, lh, cell, (q) => { q.beginPath(); q.rect(0, 0, W, yy); q.clip(); drawGlyph(q, item.g, lay, W, H, '#000'); }, '#2b1e2e'));
        x.fillStyle = '#e14b3d'; const by = Math.floor(yy / cell) * cell; x.fillRect(sx0 - cell, by - cell, cell * 3, cell * 3);   // the master's brush
        if (q >= 1) { demoT = -1; setTimeout(paint, 500); }
      }
      if (strokes.length) blit(pixLayer(lw, lh, cell, (q) => { q.strokeStyle = '#000'; q.lineCap = 'round'; q.lineJoin = 'round'; q.lineWidth = BRUSH; for (const s of strokes) { q.beginPath(); s.forEach((pt, i) => (i ? q.lineTo(pt.x, pt.y) : q.moveTo(pt.x, pt.y))); if (s.length === 1) q.lineTo(s[0].x + 0.1, s[0].y); q.stroke(); } }, '#1d1a2a'));
    }
    const loop = (ts) => { if (!cv.isConnected) return; if (demoT >= 0) paint(ts); raf = requestAnimationFrame(loop); };
    // pointer drawing: finger, pen, mouse or trackpad
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (demoT >= 0) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); cur = [pos(e)]; strokes.push(cur); rc(result); paint(); });
    cv.addEventListener('pointermove', (e) => { if (!cur) return; e.preventDefault(); const pt = pos(e), lp = cur[cur.length - 1]; if (Math.hypot(pt.x - lp.x, pt.y - lp.y) > 1.5) { cur.push(pt); paint(); if (Math.random() < 0.08) TG.sfx.scrub && TG.sfx.scrub(); } });
    const up = () => { cur = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);

    function select(i) {
      if (!unlocked(p, i)) { TG.sfx.bad(); return say(L('Эхлээд өмнөх үсгээ бичээрэй.', 'Write the one before first.')); }
      idx = i; item = ALL[i]; strokes = []; mode = 'trace'; rc(result); demoT = -1;
      renderHead(); renderTiles(); size();
      say(tx(item.tip) + ' ' + L('Эхлээд “Багш үзүүлэх” дээр дараад, дараа нь дээрээс доош даган бич.', 'Press “Show me” first, then trace it from the top down.'));
    }
    function renderHead() {
      const st = starsOf(p, item.id);
      rc(head, pixelGlyph(item.g, 44, 96, 2),
        h('div', null, h('b', null, item.cyr, ' · ', item.lat), h('small', null, tx(UNITS.find((u) => u.id === item.unit).name), ' · ', `${idx + 1}/${ALL.length}`),
          h('span', { class: 'bc-stars' }, '★'.repeat(st) + '☆'.repeat(3 - st), data(p).mem[item.id] ? ' 🧠' : '')));
      btnMode.textContent = mode === 'trace' ? L('🧠 Санаж бичих', '🧠 From memory') : L('✍️ Даган бичих', '✍️ Trace');
    }
    function renderTiles() {
      rc(tiles, UNITS.map((u) => h('section', { class: 'bc-unit' }, h('h3', null, pixelGlyph(u.icon, 22, 44, 2), ' ', tx(u.name)),
        h('div', { class: 'bc-tiles' }, u.items.map((it) => { const i = ALL.findIndex((q) => q.id === it.id), st = starsOf(p, it.id), lock = !unlocked(p, i);
          return h('button', { class: 'bc-tile' + (i === idx ? ' on' : '') + (lock ? ' lock' : '') + (st ? ' done' : ''), onclick: () => select(i), 'aria-label': it.cyr },
            pixelGlyph(it.g, 32, 60, 2), h('small', null, lock ? '🔒' : it.cyr), st ? h('i', null, '★'.repeat(st)) : null); })))));
    }
    btnShow.addEventListener('click', () => { strokes = []; rc(result); demoT = performance.now(); TG.sfx.whoosh && TG.sfx.whoosh(); say(L('Хараарай: дээрээс эхлээд нуруугаа даган доош бичнэ. Монгол бичгийн мөр зүүнээс баруун тийш явдаг.', 'Watch: start at the top and write down along the spine. Columns of Mongol script go from left to right.')); });
    btnClear.addEventListener('click', () => { strokes = []; rc(result); paint(); });
    btnMode.addEventListener('click', () => { mode = mode === 'trace' ? 'memory' : 'trace'; strokes = []; rc(result); renderHead(); paint(); say(mode === 'memory' ? L('Одоо загваргүйгээр санаж бичээд үз! Улаан тасархай шугам бол нуруу.', 'Now write it from memory, with no guide! The red dashed line is the spine.') : tx(item.tip)); });
    btnCheck.addEventListener('click', () => {
      if (!lay) return;
      const r = score(item.g, lay, W, H, strokes), loose = mode === 'memory' ? 0.07 : 0;
      if (r.empty) { TG.sfx.bad(); return say(L('Эхлээд хуруу эсвэл тачпадаараа бичээрэй.', 'Write it first with your finger or trackpad.')); }
      const ok = r.cov >= 0.55 - loose && r.prec >= 0.6 - loose && r.down && r.top;
      const stars = !ok ? 0 : r.cov >= 0.82 - loose && r.prec >= 0.82 - loose ? 3 : r.cov >= 0.68 - loose && r.prec >= 0.7 - loose ? 2 : 1;
      const pct = (v) => Math.round(v * 100) + '%';
      rc(result, h('div', { class: 'bc-meter' }, h('span', null, L('Бүрхсэн', 'Covered'), h('b', null, pct(r.cov))), h('span', null, L('Шугамандаа', 'On the line'), h('b', null, pct(r.prec))), h('span', null, L('Чиглэл', 'Direction'), h('b', null, r.down && r.top ? '↓ ✓' : '✗'))));
      if (!ok) {
        TG.sfx.bad();
        return say(!r.top || !r.down ? L('Монгол бичгийг дээрээс доош бичдэг. Дээд талаас нь эхлээд дахиад оролдоорой!', 'Mongol script is written from the top down. Start at the top and try again!')
          : r.cov < 0.55 - loose ? L('Үсгийн зарим хэсгийг алгассан байна. Шүд, сүүлийг нь бүгдийг нь бичээрэй.', 'You missed part of the letter. Write every tooth and the tail too.')
          : L('Бага зэрэг шугамнаас гарчээ. Аажуухан, загварыг даган бичээрэй.', 'A little off the lines. Go slowly and follow the shape.'));
      }
      const d = data(p), was = d.s[item.id] || 0, first = !was;
      d.s[item.id] = Math.max(was, stars);
      if (mode === 'memory') d.mem[item.id] = 1;
      S.save(); TG.sfx.good(); if (stars === 3) TG.confetti(40);
      if (first) {
        TG.villageReward && TG.villageReward(5, 10);
        const u = UNITS.find((q) => q.id === item.unit);
        if (u.items.every((it) => d.s[it.id])) { TG.confetti(90); TG.sfx.win(); TG.villageQuest && TG.villageQuest('lesson'); TG.toast('🎓 ' + L(`“${u.name.mn}” бүлгийг дуусгалаа!`, `You finished “${u.name.en}”!`)); }
      }
      TG.achievements && TG.achievements.check();
      say((stars === 3 ? L('Гайхалтай! Жинхэнэ бичээч шиг бичлээ. ', 'Wonderful! You wrote it like a real scribe. ') : stars === 2 ? L('Сайн байна! ', 'Well done! ') : L('Болж байна! Дахиад бичвэл улам сайжирна. ', 'Good! Write it again and it gets even better. '))
        + (mode === 'trace' ? L('Одоо “Санаж бичих” дээр дараад загваргүй бичээд үз.', 'Now try “From memory” without the guide.') : ''));
      renderHead(); renderTiles();
      if (idx + 1 < ALL.length) result.appendChild(h('button', { class: 'btn primary block', onclick: () => select(idx + 1) }, L('Дараагийнх →', 'Next →')));
    });
    const page = h('div', { class: 'bichig' },
      h('section', { class: 'bc-hero px-card' }, master, h('div', null, h('div', { class: 'eyebrow' }, L('Монгол бичгийн академи', 'Mongol Script Academy')), h('h1', null, L('Бичээч багш', 'The Master Scribe')), bubble)),
      h('section', { class: 'bc-rules px-card' }, h('b', null, L('Багшийн зөвлөгөө', 'The master’s rules')),
        h('ul', null, h('li', null, L('Монгол бичгийг дээрээс доош, мөрийг зүүнээс баруун тийш бичнэ.', 'Write from top to bottom; columns go left to right.')),
          h('li', null, L('Үсэг бүр “нуруу” гэдэг босоо шугамд өлгөөтэй.', 'Every letter hangs on a vertical line called the spine (нуруу).')),
          h('li', null, L('Үсгийн хэсгүүд: титэм (эхэнд), шүд, гэдэс, сүүл (төгсгөлд).', 'Parts of a letter: crown (титэм) at the start, teeth (шүд), bellies (гэдэс), tail (сүүл) at the end.')))),
      h('section', { class: 'bc-work px-card' }, head, cv, h('div', { class: 'bc-btns' }, btnShow, btnClear, btnMode, btnCheck), result,
        h('button', { class: 'btn ghost block', onclick: () => TG.basar.open({ context: L(`Би “${item.cyr}” (${item.g}) гэж Монгол бичгээр бичиж сурч байна.`, `I’m learning to write “${item.lat}” (${item.g}) in Mongol script.`) }) }, '🐕 ', L('Басараас асуух', 'Ask Basar'))),
      h('div', { class: 'bc-progress' }, L(`Бичсэн: ${done(p)}/${ALL.length}`, `Written: ${done(p)}/${ALL.length}`)),
      tiles);
    renderHead(); renderTiles();
    say(L('Сайн уу, шавь минь! Би чамд монгол бичиг заая. Доорх үсгээс эхэлье.', 'Hello, my student! I will teach you Mongol script. Let’s begin with the letter below.'));
    const fontReady = document.fonts && document.fonts.load ? document.fonts.load(`40px ${FONT}`, 'ᠠᠮᠣᠩᠭᠣᠯ') : Promise.resolve();
    setTimeout(() => { fontReady.then(() => { if (cv.isConnected) select(idx); }); }, 0);
    const onResize = () => { if (cv.isConnected) size(); else window.removeEventListener('resize', onResize); };
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(loop);
    TG.bichig._cur = { get item() { return item; }, get lay() { return lay; }, get W() { return W; }, get H() { return H; }, setStrokes: (s) => { strokes = s; paint(); }, check: () => btnCheck.click(), select, mode: (m) => { mode = m; } }; // used by automated tests
    return shell(page);
  }
  function rc(el, ...kids) { el.replaceChildren(...kids); }
  TG.bichig = { screen, UNITS, ALL, done, score, layout, drawGlyph, pixelGlyph };
})(window.TG);
