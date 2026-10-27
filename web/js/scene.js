/* Full-screen walkable scenes (inside a ger, a trip to an aimag): pixel-art room drawn into a small buffer and scaled to fill
   the screen. Move with WASD / arrows or by tapping, Space jumps, E talks to or uses what is next to you. */
(function (TG) {
  const { h, L } = TG;
  const KEY = { ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u' };
  const JUMP_MS = 460, JUMP_H = 9;
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  let active = null;

  /** cfg: { cls, title, sub, right, W, H, fit ('contain' | visible art height), bg, start {x,y}, speed, free(x,y), look,
            things: [{ x, y, label() -> text, run() }], drawBg(b, t), ents(t) -> [{ y, f(b) }], drawTop(b, t),
            mini: { img, w, h, dots() -> [{ x, y, c }] } (map in art px), info, buttons, onClose, step(dt, t) } */
  function open(cfg) {
    if (active) active.close();
    const look = cfg.look || {};
    const cv = h('canvas', { class: 'scene-cv' }), sx = cv.getContext('2d');
    const buf = TG.pixel.mk(cfg.W, cfg.H), b = buf.x;
    const info = h('div', { class: 'scene-info px-frame' }), act = h('button', { class: 'btn primary scene-act', disabled: true });
    const jump = h('button', { class: 'scene-jump px-frame', 'aria-label': L('Үсрэх', 'Jump'), title: L('Үсрэх (Space)', 'Jump (Space)') }, '⤒');
    const runBtn = h('button', { class: 'scene-run px-frame', 'aria-label': L('Гүйх', 'Run'), 'aria-pressed': 'false', title: L('Гүйх (Shift)', 'Run (Shift)') }, '🏃');
    const mini = cfg.mini ? h('canvas', { class: 'scene-mini px-frame', width: cfg.mini.w, height: cfg.mini.h, 'aria-hidden': 'true' }) : null;
    const back = h('button', { class: 'scene-x px-frame', 'aria-label': L('Гарах', 'Leave') }, '✕');
    const root = h('div', { class: 'fscene ' + (cfg.cls || '') },
      cv,
      h('div', { class: 'scene-top' }, back, h('div', { class: 'scene-title px-frame' }, h('b', null, cfg.title), cfg.sub ? h('small', null, cfg.sub) : null), cfg.right || null),
      mini,
      h('div', { class: 'scene-bottom' }, info, h('div', { class: 'scene-btns' }, ...(cfg.buttons || []), runBtn, jump, act)));
    const me = { x: cfg.start.x, y: cfg.start.y, tx: cfg.start.x, ty: cfg.start.y, dir: 3, moving: false, jt: -1e9, z: 0 };
    const dog = { x: me.x + 14, y: me.y + 4 };
    const keys = new Set();
    let run = false, runLock = false;
    let raf = 0, last = performance.now(), near = null, pending = null, view = { k: 1, ox: 0, oy: 0, camX: 0, camY: 0 }, closed = false;

    function resize() {
      const dpr = Math.min(3, devicePixelRatio || 1), cw = root.clientWidth || innerWidth, ch = root.clientHeight || innerHeight;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      const W = cv.width, H = cv.height;
      let k;
      if (cfg.fit === 'contain' || !cfg.fit) { k = Math.min(W / cfg.W, H / cfg.H); if (W < H) k = Math.max(k, H / (cfg.H * 1.6)); } // phones: pan sideways, leave room for the panel below
      else k = Math.max(H / cfg.fit, W / cfg.W, H / cfg.H);
      view.k = k; view.dpr = dpr;
    }
    function camera() {
      const W = cv.width / view.k, H = cv.height / view.k;
      const cxw = W >= cfg.W ? (cfg.W - W) / 2 : Math.max(0, Math.min(cfg.W - W, me.x - W / 2));
      const cyw = H >= cfg.H ? -Math.min((H - cfg.H) / 2, (64 * view.dpr) / view.k) : Math.max(0, Math.min(cfg.H - H, me.y - H * 0.45)); // spare room goes below, under the panel
      view.camX = cxw; view.camY = cyw;
    }
    const doJump = () => { const t = performance.now(); if (t - me.jt < JUMP_MS) return; me.jt = t; TG.sfx.pop && TG.sfx.pop(); if (cfg.onJump) cfg.onJump(); };
    const interact = () => { if (near) near.run(); };
    function frame(ts) {
      if (closed) return;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), iy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
      if (ix || iy) { const n = Math.hypot(ix, iy); me.tx = me.x + (ix / n) * 8; me.ty = me.y + (iy / n) * 8; pending = null; }
      const dx = me.tx - me.x, dy = me.ty - me.y, d = Math.hypot(dx, dy);
      me.moving = d > 1;
      if (me.moving) {
        me.running = run || runLock;
        const sp = (cfg.speed || 64) * (me.running ? 1.75 : 1) * dt, mx = (dx / d) * Math.min(sp, d), my = (dy / d) * Math.min(sp, d);
        const okX = cfg.free(me.x + mx, me.y), okY = cfg.free(me.x, me.y + my);
        if (okX) me.x += mx; if (okY) me.y += my;
        if (!okX && !okY) { me.tx = me.x; me.ty = me.y; }
        me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
      }
      const jq = (ts - me.jt) / JUMP_MS; me.z = jq >= 0 && jq < 1 ? Math.round(Math.sin(jq * Math.PI) * JUMP_H) : 0;
      dog.x += (me.x + 14 - dog.x) * Math.min(1, dt * 2.6); dog.y += (me.y + 4 - dog.y) * Math.min(1, dt * 2.6);
      near = null; let bd = cfg.reach || 22;
      for (const t of cfg.things) { const dd = Math.hypot(t.x - me.x, t.y - me.y) + (t.penalty || 0); if (dd < bd) { bd = dd; near = t; } } // penalty: wandering animals give way to places and people
      if (pending && near === pending) { const p = pending; pending = null; me.tx = me.x; me.ty = me.y; p.run(); }
      act.disabled = !near;
      act.textContent = near ? near.label() + (coarse() ? '' : ' (E)') : (cfg.hint ? cfg.hint() : L('Ойртоод E дар', 'Walk up and press E'));
      if (cfg.step) cfg.step(dt, ts);
      // draw the art buffer
      const t = ts / 1000;
      b.fillStyle = cfg.bg || '#1e140c'; b.fillRect(0, 0, cfg.W, cfg.H);
      cfg.drawBg(b, t);
      const ents = cfg.ents ? cfg.ents(t) : [];
      ents.push({ y: dog.y, f: () => b.drawImage(TG.pixel.bankhar(Math.hypot(me.x + 14 - dog.x, me.y + 4 - dog.y) > 3 ? 1 + Math.floor(ts / 120) % 2 : 3), Math.round(dog.x - 11), Math.round(dog.y - 16)) });
      ents.push({ y: me.y, f: () => {
        b.fillStyle = 'rgba(30,20,10,.28)'; const sw = me.z > 4 ? 4 : 5; b.fillRect(Math.round(me.x - sw), Math.round(me.y - 1), sw * 2, 2);
        b.drawImage(TG.pixel.char({ ...look, ride: null }, me.dir, me.moving && !me.z ? 1 + Math.floor(ts / (me.running ? 75 : 125)) % 2 : 0), Math.round(me.x - 8), Math.round(me.y - 26 - me.z));
      } });
      ents.sort((a2, b2) => a2.y - b2.y).forEach((e) => e.f(b));
      if (near) { b.fillStyle = '#f7c646'; const bob = Math.round(Math.sin(ts / 160) * 1.5); b.fillRect(Math.round(near.x) - 1, Math.round(near.y) - 40 + bob, 3, 3); b.fillRect(Math.round(near.x), Math.round(near.y) - 36 + bob, 1, 2); }
      if (cfg.drawTop) cfg.drawTop(b, t);
      // scale it onto the screen
      camera();
      sx.imageSmoothingEnabled = false; sx.fillStyle = cfg.bg || '#1e140c'; sx.fillRect(0, 0, cv.width, cv.height);
      sx.drawImage(buf.c, Math.round(-view.camX * view.k), Math.round(-view.camY * view.k), Math.round(cfg.W * view.k), Math.round(cfg.H * view.k));
      if (mini) drawMini();
      raf = requestAnimationFrame(frame);
    }
    function drawMini() {
      const m = mini.getContext('2d'), M = cfg.mini; m.imageSmoothingEnabled = false;
      m.drawImage(M.img, 0, 0, M.w, M.h);
      const s = M.w / cfg.W;
      for (const d of M.dots ? M.dots() : []) { m.fillStyle = '#2b1e2e'; m.fillRect(Math.round(d.x * s) - 2, Math.round(d.y * s) - 2, 5, 5); m.fillStyle = d.c; m.fillRect(Math.round(d.x * s) - 1, Math.round(d.y * s) - 1, 3, 3); }
      if (Math.floor(performance.now() / 400) % 2) { m.fillStyle = '#ffffff'; m.fillRect(Math.round(me.x * s) - 3, Math.round(me.y * s) - 3, 7, 7); }
      m.fillStyle = '#e14b3d'; m.fillRect(Math.round(me.x * s) - 2, Math.round(me.y * s) - 2, 5, 5);
      const W = cv.width / view.k, H = cv.height / view.k; m.strokeStyle = 'rgba(255,255,255,.8)'; m.lineWidth = 1;
      m.strokeRect(Math.round(Math.max(0, view.camX) * s) + 0.5, Math.round(Math.max(0, view.camY) * s) + 0.5, Math.round(Math.min(W, cfg.W) * s) - 1, Math.round(Math.min(H, cfg.H) * s) - 1);
    }
    // input
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) * view.dpr) / view.k + view.camX, py = ((e.clientY - r.top) * view.dpr) / view.k + view.camY;
      const hit = cfg.things.find((t) => Math.hypot(t.x - px, t.y - 14 - py) < 18);
      if (hit && Math.hypot(hit.x - me.x, hit.y - me.y) < (cfg.reach || 22)) return hit.run();
      if (hit) { me.tx = hit.x; me.ty = hit.y + 6; pending = hit; } else { me.tx = px; me.ty = py; pending = null; }
    });
    if (mini) mini.addEventListener('pointerdown', (e) => { // tap the minimap to walk there
      e.preventDefault(); const r = mini.getBoundingClientRect(); me.tx = ((e.clientX - r.left) / r.width) * cfg.W; me.ty = ((e.clientY - r.top) / r.height) * cfg.H; pending = null;
    });
    act.addEventListener('click', () => { act.blur(); interact(); });
    info.addEventListener('click', (e) => { if (!e.target.closest('button')) info.classList.toggle('min'); }); // tap the panel to fold it away
    jump.addEventListener('click', () => { jump.blur(); doJump(); });
    runBtn.addEventListener('click', () => { runBtn.blur(); runLock = !runLock; runBtn.classList.toggle('on', runLock); runBtn.setAttribute('aria-pressed', String(runLock)); TG.sfx.tap(); });
    back.addEventListener('click', () => api.close());
    const busy = (e) => document.querySelector('.modal-back') || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '');
    const kd = (e) => {
      if (busy(e)) return;
      if (KEY[e.code]) { e.preventDefault(); e.stopPropagation(); keys.add(KEY[e.code]); }
      else if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) doJump(); }
      else if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) interact(); }
      else if (e.code === 'Escape') { e.preventDefault(); api.close(); }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') run = true;   // hold Shift to run
    };
    const ku = (e) => { if (KEY[e.code]) keys.delete(KEY[e.code]); if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') run = false; if (e.code === 'Space' && !busy(e)) { e.preventDefault(); e.stopPropagation(); } };
    const blur = () => { keys.clear(); run = false; };
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true); window.addEventListener('blur', blur); window.addEventListener('resize', resize);
    const api = {
      me, root, info, view,
      say: (...kids) => { info.classList.remove('min'); info.replaceChildren(...kids); },
      close() {
        if (closed) return; closed = true; cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize);
        root.classList.add('out'); setTimeout(() => root.remove(), 180);
        if (active === api) active = null;
        if (cfg.onClose) cfg.onClose();
      },
      near: () => near,
      interact, jump: doJump,
    };
    if (cfg.info) api.say(...[].concat(cfg.info));
    document.body.appendChild(root);
    active = api;
    resize();
    raf = requestAnimationFrame(frame);
    return api;
  }
  TG.scene = { open, active: () => active };
})(window.TG);
