// Profiles: mascot animals, the 3-picture password, family faces, logging in and registering (js/data.js and the auth
// screen of js/app.js). The web version shows emoji here; Unity can't draw colour emoji, so each one is pixel art.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public static partial class Px
{
    static readonly string[] MASCOT_EMOJI = { "🐎", "🐫", "🦅", "🐆", "🐺", "🐑", "🐐", "🐂", "🦌", "🦊", "🐿️", "🐻" };
    static readonly string[] PIC_EMOJI = { "⛺", "🐎", "🥛", "🏹", "🌙", "☀️", "🐕", "🦴", "🎻" };
    static readonly string[] FACE_EMOJI = { "👩", "👨", "👵", "👴", "🧑", "👧", "👦", "🧒", "👶", "🧕", "👩‍🦳", "👨‍🦳" };
    public const int FACE_COUNT = 12;
    /** The 12 mascot animals, the 9 pictures of the picture password and the family faces: the web version's pixel icons. */
    public static PxCanvas Mascot(int i) => Emo.Icon(MASCOT_EMOJI[((i % 12) + 12) % 12]);
    public static PxCanvas PicKey(int i) => Emo.Icon(PIC_EMOJI[((i % 9) + 9) % 9]);
    public static PxCanvas Face(int i) => Emo.Icon(FACE_EMOJI[((i % FACE_COUNT) + FACE_COUNT) % FACE_COUNT]);
    public static PxCanvas Portrait(Look l) { var x = new PxCanvas(16, 18); x.Blit(Char(l, 0, 0), 0, -2); return x; }
}

public static class Profiles
{
    public sealed class Mascot { public Tx name, fact; }
    static Mascot M(string mn, string en, string fmn, string fen) => new Mascot { name = new Tx(mn, en), fact = new Tx(fmn, fen) };
    public static readonly Mascot[] MASCOTS =
    {
        M("Хурдан морь", "Swift horse", "Монголд хүнээс олон адуу бий!", "Mongolia has more horses than people!"),
        M("Тэвчээртэй тэмээ", "Patient camel", "Хоёр бөхтэй тэмээ Говьд амьдардаг.", "Two-humped camels live in the Gobi."),
        M("Сэргэлэн бүргэд", "Clever eagle", "Бүргэдчид бүргэдээр ан хийдэг.", "Eagle hunters hunt with golden eagles."),
        M("Цоохор ирвэс", "Snow leopard", "Ирвэс өндөр ууланд нуугдаж амьдардаг.", "Snow leopards hide high in the mountains."),
        M("Бөртэ чоно", "Blue wolf", "Нууц товчоо Бөртэ чоноор эхэлдэг.", "The Secret History begins with a blue wolf."),
        M("Номхон хонь", "Gentle sheep", "Хонины ноосоор эсгий хийдэг.", "Felt for the ger is made from sheep’s wool."),
        M("Сэргэг ямаа", "Lively goat", "Ямааны ноолуур дэлхийд алдартай.", "Mongolian cashmere is famous worldwide."),
        M("Хүчит сарлаг", "Strong yak", "Сарлагийн сүү маш тослог.", "Yak milk is very creamy."),
        M("Цаа буга", "Reindeer", "Цаатан ард цаа бугаа маллдаг.", "The Tsaatan people herd reindeer."),
        M("Ухаалаг үнэг", "Clever fox", "Үнэг ардын үлгэрт их гардаг.", "Foxes star in many folk tales."),
        M("Зурам", "Ground squirrel", "Зурам тал нутагт нүх ухаж амьдардаг.", "Ground squirrels dig burrows on the steppe."),
        M("Мазаалай", "Gobi bear", "Мазаалай зөвхөн Монголын Говьд бий.", "The Gobi bear lives only in Mongolia’s Gobi."),
    };
}

public sealed partial class Game
{
    public AppState App;

    /** Switches to a child's profile: their progress, their place in Нутаг, their language stays the device's. */
    public void Enter(SaveData p)
    {
        V = p; App.activeId = p.id; App.loggedIn = true; App.Save();
        bool okPos = V.hasPos && !World.Blocked(Mathf.FloorToInt(V.posX + 0.5f), Mathf.FloorToInt(V.posY + 0.82f));
        px = okPos ? V.posX : 17; py = okPos ? V.posY : 13; vx = vy = 0; path.Clear(); pending = null; riding = false; race = null;
        mx = Mathf.FloorToInt(px + 0.5f); my = Mathf.FloorToInt(py + 0.82f); camPos = new Vector2(px, py); petPos = new Vector2(px, py + 0.6f); dgx = px + 0.7f; dgy = py + 0.2f;
        Basar.history.Clear();
        CloseAll(); Quests(); Sfx.Win(); net.Connect(this);
        if (string.IsNullOrEmpty(p.eth)) { Open(new CreatePage(true)); return; } // new: build your character (ethnic group, home province, outfit) first
        Toast(Loc.L($"Тавтай морил, {p.name}!", $"Welcome, {p.name}!"));
        if (!V.tips && V.tutorialSeen > 0) Open(new TipsModal());
    }
    public void LogOut() { net.Close(); if (V != null) { SavePos(); V.Save(); } App.loggedIn = false; App.Save(); CloseAll(); V = null; Open(new AuthPage()); }

    /** Grown-ups only: solve a times table question to continue. */
    public sealed class ParentGate : Modal
    {
        readonly int a = UnityEngine.Random.Range(4, 10), b = UnityEngine.Random.Range(4, 10); readonly Action onPass; string input = "", err = "";
        public ParentGate(Action onPass) { this.onPass = onPass; }
        public override void Press(Game g) { }
        public override void Draw(Game g)
        {
            g.Picture(Px.Icon("ui:lock"), 48);
            GUILayout.Label(Loc.L("Том хүний хэсэг", "Grown-ups only"), new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            GUILayout.Label(Loc.L("Үргэлжлүүлэхийн тулд бодоорой:", "Solve this to continue:"), new GUIStyle(g.sLabel) { alignment = TextAnchor.MiddleCenter });
            GUILayout.Label($"{a} × {b} = ?", new GUIStyle(g.sBig) { });
            input = g.NumPad(input);
            if (err != "") GUILayout.Label($"<color=#e14b3d>{err}</color>", new GUIStyle(g.sLabel) { alignment = TextAnchor.MiddleCenter });
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Болих", "Cancel"))) g.Later(g.Close);
            if (g.Btn(Loc.L("Нэвтрэх", "Enter"), true)) g.Later(() => { if (int.TryParse(input, out var n) && n == a * b) { g.Close(); onPass(); } else { err = Loc.L("Буруу байна. Дахин оролдоорой.", "Not quite. Try again."); input = ""; Sfx.Bad(); } });
            GUILayout.EndHorizontal();
        }
    }
    /** Big number buttons (easier than the phone keyboard for little ones). */
    public string NumPad(string v)
    {
        GUILayout.Label(v == "" ? " " : v, new GUIStyle(sBtn) { fontSize = PxSize(U(22f) * 1.3f), fontStyle = FontStyle.Bold }, GUILayout.MinHeight(U(44)));
        string[] keys = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK" };
        for (int r = 0; r < 4; r++)
        {
            GUILayout.BeginHorizontal();
            for (int c = 0; c < 3; c++) { string k = keys[r * 3 + c]; if (k == "OK") { GUILayout.Label("", GUILayout.MinHeight(U(40))); continue; } if (GUILayout.Button(k, sBtn, GUILayout.MinHeight(U(40)))) { Sfx.Tap(); v = k == "←" ? (v.Length > 0 ? v.Substring(0, v.Length - 1) : "") : v.Length < 3 ? v + k : v; } }
            GUILayout.EndHorizontal();
        }
        return v;
    }

    // ================================================================ pages: full-screen screens with a title bar and scrolling content
    public abstract class Page : Modal
    {
        public override bool FullScreen => true;
        protected Vector2 scroll; protected virtual bool Back => true; protected virtual string Bg => "#f6efe0";
        protected abstract string Title { get; }
        protected abstract void Body(Game g);
        protected virtual void Header(Game g) { }
        public override void Press(Game g) { }
        public override void Draw(Game g)
        {
            g.Box(new Rect(0, 0, Screen.width, Screen.height), Px.Col(Bg));
            var safe = Screen.safeArea; var area = new Rect(safe.x, Screen.height - safe.yMax, safe.width, safe.height);
            float w = Mathf.Min(area.width - g.U(16), g.U(760)); // wide pages, but not edge to edge on a laptop
            GUILayout.BeginArea(new Rect(area.x + (area.width - w) / 2, area.y + g.U(8), w, area.height - g.U(16)));
            GUILayout.BeginHorizontal();
            if (Back && GUILayout.Button("←", g.sBtn, GUILayout.Width(g.U(48)), GUILayout.Height(g.U(44)))) g.Later(g.Close);
            GUILayout.Label(Title, new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleLeft }, GUILayout.Height(g.U(44)));
            GUILayout.FlexibleSpace(); Header(g);
            GUILayout.EndHorizontal();
            scroll = g.BeginScroll(scroll);
            Body(g);
            g.EndScroll();
            GUILayout.EndArea();
        }
    }

    // ================================================================ log in or register
    public sealed class AuthPage : Page
    {
        string tab; SaveData picking; readonly List<int> sel = new List<int>(); bool shake;
        // registering
        int step; string name = "", err = "", ageText = ""; int age = 8, avatar; readonly Live live = new Live(160, 90);
        public AuthPage() { tab = I.App.profiles.Count > 0 ? "login" : "register"; }
        protected override bool Back => false;
        public override bool CanEscape => false;
        protected override string Title => "Naadamy";
        protected override string Bg => "#76b947";
        protected override void Header(Game g) { if (GUILayout.Button(Loc.En ? "МН" : "EN", g.sBtn, GUILayout.Width(g.U(56)), GUILayout.Height(g.U(40)))) { Loc.En = !Loc.En; g.App.en = Loc.En; g.App.Save(); } }
        public override void Draw(Game g)
        {
            // the animated steppe behind: gers, galloping foals, sheep and Basar running along
            var x = live.c; float t = Time.time; var bg = new PxCanvas(Scenes.W, Scenes.H); Scenes.Bg(bg, t); x.BlitScaled(bg, 0, 0, 160, 90);
            x.BlitScaled(Px.GerSprite("#3f76db", "#e14b3d"), 18, 50, 26, 27); x.BlitScaled(Px.GerSprite("#e14b3d", "#e9a91f"), 112, 54, 22, 23);
            int[][] sh = { new[] { 60, 74 }, new[] { 76, 78 }, new[] { 92, 72 } }; for (int i = 0; i < 3; i++) x.Blit(Px.Animal("sheep", (int)(t * 2 + i) % 2), sh[i][0], sh[i][1]);
            float run = (t * 22) % 220 - 30; int f = 1 + (int)(t * 8) % 2;
            x.Blit(Px.Animal("foal", f), Js.Round(run), 64); x.Blit(Px.Animal("foal", 3 - f), Js.Round(run - 18), 67); x.Blit(Px.Bankhar(f), Js.Round(run - 42), 66);
            float k = Mathf.Max(Screen.width / 160f, Screen.height / 90f); live.ShowAt(new Rect((Screen.width - 160 * k) / 2, (Screen.height - 90 * k) / 2, 160 * k, 90 * k));
            var safe = Screen.safeArea; float w = Mathf.Min(safe.width - g.U(16), g.U(600));
            GUILayout.BeginArea(new Rect(safe.x + (safe.width - w) / 2, Screen.height - safe.yMax + g.U(8), w, safe.height - g.U(16)));
            GUILayout.BeginHorizontal(); GUILayout.FlexibleSpace(); Header(g); GUILayout.EndHorizontal();
            GUILayout.FlexibleSpace();
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.BeginHorizontal(); g.IconAt(Px.Icon("ui:logo"), 44); GUILayout.BeginVertical(); GUILayout.Label("<b>Naadamy</b>", g.sTitle); g.Small(Loc.L("Монгол өв соёлоо гэр бүл, найзуудтайгаа хамт сурцгаая", "Learn Mongolian heritage together with family and friends")); GUILayout.EndVertical(); GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            bool was = GUI.enabled; GUI.enabled = g.App.profiles.Count > 0;
            if (GUILayout.Button(Loc.L("Нэвтрэх", "Log in"), tab == "login" ? g.sPrimary : g.sBtn, GUILayout.MinHeight(g.U(36)))) g.Later(() => { tab = "login"; picking = null; });
            GUI.enabled = was;
            if (GUILayout.Button(Loc.L("Бүртгүүлэх", "Register"), tab == "register" ? g.sPrimary : g.sBtn, GUILayout.MinHeight(g.U(36)))) g.Later(() => { tab = "register"; step = 0; });
            GUILayout.EndHorizontal();
            scroll = g.BeginScroll(scroll, safe.height - g.U(200)); // whatever is left under the header; the rest scrolls
            if (tab == "login" && g.App.profiles.Count > 0) Login(g); else Register(g);
            g.EndScroll();
            GUILayout.EndVertical();
            if (GUILayout.Button(Loc.L("Төслийн тухай", "About the project"), g.sSmall)) g.Later(() => g.Open(new AboutPage()));
            GUILayout.FlexibleSpace();
            GUILayout.EndArea();
        }
        protected override void Body(Game g) { }
        void Login(Game g)
        {
            if (picking != null)
            {
                GUILayout.BeginHorizontal(); g.IconAt(Px.Mascot(picking.avatar), 36); GUILayout.Label($"<b>{picking.name}</b>", g.sTitle); GUILayout.EndHorizontal();
                g.Small(Loc.L("Нууц 3 зургаа дарааллаар нь дар", "Tap your 3 secret pictures in order"));
                PicPad(g, code => { if (code == picking.code) g.Enter(picking); else { Sfx.Bad(); sel.Clear(); } });
                GUILayout.BeginHorizontal();
                if (g.Btn(Loc.L("Буцах", "Back"), false, 32)) g.Later(() => { picking = null; sel.Clear(); });
                var p = picking; if (g.Btn(Loc.L("Мартсан? (том хүн)", "Forgot? (grown-up)"), false, 32)) g.Later(() => g.Open(new ParentGate(() => { p.code = ""; p.Save(); g.Enter(p); })));
                GUILayout.EndHorizontal();
                return;
            }
            GUILayout.Label("<b>" + Loc.L("Хэн тоглох вэ?", "Who’s playing?") + "</b>", g.sLabel);
            foreach (var id in g.App.profiles.ToList())
            {
                var p = SaveData.Load(id);
                GUILayout.BeginHorizontal(g.sBtn);
                g.IconAt(Px.Mascot(p.avatar), 40);
                GUILayout.Label($"<b>{p.name}</b>\n<size={Game.PxSize(g.U(11f) * 1.3f)}>{p.age} {Loc.L("нас", "yrs")}{(p.code != "" ? " · " + Loc.L("нууцтай", "locked") : "")}</size>", g.sLabel);
                GUILayout.FlexibleSpace();
                if (g.SmallBtn(Loc.L("Тоглох", "Play"))) { var pp = p; g.Later(() => { if (pp.code == "") g.Enter(pp); else { picking = pp; sel.Clear(); } }); }
                GUILayout.EndHorizontal();
            }
        }
        void PicPad(Game g, Action<string> onPick)
        {
            GUILayout.BeginHorizontal(); GUILayout.FlexibleSpace();
            for (int k = 0; k < 3; k++) { var r = GUILayoutUtility.GetRect(g.U(36), g.U(36), GUILayout.Width(g.U(36))); GUI.Box(r, "", g.sBtn); if (k < sel.Count) GUI.DrawTexture(new Rect(r.x + g.U(4), r.y + g.U(4), r.width - g.U(8), r.height - g.U(8)), g.Tex(Px.PicKey(sel[k]))); }
            GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            for (int row = 0; row < 3; row++)
            {
                GUILayout.BeginHorizontal();
                for (int c = 0; c < 3; c++)
                {
                    int i = row * 3 + c; var r = GUILayoutUtility.GetRect(g.U(60), g.U(56), GUILayout.ExpandWidth(true));
                    if (GUI.Button(r, "", g.sBtn) && sel.Count < 3) { Sfx.Tap(); g.Later(() => { sel.Add(i); if (sel.Count == 3) { string code = string.Join("-", sel); onPick(code); } }); }
                    float s = Mathf.Min(r.height, r.width) - g.U(14); GUI.DrawTexture(new Rect(r.center.x - s / 2, r.center.y - s / 2, s, s), g.Tex(Px.PicKey(i)));
                }
                GUILayout.EndHorizontal();
            }
        }
        void Basar(Game g, string text) { GUILayout.BeginHorizontal(g.sBtn); g.IconAt(Px.BankharFace(1), 40); GUILayout.Label(text, g.sLabel); GUILayout.EndHorizontal(); }
        void Register(Game g)
        {
            GUILayout.Label(string.Concat(Enumerable.Range(0, 4).Select(k => k <= step ? "<color=#3f76db>●</color> " : "○ ")), g.sLabel);
            if (step == 0)
            {
                Basar(g, Loc.L("Вуф! Би Басар. Чиний нэрийг хэн гэдэг вэ?", "Woof! I’m Basar. What’s your name?"));
                name = GUILayout.TextField(name, 20, new GUIStyle(g.sBtn) { fontSize = Game.PxSize(g.U(18f) * 1.3f) }, GUILayout.MinHeight(g.U(44)));
                if (err != "") GUILayout.Label($"<color=#e14b3d>{err}</color>", g.sLabel);
                if (g.Btn(Loc.L("Цааш →", "Next →"), true, 46)) g.Later(() => { if (name.Trim() == "") err = Loc.L("Нэрээ бичээрэй", "Please write your name"); else { err = ""; name = name.Trim(); step = 1; } });
            }
            else if (step == 1)
            {
                Basar(g, Loc.L($"Сайн уу, {name}! Хэдэн настай вэ? Насаа бичээрэй. Том хүмүүс ч тоглож болно!", $"Hi {name}! How old are you? Write your age. Grown-ups can play too!"));
                // the age is written, not picked from a list: any age from 3 to 120
                ageText = new string(GUILayout.TextField(ageText, 3, new GUIStyle(g.sBtn) { fontSize = Game.PxSize(g.U(18f) * 1.3f) }, GUILayout.MinHeight(g.U(44))).Where(char.IsDigit).ToArray());
                if (err != "") GUILayout.Label($"<color=#e14b3d>{err}</color>", g.sLabel);
                GUILayout.BeginHorizontal();
                if (g.Btn("←")) g.Later(() => { err = ""; step = 0; });
                if (g.Btn(Loc.L("Цааш →", "Next →"), true)) g.Later(() =>
                {
                    if (int.TryParse(ageText, out int a) && a >= 3 && a <= 120) { age = a; err = ""; step = 2; }
                    else err = ageText == "" ? Loc.L("Насаа бичээрэй", "Please write your age") : Loc.L("3-аас 120 хүртэлх насаа бичээрэй", "Write an age from 3 to 120");
                });
                GUILayout.EndHorizontal();
            }
            else if (step == 2)
            {
                Basar(g, Loc.L("Өөрийн сахиус амьтнаа сонго! ", "Pick your mascot animal! ") + Profiles.MASCOTS[avatar].fact);
                for (int r = 0; r < 3; r++)
                {
                    GUILayout.BeginHorizontal();
                    for (int c = 0; c < 4; c++)
                    {
                        int i = r * 4 + c; var rr = GUILayoutUtility.GetRect(g.U(70), g.U(64), GUILayout.ExpandWidth(true));
                        if (GUI.Button(rr, "", i == avatar ? g.sPrimary : g.sBtn)) { avatar = i; Sfx.Pop(); }
                        GUI.DrawTexture(new Rect(rr.center.x - g.U(18), rr.y + g.U(4), g.U(36), g.U(36)), g.Tex(Px.Mascot(i)));
                        GUI.Label(new Rect(rr.x, rr.y + g.U(40), rr.width, g.U(22)), Profiles.MASCOTS[i].name.ToString(), new GUIStyle(g.sSmall) { alignment = TextAnchor.MiddleCenter, wordWrap = false, fontSize = Game.PxSize(g.U(12)) });
                    }
                    GUILayout.EndHorizontal();
                }
                GUILayout.BeginHorizontal();
                if (g.Btn("←")) g.Later(() => step = 1);
                if (g.Btn(Loc.L("Цааш →", "Next →"), true)) g.Later(() => { step = 3; sel.Clear(); });
                GUILayout.EndHorizontal();
            }
            else
            {
                Basar(g, Loc.L("Сүүлийнх нь: 3 нууц зураг сонгоод профайлаа хамгаал. Дараалал нь чухал шүү!", "Last one: choose 3 secret pictures to protect your profile. The order matters!"));
                void Finish(string code) { var p = SaveData.Create(name, age, avatar, code); g.App.profiles.Add(p.id); g.App.Save(); g.Enter(p); }
                PicPad(g, Finish);
                GUILayout.BeginHorizontal();
                if (g.Btn("←")) g.Later(() => { step = 2; sel.Clear(); });
                if (g.Btn(Loc.L("Алгасах", "Skip"))) g.Later(() => Finish(""));
                GUILayout.EndHorizontal();
            }
        }
        public override void Closed(Game g) { }
    }
}
