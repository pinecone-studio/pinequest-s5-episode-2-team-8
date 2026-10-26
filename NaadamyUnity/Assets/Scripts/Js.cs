// JavaScript number semantics, so the map and pixel art come out exactly like the web version of Naadamy.
using System;

public static class Js
{
    /** Math.round: halves go up (C# Math.Round would round them to even). */
    public static int Round(double v) => (int)Math.Floor(v + 0.5);

    /** ToInt32 from the spec: the double is truncated and wrapped into 32 bits, the way `x >> 0` does it. */
    public static int ToInt32(double d)
    {
        if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
        double m = Math.Truncate(d) % 4294967296.0;
        if (m < 0) m += 4294967296.0;
        return unchecked((int)(uint)m);
    }

    /** The same hash world.js and pixel.js use, including the float precision loss of the JS original. */
    public static double Hash(double x, double y)
    {
        int a = ToInt32(x * 374761393.0 + y * 668265263.0);
        int b = ToInt32((double)(a ^ (a >> 13)) * 1274126177.0);
        return unchecked((uint)(b ^ (b >> 16))) / 4294967295.0;
    }

    /** world.js's seeded random: seed = seed * 16807 % 2147483647. */
    public sealed class Rng
    {
        long seed;
        public Rng(long seed) { this.seed = seed; }
        public double Next() { seed = seed * 16807 % 2147483647; return seed / 2147483647.0; }
    }
}

/** A bit of text in Mongolian and English, like T(mn, en) in the web version. */
public readonly struct Tx
{
    public readonly string mn, en;
    public Tx(string mn, string en) { this.mn = mn; this.en = en; }
    public override string ToString() => Loc.En ? en : mn;
}

public static class Loc
{
    public static bool En;
    public static string L(string mn, string en) => En ? en : mn;
}
