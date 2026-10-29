// Өв соёлын сургууль: hands-on heritage lessons. Each lesson = fun steps -> Basar's quiz -> a real-life family activity.
// Goal: a child can say "Mom, Dad, let's build a Mongolian ger together!" and actually know how. Ported from js/learn/lessons.js
// (the lessons themselves are in LessonData.cs; the pictures are drawn by Scenes.cs).
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;

public static class Lessons
{
    public static J ALL => LessonData.ALL;
    public static J ById(string id) => ALL.FirstOrDefault(l => l["id"].S == id) ?? ALL[0];
    public static int Count => ALL.Count;
    /** Applies a lesson step's `set` (or a lesson's `final`) to the scene: { stage: 9 }, { focus: "bokh" }, { tsatsal: true }… */
    public static void Apply(SceneState st, J obj)
    {
        foreach (var k in obj.Keys) Set(st, k, obj[k]);
    }
    public static void Set(SceneState st, string k, J v)
    {
        var f = typeof(SceneState).GetField(k, BindingFlags.Public | BindingFlags.Instance); if (f == null) return;
        if (f.FieldType == typeof(int)) f.SetValue(st, v.I);
        else if (f.FieldType == typeof(float)) f.SetValue(st, v.v is bool bb ? (bb ? 1f : 0f) : v.F);
        else if (f.FieldType == typeof(bool)) f.SetValue(st, v.B);
        else if (f.FieldType == typeof(string)) f.SetValue(st, v.S);
        else if (f.FieldType == typeof(string[])) f.SetValue(st, v.IsNull ? null : v.Strings().ToArray());
    }
    public static void SetFloat(SceneState st, string k, float val) { var f = typeof(SceneState).GetField(k); if (f != null && f.FieldType == typeof(float)) f.SetValue(st, val); }
    public static float GetFloat(SceneState st, string k) { var f = typeof(SceneState).GetField(k); return f != null && f.FieldType == typeof(float) ? (float)f.GetValue(st) : 0; }
}

public sealed partial class Game
{
    public void OpenLesson(string id) => Open(new LessonPage(id));
    public bool LessonDone(string id) => V.LessonDone(id);

    /** Someone learning with you: a name and a face. */
    public sealed class Player { public string name; public PxCanvas face; }
    /** Pick who you learn with: alone, with family or with friends. onPick(mode, players). */
    public sealed class WithPicker
    {
        string mode; readonly List<Player> picked = new List<Player>(); string friend = ""; readonly string title; readonly Action<string, List<Player>> onPick;
        public WithPicker(string title, Action<string, List<Player>> onPick) { this.title = title; this.onPick = onPick; }
        List<Player> Me(Game g) => new List<Player> { new Player { name = g.V.name, face = Px.Mascot(g.V.avatar) } };
        public void Draw(Game g)
        {
            g.Title(title);
            GUILayout.BeginHorizontal();
            foreach (var (m, icon, t1, t2) in new[] { ("solo", "🙋", Loc.L("Ганцаараа", "On my own"), Loc.L("Өөрөө дадлага хийх", "Practise alone")), ("family", "👨‍👩‍👧", Loc.L("Гэр бүлтэйгээ", "With family"), Loc.L("Ээлжлэн тоглож +½ шагнал", "Take turns, +50% reward")), ("friends", "🧑‍🤝‍🧑", Loc.L("Найзуудтайгаа", "With friends"), Loc.L("Хэн илүү мэдэх вэ?", "Who knows more?")) })
            {
                var r = GUILayoutUtility.GetRect(g.U(110), g.U(96), GUILayout.ExpandWidth(true));
                if (GUI.Button(r, "", mode == m ? g.sSel : g.sBtn)) { var mm = m; g.Later(() => { mode = mm; picked.Clear(); if (mm == "solo") onPick("solo", Me(g)); }); }
                GUI.DrawTexture(new Rect(r.center.x - g.U(14), r.y + g.U(6), g.U(28), g.U(28)), g.Tex(Emo.Icon(icon)));
                var st = new GUIStyle(mode == m ? g.sPrimary.Clean() : g.sLabel) { alignment = TextAnchor.UpperCenter };
                GUI.Label(new Rect(r.x + g.U(4), r.y + g.U(38), r.width - g.U(8), g.U(22)), "<b>" + t1 + "</b>", st);
                GUI.Label(new Rect(r.x + g.U(4), r.y + g.U(58), r.width - g.U(8), g.U(34)), t2, new GUIStyle(st) { fontSize = g.Ts(10) });
            }
            GUILayout.EndHorizontal();
            if (mode != "family" && mode != "friends") return;
            var list = mode == "family" ? g.App.family.Select(f => new Player { name = f.Name.ToString(), face = Px.Face(f.face) }).ToList() : g.App.friends.Select(f => new Player { name = f.name, face = Px.Face(f.face) }).ToList();
            GUILayout.Label(mode == "family" ? Loc.L("Хэн хамт байна? (1–3)", "Who is with you? (1–3)") : Loc.L("Ямар найзууд? (1–3)", "Which friends? (1–3)"), g.sSmall);
            int cols = 3;
            for (int i = 0; i < list.Count; i += cols)
            {
                GUILayout.BeginHorizontal();
                for (int k = i; k < Mathf.Min(list.Count, i + cols); k++)
                {
                    var p = list[k]; bool on = picked.Exists(x => x.name == p.name);
                    var r = GUILayoutUtility.GetRect(g.U(100), g.U(40), GUILayout.ExpandWidth(true));
                    if (GUI.Button(r, "", on ? g.sSel : g.sBtn)) g.Later(() => { if (on) picked.RemoveAll(x => x.name == p.name); else { if (picked.Count >= 3) picked.RemoveAt(0); picked.Add(p); } });
                    GUI.DrawTexture(new Rect(r.x + g.U(6), r.center.y - g.U(12), g.U(24), g.U(24)), g.Tex(p.face));
                    GUI.Label(new Rect(r.x + g.U(34), r.y, r.width - g.U(36), r.height), p.name, new GUIStyle(on ? g.sPrimary.Clean() : g.sLabel) { alignment = TextAnchor.MiddleLeft, wordWrap = false });
                }
                g.PadRow(i + cols - Mathf.Min(list.Count, i + cols), 100, 40);
                GUILayout.EndHorizontal();
            }
            if (mode == "friends")
            {
                GUILayout.BeginHorizontal();
                friend = GUILayout.TextField(friend, 16, new GUIStyle(g.sBtn) { alignment = TextAnchor.MiddleLeft }, GUILayout.MinHeight(g.U(38)));
                if (GUILayout.Button("+", g.sPrimary, GUILayout.Width(g.U(48)), GUILayout.MinHeight(g.U(38)))) g.Later(() =>
                {
                    string n = friend.Trim(); if (n == "") return;
                    g.App.friends.RemoveAll(f => f.name == n); g.App.friends.Add(new Friend { name = n, face = new[] { 7, 5, 6, 4 }[UnityEngine.Random.Range(0, 4)] });
                    if (g.App.friends.Count > 12) g.App.friends.RemoveAt(0); g.App.Save();
                    picked.Add(new Player { name = n, face = Px.Face(g.App.friends.Last().face) }); if (picked.Count > 3) picked.RemoveAt(0); friend = "";
                });
                GUILayout.EndHorizontal();
            }
            if (g.Btn(picked.Count > 0 ? Loc.L("Хамтдаа эхлэх ►", "Start together ►") : Loc.L("Хамт сурах хүнээ сонго", "Pick who joins you"), true, 48, picked.Count > 0)) g.Later(() => onPick(mode, Me(g).Concat(picked).ToList()));
        }
    }
    /** Record that the child learned together (for achievements and the parent dashboard). */
    public void NoteTogether(string mode, List<Player> players, string what)
    {
        if (mode == null || mode == "solo") return;
        SaveData.Add(V.together, mode, 1);
        App.LogActivity("together", $"{what}|{mode}|{string.Join(", ", players.Skip(1).Select(p => p.name))}", V.id);
        if (mode == "family") App.familyStars += 2;
        App.Save(); V.Save(); CheckAchievements();
    }

    /** Several quiz questions in a row; with several players they take turns. */
    public sealed class QuizRun
    {
        readonly string topic; readonly int n; readonly List<Player> players; readonly Action<int, int, int[]> onFinish;
        int k, right; public readonly int[] tally; QuizCard card; bool loading;
        public QuizRun(string topic, int n, List<Player> players, Action<int, int, int[]> onFinish) { this.topic = topic; this.n = n; this.players = players ?? new List<Player>(); this.onFinish = onFinish; tally = new int[Math.Max(1, this.players.Count)]; }
        bool Multi => players.Count > 1;
        public void Start(Game g) => Next(g);
        void Next(Game g)
        {
            if (k >= n) { onFinish(right, n, tally); return; }
            loading = true; card = null; int who = Multi ? k % players.Count : 0; k++;
            g.StartCoroutine(Basar.Quiz(g, topic, q => { loading = false; card = new QuizCard(q, ok => { if (ok) { right++; tally[who]++; } }); }));
        }
        public void Draw(Game g)
        {
            if (loading || card == null) { GUILayout.BeginHorizontal(); g.IconAt(Px.BankharFace(2), 36); g.Text(Loc.L("Басар бодож байна…", "Basar is thinking…")); GUILayout.EndHorizontal(); return; }
            GUILayout.Label($"<b>{k} / {n}</b>", g.sSmall);
            if (Multi) { var p = players[(k - 1) % players.Count]; GUILayout.BeginHorizontal(g.sBtn); g.IconAt(p.face, 24); GUILayout.Label("<b>" + Loc.L($"{p.name}-ийн ээлж", $"{p.name}’s turn") + "</b>", g.sLabel); GUILayout.EndHorizontal(); }
            card.Draw(g);
            if (card.picked >= 0 && g.Btn(k < n ? Loc.L("Дараагийн асуулт →", "Next question →") : Loc.L("Дуусгах", "Finish"), true, 44)) g.Later(() => Next(g));
        }
    }
    public void Scoreboard(List<Player> players, int[] tally)
    {
        int max = tally.Max();
        for (int i = 0; i < players.Count; i++) { GUILayout.BeginHorizontal(tally[i] == max && max > 0 ? sPrimary : sBtn); IconAt(players[i].face, 24); GUILayout.Label(players[i].name, tally[i] == max && max > 0 ? sPrimary.Clean() : sLabel); GUILayout.FlexibleSpace(); GUILayout.Label("<b>" + tally[i] + (tally[i] == max && max > 0 ? " ♦" : "") + "</b>", tally[i] == max && max > 0 ? sPrimary.Clean() : sLabel); GUILayout.EndHorizontal(); }
    }

    /** Quiz party: a few quiz questions in turns with family or friends. */
    sealed class QuizPartyModal : Modal
    {
        readonly string topic; WithPicker picker; QuizRun run; List<Player> players; string mode; (int right, int n, int[] tally)? result; (int coins, int xp, int level) rw;
        public QuizPartyModal(Game g, string topic)
        {
            this.topic = topic;
            picker = new WithPicker(Loc.L("Хэнтэй хамт асуулт хариулт тоглох вэ?", "Who is playing the quiz?"), (m, p) =>
            {
                mode = m; players = p; picker = null;
                run = new QuizRun(topic, p.Count > 1 ? p.Count * 2 : 5, p, (right, n, tally) => { result = (right, n, tally); rw = g.Reward(right * (p.Count > 1 ? 6 : 4), right * 6); g.NoteTogether(mode, players, "quiz"); Sfx.Win(); g.Confetti(50); });
                run.Start(g);
            });
        }
        public override float Width => 600;
        public override void Press(Game g) { }
        public override void Draw(Game g)
        {
            if (picker != null) { picker.Draw(g); if (g.Btn(Loc.L("Хаах", "Close"), false, 30)) g.Later(g.Close); return; }
            GUILayout.BeginHorizontal(); g.IconAt(Px.BankharFace(0), 48); GUILayout.BeginVertical(); g.Title(Loc.L("Басарын асуулт хариулт", "Basar’s quiz"));
            g.Small(Basar.Topics.FirstOrDefault(t => t.id == topic).name.ToString() ?? Loc.L("Холимог сэдэв", "Mixed topics")); GUILayout.EndVertical(); GUILayout.EndHorizontal();
            if (result == null) { run.Draw(g); return; }
            var res = result.Value;
            GUILayout.Label("<b>" + Loc.L($"{res.n} асуултаас {res.right} зөв!", $"{res.right} of {res.n} right!") + "</b>", new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            if (players.Count > 1) g.Scoreboard(players, res.tally);
            g.Text($"+{rw.coins} {Loc.L("зоос", "coins")} · +{rw.xp} XP");
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Хаах", "Close"))) g.Later(g.Close);
            if (g.Btn(Loc.L("Дахин", "Again"), true)) g.Later(() => g.Swap(new QuizPartyModal(g, topic)));
            GUILayout.EndHorizontal();
        }
    }

    // ================================================================ the heritage school
    sealed class LearnPage : Page
    {
        protected override bool Hero => true; protected override string Tab => "learn";
        readonly Dictionary<string, Live> thumbs = new Dictionary<string, Live>();
        protected override string Title => Loc.L("Өв соёлын сургууль", "Heritage school");
        protected override void Body(Game g)
        {
            var V = g.V;
            GUILayout.BeginHorizontal(g.sPanel); g.IconAt(Px.BankharFace(0), 64); g.Gap(12);
            GUILayout.BeginVertical(); GUILayout.Label(Loc.L("ӨВ СОЁЛЫН СУРГУУЛЬ", "HERITAGE SCHOOL"), g.sKicker); GUILayout.Label(Loc.L("Хамтдаа сурцгаая!", "Let’s learn together!"), new GUIStyle(g.sTitle) { fontSize = Mathf.RoundToInt(g.U(28)) });
            g.Text(Loc.L("Тоглоод сур, сурснаа гэр бүлтэйгээ бодит амьдрал дээр хий.", "Learn by playing, then do it for real with your family.")); GUILayout.EndVertical(); GUILayout.EndHorizontal();
            g.Gap(12);
            // the page's width inside the scroll view, for the grids below (the web version's CSS grid)
            float W = Mathf.Min(Screen.safeArea.width - g.U(32), g.U(968)) - g.U(20), gap = g.U(12);
            GUILayout.BeginHorizontal();
            float hw = (W - 3 * gap) / 4;
            if (HubCard(g, hw, Emo.Icon("🔤"), Loc.L("Монгол бичиг", "Mongol script"), $"{g.BichigDone()}/{Bichig.Count}")) g.Later(() => g.Open(new BichigPage()));
            GUILayout.Space(gap);
            if (HubCard(g, hw, Emo.Icon("🛂"), Loc.L("Аймгийн паспорт", "Aimag passport"), Loc.L($"{g.StampCount()}/22 тамга", $"{g.StampCount()}/22 stamps"))) g.Later(() => g.Open(new PassportPage()));
            GUILayout.Space(gap);
            var sea = Seasons.Current();
            if (HubCard(g, hw, Emo.Icon(sea.id == "winter" ? "❄️" : sea.id == "autumn" ? "🍂" : sea.id == "spring" ? "🌸" : "☀️"), sea.name.ToString(), Loc.L("Улирлын тухай", "About the season"))) g.Later(() => g.Open(new SeasonModal()));
            GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            g.Gap(12);
            var all = Lessons.ALL.ToList(); int cols = W > g.U(820) ? 3 : W > g.U(520) ? 2 : 1; float cw = (W - gap * (cols - 1)) / cols;
            for (int i = 0; i < all.Count; i += cols)
            {
                GUILayout.BeginHorizontal();
                for (int k = i; k < Mathf.Min(all.Count, i + cols); k++) { if (k > i) GUILayout.Space(gap); LessonCard(g, all[k], cw); }
                GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
                g.Gap(12);
            }
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.BeginHorizontal(); var tic = Emo.Icon("🎯"); if (tic != null) { g.IconAt(tic, 26); g.Gap(6); } GUILayout.Label(Loc.L("Басарын асуулт хариулт", "Basar’s quiz"), g.sTitle); GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            GUILayout.Label(Loc.L($"Зөв хариулт: {V.quizRight} / {V.quizTotal}", $"Correct answers: {V.quizRight} / {V.quizTotal}"), g.sSmall);
            GUILayout.Label(Loc.L("Сэдвээ сонгоод ганцаараа, гэр бүл эсвэл найзуудтайгаа ээлжлэн тоглоорой.", "Pick a topic and play alone, or take turns with family or friends."), g.sSmall);
            var topics = new List<(string id, string name)> { ("mix", Loc.L("Холимог", "Mixed")) }; topics.AddRange(Basar.Topics.Select(t => (t.id, t.name.ToString())));
            int hit = g.Chips(topics.Select(t => t.name).ToList(), -1, 80);
            if (hit >= 0) { var tp = topics[hit].id; g.Later(() => g.Open(new QuizPartyModal(g, tp))); }
            g.Gap(6);
            if (g.Btn(Loc.L("Басараас юу ч асуух", "Ask Basar anything"), true, 46)) g.Later(() => g.OpenBasar());
            GUILayout.EndVertical();
        }
        bool HubCard(Game g, float w, PxCanvas icon, string title, string sub)
        {
            var r = GUILayoutUtility.GetRect(w, g.U(100), GUILayout.Width(w), GUILayout.Height(g.U(100)));
            bool hit = GUI.Button(r, "", g.sPanel);
            if (icon != null) GUI.DrawTexture(new Rect(r.center.x - g.U(14), r.y + g.U(16), g.U(28), g.U(28)), g.Tex(icon), ScaleMode.ScaleToFit);
            float aw = r.width - g.U(12);
            GUIStyle Fit(GUIStyle st, string t) { float tw = st.CalcSize(new GUIContent(t)).x; if (tw > aw) st.fontSize = Mathf.Max(Mathf.RoundToInt(g.U(8)), Mathf.FloorToInt(st.fontSize * aw / tw)); return st; } // a long Mongolian title shrinks to its card
            GUI.Label(new Rect(r.x + g.U(6), r.y + g.U(46), aw, g.U(22)), title, Fit(new GUIStyle(g.sLabel) { font = g.sTitle.font, alignment = TextAnchor.UpperCenter, fontSize = Mathf.RoundToInt(g.U(15)), wordWrap = false }, title));
            GUI.Label(new Rect(r.x + g.U(6), r.y + g.U(68), aw, g.U(20)), sub, Fit(new GUIStyle(g.sSmall) { alignment = TextAnchor.UpperCenter, wordWrap = false }, sub));
            return hit;
        }
        /** A lesson as the web version's card: its picture, icon and title, what it is about and its tags. The whole card opens it. */
        void LessonCard(Game g, J l, float w)
        {
            string id = l["id"].S; var pr = g.V.learn.Find(x => x.id == id);
            bool locked = !Game.LessonUnlocked(g, id);     // story mode: an earlier lesson is still open
            if (!thumbs.TryGetValue(id, out var live)) { thumbs[id] = live = new Live(Scenes.W, Scenes.H); var st = new SceneState { sub = 1 }; Lessons.Apply(st, l["final"]); Scenes.ByName(l["scene"].S)(live.c, st, 2); }
            float pad = g.U(14), iw = w - pad * 2, ih = iw * Scenes.H / Scenes.W;
            var ds = new GUIStyle(g.sLabel) { fontSize = Mathf.RoundToInt(g.U(13)), normal = { textColor = Px.Col("#6b4220") } }; float dh = Mathf.Max(g.U(60), ds.CalcHeight(new GUIContent(l["desc"].T.ToString()), iw)); // a long description makes the card taller
            var r = GUILayoutUtility.GetRect(w, ih + g.U(90) + dh, GUILayout.Width(w), GUILayout.Height(ih + g.U(90) + dh));
            if (GUI.Button(r, "", g.sPanel))
            {
                if (locked) g.Later(() => g.Toast(Loc.L("Өмнөх хичээлийг эхлээд дуусга.", "Finish the earlier lesson first.")));
                else g.Later(() => g.OpenLesson(id));
            }
            var saved = GUI.color; if (locked) GUI.color = new Color(saved.r, saved.g, saved.b, 0.45f);
            live.ShowAt(new Rect(r.x + pad, r.y + pad, iw, ih));
            float y = r.y + pad + ih + g.U(10);
            var ic = Emo.Icon(l["icon"].S); if (ic != null) GUI.DrawTexture(new Rect(r.x + pad, y + g.U(2), g.U(20), g.U(20)), g.Tex(ic), ScaleMode.ScaleToFit);
            GUI.Label(new Rect(r.x + pad + g.U(26), y, iw - g.U(26), g.U(26)), l["title"].T.ToString(), new GUIStyle(g.sTitle) { fontSize = Mathf.RoundToInt(g.U(18)), wordWrap = false });
            GUI.Label(new Rect(r.x + pad, y + g.U(30), iw, dh), l["desc"].T.ToString(), ds);
            GUI.color = saved;
            float tx = r.x + pad, ty = r.yMax - pad - g.U(24);
            void Tag(string text, string col)
            {
                var ts = new GUIStyle(g.sWhite) { font = g.sLabel.font, fontSize = Mathf.RoundToInt(g.U(11)), normal = { textColor = Px.Col(col) } };
                float tw = ts.CalcSize(new GUIContent(text)).x + g.U(4); GUI.Label(new Rect(tx, ty, tw, g.U(22)), text, ts); tx += tw + g.U(6);
            }
            if (locked) Tag("🔒 " + Loc.L("Түгжээтэй", "Locked"), "#8a6d3b");
            else Tag(pr != null && pr.done ? "✓ " + Loc.L("Сурсан", "Learned") : Loc.L("Шинэ", "New"), pr != null && pr.done ? "#2e7d32" : "#344054");
            if (pr != null && pr.family > 0) Tag(Loc.L("Хамт хийсэн", "Done together"), "#c2427e");
            if (id == "ger" && !(pr != null && pr.done)) Tag(Loc.L("Нутагт гэр барих эрх нээнэ", "Unlocks your own ger in Nutag"), "#c46d12");
        }
    }

    /** Real-life family activity: what to make together, with what, and how. A grown-up confirms it was done. */
    public void FamilyCard(J l)
    {
        var f = l["family"]; string id = l["id"].S; var pr = V.Lesson(id);
        GUILayout.BeginVertical(sPanel);
        GUILayout.Label("<color=#c2427e><b>" + Loc.L("Одоо бодит амьдрал дээр", "Now in real life") + "</b></color>", sSmall);
        GUILayout.Label("<b>" + f["say"].T + "</b>", sTitle);
        GUILayout.Label("<b>" + f["what"].T + "</b>", sLabel);
        GUILayout.Label("<b>" + Loc.L("Хэрэгтэй зүйлс", "You need") + "</b>", sSmall);
        foreach (var m in f["materials"]) GUILayout.Label("• " + m.T, sLabel);
        GUILayout.Label("<b>" + Loc.L("Алхмууд", "Steps") + "</b>", sSmall);
        int k = 1; foreach (var s in f["steps"]) GUILayout.Label($"{k++}. {s.T}", sLabel);
        Small(Loc.L("Том хүн баталгаажуулна.", "A grown-up confirms."));
        if (Btn(pr.family > 0 ? Loc.L("√ Хамтдаа хийсэн!", "√ Done together!") : Loc.L("Бид хамт хийлээ! (+5 од)", "We did it together! (+5 stars)"), true, 46, pr.family == 0))
            Later(() => Open(new ParentGate(() =>
            {
                pr.family = SaveData.NowMs(); App.familyStars += 5; App.Save(); V.Save();
                var r = Reward(40, 40); Quest("together"); Sfx.Win(); Confetti(90);
                Toast(Loc.L("Гайхалтай! Гэр бүлийн +5 од", "Wonderful! +5 family stars") + $" · +{r.coins}");
                CheckAchievements();
            })));
        GUILayout.EndVertical();
    }

    // ================================================================ one lesson
    sealed class LessonPage : Page
    {
        protected override string Tab => "learn";
        readonly J l; readonly string id; readonly SceneState st = new SceneState(); readonly Live live = new Live(Scenes.W, Scenes.H); readonly Action<PxCanvas, SceneState, float> draw;
        WithPicker picker; List<Player> players = new List<Player>(); string mode = "solo"; int i, turn;
        string say; bool solved; List<J> opts; int dragK = -1, bounceK = -1; Vector2 dragPos, dragOff, bounceFrom; float bounceT = -9, popT = -9; Rect sceneRect; Vector2 lscroll; GUIStyle trayLab; Rect ghostR; string ghostT; readonly HashSet<int> wrong = new HashSet<int>();
        int tapN; float gauge; bool heating, gaugeOk; float t0; bool tfDone; string side, lastSide; Vector2? dragStart; bool dragDone; string altMsg;
        QuizRun quiz; bool finished; (int right, int n, int[] tally) result; (int coins, int xp, int level) reward; bool first, rewarded;
        public LessonPage(string id)
        {
            this.id = id; l = Lessons.ById(id); draw = Scenes.ByName(l["scene"].S);
            picker = new WithPicker(Loc.L($"“{l["title"].T.mn}” хичээлийг хэнтэй үзэх вэ?", $"Who are you doing “{l["title"].T.en}” with?"), (m, p) => { mode = m; players = p; picker = null; Show(I); });
        }
        protected override string Title => l["title"].T.ToString();
        protected override bool Shell => false;
        protected override void Header(Game g) { if (GUILayout.Button(Loc.L("Асуух", "Ask"), g.sBtn, GUILayout.Height(g.U(40)))) g.Later(() => g.Open(new BasarChat(g, Loc.L($"Вуф! Бид “{l["title"].T.mn}” хичээл үзэж байна. Ойлгомжгүй юм байвал асуугаарай!", $"Woof! We’re doing “{l["title"].T.en}”. Ask me anything you’re unsure about!"), null))); }
        bool Multi => players.Count > 1;
        J Step => i < l["steps"].Count ? l["steps"][i] : null;
        string Tp(J s) => s["type"].S;
        void Show(Game g)
        {
            say = null; solved = false; dragK = bounceK = -1; popT = -9; lscroll = Vector2.zero; wrong.Clear(); tapN = 0; gaugeOk = false; heating = false; tfDone = false; lastSide = null; altMsg = null; dragStart = null;
            if (i >= l["steps"].Count) { StartQuiz(g); return; }
            var s = Step;
            if (s.Has("ch")) st.ch = s["ch"].S; st.broken = s["broken"].B;
            if (s.Has("set")) Lessons.Apply(st, s["set"]);
            st.pull = 0; st.fx = -9;
            string ty = Tp(s);
            if (s.Has("stage") && ty != "pick" && ty != "zones" && ty != "tf") { st.stage = s["stage"].I; st.sub = ty == "tap" || ty == "hold" || ty == "timing" || ty == "drag" ? 0 : 1; }
            else if (ty == "pick" && s.Has("stage")) { st.stage = s["stage"].I - 1; st.sub = 1; }
            if (ty == "pick") opts = s["options"].OrderBy(_ => UnityEngine.Random.value).ToList();
            if (ty == "zones") st.hl = null;
            if (ty == "hold") gauge = 0.15f; if (ty == "timing") { gauge = 1; t0 = Time.time; }
            var pr = g.V.Lesson(id); pr.step = Mathf.Max(pr.step, i); g.V.Save();
            turn++;
        }
        void Success(J s) { Sfx.Good(); if (s.Has("stage")) { st.stage = s["stage"].I; st.sub = 1; } say = s.Has("after") ? s["after"].T.ToString() : null; solved = true; }
        void Next(Game g) { i++; Show(g); }
        void StartQuiz(Game g)
        {
            var fin = l["final"]; if (fin.Has("stage")) st.stage = fin["stage"].I; st.sub = 1; if (fin.Has("ch")) st.ch = fin["ch"].S; st.hl = null;
            quiz = new QuizRun(l["topic"].S, Multi ? Mathf.Max(3, players.Count * 2) : 3, players, (right, n, tally) => Finish(g, right, n, tally));
            quiz.Start(g);
        }
        void Finish(Game g, int right, int n, int[] tally)
        {
            var pr = g.V.Lesson(id); first = !pr.done; float boost = Multi ? 1.5f : 1;
            pr.done = true; pr.best = Mathf.Max(pr.best, Multi ? tally.Max() : right); SaveData.Add(pr.with, mode, 1); g.V.Save();
            if (first) { reward = g.Reward(Mathf.RoundToInt(50 * boost), Mathf.RoundToInt(60 * boost)); rewarded = true; g.App.LogActivity("lesson", id, g.V.id); }
            else if (Multi) { reward = g.Reward(20, 25); rewarded = true; }
            g.Quest("lesson"); // every finished lesson counts for quests
            g.NoteTogether(mode, players, id); g.CheckAchievements();
            Sfx.Win(); g.Confetti(70);
            result = (right, n, tally); finished = true;
        }

        public override void Tick(Game g, float dt)
        {
            var s = Step; if (s == null || picker != null) return;
            string ty = Tp(s);
            if (ty == "hold" && !gaugeOk)
            {
                gauge += heating ? dt * 0.32f : -dt * 0.04f; gauge = Mathf.Max(0.1f, gauge);
                if (gauge > 1.02f) { heating = false; gauge = 0.3f; st.over = true; Sfx.Bad(); say = s.Has("over") ? s["over"].T.ToString() : Loc.L("Ой! Сүү халилаа. Дахиад болгоомжтой оролдоё.", "Oops! It boiled over. Try again, carefully."); g.StartCoroutine(OverOff()); }
                st.temp = gauge; st.heat = heating;
            }
            if (ty == "timing" && !gaugeOk) { gauge = 0.62f + 0.38f * Mathf.Cos((Time.time - t0) * 1.5f); st.temp = gauge; }
        }
        System.Collections.IEnumerator OverOff() { yield return new WaitForSeconds(0.9f); st.over = false; }
        void CheckGauge(J s)
        {
            if (gaugeOk) return; float lo = s["lo"].F, hi = s["hi"].F; bool timing = Tp(s) == "timing";
            if (gauge >= lo && gauge <= hi) { gaugeOk = true; heating = false; Success(s); }
            else if (timing || gauge < lo) { if (timing) Sfx.Bad(); say = timing ? Loc.L("Арай эрт эсвэл оройтлоо. Ногоон хэсгийг хүлээ!", "A bit early or late. Wait for the green zone!") : Loc.L("Арай буцлаагүй байна. Дахиад дараад бариарай.", "Not boiling yet. Press and hold again."); }
        }

        public override void Draw(Game g)
        {
            if (picker != null)
            {
                g.Box(new Rect(0, 0, Screen.width, Screen.height), Px.Col("#f6efe0"));
                var safe = Screen.safeArea; float w = Mathf.Min(safe.width - g.U(16), g.U(600));
                GUILayout.BeginArea(new Rect(safe.x + (safe.width - w) / 2, Screen.height - safe.yMax + g.U(8), w, safe.height - g.U(16)));
                GUILayout.BeginHorizontal(); if (GUILayout.Button("←", g.sBtn, GUILayout.Width(g.U(48)), GUILayout.Height(g.U(44)))) g.Later(g.Close); GUILayout.Label(Title, g.sTitle); GUILayout.EndHorizontal();
                GUILayout.FlexibleSpace(); GUILayout.BeginVertical(g.sPanel); picker.Draw(g); GUILayout.EndVertical(); GUILayout.FlexibleSpace();
                GUILayout.EndArea(); return;
            }
            if (finished || quiz != null) { base.Draw(g); return; }
            // full screen while a lesson runs: only the close button, the progress dots, the scene and the instruction
            g.Box(new Rect(0, 0, Screen.width, Screen.height), Px.Col(Bg));
            var sf = Screen.safeArea; float fw = Mathf.Min(sf.width - g.U(16), g.U(1400)); // wide enough that the picture can fill a desktop screen
            GUILayout.BeginArea(new Rect(sf.x + (sf.width - fw) / 2, Screen.height - sf.yMax + g.U(6), fw, sf.height - g.U(12)));
            GUILayout.BeginHorizontal(); if (GUILayout.Button("←", g.sBtn, GUILayout.Width(g.U(44)), GUILayout.Height(g.U(36)))) g.Later(g.Close); if (GUILayout.Button("?", g.sBtn, GUILayout.Width(g.U(44)), GUILayout.Height(g.U(36)))) g.Later(() => g.Open(new BasarChat(g, Loc.L($"Вуф! Бид “{l["title"].T.mn}” хичээл үзэж байна. Ойлгомжгүй юм байвал асуугаарай!", $"Woof! We’re doing “{l["title"].T.en}”. Ask me anything you’re unsure about!"), null)));
            GUILayout.Label(Dots(), g.sLabel, GUILayout.Height(g.U(36))); GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            ghostT = null; Body(g);
            if (ghostT != null) { g.Box(new Rect(ghostR.x + g.U(3), ghostR.y + g.U(4), ghostR.width, ghostR.height), new Color(0, 0, 0, 0.25f)); GUI.Box(ghostR, "", g.sSel); GUI.Label(ghostR, ghostT, trayLab); }
            GUILayout.EndArea();
        }
        string Dots() { int n = l["steps"].Count; return string.Concat(Enumerable.Range(0, n).Select(k => k < i ? "<color=#2ea35f>●</color>" : k == i ? "<color=#3f76db>●</color>" : "○")) + (i >= n ? " <color=#3f76db>?</color>" : " ?"); }
        protected override void Body(Game g)
        {
            bool run = !finished && quiz == null;
            if (!run) GUILayout.Label(Dots(), g.sLabel);
            draw(live.c, st, Time.time);
            float avail = Screen.height / g.UiScale; // the picture takes all the height but what the tray, instruction and buttons below need
            var rr = live.Show(g, run ? Mathf.Max(avail * 0.38f, avail - 330) : Mathf.Min(260, avail * 0.42f)); sceneRect = rr;
            var e = Event.current; var s = Step;
            if (s != null && Tp(s) == "zones" && !solved && e.type == EventType.MouseDown && rr.Contains(e.mousePosition))
            {
                var p = live.Pick(e.mousePosition); string z = Scenes.ZoneAt(l["scene"].S, p.x, p.y); e.Use();
                if (z != null) g.Later(() => { st.hl = z; st.hlBad = z != s["zone"].S; if (z == s["zone"].S) Success(s); else { Sfx.Bad(); say = Loc.L("Тэнд биш. Дахиад оролдоорой!", "Not there. Try again!"); g.StartCoroutine(ClearHl()); } });
            }
            if (run && s != null && s.Has("drop") && (Tp(s) == "pick" || Tp(s) == "tap")) DropTray(g, s);
            if (run) lscroll = g.BeginScroll(lscroll);
            GUILayout.BeginVertical(g.sPanel);
            if (finished) { Done(g); GUILayout.EndVertical(); return; }
            if (quiz != null) { GUILayout.Label("<b>" + Loc.L("Басарын шалгалт", "Basar’s check") + "</b>", g.sTitle); g.Small(Loc.L("3 асуултад хариулаарай.", "Answer 3 questions.")); quiz.Draw(g); GUILayout.EndVertical(); return; }
            if (s == null) { GUILayout.EndVertical(); g.EndScroll(); return; }
            string ty = Tp(s);
            if (Multi)
            {
                var p = players[(turn - 1) % players.Count]; GUILayout.BeginHorizontal(g.sBtn); g.IconAt(ty == "learn" || ty == "story" ? Emo.Icon("📢") : p.face, 24);
                GUILayout.Label("<b>" + (ty == "learn" || ty == "story" ? Loc.L($"{p.name} чангаар уншиж өгөөрэй", $"{p.name}, read this out loud") : Loc.L($"{p.name}-ийн ээлж", $"{p.name}’s turn")) + "</b>", g.sLabel); GUILayout.EndHorizontal();
            }
            GUILayout.Label("<b>" + s["title"].T + "</b>", g.sTitle);
            g.Text(s["text"].T.ToString());
            switch (ty)
            {
                case "learn": case "story": if (g.Btn(Loc.L("Цааш →", "Next →"), true, 48)) g.Later(() => Next(g)); break;
                case "pick" when s.Has("drop"): break;
                case "pick":
                    for (int k = 0; k < opts.Count; k++)
                    {
                        var o = opts[k]; bool was = GUI.enabled; GUI.enabled = !solved && !wrong.Contains(k);
                        string mark = solved && o["ok"].B ? "<color=#2ea35f>√</color> " : wrong.Contains(k) ? "<color=#e14b3d>X</color> " : "";
                        if (g.Btn(mark + o["t"].T, false, 40)) { int kk = k; g.Later(() => { if (o["ok"].B) Success(s); else { wrong.Add(kk); Sfx.Bad(); say = Loc.L("Вуф! Дахиад бодоод үз", "Woof! Think again"); } }); }
                        GUI.enabled = was;
                    }
                    break;
                case "tf":
                    {
                        GUILayout.BeginHorizontal(); bool was = GUI.enabled; GUI.enabled = !tfDone;
                        foreach (var (v, label) in new[] { (true, "√ " + Loc.L("Зөв", "True")), (false, "X " + Loc.L("Буруу", "False")) })
                            if (g.Btn(label, false, 44)) { bool vv = v; g.Later(() => { tfDone = true; if (vv == s["answer"].B) Success(s); else { Sfx.Bad(); say = s["after"].T.ToString(); solved = true; } }); }
                        GUI.enabled = was; GUILayout.EndHorizontal();
                        break;
                    }
                case "zones": if (!solved) g.Small(Loc.L("Дээрх зураг дээр дар", "Tap the picture above")); break;
                case "tap" when s.Has("drop"): break;
                case "tap":
                    {
                        int need = s["n"].I;
                        if (g.Btn($"{s["label"].T}   {tapN} / {need}", true, 52, tapN < need)) g.Later(() => TapOnce(s));
                        break;
                    }
                case "drag": DragPad(g, s); break;
                case "hold": case "timing":
                    {
                        float lo = s["lo"].F, hi = s["hi"].F;
                        var r = GUILayoutUtility.GetRect(10, g.U(22), GUILayout.ExpandWidth(true)); g.Box(r, Px.Col("#2b1e2e"));
                        var inner = new Rect(r.x + g.U(2), r.y + g.U(2), r.width - g.U(4), r.height - g.U(4)); g.Box(inner, Px.Col(ty == "timing" ? "#93d4f6" : "#5a4a5e"));
                        g.Box(new Rect(inner.x + lo * inner.width, inner.y, (hi - lo) * inner.width, inner.height), Px.Col("#5c9a36"));
                        g.Box(new Rect(inner.x, inner.y + inner.height * 0.3f, Mathf.Clamp01(gauge) * inner.width, inner.height * 0.4f), Px.Col(ty == "timing" ? "#3f76db" : "#f39b2c"));
                        g.Box(new Rect(inner.x + Mathf.Clamp01(gauge) * inner.width - g.U(2), r.y - g.U(3), g.U(4), r.height + g.U(6)), Px.Col("#f7c646"));
                        if (ty == "hold")
                        {
                            bool was = GUI.enabled; GUI.enabled = !gaugeOk;
                            bool down = GUILayout.RepeatButton(s["label"].T.ToString(), g.sPrimary, GUILayout.MinHeight(g.U(52))) || Input.GetKey(KeyCode.Space);
                            GUI.enabled = was;
                            if (Event.current.type == EventType.Repaint) { if (down && !heating && !gaugeOk) heating = true; else if (!down && heating) { heating = false; CheckGauge(s); } }
                        }
                        else if (g.Btn(s["label"].T.ToString(), true, 52, !gaugeOk)) g.Later(() => CheckGauge(s));
                        break;
                    }
            }
            if (altMsg != null) Basar(g, altMsg);
            if (say != null) Basar(g, say);
            if (solved && ty != "learn" && ty != "story" && g.Btn(Loc.L("Цааш →", "Next →"), true, 48)) g.Later(() => Next(g));
            GUILayout.EndVertical();
            if (run) g.EndScroll();
        }
        void TapOnce(J s)
        {
            int need = s["n"].I; if (tapN >= need) return; tapN++;
            string field = s["field"].S;
            if (field == null || field == "sub") st.sub = tapN / (float)need;
            if (field != null) Lessons.SetFloat(st, field, tapN / (float)need * (s.Has("scale") ? s["scale"].F : 1));
            if (s["roll"].B) { var l2 = (st.sides ?? new string[0]).ToList(); l2.Add(new[] { "horse", "camel", "sheep", "goat" }[UnityEngine.Random.Range(0, 4)]); st.sides = l2.Skip(Mathf.Max(0, l2.Count - 4)).ToArray(); }
            if (s["tone"].B) Sfx.Chime(); else Sfx.Tap();
            if (tapN >= need) Success(s);
        }
        /** Drag and drop: the parts (pick: the answers, tap: one part to place again and again) sit in a tray; drag one onto the glowing spot in the picture. Wrong spot = it bounces back with a hint. */
        void DropTray(Game g, J s)
        {
            var d = s["drop"]; bool pick = Tp(s) == "pick"; float sc = sceneRect.width / Scenes.W;
            var zone = new Rect(sceneRect.x + d[0].F * sc, sceneRect.y + d[1].F * sc, d[2].F * sc, d[3].F * sc);
            var e = Event.current; float since = Time.time - popT;
            if (!solved) { float a = 0.55f + 0.35f * Mathf.Sin(Time.time * 5), th = g.U(3); var col = dragK >= 0 && zone.Contains(dragPos) ? new Color(0.35f, 0.9f, 0.4f, 0.55f) : new Color(1, 0.9f, 0.3f, 0.18f + 0.12f * a); g.Box(zone, col); var c = new Color(1, 0.85f, 0.15f, a); g.Box(new Rect(zone.x, zone.y, zone.width, th), c); g.Box(new Rect(zone.x, zone.yMax - th, zone.width, th), c); g.Box(new Rect(zone.x, zone.y, th, zone.height), c); g.Box(new Rect(zone.xMax - th, zone.y, th, zone.height), c); }
            if (since < 0.5f) { var pr = zone; float gr = since * g.U(60); pr = new Rect(pr.x - gr, pr.y - gr, pr.width + gr * 2, pr.height + gr * 2); var c = new Color(0.4f, 1, 0.5f, 0.8f * (1 - since * 2)); float th = g.U(4); g.Box(new Rect(pr.x, pr.y, pr.width, th), c); g.Box(new Rect(pr.x, pr.yMax - th, pr.width, th), c); g.Box(new Rect(pr.x, pr.y, th, pr.height), c); g.Box(new Rect(pr.xMax - th, pr.y, th, pr.height), c); }
            int count = pick ? opts.Count : 1; var tray = GUILayoutUtility.GetRect(10, g.U(58), GUILayout.ExpandWidth(true));
            float cw = Mathf.Min(g.U(230), (tray.width - g.U(6) * (count - 1)) / count), total = cw * count + g.U(6) * (count - 1);
            Rect Home(int k) => new Rect(tray.x + (tray.width - total) / 2 + k * (cw + g.U(6)), tray.y + g.U(4), cw, tray.height - g.U(8));
            string Label(int k) => pick ? opts[k]["t"].T.ToString() : s["label"].T.ToString();
            bool Gone() => solved || (!pick && tapN >= s["n"].I);
            GUI.Box(tray, "", g.sBtn);
            var lab = trayLab ?? (trayLab = new GUIStyle(g.sLabel) { alignment = TextAnchor.MiddleCenter, wordWrap = true, fontSize = Mathf.Max(10, Mathf.RoundToInt(g.U(13))) });
            for (int k = 0; k < count; k++)
            {
                if (Gone() || k == dragK) continue;
                var r = Home(k); bool bouncing = k == bounceK && Time.time - bounceT < 0.25f;
                if (bouncing) { float u = (Time.time - bounceT) / 0.25f; u = 1 - (1 - u) * (1 - u); var c0 = Vector2.Lerp(bounceFrom, r.center, u); r = new Rect(c0.x - r.width / 2, c0.y - r.height / 2, r.width, r.height); }
                bool bad = pick && wrong.Contains(k); var old = GUI.color; if (bad) GUI.color = new Color(1, 1, 1, 0.45f);
                GUI.Box(r, "", g.sBtn); GUI.Label(r, (bad ? "X " : "") + Label(k), lab); GUI.color = old;
                if (e.type == EventType.MouseDown && !bad && !bouncing && r.Contains(e.mousePosition) && dragK < 0) { dragK = k; dragOff = e.mousePosition - r.center; dragPos = e.mousePosition; e.Use(); }
            }
            if (dragK >= 0)
            {
                if (e.type == EventType.MouseDrag) { dragPos = e.mousePosition; e.Use(); }
                else if (e.type == EventType.MouseLeaveWindow || (e.rawType == EventType.MouseUp && e.type != EventType.MouseUp)) { bounceK = dragK; bounceFrom = dragPos - dragOff; bounceT = Time.time; dragK = -1; }
                else if (e.type == EventType.MouseUp)
                {
                    int k = dragK; dragK = -1; e.Use();
                    if (zone.Contains(e.mousePosition))
                    {
                        if (!pick || opts[k]["ok"].B) { popT = Time.time; g.Later(() => { if (pick) Success(s); else { TapOnce(s); } }); }
                        else { wrong.Add(k); bounceK = k; bounceFrom = e.mousePosition - dragOff; bounceT = Time.time; g.Later(() => { Sfx.Bad(); say = Loc.L("Вуф! Энэ нь тэнд таарахгүй. Дахиад бодоод үз", "Woof! That doesn’t fit there. Think again"); }); }
                    }
                    else { bounceK = k; bounceFrom = e.mousePosition - dragOff; bounceT = Time.time; if (!tray.Contains(e.mousePosition)) g.Later(() => { Sfx.Bad(); say = Loc.L("Гэрэлтэж буй газар руу чирээрэй", "Drag it onto the glowing spot"); }); }
                }
            }
            if (dragK >= 0) { var r = Home(dragK); var c = dragPos - dragOff; ghostR = new Rect(c.x - r.width * 0.55f, c.y - r.height * 0.55f, r.width * 1.1f, r.height * 1.1f); ghostT = Label(dragK); } // drawn last, above everything
            if (!Gone()) g.Small(pick ? Loc.L("Зөв хариултыг зураг дээрх гэрэлтэж буй газар руу чир", "Drag the right answer onto the glowing spot") : $"{tapN} / {s["n"].I} · " + Loc.L("Чирж тавь", "Drag it into place"));
        }
        System.Collections.IEnumerator ClearHl() { yield return new WaitForSeconds(0.7f); if (!solved) st.hl = null; }
        static void Basar(Game g, string t) { GUILayout.BeginHorizontal(g.sBtn); g.IconAt(Px.BankharFace(1), 32); GUILayout.Label(t, g.sLabel); GUILayout.EndHorizontal(); }
        /** A hand gesture: pull the udder down, lift the ladle high and let go, press the stone. */
        void DragPad(Game g, J s)
        {
            int need = s["n"].I; string dir = s["dir"].S; const float LEN = 80;
            var r = GUILayoutUtility.GetRect(10, g.U(120), GUILayout.ExpandWidth(true)); GUI.Box(r, "", g.sBtn);
            var e = Event.current; float amount = 0;
            if (dragStart.HasValue)
            {
                Vector2 d = e.mousePosition - dragStart.Value; float len = g.U(LEN);
                amount = Mathf.Clamp01((dir == "side" ? Mathf.Abs(d.x) : dir == "down" ? d.y : -d.y) / len);
            }
            var icon = Emo.Icon(s["icon"].S) ?? Emo.Icon("✋");
            float ky = dir == "down" ? amount * g.U(LEN) * 0.6f : dir == "up" ? -amount * g.U(LEN) * 0.6f : 0, kx = s["alt"].B ? (side == "l" ? -r.width * 0.22f : side == "r" ? r.width * 0.22f : 0) : 0;
            GUI.DrawTexture(new Rect(r.center.x - g.U(18) + kx, r.center.y - g.U(18) + ky, g.U(36), g.U(36)), g.Tex(icon));
            GUI.Label(new Rect(r.x, r.y + g.U(4), r.width, g.U(20)), (dir == "down" ? "↓ " : dir == "up" ? "↑ " : "← → ") + s["label"].T, new GUIStyle(g.sSmall) { alignment = TextAnchor.UpperCenter });
            GUI.Label(new Rect(r.x, r.yMax - g.U(22), r.width, g.U(20)), $"{tapN} / {need}", new GUIStyle(g.sLabel) { alignment = TextAnchor.UpperCenter });
            if (tapN >= need) return;
            if (e.type == EventType.MouseDown && r.Contains(e.mousePosition)) { dragStart = e.mousePosition; dragDone = false; side = e.mousePosition.x < r.center.x ? "l" : "r"; st.side = side; e.Use(); }
            else if (e.type == EventType.MouseDrag && dragStart.HasValue)
            {
                st.pull = amount;
                if (!s["release"].B && amount >= 1 && !dragDone) { dragDone = true; Stroke(g, s); }
                e.Use();
            }
            else if (e.type == EventType.MouseUp && dragStart.HasValue)
            {
                if (s["release"].B ? amount >= s["need"].F : dragDone) { if (s["release"].B) Stroke(g, s); }
                else if (amount > 0.15f && s.Has("low")) altMsg = s["low"].T.ToString();
                dragStart = null; st.pull = 0; e.Use();
            }
        }
        void Stroke(Game g, J s)
        {
            if (s["alt"].B && side == lastSide) { Sfx.Bad(); altMsg = s["altHint"].T.ToString(); return; }
            lastSide = side; tapN++; st.fx = Time.time; altMsg = null;
            string field = s["field"].S; if (field != null) Lessons.SetFloat(st, field, tapN / (float)s["n"].I); else st.sub = tapN / (float)s["n"].I;
            if (s["tone"].B) Sfx.Chime(); else Sfx.Pop();
            if (tapN >= s["n"].I) Success(s);
        }
        void Done(Game g)
        {
            GUILayout.BeginVertical(g.sBtn);
            var ic = Emo.Icon(l["icon"].S); if (ic != null) g.Picture(ic, 48);
            GUILayout.Label("<b>" + Loc.L("Хичээл дууслаа!", "Lesson complete!") + "</b>", new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            g.Text(Loc.L($"Басарын асуулт: {result.right} / {result.n} зөв", $"Basar’s quiz: {result.right} / {result.n} correct"));
            if (Multi) { g.Scoreboard(players, result.tally); g.Small(mode == "family" ? Loc.L("Гэр бүлээрээ сурсан тул +50% шагнал, гэр бүлийн +2 од!", "Learned with family: +50% reward and +2 family stars!") : Loc.L("Найзуудтайгаа сурсан тул +50% шагнал!", "Learned with friends: +50% reward!")); }
            if (rewarded) g.Text($"+{reward.coins} {Loc.L("зоос", "coins")} · +{reward.xp} XP");
            if (id == "ger" && first) g.Text("<b>" + Loc.L("Нутагт өөрийн гэрээ барих эрх нээгдлээ! Гэр хорооллын хоосон газар очоорой.", "You can now build your own ger in Nutag! Visit an empty lot in the ger neighbourhood.") + "</b>");
            GUILayout.EndVertical();
            g.FamilyCard(l);
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Бусад хичээл", "More lessons"))) g.Later(g.Close);
            if (g.Btn(Loc.L("Нутаг руу", "To Nutag"), true)) g.Later(g.CloseAll);
            GUILayout.EndHorizontal();
        }
    }
}
