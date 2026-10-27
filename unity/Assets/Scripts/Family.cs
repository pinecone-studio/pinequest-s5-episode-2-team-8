// Family login (as web/js/family.js): the family code a grown-up makes, which lets a child log in on another device with
// their 3 secret pictures and play as the same child there (same coins, XP and clothes). See docs/PROTOCOL.md, "Family login".
using System;
using System.Collections;
using System.Linq;
using System.Text;
using UnityEngine.Networking;

public static class Family
{
#if UNITY_WEBGL && !UNITY_EDITOR
    const string SCHEME = "https://"; // a web page served over https may only call https
#else
    const string SCHEME = "http://";  // node server.js on the local Wi-Fi
#endif
    static string Url(string server) { string s = (server ?? "").Trim().TrimEnd('/'); if (s == "") return null; if (!s.StartsWith("http")) s = SCHEME + s; return s + "/api/family"; }
    static J Fail(string reason) => J.Parse("{\"ok\":false,\"reason\":" + J.Quote(reason) + "}");

    /** POST /api/family. done always gets an object: the server's answer, or { ok: false, reason: "offline" | "no-server" }. */
    public static IEnumerator Post(string server, string body, Action<J> done)
    {
        string url = Url(server);
        if (url == null) { done(Fail("no-server")); yield break; }
        using (var r = new UnityWebRequest(url, "POST"))
        {
            r.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)); r.downloadHandler = new DownloadHandlerBuffer(); r.SetRequestHeader("content-type", "application/json"); r.timeout = 10;
            yield return r.SendWebRequest();
            // a refused request (429, 400) still answers with JSON that says why
            J answer = null; string text = r.downloadHandler != null ? r.downloadHandler.text : "";
            if (!string.IsNullOrEmpty(text) && text.TrimStart().StartsWith("{")) { try { answer = J.Parse(text); } catch (Exception) { answer = null; } }
            done(answer != null && answer.IsObject ? answer : Fail("offline"));
        }
    }

    /** "abcd-2345" → "ABCD2345". */
    public static string Clean(string typed) => new string((typed ?? "").ToUpperInvariant().Where(c => (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')).ToArray());
    public static string Show(string code) => code.Length == 8 ? code.Substring(0, 4) + "-" + code.Substring(4) : code;
    /** A picture password as saved ("0-4-2") → the server's "[0,4,2]", or null. */
    public static string PicsJson(string code)
    {
        var parts = (code ?? "").Split('-');
        if (parts.Length != 3 || parts.Any(p => !int.TryParse(p, out int i) || i < 0 || i > 8)) return null;
        return "[" + string.Join(",", parts.Select(int.Parse)) + "]";
    }
    /** The hosted Naadamy server (Render), built into the app so nobody has to type an address. Empty until it is deployed:
     *  then set it, e.g. "https://naadamy-team8.onrender.com". An address in Settings still wins (a server on the home Wi-Fi). */
    public const string HOSTED = "https://pinequest-s5-episode-2-team-8.onrender.com";
    /** Where this profile reaches the server: its own address, the one this device last used, or the hosted one. "": play alone. */
    public static string ServerOf(Game g, SaveData p)
    {
        if (p != null && !string.IsNullOrWhiteSpace(p.server)) return p.server;
        return !string.IsNullOrWhiteSpace(g.App.server) ? g.App.server : HOSTED;
    }

    public static string Why(J r)
    {
        switch (r["reason"].S)
        {
            case "no-server": return Loc.L("Эхлээд серверийн хаягаа Тохиргоонд бичээрэй.", "Write the server address in Settings first.");
            case "offline": return Loc.L("Сервертэй холбогдож чадсангүй. Хаяг, интернэтээ шалгаарай.", "Could not reach the server. Check the address and the internet.");
            case "no-family": return Loc.L("Ийм гэр бүлийн код олдсонгүй.", "No family has this code.");
            case "full": return Loc.L("Нэг гэр бүлд 8 хүртэл хүүхэд байна.", "A family can have up to 8 children.");
            case "wrong": return Loc.L($"Зураг буруу байна. {r["left"].I} оролдлого үлдлээ.", $"Wrong pictures. {r["left"].I} tries left.");
            case "locked": { int min = Math.Max(1, (r["wait"].I + 59) / 60); return Loc.L($"Олон удаа буруу дарлаа. {min} минутын дараа дахин оролдоорой.", $"Too many wrong tries. Try again in {min} minutes."); }
            case "busy": return Loc.L("Хэт олон оролдлого. Түр хүлээгээрэй.", "Too many tries. Wait a moment.");
            case "no-member": return Loc.L("Энэ хүүхэд гэр бүлд байхгүй байна.", "This child is not in the family.");
            case "identity": return Loc.L("Энэ профайлыг сервер танисангүй.", "The server did not recognise this profile.");
            default: return Loc.L("Алдаа гарлаа. Дахин оролдоорой.", "Something went wrong. Try again.");
        }
    }

    /** Adds a profile (that has its 3 pictures) to this device's family, or makes the family with it. */
    public static IEnumerator Link(Game g, SaveData p, Action<J> done)
    {
        string pics = PicsJson(p.code);
        if (pics == null) { done(Fail("pictures")); yield break; }
        SaveData.EnsureTicket(p); p.Save();
        string server = ServerOf(g, p), code = g.App.familyCode ?? "";
        string body = "{\"act\":" + J.Quote(code == "" ? "create" : "join") + ",\"code\":" + J.Quote(code) + ",\"id\":" + J.Quote(p.id) + ",\"ticket\":" + J.Quote(p.ticket)
            + ",\"name\":" + J.Quote(p.name) + ",\"age\":" + p.age + ",\"avatar\":" + p.avatar + ",\"pics\":" + pics + "}";
        yield return Post(server, body, r =>
        {
            if (r["ok"].B) { g.App.familyCode = r["code"].S; g.App.server = server.Trim(); g.App.Save(); p.fam = r["code"].S; p.Save(); }
            done(r);
        });
    }

    /** A grown-up's change to any child of the family, from this device (which plays as one of its children): new pictures
     *  ("pictures", for a child who forgot them) or taking a child out ("remove"). This device leaves the family when none of
     *  its children are in it any more. */
    public static IEnumerator Manage(Game g, string act, string id, string picsCode, Action<J> done)
    {
        string code = g.App.familyCode ?? "";
        SaveData Kid(string pid) => g.V != null && pid == g.V.id ? g.V : SaveData.Load(pid);
        var me = g.App.profiles.Select(Kid).FirstOrDefault(p => p.fam == code && !string.IsNullOrEmpty(p.ticket));
        if (me == null) { done(Fail("identity")); yield break; }
        string body = "{\"act\":" + J.Quote(act) + ",\"code\":" + J.Quote(code) + ",\"by\":" + J.Quote(me.id) + ",\"ticket\":" + J.Quote(me.ticket) + ",\"id\":" + J.Quote(id)
            + (picsCode != null ? ",\"pics\":" + PicsJson(picsCode) : "") + "}";
        yield return Post(ServerOf(g, me), body, r =>
        {
            if (r["ok"].B && act == "remove")
            {
                foreach (var pid in g.App.profiles) { var p = Kid(pid); if (p.id == id && p.fam != "") { p.fam = ""; p.Save(); } }
                if (r["left"].I == 0 || !g.App.profiles.Any(pid => Kid(pid).fam == code)) { g.App.familyCode = ""; g.App.Save(); }
            }
            done(r);
        });
    }

    /** The child picked on the family list logs in: the profile already on this device, or a new one for this child. */
    public static IEnumerator Login(Game g, string server, string code, string id, string picsCode, Action<J, SaveData> done)
    {
        string body = "{\"act\":\"login\",\"code\":" + J.Quote(code) + ",\"id\":" + J.Quote(id) + ",\"pics\":" + PicsJson(picsCode) + "}";
        yield return Post(server, body, r =>
        {
            if (!r["ok"].B) { done(r, null); return; }
            string pid = r["id"].S; bool known = g.App.profiles.Contains(pid);
            var p = SaveData.Load(pid); // a new child here: the starter wallet, so nothing to upload; the server's wallet arrives on join
            if (!known) { p.name = r["name"].S; p.age = r["age"].I; p.avatar = r["avatar"].I; p.created = SaveData.DayKey(); }
            p.ticket = r["ticket"].S; // this device's own ticket
            p.code = picsCode; p.fam = r["code"].S;
            Cloud.Apply(p, r["cloud"]); // character, lessons, badges… from the other device
            if (string.IsNullOrWhiteSpace(p.server)) p.server = server.Trim();
            p.Save();
            if (!known) g.App.profiles.Add(pid);
            g.App.familyCode = r["code"].S; g.App.server = server.Trim(); g.App.Save();
            done(r, p);
        });
    }
}
