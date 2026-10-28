// The isometric view of the village (☰ → Settings → Isometric view). The game itself stays on its tile grid: the ground
// is the same flat picture on the XY plane (tile (x, y) at world (x, -y, 0)), seen by an orthographic camera turned 45°
// and tilted 30° down, which makes every tile a 2:1 diamond. Trees, buildings, people and animals stand up facing the
// camera with their feet on their tile, and are drawn back to front by x + y.
using UnityEngine;

public static class Iso
{
    public const float TILT = 30, TURN = 45;
    static readonly Quaternion ROT = Quaternion.LookRotation(Forward(), new Vector3(0, 0, -1));

    /** From the camera into the ground: towards tile +x/+y's opposite corner, 30° below the horizon (-z is up). */
    static Vector3 Forward()
    {
        float t = TILT * Mathf.Deg2Rad;
        var back = new Vector3(1, -1, 0).normalized; // towards the bottom of the screen: tiles with a larger x + y
        return (-back * Mathf.Cos(t) + new Vector3(0, 0, 1) * Mathf.Sin(t)).normalized;
    }

    /** How standing sprites turn: the same way as the camera, so they face it. */
    public static Quaternion Standing => ROT;

    /** Places the camera over tile (cx, cy), snapped to whole screen pixels so the pixel art doesn't shimmer. */
    public static void Place(Camera cam, float cx, float cy, float ppu)
    {
        cam.transform.rotation = ROT;
        Vector3 R = cam.transform.right, U = cam.transform.up, F = cam.transform.forward, p = new Vector3(cx, -cy, 0);
        float a = Mathf.Round(Vector3.Dot(p, R) * ppu) / ppu, b = Mathf.Round(Vector3.Dot(p, U) * ppu) / ppu, c = Vector3.Dot(p, F);
        cam.transform.position = R * a + U * b + F * (c - 60);
        cam.nearClipPlane = 0.1f; cam.farClipPlane = 200;
    }

    /** The tile point under a screen point (on the ground plane), or null if the ray misses it. */
    public static Vector2? Ground(Camera cam, Vector2 screen)
    {
        var ray = cam.ScreenPointToRay(new Vector3(screen.x, screen.y, 0));
        if (Mathf.Abs(ray.direction.z) < 1e-5f) return null;
        float t = -ray.origin.z / ray.direction.z; var w = ray.origin + ray.direction * t;
        return new Vector2(w.x, -w.y);
    }

    /** A push on the screen (x right, y down) as a walk on the tile grid. */
    public static Vector2 FromScreen(float sx, float sy) => new Vector2(sx + sy, sy - sx) * 0.70710678f;
    /** A walk on the tile grid as a direction on the screen (x right, y down; not to scale). */
    public static Vector2 ToScreen(float gx, float gy) => new Vector2(gx - gy, gx + gy);
}
