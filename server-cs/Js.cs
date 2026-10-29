// JavaScript's view of JSON values, so the checks read like the JS server's: Number.isInteger, String(x || ''), truthiness…
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Naadamy.Server;

public static class Js
{
    public const long MAX_SAFE = 9007199254740991;
    public static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    /** Number.isFinite(v): the number, or null for anything else. */
    public static double? Num(JsonNode? n)
    {
        if (n is not JsonValue v || v.GetValueKind() != JsonValueKind.Number) return null;
        // a number read from text or made here (long, int, double…): its JSON text reads back the same way for each
        var d = double.Parse(v.ToJsonString(), System.Globalization.CultureInfo.InvariantCulture);
        return double.IsFinite(d) ? d : null;
    }
    /** Number.isInteger(v). */
    public static bool IsInt(JsonNode? n, out long value)
    {
        value = 0;
        if (Num(n) is not double d || Math.Floor(d) != d || Math.Abs(d) > 9.2e18) return false;
        value = (long)d; return true;
    }
    /** Number.isSafeInteger(v). */
    public static bool IsSafeInt(JsonNode? n, out long value) => IsInt(n, out value) && Math.Abs(value) <= MAX_SAFE;
    /** The string, or null when it is not one. */
    public static string? Str(JsonNode? n) => n is JsonValue v && v.GetValueKind() == JsonValueKind.String ? v.GetValue<string>() : null;
    public static bool Bool(JsonNode? n) => n is JsonValue v && v.GetValueKind() == JsonValueKind.True;
    /** JS truthiness of a JSON value. */
    public static bool Truthy(JsonNode? n) => n switch
    {
        null => false,
        JsonValue v => v.GetValueKind() switch
        {
            JsonValueKind.False or JsonValueKind.Null or JsonValueKind.Undefined => false,
            JsonValueKind.String => v.GetValue<string>().Length > 0,
            JsonValueKind.Number => Num(v) is double d && d != 0,
            _ => true,
        },
        _ => true,
    };
    /** String(x || ''): what the JS server made of a value it expected to be text. */
    public static string Text(JsonNode? n)
    {
        if (!Truthy(n)) return "";
        if (Str(n) is string s) return s;
        if (n is JsonValue v && v.GetValueKind() == JsonValueKind.True) return "true";
        if (Num(n) is double d) return d == Math.Floor(d) && Math.Abs(d) < 1e21 ? ((long)d).ToString(System.Globalization.CultureInfo.InvariantCulture) : d.ToString("R", System.Globalization.CultureInfo.InvariantCulture);
        if (n is JsonArray a) return string.Join(",", a.Select(Text));
        return "[object Object]";
    }
    public static string Slice(string s, int max) => s.Length <= max ? s : s[..max];

    static readonly JsonSerializerOptions Opts = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    /** JSON.stringify of a message: a JsonNode, or a dictionary / anonymous object whose values may be JsonNodes. */
    public static string Stringify(object? o) => o is JsonNode n ? n.ToJsonString(Opts) : JsonSerializer.Serialize(o, Opts);
    public static JsonNode? Parse(string s) { try { return JsonNode.Parse(s); } catch (JsonException) { return null; } }
    /** A copy that can be put inside another JSON container (a node has only one parent). */
    public static JsonNode? Copy(JsonNode? n) => n?.DeepClone();
    public static JsonObject Obj(params (string k, object? v)[] fields)
    {
        var o = new JsonObject();
        foreach (var (k, v) in fields) o[k] = v switch { null => null, JsonNode n => n.Parent == null ? n : n.DeepClone(), _ => JsonSerializer.SerializeToNode(v) };
        return o;
    }
    public static bool IsRecord(JsonNode? n) => n is JsonObject;
    public static bool Has(JsonObject o, string k) => o.ContainsKey(k);
}
