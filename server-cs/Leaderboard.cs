// XP leaderboards for a joined player (WebSocket `board`): `room` = the players who joined this room in the last 30 days (top 10
// and the asker), `family` = the children of the asker's family. Rows carry only rank, name, look (room) or mascot (family), XP
// and `me`: never ids or codes. Each answer is kept 30 s, so asking again costs no query. Ported from server/leaderboard.js.
using System.Text.Json.Nodes;

namespace Naadamy.Server;

public sealed class Leaderboard
{
    const long CACHE_MS = 30_000; const int CACHE_MAX = 5000;
    readonly IRoomStore store;
    readonly Dictionary<string, (long at, Task<List<JsonObject>?> rows)> cache = new(); // 'room:CODE:id' | 'family:id'
    public Leaderboard(IRoomStore store) { this.store = store; }

    Task<List<JsonObject>?> Cached(string key, Func<Task<List<JsonObject>?>> load)
    {
        long t = Js.Now;
        if (cache.TryGetValue(key, out var hit) && t - hit.at < CACHE_MS) return hit.rows;
        cache.Remove(key);
        if (cache.Count >= CACHE_MAX) foreach (var (k, v) in cache.ToList()) if (t - v.at >= CACHE_MS) cache.Remove(k);
        if (cache.Count >= CACHE_MAX) cache.Remove(cache.Keys.First()); // the oldest
        var rows = load();
        cache[key] = (t, rows);
        rows.ContinueWith(_ => { if (cache.TryGetValue(key, out var c) && c.rows == rows) cache.Remove(key); }, CancellationToken.None, TaskContinuationOptions.OnlyOnFaulted, TaskScheduler.FromCurrentSynchronizationContext()); // a failed read is not kept
        return rows;
    }

    /** The `board` answer for player `id` in room `roomCode`: { t: 'board', k, rows } or with `reason`. Never throws. */
    public async Task<JsonObject> Reply(string id, string roomCode, JsonNode? kind)
    {
        var k = Js.Str(kind);
        if (k is not ("room" or "family")) return new JsonObject { ["t"] = "board", ["k"] = Js.Slice(kind == null ? "undefined" : Js.Str(kind) ?? kind.ToJsonString(), 8), ["rows"] = new JsonArray(), ["reason"] = "invalid" };
        try
        {
            var rows = k == "room" ? await Cached($"room:{roomCode}:{id}", async () => await store.RoomBoard(roomCode, id)) : await Cached($"family:{id}", () => store.FamilyBoard(id));
            return rows != null
                ? new JsonObject { ["t"] = "board", ["k"] = k, ["rows"] = new JsonArray(rows.Select(r => (JsonNode?)r.DeepClone()).ToArray()) }
                : new JsonObject { ["t"] = "board", ["k"] = k, ["rows"] = new JsonArray(), ["reason"] = "no-family" };
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not read the leaderboard: " + e.Message);
            return new JsonObject { ["t"] = "board", ["k"] = k, ["rows"] = new JsonArray(), ["reason"] = "storage" };
        }
    }
    /** A family was erased: its children must leave every board now. */
    public void Clear() => cache.Clear();
    /** These children's family changed. */
    public void Forget(IEnumerable<string> ids) { foreach (var id in ids) cache.Remove("family:" + id); }
}
