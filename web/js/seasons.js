/* Улирал: Нутаг moves through the four Mongolian seasons, one per real day (spring → summer → autumn → winter),
   so every child sees all four within a few days. Each season explains what herding families do, with facts and history. */
(function (TG) {
  const { h, L, tx } = TG;
  const T = (mn, en) => ({ mn, en });
  const SEASONS = [
    {
      id: 'spring', icon: '🌸', color: '#f492ba', name: T('Хавар', 'Spring'), months: T('3–5-р сар', 'March–May'), camp: T('Хаваржаа', 'Spring camp (khavarjaa)'),
      intro: T('Цас хайлж, мал төллөдөг сэргэлэн улирал. Малчид салхинаас хамгаалагдсан хаваржаандаа буудаг.', 'Snow melts and the herds give birth. Herders stay at their sheltered spring camp.'),
      todo: [T('Төл бойжуулах: хурга, ишиг, тугал, ботго, унагыг дулаахан байлгаж асрах', 'Raise the newborns: keep lambs, kids, calves, camel calves and foals warm'), T('Ямааны ноолуур самнах', 'Comb cashmere from the goats'), T('Хүйтэн, шороон шуурганаас малаа хамгаалах', 'Protect the herd from cold winds and dust storms'), T('Хотын айлууд мод тарьж, газар хагалж эхэлдэг', 'Families plant trees and start ploughing fields')],
      facts: [T('Монголд 60 гаруй сая мал бий. Ихэнх төл нь хавар төрдөг.', 'Mongolia has over 60 million livestock, and most young animals are born in spring.'), T('Хавар Монголд шороон шуурга олонтаа болдог.', 'Spring in Mongolia often brings dust storms.'), T('Ноолуур Монголын хамгийн алдартай экспортын нэг.', 'Cashmere is one of Mongolia’s most famous exports.')],
      history: [T('Малчид хаваржаагаа уулын энгэр, салхинаас хоргодсон газар сонгодог уламжлалтай.', 'Herders traditionally choose spring camps on sunny slopes sheltered from the wind.'), T('Төлийг “ирээдүйн баялаг” гэж эрхэмлэдэг.', 'Newborn animals are cherished as “the wealth of the future”.')],
      tasks: ['pet', 'milk'], game: T('Нутагт: хонь, хургаа илбэж, төлөө тойлж, хот айлдаа мал саагаарай.', 'In Nutag: pet the sheep and the newborn lambs, and milk the animals in the dairy yard.'),
    },
    {
      id: 'summer', icon: '☀️', color: '#f7c646', name: T('Зун', 'Summer'), months: T('6–8-р сар', 'June–August'), camp: T('Зуслан', 'Summer camp (zuslan)'),
      intro: T('Ногоо ургаж, цагаан идээ элбэг, Наадам болдог хамгийн хөгжилтэй улирал.', 'The grass is green, dairy foods are plentiful and Naadam takes place: the most joyful season.'),
      todo: [T('Гол, нуурын дэргэд зуслах', 'Camp beside rivers and lakes'), T('Тараг, өрөм, ааруул хийж, айраг бүлэх', 'Make yogurt, cream and aaruul, and churn airag'), T('Наадамд бөх, морь уралдаан, сур харваанд оролцох', 'Take part in wrestling, horse racing and archery at Naadam'), T('Эсгий хийж, гэрийн туургаа шинэчлэх', 'Make felt and renew the ger walls')],
      facts: [T('Улсын баяр наадам жил бүр 7-р сарын 11–13-нд болдог.', 'The national Naadam is held every year on July 11–13.'), T('Монголын хур тунадасны ихэнх нь зун ордог.', 'Most of Mongolia’s rain falls in summer.'), T('Айргийг хөхүүрт мянга мянган удаа бүлж исгэдэг.', 'Airag is churned thousands of times in a leather bag.')],
      history: [T('Наадам эрт дээр үеэс цэргийн бэлтгэл, тахилгын баяр байсан гэдэг.', 'Naadam is said to have begun long ago as military training and a festival of offerings.'), T('Зусланд айлууд хамтдаа нүүж, хөршүүдтэйгээ ойр буудаг уламжлалтай.', 'At summer camp, families often move together and camp close to neighbours.')],
      tasks: ['race', 'archery', 'fish'], game: T('Нутагт: морин уралдаан, сур харваа, загасчлал.', 'In Nutag: horse racing, archery and fishing.'),
    },
    {
      id: 'autumn', icon: '🍂', color: '#f39b2c', name: T('Намар', 'Autumn'), months: T('9–11-р сар', 'September–November'), camp: T('Намаржаа', 'Autumn camp (namarjaa)'),
      intro: T('Ургац хурааж, өвс бэлтгэж, урт өвөлд бэлддэг завгүй улирал.', 'A busy season: harvest crops, cut hay and prepare for the long winter.'),
      todo: [T('Өвс, тэжээл бэлтгэх', 'Cut and store hay for the animals'), T('Төмс, лууван, улаан буудай хураах', 'Harvest potatoes, carrots and wheat'), T('Өвлийн идэш бэлтгэх', 'Prepare the winter food stores'), T('Намаржаа, дараа нь өвөлжөөндөө нүүх', 'Move to the autumn camp, then on to the winter camp')],
      facts: [T('Малчин айл жилд дунджаар 4 удаа нүүдэг: хаваржаа, зуслан, намаржаа, өвөлжөө.', 'Herding families usually move about 4 times a year: spring, summer, autumn and winter camps.'), T('Намар мал хамгийн тарган, хүчтэй байдаг.', 'In autumn the animals are at their fattest and strongest.'), T('Сэлэнгэ аймаг Монголын үр тарианы гол бүс.', 'Selenge province is Mongolia’s main grain-growing region.')],
      history: [T('“Намрын тарган мал өвлийн аюулыг даана” гэсэн үг бий.', 'A saying goes: “Fat animals in autumn survive the dangers of winter.”'), T('Эрт цагт айлууд намар хамтдаа өвс хадаж, бие биедээ тусалдаг байжээ.', 'In the past, families cut hay together in autumn and helped each other.')],
      tasks: ['dairy', 'sell'], game: T('Нутагт: өвөлдөө зориулж ааруул, өрөм хийж, илүүг нь зараарай.', 'In Nutag: make aaruul and öröm for the winter and sell them at the shop.'),
    },
    {
      id: 'winter', icon: '❄️', color: '#93d4f6', name: T('Өвөл', 'Winter'), months: T('12–2-р сар', 'December–February'), camp: T('Өвөлжөө', 'Winter camp (övöljöö)'),
      intro: T('Маш хүйтэн, урт шөнөтэй улирал. Гэр бүлүүд галын дэргэд үлгэр ярьж, Цагаан сар тэмдэглэдэг.', 'A very cold season with long nights. Families tell stories by the stove and celebrate Tsagaan Sar.'),
      todo: [T('Малаа хашаа, хороонд хамгаалах', 'Shelter the animals in pens and stalls'), T('Гэрээ дулаалж, зуухаа асаах', 'Insulate the ger and keep the stove burning'), T('Шагай харваж, үлгэр, оньсого ярих', 'Play knucklebones and share stories and riddles'), T('Цагаан сараар ахмадуудтайгаа золгох', 'Greet the elders at Tsagaan Sar, the Lunar New Year')],
      facts: [T('Улаанбаатар бол дэлхийн хамгийн хүйтэн нийслэл.', 'Ulaanbaatar is the coldest capital city in the world.'), T('Өвлийн хүйтэн −40°C хүрч болно.', 'Winter cold can reach −40°C.'), T('Цас их орж, мал бэлчиж чадахгүй болохыг “зуд” гэдэг.', 'When deep snow or ice stops animals from grazing, it is called a “zud”.')],
      history: [T('Өвлийн туйлаас эхлэн 81 хоногийг “есөн ес” гэж есөн есөөр тоолдог уламжлалтай.', 'From the winter solstice, people count 81 days in nine “nines” of cold.'), T('Цагаан сар бол хаврын эхлэлийг угтдаг сар шинийн баяр.', 'Tsagaan Sar is the Lunar New Year that welcomes the start of spring.')],
      tasks: ['quiz', 'wrestle'], game: T('Нутагт: Басарын асуултад хариулж, бөх барилдаарай.', 'In Nutag: answer Basar’s questions and wrestle.'),
    },
  ];
  const day = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  /** The season in Нутаг today (one per real day, cycling). */
  const current = (d) => SEASONS[day(d) % 4];
  /** The real season in Mongolia right now, by month. */
  const real = (d = new Date()) => SEASONS[[3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][d.getMonth()]];
  /** Evening in Нутаг (19:00–6:00 local time): the top view and first person both go dark together. */
  const night = (d = new Date()) => { const hr = d.getHours(); return hr >= 19 || hr < 6; };

  function wheel(cur) {
    return h('div', { class: 'season-wheel' }, SEASONS.map((s) => h('div', { class: 'sw-i' + (s === cur ? ' on' : ''), style: { '--sc': s.color } }, h('span', null, s.icon), h('b', null, tx(s.name)), h('small', null, tx(s.camp)))));
  }
  /** The season explainer: what Mongolians do, facts, history and the tasks in Нутаг. */
  function open() {
    const s = current(), r = real(), next = SEASONS[(SEASONS.indexOf(s) + 1) % 4];
    const list = (items) => h('ul', null, items.map((i) => h('li', null, tx(i))));
    TG.modal(h('div', { class: 'season-modal', style: { '--sc': s.color } },
      h('div', { class: 'season-head' }, h('span', { class: 'season-icon' }, s.icon), h('div', null, h('div', { class: 'eyebrow' }, L('Нутгийн улирал', 'Season in Nutag')), h('h2', null, tx(s.name)), h('small', null, `${L('Монголд', 'In Mongolia')}: ${tx(s.months)} · ${tx(s.camp)}`))),
      h('p', { class: 'season-intro' }, tx(s.intro)),
      wheel(s),
      h('h3', null, '🐑 ', L('Энэ улиралд малчид юу хийдэг вэ?', 'What do herders do this season?')), list(s.todo),
      h('h3', null, '💡 ', L('Сонирхолтой баримт', 'Fun facts')), list(s.facts),
      h('h3', null, '📜 ', L('Түүх, уламжлал', 'History & tradition')), list(s.history),
      h('div', { class: 'season-task' }, h('b', null, '🎯 ', L('Улирлын даалгавар', 'Season task')), h('p', null, tx(s.game)), h('small', null, L('Өдрийн даалгаврын самбарт улирлын тусгай даалгавар (+50% шагнал) байна.', 'The quest board has a special season quest (+50% reward).'))),
      h('p', { class: 'muted season-foot' }, L(`Нутагт улирал өдөр бүр солигдоно. Маргааш: ${next.icon} ${tx(next.name)}. Жинхэнэ Монголд яг одоо ${r.icon} ${tx(r.name)} байна.`, `Seasons in Nutag change every day. Tomorrow: ${next.icon} ${tx(next.name)}. In real Mongolia it is ${r.icon} ${tx(r.name)} right now.`))), { cls: 'v-modal' });
  }
  TG.seasons = { SEASONS, current, real, night, open, byId: (id) => SEASONS.find((s) => s.id === id) };
})(window.TG);
