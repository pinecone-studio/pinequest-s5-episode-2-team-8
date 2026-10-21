/* Нутаг — the shared village: walk, garden together, fish, shop, dress up, quests, live multiplayer. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store, R = TG.vrules, WD = TG.vworld, T = WD.T;
  const SPEED = 4.3, ACCEL = 14, HW = 0.26, HH = 0.14; // tiles per second; feet hit-box half size
  const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]]; // down, left, right, up
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const Tx = (mn, en) => ({ mn, en });
  let live = null;

  // ================================================================ saved data (per child profile)
  function V() {
    const p = S.active(); if (!p) return null;
    const v = p.village || (p.village = {});
    const d = { id: 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), xp: 0, coins: 40, seeds: { carrot: 4, potato: 2 }, produce: {}, fish: {},
      owned: ['deel-blue'], look: { deel: 'blue', skin: R.SKINS[0], hat: null, face: null, neck: null, pet: null }, can: 5, water: 5, rod: 1, room: 'NUTAG',
      garden: [], quests: { d: '', list: [] }, pets: {}, seen: {}, tips: false, pos: null,
      lots: [], wr: { best: 0, champ: 0, wins: 0, losses: 0, pvpW: 0, pvpL: 0 }, ovoo: '' };
    for (const k in d) if (v[k] === undefined) v[k] = d[k];
    while (v.garden.length < R.PLOTS) v.garden.push(null);
    while (v.lots.length < R.LOTS) v.lots.push(null);
    return v;
  }
  const garden = () => (live && live.online && live.plots ? live.plots : V().garden);
  const lotsArr = () => (live && live.online && live.lots ? live.lots : V().lots);
  const myLot = () => lotsArr().findIndex((l) => l && l.by === V().id);
  const now = () => Date.now() + (live && live.online ? live.offset : 0);
  const lvl = () => R.level(V().xp).l;

  // ================================================================ rewards + quests (also used by the rest of Naadamy)
  function reward(coins, xp) {
    const v = V(); if (!v) return null;
    const before = R.level(v.xp).l;
    v.coins += coins; v.xp += xp; S.save();
    const after = R.level(v.xp).l;
    if (after > before) {
      setTimeout(() => { TG.sfx.win(); TG.confetti(80); TG.toast(`🎉 ${L('Түвшин ахилаа!', 'Level up!')} ${L('Түвшин', 'Level')} ${after}`); }, 400);
      net.send({ t: 'look', look: v.look, lvl: after });
    }
    if (live) hud();
    return { coins, xp, level: after > before ? after : 0 };
  }
  const QUESTS = {
    water: { n: 5, c: 20, x: 25, t: Tx('5 ургамал услах', 'Water 5 plants') },
    harvest: { n: 3, c: 25, x: 30, t: Tx('3 ургац хураах', 'Harvest 3 crops') },
    plant: { n: 4, c: 15, x: 20, t: Tx('4 үр тарих', 'Plant 4 seeds') },
    fish: { n: 2, c: 25, x: 30, t: Tx('2 загас барих', 'Catch 2 fish') },
    game: { n: 1, c: 20, x: 30, t: Tx('Naadamy-ийн 1 тоглоом тоглох', 'Play 1 Naadamy game') },
    together: { n: 1, c: 35, x: 45, t: Tx('Гэр бүлтэйгээ хамт 1 тоглоом тоглох', 'Play 1 game with family') },
    puzzle: { n: 2, c: 20, x: 30, t: Tx('Цэгцлэе!-ийн 2 түвшин дуусгах', 'Finish 2 puzzle levels') },
    pet: { n: 3, c: 10, x: 20, t: Tx('Хонийг 3 удаа илбэх', 'Pet the sheep 3 times') },
    sell: { n: 5, c: 15, x: 20, t: Tx('5 зүйл зарах', 'Sell 5 items') },
    help: { n: 2, c: 30, x: 40, t: Tx('Найзынхаа ургамлыг 2 удаа услах', "Water a friend's plants twice") },
  };
  const POOL = ['water', 'harvest', 'plant', 'fish', 'game', 'together', 'puzzle', 'pet', 'sell'];
  function quests() {
    const v = V(), d = S.dkey();
    if (v.quests.d !== d) {
      let hs = 0; for (const ch of d + v.id) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = [...POOL], pick = [];
      while (pick.length < 3) { hs = (hs * 1103515245 + 12345) >>> 0; pick.push(pool.splice(hs % pool.length, 1)[0]); }
      pick.push('help');
      v.quests = { d, list: pick.map((k) => ({ k, p: 0, done: false })) };
      v.pets = {};
      S.save();
    }
    return v.quests.list;
  }
  function quest(k, n = 1) {
    if (!V()) return;
    for (const q of quests()) if (q.k === k && !q.done) {
      const was = q.p; q.p = Math.min(QUESTS[k].n, q.p + n);
      if (q.p === QUESTS[k].n && was < q.p) TG.toast('📜 ' + L('Даалгавар биеллээ! Самбараас шагналаа аваарай.', 'Quest complete! Claim it at the board.'));
    }
    S.save();
  }
  TG.onGameRecorded = ({ stars, together, gameId }) => {
    const m = together ? 1.5 : 1;
    quest('game'); if (together) quest('together'); if (gameId === 'satis') quest('puzzle');
    return reward(Math.round(stars * 6 * m), Math.round(stars * 12 * m));
  };
  TG.onMissionDone = () => reward(15, 25);
  TG._village = { live: () => live, act: (...a) => act(...a), goTo: (...a) => goTo(...a), lots: () => lotsArr(), buyLot: (i, roof, door) => net.send({ t: 'ger-buy', i, roof, door }), invite: (id) => net.send({ t: 'wr-invite', to: id }), context: () => contextAction(), arena: () => arenaModal(), tournament: (r) => tournament(r) }; // used by automated tests
  TG.villageInfo = () => { const v = V(); return v ? { coins: v.coins, ...R.level(v.xp) } : null; };

  // ================================================================ pixel art helpers
  const PX = TG.pixel;
  const rc = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((c) => c != null && c !== false)); // never print "null"
  const portraitCache = new Map();
  function portrait(look, size = 40) {
    const key = JSON.stringify(look);
    if (!portraitCache.has(key)) {
      const s = PX.char(look, 0, 0), m = PX.mk(16, 18);
      m.x.drawImage(s, 0, -2); portraitCache.set(key, m.c.toDataURL());
    }
    return h('img', { class: 'px-icon', src: portraitCache.get(key), width: size, height: Math.round(size * 18 / 16), alt: '' });
  }
  const itemKey = (it) => (it.slot === 'deel' ? 'deel:' + it.val : it.cat === 'pet' ? 'pet:' + it.val : it.cat === 'tool' ? 'tool:' + it.id : 'wear:' + it.slot + '-' + it.val);
  const pic = (key, size = 32) => PX.icon(key, size);
  const ZASUUL = { deel: 'gold', skin: '#D9A06E', hat: 'mongol', face: null, neck: 'khadag', pet: null };
  TG.drawAvatarPixel = (ctx, look, scale) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(PX.char(look, 0, 0), 0, 0, 16 * scale, 28 * scale); };

  // ================================================================ multiplayer connection
  const net = {
    ws: null, retry: 0, timer: 0, closed: true,
    async connect() {
      this.closed = false; setStatus('connecting');
      if (location.protocol === 'file:') return setStatus('solo');
      let ok = false;
      try { const r = await fetch('api/hello', { cache: 'no-store' }); const j = r.ok ? await r.json() : {}; ok = j.naadamy === true; if (live) live.urls = j.urls || []; } catch (e) { ok = false; }
      if (!live || this.closed) return;
      if (!ok) return setStatus('solo');
      this.open();
    },
    open() {
      if (!live) return;
      const v = V(), url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'ws';
      let ws; try { ws = new WebSocket(url); } catch (e) { return setStatus('solo'); }
      this.ws = ws;
      ws.onopen = () => { this.retry = 0; ws.send(JSON.stringify({ t: 'join', room: v.room, id: v.id, name: live.name, look: v.look, lvl: lvl(), x: +live.me.px.toFixed(2), y: +live.me.py.toFixed(2), dir: live.me.dir })); };
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } if (live) handle(m); };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (!live) return;
        live.online = false; live.others.clear(); live.plots = null; live.lots = null; endRemoteMatch();
        if (this.closed) return setStatus('solo');
        setStatus('reconnecting');
        this.timer = setTimeout(() => this.open(), Math.min(10000, 1500 * ++this.retry));
      };
    },
    send(m) { if (this.ws && this.ws.readyState === 1 && live && live.online) this.ws.send(JSON.stringify(m)); },
    close() { this.closed = true; clearTimeout(this.timer); if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* closing */ } } },
    rejoin() { this.close(); if (!live) return; this.closed = false; live.online = false; live.others.clear(); live.plots = null; setStatus('connecting'); this.open(); },
  };
  function handle(m) {
    const v = V();
    switch (m.t) {
      case 'welcome':
        live.online = true; live.offset = m.now - Date.now(); live.plots = m.plots; live.lots = m.lots || new Array(R.LOTS).fill(null); live.room = m.room;
        live.others.clear(); (m.players || []).forEach(addOther);
        setStatus('online');
        TG.toast(`🟢 ${L('Нутагт холбогдлоо', 'Connected to village')} · ${m.room}` + (live.others.size ? ` · ${live.others.size} ${L('найз байна', 'friends here')}` : ''));
        break;
      case 'join': addOther(m.p); TG.toast(`👋 ${m.p.name} ${L('нутагт ирлээ', 'joined the village')}`); hud(); break;
      case 'leave': live.others.delete(m.id); hud(); break;
      case 'lot': onLot(m); break;
      case 'wr-invite': case 'wr-declined': case 'wr-start': case 'wr-wait': case 'wr-result': case 'wr-end': onWrestleMsg(m); break;
      case 'move': { const o = live.others.get(m.id); if (o) { o.x = m.x; o.y = m.y; o.dir = m.dir; } break; }
      case 'look': { const o = live.others.get(m.id); if (o) { o.look = m.look; o.lvl = m.lvl; } break; }
      case 'say': {
        const who = m.id === v.id ? live.me : live.others.get(m.id);
        if (who) who.bubble = { text: m.k === 'e' ? R.EMOTES[m.i] : tx(R.PHRASES[m.i]), t0: performance.now() };
        break;
      }
      case 'plot': onPlot(m); break;
      case 'deny': deny(m.why); break;
      case 'error': TG.toast(L('Өрөөнд нэвтэрч чадсангүй.', 'Could not join the room.')); break;
    }
  }
  function addOther(p) { live.others.set(p.id, { ...p, px: p.x, py: p.y, petPos: { x: p.x, y: p.y + 0.6 }, bubble: null, moving: false }); }
  function setStatus(s) { if (live) { live.status = s; hud(); } }

  // ================================================================ garden actions
  function act(a, i, c) {
    const v = V();
    if (a === 'plant' && !(v.seeds[c] > 0)) return;
    if (live.online) return net.send({ t: a, i, c });
    const res = R.applyAction(v.garden, a, i, { c }, { id: v.id, name: live.name }, now());
    if (res.ok) onPlot({ act: a, i, plot: res.plot, by: v.id, crop: res.crop, planter: res.planter || (res.plot && res.plot.by), helped: false });
    else deny(res.why);
  }
  function deny(why) {
    TG.sfx.bad();
    TG.toast({ taken: L('Энд аль хэдийн тарьчихсан байна.', 'Something is already planted here.'), 'no-need': L('Одоо услах шаардлагагүй.', 'No need to water right now.'), 'not-ready': L('Хараахан болоогүй байна.', 'Not ready yet.'), own: L('Танд аль хэдийн гэр байна.', 'You already have a ger.'), busy: L('Тэр хүн одоо завгүй байна.', 'That player is busy right now.') }[why] || L('Болсонгүй.', "That didn't work."));
  }
  function onPlot(m) {
    const v = V();
    garden()[m.i] = m.plot;
    const tile = WD.plots[m.i];
    if (m.by === v.id) {
      if (m.act === 'plant') { const c = m.plot.c; v.seeds[c] = Math.max(0, (v.seeds[c] || 0) - 1); quest('plant'); TG.sfx.snap(); floatAt(tile, '+2 XP', '#94d260'); reward(0, 2); }
      if (m.act === 'water') { v.water = Math.max(0, v.water - 1); quest('water'); if (m.helped) quest('help'); TG.sfx.pour(0.4); floatAt(tile, m.helped ? '+3 XP ♥' : '+1 XP', '#93d4f6'); reward(0, m.helped ? 3 : 1); }
      if (m.act === 'harvest') {
        const cr = R.CROPS[m.crop];
        v.produce[m.crop] = (v.produce[m.crop] || 0) + 1; quest('harvest'); TG.sfx.good(); floatAt(tile, `+${cr.xp} XP`, '#f7c646'); reward(0, cr.xp);
        if (!v.seen[m.crop]) { v.seen[m.crop] = 1; factCard('crop:' + m.crop, tx(cr.name), tx(cr.fact), L('Шинэ ургац!', 'New crop!')); }
        else TG.toast(`${tx(cr.name)} · 💡 ${tx(cr.fact)}`);
      }
    } else if (m.planter === v.id && m.act === 'water') { TG.toast(`💧 ${m.byName} ${L('таны ургамлыг усаллаа!', 'watered your plant!')}`); }
    else if (m.planter === v.id && m.act === 'harvest') { reward(5, 5); TG.toast(`🧺 ${m.byName} ${L('таны тарьсныг хураалаа. Хамтын ургац +5 🪙', 'harvested your crop. Shared harvest +5 🪙')}`); }
    S.save(); if (live) { hud(); updateCtx(); }
  }
  function plotAction(i) {
    const v = V(), p = R.normalize(garden()[i], now());
    if (!p) return live.sel && V().seeds[live.sel] > 0 ? act('plant', i, live.sel) : seedPicker(i);
    if (R.mature(p)) return act('harvest', i);
    if (R.needsWater(p)) {
      if (v.water <= 0) { TG.sfx.bad(); return TG.toast('🪣 ' + L('Усны сав хоосон. Худгаас ус аваарай!', 'Your can is empty. Refill at the well!')); }
      return act('water', i);
    }
    TG.toast(`${tx(R.CROPS[p.c].name)} · ${L('ургаж байна', 'growing')} ${fmtLeft(R.stageLeft(p, now()))}` + (p.n ? ` · ${L('тарьсан', 'planted by')}: ${p.n}` : ''));
  }
  const fmtLeft = (ms) => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}${L('с', 's')}`; };

  // ================================================================ screen
  TG.villageScreen = ({ setCleanup }) => {
    quests();
    const canvas = h('canvas', { class: 'v-canvas', 'aria-label': L('Нутаг: тоглоомын талбар', 'Village play area') });
    const els = {
      me: h('button', { class: 'v-me px-frame', onclick: () => wardrobe() }), coins: h('button', { class: 'v-pill px-frame', onclick: () => shopModal() }),
      water: h('div', { class: 'v-pill px-frame' }), net: h('button', { class: 'v-pill px-frame v-net', onclick: () => roomModal() }),
      ctx: h('button', { class: 'v-act px-frame hidden', onclick: () => { const a = contextAction(); if (a) doAction(a); } }),
      hotbar: h('div', { class: 'v-hotbar px-frame', role: 'toolbar', 'aria-label': L('Үр сонгох', 'Choose seeds') }),
      music: h('button', { class: 'v-round px-frame v-music hidden', 'aria-label': L('Хөгжим', 'Music'), onclick: () => { TG.music.toggle(); } }),
    };
    const root = h('div', { class: 'village' }, canvas,
      h('div', { class: 'v-top' },
        h('button', { class: 'v-back px-frame', 'aria-label': 'back', onclick: () => TG.go('home') }, TG.icon('arrowLeft')),
        els.me, h('div', { class: 'v-pills' }, els.coins, els.water, els.net)),
      h('div', { class: 'v-bottom' },
        h('div', { class: 'v-tools' },
          h('button', { class: 'v-round px-frame', 'aria-label': 'bag', onclick: () => bag() }, pic('ui:bag', 32)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'talk', onclick: () => talk() }, pic('ui:chat', 32)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'quests', onclick: () => questModal() }, pic('ui:scroll', 32)),
          els.music),
        els.hotbar, els.ctx));
    setTimeout(() => start(root, canvas, els, setCleanup), 0);
    return root;
  };

  function start(root, canvas, els, setCleanup) {
    if (!root.isConnected) return;
    const v = V(), prof = S.active();
    const qRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    if (R.ROOM_RE.test(qRoom) && v.room !== qRoom) { v.room = qRoom; S.save(); }
    const sp = v.pos && !WD.blocked(Math.floor(v.pos.x + 0.5), Math.floor(v.pos.y + 0.82)) ? v.pos : { x: 17, y: 13 };
    live = { root, canvas, els, ctx: canvas.getContext('2d'), name: prof.name, status: 'connecting', online: false, offset: 0, plots: null, lots: null, room: v.room,
      me: { x: Math.floor(sp.x + 0.5), y: Math.floor(sp.y + 0.82), px: sp.x, py: sp.y, vx: 0, vy: 0, path: [], dir: 0, moving: false, bubble: null, petPos: { x: sp.x, y: sp.y + 0.6 }, sent: { x: sp.x, y: sp.y }, netT: 0, stuck: 0 },
      cam: { x: sp.x, y: sp.y }, keys: new Set(), others: new Map(), pending: null, floaters: [], match: null,
      sheep: [[24, 20], [28, 22], [31, 20], [26, 23]].map(([x, y], i) => ({ i, x, y, px: x, py: y, next: 1 + i, flip: false })),
      raf: 0, last: performance.now(), view: {}, terrain: WD.renderStatic(), buf: PX.mk(1, 1), ctxTimer: 0, sel: null };
    resize();
    document.fonts && document.fonts.load('10px Tiny5', 'Нутаг ӨҮ');
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onTap);
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', clearKeys);
    root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); }); // HUD buttons never keep focus
    net.connect(); hud(); updateCtx();
    live.unMusic = TG.music ? TG.music.onChange(() => hud()) : null;
    live.raf = requestAnimationFrame(frame);
    if (!v.tips) tips();
    setCleanup(stop);
  }
  const clearKeys = () => { if (live) live.keys.clear(); };
  function stop() {
    if (!live) return;
    cancelAnimationFrame(live.raf);
    window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', clearKeys);
    net.close();
    if (live.unMusic) live.unMusic();
    const v = V(); if (v) { v.pos = { x: +live.me.px.toFixed(2), y: +live.me.py.toFixed(2) }; S.save(); }
    live = null;
  }
  function resize() {
    if (!live) return;
    const cssW = live.root.clientWidth || innerWidth, cssH = live.root.clientHeight || innerHeight, dpr = Math.min(3, devicePixelRatio || 1);
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    live.canvas.width = devW; live.canvas.height = devH;
    let k = Math.max(1, Math.round(devW / ((cssW < 640 ? 11 : 24) * T)));
    k = Math.max(k, Math.ceil(devW / (WD.W * T)), Math.ceil(devH / (WD.H * T)));
    const bw = Math.ceil(devW / k), bh = Math.ceil(devH / k);
    live.buf.c.width = bw + 1; live.buf.c.height = bh + 1; live.buf.x.imageSmoothingEnabled = false; // +1 px so sub-pixel scrolling never shows an edge
    live.view = { devW, devH, dpr, k, bw, bh, cssW };
  }
  /** Camera in art pixels, NOT rounded: rounding here made the view jump a whole art pixel (4–6 screen pixels). */
  function cam() {
    const { bw, bh } = live.view;
    return { x: clamp(live.cam.x * T + 8 - bw / 2, 0, WD.W * T - bw), y: clamp(live.cam.y * T + 4 - bh / 2, 0, WD.H * T - bh) };
  }

  // ---------------------------------------------------------------- HUD
  function hud() {
    if (!live) return;
    const v = V(), L1 = R.level(v.xp), e = live.els;
    rc(e.me, portrait(v.look, 30), h('span', { class: 'v-me-body' }, h('b', null, live.name), h('span', { class: 'v-lvl-row' }, h('span', { class: 'v-lvl' }, `${L('ТҮВ', 'LV')} ${L1.l}`), h('span', { class: 'v-xp' }, h('i', { style: { width: (L1.cur / L1.need) * 100 + '%' } })))));
    rc(e.coins, pic('ui:coin', 20), h('span', null, v.coins));
    rc(e.water, pic('ui:drop', 20), h('span', null, `${v.water}/${v.can}`));
    const n = live.others.size + 1;
    e.net.className = 'v-pill px-frame v-net ' + live.status;
    e.net.textContent = live.status === 'online' ? `● ${n} · ${live.room}` : live.status === 'solo' ? `○ ${L('Ганцаараа', 'Solo')}` : `◌ ${L('Холбогдож…', 'Connecting…')}`;
    hotbar();
    if (TG.music) { e.music.classList.toggle('hidden', !TG.music.available); e.music.textContent = '♪'; e.music.classList.toggle('off', !TG.music.playing); e.music.title = TG.music.title; }
  }
  function hotbar() {
    const v = V(), owned = Object.keys(R.CROPS).filter((k) => v.seeds[k] > 0);
    if (live.sel && !(v.seeds[live.sel] > 0)) live.sel = null;
    rc(live.els.hotbar, ...(owned.length ? owned.map((k) => h('button', { class: 'v-slot-btn' + (live.sel === k ? ' sel' : ''), title: tx(R.CROPS[k].name), 'aria-pressed': live.sel === k ? 'true' : 'false',
      onclick: () => { live.sel = live.sel === k ? null : k; TG.sfx.tap(); hotbar(); updateCtx(); } }, pic('crop:' + k, 28), h('small', null, v.seeds[k])))
      : [h('button', { class: 'v-slot-btn empty', onclick: () => shopModal('seeds') }, pic('ui:seed', 28), h('small', null, '+'))]));
  }
  function contextAction() {
    if (!live || live.me.path.length) return null;
    const m = live.me, fx = m.px + 0.5, fy = m.py + 0.82;
    const pi = WD.plotAt(m.x, m.y); if (pi >= 0) return { type: 'plot', i: pi };
    let best = null, bd = 1.05;
    const consider = (d, a) => { if (d < bd) { bd = d; best = a; } };
    for (const o of WD.objects) if (o.door) consider(Math.hypot(fx - (o.door.x + 0.5), fy - (o.door.y + 0.7)), o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : { type: o.id });
    consider(Math.hypot(fx - (WD.DOCK.x + 0.5), fy - (WD.DOCK.y + 0.7)), { type: 'fish' });
    for (const q of live.sheep) consider(Math.hypot(fx - (q.px + 0.5), fy - (q.py + 0.7)) - 0.35, { type: 'sheep', s: q });
    if (best) return best;
    if ((WD.g[m.y] || [])[m.x] === 'a') return { type: 'arena' };
    return null;
  }
  function labelFor(a) {
    switch (a.type) {
      case 'plot': {
        const p = R.normalize(garden()[a.i], now());
        if (!p) return live.sel ? ['crop:' + live.sel, L('Тарих', 'Plant')] : ['ui:seed', L('Тарих', 'Plant')];
        if (R.mature(p)) return ['crop:' + p.c, L('Хураах', 'Harvest')];
        if (R.needsWater(p)) return ['ui:drop', L('Услах', 'Water')];
        return ['crop:' + p.c, fmtLeft(R.stageLeft(p, now()))];
      }
      case 'home': return ['ui:house', L('Хувцас', 'Wardrobe')];
      case 'arcade': return ['ui:play', L('Тоглох', 'Play')];
      case 'shop': return ['ui:shop', L('Дэлгүүр', 'Shop')];
      case 'board': return ['ui:scroll', L('Даалгавар', 'Quests')];
      case 'well': return ['ui:drop', L('Ус авах', 'Get water')];
      case 'fish': return ['ui:fish', L('Загасчлах', 'Fish')];
      case 'sheep': return ['ui:heart', L('Илбэх', 'Pet')];
      case 'lot': { const l = lotsArr()[a.i]; return ['ui:ger', !l ? L('Гэр авах', 'Buy ger') : l.by === V().id ? L('Миний гэр', 'My ger') : L('Зочлох', 'Visit')]; }
      case 'zasuul': case 'arena': return ['ui:wrestle', L('Барилдах', 'Wrestle')];
      case 'ovoo': return ['ui:ovoo', L('Овоо тахих', 'Visit ovoo')];
    }
    return ['ui:star', ''];
  }
  function updateCtx() {
    if (!live) return;
    const a = contextAction(), b = live.els.ctx;
    b.classList.toggle('hidden', !a);
    if (a) { const [k, t] = labelFor(a); rc(b, pic(k, 36), h('span', null, t)); }
  }
  function doAction(a) {
    if (!a || !live) return;
    switch (a.type) {
      case 'plot': return plotAction(a.i);
      case 'home': return wardrobe();
      case 'arcade': return arcade();
      case 'shop': return shopModal();
      case 'board': return questModal();
      case 'well': { const v = V(); v.water = v.can; S.save(); TG.sfx.pour(0.7); floatAt(live.me, `${v.water}/${v.can}`, '#93d4f6'); hud(); return; }
      case 'fish': return fishing();
      case 'sheep': return petSheep(a.s);
      case 'lot': return lotAction(a.i);
      case 'zasuul': case 'arena': return arenaModal();
      case 'ovoo': return ovooAction();
    }
  }

  // ---------------------------------------------------------------- input
  function onTap(e) {
    if (!live) return;
    e.preventDefault();
    const r = live.canvas.getBoundingClientRect(), c = cam(), { k, devW } = live.view, sc = devW / r.width;
    const ax = ((e.clientX - r.left) * sc) / k + c.x, ay = ((e.clientY - r.top) * sc) / k + c.y;
    const wx = ax / T, wy = ay / T, tx0 = Math.floor(wx), ty0 = Math.floor(wy);
    for (const o of live.others.values()) if (Math.abs(o.px + 0.5 - wx) < 0.6 && wy > o.py - 0.8 && wy < o.py + 1) return playerCard(o);
    const sh = live.sheep.find((q) => Math.abs(q.px + 0.5 - wx) < 0.7 && Math.abs(q.py + 0.5 - wy) < 0.7);
    if (sh) { const n = WD.nearestOpen(sh.x, sh.y, live.me.x, live.me.y); return n ? goTo(n, { type: 'sheep', s: sh }) : null; }
    const pi = WD.plotAt(tx0, ty0); if (pi >= 0) return goTo({ x: tx0, y: ty0 }, { type: 'plot', i: pi });
    const o = WD.occ[tx0 + ',' + ty0]; if (o && o.door) return goTo(o.door, o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : { type: o.id });
    if (tx0 === WD.DOCK.x && ty0 === WD.DOCK.y) return goTo(WD.DOCK, { type: 'fish' });
    if (!WD.blocked(tx0, ty0)) return goTo({ x: tx0, y: ty0 }, null);
    const n = WD.nearestOpen(tx0, ty0, live.me.x, live.me.y); if (n) goTo(n, null);
  }
  const freeAt = (fx, fy) => !WD.blocked(Math.floor(fx - HW), Math.floor(fy - HH)) && !WD.blocked(Math.floor(fx + HW), Math.floor(fy - HH)) && !WD.blocked(Math.floor(fx - HW), Math.floor(fy + HH)) && !WD.blocked(Math.floor(fx + HW), Math.floor(fy + HH));
  function los(ax, ay, bx, by) { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2); for (let i = 1; i <= n; i++) { const q = i / n; if (!freeAt(ax + (bx - ax) * q, ay + (by - ay) * q)) return false; } return true; }
  function goTo(t, action) {
    const m = live.me, path = WD.findPath(m.x, m.y, t.x, t.y);
    if (!path) return TG.toast(L('Тийшээ очих зам алга.', "Can't get there."));
    // string-pull the tile path into a few straight, smooth segments
    const out = []; let cur = { x: m.px, y: m.py }, i = 0;
    while (i < path.length) { let j = path.length - 1; while (j > i && !los(cur.x + 0.5, cur.y + 0.82, path[j].x + 0.5, path[j].y + 0.82)) j--; out.push({ x: path[j].x, y: path[j].y }); cur = path[j]; i = j + 1; }
    if (!out.length) out.push({ x: t.x, y: t.y });
    m.path = out; m.stuck = 0; live.pending = action;
    live.floaters.push({ x: t.x, y: t.y, ring: true, t0: performance.now() });
    updateCtx();
  }
  const KEYS = { ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u' };
  function onKey(e) {
    if (!live || document.querySelector('.modal-back') || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    if (KEYS[e.code]) { e.preventDefault(); live.keys.add(KEYS[e.code]); return; }
    if (e.code === 'Space' || e.code === 'KeyE') {
      // Space is only ever the action button: it never re-presses a focused HUD button
      e.preventDefault(); e.stopPropagation();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (!e.repeat) { const a = contextAction(); if (a) doAction(a); }
    }
  }
  function onKeyUp(e) {
    if (!live) return;
    if (KEYS[e.code]) live.keys.delete(KEYS[e.code]);
    if (e.code === 'Space' && !document.querySelector('.modal-back')) { e.preventDefault(); e.stopPropagation(); }
  }

  // ---------------------------------------------------------------- update + draw
  function frame(ts) {
    if (!live) return;
    const dt = Math.min(0.05, (ts - live.last) / 1000); live.last = ts;
    update(dt); draw(ts / 1000);
    live.raf = requestAnimationFrame(frame);
  }
  const follow = (p, x, y, dt) => { p.x += (x - p.x) * Math.min(1, dt * 4); p.y += (y - p.y) * Math.min(1, dt * 4); };
  function update(dt) {
    const m = live.me, k = live.keys;
    let ix = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), iy = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), tvx = 0, tvy = 0;
    if (ix || iy) { m.path = []; live.pending = null; const n = Math.hypot(ix, iy); tvx = (ix / n) * SPEED; tvy = (iy / n) * SPEED; }
    else if (m.path.length) {
      const wp = m.path[0], dx = wp.x - m.px, dy = wp.y - m.py, d = Math.hypot(dx, dy);
      if (d < Math.max(0.06, SPEED * dt * 1.1)) {
        m.px = wp.x; m.py = wp.y; m.path.shift();
        if (!m.path.length) { m.vx = m.vy = 0; const a = live.pending; live.pending = null; m.x = Math.floor(m.px + 0.5); m.y = Math.floor(m.py + 0.82); if (a) doAction(a); updateCtx(); }
      } else {
        const sp = m.path.length === 1 && d < 0.6 ? SPEED * Math.max(0.45, d / 0.6) : SPEED;
        tvx = (dx / d) * sp; tvy = (dy / d) * sp;
      }
    }
    const a = Math.min(1, dt * (ix || iy || m.path.length ? ACCEL : ACCEL * 1.4));
    m.vx += (tvx - m.vx) * a; m.vy += (tvy - m.vy) * a;
    if (Math.abs(m.vx) < 0.01) m.vx = 0; if (Math.abs(m.vy) < 0.01) m.vy = 0;
    // move with collision, sliding along walls
    const ox = m.px, oy = m.py;
    if (m.vx && freeAt(m.px + 0.5 + m.vx * dt, m.py + 0.82)) m.px += m.vx * dt; else m.vx = 0;
    if (m.vy && freeAt(m.px + 0.5, m.py + 0.82 + m.vy * dt)) m.py += m.vy * dt; else m.vy = 0;
    const speed = Math.hypot(m.vx, m.vy);
    m.moving = speed > 0.3;
    if (speed > 0.3) m.dir = Math.abs(m.vx) > Math.abs(m.vy) * 0.9 ? (m.vx < 0 ? 1 : 2) : (m.vy < 0 ? 3 : 0);
    if (m.path.length) { m.stuck = Math.hypot(m.px - ox, m.py - oy) < 0.002 ? m.stuck + dt : 0; if (m.stuck > 0.5) { m.path = []; live.pending = null; } }
    const tx = Math.floor(m.px + 0.5), ty = Math.floor(m.py + 0.82);
    if (tx !== m.x || ty !== m.y) { m.x = tx; m.y = ty; updateCtx(); }
    // share position about 10 times a second while moving, plus a final update when stopping
    m.netT += dt;
    const movedSince = Math.hypot(m.px - m.sent.x, m.py - m.sent.y);
    if ((m.netT > 0.1 && movedSince > 0.03) || (!m.moving && movedSince > 0.001)) { m.netT = 0; m.sent = { x: m.px, y: m.py }; net.send({ t: 'move', x: +m.px.toFixed(2), y: +m.py.toFixed(2), dir: m.dir }); }
    // smooth camera
    const ca = Math.min(1, dt * 7); live.cam.x += (m.px - live.cam.x) * ca; live.cam.y += (m.py - live.cam.y) * ca;
    follow(m.petPos, m.px - 0.45, m.py + 0.25, dt);
    for (const o of live.others.values()) {
      const dx = o.x - o.px, dy = o.y - o.py, d = Math.hypot(dx, dy);
      if (d > 5) { o.px = o.x; o.py = o.y; }
      else { const q = Math.min(1, dt * 9); o.px += dx * q; o.py += dy * q; }
      o.moving = d > 0.04;
      follow(o.petPos, o.px - 0.45, o.py + 0.25, dt);
    }
    for (const q of live.sheep) {
      q.next -= dt;
      if (q.next <= 0) { q.next = 2 + Math.random() * 4; const [dx, dy] = DIRS[Math.floor(Math.random() * 4)], nx = q.x + dx, ny = q.y + dy; if (nx >= 23 && nx <= 32 && ny >= 19 && ny <= 23) { q.x = nx; q.y = ny; if (dx) q.flip = dx > 0; } }
      q.px += (q.x - q.px) * Math.min(1, dt * 2.5); q.py += (q.y - q.py) * Math.min(1, dt * 2.5);
    }
    live.ctxTimer -= dt; if (live.ctxTimer <= 0) { live.ctxTimer = 0.4; updateCtx(); }
  }

  function draw(t) {
    const ctx = live.ctx, b = live.buf.x, { devW, devH, dpr, k, bw, bh } = live.view, cf = cam(), nowMs = now(), pn = performance.now();
    // 1) static world + crops into the low-res buffer at a whole-pixel camera…
    const c = { x: Math.floor(cf.x), y: Math.floor(cf.y) };
    b.fillStyle = '#76b947'; b.fillRect(0, 0, bw + 1, bh + 1);
    b.drawImage(live.terrain, -c.x, -c.y);
    const x0 = Math.max(0, Math.floor(c.x / T)), x1 = Math.min(WD.W - 1, Math.ceil((c.x + bw) / T)), y0 = Math.max(0, Math.floor(c.y / T)), y1 = Math.min(WD.H - 1, Math.ceil((c.y + bh) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (WD.g[y][x] !== 'w') continue;
      const ph = (t * 0.9 + WD.hash(x, y) * 7) % 3; if (ph > 1.2) continue;
      const X = x * T - c.x + 3 + Math.floor(WD.hash(y, x) * 9), Y = y * T - c.y + 4 + Math.floor(WD.hash(x + 1, y) * 9);
      PX.R(b, X, Y, ph < 0.6 ? 3 : 2, 1, ph < 0.6 ? PX.K.foam : PX.K.waterL);
    }
    const gd = garden();
    for (let i = 0; i < R.PLOTS; i++) {
      const p = R.normalize(gd[i], nowMs); if (!p) continue;
      const { x, y } = WD.plots[i], X = x * T - c.x, Y = y * T - c.y;
      if (X < -16 || Y < -16 || X > bw + 1 || Y > bh + 1) continue;
      PX.crop(b, X, Y, p.c, p.s, !!p.w, R.mature(p) && ((t * 1.6 + i * 0.37) % 2) < 0.35);
      if (R.needsWater(p)) PX.drop(b, X + 11, Y - 5 + (Math.floor(t * 3 + i) % 2));
    }
    // 2) …then upscale it, shifted by the camera's fractional part in real screen pixels (smooth scrolling)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(live.buf.c, -Math.round((cf.x - c.x) * k), -Math.round((cf.y - c.y) * k), (bw + 1) * k, (bh + 1) * k);
    // 3) characters straight onto the screen at screen-pixel precision (no art-pixel snapping = no shaking)
    const SX = (wx) => Math.round((wx - cf.x) * k), SY = (wy) => Math.round((wy - cf.y) * k);
    const sprite = (img, wx, wy, flip) => {
      const X = SX(wx), Y = SY(wy), w = img.width * k, hh = img.height * k;
      if (X > devW || Y > devH || X + w < 0 || Y + hh < 0) return;
      if (flip) { ctx.save(); ctx.translate(X + w, Y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, hh); ctx.restore(); } else ctx.drawImage(img, X, Y, w, hh);
    };
    const shadow = (wx, wy) => { const X = SX(wx), Y = SY(wy); ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(X + 4 * k, Y + 13 * k, 9 * k, k); ctx.fillRect(X + 3 * k, Y + 14 * k, 11 * k, k); ctx.fillRect(X + 4 * k, Y + 15 * k, 9 * k, k); };
    const ents = [], frame = (o) => (o.moving ? 1 + (Math.floor(t * 8) % 2) : 0);
    live.sheep.forEach((q) => ents.push({ y: q.py, f: () => { shadow(q.px * T, q.py * T); sprite(PX.animal('sheep', Math.floor(t * 2 + q.i) % 2), q.px * T, q.py * T + 2, q.flip); } }));
    const person = (o) => {
      if (o.look.pet) ents.push({ y: o.petPos.y, f: () => { const a = PX.animal(o.look.pet, frame(o)); shadow(o.petPos.x * T - 2, o.petPos.y * T - 1); sprite(a, o.petPos.x * T + 2, o.petPos.y * T + 16 - a.height, o.px > o.petPos.x + 0.05); } });
      ents.push({ y: o.py, f: () => { shadow(o.px * T, o.py * T); sprite(PX.char(o.look, o.dir, frame(o)), o.px * T, o.py * T - 12); } });
    };
    for (const o of live.others.values()) person(o);
    const v = V(); person({ ...live.me, look: v.look });
    lotsArr().forEach((l, i) => { if (!l) return; const o = WD.lots[i]; ents.push({ y: o.y + 2, f: () => sprite(PX.gerSprite(R.ROOF[l.roof] || R.ROOF.blue, R.DOOR[l.door] || R.DOOR.red), o.x * T, o.y * T - 2) }); });
    const zs = WD.objects.find((q) => q.kind === 'npc');
    if (zs) ents.push({ y: zs.y, f: () => { shadow(zs.x * T, zs.y * T); sprite(PX.char(ZASUUL, Math.floor(t / 2.5) % 4 === 3 ? 2 : 0, 0), zs.x * T, zs.y * T - 12); } });
    ents.sort((a2, b2) => a2.y - b2.y).forEach((e) => e.f());
    // 4) evening: dark tint + stepped lantern glow
    const hr = new Date().getHours();
    if (hr >= 19 || hr < 6) {
      ctx.fillStyle = 'rgba(18,22,70,.38)'; ctx.fillRect(0, 0, devW, devH);
      ctx.globalCompositeOperation = 'lighter';
      const glow = (cx, cy, rx, ry, col) => { ctx.fillStyle = col; for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))); ctx.fillRect(SX(cx - hw), SY(cy + dy), (hw * 2 + 1) * k, k); } };
      for (const o of WD.objects.filter((q) => q.kind === 'lantern')) { const X = o.x * T + 8, Y = o.y * T - 6; glow(X, Y, 26, 20, 'rgba(255,200,110,.10)'); glow(X, Y, 15, 12, 'rgba(255,200,110,.14)'); glow(X, Y, 6, 5, 'rgba(255,220,140,.2)'); }
      ctx.globalCompositeOperation = 'source-over';
    }
    // 5) text layer (pixel font)
    const S = (wx, wy) => [(wx - cf.x) * k, (wy - cf.y) * k];
    lotsArr().forEach((l, i) => { if (!l) return; const o = WD.lots[i], [sx, sy] = S(o.x * T + 24, o.y * T - 4); pixelText(ctx, l.n, sx, sy, textSize(), l.by === v.id ? '#f7c646' : '#ffffff'); });
    if (zs) { const [sx, sy] = S(zs.x * T + 8, zs.y * T - 16); pixelText(ctx, L('Засуул', 'Herald'), sx, sy, textSize(), '#f7c646'); }
    for (const o of live.others.values()) labels(ctx, o, o.name, o.lvl, false, pn, S, dpr);
    labels(ctx, live.me, live.name, R.level(v.xp).l, true, pn, S, dpr);
    live.floaters = live.floaters.filter((f) => pn - f.t0 < 1400);
    for (const f of live.floaters) {
      const q = (pn - f.t0) / 1400, [sx, sy] = S(f.x * T + 8, f.y * T + 10);
      if (f.ring) { ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = Math.max(2, k); ctx.strokeRect(Math.round(sx - (4 + q * 6) * k), Math.round(sy - (2 + q * 2) * k), Math.round((8 + q * 12) * k), Math.round((4 + q * 4) * k)); continue; }
      pixelText(ctx, f.text, sx, sy - (8 + q * 14) * k, textSize(), f.color, 1 - q);
    }
  }
  const textSize = () => 5 * Math.max(2, live.view.k); // Tiny5 is drawn on a 5-pixel grid
  function blit(b, img, X, Y, flip) { if (!flip) return b.drawImage(img, X, Y); b.save(); b.translate(X + img.width, Y); b.scale(-1, 1); b.drawImage(img, 0, 0); b.restore(); }
  function pixelText(ctx, text, x, y, size, color, alpha = 1, outline = '#2b1e2e') {
    const fs = Math.max(10, Math.round(size / 5) * 5), o = Math.max(1, Math.round(fs / 10));
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${fs}px Tiny5, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = outline; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) ctx.fillText(text, Math.round(x) + dx, Math.round(y) + dy);
    ctx.fillStyle = color; ctx.fillText(text, Math.round(x), Math.round(y)); ctx.restore();
  }
  function labels(ctx, o, name, level, isMe, pn, S, dpr) {
    const [x, y] = S(o.px * T + 8, o.py * T - 16), fs = textSize(), u = Math.max(1, Math.round(fs / 10));
    ctx.font = `${fs}px Tiny5, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pad = Math.round(fs * 0.45), th = fs + u * 4, gap = u * 3;
    const lvT = String(level), lvW = Math.ceil(ctx.measureText(lvT).width) + pad * 2, nmW = Math.ceil(ctx.measureText(name).width) + pad * 2;
    const X0 = Math.round(x - (lvW + gap + nmW) / 2), Y = Math.round(y - th / 2);
    const box = (bx, w, bg, top, fg, text) => {
      ctx.fillStyle = '#2b1e2e'; ctx.fillRect(bx - u, Y - u, w + u * 2, th + u * 2);
      ctx.fillStyle = bg; ctx.fillRect(bx, Y, w, th); ctx.fillStyle = top; ctx.fillRect(bx, Y, w, u);
      ctx.fillStyle = fg; ctx.fillText(text, Math.round(bx + w / 2), Math.round(Y + th / 2 + u / 2));
    };
    box(X0, lvW, '#f7c646', '#ffe58f', '#3a2600', lvT);                                   // level: its own gold box
    box(X0 + lvW + gap, nmW, isMe ? '#3f76db' : '#5a3a22', isMe ? '#7fa6ee' : '#8a5a33', '#ffffff', name); // name
    let top = Y;
    const look = isMe ? V().look : o.look, title = look && look.title && R.TITLES.find((q) => q.id === look.title);
    if (title) { top = Y - th - u * 2; pixelText(ctx, '★ ' + tx(title.name), x, top + th / 2, fs, '#f7c646'); }          // title above
    if (!o.bubble) return;
    const age = (pn - o.bubble.t0) / 1000;
    if (age > 4.5) { o.bubble = null; return; }
    ctx.save(); ctx.globalAlpha = age > 3.9 ? (4.5 - age) / 0.6 : 1;
    ctx.font = `${fs}px Tiny5, monospace`;
    const bw2 = Math.ceil(ctx.measureText(o.bubble.text).width) + fs * 1.4, bh2 = fs + u * 8, BX = Math.round(x - bw2 / 2), BY = Math.round(top - bh2 - u * 8);
    ctx.fillStyle = '#2b1e2e'; ctx.fillRect(BX - u, BY - u, bw2 + u * 2, bh2 + u * 2); ctx.fillRect(Math.round(x - u * 3), BY + bh2, u * 6, u * 3); ctx.fillRect(Math.round(x - u), BY + bh2 + u * 3, u * 2, u * 2);
    ctx.fillStyle = '#fff8e6'; ctx.fillRect(BX, BY, bw2, bh2); ctx.fillRect(Math.round(x - u * 2), BY + bh2, u * 4, u * 2);
    ctx.fillStyle = '#2b1e2e'; ctx.fillText(o.bubble.text, Math.round(x), Math.round(BY + bh2 / 2 + u / 2));
    ctx.restore();
  }
  function floatAt(p, text, color) { if (live) live.floaters.push({ x: p.px !== undefined ? p.px : p.x, y: p.py !== undefined ? p.py : p.y, text, color, t0: performance.now() }); }

  // ================================================================ panels
  const icon = (k) => h('span', { class: 'v-ic' }, String(k).includes(':') ? pic(k, 32) : k);
  function factCard(key, title, fact, head) {
    const close = TG.modal(h('div', { class: 'center v-fact' }, h('div', { class: 'v-fact-e' }, pic(key, 72)), head ? h('div', { class: 'eyebrow' }, head) : null, h('h2', null, title),
      h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, fact)),
      h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: () => close() }, L('Гайхалтай!', 'Cool!'))));
  }
  function seedPicker(i) {
    const v = V(), owned = Object.entries(R.CROPS).filter(([k]) => v.seeds[k] > 0);
    const close = TG.modal(h('div', null,
      h('h2', null, L('Юу тарих вэ?', 'What to plant?')),
      h('p', { class: 'muted' }, L('Тарьсан ургамлаа 3 удаа услах хэрэгтэй. Найзууд чинь ч усалж туслах боломжтой!', 'Plants need water 3 times. Your friends can help water too!')),
      owned.length ? h('div', { class: 'v-grid' }, owned.map(([k, c]) => h('button', { class: 'v-card', onclick: () => { close(); act('plant', i, k); } },
        h('span', { class: 'v-card-e' }, pic('crop:' + k, 40)), h('b', null, tx(c.name)), h('small', null, `×${v.seeds[k]} · ${c.stage * 3}${L('с', 's')}`))))
        : h('div', { class: 'empty-memory' }, h('p', null, L('Танд үр алга. Дэлгүүрээс аваарай!', "You don't have seeds. Get some at the shop!")),
          h('button', { class: 'btn primary', onclick: () => { close(); shopModal('seeds'); } }, '🛒 ', L('Дэлгүүр', 'Shop')))));
  }

  function shopModal(start) {
    const v = V(); let cur = start || 'seeds';
    const body = h('div', { class: 'v-shop' });
    const TABS = [['seeds', 'ui:seed', L('Үр', 'Seeds')], ['wear', 'deel:red', L('Хувцас', 'Clothes')], ['pet', 'pet:lamb', L('Тэжээвэр', 'Pets')], ['tool', 'tool:can-2', L('Багаж', 'Tools')], ['sell', 'ui:coin', L('Зарах', 'Sell')]];
    const pay = (price) => { if (v.coins < price) { TG.sfx.bad(); TG.toast(L('Зоос хүрэлцэхгүй байна. Тоглож, ургац зарж цуглуулаарай!', 'Not enough coins. Play games or sell crops to earn more!')); return false; } v.coins -= price; TG.sfx.chime(); return true; };
    const ownedItem = (it) => (it.cat === 'tool' ? (it.slot === 'can' ? v.can >= it.val : v.rod >= it.val) : v.owned.includes(it.id));
    const draw = () => {
      const level = lvl();
      let list;
      if (cur === 'seeds') list = Object.entries(R.CROPS).map(([k, c]) => {
        const locked = level < c.lvl;
        return h('div', { class: 'v-row' + (locked ? ' locked' : '') }, icon('crop:' + k), h('div', { class: 'v-row-b' }, h('b', null, tx(c.name)), h('small', null, `${L('Зарах үнэ', 'Sells for')} ${c.sell} · ${L('Танд', 'You have')} ${v.seeds[k] || 0}`)),
          locked ? h('span', { class: 'v-lock' }, '🔒 ', L('Түвшин', 'Lv'), ' ', c.lvl) : h('div', { class: 'v-buy' },
            h('button', { class: 'btn sm', onclick: () => { if (pay(c.cost)) { v.seeds[k] = (v.seeds[k] || 0) + 1; save(); } } }, `+1 · ${c.cost}`, pic('ui:coin', 14)),
            h('button', { class: 'btn sm primary', onclick: () => { if (pay(c.cost * 5)) { v.seeds[k] = (v.seeds[k] || 0) + 5; save(); } } }, `+5 · ${c.cost * 5}`, pic('ui:coin', 14))));
      });
      else if (cur === 'sell') {
        const goods = [...Object.entries(v.produce).filter(([, n]) => n > 0).map(([k, n]) => ({ k, n, kind: 'produce', e: 'crop:' + k, name: R.CROPS[k].name, price: R.CROPS[k].sell })),
          ...Object.entries(v.fish).filter(([, n]) => n > 0).map(([k, n]) => ({ k, n, kind: 'fish', e: 'fish:' + k, name: R.FISH[k].name, price: R.FISH[k].sell }))];
        const sell = (g, n) => { v[g.kind][g.k] -= n; v.coins += g.price * n; quest('sell', n); TG.sfx.chime(); save(); };
        list = goods.length ? [h('button', { class: 'btn primary block', onclick: () => goods.forEach((g) => sell(g, g.n)) }, `${L('Бүгдийг зарах', 'Sell everything')} · +${goods.reduce((s, g) => s + g.n * g.price, 0)}`, pic('ui:coin', 16)),
          ...goods.map((g) => h('div', { class: 'v-row' }, icon(g.e), h('div', { class: 'v-row-b' }, h('b', null, `${tx(g.name)} ×${g.n}`), h('small', null, `${g.price} ${L('зоос, ширхэг бүр', 'coins each')}`)),
            h('button', { class: 'btn sm', onclick: () => sell(g, 1) }, `${L('Зарах', 'Sell')} 1`)))]
          : [h('div', { class: 'empty-memory' }, h('p', null, L('Зарах зүйл алга. Ургац хурааж, загас бариарай!', 'Nothing to sell yet. Harvest crops or catch fish!')))];
      } else list = R.ITEMS.filter((it) => it.cat === cur).map((it) => {
        const owned = ownedItem(it), locked = level < it.lvl, worn = it.cat !== 'tool' && v.look[it.slot] === it.val;
        return h('div', { class: 'v-row' + (locked && !owned ? ' locked' : '') }, icon(itemKey(it)), h('div', { class: 'v-row-b' }, h('b', null, tx(it.name)), h('small', null, owned ? (worn ? L('Өмссөн', 'Wearing') : L('Танд байгаа', 'Owned')) : `${it.price} ${L('зоос', 'coins')}`)),
          owned ? (it.cat === 'tool' ? h('span', { class: 'v-owned' }, '✓') : h('button', { class: 'btn sm' + (worn ? ' done' : ''), onclick: () => equip(it.slot, worn && it.slot !== 'deel' ? null : it.val, draw) }, worn ? (it.slot === 'deel' ? '✓' : L('Тайлах', 'Remove')) : L('Өмсөх', 'Wear')))
            : locked ? h('span', { class: 'v-lock' }, '🔒 ', L('Түвшин', 'Lv'), ' ', it.lvl)
              : h('button', { class: 'btn sm primary', onclick: () => {
                if (!pay(it.price)) return;
                if (it.cat === 'tool') { if (it.slot === 'can') { v.can = it.val; v.water = it.val; } else v.rod = it.val; }
                else { v.owned.push(it.id); v.look[it.slot] = it.val; sendLook(); }
                TG.toast(`${tx(it.name)}: ${L('худалдаж авлаа!', 'purchased!')}`); save();
              } }, `${it.price}`, pic('ui:coin', 14)));
      });
      rc(body, 
        h('div', { class: 'v-shop-head' }, h('h2', null, L('Наадмын дэлгүүр', 'Naadam Shop')), h('span', { class: 'v-pill dark' }, pic('ui:coin', 18), ` ${v.coins}`)),
        h('div', { class: 'chips v-tabs' }, TABS.map(([k, e, t]) => h('button', { class: 'chip' + (cur === k ? ' active' : ''), onclick: () => { cur = k; draw(); } }, pic(e, 18), ' ', t))),
        h('div', { class: 'v-list' }, list));
    };
    const save = () => { S.save(); hud(); draw(); };
    draw();
    TG.modal(body, { cls: 'v-modal' });
  }
  const sendLook = () => net.send({ t: 'look', look: V().look, lvl: lvl() });
  function equip(slot, val, redraw) { const v = V(); v.look[slot] = val; S.save(); sendLook(); TG.sfx.tap(); if (redraw) redraw(); }

  function wardrobe() {
    const v = V(), body = h('div', { class: 'v-wardrobe' });
    const cv = h('canvas', { class: 'v-preview', width: 160, height: 160 });
    let raf = 0;
    const paint = (ts) => {
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 160, 160);
      ctx.fillStyle = '#94d260'; ctx.fillRect(0, 112, 160, 48); ctx.fillStyle = '#9fd8f7'; ctx.fillRect(0, 0, 160, 112);
      const f = Math.floor(ts / 600) % 4, dir = [0, 2, 3, 1][f];
      ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(48, 140, 40, 8);
      ctx.drawImage(PX.char(v.look, dir, 0), 36, 20, 64, 112);
      if (v.look.pet) { const a = PX.animal(v.look.pet, Math.floor(ts / 300) % 2); ctx.drawImage(a, 104, 148 - a.height * 3, a.width * 3, a.height * 3); }
      raf = requestAnimationFrame(paint);
    };
    const slot = (title, s, items) => h('div', { class: 'v-slot' }, h('div', { class: 'label' }, title), h('div', { class: 'v-chips' },
      s !== 'deel' ? h('button', { class: 'v-chip' + (!v.look[s] ? ' active' : ''), onclick: () => equip(s, null, draw) }, '∅') : null,
      items.map((it) => h('button', { class: 'v-chip' + (v.look[s] === it.val ? ' active' : ''), title: tx(it.name), onclick: () => equip(s, it.val, draw) }, pic(itemKey(it), 30)))));
    const draw = () => {
      const mine = (s) => R.ITEMS.filter((it) => it.slot === s && v.owned.includes(it.id));
      rc(body, h('h2', null, L('Миний хувцас', 'My wardrobe')), cv,
        h('div', { class: 'v-slot' }, h('div', { class: 'label' }, L('Арьсны өнгө', 'Skin tone')), h('div', { class: 'v-chips' }, R.SKINS.map((sk) => h('button', { class: 'v-chip v-skin' + (v.look.skin === sk ? ' active' : ''), style: { background: sk }, 'aria-label': 'skin', onclick: () => equip('skin', sk, draw) })))),
        slot(L('Дээл', 'Deel'), 'deel', mine('deel')), slot(L('Малгай', 'Hat'), 'hat', mine('hat')), slot(L('Нүүр', 'Face'), 'face', mine('face')),
        slot(L('Хүзүү', 'Neck'), 'neck', mine('neck')), slot(L('Тэжээвэр', 'Pet'), 'pet', mine('pet')),
        h('button', { class: 'btn block', onclick: () => { close(); shopModal('wear'); } }, '🛒 ', L('Дэлгүүрээс шинэ хувцас авах', 'Get more at the shop')));
    };
    draw();
    const close = TG.modal(body, { cls: 'v-modal', onClose: () => cancelAnimationFrame(raf) });
    raf = requestAnimationFrame(paint);
  }

  function bag() {
    const v = V();
    const sec = (title, obj, src) => { const items = Object.entries(obj).filter(([k, n]) => n > 0 && src[k]); return h('div', { class: 'v-slot' }, h('div', { class: 'label' }, title), items.length ? h('div', { class: 'v-chips' }, items.map(([k, n]) => h('span', { class: 'v-chip wide' }, pic((src === R.FISH ? 'fish:' : 'crop:') + k, 24), ` ${tx(src[k].name)} ×${n}`))) : h('p', { class: 'muted' }, '—')); };
    const L1 = R.level(v.xp);
    const close = TG.modal(h('div', null, h('h2', null, L('Цүнх', 'Bag')),
      h('div', { class: 'stat-cards' }, h('div', { class: 'stat' }, h('small', null, L('Түвшин', 'Level')), h('b', null, L1.l)), h('div', { class: 'stat' }, h('small', null, 'XP'), h('b', null, `${L1.cur}/${L1.need}`)), h('div', { class: 'stat' }, h('small', null, L('Зоос', 'Coins')), h('b', null, v.coins))),
      sec(L('Үр', 'Seeds'), v.seeds, R.CROPS), sec(L('Ургац', 'Harvest'), v.produce, R.CROPS), sec(L('Загас', 'Fish'), v.fish, R.FISH),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => { close(); wardrobe(); } }, '👗 ', L('Хувцас', 'Wardrobe')), h('button', { class: 'btn primary', onclick: () => { close(); shopModal('sell'); } }, '💰 ', L('Зарах', 'Sell')))), { cls: 'v-modal' });
  }

  function questModal() {
    const v = V(), body = h('div');
    const draw = () => rc(body, h('h2', null, L('Өнөөдрийн даалгавар', "Today's quests")),
      h('p', { class: 'muted' }, L('Даалгавар өдөр бүр шинэчлэгдэнэ.', 'Quests refresh every day.')),
      h('div', { class: 'v-list' }, quests().map((q) => {
        const d = QUESTS[q.k], ready = q.p >= d.n && !q.done;
        return h('div', { class: 'v-row' + (q.done ? ' done' : '') }, icon(q.done ? 'ui:star' : q.k === 'help' ? 'ui:heart' : 'ui:scroll'),
          h('div', { class: 'v-row-b' }, h('b', null, tx(d.t), q.k === 'help' ? h('small', null, ` (${L('онлайн', 'online')})`) : null), h('div', { class: 'meter' }, h('span', { style: { width: (q.p / d.n) * 100 + '%' } })), h('small', null, `${q.p}/${d.n} · +${d.c} ${L('зоос', 'coins')} · +${d.x} XP`)),
          ready ? h('button', { class: 'btn sm primary', onclick: () => { q.done = true; reward(d.c, d.x); TG.confetti(40); draw(); } }, L('Авах', 'Claim')) : q.done ? h('span', { class: 'v-owned' }, '✓') : null);
      })),
      h('button', { class: 'btn block', onclick: () => { close(); TG.go('missions'); } }, L('Гэр бүлийн бодит даалгавар', 'Real-life family missions'), ' +15 ', pic('ui:coin', 14)));
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }

  function arcade() {
    const prof = S.active(), ag = S.ageGroupOf(prof.age);
    const games = TG.gameOrder.map((id) => TG.games[id]).filter((g) => g.ages.includes(ag)).slice(0, 8);
    const close = TG.modal(h('div', null, h('h2', null, L('Тоглоомын гэр', 'Game ger')),
      h('p', { class: 'muted' }, L('Тоглоом бүрээр зоос, XP цуглуулна. Гэр бүлтэйгээ хамт тогловол 1.5 дахин их!', 'Every game earns coins and XP. Play with family for 1.5× more!')),
      h('div', { class: 'v-grid' }, games.map((g) => h('button', { class: 'v-card', onclick: () => { close(); TG.launchGame(g); } }, h('span', { class: 'v-card-e' }, g.icon), h('b', null, tx(g.title))))),
      h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => { close(); TG.go('satis'); } }, '✨ ', L('Цэгцлэе! оньсого', 'Make it perfect! puzzles'))), { cls: 'v-modal' });
  }

  function talk() {
    const say = (k, i) => {
      if (live.online) net.send({ t: 'say', k, i });
      else live.me.bubble = { text: k === 'e' ? R.EMOTES[i] : tx(R.PHRASES[i]), t0: performance.now() };
      close();
    };
    const close = TG.modal(h('div', null, h('h2', null, L('Хэлэх үг', 'Say something')),
      h('p', { class: 'muted' }, '🛡️ ', L('Хүүхдийн аюулгүй байдлын үүднээс зөвхөн бэлэн үг, эможи ашиглана.', 'For child safety, only friendly preset phrases and emoji are allowed.')),
      h('div', { class: 'v-phrases' }, R.PHRASES.map((p, i) => h('button', { class: 'v-chip wide', onclick: () => say('p', i) }, tx(p)))),
      h('div', { class: 'v-chips v-emotes' }, R.EMOTES.map((e, i) => h('button', { class: 'v-chip', onclick: () => say('e', i) }, e)))));
  }

  function playerCard(o) {
    const close = TG.modal(h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, portrait(o.look, 64)), h('h2', null, o.name), h('p', { class: 'muted' }, `${L('Түвшин', 'Level')} ${o.lvl}`),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => { net.send({ t: 'say', k: 'p', i: 0 }); close(); } }, '👋 ', L('Мэндлэх', 'Say hi')),
        h('button', { class: 'btn primary', onclick: () => { net.send({ t: 'say', k: 'p', i: 1 }); close(); } }, '🎮 ', L('Хамт тоглоё', "Let's play")))));
  }

  function roomModal() {
    const v = V(), body = h('div');
    const input = h('input', { class: 'input', maxlength: 8, value: v.room, placeholder: 'NUTAG', 'aria-label': 'room code', style: { textTransform: 'uppercase', letterSpacing: '.15em', textAlign: 'center', fontSize: '1.3rem' } });
    const join = (code) => {
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!R.ROOM_RE.test(code)) return TG.toast(L('Код 3–8 үсэг, тоо байна.', 'A code is 3–8 letters or digits.'));
      v.room = code; S.save(); live.room = code; close();
      if (live.status !== 'solo') net.rejoin(); else TG.toast(L('Сервертэй холбогдоогүй тул ганцаараа горимд байна.', 'No server connection, so you are in solo mode.'));
    };
    const others = live ? [...live.others.values()] : [];
    const local = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname);
    const base = local && live.urls && live.urls[0] ? live.urls[0] : location.origin + location.pathname.replace(/[^/]*$/, '');
    const share = `${base}?room=${live.room || v.room}`;
    const qr = h('canvas', { class: 'v-qr', 'aria-label': 'QR' });
    try { TG.qr.toCanvas(qr, share, 6); } catch (e) { /* too long */ }
    const invite = live.status === 'online' ? h('div', { class: 'v-invite' },
      h('div', { class: 'label' }, L('Найзаа урих: утасны камераар уншуулаарай', 'Invite friends: scan with a phone camera')), qr,
      h('div', { class: 'v-url' }, share),
      h('p', { class: 'privacy' }, L('Найзууд чинь яг ижил Wi-Fi-д холбогдсон байх ёстой. Сургууль, зочны Wi-Fi төхөөрөмжүүдийг хооронд нь холбохгүй байж болно. Тэгвэл утасны hotspot ашиглаарай.', 'Friends must be on the same Wi-Fi. Some school or guest Wi-Fi blocks devices from seeing each other; if so, use a phone hotspot.'))) : null;
    body.append(h('h2', null, L('Хамт тоглох өрөө', 'Play-together room')), invite,
      live.status === 'online'
        ? h('div', null, h('p', { class: 'muted' }, L(`"${live.room}" өрөөнд ${others.length + 1} хүн байна. Ижил кодтой хүмүүс нэг нутагт тоглож, нэг цэцэрлэгт тарина.`, `${others.length + 1} people in room "${live.room}". Everyone with the same code shares one village and garden.`)),
          h('div', { class: 'v-chips' }, h('span', { class: 'v-chip wide active' }, portrait(V().look, 22), ' ', live.name, ` (${L('та', 'you')})`), others.map((o) => h('span', { class: 'v-chip wide' }, portrait(o.look, 22), ' ', o.name, ` · ${o.lvl}`))))
        : h('div', { class: 'hint' }, live.status === 'solo'
          ? L('Одоо ганцаараа горимд байна. Найзуудтайгаа хамт тоглохын тулд багш эсвэл эцэг эх компьютер дээр "node server.js" ажиллуулж, бүгд нэг Wi-Fi-аас тэр хаягаар нэвтэрнэ.', 'You are in solo mode. To play with friends, a teacher or parent runs "node server.js" on a computer and everyone on the same Wi-Fi opens its address.')
          : L('Холбогдож байна…', 'Connecting…')),
      h('label', { class: 'label', style: { display: 'block', marginTop: '14px' } }, L('Өрөөний код (гэр бүл, ангиараа нууц код сонгоорой)', 'Room code (pick a private code for your family or class)')), input,
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn', onclick: () => { const c = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); input.value = c; } }, '🎲 ', L('Шинэ код', 'New code')),
        h('button', { class: 'btn primary', onclick: () => join(input.value) }, L('Орох', 'Join'))),
      h('p', { class: 'privacy' }, '🔒 ', L('Зөвхөн ижил кодтой хүмүүс таныг харна. Бичгээр чатлах боломжгүй.', 'Only people with the same code can see you. There is no free-text chat.')));
    const close = TG.modal(body, { cls: 'v-modal' });
  }

  function petSheep(s) {
    const m = live.me;
    if (Math.abs(s.x - m.x) > 1 || Math.abs(s.y - m.y) > 1) return TG.toast(L('Хонь холдчихлоо 🐑', 'The sheep wandered off 🐑'));
    const v = V(); TG.sfx.chime(); floatAt({ x: s.px, y: s.py }, '♥', '#f492ba');
    const k = 'sheep' + s.i;
    if (!v.pets[k]) { v.pets[k] = 1; quest('pet'); reward(0, 2); TG.toast('🐑 ' + L('Хонь баярлалаа! +2 XP', 'The sheep is happy! +2 XP')); }
  }

  function fishing() {
    const v = V(), keys = Object.keys(R.FISH);
    const weights = keys.map((k) => R.FISH[k].w * (v.rod > 1 && R.FISH[k].diff >= 3 ? 1.8 : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), key = keys[0];
    for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) { key = keys[i]; break; } }
    const f = R.FISH[key], zoneH = v.rod > 1 ? 0.32 : 0.25, speed = [0, 0.32, 0.46, 0.6, 0.75][f.diff];
    let zone = 0.5 - zoneH / 2, vel = 0, fish = 0.5, target = 0.5, retarget = 1, prog = 0.4, holding = false, raf = 0, last = performance.now(), over = false, grace = 1.2;
    const zoneEl = h('div', { class: 'fz' }), fishEl = h('div', { class: 'ff' }, pic('ui:fish', 28)), progEl = h('span'), bar = h('div', { class: 'fbar' }, zoneEl, fishEl);
    const holdBtn = h('button', { class: 'btn primary big block' }, L('Дарж барь', 'Press & hold'));
    const wrap = h('div', { class: 'fishing' }, h('h2', null, L('Загасчлах', 'Fishing')),
      h('p', { class: 'muted' }, L('Загасыг ногоон хэсэг дотор байлга. Дарж байхад ногоон хэсэг дээшилнэ.', 'Keep the fish inside the green zone. Hold to lift the zone.')),
      h('div', { class: 'frow' }, bar, h('div', { class: 'fprog' }, progEl)), holdBtn);
    const down = (e) => { e.preventDefault(); holding = true; }, up = () => { holding = false; };
    [holdBtn, bar].forEach((el) => { el.style.touchAction = 'none'; el.addEventListener('pointerdown', down); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, up)); });
    const key2 = (e) => { if (e.code === 'Space') { e.preventDefault(); holding = e.type === 'keydown'; } };
    window.addEventListener('keydown', key2); window.addEventListener('keyup', key2);
    const cleanup = () => { over = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', key2); window.removeEventListener('keyup', key2); };
    const end = (win) => {
      cleanup();
      if (!win) { TG.sfx.bad(); rc(wrap, h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, '💨'), h('h2', null, L('Загас зугтлаа!', 'The fish got away!')), h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')), h('button', { class: 'btn primary', onclick: () => { close(); fishing(); } }, L('Дахин', 'Again'))))); return; }
      quest('fish'); TG.sfx.win();
      if (f.release) reward(f.coins, f.xp); else { v.fish[key] = (v.fish[key] || 0) + 1; reward(0, f.xp); }
      S.save(); hud();
      rc(wrap, h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, pic('fish:' + key, 72)), h('div', { class: 'eyebrow' }, L('Барьлаа!', 'Caught!')), h('h2', null, tx(f.name)),
        h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(f.fact))),
        h('p', { class: 'muted', style: { marginTop: '10px' } }, f.release ? `${L('Буцааж тавилаа. Байгаль хамгаалсны шагнал', 'Released! Nature-protector reward')}: +${f.coins} ${L('зоос', 'coins')}, +${f.xp} XP` : `+${f.xp} XP · ${L('Дэлгүүрт', 'Sells for')} ${f.sell} ${L('зоос', 'coins')}`),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')), h('button', { class: 'btn primary', onclick: () => { close(); fishing(); } }, L('Дахин', 'Again')))));
    };
    const loop = (ts) => {
      if (over) return;
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      vel = clamp(vel + (holding ? -2.2 : 1.5) * dt, -0.95, 0.95); zone += vel * dt;
      if (zone < 0) { zone = 0; vel = Math.abs(vel) * 0.3; }
      if (zone > 1 - zoneH) { zone = 1 - zoneH; vel = -Math.abs(vel) * 0.3; }
      retarget -= dt; if (retarget <= 0) { target = 0.06 + Math.random() * 0.88; retarget = 0.45 + Math.random() * (1.5 - f.diff * 0.22); }
      const d = target - fish; fish += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      const inside = fish >= zone && fish <= zone + zoneH;
      grace -= dt;
      prog = clamp(prog + (inside ? 0.28 : grace > 0 ? 0 : -0.13) * dt, 0, 1);
      zoneEl.style.top = zone * 100 + '%'; zoneEl.style.height = zoneH * 100 + '%'; fishEl.style.top = `calc(${fish * 100}% - 14px)`;
      zoneEl.classList.toggle('on', inside); progEl.style.height = prog * 100 + '%';
      if (prog >= 1) return end(true);
      if (prog <= 0) return end(false);
      raf = requestAnimationFrame(loop);
    };
    const close = TG.modal(wrap, { cls: 'v-modal', onClose: cleanup });
    raf = requestAnimationFrame(loop);
  }

  // ================================================================ own ger (housing)
  function lotAction(i) {
    const l = lotsArr()[i];
    if (!l) return myLot() >= 0 ? TG.toast(L('Танд аль хэдийн гэр байна!', 'You already have a ger!')) : buyGer(i);
    if (l.by === V().id) return homeModal(i);
    visitGer(l);
  }
  function gerPreview(roof, door, scale) {
    const c = h('canvas', { class: 'v-gerprev', width: 48 * scale, height: 50 * scale }), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(PX.gerSprite(R.ROOF[roof], R.DOOR[door]), 0, 0, 48 * scale, 50 * scale);
    return c;
  }
  const swatches = (map, cur, onPick, cls = '') => h('div', { class: 'v-chips' }, Object.entries(map).map(([k, c]) => h('button', { class: 'v-chip v-swatch ' + cls + (cur === k ? ' active' : ''), style: { background: c }, 'aria-label': k, onclick: () => onPick(k) })));
  function buyGer(i) {
    const v = V(), body = h('div'); let roof = 'blue', door = 'red';
    const buy = () => {
      if (lvl() < R.GER_LEVEL) return TG.toast(L(`${R.GER_LEVEL}-р түвшинд хүрээрэй.`, `Reach level ${R.GER_LEVEL} first.`));
      if (v.coins < R.GER_PRICE) return TG.toast(L('Зоос хүрэлцэхгүй байна. Тоглож, ургац зарж цуглуулаарай!', 'Not enough coins. Play games or sell crops to earn more!'));
      close();
      if (live.online) net.send({ t: 'ger-buy', i, roof, door });
      else { const lot = { by: v.id, n: live.name, roof, door, furn: [] }; onLot({ act: 'buy', i, lot, by: v.id }); }
    };
    const draw = () => rc(body, 
      h('h2', null, L('Өөрийн гэр барих', 'Build your own ger')),
      h('p', { class: 'muted' }, L('Гэр хороололд өөрийн монгол гэртэй болж, өнгийг нь сонгоод, тавилгаар чимээрэй. Найзууд чинь зочилж болно!', 'Get your own Mongolian ger, pick its colours and furnish it. Friends can come and visit!')),
      h('div', { class: 'v-gerbox' }, gerPreview(roof, door, 3)),
      h('div', { class: 'label' }, L('Дээврийн хээ', 'Roof band')), swatches(R.ROOF, roof, (k) => { roof = k; draw(); }),
      h('div', { class: 'label', style: { marginTop: '10px' } }, L('Хаалга', 'Door')), swatches(R.DOOR, door, (k) => { door = k; draw(); }, 'door'),
      lvl() < R.GER_LEVEL ? h('div', { class: 'hint', style: { marginTop: '12px' } }, L(`Гэр барихад ${R.GER_LEVEL}-р түвшин хэрэгтэй.`, `You need level ${R.GER_LEVEL} to build a ger.`)) : null,
      h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, disabled: lvl() < R.GER_LEVEL, onclick: buy }, L('Гэр барих', 'Build ger'), ` · ${R.GER_PRICE} `, pic('ui:coin', 16)));
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  function onLot(m) {
    const v = V();
    lotsArr()[m.i] = m.lot;
    if (m.by === v.id && m.act === 'buy') {
      v.coins = Math.max(0, v.coins - R.GER_PRICE); reward(0, 30); TG.sfx.win(); TG.confetti(70);
      factCard('ui:ger', L('Шинэ гэр!', 'Your new ger!'), L('Монгол гэрийг нэг цагийн дотор барьж, нүүж болдог. Хаалга нь ихэвчлэн урд зүг рүү харсан байдаг.', 'A Mongolian ger can be put up in about an hour and moved anywhere. Its door traditionally faces south.'), '+30 XP');
    } else if (m.act === 'buy') TG.toast(`🏠 ${m.lot.n} ${L('гэр барилаа!', 'built a ger!')}`);
    S.save(); if (live) { hud(); updateCtx(); }
  }
  function saveLot(i, patch) {
    const l = lotsArr()[i]; Object.assign(l, patch);
    if (live.online) net.send({ t: 'ger-style', roof: l.roof, door: l.door, furn: l.furn });
    S.save();
  }
  function homeModal(i) {
    const v = V(), l = lotsArr()[i], body = h('div'), cv = h('canvas', { class: 'v-interior', width: 240, height: 170 });
    const draw = () => {
      PX.interior(cv, R.ROOF[l.roof] || R.ROOF.blue, l.furn || []);
      const today = S.dkey(), rested = v.rest === today;
      rc(body, h('h2', null, L('Миний гэр', 'My ger')), cv,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', onclick: () => { close(); wardrobe(); } }, L('Хувцас', 'Wardrobe')),
          h('button', { class: 'btn primary', disabled: rested, onclick: () => { v.rest = today; v.water = v.can; S.save(); reward(5, 10); TG.sfx.chime(); TG.toast(L('Гэртээ амарлаа: +10 XP, усны сав дүүрлээ.', 'You rested at home: +10 XP, water refilled.')); draw(); } }, rested ? L('Өнөөдөр амарсан', 'Rested today') : L('Амрах', 'Rest'))),
        h('div', { class: 'label', style: { marginTop: '12px' } }, L('Тавилга', 'Furniture')),
        h('div', { class: 'v-list' }, R.FURNITURE.map((f) => {
          const owned = (l.furn || []).includes(f.id), locked = lvl() < f.lvl;
          return h('div', { class: 'v-row' + (locked && !owned ? ' locked' : '') }, icon('furn:' + f.id), h('div', { class: 'v-row-b' }, h('b', null, tx(f.name)), h('small', null, tx(f.fact))),
            owned ? h('span', { class: 'v-owned' }, '✓') : locked ? h('span', { class: 'v-lock' }, L('Түвшин', 'Lv'), ' ', f.lvl)
              : h('button', { class: 'btn sm primary', onclick: () => {
                if (v.coins < f.price) { TG.sfx.bad(); return TG.toast(L('Зоос хүрэлцэхгүй байна.', 'Not enough coins.')); }
                v.coins -= f.price; saveLot(i, { furn: [...(l.furn || []), f.id] }); TG.sfx.chime(); hud(); draw();
              } }, `${f.price} `, pic('ui:coin', 14)));
        })),
        h('div', { class: 'label', style: { marginTop: '12px' } }, L('Өнгө солих (үнэгүй)', 'Change colours (free)')),
        swatches(R.ROOF, l.roof, (k) => { saveLot(i, { roof: k }); draw(); }),
        h('div', { style: { height: '6px' } }), swatches(R.DOOR, l.door, (k) => { saveLot(i, { door: k }); draw(); }, 'door'));
    };
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  function visitGer(l) {
    const cv = h('canvas', { class: 'v-interior', width: 240, height: 170 }); PX.interior(cv, R.ROOF[l.roof] || R.ROOF.blue, l.furn || []);
    const close = TG.modal(h('div', { class: 'center' }, h('h2', null, `${l.n} · ${L('гэр', 'ger')}`), cv,
      h('p', { class: 'muted' }, L('Найзынхаа гэрт зочиллоо!', "You are visiting a friend's ger!")),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => { if (live.online) net.send({ t: 'say', k: 'p', i: 0 }); else live.me.bubble = { text: tx(R.PHRASES[0]), t0: performance.now() }; close(); } }, L('Мэндлэх', 'Say hi')))), { cls: 'v-modal' });
  }
  function ovooAction() {
    const v = V(), d = S.dkey(), first = v.ovoo !== d;
    if (first) { v.ovoo = d; reward(0, 5); }
    TG.sfx.chime();
    factCard('ui:ovoo', L('Овоо', 'Ovoo'), L('Монголчууд овоог нар зөв гурав тойрч, чулуу нэмж, хадаг уяж, хүслээ шивнэдэг. Овоо бол байгаль, нутгаа хүндэтгэх бэлгэдэл.', 'Mongolians walk clockwise around an ovoo three times, add a stone, tie a blue khadag and make a wish. It is a way of honouring nature and the homeland.'), first ? '+5 XP' : null);
  }

  // ================================================================ wrestling (бөх)
  const WR_NAMES = ['Ховдын Батбаяр', 'Увсын Ганзориг', 'Архангайн Тэмүүлэн', 'Дорнодын Энхбат', 'Говь-Алтайн Сүхбат', 'Сэлэнгийн Мөнх-Эрдэнэ', 'Баян-Өлгийн Ержан', 'Хэнтийн Төмөрбаатар', 'Завханы Оюунболд', 'Өвөрхангайн Даваадорж', 'Булганы Цогтбаатар', 'Сүхбаатарын Ууганбаяр'];
  const WR_FACTS = [
    Tx('Бөхчүүд барилдааны өмнө, дараа бүргэд мэт дэвж хөдөлдөг. Үүнийг "дэвээ" гэнэ.', 'Wrestlers do an eagle dance (devee) before and after each bout.'),
    Tx('Засуул бөхийн цолыг дуудаж, магтаал хэлдэг бөгөөд барилдааны үеэр бөхийн малгайг барьж зогсоно.', 'The zasuul (herald) sings the wrestler\'s titles and holds his hat during the bout.'),
    Tx('Монгол бөхөд жингийн ангилал байдаггүй. Жижиг бөх ч том бөхийг мэхээрээ дийлж болно.', 'Mongolian wrestling has no weight classes. A small wrestler can beat a big one with good technique.'),
    Tx('Тохой, өвдөг, нуруу эсвэл толгой газарт хүрвэл унасанд тооцогдоно.', 'A wrestler loses when an elbow, knee, back or head touches the ground.'),
    Tx('Бөхийн хувцас нь зодог (энгэрээ задгай цамц), шуудаг (богино өмд), гутал гурав.', 'The wrestling outfit is the zodog (open-chest jacket), the shuudag (briefs) and gutal boots.'),
    Tx('Улсын наадамд 512 эсвэл 1024 бөх барилддаг.', 'At the State Naadam, 512 or 1024 wrestlers compete.'),
  ];
  const titleObj = (id) => R.TITLES.find((q) => q.id === id);
  function updateTitle() {
    const v = V(), t = R.titleFor(v.wr);
    if (t && v.look.title !== t) { v.look.title = t; S.save(); sendLook(); return t; }
    return null;
  }
  function wrestlerPic(pose, col, size = 56) { const c = h('canvas', { class: 'px-icon', width: 28, height: 32, style: { width: size + 'px', height: Math.round(size * 32 / 28) + 'px' } }); c.getContext('2d').drawImage(PX.wrestler(col, R.SKINS.includes(V().look.skin) ? V().look.skin : R.SKINS[0], pose, 0), 0, 0); return c; }
  function arenaModal() {
    const v = V(), wr = v.wr, t = titleObj(R.titleFor(wr));
    const next = R.TITLES.find((q) => (q.id === 'avarga' ? (wr.champ || 0) < 2 : (wr.best || 0) < q.need));
    const others = live.online ? [...live.others.values()] : [];
    const stat = (k, n) => h('div', { class: 'stat' }, h('small', null, k), h('b', null, n));
    const close = TG.modal(h('div', null,
      h('div', { class: 'v-wr-head' }, wrestlerPic('dance', '#e14b3d'), h('div', null, h('h2', null, L('Бөхийн барилдаан', 'Mongolian wrestling')), h('p', { class: 'muted' }, t ? `★ ${tx(t.name)}` : L('Цолгүй бөх', 'No title yet')))),
      h('div', { class: 'stat-cards' }, stat(L('Шилдэг давлага', 'Best rounds'), wr.best || 0), stat(L('Түрүү', 'Wins'), wr.champ || 0), stat(L('Ялалт', 'Victories'), (wr.wins || 0) + (wr.pvpW || 0))),
      h('p', { class: 'hint' }, !next ? L('Та хамгийн дээд цол Аварга хүртсэн! 🏆', 'You hold the highest title, Avarga! 🏆')
        : next.id === 'avarga' ? L('Наадамд дахин түрүүлбэл Аварга цол хүртэнэ!', 'Win the Naadam once more to become an Avarga!')
          : L(`Наадамд ${next.need} давбал «${tx(next.name)}» цол хүртэнэ.`, `Win ${next.need} rounds at the Naadam to earn the "${tx(next.name)}" title.`)),
      h('button', { class: 'btn primary big block', onclick: () => { close(); tournament(1); } }, L('Наадамд барилдах (9 даваа)', 'Wrestle in the Naadam (9 rounds)')),
      live.online ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'label' }, L('Найзтайгаа барилдах', 'Wrestle a friend')),
        others.length ? h('div', { class: 'v-list' }, others.map((o) => h('div', { class: 'v-row' }, portrait(o.look, 28), h('div', { class: 'v-row-b' }, h('b', null, o.name), h('small', null, `${L('Түвшин', 'Level')} ${o.lvl}`)),
          h('button', { class: 'btn sm primary', onclick: () => { net.send({ t: 'wr-invite', to: o.id }); TG.toast(L('Урилга илгээлээ…', 'Invitation sent…')); close(); } }, L('Урих', 'Invite')))))
          : h('p', { class: 'muted' }, L('Одоогоор өрөөнд өөр хүн алга.', 'Nobody else is in the room yet.'))) : null,
      h('div', { class: 'teach', style: { marginTop: '12px' } }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(TG.pick(WR_FACTS))))), { cls: 'v-modal' });
  }
  function tournament(round) {
    const opp = { name: WR_NAMES[(round * 5 + Math.floor(Math.random() * 4)) % WR_NAMES.length], skill: 0.18 + round * 0.075, skin: TG.pick(R.SKINS) };
    wrestleMatch({ ai: true, round, opp }, (won) => {
      const v = V(), wr = v.wr;
      if (won) { wr.wins = (wr.wins || 0) + 1; reward(8 + round * 2, 10 + round * 3); } else { wr.losses = (wr.losses || 0) + 1; reward(0, 5); }
      const reached = won ? round : round - 1;
      if (won && round === 9) wr.champ = (wr.champ || 0) + 1;
      if (reached > (wr.best || 0)) wr.best = reached;
      S.save();
      return { newTitle: updateTitle(), champion: won && round === 9 };
    });
  }
  function wrestleMatch(cfg, onEnd) {
    const v = V(), mySkin = R.SKINS.includes(v.look.skin) ? v.look.skin : R.SKINS[0];
    const st = { a: 0, b: 0, phase: 'choose', move: null, lastPlayer: null, off: 0, target: 0, pose: ['grip', 'grip'], over: false, t0: performance.now(), marker: 0 };
    const cv = h('canvas', { class: 'v-wr-canvas', width: 160, height: 84 }), cx = cv.getContext('2d');
    const score = h('div', { class: 'v-wr-score' }), msg = h('div', { class: 'v-wr-msg' }, L('Мэхээ сонго!', 'Choose your move!'));
    const moves = h('div', { class: 'v-wr-moves' }), marker = h('i', { class: 'v-wr-marker' });
    const goBtn = h('button', { class: 'btn primary big block' }, L('Хүч! (Space)', 'Power! (Space)'));
    const timing = h('div', { class: 'v-wr-timing hidden' }, h('div', { class: 'v-wr-bar' }, h('i', { class: 'v-wr-zone' }), marker), goBtn);
    const tail = h('div');
    const body = h('div', { class: 'v-wrestle' }, h('div', { class: 'eyebrow' }, cfg.ai ? `${L('Наадам', 'Naadam')} · ${L('Даваа', 'Round')} ${cfg.round}/9` : L('Найзтай барилдаан', 'Friendly match')),
      h('h2', null, `${live.name} · ${cfg.opp.name}`), cv, score, msg, moves, timing, tail);
    const drawScore = () => rc(score, h('span', { class: 'me' }, live.name, ' ', '●'.repeat(st.a) + '○'.repeat(2 - st.a)), h('span', { class: 'them' }, '●'.repeat(st.b) + '○'.repeat(2 - st.b), ' ', cfg.opp.name));
    const moveLabel = (id) => tx(R.MOVES.find((m) => m.id === id).name);
    const setPhase = (p) => {
      st.phase = p;
      moves.classList.toggle('hidden', p !== 'choose'); timing.classList.toggle('hidden', p !== 'timing');
      if (p === 'choose') rc(moves, ...R.MOVES.map((m) => h('button', { class: 'btn', onclick: () => { st.move = m.id; st.t0 = performance.now(); setPhase('timing'); msg.textContent = L('Ногоон хэсэгт хүрэхэд дар!', 'Press when the marker is in the green!'); } },
        h('b', null, tx(m.name)), h('small', null, `> ${moveLabel(m.beats)}`))));
    };
    let raf = 0, lastT = performance.now();
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - lastT) / 1000); lastT = ts;
      st.off += (st.target - st.off) * Math.min(1, dt * 8);
      if (st.phase === 'timing') { st.marker = (Math.sin(((ts - st.t0) / 1000) * (cfg.ai ? 3.2 + cfg.round * 0.12 : 3.6)) + 1) / 2; marker.style.left = st.marker * 100 + '%'; if (ts - st.t0 > 5000) lock(); }
      // pixel scene
      cx.imageSmoothingEnabled = false; cx.fillStyle = '#e8c994'; cx.fillRect(0, 0, 160, 84);
      for (let i = 0; i < 60; i++) { cx.fillStyle = i % 2 ? '#d4ae72' : '#f6e2b8'; cx.fillRect((i * 37) % 160, 30 + ((i * 53) % 54), 1, 1); }
      cx.fillStyle = '#6b4220'; cx.fillRect(0, 0, 160, 22); for (let i = 0; i < 26; i++) { cx.fillStyle = ['#e14b3d', '#3f76db', '#f7c646', '#2ea35f', '#ffffff'][i % 5]; cx.fillRect(4 + i * 6, 12 + (i % 2) * 4, 4, 4); cx.fillStyle = i % 3 ? '#edbb93' : '#d9a06e'; cx.fillRect(5 + i * 6, 9 + (i % 2) * 4, 2, 3); }
      const f = Math.floor(ts / 250) % 2, o = Math.round(st.off);
      const A = PX.wrestler('#e14b3d', mySkin, st.pose[0], f), B = PX.wrestler('#3f76db', cfg.opp.skin || '#D9A06E', st.pose[1], f);
      const ax = 80 - 26 + o + (st.pose[0] === 'dance' ? -10 : 0), bx = 80 - 2 + o + (st.pose[1] === 'dance' ? 10 : 0);
      cx.fillStyle = 'rgba(40,20,0,.25)'; cx.fillRect(ax + 6, 78, 18, 2); cx.fillRect(bx + 4, 78, 18, 2);
      cx.drawImage(A, ax, 48);
      cx.save(); cx.translate(bx + 28, 48); cx.scale(-1, 1); cx.drawImage(B, 0, 0); cx.restore();
      raf = requestAnimationFrame(loop);
    };
    function lock() {
      if (st.phase !== 'timing') return;
      const power = Math.max(0, 1 - Math.abs(st.marker - 0.5) * 2);
      setPhase('wait');
      if (cfg.ai) {
        const counter = { push: 'hook', pull: 'push', hook: 'pull' };
        const smart = st.lastPlayer && Math.random() < (cfg.opp.skill - 0.3) * 0.7;
        const om = smart ? counter[st.lastPlayer] : TG.pick(R.MOVES).id;
        const op = clamp(cfg.opp.skill + (Math.random() - 0.5) * 0.45, 0.05, 1);
        apply(R.exchange(st.move, power, om, op), st.move, power, om, op);
      } else { cfg.remote.mine = { m: st.move, p: power }; net.send({ t: 'wr-move', m: st.move, p: +power.toFixed(2) }); msg.textContent = L('Өрсөлдөгчийг хүлээж байна…', 'Waiting for your opponent…'); }
    }
    function apply(r, mm, mp, om, op) {
      st.lastPlayer = mm;
      if (r > 0) { st.a++; TG.sfx.good(); } else if (r < 0) { st.b++; TG.sfx.bad(); } else TG.sfx.tap();
      st.target = clamp((st.a - st.b) * 12, -26, 26) + (r > 0 ? 6 : r < 0 ? -6 : 0);
      setTimeout(() => { st.target = clamp((st.a - st.b) * 12, -26, 26); }, 260);
      msg.textContent = `${moveLabel(mm)} ${Math.round(mp * 100)}%  ·  ${moveLabel(om)} ${Math.round(op * 100)}%  →  ` + (r > 0 ? L('Та давууллаа!', 'You gain the upper hand!') : r < 0 ? L('Өрсөлдөгч давууллаа!', 'Your opponent gains!') : L('Тэнцлээ!', 'Even!'));
      drawScore();
      if (cfg.ai) { if (st.a >= 2 || st.b >= 2) setTimeout(() => finish(st.a > st.b), 900); else setTimeout(() => { if (!st.over) { setPhase('choose'); } }, 1100); }
      else if (!(st.a >= 2 || st.b >= 2)) setTimeout(() => { if (!st.over) setPhase('choose'); }, 1100);
    }
    function finish(won, reason) {
      if (st.over) return; st.over = true; setPhase('done');
      st.pose = won ? ['dance', 'fall'] : ['fall', 'dance']; st.target = won ? 18 : -18;
      if (won) { TG.sfx.win(); TG.confetti(60); } else TG.sfx.bad();
      const res = onEnd ? onEnd(won) || {} : {};
      const t = res.newTitle && titleObj(res.newTitle);
      msg.textContent = reason === 'left' ? L('Өрсөлдөгч гарчихлаа. Та яллаа!', 'Your opponent left. You win!') : won ? L('Та яллаа! Бүргэд шиг дэвээрэй! 🦅', 'You won! Do the eagle dance! 🦅') : L('Уналаа… Дараагийн удаа заавал ялна!', 'You fell… you will win next time!');
      rc(tail, 
        t ? h('div', { class: 'v-zasuul' }, h('b', null, '📣 ', L('Засуул', 'Herald'), ': '), L(`«Хүчит бөх ${live.name} ${tx(t.name)} цол хүртлээ!»`, `"The mighty wrestler ${live.name} earns the ${tx(t.name)} title!"`), h('p', null, tx(t.fact))) : null,
        res.champion ? h('div', { class: 'v-zasuul' }, '🏆 ', L('Та Наадамд түрүүллээ!', 'You won the whole Naadam!')) : null,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')),
          cfg.ai ? (won && cfg.round < 9 ? h('button', { class: 'btn primary', onclick: () => { close(); tournament(cfg.round + 1); } }, L('Дараагийн даваа', 'Next round'), ' ▶')
            : h('button', { class: 'btn primary', onclick: () => { close(); tournament(1); } }, L('Шинэ Наадам', 'New Naadam'))) : null));
      if (cfg.remote && live) live.match = null;
    }
    const key = (e) => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (e.type === 'keydown' && !e.repeat) lock(); } };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
    goBtn.addEventListener('click', lock);
    if (cfg.remote) cfg.remote.ui = (m) => {
      if (m.t === 'wr-wait' && st.phase !== 'wait') msg.textContent = L('Өрсөлдөгч бэлэн боллоо!', 'Your opponent is ready!');
      if (m.t === 'wr-result') { const mineA = cfg.remote.side === 'a'; apply(mineA ? m.r : -m.r, mineA ? m.ma : m.mb, mineA ? m.pa : m.pb, mineA ? m.mb : m.ma, mineA ? m.pb : m.pa); }
      if (m.t === 'wr-end') setTimeout(() => finish(m.winner === v.id, m.reason), m.reason ? 0 : 900);
    };
    drawScore(); setPhase('choose');
    const close = TG.modal(body, { cls: 'v-modal', onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); if (cfg.remote && !st.over) { net.send({ t: 'wr-quit' }); if (live) live.match = null; } } });
    raf = requestAnimationFrame(loop);
  }
  function onWrestleMsg(m) {
    const v = V();
    if (m.t === 'wr-invite') {
      const close = TG.modal(h('div', { class: 'center' }, wrestlerPic('dance', '#3f76db', 64), h('h2', null, L('Барилдах урилга!', 'Wrestling challenge!')),
        h('p', null, `${m.name} ${L('тантай барилдахыг хүсэж байна.', 'wants to wrestle you.')}`),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => { net.send({ t: 'wr-decline', from: m.from }); close(); } }, L('Дараа', 'Not now')),
          h('button', { class: 'btn primary', onclick: () => { net.send({ t: 'wr-accept', from: m.from }); close(); } }, L('Барилдъя!', "Let's wrestle!")))), { cls: 'v-modal' });
    } else if (m.t === 'wr-declined') TG.toast(`${m.name} ${L('одоохондоо барилдахгүй гэлээ.', 'declined for now.')}`);
    else if (m.t === 'wr-start') {
      document.querySelectorAll('.modal-back .modal-x').forEach((x) => x.click());
      const side = m.a.id === v.id ? 'a' : 'b', opp = side === 'a' ? m.b : m.a;
      live.match = { id: m.id, side };
      setTimeout(() => wrestleMatch({ ai: false, opp: { name: opp.name, skin: opp.look && opp.look.skin }, remote: live.match }, (won) => {
        const wr = V().wr; if (won) { wr.pvpW = (wr.pvpW || 0) + 1; reward(25, 30); } else { wr.pvpL = (wr.pvpL || 0) + 1; reward(0, 10); } S.save(); return {};
      }), 250);
    } else if (live.match && live.match.ui) live.match.ui(m);
  }
  function endRemoteMatch() { if (live && live.match && live.match.ui) live.match.ui({ t: 'wr-end', winner: null, reason: 'disconnected' }); if (live) live.match = null; }

  function tips() {
    const close = TG.modal(h('div', null, h('div', { class: 'v-fact-e' }, pic('ui:logo', 72)), h('h2', null, L('Нутагт тавтай морил!', 'Welcome to the village!')),
      h('div', { class: 'v-list' }, [
        ['ui:star', L('Газар дээр дарж алх. Компьютер дээр сум эсвэл WASD товч.', 'Tap the ground to walk. On a computer use arrows or WASD.')],
        ['crop:carrot', L('Цэцэрлэгт үр тарьж, 3 удаа усалж, ургацаа хураа. Худгаас ус аваарай.', 'Plant seeds in the garden, water 3 times, then harvest. Refill water at the well.')],
        ['ui:play', L('Тоглоомын гэрт тоглож зоос, XP цуглуул. Дэлгүүрээс хувцас, тэжээвэр ав.', 'Play in the game ger to earn coins and XP. Buy clothes and pets at the shop.')],
        ['ui:heart', L('Нэг өрөөний найзууд нэг цэцэрлэгт хамт тарьж, бие биеийнхээ ургамлыг усална.', 'Friends in the same room share one garden and can water each other\'s plants.')],
      ].map(([e, t]) => h('div', { class: 'v-row' }, icon(e), h('div', { class: 'v-row-b' }, t)))),
      h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => close() }, L('Эхлэх', "Let's go"))), { cls: 'v-modal', onClose: () => { const v = V(); if (v) { v.tips = true; S.save(); } } });
  }
})(window.TG);
