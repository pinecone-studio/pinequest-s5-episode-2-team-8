// Cloud save (as web/js/cloud.js): a child's progress outside the wallet, in the shared shape of rules.js (cleanCloud /
// mergeCloud) — character, lessons, badges, passport stamps, Mongol script, the historian's quest, story mode. Net uploads it and takes
// back the server's merged copy; the family login brings it along, so it follows the child to another device.
using System.Collections.Generic;
using System.Linq;
using System.Text;

public static class Cloud
{
    static long Long(J j) => j.v is double d ? (long)d : 0; // dates in ms do not fit J.I
    static string Map(string name, List<KV> l) =>
        ",\"" + name + "\":{" + string.Join(",", l.Where(e => e != null && !string.IsNullOrEmpty(e.k) && e.v > 0).GroupBy(e => e.k).Select(g => J.Quote(g.Key) + ":" + g.Max(e => e.v))) + "}";

    /** This profile's progress in the shared cloud shape (JSON). */
    public static string Of(SaveData v)
    {
        var b = new StringBuilder("{");
        b.Append("\"eth\":").Append(J.Quote(v.eth ?? "")).Append(",\"aimag\":").Append(J.Quote(v.aimag ?? "")).Append(",\"charAt\":").Append(v.charAt);
        b.Append(",\"learn\":{").Append(string.Join(",", v.learn.Where(l => l != null && !string.IsNullOrEmpty(l.id) && (l.done || l.best > 0 || l.family > 0))
            .Select(l => J.Quote(l.id) + ":{\"done\":" + (l.done ? "true" : "false") + ",\"best\":" + l.best + ",\"family\":" + l.family + "}"))).Append('}');
        b.Append(Map("ach", v.ach)).Append(Map("stamps", v.stamps)).Append(Map("bichig", v.bichig));
        b.Append(",\"bichigMem\":{").Append(string.Join(",", v.bichigMem.Where(k => !string.IsNullOrEmpty(k)).Distinct().Select(k => J.Quote(k) + ":1"))).Append('}');
        b.Append(",\"hist\":").Append(v.histStep);
        b.Append(Map("story", v.story.Where(e => e != null && ((e.k ?? "").EndsWith(":done") || SaveData.Get(v.story, e.k + ":done") <= 0)).ToList())).Append('}'); // no part of a finished chapter
        return b.ToString();
    }

    /** Brings a cloud copy into the profile: only adds (done, higher scores, new badges and stamps, the earliest date); a
     *  newer character replaces this one. True when anything changed. */
    public static bool Apply(SaveData v, J c)
    {
        if (c == null || !c.IsObject) return false;
        bool changed = false;
        string eth = c["eth"].S ?? "", aimag = c["aimag"].S ?? ""; long at = Long(c["charAt"]);
        bool mineEmpty = string.IsNullOrEmpty(v.eth) && string.IsNullOrEmpty(v.aimag);
        if ((eth != "" || aimag != "") && (at > v.charAt || mineEmpty) && (eth != v.eth || aimag != v.aimag))
        {
            if (eth != "") v.eth = eth; if (aimag != "") v.aimag = aimag; changed = true;
        }
        if (at > v.charAt) { v.charAt = at; changed = true; }
        foreach (var id in c["learn"].Keys)
        {
            var x = c["learn"][id]; var p = v.learn.Find(l => l.id == id);
            bool done = x["done"].B; int best = x["best"].I; long family = Long(x["family"]);
            if (p == null) { if (!done && best <= 0 && family <= 0) continue; v.learn.Add(p = new LessonProg { id = id }); changed = true; }
            if (done && !p.done) { p.done = true; changed = true; }
            if (best > p.best) { p.best = best; changed = true; }
            if (family > p.family) { p.family = family; changed = true; }
        }
        changed |= Earliest(v.ach, c["ach"]);
        changed |= Earliest(v.stamps, c["stamps"]);
        foreach (var id in c["bichig"].Keys)
        {
            long n = Long(c["bichig"][id]); var e = v.bichig.Find(x => x.k == id);
            if (e == null) { if (n > 0) { v.bichig.Add(new KV { k = id, v = n }); changed = true; } }
            else if (n > e.v) { e.v = n; changed = true; }
        }
        foreach (var id in c["bichigMem"].Keys) if (!v.bichigMem.Contains(id)) { v.bichigMem.Add(id); changed = true; }
        int hist = c["hist"].I;
        if (hist > v.histStep) { v.histStep = hist; v.histFound = 0; changed = true; } // a later task: start it fresh
        foreach (var id in c["story"].Keys) // a part reached only counts while neither side finished that chapter
        {
            int n = c["story"][id].I;
            if (id.EndsWith(":done")) { if (n > SaveData.Get(v.story, id)) { SaveData.Set(v.story, id, n); changed = true; } }
            else if (n > SaveData.Get(v.story, id) && SaveData.Get(v.story, id + ":done") <= 0 && c["story"][id + ":done"].I <= 0) { SaveData.Set(v.story, id, n); changed = true; }
        }
        return changed;
    }
    /** Badges and stamps: every one from either side, with the earliest date. */
    static bool Earliest(List<KV> mine, J theirs)
    {
        bool changed = false;
        foreach (var id in theirs.Keys)
        {
            long t = Long(theirs[id]); if (t <= 0) continue;
            var e = mine.Find(x => x.k == id);
            if (e == null) { mine.Add(new KV { k = id, v = t }); changed = true; }
            else if (e.v <= 0 || t < e.v) { e.v = t; changed = true; }
        }
        return changed;
    }
}
