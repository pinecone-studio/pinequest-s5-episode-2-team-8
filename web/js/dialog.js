/* Naadamy — character voices and the story dialogue box.
   Every character "talks" in little synthesized blips while their words type out, like an old pixel RPG.
   Each one has their own voice: Grandma is warm and wobbly, the General is gruff, Basar the dog barks his words.
   TG.voice   blips, babble (sound only), type (typewriter into any element), wrestling grunts
   TG.dialog  the box at the bottom middle of the screen: portrait on the left, name, typed text, answer choices
   TG.guideFace  the tutorial guide's detailed pixel portrait with changing facial expressions */
(function (TG) {
  const { h } = TG;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- voices
  // wave + f: tone and base pitch · vary: random pitch spread · dur: blip length (s) · every: one blip per N letters
  // speed: ms per letter · pause: how much longer to wait at . ! ? · slide: pitch glide inside a blip (dog bark)
  // lp: low-pass filter (muffled, gruff) · vib: wobble (Hz) · echo: a second, quieter blip (announcer in a stadium)
  const VOICES = {
    guide: { wave: 'square', f: 560, vary: 0.18, dur: 0.045, every: 2, speed: 30, pause: 7, vol: 0.045, lp: 3400, bounce: true },
    basar: { wave: 'square', f: 310, vary: 0.22, dur: 0.06, every: 3, speed: 28, pause: 6, vol: 0.055, slide: 0.55, lp: 1500 },
    emee: { wave: 'triangle', f: 440, vary: 0.06, dur: 0.075, every: 2, speed: 46, pause: 9, vol: 0.09, vib: 9 },
    general: { wave: 'sawtooth', f: 135, vary: 0.05, dur: 0.045, every: 2, speed: 24, pause: 6, vol: 0.05, lp: 900 },
    historian: { wave: 'sine', f: 370, vary: 0.1, dur: 0.06, every: 2, speed: 38, pause: 8, vol: 0.1 },
    herder: { wave: 'triangle', f: 225, vary: 0.12, dur: 0.06, every: 2, speed: 34, pause: 7, vol: 0.1 },
    fisher: { wave: 'sine', f: 170, vary: 0.05, dur: 0.085, every: 3, speed: 54, pause: 12, vol: 0.12, vib: 5 },
    farmer: { wave: 'square', f: 680, vary: 0.14, dur: 0.035, every: 2, speed: 25, pause: 6, vol: 0.035, lp: 3600 },
    teacher: { wave: 'triangle', f: 520, vary: 0.05, dur: 0.05, every: 2, speed: 34, pause: 8, vol: 0.09 },
    trainer: { wave: 'sawtooth', f: 250, vary: 0.12, dur: 0.045, every: 2, speed: 27, pause: 6, vol: 0.045, lp: 1400 },
    archer: { wave: 'sine', f: 300, vary: 0.04, dur: 0.07, every: 3, speed: 42, pause: 10, vol: 0.1 },
    zasuul: { wave: 'square', f: 195, vary: 0.08, dur: 0.07, every: 2, speed: 36, pause: 8, vol: 0.045, lp: 1100, echo: 0.09 },
    local: { wave: 'triangle', f: 340, vary: 0.1, dur: 0.05, every: 2, speed: 32, pause: 7, vol: 0.09 },
  };
  const LETTER = /[\p{L}\p{N}]/u, STOP = /[.!?…:;]/, SOFT = /[,—–]/;

  function blip(id, mul = 1) {
    const v = VOICES[id] || VOICES.guide, a = TG.audio && TG.audio(); if (!a) return;
    try {
      const t = a.currentTime + 0.004, f = v.f * mul * (1 + (Math.random() - 0.5) * v.vary);
      const one = (when, vol) => {
        const o = a.createOscillator(), g = a.createGain(); let out = o;
        o.type = v.wave; o.frequency.setValueAtTime(f, when);
        if (v.slide) o.frequency.exponentialRampToValueAtTime(f * v.slide, when + v.dur);
        if (v.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = v.vib; lg.gain.value = f * 0.05; l.connect(lg).connect(o.frequency); l.start(when); l.stop(when + v.dur + 0.03); }
        if (v.lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = v.lp; o.connect(fl); out = fl; }
        g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + v.dur);
        out.connect(g).connect(a.destination); o.start(when); o.stop(when + v.dur + 0.03);
      };
      one(t, v.vol); if (v.echo) one(t + v.echo, v.vol * 0.35);
    } catch (e) { /* audio not available */ }
  }
  /** Sentence melody: the voice rises towards a "?" and lifts on "!", so lines sound like questions and exclamations. */
  function inflect(id, chars, i) {
    const v = VOICES[id] || VOICES.guide;
    let j = i; while (j < chars.length && !/[.!?…]/.test(chars[j])) j++;
    const left = j - i, end = chars[j];
    let m = 1;
    if (end === '?' && left < 8) m = 1 + (8 - left) * 0.035;
    else if (end === '!') m = 1.08;
    if (v.bounce) m *= 1 + Math.sin(i * 1.7) * 0.06; // the guide's playful sing-song
    return m;
  }

  let babbleStop = null;
  /** Talk sounds only, no visible typing (for chat bubbles that appear all at once). */
  function babble(text, id) {
    if (babbleStop) babbleStop();
    const v = VOICES[id] || VOICES.guide, chars = [...String(text || '')].slice(0, 140);
    let i = 0, n = 0, stopped = false, timer = 0;
    const step = () => {
      if (stopped || i >= chars.length) return;
      const ch = chars[i++]; let wait = v.speed;
      if (LETTER.test(ch)) { if (n++ % v.every === 0) blip(id, inflect(id, chars, i)); }
      else if (STOP.test(ch)) wait *= v.pause; else if (SOFT.test(ch)) wait *= v.pause / 2;
      timer = setTimeout(step, wait);
    };
    step();
    return (babbleStop = () => { stopped = true; clearTimeout(timer); });
  }

  /** Typewriter: the words appear letter by letter with the character's voice. The full text is in the element
   *  from the start (the rest is just invisible) so the layout never jumps. Tapping the text shows it all. */
  function type(el, text, id, opts = {}) {
    if (el.__tw) el.__tw.skip();
    const v = VOICES[id] || VOICES.guide, chars = [...String(text == null ? '' : text)];
    const shown = document.createTextNode(''), rest = h('span', { class: 'tw-rest' }, chars.join(''));
    el.replaceChildren(shown, rest);
    let i = 0, n = 0, timer = 0, done = false, resolve;
    const promise = new Promise((r) => (resolve = r));
    const mouth = (o) => opts.onMouth && opts.onMouth(o);
    const finish = () => {
      if (done) return; done = true; clearTimeout(timer);
      shown.data = chars.join(''); rest.remove(); el.__tw = null; el.removeEventListener('click', finish); mouth(false); resolve();
    };
    const step = () => {
      if (done) return;
      if (!el.isConnected && i > 0) return finish();
      if (i >= chars.length) return finish();
      const ch = chars[i++]; shown.data += ch; rest.textContent = chars.slice(i).join('');
      let wait = v.speed;
      if (LETTER.test(ch)) { if (n++ % v.every === 0) { blip(id, inflect(id, chars, i)); mouth(true); } else mouth(false); }
      else if (STOP.test(ch)) { wait *= v.pause; mouth(false); }
      else if (SOFT.test(ch)) { wait *= v.pause / 2; mouth(false); }
      timer = setTimeout(step, wait);
    };
    const ctl = { done: promise, skip: finish, get finished() { return done; } };
    el.__tw = ctl;
    if (opts.tapToSkip !== false) el.addEventListener('click', finish);
    if (TG.store && TG.store.state.settings.reduceMotion) { babble(text, id); finish(); } else timer = setTimeout(step, opts.delay || 0);
    return ctl;
  }

  // ---------------------------------------------------------------- wrestling grunts and body sounds
  let noiseBuf = null;
  function grunt(kind = 'effort', pitch = 1) {
    const a = TG.audio && TG.audio(); if (!a) return;
    try {
      const t = a.currentTime + 0.004;
      const tone = (f1, f2, d, wave, vol, lp, when = 0) => {
        const o = a.createOscillator(), g = a.createGain(), fl = a.createBiquadFilter();
        o.type = wave; o.frequency.setValueAtTime(f1, t + when); o.frequency.exponentialRampToValueAtTime(f2, t + when + d);
        fl.type = 'lowpass'; fl.frequency.value = lp;
        g.gain.setValueAtTime(0.0001, t + when); g.gain.exponentialRampToValueAtTime(vol, t + when + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + when + d);
        o.connect(fl).connect(g).connect(a.destination); o.start(t + when); o.stop(t + when + d + 0.03);
      };
      const air = (d, freq, vol, when = 0, ftype = 'bandpass') => {
        if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.6, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
        const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
        s.buffer = noiseBuf; fl.type = ftype; fl.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t + when); g.gain.exponentialRampToValueAtTime(vol, t + when + Math.min(0.04, d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + when + d);
        s.connect(fl).connect(g).connect(a.destination); s.start(t + when); s.stop(t + when + d + 0.03);
      };
      const p = pitch * (0.94 + Math.random() * 0.12);
      if (kind === 'effort') { tone(150 * p, 104 * p, 0.2, 'sawtooth', 0.06, 620); air(0.16, 900, 0.025); }          // "hnngh!"
      else if (kind === 'strain') { tone(122 * p, 138 * p, 0.34, 'sawtooth', 0.045, 520); air(0.3, 700, 0.018); }      // straining in a hold
      else if (kind === 'oof') { tone(210 * p, 88 * p, 0.17, 'sawtooth', 0.07, 800); tone(92, 44, 0.26, 'sine', 0.22, 300, 0.05); air(0.22, 240, 0.09, 0.05, 'lowpass'); } // fall + thud in the sand
      else if (kind === 'huff') air(0.11, 1300, 0.03);                                                                      // short breath
      else if (kind === 'step') air(0.06, 2600, 0.02, 0, 'highpass');                                                       // feet scuffing the sand
      else if (kind === 'clap') { air(0.05, 1800, 0.06); }                                                                  // hands slap the shoulders
      else if (kind === 'crowd') { air(1.3, 650, 0.045); air(1.1, 1200, 0.025, 0.1); tone(330, 300, 0.9, 'triangle', 0.02, 900, 0.05); } // the crowd's "uukhai"
    } catch (e) { /* audio not available */ }
  }

  TG.voice = { VOICES, blip, babble, type, grunt, has: (id) => !!VOICES[id] };

  // ---------------------------------------------------------------- the guide's portrait (48×48, shaded pixel art)
  const GP = {
    skin: ['#5a3020', '#8a5136', '#ad6c47', '#cb8d63', '#e2ab82', '#f2c8a2'],
    hair: ['#0b0707', '#1a1212', '#2c201d', '#43322c', '#62493f'],
    deel: ['#132a63', '#1d3f92', '#2a5bc0', '#4a7fe0'], gold: ['#8a5e10', '#d29b22', '#f4d06a'], red: '#c8322a',
    white: '#f6f1ea', iris: '#5a3a22', irisL: '#94653a', pupil: '#110907', lash: '#140c0a', brow: '#24170f',
    lip: '#b0504a', lipL: '#d77a6c', lipD: '#7a2c28', mouth: '#4a1414', teeth: '#f4ede2', tongue: '#e46f7a', blush: 'rgba(232,110,98,.5)',
  };
  const LIGHT = (() => { const l = [-0.45, -0.55, 0.7], m = Math.hypot(...l); return l.map((q) => q / m); })();
  const fcache = new Map();
  /** expr: neutral happy laugh wink surprised think proud tease sad · open: mouth open (talking) · blink: eyes shut */
  function guideFace(expr = 'neutral', open = false, blink = false) {
    const key = expr + (open ? 1 : 0) + (blink ? 1 : 0); if (fcache.has(key)) return fcache.get(key);
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const x = c.getContext('2d');
    const P = (px, py, col) => { if (col) { x.fillStyle = col; x.fillRect(px, py, 1, 1); } };
    const shadeOf = (nx, ny, tones, base = 0) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      return tones[clamp(Math.round(base + 1 + (d + 0.15) * 3.4), 1, tones.length - 1)];
    };
    // the face: an oval that narrows to a soft chin
    const FX = 24, FY = 23.5, FRX = 11, FRY = 13.6;
    const inFace = (px, py) => {
      const dy = py + 0.5 - FY, q = dy > 0 ? 1 - 0.36 * Math.pow(dy / FRY, 2.2) : 1;
      const nx = (px + 0.5 - FX) / (FRX * q), ny = dy / FRY; return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
    };
    // hairline: a side part on the left, bangs sweeping to the right, curtains down both cheeks
    const hairFront = (px, py) => {
      const top = ((px + 0.5 - 24) / 13.6) ** 2 + ((py + 0.5 - 18.5) / 13) ** 2 <= 1;
      if (!top) return false;
      const line = px < 19 ? 14 + (19 - px) * 0.55 : 14 + (px - 19) * 0.3 + Math.sin(px * 0.9) * 0.6;
      const side = px < 14.2 + Math.max(0, py - 16) * 0.05 || px > 33.4 - Math.max(0, py - 18) * 0.08;
      return py < line || (side && py < 31);
    };
    // 1) long hair behind the head and shoulders
    for (let py = 5; py < 44; py++) for (let px = 6; px < 42; px++) {
      const inTop = ((px + 0.5 - 24) / 15.2) ** 2 + ((py + 0.5 - 21) / 15) ** 2 <= 1;
      const inLong = py >= 21 && py < 43 - Math.abs(px + 0.5 - 24) * 0.1 && (px >= 8 && px <= 39) && Math.abs(px + 0.5 - 24) > 8.5;
      if (inTop || inLong) P(px, py, px % 3 === 0 && py % 7 !== 0 ? GP.hair[0] : px < 24 ? GP.hair[2] : GP.hair[1]); // long vertical strands
    }
    // 2) neck with the jaw's shadow
    for (let py = 33; py < 42; py++) for (let px = 19; px < 29; px++) P(px, py, py < 36 ? GP.skin[1] : px < 22 ? GP.skin[3] : GP.skin[2]);
    // 3) the deel: blue silk, a gold-trimmed standing collar and the diagonal overlap closing on the right
    for (let py = 39; py < 48; py++) {
      const hw = Math.min(24, 9 + (py - 39) * 2.4);
      for (let px = Math.floor(24 - hw); px < Math.ceil(24 + hw); px++) {
        const edge = px === Math.floor(24 - hw) || px === Math.ceil(24 + hw) - 1;
        P(px, py, edge ? GP.deel[0] : px < 18 ? GP.deel[3] : px < 30 ? GP.deel[2] : GP.deel[1]);
      }
    }
    for (let px = 18; px < 30; px++) { P(px, 39, GP.gold[1]); P(px, 40, px < 22 ? GP.gold[2] : GP.gold[1]); P(px, 41, GP.deel[0]); }
    for (let i = 0; i < 8; i++) { P(24 + i, 41 + i, GP.gold[2]); P(25 + i, 41 + i, GP.gold[1]); P(26 + i, 41 + i, GP.gold[0]); }
    P(31, 44, GP.gold[2]); P(31, 45, GP.gold[0]); // a round gold button
    // 4) the face, shaded like a sphere lit from the upper left, darker along the lower right edge
    for (let py = 8; py < 40; py++) for (let px = 10; px < 38; px++) {
      const n = inFace(px, py); if (!n) continue;
      const edge = !inFace(px - 1, py) || !inFace(px + 1, py) || !inFace(px, py - 1) || !inFace(px, py + 1);
      P(px, py, edge ? (n[0] > -0.2 || n[1] > 0.5 ? GP.skin[0] : GP.skin[2]) : shadeOf(n[0] * 0.9, n[1] * 0.8, GP.skin));
    }
    // 5) cheek warmth and the soft shadow the bangs cast on the forehead
    for (let px = 13; px < 35; px++) for (let py = 12; py < 22; py++) if (inFace(px, py) && !hairFront(px, py) && hairFront(px, py - 1)) P(px, py, GP.skin[2]);
    // 6) front hair with a glossy sheen band and strand lines
    for (let py = 4; py < 32; py++) for (let px = 9; px < 40; px++) {
      if (!hairFront(px, py)) continue;
      const edge = !hairFront(px, py - 1) || !hairFront(px - 1, py) || !hairFront(px + 1, py);
      const sheen = Math.abs(py - (9.5 + Math.abs(px - 21) * 0.18)) < 1 && px > 13 && px < 33;
      const strand = ((px - Math.floor(py * 0.5)) % 4 + 4) % 4 === 0 && py > 6; // strands follow the sweep of the bangs
      P(px, py, edge ? GP.hair[0] : sheen ? (px < 24 ? GP.hair[4] : GP.hair[3]) : strand ? GP.hair[1] : px < 22 ? GP.hair[3] : GP.hair[2]);
    }
    P(30, 10, GP.red); P(31, 10, GP.gold[2]); P(32, 10, GP.red); P(31, 11, GP.gold[1]); P(31, 9, GP.gold[1]); // a coral and gold hairpin
    P(13, 31, GP.gold[2]); P(13, 32, GP.red); P(34, 31, GP.gold[2]); P(34, 32, GP.red);                         // earrings
    // 7) eyebrows
    const browL = [[15, 20], [16, 19], [17, 19], [18, 18], [19, 18], [20, 18], [21, 19]];
    const browDy = { surprised: -2, happy: -1, laugh: -1, tease: -1, sad: 0, think: 0, proud: 0 }[expr] || 0;
    browL.forEach(([bx, by], i) => {
      let dyL = browDy, dyR = browDy;
      if (expr === 'think') { dyL = -2 + (i > 4 ? 1 : 0); dyR = 1; }
      if (expr === 'sad') { dyL = i > 3 ? -1 : 1; dyR = dyL; }
      if (expr === 'proud' || expr === 'tease') dyR = browDy - 1;
      P(bx, by + dyL, GP.brow); P(47 - bx, by + dyR, GP.brow);
      if (i > 0 && i < 5) { P(bx, by + dyL + 1, GP.hair[3]); P(47 - bx, by + dyR + 1, GP.hair[3]); }
    });
    // 8) eyes
    const eye = (ex, ey, state, look = 0) => {
      const s = ex < 24 ? -1 : 1; // which side is the outer corner
      if (state === 'shut') { [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]].forEach(([dx, dy]) => P(ex + dx, ey + dy, GP.lash)); P(ex + s * 3, ey, GP.lash); return; }
      if (state === 'smile') { [[-2, 1], [-1, 0], [0, -1], [1, 0], [2, 1]].forEach(([dx, dy]) => P(ex + dx, ey + dy, GP.lash)); P(ex + s * 3, ey + 1, GP.lash); return; }
      const big = state === 'wide';
      for (let dx = -2; dx <= 2; dx++) { P(ex + dx, ey - (big ? 2 : 1), GP.lash); P(ex + dx, ey, GP.white); P(ex + dx, ey + 1, GP.white); if (big) P(ex + dx, ey - 1, GP.white); }
      P(ex + s * 3, ey - (big ? 3 : 2), GP.lash); P(ex + s * 3, ey - (big ? 2 : 1), GP.lash);           // outer lashes
      const ix = ex + look;
      if (big) { P(ix, ey - 1, GP.iris); P(ix, ey, GP.pupil); P(ix, ey + 1, GP.irisL); P(ix - 1, ey, GP.iris); P(ix + 1, ey, GP.iris); }
      else { P(ix - 1, ey, GP.iris); P(ix, ey, GP.pupil); P(ix + 1, ey, GP.iris); P(ix - 1, ey + 1, GP.iris); P(ix, ey + 1, GP.irisL); P(ix + 1, ey + 1, GP.iris); P(ix - 1, ey, '#ffffff'); }
      for (let dx = -1; dx <= 1; dx++) P(ex + dx, ey + 2, GP.skin[2]);                                    // lower lid crease
    };
    const L0 = 19, R0 = 28, EY = 23;
    if (blink && expr !== 'laugh' && expr !== 'happy') { eye(L0, EY, 'shut'); eye(R0, EY, 'shut'); }
    else if (expr === 'laugh' || expr === 'happy') { eye(L0, EY, 'smile'); eye(R0, EY, 'smile'); }
    else if (expr === 'wink') { eye(L0, EY, 'open'); eye(R0, EY, 'smile'); }
    else if (expr === 'surprised') { eye(L0, EY, 'wide'); eye(R0, EY, 'wide'); }
    else if (expr === 'think') { eye(L0, EY, 'open', 1); eye(R0, EY, 'open', 1); }
    else if (expr === 'sad') { eye(L0, EY, 'open', 0); eye(R0, EY, 'open', 0); P(L0 - 2, EY - 1, GP.skin[3]); P(R0 + 2, EY - 1, GP.skin[3]); }
    else { eye(L0, EY, 'open'); eye(R0, EY, 'open'); }
    // 9) nose: a lit bridge, a shaded side and the soft shadow under the tip
    P(23, 25, GP.skin[5]); P(23, 26, GP.skin[5]); P(24, 26, GP.skin[3]); P(25, 27, GP.skin[2]); P(25, 28, GP.skin[2]);
    P(22, 29, GP.skin[2]); P(23, 29, GP.skin[1]); P(24, 29, GP.skin[1]); P(25, 29, GP.skin[2]); P(23, 28, GP.skin[4]);
    // 10) blush when cheerful
    if (['happy', 'laugh', 'wink', 'tease', 'proud'].includes(expr)) { x.fillStyle = GP.blush; x.fillRect(15, 28, 3, 1); x.fillRect(30, 28, 3, 1); x.fillRect(16, 29, 1, 1); x.fillRect(31, 29, 1, 1); }
    // 11) mouth
    const row = (y, x0, x1, col) => { for (let i = x0; i <= x1; i++) P(i, y, col); };
    const smile = expr === 'happy' || expr === 'wink' || expr === 'tease' || expr === 'laugh';
    if (expr === 'laugh' || (open && smile)) {
      const wide = expr === 'laugh';
      P(wide ? 19 : 20, 31, GP.lipD); P(wide ? 28 : 27, 31, GP.lipD);
      row(31, wide ? 20 : 21, wide ? 27 : 26, GP.teeth);
      row(32, wide ? 20 : 21, wide ? 27 : 26, GP.mouth); P(wide ? 19 : 20, 32, GP.lipD); P(wide ? 28 : 27, 32, GP.lipD);
      if (wide || open) { row(33, 21, 26, GP.mouth); row(33, 23, 24, GP.tongue); }
      row(wide || open ? 34 : 33, 22, 25, GP.lip); P(23, wide || open ? 34 : 33, GP.lipL);
    } else if (expr === 'surprised') {
      const r = open ? 1 : 0;
      row(31 - r, 23, 24, GP.lipD); P(22, 32 - r, GP.lipD); P(25, 32 - r, GP.lipD); row(32 - r, 23, 24, GP.mouth);
      if (r) { P(22, 32, GP.lipD); P(25, 32, GP.lipD); row(32, 23, 24, GP.mouth); }
      row(33, 23, 24, GP.lip);
    } else if (open) {
      row(31, 21, 26, GP.lipD); row(32, 21, 26, GP.mouth); row(32, 22, 25, GP.teeth); row(33, 22, 25, GP.mouth); row(34, 22, 25, GP.lip); P(23, 34, GP.lipL);
    } else if (smile) {
      P(20, 31, GP.lipD); row(32, 21, 26, GP.lipD); P(27, 31, GP.lipD); row(33, 22, 25, GP.lip); P(23, 33, GP.lipL);
      if (expr === 'tease') { P(24, 33, GP.tongue); P(25, 33, GP.tongue); P(24, 34, GP.tongue); P(25, 34, GP.lipD); }
    } else if (expr === 'sad') {
      P(20, 33, GP.lipD); row(32, 21, 26, GP.lipD); P(27, 33, GP.lipD); row(33, 22, 25, GP.lip);
    } else if (expr === 'proud' || expr === 'think') {
      row(32, 21, 25, GP.lipD); P(26, 31, GP.lipD); if (expr === 'proud') P(27, 30, GP.lipD); row(33, 22, 24, GP.lip); P(23, 33, GP.lipL);
    } else { row(32, 21, 26, GP.lipD); row(33, 22, 25, GP.lip); P(23, 33, GP.lipL); }
    fcache.set(key, c); return c;
  }
  TG.guideFace = guideFace; TG.guidePalette = GP;

  // ---------------------------------------------------------------- the dialogue box
  // SPEAKERS: id → { name: {mn,en} | fn, voice, art: [w, h], portrait(expr, open, blink, t) → canvas, bob: bounce while talking }
  const SPEAKERS = {
    guide: { name: { mn: 'Хөтөч Болормаа', en: 'Guide Bolormaa' }, voice: 'guide', art: [48, 48], portrait: (e, o, b) => guideFace(e, o, b) },
  };
  const register = (id, spec) => { SPEAKERS[id] = Object.assign({ voice: id, art: [16, 28] }, SPEAKERS[id] || {}, spec); };

  let cur = null;
  function build() {
    if (cur) return cur;
    const face = h('canvas', { class: 'dlg-face-c' });
    const name = h('div', { class: 'dlg-name' }), text = h('div', { class: 'dlg-text', 'aria-live': 'polite' });
    const more = h('span', { class: 'dlg-more', 'aria-hidden': 'true' }, '▼');
    const choices = h('div', { class: 'dlg-choices', role: 'listbox' });
    const box = h('div', { class: 'dlg-box' }, h('div', { class: 'dlg-face' }, face), h('div', { class: 'dlg-main' }, name, text), more);
    const catcher = h('div', { class: 'dlg-catch' });
    const root = h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'dialogue' }, catcher, h('div', { class: 'dlg-wrap' }, choices, box));
    document.body.appendChild(root);
    cur = { root, face, name, text, more, choices, box, line: null, sp: null, typing: null, mouth: false, waiting: null, sel: 0, opts: [], raf: 0, blinkAt: performance.now() + 2500, lastDraw: '' };
    const advance = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } if (cur && cur.root === root && !cur.opts.length) press(); }; // while asking, only the answer buttons choose
    catcher.addEventListener('pointerdown', advance);
    box.addEventListener('pointerdown', advance);
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', swallowUp, true);
    const loop = (ts) => { if (!cur) return; drawFace(ts); cur.raf = requestAnimationFrame(loop); };
    cur.raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => cur && cur.root.classList.add('show'));
    return cur;
  }
  function drawFace(ts) {
    const c = cur, sp = c.sp; if (!sp) return;
    if (ts > c.blinkAt + 130) c.blinkAt = ts + 2200 + Math.random() * 2600;
    const blink = ts > c.blinkAt, open = !!c.mouth, bob = sp.bob !== false && open && sp.art[1] > sp.art[0] ? 1 : 0;
    const k = `${c.line && c.line.face}|${open}|${blink}|${bob}|${c.spId}`;
    if (k === c.lastDraw) return; c.lastDraw = k;
    const img = sp.portrait((c.line && c.line.face) || 'neutral', open, blink, ts);
    const [w, hh] = sp.art; if (c.face.width !== w || c.face.height !== hh + 1) { c.face.width = w; c.face.height = hh + 1; c.face.style.setProperty('--ar', w / (hh + 1)); }
    const x = c.face.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, w, hh + 1); x.drawImage(img, 0, 1 - bob);
  }
  function press() {
    const c = cur; if (!c) return;
    if (c.typing && !c.typing.finished) { c.typing.skip(); return; }
    if (c.opts.length) return choose(c.sel);
    if (c.waiting) { const r = c.waiting; c.waiting = null; TG.sfx.tap && TG.sfx.tap(); r(); }
  }
  function choose(i) {
    const c = cur; if (!c || !c.opts.length || !c.waiting) return;
    const r = c.waiting; c.waiting = null; c.opts = []; c.choices.replaceChildren(); c.root.classList.remove('asking');
    TG.sfx.tap && TG.sfx.tap(); r(i);
  }
  function highlight() { [...cur.choices.children].forEach((b, i) => { b.classList.toggle('on', i === cur.sel); b.setAttribute('aria-selected', String(i === cur.sel)); }); }
  const ADV = ['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyZ'], UP = ['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'], DOWN = ['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'];
  function onKey(e) {
    if (!cur || document.querySelector('.modal-back')) return; // a window opened on top of the dialogue gets the keys
    if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    const c = cur, isAdv = ADV.includes(e.code), isUp = UP.includes(e.code), isDown = DOWN.includes(e.code);
    if (free() && (isUp || isDown || /Arrow/.test(e.code))) return; // a free line lets the player keep walking
    if (!isAdv && !isUp && !isDown && e.code !== 'KeyX' && !/^Digit[1-4]$/.test(e.code) && !/Shift/.test(e.code) && e.code !== 'KeyB' && e.code !== 'KeyF') return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat && isAdv) return;
    if (e.code === 'KeyX') { if (c.typing) c.typing.skip(); return; }
    if (c.opts.length) {
      if (isUp) { c.sel = (c.sel + c.opts.length - 1) % c.opts.length; highlight(); TG.sfx.tick && TG.sfx.tick(); return; }
      if (isDown) { c.sel = (c.sel + 1) % c.opts.length; highlight(); TG.sfx.tick && TG.sfx.tick(); return; }
      const d = /^Digit([1-4])$/.exec(e.code); if (d && +d[1] <= c.opts.length) return choose(+d[1] - 1);
    }
    if (isAdv) press();
  }
  function swallowUp(e) { if (cur && !free() && !document.querySelector('.modal-back') && [...ADV, ...UP, ...DOWN].includes(e.code)) { e.preventDefault(); e.stopPropagation(); } }

  function speakerName(sp, line) { const n = line.name || sp.name; return typeof n === 'function' ? n() : TG.tx(n); }
  /** Show one line. line: { who, face, text, choices?: [text…], name?, top?: show the box at the top, free?: keep walking, auto?: ms until it moves on by itself }. Resolves on tap/key (or with the chosen index). */
  function show(line) {
    const c = build(), sp = SPEAKERS[line.who] || SPEAKERS.guide;
    c.line = line; c.sp = sp; c.spId = line.who; c.lastDraw = '';
    c.root.classList.toggle('portrait-tall', sp.art[1] > sp.art[0]);
    c.root.classList.toggle('at-top', !!line.top); // move out of the way of something at the bottom of the screen
    c.root.classList.toggle('free', !!line.free && !line.choices); // free: the world behind stays playable (walk, tap) while she talks
    c.name.textContent = speakerName(sp, line);
    c.opts = []; c.choices.replaceChildren(); c.root.classList.remove('asking', 'ready');
    const text = TG.tx(line.text);
    return new Promise((resolve) => {
      c.typing = type(c.text, text, line.voice || sp.voice, { tapToSkip: false, onMouth: (o) => { if (cur) cur.mouth = o; } });
      c.waiting = resolve;
      c.typing.done.then(() => {
        if (!cur || cur.line !== line) return;
        cur.mouth = false; cur.root.classList.add('ready');
        if (line.auto && !line.choices) setTimeout(() => { if (cur && cur.line === line && cur.waiting) press(); }, line.auto); // a passing remark goes away by itself
        if (!line.choices) return;
        cur.opts = line.choices.map((q) => TG.tx(q)); cur.sel = 0; cur.root.classList.add('asking');
        cur.choices.replaceChildren(...cur.opts.map((t, i) => h('button', { class: 'dlg-opt', role: 'option', onpointerdown: (e) => { e.stopPropagation(); }, onclick: (e) => { e.stopPropagation(); choose(i); }, onpointerenter: () => { if (cur) { cur.sel = i; highlight(); } } }, h('span', { class: 'dlg-heart', 'aria-hidden': 'true' }, '♥'), t)));
        highlight();
      });
    });
  }
  const say = (line) => show(line).then(() => undefined);
  const ask = (line) => show(line);
  /** A short scene: lines one after another. Returns the last choice made (if any). */
  async function run(lines) { let ans; for (const l of lines) ans = await show(l); return ans; }
  function close() {
    if (!cur) return;
    const c = cur; cur = null;
    if (c.typing) c.typing.skip();
    cancelAnimationFrame(c.raf);
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', swallowUp, true);
    c.root.classList.remove('show'); setTimeout(() => c.root.remove(), 200);
    if (c.waiting) { const r = c.waiting; c.waiting = null; r(c.opts.length ? -1 : undefined); }
  }
  /** The current line lets the player walk while it is shown (no answers to pick). */
  function free() { return !!(cur && cur.line && cur.line.free && !cur.line.choices); }
  TG.dialog = { SPEAKERS, register, say, ask, run, close, free, active: () => !!cur, choose: (i) => choose(i), press: () => press() };
})(window.TG);
