/* Нутаг — the shared village: walk, herd and milk in the хот айл, fish, shop, dress up, quests, live multiplayer. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store, R = TG.vrules, WD = TG.vworld, T = WD.T;
  const SPEED = 4.3, ACCEL = 14, HW = 0.26, HH = 0.14; // tiles per second; feet hit-box half size
  const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]]; // down, left, right, up
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const Tx = (mn, en) => ({ mn, en });
  let live = null;
  const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  // ================================================================ saved data (per child profile)
  function V() {
    const p = S.active(); if (!p) return null;
    const v = p.village || (p.village = {});
    const d = { id: 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), xp: 0, coins: 40, produce: {}, milkT: {}, fish: {},
      owned: ['deel-blue'], look: { deel: 'blue', skin: R.SKINS[0], hat: null, face: null, neck: null, pet: null }, rod: 1, room: 'NUTAG',
      quests: { d: '', list: [] }, pets: {}, seen: {}, tips: false, pos: null,
      energy: 100, ate: {}, lots: [], ger: { stage: 0, lot: -1, parts: {}, wool: 0, fluff: 0, mats: 0, mistakes: 0, perfect: false }, shorn: {}, wr: { best: 0, champ: 0, wins: 0, losses: 0, pvpW: 0, pvpL: 0, techs: {} }, ovoo: '', horse: { coat: 'bay', races: 0, wins: 0, top5: 0, best: 0, dist: 0 } };
    const oldGer = v.ger === undefined && v.gerBuilt; // a ger bought before gers were built by hand
    for (const k in d) if (v[k] === undefined) v[k] = d[k];
    if (oldGer) { v.ger.stage = R.GER_DONE; v.ger.lot = (v.lots || []).findIndex((l) => l && l.by === v.id); }
    if (v.garden || v.seeds) { delete v.garden; delete v.seeds; delete v.can; delete v.water; for (const k of Object.keys(v.produce)) if (!R.DAIRY[k]) delete v.produce[k]; } // the garden became the dairy yard
    while (v.lots.length < R.LOTS) v.lots.push(null);
    return v;
  }
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
    setTimeout(() => TG.achievements && TG.achievements.check(), 0);
    return { coins, xp, level: after > before ? after : 0 };
  }
  const QUESTS = {
    milk: { n: 3, c: 20, x: 25, t: Tx('3 удаа мал саах', 'Milk the animals 3 times') },
    dairy: { n: 2, c: 25, x: 35, t: Tx('2 цагаан идээ хийх', 'Make 2 dairy foods') },
    fish: { n: 2, c: 25, x: 30, t: Tx('2 загас барих', 'Catch 2 fish') },
    basar: { n: 2, c: 15, x: 25, t: Tx('Басараас 2 асуулт асуух', 'Ask Basar 2 questions') },
    quiz: { n: 3, c: 25, x: 35, t: Tx('Басарын 3 асуултад зөв хариулах', 'Answer 3 of Basar’s questions right') },
    lesson: { n: 1, c: 30, x: 40, t: Tx('Өв соёлын 1 хичээл дуусгах', 'Finish 1 heritage lesson') },
    together: { n: 1, c: 40, x: 50, t: Tx('Гэр бүлтэйгээ бодит ажил хийх', 'Do a real activity with family') },
    pet: { n: 3, c: 10, x: 20, t: Tx('Хонийг 3 удаа илбэх', 'Pet the sheep 3 times') },
    sell: { n: 5, c: 15, x: 20, t: Tx('5 зүйл зарах', 'Sell 5 items') },
    race: { n: 1, c: 25, x: 35, t: Tx('Морин уралдаанд 1 удаа оролцох', 'Ride in 1 horse race') },
    archery: { n: 3, c: 25, x: 35, t: Tx('Сур харваанд 3 бай онох', 'Hit 3 archery targets') },
    wrestle: { n: 1, c: 25, x: 35, t: Tx('Бөхийн барилдаанд 1 удаа давах', 'Win 1 wrestling round') },
    etiquette: { n: 1, c: 30, x: 40, t: Tx('Эмээгийн гэрт ёсоор зочлох', 'Visit Grandma’s ger with good manners') },
    defend: { n: 1, c: 40, x: 60, t: Tx('Нутгаа хамгаалах тулаанд ялах', 'Win a defend-the-homeland battle') },
    eat: { n: 3, c: 15, x: 20, t: Tx('3 удаа хоол идэх, ундаа уух', 'Eat or drink 3 times') },
  };
  const POOL = ['milk', 'dairy', 'milk', 'fish', 'basar', 'quiz', 'pet', 'sell', 'basar', 'quiz', 'eat'];
  function quests() {
    const v = V(), d = S.dkey();
    if (v.quests.d !== d || v.quests.list.some((q) => !QUESTS[q.k])) { // new day, or quests from an older version
      let hs = 0; for (const ch of d + v.id) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = [...POOL], pick = [];
      while (pick.length < 3) { hs = (hs * 1103515245 + 12345) >>> 0; const k = pool.splice(hs % pool.length, 1)[0]; if (!pick.includes(k)) pick.push(k); }
      // one extra quest from today's season, worth +50%
      const sea = TG.seasons ? TG.seasons.current() : null, list = pick.map((k) => ({ k, p: 0, done: false }));
      if (sea) {
        const opts = sea.tasks.filter((k) => !pick.includes(k));
        if (opts.length) list.unshift({ k: opts[hs % opts.length], p: 0, done: false, season: sea.id });
        else { const q = list.find((x) => sea.tasks.includes(x.k)); if (q) q.season = sea.id; } // every season task was already picked: make one of them the season quest
      }
      v.quests = { d, list };
      v.pets = {};
      S.save();
    }
    return v.quests.list;
  }
  function quest(k, n = 1) {
    if (!V()) return;
    if (typeof npcProgress === 'function') npcProgress(k, n);
    for (const q of quests()) if (q.k === k && !q.done) {
      const was = q.p; q.p = Math.min(QUESTS[k].n, q.p + n);
      if (q.p === QUESTS[k].n && was < q.p) TG.toast('📜 ' + L('Даалгавар биеллээ! Самбараас шагналаа аваарай.', 'Quest complete! Claim it at the board.'));
    }
    S.save();
  }
  TG.villageReward = (c, x) => reward(c, x);   // lessons, quizzes and family activities pay out in Нутаг
  TG.villageQuest = (k, n) => quest(k, n);
  const checkAch = () => { if (TG.achievements) TG.achievements.check(); };
  TG._village = { wardrobe: () => wardrobe(), hud: () => hud(), recipes: () => Object.values(RECIPES).flat(), phaser: () => live && live.view, battle: (id) => startBattle(id), battleState: () => live && live.battle, shootNearest: () => shootNearest(), general: () => generalModal(), fp: () => openFP(), live: () => live, milk: (id) => milkGame(id), station: (st) => dairyStation(st), goTo: (...a) => goTo(...a), lots: () => lotsArr(), build: (i) => TG.gerwork.build(i), together: (id) => together(id), reconnect: () => net.rejoin(), shear: (i) => TG.gerwork.shear(i), shearable: (i) => TG.gerwork.shearable(i), felt: () => TG.gerwork.felt(), invite: (id) => net.send({ t: 'wr-invite', to: id }), context: () => contextAction(), arena: () => arenaModal(), school: () => wrestleSchool(), practice: () => practiceBout(), tournament: (r) => tournament(r), dog: () => live && live.dog, lot: (i) => lotAction(i), archery: () => archeryGame(), emee: () => emeeVisit(), npc: (id) => npcTalk(id), enterGer: (i) => enterGer(i), mount: (c) => mount(c), dismount: () => dismount(), race: (c) => raceStart(c), raceState: () => live && live.race,
    tut: (st) => { if (live) live.tut = st; }, nomin: (cmd) => nomin(cmd), basar: () => openBasar(),
    questsState: () => ({ day: S.dkey(), list: quests(), defs: QUESTS, seen: V().questsSeen }),
    npcs: () => WD.objects.filter((o) => o.kind === 'npcq' && NPCS[o.id]).map((o) => ({ id: o.id, x: o.x, y: o.y, mark: npcMark(o.id), name: NPCS[o.id].name })), objects: () => WD.objects, jump: () => jump() }; // used by automated tests and the tutorial
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
  /** Button props that act the moment a finger lands: phones send no click for a second finger (one thumb steering, the other pressing).
   *  A keyboard click (detail 0) still acts; the click that follows a press does not act again. A finger's touch is cancelled at the
   *  start: no click comes after it (a window the press just opened would take that click), and the village engine leaves it alone. */
  const press = (fn) => ({ onpointerdown: (e) => { if (e.button === 0) fn(); }, onclick: (e) => { if (e.detail === 0) fn(); }, ontouchstart: (e) => { if (e.cancelable) e.preventDefault(); } });
  const ZASUUL = { deel: 'gold', skin: '#D9A06E', hat: 'mongol', face: null, neck: 'khadag', pet: null };
  TG.drawAvatarPixel = (ctx, look, scale) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(PX.char(look, 0, 0), 0, 0, 16 * scale, 28 * scale); };

  // ================================================================ eating and drinking: energy for running, and a taste of Mongolian food
  const F = (id, e, kind, mn, en, energy, price, fmn, fen) => ({ id, e, kind, name: Tx(mn, en), energy, price, fact: Tx(fmn, fen) });
  const FOODS = [
    F('buuz', '🥟', 'meat', 'Бууз', 'Buuz', 30, 12, 'Бууз бол Цагаан сарын гол хоол. Айл бүр олон зуун бууз чимхдэг.', 'Buuz are the main dish of Tsagaan Sar. Families pinch hundreds of them.'),
    F('khuushuur', '🥟', 'meat', 'Хуушуур', 'Khuushuur', 25, 10, 'Хуушуур бол бууз шиг махтай боов, гэхдээ тосонд шардаг. Наадмаар хамгийн их иддэг.', 'Khuushuur are like buuz but fried flat in oil. Everyone eats them at Naadam.'),
    F('khorkhog', '🍖', 'meat', 'Хорхог', 'Khorkhog', 45, 25, 'Хорхогийг махыг халуун чулуутай хамт саванд битүү жигнэж хийдэг. Баяр ёслолоор хийнэ.', 'Khorkhog is meat cooked with hot stones in a closed pot, made for celebrations.'),
    F('tsuivan', '🍝', 'meat', 'Цуйван', 'Tsuivan', 35, 14, 'Цуйван: гоймон, мах, ногоог хуурч жигнэдэг. Олон хүн үндэсний хоол гэж нэрлэдэг.', 'Tsuivan is noodles stir-fried with meat and vegetables, often called the national dish.'),
    F('shul', '🍜', 'meat', 'Гурилтай шөл', 'Noodle soup', 30, 12, 'Гурилтай шөл: мах, төмс, лууван, гоймонтой. Хүйтэн өвөл дулаацуулна.', 'Guriltai shul has meat, potato, carrot and noodles. It warms you up in winter.'),
    F('borts', '🥩', 'meat', 'Борц', 'Borts', 20, 8, 'Борц бол өвөл салхинд хатаасан мах. Нунтаглаад халуун усанд хийж шөл болгодог.', 'Borts is meat dried in the winter wind. Crushed into hot water, it becomes soup.'),
    F('salad', '🥗', 'veg', 'Ногоон салат', 'Vegetable salad', 15, 8, 'Байцаа, лууван, өргөст хэмхээр хийсэн салат витаминаар баян.', 'A salad of cabbage, carrot and cucumber is full of vitamins.'),
    F('tarvas', '🍉', 'veg', 'Тарвас', 'Watermelon', 15, 10, 'Ховд аймгийн Мянгад сумын тарвас алдартай.', 'Watermelons from Myangad in Khovd province are famous.'),
    F('aaruul', '🧀', 'milk', 'Ааруул', 'Aaruul', 10, 3, 'Ааруулыг ээдмийг нарны гэрэлд хатааж хийдэг. Удаан хадгалагддаг.', 'Aaruul is milk curd dried in the sun. It keeps for a very long time.'),
    F('boortsog', '🍪', 'milk', 'Боорцог', 'Boortsog', 12, 4, 'Боорцог бол тосонд шарсан гурилан боов. Цагаан сараар өндөр ул боов засдаг.', 'Boortsog are fried dough cookies. At Tsagaan Sar they are stacked into a tall ul boov.'),
    F('urum', '🧈', 'milk', 'Өрөм', 'Öröm cream', 15, 6, 'Өрөм бол сүүг зөөлөн буцалгаж хөргөхөд дээр нь тогтдог өтгөн цөцгий.', 'Öröm is the thick cream that forms when milk is gently boiled and left to cool.'),
    F('tarag', '🥣', 'milk', 'Тараг', 'Tarag yogurt', 15, 6, 'Тараг бол исгэсэн сүү. Сарлагийн сүүгээр хийсэн тараг их өтгөн байдаг.', 'Tarag is a yogurt. Made from yak milk, it is extra thick.'),
    F('baursak', '🍩', 'milk', 'Баурсак', 'Baursak', 15, 6, 'Баурсак бол казахуудын тосонд шарсан зөөлөн боов. Зочинд цайтай хамт тавьдаг.', 'Baursak are soft fried dough balls from Kazakh families, served to guests with tea.'),
    F('tsai', '🍵', 'drink', 'Сүүтэй цай', 'Milk tea', 15, 4, 'Монгол сүүтэй цайнд бага зэрэг давс хийдэг! Зочинд хамгийн түрүүнд цай өргөнө.', 'Mongolian milk tea has a pinch of salt! Guests are always offered tea first.'),
    F('airag', '🥛', 'drink', 'Айраг', 'Airag', 20, 10, 'Айргийг гүүний сүүг хөхүүрт мянга гаруй удаа бүлж исгэдэг. Исгэлэн ундаа тул бага багаар уудаг.', 'Airag is mare’s milk churned over a thousand times in the khukhuur. It is sour and fermented, so drink only a little.'),
    F('khoormog', '🥛', 'drink', 'Хоормог', 'Khoormog', 20, 12, 'Хоормог бол тэмээний сүүгээр исгэсэн говийн ундаа. Айргаас ч илүү тэжээллэг.', 'Khoormog is fermented camel milk from the Gobi, even richer than airag.'),
    F('chatsargana', '🧃', 'drink', 'Чацарганы шүүс', 'Sea buckthorn juice', 15, 8, 'Чацаргана С витаминаар маш баян. Увс нутагт элбэг ургадаг.', 'Sea buckthorn is packed with vitamin C. It grows thickly in Uvs.'),
    F('us', '💧', 'drink', 'Цэвэр ус', 'Clean water', 5, 0, 'Ус бол амьдралын эх. Монголчууд ус, голоо бохирдуулдаггүй, хайрлан гамнадаг.', 'Water is the source of life. Mongolians never dirty their rivers and use water with care.'),
  ];
  const FOOD_TABS = [['meat', '🍖', Tx('Мах', 'Meat')], ['veg', '🥕', Tx('Ногоо, жимс', 'Veg & fruit')], ['milk', '🧀', Tx('Цагаан идээ', 'Dairy')], ['drink', '🥛', Tx('Уух', 'Drinks')]];
  const ENERGY_MAX = 100;
  const food = (id) => FOODS.find((f) => f.id === id);
  /** Eat or drink something: costs coins (free for dairy you made, at home or when a family offers it), fills energy, teaches a fact. */
  function eat(id, opts = {}) {
    const v = V(); if (!v) return false;
    const f = food(id); if (!f) return false;
    const mine = !opts.free && R.DAIRY[id] && (v.produce[id] || 0) > 0;           // dairy you made yourself is free
    if (mine) v.produce[id]--;
    const cost = mine || opts.free ? 0 : f.price;
    if (cost > v.coins) { TG.sfx.bad(); TG.toast('🪙 ' + L('Зоос хүрэлцэхгүй байна.', 'Not enough coins.')); return false; }
    v.coins -= cost;
    v.energy = Math.min(ENERGY_MAX, (v.energy ?? ENERGY_MAX) + f.energy);
    v.ate = v.ate || {}; const first = !v.ate[id]; v.ate[id] = (v.ate[id] || 0) + 1;
    f.kind === 'drink' ? TG.sfx.pour && TG.sfx.pour(0.5) : TG.sfx.pop && TG.sfx.pop();
    if (live) live.me.bubble = { text: f.e, t0: performance.now() };
    quest('eat'); S.save();
    if (first) { reward(0, 5); TG.toast(`${f.e} ${L('Анх удаа амсав!', 'First taste!')} ${tx(f.name)} · 💡 ${tx(f.fact)}`); }
    else TG.toast(`${f.e} ${tx(f.name)} +${f.energy} 🍖 · ${tx(f.fact)}`);
    if (live) hud();
    setTimeout(() => TG.achievements && TG.achievements.check(), 0);
    return true;
  }
  TG.villageEat = (id, opts) => eat(id, opts);   // used by the aimag trips (a herder family's local food)
  TG.FOODS = FOODS;
  function eatModal(opts = {}) {
    const v = V(); let cur = opts.tab || 'meat';
    const body = h('div');
    const draw = () => {
      const list = FOODS.filter((f) => f.kind === cur);
      const own = (f) => (R.DAIRY[f.id] && v.produce[f.id]) || 0, free = (f) => (opts.home && (f.kind === 'milk' || f.kind === 'drink')) || own(f) > 0;
      rc(body, h('h2', null, '🍽️ ', L('Хоол, ундаа', 'Food & drink')),
        h('p', { class: 'muted' }, L(`Хүч: ${Math.round(v.energy ?? ENERGY_MAX)}/${ENERGY_MAX} 🍖. Shift дарж гүйхэд хүч зарцуулагдана, хоол идвэл нөхөгдөнө.`, `Energy: ${Math.round(v.energy ?? ENERGY_MAX)}/${ENERGY_MAX} 🍖. Running (Shift) uses energy; food fills it up.`), opts.home ? h('b', null, ' ', L('Гэртээ цагаан идээ, ундаа үнэгүй!', 'At home, dairy and drinks are free!')) : null),
        h('div', { class: 'chips v-tabs' }, FOOD_TABS.map(([k, e, t]) => h('button', { class: 'chip' + (cur === k ? ' active' : ''), onclick: () => { cur = k; draw(); } }, e, ' ', tx(t)))),
        h('div', { class: 'v-list' }, list.length ? list.map((it) => {
          const price = free(it) ? 0 : it.price;
          return h('div', { class: 'v-row' }, h('span', { class: 'v-card-e' }, it.e), h('div', { class: 'v-row-b' }, h('b', null, tx(it.name), own(it) ? h('small', { class: 'v-own' }, ` ×${own(it)} ${L('өөрийн', 'yours')}`) : null, v.ate && v.ate[it.id] ? '' : h('small', { class: 'v-new' }, ` ${L('шинэ', 'new')}`)), h('small', null, `+${it.energy} 🍖 · ${tx(it.fact)}`)),
            h('button', { class: 'btn sm primary', onclick: () => { if (eat(it.id, { free: free(it) && !own(it) })) draw(); } }, it.kind === 'drink' ? L('Уух', 'Drink') : L('Идэх', 'Eat'), price ? ` ${price}🪙` : ''));
        }) : null),
        h('p', { class: 'privacy' }, '🙏 ', L('Монгол ёсоор хоолны дээжийг ахмад хүнд өргөж, хоол идэхээс өмнө гараа угаадаг.', 'By Mongolian custom the first portion goes to the eldest, and you wash your hands before eating.')));
    };
    draw();
    TG.modal(body, { cls: 'v-modal' });
  }

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
        live.online = false; live.others.clear(); live.lots = null; endRemoteMatch();
        if (this.closed) return setStatus('solo');
        setStatus('reconnecting');
        this.timer = setTimeout(() => this.open(), Math.min(10000, 1500 * ++this.retry));
      };
    },
    send(m) { if (this.ws && this.ws.readyState === 1 && live && live.online) this.ws.send(JSON.stringify(m)); },
    close() { this.closed = true; clearTimeout(this.timer); if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* closing */ } } },
    rejoin() { this.close(); if (!live) return; this.closed = false; live.online = false; live.others.clear(); setStatus('connecting'); this.open(); },
  };
  function handle(m) {
    const v = V();
    switch (m.t) {
      case 'welcome':
        live.online = true; live.offset = m.now - Date.now(); live.lots = m.lots || new Array(R.LOTS).fill(null); live.room = m.room; live.serverV = m.v;
        live.others.clear(); (m.players || []).forEach(addOther);
        live.chat = (m.chat || []).slice(-CHAT_KEEP); renderChat();
        setStatus('online');
        TG.toast(`🟢 ${L('Нутагт холбогдлоо', 'Connected to village')} · ${m.room}` + (live.others.size ? ` · ${live.others.size} ${L('найз байна', 'friends here')}` : ''));
        TG.gerwork.sync();
        if (m.v !== R.VERSION) setTimeout(() => TG.toast(L('⚠️ Сервер хуучин хувилбартай байна. Барилдаан зөв ажиллахын тулд серверийг дахин асаагаарай (Ctrl+C, дараа нь node server.js).', '⚠️ The server is running an old version. Restart it (Ctrl+C, then node server.js) so wrestling works.')), 2500);
        break;
      case 'join': addOther(m.p); addChat({ k: 'join', id: m.p.id, n: m.p.name }); TG.toast(`👋 ${m.p.name} ${L('нутагт ирлээ', 'joined the village')}`); hud(); break;
      case 'leave': { const o = live.others.get(m.id); if (o) addChat({ k: 'leave', id: m.id, n: o.name }); live.others.delete(m.id); hud(); break; }
      case 'lot': onLot(m); break;
      case 'wr-invite': case 'wr-declined': case 'wr-start': case 'wr-wait': case 'wr-result': case 'wr-end': onWrestleMsg(m); break;
      case 'move': { const o = live.others.get(m.id); if (o) { o.x = m.x; o.y = m.y; o.dir = m.dir; } break; }
      case 'jump': { const o = live.others.get(m.id); if (o) o.jt = performance.now(); break; }
      case 'look': { const o = live.others.get(m.id); if (o) { o.look = m.look; o.lvl = m.lvl; } break; }
      case 'say': {
        const who = m.id === v.id ? live.me : live.others.get(m.id);
        if (who) who.bubble = { text: m.k === 'e' ? R.EMOTES[m.i] : tx(R.PHRASES[m.i]), t0: performance.now() };
        if (who) addChat({ k: m.k, id: m.id, n: who === live.me ? live.name : who.name, i: m.i });
        break;
      }
      case 'census': {
        const first = !live.census; live.census = { total: m.total, nutag: m.nutag }; hud();
        const away = m.total - live.others.size - 1;                    // people on this server but in another room
        if (first && away > 0 && !live.others.size) TG.toast(live.room !== 'NUTAG' && m.nutag ? '👥 ' + L(`Үндсэн Нутагт ${m.nutag} хүн тоглож байна. Нэгдэхийн тулд өрөөний товч дээр дараарай.`, `${m.nutag} people are playing in the main village. Tap the room button to join them.`) : '👥 ' + L(`Энэ серверт өөр өрөөнд ${away} хүн байна. Ижил өрөөний код оруулбал хамт тоглоно.`, `${away} people on this server are in another room. Use the same room code to play together.`));
        break;
      }
      case 'replaced': // this profile was opened in another tab or device: stop here instead of fighting over it
        net.closed = true; live.replaced = true; live.online = false; live.others.clear(); setStatus('solo');
        TG.toast('🔁 ' + L('Энэ профайл өөр цонх эсвэл төхөөрөмж дээр нээгдлээ. Тэнд үргэлжлүүлэн тоглоорой.', 'This profile was opened in another tab or device. Keep playing there.'));
        break;
      case 'deny': deny(m.why); break;
      case 'error': TG.toast(L('Өрөөнд нэвтэрч чадсангүй.', 'Could not join the room.')); break;
    }
  }
  function addOther(p) { live.others.set(p.id, { ...p, px: p.x, py: p.y, petPos: { x: p.x, y: p.y + 0.6 }, bubble: null, moving: false }); }
  function setStatus(s) { if (live) { live.status = s; hud(); } }

  // ================================================================ хот айл: milking the animals and making the white foods (цагаан идээ)
  const yardKind = (id) => (id === 'zel' ? 'mare' : id.replace(/\d$/, ''));
  const stock = (k, n) => { const v = V(); v.produce[k] = Math.max(0, (v.produce[k] || 0) + n); };
  const MILK_FACT = {
    cow: Tx('Үнээг өглөө, орой саадаг. Саахын өмнө тугалыг нь бага зэрэг хөхүүлж сүүг нь ивлүүлдэг.', 'Cows are milked morning and evening. First the calf suckles a little so the milk starts to flow.'),
    goat: Tx('Ямааны сүү өтгөн, тэжээллэг. Ямаа, хонины сүүгээр ааруул, бяслаг хийдэг.', 'Goat milk is rich and nourishing. Goat and sheep milk make aaruul and cheese.'),
    mare: Tx('Зун гүүг 1.5–2 цаг тутам, өдөрт олон удаа саадаг. Унагыг нь зэлд уяж, саахын өмнө хөхүүлж сүүг ивлүүлдэг.', 'In summer mares are milked every 1.5–2 hours, many times a day. Their foals wait on the зэл line and suckle first to start the milk.'),
  };
  /** Milking: let the young one suckle to start the milk, then squeeze in rhythm when the marker is in the green. */
  function milkGame(id) {
    const kind = yardKind(id), A = R.DAIRY_ANIMALS[kind], v = V(); v.milkT = v.milkT || {};
    const wait = Math.ceil(((v.milkT[id] || 0) + A.wait * 1000 - Date.now()) / 1000);
    if (wait > 0) return TG.toast(`${A.e} ${L(`${tx(A.name)} амарч байна. ${wait} секундын дараа дахин саана.`, `The ${tx(A.name).toLowerCase()} is resting. Milk again in ${wait}s.`)}`);
    const NEED = 5, W2 = 180, H2 = 110;
    const cv = h('canvas', { class: 'v-milk', width: W2, height: H2 }), x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const msg = h('p', { class: 'v-milk-msg' }), btn = h('button', { class: 'btn primary big block' });
    let phase = 'young', good = 0, pos = 0, dir = 1, raf = 0, nuzzle = 0, done = false;
    const zone = () => [0.36, 0.64];
    const setPhase = (p) => {
      phase = p;
      if (p === 'young') { msg.textContent = L(`Эхлээд төлийг нь (${tx(A.young).toLowerCase()}) хөхүүлж сүүг нь ивлүүлье. “Тавих” дээр дар.`, `First let the ${tx(A.young).toLowerCase()} suckle so the milk flows. Press “Let it suckle”.`); btn.textContent = L(`${tx(A.young)} тавих`, 'Let it suckle'); }
      else if (p === 'milk') { msg.textContent = L('Одоо саа! Шар тэмдэг ногоон дотор орох үед дар. Зөөлөн, тайван.', 'Now milk! Press when the yellow marker is in the green. Gently and calmly.'); btn.textContent = L('Саах (Space)', 'Squeeze (Space)'); }
    };
    const press = () => {
      if (done) return;
      if (phase === 'young') { nuzzle = performance.now(); TG.sfx.pop && TG.sfx.pop(); btn.disabled = true; setTimeout(() => { btn.disabled = false; setPhase('milk'); }, 1400); return; }
      const [a, b] = zone();
      if (pos >= a && pos <= b) { good++; TG.sfx.pour && TG.sfx.pour(0.3 + good * 0.1); msg.textContent = '💧 '.repeat(good) + L(' Сайн байна!', ' Nice!'); }
      else { TG.sfx.tap(); msg.textContent = L('Арай эрт/хожуу. Тайван, хэмнэлтэй саа.', 'A bit early or late. Calm and steady.'); }
      if (good >= NEED) finish();
    };
    function finish() {
      done = true; v.milkT[id] = Date.now(); stock(A.gives, A.n); quest('milk'); reward(2, 6);
      const first = !(v.seen && v.seen['milk_' + kind]); v.seen = v.seen || {}; v.seen['milk_' + kind] = 1; S.save(); if (live) hud();
      TG.sfx.good();
      rc(box, h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, pic('dairy:' + A.gives, 64)), h('h2', null, `+${A.n} ${tx(R.DAIRY[A.gives].name)}`),
        h('div', { class: 'teach' }, h('b', null, '💡 ', first ? L('Мэдсэн үү?', 'Did you know?') : L('Сануулга', 'Remember')), h('p', null, tx(MILK_FACT[kind]))),
        h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => close() }, L('Гайхалтай!', 'Great!'))));
    }
    const loop = (ts) => {
      if (!cv.isConnected) return;
      pos += dir * 0.018; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      x.fillStyle = '#b89462'; x.fillRect(0, 0, W2, H2); x.fillStyle = '#9fd8f7'; x.fillRect(0, 0, W2, 34); x.fillStyle = '#76b947'; x.fillRect(0, 34, W2, 8);
      const mom = PX.beast(kind, 0), sc = kind === 'goat' ? 3 : 2.6;
      x.drawImage(mom, 34, 76 - mom.height * sc, mom.width * sc, mom.height * sc);
      const young = PX.beast(kind === 'mare' ? 'foal' : kind === 'goat' ? 'lamb' : 'botgo', 0), suck = phase === 'young' && ts - nuzzle < 1400 && nuzzle;
      if (phase === 'young' || suck) x.drawImage(young, suck ? 70 : 128, 76 - young.height * 2, young.width * 2, young.height * 2);
      x.fillStyle = '#2b1e2e'; x.fillRect(96, 62, 22, 16); x.fillStyle = '#a5a5b0'; x.fillRect(98, 63, 18, 14); x.fillStyle = '#ffffff'; x.fillRect(98, 77 - Math.round((good / NEED) * 13), 18, Math.round((good / NEED) * 13)); // the pail filling up
      if (phase === 'milk') {
        const bx = 14, bw = W2 - 28, [a, b] = zone();
        x.fillStyle = '#2b1e2e'; x.fillRect(bx - 2, 88, bw + 4, 14); x.fillStyle = '#e6c48a'; x.fillRect(bx, 90, bw, 10); x.fillStyle = '#5c9a36'; x.fillRect(bx + a * bw, 90, (b - a) * bw, 10);
        x.fillStyle = '#f7c646'; x.fillRect(Math.round(bx + pos * bw) - 2, 86, 4, 18);
      }
      raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('click', press);
    const key = (e) => { if ((e.code === 'Space' || e.code === 'KeyE') && document.querySelectorAll('.modal-back').length === 1) { e.preventDefault(); e.stopPropagation(); if (e.type === 'keydown' && !e.repeat) press(); } };
    window.addEventListener('keydown', key, true);
    const box = h('div', null, h('h2', null, `${A.e} ${L(`${tx(A.name)} саах`, `Milk the ${tx(A.name).toLowerCase()}`)}`), cv, msg, btn);
    TG._village.milkNow = () => ({ pos, phase, good, done }); // used by automated tests
    setPhase('young');
    const close = TG.modal(box, { cls: 'v-modal', onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); } });
    raf = requestAnimationFrame(loop);
  }
  // recipes at each station: what milk they need, what they give, the real steps, and how you do them
  const RECIPES = {
    rack: [{ id: 'aaruul', need: { milk: 2 }, gives: 3,
      fact: Tx('Ааруулыг наранд хэд хоног хатаадаг. Хатсан ааруул бүтэн жил хадгалагддаг тул өвөл, аянд авч явдаг.', 'Aaruul dries in the sun for several days. Dried, it keeps for a whole year, so herders take it on journeys and through winter.') }],
    tulga: [{ id: 'urum', need: { milk: 2 }, gives: 1,
      fact: Tx('Өрөм бол сүүг зөөлөн буцалгаж, самраад, хөргөхөд дээр нь тогтдог өтгөн цөцгий. Цагаан сараар хамгийн хүндэт зочинд өргөдөг.', 'Öröm is the thick cream that forms on top of gently boiled, ladled and cooled milk, offered to honoured guests at Tsagaan Sar.') },
      { id: 'tarag', need: { milk: 1 }, gives: 2,
      fact: Tx('Тарагны “хөрөнгө”-ийг айлууд үеэс үед хадгалж, бие биедээ өгдөг.', 'Families keep their tarag starter for generations and share it with each other.') }],
    churn: [{ id: 'airag', need: { mare: 2 }, gives: 2,
      fact: Tx('Айргийг мянга гаруй удаа бүлдэг. Айлд орж ирсэн хүн бүр хэдэн удаа бүлээд өгдөг заншилтай.', 'Airag is churned over a thousand times, and everyone who comes into the ger gives it a few stirs.') }],
  };
  /** A dairy station: pick a recipe you have the milk for, then do the real steps (tap each in order, or churn/ladle many times). */
  function dairyStation(st) {
    const v = V(), body = h('div');
    const has = (need) => Object.entries(need).every(([k, n]) => (v.produce[k] || 0) >= n);
    const title = { rack: L('Ааруулын тавиур', 'Aaruul drying rack'), tulga: L('Тулга: сүү буцалгах', 'Outdoor stove: boil milk'), churn: L('Хөхүүр: айраг бүлэх', 'Khukhuur: churn airag') }[st];
    const list = () => rc(body, h('h2', null, title), h('p', { class: 'muted' }, L('Танд: ', 'You have: '), `🥛 ${v.produce.milk || 0} · 🍶 ${v.produce.mare || 0}`),
      h('div', { class: 'v-list' }, RECIPES[st].map((r) => { const d = R.DAIRY[r.id], ok = has(r.need);
        return h('div', { class: 'v-row' + (ok ? '' : ' locked') }, pic('dairy:' + r.id, 32), h('div', { class: 'v-row-b' }, h('b', null, `${tx(d.name)} ×${r.gives}`), h('small', null, Object.entries(r.need).map(([k, n]) => `${R.DAIRY[k].e} ${n} ${tx(R.DAIRY[k].name)}`).join(' + '))),
          h('button', { class: 'btn sm primary', disabled: !ok, onclick: () => make(r) }, ok ? L('Хийх', 'Make') : L('Саах хэрэгтэй', 'Milk first'))); })),
      h('p', { class: 'privacy' }, '🐄 ', L('Сүү авахын тулд үнээ, ямаа, гүүгээ саагаарай.', 'Milk the cows, goats and mares to get milk.')));
    // every step is done by hand on the village stage (dairywork.js); the milk is used only once the food is made
    async function make(r) {
      close();
      if (!(await TG.dairywork.make(r.id)) || !live) return;
      if (!has(r.need)) return TG.toast('🥛 ' + L('Сүү хүрэлцэхгүй байна.', 'Not enough milk.'));
      Object.entries(r.need).forEach(([k, n]) => stock(k, -n)); stock(r.id, r.gives); quest('dairy'); reward(3, 10);
      v.seen = v.seen || {}; const first = !v.seen['made_' + r.id]; v.seen['made_' + r.id] = 1; S.save(); hud(); TG.sfx.good(); if (first) TG.confetti(40);
      const done = TG.modal(h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, pic('dairy:' + r.id, 64)), h('h2', null, `+${r.gives} ${tx(R.DAIRY[r.id].name)}`),
        h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(r.fact))),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => { done(); dairyStation(st); } }, L('Дахиад хийх', 'Make more')), h('button', { class: 'btn primary', onclick: () => done() }, L('Боллоо', 'Done')))), { cls: 'v-modal' });
    }
    list();
    const close = TG.modal(body, { cls: 'v-modal' });
  }

  function deny(why) {
    TG.sfx.bad();
    TG.toast({ taken: L('Энэ газар аль хэдийн эзэнтэй байна.', 'That spot is already taken.'), own: L('Танд аль хэдийн гэр байна.', 'You already have a ger.'), busy: L('Тэр хүн одоо завгүй байна.', 'That player is busy right now.') }[why] || L('Болсонгүй.', "That didn't work."));
  }
  const fmtLeft = (ms) => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}${L('с', 's')}`; };

  // ================================================================ screen
  TG.gerwork.init({ V, live: () => live, net, reward, quest, factCard, lotsArr, enterGer, colours: (i) => gerColours(i), save: () => S.save(), refresh: () => { if (live) { hud(); updateCtx(); } } });
  TG.villageScreen = ({ setCleanup }) => {
    quests();
    const canvas = h('canvas', { class: 'v-canvas', 'aria-label': L('Нутаг: тоглоомын талбар', 'Village play area') });
    const els = {
      me: h('button', { class: 'v-me px-frame', 'aria-label': L('Цэс', 'Menu'), onclick: () => TG.openMenu() }), coins: h('button', { class: 'v-pill px-frame', onclick: () => shopModal() }),
      energy: h('button', { class: 'v-pill px-frame v-energy', title: L('Хоол, ундаа', 'Food & drink'), onclick: () => eatModal() }), net: h('button', { class: 'v-pill px-frame v-net', onclick: () => roomModal() }),
      season: h('button', { class: 'v-pill px-frame v-season', onclick: () => TG.seasons.open() }),
      loc: h('button', { class: 'v-loc px-frame', onclick: () => TG.go('passport') }),
      ctx: h('button', { class: 'v-act px-frame hidden', ...press(() => { const a = contextAction(); if (a) doAction(a); }) }),
      hotbar: h('div', { class: 'v-hotbar px-frame', role: 'toolbar', 'aria-label': L('Цагаан идээ', 'Dairy') }),
      race: h('div', { class: 'v-race px-frame hidden', 'aria-live': 'polite' }),
      battle: h('div', { class: 'v-race v-battle px-frame hidden', 'aria-live': 'polite' }),
      shoot: h('button', { class: 'v-sprint v-shoot px-frame hidden', 'aria-label': L('Харвах (F)', 'Shoot (F)'), ...press(() => shootNearest()) }, '🏹'),
      sprint: h('button', { class: 'v-sprint px-frame hidden', 'aria-label': L('Чү! (Shift)', 'Chü! (Shift)'),
        onpointerdown: (e) => { e.preventDefault(); if (live && live.race) live.race.sprint = true; }, onpointerup: () => { if (live && live.race) live.race.sprint = false; }, onpointerleave: () => { if (live && live.race) live.race.sprint = false; }, oncontextmenu: (e) => e.preventDefault() }, L('Чү!', 'Chü!')),
      horse: h('button', { class: 'v-round px-frame hidden', 'aria-label': 'horse', title: L('Мориноос буух', 'Get off the horse'), onclick: () => dismount() }, pic('ui:horse', 34)),
      mini: h('canvas', { class: 'v-mini px-frame', width: WD.W * 3, height: WD.H * 3, 'aria-label': L('Газрын зураг', 'Map'), title: L('Газрын зураг: дарж томруулна', 'Map: tap to enlarge') }),
      run: h('button', { class: 'v-run px-frame', 'aria-label': L('Гүйх', 'Run'), 'aria-pressed': 'false', title: L('Гүйх (Shift)', 'Run (Shift)'), ...press(() => { if (!live) return; live.runLock = !live.runLock; live.els.run.classList.toggle('on', live.runLock); live.els.run.setAttribute('aria-pressed', String(live.runLock)); TG.sfx.tap(); }) }, '🏃'),
      fp: h('button', { class: 'v-round px-frame v-fpbtn', 'aria-label': L('Өөрийн нүдээр', 'First person'), title: L('Өөрийн нүдээр (3D)', 'First person (3D)'), onclick: () => openFP() }, '👁'),
      jump: h('button', { class: 'v-jump px-frame', 'aria-label': L('Үсрэх', 'Jump'), title: L('Үсрэх (Space)', 'Jump (Space)'), ...press(() => jump()) }, '⤒'),
      talk: h('button', { class: 'v-round px-frame v-talk', 'aria-label': 'talk', onclick: () => talk() }, pic('ui:chat', 32), h('i', { class: 'v-badge hidden' })),
      more: h('div', { class: 'v-more', onclick: (e) => { if (e.target.closest('button') && !e.target.closest('.v-music')) e.currentTarget.classList.remove('open'); } }),
      music: h('button', { class: 'v-round px-frame v-music hidden', 'aria-label': L('Хөгжим', 'Music'), onclick: () => { TG.music.toggle(); } }),
      help: h('button', { class: 'v-pill px-frame v-help', 'aria-label': L('Заавар', 'Tutorial'), title: L('Заавар: хөтөчтэй хамт тоглоом сурах', 'Tutorial: learn the game with the guide'), onclick: () => TG.tutorial && TG.tutorial.start(true) }, '?'),
      stick: h('div', { class: 'v-stick', 'aria-hidden': 'true' }, h('i')),
      stick2: h('div', { class: 'v-stick p2', 'aria-hidden': 'true' }, h('i')),
      together: h('button', { class: 'v-pill px-frame v-together', 'aria-label': L('Хамтдаа тоглох', 'Play together'), title: L('Хамтдаа: нэг дэлгэц дээр хоёулаа', 'Together: two players on one screen'), onclick: () => togetherModal() }, '🤝'),
      stickHint: h('div', { class: 'v-stick-hint' + (coarse && !(V() || {}).stickUsed ? '' : ' gone'), 'aria-hidden': 'true' }, L('👆 Дэлгэц дээр чирж алх', '👆 Drag on the screen to walk')),
    };
    const root = h('div', { class: 'village' }, canvas,
      h('div', { class: 'v-top' },
        h('div', { class: 'v-mecol' }, els.me, els.loc, els.mini), h('div', { class: 'v-pills' }, els.coins, els.energy, els.season, els.net, els.together, els.help)),
      els.race, els.battle, els.stick, els.stick2, els.stickHint,
      h('div', { class: 'v-bottom' },
        // the three buttons used most stay out; the rest wait behind "more" so the map stays clear
        h('div', { class: 'v-tools' },
          els.horse,
          h('button', { class: 'v-round px-frame v-basar', 'aria-label': 'basar', title: L('Басар (B)', 'Basar (B)'), onclick: () => openBasar() }, pic('ui:dog', 34)),
          els.talk,
          h('button', { class: 'v-round px-frame', 'aria-label': 'bag', onclick: () => bag() }, pic('ui:bag', 32)),
          h('div', { class: 'v-more-wrap' },
            h('button', { class: 'v-round px-frame v-morebtn', 'aria-label': L('Бусад', 'More'), 'aria-expanded': 'false', onclick: (e) => { const open = els.more.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); TG.sfx.tap(); } }, '•••'),
            els.more)),
        els.hotbar, els.run, els.jump, els.ctx, els.sprint, els.shoot));
    els.more.append(els.fp,
      h('button', { class: 'v-round px-frame', 'aria-label': 'learn', title: L('Сурах', 'Learn'), onclick: () => TG.go('learn') }, pic('ui:book', 32)),
      h('button', { class: 'v-round px-frame', 'aria-label': 'quests', title: L('Даалгавар', 'Quests'), onclick: () => questModal() }, pic('ui:scroll', 32)),
      els.music);
    setTimeout(() => start(root, canvas, els, setCleanup), 0);
    return root;
  };

  function start(root, canvas, els, setCleanup) {
    if (!root.isConnected) return;
    const v = V(), prof = S.active();
    if (v.look.ride) { v.look.ride = null; S.save(); }
    const qRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    if (R.ROOM_RE.test(qRoom) && v.room !== qRoom) { v.room = qRoom; S.save(); }
    const sp = v.pos && !WD.blocked(Math.floor(v.pos.x + 0.5), Math.floor(v.pos.y + 0.82)) ? v.pos : { x: 17, y: 13 };
    live = { root, canvas, els, name: prof.name, status: 'connecting', online: false, offset: 0, lots: null, room: v.room,
      me: { x: Math.floor(sp.x + 0.5), y: Math.floor(sp.y + 0.82), px: sp.x, py: sp.y, vx: 0, vy: 0, path: [], dir: 0, moving: false, bubble: null, petPos: { x: sp.x, y: sp.y + 0.6 }, sent: { x: sp.x, y: sp.y }, netT: 0, stuck: 0 },
      season: TG.seasons.current().id, fx: [], cam: { x: sp.x, y: sp.y }, dog: { x: sp.x + 0.7, y: sp.y + 0.2, moving: false, flip: false, idle: 0, bubble: null, nextFact: performance.now() + 25000 }, keys: new Set(), others: new Map(), pending: null, floaters: [], match: null,
      sheep: [[24, 20], [28, 22], [31, 20], [26, 23]].map(([x, y], i) => ({ i, x, y, px: x, py: y, next: 1 + i, flip: false })),
      view: null, ctxTimer: 0, sel: null };
    document.fonts && document.fonts.load('10px Tiny5', 'Нутаг ӨҮ');
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', clearKeys); // phones lock or switch apps without a blur, and the lifted finger is never heard
    root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); }); // HUD buttons never keep focus
    live.miniBase = miniBase();
    els.mini.addEventListener('pointerdown', onMiniTap);
    net.connect(); hud(); updateCtx(); TG.gerwork.sync();
    live.unMusic = TG.music ? TG.music.onChange(() => hud()) : null;
    // the Phaser engine runs the loop: it asks update() to move everything, then model() what to draw
    live.view = TG.villageView.mount(canvas, { tick: (dt) => live && update(dt), model, paused: () => !!((TG.scene && TG.scene.active()) || (TG.fp && TG.fp.active())), pointer, mini: () => live && drawMini() });
    if (!v.tutorial && !v.tutorialSeen && TG.tutorial) setTimeout(() => live && live.root === root && TG.tutorial.start(false), 350); // first visit: the guide walks you through the game
    else if (!v.tips) tips();
    setCleanup(stop);
  }
  const clearKeys = () => { if (live) { live.keys.clear(); live.run = false; endStick(); if (live.p2) { live.p2.keys.clear(); live.p2.running = false; endStick2(); } } };
  const onHide = () => { if (document.hidden) clearKeys(); };
  function stop() {
    if (!live) return;
    live.race = null;
    if (TG.tutorial) TG.tutorial.stop();
    live.view.destroy();
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', clearKeys);
    net.close();
    if (live.unMusic) live.unMusic();
    const v = V(); if (v) { v.pos = { x: +live.me.px.toFixed(2), y: +live.me.py.toFixed(2) }; v.energy = Math.round(v.energy * 10) / 10; S.save(); }
    live = null;
  }
  // ---------------------------------------------------------------- HUD
  function hudEnergy() { if (!live) return; const en = Math.round(V().energy ?? 100); live.els.energy.textContent = `🍖 ${en}`; live.els.energy.classList.toggle('low', en < 20); }
  function hud() {
    if (!live) return;
    const v = V(), L1 = R.level(v.xp), e = live.els;
    rc(e.me, portrait(v.look, 30), h('span', { class: 'v-me-body' }, h('b', null, live.name, h('span', { class: 'v-caret', 'aria-hidden': 'true' })), h('span', { class: 'v-lvl-row' }, h('span', { class: 'v-lvl' }, `${L('ТҮВ', 'LV')} ${L1.l}`), h('span', { class: 'v-xp' }, h('i', { style: { width: (L1.cur / L1.need) * 100 + '%' } })))));
    rc(e.coins, pic('ui:coin', 20), h('span', null, v.coins));
    hudEnergy();
    e.battle.classList.toggle('hidden', !live.battle); e.shoot.classList.toggle('hidden', !live.battle); if (live.battle) e.battle.textContent = battleLabel();
    const n = live.others.size + 1;
    e.net.className = 'v-pill px-frame v-net ' + live.status;
    const sea = TG.seasons.current(); e.season.textContent = `${sea.icon} ${tx(sea.name)}`;
    const prof = S.active(), ai = TG.aimags && TG.aimags.byId(prof.aimag), et = TG.ethnic && TG.ethnic.byId(prof.eth);
    e.loc.textContent = ai ? `📍 ${tx(ai.name)}${et ? ' · ' + tx(et.name) : ''}` : `📍 ${L('Нутгаа сонго', 'Pick home')}`;
    const away = live.status === 'online' && live.census ? Math.max(0, live.census.total - n) : 0;
    e.net.classList.toggle('alert', away > 0 && n === 1);
    e.net.textContent = live.status === 'online' ? `● ${n} · ${live.room}${away ? ` (+${away})` : ''}` : live.status === 'solo' ? `○ ${L('Ганцаараа', 'Solo')}` : `◌ ${L('Холбогдож…', 'Connecting…')}`;
    hotbar();
    e.horse.classList.toggle('hidden', !live.ride || !!live.race);
    if (TG.music) { e.music.classList.toggle('hidden', !TG.music.available); e.music.textContent = '♪'; e.music.classList.toggle('off', !TG.music.playing); e.music.title = TG.music.title; }
  }
  /** The bottom bar: your milk and the dairy foods you made. Tap a food to eat it. */
  function hotbar() {
    const v = V(), have = Object.keys(R.DAIRY).filter((k) => v.produce[k] > 0);
    rc(live.els.hotbar, ...(have.length ? have.map((k) => h('button', { class: 'v-slot-btn', title: tx(R.DAIRY[k].name),
      ...press(() => { if (R.DAIRY[k].food) eat(k); else TG.toast(`${R.DAIRY[k].e} ${tx(R.DAIRY[k].name)}: ${L('тавиур, тулга, хөхүүр дээр цагаан идээ хийнэ.', 'make dairy foods at the rack, stove or churn.')}`); }) }, pic('dairy:' + k, 28), h('small', null, v.produce[k])))
      : [h('button', { class: 'v-slot-btn empty', title: L('Хот айл', 'Dairy yard'), ...press(() => goTo({ x: 9, y: 14 }, null)) }, pic('beast:cow', 28), L('Саах →', 'Go milk →'))]));
  }
  /** While a ger is still to be built, a sheep with its wool grown is for shearing; otherwise for petting. */
  const sheepAct = (q) => (V().ger.stage < R.GER_DONE && TG.gerwork.shearable(q.i) ? 'shear' : 'sheep');
  function contextAction() {
    if (!live || live.me.path.length || live.race) return null;
    const m = live.me, fx = m.px + 0.5, fy = m.py + 0.82;
    if (live.battle) { const e = nearestEnemy(fx, fy, 1.7); if (e) return { type: 'lasso', e }; }
    let best = null, bd = 1.05;
    const consider = (d, a) => { if (d < bd) { bd = d; best = a; } };
    for (const o of WD.objects) if (o.door) consider(Math.hypot(fx - (o.door.x + 0.5), fy - (o.door.y + 0.7)), o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : o.kind === 'npcq' ? { type: 'npcq', id: o.id } : { type: o.id });
    consider(Math.hypot(fx - (WD.DOCK.x + 0.5), fy - (WD.DOCK.y + 0.7)), { type: 'fish' });
    for (const q of live.sheep) consider(Math.hypot(fx - (q.px + 0.5), fy - (q.py + 0.7)) - 0.35, { type: sheepAct(q), s: q });
    if (best) return best;
    if ((WD.g[m.y] || [])[m.x] === 'a') return { type: 'arena' };
    return null;
  }
  function labelFor(a) {
    switch (a.type) {
      case 'home': return ['ui:house', L('Хувцас', 'Wardrobe')];
      case 'arcade': return ['ui:book', L('Сурах', 'Learn')];
      case 'academy': return ['ui:book', L('Монгол бичиг', 'Mongol script')];
      case 'lasso': return ['ui:horse', L('Уургадах', 'Lasso')];
      case 'general': return ['ui:trophy', L('Жанжин', 'General')];
      case 'historian': return ['ui:book', L('Түүхч', 'Historian')];
      case 'shop': return ['ui:shop', L('Дэлгүүр', 'Shop')];
      case 'board': return ['ui:scroll', L('Даалгавар', 'Quests')];
      case 'well': return ['ui:drop', L('Ус уух', 'Drink water')];
      case 'zel': return ['beast:mare', L('Гүү саах', 'Milk a mare')];
      case 'cow1': case 'cow2': return ['beast:cow', L('Үнээ саах', 'Milk the cow')];
      case 'goat1': case 'goat2': return ['beast:goat', L('Ямаа саах', 'Milk the goat')];
      case 'churn': return ['dairy:airag', L('Айраг бүлэх', 'Churn airag')];
      case 'tulga': return ['dairy:urum', L('Өрөм, тараг', 'Öröm & tarag')];
      case 'rack': return ['dairy:aaruul', L('Ааруул хийх', 'Make aaruul')];
      case 'fish': return ['ui:fish', L('Загасчлах', 'Fish')];
      case 'sheep': return ['ui:heart', L('Илбэх', 'Pet')];
      case 'shear': return ['part:wool', L('Хяргах', 'Shear')];
      case 'felt': return ['part:esgii', TG.gerwork.feltLabel()];
      case 'lot': { const l = lotsArr()[a.i]; return ['ui:ger', !l || (l.by === V().id && R.lotStage(l) < R.GER_DONE) ? L('Гэр барих', 'Build a ger') : l.by === V().id ? L('Миний гэр', 'My ger') : L('Зочлох', 'Visit')]; }
      case 'zasuul': case 'arena': return ['ui:wrestle', L('Барилдах', 'Wrestle')];
      case 'ovoo': return ['ui:ovoo', L('Овоо тахих', 'Visit ovoo')];
      case 'uya': return ['ui:horse', L('Морь', 'Horses')];
      case 'archery': return ['ui:bow', L('Сур харваа', 'Archery')];
      case 'emee': return ['ui:heart', L('Эмээ', 'Grandma')];
      case 'npcq': return ['ui:chat', L('Ярилцах', 'Talk')];
    }
    return ['ui:star', ''];
  }
  function updateCtx() {
    if (!live) return;
    const a = contextAction(), b = live.els.ctx;
    b.classList.toggle('hidden', !a);
    if (a) { const [k, t] = labelFor(a); rc(b, pic(k, 36), h('span', null, t), coarse ? null : h('kbd', { class: 'v-key' }, 'E')); }
  }
  function doAction(a) {
    if (!a || !live || live.race) return; // no shops or menus in the middle of a race
    switch (a.type) {
      case 'home': return wardrobe();
      case 'arcade': return TG.go('learn');
      case 'academy': return TG.go('bichig');
      case 'lasso': return lasso(a.e);
      case 'general': return generalModal();
      case 'historian': return TG.history && TG.history.open();
      case 'shop': return shopModal();
      case 'board': return questModal();
      case 'well': return eat('us', { free: true });
      case 'zel': case 'cow1': case 'cow2': case 'goat1': case 'goat2': return milkGame(a.type);
      case 'churn': case 'tulga': case 'rack': return dairyStation(a.type);
      case 'fish': return fishing();
      case 'sheep': return petSheep(a.s);
      case 'shear': { const m = live.me; if (Math.abs(a.s.x - m.x) > 1 || Math.abs(a.s.y - m.y) > 1) return TG.toast(L('Хонь холдчихлоо 🐑', 'The sheep wandered off 🐑')); return TG.gerwork.shear(a.s.i); }
      case 'felt': return TG.gerwork.felt();
      case 'lot': return lotAction(a.i);
      case 'zasuul': case 'arena': return arenaModal();
      case 'ovoo': return ovooAction();
      case 'uya': return uyaModal();
      case 'archery': return archeryModal();
      case 'emee': return emeeVisit();
      case 'npcq': return npcTalk(a.id);
    }
  }

  // ---------------------------------------------------------------- input
  // a finger (or mouse) that drags on the map becomes a joystick right where it landed; a quick tap walks to that spot
  const STICK_R = 50;
  function pointer(type, p) { if (TG.tasks && TG.tasks.active() && type !== 'up') return; if (type === 'down') onPointerDown(p); else if (type === 'move') onPointerMove(p); else onPointerUp(p); }
  /** p comes from the Phaser view: id, x/y (screen), wx/wy (world art px). */
  function onPointerDown(e) {
    if (!live) return;
    if (live.els.more.classList.contains('open')) { live.els.more.classList.remove('open'); return; } // a tap on the map just closes "more"
    if (live.els.mini.classList.contains('big')) { live.els.mini.classList.remove('big'); return; }
    if (TG.dialog && TG.dialog.active() && !TG.dialog.free()) return; // the guide just talking doesn't stop you walking (tap or joystick)
    if (live.p2 && !live.p2.hidden && e.x > innerWidth / 2) { if (!live.drag2) live.drag2 = { id: e.id, x0: e.x, y0: e.y, on: false }; return; } // player 2's thumb
    if (live.drag) return; // one finger steers, the other presses buttons
    live.drag = { id: e.id, x0: e.x, y0: e.y, wx: e.wx, wy: e.wy, on: false };
  }
  function onPointerMove(e) {
    const d2 = live && live.drag2;
    if (d2 && d2.id === e.id) { // player 2's joystick
      const dx = e.x - d2.x0, dy = e.y - d2.y0, dist = Math.hypot(dx, dy), st = live.els.stick2;
      if (!d2.on) { if (dist < 12) return; d2.on = true; const r = live.root.getBoundingClientRect(); st.style.left = d2.x0 - r.left + 'px'; st.style.top = d2.y0 - r.top + 'px'; st.classList.add('on'); }
      slideBase(d2, e.x, e.y, st);
      const q = dist > STICK_R ? STICK_R / dist : 1; live.p2.stick = { x: (dx * q) / STICK_R, y: (dy * q) / STICK_R };
      st.firstChild.style.transform = `translate(${Math.round(dx * q)}px, ${Math.round(dy * q)}px)`; return;
    }
    const d = live && live.drag; if (!d || d.id !== e.id) return;
    const dx = e.x - d.x0, dy = e.y - d.y0, dist = Math.hypot(dx, dy), els = live.els;
    if (!d.on) {
      if (dist < 12) return;
      d.on = true; live.me.path = []; live.pending = null;
      const r = live.root.getBoundingClientRect();
      els.stick.style.left = d.x0 - r.left + 'px'; els.stick.style.top = d.y0 - r.top + 'px'; els.stick.classList.add('on');
      if (!els.stickHint.classList.contains('gone')) { els.stickHint.classList.add('gone'); const v = V(); if (v) { v.stickUsed = true; S.save(); } }
    }
    slideBase(d, e.x, e.y, els.stick);
    const q = dist > STICK_R ? STICK_R / dist : 1;
    live.stick = { x: (dx * q) / STICK_R, y: (dy * q) / STICK_R };
    els.stick.firstChild.style.transform = `translate(${Math.round(dx * q)}px, ${Math.round(dy * q)}px)`;
  }
  function onPointerUp(e) {
    if (live && live.drag2 && live.drag2.id === e.id) return endStick2();
    const d = live && live.drag; if (!d || d.id !== e.id) return;
    live.drag = null;
    if (d.on) return endStick();
    onTap(d.wx / T, d.wy / T);
  }
  /** Once the thumb passes the ring, the ring slides along behind it, so pulling back turns around at once. */
  function slideBase(d, x, y, el) {
    const dx = x - d.x0, dy = y - d.y0, dist = Math.hypot(dx, dy); if (dist <= STICK_R) return;
    const k = (dist - STICK_R) / dist, r = live.root.getBoundingClientRect(); d.x0 += dx * k; d.y0 += dy * k;
    el.style.left = d.x0 - r.left + 'px'; el.style.top = d.y0 - r.top + 'px';
  }
  function endStick2() { if (!live) return; live.drag2 = null; if (live.p2) live.p2.stick = null; live.els.stick2.classList.remove('on'); live.els.stick2.firstChild.style.transform = ''; }
  function endStick() { if (!live) return; live.drag = null; live.stick = null; live.els.stick.classList.remove('on'); live.els.stick.firstChild.style.transform = ''; }
  /** A tap on the map at world tile coordinates. */
  function onTap(wx, wy) {
    if (!live) return;
    const tx0 = Math.floor(wx), ty0 = Math.floor(wy);
    if (live.battle) { const e = nearestEnemy(wx, wy + 0.4, 1.4); if (e) { shootAt(e.x, e.y); return; } }   // tap a raider to loose a whistling arrow
    { const dg = live.dog; if (Math.abs(dg.x + 0.55 - wx) < 0.8 && wy > dg.y - 0.6 && wy < dg.y + 1.1) return openBasar(); }
    for (const o of live.others.values()) if (Math.abs(o.px + 0.5 - wx) < 0.6 && wy > o.py - 0.8 && wy < o.py + 1) return playerCard(o);
    const sh = live.sheep.find((q) => Math.abs(q.px + 0.5 - wx) < 0.7 && Math.abs(q.py + 0.5 - wy) < 0.7);
    if (sh) { const n = WD.nearestOpen(sh.x, sh.y, live.me.x, live.me.y); return n ? goTo(n, { type: sheepAct(sh), s: sh }) : null; }
    const o = WD.occ[tx0 + ',' + ty0]; if (o && o.door) return goTo(o.door, o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : o.kind === 'npcq' ? { type: 'npcq', id: o.id } : { type: o.id });
    if (tx0 === WD.DOCK.x && ty0 === WD.DOCK.y) return goTo(WD.DOCK, { type: 'fish' });
    if (!WD.blocked(tx0, ty0)) return goTo({ x: tx0, y: ty0 }, null);
    const n = WD.nearestOpen(tx0, ty0, live.me.x, live.me.y); if (n) goTo(n, null);
  }
  /** over: the feet are off the ground (or already on a rock), so rocks no longer block the way. */
  const solid = (x, y, over) => WD.blocked(x, y) && !(over && (WD.g[y] || '')[x] === 'r');
  const freeAt = (fx, fy, over) => !solid(Math.floor(fx - HW), Math.floor(fy - HH), over) && !solid(Math.floor(fx + HW), Math.floor(fy - HH), over) && !solid(Math.floor(fx - HW), Math.floor(fy + HH), over) && !solid(Math.floor(fx + HW), Math.floor(fy + HH), over);
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
  const P2KEYS = { ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u' };
  const KEYS = { ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u' };
  function onKey(e) {
    if (TG.tasks && TG.tasks.active()) return; // a hands-on task has the keys
    // while someone is just talking (no answers to pick), you can still walk: only the movement keys get through
    const talking = TG.dialog && TG.dialog.active() && !(TG.dialog.free() && (KEYS[e.code] || /Shift/.test(e.code)));
    if (!live || document.querySelector('.modal-back') || talking || (TG.scene && TG.scene.active()) || (TG.fp && TG.fp.active()) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    if (live.p2 && P2KEYS[e.code]) { e.preventDefault(); live.p2.keys.add(P2KEYS[e.code]); return; }
    if (live.p2 && (e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); if (!e.repeat) p2Action(); return; }
    if (live.p2 && e.code === 'ShiftRight') { live.p2.running = true; return; }
    if (KEYS[e.code]) { e.preventDefault(); live.keys.add(KEYS[e.code]); return; }
    if (e.code === 'KeyB' && !e.repeat) { e.preventDefault(); openBasar(); return; }
    if (e.code === 'KeyF' && live.battle && !e.repeat) { e.preventDefault(); shootNearest(); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { live.run = true; if (live.race) live.race.sprint = true; return; } // hold Shift to run (in a race: the horse's sprint)
    if (e.code === 'Space' || e.code === 'KeyE') {
      // Space jumps, E uses what is next to you; neither ever re-presses a focused HUD button
      e.preventDefault(); e.stopPropagation();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (e.repeat) return;
      if (e.code === 'Space') jump();
      else { const a = contextAction(); if (a) doAction(a); }
    }
  }
  const JUMP_MS = 460;
  const jumpZ = (o, pn) => { const q = (pn - (o.jt || -1e9)) / JUMP_MS; return q >= 0 && q < 1 ? Math.round(Math.sin(q * Math.PI) * (o.look && o.look.ride ? 7 : 9)) : 0; };
  function jump() {
    if (!live) return;
    const pn = performance.now(); if (pn - (live.me.jt || -1e9) < JUMP_MS) return;
    live.me.jt = pn; TG.sfx.pop && TG.sfx.pop(); net.send({ t: 'jump' });
  }
  function onKeyUp(e) {
    if (!live) return;
    if (live.p2 && P2KEYS[e.code]) live.p2.keys.delete(P2KEYS[e.code]);
    if (live.p2 && e.code === 'ShiftRight') live.p2.running = false;
    if (KEYS[e.code]) live.keys.delete(KEYS[e.code]);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { live.run = false; if (live.race) live.race.sprint = false; }
    if (e.code === 'Space' && !document.querySelector('.modal-back')) { e.preventDefault(); e.stopPropagation(); }
  }

  // ================================================================ Эх орноо хамгаалах: defend the homeland (2D and first person)
  // Raiders ride in along the roads towards the herd and the gers. Whistling arrows and the lasso take away their courage;
  // when it is gone they turn round and ride home. Nobody is hurt, and the chapters teach what really happened.
  const GENERAL = { deel: 'green', skin: '#B97A4A', hat: 'loovuuz', face: null, neck: null, pet: null };
  const HISTORIAN = { deel: 'purple', skin: '#EDBB93', hat: 'mongol', face: 'glasses', neck: null, pet: null };
  const B_SPAWN = [{ x: 54, y: 12 }, { x: 17, y: 2 }, { x: 1, y: 12 }];
  const B_TARGET = [{ x: 27, y: 16 }, { x: 9, y: 14 }, { x: 4, y: 7 }, { x: 11, y: 7 }];
  const HERD_MAX = 5, ARROW_SPEED = 10, SHOOT_CD = 0.45;
  const camp = () => (V().camp = V().camp || { won: {}, tries: 0 });
  function generalModal() {
    const c = camp(), chs = TG.battles.CHAPTERS;
    const close = TG.modal(h('div', null, h('div', { class: 'v-wr-head' }, portrait(GENERAL, 48), h('div', null, h('h2', null, L('Жанжин Батмөнх', 'General Batmönkh')), h('p', { class: 'muted' }, L('Эх орноо хамгаалсан түүхүүд', 'Stories of defending the homeland')))),
      (() => { const p = h('p'), t0 = L('Анхаар! Монголчууд олон зуун жилийн турш нутаг усаа хамгаалж ирсэн. Түүх бүрийг сонсоод, нутгаа хамгаал! Дуут сум, уурга хоёр зөвхөн дайсны зоригийг мохоодог: хэн ч гэмтэхгүй.', 'Attention! For centuries Mongolians have protected their land. Hear each story, then defend the land! Whistling arrows and the lasso only break the raiders’ courage: nobody gets hurt.'); TG.voice ? TG.voice.type(p, t0, 'general') : (p.textContent = t0); return p; })(),
      h('div', { class: 'v-list' }, chs.map((ch, i) => { const open = i === 0 || c.won[chs[i - 1].id], won = c.won[ch.id];
        return h('div', { class: 'v-row' + (open ? '' : ' locked') }, h('span', { class: 'v-card-e' }, won ? '🏆' : open ? '⚔️' : '🔒'), h('div', { class: 'v-row-b' }, h('b', null, tx(ch.name)), h('small', null, tx(ch.year), won ? ` · ${L('Хамгаалсан', 'Defended')} ✓` : '')),
          open ? h('button', { class: 'btn sm primary', onclick: () => { close(); battleIntro(ch.id); } }, won ? L('Дахин', 'Again') : L('Эхлэх', 'Begin')) : null); })),
      h('p', { class: 'privacy' }, '🏹 ', L('Сумаа: дайсан дээр дар эсвэл F. Уурга: ойртоод E. 3D-д: харж байгаад дар.', 'Arrows: tap a raider or press F. Lasso: get close and press E. In 3D: aim and click.'))), { cls: 'v-modal' });
  }
  function battleIntro(id) {
    const ch = TG.battles.byId(id);
    const close = TG.modal(h('div', null, h('div', { class: 'eyebrow' }, `⚔️ ${tx(ch.year)}`), h('h2', null, tx(ch.name)),
      h('div', { class: 'teach' }, h('b', null, '📜 ', L('Түүх', 'The story')), h('p', null, tx(ch.intro))),
      h('p', { class: 'muted' }, L(`Холбоотнууд: ${ch.allies.map((a) => a.name.mn).join(', ')}. ${ch.waves.length} давалгаа.`, `Allies: ${ch.allies.map((a) => a.name.en).join(', ')}. ${ch.waves.length} waves.`)),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn primary', onclick: () => { close(); startBattle(id); } }, '⚔️ ', L('Хамгаалъя!', 'Defend!')),
        TG.fp && TG.fp.supported() ? h('button', { class: 'btn', onclick: () => { close(); startBattle(id); setTimeout(() => openFP(), 50); } }, '👁 ', L('Өөрийн нүдээр', 'First person')) : null)), { cls: 'v-modal' });
  }
  function startBattle(id) {
    if (!live) return;
    const ch = TG.battles.byId(id);
    if (live.race) return;
    live.battle = { ch, wave: 0, toSpawn: ch.waves[0], spawnT: 1.5, breakT: 0, enemies: [], allies: ch.allies.map((a, i) => ({ ...a, look: { ...a.look, ride: 'horse', coat: a.coat }, x: 18 + i * 2, y: 13 + i, cd: 1 + i * 0.5, face: 2 })), arrows: [], herd: HERD_MAX, repelled: 0, total: ch.waves.reduce((a, b) => a + b, 0), cd: 0, lassoCd: 0, over: false, nid: 0 };
    camp().tries++; S.save(); TG.sfx.whoosh && TG.sfx.whoosh(); hud();
    TG.toast('⚔️ ' + L(`${tx(ch.name)}: 1-р давалгаа ирж байна!`, `${tx(ch.name)}: the first wave is coming!`));
  }
  const nearestEnemy = (x, y, max = 9) => { let best = null, bd = max; for (const e of live.battle.enemies) if (!e.flee) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } } return best; };
  const meXY = () => ({ x: live.me.px + 0.5, y: live.me.py + 0.82 });
  function shootAt(tx0, ty0, from) {
    const bt = live.battle; if (!bt || bt.over) return false;
    const o = from || meXY(); if (!from) { if (bt.cd > 0) return false; bt.cd = SHOOT_CD; bt.shots = (bt.shots || 0) + 1; TG.sfx.snap(); }
    const dx = tx0 - o.x, dy = ty0 - o.y, d = Math.hypot(dx, dy) || 1;
    bt.arrows.push({ x: o.x, y: o.y, dx: dx / d, dy: dy / d, life: 1.1, mine: !from });
    return true;
  }
  function shootNearest() { const bt = live && live.battle; if (!bt) return; const m = meXY(), e = nearestEnemy(m.x, m.y); if (e) shootAt(e.x, e.y); else if (bt.cd <= 0) { bt.cd = 1.2; TG.toast(L('Ойрхон дайсан алга.', 'No raider nearby.')); } }
  function lasso(e) { const bt = live.battle; if (!bt || bt.lassoCd > 0 || e.flee) return; bt.lassoCd = 1; e.courage -= 2; e.hitT = performance.now(); TG.sfx.whoosh && TG.sfx.whoosh(); floatAt({ x: e.x - 0.5, y: e.y - 0.8 }, L('Уургадлаа!', 'Lassoed!'), '#f7c646'); if (e.courage <= 0) scare(e); }
  function scare(e) { e.flee = true; e.courage = 0; live.battle.repelled++; floatAt({ x: e.x - 0.5, y: e.y - 1 }, L('Зориг нь мохлоо!', 'Lost courage!'), '#ffffff'); TG.sfx.good(); hud(); }
  function battleTick(dt) {
    const bt = live.battle; if (!bt || bt.over) return;
    bt.cd = Math.max(0, bt.cd - dt); bt.lassoCd = Math.max(0, bt.lassoCd - dt);
    // waves: spawn the raiders one by one from the edges of the village
    if (bt.toSpawn > 0) { bt.spawnT -= dt; if (bt.spawnT <= 0) { bt.spawnT = 1.6; bt.toSpawn--; const sp = TG.pick(B_SPAWN), tg = TG.pick(B_TARGET), path = WD.findPath(sp.x, sp.y, tg.x, tg.y) || [];
      bt.enemies.push({ id: ++bt.nid, x: sp.x + 0.5, y: sp.y + 0.5, home: { x: sp.x + 0.5, y: sp.y + 0.5 }, path, courage: bt.ch.enemy.courage, max: bt.ch.enemy.courage, flee: false, speed: 1.9 + TG.battles.CHAPTERS.indexOf(bt.ch) * 0.15 + bt.wave * 0.1, face: 1, look: { ...bt.ch.enemy.look, ride: 'horse', coat: bt.ch.enemy.coat } }); } }
    else if (!bt.enemies.length) {
      if (bt.wave + 1 >= bt.ch.waves.length) return endBattle(true);
      bt.breakT += dt; if (bt.breakT > 2.5) { bt.breakT = 0; bt.wave++; bt.toSpawn = bt.ch.waves[bt.wave]; bt.spawnT = 0.5; TG.toast('⚔️ ' + L(`${bt.wave + 1}-р давалгаа!`, `Wave ${bt.wave + 1}!`)); hud(); }
    }
    // raiders follow the roads to the herd; scared ones ride straight home
    for (const e of bt.enemies) {
      let tx0, ty0;
      if (e.flee) { tx0 = e.home.x; ty0 = e.home.y; } else if (e.path.length) { tx0 = e.path[0].x + 0.5; ty0 = e.path[0].y + 0.5; } else { bt.herd--; e.flee = true; e.scared = true; TG.sfx.bad(); floatAt({ x: e.x - 0.5, y: e.y - 1 }, L('Хонь айлаа!', 'A sheep got scared!'), '#e14b3d'); hud(); continue; }
      const dx = tx0 - e.x, dy = ty0 - e.y, d = Math.hypot(dx, dy), sp = (e.flee ? 3.4 : e.speed) * dt;
      if (d <= sp) { e.x = tx0; e.y = ty0; if (!e.flee) e.path.shift(); else e.gone = true; } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
      if (Math.abs(dx) > 0.05) e.face = dx < 0 ? 1 : 2;
    }
    bt.enemies = bt.enemies.filter((e) => !e.gone);
    // allies ride towards the nearest raider and loose arrows
    for (const a of bt.allies) {
      const e = nearestEnemy(a.x, a.y, 30);
      if (!e) continue;
      const dx = e.x - a.x, dy = e.y - a.y, d = Math.hypot(dx, dy);
      if (d > 3.5) { a.x += (dx / d) * 2.6 * dt; a.y += (dy / d) * 2.6 * dt; a.moving = true; } else a.moving = false;
      if (Math.abs(dx) > 0.05) a.face = dx < 0 ? 1 : 2;
      a.cd -= dt; if (a.cd <= 0 && d < 6) { a.cd = 1.5 + Math.random() * 0.6; const miss = Math.random() < 0.3 ? 1.2 : 0; shootAt(e.x + miss, e.y + miss * 0.5, { x: a.x, y: a.y }); }
    }
    // arrows: blunt whistling arrows that only take courage
    for (const ar of bt.arrows) {
      ar.x += ar.dx * ARROW_SPEED * dt; ar.y += ar.dy * ARROW_SPEED * dt; ar.life -= dt;
      for (const e of bt.enemies) if (!e.flee && Math.hypot(e.x - ar.x, e.y - ar.y) < 0.6) { e.courage--; e.hitT = performance.now(); ar.life = 0; if (ar.mine) TG.sfx.tick ? TG.sfx.tick() : TG.sfx.tap(); if (e.courage <= 0) scare(e); break; }
    }
    bt.arrows = bt.arrows.filter((a) => a.life > 0);
    if (bt.herd <= 0) endBattle(false);
  }
  function endBattle(won) {
    const bt = live.battle; if (!bt || bt.over) return; bt.over = true;
    const ch = bt.ch, c = camp(), first = won && !c.won[ch.id];
    if (won) { c.won[ch.id] = Date.now(); reward(first ? 40 : 15, first ? 60 : 20); quest('defend'); TG.sfx.win(); TG.confetti(80); if (TG.history) TG.history.battleWon(ch.id); } else TG.sfx.bad();
    S.save(); setTimeout(() => { if (live) { live.battle = null; hud(); } }, 600);
    TG.modal(h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, won ? '🏆' : '🐑'), h('h2', null, won ? L('Нутгаа хамгааллаа!', 'You defended the land!') : L('Дахин оролдоё!', 'Let’s try again!')),
      h('p', null, won ? L(`${bt.repelled} дайсны зоригийг мохоож, малаа аварлаа. 🐑 ${bt.herd}/${HERD_MAX}`, `You broke the courage of ${bt.repelled} raiders and saved the herd. 🐑 ${bt.herd}/${HERD_MAX}`) : L('Хонинууд айсан ч бүгд эсэн мэнд, буцаад ирлээ. Холбоотнуудтайгаа хамт дахиад хамгаалъя!', 'The sheep got scared, but they’re all safe and back home. Let’s defend again with your allies!')),
      won ? h('div', { class: 'teach' }, h('b', null, '📜 ', L('Түүхэнд юу болсон бэ?', 'What really happened?')), h('p', null, tx(ch.after))) : null,
      h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: (e) => e.currentTarget.closest('.modal-back').querySelector('.modal-x').click() }, L('Гайхалтай!', 'Great!'))), { cls: 'v-modal' });
  }
  /** Raiders and defenders on horseback, arrows in flight, and each raider's courage hearts. */
  function battleModel(F, rider, text) {
    const bt = live && live.battle; if (!bt) return;
    bt.enemies.forEach((u, i) => rider('raider:' + i, u.look, u.face || 2, true, u.x - 0.5, u.y - 0.82, u.y - 0.82));
    bt.allies.forEach((u, i) => rider('ally:' + i, u.look, u.face || 2, true, u.x - 0.5, u.y - 0.82, u.y - 0.82));
    bt.arrows.forEach((a, i) => F.marks.push({ id: 'shaft:' + i, kind: 'shaft', x: a.x * T, y: a.y * T - 10, x2: (a.x - a.dx * 0.5) * T, y2: (a.y - a.dy * 0.5) * T - 10 }));
    bt.enemies.forEach((e, i) => F.texts.push({ id: 'heart:' + i, font: 'rubik', text: e.flee ? '😨' : '♥'.repeat(Math.max(0, e.courage)) + '♡'.repeat(Math.max(0, e.max - e.courage)), x: e.x * T, y: e.y * T - 38, color: e.flee ? '#ffffff' : '#e14b3d' }));
  }
  const battleLabel = () => { const bt = live && live.battle; return bt ? `⚔️ ${tx(bt.ch.name)} · ${L('Давалгаа', 'Wave')} ${bt.wave + 1}/${bt.ch.waves.length} · 🐑 ${bt.herd}/${HERD_MAX} · 😨 ${bt.repelled}/${bt.total}` : ''; };

  // ================================================================ Нутаг in first person (3D): roam, ride, use everything, see your friends
  const CHAR_H = 1.8;
  const ARROW_IMG = (() => { const c = document.createElement('canvas'); c.width = 12; c.height = 2; const x = c.getContext('2d'); x.fillStyle = '#6b4220'; x.fillRect(0, 0, 10, 2); x.fillStyle = '#f7c646'; x.fillRect(9, 0, 3, 2); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 2, 2); return c; })();
  function villageThings() {
    const list = [];
    for (const o of WD.objects) {
      if (!o.door) continue;
      const a = o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : o.kind === 'npcq' ? { type: 'npcq', id: o.id } : { type: o.id };
      list.push({ kind: 'obj', x: o.door.x + 0.5, y: o.door.y + 0.5, label: () => labelFor(a)[1] || L('Харах', 'Look'), run: () => doAction(a) });
    }
    list.push({ kind: 'fish', x: WD.DOCK.x + 0.5, y: WD.DOCK.y + 0.5, label: () => labelFor({ type: 'fish' })[1], run: () => doAction({ type: 'fish' }) });
    for (const q of live.sheep) list.push({ kind: 'sheep', q, x: q.px + 0.5, y: q.py + 0.7, penalty: 3, label: () => labelFor({ type: 'sheep', s: q })[1], run: () => petSheep(q) });
    return list;
  }
  function openFP() {
    if (!live || !TG.fp || !TG.fp.supported()) return TG.toast(L('Энэ төхөөрөмж 3D харагдацыг дэмжихгүй байна.', 'This device can’t show the 3D view.'));
    if (live.race) return TG.toast(L('Уралдааны үеэр 3D харагдац ажиллахгүй.', 'Not during a race.'));
    const v = V(), things = villageThings(), m = live.me;
    let world;
    try { world = TG.fpworld.createVillage(WD, lotsArr(), R); } catch (e) { console.warn(e); return TG.toast(L('3D ертөнц ачаалж чадсангүй.', 'Could not build the 3D village.')); }
    const look = (who) => PX.char({ ...who, pet: null, ride: null }, 0, 0);
    const horseBtn = h('button', { class: 'btn scene-side hidden', onclick: () => { dismount(); } }, '🐎 ', L('Мориноос буух', 'Get off'));
    const backBtn = h('button', { class: 'btn scene-side', onclick: () => sc && sc.close() }, '🗺️ ', L('Дээрээс харах', 'Top view'));
    let sc = null;
    sc = TG.fp.open({
      cls: 'village-fp', world, scale: TG.fpworld.TILE, look: v.look, season: () => live.season,
      start: { x: m.px + 0.5, y: m.py + 0.82 }, W: WD.W, title: L('Нутаг', 'Nutag'), sub: L('Өөрийн нүдээр', 'First person'), buttons: [horseBtn, backBtn], things,
      onPrimary: (api) => { if (!live.battle || live.battle.over) return false; const d = api.dir(), n = Math.hypot(d[0], d[2]) || 1, m2 = meXY(); shootAt(m2.x + (d[0] / n) * 10, m2.y + (d[2] / n) * 10); return true; },
      onKey: (code) => { if (code === 'KeyF' && live.battle) { shootNearest(); return true; } return false; },
      overlay: (x, proj, t, dpr) => { if (!live.battle) return; const txt = battleLabel(); x.font = `800 ${Math.round(15 * dpr)}px Rubik, sans-serif`; x.textAlign = 'center'; const tw = x.measureText(txt).width + 24 * dpr; x.fillStyle = 'rgba(43,30,46,.75)'; x.fillRect(x.canvas.width / 2 - tw / 2, 128 * dpr, tw, 28 * dpr); x.fillStyle = '#f7c646'; x.fillText(txt, x.canvas.width / 2, 147 * dpr); },
      riding: () => !!live.ride, horseCoat: () => (PX.COATS[V().horse.coat] || PX.COATS.bay)[0], horseMane: () => (PX.COATS[V().horse.coat] || PX.COATS.bay)[2],
      hint: () => L('Ойртож харвал E', 'Face something and press E'),
      step: () => {
        // your position back into the village, so friends see you move and quests count where you are
        const px = sc.me.x - 0.5, py = sc.me.y - 0.82, mv = Math.hypot(px - live.me.px, py - live.me.py);
        live.me.moving = mv > 0.002; if (Math.abs(px - live.me.px) > 0.002) live.me.face = px < live.me.px ? 1 : 2;
        live.me.px = px; live.me.py = py; live.me.vx = live.me.vy = 0; live.me.path = []; live.cam.x = px; live.cam.y = py;
        for (const t of things) if (t.kind === 'sheep') { t.x = t.q.px + 0.5; t.y = t.q.py + 0.7; }
        // raiders you can lasso when they come close
        for (let i = things.length - 1; i >= 0; i--) if (things[i].kind === 'enemy' && (!live.battle || !live.battle.enemies.includes(things[i].e) || things[i].e.flee)) things.splice(i, 1);
        if (live.battle) for (const e of live.battle.enemies) { if (e.flee) continue; let t2 = things.find((q) => q.e === e); if (!t2) things.push(t2 = { kind: 'enemy', e, label: () => L('Уургадах', 'Lasso'), run: () => lasso(e) }); t2.x = e.x; t2.y = e.y; }
        horseBtn.classList.toggle('hidden', !live.ride);
      },
      actors: (t) => {
        const out = [], f = (o) => (o.moving ? 1 + (Math.floor(t * 8) % 2) : 0);
        for (const np of WD.objects) {
          if (np.kind === 'npcq' && NPCS[np.id]) out.push({ img: look(NPCS[np.id].look), x: np.x + 0.5, y: np.y + 0.9, h: CHAR_H });
          if (np.kind === 'npc') out.push({ img: look(ZASUUL), x: np.x + 0.5, y: np.y + 0.9, h: CHAR_H });
          if (np.kind === 'emee') out.push({ img: look(EMEE), x: np.x + 0.5, y: np.y + 0.9, h: CHAR_H * 0.92 });
          if (np.kind === 'cow' || np.kind === 'goat') out.push({ img: PX.beast(np.kind, Math.floor(t * 2 + np.y) % 5 === 0 ? 1 : 0), x: np.x + (np.kind === 'cow' ? 1 : 0.5), y: np.y + 0.6, h: np.kind === 'cow' ? 1.4 : 0.95 });
          if (np.kind === 'zel') [[0.6, 'foal', 1.05], [2.2, 'foal', 1.05], [1.4, 'mare', 1.6], [3.2, 'mare', 1.6]].forEach(([dx, k, hh], i) => out.push({ img: PX.beast(k, 0), x: np.x + dx, y: np.y + (k === 'mare' ? 1.1 : 0.5), h: hh, flip: i % 2 === 1 }));
          if (np.kind === 'uya') { out.push({ img: PX.beast('horse', 0), x: np.x + 0.8, y: np.y + 0.6, h: 1.6 }); out.push({ img: PX.beast('mare', 0), x: np.x + np.w - 0.8, y: np.y + 0.6, h: 1.6, flip: true }); }
        }
        for (const q of live.sheep) out.push({ img: PX.animal('sheep', Math.floor(t * 2 + q.i) % 2), x: q.px + 0.5, y: q.py + 0.7, h: 0.95, flip: !q.flip });
        for (const o of live.others.values()) {
          if (o.look.ride) out.push({ img: PX.horse(o.look.coat || 'bay', o.moving ? 1 + (Math.floor(t * 8) % 4) : 0, true), x: o.px + 0.5, y: o.py + 0.82, h: 1.6, flip: o.face === 1 });
          out.push({ img: PX.char({ ...o.look, pet: null, ride: null }, o.dir, f(o)), x: o.px + 0.5, y: o.py + 0.82, h: CHAR_H, lift: o.look.ride ? 0.9 : 0 });
        }
        if (live.race) for (const n of live.race.npcs) out.push({ img: PX.horse(n.look.coat || 'bay', 1 + (Math.floor(t * 10 + n.wob) % 4), true), x: n.px + 0.5, y: n.py + 0.82, h: 1.6 });
        for (const [o, lk] of [[WD.objects.find((q) => q.kind === 'general'), GENERAL], [WD.objects.find((q) => q.kind === 'historian'), HISTORIAN]]) if (o) out.push({ img: look(lk), x: o.x + 0.5, y: o.y + 0.9, h: CHAR_H });
        const bt = live.battle;
        if (bt) {
          for (const u of [...bt.enemies, ...bt.allies]) { out.push({ img: PX.horse(u.look.coat || 'bay', 1 + (Math.floor(t * 9 + u.x) % 4), true), x: u.x, y: u.y, h: 1.6, flip: u.face === 1 }); out.push({ img: PX.char({ ...u.look, ride: null, pet: null }, u.face === 1 ? 1 : 2, 0), x: u.x, y: u.y, h: CHAR_H, lift: 0.85 }); }
          for (const a of bt.arrows) out.push({ img: ARROW_IMG, x: a.x, y: a.y, h: 0.18, lift: 1.4 });
        }
        return out;
      },
      markers: () => {
        const out = [];
        for (const np of WD.objects) {
          if (np.kind === 'npcq' && NPCS[np.id]) { const mk = npcMark(np.id); out.push({ x: np.x + 0.5, y: np.y + 0.9, c: mk === '?' ? '#7fe07a' : mk ? '#f7c646' : null, label: tx(NPCS[np.id].name).split(' ').pop(), lift: 2.4 }); }
          if (np.kind === 'emee') out.push({ x: np.x + 0.5, y: np.y + 0.9, c: V().emee && V().emee.visits ? null : '#f7c646', label: L('Эмээ', 'Grandma'), lift: 2.2 });
          if (np.kind === 'npc') out.push({ x: np.x + 0.5, y: np.y + 0.9, c: null, label: L('Засуул', 'Herald'), lift: 2.4 });
        }
        for (const o of live.others.values()) out.push({ x: o.px + 0.5, y: o.py + 0.82, c: null, label: o.name, lift: o.look.ride ? 3.2 : 2.3 });
        const bt = live.battle; if (bt) for (const e of bt.enemies) out.push({ x: e.x, y: e.y, c: null, label: e.flee ? '😨' : '♥'.repeat(Math.max(0, e.courage)) + '♡'.repeat(Math.max(0, e.max - e.courage)), lift: 3.3 });
        if (TG.history && TG.history.ready()) { const o = WD.objects.find((q) => q.kind === 'historian'); if (o) out.push({ x: o.x + 0.5, y: o.y + 0.9, c: '#7fe07a', label: L('Түүхч', 'Historian'), lift: 2.4 }); }
        return out;
      },
      mini: { img: live.miniBase, w: WD.W * 3, h: WD.H * 3, dots: () => [...[...live.others.values()].map((o) => ({ x: o.px + 0.5, y: o.py + 0.8, c: '#ffffff' })), ...WD.objects.filter((o) => o.kind === 'npcq' && npcMark(o.id)).map((o) => ({ x: o.x + 0.5, y: o.y + 0.5, c: '#f7c646' }))] },
      info: [h('b', null, '👁 ', L('Нутгаа өөрийн нүдээр!', 'Nutag in first person!')), h('p', null, L('WASD алхах, хулганаар харах, Space үсрэх, Shift гүйх, E харилцах. Морины уяанаас морь унаж давхиж болно!', 'WASD walk, mouse to look, Space jump, Shift sprint, E interact. Take a horse from the hitching line and ride!'))],
      onClose: () => { if (live) { live.keys.clear(); live.fpOpen = false; updateCtx(); } },
    });
    if (sc) { live.fpOpen = true; TG._village.fpScene = sc; }
  }

  // ---------------------------------------------------------------- minimap
  const MINI = { g: '#76b947', T: '#3f7a2c', p: '#d8ab6c', s: '#d9cdb5', w: '#4aa6e2', d: '#a46d3b', o: '#8c5a33', f: '#a46d3b', r: '#a5a5b0', a: '#e8c994' };
  const MINI_OBJ = { ger: '#f4efe3', shop: '#e14b3d', board: '#a46d3b', well: '#77778a', lot: '#c8a06a', bleachers: '#a46d3b', ovoo: '#a5a5b0', uya: '#8a5a33', archery: '#e9a91f', academy: '#2f7d5b', felt: '#d8c8a8' };
  /** One pixel per tile: ground, roads, water, buildings. */
  function miniBase() {
    const m = PX.mk(WD.W, WD.H);
    for (let y = 0; y < WD.H; y++) for (let x = 0; x < WD.W; x++) {
      const c = WD.g[y][x], o = c === 'B' ? WD.occ[x + ',' + y] : null;
      PX.R(m.x, x, y, 1, 1, o ? MINI_OBJ[o.kind] || MINI.g : MINI[c] || MINI.g);
    }
    return m.c;
  }
  function drawMini() {
    const cv = live.els.mini, m = cv.getContext('2d'), s = cv.width / WD.W, pn = performance.now(), dot = (x, y, col, r = 2) => { m.fillStyle = '#2b1e2e'; m.fillRect(Math.round(x * s) - r - 1, Math.round(y * s) - r - 1, r * 2 + 3, r * 2 + 3); m.fillStyle = col; m.fillRect(Math.round(x * s) - r, Math.round(y * s) - r, r * 2 + 1, r * 2 + 1); };
    m.imageSmoothingEnabled = false; m.drawImage(live.miniBase, 0, 0, cv.width, cv.height);
    lotsArr().forEach((l, i) => { if (l) { const o = WD.lots[i]; PX.R(m, o.x * s + 2, o.y * s + 2, 3 * s - 4, 3 * s - 4, R.ROOF[l.roof] || R.ROOF.blue); } });
    for (const np of WD.objects) {
      if (np.kind === 'npcq' && npcMark(np.id)) dot(np.x + 0.5, np.y + 0.5, npcMark(np.id) === '?' ? '#7fe07a' : '#f7c646');
      if (np.kind === 'emee' && !(V().emee && V().emee.visits)) dot(np.x + 0.5, np.y + 0.5, '#f492ba');
    }
    for (const o of live.others.values()) dot(o.px + 0.5, o.py + 0.8, '#ffffff');
    if (Math.floor(pn / 450) % 2) dot(live.me.px + 0.5, live.me.py + 0.8, '#ffffff', 3);
    dot(live.me.px + 0.5, live.me.py + 0.8, '#e14b3d');
    const vp = live.view.viewport(); m.strokeStyle = 'rgba(255,255,255,.85)'; m.lineWidth = 1;
    m.strokeRect(Math.round((vp.x / T) * s) + 0.5, Math.round((vp.y / T) * s) + 0.5, Math.round((vp.w / T) * s) - 1, Math.round((vp.h / T) * s) - 1);
  }
  /** First tap opens the big map; on the big map, tap a place to walk there. */
  function onMiniTap(e) {
    e.preventDefault(); e.stopPropagation();
    const cv = live.els.mini;
    if (!cv.classList.contains('big')) { cv.classList.add('big'); TG.sfx.tap(); return; }
    const r = cv.getBoundingClientRect(), tx0 = Math.floor(((e.clientX - r.left) / r.width) * WD.W), ty0 = Math.floor(((e.clientY - r.top) / r.height) * WD.H);
    cv.classList.remove('big');
    const t = !WD.blocked(tx0, ty0) ? { x: tx0, y: ty0 } : WD.nearestOpen(tx0, ty0, live.me.x, live.me.y);
    if (t) goTo(t, null);
  }

  // ---------------------------------------------------------------- update + draw
  const follow = (p, x, y, dt) => { p.x += (x - p.x) * Math.min(1, dt * 4); p.y += (y - p.y) * Math.min(1, dt * 4); };
  // ---------------------------------------------------------------- Nomin pops in and out (tutorial.js decides when)
  const POOF_MS = 420;
  /** Somewhere open right beside you for her to appear. */
  function besideMe() {
    const m = live.me;
    for (const [dx, dy] of [[-1.2, 0.15], [1.25, 0.15], [0, 1.1], [-1.1, -0.9], [1.1, -0.9], [-2.2, 0.2], [2.2, 0.2]]) {
      const x = m.px + dx, y = m.py + dy;
      if (!WD.blocked(Math.floor(x + 0.5), Math.floor(y + 0.82))) return { x, y };
    }
    return { x: m.px - 1.2, y: m.py + 0.15 };
  }
  function nomin(cmd) {
    if (!live) return;
    const tut = live.tut || (live.tut = { guide: null, target: null }), g = tut.guide, pn = performance.now();
    if (cmd === 'in') {
      if (g && !g.out && Math.hypot(g.x - live.me.px, g.y - live.me.py) < 4.5) return; // already here, close enough to talk
      const at = besideMe(); tut.guide = { x: at.x, y: at.y, dir: 0, moving: false, in: pn, out: 0 };
      if (g && !g.out) live.floaters.push({ x: g.x, y: g.y, poof: true, t0: pn }); // she was far away: a puff where she was
      TG.sfx.pop && TG.sfx.pop();
    } else if (cmd === 'out' && g && !g.out) { g.out = pn; TG.sfx.tick && TG.sfx.tick(); }
  }
  // ================================================================ two players on one screen
  /** Player 2 walks with the arrow keys (or the right-hand joystick) and steps aside while player 1 rides, races, fights or has a panel open. */
  function moveP2(dt) {
    const p = live.p2, m = live.me;
    const busy = !!(live.ride || live.race || live.battle || document.querySelector('.modal-back') || (TG.scene && TG.scene.active()) || (TG.fp && TG.fp.active()));
    if (busy) { p.hidden = true; p.vx = p.vy = 0; p.moving = false; return; }
    if (p.hidden) { const at = besideMe(); p.px = at.x; p.py = at.y; p.hidden = false; }
    const k = p.keys, st = p.stick, sm = st ? Math.hypot(st.x, st.y) : 0;
    let ix = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), iy = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), mag = 1, tvx = 0, tvy = 0;
    if (!ix && !iy && sm > 0.18) { ix = st.x; iy = st.y; mag = clamp((sm - 0.18) / 0.45, 0.45, 1); }
    const SP = p.running ? 7.6 : SPEED;
    if (ix || iy) { const n = Math.hypot(ix, iy); tvx = (ix / n) * SP * mag; tvy = (iy / n) * SP * mag; }
    const a = Math.min(1, dt * ACCEL); p.vx += (tvx - p.vx) * a; p.vy += (tvy - p.vy) * a;
    if (Math.abs(p.vx) < 0.01) p.vx = 0; if (Math.abs(p.vy) < 0.01) p.vy = 0;
    const over = !freeAt(p.px + 0.5, p.py + 0.82), d0 = Math.hypot(p.px - m.px, p.py - m.py);
    const ok = (x, y) => Math.hypot(x - m.px, y - m.py) <= 14 || Math.hypot(x - m.px, y - m.py) < d0; // a gentle tether: never wander off the shared screen
    if (p.vx && freeAt(p.px + 0.5 + p.vx * dt, p.py + 0.82, over) && ok(p.px + p.vx * dt, p.py)) p.px += p.vx * dt; else p.vx = 0;
    if (p.vy && freeAt(p.px + 0.5, p.py + 0.82 + p.vy * dt, over) && ok(p.px, p.py + p.vy * dt)) p.py += p.vy * dt; else p.vy = 0;
    const speed = Math.hypot(p.vx, p.vy); p.moving = speed > 0.3;
    if (p.moving) p.dir = Math.abs(p.vx) > Math.abs(p.vy) * 0.9 ? (p.vx < 0 ? 1 : 2) : (p.vy < 0 ? 3 : 0);
    if (Math.abs(p.vx) > 0.3) p.face = p.vx < 0 ? 1 : 2;
    p.x = Math.floor(p.px + 0.5); p.y = Math.floor(p.py + 0.82);
  }
  /** Player 2's hands: shear the sheep beside them, or work the felt. */
  function p2Action() {
    const p = live && live.p2; if (!p || p.hidden) return;
    const fx = p.px + 0.5, fy = p.py + 0.82, felt = WD.objects.find((o) => o.kind === 'felt');
    if (felt && Math.hypot(fx - (felt.door.x + 0.5), fy - (felt.door.y + 0.7)) < 1.4) return TG.gerwork.felt();
    const sh = live.sheep.find((q) => Math.hypot(fx - (q.px + 0.5), fy - (q.py + 0.7)) < 1.4);
    if (sh && sheepAct(sh) === 'shear') return TG.gerwork.shear(sh.i);
    TG.toast('🤝 ' + L(`${p.name}: хонь эсвэл эсгий хийх газрын дэргэд Enter дар.`, `${p.name}: press Enter next to a sheep or the felt spot.`));
  }
  /** A family member (or a friend) joins on this screen; null sends them home. */
  function together(fid) {
    if (!live) return;
    if (fid === null || fid === undefined) { if (live.p2) TG.toast(`👋 ${live.p2.name}`); live.p2 = null; endStick2(); hud(); return; }
    const f = (S.state.family || []).find((x) => x.id === fid), v = V(), at = besideMe(), deels = Object.keys(R.DEELS);
    const deel = deels[(deels.indexOf(v.look.deel) + 3) % deels.length];
    live.p2 = { id: 'p2', name: f ? tx(f.name) : L('Найз', 'Friend'), look: { ...v.look, deel, pet: null, ride: null, title: null }, px: at.x, py: at.y, x: Math.floor(at.x + 0.5), y: Math.floor(at.y + 0.82),
      vx: 0, vy: 0, dir: 0, face: 2, moving: false, running: false, jt: 0, keys: new Set(), stick: null, hidden: false };
    TG.sfx.chime && TG.sfx.chime(); TG.toast(`🤝 ${live.p2.name} ${L('хамт тоглож байна! Сум товч, Enter: тэр. Дэлгэцийн баруун тал: түүний джойстик.', 'is playing too! Arrow keys and Enter are theirs; the right half of the screen is their joystick.')}`); hud();
  }
  function togetherModal() {
    const fam = S.state.family || [], body = h('div');
    const pick = (id) => { close(); together(id); };
    rc(body, h('h2', null, '🤝 ', L('Хамтдаа тоглох', 'Play together')), h('p', { class: 'muted' }, L('Нэг утас, таблет дээр хоёулаа: тоноо хамт өргөж, эсгийгээ хамт өнхрүүлээрэй!', 'Two of you on one phone or tablet: lift the toono and roll felt together!')),
      h('div', { class: 'v-list' }, [...fam.map((f) => h('button', { class: 'btn block', onclick: () => pick(f.id) }, `${f.emoji} ${tx(f.name)}`)), h('button', { class: 'btn block', onclick: () => pick('') }, `🧒 ${L('Найз', 'Friend')}`)]),
      live && live.p2 ? h('button', { class: 'btn danger block', style: { marginTop: '10px' }, onclick: () => pick(null) }, L('Хамтдаа тоглохоо болих', 'Stop playing together')) : null);
    const close = TG.modal(body, { cls: 'v-modal' });
  }

  function update(dt) {
    const m = live.me, k = live.keys, v0 = V();
    const wantRun = (live.run || live.runLock) && !live.race && (k.size > 0 || !!live.stick || m.path.length > 0);
    if (wantRun && v0.energy <= 0 && !live.tiredSaid) { live.tiredSaid = true; TG.toast('😮‍💨 ' + L('Ядарчихлаа! Хоол идэж, ундаа уугаад хүчээ нөхөөрэй (🍖 дээр дар).', 'Out of energy! Eat or drink to get it back (tap 🍖).')); }
    m.running = wantRun && v0.energy > 0;
    const SP = live.ride ? (live.race ? raceSpeed() : m.running ? 11 : 7.2) : m.running ? 7.6 : SPEED;
    if (live.race && live.race.phase === 'count') { k.clear(); m.path = []; }
    let ix = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), iy = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), tvx = 0, tvy = 0, mag = 1;
    const stk = live.stick, sm = stk ? Math.hypot(stk.x, stk.y) : 0;
    if (!ix && !iy && sm > 0.18 && !(live.race && live.race.phase === 'count')) { ix = stk.x; iy = stk.y; mag = clamp((sm - 0.18) / 0.45, 0.45, 1); } // a gentle push walks slowly, a full push walks at full speed
    if (ix || iy) { m.path = []; live.pending = null; const n = Math.hypot(ix, iy); tvx = (ix / n) * SP * mag; tvy = (iy / n) * SP * mag; }
    else if (m.path.length) {
      const wp = m.path[0], dx = wp.x - m.px, dy = wp.y - m.py, d = Math.hypot(dx, dy);
      if (d < Math.max(0.06, SP * dt * 1.1)) {
        m.px = wp.x; m.py = wp.y; m.path.shift();
        if (!m.path.length) { m.vx = m.vy = 0; const a = live.pending; live.pending = null; m.x = Math.floor(m.px + 0.5); m.y = Math.floor(m.py + 0.82); if (a) doAction(a); updateCtx(); }
      } else {
        const sp = m.path.length === 1 && d < 0.6 ? SP * Math.max(0.45, d / 0.6) : SP;
        tvx = (dx / d) * sp; tvy = (dy / d) * sp;
      }
    }
    const a = Math.min(1, dt * (ix || iy || m.path.length ? ACCEL : ACCEL * 1.4));
    m.vx += (tvx - m.vx) * a; m.vy += (tvy - m.vy) * a;
    if (Math.abs(m.vx) < 0.01) m.vx = 0; if (Math.abs(m.vy) < 0.01) m.vy = 0;
    // move with collision, sliding along walls; in the air you clear rocks, and walking into one hops over it
    const ox = m.px, oy = m.py, pn = performance.now();
    let over = pn - (m.jt || -1e9) < JUMP_MS || !freeAt(m.px + 0.5, m.py + 0.82);
    const rockAhead = (nx, ny) => !over && (ix || iy) && !freeAt(nx, ny) && freeAt(nx, ny, true);
    if (rockAhead(m.px + 0.5 + m.vx * dt, m.py + 0.82) || rockAhead(m.px + 0.5, m.py + 0.82 + m.vy * dt)) { jump(); over = true; }
    if (m.vx && freeAt(m.px + 0.5 + m.vx * dt, m.py + 0.82, over)) m.px += m.vx * dt; else m.vx = 0;
    if (m.vy && freeAt(m.px + 0.5, m.py + 0.82 + m.vy * dt, over)) m.py += m.vy * dt; else m.vy = 0;
    const speed = Math.hypot(m.vx, m.vy);
    m.moving = speed > 0.3;
    if (m.moving) live.walked = (live.walked || 0) + speed * dt;
    if (speed > 0.3) m.dir = Math.abs(m.vx) > Math.abs(m.vy) * 0.9 ? (m.vx < 0 ? 1 : 2) : (m.vy < 0 ? 3 : 0);
    if (Math.abs(m.vx) > 0.3) m.face = m.vx < 0 ? 1 : 2;
    if (live.ride && speed > 0.3) V().horse.dist += speed * dt;
    if (m.running && speed > 0.3) { // running tires you (a little less on a horse); eating fills it up again
      v0.energy = Math.max(0, v0.energy - dt * (live.ride ? 0.6 : 1.1));
      if (v0.energy > 0) live.tiredSaid = false;
      live.eT = (live.eT || 0) + dt; if (live.eT > 1) { live.eT = 0; hudEnergy(); live.eS = (live.eS || 0) + 1; if (live.eS >= 5) { live.eS = 0; S.save(); } }
    }
    if (live.race) raceTick(dt);
    if (live.battle) battleTick(dt);
    if (m.path.length) { m.stuck = Math.hypot(m.px - ox, m.py - oy) < 0.002 ? m.stuck + dt : 0; if (m.stuck > 0.5) { m.path = []; live.pending = null; } }
    const tx = Math.floor(m.px + 0.5), ty = Math.floor(m.py + 0.82);
    if (tx !== m.x || ty !== m.y) { m.x = tx; m.y = ty; updateCtx(); }
    // share position about 10 times a second while moving, plus a final update when stopping
    m.netT += dt;
    const movedSince = Math.hypot(m.px - m.sent.x, m.py - m.sent.y);
    if ((m.netT > 0.1 && movedSince > 0.03) || (!m.moving && movedSince > 0.001)) { m.netT = 0; m.sent = { x: m.px, y: m.py }; net.send({ t: 'move', x: +m.px.toFixed(2), y: +m.py.toFixed(2), dir: m.dir }); }
    if (live.p2) moveP2(dt);
    // smooth camera (between both players when two play on one screen)
    const p2 = live.p2 && !live.p2.hidden ? live.p2 : null, cx = p2 ? (m.px + p2.px) / 2 : m.px, cy = p2 ? (m.py + p2.py) / 2 : m.py;
    const ca = Math.min(1, dt * 7); live.cam.x += (cx - live.cam.x) * ca; live.cam.y += (cy - live.cam.y) * ca;
    follow(m.petPos, m.px - 0.45, m.py + 0.25, dt);
    { // Басар trots behind you and sits beside you when you stop
      const dg = live.dog, [ddx, ddy] = DIRS[m.dir], tx2 = m.moving ? m.px - ddx * 0.95 + (ddy ? 0.6 : 0) : m.px + 1.1, ty2 = m.moving ? m.py - ddy * 0.7 + 0.15 : m.py + 0.25;
      const ox = dg.x, oy = dg.y, q = Math.min(1, dt * 3); dg.x += (tx2 - dg.x) * q; dg.y += (ty2 - dg.y) * q;
      if (Math.hypot(m.px - dg.x, m.py - dg.y) > 4) { dg.x = tx2; dg.y = ty2; }
      const sp2 = Math.hypot(dg.x - ox, dg.y - oy) / Math.max(dt, 1e-3); dg.moving = sp2 > 0.4; dg.idle = dg.moving ? 0 : dg.idle + dt;
      if (Math.abs(dg.x - ox) > 0.002) dg.flip = dg.x < ox; else if (!dg.moving) dg.flip = m.px + 0.2 < dg.x;
      const nowP = performance.now();
      if (nowP > dg.nextFact && !document.querySelector('.modal-back') && !(TG.dialog && TG.dialog.active())) { dg.nextFact = nowP + 45000 + Math.random() * 30000; const sf = TG.seasons.current(), f = Math.random() < 0.5 ? (() => { const ff = TG.pick(sf.facts); return { mn: `${sf.icon} Мэдэх үү? ${ff.mn}`, en: `${sf.icon} Did you know? ${ff.en}` }; })() : TG.BASAR.FACTS[Math.floor(Math.random() * TG.BASAR.FACTS.length)]; dg.bubble = { fact: f, t0: nowP }; TG.sfx.pop && TG.sfx.pop(); TG.voice && TG.voice.babble(L('Вуф! Мэдэх үү?', 'Woof! Did you know?'), 'basar'); }
      if (dg.bubble && nowP - dg.bubble.t0 > 12000) dg.bubble = null;
    }
    const tg = live.tut && live.tut.guide;
    if (tg) { // Nomin doesn't follow you: she pops in beside you when she has something to say, turns to face you, then pops out again
      tg.moving = false; tg.dir = Math.abs(m.px - tg.x) < 0.3 ? 0 : m.px < tg.x ? 1 : 2;
      if (tg.out && performance.now() - tg.out > POOF_MS) live.tut.guide = null;
    }
    for (const o of live.others.values()) {
      const dx = o.x - o.px, dy = o.y - o.py, d = Math.hypot(dx, dy);
      if (d > 5) { o.px = o.x; o.py = o.y; }
      else { const q = Math.min(1, dt * 9); o.px += dx * q; o.py += dy * q; }
      o.moving = d > 0.04; if (Math.abs(dx) > 0.02) o.face = dx < 0 ? 1 : 2;
      follow(o.petPos, o.px - 0.45, o.py + 0.25, dt);
    }
    for (const q of live.sheep) {
      q.next -= dt;
      if (q.next <= 0) { q.next = 2 + Math.random() * 4; const [dx, dy] = DIRS[Math.floor(Math.random() * 4)], nx = q.x + dx, ny = q.y + dy; if (nx >= 23 && nx <= 32 && ny >= 19 && ny <= 23) { q.x = nx; q.y = ny; if (dx) q.flip = dx > 0; } }
      q.px += (q.x - q.px) * Math.min(1, dt * 2.5); q.py += (q.y - q.py) * Math.min(1, dt * 2.5);
    }
    live.ctxTimer -= dt; if (live.ctxTimer <= 0) { live.ctxTimer = 0.4; updateCtx(); }
  }

  /** What is where this frame, for the Phaser view (view.js): sprites, ground shadows, names, labels and markers.
      Positions are in world art pixels (16 per tile); the view does the camera, sorting and drawing. */
  function model(t) {
    if (!live) return null;
    const pn = performance.now(), v = V();
    const F = { cam: { x: live.cam.x * T + 8, y: live.cam.y * T + 4 }, season: live.season, night: TG.seasons.night(), sprites: [], shadows: [], texts: [], tags: [], marks: [] };
    const sprite = (id, img, x, y, depth, flip, alpha) => F.sprites.push({ id, img, x, y, depth, flip, alpha });
    const shadow = (id, x, y) => F.shadows.push({ id, x, y });
    const text = (id, str, x, y, size, color, alpha) => { if (str != null && str !== '') F.texts.push({ id, text: String(str), x, y, size, color, alpha }); }; // never draw "null" for a missing name
    const frame = (o) => (o.moving ? 1 + (Math.floor(t * (o.running ? 13 : 8)) % 2) : 0);
    live.sheep.forEach((q) => { shadow('sheep:' + q.i, q.px * T, q.py * T); const sh = PX.animal('sheep', Math.floor(t * 2 + q.i) % 2); sprite('sheep:' + q.i, TG.gerwork.shearable(q.i) ? sh : PX.shorn(sh), q.px * T, q.py * T + 2, q.py, q.flip); });
    if (live.season === 'spring') live.sheep.forEach((q) => sprite('lamb:' + q.i, PX.animal('lamb', Math.floor(t * 3 + q.i) % 2), q.px * T + (q.flip ? -9 : 12), q.py * T + 6, q.py + 0.3, q.flip)); // spring: the lambs are born
    // a rider on a Mongolian horse; face 1 = left, 2 = right
    const rider = (id, look, face, moving, wx, wy, depth, z = 0) => {
      const hf = z ? 2 : moving ? 1 + (Math.floor(t * (live.me.running && wx === live.me.px ? 17 : 12)) % 4) : 0, hs = PX.horse(look.coat || 'bay', hf, true), left = face === 1;
      const HX = wx * T - 6, HY = wy * T + 16 - hs.height - z;
      F.shadows.push({ id: id + ':h', x: HX + 4, y: HY + 21 + z, w: 20, h: 2 });
      sprite(id + ':r', PX.char({ ...look, pet: null }, left ? 1 : 2, 0), HX + 6, HY - 15, depth);
      sprite(id + ':h', hs, HX, HY, depth + 0.001, left);
    };
    const person = (id, o) => {
      if (o.look.pet) { const a = PX.animal(o.look.pet, frame(o)); shadow(id + ':pet', o.petPos.x * T - 2, o.petPos.y * T - 1); sprite(id + ':pet', a, o.petPos.x * T + 2, o.petPos.y * T + 16 - a.height, o.petPos.y, o.px > o.petPos.x + 0.05); }
      const z = jumpZ(o, pn);
      if (o.look.ride) rider(id, o.look, o.face || (o.dir === 1 ? 1 : 2), o.moving, o.px, o.py, o.py, z);
      else { shadow(id, o.px * T, o.py * T); sprite(id, PX.char(o.look, o.dir, z ? 0 : frame(o)), o.px * T, o.py * T - 12 - z, o.py); }
    };
    if (live.race) live.race.npcs.forEach((n, i) => { rider('race:' + i, n.look, n.face, live.race.phase === 'go' && !n.done, n.px, n.py, n.py); if (live.race.phase === 'go') text('race:' + i, n.name, n.px * T + 8, n.py * T - 22, 0.8, '#ffffff'); });
    for (const o of live.others.values()) person('o:' + o.id, o);
    person('me', { ...live.me, look: v.look });
    const p2 = live.p2 && !live.p2.hidden ? live.p2 : null;
    if (p2) { person('p2', p2); F.zoomOut = clamp(Math.hypot(p2.px - live.me.px, p2.py - live.me.py) / 9, 1, 1.6); }
    const dg = live.dog, dfr = dg.moving ? 1 + (Math.floor(t * 8) % 2) : dg.idle > 1.5 ? 3 : 0;
    shadow('dog', dg.x * T, dg.y * T + 1); sprite('dog', PX.bankhar(dfr), dg.x * T - 3, dg.y * T - 1, dg.y + 0.05, dg.flip);
    lotsArr().forEach((l, i) => { if (!l) return; const o = WD.lots[i]; sprite('lot:' + i, PX.gerStage(R.lotStage(l), R.ROOF[l.roof] || R.ROOF.blue, R.DOOR[l.door] || R.DOOR.red), o.x * T, o.y * T - 2, o.y + 2); text('lot:' + i, l.n, o.x * T + 24, o.y * T - 4, 1, l.by === v.id ? '#f7c646' : '#ffffff'); });
    // the dairy yard's animals: cows and goats shift about, mares stand by their foals on the зэл
    for (const o of WD.objects) {
      if (o.kind === 'cow' || o.kind === 'goat') { const turn = Math.floor(t / 4 + o.x) % 3 === 0, f = Math.floor(t * 2 + o.y) % 5 === 0 ? 1 : 0, img = PX.beast(o.kind, f); shadow('obj:' + o.id, o.x * T + (o.kind === 'cow' ? 6 : 0), o.y * T + 1); sprite('obj:' + o.id, img, o.x * T + (o.kind === 'cow' ? 4 : -1), o.y * T + 14 - img.height, o.y + 0.2, turn); }
      if (o.kind === 'felt') sprite('obj:felt', PX.feltMat(), o.x * T, o.y * T, o.y + 0.4);
      if (o.kind === 'zel') [[0.6, 'foal'], [2.2, 'foal'], [1.2, 'mare'], [3.1, 'mare']].forEach(([dx, kd], i) => { const img = PX.beast(kd, kd === 'foal' && Math.floor(t * 1.5 + i) % 7 === 0 ? 1 : 0), my = kd === 'mare' ? 0.75 : 0; sprite('zel:' + i, img, (o.x + dx) * T, (o.y + my) * T + 12 - img.height, o.y + my + 0.1, i % 2 === 1); });
    }
    const still = (id, o, look, dir) => { shadow(id, o.x * T, o.y * T); sprite(id, PX.char(look, dir, 0), o.x * T, o.y * T - 12, o.y); };
    const zs = WD.objects.find((q) => q.kind === 'npc');
    if (zs) { still('zasuul', zs, ZASUUL, Math.floor(t / 2.5) % 4 === 3 ? 2 : 0); text('zasuul', L('Засуул', 'Herald'), zs.x * T + 8, zs.y * T - 16, 1, '#f7c646'); }
    const bounce = (x) => Math.round(Math.sin(pn / 180 + x) * 2) / 2;
    for (const np of WD.objects.filter((q) => q.kind === 'npcq')) {
      const d = NPCS[np.id]; if (!d) continue;
      still('npc:' + np.id, np, d.look, Math.floor(t / 3 + np.x) % 5 === 4 ? 2 : 0);
      text('npc:' + np.id, tx(d.name).split(' ').pop(), np.x * T + 8, np.y * T - 16, 0.8, '#ffffff');
      const mk = npcMark(np.id); if (mk) text('npc!:' + np.id, mk, np.x * T + 8, np.y * T - 25 + bounce(np.x), 1.8, mk === '?' ? '#7fe07a' : '#f7c646');
    }
    const em = WD.objects.find((q) => q.kind === 'emee');
    if (em) {
      still('emee', em, EMEE, Math.floor(t / 3) % 4 === 2 ? 1 : 0); text('emee', L('Эмээ', 'Grandma'), em.x * T + 8, em.y * T - 16, 1, '#f7c646');
      if (!(v.emee && v.emee.visits)) text('emee!', '!', em.x * T + 8, em.y * T - 25 + bounce(0), 1.8, '#f7c646');
    }
    if (live.race) {
      const RC = live.race.path.P, fl = Math.floor(t * 4) % 2;
      for (let i = Math.max(1, live.race.ci); i < Math.min(RC.length, live.race.ci + 4); i++) { const p = RC[i], last = i === RC.length - 1; sprite('flag:' + i, PX.raceFlag(last ? '#e14b3d' : i === live.race.ci ? '#f7c646' : '#ffffff', fl), (p.x - 0.3) * T, (p.y - 1) * T - 15, p.y - 0.9); }
      if (live.race.phase !== 'done') { const nx = RC[Math.min(live.race.ci, RC.length - 1)]; F.marks.push({ id: 'race', kind: 'raceArrow', x: live.me.px * T + 8, y: live.me.py * T - 36, ang: Math.atan2(nx.y - (live.me.py + 0.82), nx.x - (live.me.px + 0.5)), color: '#f7c646' }); }
    }
    battleModel(F, rider, text);
    const tg = live.tut && live.tut.guide;
    if (tg && TG.tutorial) { // Nomin: a hop and a puff when she pops in, a puff when she pops out
      const qi = Math.min(1, (pn - tg.in) / POOF_MS), qo = tg.out ? (pn - tg.out) / POOF_MS : 0;
      if (qi > 0.2 && qo < 0.35) { const hop = qi < 1 ? Math.round(Math.sin(qi * Math.PI) * 7) : 0; shadow('nomin', tg.x * T, tg.y * T); sprite('nomin', PX.char(TG.tutorial.LOOK, tg.dir || 0, 0), tg.x * T, tg.y * T - 12 - hop, tg.y); }
      if (qi < 1) F.marks.push({ id: 'nomin:in', kind: 'poof', x: tg.x * T + 8, y: tg.y * T + 6, q: qi });
      if (tg.out) F.marks.push({ id: 'nomin:out', kind: 'poof', x: tg.x * T + 8, y: tg.y * T + 6, q: Math.min(1, qo) });
      if (!tg.out && pn - tg.in > POOF_MS * 0.6) text('nomin', L('Номин', 'Nomin'), tg.x * T + 8, tg.y * T - 16, 0.8, '#f7c646');
    }
    const gn = WD.objects.find((q) => q.kind === 'general'), hs0 = WD.objects.find((q) => q.kind === 'historian');
    if (gn) { still('general', gn, GENERAL, Math.floor(t / 3 + gn.x) % 5 === 4 ? 2 : 0); text('general', L('Жанжин', 'General'), gn.x * T + 8, gn.y * T - 16, 0.8, '#f7c646'); }
    if (hs0) { still('historian', hs0, HISTORIAN, Math.floor(t / 3 + hs0.x) % 5 === 4 ? 2 : 0); text('historian', L('Түүхч', 'Historian'), hs0.x * T + 8, hs0.y * T - 16, 0.8, '#f7c646'); if (TG.history && TG.history.ready()) text('historian!', '!', hs0.x * T + 8, hs0.y * T - 25, 1.8, '#7fe07a'); }
    const tag = (id, o, name, level, isMe) => {
      const look = isMe ? v.look : o.look || {}, title = look.title && R.TITLES.find((q) => q.id === look.title);
      const d = { id, name: name || '?', level, mine: isMe, title: title ? tx(title.name) : null, x: o.px * T + 8, y: o.py * T - 16 - (look.ride ? 10 : 0) };
      if (o.bubble) { const age = (pn - o.bubble.t0) / 1000; if (age > 4.5) o.bubble = null; else { d.bubble = o.bubble.text; d.bubbleAlpha = age > 3.9 ? (4.5 - age) / 0.6 : 1; } }
      F.tags.push(d);
    };
    for (const o of live.others.values()) tag('o:' + o.id, o, o.name, o.lvl, false);
    tag('me', live.me, live.name, R.level(v.xp).l, true);
    if (p2) tag('p2', p2, p2.name, '🤝', false);
    const tt = live.tut && live.tut.target;
    if (tt && !live.race) { // the tutorial points at where to go: a bouncing arrow over the spot, and a compass arrow over you when it is far away
      F.marks.push({ id: 'tut', kind: 'arrow', x: tt.x * T + 8, y: tt.y * T - 26, label: tt.label });
      const fx = live.me.px + 0.5, fy = live.me.py + 0.82;
      if (Math.hypot(tt.x + 0.5 - fx, tt.y + 0.5 - fy) > 3.5) F.marks.push({ id: 'tut:c', kind: 'compass', x: live.me.px * T + 8, y: live.me.py * T - 30, ang: Math.atan2(tt.y + 0.5 - fy, tt.x + 0.5 - fx) });
    }
    text('dog', L('Басар', 'Basar'), dg.x * T + 8, dg.y * T - 4, 0.8, '#f7c646');
    if (dg.bubble) text('dog!', '!', dg.x * T + 13, dg.y * T - 10 + Math.round(Math.sin(pn / 180) * 2) / 2, 1.8, '#f7c646');
    live.floaters = live.floaters.filter((f) => pn - f.t0 < 1400);
    for (const f of live.floaters) {
      const q = (pn - f.t0) / 1400, id = 'float:' + f.t0;
      if (f.poof) { const qp = (pn - f.t0) / POOF_MS; if (qp < 1) F.marks.push({ id, kind: 'poof', x: f.x * T + 8, y: f.y * T + 6, q: qp }); continue; }
      if (f.ring) { F.marks.push({ id, kind: 'ring', x: f.x * T + 8, y: f.y * T + 10, q }); continue; }
      text(id, f.text, f.x * T + 8, f.y * T + 10 - (8 + q * 14), 1, f.color, 1 - q);
    }
    return F;
  }
  function floatAt(p, text, color) { if (live) live.floaters.push({ x: p.px !== undefined ? p.px : p.x, y: p.py !== undefined ? p.py : p.y, text, color, t0: performance.now() }); }

  // ================================================================ panels
  const icon = (k) => h('span', { class: 'v-ic' }, String(k).includes(':') ? pic(k, 32) : k);
  function factCard(key, title, fact, head) {
    const close = TG.modal(h('div', { class: 'center v-fact' }, h('div', { class: 'v-fact-e' }, pic(key, 72)), head ? h('div', { class: 'eyebrow' }, head) : null, h('h2', null, title),
      h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, fact)),
      h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: () => close() }, L('Гайхалтай!', 'Cool!'))));
  }
  function shopModal(start) {
    const v = V(); let cur = start || 'wear';
    const body = h('div', { class: 'v-shop' });
    const TABS = [['wear', 'deel:red', L('Хувцас', 'Clothes')], ['pet', 'pet:lamb', L('Тэжээвэр', 'Pets')], ['tool', 'tool:rod-2', L('Багаж', 'Tools')], ['sell', 'ui:coin', L('Зарах', 'Sell')]];
    const pay = (price) => { if (v.coins < price) { TG.sfx.bad(); TG.toast(L('Зоос хүрэлцэхгүй байна. Хичээл үзэж, Басарын асуултад хариулж, цагаан идээ зарж цуглуулаарай!', 'Not enough coins. Learn, answer Basar’s quizzes or sell dairy foods to earn more!')); return false; } v.coins -= price; TG.sfx.chime(); return true; };
    const ownedItem = (it) => (it.cat === 'tool' ? v.rod >= it.val : v.owned.includes(it.id));
    const draw = () => {
      const level = lvl();
      let list;
      if (false) list = [];
      else if (cur === 'sell') {
        const goods = [...Object.entries(v.produce).filter(([k, n]) => n > 0 && R.DAIRY[k]).map(([k, n]) => ({ k, n, kind: 'produce', e: 'dairy:' + k, name: R.DAIRY[k].name, price: R.DAIRY[k].sell })),
          ...Object.entries(v.fish).filter(([, n]) => n > 0).map(([k, n]) => ({ k, n, kind: 'fish', e: 'fish:' + k, name: R.FISH[k].name, price: R.FISH[k].sell }))];
        const sell = (g, n) => { v[g.kind][g.k] -= n; v.coins += g.price * n; quest('sell', n); TG.sfx.chime(); save(); };
        list = goods.length ? [h('button', { class: 'btn primary block', onclick: () => goods.forEach((g) => sell(g, g.n)) }, `${L('Бүгдийг зарах', 'Sell everything')} · +${goods.reduce((s, g) => s + g.n * g.price, 0)}`, pic('ui:coin', 16)),
          ...goods.map((g) => h('div', { class: 'v-row' }, icon(g.e), h('div', { class: 'v-row-b' }, h('b', null, `${tx(g.name)} ×${g.n}`), h('small', null, `${g.price} ${L('зоос, ширхэг бүр', 'coins each')}`)),
            h('button', { class: 'btn sm', onclick: () => sell(g, 1) }, `${L('Зарах', 'Sell')} 1`)))]
          : [h('div', { class: 'empty-memory' }, h('p', null, L('Зарах зүйл алга. Мал саагаад цагаан идээ хийж, загас бариарай!', 'Nothing to sell yet. Milk the animals, make dairy foods or catch fish!')))];
      } else list = R.ITEMS.filter((it) => it.cat === cur).map((it) => {
        const owned = ownedItem(it), locked = level < it.lvl, worn = it.cat !== 'tool' && v.look[it.slot] === it.val;
        return h('div', { class: 'v-row' + (locked && !owned ? ' locked' : '') }, icon(itemKey(it)), h('div', { class: 'v-row-b' }, h('b', null, tx(it.name)), h('small', null, owned ? (worn ? L('Өмссөн', 'Wearing') : L('Танд байгаа', 'Owned')) : `${it.price} ${L('зоос', 'coins')}`)),
          owned ? (it.cat === 'tool' ? h('span', { class: 'v-owned' }, '✓') : h('button', { class: 'btn sm' + (worn ? ' done' : ''), onclick: () => equip(it.slot, worn && it.slot !== 'deel' ? null : it.val, draw) }, worn ? (it.slot === 'deel' ? '✓' : L('Тайлах', 'Remove')) : L('Өмсөх', 'Wear')))
            : locked ? h('span', { class: 'v-lock' }, '🔒 ', L('Түвшин', 'Lv'), ' ', it.lvl)
              : h('button', { class: 'btn sm primary', onclick: () => {
                if (!pay(it.price)) return;
                if (it.cat === 'tool') v.rod = it.val;
                else { v.owned.push(it.id); v.look[it.slot] = it.val; sendLook(); }
                TG.toast(`${tx(it.name)}: ${L('худалдаж авлаа!', 'purchased!')}`); save();
              } }, `${it.price}`, pic('ui:coin', 14)));
      });
      if (cur === 'tool') { // the white cover for your ger: canvas the herders buy in town
        const g = v.ger, need = g.stage < 7 && !(g.parts.buurees > 0);
        list.unshift(h('div', { class: 'v-row v-cover' }, icon('part:buurees'), h('div', { class: 'v-row-b' }, h('b', null, L('Гэрийн цагаан бүрээс', 'White ger cover')), h('small', null, need ? L('Эсгийн гадуур хучиж, бороо, нарнаас хамгаална.', 'Goes over the felt and keeps out rain and sun.') : L('✓ Танд байгаа', '✓ You have it'))),
          need ? h('button', { class: 'btn sm', 'data-buy': 'buurees', onclick: () => { if (!pay(R.COVER_PRICE)) return; g.parts.buurees = (g.parts.buurees || 0) + 1; TG.toast(L('Бүрээс худалдаж авлаа!', 'You bought the cover!')); save(); } }, `${R.COVER_PRICE}`, pic('ui:coin', 14)) : h('span', { class: 'v-owned' }, '✓')));
      }
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
    const sec = (title, obj, src) => { const items = Object.entries(obj).filter(([k, n]) => n > 0 && src[k]); return h('div', { class: 'v-slot' }, h('div', { class: 'label' }, title), items.length ? h('div', { class: 'v-chips' }, items.map(([k, n]) => h('span', { class: 'v-chip wide' }, pic((src === R.FISH ? 'fish:' : 'dairy:') + k, 24), ` ${tx(src[k].name)} ×${n}`))) : h('p', { class: 'muted' }, '—')); };
    const L1 = R.level(v.xp);
    const close = TG.modal(h('div', null, h('h2', null, L('Цүнх', 'Bag')),
      h('div', { class: 'stat-cards' }, h('div', { class: 'stat' }, h('small', null, L('Түвшин', 'Level')), h('b', null, L1.l)), h('div', { class: 'stat' }, h('small', null, 'XP'), h('b', null, `${L1.cur}/${L1.need}`)), h('div', { class: 'stat' }, h('small', null, L('Зоос', 'Coins')), h('b', null, v.coins))),
      sec(L('Цагаан идээ', 'Dairy'), v.produce, R.DAIRY), sec(L('Загас', 'Fish'), v.fish, R.FISH),
      (() => { const g = v.ger, have = [['wool', g.wool, L('Ноос', 'Wool')], ['wool', g.fluff, L('Сэвсгэр ноос', 'Fluffed wool')], ['esgii', g.mats, L('Нойтон ноос', 'Wet wool')], ...Object.entries(g.parts).map(([k, n]) => [k, n, k])].filter(([, n]) => n > 0);
        return h('div', { class: 'v-slot' }, h('div', { class: 'label' }, L('Гэрийн хэрэгсэл', 'Ger parts')), have.length ? h('div', { class: 'v-chips' }, have.map(([k, n, name]) => h('span', { class: 'v-chip wide' }, pic('part:' + k, 24), ` ${name === k ? TG.gerwork.partName(k) : name} ×${n}`))) : h('p', { class: 'muted' }, L('Хонь хяргаж, Мужаан өвөөтэй уулзаарай.', 'Shear sheep and visit Grandpa Craftsman.'))); })(),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => { close(); wardrobe(); } }, '👗 ', L('Хувцас', 'Wardrobe')), h('button', { class: 'btn primary', onclick: () => { close(); shopModal('sell'); } }, '💰 ', L('Зарах', 'Sell')))), { cls: 'v-modal' });
  }

  function questModal() {
    const v = V(), body = h('div');
    v.questsSeen = S.dkey(); S.save(); // Nomin stops reminding you about today's new quests
    const draw = () => rc(body, h('h2', null, L('Өнөөдрийн даалгавар', "Today's quests")),
      h('p', { class: 'muted' }, L('Даалгавар өдөр бүр шинэчлэгдэнэ.', 'Quests refresh every day.')),
      h('div', { class: 'v-list' }, quests().map((q) => {
        const d = QUESTS[q.k], ready = q.p >= d.n && !q.done;
        return h('div', { class: 'v-row' + (q.done ? ' done' : '') }, icon(q.done ? 'ui:star' : 'ui:scroll'),
          h('div', { class: 'v-row-b' }, h('b', null, q.season ? `${TG.seasons.byId(q.season).icon} ` : '', tx(d.t), q.season ? h('small', { class: 'v-season-tag' }, ` ${tx(TG.seasons.byId(q.season).name)} ×1.5`) : null), h('div', { class: 'meter' }, h('span', { style: { width: (q.p / d.n) * 100 + '%' } })), h('small', null, `${q.p}/${d.n} · +${d.c} ${L('зоос', 'coins')} · +${d.x} XP`)),
          ready ? h('button', { class: 'btn sm primary', onclick: () => { q.done = true; if (q.season) { v.seasonDone = v.seasonDone || {}; v.seasonDone[q.season] = Date.now(); } reward(Math.round(d.c * (q.season ? 1.5 : 1)), Math.round(d.x * (q.season ? 1.5 : 1))); TG.confetti(40); draw(); } }, L('Авах', 'Claim')) : q.done ? h('span', { class: 'v-owned' }, '✓') : null);
      })),
      h('button', { class: 'btn block', onclick: () => { close(); TG.go('learn'); } }, '📚 ', L('Өв соёлын сургууль', 'Heritage school')));
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }

  // ================================================================ horse riding + Naadam horse race
  const COAT_NAMES = { bay: Tx('Хээр', 'Bay'), black: Tx('Хар', 'Black'), white: Tx('Цагаан', 'White'), chestnut: Tx('Зээрд', 'Chestnut'), gray: Tx('Саарал', 'Gray') };
  const HORSE_FACTS = [
    Tx('Монгол адуу намхан ч маш тэсвэртэй. Өвлийн хүйтэнд ч гадаа бэлчдэг.', 'Mongolian horses are short but incredibly tough. They graze outside even in winter.'),
    Tx('Наадамд түрүүлсэн морийг “түрүү морь”, эхний тавд орсныг “айргийн тав” гэдэг.', 'At Naadam the winning horse is the “türüü mori”, and the top five are the “airgiin tav”.'),
    Tx('Хамгийн сүүлд ирсэн даага “баян ходоод” гэж магтуулж, ирэх жил сайн давхина гэж ерөөдөг.', 'The last young horse is praised as “bayan khodood” (full belly) and wished a better race next year.'),
    Tx('Наадмын морь уралдаанд 5–12 насны хүүхэд унаач 10–30 км давхидаг.', 'In Naadam races, child jockeys aged 5–12 ride 10–30 km.'),
    Tx('Монголд хүнээс олон адуу бий. 3 сая гаруй адуутай!', 'Mongolia has more horses than people: over 3 million!'),
  ];
  const RIDERS = ['Бат', 'Сараа', 'Тэмүүжин', 'Номин', 'Ганбаатар', 'Энхжин', 'Мөнх', 'Ану'];
  function mount(coat) {
    const v = V(); if (!live) return;
    if (coat) v.horse.coat = coat;
    live.ride = { coat: v.horse.coat }; v.look.ride = 'horse'; v.look.coat = v.horse.coat; S.save(); sendLook();
    TG.sfx.whoosh ? TG.sfx.whoosh() : TG.sfx.tap(); hud(); checkAch();
  }
  function dismount() {
    if (!live || live.race) return;
    live.ride = null; const v = V(); v.look.ride = null; S.save(); sendLook(); TG.sfx.tap(); hud();
  }
  // Naadam race classes by the horse's age (real Naadam categories). Higher classes ride more laps against faster rivals.
  const CLASSES = [
    { id: 'daaga', name: Tx('Даага', 'Daaga'), age: Tx('2 настай', '2 years'), laps: 1, pace: 5.2, fact: Tx('Даага бол 2 настай морь. Наадмын хамгийн бага насны уралдаан.', 'A daaga is a 2-year-old horse: the youngest Naadam race.') },
    { id: 'shudlen', name: Tx('Шүдлэн', 'Shüdlen'), age: Tx('3 настай', '3 years'), laps: 1, pace: 5.55, fact: Tx('Шүдлэн бол 3 настай морь.', 'A shüdlen is a 3-year-old horse.') },
    { id: 'khyazaalan', name: Tx('Хязаалан', 'Khyazaalan'), age: Tx('4 настай', '4 years'), laps: 2, pace: 5.75, fact: Tx('Хязаалан бол 4 настай морь.', 'A khyazaalan is a 4-year-old horse.') },
    { id: 'soyolon', name: Tx('Соёолон', 'Soyolon'), age: Tx('5 настай', '5 years'), laps: 2, pace: 5.95, fact: Tx('Соёолон бол 5 настай морь.', 'A soyolon is a 5-year-old horse.') },
    { id: 'ikhnas', name: Tx('Их нас', 'Ikh nas'), age: Tx('6+ настай', '6+ years'), laps: 3, pace: 6.15, fact: Tx('Их насны морьд хамгийн урт зайд, 25 гаруй км давхидаг.', 'Ikh nas horses (6+) race the longest distance, over 25 km.') },
    { id: 'azarga', name: Tx('Азарга', 'Azarga'), age: Tx('азарга', 'stallions'), laps: 3, pace: 6.35, fact: Tx('Азаргын уралдаанд адууны сүргийн эзэн азарганууд уралддаг.', 'In the azarga race, the stallions who lead the herds compete.') },
  ];
  const stat = (n) => h('div', { class: 'h-stat' }, h('div', { class: 'meter' }, h('span', { style: { width: Math.min(100, n * 10) + '%' } })), h('b', null, `${n}/10`));
  function uyaModal() {
    const v = V(), hs = v.horse; let coat = hs.coat, cls = Math.min(hs.cls || 0, CLASSES.length - 1);
    hs.spd = hs.spd || 1; hs.sta = hs.sta || 1;
    const body = h('div');
    const preview = () => { const c = h('canvas', { class: 'px-icon', width: 28, height: 22, style: { width: '112px', height: '88px' } }); c.getContext('2d').drawImage(PX.horse(coat, 0, true), 0, 0); return c; };
    const draw = () => rc(body,
      h('div', { class: 'v-wr-head' }, preview(), h('div', null, h('h2', null, L('Морины уяа', 'Horse line')), h('p', { class: 'muted' }, L('Морь унаж Нутгаар чөлөөтэй давхих, эсвэл Наадмын уралдаанд оролцоорой!', 'Ride freely around Nutag, or join the Naadam horse race!')))),
      h('div', { class: 'label' }, L('Морио сонго', 'Pick your horse')),
      h('div', { class: 'v-chips' }, Object.keys(PX.COATS).map((k) => h('button', { class: 'v-chip' + (coat === k ? ' active' : ''), onclick: () => { coat = k; draw(); } }, tx(COAT_NAMES[k])))),
      h('div', { class: 'h-stats' }, h('span', null, '⚡ ', L('Хурд', 'Speed')), stat(hs.spd), h('span', null, '💪 ', L('Тэсвэр', 'Stamina')), stat(hs.sta)),
      h('small', { class: 'muted' }, L('Уралдаан бүрийн дараа морь чинь дасгалжиж хүчирхэгжинэ.', 'Your horse trains and gets stronger after every race.')),
      h('div', { class: 'label', style: { marginTop: '10px' } }, L('Уралдааны ангилал (морины нас)', 'Race class (horse age)')),
      h('div', { class: 'race-classes' }, CLASSES.map((c, i) => { const open = i <= (hs.cls || 0); return h('button', { class: 'race-cls' + (cls === i ? ' on' : '') + (open ? '' : ' locked'), disabled: !open, onclick: () => { cls = i; draw(); } },
        h('b', null, open ? '' : '🔒 ', tx(c.name)), h('small', null, `${tx(c.age)} · ${c.laps} ${L('тойрог', c.laps > 1 ? 'laps' : 'lap')}`)); })),
      h('p', { class: 'muted' }, tx(CLASSES[cls].fact), ' ', (hs.cls || 0) < CLASSES.length - 1 ? L('Эхний гуравт орж дараагийн ангиллыг нээгээрэй.', 'Finish in the top three to unlock the next class.') : ''),
      h('div', { class: 'stat-cards' },
        h('div', { class: 'stat' }, h('small', null, L('Уралдаан', 'Races')), h('b', null, hs.races || 0)),
        h('div', { class: 'stat' }, h('small', null, L('Түрүү', 'Wins')), h('b', null, hs.wins || 0)),
        h('div', { class: 'stat' }, h('small', null, L('Айргийн тав', 'Top five')), h('b', null, hs.top5 || 0))),
      h('div', { class: 'row-btns' },
        live.ride ? h('button', { class: 'btn', onclick: () => { close(); dismount(); } }, L('Буух', 'Get off')) : h('button', { class: 'btn', onclick: () => { close(); mount(coat); TG.toast(L('Чөлөөтэй давхиарай! 🐎', 'Ride free! 🐎')); } }, '🐎 ', L('Морь унах', 'Ride')),
        h('button', { class: 'btn primary', onclick: () => { close(); v.horse.coat = coat; raceStart(cls); } }, '🏁 ', L('Уралдах', 'Race'))),
      h('div', { class: 'teach', style: { marginTop: '12px' } }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(TG.pick(HORSE_FACTS)))));
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  function racePath(laps) {
    const P = [];
    for (let l = 0; l < laps; l++) P.push(...WD.LAP);
    P.push(WD.LAP[0]);
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
    return { P, cum, total: cum[cum.length - 1] };
  }
  function pointAt(path, s, lane) {
    const { P, cum } = path; let i = 1;
    while (i < P.length - 1 && cum[i] < s) i++;
    const a = P[i - 1], b = P[i], segLen = cum[i] - cum[i - 1] || 1, q = Math.max(i === 1 ? -0.5 : 0, Math.min(1, (s - cum[i - 1]) / segLen)); // before the line on the start grid
    const dx = (b.x - a.x) / segLen, dy = (b.y - a.y) / segLen;
    return { x: a.x + (b.x - a.x) * q - dy * lane, y: a.y + (b.y - a.y) * q + dx * lane, face: dx < -0.1 ? 1 : dx > 0.1 ? 2 : null };
  }
  /** Your horse's speed in the race: steady canter, or a "Чү!" sprint that uses stamina. */
  function raceSpeed() {
    const rc0 = live.race, hs = V().horse;
    if (!rc0 || rc0.phase !== 'go') return 6;
    const cruise = 5.6 + (hs.spd || 1) * 0.09, sprint = cruise + 2.1;
    return rc0.sprint && rc0.stam > 0.02 ? sprint : rc0.stam < 0.05 ? cruise - 0.7 : cruise;
  }
  function raceStart(clsIdx = 0) {
    if (!live || live.race) return;
    document.querySelectorAll('.modal-back .modal-x').forEach((x) => x.click());
    const v = V(), C = CLASSES[clsIdx] || CLASSES[0], path = racePath(C.laps), wins = v.horse.wins || 0;
    if (!live.ride) mount(v.horse.coat);
    const s0 = WD.LAP[0];
    live.me.px = s0.x - 0.5; live.me.py = s0.y - 0.82; live.me.vx = live.me.vy = 0; live.me.path = []; live.me.face = 2; live.cam.x = live.me.px; live.cam.y = live.me.py;
    const pace = C.pace + Math.min(0.5, wins * 0.06);
    const names = [...RIDERS].sort(() => Math.random() - 0.5).slice(0, 3);
    const npcs = names.map((name, i) => ({ name, s: [-1.6, -1.6, -3.2][i], lane: [-0.6, 0.6, 0][i], speed: pace * (0.93 + Math.random() * 0.1), wob: Math.random() * 6, surge: 0, done: 0, face: 2, px: 0, py: 0,
      look: { deel: TG.pick(Object.keys(R.DEELS)), skin: TG.pick(R.SKINS), hat: TG.pick([null, 'mongol', 'cap']), coat: TG.pick(Object.keys(PX.COATS)), ride: 'horse' } }));
    npcs.forEach((n) => { const p = pointAt(path, n.s, n.lane); n.px = p.x - 0.5; n.py = p.y - 0.82; });
    live.race = { cls: clsIdx, C, path, npcs, ci: 1, phase: 'count', t0: performance.now(), go: 0, finishT: 0, labels: [], stam: 1, sprint: false, lap: 1, leader: null, say: L('🎵 Гийнгоо! Унаачид морьдоо урамшуулж дуулж байна…', '🎵 Giingoo! The riders sing to cheer their horses…') };
    TG.sfx.tick && TG.sfx.tick(); hud(); raceHud();
  }
  function raceTick(dt) {
    const rc0 = live.race, nowP = performance.now(), hs = V().horse;
    if (rc0.phase === 'count') {
      const left = 3 - Math.floor((nowP - rc0.t0) / 1000);
      if (left !== rc0.lastCount) { rc0.lastCount = left; if (left > 0) TG.sfx.tick && TG.sfx.tick(); else TG.sfx.chime && TG.sfx.chime(); }
      if (nowP - rc0.t0 >= 3000) { rc0.phase = 'go'; rc0.go = nowP; rc0.say = L('Чү! Уралдаан эхэллээ!', 'Chü! The race is on!'); }
      raceHud(); return;
    }
    if (rc0.phase !== 'go') return;
    // stamina: sprinting drains it, cantering refills it; a fitter horse tires more slowly
    const moving = Math.hypot(live.me.vx, live.me.vy) > 0.5;
    if (rc0.sprint && moving && rc0.stam > 0) rc0.stam = Math.max(0, rc0.stam - dt * (0.3 - (hs.sta || 1) * 0.017));
    else rc0.stam = Math.min(1, rc0.stam + dt * 0.11);
    const el = (nowP - rc0.go) / 1000;
    for (const n of rc0.npcs) {
      if (n.done) continue;
      if (n.surge <= 0 && Math.random() < dt * 0.12) n.surge = 2 + Math.random() * 1.5; // rivals make their own dashes
      if (n.surge > 0) n.surge -= dt;
      const sp = n.speed * (1 + 0.05 * Math.sin(el * 1.3 + n.wob)) + (n.surge > 0 ? 1.1 : 0);
      n.s += sp * dt;
      if (n.s >= rc0.path.total) { n.s = rc0.path.total; n.done = nowP; }
      const p = pointAt(rc0.path, n.s, n.lane); n.px = p.x - 0.5; n.py = p.y - 0.82; if (p.face) n.face = p.face;
    }
    const P = rc0.path.P, fx = live.me.px + 0.5, fy = live.me.py + 0.82;
    if (rc0.ci < P.length && Math.hypot(P[rc0.ci].x - fx, P[rc0.ci].y - fy) < 1.9) {
      rc0.ci++; TG.sfx.pop && TG.sfx.pop();
      const lap = 1 + Math.floor((rc0.ci - 1) / WD.LAP.length);
      if (lap > rc0.lap && rc0.ci < P.length) { rc0.lap = lap; rc0.say = lap === rc0.C.laps ? L('🔔 Сүүлийн тойрог!', '🔔 Final lap!') : L(`${lap}-р тойрог!`, `Lap ${lap}!`); }
      if (rc0.ci >= P.length) return raceFinish(false);
    }
    // commentary when the leader changes
    const leader = racePlace() === 1 ? live.name : rc0.npcs.reduce((a, b2) => (b2.s > a.s ? b2 : a)).name;
    if (leader !== rc0.leader && el > 2) { rc0.leader = leader; rc0.say = leader === live.name ? L('🎉 Та тэргүүлж байна!', '🎉 You are in the lead!') : L(`${leader} тэргүүлж байна!`, `${leader} takes the lead!`); }
    if (el > 40 + rc0.C.laps * 40) return raceFinish(true);
    raceHud();
  }
  function racePlace() {
    const rc0 = live.race, P = rc0.path.P, fx = live.me.px + 0.5, fy = live.me.py + 0.82;
    const mine = rc0.ci >= P.length ? rc0.path.total + 1 : rc0.path.cum[rc0.ci] - Math.hypot(P[rc0.ci].x - fx, P[rc0.ci].y - fy);
    return 1 + rc0.npcs.filter((n) => (n.done && (!rc0.finishT || n.done < rc0.finishT)) || (!n.done && n.s > mine)).length;
  }
  function raceHud() {
    const rc0 = live.race, e = live.els.race;
    live.els.sprint.classList.toggle('hidden', !rc0 || rc0.phase !== 'go');
    if (!rc0) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    if (rc0.phase === 'count') { const n = 3 - Math.floor((performance.now() - rc0.t0) / 1000); if (rc0.shown !== n) { rc0.shown = n; rc(e, h('div', { class: 'v-race-row' }, h('b', { class: 'v-race-big' }, n > 0 ? String(n) : L('Чү!', 'Go!'))), h('small', { class: 'v-race-say' }, rc0.say)); } return; }
    const t = ((performance.now() - rc0.go) / 1000).toFixed(1), place = racePlace();
    rc(e, h('div', { class: 'v-race-row' }, h('span', null, `🔁 ${Math.min(rc0.lap, rc0.C.laps)}/${rc0.C.laps}`), h('span', { class: 'v-race-place' }, `${place}/${rc0.npcs.length + 1}`), h('span', null, `⏱ ${t}`)),
      h('div', { class: 'v-stam' + (rc0.stam < 0.2 ? ' low' : '') }, h('i', { style: { width: Math.round(rc0.stam * 100) + '%' } })),
      h('small', { class: 'v-race-say' }, rc0.say));
  }
  function raceFinish(timeout) {
    const rc0 = live.race; if (!rc0 || rc0.phase === 'done') return;
    rc0.phase = 'done'; rc0.finishT = performance.now(); rc0.sprint = false; raceHud();
    const ms = rc0.finishT - rc0.go, place = timeout ? rc0.npcs.length + 1 : racePlace(), v = V(), hs = v.horse;
    hs.races = (hs.races || 0) + 1; if (place === 1) hs.wins = (hs.wins || 0) + 1; if (place <= 5) hs.top5 = (hs.top5 || 0) + 1;
    // training: every race makes the horse a little faster or tougher
    const trained = Math.random() < 0.5 ? 'spd' : 'sta'; hs[trained] = Math.min(10, (hs[trained] || 1) + 1);
    let unlocked = null;
    if (place <= 3 && rc0.cls === (hs.cls || 0) && (hs.cls || 0) < CLASSES.length - 1) { hs.cls = (hs.cls || 0) + 1; unlocked = CLASSES[hs.cls]; }
    const key = 'best_' + rc0.C.id, newBest = !timeout && (!hs[key] || ms < hs[key]); if (newBest) hs[key] = Math.round(ms);
    if (!timeout && (!hs.best || ms < hs.best)) hs.best = Math.round(ms);
    const pay = [[40, 60], [25, 40], [15, 30], [5, 15]][place - 1] || [5, 15], boost = 1 + rc0.cls * 0.25;
    const r = reward(Math.round(pay[0] * boost), Math.round(pay[1] * boost)); S.save();
    quest('race');
    if (place === 1) { TG.sfx.win(); TG.confetti(90); } else TG.sfx.chime && TG.sfx.chime();
    if (S.logActivity) S.logActivity({ kind: 'race', id: String(place) });
    checkAch();
    // results table: everyone who finished, in order
    const rows = [{ name: live.name, t: timeout ? Infinity : ms, me: true }, ...rc0.npcs.map((n) => ({ name: n.name, t: n.done ? n.done - rc0.go : Infinity }))].sort((a, b2) => a.t - b2.t);
    const title = place === 1 ? L('Түрүү морь! 🏆', 'Winning horse! 🏆') : place <= 5 ? L(`${place}-р байр · Айргийн тав!`, `Place ${place} · top five!`) : L('Баян ходоод!', 'Bayan khodood!');
    const close = TG.modal(h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, pic('ui:trophy', 64)), h('div', { class: 'eyebrow' }, `${tx(rc0.C.name)} · ${rc0.C.laps} ${L('тойрог', rc0.C.laps > 1 ? 'laps' : 'lap')}`), h('h2', null, title),
      h('div', { class: 'race-table' }, rows.map((x, i) => h('div', { class: 'rt-row' + (x.me ? ' me' : '') }, h('b', null, i + 1), h('span', null, x.name), h('small', null, x.t === Infinity ? '–' : (x.t / 1000).toFixed(1) + L('с', 's'))))),
      newBest ? h('p', null, '⏱ ', L('Шинэ дээд амжилт!', 'New personal best!')) : null,
      r ? h('div', { class: 'l-reward' }, `🪙 +${r.coins} · ⭐ +${r.xp} XP`) : null,
      h('p', { class: 'muted' }, trained === 'spd' ? L('🐎 Морь чинь хурдан боллоо! (Хурд +1)', '🐎 Your horse got faster! (Speed +1)') : L('🐎 Морь чинь тэсвэртэй боллоо! (Тэсвэр +1)', '🐎 Your horse got tougher! (Stamina +1)')),
      unlocked ? h('div', { class: 'l-unlock' }, '🔓 ', L(`Шинэ ангилал нээгдлээ: ${tx(unlocked.name)}!`, `New class unlocked: ${tx(unlocked.name)}!`)) : null,
      h('div', { class: 'teach', style: { marginTop: '10px' } }, h('p', null, tx(place === 1 ? Tx('Түрүүлсэн морины толгой, сүүл, гуяыг айргаар цацаж ерөөдөг. Унаач хүүхдийг ч магтдаг.', 'The winning horse is blessed by sprinkling airag on its head, tail and back, and the young jockey is praised.') : HORSE_FACTS[place >= 4 ? 2 : 1]))),
      h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Чөлөөтэй давхих', 'Ride freely')), h('button', { class: 'btn primary', onclick: () => { close(); setTimeout(() => raceStart(unlocked ? hs.cls : rc0.cls), 200); } }, unlocked ? L('Шинэ ангилалд уралдах', 'Race the new class') : L('Дахин уралдах', 'Race again')))),
      { cls: 'v-modal', onClose: () => { if (live) { live.race = null; raceHud(); hud(); } } });
  }

  // ================================================================ сур харваа: Mongolian archery
  const ARCH_FACTS = [
    Tx('Бай онох бүрт шүүгчид гараа өргөн “Уухай!” гэж дуулдаг.', 'Each time the target is hit, the judges raise their arms and sing “Uukhai!”.'),
    Tx('Сур харваанд эрэгтэйчүүд 75 метр, эмэгтэйчүүд 60 метрээс харвадаг.', 'In Mongolian archery men shoot from 75 metres and women from 60 metres.'),
    Tx('Бай нь олон жижиг “сур”-ыг хана шиг өрсөн хэлбэртэй.', 'The target is a low wall made of many small leather “sur”.'),
    Tx('Чингисийн чулууны бичээст Есүнгэ мэргэн 335 алд газар харвасан тухай бичсэн байдаг.', 'The Chinggis Stone records that the archer Yesüngge shot an arrow 335 alds (over 500 m).'),
    Tx('Шилдэг харваачдыг “мэргэн” гэж цоллодог.', 'The best archers earn the title “mergen” (sharpshooter).'),
  ];
  const ARCH_TITLES = [{ need: 12, t: Tx('Улсын мэргэн', 'State Sharpshooter') }, { need: 9, t: Tx('Гарамгай мэргэн', 'Excellent Sharpshooter') }, { need: 6, t: Tx('Мэргэн', 'Sharpshooter') }];
  function archeryModal() {
    const a = V().arch = V().arch || { best: 0, hits: 0, shots: 0, games: 0 };
    const t = ARCH_TITLES.find((x) => a.best >= x.need);
    TG.modal(h('div', null,
      h('div', { class: 'v-wr-head' }, pic('ui:bow', 56), h('div', null, h('h2', null, L('Сур харваа', 'Mongolian archery')), h('p', { class: 'muted' }, t ? `★ ${tx(t.t)}` : L('Цолгүй харваач', 'No title yet')))),
      h('div', { class: 'stat-cards' }, h('div', { class: 'stat' }, h('small', null, L('Шилдэг оноо', 'Best score')), h('b', null, `${a.best}/12`)), h('div', { class: 'stat' }, h('small', null, L('Нийт оносон', 'Total hits')), h('b', null, a.hits)), h('div', { class: 'stat' }, h('small', null, L('Тоглолт', 'Games')), h('b', null, a.games))),
      h('p', { class: 'hint' }, L('3 үе, үе бүрт 4 сум. Эхлээд өнцгөө, дараа нь хүчээ сонгоно. Салхийг анхаараарай! 6 онвол “Мэргэн”, 9 бол “Гарамгай мэргэн”, 12 бүгдийг онвол “Улсын мэргэн” цол.', '3 rounds of 4 arrows. Set the angle, then the power, and watch the wind! Hit 6 for “Mergen”, 9 for “Garamgai mergen”, all 12 for “Ulsyn mergen”.')),
      h('button', { class: 'btn primary big block', onclick: (e) => { e.currentTarget.closest('.modal').querySelector('.modal-x').click(); archeryGame(); } }, '🏹 ', L('Харваж эхлэх', 'Start shooting')),
      h('div', { class: 'teach', style: { marginTop: '12px' } }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(TG.pick(ARCH_FACTS))))), { cls: 'v-modal' });
  }
  function archeryGame() {
    const v = V(), arch = v.arch = v.arch || { best: 0, hits: 0, shots: 0, games: 0 };
    const DIST = [92, 118, 142], TOL = [13, 10, 8], X0 = 34, GROUND = 94, G = 120;
    const st = { round: 0, arrow: 0, hits: 0, phase: 'aim', angle: 0.3, power: 0.5, t0: performance.now(), wind: 0, shot: null, marks: [], cheer: 0, msg: '', over: false };
    const newWind = () => { const m = [6, 14, 24][st.round]; st.wind = Math.round((Math.random() * 2 - 1) * m); };
    newWind();
    const cv = h('canvas', { class: 'v-wr-canvas', width: 192, height: 108 }), cx = cv.getContext('2d');
    const info = h('div', { class: 'v-wr-score' }), msg = h('div', { class: 'v-wr-msg' });
    const btn = h('button', { class: 'btn primary big block' });
    const tail = h('div');
    const drawInfo = () => {
      rc(info, h('span', { class: 'me' }, `${L('Үе', 'Round')} ${st.round + 1}/3 · ${L('Сум', 'Arrow')} ${Math.min(st.arrow + 1, 4)}/4`), h('span', { class: 'them' }, `🎯 ${st.hits}  ·  ${L('Салхи', 'Wind')} ${st.wind === 0 ? '0' : (st.wind > 0 ? '→ ' : '← ') + Math.abs(st.wind)}`));
      btn.textContent = st.phase === 'aim' ? L('Өнцөг сонгох (Space)', 'Set angle (Space)') : st.phase === 'power' ? L('Харвах! (Space)', 'Shoot! (Space)') : L('…', '…');
      btn.disabled = !(st.phase === 'aim' || st.phase === 'power');
    };
    const body = h('div', { class: 'v-wrestle v-archery' }, h('div', { class: 'eyebrow' }, L('Сур харваа', 'Mongolian archery')), cv, info, msg, btn, tail);
    const angleOf = (q) => 0.12 + q * 0.75; // ≈ 7°–50°
    const look = { ...v.look, pet: null, ride: null };
    let raf = 0;
    const loop = (ts) => {
      const k = (ts - st.t0) / 1000;
      if (st.phase === 'aim') st.angle = (Math.sin(k * (1.3 + st.round * 0.25)) + 1) / 2;
      if (st.phase === 'power') st.power = (Math.sin(k * (1.8 + st.round * 0.35) - Math.PI / 2) + 1) / 2;
      if (st.phase === 'fly' && st.shot) {
        const s2 = st.shot, dt = 1 / 60;
        for (let i = 0; i < 2; i++) { s2.vx += st.wind * dt; s2.vy += G * dt; s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.trail.push([s2.x, s2.y]); }
        if (s2.y >= GROUND - 2 || s2.x > 200) land(s2);
      }
      // scene: sky, steppe, judges, the low wall of сур, the archer
      cx.imageSmoothingEnabled = false;
      cx.fillStyle = '#9fd8f7'; cx.fillRect(0, 0, 192, 60); cx.fillStyle = '#b9e3f8'; cx.fillRect(0, 40, 192, 20);
      cx.fillStyle = '#86b1cf'; for (let x = 0; x < 192; x++) { const top = Math.round(58 - 6 * Math.abs(Math.sin(x / 19))); cx.fillRect(x, top, 1, 62 - top); }
      cx.fillStyle = '#76b947'; cx.fillRect(0, 60, 192, 48); cx.fillStyle = '#d8ab6c'; cx.fillRect(X0 - 6, GROUND - 2, 192, 4);
      const TX = X0 + DIST[st.round], tol = TOL[st.round];
      cx.fillStyle = 'rgba(92,154,54,.55)'; cx.fillRect(TX - tol, GROUND - 2, tol * 2, 4);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { cx.fillStyle = '#2b1e2e'; cx.fillRect(TX - 9 + c * 3, GROUND - 6 - r * 3, 3, 3); cx.fillStyle = ['#e14b3d', '#ffffff', '#3f76db'][(c + r) % 3]; cx.fillRect(TX - 9 + c * 3, GROUND - 6 - r * 3, 2, 2); }
      const cheer = ts - st.cheer < 1400;
      [[TX + 18, '#2b5bd8'], [TX + 26, '#d8342b']].forEach(([jx, col]) => { cx.fillStyle = col; cx.fillRect(jx, GROUND - 10, 4, 6); cx.fillStyle = '#edbb93'; cx.fillRect(jx + 1, GROUND - 13, 2, 3); if (cheer) { cx.fillRect(jx - 1, GROUND - 14 - (Math.floor(ts / 150) % 2), 1, 4); cx.fillRect(jx + 4, GROUND - 14 - (Math.floor(ts / 150 + 1) % 2), 1, 4); } });
      if (cheer) { cx.font = '700 11px Rubik, sans-serif'; cx.textAlign = 'center'; cx.fillStyle = '#2b1e2e'; cx.fillText(L('Уухай!', 'Uukhai!'), TX + 24, GROUND - 22); cx.fillStyle = '#f7c646'; cx.fillText(L('Уухай!', 'Uukhai!'), TX + 23, GROUND - 23); }
      // wind flag
      cx.fillStyle = '#4a2a14'; cx.fillRect(96, 64, 1, 18); cx.fillStyle = '#e14b3d'; const wl = Math.round(st.wind / 3); for (let r = 0; r < 4; r++) cx.fillRect(st.wind >= 0 ? 97 : 96 + wl, 64 + r, Math.abs(wl) + 1 - (r % 2), 1);
      st.marks.forEach(([mx, hit]) => { cx.fillStyle = hit ? '#f7c646' : '#6b4220'; cx.fillRect(Math.round(mx), GROUND - 4, 1, 4); });
      const archer = PX.char(look, 2, 0); cx.drawImage(archer, X0 - 14, GROUND - 28);
      const ang = angleOf(st.phase === 'aim' ? st.angle : st.lockA != null ? st.lockA : st.angle), bx = X0, by = GROUND - 16;
      cx.strokeStyle = '#6b4220'; cx.lineWidth = 1; cx.beginPath(); cx.arc(bx - 2, by, 6, -ang - 1.2, -ang + 1.2); cx.stroke(); // bow
      if (st.phase === 'aim' || st.phase === 'power') { cx.strokeStyle = 'rgba(43,30,46,.6)'; cx.setLineDash([2, 2]); cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + Math.cos(ang) * 26, by - Math.sin(ang) * 26); cx.stroke(); cx.setLineDash([]); }
      if (st.phase === 'power') { cx.fillStyle = '#2b1e2e'; cx.fillRect(6, 30, 6, 52); cx.fillStyle = '#f7c646'; const ph = Math.round(st.power * 50); cx.fillRect(7, 81 - ph, 4, ph); }
      if (st.shot) { const s2 = st.shot, n2 = s2.trail.length; const [px, py] = s2.trail[n2 - 1] || [bx, by], [qx, qy] = s2.trail[Math.max(0, n2 - 4)] || [bx, by]; cx.strokeStyle = '#4a2a14'; cx.beginPath(); cx.moveTo(qx, qy); cx.lineTo(px, py); cx.stroke(); cx.fillStyle = '#e14b3d'; cx.fillRect(Math.round(qx), Math.round(qy), 1, 1); }
      raf = requestAnimationFrame(loop);
    };
    function press() {
      if (st.over) return;
      if (st.phase === 'aim') { st.lockA = st.angle; st.phase = 'power'; st.t0 = performance.now(); msg.textContent = L('Одоо хүчээ сонго!', 'Now choose your power!'); }
      else if (st.phase === 'power') {
        const a2 = angleOf(st.lockA), v0 = 70 + st.power * 115;
        st.shot = { x: X0, y: GROUND - 16, vx: Math.cos(a2) * v0, vy: -Math.sin(a2) * v0, trail: [] }; st.phase = 'fly'; TG.sfx.whoosh && TG.sfx.whoosh(); arch.shots++;
      }
      drawInfo();
    }
    function land(s2) {
      st.phase = 'wait';
      const TX = X0 + DIST[st.round], tol = TOL[st.round], off = s2.x - TX, hit = Math.abs(off) <= tol;
      st.marks.push([Math.min(190, s2.x), hit]);
      if (hit) { st.hits++; arch.hits++; st.cheer = performance.now(); TG.sfx.win(); quest('archery'); msg.textContent = L('Оносон! Уухай! 🎯', 'Hit! Uukhai! 🎯'); }
      else { TG.sfx.bad(); msg.textContent = off < 0 ? L('Дутлаа. Өнцөг эсвэл хүчээ нэмээрэй.', 'Short. Add more angle or power.') : L('Хэтэрлээ. Хүчээ бага зэрэг сулруулаарай.', 'Too far. Use a little less power.'); if (Math.abs(st.wind) > 8) msg.textContent += ' ' + L('Салхийг тооцоорой!', 'Mind the wind!'); }
      setTimeout(() => {
        st.shot = null; st.arrow++;
        if (st.arrow >= 4) { st.arrow = 0; st.round++; st.marks = []; if (st.round >= 3) return finish(); newWind(); msg.textContent = L(`${st.round + 1}-р үе: бай холдож, салхи хүчтэй боллоо!`, `Round ${st.round + 1}: the target is further and the wind stronger!`); }
        st.phase = 'aim'; st.lockA = null; st.t0 = performance.now(); drawInfo();
      }, 1200);
    }
    function finish() {
      st.over = true; st.phase = 'done'; drawInfo();
      arch.games++; const newBest = st.hits > arch.best; if (newBest) arch.best = st.hits;
      const tNow = ARCH_TITLES.find((x) => st.hits >= x.need);
      const r = reward(st.hits * 4, st.hits * 6); S.save(); checkAch();
      if (st.hits >= 6) { TG.confetti(70); TG.sfx.win(); }
      rc(tail, h('div', { class: 'v-zasuul' }, h('b', null, `🎯 ${st.hits}/12`), tNow ? [' · ', L(`«${tx(tNow.t)}» цол хүртлээ!`, `You earned the “${tx(tNow.t)}” title!`)] : '', newBest ? h('p', null, L('Шинэ дээд амжилт!', 'New best score!')) : null, r ? h('p', null, `🪙 +${r.coins} · ⭐ +${r.xp} XP`) : null),
        h('div', { class: 'teach' }, h('p', null, tx(TG.pick(ARCH_FACTS)))),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')), h('button', { class: 'btn primary', onclick: () => { close(); setTimeout(archeryGame, 200); } }, L('Дахин харвах', 'Shoot again'))));
    }
    btn.addEventListener('click', press);
    const key = (e) => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (e.type === 'keydown' && !e.repeat) press(); } };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
    msg.textContent = L('Зүү хамгийн зөв өнцөгт ирэхэд дар!', 'Press when the line is at a good angle!');
    drawInfo();
    const close = TG.modal(body, { cls: 'v-modal', onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); } });
    raf = requestAnimationFrame(loop);
  }

  // ================================================================ Эмээгийн гэр: etiquette with Grandma (gentle, never punishing)
  const EMEE = { deel: 'purple', skin: '#EDBB93', hat: 'mongol', face: 'glasses', neck: 'khadag', pet: null };
  const O2 = (mn, en, ok, wmn, wen) => ({ t: Tx(mn, en), ok: !!ok, why: wmn ? Tx(wmn, wen) : null });
  const EMEE_STEPS = [
    { say: Tx('Миний хүү/охин ирлээ! Эмээгийн гэрт тавтай морил. Хаалгаар яаж орох вэ?', 'My dear child, welcome to Grandma’s ger! How do you come in through the door?'), hl: 'door',
      opts: [O2('Босгыг алхаж давна', 'Step over the threshold', 1), O2('Босгон дээр гишгэнэ', 'Step on the threshold', 0, 'Хүүхэд минь, босго бол гэрийн хүндэт хил. Түүн дээр гишгэдэггүй, харин алхаж давдаг юм. Дахиад оролдоод үз дээ.', 'Dear, the threshold is the honoured border of the home. We never step on it; we step over it. Try again.'), O2('Гүйж орно', 'Run in', 0, 'Гэрт тайван, аажуухан ордог юм. Гэрийн эзэнд хүндэтгэл үзүүлж байгаа хэрэг шүү.', 'We come into a ger calmly and slowly. It shows respect to the family.')] },
    { say: Tx('Сайн байна уу гэж мэндлэх үү? Эмээ чинь сонсож байна.', 'Will you greet me? Grandma is listening.'),
      opts: [O2('“Сайн байна уу, эмээ!”', '“Sain baina uu, Grandma!”', 1), O2('Юу ч хэлэхгүй', 'Say nothing', 0, 'Гэрт ормогц эхлээд ахмадтайгаа мэндэлдэг. “Сайн байна уу” гэвэл эмээ чинь их баярлана.', 'When we enter, we first greet the elders. A “sain baina uu” makes Grandma very happy.')] },
    { say: Tx('Одоо гэр дотор аль чигээр явах вэ?', 'Which way do you walk inside the ger?'), hl: 'west',
      opts: [O2('Нар зөв: орохдоо зүүн гар тал руугаа', 'Sunwise: towards your left as you enter', 1), O2('Нар буруу: баруун гар тал руугаа', 'Against the sun: towards your right', 0, 'Гэрт нарны явахтай адил нар зөв эргэдэг юм. Орж ирээд зүүн гар тал руугаа явбал зөв шүү.', 'Inside a ger we move the way the sun travels. Going to your left as you enter is right.'), O2('Голоор нь шууд гатална', 'Cut straight across the middle', 0, 'Гал голомт, хоёр баганын дундуур гаталдаггүй юм. Тойруулж нар зөв яваарай.', 'We never cut between the hearth and the two posts. Walk around, sunwise.')] },
    { say: Tx('Эмээ чамд халуун цай аягаллаа. Яаж авах вэ?', 'Grandma pours you hot milk tea. How do you take it?'),
      opts: [O2('Баруун гараараа авч, зүүн гараараа тохойгоо түшинэ', 'Take it with your right hand, left hand under your right elbow', 1), O2('Зүүн гараараа авна', 'Take it with your left hand', 0, 'Ахмадаас юм авахдаа баруун гар эсвэл хоёр гараараа авдаг юм. Зүүн гараараа тохойгоо түшвэл бүр ёсорхуу.', 'We take things from elders with the right hand or both hands. Supporting the elbow with your left hand is even more polite.'), O2('“Ширээн дээр тавь” гэнэ', 'Say “put it on the table”', 0, 'Эмээгийн өгсөн цайг гараараа хүндэтгэлтэй авбал эмээ чинь баярлана.', 'Taking Grandma’s tea from her hands, respectfully, makes her happy.')] },
    { say: Tx('Зочин хүү/охин минь хаана суух вэ? Зураг дээр дараарай.', 'And where does a guest sit? Tap the picture.'), zone: 'west',
      zones: { khoimor: Tx('Хоймор бол ахмад, хүндтэй зочны суудал. Эмээ урих хүртэл хүлээнэ дээ.', 'The khoimor is for elders and honoured guests. Wait until Grandma invites you.'), east: Tx('Энэ бол гэрийн эзэгтэйн тал, гал тогоо байдаг. Зочин баруун талд суудаг юм.', 'That is the hostess’s side with the kitchen. Guests sit on the west side.'), hearth: Tx('Гал голомт бол гэрийн зүрх. Түүний дэргэд сууж болохгүй шүү.', 'The hearth is the heart of the home. We don’t sit right by it.'), door: Tx('Хаалганы дэргэд сууж болох ч дотогшоо ороод баруун талд суувал илүү ёстой.', 'You could sit by the door, but come in and sit on the west side; that is proper.') } },
    { say: Tx('Сайхан зочиллоо! Гарахдаа яах вэ?', 'What a lovely visit! How do you leave?'),
      opts: [O2('“Баярлалаа, эмээ!” гээд босго алхаж гарна', 'Say “Thank you, Grandma!” and step over the threshold', 1), O2('Юу ч хэлэлгүй гүйгээд гарна', 'Run out without a word', 0, 'Гарахдаа гэрийн эзэндээ баярлалаа, баяртай гэж хэлдэг юм. Босгоо ч бас алхаж давна шүү.', 'When leaving, we thank the family and say goodbye, and step over the threshold again.')] },
  ];
  function emeePic(size = 64) { const c = h('canvas', { class: 'px-icon', width: 16, height: 28, style: { width: size + 'px', height: Math.round(size * 28 / 16) + 'px' } }); c.getContext('2d').drawImage(PX.char(EMEE, 0, 0), 0, 0); return c; }
  function emeeVisit() {
    const v = V(), em = v.emee = v.emee || { visits: 0, perfect: 0 };
    let i = 0, slips = 0;
    const st = { hl: null };
    const cv = h('canvas', { class: 'l-scene', width: TG.scenes.W, height: TG.scenes.H }), cx2 = cv.getContext('2d');
    let raf = 0; const t0 = performance.now();
    const loop = () => { if (!cv.isConnected) return; TG.scenes.inside(cx2, st, (performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    const bubble = h('div', { class: 'emee-say' }), opts = h('div', { class: 'l-opts' }), note = h('div');
    const sayEmee = (txt, kind) => { const p = h('p', { class: kind || '' }); rc(bubble, emeePic(40), p); TG.voice ? TG.voice.type(p, txt, 'emee') : (p.textContent = txt); };
    function show() {
      const s = EMEE_STEPS[i]; st.hl = s.hl || null; st.hlBad = false; rc(note);
      sayEmee(tx(s.say));
      if (s.zones) { rc(opts, h('p', { class: 'l-hint' }, '👆 ', L('Зураг дээр дар', 'Tap the picture'))); return; }
      rc(opts, ...[...s.opts].sort(() => Math.random() - 0.5).map((o) => h('button', { class: 'l-opt', onclick: (e) => {
        if (o.ok) { TG.sfx.good(); e.currentTarget.classList.add('right'); next(); }
        else { slips++; TG.sfx.tap(); e.currentTarget.disabled = true; sayEmee('💛 ' + tx(o.why), 'gentle'); }
      } }, tx(o.t))));
    }
    cv.addEventListener('pointerdown', (e) => {
      const s = EMEE_STEPS[i]; if (!s || !s.zones) return;
      const r = cv.getBoundingClientRect(), z = TG.scenes.zoneAt((e.clientX - r.left) / r.width * TG.scenes.W, (e.clientY - r.top) / r.height * TG.scenes.H);
      if (!z) return; st.hl = z;
      if (z === s.zone) { st.hlBad = false; TG.sfx.good(); next(); }
      else { slips++; st.hlBad = true; sayEmee('💛 ' + tx(s.zones[z] || s.say), 'gentle'); }
    });
    function next() {
      i++;
      if (i < EMEE_STEPS.length) return setTimeout(show, 450);
      em.visits++; const perfect = slips === 0; if (perfect) em.perfect++;
      const r = reward(perfect ? 30 : 20, perfect ? 40 : 30); quest('etiquette'); S.save(); checkAch();
      TG.sfx.win(); TG.confetti(50);
      sayEmee(perfect ? L('Ёстой ёсорхог хүүхэд вэ! Энэ ааруулаас ав, миний хүү/охин. 🧀', 'Such a well-mannered child! Have some aaruul, dear. 🧀') : L('Сайн байна! Алдах нь сурах л гэсэн үг. Энэ ааруулаас ав. 🧀', 'Well done! Making mistakes is how we learn. Have some aaruul. 🧀'));
      rc(opts, h('div', { class: 'l-reward' }, r ? `🪙 +${r.coins} · ⭐ +${r.xp} XP` : ''), h('p', { class: 'muted' }, perfect ? L('Нэг ч алдаагүй! 🏅', 'Not a single slip! 🏅') : L(`Эмээ ${slips} удаа зөөлөн зааж өглөө.`, `Grandma gently helped you ${slips} time(s).`)),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Баяртай, эмээ!', 'Bye, Grandma!')), h('button', { class: 'btn primary', onclick: () => { close(); TG.go('lesson', { id: 'customs' }); } }, L('Ёс заншлын хичээл', 'Manners lesson'))));
    }
    show();
    const close = TG.modal(h('div', { class: 'emee-visit' }, h('div', { class: 'eyebrow' }, L('Эмээгийн гэр · Ёс заншил', 'Grandma’s ger · Manners')), h('h2', null, L('Эмээдээ зочлох', 'Visiting Grandma')), cv, bubble, opts, note), { cls: 'v-modal', onClose: () => cancelAnimationFrame(raf) });
    raf = requestAnimationFrame(loop);
  }

  // ================================================================ townspeople with quest chains
  const NQ = (k, n, mn, en, c, x) => ({ k, n, t: Tx(mn, en), c, x });
  const NPCS = {
    herder: { name: Tx('Малчин Батбаяр', 'Herder Batbayar'), look: { deel: 'brown', skin: '#D9A06E', hat: 'mongol', neck: null, face: null, pet: null },
      hello: Tx('Сайн уу, хүү/охин минь! Мал маллах амаргүй ч сайхан ажил шүү.', 'Hello, child! Herding is hard work, but wonderful.'),
      chain: [NQ('pet', 3, 'Хониддоо дасгая: тэднийг 3 удаа илбээрэй.', 'Help the sheep get to know you: pet them 3 times.', 20, 25), NQ('milk', 2, 'Хот айлд 2 удаа мал саагаад ирээрэй.', 'Milk the animals in the dairy yard twice.', 25, 30), NQ('etiquette', 1, 'Эмээгийн гэрт ёсоор зочлоод ир. Малчин хүн ёсоо мэддэг байх ёстой!', 'Visit Grandma’s ger with good manners. A herder knows the customs!', 35, 40)],
      done: Tx('Чи жинхэнэ малчин болох нь! Малчид хонь бүрээ таньдаг, гэр бүл шиг хайрладаг.', 'You’ll make a real herder! Herders know every sheep and love them like family.'),
      tic: Tx('Аа, ', 'Ah, '), bio: Tx('Аа, би 300 хоньтой. Өглөө бүр нараас өмнө босож малаа бэлчээрт гаргадаг. Хонь бүрийг нэрээр нь мэднэ шүү!', 'Ah, I have 300 sheep. Every morning I’m up before the sun to take them to pasture. I know each one by name!') },
    fisher: { name: Tx('Загасчин Дорж өвөө', 'Grandpa Dorj the fisher'), look: { deel: 'teal', skin: '#B97A4A', hat: 'cap', neck: null, face: null, pet: null },
      hello: Tx('Нуур тайван байна. Загасчлахад тэвчээр хэрэгтэй.', 'The lake is calm today. Fishing takes patience.'),
      chain: [NQ('fish', 1, 'Нэг загас барьж үзээрэй. Гүүрэн дээрээс загасчилна.', 'Catch your first fish from the dock.', 15, 20), NQ('fish', 3, 'Одоо 3 загас бариарай. Хадран барьвал буцааж тавиарай!', 'Now catch 3 fish. If you catch a taimen, let it go!', 30, 35), NQ('basar', 2, 'Басараас Монголын гол мөрөн, нууруудын тухай 2 асуулт асуу.', 'Ask Basar 2 questions about Mongolia’s rivers and lakes.', 25, 30)],
      done: Tx('Сайн загасчин байгалиа хайрладаг. Хөвсгөл нуур бол Монголын хамгийн гүн нуур шүү!', 'A good fisher loves nature. Lake Khövsgöl is Mongolia’s deepest lake!'),
      tic: Tx('Хм… ', 'Hmm… '), bio: Tx('Хм… Би энэ нуурын эрэг дээр жаран жил загасчилсан… Хадраныг үргэлж буцааж тавьдаг. Байгаль бидэнд зээлээр л өгдөг юм.', 'Hmm… I’ve fished this shore for sixty years… I always let the taimen go. Nature only lends to us.') },
    farmer: { name: Tx('Саальчин Сарнай эгч', 'Sarnai the milkmaid'), look: { deel: 'green', skin: '#EDBB93', hat: 'flower', neck: null, face: null, pet: null },
      hello: Tx('Хот айлд ажил их байна! Мал саахад туслах уу?', 'There’s lots to do in the dairy yard! Will you help me milk?'),
      chain: [NQ('milk', 3, 'Үнээ, ямаа, гүүгээ 3 удаа саагаарай.', 'Milk the cows, goats and mares 3 times.', 20, 25), NQ('dairy', 2, 'Ааруул, өрөм, тараг эсвэл айраг 2 удаа хийгээрэй.', 'Make aaruul, öröm, tarag or airag twice.', 25, 30), NQ('sell', 3, 'Цагаан идээгээ дэлгүүрт 3 удаа зараарай.', 'Sell your dairy foods at the shop 3 times.', 30, 35)],
      done: Tx('Баярлалаа! Монголчууд зун цагаан идээ, өвөл улаан идээ (мах) голлон иддэг.', 'Thank you! Mongolians eat mostly white foods (dairy) in summer and red foods (meat) in winter.'),
      tic: Tx('Ой! ', 'Oh! '), bio: Tx('Ой, би өдөрт хоёр удаа саадаг! Ааруулаа наранд хатаахад шувууд хулгайлах гээд байдаг юм, хи-хи!', 'Oh, I milk twice a day! When I dry aaruul in the sun the birds keep trying to steal it, hee-hee!') },
    teacher: { name: Tx('Багш Оюун', 'Teacher Oyun'), look: { deel: 'blue', skin: '#F6D3B3', hat: null, neck: 'scarf', face: 'glasses', pet: null },
      hello: Tx('Сурах бичиг уншихаас гадна тоглож сурах нь бас гоё!', 'Besides books, learning by playing is great fun!'),
      chain: [NQ('lesson', 1, 'Сургуулийн гэрт нэг хичээл дуусгаарай.', 'Finish one lesson in the school ger.', 30, 40), NQ('quiz', 3, 'Басарын 3 асуултад зөв хариулаарай.', 'Answer 3 of Basar’s questions correctly.', 25, 35), NQ('stamp', 1, 'Аймгийн паспортоороо нэг аймагт аялж тамга аваарай.', 'Travel to a province with your passport and earn a stamp.', 35, 45)],
      done: Tx('Гайхалтай сурагч! “Эрдэм ухаан, эрдэнийн сан” гэдэг шүү.', 'An amazing student! As we say, “knowledge is a treasure”.'),
      tic: Tx('За, ', 'Now then, '), bio: Tx('За, би хөдөөний сургуульд хорин жил багшилсан. Хамгийн дуртай хичээл маань Монгол бичиг. Дээрээс доош бичдэг нь ямар гоё вэ!', 'Now then, I taught at a countryside school for twenty years. My favourite subject is the Mongol script. Writing from top to bottom is so lovely!') },
    trainer: { name: Tx('Уяач Ганбаатар', 'Horse trainer Ganbaatar'), look: { deel: 'gold', skin: '#D9A06E', hat: 'loovuuz', neck: null, face: null, pet: null },
      hello: Tx('Сайн уяач морио хайрлаж, сайн мэддэг. Хурдан морь уяачаас эхэлдэг.', 'A good trainer loves and knows their horse. Every fast horse starts with its trainer.'),
      chain: [NQ('race', 1, 'Морин уралдаанд нэг удаа оролцоорой.', 'Ride in one horse race.', 25, 30), NQ('race', 2, 'Дахиад 2 уралдаанд уралдаж мориндоо дасгал хийлгээрэй.', 'Ride 2 more races to train your horse.', 35, 40), NQ('wrestle', 1, 'Наадмын талбайд нэг даваа давж үзээрэй.', 'Win one round at the wrestling arena.', 30, 35)],
      done: Tx('Чи морио сайн мэдэх болжээ! Уяачид морио уралдааны өмнө “сойдог”, өөрөөр хэлбэл тусгайлан бэлтгэдэг.', 'You know your horse well now! Before a race, trainers “soi” their horses: they prepare them in a special way.'),
      tic: Tx('Чү! ', 'Chü! '), bio: Tx('Чү! Миний хээр морь Наадамд гурван удаа түрүүлсэн! Уяач хүн морио хайрлаж, сайн арчлах ёстой.', 'Chü! My bay horse has won the Naadam three times! A trainer must love their horse and care for it well.') },
    archer: { name: Tx('Мэргэн Тулга ах', 'Tulga the archer'), look: { deel: 'red', skin: '#B97A4A', hat: 'mongol', neck: 'medal', face: null, pet: null },
      hello: Tx('Сайн харваач амьсгалаа тайвшруулж, салхиа ажигладаг.', 'A good archer breathes calmly and watches the wind.'),
      chain: [NQ('archery', 3, 'Сурын талбайд 3 бай онооорой.', 'Hit 3 targets at the archery range.', 25, 30), NQ('archery', 6, 'Одоо 6 бай онооорой. Салхийг тооцоорой!', 'Now hit 6 targets. Mind the wind!', 35, 40), NQ('together', 1, 'Гэр бүлтэйгээ нэг бодит ажил хамт хийгээрэй.', 'Do one real-life activity with your family.', 40, 45)],
      done: Tx('Чи мэргэн болж байна! Сайн харваачийг монголчууд “мэргэн” гэж цоллодог.', 'You’re becoming a mergen! That is what Mongols call a great archer.'),
      tic: Tx('Ш-ш… ', 'Shh… '), bio: Tx('Ш-ш… Тайван. Сур харваа бол тэвчээрийн спорт. Аав маань надад гурван настайгаас нум заасан.', 'Shh… calm. Archery is a sport of patience. My father taught me the bow when I was three.') },
    craftsman: { name: Tx('Мужаан өвөө Тулга', 'Grandpa Craftsman Tulga'), look: { deel: 'brown', skin: '#C98E5E', hat: 'mongol', neck: null, face: null, pet: null },
      hello: Tx('Сайн уу! Би гэрийн мод хийдэг мужаан. Хана, хаалга, тооно, униа бүгдийг гараараа хийнэ.', 'Hello! I am a craftsman: I make every wooden part of a ger by hand, walls, door, toono and poles.'),
      chain: [NQ('shear', 1, 'Эсгий хийхэд ноос хэрэгтэй. Нэг хонь хяргаад ир.', 'Felt needs wool. Go and shear a sheep.', 15, 20), NQ('felt', 1, 'Хонины хашааны хажууд эсгий хийх газар бий. Нэг эсгий өнхрүүлээд ир.', 'There is a felt spot by the sheep pasture. Roll one felt.', 25, 30), NQ('ger', 1, 'Одоо гэрээ өөрийн гараар бариад үзүүлээрэй!', 'Now build your own ger with your own hands and show me!', 40, 50)],
      done: Tx('Гайхалтай! Гэрээ өөрөө барьсан хүүхэд гэрийнхээ хэсэг бүрийг мэддэг болно.', 'Wonderful! A child who builds their own ger knows every part of it.'),
      tic: Tx('Хм, ', 'Hmm, '), bio: Tx('Хм, би 50 жил гэрийн мод хийлээ. Хана бүрийг бургасаар, униаг шинэс модоор хийдэг. Хэзээ ч хадаас хэрэглэдэггүй, бүгдийг арьсан оосроор уяна!', 'Hmm, I have made ger frames for 50 years. Walls from willow, poles from larch. Never a nail: everything is tied with leather straps!') },
  };
  const npcState = (id) => { const v = V(); v.npc = v.npc || {}; return (v.npc[id] = v.npc[id] || { step: 0, p: 0, on: false }); };
  /** Progress the townspeople's tasks (called with every daily-quest event). */
  function npcProgress(k, n = 1) {
    if (!V()) return;
    for (const [id, d] of Object.entries(NPCS)) {
      const st = npcState(id), q = d.chain[st.step];
      if (!st.on || !q || q.k !== k || st.p >= q.n) continue;
      st.p = Math.min(q.n, st.p + n);
      if (st.p >= q.n) TG.toast(`❓ ${tx(d.name)}: ${L('даалгавар биеллээ! Очиж шагналаа аваарай.', 'task done! Go and collect your reward.')}`);
    }
  }
  const npcMark = (id) => { const st = npcState(id), q = NPCS[id].chain[st.step]; if (!q) return ''; if (!st.on) return '!'; return st.p >= q.n ? '?' : ''; };
  function npcPic(look, size = 56) { const c = h('canvas', { class: 'px-icon', width: 16, height: 28, style: { width: size + 'px', height: Math.round(size * 28 / 16) + 'px' } }); c.getContext('2d').drawImage(PX.char(look, 0, 0), 0, 0); return c; }
  function npcTalk(id) {
    const d = NPCS[id]; if (!d) return;
    const st = npcState(id), body = h('div', { class: 'npc-talk' });
    const speak = (text) => { const p = h('p'); TG.voice ? TG.voice.type(p, text, id) : (p.textContent = text); return p; };
    // you can ask each person about themselves (their own story, in their own way of talking)
    const asks = () => h('div', { class: 'b-chips npc-asks' }, h('button', { class: 'chip', onclick: () => { const b = body.querySelector('.emee-say'); if (b) rc(b, speak(tx(d.bio))); } }, '💬 ', L('Таны тухай?', 'About you?')));
    const draw = () => {
      const q = d.chain[st.step];
      const steps = h('div', { class: 'npc-steps' }, d.chain.map((_, i) => h('i', { class: i < st.step ? 'on' : i === st.step ? 'cur' : '' })));
      if (!q) { rc(body, h('div', { class: 'npc-head' }, npcPic(d.look), h('div', null, h('h2', null, tx(d.name)), steps)), h('div', { class: 'emee-say' }, speak(tx(d.tic) + tx(d.done))), asks(), id === 'craftsman' ? TG.gerwork.tradeList(draw) : null, h('p', { class: 'muted' }, '✓ ', L('Бүх даалгаврыг биелүүлсэн. Баярлалаа!', 'All tasks complete. Thank you!'))); return; }
      const ready = st.on && st.p >= q.n;
      rc(body, h('div', { class: 'npc-head' }, npcPic(d.look), h('div', null, h('h2', null, tx(d.name)), steps)),
        h('div', { class: 'emee-say' }, speak(st.on ? tx(d.tic) + (ready ? L('Чи хийчихжээ! Баярлалаа! 🎉', 'You did it! Thank you! 🎉') : tx(q.t)) : `${tx(d.hello)} ${tx(q.t)}`)), asks(), id === 'craftsman' ? TG.gerwork.tradeList(draw) : null,
        st.on ? h('div', null, h('div', { class: 'meter' }, h('span', { style: { width: (st.p / q.n) * 100 + '%' } })), h('small', { class: 'muted' }, `${st.p}/${q.n} · 🪙 +${q.c} · ⭐ +${q.x} XP`)) : null,
        h('div', { class: 'row-btns' },
          !st.on ? h('button', { class: 'btn primary', onclick: () => { st.on = true; st.p = 0; S.save(); TG.sfx.chime && TG.sfx.chime(); draw(); } }, L('Тэгье, хийе!', 'Okay, I’ll do it!'))
            : ready ? h('button', { class: 'btn primary', onclick: () => {
              const r = reward(q.c, q.x); st.step++; st.p = 0; st.on = st.step < d.chain.length; S.save(); TG.confetti(40);
              TG.toast(`🎁 ${tx(d.name)}: 🪙 +${r ? r.coins : q.c}`); checkAch(); draw();
            } }, '🎁 ', L('Шагнал авах', 'Collect reward')) : h('button', { class: 'btn', onclick: () => close() }, L('Одоо хийнэ!', 'I’m on it!'))));
    };
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  TG.villageNpcs = { NPCS, state: npcState };
  if (TG.dialog) {
    const still = (look) => () => PX.char(look, 0, 0);
    TG.dialog.register('basar', { name: Tx('Басар', 'Basar'), voice: 'basar', art: [24, 22], portrait: (e, open, blink) => PX.bankharFace(blink ? 2 : open ? 1 : 0) });
    for (const [id, d] of Object.entries(NPCS)) TG.dialog.register(id, { name: d.name, voice: id, portrait: still(d.look) });
    TG.dialog.register('emee', { name: Tx('Эмээ', 'Grandma'), voice: 'emee', portrait: still(EMEE) });
    TG.dialog.register('general', { name: Tx('Жанжин Батмөнх', 'General Batmönkh'), voice: 'general', portrait: still(GENERAL) });
    TG.dialog.register('historian', { name: Tx('Түүхч Нарангэрэл', 'Narangerel the historian'), voice: 'historian', portrait: still(HISTORIAN) });
    TG.dialog.register('zasuul', { name: Tx('Засуул', 'Herald'), voice: 'zasuul', portrait: still(ZASUUL) });
  }

  // ================================================================ inside your own ger: walk around and use the furniture
  const GER_TEA = [Tx('Сүүтэй цайг сүү, ус, давс, цайгаар чанадаг. Зочинд хамгийн түрүүнд цай өргөдөг.', 'Milk tea is made with milk, water, salt and tea leaves. Guests are always offered tea first.'), Tx('Цайгаа шанагаар өндрөөс самарвал илүү амттай болдог гэдэг.', 'Ladling the tea from high up is said to make it tastier.')];
  const SNACKS = [Tx('Ааруул шүдийг бэхжүүлдэг гэж ярьдаг. Ням!', 'People say aaruul makes teeth strong. Crunch!'), Tx('Борцог бол гурилаар хийсэн шарсан боов.', 'Boortsog are fried dough pastries.'), Tx('Өрөмтэй боорцог бол зочны дуртай амттан.', 'Boortsog with öröm cream is a guest’s favourite treat.')];
  function playMelody() {
    if (S.state.settings.sound === false) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), notes = [392, 440, 523, 587, 523, 440, 392, 330, 392];
      notes.forEach((f, i) => { // a slow pentatonic tune with a soft, bowed sound
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * 0.38;
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(f * 1.01, t0 + 0.3);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.08); g.gain.linearRampToValueAtTime(0, t0 + 0.42);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        o.connect(lp); lp.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.45);
      });
      setTimeout(() => ac.close(), 4200);
    } catch (e) { /* no audio */ }
  }
  function enterGer(i, visitor) {
    const l = lotsArr()[i]; if (!l) return;
    const v = V(), own = !visitor && l.by === v.id, furn = l.furn || [], has = (id) => furn.includes(id), today = S.dkey();
    v.homeDay = v.homeDay || {};
    const room = PX.gerRoom(R.ROOF[l.roof] || R.ROOF.blue, R.DOOR[l.door] || R.DOOR.red, furn), cx = PX.ROOM.cx;
    const fx = { steam: -1e9, zzz: -1e9, notes: -1e9, churn: -1e9 };
    const dayOnce = (k) => { if (!own || v.homeDay[k] === today) return false; v.homeDay[k] = today; S.save(); return true; };
    const sayIt = (txt) => sc.say(h('p', null, txt));
    const spot = (id, x, y, mn, en, run) => ({ id, x, y, label: () => L(mn, en), run });
    const things = [
      spot('door', cx, 192, 'Гарах', 'Go outside', () => sc.close()),
      spot('khoimor', cx, 105, 'Хойморт суух', 'Sit in the khoimor', () => sayIt(L('Хоймор бол гэрийн хамгийн хүндэт газар. Гэр бүлийн шүтээн, зураг энд байдаг. Ахмад хүн, хүндтэй зочныг хойморт урьдаг.', 'The khoimor, opposite the door, is the place of honour. The family shrine and photos are kept here, and elders and honoured guests are invited to sit here.'))),
      spot('table', 138, 118, 'Хоол идэх', 'Eat a meal', () => { sayIt('🍽️ ' + tx(TG.pick(SNACKS))); if (dayOnce('snack')) reward(0, 5); eatModal({ home: own }); }),
      spot('bagana', 184, 132, 'Баганыг харах', 'Look at the posts', () => sayIt(L('Хоёр багана тоноо даадаг. Хоёр баганын дундуур гарч болохгүй, баганыг түшиж болохгүй гэдэг ёс бий.', 'The two bagana posts hold up the toono. By custom you never walk between the two posts and never lean on them.'))),
      spot('toono', 132, 168, 'Тооно руу харах', 'Look up at the toono', () => sayIt(L('Тооноор тусах нарны гэрэл униар гулсаж явдгаар малчид цагийг мэддэг байжээ. Тооно бол гэрийн нар цаг!', 'Herders told the time by the patch of sunlight from the toono creeping across the roof poles. The toono is the ger’s sun clock!'))),
      spot('saddle', 90, 176, 'Эмээл үзэх', 'Look at the saddle', () => sayIt(L('Баруун тал бол эрэгтэй хүний тал: эмээл, хазаар, уурга энд байна. Монгол эмээл өндөр бүүрэгтэй, мөнгөн товруудтай.', 'The west side is the men’s side: the saddle, bridle and lasso pole live here. A Mongol saddle has a high front and back and silver studs.'))),
      spot('khukhuur', 60, 158, 'Айраг бүлж уух', 'Churn and drink airag', () => { fx.churn = performance.now(); TG.sfx.scrub && TG.sfx.scrub(); setTimeout(() => eat('airag', { free: true }), 700); sayIt(L('🥛 Хөхүүрт гүүний сүүг мянга гаруй удаа бүлж айраг исгэдэг. Гэрт орж ирсэн хүн бүр бүлүүрээр хэдэн удаа бүлээд өгдөг заншилтай!', '🥛 Mare’s milk is churned more than a thousand times in the khukhuur to make airag. Everyone who comes in gives it a few stirs!')); if (dayOnce('churn')) reward(0, 5); }),
      spot('cupboard', 244, 178, 'Цай уух', 'Have some milk tea', () => { sayIt(L('Зүүн тал бол эмэгтэй хүний тал: аяга таваг, тогоо шанага, хоол хүнс энд байдаг. Зочинд цайг баруун гараараа өргөдөг.', 'The east side is the women’s side: bowls, pots, ladles and food are kept here. Tea is offered with the right hand.')); eat('tsai', { free: true }); }),
      spot('water', 210, 190, 'Ус уух', 'Drink some water', () => { eat('us', { free: true }); sayIt(L('💧 Усыг худаг, булгаас зөөж авчирдаг. Усыг хэзээ ч бохирдуулдаггүй, хайрлан гамнадаг.', '💧 Water is carried in from the well or spring. It is never wasted or made dirty.')); }),
    ];
    if (has('tulga')) things.push(spot('tulga', cx, 158, 'Цай чанах', 'Make milk tea', () => { fx.steam = performance.now(); TG.sfx.pour ? TG.sfx.pour(0.6) : TG.sfx.tap(); sayIt('🍵 ' + tx(TG.pick(GER_TEA))); if (dayOnce('tea')) reward(5, 10); }));
    else things.push(spot('tulga', cx, 158, 'Голомт', 'The hearth', () => sayIt(L('Гал голомт бол гэрийн зүрх. Тулга авбал энд цай чанаж болно.', 'The hearth is the heart of the ger. Get a stove and you can make tea here.'))));
    if (has('or')) for (const [bx, side] of [[48, 'w'], [272, 'e']]) things.push(spot('or' + side, bx, 140, 'Унтаж амрах', 'Sleep and rest', () => {
      fx.zzz = performance.now(); fx.zx = bx; TG.sfx.chime && TG.sfx.chime();
      if (own && v.rest !== today) { v.rest = today; v.energy = 100; S.save(); reward(5, 10); sayIt(L('😴 Сайхан амарлаа! Хүч бүрэн дүүрч, +10 XP.', '😴 A good rest! Energy full again, +10 XP.')); hud(); }
      else sayIt(L('😴 Өнөөдөр аль хэдийн амарсан. Маргааш дахин унтаарай.', '😴 You already rested today. Sleep again tomorrow.'));
    }));
    if (has('avdar')) things.push(spot('avdar', 206, 106, 'Авдраа нээх', 'Open the chest', () => chestModal()));
    if (has('morinkhuur')) things.push(spot('morinkhuur', 104, 110, 'Морин хуур тоглох', 'Play the morin khuur', () => { fx.notes = performance.now(); playMelody(); sayIt(L('🎻 Морин хуурын аялгуу гэрийг дүүргэлээ. Морин хуурыг хойморын баруун талд хүндэтгэн байрлуулдаг.', '🎻 The fiddle’s tune fills the ger. The morin khuur is honoured with a place on the west of the khoimor.')); if (dayOnce('music')) reward(0, 8); }));
    if (has('shirdeg')) things.push(spot('shirdeg', 96, 150, 'Басартай суух', 'Sit with Basar', () => sayIt('🐕 ' + tx(TG.pick(TG.BASAR.FACTS)))));
    if (has('shagai')) things.push(spot('shagai', 214, 170, 'Шагай хаях', 'Throw shagai', () => {
      const S4 = ['🐎', '🐫', '🐑', '🐐'], roll = [0, 1, 2, 3].map(() => Math.floor(Math.random() * 4)), horses = roll.filter((r) => r === 0).length;
      TG.sfx.roll ? TG.sfx.roll() : TG.sfx.tap();
      sayIt(`🦴 ${roll.map((r) => S4[r]).join(' ')}  ·  ${horses === 4 ? L('Дөрвөн морь! Маш ховор!', 'Four horses! Very rare!') : L(`${horses} морь буулаа.`, `${horses} horse side(s).`)}`);
      if (horses === 4 && dayOnce('shagai4')) reward(20, 20);
    }));
    const missing = R.FURNITURE.filter((f) => !has(f.id));
    function chestModal() {
      const fishN = Object.values(v.fish || {}).reduce((a, b) => a + b, 0), prodN = Object.values(v.produce || {}).reduce((a, b) => a + b, 0), t = R.titleFor(v.wr);
      TG.modal(h('div', null, h('h2', null, '🧰 ', L('Миний авдар', 'My chest')), h('p', { class: 'muted' }, L('Авдарт гэр бүлийн үнэт зүйлсийг хадгалдаг.', 'Families keep their treasures in the avdar.')),
        h('div', { class: 'stat-cards' },
          h('div', { class: 'stat' }, h('small', null, L('Загас', 'Fish')), h('b', null, fishN)), h('div', { class: 'stat' }, h('small', null, L('Ургац', 'Crops')), h('b', null, prodN)), h('div', { class: 'stat' }, h('small', null, L('Тамга', 'Stamps')), h('b', null, TG.passport ? TG.passport.stamps(S.active()) : 0))),
        h('div', { class: 'v-list' },
          t ? h('div', { class: 'v-row' }, pic('ui:wrestle'), h('div', { class: 'v-row-b' }, h('b', null, L('Бөхийн цол', 'Wrestling title')), h('small', null, tx(R.TITLES.find((q) => q.id === t).name)))) : null,
          v.arch && v.arch.best ? h('div', { class: 'v-row' }, pic('ui:bow'), h('div', { class: 'v-row-b' }, h('b', null, L('Сур харваа', 'Archery')), h('small', null, `${v.arch.best}/12`))) : null,
          v.horse && v.horse.wins ? h('div', { class: 'v-row' }, pic('ui:trophy'), h('div', { class: 'v-row-b' }, h('b', null, L('Түрүү морь', 'Race wins')), h('small', null, String(v.horse.wins)))) : null,
          ...(v.owned || []).slice(0, 12).map((id) => { const it = R.ITEMS.find((q) => q.id === id); return it ? h('div', { class: 'v-row' }, h('span', { class: 'v-card-e' }, it.e), h('div', { class: 'v-row-b' }, h('b', null, tx(it.name)))) : null; }))), { cls: 'v-modal' });
    }
    const since = (k, dur, ts) => ts - fx[k] < dur;
    const buttons = own
      ? [h('button', { class: 'btn scene-side', onclick: () => homeModal(i) }, '🛋️ ', L('Тохижуулах', 'Decorate'), missing.length ? ` (${missing.length})` : ''), h('button', { class: 'btn scene-side', onclick: () => wardrobe() }, '👘 ', L('Хувцас', 'Wardrobe'))]
      : [h('button', { class: 'btn scene-side', onclick: () => { if (live && live.online) net.send({ t: 'say', k: 'p', i: 0 }); else if (live) live.me.bubble = { text: tx(R.PHRASES[0]), t0: performance.now() }; sc.close(); } }, L('Мэндлээд гарах', 'Say hi and leave'))];
    const sc = TG.scene.open({
      cls: 'ger-scene', W: room.W, H: room.H, fit: 'contain', bg: '#1e140c', look: v.look, start: { x: cx, y: 186 }, speed: 62,
      title: own ? L('Миний гэр', 'My ger') : `${l.n} · ${L('гэр', 'ger')}`, sub: own ? `${furn.length}/${R.FURNITURE.length} ${L('тавилга', 'furniture')}` : L('Зочилж байна', 'Visiting'),
      free: room.free, things, buttons,
      drawBg: (b) => b.drawImage(room.bg, 0, 0),
      ents: () => room.props.map((p) => ({ y: p.base, f: (b) => b.drawImage(p.c, p.x, p.y) })),
      drawTop: (b, t) => {
        const ts = t * 1000;
        if (since('steam', 3000, ts)) for (let k = 0; k < 5; k++) { const q = (ts / 900 + k / 5) % 1; b.fillStyle = `rgba(255,255,255,${0.75 - q * 0.6})`; b.fillRect(Math.round(cx - 3 + Math.sin(ts / 300 + k) * 4), Math.round(128 - q * 28), 2, 2); }
        if (since('zzz', 2500, ts)) { b.fillStyle = '#ffffff'; b.font = '700 10px Rubik, sans-serif'; b.fillText('z', fx.zx - 4, 116 - ((ts / 60) % 14)); b.fillText('Z', fx.zx + 3, 108 - ((ts / 50) % 16)); }
        if (since('notes', 3600, ts)) for (let k = 0; k < 3; k++) { const q = (ts / 1200 + k / 3) % 1; b.fillStyle = '#f7c646'; b.fillRect(Math.round(110 + k * 7 + Math.sin(ts / 200 + k) * 3), Math.round(70 - q * 30), 2, 2); b.fillRect(Math.round(112 + k * 7 + Math.sin(ts / 200 + k) * 3), Math.round(65 - q * 30), 1, 5); }
        if (since('churn', 1500, ts)) { b.fillStyle = '#fff6e0'; for (let k = 0; k < 3; k++) b.fillRect(40 + k * 4, Math.round(128 - ((ts / 90 + k * 5) % 10)), 2, 2); }
      },
      info: h('p', null, own ? L('Гэртээ тавтай морил! Босгыг алхаж давлаа ✓. Тавилга руу ойртоод E дар, Space дарвал үсэрнэ.', 'Welcome home! You stepped over the threshold ✓. Walk up to things and press E. Space makes you jump.') : L(`${l.n}-ийн гэрт зочиллоо. Нар зөв, баруун гар талаараа эргэж ажиглаарай.`, `You are visiting ${l.n}'s ger. Look around moving sunwise, to your left first.`)),
      onClose: () => { if (live) { live.keys.clear(); updateCtx(); } },
    });
    TG._village.ger = sc; // used by automated tests
  }

  function openBasar() {
    const dg = live && live.dog, b = dg && dg.bubble;
    if (dg) dg.bubble = null;
    TG.basar.open(b ? { context: tx(b.fact) + ' ' + L('Илүү ихийг мэдмээр байна уу? Надаас асуугаарай!', 'Want to know more? Ask me!') } : {});
  }

  function talk() {
    const say = (k, i) => {
      if (live.online) net.send({ t: 'say', k, i });
      else live.me.bubble = { text: k === 'e' ? R.EMOTES[i] : tx(R.PHRASES[i]), t0: performance.now() };
      close();
    };
    // the room's recent chat sits on top of the phrases, so reading and answering is one window
    const log = h('div', { class: 'v-chatlog', role: 'log', 'aria-live': 'polite', 'aria-label': L('Чатын түүх', 'Chat log') });
    live.chatLog = log; live.unread = 0; renderChat();
    const close = TG.modal(h('div', null, h('h2', null, L('Хэлэх үг', 'Say something')), log,
      h('p', { class: 'muted' }, '🛡️ ', L('Хүүхдийн аюулгүй байдлын үүднээс зөвхөн бэлэн үг, эможи ашиглана.', 'For child safety, only friendly preset phrases and emoji are allowed.')),
      h('div', { class: 'v-phrases' }, R.PHRASES.map((p, i) => h('button', { class: 'v-chip wide', onclick: () => say('p', i) }, tx(p)))),
      h('div', { class: 'v-chips v-emotes' }, R.EMOTES.map((e, i) => h('button', { class: 'v-chip', onclick: () => say('e', i) }, e)))),
      { onClose: () => { if (live) live.chatLog = null; } });
  }

  // ---------------------------------------------------------------- chat log: the room's recent phrases, joins and leaves
  const CHAT_KEEP = 30;
  function addChat(line) {
    if (!live) return;
    (live.chat = live.chat || []).push(line);
    if (live.chat.length > CHAT_KEEP) live.chat.splice(0, live.chat.length - CHAT_KEEP);
    if (!live.chatLog && (line.k === 'p' || line.k === 'e') && line.id !== V().id) live.unread = (live.unread || 0) + 1;
    renderChat();
  }
  function chatText(l) {
    if (l.k === 'join') return '👋 ' + L('нутагт ирлээ', 'joined the village');
    if (l.k === 'leave') return '🚶 ' + L('нутгаас явлаа', 'left the village');
    return l.k === 'e' ? R.EMOTES[l.i] || '' : tx(R.PHRASES[l.i] || R.PHRASES[0]);
  }
  function renderChat() {
    if (!live) return;
    const chat = live.chatLog, lines = live.chat || [], badge = live.els.talk.querySelector('.v-badge');
    badge.textContent = live.unread > 9 ? '9+' : String(live.unread || '');
    badge.classList.toggle('hidden', !live.unread);
    if (!chat) return;
    chat.classList.toggle('hidden', !lines.length && !live.online); // playing alone: no empty log, just the phrases
    chat.replaceChildren(...(lines.length ? lines.map((l) => h('div', { class: 'v-chat-line' + (l.k === 'join' || l.k === 'leave' ? ' sys' : '') }, h('b', null, l.n), ' ', chatText(l)))
      : [h('div', { class: 'v-chat-line sys' }, L('Одоохондоо мессеж алга.', 'No messages yet.'))]));
    chat.scrollTop = chat.scrollHeight;
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
      live.census = null;
      if (live.status !== 'solo' || live.replaced) { live.replaced = false; net.rejoin(); } else TG.toast(L('Сервертэй холбогдоогүй тул ганцаараа горимд байна.', 'No server connection, so you are in solo mode.'));
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
        ? h('div', null, h('p', { class: 'muted' }, L(`"${live.room}" өрөөнд ${others.length + 1} хүн байна. Ижил кодтой хүмүүс нэг нутагт хамт тоглоно.`, `${others.length + 1} people in room "${live.room}". Everyone with the same code shares one village.`)),
          h('div', { class: 'v-chips' }, h('span', { class: 'v-chip wide active' }, portrait(V().look, 22), ' ', live.name, ` (${L('та', 'you')})`), others.map((o) => h('span', { class: 'v-chip wide' }, portrait(o.look, 22), ' ', o.name, ` · ${o.lvl}`))))
        : h('div', { class: 'hint' }, live.status === 'solo'
          ? L('Одоо ганцаараа горимд байна. Найзуудтайгаа хамт тоглохын тулд багш эсвэл эцэг эх компьютер дээр "node server.js" ажиллуулж, бүгд нэг Wi-Fi-аас тэр хаягаар нэвтэрнэ.', 'You are in solo mode. To play with friends, a teacher or parent runs "node server.js" on a computer and everyone on the same Wi-Fi opens its address.')
          : L('Холбогдож байна…', 'Connecting…')),
      live.status === 'online' && live.census && live.census.total > others.length + 1 ? h('div', { class: 'v-invite' },
        h('b', null, '👥 ', L(`Энэ серверт өөр өрөөнд ${live.census.total - others.length - 1} хүн байна.`, `${live.census.total - others.length - 1} more people on this server are in other rooms.`)),
        h('p', { class: 'muted' }, L('Хамт тоглохын тулд бүгд ижил өрөөний кодтой байх ёстой.', 'To play together, everyone needs the same room code.')),
        live.room !== 'NUTAG' && live.census.nutag ? h('button', { class: 'btn primary block', onclick: () => join('NUTAG') }, L(`Үндсэн Нутаг руу орох (${live.census.nutag} хүн)`, `Join the main village (${live.census.nutag} here)`)) : null) : null,
      live.room !== 'NUTAG' ? h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: () => join('NUTAG') }, '🏡 ', L('Үндсэн Нутаг (NUTAG) руу буцах', 'Back to the main village (NUTAG)')) : null,
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
      v.fishCaught = (v.fishCaught || 0) + 1;
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
    const l = lotsArr()[i], v = V();
    if (!l) return myLot() >= 0 && myLot() !== i ? TG.toast(L('Танд аль хэдийн гэр байна!', 'You already have a ger!')) : TG.gerwork.build(i);
    if (l.by === v.id) return R.lotStage(l) < R.GER_DONE ? TG.gerwork.build(i) : enterGer(i);
    if (R.lotStage(l) < R.GER_DONE) return TG.toast(`🏗️ ${l.n} ${L('гэрээ барьж байна. Дараа нь зочлоорой!', 'is still building their ger. Visit when it is done!')}`);
    enterGer(i, true);
  }
  function gerPreview(roof, door, scale) {
    const c = h('canvas', { class: 'v-gerprev', width: 48 * scale, height: 50 * scale }), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(PX.gerSprite(R.ROOF[roof], R.DOOR[door]), 0, 0, 48 * scale, 50 * scale);
    return c;
  }
  const swatches = (map, cur, onPick, cls = '') => h('div', { class: 'v-chips' }, Object.entries(map).map(([k, c]) => h('button', { class: 'v-chip v-swatch ' + cls + (cur === k ? ' active' : ''), style: { background: c }, 'aria-label': k, onclick: () => onPick(k) })));
  /** Pick the roof band and door colours of a finished ger. */
  function gerColours(i) {
    const l = lotsArr()[i]; if (!l) return;
    const body = h('div'); let roof = l.roof || 'blue', door = l.door || 'red';
    const draw = () => rc(body,
      h('h2', null, L('Гэрийнхээ өнгийг сонго', 'Choose your ger’s colours')),
      h('div', { class: 'v-gerbox' }, gerPreview(roof, door, 3)),
      h('div', { class: 'label' }, L('Дээврийн хээ', 'Roof band')), swatches(R.ROOF, roof, (k) => { roof = k; draw(); }),
      h('div', { class: 'label', style: { marginTop: '10px' } }, L('Хаалга', 'Door')), swatches(R.DOOR, door, (k) => { door = k; draw(); }, 'door'),
      h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => { saveLot(i, { roof, door }); const own = V().lots[i]; if (own && own.by === V().id) Object.assign(own, { roof, door }); S.save(); close(); } }, L('Болсон', 'Done')));
    draw();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  function onLot(m) {
    const v = V();
    lotsArr()[m.i] = m.lot;
    if (m.by !== v.id && m.act === 'claim') TG.toast(`🏠 ${m.lot.n} ${L('гэр барьж эхэллээ!', 'started building a ger!')}`);
    else if (m.by !== v.id && m.act === 'stage' && R.lotStage(m.lot) === R.GER_DONE) TG.toast(`🏠 ${m.lot.n} ${L('гэрээ барьж дууслаа!', 'finished building their ger!')}`);
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
      rc(body, h('h2', null, L('Гэрээ тохижуулах', 'Decorate my ger')), cv,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', onclick: () => { close(); wardrobe(); } }, L('Хувцас', 'Wardrobe')),
          h('button', { class: 'btn primary', disabled: rested, onclick: () => { v.rest = today; v.energy = 100; S.save(); reward(5, 10); TG.sfx.chime(); TG.toast(L('Гэртээ амарлаа: +10 XP, хүч дүүрлээ.', 'You rested at home: +10 XP, energy full.')); draw(); } }, rested ? L('Өнөөдөр амарсан', 'Rested today') : L('Амрах', 'Rest'))),
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
  const RED = '#d8342b', BLUE = '#2b5bd8'; // traditional zodog colours
  function wrestlerPic(pose, col, size = 48) { const c = h('canvas', { class: 'px-icon', width: 32, height: 48, style: { width: size + 'px', height: Math.round(size * 48 / 32) + 'px' } }); c.getContext('2d').drawImage(PX.wrestler(col, R.SKINS.includes(V().look.skin) ? V().look.skin : R.SKINS[0], pose, 0), 0, 0); return c; }
  function arenaModal() {
    const v = V(), wr = v.wr, t = titleObj(R.titleFor(wr));
    const next = R.TITLES.find((q) => (q.id === 'avarga' ? (wr.champ || 0) < 2 : (wr.best || 0) < q.need));
    const others = live.online ? [...live.others.values()] : [];
    const stat = (k, n) => h('div', { class: 'stat' }, h('small', null, k), h('b', null, n));
    const close = TG.modal(h('div', null,
      h('div', { class: 'v-wr-head' }, wrestlerPic('dance', RED), h('div', null, h('h2', null, L('Бөхийн барилдаан', 'Mongolian wrestling')), h('p', { class: 'muted' }, t ? `★ ${tx(t.name)}` : L('Цолгүй бөх', 'No title yet')))),
      h('div', { class: 'stat-cards' }, stat(L('Шилдэг давлага', 'Best rounds'), wr.best || 0), stat(L('Түрүү', 'Wins'), wr.champ || 0), stat(L('Ялалт', 'Victories'), (wr.wins || 0) + (wr.pvpW || 0))),
      h('p', { class: 'hint' }, !next ? L('Та хамгийн дээд цол Аварга хүртсэн! 🏆', 'You hold the highest title, Avarga! 🏆')
        : next.id === 'avarga' ? L('Наадамд дахин түрүүлбэл Аварга цол хүртэнэ!', 'Win the Naadam once more to become an Avarga!')
          : L(`Наадамд ${next.need} давбал «${tx(next.name)}» цол хүртэнэ.`, `Win ${next.need} rounds at the Naadam to earn the "${tx(next.name)}" title.`)),
      h('div', { class: 'v-wr-modes' },
        h('button', { class: 'v-wr-mode px-card', onclick: () => { close(); tournament(1); } }, wrestlerPic('push', RED, 40),
          h('b', null, L('Чөлөөтэй барилдах', 'Wrestle freely')), h('small', null, L('Наадамд 9 даваа барилдаж цол аваарай', 'Wrestle 9 rounds at the Naadam and earn titles'))),
        h('button', { class: 'v-wr-mode px-card', onclick: () => { close(); wrestleSchool(); } }, wrestlerPic('dance', BLUE, 40),
          h('b', null, L('Барилдаж сурах', 'Learn to wrestle')), h('small', null, wr.school ? L('Мэх бүрийг энгийнээр дахин үзэх', 'Go over every move again, nice and simple') : L('Мэх бүрийг энгийнээр тайлбарлаад дасгал хийнэ', 'Every move explained simply, then a practice bout')))),
      h('button', { class: 'btn block', style: { marginTop: '8px' }, onclick: () => techBook() }, '📖 ', L(`Мэхний ном (${R.MOVES.length} мэх)`, `Technique book (${R.MOVES.length} moves)`)),
      live.online ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'label' }, L('Найзтайгаа барилдах', 'Wrestle a friend')),
        others.length ? h('div', { class: 'v-list' }, others.map((o) => h('div', { class: 'v-row' }, portrait(o.look, 28), h('div', { class: 'v-row-b' }, h('b', null, o.name), h('small', null, `${L('Түвшин', 'Level')} ${o.lvl}`)),
          h('button', { class: 'btn sm primary', onclick: () => { net.send({ t: 'wr-invite', to: o.id }); TG.toast(L('Урилга илгээлээ…', 'Invitation sent…')); close(); } }, L('Урих', 'Invite')))))
          : h('p', { class: 'muted' }, L('Одоогоор өрөөнд өөр хүн алга.', 'Nobody else is in the room yet.'))) : null,
      h('div', { class: 'teach', style: { marginTop: '12px' } }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(TG.pick(WR_FACTS))))), { cls: 'v-modal' });
  }
  function techBook() {
    const used = (V().wr.techs) || {};
    TG.modal(h('div', null, h('h2', null, L('Бөхийн мэхний ном', 'Wrestling technique book')),
      h('p', { class: 'muted' }, L(`Мэх бүр дараагийн ${R.MOVES.length >> 1} мэхийг давж, өмнөхөд нь дийлддэг. Мэх бүрийг өөр ур чадвараар хийнэ: ⏱ цаг тааруулах, ⇄ хөлийн хөдөлгөөн (сумнууд), 💪 хүч (хурдан дарах), ✋ барьцаа (дарж байгаад тавих), ⚖ тэнцвэр. Нэг мэхийг давтвал өрсөлдөгч таньдаг. Даваа ахих тусам хэцүү болно!`, `Each move beats the next ${R.MOVES.length >> 1} and loses to the ones before it. Each is done with its own skill: ⏱ timing, ⇄ footwork (arrows), 💪 power (fast taps), ✋ grip (hold and release), ⚖ balance. Repeat a move and your opponent reads it. Each round gets harder!`)),
      h('div', { class: 'v-list' }, R.MOVES.map((m) => h('div', { class: 'v-row' }, h('span', { class: 'v-tech-n' }, used[m.id] || 0),
        h('div', { class: 'v-row-b' }, h('b', null, `${SKILL_ICON[SKILL[m.id] || 'timing']} ${tx(m.name)}`), h('small', null, tx(m.fact)), h('small', null, '✓ ', L('Давна', 'Beats'), ': ', m.beats.map((b2) => tx(R.MOVES.find((q) => q.id === b2).name)).join(', '))))))), { cls: 'v-modal' });
  }
  // ---------------- wrestling school: the basics and every move, told as you'd tell a five-year-old, then a practice bout
  const SKILL_KID = {
    timing: { name: Tx('Цагаа тааруулах', 'Tap on time'), how: Tx('Жижиг зураас нааш цааш гүйнэ. Ногоон дээр ирэхэд нь дар, эрвээхэй барьж байгаа юм шиг!', 'A little line runs back and forth. Tap when it’s in the green, like catching a butterfly!') },
    hold: { name: Tx('Дараад барих', 'Press and hold'), how: Tx('Товчоо дараад барь. Аяганд сүү хийх шиг зураас дүүрнэ. Шар дээр хүрэхэд нь тавь. Хэт удаан битгий бариарай!', 'Press the button and keep holding. The bar fills up like pouring milk into a cup. Let go when it reaches the yellow. Not too long!') },
    combo: { name: Tx('Хөлийн хөдөлгөөн', 'Happy feet'), how: Tx('Сумнууд гарч ирнэ. Яг тэр дарааллаар нь хурдан дар. Хөлөөрөө бүжиглэж байгаа юм шиг!', 'Arrows pop up. Press them in the same order, quickly. It’s like a little dance with your feet!') },
    mash: { name: Tx('Бүх хүчээрээ', 'Super strong'), how: Tx('Аль болох хурдан дар, дар, дар! Дарах бүрт чи улам хүчтэй болно.', 'Tap, tap, tap as fast as you can! Every tap makes you stronger.') },
    balance: { name: Tx('Тэнцвэр', 'Stay steady'), how: Tx('Найз чинь чамайг нааш цааш түлхэнэ. ◀ ▶ дарж зүүгээ голд нь байлга. Гуалин дээгүүр алхаж байгаа юм шиг!', 'Your friend pushes you this way and that. Press ◀ ▶ to keep the needle in the middle, like walking along a log!') },
  };
  const SCHOOL = [
    { pic: ['grip', 'grip'], title: Tx('Бөх гэж юу вэ?', 'What is wrestling?'), say: [Tx('Хоёр бөх бие биенээ барьж аваад түлхэлцэж, татацгаана.', 'Two wrestlers hold on to each other, then push and pull.'), Tx('Хэн нь түрүүлж унавал тэр нь ялагдана. Яг л тоглоом шиг!', 'Whoever falls down first loses. It’s just like a game!')] },
    { pic: ['dance', 'fall'], title: Tx('Яаж ялах вэ?', 'How do you win?'), say: [Tx('Найзынхаа өвдөг, тохой, нуруу эсвэл толгойг газарт хүргэвэл чи ялна.', 'If your friend’s knee, elbow, back or head touches the ground, you win.'), Tx('Хөл, гар газарт хүрвэл зүгээр. Тэр унасанд тооцогдохгүй.', 'Feet and hands on the ground are okay. That doesn’t count as falling.')] },
    { pic: ['idle', 'idle'], title: Tx('Бөхийн хувцас', 'Wrestler clothes'), say: [Tx('Зодог бол урд нь задгай, ханцуйтай жижигхэн цамц.', 'The zodog is a little jacket with long sleeves and an open front.'), Tx('Шуудаг бол богинохон өмд. Гутал нь хамар нь дээшээ эргэсэн том гутал.', 'The shuudag is tiny shorts, and the gutal are big boots with curly toes.')] },
    { pic: ['dance', 'dance'], title: Tx('Бүргэдийн бүжиг', 'The eagle dance'), say: [Tx('Барилдахын өмнө бөхчүүд бүргэд шиг гараа дэвж бүжиглэнэ. Үүнийг “дэвээ” гэдэг.', 'Before wrestling, wrestlers flap their arms like a big eagle. This is called “devee”.'), Tx('Тоглоомд товч гэрэлтэх бүрт дар. Сайн бүжиглэвэл эхний мэх чинь илүү хүчтэй болно!', 'In the game, tap when the button glows. Dance well and your first move gets stronger!')] },
    { pic: ['push', 'grip'], title: Tx('Мэх гэж юу вэ?', 'What is a move?'), say: [Tx('Мэх бол найзаа унагах арга. Хайч, чулуу, даавуу шиг: мэх бүр заримыг нь дийлж, заримд нь дийлдэнэ.', 'A move is a trick to make your friend fall. It’s like rock, paper, scissors: every move beats some moves and loses to others.'), Tx('Мэхний доор “>” тэмдгийн ард ямар мэхийг дийлдэг нь бичээстэй.', 'Under each move, after the “>” sign, you can see which moves it beats.'), Tx('Нэг мэхийг дахин дахин хийвэл найз чинь таачихна. Өөр өөр мэх хий!', 'If you use the same move again and again, your friend will guess it. Mix them up!')] },
    ...Object.keys(SKILL_KID).map((skill) => ({ skill })),
    { pic: ['grip', 'grip'], title: Tx('Одоо туршаад үзье!', 'Now let’s try it!'), say: [Tx('Багштайгаа дасгал барилдаан хийе. Багш зөөлөн барилдана, санаа зовох хэрэггүй.', 'Let’s have a practice bout with the coach. The coach goes easy, so don’t worry.'), Tx('Мэх сонгох бүрт тэр мэх юу хийдгийг, яаж хийхийг дахин сануулна.', 'Every time you pick a move, you’ll see what it does and how to do it.')], last: true },
  ];
  function wrestleSchool() {
    let i = 0;
    const box = h('div', { class: 'v-school' }), close = TG.modal(box, { cls: 'v-modal' });
    const pair = ([a, b]) => { const opp = wrestlerPic(b, BLUE, 56); opp.style.transform = 'scaleX(-1)'; return h('div', { class: 'v-school-pic' }, wrestlerPic(a, RED, 56), opp); };
    const draw = () => {
      const pg = SCHOOL[i], sk = pg.skill && SKILL_KID[pg.skill];
      rc(box,
        h('div', { class: 'eyebrow' }, L('Бөхийн сургууль', 'Wrestling school'), ` · ${i + 1}/${SCHOOL.length}`),
        sk ? h('div', { class: 'v-school-pic v-school-icon' }, SKILL_ICON[pg.skill]) : pair(pg.pic),
        h('h2', null, tx(sk ? sk.name : pg.title)),
        (sk ? [sk.how] : pg.say).map((t) => h('p', { class: 'v-school-say' }, tx(t))),
        sk ? [h('div', { class: 'label' }, L('Ингэж хийдэг мэхүүд', 'Moves you do this way')),
          h('div', { class: 'v-list' }, R.MOVES.filter((m) => (SKILL[m.id] || 'timing') === pg.skill).map((m) => h('div', { class: 'v-row' }, h('div', { class: 'v-row-b' }, h('b', null, tx(m.name)), h('small', null, tx(m.kid))))))] : null,
        h('div', { class: 'v-school-dots' }, SCHOOL.map((_, k) => h('i', { class: k === i ? 'on' : k < i ? 'done' : '' }))),
        h('div', { class: 'row-btns' },
          i > 0 ? h('button', { class: 'btn', onclick: () => { i--; draw(); } }, '◀ ', L('Буцах', 'Back')) : h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')),
          pg.last ? h('button', { class: 'btn primary', onclick: () => { close(); practiceBout(); } }, '🤼 ', L('Дасгал барилдаан', 'Practice bout'))
            : h('button', { class: 'btn primary', onclick: () => { i++; TG.sfx.tap(); draw(); } }, L('Дараах', 'Next'), ' ▶')));
      if (pg.last && !V().wr.school) { V().wr.school = 1; S.save(); }
    };
    draw();
  }
  // a practice bout: the slowest round, a gentle coach, the move explained as you pick it, and nothing to win or lose
  function practiceBout() { wrestleMatch({ ai: true, practice: true, round: 1, opp: { name: L('Багш', 'Coach'), skill: 0.06, skin: R.SKINS[2] } }); }
  function tournament(round) {
    const opp = { name: WR_NAMES[(round * 5 + Math.floor(Math.random() * 4)) % WR_NAMES.length], skill: 0.12 + round * 0.07, skin: TG.pick(R.SKINS) };
    wrestleMatch({ ai: true, round, opp }, (won) => {
      const v = V(), wr = v.wr;
      if (won) { wr.wins = (wr.wins || 0) + 1; quest('wrestle'); reward(8 + round * 2, 10 + round * 3); } else { wr.losses = (wr.losses || 0) + 1; reward(0, 5); }
      const reached = won ? round : round - 1;
      if (won && round === 9) wr.champ = (wr.champ || 0) + 1;
      if (reached > (wr.best || 0)) wr.best = reached;
      S.save(); checkAch();
      return { newTitle: updateTitle(), champion: won && round === 9 };
    });
  }
  // what touches the ground after each move (a fall counts when an elbow, knee, back or shoulder touches)
  const WR_PART = { push: Tx('нуруу', 'back'), pull: Tx('өвдөг', 'knee'), hook: Tx('нуруу', 'back'), inhook: Tx('нуруу', 'back'), hip: Tx('мөр', 'shoulder'), leg: Tx('тохой', 'elbow'), lift: Tx('нуруу', 'back'),
    havirah: Tx('ташаа', 'hip'), humruh: Tx('нуруу', 'back'), toigdoh: Tx('мөр', 'shoulder'), hongodoh: Tx('нуруу', 'back'), suga: Tx('мөр', 'shoulder'), tahim: Tx('өвдөг', 'knee') };
  // each technique is performed with its own skill, so bouts don't feel the same: footwork combos for hooks and sweeps,
  // rapid power for lifts, hold-and-release for grip throws, keeping your balance for тойгдох and хонгодох, timing for the rest
  const SKILL = { push: 'timing', hip: 'timing', tahim: 'timing', pull: 'hold', leg: 'hold', suga: 'hold', hook: 'combo', inhook: 'combo', havirah: 'combo', lift: 'mash', humruh: 'mash', toigdoh: 'balance', hongodoh: 'balance' };
  const SKILL_ICON = { timing: '⏱', hold: '✋', combo: '⇄', mash: '💪', balance: '⚖' };
  const ARROWS = ['←', '→', '↑', '↓'], ARROW_KEY = { ArrowLeft: 0, KeyA: 0, ArrowRight: 1, KeyD: 1, ArrowUp: 2, KeyW: 2, ArrowDown: 3, KeyS: 3 };
  const OPP_TITLE = ['', '', '', '', 'nachin', 'khartsaga', 'zaan', 'garid', 'arslan', 'arslan'];
  const DEVEE_BEAT = 700, DEVEE_TAPS = 4;
  function wrestleMatch(cfg, onEnd) {
    const v = V(), mySkin = R.SKINS.includes(v.look.skin) ? v.look.skin : R.SKINS[0], oppSkin = cfg.opp.skin || '#D9A06E';
    const st = { a: 0, b: 0, phase: 'choose', move: null, lastPlayer: null, off: 0, target: 0, pose: ['grip', 'grip'], over: false, t0: performance.now(), marker: 0, intro: performance.now(), used: {}, flash: null,
      devee: cfg.ai ? { n: 0, good: 0, t0: performance.now(), f: 0 } : null, bonus: 0, lastMove: null, end: 0, left: false };
    // each даваа is harder: more points to win, a faster timing bar, a narrower sweet spot and a sharper opponent
    const rnd = cfg.ai ? cfg.round : 4, need = cfg.ai && cfg.round >= 7 ? 3 : 2;
    const young = ((S.active() || {}).age || 10) <= 9;   // little ones get a slower marker and wider targets
    const barSpeed = (cfg.ai ? 2.1 + rnd * 0.2 : 3) * (young ? 0.85 : 1) * (cfg.practice ? 0.8 : 1), sharp = Math.max(1, (cfg.ai ? 1 + rnd * 0.08 : 1.15) - (young ? 0.1 : 0));
    const grunt = (k, pitch) => TG.voice && TG.voice.grunt(k, pitch); // wrestlers grunt, huff and scuff the sand
    const cv = h('canvas', { class: 'v-wr-canvas', width: 192, height: 108 }), cx = cv.getContext('2d');
    const score = h('div', { class: 'v-wr-score' }), msg = h('div', { class: 'v-wr-msg' }, L('Мэхээ сонго!', 'Choose your move!'));
    const coach = cfg.practice ? h('div', { class: 'teach v-wr-coach' }) : null;   // the school's coach explains as you go
    const moves = h('div', { class: 'v-wr-moves' }), marker = h('i', { class: 'v-wr-marker' });
    const goBtn = h('button', { class: 'btn primary big block' }, L('Хүч! (Space)', 'Power! (Space)'));
    const timing = h('div', { class: 'v-wr-timing hidden' }, h('div', { class: 'v-wr-bar' }, h('i', { class: 'v-wr-zone', style: { width: Math.round(36 / sharp) + '%', left: (50 - 18 / sharp) + '%' } }), marker), goBtn);
    const skillBox = h('div', { class: 'v-wr-skill hidden' });
    st.view = v.wrView === 'fp' ? 'fp' : 'side';
    const viewBtn = h('button', { class: 'btn sm v-wr-view', onclick: () => { st.view = st.view === 'fp' ? 'side' : 'fp'; v.wrView = st.view; S.save(); viewBtn.textContent = st.view === 'fp' ? L('🗺️ Хажуугаас', '🗺️ Side view') : L('👁 Өөрийн нүдээр', '👁 First person'); viewBtn.blur(); } }, st.view === 'fp' ? L('🗺️ Хажуугаас', '🗺️ Side view') : L('👁 Өөрийн нүдээр', '👁 First person'));
    const tail = h('div');
    // the zasuul calls out both wrestlers by their titles before the bout
    const myT = titleObj(R.titleFor(v.wr)), opT = cfg.ai ? titleObj(OPP_TITLE[cfg.round]) : null, named = (t, n) => (t ? tx(t.name) + ' ' : '') + n;
    const heraldSay = h('span');
    const herald = h('div', { class: 'v-zasuul' }, h('b', null, '📣 ', L('Засуул', 'Herald'), ': '), heraldSay);
    { const t0 = L(`«${named(myT, live.name)}, ${named(opT, cfg.opp.name)} хоёр барилдана! Хүчит бөхчүүд дэвээгээ хийцгээ!»`, `"${named(myT, live.name)} and ${named(opT, cfg.opp.name)} will wrestle! Mighty wrestlers, do your eagle dance!"`); TG.voice ? TG.voice.type(heraldSay, t0, 'zasuul') : (heraldSay.textContent = t0); }
    // дэвээ: flap like an eagle in time with the beat; a good dance gives power to your first move
    const feathers = Array.from({ length: DEVEE_TAPS }, () => h('i', { class: 'v-wr-feather' }));
    const deveeBtn = h('button', { class: 'btn primary big', onclick: () => deveeTap() }, '🦅 ', L('Дэвэх (Space)', 'Flap (Space)'));
    const deveeBox = h('div', { class: 'v-wr-devee hidden' }, h('div', { class: 'v-wr-feathers' }, ...feathers), deveeBtn);
    const body = h('div', { class: 'v-wrestle' }, h('div', { class: 'eyebrow' }, cfg.practice ? L('Бөхийн сургууль · Дасгал', 'Wrestling school · Practice') : cfg.ai ? `${L('Наадам', 'Naadam')} · ${L('Даваа', 'Round')} ${cfg.round}/9 · ${need} ${L('унагаалт', 'falls')} · ${'★'.repeat(Math.ceil(cfg.round / 3))}` : L('Найзтай барилдаан', 'Friendly match')),
      h('div', { class: 'v-wr-title' }, h('h2', null, `${live.name} · ${cfg.opp.name}`), viewBtn), cv, herald, score, msg, coach, deveeBox, moves, timing, skillBox, tail);
    const drawScore = () => rc(score, h('span', { class: 'me' }, live.name, ' ', '●'.repeat(st.a) + '○'.repeat(Math.max(0, need - st.a))), h('span', { class: 'them' }, '●'.repeat(st.b) + '○'.repeat(Math.max(0, need - st.b)), ' ', cfg.opp.name));
    const moveLabel = (id) => tx(R.MOVES.find((m) => m.id === id).name);
    const setPhase = (p) => {
      st.phase = p;
      if (coach && p === 'choose') rc(coach, h('b', null, '💡 ', L('Мэхээ сонго', 'Pick a move')), h('p', null, L('Дуртай мэхээ дар. “>” тэмдгийн ард тэр мэхний дийлдэг мэхүүд бий. Өөр өөр мэх туршаарай!', 'Tap any move you like. After the “>” are the moves it beats. Try a different one each time!')));
      if (coach && p === 'devee') rc(coach, h('b', null, '💡 ', L('Бүргэд шиг бүжиглэ', 'Dance like an eagle')), h('p', null, L('Товч гэрэлтэх бүрт дар. Сайн бүжиглэвэл эхний мэх чинь хүчтэй болно!', 'Tap each time the button glows. A good dance makes your first move stronger!')));
      if (coach && p === 'done') coach.remove();
      moves.classList.toggle('hidden', p !== 'choose'); timing.classList.toggle('hidden', p !== 'timing'); deveeBox.classList.toggle('hidden', p !== 'devee'); skillBox.classList.toggle('hidden', p !== 'skill');
      if (p === 'choose') rc(moves, ...R.MOVES.map((m) => h('button', { class: 'btn' + (m.id === st.lastPlayer ? ' v-wr-repeat' : ''), title: tx(m.fact), onclick: () => { st.move = m.id; startSkill(m.id); } },
        h('b', null, `${SKILL_ICON[SKILL[m.id] || 'timing']} ${tx(m.name)}`), h('small', null, '> ' + m.beats.map(moveLabel).join(', ')))));
    };
    let raf = 0, lastT = performance.now();
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - lastT) / 1000); lastT = ts;
      st.off += (st.target - st.off) * Math.min(1, dt * 8);
      if (st.phase === 'devee') deveeBtn.classList.toggle('beat', deveeOnBeat(ts));
      if (st.phase === 'timing') { st.marker = (Math.sin(((ts - st.t0) / 1000) * barSpeed) + 1) / 2; marker.style.left = st.marker * 100 + '%'; if (ts - st.t0 > 5000) lock(); }
      skillTick(dt, ts);
      if (st.view === 'fp') { drawFP(ts); raf = requestAnimationFrame(loop); return; }
      // pixel scene: crowd stands, flags, sand ring, the zasuul watching
      const Wc = 192, Hc = 108, ground = 100;
      cx.imageSmoothingEnabled = false; cx.fillStyle = '#e8c994'; cx.fillRect(0, 0, Wc, Hc);
      for (let i = 0; i < 90; i++) { cx.fillStyle = i % 2 ? '#d4ae72' : '#f6e2b8'; cx.fillRect((i * 37) % Wc, 40 + ((i * 53) % 66), 1, 1); }
      cx.fillStyle = '#5a361c'; cx.fillRect(0, 0, Wc, 30); cx.fillStyle = '#7a4a26'; cx.fillRect(0, 10, Wc, 2); cx.fillRect(0, 21, Wc, 2);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 31; i++) { const px0 = 3 + i * 6 + row * 3, py0 = 3 + row * 11, bob = Math.floor(ts / 400 + i + row) % 3 === 0 ? -1 : 0; cx.fillStyle = ['#d8342b', '#2b5bd8', '#f7c646', '#2ea35f', '#ffffff', '#9466e0'][(i + row * 2) % 6]; cx.fillRect(px0, py0 + 4 + bob, 4, 4); cx.fillStyle = (i + row) % 3 ? '#edbb93' : '#c98a5a'; cx.fillRect(px0 + 1, py0 + 1 + bob, 2, 3); cx.fillStyle = '#2b1e14'; cx.fillRect(px0 + 1, py0 + bob, 2, 1); }
      [[8, '#2b5bd8'], [60, '#d8342b'], [132, '#f7c646'], [184, '#2b5bd8']].forEach(([fx, fc]) => { cx.fillStyle = '#4a2a14'; cx.fillRect(fx, 30, 1, 14); cx.fillStyle = fc; for (let r = 0; r < 5; r++) cx.fillRect(fx + 1, 30 + r, 5 - Math.abs(r - 2), 1); });
      cx.fillStyle = '#b98a50'; cx.fillRect(0, 44, Wc, 1);
      const zs = PX.char(ZASUUL, 0, Math.floor(ts / 900) % 2 && st.over ? 1 : 0); cx.fillStyle = 'rgba(40,20,0,.25)'; cx.fillRect(167, ground - 1, 12, 2); cx.drawImage(zs, 165, ground - 28);
      const f = Math.floor(ts / 260) % 2, o = Math.round(st.off), ent = Math.min(1, (ts - st.intro) / 600);
      const myPose = st.pose[0], opPose = st.pose[1];
      const A = PX.wrestler(RED, mySkin, myPose === 'grip' && f && st.phase === 'timing' ? 'push' : myPose, st.phase === 'devee' ? st.devee.f : f), B = PX.wrestler(BLUE, oppSkin, opPose, f);
      const cxm = 92, ax = Math.round(cxm - 30 - (1 - ent) * 24) + o + (myPose === 'dance' ? -12 : 0), bx = Math.round(cxm - 4 + (1 - ent) * 24) + o + (opPose === 'dance' ? 12 : 0);
      const draw1 = (img, X, flip, dy = 0) => { const Y = ground - img.height + dy; cx.fillStyle = 'rgba(40,20,0,.28)'; cx.fillRect(X + 4, ground - 1, img.width - 8, 2); if (flip) { cx.save(); cx.translate(X + img.width, Y); cx.scale(-1, 1); cx.drawImage(img, 0, 0); cx.restore(); } else cx.drawImage(img, X, Y); };
      const cross = st.end && !st.left ? clamp((ts - st.end - 1100) / 1600, 0, 1) : 0;
      if (cross > 0) {   // custom: the fallen wrestler gets up and passes under the winner's raised arm
        const won = myPose === 'dance', win = PX.wrestler(won ? RED : BLUE, won ? mySkin : oppSkin, 'dance', cross < 1 ? 1 : f), lose = PX.wrestler(won ? BLUE : RED, won ? oppSkin : mySkin, 'idle', 0);
        const from = won ? bx : ax, to = won ? ax - 26 : bx + 26;
        draw1(win, won ? ax : bx, !won); draw1(lose, Math.round(from + (to - from) * cross), won, 2);
      } else {
        draw1(A, ax - (myPose === 'fall' ? 16 : 0), false);
        draw1(B, bx + (opPose === 'fall' ? 2 : 0), true);
      }
      if (st.flash && ts - st.flash.t0 < 1300) {   // the technique's name pops up over the ring
        const q = (ts - st.flash.t0) / 1300, fy = 60 - q * 10;
        cx.font = '700 12px Rubik, sans-serif'; cx.textAlign = 'center'; cx.globalAlpha = q > 0.75 ? (1 - q) * 4 : 1;
        cx.fillStyle = '#2b1e2e'; cx.fillText(st.flash.text, 97, fy + 1); cx.fillText(st.flash.text, 96, fy + 1);
        cx.fillStyle = st.flash.good ? '#f7c646' : '#ffffff'; cx.fillText(st.flash.text, 96, fy); cx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    function startSkill(id) {
      const type = SKILL[id] || 'timing'; st.t0 = performance.now();
      if (coach) rc(coach, h('b', null, '💡 ', moveLabel(id)), h('p', null, tx(R.MOVES.find((m) => m.id === id).kid)), h('p', null, `${SKILL_ICON[type]} ${tx(SKILL_KID[type].how)}`));
      if (type === 'timing') { setPhase('timing'); msg.textContent = L('Ногоон хэсэгт хүрэхэд дар!', 'Press when the marker is in the green!'); return; }
      const sk = st.skill = { type, t0: performance.now(), el: {} };
      if (type === 'combo') { sk.seq = Array.from({ length: 3 + Math.min(2, Math.floor(rnd / 4)) }, () => Math.floor(Math.random() * 4)); sk.i = 0; sk.err = 0; sk.limit = Math.max(3400, 5600 - rnd * 180) * (young ? 1.2 : 1); }
      if (type === 'mash') { sk.n = 0; sk.need = 7 + Math.ceil(rnd * 0.6) - (young ? 1 : 0); sk.limit = 2900; }
      if (type === 'hold') { sk.held = false; sk.v = 0; sk.zc = 0.78; sk.zw = (young ? 0.3 : 0.26) / sharp; }
      if (type === 'balance') { sk.x = 0; sk.vx = 0; sk.push = 0; sk.dir = 0; sk.good = 0; sk.limit = 2800; }
      grunt('huff', 1.1); setTimeout(() => grunt('step'), 120);
      setPhase('skill'); renderSkill();
      msg.textContent = { combo: L('Хөлийн хөдөлгөөн! Сумнуудыг дарааллаар нь хурдан дар.', 'Footwork! Press the arrows in order, quickly.'), mash: L('Бүх хүчээ гарга! Хурдан, олон дар!', 'All your strength! Tap as fast as you can!'),
        hold: L('Барьцаа ав: дарж байгаад шар хэсэгт хүрэхэд тавь.', 'Take the grip: hold, and let go in the yellow zone.'), balance: L('Тэнцвэрээ хадгал! Зүү голдоо байлгах гэж ← → дар.', 'Keep your balance! Use ← → to keep the needle in the middle.') }[type];
    }
    function renderSkill() {
      const sk = st.skill; if (!sk) return;
      const meter = (cls) => { const fill = h('i'); sk.el.fill = fill; return h('div', { class: 'v-wr-bar ' + (cls || '') }, fill); };
      if (sk.type === 'combo') rc(skillBox, h('div', { class: 'v-wr-combo' }, sk.seq.map((a, i) => h('span', { class: 'v-wr-arrow' + (i < sk.i ? ' ok' : i === sk.i ? ' next' : '') }, ARROWS[a]))), meter('time'),
        h('div', { class: 'v-wr-pad' }, ARROWS.map((a, i) => h('button', { class: 'btn', onclick: () => comboInput(i) }, a))));
      else if (sk.type === 'mash') { const b = h('button', { class: 'btn primary big block', onclick: () => mashTap() }, L(`Хүч! ${sk.n}/${sk.need}`, `Power! ${sk.n}/${sk.need}`)); sk.el.btn = b; rc(skillBox, meter('power'), b); }
      else if (sk.type === 'hold') { const b = h('button', { class: 'btn primary big block', onpointerdown: (e) => { e.preventDefault(); holdDown(); }, onpointerup: () => holdUp(), onpointerleave: () => sk.held && holdUp() }, L('Барих: дарж байгаад тавих (Space)', 'Grip: hold, then let go (Space)'));
        rc(skillBox, h('div', { class: 'v-wr-bar hold' }, h('i', { class: 'v-wr-zone', style: { left: (sk.zc - sk.zw / 2) * 100 + '%', width: sk.zw * 100 + '%' } }), (sk.el.fill = h('i', { class: 'v-wr-fill' }))), b); }
      else if (sk.type === 'balance') { const needle = h('i', { class: 'v-wr-needle' }); sk.el.needle = needle; const btn = (d, t) => h('button', { class: 'btn big', onpointerdown: (e) => { e.preventDefault(); sk.dir = d; }, onpointerup: () => { sk.dir = 0; }, onpointerleave: () => { if (sk.dir === d) sk.dir = 0; } }, t);
        rc(skillBox, h('div', { class: 'v-wr-bar balance' }, h('i', { class: 'v-wr-zone', style: { left: '37.5%', width: '25%' } }), needle), meter('time'), h('div', { class: 'v-wr-pad two' }, btn(-1, '◀'), btn(1, '▶'))); }
    }
    function comboInput(i) {
      const sk = st.skill; if (!sk || sk.type !== 'combo' || st.phase !== 'skill') return;
      if (sk.seq[sk.i] === i) { sk.i++; grunt('step'); TG.sfx.tick ? TG.sfx.tick() : TG.sfx.tap(); if (sk.i >= sk.seq.length) { const q = (performance.now() - sk.t0) / sk.limit; return lock(clamp(0.45 + 0.55 * (1 - q) - 0.15 * sk.err, 0.05, 1)); } }
      else { sk.err++; TG.sfx.bad(); }
      renderSkill();
    }
    function mashTap() { const sk = st.skill; if (!sk || sk.type !== 'mash' || st.phase !== 'skill') return; sk.n++; TG.sfx.tap(); if (sk.n % 3 === 0) grunt('effort', 1 + sk.n * 0.015); if (sk.el.btn) sk.el.btn.textContent = L(`Хүч! ${sk.n}/${sk.need}`, `Power! ${sk.n}/${sk.need}`); }
    function holdDown() { const sk = st.skill; if (!sk || sk.type !== 'hold' || st.phase !== 'skill' || sk.held) return; sk.held = true; sk.v = 0; grunt('strain'); }
    function holdUp() { const sk = st.skill; if (!sk || sk.type !== 'hold' || !sk.held) return; sk.held = false; lock(clamp(1 - Math.abs(sk.v - sk.zc) * 3.2 * sharp, 0, 1)); }
    function skillTick(dt, ts) {
      const sk = st.skill; if (!sk || st.phase !== 'skill') return;
      const el = ts - sk.t0;
      if (sk.type === 'combo') { if (sk.el.fill) sk.el.fill.style.width = Math.max(0, 100 - (el / sk.limit) * 100) + '%'; if (el > sk.limit) lock((sk.i / sk.seq.length) * 0.5); }
      else if (sk.type === 'mash') { if (sk.el.fill) sk.el.fill.style.width = Math.min(100, (sk.n / sk.need) * 100) + '%'; if (el > sk.limit) lock(Math.min(1, sk.n / sk.need)); }
      else if (sk.type === 'hold') { if (sk.held) { sk.v += dt / (young ? 1.9 : 1.6); if (sk.v > 1) { sk.v = 0; msg.textContent = L('Хэт удаан барилаа! Дахиад.', 'Held too long! Again.'); } } if (sk.el.fill) sk.el.fill.style.width = sk.v * 100 + '%'; if (el > 6000) lock(0.1); }
      else if (sk.type === 'balance') {
        sk.push += (Math.random() - 0.5) * dt * (4.5 + rnd * 0.7); sk.push = clamp(sk.push, -1.3, 1.3);   // your opponent shoves you this way and that
        if (Math.random() < dt * 1.2) grunt('huff', 0.85);
        sk.vx += (sk.push * (0.85 + rnd * 0.08) + sk.dir * 4.6) * dt; sk.vx *= 0.92; sk.x = clamp(sk.x + sk.vx * dt, -1, 1);
        if (Math.abs(sk.x) < 0.25) sk.good += dt * 1000;
        if (sk.el.needle) sk.el.needle.style.left = (50 + sk.x * 48) + '%'; if (sk.el.fill) sk.el.fill.style.width = Math.max(0, 100 - (el / sk.limit) * 100) + '%';
        if (el > sk.limit) lock(clamp((sk.good / sk.limit) * 1.15, 0, 1));
      }
    }
    function deveeOnBeat(ts) { const q = ((ts - st.devee.t0) % DEVEE_BEAT) / DEVEE_BEAT; return q < 0.2 || q > 0.84; }
    // first person: you face your opponent up close, your red sleeves gripping his zodog, the crowd all round the ring
    let fallAnim = 0, lastScore = 0;
    function drawFP(ts) {
      const Wc = 192, Hc = 108, f = Math.floor(ts / 260) % 2, sway = Math.sin(ts / 420) * 3 + st.off * 0.4;
      const iFell = st.over && st.pose[0] === 'fall', heFell = st.over && st.pose[1] === 'fall';
      if (st.a + st.b !== lastScore) { lastScore = st.a + st.b; fallAnim = ts; }
      const hit = ts - fallAnim < 450 ? 1 - (ts - fallAnim) / 450 : 0, scored = st.flash && st.flash.good;
      cx.save(); cx.imageSmoothingEnabled = false;
      if (iFell) { const q = clamp((ts - st.end) / 700, 0, 1); cx.translate(Wc / 2, Hc / 2); cx.rotate(q * 0.5); cx.translate(-Wc / 2, -Hc / 2 + q * 30); }
      else if (hit && !scored) cx.translate(Math.round(Math.sin(ts / 30) * 3 * hit), Math.round(hit * 2));   // you were thrown off balance
      cx.fillStyle = '#9fd8f7'; cx.fillRect(-20, -40, Wc + 40, 70); cx.fillStyle = '#c4e6fb'; cx.fillRect(-20, 6, Wc + 40, 8);
      cx.fillStyle = '#5a361c'; cx.fillRect(-20, 14, Wc + 40, 22);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 40; i++) { const px0 = -8 + i * 5 + (row % 2) * 2, py0 = 15 + row * 7, bob = Math.floor(ts / 300 + i * 1.7 + row) % 4 === 0 ? -1 : 0; cx.fillStyle = ['#d8342b', '#2b5bd8', '#f7c646', '#2ea35f', '#ffffff', '#9466e0'][(i * 3 + row) % 6]; cx.fillRect(px0, py0 + 3 + bob, 4, 3); cx.fillStyle = (i + row) % 3 ? '#edbb93' : '#c98a5a'; cx.fillRect(px0 + 1, py0 + bob, 2, 3); }
      [[6, '#2b5bd8'], [70, '#d8342b'], [120, '#f7c646'], [182, '#2b5bd8']].forEach(([fx, fc]) => { cx.fillStyle = '#4a2a14'; cx.fillRect(fx, 22, 1, 18); cx.fillStyle = fc; for (let r = 0; r < 5; r++) cx.fillRect(fx + 1, 22 + r, 6 - Math.abs(r - 2), 1); });
      cx.fillStyle = '#e8c994'; cx.fillRect(-20, 36, Wc + 40, 90); cx.fillStyle = '#d4ae72'; for (let i = -6; i <= 6; i++) { cx.beginPath(); cx.moveTo(96 + i * 6, 36); cx.lineTo(96 + i * 40, Hc + 10); cx.lineTo(97 + i * 40, Hc + 10); cx.lineTo(97 + i * 6, 36); cx.fill(); }
      const zs = PX.char(ZASUUL, 0, 0); cx.drawImage(zs, 150, 18, 12, 21);                                               // the zasuul watching from the side
      // your opponent
      const opp = PX.wrestlerFront(BLUE, oppSkin, st.phase === 'devee' ? (st.devee && st.devee.f) || f : f), sc = 2;
      cx.save(); cx.translate(Math.round(96 + sway), 16 + 112);
      if (heFell) { const q = clamp((ts - st.end) / 650, 0, 1); cx.rotate(-q * 1.35); cx.translate(0, q * 40); }
      else if (hit && scored) cx.rotate(-hit * 0.35);                                                                      // he staggers from your move
      cx.drawImage(opp, -20 * sc, -56 * sc, 40 * sc, 56 * sc); cx.restore();
      // your arms gripping his sleeves (raised and flapping during the eagle dance, up in victory)
      const dance = st.phase === 'devee' || (st.over && !iFell), up = dance ? (st.devee && st.devee.f) || f : 0;
      const arm = (side) => { const bx = side < 0 ? 18 : 174, tx = dance ? (side < 0 ? 30 : 162) : 96 + sway + side * 26, ty = dance ? (up ? 20 : 34) : 64;
        cx.fillStyle = '#2b1e2e'; cx.beginPath(); cx.moveTo(bx - 14, Hc + 4); cx.lineTo(tx - 7, ty - 1); cx.lineTo(tx + 7, ty - 1); cx.lineTo(bx + 14, Hc + 4); cx.fill();
        cx.fillStyle = RED; cx.beginPath(); cx.moveTo(bx - 12, Hc + 4); cx.lineTo(tx - 5, ty + 1); cx.lineTo(tx + 5, ty + 1); cx.lineTo(bx + 12, Hc + 4); cx.fill();
        cx.fillStyle = '#f7c646'; cx.fillRect(Math.round(tx - 6), Math.round(ty + 2), 12, 2);
        cx.fillStyle = mySkin; cx.fillRect(Math.round(tx - 5), Math.round(ty - 6), 10, 7); cx.fillStyle = '#2b1e2e'; cx.fillRect(Math.round(tx - 5), Math.round(ty - 7), 10, 1); };
      arm(-1); arm(1);
      if (st.flash && ts - st.flash.t0 < 1300) {
        const q = (ts - st.flash.t0) / 1300, fy = 50 - q * 10;
        cx.font = '700 13px Rubik, sans-serif'; cx.textAlign = 'center'; cx.globalAlpha = q > 0.75 ? (1 - q) * 4 : 1;
        cx.fillStyle = '#2b1e2e'; cx.fillText(st.flash.text, 97, fy + 1); cx.fillStyle = st.flash.good ? '#f7c646' : '#ffffff'; cx.fillText(st.flash.text, 96, fy); cx.globalAlpha = 1;
      }
      cx.restore();
    }
    function deveeTap() {
      const d = st.devee; if (st.phase !== 'devee' || d.n >= DEVEE_TAPS) return;
      const good = deveeOnBeat(performance.now());
      feathers[d.n].classList.add(good ? 'good' : 'miss'); d.n++; d.f ^= 1; if (good) d.good++;
      if (good) TG.sfx.chime(); else TG.sfx.tap();
      grunt('clap'); // the eagle dance: arms spread, palms slap the thighs
      if (d.n < DEVEE_TAPS) return;
      st.bonus = d.good * 0.06;
      msg.textContent = d.good >= 3 ? L(`Гоё дэвлээ! Бүргэд шиг! Эхний мэх +${Math.round(st.bonus * 100)}% хүчтэй.`, `Beautiful dance, like an eagle! First move +${Math.round(st.bonus * 100)}% power.`)
        : d.good ? L(`Дэвээ дууслаа. Эхний мэх +${Math.round(st.bonus * 100)}% хүчтэй.`, `Dance done. First move +${Math.round(st.bonus * 100)}% power.`) : L('Дэвээ хэмнэлээсээ алдлаа. Одоо барилдъя!', 'The dance was off the beat. Now wrestle!');
      setTimeout(() => { if (st.over) return; st.pose = ['grip', 'grip']; herald.remove(); setPhase('choose'); }, 900);
    }
    function lock(given) {
      if (st.phase !== 'timing' && st.phase !== 'skill') return;
      herald.remove(); st.skill = null;
      grunt('effort'); setTimeout(() => grunt('effort', 0.82), 160); // both wrestlers heave
      let power = typeof given === 'number' ? given : Math.max(0, 1 - Math.abs(st.marker - 0.5) * 2 * sharp);
      if (st.bonus) { power = Math.min(1, power + st.bonus); st.bonus = 0; } // the eagle dance's power
      const repeated = st.move === st.lastPlayer;
      if (repeated) power *= 0.8; // the same move twice in a row is easier to read
      st.used[st.move] = (st.used[st.move] || 0) + 1;
      setPhase('wait');
      if (cfg.ai) {
        // the opponent studies you: in later rounds it often picks a move that beats the one you use most
        const fav = Object.entries(st.used).sort((a2, b2) => b2[1] - a2[1])[0][0];
        const read = repeated ? st.move : (Math.random() < 0.5 ? st.lastPlayer : fav);
        const smart = read && Math.random() < Math.min(0.5, 0.03 + cfg.round * 0.05);
        const counters = R.MOVES.filter((q) => q.beats.includes(read));
        const om = smart && counters.length ? TG.pick(counters).id : TG.pick(R.MOVES).id;
        const op = clamp(cfg.opp.skill + (Math.random() - 0.5) * Math.max(0.18, 0.5 - cfg.round * 0.035), 0.05, 1);
        apply(R.exchange(st.move, power, om, op), st.move, power, om, op);
      } else { cfg.remote.mine = { m: st.move, p: power }; net.send({ t: 'wr-move', m: st.move, p: +power.toFixed(2) }); msg.textContent = L('Өрсөлдөгчийг хүлээж байна…', 'Waiting for your opponent…'); }
    }
    function apply(r, mm, mp, om, op) {
      const wasRepeat = mm === st.lastPlayer;
      st.lastPlayer = mm; if (r) st.lastMove = r > 0 ? mm : om;
      if (r > 0) grunt('oof', 0.82); else if (r < 0) grunt('oof', 1.08); else grunt('huff');
      if (r > 0) { st.a++; TG.sfx.good(); const wr = V().wr; wr.techs = wr.techs || {}; wr.techs[mm] = (wr.techs[mm] || 0) + 1; S.save(); } else if (r < 0) { st.b++; TG.sfx.bad(); } else TG.sfx.tap();
      st.flash = { text: (r >= 0 ? moveLabel(mm) : moveLabel(om)).toUpperCase() + '!', good: r > 0, t0: performance.now() };
      if (wasRepeat && r < 0) setTimeout(() => { if (!st.over) msg.textContent += ' ' + L('(Давтсан мэхийг өрсөлдөгч таньчихлаа!)', '(They saw your repeated move coming!)'); }, 30);
      st.target = clamp((st.a - st.b) * 12, -26, 26) + (r > 0 ? 6 : r < 0 ? -6 : 0);
      setTimeout(() => { st.target = clamp((st.a - st.b) * 12, -26, 26); }, 260);
      msg.textContent = `${moveLabel(mm)} ${Math.round(mp * 100)}%  ·  ${moveLabel(om)} ${Math.round(op * 100)}%  →  ` + (r > 0 ? L('Та давууллаа!', 'You gain the upper hand!') : r < 0 ? L('Өрсөлдөгч давууллаа!', 'Your opponent gains!') : L('Тэнцлээ!', 'Even!'));
      drawScore();
      if (cfg.ai) { if (st.a >= need || st.b >= need) setTimeout(() => finish(st.a > st.b), 900); else setTimeout(() => { if (!st.over) { setPhase('choose'); } }, 1100); }
      else if (!(st.a >= 2 || st.b >= 2)) setTimeout(() => { if (!st.over) setPhase('choose'); }, 1100);
    }
    function finish(won, reason) {
      if (st.over) return; st.over = true; setPhase('done'); herald.remove();
      st.pose = won ? ['dance', 'fall'] : ['fall', 'dance']; st.target = won ? 18 : -18; st.end = performance.now(); st.left = !!reason;
      if (won) { TG.sfx.win(); TG.confetti(60); } else TG.sfx.bad();
      grunt('crowd'); // the crowd shouts “uukhai!”
      const res = onEnd ? onEnd(won) || {} : {};
      const t = res.newTitle && titleObj(res.newTitle);
      const part = st.lastMove && WR_PART[st.lastMove] ? tx(WR_PART[st.lastMove]) : null;
      const touch = part ? (won ? L(`Өрсөлдөгчийн ${part} газарт хүрлээ! `, `Their ${part} touched the ground! `) : L(`Таны ${part} газарт хүрлээ. `, `Your ${part} touched the ground. `)) : '';
      msg.textContent = reason === 'left' ? L('Өрсөлдөгч гарчихлаа. Та яллаа!', 'Your opponent left. You win!') : touch + (won ? L('Та яллаа! Бүргэд шиг дэвээрэй! 🦅', 'You won! Do the eagle dance! 🦅') : L('Уналаа… Дараагийн удаа заавал ялна!', 'You fell… you will win next time!'));
      rc(tail,
        reason ? null : h('div', { class: 'teach' }, h('b', null, '🇲🇳 ', L('Бөхийн ёс', 'Wrestling custom')), h('p', null, won
          ? L('Унасан бөх ялсан бөхийн суган доогуур гарч хүндэтгэл үзүүлдэг. Ялсан бөх дараа нь тугаа тойрон дэвдэг.', 'The fallen wrestler passes under the winner\'s arm as a sign of respect. The winner then dances around the flag.')
          : L('Унасан бөх ялсан бөхийн суган доогуур гарч хүндэтгэл үзүүлдэг. Ялагдсан ч хүндэтгэлтэй байх нь бөхийн ёс.', 'The fallen wrestler passes under the winner\'s arm as a sign of respect. Losing with honour is the wrestler\'s way.'))),
        t ? h('div', { class: 'v-zasuul' }, h('b', null, '📣 ', L('Засуул', 'Herald'), ': '), L(`«Хүчит бөх ${live.name} ${tx(t.name)} цол хүртлээ!»`, `"The mighty wrestler ${live.name} earns the ${tx(t.name)} title!"`), h('p', null, tx(t.fact))) : null,
        res.champion ? h('div', { class: 'v-zasuul' }, '🏆 ', L('Та Наадамд түрүүллээ!', 'You won the whole Naadam!')) : null,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')),
          cfg.practice ? [h('button', { class: 'btn', onclick: () => { close(); practiceBout(); } }, '🔁 ', L('Дахиад', 'Again')), h('button', { class: 'btn primary', onclick: () => { close(); tournament(1); } }, L('Жинхэнэ барилдаан', 'Wrestle for real'), ' ▶')]
          : cfg.ai ? (won && cfg.round < 9 ? h('button', { class: 'btn primary', onclick: () => { close(); tournament(cfg.round + 1); } }, L('Дараагийн даваа', 'Next round'), ' ▶')
            : h('button', { class: 'btn primary', onclick: () => { close(); tournament(1); } }, L('Шинэ Наадам', 'New Naadam'))) : null));
      if (cfg.remote && live) live.match = null;
    }
    const key = (e) => {
      if (document.querySelectorAll('.modal-back').length > 1) return;
      const down = e.type === 'keydown', sk = st.phase === 'skill' && st.skill;
      if (sk && sk.type === 'combo' && ARROW_KEY[e.code] !== undefined) { e.preventDefault(); e.stopPropagation(); if (down && !e.repeat) comboInput(ARROW_KEY[e.code]); return; }
      if (sk && sk.type === 'balance' && ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1; if (down) sk.dir = d; else if (sk.dir === d) sk.dir = 0; return; }
      if (e.code !== 'Space' && e.code !== 'KeyE') return;
      e.preventDefault(); e.stopPropagation();
      if (sk && sk.type === 'hold') { if (down && !e.repeat) holdDown(); else if (!down) holdUp(); return; }
      if (!down || e.repeat) return;
      if (st.phase === 'devee') deveeTap(); else if (sk && sk.type === 'mash') mashTap(); else if (st.phase === 'timing') lock();
    };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
    goBtn.addEventListener('click', lock);
    if (cfg.remote) cfg.remote.ui = (m) => {
      if (m.t === 'wr-wait' && st.phase !== 'wait') msg.textContent = L('Өрсөлдөгч бэлэн боллоо!', 'Your opponent is ready!');
      if (m.t === 'wr-result') { const mineA = cfg.remote.side === 'a'; apply(mineA ? m.r : -m.r, mineA ? m.ma : m.mb, mineA ? m.pa : m.pb, mineA ? m.mb : m.ma, mineA ? m.pb : m.pa); }
      if (m.t === 'wr-end') setTimeout(() => finish(m.winner === v.id, m.reason), m.reason ? 0 : 900);
    };
    drawScore();
    if (st.devee) { st.pose = ['dance', 'dance']; setPhase('devee'); msg.textContent = L('Дэвээ! Товч гэрэлтэх үед дарж бүргэд шиг дэв (4 удаа).', 'Eagle dance! Tap when the button glows (4 times).'); }
    else setPhase('choose');
    const close = TG.modal(body, { cls: 'v-modal', onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true); if (cfg.remote && !st.over) { net.send({ t: 'wr-quit' }); if (live) live.match = null; } } });
    raf = requestAnimationFrame(loop);
  }
  function onWrestleMsg(m) {
    const v = V();
    if (m.t === 'wr-invite') {
      const close = TG.modal(h('div', { class: 'center' }, wrestlerPic('dance', BLUE, 56), h('h2', null, L('Барилдах урилга!', 'Wrestling challenge!')),
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
    const close = TG.modal(h('div', null, h('div', { class: 'v-fact-e' }, TG.basar.face(0, 80)), h('h2', null, L(`Вуф! Сайн уу, ${live ? live.name : ''}!`, `Woof! Hi ${live ? live.name : ''}!`)),
      h('p', null, L('Би Басар, монгол банхар нохой. Нутагт үргэлж хажууд чинь явна. Намайг дарж эсвэл B товчоор юу ч асуугаарай!', 'I’m Basar, a Mongolian Bankhar dog. I’ll walk beside you everywhere in Nutag. Tap me or press B to ask me anything!')),
      h('div', { class: 'v-list' }, [
        ['ui:star', L('Газар дээр дарж алх. Компьютер дээр сум эсвэл WASD товч.', 'Tap the ground to walk. On a computer use arrows or WASD.')],
        ['beast:cow', L('Хот айлд үнээ, ямаа, гүүгээ саагаад ааруул, өрөм, тараг, айраг хий.', 'In the dairy yard milk the cows, goats and mares, then make aaruul, öröm, tarag and airag.')],
        ['ui:book', L('Сургуулийн гэрт гэр барих, цагаан идээ хийх, Нууц товчоог сур. Сурснаа гэр бүлтэйгээ хий!', 'In the school ger learn to build a ger, make dairy foods and hear the Secret History. Then do it with your family!')],
        ['ui:ger', L('Гэр барих хичээлээ дуусгаад Нутагт өөрийн гэрээ бариарай.', 'Finish the ger lesson, then build your own ger in Nutag.')],
        ['ui:horse', L('Морины уяанаас морь унаж давхих, эсвэл уралдаанд оролцоорой!', 'Take a horse from the horse line to ride freely or race!')],
        ['ui:heart', L('Нэг өрөөний найзууд нэг нутагт хамт тоглож, барилдаж, морь уралдана.', 'Friends in the same room play in one village, wrestle and race together.')],
      ].map(([e, t]) => h('div', { class: 'v-row' }, icon(e), h('div', { class: 'v-row-b' }, t)))),
      h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => close() }, L('Эхлэх', "Let's go"))), { cls: 'v-modal', onClose: () => { const v = V(); if (v) { v.tips = true; S.save(); } } });
  }
})(window.TG);
