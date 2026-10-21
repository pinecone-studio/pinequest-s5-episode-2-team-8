/* Нутаг (village) rules shared by the browser and server.js.
   Same file runs in both so crop growth and garden actions always agree. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TG = root.TG || {}; root.TG.vrules = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 56, H = 40, PLOTS = 24, LOTS = 8, GER_PRICE = 200, GER_LEVEL = 2;
  const T = (mn, en) => ({ mn, en });

  // stage = seconds per growth stage. A crop needs water at each of its 3 stages.
  const CROPS = {
    carrot: { e: '🥕', name: T('Лууван', 'Carrot'), cost: 5, sell: 12, stage: 20, xp: 6, lvl: 1, color: '#F08A24',
      fact: T('Лууван А витаминаар баялаг тул нүдэнд тустай.', 'Carrots are rich in vitamin A, which is good for your eyes.') },
    potato: { e: '🥔', name: T('Төмс', 'Potato'), cost: 8, sell: 20, stage: 30, xp: 8, lvl: 1, color: '#C8A26B',
      fact: T('Төмс бол монгол айл бүрийн ширээн дээр байдаг гол ногоо.', 'Potatoes are on nearly every Mongolian family table.') },
    sunflower: { e: '🌻', name: T('Наранцэцэг', 'Sunflower'), cost: 10, sell: 26, stage: 35, xp: 9, lvl: 2, color: '#FDB022',
      fact: T('Залуу наранцэцэг өдөржин нарыг дагаж эргэдэг.', 'Young sunflowers turn to follow the sun during the day.') },
    cabbage: { e: '🥬', name: T('Байцаа', 'Cabbage'), cost: 12, sell: 30, stage: 40, xp: 10, lvl: 2, color: '#7BC86C',
      fact: T('Байцаа C витаминтай бөгөөд өвлийн турш хадгалагддаг.', 'Cabbage has vitamin C and keeps all winter long.') },
    tomato: { e: '🍅', name: T('Улаан лооль', 'Tomato'), cost: 16, sell: 42, stage: 45, xp: 12, lvl: 3, color: '#F04438',
      fact: T('Улаан лоолийг ургамал судлалд жимс гэж ангилдаг.', 'Botanists classify the tomato as a fruit.') },
    strawberry: { e: '🍓', name: T('Гүзээлзгэнэ', 'Strawberry'), cost: 22, sell: 58, stage: 55, xp: 15, lvl: 4, color: '#E8445A',
      fact: T('Нэг гүзээлзгэнийн гадаргуу дээр 200 орчим жижиг үр байдаг.', 'One strawberry has about 200 tiny seeds on its surface.') },
    seabuckthorn: { e: '🟠', name: T('Чацаргана', 'Sea buckthorn'), cost: 30, sell: 85, stage: 70, xp: 20, lvl: 5, color: '#F79009',
      fact: T('Чацаргана Монголд элбэг ургадаг бөгөөд C витаминаар нимбэгнээс хэд дахин баялаг.', 'Sea buckthorn grows widely in Mongolia and has several times more vitamin C than lemons.') },
  };

  const FISH = {
    perch: { e: '🐟', name: T('Алгана', 'Perch'), sell: 15, xp: 8, diff: 1, w: 50, fact: T('Алгана Монголын олон нуур, голд түгээмэл байдаг.', 'Perch are common in many Mongolian lakes and rivers.') },
    pike: { e: '🐟', name: T('Цурхай', 'Pike'), sell: 30, xp: 14, diff: 2, w: 28, fact: T('Цурхай бол хурдан сэлдэг махчин загас.', 'Pike are fast-swimming predators.') },
    lenok: { e: '🐠', name: T('Зэвэг', 'Lenok'), sell: 45, xp: 20, diff: 3, w: 16, fact: T('Зэвэг цэвэр, хүйтэн уулын голд амьдардаг.', 'Lenok live in clean, cold mountain rivers.') },
    taimen: { e: '🐡', name: T('Хадран', 'Taimen'), sell: 0, xp: 60, coins: 50, diff: 4, w: 6, release: true,
      fact: T('Хадран бол дэлхийн хамгийн том хулд загасны төрөл. Монголд хамгаалагдсан тул барьсан бол буцааж тавина!', 'Taimen is the largest salmon species in the world. It is protected in Mongolia, so we always release it!') },
  };

  // Preset, kid-safe phrases only. No free-text chat.
  const PHRASES = [
    T('Сайн уу! 👋', 'Hi! 👋'), T('Хамт тоглоё!', "Let's play!"), T('Баярлалаа! 💛', 'Thank you! 💛'), T('Энд ир!', 'Come here!'),
    T('Гоё цэцэрлэг! 🌱', 'Nice garden! 🌱'), T('Усалъя! 💧', "Let's water! 💧"), T('Загасчилъя! 🎣', "Let's fish! 🎣"), T('Баяртай! 👋', 'Bye! 👋'),
  ];
  const EMOTES = ['👋', '❤️', '😂', '🎉', '👍', '🌱', '😮', '⭐'];

  const SKINS = ['#F6D3B3', '#EDBB93', '#D9A06E', '#B97A4A'];
  const DEELS = { blue: '#2F6BFF', red: '#E8453C', green: '#12A05F', purple: '#7A5AF8', pink: '#F06CA8', gold: '#E0A21A' };
  const TITLES = [
    { id: 'nachin', name: T('Начин', 'Falcon'), need: 5, fact: T('Начин (шонхор) цол Улсын наадамд 5 давж авдаг.', 'The Nachin (falcon) title is earned by winning 5 rounds at the State Naadam.') },
    { id: 'khartsaga', name: T('Харцага', 'Hawk'), need: 6, fact: T('Харцага (хартсага шувуу) цол 6 давсан бөхөд олгогддог.', 'The Khartsaga (hawk) title goes to a wrestler who wins 6 rounds.') },
    { id: 'zaan', name: T('Заан', 'Elephant'), need: 7, fact: T('Заан цол 7 давсан, хүчирхэг бөхийн цол.', 'The Zaan (elephant) title is for winning 7 rounds.') },
    { id: 'garid', name: T('Гарьд', 'Garuda'), need: 8, fact: T('Гарьд бол домгийн хүчит шувуу. 8 давсан бөхөд олгодог.', 'The Garid is a mighty mythical bird, for winning 8 rounds.') },
    { id: 'arslan', name: T('Арслан', 'Lion'), need: 9, fact: T('Наадамд түрүүлсэн бөх Арслан цол хүртэнэ.', 'The wrestler who wins the whole Naadam becomes an Arslan (lion).') },
    { id: 'avarga', name: T('Аварга', 'Titan'), need: 10, fact: T('Хоёр удаа түрүүлсэн Арслан Аварга цол хүртдэг. Монголын хамгийн дээд бөхийн цол!', 'An Arslan who wins twice becomes an Avarga (titan), the highest wrestling title in Mongolia!') },
  ];
  // wrestling moves: each beats one other (push > pull > hook > push); timing power can turn a bad match-up
  const MOVES = [
    { id: 'push', name: T('Түлхэх', 'Push'), beats: 'pull' },
    { id: 'pull', name: T('Татах', 'Pull'), beats: 'hook' },
    { id: 'hook', name: T('Дэгээдэх', 'Hook'), beats: 'push' },
  ];
  function exchange(ma, pa, mb, pb) {
    const base = (x, y) => (x === y ? 0.3 : (MOVES.find((m) => m.id === x) || {}).beats === y ? 0.6 : 0);
    const A = base(ma, mb) + 0.8 * Math.max(0, Math.min(1, pa || 0)), B = base(mb, ma) + 0.8 * Math.max(0, Math.min(1, pb || 0));
    return Math.abs(A - B) < 0.04 ? 0 : A > B ? 1 : -1;
  }
  const titleFor = (wr) => { if (!wr) return null; let t = null; for (const x of TITLES) if ((x.id === 'avarga' ? (wr.champ || 0) >= 2 : (wr.best || 0) >= x.need)) t = x.id; return t; };
  const ROOF = { blue: '#3f76db', red: '#e14b3d', green: '#2ea35f', purple: '#9466e0', orange: '#f39b2c', teal: '#1fa3a3' };
  const DOOR = { red: '#e14b3d', blue: '#3f76db', green: '#2ea35f', gold: '#e9a91f' };
  const FURNITURE = [
    { id: 'tulga', price: 60, lvl: 1, name: T('Тулга (зуух)', 'Stove (tulga)'), fact: T('Гэрийн голд тулга буюу зуух байрладаг. Энэ бол гэр бүлийн галын голомт.', 'The stove sits in the center of the ger. It is the heart of the family hearth.') },
    { id: 'shirdeg', price: 80, lvl: 1, name: T('Ширдэг', 'Felt rug (shirdeg)'), fact: T('Ширдэг бол хээ угалзаар оёсон эсгий хивс.', 'A shirdeg is a felt rug stitched with traditional patterns.') },
    { id: 'or', price: 90, lvl: 2, name: T('Ор', 'Bed'), fact: T('Гэрийн ор ихэвчлэн баруун, зүүн хананы дагуу байдаг.', 'Ger beds usually stand along the side walls.') },
    { id: 'avdar', price: 110, lvl: 2, name: T('Авдар', 'Chest (avdar)'), fact: T('Авдарт гэр бүлийн үнэт зүйлсийг хадгалдаг. Хойморт тавьдаг.', 'The avdar chest keeps family treasures. It stands at the back of the ger (khoimor).') },
    { id: 'morinkhuur', price: 150, lvl: 3, name: T('Морин хуур', 'Horsehead fiddle'), fact: T('Морин хуурыг гэрийн хойморт хүндэтгэлтэй байршуулдаг.', 'The morin khuur is placed with honor at the back of the ger.') },
    { id: 'shagai', price: 40, lvl: 1, name: T('Шагайн уут', 'Bag of shagai'), fact: T('Урт өвлийн оройгоор гэр бүлээрээ шагай тоглодог.', 'Families play shagai on long winter evenings.') },
  ];
  const LOOKS = {
    title: TITLES.map((t) => t.id),
    hat: ['mongol', 'flower', 'cap', 'loovuuz', 'crown'],
    face: ['glasses', 'sun'],
    neck: ['scarf', 'khadag', 'medal'],
    pet: ['lamb', 'puppy', 'kitten', 'camel', 'foal'],
  };

  // Shop catalogue (seeds are generated from CROPS).
  const I = (id, cat, slot, val, price, lvl, e, mn, en) => ({ id, cat, slot, val, price, lvl, e, name: T(mn, en) });
  const ITEMS = [
    I('deel-blue', 'wear', 'deel', 'blue', 0, 1, '🔵', 'Цэнхэр дээл', 'Blue deel'),
    I('deel-red', 'wear', 'deel', 'red', 50, 1, '🔴', 'Улаан дээл', 'Red deel'),
    I('deel-green', 'wear', 'deel', 'green', 50, 1, '🟢', 'Ногоон дээл', 'Green deel'),
    I('deel-pink', 'wear', 'deel', 'pink', 60, 2, '🩷', 'Ягаан дээл', 'Pink deel'),
    I('deel-purple', 'wear', 'deel', 'purple', 90, 2, '🟣', 'Нил ягаан дээл', 'Purple deel'),
    I('deel-gold', 'wear', 'deel', 'gold', 140, 3, '🟡', 'Алтан шар дээл', 'Golden deel'),
    I('hat-cap', 'wear', 'hat', 'cap', 40, 1, '🧢', 'Малгай', 'Cap'),
    I('hat-flower', 'wear', 'hat', 'flower', 45, 1, '🌼', 'Цэцгэн титэм', 'Flower crown'),
    I('hat-mongol', 'wear', 'hat', 'mongol', 70, 2, '🎩', 'Монгол малгай', 'Mongolian hat'),
    I('hat-loovuuz', 'wear', 'hat', 'loovuuz', 120, 3, '🧶', 'Лоовууз', 'Loovuuz fur hat'),
    I('hat-crown', 'wear', 'hat', 'crown', 300, 6, '👑', 'Алтан титэм', 'Golden crown'),
    I('face-glasses', 'wear', 'face', 'glasses', 50, 1, '👓', 'Нүдний шил', 'Glasses'),
    I('face-sun', 'wear', 'face', 'sun', 80, 2, '🕶️', 'Нарны шил', 'Sunglasses'),
    I('neck-scarf', 'wear', 'neck', 'scarf', 40, 1, '🧣', 'Ороолт', 'Scarf'),
    I('neck-khadag', 'wear', 'neck', 'khadag', 70, 2, '💙', 'Хадаг', 'Khadag'),
    I('neck-medal', 'wear', 'neck', 'medal', 200, 5, '🏅', 'Наадмын медаль', 'Naadam medal'),
    I('pet-lamb', 'pet', 'pet', 'lamb', 150, 2, '🐑', 'Хурга', 'Lamb'),
    I('pet-kitten', 'pet', 'pet', 'kitten', 180, 2, '🐈', 'Муур', 'Kitten'),
    I('pet-puppy', 'pet', 'pet', 'puppy', 220, 3, '🐕', 'Банхар гөлөг', 'Bankhar puppy'),
    I('pet-camel', 'pet', 'pet', 'camel', 260, 4, '🐫', 'Ботго', 'Baby camel'),
    I('pet-foal', 'pet', 'pet', 'foal', 300, 5, '🐴', 'Унага', 'Foal'),
    I('can-2', 'tool', 'can', 10, 120, 2, '🪣', 'Том усны сав (10)', 'Big watering can (10)'),
    I('can-3', 'tool', 'can', 20, 300, 4, '🚿', 'Аварга усны сав (20)', 'Giant watering can (20)'),
    I('rod-2', 'tool', 'rod', 2, 150, 3, '🎣', 'Сайн загасны саваа', 'Better fishing rod'),
  ];

  const now = () => Date.now();

  /** Advance a plot's growth to time t. A watered stage completes after CROPS[c].stage seconds, then needs water again. */
  function normalize(p, t) {
    if (!p || !CROPS[p.c]) return p;
    const len = CROPS[p.c].stage * 1000;
    while (p.s < 3 && p.w && t >= p.w + len) { p.s++; p.w = 0; }
    return p;
  }
  const needsWater = (p) => !!p && p.s < 3 && !p.w;
  const mature = (p) => !!p && p.s >= 3;
  const stageLeft = (p, t) => (p && p.w && p.s < 3 ? Math.max(0, p.w + CROPS[p.c].stage * 1000 - t) : 0);

  /** Apply a garden action. Used by the server (authoritative) and by solo mode. */
  function applyAction(plots, act, i, data, who, t) {
    if (!Number.isInteger(i) || i < 0 || i >= PLOTS) return { ok: false, why: 'bad-plot' };
    const p = normalize(plots[i], t);
    if (act === 'plant') {
      if (p) return { ok: false, why: 'taken' };
      if (!data || !CROPS[data.c]) return { ok: false, why: 'bad-crop' };
      plots[i] = { c: data.c, s: 0, w: 0, by: who.id, n: who.name };
      return { ok: true, plot: plots[i] };
    }
    if (act === 'water') {
      if (!p || p.s >= 3 || p.w) return { ok: false, why: 'no-need' };
      p.w = t;
      return { ok: true, plot: p, helped: p.by !== who.id };
    }
    if (act === 'harvest') {
      if (!mature(p)) return { ok: false, why: 'not-ready' };
      plots[i] = null;
      return { ok: true, plot: null, crop: p.c, planter: p.by };
    }
    return { ok: false, why: 'bad-act' };
  }

  /** Level from total XP: level 2 at 60 XP, each next level needs 40 more than the last. */
  function level(xp) {
    let l = 1, need = 60, rest = Math.max(0, xp | 0);
    while (rest >= need) { rest -= need; l++; need = 60 + (l - 1) * 40; }
    return { l, cur: rest, need };
  }

  const ROOM_RE = /^[A-Z0-9]{3,8}$/;
  function cleanLook(look) {
    const l = look || {}, out = {};
    out.deel = DEELS[l.deel] ? l.deel : 'blue';
    out.skin = SKINS.includes(l.skin) ? l.skin : SKINS[0];
    for (const k of Object.keys(LOOKS)) out[k] = LOOKS[k].includes(l[k]) ? l[k] : null;
    return out;
  }

  return { W, H, PLOTS, LOTS, GER_PRICE, GER_LEVEL, TITLES, MOVES, exchange, titleFor, ROOF, DOOR, FURNITURE, CROPS, FISH, PHRASES, EMOTES, SKINS, DEELS, LOOKS, ITEMS, ROOM_RE, normalize, needsWater, mature, stageLeft, applyAction, level, cleanLook, now };
});
