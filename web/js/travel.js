/* Аймагт аялах: a full-screen walkable map for every province, built from its real landscape, with its three famous
   landmarks drawn as they really look (Turtle Rock in Terelj, Erdene Zuu, Lake Khövsgöl...). Visit all three,
   then the local guide asks the stamp question. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const TS = 16, MW = 36, MH = 24, RY = 19, RX = 18;    // map size in tiles; the main road (row RY) and the road north (column RX)
  const BLOCK = 'wtmrbLGzO';
  // landmark lots (LW×LH tiles) and the tile you stand on to visit each one. Lot B sits on the south shore of a province's big lake.
  const LW = 6, LH = 4;
  const SLOTS = [{ x: 3, y: 10, fx: 6, fy: 14, to: 'down' }, { x: 24, y: 13, fx: 27, fy: 17, to: 'down' }, { x: 8, y: 3, fx: 11, fy: 7, to: 'right' }];
  const CAMP = [{ x: 8, y: 15 }, { x: 11, y: 15 }];
  const FAM = { x: 31, y: 14, fx: 32, fy: 18 };          // the herder family's ger (3×3) and where the herder stands
  const OVOO = { x: 14, y: 2, fx: 14, fy: 4 };           // a 2×2 ovoo on the hill
  const SIGN = { x: 2, y: 18 };                          // welcome board by the bus stop
  // the big lakes, sized by their real area (Uvs 3,350 km², Khövsgöl 2,760, Khar Us 1,578, Buir 615, Orog 140, Terkhiin Tsagaan 61):
  // they fill the north-east of their province's map; small lakes like Ganga or Khökh stay inside their landmark lot
  const LAKES = {
    uvs: { cx: 27, cy: 6, rx: 8.6, ry: 4.9, salt: true }, khuvsgul: { cx: 27, cy: 6, rx: 8.4, ry: 4.8 }, khovd: { cx: 27, cy: 6.5, rx: 6.6, ry: 3.9, reeds: true },
    dornod: { cx: 27.5, cy: 6.5, rx: 5.6, ry: 3.3 }, bayankhongor: { cx: 28, cy: 7, rx: 3.6, ry: 2.1, salt: true }, arkhangai: { cx: 28, cy: 7, rx: 4.3, ry: 2.6, island: true },
  };
  // Researched details for each province: real area (km²), the animals you meet, trees, birds, a local fact the herder
  // family tells, and the food or drink they offer (an id from the Нутаг food list).
  const T = (mn, en) => ({ mn, en });
  const DETAIL = {
    ub: { area: 4704, animals: ['horse'], trees: 'poplar', food: 'buuz', fact: T('Улаанбаатарт Монголын хүн амын бараг тал нь амьдардаг. Хотын захын толгодоор гэр хороолол бий.', 'Almost half of all Mongolians live in Ulaanbaatar. Ger districts climb the hills around the city.') },
    tuv: { area: 74042, animals: ['sheep', 'horse', 'goat'], trees: 'larch', food: 'airag', fact: T('Төв аймаг нийслэл Улаанбаатарыг бүхэлд нь тойрон оршдог.', 'Töv province completely surrounds the capital, Ulaanbaatar.') },
    khentii: { area: 80325, animals: ['horse', 'sheep'], trees: 'birch', food: 'borts', fact: T('Аймгийн төвийг Чингис хот гэдэг. Онон, Хэрлэн, Туул гол Хэнтийн нуруунаас эх авдаг.', 'The province centre is called Chinggis City. The Onon, Kherlen and Tuul rivers start in the Khentii mountains.') },
    dornod: { area: 123597, animals: ['gazelle', 'horse'], birds: 'crane', food: 'khuushuur', fact: T('Монголын хамгийн зүүн аймаг. Нар хамгийн түрүүнд эндээс мандана. Тогоруу энэ нутагт үүрээ засдаг.', 'Mongolia’s easternmost province, where the sun rises first. Cranes nest in this land.') },
    sukhbaatar: { area: 82287, animals: ['horse', 'sheep', 'gazelle'], birds: 'swan', food: 'airag', fact: T('Аймгийн төв Баруун-Урт. Дарьганга нутаг унтарсан галт уулс, мөнгөний дархчуудаараа алдартай.', 'The province centre is Baruun-Urt. The Dariganga area is known for its extinct volcanoes and silversmiths.') },
    dornogovi: { area: 109472, animals: ['camel', 'goat'], saxaul: true, food: 'khoormog', fact: T('Монголыг дайрах төмөр зам Замын-Үүдээр дамжин урд хөрш рүү гардаг.', 'The railway across Mongolia leaves the country through Zamyn-Üüd, heading south.') },
    govisumber: { area: 5542, animals: ['sheep', 'camel'], food: 'tsai', fact: T('Хамгийн жижиг аймгуудын нэг: ердөө 5,542 км². 1994 онд байгуулагдсан.', 'One of the smallest provinces, just 5,542 km², founded in 1994.') },
    dundgovi: { area: 74690, animals: ['camel', 'goat', 'sheep'], saxaul: true, food: 'khoormog', fact: T('“Дундговь” гэдэг нь “дунд хэсгийн говь” гэсэн утгатай. Аймгийн төв Мандалговь.', '“Dundgovi” means “the middle Gobi”. The province centre is Mandalgovi.') },
    umnugovi: { area: 165380, animals: ['camel', 'goat'], saxaul: true, food: 'khoormog', fact: T('Талбайгаараа Монголын хамгийн том аймаг: 165,380 км². Хос бөхт тэмээ олонтой говийн нутаг.', 'Mongolia’s largest province: 165,380 km². A Gobi land of many two-humped camels.') },
    bayankhongor: { area: 115978, animals: ['camel', 'goat', 'yak'], saxaul: true, food: 'khoormog', fact: T('Хойд хэсэг нь Хангайн уул, урд хэсэг нь говь. Нэг аймагт сарлаг, тэмээ хоёул бэлчдэг!', 'The north is Khangai mountains and the south is Gobi, so yaks and camels both graze here!') },
    uvurkhangai: { area: 62895, animals: ['horse', 'yak', 'sheep'], trees: 'poplar', food: 'airag', fact: T('Хархорумд эзэнт гүрний үед мөнгөн модон усан оргилуур байсныг аялагч Рубрук бичиж үлдээжээ.', 'The traveller William of Rubruck wrote about a silver tree fountain in Karakorum in the empire’s days.') },
    arkhangai: { area: 55314, animals: ['yak', 'horse', 'sheep'], trees: 'larch', food: 'tarag', fact: T('Сарлаг олонтой хангайн нутаг. Сарлагийн сүүгээр өтгөн тараг, өрөм хийдэг.', 'A Khangai land of many yaks. Their milk makes thick tarag yogurt and öröm cream.') },
    bulgan: { area: 48733, animals: ['horse', 'sheep', 'camel'], trees: 'birch', food: 'airag', fact: T('Элсэн тасархайд ой, хад, элсэн манхан хажуу хажуудаа оршдог. Тэмээ унаж болно.', 'At Elsen Tasarkhai, forest, rocks and sand dunes sit side by side, and you can ride a camel.') },
    orkhon: { area: 844, animals: ['horse', 'sheep'], trees: 'larch', food: 'tsuivan', fact: T('Монголын хамгийн жижиг аймаг: ердөө 844 км². Төв нь Эрдэнэт хот.', 'Mongolia’s smallest province, only 844 km². Its centre is Erdenet city.') },
    darkhanuul: { area: 3275, animals: ['sheep', 'horse'], trees: 'poplar', food: 'salad', fact: T('Хоёр дахь жижиг аймаг (3,275 км²). Эргэн тойронд нь хүнсний ногоо, үр тариа тариалдаг.', 'The second-smallest province (3,275 km²). Vegetables and grain are farmed all around.') },
    selenge: { area: 41153, animals: ['horse', 'sheep'], trees: 'birch', food: 'salad', fact: T('Монголын үр тарианы гол бүс. Улаан буудайн шар талбай Сэлэнгийн хөндийг дүүргэдэг.', 'Mongolia’s main grain region. Golden wheat fields fill the Selenge valley.') },
    khuvsgul: { area: 100629, animals: ['reindeer', 'yak', 'horse'], trees: 'larch', food: 'tarag', fact: T('Хөвсгөл нуурт Монголын цэнгэг усны 70 орчим хувь бий. Цаатан ард цаа бугаа маллан тайгад амьдардаг.', 'Lake Khövsgöl holds about 70% of Mongolia’s fresh water. Tsaatan families herd reindeer in the taiga.') },
    zavkhan: { area: 82456, animals: ['yak', 'sheep', 'horse'], trees: 'larch', food: 'tarag', fact: T('Завханы Тосонцэнгэл бол Монголын хамгийн хүйтэн газруудын нэг. Өвөл маш их хүйтэрдэг.', 'Tosontsengel in Zavkhan is one of the coldest places in Mongolia, with bitter winters.') },
    govialtai: { area: 141448, animals: ['camel', 'goat'], saxaul: true, food: 'khoormog', fact: T('Талбайгаараа хоёр дахь том аймаг. Мазаалай баавгай зөвхөн Их говьд л амьдардаг.', 'The second-largest province. The Gobi bear (mazaalai) lives only in the Great Gobi.') },
    khovd: { area: 76060, animals: ['camel', 'goat', 'yak'], food: 'tarvas', fact: T('Ховдод 10 гаруй ястан амьдардаг. Мянгад сумын тарвас бүх Монголд алдартай.', 'More than ten ethnic groups live in Khovd, and watermelons from Myangad are famous across Mongolia.') },
    bayanolgii: { area: 45705, animals: ['yak', 'goat'], birds: 'eagle', food: 'baursak', fact: T('Дэлхийн бүргэдчдийн 80 орчим хувь энд амьдардаг. Казах ястан олонхтой цорын ганц аймаг, 1940 онд байгуулагдсан.', 'About 80% of the world’s eagle hunters live here. It is the only Kazakh-majority province, founded in 1940.') },
    uvs: { area: 69585, animals: ['camel', 'yak', 'sheep'], food: 'chatsargana', fact: T('Чацаргана элбэг ургадаг, С витаминаар маш баян жимс. Увс нуурын хотгор ЮНЕСКО-гийн өвд бүртгэлтэй.', 'Sea buckthorn grows thickly here, a berry packed with vitamin C. The Uvs Lake basin is a UNESCO site.') },
  };
  const ANIMAL = {
    sheep: T('Хонины ноосоор эсгий хийж, гэрээ бүрдэг.', 'Sheep’s wool is pressed into the felt that covers the ger.'),
    goat: T('Ямааны зөөлөн ноолуур дэлхийд алдартай.', 'Soft goat cashmere is famous around the world.'),
    horse: T('Монгол адуу намхан ч маш тэсвэртэй. Өвөл зунгүй гадаа бэлчдэг.', 'Mongolian horses are short but tough, grazing outdoors all year round.'),
    camel: T('Хос бөхт тэмээ ус уулгүй олон хоног явж чаддаг. Ноосоор нь дулаан хувцас хийдэг.', 'The two-humped camel can go many days without water, and its wool makes warm clothes.'),
    yak: T('Сарлаг урт өтгөн үстэй тул өндөр уулын хүйтэнд тэсвэртэй. Сарлаг бол үхрийн нэг төрөл.', 'Yaks have long thick hair for the mountain cold. A yak is a kind of cattle.'),
    reindeer: T('Цаатан ард цаа бугаа унаж, сүүг нь цайндаа хийдэг.', 'The Tsaatan ride their reindeer and put its milk in their tea.'),
    gazelle: T('Цагаан зээр зүүн талд олноороо сүрэглэн нүүдэллэдэг.', 'Mongolian gazelles roam the eastern steppe in great herds.'),
  };
  const ANAME = { sheep: T('Хонь', 'Sheep'), goat: T('Ямаа', 'Goat'), horse: T('Адуу', 'Horse'), camel: T('Тэмээ', 'Camel'), yak: T('Сарлаг', 'Yak'), reindeer: T('Цаа буга', 'Reindeer'), gazelle: T('Цагаан зээр', 'Gazelle') };

  function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); }

  /** Build the province's map: ground, blocking features, the arrival point, three landmarks, a ger camp and the guide. */
  function build(id) {
    const j = TG.passport.J[id], has = (k) => j.land.includes(k), rnd = rng(id), det = DETAIL[id] || {}, lake = LAKES[id];
    const desert = has('desert') || has('dunes'), snow = has('snow'), city = has('city');
    const g = Array.from({ length: MH }, () => Array(MW).fill('g'));   // g ground · w water · t tree · m mountain · r rock · b building · p path · s sand mound · f field · L landmark · G ger · O ovoo · z saxaul
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < MW && y < MH) g[y][x] = c; };
    const inner = (x, y) => x > 0 && y > 0 && x < MW - 1 && y < MH - 1;
    const edge = has('forest') ? 't' : 'm';
    for (let x = 0; x < MW; x++) { set(x, 0, edge); set(x, 1, has('mountains') || snow ? 'm' : has('forest') ? 't' : 'g'); set(x, MH - 1, edge); }
    for (let y = 0; y < MH; y++) { set(0, y, edge); set(MW - 1, y, edge); }
    if (lake) for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) if (((x + 0.5 - lake.cx) / lake.rx) ** 2 + ((y + 0.5 - lake.cy) / lake.ry) ** 2 <= 1) set(x, y, 'w');
    if (lake && lake.island) { set(Math.round(lake.cx), Math.round(lake.cy) - 1, 'g'); set(Math.round(lake.cx) + 1, Math.round(lake.cy) - 1, 't'); }   // Terkhiin Tsagaan’s little volcanic island
    if (has('river')) for (let x = 1; x < MW - 1; x++) { const y = 9 + Math.round(Math.sin(x / 4)); set(x, y, x === RX || x === RX + 1 ? 'p' : 'w'); }
    for (let x = 1; x < MW - 1; x++) set(x, RY, 'p');                   // the road in from the bus stop
    for (let y = 3; y <= RY; y++) if (g[y][RX] !== 'w') set(RX, y, 'p');
    if (city) for (let by = 3; by < 13; by += 4) for (let bx = 2; bx < MW - 3; bx += 5) if (Math.abs(bx - RX) > 2) { set(bx, by, 'b'); set(bx + 1, by, 'b'); set(bx, by + 1, 'b'); set(bx + 1, by + 1, 'b'); }
    if (has('fields')) for (let y = 3; y < 9; y++) for (let x = 2; x < 16; x++) if (y % 2 && g[y][x] === 'g') set(x, y, 'f');
    const free = (x, y) => g[y] && g[y][x] === 'g';
    const scatter = (c, n) => { for (let i = 0; i < n; i++) { const x = 2 + Math.floor(rnd() * (MW - 4)), y = 2 + Math.floor(rnd() * (MH - 5)); if (free(x, y) && Math.abs(x - RX) > 1 && y !== RY && y !== RY - 1) set(x, y, c); } };
    if (has('forest') || has('valley')) scatter('t', 70);
    if (has('mountains') && !has('forest')) scatter('r', 14);
    if (desert || has('rocks') || has('volcano')) scatter('r', 20);
    if (has('dunes')) scatter('s', 40);
    if (det.saxaul) scatter('z', 26);                                   // saxaul shrubs of the Gobi
    if (has('steppe') || has('hills')) scatter('r', 8);
    // the three landmarks: the lake attraction goes on the lake shore (lot B); clear the ground, stand them up, lay a path to each
    const kinds = (TG.landmarks.KIND[id] || []).slice(0, 3), order = [0, 1, 2], si = kinds.indexOf('shore');
    if (si >= 0 && si !== 1) { order[si] = 1; order[1] = si; }   // swap so the lake attraction gets lot B, on the shore
    const carve = (sl) => { if (sl.to === 'right') for (let x = sl.fx; x <= RX; x++) set(x, sl.fy, 'p'); else for (let y = sl.fy; y <= RY; y++) set(sl.fx, y, 'p'); };
    const marks = [0, 1, 2].map((i) => {
      const s = SLOTS[order[i]];
      for (let y = s.y - 1; y <= s.y + LH; y++) for (let x = s.x - 1; x <= s.x + LW; x++) if (inner(x, y) && g[y][x] !== 'p' && !(lake && g[y][x] === 'w' && y < s.y)) set(x, y, 'g');
      for (let y = s.y; y < s.y + LH; y++) for (let x = s.x; x < s.x + LW; x++) set(x, y, 'L');
      carve(s);
      if (kinds[i] === 'shore') for (let x = s.x - 1; x <= s.x + LW; x++) for (let y = s.y - 1; y > 0 && g[y][x] !== 'w'; y--) set(x, y, 'g');   // an open beach down to the water
      return { x: s.fx, y: s.fy, sx: s.x, sy: s.y, i, m: j.marks[i], kind: kinds[i] || 'sacredmtn' };
    });
    // a tourist ger camp near the bus stop, the herder family, the ovoo, the welcome board
    for (const c of CAMP) for (let y = c.y; y < c.y + 3; y++) for (let x = c.x; x < c.x + 3; x++) if (g[y][x] !== 'p') set(x, y, 'G');
    for (let y = FAM.y - 1; y <= FAM.y + 3; y++) for (let x = FAM.x - 1; x <= FAM.x + 3; x++) if (inner(x, y) && g[y][x] !== 'p' && g[y][x] !== 'L') set(x, y, 'g');
    for (let y = FAM.y; y < FAM.y + 3; y++) for (let x = FAM.x; x < FAM.x + 3; x++) set(x, y, 'G');
    for (let y = FAM.fy; y <= RY; y++) set(FAM.fx, y, 'p');
    for (let y = OVOO.y - 1; y <= OVOO.y + 2; y++) for (let x = OVOO.x - 1; x <= OVOO.x + 2; x++) if (inner(x, y) && g[y][x] !== 'p' && g[y][x] !== 'L') set(x, y, 'g');
    for (let y = OVOO.y; y < OVOO.y + 2; y++) for (let x = OVOO.x; x < OVOO.x + 2; x++) set(x, y, 'O');
    for (let x = OVOO.fx; x <= RX; x++) set(x, OVOO.fy, 'p');
    set(SIGN.x, SIGN.y, 'p');
    const district = [];                                                // ger districts on the hills round the cities
    if (city) for (const [gx, gy] of [[2, 2], [5, 2], [24, 2], [28, 3], [32, 2], [2, 6], [33, 7]]) if (g[gy] && g[gy][gx] === 'g' && g[gy + 1] && g[gy + 1][gx] === 'g') { set(gx, gy, 'G'); district.push({ x: gx, y: gy }); }
    for (let y = 3; y < RY; y++) if (g[y][RX] !== 'p' && g[y][RX] !== 'w') set(RX, y, 'p');
    const near = (x, y) => { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(x + dx, y + dy) || (g[y + dy] && g[y + dy][x + dx] === 'p')) return { x: x + dx, y: y + dy }; return { x, y }; };
    const guide = near(21, RY - 1), start = { x: 3, y: RY };
    // herds: a few of each local animal grazing on open ground away from the road
    const ar = rng(id + ':herd'), herd = [];
    (det.animals || []).forEach((kind, k) => { for (let n = 0; n < (k ? 3 : 4); n++) for (let tries = 0; tries < 60; tries++) { const x = 2 + Math.floor(ar() * (MW - 4)), y = 2 + Math.floor(ar() * (MH - 4)); if (g[y][x] === 'g' && Math.abs(y - RY) > 1) { herd.push({ kind, x: x * TS + 8, y: y * TS + 12 }); break; } } });
    return { id, j, g, desert, snow, city, has, marks, guide, start, det, herd, district, lake };
  }
  /** Trees by region: larch (the northern taiga), birch (the forest steppe), poplar (river valleys), or pine. */
  function tree(x, px, py, kind, snow, hsh) {
    const P = TG.pixel, { R, ell } = P, autumn = TG.seasons && TG.seasons.current().id === 'autumn';
    if (kind === 'birch') { R(x, px + 7, py + 7, 2, 9, '#f2eee4'); P.P(x, px + 7, py + 9, '#2b1e2e'); P.P(x, px + 8, py + 12, '#2b1e2e'); ell(x, px + 8, py + 5, 5, 5, snow ? '#ffffff' : autumn ? '#e9b13a' : '#6fb34a'); ell(x, px + 7, py + 4, 3, 2, snow ? '#dce8f5' : autumn ? '#f7d071' : '#94d260'); return; }
    if (kind === 'poplar') { R(x, px + 7, py + 10, 2, 6, '#6b4220'); ell(x, px + 8, py + 6, 4, 6, autumn ? '#d9a63a' : '#4f9a3a'); ell(x, px + 7, py + 4, 2, 3, autumn ? '#f2c45a' : '#6fb34a'); return; }
    R(x, px + 7, py + 11, 2, 5, '#6b4220');
    const larch = kind === 'larch', col = snow ? ['#ffffff', '#3f7a5c'] : larch ? (autumn ? ['#f2c45a', '#d9a63a'] : ['#7cc04e', '#4f9a3a']) : ['#5aaa6e', '#3f8a57'];
    for (let r = 0; r < 11; r++) { if (larch && r % 3 === 2) continue; R(x, px + 8 - Math.round(r / 2) - 1, py + r, Math.round(r / 2) * 2 + 2, 1, r < 3 ? col[0] : col[1]); }
    if (hsh > 0.6 && !snow) P.P(x, px + 6, py + 5, '#ffffff');
  }
  function paint(map) {
    const c = document.createElement('canvas'); c.width = MW * TS; c.height = MH * TS;
    const x = c.getContext('2d'), P = TG.pixel, k = P.K, { R, ell, blob } = P;
    const ground = map.snow ? ['#eef3f8', '#dbe5ef'] : map.desert ? ['#e2b86e', '#d4a55c'] : map.city ? ['#9ec46a', '#8ab45a'] : map.has('fields') ? ['#a8c45a', '#98b44c'] : ['#76b947', '#6aa83f'];
    for (let y = 0; y < MH; y++) for (let X = 0; X < MW; X++) {
      const t = map.g[y][X], px = X * TS, py = y * TS;
      R(x, px, py, TS, TS, ground[0]);
      for (let i = 0; i < 3; i++) P.P(x, px + Math.floor(P.hash(X * 3 + i, y) * 15), py + Math.floor(P.hash(y * 5 + i, X) * 15), ground[1]); // natural speckles, no checkerboard
      if (!map.snow && !map.desert && P.hash(X, y) < 0.12 && t === 'g') { P.P(x, px + 5, py + 7, ['#ffd34e', '#ff8fb1', '#ffffff'][Math.floor(P.hash(y, X) * 3)]); P.P(x, px + 5, py + 8, '#5c9a36'); }
      if (t === 'p') { R(x, px, py, TS, TS, map.city ? '#b8b0a0' : '#d8ab6c'); P.P(x, px + 4, py + 9, map.city ? '#a09888' : '#b78a4f'); P.P(x, px + 11, py + 3, map.city ? '#a09888' : '#b78a4f'); }
      else if (t === 'w') { const salt = map.lake && map.lake.salt, deep = map.lake && map.id === 'khuvsgul'; R(x, px, py, TS, TS, salt ? '#5fbcc4' : deep ? '#2b62b8' : '#4aa6e2'); if ((X + y) % 3 === 0) R(x, px + 4, py + 6, 4, 1, salt ? '#a6e0e4' : '#93d4f6'); }
      else if (t === 'f') { R(x, px, py, TS, TS, '#c9b34a'); for (let i = 0; i < 4; i++) R(x, px + 1 + i * 4, py + 3, 1, 10, '#e8d36a'); }
      else if (t === 'm') { const top = map.snow ? '#ffffff' : '#9fb4c8'; for (let r = 0; r < 14; r++) R(x, px + 7 - r / 2, py + 1 + r, r + 2, 1, r < 4 ? top : map.desert ? '#b9875a' : '#6f97b8'); }
      else if (t === 't') tree(x, px, py, map.det.trees, map.snow, P.hash(X, y));
      else if (t === 'z') { R(x, px + 7, py + 9, 2, 6, '#8a7a64'); P.line(x, px + 8, py + 10, px + 3, py + 6, '#8a7a64'); P.line(x, px + 8, py + 11, px + 13, py + 7, '#8a7a64'); for (const [bx, by] of [[3, 5], [12, 6], [7, 4], [10, 3], [5, 3]]) R(x, px + bx - 1, py + by - 1, 3, 2, '#7f9a5a'); } // заг: saxaul
      else if (t === 'r') { blob(x, px + 8, py + 10, 5, 3, map.desert ? '#c9845a' : map.has('volcano') ? '#5a4a4a' : k.rock); ell(x, px + 7, py + 9, 3, 1, map.desert ? '#e2a77a' : k.rockL); }
      else if (t === 's') { ell(x, px + 8, py + 11, 7, 3, '#f0c878'); ell(x, px + 7, py + 10, 5, 1, '#fbe0a0'); }
      else if (t === 'b') { R(x, px, py - 6, TS, TS + 6, ['#c9c1ad', '#9fb0c8', '#e8dfc8'][(X + y) % 3]); for (let wy = py - 3; wy < py + 12; wy += 5) R(x, px + 3, wy, 3, 2, '#f7c646'); R(x, px, py + TS - 2, TS, 2, '#7a7466'); }
    }
    // ground details: steppe grass tufts, Gobi gravel, snow patches, lake and river shores with reeds
    for (let y = 1; y < MH - 1; y++) for (let X = 1; X < MW - 1; X++) {
      const t = map.g[y][X], px = X * TS, py = y * TS, hsh = P.hash(X * 7, y * 3);
      if (t === 'g') {
        if (map.desert && hsh < 0.5) for (let i = 0; i < 4; i++) P.P(x, px + Math.floor(P.hash(X + i, y * 2) * 15), py + Math.floor(P.hash(y + i, X * 2) * 15), i % 2 ? '#b98a50' : '#f0d49a');
        else if (map.snow && hsh < 0.2) { R(x, px + 4, py + 10, 7, 1, '#d2deea'); R(x, px + 6, py + 9, 4, 1, '#ffffff'); } // small snow drifts
        else if (!map.desert && !map.snow && hsh < 0.3) { const gx = px + 3 + Math.floor(hsh * 30) % 9, gy = py + 9; P.line(x, gx, gy, gx - 1, gy - 4, '#c9d47a'); P.line(x, gx + 1, gy, gx + 2, gy - 5, '#d8dc8a'); P.line(x, gx + 2, gy, gx + 4, gy - 3, '#b8c46a'); } // feather grass
      }
      if (t === 'w') {
        const land = (dx, dy) => { const c = map.g[y + dy] && map.g[y + dy][X + dx]; return c && c !== 'w'; };
        const rim = map.lake && map.lake.salt ? '#f4f2ea' : '#e8c994';   // salt lakes leave a white crust on their shores
        if (land(0, -1)) { R(x, px, py, TS, 2, rim); R(x, px, py + 2, TS, 1, '#93d4f6'); }
        if (land(0, 1)) R(x, px, py + 14, TS, 2, rim);
        if (land(-1, 0)) R(x, px, py, 2, TS, rim);
        if (land(1, 0)) R(x, px + 14, py, 2, TS, rim);
        if ((land(0, -1) || land(-1, 0)) && (hsh < 0.5 || (map.lake && map.lake.reeds))) for (let i = 0; i < 3; i++) { R(x, px + 2 + i * 3, py + 1, 1, 5, '#357a28'); P.P(x, px + 2 + i * 3, py, '#8a5a33'); } // reeds
      }
    }
    // the herder family's ger with its wooden fence (khashaa), the ovoo, the welcome board, and the city's ger districts
    { const fx0 = FAM.x * TS - 6, fy0 = FAM.y * TS - 4, fw = 3 * TS + 12, fh = 3 * TS + 6;
      const gap = (i) => i > 18 && i < 38;                                // an opening in front of the door
      for (let i = 0; i <= fw; i += 4) { R(x, fx0 + i, fy0, 1, 5, '#8a5a33'); if (!gap(i)) R(x, fx0 + i, fy0 + fh - 5, 1, 5, '#8a5a33'); }
      for (let j = 0; j <= fh; j += 4) { R(x, fx0, fy0 + j, 1, 4, '#8a5a33'); R(x, fx0 + fw, fy0 + j, 1, 4, '#8a5a33'); }
      R(x, fx0, fy0 + 1, fw, 1, '#a46d3b'); R(x, fx0, fy0 + fh - 4, 19, 1, '#a46d3b'); R(x, fx0 + 38, fy0 + fh - 4, fw - 38, 1, '#a46d3b');
      x.drawImage(P.gerSprite('#2b52a5', '#e8892b'), FAM.x * TS, FAM.y * TS - 4);
      R(x, FAM.x * TS - 2, FAM.y * TS + 30, 1, 14, '#6b4220'); R(x, FAM.x * TS - 4, FAM.y * TS + 31, 5, 1, '#6b4220'); // the hitching post (уяа)
    }
    { const ox = OVOO.x * TS + 16, oy = OVOO.y * TS + 26;
      ell(x, ox, oy + 2, 14, 3, 'rgba(20,40,10,.25)');
      for (let r = 0; r < 9; r++) { const w = 3 + Math.round(r * 1.3); for (let i = -w; i <= w; i += 3) blob(x, ox + i + (r % 2), oy - 16 + r * 2, 1, 1, [k.rock, k.rockL, k.rockD][(i + r + 9) % 3]); }
      R(x, ox - 1, oy - 30, 2, 16, '#6b4220'); TG.landmarks.khadag(x, ox, oy - 30);
    }
    { const sx = SIGN.x * TS + 8, sy = SIGN.y * TS + 6;
      R(x, sx - 1, sy - 4, 2, 10, '#6b4220'); R(x, sx - 9, sy - 14, 18, 11, '#2b1e2e'); R(x, sx - 8, sy - 13, 16, 9, '#c99257'); R(x, sx - 6, sy - 11, 12, 1, '#5a2d10'); R(x, sx - 6, sy - 8, 9, 1, '#5a2d10'); }
    for (const d of map.district) x.drawImage(P.gerSprite('#e8dfc8', '#e14b3d'), 0, 0, 48, 50, d.x * TS - 2, d.y * TS - 4, 20, 21);
    // the landmarks, a tourist ger camp and the bus stop
    for (const m of map.marks) TG.landmarks.draw(x, m.kind, m.sx * TS, m.sy * TS, map.id);
    CAMP.forEach((cp, i) => x.drawImage(P.gerSprite(i ? '#e14b3d' : '#3f76db', i ? '#e9a91f' : '#e8892b'), cp.x * TS, cp.y * TS - 2));
    const bx = map.start.x * TS, by = map.start.y * TS;
    R(x, bx - 4, by - 18, 2, 18, '#4a4a55'); R(x, bx - 10, by - 22, 14, 6, '#3f76db'); R(x, bx - 9, by - 21, 12, 1, '#ffffff');
    return c;
  }

  /** opts.view: 'fp' (first person, 3D) or '2d'. Without it, the view the child picked last time. */
  function open(id, opts = {}) {
    const a = TG.aimags.byId(id), p = S.active(); if (!a || !TG.passport.J[id]) return;
    if (TG.aimagPass && TG.aimagPass.locked(p, id)) return TG.aimagPass.show(id, () => open(id, opts));
    const map = build(id), terrain = paint(map), v = p.village || {};
    p.travel = p.travel || {}; const seen = (p.travel[id] = p.travel[id] || []);
    const stamped = () => !!(p.passport && p.passport.stamps && p.passport.stamps[id]);
    const eth = (TG.ethnic && TG.ethnic.ETHNIC.find((e) => e.aimags[0] === id)) || (TG.ethnic && TG.ethnic.ETHNIC.find((e) => e.aimags.includes(id) && e.id !== 'khalkh')) || (TG.ethnic && TG.ethnic.byId('khalkh'));
    const guideLook = { deel: eth ? eth.deel : 'blue', skin: '#D9A06E', hat: eth ? eth.hat : 'mongol', neck: 'khadag', face: null, pet: null };
    const det = map.det, famDone = () => !!(p.travelFam && p.travelFam[id]);
    const herderLook = { ...guideLook, deel: guideLook.deel === 'brown' ? 'blue' : 'brown', neck: null };
    const herds = map.herd.map((a0, i) => ({ x: a0.x, y: a0.y, sp: a0.kind, hx: a0.x, hy: a0.y, tx: a0.x, ty: a0.y, wait: 1 + (i % 4), flip: i % 2 === 0, moving: false }));
    const prog = h('span', { class: 'scene-chip px-frame travel-prog' });
    const drawProg = () => { prog.textContent = `📍 ${seen.length}/3 · ${stamped() ? '🛂 ✓' : '🛂 …'}`; };
    const at = (tx0, ty0) => ({ x: tx0 * TS + 8, y: ty0 * TS + 12 });
    const things = [
      ...map.marks.map((m) => ({ kind: 'mark', i: m.i, m: m.m, ...at(m.x, m.y), label: () => `📍 ${tx(m.m.name)}`, run: () => run('mark', m) })),
      { kind: 'guide', ...at(map.guide.x, map.guide.y), label: () => L('🧑 Хөтөчтэй ярилцах', '🧑 Talk to the guide'), run: () => run('guide') },
      { kind: 'camp', ...at(CAMP[0].x + 1, CAMP[0].y + 3), label: () => L('⛺ Жуулчны бааз', '⛺ Tourist ger camp'), run: () => run('camp') },
      { kind: 'bus', ...at(map.start.x, map.start.y), label: () => L('🚌 Нутаг руу буцах', '🚌 Return to Nutag'), run: () => sc.close() },
      { kind: 'family', ...at(FAM.fx, FAM.fy), label: () => L('🏠 Малчин айлд орох', '🏠 Visit the herder family'), run: () => run('family') },
      { kind: 'ovoo', ...at(OVOO.fx, OVOO.fy), label: () => L('🪨 Овоо тахих', '🪨 Honour the ovoo'), run: () => run('ovoo') },
      { kind: 'sign', ...at(SIGN.x, SIGN.y), label: () => L('📋 Самбар унших', '📋 Read the sign'), run: () => run('sign') },
      ...herds.map((hd) => Object.assign(hd, { kind: 'animal', penalty: 8, label: () => `🐾 ${tx(ANAME[hd.sp])}`, run: () => run('animal', hd) })),
    ];
    // the historian's task: an item to find, sparkling beside one of the sights
    const hq = TG.history && TG.history.target(id);
    if (hq) { const mk = map.marks.find((q) => q.i === hq.near) || map.marks[0]; let ax = mk.x + 2, ay = mk.y; for (const [dx, dy] of [[2, 0], [-2, 0], [2, 1], [-2, 1], [1, 1], [-1, 1]]) { const c = map.g[mk.y + dy] && map.g[mk.y + dy][mk.x + dx]; if (c === 'g' || c === 'p') { ax = mk.x + dx; ay = mk.y + dy; break; } }
      const art = { kind: 'artifact', ...at(ax, ay), label: () => `${hq.e} ${tx(hq.item)}`, run: () => { const q = TG.history.found(id); if (!q) return; things.splice(things.indexOf(art), 1); sc.say(h('b', null, `${q.e} `, L('Олдлоо!', 'Found it!')), h('p', null, tx(q.item), '. ', L('Нутагтаа буцаад Түүхчид өгөөрэй.', 'Take it back to the historian in Nutag.'))); } };
      things.push(art); }
    const byKind = (k) => things.find((q) => q.kind === k), guideT = byKind('guide'), busT = byKind('bus'), famT = byKind('family');
    function run(kind, m) {
      if (kind === 'mark') {
        if (!seen.includes(m.i)) { seen.push(m.i); S.save(); TG.sfx.chime && TG.sfx.chime(); TG.villageReward && TG.villageReward(5, 10); }
        sc.say(h('b', null, '📍 ', tx(m.m.name)), h('p', null, tx(m.m.desc)), seen.length === 3 && !stamped() ? h('small', null, L('Гурван газраар аялчихлаа! Одоо хөтөч дээр очоорой.', 'You visited all three places! Now go to the guide.')) : null);
        drawProg();
      } else if (kind === 'family') {
        const f = TG.FOODS && TG.FOODS.find((q) => q.id === det.food);
        sc.say(h('b', null, '🏠 ', L('Малчин айл', 'A herder family')), h('p', null, L('Сайн байна уу, хүүхэд минь! Манай гэрт тавтай морил. ', 'Hello, child! Welcome to our ger. '), tx(det.fact)),
          f ? h('button', { class: 'btn primary block', onclick: (e) => { e.currentTarget.disabled = true; TG.villageEat ? TG.villageEat(f.id, { free: true }) : null; if (!famDone()) { p.travelFam = p.travelFam || {}; p.travelFam[id] = 1; S.save(); TG.villageReward && TG.villageReward(5, 10); } } }, `${f.e} `, L(`${f.name.mn} амсах (үнэгүй)`, `Taste the ${f.name.en} (free)`)) : null,
          h('small', null, '🙏 ', L('Айлд орохдоо “Нохой хорио!” гэж дуудаад, зочин баруун талаар суудаг.', 'Before entering, call out “Hold the dog!”, and guests sit on the west side.')));
      } else if (kind === 'ovoo') {
        TG.sfx.chime && TG.sfx.chime();
        sc.say(h('b', null, '🪨 ', L('Овоо', 'The ovoo')), h('p', null, L('Овоог нар зөв гурав тойрч, чулуу нэмж, хадаг уядаг. Аянд гарахдаа сайн сайхан ерөөдөг заншилтай.', 'Walk around the ovoo three times sunwise, add a stone and tie a khadag, wishing for a safe journey.')));
      } else if (kind === 'sign') {
        sc.say(h('b', null, '📋 ', tx(a.name)), h('p', null, L(`Төв: ${a.center.mn}. Нутаг дэвсгэр: ${det.area ? det.area.toLocaleString('en-US') : '?'} км².`, `Centre: ${a.center.en}. Area: ${det.area ? det.area.toLocaleString('en-US') : '?'} km².`), ' ', tx(map.j.history)));
      } else if (kind === 'animal') {
        TG.sfx.pop && TG.sfx.pop();
        sc.say(h('b', null, '🐾 ', tx(ANAME[m.sp])), h('p', null, tx(ANIMAL[m.sp])), h('small', null, L('Монголчууд адуу, тэмээ, үхэр, хонь, ямаа гэсэн таван хошуу мал малладаг.', 'Mongolian herders keep the “five snouts”: horses, camels, cattle (and yaks), sheep and goats.')));
      } else if (kind === 'camp') {
        sc.say(h('b', null, '⛺ ', L('Жуулчны гэр бааз', 'Tourist ger camp')), h('p', null, L('Монголд ирсэн жуулчид гэр баазад буудаллаж, малчин айлын амьдралтай танилцдаг. Гэрийн хаалга урагшаа хардаг!', 'Visitors to Mongolia stay in ger camps and get to know herding life. Every ger door faces south!')));
      } else if (kind === 'guide') {
        const greet = L(`Сайн байна уу! ${a.name.mn} нутагт тавтай морил. Би ${eth ? tx(eth.name) : ''} хүн байна.`, `Hello! Welcome to ${a.name.en}. I am ${eth ? tx(eth.name) : ''}.`);
        if (TG.voice) TG.voice.babble(greet, 'local');
        if (stamped()) return sc.say(h('b', null, '🧑 ', L('Нутгийн хөтөч', 'Local guide')), h('p', null, greet, ' ', tx(map.j.history)), h('small', null, '🛂 ', L('Тамга авсан', 'Already stamped')));
        if (seen.length < 3) return sc.say(h('b', null, '🧑 ', L('Нутгийн хөтөч', 'Local guide')), h('p', null, greet, ' ', L('Эхлээд манай нутгийн 3 алдартай газраар аялаад ир. Дараа нь тамга өгье!', 'First visit our 3 famous places, then I’ll give you the stamp!')));
        const q = map.j.q, opts = q.o.map((o, i2) => ({ o, ok: i2 === q.a })).sort(() => Math.random() - 0.5);
        sc.say(h('b', null, '🧑 ', L('Нутгийн хөтөч', 'Local guide')), h('p', null, tx(map.j.history)), h('p', { class: 'travel-q' }, '🛂 ', tx(q.q)),
          h('div', { class: 'l-opts' }, opts.map(({ o, ok }) => h('button', { class: 'l-opt', onclick: (e) => {
            if (!ok) { e.currentTarget.classList.add('wrong'); e.currentTarget.disabled = true; TG.sfx.bad(); return; }
            TG.passport.stamp(id); TG.confetti(60); drawProg();
            const nx = TG.passport.nextId(p);
            sc.say(h('div', { class: 'pp-stamped' }, h('span', { class: 'pp-stamp big' }, a.icon), h('b', null, L('Тамга авлаа!', 'Stamped!'))),
              nx ? h('button', { class: 'btn primary block', onclick: () => { sc.close(); setTimeout(() => open(nx), 250); } }, '🚌 ', L('Дараагийн аймаг: ', 'Next province: '), tx(TG.aimags.byId(nx).name), ' →') : h('p', null, '🏆 ', L('Бүх аймгаар аялсан!', 'You visited every province!')));
          } }, tx(o)))));
      }
    }
    const blocked = (px, py) => { const X = Math.floor(px / TS), Y = Math.floor(py / TS); const c = map.g[Y] && map.g[Y][X]; return !c || BLOCK.includes(c); };
    const free = (px, py) => !blocked(px - 4, py - 2) && !blocked(px + 4, py - 2) && !blocked(px - 4, py + 2) && !blocked(px + 4, py + 2);
    drawProg();
    const fpWanted = (opts.view || p.travelView) === 'fp' && TG.fp && TG.fp.supported();
    let switching = false;
    const viewBtn = h('button', { class: 'btn scene-side travel-view', onclick: () => { p.travelView = fpWanted ? '2d' : 'fp'; S.save(); switching = true; sc.close(); setTimeout(() => open(id, { view: p.travelView }), 200); } }, fpWanted ? L('🗺️ Дээрээс харах', '🗺️ Top view') : L('👁 Өөрийн нүдээр (3D)', '👁 First person (3D)'));
    const SIZE = { sheep: 1.0, goat: 0.95, horse: 1.6, camel: 2.1, yak: 1.5, reindeer: 1.45, gazelle: 1.15 };
    const fpExtra = { // only the first-person view uses these
      map,
      actors: (t) => [
        ...herds.map((hd) => ({ img: TG.landmarks.critter(hd.sp, hd.moving ? Math.floor(t * 6) % 2 : 0), x: hd.x, y: hd.y, h: SIZE[hd.sp] || 1.2, flip: hd.flip })),
        { img: TG.pixel.char(guideLook, 0, 0), x: guideT.x, y: guideT.y, h: 1.8 },
        { img: TG.pixel.char(herderLook, 0, 0), x: famT.x, y: famT.y - 6, h: 1.8 },
      ],
      markers: () => [
        ...things.filter((q) => q.kind === 'mark').map((q) => ({ x: q.x, y: q.y, c: seen.includes(q.i) ? '#5c9a36' : '#f7c646', label: tx(q.m.name), lift: 2.6 })),
        ...(stamped() ? [] : [{ x: guideT.x, y: guideT.y, c: seen.length === 3 ? '#7fe07a' : '#f7c646', label: L('Хөтөч', 'Guide') }]),
        ...(famDone() ? [] : [{ x: famT.x, y: famT.y - 6, c: '#f7c646', label: L('Малчин айл', 'Herder family') }]),
        ...things.filter((q) => q.kind === 'artifact').map((q) => ({ x: q.x, y: q.y, c: '#7fe07a', label: `${hq.e} ${tx(hq.item)}`, lift: 1.4 })),
      ],
    };
    const cfg = {
      cls: 'travel-scene', W: MW * TS, H: MH * TS, fit: 190, bg: '#2b1e2e', look: v.look || {}, start: at(map.start.x, map.start.y), speed: 72,
      title: `${a.icon} ${tx(a.name)}`, sub: tx(a.center), right: prog, free, things, reach: 24, buttons: [viewBtn],
      hint: () => L('Шар тугтай газраар аялаарай', 'Visit the places with yellow flags'),
      drawBg: (b) => b.drawImage(terrain, 0, 0),
      step: (dt) => { // animals graze: stand a while, then amble to a nearby open spot
        for (const hd of herds) {
          const dx = hd.tx - hd.x, dy = hd.ty - hd.y, d = Math.hypot(dx, dy);
          if (d > 0.8) { const sp = 9 * dt; hd.x += (dx / d) * Math.min(sp, d); hd.y += (dy / d) * Math.min(sp, d); hd.moving = true; if (Math.abs(dx) > 0.3) hd.flip = dx < 0; }
          else { hd.moving = false; hd.wait -= dt; if (hd.wait <= 0) { hd.wait = 2 + Math.random() * 5; const nx = hd.hx + (Math.random() - 0.5) * 70, ny = hd.hy + (Math.random() - 0.5) * 40; if (free(nx, ny)) { hd.tx = nx; hd.ty = ny; } } }
        }
      },
      ents: (t) => [
        ...things.filter((q) => q.kind === 'artifact').map((q) => ({ y: q.y, f: (b) => { const tw = Math.floor(t * 6) % 4; b.fillStyle = '#fff6c8'; b.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 6, 3, 3); b.fillStyle = '#f7c646'; if (tw < 2) { b.fillRect(Math.round(q.x) - 4, Math.round(q.y) - 5, 9, 1); b.fillRect(Math.round(q.x), Math.round(q.y) - 9, 1, 9); } } })),
        ...herds.map((hd) => ({ y: hd.y, f: (b) => { const img = TG.landmarks.critter(hd.sp, hd.moving ? Math.floor(t * 6) % 2 : 0), X = Math.round(hd.x - 10), Y = Math.round(hd.y - 14); b.fillStyle = 'rgba(30,20,10,.22)'; b.fillRect(X + 4, Y + 14, 12, 2); if (hd.flip) { b.save(); b.translate(X + 20, Y); b.scale(-1, 1); b.drawImage(img, 0, 0); b.restore(); } else b.drawImage(img, X, Y); } })),
        { y: famT.y - 2, f: (b) => { const f0 = famT; b.drawImage(TG.pixel.char(herderLook, Math.floor(t / 3) % 4 === 3 ? 2 : 0, 0), Math.round(f0.x - 8), Math.round(f0.y - 28)); if (!famDone()) { b.fillStyle = '#f7c646'; const bob = Math.round(Math.sin(t * 5) * 1.5); b.fillRect(Math.round(f0.x - 1), Math.round(f0.y - 38) + bob, 2, 5); b.fillRect(Math.round(f0.x - 1), Math.round(f0.y - 32) + bob, 2, 2); } } },
        ...things.filter((q) => q.kind === 'mark').map((q) => ({ y: q.y, f: (b) => { const done = seen.includes(q.i), X = Math.round(q.x), Y = Math.round(q.y); TG.pixel.R(b, X - 1, Y - 18, 2, 18, '#6b4220'); TG.pixel.R(b, X + 1, Y - 18, 8, 6, '#2b1e2e'); TG.pixel.R(b, X + 1, Y - 17, 7, 4, done ? '#5c9a36' : '#f7c646'); if (!done && Math.floor(t * 3) % 2) TG.pixel.R(b, X + 4, Y - 24, 2, 3, '#ffffff'); } })),
        { y: guideT.y, f: (b) => { const g0 = guideT; b.drawImage(TG.pixel.char(guideLook, 0, 0), Math.round(g0.x - 8), Math.round(g0.y - 26)); if (!stamped()) { b.fillStyle = seen.length === 3 ? '#7fe07a' : '#f7c646'; const bob = Math.round(Math.sin(t * 5) * 1.5); b.fillRect(Math.round(g0.x - 1), Math.round(g0.y - 36) + bob, 2, 5); b.fillRect(Math.round(g0.x - 1), Math.round(g0.y - 30) + bob, 2, 2); } } },
      ],
      drawTop: (b, t) => {
        const WW = MW * TS, HH = MH * TS;
        for (let i = 0; i < 3; i++) { const cx = ((t * 6 + i * 170) % (WW + 120)) - 60, cy = 40 + i * 90 + Math.sin(t * 0.2 + i) * 10; b.fillStyle = 'rgba(20,30,60,.07)'; b.beginPath(); b.ellipse(cx, cy, 46, 16, 0, 0, Math.PI * 2); b.fill(); } // cloud shadows drifting over the land
        const bird = det.birds;
        if (bird) for (let i = 0; i < (bird === 'eagle' ? 1 : 5); i++) {
          const flap = Math.floor(t * (bird === 'eagle' ? 3 : 6) + i) % 2;
          let bx, by; if (bird === 'eagle') { bx = WW * 0.6 + Math.cos(t * 0.4) * 70; by = 70 + Math.sin(t * 0.4) * 30; } else { bx = ((t * 14) % (WW + 160)) - 80 - i * 9; by = 50 + Math.abs(i - 2) * 6; }
          const col = bird === 'swan' ? '#ffffff' : bird === 'crane' ? '#c9ccd6' : '#5a3a22', X = Math.round(bx), Y = Math.round(by), w = bird === 'eagle' ? 6 : 4;
          b.fillStyle = col; b.fillRect(X - 1, Y, 3, 2); b.fillRect(X - w, Y - (flap ? 2 : -1), w - 1, 1); b.fillRect(X + 2, Y - (flap ? 2 : -1), w - 1, 1);
          if (bird === 'crane') { b.fillStyle = '#2b1e2e'; b.fillRect(X + 2, Y, 2, 1); }
        }
        if (map.snow || TG.seasons.current().id === 'winter') for (let i = 0; i < 40; i++) { b.fillStyle = 'rgba(255,255,255,.8)'; b.fillRect(Math.round((i * 53 + Math.sin(t + i) * 6) % (MW * TS)), Math.round((i * 31 + t * 16 * (1 + (i % 3) * 0.3)) % (MH * TS)), 1, 1); } },
      mini: { img: terrain, w: MW * 4, h: MH * 4, dots: () => [...things.filter((q) => q.kind === 'mark').map((q) => ({ x: q.x, y: q.y, c: seen.includes(q.i) ? '#5c9a36' : '#f7c646' })), { x: guideT.x, y: guideT.y, c: stamped() ? '#ffffff' : seen.length === 3 ? '#7fe07a' : '#f492ba' }, { x: busT.x, y: busT.y, c: '#3f76db' }, { x: famT.x, y: famT.y, c: famDone() ? '#ffffff' : '#f7c646' }] },
      info: [h('b', null, '🚌 ', L(`${a.name.mn}-д ирлээ!`, `You arrived in ${a.name.en}!`)), h('p', null, L(`Төв: ${a.center.mn} · ${det.area ? det.area.toLocaleString('en-US') : '?'} км². `, `Centre: ${a.center.en} · ${det.area ? det.area.toLocaleString('en-US') : '?'} km². `), L('Шар тугтай 3 үзвэрээр аялж, дараа нь нутгийн хөтөчтэй уулзаарай. WASD-аар алхаж, E дарж үзнэ, Space дарвал үсэрнэ. Баруун дээд буланд газрын зураг бий.', 'Visit the 3 sights with yellow flags, then meet the local guide. Walk with WASD, press E to look, Space to jump. The map is in the top-right corner.'))],
      onClose: () => { if (!switching && document.querySelector('.pp-grid, .pp-visit')) TG.go('passport'); },
    };
    let sc = null;
    if (fpWanted) { try { sc = TG.fp.open({ ...cfg, ...fpExtra, info: [...cfg.info.slice(0, 1), h('p', null, window.matchMedia && matchMedia('(pointer: coarse)').matches ? L('Өөрийн нүдээр аялж байна! Зүүн талд чирж алхаж, баруун талд чирж эргэн харна. ⤒ үсрэх, 🏃 гүйх, доод товчоор харилцана. Гэр рүү орж ч болно!', 'You are travelling first person! Drag on the left to walk and on the right to look around. ⤒ jumps, 🏃 runs, the big button interacts. You can even walk into the gers!') : L('Өөрийн нүдээр аялж байна! Дэлгэц дээр дарж хулганаар эргэн харна. WASD алхах, Space үсрэх, Shift гүйх, E эсвэл хулганы товч харилцах. Гэр рүү орж ч болно!', 'You are travelling first person! Click to look around with the mouse. WASD walk, Space jump, Shift sprint, E or a click to interact. You can even walk into the gers!'))] }); } catch (e) { console.warn('first-person view failed', e); sc = null; } }
    if (!sc) sc = TG.scene.open(cfg);
    TG.sfx.whoosh && TG.sfx.whoosh();
    TG.travel._cur = { me: sc.me, things, run: (t) => t.run(), seen, close: () => sc.close(), view: fpWanted && sc.P ? 'fp' : '2d', sc }; // used by automated tests
  }
  TG.travel = { open, build, CAMP, FAM, OVOO, SIGN, TS, DETAIL, LW, LH, LAKES };
})(window.TG);
