// Нутаг rules, ported from js/village/rules.js and village.js (the хот айл dairy yard, levels, daily quests).
using System.Collections.Generic;

public static partial class Rules
{
    public const int W = 56, H = 40, LOTS = 8;
    public const float ENERGY_MAX = 100;

    // The herding and dairy yard (хот айл): animals you milk, and the white foods (цагаан идээ) you make from the milk.
    // wait = seconds before the same animal can be milked again.
    public sealed class Animal { public string kind, gives; public Tx name, young, fact; public int n, wait; }
    public static readonly Dictionary<string, Animal> DAIRY_ANIMALS = new Dictionary<string, Animal>
    {
        ["cow"] = new Animal { kind = "cow", name = new Tx("Үнээ", "Cow"), gives = "milk", n = 2, wait = 90, young = new Tx("Тугал", "Calf"),
            fact = new Tx("Үнээг өглөө, орой саадаг. Саахын өмнө тугалыг нь бага зэрэг хөхүүлж сүүг нь ивлүүлдэг.", "Cows are milked morning and evening. First the calf suckles a little so the milk starts to flow.") },
        ["goat"] = new Animal { kind = "goat", name = new Tx("Ямаа", "Goat"), gives = "milk", n = 1, wait = 60, young = new Tx("Ишиг", "Kid"),
            fact = new Tx("Ямааны сүү өтгөн, тэжээллэг. Ямаа, хонины сүүгээр ааруул, бяслаг хийдэг.", "Goat milk is rich and nourishing. Goat and sheep milk make aaruul and cheese.") },
        ["mare"] = new Animal { kind = "mare", name = new Tx("Гүү", "Mare"), gives = "mare", n = 1, wait = 75, young = new Tx("Унага", "Foal"),
            fact = new Tx("Зун гүүг 1.5–2 цаг тутам, өдөрт олон удаа саадаг. Унагыг нь зэлд уяж, саахын өмнө хөхүүлж сүүг ивлүүлдэг.", "In summer mares are milked every 1.5–2 hours, many times a day. Their foals wait on the зэл line and suckle first to start the milk.") },
    };

    public sealed class Dairy { public string id; public Tx name; public int sell, energy; public bool food; }
    public static readonly Dictionary<string, Dairy> DAIRY = new Dictionary<string, Dairy>
    {
        ["milk"] = new Dairy { id = "milk", name = new Tx("Сүү", "Milk"), sell = 4 },
        ["mare"] = new Dairy { id = "mare", name = new Tx("Гүүний сүү", "Mare’s milk"), sell = 5 },
        ["aaruul"] = new Dairy { id = "aaruul", name = new Tx("Ааруул", "Aaruul"), sell = 9, food = true, energy = 10 },
        ["urum"] = new Dairy { id = "urum", name = new Tx("Өрөм", "Öröm cream"), sell = 12, food = true, energy = 15 },
        ["tarag"] = new Dairy { id = "tarag", name = new Tx("Тараг", "Tarag yogurt"), sell = 8, food = true, energy = 15 },
        ["airag"] = new Dairy { id = "airag", name = new Tx("Айраг", "Airag"), sell = 14, food = true, energy = 20 },
    };
    public static readonly string[] DAIRY_ORDER = { "milk", "mare", "aaruul", "urum", "tarag", "airag" };

    // recipes at each station: what milk they need, what they give, the real steps, and how you do them
    public sealed class Recipe { public string id; public Dictionary<string, int> need; public int gives, taps; public bool mash; public Tx verb, fact; public Tx[] steps; }
    public static readonly Dictionary<string, Recipe[]> RECIPES = new Dictionary<string, Recipe[]>
    {
        ["rack"] = new[] { new Recipe { id = "aaruul", need = new Dictionary<string, int> { ["milk"] = 2 }, gives = 3,
            steps = new[] { new Tx("Сүүгээ исгэж тараг болгоно", "Let the milk sour into tarag"), new Tx("Тарагаа буцалгаж ээдэм гаргана", "Boil it until curds (ээдэм) form"), new Tx("Ээдмээ даавуунд хийж шахна", "Press the curds in a cloth"), new Tx("Хэрчиж хэлбэр оруулна", "Cut them into pieces"), new Tx("Тавиур дээр наранд хатаана", "Dry them in the sun on the rack") },
            fact = new Tx("Ааруулыг наранд хэд хоног хатаадаг. Хатсан ааруул бүтэн жил хадгалагддаг тул өвөл, аянд авч явдаг.", "Aaruul dries in the sun for several days. Dried, it keeps for a whole year, so herders take it on journeys and through winter.") } },
        ["tulga"] = new[] {
            new Recipe { id = "urum", need = new Dictionary<string, int> { ["milk"] = 2 }, gives = 1, mash = true, taps = 12, verb = new Tx("Самрах", "Ladle"),
                steps = new[] { new Tx("Сүүгээ бага галд аажмаар буцалгана", "Heat the milk slowly on a low fire"), new Tx("Шанагаар дээш өргөж самарна: хөөс гарна", "Ladle it up high so it foams"), new Tx("Шөнөжин хөргөнө, дээр нь өрөм тогтоно", "Leave it overnight: the öröm forms on top") },
                fact = new Tx("Өрөм бол сүүг зөөлөн буцалгаж, самраад, хөргөхөд дээр нь тогтдог өтгөн цөцгий. Цагаан сараар хамгийн хүндэт зочинд өргөдөг.", "Öröm is the thick cream that forms on top of gently boiled, ladled and cooled milk, offered to honoured guests at Tsagaan Sar.") },
            new Recipe { id = "tarag", need = new Dictionary<string, int> { ["milk"] = 1 }, gives = 2,
                steps = new[] { new Tx("Сүүгээ буцалгана", "Boil the milk"), new Tx("Бүлээн болтол хөргөнө", "Let it cool until warm"), new Tx("Хөрөнгө нэмнэ: өмнөх тарагнаас жаахан", "Add a starter: a little old tarag"), new Tx("Дулаан газар хононо", "Keep it warm overnight") },
                fact = new Tx("Тарагны “хөрөнгө”-ийг айлууд үеэс үед хадгалж, бие биедээ өгдөг.", "Families keep their tarag starter for generations and share it with each other.") } },
        ["churn"] = new[] { new Recipe { id = "airag", need = new Dictionary<string, int> { ["mare"] = 2 }, gives = 2, mash = true, taps = 30, verb = new Tx("Бүлэх", "Churn"),
            steps = new[] { new Tx("Гүүний сүүгээ хөхүүрт хийнэ", "Pour the mare’s milk into the khukhuur"), new Tx("Бүлүүрээр олон дахин бүлнэ", "Churn it with the stick, again and again"), new Tx("Нэг хоног исгэнэ", "Let it ferment for a day") },
            fact = new Tx("Айргийг мянга гаруй удаа бүлдэг. Айлд орж ирсэн хүн бүр хэдэн удаа бүлээд өгдөг заншилтай.", "Airag is churned over a thousand times, and everyone who comes into the ger gives it a few stirs.") } },
    };

    /** Level from total XP: level 2 at 60 XP, each next level needs 40 more than the last. */
    public static (int l, int cur, int need) Level(int xp)
    {
        int l = 1, need = 60, rest = xp < 0 ? 0 : xp;
        while (rest >= need) { rest -= need; l++; need = 60 + (l - 1) * 40; }
        return (l, rest, need);
    }
}
