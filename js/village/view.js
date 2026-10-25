/* Нутаг on the Phaser 4 game engine: terrain, camera, every character, name and marker, and touch/mouse input.
   village.js keeps the rules and describes what is where each frame (its model); this file draws it with Phaser. */
(function (TG) {
  const WD = TG.vworld, T = WD.T;
  const DARK = '#2b1e2e';
  let games = 0, cur = null;
  const texKeys = new WeakMap(); let texN = 0; // one texture per pixel.js canvas (pixel.js caches them, so each is added once)

  /** Canvas size and pixel scale: about 11 tiles across a phone, 24 on a wide screen, never showing past the map edge. */
  function measure(el) {
    const cssW = el.clientWidth || innerWidth, cssH = el.clientHeight || innerHeight, dpr = Math.min(3, devicePixelRatio || 1);
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    let k = Math.max(1, Math.round(devW / ((cssW < 640 ? 11 : 24) * T)));
    k = Math.max(k, Math.ceil(devW / (WD.W * T)), Math.ceil(devH / (WD.H * T)));
    return { cssW, cssH, dpr, devW, devH, k, bw: devW / k, bh: devH / k };
  }
  const put = (layer, o) => { layer.add(o); return o; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (c) => { // '#rrggbb' or 'rgba(r,g,b,a)' -> [0xRRGGBB, alpha]
    if (c[0] === '#') return [parseInt(c.slice(1, 7), 16), 1];
    const n = c.match(/[\d.]+/g).map(Number); return [(n[0] << 16) | (n[1] << 8) | n[2], n[3] ?? 1];
  };

  class VillageScene extends Phaser.Scene {
    constructor(hooks, m) { super('village'); this.hooks = hooks; this.m = m; this.n = 0; this.pool = new Map(); this.used = new Map(); }

    create() {
      const m = this.m;
      this.world = this.add.layer(); this.ui = this.add.layer();
      const cam = this.cameras.main; cam.setOrigin(0, 0); cam.ignore(this.ui); cam.setBackgroundColor('#76b947');
      this.uiCam = this.cameras.add(0, 0, m.devW, m.devH); this.uiCam.setOrigin(0, 0); this.uiCam.ignore(this.world);
      const ground = this.tex(WD.renderStatic()); this.keep = ground; // set once, so never freed
      put(this.world, this.add.image(0, 0, ground).setOrigin(0, 0).setDepth(0));
      this.water = put(this.world, this.add.graphics().setDepth(0.5));
      this.shadows = put(this.world, this.add.graphics().setDepth(0.6));
      this.uiG = put(this.ui, this.add.graphics().setDepth(0));
      // the season and the evening: a tint and falling snow, leaves, petals or butterflies over the ground (under everyone),
      // then a dark evening veil with warm lantern light over everything
      this.tint = put(this.world, this.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(0.7));
      this.veil = put(this.world, this.add.rectangle(0, 0, 1, 1, 0x121646, 0.38).setOrigin(0, 0).setScrollFactor(0).setDepth(90).setVisible(false));
      this.glow = put(this.world, this.add.graphics().setDepth(91).setBlendMode(Phaser.BlendModes.ADD));
      this.lanterns = WD.objects.filter((o) => o.kind === 'lantern');
      this.sfx = { season: null, w: 0, emitter: null };
      this.waterTiles = [];
      for (let y = 0; y < WD.H; y++) for (let x = 0; x < WD.W; x++) if (WD.g[y][x] === 'w') this.waterTiles.push([x, y]);
      for (const type of ['pointerdown', 'pointermove', 'pointerup']) this.input.on(type, (p) => this.pointer(type.slice(7), p));
      this.input.on('pointerupoutside', (p) => this.pointer('up', p));
      this.applySize();
    }

    /** A Phaser texture key for a pixel.js canvas; textures nobody has used for a while are freed. */
    tex(c) {
      let key = texKeys.get(c);
      if (!key) { key = 'cv' + (++texN); texKeys.set(c, key); }
      if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
      this.used.set(key, this.n);
      return key;
    }
    sweepTextures() {
      for (const [key, at] of this.used) if (key !== this.keep && this.n - at > 600) { this.used.delete(key); if (this.textures.exists(key)) this.textures.remove(key); }
    }

    applySize() {
      const m = this.m, cam = this.cameras.main;
      this.scale.zoom = 1 / m.dpr; this.scale.resize(m.devW, m.devH);
      cam.setSize(m.devW, m.devH); cam.setZoom(m.k); this.uiCam.setSize(m.devW, m.devH);
    }

    pointer(type, p) {
      // x/y in screen points (CSS pixels) for mouse and touch alike: p.x is in the canvas's device pixels, and a touch event has no clientX
      const e = p.event || {}, cam = this.cameras.main, r = this.game.canvas.getBoundingClientRect(), k = r.width / this.m.devW || 1 / this.m.dpr;
      this.hooks.pointer(type, { id: p.id, x: r.left + p.x * k, y: r.top + p.y * k, wx: cam.scrollX + p.x / cam.zoom, wy: cam.scrollY + p.y / cam.zoom, touch: !!p.wasTouch, event: e });
    }

    /** Get (or make) the pooled object for this id; anything not asked for this frame is removed at the end of it. */
    get(id, make) {
      let o = this.pool.get(id);
      if (!o) { o = make(); this.pool.set(id, o); }
      o.__n = this.n; return o;
    }
    sweep() { for (const [id, o] of this.pool) if (o.__n !== this.n) { o.destroy(); this.pool.delete(id); } }

    /** World art px -> screen px (the text and marker layer works in real screen pixels, so the pixel font stays crisp). */
    S(wx, wy) { const cam = this.cameras.main, z = cam.zoom; return [(wx - cam.scrollX) * z, (wy - cam.scrollY) * z]; }
    fontPx(s = 1) { return Math.max(10, Math.round((5 * Math.max(2, this.m.k) * s) / 5) * 5); }
    text(id, str, x, y, o = {}) {
      const fs = o.px || this.fontPx(o.s), out = o.outline === undefined ? DARK : o.outline, w = Math.max(1, Math.round(fs / 10));
      const t = this.get('t:' + id, () => put(this.ui, this.add.text(0, 0, '', { fontFamily: 'Tiny5, monospace' }).setOrigin(0.5).setDepth(2)));
      // every style change re-renders the text, so only touch what changed
      if (t.__fs !== fs) { t.setFontSize(fs); t.__fs = fs; }
      if (o.font && t.__font !== o.font) { t.setFontFamily(o.font); t.__font = o.font; }
      const col = o.color || '#ffffff', sw = out ? w * 2 : 0;
      if (t.__col !== col) { t.setColor(col); t.__col = col; }
      if (t.__out !== out || t.__sw !== sw) { t.setStroke(out || '#000000', sw); t.__out = out; t.__sw = sw; }
      t.setText(str);
      t.setPosition(Math.round(x), Math.round(y)).setAlpha(o.alpha ?? 1);
      return t;
    }

    update(time, delta) {
      this.hooks.tick(Math.min(0.05, delta / 1000));
      const paused = this.hooks.paused();
      this.cameras.main.setVisible(!paused); this.uiCam.setVisible(!paused);
      if (paused) return;
      const f = this.hooks.model(time / 1000);
      if (!f) return;
      this.n++;
      this.render(f, time / 1000);
      this.sweep();
      if (this.n % 2) this.hooks.mini();
      if (this.n % 300 === 0) this.sweepTextures();
    }

    render(f, t) {
      const m = this.m, k = m.k, cam = this.cameras.main, zoom = k / (f.zoomOut || 1);
      if (cam.zoom !== zoom) cam.setZoom(zoom);
      const vw = m.devW / zoom, vh = m.devH / zoom;
      // whole screen pixels, so pixel art never shimmers while the camera glides
      cam.scrollX = Math.round(clamp(f.cam.x - vw / 2, 0, Math.max(0, WD.W * T - vw)) * zoom) / zoom;
      cam.scrollY = Math.round(clamp(f.cam.y - vh / 2, 0, Math.max(0, WD.H * T - vh)) * zoom) / zoom;
      this.drawWater(t, cam, vw, vh);
      this.seasonFx(f.season, f.night, vw, vh);
      const snap = (v) => Math.round(v * zoom) / zoom;
      // ground shadows, under everyone
      const sg = this.shadows; sg.clear(); sg.fillStyle(0x1e140a, 0.25);
      for (const s of f.shadows) {
        if (s.w) { sg.fillRect(snap(s.x), snap(s.y), s.w, s.h); continue; }
        sg.fillRect(snap(s.x) + 4, snap(s.y) + 13, 9, 1); sg.fillRect(snap(s.x) + 3, snap(s.y) + 14, 11, 1); sg.fillRect(snap(s.x) + 4, snap(s.y) + 15, 9, 1);
      }
      // characters, animals, gers: sorted by how far down the map their feet are
      for (const d of f.sprites) {
        const key = this.tex(d.img);
        const im = this.get('s:' + d.id, () => put(this.world, this.add.image(0, 0, key).setOrigin(0, 0)));
        if (im.texture.key !== key) im.setTexture(key);
        im.setPosition(snap(d.x), snap(d.y)).setFlipX(!!d.flip).setAlpha(d.alpha ?? 1).setDepth(1 + d.depth);
      }
      // the screen-pixel layer: names, levels, speech bubbles, arrows, floating text
      const g = this.uiG; g.clear();
      for (const tg of f.tags) this.tag(tg, g);
      for (const d of f.texts) { const [x, y] = this.S(d.x, d.y); this.text(d.id, d.text, x, y, d.font === 'rubik' ? { px: Math.round(k * 5), font: 'Rubik, sans-serif', outline: null, color: d.color, alpha: d.alpha } : { s: d.size, color: d.color, alpha: d.alpha }); }
      for (const mk of f.marks) this.mark(mk, g, t);
    }

    /** One particle texture per season, its variants side by side as frames 0, 1, 2…, drawn pixel by pixel like the rest of the art. */
    flakes(name, w, hh, paints) {
      const key = 'fx:' + name;
      if (!this.textures.exists(key)) {
        const c = TG.pixel.mk(w * paints.length, hh); paints.forEach((p, i) => { c.x.save(); c.x.translate(i * w, 0); p(c.x); c.x.restore(); });
        const tx = this.textures.addCanvas(key, c.c); paints.forEach((p, i) => tx.add(String(i), 0, i * w, 0, w, hh));
      }
      return { key, frame: paints.map((p, i) => String(i)) };
    }
    seasonFx(id, night, vw, vh) {
      const fx = this.sfx, R = (x, X, Y, w, hh, col) => { x.fillStyle = col; x.fillRect(X, Y, w, hh); };
      this.tint.setDisplaySize(vw + 2, vh + 2);
      if (fx.season !== id || Math.abs(fx.w - vw) > 1) {
        fx.season = id; fx.w = vw;
        if (fx.emitter) fx.emitter.destroy();
        // the tint, as before: a light frost, a warm autumn glow, a faint spring blush
        this.tint.setBlendMode(id === 'autumn' ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.NORMAL);
        if (id === 'winter') this.tint.setFillStyle(0xebf2fa, 0.16); else if (id === 'autumn') this.tint.setFillStyle(0xffd59a, 1); else if (id === 'spring') this.tint.setFillStyle(0xffc8e6, 0.06); else this.tint.setFillStyle(0xffffff, 0);
        const tex = id === 'winter' ? this.flakes('snow', 2, 1, [(x) => R(x, 0, 0, 1, 1, '#ffffff'), (x) => { R(x, 0, 0, 1, 1, '#ffffff'); R(x, 1, 0, 1, 1, '#dce8f5'); }])
          : id === 'autumn' ? this.flakes('leaf', 2, 2, ['#e8752a', '#c9461e', '#f2b33d'].map((c, i) => (x) => { R(x, 0, 0, 2, 1, c); R(x, i % 2, 1, 1, 1, '#a8501c'); }))
          : id === 'spring' ? this.flakes('petal', 2, 1, [(x) => R(x, 0, 0, 1, 1, '#ffb7d5'), (x) => { R(x, 0, 0, 1, 1, '#ffffff'); R(x, 1, 0, 1, 1, '#ff8fb1'); }])
          : this.flakes('fly', 3, 1, ['#ffd34e', '#b49cff'].map((c) => (x) => { R(x, 0, 0, 1, 1, c); R(x, 1, 0, 1, 1, '#ffffff'); R(x, 2, 0, 1, 1, c); }));
        const fall = id !== 'summer', sp = id === 'winter' ? { min: 14, max: 30 } : { min: 10, max: 19 };
        fx.emitter = put(this.world, this.add.particles(0, 0, tex.key, fall
          ? { frame: tex.frame, x: { min: -20, max: vw + 20 }, y: -6, speedY: sp, speedX: { min: -6, max: 6 }, lifespan: ((vh + 30) / sp.min) * 1000, frequency: (((vh + 30) / ((sp.min + sp.max) / 2)) * 1000) / (id === 'winter' ? 34 : 28), alpha: id === 'winter' ? 0.7 : 1, advance: 20000 }
          : { frame: tex.frame, x: { min: 0, max: vw }, y: { min: 0, max: vh }, speedX: { min: -10, max: 10 }, speedY: { min: -6, max: 6 }, lifespan: 5000, frequency: 500, alpha: { start: 1, end: 0 }, advance: 5000 }));
        fx.emitter.setScrollFactor(0).setDepth(0.8);
      }
      // evening: dark veil + stepped lantern glow
      this.veil.setVisible(!!night).setDisplaySize(vw + 2, vh + 2);
      const g = this.glow; g.clear(); if (!night) return;
      const ring = (cx, cy, rx, ry, a) => { g.fillStyle(0xffc86e, a); for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); } };
      for (const o of this.lanterns) { const X = o.x * T + 8, Y = o.y * T - 6; ring(X, Y, 26, 20, 0.1); ring(X, Y, 15, 12, 0.14); ring(X, Y, 6, 5, 0.2); }
    }

    drawWater(t, cam, vw, vh) {
      const w = this.water; w.clear();
      const x0 = Math.floor(cam.scrollX / T) - 1, x1 = Math.ceil((cam.scrollX + vw) / T), y0 = Math.floor(cam.scrollY / T) - 1, y1 = Math.ceil((cam.scrollY + vh) / T);
      for (const [x, y] of this.waterTiles) {
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const ph = (t * 0.9 + WD.hash(x, y) * 7) % 3; if (ph > 1.2) continue;
        w.fillStyle(rgba(ph < 0.6 ? TG.pixel.K.foam : TG.pixel.K.waterL)[0], 1);
        w.fillRect(x * T + 3 + Math.floor(WD.hash(y, x) * 9), y * T + 4 + Math.floor(WD.hash(x + 1, y) * 9), ph < 0.6 ? 3 : 2, 1);
      }
    }

    /** Level box + name box over a player, an optional title above, and a speech bubble above that. */
    tag(d, g) {
      const [x, y] = this.S(d.x, d.y), fs = this.fontPx(), u = Math.max(1, Math.round(fs / 10));
      const pad = Math.round(fs * 0.45), th = fs + u * 4, gap = u * 3;
      const lv = this.text(d.id + ':lv', String(d.level || 1), 0, 0, { outline: null, color: '#3a2600' }), nm = this.text(d.id + ':nm', d.name || '?', 0, 0, { outline: null, color: '#ffffff' });
      const lvW = Math.ceil(lv.width) + pad * 2, nmW = Math.ceil(nm.width) + pad * 2, X0 = Math.round(x - (lvW + gap + nmW) / 2), Y = Math.round(y - th / 2);
      const box = (bx, w, bg, top, t) => {
        g.fillStyle(rgba(DARK)[0], 1); g.fillRect(bx - u, Y - u, w + u * 2, th + u * 2);
        g.fillStyle(rgba(bg)[0], 1); g.fillRect(bx, Y, w, th); g.fillStyle(rgba(top)[0], 1); g.fillRect(bx, Y, w, u);
        t.setPosition(Math.round(bx + w / 2), Math.round(Y + th / 2 + u / 2));
      };
      box(X0, lvW, '#f7c646', '#ffe58f', lv);
      box(X0 + lvW + gap, nmW, d.mine ? '#3f76db' : '#5a3a22', d.mine ? '#7fa6ee' : '#8a5a33', nm);
      let top = Y;
      if (d.title) { top = Y - th - u * 2; this.text(d.id + ':ti', '★ ' + d.title, x, top + th / 2, { color: '#f7c646' }); }
      if (!d.bubble) return;
      const a = d.bubbleAlpha ?? 1, bt = this.text(d.id + ':bb', d.bubble, 0, 0, { outline: null, color: DARK, alpha: a });
      const bw2 = Math.ceil(bt.width) + fs * 1.4, bh2 = fs + u * 8, BX = Math.round(x - bw2 / 2), BY = Math.round(top - bh2 - u * 8);
      g.fillStyle(rgba(DARK)[0], a); g.fillRect(BX - u, BY - u, bw2 + u * 2, bh2 + u * 2); g.fillRect(Math.round(x - u * 3), BY + bh2, u * 6, u * 3); g.fillRect(Math.round(x - u), BY + bh2 + u * 3, u * 2, u * 2);
      g.fillStyle(0xfff8e6, a); g.fillRect(BX, BY, bw2, bh2); g.fillRect(Math.round(x - u * 2), BY + bh2, u * 4, u * 2);
      bt.setPosition(Math.round(x), Math.round(BY + bh2 / 2 + u / 2)).setDepth(3);
    }

    /** Arrows, the race pointer, a puff of smoke, the tap ring and flying arrows, in screen pixels. */
    mark(d, g, t) {
      const k = this.m.k, [x, y] = this.S(d.x, d.y), pn = performance.now();
      const tri = (pts, col, ang = 0, cx = 0, cy = 0) => {
        const c = Math.cos(ang), s = Math.sin(ang), p = pts.map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
        g.fillStyle(rgba(col)[0], 1); g.fillTriangle(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
      };
      if (d.kind === 'arrow') { // the tutorial points where to go: a bouncing arrow over the spot
        const bob = Math.round(Math.abs(Math.sin(pn / 220)) * 4) * k, r = 6 * k;
        tri([[x, y + r + k + bob], [x - r - k, y - r * 0.4 + bob], [x + r + k, y - r * 0.4 + bob]], DARK);
        tri([[x, y + r - k + bob], [x - r + k, y - r * 0.4 + k + bob], [x + r - k, y - r * 0.4 + k + bob]], '#f7c646');
        if (d.label) this.text(d.id + ':l', d.label, x, y - r - 2 * k + bob, { s: 0.9 });
      } else if (d.kind === 'compass' || d.kind === 'raceArrow') { // which way to go, circling over your head
        const rr = 7 * k, cx = d.kind === 'compass' ? x + Math.cos(d.ang) * 10 * k : x, cy = d.kind === 'compass' ? y + Math.sin(d.ang) * 6 * k : y;
        tri([[rr + k, 0], [-rr * 0.6, -rr * 0.75], [-rr * 0.6, rr * 0.75]], DARK, d.ang, cx, cy);
        tri([[rr - k, 0], [-rr * 0.4, -rr * 0.5], [-rr * 0.4, rr * 0.5]], d.color || '#7fe07a', d.ang, cx, cy);
      } else if (d.kind === 'poof') { // a pixel puff of smoke, q from 0 to 1
        const q = d.q, r = (3 + q * 9) * k, a = 1 - q;
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + q, px0 = Math.round(x + Math.cos(ang) * r), py0 = Math.round(y + Math.sin(ang) * r * 0.7), sz = Math.round((4 - q * 2) * k);
          g.fillStyle(rgba(DARK)[0], 0.5 * a); g.fillRect(px0 - sz / 2 - k, py0 - sz / 2 - k, sz + 2 * k, sz + 2 * k);
          g.fillStyle(0xffffff, a); g.fillRect(px0 - sz / 2, py0 - sz / 2, sz, sz);
        }
        if (q < 0.5) { g.fillStyle(0xf7c646, 1 - q * 2); for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) g.fillRect(Math.round(x + dx * r * 0.5 - k), Math.round(y + dy * r * 0.5 - k), 2 * k, 2 * k); }
      } else if (d.kind === 'ring') { // where you tapped
        const q = d.q; g.lineStyle(Math.max(2, k), 0xffffff, 1 - q);
        g.strokeRect(Math.round(x - (4 + q * 6) * k), Math.round(y - (2 + q * 2) * k), Math.round((8 + q * 12) * k), Math.round((4 + q * 4) * k));
      } else if (d.kind === 'shaft') { // a whistling arrow in flight
        const [x2, y2] = this.S(d.x2, d.y2);
        g.lineStyle(Math.max(2, k * 0.8), 0x3a2516, 1); g.lineBetween(x, y, x2, y2);
        g.fillStyle(0xf7c646, 1); g.fillRect(x - k, y - k, k * 2, k * 2);
      }
    }
  }

  let gl = null;
  /** WebGL on a real graphics chip; software-only WebGL (no GPU: SwiftShader, llvmpipe) is slower than plain canvas, so use Canvas there. */
  const webgl = () => {
    if (gl !== null) return gl;
    try {
      const c = document.createElement('canvas'), x = c.getContext('webgl2') || c.getContext('webgl'), ext = x && x.getExtension('WEBGL_debug_renderer_info');
      gl = !!x && !(ext && /swiftshader|llvmpipe|software/i.test(x.getParameter(ext.UNMASKED_RENDERER_WEBGL)));
      if (x && x.getExtension('WEBGL_lose_context')) x.getExtension('WEBGL_lose_context').loseContext();
    } catch (e) { gl = false; }
    return gl;
  };

  /** Start the engine on the village's canvas. hooks: tick(dt), model(t) -> frame, paused(), pointer(type, p), mini(). */
  function mount(canvas, hooks) {
    const m = measure(canvas.parentElement);
    const scene = new VillageScene(hooks, m);
    const game = new Phaser.Game({
      type: webgl() ? Phaser.WEBGL : Phaser.CANVAS, canvas, // a game on our own canvas must name its renderer
      parent: null, width: m.devW, height: m.devH, zoom: 1 / m.dpr, pixelArt: true, roundPixels: false, backgroundColor: '#76b947', // the view snaps to whole screen pixels itself
      banner: false, input: { keyboard: false, activePointers: 3 }, scale: { mode: Phaser.Scale.NONE }, audio: { noAudio: true }, scene: [scene],
    });
    const onResize = () => { const nm = measure(canvas.parentElement); Object.assign(scene.m, nm); if (scene.sys && scene.sys.isActive()) scene.applySize(); };
    window.addEventListener('resize', onResize);
    games++;
    const view = {
      game, scene, k: () => scene.m.k,
      /** The part of the map on screen, in art px. */
      /** For tests: a point on the hands-on task stage, in CSS pixels. */
      taskToCss: (x, y) => TG.tasks && TG.tasks.toCss(x, y),
      fx: () => ({ season: scene.sfx ? scene.sfx.season : null, emitters: scene.sfx && scene.sfx.emitter ? 1 : 0, night: !!(scene.veil && scene.veil.visible) }),
      viewport: () => { const c = scene.cameras && scene.cameras.main; return c ? { x: c.scrollX, y: c.scrollY, w: scene.m.devW / c.zoom, h: scene.m.devH / c.zoom } : { x: 0, y: 0, w: 0, h: 0 }; },
      destroy() { window.removeEventListener('resize', onResize); if (TG.tasks) TG.tasks.abort(); if (cur === view) cur = null; games--; game.destroy(false); },
    };
    cur = view;
    return view;
  }

  TG.villageView = { mount, current: () => cur, count: () => games };
})(window.TG);
