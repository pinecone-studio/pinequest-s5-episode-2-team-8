// Playing together (server.js /ws, like js/village/village.js's net): everyone on the same Wi-Fi with the same room code
// shares one Нутаг. You see each other walk, ride and jump, say phrases and emotes, see each other's gers, and can
// challenge a friend to a live wrestling match. The server address is the one in Settings (the same as Basar AI's).
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public sealed class Net
{
    public const int VERSION = 5;
    public static readonly Tx[] PHRASES =
    {
        new Tx("Сайн уу!", "Hi!"), new Tx("Хамт тоглоё!", "Let's play!"), new Tx("Баярлалаа!", "Thank you!"), new Tx("Энд ир!", "Come here!"),
        new Tx("Саалиа хийе!", "Let's milk!"), new Tx("Уралдъя!", "Let's race!"), new Tx("Загасчилъя!", "Let's fish!"), new Tx("Баяртай!", "Bye!"),
    };
    public static readonly string[] EMOTES = { "👋", "❤️", "😂", "🎉", "👍", "🐎", "😮", "⭐" };

    public sealed class Other { public string id, name; public Look look; public int lvl, dir; public float x, y, px, py, jt = -9; public bool moving; public string bubble; public PxCanvas bubbleIcon; public float bubbleT = -99; }
    public sealed class Lot { public string by, n, roof, door; public int stage; }
    /** A line of the room's chat log: a phrase, an emote, someone arriving or leaving. */
    public sealed class ChatLine { public string k, id, n; public int i; }
    public readonly List<ChatLine> chat = new List<ChatLine>(); public int unread; public bool chatOpen;
    const int CHAT_KEEP = 30;
    void AddChat(Game g, ChatLine l) { chat.Add(l); if (chat.Count > CHAT_KEEP) chat.RemoveRange(0, chat.Count - CHAT_KEEP); if (!chatOpen && (l.k == "p" || l.k == "e") && l.id != g.V.id) unread++; }
    public static string ChatText(ChatLine l) => l.k == "join" ? Loc.L("нутагт ирлээ", "joined the village") : l.k == "leave" ? Loc.L("нутгаас явлаа", "left the village") : l.k == "e" ? null : (l.i >= 0 && l.i < PHRASES.Length ? PHRASES[l.i] : PHRASES[0]).ToString();

    public string status = "solo"; // solo | connecting | online | reconnecting
    public string room = "NUTAG", serverUrl;
    public readonly Dictionary<string, Other> others = new Dictionary<string, Other>();
    public Lot[] lots; public int total, nutag; public bool replaced;
    public bool Online => status == "online";

    ClientWebSocket ws; CancellationTokenSource cts; readonly ConcurrentQueue<string> inbox = new ConcurrentQueue<string>(), outbox = new ConcurrentQueue<string>();
    readonly SemaphoreSlim sendSignal = new SemaphoreSlim(0); int retry; float retryAt = -1; bool closed = true;
    float moveT, lookT; Vector2 sent = new Vector2(-99, -99); string sentLook;

    static string WsUrl(string server)
    {
        string s = (server ?? "").Trim().TrimEnd('/'); if (s == "") return null;
        if (s.StartsWith("https://")) s = "wss://" + s.Substring(8); else if (s.StartsWith("http://")) s = "ws://" + s.Substring(7); else if (!s.StartsWith("ws")) s = "ws://" + s;
        return s + "/ws";
    }
    /** Connect (again) with the current server address and room. No address: play alone. */
    public void Connect(Game g)
    {
        Close(); replaced = false;
        serverUrl = WsUrl(g.V.server); room = string.IsNullOrEmpty(g.V.room) ? "NUTAG" : g.V.room;
        if (serverUrl == null) { status = "solo"; return; }
        closed = false; status = "connecting"; Open(g);
    }
    public void Close()
    {
        closed = true; retryAt = -1;
        try { cts?.Cancel(); } catch (ObjectDisposedException) { }
        var w = ws; ws = null; cts = null;
        if (w != null) Task.Run(async () => { try { await w.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None); } catch (Exception) { } w.Dispose(); });
        others.Clear(); lots = null; if (status != "solo") status = "solo";
        while (inbox.TryDequeue(out _)) { } while (outbox.TryDequeue(out _)) { }
    }
    void Open(Game g)
    {
        var w = new ClientWebSocket(); var c = new CancellationTokenSource(); ws = w; cts = c;
        var V = g.V; string join = Obj("t", "join", "room", room, "id", V.id, "name", V.name) + "," + Raw("look", LookJson(V.look)) + "," + Raw("lvl", Rules.Level(V.xp).l.ToString()) + "," + Raw("x", F2(g.MyX)) + "," + Raw("y", F2(g.MyY)) + "," + Raw("dir", "0");
        string url = serverUrl;
        Task.Run(async () =>
        {
            try
            {
                using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(c.Token)) { timeout.CancelAfter(6000); await w.ConnectAsync(new Uri(url), timeout.Token); }
                outbox.Enqueue("{" + join + "}"); sendSignal.Release();
                var sender = SendLoop(w, c.Token);
                var buf = new byte[16 * 1024]; var sb = new List<byte>();
                while (w.State == WebSocketState.Open && !c.IsCancellationRequested)
                {
                    var r = await w.ReceiveAsync(new ArraySegment<byte>(buf), c.Token);
                    if (r.MessageType == WebSocketMessageType.Close) break;
                    for (int i = 0; i < r.Count; i++) sb.Add(buf[i]);
                    if (r.EndOfMessage) { inbox.Enqueue(Encoding.UTF8.GetString(sb.ToArray())); sb.Clear(); }
                }
            }
            catch (Exception) { /* no server, or the Wi-Fi dropped */ }
            if (ws == w) inbox.Enqueue("{\"t\":\"_closed\"}");
        });
    }
    async Task SendLoop(ClientWebSocket w, CancellationToken tok)
    {
        try
        {
            while (!tok.IsCancellationRequested && w.State == WebSocketState.Open)
            {
                await sendSignal.WaitAsync(tok);
                while (outbox.TryDequeue(out var m)) await w.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(m)), WebSocketMessageType.Text, true, tok);
            }
        }
        catch (Exception) { }
    }
    public void Send(string json) { if (!Online) return; outbox.Enqueue(json); sendSignal.Release(); }

    // ---------------------------------------------------------------- tiny JSON writer
    public static string Q(string s)
    {
        var b = new StringBuilder("\""); foreach (char ch in s ?? "") { if (ch == '"' || ch == '\\') b.Append('\\').Append(ch); else if (ch < 32) b.Append("\\u").Append(((int)ch).ToString("x4")); else b.Append(ch); }
        return b.Append('"').ToString();
    }
    static string F2(float v) => v.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
    static string Raw(string k, string v) => Q(k) + ":" + v;
    static string Obj(params string[] kv) { var b = new List<string>(); for (int i = 0; i < kv.Length; i += 2) b.Add(Q(kv[i]) + ":" + (kv[i + 1] == null ? "null" : Q(kv[i + 1]))); return string.Join(",", b); }
    public static string LookJson(Look l) => "{" + Obj("deel", l.deel, "skin", l.skin, "hat", l.hat, "face", l.face, "neck", l.neck, "pet", l.pet, "title", l.title, "ride", l.ride, "coat", l.coat) + "}";
    static Look LookOf(J j) => j.IsNull ? new Look() : new Look { deel = j["deel"].S ?? "blue", skin = j["skin"].S ?? "#F6D3B3", hat = j["hat"].S, face = j["face"].S, neck = j["neck"].S, pet = j["pet"].S, title = j["title"].S, ride = j["ride"].S, coat = j["coat"].S };
    static Lot LotOf(J j) => j.IsNull ? null : new Lot { by = j["by"].S, n = j["n"].S, roof = j["roof"].S ?? "blue", door = j["door"].S ?? "red", stage = j["stage"].I };
    static ChatLine ChatOf(J j) => new ChatLine { k = j["k"].S, id = j["id"].S, n = j["n"].S, i = j["i"].I };

    // ---------------------------------------------------------------- every frame, on the main thread
    public void Tick(Game g, float dt)
    {
        while (inbox.TryDequeue(out var text)) { J m; try { m = J.Parse(text); } catch (Exception) { continue; } Handle(g, m); }
        if (!closed && ws == null && retryAt > 0 && Time.realtimeSinceStartup > retryAt) { retryAt = -1; status = "reconnecting"; Open(g); }
        foreach (var o in others.Values) // others glide to where the server says they are
        {
            float dx = o.x - o.px, dy = o.y - o.py, d = Mathf.Sqrt(dx * dx + dy * dy); o.moving = d > 0.02f;
            if (d > 6) { o.px = o.x; o.py = o.y; } else { float a = Mathf.Min(1, dt * 10); o.px += dx * a; o.py += dy * a; }
        }
        if (!Online || g.V == null) return;
        moveT += dt; lookT += dt;
        var me = new Vector2(g.MyX, g.MyY); float moved = (me - sent).magnitude;
        if ((moveT > 0.1f && moved > 0.03f) || (moved > 0.001f && moveT > 0.4f)) { moveT = 0; sent = me; Send("{" + Obj("t", "move") + "," + Raw("x", F2(me.x)) + "," + Raw("y", F2(me.y)) + "," + Raw("dir", g.MyDir.ToString()) + "}"); }
        if (lookT > 1.5f) { lookT = 0; var l = g.V.look.Copy(); l.ride = g.MyRiding ? "horse" : null; if (l.ride != null) l.coat = g.V.horse.coat; string lj = LookJson(l); if (lj != sentLook) { sentLook = lj; Send("{" + Obj("t", "look") + "," + Raw("look", lj) + "," + Raw("lvl", Rules.Level(g.V.xp).l.ToString()) + "}"); } }
    }
    void AddOther(J p) { var o = new Other { id = p["id"].S, name = p["name"].S, look = LookOf(p["look"]), lvl = p["lvl"].I, x = p["x"].F, y = p["y"].F, dir = p["dir"].I }; o.px = o.x; o.py = o.y; others[o.id] = o; }
    void Handle(Game g, J m)
    {
        string t = m["t"].S;
        switch (t)
        {
            case "_closed":
                ws = null; bool was = Online; others.Clear(); lots = null; g.EndRemoteMatch();
                if (closed) { status = "solo"; return; }
                if (replaced) { status = "solo"; closed = true; return; }
                status = "reconnecting"; retryAt = Time.realtimeSinceStartup + Mathf.Min(10, 1.5f * ++retry);
                if (was) g.Toast(Loc.L("Сервертэй холболт тасарлаа. Дахин холбогдож байна…", "Lost the server. Reconnecting…"));
                return;
            case "welcome":
                status = "online"; retry = 0; room = m["room"].S; others.Clear(); foreach (var p in m["players"]) AddOther(p);
                lots = m["lots"].Select(LotOf).ToArray(); if (lots.Length < Rules.LOTS) Array.Resize(ref lots, Rules.LOTS);
                sentLook = null; lookT = 99; sent = new Vector2(-99, -99);
                g.Toast(Loc.L("Нутагт холбогдлоо", "Connected to the village") + " · " + room + (others.Count > 0 ? " · " + others.Count + Loc.L(" найз байна", " friends here") : ""));
                if (m["v"].I != VERSION) g.Toast(Loc.L("Сервер хуучин хувилбартай байна. Серверийг дахин асаагаарай.", "The server runs an old version. Please restart it."));
                chat.Clear(); foreach (var c in m["chat"]) chat.Add(ChatOf(c)); if (chat.Count > CHAT_KEEP) chat.RemoveRange(0, chat.Count - CHAT_KEEP);
                g.GerSync(); // my ger, started while playing alone, comes along to a free plot
                return;
            case "join": AddOther(m["p"]); AddChat(g, new ChatLine { k = "join", id = m["p"]["id"].S, n = m["p"]["name"].S }); g.Toast(m["p"]["name"].S + Loc.L(" нутагт ирлээ", " joined the village")); return;
            case "leave": if (others.TryGetValue(m["id"].S, out var gone)) AddChat(g, new ChatLine { k = "leave", id = gone.id, n = gone.name }); others.Remove(m["id"].S); return;
            case "move": if (others.TryGetValue(m["id"].S, out var om)) { om.x = m["x"].F; om.y = m["y"].F; om.dir = m["dir"].I; } return;
            case "jump": if (others.TryGetValue(m["id"].S, out var oj)) oj.jt = Time.time; return;
            case "look": if (others.TryGetValue(m["id"].S, out var ol)) { ol.look = LookOf(m["look"]); ol.lvl = m["lvl"].I; } return;
            case "say":
            {
                int i = m["i"].I; bool emote = m["k"].S == "e"; string id = m["id"].S;
                string text = emote ? null : i >= 0 && i < PHRASES.Length ? PHRASES[i].ToString() : ""; PxCanvas icon = emote && i >= 0 && i < EMOTES.Length ? Emo.Icon(EMOTES[i]) : null;
                if (id == g.V.id) { g.MyBubble(text, icon); AddChat(g, new ChatLine { k = emote ? "e" : "p", id = id, n = g.V.name, i = i }); }
                else if (others.TryGetValue(id, out var os)) { os.bubble = text; os.bubbleIcon = icon; os.bubbleT = Time.time; AddChat(g, new ChatLine { k = emote ? "e" : "p", id = id, n = os.name, i = i }); }
                return;
            }
            case "census": { bool first = total == 0 && nutag == 0; total = m["total"].I; nutag = m["nutag"].I; int away = total - others.Count - 1; if (first && away > 0 && others.Count == 0 && room != "NUTAG" && nutag > 0) g.Toast(Loc.L($"Үндсэн Нутагт {nutag} хүн тоглож байна. Өрөөний товчоор нэгдээрэй.", $"{nutag} people are playing in the main village. Use the room button to join them.")); return; }
            case "lot":
            {
                int i = m["i"].I; var l = LotOf(m["lot"]); if (lots != null && i >= 0 && i < lots.Length) lots[i] = l;
                if (l != null && l.by != g.V.id && m["act"].S == "claim") g.Toast(l.n + Loc.L(" гэр барьж эхэллээ!", " started building a ger!"));
                else if (l != null && l.by != g.V.id && m["act"].S == "stage" && l.stage >= GerRules.DONE) g.Toast(l.n + Loc.L(" гэрээ барьж дууслаа!", " finished building their ger!"));
                return;
            }
            case "deny": g.Toast(m["why"].S == "own" ? Loc.L("Танд аль хэдийн гэр байна!", "You already have a ger!") : m["why"].S == "taken" ? Loc.L("Энэ газрыг өөр хүн авчихсан байна.", "Someone else already took this lot.") : m["why"].S == "busy" ? Loc.L("Тэр одоо завгүй байна.", "They are busy right now.") : Loc.L("Болохгүй байна.", "Not possible.")); return;
            case "replaced": replaced = true; closed = true; status = "solo"; others.Clear(); g.Toast(Loc.L("Энэ профайл өөр төхөөрөмж дээр нээгдлээ. Тэнд үргэлжлүүлэн тоглоорой.", "This profile was opened on another device. Keep playing there.")); return;
            case "error": g.Toast(Loc.L("Өрөөнд нэвтэрч чадсангүй.", "Could not join the room.")); return;
            case "wr-invite": case "wr-declined": case "wr-start": case "wr-wait": case "wr-result": case "wr-end": g.OnWrestleMsg(m); return;
        }
    }
    public void Say(bool emote, int i) => Send("{" + Obj("t", "say", "k", emote ? "e" : "p") + "," + Raw("i", i.ToString()) + "}");
    public void Jumped() => Send("{" + Obj("t", "jump") + "}");
    /** Laying the floor claims a plot; a ger already part-way up brings its stage along. */
    public void GerClaim(int i, string roof, string door, int stage) => Send("{" + Obj("t", "ger-claim") + "," + Raw("i", i.ToString()) + "," + Obj("roof", roof ?? "blue", "door", door ?? "red") + "," + Raw("stage", stage.ToString()) + "}");
    public void GerStage(int stage) => Send("{" + Obj("t", "ger-stage") + "," + Raw("stage", stage.ToString()) + "}");
    public void StyleGer(string roof, string door, List<string> furn) => Send("{" + Obj("t", "ger-style", "roof", roof, "door", door) + "," + Raw("furn", "[" + string.Join(",", (furn ?? new List<string>()).Select(Q)) + "]") + "}");
    public void Wr(string t, string key, string val) => Send("{" + Obj("t", t, key, val) + "}");
    public void WrMove(string move, float p) => Send("{" + Obj("t", "wr-move", "m", move) + "," + Raw("p", F2(p)) + "}");
}

public sealed partial class Game
{
    public readonly Net net = new Net();
    public float MyX => px; public float MyY => py; public int MyDir => dir; public bool MyRiding => riding;
    (string text, PxCanvas icon, float t) myBubble = (null, null, -99);
    public void MyBubble(string text, PxCanvas icon) => myBubble = (text, icon, Time.time);
    /** A lot someone else owns on the server (their ger stands there). */
    Net.Lot LotOf(int i) => net.Online && net.lots != null && i >= 0 && i < net.lots.Length && net.lots[i] != null && net.lots[i].by != V.id ? net.lots[i] : null;

    void NetDraw()
    {
        float t = Time.time;
        if (net.lots != null) for (int i = 0; i < net.lots.Length; i++) { var l = LotOf(i); if (l == null) continue; var o = World.objects.Find(q => q.kind == "lot" && q.i == i); if (o != null) Spr(Px.GerStage(l.stage > 0 ? l.stage : GerRules.DONE, Px.ROOF.TryGetValue(l.roof, out var r) ? r : Px.ROOF["blue"], Px.DOOR.TryGetValue(l.door, out var d) ? d : Px.DOOR["red"]), o.x * T, o.y * T - 2, false, o.y + 2); }
        foreach (var o in net.others.Values)
        {
            float jq = (t - o.jt) / JUMP_S, z = jq >= 0 && jq < 1 ? Mathf.Round(Mathf.Sin(jq * Mathf.PI) * 9) : 0; var look = o.look ?? new Look();
            if (look.ride == "horse") Rider(look, o.dir == 1 ? 1 : 2, o.moving, o.px, o.py, o.py, z);
            else { Shadow(o.px * T, o.py * T, o.py); var lk = look.Copy(); lk.pet = null; Spr(Px.Char(lk, o.dir, z != 0 ? 0 : Frame(o.moving, false)), o.px * T, o.py * T - 12 - z, false, o.py); }
        }
    }
    void NetLabels(float ts)
    {
        float t = Time.time; Color gold = Px.Col("#f7c646");
        if (net.lots != null) for (int i = 0; i < net.lots.Length; i++) { var l = LotOf(i); if (l == null) continue; var o = World.objects.Find(q => q.kind == "lot" && q.i == i); if (o == null) continue; var p = PxGui(o.x * T + 24, o.y * T - 4); Outlined(p.x, p.y, l.n ?? "", ts * 0.85f, Color.white); }
        foreach (var o in net.others.Values)
        {
            var p = PxGui(o.px * T + 8, o.py * T - (o.look?.ride == "horse" ? 30 : 16)); Outlined(p.x, p.y, o.name + "  " + Loc.L("Т", "Lv") + o.lvl, ts * 0.8f, Color.white);
            if (t - o.bubbleT < 4) Bubble(p.x, p.y - ts * 2.2f, o.bubble, o.bubbleIcon);
        }
        if (t - myBubble.t < 4) { var p = PxGui(px * T + 8, py * T - (riding ? 44 : 30)); Bubble(p.x, p.y, myBubble.text, myBubble.icon); }
    }
    void Bubble(float x, float y, string text, PxCanvas icon)
    {
        float w = icon != null ? U(34) : Mathf.Max(U(40), sLabel.CalcSize(new GUIContent(text)).x + U(16)), h = U(30);
        var r = new Rect(x - w / 2, y - h, w, h); Box(new Rect(r.x - 2, r.y - 2, r.width + 4, r.height + 4), Px.Col("#2b1e2e")); Box(r, Color.white);
        if (icon != null) GUI.DrawTexture(new Rect(r.center.x - U(11), r.y + U(4), U(22), U(22)), Tex(icon)); else GUI.Label(r, "<color=#2b1e2e><b>" + text + "</b></color>", sCenter);
    }

    // ---------------------------------------------------------------- the room window: who's here, phrases and emotes, a wrestling challenge
    public sealed class RoomModal : Modal
    {
        string code;
        public override void Draw(Game g)
        {
            var n = g.net; code ??= n.room;
            g.Title(Loc.L("Хамт тоглох өрөө", "Play-together room"));
            if (string.IsNullOrEmpty(g.V.server)) { g.Text(Loc.L("Компьютер дээр “node server.js” ажиллуулаад, Тохиргоонд түүний хаягийг бичвэл нэг Wi-Fi-д байгаа найзуудтайгаа хамт тоглоно.", "Run “node server.js” on a computer and write its address in Settings to play with friends on the same Wi-Fi.")); if (g.Btn(Loc.L("Тохиргоо", "Settings"), true, 40)) g.Later(() => g.Swap(new SettingsModal())); }
            if (!string.IsNullOrEmpty(g.V.server))
            {
                g.Small(n.Online ? Loc.L($"“{n.room}” өрөөнд {n.others.Count + 1} хүн байна. Ижил кодтой хүмүүс нэг нутагт хамт тоглоно.", $"{n.others.Count + 1} people in room “{n.room}”. Everyone with the same code plays in one village.")
                    : n.status == "solo" ? Loc.L("Сервертэй холбогдоогүй байна.", "Not connected to the server.") : Loc.L("Холбогдож байна…", "Connecting…"));
                GUILayout.BeginHorizontal();
                code = GUILayout.TextField(code ?? "", 8, new GUIStyle(g.sBtn) { alignment = TextAnchor.MiddleCenter }, GUILayout.MinHeight(g.U(40))).ToUpperInvariant();
                if (GUILayout.Button(Loc.L("Нэгдэх", "Join"), g.sPrimary, GUILayout.Width(g.U(100)), GUILayout.MinHeight(g.U(40)))) g.Later(() =>
                {
                    string c = (code ?? "").Trim().ToUpperInvariant(); if (c.Length < 3 || c.Length > 8 || !c.All(ch => (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'))) { g.Toast(Loc.L("Код 3-8 латин үсэг, тоо байна.", "The code is 3-8 letters or digits.")); return; }
                    g.V.room = c; g.V.Save(); n.Connect(g);
                });
                GUILayout.EndHorizontal();
                if (n.status == "solo" && g.Btn(Loc.L("Дахин холбогдох", "Connect again"), false, 34)) g.Later(() => n.Connect(g));
            }
            n.chatOpen = true; n.unread = 0;
            if (n.Online) // the room's recent chat sits on top of the phrases, so reading and answering is one window
            {
                GUILayout.BeginVertical(g.sBtn);
                if (n.chat.Count == 0) g.Small(Loc.L("Одоохондоо мессеж алга.", "No messages yet."));
                foreach (var l in n.chat.Skip(Math.Max(0, n.chat.Count - 8)))
                {
                    GUILayout.BeginHorizontal(); string txt = Net.ChatText(l);
                    GUILayout.Label("<b>" + l.n + "</b> " + (l.k == "join" || l.k == "leave" ? "<color=#9a8a7a>" + txt + "</color>" : txt ?? ""), g.sLabel);
                    if (l.k == "e" && l.i >= 0 && l.i < Net.EMOTES.Length) { var ic = Emo.Icon(Net.EMOTES[l.i]); if (ic != null) g.IconAt(ic, 22); }
                    GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
                }
                GUILayout.EndVertical();
            }
            GUILayout.Label("<b>" + Loc.L("Хэлэх", "Say") + "</b>", g.sLabel);
            for (int row = 0; row < 2; row++)
            {
                GUILayout.BeginHorizontal();
                for (int i = row * 4; i < row * 4 + 4; i++) { if (GUILayout.Button(Net.PHRASES[i].ToString(), g.sBtn, GUILayout.MinHeight(g.U(34)))) { int k = i; g.Later(() => { if (n.Online) n.Say(false, k); else g.MyBubble(Net.PHRASES[k].ToString(), null); }); } }
                GUILayout.EndHorizontal();
            }
            GUILayout.BeginHorizontal();
            for (int i = 0; i < Net.EMOTES.Length; i++) { var r = GUILayoutUtility.GetRect(g.U(40), g.U(40), GUILayout.Width(g.U(40))); if (GUI.Button(r, "", g.sBtn)) { int k = i; g.Later(() => { if (n.Online) n.Say(true, k); else g.MyBubble(null, Emo.Icon(Net.EMOTES[k])); }); } var ic = Emo.Icon(Net.EMOTES[i]); if (ic != null) GUI.DrawTexture(new Rect(r.x + 6, r.y + 6, r.width - 12, r.height - 12), g.Tex(ic)); }
            GUILayout.EndHorizontal();
            if (!n.Online) return;
            GUILayout.Label("<b>" + Loc.L("Энд байгаа найзууд", "Friends here") + "</b>", g.sLabel);
            if (n.others.Count == 0) g.Small(Loc.L("Одоохондоо ганцаараа байна. Найздаа өрөөний кодоо хэлээрэй!", "Nobody else yet. Tell your friends the room code!"));
            foreach (var o in n.others.Values.ToList())
            {
                g.Row(Px.Char(o.look ?? new Look(), 0, 0), o.name, Loc.L("Түвшин ", "Level ") + o.lvl);
                if (g.SmallBtn(Loc.L("Барилдах", "Wrestle"), false, 100)) { var id = o.id; g.Later(() => { n.Wr("wr-invite", "to", id); g.Toast(Loc.L("Урилга илгээлээ!", "Challenge sent!")); }); }
                g.EndRow();
            }
        }
        public override void Press(Game g) { }
        public override void Closed(Game g) { g.net.chatOpen = false; }
    }

    // ---------------------------------------------------------------- live wrestling with a friend: both pick a move and power, the server decides
    RemoteWrestle remote;
    public void OnWrestleMsg(J m)
    {
        string t = m["t"].S;
        if (t == "wr-invite") { string from = m["from"].S, name = m["name"].S; Open(new ConfirmModal(Loc.L("Барилдах урилга!", "Wrestling challenge!"), name + Loc.L(" тантай барилдахыг хүсэж байна.", " wants to wrestle you."), () => net.Wr("wr-accept", "from", from)) { onNo = () => net.Wr("wr-decline", "from", from) }); Sfx.Chime(); }
        else if (t == "wr-declined") Toast(m["name"].S + Loc.L(" одоохондоо барилдахгүй гэлээ.", " declined for now."));
        else if (t == "wr-start")
        {
            bool a = m["a"]["id"].S == V.id; var opp = a ? m["b"] : m["a"];
            CloseAll(); remote = new RemoteWrestle { id = m["id"].S, side = a ? "a" : "b", opp = opp["name"].S, oppLook = opp["look"].IsNull ? new Look() : new Look { deel = opp["look"]["deel"].S ?? "blue", skin = opp["look"]["skin"].S ?? "#D9A06E" } };
            Open(remote);
        }
        else remote?.OnMsg(this, m);
    }
    public void EndRemoteMatch() { if (remote != null) { remote.OnMsg(this, J.Parse("{\"t\":\"wr-end\",\"winner\":null,\"reason\":\"disconnected\"}")); } }
    public sealed class RemoteWrestle : Modal
    {
        public string id, side, opp; public Look oppLook;
        string phase = "pick", move, last; float t0, power; int me, them; bool won, done;
        public override bool CanEscape => false;
        public override void Tick(Game g, float dt) { }
        public void OnMsg(Game g, J m)
        {
            string t = m["t"].S;
            if (t == "wr-wait") { if (phase == "pick" || phase == "power") Sfx.Pop(); }
            else if (t == "wr-result")
            {
                bool a = side == "a"; string mm = a ? m["ma"].S : m["mb"].S, mo = a ? m["mb"].S : m["ma"].S; int res = m["r"].I * (a ? 1 : -1);
                me = a ? m["score"]["a"].I : m["score"]["b"].I; them = a ? m["score"]["b"].I : m["score"]["a"].I;
                last = Loc.L("Чи: ", "You: ") + Rules.MoveById(mm).name + " · " + opp + ": " + Rules.MoveById(mo).name + "\n" + (res > 0 ? Loc.L("Чи энэ даваанд яллаа!", "You won this round!") : res < 0 ? Loc.L($"{opp} энэ даваанд яллаа.", $"{opp} won this round.") : Loc.L("Тэнцлээ.", "A draw."));
                if (res > 0) Sfx.Good(); else if (res < 0) Sfx.Bad();
                phase = "pick"; move = null;
            }
            else if (t == "wr-end")
            {
                if (done) return; done = true; g.remote = null; won = m["winner"].S == g.V.id; string why = m["reason"].S;
                var wr = g.V.wr; if (won) { wr.pvpW++; g.Reward(25, 30); Sfx.Win(); g.Confetti(80); } else if (m["winner"].S != null) { wr.pvpL++; g.Reward(0, 10); }
                g.V.Save(); g.CheckAchievements();
                phase = "end"; last = why == "left" || why == "disconnected" ? Loc.L("Барилдаан тасарлаа.", "The match was interrupted.") : won ? Loc.L("Чи яллаа! Бүргэд шиг дэв!", "You won! Do the eagle dance!") : Loc.L($"{opp} яллаа. Дараагийн удаа!", $"{opp} won. Next time!");
            }
        }
        public override void Draw(Game g)
        {
            g.Title(Loc.L("Найзтайгаа барилдах", "Wrestling a friend"));
            GUILayout.BeginHorizontal(); g.IconAt(Px.Char(g.V.look, 0, 0), 48); GUILayout.Label($"<b>{me} : {them}</b>", new GUIStyle(g.sBig) { alignment = TextAnchor.MiddleCenter }); g.IconAt(Px.Char(oppLook, 0, 0), 48); GUILayout.EndHorizontal();
            g.Small(Loc.L($"Хоёр даваа түрүүлж авсан нь ялна · {opp}", $"First to two rounds wins · {opp}"));
            if (last != null) g.Fact(last, true);
            if (phase == "end") { if (g.Btn(Loc.L("Хаах", "Close"), true, 44)) g.Later(g.Close); return; }
            if (phase == "pick")
            {
                g.Text(Loc.L("Мэхээ сонго:", "Pick your move:"));
                foreach (var mv in Rules.MOVES) if (g.Btn(mv.name.ToString(), false, 38)) { var id2 = mv.id; g.Later(() => { move = id2; phase = "power"; t0 = Time.time; }); }
            }
            else if (phase == "power")
            {
                // tap when the needle is in the green: that is your move's strength
                float q = Mathf.PingPong((Time.time - t0) * 1.4f, 1); power = 1 - Mathf.Abs(q - 0.5f) * 2;
                var r = GUILayoutUtility.GetRect(10, g.U(26), GUILayout.ExpandWidth(true));
                g.Box(r, Px.Col("#2b1e2e")); g.Box(new Rect(r.x + r.width * 0.35f, r.y + 2, r.width * 0.3f, r.height - 4), Px.Col("#2ea35f")); g.Box(new Rect(r.x + r.width * q - 2, r.y - 3, 4, r.height + 6), Px.Col("#f7c646"));
                if (g.Btn(Loc.L("Одоо!", "Now!"), true, 48)) g.Later(() => { g.net.WrMove(move, power); phase = "wait"; Sfx.Tap(); });
            }
            else g.Text(Loc.L($"{opp} мэхээ сонгож байна…", $"Waiting for {opp}…"));
            if (g.Btn(Loc.L("Бууж өгөх", "Give up"), false, 30)) g.Later(() => { g.net.Send("{\"t\":\"wr-quit\"}"); });
        }
        public override void Press(Game g) { }
    }
}
