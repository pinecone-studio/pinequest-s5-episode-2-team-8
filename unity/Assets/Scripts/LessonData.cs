// The heritage school's lessons (Өв соёлын сургууль): each one's picture (Scenes.cs), its steps (learn, story, pick, tf, zones,
// tap, drag, hold, timing: Lessons.cs runs them), Basar's quiz topic and the real-life family activity at the end.
// Each lesson and step is the same shape the lessons.json file had, so Lessons.cs reads it as J: T(mn, en) is a text in both
// languages, A(...) a list, and a step's `stage` / `set` / `final` change the picture (SceneState).
using System.Collections.Generic;

public static class LessonData
{
    /** An object whose numbers are stored as J expects them (double), so a lesson reads the same as from JSON. */
    sealed class D : Dictionary<string, object>
    {
        public new object this[string k] { get => base[k]; set => base[k] = N(value); }
    }
    static object N(object v) => v is int i ? (double)i : v;
    static D T(string mn, string en) => new D { ["mn"] = mn, ["en"] = en };
    static List<object> A(params object[] items) { var l = new List<object>(items.Length); foreach (var x in items) l.Add(N(x)); return l; }

    public static readonly J ALL = new J(A(
        new D
        {
            ["id"] = "ger",
            ["icon"] = "⛺",
            ["scene"] = "ger",
            ["topic"] = "ger",
            ["color"] = "#3f76db",
            ["final"] = new D { ["stage"] = 9 },
            ["title"] = T("Монгол гэр барих", "Build a Mongol ger"),
            ["learned"] = A(
                T("Гэрийн хэсгүүд: шал, хана, хаалга, тооно, багана, унь, эсгий, бүрээс, бүслүүр", "The ger’s parts: floor, khana, door, toono, bagana, uni, felt, cover, ropes"),
                T("Барих дараалал ба хаалга урагшаа харах шалтгаан", "The building order and why the door faces south"),
                T("Эсгий гэрийг дулаан байлгадаг", "Felt keeps the ger warm")
            ),
            ["desc"] = T("Хана, тооно, униа зөв дарааллаар босгоод өөрийн гэрээ бариарай.", "Raise the walls, crown and poles in the right order and build your own ger."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Нүүдэлчдийн ухаалаг байшин", "The nomads’ clever home"),
                    ["text"] = T("Монгол гэрийг гэр бүлээрээ 1–2 цагт барьж, буулгаж болдог. Өвөл дулаан, зун сэрүүн. Өнөөдөр чи гэрийн хэсэг бүрийг өөрөө авчирч тавина!", "A family can put up or take down a ger in 1–2 hours. Warm in winter, cool in summer. Today you will bring every part and put it in place yourself!"),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 1,
                    ["title"] = T("1. Шалаа тавь", "1. Lay the floor"),
                    ["text"] = T("Тэгш газар сонгоод эхлээд шалаа тавина. Доорх тавиураас зөв хэсгийг сонгоод гэрэлтэж буй газар руу чирээрэй.", "Pick flat ground and lay the floor first. Pick the right part from the tray below and drag it onto the glowing spot."),
                    ["options"] = A(
                        new D { ["t"] = T("Шал", "Floor"), ["img"] = "part:shal", ["ok"] = true },
                        new D { ["t"] = T("Хана", "Walls (khana)"), ["img"] = "part:khana", ["ok"] = false },
                        new D { ["t"] = T("Хаалга", "Door"), ["img"] = "part:khaalga", ["ok"] = false },
                        new D { ["t"] = T("Тооно", "Crown (toono)"), ["img"] = "part:toono", ["ok"] = false }
                    ),
                    ["after"] = T("Зөв! Тэгш газар шалаа тавьснаар гэр тэгш, бат бөх болно.", "Right! A level floor keeps the ger straight and strong."),
                    ["drop"] = A(27, 60, 66, 7),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 2,
                    ["sub"] = 0,
                    ["title"] = T("2. Ханаа авчир", "2. Bring the walls"),
                    ["text"] = T("Хана бол эвхэгддэг модон сараалж. Эвхээтэй ханыг шалан дээр чирж тавь.", "The khana is a folding wooden lattice. Drag the folded walls onto the floor."),
                    ["options"] = A(
                        new D { ["t"] = T("Хана", "Walls (khana)"), ["img"] = "part:khana", ["ok"] = true },
                        new D { ["t"] = T("Хаалга", "Door"), ["img"] = "part:khaalga", ["ok"] = false },
                        new D { ["t"] = T("Тооно", "Crown (toono)"), ["img"] = "part:toono", ["ok"] = false },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false }
                    ),
                    ["after"] = T("Хана эвхээтэй ирлээ. Одоо дэлгэе!", "The walls are here, still folded. Now let’s open them!"),
                    ["drop"] = A(30, 46, 60, 18),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 2,
                    ["dir"] = "side",
                    ["n"] = 5,
                    ["icon"] = "👐",
                    ["label"] = T("Ханаа дэлгэх", "Stretch the khana"),
                    ["title"] = T("Ханаа дэлгэ!", "Stretch the walls!"),
                    ["text"] = T("Ханыг зүүнээс баруун тийш чирж сунга. 5 удаа дэлгэвэл 5 ханатай гэр болно.", "Drag the walls from left to right to stretch them open. Stretch 5 times for a 5-khana ger."),
                    ["low"] = T("Илүү өргөн дэлгэ!", "Stretch it wider!"),
                    ["after"] = T("5 ханатай гэр гэр бүлд хамгийн түгээмэл хэмжээ.", "A 5-khana ger is the most common family size."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 3,
                    ["title"] = T("3. Хаалгаа тавь", "3. Put in the door"),
                    ["text"] = T("Хоёр ханын дунд хаалгаа уяна. Хаалгыг урд талын гэрэлтэж буй газар руу чирээрэй.", "The door is tied between two walls. Drag it onto the glowing spot at the front."),
                    ["options"] = A(
                        new D { ["t"] = T("Хаалга", "Door"), ["img"] = "part:khaalga", ["ok"] = true },
                        new D { ["t"] = T("Тооно", "Crown (toono)"), ["img"] = "part:toono", ["ok"] = false },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false },
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = false }
                    ),
                    ["after"] = T("Хаалгыг урагш харуулдаг: нар сайн тусаж, хойд зүгийн хүйтэн салхинаас хамгаалагдана.", "The door faces south: the sun shines in and the cold north wind stays out."),
                    ["drop"] = A(52, 47, 16, 18),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 4,
                    ["sub"] = 0,
                    ["title"] = T("4. Тоонгоо авчир", "4. Bring the crown"),
                    ["text"] = T("Гэрийн “нүд” болох дугуй тооно хоёр баганатай. Тоонгоо шалны голд чирж тавь.", "The round toono, the ger’s “eye”, stands on two posts. Drag it to the middle of the floor."),
                    ["options"] = A(
                        new D { ["t"] = T("Тооно", "Crown (toono)"), ["img"] = "part:toono", ["ok"] = true },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false },
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = false },
                        new D { ["t"] = T("Бүрээс", "White cover"), ["img"] = "part:buurees", ["ok"] = false }
                    ),
                    ["after"] = T("Тоонгоо авчирлаа. Одоо хоёр хүн хамт өргөнө!", "The toono is here. Now two people lift it together!"),
                    ["drop"] = A(48, 50, 24, 12),
                },
                new D
                {
                    ["type"] = "timing",
                    ["stage"] = 4,
                    ["lo"] = 0.82,
                    ["hi"] = 0.97,
                    ["label"] = T("Өргө!", "Lift!"),
                    ["title"] = T("Тооноо хамт өргө!", "Lift the toono together!"),
                    ["text"] = T("Тооно хүнд! Хоёр хүн хоёр баганыг зэрэг өргөнө. Зүү ногоон хэсэгт ирэхэд “Өргө!” дар: нэг, хоёр, гурав!", "The toono is heavy! Two people raise its two posts at the same time. Tap “Lift!” when the needle reaches the green zone: one, two, three!"),
                    ["after"] = T("Өргөлөө! Тооно бол гэрийн нүд: гэрэл, агаар тэндээс орж, утаа гардаг.", "Up it goes! The toono is the ger’s eye: light and air come in and smoke goes out through it."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 5,
                    ["sub"] = 0,
                    ["title"] = T("5. Униа авчир", "5. Bring the roof poles"),
                    ["text"] = T("Тооноос хана хүртэл униа тавина. Униа гэр рүү чирээрэй.", "The uni go from the toono down to the walls. Drag the poles onto the ger."),
                    ["options"] = A(
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = true },
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = false },
                        new D { ["t"] = T("Бүрээс", "White cover"), ["img"] = "part:buurees", ["ok"] = false },
                        new D { ["t"] = T("Бүслүүр", "Ropes"), ["img"] = "part:buslvvr", ["ok"] = false }
                    ),
                    ["after"] = T("Унь бэлэн. Одоо нэг нэгээр нь тооно руу шургуулъя!", "The poles are here. Now push them into the toono one by one!"),
                    ["drop"] = A(32, 30, 56, 17),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 5,
                    ["dir"] = "up",
                    ["alt"] = true,
                    ["n"] = 9,
                    ["icon"] = "✊",
                    ["label"] = T("Униа тооно руу шургуул", "Push the uni into the toono"),
                    ["title"] = T("Униа хатга!", "Place the roof poles!"),
                    ["text"] = T("Унийн үзүүрийг тооны нүхэнд дээш нь шургуулж, нөгөө үзүүрийг ханад уяна. Тэнцвэртэй байлгахын тулд зүүн, баруун талд ээлжлэн тавь.", "Push the end of each uni up into a hole in the toono and tie the other end to the wall. Place them left and right in turn to keep it balanced."),
                    ["altHint"] = T("Ээлжлэн тавь! Одоо нөгөө талд нь униа шургуул, тэгэхгүй бол тооно хазайна.", "Take turns! Now do the other side, or the toono will tip."),
                    ["low"] = T("Дээш нь бүр түлх!", "Push it all the way up!"),
                    ["after"] = T("Жинхэнэ 5 ханатай гэрт 80 орчим унь байдаг!", "A real 5-khana ger has about 80 poles!"),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 6,
                    ["title"] = T("6. Эсгийгээр бүрэ", "6. Wrap it in felt"),
                    ["text"] = T("Хана, униа дулаан эсгийгээр бүрнэ. Доорх тавиураас зөв хэсгийг сонгоод гэрэлтэж буй газар руу чирээрэй.", "Felt goes over the walls and the roof to keep it warm. Pick the right part from the tray below and drag it onto the glowing spot."),
                    ["options"] = A(
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = true },
                        new D { ["t"] = T("Бүрээс", "White cover"), ["img"] = "part:buurees", ["ok"] = false },
                        new D { ["t"] = T("Бүслүүр", "Ropes"), ["img"] = "part:buslvvr", ["ok"] = false },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false }
                    ),
                    ["after"] = T("Хонины ноосоор хийсэн эсгий өвлийн хүйтэнд дулаан байлгадаг.", "Felt made from sheep’s wool keeps out the winter cold."),
                    ["drop"] = A(30, 30, 60, 35),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 7,
                    ["title"] = T("7. Бүрээсээ хуч", "7. Put on the cover"),
                    ["text"] = T("Эсгийн гадуур цагаан бүрээс хучиж борооноос хамгаална. Доорх тавиураас зөв хэсгийг сонгоод гэрэлтэж буй газар руу чирээрэй.", "The white cover goes over the felt to keep the rain out. Pick the right part from the tray below and drag it onto the glowing spot."),
                    ["options"] = A(
                        new D { ["t"] = T("Бүрээс", "White cover"), ["img"] = "part:buurees", ["ok"] = true },
                        new D { ["t"] = T("Бүслүүр", "Ropes"), ["img"] = "part:buslvvr", ["ok"] = false },
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = false },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false }
                    ),
                    ["after"] = T("Цагаан бүрээс бороо, нарнаас хамгаалж, гэрийг гоё харагдуулдаг.", "The white cover protects from rain and sun and makes the ger shine."),
                    ["drop"] = A(30, 30, 60, 35),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 8,
                    ["sub"] = 0,
                    ["title"] = T("8. Бүслүүрээ авчир", "8. Bring the ropes"),
                    ["text"] = T("Гурван бүслүүрийг гэрийн гадуур ороож уяна. Бүслүүрийг гэр рүү чирээрэй.", "Three ropes are tied round the ger. Drag the ropes onto the ger."),
                    ["options"] = A(
                        new D { ["t"] = T("Бүслүүр", "Ropes"), ["img"] = "part:buslvvr", ["ok"] = true },
                        new D { ["t"] = T("Бүрээс", "White cover"), ["img"] = "part:buurees", ["ok"] = false },
                        new D { ["t"] = T("Эсгий", "Felt"), ["img"] = "part:esgii", ["ok"] = false },
                        new D { ["t"] = T("Унь", "Roof poles (uni)"), ["img"] = "part:uni", ["ok"] = false }
                    ),
                    ["after"] = T("Одоо бүслүүр бүрийг чангалъя!", "Now pull each rope tight!"),
                    ["drop"] = A(30, 46, 60, 18),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 8,
                    ["dir"] = "down",
                    ["n"] = 3,
                    ["icon"] = "💪",
                    ["label"] = T("Бүсээ чангал", "Pull the rope tight"),
                    ["title"] = T("Бүслүүрээ чангал!", "Tighten the ropes!"),
                    ["text"] = T("Гурван бүслүүрээр гэрээ бүсэлбэл хүчтэй салхинд ч хөдлөхгүй. Доош нь татаж чангал.", "Three ropes keep the ger steady even in strong wind. Pull each one down tight."),
                    ["low"] = T("Хүчтэй тат!", "Pull harder!"),
                    ["after"] = T("Гэр бат бөх боллоо! Салхитай өдөр ч хөдлөхгүй.", "The ger is firm now. It won’t move even on a windy day."),
                },
                new D
                {
                    ["type"] = "learn",
                    ["stage"] = 9,
                    ["title"] = T("Гэр бэлэн боллоо! 🎉", "Your ger is ready! 🎉"),
                    ["text"] = T("Тулгаа тавьж, анхны цайгаа чанана. Одоо Басарын асуултад хариулаад, дараа нь гэр бүлээрээ бяцхан гэр барьцгаая!", "Set up the stove and make the first tea. Now answer Basar’s questions, then build a mini ger with your family!"),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, хамтдаа монгол гэр барьцгаая!”", "“Mom, Dad, let’s build a Mongol ger together!”"),
                ["what"] = T("Картон, цаасаар бяцхан гэр хийцгээе", "Make a mini ger from card and paper"),
                ["materials"] = A(
                    T("Зузаан цаас эсвэл картон", "Thick paper or card"),
                    T("10 шүдний чигчлүүр эсвэл шорлог", "10 toothpicks or skewers"),
                    T("Цагаан даавуу эсвэл салфетка", "White cloth or a napkin"),
                    T("Утас, цавуу, хайч (том хүнтэй)", "String, glue, scissors (with a grown-up)")
                ),
                ["steps"] = A(
                    T("Картоныг тойруулан тавьж хана хийгээд хаалгыг нь урагш харуулна.", "Roll card into a circle for the walls; the door faces south."),
                    T("Цаасан цагираг хийж тооно болгоно.", "Make a paper ring for the toono."),
                    T("Чигчлүүрүүдийг тооноос хана руу унь болгож наана.", "Glue toothpicks from the toono to the walls as uni."),
                    T("Цагаан даавуугаар бүрээд, утсаар бүслүүр уяна.", "Cover with cloth and tie string ropes around it."),
                    T("Гэрийнхэндээ гэрийн хэсгүүдийн нэрийг заагаарай!", "Teach your family the names of every part!")
                ),
            },
        },
        new D
        {
            ["id"] = "idee",
            ["icon"] = "🥛",
            ["scene"] = "idee",
            ["topic"] = "idee",
            ["color"] = "#e9a91f",
            ["final"] = new D { ["stage"] = 7 },
            ["title"] = T("Цагаан идээ хийх", "Make Mongolian dairy"),
            ["learned"] = A(
                T("Цагаан идээ гэж юу вэ: тараг, өрөм, ааруул, бяслаг, айраг", "What white foods are: yogurt, cream, aaruul, cheese, airag"),
                T("Тараг исгэх: буцалгах, бүлээн болтол хөргөх, хөрөнгө хийх", "Making yogurt: boil, cool to lukewarm, add starter"),
                T("Ааруулыг шахаж, наранд хатаадаг", "Aaruul is pressed and dried in the sun")
            ),
            ["desc"] = T("Үнээ саагаад сүүгээ буцалгаж, өрөм, тараг, ааруул хийцгээе.", "Milk the cow, boil the milk and make cream, yogurt and aaruul."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["stage"] = 0,
                    ["title"] = T("Цагаан идээ гэж юу вэ?", "What is “white food”?"),
                    ["text"] = T("Монголчууд зун сүүгээр тараг, өрөм, ааруул, бяслаг, шар тос, айраг хийдэг. Үүнийг цагаан идээ гэнэ. Цагаан сараар ширээний тэргүүнд тавьдаг.", "In summer Mongols make yogurt, cream, aaruul, cheese, butter and airag from milk. These are “white foods”, placed first on the Tsagaan Sar table."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["dir"] = "down",
                    ["alt"] = true,
                    ["n"] = 8,
                    ["icon"] = "✊",
                    ["label"] = T("Доош нь татаж саа", "Pull down to milk"),
                    ["title"] = T("1. Үнээгээ саа!", "1. Milk the cow!"),
                    ["text"] = T("Үхрийн дэлэнг атгаад доош нь тат. Хоёр гараараа ээлжлэн саана: зүүн, баруун, зүүн…", "Hold a teat and pull it down. Use both hands in turn: left, right, left…"),
                    ["altHint"] = T("Ээлжлэн саа! Одоо нөгөө талын дэлэнг тат.", "Take turns! Now pull the other teat."),
                    ["low"] = T("Доош нь бүр татаарай!", "Pull all the way down!"),
                    ["after"] = T("Хувин дүүрлээ! Саахдаа үнээгээ зөөлөн илж, аялгуулан дуулж тайвшруулдаг.", "The bucket is full! Herders stroke the cow and sing softly to keep her calm."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["dir"] = "up",
                    ["release"] = true,
                    ["need"] = 0.8,
                    ["n"] = 3,
                    ["field"] = "flick",
                    ["set"] = new D { ["tsatsal"] = true },
                    ["icon"] = "🥄",
                    ["label"] = T("Дээш цацах", "Flick up"),
                    ["title"] = T("Сүүний дээж өргө", "Offer the first milk"),
                    ["text"] = T("Шанагаар сүүний дээжийг авч тэнгэр өөд гурван удаа цацал өргө. Дээш нь шидэх шиг өргөөд тавиарай.", "Scoop the first milk and flick it up to the sky three times. Swing up and let go."),
                    ["low"] = T("Илүү өндөр өргө!", "Higher!"),
                    ["after"] = T("Цацал өргөхдөө сайн сайхныг ерөөдөг. Тэнгэр, газар, нутагтаа хүндэтгэл үзүүлж байгаа хэрэг.", "While offering, people wish for good things. It honours the sky, the land and home."),
                },
                new D
                {
                    ["type"] = "tap",
                    ["stage"] = 1,
                    ["n"] = 1,
                    ["drop"] = A(45, 35, 30, 16),
                    ["title"] = T("Сүүгээ тогоонд хийе", "Pour the milk into the pot"),
                    ["label"] = T("Сүү", "Milk"),
                    ["text"] = T("Саасан сүүгээ тогоо руу чирж хийгээрэй.", "Drag the fresh milk to the pot."),
                    ["after"] = T("Сайн байна! Одоо сүүгээ аажуухан халаая.", "Good! Now let’s warm the milk slowly."),
                },
                new D
                {
                    ["type"] = "hold",
                    ["stage"] = 1,
                    ["set"] = new D { ["tsatsal"] = false },
                    ["lo"] = 0.82,
                    ["hi"] = 0.97,
                    ["label"] = T("Гал түлэх (дараад барина)", "Heat (press and hold)"),
                    ["title"] = T("2. Сүүгээ буцалга", "2. Bring the milk to a boil"),
                    ["text"] = T("Товчийг дараад барь. Сүү буцлах үед (ногоон хэсэгт) тавиарай. Удаан барьвал сүү халина!", "Press and hold. Let go when the milk boils (green zone). Hold too long and it boils over!"),
                    ["after"] = T("Сайн байна! Халуун сүүг заавал том хүнтэй хамт буцалгаарай.", "Well done! Always boil hot milk with a grown-up."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 2,
                    ["dir"] = "up",
                    ["release"] = true,
                    ["need"] = 0.8,
                    ["n"] = 6,
                    ["icon"] = "🥄",
                    ["label"] = T("Шанагаа өргөөд тавь", "Lift the ladle, let go"),
                    ["title"] = T("3. Сүүгээ самра!", "3. Ladle the milk!"),
                    ["text"] = T("Шанагаар сүүгээ утгаад өндөрт өргөж цутга. Өндрөөс цутгах тусам хөөс их гарч, өрөм зузаан тогтоно.", "Scoop milk with the ladle, lift it high and pour. The higher you pour, the more foam and the thicker the cream."),
                    ["low"] = T("Арай намхан байна. Шанагаа өндөрт өргө!", "Too low. Lift the ladle higher!"),
                    ["after"] = T("Хонуулахад сүүний дээр өрөм тогтоно. Өрөмөөс шар тос хийдэг.", "Overnight cream (öröm) forms on top. Butter is made from it."),
                },
                new D
                {
                    ["type"] = "timing",
                    ["stage"] = 3,
                    ["lo"] = 0.3,
                    ["hi"] = 0.48,
                    ["label"] = T("Одоо!", "Now!"),
                    ["title"] = T("4. Бүлээн болтол хөргө", "4. Cool it to lukewarm"),
                    ["text"] = T("Сүү хөрч байна. Зүү ногоон “бүлээн” хэсэгт ирэхэд дар.", "The milk is cooling. Tap when the needle reaches the green “lukewarm” zone."),
                    ["after"] = T("Хуруу тэвчихүйц бүлээн байх ёстой. Хэт халуунд тараг исэхгүй.", "It should be finger-warm. Too hot and the yogurt won’t set."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 4,
                    ["title"] = T("5. Тараг исгэхийн тулд юу нэмэх вэ?", "5. What do we add to make yogurt?"),
                    ["text"] = T("Бүлээн сүүндээ…", "Into the warm milk goes…"),
                    ["options"] = A(
                        new D { ["t"] = T("Хөрөнгө (бага зэрэг хуучин тараг)", "Starter (a little old yogurt)"), ["ok"] = true },
                        new D { ["t"] = T("Давс", "Salt"), ["ok"] = false },
                        new D { ["t"] = T("Чихэр", "Sugar"), ["ok"] = false }
                    ),
                    ["after"] = T("Хөрөнгөнд байгаа сайн бактери сүүг тараг болгодог.", "Good bacteria in the starter turn milk into yogurt."),
                    ["drop"] = A(45, 35, 30, 16),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 5,
                    ["dir"] = "side",
                    ["n"] = 4,
                    ["icon"] = "👐",
                    ["label"] = T("Хөнжлөөр ороох", "Wrap it up"),
                    ["title"] = T("6. Дулаан боож хонуул", "6. Wrap it warm overnight"),
                    ["text"] = T("Тогоогоо дээл юм уу хөнжлөөр ороо: зүүн, баруун тийш 4 удаа чирж бүтэн ороогоод, шөнөжин дулаан газар тавина.", "Wrap the pot in a deel or blanket: drag left and right 4 times to wrap it all round, then leave it somewhere warm overnight."),
                    ["low"] = T("Бүр ороо!", "Wrap it all the way!"),
                    ["after"] = T("Өглөө боллоо — тараг бэлэн! 🌞", "Morning — the yogurt is ready! 🌞"),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 6,
                    ["dir"] = "down",
                    ["n"] = 4,
                    ["icon"] = "🪨",
                    ["label"] = T("Чулуугаар дарах", "Press with the stone"),
                    ["title"] = T("7. Ааруул хийцгээе", "7. Let’s make aaruul"),
                    ["text"] = T("Тарагаа халааж ээдэм гаргаад даавуунд хийнэ. Дээр нь хавтгай чулуу тавиад доош нь дарж усыг нь шахаж гаргана.", "Heat the yogurt until curds form and put them in a cloth. Lay a flat stone on top and press down to squeeze out the water."),
                    ["low"] = T("Хүчтэй дар!", "Press harder!"),
                },
                new D
                {
                    ["type"] = "drag",
                    ["dir"] = "down",
                    ["n"] = 3,
                    ["field"] = "mold",
                    ["set"] = new D { ["molding"] = true },
                    ["icon"] = "👐",
                    ["label"] = T("Хэвэнд дарах", "Press into the mould"),
                    ["title"] = T("Ааруулаа хэвэнд хийж дар", "Press the aaruul into a mould"),
                    ["text"] = T("Шахсан ээдмээ модон хэвэнд хийгээд гараараа доош нь дарж хэлбэржүүлнэ. Хэвний нүх бүрийг дүүргээрэй!", "Put the pressed curd into a wooden mould and push it down with your hands. Fill every hole!"),
                    ["low"] = T("Хүчтэй дар!", "Press harder!"),
                    ["after"] = T("Хэвний сийлсэн хээ ааруулан дээр тод гарна. Ааруулыг дөрвөлжин, дугуй, цэцэг хэлбэртэй хэвээр хийдэг.", "The carved pattern shows on each piece. Aaruul moulds come in squares, circles and flower shapes."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["stage"] = 7,
                    ["title"] = T("8. Ааруулаа хаана хатаах вэ?", "8. Where do we dry the aaruul?"),
                    ["text"] = T("Хэрчсэн ааруулаа…", "Cut the curd into pieces and…"),
                    ["options"] = A(
                        new D { ["t"] = T("Нар, салхинд", "In the sun and wind"), ["ok"] = true },
                        new D { ["t"] = T("Хөргөгчинд", "In the fridge"), ["ok"] = false },
                        new D { ["t"] = T("Усанд", "In water"), ["ok"] = false }
                    ),
                    ["after"] = T("Гэрийн дээвэр эсвэл тавиур дээр наранд хатаадаг. Хатуу, амттай ааруул бэлэн!", "Dried on the ger roof or a rack in the sun. Crunchy aaruul is ready!"),
                    ["drop"] = A(92, 0, 26, 22),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, хамтдаа тараг исгэцгээе!”", "“Mom, Dad, let’s make yogurt together!”"),
                ["what"] = T("Гэртээ жинхэнэ тараг исгэцгээе", "Make real yogurt at home"),
                ["materials"] = A(
                    T("1 литр сүү", "1 litre of milk"),
                    T("2 халбага тараг (хөрөнгө)", "2 spoons of yogurt (starter)"),
                    T("Таглаатай сав", "A pot with a lid"),
                    T("Алчуур эсвэл хөнжил", "A towel or blanket")
                ),
                ["steps"] = A(
                    T("Том хүн сүүг буцалгана.", "A grown-up boils the milk."),
                    T("Бүлээн болтол хөргөнө — хуруугаараа болгоомжтой шалгана.", "Cool it until lukewarm — test carefully with a finger."),
                    T("Хөрөнгөө хийж сайн хутгана.", "Stir in the starter."),
                    T("Таглаад дулаан боож 6–8 цаг байлгана.", "Cover, wrap it warm and wait 6–8 hours."),
                    T("Хөргөгчинд хөргөөд гэр бүлээрээ амсаарай!", "Chill it and taste it together!")
                ),
            },
        },
        new D
        {
            ["id"] = "customs",
            ["icon"] = "🙏",
            ["scene"] = "inside",
            ["topic"] = "customs",
            ["color"] = "#9466e0",
            ["final"] = new D {  },
            ["title"] = T("Гэрийн ёс заншил", "Ger manners"),
            ["learned"] = A(
                T("Хоймор, гал голомт, эрэгтэй ба эмэгтэй тал хаана байдаг", "Where the khoimor, hearth and men’s and women’s sides are"),
                T("Босго гишгэхгүй, нар зөв явах, баганын дундуур гарахгүй", "Don’t step on the threshold, move sunwise, don’t pass between the posts"),
                T("Ахмадад хоёр гараараа юм өгөх", "Hand things to elders with both hands")
            ),
            ["desc"] = T("Хоймор хаана вэ? Босго гишгэж болох уу? Гэрийн дотоод “газрын зураг”-ийг сур.", "Where is the khoimor? Can you step on the threshold? Learn the ger’s inside “map”."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Гэр бүр дотроо газрын зурагтай", "Every ger has a map inside"),
                    ["text"] = T("Монгол гэрт хүн бүр, эд зүйл бүр өөрийн байртай. Дээрээс харахад хаалга доор (урд), хоймор дээр (хойд) байна.", "In a ger every person and thing has its place. From above, the door is at the bottom (south) and the khoimor at the top (north)."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "door",
                    ["title"] = T("Гэрийн хаалга", "The ger door"),
                    ["text"] = T("Гэрийн хаалга урд зүг рүү харсан байдаг. Хаалгыг нь дар.", "The ger door faces south. Tap the door."),
                    ["after"] = T("Хаалганы доод модыг босго гэдэг. Босго гэрийн аз жаргалыг хамгаалдаг гэж үздэг.", "The wooden step at the bottom of the door is the threshold (bosgo). It is said to guard the home’s good fortune."),
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = false,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Гэрт орохдоо босго гишгэж болно.", "You may step on the threshold when entering."),
                    ["after"] = T("Босго гишгэх нь ёс бус. Босгыг алхаж давдаг.", "Stepping on the threshold is bad manners. Step over it."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "khoimor",
                    ["title"] = T("Хоймор хаана вэ?", "Where is the khoimor?"),
                    ["text"] = T("Ахмад настан, хүндтэй зочин суудаг хамгийн хүндэт газрыг дар.", "Tap the place of honour where elders and honoured guests sit."),
                    ["after"] = T("Хоймор хаалганы эсрэг талд, хойд хэсэгт байдаг.", "The khoimor is opposite the door, at the north."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "hearth",
                    ["title"] = T("Гал голомт хаана вэ?", "Where is the hearth?"),
                    ["text"] = T("Гэрийн зүрх болох галыг дар.", "Tap the fire, the heart of the ger."),
                    ["after"] = T("Гал голомт гэрийн яг голд байдаг. Гал руу хөлөө чиглүүлж, хог хаядаггүй.", "The hearth is in the very centre. Never point your feet at it or throw rubbish in it."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "west",
                    ["title"] = T("Эрэгтэй хүн, зочны тал", "The men’s and guests’ side"),
                    ["text"] = T("Уламжлалаар эмээл, хазаар байдаг, эрэгтэй хүн, зочин суудаг талыг дар.", "Tap the side where saddles are kept and men and guests sit."),
                    ["after"] = T("Баруун тал буюу орохдоо зүүн гар тал. Эмээл, хазаар энд байна.", "The west side — your left as you enter. Saddles and bridles are here."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "east",
                    ["title"] = T("Гал тогооны тал", "The kitchen side"),
                    ["text"] = T("Аяга таваг, тогоо байдаг талыг дар.", "Tap the side with bowls and pots."),
                    ["after"] = T("Зүүн тал буюу орохдоо баруун гар тал. Гэрийн эзэгтэйн тал.", "The east side — your right as you enter. The hostess’s side."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "west",
                    ["title"] = T("Гэр дотор ямар чигээр явах вэ?", "Which way do you walk inside?"),
                    ["text"] = T("Гэрт нар зөв (цагийн зүүний дагуу) алхана. Хаалгаар орж ирээд эхлээд аль тал руугаа явах вэ? Зураг дээр дар.", "In a ger you walk sunwise (clockwise), the way the sun goes. In through the door, which side do you go to first? Tap it in the picture."),
                    ["after"] = T("Зөв! Хаалгаар орж ирээд баруун тал, хоймор, тэгээд зүүн талаар нар зөв эргэнэ.", "Right! In through the door, along the west side, past the khoimor, then round the east side, like the sun."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "hearth",
                    ["title"] = T("Хоёр багана", "The two posts"),
                    ["text"] = T("Голомтын хажууд гэрийн тооныг тулсан хоёр багана бий. Тэдгээрийн дундуур хэзээ ч гарч болохгүй. Тэр газрыг дар.", "Beside the hearth, two posts hold up the toono. You must never walk between them. Tap that place."),
                    ["after"] = T("Тийм! Багана бол гэрийн тулгуур. Хоёр баганын дундуур гарахгүй, тойрч явдаг.", "Yes! The posts hold the ger up. Never cross between them: walk around."),
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Ахмад хүнд юм өгөхдөө баруун гараараа эсвэл хоёр гараараа өгнө.", "Hand things to elders with your right hand or both hands."),
                    ["after"] = T("Энэ бол хүндэтгэлийн тэмдэг.", "This is a sign of respect."),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Эмээ, өвөө өө, гэрийн ёс заншлаа надад заагаарай!”", "“Grandma, Grandpa, teach me our home customs!”"),
                ["what"] = T("Ахмадуудаасаа ёс заншил сурцгаая", "Learn customs from your elders"),
                ["materials"] = A(
                    T("Эмээ, өвөө эсвэл ээж, аав", "Grandma, Grandpa, Mom or Dad"),
                    T("Naadamy-ийн Дурсамжийн ном", "The Naadamy memory book")
                ),
                ["steps"] = A(
                    T("Гэртээ хоймор хаана байгааг хамт олоорой.", "Find where the khoimor is in your home."),
                    T("Ахмадад цайгаа хоёр гараараа өргөж дадлага хий.", "Practise offering tea to an elder with both hands."),
                    T("Тэднээс өөр ямар ёс заншил мэддэгийг асуу.", "Ask what other customs they know."),
                    T("Ярьсныг нь Дурсамжийн номонд бичиж, дуу хоолойг нь хадгал.", "Save their words and voice in the memory book.")
                ),
            },
        },
        new D
        {
            ["id"] = "nuuts",
            ["icon"] = "📜",
            ["scene"] = "story",
            ["topic"] = "nuuts",
            ["color"] = "#c8483c",
            ["final"] = new D { ["ch"] = "banner" },
            ["title"] = T("Нууц товчооны үлгэр", "Tales of the Secret History"),
            ["learned"] = A(
                T("Бөртэ чоно, Гуа марал: Нууц товчооны эхлэл", "Börte Chino and Gua Maral: how the Secret History begins"),
                T("Алан гуагийн таван сумны эв нэгдлийн сургаал", "Alan Gua’s five arrows lesson on unity"),
                T("Тэмүжиний бага нас ба 1206 онд Чингис хаан болсон нь", "Temüjin’s childhood and becoming Chinggis Khaan in 1206")
            ),
            ["desc"] = T("Бөртэ чоно, таван сумны сургаал, бяцхан Тэмүжин, Чингис хаан болсон түүх.", "The blue wolf, the five arrows, young Temüjin and how he became Chinggis Khaan."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "story",
                    ["ch"] = "wolf",
                    ["title"] = T("Бөртэ чоно, Гуа марал", "The blue wolf and the doe"),
                    ["text"] = T("“Монголын нууц товчоо” ингэж эхэлдэг: Дээр тэнгэрээс заяат төрсөн Бөртэ чоно, гэргий Гуа марал хоёр далайг гэтэлж ирээд Онон голын эх, Бурхан халдун ууланд нутаглажээ.", "The Secret History begins: Börte Chino, born with destiny from Heaven, and his wife Gua Maral crossed the waters and settled at the source of the Onon river, by Mount Burkhan Khaldun."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["ch"] = "wolf",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Нууц товчоонд гардаг монголчуудын домогт өвөг хэн бэ?", "Who are the legendary ancestors in the Secret History?"),
                    ["options"] = A(
                        new D { ["t"] = T("Бөртэ чоно, Гуа марал", "Börte Chino and Gua Maral"), ["ok"] = true },
                        new D { ["t"] = T("Арслан, бар", "A lion and a tiger"), ["ok"] = false },
                        new D { ["t"] = T("Луу, гарьд", "A dragon and a garuda"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "story",
                    ["ch"] = "arrows",
                    ["title"] = T("Таван сумны сургаал", "The five arrows"),
                    ["text"] = T("Алан гуа эх таван хүүдээ нэг нэг сум өгч “хугал” гэхэд тэд амархан хугалжээ. Дараа нь таван сумыг багцлан өгөхөд хэн ч хугалж чадсангүй. “Та нар салбал нэг сум шиг амархан хугарна. Эв нэгдэлтэй бол хэн ч дийлэхгүй” гэж сургажээ.", "Mother Alan Gua gave each of her five sons an arrow to break, and they snapped easily. Then she bound five together and no one could break them. “Apart you break like one arrow. Together no one can defeat you.”"),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["ch"] = "arrows",
                    ["dir"] = "down",
                    ["n"] = 1,
                    ["icon"] = "✊",
                    ["label"] = T("Сумаа хугал", "Snap the arrow"),
                    ["title"] = T("Нэг сумаа хугал", "Snap one arrow"),
                    ["text"] = T("Алан гоа эх хүү бүртээ нэг нэг сум өгчээ. Доош нь нугалж хугал!", "Mother Alan Gua gave each son one arrow. Bend it down and snap it!"),
                    ["low"] = T("Хүчтэй нугал!", "Bend it harder!"),
                    ["after"] = T("Хялбархан хугарлаа!", "It snapped easily!"),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["ch"] = "arrows",
                    ["broken"] = true,
                    ["set"] = new D { ["focus"] = "bundle" },
                    ["dir"] = "down",
                    ["n"] = 3,
                    ["icon"] = "💪",
                    ["label"] = T("Боодлыг хугал", "Break the bundle"),
                    ["title"] = T("Одоо таван сумыг хамт хугал", "Now break all five together"),
                    ["text"] = T("Таван сумыг нэг боодол болгон уяжээ. Хугалж чадах уу? 3 удаа оролдоорой!", "The five arrows are tied in one bundle. Can you break it? Try 3 times!"),
                    ["low"] = T("Хүчтэй нугал!", "Bend it harder!"),
                    ["after"] = T("Хугарсангүй! Ах дүүс эв нэгтэй байвал хэн ч хугалж чадахгүй гэж Алан гоа эх сургажээ.", "It won’t break! Alan Gua taught that brothers who stand together can’t be broken by anyone."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["ch"] = "arrows",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Таван сумны сургаал юуны тухай вэ?", "What is the five arrows lesson about?"),
                    ["options"] = A(
                        new D { ["t"] = T("Эв нэгдэл", "Unity"), ["ok"] = true },
                        new D { ["t"] = T("Хурдан гүйх", "Running fast"), ["ok"] = false },
                        new D { ["t"] = T("Баян болох", "Getting rich"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "story",
                    ["ch"] = "river",
                    ["title"] = T("Бяцхан Тэмүжин", "Young Temüjin"),
                    ["text"] = T("Тэмүжин Онон голын Дэлүүн болдогт төржээ. Аавыг нь хорлон алсны дараа тэдний гэр бүл ганцаардсан ч Өэлүн эх хүүхдүүдээ Онон голын загас, зэрлэг жимс, ургамлын үндсээр хооллож, зоригтой өсгөжээ.", "Temüjin was born at Delüün Boldog by the Onon river. After his father was poisoned the family was left alone, but mother Hö’elün raised her children bravely on fish, berries and wild roots."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["ch"] = "river",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Хэцүү үед Тэмүжиний гэр бүлийг хэн тэжээж өсгөсөн бэ?", "Who fed and raised Temüjin’s family in the hard times?"),
                    ["options"] = A(
                        new D { ["t"] = T("Өэлүн эх", "Mother Hö’elün"), ["ok"] = true },
                        new D { ["t"] = T("Жамуха", "Jamukha"), ["ok"] = false },
                        new D { ["t"] = T("Тоорил хан", "To’oril Khan"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "tap",
                    ["stage"] = 0,
                    ["ch"] = "river",
                    ["set"] = new D { ["layers"] = 0 },
                    ["field"] = "layers",
                    ["scale"] = 3,
                    ["n"] = 3,
                    ["drop"] = A(0, 60, 120, 14),
                    ["label"] = T("Загас барих", "Catch a fish"),
                    ["title"] = T("Онон голоос загас барь", "Fish in the Onon river"),
                    ["text"] = T("Хэцүү үед Тэмүжин дүү нартайгаа Онон голоос загас барьж ээждээ тусалдаг байжээ. Дэгээгээ гол руу 3 удаа чирж тавь!", "In the hard times Temüjin and his brothers fished in the Onon to help their mother. Drag the hook into the river 3 times!"),
                    ["after"] = T("Сайн байна! Өэлүн эх хүүхдүүдээ зэрлэг жимс, ногоо, загасаар тэжээн өсгөжээ.", "Well done! Mother Hö’elün raised her children on wild fruit, roots and fish."),
                },
                new D
                {
                    ["type"] = "story",
                    ["ch"] = "river",
                    ["title"] = T("Найз нөхөд", "True friends"),
                    ["text"] = T("Залуу Тэмүжин Тайчуудын олзонд орсон ч Сорхон шарын гэр бүл түүнийг ноосон тэргэнд нууж аварчээ. Тэрээр анд Жамуха, үнэнч нөхөр Боорчи нартайгаа хүчээ нэгтгэжээ.", "Young Temüjin was captured by the Tayichi’ud, but Sorkhan Shira’s family hid him in a cart of wool. He joined forces with his anda Jamukha and loyal friend Bo’orchu."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["ch"] = "banner",
                    ["dir"] = "up",
                    ["n"] = 3,
                    ["icon"] = "💪",
                    ["label"] = T("Тугаа өргө", "Raise the banner"),
                    ["title"] = T("Есөн хөлт цагаан тугаа мандуул!", "Raise the nine-footed white banner!"),
                    ["text"] = T("1206 онд Их хуралдайгаар есөн хөлт цагаан тугаа мандуулжээ. Дээш нь 3 удаа түлхэж тугаа өргө!", "At the Great Khuriltai of 1206 the nine-footed white banner was raised. Push up 3 times to raise it!"),
                    ["low"] = T("Илүү өндөр!", "Higher!"),
                },
                new D
                {
                    ["type"] = "story",
                    ["ch"] = "banner",
                    ["title"] = T("Чингис хаан", "Chinggis Khaan"),
                    ["text"] = T("1206 онд Онон голын эхэнд Их хурилдай хуралдаж, есөн хөлт цагаан туг мандуулан Тэмүжинийг Чингис хаан хэмээн өргөмжилж, Их Монгол Улсыг байгуулжээ.", "In 1206 the Great Khuriltai met at the source of the Onon, raised the nine-footed white banner, proclaimed Temüjin Chinggis Khaan and founded the Great Mongol State."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["ch"] = "banner",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Тэмүжинийг Чингис хаан хэмээн өргөмжилсөн хурилдай хэдэн онд болсон бэ?", "In which year was Temüjin proclaimed Chinggis Khaan?"),
                    ["options"] = A(
                        new D { ["t"] = T("1206", "1206"), ["ok"] = true },
                        new D { ["t"] = T("1162", "1162"), ["ok"] = false },
                        new D { ["t"] = T("1911", "1911"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "learn",
                    ["ch"] = "banner",
                    ["title"] = T("Нууц товчоо", "The Secret History"),
                    ["text"] = T("Ихэнх эрдэмтэд Нууц товчоог 1228 онд бичигдсэн гэж үздэг. 12 бүлэг, 282 зүйлтэй. Басараас илүү олон түүх асуугаарай!", "Most scholars date the Secret History to 1228. It has 12 chapters and 282 sections. Ask Basar for more stories!"),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, таван сумны сургаалыг туршиж үзье!”", "“Mom, Dad, let’s try the five arrows lesson!”"),
                ["what"] = T("Эв нэгдлийн туршилт", "The unity experiment"),
                ["materials"] = A(
                    T("5 нарийн хуурай мөчир эсвэл модон шорлог", "5 thin dry twigs or wooden skewers"),
                    T("Утас", "String")
                ),
                ["steps"] = A(
                    T("Хүн бүр нэг мөчир хугалж үзнэ — амархан!", "Everyone breaks one twig — easy!"),
                    T("Таван мөчрийг утсаар багцлаад хугалж үзнэ — хэцүү!", "Tie five together and try — hard!"),
                    T("Гэр бүлд эв нэгдэл яагаад чухал вэ гэж ярилцаарай.", "Talk about why unity matters in a family."),
                    T("Алан гуа эхийн түүхийг дүү, найздаа ярьж өгөөрэй.", "Tell Alan Gua’s story to a sibling or friend.")
                ),
            },
        },
        new D
        {
            ["id"] = "herd",
            ["icon"] = "🐑",
            ["scene"] = "herd",
            ["topic"] = "nomad",
            ["color"] = "#2ea35f",
            ["final"] = new D { ["sub"] = 1 },
            ["title"] = T("Таван хошуу мал", "The five herd animals"),
            ["learned"] = A(
                T("Таван хошуу мал: морь, үхэр, тэмээ, хонь, ямаа", "The five animals: horse, cattle, camel, sheep, goat"),
                T("Мал бүрийн өгдөг зүйл: айраг, ноос, ноолуур, сүү, хүч", "What each gives: airag, wool, cashmere, milk, strength"),
                T("Малчид жилд 4 удаа нүүдэг", "Herders move four times a year")
            ),
            ["desc"] = T("Морь, үхэр, тэмээ, хонь, ямаа: мал бүр малчин айлд юу өгдөг вэ?", "Horse, cattle, camel, sheep, goat: what does each give a herding family?"),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["set"] = new D { ["sub"] = 0.2 },
                    ["title"] = T("Малчдын баялаг", "The herders’ wealth"),
                    ["text"] = T("Монголчууд мянга мянган жил таван хошуу мал маллаж ирсэн. Мал бүр өөр өөр ашигтай.", "For thousands of years Mongols have herded five kinds of animals. Each one is useful in its own way."),
                },
                new D
                {
                    ["type"] = "tap",
                    ["n"] = 5,
                    ["field"] = "sub",
                    ["label"] = T("Мал авчрах", "Bring an animal"),
                    ["title"] = T("Малаа тоол!", "Count the herd!"),
                    ["text"] = T("Таван хошуу малаа бэлчээрт нь нэг нэгээр нь чирж авчир!", "Drag the five kinds of animals onto the pasture, one by one!"),
                    ["after"] = T("Морь, үхэр, тэмээ, хонь, ямаа: таван хошуу мал.", "Horse, cattle, camel, sheep, goat: the five animals."),
                    ["drop"] = A(0, 34, 120, 32),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "horse",
                    ["title"] = T("Айраг", "Airag"),
                    ["text"] = T("Айргийг аль малын сүүгээр хийдэг вэ? Зураг дээрээс дар.", "Airag is made from which animal’s milk? Tap it in the picture."),
                    ["after"] = T("Гүүний сүүгээр айраг, тэмээний сүүгээр хоормог хийдэг.", "Mare’s milk makes airag; camel’s milk makes khoormog."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "sheep",
                    ["title"] = T("Эсгий", "Felt"),
                    ["text"] = T("Гэрийн эсгий хийх ноосыг голдуу аль малаас авдаг вэ? Зураг дээрээс дар.", "The wool for ger felt mostly comes from which animal? Tap it in the picture."),
                    ["after"] = T("Хонины ноосыг дэвтээж, өнхрүүлж эсгий хийдэг.", "Sheep’s wool is wetted and rolled into felt."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "goat",
                    ["title"] = T("Ноолуур", "Cashmere"),
                    ["text"] = T("Зөөлөн ноолуурыг аль малаас самнаж авдаг вэ? Зураг дээрээс дар.", "Which animal gives soft cashmere? Tap it in the picture."),
                    ["after"] = T("Хавар ямааг самнаж ноолуур авдаг.", "In spring goats are combed for cashmere."),
                },
                new D
                {
                    ["type"] = "zones",
                    ["zone"] = "camel",
                    ["title"] = T("Говийн хөлөг", "Ship of the Gobi"),
                    ["text"] = T("Говьд хүнд ачаа зөөж, ус ундгүй удаан тэсдэг мал аль вэ? Зураг дээрээс дар.", "Which animal carries heavy loads and goes long without water in the Gobi? Tap it in the picture."),
                    ["after"] = T("Хоёр бөхтэй монгол тэмээг “говийн хөлөг” гэдэг.", "The two-humped Mongolian camel is called “the ship of the Gobi”."),
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Малчид жилд дөрвөн улирлын бууцанд нүүдэг.", "Herders move between four seasonal camps a year."),
                    ["after"] = T("Хаваржаа, зуслан, намаржаа, өвөлжөө.", "Spring, summer, autumn and winter camps."),
                },
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Морь бол далавч", "The horse is our wings"),
                    ["text"] = T("“Морь бол монгол хүний далавч” гэдэг. Монголд хүнээс олон адуу бий!", "They say “the horse is a Mongol’s wings”. Mongolia has more horses than people!"),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Өвөө, эмээ ээ, та нар ямар мал маллаж байсан бэ?”", "“Grandpa, Grandma, which animals did you herd?”"),
                ["what"] = T("Ахмадуудаасаа малын тухай асуух", "Ask your elders about their animals"),
                ["materials"] = A(
                    T("Өвөө, эмээ эсвэл ахмад хамаатан", "Grandparents or older relatives"),
                    T("Цаас, өнгийн харандаа", "Paper and coloured pencils")
                ),
                ["steps"] = A(
                    T("Тэд бага байхдаа ямар мал маллаж байсныг асуу.", "Ask which animals they herded as children."),
                    T("Хамгийн дуртай морь нь хэн гэдэг нэртэй байсныг асуу.", "Ask the name of their favourite horse."),
                    T("Таван хошуу малаа хамтдаа зураарай.", "Draw the five animals together."),
                    T("Түүхийг нь Дурсамжийн номонд бичээрэй.", "Save their story in the memory book.")
                ),
            },
        },
        new D
        {
            ["id"] = "tsagaansar",
            ["icon"] = "🥟",
            ["scene"] = "table",
            ["topic"] = "customs",
            ["color"] = "#e14b3d",
            ["final"] = new D { ["buuz"] = 10, ["layers"] = 5 },
            ["title"] = T("Цагаан сар", "Tsagaan Sar"),
            ["learned"] = A(
                T("Битүүнээр гэрээ цэвэрлэж, гэр бүлээрээ цуглардаг", "On Bituun, families clean the home and gather"),
                T("Ул боовыг сондгой давхраар өрдөг, бууз чимхдэг", "Ul boov is stacked in odd layers; families make buuz"),
                T("Золгохдоо хадаг барьж, ахмадын тохойг доороос түшдэг", "To greet elders, offer a khadag and support their elbows")
            ),
            ["desc"] = T("Бууз чимхэж, ул боов өрж, ахмадуудтайгаа хэрхэн золгохыг сур.", "Make buuz, stack ul boov and learn how to greet your elders."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Сар шинийн баяр", "Lunar New Year"),
                    ["text"] = T("Цагаан сар бол монголчуудын шинэ жил. Өвлийг үдэж, хаврыг угтдаг. Битүүний орой гэр бүлээрээ цуглаж, шинийн нэгэнд ахмадуудтайгаа золгодог.", "Tsagaan Sar is the Mongolian New Year, seeing off winter and welcoming spring. On the eve families gather, and on the first day they greet their elders."),
                },
                new D
                {
                    ["type"] = "tap",
                    ["n"] = 10,
                    ["field"] = "buuz",
                    ["scale"] = 10,
                    ["label"] = T("Бууз чимхэх", "Pinch a buuz"),
                    ["title"] = T("Бууз чимхье!", "Let’s make buuz!"),
                    ["text"] = T("Гэр бүлээрээ олон мянган бууз чимхдэг айл ч бий. 10 удаа дараарай!", "Some families make thousands of buuz together. Tap 10 times!"),
                    ["after"] = T("Сайхан бууз боллоо! Битүүний өмнө бүгд хамтдаа чимхдэг.", "Lovely buuz! Everyone makes them together before the holiday."),
                    ["drop"] = A(56, 43, 36, 13),
                },
                new D
                {
                    ["type"] = "hold",
                    ["lo"] = 0.8,
                    ["hi"] = 0.95,
                    ["label"] = T("Жигнэх (дараад барина)", "Steam (press and hold)"),
                    ["title"] = T("Буузаа жигнэ", "Steam the buuz"),
                    ["text"] = T("Буузаа жигнүүрт хийгээд товчийг дараад барь. Болсон үед (ногоон хэсэгт) тавь. Удаан барьвал ус нь буцлаад асгарна!", "Put the buuz in the steamer. Press and hold, and let go when they’re done (green zone). Too long and the water boils over!"),
                    ["over"] = T("Ой! Ус нь буцлаад асгарлаа. Дахиад оролдоё.", "Oops! The water boiled over. Try again."),
                    ["after"] = T("Амттай бууз боллоо! Цагаан сараар айл бүр олон зуун бууз чимхдэг.", "Delicious! At Tsagaan Sar every family makes hundreds of buuz."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Ул боов", "Ul boov"),
                    ["text"] = T("Ул боовыг ширээн дээр хэрхэн өрдөг вэ?", "How is ul boov stacked on the table?"),
                    ["options"] = A(
                        new D { ["t"] = T("Сондгой давхраар (3, 5, 7)", "In odd layers (3, 5, 7)"), ["ok"] = true },
                        new D { ["t"] = T("Тэгш давхраар (2, 4, 6)", "In even layers (2, 4, 6)"), ["ok"] = false },
                        new D { ["t"] = T("Ганцхан ширхэг", "Just one piece"), ["ok"] = false }
                    ),
                    ["after"] = T("Сондгой тоо өсөлт, сайн сайхныг бэлгэддэг гэдэг.", "Odd numbers are said to symbolise growth and good fortune."),
                    ["drop"] = A(18, 14, 32, 34),
                },
                new D
                {
                    ["type"] = "tap",
                    ["n"] = 5,
                    ["field"] = "layers",
                    ["scale"] = 5,
                    ["label"] = T("Давхарга өрөх", "Add a layer"),
                    ["title"] = T("Ул боовоо өрье", "Stack the ul boov"),
                    ["text"] = T("5 давхар ул боов өрөөд оройд нь цагаан идээ, чихэр тавина.", "Stack 5 layers and put dairy foods and sweets on top."),
                    ["drop"] = A(18, 14, 32, 34),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Битүүн", "Bituun"),
                    ["text"] = T("Битүүний орой юу хийдэг вэ?", "What do families do on the eve, Bituun?"),
                    ["options"] = A(
                        new D { ["t"] = T("Гэрээ цэвэрлэж, гэр бүлээрээ цуглардаг", "Clean the home and gather as a family"), ["ok"] = true },
                        new D { ["t"] = T("Ганцаараа унтдаг", "Sleep alone"), ["ok"] = false },
                        new D { ["t"] = T("Дэлгүүр хэсдэг", "Go shopping"), ["ok"] = false }
                    ),
                    ["after"] = T("Хуучин жилийн бүх зүйлийг цэгцэлж, шинэ жилийг цэвэр угтдаг.", "Everything is tidied so the new year starts fresh."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Золголт", "Greeting"),
                    ["text"] = T("Золгохдоо ахмадад юу барьдаг вэ?", "What do you offer an elder when greeting them?"),
                    ["options"] = A(
                        new D { ["t"] = T("Хадаг", "A khadag scarf"), ["ok"] = true },
                        new D { ["t"] = T("Ном", "A book"), ["ok"] = false },
                        new D { ["t"] = T("Бөмбөг", "A ball"), ["ok"] = false }
                    ),
                    ["after"] = T("Цэнхэр хадаг нь тэнгэр, хүндэтгэлийг бэлгэддэг.", "The blue khadag symbolises the sky and respect."),
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Золгохдоо залуу хүн ахмадын тохойг доороос нь түшдэг.", "When greeting, the younger person supports the elder’s elbows from below."),
                    ["after"] = T("Энэ нь ахмадаа түших, хүндлэхийн бэлгэдэл.", "It shows that you support and respect your elder."),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, хамтдаа бууз чимхэцгээе!”", "“Mom, Dad, let’s make buuz together!”"),
                ["what"] = T("Гэр бүлээрээ бууз чимхэж, золгох дадлага хийх", "Make buuz together and practise the greeting"),
                ["materials"] = A(T("Гурил, мах (том хүнтэй)", "Flour and meat (with a grown-up)"), T("Хадаг", "A khadag")),
                ["steps"] = A(
                    T("Том хүнтэй хамт гурилаа зуурч, махаа бэлдэнэ.", "With a grown-up, make the dough and filling."),
                    T("Хүн бүр бууз чимхэж үзнэ.", "Everyone tries pinching buuz."),
                    T("Хадаг барьж, ахмадын тохойг доороос түшиж золгох дадлага хийнэ.", "Practise the greeting: offer the khadag and support the elder’s elbows."),
                    T("Ахмадаасаа хуучин Цагаан сарын дурсамжийг асуугаарай.", "Ask your elders about Tsagaan Sar when they were young.")
                ),
            },
        },
        new D
        {
            ["id"] = "khuur",
            ["icon"] = "🎻",
            ["scene"] = "khuur",
            ["topic"] = "arts",
            ["color"] = "#7d57c4",
            ["final"] = new D { ["lit"] = 1 },
            ["title"] = T("Морин хуур ба уртын дуу", "Morin khuur & long song"),
            ["learned"] = A(
                T("Морин хуур хоёр утастай, морин толгойтой", "The morin khuur has two strings and a horse head"),
                T("Хөөрхөн Намжилын домог", "The legend of Khökhöö Namjil"),
                T("Уртын дуу, хөөмий, биелгээ, ёохор", "Long song, khöömii, biyelgee and yokhor")
            ),
            ["desc"] = T("Хөөрхөн Намжилын домог, морин хуур, уртын дуу, хөөмий, ардын бүжиг.", "The legend of Khökhöö Namjil, the horsehead fiddle, long song, throat singing and folk dance."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "story",
                    ["title"] = T("Хөөрхөн Намжилын домог", "The legend of Khökhöö Namjil"),
                    ["text"] = T("Эрт урьд цагт Хөөрхөн Намжил гэдэг залуу жигүүртэй хурдан морьтой байжээ. Морь нь үхэхэд Намжил ихэд гунигласан бөгөөд хайртай морио дурсан, түүний толгойн дүрсээр анхны морин хуурыг урласан гэдэг.", "Long ago a young man named Khökhöö Namjil had a swift, winged horse. When the horse died, Namjil grieved, and carved the first morin khuur in its memory, with a horse’s head."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Морин хуурын толгой ямар дүрстэй вэ?", "What shape is the head of the morin khuur?"),
                    ["options"] = A(
                        new D { ["t"] = T("Морь", "A horse"), ["ok"] = true },
                        new D { ["t"] = T("Луу", "A dragon"), ["ok"] = false },
                        new D { ["t"] = T("Арслан", "A lion"), ["ok"] = false }
                    ),
                    ["drop"] = A(52, 0, 16, 12),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Утас", "Strings"),
                    ["text"] = T("Морин хуур хэдэн утастай вэ?", "How many strings does the morin khuur have?"),
                    ["options"] = A(
                        new D { ["t"] = T("2", "2"), ["ok"] = true },
                        new D { ["t"] = T("4", "4"), ["ok"] = false },
                        new D { ["t"] = T("6", "6"), ["ok"] = false }
                    ),
                    ["after"] = T("Хоёр утсыг адууны сүүлний үсээр хийдэг уламжлалтай.", "Traditionally the two strings are made of horsetail hair."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["dir"] = "side",
                    ["alt"] = true,
                    ["n"] = 6,
                    ["field"] = "lit",
                    ["tone"] = true,
                    ["icon"] = "✋",
                    ["label"] = T("Хэлбэгээр татах", "Draw the bow"),
                    ["title"] = T("Хуураа хөгжимдье!", "Let’s play!"),
                    ["text"] = T("Хэлбэгээ утсан дээгүүр зүүн, баруун тийш ээлжлэн 6 удаа тат.", "Draw the bow across the strings, left and right in turn, 6 times."),
                    ["altHint"] = T("Хэлбэгээ нөгөө тийш нь тат!", "Now draw the bow the other way!"),
                    ["low"] = T("Хэлбэгээ урт татаарай!", "Draw the bow all the way!"),
                    ["after"] = T("Морин хуурын дууг “талын салхи”, “морины янцгаалах” дуутай зүйрлэдэг.", "The fiddle’s sound is compared to the steppe wind and a horse’s neigh."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Уртын дуу", "Long song"),
                    ["text"] = T("Уртын дууны онцлог юу вэ?", "What is special about the long song?"),
                    ["options"] = A(
                        new D { ["t"] = T("Удаан, сунжирсан аялгуутай", "Slow, long-stretched notes"), ["ok"] = true },
                        new D { ["t"] = T("Маш хурдан", "Very fast"), ["ok"] = false },
                        new D { ["t"] = T("Үггүй", "No words at all"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "hold",
                    ["lo"] = 0.82,
                    ["hi"] = 0.97,
                    ["label"] = T("Дуулах (дараад барина)", "Sing (press and hold)"),
                    ["title"] = T("Уртын дуу дуул", "Sing a long song"),
                    ["text"] = T("Уртын дууны нэг авиа маш удаан сунжирдаг. Товчийг дараад барьж дуул, ногоон хэсэгт хүрэхэд тавь. Хэт удаан барьвал амьсгаа чинь хүрэхгүй!", "In a long song one note stretches on and on. Press and hold to sing, and let go in the green zone. Hold too long and you run out of breath!"),
                    ["over"] = T("Амьсгаа хүрсэнгүй! Дахиад оролдоё.", "Out of breath! Let’s try again."),
                    ["after"] = T("Гоё сонсогдлоо! Уртын дуу нэг амьсгаагаар маш урт аялгуу дуулдаг.", "Beautiful! A long song carries a very long tune on a single breath."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Хөөмий", "Khöömii"),
                    ["text"] = T("Нэг хүн нэгэн зэрэг хоёр дуу авиа гаргадаг урлагийг юу гэдэг вэ?", "What is the art of singing two sounds at once called?"),
                    ["options"] = A(
                        new D { ["t"] = T("Хөөмий", "Khöömii"), ["ok"] = true },
                        new D { ["t"] = T("Биелгээ", "Biyelgee"), ["ok"] = false },
                        new D { ["t"] = T("Ёохор", "Yokhor"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Морин хуур, уртын дуу, хөөмий ЮНЕСКО-гийн биет бус өвд бүртгэлтэй.", "The morin khuur, long song and khöömii are on UNESCO’s intangible heritage list."),
                    ["after"] = T("Монголын соёлын өв дэлхийд хүлээн зөвшөөрөгдсөн.", "Mongolian heritage is recognised around the world."),
                },
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Ардын бүжиг", "Folk dance"),
                    ["text"] = T("Баруун Монголын биелгээг голдуу дээд биеэрээ бүжиглэдэг тул гэрийн бага зайд ч болдог. Буриадын ёохорыг гар гараасаа барьж тойрон бүжиглэдэг.", "Western Mongolia’s biyelgee uses mostly the upper body, so it fits inside a ger. The Buryat yokhor is danced holding hands in a circle."),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, хамтдаа уртын дуу сонсъё!”", "“Mom, Dad, let’s listen to a long song together!”"),
                ["what"] = T("Гэр бүлээрээ монгол хөгжим сонсох, бүжиглэх", "Listen to Mongolian music and dance together"),
                ["materials"] = A(T("Утас эсвэл радио", "A phone or radio"), T("Гэр бүлийн гишүүд", "Your family")),
                ["steps"] = A(
                    T("Морин хуурын аялгуу, уртын дуу хамтдаа сонсоорой.", "Listen to morin khuur music and a long song together."),
                    T("Өвөө, эмээгээсээ мэддэг дууг нь заалгаарай.", "Ask your grandparents to teach you a song they know."),
                    T("Гар гараасаа барьж ёохор шиг тойрон бүжиглээрэй.", "Hold hands and dance in a circle like the yokhor.")
                ),
            },
        },
        new D
        {
            ["id"] = "shagai",
            ["icon"] = "🦴",
            ["scene"] = "shagai",
            ["topic"] = "naadam",
            ["color"] = "#c98a4b",
            ["final"] = new D { ["sides"] = A("horse", "camel", "sheep", "goat") },
            ["title"] = T("Шагай наадам", "Shagai games"),
            ["learned"] = A(
                T("Шагай 4 талтай: морь, тэмээ, хонь, ямаа", "A shagai has 4 sides: horse, camel, sheep, goat"),
                T("Шагайгаар морь уралдуулах тоглоом", "The shagai horse-race game"),
                T("Шагай харваа 2014 онд ЮНЕСКО-д бүртгэгдсэн", "Knucklebone shooting was listed by UNESCO in 2014")
            ),
            ["desc"] = T("Шагай хаяж, морь уралдуулж, урт өвлийн оройн тоглоомуудыг сур.", "Roll knucklebones, race horses and learn the games of long winter evenings."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["set"] = new D { ["sides"] = A() },
                    ["title"] = T("Шагай гэж юу вэ?", "What is shagai?"),
                    ["text"] = T("Шагай бол хонины шагай. Хаяхад морь, тэмээ, хонь, ямаа гэсэн 4 талын нэгээр нь буудаг.", "Shagai are sheep anklebones. When thrown, each lands on one of 4 sides: horse, camel, sheep or goat."),
                },
                new D
                {
                    ["type"] = "tap",
                    ["n"] = 4,
                    ["roll"] = true,
                    ["label"] = T("Шагай шидэх", "Throw a shagai"),
                    ["title"] = T("Шагайгаа хая!", "Throw the bones!"),
                    ["text"] = T("Дөрвөн шагайгаа эсгий дээр нэг нэгээр нь чирж шид!", "Drag four shagai onto the felt, one by one, to throw them!"),
                    ["after"] = T("Аль талаар нь буусныг харж тоолоорой!", "See which side each one landed on!"),
                    ["drop"] = A(12, 12, 96, 44),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Асуулт", "Question"),
                    ["text"] = T("Шагай хэдэн талтай вэ?", "How many sides does a shagai have?"),
                    ["options"] = A(
                        new D { ["t"] = T("4", "4"), ["ok"] = true },
                        new D { ["t"] = T("2", "2"), ["ok"] = false },
                        new D { ["t"] = T("6", "6"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Морь уралдуулах", "Horse race game"),
                    ["text"] = T("“Морь уралдуулах” тоглоомд ямар тал буувал морио урагшлуулдаг вэ?", "In the horse-race game, which side moves your horse forward?"),
                    ["options"] = A(
                        new D { ["t"] = T("Морь", "Horse"), ["ok"] = true },
                        new D { ["t"] = T("Ямаа", "Goat"), ["ok"] = false },
                        new D { ["t"] = T("Тэмээ", "Camel"), ["ok"] = false }
                    ),
                    ["after"] = T("Хэдэн морь буусан тоогоор шагайн морио урагшлуулна.", "You move your shagai horse forward by the number of horse sides rolled."),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["set"] = new D { ["focus"] = "shoot" },
                    ["dir"] = "up",
                    ["release"] = true,
                    ["need"] = 0.7,
                    ["n"] = 3,
                    ["icon"] = "👆",
                    ["label"] = T("Шагай харвах", "Flick it"),
                    ["title"] = T("Шагай харваач!", "Knucklebone shooting!"),
                    ["text"] = T("Шагай харвааны үед модон тавцан дээгүүр жижиг “сум”-ыг хуруугаараа шувтлан харваж, цаадах шагайн байг унагадаг. Дээш татаад тавь!", "In knucklebone shooting you flick a small piece along a wooden board to knock down a target of shagai. Pull up and let go!"),
                    ["low"] = T("Илүү хүчтэй харва!", "Flick harder!"),
                    ["after"] = T("Онолоо! Шагай харвааг багаараа, дуу хөгжимтэй тоглодог.", "Hit! Knucklebone shooting is played in teams, with songs and cheering."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["title"] = T("Шагай харваа", "Knucklebone shooting"),
                    ["text"] = T("Шагай харвааг хэрхэн тоглодог вэ?", "How is knucklebone shooting played?"),
                    ["options"] = A(
                        new D { ["t"] = T("Шагайн сумыг няслан шагайн бай онох", "Flick a small piece to hit a target of shagai"), ["ok"] = true },
                        new D { ["t"] = T("Шагайг усанд шидэх", "Throw shagai into water"), ["ok"] = false },
                        new D { ["t"] = T("Шагайг өнхрүүлж гүйх", "Roll shagai and run"), ["ok"] = false }
                    ),
                    ["set"] = new D { ["focus"] = null },
                },
                new D
                {
                    ["type"] = "tf",
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Шагай харваа ЮНЕСКО-гийн биет бус өвд бүртгэлтэй.", "Knucklebone shooting is on UNESCO’s intangible heritage list."),
                    ["after"] = T("2014 онд бүртгэгдсэн.", "It was listed in 2014."),
                },
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Өвлийн оройн тоглоом", "Winter evening games"),
                    ["text"] = T("Урт өвлийн оройгоор гэр бүлээрээ шагай тоглож, тоо тоолж, хурдан сэтгэж сурдаг.", "On long winter evenings families play shagai, learning to count and think fast."),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, шагайгаар морь уралдуулъя!”", "“Mom, Dad, let’s race shagai horses!”"),
                ["what"] = T("Гэр бүлээрээ шагай тоглох", "Play shagai as a family"),
                ["materials"] = A(
                    T("4 шагай (эсвэл 4 талыг зурсан цаасан шоо)", "4 shagai (or paper cubes with the 4 sides drawn)"),
                    T("Морь болгох жижиг юм (товч, чулуу)", "Small tokens as horses (buttons, pebbles)")
                ),
                ["steps"] = A(
                    T("Хүн бүр нэг “морь” сонгоно.", "Everyone picks a “horse” token."),
                    T("Ээлжлэн 4 шагай хаяна.", "Take turns throwing the 4 shagai."),
                    T("Хэдэн морь буусан тоогоор морио урагшлуулна.", "Move forward by the number of horse sides."),
                    T("Барианд хамгийн түрүүнд хүрсэн нь ялна!", "First to the finish wins!")
                ),
            },
        },
        new D
        {
            ["id"] = "naadam",
            ["icon"] = "🏆",
            ["scene"] = "naadam",
            ["topic"] = "naadam",
            ["color"] = "#e9a91f",
            ["final"] = new D {  },
            ["title"] = T("Эрийн гурван наадам", "The three manly games"),
            ["learned"] = A(
                T("Наадам: бөх, морь уралдаан, сур харваа", "Naadam: wrestling, horse racing, archery"),
                T("Ялсан бөх гарьдын бүжиг хийдэг", "Winning wrestlers do the eagle dance"),
                T("Түрүү морийг айргаар цацаж, харвааны шүүгчид “уухай” гэдэг", "The winning horse is blessed with airag; archery judges sing “uukhai”")
            ),
            ["desc"] = T("Бөх, морь уралдаан, сур харвааны ёс заншил, сонирхолтой баримтууд.", "The customs and fun facts of wrestling, horse racing and archery."),
            ["steps"] = A(
                new D
                {
                    ["type"] = "learn",
                    ["set"] = new D { ["focus"] = null },
                    ["title"] = T("Улсын баяр наадам", "The national Naadam"),
                    ["text"] = T("Жил бүр 7-р сарын 11–13-нд эрийн гурван наадам болдог: бөх, морь уралдаан, сур харваа.", "Every year on July 11–13 the three manly games take place: wrestling, horse racing and archery."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["set"] = new D { ["focus"] = "bokh" },
                    ["title"] = T("Бөх", "Wrestling"),
                    ["text"] = T("Монгол бөх юу өмсдөг вэ?", "What do Mongolian wrestlers wear?"),
                    ["options"] = A(
                        new D { ["t"] = T("Зодог, шуудаг, гутал", "Zodog, shuudag and gutal boots"), ["ok"] = true },
                        new D { ["t"] = T("Цамц, өмд", "A shirt and trousers"), ["ok"] = false },
                        new D { ["t"] = T("Дээл, малгай", "A deel and hat"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["set"] = new D { ["focus"] = "bokh" },
                    ["dir"] = "side",
                    ["alt"] = true,
                    ["n"] = 4,
                    ["icon"] = "💪",
                    ["label"] = T("Түлх!", "Push!"),
                    ["title"] = T("Барилд!", "Wrestle!"),
                    ["text"] = T("Бөхчүүд бие биенийхээ мөрнөөс барьж барилдана. Зүүн, баруун тийш ээлжлэн түлхэж өрсөлдөгчөө унага!", "Wrestlers grip each other by the shoulders. Push left and right in turn to topple your rival!"),
                    ["altHint"] = T("Нөгөө тийш нь түлх!", "Push the other way!"),
                    ["low"] = T("Хүчтэй түлх!", "Push harder!"),
                    ["after"] = T("Унагалаа! Өвдөг, тохой газар хүрвэл унасанд тооцно.", "Down he goes! A wrestler loses when a knee or elbow touches the ground."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["set"] = new D { ["focus"] = "bokh" },
                    ["title"] = T("Бөх", "Wrestling"),
                    ["text"] = T("Ялсан бөх ямар бүжиг хийдэг вэ?", "What dance does the winner do?"),
                    ["options"] = A(
                        new D { ["t"] = T("Гарьдын (шонхорын) бүжиг", "The eagle dance"), ["ok"] = true },
                        new D { ["t"] = T("Ёохор", "Yokhor"), ["ok"] = false },
                        new D { ["t"] = T("Вальс", "Waltz"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "drag",
                    ["set"] = new D { ["focus"] = "bokh" },
                    ["field"] = "flick",
                    ["dir"] = "up",
                    ["alt"] = true,
                    ["n"] = 4,
                    ["icon"] = "👐",
                    ["label"] = T("Далавчаа дэлгэ", "Spread your wings"),
                    ["title"] = T("Бүргэдийн жүжиг", "The eagle dance"),
                    ["text"] = T("Ялсан бөх бүргэд шиг далавчаа дэлгэн дэвж бүжиглэдэг. Хоёр гараа ээлжлэн дээш дэв!", "The winner dances with his arms spread like an eagle’s wings. Flap them up, left and right in turn!"),
                    ["altHint"] = T("Нөгөө далавчаа!", "The other wing!"),
                    ["low"] = T("Өндөр дэв!", "Flap higher!"),
                },
                new D
                {
                    ["type"] = "pick",
                    ["set"] = new D { ["focus"] = "horse" },
                    ["title"] = T("Морь уралдаан", "Horse racing"),
                    ["text"] = T("Наадмын морь уралдаанд хэн унадаг вэ?", "Who rides in Naadam horse races?"),
                    ["options"] = A(
                        new D { ["t"] = T("Хүүхэд унаачид", "Child jockeys"), ["ok"] = true },
                        new D { ["t"] = T("Өвөө нар", "Grandfathers"), ["ok"] = false },
                        new D { ["t"] = T("Бөхчүүд", "Wrestlers"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "drag",
                    ["stage"] = 0,
                    ["set"] = new D { ["focus"] = "horse" },
                    ["dir"] = "down",
                    ["alt"] = true,
                    ["n"] = 6,
                    ["icon"] = "✊",
                    ["label"] = T("Морио хурдлуул", "Urge the horse on"),
                    ["title"] = T("Уралдаа!", "Race!"),
                    ["text"] = T("Хүүхэд уяачид “Гийнгоо!” гэж дуулж морио хурдлуулдаг. Жолоогоо зүүн, баруун гараараа ээлжлэн сэгсэр!", "Child jockeys sing “Giingoo!” to urge their horses on. Shake the reins with your left and right hands in turn!"),
                    ["altHint"] = T("Нөгөө гараараа!", "Other hand!"),
                    ["low"] = T("Хүчтэй!", "Harder!"),
                    ["after"] = T("Түрүүллээ! Наадмын хурдан морины уралдаан 10–28 км зайд явагддаг.", "You won! Naadam horse races run 10 to 28 km across the steppe."),
                },
                new D
                {
                    ["type"] = "pick",
                    ["set"] = new D { ["focus"] = "horse" },
                    ["title"] = T("Түрүү морь", "The winning horse"),
                    ["text"] = T("Түрүүлсэн морийг юугаар цацаж ерөөдөг вэ?", "What is sprinkled on the winning horse as a blessing?"),
                    ["options"] = A(
                        new D { ["t"] = T("Айраг", "Airag"), ["ok"] = true },
                        new D { ["t"] = T("Ус", "Water"), ["ok"] = false },
                        new D { ["t"] = T("Элс", "Sand"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "timing",
                    ["stage"] = 0,
                    ["set"] = new D { ["focus"] = "archer" },
                    ["lo"] = 0.45,
                    ["hi"] = 0.6,
                    ["label"] = T("Харва!", "Shoot!"),
                    ["title"] = T("Сур харваа", "Archery"),
                    ["text"] = T("Нумаа татаад зүү ногоон хэсэгт ирэхэд “Харва!” дар.", "Draw the bow and tap “Shoot!” when the needle reaches the green zone."),
                    ["after"] = T("Онолоо!", "A hit!"),
                },
                new D
                {
                    ["type"] = "pick",
                    ["set"] = new D { ["focus"] = "archer" },
                    ["title"] = T("Сур харваа", "Archery"),
                    ["text"] = T("Бай онох бүрт шүүгчид юу гэж дуулдаг вэ?", "What do the judges sing at every hit?"),
                    ["options"] = A(
                        new D { ["t"] = T("Уухай!", "Uukhai!"), ["ok"] = true },
                        new D { ["t"] = T("Чү!", "Chü!"), ["ok"] = false },
                        new D { ["t"] = T("Баяртай!", "Goodbye!"), ["ok"] = false }
                    ),
                },
                new D
                {
                    ["type"] = "tf",
                    ["set"] = new D { ["focus"] = null },
                    ["answer"] = true,
                    ["title"] = T("Зөв үү, буруу юу?", "True or false?"),
                    ["text"] = T("Наадам 2010 онд ЮНЕСКО-д бүртгэгдсэн.", "Naadam was listed by UNESCO in 2010."),
                    ["after"] = T("Наадмыг дэлхий нийт хүндэлдэг.", "Naadam is honoured around the world."),
                },
                new D
                {
                    ["type"] = "learn",
                    ["title"] = T("Нутагт туршаад үз!", "Try it in Nutag!"),
                    ["text"] = T("Нутгийн Наадмын талбайд бөх барилдаж, морины уяанаас уралдаж, сурын талбайд харваарай!", "Wrestle at the arena, race from the horse line and shoot at the archery range in Nutag!"),
                }
            ),
            ["family"] = new D
            {
                ["say"] = T("“Ээж, аав аа, гэртээ жижиг наадам хийцгээе!”", "“Mom, Dad, let’s hold a little Naadam at home!”"),
                ["what"] = T("Гэр бүлийн жижиг наадам", "A family mini-Naadam"),
                ["materials"] = A(
                    T("Олс эсвэл алчуур", "A rope or towel"),
                    T("Цаасан бай, зөөлөн бөмбөг", "A paper target and a soft ball")
                ),
                ["steps"] = A(
                    T("“Бөх”: олс таталтаар хүчээ үзнэ.", "“Wrestling”: a tug-of-war."),
                    T("“Морь”: гэрийн гадаа уралдаж гүйнэ.", "“Horse race”: a running race outside."),
                    T("“Сур”: зөөлөн бөмбөгөөр цаасан бай онооно.", "“Archery”: hit a paper target with a soft ball."),
                    T("Ялагч гарьдын бүжиг хийнэ, бусад нь “Уухай!” гэнэ.", "The winner does the eagle dance; everyone else shouts “Uukhai!”")
                ),
            },
        }
    ));
}
