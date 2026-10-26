// Эмээгийн гэр: etiquette with Grandma (gentle, never punishing), and the townspeople with their chains of tasks.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    sealed class EmeeModal : Modal
    {
        readonly Live live = new Live(Scenes.W, Scenes.H); readonly SceneState st = new SceneState();
        int i, slips; string say; bool gentle, finished, perfect; float nextAt = -1; (int coins, int xp, int level) rw;
        List<Rules.Opt> opts; readonly HashSet<Rules.Opt> tried = new HashSet<Rules.Opt>();
        public EmeeModal() { Show(); }
        public override float Width => 540;
        void Show()
        {
            var s = Rules.EMEE_STEPS[i]; st.hl = s.hl; st.hlBad = false; say = s.say.ToString(); gentle = false; tried.Clear();
            opts = s.opts?.OrderBy(_ => Random.value).ToList();
        }
        void Next(Game g)
        {
            i++;
            if (i < Rules.EMEE_STEPS.Length) { nextAt = Time.time + 0.45f; return; }
            var em = g.V.emee; em.visits++; perfect = slips == 0; if (perfect) em.perfect++;
            if (em.visits == 1) g.HandsOnFirst("emee");
            rw = g.Reward(perfect ? 30 : 20, perfect ? 40 : 30); g.Quest("etiquette"); g.V.Save();
            Sfx.Win(); g.Confetti(50); finished = true;
            say = perfect ? Loc.L("Ёстой ёсорхог хүүхэд вэ! Энэ ааруулаас ав, миний хүү/охин.", "Such a well-mannered child! Have some aaruul, dear.") : Loc.L("Сайн байна! Алдах нь сурах л гэсэн үг. Энэ ааруулаас ав.", "Well done! Making mistakes is how we learn. Have some aaruul.");
        }
        public override void Tick(Game g, float dt) { if (nextAt > 0 && Time.time >= nextAt) { nextAt = -1; Show(); } }
        void Choose(Game g, Rules.Opt o)
        {
            if (o.ok) { Sfx.Good(); Next(g); }
            else { slips++; Sfx.Tap(); tried.Add(o); say = o.why.ToString(); gentle = true; }
        }
        void Zone(Game g, string z)
        {
            var s = Rules.EMEE_STEPS[i]; if (s.zones == null || finished || nextAt > 0 || z == null) return;
            st.hl = z;
            if (z == s.zone) { st.hlBad = false; Sfx.Good(); Next(g); }
            else { slips++; st.hlBad = true; say = s.zones.TryGetValue(z, out var w) ? w.ToString() : s.say.ToString(); gentle = true; }
        }
        public override void Draw(Game g)
        {
            g.Small(Loc.L("Эмээгийн гэр · Ёс заншил", "Grandma’s ger · Manners"));
            g.Title(Loc.L("Эмээдээ зочлох", "Visiting Grandma"));
            Scenes.Inside(live.c, st, Time.time); var rr = live.Show(g, 190);
            var e = Event.current;
            if (e.type == EventType.MouseDown && rr.Contains(e.mousePosition)) { var p = live.Pick(e.mousePosition); string z = Scenes.ZoneAt(p.x, p.y); g.Later(() => Zone(g, z)); e.Use(); }
            GUILayout.BeginHorizontal(g.sBtn); g.IconAt(Px.Char(Rules.EMEE, 0, 0), 36); GUILayout.Label((gentle ? "<color=#c2427e>♥</color> " : "") + say, g.sLabel); GUILayout.EndHorizontal();
            if (finished)
            {
                g.Text($"+{rw.coins} {Loc.L("зоос", "coins")} · +{rw.xp} XP");
                g.Small(perfect ? Loc.L("Нэг ч алдаагүй!", "Not a single slip!") : Loc.L($"Эмээ {slips} удаа зөөлөн зааж өглөө.", $"Grandma gently helped you {slips} time(s)."));
                if (g.V.emee.visits == 1) g.HandsOnCard("emee");
                GUILayout.BeginHorizontal();
                if (g.Btn(Loc.L("Баяртай, эмээ!", "Bye, Grandma!"), true)) g.Later(g.Close);
                if (g.Btn(Loc.L("Ёс заншлын хичээл", "Manners lesson"))) g.Later(() => { g.Close(); g.OpenLesson("customs"); });
                GUILayout.EndHorizontal();
                return;
            }
            var s = Rules.EMEE_STEPS[i];
            if (nextAt > 0) return;
            if (s.zones != null) { g.Small(Loc.L("Зураг дээр дар", "Tap the picture")); return; }
            foreach (var o in opts)
            {
                bool was = GUI.enabled; GUI.enabled = !tried.Contains(o);
                if (g.Btn(o.t.ToString(), false, 40)) { var oo = o; g.Later(() => Choose(g, oo)); }
                GUI.enabled = was;
            }
        }
    }

    sealed class NpcModal : Modal
    {
        readonly Rules.Npc d; string speech;
        public NpcModal(string id) { d = Rules.NpcById(id); }
        public override float Width => 540;
        public override void Draw(Game g)
        {
            var st = g.V.Npc(d.id); var q = st.step < d.chain.Length ? d.chain[st.step] : null; bool ready = q != null && st.on && st.p >= q.n;
            GUILayout.BeginHorizontal(); g.IconAt(Px.Char(d.look, 0, 0), 56);
            GUILayout.BeginVertical(); g.Title(d.name.ToString());
            GUILayout.Label(string.Concat(Enumerable.Range(0, d.chain.Length).Select(k => k < st.step ? "<color=#2ea35f>●</color> " : k == st.step ? "<color=#f7c646>●</color> " : "○ ")), g.sLabel);
            GUILayout.EndVertical(); GUILayout.EndHorizontal();
            string line = speech ?? (q == null ? d.tic + d.done.ToString() : st.on ? d.tic + (ready ? Loc.L("Чи хийчихжээ! Баярлалаа!", "You did it! Thank you!") : q.t.ToString()) : $"{d.hello} {q.t}");
            GUILayout.BeginVertical(g.sBtn); GUILayout.Label(line, g.sLabel); GUILayout.EndVertical();
            if (g.Btn(Loc.L("Таны тухай?", "About you?"), false, 30)) g.Later(() => speech = d.bio.ToString());
            if (d.id == "craftsman") { GUILayout.Label("<b>" + Loc.L("Гэрийн мод", "Wooden ger parts") + "</b>", g.sLabel); g.TradeList(); }
            if (q == null) { g.Small("√ " + Loc.L("Бүх даалгаврыг биелүүлсэн. Баярлалаа!", "All tasks complete. Thank you!")); if (g.Btn(Loc.L("Хаах", "Close"), true)) g.Later(g.Close); return; }
            if (st.on) { g.Bar(GUILayoutUtility.GetRect(10, g.U(10), GUILayout.ExpandWidth(true)), st.p / (float)q.n, Px.Col("#2ea35f")); g.Small($"{st.p}/{q.n} · +{q.c} {Loc.L("зоос", "coins")} · +{q.x} XP"); }
            GUILayout.BeginHorizontal();
            if (!st.on) { if (g.Btn(Loc.L("Тэгье, хийе!", "Okay, I’ll do it!"), true)) g.Later(() => { st.on = true; st.p = 0; g.V.Save(); Sfx.Chime(); speech = null; }); }
            else if (ready) { if (g.Btn(Loc.L("Шагнал авах", "Collect reward"), true)) g.Later(() => { var r = g.Reward(q.c, q.x); st.step++; st.p = 0; st.on = st.step < d.chain.Length; g.V.Save(); g.Confetti(40); g.Toast($"{d.name}: +{r.coins} {Loc.L("зоос", "coins")}"); speech = null; }); }
            else if (g.Btn(Loc.L("Одоо хийнэ!", "I’m on it!"))) g.Later(g.Close);
            GUILayout.EndHorizontal();
        }
        public override void Press(Game g) => g.Close();
    }
}
