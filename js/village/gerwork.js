/* Building your own ger by hand, on your plot in Нутаг: you choose what comes next, do every step yourself,
   and Grandpa Craftsman laughs kindly and gives a hint when the order is wrong. Nothing is ever lost. */
(function (TG) {
  const { L, tx } = TG, R = TG.vrules;
  const T = (mn, en) => ({ mn, en });
  let api = null; // village.js hands over what this needs: V, live, net, reward, factCard, lotsArr, enterGer, colours, save

  const STEP = {
    shal: T('Шалаа тавих', 'Lay the floor'), khana: T('Ханаа дэлгэх', 'Unfold the walls'), khaalga: T('Хаалгаа уях', 'Tie the door'),
    toono: T('Тоноо өргөх', 'Lift the toono'), uni: T('Униа хатгах', 'Push in the roof poles'), esgii: T('Эсгий бүрэх', 'Wrap the felt'),
    buurees: T('Бүрээс хучих', 'Pull on the cover'), buslvvr: T('Бүслүүр чангалах', 'Tighten the ropes'), tulga: T('Тулга тавих', 'Set up the stove'),
  };
  const PART = {
    khana: T('хана', 'wall lattices'), khaalga: T('хаалга', 'a door'), toono: T('тооно', 'a toono'), bagana: T('багана', 'posts'), uni: T('унь', 'roof poles'),
    esgii: T('эсгий', 'felt'), buurees: T('бүрээс', 'a cover'), buslvvr: T('бүслүүр', 'ropes'),
  };
  // where a missing part comes from
  const FROM = { esgii: T('Хонио хяргаж, ноосоор эсгий хий.', 'Shear sheep and make felt from the wool.'), buurees: T('Дэлгүүрээс авна.', 'The shop sells it.') };
  const FROM_GRANDPA = T('Мужаан өвөөгөөс авна.', 'Grandpa Craftsman makes it.');
  // grandpa's hint: what comes next, and why (from the ger lesson)
  const WHY = {
    shal: T('Эхлээд тэгш газар шалаа тавина. Тэгш шал гэрийг тэгш, бат бөх болгоно.', 'First lay the floor on flat ground: a level floor keeps the ger straight and strong.'),
    khana: T('Шалан дээр ханаа тойруулан дэлгэнэ. Хана бол эвхэгддэг тор.', 'Next, stand the folding lattice walls in a circle on the floor.'),
    khaalga: T('Хоёр ханын дунд хаалгаа уяна. Хаалга урагшаа харна.', 'Tie the door between two walls, facing south.'),
    toono: T('Одоо тоноо хоёр баганаар тулж өргөнө. Үүнийг хоёр хүн хамт хийдэг.', 'Now lift the toono up on its two posts. Two people do this together.'),
    uni: T('Униа тоононд хатгаад ханын толгойд уяна, дөрвөн зүгт ээлжлэн.', 'Push the roof poles into the toono and tie them to the walls, taking turns all around.'),
    esgii: T('Хана, униа ноосон эсгийгээр бүрнэ. Эсгий өвлийн хүйтнээс хамгаална.', 'Wrap the walls and roof in wool felt to keep out the winter cold.'),
    buurees: T('Эсгийн гадуур цагаан бүрээс хучина: бороо, нарнаас хамгаална.', 'Pull the white cover over the felt: it keeps out rain and sun.'),
    buslvvr: T('Гурван бүслүүрээр бүсэлбэл гэр хүчтэй салхинд ч хөдлөхгүй.', 'Three ropes around the ger keep it steady even in strong wind.'),
    tulga: T('Сүүлд нь голд тулгаа тавьж, анхны цайгаа чанана.', 'Last, set the stove in the middle and make the first tea.'),
  };

  const g = () => api.V().ger;
  const young = () => ((TG.store.active() || {}).age || 99) < 9;

  // ---------------------------------------------------------------- the stage art: the lesson's ger, at this point of the build
  function gerArt(stage) {
    return (x, t, st) => {
      x.save(); x.translate(20, 20);
      const q = st && st.n ? st.progress / st.n : 0, sub = R.GER_STEPS[stage] === 'khana' || R.GER_STEPS[stage] === 'uni';
      if (sub && st && st.kind !== 'choose') TG.scenes.ger(x, { stage: stage + 1, sub: q }, t); // walls and poles go up one by one
      else {
        TG.scenes.ger(x, { stage }, t);
        if (q > 0 && st.kind !== 'choose') { x.globalAlpha = q; TG.scenes.ger(x, { stage: stage + 1 }, t); x.globalAlpha = 1; }
      }
      x.restore();
    };
  }
  /** The hands-on task for one building step. */
  function stepSpec(step) {
    const stage = g().stage, art = gerArt(stage), title = STEP[step], spec = (o) => ({ title, art, ...o });
    const uniSpots = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return [Math.round(80 + Math.cos(a) * 30), Math.round(62 + Math.sin(a) * 9)]; });
    const sideOf = ([x, y]) => (x > 96 ? 0 : x < 64 ? 2 : y > 62 ? 1 : 3);
    switch (step) {
      case 'shal': return spec({ kind: 'spots', hint: T('Шалны банзнуудыг нэг нэгээр нь тавь.', 'Lay the floor boards one by one.'), spots: [[52, 84], [68, 85], [92, 85], [108, 84]] });
      case 'khana': return spec({ kind: 'drag', n: 5, hint: T('Хана бүрийг шараар нь чирж дэлгэ. 5 хана!', 'Drag each lattice open by its gold handle. 5 walls!'), path: [[52, 74], [108, 74]] });
      case 'khaalga': return spec({ kind: 'turn', start: Math.PI, target: Math.PI / 2, tol: 0.35, hint: T('Хаалгыг эргүүлж урд зүг (доош) харуулаад тавь.', 'Turn the door to face south (down), then let go.'),
        onMiss: () => TG.tasks.say(T('Өвөө: Урд зүгээс нар тусдаг, хойд зүгээс хүйтэн салхи үлээдэг. Хаалгаа урагш харуулъя!', 'Grandpa: The sun comes from the south and cold winds from the north. Face the door south!')) });
      case 'toono': return spec({ kind: 'hold', holders: 2, two: 'help', ms: 1500, hint: TG.tasks.players() === 2 ? T('Хоёулаа зэрэг дарж байгаад тоноо өргө!', 'Both hold at the same time to lift the toono!') : T('Дарж байгаад өргө. Нөгөө баганыг өвөө барьж байна.', 'Hold to lift. Grandpa is holding the other post.') });
      case 'uni': return spec({ kind: 'spots', spots: uniSpots, side: uniSpots.map(sideOf), rule: R.unisTilt, hint: T('Униа дөрвөн зүгт ээлжлэн хатга, тооно тэгш байх ёстой.', 'Push the poles in all around, so the toono stays level.'),
        onMiss: () => TG.tasks.say(T('Өвөө: Тооно хазайчихлаа! Нөгөө талд нь унь хатга.', 'Grandpa: The toono is tilting! Put a pole on the other side.')) });
      case 'esgii': return spec({ kind: 'drag', n: 2, hint: T('Эсгийг гэрийн эргэн тойронд ороо.', 'Wrap the felt around the ger.'), path: [[52, 60], [108, 60]] });
      case 'buurees': return spec({ kind: 'drag', n: 1, hint: T('Цагаан бүрээсийг дээрээс доош тат.', 'Pull the white cover down over the felt.'), path: [[80, 36], [80, 84]] });
      case 'buslvvr': return spec({ kind: 'hold', holders: 1, ms: 900, n: 3, hint: T('Бүслүүр бүрийг дарж байгаад чангал.', 'Hold to pull each rope tight.') });
      case 'tulga': return spec({ kind: 'spots', hint: T('Голд нь тулгаа тавьж, анхны цайгаа чана.', 'Set the stove in the middle and make the first tea.'), spots: [[80, 78]] });
    }
    return null;
  }

  // ---------------------------------------------------------------- the plot
  /** Keep the local copy of my plot (solo play) in step with my build, and tell the room when online. */
  function putLot(i, stage, first) {
    const v = api.V(), live = api.live(), local = v.lots, own = local.findIndex((l) => l && l.by === v.id), at = own >= 0 ? own : i; // one local copy, wherever it is
    local[at] = Object.assign(own >= 0 ? local[own] : { by: v.id, n: live ? live.name : '', roof: 'blue', door: 'red', furn: [] }, { stage });
    if (live && live.online) {
      if (first || !(live.lots || []).some((l) => l && l.by === v.id)) api.net.send({ t: 'ger-claim', i, roof: local[i].roof, door: local[i].door, stage });
      else api.net.send({ t: 'ger-stage', stage });
    }
    api.save(); api.refresh();
  }
  /** On joining a room (or starting solo): a ger part-way up comes along to a free plot. */
  function sync() {
    const v = api.V(), live = api.live(), G = g();
    if (!live || G.stage < 1) return;
    if (!live.online) { // solo: your ger lives on your own local plot (the room may have given you another number)
      const own = v.lots.findIndex((l) => l && l.by === v.id);
      if (own >= 0) { if (R.lotStage(v.lots[own]) !== G.stage) { v.lots[own].stage = G.stage; api.save(); } return; }
      const i = !v.lots[G.lot] && G.lot >= 0 ? G.lot : v.lots.findIndex((l) => !l); if (i >= 0) putLot(i, G.stage); return;
    }
    const lots = live.lots || [], at = lots.findIndex((l) => l && l.by === v.id);
    if (at >= 0) { G.lot = at; if (R.lotStage(lots[at]) < G.stage) api.net.send({ t: 'ger-stage', stage: G.stage }); return; }
    const i = !lots[G.lot] ? G.lot : lots.findIndex((l) => !l);
    if (i < 0) return TG.toast(L('Энэ өрөөнд сул газар алга. Гэр чинь зөвхөн чамд харагдана.', 'No free plot in this room. Your ger shows only for you.'));
    G.lot = i; const l = v.lots[i] || {};
    api.net.send({ t: 'ger-claim', i, roof: l.roof || 'blue', door: l.door || 'red', stage: G.stage }); api.save();
  }

  // ---------------------------------------------------------------- building
  let busy = false, together = false;
  /** Build (or keep building) a ger on plot i, one hands-on step at a time. */
  async function build(i) {
    const v = api.V(), G = g();
    if (busy || G.stage >= R.GER_DONE) return;
    if (G.stage > 0) i = G.lot; // your ger is already going up on its own plot
    busy = true; together = false;
    let wrongHere = 0, say = null;
    try {
      while (G.stage < R.GER_DONE) {
        const options = R.GER_STEPS.filter((s, k) => k >= G.stage && Object.entries(R.GER_NEEDS[s]).every(([p, n]) => (G.parts[p] || 0) >= n))
          .map((s) => ({ id: s, icon: TG.pixel.iconCanvas(s === 'shal' || s === 'tulga' ? 'part:' + s : 'part:' + Object.keys(R.GER_NEEDS[s])[0]), label: STEP[s] }));
        const r = await TG.tasks.run({ kind: 'choose', title: T('Дараа нь юу хийх вэ?', 'What comes next?'), hint: T('Гэрийнхээ дараагийн хэсгийг сонго.', 'Choose the next part of your ger.'), options, art: gerArt(G.stage), say, shake: !!say });
        say = null;
        if (!r.done) return;
        const res = R.gerTry(G.stage, r.pick, G.parts);
        if (!res.ok && res.why === 'order') { // a gentle sag: grandpa laughs and helps, nothing is lost
          G.mistakes++; wrongHere++; api.save();
          const name = wrongHere >= (young() ? 1 : 2);
          say = TG.learn && TG.learn.done('ger') ? T(`Өвөө: Дараа нь “${STEP[res.next].mn}”.`, `Grandpa: Next comes “${STEP[res.next].en}”.`)
            : name ? T(`Өвөө: Хэ хэ, гэр унжчихлаа! ${WHY[res.next].mn}`, `Grandpa: Ha ha, the ger is sagging! ${WHY[res.next].en}`)
              : T('Өвөө: Хэ хэ, гэр унжчихлаа! Юуг нь эхэлж хийдэг билээ?', 'Grandpa: Ha ha, the ger is sagging! What comes first?');
          continue;
        }
        if (!res.ok) { // parts missing: say what, and who has them
          const miss = Object.keys(res.missing || {});
          TG.toast('🧰 ' + L('Дутуу: ', 'Missing: ') + miss.map((p) => tx(PART[p])).join(', ') + '. ' + tx(FROM[miss[0]] || FROM_GRANDPA));
          return;
        }
        wrongHere = 0;
        const step = r.pick, sr = await TG.tasks.run(stepSpec(step));
        if (!sr.done) return;
        if (sr.together) together = true;
        G.parts = R.gerUse(G.parts, step); G.stage++; G.mistakes += sr.mistakes || 0;
        if (G.stage === 1) G.lot = i;
        putLot(G.lot, G.stage, G.stage === 1);
      }
      finish(G.lot);
    } finally { busy = false; }
  }
  function finish(i) {
    const v = api.V(), G = g(), p2 = (api.live() || {}).p2;
    v.gerBuilt = true; G.perfect = G.mistakes === 0;
    TG.store.logActivity({ kind: 'hand', id: 'ger' }); // the parents' log: built by hand
    api.reward(0, 30); api.quest('ger'); TG.sfx.win(); TG.confetti(70);
    if (together && p2) TG.store.logActivity && TG.store.logActivity({ kind: 'together', id: 'ger|family|' + p2.name });
    api.save(); TG.achievements && TG.achievements.check();
    const lesson = TG.learn && TG.learn.byId('ger'), { h } = TG;
    const close = TG.modal(h('div', { class: 'center v-fact' },
      h('div', { class: 'v-fact-e' }, TG.pixel.icon('ui:ger', 72)),
      h('h2', null, L('Гэр бэлэн боллоо! 🎉', 'Your ger is ready! 🎉')),
      h('div', { class: 'teach' }, h('b', null, '💡 ', L('Мэдсэн үү?', 'Did you know?')), h('p', null, G.perfect ? L('Нэг ч алдаагүй барилаа! Монгол гэрийг гэр бүлээрээ 1–2 цагт барьдаг.', 'Built without a single slip! A family puts up a Mongol ger in 1–2 hours.') : L('Монгол гэрийг гэр бүлээрээ 1–2 цагт барьж, буулгаж болдог. Хаалга нь урагшаа харна.', 'A family can put up or take down a Mongol ger in 1–2 hours. Its door faces south.'))),
      lesson && lesson.family ? TG.learn.familyCard(lesson) : null,
      h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: () => { close(); api.colours(i); } }, L('Өнгийг нь сонгох', 'Choose its colours'))), { cls: 'v-modal' });
  }

  // ---------------------------------------------------------------- gathering: wool, felt and the wooden parts
  const shearable = (i) => Date.now() - ((api.V().shorn || {})[i] || 0) > R.SHEAR_REGROW_MS;
  /** Shear one sheep: blunt shears, a calm sheep, two handfuls of wool. */
  async function shear(i) {
    const v = api.V(), sheep = TG.pixel.animal('sheep', 0);
    if (!shearable(i)) return TG.toast('🐑 ' + L('Энэ хонины ноос дахин ургаж байна. Өөр хонь хярга!', 'This sheep’s wool is still growing back. Try another sheep!'));
    const r = await TG.tasks.run({ kind: 'drag', n: 3, title: T('Хонь хяргах', 'Shear a sheep'), path: [[44, 52], [116, 52]],
      hint: T('Хайч нь мохоо үзүүртэй, хонь тайван байна. Нуруугаар нь чирж ноосыг нь хярга.', 'The shears have blunt tips and the sheep is calm and unharmed. Drag along its back to shear the wool.'),
      art: (x, t, st) => { const sc = 5, w = sheep.width * sc, X = Math.round(80 - w / 2), Y = 30, q = st.progress / st.n; x.fillStyle = '#76b947'; x.fillRect(0, 84, 160, 36); x.drawImage(sheep, X, Y, w, sheep.height * sc); x.save(); x.beginPath(); x.rect(X, Y, w * q, sheep.height * sc); x.clip(); x.drawImage(TG.pixel.shorn(sheep), X, Y, w, sheep.height * sc); x.restore(); } });
    if (!r.done) return;
    v.shorn = v.shorn || {}; v.shorn[i] = Date.now(); g().wool += R.SHEAR_WOOL;
    api.quest('shear'); api.reward(0, 4); TG.toast('🧶 ' + L(`+${R.SHEAR_WOOL} ноос. Ноосоор эсгий хийнэ.`, `+${R.SHEAR_WOOL} wool. Wool becomes felt.`)); api.save(); api.refresh();
  }
  const fluffArt = (n) => (x) => { x.fillStyle = '#a46d3b'; x.fillRect(24, 70, 112, 26); x.fillStyle = '#8a5a33'; x.fillRect(24, 94, 112, 2); for (let i = 0; i < n; i++) { const X = 40 + (i % 5) * 18, Y = 62 - Math.floor(i / 5) * 8; x.fillStyle = '#2b1e2e'; x.fillRect(X - 1, Y - 1, 16, 10); x.fillStyle = '#f6f2e9'; x.fillRect(X, Y, 14, 8); } };
  const feltSpec = () => {
    const G = g(), two = TG.tasks.players() === 2;
    if (G.mats >= 1) return { step: 'roll', spec: { kind: 'rhythm', n: 10, water: true, two: 'help', speed: 0.9, win: 0.24, title: T('Эсгий өнхрүүлэх', 'Roll the felt'),
      hint: two ? T('Нэг нь хэмнэлтэй өнхрүүл, нөгөө нь хатахад ус цац! Эрт үед эсгийг морьдоор чирж өнхрүүлдэг байжээ.', 'One rolls in rhythm, the other sprinkles water when it dries! Long ago, horses pulled the felt roll.')
        : T('Басар өнхрүүлж байна. Хатахад нь цэнхэр дусал дээр дарж ус цац!', 'Basar pulls the roll. When it dries, tap the blue drop to sprinkle water!'),
      art: (x, t) => { x.fillStyle = '#76b947'; x.fillRect(0, 70, 160, 50); const rx = 40 + ((t * 20) % 60); x.fillStyle = '#2b1e2e'; x.fillRect(rx - 13, 55, 34, 22); x.fillStyle = '#d8c8a8'; x.fillRect(rx - 12, 56, 32, 20); x.fillStyle = '#b8a47e'; for (let i = 0; i < 4; i++) x.fillRect(rx - 12 + i * 8, 56, 2, 20); if (!two) x.drawImage(TG.pixel.bankhar(1 + (Math.floor(t * 6) % 2)), rx + 26, 58); } } };
    if (G.fluff >= R.FELT_WOOL) return { step: 'lay', spec: { kind: 'spots', title: T('Ноос дэлгэж норгох', 'Lay and wet the wool'),
      hint: T('Ноосоо давхарлаж дэлгээд, дээрээс нь ус цац. Ус, дулаан ноосыг хооронд нь наалдуулна.', 'Spread the wool in layers, then sprinkle water on top. Water and warmth make the fibres stick together.'),
      spots: [[48, 74], [72, 74], [96, 74], [120, 74], [56, 50], [84, 46], [112, 50]], art: (x, t, st) => fluffArt(Math.min(4, st.progress) * 2)(x) } };
    if (G.wool >= 1) return { step: 'beat', spec: { kind: 'rhythm', n: 8, speed: 0.9, win: 0.24, title: T('Ноос цохих', 'Beat the wool'),
      hint: T('Хоёр саваагаар ноосоо хэмнэлтэй цохиж сэвсийлгэ. Тэгвэл эсгий жигд болно.', 'Beat the wool with two sticks, in rhythm, to fluff it up so the felt comes out even.'),
      art: (x, t, st) => { fluffArt(Math.max(2, 8 - st.progress))(x); const up = Math.floor(t * 6) % 2; x.fillStyle = '#6b4220'; x.fillRect(46, 30 + up * 8, 4, 30); x.fillRect(110, 38 - up * 8, 4, 30); } } };
    return null;
  };
  /** The felt spot does the next felt step: beat the wool, lay and wet it, or roll it into felt. */
  async function felt() {
    const G = g(), f = feltSpec();
    if (!f) return TG.toast('🐑 ' + L('Эхлээд хонио хяргаж ноос ав.', 'Shear a sheep first to get wool.'));
    const r = await TG.tasks.run(f.spec);
    if (!r.done) return;
    if (f.step === 'beat') { G.fluff += G.wool; G.wool = 0; TG.toast('☁️ ' + L('Ноос сэвсийлээ!', 'The wool is fluffy!')); }
    else if (f.step === 'lay') { G.fluff -= R.FELT_WOOL; G.mats++; TG.toast('💧 ' + L('Нойтон ноос бэлэн. Одоо өнхрүүлнэ!', 'Wet wool ready. Now roll it!')); }
    else {
      G.mats--; G.parts.esgii = (G.parts.esgii || 0) + 1; api.quest('felt'); api.reward(5, 10);
      if (r.together) { const p2 = (api.live() || {}).p2; if (p2 && TG.store.logActivity) TG.store.logActivity({ kind: 'together', id: 'ger|family|' + p2.name }); }
      TG.toast('🧶 ' + L(`Эсгий бэлэн боллоо! (${G.parts.esgii}/2)`, `A felt is ready! (${G.parts.esgii}/2)`));
    }
    api.save(); api.refresh();
  }
  const feltLabel = () => { const f = feltSpec(); return !f ? L('Эсгий хийх', 'Make felt') : f.step === 'roll' ? L('Эсгий өнхрүүлэх', 'Roll felt') : f.step === 'lay' ? L('Ноос дэлгэх', 'Lay wool') : L('Ноос цохих', 'Beat wool'); };
  // Grandpa Craftsman's trades: goods from your herd, or coins
  const HAVE = { wool: () => g().wool, aaruul: () => (api.V().produce || {}).aaruul || 0, urum: () => (api.V().produce || {}).urum || 0, coins: () => api.V().coins };
  const GOOD = { wool: T('ноос', 'wool'), aaruul: T('ааруул', 'aaruul'), urum: T('өрөм', 'öröm'), coins: T('зоос', 'coins') };
  const MADE = { khana: T('Бургасаар хийсэн эвхэгддэг тор', 'Folding lattice made of willow'), khaalga: T('Урагш харах будагтай хаалга', 'A painted door that faces south'),
    toono: T('Тооно, хоёр багана, гурван бүслүүр', 'The crown, two posts and three ropes'), uni: T('Шинэс модоор хийсэн 9 унь', 'Nine roof poles of larch wood') };
  const canPay = (cost) => Object.entries(cost).every(([k, n]) => HAVE[k]() >= n);
  function pay(cost) { const v = api.V(), G = g(); for (const [k, n] of Object.entries(cost)) { if (k === 'coins') continue; if (k === 'wool') G.wool -= n; else v.produce[k] -= n; } }
  /** The trade list in Grandpa Craftsman's talk. */
  function tradeList(redraw) {
    const { h } = TG, G = g(), costTxt = (c) => Object.entries(c).map(([k, n]) => `${n} ${tx(GOOD[k])}`).join(' + ');
    return h('div', { class: 'v-trade v-list' }, R.TRADES.map((t) => {
      const goods = R.tradeCost(t.id, 'goods'), coins = R.tradeCost(t.id, 'coins'), have = Object.entries(t.gives).every(([k, n]) => (G.parts[k] || 0) >= n);
      const btn = (kind, cost) => h('button', { class: 'btn sm' + (kind === 'coins' ? '' : ' primary'), 'data-trade': t.id, 'data-pay': kind, disabled: !canPay(cost), title: canPay(cost) ? '' : L('Хүрэлцэхгүй байна', 'Not enough'),
        onclick: async () => { if (!canPay(cost)) return; if (cost.coins && !(await api.spendCoins(cost.coins))) return; pay(cost); for (const [k, n] of Object.entries(t.gives)) G.parts[k] = (G.parts[k] || 0) + n; TG.sfx.chime && TG.sfx.chime(); TG.toast('🪵 ' + Object.keys(t.gives).map((k) => tx(PART[k])).join(', ') + L(' авлаа!', ' — got it!')); api.save(); api.refresh(); redraw(); } }, costTxt(cost));
      return h('div', { class: 'v-row' }, TG.pixel.icon('part:' + t.id, 32), h('div', { class: 'v-row-b' }, h('b', null, Object.keys(t.gives).map((k) => `${tx(PART[k])} ×${t.gives[k]}`).join(', ')), h('small', null, have ? L('✓ Танд байгаа', '✓ You have these') : tx(MADE[t.id]))),
        h('div', { class: 'row-btns' }, btn('goods', goods), btn('coins', coins)));
    }));
  }

  TG.gerwork = { init: (a) => { api = a; }, partName: (k) => tx(PART[k] || T(k, k)), build, stepSpec, sync, busy: () => busy, shear, shearable, felt, feltLabel, tradeList, feltSpec };
})(window.TG);
