/* Түүхчийн даалгавар: the historian in Нутаг sends you across the aimags to find things from history, and sometimes to
   defend the homeland. Find steps place an item beside a real landmark on that province's trip map. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const STEPS = [
    { find: 'khentii', near: 1, e: '🏹', item: T('Чингисийн үеийн төмөр зэв', 'An iron arrowhead from Chinggis Khaan’s time'),
      fact: T('Монгол дайчид ихэвчлэн мориноос нум сумаар харваж байлддаг, нэг дайчин хоёр гурван морьтой явдаг байжээ.', 'Mongol warriors mostly shot bows from horseback, and a rider often took two or three horses.') },
    { battle: 'merkit' },
    { find: 'uvurkhangai', near: 0, e: '🪙', item: T('Хархорумын зоос', 'A coin from Karakorum'),
      fact: T('Эзэнт гүрний үед Хархорумд олон орны худалдаачин, элч ирдэг олон улсын хот байжээ.', 'In the empire’s days Karakorum was an international city where merchants and envoys came from many lands.') },
    { battle: 'tatar' },
    { find: 'selenge', near: 2, e: '🖼️', item: T('Хиагтын 1921 оны хуучин гэрэл зураг', 'An old photograph of Khiagt in 1921'),
      fact: T('1921 оны 3 дугаар сарын 18-нд Хиагтад ялсан өдрийг Монгол цэргийн өдөр болгон тэмдэглэдэг.', 'The victory at Khiagt on 18 March 1921 is celebrated as Mongolian Armed Forces Day.') },
    { battle: 'khiagt' },
    { find: 'dornod', near: 1, e: '🎖️', item: T('Халх голын дурсгалын тэмдэг', 'A Khalkh Gol memorial badge'),
      fact: T('Халх голын тулалдааны газруудыг Дорнод аймагт хамгаалж, жил бүр дурсан хүндэтгэдэг.', 'The Khalkh Gol battle sites in Dornod are protected and remembered every year.') },
    { battle: 'khalkhgol' },
    { find: 'khuvsgul', near: 2, e: '🦌', item: T('Буган хөшөөний сийлбэрийн хуулбар', 'A rubbing of a deer-stone carving'),
      fact: T('Буган хөшөөг 3000 орчим жилийн өмнө босгосон. Дээр нь нисэж яваа мэт буга сийлсэн байдаг.', 'Deer stones were raised about 3,000 years ago, carved with deer that seem to fly.') },
    { find: 'arkhangai', near: 2, e: '📜', item: T('Тайхар чулууны бичээсийн хуулбар', 'A copy of the Taikhar Rock inscriptions'),
      fact: T('Тайхар чулуун дээр олон эрин үеийн бичээс бий. Архангайн Хөшөө Цайдамд Түрэгийн бичээст хөшөөнүүд бий.', 'Taikhar Rock carries writing from many eras, and Khöshöö Tsaidam in Arkhangai has inscribed Turkic monuments.') },
  ];
  const st = () => { const p = S.active(); if (!p) return null; p.hist = p.hist || { step: 0, done: false }; return p.hist; };
  const cur = () => { const s = st(); return s ? STEPS[s.step] : null; };
  const won = (id) => { const p = S.active(), c = p && p.village && p.village.camp; return !!(c && c.won && c.won[id]); };
  /** Something to hand in, or a new task to hear about: the historian shows a green marker. */
  function ready() { const s = st(), q = cur(); if (!s || !q) return false; return s.done || (q.battle && won(q.battle)); }
  function target(aimagId) { const s = st(), q = cur(); return q && q.find === aimagId && !s.done ? q : null; }
  function found(aimagId) {
    const s = st(), q = cur(); if (!q || q.find !== aimagId || s.done) return null;
    s.done = true; S.save(); TG.sfx.win(); TG.confetti(50);
    return q;
  }
  function battleWon(id) { const s = st(), q = cur(); if (q && q.battle === id) { s.done = true; S.save(); } }
  function open() {
    const s = st(); if (!s) return;
    const body = h('div');
    const draw = () => {
      const q2 = cur(), done = s.done || (q2 && q2.battle && won(q2.battle));
      const a = q2 && q2.find ? TG.aimags.byId(q2.find) : null, ch = q2 && q2.battle ? TG.battles.byId(q2.battle) : null;
      body.replaceChildren(
        h('h2', null, '📚 ', L('Түүхч Нарангэрэл', 'Narangerel the historian')),
        h('p', { class: 'muted' }, L(`Даалгавар ${Math.min(s.step + 1, STEPS.length)}/${STEPS.length}`, `Task ${Math.min(s.step + 1, STEPS.length)}/${STEPS.length}`)),
        !q2 ? h('p', null, L('Чи бүх даалгаврыг биелүүллээ! Жинхэнэ түүхч боллоо. 🏆', 'You finished every task! You are a real historian. 🏆'))
          : done ? h('div', null, h('p', null, q2.find ? L(`Олж ирсэн үү! ${q2.e} ${q2.item.mn}`, `You found it! ${q2.e} ${q2.item.en}`) : L(`${ch.name.mn}-д ялсан чинь сайхан!`, `Well done defending in “${ch.name.en}”!`)),
              h('button', { class: 'btn primary block', onclick: () => handIn(q2) }, L('Түүхчид өгөх', 'Hand it to the historian')))
          : q2.find ? h('div', null, h('p', null, L(`${a.name.mn} аймагт очиж ${q2.e} ${q2.item.mn}-г олоод ирээрэй. Үзвэрийн дэргэд гялалзаж байгаа.`, `Go to ${a.name.en} and find ${q2.e} ${q2.item.en.toLowerCase()}. It sparkles beside one of the sights.`)),
              h('button', { class: 'btn primary block', onclick: () => { close(); TG.travel.open(q2.find); } }, '🚌 ', L(`${a.name.mn} руу аялах`, `Travel to ${a.name.en}`)))
            : h('div', null, h('p', null, L(`Жанжинд очиж “${ch.name.mn}” (${ch.year.mn}) тулалдаанд нутгаа хамгаал.`, `Go to the General and defend the land in “${ch.name.en}” (${ch.year.en}).`)),
              h('button', { class: 'btn primary block', onclick: () => { close(); TG._village && TG._village.general(); } }, '⚔️ ', L('Жанжин руу', 'To the General'))));
    };
    function handIn(q2) {
      s.step++; s.done = false; S.save();
      TG.villageReward && TG.villageReward(30, 50); TG.achievements && TG.achievements.check();
      body.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'v-fact-e' }, q2.e || '🏆'), h('h2', null, L('Баярлалаа!', 'Thank you!')),
        q2.fact ? h('div', { class: 'teach' }, h('b', null, '💡 ', L('Түүх', 'History')), h('p', null, tx(q2.fact))) : null,
        h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: draw }, L('Дараагийн даалгавар', 'Next task'), ' →')));
    }
    const drawRaw = draw;
    const talk = () => { drawRaw(); const p = body.querySelector('p:not(.muted)'); if (p && TG.voice) TG.voice.babble(p.textContent, 'historian'); };
    talk();
    const close = TG.modal(body, { cls: 'v-modal' });
  }
  TG.history = { STEPS, open, ready, target, found, battleWon, step: () => (st() || { step: 0 }).step };
})(window.TG);
