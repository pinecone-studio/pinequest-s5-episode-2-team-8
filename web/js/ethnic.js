/* Ястан ба дүр: after registering, a child picks their ethnic group, is placed in that group's home region,
   then dresses their character in a traditional outfit before entering Нутаг. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  // E(id, name mn, name en, home aimags (first = default), hat, deel, fact mn, fact en)
  const E = (id, mn, en, aimags, hat, deel, fmn, fen) => ({ id, name: T(mn, en), aimags, hat, deel, fact: T(fmn, fen) });
  const ETHNIC = [
    E('khalkh', 'Халх', 'Khalkh', ['ub', 'tuv', 'arkhangai', 'uvurkhangai', 'khentii', 'dundgovi', 'bulgan', 'selenge', 'bayankhongor', 'umnugovi', 'dornogovi', 'govisumber', 'darkhanuul', 'orkhon', 'zavkhan', 'govialtai', 'sukhbaatar', 'dornod', 'khuvsgul'], 'mongol', 'blue',
      'Монголын хүн амын 80 гаруй хувь нь халх. Халх аялга бол монгол бичгийн хэлний үндэс.', 'Over 80% of Mongolians are Khalkh. The Khalkh dialect is the basis of standard Mongolian.'),
    E('kazakh', 'Казах', 'Kazakh', ['bayanolgii', 'khovd'], 'kazakh', 'black', 'Монголын хамгийн том цөөнх. Казах хэлээр ярьж, бүргэдээр ан хийдэг, хавар Наурыз баяр тэмдэглэдэг.', 'Mongolia’s largest minority. They speak Kazakh, hunt with golden eagles and celebrate Nauryz in spring.'),
    E('buriad', 'Буриад', 'Buryat', ['dornod', 'khentii', 'selenge', 'bulgan', 'khuvsgul'], 'buriad', 'teal', 'Шовх оройтой малгай, өнгөлөг дээлтэй. Ёохор бүжгээрээ алдартай.', 'Known for pointed hats, colourful deels and the yokhor circle dance.'),
    E('durvud', 'Дөрвөд', 'Dörvöd', ['uvs'], 'oirat', 'green', 'Баруун Монголын Ойрад угсааны том ястан. Биелгээ бүжиг нь алдартай.', 'A large Oirat (western Mongol) group, famous for the biyelgee dance.'),
    E('bayad', 'Баяд', 'Bayad', ['uvs'], 'oirat', 'purple', 'Увс аймагт голлон суудаг Ойрад ястан. Биелгээ, уртын дуугаар баян.', 'An Oirat people of Uvs, rich in biyelgee dances and long songs.'),
    E('zakhchin', 'Захчин', 'Zakhchin', ['khovd'], 'oirat', 'red', 'Ховд аймагт амьдардаг Ойрад ястан. “Захчин” нь “хил хамгаалагч” гэсэн утгатай гэдэг.', 'An Oirat people of Khovd. Their name is said to mean “border guards”.'),
    E('torguud', 'Торгууд', 'Torguud', ['khovd'], 'oirat', 'blue', 'Ховд аймгийн Булган суманд голлон амьдардаг Ойрад ястан.', 'An Oirat people living mainly in Bulgan district of Khovd.'),
    E('uuld', 'Өөлд', 'Ööld', ['khovd', 'arkhangai'], 'oirat', 'gold', 'Ойрадын эртний ястнуудын нэг. Ховд, Архангайд амьдардаг.', 'One of the oldest Oirat groups, living in Khovd and Arkhangai.'),
    E('uriankhai', 'Урианхай', 'Uriankhai', ['khovd', 'bayanolgii'], 'fur', 'brown', 'Алтайн уулархаг нутагт амьдардаг. Алтайн хадны зураг бүхий нутагтай.', 'Live in the Altai mountains, a land of ancient rock art.'),
    E('tsaatan', 'Цаатан (Духа)', 'Tsaatan (Dukha)', ['khuvsgul'], 'fur', 'brown', 'Хөвсгөлийн тайгад цаа буга маллаж, урцад амьдардаг.', 'Herd reindeer in the Khövsgöl taiga and live in tepee-like urts.'),
    E('darkhad', 'Дархад', 'Darkhad', ['khuvsgul'], 'fur', 'teal', 'Хөвсгөлийн Дархадын хотгорт амьдардаг ястан.', 'Live in the Darkhad valley of Khövsgöl.'),
    E('khotgoid', 'Хотгойд', 'Khotgoid', ['khuvsgul', 'zavkhan'], 'mongol', 'green', 'Хөвсгөл, Завханд амьдардаг ястан.', 'A people of Khövsgöl and Zavkhan.'),
    E('dariganga', 'Дарьганга', 'Dariganga', ['sukhbaatar'], 'mongol', 'red', 'Сүхбаатар аймагт амьдардаг. Мөнгөний дархчууд, хурдан морьдоороо алдартай.', 'From Sükhbaatar province, famous for silversmiths and fast horses.'),
    E('barga', 'Барга', 'Barga', ['dornod'], 'buriad', 'blue', 'Дорнод аймагт амьдардаг ястан.', 'A people of Dornod province.'),
    E('uzemchin', 'Үзэмчин', 'Üzemchin', ['dornod', 'sukhbaatar'], 'mongol', 'purple', 'Дорнод, Сүхбаатарын тал нутагт амьдардаг.', 'Live on the steppes of Dornod and Sükhbaatar.'),
    E('khoton', 'Хотон', 'Khoton', ['uvs'], 'oirat', 'gold', 'Увс аймагт амьдардаг цөөн тоот ястан.', 'A small ethnic group living in Uvs.'),
    E('myangad', 'Мянгад', 'Myangad', ['khovd'], 'oirat', 'green', 'Ховд аймагт амьдардаг ястан.', 'A people of Khovd province.'),
    E('tuva', 'Тува', 'Tuvan', ['khovd', 'bayanolgii'], 'fur', 'red', 'Ховд, Баян-Өлгийд амьдардаг. Хөөмийн урлагаараа алдартай.', 'Live in Khovd and Bayan-Ölgii, famous for throat singing.'),
  ];
  const byId = (id) => ETHNIC.find((e) => e.id === id);
  const SKINS = ['#F6D3B3', '#EDBB93', '#D9A06E', '#B97A4A'];
  const DEELS = ['blue', 'red', 'green', 'purple', 'teal', 'gold', 'brown', 'white', 'black', 'pink'];
  const HATS = [null, 'mongol', 'kazakh', 'buriad', 'oirat', 'fur'];

  function charCanvas(look, size = 96) {
    const c = h('canvas', { class: 'px-icon create-char', width: 16, height: 28, style: { width: size + 'px', height: Math.round(size * 28 / 16) + 'px' } });
    c.getContext('2d').drawImage(TG.pixel.char(look, 0, 0), 0, 0);
    return c;
  }
  /** Small landscape of a province (uses the passport's renderer when present). */
  function landCanvas(aimagId, w = 120, hh = 60) {
    const c = h('canvas', { class: 'create-land', width: w, height: hh });
    if (TG.passport) TG.passport.drawLand(c.getContext('2d'), aimagId, 1, w, hh);
    return c;
  }

  /** The character creator screen: ethnic group → home province → outfit → welcome. */
  function screen({ onDone }) {
    const p = S.active(), v = p.village = p.village || {};
    const d = { eth: p.eth || null, aimag: p.aimag || null, look: { deel: 'blue', skin: SKINS[0], hat: null, face: null, neck: null, pet: null, ...(v.look || {}) } };
    let step = d.eth ? 2 : 0, showAll = false;
    const wrap = h('div', { class: 'create-card px-card' });
    const prog = () => h('div', { class: 'auth-prog' }, [0, 1, 2, 3].map((k) => h('i', { class: k <= step ? 'on' : '' })));
    const basar = (txt) => h('div', { class: 'auth-basar' }, TG.basar.face(1, 44), h('p', null, txt));
    const nav = (back, next, nextLabel, disabled) => h('div', { class: 'row-btns' }, back != null ? h('button', { class: 'btn ghost', onclick: () => { step = back; draw(); } }, '←') : null,
      h('button', { class: 'btn primary', disabled: !!disabled, onclick: next }, nextLabel || L('Цааш →', 'Next →')));
    function draw() {
      const e = byId(d.eth);
      if (step === 0) {
        const fact = h('div', { class: 'aimag-fact' }, e ? [h('b', null, tx(e.name)), h('p', null, tx(e.fact))] : h('p', { class: 'muted' }, L('Ястнаа сонгоход тухайн ястны тухай баримт гарна.', 'Pick your ethnic group to read about it.')));
        wrap.replaceChildren(prog(), basar(L(`${p.name}, чи аль ястных вэ? Монголд 20 гаруй ястан амьдардаг!`, `${p.name}, which ethnic group are you from? Over 20 groups live in Mongolia!`)),
          h('div', { class: 'eth-grid' }, ETHNIC.map((x) => h('button', { class: 'eth' + (d.eth === x.id ? ' on' : ''), onclick: () => {
            d.eth = x.id; d.look.hat = x.hat; d.look.deel = x.deel; if (!x.aimags.includes(d.aimag)) d.aimag = x.aimags[0]; TG.sfx.tap(); draw();
          } }, charCanvas({ ...d.look, hat: x.hat, deel: x.deel }, 30), h('b', null, tx(x.name))))), fact,
          nav(null, () => { step = 1; draw(); }, null, !d.eth));
      } else if (step === 1) {
        const allowed = showAll ? TG.aimags.AIMAGS.map((a) => a.id) : e.aimags;
        const a = TG.aimags.byId(d.aimag);
        wrap.replaceChildren(prog(), basar(L(`${tx(e.name)} ард түмэн ихэвчлэн эдгээр нутагт амьдардаг. Чи хаана төрсөн бэ?`, `The ${tx(e.name)} people mostly live here. Where were you born?`)),
          a ? landCanvas(a.id, 160, 70) : null,
          h('div', { class: 'aimag-grid' }, allowed.map((id) => { const x = TG.aimags.byId(id); return h('button', { class: 'aimag' + (d.aimag === id ? ' on' : ''), onclick: () => { d.aimag = id; TG.sfx.tap(); draw(); } }, h('span', null, x.icon), h('b', null, tx(x.name))); })),
          !showAll && e.aimags.length < 22 ? h('button', { class: 'link-btn', onclick: () => { showAll = true; draw(); } }, L('Өөр аймагт төрсөн', 'I was born somewhere else')) : null,
          a ? h('div', { class: 'aimag-fact' }, h('b', null, a.icon, ' ', tx(a.name), ' · ', tx(a.center)), h('p', null, tx(a.fact))) : null,
          nav(0, () => { step = 2; draw(); }, null, !d.aimag));
      } else if (step === 2) {
        const opt = (list, key, render) => h('div', { class: 'v-chips create-opts' }, list.map((val) => h('button', { class: 'v-chip' + (d.look[key] === val ? ' active' : ''), onclick: () => { d.look[key] = val; TG.sfx.tap(); draw(); } }, render(val))));
        const HATN = { null: L('Малгайгүй', 'No hat'), mongol: L('Монгол', 'Mongol'), kazakh: L('Казах', 'Kazakh'), buriad: L('Буриад', 'Buryat'), oirat: L('Ойрад', 'Oirat'), fur: L('Үслэг', 'Fur') };
        wrap.replaceChildren(prog(), basar(L(`Одоо дүрээ хувцаслая! ${e ? tx(e.name) + ' ястны уламжлалт малгай, дээлээр эхэллээ.' : ''}`, `Now dress your character! ${e ? 'We started with the traditional ' + tx(e.name) + ' hat and deel.' : ''}`)),
          h('div', { class: 'create-preview' }, charCanvas(d.look, 110), h('div', null, h('b', null, p.name), h('small', null, [e ? tx(e.name) : '', TG.aimags.byId(d.aimag) ? tx(TG.aimags.byId(d.aimag).name) : ''].filter(Boolean).join(' · ')))),
          h('div', { class: 'label' }, L('Арьсны өнгө', 'Skin tone')), h('div', { class: 'v-chips create-opts' }, SKINS.map((c) => h('button', { class: 'v-chip v-swatch' + (d.look.skin === c ? ' active' : ''), style: { background: c }, 'aria-label': c, onclick: () => { d.look.skin = c; draw(); } }))),
          h('div', { class: 'label' }, L('Дээл', 'Deel')), h('div', { class: 'v-chips create-opts' }, DEELS.map((c) => h('button', { class: 'v-chip v-swatch' + (d.look.deel === c ? ' active' : ''), style: { background: TG.vrules.DEELS[c] }, 'aria-label': c, onclick: () => { d.look.deel = c; draw(); } }))),
          h('div', { class: 'label' }, L('Малгай', 'Hat')), opt(HATS, 'hat', (val) => HATN[val]),
          nav(1, () => { step = 3; draw(); }));
      } else {
        const a = TG.aimags.byId(d.aimag);
        wrap.replaceChildren(prog(), a ? landCanvas(a.id, 180, 80) : null,
          h('div', { class: 'create-welcome' }, charCanvas(d.look, 80), h('div', null,
            h('h2', null, L(`Сайн уу, ${p.name}!`, `Hello, ${p.name}!`)),
            h('p', null, L(`Чи ${a ? tx(a.name) : ''}-д төрсөн ${e ? tx(e.name) : ''} ${p.age} настай ${p.age >= 18 ? 'хүн' : 'хүүхэд'}.`, `You are a ${p.age}-year-old ${e ? tx(e.name) : ''} ${p.age >= 18 ? 'person' : 'child'} born in ${a ? tx(a.name) : ''}.`)),
            a ? h('small', { class: 'muted' }, a.icon, ' ', tx(a.fact)) : null)),
          basar(L('Нутагт хамтдаа явцгаая! Аймгийн паспортоор Монголоор аялж, нутгаа ч бас олоорой.', 'Let’s go to Nutag together! Travel Mongolia with your aimag passport and find your home province too.')),
          nav(2, finish, L('Нутаг руу орох ▶', 'Enter Nutag ▶')));
      }
    }
    function finish() {
      p.eth = d.eth; p.aimag = d.aimag; v.look = { ...(v.look || {}), ...d.look }; S.save();
      TG.achievements && TG.achievements.check(true);
      onDone();
    }
    draw();
    return h('div', { class: 'auth create' }, h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-brand' }, h('h1', null, L('Дүрээ бүтээ', 'Create your character'))), wrap,
      h('button', { class: 'link-btn auth-about', onclick: () => { if (!p.eth) p.eth = 'skip'; S.save(); onDone(); } }, L('Дараа нь', 'Later'))));
  }
  TG.ethnic = { ETHNIC, byId, screen, charCanvas, landCanvas };
})(window.TG);
