// Where rooms, player identities, wallets and progress are kept. JsonRoomStore keeps them in JSON files in DATA_DIR (one
// server); the PostgreSQL store (several server instances) is not ported yet. Ported from server/room-store.js.
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Naadamy.Server;

public sealed record Wallet(long coins, long xp, long revision);
public sealed record Inventory(List<string> owned, int rod)
{
    public JsonObject ToJson() => new() { ["owned"] = new JsonArray(owned.Select(o => (JsonNode?)o).ToArray()), ["rod"] = rod };
}
/** How much this player's devices have added to the account today (d: Mongolia day), for the daily earn cap. */
public sealed record Earned(string d, long coins, long xp);
/** What a wallet change decided: `Changed` saves Wallet (and Inventory / Earned when given); `Result` is remembered for the operation. */
public sealed class WalletChange
{
    public bool Changed; public (long coins, long xp)? Wallet; public Inventory? Inventory; public Earned? Earned; public JsonObject? Result;
}
public sealed record WalletOutcome(Wallet wallet, Inventory inventory, JsonObject result, bool duplicate);
public sealed record Progress(long revision, JsonObject state);
public sealed record ProgressSave(bool accepted, long revision, JsonObject state);
public sealed class RoomChange { public bool Changed; public object? Extra; }

public interface IRoomStore
{
    string Kind { get; }
    bool SharedRealtime { get; }
    Task<JsonObject> Load();
    Task Save(JsonObject rooms);
    Task<JsonObject?> GetRoomState(string code);
    Task<bool> AuthenticatePlayer(string id, string? ticket);
    Task<bool> IsErased(string id);
    Task<(Wallet wallet, Inventory inventory)> GetAccount(string id, (long coins, long xp) walletSeed, Inventory inventorySeed);
    Task<WalletOutcome> MutateWallet(string id, string operation, Func<Wallet, Inventory, Earned, WalletChange> mutate);
    Task<Progress> GetProgress(string id, JsonObject initial);
    Task<ProgressSave> SaveProgress(string id, long revision, JsonObject state);
    /** mutate(state) changes the room's state in place; a Changed one is saved. Returns the state and what mutate said. */
    Task<(JsonObject state, RoomChange result)> MutateRoom(string code, JsonObject initial, Func<JsonObject, RoomChange> mutate);
    Task NoteRoomPlayer(string code, string id, string name, JsonNode? look);
    Task<List<JsonObject>> RoomBoard(string code, string me);
    Task<List<JsonObject>?> FamilyBoard(string me);
    Task Close();
}

public static partial class StoreRules
{
    [GeneratedRegex("^[A-Z0-9]{3,8}$")] public static partial Regex ROOM_CODE();
    [GeneratedRegex(@"^[\w-]{4,24}$")] public static partial Regex PLAYER_ID();
    [GeneratedRegex("^[a-f0-9]{64}$", RegexOptions.IgnoreCase)] public static partial Regex PLAYER_TICKET();
    [GeneratedRegex(@"^(?:[a-f0-9]{32}|(?:quest|activity):\d{4}-\d{2}-\d{2}:[a-z]{1,16}|wrestle:[\w-]{1,64})$", RegexOptions.IgnoreCase)] public static partial Regex WALLET_OPERATION();
    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")] public static partial Regex DAY();
    public const long WALLET_MAX = 2_000_000_000;
    public const long ERASED_KEEP_MS = 30L * 24 * 60 * 60 * 1000; // an erased child's id can't be taken again for 30 days
    public const long BOARD_SEEN_MS = 30L * 24 * 60 * 60 * 1000; // a room's board counts the players who joined it in the last 30 days

    public static string TicketHash(string ticket) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(ticket)));
    public static bool SameTicketHash(string? expected, string? actual)
    {
        if (expected == null || !Regex.IsMatch(expected, "^[a-f0-9]{64}$", RegexOptions.IgnoreCase) || actual == null || !PLAYER_TICKET().IsMatch(actual)) return false;
        return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(expected), Convert.FromHexString(TicketHash(actual)));
    }

    public static Wallet CleanWallet(JsonNode? w)
    {
        if (w is not JsonObject o) throw new InvalidDataException("Invalid stored player wallet");
        if (!Js.IsSafeInt(o["coins"], out var coins) || coins < 0 || coins > WALLET_MAX || !Js.IsSafeInt(o["xp"], out var xp) || xp < 0 || xp > WALLET_MAX
            || !Js.IsSafeInt(o["revision"], out var revision) || revision < 0) throw new InvalidDataException("Invalid stored player wallet");
        return new Wallet(coins, xp, revision);
    }
    public static Wallet InitialWallet((long coins, long xp) seed) => new(Math.Clamp(seed.coins, 0, WALLET_MAX), Math.Clamp(seed.xp, 0, WALLET_MAX), 0);
    public static Inventory CleanInventory(JsonNode? inv)
    {
        if (inv is not JsonObject o || o["owned"] is not JsonArray owned || !Js.IsInt(o["rod"], out var rod) || rod < 1 || rod > 2) throw new InvalidDataException("Invalid stored player inventory");
        return CleanInventory(owned.Select(Js.Str), (int)rod);
    }
    public static Inventory CleanInventory(IEnumerable<string?> ownedIds, int rod)
    {
        var allowed = Rules.ITEMS.Where(i => i.cat != "tool").Select(i => i.id).ToList();
        var owned = ownedIds.Where(id => id != null && allowed.Contains(id)).Select(id => id!).Distinct().ToList();
        if (!owned.Contains("deel-blue")) owned.Insert(0, "deel-blue");
        return new Inventory(owned.Take(allowed.Count).ToList(), rod);
    }
    public static Inventory InitialInventory(Inventory? seed) => CleanInventory((seed?.owned ?? new()).Take(Rules.ITEMS.Length), Math.Clamp(seed?.rod ?? 1, 1, 2));
    public static Earned CleanEarned(JsonNode? e)
    {
        long Count(JsonNode? v) => Js.IsSafeInt(v, out var n) && n > 0 ? Math.Min(WALLET_MAX, n) : 0;
        if (e is not JsonObject o || Js.Str(o["d"]) is not string d || !DAY().IsMatch(d)) return new Earned("", 0, 0);
        return new Earned(d, Count(o["coins"]), Count(o["xp"]));
    }
    public static JsonObject EarnedJson(Earned e) => new() { ["d"] = e.d, ["coins"] = e.coins, ["xp"] = e.xp };
    public static Progress CleanProgress(JsonNode? r)
    {
        if (r is not JsonObject o || !Js.IsSafeInt(o["revision"], out var rev) || rev < 0 || o["state"] is not JsonObject state) throw new InvalidDataException("Invalid stored player progress");
        return new Progress(rev, state);
    }
    /** Leaderboard rows ({ id, xp, ...shown }) ranked by XP (equal XP, equal rank): the first `top` and the player `me`, without ids. */
    public static List<JsonObject> RankRows(List<(string id, long xp, JsonObject shown)> rows, string me, int top)
    {
        rows.Sort((a, b) => b.xp != a.xp ? b.xp.CompareTo(a.xp) : string.CompareOrdinal(a.id, b.id));
        var out_ = new List<JsonObject>(); int rank = 0;
        for (int i = 0; i < rows.Count; i++)
        {
            if (i == 0 || rows[i - 1].xp != rows[i].xp) rank = i + 1;
            if (i + 1 > top && rows[i].id != me) continue;
            var o = new JsonObject { ["rank"] = rank };
            foreach (var (k, v) in rows[i].shown) o[k] = Js.Copy(v);
            o["xp"] = rows[i].xp;
            if (rows[i].id == me) o["me"] = true;
            out_.Add(o);
        }
        return out_;
    }
    /** Takes erased players out of a room's state ({ lots, chat }, changed in place): their lots are freed and their chat lines dropped. */
    public static (List<int> freed, bool changed) ScrubRoom(JsonObject state, ISet<string> ids)
    {
        var freed = new List<int>();
        if (state["lots"] is JsonArray lots)
            for (int i = 0; i < lots.Count; i++) if (lots[i] is JsonObject lot && Js.Str(lot["by"]) is string by && ids.Contains(by)) { lots[i] = null; freed.Add(i); }
        int dropped = 0;
        if (state["chat"] is JsonArray chat)
            for (int i = chat.Count - 1; i >= 0; i--) if (chat[i] is JsonObject line && Js.Str(line["id"]) is string id && ids.Contains(id)) { chat.RemoveAt(i); dropped++; }
        return (freed, freed.Count > 0 || dropped > 0);
    }
}

public sealed class JsonRoomStore : IRoomStore
{
    readonly string dir, dataFile, identityFile, walletFile, progressFile, familyFile, deviceTicketFile, erasedFile, roomPlayersFile;
    public JsonRoomStore(string dataDir)
    {
        dir = dataDir;
        string F(string name) => Path.Combine(dataDir, name);
        dataFile = F("rooms.json"); identityFile = F("identities.json"); walletFile = F("wallets.json"); progressFile = F("progress.json");
        familyFile = F("families.json"); deviceTicketFile = F("device-tickets.json"); erasedFile = F("erased.json"); roomPlayersFile = F("room-players.json");
    }
    public string Kind => "json";
    public bool SharedRealtime => false;

    /** A data file as a JSON object; a missing file is an empty one. */
    public static JsonObject Read(string file, string label = "room data")
    {
        string text;
        try { text = File.ReadAllText(file); }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException) { return new JsonObject(); }
        JsonNode? node;
        try { node = JsonNode.Parse(text); } catch (Exception e) { throw new InvalidDataException($"Could not read {label} from {file}: {e.Message}"); }
        return node as JsonObject ?? throw new InvalidDataException($"Could not read {label} from {file}: {label} must be a JSON object");
    }
    /** Writes a data file whole: to a temporary file first, then renamed over the old one, so a crash never leaves half a file. */
    public static void Write(string file, JsonNode data)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var tmp = file + ".tmp";
        File.WriteAllText(tmp, Js.Stringify(data));
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(tmp, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.Move(tmp, file, true);
    }
    JsonObject Identities()
    {
        var ids = Read(identityFile, "player identities");
        foreach (var (id, hash) in ids)
            if (!StoreRules.PLAYER_ID().IsMatch(id) || Js.Str(hash) is not string h || !Regex.IsMatch(h, "^[a-f0-9]{64}$", RegexOptions.IgnoreCase))
                throw new InvalidDataException($"Could not read player identities from {identityFile}: invalid identity record");
        return ids;
    }
    bool ErasedLately(JsonObject erased, string id) => erased[id] is JsonNode at && Js.Num(at) is double t && Js.Now - t < StoreRules.ERASED_KEEP_MS;

    public Task<JsonObject> Load() => Task.FromResult(Read(dataFile));
    public Task Save(JsonObject rooms) { Write(dataFile, rooms); return Task.CompletedTask; }
    public Task<JsonObject?> GetRoomState(string code) => Task.FromResult<JsonObject?>(null);

    public Task<bool> AuthenticatePlayer(string id, string? ticket)
    {
        if (!StoreRules.PLAYER_ID().IsMatch(id) || ticket == null || !StoreRules.PLAYER_TICKET().IsMatch(ticket)) return Task.FromResult(false);
        var identities = Identities();
        if (identities.ContainsKey(id))
        {
            if (StoreRules.SameTicketHash(Js.Str(identities[id]), ticket)) return Task.FromResult(true);
            var devices = Read(deviceTicketFile, "device tickets");
            return Task.FromResult(devices[id] is JsonArray hashes && hashes.Any(h => StoreRules.SameTicketHash(Js.Str(h), ticket)));
        }
        if (ErasedLately(Read(erasedFile, "erased players"), id)) return Task.FromResult(false);
        identities[id] = StoreRules.TicketHash(ticket);
        Write(identityFile, identities);
        return Task.FromResult(true);
    }
    public Task<bool> IsErased(string id) => Task.FromResult(StoreRules.PLAYER_ID().IsMatch(id) && ErasedLately(Read(erasedFile, "erased players"), id));

    public Task<(Wallet wallet, Inventory inventory)> GetAccount(string id, (long coins, long xp) walletSeed, Inventory inventorySeed)
    {
        if (!StoreRules.PLAYER_ID().IsMatch(id)) throw new ArgumentException("Invalid player id for wallet");
        var wallets = Read(walletFile, "player wallets");
        var stored = wallets[id] as JsonObject;
        if (wallets.ContainsKey(id) && (stored == null || stored["operations"] is not JsonObject)) throw new InvalidDataException("Invalid stored player wallet operations");
        var wallet = stored != null ? StoreRules.CleanWallet(stored) : StoreRules.InitialWallet(walletSeed);
        var inventory = stored != null && stored["inventory"] != null ? StoreRules.CleanInventory(stored["inventory"]) : StoreRules.InitialInventory(inventorySeed);
        if (stored != null) stored["inventory"] = inventory.ToJson();
        else wallets[id] = new JsonObject { ["coins"] = wallet.coins, ["xp"] = wallet.xp, ["revision"] = wallet.revision, ["inventory"] = inventory.ToJson(), ["operations"] = new JsonObject() };
        Write(walletFile, wallets);
        return Task.FromResult((wallet, inventory));
    }

    public Task<WalletOutcome> MutateWallet(string id, string operation, Func<Wallet, Inventory, Earned, WalletChange> mutate)
    {
        if (!StoreRules.PLAYER_ID().IsMatch(id) || !StoreRules.WALLET_OPERATION().IsMatch(operation)) throw new ArgumentException("Invalid player wallet operation");
        var wallets = Read(walletFile, "player wallets");
        var init = StoreRules.InitialWallet((40, 0));
        var stored = wallets.ContainsKey(id) ? wallets[id] as JsonObject
            : new JsonObject { ["coins"] = init.coins, ["xp"] = init.xp, ["revision"] = 0, ["inventory"] = StoreRules.InitialInventory(null).ToJson(), ["operations"] = new JsonObject() };
        if (stored == null || stored["operations"] is not JsonObject operations) throw new InvalidDataException("Invalid stored player wallet operations");
        var inventory = stored["inventory"] != null ? StoreRules.CleanInventory(stored["inventory"]) : StoreRules.InitialInventory(null);
        if (operations.ContainsKey(operation))
            return Task.FromResult(new WalletOutcome(StoreRules.CleanWallet(stored), inventory, operations[operation] as JsonObject ?? new JsonObject(), true));
        var earned = StoreRules.CleanEarned(stored["earned"]);
        var current = StoreRules.CleanWallet(stored);
        var change = mutate(current, inventory, earned);
        var wallet = change.Changed && change.Wallet is var (c, x) ? StoreRules.CleanWallet(new JsonObject { ["coins"] = c, ["xp"] = x, ["revision"] = current.revision + 1 }) : current;
        var nextInventory = change.Changed && change.Inventory != null ? StoreRules.CleanInventory(change.Inventory.owned, change.Inventory.rod) : inventory;
        var nextEarned = change.Changed && change.Earned != null ? StoreRules.CleanEarned(StoreRules.EarnedJson(change.Earned)) : earned;
        var result = change.Result ?? new JsonObject { ["accepted"] = false };
        operations[operation] = Js.Copy(result);
        // keep the last 200 one-off operations; quest, activity and wrestling ones are kept to refuse a second pay for them
        var old = operations.Select(p => p.Key).Where(k => !k.StartsWith("quest:") && !k.StartsWith("activity:") && !k.StartsWith("wrestle:")).ToList();
        foreach (var k in old.Take(Math.Max(0, old.Count - 200))) operations.Remove(k);
        stored.Remove("operations");
        wallets[id] = new JsonObject
        {
            ["coins"] = wallet.coins, ["xp"] = wallet.xp, ["revision"] = wallet.revision, ["operations"] = operations,
            ["inventory"] = nextInventory.ToJson(), ["earned"] = StoreRules.EarnedJson(nextEarned),
        };
        Write(walletFile, wallets);
        return Task.FromResult(new WalletOutcome(wallet, nextInventory, result, false));
    }

    public Task<Progress> GetProgress(string id, JsonObject initial)
    {
        if (!StoreRules.PLAYER_ID().IsMatch(id)) throw new ArgumentException("Invalid player id for progress");
        var records = Read(progressFile, "player progress");
        if (records.ContainsKey(id)) return Task.FromResult(StoreRules.CleanProgress(records[id]));
        records[id] = new JsonObject { ["revision"] = 0, ["state"] = Js.Copy(initial) };
        Write(progressFile, records);
        return Task.FromResult(new Progress(0, initial));
    }
    public Task<ProgressSave> SaveProgress(string id, long revision, JsonObject state)
    {
        if (!StoreRules.PLAYER_ID().IsMatch(id) || revision < 0) throw new ArgumentException("Invalid player progress update");
        var records = Read(progressFile, "player progress");
        var current = records.ContainsKey(id) ? StoreRules.CleanProgress(records[id]) : new Progress(0, new JsonObject());
        if (current.revision != revision) return Task.FromResult(new ProgressSave(false, current.revision, current.state));
        records[id] = new JsonObject { ["revision"] = revision + 1, ["state"] = Js.Copy(state) };
        Write(progressFile, records);
        return Task.FromResult(new ProgressSave(true, revision + 1, state));
    }

    public Task<(JsonObject state, RoomChange result)> MutateRoom(string code, JsonObject initial, Func<JsonObject, RoomChange> mutate)
    {
        var rooms = Read(dataFile);
        var state = rooms[code] as JsonObject ?? (JsonObject)initial.DeepClone();
        var result = mutate(state);
        if (result.Changed)
        {
            if (state.Parent == null) rooms[code] = state;
            Write(dataFile, rooms);
        }
        return Task.FromResult((state, result));
    }

    /** Remembers that this player joined the room, with the name and look shown on its board. */
    public Task NoteRoomPlayer(string code, string id, string name, JsonNode? look)
    {
        if (!StoreRules.ROOM_CODE().IsMatch(code) || !StoreRules.PLAYER_ID().IsMatch(id)) return Task.CompletedTask;
        var all = Read(roomPlayersFile, "room players"); long at = Js.Now;
        foreach (var (c, players) in all.ToList()) // forget the players not seen for 30 days, and rooms left empty
        {
            if (players is JsonObject po)
                foreach (var (k, entry) in po.ToList()) if (!(entry is JsonObject eo && Js.Num(eo["at"]) is double t && at - t < StoreRules.BOARD_SEEN_MS)) po.Remove(k);
            if (players is not JsonObject p2 || p2.Count == 0) all.Remove(c);
        }
        if (all[code] is not JsonObject seen) all[code] = seen = new JsonObject();
        seen[id] = new JsonObject { ["name"] = name, ["look"] = Js.Copy(look), ["at"] = at };
        Write(roomPlayersFile, all);
        return Task.CompletedTask;
    }
    /** The room's players of the last 30 days by XP: the top 10 and `me` ({ rank, name, look, xp, me? }). */
    public Task<List<JsonObject>> RoomBoard(string code, string me)
    {
        var all = Read(roomPlayersFile, "room players"); var wallets = Read(walletFile, "player wallets"); var erased = Read(erasedFile, "erased players"); long at = Js.Now;
        var rows = new List<(string, long, JsonObject)>();
        if (all[code] is JsonObject seen)
            foreach (var (id, entry) in seen)
                if (entry is JsonObject e && Js.Num(e["at"]) is double t && at - t < StoreRules.BOARD_SEEN_MS && wallets.ContainsKey(id) && !ErasedLately(erased, id))
                    rows.Add((id, StoreRules.CleanWallet(wallets[id]).xp, new JsonObject { ["name"] = Js.Copy(e["name"]), ["look"] = Js.Copy(e["look"]) }));
        return Task.FromResult(StoreRules.RankRows(rows, me, 10));
    }
    /** The children of `me`'s family by XP ({ rank, name, avatar, xp, me? }), or null when `me` is in no family. */
    public Task<List<JsonObject>?> FamilyBoard(string me)
    {
        var families = Read(familyFile, "families"); var wallets = Read(walletFile, "player wallets"); var erased = Read(erasedFile, "erased players");
        var family = families.Select(p => p.Value as JsonObject).FirstOrDefault(f => f?["members"] is JsonArray m && m.Any(x => x is JsonObject xo && Js.Str(xo["id"]) == me && StoreRules.PLAYER_ID().IsMatch(me)));
        if (family == null) return Task.FromResult<List<JsonObject>?>(null);
        var rows = new List<(string, long, JsonObject)>();
        foreach (var m in ((JsonArray)family["members"]!).OfType<JsonObject>())
        {
            var id = Js.Str(m["id"]);
            if (id == null || !StoreRules.PLAYER_ID().IsMatch(id) || ErasedLately(erased, id)) continue;
            rows.Add((id, wallets.ContainsKey(id) ? StoreRules.CleanWallet(wallets[id]).xp : 0, new JsonObject { ["name"] = Js.Copy(m["name"]), ["avatar"] = Js.Copy(m["avatar"]) }));
        }
        return Task.FromResult<List<JsonObject>?>(StoreRules.RankRows(rows, me, int.MaxValue));
    }
    public Task Close() => Task.CompletedTask;
}
