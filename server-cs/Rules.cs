// The village rules the server needs, from web/js/village/rules.js (the game's copy is Unity's Rules.cs and vrules.json).
// Only what the server checks: sizes, the shop, levels, looks, the chat phrases and emotes, wrestling, gers and the cloud save.
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Naadamy.Server;

public static partial class Rules
{
    public const int W = 56, H = 40, LOTS = 8;
    public const int VERSION = 13; // bump when the game and server must change together (moves, messages), so an old running server is noticed

    public static readonly Dictionary<string, (int coins, int xp)> DAILY_QUEST_REWARDS = new()
    {
        ["milk"] = (20, 25), ["dairy"] = (25, 35), ["fish"] = (25, 30), ["basar"] = (15, 25), ["quiz"] = (25, 35), ["lesson"] = (30, 40),
        ["together"] = (40, 50), ["pet"] = (10, 20), ["sell"] = (15, 20), ["race"] = (25, 35), ["archery"] = (25, 35), ["wrestle"] = (25, 35),
        ["etiquette"] = (30, 40), ["defend"] = (40, 60), ["eat"] = (15, 20),
    };
    public static readonly Dictionary<string, (int coins, int xp)> DAILY_ACTIVITY_REWARDS = new() { ["rest"] = (5, 10), ["snack"] = (0, 5), ["churn"] = (0, 5) };
    /** The most coins and XP one player's devices can add to the server account in one Mongolia day. */
    public static readonly (int coins, int xp) DAILY_EARN_CAP = (1500, 2000);

    public const int PHRASES = 8; // how many preset chat phrases (rules.js PHRASES): the server only checks the index
    public const int EMOTES = 8;

    static readonly string[] SKINS = { "#F6D3B3", "#EDBB93", "#D9A06E", "#B97A4A" };
    static readonly string[] DEELS = { "blue", "red", "green", "purple", "pink", "gold", "teal", "brown", "white", "black" };
    static readonly string[] TITLES = { "nachin", "khartsaga", "zaan", "garid", "arslan", "avarga" };
    static readonly (string slot, string[] vals)[] LOOKS =
    {
        ("title", TITLES),
        ("hat", new[] { "mongol", "flower", "cap", "loovuuz", "crown", "kazakh", "buriad", "oirat", "fur" }),
        ("face", new[] { "glasses", "sun" }),
        ("neck", new[] { "scarf", "khadag", "medal" }),
        ("pet", new[] { "lamb", "puppy", "kitten", "camel", "foal" }),
        ("ride", new[] { "horse" }),
        ("coat", new[] { "bay", "black", "white", "chestnut", "gray" }),
    };

    /** A wrestling move; each beats the next half of the circle and loses to the half before it. */
    public static readonly string[] MOVES = { "push", "pull", "hook", "inhook", "hip", "leg", "lift", "havirah", "humruh", "toigdoh", "hongodoh", "suga", "tahim" };
    static readonly int HALF = (MOVES.Length - 1) / 2;
    public static bool Beats(string x, string y)
    {
        int i = Array.IndexOf(MOVES, x), j = Array.IndexOf(MOVES, y);
        if (i < 0 || j < 0) return false;
        for (int k = 1; k <= HALF; k++) if ((i + k) % MOVES.Length == j) return true;
        return false;
    }
    /** One wrestling exchange: 1 when A wins it, -1 when B does, 0 for a draw. */
    public static int Exchange(string ma, double pa, string mb, double pb)
    {
        double Base(string x, string y) => x == y ? 0.3 : Beats(x, y) ? 0.6 : 0;
        double A = Base(ma, mb) + 0.8 * Math.Max(0, Math.Min(1, pa)), B = Base(mb, ma) + 0.8 * Math.Max(0, Math.Min(1, pb));
        return Math.Abs(A - B) < 0.04 ? 0 : A > B ? 1 : -1;
    }

    public static readonly HashSet<string> ROOF = new() { "blue", "red", "green", "purple", "orange", "teal" };
    public static readonly HashSet<string> DOOR = new() { "red", "blue", "green", "gold" };
    public static readonly HashSet<string> FURNITURE = new() { "tulga", "shirdeg", "or", "avdar", "morinkhuur", "shagai" };

    public sealed record Item(string id, string cat, string slot, object val, int price, int lvl);
    public static readonly Item[] ITEMS =
    {
        new("deel-blue", "wear", "deel", "blue", 0, 1), new("deel-red", "wear", "deel", "red", 50, 1), new("deel-green", "wear", "deel", "green", 50, 1),
        new("deel-pink", "wear", "deel", "pink", 60, 2), new("deel-purple", "wear", "deel", "purple", 90, 2), new("deel-gold", "wear", "deel", "gold", 140, 3),
        new("hat-cap", "wear", "hat", "cap", 40, 1), new("hat-flower", "wear", "hat", "flower", 45, 1), new("hat-mongol", "wear", "hat", "mongol", 70, 2),
        new("hat-loovuuz", "wear", "hat", "loovuuz", 120, 3), new("hat-crown", "wear", "hat", "crown", 300, 6),
        new("face-glasses", "wear", "face", "glasses", 50, 1), new("face-sun", "wear", "face", "sun", 80, 2),
        new("neck-scarf", "wear", "neck", "scarf", 40, 1), new("neck-khadag", "wear", "neck", "khadag", 70, 2), new("neck-medal", "wear", "neck", "medal", 200, 5),
        new("pet-lamb", "pet", "pet", "lamb", 150, 2), new("pet-kitten", "pet", "pet", "kitten", 180, 2), new("pet-puppy", "pet", "pet", "puppy", 220, 3),
        new("pet-camel", "pet", "pet", "camel", 260, 4), new("pet-foal", "pet", "pet", "foal", 300, 5),
        new("rod-2", "tool", "rod", 2, 150, 3),
    };

    /** Level from total XP: level 2 at 60 XP, each next level needs 40 more than the last. */
    public static int Level(long xp)
    {
        long rest = Math.Max(0, xp); int l = 1; long need = 60;
        while (rest >= need) { rest -= need; l++; need = 60 + (l - 1) * 40; }
        return l;
    }

    [GeneratedRegex("^[A-Z0-9]{3,8}$")] public static partial Regex ROOM_RE();

    /** A look with only known values (deel, skin, girl, hat…); anything else falls back to the default or null. */
    public static JsonObject CleanLook(JsonNode? look)
    {
        var l = look as JsonObject;
        string? S(string k) => l != null && l[k] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
        var o = new JsonObject
        {
            ["deel"] = S("deel") is string d && DEELS.Contains(d) ? d : "blue",
            ["skin"] = S("skin") is string sk && SKINS.Contains(sk) ? sk : SKINS[0],
            ["gender"] = S("gender") == "girl" ? "girl" : null,
        };
        foreach (var (slot, vals) in LOOKS) o[slot] = S(slot) is string v && vals.Contains(v) ? v : null;
        return o;
    }

    public static readonly int GER_DONE = 9; // GER_STEPS: floor, walls, door, crown, roof poles, felt, cover, ropes, stove
    /** How far a lot's ger is built; gers saved before hands-on building have no stage and count as finished. */
    public static int LotStage(JsonNode? lot)
    {
        if (lot is not JsonObject o) return 0;
        return Js.IsInt(o["stage"], out var s) && s >= 1 && s <= GER_DONE ? (int)s : GER_DONE;
    }

    // ---------------------------------------------------------------- cloud save (rules.js cleanCloud / mergeCloud)
    [GeneratedRegex(@"^[\w:.-]{1,48}$")] private static partial Regex CLOUD_ID();
    const int CLOUD_KEYS = 200; const long CLOUD_TIME = 4102444800000;

    public static JsonObject CleanCloud(JsonNode? x)
    {
        var o = x as JsonObject ?? new JsonObject();
        long Int(JsonNode? v, long max) => Js.IsSafeInt(v, out var n) && n > 0 ? Math.Min(n, max) : 0;
        string Str(JsonNode? v) => Js.Str(v) is string s && CLOUD_ID().IsMatch(s) ? s : "";
        JsonObject Map(JsonNode? m, Func<JsonNode?, JsonNode?> f)
        {
            var r = new JsonObject();
            if (m is JsonObject mo)
                foreach (var (k, v) in mo.Take(CLOUD_KEYS))
                {
                    if (!CLOUD_ID().IsMatch(k)) continue;
                    var val = f(v); if (Js.Truthy(val)) r[k] = val;
                }
            return r;
        }
        return new JsonObject
        {
            ["eth"] = Str(o["eth"]), ["aimag"] = Str(o["aimag"]), ["charAt"] = Int(o["charAt"], CLOUD_TIME),
            ["learn"] = Map(o["learn"], l =>
            {
                if (l is not JsonObject lo) return null;
                bool done = lo["done"] is JsonValue dv && dv.TryGetValue<bool>(out var b) && b;
                long best = Int(lo["best"], 1000), family = Int(lo["family"], CLOUD_TIME);
                return done || best != 0 || family != 0 ? new JsonObject { ["done"] = done, ["best"] = best, ["family"] = family } : null;
            }),
            ["ach"] = Map(o["ach"], t => Int(t, CLOUD_TIME)), ["stamps"] = Map(o["stamps"], t => Int(t, CLOUD_TIME)),
            ["bichig"] = Map(o["bichig"], n => Int(n, 1000)), ["bichigMem"] = Map(o["bichigMem"], v => Js.Truthy(v) ? 1 : 0),
            ["hist"] = Int(o["hist"], 1000), ["story"] = Map(o["story"], n => Int(n, 1000)),
        };
    }

    /** Merging only adds: done stays done, best scores and steps go up, the earliest date of a badge or stamp stays.
     *  The character is the exception: the most recent choice (charAt) wins. */
    public static JsonObject MergeCloud(JsonNode? a0, JsonNode? b0)
    {
        JsonObject a = CleanCloud(a0), b = CleanCloud(b0);
        long L(JsonNode? n) => Js.IsInt(n, out var x) ? x : 0;
        JsonObject Each(JsonNode? x, JsonNode? y, Func<JsonNode?, JsonNode?, JsonNode?> f)
        {
            var xo = (JsonObject)x!; var yo = (JsonObject)y!; var r = new JsonObject();
            foreach (var k in xo.Select(p => p.Key).Concat(yo.Select(p => p.Key)).Distinct()) r[k] = f(xo[k], yo[k]);
            return r;
        }
        JsonNode Earliest(JsonNode? x, JsonNode? y) { long p = L(x), q = L(y); return p != 0 && q != 0 ? Math.Min(p, q) : p != 0 ? p : q; }
        JsonNode Max(JsonNode? x, JsonNode? y) => Math.Max(L(x), L(y));
        var who = L(b["charAt"]) > L(a["charAt"]) || (Js.Str(a["eth"]) == "" && Js.Str(a["aimag"]) == "") ? b : a;
        var story = Each(a["story"], b["story"], Max);
        foreach (var k in story.Select(p => p.Key).ToList()) if (k.EndsWith(":done")) story.Remove(k[..^5]); // a finished chapter replays from the start
        string Or(string? p, string? q) => !string.IsNullOrEmpty(p) ? p : q ?? "";
        return new JsonObject
        {
            ["eth"] = Or(Js.Str(who["eth"]), Js.Str(a["eth"])), ["aimag"] = Or(Js.Str(who["aimag"]), Js.Str(a["aimag"])), ["charAt"] = Max(a["charAt"], b["charAt"]),
            ["learn"] = Each(a["learn"], b["learn"], (x, y) =>
            {
                var xo = x as JsonObject; var yo = y as JsonObject;
                bool D(JsonObject? o) => o?["done"] is JsonValue v && v.TryGetValue<bool>(out var d) && d;
                return new JsonObject { ["done"] = D(xo) || D(yo), ["best"] = Max(xo?["best"], yo?["best"]), ["family"] = Max(xo?["family"], yo?["family"]) };
            }),
            ["ach"] = Each(a["ach"], b["ach"], Earliest), ["stamps"] = Each(a["stamps"], b["stamps"], Earliest),
            ["bichig"] = Each(a["bichig"], b["bichig"], Max), ["bichigMem"] = Each(a["bichigMem"], b["bichigMem"], (_, _) => 1),
            ["hist"] = Max(a["hist"], b["hist"]), ["story"] = story,
        };
    }
}
