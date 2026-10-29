// The ger you build by hand on your plot, as isometric pixel art (GerBuild.cs): one piece per building step, painted like the
// village's other buildings (Bodies.Paint) so the ger grows on its plot: floor, wall lattice, door, toono on its posts, roof poles,
// felt, white cover, ropes, stove pipe with smoke.
using System.Collections.Generic;
using UnityEngine;

public static partial class Bodies
{
    static readonly Dictionary<string, (PxCanvas art, float px, float py, float[] depth, Vector3 at)> gerPics = new Dictionary<string, (PxCanvas, float, float, float[], Vector3)>();
    public const int GER_POLES = 9;

    /** The picture of building steps s0..s1-1 of the ger on lot o (steps = indices into GerRules.STEPS). Step 4 draws the roof poles in the
     *  given slots (0..8 round the crown), or all nine when slots is null. Once felt is on (s1 > 5) the lattice and poles under it are left out. */
    public static (PxCanvas art, float px, float py, float[] depth, Vector3 at) GerPicture(WObj o, int s0, int s1, List<int> slots, string roof, string door)
    {
        string key = o.i + "|" + s0 + "|" + s1 + "|" + (slots == null ? "all" : string.Join(",", slots)) + "|" + roof + "|" + door;
        if (gerPics.TryGetValue(key, out var c)) return c;
        cap = new List<(Vector3, Vector3, Vector3, Vector3, Color)>();
        for (int s = s0; s < s1; s++) GerPiece(o, s, s1 > 5, slots, Px.Col(roof), Px.Col(door));
        var at = new Vector3(o.x + o.w / 2f, -(o.y + o.h / 2f), 0);
        var (art, px, py, depth) = Paint(cap, at); cap = null;
        return gerPics[key] = (art, px, py, depth, at);
    }
    /** The empty lots' "for sale" signs, each its own object (by lot number) so a plot with a ger on it can drop its sign. */
    public static readonly Dictionary<int, GameObject> signs = new Dictionary<int, GameObject>();
    static void LotSigns(GameObject parent)
    {
        signs.Clear(); var mat = parent.GetComponent<MeshRenderer>().sharedMaterial;
        foreach (var o in World.objects)
        {
            if (o.kind != "lot") continue;
            vs.Clear(); cs.Clear(); ts.Clear();
            Color stake = Px.Col(Px.K.woodD), paper = Px.Col(Px.K.paper), gold = Px.Col(Px.K.gold);
            float sx = o.x + 22 / 16f, sy = o.y + 34 / 16f;
            Box(sx, sy, 0, 0.12f, 0.12f, 0.8f, stake);
            Box(sx, sy + 0.04f, 0.42f, 1.0f, 0.06f, 0.48f, Px.Col(Px.K.outl));
            Box(sx, sy + 0.08f, 0.46f, 0.9f, 0.04f, 0.4f, paper);
            Box(sx, sy + 0.11f, 0.56f, 0.22f, 0.03f, 0.2f, gold); // the coin on it
            var mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(vs); mesh.SetColors(cs); mesh.SetTriangles(ts, 0); mesh.RecalculateBounds();
            var go = new GameObject("Lot sign " + o.i); go.transform.SetParent(parent.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh; go.AddComponent<MeshRenderer>().sharedMaterial = mat;
            signs[o.i] = go;
        }
    }
    public static Vector3 GerAt(WObj o) => new Vector3(o.x + o.w / 2f, -(o.y + o.h / 2f), 0);

    static void GerPiece(WObj o, int step, bool covered, List<int> slots, Color roof, Color door)
    {
        float cx = o.x + o.w / 2f, cy = o.y + o.h / 2f, R = 1.26f, WALL = 1.5f, CROWN = 2.4f;
        Color wood = Px.Col("#c9a26b"), woodD = Px.Col("#8a5a33"), org = Px.Col("#d9762b"), orgD = Px.Col("#9a4a1a"), white = Px.Col("#f6f2e9");
        Vector3 P(float a, float r, float z) => new Vector3(cx + Mathf.Cos(a) * r, -(cy + Mathf.Sin(a) * r), -z);
        switch (step)
        {
            case 0: // шал: round floor boards
                Ring(cx, cy, 0, 1.36f, 0.1f, 1.36f, woodD); Disc(cx, cy, 0.1f, 1.36f, wood);
                for (int i = -4; i <= 4; i++) { float x = i * 0.3f, half = Mathf.Sqrt(1.36f * 1.36f - x * x) * 0.96f; Box(cx + x, cy, 0.1f, 0.03f, half * 2, 0.02f, woodD); }
                break;
            case 1: // хана: the folding lattice, in diamonds, with a gap for the door
                if (covered) break;
                const int N = 20; const int ROWS = 3;
                for (int i = 0; i < N; i++)
                {
                    float a0 = i * Mathf.PI * 2 / N, a1 = (i + 1) * Mathf.PI * 2 / N, am = (a0 + a1) / 2;
                    if (Mathf.Abs(Mathf.DeltaAngle(am * Mathf.Rad2Deg, 90)) < 17) continue;
                    var n = new Vector3(Mathf.Cos(am), -Mathf.Sin(am), 0);
                    for (int r = 0; r < ROWS; r++)
                    {
                        float z0 = 0.1f + r * (WALL - 0.1f) / ROWS, z1 = z0 + (WALL - 0.1f) / ROWS, t = 0.07f;
                        Quad(P(a0, R, z0), P(a1, R, z1), P(a1, R, z1 + t), P(a0, R, z0 + t), Lit(org, n));
                        Quad(P(a0, R, z1), P(a1, R, z0), P(a1, R, z0 + t), P(a0, R, z1 + t), Lit(orgD, n));
                    }
                }
                Ring(cx, cy, WALL - 0.06f, R + 0.02f, WALL + 0.02f, R + 0.02f, orgD); Ring(cx, cy, 0.1f, R + 0.02f, 0.18f, R + 0.02f, orgD);
                break;
            case 2: // хаалга: carved frame and painted leaf, facing south
                Box(cx, cy + R + 0.1f, 0.1f, 0.78f, 0.07f, 1.36f, Px.Col("#8a4f1c"));
                Box(cx, cy + R + 0.15f, 0.14f, 0.58f, 0.05f, 1.22f, door);
                Box(cx, cy + R + 0.19f, 0.6f, 0.12f, 0.02f, 0.12f, Px.Col(Px.K.gold));
                Box(cx, cy + R + 0.22f, 0, 0.9f, 0.2f, 0.08f, woodD);
                break;
            case 3: // тооно on its two posts
                if (!covered) foreach (float dx in new[] { -0.45f, 0.45f }) Box(cx + dx, cy, 0.1f, 0.12f, 0.12f, CROWN - 0.1f, org);
                Ring(cx, cy, CROWN - 0.1f, 0.34f, CROWN + 0.04f, 0.34f, org); Disc(cx, cy, CROWN + 0.04f, 0.34f, Px.Col("#8fd0ff"));
                Box(cx, cy, CROWN + 0.05f, 0.68f, 0.05f, 0.03f, orgD); Box(cx, cy, CROWN + 0.05f, 0.05f, 0.68f, 0.03f, orgD);
                break;
            case 4: // унь: poles from the crown to the wall top
                if (covered) break;
                for (int j = 0; j < GER_POLES; j++)
                {
                    if (slots != null && !slots.Contains(j)) continue;
                    float a = j * Mathf.PI * 2 / GER_POLES, w = 0.045f, da = w / 0.34f, db = w / R;
                    Quad(P(a - da, 0.34f, CROWN - 0.04f), P(a + da, 0.34f, CROWN - 0.04f), P(a + db, R + 0.04f, WALL), P(a - db, R + 0.04f, WALL), Lit(org, new Vector3(Mathf.Cos(a), -Mathf.Sin(a), -1.2f)));
                }
                break;
            case 5: // эсгий: brown felt over walls and roof
                Ring(cx, cy, 0.1f, 1.30f, WALL, 1.30f, Px.Col("#d8c8a8")); Ring(cx, cy, WALL, 1.34f, CROWN, 0.36f, Px.Col("#cdb98f"));
                break;
            case 6: // бүрээс: the white cover with its coloured band
                Ring(cx, cy, 0.1f, 1.34f, WALL + 0.05f, 1.34f, white); Ring(cx, cy, WALL + 0.05f, 1.38f, CROWN, 0.38f, white);
                Ring(cx, cy, WALL - 0.1f, 1.37f, WALL + 0.12f, 1.37f, roof);
                Ring(cx, cy, CROWN - 0.04f, 0.4f, CROWN + 0.08f, 0.38f, org);
                break;
            case 7: // бүслүүр: three hair ropes round it
                foreach (float h in new[] { 0.45f, 0.95f, 1.35f }) Ring(cx, cy, h, 1.36f, h + 0.05f, 1.36f, Px.Col("#9c896e"));
                break;
            case 8: // тулга: the stove's pipe with a curl of smoke
                Box(cx + 0.15f, cy - 0.1f, CROWN - 0.1f, 0.14f, 0.14f, 0.85f, Px.Col("#5d5d6b"));
                Box(cx + 0.2f, cy - 0.12f, CROWN + 0.8f, 0.2f, 0.2f, 0.2f, Px.Col("#e8e8ee"));
                Box(cx + 0.3f, cy - 0.14f, CROWN + 1.05f, 0.28f, 0.28f, 0.25f, Px.Col("#dcdce4"));
                Box(cx + 0.42f, cy - 0.16f, CROWN + 1.35f, 0.36f, 0.36f, 0.3f, Px.Col("#d0d0da"));
                break;
        }
    }
}
