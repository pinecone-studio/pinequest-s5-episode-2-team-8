// Нутаг world: map layout, collision and path finding, ported from js/village/world.js. Drawing is in Px.cs.
// Tile coordinates are the web version's: x to the right, y downwards.
using System;
using System.Collections.Generic;
using UnityEngine;

public sealed class WObj
{
    public string id, kind, accent;
    public int x, y, w, h, i = -1;
    public bool hasDoor; public int doorX, doorY;
}

public static class World
{
    public const int W = Rules.W, H = Rules.H;
    // g grass · p path · s plaza · w water · d dock · k trampled earth (dairy yard) · f fence · T tree · B building · r rock · a arena sand
    public static readonly char[,] g = new char[H, W];
    public static readonly List<WObj> objects = new List<WObj>();
    public static readonly Dictionary<int, WObj> occ = new Dictionary<int, WObj>();
    public static readonly List<(int x, int y, bool pine)> trees = new List<(int, int, bool)>();
    public const int DOCK_X = 26, DOCK_Y = 5;
    public const double ARENA_CX = 47.5, ARENA_CY = 12.5, ARENA_RX = 6, ARENA_RY = 4.6;
    static readonly int[] LOT_X = { 3, 7, 11, 21, 25, 29, 33, 37 };
    // Naadam race loop around town (one lap ≈ 86 tiles): start line on the main road, east road, south lane, west road
    public static readonly Vector2[] LAP = { new Vector2(30, 13), new Vector2(42, 13), new Vector2(42, 22), new Vector2(42, 32), new Vector2(30, 32), new Vector2(18, 32), new Vector2(18, 22), new Vector2(18, 13) };

    public static char At(int x, int y) => x < 0 || y < 0 || x >= W || y >= H ? '\0' : g[y, x];
    static void Set(int x, int y, char c) { if (x >= 0 && y >= 0 && x < W && y < H) g[y, x] = c; }
    static void Rect(int x0, int y0, int x1, int y1, char c) { for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) Set(x, y, c); }
    static double Sq(double v) => v * v;

    static World()
    {
        var rng = new Js.Rng(20261021);
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) g[y, x] = 'g';
        for (int x = 0; x < W; x++) { Set(x, 0, 'T'); Set(x, 1, 'T'); Set(x, H - 1, 'T'); }
        for (int y = 0; y < H; y++) { Set(0, y, 'T'); Set(W - 1, y, 'T'); }
        for (int y = 2; y < H - 1; y++) for (int x = 1; x < W - 1; x++) if (Sq((x + 0.5 - 30) / 4.6) + Sq((y + 0.5 - 5.5) / 3.3) <= 1) Set(x, y, 'w');
        Rect(1, 12, W - 2, 13, 'p'); Rect(17, 2, 18, H - 2, 'p');
        Rect(15, 10, 20, 15, 's');
        Rect(19, 5, 24, 5, 'p'); Rect(25, 5, 26, 5, 'd');
        Rect(4, 6, 4, 11, 'p'); Rect(11, 6, 11, 11, 'p'); Rect(22, 11, 23, 11, 'p');
        // хот айл: the fenced herding and dairy yard, its ground trampled bare by the animals
        for (int x = 3; x <= 14; x++) { Set(x, 15, 'f'); Set(x, 23, 'f'); }
        for (int y = 15; y <= 23; y++) { Set(3, y, 'f'); Set(14, y, 'f'); }
        Rect(4, 16, 13, 22, 'k');
        Rect(9, 14, 10, 15, 'p');
        // sheep pasture
        for (int x = 22; x <= 33; x++) { Set(x, 18, 'f'); Set(x, 24, 'f'); }
        for (int y = 18; y <= 24; y++) { Set(22, y, 'f'); Set(33, y, 'f'); }
        Rect(27, 14, 27, 18, 'p');
        // ger neighborhood (south): 8 lots along a lane
        Rect(2, 31, 42, 32, 'p');
        Rect(41, 14, 42, 32, 'p'); // east road: closes the loop around town (used by the horse race)
        // decorative pond in the south meadow
        for (int y = 33; y < H - 1; y++) for (int x = 1; x < W - 1; x++) if (Sq((x + 0.5 - 30.5) / 4.2) + Sq((y + 0.5 - 35.8) / 2.2) <= 1) Set(x, y, 'w');
        // Naadam wrestling arena (east): sand ring, reached from the main road
        for (int y = 2; y < H - 1; y++) for (int x = 36; x < W - 1; x++) if (Sq((x + 0.5 - ARENA_CX) / ARENA_RX) + Sq((y + 0.5 - ARENA_CY) / ARENA_RY) <= 1) Set(x, y, 'a');
        Rect(46, 18, 47, 24, 'p');
        Rect(48, 20, 50, 20, 'p'); // lane to the Mongol script academy

        O("home", "ger", 3, 3, 3, 3, 4, 6, "#2F6BFF");
        O("arcade", "ger", 10, 3, 3, 3, 11, 6, "#E9A91F");
        O("shop", "shop", 21, 8, 4, 3, 22, 11);
        O("board", "board", 19, 10, 2, 1, 19, 11);
        O("well", "well", 12, 17, 1, 1, 12, 18);
        // the dairy yard: mares and foals on the зэл line, cows, goats, the outdoor stove, the aaruul rack and the airag churn
        O("zel", "zel", 4, 16, 5, 1, 6, 17);
        O("cow1", "cow", 9, 17, 2, 1, 9, 18);
        O("cow2", "cow", 10, 19, 2, 1, 10, 20);
        O("goat1", "goat", 5, 19, 1, 1, 5, 20);
        O("goat2", "goat", 7, 19, 1, 1, 7, 20);
        O("churn", "churn", 5, 21, 1, 1, 6, 22);
        O("tulga", "tulga", 8, 21, 1, 1, 8, 22);
        O("rack", "rack", 11, 21, 2, 1, 11, 22);
        O("lantern1", "lantern", 15, 10, 1, 1);
        O("lantern2", "lantern", 15, 15, 1, 1);
        O("lantern3", "lantern", 20, 15, 1, 1);
        O("bleachers", "bleachers", 42, 5, 12, 2);
        O("zasuul", "npc", 47, 8, 1, 1, 47, 9);
        O("ovoo", "ovoo", 46, 25, 2, 2, 46, 24);
        O("uya", "uya", 34, 14, 3, 1, 35, 13);
        O("archery", "archery", 45, 33, 8, 3, 44, 34);
        O("general", "general", 36, 10, 1, 1, 36, 11);
        O("historian", "historian", 29, 10, 1, 1, 29, 11);
        O("academy", "academy", 49, 17, 4, 3, 50, 20);
        O("emee", "emee", 6, 6, 1, 1, 6, 7);
        O("felt", "felt", 19, 20, 2, 1, 19, 21);          // felt making: beat, wet and roll the wool
        O("craftsman", "npcq", 15, 29, 1, 1, 15, 30);    // Grandpa Craftsman: the ger's wooden parts
        O("herder", "npcq", 25, 16, 1, 1, 25, 17);
        O("fisher", "npcq", 23, 6, 1, 1, 23, 7);
        O("farmer", "npcq", 12, 14, 1, 1, 12, 13);
        O("teacher", "npcq", 13, 6, 1, 1, 13, 7);
        O("trainer", "npcq", 38, 15, 1, 1, 38, 16);
        O("archer", "npcq", 44, 32, 1, 1, 44, 31);
        O("lantern4", "lantern", 40, 11, 1, 1);
        O("lantern5", "lantern", 40, 14, 1, 1);
        O("setsen", "statue", 54, 6, 1, 1, 54, 7);     // the stone statue of Setsen, right of the stands by the wrestling ground (a reserved spot: the trees stay where they were)
        for (int i = 0; i < LOT_X.Length; i++) { var o = O("lot" + i, "lot", LOT_X[i], 28, 3, 3, LOT_X[i] + 1, 31); o.i = i; }
        foreach (var o in objects) for (int y = o.y; y < o.y + o.h; y++) for (int x = o.x; x < o.x + o.w; x++) { Set(x, y, 'B'); occ[y * W + x] = o; }

        // trees, flowers, rocks
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) if (g[y, x] == 'T') trees.Add((x, y, Js.Hash(x, y) > 0.7));
        for (int y = 2; y < H - 1; y++) for (int x = 1; x < W - 1; x++)
        {
            if (g[y, x] != 'g' || Reserved(x, y) || !ClearAround(x, y)) continue;
            double r = rng.Next();
            if (r < 0.1) { Set(x, y, 'T'); trees.Add((x, y, rng.Next() > 0.6)); }
            else if (r < 0.13) Set(x, y, 'r');
        }
    }

    static WObj O(string id, string kind, int x, int y, int w, int h, int dx = -1, int dy = -1, string accent = null)
    {
        var o = new WObj { id = id, kind = kind, x = x, y = y, w = w, h = h, accent = accent, hasDoor = dx >= 0, doorX = dx, doorY = dy };
        objects.Add(o); return o;
    }
    static bool ClearAround(int x, int y)
    {
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { char c = At(x + dx, y + dy); if (c != '\0' && c != 'g' && c != 'T') return false; }
        return true;
    }
    static bool Reserved(int x, int y) => (x >= 13 && x <= 22 && y >= 9 && y <= 16) || (y >= 2 && y <= 7 && x >= 2 && x <= 14) || (x >= 22 && x <= 33 && y >= 18 && y <= 25) || (x >= 3 && x <= 14 && y >= 14 && y <= 24) || (x >= 38 && y >= 3 && y <= 19) || (x >= 1 && x <= 41 && y >= 26 && y <= 33) || (x >= 43 && x <= 50 && y >= 22 && y <= 28) || (x >= 43 && x <= 54 && y >= 30 && y <= 37);

    public static bool Blocked(int x, int y) => x < 0 || y < 0 || x >= W || y >= H || "TwfBr".IndexOf(g[y, x]) >= 0;
    public static WObj ObjAt(int x, int y) => occ.TryGetValue(y * W + x, out var o) ? o : null;

    /** A* path on the tile grid with 8 directions (no corner cutting). Returns tiles after the start, or null. */
    public static List<(int x, int y)> FindPath(int sx, int sy, int tx, int ty)
    {
        if (Blocked(tx, ty)) return null;
        if (sx == tx && sy == ty) return new List<(int, int)>();
        int Key(int x, int y) => y * W + x;
        double Hf(int x, int y) { int dx = Math.Abs(x - tx), dy = Math.Abs(y - ty); return Math.Max(dx, dy) + 0.41 * Math.Min(dx, dy); }
        var open = new List<int> { Key(sx, sy) };
        var g0 = new Dictionary<int, double> { [Key(sx, sy)] = 0 };
        var prev = new Dictionary<int, int>();
        var done = new HashSet<int>();
        int[,] dirs = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 }, { 1, 1 }, { 1, -1 }, { -1, 1 }, { -1, -1 } };
        for (int guard = 0; open.Count > 0 && guard < 6000; guard++)
        {
            int bi = 0;
            for (int i = 1; i < open.Count; i++) if (g0[open[i]] + Hf(open[i] % W, open[i] / W) < g0[open[bi]] + Hf(open[bi] % W, open[bi] / W)) bi = i;
            int k = open[bi]; open.RemoveAt(bi);
            int x = k % W, y = k / W;
            if (!done.Add(k)) continue;
            if (x == tx && y == ty)
            {
                var path = new List<(int, int)>();
                for (int c = k; c != Key(sx, sy); c = prev[c]) path.Insert(0, (c % W, c / W));
                return path;
            }
            for (int d = 0; d < 8; d++)
            {
                int dx = dirs[d, 0], dy = dirs[d, 1], nx = x + dx, ny = y + dy;
                if (Blocked(nx, ny) || (dx != 0 && dy != 0 && (Blocked(x + dx, y) || Blocked(x, y + dy)))) continue;
                int nk = Key(nx, ny); double ng = g0[k] + (dx != 0 && dy != 0 ? 1.41 : 1);
                if (!g0.TryGetValue(nk, out double old) || ng < old) { g0[nk] = ng; prev[nk] = k; open.Add(nk); }
            }
        }
        return null;
    }

    /** Nearest walkable tile next to (x,y), preferring ones close to (fx,fy). */
    public static (int x, int y)? NearestOpen(int x, int y, int fx, int fy)
    {
        (int, int)? best = null; double bd = 1e9;
        for (int r = 1; r <= 3 && best == null; r++) for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++)
        {
            int nx = x + dx, ny = y + dy;
            if (Blocked(nx, ny)) continue;
            double d = Math.Abs(nx - fx) + Math.Abs(ny - fy) + Math.Abs(dx) + Math.Abs(dy) * 1.01;
            if (d < bd) { bd = d; best = (nx, ny); }
        }
        return best;
    }
}
