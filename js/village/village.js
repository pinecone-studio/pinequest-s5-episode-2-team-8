/* Нутаг — the shared village: walk, garden together, fish, shop, dress up, quests, live multiplayer. */
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
    const d = { id: 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), xp: 0, coins: 40, seeds: { carrot: 4, potato: 2 }, produce: {}, fish: {},
      owned: ['deel-blue'], look: { deel: 'blue', skin: R.SKINS[0], hat: null, face: null, neck: null, pet: null }, can: 5, water: 5, rod: 1, room: 'NUTAG',
      garden: [], quests: { d: '', list: [] }, pets: {}, seen: {}, tips: false, pos: null,
      energy: 100, ate: {}, lots: [], wr: { best: 0, champ: 0, wins: 0, losses: 0, pvpW: 0, pvpL: 0, techs: {} }, ovoo: '', horse: { coat: 'bay', races: 0, wins: 0, top5: 0, best: 0, dist: 0 } };
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
    setTimeout(() => TG.achievements && TG.achievements.check(), 0);
    return { coins, xp, level: after > before ? after : 0 };
  }
  const QUESTS = {
    water: { n: 5, c: 20, x: 25, t: Tx('5 ургамал услах', 'Water 5 plants') },
    harvest: { n: 3, c: 25, x: 30, t: Tx('3 ургац хураах', 'Harvest 3 crops') },
    plant: { n: 4, c: 15, x: 20, t: Tx('4 үр тарих', 'Plant 4 seeds') },
    fish: { n: 2, c: 25, x: 30, t: Tx('2 загас барих', 'Catch 2 fish') },
    basar: { n: 2, c: 15, x: 25, t: Tx('Басараас 2 асуулт асуух', 'Ask Basar 2 questions') },
    quiz: { n: 3, c: 25, x: 35, t: Tx('Басарын 3 асуултад зөв хариулах', 'Answer 3 of Basar’s questions right') },
    lesson: { n: 1, c: 30, x: 40, t: Tx('Өв соёлын 1 хичээл дуусгах', 'Finish 1 heritage lesson') },
    together: { n: 1, c: 40, x: 50, t: Tx('Гэр бүлтэйгээ бодит ажил хийх', 'Do a real activity with family') },
    pet: { n: 3, c: 10, x: 20, t: Tx('Хонийг 3 удаа илбэх', 'Pet the sheep 3 times') },
    sell: { n: 5, c: 15, x: 20, t: Tx('5 зүйл зарах', 'Sell 5 items') },
    help: { n: 2, c: 30, x: 40, t: Tx('Найзынхаа ургамлыг 2 удаа услах', "Water a friend's plants twice") },
    race: { n: 1, c: 25, x: 35, t: Tx('Морин уралдаанд 1 удаа оролцох', 'Ride in 1 horse race') },
    archery: { n: 3, c: 25, x: 35, t: Tx('Сур харваанд 3 бай онох', 'Hit 3 archery targets') },
    wrestle: { n: 1, c: 25, x: 35, t: Tx('Бөхийн барилдаанд 1 удаа давах', 'Win 1 wrestling round') },
    etiquette: { n: 1, c: 30, x: 40, t: Tx('Эмээгийн гэрт ёсоор зочлох', 'Visit Grandma’s ger with good manners') },
    eat: { n: 3, c: 15, x: 20, t: Tx('3 удаа хоол идэх, ундаа уух', 'Eat or drink 3 times') },
  };
  const POOL = ['water', 'harvest', 'plant', 'fish', 'basar', 'quiz', 'pet', 'sell', 'basar', 'quiz', 'eat'];
  function quests() {
    const v = V(), d = S.dkey();
    if (v.quests.d !== d || v.quests.list.some((q) => !QUESTS[q.k])) { // new day, or quests from an older version
      let hs = 0; for (const ch of d + v.id) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = [...POOL], pick = [];
      while (pick.length < 3) { hs = (hs * 1103515245 + 12345) >>> 0; const k = pool.splice(hs % pool.length, 1)[0]; if (!pick.includes(k)) pick.push(k); }
      pick.push('help');
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
  TG._village = { live: () => live, act: (...a) => act(...a), goTo: (...a) => goTo(...a), lots: () => lotsArr(), buyLot: (i, roof, door) => net.send({ t: 'ger-buy', i, roof, door }), invite: (id) => net.send({ t: 'wr-invite', to: id }), context: () => contextAction(), arena: () => arenaModal(), tournament: (r) => tournament(r), dog: () => live && live.dog, lot: (i) => lotAction(i), archery: () => archeryGame(), emee: () => emeeVisit(), npc: (id) => npcTalk(id), enterGer: (i) => enterGer(i), mount: (c) => mount(c), dismount: () => dismount(), race: (c) => raceStart(c), raceState: () => live && live.race }; // used by automated tests
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
  /** Eat or drink something: costs coins (free for your own harvest, at home or when a family offers it), fills energy, teaches a fact. */
  function eat(id, opts = {}) {
    const v = V(); if (!v) return false;
    const crop = R.CROPS[id], f = crop ? { id, e: crop.e, kind: 'veg', name: crop.name, energy: 12, price: 0, fact: crop.fact } : food(id);
    if (!f) return false;
    if (crop) { if (!(v.produce[id] > 0)) return false; v.produce[id]--; }
    const cost = crop || opts.free ? 0 : f.price;
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
      const crops = Object.keys(R.CROPS).filter((k) => v.produce[k] > 0);
      const list = cur === 'veg' ? [...crops.map((k) => ({ crop: k })), ...FOODS.filter((f) => f.kind === 'veg')] : FOODS.filter((f) => f.kind === cur);
      const free = (f) => opts.home && (f.kind === 'milk' || f.kind === 'drink');
      rc(body, h('h2', null, '🍽️ ', L('Хоол, ундаа', 'Food & drink')),
        h('p', { class: 'muted' }, L(`Хүч: ${Math.round(v.energy ?? ENERGY_MAX)}/${ENERGY_MAX} 🍖. Shift дарж гүйхэд хүч зарцуулагдана, хоол идвэл нөхөгдөнө.`, `Energy: ${Math.round(v.energy ?? ENERGY_MAX)}/${ENERGY_MAX} 🍖. Running (Shift) uses energy; food fills it up.`), opts.home ? h('b', null, ' ', L('Гэртээ цагаан идээ, ундаа үнэгүй!', 'At home, dairy and drinks are free!')) : null),
        h('div', { class: 'chips v-tabs' }, FOOD_TABS.map(([k, e, t]) => h('button', { class: 'chip' + (cur === k ? ' active' : ''), onclick: () => { cur = k; draw(); } }, e, ' ', tx(t)))),
        h('div', { class: 'v-list' }, list.length ? list.map((it) => {
          if (it.crop) { const cr = R.CROPS[it.crop]; return h('div', { class: 'v-row' }, h('span', { class: 'v-card-e' }, cr.e), h('div', { class: 'v-row-b' }, h('b', null, tx(cr.name), ' ', h('small', null, `×${v.produce[it.crop]} · ${L('өөрийн ургац', 'your harvest')}`)), h('small', null, '+12 🍖')), h('button', { class: 'btn sm primary', onclick: () => { if (eat(it.crop)) draw(); } }, L('Идэх', 'Eat'))); }
          const price = free(it) ? 0 : it.price;
          return h('div', { class: 'v-row' }, h('span', { class: 'v-card-e' }, it.e), h('div', { class: 'v-row-b' }, h('b', null, tx(it.name), v.ate && v.ate[it.id] ? '' : h('small', { class: 'v-new' }, ` ${L('шинэ', 'new')}`)), h('small', null, `+${it.energy} 🍖 · ${tx(it.fact)}`)),
            h('button', { class: 'btn sm primary', onclick: () => { if (eat(it.id, { free: free(it) })) draw(); } }, it.kind === 'drink' ? L('Уух', 'Drink') : L('Идэх', 'Eat'), price ? ` ${price}🪙` : ''));
        }) : h('p', { class: 'muted' }, L('Цэцэрлэгтээ ногоо тарьж хураавал энд идэж болно.', 'Grow and harvest vegetables in the garden to eat them here.'))),
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
      case 'jump': { const o = live.others.get(m.id); if (o) o.jt = performance.now(); break; }
      case 'look': { const o = live.others.get(m.id); if (o) { o.look = m.look; o.lvl = m.lvl; } break; }
      case 'say': {
        const who = m.id === v.id ? live.me : live.others.get(m.id);
        if (who) who.bubble = { text: m.k === 'e' ? R.EMOTES[m.i] : tx(R.PHRASES[m.i]), t0: performance.now() };
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
      water: h('div', { class: 'v-pill px-frame' }), energy: h('button', { class: 'v-pill px-frame v-energy', title: L('Хоол, ундаа', 'Food & drink'), onclick: () => eatModal() }), net: h('button', { class: 'v-pill px-frame v-net', onclick: () => roomModal() }),
      season: h('button', { class: 'v-pill px-frame v-season', onclick: () => TG.seasons.open() }),
      loc: h('button', { class: 'v-loc px-frame', onclick: () => TG.go('passport') }),
      ctx: h('button', { class: 'v-act px-frame hidden', onclick: () => { const a = contextAction(); if (a) doAction(a); } }),
      hotbar: h('div', { class: 'v-hotbar px-frame', role: 'toolbar', 'aria-label': L('Үр сонгох', 'Choose seeds') }),
      race: h('div', { class: 'v-race px-frame hidden', 'aria-live': 'polite' }),
      sprint: h('button', { class: 'v-sprint px-frame hidden', 'aria-label': L('Чү! (Shift)', 'Chü! (Shift)'),
        onpointerdown: (e) => { e.preventDefault(); if (live && live.race) live.race.sprint = true; }, onpointerup: () => { if (live && live.race) live.race.sprint = false; }, onpointerleave: () => { if (live && live.race) live.race.sprint = false; }, oncontextmenu: (e) => e.preventDefault() }, L('Чү!', 'Chü!')),
      horse: h('button', { class: 'v-round px-frame hidden', 'aria-label': 'horse', title: L('Мориноос буух', 'Get off the horse'), onclick: () => dismount() }, pic('ui:horse', 34)),
      mini: h('canvas', { class: 'v-mini px-frame', width: WD.W * 3, height: WD.H * 3, 'aria-label': L('Газрын зураг', 'Map'), title: L('Газрын зураг: дарж томруулна', 'Map: tap to enlarge') }),
      run: h('button', { class: 'v-run px-frame', 'aria-label': L('Гүйх', 'Run'), 'aria-pressed': 'false', title: L('Гүйх (Shift)', 'Run (Shift)'), onclick: () => { if (!live) return; live.runLock = !live.runLock; live.els.run.classList.toggle('on', live.runLock); live.els.run.setAttribute('aria-pressed', String(live.runLock)); TG.sfx.tap(); } }, '🏃'),
      jump: h('button', { class: 'v-jump px-frame', 'aria-label': L('Үсрэх', 'Jump'), title: L('Үсрэх (Space)', 'Jump (Space)'), onclick: () => jump() }, '⤒'),
      zoomIn: h('button', { class: 'v-zbtn px-frame', 'aria-label': L('Томруулах', 'Zoom in'), title: L('Томруулах (+)', 'Zoom in (+)'), onclick: () => zoom(1) }, '+'),
      zoomOut: h('button', { class: 'v-zbtn px-frame', 'aria-label': L('Жижигрүүлэх', 'Zoom out'), title: L('Жижигрүүлэх (−)', 'Zoom out (−)'), onclick: () => zoom(-1) }, '−'),
      music: h('button', { class: 'v-round px-frame v-music hidden', 'aria-label': L('Хөгжим', 'Music'), onclick: () => { TG.music.toggle(); } }),
    };
    const root = h('div', { class: 'village' }, canvas,
      h('div', { class: 'v-top' },
        h('button', { class: 'v-back px-frame', 'aria-label': L('Цэс', 'Menu'), onclick: () => TG.openMenu() }, pic('ui:menu', 26)),
        h('div', { class: 'v-mecol' }, els.me, els.loc, els.mini, h('div', { class: 'v-zoom' }, els.zoomOut, els.zoomIn)), h('div', { class: 'v-pills' }, els.coins, els.energy, els.water, els.season, els.net)),
      els.race,
      h('div', { class: 'v-bottom' },
        h('div', { class: 'v-tools' },
          els.horse,
          h('button', { class: 'v-round px-frame v-basar', 'aria-label': 'basar', title: L('Басар (B)', 'Basar (B)'), onclick: () => openBasar() }, pic('ui:dog', 34)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'learn', title: L('Сурах', 'Learn'), onclick: () => TG.go('learn') }, pic('ui:book', 32)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'bag', onclick: () => bag() }, pic('ui:bag', 32)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'talk', onclick: () => talk() }, pic('ui:chat', 32)),
          h('button', { class: 'v-round px-frame', 'aria-label': 'quests', onclick: () => questModal() }, pic('ui:scroll', 32)),
          els.music),
        els.hotbar, els.run, els.jump, els.ctx, els.sprint));
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
    live = { root, canvas, els, ctx: canvas.getContext('2d'), name: prof.name, status: 'connecting', online: false, offset: 0, plots: null, lots: null, room: v.room,
      me: { x: Math.floor(sp.x + 0.5), y: Math.floor(sp.y + 0.82), px: sp.x, py: sp.y, vx: 0, vy: 0, path: [], dir: 0, moving: false, bubble: null, petPos: { x: sp.x, y: sp.y + 0.6 }, sent: { x: sp.x, y: sp.y }, netT: 0, stuck: 0 },
      season: TG.seasons.current().id, fx: [], cam: { x: sp.x, y: sp.y }, dog: { x: sp.x + 0.7, y: sp.y + 0.2, moving: false, flip: false, idle: 0, bubble: null, nextFact: performance.now() + 25000 }, keys: new Set(), others: new Map(), pending: null, floaters: [], match: null,
      sheep: [[24, 20], [28, 22], [31, 20], [26, 23]].map(([x, y], i) => ({ i, x, y, px: x, py: y, next: 1 + i, flip: false })),
      raf: 0, last: performance.now(), view: {}, zoom: v.zoom || 0, ptrs: new Map(), pinch: null, terrain: WD.renderStatic(), buf: PX.mk(1, 1), ctxTimer: 0, sel: null };
    resize();
    document.fonts && document.fonts.load('10px Tiny5', 'Нутаг ӨҮ');
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onTap);
    canvas.addEventListener('pointermove', onPinch); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => canvas.addEventListener(ev, onPtrUp));
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', clearKeys);
    root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); }); // HUD buttons never keep focus
    live.miniBase = miniBase();
    els.mini.addEventListener('pointerdown', onMiniTap);
    net.connect(); hud(); updateCtx();
    live.unMusic = TG.music ? TG.music.onChange(() => hud()) : null;
    live.raf = requestAnimationFrame(frame);
    if (!v.tips) tips();
    setCleanup(stop);
  }
  const clearKeys = () => { if (live) { live.keys.clear(); live.run = false; } };
  function stop() {
    if (!live) return;
    live.race = null;
    cancelAnimationFrame(live.raf);
    window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', clearKeys);
    net.close();
    if (live.unMusic) live.unMusic();
    const v = V(); if (v) { v.pos = { x: +live.me.px.toFixed(2), y: +live.me.py.toFixed(2) }; v.energy = Math.round(v.energy * 10) / 10; S.save(); }
    live = null;
  }
  function resize() {
    if (!live) return;
    const cssW = live.root.clientWidth || innerWidth, cssH = live.root.clientHeight || innerHeight, dpr = Math.min(3, devicePixelRatio || 1);
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    live.canvas.width = devW; live.canvas.height = devH;
    const base = Math.max(1, Math.round(devW / ((cssW < 640 ? 11 : 24) * T)));
    // zoom = whole steps of the pixel scale (keeps the art crisp); never so far out that the map stops filling the screen
    const minK = Math.max(1, Math.ceil(devW / (WD.W * T)), Math.ceil(devH / (WD.H * T))), maxK = Math.max(minK, base * 2);
    const k = clamp(base + live.zoom, minK, maxK);
    live.zoom = k - base;
    live.els.zoomIn.disabled = k >= maxK; live.els.zoomOut.disabled = k <= minK;
    const bw = Math.ceil(devW / k), bh = Math.ceil(devH / k);
    live.buf.c.width = bw + 1; live.buf.c.height = bh + 1; live.buf.x.imageSmoothingEnabled = false; // +1 px so sub-pixel scrolling never shows an edge
    live.view = { devW, devH, dpr, k, bw, bh, cssW };
  }
  function zoom(d) {
    if (!live) return;
    const k0 = live.view.k; live.zoom += d; resize();
    if (live.view.k === k0) return;
    V().zoom = live.zoom; S.save(); TG.sfx.tap();
  }
  function onWheel(e) {
    e.preventDefault();
    if (!live || Math.abs(e.deltaY) < 1) return;
    const n = performance.now(); if (n - (live.wheelT || 0) < 120) return; // one step per wheel notch, not per trackpad tick
    live.wheelT = n; zoom(e.deltaY < 0 ? 1 : -1);
  }
  // two-finger pinch on touch screens
  const ptrDist = () => { const [a, b] = [...live.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  function onPinch(e) {
    if (!live || !live.ptrs.has(e.pointerId)) return;
    live.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!live.pinch || live.ptrs.size < 2) return;
    const r = ptrDist() / live.pinch;
    if (r > 1.25 || r < 0.8) { zoom(r > 1 ? 1 : -1); live.pinch = ptrDist(); }
  }
  function onPtrUp(e) { if (!live) return; live.ptrs.delete(e.pointerId); if (live.ptrs.size < 2) live.pinch = null; }
  /** Camera in art pixels, NOT rounded: rounding here made the view jump a whole art pixel (4–6 screen pixels). */
  function cam() {
    const { bw, bh } = live.view;
    return { x: clamp(live.cam.x * T + 8 - bw / 2, 0, WD.W * T - bw), y: clamp(live.cam.y * T + 4 - bh / 2, 0, WD.H * T - bh) };
  }

  // ---------------------------------------------------------------- HUD
  function hudEnergy() { if (!live) return; const en = Math.round(V().energy ?? 100); live.els.energy.textContent = `🍖 ${en}`; live.els.energy.classList.toggle('low', en < 20); }
  function hud() {
    if (!live) return;
    const v = V(), L1 = R.level(v.xp), e = live.els;
    rc(e.me, portrait(v.look, 30), h('span', { class: 'v-me-body' }, h('b', null, live.name), h('span', { class: 'v-lvl-row' }, h('span', { class: 'v-lvl' }, `${L('ТҮВ', 'LV')} ${L1.l}`), h('span', { class: 'v-xp' }, h('i', { style: { width: (L1.cur / L1.need) * 100 + '%' } })))));
    rc(e.coins, pic('ui:coin', 20), h('span', null, v.coins));
    rc(e.water, pic('ui:drop', 20), h('span', null, `${v.water}/${v.can}`));
    hudEnergy();
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
  function hotbar() {
    const v = V(), owned = Object.keys(R.CROPS).filter((k) => v.seeds[k] > 0);
    if (live.sel && !(v.seeds[live.sel] > 0)) live.sel = null;
    rc(live.els.hotbar, ...(owned.length ? owned.map((k) => h('button', { class: 'v-slot-btn' + (live.sel === k ? ' sel' : ''), title: tx(R.CROPS[k].name), 'aria-pressed': live.sel === k ? 'true' : 'false',
      onclick: () => { live.sel = live.sel === k ? null : k; TG.sfx.tap(); hotbar(); updateCtx(); } }, pic('crop:' + k, 28), h('small', null, v.seeds[k])))
      : [h('button', { class: 'v-slot-btn empty', onclick: () => shopModal('seeds') }, pic('ui:seed', 28), h('small', null, '+'))]));
  }
  function contextAction() {
    if (!live || live.me.path.length || live.race) return null;
    const m = live.me, fx = m.px + 0.5, fy = m.py + 0.82;
    const pi = WD.plotAt(m.x, m.y); if (pi >= 0) return { type: 'plot', i: pi };
    let best = null, bd = 1.05;
    const consider = (d, a) => { if (d < bd) { bd = d; best = a; } };
    for (const o of WD.objects) if (o.door) consider(Math.hypot(fx - (o.door.x + 0.5), fy - (o.door.y + 0.7)), o.kind === 'lot' ? { type: 'lot', i: o.i } : o.kind === 'npc' ? { type: 'zasuul' } : o.kind === 'npcq' ? { type: 'npcq', id: o.id } : { type: o.id });
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
      case 'arcade': return ['ui:book', L('Сурах', 'Learn')];
      case 'academy': return ['ui:book', L('Монгол бичиг', 'Mongol script')];
      case 'shop': return ['ui:shop', L('Дэлгүүр', 'Shop')];
      case 'board': return ['ui:scroll', L('Даалгавар', 'Quests')];
      case 'well': return ['ui:drop', L('Ус авах', 'Get water')];
      case 'fish': return ['ui:fish', L('Загасчлах', 'Fish')];
      case 'sheep': return ['ui:heart', L('Илбэх', 'Pet')];
      case 'lot': { const l = lotsArr()[a.i]; return ['ui:ger', !l ? L('Гэр авах', 'Buy ger') : l.by === V().id ? L('Миний гэр', 'My ger') : L('Зочлох', 'Visit')]; }
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
      case 'plot': return plotAction(a.i);
      case 'home': return wardrobe();
      case 'arcade': return TG.go('learn');
      case 'academy': return TG.go('bichig');
      case 'shop': return shopModal();
      case 'board': return questModal();
      case 'well': { const v = V(); v.water = v.can; S.save(); TG.sfx.pour(0.7); floatAt(live.me, `${v.water}/${v.can}`, '#93d4f6'); hud(); return; }
      case 'fish': return fishing();
      case 'sheep': return petSheep(a.s);
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
  function onTap(e) {
    if (!live) return;
    e.preventDefault();
    if (e.pointerType === 'touch') {
      live.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (live.ptrs.size >= 2) { live.pinch = ptrDist(); live.me.path = []; live.pending = null; return; } // second finger: pinch, don't walk
    }
    if (live.els.mini.classList.contains('big')) { live.els.mini.classList.remove('big'); return; }
    const r = live.canvas.getBoundingClientRect(), c = cam(), { k, devW } = live.view, sc = devW / r.width;
    const ax = ((e.clientX - r.left) * sc) / k + c.x, ay = ((e.clientY - r.top) * sc) / k + c.y;
    const wx = ax / T, wy = ay / T, tx0 = Math.floor(wx), ty0 = Math.floor(wy);
    { const dg = live.dog; if (Math.abs(dg.x + 0.55 - wx) < 0.8 && wy > dg.y - 0.6 && wy < dg.y + 1.1) return openBasar(); }
    for (const o of live.others.values()) if (Math.abs(o.px + 0.5 - wx) < 0.6 && wy > o.py - 0.8 && wy < o.py + 1) return playerCard(o);
    const sh = live.sheep.find((q) => Math.abs(q.px + 0.5 - wx) < 0.7 && Math.abs(q.py + 0.5 - wy) < 0.7);
    if (sh) { const n = WD.nearestOpen(sh.x, sh.y, live.me.x, live.me.y); return n ? goTo(n, { type: 'sheep', s: sh }) : null; }
    const pi = WD.plotAt(tx0, ty0); if (pi >= 0) return goTo({ x: tx0, y: ty0 }, { type: 'plot', i: pi });
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
  const KEYS = { ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u' };
  function onKey(e) {
    if (!live || document.querySelector('.modal-back') || (TG.scene && TG.scene.active()) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    if (KEYS[e.code]) { e.preventDefault(); live.keys.add(KEYS[e.code]); return; }
    if (e.code === 'KeyB' && !e.repeat) { e.preventDefault(); openBasar(); return; }
    if (['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract'].includes(e.code)) { e.preventDefault(); zoom(/Equal|Add/.test(e.code) ? 1 : -1); return; }
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
    if (KEYS[e.code]) live.keys.delete(KEYS[e.code]);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { live.run = false; if (live.race) live.race.sprint = false; }
    if (e.code === 'Space' && !document.querySelector('.modal-back')) { e.preventDefault(); e.stopPropagation(); }
  }

  // ---------------------------------------------------------------- minimap
  const MINI = { g: '#76b947', T: '#3f7a2c', p: '#d8ab6c', s: '#d9cdb5', w: '#4aa6e2', d: '#a46d3b', o: '#8c5a33', f: '#a46d3b', r: '#a5a5b0', a: '#e8c994' };
  const MINI_OBJ = { ger: '#f4efe3', shop: '#e14b3d', board: '#a46d3b', well: '#77778a', lot: '#c8a06a', bleachers: '#a46d3b', ovoo: '#a5a5b0', uya: '#8a5a33', archery: '#e9a91f', academy: '#2f7d5b' };
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
    const { bw, bh } = live.view, c = cam(); m.strokeStyle = 'rgba(255,255,255,.85)'; m.lineWidth = 1;
    m.strokeRect(Math.round((c.x / T) * s) + 0.5, Math.round((c.y / T) * s) + 0.5, Math.round((bw / T) * s) - 1, Math.round((bh / T) * s) - 1);
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
  function frame(ts) {
    if (!live) return;
    const dt = Math.min(0.05, (ts - live.last) / 1000); live.last = ts;
    update(dt);
    if (!(TG.scene && TG.scene.active())) { draw(ts / 1000); if ((live.mf = (live.mf || 0) + 1) % 2) drawMini(); }
    live.raf = requestAnimationFrame(frame);
  }
  const follow = (p, x, y, dt) => { p.x += (x - p.x) * Math.min(1, dt * 4); p.y += (y - p.y) * Math.min(1, dt * 4); };
  function update(dt) {
    const m = live.me, k = live.keys, v0 = V();
    const wantRun = (live.run || live.runLock) && !live.race && (k.size > 0 || m.path.length > 0);
    if (wantRun && v0.energy <= 0 && !live.tiredSaid) { live.tiredSaid = true; TG.toast('😮‍💨 ' + L('Ядарчихлаа! Хоол идэж, ундаа уугаад хүчээ нөхөөрэй (🍖 дээр дар).', 'Out of energy! Eat or drink to get it back (tap 🍖).')); }
    m.running = wantRun && v0.energy > 0;
    const SP = live.ride ? (live.race ? raceSpeed() : m.running ? 11 : 7.2) : m.running ? 7.6 : SPEED;
    if (live.race && live.race.phase === 'count') { k.clear(); m.path = []; }
    let ix = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), iy = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), tvx = 0, tvy = 0;
    if (ix || iy) { m.path = []; live.pending = null; const n = Math.hypot(ix, iy); tvx = (ix / n) * SP; tvy = (iy / n) * SP; }
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
    // feet overlapping a fence or wall (e.g. the map changed under a saved spot) would block every move: step back onto open ground
    if (!freeAt(m.px + 0.5, m.py + 0.82, true)) {
      const n = !WD.blocked(m.x, m.y) && freeAt(m.x + 0.5, m.y + 0.82, true) ? { x: m.x, y: m.y } : WD.nearestOpen(m.x, m.y, m.x, m.y);
      if (n) { m.px = n.x; m.py = n.y; m.x = n.x; m.y = n.y; m.vx = m.vy = 0; }
    }
    const ox = m.px, oy = m.py, pn = performance.now();
    let over = pn - (m.jt || -1e9) < JUMP_MS || !freeAt(m.px + 0.5, m.py + 0.82);
    const rockAhead = (nx, ny) => !over && (ix || iy) && !freeAt(nx, ny) && freeAt(nx, ny, true);
    if (rockAhead(m.px + 0.5 + m.vx * dt, m.py + 0.82) || rockAhead(m.px + 0.5, m.py + 0.82 + m.vy * dt)) { jump(); over = true; }
    if (m.vx && freeAt(m.px + 0.5 + m.vx * dt, m.py + 0.82, over)) m.px += m.vx * dt; else m.vx = 0;
    if (m.vy && freeAt(m.px + 0.5, m.py + 0.82 + m.vy * dt, over)) m.py += m.vy * dt; else m.vy = 0;
    const speed = Math.hypot(m.vx, m.vy);
    m.moving = speed > 0.3;
    if (speed > 0.3) m.dir = Math.abs(m.vx) > Math.abs(m.vy) * 0.9 ? (m.vx < 0 ? 1 : 2) : (m.vy < 0 ? 3 : 0);
    if (Math.abs(m.vx) > 0.3) m.face = m.vx < 0 ? 1 : 2;
    if (live.ride && speed > 0.3) V().horse.dist += speed * dt;
    if (m.running && speed > 0.3) { // running tires you (a little less on a horse); eating fills it up again
      v0.energy = Math.max(0, v0.energy - dt * (live.ride ? 0.6 : 1.1));
      if (v0.energy > 0) live.tiredSaid = false;
      live.eT = (live.eT || 0) + dt; if (live.eT > 1) { live.eT = 0; hudEnergy(); live.eS = (live.eS || 0) + 1; if (live.eS >= 5) { live.eS = 0; S.save(); } }
    }
    if (live.race) raceTick(dt);
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
    { // Басар trots behind you and sits beside you when you stop
      const dg = live.dog, [ddx, ddy] = DIRS[m.dir], tx2 = m.moving ? m.px - ddx * 0.95 + (ddy ? 0.6 : 0) : m.px + 1.1, ty2 = m.moving ? m.py - ddy * 0.7 + 0.15 : m.py + 0.25;
      const ox = dg.x, oy = dg.y, q = Math.min(1, dt * 3); dg.x += (tx2 - dg.x) * q; dg.y += (ty2 - dg.y) * q;
      if (Math.hypot(m.px - dg.x, m.py - dg.y) > 4) { dg.x = tx2; dg.y = ty2; }
      const sp2 = Math.hypot(dg.x - ox, dg.y - oy) / Math.max(dt, 1e-3); dg.moving = sp2 > 0.4; dg.idle = dg.moving ? 0 : dg.idle + dt;
      if (Math.abs(dg.x - ox) > 0.002) dg.flip = dg.x < ox; else if (!dg.moving) dg.flip = m.px + 0.2 < dg.x;
      const nowP = performance.now();
      if (nowP > dg.nextFact && !document.querySelector('.modal-back')) { dg.nextFact = nowP + 45000 + Math.random() * 30000; const sf = TG.seasons.current(), f = Math.random() < 0.5 ? (() => { const ff = TG.pick(sf.facts); return { mn: `${sf.icon} Мэдэх үү? ${ff.mn}`, en: `${sf.icon} Did you know? ${ff.en}` }; })() : TG.BASAR.FACTS[Math.floor(Math.random() * TG.BASAR.FACTS.length)]; dg.bubble = { fact: f, t0: nowP }; TG.sfx.pop && TG.sfx.pop(); }
      if (dg.bubble && nowP - dg.bubble.t0 > 12000) dg.bubble = null;
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

  /** Season look, drawn into the low-res buffer so it stays pixel-crisp: tint plus falling snow, leaves or petals. */
  function seasonFx(b, bw, bh, t, c) {
    const id = live.season;
    if (id === 'winter') { b.fillStyle = 'rgba(235,242,250,.16)'; b.fillRect(0, 0, bw + 1, bh + 1); } // a light frost, so the town stays clear and readable
    else if (id === 'autumn') { b.globalCompositeOperation = 'multiply'; b.fillStyle = '#ffd59a'; b.fillRect(0, 0, bw + 1, bh + 1); b.globalCompositeOperation = 'source-over'; }
    else if (id === 'spring') { b.fillStyle = 'rgba(255,200,230,.06)'; b.fillRect(0, 0, bw + 1, bh + 1); }
    const n = id === 'winter' ? 34 : id === 'summer' ? 10 : 28;
    for (let i = 0; i < n; i++) {
      const sp = id === 'winter' ? 14 + (i % 5) * 4 : id === 'summer' ? 4 : 10 + (i % 4) * 3;
      const x0 = (WD.hash(i, 7) * (bw + 40) + Math.sin(t * 0.8 + i) * (id === 'summer' ? 18 : 6)) % (bw + 40) - 20;
      const y0 = id === 'summer' ? (WD.hash(i, 3) * bh + Math.sin(t * 1.7 + i) * 6) : ((WD.hash(i, 11) * (bh + 30) + t * sp) % (bh + 30)) - 15;
      const X = Math.round(x0), Y = Math.round(y0);
      if (id === 'winter') { b.globalAlpha = 0.7; PX.R(b, X, Y, 1, 1, '#ffffff'); if (i % 4 === 0) PX.R(b, X + 1, Y, 1, 1, '#dce8f5'); b.globalAlpha = 1; } // small, soft flakes that don't hide the town
      else if (id === 'autumn') { PX.R(b, X, Y, 2, 1, ['#e8752a', '#c9461e', '#f2b33d'][i % 3]); PX.R(b, X + (Math.floor(t * 3 + i) % 2), Y + 1, 1, 1, '#a8501c'); }
      else if (id === 'spring') { PX.R(b, X, Y, 1, 1, i % 2 ? '#ffb7d5' : '#ffffff'); if (i % 3 === 0) PX.R(b, X + 1, Y, 1, 1, '#ff8fb1'); }
      else { const on = Math.floor(t * 6 + i) % 2; PX.R(b, X, Y, 1, 1, '#ffffff'); if (on) { PX.R(b, X - 1, Y, 1, 1, i % 2 ? '#ffd34e' : '#b49cff'); PX.R(b, X + 1, Y, 1, 1, i % 2 ? '#ffd34e' : '#b49cff'); } } // butterflies
    }
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
    seasonFx(b, bw, bh, t, c);
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
    const ents = [], frame = (o) => (o.moving ? 1 + (Math.floor(t * (o.running ? 13 : 8)) % 2) : 0);
    live.sheep.forEach((q) => ents.push({ y: q.py, f: () => { shadow(q.px * T, q.py * T); sprite(PX.animal('sheep', Math.floor(t * 2 + q.i) % 2), q.px * T, q.py * T + 2, q.flip); } }));
    if (live.season === 'spring') live.sheep.forEach((q) => ents.push({ y: q.py + 0.3, f: () => sprite(PX.animal('lamb', Math.floor(t * 3 + q.i) % 2), q.px * T + (q.flip ? -9 : 12), q.py * T + 6, q.flip) })); // spring: the lambs are born
    const person = (o) => {
      if (o.look.pet) ents.push({ y: o.petPos.y, f: () => { const a = PX.animal(o.look.pet, frame(o)); shadow(o.petPos.x * T - 2, o.petPos.y * T - 1); sprite(a, o.petPos.x * T + 2, o.petPos.y * T + 16 - a.height, o.px > o.petPos.x + 0.05); } });
      const z = jumpZ(o, pn);
      if (o.look.ride) ents.push({ y: o.py, f: () => drawRider(o.look, o.face || (o.dir === 1 ? 1 : 2), o.moving, o.px, o.py, z) });
      else ents.push({ y: o.py, f: () => { shadow(o.px * T, o.py * T); sprite(PX.char(o.look, o.dir, z ? 0 : frame(o)), o.px * T, o.py * T - 12 - z); } });
    };
    // a rider on a Mongolian horse; face 1 = left, 2 = right
    const drawRider = (look, face, moving, wx, wy, z = 0) => {
      const hf = z ? 2 : moving ? 1 + (Math.floor(t * (live.me.running && wx === live.me.px ? 17 : 12)) % 4) : 0, hs = PX.horse(look.coat || 'bay', hf, true), left = face === 1;
      const HX = wx * T - 6, HY = wy * T + 16 - hs.height - z;
      ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(SX(HX + 4), SY(HY + 21 + z), 20 * k, 2 * k);
      sprite(PX.char({ ...look, pet: null }, left ? 1 : 2, 0), HX + 6, HY - 15);
      sprite(hs, HX, HY, left);
    };
    if (live.race) for (const n of live.race.npcs) ents.push({ y: n.py, f: () => { drawRider(n.look, n.face, live.race.phase === 'go' && !n.done, n.px, n.py); const [lx, ly] = [(n.px * T + 8 - cf.x) * k, (n.py * T - 22 - cf.y) * k]; live.race.labels.push([n.name, lx, ly]); } });
    for (const o of live.others.values()) person(o);
    const v = V(); person({ ...live.me, look: v.look });
    const dg = live.dog, dfr = dg.moving ? 1 + (Math.floor(t * 8) % 2) : dg.idle > 1.5 ? 3 : 0;
    ents.push({ y: dg.y + 0.05, f: () => { shadow(dg.x * T, dg.y * T + 1); sprite(PX.bankhar(dfr), dg.x * T - 3, dg.y * T - 1, dg.flip); } });
    lotsArr().forEach((l, i) => { if (!l) return; const o = WD.lots[i]; ents.push({ y: o.y + 2, f: () => sprite(PX.gerSprite(R.ROOF[l.roof] || R.ROOF.blue, R.DOOR[l.door] || R.DOOR.red), o.x * T, o.y * T - 2) }); });
    const zs = WD.objects.find((q) => q.kind === 'npc');
    if (zs) ents.push({ y: zs.y, f: () => { shadow(zs.x * T, zs.y * T); sprite(PX.char(ZASUUL, Math.floor(t / 2.5) % 4 === 3 ? 2 : 0, 0), zs.x * T, zs.y * T - 12); } });
    const tps = WD.objects.filter((q) => q.kind === 'npcq');
    for (const np of tps) { const d = NPCS[np.id]; if (d) ents.push({ y: np.y, f: () => { shadow(np.x * T, np.y * T); sprite(PX.char(d.look, Math.floor(t / 3 + np.x) % 5 === 4 ? 2 : 0, 0), np.x * T, np.y * T - 12); } }); }
    const em = WD.objects.find((q) => q.kind === 'emee');
    if (em) ents.push({ y: em.y, f: () => { shadow(em.x * T, em.y * T); sprite(PX.char(EMEE, Math.floor(t / 3) % 4 === 2 ? 1 : 0, 0), em.x * T, em.y * T - 12); } });
    if (live.race) {
      live.race.labels = [];
      const RC = live.race.path.P, fl = Math.floor(t * 4) % 2;
      for (let i = Math.max(1, live.race.ci); i < Math.min(RC.length, live.race.ci + 4); i++) { const p = RC[i], last = i === RC.length - 1; ents.push({ y: p.y - 0.9, f: () => sprite(PX.raceFlag(last ? '#e14b3d' : i === live.race.ci ? '#f7c646' : '#ffffff', fl), (p.x - 0.3) * T, (p.y - 1) * T - 15) }); }
    }
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
    for (const np of tps) { const d = NPCS[np.id]; if (!d) continue; const [sx, sy] = S(np.x * T + 8, np.y * T - 16); pixelText(ctx, tx(d.name).split(' ').pop(), sx, sy, textSize() * 0.8, '#ffffff'); const mk = npcMark(np.id); if (mk) pixelText(ctx, mk, sx, sy - 9 * live.view.k + Math.round(Math.sin(pn / 180 + np.x) * 2) * live.view.k / 2, textSize() * 1.8, mk === '?' ? '#7fe07a' : '#f7c646'); }
    if (em) { const [sx, sy] = S(em.x * T + 8, em.y * T - 16); pixelText(ctx, L('Эмээ', 'Grandma'), sx, sy, textSize(), '#f7c646'); if (!(V().emee && V().emee.visits)) pixelText(ctx, '!', sx, sy - 9 * live.view.k + Math.round(Math.sin(pn / 180) * 2) * live.view.k / 2, textSize() * 1.8, '#f7c646'); }
    for (const o of live.others.values()) labels(ctx, o, o.name, o.lvl, false, pn, S, dpr);
    labels(ctx, live.me, live.name, R.level(v.xp).l, true, pn, S, dpr);
    if (live.race) {
      if (live.race.phase === 'go') for (const [nm, lx, ly] of live.race.labels) pixelText(ctx, nm, lx, ly, textSize() * 0.8, '#ffffff');
      const nx = live.race.path.P[Math.min(live.race.ci, live.race.path.P.length - 1)], fx = live.me.px + 0.5, fy = live.me.py + 0.82, ang = Math.atan2(nx.y - fy, nx.x - fx);
      if (live.race.phase !== 'done') { const [ax, ay] = S(live.me.px * T + 8, live.me.py * T - 36), r = 7 * k; ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.fillStyle = '#2b1e2e'; ctx.beginPath(); ctx.moveTo(r + k, 0); ctx.lineTo(-r * 0.6, -r * 0.75); ctx.lineTo(-r * 0.6, r * 0.75); ctx.fill(); ctx.fillStyle = '#f7c646'; ctx.beginPath(); ctx.moveTo(r - k, 0); ctx.lineTo(-r * 0.4, -r * 0.5); ctx.lineTo(-r * 0.4, r * 0.5); ctx.fill(); ctx.restore(); }
    }
    { const [sx, sy] = S(dg.x * T + 8, dg.y * T - 4); pixelText(ctx, L('Басар', 'Basar'), sx, sy, textSize() * 0.8, '#f7c646');
      if (dg.bubble) { const bob = Math.round(Math.sin(pn / 180) * 2) * live.view.k / 2; pixelText(ctx, '!', sx + 5 * live.view.k, sy - 6 * live.view.k + bob, textSize() * 1.8, '#f7c646'); } }
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
    if (text == null || text === '') return; // never draw "null" for a missing name
    const fs = Math.max(10, Math.round(size / 5) * 5), o = Math.max(1, Math.round(fs / 10));
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${fs}px Tiny5, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = outline; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) ctx.fillText(text, Math.round(x) + dx, Math.round(y) + dy);
    ctx.fillStyle = color; ctx.fillText(text, Math.round(x), Math.round(y)); ctx.restore();
  }
  function labels(ctx, o, name, level, isMe, pn, S, dpr) {
    const rl = (isMe ? V().look : o.look || {}).ride ? 10 : 0;
    const [x, y] = S(o.px * T + 8, o.py * T - 16 - rl), fs = textSize(), u = Math.max(1, Math.round(fs / 10));
    ctx.font = `${fs}px Tiny5, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pad = Math.round(fs * 0.45), th = fs + u * 4, gap = u * 3;
    name = name || '?';
    const lvT = String(level || 1), lvW = Math.ceil(ctx.measureText(lvT).width) + pad * 2, nmW = Math.ceil(ctx.measureText(name).width) + pad * 2;
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
    const pay = (price) => { if (v.coins < price) { TG.sfx.bad(); TG.toast(L('Зоос хүрэлцэхгүй байна. Хичээл үзэж, Басарын асуултад хариулж, ургац зарж цуглуулаарай!', 'Not enough coins. Learn, answer Basar’s quizzes or sell crops to earn more!')); return false; } v.coins -= price; TG.sfx.chime(); return true; };
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
          h('div', { class: 'v-row-b' }, h('b', null, q.season ? `${TG.seasons.byId(q.season).icon} ` : '', tx(d.t), q.k === 'help' ? h('small', null, ` (${L('онлайн', 'online')})`) : null, q.season ? h('small', { class: 'v-season-tag' }, ` ${tx(TG.seasons.byId(q.season).name)} ×1.5`) : null), h('div', { class: 'meter' }, h('span', { style: { width: (q.p / d.n) * 100 + '%' } })), h('small', null, `${q.p}/${d.n} · +${d.c} ${L('зоос', 'coins')} · +${d.x} XP`)),
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
    const DIST = [92, 118, 142], TOL = [10, 8, 6], X0 = 34, GROUND = 94, G = 120;
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
      if (st.phase === 'aim') st.angle = (Math.sin(k * (1.6 + st.round * 0.35)) + 1) / 2;
      if (st.phase === 'power') st.power = (Math.sin(k * (2.2 + st.round * 0.45) - Math.PI / 2) + 1) / 2;
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
    const sayEmee = (txt, kind) => rc(bubble, emeePic(40), h('p', { class: kind || '' }, txt));
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
      chain: [NQ('pet', 3, 'Хониддоо дасгая: тэднийг 3 удаа илбээрэй.', 'Help the sheep get to know you: pet them 3 times.', 20, 25), NQ('harvest', 2, 'Малын тэжээлд 2 ургац хураагаад ирээрэй.', 'Harvest 2 crops for the animals.', 25, 30), NQ('etiquette', 1, 'Эмээгийн гэрт ёсоор зочлоод ир. Малчин хүн ёсоо мэддэг байх ёстой!', 'Visit Grandma’s ger with good manners. A herder knows the customs!', 35, 40)],
      done: Tx('Чи жинхэнэ малчин болох нь! Малчид хонь бүрээ таньдаг, гэр бүл шиг хайрладаг.', 'You’ll make a real herder! Herders know every sheep and love them like family.') },
    fisher: { name: Tx('Загасчин Дорж өвөө', 'Grandpa Dorj the fisher'), look: { deel: 'teal', skin: '#B97A4A', hat: 'cap', neck: null, face: null, pet: null },
      hello: Tx('Нуур тайван байна. Загасчлахад тэвчээр хэрэгтэй.', 'The lake is calm today. Fishing takes patience.'),
      chain: [NQ('fish', 1, 'Нэг загас барьж үзээрэй. Гүүрэн дээрээс загасчилна.', 'Catch your first fish from the dock.', 15, 20), NQ('fish', 3, 'Одоо 3 загас бариарай. Хадран барьвал буцааж тавиарай!', 'Now catch 3 fish. If you catch a taimen, let it go!', 30, 35), NQ('basar', 2, 'Басараас Монголын гол мөрөн, нууруудын тухай 2 асуулт асуу.', 'Ask Basar 2 questions about Mongolia’s rivers and lakes.', 25, 30)],
      done: Tx('Сайн загасчин байгалиа хайрладаг. Хөвсгөл нуур бол Монголын хамгийн гүн нуур шүү!', 'A good fisher loves nature. Lake Khövsgöl is Mongolia’s deepest lake!') },
    farmer: { name: Tx('Тариачин Сарнай эгч', 'Farmer Sarnai'), look: { deel: 'green', skin: '#EDBB93', hat: 'flower', neck: null, face: null, pet: null },
      hello: Tx('Цэцэрлэгт ажиллах сайхан шүү! Надад туслах уу?', 'Gardening is lovely! Will you help me?'),
      chain: [NQ('plant', 4, '4 үр тариарай.', 'Plant 4 seeds.', 20, 25), NQ('water', 5, 'Ургамлуудаа 5 удаа услаарай.', 'Water the plants 5 times.', 20, 25), NQ('harvest', 3, '3 ургац хураагаарай.', 'Harvest 3 crops.', 30, 35)],
      done: Tx('Баярлалаа! Сэлэнгэ аймаг Монголын талх, үр тарианы өлгий шүү.', 'Thank you! Selenge province is the cradle of Mongolia’s bread and grain.') },
    teacher: { name: Tx('Багш Оюун', 'Teacher Oyun'), look: { deel: 'blue', skin: '#F6D3B3', hat: null, neck: 'scarf', face: 'glasses', pet: null },
      hello: Tx('Сурах бичиг уншихаас гадна тоглож сурах нь бас гоё!', 'Besides books, learning by playing is great fun!'),
      chain: [NQ('lesson', 1, 'Сургуулийн гэрт нэг хичээл дуусгаарай.', 'Finish one lesson in the school ger.', 30, 40), NQ('quiz', 3, 'Басарын 3 асуултад зөв хариулаарай.', 'Answer 3 of Basar’s questions correctly.', 25, 35), NQ('stamp', 1, 'Аймгийн паспортоороо нэг аймагт аялж тамга аваарай.', 'Travel to a province with your passport and earn a stamp.', 35, 45)],
      done: Tx('Гайхалтай сурагч! “Эрдэм ухаан, эрдэнийн сан” гэдэг шүү.', 'An amazing student! As we say, “knowledge is a treasure”.') },
    trainer: { name: Tx('Уяач Ганбаатар', 'Horse trainer Ganbaatar'), look: { deel: 'gold', skin: '#D9A06E', hat: 'loovuuz', neck: null, face: null, pet: null },
      hello: Tx('Сайн уяач морио хайрлаж, сайн мэддэг. Хурдан морь уяачаас эхэлдэг.', 'A good trainer loves and knows their horse. Every fast horse starts with its trainer.'),
      chain: [NQ('race', 1, 'Морин уралдаанд нэг удаа оролцоорой.', 'Ride in one horse race.', 25, 30), NQ('race', 2, 'Дахиад 2 уралдаанд уралдаж мориндоо дасгал хийлгээрэй.', 'Ride 2 more races to train your horse.', 35, 40), NQ('wrestle', 1, 'Наадмын талбайд нэг даваа давж үзээрэй.', 'Win one round at the wrestling arena.', 30, 35)],
      done: Tx('Чи морио сайн мэдэх болжээ! Уяачид морио уралдааны өмнө “сойдог”, өөрөөр хэлбэл тусгайлан бэлтгэдэг.', 'You know your horse well now! Before a race, trainers “soi” their horses: they prepare them in a special way.') },
    archer: { name: Tx('Мэргэн Тулга ах', 'Tulga the archer'), look: { deel: 'red', skin: '#B97A4A', hat: 'mongol', neck: 'medal', face: null, pet: null },
      hello: Tx('Сайн харваач амьсгалаа тайвшруулж, салхиа ажигладаг.', 'A good archer breathes calmly and watches the wind.'),
      chain: [NQ('archery', 3, 'Сурын талбайд 3 бай онооорой.', 'Hit 3 targets at the archery range.', 25, 30), NQ('archery', 6, 'Одоо 6 бай онооорой. Салхийг тооцоорой!', 'Now hit 6 targets. Mind the wind!', 35, 40), NQ('together', 1, 'Гэр бүлтэйгээ нэг бодит ажил хамт хийгээрэй.', 'Do one real-life activity with your family.', 40, 45)],
      done: Tx('Чи мэргэн болж байна! Сайн харваачийг монголчууд “мэргэн” гэж цоллодог.', 'You’re becoming a mergen! That is what Mongols call a great archer.') },
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
    const draw = () => {
      const q = d.chain[st.step];
      const steps = h('div', { class: 'npc-steps' }, d.chain.map((_, i) => h('i', { class: i < st.step ? 'on' : i === st.step ? 'cur' : '' })));
      if (!q) { rc(body, h('div', { class: 'npc-head' }, npcPic(d.look), h('div', null, h('h2', null, tx(d.name)), steps)), h('div', { class: 'emee-say' }, h('p', null, tx(d.done))), h('p', { class: 'muted' }, '✓ ', L('Бүх даалгаврыг биелүүлсэн. Баярлалаа!', 'All tasks complete. Thank you!'))); return; }
      const ready = st.on && st.p >= q.n;
      rc(body, h('div', { class: 'npc-head' }, npcPic(d.look), h('div', null, h('h2', null, tx(d.name)), steps)),
        h('div', { class: 'emee-say' }, h('p', null, st.on ? (ready ? L('Чи хийчихжээ! Баярлалаа! 🎉', 'You did it! Thank you! 🎉') : tx(q.t)) : `${tx(d.hello)} ${tx(q.t)}`)),
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
      if (own && v.rest !== today) { v.rest = today; v.water = v.can; S.save(); reward(5, 10); sayIt(L('😴 Сайхан амарлаа! Усны сав дүүрч, +10 XP.', '😴 A good rest! Water refilled, +10 XP.')); hud(); }
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
        ? h('div', null, h('p', { class: 'muted' }, L(`"${live.room}" өрөөнд ${others.length + 1} хүн байна. Ижил кодтой хүмүүс нэг нутагт тоглож, нэг цэцэрлэгт тарина.`, `${others.length + 1} people in room "${live.room}". Everyone with the same code shares one village and garden.`)),
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
    const l = lotsArr()[i];
    if (!l) return myLot() >= 0 ? TG.toast(L('Танд аль хэдийн гэр байна!', 'You already have a ger!')) : buyGer(i);
    if (l.by === V().id) return enterGer(i);
    enterGer(i, true);
  }
  function gerPreview(roof, door, scale) {
    const c = h('canvas', { class: 'v-gerprev', width: 48 * scale, height: 50 * scale }), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(PX.gerSprite(R.ROOF[roof], R.DOOR[door]), 0, 0, 48 * scale, 50 * scale);
    return c;
  }
  const swatches = (map, cur, onPick, cls = '') => h('div', { class: 'v-chips' }, Object.entries(map).map(([k, c]) => h('button', { class: 'v-chip v-swatch ' + cls + (cur === k ? ' active' : ''), style: { background: c }, 'aria-label': k, onclick: () => onPick(k) })));
  function buyGer(i) {
    const v = V(), body = h('div'); let roof = 'blue', door = 'red';
    const learned = TG.learn && TG.learn.done('ger');
    if (!learned) {
      const close2 = TG.modal(h('div', { class: 'center' }, h('div', { class: 'v-gerbox' }, gerPreview('blue', 'red', 3)), h('h2', null, L('Эхлээд гэр барьж сур!', 'Learn to build a ger first!')),
        h('p', { class: 'muted' }, L('Жинхэнэ малчид гэрээ өөрсдөө барьдаг. Сургуулийн гэрт “Монгол гэр барих” хичээлийг дуусгавал энд өөрийн гэрээ барих эрх нээгдэнэ.', 'Real herders build their own gers. Finish the “Build a Mongol ger” lesson in the school ger to unlock your own ger here.')),
        h('button', { class: 'btn primary big block', onclick: () => { close2(); TG.go('lesson', { id: 'ger' }); } }, '⛺ ', L('Хичээл эхлэх', 'Start the lesson'))), { cls: 'v-modal' });
      return;
    }
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
      v.coins = Math.max(0, v.coins - R.GER_PRICE); v.gerBuilt = true; reward(0, 30); TG.sfx.win(); TG.confetti(70);
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
      rc(body, h('h2', null, L('Гэрээ тохижуулах', 'Decorate my ger')), cv,
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
      h('button', { class: 'btn primary big block', onclick: () => { close(); tournament(1); } }, L('Наадамд барилдах (9 даваа)', 'Wrestle in the Naadam (9 rounds)')),
      h('button', { class: 'btn block', style: { marginTop: '8px' }, onclick: () => techBook() }, '📖 ', L('Мэхний ном (7 мэх)', 'Technique book (7 moves)')),
      live.online ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'label' }, L('Найзтайгаа барилдах', 'Wrestle a friend')),
        others.length ? h('div', { class: 'v-list' }, others.map((o) => h('div', { class: 'v-row' }, portrait(o.look, 28), h('div', { class: 'v-row-b' }, h('b', null, o.name), h('small', null, `${L('Түвшин', 'Level')} ${o.lvl}`)),
          h('button', { class: 'btn sm primary', onclick: () => { net.send({ t: 'wr-invite', to: o.id }); TG.toast(L('Урилга илгээлээ…', 'Invitation sent…')); close(); } }, L('Урих', 'Invite')))))
          : h('p', { class: 'muted' }, L('Одоогоор өрөөнд өөр хүн алга.', 'Nobody else is in the room yet.'))) : null,
      h('div', { class: 'teach', style: { marginTop: '12px' } }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, tx(TG.pick(WR_FACTS))))), { cls: 'v-modal' });
  }
  function techBook() {
    const used = (V().wr.techs) || {};
    TG.modal(h('div', null, h('h2', null, L('Бөхийн мэхний ном', 'Wrestling technique book')),
      h('p', { class: 'muted' }, L('Мэх бүр дараагийн 3 мэхийг давж, өмнөх 3-д дийлддэг. Нэг мэхийг давтвал өрсөлдөгч таньж, хүч чинь сулардаг. Даваа ахих тусам өрсөлдөгч чинь ухаалаг, хурдан болно!', 'Each move beats the next 3 and loses to the 3 before it. Repeat a move and your opponent reads it, so your power drops. Each round, opponents get smarter and faster!')),
      h('div', { class: 'v-list' }, R.MOVES.map((m) => h('div', { class: 'v-row' }, h('span', { class: 'v-tech-n' }, used[m.id] || 0),
        h('div', { class: 'v-row-b' }, h('b', null, tx(m.name)), h('small', null, tx(m.fact)), h('small', null, '✓ ', L('Давна', 'Beats'), ': ', m.beats.map((b2) => tx(R.MOVES.find((q) => q.id === b2).name)).join(', '))))))), { cls: 'v-modal' });
  }
  function tournament(round) {
    const opp = { name: WR_NAMES[(round * 5 + Math.floor(Math.random() * 4)) % WR_NAMES.length], skill: 0.15 + round * 0.085, skin: TG.pick(R.SKINS) };
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
  const WR_PART = { push: Tx('нуруу', 'back'), pull: Tx('өвдөг', 'knee'), hook: Tx('нуруу', 'back'), inhook: Tx('нуруу', 'back'), hip: Tx('мөр', 'shoulder'), leg: Tx('тохой', 'elbow'), lift: Tx('нуруу', 'back') };
  const OPP_TITLE = ['', '', '', '', 'nachin', 'khartsaga', 'zaan', 'garid', 'arslan', 'arslan'];
  const DEVEE_BEAT = 700, DEVEE_TAPS = 4;
  function wrestleMatch(cfg, onEnd) {
    const v = V(), mySkin = R.SKINS.includes(v.look.skin) ? v.look.skin : R.SKINS[0], oppSkin = cfg.opp.skin || '#D9A06E';
    const st = { a: 0, b: 0, phase: 'choose', move: null, lastPlayer: null, off: 0, target: 0, pose: ['grip', 'grip'], over: false, t0: performance.now(), marker: 0, intro: performance.now(), used: {}, flash: null,
      devee: cfg.ai ? { n: 0, good: 0, t0: performance.now(), f: 0 } : null, bonus: 0, lastMove: null, end: 0, left: false };
    // each даваа is harder: more points to win, a faster timing bar, a narrower sweet spot and a sharper opponent
    const rnd = cfg.ai ? cfg.round : 4, need = cfg.ai && cfg.round >= 7 ? 3 : 2;
    const barSpeed = cfg.ai ? 2.7 + rnd * 0.33 : 3.6, sharp = cfg.ai ? 1 + rnd * 0.13 : 1.3;
    const cv = h('canvas', { class: 'v-wr-canvas', width: 192, height: 108 }), cx = cv.getContext('2d');
    const score = h('div', { class: 'v-wr-score' }), msg = h('div', { class: 'v-wr-msg' }, L('Мэхээ сонго!', 'Choose your move!'));
    const moves = h('div', { class: 'v-wr-moves' }), marker = h('i', { class: 'v-wr-marker' });
    const goBtn = h('button', { class: 'btn primary big block' }, L('Хүч! (Space)', 'Power! (Space)'));
    const timing = h('div', { class: 'v-wr-timing hidden' }, h('div', { class: 'v-wr-bar' }, h('i', { class: 'v-wr-zone', style: { width: Math.round(36 / sharp) + '%', left: (50 - 18 / sharp) + '%' } }), marker), goBtn);
    const tail = h('div');
    // the zasuul calls out both wrestlers by their titles before the bout
    const myT = titleObj(R.titleFor(v.wr)), opT = cfg.ai ? titleObj(OPP_TITLE[cfg.round]) : null, named = (t, n) => (t ? tx(t.name) + ' ' : '') + n;
    const herald = h('div', { class: 'v-zasuul' }, h('b', null, '📣 ', L('Засуул', 'Herald'), ': '),
      L(`«${named(myT, live.name)}, ${named(opT, cfg.opp.name)} хоёр барилдана! Хүчит бөхчүүд дэвээгээ хийцгээ!»`, `"${named(myT, live.name)} and ${named(opT, cfg.opp.name)} will wrestle! Mighty wrestlers, do your eagle dance!"`));
    // дэвээ: flap like an eagle in time with the beat; a good dance gives power to your first move
    const feathers = Array.from({ length: DEVEE_TAPS }, () => h('i', { class: 'v-wr-feather' }));
    const deveeBtn = h('button', { class: 'btn primary big', onclick: () => deveeTap() }, '🦅 ', L('Дэвэх (Space)', 'Flap (Space)'));
    const deveeBox = h('div', { class: 'v-wr-devee hidden' }, h('div', { class: 'v-wr-feathers' }, ...feathers), deveeBtn);
    const body = h('div', { class: 'v-wrestle' }, h('div', { class: 'eyebrow' }, cfg.ai ? `${L('Наадам', 'Naadam')} · ${L('Даваа', 'Round')} ${cfg.round}/9 · ${need} ${L('унагаалт', 'falls')} · ${'★'.repeat(Math.ceil(cfg.round / 3))}` : L('Найзтай барилдаан', 'Friendly match')),
      h('h2', null, `${live.name} · ${cfg.opp.name}`), cv, herald, score, msg, deveeBox, moves, timing, tail);
    const drawScore = () => rc(score, h('span', { class: 'me' }, live.name, ' ', '●'.repeat(st.a) + '○'.repeat(Math.max(0, need - st.a))), h('span', { class: 'them' }, '●'.repeat(st.b) + '○'.repeat(Math.max(0, need - st.b)), ' ', cfg.opp.name));
    const moveLabel = (id) => tx(R.MOVES.find((m) => m.id === id).name);
    const setPhase = (p) => {
      st.phase = p;
      moves.classList.toggle('hidden', p !== 'choose'); timing.classList.toggle('hidden', p !== 'timing'); deveeBox.classList.toggle('hidden', p !== 'devee');
      if (p === 'choose') rc(moves, ...R.MOVES.map((m) => h('button', { class: 'btn' + (m.id === st.lastPlayer ? ' v-wr-repeat' : ''), title: tx(m.fact), onclick: () => { st.move = m.id; st.t0 = performance.now(); setPhase('timing'); msg.textContent = L('Ногоон хэсэгт хүрэхэд дар!', 'Press when the marker is in the green!'); } },
        h('b', null, tx(m.name)), h('small', null, '> ' + m.beats.map(moveLabel).join(', ')))));
    };
    let raf = 0, lastT = performance.now();
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - lastT) / 1000); lastT = ts;
      st.off += (st.target - st.off) * Math.min(1, dt * 8);
      if (st.phase === 'devee') deveeBtn.classList.toggle('beat', deveeOnBeat(ts));
      if (st.phase === 'timing') { st.marker = (Math.sin(((ts - st.t0) / 1000) * barSpeed) + 1) / 2; marker.style.left = st.marker * 100 + '%'; if (ts - st.t0 > 5000) lock(); }
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
    function deveeOnBeat(ts) { const q = ((ts - st.devee.t0) % DEVEE_BEAT) / DEVEE_BEAT; return q < 0.2 || q > 0.84; }
    function deveeTap() {
      const d = st.devee; if (st.phase !== 'devee' || d.n >= DEVEE_TAPS) return;
      const good = deveeOnBeat(performance.now());
      feathers[d.n].classList.add(good ? 'good' : 'miss'); d.n++; d.f ^= 1; if (good) d.good++;
      if (good) TG.sfx.chime(); else TG.sfx.tap();
      if (d.n < DEVEE_TAPS) return;
      st.bonus = d.good * 0.06;
      msg.textContent = d.good >= 3 ? L(`Гоё дэвлээ! Бүргэд шиг! Эхний мэх +${Math.round(st.bonus * 100)}% хүчтэй.`, `Beautiful dance, like an eagle! First move +${Math.round(st.bonus * 100)}% power.`)
        : d.good ? L(`Дэвээ дууслаа. Эхний мэх +${Math.round(st.bonus * 100)}% хүчтэй.`, `Dance done. First move +${Math.round(st.bonus * 100)}% power.`) : L('Дэвээ хэмнэлээсээ алдлаа. Одоо барилдъя!', 'The dance was off the beat. Now wrestle!');
      setTimeout(() => { if (st.over) return; st.pose = ['grip', 'grip']; herald.remove(); setPhase('choose'); }, 900);
    }
    function lock() {
      if (st.phase !== 'timing') return;
      herald.remove();
      let power = Math.max(0, 1 - Math.abs(st.marker - 0.5) * 2 * sharp);
      if (st.bonus) { power = Math.min(1, power + st.bonus); st.bonus = 0; } // the eagle dance's power
      const repeated = st.move === st.lastPlayer;
      if (repeated) power *= 0.8; // the same move twice in a row is easier to read
      st.used[st.move] = (st.used[st.move] || 0) + 1;
      setPhase('wait');
      if (cfg.ai) {
        // the opponent studies you: in later rounds it often picks a move that beats the one you use most
        const fav = Object.entries(st.used).sort((a2, b2) => b2[1] - a2[1])[0][0];
        const read = repeated ? st.move : (Math.random() < 0.5 ? st.lastPlayer : fav);
        const smart = read && Math.random() < Math.min(0.72, 0.04 + cfg.round * 0.075);
        const counters = R.MOVES.filter((q) => q.beats.includes(read));
        const om = smart && counters.length ? TG.pick(counters).id : TG.pick(R.MOVES).id;
        const op = clamp(cfg.opp.skill + (Math.random() - 0.5) * Math.max(0.18, 0.5 - cfg.round * 0.035), 0.05, 1);
        apply(R.exchange(st.move, power, om, op), st.move, power, om, op);
      } else { cfg.remote.mine = { m: st.move, p: power }; net.send({ t: 'wr-move', m: st.move, p: +power.toFixed(2) }); msg.textContent = L('Өрсөлдөгчийг хүлээж байна…', 'Waiting for your opponent…'); }
    }
    function apply(r, mm, mp, om, op) {
      const wasRepeat = mm === st.lastPlayer;
      st.lastPlayer = mm; if (r) st.lastMove = r > 0 ? mm : om;
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
          cfg.ai ? (won && cfg.round < 9 ? h('button', { class: 'btn primary', onclick: () => { close(); tournament(cfg.round + 1); } }, L('Дараагийн даваа', 'Next round'), ' ▶')
            : h('button', { class: 'btn primary', onclick: () => { close(); tournament(1); } }, L('Шинэ Наадам', 'New Naadam'))) : null));
      if (cfg.remote && live) live.match = null;
    }
    const key = (e) => { if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (e.type === 'keydown' && !e.repeat) { if (st.phase === 'devee') deveeTap(); else lock(); } } };
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
        ['crop:carrot', L('Цэцэрлэгт үр тарьж, 3 удаа усалж, ургацаа хураа. Худгаас ус аваарай.', 'Plant seeds in the garden, water 3 times, then harvest. Refill water at the well.')],
        ['ui:book', L('Сургуулийн гэрт гэр барих, цагаан идээ хийх, Нууц товчоог сур. Сурснаа гэр бүлтэйгээ хий!', 'In the school ger learn to build a ger, make dairy foods and hear the Secret History. Then do it with your family!')],
        ['ui:ger', L('Гэр барих хичээлээ дуусгаад Нутагт өөрийн гэрээ бариарай.', 'Finish the ger lesson, then build your own ger in Nutag.')],
        ['ui:horse', L('Морины уяанаас морь унаж давхих, эсвэл уралдаанд оролцоорой!', 'Take a horse from the horse line to ride freely or race!')],
        ['ui:heart', L('Нэг өрөөний найзууд нэг цэцэрлэгт хамт тарьж, бие биеийнхээ ургамлыг усална.', 'Friends in the same room share one garden and can water each other\'s plants.')],
      ].map(([e, t]) => h('div', { class: 'v-row' }, icon(e), h('div', { class: 'v-row-b' }, t)))),
      h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => close() }, L('Эхлэх', "Let's go"))), { cls: 'v-modal', onClose: () => { const v = V(); if (v) { v.tips = true; S.save(); } } });
  }
})(window.TG);
