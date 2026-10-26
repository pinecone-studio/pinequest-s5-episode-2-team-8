/* First-person aimag trips, part 2: the engine. A small WebGL voxel renderer (no libraries) with Minecraft-style
   movement: mouse look, WASD, Space jump with gravity, sprint (Shift / Ctrl / double-tap W), auto-jump, swimming.
   E or right-click talks to or looks at whatever you are facing. Phones get a joystick, drag-to-look and buttons. */
(function (TG) {
  const { h, L } = TG;
  const W8 = () => TG.fpworld;
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  // ---------------------------------------------------------------- tiny matrix helpers (column-major)
  const persp = (fovy, asp, n, f) => { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]); };
  function lookAt(e, c) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;                       // up = (0,1,0)
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }
  const mul = (a, b) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };

  const VS = 'attribute vec3 a_p;attribute vec2 a_uv;attribute float a_l;uniform mat4 u_mvp;uniform vec3 u_cam;uniform vec3 u_off;varying vec2 v_uv;varying float v_l;varying float v_d;void main(){vec3 p=a_p+u_off;gl_Position=u_mvp*vec4(p,1.0);v_uv=a_uv;v_l=a_l;v_d=distance(p,u_cam);}';
  const FS = 'precision mediump float;uniform sampler2D u_tex;uniform vec3 u_fog;uniform vec2 u_fr;uniform float u_a;varying vec2 v_uv;varying float v_l;varying float v_d;void main(){vec4 c=texture2D(u_tex,v_uv);if(c.a<0.5)discard;float f=clamp((v_d-u_fr.x)/(u_fr.y-u_fr.x),0.0,1.0);gl_FragColor=vec4(mix(c.rgb*v_l,u_fog,f),u_a);}';
  const SKY_VS = 'attribute vec2 a_p;varying float v_y;void main(){v_y=a_p.y;gl_Position=vec4(a_p,0.999,1.0);}';
  const SKY_FS = 'precision mediump float;uniform float u_h;uniform vec3 u_lo;uniform vec3 u_hi;varying float v_y;void main(){float t=smoothstep(u_h,u_h+1.3,v_y);gl_FragColor=vec4(mix(u_lo,u_hi,t),1.0);}';

  function program(gl, vs, fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const supported = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } };

  // ---------------------------------------------------------------- meshing: visible faces only, with Minecraft-style corner shading (ambient occlusion)
  const FACES = [ // normal, 4 corners (counter-clockwise from outside), shade, texture slot (0 top, 1 side, 2 bottom)
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.82, t: 1 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.7, t: 1 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.9, t: 1 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.62, t: 1 },
  ];
  function buildMesh(world) {
    const { X, Z, YS, get, BLOCKS } = world, ATL = 16, U = 1 / ATL, EPS = 0.002;
    const solidB = (b) => b && BLOCKS[b].solid && !BLOCKS[b].cut;
    const occ = (x, y, z) => (y < 4 ? 1 : solidB(get(x, y, z)) ? 1 : 0);
    const opq = [], wat = [];
    const uvOf = (tex) => [(tex % ATL) * U + EPS, Math.floor(tex / ATL) * U + EPS, ((tex % ATL) + 1) * U - EPS, (Math.floor(tex / ATL) + 1) * U - EPS];
    const quad = (out, p, uv, l, flip) => { // two triangles; flip the diagonal so the shading has no seams
      const [u0, v0, u1, v1] = uv, uvs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const i of order) out.push(p[i][0], p[i][1], p[i][2], uvs[i][0], uvs[i][1], l[i]);
    };
    for (let y = 4; y < YS; y++) for (let z = 0; z < Z; z++) for (let x = 0; x < X; x++) {
      const b = get(x, y, z); if (!b) continue;
      const B = BLOCKS[b];
      if (!B.solid && B.cut) { // plants (wheat, reeds): two crossing quads
        const uv = uvOf(B.tex[1]), l = [0.9, 0.9, 0.9, 0.9];
        quad(opq, [[x + 0.15, y, z + 0.15], [x + 0.85, y, z + 0.85], [x + 0.85, y + 1, z + 0.85], [x + 0.15, y + 1, z + 0.15]], uv, l);
        quad(opq, [[x + 0.85, y, z + 0.15], [x + 0.15, y, z + 0.85], [x + 0.15, y + 1, z + 0.85], [x + 0.85, y + 1, z + 0.15]], uv, l);
        continue;
      }
      for (const F of FACES) {
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2], nb = get(nx, ny, nz), N = nb ? BLOCKS[nb] : null;
        if (B.water) { if (nb && (N.water || N.solid)) continue; if (F.n[1] === -1) continue; }
        else if (N && N.solid && !N.cut) continue;
        else if (N && N.cut && nb === b) continue;
        const pts = F.c.map(([cx, cy, cz]) => [x + cx, y + (B.water && cy === 1 && !(get(x, y + 1, z) && BLOCKS[get(x, y + 1, z)].water) ? 0.86 : cy), z + cz]);
        let l;
        if (B.water) l = [F.s, F.s, F.s, F.s];
        else l = F.c.map(([cx, cy, cz]) => { // corner occlusion from the 3 blocks touching this corner, in front of the face
          const ax = F.n[0] ? [0, 1, 2].filter((k) => !F.n[k]) : F.n[1] ? [0, 2] : [0, 1];
          const d = [cx * 2 - 1, cy * 2 - 1, cz * 2 - 1], o1 = [0, 0, 0], o2 = [0, 0, 0]; o1[ax[0]] = d[ax[0]]; o2[ax[1]] = d[ax[1]];
          const s1 = occ(nx + o1[0], ny + o1[1], nz + o1[2]), s2 = occ(nx + o2[0], ny + o2[1], nz + o2[2]), cc = occ(nx + o1[0] + o2[0], ny + o1[1] + o2[1], nz + o1[2] + o2[2]);
          const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          return F.s * [0.52, 0.68, 0.84, 1][ao];
        });
        quad(B.water ? wat : opq, pts, uvOf(B.tex[F.t]), l, l[0] + l[2] < l[1] + l[3]);
      }
    }
    return { opq: new Float32Array(opq), wat: new Float32Array(wat) };
  }
  function cloudMesh(world) {
    const ci = W8().tex.cloud, uv = [(ci % 16) / 16 + 0.002, Math.floor(ci / 16) / 16 + 0.002, (ci % 16 + 1) / 16 - 0.002, (Math.floor(ci / 16) + 1) / 16 - 0.002], out = [];   // flat white
    const hs = W8().hash, cell = 6, y = world.G + 34;
    for (let gz = -12; gz < world.Z / cell + 12; gz++) for (let gx = -24; gx < world.X / cell + 24; gx++) {
      if (hs(gx, gz, 77) > 0.24) continue;
      const x0 = gx * cell, z0 = gz * cell, x1 = x0 + cell * (1 + Math.floor(hs(gx, gz, 5) * 2)), z1 = z0 + cell;
      for (const [yy, l, cs] of [[y + 2, 1, [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]], [y, 0.8, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]]]) {
        const p = cs.map(([a, b]) => [a, yy, b]), uvs = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]];
        for (const i of [0, 1, 2, 0, 2, 3]) out.push(p[i][0], p[i][1], p[i][2], uvs[i][0], uvs[i][1], l);
      }
    }
    return new Float32Array(out);
  }

  // ---------------------------------------------------------------- the trip
  /** cfg: like TG.scene.open, plus map (the province map). Positions in cfg (things, start, actors) are in 2D map pixels. */
  function open(cfg) {
    const WF = W8(), world = cfg.world || WF.create(cfg.map), PXB = cfg.scale || WF.TILE / TG.travel.TS, M = world.M;   // cfg.scale: blocks per unit of the caller's coordinates
    const toB = (px, py) => [M + px * PXB, M + py * PXB];
    const cv = h('canvas', { class: 'fp-cv' }), hud = h('canvas', { class: 'fp-hud' });
    const gl = cv.getContext('webgl', { antialias: false, alpha: false }) || cv.getContext('experimental-webgl');
    if (!gl) return null;
    const info = h('div', { class: 'scene-info px-frame' }), act = h('button', { class: 'btn primary scene-act', disabled: true });
    const jump = h('button', { class: 'scene-jump px-frame', 'aria-label': L('Үсрэх', 'Jump') }, '⤒');
    const runBtn = h('button', { class: 'scene-run px-frame', 'aria-label': L('Гүйх', 'Run'), 'aria-pressed': 'false' }, '🏃');
    const back = h('button', { class: 'scene-x px-frame', 'aria-label': L('Гарах', 'Leave') }, '✕');
    const mini = cfg.mini ? h('canvas', { class: 'scene-mini px-frame', width: cfg.mini.w, height: cfg.mini.h }) : null;
    const tip = h('div', { class: 'fp-tip px-frame' }, coarse() ? L('Зүүн талд чирж алхана, баруун талд чирж эргэж харна.', 'Drag on the left to walk, drag on the right to look around.') : L('Дэлгэц дээр дарж хулганаар эргэн харна · WASD алхах · Space үсрэх · Shift гүйх · E харилцах · Esc хулгана чөлөөлөх', 'Click to look around with the mouse · WASD walk · Space jump · Shift sprint · E interact · Esc frees the mouse'));
    const stick = h('div', { class: 'fp-stick' }, h('i'));
    const root = h('div', { class: 'fscene fp ' + (cfg.cls || '') }, cv, hud,
      h('div', { class: 'scene-top' }, back, h('div', { class: 'scene-title px-frame' }, h('b', null, cfg.title), cfg.sub ? h('small', null, cfg.sub) : null), cfg.right || null),
      mini, tip, stick,
      h('div', { class: 'scene-bottom' }, info, h('div', { class: 'scene-btns' }, ...(cfg.buttons || []), runBtn, jump, act)));
    // GL resources
    const prog = program(gl, VS, FS), sky = program(gl, SKY_VS, SKY_FS);
    const loc = (n) => gl.getUniformLocation(prog, n), A = { p: gl.getAttribLocation(prog, 'a_p'), uv: gl.getAttribLocation(prog, 'a_uv'), l: gl.getAttribLocation(prog, 'a_l') };
    const U = { mvp: loc('u_mvp'), cam: loc('u_cam'), off: loc('u_off'), tex: loc('u_tex'), fog: loc('u_fog'), fr: loc('u_fr'), a: loc('u_a') };
    const texFrom = (canvas) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST); for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); return t; };
    const atlasTex = texFrom(WF.atlas());
    const mesh = buildMesh(world), clouds = cloudMesh(world);
    const vbo = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return { b, n: data.length / 6 }; };
    const opq = vbo(mesh.opq), wat = vbo(mesh.wat), cld = vbo(clouds), spriteBuf = gl.createBuffer();
    const skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const spriteTex = new Map(), texOf = (canvas) => { if (!spriteTex.has(canvas)) spriteTex.set(canvas, texFrom(canvas)); return spriteTex.get(canvas); };
    const sunCanvas = (() => { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#fff6c8'; x.fillRect(0, 0, 8, 8); x.fillStyle = '#ffffff'; x.fillRect(2, 2, 4, 4); return c; })();
    const moonCanvas = (() => { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#dfe6f5'; x.fillRect(1, 1, 6, 6); x.fillStyle = '#b9c3da'; x.fillRect(2, 3, 2, 2); x.fillRect(5, 5, 1, 1); return c; })();
    // the same season and clock as the top view (cfg.season lets Нутаг pass the season it is showing)
    const season = () => (cfg.season ? cfg.season() : TG.seasons && TG.seasons.current().id);
    const isNight = () => !!(TG.seasons && TG.seasons.night && TG.seasons.night());
    const snowing = (cfg.map && cfg.map.snow) || season() === 'winter';
    const DAY = snowing ? { lo: [0.86, 0.9, 0.95], hi: [0.55, 0.68, 0.85] } : (cfg.map && cfg.map.desert) ? { lo: [0.93, 0.86, 0.72], hi: [0.36, 0.62, 0.92] } : { lo: [0.78, 0.88, 0.97], hi: [0.3, 0.56, 0.92] };
    const NIGHT = { lo: [0.16, 0.18, 0.34], hi: [0.03, 0.04, 0.13] };
    let SKY = DAY, FOG = SKY.lo; const FAR = 150;

    // the player (block units: x east, z south, y up)
    const [sx0, sz0] = toB(cfg.start.x, cfg.start.y);
    const P = { x: sx0, z: sz0, y: world.groundAt(sx0, sz0) + 0.01, vx: 0, vy: 0, vz: 0, ground: false, yaw: Math.PI / 2, pitch: -0.08, fov: 1.25, bob: 0, sprint: false, inWater: false };
    const keys = new Set(); let runLock = false, lastW = 0, locked = false, raf = 0, last = performance.now(), closed = false, near = null, look = [0, 0], move = [0, 0];
    const solidAt = (x, y, z) => { const b = world.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b && world.BLOCKS[b].solid; };
    const waterAt = (x, y, z) => { const b = world.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b && world.BLOCKS[b].water; };
    const HW = 0.3, HT = 1.8;
    const hits = (x, y, z) => { for (let bx = Math.floor(x - HW); bx <= Math.floor(x + HW); bx++) for (let by = Math.floor(y); by <= Math.floor(y + HT - 0.01); by++) for (let bz = Math.floor(z - HW); bz <= Math.floor(z + HW); bz++) if (solidAt(bx, by, bz)) return true; return false; };
    function moveAxis(ax, d) {
      const n = Math.ceil(Math.abs(d) / 0.1); if (!n) return false;
      const st = d / n;
      for (let i = 0; i < n; i++) {
        const nx = P.x + (ax === 0 ? st : 0), ny = P.y + (ax === 1 ? st : 0), nz = P.z + (ax === 2 ? st : 0);
        if (hits(nx, ny, nz)) return true;
        P.x = nx; P.y = ny; P.z = nz;
      }
      return false;
    }
    const doJump = () => { if (P.ground) { P.vy = 8.6; P.ground = false; } else if (P.inWater) P.vy = 4; };
    function physics(dt) {
      for (let i = 0; i < 24 && hits(P.x, P.y, P.z); i++) P.y += 1;                // placed inside something: step up out of it
      // movement wish, relative to where you look
      let f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0) + move[1], s = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + move[0];
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      P.sprint = f > 0.3 && (P.sprint || keys.has('shift') || keys.has('ctrl') || runLock);
      if (f <= 0.3) P.sprint = false;
      P.inWater = waterAt(P.x, P.y + 0.4, P.z);
      const riding = cfg.riding && cfg.riding();
      const speed = P.inWater ? 2.2 : (P.sprint ? 5.6 : 4.3) * (riding ? 1.7 : 1);    // Minecraft's walk and sprint speeds (blocks per second); a horse is faster
      const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
      const tvx = (fx * f + rx * s) * speed, tvz = (fz * f + rz * s) * speed, acc = Math.min(1, dt * (P.ground ? 14 : 3.5));
      P.vx += (tvx - P.vx) * acc; P.vz += (tvz - P.vz) * acc;
      if (keys.has(' ') && P.inWater) P.vy = Math.min(P.vy + 30 * dt, 3.5);
      P.vy -= (P.inWater ? 9 : 28) * dt; P.vy = Math.max(P.vy, P.inWater ? -3 : -40);
      const bx = moveAxis(0, P.vx * dt), bz = moveAxis(2, P.vz * dt);
      if ((bx || bz) && P.ground && (Math.abs(tvx) + Math.abs(tvz) > 0.5) && !hits(P.x + Math.sign(P.vx) * 0.35, P.y + 1.05, P.z + Math.sign(P.vz) * 0.35)) P.vy = 8.6;   // auto-jump up one block
      if (bx) P.vx = 0; if (bz) P.vz = 0;
      const wasDown = P.vy < 0; P.ground = false;
      if (moveAxis(1, P.vy * dt)) { if (wasDown) P.ground = true; P.vy = 0; }
      if (P.y < 2) { P.y = world.groundAt(P.x, P.z) + 1; P.vy = 0; }              // fell out of the world: back on the ground
      const moving = Math.hypot(P.vx, P.vz);
      P.bob += P.ground ? moving * dt * 1.9 : 0;
      P.fov += ((P.sprint ? 1.4 : 1.25) - P.fov) * Math.min(1, dt * 8);             // the view widens when you sprint
    }
    // things you can use, in block space (their positions come from the 2D map, and animals keep moving)
    const tb = (t) => { const [x, z] = toB(t.x, t.y); return { x, z, y: world.groundAt(x, z) }; };
    function pick() {
      const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bs = 1e9;
      for (const t of cfg.things) {
        const p = tb(t), dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
        if (d > 4.5) continue;
        const cos = d < 0.01 ? 1 : (dx * fx + dz * fz) / d;
        if (d > 1.7 && cos < 0.82) continue;                                         // must be facing it, unless right next to it
        const sc = d * (2 - cos) + (t.penalty ? 3 : 0);
        if (sc < bs) { bs = sc; best = t; }
      }
      return best;
    }
    const interact = () => { if (near) near.run(); };
    // input
    const KEYM = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd', Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', ControlLeft: 'ctrl', ControlRight: 'ctrl' };
    const busy = (e) => document.querySelector('.modal-back') || (TG.scene && TG.scene.active()) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '');
    const kd = (e) => {
      if (busy(e)) return;
      const k = KEYM[e.code];
      if (k) {
        e.preventDefault(); e.stopPropagation();
        if (k === 'w' && !e.repeat) { const n = performance.now(); if (n - lastW < 300) P.sprint = true; lastW = n; }   // double-tap W to sprint
        keys.add(k); if (k === ' ' && !e.repeat) doJump();
      } else if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) interact(); }
      else if (cfg.onKey && !e.repeat && cfg.onKey(e.code)) { e.preventDefault(); e.stopPropagation(); }
      else if (e.code === 'Escape' && !locked) { e.preventDefault(); api.close(); }
    };
    const ku = (e) => { const k = KEYM[e.code]; if (k) keys.delete(k); };
    const blur = () => keys.clear();
    const onLock = () => { locked = document.pointerLockElement === cv; root.classList.toggle('locked', locked); };
    const onMouse = (e) => { if (!locked) return; P.yaw += e.movementX * 0.0026; P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * 0.0026)); };
    cv.addEventListener('mousedown', (e) => {
      if (coarse()) return;
      if (!locked) { tip.classList.add('gone'); try { const r = cv.requestPointerLock && cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed here */ } return; }
      if (cfg.onPrimary && e.button === 0 && cfg.onPrimary(api)) return;              // a battle: left click shoots
      interact();                                                                     // otherwise a click uses what you face
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // touch: left half = joystick, right half = look
    // listened for on the whole screen, so a thumb that lands on the info box still walks; only buttons and the map keep their taps
    const touches = new Map();
    const ownTap = (e) => e.target.closest && e.target.closest('button, a, input, select, .scene-mini');
    root.addEventListener('touchstart', (e) => { if (ownTap(e)) return; if (e.cancelable) e.preventDefault(); tip.classList.add('gone'); for (const t of e.changedTouches) { const left = t.clientX < innerWidth * 0.45; touches.set(t.identifier, { left, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, onInfo: info.contains(e.target), far: false }); if (left) { stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px'; stick.classList.add('on'); } } }, { passive: false });
    root.addEventListener('touchmove', (e) => { if (!touches.size) return; if (e.cancelable) e.preventDefault(); for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (!s) continue; if (Math.hypot(t.clientX - s.x0, t.clientY - s.y0) > 10) s.far = true; if (s.left) { const dx = t.clientX - s.x0, dy = t.clientY - s.y0, d = Math.min(1, Math.hypot(dx, dy) / 50); const a = Math.atan2(dy, dx); move = [Math.cos(a) * d, -Math.sin(a) * d]; stick.firstChild.style.transform = `translate(${Math.cos(a) * d * 26}px, ${Math.sin(a) * d * 26}px)`; } else { P.yaw += (t.clientX - s.x) * 0.006; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - (t.clientY - s.y) * 0.006)); s.x = t.clientX; s.y = t.clientY; } } }, { passive: false });
    const tend = (e) => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s && s.left) { move = [0, 0]; stick.classList.remove('on'); stick.firstChild.style.transform = ''; } if (s && s.onInfo && !s.far && e.type === 'touchend') info.classList.toggle('min'); touches.delete(t.identifier); } }; // a still tap on the info box folds it, as a click would
    root.addEventListener('touchend', tend); root.addEventListener('touchcancel', tend);
    act.addEventListener('click', () => { act.blur(); interact(); });
    jump.addEventListener('click', () => { jump.blur(); doJump(); });
    runBtn.addEventListener('click', () => { runBtn.blur(); runLock = !runLock; runBtn.classList.toggle('on', runLock); runBtn.setAttribute('aria-pressed', String(runLock)); });
    back.addEventListener('click', () => api.close());
    info.addEventListener('click', (e) => { if (!e.target.closest('button')) info.classList.toggle('min'); });
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true); window.addEventListener('blur', blur);
    document.addEventListener('pointerlockchange', onLock); document.addEventListener('mousemove', onMouse);

    // drawing
    let dpr = 1;
    function resize() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(root.clientWidth * dpr); cv.height = Math.round(root.clientHeight * dpr); hud.width = cv.width; hud.height = cv.height; }
    const bindAttrs = () => { const S = 24; gl.enableVertexAttribArray(A.p); gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, S, 0); gl.enableVertexAttribArray(A.uv); gl.vertexAttribPointer(A.uv, 2, gl.FLOAT, false, S, 12); gl.enableVertexAttribArray(A.l); gl.vertexAttribPointer(A.l, 1, gl.FLOAT, false, S, 20); };
    const drawBuf = (buf, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); bindAttrs(); gl.drawArrays(gl.TRIANGLES, 0, n); };
    let viewProj = null, eye = [0, 0, 0];
    function render(t) {
      const asp = cv.width / cv.height, riding = cfg.riding && cfg.riding(), bob = P.ground ? Math.sin(P.bob * 2) * (riding ? 0.12 : 0.05) : 0;
      eye = [P.x, P.y + (riding ? 2.55 : 1.62) + bob, P.z];
      SKY = isNight() ? NIGHT : DAY; FOG = SKY.lo;
      const fwd = [Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)];
      viewProj = mul(persp(P.fov, asp, 0.05, 260), lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]]));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(FOG[0], FOG[1], FOG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // sky gradient, with the horizon where the camera sees it
      gl.useProgram(sky); gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(gl.getUniformLocation(sky, 'u_h'), -Math.tan(P.pitch) / Math.tan(P.fov / 2)); gl.uniform3fv(gl.getUniformLocation(sky, 'u_lo'), SKY.lo); gl.uniform3fv(gl.getUniformLocation(sky, 'u_hi'), SKY.hi);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); const sp = gl.getAttribLocation(sky, 'a_p'); gl.enableVertexAttribArray(sp); gl.vertexAttribPointer(sp, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(sp);
      gl.useProgram(prog); gl.enable(gl.DEPTH_TEST); gl.uniformMatrix4fv(U.mvp, false, viewProj); gl.uniform3fv(U.cam, eye); gl.uniform3fv(U.fog, FOG); gl.uniform1i(U.tex, 0); gl.activeTexture(gl.TEXTURE0);
      // the sun (or the moon at night), far away and unfogged
      gl.uniform2f(U.fr, 1e5, 2e5); gl.uniform1f(U.a, 1); gl.uniform3f(U.off, 0, 0, 0); gl.depthMask(false);
      billboard(texOf(SKY === NIGHT ? moonCanvas : sunCanvas),eye[0] + 70, eye[1] + 95, eye[2] - 110, 16, 16, false, 1, true);
      gl.depthMask(true);
      // the land
      gl.uniform2f(U.fr, FAR * 0.38, FAR); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1f(U.a, 1);
      drawBuf(opq.b, opq.n);
      // people and animals (sprites that turn to face you)
      for (const s of sprites(t)) billboard(texOf(s.img), s.x, s.y, s.z, s.w, s.h, s.flip, s.l || 1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      // water and clouds, see-through
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform1f(U.a, 0.78); drawBuf(wat.b, wat.n);
      gl.uniform1f(U.a, 0.82); gl.uniform3f(U.off, ((t * 1.1) % 300) - 150, 0, 0); gl.uniform2f(U.fr, FAR * 0.6, FAR * 1.4); drawBuf(cld.b, cld.n); gl.uniform3f(U.off, 0, 0, 0);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function billboard(tex, x, y, z, w, hh, flip, l = 1, faceCam) {
      let rx = Math.cos(P.yaw), rz = Math.sin(P.yaw), up = [0, hh, 0];
      if (faceCam) { const p = P.pitch; up = [-Math.sin(p) * Math.sin(P.yaw) * hh, Math.cos(p) * hh, Math.sin(p) * Math.cos(P.yaw) * hh]; }
      const hw = w / 2, a = [x - rx * hw, y, z - rz * hw], b = [x + rx * hw, y, z + rz * hw];
      const c = [b[0] + up[0], b[1] + up[1], b[2] + up[2]], d = [a[0] + up[0], a[1] + up[1], a[2] + up[2]];
      const u0 = flip ? 1 : 0, u1 = flip ? 0 : 1;
      const v = new Float32Array([...a, u0, 1, l, ...b, u1, 1, l, ...c, u1, 0, l, ...a, u0, 1, l, ...c, u1, 0, l, ...d, u0, 0, l]);
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuf); gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW); bindAttrs(); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    // Basar follows you; animals, people and the landmark's own creatures stand in the world
    const dog = { x: P.x - 1.2, z: P.z + 0.8 };
    const extra = world.sprites.map((s) => ({ ...s, img: s.kind === 'hunter' ? TG.pixel.char({ deel: 'brown', skin: '#D9A06E', hat: 'kazakh' }, 0, 0) : s.kind === 'eagle' ? null : TG.landmarks.critter(s.kind, 0) }));
    const eagleImg = (() => { const c = document.createElement('canvas'); c.width = 12; c.height = 12; const x = c.getContext('2d'); x.fillStyle = '#2b1e2e'; x.fillRect(3, 2, 6, 9); x.fillStyle = '#6b4220'; x.fillRect(4, 3, 4, 7); x.fillStyle = '#c99257'; x.fillRect(4, 0, 4, 3); x.fillStyle = '#f7c646'; x.fillRect(7, 1, 2, 1); return c; })();
    function sprites(t) {
      const out = [];
      for (const a of cfg.actors ? cfg.actors(t) : []) { const [x, z] = toB(a.x, a.y); out.push({ img: a.img, x, z, y: world.groundAt(x, z) + (a.lift || 0), h: a.h, w: a.h * (a.img.width / a.img.height), flip: a.flip }); }
      for (const s of extra) { const img = s.img || eagleImg, hh = { hunter: 1.8, eagle: 0.8, camel: 2.1, horse: 1.6, bear: 1.3, swan: 0.65, gull: 0.45, reindeer: 1.45, gazelle: 1.15 }[s.kind] || 1.2; out.push({ img, x: s.x + 0.5, z: s.z + 0.5, y: s.kind === 'eagle' ? world.G + 3 : world.groundAt(s.x, s.z), h: hh, w: hh * img.width / img.height }); }
      out.push({ img: TG.pixel.bankhar(Math.hypot(P.vx, P.vz) > 0.5 ? 1 + Math.floor(t * 8) % 2 : 3), x: dog.x, z: dog.z, y: world.groundAt(dog.x, dog.z), h: 0.95, w: 0.95 * 22 / 16 });
      // farthest first so see-through edges look right
      for (const s of out) s.d = (s.x - P.x) ** 2 + (s.z - P.z) ** 2;
      return out.sort((a, b) => b.d - a.d);
    }
    function overlay(t) { // crosshair, floating markers over people and places, what you're facing
      const x = hud.getContext('2d'), Wd = hud.width, Hd = hud.height; x.clearRect(0, 0, Wd, Hd);
      // season tint and evening darkness, matching the top view
      const sid = season();
      if (sid === 'winter') { x.fillStyle = 'rgba(235,242,250,.16)'; x.fillRect(0, 0, Wd, Hd); }
      else if (sid === 'autumn') { x.fillStyle = 'rgba(255,190,110,.14)'; x.fillRect(0, 0, Wd, Hd); }
      else if (sid === 'spring') { x.fillStyle = 'rgba(255,200,230,.06)'; x.fillRect(0, 0, Wd, Hd); }
      if (SKY === NIGHT) { x.fillStyle = 'rgba(18,22,70,.38)'; x.fillRect(0, 0, Wd, Hd); }
      if (cfg.riding && cfg.riding()) { // your horse’s neck, mane and ears in front of you, bobbing as it moves
        const u = Math.max(6, Math.round(Math.min(Wd, Hd) / 70)), bob = Math.round(Math.sin(P.bob * 2) * u), cxh = Wd / 2, by = Hd + u * 2 + bob;
        const coat = (cfg.horseCoat && cfg.horseCoat()) || '#8a5a33', dk = (cfg.horseMane && cfg.horseMane()) || '#2b1e14';
        x.fillStyle = '#2b1e2e'; x.fillRect(cxh - u * 7, by - u * 18, u * 14, u * 18);
        x.fillStyle = coat; x.fillRect(cxh - u * 6, by - u * 17, u * 12, u * 17);
        x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(cxh - u * 6, by - u * 17, u * 3, u * 17);
        x.fillStyle = dk; x.fillRect(cxh - u, by - u * 19, u * 2, u * 19); for (let i = 0; i < 6; i++) x.fillRect(cxh - u * 2 + (i % 2) * u * 3, by - u * (18 - i * 3), u, u * 2);   // mane
        x.fillStyle = '#2b1e2e'; x.fillRect(cxh - u * 5, by - u * 22, u * 3, u * 5); x.fillRect(cxh + u * 2, by - u * 22, u * 3, u * 5);
        x.fillStyle = coat; x.fillRect(cxh - u * 4, by - u * 21, u, u * 3); x.fillRect(cxh + u * 3, by - u * 21, u, u * 3);   // ears
      }
      if (cfg.overlay) cfg.overlay(x, (wx, wy, wz) => project(wx, wy, wz), t, dpr);
      const cx = Wd / 2, cy = Hd / 2, s = Math.round(9 * dpr);
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(cx - s, cy - dpr, s * 2, dpr * 2); x.fillRect(cx - dpr, cy - s, dpr * 2, s * 2);
      const proj = project;
      x.textAlign = 'center'; x.font = `800 ${Math.round(12 * dpr)}px Rubik, sans-serif`;
      for (const m of cfg.markers ? cfg.markers() : []) {
        const [bx, bz] = toB(m.x, m.y), p = proj(bx, world.groundAt(bx, bz) + (m.lift || 2.4) + Math.sin(t * 4) * 0.08, bz); if (!p || p[2] > 40) continue;
        const sz = Math.max(10, 26 - p[2] * 0.4) * dpr;
        if (m.c) { // a “!” (new task) or “?” style marker; markers without a colour are just a name tag
          x.fillStyle = '#2b1e2e'; x.fillRect(p[0] - sz * 0.18, p[1] - sz, sz * 0.36, sz * 0.75); x.fillRect(p[0] - sz * 0.18, p[1] - sz * 0.15, sz * 0.36, sz * 0.3);
          x.fillStyle = m.c; x.fillRect(p[0] - sz * 0.12, p[1] - sz * 0.94, sz * 0.24, sz * 0.63); x.fillRect(p[0] - sz * 0.12, p[1] - sz * 0.09, sz * 0.24, sz * 0.18);
        }
        if (m.label && p[2] < 16) { x.fillStyle = 'rgba(43,30,46,.7)'; const tw = x.measureText(m.label).width + 10 * dpr; x.fillRect(p[0] - tw / 2, p[1] - sz - 22 * dpr, tw, 17 * dpr); x.fillStyle = '#ffffff'; x.fillText(m.label, p[0], p[1] - sz - 9 * dpr); }
      }
      if (near) { x.font = `800 ${Math.round(14 * dpr)}px Rubik, sans-serif`; const label = near.label() + (coarse() ? '' : ' · E'), tw = x.measureText(label).width + 16 * dpr; x.fillStyle = 'rgba(43,30,46,.75)'; x.fillRect(cx - tw / 2, cy + 18 * dpr, tw, 24 * dpr); x.fillStyle = '#f7c646'; x.fillText(label, cx, cy + 35 * dpr); }
      if (snowing) { x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70; i++) { const fx = ((i * 97 + Math.sin(t + i) * 20 - P.yaw * 300) % Wd + Wd) % Wd, fy = ((i * 53 + t * (40 + (i % 5) * 12) * dpr) % Hd); x.fillRect(fx, fy, 2 * dpr, 2 * dpr); } }
      else if (sid === 'autumn' || sid === 'spring') { // falling leaves or blossom petals, like the top view
        const cols = sid === 'autumn' ? ['#e8752a', '#c9461e', '#f2b33d'] : ['#ffb7d5', '#ffffff', '#ff8fb1'], u = 2 * dpr;
        for (let i = 0; i < 40; i++) { const fx = ((i * 97 + Math.sin(t * 0.8 + i) * 30 - P.yaw * 300) % Wd + Wd) % Wd, fy = ((i * 53 + t * (24 + (i % 4) * 8) * dpr) % Hd); x.fillStyle = cols[i % 3]; x.fillRect(fx, fy, sid === 'autumn' ? u * 2 : u, u); }
      } else if (sid === 'summer' && Hd) { // butterflies fluttering low over the grass
        for (let i = 0; i < 10; i++) { const fx = ((i * 131 + Math.sin(t * 0.8 + i) * 40 - P.yaw * 300) % Wd + Wd) % Wd, fy = Hd * (0.62 + ((i * 37) % 30) / 100) + Math.sin(t * 1.7 + i) * 10 * dpr, u = 2 * dpr, on = Math.floor(t * 6 + i) % 2;
          x.fillStyle = '#ffffff'; x.fillRect(fx, fy, u, u); if (on) { x.fillStyle = i % 2 ? '#ffd34e' : '#b49cff'; x.fillRect(fx - u, fy, u, u); x.fillRect(fx + u, fy, u, u); } }
      }
    }
    function project(wx, wy, wz) { const m = viewProj, Wd = hud.width, Hd = hud.height, X = m[0] * wx + m[4] * wy + m[8] * wz + m[12], Y = m[1] * wx + m[5] * wy + m[9] * wz + m[13], Wc = m[3] * wx + m[7] * wy + m[11] * wz + m[15]; if (Wc <= 0.1) return null; return [(X / Wc * 0.5 + 0.5) * Wd, (1 - (Y / Wc * 0.5 + 0.5)) * Hd, Wc]; }
    function drawMini() {
      const m = mini.getContext('2d'), Mi = cfg.mini; m.imageSmoothingEnabled = false; m.drawImage(Mi.img, 0, 0, Mi.w, Mi.h);
      const s = Mi.w / cfg.W, px = (P.x - M) / PXB * s, pz = (P.z - M) / PXB * s;
      for (const d of Mi.dots ? Mi.dots() : []) { m.fillStyle = '#2b1e2e'; m.fillRect(Math.round(d.x * s) - 2, Math.round(d.y * s) - 2, 5, 5); m.fillStyle = d.c; m.fillRect(Math.round(d.x * s) - 1, Math.round(d.y * s) - 1, 3, 3); }
      m.strokeStyle = '#ffffff'; m.lineWidth = 2; m.beginPath(); m.moveTo(px, pz); m.lineTo(px + Math.sin(P.yaw) * 9, pz - Math.cos(P.yaw) * 9); m.stroke();
      m.fillStyle = '#e14b3d'; m.fillRect(Math.round(px) - 2, Math.round(pz) - 2, 5, 5);
    }
    function frame(ts) {
      if (closed) return;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      physics(dt);
      if (cfg.step) cfg.step(dt, ts);
      const dd = Math.hypot(P.x - 1.1 * Math.sin(P.yaw) - dog.x, P.z + 1.1 * Math.cos(P.yaw) - dog.z); // Basar trots behind you
      if (dd > 1.4) { const q = Math.min(1, dt * 3); dog.x += (P.x - Math.sin(P.yaw) * 1.4 - dog.x) * q; dog.z += (P.z + Math.cos(P.yaw) * 1.4 - dog.z) * q; }
      if (Math.hypot(P.x - dog.x, P.z - dog.z) > 8) { dog.x = P.x; dog.z = P.z + 1; }
      near = pick();
      act.disabled = !near; act.textContent = near ? near.label() + (coarse() ? '' : ' (E)') : (cfg.hint ? cfg.hint() : L('Ойртож харвал E', 'Face something and press E'));
      render(ts / 1000); overlay(ts / 1000); if (mini) drawMini();
      raf = requestAnimationFrame(frame);
    }
    // the player's position, in 2D map pixels, so the trip logic (and tests) can read and move it
    const me = {};
    Object.defineProperty(me, 'x', { get: () => (P.x - M) / PXB, set: (v) => { P.x = M + v * PXB; P.y = world.groundAt(P.x, P.z) + 0.01; P.vy = 0; } });
    Object.defineProperty(me, 'y', { get: () => (P.z - M) / PXB, set: (v) => { P.z = M + v * PXB; P.y = world.groundAt(P.x, P.z) + 0.01; P.vy = 0; } });
    Object.defineProperty(me, 'tx', { set: () => {}, get: () => (P.x - M) / PXB });
    Object.defineProperty(me, 'ty', { set: () => {}, get: () => (P.z - M) / PXB });
    const api = {
      me, root, info, P, world, stats: { verts: opq.n + wat.n },
      toB, eye: () => eye.slice(), dir: () => [Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)], unit: PXB,
      say: (...kids) => { info.classList.remove('min'); info.replaceChildren(...kids); },
      close() {
        if (closed) return; closed = true; cancelAnimationFrame(raf);
        window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize);
        document.removeEventListener('pointerlockchange', onLock); document.removeEventListener('mousemove', onMouse);
        if (document.pointerLockElement === cv && document.exitPointerLock) document.exitPointerLock();
        const lose = gl.getExtension('WEBGL_lose_context'); root.classList.add('out'); setTimeout(() => { root.remove(); if (lose) lose.loseContext(); }, 180);
        if (activeApi === api) activeApi = null;
        if (cfg.onClose) cfg.onClose();
      },
      near: () => near, interact, jump: doJump,
    };
    activeApi = api;
    if (cfg.info) api.say(...[].concat(cfg.info));
    const welcome = info.firstChild; setTimeout(() => { if (!closed && info.firstChild === welcome) info.classList.add('min'); tip.classList.add('gone'); }, 9000); // fold the welcome away so the view is clear
    document.body.appendChild(root);
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);
    return api;
  }
  let activeApi = null;
  TG.fp = { open, supported, active: () => activeApi };
})(window.TG);
