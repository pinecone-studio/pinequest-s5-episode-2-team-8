// Chapter 1 of the story mode: “Тэмүжин”, from the Great Khural of 1206 back to the night raid on the Merkits, then
// Temüjin's childhood. The events, names and quotations follow the Secret History of the Mongols (section numbers are on
// the fact cards); lines marked as speech are the Secret History's own words where it records them, short and simplified for
// children. Years the Secret History does not give are the usual estimates (birth 1162, the Merkit raid about 1184).
using System.Collections;
using UnityEngine;

public static class StoryCh1
{
    static Tx T(string mn, string en) => new Tx(mn, en);
    static readonly Look TEMUJIN = new Look { deel = "blue", hat = "mongol", skin = "#D9A06E", coat = "bay" };
    static readonly Look BOY = new Look { deel = "brown", hat = "cap", skin = "#D9A06E", coat = "bay" };
    static readonly Look BORTE = new Look { deel = "red", hat = "flower", skin = "#F6D3B3" };

    public static Game.StoryChapter Chapter() => new Game.StoryChapter
    {
        id = "ch1", name = T("1-р бүлэг: Тэмүжин", "Chapter 1: Temüjin"), years = T("1162–1206", "1162–1206"),
        blurb = T("Мэргидийн шөнийн дайралт, Тэмүжиний хүүхэд нас, Тайчуудаас оргосон нь, анхны нөхөр Боорчу.", "The night raid on the Merkits, Temüjin's childhood, his escape from the Tayichi'ud, and his first friend Bo'orchu."),
        parts = new System.Func<Game.StoryScene, IEnumerator>[] { Prologue, Raid, Moonlight, Birth, FireInHisEyes, YellowSteppe, Onon, Escape, Boorchu, Lessons },
    };

    // ---------------------------------------------------------------- 1206: where it ends, and begins
    static IEnumerator Prologue(Game.StoryScene s)
    {
        s.Bg("onon1206", 0, "dust"); s.Letterbox(true); s.Pan(560, 26);
        yield return s.Fade(false, 1.5f);
        yield return s.Title(T("1206 он · Онон голын эх", "1206 · The source of the Onon"), T("Их хуралдай", "The Great Khural"));
        yield return s.Say("chinggis", "smile", "Би Тэмүжин. Барс жил буюу 1206 онд Онон голын эхэнд эсгий туургатан бүгд намайг Чингис хаан хэмээн өргөмжилсөн.",
            "I am Temüjin. In the Year of the Tiger, 1206, at the source of the Onon, all the people of the felt-walled tents raised me as Chinggis Khaan.");
        yield return s.Say("chinggis", "neutral", "Есөн хөлт цагаан туг мандаж, бид Их Монгол Улс боллоо.", "The nine-tailed white standard was raised, and we became the Great Mongol State.");
        yield return s.Fact(T("Их хуралдай", "The Great Khural"), T("1206 онд Онон голын эхэнд их хуралдай хийж, есөн хөлт цагаан тугаа мандуулан Тэмүжинд Чингис хаан цол өргөсөн.",
            "In 1206 a great assembly met at the source of the Onon, raised the nine-tailed white standard and gave Temüjin the title Chinggis Khaan."), "§ 202");
        yield return s.Say("chinggis", "stern", "Гэвч би хаан болж төрөөгүй. Надад юу ч байгаагүй үе бий.", "But I was not born a khan. There was a time when I had nothing.");
        yield return s.Say("chinggis", "smile", "Миний түүхийг зүгээр сонсох биш, өөрөө амьдарч үз! Бөртийг аврахаар давхисан тэр шөнөөс эхэлье.",
            "Don't just hear my story, live it! Let us begin with the night I rode to bring Börte home.");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- about 1184: the Merkit raid
    static IEnumerator Raid(Game.StoryScene s)
    {
        s.Bg("night_raid", 0); s.Letterbox(true); s.Pan(140, 16);
        s.Put("temujin", TEMUJIN, 70, 152, 2, true);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("1184 он орчим · Буур хээр", "About 1184 · The Buura steppe"), T("Мэргидийн шөнийн дайралт", "The night raid on the Merkits"));
        yield return s.Say("temujin", "sad", "Мэргидүүд манай нутаг руу үүрээр гэнэт дайрч, эхнэр Бөртийг минь булаан авч одсон.",
            "The Merkits raided our camp at dawn and carried off my wife, Börte.");
        yield return s.Say("temujin", "stern", "Би Бурхан Халдун ууланд нуугдаж амь гарсан. Гэхдээ Бөртийг хэзээ ч орхихгүй.",
            "I escaped by hiding on Mount Burkhan Khaldun. But I would never abandon Börte.");
        yield return s.Fact(T("Бурхан Халдун", "Burkhan Khaldun"), T("Тэмүжин Бурхан Халдунд нуугдаж аврагдсандаа талархан, уулаа өглөө бүр тахиж, үр хүүхэд нь ч мартахгүй байхыг тангарагласан.",
            "Thankful that Burkhan Khaldun had sheltered him, Temüjin vowed to honour the mountain every morning, and asked his children and grandchildren never to forget it."), "§ 103");
        s.Put("toghrul", new Look { deel = "red", hat = "loovuuz", skin = "#D9A06E", coat = "gray" }, 30, 140, 2, true);
        s.Put("jamukha", new Look { deel = "purple", hat = "fur", skin = "#EDBB93", coat = "black" }, 40, 166, 2, true);
        yield return s.Say("temujin", "neutral", "Аавын минь анд Хэрэйдийн Тоорил хан, миний анд Жамуха хоёр надад туслахаар ирсэн.",
            "My father's sworn brother, Toghrul Khan of the Kereit, and my own sworn brother Jamukha came to help me.");
        yield return s.Say("toghrul", "smile", "Чиний бэлэглэсэн хар булган дахын хариуд Мэргидийг бут цохиж, Бөртийг чинь буцаан авчиръя.",
            "In return for the black sable coat you gave me, I will crush the Merkits and bring your Börte back.");
        yield return s.Say("jamukha", "stern", "Анд минь, Хилгэ мөрнийг сал хийж гатлаад, Мэргидийн хотон дээр шөнөөр гэнэт бууя!",
            "My anda, let us cross the Khilok on rafts and fall on the Merkit camp by night!");
        yield return s.Say("temujin", "shout", "Явцгаая!", "Let's ride!");
        yield return s.Fade(true, 0.6f);
        var raid = new Game.NightRaid(s.g);
        s.actors.Clear(); s.Bg("night_raid", 0);
        yield return s.Fade(false, 0.6f);
        yield return s.Play(raid);
        yield return s.Fade(true, 1, Color.white);
    }

    // ---------------------------------------------------------------- the moonlit meeting
    static IEnumerator Moonlight(Game.StoryScene s)
    {
        s.Bg("night_raid", 600, "fireflies"); s.Letterbox(true); s.Pan(640, 14);
        var me = s.Put("temujin", TEMUJIN, 780, 150, 1, true);
        var b = s.Put("borte", BORTE, 900, 156, 1); s.Walk("borte", 800, 152, 34, true);
        yield return s.Fade(false, 1.6f, Color.white);
        yield return s.Say("chinggis", "neutral", "Сарны гэрэлд Бөртэ миний дууг таньж, тэрэгнээсээ буун гүйж ирээд морины минь цулбуураас барьсан.",
            "In the moonlight Börte knew my voice. She jumped down from the cart, ran to me and caught hold of my horse's reins.");
        yield return s.Say("borte", "smile", "Тэмүжин!", "Temüjin!");
        yield return s.Fact(T("Бөртийг аварсан нь", "Börte comes home"), T("Тэмүжин, Тоорил хан, Жамуха гурвын цэрэг Мэргидийг ялж, Бөртийг эсэн мэнд буцаан авчирсан. Тэмүжин “Хайж явсан хүнээ оллоо” гэж хэлээд цааш хөөхөө зогсоосон.",
            "The armies of Temüjin, Toghrul Khan and Jamukha defeated the Merkits and brought Börte home safely. Temüjin said “I have found the one I was looking for” and stopped the pursuit."), "§ 110");
        yield return s.Say("chinggis", "neutral", "Найз нөхөд, холбоотнуудтайгаа нэгдсэн учраас бид ялсан. Ганцаараа бол юу ч хийж чадахгүй байлаа.",
            "We won because I joined with friends and allies. Alone, I could have done nothing.");
        yield return s.Say("chinggis", "smile", "Харин надад юу ч байгаагүй хүүхэд нас минь ямар байсныг мэдэх үү? Одоо түүнийг өөрөө амьдарч үз.",
            "But do you know what my childhood was like, when I had nothing? Now live it yourself.");
        yield return s.Fade(true, 1.2f);
    }

    // ---------------------------------------------------------------- 1162: born on the Onon
    static IEnumerator Birth(Game.StoryScene s)
    {
        s.Bg("birth", 120); s.Letterbox(true); s.Pan(420, 20);
        yield return s.Fade(false, 1.4f);
        yield return s.Title(T("1162 он · Онон голын Дэлүүн болдог", "1162 · Delüün Boldog on the Onon"), T("Тэмүжин мэндэлсэн нь", "Temüjin is born"));
        yield return s.Say("chinggis", "smile", "Би Онон голын эрэг дээрх Дэлүүн болдог хэмээх газар төрсөн. Аав минь Есүхэй баатар, ээж минь Өэлүн.",
            "I was born at Delüün Boldog, on the bank of the Onon. My father was Yesügei Baatar, and my mother was Hö'elün.");
        yield return s.Say("chinggis", "neutral", "Намайг баруун гартаа шагай шиг нөж атгаж төрсөн гэдэг.", "They say I was born holding a blood clot the size of a knucklebone in my right hand.");
        yield return s.Fact(T("Тэмүжин гэдэг нэр", "The name Temüjin"), T("Түүнийг төрөх үед эцэг Есүхэй нь Татарын Тэмүжин үгэ хэмээх хүнийг олзолж ирсэн тул хүүдээ тэр нэрийг өгсөн. Төрсөн оныг ихэвчлэн 1162 гэж үздэг.",
            "When he was born, his father Yesügei had just captured a Tatar named Temüjin-Üge, so he gave his son that name. His birth year is usually given as 1162."), "§ 59");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- about 1171: Dei Sechen and Börte
    static IEnumerator FireInHisEyes(Game.StoryScene s)
    {
        s.Bg("onggirat", 200); s.Letterbox(true); s.Pan(380, 22);
        s.Put("yesugei", new Look { deel = "brown", hat = "mongol", skin = "#B97A4A", coat = "chestnut" }, 240, 160, 2, true);
        s.Put("boy", BOY, 262, 166, 2, true);
        s.Walk("yesugei", 420, 160, 24); s.Walk("boy", 442, 166, 24);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("1171 он орчим · Хонгирадын нутаг", "About 1171 · The Onggirat land"), T("Бөртэтэй анх уулзсан нь", "Meeting Börte"));
        yield return s.Say("chinggis", "neutral", "Намайг есөн настай байхад аав минь надад сүйт бүсгүй олохоор Хонгирад аймгийн зүг дагуулж явсан.",
            "When I was nine, my father took me towards the Onggirat people to find me a bride.");
        s.Put("dei", new Look { deel = "white", hat = "fur", skin = "#D9A06E" }, 470, 162, 1);
        yield return s.Say("dei_sechen", "smile", "Энэ хүү чинь нүдэндээ галтай, нүүрэндээ гэрэлтэй хүү байна.", "This boy of yours has fire in his eyes and light in his face.");
        yield return s.Say("dei_sechen", "neutral", "Би өчигдөр шөнө нар, сар хоёрыг атгасан цагаан шонхор нисэж ирээд миний гар дээр суухыг зүүдэлсэн.",
            "Last night I dreamt that a white gyrfalcon, holding the sun and the moon, flew down and perched on my hand.");
        s.Put("borte", new Look { deel = "red", hat = null, skin = "#F6D3B3" }, 500, 166, 1);
        yield return s.Say("chinggis", "smile", "Түүний охин Бөртэ надаас нэг насаар ах, арван настай байв. Тэр ч бас нүүрэндээ гэрэлтэй, нүдэндээ галтай охин байлаа.",
            "His daughter Börte was ten, a year older than me. She too had light in her face and fire in her eyes.");
        yield return s.Fact(T("Хүргэн хүү", "A son-in-law"), T("Есүхэй Тэмүжинийг ирээдүйн хүргэн болгон Дэй сэцэнийд үлдээж, хүүгээ нохойноос айдаг тул нохойгоор бүү айлгаарай гэж захисан.",
            "Yesügei left Temüjin at Dei Sechen's as his future son-in-law, and asked them not to let the dogs frighten the boy, because he was afraid of dogs."), "§ 66");
        yield return s.Say("chinggis", "sad", "Аав минь намайг тэнд үлдээгээд буцсан. Тэр л миний аавыг харсан сүүлчийн удаа байлаа.",
            "My father left me there and rode home. That was the last time I saw him.");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- the Yellow Steppe
    static IEnumerator YellowSteppe(Game.StoryScene s)
    {
        s.Bg("yellow_steppe", 220); s.Letterbox(true); s.Pan(330, 18);
        s.Put("yesugei", new Look { deel = "brown", hat = "mongol", skin = "#B97A4A", coat = "chestnut" }, 340, 162, 2, true);
        s.Walk("yesugei", 390, 162, 14);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("Шар хээр", "The Yellow Steppe"), T("Есүхэй баатар", "Yesügei Baatar"));
        yield return s.Say("chinggis", "sad", "Замдаа аав минь Шар хээрт найрлаж байсан Татаруудтай таарав. Тэд аавыг минь таньж, хоолонд нь нууцаар хор хийжээ.",
            "On the way home my father came upon Tatars feasting on the Yellow Steppe. They recognised him and secretly put poison in his food.");
        yield return s.Say("chinggis", "sad", "Гурав хоноод гэртээ хүрсэн ч аав минь хорвоог орхисон. Би дөнгөж есөн настай байлаа.",
            "He reached home three days later, but he died. I was only nine years old.");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- alone by the Onon (playable)
    static IEnumerator Onon(Game.StoryScene s)
    {
        s.Bg("autumn_onon", 60, "leaves"); s.Letterbox(true); s.Pan(200, 18);
        s.Put("mom", new Look { deel = "green", hat = "fur", skin = "#D9A06E" }, 200, 166, 2);
        s.Put("boy", BOY, 232, 168, 1);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("Онон гол", "The Onon river"), T("Ганцаараа үлдсэн нь", "Left alone"));
        yield return s.Say("chinggis", "sad", "Тайчуудын ноёд биднийг орхин нүүж, ард иргэд нь ч тэднийг дагав. Ээж бид хүүхдүүд л үлдсэн.",
            "The Tayichi'ud nobles moved away and abandoned us, and our people followed them. Only my mother and we children were left.");
        yield return s.Say("chinggis", "neutral", "Ээж минь малгайгаа чангалж, хормойгоо шамлан, Онон голыг өгсөж уруудан мангир, сарана, мойл түүж биднийг тэжээсэн.",
            "My mother tied her hat tight, tucked up her skirt and ran up and down the Onon gathering wild onions, lily roots and bird cherries to feed us.");
        yield return s.Say("hoelun", "stern", "Хүү минь, бид бууж өгөхгүй. Ургамал түүгээд, дараа нь голоос загас барь.", "My son, we will not give up. Gather plants, then catch fish in the river.");
        yield return s.Fade(true, 0.6f);
        s.actors.Clear();
        yield return s.Fade(false, 0.6f);
        yield return s.Play(new Game.OnonDay(s.g));
        s.Letterbox(true);
        yield return s.Say("hoelun", "smile", "Сайн байна, хүү минь. Голын загас, газрын ургамал биднийг тэжээх болно.", "Well done, my son. The fish of the river and the plants of the land will feed us.");
        yield return s.Fact(T("Өэлүн эхийн сургаал", "Mother Hö'elün's lesson"), T("Ах дүүс хоорондоо муудалцахад Өэлүн эх “Сүүдрээсээ өөр нөхөргүй, сүүлнээсээ өөр ташуургүй” байгаа гэдгийг сануулж, эв нэгдэлтэй байхыг сургажээ.",
            "When the brothers quarrelled, Mother Hö'elün reminded them that they had “no friend but their shadow, no whip but their horse's tail”, and taught them to stand together."), "§ 76–78");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- the escape (playable)
    static IEnumerator Escape(Game.StoryScene s)
    {
        s.Bg("tayichiud_night", 0); s.Letterbox(true); s.Pan(160, 16);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("Улаан тойргийн өдөр", "The Red Circle Day"), T("Тайчуудаас оргосон нь", "Escape from the Tayichi'ud"));
        yield return s.Say("chinggis", "stern", "Хэдэн жилийн дараа Тайчуудын Таргудай Хирилтуг намайг барьж, хүзүүнд минь мод дөнгө зүүсэн.",
            "Some years later Targhutai Kiriltuq of the Tayichi'ud captured me and locked a wooden cangue around my neck.");
        yield return s.Say("chinggis", "neutral", "Зуны тэргүүн сарын арван зургаанд, улаан тойргийн өдөр, тэд Онон голын эрэгт найр хийв. Тэр шөнө би зугтсан.",
            "On the sixteenth day of the first summer month, the Red Circle Day, they feasted on the bank of the Onon. That night I escaped.");
        yield return s.Fade(true, 0.6f);
        yield return s.Fade(false, 0.6f);
        yield return s.Play(new Game.Escape(s.g));
        s.Letterbox(true); s.Pan(760, 3);
        s.Put("ss", new Look { deel = "brown", hat = "fur", skin = "#B97A4A" }, 860, 146, 1);
        yield return s.Say("sorkhan_shira", "smile", "Чи ийм ухаантай учраас л Тайчуудын ахан дүүс чамд атаархдаг юм. Тийм хэвтэж бай, би хэлэхгүй.",
            "It is because you are so clever that the Tayichi'ud brothers envy you. Lie just like that. I will not tell.");
        yield return s.Say("chinggis", "neutral", "Сулдусын Сорхон шар намайг гэртээ нуусан. Хөвгүүд нь Чимбай, Чулуун хоёр дөнгийг минь тайлж шатаагаад, намайг ноосон тэргэнд нуусан.",
            "Sorkhan-Shira of the Suldus hid me in his home. His sons Chimbai and Chila'un took off my cangue and burned it, and they hid me in a cart of wool.");
        yield return s.Say("sorkhan_shira", "neutral", "Ийм халуунд ноосон дотор хэн тэсэх вэ дээ?", "In heat like this, who could stand being inside the wool?");
        yield return s.Fact(T("Сорхон шарын ач", "Sorkhan-Shira's kindness"), T("Хайгчид явсны дараа Сорхон шар Тэмүжинд хээр гүү, хурга, нум, хоёр сум өгч гэр рүү нь явуулсан. Хожим Чингис хаан түүний ачийг мартаагүй, дархан цолоор шагнасан.",
            "When the searchers had gone, Sorkhan-Shira gave Temüjin a mare, a lamb, a bow and two arrows and sent him home. Chinggis Khaan never forgot it and later made him a darkhan, a free and honoured man."), "§ 87–88, § 219");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- the first friend
    static IEnumerator Boorchu(Game.StoryScene s)
    {
        s.Bg("onggirat", 520, "dust"); s.Letterbox(true); s.Pan(640, 18);
        s.Put("temujin", TEMUJIN, 560, 160, 2, true); s.Walk("temujin", 660, 160, 30);
        s.Put("boorchu", new Look { deel = "green", hat = "cap", skin = "#B97A4A" }, 720, 164, 1);
        yield return s.Fade(false, 1.2f);
        yield return s.Title(T("Шинэ нөхөр", "A new friend"), T("Боорчу", "Bo'orchu"));
        yield return s.Say("chinggis", "neutral", "Нэг өдөр хулгайчид манай найман морийг туугаад явчихав. Мөрийг нь мөшгөж явахдаа гүү сааж байсан Боорчу хэмээх хүүтэй таарсан.",
            "One day thieves drove off our eight horses. Tracking them, I met a boy called Bo'orchu, who was milking mares.");
        yield return s.Say("boorchu", "smile", "Нөхөр минь, чи их зовж ирж. Эр хүний зовлон нэг. Би чамтай нөхөр болж явъя!", "Friend, you have come in great trouble. Men's troubles are shared. I will ride with you!");
        s.Get("boorchu").mounted = true; s.Get("boorchu").look.coat = "white";
        s.Walk("temujin", 900, 158, 60, true); s.Walk("boorchu", 920, 166, 60, true);
        yield return s.Say("chinggis", "smile", "Боорчу саалиа хээр орхиод, гэрийнхэндээ ч хэлэлгүй надтай хамт давхиж, морьдыг минь буцааж авахад тусалсан. Тэр шагнал авахаас ч татгалзав.",
            "Bo'orchu left his milk pail in the grass and rode off with me without even telling his family, and helped me get my horses back. He would not even take a reward.");
        yield return s.Fact(T("Анхны нөхөр", "The first companion"), T("Боорчу Тэмүжиний анхны нөхөр болж, хожим Чингис хааны хамгийн итгэлтэй жанжнуудын нэг болсон.",
            "Bo'orchu became Temüjin's first companion, and later one of Chinggis Khaan's most trusted generals."), "§ 90–93");
        yield return s.Fade(true, 1);
    }

    // ---------------------------------------------------------------- what it taught him
    static IEnumerator Lessons(Game.StoryScene s)
    {
        s.Bg("onon1206", 300, "dust"); s.Letterbox(true); s.Pan(420, 30);
        yield return s.Fade(false, 1.2f);
        yield return s.Say("chinggis", "smile", "Тэр хүнд өдрүүд надад юу заасныг чи санаж байна уу? Шалгая!", "Do you remember what those hard days taught me? Let's see!");
        int right = 0;
        yield return s.Ask("chinggis", "neutral", T("Тэмүжин Бөртийг аврахад юу тусалсан бэ?", "What helped Temüjin rescue Börte?"), T("Найз нөхөд, холбоотнууд", "Friends and allies"), T("Ганцаараа зүтгэсэн нь", "Doing it all alone"), T("Зүгээр л аз", "Just luck"));
        if (s.lastPick == 0) { right++; Sfx.Good(); } else Sfx.Bad();
        yield return s.Say("chinggis", s.lastPick == 0 ? "smile" : "neutral", "Тоорил хан, Жамуха хоёртой нэгдсэн учраас бид ялсан.", "We won because I joined Toghrul Khan and Jamukha.");
        yield return s.Ask("chinggis", "neutral", T("Тайчуудаас оргоход хэн Тэмүжинийг нуусан бэ?", "Who hid Temüjin after his escape from the Tayichi'ud?"), T("Боорчу", "Bo'orchu"), T("Сорхон шар", "Sorkhan-Shira"), T("Дэй сэцэн", "Dei Sechen"));
        if (s.lastPick == 1) { right++; Sfx.Good(); } else Sfx.Bad();
        yield return s.Say("chinggis", s.lastPick == 1 ? "smile" : "neutral", "Сулдусын Сорхон шар намайг ноосон тэргэнд нуусан.", "Sorkhan-Shira of the Suldus hid me in a cart of wool.");
        yield return s.Ask("chinggis", "neutral", T("Тэмүжин аль онд Чингис хаан цолтой болсон бэ?", "In which year did Temüjin become Chinggis Khaan?"), T("1162", "1162"), T("1206", "1206"), T("1184", "1184"));
        if (s.lastPick == 1) { right++; Sfx.Good(); } else Sfx.Bad();
        yield return s.Say("chinggis", s.lastPick == 1 ? "smile" : "neutral", "1206 онд, Онон голын эхэнд.", "In 1206, at the source of the Onon.");
        if (right > 0) { var got = s.g.Reward(right * 5, right * 10); s.g.Toast(Loc.L($"{right}/3 зөв! +{got.coins} зоос", $"{right}/3 right! +{got.coins} coins")); }
        yield return s.Say("chinggis", "smile", "Эв нэгдэл, тэвчээр, үнэнч нөхөрлөл. Дараагийн бүлэгт би тал нутгийн олон аймгийг хэрхэн нэгтгэснийг үзүүлнэ.",
            "Unity, perseverance and loyal friendship. In the next chapter I will show you how I united the peoples of the steppe.");
        yield return s.Title(T("1-р бүлэг дууслаа", "Chapter 1 complete"), T("Үргэлжлэл бий...", "To be continued..."), 3.6f);
        yield return s.Fade(true, 1.4f);
    }
}
