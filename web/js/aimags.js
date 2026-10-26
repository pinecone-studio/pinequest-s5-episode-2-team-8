/* 21 аймаг + Улаанбаатар: children pick where they (or their family) come from. Each place has its centre and a fact. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const A = (id, mn, en, cmn, cen, fmn, fen, icon) => ({ id, name: T(mn, en), center: T(cmn, cen), fact: T(fmn, fen), icon });
  const AIMAGS = [
    A('ub', 'Улаанбаатар', 'Ulaanbaatar', 'Нийслэл', 'Capital city', '1639 онд Өргөө нэрээр байгуулагдсан нийслэл. Дэлхийн хамгийн хүйтэн нийслэл!', 'Founded in 1639 as Örgöö. The coldest capital city in the world!', '🏙️'),
    A('arkhangai', 'Архангай', 'Arkhangai', 'Цэцэрлэг', 'Tsetserleg', 'Тэрхийн Цагаан нуур, Хорго галт уул энд бий.', 'Home of Terkhiin Tsagaan Lake and the Khorgo volcano.', '🌋'),
    A('bayanolgii', 'Баян-Өлгий', 'Bayan-Ölgii', 'Өлгий', 'Ölgii', 'Монголын хамгийн өндөр Хүйтэн оргил (4374 м) Таван богдод. Бүргэдийн баяраараа алдартай.', 'Mongolia’s highest peak, Khüiten (4,374 m), is in Tavan Bogd. Famous for its eagle festival.', '🦅'),
    A('bayankhongor', 'Баянхонгор', 'Bayankhongor', 'Баянхонгор', 'Bayankhongor', 'Хангай, говь хоёулаа бий. Орог нуур энд оршдог.', 'Both mountains and Gobi desert, plus Orog Lake.', '🏜️'),
    A('bulgan', 'Булган', 'Bulgan', 'Булган', 'Bulgan', 'Уран-Тогоо унтарсан галт уул, ой мод ихтэй нутаг.', 'Land of forests and the extinct Uran-Togoo volcano.', '🌲'),
    A('govialtai', 'Говь-Алтай', 'Govi-Altai', 'Алтай', 'Altai', 'Мазаалай амьдардаг Их говийн дархан цаазат газар энд бий.', 'Part of the Great Gobi reserve, home of the Gobi bear (mazaalai).', '🐻'),
    A('govisumber', 'Говьсүмбэр', 'Govisümber', 'Чойр', 'Choir', '1994 онд байгуулагдсан хамгийн шинэ аймгуудын нэг.', 'One of the newest provinces, founded in 1994.', '🛤️'),
    A('darkhanuul', 'Дархан-Уул', 'Darkhan-Uul', 'Дархан', 'Darkhan', 'Дархан хот 1961 онд байгуулагдсан, Монголын томоохон хотуудын нэг.', 'Darkhan city was founded in 1961 and is one of Mongolia’s big cities.', '🏭'),
    A('dornogovi', 'Дорноговь', 'Dornogovi', 'Сайншанд', 'Sainshand', 'Хамарын хийд, Шамбалын орон энд бий.', 'Home of Khamaryn Monastery and the Shambhala site.', '🏯'),
    A('dornod', 'Дорнод', 'Dornod', 'Чойбалсан', 'Choibalsan', 'Буйр нуур, Халх гол, тал нутгийн цагаан зээр.', 'Buir Lake, the Khalkh River and steppe gazelles.', '🦌'),
    A('dundgovi', 'Дундговь', 'Dundgovi', 'Мандалговь', 'Mandalgovi', 'Их газрын чулуу гэх гайхамшигт хадан уул бий.', 'Home of the amazing Ikh Gazryn Chuluu rock formations.', '🪨'),
    A('zavkhan', 'Завхан', 'Zavkhan', 'Улиастай', 'Uliastai', 'Монголын тахилгат Отгонтэнгэр уул энд бий.', 'Home of Otgontenger, Mongolia’s sacred mountain.', '🏔️'),
    A('orkhon', 'Орхон', 'Orkhon', 'Эрдэнэт', 'Erdenet', 'Эрдэнэтийн том зэсийн уурхайгаараа алдартай.', 'Famous for the big Erdenet copper mine.', '⛏️'),
    A('uvurkhangai', 'Өвөрхангай', 'Övörkhangai', 'Арвайхээр', 'Arvaikheer', 'Эртний нийслэл Хархорум, Эрдэнэ Зуу хийд, Орхоны хүрхрээ энд бий.', 'Home of the ancient capital Karakorum, Erdene Zuu Monastery and the Orkhon waterfall.', '🏛️'),
    A('umnugovi', 'Өмнөговь', 'Ömnögovi', 'Даланзадгад', 'Dalanzadgad', 'Хонгорын элс, Ёлын ам, Баянзагийн үлэг гүрвэлийн олдвор.', 'Khongor sand dunes, Yolyn Am and the dinosaur finds of Bayanzag.', '🦖'),
    A('sukhbaatar', 'Сүхбаатар', 'Sükhbaatar', 'Баруун-Урт', 'Baruun-Urt', 'Дарьганга нутаг, Шилийн богд уул, хурдан морьдоороо алдартай.', 'Dariganga, Shiliin Bogd mountain and famous fast horses.', '🐎'),
    A('selenge', 'Сэлэнгэ', 'Selenge', 'Сүхбаатар', 'Sükhbaatar', 'Амарбаясгалант хийд, Монголын үр тарианы гол бүс.', 'Amarbayasgalant Monastery and Mongolia’s main grain fields.', '🌾'),
    A('tuv', 'Төв', 'Töv', 'Зуунмод', 'Zuunmod', 'Чингис хааны морьт хөшөө, тахь амьдардаг Хустайн нуруу.', 'The Chinggis Khaan equestrian statue and Khustai, home of the takhi wild horse.', '🗿'),
    A('uvs', 'Увс', 'Uvs', 'Улаангом', 'Ulaangom', 'Увс нуур талбайгаараа Монголын хамгийн том нуур.', 'Uvs Lake is Mongolia’s largest lake by area.', '🌊'),
    A('khovd', 'Ховд', 'Khovd', 'Ховд', 'Khovd', 'Олон ястан амьдардаг, амтат тарвасаараа алдартай.', 'Home to many ethnic groups and famous for sweet watermelons.', '🍉'),
    A('khuvsgul', 'Хөвсгөл', 'Khövsgöl', 'Мөрөн', 'Mörön', 'Хөвсгөл нуур Монголын хамгийн гүн нуур. Цаатнууд цаа буга маллана.', 'Lake Khövsgöl is Mongolia’s deepest lake. The Tsaatan herd reindeer here.', '🦌'),
    A('khentii', 'Хэнтий', 'Khentii', 'Чингис хот', 'Chinggis city', 'Чингис хааны өлгий нутаг. Бурхан халдун уул энд бий.', 'Birthplace of Chinggis Khaan, home of Mount Burkhan Khaldun.', '👑'),
  ];
  const byId = (id) => AIMAGS.find((a) => a.id === id);
  /** Grid picker. onPick(id) when a place is chosen. */
  function picker(cur, onPick) {
    const fact = h('div', { class: 'aimag-fact' });
    const showFact = (a) => { fact.replaceChildren(h('b', null, a.icon, ' ', tx(a.name), ' · ', tx(a.center)), h('p', null, tx(a.fact))); };
    const grid = h('div', { class: 'aimag-grid' }, AIMAGS.map((a) => h('button', { class: 'aimag' + (a.id === cur ? ' on' : '') + (a.id === 'ub' ? ' ub' : ''), onclick: (e) => {
      grid.querySelectorAll('.aimag').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); showFact(a); TG.sfx.tap(); onPick(a.id);
    } }, h('span', null, a.icon), h('b', null, tx(a.name)))));
    if (byId(cur)) showFact(byId(cur));
    return h('div', null, grid, fact);
  }
  /** Change where you are from (menu). */
  function openPicker() {
    const p = S.active(); if (!p) return;
    let pick = p.aimag || null;
    const close = TG.modal(h('div', null, h('h2', null, L('Миний нутаг', 'Where I’m from')), h('p', { class: 'muted' }, L('21 аймгаас эсвэл Улаанбаатараас сонгоорой.', 'Choose one of the 21 provinces, or Ulaanbaatar.')),
      picker(pick, (id) => { pick = id; }),
      h('button', { class: 'btn primary big block', style: { marginTop: '12px' }, onclick: () => { p.aimag = pick; S.save(); close(); TG.toast(L('Нутгаа сонголоо!', 'Home province saved!')); TG.achievements && TG.achievements.check(); } }, L('Хадгалах', 'Save'))), { cls: 'v-modal' });
  }
  TG.aimags = { AIMAGS, byId, picker, openPicker };
})(window.TG);
