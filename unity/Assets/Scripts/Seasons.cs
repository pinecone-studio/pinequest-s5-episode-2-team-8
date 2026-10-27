// Улирал: Нутаг moves through the four Mongolian seasons, one per real day (spring → summer → autumn → winter), so every
// child sees all four within a few days. Ported from js/seasons.js (the texts are in Resources/Data/seasons.json).
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public static class Seasons
{
    public sealed class Season { public string id, color; public Tx name, months, camp, intro, game; public List<Tx> todo, facts, history; public List<string> tasks; }
    static List<Season> all;
    public static List<Season> All => all ??= Data.Get("seasons").Select(s => new Season
    {
        id = s["id"].S, color = s["color"].S, name = s["name"].T, months = s["months"].T, camp = s["camp"].T, intro = s["intro"].T, game = s["game"].T,
        todo = s["todo"].Select(x => x.T).ToList(), facts = s["facts"].Select(x => x.T).ToList(), history = s["history"].Select(x => x.T).ToList(), tasks = s["tasks"].Strings(),
    }).ToList();
    static int Day(DateTime d) => (int)Math.Floor((new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Utc) - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalDays);
    /** The season in Нутаг today (one per real day, cycling). */
    public static Season Current() => All[Day(DateTime.Now) % 4];
    /** The real season in Mongolia right now, by month. */
    public static Season Real() => All[new[] { 3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3 }[DateTime.Now.Month - 1]];
    public static Season ById(string id) => All.FirstOrDefault(s => s.id == id);
    /** Evening in Нутаг (19:00–6:00 local time). */
    public static bool Night() { int h = DateTime.Now.Hour; return h >= 19 || h < 6; }
}

public sealed partial class Game
{
    /** The season explainer: what Mongolians do, facts, history and the tasks in Нутаг. */
    sealed class SeasonModal : Modal
    {
        Vector2 scroll;
        public override void Draw(Game g)
        {
            var s = Seasons.Current(); var r = Seasons.Real(); var next = Seasons.All[(Seasons.All.IndexOf(s) + 1) % 4];
            g.Small(Loc.L("Нутгийн улирал", "Season in Nutag"));
            g.Title($"{s.name}  <size={g.Ts(12)}>{s.months} · {s.camp}</size>");
            scroll = g.BeginScroll(scroll, Screen.height * 0.55f);
            g.Text(s.intro.ToString());
            GUILayout.BeginHorizontal(); foreach (var x in Seasons.All) GUILayout.Label((x == s ? "<b>" : "") + x.name + (x == s ? "</b>" : "") + $"\n<size={g.Ts(9)}>{x.camp}</size>", x == s ? g.sPrimary : g.sBtn); GUILayout.EndHorizontal();
            void List(string head, List<Tx> items) { GUILayout.Label("<b>" + head + "</b>", g.sLabel); foreach (var i in items) GUILayout.Label("• " + i, g.sLabel); }
            List(Loc.L("Энэ улиралд малчид юу хийдэг вэ?", "What do herders do this season?"), s.todo);
            List(Loc.L("Сонирхолтой баримт", "Fun facts"), s.facts);
            List(Loc.L("Түүх, уламжлал", "History & tradition"), s.history);
            g.Fact(s.game.ToString(), true, Loc.L("Улирлын даалгавар", "Season task"));
            g.Small(Loc.L($"Нутагт улирал өдөр бүр солигдоно. Маргааш: {next.name}. Жинхэнэ Монголд яг одоо {r.name} байна.", $"Seasons in Nutag change every day. Tomorrow: {next.name}. In real Mongolia it is {r.name} right now."));
            g.EndScroll();
            if (g.Btn(Loc.L("Хаах", "Close"), true, 34)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }

    /** Season look over the village: a light tint plus falling snow, leaves, petals or summer butterflies; evening is darker with lantern glow. */
    void SeasonFx()
    {
        if (Event.current.type != EventType.Repaint) return;
        string id = Seasons.Current().id; float t = Time.time, k = ArtPx;
        if (id == "winter") Box(new Rect(0, 0, Screen.width, Screen.height), new Color(0.92f, 0.95f, 0.98f, 0.16f));
        else if (id == "autumn") Box(new Rect(0, 0, Screen.width, Screen.height), new Color(1f, 0.84f, 0.6f, 0.12f));
        else if (id == "spring") Box(new Rect(0, 0, Screen.width, Screen.height), new Color(1f, 0.78f, 0.9f, 0.06f));
        float bw = Screen.width / k, bh = Screen.height / k;
        int n = id == "winter" ? 34 : id == "summer" ? 10 : 28;
        for (int i = 0; i < n; i++)
        {
            float sp = id == "winter" ? 14 + (i % 5) * 4 : id == "summer" ? 4 : 10 + (i % 4) * 3;
            float x0 = (float)((Js.Hash(i, 7) * (bw + 40) + Math.Sin(t * 0.8 + i) * (id == "summer" ? 18 : 6)) % (bw + 40)) - 20;
            float y0 = id == "summer" ? (float)(Js.Hash(i, 3) * bh + Math.Sin(t * 1.7 + i) * 6) : (float)((Js.Hash(i, 11) * (bh + 30) + t * sp) % (bh + 30)) - 15;
            float X = Mathf.Round(x0) * k, Y = Mathf.Round(y0) * k;
            if (id == "winter") { Box(new Rect(X, Y, k, k), new Color(1, 1, 1, 0.7f)); if (i % 4 == 0) Box(new Rect(X + k, Y, k, k), new Color(0.86f, 0.91f, 0.96f, 0.7f)); }
            else if (id == "autumn") { Box(new Rect(X, Y, 2 * k, k), Px.Col(new[] { "#e8752a", "#c9461e", "#f2b33d" }[i % 3])); Box(new Rect(X + ((int)(t * 3 + i) % 2) * k, Y + k, k, k), Px.Col("#a8501c")); }
            else if (id == "spring") { Box(new Rect(X, Y, k, k), i % 2 != 0 ? Px.Col("#ffb7d5") : Color.white); if (i % 3 == 0) Box(new Rect(X + k, Y, k, k), Px.Col("#ff8fb1")); }
            else { bool on = (int)(t * 6 + i) % 2 != 0; Box(new Rect(X, Y, k, k), Color.white); if (on) { var c = i % 2 != 0 ? Px.Col("#ffd34e") : Px.Col("#b49cff"); Box(new Rect(X - k, Y, k, k), c); Box(new Rect(X + k, Y, k, k), c); } } // butterflies
        }
        if (!Seasons.Night()) return;
        Box(new Rect(0, 0, Screen.width, Screen.height), new Color(18 / 255f, 22 / 255f, 70 / 255f, 0.38f));
        foreach (var o in World.objects)
        {
            if (o.kind != "lantern") continue;
            var c = PxGui(o.x * T + 8, o.y * T - 6);
            foreach (var (rx, ry, a) in new[] { (26f, 20f, 0.10f), (15f, 12f, 0.14f), (6f, 5f, 0.2f) }) { var old = GUI.color; GUI.color = new Color(1f, 0.8f, 0.45f, a); GUI.DrawTexture(new Rect(c.x - rx * k, c.y - ry * k, rx * 2 * k, ry * 2 * k), Tex(Disc())); GUI.color = old; }
        }
    }
}
