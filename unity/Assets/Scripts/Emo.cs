// The game's pixel icons, from js/icons.js: 14×14 colour grids (Resources/Data/icons.json) with an outline added round them,
// head-and-shoulders people, game sprites fitted to 16×16, and the achievement badges. The web version swaps every emoji
// in its texts for these; here Emo.Icon("🐎") gives the same picture, and Emo.Strip removes emoji from text.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;

public static class Emo
{
    const string OUT = "#2b1e2e";
    static J D => Data.Get("icons");
    static readonly Dictionary<string, PxCanvas> cache = new Dictionary<string, PxCanvas>();

    /** An icon by name ("star", "horse") or by emoji ("⭐", "🐎"); null if there is none. */
    public static PxCanvas Icon(string id)
    {
        if (string.IsNullOrEmpty(id)) return null;
        string key = D["EMOJI"][id].S ?? D["EMOJI"][id.Replace("️", "")].S ?? id;
        if (cache.TryGetValue(key, out var c)) return c;
        try
        {
            if (D["SPR"].Has(key)) c = FromGrid(D["SPR"][key].Strings(), null, null);
            else if (VARIANT.TryGetValue(key, out var v)) c = FromGrid(D["SPR"][v.b].Strings(), v.swap, v.xf);
            else if (PEOPLE.TryGetValue(key, out var p)) c = p();
            else if (GAME.TryGetValue(key, out var gm)) c = gm();
        }
        catch (Exception) { c = null; }
        return cache[key] = c;
    }

    static readonly Dictionary<string, (string b, Dictionary<char, char> swap, string xf)> VARIANT = new Dictionary<string, (string, Dictionary<char, char>, string)>
    {
        ["heart_yellow"] = ("heart", new Dictionary<char, char> { ['r'] = 'y', ['R'] = 'Y', ['w'] = 'l' }, null), ["heart_pink"] = ("heart", new Dictionary<char, char> { ['r'] = 'i', ['R'] = 'I' }, null),
        ["fish_green"] = ("fish_blue", new Dictionary<char, char> { ['b'] = 'g', ['c'] = 'L' }, null), ["fish_red"] = ("fish_blue", new Dictionary<char, char> { ['b'] = 'r', ['c'] = 'o' }, null),
        ["arrow_up"] = ("arrow_down", null, "flipY"), ["arrow_left"] = ("arrow_down", null, "rotR"), ["arrow_right"] = ("arrow_down", null, "rotL"),
    };

    /** Paint a grid into a 16×16 canvas with a 1px outline around everything. */
    static PxCanvas FromGrid(List<string> rows, Dictionary<char, char> swap, string xf)
    {
        var x = new PxCanvas(16, 16); const int N = 14; var pal = D["PAL"];
        char At(int i, int j)
        {
            int ii = i, jj = j;
            if (xf == "flipY") jj = N - 1 - j; if (xf == "rotR") { ii = j; jj = N - 1 - i; } if (xf == "rotL") { ii = N - 1 - j; jj = i; }
            char ch = jj >= 0 && jj < rows.Count && ii >= 0 && ii < rows[jj].Length ? rows[jj][ii] : '.';
            return swap != null && swap.TryGetValue(ch, out var s) ? s : ch;
        }
        bool Solid(int i, int j) => i >= 0 && j >= 0 && i < N && j < N && At(i, j) != '.';
        for (int j = -1; j <= N; j++) for (int i = -1; i <= N; i++)
        {
            if (Solid(i, j)) x.Put(i + 1, j + 1, Px.Col(pal[At(i, j).ToString()].S ?? OUT));
            else if (Solid(i - 1, j) || Solid(i + 1, j) || Solid(i, j - 1) || Solid(i, j + 1)) x.Put(i + 1, j + 1, Px.Col(OUT));
        }
        return x;
    }
    /** Fit another picture (a game sprite) into 16×16, keeping its pixels square. */
    static PxCanvas Fit(PxCanvas src)
    {
        var x = new PxCanvas(16, 16); double k = Math.Min(16.0 / src.W, 16.0 / src.H); int w = Math.Max(1, Js.Round(src.W * k)), hh = Math.Max(1, Js.Round(src.H * k));
        x.BlitScaled(src, (16 - w) / 2, (16 - hh) / 2, w, hh); return x;
    }

    // ---------------------------------------------------------------- people: drawn from a few parts so every family member looks different
    sealed class Who { public string hair = "short", hairCol = "#3a2516", deel = "blue", skin = "mid", scarfCol, beard; public bool glasses, wave; }
    static readonly Dictionary<string, string[]> SKINS = new Dictionary<string, string[]> { ["light"] = new[] { "#f6d3b3", "#e0b18c" }, ["mid"] = new[] { "#edbb93", "#d29a6e" }, ["tan"] = new[] { "#d9a06e", "#b9824f" }, ["deep"] = new[] { "#b97a4a", "#94592f" } };
    static readonly Dictionary<string, string> DEELS = new Dictionary<string, string> { ["blue"] = "#3f76db", ["red"] = "#e14b3d", ["green"] = "#2ea35f", ["purple"] = "#9466e0", ["pink"] = "#f06ca8", ["gold"] = "#e9a91f", ["teal"] = "#1fa3a3", ["brown"] = "#8a5a33", ["white"] = "#f2eee4" };
    /** One head-and-shoulders person at (ox, oy), r = head radius. */
    static void Person(PxCanvas x, Who o, double ox = 8, double oy = 6, double r = 4)
    {
        var sk = SKINS[o.skin]; string skin = sk[0], skD = sk[1], hc = o.hairCol, dc = DEELS[o.deel];
        void Px1(double X, double Y, string col) => x.Put((int)Math.Round(X, MidpointRounding.AwayFromZero), (int)Math.Round(Y, MidpointRounding.AwayFromZero), Px.Col(col));
        void Disc(double cx, double cy, double rx, double ry, string col, Func<int, int, bool> cond = null)
        {
            for (int Y = (int)Math.Floor(cy - ry); Y <= (int)Math.Ceiling(cy + ry); Y++) for (int X = (int)Math.Floor(cx - rx); X <= (int)Math.Ceiling(cx + rx); X++)
            {
                double q = Math.Pow((X + 0.5 - cx) / (rx + 0.3), 2) + Math.Pow((Y + 0.5 - cy) / (ry + 0.3), 2);
                if (q <= 1 && (cond == null || cond(X, Y))) x.Put(X, Y, Px.Col(col));
            }
        }
        double sy = oy + r + 1;
        Disc(ox, sy + r * 0.9, r * 1.45, r * 0.95, OUT, (X, Y) => Y >= sy - 1);
        Disc(ox, sy + r * 0.9, r * 1.45 - 1, r * 0.95 - 1, dc, (X, Y) => Y >= sy);
        Px1(ox - 1, sy, "#f7c646"); Px1(ox, sy, "#f7c646"); if (r >= 4) Px1(ox + 1, sy + 1, "#f7c646");
        if (o.hair == "long") { bool Side(int X) => Math.Abs(X + 0.5 - ox) > r - 1.5; Disc(ox, oy + 1.5, r + 1.2, r + 1.5, OUT, (X, Y) => Y >= oy && Side(X)); Disc(ox, oy + 1.5, r + 0.4, r + 0.8, hc, (X, Y) => Y >= oy && Side(X)); }
        if (o.hair == "pigtails") { Disc(ox - r - 1, oy + 2, 1.4, 1.6, OUT); Disc(ox + r + 1, oy + 2, 1.4, 1.6, OUT); Disc(ox - r - 1, oy + 2, 0.8, 1, hc); Disc(ox + r + 1, oy + 2, 0.8, 1, hc); }
        if (o.hair == "bun") { Disc(ox, oy - r - 0.5, 1.8, 1.4, OUT); Disc(ox, oy - r - 0.5, 1.1, 0.8, hc); }
        Disc(ox, oy, r + 1, r + 1, OUT); Disc(ox, oy, r, r, skin);
        for (double Y = oy - 1; Y <= oy + r; Y++) Px1(ox + r - 0.4, Y, skD);
        if (o.hair == "scarf") { Disc(ox, oy, r + 1, r + 1, OUT, (X, Y) => Y <= oy - 1 || Math.Abs(X + 0.5 - ox) > r - 1); Disc(ox, oy, r, r, o.scarfCol ?? "#e14b3d", (X, Y) => Y <= oy - 1 || Math.Abs(X + 0.5 - ox) > r - 1.2); }
        else if (o.hair == "baby") { Px1(ox, oy - r, hc); Px1(ox + 1, oy - r - 1, hc); }
        else if (o.hair != "bald") Disc(ox, oy - 0.6, r, r - 0.4, hc, (X, Y) => Y < oy - r * 0.25 || (o.hair != "short" && Math.Abs(X + 0.5 - ox) > r - 1.2 && Y < oy + r * 0.5));
        else Disc(ox, oy, r, r, hc, (X, Y) => Math.Abs(X + 0.5 - ox) > r - 1.1 && Y < oy + 1 && Y > oy - r * 0.6);
        double ey = oy + (r >= 4 ? 0.5 : 0.2);
        Px1(ox - r * 0.45, ey, "#1e1a22"); Px1(ox + r * 0.45, ey, "#1e1a22");
        if (r >= 4) { Px1(ox - r * 0.7, ey + 1.5, "#f2a0a0"); Px1(ox + r * 0.7, ey + 1.5, "#f2a0a0"); Px1(ox - 0.5, oy + r * 0.62, "#a8312a"); Px1(ox + 0.5, oy + r * 0.62, "#a8312a"); }
        if (o.glasses) { Px1(ox - r * 0.45 - 1, ey, OUT); Px1(ox + r * 0.45 + 1, ey, OUT); Px1(ox, ey, OUT); }
        if (o.beard != null) Disc(ox, oy + r * 0.8, r * 0.7, 1.2, o.beard);
        if (o.wave) { Px1(ox + r + 2, oy - 3, skin); Px1(ox + r + 2, oy - 2, skin); Px1(ox + r + 3, oy - 4, OUT); Px1(ox + r + 1, oy - 4, OUT); Px1(ox + r + 2, oy - 4, skin); }
    }
    static Func<PxCanvas> P1(Who o) => () => { var x = new PxCanvas(16, 16); Person(x, o); return x; };
    static readonly Dictionary<string, Func<PxCanvas>> PEOPLE = new Dictionary<string, Func<PxCanvas>>
    {
        ["woman"] = P1(new Who { hair = "long", deel = "pink" }), ["man"] = P1(new Who { deel = "blue", skin = "tan" }),
        ["grandma"] = P1(new Who { hair = "bun", hairCol = "#d3d3dc", deel = "purple", glasses = true }), ["grandpa"] = P1(new Who { hair = "bald", hairCol = "#d3d3dc", deel = "brown", skin = "tan", beard = "#e8e8f0" }),
        ["person"] = P1(new Who { hairCol = "#5a3a22", deel = "teal" }), ["girl"] = P1(new Who { hair = "pigtails", deel = "red", skin = "light" }),
        ["boy"] = P1(new Who { deel = "green" }), ["child"] = P1(new Who { hairCol = "#6a4630", deel = "gold", skin = "light" }),
        ["baby"] = () => { var x = new PxCanvas(16, 16); Person(x, new Who { hair = "baby", deel = "white", skin = "light" }, 8, 7, 4.5); return x; },
        ["woman_scarf"] = P1(new Who { hair = "scarf", scarfCol = "#2ea35f", deel = "green", skin = "tan" }), ["woman_gray"] = P1(new Who { hair = "long", hairCol = "#c9c9d4", deel = "teal" }),
        ["man_gray"] = P1(new Who { hairCol = "#c9c9d4", deel = "brown", beard = "#d3d3dc" }),
        ["raise_hand"] = P1(new Who { deel = "gold", wave = true }),
        ["family3"] = () => { var x = new PxCanvas(16, 16); Person(x, new Who { deel = "blue", skin = "tan" }, 4, 4, 2.6); Person(x, new Who { hair = "long", deel = "pink" }, 12, 4, 2.6); Person(x, new Who { hair = "pigtails", deel = "red", skin = "light" }, 8, 8, 2.4); return x; },
        ["family4"] = () => { var x = new PxCanvas(16, 16); Person(x, new Who { deel = "blue", skin = "tan" }, 4, 3, 2.4); Person(x, new Who { hair = "long", deel = "pink" }, 12, 3, 2.4); Person(x, new Who { hair = "pigtails", deel = "red", skin = "light" }, 5, 9, 2); Person(x, new Who { deel = "green" }, 11, 9, 2); return x; },
        ["friends"] = () => { var x = new PxCanvas(16, 16); Person(x, new Who { deel = "gold" }, 4.5, 5, 3); Person(x, new Who { hair = "pigtails", deel = "teal", skin = "light" }, 11.5, 5, 3); Px.R(x, 7, 12, 2, 1, "#edbb93"); return x; },
    };

    // ---------------------------------------------------------------- sprites that come straight from the game's own art
    static readonly Dictionary<string, Func<PxCanvas>> GAME = new Dictionary<string, Func<PxCanvas>>
    {
        ["horse"] = () => Fit(Px.Horse("bay", 0, false)), ["dog"] = () => Px.Icon("ui:dog"), ["ger"] = () => Px.Icon("ui:ger"), ["coin"] = () => Px.Icon("ui:coin"),
        ["sheep"] = () => Fit(Px.Beast("sheep", 0)), ["goat"] = () => Fit(Px.Beast("goat", 0)), ["cow"] = () => Fit(Px.Beast("cow", 0)), ["yak"] = () => Fit(Px.Beast("yak", 0)),
        ["camel"] = () => Fit(Px.Beast("camel", 0)), ["bear"] = () => Fit(Px.Beast("bear", 0)), ["reindeer"] = () => Fit(Px.Beast("reindeer", 0)), ["gazelle"] = () => Fit(Px.Beast("gazelle", 0)),
        ["kitten"] = () => Fit(Px.Beast("kitten", 0)), ["puppy"] = () => Fit(Px.Beast("puppy", 0)), ["takhi"] = () => Fit(Px.Beast("takhi", 0)), ["swan"] = () => Fit(Px.Beast("swan", 0)),
        ["bow"] = () => Px.Icon("ui:bow"), ["ovoo"] = () => Px.Icon("ui:ovoo"), ["wrestle"] = () => Px.Icon("ui:wrestle"), ["bag"] = () => Px.Icon("ui:bag"),
        ["shop"] = () => Px.Icon("ui:shop"), ["morin"] = () => Px.Icon("furn:morinkhuur"), ["shagai"] = () => Px.Icon("furn:shagai"),
        ["perch"] = () => Px.Icon("fish:perch"), ["lenok"] = () => Px.Icon("fish:lenok"), ["taimen"] = () => Px.Icon("fish:taimen"),
        ["airag"] = () => Px.Icon("dairy:airag"), ["tarag"] = () => Px.Icon("dairy:tarag"), ["urum"] = () => Px.Icon("dairy:urum"), ["mare_milk"] = () => Px.Icon("dairy:mare"),
        ["deel_blue"] = () => Px.Icon("deel:blue"), ["deel_green"] = () => Px.Icon("deel:green"), ["deel_pink"] = () => Px.Icon("deel:pink"), ["deel_purple"] = () => Px.Icon("deel:purple"), ["deel_gold"] = () => Px.Icon("deel:gold"),
        ["raceflag"] = () => Fit(Px.RaceFlag("#e14b3d", 0)),
    };

    // ---------------------------------------------------------------- achievement badges (32×32): a frame per category, a unique emblem inside
    static readonly Dictionary<string, string[]> FRAME = new Dictionary<string, string[]>
    {
        ["learn"] = new[] { "#2b52a5", "#93d4f6", "#d6ecfb", "#f7c646" }, ["family"] = new[] { "#c2427e", "#f8c6dc", "#fde6f0", "#f7c646" },
        ["nutag"] = new[] { "#3f7a2c", "#a6dc6a", "#dff3c4", "#f7c646" }, ["naadam"] = new[] { "#a8312a", "#fbd27a", "#fff0c4", "#e14b3d" },
    };
    public static PxCanvas Badge(string emblem, string cat)
    {
        string key = "badge:" + emblem + ":" + cat; if (cache.TryGetValue(key, out var hit)) return hit;
        var x = new PxCanvas(32, 32); var F = FRAME.TryGetValue(cat, out var f) ? f : FRAME["learn"]; string rim = F[0], fill = F[1], hi = F[2], trim = F[3];
        bool InShape(int X, int Y, double r)
        {
            double dx = X + 0.5 - 16, dy = Y + 0.5 - 15;
            if (cat == "learn") return dx * dx + dy * dy <= r * r;                                                       // a round medallion
            if (cat == "family") { double t = (dy + r) / (2 * r); return Math.Abs(dy) <= r && Math.Abs(dx) <= r * (t < 0.55 ? 1 : 1 - (t - 0.55) * 2.0); } // a shield
            if (cat == "nutag") return Math.Abs(dx) <= r * 0.93 && Math.Abs(dx) * 0.55 + Math.Abs(dy) <= r;                  // a hexagon
            double a = Math.Atan2(dy, dx), rr = r * (0.86 + 0.14 * Math.Cos(a * 8)); return dx * dx + dy * dy <= rr * rr; // a rosette
        }
        string[] rib = cat == "naadam" ? new[] { "#e14b3d", "#3f76db" } : cat == "family" ? new[] { "#f492ba", "#f7c646" } : cat == "nutag" ? new[] { "#3f76db", "#e14b3d" } : new[] { "#e14b3d", "#f7c646" };
        for (int Y = 22; Y < 32; Y++)
        {
            for (int X = 8; X < 13; X++) if (!(Y == 31 && X == 10)) x.Put((int)(X - (Y - 22) * 0.3), Y, Px.Col(rib[0]));
            for (int X = 19; X < 24; X++) if (!(Y == 31 && X == 21)) x.Put((int)(X + (Y - 22) * 0.3), Y, Px.Col(rib[1]));
        }
        for (int Y = 0; Y < 32; Y++) for (int X = 0; X < 32; X++)
        {
            if (InShape(X, Y, 14.5)) x.Put(X, Y, Px.Col(OUT));
            if (InShape(X, Y, 13.5)) x.Put(X, Y, Px.Col(rim));
            if (InShape(X, Y, 12)) x.Put(X, Y, Px.Col(trim));
            if (InShape(X, Y, 11)) x.Put(X, Y, Px.Col((X + Y) % 9 == 0 ? hi : fill));
        }
        for (int i = 0; i < 6; i++) x.Put(9 + i, 6 + (int)Math.Round(i * 0.2, MidpointRounding.AwayFromZero), Px.Col(hi));
        var em = Icon(emblem); if (em != null) x.Blit(em, 8, 7);
        return cache[key] = x;
    }

    // ---------------------------------------------------------------- emoji in text
    static readonly Dictionary<string, string> stripped = new Dictionary<string, string>();
    /** The text with its emoji (and the joiners and variation selectors that build them) taken out. */
    public static string Strip(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        if (stripped.TryGetValue(s, out var r)) return r;
        var sb = new StringBuilder(s.Length);
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (char.IsHighSurrogate(c) && i + 1 < s.Length) { i++; continue; }                     // pictographs live above U+FFFF
            if (c == '‍' || c == '️' || (c >= '☀' && c <= '➿') || (c >= '⬀' && c <= '⯿') || c == '⏱' || c == '⭐') continue;
            sb.Append(c);
        }
        r = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), "  +", " ").Trim();
        if (stripped.Count < 20000) stripped[s] = r;
        return r;
    }
}
