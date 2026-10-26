/* Content: mascots, family members, memory-book prompts */
(function (TG) {
  // Register: every child picks a Mongolian animal mascot
  const M = (e, mn, en, fmn, fen) => ({ e, name: { mn, en }, fact: { mn: fmn, en: fen } });
  TG.MASCOTS = [
    M('🐎', 'Хурдан морь', 'Swift horse', 'Монголд хүнээс олон адуу бий!', 'Mongolia has more horses than people!'),
    M('🐫', 'Тэвчээртэй тэмээ', 'Patient camel', 'Хоёр бөхтэй тэмээ Говьд амьдардаг.', 'Two-humped camels live in the Gobi.'),
    M('🦅', 'Сэргэлэн бүргэд', 'Clever eagle', 'Бүргэдчид бүргэдээр ан хийдэг.', 'Eagle hunters hunt with golden eagles.'),
    M('🐆', 'Цоохор ирвэс', 'Snow leopard', 'Ирвэс өндөр ууланд нуугдаж амьдардаг.', 'Snow leopards hide high in the mountains.'),
    M('🐺', 'Бөртэ чоно', 'Blue wolf', 'Нууц товчоо Бөртэ чоноор эхэлдэг.', 'The Secret History begins with a blue wolf.'),
    M('🐑', 'Номхон хонь', 'Gentle sheep', 'Хонины ноосоор эсгий хийдэг.', 'Felt for the ger is made from sheep’s wool.'),
    M('🐐', 'Сэргэг ямаа', 'Lively goat', 'Ямааны ноолуур дэлхийд алдартай.', 'Mongolian cashmere is famous worldwide.'),
    M('🐂', 'Хүчит сарлаг', 'Strong yak', 'Сарлагийн сүү маш тослог.', 'Yak milk is very creamy.'),
    M('🦌', 'Цаа буга', 'Reindeer', 'Цаатан ард цаа бугаа маллдаг.', 'The Tsaatan people herd reindeer.'),
    M('🦊', 'Ухаалаг үнэг', 'Clever fox', 'Үнэг ардын үлгэрт их гардаг.', 'Foxes star in many folk tales.'),
    M('🐿️', 'Зурам', 'Ground squirrel', 'Зурам тал нутагт нүх ухаж амьдардаг.', 'Ground squirrels dig burrows on the steppe.'),
    M('🐻', 'Мазаалай', 'Gobi bear', 'Мазаалай зөвхөн Монголын Говьд бий.', 'The Gobi bear lives only in Mongolia’s Gobi.'),
  ];
  TG.AVATARS = TG.MASCOTS.map((m) => m.e);
  TG.FAMILY_EMOJIS = ['👩', '👨', '👵', '👴', '🧑', '👧', '👦', '🧒', '👶', '🧕', '👩‍🦳', '👨‍🦳'];
  // picture password: kids remember 3 pictures more easily than letters
  TG.PIC_KEYS = ['⛺', '🐎', '🥛', '🏹', '🌙', '☀️', '🐕', '🦴', '🎻'];

  TG.STORY_PROMPTS = [
    { mn: 'Та бага байхдаа ямар тоглоом тоглодог байсан бэ?', en: 'What games did you play as a child?' },
    { mn: 'Таны хамгийн дуртай үлгэрийг ярьж өгөөч.', en: 'Tell me your favorite folk tale.' },
    { mn: 'Та миний насан дээр юу мөрөөддөг байсан бэ?', en: 'What did you dream about at my age?' },
    { mn: 'Таны төрсөн нутаг ямар газар байсан бэ?', en: 'What was your birthplace like?' },
    { mn: 'Та Цагаан сараа хэрхэн тэмдэглэдэг байсан бэ?', en: 'How did you celebrate Tsagaan Sar?' },
    { mn: 'Таны амьдралын хамгийн аз жаргалтай өдөр аль нь вэ?', en: 'What was the happiest day of your life?' },
    { mn: 'Надад өгөх хамгийн чухал зөвлөгөө тань юу вэ?', en: 'What is the most important advice you would give me?' },
    { mn: 'Та анх ямар ажил хийж байсан бэ?', en: 'What was your first job?' },
    { mn: 'Танд ямар дуу хамгийн их таалагддаг вэ? Дуулж өгөөч!', en: 'What is your favorite song? Please sing it!' },
    { mn: 'Би бага байхдаа ямар хүүхэд байсан бэ?', en: 'What was I like as a baby?' },
    { mn: 'Ээж, аав хоёр минь хэрхэн танилцсан бэ?', en: 'How did my parents meet?' },
    { mn: 'Танд бага байхад хэн хамгийн их нөлөөлсөн бэ?', en: 'Who inspired you most as a child?' },
  ];

})(window.TG);
