/* Аймгийн паспорт: travel Mongolia one province at a time. Each stop shows the real landscape, famous landmarks
   and history; answering one question earns the stamp and unlocks the next province on the route. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const M = (mn, en, dmn, den) => ({ name: T(mn, en), desc: T(dmn, den) });
  const Q = (qmn, qen, om, oe, a) => ({ q: T(qmn, qen), o: om.map((m, i) => T(m, oe[i])), a });
  // the travel route: from the capital east, through the Gobi, the Khangai, the north, then the far west
  const J = {
    ub: { land: ['city'], marks: [M('Сүхбаатарын талбай', 'Sükhbaatar Square', 'Хотын төв талбай. Төрийн ордонд Чингис хааны том хөшөө бий.', 'The central square. Government Palace has a huge statue of Chinggis Khaan.'), M('Гандантэгчэнлин хийд', 'Gandan Monastery', 'Монголын хамгийн том хийдүүдийн нэг, 26 метрийн Мэгжид Жанрайсэг бурхантай.', 'One of Mongolia’s largest monasteries, with a 26-metre statue of Migjid Janraisig.'), M('Богд хааны ордон', 'Bogd Khan Palace', 'Монголын сүүлчийн хаан Богд хааны өвлийн ордон, одоо музей.', 'Winter palace of the Bogd Khan, Mongolia’s last king, now a museum.')],
      history: T('1639 онд Өргөө нэртэй нүүдлийн хүрээ болж байгуулагдаж, олон удаа нүүсний эцэст 1778 онд одоогийн газартаа суурьшжээ. 1924 онд Улаанбаатар гэж нэрлэсэн.', 'Founded in 1639 as Örgöö, a moving monastery-town. After many moves it settled here in 1778, and was named Ulaanbaatar in 1924.'),
      q: Q('Улаанбаатар хотыг анх ямар нэрээр байгуулсан бэ?', 'What was Ulaanbaatar first called?', ['Өргөө', 'Хархорум', 'Дархан'], ['Örgöö', 'Karakorum', 'Darkhan'], 0) },
    tuv: { land: ['steppe', 'mountains'], marks: [M('Чингис хааны морьт хөшөө', 'Chinggis Khaan Equestrian Statue', 'Цонжин болдогт 40 метр өндөр, дэлхийн хамгийн том морьт хөшөө.', 'At Tsonjin Boldog, 40 metres tall: the world’s largest equestrian statue.'), M('Хустайн нуруу', 'Khustai National Park', 'Зэрлэг адуу тахийг эх нутагт нь эргүүлэн нутагшуулсан газар.', 'Where the wild takhi horse was brought back to its homeland.'), M('Тэрэлж, Мэлхий хад', 'Terelj and Turtle Rock', 'Яст мэлхий шиг хэлбэртэй алдартай хад.', 'A famous rock shaped like a turtle.')],
      history: T('Домогт Тэмүжин Цонжин болдогоос алтан ташуур олсон гэдэг. Тахь 1960-аад онд байгальд устаж, 1990-ээд онд Хустайд эргэн ирсэн.', 'Legend says Temüjin found a golden whip at Tsonjin Boldog. The takhi died out in the wild in the 1960s and returned to Khustai in the 1990s.'),
      q: Q('Хустайн нуруунд ямар ховор амьтныг нутагшуулсан бэ?', 'Which rare animal was brought back to Khustai?', ['Тахь', 'Цагаан баавгай', 'Арслан'], ['The takhi wild horse', 'A polar bear', 'A lion'], 0) },
    khentii: { land: ['mountains', 'forest', 'river'], marks: [M('Бурхан халдун', 'Burkhan Khaldun', 'Чингис хааны тахиж байсан ариун уул. ЮНЕСКО-гийн өвд бүртгэлтэй.', 'The sacred mountain Chinggis Khaan worshipped, on the UNESCO list.'), M('Дэлүүн болдог', 'Delüün Boldog', 'Дадал сумын энэ газарт Чингис хаан төрсөн гэж үздэг.', 'In Dadal district, believed to be Chinggis Khaan’s birthplace.'), M('Хөх нуур', 'Khökh Lake', 'Тэмүжинийг анх хаан өргөмжилсөн газар гэдэг.', 'Said to be where Temüjin was first proclaimed khan.')],
      history: T('Чингис хаан 1162 онд Онон голын Дэлүүн болдогт төржээ. Онон, Хэрлэн голын сав газар бол монголчуудын өлгий нутаг.', 'Chinggis Khaan was born in 1162 at Delüün Boldog on the Onon river. The Onon and Kherlen valleys are the cradle of the Mongols.'),
      q: Q('Чингис хаан аль аймагт төрсөн гэж үздэг вэ?', 'In which province is Chinggis Khaan believed to have been born?', ['Хэнтий', 'Увс', 'Өмнөговь'], ['Khentii', 'Uvs', 'Ömnögovi'], 0) },
    dornod: { land: ['steppe', 'lake'], marks: [M('Буйр нуур', 'Buir Lake', 'Дорнод Монголын том нуур, загас элбэгтэй.', 'A large lake in eastern Mongolia, rich in fish.'), M('Халх гол', 'Khalkh River', '1939 оны Халх голын байлдаан болсон газар.', 'Site of the 1939 Battle of Khalkh Gol.'), M('Монгол дагуурын тал', 'Mongol Daguur steppe', 'Цагаан зээр сүрэглэн нүүдэллэдэг өргөн тал.', 'A vast steppe where herds of Mongolian gazelles roam.')],
      history: T('1939 онд Халх голд Монгол, Зөвлөлтийн цэрэг Японы армийг ялсан. Хэрлэн Барс хотын балгас бол Киданы үеийн эртний хот.', 'In 1939 Mongolian and Soviet troops defeated the Japanese army at Khalkh Gol. Kherlen Bars is the ruin of a Khitan-era city.'),
      q: Q('Дорнодын тал нутагт сүрэглэн нүүдэллэдэг амьтан аль вэ?', 'Which animal roams Dornod’s steppe in great herds?', ['Цагаан зээр', 'Цаа буга', 'Хавтгай тэмээ'], ['Mongolian gazelle', 'Reindeer', 'Wild camel'], 0) },
    sukhbaatar: { land: ['steppe', 'hills'], marks: [M('Шилийн богд уул', 'Shiliin Bogd', 'Унтарсан галт уул. Эрчүүд наран мандахыг угтан гардаг ариун уул.', 'An extinct volcano and sacred mountain where men climb to greet the sunrise.'), M('Ганга нуур', 'Ganga Lake', 'Намар хун шувуу ирдэг сайхан нуур.', 'A lovely lake where swans arrive in autumn.'), M('Дарьганга', 'Dariganga', 'Мөнгөний дархчууд, хурдан морьдоороо алдартай нутаг.', 'Famous for silversmiths and fast horses.')],
      history: T('Дарьгангын нутаг эрт дээр үеэс хааны адуу бэлчээдэг газар байсан бөгөөд мөнгөн эдлэлийн урлал хөгжсөн.', 'Dariganga long grazed the royal horse herds, and its silverwork tradition flourished.'),
      q: Q('Ганга нуурт намар ямар шувуу ирдэг вэ?', 'Which birds come to Ganga Lake in autumn?', ['Хун', 'Тоть', 'Оцон шувуу'], ['Swans', 'Parrots', 'Penguins'], 0) },
    dornogovi: { land: ['desert'], marks: [M('Хамарын хийд', 'Khamaryn Monastery', 'XIX зуунд Данзанравжаагийн байгуулсан хийд.', 'Founded in the 19th century by Danzanravjaa.'), M('Шамбалын орон', 'Shambhala site', 'Эрчим хүчний төв гэж олон хүн мөргөдөг газар.', 'A site many visit as a centre of good energy.'), M('Замын-Үүд', 'Zamyn-Üüd', 'Монголын урд хилийн боомт хот.', 'Mongolia’s southern border town.')],
      history: T('Догшин ноён хутагт Данзанравжаа яруу найрагч, жүжгийн зохиолч байсан бөгөөд Монголын анхны мэргэжлийн театрыг үүсгэсэн гэдэг.', 'Danzanravjaa was a poet and playwright, said to have created Mongolia’s first professional theatre.'),
      q: Q('Хамарын хийдийг хэн байгуулсан бэ?', 'Who founded Khamaryn Monastery?', ['Данзанравжаа', 'Чингис хаан', 'Занабазар'], ['Danzanravjaa', 'Chinggis Khaan', 'Zanabazar'], 0) },
    govisumber: { land: ['steppe', 'desert'], marks: [M('Чойр хот', 'Choir', 'Төмөр замын дагуух аймгийн төв.', 'The province centre beside the railway.'), M('Чойрын Богд уул', 'Choiryn Bogd', 'Тал дундах хадан уул.', 'A rocky mountain rising from the plain.'), M('Шивээ-Овоо', 'Shivee-Ovoo', 'Нүүрсний томоохон уурхай.', 'A large coal mine.')],
      history: T('Говьсүмбэр 1994 онд байгуулагдсан хамгийн шинэ аймгуудын нэг. Монголыг дайрч өнгөрдөг төмөр зам Чойроор дайрдаг.', 'Govisümber, founded in 1994, is one of the newest provinces. The trans-Mongolian railway passes through Choir.'),
      q: Q('Говьсүмбэр аймаг хэдэн онд байгуулагдсан бэ?', 'When was Govisümber province founded?', ['1994', '1206', '1921'], ['1994', '1206', '1921'], 0) },
    dundgovi: { land: ['desert', 'rocks'], marks: [M('Цагаан суварга', 'Tsagaan Suvarga', 'Өнгө алаг давхраатай цагаан хадан хясаа.', 'White cliffs with colourful layers.'), M('Их газрын чулуу', 'Ikh Gazryn Chuluu', 'Гайхамшигт хэлбэртэй боржин хаднууд.', 'Granite rocks in amazing shapes.'), M('Бага газрын чулуу', 'Baga Gazryn Chuluu', 'Хадан дунд рашаантай, агуйтай газар.', 'Rocks with springs and caves.')],
      history: T('Цагаан сувраганы давхраат хад сая сая жилийн туршид салхи, усанд элэгдэж бүтжээ.', 'The layered cliffs of Tsagaan Suvarga were carved by wind and water over millions of years.'),
      q: Q('Дундговьд байдаг өнгө алаг хадан хясааг юу гэдэг вэ?', 'What are Dundgovi’s colourful cliffs called?', ['Цагаан суварга', 'Хонгорын элс', 'Отгонтэнгэр'], ['Tsagaan Suvarga', 'Khongor dunes', 'Otgontenger'], 0) },
    umnugovi: { land: ['dunes', 'desert'], marks: [M('Хонгорын элс', 'Khongor sand dunes', 'Салхинд “дуулдаг” 100 км урт элсэн манхан.', 'Singing sand dunes about 100 km long.'), M('Ёлын ам', 'Yolyn Am', 'Зундаа ч мөс хайлдаггүй гүн хавцал.', 'A deep gorge where ice survives into summer.'), M('Баянзаг', 'Bayanzag (Flaming Cliffs)', 'Үлэг гүрвэлийн олдвороор дэлхийд алдартай улаан хадан хясаа.', 'Red cliffs world-famous for dinosaur fossils.')],
      history: T('1923 онд Америкийн судлаач Рой Чапман Эндрюс Баянзагаас үлэг гүрвэлийн өндөг олж, дэлхийг гайхшруулжээ.', 'In 1923 the American explorer Roy Chapman Andrews found dinosaur eggs at Bayanzag and amazed the world.'),
      q: Q('Баянзагаас 1920-иод онд юу олдсон бэ?', 'What was found at Bayanzag in the 1920s?', ['Үлэг гүрвэлийн өндөг', 'Алтан титэм', 'Хөлөг онгоц'], ['Dinosaur eggs', 'A golden crown', 'A ship'], 0) },
    bayankhongor: { land: ['mountains', 'desert', 'lake'], marks: [M('Ихбогд уул', 'Ikh Bogd', 'Говийн Алтайн нурууны хамгийн өндөр уул.', 'The highest peak of the Gobi-Altai range.'), M('Орог нуур', 'Orog Lake', 'Говийн захын давстай нуур, олон шувуутай.', 'A salty lake on the Gobi’s edge with many birds.'), M('Цагаан агуй', 'Tsagaan Agui cave', 'Эртний хүмүүсийн ул мөр олдсон агуй.', 'A cave with traces of ancient people.')],
      history: T('Баянхонгор нутагт Хангай, говь, Алтай гурвуулаа бий. Цагаан агуйгаас чулуун зэвсгийн үеийн хүмүүсийн багаж олдсон.', 'Bayankhongor has the Khangai mountains, the Gobi and the Altai. Stone-age tools were found in Tsagaan Agui cave.'),
      q: Q('Говийн Алтайн хамгийн өндөр Ихбогд уул аль аймагт байдаг вэ?', 'Which province has Ikh Bogd, the Gobi-Altai’s highest peak?', ['Баянхонгор', 'Сэлэнгэ', 'Дорнод'], ['Bayankhongor', 'Selenge', 'Dornod'], 0) },
    uvurkhangai: { land: ['valley', 'river'], marks: [M('Хархорум', 'Karakorum', 'Их Монгол Улсын нийслэл байсан эртний хот.', 'The ancient capital of the Mongol Empire.'), M('Эрдэнэ Зуу хийд', 'Erdene Zuu Monastery', '1586 онд Абтай сайн хаан байгуулсан, 108 суврагатай хэрэмтэй хийд.', 'Founded in 1586 by Abtai Sain Khan, ringed by a wall with 108 stupas.'), M('Орхоны хүрхрээ', 'Orkhon Waterfall', 'Улаан цутгалан хэмээх 20 орчим метрийн хүрхрээ.', 'The Ulaan Tsutgalan waterfall, about 20 metres high.')],
      history: T('Чингис хаан 1220 онд Хархорумыг нийслэл болгож, Өгөдэй хаан 1235 онд хэрэм бариулжээ. Орхоны хөндий ЮНЕСКО-гийн өвд бүртгэлтэй.', 'Chinggis Khaan made Karakorum his capital in 1220, and Ögedei Khaan built its walls in 1235. The Orkhon Valley is a UNESCO World Heritage site.'),
      q: Q('Эрдэнэ Зуу хийдийг хэн байгуулсан бэ?', 'Who founded Erdene Zuu Monastery?', ['Абтай сайн хаан', 'Хубилай хаан', 'Сүхбаатар'], ['Abtai Sain Khan', 'Khubilai Khaan', 'Sükhbaatar'], 0) },
    arkhangai: { land: ['volcano', 'lake', 'forest'], marks: [M('Хорго галт уулын тогоо', 'Khorgo volcano crater', 'Хорго уулын унтарсан галт уулын тогоо.', 'The crater of the extinct Khorgo volcano.'), M('Тэрхийн Цагаан нуур', 'Terkhiin Tsagaan Lake', 'Галт уулын лаавын далангаар тогтсон цэнгэг устай нуур.', 'A freshwater lake dammed by lava from the volcano.'), M('Тайхар чулуу', 'Taikhar Rock', 'Тал дундах асар том, домогтой хад.', 'A huge legendary rock in the middle of the plain.')],
      history: T('Архангайн Хөшөө Цайдамд VIII зууны Түрэгийн Билгэ хаан, Күлтегиний бичээст хөшөөнүүд бий.', 'At Khöshöö Tsaidam in Arkhangai stand the 8th-century inscribed monuments of the Turkic rulers Bilge Khagan and Kul Tigin.'),
      q: Q('Тэрхийн Цагаан нуурын дэргэдэх унтарсан галт уул аль вэ?', 'Which extinct volcano stands by Terkhiin Tsagaan Lake?', ['Хорго', 'Отгонтэнгэр', 'Ихбогд'], ['Khorgo', 'Otgontenger', 'Ikh Bogd'], 0) },
    bulgan: { land: ['forest', 'volcano', 'dunes'], marks: [M('Уран-Тогоо', 'Uran-Togoo', 'Унтарсан галт уулын тогоо.', 'An extinct volcano crater.'), M('Хөгнө хан уул', 'Khögnö Khan mountain', 'Хадан уул, ойролцоо нь Элсэн тасархай манхан бий.', 'A rocky mountain beside the Elsen Tasarkhai dunes.'), M('Өвгөн хийдийн туурь', 'Övgön Monastery ruins', 'Хөгнө хан ууланд байсан эртний хийд.', 'An old monastery on Khögnö Khan mountain.')],
      history: T('Хөгнө хан уулын Өвгөн хийдийг 1680-аад онд Галдан бошигтын цэрэг сүйтгэсэн гэдэг.', 'Övgön Monastery on Khögnö Khan is said to have been destroyed by Galdan Boshugtu’s army in the 1680s.'),
      q: Q('Уран-Тогоо гэж юу вэ?', 'What is Uran-Togoo?', ['Унтарсан галт уул', 'Далай', 'Хот'], ['An extinct volcano', 'A sea', 'A city'], 0) },
    orkhon: { land: ['city', 'mountains'], marks: [M('Эрдэнэт хот', 'Erdenet city', 'Монголын томоохон хотуудын нэг.', 'One of Mongolia’s big cities.'), M('Эрдэнэтийн уурхай', 'Erdenet mine', 'Монголын хамгийн том зэс, молибдены уурхайн нэг.', 'One of Mongolia’s largest copper and molybdenum mines.'), M('Орхон гол', 'Orkhon River', 'Монголын хамгийн урт голуудын нэг.', 'One of Mongolia’s longest rivers.')],
      history: T('Эрдэнэт хот 1970-аад онд зэсийн уурхайн хамт баригдсан. “Эрдэнэт” нь “эрдэнэ баялагтай” гэсэн утгатай.', 'Erdenet was built in the 1970s together with the copper mine. Its name means “full of treasures”.'),
      q: Q('Эрдэнэт юугаараа алдартай вэ?', 'What is Erdenet famous for?', ['Зэсийн уурхай', 'Элсэн манхан', 'Мөсөн гол'], ['Its copper mine', 'Sand dunes', 'A glacier'], 0) },
    darkhanuul: { land: ['city', 'river'], marks: [M('Дархан хот', 'Darkhan city', 'Монголын томоохон үйлдвэрийн хот.', 'A big industrial city.'), M('Төмөрлөгийн үйлдвэр', 'Darkhan steel plant', 'Монголд ган төмөр хайлуулдаг томоохон үйлдвэр.', 'A big plant where Mongolia makes steel.'), M('Сэлэнгийн хөндий', 'Selenge valley', 'Тариалан эрхэлдэг үржил шимтэй хөндий.', 'A fertile valley full of farms.')],
      history: T('Дархан хот 1961 онд байгуулагдсан. “Дархан” гэдэг нь “гар урлаач” гэсэн утгатай.', 'Darkhan was founded in 1961. “Darkhan” means “craftsman”.'),
      q: Q('Дархан хот хэдэн онд байгуулагдсан бэ?', 'When was Darkhan founded?', ['1961', '1639', '2000'], ['1961', '1639', '2000'], 0) },
    selenge: { land: ['river', 'fields', 'forest'], marks: [M('Амарбаясгалант хийд', 'Amarbayasgalant Monastery', 'XVIII зуунд Занабазарыг дурсан барьсан гоё хийд.', 'A beautiful 18th-century monastery built in honour of Zanabazar.'), M('Сэлэнгэ мөрөн', 'Selenge River', 'Байгал нуурт цутгадаг Монголын хамгийн усархаг гол.', 'Mongolia’s most water-rich river, flowing into Lake Baikal.'), M('Алтанбулаг', 'Altanbulag', 'Хойд хилийн түүхэн хот.', 'A historic town on the northern border.')],
      history: T('1921 онд ардын журамт цэрэг Алтанбулагт байлдаж, Ардын хувьсгалын эхлэл тавигдсан. Сэлэнгэ бол Монголын үр тарианы гол бүс.', 'In 1921 the people’s army fought at Altanbulag, beginning the People’s Revolution. Selenge is Mongolia’s main grain region.'),
      q: Q('Сэлэнгэ мөрөн аль нуурт цутгадаг вэ?', 'Which lake does the Selenge River flow into?', ['Байгал', 'Хөвсгөл', 'Увс'], ['Baikal', 'Khövsgöl', 'Uvs'], 0) },
    khuvsgul: { land: ['lake', 'forest', 'mountains'], marks: [M('Хөвсгөл нуур', 'Lake Khövsgöl', 'Монголын хамгийн гүн, тунгалаг цэнгэг устай нуур. “Далай ээж” гэж хайрлан нэрлэдэг.', 'Mongolia’s deepest, clearest freshwater lake, lovingly called “Mother Sea”.'), M('Цаатны урц', 'Tsaatan camp', 'Цаа буга маллагчдын тайга дахь гэр.', 'The taiga home of the reindeer herders.'), M('Үүшигийн өвөр', 'Uushigiin Övör', 'Хүрэл зэвсгийн үеийн буган хөшөөнүүд.', 'Bronze-age deer stones.')],
      history: T('Үүшигийн өвөрт 3000 орчим жилийн өмнө босгосон буган хөшөөнүүд бий. Хөвсгөлийн мөсөн баяр өвлийн төгсгөлд болдог.', 'Uushigiin Övör has deer stones raised about 3,000 years ago. The Khövsgöl Ice Festival takes place at the end of winter.'),
      q: Q('Монголчууд Хөвсгөл нуурыг хайрлан юу гэж нэрлэдэг вэ?', 'What do Mongolians lovingly call Lake Khövsgöl?', ['Далай ээж', 'Улаан нуур', 'Элсэн далай'], ['Mother Sea', 'Red Lake', 'Sea of Sand'], 0) },
    zavkhan: { land: ['snow', 'dunes'], marks: [M('Отгонтэнгэр', 'Otgontenger', 'Хангайн нурууны хамгийн өндөр, төрийн тахилгат уул.', 'The highest peak of the Khangai and a state-worshipped mountain.'), M('Монгол элс', 'Mongol Els dunes', 'Нуурын дэргэдэх элсэн манхан.', 'Sand dunes beside lakes.'), M('Улиастай', 'Uliastai', 'Түүхэн цайзын туурьтай хот.', 'A town with historic fortress ruins.')],
      history: T('Манжийн үед Улиастай баруун Монголыг захирах жанжны сууц байжээ. Отгонтэнгэрийг төр тахидаг.', 'Under the Manchus, Uliastai was the seat of the governor of western Mongolia. Otgontenger is worshipped by the state.'),
      q: Q('Отгонтэнгэр юу вэ?', 'What is Otgontenger?', ['Тахилгат уул', 'Нуур', 'Хийд'], ['A sacred mountain', 'A lake', 'A monastery'], 0) },
    govialtai: { land: ['desert', 'mountains'], marks: [M('Их говийн дархан цаазат газар', 'Great Gobi reserve', 'Мазаалай, хавтгай тэмээ амьдардаг хамгаалалттай газар.', 'A protected area home to the Gobi bear and the wild camel.'), M('Эж хайрхан', 'Ej Khairkhan', 'Говийн хадан уул.', 'A rocky Gobi mountain.'), M('Алтай хот', 'Altai town', 'Аймгийн төв.', 'The province centre.')],
      history: T('Хавтгай буюу зэрлэг тэмээ, мазаалай баавгай дэлхийд маш цөөхөн үлдсэн бөгөөд Их говьд хамгаалагдаж байна.', 'Very few wild camels (khavtgai) and Gobi bears (mazaalai) remain in the world; they are protected in the Great Gobi.'),
      q: Q('Хавтгай гэж ямар амьтан бэ?', 'What is a khavtgai?', ['Зэрлэг тэмээ', 'Загас', 'Шувуу'], ['A wild camel', 'A fish', 'A bird'], 0) },
    khovd: { land: ['lake', 'mountains', 'desert'], marks: [M('Хар ус нуур', 'Khar Us Lake', 'Олон шувуутай цэнгэг устай том нуур.', 'A large freshwater lake full of birds.'), M('Цэнхэрийн агуй', 'Tsenkheriin Agui cave', 'Эртний хүмүүсийн зурсан хадны зурагтай агуй.', 'A cave with paintings by ancient people.'), M('Сангийн хэрэм', 'Sangiin Kherem', 'Манжийн үеийн цайзын туурь.', 'Ruins of a Manchu-era fortress.')],
      history: T('Ховдод 10 гаруй ястан амьдардаг. Цэнхэрийн агуйн хадны зураг маш эртний.', 'More than ten ethnic groups live in Khovd. The rock paintings in Tsenkheriin Agui are very ancient.'),
      q: Q('Цэнхэрийн агуйгаас юу олдсон бэ?', 'What was found in Tsenkheriin Agui?', ['Эртний хадны зураг', 'Алтан зоос', 'Хөлөг онгоц'], ['Ancient cave paintings', 'Gold coins', 'A ship'], 0) },
    bayanolgii: { land: ['snow', 'mountains'], marks: [M('Таван богд', 'Tavan Bogd', 'Монголын хамгийн өндөр Хүйтэн оргил (4374 м) бүхий мөсөн уулс.', 'Glacier mountains with Khüiten, Mongolia’s highest peak (4,374 m).'), M('Алтайн хадны зураг', 'Altai rock art', 'Олон мянган жилийн настай хадны сүг зураг, ЮНЕСКО-д бүртгэлтэй.', 'Rock carvings thousands of years old, on the UNESCO list.'), M('Бүргэдийн баяр', 'Golden Eagle Festival', 'Намар болдог бүргэдчдийн уралдаан.', 'An autumn contest of eagle hunters.')],
      history: T('Казахууд XIX зуунд Монгол Алтайд нүүж ирсэн. Бүргэдээр ан хийх уламжлалаа өнөөг хүртэл хадгалсаар байна.', 'Kazakhs moved into the Mongolian Altai in the 19th century and keep their eagle-hunting tradition to this day.'),
      q: Q('Монголын хамгийн өндөр оргил аль вэ?', 'What is Mongolia’s highest peak?', ['Хүйтэн оргил', 'Богд хан уул', 'Шилийн богд'], ['Khüiten Peak', 'Bogd Khan Mountain', 'Shiliin Bogd'], 0) },
    uvs: { land: ['lake', 'dunes', 'mountains'], marks: [M('Увс нуур', 'Uvs Lake', 'Талбайгаараа Монголын хамгийн том, давстай нуур.', 'Mongolia’s largest lake by area, and salty.'), M('Хяргас нуур', 'Khyargas Lake', 'Олон шувуутай давстай нуур.', 'A salty lake with many birds.'), M('Хархираа, Түргэний нуруу', 'Kharkhiraa and Türgen mountains', 'Мөнх цастай өндөр уулс.', 'High mountains with year-round snow.')],
      history: T('Увс нуурын хотгор ЮНЕСКО-гийн дэлхийн өвд бүртгэлтэй. Дөрвөд, Баяд, Хотон ястнууд амьдардаг.', 'The Uvs Lake basin is a UNESCO World Heritage site. Dörvöd, Bayad and Khoton people live here.'),
      q: Q('Увс нуур юугаараа онцлогтой вэ?', 'What is special about Uvs Lake?', ['Талбайгаараа хамгийн том', 'Хамгийн гүн', 'Хамгийн жижиг'], ['Largest by area', 'The deepest', 'The smallest'], 0) },
  };
  const ORDER = ['ub', 'tuv', 'khentii', 'dornod', 'sukhbaatar', 'dornogovi', 'govisumber', 'dundgovi', 'umnugovi', 'bayankhongor', 'uvurkhangai', 'arkhangai', 'bulgan', 'orkhon', 'darkhanuul', 'selenge', 'khuvsgul', 'zavkhan', 'govialtai', 'khovd', 'bayanolgii', 'uvs'];

  // ------------------------------------------------------------ pixel landscapes (each province is drawn from its real features)
  function drawLand(x, id, t, W = 120, H = 60) {
    const j = J[id] || J.tuv, has = (k) => j.land.includes(k), R = (a, b, w, hh, c) => { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(hh)); };
    const desert = has('desert') || has('dunes'), snow = has('snow');
    const sky = desert ? ['#f6c98a', '#fbe0b0'] : snow ? ['#9fc8ee', '#d6ebfb'] : ['#8fd0f5', '#c6e9fb'];
    R(0, 0, W, H * 0.35, sky[0]); R(0, H * 0.35, W, H * 0.3, sky[1]);
    R(W - 18, 6, 8, 8, desert ? '#fff1b0' : '#ffe27a');
    const gy = Math.round(H * 0.62), ground = desert ? '#e2b86e' : has('fields') ? '#c9b34a' : '#76b947';
    if (has('mountains') || snow || has('volcano') || has('hills')) for (let X = 0; X < W; X++) {
      const top = Math.round(gy - (snow ? 26 : has('hills') ? 9 : 18) * Math.abs(Math.sin(X / (snow ? 14 : 20) + 1)) - 4 * Math.sin(X / 7));
      R(X, top, 1, gy - top, desert ? '#b9875a' : '#6f97b8'); if (snow && gy - top > 12) R(X, top, 1, 4, '#ffffff');
    }
    if (has('volcano')) { for (let r = 0; r < 14; r++) R(30 - r * 1.6, gy - 14 + r, 8 + r * 3.2, 1, '#6a5a5a'); R(30, gy - 15, 8, 2, '#3a2e2e'); }
    if (has('rocks')) for (let i = 0; i < 4; i++) { R(14 + i * 26, gy - 10 - (i % 2) * 5, 10, 12 + (i % 2) * 5, '#d8c8b0'); R(14 + i * 26, gy - 6, 10, 2, '#c9845a'); }
    R(0, gy, W, H - gy, ground);
    if (has('dunes')) for (let X = 0; X < W; X++) { const top = Math.round(gy - 6 - 5 * Math.sin(X / 9 + t * 0.2)); R(X, top, 1, gy - top + 2, '#f0c878'); R(X, top, 1, 1, '#fbe0a0'); }
    if (has('lake')) { R(16, gy + 4, W - 40, 9, '#4aa6e2'); R(20, gy + 6, W - 52, 1, '#93d4f6'); R(30 + Math.round((t * 6) % 40), gy + 9, 4, 1, '#e6f7ff'); }
    if (has('river')) for (let X = 0; X < W; X++) R(X, gy + 10 + Math.round(2 * Math.sin(X / 8)), 1, 3, '#4aa6e2');
    if (has('forest') || has('valley')) for (let i = 0; i < 9; i++) { const fx = 4 + i * 13 + (i % 2) * 4, fy = gy - 2 + (i % 3); for (let r = 0; r < 8; r++) R(fx - r / 2, fy - 10 + r, r + 1, 1, '#2f6e40'); R(fx, fy - 2, 1, 3, '#5a3a22'); }
    if (has('fields')) for (let r = 0; r < 4; r++) R(0, gy + 3 + r * 4, W, 1, '#e8d36a');
    if (has('city')) { for (let i = 0; i < 9; i++) { const bh = 8 + ((i * 7) % 14); R(8 + i * 11, gy - bh, 9, bh, ['#c9c1ad', '#9fb0c8', '#e8dfc8'][i % 3]); for (let wy = gy - bh + 2; wy < gy - 2; wy += 3) R(10 + i * 11, wy, 1, 1, '#f7c646'); } }
    if (has('steppe') || has('valley') || has('fields')) { const gx = (t * 8) % (W + 20) - 10; R(gx, gy + 6, 3, 2, '#c98a4b'); R(gx + 6, gy + 8, 3, 2, '#c98a4b'); } // gazelles / horses running
    const g = TG.pixel.gerSprite('#3f76db', '#e14b3d'); x.drawImage(g, 0, 0, 48, 50, W - 30, gy - 10, 14, 15);
  }

  const pass = (p) => { p.passport = p.passport || { stamps: {} }; p.passport.stamps = p.passport.stamps || {}; return p.passport; };
  const nextId = (p) => ORDER.find((id) => !pass(p).stamps[id]) || null;
  const unlocked = (p, id) => !!pass(p).stamps[id] || id === nextId(p);

  /** Give the province's stamp (from the travel map's guide). */
  function stamp(id) {
    const p = S.active(); if (!p || pass(p).stamps[id]) return;
    pass(p).stamps[id] = Date.now(); S.save(); TG.sfx.win();
    if (TG.villageReward) TG.villageReward(25, 35);
    S.logActivity && S.logActivity({ kind: 'stamp', id }); TG.villageQuest && TG.villageQuest('stamp'); TG.achievements && TG.achievements.check();
  }
  function landCanvas(id, cls = 'pp-land', w = 120, hh = 60, animate = true) {
    const c = h('canvas', { class: cls, width: w, height: hh }), x = c.getContext('2d'), t0 = performance.now();
    const loop = () => { drawLand(x, id, (performance.now() - t0) / 1000, w, hh); if (animate && c.isConnected) requestAnimationFrame(loop); };
    loop(); if (animate) requestAnimationFrame(loop);
    return c;
  }

  /** Passport book: stamps in route order. */
  function screen({ shell }) {
    const p = S.active(), ps = pass(p), n = Object.keys(ps.stamps).length, nx = nextId(p);
    return shell([
      h('section', { class: 'pp-hero px-card' }, h('div', { class: 'pp-cover' }, '🇲🇳', h('b', null, L('Аймгийн паспорт', 'Aimag Passport')), h('small', null, p.name)),
        h('div', null, h('h1', null, `${n} / ${ORDER.length}`), h('p', null, L('Улаанбаатараас эхлээд Монголын 21 аймгаар аялаарай. Аймаг бүрийн байгаль, алдартай газрууд, түүхтэй танилцаад тамга авбал дараагийн аймаг нээгдэнэ.', 'Start in Ulaanbaatar and travel through all 21 provinces. Discover each one’s nature, landmarks and history, earn its stamp and the next one opens.')),
          nx ? h('button', { class: 'btn primary', onclick: () => TG.aimagPass.guard(nx, () => TG.go('aimag', { id: nx })) }, '🧭 ', L('Дараагийн аялал: ', 'Next trip: '), tx(TG.aimags.byId(nx).name)) : h('p', null, '🏆 ', L('Та Монголоор бүрэн аялсан!', 'You have travelled all of Mongolia!')))),
      h('div', { class: 'pp-grid' }, ORDER.map((id, i) => {
        const a = TG.aimags.byId(id), got = ps.stamps[id], open = unlocked(p, id), home = p.aimag === id, paid = !TG.aimagPass.locked(p, id);
        return h('button', { class: 'pp-slot' + (got ? ' got' : '') + (open && !got ? ' next' : '') + (open ? '' : ' locked') + (paid ? '' : ' pass'), disabled: !open, onclick: () => TG.aimagPass.guard(id, () => TG.go('aimag', { id })) },
          h('span', { class: 'pp-num' }, i + 1), got ? h('span', { class: 'pp-stamp' }, a.icon) : h('span', { class: 'pp-icon' }, a.icon),
          !paid && i === TG.aimagPass.FREE ? h('span', { class: 'pp-price' }, TG.aimagPass.price()) : null,
          h('b', null, tx(a.name)), got ? h('small', null, TG.fmtDate(got)) : open ? h('small', null, L('Аялах →', 'Visit →')) : null, home ? h('span', { class: 'pp-home' }, L('Миний нутаг', 'Home')) : null);
      })),
    ]);
  }

  /** One province: landscape, landmarks, history, then a question for the stamp. */
  function visit({ id, shell }) {
    const p = S.active(), a = TG.aimags.byId(id), j = J[id];
    if (!a || !j || !unlocked(p, id)) return screen({ shell });
    if (TG.aimagPass.locked(p, id)) { setTimeout(() => TG.aimagPass.show(id), 60); return screen({ shell }); } // past the free provinces: Bolormaa and the travel pass
    const got = pass(p).stamps[id], i = ORDER.indexOf(id);
    const eth = TG.ethnic ? TG.ethnic.ETHNIC.filter((e) => e.aimags[0] === id || (e.aimags.includes(id) && e.id !== 'khalkh')) : [];
    const seen = ((p.travel || {})[id] || []).length, stampedAt = pass(p).stamps[id];
    const quiz = h('div', { class: 'pp-quiz' },
      stampedAt ? h('div', { class: 'pp-stamped' }, h('span', { class: 'pp-stamp big' }, a.icon), h('b', null, L('Тамга авсан!', 'Stamped!')), h('small', null, TG.fmtDate(stampedAt))) : null,
      h('button', { class: 'btn primary big block', onclick: () => TG.travel.open(id) }, '🚌 ', stampedAt ? L('Дахин аялах', 'Travel there again') : L(`${a.name.mn} руу аялах`, `Travel to ${a.name.en}`)),
      TG.fp && TG.fp.supported() ? h('button', { class: 'btn big block pp-fp', onclick: () => TG.travel.open(id, { view: 'fp' }) }, '👁 ', L('Өөрийн нүдээр аялах (3D)', 'Travel in first person (3D)')) : null,
      h('small', { class: 'muted' }, stampedAt ? L(`${seen}/3 газраар аялсан.`, `Visited ${seen}/3 places.`) : L('Тэнд очиж 3 алдартай газраар аялаад, нутгийн хөтчөөс тамгаа аваарай.', 'Go there, visit the 3 famous places and get your stamp from the local guide.')));
    return shell([
      h('div', { class: 'pp-top' }, h('button', { class: 'icon-btn', 'aria-label': 'back', onclick: () => TG.go('passport') }, TG.icon('arrowLeft')), h('span', null, `${i + 1} / ${ORDER.length}`)),
      h('section', { class: 'pp-visit px-card' }, landCanvas(id, 'pp-land big', 160, 80),
        h('div', { class: 'pp-title' }, h('span', { class: 'pp-icon' }, a.icon), h('div', null, h('h1', null, tx(a.name)), h('small', null, `${L('Төв', 'Centre')}: ${tx(a.center)}`, p.aimag === id ? ' · 📍 ' + L('Миний нутаг', 'My home province') : '')))),
      h('section', { class: 'card pp-go' }, quiz),
      h('section', { class: 'card' }, h('h3', null, '📍 ', L('Алдартай газрууд', 'Famous places')),
        j.marks.map((m) => h('div', { class: 'pp-mark' }, h('b', null, tx(m.name)), h('p', null, tx(m.desc))))),
      h('section', { class: 'card' }, h('h3', null, '📜 ', L('Түүх', 'History')), h('p', null, tx(j.history)), h('p', { class: 'muted' }, '💡 ', tx(a.fact)),
        eth.length ? h('p', null, '👥 ', L('Энд амьдардаг ястнууд: ', 'Peoples living here: '), eth.map((e) => tx(e.name)).join(', ')) : null),
      h('button', { class: 'btn block', onclick: () => TG.basar.open({ prompt: L(`${tx(a.name)} аймгийн тухай сонирхолтой зүйл хэлээч`, `Tell me something interesting about ${tx(a.name)} province`) }) }, '🐕 ', L('Басараас энэ аймгийн тухай асуух', 'Ask Basar about this province')),
    ]);
  }
  TG.passport = { J, ORDER, drawLand, landCanvas, screen, visit, nextId, stamp, stamps: (p) => Object.keys(pass(p).stamps).length };
})(window.TG);
