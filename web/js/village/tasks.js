/* Hands-on tasks on the Phaser engine: shearing, rolling felt, raising a ger… each is one small spec
   (drag, rhythm, spots, hold, turn or choose) run by a single Phaser scene over the dimmed village. */
(function (TG) {
  const { tx } = TG;
  const SW = 160, SH = 120; // the task stage, in art pixels
  const DARK = 0x2b1e2e, GOLD = 0xf7c646, CREAM = 0xfff8e6, GREEN = 0x7fe07a;
  let cur = null, seq = 0; // the running TaskScene; every run gets its own scene key

  const players = () => { const l = TG._village && TG._village.live(); return l && l.p2 ? 2 : 1; };
  const near = (ax, ay, bx, by, r) => Math.hypot(ax - bx, ay - by) <= r;

  class TaskScene extends Phaser.Scene {
    constructor(spec, done) { super('task' + ++seq); this.spec = spec; this.done = done; }

    create() {
      const spec = this.spec, vs = this.game.scene.getScene('village');
      this.m = vs.m; // canvas size and pixel scale from the village view
      this.st = { kind: spec.kind, progress: 0, n: spec.n || (spec.kind === 'spots' ? spec.spots.length : 1), mistakes: 0, t: 0, held: {}, sides: [], placed: new Set(), tilt: false, ang: spec.start || 0, fill: 0, along: 0, dry: false, dryT: 2.5, helperT: 0, sayT: 0 };
      this.dim = this.add.rectangle(0, 0, 1, 1, DARK, 0.55).setOrigin(0, 0);
      this.frame = this.add.graphics();
      this.canvas = this.textures.exists('task:art') ? this.textures.get('task:art') : this.textures.createCanvas('task:art', SW, SH);
      this.art = this.add.image(0, 0, 'task:art').setOrigin(0.5, 0.5);
      this.fx = this.add.graphics();
      const font = (px, color, bold) => ({ fontFamily: 'Rubik, sans-serif', fontSize: px + 'px', color, fontStyle: bold ? 'bold' : '', align: 'center' });
      const d = this.m.dpr;
      this.title = this.add.text(0, 0, tx(spec.title), font(Math.round(20 * d), '#ffffff', true)).setOrigin(0.5, 1).setStroke('#2b1e2e', 4 * d);
      this.hint = this.add.text(0, 0, tx(spec.hint), font(Math.round(14 * d), '#fff8e6')).setOrigin(0.5, 0).setStroke('#2b1e2e', 3 * d);
      this.sayBox = this.add.text(0, 0, '', font(Math.round(14 * d), '#2b1e2e')).setOrigin(0.5, 0).setBackgroundColor('#fff8e6').setPadding(10 * d, 6 * d).setVisible(false);
      this.close = this.add.text(0, 0, '✕', font(Math.round(22 * d), '#ffffff', true)).setOrigin(1, 0).setStroke('#2b1e2e', 4 * d).setInteractive({ useHandCursor: true });
      this.close.on('pointerdown', () => this.end(false));
      this.tray = (spec.kind === 'choose' ? spec.options : []).map((o) => {
        const key = 'task:opt:' + o.id; if (!this.textures.exists(key)) this.textures.addCanvas(key, o.icon);
        const img = this.add.image(0, 0, key).setInteractive({ useHandCursor: true }), lab = this.add.text(0, 0, tx(o.label), font(Math.round(11 * d), '#ffffff', true)).setOrigin(0.5, 0).setStroke('#2b1e2e', 3 * d);
        img.on('pointerdown', () => this.pick(o.id));
        return { o, img, lab };
      });
      this.input.on('pointerdown', (p) => this.down(p));
      this.input.on('pointermove', (p) => this.move(p));
      this.input.on('pointerup', (p) => this.up(p)); this.input.on('pointerupoutside', (p) => this.up(p));
      this.keyDown = (e) => this.key(e, true); this.keyUp = (e) => this.key(e, false);
      window.addEventListener('keydown', this.keyDown, true); window.addEventListener('keyup', this.keyUp, true);
      const off = () => { window.removeEventListener('keydown', this.keyDown, true); window.removeEventListener('keyup', this.keyUp, true); };
      this.events.once('shutdown', off); this.events.once('destroy', off);
      this.layout();
      this.art.setScale(this.z * 0.6).setAlpha(0); // a little pop as it opens
      this.tweens.add({ targets: this.art, scale: this.z, alpha: 1, duration: 220, ease: 'Back.Out' });
      if (spec.say) this.say(spec.say);       // e.g. grandpa's hint after a wrong step
      if (spec.shake) this.time.delayedCall(260, () => this.shake());
    }

    /** Fit the stage: the biggest whole-pixel scale that leaves room for the title, the hint and the tray. */
    layout() {
      const W = this.m.devW, H = this.m.devH, d = this.m.dpr;
      if (this.laid === W + 'x' + H) return; // word-wrapping re-renders text, so only when the screen changes
      const again = !!this.laid; this.laid = W + 'x' + H;
      this.z = Math.max(1, Math.floor(Math.min((W * 0.94) / SW, (H * 0.56) / SH)));
      this.ox = Math.round((W - SW * this.z) / 2); this.oy = Math.round((H - SH * this.z) / 2 - 30 * d);
      this.cameras.main.setSize(W, H);
      this.dim.setDisplaySize(W, H);
      this.art.setPosition(this.ox + (SW * this.z) / 2, this.oy + (SH * this.z) / 2);
      this.title.setPosition(W / 2, this.oy - 12 * d).setWordWrapWidth(W * 0.9);
      this.hint.setPosition(W / 2, this.oy + SH * this.z + 22 * d).setWordWrapWidth(W * 0.9);
      this.close.setPosition(this.ox + SW * this.z, this.oy - 44 * d);
      this.sayBox.setPosition(W / 2, this.oy + 6 * d).setWordWrapWidth(SW * this.z * 0.9);
      if (again) this.art.setScale(this.z);
      // the tray of parts: one row for a few, two rows for many
      const n = this.tray.length, cols = n > 5 ? Math.ceil(n / 2) : Math.max(1, n), cell = Math.min(80 * d, (W * 0.96) / cols), y0 = this.oy + SH * this.z + 60 * d;
      this.tray.forEach((t, i) => {
        const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), x = W / 2 + ((i % cols) - (inRow - 1) / 2) * cell, y = y0 + row * cell * 1.05;
        t.img.setPosition(x, y).setScale(Math.max(2, Math.floor((cell * 0.5) / t.img.width)));
        t.lab.setPosition(x, y + t.img.displayHeight / 2 + 3 * d).setWordWrapWidth(cell - 4 * d);
      });
    }
    toStage(p) { return [(p.x - this.ox) / this.z, (p.y - this.oy) / this.z]; }
    toScreen(x, y) { return [this.ox + x * this.z, this.oy + y * this.z]; }

    // ---------------------------------------------------------------- input
    down(p) {
      const s = this.st, sp = this.spec, [x, y] = this.toStage(p);
      if (sp.kind === 'drag') { const [hx, hy] = this.handle(); if (near(x, y, hx, hy, 16)) s.drag = p.id; }
      else if (sp.kind === 'rhythm') this.beat(p.x > this.m.devW / 2 && players() === 2 ? 'p2' : 'p1');
      else if (sp.kind === 'spots') { const i = sp.spots.findIndex(([sx, sy], k) => !s.placed.has(k) && near(x, y, sx, sy, 12)); if (i >= 0) this.place(i); }
      else if (sp.kind === 'hold') s.held['ptr' + p.id] = players() === 1 || sp.holders === 1 || x < SW / 2 ? 'p1' : 'p2'; // alone, any finger is yours
      else if (sp.kind === 'turn') { s.turnFrom = Math.atan2(y - SH / 2, x - SW / 2); s.turning = p.id; }
    }
    move(p) {
      const s = this.st, sp = this.spec, [x, y] = this.toStage(p);
      if (sp.kind === 'drag' && s.drag === p.id) {
        const [[x0, y0], [x1, y1]] = sp.path, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
        s.along = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
        if (s.along >= 0.95) { s.drag = null; s.along = 0; this.step(); }
      } else if (sp.kind === 'turn' && s.turning === p.id) { const a = Math.atan2(y - SH / 2, x - SW / 2); s.ang += a - s.turnFrom; s.turnFrom = a; }
    }
    up(p) {
      const s = this.st, sp = this.spec;
      if (sp.kind === 'drag' && s.drag === p.id) { s.drag = null; this.tweens.addCounter({ from: s.along, to: 0, duration: 160, onUpdate: (tw) => (s.along = tw.getValue()) }); }
      else if (sp.kind === 'hold') delete s.held['ptr' + p.id];
      else if (sp.kind === 'turn' && s.turning === p.id) { s.turning = null; this.turned(); }
    }
    /** E or Space is player 1's hand, Enter player 2's; Escape closes the task. */
    key(e, isDown) {
      const sp = this.spec, s = this.st, who = e.code === 'KeyE' || e.code === 'Space' ? 'p1' : e.code === 'Enter' || e.code === 'NumpadEnter' ? 'p2' : null;
      if (e.code === 'Escape' && isDown) { e.preventDefault(); e.stopPropagation(); return this.end(false); }
      if (!who && !/Arrow|KeyA|KeyD/.test(e.code)) return;
      e.preventDefault(); e.stopPropagation();
      if (sp.kind === 'hold') { if (isDown) s.held['key' + who] = who; else delete s.held['key' + who]; return; }
      if (!isDown || e.repeat) return;
      if (sp.kind === 'rhythm' && who) this.beat(who);
      else if (sp.kind === 'spots' && who) { const i = sp.spots.findIndex((q, k) => !s.placed.has(k) && (!s.tilt || (sp.side || [])[k] !== s.sides[s.sides.length - 1])); if (i >= 0) this.place(i); }
      else if (sp.kind === 'turn') { if (/Left|KeyA/.test(e.code)) s.ang -= Math.PI / 12; else if (/Right|KeyD/.test(e.code)) s.ang += Math.PI / 12; else if (who) this.turned(); }
      else if (sp.kind === 'choose' && this.tray.length) {
        s.sel = ((s.sel ?? -1) + (/Left|KeyA/.test(e.code) ? -1 : /Right|KeyD/.test(e.code) ? 1 : 0) + this.tray.length) % this.tray.length;
        if (who && s.sel >= 0) this.pick(this.tray[s.sel].o.id);
      }
    }

    // ---------------------------------------------------------------- the kinds
    handle() { const [[x0, y0], [x1, y1]] = this.spec.path, a = this.st.along; return [x0 + (x1 - x0) * a, y0 + (y1 - y0) * a]; }
    /** One tap on the beat. With water, the roll only turns while the felt is wet. */
    beat(who) {
      const s = this.st, sp = this.spec, two = players() === 2;
      if (sp.water && who === (two ? 'p2' : 'p1')) { if (s.dry) { s.dry = false; s.dryT = 3; this.pop(GREEN); TG.sfx.tap && TG.sfx.tap(); } if (!two) return; }
      if (sp.water && !two) return; // alone: Basar pulls the roll, you keep it wet
      if (who !== 'p1' || (sp.water && s.dry)) return;
      const pos = this.marker();
      if (Math.abs(pos - 0.5) <= (sp.win || 0.2) / 2) this.step(); else { s.t0 = this.time.now; TG.sfx.tick && TG.sfx.tick(); }
    }
    marker() { const s = this.st, q = ((this.time.now - (s.t0 || 0)) / 1000) * (this.spec.speed || 0.8); return Math.abs((q % 2) - 1); } // 0..1 and back
    place(i) {
      const s = this.st, sp = this.spec, side = (sp.side || [])[i];
      if (s.tilt && side === s.sides[s.sides.length - 1]) { this.wobble(); return; } // fix the tilt from the other side first
      s.placed.add(i); s.sides.push(side); s.tilt = false;
      if (sp.rule && sp.rule(s.sides)) { s.tilt = true; this.wobble(); }
      this.step();
    }
    turned() {
      const s = this.st, sp = this.spec, diff = Math.atan2(Math.sin(s.ang - sp.target), Math.cos(s.ang - sp.target));
      if (Math.abs(diff) <= (sp.tol || 0.35)) { s.ang = sp.target; this.step(); } else this.wobble();
    }
    pick(id) { if (this.spec.kind === 'choose' && !this.over) { this.st.pick = id; TG.sfx.tap && TG.sfx.tap(); this.end(true); } }
    /** One more done: a pop, and the task ends when all are done. */
    step() {
      const s = this.st; if (this.over) return;
      s.progress++; this.pop(GOLD); TG.sfx.good && TG.sfx.good();
      if (s.progress >= s.n) this.time.delayedCall(260, () => this.end(true));
    }
    /** A gentle wobble: nothing is lost, you just try again. */
    wobble() {
      this.st.mistakes++; TG.sfx.bad && TG.sfx.bad();
      this.shake();
      if (this.spec.onMiss) this.spec.onMiss(this.st);
    }
    shake() { this.tweens.add({ targets: this.art, angle: { from: -3, to: 3 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => this.art.setAngle(0) }); }
    pop(col) { this.tweens.add({ targets: this.art, scale: { from: this.z * 1.04, to: this.z }, duration: 160 }); this.flash = { col, t: this.time.now }; }
    say(text) { this.sayBox.setText(tx(text)).setVisible(true).setAlpha(1); this.st.sayT = this.time.now + 4000; }
    end(ok) {
      if (this.over) return; this.over = true;
      const s = this.st, two = players() === 2 && !!this.spec.two;
      if (ok && s.progress < s.n && this.spec.kind !== 'choose') s.progress = s.n;
      if (ok && this.spec.kind !== 'choose') { TG.sfx.win && TG.sfx.win(); }
      cur = null;
      this.done({ done: !!ok, mistakes: s.mistakes, together: !!ok && two, pick: s.pick });
      this.scene.remove();
    }

    // ---------------------------------------------------------------- every frame
    update(time, delta) {
      const s = this.st, sp = this.spec, dt = Math.min(0.05, delta / 1000), two = players() === 2;
      this.layout();
      // hold: fills while held (both holders when two are needed; alone, grandpa holds the other post)
      if (sp.kind === 'hold') {
        const h = Object.values(s.held), ok = sp.holders === 2 ? h.includes('p1') && (h.includes('p2') || !two) : h.length > 0;
        s.fill = Math.max(0, Math.min(1, s.fill + (ok ? dt / ((sp.ms || 1000) / 1000) : -dt * 2)));
        if (s.fill >= 1) { s.fill = 0; s.held = {}; this.step(); }
      }
      // rolling felt: it dries every few seconds and needs water; alone, Basar pulls the roll on the beat
      if (sp.kind === 'rhythm' && sp.water) {
        s.dryT -= dt; if (s.dryT <= 0 && !s.dry) s.dry = true;
        if (!two && !s.dry) { s.helperT += dt; if (s.helperT > 0.9) { s.helperT = 0; this.step(); } }
      }
      if (s.sayT && time > s.sayT) { s.sayT = 0; this.tweens.add({ targets: this.sayBox, alpha: 0, duration: 300, onComplete: () => this.sayBox.setVisible(false) }); }
      // the stage art, then what the kind shows on top of it
      const c = this.canvas, x = c.context; x.clearRect(0, 0, SW, SH); x.imageSmoothingEnabled = false;
      x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, SW, SH);
      if (sp.art) sp.art(x, time / 1000, s);
      c.refresh();
      this.drawKind(time);
    }
    drawKind(time) {
      const g = this.fx, s = this.st, sp = this.spec, z = this.z, d = this.m.dpr, S = (x, y) => this.toScreen(x, y);
      g.clear();
      // frame around the stage
      const [fx0, fy0] = S(0, 0); g.lineStyle(Math.max(2, z), DARK, 1); g.strokeRect(fx0 - z, fy0 - z, SW * z + 2 * z, SH * z + 2 * z);
      if (this.flash && time - this.flash.t < 200) { g.lineStyle(Math.max(3, z * 2), this.flash.col, 1 - (time - this.flash.t) / 200); g.strokeRect(fx0 - 2 * z, fy0 - 2 * z, SW * z + 4 * z, SH * z + 4 * z); }
      const pulse = 1 + Math.sin(time / 160) * 0.15;
      if (sp.kind === 'drag') {
        const [[x0, y0], [x1, y1]] = sp.path, [ax, ay] = S(x0, y0), [bx, by] = S(x1, y1), [hx, hy] = S(...this.handle());
        g.lineStyle(z, CREAM, 0.6); g.lineBetween(ax, ay, bx, by);
        g.fillStyle(DARK, 1); g.fillCircle(hx, hy, 7 * z * pulse); g.fillStyle(GOLD, 1); g.fillCircle(hx, hy, 5 * z * pulse);
        g.fillStyle(CREAM, 0.8); g.fillTriangle(bx + 4 * z, by, bx - 2 * z, by - 4 * z, bx - 2 * z, by + 4 * z);
      } else if (sp.kind === 'rhythm') {
        const [bx, by] = S(20, SH - 14), w = 120 * z, win = (sp.win || 0.2) * w;
        g.fillStyle(DARK, 0.85); g.fillRect(bx, by, w, 8 * z); g.fillStyle(GREEN, 0.9); g.fillRect(bx + w / 2 - win / 2, by, win, 8 * z);
        const roll = !(sp.water && players() === 1);
        if (roll) { g.fillStyle(GOLD, 1); g.fillRect(bx + this.marker() * w - 2 * z, by - 3 * z, 4 * z, 14 * z); }
        if (sp.water && s.dry) { const [wx, wy] = S(SW - 22, 18); g.fillStyle(DARK, 1); g.fillCircle(wx, wy, 9 * z * pulse); g.fillStyle(0x4aa6e2, 1); g.fillCircle(wx, wy, 7 * z * pulse); }
      } else if (sp.kind === 'spots') {
        sp.spots.forEach(([x, y], k) => { const [sx, sy] = S(x, y); if (s.placed.has(k)) return; g.fillStyle(DARK, 0.9); g.fillCircle(sx, sy, 5 * z * pulse); g.fillStyle(s.tilt && (sp.side || [])[k] === s.sides[s.sides.length - 1] ? 0xe14b3d : GOLD, 1); g.fillCircle(sx, sy, 3.5 * z * pulse); });
      } else if (sp.kind === 'hold') {
        const zones = sp.holders === 2 ? [[SW * 0.25, 'p1'], [SW * 0.75, 'p2']] : [[SW / 2, 'p1']], held = Object.values(s.held);
        for (const [zx, who] of zones) {
          const [sx, sy] = S(zx, SH / 2), on = held.includes(who) || (who === 'p2' && players() === 1);
          g.lineStyle(2 * z, on ? GREEN : CREAM, 1); g.strokeCircle(sx, sy, 14 * z);
          g.fillStyle(GOLD, 0.85); g.slice(sx, sy, 12 * z, -Math.PI / 2, -Math.PI / 2 + s.fill * Math.PI * 2, false); g.fillPath();
        }
      } else if (sp.kind === 'turn') {
        const [cx, cy] = S(SW / 2, SH / 2), r = 34 * z, a = s.ang;
        g.lineStyle(z, CREAM, 0.5); g.strokeCircle(cx, cy, r);
        g.fillStyle(DARK, 1); g.fillCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7 * z); g.fillStyle(GOLD, 1); g.fillCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5 * z);
      }
      // progress pips under the hint
      if (sp.kind !== 'choose' && s.n > 1) { const y = this.hint.y + this.hint.height + 10 * d, w = 10 * d; for (let i = 0; i < s.n; i++) { const x = this.m.devW / 2 + (i - (s.n - 1) / 2) * w * 1.6; g.fillStyle(DARK, 1); g.fillRect(x - w / 2 - d, y - d, w + 2 * d, w + 2 * d); g.fillStyle(i < s.progress ? GOLD : CREAM, 1); g.fillRect(x - w / 2, y, w, w); } }
      if (sp.kind === 'choose' && s.sel >= 0 && this.tray[s.sel]) { const t = this.tray[s.sel].img; g.lineStyle(3 * d, GOLD, 1); g.strokeRect(t.x - t.displayWidth / 2 - 4 * d, t.y - t.displayHeight / 2 - 4 * d, t.displayWidth + 8 * d, t.displayHeight + 8 * d); }
    }
  }

  /** Run one hands-on task over the village; resolves { done, mistakes, together, pick }. */
  function run(spec) {
    const view = TG.villageView.current();
    if (!view || cur) return Promise.resolve({ done: false, mistakes: 0, together: false });
    return new Promise((resolve) => {
      const root = view.game.canvas.parentElement; root && root.classList.add('tasking');
      const scene = new TaskScene(spec, (r) => { root && root.classList.remove('tasking'); resolve(r); });
      cur = scene;
      try { view.game.scene.add(scene.sys.settings.key, scene, true); } catch (e) { cur = null; root && root.classList.remove('tasking'); resolve({ done: false, mistakes: 0, together: false }); }
    });
  }

  TG.tasks = {
    run, players,
    active: () => (cur && cur.st ? { kind: cur.spec.kind, progress: cur.st.progress, n: cur.st.n } : null),
    say: (text) => cur && cur.st && cur.say(text),
    finish: () => cur && cur.st && cur.end(true),
    /** The village is closing: the open task ends as not done, and the controls are free again. */
    abort: () => { if (!cur) return; const c = cur; cur = null; c.over = true; c.done({ done: false, mistakes: c.st ? c.st.mistakes : 0, together: false }); },
    cancel: () => cur && cur.st && cur.end(false),
    pick: (id) => cur && cur.st && cur.pick(id),
    /** For tests: where a point on the task stage is on the screen, in CSS pixels. */
    toCss: (x, y) => { if (!cur || !cur.st) return null; const [gx, gy] = cur.toScreen(x, y), r = cur.game.canvas.getBoundingClientRect(); return [r.left + gx / cur.m.dpr, r.top + gy / cur.m.dpr]; },
  };
})(window.TG);
