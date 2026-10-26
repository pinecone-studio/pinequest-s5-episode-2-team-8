/* Өв соёлын сургууль: hands-on heritage lessons. Each lesson = fun steps -> Basar's quiz -> a real-life family activity.
   Goal: a child can say "Mom, Dad, let's build a Mongolian ger together!" and actually know how. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store, SC = TG.scenes;
  const T = (mn, en) => ({ mn, en });
  const O = (mn, en, ok) => ({ t: T(mn, en), ok: !!ok });

  const LESSONS = [
    {
      id: 'ger', icon: '⛺', scene: 'ger', topic: 'ger', color: '#3f76db', final: { stage: 9 },
      title: T('Монгол гэр барих', 'Build a Mongol ger'),
      learned: [T('Гэрийн хэсгүүд: шал, хана, хаалга, тооно, багана, унь, эсгий, бүрээс, бүслүүр', 'The ger’s parts: floor, khana, door, toono, bagana, uni, felt, cover, ropes'), T('Барих дараалал ба хаалга урагшаа харах шалтгаан', 'The building order and why the door faces south'), T('Эсгий гэрийг дулаан байлгадаг', 'Felt keeps the ger warm')],
      desc: T('Хана, тооно, униа зөв дарааллаар босгоод өөрийн гэрээ бариарай.', 'Raise the walls, crown and poles in the right order and build your own ger.'),
      steps: [
        { type: 'learn', title: T('Нүүдэлчдийн ухаалаг байшин', 'The nomads’ clever home'), text: T('Монгол гэрийг гэр бүлээрээ 1–2 цагт барьж, буулгаж болдог. Өвөл дулаан, зун сэрүүн. Өнөөдөр чи өөрөө барина!', 'A family can put up or take down a ger in 1–2 hours. Warm in winter, cool in summer. Today you will build one!') },
        { type: 'pick', stage: 1, title: T('1. Эхлээд юу бэлдэх вэ?', '1. What comes first?'), text: T('Тэгш газар сонгоод…', 'Pick flat ground, then…'),
          options: [O('Шалаа тавина', 'Lay the floor', 1), O('Бүрээсээ хучна', 'Put on the cover'), O('Тоноо өргөнө', 'Lift the crown')], after: T('Зөв! Тэгш газар шалаа тавьснаар гэр тэгш, бат бөх болно.', 'Right! A level floor keeps the ger straight and strong.') },
        { type: 'tap', stage: 2, n: 5, label: T('Хана дэлгэх', 'Unfold a wall'), title: T('2. Ханаа дэлгэ!', '2. Unfold the walls!'), text: T('Хана бол эвхэгддэг тор. 5 удаа дарж 5 ханатай гэр болгоорой.', 'The khana is a folding lattice. Tap 5 times for a 5-khana ger.'), after: T('5 ханатай гэр гэр бүлд хамгийн түгээмэл хэмжээ.', 'A 5-khana ger is the most common family size.') },
        { type: 'pick', stage: 3, title: T('3. Хаалгыг аль зүг рүү харуулах вэ?', '3. Which way should the door face?'), text: T('Хана хоёрын дунд хаалгаа уяна.', 'Tie the door between two walls.'),
          options: [O('Урагш (өмнө)', 'South', 1), O('Хойш', 'North'), O('Баруун тийш', 'West')], after: T('Урагш харсан хаалгаар нар сайн тусаж, хойд зүгийн хүйтэн салхинаас хамгаалагдана.', 'A south-facing door gets the sun and is sheltered from cold northern winds.') },
        { type: 'pick', stage: 4, title: T('4. Гэрийн “нүд” болох дугуй цонх', '4. The ger’s round “eye”'), text: T('Үүнийг хоёр баганаар тулж өргөнө. Түүнийг юу гэдэг вэ?', 'It is lifted up on two posts. What is it called?'),
          options: [O('Тооно', 'Toono', 1), O('Унь', 'Uni'), O('Өрх', 'Örkh')], after: T('Тоонг хоёр хүн хамт өргөдөг. Гэр барих бол гэр бүлийн ажил!', 'Two people lift the toono together. Building a ger is family teamwork!') },
        { type: 'tap', stage: 5, n: 9, label: T('Унь хатгах', 'Place a pole'), title: T('5. Униа хатга!', '5. Place the roof poles!'), text: T('Униа тоононд хатгаад нөгөө үзүүрийг ханын толгойд уяна. Тэнцвэртэй байлгахын тулд дөрвөн зүгт ээлжлэн хатгадаг.', 'Push each uni into the toono and tie the other end to the wall. Place them on all four sides in turn to keep balance.'), after: T('Жинхэнэ 5 ханатай гэрт 80 орчим унь байдаг!', 'A real 5-khana ger has about 80 poles!') },
        { type: 'pick', stage: 6, title: T('6. Гэрийг дулаахан болгоё', '6. Make it warm'), text: T('Хана, униа юугаар бүрэх вэ?', 'What covers the walls and roof?'),
          options: [O('Ноосон эсгий', 'Wool felt', 1), O('Цаас', 'Paper'), O('Шил', 'Glass')], after: T('Хонины ноосоор хийсэн эсгий өвлийн хүйтэнд дулаан байлгадаг.', 'Felt made from sheep’s wool keeps out the winter cold.') },
        { type: 'pick', stage: 7, title: T('7. Борооноос хамгаалъя', '7. Keep the rain out'), text: T('Эсгийн гадуур юу хучих вэ?', 'What goes over the felt?'),
          options: [O('Цагаан бүрээс', 'The white cover', 1), O('Ширдэг', 'A felt mat'), O('Тулга', 'The stove stand')], after: T('Цагаан бүрээс бороо, нарнаас хамгаалж, гэрийг гоё харагдуулдаг.', 'The white cover protects from rain and sun and makes the ger shine.') },
        { type: 'tap', stage: 8, n: 3, label: T('Бүслүүр чангалах', 'Tighten a rope'), title: T('8. Бүслүүрээ чангал!', '8. Tighten the ropes!'), text: T('Гурван бүслүүрээр гэрээ бүсэлбэл хүчтэй салхинд ч хөдлөхгүй.', 'Three ropes around the ger keep it steady even in strong wind.') },
        { type: 'learn', stage: 9, title: T('Гэр бэлэн боллоо! 🎉', 'Your ger is ready! 🎉'), text: T('Тулгаа тавьж, анхны цайгаа чанана. Одоо Басарын асуултад хариулаад, дараа нь гэр бүлээрээ бяцхан гэр барьцгаая!', 'Set up the stove and make the first tea. Now answer Basar’s questions, then build a mini ger with your family!') },
      ],
      family: {
        say: T('“Ээж, аав аа, хамтдаа монгол гэр барьцгаая!”', '“Mom, Dad, let’s build a Mongol ger together!”'),
        what: T('Картон, цаасаар бяцхан гэр хийцгээе', 'Make a mini ger from card and paper'),
        materials: [T('Зузаан цаас эсвэл картон', 'Thick paper or card'), T('10 шүдний чигчлүүр эсвэл шорлог', '10 toothpicks or skewers'), T('Цагаан даавуу эсвэл салфетка', 'White cloth or a napkin'), T('Утас, цавуу, хайч (том хүнтэй)', 'String, glue, scissors (with a grown-up)')],
        steps: [T('Картоныг тойруулан тавьж хана хийгээд хаалгыг нь урагш харуулна.', 'Roll card into a circle for the walls; the door faces south.'), T('Цаасан цагираг хийж тооно болгоно.', 'Make a paper ring for the toono.'), T('Чигчлүүрүүдийг тооноос хана руу унь болгож наана.', 'Glue toothpicks from the toono to the walls as uni.'), T('Цагаан даавуугаар бүрээд, утсаар бүслүүр уяна.', 'Cover with cloth and tie string ropes around it.'), T('Гэрийнхэндээ гэрийн хэсгүүдийн нэрийг заагаарай!', 'Teach your family the names of every part!')],
      },
    },
    {
      id: 'idee', icon: '🥛', scene: 'idee', topic: 'idee', color: '#e9a91f', final: { stage: 7 },
      title: T('Цагаан идээ хийх', 'Make Mongolian dairy'),
      learned: [T('Цагаан идээ гэж юу вэ: тараг, өрөм, ааруул, бяслаг, айраг', 'What white foods are: yogurt, cream, aaruul, cheese, airag'), T('Тараг исгэх: буцалгах, бүлээн болтол хөргөх, хөрөнгө хийх', 'Making yogurt: boil, cool to lukewarm, add starter'), T('Ааруулыг шахаж, наранд хатаадаг', 'Aaruul is pressed and dried in the sun')],
      desc: T('Үнээ саагаад сүүгээ буцалгаж, өрөм, тараг, ааруул хийцгээе.', 'Milk the cow, boil the milk and make cream, yogurt and aaruul.'),
      steps: [
        { type: 'learn', stage: 0, title: T('Цагаан идээ гэж юу вэ?', 'What is “white food”?'), text: T('Монголчууд зун сүүгээр тараг, өрөм, ааруул, бяслаг, шар тос, айраг хийдэг. Үүнийг цагаан идээ гэнэ. Цагаан сараар ширээний тэргүүнд тавьдаг.', 'In summer Mongols make yogurt, cream, aaruul, cheese, butter and airag from milk. These are “white foods”, placed first on the Tsagaan Sar table.') },
        { type: 'drag', stage: 0, dir: 'down', alt: true, n: 8, icon: '✊', label: T('Доош нь татаж саа', 'Pull down to milk'), title: T('1. Үнээгээ саа!', '1. Milk the cow!'),
          text: T('Үхрийн дэлэнг атгаад доош нь тат. Хоёр гараараа ээлжлэн саана: зүүн, баруун, зүүн…', 'Hold a teat and pull it down. Use both hands in turn: left, right, left…'),
          altHint: T('Ээлжлэн саа! Одоо нөгөө талын дэлэнг тат.', 'Take turns! Now pull the other teat.'), low: T('Доош нь бүр татаарай!', 'Pull all the way down!'),
          after: T('Хувин дүүрлээ! Саахдаа үнээгээ зөөлөн илж, аялгуулан дуулж тайвшруулдаг.', 'The bucket is full! Herders stroke the cow and sing softly to keep her calm.') },
        { type: 'drag', dir: 'up', release: true, need: 0.8, n: 3, field: 'flick', set: { tsatsal: true }, icon: '🥄', label: T('Дээш цацах', 'Flick up'), title: T('Сүүний дээж өргө', 'Offer the first milk'),
          text: T('Шанагаар сүүний дээжийг авч тэнгэр өөд гурван удаа цацал өргө. Дээш нь шидэх шиг өргөөд тавиарай.', 'Scoop the first milk and flick it up to the sky three times. Swing up and let go.'), low: T('Илүү өндөр өргө!', 'Higher!'),
          after: T('Цацал өргөхдөө сайн сайхныг ерөөдөг. Тэнгэр, газар, нутагтаа хүндэтгэл үзүүлж байгаа хэрэг.', 'While offering, people wish for good things. It honours the sky, the land and home.') },
        { type: 'hold', stage: 1, set: { tsatsal: false }, lo: 0.82, hi: 0.97, label: T('Гал түлэх (дараад барина)', 'Heat (press and hold)'), title: T('2. Сүүгээ буцалга', '2. Bring the milk to a boil'), text: T('Товчийг дараад барь. Сүү буцлах үед (ногоон хэсэгт) тавиарай. Удаан барьвал сүү халина!', 'Press and hold. Let go when the milk boils (green zone). Hold too long and it boils over!'), after: T('Сайн байна! Халуун сүүг заавал том хүнтэй хамт буцалгаарай.', 'Well done! Always boil hot milk with a grown-up.') },
        { type: 'drag', stage: 2, dir: 'up', release: true, need: 0.8, n: 6, icon: '🥄', label: T('Шанагаа өргөөд тавь', 'Lift the ladle, let go'), title: T('3. Сүүгээ самра!', '3. Ladle the milk!'),
          text: T('Шанагаар сүүгээ утгаад өндөрт өргөж цутга. Өндрөөс цутгах тусам хөөс их гарч, өрөм зузаан тогтоно.', 'Scoop milk with the ladle, lift it high and pour. The higher you pour, the more foam and the thicker the cream.'),
          low: T('Арай намхан байна. Шанагаа өндөрт өргө!', 'Too low. Lift the ladle higher!'), after: T('Хонуулахад сүүний дээр өрөм тогтоно. Өрөмөөс шар тос хийдэг.', 'Overnight cream (öröm) forms on top. Butter is made from it.') },
        { type: 'timing', stage: 3, lo: 0.3, hi: 0.48, label: T('Одоо!', 'Now!'), title: T('4. Бүлээн болтол хөргө', '4. Cool it to lukewarm'), text: T('Сүү хөрч байна. Зүү ногоон “бүлээн” хэсэгт ирэхэд дар.', 'The milk is cooling. Tap when the needle reaches the green “lukewarm” zone.'), after: T('Хуруу тэвчихүйц бүлээн байх ёстой. Хэт халуунд тараг исэхгүй.', 'It should be finger-warm. Too hot and the yogurt won’t set.') },
        { type: 'pick', stage: 4, title: T('5. Тараг исгэхийн тулд юу нэмэх вэ?', '5. What do we add to make yogurt?'), text: T('Бүлээн сүүндээ…', 'Into the warm milk goes…'),
          options: [O('Хөрөнгө (бага зэрэг хуучин тараг)', 'Starter (a little old yogurt)', 1), O('Давс', 'Salt'), O('Чихэр', 'Sugar')], after: T('Хөрөнгөнд байгаа сайн бактери сүүг тараг болгодог.', 'Good bacteria in the starter turn milk into yogurt.') },
        { type: 'tap', stage: 5, n: 4, label: T('Дулаан боох', 'Wrap warm'), title: T('6. Дулаан боож хонуул', '6. Wrap it warm overnight'), text: T('Савыг дээл, хөнжлөөр боож дулаан газар хонуулна.', 'Wrap the pot in a deel or blanket and leave it somewhere warm overnight.'), after: T('Өглөө боллоо — тараг бэлэн! 🌞', 'Morning — the yogurt is ready! 🌞') },
        { type: 'drag', stage: 6, dir: 'down', n: 4, icon: '🪨', label: T('Чулуугаар дарах', 'Press with the stone'), title: T('7. Ааруул хийцгээе', '7. Let’s make aaruul'),
          text: T('Тарагаа халааж ээдэм гаргаад даавуунд хийнэ. Дээр нь хавтгай чулуу тавиад доош нь дарж усыг нь шахаж гаргана.', 'Heat the yogurt until curds form and put them in a cloth. Lay a flat stone on top and press down to squeeze out the water.'), low: T('Хүчтэй дар!', 'Press harder!') },
        { type: 'drag', dir: 'down', n: 3, field: 'mold', set: { molding: true }, icon: '👐', label: T('Хэвэнд дарах', 'Press into the mould'), title: T('Ааруулаа хэвэнд хийж дар', 'Press the aaruul into a mould'),
          text: T('Шахсан ээдмээ модон хэвэнд хийгээд гараараа доош нь дарж хэлбэржүүлнэ. Хэвний нүх бүрийг дүүргээрэй!', 'Put the pressed curd into a wooden mould and push it down with your hands. Fill every hole!'), low: T('Хүчтэй дар!', 'Press harder!'),
          after: T('Хэвний сийлсэн хээ ааруулан дээр тод гарна. Ааруулыг дөрвөлжин, дугуй, цэцэг хэлбэртэй хэвээр хийдэг.', 'The carved pattern shows on each piece. Aaruul moulds come in squares, circles and flower shapes.') },
        { type: 'pick', stage: 7, title: T('8. Ааруулаа хаана хатаах вэ?', '8. Where do we dry the aaruul?'), text: T('Хэрчсэн ааруулаа…', 'Cut the curd into pieces and…'),
          options: [O('Нар, салхинд', 'In the sun and wind', 1), O('Хөргөгчинд', 'In the fridge'), O('Усанд', 'In water')], after: T('Гэрийн дээвэр эсвэл тавиур дээр наранд хатаадаг. Хатуу, амттай ааруул бэлэн!', 'Dried on the ger roof or a rack in the sun. Crunchy aaruul is ready!') },
      ],
      family: {
        say: T('“Ээж, аав аа, хамтдаа тараг исгэцгээе!”', '“Mom, Dad, let’s make yogurt together!”'),
        what: T('Гэртээ жинхэнэ тараг исгэцгээе', 'Make real yogurt at home'),
        materials: [T('1 литр сүү', '1 litre of milk'), T('2 халбага тараг (хөрөнгө)', '2 spoons of yogurt (starter)'), T('Таглаатай сав', 'A pot with a lid'), T('Алчуур эсвэл хөнжил', 'A towel or blanket')],
        steps: [T('Том хүн сүүг буцалгана.', 'A grown-up boils the milk.'), T('Бүлээн болтол хөргөнө — хуруугаараа болгоомжтой шалгана.', 'Cool it until lukewarm — test carefully with a finger.'), T('Хөрөнгөө хийж сайн хутгана.', 'Stir in the starter.'), T('Таглаад дулаан боож 6–8 цаг байлгана.', 'Cover, wrap it warm and wait 6–8 hours.'), T('Хөргөгчинд хөргөөд гэр бүлээрээ амсаарай!', 'Chill it and taste it together!')],
      },
    },
    {
      id: 'customs', icon: '🙏', scene: 'inside', topic: 'customs', color: '#9466e0', final: {},
      title: T('Гэрийн ёс заншил', 'Ger manners'),
      learned: [T('Хоймор, гал голомт, эрэгтэй ба эмэгтэй тал хаана байдаг', 'Where the khoimor, hearth and men’s and women’s sides are'), T('Босго гишгэхгүй, нар зөв явах, баганын дундуур гарахгүй', 'Don’t step on the threshold, move sunwise, don’t pass between the posts'), T('Ахмадад хоёр гараараа юм өгөх', 'Hand things to elders with both hands')],
      desc: T('Хоймор хаана вэ? Босго гишгэж болох уу? Гэрийн дотоод “газрын зураг”-ийг сур.', 'Where is the khoimor? Can you step on the threshold? Learn the ger’s inside “map”.'),
      steps: [
        { type: 'learn', title: T('Гэр бүр дотроо газрын зурагтай', 'Every ger has a map inside'), text: T('Монгол гэрт хүн бүр, эд зүйл бүр өөрийн байртай. Дээрээс харахад хаалга доор (урд), хоймор дээр (хойд) байна.', 'In a ger every person and thing has its place. From above, the door is at the bottom (south) and the khoimor at the top (north).') },
        { type: 'tf', answer: false, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Гэрт орохдоо босго гишгэж болно.', 'You may step on the threshold when entering.'), after: T('Босго гишгэх нь ёс бус. Босгыг алхаж давдаг.', 'Stepping on the threshold is bad manners. Step over it.') },
        { type: 'zones', zone: 'khoimor', title: T('Хоймор хаана вэ?', 'Where is the khoimor?'), text: T('Ахмад настан, хүндтэй зочин суудаг хамгийн хүндэт газрыг дар.', 'Tap the place of honour where elders and honoured guests sit.'), after: T('Хоймор хаалганы эсрэг талд, хойд хэсэгт байдаг.', 'The khoimor is opposite the door, at the north.') },
        { type: 'zones', zone: 'hearth', title: T('Гал голомт хаана вэ?', 'Where is the hearth?'), text: T('Гэрийн зүрх болох галыг дар.', 'Tap the fire, the heart of the ger.'), after: T('Гал голомт гэрийн яг голд байдаг. Гал руу хөлөө чиглүүлж, хог хаядаггүй.', 'The hearth is in the very centre. Never point your feet at it or throw rubbish in it.') },
        { type: 'zones', zone: 'west', title: T('Эрэгтэй хүн, зочны тал', 'The men’s and guests’ side'), text: T('Уламжлалаар эмээл, хазаар байдаг, эрэгтэй хүн, зочин суудаг талыг дар.', 'Tap the side where saddles are kept and men and guests sit.'), after: T('Баруун тал буюу орохдоо зүүн гар тал. Эмээл, хазаар энд байна.', 'The west side — your left as you enter. Saddles and bridles are here.') },
        { type: 'zones', zone: 'east', title: T('Гал тогооны тал', 'The kitchen side'), text: T('Аяга таваг, тогоо байдаг талыг дар.', 'Tap the side with bowls and pots.'), after: T('Зүүн тал буюу орохдоо баруун гар тал. Гэрийн эзэгтэйн тал.', 'The east side — your right as you enter. The hostess’s side.') },
        { type: 'pick', title: T('Гэр дотор ямар чигээр явах вэ?', 'Which way do you walk inside?'), text: T('Нар явахтай адил…', 'Like the sun travels…'),
          options: [O('Нар зөв (цагийн зүүний дагуу)', 'Sunwise (clockwise)', 1), O('Нар буруу', 'Against the sun'), O('Голоор нь шууд', 'Straight through the middle')], after: T('Нар зөв эргэх нь сайн сайхныг бэлгэддэг.', 'Moving sunwise is a sign of good fortune.') },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Хоёр баганын дундуур гарч болохгүй.', 'You should not walk between the two posts.'), after: T('Зөв! Баганыг түшиж, дундуур нь гарахгүй.', 'Right! Don’t lean on the posts or walk between them.') },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Ахмад хүнд юм өгөхдөө баруун гараараа эсвэл хоёр гараараа өгнө.', 'Hand things to elders with your right hand or both hands.'), after: T('Энэ бол хүндэтгэлийн тэмдэг.', 'This is a sign of respect.') },
      ],
      family: {
        say: T('“Эмээ, өвөө өө, гэрийн ёс заншлаа надад заагаарай!”', '“Grandma, Grandpa, teach me our home customs!”'),
        what: T('Ахмадуудаасаа ёс заншил сурцгаая', 'Learn customs from your elders'),
        materials: [T('Эмээ, өвөө эсвэл ээж, аав', 'Grandma, Grandpa, Mom or Dad'), T('Naadamy-ийн Дурсамжийн ном', 'The Naadamy memory book')],
        steps: [T('Гэртээ хоймор хаана байгааг хамт олоорой.', 'Find where the khoimor is in your home.'), T('Ахмадад цайгаа хоёр гараараа өргөж дадлага хий.', 'Practise offering tea to an elder with both hands.'), T('Тэднээс өөр ямар ёс заншил мэддэгийг асуу.', 'Ask what other customs they know.'), T('Ярьсныг нь Дурсамжийн номонд бичиж, дуу хоолойг нь хадгал.', 'Save their words and voice in the memory book.')],
      },
    },
    {
      id: 'nuuts', icon: '📜', scene: 'story', topic: 'nuuts', color: '#c8483c', final: { ch: 'banner' },
      title: T('Нууц товчооны үлгэр', 'Tales of the Secret History'),
      learned: [T('Бөртэ чоно, Гуа марал: Нууц товчооны эхлэл', 'Börte Chino and Gua Maral: how the Secret History begins'), T('Алан гуагийн таван сумны эв нэгдлийн сургаал', 'Alan Gua’s five arrows lesson on unity'), T('Тэмүжиний бага нас ба 1206 онд Чингис хаан болсон нь', 'Temüjin’s childhood and becoming Chinggis Khaan in 1206')],
      desc: T('Бөртэ чоно, таван сумны сургаал, бяцхан Тэмүжин, Чингис хаан болсон түүх.', 'The blue wolf, the five arrows, young Temüjin and how he became Chinggis Khaan.'),
      steps: [
        { type: 'story', ch: 'wolf', title: T('Бөртэ чоно, Гуа марал', 'The blue wolf and the doe'), text: T('“Монголын нууц товчоо” ингэж эхэлдэг: Дээр тэнгэрээс заяат төрсөн Бөртэ чоно, гэргий Гуа марал хоёр далайг гэтэлж ирээд Онон голын эх, Бурхан халдун ууланд нутаглажээ.', 'The Secret History begins: Börte Chino, born with destiny from Heaven, and his wife Gua Maral crossed the waters and settled at the source of the Onon river, by Mount Burkhan Khaldun.') },
        { type: 'pick', ch: 'wolf', title: T('Асуулт', 'Question'), text: T('Нууц товчоонд гардаг монголчуудын домогт өвөг хэн бэ?', 'Who are the legendary ancestors in the Secret History?'),
          options: [O('Бөртэ чоно, Гуа марал', 'Börte Chino and Gua Maral', 1), O('Арслан, бар', 'A lion and a tiger'), O('Луу, гарьд', 'A dragon and a garuda')] },
        { type: 'story', ch: 'arrows', title: T('Таван сумны сургаал', 'The five arrows'), text: T('Алан гуа эх таван хүүдээ нэг нэг сум өгч “хугал” гэхэд тэд амархан хугалжээ. Дараа нь таван сумыг багцлан өгөхөд хэн ч хугалж чадсангүй. “Та нар салбал нэг сум шиг амархан хугарна. Эв нэгдэлтэй бол хэн ч дийлэхгүй” гэж сургажээ.', 'Mother Alan Gua gave each of her five sons an arrow to break, and they snapped easily. Then she bound five together and no one could break them. “Apart you break like one arrow. Together no one can defeat you.”'), broken: true },
        { type: 'pick', ch: 'arrows', title: T('Асуулт', 'Question'), text: T('Таван сумны сургаал юуны тухай вэ?', 'What is the five arrows lesson about?'),
          options: [O('Эв нэгдэл', 'Unity', 1), O('Хурдан гүйх', 'Running fast'), O('Баян болох', 'Getting rich')] },
        { type: 'story', ch: 'river', title: T('Бяцхан Тэмүжин', 'Young Temüjin'), text: T('Тэмүжин Онон голын Дэлүүн болдогт төржээ. Аавыг нь хорлон алсны дараа тэдний гэр бүл ганцаардсан ч Өэлүн эх хүүхдүүдээ Онон голын загас, зэрлэг жимс, ургамлын үндсээр хооллож, зоригтой өсгөжээ.', 'Temüjin was born at Delüün Boldog by the Onon river. After his father was poisoned the family was left alone, but mother Hö’elün raised her children bravely on fish, berries and wild roots.') },
        { type: 'pick', ch: 'river', title: T('Асуулт', 'Question'), text: T('Хэцүү үед Тэмүжиний гэр бүлийг хэн тэжээж өсгөсөн бэ?', 'Who fed and raised Temüjin’s family in the hard times?'),
          options: [O('Өэлүн эх', 'Mother Hö’elün', 1), O('Жамуха', 'Jamukha'), O('Тоорил хан', 'To’oril Khan')] },
        { type: 'story', ch: 'river', title: T('Найз нөхөд', 'True friends'), text: T('Залуу Тэмүжин Тайчуудын олзонд орсон ч Сорхон шарын гэр бүл түүнийг ноосон тэргэнд нууж аварчээ. Тэрээр анд Жамуха, үнэнч нөхөр Боорчи нартайгаа хүчээ нэгтгэжээ.', 'Young Temüjin was captured by the Tayichi’ud, but Sorkhan Shira’s family hid him in a cart of wool. He joined forces with his anda Jamukha and loyal friend Bo’orchu.') },
        { type: 'story', ch: 'banner', title: T('Чингис хаан', 'Chinggis Khaan'), text: T('1206 онд Онон голын эхэнд Их хурилдай хуралдаж, есөн хөлт цагаан туг мандуулан Тэмүжинийг Чингис хаан хэмээн өргөмжилж, Их Монгол Улсыг байгуулжээ.', 'In 1206 the Great Khuriltai met at the source of the Onon, raised the nine-footed white banner, proclaimed Temüjin Chinggis Khaan and founded the Great Mongol State.') },
        { type: 'pick', ch: 'banner', title: T('Асуулт', 'Question'), text: T('Тэмүжинийг Чингис хаан хэмээн өргөмжилсөн хурилдай хэдэн онд болсон бэ?', 'In which year was Temüjin proclaimed Chinggis Khaan?'),
          options: [O('1206', '1206', 1), O('1162', '1162'), O('1911', '1911')] },
        { type: 'learn', ch: 'banner', title: T('Нууц товчоо', 'The Secret History'), text: T('Ихэнх эрдэмтэд Нууц товчоог 1228 онд бичигдсэн гэж үздэг. 12 бүлэг, 282 зүйлтэй. Басараас илүү олон түүх асуугаарай!', 'Most scholars date the Secret History to 1228. It has 12 chapters and 282 sections. Ask Basar for more stories!') },
      ],
      family: {
        say: T('“Ээж, аав аа, таван сумны сургаалыг туршиж үзье!”', '“Mom, Dad, let’s try the five arrows lesson!”'),
        what: T('Эв нэгдлийн туршилт', 'The unity experiment'),
        materials: [T('5 нарийн хуурай мөчир эсвэл модон шорлог', '5 thin dry twigs or wooden skewers'), T('Утас', 'String')],
        steps: [T('Хүн бүр нэг мөчир хугалж үзнэ — амархан!', 'Everyone breaks one twig — easy!'), T('Таван мөчрийг утсаар багцлаад хугалж үзнэ — хэцүү!', 'Tie five together and try — hard!'), T('Гэр бүлд эв нэгдэл яагаад чухал вэ гэж ярилцаарай.', 'Talk about why unity matters in a family.'), T('Алан гуа эхийн түүхийг дүү, найздаа ярьж өгөөрэй.', 'Tell Alan Gua’s story to a sibling or friend.')],
      },
    },
    {
      id: 'herd', icon: '🐑', scene: 'herd', topic: 'nomad', color: '#2ea35f', final: { sub: 1 },
      title: T('Таван хошуу мал', 'The five herd animals'),
      learned: [T('Таван хошуу мал: морь, үхэр, тэмээ, хонь, ямаа', 'The five animals: horse, cattle, camel, sheep, goat'), T('Мал бүрийн өгдөг зүйл: айраг, ноос, ноолуур, сүү, хүч', 'What each gives: airag, wool, cashmere, milk, strength'), T('Малчид жилд 4 удаа нүүдэг', 'Herders move four times a year')],
      desc: T('Морь, үхэр, тэмээ, хонь, ямаа: мал бүр малчин айлд юу өгдөг вэ?', 'Horse, cattle, camel, sheep, goat: what does each give a herding family?'),
      steps: [
        { type: 'learn', set: { sub: 0.2 }, title: T('Малчдын баялаг', 'The herders’ wealth'), text: T('Монголчууд мянга мянган жил таван хошуу мал маллаж ирсэн. Мал бүр өөр өөр ашигтай.', 'For thousands of years Mongols have herded five kinds of animals. Each one is useful in its own way.') },
        { type: 'tap', n: 5, field: 'sub', label: T('Малаа тоолох', 'Count the herd'), title: T('Малаа тоол!', 'Count the herd!'), text: T('5 удаа дарж таван хошуу малаа цуглуулаарай.', 'Tap 5 times to gather all five animals.'), after: T('Морь, үхэр, тэмээ, хонь, ямаа: таван хошуу мал.', 'Horse, cattle, camel, sheep, goat: the five animals.') },
        { type: 'pick', title: T('Айраг', 'Airag'), text: T('Айргийг аль малын сүүгээр хийдэг вэ?', 'Airag is made from which animal’s milk?'), options: [O('Морь (гүү)', 'Horse (mare)', 1), O('Хонь', 'Sheep'), O('Тэмээ', 'Camel')], after: T('Гүүний сүүгээр айраг, тэмээний сүүгээр хоормог хийдэг.', 'Mare’s milk makes airag; camel’s milk makes khoormog.') },
        { type: 'pick', title: T('Эсгий', 'Felt'), text: T('Гэрийн эсгий хийх ноосыг голдуу аль малаас авдаг вэ?', 'The wool for ger felt mostly comes from which animal?'), options: [O('Хонь', 'Sheep', 1), O('Морь', 'Horse'), O('Үхэр', 'Cattle')], after: T('Хонины ноосыг дэвтээж, өнхрүүлж эсгий хийдэг.', 'Sheep’s wool is wetted and rolled into felt.') },
        { type: 'pick', title: T('Ноолуур', 'Cashmere'), text: T('Зөөлөн ноолуурыг аль малаас самнаж авдаг вэ?', 'Which animal gives soft cashmere?'), options: [O('Ямаа', 'Goat', 1), O('Тэмээ', 'Camel'), O('Хонь', 'Sheep')], after: T('Хавар ямааг самнаж ноолуур авдаг.', 'In spring goats are combed for cashmere.') },
        { type: 'pick', title: T('Говийн хөлөг', 'Ship of the Gobi'), text: T('Говьд хүнд ачаа зөөж, ус ундгүй удаан тэсдэг мал аль вэ?', 'Which animal carries heavy loads and goes long without water in the Gobi?'), options: [O('Тэмээ', 'Camel', 1), O('Хонь', 'Sheep'), O('Ямаа', 'Goat')], after: T('Хоёр бөхтэй монгол тэмээг “говийн хөлөг” гэдэг.', 'The two-humped Mongolian camel is called “the ship of the Gobi”.') },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Малчид жилд дөрвөн улирлын бууцанд нүүдэг.', 'Herders move between four seasonal camps a year.'), after: T('Хаваржаа, зуслан, намаржаа, өвөлжөө.', 'Spring, summer, autumn and winter camps.') },
        { type: 'learn', title: T('Морь бол далавч', 'The horse is our wings'), text: T('“Морь бол монгол хүний далавч” гэдэг. Монголд хүнээс олон адуу бий!', 'They say “the horse is a Mongol’s wings”. Mongolia has more horses than people!') },
      ],
      family: { say: T('“Өвөө, эмээ ээ, та нар ямар мал маллаж байсан бэ?”', '“Grandpa, Grandma, which animals did you herd?”'), what: T('Ахмадуудаасаа малын тухай асуух', 'Ask your elders about their animals'),
        materials: [T('Өвөө, эмээ эсвэл ахмад хамаатан', 'Grandparents or older relatives'), T('Цаас, өнгийн харандаа', 'Paper and coloured pencils')],
        steps: [T('Тэд бага байхдаа ямар мал маллаж байсныг асуу.', 'Ask which animals they herded as children.'), T('Хамгийн дуртай морь нь хэн гэдэг нэртэй байсныг асуу.', 'Ask the name of their favourite horse.'), T('Таван хошуу малаа хамтдаа зураарай.', 'Draw the five animals together.'), T('Түүхийг нь Дурсамжийн номонд бичээрэй.', 'Save their story in the memory book.')] },
    },
    {
      id: 'tsagaansar', icon: '🥟', scene: 'table', topic: 'customs', color: '#e14b3d', final: { buuz: 10, layers: 5 },
      title: T('Цагаан сар', 'Tsagaan Sar'),
      learned: [T('Битүүнээр гэрээ цэвэрлэж, гэр бүлээрээ цуглардаг', 'On Bituun, families clean the home and gather'), T('Ул боовыг сондгой давхраар өрдөг, бууз чимхдэг', 'Ul boov is stacked in odd layers; families make buuz'), T('Золгохдоо хадаг барьж, ахмадын тохойг доороос түшдэг', 'To greet elders, offer a khadag and support their elbows')],
      desc: T('Бууз чимхэж, ул боов өрж, ахмадуудтайгаа хэрхэн золгохыг сур.', 'Make buuz, stack ul boov and learn how to greet your elders.'),
      steps: [
        { type: 'learn', title: T('Сар шинийн баяр', 'Lunar New Year'), text: T('Цагаан сар бол монголчуудын шинэ жил. Өвлийг үдэж, хаврыг угтдаг. Битүүний орой гэр бүлээрээ цуглаж, шинийн нэгэнд ахмадуудтайгаа золгодог.', 'Tsagaan Sar is the Mongolian New Year, seeing off winter and welcoming spring. On the eve families gather, and on the first day they greet their elders.') },
        { type: 'tap', n: 10, field: 'buuz', scale: 10, label: T('Бууз чимхэх', 'Pinch a buuz'), title: T('Бууз чимхье!', 'Let’s make buuz!'), text: T('Гэр бүлээрээ олон мянган бууз чимхдэг айл ч бий. 10 удаа дараарай!', 'Some families make thousands of buuz together. Tap 10 times!'), after: T('Сайхан бууз боллоо! Битүүний өмнө бүгд хамтдаа чимхдэг.', 'Lovely buuz! Everyone makes them together before the holiday.') },
        { type: 'pick', title: T('Ул боов', 'Ul boov'), text: T('Ул боовыг ширээн дээр хэрхэн өрдөг вэ?', 'How is ul boov stacked on the table?'), options: [O('Сондгой давхраар (3, 5, 7)', 'In odd layers (3, 5, 7)', 1), O('Тэгш давхраар (2, 4, 6)', 'In even layers (2, 4, 6)'), O('Ганцхан ширхэг', 'Just one piece')], after: T('Сондгой тоо өсөлт, сайн сайхныг бэлгэддэг гэдэг.', 'Odd numbers are said to symbolise growth and good fortune.') },
        { type: 'tap', n: 5, field: 'layers', scale: 5, label: T('Давхарга өрөх', 'Add a layer'), title: T('Ул боовоо өрье', 'Stack the ul boov'), text: T('5 давхар ул боов өрөөд оройд нь цагаан идээ, чихэр тавина.', 'Stack 5 layers and put dairy foods and sweets on top.') },
        { type: 'pick', title: T('Битүүн', 'Bituun'), text: T('Битүүний орой юу хийдэг вэ?', 'What do families do on the eve, Bituun?'), options: [O('Гэрээ цэвэрлэж, гэр бүлээрээ цуглардаг', 'Clean the home and gather as a family', 1), O('Ганцаараа унтдаг', 'Sleep alone'), O('Дэлгүүр хэсдэг', 'Go shopping')], after: T('Хуучин жилийн бүх зүйлийг цэгцэлж, шинэ жилийг цэвэр угтдаг.', 'Everything is tidied so the new year starts fresh.') },
        { type: 'pick', title: T('Золголт', 'Greeting'), text: T('Золгохдоо ахмадад юу барьдаг вэ?', 'What do you offer an elder when greeting them?'), options: [O('Хадаг', 'A khadag scarf', 1), O('Ном', 'A book'), O('Бөмбөг', 'A ball')], after: T('Цэнхэр хадаг нь тэнгэр, хүндэтгэлийг бэлгэддэг.', 'The blue khadag symbolises the sky and respect.') },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Золгохдоо залуу хүн ахмадын тохойг доороос нь түшдэг.', 'When greeting, the younger person supports the elder’s elbows from below.'), after: T('Энэ нь ахмадаа түших, хүндлэхийн бэлгэдэл.', 'It shows that you support and respect your elder.') },
      ],
      family: { say: T('“Ээж, аав аа, хамтдаа бууз чимхэцгээе!”', '“Mom, Dad, let’s make buuz together!”'), what: T('Гэр бүлээрээ бууз чимхэж, золгох дадлага хийх', 'Make buuz together and practise the greeting'),
        materials: [T('Гурил, мах (том хүнтэй)', 'Flour and meat (with a grown-up)'), T('Хадаг', 'A khadag')],
        steps: [T('Том хүнтэй хамт гурилаа зуурч, махаа бэлдэнэ.', 'With a grown-up, make the dough and filling.'), T('Хүн бүр бууз чимхэж үзнэ.', 'Everyone tries pinching buuz.'), T('Хадаг барьж, ахмадын тохойг доороос түшиж золгох дадлага хийнэ.', 'Practise the greeting: offer the khadag and support the elder’s elbows.'), T('Ахмадаасаа хуучин Цагаан сарын дурсамжийг асуугаарай.', 'Ask your elders about Tsagaan Sar when they were young.')] },
    },
    {
      id: 'khuur', icon: '🎻', scene: 'khuur', topic: 'arts', color: '#7d57c4', final: { lit: 1 },
      title: T('Морин хуур ба уртын дуу', 'Morin khuur & long song'),
      learned: [T('Морин хуур хоёр утастай, морин толгойтой', 'The morin khuur has two strings and a horse head'), T('Хөөрхөн Намжилын домог', 'The legend of Khökhöö Namjil'), T('Уртын дуу, хөөмий, биелгээ, ёохор', 'Long song, khöömii, biyelgee and yokhor')],
      desc: T('Хөөрхөн Намжилын домог, морин хуур, уртын дуу, хөөмий, ардын бүжиг.', 'The legend of Khökhöö Namjil, the horsehead fiddle, long song, throat singing and folk dance.'),
      steps: [
        { type: 'story', title: T('Хөөрхөн Намжилын домог', 'The legend of Khökhöö Namjil'), text: T('Эрт урьд цагт Хөөрхөн Намжил гэдэг залуу жигүүртэй хурдан морьтой байжээ. Морь нь үхэхэд Намжил ихэд гунигласан бөгөөд хайртай морио дурсан, түүний толгойн дүрсээр анхны морин хуурыг урласан гэдэг.', 'Long ago a young man named Khökhöö Namjil had a swift, winged horse. When the horse died, Namjil grieved, and carved the first morin khuur in its memory, with a horse’s head.') },
        { type: 'pick', title: T('Асуулт', 'Question'), text: T('Морин хуурын толгой ямар дүрстэй вэ?', 'What shape is the head of the morin khuur?'), options: [O('Морь', 'A horse', 1), O('Луу', 'A dragon'), O('Арслан', 'A lion')] },
        { type: 'pick', title: T('Утас', 'Strings'), text: T('Морин хуур хэдэн утастай вэ?', 'How many strings does the morin khuur have?'), options: [O('2', '2', 1), O('4', '4'), O('6', '6')], after: T('Хоёр утсыг адууны сүүлний үсээр хийдэг уламжлалтай.', 'Traditionally the two strings are made of horsetail hair.') },
        { type: 'tap', n: 6, field: 'lit', scale: 1, tone: true, label: T('Нумаа татах', 'Draw the bow'), title: T('Хуураа хөгжимдье!', 'Let’s play!'), text: T('6 удаа нумаа татаж аялгуу тоглоорой.', 'Draw the bow 6 times to play a tune.'), after: T('Морин хуурын дууг “талын салхи”, “морины янцгаалах” дуутай зүйрлэдэг.', 'The fiddle’s sound is compared to the steppe wind and a horse’s neigh.') },
        { type: 'pick', title: T('Уртын дуу', 'Long song'), text: T('Уртын дууны онцлог юу вэ?', 'What is special about the long song?'), options: [O('Удаан, сунжирсан аялгуутай', 'Slow, long-stretched notes', 1), O('Маш хурдан', 'Very fast'), O('Үггүй', 'No words at all')] },
        { type: 'pick', title: T('Хөөмий', 'Khöömii'), text: T('Нэг хүн нэгэн зэрэг хоёр дуу авиа гаргадаг урлагийг юу гэдэг вэ?', 'What is the art of singing two sounds at once called?'), options: [O('Хөөмий', 'Khöömii', 1), O('Биелгээ', 'Biyelgee'), O('Ёохор', 'Yokhor')] },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Морин хуур, уртын дуу, хөөмий ЮНЕСКО-гийн биет бус өвд бүртгэлтэй.', 'The morin khuur, long song and khöömii are on UNESCO’s intangible heritage list.'), after: T('Монголын соёлын өв дэлхийд хүлээн зөвшөөрөгдсөн.', 'Mongolian heritage is recognised around the world.') },
        { type: 'learn', title: T('Ардын бүжиг', 'Folk dance'), text: T('Баруун Монголын биелгээг голдуу дээд биеэрээ бүжиглэдэг тул гэрийн бага зайд ч болдог. Буриадын ёохорыг гар гараасаа барьж тойрон бүжиглэдэг.', 'Western Mongolia’s biyelgee uses mostly the upper body, so it fits inside a ger. The Buryat yokhor is danced holding hands in a circle.') },
      ],
      family: { say: T('“Ээж, аав аа, хамтдаа уртын дуу сонсъё!”', '“Mom, Dad, let’s listen to a long song together!”'), what: T('Гэр бүлээрээ монгол хөгжим сонсох, бүжиглэх', 'Listen to Mongolian music and dance together'),
        materials: [T('Утас эсвэл радио', 'A phone or radio'), T('Гэр бүлийн гишүүд', 'Your family')],
        steps: [T('Морин хуурын аялгуу, уртын дуу хамтдаа сонсоорой.', 'Listen to morin khuur music and a long song together.'), T('Өвөө, эмээгээсээ мэддэг дууг нь заалгаарай.', 'Ask your grandparents to teach you a song they know.'), T('Гар гараасаа барьж ёохор шиг тойрон бүжиглээрэй.', 'Hold hands and dance in a circle like the yokhor.')] },
    },
    {
      id: 'shagai', icon: '🦴', scene: 'shagai', topic: 'naadam', color: '#c98a4b', final: { sides: ['horse', 'camel', 'sheep', 'goat'] },
      title: T('Шагай наадам', 'Shagai games'),
      learned: [T('Шагай 4 талтай: морь, тэмээ, хонь, ямаа', 'A shagai has 4 sides: horse, camel, sheep, goat'), T('Шагайгаар морь уралдуулах тоглоом', 'The shagai horse-race game'), T('Шагай харваа 2014 онд ЮНЕСКО-д бүртгэгдсэн', 'Knucklebone shooting was listed by UNESCO in 2014')],
      desc: T('Шагай хаяж, морь уралдуулж, урт өвлийн оройн тоглоомуудыг сур.', 'Roll knucklebones, race horses and learn the games of long winter evenings.'),
      steps: [
        { type: 'learn', set: { sides: [] }, title: T('Шагай гэж юу вэ?', 'What is shagai?'), text: T('Шагай бол хонины шагай. Хаяхад морь, тэмээ, хонь, ямаа гэсэн 4 талын нэгээр нь буудаг.', 'Shagai are sheep anklebones. When thrown, each lands on one of 4 sides: horse, camel, sheep or goat.') },
        { type: 'tap', n: 4, roll: true, label: T('Шагай хаях', 'Throw a shagai'), title: T('Шагайгаа хая!', 'Throw the bones!'), text: T('4 удаа дарж дөрвөн шагайгаа хаяарай.', 'Tap 4 times to throw four shagai.'), after: T('Аль талаар нь буусныг харж тоолоорой!', 'See which side each one landed on!') },
        { type: 'pick', title: T('Асуулт', 'Question'), text: T('Шагай хэдэн талтай вэ?', 'How many sides does a shagai have?'), options: [O('4', '4', 1), O('2', '2'), O('6', '6')] },
        { type: 'pick', title: T('Морь уралдуулах', 'Horse race game'), text: T('“Морь уралдуулах” тоглоомд ямар тал буувал морио урагшлуулдаг вэ?', 'In the horse-race game, which side moves your horse forward?'), options: [O('Морь', 'Horse', 1), O('Ямаа', 'Goat'), O('Тэмээ', 'Camel')], after: T('Хэдэн морь буусан тоогоор шагайн морио урагшлуулна.', 'You move your shagai horse forward by the number of horse sides rolled.') },
        { type: 'pick', title: T('Шагай харваа', 'Knucklebone shooting'), text: T('Шагай харвааг хэрхэн тоглодог вэ?', 'How is knucklebone shooting played?'), options: [O('Шагайн сумыг няслан шагайн бай онох', 'Flick a small piece to hit a target of shagai', 1), O('Шагайг усанд шидэх', 'Throw shagai into water'), O('Шагайг өнхрүүлж гүйх', 'Roll shagai and run')] },
        { type: 'tf', answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Шагай харваа ЮНЕСКО-гийн биет бус өвд бүртгэлтэй.', 'Knucklebone shooting is on UNESCO’s intangible heritage list.'), after: T('2014 онд бүртгэгдсэн.', 'It was listed in 2014.') },
        { type: 'learn', title: T('Өвлийн оройн тоглоом', 'Winter evening games'), text: T('Урт өвлийн оройгоор гэр бүлээрээ шагай тоглож, тоо тоолж, хурдан сэтгэж сурдаг.', 'On long winter evenings families play shagai, learning to count and think fast.') },
      ],
      family: { say: T('“Ээж, аав аа, шагайгаар морь уралдуулъя!”', '“Mom, Dad, let’s race shagai horses!”'), what: T('Гэр бүлээрээ шагай тоглох', 'Play shagai as a family'),
        materials: [T('4 шагай (эсвэл 4 талыг зурсан цаасан шоо)', '4 shagai (or paper cubes with the 4 sides drawn)'), T('Морь болгох жижиг юм (товч, чулуу)', 'Small tokens as horses (buttons, pebbles)')],
        steps: [T('Хүн бүр нэг “морь” сонгоно.', 'Everyone picks a “horse” token.'), T('Ээлжлэн 4 шагай хаяна.', 'Take turns throwing the 4 shagai.'), T('Хэдэн морь буусан тоогоор морио урагшлуулна.', 'Move forward by the number of horse sides.'), T('Барианд хамгийн түрүүнд хүрсэн нь ялна!', 'First to the finish wins!')] },
    },
    {
      id: 'naadam', icon: '🏆', scene: 'naadam', topic: 'naadam', color: '#e9a91f', final: {},
      title: T('Эрийн гурван наадам', 'The three manly games'),
      learned: [T('Наадам: бөх, морь уралдаан, сур харваа', 'Naadam: wrestling, horse racing, archery'), T('Ялсан бөх гарьдын бүжиг хийдэг', 'Winning wrestlers do the eagle dance'), T('Түрүү морийг айргаар цацаж, харвааны шүүгчид “уухай” гэдэг', 'The winning horse is blessed with airag; archery judges sing “uukhai”')],
      desc: T('Бөх, морь уралдаан, сур харвааны ёс заншил, сонирхолтой баримтууд.', 'The customs and fun facts of wrestling, horse racing and archery.'),
      steps: [
        { type: 'learn', set: { focus: null }, title: T('Улсын баяр наадам', 'The national Naadam'), text: T('Жил бүр 7-р сарын 11–13-нд эрийн гурван наадам болдог: бөх, морь уралдаан, сур харваа.', 'Every year on July 11–13 the three manly games take place: wrestling, horse racing and archery.') },
        { type: 'pick', set: { focus: 'bokh' }, title: T('Бөх', 'Wrestling'), text: T('Монгол бөх юу өмсдөг вэ?', 'What do Mongolian wrestlers wear?'), options: [O('Зодог, шуудаг, гутал', 'Zodog, shuudag and gutal boots', 1), O('Цамц, өмд', 'A shirt and trousers'), O('Дээл, малгай', 'A deel and hat')] },
        { type: 'pick', set: { focus: 'bokh' }, title: T('Бөх', 'Wrestling'), text: T('Ялсан бөх ямар бүжиг хийдэг вэ?', 'What dance does the winner do?'), options: [O('Гарьдын (шонхорын) бүжиг', 'The eagle dance', 1), O('Ёохор', 'Yokhor'), O('Вальс', 'Waltz')] },
        { type: 'pick', set: { focus: 'horse' }, title: T('Морь уралдаан', 'Horse racing'), text: T('Наадмын морь уралдаанд хэн унадаг вэ?', 'Who rides in Naadam horse races?'), options: [O('Хүүхэд унаачид', 'Child jockeys', 1), O('Өвөө нар', 'Grandfathers'), O('Бөхчүүд', 'Wrestlers')] },
        { type: 'pick', set: { focus: 'horse' }, title: T('Түрүү морь', 'The winning horse'), text: T('Түрүүлсэн морийг юугаар цацаж ерөөдөг вэ?', 'What is sprinkled on the winning horse as a blessing?'), options: [O('Айраг', 'Airag', 1), O('Ус', 'Water'), O('Элс', 'Sand')] },
        { type: 'pick', set: { focus: 'archer' }, title: T('Сур харваа', 'Archery'), text: T('Бай онох бүрт шүүгчид юу гэж дуулдаг вэ?', 'What do the judges sing at every hit?'), options: [O('Уухай!', 'Uukhai!', 1), O('Чү!', 'Chü!'), O('Баяртай!', 'Goodbye!')] },
        { type: 'tf', set: { focus: null }, answer: true, title: T('Зөв үү, буруу юу?', 'True or false?'), text: T('Наадам 2010 онд ЮНЕСКО-д бүртгэгдсэн.', 'Naadam was listed by UNESCO in 2010.'), after: T('Наадмыг дэлхий нийт хүндэлдэг.', 'Naadam is honoured around the world.') },
        { type: 'learn', title: T('Нутагт туршаад үз!', 'Try it in Nutag!'), text: T('Нутгийн Наадмын талбайд бөх барилдаж, морины уяанаас уралдаж, сурын талбайд харваарай!', 'Wrestle at the arena, race from the horse line and shoot at the archery range in Nutag!') },
      ],
      family: { say: T('“Ээж, аав аа, гэртээ жижиг наадам хийцгээе!”', '“Mom, Dad, let’s hold a little Naadam at home!”'), what: T('Гэр бүлийн жижиг наадам', 'A family mini-Naadam'),
        materials: [T('Олс эсвэл алчуур', 'A rope or towel'), T('Цаасан бай, зөөлөн бөмбөг', 'A paper target and a soft ball')],
        steps: [T('“Бөх”: олс таталтаар хүчээ үзнэ.', '“Wrestling”: a tug-of-war.'), T('“Морь”: гэрийн гадаа уралдаж гүйнэ.', '“Horse race”: a running race outside.'), T('“Сур”: зөөлөн бөмбөгөөр цаасан бай онооно.', '“Archery”: hit a paper target with a soft ball.'), T('Ялагч гарьдын бүжиг хийнэ, бусад нь “Уухай!” гэнэ.', 'The winner does the eagle dance; everyone else shouts “Uukhai!”')] },
    },
  ];

  const progress = (id) => { const p = S.active(); if (!p) return {}; p.learn = p.learn || {}; return (p.learn[id] = p.learn[id] || {}); };
  const done = (id) => !!progress(id).done;
  TG.learn = { LESSONS, progress, done, byId: (id) => LESSONS.find((l) => l.id === id) };
  const params_with = () => TG.learn.preset || null; // tests can preset { mode, players }

  /** Small animated scene canvas. Returns { el, st, stop }. */
  function sceneCanvas(kind, st, onClick) {
    const c = h('canvas', { class: 'l-scene', width: SC.W, height: SC.H });
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    let raf = 0; const t0 = performance.now();
    const loop = () => { if (!c.isConnected && raf) return; try { SC[kind](x, st, (performance.now() - t0) / 1000); } catch (e) { console.error(e); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    if (onClick) c.addEventListener('pointerdown', (e) => { const r = c.getBoundingClientRect(); onClick((e.clientX - r.left) / r.width * SC.W, (e.clientY - r.top) / r.height * SC.H); });
    return { el: c, st, stop: () => cancelAnimationFrame(raf) };
  }
  TG.learn.thumb = (l) => { const st = { sub: 1, ...l.final }; const c = h('canvas', { class: 'l-thumb', width: SC.W, height: SC.H }); const x = c.getContext('2d'); SC[l.scene](x, st, 2); return c; };

  /** Real-life family activity card (also shown on the screen-break reminder). */
  TG.learn.familyCard = (l, onDone) => {
    const f = l.family, pr = progress(l.id);
    const btn = h('button', { class: 'btn primary big block', disabled: !!pr.family, onclick: () => TG.parentGate(() => {
      pr.family = Date.now(); S.addFamilyStars(5); S.save();
      const r = TG.villageReward ? TG.villageReward(40, 40) : null; TG.villageQuest && TG.villageQuest('together');
      TG.sfx.win(); TG.confetti(90); TG.toast(L('Гайхалтай! Гэр бүлийн +5 од ⭐', 'Wonderful! +5 family stars ⭐') + (r ? ` · 🪙 +${r.coins}` : ''));
      btn.disabled = true; btn.textContent = L('✓ Хамтдаа хийсэн!', '✓ Done together!'); onDone && onDone();
    }) }, pr.family ? L('✓ Хамтдаа хийсэн!', '✓ Done together!') : L('Бид хамт хийлээ! (+5 ⭐)', 'We did it together! (+5 ⭐)'));
    return h('div', { class: 'l-family' },
      h('div', { class: 'l-fam-tag' }, '👨‍👩‍👧 ', L('Одоо бодит амьдрал дээр', 'Now in real life')),
      h('div', { class: 'l-say' }, tx(f.say)),
      h('h3', null, tx(f.what)),
      h('div', { class: 'l-cols' },
        h('div', null, h('b', null, L('Хэрэгтэй зүйлс', 'You need')), h('ul', null, f.materials.map((m) => h('li', null, tx(m))))),
        h('div', null, h('b', null, L('Алхмууд', 'Steps')), h('ol', null, f.steps.map((s) => h('li', null, tx(s)))))),
      h('p', { class: 'l-note' }, '🔒 ', L('Том хүн баталгаажуулна.', 'A grown-up confirms.')), btn);
  };

  // ------------------------------------------------------------ hub
  TG.learn.hub = ({ shell }) => {
    const p = S.active();
    const card = (l) => {
      const pr = progress(l.id);
      return h('button', { class: 'l-card px-card', style: { '--lc': l.color }, onclick: () => TG.go('lesson', { id: l.id }) },
        TG.learn.thumb(l),
        h('div', { class: 'l-card-body' },
          h('b', null, l.icon, ' ', tx(l.title)), h('span', null, tx(l.desc)),
          h('div', { class: 'l-tags' }, pr.done ? h('span', { class: 'tag ok' }, '✓ ', L('Сурсан', 'Learned')) : h('span', { class: 'tag' }, L('Шинэ', 'New')),
            pr.family ? h('span', { class: 'tag fam' }, '👨‍👩‍👧 ', L('Хамт хийсэн', 'Done together')) : null,
            l.id === 'ger' && !pr.done ? h('span', { class: 'tag key' }, '🔑 ', L('Нутагт гэр барих эрх нээнэ', 'Unlocks your own ger in Nutag')) : null)));
    };
    const st = p.basar || {};
    return shell([
      h('section', { class: 'l-hero px-card' }, TG.basar.face(0, 72),
        h('div', null, h('div', { class: 'eyebrow' }, L('Өв соёлын сургууль', 'Heritage school')), h('h1', null, L('Хамтдаа сурцгаая!', 'Let’s learn together!')),
          h('p', null, L('Тоглоод сур, сурснаа гэр бүлтэйгээ бодит амьдрал дээр хий.', 'Learn by playing, then do it for real with your family.')))),
      h('div', { class: 'hub-row' },
        h('button', { class: 'hub-card px-card', onclick: () => TG.go('bichig') }, TG.bichig.pixelGlyph('ᠮᠣᠩᠭᠣᠯ', 18, 40, 2, '#5a2d10'), h('b', null, L('Монгол бичиг', 'Mongol script')), h('small', null, `✍️ ${TG.bichig.done(p)}/${TG.bichig.ALL.length}`)),
        h('button', { class: 'hub-card px-card', onclick: () => TG.go('passport') }, h('span', null, '🛂'), h('b', null, L('Аймгийн паспорт', 'Aimag passport')), h('small', null, L(`${TG.passport.stamps(p)}/22 тамга`, `${TG.passport.stamps(p)}/22 stamps`))),
        h('button', { class: 'hub-card px-card', onclick: () => TG.seasons.open() }, h('span', null, TG.seasons.current().icon), h('b', null, tx(TG.seasons.current().name)), h('small', null, L('Улирлын тухай', 'About the season')))),
      h('div', { class: 'l-grid' }, LESSONS.map(card)),
      h('section', { class: 'px-card l-quizcard' },
        h('h2', null, '🎯 ', L('Басарын асуулт хариулт', 'Basar’s quiz')),
        h('p', { class: 'muted' }, L(`Зөв хариулт: ${st.right || 0} / ${st.total || 0}`, `Correct answers: ${st.right || 0} / ${st.total || 0}`)),
        h('p', { class: 'muted' }, L('Сэдвээ сонгоод ганцаараа, гэр бүл эсвэл найзуудтайгаа ээлжлэн тоглоорой.', 'Pick a topic and play alone, or take turns with family or friends.')),
        h('div', { class: 'chips' }, [['mix', '🎲', T('Холимог', 'Mixed')], ...Object.entries(TG.BASAR.TOPICS).map(([k, t]) => [k, t.icon, t.name])].map(([k, icon, name]) => h('button', { class: 'chip', onclick: () => TG.basar.quizParty(k) }, icon, ' ', tx(name)))),
        h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => TG.basar.open() }, '🐕 ', L('Басараас юу ч асуух', 'Ask Basar anything'))),
    ]);
  };

  // ------------------------------------------------------------ one lesson
  TG.learn.lesson = ({ id, shell, setCleanup }) => {
    const l = TG.learn.byId(id) || LESSONS[0], pr = progress(id);
    const st = { stage: 0, sub: 0 };
    let i = 0, timer = 0, players = [], mode = 'solo', turn = 0;
    const panel = h('div', { class: 'l-panel px-card' });
    const dots = h('div', { class: 'l-dots' });
    const scene = sceneCanvas(l.scene, st, (ax, ay) => onSceneTap && onSceneTap(ax, ay));
    let onSceneTap = null;
    const stopTimers = () => { cancelAnimationFrame(timer); timer = 0; };
    setCleanup && setCleanup(() => { scene.stop(); stopTimers(); });

    const nextBtn = (label) => h('button', { class: 'btn primary big block', onclick: () => { i++; show(); } }, label || L('Цааш →', 'Next →'));
    const drawDots = () => dots.replaceChildren(...l.steps.map((_, k) => h('i', { class: k < i ? 'on' : k === i ? 'cur' : '' })), h('i', { class: 'q' + (i >= l.steps.length ? ' cur' : '') }, '?'));
    const say = (txt) => h('div', { class: 'l-basar' }, TG.basar.face(1, 34), h('p', null, txt));
    const multi = () => players.length > 1;
    const turnEl = (s) => !multi() ? null : (s.type === 'learn' || s.type === 'story')
      ? h('div', { class: 'turn-badge read' }, h('span', { class: 'tb-e' }, '📢'), h('b', null, L(`${players[turn % players.length].name} чангаар уншиж өгөөрэй`, `${players[turn % players.length].name}, read this out loud`)))
      : TG.basar.turnBadge(players[turn % players.length]);
    const success = (step) => { TG.sfx.good(); if (step.stage !== undefined) { st.stage = step.stage; st.sub = 1; } return step.after ? say(tx(step.after)) : null; };

    function show() {
      stopTimers(); onSceneTap = null; drawDots();
      if (i >= l.steps.length) return quiz();
      const s = l.steps[i];
      if (s.ch) st.ch = s.ch; st.broken = !!s.broken;
      if (s.set) Object.assign(st, JSON.parse(JSON.stringify(s.set)));
      st.pull = 0; st.fx = 0;
      if (s.stage !== undefined && s.type !== 'pick' && s.type !== 'zones' && s.type !== 'tf') { st.stage = s.stage; st.sub = s.type === 'tap' || s.type === 'hold' || s.type === 'timing' || s.type === 'drag' ? 0 : 1; }
      else if (s.type === 'pick' && s.stage !== undefined) { st.stage = s.stage - 1; st.sub = 1; }
      pr.step = Math.max(pr.step || 0, i); S.save();
      const head = [turnEl(s), h('h2', null, tx(s.title)), h('p', null, tx(s.text))].filter(Boolean);
      turn++;
      const out = h('div', { class: 'l-out' });
      if (s.type === 'learn' || s.type === 'story') return panel.replaceChildren(...head, nextBtn());
      if (s.type === 'pick') {
        const opts = [...s.options].sort(() => Math.random() - 0.5);
        const btns = opts.map((o) => h('button', { class: 'l-opt', onclick: (e) => {
          if (o.ok) { btns.forEach((b) => (b.disabled = true)); e.currentTarget.classList.add('right'); out.replaceChildren(...[success(s), nextBtn()].filter(Boolean)); }
          else { e.currentTarget.classList.add('wrong'); e.currentTarget.disabled = true; TG.sfx.bad(); out.replaceChildren(say(L('Вуф! Дахиад бодоод үз 🙂', 'Woof! Think again 🙂'))); }
        } }, tx(o.t)));
        return panel.replaceChildren(...head, h('div', { class: 'l-opts' }, btns), out);
      }
      if (s.type === 'tf') {
        const pick = (v, el) => { if (v === s.answer) { [...el.parentNode.children].forEach((b) => (b.disabled = true)); el.classList.add('right'); out.replaceChildren(success(s), nextBtn()); } else { el.classList.add('wrong'); el.disabled = true; TG.sfx.bad(); out.replaceChildren(say(tx(s.after))); out.appendChild(nextBtn()); [...el.parentNode.children].forEach((b) => (b.disabled = true)); } };
        return panel.replaceChildren(...head, h('div', { class: 'l-tf' }, h('button', { class: 'l-opt', onclick: (e) => pick(true, e.currentTarget) }, '✓ ', L('Зөв', 'True')), h('button', { class: 'l-opt', onclick: (e) => pick(false, e.currentTarget) }, '✗ ', L('Буруу', 'False'))), out);
      }
      if (s.type === 'zones') {
        let solved = false;
        onSceneTap = (ax, ay) => {
          if (solved) return; const z = SC.zoneAt(ax, ay); if (!z) return;
          st.hl = z; st.hlBad = z !== s.zone;
          if (z === s.zone) { solved = true; out.replaceChildren(success(s), nextBtn()); }
          else { TG.sfx.bad(); out.replaceChildren(say(L('Тэнд биш. Дахиад оролдоорой!', 'Not there. Try again!'))); setTimeout(() => { if (!solved) st.hl = null; }, 700); }
        };
        st.hl = null;
        return panel.replaceChildren(...head, h('p', { class: 'l-hint' }, '👆 ', L('Дээрх зураг дээр дар', 'Tap the picture above')), out);
      }
      if (s.type === 'tap') {
        let n = 0;
        const btn = h('button', { class: 'btn primary big block l-tap', onclick: () => {
          if (n >= s.n) return; n++; st.sub = s.field && s.field !== 'sub' ? st.sub : n / s.n; if (s.field) st[s.field] = (n / s.n) * (s.scale || 1);
          if (s.roll) st.sides = [...(st.sides || []), TG.pick(['horse', 'camel', 'sheep', 'goat'])].slice(-4);
          s.tone ? (TG.sfx.chime && TG.sfx.chime()) : TG.sfx.tap(); TG.buzz && TG.buzz(10);
          btn.querySelector('small').textContent = `${n} / ${s.n}`;
          if (n >= s.n) { btn.disabled = true; out.replaceChildren(...[success(s), nextBtn()].filter(Boolean)); }
        } }, tx(s.label), h('small', null, `0 / ${s.n}`));
        return panel.replaceChildren(...head, btn, out);
      }
      if (s.type === 'drag') {
        // a hand gesture: pull the udder down, lift the ladle high and let go, press the stone
        const LEN = 80, ARROW = { down: '⬇', up: '⬆', side: '⬅ ➡' };
        let n = 0, g = null, lastSide = null;
        const knob = h('i', { class: 'l-drag-knob' }, s.icon || '✋'), count = h('small', null, `0 / ${s.n}`);
        const pad = h('div', { class: `l-drag ${s.dir}${s.alt ? ' alt' : ''}` }, h('span', { class: 'l-drag-arrow' }, ARROW[s.dir]), knob, h('b', null, tx(s.label)), count);
        const amount = (e) => { const dx = e.clientX - g.x, dy = e.clientY - g.y; return Math.max(0, Math.min(1, (s.dir === 'side' ? Math.abs(dx) : s.dir === 'down' ? dy : -dy) / LEN)); };
        const place = (a, e) => { knob.style.transform = s.dir === 'side' ? `translateX(${Math.max(-LEN, Math.min(LEN, e.clientX - g.x))}px)` : `translateY(${(s.dir === 'down' ? 1 : -1) * a * LEN}px)`; };
        const stroke = () => {
          if (s.alt && g.side === lastSide) { TG.sfx.bad(); out.replaceChildren(say(tx(s.altHint))); return; }
          lastSide = g.side; n++; st.fx = performance.now();
          if (s.field) st[s.field] = n / s.n; else st.sub = n / s.n;
          TG.sfx.pop ? TG.sfx.pop() : TG.sfx.tap(); TG.buzz && TG.buzz(12);
          count.textContent = `${n} / ${s.n}`; out.replaceChildren();
          if (n >= s.n) { pad.classList.add('done'); out.replaceChildren(...[success(s), nextBtn()].filter(Boolean)); }
        };
        pad.addEventListener('pointerdown', (e) => {
          if (n >= s.n) return; e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (_) {}
          const r = pad.getBoundingClientRect(); g = { x: e.clientX, y: e.clientY, side: e.clientX < r.left + r.width / 2 ? 'l' : 'r', done: false };
          st.side = g.side; if (s.alt) knob.style.left = g.side === 'l' ? '28%' : '72%';
        });
        pad.addEventListener('pointermove', (e) => { if (!g) return; const a = amount(e); st.pull = a; place(a, e); if (!s.release && a >= 1 && !g.done) { g.done = true; stroke(); } });
        const up = (e) => {
          if (!g) return; const a = amount(e);
          if (s.release ? a >= s.need : g.done) { if (s.release) stroke(); } else if (a > 0.15 && s.low) out.replaceChildren(say(tx(s.low)));
          g = null; st.pull = 0; knob.style.transform = '';
        };
        pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
        return panel.replaceChildren(...head, pad, out);
      }
      if (s.type === 'hold' || s.type === 'timing') {
        const fill = h('i'), zone = h('b', { style: { left: s.lo * 100 + '%', width: (s.hi - s.lo) * 100 + '%' } }), needle = h('em');
        const gauge = h('div', { class: 'l-gauge' + (s.type === 'timing' ? ' cool' : '') }, zone, fill, needle);
        let v = s.type === 'hold' ? 0.15 : 1, heating = false, ok = false, last = performance.now(), t0 = last;
        const set = () => { fill.style.width = v * 100 + '%'; needle.style.left = v * 100 + '%'; st.temp = v; st.heat = heating; };
        const tick = (now) => {
          const dt = Math.min(0.05, (now - last) / 1000); last = now;
          if (s.type === 'hold') { v += heating ? dt * 0.32 : -dt * 0.04; v = Math.max(0.1, v); if (v > 1.02) { heating = false; v = 0.3; st.over = true; TG.sfx.bad(); out.replaceChildren(say(L('Ой! Сүү халилаа. Дахиад болгоомжтой оролдоё.', 'Oops! It boiled over. Try again, carefully.'))); setTimeout(() => (st.over = false), 900); } }
          else v = 0.62 + 0.38 * Math.cos((now - t0) / 1000 * 1.5);
          set(); if (!ok) timer = requestAnimationFrame(tick);
        };
        const check = () => {
          if (ok) return;
          if (v >= s.lo && v <= s.hi) { ok = true; heating = false; set(); stopTimers(); out.replaceChildren(...[success(s), nextBtn()].filter(Boolean)); btn.disabled = true; }
          else if (s.type === 'timing' || v < s.lo) { if (s.type === 'timing') TG.sfx.bad(); out.replaceChildren(say(s.type === 'timing' ? L('Арай эрт эсвэл оройтлоо. Ногоон хэсгийг хүлээ!', 'A bit early or late. Wait for the green zone!') : L('Арай буцлаагүй байна. Дахиад дараад бариарай.', 'Not boiling yet. Press and hold again.'))); }
        };
        const btn = s.type === 'hold'
          ? h('button', { class: 'btn primary big block l-tap', onpointerdown: (e) => { e.preventDefault(); heating = true; }, onpointerup: () => { heating = false; check(); }, onpointerleave: () => { if (heating) { heating = false; check(); } }, oncontextmenu: (e) => e.preventDefault() }, '🔥 ', tx(s.label))
          : h('button', { class: 'btn primary big block l-tap', onclick: check }, tx(s.label));
        set(); timer = requestAnimationFrame(tick);
        return panel.replaceChildren(...head, gauge, btn, out);
      }
    }

    function quiz() {
      st.stage = l.final.stage !== undefined ? l.final.stage : st.stage; st.sub = 1; if (l.final.ch) st.ch = l.final.ch; st.hl = null;
      const host = h('div');
      panel.replaceChildren(h('h2', null, '🎯 ', L('Басарын шалгалт', 'Basar’s check')), h('p', { class: 'muted' }, L('3 асуултад хариулаарай.', 'Answer 3 questions.')), host);
      TG.basar.runQuiz(host, l.topic, multi() ? Math.max(3, players.length * 2) : 3, (right, n, tally) => finish(right, n, tally), players);
    }
    function finish(right, n, tally) {
      const first = !pr.done, boost = multi() ? 1.5 : 1;
      pr.done = true; pr.best = Math.max(pr.best || 0, multi() ? Math.max(...tally) : right); pr.with = pr.with || {}; pr.with[mode] = (pr.with[mode] || 0) + 1; S.save();
      let reward = null;
      if (first) { reward = TG.villageReward ? TG.villageReward(Math.round(50 * boost), Math.round(60 * boost)) : null; S.logActivity && S.logActivity({ kind: 'lesson', id: l.id }); }
      else if (multi()) reward = TG.villageReward ? TG.villageReward(20, 25) : null;
      TG.villageQuest && TG.villageQuest('lesson'); // every finished lesson counts for quests
      TG.basar.noteTogether(mode, players, l.id);
      TG.achievements && TG.achievements.check();
      TG.sfx.win(); TG.confetti(70);
      panel.replaceChildren(
        h('div', { class: 'l-done' }, h('div', { class: 'big-emoji' }, l.icon), h('h2', null, L('Хичээл дууслаа!', 'Lesson complete!')),
          h('p', null, L(`Басарын асуулт: ${right} / ${n} зөв`, `Basar’s quiz: ${right} / ${n} correct`)),
          multi() ? TG.basar.scoreboard(players, tally) : null,
          multi() ? h('p', { class: 'muted' }, mode === 'family' ? L('Гэр бүлээрээ сурсан тул +50% шагнал, гэр бүлийн +2 од! 💛', 'Learned with family: +50% reward and +2 family stars! 💛') : L('Найзуудтайгаа сурсан тул +50% шагнал! 🤝', 'Learned with friends: +50% reward! 🤝')) : null,
          reward ? h('div', { class: 'l-reward' }, `🪙 +${reward.coins}`, ' · ', `⭐ +${reward.xp} XP`) : null,
          l.id === 'ger' && first ? h('div', { class: 'l-unlock' }, '🔑 ', L('Нутагт өөрийн гэрээ барих эрх нээгдлээ! Гэр хорооллын хоосон газар очоорой.', 'You can now build your own ger in Nutag! Visit an empty lot in the ger neighbourhood.')) : null),
        TG.learn.familyCard(l),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => TG.go('learn') }, L('Бусад хичээл', 'More lessons')), h('button', { class: 'btn primary', onclick: () => TG.go('village') }, L('Нутаг руу', 'To Nutag'))));
    }

    const begin = (choice) => { mode = choice.mode; players = choice.players; show(); };
    if (params_with(id)) begin(params_with(id)); else { drawDots(); panel.replaceChildren(TG.basar.withPicker(begin, { title: L(`“${tx(l.title)}” хичээлийг хэнтэй үзэх вэ?`, `Who are you doing “${tx(l.title)}” with?`) })); }
    return h('div', { class: 'lesson', style: { '--lc': l.color } },
      h('div', { class: 'l-top' }, h('button', { class: 'icon-btn', 'aria-label': 'back', onclick: () => TG.go('learn') }, TG.icon('arrowLeft')), h('b', null, l.icon, ' ', tx(l.title)),
        h('button', { class: 'l-ask', onclick: () => TG.basar.open({ context: L(`Вуф! Бид “${tx(l.title)}” хичээл үзэж байна. Ойлгомжгүй юм байвал асуугаарай!`, `Woof! We’re doing “${tx(l.title)}”. Ask me anything you’re unsure about!`) }) }, TG.basar.face(0, 28), L('Асуух', 'Ask'))),
      dots, h('div', { class: 'l-stage px-card' }, scene.el), panel);
  };
})(window.TG);
