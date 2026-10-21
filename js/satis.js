/* "Цэгцлэе!" — satisfying, tactile mini-puzzles with a level map.
   Six mechanics: pop, sort, scrub, place, pour, match. Every level teaches one thing. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const SVGNS = 'http://www.w3.org/2000/svg';

  // hidden entry so the parent dashboard can show "Цэгцлэе!" in recent activity
  TG.games.satis = { id: 'satis', icon: '✨', pillar: 'edu', ages: [], hidden: true, title: T('Цэгцлэе!', 'Make it perfect') };
  TG.satisTeam = [];

  const prog = (ag) => { S.state.satis = S.state.satis || {}; return (S.state.satis[ag] = S.state.satis[ag] || {}); };
  TG.satisProgress = (ag) => {
    const p = prog(ag), n = TG.SATIS[ag].length;
    return { stars: Object.values(p).reduce((a, b) => a + b, 0), max: n * 3, done: Object.keys(p).length, n };
  };

  // ---------- drag helper ----------
  const hitTest = (list, x, y, pad = 14) => list.find((t) => { const r = t.getBoundingClientRect(); return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad; });
  function draggable(el, onDrop) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (el.dataset.locked) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      el.classList.add('dragging'); TG.sfx.tap();
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.1) rotate(${Math.max(-8, Math.min(8, dx / 12))}deg)`;
      };
      const up = (ev) => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        const ok = ev.type === 'pointerup' && onDrop(ev.clientX, ev.clientY);
        el.style.transform = '';
        if (!ok) { el.classList.add('spring'); setTimeout(() => el.classList.remove('spring'), 350); }
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  const flash = (el, cls, ms = 420) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };

  // ---------- engine: sort ----------
  function sortEngine(lv, A) {
    const items = TG.shuffle(lv.items); let i = 0; const counts = {};
    const bins = lv.bins.map((b) => {
      const cnt = h('b', { class: 'bin-count' }, '0'), pile = h('div', { class: 'bin-pile' });
      return { b, cnt, pile, el: h('div', { class: 'bin', 'data-id': b.id }, h('div', { class: 'bin-e' }, b.e), h('div', { class: 'bin-n' }, L(b.mn, b.en)), pile, cnt) };
    });
    const deck = h('div', { class: 'deck' }), counter = h('div', { class: 'deck-count' });
    const showNext = () => {
      counter.textContent = `${Math.min(i + 1, items.length)} / ${items.length}`;
      if (i >= items.length) { deck.replaceChildren(); return A.done(); }
      const it = items[i];
      const card = h('div', { class: 'sort-card pop' + (lv.card ? ' text' : ''), 'data-bin': it.bin }, it.e ? h('span', { class: 'sc-e' }, it.e) : null, h('span', { class: 'sc-n' }, L(it.mn, it.en)));
      deck.replaceChildren(card);
      draggable(card, (x, y) => {
        const t = hitTest(bins.map((b) => b.el), x, y); if (!t) return false;
        const bin = bins.find((b) => b.el === t);
        if (bin.b.id !== it.bin) { A.mistake(); flash(bin.el, 'nope'); return false; }
        card.dataset.locked = 1; TG.sfx.snap(); TG.buzz();
        flash(bin.el, 'gulp', 500);
        bin.pile.appendChild(h('span', { class: 'mini pop' }, it.e || '✓'));
        counts[bin.b.id] = (counts[bin.b.id] || 0) + 1; bin.cnt.textContent = counts[bin.b.id];
        card.remove(); i++; A.later(showNext, 160);
        return true;
      });
    };
    A.stage.append(counter, deck, h('div', { class: 'bins n' + bins.length }, bins.map((b) => b.el)));
    showNext();
  }

  // ---------- engine: pop ----------
  function popEngine(lv, A) {
    const field = h('div', { class: 'pop-field' });
    A.stage.append(field);
    const items = lv.items.map((it, k) => ({ ...it, k }));
    const targets = lv.mode === 'order' ? items.length : items.filter((x) => x.ok).length;
    let next = 0, popped = 0;
    const W = field.clientWidth || 340, H = items.length > 10 ? 440 : 380;
    const cols = W < 420 ? 3 : 4, rows = Math.ceil(items.length / cols);
    const cw = W / cols, ch = H / rows, size = Math.min(cw, ch, lv.card ? 118 : 96) * 0.88;
    field.style.height = H + 'px';
    const cells = TG.shuffle([...Array(cols * rows).keys()]).slice(0, items.length);
    const colors = ['#9AD0FF', '#B8F0C8', '#FFD8A8', '#E3C8FF', '#FFC2D1', '#FFF0A0'];
    items.forEach((it, idx) => {
      const c = cells[idx], cx = (c % cols) * cw + cw / 2, cy = Math.floor(c / cols) * ch + ch / 2;
      const jx = ((cw - size) / 2) * (Math.random() * 1.2 - 0.6), jy = ((ch - size) / 2) * (Math.random() * 1.2 - 0.6);
      const b = h('button', {
        class: 'bubble' + (lv.card ? ' text' : ''), 'data-k': it.k, 'data-ok': it.ok ? 1 : 0, 'aria-label': tx(it.t) || 'bubble',
        style: { width: size + 'px', height: size + 'px', left: cx - size / 2 + jx + 'px', top: cy - size / 2 + jy + 'px', animationDelay: -Math.random() * 3 + 's', '--bc': it.color || TG.pick(colors) },
      }, h('span', null, tx(it.t)));
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(b, it); });
      field.appendChild(b);
    });
    function tap(b, it) {
      if (b.classList.contains('popped')) return;
      const ok = lv.mode === 'order' ? it.k === next : !!it.ok;
      if (!ok) { A.mistake(); flash(b, 'wobble', 450); return; }
      next++; popped++; b.classList.add('popped'); TG.sfx.pop(); TG.buzz(15); burst(b);
      if (popped >= targets) A.later(() => { field.querySelectorAll('.bubble:not(.popped)').forEach((x) => x.classList.add('fade')); A.later(A.done, 450); }, 250);
    }
    function burst(b) {
      const cx = b.offsetLeft + b.offsetWidth / 2, cy = b.offsetTop + b.offsetHeight / 2, col = b.style.getPropertyValue('--bc');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, d = 40 + Math.random() * 34;
        const s = h('i', { class: 'spark', style: { left: cx + 'px', top: cy + 'px', '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', background: col } });
        field.appendChild(s); setTimeout(() => s.remove(), 650);
      }
    }
  }

  // ---------- engine: scrub ----------
  const THEMES = {
    teeth: { e: '😁', t: T('Цэв цэвэрхэн шүд!', 'Squeaky clean teeth!'), bg: 'linear-gradient(#E8F7FF,#FFFFFF)', dirt: '#D7B55E', germs: ['🦠', '🦠', '🟤'] },
    hands: { e: '🙌', t: T('Цэвэрхэн гар!', 'Clean hands!'), bg: 'linear-gradient(#EAFBF1,#FFFFFF)', dirt: '#9C8B5E', germs: ['🦠', '🦠', '🫧'] },
    smog: { e: '🏙️', t: T('Цэнхэр тэнгэр!', 'Blue sky!'), bg: 'linear-gradient(#6FC0FF,#D7F1FF)', dirt: '#7B7B84', germs: ['💨', '🌫️'] },
    lungs: { e: '🫁', t: T('Эрүүл уушги!', 'Healthy lungs!'), bg: 'linear-gradient(#FFE9EE,#FFFFFF)', dirt: '#4B4B52', germs: ['💨', '🚬'] },
    filter: { e: '🙂', t: T('Жинхэнэ чи!', 'The real you!'), bg: 'linear-gradient(#FFF4E0,#FFFFFF)', dirt: '#F7A8D8', germs: ['✨', '💖', '🌈', '⭐'] },
  };
  function scrubEngine(lv, A) {
    const th = THEMES[lv.theme];
    const canvas = h('canvas', { class: 'scrub-canvas', 'aria-label': 'scrub area' });
    const wrap = h('div', { class: 'scrub-wrap', style: { background: th.bg } },
      h('div', { class: 'scrub-under' }, h('div', { class: 'su-e' }, th.e), h('div', { class: 'su-t' }, tx(th.t))), canvas);
    const bar = h('span'), meter = h('div', { class: 'scrub-meter' }, bar);
    A.stage.append(wrap, meter);
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = wrap.clientWidth, hh = wrap.clientHeight;
    canvas.width = w * dpr; canvas.height = hh * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.fillStyle = th.dirt; ctx.fillRect(0, 0, w, hh);
    for (let i = 0; i < 45; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * hh, 10 + Math.random() * 40, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 18; i++) ctx.fillText(TG.pick(th.germs), 20 + Math.random() * (w - 40), 20 + Math.random() * (hh - 40));
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 48;
    let last = null, moves = 0, done = false, lastSnd = 0;
    const end = () => { last = null; };
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } last = pt(e); dab(last, last); });
    canvas.addEventListener('pointermove', (e) => { if (done) return; if (!last) { if (!e.buttons) return; last = pt(e); } const p = pt(e); dab(last, p); last = p; });
    canvas.addEventListener('pointerleave', end);
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    function dab(a, b) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const now = performance.now(); if (now - lastSnd > 80) { TG.sfx.scrub(); lastSnd = now; }
      if (++moves % 6 === 0) check();
    }
    function check() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let clear = 0, tot = 0;
      for (let i = 3; i < data.length; i += 4 * 23) { tot++; if (data[i] < 20) clear++; }
      const r = clear / tot; bar.style.width = Math.min(100, (r / 0.85) * 100) + '%';
      if (r >= 0.85 && !done) { done = true; canvas.classList.add('gone'); wrap.classList.add('shine'); TG.sfx.chime(); TG.buzz(30); A.later(A.done, 1000); }
    }
  }

  // ---------- engine: pour ----------
  function pourEngine(lv, A) {
    const battery = lv.vessel === 'battery';
    let level = 0, pouring = false, raf = 0, lastT = 0, lastSnd = 0, finished = false;
    const water = h('div', { class: 'water' });
    const glass = h('div', { class: 'glass' + (battery ? ' battery' : '') }, water,
      h('div', { class: 'target-line', style: { bottom: lv.target * 100 + '%' } }, h('span', null, tx(lv.label))));
    const pct = h('div', { class: 'pour-pct' }, '0%');
    const msg = h('div', { class: 'pour-msg', 'aria-live': 'polite' });
    const btn = h('button', { class: 'btn primary big pour-btn' }, battery ? '🔌 ' : '🫗 ', L('Дарж барь', 'Press & hold'));
    const render = () => { water.style.height = level * 100 + '%'; pct.textContent = Math.round(level * 100) + '%'; };
    const start = (e) => { e.preventDefault(); if (finished || pouring) return; pouring = true; msg.textContent = ''; glass.classList.add('pouring'); lastT = performance.now(); raf = requestAnimationFrame(step); };
    const stop = () => { if (!pouring) return; pouring = false; glass.classList.remove('pouring'); cancelAnimationFrame(raf); evaluate(); };
    [btn, glass].forEach((el) => { el.style.touchAction = 'none'; el.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, stop)); });
    function step(t) {
      const dt = (t - lastT) / 1000; lastT = t; level = Math.min(1, level + dt * 0.26); render();
      if (t - lastSnd > 110) { TG.sfx.pour(level); lastSnd = t; }
      if (level >= 1) return stop();
      raf = requestAnimationFrame(step);
    }
    function evaluate() {
      const diff = level - lv.target, ad = Math.abs(diff);
      if (ad <= 0.035) { finished = true; msg.textContent = L('Яг төгс! 🎯', 'Perfect! 🎯'); glass.classList.add('perfect'); TG.sfx.good(); TG.buzz(30); A.later(A.done, 800); }
      else if (ad <= 0.075) { finished = true; A.mistake(true); msg.textContent = L('Маш ойрхон! 👍', 'So close! 👍'); TG.sfx.good(); A.later(A.done, 900); }
      else if (diff > 0) {
        A.mistake(); msg.textContent = battery ? L('Хэт их! Дахин оролдоё 🔋', 'Too much! Try again 🔋') : L('Хэтэрлээ! Дахин оролдоё 💦', 'Too much! Try again 💦');
        A.later(() => { level = 0; render(); msg.textContent = ''; }, 900);
      } else msg.textContent = L('Бага байна, үргэлжлүүл…', 'A bit more…');
    }
    A.stage.append(h('div', { class: 'pour-area' }, glass, pct), msg, btn);
    return () => cancelAnimationFrame(raf);
  }

  // ---------- engine: match (draw lines) ----------
  function matchEngine(lv, A) {
    const wrap = h('div', { class: 'match-wrap' });
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'match-svg');
    const lab = (it) => h('span', { class: 'mi-n' }, lv.fixed ? it.mn : L(it.mn, it.en));
    const mk = (it, i, side) => { const el = h('div', { class: `match-item ${side}` + (lv.card ? ' text' : '') }, side === 'r' ? h('i', { class: 'dot' }) : null, it.e ? h('span', { class: 'mi-e' }, it.e) : null, lab(it), side === 'l' ? h('i', { class: 'dot' }) : null); el.dataset.i = i; return el; };
    const lefts = lv.pairs.map((p, i) => mk(p[0], i, 'l'));
    const rights = TG.shuffle(lv.pairs.map((p, i) => mk(p[1], i, 'r')));
    wrap.append(svg, h('div', { class: 'match-col' }, lefts), h('div', { class: 'match-col' }, rights));
    A.stage.append(wrap, h('p', { class: 'tray-hint' }, L('👉 Зүүнээс баруун тийш зураас тат', '👉 Drag a line from left to right')));
    const fixed = []; let matched = 0, drag = null, selected = null;
    const anchor = (el, side) => { const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect(); return [side === 'l' ? r.right - w.left - 6 : r.left - w.left + 6, r.top + r.height / 2 - w.top]; };
    const mkLine = (cls) => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('class', cls); svg.appendChild(p); return p; };
    const curve = (a, b) => { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; };
    const redraw = () => fixed.forEach((f) => f.line.setAttribute('d', curve(anchor(f.l, 'l'), anchor(f.r, 'r'))));
    window.addEventListener('resize', redraw);
    function tryPair(l, r) {
      lefts.forEach((x) => x.classList.remove('sel'));
      if (l.dataset.i !== r.dataset.i) { A.mistake(); flash(r, 'nope'); return; }
      l.classList.add('done'); r.classList.add('done');
      fixed.push({ l, r, line: mkLine('ml ok') }); redraw(); TG.sfx.snap(); TG.buzz();
      if (++matched === lv.pairs.length) A.later(A.done, 500);
    }
    lefts.forEach((l) => {
      l.style.touchAction = 'none';
      l.addEventListener('pointerdown', (e) => {
        if (l.classList.contains('done')) return;
        e.preventDefault(); try { l.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        drag = { l, line: mkLine('ml live'), sx: e.clientX, sy: e.clientY, moved: false, a: anchor(l, 'l') }; TG.sfx.tap();
      });
      l.addEventListener('pointermove', (e) => {
        if (!drag || drag.l !== l) return;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
        const w = wrap.getBoundingClientRect(); drag.line.setAttribute('d', curve(drag.a, [e.clientX - w.left, e.clientY - w.top]));
      });
      l.addEventListener('pointerup', (e) => {
        if (!drag || drag.l !== l) return;
        const d = drag; drag = null; d.line.remove();
        if (!d.moved) { lefts.forEach((x) => x.classList.remove('sel')); selected = l; l.classList.add('sel'); return; }
        const r = hitTest(rights.filter((x) => !x.classList.contains('done')), e.clientX, e.clientY, 8);
        if (r) tryPair(l, r);
      });
      l.addEventListener('pointercancel', () => { if (drag && drag.l === l) { drag.line.remove(); drag = null; } });
    });
    rights.forEach((r) => r.addEventListener('click', () => { if (selected && !r.classList.contains('done')) { tryPair(selected, r); selected = null; } }));
    return () => window.removeEventListener('resize', redraw);
  }

  // ---------- engine: place (row slots or picture scene) ----------
  function placeEngine(lv, A) {
    if (lv.layout === 'scene') return sceneEngine(lv, A);
    const n = lv.items.length;
    const slots = lv.items.map((_, i) => { const s = h('div', { class: 'slot' }, h('span', { class: 'slot-hint' }, lv.slots ? lv.slots[i] : String(i + 1))); s.dataset.i = i; return s; });
    const tray = h('div', { class: 'tray' });
    const pieces = lv.items.map((it, i) => { const p = h('div', { class: 'piece' }, it.e ? h('span', { class: 'pc-e' }, it.e) : null, h('span', { class: 'pc-n' }, L(it.mn, it.en))); p.dataset.i = i; return p; });
    TG.shuffle(pieces).forEach((p) => tray.appendChild(p));
    let placed = 0;
    pieces.forEach((p) => draggable(p, (x, y) => {
      const s = hitTest(slots.filter((q) => !q.classList.contains('filled')), x, y); if (!s) return false;
      if (s.dataset.i !== p.dataset.i) { A.mistake(); flash(s, 'nope'); return false; }
      p.dataset.locked = 1; s.classList.add('filled'); s.appendChild(p); p.classList.add('placed'); TG.sfx.snap(); TG.buzz();
      if (++placed === n) { slots.forEach((q, k) => setTimeout(() => q.classList.add('wave'), k * 90)); A.later(A.done, 400 + n * 90); }
      return true;
    }));
    A.stage.append(h('div', { class: 'slots' + (lv.slots ? ' timeline' : '') }, slots), h('p', { class: 'tray-hint' }, L('👇 Чирж байранд нь тавь', '👇 Drag into place')), tray);
  }

  const GER = {
    khana: '<rect x="40" y="120" width="220" height="75" fill="url(#lat)" stroke="#9A5B25" stroke-width="3"/>',
    uni: Array.from({ length: 13 }, (_, k) => `<line x1="150" y1="62" x2="${40 + (k * 220) / 12}" y2="121" stroke="#D2452F" stroke-width="3"/>`).join(''),
    cover: '<path d="M36 197 V118 Q150 38 264 118 V197 Z" fill="#FBF8EF" stroke="#D9D2BF" stroke-width="2"/><rect x="36" y="128" width="228" height="6" fill="#2F6BFF" opacity=".8"/><path d="M60 100 Q150 52 240 100" stroke="#2F6BFF" stroke-width="3" fill="none" opacity=".6"/>',
    toono: '<circle cx="150" cy="62" r="17" fill="#F2B24A" stroke="#9A5B25" stroke-width="3"/><path d="M150 45 V79 M133 62 H167 M138 50 L162 74 M162 50 L138 74" stroke="#9A5B25" stroke-width="2"/>',
    door: '<rect x="133" y="148" width="34" height="48" rx="3" fill="#F04438" stroke="#A92E25" stroke-width="2"/><rect x="139" y="155" width="22" height="34" fill="none" stroke="#FDB022" stroke-width="2.5"/><circle cx="150" cy="172" r="4" fill="#FDB022"/>',
  };
  const GER_ICON = {
    khana: '<svg viewBox="0 0 40 30"><rect x="2" y="5" width="36" height="20" fill="none" stroke="#9A5B25" stroke-width="2"/><path d="M2 5 L22 25 M12 5 L32 25 M22 5 L38 21 M2 15 L12 25 M18 5 L2 21 M28 5 L8 25 M38 9 L22 25" stroke="#9A5B25" stroke-width="1.6"/></svg>',
    uni: '<svg viewBox="0 0 40 30"><path d="M20 4 L3 26 M20 4 L11 26 M20 4 L20 26 M20 4 L29 26 M20 4 L37 26" stroke="#D2452F" stroke-width="2.4"/></svg>',
    cover: '<svg viewBox="0 0 40 30"><path d="M3 28 V18 Q20 2 37 18 V28 Z" fill="#FBF8EF" stroke="#B9B09A" stroke-width="2"/><rect x="3" y="19" width="34" height="3" fill="#2F6BFF"/></svg>',
    toono: '<svg viewBox="0 0 40 30"><circle cx="20" cy="15" r="11" fill="#F2B24A" stroke="#9A5B25" stroke-width="2"/><path d="M20 4 V26 M9 15 H31 M12 7 L28 23 M28 7 L12 23" stroke="#9A5B25" stroke-width="1.5"/></svg>',
    door: '<svg viewBox="0 0 40 30"><rect x="12" y="2" width="16" height="26" rx="2" fill="#F04438"/><rect x="15" y="5" width="10" height="19" fill="none" stroke="#FDB022" stroke-width="1.6"/></svg>',
  };
  const SCENE_SVG = {
    ger: (on) => '<svg viewBox="0 0 300 220" class="scene-svg"><defs><pattern id="lat" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 0 L14 14 M14 0 L0 14" stroke="#B5763A" stroke-width="2"/></pattern></defs>'
      + '<ellipse cx="150" cy="200" rx="145" ry="16" fill="#BFE3B0"/>'
      + '<path d="M40 196 V120 L150 62 L260 120 V196 Z" fill="none" stroke="#C9B48A" stroke-width="2" stroke-dasharray="6 6"/>'
      + ['khana', 'uni', 'cover', 'toono', 'door'].map((k) => (on.has(k) ? `<g class="part-in">${GER[k]}</g>` : '')).join('') + '</svg>',
    body: () => '<svg viewBox="0 0 200 300" class="scene-svg"><g fill="#FFDCC0" stroke="#E5B08A" stroke-width="3">'
      + '<path d="M64 270 L70 200 H90 L94 270 Z M136 270 L130 200 H110 L106 270 Z"/>'
      + '<path d="M58 84 Q100 70 142 84 L150 150 Q150 205 128 210 H72 Q50 205 50 150 Z"/>'
      + '<path d="M58 88 L30 170 L42 174 L66 112 M142 88 L170 170 L158 174 L134 112"/>'
      + '<rect x="88" y="58" width="24" height="20"/><circle cx="100" cy="38" r="28"/></g>'
      + '<circle cx="91" cy="34" r="2.5" fill="#1F2A44"/><circle cx="109" cy="34" r="2.5" fill="#1F2A44"/><path d="M92 46 Q100 52 108 46" stroke="#1F2A44" stroke-width="2" fill="none"/></svg>',
  };
  function sceneEngine(lv, A) {
    const on = new Set();
    const art = h('div', { class: 'scene-art' });
    const drawArt = () => (art.innerHTML = SCENE_SVG[lv.scene](on));
    const box = h('div', { class: 'scene scene-' + lv.scene }, art);
    const targets = lv.items.map((it) => { const t = h('div', { class: 'target', style: { left: it.x + '%', top: it.y + '%' } }, '?'); t.dataset.id = it.id; box.appendChild(t); return t; });
    const caption = h('div', { class: 'scene-cap' }, L('Хэсэг бүрийг зөв газарт нь чирээрэй', 'Drag each part to the right spot'));
    const tray = h('div', { class: 'tray' });
    let placed = 0;
    TG.shuffle(lv.items).forEach((it) => {
      const icon = lv.scene === 'ger' ? h('span', { class: 'pc-e svg', html: GER_ICON[it.id] }) : h('span', { class: 'pc-e' }, it.e);
      const p = h('div', { class: 'piece', 'data-id': it.id }, icon, h('span', { class: 'pc-n' }, L(it.mn, it.en)));
      tray.appendChild(p);
      draggable(p, (x, y) => {
        const t = hitTest(targets.filter((q) => !q.classList.contains('filled')), x, y, 20); if (!t) return false;
        if (t.dataset.id !== it.id) { A.mistake(); flash(t, 'nope'); return false; }
        t.classList.add('filled'); t.textContent = lv.scene === 'body' ? it.e : '✓';
        p.remove(); on.add(it.id); drawArt(); TG.sfx.snap(); TG.buzz();
        caption.textContent = '💡 ' + tx(it.fact); flash(caption, 'pop', 400);
        if (++placed === lv.items.length) A.later(A.done, 1500);
        return true;
      });
    });
    drawArt();
    A.stage.append(box, caption, tray);
  }

  const ENGINES = { sort: sortEngine, pop: popEngine, scrub: scrubEngine, place: placeEngine, pour: pourEngine, match: matchEngine };

  // ---------- team (play together, take turns per level) ----------
  function team() {
    const p = S.active(); if (!p || !TG.satisTeam.length) return [];
    const fam = TG.satisTeam.map((id) => S.state.family.find((f) => f.id === id)).filter(Boolean);
    return [{ name: p.name, emoji: p.avatar, color: TG.PCOLORS[0] }, ...fam.map((f, i) => ({ name: tx(f.name), emoji: f.emoji, color: TG.PCOLORS[i + 1] }))];
  }

  // ---------- map screen ----------
  TG.satisMap = ({ shell, ageTabs, ag, setAge, rerender }) => {
    const TYPES = TG.SATIS_TYPES, levels = TG.SATIS[ag], p = prog(ag), pr = TG.satisProgress(ag);
    const unlocked = (i) => i === 0 || (p[i - 1] || 0) > 0;
    let current = levels.findIndex((_, i) => unlocked(i) && !p[i]);
    const ROW = 108, POS = [50, 76, 50, 24];
    const pts = levels.map((_, i) => [POS[i % 4], i * ROW + ROW / 2]);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' ');
    const svg = `<svg class="map-path" viewBox="0 0 100 ${levels.length * ROW}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#EADBBE" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
    const me = S.active();
    const nodes = levels.map((lv, i) => {
      const ty = TYPES[lv.type], open = unlocked(i), stars = p[i] || 0;
      return h('div', { class: 'node-wrap', style: { left: POS[i % 4] + '%', top: i * ROW + ROW / 2 + 'px' } },
        i === current ? h('div', { class: 'me-pin' }, me ? me.avatar : '🙂') : null,
        h('button', {
          class: 'node' + (open ? '' : ' locked') + (i === current ? ' current' : '') + (stars ? ' cleared' : ''), style: { '--nc': ty.color },
          'aria-label': `${L('Түвшин', 'Level')} ${i + 1}`,
          onclick: () => (open ? TG.go('satisLevel', { ag, i }) : TG.toast(L('Өмнөх түвшнээ дуусгаарай 🔒', 'Finish the previous level first 🔒'))),
        }, h('span', { class: 'node-icon' }, open ? ty.icon : TG.icon('lock')), h('b', { class: 'node-n' }, i + 1)),
        h('div', { class: 'node-stars' }, [1, 2, 3].map((k) => h('span', { class: k <= stars ? 'on' : '' }, '★'))),
        h('div', { class: 'node-title' }, tx(lv.title)));
    });
    const fam = S.state.family;
    const teamRow = h('div', { class: 'team-row' },
      h('span', { class: 'label' }, '👨‍👩‍👧 ', L('Хамт тоглох:', 'Play with:')),
      fam.map((f) => {
        const onSel = TG.satisTeam.includes(f.id);
        return h('button', { class: 'fam-chip sm' + (onSel ? ' active' : ''), onclick: () => {
          if (onSel) TG.satisTeam = TG.satisTeam.filter((x) => x !== f.id); else { if (TG.satisTeam.length >= 3) TG.satisTeam.shift(); TG.satisTeam.push(f.id); }
          rerender();
        } }, f.emoji, ' ', tx(f.name));
      }));
    const el = shell([
      h('section', { class: 'satis-hero' },
        h('div', { class: 'eyebrow' }, L('Сэтгэл ханамжтай оньсого', 'Satisfying puzzles')),
        h('h1', { class: 'page-title' }, L('Цэгцлэе!', 'Make it perfect!')),
        h('p', null, L('Хагал, ангил, арч, байрлуул, дүүргэ, холбо! Түвшин бүр жижиг тайван тоглоом бөгөөд шинэ зүйл заана.', 'Pop, sort, scrub, place, pour and connect! Every level is a small calming puzzle that teaches something new.')),
        h('div', { class: 'satis-prog' }, h('div', { class: 'meter' }, h('span', { style: { width: (pr.stars / pr.max) * 100 + '%' } })), h('b', null, `⭐ ${pr.stars}/${pr.max}`))),
      ageTabs(ag, setAge),
      teamRow,
      TG.satisTeam.length ? h('p', { class: 'hint' }, '🔁 ', L('Түвшин бүрт ээлжээр тоглоно. Од гэр бүлийн тэнгэрт нэмэгдэнэ!', 'Take turns each level. Stars go to your family sky!')) : null,
      h('div', { class: 'map', style: { height: levels.length * ROW + 40 + 'px' } }, h('div', { html: svg }), nodes),
      pr.done === pr.n ? h('div', { class: 'map-done' }, '🏆 ', L('Энэ насны бүх түвшинг дуусгалаа! Дараагийн насны ангиллыг туршаад үзээрэй.', 'All levels done for this age! Try the next age group.')) : null,
    ]);
    if (current > 1) setTimeout(() => { const n = el.querySelector('.node.current'); n && n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
    return el;
  };

  // ---------- level screen ----------
  TG.satisLevel = ({ ag, i, setCleanup }) => {
    const lv = TG.SATIS[ag][i], ty = TG.SATIS_TYPES[lv.type];
    const life = TG.lifecycle(), t0 = Date.now(), players = team();
    const player = players.length > 1 ? players[i % players.length] : null;
    let mistakes = 0, finished = false;
    const stage = h('div', { class: 'satis-stage' });
    const el = h('div', { class: 'play-screen satis-screen', style: { '--tc': ty.color } },
      h('div', { class: 'play-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'back', onclick: () => TG.go('satis') }, TG.icon('arrowLeft')),
        h('div', { class: 'play-title' }, `${ty.icon} ${i + 1}. ${tx(lv.title)}`),
        player ? h('div', { class: 'hud-pill turn', style: { '--pc': player.color } }, player.emoji, ' ', player.name) : null),
      h('p', { class: 'prompt satis-prompt' }, tx(lv.prompt)),
      stage);
    const A = {
      stage, later: life.later,
      mistake(soft) { mistakes++; if (!soft) { TG.sfx.bad(); TG.buzz(40); } },
      done() { if (finished) return; finished = true; complete(); },
    };
    function complete() {
      const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1, pg = prog(ag);
      pg[i] = Math.max(pg[i] || 0, stars);
      const reward = S.record({ gameId: 'satis', pillar: lv.pillar, stars, together: players.length > 1, seconds: (Date.now() - t0) / 1000 });
      TG.sfx.win(); TG.confetti(60);
      const hasNext = i + 1 < TG.SATIS[ag].length;
      el.appendChild(h('div', { class: 'complete-back' }, h('div', { class: 'complete' },
        h('div', { class: 'cmp-title' }, stars === 3 ? L('Төгс! ✨', 'Perfect! ✨') : stars === 2 ? L('Гайхалтай!', 'Great!') : L('Болчихлоо!', 'Done!')),
        h('div', { class: 'res-stars' }, [1, 2, 3].map((k) => h('span', { class: k <= stars ? 'on' : '', style: { animationDelay: k * 0.15 + 's' } }, '★'))),
        h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(lv.teach))),
        players.length > 1 ? h('p', { class: 'muted' }, L(`Гэр бүлийн тэнгэрт +${stars} од ✨`, `+${stars} stars in your family sky ✨`)) : null,
        reward && TG.rewardChip ? TG.rewardChip(reward) : null,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn ghost', onclick: () => TG.go('satis') }, '🗺️'),
          h('button', { class: 'btn ghost', onclick: () => TG.go('satisLevel', { ag, i }) }, '↻'),
          hasNext ? h('button', { class: 'btn primary', onclick: () => TG.go('satisLevel', { ag, i: i + 1 }) }, L('Дараах ▶', 'Next ▶'))
            : h('button', { class: 'btn primary', onclick: () => TG.go('satis') }, L('Дууслаа 🏆', 'Finish 🏆'))))));
    }
    setTimeout(() => {
      if (!el.isConnected) return;
      const c = ENGINES[lv.type](lv, A);
      setCleanup(() => { life.stop(); if (typeof c === 'function') c(); });
      if (player) TG.turnFlash(player);
    }, 0);
    return el;
  };
})(window.TG);
