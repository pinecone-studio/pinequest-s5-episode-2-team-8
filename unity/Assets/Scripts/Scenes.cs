// Animated pixel scenes for the heritage lessons (120×80 art pixels, drawn every frame), ported from js/learn/scenes.js.
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using static Px;

/** What a scene shows right now (the web version passes a loose object; these are all the fields the scenes read). */
public sealed class SceneState
{
    public int stage; public float sub, pull, temp, mold, flick, lit, layers, buuz;
    public float fx = -1e9f;                // Time.time of the last effect (milk jet, pressing…)
    public string side, hl, ch = "wolf", focus;
    public bool heat, over, tsatsal, molding, hlBad, broken;
    public string[] sides;
}

public static class Scenes
{
    public const int W = 120, H = 80;
    static string A(double a) => "rgba(255,255,255," + Math.Max(0, Math.Min(1, a)).ToString("0.00", CultureInfo.InvariantCulture) + ")";

    public static void Bg(PxCanvas x, float t)
    {
        R(x, 0, 0, W, 20, "#8fd0f5"); R(x, 0, 20, W, 20, "#a9dcf8"); R(x, 0, 40, W, 22, "#c6e9fb");
        Blob(x, 104, 11, 5, 5, "#ffe27a", "#f7c646");
        for (int i = 0; i < 3; i++) { int cx = (int)(((t * 3 + i * 55) % 170) - 25), cy = 8 + i * 7; Ell(x, cx, cy, 7, 2, "#ffffff"); Ell(x, cx + 5, cy - 1, 4, 2, "#ffffff"); }
        for (int X = 0; X < W; X++) { int top = Js.Round(47 - 7 * Math.Abs(Math.Sin(X / 17.0)) - 3 * Math.Sin(X / 7.0)); R(x, X, top, 1, 62 - top, "#86b1cf"); P(x, X, top, "#a8c9e0"); }
        for (int X = 0; X < W; X++) { int top = Js.Round(55 - 3 * Math.Sin(X / 11.0 + 1)); R(x, X, top, 1, 62 - top, "#5c9a36"); }
        R(x, 0, 60, W, 20, "#76b947");
        for (int i = 0; i < 14; i++) { int gx = (i * 37) % W, gy = 64 + (i * 13) % 14; P(x, gx, gy, "#5c9a36"); P(x, gx + 1, gy - 1, "#94d260"); }
    }
    static void Dog(PxCanvas x, int X, int Y, int f = 3) => x.Blit(Bankhar(f), X, Y);

    // ------------------------------------------------------------ build a ger (stages 0–9)
    public static void Ger(PxCanvas x, SceneState st, float t)
    {
        Bg(x, t);
        int s = st.stage; float q = st.sub; const string felt = "#e8dfc8", white = "#fbfbf6", wood = "#c99257", woodD = "#8a5a33";
        if (s >= 1) { R(x, 27, 63, 66, 3, K.woodD); R(x, 28, 63, 64, 1, K.woodL); }
        // stage 4: the toono is lifted on its two posts (sub 0 on the floor, 1 up); while it waits it bobs with the timing needle (temp)
        int ty = s == 4 && q < 1 ? Js.Round(54 - 26 * q - st.temp * 3) : 28;
        if (s >= 4) { R(x, 56, ty + 3, 2, 64 - ty - 3, woodD); R(x, 62, ty + 3, 2, 64 - ty - 3, woodD); }
        if (s >= 2 && s < 6)
        {
            int w = s == 2 ? Js.Round(60 * q) : 60;
            for (int X = 30; X < 30 + w; X += 5) { Line(x, X, 63, Math.Min(X + 5, 30 + w), 47, wood); Line(x, X, 47, Math.Min(X + 5, 30 + w), 63, wood); }
            R(x, 30, 46, w, 1, woodD); R(x, 30, 63, w, 1, woodD);
        }
        if (s >= 6) R(x, 30, 46, 60, 18, s >= 7 ? white : felt);
        if (s >= 5 && s < 6)
        {
            int[] order = { 0, 8, 4, 2, 6, 1, 7, 3, 5 }; int n = s == 5 ? Js.Round(9 * q) : 9;
            for (int j = 0; j < n; j++) { int k = order[j]; Line(x, Js.Round(54 + 12 * k / 8.0), 31, Js.Round(30 + 60 * k / 8.0), 46, "#e05a3a"); }
        }
        if (s >= 6)
        {
            for (int y = 31; y <= 46; y++) { double a = (y - 31) / 15.0; int l = Js.Round(54 - 24 * a), r = Js.Round(66 + 24 * a); R(x, l, y, r - l, 1, s >= 7 ? white : felt); P(x, l, y, "#9a8f78"); P(x, r - 1, y, "#9a8f78"); }
            if (s >= 7) { R(x, 30, 46, 60, 2, "#3f76db"); for (int X = 31; X < 90; X += 4) P(x, X, 46, "#f7c646"); R(x, 30, 62, 60, 1, "#3f76db"); }
        }
        if (s >= 4) { R(x, 52, ty, 16, 3, K.woodD); R(x, 53, ty + 1, 14, 1, K.gold); }
        if (s >= 3) { R(x, 54, 49, 12, 15, K.outl); R(x, 55, 50, 10, 14, K.red); R(x, 56, 51, 8, 5, K.orange); R(x, 59, 51, 2, 13, K.redD); P(x, 57, 53, K.gold); P(x, 62, 53, K.gold); }
        if (s >= 8) // the ropes go on one by one as you pull them tight (sub), then the two over the roof
        {
            int ropes = s == 8 ? Js.Round(3 * q) : 3, sag = s == 8 && q < 1 ? Js.Round(st.pull * 2) : 0;
            for (int j = 0; j < ropes; j++) { int y = 50 + j * 5; R(x, 30, y, 24, 1, woodD); R(x, 66, y, 24, 1, woodD); }
            if (ropes < 3 && sag > 0) { int y = 50 + ropes * 5; R(x, 30, y + 2 - sag, 24, 1, woodD); R(x, 66, y + 2 - sag, 24, 1, woodD); } // the next rope, being pulled up into place
            if (ropes >= 3) { Line(x, 54, 31, 32, 46, woodD); Line(x, 66, 31, 88, 46, woodD); }
        }
        if (s >= 9)
        {
            R(x, 63, 20, 2, 9, "#5a5a66");
            for (int i = 0; i < 3; i++) { float ph = (t * 5 + i * 6) % 18; Ell(x, 64 + Js.Round(Math.Sin(t + i) * 2), (int)(19 - ph), 2, 1, A(0.9 - ph / 22)); }
            if ((int)Math.Floor(t * 3) % 4 == 0) foreach (var (a, b) in new[] { (24, 40), (98, 36), (20, 56) }) P(x, a, b, "#fff7a8");
        }
        Dog(x, 94, 46, s >= 9 ? ((int)Math.Floor(t * 4) % 2 != 0 ? 0 : 3) : 3);
    }

    // ------------------------------------------------------------ dairy foods (stages 0–7)
    static void Cow(PxCanvas x)
    {
        Blob(x, 26, 48, 11, 6, "#ffffff", K.outl); Blob(x, 22, 46, 3, 2, "#2b1e2e"); Blob(x, 31, 50, 3, 2, "#2b1e2e");
        Blob(x, 39, 42, 4, 4, "#ffffff", K.outl); R(x, 41, 44, 3, 2, "#f2a0a0"); P(x, 40, 41, K.eye); P(x, 37, 37, "#d8cfba"); P(x, 42, 37, "#d8cfba");
        foreach (int lx in new[] { 17, 21, 30, 34 }) R(x, lx, 53, 2, 9, K.outl); R(x, 26, 54, 4, 2, "#f2a0a0");
    }
    public static void Idee(PxCanvas x, SceneState st, float t)
    {
        Bg(x, t);
        int s = st.stage; float q = st.sub, since = Time.time - st.fx, pull = st.pull;
        if (s == 0)
        {
            Cow(x);
            // two teats under the udder; the one being milked stretches as you pull, and a jet of milk hits the bucket
            foreach (var (side, tx0) in new[] { ("l", 25), ("r", 28) })
            {
                int len = 2 + (st.side == side ? Js.Round(pull * 4) : 0);
                R(x, tx0, 56, 2, len, "#e98c8c"); P(x, tx0, 56 + len - 1, "#f2a0a0");
                if (st.side == side && pull > 0) { R(x, tx0 - 1, 55 + Js.Round(pull * 3), 4, 2, "#edbb93"); P(x, tx0 - 1, 56 + Js.Round(pull * 3), "#c98a5a"); }
                if (st.side == side && since < 0.3f) for (int y = 57 + len; y < 62; y++) P(x, tx0 + (y % 2), y, "#ffffff");
            }
            R(x, 21, 60, 12, 5, K.outl); R(x, 22, 61, 10, 3, "#a5a5b0"); int f = st.tsatsal ? 3 : Js.Round(3 * q); if (f != 0) R(x, 22, 64 - f, 10, f, "#ffffff");
            if (st.tsatsal) // offering the first milk: a ladle swings up and drops fly to the sky
            {
                int ly = 52 - Js.Round(pull * 16); Line(x, 50, ly + 2, 58, ly + 10, K.woodD); R(x, 46, ly, 6, 3, "#a5a5b0"); R(x, 47, ly, 4, 1, "#ffffff");
                if (since < 1.2f) for (int i = 0; i < 9; i++) { double k = since * 40 + i * 3, dx = (i - 4) * (1 + since * 6); P(x, Js.Round(49 + dx), Js.Round(ly - k + since * since * 25), "#ffffff"); }
                for (int i = 0; i < Js.Round(st.flick * 3); i++) P(x, 46 + i * 6, 6 + ((int)Math.Floor(t * 3 + i) % 2), "#fff7a8");
            }
        }
        else if (s <= 5)
        {
            R(x, 46, 50, 28, 14, "#4a4a55"); R(x, 47, 51, 26, 2, "#6a6a77"); R(x, 66, 30, 3, 20, "#5a5a66");
            bool hot = st.heat || (s == 1 && st.temp > 0.2f);
            if (hot) for (int i = 0; i < 5; i++) { int fh = 2 + (int)((t * 9 + i * 3) % 3); R(x, 52 + i * 4, 60 - fh, 2, fh, i % 2 != 0 ? K.orange : K.gold); }
            if (s == 5 && q >= 1) { R(x, 44, 36, 32, 14, "#3f76db"); R(x, 44, 41, 32, 2, K.gold); }
            else
            {
                R(x, 47, 38, 26, 12, K.outl); R(x, 48, 39, 24, 10, "#c8c8d2"); R(x, 48, 39, 24, 2, "#ffffff");
                if (s == 1 && st.temp > 0.75f) for (int i = 0; i < 4; i++) P(x, 50 + ((i * 7 + (int)Math.Floor(t * 6)) % 20), 38, "#ffffff");
                if (s == 1 && st.over) { R(x, 46, 36, 28, 3, "#ffffff"); R(x, 45, 39, 3, 8, "#ffffff"); R(x, 72, 39, 3, 6, "#ffffff"); }
                if (s >= 2) { int fh = s == 2 ? Js.Round(4 * q) : 4; for (int i = 0; i < fh; i++) Ell(x, 60, 38 - i, 11 - i * 2, 1, "#fffbe8"); }
                if (s == 2) // the ladle follows your hand up; let go and the milk pours down into foam
                {
                    int ly = 30 - Js.Round(pull * 18); Line(x, 70, ly, 82, ly - 8, K.woodD); R(x, 66, ly, 6, 3, "#a5a5b0");
                    if (pull == 0 && since < 0.6f) { R(x, 68, ly + 3, 1, 35 - ly, "#ffffff"); for (int i = 0; i < 4; i++) P(x, 64 + i * 3, 37 - (((int)Math.Floor(t * 12) + i) % 2), "#ffffff"); }
                }
                if (s >= 3 && s < 5) for (int i = 0; i < (s == 3 ? 3 - Js.Round(3 * q) : 0); i++) Ell(x, 54 + i * 6, (int)(32 - ((t * 6 + i * 4) % 10)), 1, 1, "rgba(255,255,255,.7)");
                if (s == 4) { Line(x, 64, 28, 58, 37, "#a5a5b0"); Ell(x, 57, 37, 2, 1, "#fff6e0"); }
                if (s == 5) { int wh = Js.Round(14 * q); R(x, 44, 50 - wh, 32, wh, "#3f76db"); if (wh >= 9) R(x, 44, 41, 32, 2, K.gold); } // the blanket wraps up round the pot as you drag
            }
            if (s == 5) { R(x, 0, 0, W, H, "rgba(20,24,70," + (0.55 * (1 - Math.Abs(q * 2 - 1))).ToString("0.00", CultureInfo.InvariantCulture) + ")"); if (q > 0.2f && q < 0.8f) Blob(x, 20, 12, 4, 4, "#fff3c4", "#e6d8a0"); }
        }
        else if (s == 6)
        {
            R(x, 40, 56, 40, 4, K.woodD); int sq = Math.Min(5, Js.Round(5 * q + pull * 1.5));
            if (st.molding) // a carved wooden mould: push the curd into each hole by hand, a patterned piece forms
            {
                int k = Js.Round(st.mold * 3);
                for (int i = 0; i < 3; i++)
                {
                    int mx = 44 + i * 11; R(x, mx, 44, 10, 11, K.outl); R(x, mx + 1, 45, 8, 9, K.woodD); R(x, mx + 2, 46, 6, 7, i < k ? "#f3e6c4" : "#5a3a20");
                    if (i < k) foreach (var (px, py) in new[] { (4, 48), (3, 49), (5, 49), (4, 50), (4, 49) }) P(x, mx + px, py, "#d8c69c");
                }
                if (k < 3) { int cx0 = 49 + k * 11, dy = Js.Round(pull * 6); Blob(x, cx0, 40 + dy, 4, 3, "#f4efe3", "#b6a68a"); if (pull > 0) { R(x, cx0 - 5, 35 + dy, 11, 3, "#edbb93"); R(x, cx0 - 5, 35 + dy, 11, 1, "#c98a5a"); } }
                if (since < 0.4f) { P(x, 44 + (k - 1) * 11 + 1, 43, K.light); P(x, 44 + (k - 1) * 11 + 8, 43, K.light); }
                Dog(x, 92, 46); return;
            }
            Blob(x, 60, 50 + Js.Round(sq / 2.0), 12, 6 - Js.Round(sq / 2.0), "#f4efe3", "#b6a68a");
            R(x, 46, 36 + sq, 28, 8, K.rock); R(x, 47, 37 + sq, 26, 2, K.rockL);
            if (since < 0.5f || (q > 0 && (int)Math.Floor(t * 6) % 2 != 0)) { P(x, 50, 61, K.light); P(x, 70, 62, K.light); if (since < 0.5f) { P(x, 47, 58 + (int)Math.Floor(since * 8), K.light); P(x, 73, 58 + (int)Math.Floor(since * 8), K.light); } }
        }
        else
        {
            R(x, 28, 44, 64, 3, K.woodD); R(x, 30, 47, 2, 16, K.woodD); R(x, 88, 47, 2, 16, K.woodD);
            for (int i = 0; i < 12; i++) { int ax = 32 + (i % 6) * 9, ay = 38 + (i / 6) * 3; R(x, ax, ay, 6, 4, "#f3e6c4"); R(x, ax, ay + 3, 6, 1, "#d8c69c"); P(x, ax + 1, ay, "#ffffff"); }
            if ((int)Math.Floor(t * 2) % 2 != 0) P(x, 104, 20, "#fff7a8");
        }
        Dog(x, 92, 46);
    }

    // ------------------------------------------------------------ inside the ger, from above (etiquette)
    public static readonly Dictionary<string, int[]> ZONES = new Dictionary<string, int[]> { ["khoimor"] = new[] { 44, 6, 32, 15 }, ["hearth"] = new[] { 51, 31, 18, 18 }, ["door"] = new[] { 48, 64, 24, 14 }, ["west"] = new[] { 6, 22, 34, 36 }, ["east"] = new[] { 80, 22, 34, 36 } };
    /** The five animals in the herd picture, to tap. */
    public static readonly Dictionary<string, int[]> HERD_ZONES = new Dictionary<string, int[]> { ["horse"] = new[] { 2, 36, 28, 24 }, ["cattle"] = new[] { 28, 42, 22, 18 }, ["camel"] = new[] { 50, 36, 22, 26 }, ["sheep"] = new[] { 70, 44, 18, 16 }, ["goat"] = new[] { 88, 42, 18, 16 } };
    /** What is at canvas pixel (ax, ay) in a lesson's picture, for the "tap the right place" steps. */
    public static string ZoneAt(string scene, float ax, float ay)
    {
        if (scene != "herd") return ZoneAt(ax, ay);
        foreach (var kv in HERD_ZONES) { var z = kv.Value; if (ax >= z[0] && ax < z[0] + z[2] && ay >= z[1] && ay < z[1] + z[3]) return kv.Key; }
        return null;
    }
    public static string ZoneAt(float ax, float ay)
    {
        float d = Mathf.Sqrt((ax - 60) * (ax - 60) + (ay - 40) * (ay - 40));
        if (d > 39) return null;
        if (d < 9) return "hearth";
        if (ay < 21 && Math.Abs(ax - 60) < 18) return "khoimor";
        if (ay > 62 && Math.Abs(ax - 60) < 13) return "door";
        if (ax < 48) return "west";
        if (ax > 72) return "east";
        return null;
    }
    public static void Inside(PxCanvas x, SceneState st, float t)
    {
        R(x, 0, 0, W, H, "#76b947");
        for (int i = 0; i < 30; i++) P(x, (i * 41) % W, (i * 23) % H, "#5c9a36");
        Ell(x, 60, 40, 38, 38, K.outl); Ell(x, 60, 40, 37, 37, "#c99257"); Ell(x, 60, 40, 34, 34, "#f4efe3");
        Ell(x, 60, 40, 17, 17, "#c8483c"); Ell(x, 60, 40, 14, 14, "#e9a24a"); Ell(x, 60, 40, 11, 11, "#c8483c");
        R(x, 55, 35, 10, 10, K.outl); R(x, 56, 36, 8, 8, "#5a5a66"); int fl = (int)Math.Floor(t * 8) % 2; R(x, 58, 38 + fl, 4, 3 - fl, K.orange); P(x, 59, 39, K.gold);
        R(x, 56, 31, 2, 2, K.woodD); R(x, 62, 31, 2, 2, K.woodD);
        R(x, 47, 8, 26, 9, K.outl); R(x, 48, 9, 24, 7, K.orange); R(x, 48, 9, 24, 2, K.red); R(x, 52, 11, 4, 3, K.blue); R(x, 64, 11, 4, 3, K.blue); P(x, 60, 12, K.gold);
        R(x, 12, 32, 12, 8, K.outl); R(x, 13, 33, 10, 6, K.wood); R(x, 15, 31, 6, 2, K.woodD); R(x, 12, 46, 10, 10, K.outl); R(x, 13, 47, 8, 8, K.blue); R(x, 15, 49, 4, 4, K.gold);
        R(x, 96, 28, 12, 16, K.outl); R(x, 97, 29, 10, 14, K.orange); R(x, 97, 35, 10, 1, K.redD); Blob(x, 100, 52, 4, 3, "#a5a5b0", K.outl); Blob(x, 92, 58, 3, 2, "#c8483c", K.outl);
        R(x, 54, 74, 12, 6, K.outl); R(x, 55, 75, 10, 5, K.red); R(x, 53, 72, 14, 2, K.woodD);
        if (st.hl != null && ZONES.TryGetValue(st.hl, out var z))
            R(x, z[0], z[1], z[2], z[3], st.hlBad ? "rgba(225,75,61,.45)" : "rgba(255,230,80," + (0.35 + 0.2 * Math.Sin(t * 6)).ToString("0.00", CultureInfo.InvariantCulture) + ")");
        x.Blit(Bankhar(3), 98, 62);
    }

    // ------------------------------------------------------------ Secret History story pictures
    static void Arrow(PxCanvas x, int y, bool broken)
    {
        if (broken) { Line(x, 25, y, 55, y + 3, K.wood); Line(x, 62, y + 4, 95, y, K.wood); }
        else R(x, 25, y, 70, 1, K.wood);
        R(x, 95, y - 1, 3, 3, "#8a8a99"); P(x, 98, y, "#8a8a99"); R(x, 22, y - 1, 4, 1, K.red); R(x, 22, y + 1, 4, 1, K.red);
    }
    static void Bent(PxCanvas x, int y, int b)
    {
        Line(x, 25, y, 60, y + b, K.wood); Line(x, 60, y + b, 95, y, K.wood);
        R(x, 95, y - 1, 3, 3, "#8a8a99"); P(x, 98, y, "#8a8a99"); R(x, 22, y - 1, 4, 1, K.red); R(x, 22, y + 1, 4, 1, K.red);
    }
    public static void Story(PxCanvas x, SceneState st, float t)
    {
        string ch = st.ch ?? "wolf";
        if (ch == "arrows")
        {
            R(x, 0, 0, W, H, "#f6dca8"); R(x, 0, 0, W, 3, "#c99257"); R(x, 0, 77, W, 3, "#c99257");
            // the one arrow bends as you pull and snaps (sub 1); the bundle of five only gives a little and never breaks
            if (st.broken || st.sub >= 1) Arrow(x, 16, true); else if (st.focus != "bundle") Bent(x, 16, Js.Round(st.pull * 4));
            int give = st.focus == "bundle" ? Js.Round(st.pull * 1.5) + (t - st.fx < 0.25f ? 1 : 0) : 0;
            for (int i = 0; i < 5; i++) if (give > 0) Bent(x, 40 + i * 4, give); else Arrow(x, 40 + i * 4, false);
            R(x, 50, 38, 3, 20, K.woodD); R(x, 68, 38, 3, 20, K.woodD);
            return;
        }
        Bg(x, t);
        if (ch == "wolf")
        {
            for (int X = 20; X < 100; X++) { int top = Js.Round(26 + Math.Abs(X - 60) * 0.7); R(x, X, top, 1, 60 - top, "#6f97b8"); if (top < 34) P(x, X, top, "#ffffff"); }
            Blob(x, 40, 56, 7, 3, "#6f86a8", K.outl); Blob(x, 48, 52, 3, 3, "#6f86a8", K.outl); P(x, 47, 48, K.outl); P(x, 50, 48, K.outl); P(x, 50, 52, K.eye); Line(x, 33, 55, 30, 51, "#6f86a8");
            foreach (int lx in new[] { 35, 38, 42, 45 }) R(x, lx, 58, 1, 4, K.outl);
            Blob(x, 74, 56, 6, 3, "#c98a4b", K.outl); Blob(x, 80, 51, 2, 2, "#c98a4b", K.outl); P(x, 81, 50, K.eye); P(x, 79, 48, "#8a5a33"); P(x, 82, 48, "#8a5a33");
            foreach (int lx in new[] { 70, 72, 76, 78 }) R(x, lx, 58, 1, 4, "#8a5a33");
        }
        else if (ch == "river")
        {
            for (int y = 62; y < 74; y++) { int off = Js.Round(Math.Sin(y / 2.0) * 4); R(x, 0, y, W, 1, y % 3 != 0 ? "#4aa6e2" : "#93d4f6"); P(x, ((off + 60 + y * 5) % W + W) % W, y, "#e6f7ff"); }
            var g = GerSprite("#e8dfc8", "#e14b3d"); x.BlitScaled(g, 14, 42, 22, 22);
            float fx = (t * 20) % 140 - 10; int fy = 62 - Js.Round(Math.Abs(Math.Sin(t * 3)) * 8); Ell(x, (int)fx, fy, 3, 1, "#8fbf4a");
            for (int i = 0; i < Js.Round(st.layers); i++) { Ell(x, 42 + i * 8, 58, 3, 1, "#8fbf4a"); P(x, 44 + i * 8, 58, K.eye); } // the fish you caught, on the bank
        }
        else
        {
            int top = 16 + Js.Round((1 - Math.Min(1, st.sub + st.pull / 3)) * 30); // raised a third with each push
            R(x, 59, top, 2, 62 - top, K.woodD); Blob(x, 60, top - 1, 2, 2, K.gold, K.goldD);
            for (int i = 0; i < 9; i++) { int sw = Js.Round(Math.Sin(t * 3 + i) * 1.5); Line(x, 60, top + 2, Js.Round(46 + i * 3.5 + sw), top + 18 + (i % 3), "#ffffff"); }
            string[] cols = { "#3f76db", "#e14b3d", "#2ea35f", "#9466e0", "#e9a91f" };
            for (int i = 0; i < 26; i++) { double cx = 8 + i * 4.2; int cy = 66 + (i % 3); R(x, cx, cy, 2, 4, cols[i % 5]); R(x, cx, cy - 2, 2, 2, "#edbb93"); }
        }
    }

    // ------------------------------------------------------------ five herd animals (st.sub = how many are shown)
    public static void Herd(PxCanvas x, SceneState st, float t)
    {
        Bg(x, t);
        int n = Js.Round(st.sub * 5); int Bob(int i) => (int)Math.Floor(t * 2 + i) % 2;
        void Goat(int X, int Y, int f) { Blob(x, X + 6, Y + 6, 5, 3, "#e8e0d0", "#6a5a4a"); R(x, X + 10, Y + 2, 3, 4, "#e8e0d0"); P(x, X + 12, Y + 3, K.eye); Line(x, X + 11, Y + 2, X + 9, Y - 1, "#6a5a4a"); P(x, X + 12, Y + 6, "#d8cfba"); var lx = new[] { X + 3, X + 5, X + 8, X + 9 }; for (int i = 0; i < 4; i++) R(x, lx[i], Y + 9, 1, 3 - ((f + i) % 2), "#6a5a4a"); }
        void CowH(int X, int Y, int f) { Blob(x, X + 8, Y + 6, 7, 4, "#3a2c2c", K.outl); R(x, X + 14, Y + 3, 4, 4, "#3a2c2c"); P(x, X + 16, Y + 4, "#ffffff"); P(x, X + 13, Y + 2, "#d8cfba"); P(x, X + 18, Y + 2, "#d8cfba"); Line(x, X + 1, Y + 5, X - 1, Y + 10, "#3a2c2c"); var lx = new[] { X + 4, X + 6, X + 11, X + 13 }; for (int i = 0; i < 4; i++) R(x, lx[i], Y + 10, 1, 4 - ((f + i) % 2), "#241a1a"); }
        var list = new Action<int>[]
        {
            i => x.Blit(Horse("bay", 0, false), 4, 38),
            i => CowH(30, 44, Bob(i)),
            i => x.Blit(Animal("camel", Bob(i)), 52, 42),
            i => x.Blit(Animal("sheep", Bob(i)), 72, 48),
            i => Goat(90, 46, Bob(i)),
        };
        for (int i = 0; i < Math.Min(n, 5); i++) list[i](i);
        if (st.hl != null && HERD_ZONES.TryGetValue(st.hl, out var z))
            R(x, z[0], z[1], z[2], z[3], st.hlBad ? "rgba(225,75,61,.45)" : "rgba(255,230,80," + (0.35 + 0.2 * Math.Sin(t * 6)).ToString("0.00", CultureInfo.InvariantCulture) + ")");
        Dog(x, 98, 62);
    }
    // ------------------------------------------------------------ Tsagaan Sar table (st.buuz, st.layers)
    public static void Table(PxCanvas x, SceneState st, float t)
    {
        R(x, 0, 0, W, H, "#f4efe3"); for (int X = 0; X < W; X += 6) R(x, X, 0, 1, 40, "#e8dfc8");
        R(x, 0, 40, W, 40, "#c8483c"); R(x, 0, 40, W, 2, K.gold); for (int X = 4; X < W; X += 10) { P(x, X, 44, K.gold); P(x, X + 1, 45, K.gold); P(x, X + 2, 44, K.gold); }
        R(x, 14, 46, 92, 20, K.outl); R(x, 15, 47, 90, 18, K.wood); R(x, 15, 47, 90, 2, K.woodL);
        int layers = Js.Round(st.layers); // ul boov stack
        for (int i = 0; i < layers; i++) { R(x, 22, 44 - i * 4, 24, 4, K.outl); R(x, 23, 44 - i * 4, 22, 3, "#e9c27a"); R(x, 25, 45 - i * 4, 18, 1, "#c99a4a"); }
        if (layers != 0) { R(x, 26, 40 - layers * 4, 16, 3, "#f7f0e0"); P(x, 30, 39 - layers * 4, K.red); P(x, 34, 39 - layers * 4, K.gold); P(x, 38, 39 - layers * 4, K.white); }
        int buuz = Js.Round(st.buuz);
        Ell(x, 74, 50, 18, 5, K.white); Ell(x, 74, 50, 16, 4, "#e6f7ff");
        for (int i = 0; i < buuz; i++) { int bx = 62 + (i % 5) * 6, by = 46 + (i / 5) * 4; Blob(x, bx, by, 2, 2, "#fbf3e0", "#c9b893"); P(x, bx, by - 2, "#c9b893"); }
        if (st.heat || st.over) for (int i = 0; i < 4; i++) { double ph = (t * 8 + i * 5) % 14; Ell(x, 64 + i * 6 + Js.Round(Math.Sin(t * 3 + i)), (int)(44 - ph), 2, 1, A(0.85 - ph / 16)); } // steam while it cooks
        R(x, 92, 34, 6, 12, K.outl); R(x, 93, 35, 4, 10, K.white); R(x, 93, 37, 4, 2, K.blue);
        if ((int)Math.Floor(t * 2) % 2 != 0) P(x, 95, 32, "#ffffff");
    }
    // ------------------------------------------------------------ morin khuur (st.lit 0..1 glows the strings)
    public static void Khuur(PxCanvas x, SceneState st, float t)
    {
        R(x, 0, 0, W, H, "#2b1e3a"); for (int i = 0; i < 20; i++) P(x, (i * 37) % W, (i * 17) % 40, "#f7e6b0");
        float glow = st.lit; const int cx = 60;
        R(x, cx - 1, 8, 3, 46, K.woodD); R(x, cx, 8, 1, 46, K.wood);
        R(x, cx - 4, 4, 8, 5, K.wood); R(x, cx + 3, 3, 3, 3, K.woodD); P(x, cx + 5, 4, K.eye); P(x, cx - 2, 2, K.woodD);
        R(x, cx - 6, 14, 3, 2, K.woodL); R(x, cx + 4, 16, 3, 2, K.woodL);
        for (int r = 0; r < 18; r++) { int w = Js.Round(14 - Math.Abs(r - 9) * 0.5); R(x, cx - w, 52 + r, w * 2 + 1, 1, r == 0 || r == 17 ? K.outl : K.wood); }
        R(x, cx - 9, 56, 19, 10, K.woodL);
        string sc = glow > 0.05f ? "rgba(255,230,130," + (0.5 + glow * 0.5).ToString("0.00", CultureInfo.InvariantCulture) + ")" : "#d8cfba";
        Line(x, cx - 1, 10, cx - 1, 66, sc); Line(x, cx + 1, 10, cx + 1, 66, sc);
        int bowY = 58 + Js.Round(Math.Sin(t * 4) * (glow != 0 ? 3 : 0)); Line(x, cx - 22, bowY - 6, cx + 22, bowY + 4, K.woodD); Line(x, cx - 22, bowY - 5, cx + 22, bowY + 5, "#e8e0d0");
        if (glow > 0.05f) for (int i = 0; i < 4; i++) { double ny = 40 - ((t * 20 + i * 10) % 36), nx = cx + 18 + Math.Sin(t * 2 + i) * 6; R(x, nx, ny, 2, 2, K.gold); R(x, nx + 2, ny - 4, 1, 5, K.gold); }
    }
    // ------------------------------------------------------------ shagai: four knucklebones (st.sides = ["horse", ...])
    static readonly Dictionary<string, string> SIDE_COL = new Dictionary<string, string> { ["horse"] = "#e14b3d", ["camel"] = "#f39b2c", ["sheep"] = "#ffffff", ["goat"] = "#3f76db" };
    public static void Shagai(PxCanvas x, SceneState st, float t)
    {
        R(x, 0, 0, W, H, "#8a4b1f"); R(x, 6, 6, W - 12, H - 12, "#c8483c"); R(x, 10, 10, W - 20, H - 20, "#e9a24a");
        for (int i = 0; i < 4; i++)
        {
            string side = st.sides != null && i < st.sides.Length ? st.sides[i] : null; int X = 18 + i * 24, Y = 30 + (i % 2) * 6;
            Blob(x, X + 6, Y + 6, 7, 5, "#f4e6c4", "#8a6a42"); R(x, X + 3, Y + 2, 6, 3, "#d8c49a");
            if (side != null) { R(x, X + 3, Y + 5, 7, 3, SIDE_COL[side]); P(x, X + 6, Y + 9, "#8a6a42"); }
            else if ((int)Math.Floor(t * 6 + i) % 2 != 0) P(x, X + 6, Y - 2, "#ffffff");
        }
        if (st.sides != null && st.sides.Length > 0) { var ks = new[] { "horse", "camel", "sheep", "goat" }; for (int j = 0; j < 4; j++) R(x, 14 + j * 24, 60, 8, 4, SIDE_COL[ks[j]]); }
    }
    // ------------------------------------------------------------ the three manly games (st.focus: bokh | horse | archer)
    public static void Naadam(PxCanvas x, SceneState st, float t)
    {
        Bg(x, t);
        string f = st.focus; string[] crowd = { "#e14b3d", "#3f76db", "#f7c646", "#2ea35f" };
        R(x, 0, 30, W, 6, "#5a361c"); for (int i = 0; i < 30; i++) R(x, 2 + i * 4, 31 + (i % 2), 2, 2, crowd[i % 4]);
        float Fade(string k) => f != null && f != k ? 0.35f : 1;
        x.Alpha = Fade("bokh");
        x.BlitScaled(Wrestler("#d8342b", "#edbb93", f == "bokh" && (int)Math.Floor(t * 2) % 2 != 0 ? "push" : "grip", 0), 4, 38, 20, 30);
        x.BlitScaled(Wrestler("#2b5bd8", "#d9a06e", "grip", 0), 24, 38, 20, 30, true);
        x.Alpha = Fade("horse"); int hx = 46 + (f == "horse" ? Js.Round((t * 12) % 20) : 0);
        x.Blit(Horse("chestnut", f == "horse" ? 1 + (int)Math.Floor(t * 10) % 4 : 0, true), hx, 48); x.Blit(Char(new Look { deel = "gold", skin = "#EDBB93", hat = "cap" }, 2, 0), hx + 6, 33);
        x.Alpha = Fade("archer"); x.Blit(Char(new Look { deel = "green", skin = "#D9A06E", hat = "mongol" }, 2, 0), 92, 40); Line(x, 106, 46, 106, 58, K.woodD); Line(x, 106, 46, 104, 52, K.white); Line(x, 104, 52, 106, 58, K.white);
        x.Alpha = 1;
    }

    public static Action<PxCanvas, SceneState, float> ByName(string name)
    {
        switch (name)
        {
            case "ger": return Ger; case "idee": return Idee; case "inside": return Inside; case "story": return Story;
            case "herd": return Herd; case "table": return Table; case "khuur": return Khuur; case "shagai": return Shagai; case "naadam": return Naadam;
        }
        return (x, s, t) => Bg(x, t);
    }
}
