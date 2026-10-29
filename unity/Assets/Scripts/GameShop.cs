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
    static void SetLook(Look l, string slot, string val)
    {
        switch (slot) { case "deel": l.deel = val; break; case "hat": l.hat = val; break; case "face": l.face = val; break; case "neck": l.neck = val; break; case "pet": l.pet = val; break; case "skin": l.skin = val; break; case "gender": l.gender = val; break; }
    }
    void Equip(string slot, string val) { SetLook(V.look, slot, val); V.Save(); Sfx.Tap(); }
    string Worn(string slot) { var l = V.look; switch (slot) { case "deel": return l.deel; case "hat": return l.hat; case "face": return l.face; case "neck": return l.neck; case "pet": return l.pet; } return null; }

    /** The shop: tabs, a card grid, and for clothes and pets a big live try-on of your character before you buy. The wardrobe is the same screen with only what you own. */
    public class ShopModal : Modal
    {
        string cur, slot = "deel", toolSel; readonly bool wardrobe; int dirI;
        readonly Dictionary<string, string> tryOn = new Dictionary<string, string>(); // slot -> value being tried on ("" = bare)
        readonly Live live = new Live(160, 160); float popT = -9; GUIStyle cs;
        public ShopModal(string start, bool wardrobe = false) { cur = start; this.wardrobe = wardrobe; }
        public override float Width => 620;
        bool Owned(Game g, Rules.Item it) => it.cat == "tool" ? g.V.rod >= int.Parse(it.val) : g.V.owned.Contains(it.id);
        int TabRow(Game g, IList<string> labels, int current)
        {
            int hit = -1; GUILayout.BeginHorizontal();
            for (int i = 0; i < labels.Count; i++) if (GUILayout.Button(labels[i], i == current ? g.sPrimary : g.sBtn, GUILayout.MinHeight(g.U(38)), GUILayout.ExpandWidth(true))) hit = i;
            GUILayout.EndHorizontal(); return hit;
        }
        public override void Draw(Game g)
        {
            var V = g.V; float t = Time.time; cs = new GUIStyle(g.sSmall) { alignment = TextAnchor.UpperCenter, wordWrap = true };
            GUILayout.BeginHorizontal(); g.Title(wardrobe ? Loc.L("Миний хувцас", "My wardrobe") : Loc.L("Наадмын дэлгүүр", "Naadam Shop")); GUILayout.FlexibleSpace(); g.IconAt(Px.Icon("ui:coin"), 22); GUILayout.Label("<b>" + V.coins + "</b>", g.sTitle); GUILayout.EndHorizontal();
            var tabs = new List<(string id, string name)> { ("wear", Loc.L("Хувцас", "Clothes")), ("pet", Loc.L("Тэжээвэр", "Pets")) };
            if (!wardrobe) { tabs.Add(("tool", Loc.L("Багаж", "Tools"))); tabs.Add(("sell", Loc.L("Зарах", "Sell"))); }
            int hit = TabRow(g, tabs.Select(x => x.name).ToList(), tabs.FindIndex(x => x.id == cur));
            if (hit >= 0) { var k = tabs[hit].id; g.Later(() => { cur = k; Sfx.Tap(); }); }
            g.Gap(6);
            if (cur == "sell") Sell(g);
            else
            {
                string sl = cur == "wear" ? slot : cur == "pet" ? "pet" : "rod";
                bool pv = cur != "tool";
                if (cur == "tool") g.CoverRow();
                GUILayout.BeginHorizontal();
                if (pv) { GUILayout.BeginVertical(GUILayout.Width(g.U(190))); Preview(g, t); GUILayout.EndVertical(); GUILayout.Space(g.U(8)); }
                GUILayout.BeginVertical();
                if (cur == "wear")
                {
                    var sl2 = new[] { ("deel", Loc.L("Дээл", "Deel")), ("hat", Loc.L("Малгай", "Hat")), ("face", Loc.L("Нүүр", "Face")), ("neck", Loc.L("Хүзүү", "Neck")) };
                    int h2 = TabRow(g, sl2.Select(x => x.Item2).ToList(), System.Array.FindIndex(sl2, x => x.Item1 == slot));
                    if (h2 >= 0) { var k = sl2[h2].Item1; g.Later(() => { slot = k; Sfx.Tap(); }); }
                    g.Gap(4);
                }
                var items = new List<Rules.Item>();
                if (cur != "tool" && sl != "deel") items.Add(null);
                items.AddRange(Rules.ITEMS.Where(i => i.cat == cur && (cur != "wear" || i.slot == slot) && (!wardrobe || Owned(g, i))));
                string chosen = cur == "tool" ? toolSel : tryOn.TryGetValue(sl, out var tv) ? tv : g.Worn(sl);
                g.Grid("shop" + cur, items.Count, 92, (i, w) => g.U(112), (i, r) => Card(g, r, items[i], chosen, sl, t), 6);
                var sel = items.FirstOrDefault(i => i != null && i.val == chosen);
                g.Gap(6); Detail(g, sel, sl);
                GUILayout.EndVertical(); GUILayout.EndHorizontal();
            }
            g.Gap();
            GUILayout.BeginHorizontal();
            if (wardrobe && g.Btn(Loc.L("Дэлгүүр", "Shop"))) g.Later(() => g.Swap(new ShopModal("wear")));
            if (g.Btn(Loc.L("Хаах", "Close"), wardrobe, 36)) g.Later(g.Close);
            GUILayout.EndHorizontal();
        }
        /** Your character, bobbing, wearing what is being tried on (not bought yet). */
        void Preview(Game g, float t)
        {
            var V = g.V; var look = V.look.Copy(); foreach (var kv in tryOn) SetLook(look, kv.Key, kv.Value == "" ? null : kv.Value);
            var x = live.c; Px.R(x, 0, 0, 160, 112, "#9fd8f7"); Px.R(x, 0, 112, 160, 48, "#94d260");
            for (int i = 0; i < 3; i++) { float q = (t * 0.05f + i * 0.33f) % 1; Px.R(x, Js.Round(q * 190 - 20), 14 + i * 16, 22, 5, "#ffffff"); }
            float pop = Mathf.Clamp01(1 - (t - popT) / 0.35f), sc = 1 + pop * 0.14f; int bob = Mathf.Sin(t * 4) > 0.2f ? 1 : 0;
            Px.R(x, 38, 140, 52, 8, "rgba(30,20,10,.25)");
            int w = Js.Round(64 * sc), h = Js.Round(112 * sc);
            x.BlitScaled(Px.Char(look, new[] { 0, 2, 3, 1 }[dirI], 0), 68 - w / 2, 132 - h - bob, w, h);
            if (!string.IsNullOrEmpty(look.pet)) { var a = Px.Animal(look.pet, (int)(t / 0.3f) % 2); x.BlitScaled(a, 104, 148 - a.H * 3, a.W * 3, a.H * 3); }
            if (tryOn.Count > 0 || pop > 0) for (int i = 0; i < 6; i++) { float a = t * 2 + i * 1.047f; Px.P(x, 68 + Js.Round(Mathf.Cos(a) * 36), 74 + Js.Round(Mathf.Sin(a) * 52), (i + (int)(t * 6)) % 2 == 0 ? "#f7c646" : "#fff8e6"); }
            live.Show(g, 190);
            GUILayout.BeginHorizontal(); GUILayout.FlexibleSpace();
            if (g.SmallBtn("◄", false, 44)) g.Later(() => dirI = (dirI + 3) % 4);
            if (g.SmallBtn("►", false, 44)) g.Later(() => dirI = (dirI + 1) % 4);
            GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            if (tryOn.Count > 0) { GUILayout.Label("<color=#b8741a>" + Loc.L("Өмсөж үзэж байна", "Trying on") + "</color>", cs); if (g.SmallBtn(Loc.L("Буцаах", "Undo"), false, 60)) g.Later(() => { tryOn.Clear(); Sfx.Tap(); }); }
            if (cur == "wear")
            {
                GUILayout.Label(Loc.L("Би бол", "I am a"), g.sSmall);
                int gi = g.Chips(new[] { Loc.L("Хүү", "Boy"), Loc.L("Охин", "Girl") }, V.look.Girl ? 1 : 0, 50);
                if (gi >= 0) g.Later(() => g.Equip("gender", gi == 1 ? "girl" : null));
                GUILayout.BeginHorizontal(); foreach (var sk in Rules.SKINS) if (g.Swatch(Px.Col(sk), V.look.skin == sk, 30)) { var s2 = sk; g.Later(() => g.Equip("skin", s2)); } GUILayout.EndHorizontal();
            }
        }
        /** One card: picture, name, and its state or price. Tapping only selects it (the try-on); buying is in the strip below. */
        void Card(Game g, Rect r, Rules.Item it, string chosen, string sl, float t)
        {
            bool none = it == null, on = none ? string.IsNullOrEmpty(chosen) : it.val == chosen, owned = !none && Owned(g, it), worn = !none && it.cat != "tool" && g.Worn(it.slot) == it.val, locked = !none && !owned && g.Lvl < it.lvl;
            if (GUI.Button(r, "", on ? g.sSel : g.sTile)) { string v = none ? "" : it.val; g.Later(() => { if (cur == "tool") toolSel = v; else tryOn[sl] = v; popT = Time.time; Sfx.Tap(); }); }
            var old = GUI.color; if (locked) GUI.color = new Color(1, 1, 1, 0.5f);
            float ic = g.U(36);
            if (none) GUI.Label(new Rect(r.x, r.y + g.U(8), r.width, ic), "—", new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            else GUI.DrawTexture(new Rect(r.center.x - ic / 2, r.y + g.U(6) + (on ? Mathf.Round(Mathf.Sin(t * 6)) * g.U(1.5f) : 0), ic, ic), g.Tex(Px.Icon(Rules.ItemIcon(it))));
            GUI.Label(new Rect(r.x + 2, r.y + g.U(46), r.width - 4, g.U(40)), none ? Loc.L("Байхгүй", "None") : it.name.ToString(), cs);
            GUI.color = old;
            var sr = new Rect(r.x + 2, r.yMax - g.U(24), r.width - 4, g.U(22));
            if (none) return;
            if (worn) GUI.Label(sr, "<color=#3a7d1e><b>√ " + Loc.L("Өмссөн", "Wearing") + "</b></color>", cs);
            else if (owned) GUI.Label(sr, it.cat == "tool" ? "<color=#3a7d1e><b>√</b></color>" : Loc.L("Танд байгаа", "Owned"), cs);
            else if (locked) GUI.Label(sr, "<color=#8a7a66>" + Loc.L("Түвшин ", "Lv ") + it.lvl + "</color>", cs);
            else { GUI.DrawTexture(new Rect(sr.center.x - g.U(26), sr.y + g.U(2), g.U(14), g.U(14)), g.Tex(Px.Icon("ui:coin"))); GUI.Label(new Rect(sr.center.x - g.U(8), sr.y, g.U(40), sr.height), "<b>" + it.price + "</b>", new GUIStyle(cs) { alignment = TextAnchor.UpperLeft }); }
        }
        /** The strip under the grid: the picked thing and its buy / wear / remove button. */
        void Detail(Game g, Rules.Item it, string sl)
        {
            GUILayout.BeginHorizontal(g.sBtn);
            if (it == null)
            {
                if (cur == "tool") { g.Small(Loc.L("Багаж сонгоорой.", "Pick a tool.")); GUILayout.EndHorizontal(); return; }
                GUILayout.Label("<b>" + Loc.L("Байхгүй", "None") + "</b>", g.sLabel); GUILayout.FlexibleSpace();
                if (!string.IsNullOrEmpty(g.Worn(sl)) && g.SmallBtn(Loc.L("Тайлах", "Remove"))) g.Later(() => { g.Equip(sl, null); tryOn.Remove(sl); });
            }
            else
            {
                bool owned = Owned(g, it), worn = it.cat != "tool" && g.Worn(it.slot) == it.val, locked = !owned && g.Lvl < it.lvl;
                GUILayout.BeginVertical(); GUILayout.Label("<b>" + it.name + "</b>", g.sLabel);
                g.Small(owned ? (worn ? Loc.L("Өмссөн", "Wearing") : Loc.L("Танд байгаа", "Owned")) : locked ? Loc.L("Түвшин ", "Level ") + it.lvl + Loc.L(" хүрэхэд нээгдэнэ", " unlocks it") : $"{it.price} {Loc.L("зоос", "coins")}");
                GUILayout.EndVertical(); GUILayout.FlexibleSpace();
                if (owned) { if (it.cat != "tool" && !worn) { if (g.SmallBtn(Loc.L("Өмсөх", "Wear"))) g.Later(() => { g.Equip(it.slot, it.val); tryOn.Remove(sl); popT = Time.time; Sfx.Good(); }); } else if (worn && it.slot != "deel" && g.SmallBtn(Loc.L("Тайлах", "Remove"))) g.Later(() => { g.Equip(it.slot, null); tryOn.Remove(sl); }); }
                else if (!locked && g.SmallBtn(Loc.L("Авах", "Buy") + " " + it.price)) g.Later(() => Buy(g, it, sl));
            }
            GUILayout.EndHorizontal();
        }
        void Buy(Game g, Rules.Item it, string sl)
        {
            if (!g.Pay(it.price)) return;
            if (it.cat == "tool") g.V.rod = int.Parse(it.val);
            else { g.V.owned.Add(it.id); g.Equip(it.slot, it.val); tryOn.Remove(sl); popT = Time.time; g.Confetti(30); }
            Sfx.Good(); g.Toast($"{it.name}: " + Loc.L("худалдаж авлаа!", "purchased!")); g.V.Save();
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

    sealed class WardrobeModal : ShopModal { public WardrobeModal() : base("wear", true) { } public override void Press(Game g) => g.Close(); }

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
            int hit = g.Chips(Rules.FOOD_TABS.Select(t => t.name.ToString()).ToList(), System.Array.FindIndex(Rules.FOOD_TABS, t => t.id == cur), 90, true);
            if (hit >= 0) { var k = Rules.FOOD_TABS[hit].id; g.Later(() => cur = k); }
            foreach (var f in Rules.FOODS.Where(x => x.kind == cur))
            {
                bool mine = Rules.DAIRY.ContainsKey(f.id) && V.Have(f.id) > 0, free = home || mine || f.price == 0;
                g.Row(Rules.DAIRY.ContainsKey(f.id) ? Px.Icon("dairy:" + f.id) : null, $"{f.name}  <size={g.Ts(11)}>+{f.energy}</size>", f.fact.ToString());
                if (g.SmallBtn(free ? Loc.L("Идэх", "Eat") : f.price.ToString())) { var ff = f; g.Later(() => g.Eat(ff.id, home)); }
                g.EndRow();
            }
            g.Gap();
            if (g.Btn(Loc.L("Хаах", "Close"), false, 32)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }
}
