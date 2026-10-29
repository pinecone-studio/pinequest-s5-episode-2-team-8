// Making the white foods (цагаан идээ) by hand (js/village/dairywork.js): every step of a recipe is one small gesture on the
// task stage (hold the heat, stir on the beat, press, cut, lay out to dry, churn), and each hint says why it is done that way.
// A wrong guess only gets a kind word and another try; nothing is used up until the food is made.
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using static Px;

public static class DairyWork
{
    const string MILK = "#fbf8ef", TARAG = "#f1ead2", CURD = "#fff6dc", WHEY = "#e9df9a", IRON = "#5a5a66", IRON_L = "#77778a";
    static Tx T(string mn, string en) => new Tx(mn, en);
    static Vector2 V2(float x, float y) => new Vector2(x, y);

    // ---------------------------------------------------------------- stage art (160×120; the beat bar sits along the bottom)
    static void Ground(PxCanvas x) { R(x, 0, 86, 160, 34, K.grass); R(x, 0, 86, 160, 2, K.grassD); }
    /** The ground, with a lamb that grazes and bobs, and hops with joy whenever a step is done. */
    static void Ground(PxCanvas x, float t, TaskState st)
    {
        Ground(x);
        float hop = st != null ? Mathf.Clamp01(1 - (t - st.popT) / 0.5f) : 0; int dy = Js.Round(Mathf.Abs(Mathf.Sin(hop * Mathf.PI * 2)) * 7 * hop);
        var a = Px.Animal("lamb", hop > 0 ? (int)(t / 0.12f) % 2 : (int)(t / 0.7f) % 2);
        Ell(x, 140, 104, 8, 1, "rgba(30,20,10,.25)"); x.BlitScaled(a, 140 - a.W / 2, 103 - a.H - dy, a.W, a.H);
        if (hop > 0) P(x, 146, 90 - dy - Js.Round((1 - hop) * 6), "#e14b3d");
    }
    static void Sun(PxCanvas x, float t) { Ell(x, 136, 20, 9, 9, "#f7c646"); Ell(x, 136, 20, 6, 6, "#fde08a"); for (int i = 0; i < 8; i++) { float a = i * Mathf.PI / 4 + t * 0.4f; P(x, 136 + Js.Round(Mathf.Cos(a) * 13), 20 + Js.Round(Mathf.Sin(a) * 13), "#f7c646"); } }
    static void Night(PxCanvas x) { R(x, 0, 0, 160, 86, "#22305e"); Ell(x, 132, 20, 8, 8, "#fff2c8"); Ell(x, 136, 18, 6, 6, "#22305e"); foreach (var (sx, sy) in new[] { (20, 14), (44, 30), (70, 10), (98, 26), (112, 8), (30, 50), (150, 46) }) P(x, sx, sy, "#ffffff"); }
    static void Fire(PxCanvas x, float t, int cx, int y, bool low)
    {
        R(x, cx - 14, y + 2, 28, 3, K.woodD); R(x, cx - 12, y - 1, 24, 3, K.wood);
        for (int i = 0; i < 5; i++) { int h = (low ? 2 : 5) + ((int)Mathf.Floor(t * 10) + i * 3) % 4; R(x, cx - 11 + i * 5, y - h, 4, h, i % 2 == 1 ? "#f39b2c" : "#f7c646"); }
        if (!low) for (int i = 0; i < 2; i++) { float q = (t * 0.9f + i * 0.5f) % 1; P(x, cx - 6 + i * 12 + Js.Round(Mathf.Sin(q * 9 + i) * 3), y - 6 - Js.Round(q * 22), q < 0.7f ? "#f7c646" : "#f39b2c"); } // sparks
    }
    /** тулга and its iron pot: the milk's surface, and how much foam or curd is on it. */
    static void Pot(PxCanvas x, float t, int cx, int cy, string surface = null, bool fire = true, bool low = false, int foam = 0, int curds = 0, bool steam = false)
    {
        foreach (var (lx, ly) in new[] { (-20, 30), (0, 32), (20, 30) }) Line(x, cx + lx, cy + ly, cx + Js.Round(lx / 2.0), cy + 4, K.outl);
        if (fire) Fire(x, t, cx, cy + 22, low);
        Blob(x, cx, cy + 6, 24, 12, IRON); R(x, cx - 25, cy - 3, 50, 4, K.outl); R(x, cx - 24, cy - 2, 48, 2, IRON_L);
        Ell(x, cx, cy - 2, 21, 3, surface ?? MILK);
        for (int i = 0; i < foam; i++) Ell(x, cx - 16 + (i * 9) % 32, cy - 3 - (i > 3 ? 1 : 0), 3, 1, "#ffffff");
        for (int i = 0; i < curds; i++) Blob(x, cx - 14 + (i * 7) % 28, cy - 3, 2, 1, CURD);
        if (steam) for (int i = 0; i < 3; i++) P(x, cx - 12 + (i * 11) % 24 + Js.Round(Mathf.Sin(t * 5 + i)), cy - 3 - ((int)(t * 6 + i * 2) % 3 == 0 ? 1 : 0), "#ffffff"); // bubbles
        if (steam) for (int i = 0; i < 3; i++) { float q = (t * 0.8f + i / 3f) % 1; P(x, cx - 10 + i * 10 + Js.Round(Mathf.Sin(q * 6) * 2), cy - 8 - Js.Round(q * 18), "#ffffff"); }
    }
    static void Bucket(PxCanvas x, int cx, int cy, string surface) { R(x, cx - 17, cy - 15, 34, 30, K.outl); R(x, cx - 16, cy - 14, 32, 28, K.wood); foreach (int by in new[] { -9, 7 }) R(x, cx - 16, cy + by, 32, 2, K.woodD); Ell(x, cx, cy - 14, 15, 2, surface); }
    /** хөхүүр: the leather bag with its churning stick; up = how far the stick is pulled up. */
    static void Khukhuur(PxCanvas x, int cx, int cy, int up, bool open)
    {
        R(x, cx - 14, cy + 22, 28, 4, K.outl); R(x, cx - 13, cy + 22, 26, 3, K.wood);
        Blob(x, cx, cy + 4, 16, 18, K.woodD); Ell(x, cx - 6, cy - 2, 4, 7, K.wood); P(x, cx - 8, cy - 6, K.woodL);
        R(x, cx - 5, cy - 18, 10, 6, K.outl); R(x, cx - 4, cy - 17, 8, 5, open ? "#efe8d4" : K.wood);
        R(x, cx - 1, cy - 34 - up, 3, 30, K.outl); R(x, cx, cy - 33 - up, 1, 28, K.woodL); R(x, cx - 6, cy - 36 - up, 13, 3, K.woodD);
    }
    /** тавиур: the drying rack, with a piece of aaruul on every spot already laid. */
    static void Rack(PxCanvas x, Vector2[] spots, HashSet<int> placed)
    {
        foreach (int lx in new[] { 36, 122 }) { R(x, lx, 40, 3, 48, K.outl); R(x, lx + 1, 41, 1, 46, K.wood); }
        foreach (int ry in new[] { 48, 60 }) { R(x, 30, ry, 100, 6, K.outl); R(x, 31, ry + 1, 98, 4, "#c99257"); }
        for (int i = 0; i < spots.Length; i++) if (placed.Contains(i)) { int sx = (int)spots[i].x, sy = (int)spots[i].y; R(x, sx - 5, sy - 3, 10, 6, K.outl); R(x, sx - 4, sy - 2, 8, 4, CURD); P(x, sx - 3, sy - 2, "#ffffff"); }
    }
    static string Mix(string a, string b, float q)
    {
        Color A = Col(a), B = Col(b), c = Color.Lerp(A, B, Mathf.Clamp01(q));
        return "#" + ColorUtility.ToHtmlStringRGB(c);
    }
    static float Done(TaskState st) => st != null && st.n > 0 ? (st.progress + st.fill) / st.n : 0;

    static PxCanvas OptIcon(Action<PxCanvas> draw) { var c = new PxCanvas(16, 16); draw(c); return c; }
    static readonly Dictionary<string, Func<PxCanvas>> ICONS = new Dictionary<string, Func<PxCanvas>>
    {
        ["hot"] = () => OptIcon(x => { for (int i = 0; i < 3; i++) R(x, 3 + i * 4, 1 + (i % 2), 2, 5, "#ffffff"); Blob(x, 8, 11, 6, 3, IRON); R(x, 3, 7, 10, 1, "#e14b3d"); }),
        ["warm"] = () => OptIcon(x => { Blob(x, 8, 10, 5, 5, "#e8b48a"); R(x, 4, 2, 2, 6, K.outl); R(x, 7, 1, 2, 7, K.outl); R(x, 10, 2, 2, 6, K.outl); R(x, 5, 3, 1, 5, "#e8b48a"); R(x, 8, 2, 1, 6, "#e8b48a"); R(x, 11, 3, 1, 5, "#e8b48a"); }),
        ["cold"] = () => OptIcon(x => { foreach (var (dx, dy) in new[] { (1, 0), (0, 1), (1, 1), (1, -1) }) Line(x, 8 - dx * 6, 8 - dy * 6, 8 + dx * 6, 8 + dy * 6, "#4aa6e2"); P(x, 8, 8, "#ffffff"); }),
    };

    // ---------------------------------------------------------------- the recipes, step by step
    static readonly Vector2[] DRY_SPOTS = { V2(46, 50), V2(66, 50), V2(86, 50), V2(106, 50), V2(56, 62), V2(96, 62) };
    static readonly Dictionary<string, Func<TaskSpec>[]> STEPS = new Dictionary<string, Func<TaskSpec>[]>
    {
        ["aaruul"] = new Func<TaskSpec>[]
        {
            () => new TaskSpec { kind = "hold", holders = 1, ms = 1500, title = T("Сүүгээ исгэх", "Sour the milk"),
                hint = T("Дарж байгаад сүүгээ дулаан байлга. Исэхээрээ тараг болно.", "Hold to keep the milk warm. As it sours, it turns into tarag."),
                art = (x, t, st) => { Ground(x, t, st); Bucket(x, 80, 66, Mix(MILK, TARAG, Done(st))); } },
            () => new TaskSpec { kind = "rhythm", n = 4, speed = 0.8f, win = 0.26f, title = T("Ээдэм гаргах", "Boil out the curds"),
                hint = T("Буцалж байхад нь хэмнэлээр хутга. Цагаан ээдэм шар уснаас ялгарна.", "Stir on the beat as it boils. The white curds (ээдэм) come apart from the yellow whey."),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, Mix(TARAG, WHEY, Done(st)), curds: st != null ? st.progress * 2 : 0, steam: true); } },
            () => new TaskSpec { kind = "hold", holders = 1, ms = 1000, n = 2, title = T("Даавуунд шахах", "Press in a cloth"),
                hint = T("Ээдмээ даавуунд боогоод дарж шах. Шар ус нь гоожиж гарна.", "Wrap the curds in a cloth and hold to press. The whey drips out."),
                art = (x, t, st) => { Ground(x, t, st); R(x, 34, 80, 92, 6, K.outl); R(x, 35, 80, 90, 5, K.wood); float sq = Done(st); Blob(x, 80, 66 + Js.Round(sq * 4), 26, Js.Round(12 - sq * 4), "#f6f2e9"); R(x, 78, 50, 4, 6, "#d8cfba");
                    for (int i = 0; i < 3; i++) { float q = (t * 1.5f + i / 3f) % 1; P(x, 60 + i * 20, 88 + Js.Round(q * 20), WHEY); } } },
            () => new TaskSpec { kind = "drag", n = 3, path = new[] { V2(36, 64), V2(124, 64) }, title = T("Хэрчих", "Cut it into pieces"),
                hint = T("Утсаар нь чирж ээдмээ хэрчээрэй. 3 удаа!", "Drag the thread across to cut the curd block. 3 cuts!"),
                art = (x, t, st) => { Ground(x, t, st); R(x, 28, 76, 104, 8, K.outl); R(x, 29, 76, 102, 7, K.wood); R(x, 36, 50, 88, 26, K.outl); R(x, 37, 51, 86, 24, CURD);
                    for (int i = 0; i < (st != null ? st.progress : 0); i++) R(x, 37, 56 + i * 6, 86, 1, "#d8cfba"); } },
            () => new TaskSpec { kind = "spots", spots = DRY_SPOTS, title = T("Наранд хатаах", "Dry in the sun"),
                hint = T("Хэсэг бүрийг тавиур дээр дэлгэ. Нар, салхинд хэдэн хоног хатна.", "Lay each piece on the rack. Sun and wind dry them for a few days."),
                art = (x, t, st) => { Ground(x, t, st); Sun(x, t); Rack(x, DRY_SPOTS, st != null ? st.placed : new HashSet<int>()); } },
        },
        ["urum"] = new Func<TaskSpec>[]
        {
            () => new TaskSpec { kind = "hold", holders = 1, ms = 1800, title = T("Бага галд халаах", "Warm it on a low fire"),
                hint = T("Дарж байгаад сүүгээ аажмаар халаа. Хурдан буцалгавал түлэгдэнэ!", "Hold to heat the milk slowly. Boil it fast and it burns!"),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, low: true, steam: Done(st) > 0.5f); } },
            () => new TaskSpec { kind = "drag", n = 5, path = new[] { V2(80, 80), V2(80, 24) }, title = T("Самрах", "Ladle it up high"),
                hint = T("Шанагаа дээш өргөөд сүүгээ буцааж цутга. Хөөс нь өрөм болно.", "Lift the ladle high and pour the milk back. The foam becomes öröm."),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, low: true, foam: st != null ? st.progress * 2 : 0); if (st != null && st.along > 0.3f) R(x, 79, Js.Round(80 - st.along * 56), 2, Js.Round(st.along * 56) - 30, "#ffffff"); } },
            () => new TaskSpec { kind = "spots", spots = new[] { V2(80, 46) }, title = T("Шөнөжин хөргөх", "Cool it overnight"),
                hint = T("Тогоогоо таглаад шөнөжин хөргө. Өглөө дээр нь шар өрөм тогтоно.", "Cover the pot and let it cool overnight. By morning, yellow öröm sits on top."),
                art = (x, t, st) => { Night(x); Ground(x, t, st); Pot(x, t, 80, 52, "#f7d071", fire: false); if (st != null && st.progress > 0) { Ell(x, 80, 48, 25, 4, K.outl); Ell(x, 80, 47, 24, 3, IRON_L); } } },
        },
        ["tarag"] = new Func<TaskSpec>[]
        {
            () => new TaskSpec { kind = "hold", holders = 1, ms = 1400, title = T("Буцалгах", "Boil the milk"),
                hint = T("Дарж байгаад сүүгээ буцалга. Буцалгасан сүү цэвэр байдаг.", "Hold to bring the milk to the boil. Boiled milk is clean."),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, steam: Done(st) > 0.3f); } },
            () => new TaskSpec { kind = "choose", answer = "warm", title = T("Хэр бүлээн бэ?", "How warm?"),
                hint = T("Хөрөнгөө хийхэд сүү хэр дулаан байх ёстой вэ?", "How warm should the milk be when the starter goes in?"),
                options = new List<TaskOption>
                {
                    new TaskOption { id = "hot", label = T("Буцалж байхад", "Still boiling"), icon = ICONS["hot"](), why = T("Хэтэрхий халуун! Хөрөнгөнд байдаг ашигтай нян үхчихнэ. Бүлээн болтол хөргөөрэй.", "Too hot! The good bacteria in the starter would die. Let it cool until it is warm.") },
                    new TaskOption { id = "warm", label = T("Бүлээн", "Warm, like your hand"), icon = ICONS["warm"]() },
                    new TaskOption { id = "cold", label = T("Хүйтэн", "Cold"), icon = ICONS["cold"](), why = T("Хэтэрхий хүйтэн! Нян ажиллахгүй, тараг исэхгүй. Бүлээн байхад нь хий.", "Too cold! The bacteria can’t work, so it won’t turn into tarag. Add it while warm.") },
                },
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, fire: false, steam: true); } },
            () => new TaskSpec { kind = "spots", spots = new[] { V2(80, 48) }, title = T("Хөрөнгө нэмэх", "Add the starter"),
                hint = T("Өмнөх тарагнаасаа нэг халбага хий. Айлууд хөрөнгөө үеэс үед хадгалж, бие биедээ өгдөг.", "Add a spoon of old tarag. Families keep their starter for generations and share it."),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, st != null && st.progress > 0 ? TARAG : MILK, fire: false); Blob(x, 128, 76, 10, 5, "#f6f2e9"); Ell(x, 128, 73, 8, 2, TARAG); } },
            () => new TaskSpec { kind = "drag", n = 1, path = new[] { V2(80, 22), V2(80, 84) }, title = T("Дулаан хонуулах", "Keep it warm overnight"),
                hint = T("Дээлээрээ ороож дулаан газар хонуул. Өглөө нь тараг болсон байна.", "Wrap it in a deel and keep it somewhere warm overnight. By morning it is tarag."),
                art = (x, t, st) => { Ground(x, t, st); Pot(x, t, 80, 52, fire: false); float q = st != null ? (st.progress > 0 ? 1 : st.along) : 0; if (q > 0) { R(x, 52, 30, 56, Js.Round(q * 50), K.outl); R(x, 53, 31, 54, Js.Round(q * 50) - 2, "#2b52a5"); R(x, 53, 31, 54, 3, "#f7c646"); } } },
        },
        ["airag"] = new Func<TaskSpec>[]
        {
            () => new TaskSpec { kind = "drag", n = 2, path = new[] { V2(34, 40), V2(92, 52) }, title = T("Хөхүүрт цутгах", "Pour into the khukhuur"),
                hint = T("Гүүний сүүгээ хөхүүрт цутга.", "Pour the mare’s milk into the khukhuur."),
                art = (x, t, st) => { Ground(x, t, st); Khukhuur(x, 108, 56, 0, true); Bucket(x, 34, 58, MILK); if (st != null && st.along > 0.6f) R(x, 98, 34, 2, 8, "#ffffff"); } },
            () => new TaskSpec { kind = "rhythm", n = 12, speed = 1.05f, win = 0.28f, title = T("Бүлэх", "Churn"),
                hint = T("Хэмнэлээр нь бүлүүрээ дээш доош хий! Айргийг мянга гаруй удаа бүлдэг.", "Churn on the beat, up and down! Airag is churned over a thousand times."),
                art = (x, t, st) => { Ground(x, t, st); Khukhuur(x, 80, 56, Js.Round((Mathf.Sin(t * 8) + 1) * 5), false); } },
            () => new TaskSpec { kind = "spots", spots = new[] { V2(80, 40) }, title = T("Исгэх", "Let it ferment"),
                hint = T("Амсрыг нь таглаад нэг хоног исгэ. Тэгээд л айраг болно!", "Close the top and let it ferment for a day. Then it is airag!"),
                art = (x, t, st) => { Ground(x, t, st); Sun(x, t); Khukhuur(x, 80, 56, 0, !(st != null && st.progress > 0)); } },
        },
    };

    /** One step's task, numbered ("2/5 · …"); say is a kind word after a wrong guess. */
    public static TaskSpec Spec(string id, int i, Tx? say)
    {
        if (!STEPS.TryGetValue(id, out var list) || i >= list.Length) return null;
        var s = list[i](); int n = list.Length;
        s.title = T($"{i + 1}/{n} · {s.title.mn}", $"{i + 1}/{n} · {s.title.en}"); s.say = say; s.shake = say != null;
        return s;
    }
    public static int Steps(string id) => STEPS.TryGetValue(id, out var l) ? l.Length : 0;
    /** Do every step of a recipe by hand; result(true) when the food is made, false if closed on the way. */
    public static IEnumerator Make(Game g, string id, Action<bool> result)
    {
        int n = Steps(id); if (n == 0) { result(false); yield break; }
        for (int i = 0; i < n; i++)
        {
            Tx? say = null;
            while (true)
            {
                var sp = Spec(id, i, say); var w = g.Task(sp); yield return w;
                if (!w.r.done) { result(false); yield break; }
                if (sp.kind != "choose" || w.r.pick == sp.answer) break;
                var o = sp.options.Find(q => q.id == w.r.pick); say = o?.why ?? T("Дахиад бодоод үзээрэй.", "Think again.");
            }
        }
        result(true);
    }
}
