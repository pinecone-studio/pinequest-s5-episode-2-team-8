// The screen: touch joystick, tap-to-walk, the HUD, labels over people, toasts, confetti and the window system.
// Drawn with IMGUI so the game needs no UI packages; everything is scaled from a 480-unit-tall layout.
using System;
using System.Collections.Generic;
using UnityEngine;

public sealed partial class Game
{
    // ================================================================ pointer: a finger that drags becomes a joystick right where it landed; a quick tap walks there
    const float STICK_R = 50;
    sealed class Drag { public int id; public Vector2 p0, p; public bool on; }
    Drag drag; Vector2 stick; bool stickOn, runLock, sprintHeld; float lastTouch = -9, guiOX, guiOY;
    Rect sprintRect;
    List<Rect> uiRects = new List<Rect>(), uiNext = new List<Rect>();

    bool OverUI(Vector2 screen) { var g = new Vector2(screen.x, Screen.height - screen.y); foreach (var r in uiRects) if (r.Contains(g)) return true; return false; }

    void Pointer()
    {
        if (Input.touchCount > 0)
        {
            lastTouch = Time.unscaledTime;
            for (int i = 0; i < Input.touchCount; i++) { var t = Input.GetTouch(i); PointerEvent(t.fingerId, t.position, t.phase == TouchPhase.Began, t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled); }
        }
        else if (Time.unscaledTime - lastTouch > 0.5f) // touches also arrive as a fake mouse; ignore that one
            PointerEvent(-1, Input.mousePosition, Input.GetMouseButtonDown(0), Input.GetMouseButtonUp(0));
        sprintHeld = false;
        if (sprintRect.width > 0)
        {
            for (int i = 0; i < Input.touchCount; i++) { var tp = Input.GetTouch(i).position; if (sprintRect.Contains(new Vector2(tp.x, Screen.height - tp.y))) sprintHeld = true; }
            if (Input.touchCount == 0 && Input.GetMouseButton(0) && sprintRect.Contains(new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y))) sprintHeld = true;
        }
        stickOn = drag != null && drag.on;
        if (stickOn) { var d = (drag.p - drag.p0) / (STICK_R * UiScale); if (d.magnitude > 1) d.Normalize(); stick = new Vector2(d.x, -d.y); }
    }
    void PointerEvent(int id, Vector2 pos, bool down, bool up)
    {
        if (modal != null && modal.FullScreen) { modal.Pointer(this, id, pos, down, up); return; }
        if (modal == null && P2Pointer(id, pos, down, up)) return;
        if (down && drag == null && modal == null && !OverUI(pos)) drag = new Drag { id = id, p0 = pos, p = pos };
        if (drag == null || drag.id != id) return;
        drag.p = pos;
        if (!drag.on && (pos - drag.p0).magnitude > 12 * UiScale / 2) { drag.on = true; path.Clear(); pending = null; }
        if (up) { if (!drag.on && modal == null) TapWorld(pos); drag = null; }
    }

    // ================================================================ toasts, floating text, tap rings, confetti
    readonly List<(string text, float t)> toasts = new List<(string, float)>();
    readonly List<(Vector2 at, string text, Color col, float t)> floaters = new List<(Vector2, string, Color, float)>();
    readonly List<(Vector2 at, float t)> rings = new List<(Vector2, float)>();
    sealed class Bit { public Vector2 p, v; public Color c; public float t0, spin; }
    readonly List<Bit> confetti = new List<Bit>();
    public void Toast(string text) { toasts.Add((text, Time.time)); if (toasts.Count > 3) toasts.RemoveAt(0); }
    public void Float(float x, float y, string text, Color col) => floaters.Add((new Vector2(x, y), text, col, Time.time));
    public void Confetti(int n)
    {
        Color[] cols = { Px.Col("#e14b3d"), Px.Col("#3f76db"), Px.Col("#f7c646"), Px.Col("#2ea35f"), Px.Col("#9466e0"), Color.white };
        for (int i = 0; i < n; i++) confetti.Add(new Bit { p = new Vector2(UnityEngine.Random.value * Screen.width, -U(10) - UnityEngine.Random.value * U(80)), v = new Vector2((UnityEngine.Random.value - 0.5f) * U(60), U(120 + UnityEngine.Random.value * 160)), c = cols[i % cols.Length], t0 = Time.time, spin = UnityEngine.Random.value * 10 });
    }

    // ================================================================ windows
    public abstract class Modal
    {
        public virtual float Width => 520;
        public virtual bool FullScreen => false;
        public virtual bool CanEscape => true;
        public abstract void Draw(Game g);
        public virtual void Tick(Game g, float dt) { }
        public virtual void Press(Game g) { }   // Space / E inside the window
        public virtual void Key(Game g) { }     // any other keys, read in Update
        public virtual void Pointer(Game g, int id, Vector2 pos, bool down, bool up) { } // full-screen scenes take the pointer
        public virtual void Closed(Game g) { }
    }
    Modal modal;
    readonly Stack<Modal> under = new Stack<Modal>();
    /** A full-screen scene is showing (maybe under a window opened from it), so the village is hidden. */
    bool InScene { get { if (modal == null) return false; if (modal.FullScreen) return true; foreach (var m in under) if (m.FullScreen) return true; return false; } }
    Modal SceneUnder { get { foreach (var m in under) if (m.FullScreen) return m; return null; } }
    public void Open(Modal m) { if (modal != null && m != null && !modal.FullScreen && m.FullScreen) modal = null; if (modal != null) under.Push(modal); modal = m; drag = null; path.Clear(); pending = null; Sfx.Tap(); }
    /** Closes the top window; a window opened from a full-screen scene goes back to the scene. */
    public void Close() { var m = modal; modal = under.Count > 0 ? under.Pop() : null; m?.Closed(this); if (modal == null) ctx = ContextAction(); }
    public void CloseAll() { while (modal != null) Close(); }
    /** Replaces the current window with another one. */
    public void Swap(Modal m) { var old = modal; modal = m; old?.Closed(this); Sfx.Tap(); }
    void KeysInModal()
    {
        if (Input.GetKeyDown(KeyCode.Escape)) { if (modal.CanEscape) Close(); return; }
        if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.E)) modal.Press(this);
        modal?.Key(this);
    }

    // ================================================================ styles (rebuilt when the screen size changes)
    public float UiScale => Mathf.Max(1, Screen.height / 480f);
    float builtFor = -1;
    public GUIStyle sPanel, sBtn, sPrimary, sLabel, sTitle, sSmall, sChip, sChipText, sToast, sCenter, sTag, sBig;
    Texture2D white;
    readonly Dictionary<PxCanvas, Texture2D> texCache = new Dictionary<PxCanvas, Texture2D>();
    public Texture2D Tex(PxCanvas c) { if (!texCache.TryGetValue(c, out var t)) texCache[c] = t = c.ToTexture(); return t; }

    /** A pixel frame: dark outline, a fill, and a lighter line along the top, at b screen pixels per art pixel. */
    static Texture2D Frame(string fill, string outl, int b)
    {
        int n = 6 * b; var c = new PxCanvas(n, n); Color32 f = Px.Col(fill), o = Px.Col(outl), hi = Px.Col(Px.Shade(fill, 0.25));
        for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
        {
            bool edge = x < b || y < b || x >= n - b || y >= n - b, corner = (x < b || x >= n - b) && (y < b || y >= n - b);
            if (corner) continue;
            c.Put(x, y, edge ? o : y < 2 * b ? hi : f);
        }
        return c.ToTexture();
    }
    GUIStyle Style(Texture2D bg, Texture2D bgOn, int b, int size, Color text, TextAnchor align, bool wrap = false)
    {
        var s = new GUIStyle { fontSize = size, alignment = align, wordWrap = wrap, richText = true, border = new RectOffset(2 * b, 2 * b, 2 * b, 2 * b), padding = new RectOffset(3 * b, 3 * b, 2 * b, 2 * b) };
        s.normal.background = bg; s.normal.textColor = text;
        s.hover.background = bg; s.hover.textColor = text;
        s.active.background = bgOn ?? bg; s.active.textColor = text;
        return s;
    }
    void BuildStyles()
    {
        float s = UiScale; if (Mathf.Approximately(s, builtFor) && sPanel != null) return;
        builtFor = s; int b = Mathf.Max(1, Mathf.RoundToInt(s * 1.5f));
        int F(float v) => Mathf.RoundToInt(v * s);
        white = Texture2D.whiteTexture;
        Color ink = Px.Col("#2b1e2e"), paper = Color.white;
        sPanel = Style(Frame("#f6dca8", "#2b1e2e", b), null, b, F(13), ink, TextAnchor.UpperLeft, true); sPanel.padding = new RectOffset(F(14), F(14), F(12), F(12));
        sBtn = Style(Frame("#f4efe3", "#2b1e2e", b), Frame("#d8cfba", "#2b1e2e", b), b, F(14), ink, TextAnchor.MiddleCenter, true);
        sPrimary = Style(Frame("#3f76db", "#2b1e2e", b), Frame("#2b52a5", "#2b1e2e", b), b, F(14), paper, TextAnchor.MiddleCenter, true); sPrimary.fontStyle = FontStyle.Bold;
        sChip = Style(Frame("#3a2c3e", "#1a1418", b), null, b, F(13), paper, TextAnchor.MiddleLeft); sChip.fontStyle = FontStyle.Bold; sChipText = sChip.Clean();
        sToast = Style(Frame("#2b1e2e", "#1a1418", b), null, b, F(13), paper, TextAnchor.MiddleCenter, true); sToast.padding = new RectOffset(F(10), F(10), F(6), F(6));
        sTag = Style(Frame("#fff8e6", "#2b1e2e", b), null, b, F(11), ink, TextAnchor.MiddleCenter); sTag.padding = new RectOffset(F(5), F(5), F(2), F(2));
        sLabel = new GUIStyle { fontSize = F(13), wordWrap = true, richText = true, normal = { textColor = ink } };
        sSmall = new GUIStyle(sLabel) { fontSize = F(11), normal = { textColor = Px.Col("#6b4220") } };
        sTitle = new GUIStyle(sLabel) { fontSize = F(19), fontStyle = FontStyle.Bold };
        sBig = new GUIStyle(sLabel) { fontSize = F(30), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
        sCenter = new GUIStyle(sLabel) { alignment = TextAnchor.MiddleCenter };
    }
    public float U(float v) => v * UiScale;
    Rect UR(float x, float y, float w, float h) => new Rect(U(x), U(y), U(w), U(h));
    void Ui(Rect r) { if (Event.current.type == EventType.Repaint) uiNext.Add(r); }
    bool Button(Rect r, string text, GUIStyle st = null) { Ui(r); return GUI.Button(r, text, st ?? sBtn); }
    bool IconButton(Rect r, PxCanvas icon, string text = null, GUIStyle st = null)
    {
        bool hit = Button(r, "", st);
        float s = Mathf.Min(r.height - U(10), U(28));
        if (text == null) GUI.DrawTexture(new Rect(r.center.x - s / 2, r.center.y - s / 2, s, s), Tex(icon));
        else { GUI.DrawTexture(new Rect(r.x + U(6), r.center.y - s / 2, s, s), Tex(icon)); GUI.Label(new Rect(r.x + U(8) + s, r.y, r.width - s - U(10), r.height), text, new GUIStyle((st ?? sBtn)) { normal = { background = null }, active = { background = null }, hover = { background = null }, alignment = TextAnchor.MiddleLeft, padding = new RectOffset() }); }
        return hit;
    }
    public void Bar(Rect r, float f, Color fill)
    {
        var old = GUI.color; GUI.color = Px.Col("#2b1e2e"); GUI.DrawTexture(r, white);
        var inner = new Rect(r.x + U(1.5f), r.y + U(1.5f), r.width - U(3), r.height - U(3));
        GUI.color = Px.Col("#5a4a5e"); GUI.DrawTexture(inner, white);
        GUI.color = fill; GUI.DrawTexture(new Rect(inner.x, inner.y, inner.width * Mathf.Clamp01(f), inner.height), white); GUI.color = old;
    }
    public void Box(Rect r, Color c) { var old = GUI.color; GUI.color = c; GUI.DrawTexture(r, white); GUI.color = old; }
    /** Text with a dark outline, like the web version's pixelText, centred on (x, y). */
    public void Outlined(float x, float y, string text, float size, Color col, float alpha = 1)
    {
        if (string.IsNullOrEmpty(text)) return;
        var st = new GUIStyle(sCenter) { fontSize = Mathf.RoundToInt(size), fontStyle = FontStyle.Bold, wordWrap = false };
        var r = new Rect(x - U(150), y - size, U(300), size * 2); float o = Mathf.Max(1, size / 10);
        st.normal.textColor = new Color(0.17f, 0.12f, 0.18f, alpha);
        foreach (var (dx, dy) in new[] { (-o, 0f), (o, 0f), (0f, -o), (0f, o), (-o, -o), (o, o), (-o, o), (o, -o) }) GUI.Label(new Rect(r.x + dx, r.y + dy, r.width, r.height), text, st);
        st.normal.textColor = new Color(col.r, col.g, col.b, alpha); GUI.Label(r, text, st);
    }

    // ================================================================ OnGUI
    void OnGUI()
    {
        BuildStyles();
        if (Event.current.type == EventType.Repaint) uiNext.Clear();
        var safe = Screen.safeArea; float sx = safe.x, sy = Screen.height - safe.yMax, vw = safe.width / UiScale, vh = safe.height / UiScale;
        guiOX = sx; guiOY = sy;
        if (!InScene)
        {
            WorldLabels();
            GUI.BeginGroup(new Rect(sx, sy, safe.width, safe.height));
            Hud(vw, vh);
            GUI.EndGroup();
        }
        if (!InScene && modal == null) { GUI.BeginGroup(new Rect(sx, sy, safe.width, safe.height)); DialogDraw(vw, vh); GUI.EndGroup(); }
        if (modal != null) DrawModal();
        Toasts(sx, sy, vw);
        AchievementPopup();
        ConfettiDraw();
        if (Event.current.type == EventType.Repaint)
        {
            var r = uiNext; uiNext = uiRects; uiRects = r;
            for (int i = 0; i < uiRects.Count; i++) { var q = uiRects[i]; uiRects[i] = new Rect(q.x + sx, q.y + sy, q.width, q.height); }
        }
    }

    Vector2 ToGui(float tileX, float tileY)
    {
        var s = cam.WorldToScreenPoint(new Vector3(tileX, -tileY, 0));
        return new Vector2(s.x, Screen.height - s.y);
    }
    /** Art pixel (X, Y) of the village to a screen point. */
    Vector2 PxGui(float X, float Y) => ToGui(X / T, Y / T);
    float ArtPx => Screen.height / (2 * cam.orthographicSize) / T; // screen pixels per art pixel

    void WorldLabels()
    {
        SeasonFx();
        float ts = Mathf.Max(U(9), 5 * Mathf.Max(2, ArtPx)), t = Time.time;
        Color gold = Px.Col("#f7c646"), green = Px.Col("#7fe07a");
        // tap rings, floating "+XP" and hearts
        for (int i = rings.Count - 1; i >= 0; i--)
        {
            float age = Time.time - rings[i].t; if (age > 0.6f) { rings.RemoveAt(i); continue; }
            var p = ToGui(rings[i].at.x, rings[i].at.y); float r = U(6 + age * 18);
            var old = GUI.color; GUI.color = new Color(1, 1, 1, 1 - age / 0.6f); GUI.DrawTexture(new Rect(p.x - r, p.y - r * 0.5f, r * 2, r), Tex(Ring())); GUI.color = old;
        }
        // names over the townspeople, with ! for a new task and ? when one is done
        foreach (var o in World.objects)
        {
            if (o.kind != "npc" && o.kind != "npcq" && o.kind != "emee" && o.kind != "general" && o.kind != "historian") continue;
            var p = PxGui(o.x * T + 8, o.y * T - 16);
            string name = o.kind == "npc" ? Loc.L("Засуул", "Herald") : o.kind == "emee" ? Loc.L("Эмээ", "Grandma") : o.kind == "general" ? Loc.L("Жанжин", "General") : o.kind == "historian" ? Loc.L("Түүхч", "Historian") : LastWord(Rules.NpcById(o.id).name.ToString());
            Outlined(p.x, p.y, name, ts * 0.8f, o.kind == "npcq" ? Color.white : gold);
            string mk = o.kind == "npcq" ? NpcMark(o.id) : o.kind == "emee" && V.emee.visits == 0 ? "!" : o.kind == "historian" && HistoryReady() ? "!" : "";
            if (mk != "") Outlined(p.x, p.y - 9 * ArtPx + Mathf.Round(Mathf.Sin(t * 5.5f + o.x) * 2) * ArtPx / 2, mk, ts * 1.6f, mk == "?" ? green : gold);
        }
        if (V.lot.i >= 0) { var o = World.objects.Find(q => q.kind == "lot" && q.i == V.lot.i); var p = PxGui(o.x * T + 24, o.y * T - 4); Outlined(p.x, p.y, MyName, ts, gold); }
        { var p = PxGui(dgx * T + 8, dgy * T - 4); Outlined(p.x, p.y, Loc.L("Басар", "Basar"), ts * 0.8f, gold); if (dogBubble != null) Outlined(p.x + 5 * ArtPx, p.y - 6 * ArtPx + Mathf.Round(Mathf.Sin(t * 5.5f) * 2) * ArtPx / 2, "!", ts * 1.6f, gold); }
        MyLabel(ts);
        if (race != null) RaceLabels(ts);
        BattleOverlay(ts);
        NetLabels(ts);
        P2Label(ts);
        for (int i = floaters.Count - 1; i >= 0; i--)
        {
            var f = floaters[i]; float age = Time.time - f.t; if (age > 1.4f) { floaters.RemoveAt(i); continue; }
            var p = ToGui(f.at.x, f.at.y - age * 0.9f); Outlined(p.x, p.y, f.text, ts * 1.1f, f.col, 1 - age / 1.4f);
        }
        if (stickOn)
        {
            var b = new Vector2(drag.p0.x, Screen.height - drag.p0.y); float R = STICK_R * UiScale;
            var old = GUI.color; GUI.color = new Color(1, 1, 1, 0.35f); GUI.DrawTexture(new Rect(b.x - R, b.y - R, R * 2, R * 2), Tex(Disc()));
            var k = b + new Vector2(stick.x, -stick.y) * R; GUI.color = new Color(1, 1, 1, 0.8f); GUI.DrawTexture(new Rect(k.x - R * 0.42f, k.y - R * 0.42f, R * 0.84f, R * 0.84f), Tex(Disc())); GUI.color = old;
        }
    }
    static string LastWord(string s) { int i = s.LastIndexOf(' '); return i < 0 ? s : s.Substring(i + 1); }
    /** Your level in a gold box and your name in a blue one, with your wrestling title above. */
    void MyLabel(float ts)
    {
        var p = PxGui(px * T + 8, py * T - 16 - (riding ? 10 : 0));
        var st = new GUIStyle(sCenter) { fontSize = Mathf.RoundToInt(ts), fontStyle = FontStyle.Bold, wordWrap = false };
        string lv = Rules.Level(V.xp).l.ToString(), nm = MyName;
        float pad = ts * 0.45f, th = ts + U(4), lw = st.CalcSize(new GUIContent(lv)).x + pad * 2, nw = st.CalcSize(new GUIContent(nm)).x + pad * 2, gap = U(3), x0 = p.x - (lw + gap + nw) / 2, y = p.y - th / 2, u = Mathf.Max(1, U(1));
        void BoxT(float bx, float w, string bg, string fg, string text) { Box(new Rect(bx - u, y - u, w + 2 * u, th + 2 * u), Px.Col("#2b1e2e")); Box(new Rect(bx, y, w, th), Px.Col(bg)); st.normal.textColor = Px.Col(fg); GUI.Label(new Rect(bx, y, w, th), text, st); }
        BoxT(x0, lw, "#f7c646", "#3a2600", lv); BoxT(x0 + lw + gap, nw, "#3f76db", "#ffffff", nm);
        var title = Rules.TitleById(Rules.TitleFor(V.wr));
        if (title != null) Outlined(p.x, y - th / 2 - u * 2, "♦ " + title.name, ts, Px.Col("#f7c646"));
    }
    static PxCanvas ringArt, discArt;
    static PxCanvas Ring() { if (ringArt != null) return ringArt; ringArt = new PxCanvas(32, 32); for (int y = 0; y < 32; y++) for (int x = 0; x < 32; x++) { float d = Mathf.Sqrt((x - 15.5f) * (x - 15.5f) + (y - 15.5f) * (y - 15.5f)); if (d > 12 && d < 15.5f) ringArt.Put(x, y, Color.white); } return ringArt; }
    static PxCanvas Disc() { if (discArt != null) return discArt; discArt = new PxCanvas(64, 64); for (int y = 0; y < 64; y++) for (int x = 0; x < 64; x++) { float d = Mathf.Sqrt((x - 31.5f) * (x - 31.5f) + (y - 31.5f) * (y - 31.5f)); if (d < 31.5f) discArt.Put(x, y, d > 28 ? new Color32(43, 30, 46, 255) : new Color32(255, 255, 255, 200)); } return discArt; }

    void Toasts(float sx, float sy, float vw)
    {
        float ty = 8;
        for (int i = toasts.Count - 1; i >= 0; i--) if (Time.time - toasts[i].t > 3.6f) toasts.RemoveAt(i);
        foreach (var t in toasts) { float w = Mathf.Min(460, vw - 32); var r = new Rect(sx + U((vw - w) / 2), sy + U(ty + 44), U(w), U(44)); GUI.Box(r, t.text, sToast); ty += 50; }
    }
    void ConfettiDraw()
    {
        if (confetti.Count == 0 || Event.current.type != EventType.Repaint) return;
        float dt = Time.deltaTime;
        for (int i = confetti.Count - 1; i >= 0; i--)
        {
            var b = confetti[i]; b.p += b.v * dt; b.v.y += U(80) * dt;
            if (b.p.y > Screen.height + U(20) || Time.time - b.t0 > 5) { confetti.RemoveAt(i); continue; }
            float w = U(6) * Mathf.Abs(Mathf.Sin(Time.time * 6 + b.spin)) + U(1);
            Box(new Rect(b.p.x - w / 2, b.p.y, w, U(6)), b.c);
        }
    }

    void Hud(float vw, float vh)
    {
        sprintRect = Rect.zero;
        // top left: coins, level and XP, energy
        var lv = Rules.Level(V.xp);
        var chip = UR(8, 8, 190, 64); Ui(chip); GUI.Box(chip, GUIContent.none, sChip);
        GUI.DrawTexture(UR(14, 13, 22, 22), Tex(Px.Icon("ui:coin"))); GUI.Label(UR(40, 12, 60, 24), V.coins.ToString(), sChipText);
        GUI.Label(UR(100, 12, 90, 24), Loc.L("Түвшин ", "Lv ") + lv.l, sChipText);
        Bar(UR(16, 40, 174, 10), lv.cur / (float)lv.need, Px.Col("#f7c646"));
        Bar(UR(16, 54, 174, 10), V.energy / Rules.ENERGY_MAX, Px.Col("#2ea35f"));
        // top right: language, the bag and food
        if (IconButton(UR(vw - 58, 8, 50, 40), Px.Icon("ui:menu"))) Later(() => Open(new MenuModal()));
        if (IconButton(UR(vw - 112, 8, 50, 40), Px.Icon("ui:bag"))) Later(() => Open(new BagModal()));
        if (IconButton(UR(vw - 166, 8, 50, 40), Px.Icon("dairy:urum"))) Later(() => Open(new FoodModal("meat")));
        if (IconButton(UR(vw - 220, 8, 50, 40), Px.Icon("ui:scroll"))) Later(() => Open(new QuestModal()));
        if (IconButton(UR(vw - 274, 8, 50, 40), Px.Icon("ui:book"))) Later(() => Open(new LearnPage()));
        if (Button(UR(vw - 314, 8, 36, 40), "?")) Later(() => StartTutorial(true));
        if (race == null && battle == null && IconButton(UR(8, 78, 50, 44), Px.BankharFace(0))) Later(() => OpenBasar());
        if (race == null && battle == null && Button(UR(62, 78, 50, 44), "3D")) Later(() => TryFirstPerson(null));
        { // playing together: who is here, the room
            var nr = UR(116, 78, 150, 44); string nt = net.Online ? $"● {net.others.Count + 1} · {net.room}" + (net.unread > 0 ? $"  ({net.unread})" : "") : net.status == "solo" ? "○ " + Loc.L("Ганцаараа", "Solo") : "◌ " + Loc.L("Холбогдож…", "Connecting…");
            if (race == null && battle == null && Button(nr, nt, net.Online ? sPrimary : sBtn)) Later(() => Open(new RoomModal()));
            if (race == null && battle == null && Button(UR(270, 78, 110, 44), p2 != null ? "● " + p2.name : Loc.L("Хамтдаа", "Together"), p2 != null ? sPrimary : sBtn)) Later(() => Open(new TogetherModal()));
        }
        GlowAt("coins", UR(8, 8, 110, 30)); GlowAt("energy", UR(8, 50, 190, 18)); GlowAt("quests", UR(vw - 220, 8, 50, 40)); GlowAt("learn", UR(vw - 274, 8, 50, 40));
        GlowAt("help", UR(vw - 314, 8, 36, 40)); GlowAt("basar", UR(8, 78, 50, 44)); GlowAt("fp", UR(62, 78, 50, 44));
        if (race != null) { RaceHud(vw, vh); return; }
        if (battle != null)
        {
            GUI.Box(UR(vw / 2 - 210, 56, 420, 34), BattleLabel(), sToast);
            if (Input.touchSupported && Button(UR(vw - 166, vh - 128, 158, 56), Loc.L("Сум харвах (F)", "Shoot (F)"), sPrimary)) ShootNearest();
            else if (!Input.touchSupported) GUI.Box(UR(vw / 2 - 160, 94, 320, 26), Loc.L("F: сум харвах · E: уургадах", "F: shoot · E: lasso"), sToast);
        }
        if (Time.timeSinceLevelLoad < 9 && modal == null)
        {
            string hint = Input.touchSupported ? Loc.L("Дэлгэц дээр чирж алх, товшиж оч", "Drag on the screen to walk, tap to go somewhere")
                                              : Loc.L("WASD/сумаар алх · Shift гүйх · Space үсрэх · E хэрэглэх", "WASD/arrows walk · Shift run · Space jump · E use");
            GUI.Box(UR(vw / 2 - 210, vh - 118, 420, 32), hint, sToast);
        }
        // bottom: your milk and the dairy foods you made. Tap a food to eat it.
        float x = 8;
        foreach (var k in Rules.DAIRY_ORDER)
        {
            int n = V.Have(k); if (n <= 0) continue;
            var r = UR(x, vh - 56, 48, 48);
            if (Button(r, "")) Later(() => { if (Rules.DAIRY[k].food) Eat(k); else Toast($"{Rules.DAIRY[k].name}: " + Loc.L("тавиур, тулга, хөхүүр дээр цагаан идээ хийнэ.", "make dairy foods at the rack, stove or churn.")); });
            GUI.DrawTexture(UR(x + 10, vh - 53, 28, 28), Tex(Px.Icon("dairy:" + k)));
            GUI.Label(UR(x + 4, vh - 26, 40, 16), n.ToString(), new GUIStyle(sCenter) { fontSize = Mathf.RoundToInt(U(11)), fontStyle = FontStyle.Bold });
            x += 52;
        }
        if (x == 8 && Button(UR(x, vh - 56, 48, 48), "")) Later(() => GoTo(9, 14, null)); // nothing yet: a shortcut to the dairy yard
        if (x == 8) GUI.DrawTexture(UR(x + 8, vh - 50, 32, 32), Tex(Px.Icon("beast:cow")));
        // bottom right: riding, run and jump for touch, and the action button
        float bx = vw - 166;
        if (riding && Button(UR(bx - 66, vh - 56, 60, 48), Loc.L("Буух", "Get off"))) Later(Dismount);
        if (riding) bx -= 66;
        if (Input.touchSupported) { if (Button(UR(bx - 60, vh - 56, 56, 48), runLock ? Loc.L("Алхах", "Walk") : Loc.L("Гүйх", "Run"), runLock ? sPrimary : sBtn)) runLock = !runLock; if (Button(UR(bx - 120, vh - 56, 56, 48), Loc.L("Үсрэх", "Jump"))) Jump(); GlowAt("run", UR(bx - 60, vh - 56, 56, 48)); GlowAt("jump", UR(bx - 120, vh - 56, 56, 48)); }
        if (ctx != null && modal == null)
        {
            string label = LabelFor(ctx) + (Input.touchSupported ? "" : "  [E]");
            var here = ctx; if (Button(UR(vw - 166, vh - 64, 158, 56), label, sPrimary)) Later(() => DoAction(here));
        }
    }

    void DrawModal()
    {
        if (modal.FullScreen) { modal.Draw(this); return; }
        var sc = SceneUnder; if (sc != null && Event.current.type == EventType.Repaint) sc.Draw(this); // the scene stays behind its windows
        // dim the village, then a centred window that grows with its content
        Box(new Rect(0, 0, Screen.width, Screen.height), new Color(0.1f, 0.06f, 0.12f, 0.55f));
        float w = Mathf.Min(U(modal.Width), Screen.width - U(24)), h = Screen.height - U(24);
        GUILayout.BeginArea(new Rect((Screen.width - w) / 2, U(12), w, h));
        GUILayout.FlexibleSpace();
        GUILayout.BeginVertical(sPanel);
        var m = modal; m.Draw(this);
        GUILayout.EndVertical();
        GUILayout.FlexibleSpace();
        GUILayout.EndArea();
    }

    // little layout helpers for the windows
    public void Title(string t) => GUILayout.Label(t, sTitle);
    public void Text(string t) => GUILayout.Label(t, sLabel);
    public void Small(string t) => GUILayout.Label(t, sSmall);
    public void Gap(float v = 8) => GUILayout.Space(U(v));
    public bool Btn(string t, bool primary = false, float h = 40, bool enabled = true)
    {
        bool was = GUI.enabled; GUI.enabled = enabled;
        bool hit = GUILayout.Button(t, primary ? sPrimary : sBtn, GUILayout.MinHeight(U(h)));
        GUI.enabled = was; return hit;
    }
    public bool SmallBtn(string t, bool primary = true, float w = 96, bool enabled = true)
    {
        bool was = GUI.enabled; GUI.enabled = enabled;
        bool hit = GUILayout.Button(t, primary ? sPrimary : sBtn, GUILayout.Width(U(w)), GUILayout.MinHeight(U(34)));
        GUI.enabled = was; return hit;
    }
    public void Fact(string text, bool first = true, string head = null)
    {
        GUILayout.BeginVertical(sBtn);
        GUILayout.Label("<b>" + (head ?? (first ? Loc.L("Мэдсэн үү?", "Did you know?") : Loc.L("Сануулга", "Remember"))) + "</b>", sLabel);
        GUILayout.Label(text, sLabel);
        GUILayout.EndVertical();
    }
    public void Picture(PxCanvas art, float height)
    {
        var r = GUILayoutUtility.GetRect(U(height) * art.W / art.H, U(height), GUILayout.ExpandWidth(true));
        float w = r.height * art.W / art.H; GUI.DrawTexture(new Rect(r.center.x - w / 2, r.y, w, r.height), Tex(art));
    }
    public void IconAt(PxCanvas art, float size) { var r = GUILayoutUtility.GetRect(U(size), U(size), GUILayout.Width(U(size)), GUILayout.Height(U(size))); GUI.DrawTexture(r, Tex(art)); }
    /** A row in a list: icon, a bold name and a small line, and room for a button after (call EndRow). */
    public void Row(PxCanvas icon, string name, string sub, bool dim = false)
    {
        GUILayout.BeginHorizontal(sBtn);
        var old = GUI.color; if (dim) GUI.color = new Color(1, 1, 1, 0.55f);
        if (icon != null) IconAt(icon, 32);
        GUILayout.BeginVertical();
        GUILayout.Label("<b>" + name + "</b>", sLabel);
        if (!string.IsNullOrEmpty(sub)) GUILayout.Label(sub, sSmall);
        GUILayout.EndVertical();
        GUI.color = old;
    }
    public void EndRow() => GUILayout.EndHorizontal();
    public void Stats(params (string k, string v)[] items)
    {
        GUILayout.BeginHorizontal();
        foreach (var (k, v) in items) { GUILayout.BeginVertical(sBtn); GUILayout.Label(k, sSmall); GUILayout.Label("<b>" + v + "</b>", sTitle); GUILayout.EndVertical(); }
        GUILayout.EndHorizontal();
    }
    /** Chips to pick one of several values; returns the picked index or -1. */
    public int Chips(IList<string> labels, int current, float minW = 60)
    {
        int hit = -1; GUILayout.BeginHorizontal();
        for (int i = 0; i < labels.Count; i++) { if (i > 0 && i % 5 == 0) { GUILayout.EndHorizontal(); GUILayout.BeginHorizontal(); } if (GUILayout.Button(labels[i], i == current ? sPrimary : sBtn, GUILayout.MinWidth(U(minW)), GUILayout.MinHeight(U(32)))) hit = i; }
        GUILayout.EndHorizontal(); return hit;
    }
    public bool Swatch(Color c, bool on, float size = 36)
    {
        var r = GUILayoutUtility.GetRect(U(size), U(size), GUILayout.Width(U(size)), GUILayout.Height(U(size)));
        bool hit = GUI.Button(r, "", on ? sPrimary : sBtn); Box(new Rect(r.x + U(5), r.y + U(5), r.width - U(10), r.height - U(10)), c); return hit;
    }

    // ---------------------------------------------------------------- a picture redrawn every frame (mini-games, scenes)
    public sealed class Live
    {
        public readonly PxCanvas c; readonly Texture2D tex; public Rect last;
        public Live(int w, int h) { c = new PxCanvas(w, h); tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp }; }
        /** Draws the picture into a rectangle taken from the layout, as big as fits the width (keeping its shape). */
        public Rect Show(Game g, float maxH)
        {
            var r = GUILayoutUtility.GetRect(10, g.U(maxH), GUILayout.ExpandWidth(true));
            float s = Mathf.Min(r.width / c.W, r.height / c.H); var rr = new Rect(r.center.x - c.W * s / 2, r.y, c.W * s, c.H * s);
            ShowAt(rr); return rr;
        }
        public void ShowAt(Rect rr) { last = rr; if (Event.current.type == EventType.Repaint) { c.Upload(tex); GUI.DrawTexture(rr, tex); } }
        /** Canvas pixel to screen (GUI) point, for text over the picture. */
        public Vector2 At(float x, float y) => new Vector2(last.x + x * last.width / c.W, last.y + y * last.height / c.H);
        /** Screen (GUI) point to canvas pixel. */
        public Vector2 Pick(Vector2 gui) => new Vector2((gui.x - last.x) * c.W / last.width, (gui.y - last.y) * c.H / last.height);
        public float Scale => last.width / c.W;
    }

    // ---------------------------------------------------------------- simple messages and fact cards
    public sealed class InfoModal : Modal
    {
        readonly string title, text;
        public InfoModal(string title, string text) { this.title = title; this.text = text; }
        public override void Draw(Game g) { g.Title(title); g.Text(text); g.Gap(); if (g.Btn(Loc.L("Ойлголоо", "OK"), true)) g.Later(g.Close); }
        public override void Press(Game g) => g.Close();
    }
    public sealed class FactModal : Modal
    {
        readonly PxCanvas pic; readonly string title, fact, head;
        public FactModal(PxCanvas pic, string title, string fact, string head = null) { this.pic = pic; this.title = title; this.fact = fact; this.head = head; }
        public override void Draw(Game g)
        {
            if (pic != null) g.Picture(pic, 72);
            if (head != null) GUILayout.Label(head, new GUIStyle(g.sSmall) { alignment = TextAnchor.MiddleCenter });
            GUILayout.Label(title, new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            g.Fact(fact); g.Gap();
            if (g.Btn(Loc.L("Гайхалтай!", "Cool!"), true)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }
    /** Basar introduces himself the first time you come to Нутаг. */
    sealed class TipsModal : Modal
    {
        public override void Draw(Game g)
        {
            g.Picture(Px.BankharFace(0), 72);
            g.Title(Loc.L($"Вуф! Сайн уу, {g.MyName}!", $"Woof! Hi {g.MyName}!"));
            g.Text(Loc.L("Би Басар, монгол банхар нохой. Нутагт үргэлж хажууд чинь явна. Намайг дарж юу ч асуугаарай!", "I’m Basar, a Mongolian Bankhar dog. I’ll walk beside you everywhere in Nutag. Tap me to ask me anything!"));
            foreach (var (ic, t) in new[]
            {
                ("ui:star", Loc.L("Газар дээр дарж алх. Компьютер дээр сум эсвэл WASD товч.", "Tap the ground to walk. On a computer use arrows or WASD.")),
                ("beast:cow", Loc.L("Хот айлд үнээ, ямаа, гүүгээ саагаад ааруул, өрөм, тараг, айраг хий.", "In the dairy yard milk the cows, goats and mares, then make aaruul, öröm, tarag and airag.")),
                ("ui:book", Loc.L("Сургуулийн гэрт гэр барих, цагаан идээ хийх, Нууц товчоог сур. Сурснаа гэр бүлтэйгээ хий!", "In the school ger learn to build a ger, make dairy foods and hear the Secret History. Then do it with your family!")),
                ("ui:ger", Loc.L("Гэр хороололд өөрийн гэрээ бариарай.", "Build your own ger in the ger neighbourhood.")),
                ("ui:horse", Loc.L("Морины уяанаас морь унаж давхих, эсвэл уралдаанд оролцоорой!", "Take a horse from the horse line to ride freely or race!")),
            }) { g.Row(Px.Icon(ic), "", null); GUILayout.Label(t, g.sLabel); g.EndRow(); }
            g.Gap();
            if (g.Btn(Loc.L("Эхлэх", "Let's go"), true, 48)) g.Later(g.Close);
        }
        public override void Closed(Game g) { g.V.tips = true; g.V.Save(); }
        public override void Press(Game g) => g.Close();
    }
}

static class GuiStyleExt
{
    /** The same text style without the background, for labels drawn on top of a chip. */
    public static GUIStyle Clean(this GUIStyle s) { var c = new GUIStyle(s) { padding = new RectOffset(0, 0, 0, 0) }; c.normal.background = null; return c; }
}
