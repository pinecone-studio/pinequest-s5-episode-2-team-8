// The shared village (Нутаг): rooms, players, chat, gers, wallets and live wrestling over the WebSocket. Ported from
// server/server.js (the protocol is in docs/PROTOCOL.md). Everything here runs on the game loop (Loop.cs).
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Naadamy.Server;

public sealed class Player
{
    public required string id; public required Conn conn; public required string name; public required JsonObject look; public int lvl;
    public double x, y; public int dir; public long moveAt, jt, st, presenceUpdatedAt;
    public string? match; public HashSet<string>? invites;
    public JsonObject Pub() => new() { ["id"] = id, ["name"] = name, ["look"] = look.DeepClone(), ["lvl"] = lvl, ["x"] = x, ["y"] = y, ["dir"] = dir };
}

public sealed class Match
{
    public required string id, a, b; public int scoreA, scoreB, played;
    public (string m, double p)? moveA, moveB; public IDisposable? timer;
    public JsonObject Score() => new() { ["a"] = scoreA, ["b"] = scoreB };
}

public sealed class Room
{
    public required string code;
    public readonly OrderedDictionary<string, Player> players = new();
    public JsonNode?[] lots = new JsonNode?[Rules.LOTS];
    public List<JsonObject> chat = new();
    public readonly Dictionary<string, Match> matches = new();
    public JsonArray LotsJson() => new(lots.Select(Js.Copy).ToArray());
    public JsonArray ChatJson() => new(chat.Select(c => (JsonNode?)c.DeepClone()).ToArray());
}

public sealed partial class Game
{
    public readonly IRoomStore store;
    readonly Leaderboard board;
    public readonly Dictionary<string, Room> rooms = new();
    public readonly HashSet<Conn> conns = new();
    JsonObject saved = new();
    bool dirty; long dirtyVersion; Task<bool>? persisting;
    public bool stopping;

    public Game(IRoomStore store) { this.store = store; board = new Leaderboard(store); }

    public async Task Start()
    {
        saved = await store.Load();
        Loop.Every(5000, () => _ = Persist());
    }

    // ---------------------------------------------------------------- rooms + saved gers
    void MarkDirty() { dirty = true; dirtyVersion++; }
    static JsonNode?[] NormalizeLots(JsonNode? lots)
    {
        var o = new JsonNode?[Rules.LOTS];
        if (lots is JsonArray a) for (int i = 0; i < Math.Min(a.Count, Rules.LOTS); i++) o[i] = Js.Copy(a[i]);
        return o;
    }
    public Room GetRoom(string code)
    {
        if (!rooms.TryGetValue(code, out var r))
        {
            var s = saved[code] as JsonObject;
            rooms[code] = r = new Room { code = code, lots = NormalizeLots(s?["lots"]), chat = RestoreChat(s?["chat"]) };
        }
        return r;
    }
    /** Saves every room's lots and chat; a save asked during a save runs once that one is done. */
    public async Task<bool> Persist()
    {
        if (!dirty) return true;
        if (persisting != null) { bool prev = await persisting; return prev && dirty ? await Persist() : prev; }
        long version = dirtyVersion;
        var snapshot = (JsonObject)saved.DeepClone();
        foreach (var r in rooms.Values) snapshot[r.code] = new JsonObject { ["lots"] = r.LotsJson(), ["chat"] = r.ChatJson(), ["t"] = Js.Now };
        persisting = Save();
        try { return await persisting; } finally { persisting = null; }
        async Task<bool> Save()
        {
            try
            {
                await store.Save(snapshot);
                saved = snapshot;
                if (dirtyVersion == version) dirty = false;
                return true;
            }
            catch (Exception e) { Console.Error.WriteLine("Could not save the rooms: " + e.Message); return false; }
        }
    }
    /** On the way out: everyone leaves, the rooms are saved. False when the save failed. */
    public async Task<bool> Shutdown()
    {
        if (stopping) return true;
        stopping = true;
        await Task.WhenAll(conns.ToList().Select(Leave));
        bool ok = await Persist();
        try { await store.Close(); } catch (Exception e) { Console.Error.WriteLine("Could not close room storage: " + e.Message); return false; }
        return ok;
    }

    // ---------------------------------------------------------------- game protocol helpers
    static int Num(JsonNode? v, int lo, int hi) => Js.Num(v) is double d ? (int)Math.Min(hi, Math.Max(lo, Math.Floor(d + 0.5))) : lo;
    static double NumF(JsonNode? v, double lo, double hi) => Js.Num(v) is double d ? Math.Min(hi, Math.Max(lo, Math.Floor(d * 100 + 0.5) / 100)) : lo; // positions with 2 decimals for smooth movement
    static string CleanName(JsonNode? s) { var n = Js.Slice(Regex.Replace(Js.Text(s), "[<>]", "").Trim(), 16); return n == "" ? "Найз" : n; }
    const long WALLET_MAX = StoreRules.WALLET_MAX;
    static int WalletLevel(Wallet w) => Math.Clamp(Rules.Level(w.xp), 1, 99);
    const double PLAYER_HW = 0.26, PLAYER_HH = 0.14, MOVE_MAX_SPEED = 12.5, MOVE_SLACK = 0.18; const long JUMP_MS = 460;
    static readonly (double x, double y, int dir) SafeSpawn = (17, 13, 0);
    static bool PositionOpen(double x, double y, bool jumping)
    {
        bool Solid(int tx, int ty) => WorldGrid.Blocked(tx, ty) && !(jumping && WorldGrid.At(tx, ty) == 'r');
        double fx = x + 0.5, fy = y + 0.82;
        return !Solid((int)Math.Floor(fx - PLAYER_HW), (int)Math.Floor(fy - PLAYER_HH)) && !Solid((int)Math.Floor(fx + PLAYER_HW), (int)Math.Floor(fy - PLAYER_HH))
            && !Solid((int)Math.Floor(fx - PLAYER_HW), (int)Math.Floor(fy + PLAYER_HH)) && !Solid((int)Math.Floor(fx + PLAYER_HW), (int)Math.Floor(fy + PLAYER_HH));
    }
    static bool ValidPosition(double x, double y) => double.IsFinite(x) && double.IsFinite(y) && x >= 0.5 && x <= Rules.W - 2 && y >= 0.5 && y <= Rules.H - 2 && PositionOpen(x, y, false);
    static bool ClearMovementPath(double fx, double fy, double tx, double ty, bool jumping)
    {
        double distance = Math.Sqrt((tx - fx) * (tx - fx) + (ty - fy) * (ty - fy));
        int steps = Math.Max(1, (int)Math.Ceiling(distance / 0.1));
        for (int i = 1; i <= steps; i++) { double f = i / (double)steps; if (!PositionOpen(fx + (tx - fx) * f, fy + (ty - fy) * f, jumping)) return false; }
        return true;
    }
    static readonly (long coins, long xp) WalletSeed = (40, 0);
    static readonly Inventory InventorySeed = new(new() { "deel-blue" }, 1);
    static JsonObject OwnedLook(JsonNode? look, Inventory? inventory)
    {
        var clean = Rules.CleanLook(look);
        foreach (var slot in new[] { "deel", "hat", "face", "neck", "pet" })
        {
            if (Js.Str(clean[slot]) is not string value) continue;
            var item = Rules.ITEMS.FirstOrDefault(i => i.slot == slot && i.val is string v && v == value);
            if (item == null || inventory == null || !inventory.owned.Contains(item.id)) clean[slot] = slot == "deel" ? "blue" : null;
        }
        return clean;
    }
    /** How many people are on the whole server and in the main village, so players in different rooms can find each other. */
    public (int total, int nutag) Counts()
    {
        int total = 0, nutag = 0;
        foreach (var r in rooms.Values) { total += r.players.Count; if (r.code == "NUTAG") nutag = r.players.Count; }
        return (total, nutag);
    }
    void Census() { var (total, nutag) = Counts(); foreach (var r in rooms.Values) if (r.players.Count > 0) Broadcast(r, new JsonObject { ["t"] = "census", ["total"] = total, ["nutag"] = nutag }); }
    static void Broadcast(Room r, JsonObject msg, Conn? except = null)
    {
        var text = Js.Stringify(msg);
        foreach (var p in r.players.Values) if (p.conn != except) p.conn.SendText(text);
    }
    /** The Mongolia day (UTC+8, no summer time) as yyyy-MM-dd: the daily earn cap's day. */
    public static string VillageDay() => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).ToString("yyyy-MM-dd");

    // ---------------------------------------------------------------- chat
    const int CHAT_KEEP = 30; const long SAY_GAP = 1000;
    static JsonObject? CleanChatLine(JsonNode? line)
    {
        if (line is not JsonObject o) return null;
        var k = Js.Str(o["k"]);
        if (k is not ("p" or "e" or "join" or "leave")) return null;
        var id = Js.Slice(Js.Text(o["id"]), 24);
        if (!StoreRules.PLAYER_ID().IsMatch(id)) return null;
        var clean = new JsonObject { ["k"] = k, ["id"] = id, ["n"] = CleanName(o["n"]) };
        if (k is "p" or "e")
        {
            int max = k == "e" ? Rules.EMOTES : Rules.PHRASES;
            if (!Js.IsInt(o["i"], out var i) || i < 0 || i >= max) return null;
            clean["i"] = i;
        }
        return clean;
    }
    static List<JsonObject> RestoreChat(JsonNode? lines) => lines is JsonArray a ? a.Select(CleanChatLine).OfType<JsonObject>().TakeLast(CHAT_KEEP).ToList() : new();
    void LogChat(Room r, JsonObject line)
    {
        r.chat.Add(line);
        if (r.chat.Count > CHAT_KEEP) r.chat.RemoveRange(0, r.chat.Count - CHAT_KEEP);
        MarkDirty();
    }
    void SyncPlayerLevel(Conn conn)
    {
        var p = conn.player;
        if (p == null || conn.room == null || conn.wallet == null) return;
        int level = WalletLevel(conn.wallet);
        if (p.lvl == level) return;
        p.lvl = level;
        Broadcast(conn.room, new JsonObject { ["t"] = "look", ["id"] = p.id, ["look"] = p.look.DeepClone(), ["lvl"] = level }, conn);
    }

    // ---------------------------------------------------------------- joining
    async Task JoinPlayer(Conn conn, JsonObject message, string code, string id, long now)
    {
        var (wallet, inventory) = await store.GetAccount(id, WalletSeed, InventorySeed);
        await Leave(conn);
        var r = GetRoom(code);
        var latest = await store.GetRoomState(code);
        if (latest != null) { r.lots = NormalizeLots(latest["lots"]); r.chat = RestoreChat(latest["chat"]); saved[code] = latest.DeepClone(); }
        r.players.TryGetValue(id, out var old);
        var position = old != null && ValidPosition(old.x, old.y) ? (old.x, old.y, old.dir) : SafeSpawn;
        if (old != null)
        {
            old.conn.player = null; old.conn.room = null;
            old.conn.Send(new JsonObject { ["t"] = "replaced" });
            Loop.After(50, old.conn.Destroy);
        }
        var p = new Player
        {
            id = id, conn = conn, name = CleanName(message["name"]), look = OwnedLook(message["look"], inventory), lvl = WalletLevel(wallet),
            x = position.x, y = position.y, dir = Math.Clamp(position.dir, 0, 3), moveAt = Js.Now,
        };
        if (conn.Destroyed) return;
        r.players[id] = p; conn.player = p; conn.room = r;
        // for the room board; a `board` asked right after the welcome waits for it
        conn.noted = NoteRoomPlayer(code, p);
        if (old == null) LogChat(r, new JsonObject { ["k"] = "join", ["id"] = id, ["n"] = p.name });
        var players = new JsonArray(r.players.Values.Where(q => q != p).Select(q => (JsonNode?)q.Pub()).ToArray());
        conn.wallet = wallet; conn.inventory = inventory;
        conn.Send(new JsonObject
        {
            ["t"] = "welcome", ["v"] = Rules.VERSION, ["now"] = now, ["day"] = VillageDay(), ["room"] = code, ["players"] = players, ["lots"] = r.LotsJson(), ["chat"] = r.ChatJson(),
            ["look"] = p.look.DeepClone(), ["wallet"] = WalletJson(wallet), ["inventory"] = inventory.ToJson(), ["position"] = new JsonObject { ["x"] = p.x, ["y"] = p.y, ["dir"] = p.dir },
        });
        var join = new JsonObject { ["t"] = "join", ["p"] = p.Pub() };
        if (old != null) join["replace"] = true;
        Broadcast(r, join, conn);
        Census();
    }
    async Task NoteRoomPlayer(string code, Player p)
    {
        try { await store.NoteRoomPlayer(code, p.id, p.name, p.look); }
        catch (Exception e) { Console.Error.WriteLine("Could not note the room player: " + e.Message); }
    }
    static JsonObject WalletJson(Wallet? w) => w == null ? new JsonObject() : new JsonObject { ["coins"] = w.coins, ["xp"] = w.xp, ["revision"] = w.revision };

    // ---------------------------------------------------------------- wallet, sync, shop, cloud save
    static readonly Regex OP = new("^[a-f0-9]{32}$", RegexOptions.IgnoreCase);
    static JsonObject With(JsonObject o, JsonObject? extra) { if (extra != null) foreach (var (k, v) in extra) o[k] = Js.Copy(v); return o; }

    async Task HandleWalletOperation(Conn conn, JsonObject m)
    {
        var p = conn.player; if (p == null) return;
        var operation = Js.Text(m["op"]); var action = Js.Str(m["action"]);
        JsonObject Reply(string op, bool accepted, string? reason, Wallet? w) { var o = new JsonObject { ["t"] = "wallet-result", ["op"] = op, ["accepted"] = accepted }; if (reason != null) o["reason"] = reason; o["wallet"] = WalletJson(w); return o; }
        if (!OP.IsMatch(operation)) { conn.Send(Reply(Js.Slice(operation, 40), false, "invalid", conn.wallet)); return; }
        if (action == "reward") { conn.Send(Reply(operation, false, "server-only", conn.wallet)); return; }
        bool valid = action == "spend" && Js.IsInt(m["coins"], out var coins) && coins > 0 && coins <= 10_000 && Js.IsInt(m["xp"], out var xp0) && xp0 == 0;
        if (!valid) { conn.Send(Reply(operation, false, "invalid", conn.wallet)); return; }
        Js.IsInt(m["coins"], out coins);
        try
        {
            var outcome = await store.MutateWallet(p.id, operation, (wallet, _, _) => wallet.coins < coins
                ? new WalletChange { Result = new JsonObject { ["accepted"] = false, ["reason"] = "insufficient" } }
                : new WalletChange { Changed = true, Wallet = (wallet.coins - coins, wallet.xp), Result = new JsonObject { ["accepted"] = true } });
            conn.wallet = outcome.wallet; conn.inventory = outcome.inventory;
            SyncPlayerLevel(conn);
            conn.Send(With(new JsonObject { ["t"] = "wallet-result", ["op"] = operation }, outcome.result).Also(o => o["wallet"] = WalletJson(outcome.wallet)));
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not update player wallet: " + e.Message);
            conn.Send(Reply(operation, false, "storage", conn.wallet));
        }
    }

    /** Progress a device made since it last saw the server wallet, added to the account: coins and XP count against the daily
     *  earn cap (what goes over is left out of `applied`, so the device tries again on a later day); coins spent on the device
     *  come off the balance, never below zero; shop items are combined with the account's, as long as the level allows them. */
    const long SYNC_MAX = 1_000_000;
    async Task HandleSync(Conn conn, JsonObject m)
    {
        var p = conn.player; if (p == null) return;
        var operation = Js.Text(m["op"]);
        void Reply(JsonObject fields)
        {
            var o = new JsonObject { ["t"] = "sync-result", ["op"] = Js.Slice(operation, 40), ["wallet"] = WalletJson(conn.wallet), ["inventory"] = conn.inventory?.ToJson() };
            conn.Send(With(o, fields));
        }
        var ownedIn = m["owned"] is JsonArray oa ? oa.Take(Rules.ITEMS.Length).ToList() : new List<JsonNode?>();
        bool rodGiven = m.ContainsKey("rod");
        bool rodOk = !rodGiven || (Js.IsInt(m["rod"], out var rv) && rv is 1 or 2);
        if (!OP.IsMatch(operation) || !Js.IsSafeInt(m["coins"], out var coins) || Math.Abs(coins) > SYNC_MAX
            || !Js.IsSafeInt(m["xp"], out var xp) || xp < 0 || xp > SYNC_MAX || !rodOk)
        { Reply(new JsonObject { ["accepted"] = false, ["reason"] = "invalid" }); return; }
        int rod = rodGiven && Js.IsInt(m["rod"], out var rl) ? (int)rl : 0;
        try
        {
            var outcome = await store.MutateWallet(p.id, operation, (wallet, inventory, earned) =>
            {
                var day = VillageDay();
                var today = earned.d == day ? earned : new Earned(day, 0, 0);
                long addXp = Math.Max(0, Math.Min(xp, Math.Min(Rules.DAILY_EARN_CAP.xp - today.xp, WALLET_MAX - wallet.xp)));
                long addCoins = coins >= 0 ? Math.Max(0, Math.Min(coins, Math.Min(Rules.DAILY_EARN_CAP.coins - today.coins, WALLET_MAX - wallet.coins))) : -Math.Min(-coins, wallet.coins);
                int level = Rules.Level(wallet.xp + addXp);
                bool Allowed(Rules.Item? item) => item != null && item.lvl <= level;
                var nextOwned = new List<string>(inventory.owned);
                foreach (var idNode in ownedIn)
                {
                    var item = Js.Str(idNode) is string id ? Rules.ITEMS.FirstOrDefault(e => e.id == id && e.cat != "tool") : null;
                    if (Allowed(item) && !nextOwned.Contains(item!.id)) nextOwned.Add(item.id);
                }
                var rodItem = Rules.ITEMS.FirstOrDefault(e => e.cat == "tool" && e.val is int v && v == rod);
                int nextRod = rod > inventory.rod && Allowed(rodItem) ? rod : inventory.rod;
                var result = new JsonObject { ["accepted"] = true, ["applied"] = new JsonObject { ["coins"] = addCoins, ["xp"] = addXp } };
                if (addXp == 0 && addCoins == 0 && nextOwned.Count == inventory.owned.Count && nextRod == inventory.rod) return new WalletChange { Result = result };
                return new WalletChange
                {
                    Changed = true, Wallet = (wallet.coins + addCoins, wallet.xp + addXp), Inventory = new Inventory(nextOwned, nextRod),
                    Earned = new Earned(day, today.coins + Math.Max(0, addCoins), today.xp + addXp), Result = result,
                };
            });
            conn.wallet = outcome.wallet; conn.inventory = outcome.inventory;
            SyncPlayerLevel(conn);
            Reply(With(new JsonObject(), outcome.result).Also(o => { o["wallet"] = WalletJson(outcome.wallet); o["inventory"] = outcome.inventory.ToJson(); }));
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not sync player progress: " + e.Message);
            Reply(new JsonObject { ["accepted"] = false, ["reason"] = "storage" });
        }
    }

    void HandleDailyActivityClaim(Conn conn, JsonObject m)
    {
        if (conn.player == null || conn.room == null) return;
        var activity = Js.Str(m["activity"]) is string a && a.Length <= 16 ? a : "";
        conn.Send(new JsonObject
        {
            ["t"] = "daily-activity-result", ["activity"] = activity, ["day"] = VillageDay(), ["accepted"] = false,
            ["reason"] = Rules.DAILY_ACTIVITY_REWARDS.ContainsKey(activity) ? "server-only" : "invalid", ["wallet"] = WalletJson(conn.wallet),
        });
    }
    void HandleQuestClaim(Conn conn, JsonObject m)
    {
        if (conn.player == null) return;
        var quest = Js.Str(m["quest"]) is string q && q.Length <= 16 ? q : "";
        conn.Send(new JsonObject
        {
            ["t"] = "quest-claim-result", ["quest"] = quest, ["accepted"] = false,
            ["reason"] = Rules.DAILY_QUEST_REWARDS.ContainsKey(quest) ? "server-only" : "invalid", ["wallet"] = WalletJson(conn.wallet),
        });
    }

    async Task HandleShopPurchase(Conn conn, JsonObject m)
    {
        var p = conn.player; if (p == null) return;
        var operation = Js.Text(m["op"]);
        JsonObject Reply(string op, JsonObject result, Wallet? w, Inventory? inv) =>
            With(new JsonObject { ["t"] = "inventory-result", ["op"] = op }, result).Also(o => { o["wallet"] = WalletJson(w); o["inventory"] = inv?.ToJson(); });
        JsonObject No(string reason) => new() { ["accepted"] = false, ["reason"] = reason };
        if (!OP.IsMatch(operation)) { conn.Send(Reply(Js.Slice(operation, 40), No("invalid"), conn.wallet, conn.inventory)); return; }
        var item = Js.Str(m["item"]) is string itemId && itemId.Length <= 32 ? Rules.ITEMS.FirstOrDefault(e => e.id == itemId) : null;
        if (item == null) { conn.Send(Reply(operation, No("invalid"), conn.wallet, conn.inventory)); return; }
        try
        {
            var outcome = await store.MutateWallet(p.id, operation, (wallet, inventory, _) =>
            {
                bool alreadyOwned = item.cat == "tool" ? inventory.rod >= (int)item.val : inventory.owned.Contains(item.id);
                if (alreadyOwned) return new WalletChange { Result = No("owned") };
                if (Rules.Level(wallet.xp) < item.lvl) return new WalletChange { Result = No("level") };
                if (wallet.coins < item.price) return new WalletChange { Result = No("insufficient") };
                var next = item.cat == "tool" ? inventory with { rod = (int)item.val } : inventory with { owned = inventory.owned.Append(item.id).ToList() };
                return new WalletChange { Changed = true, Wallet = (wallet.coins - item.price, wallet.xp), Inventory = next, Result = new JsonObject { ["accepted"] = true } };
            });
            conn.wallet = outcome.wallet; conn.inventory = outcome.inventory;
            conn.Send(Reply(operation, outcome.result, outcome.wallet, outcome.inventory));
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not purchase player shop item: " + e.Message);
            conn.Send(Reply(operation, No("storage"), conn.wallet, conn.inventory));
        }
    }

    /** The child's cloud save merged with what a device sends. It lives in the player's progress record under `cloud`;
     *  a write that raced another device is merged again. */
    async Task<JsonObject> MergeCloudSave(string id, JsonNode incoming)
    {
        for (int attempt = 0; attempt < 4; attempt++)
        {
            var current = await store.GetProgress(id, new JsonObject());
            var stored = Rules.CleanCloud(current.state["cloud"]);
            var merged = Rules.MergeCloud(stored, incoming);
            if (Js.Stringify(merged) == Js.Stringify(stored)) return merged;
            var state = (JsonObject)current.state.DeepClone(); state["cloud"] = merged.DeepClone();
            if ((await store.SaveProgress(id, current.revision, state)).accepted) return merged;
        }
        throw new InvalidOperationException("the cloud save kept changing");
    }
    public async Task<JsonObject> GetCloudSave(string id) => Rules.CleanCloud((await store.GetProgress(id, new JsonObject())).state["cloud"]);
    async Task HandleCloudSave(Conn conn, JsonObject m)
    {
        var p = conn.player;
        if (p == null || m["cloud"] is not JsonObject cloud) return;
        conn.cloudNext = cloud; // one save at a time per connection; a newer one waiting replaces the older
        if (conn.cloudBusy) return;
        conn.cloudBusy = true;
        try
        {
            while (conn.cloudNext != null)
            {
                var next = conn.cloudNext; conn.cloudNext = null;
                conn.Send(new JsonObject { ["t"] = "cloud", ["cloud"] = await MergeCloudSave(p.id, next) });
            }
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not save the cloud save: " + e.Message);
            conn.Send(new JsonObject { ["t"] = "error", ["why"] = "storage" });
        }
        finally { conn.cloudBusy = false; }
    }

    // ---------------------------------------------------------------- own ger
    /** One player's ger actions run one after another: a stage sent right after a claim must find the claimed lot. */
    void QueueLotAction(Conn conn, string action, JsonObject m)
    {
        async Task Run()
        {
            var p = conn.player; var r = conn.room;
            if (p == null || r == null) return;
            if (action == "claim") { await PersistLotAction(conn, action, m, m["i"]); return; }
            int i = Array.FindIndex(r.lots, lot => lot is JsonObject o && Js.Str(o["by"]) == p.id);
            if (i >= 0) await PersistLotAction(conn, action, m, i);
        }
        var prev = conn.lotQueue;
        conn.lotQueue = Chain();
        async Task Chain() { try { await prev; } catch { } await Run(); }
    }
    async Task PersistLotAction(Conn conn, string action, JsonObject m, JsonNode? iNode)
    {
        var p = conn.player; var r = conn.room;
        if (p == null || r == null) return;
        if (!Js.IsInt(iNode, out var il) || il < 0 || il >= Rules.LOTS) return;
        int i = (int)il;
        try
        {
            var (state, result) = await store.MutateRoom(r.code, new JsonObject { ["lots"] = r.LotsJson(), ["chat"] = r.ChatJson() }, current =>
            {
                var lots = NormalizeLots(current["lots"]);
                var lot = lots[i] as JsonObject;
                bool NextStage(out long s) => Js.IsInt(m["stage"], out s) && Rules.LotStage(lot) < Rules.GER_DONE && s == Rules.LotStage(lot) + 1;
                RoomChange Changed(string act) { current["lots"] = new JsonArray(lots.Select(Js.Copy).ToArray()); return new RoomChange { Changed = true, Extra = new JsonObject { ["t"] = "lot", ["act"] = act, ["i"] = i, ["lot"] = Js.Copy(lot), ["by"] = p.id } }; }
                if (action == "claim" && lot != null && Js.Str(lot["by"]) == p.id)
                {
                    // the claim was sent again before the first one was answered: it counts as the next stage
                    if (!NextStage(out var s)) return new RoomChange();
                    lot["stage"] = s;
                    return Changed("stage");
                }
                if (action == "claim")
                {
                    if (lot != null) return new RoomChange { Extra = "taken" };
                    if (lots.Any(o => o is JsonObject oo && Js.Str(oo["by"]) == p.id)) return new RoomChange { Extra = "own" };
                    lot = new JsonObject
                    {
                        ["by"] = p.id, ["n"] = p.name, ["roof"] = Js.Str(m["roof"]) is string rf && Rules.ROOF.Contains(rf) ? rf : "blue",
                        ["door"] = Js.Str(m["door"]) is string dr && Rules.DOOR.Contains(dr) ? dr : "red", ["furn"] = new JsonArray(),
                        ["stage"] = 1, // a new claim always starts at stage 1; the submitted stage is ignored
                    };
                    lots[i] = lot;
                }
                else
                {
                    if (lot == null || Js.Str(lot["by"]) != p.id) return new RoomChange();
                    if (action == "stage")
                    {
                        if (!NextStage(out var s)) return new RoomChange { Extra = "stage" };
                        lot["stage"] = s;
                    }
                    else
                    {
                        if (Js.Str(m["roof"]) is string rf && Rules.ROOF.Contains(rf)) lot["roof"] = rf;
                        if (Js.Str(m["door"]) is string dr && Rules.DOOR.Contains(dr)) lot["door"] = dr;
                        if (m["furn"] is JsonArray furn)
                            lot["furn"] = new JsonArray(furn.Select(Js.Str).Where(f => f != null && Rules.FURNITURE.Contains(f)).Distinct().Take(12).Select(f => (JsonNode?)f).ToArray());
                        lot["n"] = p.name;
                    }
                }
                return Changed(action);
            });
            r.lots = NormalizeLots(state["lots"]);
            if (saved[r.code] is JsonObject kept) kept["lots"] = r.LotsJson(); else saved[r.code] = new JsonObject { ["lots"] = r.LotsJson() };
            if (result.Extra is string deny) conn.Send(new JsonObject { ["t"] = "deny", ["act"] = "ger", ["why"] = deny });
            if (result.Extra is JsonObject ev) Broadcast(r, ev);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not save shared ger state: " + e.Message);
            conn.Send(new JsonObject { ["t"] = "error", ["why"] = "storage" });
        }
    }

    // ---------------------------------------------------------------- messages
    static readonly Regex PLAYER = new(@"^[\w-]{4,24}$");
    public void OnMessage(Conn conn, string text)
    {
        long t = Js.Now; // simple rate limit: ~20 messages per second
        conn.tokens = Math.Min(30, conn.tokens + (t - conn.last) / 1000.0 * 20); conn.last = t;
        if ((conn.tokens -= 1) < 0) return;
        if (Js.Parse(text) is not JsonObject m || Js.Str(m["t"]) is not string type) return;

        if (type == "join")
        {
            var code = Js.Text(m["room"]).ToUpperInvariant();
            var id = Js.Slice(Js.Text(m["id"]), 24);
            if (!Rules.ROOM_RE().IsMatch(code) || !PLAYER.IsMatch(id)) { conn.Send(new JsonObject { ["t"] = "error", ["why"] = "bad-join" }); return; }
            Loop.Go(async () =>
            {
                try
                {
                    if (!await store.AuthenticatePlayer(id, Js.Str(m["ticket"])))
                    {
                        // 'erased': the family was erased (the device forgets it); 'identity': a wrong or evicted ticket
                        conn.Send(new JsonObject { ["t"] = "error", ["why"] = await store.IsErased(id) ? "erased" : "identity" });
                        Loop.After(50, conn.Destroy);
                        return;
                    }
                    await JoinPlayer(conn, m, code, id, t);
                }
                catch (Exception e)
                {
                    Console.Error.WriteLine("Could not join multiplayer room: " + e.Message);
                    conn.Send(new JsonObject { ["t"] = "error", ["why"] = "storage" });
                }
            });
            return;
        }
        var p = conn.player; var r = conn.room;
        if (p == null || r == null) return;
        switch (type)
        {
            case "move":
            {
                long now = Js.Now; double nx = NumF(m["x"], 0.5, Rules.W - 2), ny = NumF(m["y"], 0.5, Rules.H - 2);
                double elapsed = Math.Min(0.5, Math.Max(0, (now - p.moveAt) / 1000.0));
                double maxDistance = MOVE_MAX_SPEED * elapsed + MOVE_SLACK, distance = Math.Sqrt((nx - p.x) * (nx - p.x) + (ny - p.y) * (ny - p.y));
                bool jumping = now - p.jt < JUMP_MS;
                if (distance > maxDistance || !ClearMovementPath(p.x, p.y, nx, ny, jumping))
                {
                    p.moveAt = now;
                    conn.Send(new JsonObject { ["t"] = "move-correct", ["x"] = p.x, ["y"] = p.y, ["dir"] = p.dir });
                    return;
                }
                p.x = nx; p.y = ny; p.dir = Num(m["dir"], 0, 3); p.moveAt = now;
                Broadcast(r, new JsonObject { ["t"] = "move", ["id"] = p.id, ["x"] = p.x, ["y"] = p.y, ["dir"] = p.dir }, conn);
                break;
            }
            case "jump": // show other players your jump, at most a few times a second
            {
                long now = Js.Now; if (now - p.jt < 300) return; p.jt = now;
                Broadcast(r, new JsonObject { ["t"] = "jump", ["id"] = p.id }, conn);
                break;
            }
            case "look":
                p.look = OwnedLook(m["look"], conn.inventory); if (conn.wallet != null) p.lvl = WalletLevel(conn.wallet);
                Broadcast(r, new JsonObject { ["t"] = "look", ["id"] = p.id, ["look"] = p.look.DeepClone(), ["lvl"] = p.lvl }, conn);
                break;
            case "say":
            {
                var kind = Js.Str(m["k"]) == "e" ? "e" : "p"; int max = kind == "e" ? Rules.EMOTES : Rules.PHRASES;
                if (!Js.IsInt(m["i"], out var i) || i < 0 || i >= max) return;
                long now = Js.Now; if (now - p.st < SAY_GAP) return; p.st = now; // one phrase a second, so nobody floods the room
                LogChat(r, new JsonObject { ["k"] = kind, ["id"] = p.id, ["n"] = p.name, ["i"] = i });
                Broadcast(r, new JsonObject { ["t"] = "say", ["id"] = p.id, ["n"] = p.name, ["k"] = kind, ["i"] = i }); // to everyone, including the sender
                break;
            }
            case "wallet-op": Loop.Go(() => HandleWalletOperation(conn, m)); break;
            case "quest-claim": HandleQuestClaim(conn, m); break;
            case "daily-activity-claim": HandleDailyActivityClaim(conn, m); break;
            case "shop-buy": Loop.Go(() => HandleShopPurchase(conn, m)); break;
            case "sync": Loop.Go(() => HandleSync(conn, m)); break;
            case "progress-save": conn.Send(new JsonObject { ["t"] = "progress-result", ["accepted"] = false, ["reason"] = "server-only", ["revision"] = 0 }); break;
            case "cloud-save": Loop.Go(() => HandleCloudSave(conn, m)); break;
            case "board": // XP leaderboard of this room or of the player's family
            {
                var noted = conn.noted ?? Task.CompletedTask; var k = m["k"];
                Loop.Go(async () => { await noted; conn.Send(await board.Reply(p.id, r.code, k)); });
                break;
            }
            case "ger-claim": QueueLotAction(conn, "claim", m); break;
            case "ger-stage": QueueLotAction(conn, "stage", m); break;
            case "ger-style": QueueLotAction(conn, "style", m); break;
            default: OnWrestle(conn, p, r, type, m); break;
        }
    }

    // ---------------------------------------------------------------- leaving
    public Task Leave(Conn conn)
    {
        var p = conn.player; var r = conn.room;
        conn.player = null; conn.room = null;
        if (p == null || r == null || !r.players.TryGetValue(p.id, out var cur) || cur != p) return Task.CompletedTask;
        if (p.match != null && r.matches.TryGetValue(p.match, out var match)) EndMatch(r, match, match.a == p.id ? match.b : match.a, "left");
        r.players.Remove(p.id);
        LogChat(r, new JsonObject { ["k"] = "leave", ["id"] = p.id, ["n"] = p.name });
        Broadcast(r, new JsonObject { ["t"] = "leave", ["id"] = p.id });
        Census();
        return Task.CompletedTask;
    }
}

static class Also_
{
    public static T Also<T>(this T o, Action<T> f) { f(o); return o; }
}
