// The Naadam shop (clothes, pets, tools, selling), your wardrobe, the bag, and eating and drinking.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    int Lvl => Rules.Level(V.xp).l;
    bool Pay(int price)
    {
        if (V.coins < price) { Sfx.Bad(); Toast(Loc.L("Зоос хүрэлцэхгүй байна. Хичээл үзэж, Басарын асуултад хариулж, цагаан идээ зарж цуглуулаарай!", "Not enough coins. Learn, answer Basar’s quizzes or sell dairy foods to earn more!")); return false; }
        V.coins -= price; Sfx.Chime(); return true;
    }
    void Equip(string slot, string val)
    {
        var l = V.look;
        switch (slot) { case "deel": l.deel = val; break; case "hat": l.hat = val; break; case "face": l.face = val; break; case "neck": l.neck = val; break; case "pet": l.pet = val; break; case "skin": l.skin = val; break; }
        V.Save(); Sfx.Tap();
    }
    string Worn(string slot) { var l = V.look; switch (slot) { case "deel": return l.deel; case "hat": return l.hat; case "face": return l.face; case "neck": return l.neck; case "pet": return l.pet; } return null; }

    sealed class ShopModal : Modal
    {
        string cur;
        public ShopModal(string start) { cur = start; }
        public override float Width => 560;
        public override void Draw(Game g)
        {
            var V = g.V;
            GUILayout.BeginHorizontal(); g.Title(Loc.L("Наадмын дэлгүүр", "Naadam Shop")); GUILayout.FlexibleSpace(); g.IconAt(Px.Icon("ui:coin"), 22); GUILayout.Label("<b>" + V.coins + "</b>", g.sTitle); GUILayout.EndHorizontal();
            var tabs = new[] { ("wear", Loc.L("Хувцас", "Clothes")), ("pet", Loc.L("Тэжээвэр", "Pets")), ("tool", Loc.L("Багаж", "Tools")), ("sell", Loc.L("Зарах", "Sell")) };
            int hit = g.Chips(tabs.Select(t => t.Item2).ToList(), System.Array.FindIndex(tabs, t => t.Item1 == cur), 90);
            if (hit >= 0) { var k = tabs[hit].Item1; g.Later(() => cur = k); }
            g.Gap(6);
            if (cur == "sell") { Sell(g); }
            else if (cur == "tool") g.CoverRow();
            if (cur != "sell") foreach (var it in Rules.ITEMS.Where(i => i.cat == cur))
                {
                    bool owned = it.cat == "tool" ? V.rod >= int.Parse(it.val) : V.owned.Contains(it.id), locked = g.Lvl < it.lvl, worn = it.cat != "tool" && g.Worn(it.slot) == it.val;
                    g.Row(Px.Icon(Rules.ItemIcon(it)), it.name.ToString(), owned ? (worn ? Loc.L("Өмссөн", "Wearing") : Loc.L("Танд байгаа", "Owned")) : $"{it.price} {Loc.L("зоос", "coins")}", locked && !owned);
                    if (owned)
                    {
                        if (it.cat == "tool") GUILayout.Label("√", g.sTitle, GUILayout.Width(g.U(40)));
                        else if (g.SmallBtn(worn ? (it.slot == "deel" ? "√" : Loc.L("Тайлах", "Remove")) : Loc.L("Өмсөх", "Wear"), !worn)) { var i2 = it; bool w2 = worn; g.Later(() => g.Equip(i2.slot, w2 && i2.slot != "deel" ? null : i2.val)); }
                    }
                    else if (locked) GUILayout.Label(Loc.L("Түвшин ", "Lv ") + it.lvl, g.sSmall, GUILayout.Width(g.U(70)));
                    else if (g.SmallBtn(it.price.ToString())) { var i2 = it; g.Later(() => Buy(g, i2)); }
                    g.EndRow();
                }
            g.Gap();
            if (g.Btn(Loc.L("Хаах", "Close"), false, 32)) g.Later(g.Close);
        }
        static void Buy(Game g, Rules.Item it)
        {
            if (!g.Pay(it.price)) return;
            if (it.cat == "tool") g.V.rod = int.Parse(it.val);
            else { g.V.owned.Add(it.id); g.Equip(it.slot, it.val); }
            g.Toast($"{it.name}: " + Loc.L("худалдаж авлаа!", "purchased!")); g.V.Save();
        }
        static void Sell(Game g)
        {
            var V = g.V;
            var goods = new List<(string kind, string k, int n, Tx name, int price)>();
            foreach (var k in Rules.DAIRY_ORDER) { int n = V.Have(k); if (n > 0) goods.Add(("produce", k, n, Rules.DAIRY[k].name, Rules.DAIRY[k].sell)); }
            foreach (var f in Rules.FISH.Values) { int n = SaveData.Get(V.fish, f.id); if (n > 0 && !f.release) goods.Add(("fish", f.id, n, f.name, f.sell)); }
            void Do(string kind, string k, int n, int price) { if (kind == "produce") V.Stock(k, -n); else SaveData.Add(V.fish, k, -n); V.coins += price * n; g.Quest("sell", n); Sfx.Chime(); V.Save(); }
            if (goods.Count == 0) { g.Text(Loc.L("Зарах зүйл алга. Мал саагаад цагаан идээ хийж, загас бариарай!", "Nothing to sell yet. Milk the animals, make dairy foods or catch fish!")); return; }
            if (g.Btn($"{Loc.L("Бүгдийг зарах", "Sell everything")} · +{goods.Sum(x => x.n * x.price)}", true)) g.Later(() => { foreach (var x in goods) Do(x.kind, x.k, x.n, x.price); });
            foreach (var x in goods)
            {
                g.Row(Px.Icon((x.kind == "fish" ? "fish:" : "dairy:") + x.k), $"{x.name} ×{x.n}", $"{x.price} {Loc.L("зоос, ширхэг бүр", "coins each")}");
                if (g.SmallBtn(Loc.L("Зарах", "Sell") + " 1", false)) { var y = x; g.Later(() => Do(y.kind, y.k, 1, y.price)); }
                g.EndRow();
            }
        }
    }

    sealed class WardrobeModal : Modal
    {
        readonly Live live = new Live(160, 160);
        public override float Width => 560;
        public override void Draw(Game g)
        {
            var V = g.V; float t = Time.time;
            g.Title(Loc.L("Миний хувцас", "My wardrobe"));
            var x = live.c; Px.R(x, 0, 0, 160, 112, "#9fd8f7"); Px.R(x, 0, 112, 160, 48, "#94d260");
            int dir = new[] { 0, 2, 3, 1 }[(int)(t / 0.6f) % 4];
            Px.R(x, 48, 140, 40, 8, "rgba(30,20,10,.25)");
            x.BlitScaled(Px.Char(V.look, dir, 0), 36, 20, 64, 112);
            if (!string.IsNullOrEmpty(V.look.pet)) { var a = Px.Animal(V.look.pet, (int)(t / 0.3f) % 2); x.BlitScaled(a, 104, 148 - a.H * 3, a.W * 3, a.H * 3); }
            live.Show(g, 150);
            GUILayout.Label(Loc.L("Арьсны өнгө", "Skin tone"), g.sSmall);
            GUILayout.BeginHorizontal(); foreach (var sk in Rules.SKINS) if (g.Swatch(Px.Col(sk), V.look.skin == sk)) { var s2 = sk; g.Later(() => g.Equip("skin", s2)); } GUILayout.EndHorizontal();
            foreach (var (title, slot) in new[] { (Loc.L("Дээл", "Deel"), "deel"), (Loc.L("Малгай", "Hat"), "hat"), (Loc.L("Нүүр", "Face"), "face"), (Loc.L("Хүзүү", "Neck"), "neck"), (Loc.L("Тэжээвэр", "Pet"), "pet") })
            {
                GUILayout.Label(title, g.sSmall);
                GUILayout.BeginHorizontal();
                if (slot != "deel" && GUILayout.Button("—", string.IsNullOrEmpty(g.Worn(slot)) ? g.sPrimary : g.sBtn, GUILayout.Width(g.U(42)), GUILayout.Height(g.U(42)))) { var s2 = slot; g.Later(() => g.Equip(s2, null)); }
                foreach (var it in Rules.ITEMS.Where(i => i.slot == slot && V.owned.Contains(i.id)))
                {
                    var r = GUILayoutUtility.GetRect(g.U(42), g.U(42), GUILayout.Width(g.U(42)), GUILayout.Height(g.U(42)));
                    if (GUI.Button(r, "", g.Worn(slot) == it.val ? g.sPrimary : g.sBtn)) { var i2 = it; g.Later(() => g.Equip(i2.slot, i2.val)); }
                    GUI.DrawTexture(new Rect(r.x + g.U(5), r.y + g.U(5), r.width - g.U(10), r.height - g.U(10)), g.Tex(Px.Icon(Rules.ItemIcon(it))));
                }
                GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            }
            g.Gap();
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Дэлгүүрээс шинэ хувцас авах", "Get more at the shop"))) g.Later(() => g.Swap(new ShopModal("wear")));
            if (g.Btn(Loc.L("Хаах", "Close"), true)) g.Later(g.Close);
            GUILayout.EndHorizontal();
        }
        public override void Press(Game g) => g.Close();
    }

    sealed class BagModal : Modal
    {
        public override void Draw(Game g)
        {
            var V = g.V; var L1 = Rules.Level(V.xp);
            g.Title(Loc.L("Цүнх", "Bag"));
            g.Stats((Loc.L("Түвшин", "Level"), L1.l.ToString()), ("XP", $"{L1.cur}/{L1.need}"), (Loc.L("Зоос", "Coins"), V.coins.ToString()));
            void Sec(string title, IEnumerable<(string icon, string name, int n)> items)
            {
                GUILayout.Label(title, g.sSmall); var list = items.Where(i => i.n > 0).ToList();
                if (list.Count == 0) { GUILayout.Label("—", g.sLabel); return; }
                GUILayout.BeginHorizontal(); int c = 0;
                foreach (var (ic, name, n) in list) { if (c++ == 3) { GUILayout.EndHorizontal(); GUILayout.BeginHorizontal(); c = 1; } GUILayout.BeginHorizontal(g.sBtn); g.IconAt(Px.Icon(ic), 22); GUILayout.Label($"{name} ×{n}", g.sLabel); GUILayout.EndHorizontal(); }
                GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            }
            Sec(Loc.L("Цагаан идээ", "Dairy"), Rules.DAIRY_ORDER.Select(k => ("dairy:" + k, Rules.DAIRY[k].name.ToString(), V.Have(k))));
            Sec(Loc.L("Загас", "Fish"), Rules.FISH.Values.Select(f => ("fish:" + f.id, f.name.ToString(), SaveData.Get(V.fish, f.id))));
            Sec(Loc.L("Гэрийн хэрэгсэл", "Ger parts"), g.GerBag());
            g.Gap();
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Хувцас", "Wardrobe"))) g.Later(() => g.Swap(new WardrobeModal()));
            if (g.Btn(Loc.L("Зарах", "Sell"), true)) g.Later(() => g.Swap(new ShopModal("sell")));
            GUILayout.EndHorizontal();
            if (g.Btn(Loc.L("Хаах", "Close"), false, 32)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }

    /** Eat and drink: Mongolian foods for coins, your own dairy for free. */
    sealed class FoodModal : Modal
    {
        string cur; readonly bool home;
        public FoodModal(string tab, bool home = false) { cur = tab; this.home = home; }
        public override float Width => 560;
        public override void Draw(Game g)
        {
            var V = g.V;
            GUILayout.BeginHorizontal(); g.Title(Loc.L("Хоол, ундаа", "Food & drink")); GUILayout.FlexibleSpace(); GUILayout.Label($"<b>{Mathf.RoundToInt(V.energy)}/{Rules.ENERGY_MAX}</b>", g.sTitle); GUILayout.EndHorizontal();
            g.Small(Loc.L("Гүйхэд хүч зарцуулна. Монгол хоол идэж хүчээ нөхөөрэй!", "Running uses energy. Eat Mongolian food to get it back!"));
            int hit = g.Chips(Rules.FOOD_TABS.Select(t => t.name.ToString()).ToList(), System.Array.FindIndex(Rules.FOOD_TABS, t => t.id == cur), 90);
            if (hit >= 0) { var k = Rules.FOOD_TABS[hit].id; g.Later(() => cur = k); }
            foreach (var f in Rules.FOODS.Where(x => x.kind == cur))
            {
                bool mine = Rules.DAIRY.ContainsKey(f.id) && V.Have(f.id) > 0, free = home || mine || f.price == 0;
                g.Row(Rules.DAIRY.ContainsKey(f.id) ? Px.Icon("dairy:" + f.id) : null, $"{f.name}  <size={Game.PxSize(g.U(11f) * 1.3f)}>+{f.energy}</size>", f.fact.ToString());
                if (g.SmallBtn(free ? Loc.L("Идэх", "Eat") : f.price.ToString())) { var ff = f; g.Later(() => g.Eat(ff.id, home)); }
                g.EndRow();
            }
            g.Gap();
            if (g.Btn(Loc.L("Хаах", "Close"), false, 32)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }
}
