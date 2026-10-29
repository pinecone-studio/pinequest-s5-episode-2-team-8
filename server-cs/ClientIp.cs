// Which address a request comes from, for the per-address limits. On Render the socket is the proxy, so it reads the proxy's
// headers there: Cloudflare (in front of Render) sets cf-connecting-ip to the real address; else the last x-forwarded-for entry,
// the one the proxy added (the browser can fake the ones before it). Anywhere else (a home network) those headers are not
// trusted. An IPv6 address counts as its /64: one home gets a whole /64. Ported from server/client-ip.js.
using System.Net;

namespace Naadamy.Server;

public static class ClientIp
{
    static readonly bool BehindProxy = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RENDER"));

    static string Bucket(string ip)
    {
        if (!ip.Contains(':') || ip.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase) && ip.Length > 7 && char.IsDigit(ip[7])) return ip; // IPv4, also when written as IPv6
        var parts = ip.ToLowerInvariant().Split("::");
        var h = parts[0].Length > 0 ? parts[0].Split(':') : Array.Empty<string>();
        var t = parts.Length > 1 && parts[1].Length > 0 ? parts[1].Split(':') : Array.Empty<string>();
        var all = ip.Contains("::") ? h.Concat(Enumerable.Repeat("0", Math.Max(0, 8 - h.Length - t.Length))).Concat(t).ToArray() : h;
        return string.Join(":", all.Take(4).Select(x => x.TrimStart('0') is var s && s.Length > 0 ? s : "0")) + "::/64";
    }
    public static string Of(HttpContext c)
    {
        if (BehindProxy)
        {
            var cf = c.Request.Headers["cf-connecting-ip"].ToString().Trim();
            if (IPAddress.TryParse(cf, out _)) return Bucket(cf);
            var f = c.Request.Headers["x-forwarded-for"].ToString().Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToArray();
            if (f.Length > 0 && IPAddress.TryParse(f[^1], out _)) return Bucket(f[^1]);
        }
        var remote = c.Connection.RemoteIpAddress;
        if (remote == null) return "?";
        return Bucket(remote.IsIPv4MappedToIPv6 ? "::ffff:" + remote.MapToIPv4() : remote.ToString());
    }
}
