// One game connection (WebSocket /ws): who it plays as, and a queue of messages to send. A client that never reads (or a very
// slow one) would make the queue grow without end: past 256 KB waiting, the connection is dropped instead.
using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Channels;

namespace Naadamy.Server;

public sealed class Conn
{
    const int MAX_QUEUED = 256 * 1024;
    readonly WebSocket ws;
    readonly Channel<byte[]> outbox = Channel.CreateUnbounded<byte[]>(new UnboundedChannelOptions { SingleReader = true });
    long queued;
    public readonly string ip;
    public Player? player; public Room? room; public Wallet? wallet; public Inventory? inventory;
    public double tokens = 30; public long last = Js.Now;
    public Task? noted; public Task lotQueue = Task.CompletedTask;
    public JsonObject? cloudNext; public bool cloudBusy;
    public bool counted;
    volatile bool destroyed;

    public Conn(WebSocket ws, string ip) { this.ws = ws; this.ip = ip; }
    public bool Destroyed => destroyed || ws.State is WebSocketState.Aborted or WebSocketState.Closed;

    public void Send(JsonObject message) => SendText(Js.Stringify(message));
    public void SendText(string text)
    {
        if (Destroyed) return;
        var bytes = Encoding.UTF8.GetBytes(text);
        if (Interlocked.Add(ref queued, bytes.Length) > MAX_QUEUED) { Destroy(); return; }
        outbox.Writer.TryWrite(bytes);
    }
    /** Sends the queued messages, one at a time, until the connection ends. */
    public async Task WriteLoop()
    {
        try
        {
            await foreach (var bytes in outbox.Reader.ReadAllAsync())
            {
                await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
                Interlocked.Add(ref queued, -bytes.Length);
            }
        }
        catch { Destroy(); }
    }
    /** Closes the connection at once (socket.destroy()). */
    public void Destroy()
    {
        destroyed = true;
        outbox.Writer.TryComplete();
        try { ws.Abort(); } catch { /* already gone */ }
    }
    /** Answers the client's close frame and ends the connection. */
    public async Task CloseFromClient()
    {
        outbox.Writer.TryComplete();
        try { await ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None); } catch { /* closing */ }
        destroyed = true;
    }
}
