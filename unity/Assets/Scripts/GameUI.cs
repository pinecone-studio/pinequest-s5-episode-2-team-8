// The screen: touch joystick, tap-to-walk, the HUD, labels over people, toasts, confetti and the window system.
// Drawn with IMGUI so the game needs no UI packages; everything is scaled from a 480-unit-tall layout.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    // ================================================================ pointer: a finger that drags becomes a joystick right where it landed; a quick tap walks there
    const float STICK_R = 56;
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
        if (stickOn)
        {
            // the ring slides along behind a thumb that goes past it, so pulling back turns around at once
            float R = STICK_R * UiScale; var off = drag.p - drag.p0; if (off.magnitude > R) { drag.p0 += off - off.normalized * R; off = drag.p - drag.p0; }
            var d = off / R; stick = new Vector2(d.x, -d.y);
        }
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
        public virtual float Width => 640;
        public virtual bool FullScreen => false;
        public virtual bool CanEscape => true;
        public abstract void Draw(Game g);
        public virtual void Tick(Game g, float dt) { }
        public virtual void Press(Game g) { }   // Space / E inside the window
        public virtual void Key(Game g) { }     // any other keys, read in Update
        public virtual void Pointer(Game g, int id, Vector2 pos, bool down, bool up) { } // full-screen scenes take the pointer
        public virtual void Closed(Game g) { }
        public Vector2 winScroll; // a window taller than the screen scrolls (DrawModal)
    }
    Modal modal; Rect modalPanel; // where the open window is on the screen, for its ✕ and for taps outside it
    readonly Stack<Modal> under = new Stack<Modal>();
    /** A full-screen scene is showing (maybe under a window opened from it), so the village is hidden. */
    bool InScene { get { if (modal == null) return false; if (modal.FullScreen) return true; foreach (var m in under) if (m.FullScreen) return true; return false; } }
    Modal SceneUnder { get { foreach (var m in under) if (m.FullScreen) return m; return null; } }
    public void Open(Modal m) { modalPanel = Rect.zero; if (modal != null && m != null && !modal.FullScreen && m.FullScreen) modal = null; if (modal != null) under.Push(modal); modal = m; drag = null; path.Clear(); pending = null; Sfx.Tap(); }
    /** Closes the top window; a window opened from a full-screen scene goes back to the scene. */
    public void Close() { modalPanel = Rect.zero; var m = modal; modal = under.Count > 0 ? under.Pop() : null; m?.Closed(this); if (modal == null) ctx = ContextAction(); }
    public void CloseAll() { while (modal != null) Close(); }
    /** Replaces the current window with another one. */
    public void Swap(Modal m) { modalPanel = Rect.zero; var old = modal; modal = m; old?.Closed(this); Sfx.Tap(); }
    void KeysInModal()
    {
        if (Input.GetKeyDown(KeyCode.Escape)) { if (modal.CanEscape) Close(); return; }
        if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.E)) modal.Press(this);
        modal?.Key(this);
    }

    // ================================================================ styles (rebuilt when the screen size changes)
    // One unit is one CSS pixel of the web version (screen pixels per CSS pixel, as the browser's devicePixelRatio), so a
    // laptop shows the same sizes as the web page; a short screen scales down so the layout's 520 × 900 units still fit.
    public float UiScale => Mathf.Min(Dpr, Screen.height / 520f, Screen.width / 900f);
#if UNITY_WEBGL && !UNITY_EDITOR
    [System.Runtime.InteropServices.DllImport("__Internal")] static extern float NaadamyDpr(); // Plugins/WebGL/NaadamyPointer.jslib
    static float Dpr => NaadamyDpr();
#else
    static float Dpr => Application.isMobilePlatform && Screen.dpi > 0 ? Mathf.Clamp(Screen.dpi / 160f, 1, 3) : 1;
#endif
    /** Phones and tablets get on-screen buttons and touch hints; a computer uses the keys Bolormaa teaches. */
    public static bool TouchUI => Application.isMobilePlatform;
    float builtFor = -1;
    public GUIStyle sPanel, sBtn, sPrimary, sLabel, sTitle, sSmall, sChip, sChipText, sToast, sCenter, sTag, sBig, sOpt, sSel, sPixel, sTeach, sKicker, sNote, sSlot, sChipHi, sWhite, sNav, sNavOn, sTabOff, sField, sTile, sLogo;
    Texture2D white;
    readonly Dictionary<PxCanvas, Texture2D> texCache = new Dictionary<PxCanvas, Texture2D>();
    public Texture2D Tex(PxCanvas c) { if (!texCache.TryGetValue(c, out var t)) texCache[c] = t = c.ToTexture(); return t; }

    /** A frame drawn like the web version's CSS: rings of colour from the edge inwards (its inset box-shadows), cut corners
     *  (its clip-path) and a darker copy below (a button's press shadow), at u screen pixels per CSS pixel. */
    static Texture2D Frame(string fill, (string col, int w)[] rings, int cut, string drop, int dropH, int u)
    {
        int ring = 0; foreach (var r in rings) ring += r.w;
        int n = 2 * (ring + cut + 1) * u + 2, H = n + dropH * u; var c = new PxCanvas(n, H);
        Color32 F = Px.Col(fill), D = drop != null ? Px.Col(drop) : default;
        Color32? At(int x, int y)
        {
            float dx = Mathf.Min(x, n - 1 - x) / (float)u, dy = Mathf.Min(y, n - 1 - y) / (float)u;
            if (dx + dy < cut) return null;
            float d = Mathf.Min(dx, dy), acc = 0;
            foreach (var r in rings) { acc += r.w; if (d < acc) return Px.Col(r.col); }
            return F;
        }
        for (int y = 0; y < H; y++) for (int x = 0; x < n; x++)
        {
            var top = y < n ? At(x, y) : null;
            if (top != null) c.Put(x, y, top.Value);
            else if (drop != null && y >= dropH * u && At(x, y - dropH * u) != null) c.Put(x, y, D);
        }
        return c.ToTexture();
    }
    /** A style on a Frame texture: its corners and press shadow stay sharp, the middle stretches. */
    GUIStyle Style(Texture2D bg, Texture2D bgOn, Font font, int size, Color text, TextAnchor align, bool wrap = false)
    {
        int e = (bg.width - 2) / 2, drop = bg.height - bg.width;
        var s = new GUIStyle { font = font, fontSize = size, alignment = align, wordWrap = wrap, richText = true, border = new RectOffset(e, e, e, e + drop), padding = new RectOffset(e + size / 3, e + size / 3, e + size / 4, e + drop + size / 4) };
        s.normal.background = bg; s.normal.textColor = text;
        s.hover.background = bg; s.hover.textColor = text;
        s.active.background = bgOn ?? bg; s.active.textColor = text;
        return s;
    }
    void BuildStyles()
    {
        float s = UiScale; if (Mathf.Approximately(s, builtFor) && sPanel != null) return;
        builtFor = s; int u = Mathf.Max(1, Mathf.RoundToInt(s));
        int F(float v) => PxSize(v * s * 1.3f); // pixel letters need to be a bit bigger than smooth ones to read easily
        int T(float css) => Mathf.Max(10, Mathf.RoundToInt(css * s)); // smooth text, in the web version's CSS pixels
        white = Texture2D.whiteTexture;
        Color ink = Px.Col("#4a2a12"), paper = Color.white;
        // the web version's village skin (styles.css): parchment, wood frames, Rubik buttons and headings, Nunito text, Tiny5 labels
        (string, int)[] Ring(string c, int w) => new[] { (c, w) };
        sPanel = Style(Frame("#f6dca8", new[] { ("#5a2d10", 2), ("#e5a157", 3), ("#8a4b1f", 3) }, 6, null, 0, u), null, bodyFont, T(15), ink, TextAnchor.UpperLeft, true);
        sPanel.padding = new RectOffset(T(28), T(28), T(30), T(26));
        sBtn = Style(Frame("#fbe8c2", Ring("#c99a5a", 2), 0, "#8a4b1f", 3, u), Frame("#f1d7a6", Ring("#c99a5a", 2), 0, "#8a4b1f", 3, u), displayFont, T(16), ink, TextAnchor.MiddleCenter, true);
        sPrimary = Style(Frame("#e9a24a", Ring("#f7c98a", 2), 0, "#8a4b1f", 3, u), Frame("#d98f35", Ring("#f7c98a", 2), 0, "#8a4b1f", 3, u), displayFont, T(16), Px.Col("#3a1e08"), TextAnchor.MiddleCenter, true);
        sSel = Style(Frame("#fff3c4", Ring("#e14b3d", 3), 0, null, 0, u), null, displayFont, T(16), ink, TextAnchor.MiddleCenter, true); // a picked tile or swatch: a red outline
        sChip = Style(Frame("#f6dca8", new[] { ("#e5a157", 2), ("#8a4b1f", 2) }, 4, "#5a2d10", 4, u), null, pixelFont, F(11), ink, TextAnchor.MiddleLeft); sChipText = sChip.Clean();
        sToast = Style(Frame("#141b2d", new (string, int)[0], 4, null, 0, u), null, bodyFont, T(15), paper, TextAnchor.MiddleCenter, true); sToast.padding = new RectOffset(T(18), T(18), T(10), T(10));
        sOpt = Style(Frame("#08060e", Ring("#ffffff", 3), 0, null, 0, u), Frame("#08060e", Ring("#f7c646", 3), 0, null, 0, u), pixelFont, F(14), paper, TextAnchor.MiddleLeft, true); // an answer in the story box
        sTag = Style(Frame("#fbe8c2", Ring("#c99a5a", 2), 0, null, 0, u), null, pixelFont, F(10), ink, TextAnchor.MiddleCenter); sTag.padding = new RectOffset(T(6), T(6), T(2), T(2));
        sLabel = new GUIStyle { font = bodyFont, fontSize = T(15), wordWrap = true, richText = true, normal = { textColor = ink } };
        sSmall = new GUIStyle(sLabel) { fontSize = T(13), normal = { textColor = Px.Col("#7a5432") } };
        sTitle = new GUIStyle(sLabel) { font = displayFont, fontSize = T(23), normal = { textColor = Px.Col("#5a2d10") } };
        sBig = new GUIStyle(sTitle) { fontSize = T(34), alignment = TextAnchor.MiddleCenter };
        sCenter = new GUIStyle(sLabel) { alignment = TextAnchor.MiddleCenter };
        sPixel = new GUIStyle(sCenter) { font = pixelFont, wordWrap = false }; // the village's labels, as the web version draws them in Tiny5
        sTeach = Style(Frame("#fffaf0", Ring("#c99a5a", 2), 0, null, 0, u), null, bodyFont, T(15), ink, TextAnchor.UpperLeft, true); sTeach.padding = new RectOffset(T(12), T(12), T(8), T(8)); // what a person says, in a speech box
        sKicker = new GUIStyle(sLabel) { fontSize = T(12), normal = { textColor = Px.Col("#6b7280") } }; // the small grey line above a heading
        sChipHi = Style(Frame("#fff3c4", new[] { ("#e5a157", 2), ("#8a4b1f", 2) }, 4, "#5a2d10", 4, u), null, pixelFont, F(11), ink, TextAnchor.MiddleLeft); // Basar's button stands out (.v-basar)
        // the app's own pages (the web version's shell): white chips and a white tab bar on a warm grey page
        sWhite = Style(Frame("#ffffff", Ring("#e6e1d6", 1), 3, null, 0, u), Frame("#f3f1ec", Ring("#e6e1d6", 1), 3, null, 0, u), displayFont, T(16), Px.Col("#141b2d"), TextAnchor.MiddleCenter);
        sNav = Style(Frame("#fdfcfa", Ring("#e6e1d6", 1), 8, null, 0, u), null, bodyFont, T(11), ink, TextAnchor.MiddleCenter);
        sNavOn = Style(Frame("#eef3ff", new (string, int)[0], 6, null, 0, u), null, bodyFont, T(11), ink, TextAnchor.MiddleCenter);
        sTabOff = Style(Frame("#c5dbe3", Ring("#b9c7c4", 2), 0, null, 0, u), null, displayFont, T(16), Px.Col("#7c8a8c"), TextAnchor.MiddleCenter); // the other tab on the sign-up screen
        sField = Style(Frame("#fffaf0", Ring("#c99a5a", 2), 0, null, 0, u), null, bodyFont, T(20), ink, TextAnchor.MiddleCenter); // a text box
        sTile = Style(Frame("#fde8c3", Ring("#c99a5a", 2), 0, null, 0, u), Frame("#f7dcb0", Ring("#c99a5a", 2), 0, null, 0, u), bodyFont, T(12), ink, TextAnchor.MiddleCenter); // a tile to pick in a grid
        sLogo = Style(Frame("#2f6bff", new (string, int)[0], 6, null, 0, u), null, bodyFont, T(12), ink, TextAnchor.MiddleCenter);
        sSlot = Style(Frame("#e6c48a", Ring("#c99a5a", 2), 0, null, 0, u), null, pixelFont, F(11), ink, TextAnchor.MiddleCenter);
        sNote = new GUIStyle(sChip) { font = bodyFont, fontSize = T(14), wordWrap = true, alignment = TextAnchor.MiddleCenter }; // a parchment box over a scene: its title, a hint
    }
    public float U(float v) => v * UiScale;
    Rect UR(float x, float y, float w, float h) => new Rect(U(x), U(y), U(w), U(h));
    void Ui(Rect r) { if (Event.current.type == EventType.Repaint) uiNext.Add(r); }
    bool Button(Rect r, string text, GUIStyle st = null) { Ui(r); return GUI.Button(r, text, st ?? sBtn); }
    bool IconButton(Rect r, PxCanvas icon, string text = null, GUIStyle st = null)
    {
        bool hit = Button(r, "", st);
        float s = Mathf.Min(r.height - U(10), U(28));
        if (text == null) GUI.DrawTexture(new Rect(r.center.x - s / 2, r.center.y - s / 2, s, s), Tex(icon), ScaleMode.ScaleToFit);
        else { GUI.DrawTexture(new Rect(r.x + U(6), r.center.y - s / 2, s, s), Tex(icon), ScaleMode.ScaleToFit); GUI.Label(new Rect(r.x + U(8) + s, r.y, r.width - s - U(10), r.height), text, new GUIStyle((st ?? sBtn)) { normal = { background = null }, active = { background = null }, hover = { background = null }, alignment = TextAnchor.MiddleLeft, padding = new RectOffset() }); }
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
        var st = new GUIStyle(sPixel) { fontSize = PxSize(size) };
        var r = new Rect(x - U(150), y - size, U(300), size * 2); float o = Mathf.Max(1, Mathf.Round(PxSize(size) / 8f));
        st.normal.textColor = new Color(0.17f, 0.12f, 0.18f, alpha);
        foreach (var (dx, dy) in new[] { (-o, 0f), (o, 0f), (0f, -o), (0f, o), (-o, -o), (o, o), (-o, o), (o, -o) }) GUI.Label(new Rect(r.x + dx, r.y + dy, r.width, r.height), text, st);
        st.normal.textColor = new Color(col.r, col.g, col.b, alpha); GUI.Label(r, text, st);
    }

    // ================================================================ OnGUI
    // every text is pixel text, as on the web version: Tiny5 (Resources/Fonts, drawn as hard pixels by Editor/NaadamyFontImport)
    static Font pixelFont, bodyFont, displayFont;
    /** Tiny5 is crisp at multiples of 8 screen pixels. */
    public static int PxSize(float v) => Mathf.Max(16, Mathf.FloorToInt(v / 8f + 0.6f) * 8); // rounds up a little sooner, so small labels stay readable
    /** A size for the smooth fonts, from the old pixel-font units (Nunito reads well a little smaller than Tiny5). */
    public int Ts(float units) => Mathf.Max(9, Mathf.RoundToInt(units * 1.15f * UiScale));
    void OnGUI()
    {
        if (pixelFont == null) { pixelFont = Resources.Load<Font>("Fonts/NaadamyPixel"); bodyFont = Resources.Load<Font>("Fonts/NaadamyBody"); displayFont = Resources.Load<Font>("Fonts/NaadamyDisplay"); }
        if (bodyFont != null) GUI.skin.font = bodyFont;
        BuildStyles(); scrollN = 0; scrollOpen.Clear();
        if (Event.current.type == EventType.Repaint) { var t = drawRects; drawRects = drawNext; drawNext = t; drawNext.Clear(); }
        if (Event.current.type == EventType.Repaint) uiNext.Clear();
        var safe = Screen.safeArea; float sx = safe.x, sy = Screen.height - safe.yMax, vw = safe.width / UiScale, vh = safe.height / UiScale;
        guiOX = sx; guiOY = sy;
        if (!InScene)
        {
            WorldLabels();
            GUI.BeginGroup(new Rect(sx, sy, safe.width, safe.height));
            bool was = GUI.enabled; GUI.enabled = modal == null; // the buttons behind an open window don't answer
            Hud(vw, vh);
            GUI.enabled = was;
            GUI.EndGroup();
        }
        if (!InScene && modal == null) { GUI.BeginGroup(new Rect(sx, sy, safe.width, safe.height)); DialogDraw(vw, vh); BigMap(vw, vh); GUI.EndGroup(); } // the big map sits over everything in the village
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
        var st = new GUIStyle(sCenter) { font = displayFont, fontSize = Mathf.RoundToInt(ts), wordWrap = false };
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

    // ================================================================ the village HUD, laid out like the web version's (village.js hud(), styles.css .v-*)
    bool moreOpen, miniBig; PxCanvas miniBase;
    static readonly Dictionary<char, string> MINI = new Dictionary<char, string> { ['g'] = "#76b947", ['T'] = "#3f7a2c", ['p'] = "#d8ab6c", ['s'] = "#d9cdb5", ['w'] = "#4aa6e2", ['d'] = "#a46d3b", ['o'] = "#8c5a33", ['f'] = "#a46d3b", ['r'] = "#a5a5b0", ['a'] = "#e8c994" };
    static readonly Dictionary<string, string> MINI_OBJ = new Dictionary<string, string> { ["ger"] = "#f4efe3", ["shop"] = "#e14b3d", ["board"] = "#a46d3b", ["well"] = "#77778a", ["lot"] = "#c8a06a", ["bleachers"] = "#a46d3b", ["ovoo"] = "#a5a5b0", ["uya"] = "#8a5a33", ["archery"] = "#e9a91f", ["academy"] = "#2f7d5b", ["felt"] = "#d8c8a8" };
    /** One pixel per tile: ground, roads, water, buildings. */
    PxCanvas MiniBase()
    {
        if (miniBase != null) return miniBase;
        miniBase = new PxCanvas(World.W, World.H);
        for (int y = 0; y < World.H; y++) for (int x = 0; x < World.W; x++)
        {
            char c = World.At(x, y); var o = c == 'B' ? World.ObjAt(x, y) : null;
            miniBase.Put(x, y, Px.Col(o != null && MINI_OBJ.TryGetValue(o.kind, out var oc) ? oc : MINI.TryGetValue(c, out var tc) ? tc : MINI['g']));
        }
        return miniBase;
    }
    /** The map: lots, people with news for you, friends, you, and what the screen shows. Tap it to make it big; on the big map, tap a place to walk there. */
    void VillageMap(Rect r)
    {
        var e = Event.current;
        var map = new Rect(r.x + U(6), r.y + U(6), r.width - U(12), r.height - U(14));
        float s = map.width / World.W;
        if (miniBig && e.type == EventType.MouseUp && map.Contains(e.mousePosition))
        {
            int tx0 = Mathf.FloorToInt((e.mousePosition.x - map.x) / s), ty0 = Mathf.FloorToInt((e.mousePosition.y - map.y) / s); e.Use();
            Later(() => { miniBig = false; if (!World.Blocked(tx0, ty0)) GoTo(tx0, ty0, null); else { var n = World.NearestOpen(tx0, ty0, mx, my); if (n != null) GoTo(n.Value.x, n.Value.y, null); } });
        }
        if (Button(r, "", sChip) && !miniBig) Later(() => { miniBig = true; Sfx.Tap(); });
        GUI.DrawTexture(map, Tex(MiniBase()));
        void Dot(float x, float y, Color c, float rad = 2) { float d = U(rad); Box(new Rect(map.x + x * s - d - U(1), map.y + y * s - d - U(1), 2 * d + U(2), 2 * d + U(2)), Px.Col("#2b1e2e")); Box(new Rect(map.x + x * s - d, map.y + y * s - d, 2 * d, 2 * d), c); }
        foreach (var o in World.objects)
        {
            if (o.kind == "npcq" && NpcMark(o.id) != "") Dot(o.x + 0.5f, o.y + 0.5f, Px.Col(NpcMark(o.id) == "?" ? "#7fe07a" : "#f7c646"));
            if (o.kind == "emee" && V.emee.visits == 0) Dot(o.x + 0.5f, o.y + 0.5f, Px.Col("#f492ba"));
        }
        foreach (var o in net.others.Values) Dot(o.px + 0.5f, o.py + 0.8f, Color.white);
        if ((int)(Time.time / 0.45f) % 2 == 1) Dot(px + 0.5f, py + 0.8f, Color.white, 3);
        Dot(px + 0.5f, py + 0.8f, Px.Col("#e14b3d"));
        float hh = cam.orthographicSize, hw = hh * cam.aspect, cx = cam.transform.position.x, cy = -cam.transform.position.y; var vr = new Rect(map.x + (cx - hw) * s, map.y + (cy - hh) * s, 2 * hw * s, 2 * hh * s);
        var wc = new Color(1, 1, 1, 0.85f); float t = Mathf.Max(1, U(1));
        Box(new Rect(vr.x, vr.y, vr.width, t), wc); Box(new Rect(vr.x, vr.yMax - t, vr.width, t), wc); Box(new Rect(vr.x, vr.y, t, vr.height), wc); Box(new Rect(vr.xMax - t, vr.y, t, vr.height), wc);
    }
    static string ActIcon(string type)
    {
        switch (type)
        {
            case "home": return "ui:house"; case "arcade": case "academy": case "historian": return "ui:book"; case "lasso": case "uya": return "ui:horse";
            case "general": return "ui:trophy"; case "shop": return "ui:shop"; case "board": return "ui:scroll"; case "well": return "ui:drop";
            case "zel": return "beast:mare"; case "cow1": case "cow2": return "beast:cow"; case "goat1": case "goat2": return "beast:goat";
            case "churn": return "dairy:airag"; case "tulga": return "dairy:urum"; case "rack": return "dairy:aaruul"; case "fish": return "ui:fish";
            case "sheep": case "emee": return "ui:heart"; case "shear": return "part:wool"; case "felt": return "part:esgii"; case "zasuul": case "arena": return "ui:wrestle";
            case "ovoo": return "ui:ovoo"; case "archery": return "ui:bow"; case "npcq": return "ui:chat"; case "lot": return "ui:ger"; case "basar": return "ui:dog";
        }
        return "ui:star";
    }
    /** A round parchment button (.v-round) with an icon or a short text. */
    bool Round(Rect r, PxCanvas icon, string text = null, GUIStyle st = null)
    {
        bool hit = Button(r, "", st ?? sChip);
        if (icon != null) { float s = r.width * 0.62f; GUI.DrawTexture(new Rect(r.center.x - s / 2, r.center.y - s / 2 - U(2), s, s), Tex(icon), ScaleMode.ScaleToFit); }
        else if (text != null) GUI.Label(new Rect(r.x, r.y, r.width, r.height - U(4)), text, new GUIStyle(sPixel) { fontSize = PxSize(U(16)), normal = { textColor = Px.Col("#4a2a12") } });
        return hit;
    }
    void Hud(float vw, float vh)
    {
        sprintRect = Rect.zero;
        var lv = Rules.Level(V.xp); var ink = Px.Col("#4a2a12");
        var pix = new GUIStyle(sPixel) { fontSize = PxSize(U(15)), alignment = TextAnchor.MiddleLeft, normal = { textColor = ink } };
        var small = new GUIStyle(sLabel) { fontSize = Mathf.RoundToInt(U(11)), wordWrap = false, alignment = TextAnchor.MiddleLeft };
        // top left: your card (it opens the menu), your home province, the map
        string nm = MyName; float nameW = pix.CalcSize(new GUIContent(nm)).x / UiScale;
        float cw = Mathf.Min(vw * 0.46f, 8 + 30 + 8 + Mathf.Max(nameW + 16, 104) + 12);
        var card = UR(10, 10, cw, 46);
        if (Button(card, "", sChip)) Later(() => Open(new MenuModal()));
        Box(UR(17, 16, 32, 32), Px.Col("#8a4b1f")); Box(UR(18, 17, 30, 30), Px.Col("#9fd8f7")); GUI.DrawTexture(UR(18, 17, 30, 30), Tex(Px.Portrait(V.look)), ScaleMode.ScaleToFit);
        GUI.Label(UR(56, 13, cw - 64, 20), nm + " <size=" + Mathf.RoundToInt(U(10)) + "><color=#8a4b1f>▼</color></size>", new GUIStyle(pix) { richText = true });
        var badge = UR(56, 35, 34, 13); Box(badge, Px.Col("#8a4b1f")); GUI.Label(badge, Loc.L("ТҮВ ", "LV ") + lv.l, new GUIStyle(small) { fontSize = Mathf.RoundToInt(U(9)), alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } });
        Box(UR(95, 38, 66, 8), Px.Col("#8a4b1f")); Box(UR(96, 39, 64, 6), Px.Col("#e6c48a")); Box(UR(96, 39, 64 * Mathf.Clamp01(lv.cur / (float)lv.need), 6), Px.Col("#5c9a36"));
        var ai = Aimags.ById(V.aimag); var et = Aimags.EthnicById(V.eth);
        string loc = ai != null ? ai.name + (et != null ? " · " + et.name : "") : Loc.L("Нутгаа сонго", "Pick home");
        float lw = small.CalcSize(new GUIContent(loc)).x / UiScale + 40; var locR = UR(10, 62, Mathf.Min(lw, vw * 0.46f), 26);
        if (Button(locR, "", sChip)) Later(() => Open(new PassportPage()));
        GUI.DrawTexture(new Rect(locR.x + U(9), locR.y + U(4), U(14), U(14)), Tex(Emo.Icon("📍")), ScaleMode.ScaleToFit);
        GUI.Label(new Rect(locR.x + U(27), locR.y, locR.width - U(30), locR.height - U(4)), loc, small);
        float mh = 126 * World.H / (float)World.W + 14;
        if (!miniBig) VillageMap(UR(10, 94, 126, mh));
        // top right: coins, energy, the season, playing online, together on one screen, the guide
        float py0 = 10;
        void Pill(PxCanvas icon, string text, float h, GUIStyle st, Action click, string glow = null)
        {
            float tw = text != null ? st.CalcSize(new GUIContent(text)).x / UiScale : 0, iw = icon != null ? 20 + (text != null ? 6 : 0) : 0, w = 24 + iw + tw;
            var r = UR(vw - 10 - w, py0, w, h);
            if (Button(r, "", sChip) && click != null) Later(click);
            float x = r.x + U(12);
            if (icon != null) { GUI.DrawTexture(new Rect(x, r.y + (r.height - U(4) - U(18)) / 2, U(18), U(18)), Tex(icon), ScaleMode.ScaleToFit); x += U(iw); }
            if (text != null) GUI.Label(new Rect(x, r.y, U(tw) + U(4), r.height - U(4)), text, st);
            if (glow != null) GlowAt(glow, r);
            py0 += h + 6;
        }
        Pill(Px.Icon("ui:coin"), V.coins.ToString(), 34, pix, () => Open(new ShopModal("wear")), "coins");
        int en = Mathf.RoundToInt(V.energy);
        Pill(Emo.Icon("🍖"), en.ToString(), 34, en < 20 ? new GUIStyle(pix) { normal = { textColor = Px.Col("#c2302a") } } : pix, () => Open(new FoodModal("meat")), "energy");
        var sea = Seasons.Current(); string seaIcon = sea.id == "spring" ? "🌸" : sea.id == "autumn" ? "🍂" : sea.id == "winter" ? "❄️" : "☀️";
        Pill(Emo.Icon(seaIcon), sea.name.ToString(), 28, new GUIStyle(small) { fontSize = Mathf.RoundToInt(U(12)) }, () => Open(new SeasonModal()));
        int n = net.others.Count + 1;
        string netText = net.Online ? $"● {n} · {net.room}" : net.status == "solo" ? "○ " + Loc.L("Ганцаараа", "Solo") : "◌ " + Loc.L("Холбогдож…", "Connecting…");
        Pill(null, netText, 26, new GUIStyle(small) { fontSize = Mathf.RoundToInt(U(10)), normal = { textColor = Px.Col(net.Online ? "#2e7d32" : "#8a6a4a") } }, () => Open(new RoomModal()));
        if (race == null && battle == null) Pill(Emo.Icon("🤝"), null, 34, pix, () => Open(new TogetherModal()));
        Pill(null, "?", 34, new GUIStyle(pix) { fontSize = PxSize(U(22)) }, () => StartTutorial(true), "help");
        if (race != null) { RaceHud(vw, vh); return; }
        if (battle != null)
        {
            GUI.Box(UR(vw / 2 - 210, 56, 420, 34), BattleLabel(), sToast);
            if (TouchUI && Button(UR(vw - 166, vh - 184, 158, 56), Loc.L("Сум харвах (F)", "Shoot (F)"), sPrimary)) ShootNearest();
            else if (!TouchUI) GUI.Box(UR(vw / 2 - 160, 94, 320, 26), Loc.L("F: сум харвах · E: уургадах", "F: shoot · E: lasso"), sToast);
        }
        if (Time.timeSinceLevelLoad < 9 && modal == null && TouchUI) GUI.Box(UR(vw / 2 - 160, vh - 130, 320, 32), Loc.L("Дэлгэц дээр чирж алх", "Drag on the screen to walk"), sNote); // on a computer, Bolormaa teaches the keys as you go
        // bottom left: Basar, chat, the bag, and "more" (3D, learn, quests, music)
        float ty = vh - 12 - 50, tx = 10;
        if (Round(UR(tx, ty, 50, 50), null, "•••")) Later(() => { moreOpen = !moreOpen; Sfx.Tap(); });
        var moreR = UR(tx, ty, 50, 50); ty -= 56;
        if (Round(UR(tx, ty, 50, 50), Px.Icon("ui:bag"))) Later(() => Open(new BagModal())); ty -= 56;
        var talkR = UR(tx, ty, 50, 50);
        if (Round(talkR, Px.Icon("ui:chat"))) Later(() => Open(new RoomModal()));
        if (net.unread > 0) { var b = new Rect(talkR.xMax - U(14), talkR.y - U(4), U(18), U(18)); Box(b, Px.Col("#e14b3d")); GUI.Label(b, net.unread.ToString(), new GUIStyle(small) { alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } }); }
        ty -= 56;
        var basR = UR(tx, ty, 50, 50); if (Round(basR, Px.BankharFace(0), null, sChipHi)) Later(() => OpenBasar()); ty -= 56;
        if (riding && Round(UR(tx, ty, 50, 50), Px.Icon("ui:horse"))) Later(Dismount);
        GlowAt("basar", basR);
        if (moreOpen)
        {
            float my0 = vh - 12 - 50;
            if (Round(UR(tx + 58, my0, 50, 50), Emo.Icon("👁"))) Later(() => { moreOpen = false; TryFirstPerson(null); }); GlowAt("fp", UR(tx + 58, my0, 50, 50)); my0 -= 56;
            if (Round(UR(tx + 58, my0, 50, 50), Px.Icon("ui:book"))) Later(() => { moreOpen = false; Open(new LearnPage()); }); GlowAt("learn", UR(tx + 58, my0, 50, 50)); my0 -= 56;
            if (Round(UR(tx + 58, my0, 50, 50), Px.Icon("ui:scroll"))) Later(() => { moreOpen = false; Open(new QuestModal()); }); GlowAt("quests", UR(tx + 58, my0, 50, 50)); my0 -= 56;
            if (Round(UR(tx + 58, my0, 50, 50), Emo.Icon("🎵"), null, Music.On ? sChip : sBtn)) Later(Music.Toggle);
        }
        else { GlowAt("fp", moreR); GlowAt("learn", moreR); GlowAt("quests", moreR); }
        // bottom right: run, jump and the action button (the web version's v-bottom order)
        float right = vw - 10;
        if (ctx != null && modal == null)
        {
            string label = LabelFor(ctx); var lst = new GUIStyle(pix) { alignment = TextAnchor.MiddleCenter };
            float aw = Mathf.Max(86, lst.CalcSize(new GUIContent(label)).x / UiScale + 20); var ar = UR(right - aw, vh - 12 - 86, aw, 86);
            var here = ctx; if (Button(ar, "", sChip)) Later(() => DoAction(here));
            GUI.DrawTexture(new Rect(ar.center.x - U(18), ar.y + U(8), U(36), U(36)), Tex(Px.Icon(ActIcon(ctx.type))), ScaleMode.ScaleToFit);
            GUI.Label(new Rect(ar.x, ar.y + U(46), ar.width, U(18)), label, lst);
            if (!TouchUI) { var kr = new Rect(ar.center.x - U(9), ar.y + U(64), U(18), U(14)); Box(kr, Px.Col("#8a4b1f")); GUI.Label(kr, "E", new GUIStyle(small) { fontSize = Mathf.RoundToInt(U(9)), alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } }); }
            right -= aw + 8;
        }
        var jr = UR(right - 56, vh - 12 - 56, 56, 56); if (Round(jr, null)) Jump(); GUI.Label(new Rect(jr.x, jr.y, jr.width, jr.height - U(4)), "↑", new GUIStyle(sBig) { fontSize = Mathf.RoundToInt(U(28)), normal = { textColor = Px.Col("#4a2a12") } }); GlowAt("jump", jr); right -= 64;
        var rr = UR(right - 56, vh - 12 - 56, 56, 56); if (Round(rr, Emo.Icon("🏃"), null, runLock ? sSel : sChip)) runLock = !runLock; GlowAt("run", rr); right -= 64;
        // bottom middle: your milk and the dairy foods you made. Tap a food to eat it.
        var have = Rules.DAIRY_ORDER.Where(k => V.Have(k) > 0).ToList();
        float left = moreOpen ? 126 : 68, room = right - left;
        if (have.Count == 0)
        {
            string go = Loc.L("Саах →", "Go milk →"); float gw = pix.CalcSize(new GUIContent(go)).x / UiScale + 56;
            var gr = UR(left + (room - gw) / 2, vh - 12 - 46, gw, 46);
            if (Button(gr, "", sSlot)) Later(() => GoTo(9, 14, null)); // nothing yet: a shortcut to the dairy yard
            GUI.DrawTexture(new Rect(gr.x + U(8), gr.y + U(9), U(28), U(28)), Tex(Px.Icon("beast:cow")), ScaleMode.ScaleToFit);
            GUI.Label(new Rect(gr.x + U(42), gr.y, gr.width - U(46), gr.height), go, new GUIStyle(pix) { normal = { textColor = Px.Col("#5a2d10") } });
        }
        else
        {
            float hw2 = Mathf.Min(520, have.Count * 50 + 8), x = left + (room - hw2) / 2 + 6;
            foreach (var k in have)
            {
                var r = UR(x, vh - 12 - 46, 46, 46);
                if (Button(r, "", sSlot)) Later(() => { if (Rules.DAIRY[k].food) Eat(k); else Toast($"{Rules.DAIRY[k].name}: " + Loc.L("тавиур, тулга, хөхүүр дээр цагаан идээ хийнэ.", "make dairy foods at the rack, stove or churn.")); });
                GUI.DrawTexture(new Rect(r.x + U(9), r.y + U(9), U(28), U(28)), Tex(Px.Icon("dairy:" + k)), ScaleMode.ScaleToFit);
                Outlined(r.xMax - U(10), r.yMax - U(9), V.Have(k).ToString(), U(10), Color.white);
                x += 50;
            }
        }
    }
    /** The big map in the middle of the screen, over everything else in the village. */
    void BigMap(float vw, float vh)
    {
        if (!miniBig) return;
        Ui(new Rect(-guiOX, -guiOY, Screen.width, Screen.height)); // taps on the dimmed village don't walk there
        Box(new Rect(-guiOX, -guiOY, Screen.width, Screen.height), new Color(0.1f, 0.06f, 0.12f, 0.45f));
        float w = Mathf.Min(vw * 0.92f, 640), h = w * World.H / World.W + 14;
        var e = Event.current;
        var r = UR((vw - w) / 2, (vh - h) / 2, w, h);
        if (e.type == EventType.MouseDown && !r.Contains(e.mousePosition)) { e.Use(); Later(() => miniBig = false); }
        VillageMap(r);
    }

    void DrawModal()
    {
        if (modal.FullScreen) { modal.Draw(this); return; }
        var sc = SceneUnder; if (sc != null && Event.current.type == EventType.Repaint) sc.Draw(this); // the scene stays behind its windows
        // dim the village, then a centred window that grows with its content
        Box(new Rect(0, 0, Screen.width, Screen.height), new Color(0.1f, 0.06f, 0.12f, 0.55f));
        // a tap on the dimmed village outside the window closes it, as the ✕ does
        var e = Event.current;
        if (modal.CanEscape && e.type == EventType.MouseDown && modalPanel.width > 0 && !modalPanel.Contains(e.mousePosition)) { e.Use(); Later(Close); return; }
        float w = Mathf.Min(U(modal.Width), Screen.width - U(24)), h = Screen.height - U(24);
        GUILayout.BeginArea(new Rect((Screen.width - w) / 2, U(12), w, h));
        GUILayout.FlexibleSpace();
        GUILayout.BeginVertical(sPanel);
        var m = modal; m.winScroll = BeginScroll(m.winScroll, h - U(40)); m.Draw(this); EndScroll();
        GUILayout.EndVertical();
        if (e.type == EventType.Repaint) { var pr = GUILayoutUtility.GetLastRect(); modalPanel = new Rect(pr.x + (Screen.width - w) / 2, pr.y + U(12), pr.width, pr.height); }
        GUILayout.FlexibleSpace();
        GUILayout.EndArea();
        if (m.CanEscape && modalPanel.width > 0 && GUI.Button(new Rect(modalPanel.xMax - U(44), modalPanel.y + U(10), U(34), U(34)), "×", sBtn)) Later(() => { if (modal == m) Close(); });
    }

    // ---------------------------------------------------------------- scroll views that a finger can drag and that fit their content
    // IMGUI scroll views only follow the mouse wheel and their scrollbar, and they either collapse or stretch instead of
    // fitting what is inside. These remember last frame's content height and view rect (by the order they are drawn in).
    readonly List<Rect> scrollViews = new List<Rect>(); readonly List<float> scrollContent = new List<float>(), scrollWheel = new List<float>(); readonly List<Vector2> scrollAt = new List<Vector2>(); readonly Stack<int> scrollOpen = new Stack<int>();
    int scrollN, scrollArmed = -1; bool scrollMoving; Vector2 scrollFrom;
    // a finger on a picture you draw or play on (Live, below) belongs to it, not to the scroll view around it
    List<Rect> drawRects = new List<Rect>(), drawNext = new List<Rect>();
    bool OnDrawing(Vector2 gui) { var p = GUIUtility.GUIToScreenPoint(gui); foreach (var r in drawRects) if (r.Contains(p)) return true; return false; }
    public void DrawingAt(Rect gui) { if (Event.current.type == EventType.Repaint && scrollOpen.Count > 0) drawNext.Add(GUIUtility.GUIToScreenRect(gui)); }
    /** maxH > 0: as tall as the content, at most maxH (screen pixels); otherwise it fills the space it is given. */
    public Vector2 BeginScroll(Vector2 pos, float maxH = -1)
    {
        int k = scrollN++; scrollOpen.Push(k);
        while (scrollViews.Count <= k) { scrollViews.Add(Rect.zero); scrollContent.Add(-1); scrollWheel.Add(0); scrollAt.Add(Vector2.zero); }
        if (scrollWheel[k] != 0) { pos.y += scrollWheel[k]; scrollWheel[k] = 0; }
        var e = Event.current; var view = scrollViews[k];
        if (e.type == EventType.MouseDown && TouchUI && view.Contains(e.mousePosition) && !OnDrawing(e.mousePosition)) { scrollArmed = k; scrollMoving = false; scrollFrom = e.mousePosition; }
        else if (e.type == EventType.MouseDrag && scrollArmed == k)
        {
            if (!scrollMoving && (e.mousePosition - scrollFrom).magnitude > U(6)) { scrollMoving = true; GUIUtility.hotControl = 0; } // a drag is never a button press
            if (scrollMoving) { pos.y -= e.delta.y; e.Use(); }
        }
        else if (e.type == EventType.MouseUp && scrollArmed == k) { scrollArmed = -1; if (scrollMoving) { scrollMoving = false; e.Use(); } }
        var opts = maxH > 0 ? new[] { GUILayout.Height(Mathf.Min(scrollContent[k] > 0 ? scrollContent[k] + 2 : maxH, maxH)) } : new GUILayoutOption[0];
        pos = GUILayout.BeginScrollView(pos, false, false, GUIStyle.none, GUI.skin.verticalScrollbar, opts); scrollAt[k] = pos;
        GUILayout.BeginVertical();
        return pos;
    }
#if UNITY_WEBGL && !UNITY_EDITOR
    [System.Runtime.InteropServices.DllImport("__Internal")] static extern float NaadamyWheel(); // Plugins/WebGL/NaadamyPointer.jslib
    /** The browser counts the distance before Unity sees the event (its listener runs first), and Unity may hand the event over a
     *  frame later: keep the distance until an event takes it, and drop it when nothing did (the wheel turned over something that
     *  doesn't scroll). Read every frame, and again when an event comes. */
    void ReadWheel()
    {
        float v = NaadamyWheel() * Dpr;
        if (v != 0) { wheelNow += v; wheelT = Time.unscaledTime; } else if (Time.unscaledTime - wheelT > 0.25f) wheelNow = 0;
    }
#else
    void ReadWheel() { }
#endif
    float wheelNow, wheelT; // screen pixels the browser would have scrolled, not yet used
    /** In a browser Unity gives every wheel event the same size, a mouse notch and a trackpad's tiny nudge alike, so a trackpad
     *  raced down the page: scroll half as far as the browser itself would (a mouse notch is about 50 CSS pixels). */
    float WheelStep(Event e)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        ReadWheel(); float w = wheelNow; wheelNow = 0; return w * 0.5f;
#else
        return e.delta.y * U(16);
#endif
    }
    public void EndScroll()
    {
        int k = scrollOpen.Count > 0 ? scrollOpen.Pop() : 0;
        GUILayout.EndVertical();
        if (Event.current.type == EventType.Repaint) scrollContent[k] = GUILayoutUtility.GetLastRect().height;
        // the wheel scrolls the innermost view under the mouse, by how far it really moved (WheelStep)
        var e = Event.current;
        if (e.type == EventType.ScrollWheel && scrollViews[k].Contains(e.mousePosition + scrollViews[k].position - scrollAt[k])) { scrollWheel[k] += WheelStep(e); e.Use(); }
        GUILayout.EndScrollView();
        if (Event.current.type == EventType.Repaint) scrollViews[k] = GUILayoutUtility.GetLastRect();
    }

    // little layout helpers for the windows
    public void Title(string t) => GUILayout.Label(t, sTitle);
    public void Text(string t) => GUILayout.Label(t, sLabel);
    public void Small(string t) => GUILayout.Label(t, sSmall);
    public void Gap(float v = 8) => GUILayout.Space(U(v));
    /** A text box like the web version's big input, with a grey hint while it is empty. */
    public string Field(string v, int max, string hint)
    {
        var r = GUILayoutUtility.GetRect(U(100), U(56), GUILayout.ExpandWidth(true));
        v = GUI.TextField(r, v, max, sField);
        if (string.IsNullOrEmpty(v)) GUI.Label(r, hint, new GUIStyle(sField) { normal = { background = null, textColor = Px.Col("#a8957e") } });
        return v;
    }
    /** The app's logo, as the web version's blue tile with the ger. */
    public void Logo(Rect r) { GUI.Box(r, GUIContent.none, sLogo); GUI.DrawTexture(new Rect(r.x + r.width * 0.14f, r.y + r.height * 0.12f, r.width * 0.72f, r.height * 0.72f), Tex(Px.Icon("ui:logo")), ScaleMode.ScaleToFit); }
    /** The step bar along the top of a card: green for the steps done. */
    public void Steps(int step, int n)
    {
        var r = GUILayoutUtility.GetRect(U(100), U(6), GUILayout.ExpandWidth(true)); float gap = U(6), w = (r.width - gap * (n - 1)) / n;
        for (int k = 0; k < n; k++) Box(new Rect(r.x + k * (w + gap), r.y, w, r.height), Px.Col(k <= step ? "#5c9a36" : "#e6c48a"));
        Gap(12);
    }
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
    /** A picture fitted into a size × size box, keeping its shape: people are taller than they are wide. */
    public void IconAt(PxCanvas art, float size)
    {
        float k = U(size) / Mathf.Max(art.W, art.H), w = art.W * k, h = art.H * k;
        var r = GUILayoutUtility.GetRect(w, h, GUILayout.Width(w), GUILayout.Height(h)); GUI.DrawTexture(r, Tex(art));
    }
    /** Empty cells that finish a short last row of a grid, so its buttons stay as wide as the ones above. */
    public void PadRow(int cells, float w, float h) { for (int i = 0; i < cells; i++) GUILayoutUtility.GetRect(U(w), U(h), GUILayout.ExpandWidth(true)); }
    /** How many grid cells fit across a page when each must hold the longest of these labels plus `extra` units. */
    public int GridCols(IEnumerable<string> labels, GUIStyle st, float extra, int max = 6)
    {
        float w = 0; foreach (var l in labels) w = Mathf.Max(w, st.CalcSize(new GUIContent(l)).x);
        return Mathf.Clamp(Mathf.FloorToInt((Mathf.Min(Screen.safeArea.width - U(16), U(760)) - U(24)) / (w + U(extra))), 2, max);
    }
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
    public int Chips(IList<string> labels, int current, float minW = 60, bool tabs = false)
    {
        // three to a row on one line each: pixel letters are wide, and wrapped chips spill over each other
        int hit = -1; GUILayout.BeginHorizontal(); GUIStyle on = new GUIStyle(tabs ? sPrimary : sSel) { wordWrap = false }, off = new GUIStyle(sBtn) { wordWrap = false }; // tabs fill orange, a picked option gets a red outline
        float w = U(minW); foreach (var l in labels) w = Mathf.Max(w, off.CalcSize(new GUIContent(l)).x); // all as wide as the widest, so the rows line up
        for (int i = 0; i < labels.Count; i++) { if (i > 0 && i % 3 == 0) { GUILayout.EndHorizontal(); GUILayout.BeginHorizontal(); } if (GUILayout.Button(labels[i], i == current ? on : off, GUILayout.MinWidth(w), GUILayout.MinHeight(U(36)))) hit = i; }
        if (labels.Count > 3) for (int i = labels.Count % 3; i > 0 && i < 3; i++) GUILayoutUtility.GetRect(w, U(36), GUILayout.ExpandWidth(true)); // a short last row keeps the same chip width
        GUILayout.EndHorizontal(); return hit;
    }
    public bool Swatch(Color c, bool on, float size = 36)
    {
        var r = GUILayoutUtility.GetRect(U(size), U(size), GUILayout.Width(U(size)), GUILayout.Height(U(size)));
        bool hit = GUI.Button(r, "", on ? sSel : sTile); Box(new Rect(r.x + U(5), r.y + U(5), r.width - U(10), r.height - U(10)), c); GUILayout.Space(U(6)); return hit;
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
        public void ShowAt(Rect rr) { last = rr; I?.DrawingAt(rr); if (Event.current.type == EventType.Repaint) { c.Upload(tex); GUI.DrawTexture(rr, tex); } }
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
