// Animals with a body in the isometric view (Iso.cs), built from boxes like the people (Doll.cs): Basar, the pets, the
// dairy yard's animals, the sheep and the horses. Every kind is the same four-legged frame with its own sizes, colours
// and features (mane, horns, humps, wool...); birds have no legs. The legs swing in diagonal pairs as it walks.
// Local space as in Doll: x to its left, -y its front, -z up.
using System.Collections.Generic;
using UnityEngine;

public sealed class Critter
{
    sealed class Spec
    {
        public float len = 1, h = 0.45f, w = 0.4f, legH = 0.5f, leg = 0.12f, head = 0.3f, headLen = 0.4f, neck = 0.3f, tail = 0.3f;
        public string body = "#8a5a33", dark = "#6b4220", light = null, mane = null, horns = null;
        public bool saddle, humps, antlers, wool, beard, ears, patches, skirt, bird, curl, longNeck, cute, collar;
        public Spec Scaled(float k) { var s = (Spec)MemberwiseClone(); s.len *= k; s.h *= k; s.w *= k; s.legH *= k; s.leg *= k; s.head *= k; s.headLen *= k; s.neck *= k; s.tail *= k; return s; }
    }

    static Spec Horse(string coat, bool saddle)
    {
        var c = Px.COATS.TryGetValue(coat ?? "", out var cc) ? cc : coat == "dun" ? new[] { "#c99a5a", "#a07444", "#3a2516" } : Px.COATS["bay"];
        return new Spec { len = 1.25f, h = 0.48f, w = 0.4f, legH = 0.68f, leg = 0.12f, head = 0.26f, headLen = 0.5f, neck = 0.5f, tail = 0.5f, body = c[0], dark = c[1], mane = c[2], saddle = saddle };
    }
    static Spec Kind(string kind, string coat)
    {
        switch (kind)
        {
            case "horse": return Horse(coat ?? "bay", true);
            case "rider": return Horse(coat ?? "bay", true);
            case "uya": return Horse(coat ?? "bay", true);
            case "takhi": return Horse("dun", false);
            case "mare": return Horse("chestnut", false);
            case "foal": return Horse("chestnut", false).Scaled(0.62f);
            // Basar is drawn cute: a big round head with big eyes, tan "four-eye" brows and his tongue out, a short body on short legs
            // he matters (he is your guide): a handsome, fluffy Mongolian bankhar, a size bigger than a real dog, black and tan with a thick ruff,
            // the tan "four eyes", a fluffy tail curled over his back and a blue collar with a gold bell
            case "basar": return new Spec { len = 0.84f, h = 0.38f, w = 0.36f, legH = 0.36f, leg = 0.12f, head = 0.34f, headLen = 0.36f, neck = 0.2f, tail = 0.36f, body = "#2e272b", dark = "#c98a4b", light = "#c98a4b", curl = true, cute = true, collar = true }.Scaled(1.15f);
            case "puppy": { var p = Kind("basar", null).Scaled(0.48f); p.collar = false; return p; }
            case "kitten": return new Spec { len = 0.5f, h = 0.22f, w = 0.2f, legH = 0.2f, leg = 0.07f, head = 0.22f, headLen = 0.22f, neck = 0.06f, tail = 0.35f, body = "#f39b2c", dark = "#c46d12", light = "#fff2c8", ears = true };
            case "sheep": return new Spec { len = 0.78f, h = 0.44f, w = 0.5f, legH = 0.26f, leg = 0.08f, head = 0.24f, headLen = 0.3f, neck = 0.1f, tail = 0.1f, body = "#f1ece0", dark = "#3a3236", wool = true };
            case "shorn": return new Spec { len = 0.7f, h = 0.32f, w = 0.36f, legH = 0.26f, leg = 0.08f, head = 0.24f, headLen = 0.3f, neck = 0.1f, tail = 0.1f, body = "#e8d9c6", dark = "#3a3236" };
            case "lamb": return Kind("sheep", null).Scaled(0.65f);
            case "goat": return new Spec { len = 0.75f, h = 0.36f, w = 0.3f, legH = 0.38f, leg = 0.08f, head = 0.24f, headLen = 0.32f, neck = 0.22f, tail = 0.12f, body = "#f4efe3", dark = "#c9bda6", horns = "#8a7a64", beard = true };
            case "cow": return new Spec { len = 1.1f, h = 0.55f, w = 0.55f, legH = 0.45f, leg = 0.13f, head = 0.32f, headLen = 0.38f, neck = 0.15f, tail = 0.4f, body = "#f4efe3", dark = "#6b4220", light = "#f2a0a0", horns = "#e8e0c8", patches = true };
            case "camel": return new Spec { len = 1.15f, h = 0.5f, w = 0.42f, legH = 0.75f, leg = 0.12f, head = 0.24f, headLen = 0.42f, neck = 0.7f, tail = 0.25f, body = "#c99a5a", dark = "#a07444", humps = true, longNeck = true };
            case "botgo": return Kind("camel", null).Scaled(0.62f);
            case "yak": return new Spec { len = 1.05f, h = 0.55f, w = 0.55f, legH = 0.36f, leg = 0.14f, head = 0.32f, headLen = 0.36f, neck = 0.1f, tail = 0.35f, body = "#3a2c2c", dark = "#241a1a", horns = "#e8e0c8", skirt = true, humps = true };
            case "reindeer": return new Spec { len = 0.85f, h = 0.4f, w = 0.34f, legH = 0.52f, leg = 0.09f, head = 0.24f, headLen = 0.34f, neck = 0.32f, tail = 0.1f, body = "#6a5240", dark = "#5a4232", light = "#e8e0d0", antlers = true };
            case "gazelle": return new Spec { len = 0.7f, h = 0.3f, w = 0.26f, legH = 0.45f, leg = 0.06f, head = 0.2f, headLen = 0.28f, neck = 0.3f, tail = 0.1f, body = "#a07444", dark = "#8a5a33", light = "#f1e2c4", horns = "#3a2516" };
            case "bear": return new Spec { len = 1.0f, h = 0.6f, w = 0.6f, legH = 0.3f, leg = 0.18f, head = 0.38f, headLen = 0.36f, neck = 0.1f, tail = 0, body = "#8a6a4a", dark = "#6a4a30", light = "#c9a87e", ears = true };
            case "swan": return new Spec { len = 0.6f, h = 0.3f, w = 0.36f, legH = 0.05f, head = 0.14f, headLen = 0.2f, neck = 0.45f, tail = 0.1f, body = "#ffffff", dark = "#e0e0e6", light = "#f39b2c", bird = true, longNeck = true };
            case "gull": return new Spec { len = 0.42f, h = 0.2f, w = 0.24f, legH = 0.12f, head = 0.14f, headLen = 0.16f, neck = 0.06f, tail = 0.12f, body = "#f2f2f6", dark = "#77778a", light = "#f7c646", bird = true };
        }
        return null;
    }
    /** Whether this kind has a body (otherwise it stays a picture). */
    public static bool Has(string kind) => Kind(kind, null) != null;

    public readonly GameObject root;
    readonly Transform torso; readonly Transform[] legs = new Transform[4];
    string key;
    static Material mat;
    static readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();
    Spec spec;

    public Critter()
    {
        if (mat == null) mat = new Material(Resources.Load<Shader>("Shaders/NaadamyVoxel") ?? Shader.Find("Naadamy/Voxel")) { mainTexture = Texture2D.whiteTexture };
        root = new GameObject("Critter");
        torso = Part("Torso").transform;
        for (int i = 0; i < 4; i++) legs[i] = Part("Leg " + i).transform;
    }
    GameObject Part(string name)
    {
        var go = new GameObject(name); go.transform.SetParent(root.transform, false);
        go.AddComponent<MeshRenderer>().sharedMaterial = mat; go.AddComponent<MeshFilter>();
        return go;
    }

    static Vector3 L(float x, float f, float u) => new Vector3(x, -f, -u);

    /** Stands it with its feet at tile (fx, fy), z tiles up, facing grid direction (hx, hy). swing: the walk's phase or null; sit: Basar sitting down. */
    public void Pose(string kind, string coat, float fx, float fy, float z, float hx, float hy, float? swing, bool sit = false)
    {
        string k = kind + "|" + coat;
        if (k != key)
        {
            key = k; spec = Kind(kind, coat);
            torso.GetComponent<MeshFilter>().sharedMesh = Mesh(k + "|body", () => BodyBoxes(spec));
            var legMesh = spec.bird ? null : Mesh(k + "|leg", () => LegBoxes(spec));
            for (int i = 0; i < 4; i++)
            {
                legs[i].GetComponent<MeshFilter>().sharedMesh = legMesh;
                legs[i].localPosition = L((i % 2 == 0 ? 1 : -1) * spec.w * 0.32f, (i < 2 ? 1 : -1) * spec.len * 0.36f, spec.legH);
            }
        }
        root.transform.position = new Vector3(fx, -fy, -z);
        float a = Mathf.Atan2(-hy, hx) - Mathf.Atan2(-1, 0);
        root.transform.rotation = Quaternion.AngleAxis(a * Mathf.Rad2Deg, Vector3.forward);
        float s = swing.HasValue ? Mathf.Sin(swing.Value) : 0;
        for (int i = 0; i < 4; i++) legs[i].localRotation = Quaternion.AngleAxis(((i == 0 || i == 3) ? s : -s) * 30, Vector3.right);
        // sitting: the body tips back onto its haunches and the back legs fold forward
        torso.localPosition = sit ? L(0, spec.len * 0.3f, -spec.legH * 0.28f) : Vector3.zero; // tipped back, the chest stays over the front legs and the haunches reach the ground
        torso.localRotation = sit ? Quaternion.AngleAxis(28, Vector3.right) : Quaternion.identity; // (+: the front goes up)
        if (sit) { legs[2].localRotation = legs[3].localRotation = Quaternion.AngleAxis(80, Vector3.right); } // (+: folded forward under him)
    }

    // ---------------------------------------------------------------- isometric pixel pictures of an animal
    /** Basar is painted at twice the village's pixels a tile, finer than the rest: he is the one you look at most. */
    public const float PPT_BASAR = 32;
    static Critter painter;
    static readonly Dictionary<string, (PxCanvas, float, float, float[])> pics = new Dictionary<string, (PxCanvas, float, float, float[])>();
    /** A picture of kind standing facing one of 8 grid directions (dir8 · 45° from +x), in walk phase 0–3 (−1 standing) or sitting,
     *  painted like the buildings (Bodies.Paint); pivot is its feet. Made once and kept. */
    public static (PxCanvas art, float pivotX, float pivotY, float[] depth) Picture(string kind, int dir8, int phase, bool sit)
    {
        string k = kind + "|" + dir8 + "|" + phase + "|" + sit;
        if (pics.TryGetValue(k, out var hit)) return hit;
        if (painter == null) { painter = new Critter(); painter.root.SetActive(false); }
        float a = dir8 * Mathf.PI / 4;
        painter.Pose(kind, null, 0, 0, 0, Mathf.Cos(a), Mathf.Sin(a), phase < 0 ? (float?)null : phase * Mathf.PI / 2, sit);
        var quads = new List<(Vector3, Vector3, Vector3, Vector3, Color)>();
        foreach (var mf in painter.root.GetComponentsInChildren<MeshFilter>(true))
        {
            var m = mf.sharedMesh; if (m == null) continue;
            var v = m.vertices; var c = m.colors32; var M = mf.transform.localToWorldMatrix;
            for (int i = 0; i + 3 < v.Length; i += 4) quads.Add((M.MultiplyPoint3x4(v[i]), M.MultiplyPoint3x4(v[i + 1]), M.MultiplyPoint3x4(v[i + 2]), M.MultiplyPoint3x4(v[i + 3]), c[i]));
        }
        return pics[k] = Bodies.Paint(quads, Vector3.zero, kind == "basar" ? PPT_BASAR : 16);
    }

    // ---------------------------------------------------------------- the pieces, in its own space
    static void BodyBoxes(Spec s)
    {
        Color body = Px.Col(s.body), dark = Px.Col(s.dark), light = s.light != null ? Px.Col(s.light) : body, outl = Px.Col(Px.K.outl);
        float u0 = s.legH, top = s.legH + s.h, front = s.len / 2;
        if (s.bird) { u0 = s.legH; top = u0 + s.h; }
        // the body: a big box with a smaller one on top to round its back
        B(0, 0, u0, s.w, s.len, s.h * 0.8f, body);
        B(0, 0, u0 + s.h * 0.8f, s.w * 0.8f, s.len * 0.86f, s.h * 0.2f, body);
        if (s.light != null && !s.bird) B(0, 0, u0 - 0.01f, s.w * 0.7f, s.len * 0.7f, 0.04f, light); // belly
        if (s.wool) foreach (var (x, f) in new[] { (0.2f, 0.25f), (-0.2f, 0.05f), (0.18f, -0.2f), (-0.16f, 0.3f), (0, -0.3f) }) B(x * s.w * 1.4f, f * s.len, top - 0.04f, s.w * 0.36f, s.len * 0.3f, 0.08f, Px.Col("#fbf8f1"));
        if (s.patches) { B(s.w / 2 - 0.02f, 0.1f, u0 + 0.12f, 0.06f, 0.36f, 0.28f, dark); B(-s.w / 2 + 0.02f, -0.22f, u0 + 0.18f, 0.06f, 0.3f, 0.24f, dark); B(0.05f, -0.15f, top - 0.01f, 0.3f, 0.3f, 0.03f, dark); }
        if (s.skirt) B(0, 0, u0 - 0.18f, s.w + 0.04f, s.len * 0.92f, 0.22f, Px.Col(s.dark));
        if (s.humps) { B(0, s.len * 0.2f, top, s.w * 0.6f, s.len * 0.22f, s.h * 0.45f, body); if (!s.skirt) B(0, -s.len * 0.18f, top, s.w * 0.6f, s.len * 0.22f, s.h * 0.4f, body); }
        if (s.saddle) { B(0, 0.02f, top - 0.02f, s.w + 0.06f, 0.34f, 0.06f, Px.Col(Px.K.red)); B(0, 0.02f, top + 0.04f, s.w * 0.7f, 0.28f, 0.05f, Px.Col(Px.K.redD)); B(0, 0.02f, u0 + 0.05f, s.w + 0.08f, 0.04f, s.h * 0.8f, Px.Col(Px.K.woodD)); }
        // the neck and head, out in front
        float nu = top - s.h * 0.3f, hu = nu + s.neck, hf = front + s.headLen * 0.25f;
        if (s.longNeck) { B(0, front - 0.02f, nu, s.w * 0.36f, s.w * 0.36f, s.neck, body); hf = front + s.headLen * 0.3f; }
        else if (s.neck > 0.15f) { B(0, front - 0.05f, nu, s.w * 0.5f, s.headLen * 0.55f, s.neck + 0.05f, body); }
        else hu = top - s.head * 0.8f;
        B(0, hf, hu, s.head, s.headLen, s.head, body);
        if (!s.cute) B(0, hf + s.headLen * 0.5f, hu, s.head * 0.8f, 0.06f, s.head * 0.6f, s.bird ? light : light != body ? light : dark); // muzzle / beak
        if (s.cute)
        {
            foreach (int side in new[] { -1, 1 })
            {
                B(side * s.head * 0.24f, hf + s.headLen * 0.5f, hu + s.head * 0.56f, s.head * 0.16f, 0.02f, s.head * 0.14f, outl);              // eyes
                B(side * s.head * 0.22f, hf + s.headLen * 0.5f + 0.01f, hu + s.head * 0.64f, s.head * 0.05f, 0.01f, s.head * 0.05f, Px.Col("#ffffff")); // their shine
                B(side * s.head * 0.25f, hf + s.headLen * 0.5f, hu + s.head * 0.78f, s.head * 0.18f, 0.02f, s.head * 0.08f, Px.Col("#e2ab6c")); // the tan "second eyes"
                B(side * s.head * 0.52f, hf - s.headLen * 0.05f, hu + s.head * 0.3f, s.head * 0.12f, s.headLen * 0.38f, s.head * 0.6f, Px.Col("#3a3236")); // floppy ears
                B(side * s.head * 0.36f, hf + s.headLen * 0.35f, hu + s.head * 0.08f, s.head * 0.2f, s.headLen * 0.3f, s.head * 0.3f, light); // tan cheeks
            }
            B(0, hf + s.headLen * 0.62f, hu + s.head * 0.04f, s.head * 0.56f, s.headLen * 0.42f, s.head * 0.42f, light);   // the strong muzzle
            B(0, hf + s.headLen * 0.83f, hu + s.head * 0.36f, s.head * 0.26f, s.headLen * 0.06f, s.head * 0.14f, outl);    // nose
            B(0, hf + s.headLen * 0.84f, hu + s.head * 0.14f, s.head * 0.4f, s.headLen * 0.02f, s.head * 0.03f, Px.Col("#8a5a33")); // mouth
            // the thick ruff round his neck and shoulders, a sheen along his back, the tan chest
            B(0, front - s.len * 0.12f, u0 + s.h * 0.15f, s.w * 1.18f, s.len * 0.34f, s.h * 0.95f, Px.Col("#3a3236"));
            B(0, -s.len * 0.05f, top - 0.005f, s.w * 0.4f, s.len * 0.62f, 0.03f, Px.Col("#4a4044"));
            B(0, front + 0.01f, u0 + s.h * 0.05f, s.w * 0.5f, 0.04f, s.h * 0.55f, light);
            // fluffy all over: tufts of fur sticking out along his back, sides and belly, bigger and shaggier at the ruff
            Color fur = Px.Col("#3a3236"), furD = Px.Col("#2e272b"), furL = Px.Col("#4a4044");
            for (int i = 0; i < 9; i++)
            {
                float f = Mathf.Lerp(-front * 0.92f, front * 0.75f, i / 8f), j = (float)Px.Hash(i, 41), big = f > front * 0.3f ? 1.5f : 1f;
                B((j - 0.5f) * s.w * 0.3f, f, top - 0.01f, s.w * 0.36f * big, s.len * 0.09f, s.h * (0.1f + j * 0.1f) * big, i % 3 == 0 ? furL : fur); // along the back
                foreach (int side in new[] { -1, 1 })
                {
                    B(side * (s.w / 2 + s.w * 0.06f * big), f, u0 + s.h * (0.2f + j * 0.45f), s.w * 0.12f * big, s.len * 0.1f, s.h * 0.24f * big, (i + side) % 2 == 0 ? fur : furD); // on the sides
                    B(side * s.w * 0.3f, f, u0 - s.h * 0.1f * big, s.w * 0.22f, s.len * 0.1f, s.h * 0.14f, furD);  // hanging under the belly
                }
            }
            foreach (int side in new[] { -1, 1 }) B(side * s.head * 0.5f, hf - s.headLen * 0.3f, hu - s.head * 0.05f, s.head * 0.18f, s.headLen * 0.3f, s.head * 0.32f, fur); // fluffy cheeks under the ears
            B(0, -front * 0.8f, u0 - s.h * 0.05f, s.w * 1.12f, s.len * 0.18f, s.h * 0.55f, fur); // the "trousers" round his back legs
        }
        else foreach (int side in new[] { -1, 1 }) B(side * s.head * 0.36f, hf + s.headLen * 0.22f, hu + s.head * 0.62f, 0.04f, 0.05f, 0.05f, outl); // eyes
        if (s.ears && !s.cute) foreach (int side in new[] { -1, 1 }) B(side * s.head * 0.32f, hf - s.headLen * 0.2f, hu + s.head, 0.08f, 0.06f, 0.12f, dark);
        if (s.mane != null) { B(0, front - 0.05f, nu + 0.05f, 0.06f, 0.2f, s.neck + s.head * 0.6f, Px.Col(s.mane)); B(0, hf - s.headLen * 0.3f, hu + s.head, 0.06f, 0.14f, 0.06f, Px.Col(s.mane)); }
        if (s.horns != null) foreach (int side in new[] { -1, 1 }) { B(side * s.head * 0.3f, hf - s.headLen * 0.2f, hu + s.head, 0.05f, 0.05f, 0.14f, Px.Col(s.horns)); B(side * s.head * 0.36f, hf - s.headLen * 0.32f, hu + s.head + 0.12f, 0.05f, 0.1f, 0.05f, Px.Col(s.horns)); }
        if (s.antlers) foreach (int side in new[] { -1, 1 }) { B(side * 0.08f, hf - 0.06f, hu + s.head, 0.04f, 0.04f, 0.3f, Px.Col("#c9b48c")); B(side * 0.16f, hf - 0.02f, hu + s.head + 0.2f, 0.16f, 0.04f, 0.04f, Px.Col("#c9b48c")); B(side * 0.1f, hf + 0.08f, hu + s.head + 0.12f, 0.04f, 0.14f, 0.04f, Px.Col("#c9b48c")); }
        if (s.collar) // round his neck, where it meets the head, and the bell hanging at the front
        {
            B(0, front - s.len * 0.02f, top - s.h * 0.35f, s.w * 0.95f, s.len * 0.16f, s.h * 0.22f, Px.Col("#3f76db"));
            B(0, front + s.len * 0.07f, top - s.h * 0.55f, s.w * 0.3f, s.len * 0.06f, s.h * 0.28f, Px.Col(Px.K.gold));
        }
        if (s.beard) B(0, hf + s.headLen * 0.3f, hu - 0.1f, 0.06f, 0.05f, 0.12f, Px.Col("#d6ccb7"));
        // the tail: Basar's curls up over his back, a horse's hangs, the others stick out a little
        if (s.tail > 0)
        {
            if (s.curl)
            {
                Color fur = Px.Col("#3a3236"), furL = Px.Col("#4a4044");
                B(0, -front + s.len * 0.02f, top - s.h * 0.1f, s.w * 0.6f, s.len * 0.18f, s.h * 0.6f, fur);
                B(0, -front + s.len * 0.16f, top + s.h * 0.36f, s.w * 0.75f, s.len * 0.3f, s.h * 0.38f, fur);  // the plume curled over his back
                foreach (int side in new[] { -1, 1 }) B(side * s.w * 0.36f, -front + s.len * 0.14f, top + s.h * 0.3f, s.w * 0.14f, s.len * 0.22f, s.h * 0.28f, furL); // its fluffy edges
                B(0, -front + s.len * 0.34f, top + s.h * 0.4f, s.w * 0.4f, s.len * 0.1f, s.h * 0.28f, light); // the tan tip
            }
            else if (s.mane != null) B(0, -front - 0.04f, top - s.tail - 0.05f, 0.1f, 0.1f, s.tail, Px.Col(s.mane));
            else B(0, -front - s.tail * 0.4f, top - s.h * 0.35f, 0.07f, s.tail * 0.8f, 0.07f, s.bird ? body : dark);
        }
    }
    /** A leg hangs from where it meets the body (the piece's origin) down to its hoof or paw. */
    static void LegBoxes(Spec s)
    {
        B(0, 0, -s.legH + s.leg * 0.6f, s.leg, s.leg, s.legH - s.leg * 0.6f + 0.04f, Px.Col(s.wool ? s.dark : s.light != null && s.body == "#2e272b" ? s.light : s.dark));
        B(0, 0.01f, -s.legH, s.leg * 1.1f, s.leg * 1.2f, s.leg * 0.6f, Px.Col(s.mane != null ? "#2b1e14" : s.dark));
        if (s.cute) B(0, -s.leg * 0.55f, -s.legH * 0.6f, s.leg * 0.9f, s.leg * 0.45f, s.legH * 0.55f, Px.Col("#b07a40")); // fluffy feathering down the back of the leg
    }

    // ---------------------------------------------------------------- boxes to a mesh (as in Doll)
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
    static void B(float x, float f, float u, float w, float d, float h, Color c)
    {
        float x0 = x - w / 2, x1 = x + w / 2, f0 = f - d / 2, f1 = f + d / 2, u1 = u + h;
        Q(L(x0, f0, u1), L(x1, f0, u1), L(x1, f1, u1), L(x0, f1, u1), c * 1.08f);
        Q(L(x0, f1, u), L(x1, f1, u), L(x1, f1, u1), L(x0, f1, u1), c * 0.92f);
        Q(L(x0, f0, u), L(x1, f0, u), L(x1, f0, u1), L(x0, f0, u1), c * 0.7f);
        Q(L(x0, f0, u), L(x0, f1, u), L(x0, f1, u1), L(x0, f0, u1), c * 0.82f);
        Q(L(x1, f0, u), L(x1, f1, u), L(x1, f1, u1), L(x1, f0, u1), c * 0.76f);
        Q(L(x0, f0, u), L(x1, f0, u), L(x1, f1, u), L(x0, f1, u), c * 0.55f);
    }
    static void Q(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color col)
    {
        int i = vs.Count; col.a = 1; Color32 k = col;
        vs.Add(a); vs.Add(b); vs.Add(c); vs.Add(d); cs.Add(k); cs.Add(k); cs.Add(k); cs.Add(k);
        ts.Add(i); ts.Add(i + 1); ts.Add(i + 2); ts.Add(i); ts.Add(i + 2); ts.Add(i + 3);
    }
}
