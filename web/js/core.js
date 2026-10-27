/* Naadamy — core helpers shared by every screen and game */
window.TG = { games: {}, gameOrder: [] };

(function (TG) {
  // ---------- language ----------
  TG.lang = () => (TG.store && TG.store.state.lang) || 'mn';
  TG.L = (mn, en) => (TG.lang() === 'en' && en != null ? en : mn);
  TG.tx = (o) => (o == null ? '' : typeof o === 'string' ? o : (TG.lang() === 'en' && o.en != null ? o.en : o.mn));

  TG.registerGame = (g) => { TG.games[g.id] = g; TG.gameOrder.push(g.id); };

  // ---------- DOM builder ----------
  const PROPS = ['value', 'checked', 'selected'];
  TG.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const s in v) s.startsWith('--') ? el.style.setProperty(s, v[s]) : (el.style[s] = v[s]);
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') el.innerHTML = v;
        else if (PROPS.includes(k)) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  const h = TG.h;
  // Optional pieces of UI are often written as `cond ? el : null`. The browser's replaceChildren would
  // print those as the text "null", so skip empty values everywhere (arrays are flattened too).
  if (typeof Element !== 'undefined' && !Element.prototype.__safeReplace) {
    const native = Element.prototype.replaceChildren;
    Element.prototype.replaceChildren = function (...kids) { return native.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
    Element.prototype.__safeReplace = true;
  }


  // ---------- line icons (Lucide-style) for app chrome ----------
  const ICONS = {
    gamepad: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/>',
    sparkles: '<path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z"/><path d="M19 15v4M17 17h4M5 3v3M3.5 4.5h3"/>',
    heart: '<path d="M19.5 13.5 12 21l-7.5-7.5A5 5 0 1 1 12 6.9a5 5 0 1 1 7.5 6.6z"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5a14 14 0 0 1 0 19M12 2.5a14 14 0 0 0 0 19"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  };
  TG.icon = (name, cls = '') => h('span', { class: 'ic ' + cls, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>` });

  // ---------- small utils ----------
  TG.shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  TG.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  TG.rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  /** Mongolian date formatting done by hand: browsers often lack Mongolian locale data. */
  const MN_DAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  TG.fmtDate = (d, withDay = false) => {
    d = new Date(d);
    if (TG.lang() === 'en') return d.toLocaleDateString('en-US', withDay ? { weekday: 'long', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
    const base = `${d.getMonth() + 1}-р сарын ${d.getDate()}`;
    return withDay ? `${MN_DAYS[d.getDay()]} гараг, ${base}` : `${d.getFullYear()} оны ${base}`;
  };
  TG.money = (n) => n.toLocaleString('en-US') + '₮';
  TG.PCOLORS = ['#2F6BFF', '#F04438', '#12B76A', '#F79009'];

  /** Cancellable sleep for games: returns a waiter bound to an "alive" flag. */
  TG.lifecycle = function () {
    let alive = true; const timers = new Set();
    return {
      get alive() { return alive; },
      wait(ms) { return new Promise((res) => { const t = setTimeout(() => { timers.delete(t); res(alive); }, ms); timers.add(t); }); },
      later(fn, ms) { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; },
      every(fn, ms) { const t = setInterval(() => alive && fn(), ms); timers.add(t); return t; },
      stop() { alive = false; timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); },
    };
  };

  // ---------- sound (tiny synth, no audio files = tiny download) ----------
  let actx = null;
  function tone(f, d, type = 'sine', when = 0, vol = 0.18) {
    if (!TG.store || !TG.store.state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + when;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + d + 0.05);
    } catch (e) { /* audio not available */ }
  }
  let noiseBuf = null;
  function ctxOk() {
    if (!TG.store || !TG.store.state.settings.sound) return false;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return true; } catch (e) { return false; }
  }
  function sweep(f1, f2, d, type = 'sine', vol = 0.18, when = 0) {
    if (!ctxOk()) return;
    const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, freq, vol = 0.1, type = 'bandpass', when = 0) {
    if (!ctxOk()) return;
    if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const t = actx.currentTime + when, src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(actx.destination); src.start(t); src.stop(t + d + 0.02);
  }
  /** The shared AudioContext, or null when sound is off or unavailable (character voices use it too). */
  TG.audio = () => (ctxOk() ? actx : null);
  TG.buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no haptics */ } };
  TG.sfx = {
    tap: () => tone(520, 0.06, 'triangle', 0, 0.08),
    good: () => { tone(660, 0.14); tone(990, 0.22, 'sine', 0.11); },
    bad: () => tone(196, 0.28, 'triangle', 0, 0.12),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'sine', i * 0.11)),
    roll: () => { for (let i = 0; i < 7; i++) tone(260 + Math.random() * 340, 0.04, 'square', i * 0.07, 0.05); },
    tick: () => tone(880, 0.05, 'sine', 0, 0.06),
    pop: () => { sweep(1500, 240, 0.09, 'sine', 0.25); noise(0.04, 3200, 0.12); },
    snap: () => { sweep(480, 980, 0.05, 'triangle', 0.16); noise(0.03, 5000, 0.08, 'highpass'); },
    scrub: () => noise(0.07, 1600 + Math.random() * 1400, 0.05),
    pour: (lv) => { sweep(260 + lv * 600, 320 + lv * 660, 0.06, 'sine', 0.07); noise(0.05, 800 + lv * 900, 0.03); },
    whoosh: () => noise(0.18, 900, 0.06, 'lowpass'),
    chime: () => { tone(784, 0.3, 'sine', 0, 0.12); tone(1175, 0.4, 'sine', 0.15, 0.1); },
  };

  // ---------- speech (uses a Mongolian voice only if the device has one) ----------
  TG.voiceFor = (lang) => {
    if (!('speechSynthesis' in window)) return null;
    return speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(lang)) || null;
  };
  TG.speak = (text, lang = 'mn') => {
    const v = TG.voiceFor(lang); if (!v) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.85;
    speechSynthesis.speak(u); return true;
  };
  TG.speakBtn = (text) => (TG.voiceFor('mn') ? h('button', { class: 'speak-btn', 'aria-label': 'listen', onclick: () => TG.speak(text) }, '🔊') : null);
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

  // ---------- modal / toast / confetti ----------
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const modalStack = [];
  TG.modal = function (content, opts = {}) {
    const root = document.getElementById('modal-root');
    let closed = false;
    const prevFocus = document.activeElement;
    const close = () => {
      if (closed) return; closed = true;
      back.classList.remove('show');
      document.removeEventListener('keydown', onKey, true);
      const i = modalStack.indexOf(back); if (i >= 0) modalStack.splice(i, 1);
      setTimeout(() => back.remove(), 180);
      opts.onClose && opts.onClose();
      // send focus back to whatever opened the dialog, if it is still on the page
      if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    // keyboard support: Escape closes, Tab stays inside the dialog
    const onKey = (e) => {
      if (modalStack[modalStack.length - 1] !== back) return; // only the topmost dialog reacts
      if (e.key === 'Escape') {
        if (opts.noClose) return;
        e.preventDefault(); close(); return;
      }
      if (e.key !== 'Tab') return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
      if (!items.length) { e.preventDefault(); box.focus({ preventScroll: true }); return; }
      const first = items[0], last = items[items.length - 1];
      const inside = box.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    };
    const box = h('div', { class: 'modal ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
      opts.noClose ? null : h('button', { class: 'modal-x', 'aria-label': TG.L('Хаах', 'Close'), onclick: close }, TG.icon('x')),
      content);
    const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back && !opts.noClose) close(); } }, box);
    root.appendChild(back);
    modalStack.push(back);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => { back.classList.add('show'); box.focus({ preventScroll: true }); });
    return close;
  };
  TG.toast = (msg) => {
    const t = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, msg);
    document.getElementById('toast-root').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  };
  TG.confetti = function (n = 70) {
    if (TG.store.state.settings.reduceMotion) return;
    const colors = ['#2F6BFF', '#F04438', '#FDB022', '#12B76A', '#7A5AF8', '#F670C7'];
    const wrap = h('div', { class: 'confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < n; i++) {
      wrap.appendChild(h('i', { style: { left: Math.random() * 100 + '%', background: TG.pick(colors), animationDelay: Math.random() * 0.7 + 's', animationDuration: 2.2 + Math.random() * 1.6 + 's', width: 6 + Math.random() * 8 + 'px' } }));
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 4500);
  };

  // ---------- game helpers ----------
  TG.progress = (i, n) => h('div', { class: 'progress', 'aria-label': `${i + 1}/${n}` },
    Array.from({ length: n }, (_, k) => h('span', { class: k < i ? 'done' : k === i ? 'now' : '' })));

  TG.scoreboard = (players, scores, cur) => h('div', { class: 'scoreboard' },
    players.map((p, i) => h('div', { class: 'sb-p' + (i === cur ? ' cur' : ''), style: { '--pc': p.color } },
      h('span', { class: 'sb-e' }, p.emoji), h('span', { class: 'sb-n' }, p.name), h('b', { class: 'sb-s' }, scores[i]))));

  TG.turnFlash = (p) => {
    if (!p) return;
    const el = h('div', { class: 'turn-flash', style: { '--pc': p.color }, 'aria-live': 'polite' },
      h('div', null, h('div', { class: 'tf-e' }, p.emoji), h('div', { class: 'tf-t' }, TG.L('Ээлж', 'Your turn')), h('div', { class: 'tf-n' }, p.name)));
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  };

  /** Shared turn/score state for pass-and-play games. */
  TG.makeTurns = function (ctx, players = ctx.players) {
    const n = players.length, scores = new Array(n).fill(0); let cur = 0;
    const render = () => ctx.hud.replaceChildren(TG.scoreboard(players, scores, n > 1 ? cur : -1));
    const api = {
      scores, multi: n > 1,
      get cur() { return cur; },
      get player() { return players[cur]; },
      add(k = 1) { scores[cur] += k; render(); },
      next(flash = true) { cur = (cur + 1) % n; render(); if (n > 1 && flash) TG.turnFlash(players[cur]); },
      render,
    };
    render();
    if (n > 1) setTimeout(() => TG.turnFlash(players[0]), 150);
    return api;
  };

  TG.starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  // ---------- parental gate ----------
  TG.parentGate = function (onPass) {
    const a = TG.rand(4, 9), b = TG.rand(4, 9);
    const input = h('input', { class: 'input gate-input', type: 'number', inputmode: 'numeric', placeholder: '?', 'aria-label': 'answer' });
    const err = h('div', { class: 'err' });
    const submit = () => {
      if (+input.value === a * b) { close(); onPass(); }
      else { err.textContent = TG.L('Буруу байна. Дахин оролдоорой.', 'Not quite. Try again.'); input.value = ''; input.focus(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const close = TG.modal(h('div', { class: 'gate' },
      h('div', { class: 'gate-icon' }, '🔒'),
      h('h2', null, TG.L('Том хүний хэсэг', 'Grown-ups only')),
      h('p', null, TG.L('Үргэлжлүүлэхийн тулд бодоорой:', 'Solve this to continue:')),
      h('div', { class: 'gate-q' }, `${a} × ${b} = ?`),
      input, err,
      h('button', { class: 'btn primary block', onclick: submit }, TG.L('Нэвтрэх', 'Enter'))));
    setTimeout(() => input.focus(), 80);
  };
})(window.TG);
