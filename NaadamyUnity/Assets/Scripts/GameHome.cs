// Your own ger: build it on a lot in the ger neighbourhood, pick its colours, furnish it, and walk around inside.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    static void Swatches(Game g, Dictionary<string, string> map, string cur, System.Action<string> pick)
    {
        GUILayout.BeginHorizontal();
        foreach (var kv in map) if (g.Swatch(Px.Col(kv.Value), cur == kv.Key)) { var k = kv.Key; g.Later(() => pick(k)); }
        GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
    }
    /** Decorate: buy furniture, change colours, rest. */
    sealed class HomeModal : Modal
    {
        public override float Width => 560;
        Vector2 scroll;
        public override void Draw(Game g)
        {
            var V = g.V; var l = V.lot; string today = SaveData.DayKey(); bool rested = V.rest == today;
            g.Title(Loc.L("Гэрээ тохижуулах", "Decorate my ger"));
            g.Picture(Px.Interior(Px.ROOF[l.roof], l.furn), 130);
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Хувцас", "Wardrobe"))) g.Later(() => g.Open(new WardrobeModal()));
            if (g.Btn(rested ? Loc.L("Өнөөдөр амарсан", "Rested today") : Loc.L("Амрах", "Rest"), true, 40, !rested)) g.Later(() => { V.rest = today; V.energy = Rules.ENERGY_MAX; V.Save(); g.Reward(5, 10); Sfx.Chime(); g.Toast(Loc.L("Гэртээ амарлаа: +10 XP, хүч дүүрлээ.", "You rested at home: +10 XP, energy full.")); });
            GUILayout.EndHorizontal();
            GUILayout.Label(Loc.L("Тавилга", "Furniture"), g.sSmall);
            scroll = g.BeginScroll(scroll, Screen.height * 0.3f);
            foreach (var f in Rules.FURNITURE)
            {
                bool owned = l.furn.Contains(f.id), locked = g.Lvl < f.lvl;
                g.Row(Px.Icon("furn:" + f.id), f.name.ToString(), f.fact.ToString(), locked && !owned);
                if (owned) GUILayout.Label("√", g.sTitle, GUILayout.Width(g.U(40)));
                else if (locked) GUILayout.Label(Loc.L("Түвшин ", "Lv ") + f.lvl, g.sSmall, GUILayout.Width(g.U(70)));
                else if (g.SmallBtn(f.price.ToString())) { var ff = f; g.Later(() => { if (!g.Pay(ff.price)) return; l.furn.Add(ff.id); V.Save(); }); }
                g.EndRow();
            }
            g.EndScroll();
            GUILayout.Label(Loc.L("Өнгө солих (үнэгүй)", "Change colours (free)"), g.sSmall);
            Swatches(g, Px.ROOF, l.roof, k => { l.roof = k; V.Save(); g.net.StyleGer(l.roof, l.door, l.furn); });
            Swatches(g, Px.DOOR, l.door, k => { l.door = k; V.Save(); g.net.StyleGer(l.roof, l.door, l.furn); });
            if (g.Btn(Loc.L("Хаах", "Close"), false, 30)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }

    /** Inside your own ger: walk around and use the furniture. */
    void EnterGer()
    {
        var l = V.lot; var room = Px.GerRoom(Px.ROOF[l.roof], Px.DOOR[l.door], l.furn); const int cx = Px.ROOM_CX;
        bool Has(string id) => l.furn.Contains(id);
        float steam = -9, zzz = -9, notes = -9, churn = -9, zx = 0;
        var sc = new WalkScene { W = Px.ROOM_W, H = Px.ROOM_H, look = V.look, speed = 62, title = Loc.L("Миний гэр", "My ger"), sub = $"{l.furn.Count}/{Rules.FURNITURE.Length} {Loc.L("тавилга", "furniture")}", free = room.free,
            info = Loc.L("Гэртээ тавтай морил! Босгыг алхаж давлаа. Тавилга руу ойртоод E дар, Space дарвал үсэрнэ.", "Welcome home! You stepped over the threshold. Walk up to things and press E. Space makes you jump.") };
        sc.Start(cx, 186);
        Thing Spot(string id, float x, float y, string mn, string en, System.Action run) => new Thing { id = id, x = x, y = y, label = () => Loc.L(mn, en), run = run };
        sc.things.AddRange(new[]
        {
            Spot("door", cx, 192, "Гарах", "Go outside", () => Close()),
            Spot("khoimor", cx, 105, "Хойморт суух", "Sit in the khoimor", () => sc.Say(Loc.L("Хоймор бол гэрийн хамгийн хүндэт газар. Гэр бүлийн шүтээн, зураг энд байдаг. Ахмад хүн, хүндтэй зочныг хойморт урьдаг.", "The khoimor, opposite the door, is the place of honour. The family shrine and photos are kept here, and elders and honoured guests are invited to sit here."))),
            Spot("table", 138, 118, "Хоол идэх", "Eat a meal", () => { sc.Say(Rules.Pick(Rules.SNACKS).ToString()); if (V.DayOnce("snack")) Reward(0, 5); Open(new FoodModal("meat", true)); }),
            Spot("bagana", 184, 132, "Баганыг харах", "Look at the posts", () => sc.Say(Loc.L("Хоёр багана тоноо даадаг. Хоёр баганын дундуур гарч болохгүй, баганыг түшиж болохгүй гэдэг ёс бий.", "The two bagana posts hold up the toono. By custom you never walk between the two posts and never lean on them."))),
            Spot("toono", 132, 168, "Тооно руу харах", "Look up at the toono", () => sc.Say(Loc.L("Тооноор тусах нарны гэрэл униар гулсаж явдгаар малчид цагийг мэддэг байжээ. Тооно бол гэрийн нар цаг!", "Herders told the time by the patch of sunlight from the toono creeping across the roof poles. The toono is the ger’s sun clock!"))),
            Spot("saddle", 90, 176, "Эмээл үзэх", "Look at the saddle", () => sc.Say(Loc.L("Баруун тал бол эрэгтэй хүний тал: эмээл, хазаар, уурга энд байна. Монгол эмээл өндөр бүүрэгтэй, мөнгөн товруудтай.", "The west side is the men’s side: the saddle, bridle and lasso pole live here. A Mongol saddle has a high front and back and silver studs."))),
            Spot("khukhuur", 60, 158, "Айраг бүлж уух", "Churn and drink airag", () => { churn = Time.time; Sfx.Pour(0.3f); Eat("airag", true); sc.Say(Loc.L("Хөхүүрт гүүний сүүг мянга гаруй удаа бүлж айраг исгэдэг. Гэрт орж ирсэн хүн бүр бүлүүрээр хэдэн удаа бүлээд өгдөг заншилтай!", "Mare’s milk is churned more than a thousand times in the khukhuur to make airag. Everyone who comes in gives it a few stirs!")); if (V.DayOnce("churn")) Reward(0, 5); }),
            Spot("cupboard", 244, 178, "Цай уух", "Have some milk tea", () => { sc.Say(Loc.L("Зүүн тал бол эмэгтэй хүний тал: аяга таваг, тогоо шанага, хоол хүнс энд байдаг. Зочинд цайг баруун гараараа өргөдөг.", "The east side is the women’s side: bowls, pots, ladles and food are kept here. Tea is offered with the right hand.")); Eat("tsai", true); }),
            Spot("water", 210, 190, "Ус уух", "Drink some water", () => { Eat("us", true); sc.Say(Loc.L("Усыг худаг, булгаас зөөж авчирдаг. Усыг хэзээ ч бохирдуулдаггүй, хайрлан гамнадаг.", "Water is carried in from the well or spring. It is never wasted or made dirty.")); }),
        });
        if (Has("tulga")) sc.things.Add(Spot("tulga", cx, 158, "Цай чанах", "Make milk tea", () => { steam = Time.time; Sfx.Pour(0.6f); sc.Say(Rules.Pick(Rules.GER_TEA).ToString()); if (V.DayOnce("tea")) Reward(5, 10); }));
        else sc.things.Add(Spot("tulga", cx, 158, "Голомт", "The hearth", () => sc.Say(Loc.L("Гал голомт бол гэрийн зүрх. Тулга авбал энд цай чанаж болно.", "The hearth is the heart of the ger. Get a stove and you can make tea here."))));
        if (Has("or")) foreach (var bx in new[] { 48f, 272f }) sc.things.Add(Spot("or" + bx, bx, 140, "Унтаж амрах", "Sleep and rest", () =>
        {
            zzz = Time.time; zx = bx; Sfx.Chime(); string today = SaveData.DayKey();
            if (V.rest != today) { V.rest = today; V.energy = Rules.ENERGY_MAX; V.Save(); Reward(5, 10); sc.Say(Loc.L("Сайхан амарлаа! Хүч бүрэн дүүрч, +10 XP.", "A good rest! Energy full again, +10 XP.")); }
            else sc.Say(Loc.L("Өнөөдөр аль хэдийн амарсан. Маргааш дахин унтаарай.", "You already rested today. Sleep again tomorrow."));
        }));
        if (Has("avdar")) sc.things.Add(Spot("avdar", 206, 106, "Авдраа нээх", "Open the chest", () => Open(new ChestModal())));
        if (Has("morinkhuur")) sc.things.Add(Spot("morinkhuur", 104, 110, "Морин хуур тоглох", "Play the morin khuur", () => { notes = Time.time; Sfx.Melody(); sc.Say(Loc.L("Морин хуурын аялгуу гэрийг дүүргэлээ. Морин хуурыг хойморын баруун талд хүндэтгэн байрлуулдаг.", "The fiddle’s tune fills the ger. The morin khuur is honoured with a place on the west of the khoimor.")); if (V.DayOnce("music")) Reward(0, 8); }));
        if (Has("shirdeg")) sc.things.Add(Spot("shirdeg", 96, 150, "Басартай суух", "Sit with Basar", () => sc.Say(Rules.Pick(Basar.FACTS).ToString())));
        if (Has("shagai")) sc.things.Add(Spot("shagai", 214, 170, "Шагай хаях", "Throw shagai", () =>
        {
            string[] S4 = { Loc.L("морь", "horse"), Loc.L("тэмээ", "camel"), Loc.L("хонь", "sheep"), Loc.L("ямаа", "goat") };
            var roll = Enumerable.Range(0, 4).Select(_ => Random.Range(0, 4)).ToArray(); int horses = roll.Count(r => r == 0);
            Sfx.Tap();
            sc.Say(string.Join(" · ", roll.Select(r => S4[r])) + "  —  " + (horses == 4 ? Loc.L("Дөрвөн морь! Маш ховор!", "Four horses! Very rare!") : Loc.L($"{horses} морь буулаа.", $"{horses} horse side(s).")));
            if (horses == 4 && V.DayOnce("shagai4")) Reward(20, 20);
        }));
        int missing = Rules.FURNITURE.Count(f => !Has(f.id));
        sc.buttons.Add((() => Loc.L("Тохижуулах", "Decorate") + (missing > 0 ? $" ({missing})" : ""), () => Open(new HomeModal())));
        sc.buttons.Add((() => Loc.L("Хувцас", "Wardrobe"), () => Open(new WardrobeModal())));
        sc.drawBg = (b, t) => b.Blit(room.bg, 0, 0);
        sc.ents = t => room.props.Select(p => new Ent { y = p.b, f = b => b.Blit(p.c, p.x, p.y) }).ToList();
        sc.drawTop = (b, t) =>
        {
            if (t - steam < 3) for (int k = 0; k < 5; k++) { float q = (t / 0.9f + k / 5f) % 1; Px.R(b, Js.Round(cx - 3 + Mathf.Sin(t / 0.3f + k) * 4), Js.Round(128 - q * 28), 2, 2, "rgba(255,255,255," + (0.75f - q * 0.6f).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) + ")"); }
            if (t - zzz < 2.5f) { Px.R(b, zx - 4, 116 - ((t / 0.06f) % 14), 3, 3, "#ffffff"); Px.R(b, zx + 3, 108 - ((t / 0.05f) % 16), 4, 4, "#ffffff"); }
            if (t - notes < 3.6f) for (int k = 0; k < 3; k++) { float q = (t / 1.2f + k / 3f) % 1; Px.R(b, Js.Round(110 + k * 7 + Mathf.Sin(t / 0.2f + k) * 3), Js.Round(70 - q * 30), 2, 2, "#f7c646"); Px.R(b, Js.Round(112 + k * 7 + Mathf.Sin(t / 0.2f + k) * 3), Js.Round(65 - q * 30), 1, 5, "#f7c646"); }
            if (t - churn < 1.5f) for (int k = 0; k < 3; k++) Px.R(b, 40 + k * 4, Js.Round(128 - ((t / 0.09f + k * 5) % 10)), 2, 2, "#fff6e0");
        };
        Open(sc);
    }
    sealed class ChestModal : Modal
    {
        public override void Draw(Game g)
        {
            var V = g.V; int fishN = V.fish.Sum(f => (int)f.v), prodN = V.produce.Sum(p => (int)p.v); var t = Rules.TitleById(Rules.TitleFor(V.wr));
            g.Title(Loc.L("Миний авдар", "My chest")); g.Small(Loc.L("Авдарт гэр бүлийн үнэт зүйлсийг хадгалдаг.", "Families keep their treasures in the avdar."));
            g.Stats((Loc.L("Загас", "Fish"), fishN.ToString()), (Loc.L("Цагаан идээ", "Dairy"), prodN.ToString()), (Loc.L("Тамга", "Stamps"), g.StampCount().ToString()));
            if (t != null) { g.Row(Px.Icon("ui:wrestle"), Loc.L("Бөхийн цол", "Wrestling title"), t.name.ToString()); g.EndRow(); }
            if (V.arch.best > 0) { g.Row(Px.Icon("ui:bow"), Loc.L("Сур харваа", "Archery"), $"{V.arch.best}/12"); g.EndRow(); }
            if (V.horse.wins > 0) { g.Row(Px.Icon("ui:trophy"), Loc.L("Түрүү морь", "Race wins"), V.horse.wins.ToString()); g.EndRow(); }
            foreach (var id in V.owned.Take(12)) { var it = Rules.ITEMS.FirstOrDefault(q => q.id == id); if (it != null) { g.Row(Px.Icon(Rules.ItemIcon(it)), it.name.ToString(), null); g.EndRow(); } }
            if (g.Btn(Loc.L("Хаах", "Close"), true, 34)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }
}
