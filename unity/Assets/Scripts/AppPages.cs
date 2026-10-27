// The app around Нутаг (js/app.js): the main menu, the parent dashboard, the family memory book (voices recorded on this
// device), settings and the about page.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    // ================================================================ the main menu (☰ in Нутаг)
    sealed class MenuModal : Modal
    {
        public override void Draw(Game g)
        {
            var V = g.V; var e = Aimags.EthnicById(V.eth); var a = Aimags.ById(V.aimag);
            GUILayout.BeginHorizontal(g.sBtn); g.IconAt(Px.Mascot(V.avatar), 44);
            GUILayout.BeginVertical(); GUILayout.Label("<b>" + V.name + "</b>", g.sTitle);
            g.Small($"{V.age} {Loc.L("настай", "years old")}" + (e != null ? " · " + e.name : " · " + Profiles.MASCOTS[V.avatar].name) + (a != null ? " · " + a.name : ""));
            GUILayout.EndVertical(); GUILayout.EndHorizontal();
            void Item(string emoji, string label, Action run) // the whole row is the button, not only the arrow at its end
            {
                var r = GUILayoutUtility.GetRect(g.U(10), g.U(46), GUILayout.ExpandWidth(true));
                if (GUI.Button(r, "", g.sBtn)) g.Later(() => { g.Close(); run(); });
                float s = g.U(30); GUI.DrawTexture(new Rect(r.x + g.U(8), r.center.y - s / 2, s, s), g.Tex(Emo.Icon(emoji) ?? Px.Icon("ui:star")));
                GUI.Label(new Rect(r.x + g.U(46), r.y, r.width - g.U(80), r.height), label, new GUIStyle(g.sLabel) { alignment = TextAnchor.MiddleLeft, wordWrap = false });
                GUI.Label(new Rect(r.xMax - g.U(30), r.y, g.U(22), r.height), ">", new GUIStyle(g.sLabel) { alignment = TextAnchor.MiddleCenter });
            }
            Item("🏹", Loc.L("Түүхийн аялал: Чингис хаан", "Story mode: Chinggis Khaan"), () => g.OpenStory());
            Item("📚", Loc.L("Өв соёлын сургууль", "Heritage school"), () => g.Open(new LearnPage()));
            Item("✍️", Loc.L("Монгол бичгийн академи", "Mongol script academy"), () => g.Open(new BichigPage()));
            Item("🐕", Loc.L("Басартай ярилцах", "Talk with Basar"), () => g.OpenBasar());
            Item("🏅", Loc.L("Миний амжилтууд", "My achievements"), () => g.Open(new AchievementsPage()));
            Item("🛂", Loc.L("Аймгийн паспорт", "Aimag passport"), () => g.Open(new PassportPage()));
            Item("👕", Loc.L("Хувцас", "Wardrobe"), () => g.Open(new WardrobeModal()));
            Item("🎨", Loc.L("Дүрээ өөрчлөх", "Change my character"), () => g.Open(new CreatePage(false)));
            Item("👨‍👩‍👧", Loc.L("Гэр бүл (том хүн)", "Family (grown-ups)"), () => g.OpenFamily());
            Item("🎙️", Loc.L("Гэр бүлийн дурсамж", "Family memory book"), () => g.Open(new MemoriesPage()));
            Item("❓", Loc.L("Болормаатай Нутгаар аялах", "Tour Nutag with Bolormaa"), () => g.StartTutorial(true));
            Item("⚙️", Loc.L("Тохиргоо", "Settings"), () => g.Open(new SettingsModal()));
            Item("ℹ️", Loc.L("Төслийн тухай", "About the project"), () => g.Open(new AboutPage()));
            if (g.Btn(Loc.L("Гарах / Профайл солих", "Log out / switch profile"), false, 36)) g.Later(g.LogOut);
        }
        public override void Press(Game g) => g.Close();
    }

    sealed class SettingsModal : Modal
    {
        string server;
        public override void Draw(Game g)
        {
            server ??= g.V.server;
            g.Title(Loc.L("Тохиргоо", "Settings"));
            GUILayout.BeginHorizontal(); g.Text(Loc.L("Хэл", "Language")); GUILayout.FlexibleSpace();
            if (GUILayout.Button(Loc.En ? "English → Монгол" : "Монгол → English", g.sBtn, GUILayout.MinHeight(g.U(36)))) { Loc.En = !Loc.En; g.App.en = Loc.En; g.App.Save(); }
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal(); g.Text(Loc.L("Дуу", "Sound")); GUILayout.FlexibleSpace();
            if (GUILayout.Button(g.App.sound ? Loc.L("Асаалттай", "On") : Loc.L("Унтраалттай", "Off"), g.App.sound ? g.sPrimary : g.sBtn, GUILayout.MinHeight(g.U(36)))) { g.App.sound = !g.App.sound; Sfx.On = g.App.sound; g.App.Save(); }
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal(); g.Text(Loc.L("Арын хөгжим", "Background music")); GUILayout.FlexibleSpace();
            if (GUILayout.Button(Music.On ? Loc.L("Асаалттай", "On") : Loc.L("Унтраалттай", "Off"), Music.On ? g.sPrimary : g.sBtn, GUILayout.MinHeight(g.U(36)))) Music.Toggle();
            GUILayout.EndHorizontal();
            GUILayout.Label("<b>" + Loc.L("Басар AI (Claude)", "Basar AI (Claude)") + "</b>", g.sLabel);
            g.Small(Loc.L("Компьютер дээр “node server/server.js” ажиллуулж, түүний хаягийг энд бичвэл Басар AI ухаантай болно (ж: 192.168.1.10:8000). Хоосон бол офлайн мэдлэгээр ажиллана.", "Run “node server/server.js” on a computer and write its address here to give Basar AI smarts (e.g. 192.168.1.10:8000). Empty: offline knowledge."));
            GUILayout.BeginHorizontal();
            server = GUILayout.TextField(server, 80, new GUIStyle(g.sBtn) { alignment = TextAnchor.MiddleLeft }, GUILayout.MinHeight(g.U(38)));
            if (GUILayout.Button(Loc.L("Хадгалах", "Save"), g.sPrimary, GUILayout.Width(g.U(100)), GUILayout.MinHeight(g.U(38)))) g.Later(() => { g.V.server = server.Trim(); g.V.Save(); if (g.V.server != "") { g.App.server = g.V.server; g.App.Save(); } Basar.Recheck(); g.net.Connect(g); g.StartCoroutine(Basar.Check(g)); g.Toast(Loc.L("Хадгаллаа", "Saved")); });
            GUILayout.EndHorizontal();
            g.Small(Basar.ai ? Loc.L("● Басар AI ухаантай ажиллаж байна.", "● Basar is running with AI.") : Loc.L("○ Басар офлайн мэдлэгээр ажиллаж байна.", "○ Basar is using offline knowledge."));
            if (g.Btn(Loc.L("Хаах", "Close"), true, 36)) g.Later(g.Close);
        }
        public override void Press(Game g) { }
    }

    // ================================================================ family / parent dashboard
    float parentUntil = -1;
    public void OpenFamily() { if (Time.realtimeSinceStartup < parentUntil) Open(new FamilyPage()); else Open(new ParentGate(() => { parentUntil = Time.realtimeSinceStartup + 600; Open(new FamilyPage()); })); }
    sealed class FamilyPage : Page
    {
        protected override string Tab => "family";
        string childId; string famName = ""; int famFace;
        protected override string Title => Loc.L("Эцэг эхийн самбар", "Parent dashboard");
        protected override void Body(Game g)
        {
            var app = g.App; var kids = app.profiles.Select(SaveData.Load).ToList();
            var child = kids.FirstOrDefault(k => k.id == childId) ?? (kids.FirstOrDefault(k => k.id == g.V.id) ?? g.V);
            if (child.id == g.V.id) child = g.V;
            int nl = Lessons.Count, done = child.learn.Count(l => l.done), together = child.learn.Count(l => l.family > 0);
            if (kids.Count > 1) { int hit = g.Chips(kids.Select(k => k.name).ToList(), kids.FindIndex(k => k.id == child.id), 80); if (hit >= 0) { var id = kids[hit].id; g.Later(() => childId = id); } }
            var next = Lessons.ALL.FirstOrDefault(l => !(child.learn.Find(x => x.id == l["id"].S)?.family > 0));
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label($"<b>{together}/{nl}</b>  " + Loc.L("Хамтдаа хийсэн бодит ажил", "Real-life activities done together"), g.sTitle);
            g.Text(next != null ? Loc.L($"Дараагийнх: “{next["family"]["what"].T.mn}”. Хүүхэд тань “{next["title"].T.mn}” хичээлээр бэлтгэнэ.", $"Next up: “{next["family"]["what"].T.en}”. Your child prepares in the “{next["title"].T.en}” lesson.") : Loc.L("Бүх гэр бүлийн ажлыг хамт хийжээ. Гайхалтай!", "You have done every family activity together. Wonderful!"));
            g.Small(Loc.L("Хүүхэд “Тоглохоо боль” гэхэд “Ээж ээ, хамтдаа гэр барьцгаая!” гэж хариулдаг болох нь бидний зорилго.", "Our goal: when you say “stop playing”, your child answers “Mom, let’s build a ger together!”"));
            GUILayout.EndVertical();
            g.Stats((Loc.L("Сурсан хичээл", "Lessons learned"), $"{done}/{nl}"), (Loc.L("Гараараа сурсан", "Learned by hand"), $"{GerRules.Done(child).Count}/{GerRules.HANDS_ON.Count}"), (Loc.L("Басарын асуулт", "Basar quiz"), $"{child.quizRight}/{child.quizTotal}"), (Loc.L("Амжилт", "Badges"), $"{child.ach.Count}/{Achievements.LIST.Count}"));
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label($"<b>{child.name}: {Loc.L("хичээлүүд", "lessons")}</b>", g.sTitle);
            var ca = Aimags.ById(child.aimag); if (ca != null) g.Small(ca.name + " · " + ca.fact);
            foreach (var l in Lessons.ALL)
            {
                var pr = child.learn.Find(x => x.id == l["id"].S);
                GUILayout.BeginHorizontal(); GUILayout.Label(l["title"].T.ToString(), g.sLabel); GUILayout.FlexibleSpace();
                GUILayout.Label(pr != null && pr.done ? "<color=#2ea35f>√ " + Loc.L("Сурсан", "Learned") + "</color>" : Loc.L("Эхлээгүй", "Not yet"), g.sSmall);
                if (pr != null && pr.family > 0) GUILayout.Label("<color=#c2427e>" + Loc.L("хамт", "together") + "</color>", g.sSmall);
                GUILayout.EndHorizontal();
            }
            g.Small(Loc.L($"Басараас {child.basarAsked} асуулт асуусан. ", $"Asked Basar {child.basarAsked} questions. ") + (Basar.ai ? Loc.L("Басар AI (Claude) ухаантай ажиллаж байна.", "Basar is running with AI (Claude).") : Loc.L("Басар офлайн мэдлэгээр ажиллаж байна.", "Basar is using offline knowledge.")));
            GUILayout.EndVertical();
            LearnedReport(g, child);
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Тохиргоо, хүртээмж", "Settings & accessibility") + "</b>", g.sTitle);
            if (g.Btn(Loc.L("Тохиргоо нээх", "Open settings"))) g.Later(() => g.Open(new SettingsModal()));
            GUILayout.EndVertical();
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Гэр бүлийн гишүүд", "Family members") + "</b>", g.sTitle);
            foreach (var f in app.family.ToList())
            {
                g.Row(Px.Face(f.face), f.Name.ToString(), null);
                if (app.family.Count > 1 && g.SmallBtn("X", false, 44)) { var ff = f; g.Later(() => { app.family.Remove(ff); app.Save(); }); }
                g.EndRow();
            }
            GUILayout.BeginHorizontal(); for (int i = 0; i < Px.FACE_COUNT; i++) { var r = GUILayoutUtility.GetRect(g.U(32), g.U(32), GUILayout.Width(g.U(32))); if (GUI.Button(r, "", i == famFace ? g.sSel : g.sBtn)) { int k = i; g.Later(() => famFace = k); } GUI.DrawTexture(new Rect(r.x + 3, r.y + 3, r.width - 6, r.height - 6), g.Tex(Px.Face(i))); } GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            famName = GUILayout.TextField(famName, 16, new GUIStyle(g.sBtn) { alignment = TextAnchor.MiddleLeft }, GUILayout.MinHeight(g.U(38)));
            if (GUILayout.Button("+", g.sPrimary, GUILayout.Width(g.U(48)), GUILayout.MinHeight(g.U(38)))) g.Later(() => { string n = famName.Trim(); if (n == "") return; app.family.Add(new FamilyMember { id = "f" + SaveData.NowMs(), mn = n, en = n, face = famFace }); app.Save(); famName = ""; });
            GUILayout.EndHorizontal();
            g.Small(Loc.L("Нэр (ж: Нагац эгч)", "Name (e.g. Auntie)"));
            GUILayout.EndVertical();
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Хүүхдүүд", "Children") + "</b>", g.sTitle);
            foreach (var k in kids)
            {
                g.Row(Px.Mascot(k.avatar), k.name, $"{k.age} {Loc.L("нас", "yrs")}" + (k.code != "" ? " · " + Loc.L("нууцтай", "locked") : ""));
                if (k.code != "" && k.fam == "" && g.SmallBtn(Loc.L("Нууц арилгах", "Remove lock"), false, 120)) { var kk = k; g.Later(() => { var p = kk.id == g.V.id ? g.V : kk; p.code = ""; p.Save(); g.Toast(Loc.L("Нууц зураг арилгалаа", "Picture password removed")); }); }
                if (kids.Count > 1 && k.id != g.V.id && g.SmallBtn(Loc.L("Хасах", "Remove"), false, 90)) { var kk = k; g.Later(() => g.Open(new ConfirmModal(Loc.L($"{kk.name}-г хасах уу?", $"Remove {kk.name}?"), Loc.L("Буцаах боломжгүй.", "This cannot be undone."), () => { app.profiles.Remove(kk.id); SaveData.Delete(kk.id); app.Save(); }))); }
                g.EndRow();
            }
            if (g.Btn("+ " + Loc.L("Хүүхэд нэмэх", "Add a child"))) g.Later(() => { g.LogOut(); });
            GUILayout.EndVertical();
            FamilyCard(g, kids);
            if (g.Btn(Loc.L("Бидний зорилго, шударга үнэ", "Our mission & fair pricing"))) g.Later(() => g.Open(new AboutPage()));
            if (g.Btn(Loc.L("Бүх өгөгдлийг устгах", "Erase all data"), false, 34)) g.Later(() => g.Open(new ConfirmModal(Loc.L("Бүх өгөгдлийг устгах уу?", "Erase all data?"), Loc.L("Профайл, ахиц, тохиргоо устна.", "Profiles, progress and settings will be erased."), () => { PlayerPrefs.DeleteAll(); PlayerPrefs.Save(); g.App = new AppState(); g.V = null; g.CloseAll(); })));
        }
        // the family code: made here, then each child is added with their 3 pictures so they can log in on other devices
        bool busy; string joinCode = "", famErr = "", membersCode; List<J> members;
        void FamilyCard(Game g, List<SaveData> kids)
        {
            var app = g.App;
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Гэр бүлийн код", "Family code") + "</b>", g.sTitle);
            if (string.IsNullOrEmpty(app.familyCode))
            {
                g.Text(Loc.L("Код үүсгэвэл хүүхдүүд өөр утас, компьютер дээр нууц зургаараа нэвтэрч, ахицаа үргэлжлүүлнэ.", "With a family code, your children can log in on another phone or computer with their secret pictures and keep their progress."));
                if (g.Btn(busy ? "…" : Loc.L("Гэр бүлийн код үүсгэх", "Make a family code"), true, 44, !busy)) g.Later(() => AddChild(g, kids.FirstOrDefault(k => k.code != "") ?? g.V));
                g.Small(Loc.L("Өөр төхөөрөмж дээр код үүсгэсэн бол:", "Made a code on another device already?"));
                GUILayout.BeginHorizontal();
                joinCode = GUILayout.TextField(joinCode, 9, new GUIStyle(g.sBtn) { alignment = TextAnchor.MiddleLeft }, GUILayout.MinHeight(g.U(38)));
                if (GUILayout.Button(Loc.L("Нэгдэх", "Join"), g.sPrimary, GUILayout.Width(g.U(100)), GUILayout.MinHeight(g.U(38))) && !busy) g.Later(() =>
                {
                    string code = Family.Clean(joinCode);
                    if (code.Length != 8) { famErr = Loc.L("8 үсэг, тоотой кодоо бичээрэй", "Write the 8-letter code"); return; }
                    busy = true; famErr = "";
                    g.StartCoroutine(Family.Post(Family.ServerOf(g, g.V), "{\"act\":\"members\",\"code\":" + J.Quote(code) + "}", r =>
                    {
                        busy = false;
                        if (!r["ok"].B) { famErr = Family.Why(r); return; }
                        app.familyCode = code; app.server = Family.ServerOf(g, g.V).Trim(); app.Save();
                    }));
                });
                GUILayout.EndHorizontal();
            }
            else
            {
                GUILayout.Label(Family.Show(app.familyCode), new GUIStyle(g.sBig) { alignment = TextAnchor.MiddleCenter });
                g.Small(Loc.L("Өөр төхөөрөмж дээр: нэвтрэх хуудас → “Гэр бүлийн кодоор нэвтрэх”. Кодыг зөвхөн гэр бүлдээ хэлээрэй.", "On another device: the login page → “Log in with a family code”. Share the code only with your family."));
                // every child of the family, also those only on other devices: new pictures (forgotten ones), or out of the family
                if (membersCode != app.familyCode)
                {
                    string c = membersCode = app.familyCode; members = null;
                    g.StartCoroutine(Family.Post(Family.ServerOf(g, g.V), "{\"act\":\"members\",\"code\":" + J.Quote(c) + "}", r => { if (membersCode == c) members = r["ok"].B ? r["members"].ToList() : new List<J>(); }));
                }
                if (members == null) g.Small(Loc.L("Ачаалж байна…", "Loading…"));
                foreach (var m in members ?? new List<J>())
                {
                    string mid = m["id"].S, mname = m["name"].S; int mav = m["avatar"].I; var kid = kids.FirstOrDefault(k => k.id == mid);
                    g.Row(Px.Mascot(mav), mname, kid == null ? Loc.L("өөр төхөөрөмж", "other device") : m["locked"].B ? Loc.L("түр түгжээтэй", "locked for now") : null);
                    if (g.SmallBtn(Loc.L("Шинэ зураг", "New pictures"), false, 110, !busy)) g.Later(() =>
                    {
                        if (kid != null) { var p = kid.id == g.V.id ? g.V : kid; g.Open(new PicturesModal(p.name, p.avatar, code => { p.code = code; p.Save(); AddChild(g, p); })); } // its own device changes them
                        else g.Open(new PicturesModal(mname, mav, code => Manage(g, "pictures", mid, code, Loc.L($"{mname}-ийн зураг солигдлоо", $"{mname} has new pictures"))));
                    });
                    if (g.SmallBtn(Loc.L("Хасах", "Remove"), false, 80, !busy)) g.Later(() => g.Open(new ConfirmModal(Loc.L($"{mname}-г гэр бүлээс хасах уу?", $"Take {mname} out of the family?"),
                        Loc.L("Өөр төхөөрөмж дээр гэр бүлийн кодоор нэвтэрч чадахгүй болно. Ахиц нь устахгүй.", "They can no longer log in with the family code on another device. Their progress is not erased."),
                        () => Manage(g, "remove", mid, null, Loc.L($"{mname} гэр бүлээс гарлаа", $"{mname} left the family")))));
                    g.EndRow();
                }
                foreach (var k in kids.Where(k => members != null && !members.Any(m => m["id"].S == k.id)))
                {
                    g.Row(Px.Mascot(k.avatar), k.name, null);
                    var kk = k;
                    if (g.SmallBtn(Loc.L("Гэр бүлд нэмэх", "Add to family"), true, 130, !busy)) g.Later(() => AddChild(g, kk));
                    g.EndRow();
                }
            }
            if (famErr != "") GUILayout.Label($"<color=#e14b3d>{famErr}</color>", g.sLabel);
            GUILayout.EndVertical();
        }
        void Manage(Game g, string act, string id, string pics, string done)
        {
            busy = true; famErr = "";
            g.StartCoroutine(Family.Manage(g, act, id, pics, r => { busy = false; membersCode = null; if (r["ok"].B) g.Toast(done); else famErr = Family.Why(r); }));
        }
        void AddChild(Game g, SaveData k)
        {
            var p = k.id == g.V.id ? g.V : k;
            if (Family.PicsJson(p.code) == null) { g.Open(new PicturesModal(p.name, p.avatar, code => { p.code = code; p.Save(); AddChild(g, p); })); return; }
            busy = true; famErr = "";
            g.StartCoroutine(Family.Link(g, p, r =>
            {
                busy = false; membersCode = null; // fetch the family again
                if (r["ok"].B) g.Toast(Loc.L($"{p.name} гэр бүлд нэмэгдлээ", $"{p.name} is in the family")); else famErr = Family.Why(r);
            }));
        }
        /** A child's 3 secret pictures, chosen by a grown-up for the family code. */
        sealed class PicturesModal : Modal
        {
            readonly string name; readonly int avatar; readonly Action<string> picked; readonly List<int> sel = new List<int>();
            public PicturesModal(string name, int avatar, Action<string> picked) { this.name = name; this.avatar = avatar; this.picked = picked; }
            public override void Press(Game g) { }
            public override void Draw(Game g)
            {
                GUILayout.BeginHorizontal(); g.IconAt(Px.Mascot(avatar), 36); GUILayout.Label($"<b>{name}</b>", g.sTitle); GUILayout.EndHorizontal();
                g.Small(Loc.L("3 нууц зураг сонгоорой. Дараалал нь чухал.", "Choose 3 secret pictures. The order matters."));
                g.PicPad(sel, code => { g.Close(); picked(code); });
                if (g.Btn(Loc.L("Болих", "Cancel"))) g.Later(g.Close);
            }
        }
        /** What the child earned and learned, and the latest activity. */
        static void LearnedReport(Game g, SaveData child)
        {
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Амжилт ба сурсан зүйлс", "Achievements & what they learned") + "</b>", g.sTitle);
            g.Small(Loc.L($"{child.name} {child.ach.Count}/{Achievements.LIST.Count} амжилт авсан.", $"{child.name} has {child.ach.Count}/{Achievements.LIST.Count} badges."));
            foreach (var x in child.ach.OrderByDescending(x => x.v)) { var a = Achievements.ById(x.k); if (a == null) continue; g.Row(Emo.Badge(a.emblem, a.cat), a.name.ToString(), DateTimeOffset.FromUnixTimeMilliseconds(x.v).LocalDateTime.ToString("yyyy.MM.dd")); g.EndRow(); }
            GUILayout.Label("<b>" + Loc.L("Сурсан зүйлс", "What they learned") + "</b>", g.sLabel);
            var done = Lessons.ALL.Where(l => child.LessonDone(l["id"].S)).ToList(); var handIds = GerRules.Done(child);
            if (done.Count == 0 && handIds.Count == 0) g.Small(Loc.L("Одоохондоо юу ч сураагүй байна.", "Nothing learned yet."));
            foreach (var a in GerRules.HANDS_ON.Where(x => handIds.Contains(x.id))) // done by hand in Нутаг
            {
                GUILayout.Label("<b>" + a.name + "</b>" + $" <size={g.Ts(10)}>· {Loc.L("Нутагт гараараа", "by hand in Нутаг")}</size>", g.sLabel);
                foreach (var t in a.learned) GUILayout.Label("• " + t, g.sSmall);
            }
            foreach (var l in done)
            {
                var pr = child.learn.Find(x => x.id == l["id"].S);
                string with = string.Join(", ", new[] { ("family", Loc.L("гэр бүлтэйгээ", "with family")), ("friends", Loc.L("найзуудтайгаа", "with friends")), ("solo", Loc.L("ганцаараа", "alone")) }.Where(w => SaveData.Get(pr.with, w.Item1) > 0).Select(w => $"{w.Item2} {SaveData.Get(pr.with, w.Item1)}×"));
                GUILayout.Label("<b>" + l["title"].T + "</b>" + (with != "" ? $" <size={g.Ts(10)}>· {with}</size>" : ""), g.sLabel);
                foreach (var t in l["learned"]) GUILayout.Label("• " + t.T, g.sSmall);
            }
            if (child.quizTopicTotal.Count > 0)
            {
                GUILayout.Label("<b>" + Loc.L("Басарын асуултын сэдвүүд", "Basar quiz topics") + "</b>", g.sLabel);
                foreach (var (id, name) in Basar.Topics) { int r = SaveData.Get(child.quizTopicRight, id), tt = SaveData.Get(child.quizTopicTotal, id); GUILayout.BeginHorizontal(); GUILayout.Label(name.ToString(), g.sSmall, GUILayout.Width(g.U(140))); g.Bar(GUILayoutUtility.GetRect(10, g.U(10), GUILayout.ExpandWidth(true)), tt > 0 ? r / (float)tt : 0, Px.Col("#2ea35f")); GUILayout.Label($"{r}/{tt}", g.sSmall, GUILayout.Width(g.U(50))); GUILayout.EndHorizontal(); }
            }
            var logs = g.App.log.Where(x => x.pid == child.id).Reverse().Take(12).ToList();
            if (logs.Count > 0)
            {
                GUILayout.Label("<b>" + Loc.L("Сүүлийн үйл ажиллагаа", "Recent activity") + "</b>", g.sLabel);
                foreach (var x in logs) GUILayout.Label($"{LogLine(x)}  <size={g.Ts(9)}>{x.d}</size>", g.sSmall);
            }
            GUILayout.EndVertical();
        }
        static string LogLine(LogEntry x)
        {
            switch (x.k)
            {
                case "lesson": { var l = Lessons.ALL.FirstOrDefault(q => q["id"].S == x.id); return Loc.L($"“{(l != null ? l["title"].T.mn : x.id)}” хичээлийг дуусгасан", $"Finished “{(l != null ? l["title"].T.en : x.id)}”"); }
                case "ach": { var a = Achievements.ById(x.id); return Loc.L("Амжилт: ", "Badge: ") + (a != null ? a.name.ToString() : x.id); }
                case "hand": { var a = GerRules.HANDS_ON.Find(q => q.id == x.id); return a != null ? a.name.ToString() : x.id; }
                case "race": return Loc.L($"Морин уралдаанд {x.id}-р байр", $"Horse race: place {x.id}");
                case "stamp": { var a = Aimags.ById(x.id); return Loc.L("Тамга: ", "Stamp: ") + (a != null ? a.name.ToString() : x.id); }
                case "pass": return Loc.L("Аймгийн аяллын эрх авсан", "Got the Aimag Travel Pass");
                case "together": { var p = x.id.Split('|'); var l = Lessons.ALL.FirstOrDefault(q => q["id"].S == p[0]); return (l != null ? l["title"].T.ToString() : Loc.L("Асуулт хариулт", "Quiz")) + (p.Length > 2 ? " · " + p[2] : ""); }
            }
            return x.k;
        }
    }
    public sealed class ConfirmModal : Modal
    {
        readonly string title, text; readonly Action yes; public Action onNo;
        public ConfirmModal(string title, string text, Action yes) { this.title = title; this.text = text; this.yes = yes; }
        public override void Draw(Game g)
        {
            g.Title(title); g.Small(text);
            GUILayout.BeginHorizontal();
            if (g.Btn(Loc.L("Болих", "Cancel"))) g.Later(() => { g.Close(); onNo?.Invoke(); });
            if (g.Btn(Loc.L("Тийм", "Yes"), true)) g.Later(() => { g.Close(); yes(); });
            GUILayout.EndHorizontal();
        }
    }

    // ================================================================ the family memory book: elders' voices, kept on this device
    static string MemDir { get { string d = Path.Combine(Application.persistentDataPath, "memories"); Directory.CreateDirectory(d); return d; } }
    sealed class MemoriesPage : Page
    {
        AudioSource player; string playing;
        protected override string Title => Loc.L("Гэр бүлийн дурсамжийн ном", "Family memory book");
        protected override void Body(Game g)
        {
            GUILayout.BeginVertical(g.sPanel);
            g.Text(Loc.L("Эмээ, өвөөгийн дуу хоолой, үлгэр, амьдралын сургамжийг үүрд хадгал. Үүнийг ямар ч хиймэл оюун орлож чадахгүй.", "Keep your grandparents' voices, stories and life lessons forever. No AI can replace this."));
            if (g.Btn(Loc.L("Шинэ дурсамж бичих", "Record a new memory"), true, 48)) g.Later(() => g.Open(new MemoryForm()));
            g.Small(Loc.L("Бүх бичлэг зөвхөн энэ төхөөрөмж дээр хадгалагдана.", "Recordings are stored only on this device."));
            GUILayout.EndVertical();
            var list = g.App.memories.OrderByDescending(m => m.ts).ToList();
            if (list.Count == 0) g.Text(Loc.L("Одоохондоо дурсамж алга. Эмээ, өвөөгөөсөө анхны түүхээ асуугаарай!", "No memories yet. Ask your grandparents for the first story!"));
            foreach (var m in list)
            {
                GUILayout.BeginVertical(g.sPanel);
                GUILayout.BeginHorizontal(); g.IconAt(Px.Face(m.whoFace), 36); GUILayout.BeginVertical(); GUILayout.Label("<b>" + m.who + "</b>", g.sLabel); g.Small(DateTimeOffset.FromUnixTimeMilliseconds(m.ts).LocalDateTime.ToString("yyyy.MM.dd")); GUILayout.EndVertical(); GUILayout.EndHorizontal();
                GUILayout.Label("<i>“" + m.prompt + "”</i>", g.sLabel);
                if (!string.IsNullOrEmpty(m.text)) g.Text(m.text);
                GUILayout.BeginHorizontal();
                if (!string.IsNullOrEmpty(m.audio) && File.Exists(Path.Combine(MemDir, m.audio)) && g.Btn(playing == m.id ? Loc.L("■ Зогсоох", "■ Stop") : Loc.L("► Сонсох", "► Listen"))) { var mm = m; g.Later(() => Play(g, mm)); }
                if (g.Btn(Loc.L("Устгах", "Delete"), false, 34)) { var mm = m; g.Later(() => g.Open(new ConfirmModal(Loc.L("Энэ дурсамжийг устгах уу?", "Delete this memory?"), Loc.L("Буцаах боломжгүй.", "This cannot be undone."), () => { g.App.memories.Remove(mm); if (!string.IsNullOrEmpty(mm.audio)) File.Delete(Path.Combine(MemDir, mm.audio)); g.App.Save(); }))); }
                GUILayout.EndHorizontal();
                GUILayout.EndVertical();
            }
        }
        void Play(Game g, Memory m)
        {
            if (player == null) player = g.gameObject.AddComponent<AudioSource>();
            if (playing == m.id) { player.Stop(); playing = null; return; }
            var clip = Wav.Load(Path.Combine(MemDir, m.audio)); if (clip == null) return;
            player.clip = clip; player.Play(); playing = m.id;
        }
        public override void Closed(Game g) { if (player != null) { player.Stop(); Destroy(player); } }
    }
    sealed class MemoryForm : Modal
    {
        int pi = UnityEngine.Random.Range(0, 100), who; string text = ""; AudioClip rec; float recStart; bool recording; float[] samples; string status = "";
        static List<Tx> Prompts => Data.Get("people")["STORY_PROMPTS"].Select(x => x.T).ToList();
        public MemoryForm() { var fam = I.App.family; who = Mathf.Max(0, fam.FindIndex(f => f.id == "f3")); }
        public override void Press(Game g) { }
        public override void Draw(Game g)
        {
            var prompts = Prompts; var fam = g.App.family;
            g.Title(Loc.L("Шинэ дурсамж", "New memory"));
            GUILayout.Label(Loc.L("Асуулт", "Question"), g.sSmall);
            GUILayout.BeginHorizontal(g.sBtn); GUILayout.Label("<b>" + prompts[pi % prompts.Count] + "</b>", g.sLabel); if (GUILayout.Button(Loc.L("Өөр", "Other"), g.sBtn, GUILayout.Width(g.U(70)))) g.Later(() => pi++); GUILayout.EndHorizontal();
            GUILayout.Label(Loc.L("Хэн ярьж байна?", "Who is telling?"), g.sSmall);
            int hit = g.Chips(fam.Select(f => f.Name.ToString()).ToList(), who, 70); if (hit >= 0) who = hit;
#if UNITY_WEBGL && !UNITY_EDITOR
            GUILayout.Label(Loc.L("Дуу хоолой бичих нь утас, компьютерийн апп дээр ажиллана.", "Voice recording works in the phone and computer app."), g.sSmall); // no microphone in a web build
#else
            if (Microphone.devices.Length > 0)
            {
                GUILayout.Label(Loc.L("Дуу хоолой", "Voice"), g.sSmall);
                GUILayout.BeginHorizontal();
                if (g.Btn(recording ? Loc.L("■ Зогсоох", "■ Stop") : samples != null ? Loc.L("● Дахин бичих", "● Record again") : Loc.L("● Дуу хоолой бичих", "● Record voice"), recording)) g.Later(() => { if (recording) StopRec(); else StartRec(); });
                GUILayout.Label(recording ? $"<color=#e14b3d>● {(int)(Time.time - recStart) / 60}:{(int)(Time.time - recStart) % 60:00}</color>" : status, g.sLabel);
                GUILayout.EndHorizontal();
                if (recording && Time.time - recStart >= 300) StopRec();
            }
#endif
            GUILayout.Label(Loc.L("Тэмдэглэл", "Notes"), g.sSmall);
            text = GUILayout.TextArea(text, 2000, new GUIStyle(g.sBtn) { alignment = TextAnchor.UpperLeft, wordWrap = true }, GUILayout.MinHeight(g.U(80)));
            if (g.Btn(Loc.L("Хадгалах (+5 од)", "Save (+5 stars)"), true, 48)) g.Later(() => Save(g));
            if (g.Btn(Loc.L("Болих", "Cancel"), false, 32)) g.Later(g.Close);
        }
        void StartRec()
        {
#if UNITY_ANDROID
            if (!UnityEngine.Android.Permission.HasUserAuthorizedPermission(UnityEngine.Android.Permission.Microphone)) { UnityEngine.Android.Permission.RequestUserPermission(UnityEngine.Android.Permission.Microphone); status = Loc.L("Микрофоны зөвшөөрөл өгөөд дахин дар.", "Allow the microphone, then tap again."); return; }
#endif
#if !(UNITY_WEBGL && !UNITY_EDITOR)
            rec = Microphone.Start(null, false, 300, 22050); recStart = Time.time; recording = rec != null;
#endif
            if (!recording) status = Loc.L("Микрофон ашиглах зөвшөөрөл алга.", "Microphone permission denied.");
        }
        void StopRec()
        {
            if (!recording) return;
#if !(UNITY_WEBGL && !UNITY_EDITOR)
            int pos = Microphone.GetPosition(null); Microphone.End(null); recording = false;
#else
            int pos = 0; recording = false;
#endif
            if (rec != null && pos > 0) { samples = new float[pos * rec.channels]; rec.GetData(samples, 0); status = "√"; }
        }
        void Save(Game g)
        {
            if (recording) { g.Toast(Loc.L("Эхлээд бичлэгээ зогсоогоорой.", "Stop the recording first.")); return; }
            if (text.Trim() == "" && samples == null) { g.Toast(Loc.L("Бичвэр эсвэл дуу хоолой нэмээрэй.", "Add text or a voice recording.")); return; }
            var f = g.App.family[Mathf.Clamp(who, 0, g.App.family.Count - 1)]; string id = "m" + SaveData.NowMs(); string audio = null;
            if (samples != null) { audio = id + ".wav"; Wav.Save(Path.Combine(MemDir, audio), samples, rec.frequency, rec.channels); }
            g.App.memories.Add(new Memory { id = id, pid = g.V.id, ts = SaveData.NowMs(), d = SaveData.DayKey(), prompt = Prompts[pi % Prompts.Count].ToString(), who = f.Name.ToString(), whoFace = f.face, text = text.Trim(), audio = audio });
            g.App.familyStars += 5; g.App.Save(); g.Close(); Sfx.Win(); g.Confetti(40); g.CheckAchievements();
            g.Toast(Loc.L("Дурсамж хадгалагдлаа! +5 од", "Memory saved! +5 stars"));
        }
        public override void Closed(Game g)
        {
#if !(UNITY_WEBGL && !UNITY_EDITOR)
            if (recording) Microphone.End(null);
#endif
        }
    }

    // ================================================================ about / pitch
    sealed class AboutPage : Page
    {
        protected override string Title => "Naadamy";
        protected override void Body(Game g)
        {
            GUILayout.BeginVertical(g.sPanel);
            g.Small("Pinequest · Fine-Tune for the Future");
            GUILayout.Label("<b>" + Loc.L("“Ээж ээ, тоглохоо больё. Хамтдаа монгол гэр барьцгаая!”", "“Mom, let’s stop playing — let’s build a Mongol ger together!”") + "</b>", g.sTitle);
            g.Text(Loc.L("Naadamy бол хүүхэд, гэр бүл, найзууд Монголын өв соёлыг хамтдаа сурдаг тоглоом. Дэлгэц дээр сурсан зүйлээ бодит амьдрал дээр гэр бүлээрээ хийдэг.", "Naadamy is a game where children, families and friends learn Mongolian heritage together, then do it for real at home."));
            GUILayout.EndVertical();
            Section(g, Loc.L("Асуудал", "The problem"), new[] {
                ("📱", Loc.L("Ганцаардмал дэлгэц", "Lonely screens"), Loc.L("Хүүхдүүд дэлгэцийн өмнө ганцаараа өнгөрүүлэх цаг ихэсч, гэр бүлийн харилцаа багасч байна.", "Children spend more time alone on screens and less with family.")),
                ("🏙️", Loc.L("Мартагдаж буй өв", "Fading heritage"), Loc.L("Хотын олон хүүхэд гэр барих, цагаан идээ хийх, Нууц товчоог мэддэггүй болж байна.", "Many city children no longer know how to build a ger, make dairy foods or the Secret History.")),
                ("💸", Loc.L("Үнэтэй, гадаад", "Expensive, foreign"), Loc.L("Ихэнх суралцах апп үнэтэй, гадаад хэл дээр, монгол соёлгүй.", "Most learning apps are costly, foreign and lack Mongolian culture.")) });
            Section(g, Loc.L("Шийдэл", "Our solution"), new[] {
                ("⛺", Loc.L("Нутаг", "Nutag"), Loc.L("Найзуудтайгаа хамт тоглох пиксел тосгон. Өөрийн монгол гэрээ барих, бөх барилдах. Нэг Wi-Fi-д олуулаа тоглоно.", "A pixel village to play in with friends. Build your own ger, wrestle at Naadam. Play together on the same Wi-Fi.")),
                ("🐕", Loc.L("Басар — AI найз", "Basar, the AI buddy"), Loc.L("Монгол банхар нохой үргэлж хажууд чинь. Түүх, Нууц товчоо, ёс заншлыг асуухад хариулна. Интернэтгүй ч ажиллана.", "A Mongolian Bankhar dog always by your side. Answers questions on history, the Secret History and customs. Works offline too.")),
                ("📚", Loc.L("Өв соёлын сургууль", "Heritage school"), Loc.L("Гэр барих, цагаан идээ хийх, гэрийн ёс, Нууц товчооны үлгэрүүд. Хичээл бүр гэр бүлийн бодит ажлаар төгсөнө.", "Building a ger, dairy foods, ger manners, tales from the Secret History. Every lesson ends with a real family activity.")) });
            Section(g, Loc.L("Яагаад хиймэл оюун үүнийг орлож чадахгүй вэ?", "Why AI can't replace this"), new[] {
                ("👨‍👩‍👧", Loc.L("Басар заана, гэр бүл хийнэ", "Basar teaches, family does"), Loc.L("AI нохой мэдлэг өгдөг ч гэрээ ээж аавтайгаа хамт барина.", "The AI dog shares knowledge, but you build the ger with Mom and Dad.")),
                ("🌍", Loc.L("Тоглоом дэлгэцээс гадна дуусна", "Every lesson ends off-screen"), Loc.L("Бяцхан гэр барих, тараг исгэх, таван сумны туршилт — гэр бүлээрээ.", "A mini ger, homemade yogurt, the five arrows test — all as a family.")),
                ("🎙️", Loc.L("Эмээгийн дуу хоолой", "Grandma's voice"), Loc.L("Ахмадуудын ярьсан ёс заншил, түүхийг Дурсамжийн номонд хадгална.", "Customs and stories from elders are saved in the memory book.")),
                ("🗣️", Loc.L("Басар “эмээгээсээ асуу” гэдэг", "Basar says “ask Grandma”"), Loc.L("Мэдэхгүй зүйлээ Басар ахмадуудаас асуухыг урамшуулдаг.", "When unsure, Basar encourages asking the elders.")) });
            Section(g, Loc.L("Хүн бүрт тэгш хүртээмж", "Equal access for everyone"), new[] {
                ("📶", "", Loc.L("Офлайн ажиллана: Басар интернэтгүй ч мэдлэгээ хуваалцана", "Works offline: Basar shares his knowledge even without internet")),
                ("📱", "", Loc.L("Хуучин, хямд утсан дээр ажиллана", "Runs on old, low-cost phones")),
                ("🇲🇳", "", Loc.L("Монгол хэл, монгол соёл дээр суурилсан", "Built on Mongolian language and culture")),
                ("🚫", "", Loc.L("Зар сурталчилгаагүй, өгөгдөл худалдахгүй", "No ads, no selling data")),
                ("🔒", "", Loc.L("Профайл зөвхөн таны төхөөрөмж дээр, AI-д нэр хадгалагдахгүй", "Profiles stay on your device; the AI keeps no names")),
                ("🧒", "", Loc.L("Хүүхдэд аюулгүй AI: хувийн мэдээлэл асуудаггүй", "Kid-safe AI: never asks for personal details")) });
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Шударга үнэ", "Fair pricing") + "</b>", g.sTitle);
            Price(g, Loc.L("Үнэгүй", "Free"), "0₮" + Loc.L(" / үүрд", " / forever"), new[] { Loc.L("Нутаг, бүх хичээл", "Nutag and every lesson"), Loc.L("Басарын офлайн мэдлэг", "Basar’s offline knowledge"), Loc.L("Дурсамжийн ном", "Memory book") }, null);
            Price(g, Loc.L("Гэр бүл", "Family"), "3,900₮" + Loc.L(" / сар", " / month"), new[] { Loc.L("Басар AI ухаалаг горим", "Basar smart AI mode"), Loc.L("Сар бүр шинэ өв соёлын хичээл", "New heritage lessons every month"), Loc.L("Хэвлэх гэр бүлийн картууд", "Printable family activity cards") }, Loc.L("Нэг гэр бүлийн төлбөр = хөдөөгийн нэг хүүхдэд үнэгүй эрх", "One family plan = free access for one rural child"));
            Price(g, Loc.L("Сургууль, сум", "Schools & soums"), "0₮" + Loc.L(" / үнэгүй", " / free"), new[] { Loc.L("Төрийн сургууль, цэцэрлэг", "Public schools & kindergartens"), Loc.L("Багшийн самбар", "Teacher dashboard"), Loc.L("Ангиараа Нутагт хамт тоглох", "Whole class plays together in Nutag") }, null);
            GUILayout.EndVertical();
            GUILayout.BeginVertical(g.sPanel);
            GUILayout.Label("<b>" + Loc.L("Цаашдын төлөвлөгөө", "Roadmap") + "</b>", g.sTitle);
            foreach (var (when, what) in new[] { (Loc.L("Одоо", "Now"), Loc.L("Нутаг, Басар AI нохой, өв соёлын хичээлүүд, Unity апп", "Nutag, Basar the AI dog, heritage lessons, the Unity app")), (Loc.L("Дараа", "Next"), Loc.L("Монгол бичиг, морин хуур, айраг бүлэх, Цагаан сарын хичээлүүд", "Lessons on Mongol script, morin khuur, airag and Tsagaan Sar")), (Loc.L("Удахгүй", "Soon"), Loc.L("Басарын дуу хоолой, өвөө эмээгийн бичсэн үлгэрүүд", "Basar’s voice and stories recorded by grandparents")), (Loc.L("Ирээдүй", "Future"), Loc.L("Сургууль, сум, музейтэй хамтран ажиллах", "Partnerships with schools, soums and museums")) })
                GUILayout.Label($"<b>{when}</b> — {what}", g.sLabel);
            GUILayout.EndVertical();
            if (Music.Credits.Count > 0)
            {
                GUILayout.BeginVertical(g.sPanel);
                GUILayout.Label("<b>" + Loc.L("Хөгжмийн зохиогчид", "Music credits") + "</b>", g.sTitle);
                g.Small(Loc.L("Арын хөгжим бүгд CC0 (нийтийн өмч) лицензтэй, OpenGameArt.org-оос.", "All background music is CC0 (public domain) from OpenGameArt.org."));
                foreach (var c in Music.Credits) GUILayout.Label($"<b>{c.title}</b> — {c.artist} · {c.license}", g.sSmall);
                GUILayout.EndVertical();
            }
            g.Small(Loc.L("Монгол хүүхэд бүрт ♥ · Pinecone Academy · Pinequest", "For every Mongolian child ♥ · Pinecone Academy · Pinequest"));
        }
        static void Section(Game g, string title, (string icon, string head, string text)[] items)
        {
            GUILayout.BeginVertical(g.sPanel); GUILayout.Label("<b>" + title + "</b>", g.sTitle);
            foreach (var (icon, head, text) in items) { g.Row(Emo.Icon(icon), head == "" ? text : head, head == "" ? null : text); g.EndRow(); }
            GUILayout.EndVertical();
        }
        static void Price(Game g, string name, string amount, string[] items, string note)
        {
            GUILayout.BeginVertical(note != null ? g.sPrimary : g.sBtn);
            var st = note != null ? g.sPrimary.Clean() : g.sLabel;
            GUILayout.Label($"<b>{name}</b>  {amount}", st);
            foreach (var i in items) GUILayout.Label("√ " + i, new GUIStyle(st) { fontSize = g.Ts(11) });
            if (note != null) GUILayout.Label(note, new GUIStyle(st) { fontSize = g.Ts(10) });
            GUILayout.EndVertical();
        }
    }
}

/** 16-bit PCM WAV files for the memory book's recordings. */
public static class Wav
{
    public static void Save(string path, float[] samples, int rate, int channels)
    {
        using (var w = new BinaryWriter(File.Create(path)))
        {
            int bytes = samples.Length * 2;
            w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF")); w.Write(36 + bytes); w.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
            w.Write(16); w.Write((short)1); w.Write((short)channels); w.Write(rate); w.Write(rate * channels * 2); w.Write((short)(channels * 2)); w.Write((short)16);
            w.Write(System.Text.Encoding.ASCII.GetBytes("data")); w.Write(bytes);
            foreach (var s in samples) w.Write((short)Mathf.Clamp(s * 32767f, -32768f, 32767f));
        }
    }
    public static AudioClip Load(string path)
    {
        try
        {
            var b = File.ReadAllBytes(path); int channels = BitConverter.ToInt16(b, 22), rate = BitConverter.ToInt32(b, 24), dataLen = BitConverter.ToInt32(b, 40), n = dataLen / 2;
            var data = new float[n]; for (int i = 0; i < n; i++) data[i] = BitConverter.ToInt16(b, 44 + i * 2) / 32768f;
            var clip = AudioClip.Create("memory", n / channels, channels, rate, false); clip.SetData(data, 0); return clip;
        }
        catch (Exception) { return null; }
    }
}
