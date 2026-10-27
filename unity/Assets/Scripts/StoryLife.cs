// The story's playable days from Temüjin's own life (the Secret History, §74–75 and §81–85):
//   OnonDay — the boy Temüjin helps his mother feed the family: wild onions, lily roots and bird cherries by the Onon, then fish.
//   Escape  — the night of the Red Circle feast: slip out of the Tayichi'ud camp in the wooden cangue, past the guards' torches,
//             and hide in the river reeds.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    /** Shared by the walking stages: someone you move along the near bank, and things to use there. */
    public abstract class WalkStage : Stage
    {
        protected readonly Game g; protected float px, py, y0, y1; protected int face = 2; protected bool moving; protected Look look; protected float speed = 58;
        protected WalkStage(Game g) { this.g = g; }
        protected void Walk(StoryScene s, float dt, bool frozen = false)
        {
            var m = frozen ? Vector2.zero : s.Move(); moving = m.sqrMagnitude > 0.02f;
            px = Mathf.Clamp(px + m.x * speed * dt, 8, W - 8); py = Mathf.Clamp(py + m.y * speed * 0.6f * dt, y0, y1);
            if (Mathf.Abs(m.x) > 0.15f) face = m.x < 0 ? 1 : 2;
            camX = Mathf.Lerp(camX, Mathf.Clamp(px - 150, 0, W - StoryScene.VW), Mathf.Min(1, dt * 4));
        }
        protected void Note(float vw, float vh, string goal, string hint)
        {
            GUI.Box(g.URect(vw / 2 - 220, 10, 440, 36), goal, new GUIStyle(g.sNote) { fontSize = g.Ts(12) });
            if (hint != null) GUI.Box(g.URect(vw / 2 - 220, vh - 54, 440, 34), hint, new GUIStyle(g.sNote) { fontSize = g.Ts(12) });
        }
        protected static void Sparkle(PxCanvas c, int x, int y, float t)
        {
            int k = (int)(t * 6 + x) % 4; var col = new Color32(255, 240, 160, 255);
            c.Put(x, y - 2 - k % 2, col); c.Put(x - 1 - k % 2, y, col); c.Put(x + 1 + k % 2, y, col); c.Put(x, y + 2 + k % 2, col);
        }
    }

    // ================================================================ a day by the Onon
    public sealed class OnonDay : WalkStage
    {
        sealed class Plant { public string kind; public float x, y; public bool taken; }
        sealed class Spot { public float x, y; public bool used; }
        readonly List<Plant> plants = new List<Plant>(); readonly List<Spot> spots = new List<Spot>();
        int onions, lilies, cherries, fish; Plant digging; float digT; Spot fishing; float biteAt, biteEnd, fishMsgT = -9; string fishMsg;
        readonly float momX = 140, momY = 164;
        public const int ONIONS = 4, LILIES = 3, CHERRIES = 2, FISH = 3;
        bool Gathered => onions >= ONIONS && lilies >= LILIES && cherries >= CHERRIES;
        bool AllDone => Gathered && fish >= FISH;

        public OnonDay(Game g) : base(g)
        {
            W = 960; px = 170; py = 166; y0 = 160; y1 = 171;
            look = new Look { deel = "brown", hat = "cap", skin = "#D9A06E" };
            var r = new System.Random(1171);
            float[] xs = { 260, 330, 410, 520, 600, 690, 770, 850, 900 };
            string[] kinds = { "onion", "lily", "onion", "cherry", "lily", "onion", "cherry", "lily", "onion" };
            for (int i = 0; i < xs.Length; i++) plants.Add(new Plant { kind = kinds[i], x = xs[i] + r.Next(-12, 12), y = 162 + r.Next(0, 9) });
            foreach (var x in new float[] { 300, 560, 740, 880 }) spots.Add(new Spot { x = x, y = 160 });
        }
        public override (string id, Tx label)[] Buttons => new[] { (fishing != null ? "fish" : "act", fishing != null ? new Tx("Татах!", "Pull!") : new Tx("Түүх", "Use")) };
        Plant NearPlant => plants.Where(p => !p.taken && Mathf.Abs(p.x - px) < 14 && Mathf.Abs(p.y - py) < 10).OrderBy(p => Mathf.Abs(p.x - px)).FirstOrDefault();
        Spot NearSpot => spots.Where(p => !p.used && Mathf.Abs(p.x - px) < 16).FirstOrDefault();
        bool NearMom => Mathf.Abs(momX - px) < 20;

        public override void Tick(StoryScene s, float dt)
        {
            float t = Time.time;
            if (digging != null)
            {
                digT += dt; Walk(s, dt, true);
                if (digT > 0.7f) { digging.taken = true; if (digging.kind == "onion") onions++; else if (digging.kind == "lily") lilies++; else cherries++; Sfx.Good(); s.Burst(digging.x, digging.y - 6, new Color32(170, 130, 80, 255), 6, 30); digging = null; }
                return;
            }
            if (fishing != null)
            {
                Walk(s, dt, true);
                bool pull = s.Pressed("fish") || s.Pressed("act");
                if (t >= biteAt && t < biteEnd && pull) { fishing.used = true; fish++; fishing = null; Sfx.Win(); fishMsg = Loc.L("Загас барилаа!", "A fish!"); fishMsgT = t; s.Burst(px + (face == 1 ? -18 : 18), 158, new Color32(170, 210, 255, 255), 10, 40); }
                else if (pull && t < biteAt) { fishing = null; Sfx.Bad(); fishMsg = Loc.L("Эрт татчихлаа, загас айгаад зугтав. Дахиад!", "Too soon, the fish got scared. Again!"); fishMsgT = t; }
                else if (t >= biteEnd) { fishing = null; Sfx.Bad(); fishMsg = Loc.L("Хоцорчихлоо! Хөвүүр шумбахад шууд тат.", "Too late! Pull as soon as the float dips."); fishMsgT = t; }
                return;
            }
            Walk(s, dt);
            if (s.Pressed("act") || s.Pressed("fish"))
            {
                var p = NearPlant; var sp = NearSpot;
                if (p != null) { digging = p; digT = 0; Sfx.Tap(); }
                else if (sp != null && Gathered) { fishing = sp; biteAt = t + 1.2f + Random.value * 2.2f; biteEnd = biteAt + 0.65f; face = 2; Sfx.Tap(); }
                else if (sp != null) { fishMsg = Loc.L("Эхлээд ургамлаа түүчих, тэгээд загасчил.", "Gather the plants first, then fish."); fishMsgT = t; }
                else if (NearMom && AllDone) { done = true; won = true; Sfx.Win(); }
                else if (NearMom) { fishMsg = Loc.L("Ээж: “Бүгдийг нь цуглуулаад ир, хүү минь.”", "Mother: “Bring everything, my son.”"); fishMsgT = t; }
            }
        }
        public override void Draw(StoryScene s, PxCanvas c)
        {
            float t = Time.time;
            foreach (var p in plants) if (!p.taken) { int x = Mathf.RoundToInt(p.x - camX), y = Mathf.RoundToInt(p.y); DrawPlant(c, p.kind, x, y); if (p == NearPlant) Sparkle(c, x, y - 14, t); }
            foreach (var sp in spots) if (!sp.used) { int x = Mathf.RoundToInt(sp.x - camX); int k = (int)(t * 2 + sp.x) % 3; for (int i = -3 - k; i <= 3 + k; i++) c.Put(x + i, 152 + (Mathf.Abs(i) > 2 + k - 1 ? 0 : 0), new Color32(220, 236, 255, (byte)(150 - k * 40))); }
            // mother Hö'elün with her basket, waiting by the bank
            var mom = new Look { deel = "green", hat = "fur", skin = "#D9A06E" };
            StoryScene.DrawPerson(c, mom, momX - camX, momY, px < momX ? 1 : 2, false, false, t);
            Px.R(c, momX - camX + 5, momY - 12, 6, 5, "#8a6a3a"); Px.R(c, momX - camX + 5, momY - 12, 6, 1, "#b08a50");
            if (AllDone) Sparkle(c, Mathf.RoundToInt(momX - camX), Mathf.RoundToInt(momY - 34), t);
            StoryScene.DrawPerson(c, look, px - camX, py, face, moving, false, t);
            if (digging != null) { int k = (int)(digT * 8) % 2; Px.Line(c, Mathf.RoundToInt(px - camX + (face == 1 ? -6 : 6)), Mathf.RoundToInt(py - 10), Mathf.RoundToInt(px - camX + (face == 1 ? -9 : 9)), Mathf.RoundToInt(py - 2 + k), "#6e5034"); }
            if (fishing != null)
            {
                // a willow rod, the line and the float: it dips when a fish bites
                int hx = Mathf.RoundToInt(px - camX + 6), hy = Mathf.RoundToInt(py - 16), fx2 = hx + 22, fy2 = 154 + (t >= biteAt && t < biteEnd ? 2 : Mathf.RoundToInt(Mathf.Sin(t * 3)));
                Px.Line(c, hx, hy, hx + 14, hy - 8, "#8a6a3a"); Px.Line(c, hx + 14, hy - 8, fx2, fy2, "#e8e8e8");
                Px.R(c, fx2 - 1, fy2 - 1, 3, 2, t >= biteAt && t < biteEnd ? "#ff4a3a" : "#f0f0f0");
                if (t >= biteAt && t < biteEnd) { var red = new Color32(255, 70, 60, 255); for (int j = 0; j < 5; j++) c.Put(fx2, fy2 - 10 + j, j == 3 ? default : red); }
            }
        }
        static void DrawPlant(PxCanvas c, string kind, int x, int y)
        {
            if (kind == "onion") { Px.Line(c, x, y, x - 2, y - 8, "#5a9a3a"); Px.Line(c, x, y, x + 1, y - 9, "#6ab04a"); Px.Line(c, x, y, x + 3, y - 7, "#5a9a3a"); Px.Ell(c, x, y - 10, 2, 2, "#c88ad8"); }
            else if (kind == "lily") { Px.Line(c, x, y, x, y - 10, "#4a8a3a"); Px.Ell(c, x, y - 11, 2, 2, "#e8503a"); Px.P(c, x - 1, y - 12, "#ff9a6a"); Px.Line(c, x, y - 5, x + 3, y - 7, "#4a8a3a"); }
            else { Px.Ell(c, x, y - 6, 6, 5, "#3e6a3a"); Px.Ell(c, x - 1, y - 7, 4, 3, "#4e7e46"); foreach (var (a, b) in new[] { (-3, -6), (2, -8), (3, -4), (-1, -3), (0, -9) }) Px.P(c, x + a, y + b, "#2a1a2e"); }
        }
        public override void Hud(StoryScene s, float vw, float vh)
        {
            string goal = Loc.L($"Мангир {onions}/{ONIONS} · Сарана {lilies}/{LILIES} · Мойл {cherries}/{CHERRIES} · Загас {fish}/{FISH}", $"Wild onion {onions}/{ONIONS} · Lily root {lilies}/{LILIES} · Bird cherry {cherries}/{CHERRIES} · Fish {fish}/{FISH}");
            string hint = Time.time - fishMsgT < 2.6f ? fishMsg
                : fishing != null ? Loc.L("Хөвүүр улаан болж шумбахад “Татах!”", "When the float dips and turns red: Pull!")
                : AllDone ? Loc.L("Бүгдийг цуглууллаа! Ээж рүүгээ очоод дар", "You have it all! Go to Mother and press Use")
                : Gathered ? Loc.L("Одоо голын долгиолсон газарт очиж загасчил", "Now fish where the water ripples")
                : NearPlant != null ? Loc.L(TouchUI ? "“Түүх”-ийг дар" : "E: түүх", TouchUI ? "Tap Use" : "E: gather") : Loc.L("Гялалзсан ургамлууд руу алх", "Walk to the plants and gather them");
            Note(vw, vh, goal, hint);
        }
    }

    // ================================================================ the escape from the Tayichi'ud
    public sealed class Escape : WalkStage
    {
        sealed class Guard { public float x, y, a, b, dir = 1, wait; public float seen; }
        readonly List<Guard> guards = new List<Guard>();
        bool hidden; float caughtT = -9; int caught;
        readonly float[] covers = { 170, 340, 470 };   // dark places to crouch in: behind gers and the wool cart
        public Escape(Game g) : base(g)
        {
            W = 960; px = 40; py = 140; y0 = 128; y1 = 150; speed = 46;
            look = new Look { deel = "brown", hat = null, skin = "#D9A06E" };
            guards.Add(new Guard { x = 150, y = 138, a = 110, b = 260 });
            guards.Add(new Guard { x = 400, y = 146, a = 330, b = 560, dir = -1 });
            guards.Add(new Guard { x = 640, y = 134, a = 590, b = 760 });
        }
        public override (string id, Tx label)[] Buttons => new[] { ("hide", hidden ? new Tx("Гарах", "Go") : new Tx("Нуугдах", "Hide")) };
        bool NearCover => covers.Any(x => Mathf.Abs(x - px) < 16);
        bool AtReeds => px > 800;

        public override void Tick(StoryScene s, float dt)
        {
            float t = Time.time;
            if (caughtT > 0) { if (t - caughtT > 1.8f) { caughtT = -9; px = 40; py = 140; hidden = false; foreach (var gd in guards) gd.seen = 0; } return; }
            if (s.Pressed("hide"))
            {
                if (AtReeds) { done = true; won = true; Sfx.Good(); return; }
                if (hidden) hidden = false; else if (NearCover) { hidden = true; Sfx.Tap(); }
            }
            Walk(s, dt, hidden);
            if (s.Move().sqrMagnitude > 0.3f && hidden) hidden = false;
            foreach (var gd in guards)
            {
                if (gd.wait > 0) gd.wait -= dt;
                else { gd.x += gd.dir * 22 * dt; if (gd.x > gd.b) { gd.x = gd.b; gd.dir = -1; gd.wait = 1.4f; } if (gd.x < gd.a) { gd.x = gd.a; gd.dir = 1; gd.wait = 1.4f; } }
                // the torchlight: a circle round the guard, a little longer in front of them
                float dx = px - gd.x, dy = (py - gd.y) * 1.6f, d = Mathf.Sqrt(dx * dx + dy * dy), reach = Mathf.Sign(dx) == gd.dir ? 44 : 26;
                bool inLight = d < reach && !hidden;
                gd.seen = Mathf.Clamp01(gd.seen + (inLight ? (moving ? 1.6f : 1.1f) : -0.7f) * dt);
                if (gd.seen >= 1) { caughtT = t; caught++; Sfx.Bad(); return; }
            }
        }
        public override void Draw(StoryScene s, PxCanvas c)
        {
            float t = Time.time;
            foreach (var gd in guards)
            {
                // warm torchlight on the ground, flickering
                int gx = Mathf.RoundToInt(gd.x - camX), gy = Mathf.RoundToInt(gd.y); float fl = 1 + Mathf.Sin(t * 13 + gd.a) * 0.06f;
                for (int yy = -10; yy <= 10; yy++) for (int xx = -46; xx <= 46; xx++)
                {
                    float reach = Mathf.Sign(xx) == gd.dir ? 44 : 26, d = Mathf.Sqrt(xx * xx + yy * yy * 2.56f) / (reach * fl);
                    if (d < 1) c.Put(gx + xx, gy + yy, new Color32(255, 190, 90, (byte)(70 * (1 - d))));
                }
            }
            foreach (var x in covers) if (Mathf.Abs(x - px) < 16 && !hidden) Sparkle(c, Mathf.RoundToInt(x - camX), 122, t);
            var me = look.Copy();
            if (!hidden) StoryScene.DrawPerson(c, me, px - camX, py, face, moving, false, t);
            else { StoryScene.DrawPerson(c, me, px - camX, py + 6, face, false, false, t); c.Alpha = 1; }
            // the wooden cangue round his neck
            int cx = Mathf.RoundToInt(px - camX), cy = Mathf.RoundToInt(py - (hidden ? 10 : 16));
            Px.R(c, cx - 9, cy, 18, 4, "#7a5434"); Px.R(c, cx - 9, cy, 18, 1, "#a07450"); Px.R(c, cx - 9, cy + 3, 18, 1, "#4a3020");
            foreach (var gd in guards)
            {
                var lk = new Look { deel = "black", hat = "fur", skin = "#D9A06E" };
                StoryScene.DrawPerson(c, lk, gd.x - camX, gd.y, gd.dir < 0 ? 1 : 2, gd.wait <= 0, false, t);
                int hx = Mathf.RoundToInt(gd.x - camX + gd.dir * 7), hy = Mathf.RoundToInt(gd.y - 20);
                Px.Line(c, hx, hy, hx, hy - 8, "#6e5034"); Px.Ell(c, hx, hy - 10, 2, 3 + (int)(t * 10) % 2, "#ff9a3c"); Px.P(c, hx, hy - 11, "#fff2a8");
                if (gd.seen > 0.05f) { var col = gd.seen > 0.6f ? new Color32(255, 70, 60, 255) : new Color32(255, 220, 80, 255); int qy = Mathf.RoundToInt(gd.y - 36); for (int j = 0; j < 5; j++) if (j != 3) c.Put(Mathf.RoundToInt(gd.x - camX), qy + j, col); }
            }
            if (AtReeds && (int)(t * 3) % 2 == 0) Sparkle(c, Mathf.RoundToInt(px - camX), Mathf.RoundToInt(py - 34), t);
        }
        public override void Hud(StoryScene s, float vw, float vh)
        {
            float worst = guards.Max(gd => gd.seen);
            string goal = Loc.L("Харуулуудын бамбарын гэрэлд орохгүйгээр голын зэгс рүү зугт", "Reach the river reeds without being seen in the guards' torchlight");
            string hint = caughtT > 0 ? Loc.L("Харуул чамайг харчихлаа! Дахиад оролд.", "A guard saw you! Try again.")
                : AtReeds ? Loc.L(TouchUI ? "Зэгсэнд ирлээ! “Нуугдах”-ыг дарж усанд нуугд" : "Зэгсэнд ирлээ! H / E: усанд нуугд", TouchUI ? "The reeds! Tap Hide to slip into the water" : "The reeds! H / E: slip into the water")
                : hidden ? Loc.L("Нуугдаж байна... Харуулыг өнгөрөхийг хүлээ", "Hiding... wait for the guard to pass")
                : NearCover ? Loc.L(TouchUI ? "Сүүдэр: “Нуугдах”" : "Сүүдэр: H / E-ээр нуугд", TouchUI ? "A shadow: tap Hide" : "A shadow: H / E to hide")
                : worst > 0.3f ? Loc.L("Болгоомжтой! Харуул сэжиглэж байна", "Careful! A guard is getting suspicious") : Loc.L("Гэрүүдийн сүүдэр, ноосон тэргэнд нуугдаж болно", "You can hide in the shadows of the gers and the wool cart");
            Note(vw, vh, goal, hint);
        }
    }
}
