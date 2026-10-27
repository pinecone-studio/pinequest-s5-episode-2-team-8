/* Making the white foods (цагаан идээ) by hand: every step of a recipe is one small gesture on the village stage
   (hold the heat, stir on the beat, press, cut, lay out to dry, churn), and each hint says why it is done that way.
   A wrong guess only gets a kind word and another try; nothing is used up until the food is made. */
(function (TG) {
  const PX = TG.pixel, { R, P, ell, blob, K } = PX;
  const T = (mn, en) => ({ mn, en });
  const MILK = '#fbf8ef', TARAG = '#f1ead2', CURD = '#fff6dc', WHEY = '#e9df9a', IRON = '#5a5a66', IRON_L = '#77778a';

  // ---------------------------------------------------------------- stage art (160×120; the beat bar sits along the bottom)
  const ground = (x) => { R(x, 0, 86, 160, 34, K.grass); R(x, 0, 86, 160, 2, K.grassD); };
  const sun = (x, t) => { ell(x, 136, 20, 9, 9, '#f7c646'); ell(x, 136, 20, 6, 6, '#fde08a'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 0.4; P(x, 136 + Math.round(Math.cos(a) * 13), 20 + Math.round(Math.sin(a) * 13), '#f7c646'); } };
  const night = (x) => { R(x, 0, 0, 160, 86, '#22305e'); ell(x, 132, 20, 8, 8, '#fff2c8'); ell(x, 136, 18, 6, 6, '#22305e'); for (const [sx, sy] of [[20, 14], [44, 30], [70, 10], [98, 26], [112, 8], [30, 50], [150, 46]]) P(x, sx, sy, '#ffffff'); };
  function fire(x, t, cx, y, low) {
    R(x, cx - 14, y + 2, 28, 3, K.woodD); R(x, cx - 12, y - 1, 24, 3, K.wood);
    for (let i = 0; i < 5; i++) { const h = (low ? 2 : 5) + ((Math.floor(t * 10) + i * 3) % 4); R(x, cx - 11 + i * 5, y - h, 4, h, i % 2 ? '#f39b2c' : '#f7c646'); }
  }
  /** тулга and its iron pot: the milk's surface, and how much foam or curd is on it. */
  function pot(x, t, cx, cy, o = {}) {
    for (const [lx, ly] of [[-20, 30], [0, 32], [20, 30]]) PX.line(x, cx + lx, cy + ly, cx + Math.round(lx / 2), cy + 4, K.out);
    if (o.fire !== false) fire(x, t, cx, cy + 22, o.low);
    blob(x, cx, cy + 6, 24, 12, IRON); R(x, cx - 25, cy - 3, 50, 4, K.out); R(x, cx - 24, cy - 2, 48, 2, IRON_L);
    ell(x, cx, cy - 2, 21, 3, o.surface || MILK);
    if (o.foam) for (let i = 0; i < o.foam; i++) ell(x, cx - 16 + (i * 9) % 32, cy - 3 - (i > 3 ? 1 : 0), 3, 1, '#ffffff');
    if (o.curds) for (let i = 0; i < o.curds; i++) blob(x, cx - 14 + (i * 7) % 28, cy - 3, 2, 1, CURD);
    if (o.steam) for (let i = 0; i < 3; i++) { const q = (t * 0.8 + i / 3) % 1; P(x, cx - 10 + i * 10 + Math.round(Math.sin(q * 6) * 2), cy - 8 - Math.round(q * 18), '#ffffff'); }
  }
  function bucket(x, cx, cy, surface) { R(x, cx - 17, cy - 15, 34, 30, K.out); R(x, cx - 16, cy - 14, 32, 28, K.wood); for (const by of [-9, 7]) R(x, cx - 16, cy + by, 32, 2, K.woodD); ell(x, cx, cy - 14, 15, 2, surface); }
  /** хөхүүр: the leather bag with its churning stick; up = how far the stick is pulled up. */
  function khukhuur(x, cx, cy, up, open) {
    R(x, cx - 14, cy + 22, 28, 4, K.out); R(x, cx - 13, cy + 22, 26, 3, K.wood);
    blob(x, cx, cy + 4, 16, 18, K.woodD); ell(x, cx - 6, cy - 2, 4, 7, K.wood); P(x, cx - 8, cy - 6, K.woodL);
    R(x, cx - 5, cy - 18, 10, 6, K.out); R(x, cx - 4, cy - 17, 8, 5, open ? '#efe8d4' : K.wood);
    R(x, cx - 1, cy - 34 - up, 3, 30, K.out); R(x, cx, cy - 33 - up, 1, 28, K.woodL); R(x, cx - 6, cy - 36 - up, 13, 3, K.woodD);
  }
  /** тавиур: the drying rack, with a piece of aaruul on every spot already laid. */
  function rack(x, spots, placed) {
    for (const lx of [36, 122]) { R(x, lx, 40, 3, 48, K.out); R(x, lx + 1, 41, 1, 46, K.wood); }
    for (const ry of [48, 60]) { R(x, 30, ry, 100, 6, K.out); R(x, 31, ry + 1, 98, 4, '#c99257'); }
    spots.forEach(([sx, sy], i) => { if (placed.has(i)) { R(x, sx - 5, sy - 3, 10, 6, K.out); R(x, sx - 4, sy - 2, 8, 4, CURD); P(x, sx - 3, sy - 2, '#ffffff'); } });
  }
  const mix = (a, b, q) => { const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * Math.min(1, Math.max(0, q))).toString(16).padStart(2, '0')).join(''); };
  const done = (st) => (st && st.n ? (st.progress + (st.fill || 0)) / st.n : 0);

  // small pictures for the tarag question
  function optIcon(draw) { const { c, x } = PX.mk(16, 16); draw(x); return c; }
  const ICONS = {
    hot: () => optIcon((x) => { for (let i = 0; i < 3; i++) R(x, 3 + i * 4, 1 + (i % 2), 2, 5, '#ffffff'); blob(x, 8, 11, 6, 3, IRON); R(x, 3, 7, 10, 1, '#e14b3d'); }),
    warm: () => optIcon((x) => { blob(x, 8, 10, 5, 5, '#e8b48a'); R(x, 4, 2, 2, 6, K.out); R(x, 7, 1, 2, 7, K.out); R(x, 10, 2, 2, 6, K.out); R(x, 5, 3, 1, 5, '#e8b48a'); R(x, 8, 2, 1, 6, '#e8b48a'); R(x, 11, 3, 1, 5, '#e8b48a'); }),
    cold: () => optIcon((x) => { for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) PX.line(x, 8 - dx * 6, 8 - dy * 6, 8 + dx * 6, 8 + dy * 6, '#4aa6e2'); P(x, 8, 8, '#ffffff'); }),
  };

  // ---------------------------------------------------------------- the recipes, step by step
  const DRY_SPOTS = [[46, 50], [66, 50], [86, 50], [106, 50], [56, 62], [96, 62]];
  const STEPS = {
    aaruul: [
      () => ({ kind: 'hold', holders: 1, ms: 1500, title: T('Сүүгээ исгэх', 'Sour the milk'),
        hint: T('Дарж байгаад сүүгээ дулаан байлга. Исэхээрээ тараг болно.', 'Hold to keep the milk warm. As it sours, it turns into tarag.'),
        art: (x, t, st) => { ground(x); bucket(x, 80, 66, mix(MILK, TARAG, done(st))); } }),
      () => ({ kind: 'rhythm', n: 4, speed: 0.8, win: 0.26, title: T('Ээдэм гаргах', 'Boil out the curds'),
        hint: T('Буцалж байхад нь хэмнэлээр хутга. Цагаан ээдэм шар уснаас ялгарна.', 'Stir on the beat as it boils. The white curds (ээдэм) come apart from the yellow whey.'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { surface: mix(TARAG, WHEY, done(st)), curds: st ? st.progress * 2 : 0, steam: true }); } }),
      () => ({ kind: 'hold', holders: 1, ms: 1000, n: 2, title: T('Даавуунд шахах', 'Press in a cloth'),
        hint: T('Ээдмээ даавуунд боогоод дарж шах. Шар ус нь гоожиж гарна.', 'Wrap the curds in a cloth and hold to press. The whey drips out.'),
        art: (x, t, st) => { ground(x); R(x, 34, 80, 92, 6, K.out); R(x, 35, 80, 90, 5, K.wood); const sq = done(st); blob(x, 80, 66 + Math.round(sq * 4), 26, Math.round(12 - sq * 4), '#f6f2e9'); R(x, 78, 50, 4, 6, '#d8cfba');
          for (let i = 0; i < 3; i++) { const q = (t * 1.5 + i / 3) % 1; P(x, 60 + i * 20, 88 + Math.round(q * 20), WHEY); } } }),
      () => ({ kind: 'drag', n: 3, path: [[36, 64], [124, 64]], title: T('Хэрчих', 'Cut it into pieces'),
        hint: T('Утсаар нь чирж ээдмээ хэрчээрэй. 3 удаа!', 'Drag the thread across to cut the curd block. 3 cuts!'),
        art: (x, t, st) => { ground(x); R(x, 28, 76, 104, 8, K.out); R(x, 29, 76, 102, 7, K.wood); R(x, 36, 50, 88, 26, K.out); R(x, 37, 51, 86, 24, CURD);
          for (let i = 0; i < (st ? st.progress : 0); i++) R(x, 37, 56 + i * 6, 86, 1, '#d8cfba'); } }),
      () => ({ kind: 'spots', spots: DRY_SPOTS, title: T('Наранд хатаах', 'Dry in the sun'),
        hint: T('Хэсэг бүрийг тавиур дээр дэлгэ. Нар, салхинд хэдэн хоног хатна.', 'Lay each piece on the rack. Sun and wind dry them for a few days.'),
        art: (x, t, st) => { ground(x); sun(x, t); rack(x, DRY_SPOTS, st ? st.placed : new Set()); } }),
    ],
    urum: [
      () => ({ kind: 'hold', holders: 1, ms: 1800, title: T('Бага галд халаах', 'Warm it on a low fire'),
        hint: T('Дарж байгаад сүүгээ аажмаар халаа. Хурдан буцалгавал түлэгдэнэ!', 'Hold to heat the milk slowly. Boil it fast and it burns!'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { low: true, steam: done(st) > 0.5 }); } }),
      () => ({ kind: 'drag', n: 5, path: [[80, 80], [80, 24]], title: T('Самрах', 'Ladle it up high'),
        hint: T('Шанагаа дээш өргөөд сүүгээ буцааж цутга. Хөөс нь өрөм болно.', 'Lift the ladle high and pour the milk back. The foam becomes öröm.'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { low: true, foam: st ? st.progress * 2 : 0 }); if (st && st.along > 0.3) R(x, 79, Math.round(80 - st.along * 56), 2, Math.round(st.along * 56) - 30, '#ffffff'); } }),
      () => ({ kind: 'spots', spots: [[80, 46]], title: T('Шөнөжин хөргөх', 'Cool it overnight'),
        hint: T('Тогоогоо таглаад шөнөжин хөргө. Өглөө дээр нь шар өрөм тогтоно.', 'Cover the pot and let it cool overnight. By morning, yellow öröm sits on top.'),
        art: (x, t, st) => { night(x); ground(x); pot(x, t, 80, 52, { fire: false, surface: '#f7d071' }); if (st && st.progress) { ell(x, 80, 48, 25, 4, K.out); ell(x, 80, 47, 24, 3, IRON_L); } } }),
    ],
    tarag: [
      () => ({ kind: 'hold', holders: 1, ms: 1400, title: T('Буцалгах', 'Boil the milk'),
        hint: T('Дарж байгаад сүүгээ буцалга. Буцалгасан сүү цэвэр байдаг.', 'Hold to bring the milk to the boil. Boiled milk is clean.'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { steam: done(st) > 0.3 }); } }),
      () => ({ kind: 'choose', answer: 'warm', title: T('Хэр бүлээн бэ?', 'How warm?'),
        hint: T('Хөрөнгөө хийхэд сүү хэр дулаан байх ёстой вэ?', 'How warm should the milk be when the starter goes in?'),
        options: [
          { id: 'hot', label: T('Буцалж байхад', 'Still boiling'), icon: ICONS.hot(), why: T('Хэтэрхий халуун! Хөрөнгөнд байдаг ашигтай нян үхчихнэ. Бүлээн болтол хөргөөрэй.', 'Too hot! The good bacteria in the starter would die. Let it cool until it is warm.') },
          { id: 'warm', label: T('Бүлээн', 'Warm, like your hand'), icon: ICONS.warm() },
          { id: 'cold', label: T('Хүйтэн', 'Cold'), icon: ICONS.cold(), why: T('Хэтэрхий хүйтэн! Нян ажиллахгүй, тараг исэхгүй. Бүлээн байхад нь хий.', 'Too cold! The bacteria can’t work, so it won’t turn into tarag. Add it while warm.') },
        ],
        art: (x, t) => { ground(x); pot(x, t, 80, 52, { fire: false, steam: true }); } }),
      () => ({ kind: 'spots', spots: [[80, 48]], title: T('Хөрөнгө нэмэх', 'Add the starter'),
        hint: T('Өмнөх тарагнаасаа нэг халбага хий. Айлууд хөрөнгөө үеэс үед хадгалж, бие биедээ өгдөг.', 'Add a spoon of old tarag. Families keep their starter for generations and share it.'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { fire: false, surface: st && st.progress ? TARAG : MILK }); blob(x, 128, 76, 10, 5, '#f6f2e9'); ell(x, 128, 73, 8, 2, TARAG); } }),
      () => ({ kind: 'drag', n: 1, path: [[80, 22], [80, 84]], title: T('Дулаан хонуулах', 'Keep it warm overnight'),
        hint: T('Дээлээрээ ороож дулаан газар хонуул. Өглөө нь тараг болсон байна.', 'Wrap it in a deel and keep it somewhere warm overnight. By morning it is tarag.'),
        art: (x, t, st) => { ground(x); pot(x, t, 80, 52, { fire: false }); const q = st ? (st.progress ? 1 : st.along) : 0; if (q > 0) { R(x, 52, 30, 56, Math.round(q * 50), K.out); R(x, 53, 31, 54, Math.round(q * 50) - 2, '#2b52a5'); R(x, 53, 31, 54, 3, '#f7c646'); } } }),
    ],
    airag: [
      () => ({ kind: 'drag', n: 2, path: [[34, 40], [92, 52]], title: T('Хөхүүрт цутгах', 'Pour into the khukhuur'),
        hint: T('Гүүний сүүгээ хөхүүрт цутга.', 'Pour the mare’s milk into the khukhuur.'),
        art: (x, t, st) => { ground(x); khukhuur(x, 108, 56, 0, true); bucket(x, 34, 58, MILK); if (st && st.along > 0.6) R(x, 98, 34, 2, 8, '#ffffff'); } }),
      () => ({ kind: 'rhythm', n: 12, speed: 1.05, win: 0.28, title: T('Бүлэх', 'Churn'),
        hint: T('Хэмнэлээр нь бүлүүрээ дээш доош хий! Айргийг мянга гаруй удаа бүлдэг.', 'Churn on the beat, up and down! Airag is churned over a thousand times.'),
        art: (x, t) => { ground(x); khukhuur(x, 80, 56, Math.round((Math.sin(t * 8) + 1) * 5), false); } }),
      () => ({ kind: 'spots', spots: [[80, 40]], title: T('Исгэх', 'Let it ferment'),
        hint: T('Амсрыг нь таглаад нэг хоног исгэ. Тэгээд л айраг болно!', 'Close the top and let it ferment for a day. Then it is airag!'),
        art: (x, t, st) => { ground(x); sun(x, t); khukhuur(x, 80, 56, 0, !(st && st.progress)); } }),
    ],
  };

  /** One step's task, numbered ("2/5 · …"); say is a kind word after a wrong guess. */
  function spec(id, i, say) {
    const list = STEPS[id], make = list && list[i]; if (!make) return null;
    const s = make(), n = list.length;
    return { ...s, title: T(`${i + 1}/${n} · ${s.title.mn}`, `${i + 1}/${n} · ${s.title.en}`), say: say || null, shake: !!say };
  }
  /** Do every step of a recipe by hand. True when the food is made; false if closed on the way. */
  async function make(id) {
    const n = (STEPS[id] || []).length; if (!n) return false;
    for (let i = 0; i < n; i++) {
      let say = null;
      for (;;) {
        const sp = spec(id, i, say), r = await TG.tasks.run(sp);
        if (!r.done) return false;
        if (sp.kind !== 'choose' || r.pick === sp.answer) break;
        say = (sp.options.find((o) => o.id === r.pick) || {}).why || T('Дахиад бодоод үзээрэй.', 'Think again.');
      }
    }
    return true;
  }

  TG.dairywork = { make, spec, steps: (id) => (STEPS[id] || []).length };
})(window.TG);
