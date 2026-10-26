/* Эх орноо хамгаалах: the defend-the-homeland campaign. Four chapters from real Mongolian history; each one teaches the
   story before and after the fight. Nobody gets hurt: whistling arrows (дуут сум) and the lasso (уурга) only take away the
   raiders' courage (зориг), and when it runs out they turn round and ride home. */
(function (TG) {
  const T = (mn, en) => ({ mn, en });
  const CHAPTERS = [
    { id: 'merkit', year: T('1180-аад он', 'the 1180s'), name: T('Мэргидийн дайралт', 'The Merkit raid'),
      intro: T('Мэргидийн дайчид Тэмүжиний нутаг руу гэнэт довтолж, Бөртийг булаан авчээ. Тэмүжин Хэрэйдийн Тоорил хан, анд Жамуха хоёртой нэгдэн Бөртийг аварч, нутгаа хамгаалжээ. Одоо чиний ээлж: малаа хамгаал!',
        'Merkit warriors raided Temüjin’s camp and carried off Börte. Temüjin joined forces with Toghrul Khan of the Kereit and his sworn brother Jamukha to rescue her and protect their land. Now it’s your turn: protect the herd!'),
      after: T('Тэмүжин, Тоорил, Жамуха гурав хамтран Мэргидийг ялж, Бөртийг эсэн мэнд аварсан гэж Нууц товчоонд өгүүлдэг. Найз нөхөд, холбоотнуудтайгаа нэгдвэл хүчтэй гэдгийг энэ түүх сургадаг.',
        'The Secret History tells how Temüjin, Toghrul and Jamukha together defeated the Merkits and brought Börte home safely. The story teaches that friends and allies are strongest together.'),
      enemy: { name: T('Мэргид', 'Merkit'), look: { deel: 'black', hat: 'fur', skin: '#D9A06E' }, coat: 'black', courage: 2 },
      allies: [{ name: T('Жамуха', 'Jamukha'), look: { deel: 'purple', hat: 'fur', skin: '#EDBB93' }, coat: 'gray' }, { name: T('Тоорил хан', 'Toghrul Khan'), look: { deel: 'gold', hat: 'mongol', skin: '#D9A06E' }, coat: 'white' }],
      waves: [3, 4, 5], weapon: 'arrow' },
    { id: 'tatar', year: T('XII зуун', 'the 12th century'), name: T('Татаруудын довтолгоо', 'The Tatar raiders'),
      intro: T('Татарууд олон жилийн турш Монгол аймгуудтай байлддаг байв. Тэмүжиний эцэг Есүхэй баатрыг ч Татарууд хорлосон гэдэг. Тэд нутаг руу довтолж байна: гэр, малаа хамгаал!',
        'For many years the Tatars fought the Mongol clans; it is said they poisoned Temüjin’s father, Yesügei. Now they are riding in: protect the gers and the herd!'),
      after: T('1202 онд Тэмүжин Татаруудыг ялж, Монголын аймгуудыг нэгтгэх замдаа том алхам хийжээ. 1206 онд тэрээр Чингис хаан болж, Их Монгол Улсыг байгуулсан.',
        'In 1202 Temüjin defeated the Tatars, a big step towards uniting the Mongol clans. In 1206 he became Chinggis Khaan and founded the Great Mongol State.'),
      enemy: { name: T('Татар', 'Tatar'), look: { deel: 'brown', hat: 'fur', skin: '#D9A06E' }, coat: 'chestnut', courage: 3 },
      allies: [{ name: T('Боорчи', 'Boorchi'), look: { deel: 'blue', hat: 'mongol', skin: '#D9A06E' }, coat: 'bay' }, { name: T('Зэлмэ', 'Jelme'), look: { deel: 'green', hat: 'mongol', skin: '#B97A4A' }, coat: 'gray' }],
      waves: [4, 5, 6], weapon: 'arrow' },
    { id: 'khiagt', year: T('1921 он', '1921'), name: T('Хиагтын тулалдаан', 'The Battle of Khiagt'),
      intro: T('1919 оноос гадаадын цэрэг Монголыг эзлэн байв. 1921 оны 3 дугаар сарын 18-нд Сүхбаатарын удирдсан ардын цэрэг Хиагтад (одоогийн Алтанбулаг) тэднийг хөөн гаргажээ. Сүхбаатартай хамт нутгаа чөлөөл!',
        'From 1919 foreign troops occupied Mongolia. On 18 March 1921 the people’s army led by Sükhbaatar drove them out of Khiagt (today’s Altanbulag). Free the land with Sükhbaatar!'),
      after: T('Хиагтын ялалтын өдөр 3 дугаар сарын 18-ныг одоо Монгол цэргийн өдөр болгон тэмдэглэдэг. Мөн оны 7 дугаар сарын 11-нд ардын засгийн газар байгуулагдаж, тэр өдрийг Наадмаар тэмдэглэдэг.',
        'The victory at Khiagt on 18 March is now celebrated as Mongolian Armed Forces Day. That July 11 the people’s government was formed, the day we celebrate with Naadam.'),
      enemy: { name: T('Эзлэн түрэмгийлэгч', 'Occupier'), look: { deel: 'black', hat: 'cap', skin: '#EDBB93' }, coat: 'gray', courage: 3 },
      allies: [{ name: T('Сүхбаатар', 'Sükhbaatar'), look: { deel: 'blue', hat: 'loovuuz', skin: '#D9A06E' }, coat: 'white' }, { name: T('Ардын цэрэг', 'People’s soldier'), look: { deel: 'green', hat: 'mongol', skin: '#B97A4A' }, coat: 'bay' }],
      waves: [4, 6, 7], weapon: 'arrow' },
    { id: 'khalkhgol', year: T('1939 он', '1939'), name: T('Халх голын хамгаалалт', 'Defending Khalkh Gol'),
      intro: T('1939 оны зун Японы арми Дорнод аймгийн Халх голын хилээр Монгол руу довтолжээ. Монгол, Зөвлөлтийн цэрэг хамтран хилээ хамгаалж, түрэмгийлэгчдийг буцаасан. Хилээ хамгаал!',
        'In summer 1939 the Japanese army crossed the Khalkh Gol border into Mongolia, in Dornod. Mongolian and Soviet troops defended the border together and turned the invaders back. Guard the border!'),
      after: T('Халх голын тулалдаан 1939 оны 9 дүгээр сард дуусч, Монгол Улс хилээ хамгаалж үлдсэн. Энэ бол Монгол руу гадаадын арми довтолсон хамгийн сүүлийн удаа байв. Энх тайван бол хамгийн үнэтэй зүйл.',
        'The fighting at Khalkh Gol ended in September 1939, and Mongolia kept its border. It was the last time a foreign army invaded Mongolia. Peace is the most precious thing of all.'),
      enemy: { name: T('Түрэмгийлэгч', 'Invader'), look: { deel: 'brown', hat: 'cap', skin: '#EDBB93' }, coat: 'chestnut', courage: 4 },
      allies: [{ name: T('Морин цэрэг', 'Cavalryman'), look: { deel: 'green', hat: 'mongol', skin: '#D9A06E' }, coat: 'bay' }, { name: T('Хилчин', 'Border guard'), look: { deel: 'teal', hat: 'loovuuz', skin: '#B97A4A' }, coat: 'black' }],
      waves: [5, 6, 8], weapon: 'arrow' },
  ];
  TG.battles = { CHAPTERS, byId: (id) => CHAPTERS.find((c) => c.id === id) };
})(window.TG);
