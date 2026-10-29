// Things with a real body in the isometric view (Iso.cs): fences, rocks, the dock, the arena's flags, the foals' rope
// line, the empty lots' stakes and signs, the gers, the shop, the ovoo, the script academy, the уяа, the trees, the quest board, the well, the lanterns, the dairy's churn, stove and rack, Setsen's statue, the Naadam stand and the archery range are built
// from small boxes instead of being painted on the ground. Each box's top is lit, its sides are shaded by which way
// they face, and the whole village's boxes are one mesh drawn with the 3D world's shader (Shaders/NaadamyVoxel).
// Tile (x, y) at height h is world (x, -y, -h), on the same ground plane as the sprites.
using System.Collections.Generic;
using UnityEngine;

public static partial class Bodies
{
    static readonly List<Vector3> vs = new List<Vector3>();
    static readonly List<Color32> cs = new List<Color32>();
    static readonly List<int> ts = new List<int>();

    /** The boxes of the whole village, as one object. */
    public static GameObject Build()
    {
        vs.Clear(); cs.Clear(); ts.Clear();
        for (int ty = 0; ty < World.H; ty++) for (int tx = 0; tx < World.W; tx++)
        {
            char ch = World.g[ty, tx];
            if (ch == 'f') Fence(tx, ty);
            else if (ch == 'r') Rock(tx, ty);
            else if (ch == 'd') Dock(tx, ty);
        }
        Flags();
        foreach (var o in World.objects) if (!PICTURED.Contains(o.kind)) Thing(o);
        foreach (var t in World.trees) Tree(t.x, t.y, t.pine);
        var mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        mesh.SetVertices(vs); mesh.SetColors(cs); mesh.SetTriangles(ts, 0); mesh.RecalculateBounds();
        var go = new GameObject("Solid things");
        go.AddComponent<MeshFilter>().sharedMesh = mesh;
        var sh = Resources.Load<Shader>("Shaders/NaadamyVoxel") ?? Shader.Find("Naadamy/Voxel");
        go.AddComponent<MeshRenderer>().sharedMaterial = new Material(sh) { mainTexture = Texture2D.whiteTexture };
        LotSigns(go); // the "for sale" signs, one object each so a plot with a ger can hide its own (BodiesGer.cs)
        return go;
    }

    /** Builds one of the village's objects of a kind with a body. */
    static void Thing(WObj o)
    {
        switch (o.kind)
        {
            case "zel": Zel(o); break; case "lot": Lot(o); break; case "ger": Ger(o); break; case "bleachers": Bleachers(o); break;
            case "archery": Archery(o); break; case "ovoo": Ovoo(o); break; case "shop": Shop(o); break; case "statue": Statue(o); break;
            case "academy": Academy(o); break; case "uya": Uya(o); break; case "board": Board(o); break; case "well": Well(o); break;
            case "lantern": Lantern(o); break; case "felt": Felt(o); break; case "churn": Churn(o); break; case "tulga": Tulga(o); break; case "rack": Rack(o); break;
        }
    }

    static void Fence(int tx, int ty)
    {
        Color wood = Px.Col(Px.K.wood), dark = Px.Col(Px.K.woodD);
        float cx = tx + 0.5f, cy = ty + 0.5f;
        Box(cx, cy, 0, 0.22f, 0.22f, 0.78f, dark);
        Box(cx, cy, 0.78f, 0.26f, 0.26f, 0.05f, wood); // the post's cap
        bool F(int x, int y) => World.At(x, y) == 'f';
        // half a pair of rails towards each neighbouring fence, so neighbours meet in the middle of the edge
        foreach (var (dx, dy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
        {
            if (!F(tx + dx, ty + dy)) continue;
            float mx = cx + dx * 0.25f, my = cy + dy * 0.25f, w = dx != 0 ? 0.5f : 0.09f, d = dy != 0 ? 0.5f : 0.09f;
            Box(mx, my, 0.24f, w, d, 0.1f, wood);
            Box(mx, my, 0.52f, w, d, 0.1f, wood);
        }
    }

    static void Rock(int tx, int ty)
    {
        Color rock = Px.Col(Px.K.rock), light = Px.Col(Px.K.rockL);
        float h = (float)Px.Hash(tx * 13, ty * 7), cx = tx + 0.5f + (h - 0.5f) * 0.2f, cy = ty + 0.62f;
        Box(cx, cy, 0, 0.62f, 0.5f, 0.24f + h * 0.1f, rock);
        Box(cx - 0.06f, cy - 0.04f, 0.24f + h * 0.1f, 0.4f, 0.32f, 0.14f, Color.Lerp(rock, light, 0.45f));
        if (h > 0.5f) Box(cx + 0.26f, cy + 0.12f, 0, 0.22f, 0.2f, 0.14f, rock); // a pebble beside it
    }

    static void Dock(int tx, int ty)
    {
        Color wood = Px.Col(Px.K.wood), dark = Px.Col(Px.K.woodD);
        for (int i = 0; i < 4; i++) Box(tx + 0.125f + i * 0.25f, ty + 0.5f, 0.12f, 0.23f, 0.74f, 0.07f, i % 2 == 0 ? wood : Color.Lerp(wood, dark, 0.25f)); // the planks
        foreach (var (px, py) in new[] { (0.12f, 0.16f), (0.88f, 0.16f), (0.12f, 0.84f), (0.88f, 0.84f) }) Box(tx + px, ty + py, -0.1f, 0.1f, 0.1f, 0.34f, dark);
    }

    static void Flags()
    {
        string[] cols = { Px.K.blue, Px.K.red, Px.K.gold, Px.K.white };
        Color pole = Px.Col(Px.K.woodD);
        for (int i = 0; i < 16; i++)
        {
            double a = i / 16.0 * Mathf.PI * 2;
            float fx = (float)(World.ARENA_CX + System.Math.Cos(a) * (World.ARENA_RX + 0.6)), fy = (float)(World.ARENA_CY + System.Math.Sin(a) * (World.ARENA_RY + 0.6));
            Box(fx, fy, 0, 0.07f, 0.07f, 0.95f, pole);
            Box(fx + 0.17f, fy, 0.66f, 0.3f, 0.04f, 0.24f, Px.Col(cols[i % 4]));
        }
    }

    /** зэл: two posts with the rope sagging between them, where the foals are tied. */
    static void Zel(WObj o)
    {
        Color post = Px.Col(Px.K.wood), rope = Px.Col("#8a7a64");
        float y = o.y + 0.85f, xa = o.x + 3.5f / 16, xb = o.x + o.w - 3.5f / 16;
        Box(xa, y, 0, 0.12f, 0.12f, 1.0f, post); Box(xb, y, 0, 0.12f, 0.12f, 1.0f, post);
        const int N = 16;
        for (int i = 0; i < N; i++) { float q = (i + 0.5f) / N; Box(Mathf.Lerp(xa, xb, q), y, 0.86f - Mathf.Sin(q * Mathf.PI) * 0.14f, (xb - xa) / N + 0.01f, 0.04f, 0.04f, rope); }
    }

    /** An empty ger lot's corner stakes and its "for sale" sign (the bare ground is in Px.RenderGround). */
    static void Lot(WObj o)
    {
        Color stake = Px.Col(Px.K.woodD), paper = Px.Col(Px.K.paper), gold = Px.Col(Px.K.gold);
        foreach (var (cx, cy) in new[] { (3, 6), (45, 6), (3, 44), (45, 44) }) Box(o.x + cx / 16f, o.y + cy / 16f, 0, 0.12f, 0.12f, 0.36f, stake);
    }

    /** A ger: felt wall with its skirt and hair ropes, the roof cover with its coloured trim, the toono, stovepipe and door. */
    static void Ger(WObj o)
    {
        string acc = o.accent == "#7A5AF8" ? Px.K.purple : o.accent == "#E9A91F" ? "#2f7d5b" : Px.K.blue;
        float cx = o.x + o.w / 2f, cy = o.y + o.h / 2f + 0.1f, k = 1.65f; // k: heights scaled to the people, who are 1.75 tiles tall
        Ring(cx, cy, 0, 1.26f, 0.18f * k, 1.26f, Px.Col("#ab9b7a"));           // хаяавч
        Ring(cx, cy, 0.18f * k, 1.25f, 0.92f * k, 1.25f, Px.Col("#f2ede1"));   // the felt wall
        foreach (float h in new[] { 0.36f, 0.56f, 0.76f }) Ring(cx, cy, h * k, 1.262f, (h + 0.035f) * k, 1.262f, Px.Col("#9c896e")); // twisted hair ropes
        Ring(cx, cy, 0.86f * k, 1.42f, 0.98f * k, 1.38f, Px.Col(acc));          // the roof cover's trim
        Ring(cx, cy, 0.98f * k, 1.38f, 1.5f * k, 0.3f, Px.Col("#f6f2e9"));      // the roof
        Ring(cx, cy, 1.5f * k, 0.3f, 1.57f * k, 0.27f, Px.Col("#c9772f"));      // тооно
        Disc(cx, cy, 1.57f * k, 0.27f, Px.Col("#5a3a22"));
        Box(cx + 0.14f, cy - 0.12f, 1.35f * k, 0.12f, 0.12f, 0.5f * k, Px.Col("#5d5d6b")); // stovepipe
        Box(cx, cy + 1.25f, 0.04f, 0.7f, 0.06f, 0.78f * k, Px.Col("#8a4f1c"));            // the door's carved frame
        Box(cx, cy + 1.29f, 0.12f, 0.52f, 0.05f, 0.62f * k, Px.Col("#e8892b"));           // and its painted leaf
        Box(cx, cy + 1.32f, 0.38f * k, 0.12f, 0.02f, 0.12f * k, Px.Col(Px.K.gold));       // the knot ornament
        Box(cx, cy + 1.36f, 0, 0.8f, 0.2f, 0.05f, Px.Col(Px.K.woodD));            // threshold
    }

    /** The Naadam stand: three wooden tiers full of people in bright deels, with flags along the back. */
    static void Bleachers(WObj o)
    {
        Color wood = Px.Col(Px.K.wood), dark = Px.Col(Px.K.woodD), light = Px.Col(Px.K.woodL);
        string[] shirts = { Px.K.red, Px.K.blue, Px.K.gold, Px.K.crop, Px.K.purple, Px.K.white };
        float x0 = o.x + 0.05f, w = o.w - 0.1f;
        for (int row = 0; row < 3; row++)
        {
            float y = o.y + o.h - 0.3f - row * 0.55f, top = 0.3f + row * 0.5f;
            Box(x0 + w / 2, y, 0, w, 0.55f, top, dark);
            Box(x0 + w / 2, y + 0.2f, top, w, 0.12f, 0.03f, light); // the bench plank
            for (int i = 0; i < o.w * 2 - 1; i++)
            {
                if (Px.Hash(i, row + 3) < 0.25) continue;
                float sx = o.x + (6 + i * 8 + (row % 2) * 3) / 16f, sy = y - 0.05f;
                Box(sx, sy, top, 0.3f, 0.24f, 0.55f, Px.Col(shirts[(int)(Px.Hash(i * 3, row) * 6)])); // sitting people, as tall as the walking ones sitting down
                Box(sx, sy, top + 0.55f, 0.22f, 0.2f, 0.24f, Px.Col(Px.Hash(i, row) > 0.5 ? "#edbb93" : "#d9a06e"));
                Box(sx, sy - 0.01f, top + 0.79f, 0.23f, 0.21f, 0.06f, Px.Col(Px.K.hair));
            }
        }
        Box(x0 + w / 2, o.y + o.h - 1.95f, 0, w, 0.08f, 2.0f, wood); // the back wall
        string[] flags = { Px.K.red, Px.K.blue, Px.K.gold };
        for (int i = 0; i < 6; i++) { float fx = o.x + (8 + i * 36) / 16f, fy = o.y + o.h - 1.95f; Box(fx, fy, 2.0f, 0.06f, 0.06f, 0.8f, dark); Box(fx + 0.17f, fy, 2.5f, 0.3f, 0.03f, 0.26f, Px.Col(flags[i % 3])); }
    }

    /** Сур харваа: the bow rack, the low wall of small leather targets in red, white and blue, and two flags. */
    static void Archery(WObj o)
    {
        Color dark = Px.Col(Px.K.woodD), wood = Px.Col(Px.K.wood);
        float ry = o.y + 1.4f;
        Box(o.x + 0.3f, ry, 0, 0.1f, 0.1f, 0.9f, dark); Box(o.x + 0.68f, ry, 0, 0.1f, 0.1f, 0.9f, dark);
        Box(o.x + 0.49f, ry, 0.72f, 0.55f, 0.08f, 0.07f, wood);
        foreach (float bx in new[] { 0.38f, 0.6f }) Box(o.x + bx, ry + 0.05f, 0.1f, 0.03f, 0.03f, 0.75f, Px.Col(Px.K.woodL)); // bows leaning on it
        string[] cols = { Px.K.red, Px.K.white, Px.K.blue };
        float tx = o.x + o.w - 1.35f, ty = o.y + 1.5f;
        Box(tx + 0.42f, ty + 0.05f, 0, 1.2f, 0.55f, 0.04f, dark); // the mat they stand on
        for (int r = 0; r < 3; r++) for (int c = 0; c < 5; c++) Box(tx + c * 0.19f + (r % 2) * 0.06f, ty - 0.12f + r * 0.13f, 0.04f, 0.15f, 0.11f, 0.2f, Px.Col(cols[(c + r) % 3]));
        foreach (var (fx, fy, col) in new[] { (o.x + o.w - 0.22f, o.y + 0.9f, Px.K.gold), (o.x + 1.28f, o.y + 0.85f, Px.K.blue) })
        { Box(fx, fy, 0, 0.06f, 0.06f, 1.1f, dark); Box(fx + 0.15f, fy, 0.8f, 0.26f, 0.03f, 0.24f, Px.Col(col)); }
    }

    /** Овоо: a cone of stones on a hill, a pole in the middle and blue khadag scarves running from its top. */
    static void Ovoo(WObj o)
    {
        Color rock = Px.Col(Px.K.rock), light = Px.Col(Px.K.rockL), dark = Px.Col(Px.K.rockD);
        float cx = o.x + 1, cy = o.y + 1.3f;
        Ring(cx, cy, 0, 0.95f, 0.45f, 0.62f, rock);
        Ring(cx, cy, 0.45f, 0.62f, 1.05f, 0.18f, Color.Lerp(rock, light, 0.25f));
        Disc(cx, cy, 1.05f, 0.18f, light);
        // loose stones on its sides
        for (int i = 0; i < 26; i++)
        {
            float a = i * 2.39996f, q = (float)Px.Hash(i, 5), r = Mathf.Lerp(0.88f, 0.22f, q), z = q * 0.95f;
            Color c = i % 3 == 0 ? light : i % 3 == 1 ? dark : rock;
            Box(cx + Mathf.Cos(a) * r, cy + Mathf.Sin(a) * r, z, 0.16f, 0.14f, 0.1f, c);
        }
        Color pole = Px.Col(Px.K.woodD);
        Box(cx, cy, 0, 0.09f, 0.09f, 2.3f, pole);
        Box(cx, cy, 2.22f, 0.32f, 0.12f, 0.1f, Px.Col(Px.K.blue)); // the scarf knotted at the top
        var top = W(cx, cy, 2.15f);
        foreach (var (dx, dy, col) in new[] { (-0.85f, 0.25f, Px.K.light), (0.7f, 0.4f, Px.K.blue), (-0.3f, -0.8f, Px.K.light), (0.45f, -0.6f, Px.K.white), (0.1f, 0.9f, Px.K.blue) })
            Strip(top, W(cx + dx, cy + dy, 0.35f), 0.05f, Px.Col(col));
    }

    /** The shop: a striped blue and white tent with a red roof, a counter of goods in front, its sign and flags. */
    static void Shop(WObj o)
    {
        Color blue = Px.Col(Px.K.blue), white = Px.Col(Px.K.white), red = Px.Col(Px.K.red), redD = Px.Col(Px.K.redD), wood = Px.Col(Px.K.wood);
        float cx = o.x + o.w / 2f, cy = o.y + 1.55f, w = o.w - 0.2f, d = 2.0f, h = 1.35f;
        int n = 14;
        for (int i = 0; i < n; i++) Box(cx - w / 2 + (i + 0.5f) * w / n, cy, 0, w / n + 0.002f, d, h, i % 2 == 0 ? blue : white); // the stripes
        Roof(cx, cy, w + 0.3f, d + 0.3f, h, h + 1.0f, red);
        for (int i = 0; i < 10; i++) Box(cx - w / 2 + (i + 0.5f) * w / 10, cy + d / 2 + 0.17f, h - 0.16f, 0.2f, 0.04f, 0.14f, redD); // the scalloped valance
        // the counter and what's for sale on it
        float fy = cy + d / 2 + 0.38f;
        Box(cx, fy, 0, w * 0.75f, 0.42f, 0.62f, Px.Col(Px.K.woodD));
        Box(cx, fy, 0.62f, w * 0.78f, 0.46f, 0.05f, wood);
        string[] goods = { Px.K.orange, Px.K.red, Px.K.crop, Px.K.gold, Px.K.white, Px.K.red };
        for (int i = 0; i < goods.Length; i++) Box(cx - w * 0.33f + i * w * 0.13f, fy, 0.67f, 0.2f, 0.2f, 0.16f + (i % 2) * 0.06f, Px.Col(goods[i]));
        // the sign over the door, with a coin on it
        Box(cx, cy + d / 2 + 0.03f, h - 0.6f, 1.25f, 0.05f, 0.42f, Px.Col(Px.K.outl));
        Box(cx, cy + d / 2 + 0.06f, h - 0.56f, 1.15f, 0.04f, 0.34f, Px.Col(Px.K.paper));
        Box(cx, cy + d / 2 + 0.09f, h - 0.48f, 0.2f, 0.03f, 0.2f, Px.Col(Px.K.gold));
        foreach (var (fx, fz, col) in new[] { (cx, h + 1.0f, Px.K.gold), (cx - w / 2 - 0.1f, h, Px.K.crop), (cx + w / 2 + 0.1f, h, Px.K.blue) })
        { Box(fx, cy + 0.0f, fz, 0.06f, 0.06f, 0.6f, Px.Col(Px.K.woodD)); Box(fx + 0.15f, cy, fz + 0.38f, 0.26f, 0.03f, 0.2f, Px.Col(col)); }
    }

    /** Setsen's statue: a stone wrestler on a two-step pedestal with a bronze plaque, flexing both arms. */
    static void Statue(WObj o)
    {
        Color L1 = Px.Col("#d6d6cf"), M = Px.Col("#aeaea6"), D = Px.Col("#7c7c74");
        float cx = o.x + 0.5f, cy = o.y + 0.6f;
        Box(cx, cy, 0, 1.3f, 1.0f, 0.3f, M);
        Box(cx, cy, 0.3f, 0.95f, 0.75f, 0.28f, L1);
        Box(cx, cy + 0.51f, 0.06f, 0.6f, 0.03f, 0.2f, Px.Col("#d9a640")); // the plaque
        float b = 0.58f; // the figure stands on the pedestal
        Box(cx - 0.17f, cy, b, 0.2f, 0.22f, 0.7f, M); Box(cx + 0.17f, cy, b, 0.2f, 0.22f, 0.7f, D); // legs, planted wide
        Box(cx, cy, b + 0.62f, 0.56f, 0.3f, 0.26f, D);                                              // шуудаг
        Box(cx, cy, b + 0.88f, 0.5f, 0.28f, 0.3f, M);                                               // the stomach
        Box(cx, cy, b + 1.18f, 0.76f, 0.32f, 0.32f, L1);                                            // the broad chest and shoulders
        foreach (int s in new[] { -1, 1 })
        {
            Box(cx + s * 0.52f, cy, b + 1.32f, 0.3f, 0.2f, 0.16f, M);    // upper arm, out to the side
            Box(cx + s * 0.62f, cy, b + 1.46f, 0.16f, 0.18f, 0.34f, M);  // forearm, up
            Box(cx + s * 0.62f, cy, b + 1.8f, 0.18f, 0.2f, 0.14f, L1);   // fist
        }
        Box(cx, cy, b + 1.5f, 0.14f, 0.14f, 0.08f, D);                  // neck
        Box(cx, cy, b + 1.58f, 0.28f, 0.28f, 0.3f, L1);                 // head
    }

    /** The Mongol script academy: stone plinth, cream walls between red pillars, a red door with gold studs, a green
     *  roof with upturned corners and a gold finial, and the dark blue board with its vertical script. */
    static void Academy(WObj o)
    {
        Color G = Px.Col("#2f7d5b"), GD = Px.Col("#1d5a40"), red = Px.Col("#c2302a"), redD = Px.Col(Px.K.redD), gold = Px.Col(Px.K.gold), goldD = Px.Col(Px.K.goldD);
        float cx = o.x + o.w / 2f, cy = o.y + 1.6f, w = o.w - 0.4f, d = 2.0f;
        Box(cx, cy, 0, w + 0.3f, d + 0.3f, 0.22f, Px.Col(Px.K.stone));
        Box(cx, cy + d / 2 + 0.35f, 0, 1.0f, 0.4f, 0.11f, Px.Col(Px.K.stoneD)); // the step
        Box(cx, cy, 0.22f, w, d, 1.35f, Px.Col("#f2e8d2"));
        Box(cx, cy, 0.22f, w + 0.02f, d + 0.02f, 0.25f, Px.Col("#c9b48c"));   // the wall's footing
        foreach (float px in new[] { -0.5f, -0.22f, 0.22f, 0.5f }) Box(cx + px * w, cy + d / 2 + 0.06f, 0.22f, 0.16f, 0.14f, 1.35f, red); // pillars
        foreach (float wx in new[] { -0.36f, 0.36f })
        {
            Box(cx + wx * w, cy + d / 2 + 0.01f, 0.65f, 0.48f, 0.04f, 0.56f, Px.Col("#7a4a2a")); // lattice windows
            for (int i = 0; i < 3; i++) Box(cx + wx * w, cy + d / 2 + 0.03f, 0.75f + i * 0.16f, 0.48f, 0.02f, 0.03f, goldD);
        }
        Box(cx, cy + d / 2 + 0.01f, 0.22f, 0.75f, 0.05f, 1.0f, Px.Col(Px.K.outl));
        Box(cx, cy + d / 2 + 0.04f, 0.22f, 0.65f, 0.04f, 0.94f, red);                       // the door
        for (int i = 0; i < 3; i++) foreach (float sx in new[] { -0.18f, 0.18f }) Box(cx + sx, cy + d / 2 + 0.07f, 0.45f + i * 0.25f, 0.06f, 0.02f, 0.06f, gold); // its studs
        Box(cx, cy, 1.57f, w + 0.35f, d + 0.35f, 0.14f, GD);                                 // the painted beam under the eaves
        Roof(cx, cy, w + 0.9f, d + 0.8f, 1.71f, 2.6f, G);
        foreach (int sx in new[] { -1, 1 }) foreach (int sy in new[] { -1, 1 }) Box(cx + sx * (w + 0.8f) / 2, cy + sy * (d + 0.7f) / 2, 1.71f, 0.16f, 0.16f, 0.2f, gold); // the upturned corners
        Box(cx, cy, 2.6f, w + 0.9f - d - 0.8f + 0.1f, 0.14f, 0.08f, gold);                  // the ridge
        Box(cx, cy, 2.68f, 0.12f, 0.12f, 0.36f, gold); Box(cx, cy, 3.04f, 0.22f, 0.22f, 0.12f, gold); // the finial
        Box(cx, cy + d / 2 + 0.1f, 1.2f, 1.2f, 0.04f, 0.55f, Px.Col("#24307a"));             // the signboard
        for (int k = 0; k < 4; k++) Box(cx - 0.33f + k * 0.22f, cy + d / 2 + 0.13f, 1.27f, 0.05f, 0.02f, 0.4f, gold); // vertical script
    }

    /** Уяа: the hitching line, two posts and a rope hung with blue, red, gold and white ribbons (its horses stand by it). */
    static void Uya(WObj o)
    {
        Color post = Px.Col(Px.K.wood), rope = Px.Col(Px.K.woodD);
        float y = o.y + 0.9f, xa = o.x + 3.5f / 16, xb = o.x + o.w - 3.5f / 16;
        Box(xa, y, 0, 0.12f, 0.12f, 1.25f, post); Box(xb, y, 0, 0.12f, 0.12f, 1.25f, post);
        Box((xa + xb) / 2, y, 1.12f, xb - xa, 0.05f, 0.05f, rope);
        string[] cols = { Px.K.blue, Px.K.red, Px.K.gold, Px.K.white };
        for (int i = 0; i < 4; i++) Box(Mathf.Lerp(xa, xb, (i + 0.5f) / 4), y, 0.86f, 0.1f, 0.03f, 0.26f, Px.Col(cols[i]));
    }


    /** A tree: a pine as stacked cones, a leafy one as a round crown with clumps of leaves, on a wooden trunk. */
    static void Tree(int tx, int ty, bool pine)
    {
        float cx = tx + 0.5f, cy = ty + 0.72f;
        Box(cx, cy, 0, 0.2f, 0.2f, 1.0f, Px.Col(Px.K.woodD));
        if (pine)
        {
            for (int t = 0; t < 4; t++) { float z = 0.5f + t * 0.42f, r = 0.9f - t * 0.17f; Ring(cx, cy, z, r, z + 0.72f, 0.04f, Px.Col(t == 3 ? Px.K.pineL : t % 2 == 0 ? Px.K.pine : Px.K.pineD), 12); }
            return;
        }
        Color leaf = Px.Col(Px.K.leaf), leafD = Px.Col(Px.K.leafD), leafL = Px.Col(Px.K.leafL);
        Ring(cx, cy, 0.85f, 0.4f, 1.15f, 0.82f, leafD, 12);
        Ring(cx, cy, 1.15f, 0.82f, 1.65f, 0.86f, leaf, 12);
        Ring(cx, cy, 1.65f, 0.86f, 2.0f, 0.58f, leaf, 12);
        Ring(cx, cy, 2.0f, 0.58f, 2.18f, 0.0f, leafL, 12);
        for (int i = 0; i < 9; i++)
        {
            float a = (float)Px.Hash(tx * 3 + i, ty) * Mathf.PI * 2, z = 1.1f + (float)Px.Hash(ty * 5 + i, tx) * 0.9f;
            Box(cx + Mathf.Cos(a) * 0.8f, cy + Mathf.Sin(a) * 0.8f, z, 0.26f, 0.26f, 0.22f, i % 3 != 0 ? leafD : leafL);
        }
    }

    /** The quest board: two posts holding a plank with three notes pinned to it. */
    static void Board(WObj o)
    {
        Color dark = Px.Col(Px.K.woodD);
        float cx = o.x + 1, cy = o.y + 0.8f;
        Box(cx - 0.72f, cy, 0, 0.12f, 0.12f, 1.75f, dark); Box(cx + 0.72f, cy, 0, 0.12f, 0.12f, 1.75f, dark);
        Box(cx, cy, 0.95f, 1.9f, 0.1f, 0.8f, Px.Col(Px.K.outl));
        Box(cx, cy + 0.02f, 0.99f, 1.8f, 0.09f, 0.72f, Px.Col(Px.K.wood));
        Box(cx, cy, 1.75f, 2.0f, 0.18f, 0.08f, dark); // its little roof
        foreach (var (dx, pin) in new[] { (-0.55f, Px.K.red), (0, Px.K.blue), (0.55f, Px.K.crop) })
        {
            Box(cx + dx, cy + 0.07f, 1.08f, 0.42f, 0.02f, 0.5f, Px.Col(Px.K.white));
            for (int l = 0; l < 3; l++) Box(cx + dx, cy + 0.085f, 1.18f + l * 0.1f, 0.3f, 0.01f, 0.025f, Px.Col(Px.K.feltD));
            Box(cx + dx, cy + 0.1f, 1.52f, 0.07f, 0.03f, 0.07f, Px.Col(pin));
        }
    }

    /** The well: a ring of stones round dark water, two posts and a little red roof over them. */
    static void Well(WObj o)
    {
        float cx = o.x + 0.5f, cy = o.y + 0.7f;
        Ring(cx, cy, 0, 0.5f, 0.42f, 0.48f, Px.Col(Px.K.rock));
        Ring(cx, cy, 0.42f, 0.48f, 0.46f, 0.36f, Px.Col(Px.K.rockL));
        Disc(cx, cy, 0.34f, 0.36f, Px.Col(Px.K.waterD));
        Color dark = Px.Col(Px.K.woodD);
        Box(cx - 0.44f, cy, 0, 0.1f, 0.1f, 1.45f, dark); Box(cx + 0.44f, cy, 0, 0.1f, 0.1f, 1.45f, dark);
        Box(cx, cy, 1.15f, 0.9f, 0.06f, 0.06f, dark);                            // the crossbar
        Box(cx, cy, 0.62f, 0.02f, 0.02f, 0.53f, Px.Col("#8a7a64"));              // the rope
        Box(cx, cy, 0.5f, 0.16f, 0.16f, 0.14f, Px.Col(Px.K.wood));               // and its bucket
        Roof(cx, cy, 1.2f, 0.75f, 1.45f, 1.85f, Px.Col(Px.K.red));
    }

    /** A street lantern: a dark pole with a glowing gold lamp. */
    static void Lantern(WObj o)
    {
        float cx = o.x + 0.5f, cy = o.y + 0.85f;
        Color outl = Px.Col(Px.K.outl);
        Box(cx, cy, 0, 0.1f, 0.1f, 1.6f, outl);
        Box(cx, cy, 1.6f, 0.34f, 0.34f, 0.04f, outl);
        Box(cx, cy, 1.64f, 0.28f, 0.28f, 0.36f, (Color)Px.Col(Px.K.gold) * 1.2f);
        Box(cx, cy, 2.0f, 0.4f, 0.4f, 0.05f, outl); Box(cx, cy, 2.05f, 0.2f, 0.2f, 0.08f, outl);
    }

    /** хөхүүр: the leather airag bag on its wooden stand, with the churning stick standing out of it. */
    static void Churn(WObj o)
    {
        float cx = o.x + 0.5f, cy = o.y + 0.75f;
        Box(cx, cy, 0, 0.7f, 0.5f, 0.16f, Px.Col(Px.K.wood));
        Color bag = Px.Col("#6b4220");
        Ring(cx, cy, 0.16f, 0.3f, 0.45f, 0.36f, bag, 12); Ring(cx, cy, 0.45f, 0.36f, 0.75f, 0.3f, Px.Col("#8a5a33"), 12); Ring(cx, cy, 0.75f, 0.3f, 0.86f, 0.1f, bag, 12);
        Box(cx + 0.05f, cy, 0.8f, 0.06f, 0.06f, 0.75f, Px.Col(Px.K.woodL));
        Box(cx + 0.05f, cy, 1.5f, 0.3f, 0.08f, 0.06f, Px.Col(Px.K.woodD));
    }

    /** тулга: the iron stove on three legs over a fire, with a big pot of milk. */
    static void Tulga(WObj o)
    {
        float cx = o.x + 0.5f, cy = o.y + 0.7f;
        Color iron = Px.Col(Px.K.outl);
        foreach (float a in new[] { 0.5f, 2.6f, 4.7f }) Strip(W(cx + Mathf.Cos(a) * 0.42f, cy + Mathf.Sin(a) * 0.42f, 0), W(cx + Mathf.Cos(a) * 0.28f, cy + Mathf.Sin(a) * 0.28f, 0.6f), 0.05f, iron);
        Box(cx, cy, 0, 0.32f, 0.28f, 0.16f, (Color)Px.Col("#f39b2c") * 1.25f); Box(cx, cy, 0.16f, 0.16f, 0.14f, 0.12f, (Color)Px.Col("#f7c646") * 1.25f); // the fire
        Ring(cx, cy, 0.55f, 0.32f, 0.8f, 0.42f, Px.Col("#77778a"), 12);
        Disc(cx, cy, 0.78f, 0.38f, Px.Col("#f6f2e9"));                                       // the milk
    }

    /** тавиур: the wooden drying rack with pieces of aaruul drying in the sun. */
    static void Rack(WObj o)
    {
        float x0 = o.x + 0.15f, x1 = o.x + o.w - 0.15f, cy = o.y + 0.75f;
        Color wood = Px.Col(Px.K.wood);
        Box(x0, cy, 0, 0.1f, 0.1f, 1.05f, wood); Box(x1, cy, 0, 0.1f, 0.1f, 1.05f, wood);
        Box((x0 + x1) / 2, cy, 0.95f, x1 - x0 + 0.1f, 0.5f, 0.06f, Px.Col("#c99257"));
        for (int i = 0; i < 9; i++) for (int j = 0; j < 2; j++) Box(x0 + 0.15f + i * (x1 - x0 - 0.3f) / 8, cy - 0.12f + j * 0.24f, 1.01f, 0.1f, 0.08f, 0.05f, Px.Col("#fff6dc"));
    }

    /** Felt making: the hide mat with wool laid out on it, a rolled felt and its wet bucket, and a finished felt hung on a frame. */
    static void Felt(WObj o)
    {
        Color wood = Px.Col(Px.K.wood), dark = Px.Col(Px.K.woodD), felt = Px.Col("#f1ece0");
        float cx = o.x + 1, cy = o.y + 0.62f;
        Box(cx - 0.1f, cy, 0, 1.5f, 0.7f, 0.04f, Px.Col("#a46d3b"));
        Box(cx - 0.1f, cy, 0.04f, 1.3f, 0.56f, 0.02f, Px.Col("#b98250"));
        foreach (float wx in new[] { -0.55f, -0.2f, 0.15f }) Box(cx + wx, cy - 0.05f, 0.06f, 0.24f, 0.18f, 0.07f, Px.Col("#f6f2e9")); // wool laid out
        Box(cx - 0.15f, cy + 0.42f, 0, 1.1f, 0.24f, 0.24f, Px.Col("#d8c8a8"));                                   // the rolled felt
        foreach (int s in new[] { -1, 1 }) Box(cx - 0.15f + s * 0.56f, cy + 0.42f, 0.02f, 0.03f, 0.2f, 0.2f, Px.Col("#c2b296")); // its ends
        Ring(cx + 0.82f, cy + 0.1f, 0, 0.15f, 0.3f, 0.17f, wood, 12); Disc(cx + 0.82f, cy + 0.1f, 0.27f, 0.15f, Px.Col("#4aa6e2")); // the bucket
        // the drying frame behind, with a finished felt hanging on it
        float fy = o.y + 0.12f;
        Box(o.x + 0.12f, fy, 0, 0.09f, 0.09f, 1.45f, dark); Box(o.x + o.w - 0.12f, fy, 0, 0.09f, 0.09f, 1.45f, dark);
        Box(cx, fy, 1.38f, o.w - 0.1f, 0.07f, 0.07f, wood);
        Box(cx, fy + 0.03f, 0.55f, o.w - 0.5f, 0.03f, 0.82f, felt);
        Box(cx, fy + 0.05f, 0.68f, o.w - 0.6f, 0.01f, 0.06f, Px.Col(Px.K.red));   // the felt's pattern
        Box(cx, fy + 0.05f, 1.2f, o.w - 0.6f, 0.01f, 0.06f, Px.Col(Px.K.red));
    }

    static Vector3 W(float x, float y, float z) => new Vector3(x, -y, -z);
    /** A thin strip of boxes from a to b (world points): a scarf or a rope running at a slant. */
    static void Strip(Vector3 a, Vector3 b, float t, Color c)
    {
        int n = Mathf.Max(2, Mathf.CeilToInt(Vector3.Distance(a, b) / 0.08f));
        for (int i = 0; i < n; i++) { var p = Vector3.Lerp(a, b, (i + 0.5f) / n); Box(p.x, -p.y, -p.z - t / 2, t * 1.6f, t * 1.6f, t, c); }
    }
    /** A ridged roof over a w × d box whose eaves are at height z0 and ridge (along x) at z1. */
    static void Roof(float cx, float cy, float w, float d, float z0, float z1, Color c)
    {
        float x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, r0 = cx - w / 2 + d / 2, r1 = cx + w / 2 - d / 2;
        Vector3 a = W(x0, y0, z0), b = W(x1, y0, z0), e = W(x1, y1, z0), f = W(x0, y1, z0), ra = W(r0, cy, z1), rb = W(r1, cy, z1);
        Face(f, e, rb, ra, c); Face(a, b, rb, ra, c);   // the long sides
        Face(a, f, ra, ra, c); Face(b, e, rb, rb, c);   // the hipped ends
    }
    static void Face(Vector3 a, Vector3 b, Vector3 c2, Vector3 d, Color c)
    {
        var n = Vector3.Cross(b - a, (c2 == a ? d : c2) - a); if (n.z > 0) n = -n; // the side facing up (world -z)
        Quad(a, b, c2, d, Lit(c, n));
    }

    // round things, shaded face by face by which way they turn to the light
    static readonly Vector3 L = new Vector3(0.15f, -0.45f, -0.88f).normalized;
    static Color Lit(Color c, Vector3 n) => c * (0.55f + 0.5f * Mathf.Max(0, Vector3.Dot(n.normalized, L)));
    const int SEGS = 24;
    /** A band round (cx, cy) from radius r0 at height z0 to radius r1 at z1: a wall when r0 = r1, a roof when r1 < r0. */
    static void Ring(float cx, float cy, float z0, float r0, float z1, float r1, Color c, int segs = SEGS)
    {
        Vector3 P(float a, float r, float z) => new Vector3(cx + Mathf.Cos(a) * r, -(cy + Mathf.Sin(a) * r), -z);
        float slope = (r0 - r1) / Mathf.Max(0.001f, z1 - z0);
        for (int i = 0; i < segs; i++)
        {
            float a0 = i * Mathf.PI * 2 / segs, a1 = (i + 1) * Mathf.PI * 2 / segs, am = (a0 + a1) / 2;
            var n = new Vector3(Mathf.Cos(am), -Mathf.Sin(am), -slope); // outwards (and up for a roof); world -z is up
            Quad(P(a0, r0, z0), P(a1, r0, z0), P(a1, r1, z1), P(a0, r1, z1), Lit(c, n));
        }
    }
    /** A flat round lid at height z. */
    static void Disc(float cx, float cy, float z, float r, Color c)
    {
        var mid = new Vector3(cx, -cy, -z); Color k = Lit(c, new Vector3(0, 0, -1));
        for (int i = 0; i < SEGS; i++)
        {
            float a0 = i * Mathf.PI * 2 / SEGS, a1 = (i + 1) * Mathf.PI * 2 / SEGS;
            Quad(mid, new Vector3(cx + Mathf.Cos(a0) * r, -(cy + Mathf.Sin(a0) * r), -z), new Vector3(cx + Mathf.Cos(a1) * r, -(cy + Mathf.Sin(a1) * r), -z), mid, k);
        }
    }

    /** A box standing on (x, y) at height z: w wide along x, d deep along y, h tall. */
    static void Box(float x, float y, float z, float w, float d, float h, Color c)
    {
        float x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2, z1 = z + h;
        Vector3 P(float px, float py, float pz) => new Vector3(px, -py, -pz);
        // lit from above and from the screen's upper left: the top brightest, the faces towards -x and -y next
        Quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), c * 1.08f);  // top
        Quad(P(x0, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x0, y1, z1), c * 0.62f);    // +y (towards the screen's lower left)
        Quad(P(x1, y0, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y0, z1), c * 0.80f);    // +x (towards the screen's lower right)
        Quad(P(x0, y0, z), P(x0, y1, z), P(x0, y1, z1), P(x0, y0, z1), c * 0.9f);     // -x
        Quad(P(x0, y0, z), P(x1, y0, z), P(x1, y0, z1), P(x0, y0, z1), c * 0.9f);     // -y
    }

    static void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color col)
    {
        if (cap != null) { cap.Add((a, b, c, d, col)); return; } // being painted as a picture (Pictures)
        int i = vs.Count; col.a = 1;
        vs.Add(a); vs.Add(b); vs.Add(c); vs.Add(d);
        Color32 k = col; cs.Add(k); cs.Add(k); cs.Add(k); cs.Add(k);
        ts.Add(i); ts.Add(i + 1); ts.Add(i + 2); ts.Add(i); ts.Add(i + 2); ts.Add(i + 3); // drawn from both sides (Cull Off)
    }
    // ---------------------------------------------------------------- isometric pixel pictures
    /** Buildings drawn as isometric pixel art instead of standing in 3D: the same shapes, seen from the camera's angle,
     *  painted into a 16-pixels-per-tile picture with a dark outline and darker lines where one face meets another. */
    public static readonly HashSet<string> PICTURED = new HashSet<string> { "ger", "shop", "well", "academy", "bleachers", "ovoo", "statue", "board", "uya", "churn", "tulga", "rack", "lantern", "felt" };
    // (the archery range stays in 3D: it's spread over a field people walk across, which one standing picture can't sort with)
    static List<(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color col)> cap;

    /** Each pictured building: its picture, and the world point (the middle of its ground) where it stands, facing the camera. */
    public static List<(PxCanvas art, float pivotX, float pivotY, float[] depth, Vector3 at)> Pictures()
    {
        var list = new List<(PxCanvas, float, float, float[], Vector3)>();
        foreach (var o in World.objects)
        {
            if (!PICTURED.Contains(o.kind)) continue;
            cap = new List<(Vector3, Vector3, Vector3, Vector3, Color)>();
            Thing(o);
            var at = new Vector3(o.x + o.w / 2f, -(o.y + o.h / 2f), 0);
            var (art, px, py, depth) = Paint(cap, at);
            cap = null;
            list.Add((art, px, py, depth, at));
        }
        return list;
    }

    /** Paints quads (world points) as seen by the isometric camera, at 16 pixels a tile; pivot: where the point at lands in the picture. */
    public static (PxCanvas art, float pivotX, float pivotY, float[] depth) Paint(List<(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color col)> quads, Vector3 at, float ppt = 16)
    {
        var rot = Iso.Standing; Vector3 R = rot * Vector3.right, U = rot * Vector3.up, F = rot * Vector3.forward; // F: depth, away from the camera
        Vector2 P(Vector3 v) => new Vector2(Vector3.Dot(v - at, R) * ppt, Vector3.Dot(v - at, U) * ppt);
        float x0 = float.MaxValue, y0 = float.MaxValue, x1 = float.MinValue, y1 = float.MinValue;
        foreach (var q in quads) foreach (var v in new[] { q.a, q.b, q.c, q.d }) { var p = P(v); x0 = Mathf.Min(x0, p.x); x1 = Mathf.Max(x1, p.x); y0 = Mathf.Min(y0, p.y); y1 = Mathf.Max(y1, p.y); }
        int M = 2, W = Mathf.CeilToInt(x1 - x0) + M * 2 + 1, H = Mathf.CeilToInt(y1 - y0) + M * 2 + 1;
        float ox = -Mathf.Floor(x0) + M, oy = Mathf.Ceil(y1) + M; // picture x = p.x + ox, picture y (down) = oy - p.y
        var art = new PxCanvas(W, H); var face = new int[W * H];
        for (int i = 0; i < face.Length; i++) face[i] = -1;
        // each pixel keeps the nearest face over it (a depth buffer: sorting whole faces gets big ones wrong, a wall's top
        // showing through the roof above it)
        var zbuf = new float[W * H]; for (int i = 0; i < zbuf.Length; i++) zbuf[i] = float.MaxValue;
        var pts = new List<Vector2>(4); var tmp = new PxCanvas(W, H);
        for (int i = 0; i < quads.Count; i++)
        {
            var q = quads[i]; pts.Clear(); var vs3 = new[] { q.a, q.b, q.c, q.d };
            var sp = new Vector3[4];
            for (int j = 0; j < 4; j++) { var p = P(vs3[j]); sp[j] = new Vector3(p.x + ox, oy - p.y, Vector3.Dot(vs3[j], F)); pts.Add(sp[j]); }
            // the face's depth over the picture: the plane through three of its corners (the fourth if two of them meet)
            Vector3 a0 = sp[0], a1 = sp[1], a2 = sp[2];
            var nrm = Vector3.Cross(a1 - a0, a2 - a0);
            if (Mathf.Abs(nrm.z) < 1e-4f) { a1 = sp[2]; a2 = sp[3]; nrm = Vector3.Cross(a1 - a0, a2 - a0); }
            if (Mathf.Abs(nrm.z) < 1e-4f) continue; // seen edge-on
            Color c = q.col; c.a = 1; Color32 k = c;
            tmp.Fill(default); tmp.FillPoly(pts, k);
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                if (tmp.Get(x, y).a == 0) continue;
                float d = a0.z - (nrm.x * (x + 0.5f - a0.x) + nrm.y * (y + 0.5f - a0.y)) / nrm.z;
                if (d >= zbuf[y * W + x] - 1e-4f) continue;
                zbuf[y * W + x] = d; art.Put(x, y, k); face[y * W + x] = i;
            }
        }
        // darker lines where two faces of different shades meet (towards the lower right, like light from the upper left)
        var lines = new List<(int x, int y)>();
        for (int y = 0; y < H - 1; y++) for (int x = 0; x < W - 1; x++)
        {
            int f0 = face[y * W + x]; if (f0 < 0) continue;
            foreach (var (nx, ny) in new[] { (x + 1, y), (x, y + 1) })
            {
                int f1 = face[ny * W + nx]; if (f1 < 0 || f1 == f0) continue;
                Color a = art.Get(x, y), b = art.Get(nx, ny);
                if (Mathf.Abs(a.r + a.g + a.b - b.r - b.g - b.b) > 0.28f) lines.Add((nx, ny));
            }
        }
        foreach (var (x, y) in lines) { Color c = art.Get(x, y); c *= 0.72f; c.a = 1; art.Put(x, y, c); }
        // the outline all round
        var outl = Px.Col(Px.K.outl); var edge = new List<(int, int)>();
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
        {
            if (face[y * W + x] >= 0) continue;
            bool n = (x > 0 && face[y * W + x - 1] >= 0) || (x < W - 1 && face[y * W + x + 1] >= 0) || (y > 0 && face[(y - 1) * W + x] >= 0) || (y < H - 1 && face[(y + 1) * W + x] >= 0);
            if (n) edge.Add((x, y));
        }
        foreach (var (x, y) in edge)
        {
            art.Put(x, y, outl);
            float near = float.MaxValue; // the outline sits at the depth of what it outlines
            foreach (var (nx, ny) in new[] { (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1) }) if (nx >= 0 && ny >= 0 && nx < W && ny < H && face[ny * W + nx] >= 0) near = Mathf.Min(near, zbuf[ny * W + nx]);
            zbuf[y * W + x] = near;
        }
        // each pixel's depth as how much farther it is than the picture's plane (through at), for Shaders/NaadamyPicture
        float plane = Vector3.Dot(at, F);
        for (int i = 0; i < zbuf.Length; i++) if (zbuf[i] != float.MaxValue) zbuf[i] -= plane;
        return (art, ox, oy, zbuf);
    }
}
