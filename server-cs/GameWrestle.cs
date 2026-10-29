// Live wrestling between two players in a room: invite, accept, a move each a round (best of three), quit. The server pays
// both players at the end (winner 25 coins and 30 XP, the other 10 XP), counted against the daily earn cap.
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Naadamy.Server;

public sealed partial class Game
{
    const long ROUND_MS = 25000;
    static readonly Regex MATCH_ID = new(@"^w[\w-]{1,64}$");

    void OnWrestle(Conn conn, Player p, Room r, string type, JsonObject m)
    {
        switch (type)
        {
            case "wr-invite":
            {
                r.players.TryGetValue(Js.Text(m["to"]), out var to);
                if (to == null || to == p || to.match != null || p.match != null) { conn.Send(Deny()); return; }
                (to.invites ??= new()).Add(p.id);
                to.conn.Send(new JsonObject { ["t"] = "wr-invite", ["from"] = p.id, ["name"] = p.name });
                break;
            }
            case "wr-decline":
            {
                var fromId = Js.Text(m["from"]);
                r.players.TryGetValue(fromId, out var from); p.invites?.Remove(fromId);
                from?.conn.Send(new JsonObject { ["t"] = "wr-declined", ["by"] = p.id, ["name"] = p.name });
                break;
            }
            case "wr-accept":
            {
                r.players.TryGetValue(Js.Text(m["from"]), out var from);
                if (from == null || p.invites == null || !p.invites.Contains(from.id) || from.match != null || p.match != null) { conn.Send(Deny()); return; }
                p.invites.Remove(from.id);
                var id = "w" + Base36.Of(Js.Now) + Random.Shared.Next(36 * 36 * 36 * 36).ToString36(4);
                var match = new Match { id = id, a = from.id, b = p.id };
                r.matches[id] = match; from.match = p.match = id;
                JsonObject Info(Player q) => new() { ["id"] = q.id, ["name"] = q.name, ["look"] = q.look.DeepClone() };
                foreach (var q in new[] { from, p }) q.conn.Send(new JsonObject { ["t"] = "wr-start", ["id"] = id, ["a"] = Info(from), ["b"] = Info(p) });
                ArmMatch(r, match);
                break;
            }
            case "wr-move":
            {
                if (p.match == null || !r.matches.TryGetValue(p.match, out var match)) return;
                bool sideA = match.a == p.id;
                var move = Js.Str(m["m"]);
                if ((sideA ? match.moveA : match.moveB) != null || move == null || !Rules.MOVES.Contains(move)) return;
                double power = Math.Max(0, Math.Min(1, Js.Num(m["p"]) ?? 0));
                if (sideA) match.moveA = (move, power); else match.moveB = (move, power);
                if (r.players.TryGetValue(sideA ? match.b : match.a, out var other)) other.conn.Send(new JsonObject { ["t"] = "wr-wait" });
                if (match.moveA != null && match.moveB != null) ResolveMatch(r, match);
                break;
            }
            case "wr-quit":
            {
                if (p.match == null || !r.matches.TryGetValue(p.match, out var match)) return;
                EndMatch(r, match, match.a == p.id ? match.b : match.a, "left");
                break;
            }
        }
        static JsonObject Deny() => new() { ["t"] = "deny", ["act"] = "wr", ["why"] = "busy" };
    }
    void ArmMatch(Room r, Match match)
    {
        match.timer?.Dispose();
        match.timer = Loop.After(ROUND_MS, () => // a player who never answers gets a weak random move
        {
            if (!r.matches.ContainsKey(match.id)) return;
            match.moveA ??= (Rules.MOVES[Random.Shared.Next(Rules.MOVES.Length)], 0.15);
            match.moveB ??= (Rules.MOVES[Random.Shared.Next(Rules.MOVES.Length)], 0.15);
            ResolveMatch(r, match);
        });
    }
    void ResolveMatch(Room r, Match match)
    {
        var (ma, pa) = match.moveA!.Value; var (mb, pb) = match.moveB!.Value;
        int res = Rules.Exchange(ma, pa, mb, pb);
        if (res > 0) match.scoreA++; else if (res < 0) match.scoreB++;
        match.played++; // draws count too: they were played
        match.moveA = match.moveB = null;
        foreach (var id in new[] { match.a, match.b })
            if (r.players.TryGetValue(id, out var q)) q.conn.Send(new JsonObject { ["t"] = "wr-result", ["ma"] = ma, ["pa"] = pa, ["mb"] = mb, ["pb"] = pb, ["r"] = res, ["score"] = match.Score() });
        if (match.scoreA >= 2 || match.scoreB >= 2) EndMatch(r, match, match.scoreA > match.scoreB ? match.a : match.b, "");
        else ArmMatch(r, match);
    }
    void EndMatch(Room r, Match match, string winner, string reason)
    {
        match.timer?.Dispose(); r.matches.Remove(match.id);
        var message = new JsonObject { ["t"] = "wr-end", ["id"] = match.id, ["winner"] = winner, ["playerIds"] = new JsonArray(match.a, match.b), ["reason"] = reason, ["rounds"] = match.played };
        foreach (var id in new[] { match.a, match.b }) if (r.players.TryGetValue(id, out var q)) { q.match = null; q.conn.Send((JsonObject)message.DeepClone()); }
        AwardWrestlingResult(r, match.id, winner, match.a, match.b, reason, match.played);
    }
    void AwardWrestlingResult(Room r, string matchId, string winner, string a, string b, string reason, int rounds)
    {
        if (reason == "left" && rounds == 0) return; // quit before any round was played: nobody is paid
        if (!MATCH_ID.IsMatch(matchId) || (winner != a && winner != b)) return;
        foreach (var id in new[] { a, b }) if (r.players.TryGetValue(id, out var player)) _ = GrantWrestlingReward(player, matchId, id == winner);
    }
    async Task GrantWrestlingReward(Player player, string matchId, bool won)
    {
        var operation = "wrestle:" + matchId;
        long coins = won ? 25 : 0, xp = won ? 30 : 10;
        var conn = player.conn;
        try
        {
            var outcome = await store.MutateWallet(player.id, operation, (wallet, _, earned) =>
            {
                var limit = new WalletChange { Result = new JsonObject { ["accepted"] = false, ["reason"] = "limit" } };
                if (wallet.coins > WALLET_MAX - coins || wallet.xp > WALLET_MAX - xp) return limit;
                // like an uploaded sync, wrestling pay counts toward the daily earn cap; what goes over is not paid
                var day = VillageDay();
                var today = earned.d == day ? earned : new Earned(day, 0, 0);
                long addCoins = Math.Max(0, Math.Min(coins, Rules.DAILY_EARN_CAP.coins - today.coins)), addXp = Math.Max(0, Math.Min(xp, Rules.DAILY_EARN_CAP.xp - today.xp));
                if (addCoins == 0 && addXp == 0) return limit;
                return new WalletChange
                {
                    Changed = true, Wallet = (wallet.coins + addCoins, wallet.xp + addXp), Earned = new Earned(day, today.coins + addCoins, today.xp + addXp),
                    Result = new JsonObject { ["accepted"] = true },
                };
            });
            conn.wallet = outcome.wallet; conn.inventory = outcome.inventory;
            SyncPlayerLevel(conn);
            conn.Send(With(new JsonObject { ["t"] = "wallet-result", ["op"] = operation }, outcome.result).Also(o => o["wallet"] = WalletJson(outcome.wallet)));
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not grant server-validated wrestling reward: " + e.Message);
            conn.Send(new JsonObject { ["t"] = "wallet-result", ["op"] = operation, ["accepted"] = false, ["reason"] = "storage", ["wallet"] = WalletJson(conn.wallet) });
        }
    }
}

static class Base36
{
    const string D = "0123456789abcdefghijklmnopqrstuvwxyz";
    public static string Of(long n) { var s = ""; do { s = D[(int)(n % 36)] + s; n /= 36; } while (n > 0); return s; }
    public static string ToString36(this int n, int width)
    {
        var s = "";
        for (int i = 0; i < width; i++) { s = D[n % 36] + s; n /= 36; }
        return s;
    }
}
