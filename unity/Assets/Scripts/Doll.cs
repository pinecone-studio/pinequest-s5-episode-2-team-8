// People with a body in the isometric view (Iso.cs): each one built from boxes, like the village's things in Bodies.cs,
// in the colours of their Look (deel, skin, hat, neck). Legs and arms are separate pieces that swing as they walk,
// and the whole doll turns to face where it's going. A doll is 1.75 tiles tall, as tall as the 28-pixel sprite.
// Local space: x is the doll's left, -y its front (the grid's +y), -z up, so a doll turned by 0 faces the screen's lower left.
using System.Collections.Generic;
using UnityEngine;

public sealed class Doll
{
    public readonly GameObject root;
    readonly MeshFilter body; readonly Transform legL, legR, armL, armR;
    string key;
    static Material mat;
    static readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();

    public Doll()
    {
        if (mat == null) mat = new Material(Resources.Load<Shader>("Shaders/NaadamyVoxel") ?? Shader.Find("Naadamy/Voxel")) { mainTexture = Texture2D.whiteTexture };
        root = new GameObject("Doll");
        body = Part("Body", Vector3.zero, out _);
        legL = Part("Leg L", L(0.12f, 0, HIP), out _).transform; legR = Part("Leg R", L(-0.12f, 0, HIP), out _).transform;
        armL = Part("Arm L", L(0.33f, 0, SHOULDER), out _).transform; armR = Part("Arm R", L(-0.33f, 0, SHOULDER), out _).transform;
    }
    MeshFilter Part(string name, Vector3 at, out MeshRenderer r)
    {
        var go = new GameObject(name); go.transform.SetParent(root.transform, false); go.transform.localPosition = at;
        r = go.AddComponent<MeshRenderer>(); r.sharedMaterial = mat;
        return go.AddComponent<MeshFilter>();
    }

    const float HIP = 0.34f, SHOULDER = 0.98f;
    /** A point in the doll's own space: x to its left, f to its front, u up. */
    static Vector3 L(float x, float f, float u) => new Vector3(x, -f, -u);

    /** Stands the doll with its feet at tile (fx, fy), z tiles up, facing grid direction (hx, hy); swing is the walk's phase (radians) or null. */
    public void Pose(Look look, float fx, float fy, float z, float hx, float hy, float? swing)
    {
        string k = Key(look);
        if (k != key)
        {
            key = k;
            body.sharedMesh = Mesh(k + "|body", () => BodyBoxes(look));
            legL.GetComponent<MeshFilter>().sharedMesh = legR.GetComponent<MeshFilter>().sharedMesh = Mesh(k + "|leg", () => LegBoxes(look));
            armL.GetComponent<MeshFilter>().sharedMesh = armR.GetComponent<MeshFilter>().sharedMesh = Mesh(k + "|arm", () => ArmBoxes(look));
        }
        root.transform.position = new Vector3(fx, -fy, -z);
        float a = Mathf.Atan2(-hy, hx) - Mathf.Atan2(-1, 0); // turn the doll's front (world (0, -1)) towards (hx, -hy)
        root.transform.rotation = Quaternion.AngleAxis(a * Mathf.Rad2Deg, Vector3.forward);
        float s = swing.HasValue ? Mathf.Sin(swing.Value) : 0;
        legL.localRotation = Quaternion.AngleAxis(s * 32, Vector3.right); legR.localRotation = Quaternion.AngleAxis(-s * 32, Vector3.right);
        armL.localRotation = Quaternion.AngleAxis(-s * 28, Vector3.right); armR.localRotation = Quaternion.AngleAxis(s * 28, Vector3.right);
    }

    static string Key(Look l) => string.Join("|", l.deel, l.skin, l.hat, l.face, l.neck, l.gender);

    // ---------------------------------------------------------------- the pieces, in the doll's own space
    static string[] Deel(Look l) => Px.DEEL.TryGetValue(l.deel ?? "", out var d) ? d : Px.DEEL["blue"];
    static string Skin(Look l) => (Px.SKIN.TryGetValue(l.skin ?? "", out var s) ? s : Px.SKIN["#F6D3B3"])[0];

    static void BodyBoxes(Look l)
    {
        var dl = Deel(l); Color D = Px.Col(dl[0]), DD = Px.Col(dl[1]), DL = Px.Col(dl[2]), S = Px.Col(Skin(l)), hair = Px.Col(Px.K.hair);
        // the deel: a long robe, wider at the hem, with its gold sash and the diagonal front opening
        B(0, 0, 0.24f, 0.56f, 0.4f, 0.3f, DD);
        B(0, 0, 0.54f, 0.5f, 0.36f, 0.5f, D);
        B(0, 0, 0.66f, 0.52f, 0.38f, 0.08f, Px.Col(Px.K.gold));
        for (int i = 0; i < 4; i++) B(0.08f - i * 0.06f, 0.19f, 0.98f - i * 0.07f, 0.07f, 0.02f, 0.07f, DL);
        // neck things
        if (l.neck == "scarf") B(0, 0, 0.98f, 0.4f, 0.32f, 0.08f, Px.Col(Px.K.red));
        else if (l.neck == "khadag") { B(0, 0, 0.98f, 0.42f, 0.34f, 0.05f, Px.Col(Px.K.light)); B(0.12f, 0.19f, 0.62f, 0.06f, 0.02f, 0.36f, Px.Col(Px.K.light)); B(-0.12f, 0.19f, 0.62f, 0.06f, 0.02f, 0.36f, Px.Col(Px.K.light)); }
        else if (l.neck == "medal") { B(0, 0.19f, 0.8f, 0.1f, 0.03f, 0.1f, Px.Col(Px.K.gold)); B(0, 0.18f, 0.9f, 0.04f, 0.02f, 0.1f, Px.Col(Px.K.blue)); }
        // the head: big and round-ish, as in the pixel art, with hair, eyes and rosy cheeks
        B(0, 0, 1.04f, 0.5f, 0.46f, 0.48f, S);
        B(0, -0.03f, 1.38f, 0.54f, 0.5f, 0.16f, hair);               // hair on top
        B(0, -0.22f, 1.08f, 0.54f, 0.06f, 0.42f, hair);              // and at the back
        foreach (int s in new[] { -1, 1 })
        {
            B(s * 0.27f, -0.06f, 1.2f, 0.03f, 0.3f, 0.26f, hair);    // over the ears
            B(s * 0.11f, 0.235f, 1.2f, 0.07f, 0.02f, 0.09f, Px.Col(Px.K.eye));
            B(s * 0.18f, 0.235f, 1.12f, 0.07f, 0.01f, 0.04f, Px.Col(Px.K.blush));
        }
        if (l.Girl) foreach (int s in new[] { -1, 1 })                // a girl's two braids down her back, tied with red
        {
            B(s * 0.17f, -0.22f, 0.66f, 0.1f, 0.1f, 0.5f, hair);
            B(s * 0.17f, -0.22f, 0.6f, 0.11f, 0.11f, 0.06f, Px.Col(Px.K.red));
        }
        if (l.face == "glasses") { foreach (int s in new[] { -1, 1 }) B(s * 0.11f, 0.245f, 1.17f, 0.13f, 0.02f, 0.14f, Px.Col(Px.K.outl)); }
        else if (l.face == "sun") B(0, 0.245f, 1.18f, 0.4f, 0.02f, 0.1f, Px.Col("#2b2b3a"));
        Hat(l.hat);
    }

    static void Hat(string hat)
    {
        Color red = Px.Col(Px.K.red), redD = Px.Col(Px.K.redD), gold = Px.Col(Px.K.gold), fur = Px.Col(Px.K.fur), blue = Px.Col(Px.K.blue);
        switch (hat)
        {
            case "mongol": B(0, 0, 1.46f, 0.58f, 0.54f, 0.08f, redD); B(0, 0, 1.52f, 0.42f, 0.4f, 0.16f, red); B(0, 0, 1.68f, 0.08f, 0.08f, 0.08f, gold); B(0, -0.26f, 1.2f, 0.12f, 0.02f, 0.28f, redD); break;
            case "cap": B(0, 0, 1.44f, 0.54f, 0.5f, 0.14f, blue); B(0, 0.3f, 1.44f, 0.4f, 0.16f, 0.04f, Px.Col(Px.K.blueD)); break;
            case "flower": { string[] fc = { Px.K.pink, Px.K.gold, Px.K.white }; for (int i = 0; i < 6; i++) { float a = i * Mathf.PI / 3; B(Mathf.Cos(a) * 0.24f, Mathf.Sin(a) * 0.22f, 1.48f, 0.09f, 0.09f, 0.07f, Px.Col(fc[i % 3])); } break; }
            case "loovuuz": B(0, 0, 1.46f, 0.62f, 0.58f, 0.1f, fur); B(0, 0, 1.56f, 0.44f, 0.42f, 0.2f, Px.Col(Px.K.brown)); foreach (int s in new[] { -1, 1 }) B(s * 0.3f, 0, 1.0f, 0.06f, 0.3f, 0.46f, fur); B(0, 0, 1.76f, 0.07f, 0.07f, 0.06f, red); break;
            case "kazakh": B(0, 0, 1.44f, 0.56f, 0.52f, 0.08f, Px.Col("#c9c1ad")); B(0, 0, 1.52f, 0.46f, 0.44f, 0.2f, Px.Col(Px.K.white)); B(0.1f, -0.1f, 1.72f, 0.03f, 0.03f, 0.22f, Px.Col("#4a3426")); break;
            case "buriad": B(0, 0, 1.44f, 0.6f, 0.56f, 0.08f, fur); for (int r = 0; r < 4; r++) B(0, 0, 1.52f + r * 0.07f, 0.44f - r * 0.1f, 0.42f - r * 0.1f, 0.07f, blue); B(0, 0, 1.8f, 0.06f, 0.06f, 0.08f, red); break;
            case "oirat": B(0, 0, 1.44f, 0.58f, 0.54f, 0.07f, gold); B(0, 0, 1.51f, 0.4f, 0.38f, 0.24f, Px.Col(Px.K.blueD)); B(0, 0, 1.75f, 0.08f, 0.08f, 0.12f, red); break;
            case "fur": B(0, 0, 1.44f, 0.6f, 0.56f, 0.22f, Px.Col("#7a5a3a")); foreach (int s in new[] { -1, 1 }) B(s * 0.3f, 0, 1.02f, 0.07f, 0.32f, 0.46f, Px.Col("#7a5a3a")); break;
            case "crown": B(0, 0, 1.46f, 0.46f, 0.42f, 0.12f, gold); foreach (var (x, y) in new[] { (-0.18f, 0.18f), (0.18f, 0.18f), (0, 0.18f), (-0.18f, -0.18f), (0.18f, -0.18f) }) B(x, y, 1.58f, 0.07f, 0.07f, 0.09f, gold); B(0, 0.21f, 1.5f, 0.07f, 0.02f, 0.06f, red); break;
        }
    }

    /** A leg hangs from the hip (the piece's origin): the trouser under the deel and the boot. */
    static void LegBoxes(Look l)
    {
        B(0, 0, -HIP + 0.12f, 0.15f, 0.17f, HIP - 0.12f, Px.Col(Deel(l)[1]));
        B(0, 0.02f, -HIP, 0.17f, 0.24f, 0.14f, Px.Col(Px.K.boot));
    }
    /** An arm hangs from the shoulder: the long sleeve and the hand. */
    static void ArmBoxes(Look l)
    {
        B(0, 0, -0.42f, 0.14f, 0.16f, 0.44f, Px.Col(Deel(l)[1]));
        B(0, 0, -0.52f, 0.11f, 0.12f, 0.1f, Px.Col(Skin(l)));
    }

    // ---------------------------------------------------------------- boxes to a mesh, lit from above and the front
    static readonly List<Vector3> vs = new List<Vector3>();
    static readonly List<Color32> cs = new List<Color32>();
    static readonly List<int> ts = new List<int>();
    static Mesh Mesh(string k, System.Action build)
    {
        if (meshes.TryGetValue(k, out var m)) return m;
        vs.Clear(); cs.Clear(); ts.Clear(); build();
        m = new Mesh(); m.SetVertices(vs); m.SetColors(cs); m.SetTriangles(ts, 0); m.RecalculateBounds();
        return meshes[k] = m;
    }
    /** A box centred on (x, f) of the doll's space, from height u up: w wide, d deep, h tall. */
    static void B(float x, float f, float u, float w, float d, float h, Color c)
    {
        float x0 = x - w / 2, x1 = x + w / 2, f0 = f - d / 2, f1 = f + d / 2, u1 = u + h;
        Q(L(x0, f0, u1), L(x1, f0, u1), L(x1, f1, u1), L(x0, f1, u1), c * 1.08f); // top
        Q(L(x0, f1, u), L(x1, f1, u), L(x1, f1, u1), L(x0, f1, u1), c * 0.92f);   // front
        Q(L(x0, f0, u), L(x1, f0, u), L(x1, f0, u1), L(x0, f0, u1), c * 0.66f);   // back
        Q(L(x0, f0, u), L(x0, f1, u), L(x0, f1, u1), L(x0, f0, u1), c * 0.8f);    // left
        Q(L(x1, f0, u), L(x1, f1, u), L(x1, f1, u1), L(x1, f0, u1), c * 0.74f);   // right
        Q(L(x0, f0, u), L(x1, f0, u), L(x1, f1, u), L(x0, f1, u), c * 0.5f);      // bottom (seen when a leg swings)
    }
    static void Q(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color col)
    {
        int i = vs.Count; col.a = 1; Color32 k = col;
        vs.Add(a); vs.Add(b); vs.Add(c); vs.Add(d); cs.Add(k); cs.Add(k); cs.Add(k); cs.Add(k);
        ts.Add(i); ts.Add(i + 1); ts.Add(i + 2); ts.Add(i); ts.Add(i + 2); ts.Add(i + 3);
    }
}
