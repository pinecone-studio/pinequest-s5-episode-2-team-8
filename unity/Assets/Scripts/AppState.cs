// Everything on this device that is not one child's progress (like js/store.js): the profiles, the family, settings,
// family stars and the activity log. Each child's own progress is a SaveData, stored under its profile id.
using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable] public sealed class FamilyMember { public string id, mn, en; public int face; public Tx Name => new Tx(mn, string.IsNullOrEmpty(en) ? mn : en); }
[Serializable] public sealed class Friend { public string name; public int face; }
[Serializable] public sealed class LogEntry { public string d, k, id, pid; public long ts; }
[Serializable] public sealed class Memory { public string id, pid, prompt, who, text, d, audio; public int whoFace; public long ts; }

[Serializable]
public sealed class AppState
{
    const string KEY = "naadamy.app.v1";
    public bool en, loggedIn, sound = true, bigText, music = true;
    public float musicVolume = 0.35f;
    public string activeId = "";
    public string server = "", familyCode = "";   // the server this device last used, and its family code (Family.cs)
    public string playMode = "";                   // "solo": play alone, never connect · "multi": connect and play with others (ModeModal)
    public List<string> profiles = new List<string>();
    public List<FamilyMember> family = new List<FamilyMember>
    {
        new FamilyMember { id = "f1", mn = "Ээж", en = "Mom", face = 0 }, new FamilyMember { id = "f2", mn = "Аав", en = "Dad", face = 1 },
        new FamilyMember { id = "f3", mn = "Эмээ", en = "Grandma", face = 2 }, new FamilyMember { id = "f4", mn = "Өвөө", en = "Grandpa", face = 3 },
        new FamilyMember { id = "f5", mn = "Ах, эгч", en = "Sibling", face = 4 }, new FamilyMember { id = "f6", mn = "Найз", en = "Friend", face = 7 },
    };
    public List<Friend> friends = new List<Friend>();
    public int familyStars;
    public List<LogEntry> log = new List<LogEntry>();
    public List<Memory> memories = new List<Memory>();

    public static AppState Load()
    {
        try { string raw = PlayerPrefs.GetString(KEY, ""); if (raw != "") { var s = JsonUtility.FromJson<AppState>(raw); if (s != null) { s.server ??= ""; s.familyCode ??= ""; return s; } } }
        catch (Exception e) { Debug.LogWarning("Naadamy: could not read the app state. " + e.Message); }
        return new AppState();
    }
    public void Save() { PlayerPrefs.SetString(KEY, JsonUtility.ToJson(this)); PlayerPrefs.Save(); }
    public void LogActivity(string kind, string id, string pid)
    {
        log.Add(new LogEntry { d = SaveData.DayKey(), ts = SaveData.NowMs(), k = kind, id = id, pid = pid });
        if (log.Count > 2000) log.RemoveRange(0, log.Count - 2000);
        Save();
    }
}
