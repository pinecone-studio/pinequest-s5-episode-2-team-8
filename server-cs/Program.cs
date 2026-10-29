// Naadamy server: serves the game and links players into a shared village (Нутаг). The C# port of server/server.js; it keeps
// its data in JSON files in DATA_DIR (PostgreSQL storage is not ported yet).
//
// Run:  dotnet run --project server-cs            (port 8000)
//       PORT=3000 dotnet run --project server-cs
// Everyone on the same Wi-Fi opens http://<this-computer-ip>:8000 and plays together.
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Naadamy.Server;

static int PosInt(string? v, int d) => Regex.IsMatch((v ?? "").Trim(), @"^[1-9]\d*$") && int.TryParse(v!.Trim(), out var n) ? n : d;
static string FindRepo()
{
    for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        if (Directory.Exists(Path.Combine(d.FullName, "server-cs")) && Directory.Exists(Path.Combine(d.FullName, "unity"))) return d.FullName;
    return Directory.GetCurrentDirectory();
}

var REPO = FindRepo(); // data/ stays in the repo root
var UNITY_WEB = Path.Combine(REPO, "unity", "Builds", "WebGL"); // Unity's browser build (Naadamy → Build WebGL)
// Only Unity's built game is ever served as files. Without a build (on Render) only the API and /ws answer.
string? ROOT = File.Exists(Path.Combine(UNITY_WEB, "index.html")) ? Path.GetFullPath(UNITY_WEB) : null;
bool PRODUCTION = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RENDER")) || Environment.GetEnvironmentVariable("NODE_ENV") == "production";
int PORT = int.TryParse(Environment.GetEnvironmentVariable("PORT") ?? (args.Length > 0 ? args[0] : null), out var portArg) ? portArg : 8000;
var DATA_DIR = Environment.GetEnvironmentVariable("DATA_DIR") is { Length: > 0 } dd ? dd : Path.Combine(REPO, "data");
int WS_MAX_PER_IP = PosInt(Environment.GetEnvironmentVariable("WS_MAX_PER_IP"), 200), WS_NEW_PER_MIN = PosInt(Environment.GetEnvironmentVariable("WS_NEW_PER_MIN"), 300), WS_MAX_TOTAL = PosInt(Environment.GetEnvironmentVariable("WS_MAX_TOTAL"), 2000);
int HEARTBEAT_MS = PosInt(Environment.GetEnvironmentVariable("HEARTBEAT_MS"), 20000); // a phone that drops off Wi-Fi without saying goodbye is removed after a missed ping
const int MAX_PAYLOAD = 16 * 1024;
var EXTRA_ORIGINS = (Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "").Split(',').Select(o => o.Trim()).Where(o => o.Length > 0).ToHashSet();
// Which web pages may call the API: the game on Vercel (and its preview deployments), a computer on this network while
// developing, and any extra origins in CORS_ORIGINS. Every other site's page is refused by the browser.
bool OriginAllowed(string o) => Regex.IsMatch(o, @"^https://naadamy-unity(-[a-z0-9-]+)?\.vercel\.app$") || Regex.IsMatch(o, @"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$") || EXTRA_ORIGINS.Contains(o);
const string CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' https: wss: ws: blob: data:; " +
    "img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
var TYPES = new Dictionary<string, string>
{
    [".html"] = "text/html; charset=utf-8", [".js"] = "text/javascript; charset=utf-8", [".mjs"] = "text/javascript; charset=utf-8", [".css"] = "text/css; charset=utf-8",
    [".svg"] = "image/svg+xml", [".woff2"] = "font/woff2", [".ttf"] = "font/ttf", [".webmanifest"] = "application/manifest+json", [".json"] = "application/json", [".txt"] = "text/plain; charset=utf-8", [".png"] = "image/png",
    [".m4a"] = "audio/mp4", [".mp3"] = "audio/mpeg", [".ogg"] = "audio/ogg", [".wav"] = "audio/wav", [".wasm"] = "application/wasm", [".data"] = "application/octet-stream",
};
static List<string> LanIPs() => NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
    .SelectMany(n => n.GetIPProperties().UnicastAddresses).Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(a.Address)).Select(a => a.Address.ToString()).ToList();

IRoomStore store = new JsonRoomStore(DATA_DIR);
var game = new Game(store);
try { await Loop.Run(async () => { await game.Start(); return true; }); }
catch (Exception e) { Console.Error.WriteLine("Could not initialize room storage: " + e.Message); return 1; }

// ---------------------------------------------------------------- WebSocket caps
// one address (a whole classroom can share a school's) may hold only so many game connections, and open only so many a minute;
// the whole server holds only so many. A phone whose Wi-Fi vanished keeps its old slot until the missed ping.
var capLock = new object();
var wsOpen = new Dictionary<string, int>(); var wsNew = new Dictionary<string, List<long>>(); var wsLogged = new HashSet<string>(); int openTotal = 0;
bool WsAllowed(string ip)
{
    lock (capLock)
    {
        long now = Js.Now;
        var h = (wsNew.TryGetValue(ip, out var l) ? l : new List<long>()).Where(t => now - t < 60000).ToList();
        int open = wsOpen.GetValueOrDefault(ip);
        if (open >= WS_MAX_PER_IP || h.Count >= WS_NEW_PER_MIN)
        {
            wsNew[ip] = h;
            if (wsLogged.Count < 1000 && wsLogged.Add(ip)) Console.Error.WriteLine($"ws cap hit {ip} {open}"); // once per address a minute
            return false;
        }
        h.Add(now); wsNew[ip] = h; wsOpen[ip] = open + 1;
        return true;
    }
}
void WsFreed(string ip)
{
    lock (capLock) { int n = wsOpen.GetValueOrDefault(ip, 1) - 1; if (n > 0) wsOpen[ip] = n; else wsOpen.Remove(ip); }
}
var forget = new Timer(_ => // off the hot path: forget addresses with nothing open and nothing in the last minute
{
    lock (capLock)
    {
        long now = Js.Now;
        foreach (var (k, times) in wsNew.ToList()) if (!wsOpen.ContainsKey(k) && !times.Any(t => now - t < 60000)) wsNew.Remove(k);
        wsLogged.Clear();
    }
}, null, 60000, 60000);

async Task Play(HttpContext ctx)
{
    if (ctx.Request.Path != "/ws") { ctx.Abort(); return; }
    if (Volatile.Read(ref openTotal) >= WS_MAX_TOTAL) { ctx.Response.StatusCode = 503; ctx.Response.Headers["Retry-After"] = "30"; ctx.Response.Headers.Connection = "close"; ctx.Response.ContentLength = 0; return; }
    var ip = ClientIp.Of(ctx);
    if (!WsAllowed(ip)) { ctx.Response.StatusCode = 429; ctx.Response.Headers["Retry-After"] = "60"; ctx.Response.Headers.Connection = "close"; ctx.Response.ContentLength = 0; return; }
    WebSocket ws;
    try { ws = await ctx.WebSockets.AcceptWebSocketAsync(new WebSocketAcceptContext { KeepAliveInterval = TimeSpan.FromMilliseconds(HEARTBEAT_MS), KeepAliveTimeout = TimeSpan.FromMilliseconds(HEARTBEAT_MS) }); }
    catch { WsFreed(ip); throw; }
    var conn = new Conn(ws, ip) { counted = true };
    Interlocked.Increment(ref openTotal);
    Loop.I.Post(_ => game.conns.Add(conn), null);
    var writer = conn.WriteLoop();
    try
    {
        var buf = new byte[4096]; using var msg = new MemoryStream();
        while (true)
        {
            var res = await ws.ReceiveAsync(buf, ctx.RequestAborted);
            if (res.MessageType == WebSocketMessageType.Close) { await conn.CloseFromClient(); break; }
            if (res.MessageType == WebSocketMessageType.Binary) { conn.Destroy(); break; } // binary messages are not used
            msg.Write(buf, 0, res.Count);
            if (msg.Length > MAX_PAYLOAD) { conn.Destroy(); break; } // the whole message, not just one frame
            if (!res.EndOfMessage) continue;
            var text = Encoding.UTF8.GetString(msg.GetBuffer(), 0, (int)msg.Length); msg.SetLength(0);
            Loop.I.Post(_ => game.OnMessage(conn, text), null);
        }
    }
    catch { conn.Destroy(); } // a protocol error (unmasked frame, a split or oversized ping…) or a dropped connection
    finally
    {
        // the slot goes first, so a throw in Leave cannot leak it
        if (conn.counted) { conn.counted = false; WsFreed(ip); Interlocked.Decrement(ref openTotal); }
        Loop.I.Post(_ => { game.conns.Remove(conn); _ = game.Leave(conn); }, null);
        conn.Destroy();
        try { await writer; } catch { }
    }
}

// ---------------------------------------------------------------- static files
async Task ServeFile(HttpContext ctx, string pathname)
{
    if (ROOT == null || (ctx.Request.Method != "GET" && ctx.Request.Method != "HEAD"))
    {
        ctx.Response.StatusCode = ROOT != null ? 405 : 404; ctx.Response.ContentType = "text/plain; charset=utf-8";
        await ctx.Response.WriteAsync(ROOT != null ? "Method not allowed" : "Not found"); return;
    }
    var p = pathname;
    if (p.Contains('\0')) { ctx.Response.StatusCode = 400; return; }
    if (p.EndsWith('/')) p += "index.html";
    if (p.EndsWith("/index.html")) ctx.Response.Headers.ContentSecurityPolicy = CSP;
    var file = Path.GetFullPath(Path.Combine(ROOT, p.TrimStart('/')));
    if (!file.StartsWith(ROOT + Path.DirectorySeparatorChar)) { ctx.Response.StatusCode = 403; return; }
    var info = new FileInfo(file);
    if (!info.Exists) { ctx.Response.StatusCode = 404; await ctx.Response.WriteAsync("Not found"); return; }
    // Unity's gzipped build files (game.wasm.gz…): the browser unpacks them itself
    bool gz = file.EndsWith(".gz");
    var type = TYPES.GetValueOrDefault(Path.GetExtension(gz ? file[..^3] : file), "application/octet-stream");
    var cache = Regex.IsMatch(file, @"\.(woff2|ttf|m4a|mp3|ogg|wav)$") ? "public, max-age=604800" : "no-cache";
    ctx.Response.ContentType = type; ctx.Response.Headers.CacheControl = cache;
    if (gz) { ctx.Response.Headers.ContentEncoding = "gzip"; ctx.Response.ContentLength = info.Length; await ctx.Response.SendFileAsync(file); return; }
    // byte ranges: Safari and iPhones refuse to play audio from servers without them
    var m = Regex.Match(ctx.Request.Headers.Range.ToString(), @"^bytes=(\d*)-(\d*)$");
    if (m.Success && (m.Groups[1].Length > 0 || m.Groups[2].Length > 0))
    {
        long size = info.Length;
        long start = m.Groups[1].Length > 0 ? long.Parse(m.Groups[1].Value) : Math.Max(0, size - long.Parse(m.Groups[2].Value));
        long end = m.Groups[1].Length > 0 && m.Groups[2].Length > 0 ? Math.Min(long.Parse(m.Groups[2].Value), size - 1) : size - 1;
        if (start >= size || start > end) { ctx.Response.StatusCode = 416; ctx.Response.Headers.ContentRange = $"bytes */{size}"; return; }
        ctx.Response.StatusCode = 206; ctx.Response.ContentLength = end - start + 1; ctx.Response.Headers.ContentRange = $"bytes {start}-{end}/{size}"; ctx.Response.Headers.AcceptRanges = "bytes";
        await ctx.Response.SendFileAsync(file, start, end - start + 1); return;
    }
    ctx.Response.ContentLength = info.Length; ctx.Response.Headers.AcceptRanges = "bytes";
    await ctx.Response.SendFileAsync(file);
}

async Task Handle(HttpContext ctx)
{
    var h = ctx.Response.Headers;
    // on every answer: no MIME sniffing, no framing, no referrer leaks, only the device features the game uses, HTTPS only over HTTPS
    h["x-content-type-options"] = "nosniff"; h["x-frame-options"] = "DENY"; h["referrer-policy"] = "no-referrer"; h["cross-origin-opener-policy"] = "same-origin";
    h["permissions-policy"] = "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)";
    if (ctx.Request.Headers["x-forwarded-proto"] == "https" || ctx.Request.IsHttps) h["strict-transport-security"] = "max-age=31536000; includeSubDomains";
    string pathname = Uri.UnescapeDataString(ctx.Request.Path.Value ?? "/");
    if (pathname.StartsWith("/api/"))
    {
        var origin = ctx.Request.Headers.Origin.ToString();
        if (origin != "" && OriginAllowed(origin)) { h["access-control-allow-origin"] = origin; h.Vary = "Origin"; }
        if (ctx.Request.Method == "OPTIONS")
        {
            if (origin == "" || !OriginAllowed(origin)) { ctx.Response.StatusCode = 403; return; }
            ctx.Response.StatusCode = 204; h["access-control-allow-methods"] = "GET, POST, PUT, DELETE";
            h["access-control-allow-headers"] = "content-type, x-family, x-player, x-ticket, x-pin"; h["access-control-max-age"] = "600"; return;
        }
    }
    if (pathname == "/api/hello")
    {
        var (total, nutag) = await Loop.Run(() => Task.FromResult(game.Counts()));
        int roomCount = await Loop.Run(() => Task.FromResult(game.rooms.Count));
        var info = new JsonObject { ["naadamy"] = true, ["rooms"] = roomCount, ["players"] = total, ["nutag"] = nutag };
        if (!PRODUCTION) info["urls"] = new JsonArray(LanIPs().Select(ip => (JsonNode?)$"http://{ip}:{ctx.Connection.LocalPort}/").ToArray()); // home network only, never published
        ctx.Response.ContentType = "application/json"; h.CacheControl = "no-store";
        await ctx.Response.WriteAsync(Js.Stringify(info)); return;
    }
    await ServeFile(ctx, pathname);
}

// ---------------------------------------------------------------- start
WebApplication? app = null;
int port = PORT;
for (int tries = 0; ; tries++)
{
    var b = WebApplication.CreateSlimBuilder(args);
    b.Logging.ClearProviders();
    var listenPort = port;
    b.WebHost.ConfigureKestrel(o => { o.AddServerHeader = false; o.Listen(IPAddress.Any, listenPort); });
    var a = b.Build();
    a.UseWebSockets();
    a.Run(ctx => ctx.WebSockets.IsWebSocketRequest ? Play(ctx) : Handle(ctx));
    try { await a.StartAsync(); app = a; break; }
    catch (IOException e) when (e.InnerException is SocketException { SocketErrorCode: SocketError.AddressAlreadyInUse } || e.Message.Contains("address already in use", StringComparison.OrdinalIgnoreCase))
    {
        if (PORT == 0 || tries >= 10) { Console.Error.WriteLine("  Could not start the server: " + e.Message); return 1; }
        // the port is taken (often another copy of Naadamy): use the next free port
        Console.WriteLine($"  Port {port} is busy, trying {port + 1}…");
        port++;
        await a.DisposeAsync();
    }
}
int actual = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First().Replace("0.0.0.0", "localhost").Replace("[::]", "localhost")).Port;
Console.WriteLine($"\n  Naadamy is running!\n\n  On this computer:  http://localhost:{actual}");
foreach (var ip in LanIPs()) Console.WriteLine($"  Same Wi-Fi:        http://{ip}:{actual}");
Console.WriteLine("\n  If friends cannot connect: some school/guest Wi-Fi blocks devices from");
Console.WriteLine("  seeing each other. Use a phone hotspot or a home router instead.");
Console.WriteLine("\n  Press Ctrl+C to stop.\n");
Console.Out.Flush();

// ---------------------------------------------------------------- stop: everyone leaves, the rooms are saved
var stopped = new TaskCompletionSource<int>();
async Task Stop()
{
    bool ok;
    try { ok = await Loop.Run(game.Shutdown); } catch (Exception e) { Console.Error.WriteLine("Could not stop cleanly: " + e.Message); ok = false; }
    stopped.TrySetResult(ok ? 0 : 1);
}
app.Lifetime.ApplicationStopping.Register(() => Stop().Wait(10000)); // Ctrl+C, or SIGTERM from Render
if (Environment.GetEnvironmentVariable("NAADAMY_STOP_ON_STDIN_EOF") == "1") // run by a parent that can't send signals (tests on Windows): it closes our stdin
    _ = Task.Run(async () => { var input = Console.OpenStandardInput(); var b = new byte[64]; while (await input.ReadAsync(b) > 0) { } await Stop(); });
int code = await stopped.Task;
GC.KeepAlive(forget);
return code;
