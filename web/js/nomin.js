/* Guide Bolormaa in full (pixel art, animated in code) and the Aimag Travel Pass.
   The first two provinces on the passport route are free. Going further needs the Aimag Travel Pass (9,900₮, paid once
   by a grown-up): when a child tries, Bolormaa steps in front of the road barrier and kindly explains the pass. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const FREE = 2, PRICE = 9900;
  const OUT = '#2b1e2e';

  // ------------------------------------------------------------ full-body Bolormaa (76×168 pixel art in three layers)
  // back: hair, deel, boots, the arm at her side · head: her portrait, tilted smoothly by CSS · front: the khadag and the gesturing arm.
  // Breathing, the hop and the head tilt are CSS transforms, so they glide between pixels instead of jumping a whole one.
  const W = 76, H = 168, HX = 14, HY = 2, CX = 38, HEAD_H = 40;
  const ease = (q) => q * q * (3 - 2 * q);
  function painter(x) {
    const px = (X, Y, col) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), 1, 1); };
    const disc = (cx, cy, r, col) => { for (let Y = Math.floor(cy - r); Y <= Math.ceil(cy + r); Y++) for (let X = Math.floor(cx - r); X <= Math.ceil(cx + r); X++) if ((X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2 <= r * r) px(X, Y, col); };
    const limb = (ax, ay, bx, by, r, col) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay)); for (const pass of [OUT, col]) for (let i = 0; i <= n; i++) { const q = i / (n || 1); disc(ax + (bx - ax) * q, ay + (by - ay) * q, pass === OUT ? r + 1 : r, pass); } };
    return { px, disc, limb };
  }
  /** Where her arms are for a pose at time t (shared by the back and front layers). */
  function arms(pose, t) {
    if (pose === 'yay') { const up = Math.sin(t * 5) * 0.12; return { left: { el: [7, HY + 44], hand: [6 + up * 10, HY + 27], open: true }, right: { el: [69, HY + 44], hand: [70 - up * 10, HY + 27], open: true } }; }
    const left = { el: [9, HY + 72], hand: [14, HY + 90], open: false };                                // relaxed at her side
    if (pose === 'bye') { const a = Math.sin(t * 4.2) * 0.42; return { left, right: { el: [64, HY + 72], hand: [64 + Math.sin(a) * 18, HY + 72 - Math.cos(a) * 18], open: true } }; }
    const a = Math.sin(t * 3.6) * 0.16;                                                                   // 'wait': a gentle "just a moment" finger
    return { left, right: { el: [64, HY + 72], hand: [64 + Math.sin(a) * 18, HY + 72 - Math.cos(a) * 18], open: false, finger: true, ang: a } };
  }
  function drawBack(x, t, pose) {
    const GP = TG.guidePalette, face = TG.guideFace; if (!GP || !face) return;
    x.clearRect(0, 0, W, H);
    const { px, disc, limb } = painter(x);
    const top = HY + 46, waist = HY + 88, hem = HY + 144;
    // a soft shadow on the ground
    x.fillStyle = 'rgba(43,30,46,.22)'; for (let i = -20; i <= 20; i++) { const w = Math.sqrt(1 - (i / 21) ** 2) * 2.5; x.fillRect(CX + i, hem + 14 - w, 1, w * 2); }
    // long hair down her back, gently swaying
    for (let Y = HY + 30; Y < HY + 84; Y++) {
      const q = (Y - HY - 30) / 54, sway = Math.sin(t * 1.8 - q * 2) * q * 1.2, hw = 15.5 + Math.sin(q * Math.PI) * 1.2 - q * 4.5;
      const l = Math.round(CX - hw + sway), r = Math.round(CX + hw + sway);
      for (let X = l; X <= r; X++) px(X, Y, (X - l) % 3 === 0 ? GP.hair[0] : (X - l) % 7 === 4 ? GP.hair[3] : X < CX ? GP.hair[2] : GP.hair[1]);
      px(l - 1, Y, OUT); px(r + 1, Y, OUT);
    }
    // the deel: shoulders, a slimmer waist, then a long A-line skirt with soft folds
    const half = (Y) => (Y < waist ? 23 - ease((Y - top) / (waist - top)) * 8 : 15 + ((Y - waist) / (hem - waist)) * 9);
    for (let Y = top; Y <= hem + 1; Y++) {
      const hw = half(Math.min(Y, hem)), l = Math.round(CX - hw), r = Math.round(CX + hw);
      for (let X = l - 1; X <= r + 1; X++) {
        const edge = X === l - 1 || X === r + 1 || Y === hem + 1, rel = (X - l) / Math.max(1, r - l);
        const fold = Y > waist + 6 && [0.3, 0.55, 0.78].some((f) => Math.abs(rel - f - Math.sin(t * 1.4 + f * 9) * 0.012) < 0.02);
        px(X, Y, edge ? OUT : fold ? GP.deel[1] : rel < 0.18 ? GP.deel[3] : rel < 0.6 ? GP.deel[2] : GP.deel[1]);
      }
    }
    for (let X = Math.round(CX - half(hem)); X <= Math.round(CX + half(hem)); X++) { px(X, hem - 3, GP.gold[1]); px(X, hem - 1, GP.gold[1]); px(X, hem, GP.gold[2]); } // a double gold hem
    for (let i = 0; i < 18; i++) { px(CX + 2 + i * 0.5, top + i, GP.gold[2]); px(CX + 3 + i * 0.5, top + i, GP.gold[1]); }   // the overlap of the deel
    for (let Y = top + 18; Y < hem - 3; Y++) px(CX + 11 + (Y - top - 18) * 0.1, Y, GP.gold[1]);
    for (const by of [top + 9, top + 14]) { px(CX + 7, by, GP.gold[2]); px(CX + 7, by + 1, GP.gold[0]); }                    // two knot buttons
    // the sash (бүс), with its ends hanging on the side
    for (let Y = waist - 2; Y <= waist + 2; Y++) { const hw = half(Y); for (let X = Math.round(CX - hw); X <= Math.round(CX + hw); X++) px(X, Y, Y === waist - 2 ? GP.gold[2] : Y === waist + 2 ? GP.gold[0] : '#e9a91f'); }
    for (let i = 0; i < 16; i++) { const sw = Math.sin(t * 2 + i * 0.25) * (i / 16) * 1.4; for (const [dx, c] of [[-13, '#e9a91f'], [-12, GP.gold[0]], [-10, '#e9a91f'], [-9, GP.gold[0]]]) px(CX + dx + sw, waist + 3 + i, c); }
    // Mongol boots (гутал) with upturned toes, peeking out under the hem
    for (const bx of [CX - 10, CX + 3]) {
      for (let Y = hem + 2; Y < hem + 13; Y++) for (let X = bx; X < bx + 8; X++) px(X, Y, Y === hem + 12 || X === bx || X === bx + 7 ? OUT : X === bx + 1 ? '#b2412b' : '#8e2b1d');
      for (let X = bx + 1; X < bx + 7; X++) px(X, hem + 5, GP.gold[2]);
      px(bx - 1, hem + 10, OUT); px(bx - 2, hem + 9, OUT); px(bx - 1, hem + 11, '#8e2b1d');
    }
    // the shoulders and collar from her portrait, then the arm at her side
    x.drawImage(face('happy', false, false), 0, HEAD_H, 48, 48 - HEAD_H, HX, HY + HEAD_H, 48, 48 - HEAD_H);
    const A = arms(pose, t).left;
    limb(HX + 4, HY + 50, A.el[0], A.el[1], 3.8, GP.deel[2]); limb(A.el[0], A.el[1], A.hand[0], A.hand[1], 3.4, GP.deel[3]);
    disc(A.hand[0], A.hand[1], 3.6, GP.gold[1]);
    const hy2 = A.hand[1] + (A.open ? -3 : 3); disc(A.hand[0], hy2, 3, OUT); disc(A.hand[0], hy2, 2.2, GP.skin[3]);
  }
  function drawFront(x, t, pose) {
    const GP = TG.guidePalette; if (!GP) return;
    x.clearRect(0, 0, W, H);
    const { px, disc, limb } = painter(x);
    for (const sx of [HX + 15, HX + 30]) for (let i = 0; i < 26; i++) { // the khadag: pale-blue silk hanging from her neck, with a fringe
      const wob = Math.sin(t * 2 + i * 0.3 + sx) * 0.6 * (i / 26), X = Math.round(sx + wob), Y = HY + 41 + i;
      px(X - 1, Y, OUT); px(X, Y, '#ffffff'); px(X + 1, Y, '#bfe6fb'); px(X + 2, Y, i % 6 === 3 ? '#7fb8e6' : '#93d4f6'); px(X + 3, Y, OUT);
      if (i === 25) { px(X, Y + 1, '#bfe6fb'); px(X + 2, Y + 1, '#93d4f6'); px(X + 1, Y + 2, '#bfe6fb'); }
    }
    const A = arms(pose, t).right;
    limb(HX + 44, HY + 50, A.el[0], A.el[1], 3.8, GP.deel[1]); limb(A.el[0], A.el[1], A.hand[0], A.hand[1], 3.4, GP.deel[2]);
    const dx = A.hand[0] - A.el[0], dy = A.hand[1] - A.el[1], n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
    disc(A.hand[0] - ux * 3, A.hand[1] - uy * 3, 3.6, GP.gold[1]);                                        // the cuff
    disc(A.hand[0], A.hand[1], 3.2, OUT); disc(A.hand[0], A.hand[1], 2.4, GP.skin[3]);
    if (A.finger) { for (let i = 1; i <= 6; i++) disc(A.hand[0] + ux * (2 + i), A.hand[1] + uy * (2 + i), 1.8, OUT); for (let i = 1; i <= 6; i++) disc(A.hand[0] + ux * (2 + i), A.hand[1] + uy * (2 + i), 0.8, GP.skin[4]); }
    else for (let f = -2; f <= 2; f++) { const c = Math.cos(f * 0.28), sn = Math.sin(f * 0.28), fx = ux * c - uy * sn, fy = ux * sn + uy * c; for (let i = 1; i <= 4; i++) px(A.hand[0] + fx * (2 + i), A.hand[1] + fy * (2 + i), i === 4 ? OUT : GP.skin[4]); }
  }
  /** Bolormaa, animating. Returns { el, set(pose), talk(on), stop() }. pose: 'wait' | 'bye' | 'yay'. */
  function nominCanvas(pose = 'wait', scale = 2) {
    const mk = (w, hh) => { const c = h('canvas', { width: w, height: hh }); c.getContext('2d').imageSmoothingEnabled = false; return c; };
    const back = mk(W, H), head = mk(48, HEAD_H), front = mk(W, H);
    Object.assign(head.style, { left: HX * scale + 'px', top: HY * scale + 'px', width: 48 * scale + 'px', height: HEAD_H * scale + 'px', transformOrigin: `${24 * scale}px ${37 * scale}px` });
    for (const c of [back, front]) Object.assign(c.style, { left: 0, top: 0, width: W * scale + 'px', height: H * scale + 'px' });
    const el = h('div', { class: 'nomin-full', style: { width: W * scale + 'px', height: H * scale + 'px' } }, back, head, front);
    const st = { pose, talking: false, raf: 0, t0: performance.now(), face: '', blinkAt: 2.5 };
    const loop = () => {
      if (!el.isConnected && performance.now() - st.t0 > 500) return;
      const t = (performance.now() - st.t0) / 1000;
      drawBack(back.getContext('2d'), t, st.pose); drawFront(front.getContext('2d'), t, st.pose);
      // a friendly face: smiling, a wink now and then, natural blinks, her mouth moving while she talks
      if (t > st.blinkAt + 0.14) st.blinkAt = t + 2.6 + Math.random() * 2.4;
      const blink = t > st.blinkAt, open = st.talking && Math.sin(t * 15) > -0.2;
      const expr = st.pose === 'yay' ? 'laugh' : st.pose === 'bye' ? 'happy' : (t % 7 > 5.6 && !st.talking ? 'wink' : 'happy');
      const key = expr + open + blink;
      if (key !== st.face) { st.face = key; const hx = head.getContext('2d'); hx.clearRect(0, 0, 48, HEAD_H); hx.drawImage(TG.guideFace(expr, open, blink), 0, 0, 48, HEAD_H, 0, 0, 48, HEAD_H); }
      // smooth motion between pixels: breathing, a head that tilts and nods while she talks, a happy hop
      const breathe = Math.sin(t * 2.1) * 0.7, hop = st.pose === 'yay' ? -Math.abs(Math.sin(t * 4.6)) * 7 : 0;
      const tilt = st.pose === 'yay' ? Math.sin(t * 4.6) * 5 : st.pose === 'bye' ? Math.sin(t * 2.4) * 4 : Math.sin(t * 1.5) * 4 + (st.talking ? Math.sin(t * 6) * 1.2 : 0);
      const nod = st.talking ? Math.max(0, Math.sin(t * 6)) * 0.6 : 0;
      el.style.transform = `translateY(${((breathe + hop) * scale).toFixed(2)}px)`;
      head.style.transform = `translateY(${(nod * scale - breathe * 0.3 * scale).toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
      st.raf = requestAnimationFrame(loop);
    };
    loop();
    return { el, set: (p) => { st.pose = p; }, talk: (on) => { st.talking = on; }, stop: () => cancelAnimationFrame(st.raf) };
  }
  /** One still frame into a canvas (used by tests and the contact sheet). */
  function drawNomin(x, t, pose) { const b = document.createElement('canvas'); b.width = W; b.height = H; const f = document.createElement('canvas'); f.width = W; f.height = H; drawBack(b.getContext('2d'), t, pose); drawFront(f.getContext('2d'), t, pose); x.clearRect(0, 0, W, H); x.drawImage(b, 0, 0); x.drawImage(TG.guideFace(pose === 'yay' ? 'laugh' : 'happy', false, false), 0, 0, 48, HEAD_H, HX, HY, 48, HEAD_H); x.drawImage(f, 0, 0); }

  // ------------------------------------------------------------ the road barrier she stands in front of
  function barrier(c, up) {
    c = c || h('canvas', { class: 'nw-gate', width: 96, height: 44 }); const x = c.getContext('2d'); x.clearRect(0, 0, 96, 44);
    const R = (X, Y, w, hh, col) => { x.fillStyle = col; x.fillRect(X, Y, w, hh); };
    R(4, 14, 6, 30, OUT); R(5, 15, 4, 29, '#8a5a33'); R(86, 14, 6, 30, OUT); R(87, 15, 4, 29, '#8a5a33');   // posts
    if (!up) {
      R(2, 18, 92, 8, OUT); for (let i = 0; i < 11; i++) R(3 + i * 8.3 | 0, 19, 8, 6, i % 2 ? '#ffffff' : '#e14b3d'); // the striped bar, down
      R(36, 0, 24, 18, OUT); R(37, 1, 22, 16, '#f6dca8'); R(38, 2, 20, 1, '#ffffff');                                  // the sign with a lock
      const lock = TG.icons && TG.icons.canvas('lock'); if (lock) x.drawImage(lock, 40, 1);
    } else { R(83, 0, 8, 18, OUT); for (let i = 0; i < 3; i++) R(84, 1 + i * 6, 6, 5, i % 2 ? '#ffffff' : '#e14b3d'); } // lifted: the way is open
    return c;
  }

  // ------------------------------------------------------------ who has the pass, and which provinces it covers
  const pass = (p) => p && p.aimagPass;
  const route = () => (TG.passport ? TG.passport.ORDER : []);
  /** A province beyond the first four, not stamped before, and no pass yet. */
  function locked(p, id) {
    if (!p || pass(p)) return false;
    const i = route().indexOf(id); if (i < FREE) return false;
    return !(p.passport && p.passport.stamps && p.passport.stamps[id]);
  }
  /** Payment goes through here. A real payment provider (QPay, card) plugs in as TG.payments.charge; without one the
      purchase is recorded on this device only, after a grown-up has passed the parental gate. */
  async function charge() {
    if (TG.payments && TG.payments.charge) return TG.payments.charge({ sku: 'aimag-pass', amount: PRICE, currency: 'MNT' });
    return { ok: true, local: true };
  }
  const fmt = (n) => n.toLocaleString('en-US') + '₮';

  /** The paywall: Bolormaa says no-no in front of the barrier, with the pass and its price. */
  function show(id, after) {
    const a = TG.aimags && TG.aimags.byId(id), p = S.active();
    const nm = nominCanvas('wait', 2), say = h('div', { class: 'nw-say', 'aria-live': 'polite' });
    const talk = (text) => { nm.talk(true); say.textContent = ''; const done = TG.voice ? TG.voice.type(say, TG.tx(text), 'guide') : (say.textContent = TG.tx(text), { done: Promise.resolve() }); Promise.resolve(done && done.done).then(() => nm.talk(false)); };
    const land = TG.passport && TG.passport.landCanvas ? TG.passport.landCanvas(id, 'nw-land', 160, 80) : h('div', { class: 'nw-land' });
    const gate = barrier(), stage = h('div', { class: 'nw-stage' }, land, gate, h('div', { class: 'nw-girl' }, nm.el), say);
    const stamps = p && p.passport ? Object.keys(p.passport.stamps || {}).length : 0, left = route().length - FREE;
    const buy = h('button', { class: 'btn primary big block nw-buy' }, L(`Том хүнээс зөвшөөрөл авах · ${fmt(PRICE)}`, `Ask a grown-up · ${fmt(PRICE)}`));
    const later = h('button', { class: 'btn ghost block' }, L('Дараа', 'Maybe later'));
    const card = h('div', { class: 'nw-card' },
      h('div', { class: 'nw-ticket' }, h('div', null, h('small', null, L('Аймгийн аяллын эрх', 'Aimag Travel Pass')), h('b', null, fmt(PRICE)), h('small', null, L('нэг удаа төлнө', 'one-time'))), h('span', { class: 'nw-stamp' }, '🛂')),
      h('ul', { class: 'nw-perks' },
        h('li', null, '🗺️ ', L(`Үлдсэн ${left} аймаг бүгд нээгдэнэ`, `Opens all ${left} remaining provinces`)),
        h('li', null, '👁 ', L('Аймаг бүрээр 3D-ээр аялна', 'Travel every province in 3D')),
        h('li', null, '🛂 ', L('Тамга бүрээр зоос, оноо', 'Coins and XP for every stamp')),
        h('li', null, '💛 ', L('Нэг худалдан авалт = хөдөөгийн нэг хүүхдэд үнэгүй эрх', 'Each pass = a free pass for one rural child'))),
      buy, later);
    const close = TG.modal(h('div', { class: 'nomin-wall' }, h('h2', null, a ? L(`${tx(a.name)} руу явах уу?`, `Off to ${tx(a.name)}?`) : L('Цааш аялах уу?', 'Travel further?')), stage, card),
      { cls: 'nw-modal', onClose: () => nm.stop() });
    TG.sfx.pop && TG.sfx.pop();
    talk(T(`Хөөе, ${p.name}! Чи аль хэдийн ${stamps} аймгаар аялчихлаа, ямар гоё вэ! Цааш хамт аялахын тулд Аймгийн аяллын эрх хэрэгтэй юм. Ээж, аавдаа үзүүлээд асуучих уу?`, `Hey ${p.name}! You’ve already explored ${stamps} provinces, how wonderful! To keep travelling together we need the Aimag Travel Pass. Shall we show a grown-up?`));
    later.addEventListener('click', () => { nm.set('bye'); talk(T('Зүгээр ээ! Бэлэн болохоор хамт аялцгаая. Тэр хооронд Нутагтаа тоглоод байя.', 'That’s okay! We’ll travel together whenever you’re ready. Let’s play in Nutag for now.')); later.disabled = true; buy.disabled = true; setTimeout(close, 1500); });
    buy.addEventListener('click', () => TG.parentGate(() => confirm()));
    function confirm() {
      const pay = h('button', { class: 'btn primary big block' }, L(`${fmt(PRICE)} төлөх`, `Pay ${fmt(PRICE)}`));
      const no = h('button', { class: 'btn ghost block' }, L('Болих', 'Cancel'));
      const closeC = TG.modal(h('div', { class: 'nw-confirm' }, h('h2', null, L('Аймгийн аяллын эрх', 'Aimag Travel Pass')),
        h('p', null, L(`${p.name}-д бүх аймгаар аялах эрх нээгдэнэ. Нэг удаагийн төлбөр: ${fmt(PRICE)}.`, `Unlocks every province for ${p.name}. One-time payment: ${fmt(PRICE)}.`)), pay, no), { cls: 'v-modal' });
      no.addEventListener('click', () => closeC());
      pay.addEventListener('click', async () => {
        pay.disabled = true;
        let r; try { r = await charge(); } catch (e) { r = { ok: false }; }
        closeC();
        if (!r || !r.ok) { TG.toast(L('Төлбөр амжилтгүй боллоо. Дахин оролдоорой.', 'The payment did not go through. Please try again.')); return; }
        p.aimagPass = { at: Date.now(), amount: PRICE, currency: 'MNT', ref: r.ref || null, local: !!r.local }; S.save();
        S.logActivity && S.logActivity({ kind: 'pass', id: 'aimag' });
        celebrate();
      });
    }
    function celebrate() {
      nm.set('yay'); barrier(gate, true); TG.confetti(80); TG.sfx.win && TG.sfx.win();
      talk(T('Ура, баярлалаа! Одоо бүх Монголоор хамт аялна. Явцгаая!', 'Hooray, thank you! Now we can travel all of Mongolia together. Let’s go!'));
      card.replaceChildren(h('button', { class: 'btn primary big block', onclick: () => { close(); if (after) after(); else TG.go('aimag', { id }); } }, '🚌 ', a ? L(`${tx(a.name)} руу аялах`, `Travel to ${tx(a.name)}`) : L('Аялах', 'Travel')));
    }
  }
  /** Run go() if the province is open, otherwise show the paywall (and run go() after a purchase). */
  function guard(id, go) { const p = S.active(); if (locked(p, id)) { show(id, go); return false; } go(); return true; }

  TG.nomin = { drawNomin, nominCanvas, W, H };
  TG.aimagPass = { FREE, PRICE, locked, show, guard, has: (p) => !!pass(p || S.active()), price: () => fmt(PRICE) };
})(window.TG);
