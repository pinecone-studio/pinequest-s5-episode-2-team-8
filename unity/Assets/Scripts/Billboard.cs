// Isometric pixel pictures standing in the village with a depth for every pixel (Shaders/NaadamyPicture): a quad facing
// the camera, 16 pixels a tile, its pivot (the picture's feet or ground middle) at the world point it stands on.
using System.Collections.Generic;
using UnityEngine;

public static class Billboard
{
    static Shader shader;
    static readonly Dictionary<PxCanvas, Material> mats = new Dictionary<PxCanvas, Material>();
    static readonly Dictionary<PxCanvas, Mesh> meshes = new Dictionary<PxCanvas, Mesh>();

    /** The picture's material (made once): its colours, and its depths packed into a second texture. */
    public static Material Mat(PxCanvas art, float[] depth)
    {
        if (mats.TryGetValue(art, out var m)) return m;
        if (shader == null) shader = Resources.Load<Shader>("Shaders/NaadamyPicture") ?? Shader.Find("Naadamy/Picture");
        var dt = new Texture2D(art.W, art.H, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
        var px = new Color32[art.W * art.H];
        for (int y = 0; y < art.H; y++) for (int x = 0; x < art.W; x++)
        {
            float d = depth[y * art.W + x]; if (d == float.MaxValue) continue;
            int q = Mathf.Clamp(Mathf.RoundToInt((d + 8) / 16 * 65535), 0, 65535);
            px[(art.H - 1 - y) * art.W + x] = new Color32((byte)(q >> 8), (byte)(q & 255), 0, 255); // texture rows run bottom-up
        }
        dt.SetPixels32(px); dt.Apply(false, true);
        m = new Material(shader) { mainTexture = art.ToTexture() }; m.SetTexture("_DepthTex", dt);
        return mats[art] = m;
    }

    /** The quad for a picture: pivot in pixels from its top-left corner, ppt pixels a tile. */
    public static Mesh Quad(PxCanvas art, float pivotX, float pivotY, float ppt = 16)
    {
        if (meshes.TryGetValue(art, out var q)) return q;
        float l = -pivotX / ppt, r = (art.W - pivotX) / ppt, t = pivotY / ppt, b = -(art.H - pivotY) / ppt;
        q = new Mesh { vertices = new[] { new Vector3(l, b), new Vector3(r, b), new Vector3(r, t), new Vector3(l, t) }, uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) }, triangles = new[] { 0, 2, 1, 0, 3, 2 } };
        q.RecalculateBounds();
        return meshes[art] = q;
    }

    /** A new standing picture at world point at. */
    public static GameObject Make(string name, PxCanvas art, float pivotX, float pivotY, float[] depth, Vector3 at, Transform parent)
    {
        var go = new GameObject(name); go.transform.SetParent(parent, false);
        go.AddComponent<MeshFilter>().sharedMesh = Quad(art, pivotX, pivotY);
        go.AddComponent<MeshRenderer>().sharedMaterial = Mat(art, depth);
        go.transform.SetPositionAndRotation(at, Iso.Standing);
        return go;
    }
}
