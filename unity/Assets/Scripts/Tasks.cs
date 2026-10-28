// Hands-on tasks (js/village/tasks.js): shearing, rolling felt, raising a ger, making the white foods… each is one small spec
// (drag, rhythm, spots, hold, turn or choose) shown on a 160×120 pixel stage over the dimmed village. A wrong move only
// wobbles the picture: nothing is ever lost. With two players on one screen, some tasks are done together.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed class TaskOption { public string id; public Tx label, why; public PxCanvas icon; }
public sealed class TaskState
{
    public string kind; public int progress, n, mistakes, sel = -1; public float fill, along, ang, dryT = 2.5f, helperT, t0, sayT; public bool dry, tilt, dragging, turning;
    public readonly Dictionary<string, string> held = new Dictionary<string, string>(); public readonly List<int> sides = new List<int>(); public readonly HashSet<int> placed = new HashSet<int>();
    public string pick; public float turnFrom;
}
public sealed class TaskSpec
{
    public string kind; public Tx title, hint; public Tx? say; public bool shake;
    public Action<PxCanvas, float, TaskState> art;
    public int n; public Vector2[] spots; public int[] side; public Func<List<int>, bool> rule; // spots
    public Vector2[] path;                                                               // drag
    public float start, target, tol = 0.35f;                                             // turn
    public int holders = 1; public float ms = 1000;                                      // hold
    public string two;                                                                   // "help": two players can share it
    public float speed = 0.8f, win = 0.2f; public bool water;                            // rhythm
    public List<TaskOption> options; public string answer;                               // choose
    public Action<TaskState> onMiss;
}
public sealed class TaskResult { public bool done, together; public int mistakes; public string pick; }

public sealed partial class Game
{
    const int SW = 160, SH = 120;
    public int Players => p2 != null ? 2 : 1;
    TaskModal task;
    public bool TaskActive => task != null;
    /** Run one hands-on task; done gets { done, mistakes, together, pick }. */
    public void RunTask(TaskSpec spec, Action<TaskResult> done)
    {
        if (task != null) { done(new TaskResult()); return; }
        task = new TaskModal(spec, r => { task = null; done(r); });
        Open(task);
    }
    /** For coroutines: run a task and wait for it. */
    public sealed class TaskWait : CustomYieldInstruction { public TaskResult r; public override bool keepWaiting => r == null; }
    public TaskWait Task(TaskSpec spec) { var w = new TaskWait(); RunTask(spec, r => w.r = r); return w; }
    public void TaskSay(Tx text) => task?.Say(text);

    public sealed class TaskModal : Modal
    {
        readonly TaskSpec sp; readonly Action<TaskResult> done; readonly TaskState s; readonly Live live = new Live(SW, SH);
        bool over; float shakeT = -9, flashT = -9; Color flashC; string sayText; Rect abs; float born = Time.time;
        readonly Dictionary<int, Vector2> ptrs = new Dictionary<int, Vector2>(); float lastTouch = -9;
        public override float Width => 600;
        public TaskModal(TaskSpec spec, Action<TaskResult> done)
        {
            sp = spec; this.done = done;
            s = new TaskState { kind = spec.kind, n = spec.n > 0 ? spec.n : spec.kind == "spots" ? spec.spots.Length : 1, ang = spec.start, t0 = Time.time };
            if (spec.say != null) Say(spec.say.Value);
            if (spec.shake) shakeT = Time.time + 0.26f;
        }
        public void Say(Tx text) { sayText = text.ToString(); s.sayT = Time.time + 4; }

        // ---------------------------------------------------------------- input: mouse, every finger, and the keys (E/Space is player 1, Enter player 2)
        Vector2 Stage(Vector2 screen) { var gui = new Vector2(screen.x, Screen.height - screen.y); return new Vector2((gui.x - abs.x) * SW / Mathf.Max(1, abs.width), (gui.y - abs.y) * SH / Mathf.Max(1, abs.height)); }
        bool OnStage(Vector2 p) => p.x >= 0 && p.y >= 0 && p.x < SW && p.y < SH;
        void Pointers(Game g)
        {
            var now = new Dictionary<int, (Vector2 p, bool down, bool up)>();
            if (Input.touchCount > 0) { lastTouch = Time.unscaledTime; for (int i = 0; i < Input.touchCount; i++) { var t = Input.GetTouch(i); now[t.fingerId] = (t.position, t.phase == TouchPhase.Began, t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled); } }
            else if (Time.unscaledTime - lastTouch > 0.5f && (Input.GetMouseButton(0) || Input.GetMouseButtonUp(0))) now[-1] = (Input.mousePosition, Input.GetMouseButtonDown(0), Input.GetMouseButtonUp(0));
            foreach (var kv in now)
            {
                var p = Stage(kv.Value.p);
                if (kv.Value.down && OnStage(p)) { ptrs[kv.Key] = p; Down(g, kv.Key, p); }
                else if (ptrs.ContainsKey(kv.Key)) { ptrs[kv.Key] = p; Move(p); }
                if (kv.Value.up && ptrs.ContainsKey(kv.Key)) { ptrs.Remove(kv.Key); Up(kv.Key); }
            }
            foreach (var id in ptrs.Keys.Where(k => !now.ContainsKey(k)).ToList()) { ptrs.Remove(id); Up(id); } // a finger that left the screen
        }
        static bool Near(Vector2 a, float x, float y, float r) => (a - new Vector2(x, y)).magnitude <= r;
        void Down(Game g, int id, Vector2 p)
        {
            switch (sp.kind)
            {
                case "drag": { var h = Handle(); if (Near(p, h.x, h.y, 16)) s.dragging = true; break; }
                case "rhythm": Beat(g, p.x > SW / 2f && g.Players == 2 ? "p2" : "p1"); break;
                case "spots": { int i = FirstSpot(k => !s.placed.Contains(k) && Near(p, sp.spots[k].x, sp.spots[k].y, 12)); if (i >= 0) Place(i); break; }
                case "hold": s.held["ptr" + id] = g.Players == 1 || sp.holders == 1 || p.x < SW / 2f ? "p1" : "p2"; break; // alone, any finger is yours
                case "turn": s.turnFrom = Mathf.Atan2(p.y - SH / 2f, p.x - SW / 2f); s.turning = true; break;
            }
        }
        void Move(Vector2 p)
        {
            if (sp.kind == "drag" && s.dragging)
            {
                Vector2 a = sp.path[0], b = sp.path[1], d = b - a; s.along = Mathf.Clamp01(Vector2.Dot(p - a, d) / d.sqrMagnitude);
                if (s.along >= 0.95f) { s.dragging = false; s.along = 0; Step(); }
            }
            else if (sp.kind == "turn" && s.turning) { float a = Mathf.Atan2(p.y - SH / 2f, p.x - SW / 2f); s.ang += Mathf.DeltaAngle(s.turnFrom * Mathf.Rad2Deg, a * Mathf.Rad2Deg) * Mathf.Deg2Rad; s.turnFrom = a; }
        }
        void Up(int id)
        {
            if (sp.kind == "drag" && s.dragging) s.dragging = false;
            else if (sp.kind == "hold") s.held.Remove("ptr" + id);
            else if (sp.kind == "turn" && s.turning) { s.turning = false; Turned(); }
        }
        public override void Press(Game g) { } // E and Space are read in Key
        public override void Key(Game g)
        {
            bool p1 = Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Space), p2k = Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter);
            bool left = Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A), right = Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D);
            string who = p1 ? "p1" : p2k ? "p2" : null;
            switch (sp.kind)
            {
                case "rhythm": if (who != null) Beat(g, who); break;
                case "spots": if (who != null) { int i = FirstSpot(k => !s.placed.Contains(k) && (!s.tilt || Side(k) != LastSide)); if (i >= 0) Place(i); } break;
                case "turn": if (left) s.ang -= Mathf.PI / 12; else if (right) s.ang += Mathf.PI / 12; else if (who != null) Turned(); break;
                case "choose":
                    if (sp.options.Count == 0) break;
                    if (left || right) s.sel = ((s.sel < 0 ? (left ? 0 : -1) : s.sel) + (left ? -1 : 1) + sp.options.Count) % sp.options.Count;
                    else if (who != null && s.sel >= 0) Pick(sp.options[s.sel].id);
                    break;
            }
        }
        int Side(int k) => sp.side != null && k < sp.side.Length ? sp.side[k] : -1;
        int LastSide => s.sides.Count > 0 ? s.sides[s.sides.Count - 1] : -99;
        int FirstSpot(Func<int, bool> ok) { for (int k = 0; k < sp.spots.Length; k++) if (ok(k)) return k; return -1; }

        // ---------------------------------------------------------------- the kinds
        Vector2 Handle() => Vector2.Lerp(sp.path[0], sp.path[1], s.along);
        float Marker() { float q = (Time.time - s.t0) * sp.speed; return Mathf.Abs((q % 2) - 1); } // 0..1 and back
        /** One tap on the beat. With water, the roll only turns while the felt is wet. */
        void Beat(Game g, string who)
        {
            bool two = g.Players == 2;
            if (sp.water && who == (two ? "p2" : "p1")) { if (s.dry) { s.dry = false; s.dryT = 3; Flash(Px.Col("#7fe07a")); Sfx.Tap(); } if (!two) return; }
            if (sp.water && !two) return; // alone: Basar pulls the roll, you keep it wet
            if (who != "p1" || (sp.water && s.dry)) return;
            if (Mathf.Abs(Marker() - 0.5f) <= sp.win / 2) Step(); else { s.t0 = Time.time; Sfx.Tap(); }
        }
        void Place(int i)
        {
            int side = Side(i);
            if (s.tilt && side == LastSide) { Wobble(); return; } // fix the tilt from the other side first
            s.placed.Add(i); s.sides.Add(side); s.tilt = false;
            if (sp.rule != null && sp.rule(s.sides)) { s.tilt = true; Wobble(); }
            Step();
        }
        void Turned()
        {
            float diff = Mathf.Atan2(Mathf.Sin(s.ang - sp.target), Mathf.Cos(s.ang - sp.target));
            if (Mathf.Abs(diff) <= sp.tol) { s.ang = sp.target; Step(); } else Wobble();
        }
        void Pick(string id) { if (sp.kind == "choose" && !over) { s.pick = id; Sfx.Tap(); End(I, true); } }
        /** One more done: a pop, and the task ends when all are done. */
        void Step()
        {
            if (over) return;
            s.progress++; Flash(Px.Col("#f7c646")); Sfx.Good();
            if (s.progress >= s.n) I.StartCoroutine(EndSoon());
        }
        IEnumerator EndSoon() { yield return new WaitForSeconds(0.26f); End(I, true); }
        /** A gentle wobble: nothing is lost, you just try again. */
        void Wobble() { s.mistakes++; Sfx.Bad(); shakeT = Time.time; sp.onMiss?.Invoke(s); }
        void Flash(Color c) { flashT = Time.time; flashC = c; }
        void End(Game g, bool ok)
        {
            if (over) return; over = true;
            bool two = g.Players == 2 && sp.two != null;
            if (ok && s.progress < s.n && sp.kind != "choose") s.progress = s.n;
            if (ok && sp.kind != "choose") Sfx.Win();
            if (g.modal == this) g.Close();
            done(new TaskResult { done = ok, mistakes = s.mistakes, together = ok && two, pick = s.pick });
        }
        public override void Closed(Game g) { if (!over) { over = true; done(new TaskResult { mistakes = s.mistakes }); } }

        // ---------------------------------------------------------------- every frame
        public override void Tick(Game g, float dt)
        {
            if (abs.width > 0) Pointers(g);
            bool two = g.Players == 2;
            if (sp.kind == "hold") // fills while held (both holders when two are needed; alone, grandpa holds the other post)
            {
                if (Input.GetKey(KeyCode.E) || Input.GetKey(KeyCode.Space)) s.held["keyp1"] = "p1"; else s.held.Remove("keyp1");
                if (Input.GetKey(KeyCode.Return) || Input.GetKey(KeyCode.KeypadEnter)) s.held["keyp2"] = "p2"; else s.held.Remove("keyp2");
                var h = s.held.Values.ToList(); bool ok = sp.holders == 2 ? h.Contains("p1") && (h.Contains("p2") || !two) : h.Count > 0;
                s.fill = Mathf.Clamp01(s.fill + (ok ? dt / (sp.ms / 1000) : -dt * 2));
                if (s.fill >= 1) { s.fill = 0; s.held.Clear(); ptrs.Clear(); Step(); }
            }
            if (sp.kind == "rhythm" && sp.water) // rolling felt: it dries every few seconds and needs water; alone, Basar pulls the roll on the beat
            {
                s.dryT -= dt; if (s.dryT <= 0 && !s.dry) s.dry = true;
                if (!two && !s.dry) { s.helperT += dt; if (s.helperT > 0.9f) { s.helperT = 0; Step(); } }
            }
        }
        public override void Draw(Game g)
        {
            float t = Time.time; var x = live.c;
            x.Fill(Px.Col("#e8dcc0"));
            sp.art?.Invoke(x, t, s);
            DrawKind(g, x, t);
            GUILayout.BeginHorizontal(); GUILayout.Label("<b>" + sp.title + "</b>", g.sTitle); GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            float maxH = Mathf.Min(g.U(330), Screen.height * 0.5f);
            var r = live.Show(g, maxH);
            if (Event.current.type == EventType.Repaint) abs = new Rect(GUIUtility.GUIToScreenPoint(r.position), r.size);
            // the picture pops when something is done and wobbles on a mistake
            float sk = t - shakeT; if (sk >= 0 && sk < 0.42f && Event.current.type == EventType.Repaint) { live.ShowAt(new Rect(r.x + Mathf.Sin(sk * 45) * g.U(5), r.y, r.width, r.height)); }
            if (t - flashT < 0.2f) { float a = 1 - (t - flashT) / 0.2f, w = g.U(3); var c = flashC; c.a = a; g.Box(new Rect(r.x - w, r.y - w, r.width + w * 2, w), c); g.Box(new Rect(r.x - w, r.yMax, r.width + w * 2, w), c); g.Box(new Rect(r.x - w, r.y, w, r.height), c); g.Box(new Rect(r.xMax, r.y, w, r.height), c); }
            if (sayText != null && t < s.sayT)   // what they say, in a box as tall as the words
            {
                var sst = new GUIStyle(g.sLabel) { wordWrap = true, alignment = TextAnchor.MiddleCenter, padding = new RectOffset(Mathf.RoundToInt(g.U(8)), Mathf.RoundToInt(g.U(8)), Mathf.RoundToInt(g.U(4)), Mathf.RoundToInt(g.U(4))) };
                var sc = new GUIContent("<color=#2b1e2e>" + sayText + "</color>"); float sw = r.width * 0.9f, shh = Mathf.Max(g.U(40), sst.CalcHeight(sc, sw));
                var sr = new Rect(r.x + r.width * 0.05f, r.y + g.U(6), sw, shh); g.Box(sr, Px.Col("#fff8e6")); GUI.Label(sr, sc, sst);
            }
            g.Text(sp.hint.ToString());
            if (sp.kind != "choose" && s.n > 1) // progress pips
            {
                GUILayout.BeginHorizontal(); GUILayout.FlexibleSpace();
                for (int i = 0; i < s.n; i++) { var pr = GUILayoutUtility.GetRect(g.U(14), g.U(14), GUILayout.Width(g.U(14))); g.Box(pr, Px.Col("#2b1e2e")); g.Box(new Rect(pr.x + 2, pr.y + 2, pr.width - 4, pr.height - 4), Px.Col(i < s.progress ? "#f7c646" : "#fff8e6")); GUILayout.Space(g.U(4)); }
                GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
            }
            if (sp.kind == "choose") // the tray of parts or answers
            {
                int n = sp.options.Count, cols = n > 5 ? Mathf.CeilToInt(n / 2f) : Mathf.Max(1, n);
                for (int row = 0; row * cols < n; row++)
                {
                    GUILayout.BeginHorizontal(); GUILayout.FlexibleSpace();
                    for (int i = row * cols; i < Mathf.Min(n, row * cols + cols); i++)
                    {
                        var o = sp.options[i]; var br = GUILayoutUtility.GetRect(g.U(92), g.U(84), GUILayout.Width(g.U(92)));
                        if (GUI.Button(br, "", i == s.sel ? g.sSel : g.sBtn)) { var id = o.id; g.Later(() => Pick(id)); }
                        if (o.icon != null) GUI.DrawTexture(new Rect(br.center.x - g.U(18), br.y + g.U(6), g.U(36), g.U(36)), g.Tex(o.icon));
                        GUI.Label(new Rect(br.x + 2, br.y + g.U(44), br.width - 4, g.U(38)), o.label.ToString(), new GUIStyle(g.sSmall) { alignment = TextAnchor.UpperCenter, wordWrap = true });
                    }
                    GUILayout.FlexibleSpace(); GUILayout.EndHorizontal();
                }
            }
            if (!Game.TouchUI) g.Small(sp.kind == "hold" ? Loc.L("Дарж байгаад барь (E эсвэл Space)", "Press and hold (E or Space)") : sp.kind == "turn" ? Loc.L("◄ ► эргүүлээд E", "◄ ► to turn, then E") : sp.kind == "choose" ? Loc.L("◄ ► сонгоод E", "◄ ► to pick, then E") : sp.kind == "drag" ? Loc.L("Шар бариулыг чирээрэй", "Drag the gold handle") : Loc.L("E эсвэл Space", "E or Space"));
        }
        /** What the kind shows on top of the picture, in pixel art. */
        void DrawKind(Game g, PxCanvas x, float t)
        {
            string DARK = "#2b1e2e", GOLD = "#f7c646", CREAM = "#fff8e6", GREEN = "#7fe07a";
            int pulse = (int)(t * 6) % 2;
            void Dot(float cx, float cy, int r, string fill) { Px.Ell(x, Js.Round(cx), Js.Round(cy), r + 1, r + 1, DARK); Px.Ell(x, Js.Round(cx), Js.Round(cy), r, r, fill); }
            switch (sp.kind)
            {
                case "drag":
                {
                    Vector2 a = sp.path[0], b = sp.path[1], h = Handle(); int n = Mathf.CeilToInt((b - a).magnitude);
                    for (int i = 0; i <= n; i += 2) { var p = Vector2.Lerp(a, b, i / (float)Mathf.Max(1, n)); Px.P(x, Js.Round(p.x), Js.Round(p.y), CREAM); }
                    var dir = (b - a).normalized; for (int k = 0; k < 4; k++) { var q = b - dir * k; Px.R(x, Js.Round(q.x - (3 - k) * Mathf.Abs(dir.y)), Js.Round(q.y - (3 - k) * Mathf.Abs(dir.x)), 1 + (3 - k) * 2 * Mathf.Abs(dir.y) + 1, 1 + (3 - k) * 2 * Mathf.Abs(dir.x) + 1, CREAM); }
                    Dot(h.x, h.y, 4 + pulse, GOLD);
                    break;
                }
                case "rhythm":
                {
                    int bx = 20, by = SH - 14, w = 120, win = Js.Round(sp.win * w);
                    Px.R(x, bx, by, w, 8, DARK); Px.R(x, bx + w / 2 - win / 2, by + 1, win, 6, GREEN);
                    if (!(sp.water && I.Players == 1)) Px.R(x, bx + Js.Round(Marker() * w) - 1, by - 3, 3, 14, GOLD);
                    if (sp.water && s.dry) Dot(SW - 22, 18, 6 + pulse, "#4aa6e2");
                    break;
                }
                case "spots":
                    for (int k = 0; k < sp.spots.Length; k++) if (!s.placed.Contains(k)) Dot(sp.spots[k].x, sp.spots[k].y, 2 + pulse, s.tilt && Side(k) == LastSide ? "#e14b3d" : GOLD);
                    break;
                case "hold":
                {
                    var zones = sp.holders == 2 ? new[] { (SW * 0.25f, "p1"), (SW * 0.75f, "p2") } : new[] { (SW / 2f, "p1") };
                    var held = s.held.Values.ToList();
                    foreach (var (zx, who) in zones)
                    {
                        bool on = held.Contains(who) || (who == "p2" && I.Players == 1);
                        int cx = Js.Round(zx), cy = SH / 2;
                        for (int i = 0; i < 48; i++) { float a = i / 48f * Mathf.PI * 2; Px.P(x, cx + Js.Round(Mathf.Cos(a) * 14), cy + Js.Round(Mathf.Sin(a) * 14), on ? GREEN : CREAM); }
                        for (int i = 0; i < Mathf.RoundToInt(s.fill * 64); i++) { float a = -Mathf.PI / 2 + i / 64f * Mathf.PI * 2; for (int rr = 4; rr <= 11; rr++) Px.P(x, cx + Js.Round(Mathf.Cos(a) * rr), cy + Js.Round(Mathf.Sin(a) * rr), GOLD); }
                        if (who == "p2" && I.Players == 1) Px.R(x, cx - 4, cy - 1, 9, 3, GREEN);
                    }
                    break;
                }
                case "turn":
                {
                    int cx = SW / 2, cy = SH / 2, r = 34;
                    for (int i = 0; i < 96; i++) { float a = i / 96f * Mathf.PI * 2; if (i % 2 == 0) Px.P(x, cx + Js.Round(Mathf.Cos(a) * r), cy + Js.Round(Mathf.Sin(a) * r), CREAM); }
                    Dot(cx + Mathf.Cos(s.ang) * r, cy + Mathf.Sin(s.ang) * r, 4, GOLD);
                    break;
                }
            }
        }
    }
}
