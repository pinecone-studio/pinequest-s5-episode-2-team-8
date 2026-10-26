// The historian's tasks (js/history.js) and Эх орноо хамгаалах, defend the homeland (js/battles.js and village.js):
// raiders ride in along the roads towards the herd and the gers. Whistling arrows and the lasso take away their courage;
// when it is gone they turn round and ride home. Nobody is hurt, and the chapters teach what really happened.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public sealed partial class Game
{
    // ================================================================ the historian
    public sealed class HistStep { public string find, battle, e; public int near; public Tx item, fact; }
    static List<HistStep> hsteps;
    static List<HistStep> HSTEPS => hsteps ??= Data.Get("history").Select(s => new HistStep { find = s["find"].S, battle = s["battle"].S, e = s["e"].S, near = s["near"].I, item = s["item"].T, fact = s["fact"].T }).ToList();
    HistStep HistCur => V.histStep < HSTEPS.Count ? HSTEPS[V.histStep] : null;
    /** Something to hand in, or a new task to hear about: the historian shows a green marker. */
    public bool HistoryReady() { var q = HistCur; if (q == null) return false; return V.histFound == 1 || (q.battle != null && V.campWon.Contains(q.battle)); }
    public HistStep HistoryTarget(string aimag) { var q = HistCur; return q != null && q.find == aimag && V.histFound == 0 ? q : null; }
    public bool HistoryFound(string aimag) { var q = HistCur; if (q == null || q.find != aimag || V.histFound == 1) return false; V.histFound = 1; V.Save(); Sfx.Win(); Confetti(50); return true; }
    void HistoryBattleWon(string id) { var q = HistCur; if (q != null && q.battle == id) { V.histFound = 1; V.Save(); } }

    sealed class HistorianModal : Modal
    {
        HistStep handed;
        public override void Draw(Game g)
        {
            var V = g.V;
            GUILayout.BeginHorizontal(); g.IconAt(Px.Portrait(Rules.HISTORIAN), 48); GUILayout.BeginVertical();
            g.Title(Loc.L("Түүхч Нарангэрэл", "Narangerel the historian")); g.Small(Loc.L($"Даалгавар {Mathf.Min(V.histStep + 1, HSTEPS.Count)}/{HSTEPS.Count}", $"Task {Mathf.Min(V.histStep + 1, HSTEPS.Count)}/{HSTEPS.Count}"));
            GUILayout.EndVertical(); GUILayout.EndHorizontal();
            if (handed != null)
            {
                var ic = Emo.Icon(handed.e ?? "🏆"); if (ic != null) g.Picture(ic, 48);
                GUILayout.Label("<b>" + Loc.L("Баярлалаа!", "Thank you!") + "</b>", new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
                if (handed.fact.mn != null) g.Fact(handed.fact.ToString(), true, Loc.L("Түүх", "History"));
                if (g.Btn(Loc.L("Дараагийн даалгавар →", "Next task →"), true, 44)) g.Later(() => handed = null);
                return;
            }
            var q = g.HistCur; bool done = q != null && (V.histFound == 1 || (q.battle != null && V.campWon.Contains(q.battle)));
            var a = q?.find != null ? Aimags.ById(q.find) : null; var ch = q?.battle != null ? Chapters.ById(q.battle) : null;
            if (q == null) g.Text(Loc.L("Чи бүх даалгаврыг биелүүллээ! Жинхэнэ түүхч боллоо.", "You finished every task! You are a real historian."));
            else if (done)
            {
                g.Text(q.find != null ? Loc.L($"Олж ирсэн үү! {q.item.mn}", $"You found it! {q.item.en}") : Loc.L($"{ch.name.mn}-д ялсан чинь сайхан!", $"Well done defending in “{ch.name.en}”!"));
                if (g.Btn(Loc.L("Түүхчид өгөх", "Hand it to the historian"), true, 44)) g.Later(() => { V.histStep++; V.histFound = 0; V.Save(); g.Reward(30, 50); g.CheckAchievements(); handed = q; });
            }
            else if (q.find != null)
            {
                g.Text(Loc.L($"{a.name.mn} аймагт очиж {q.item.mn}-г олоод ирээрэй. Үзвэрийн дэргэд гялалзаж байгаа.", $"Go to {a.name.en} and find {q.item.en.ToLower()}. It sparkles beside one of the sights."));
                if (g.Btn(Loc.L($"{a.name.mn} руу аялах", $"Travel to {a.name.en}"), true, 44)) g.Later(() => { g.Close(); g.OpenTrip(q.find, "2d"); });
            }
            else
            {
                g.Text(Loc.L($"Жанжинд очиж “{ch.name.mn}” ({ch.year.mn}) тулалдаанд нутгаа хамгаал.", $"Go to the General and defend the land in “{ch.name.en}” ({ch.year.en})."));
                if (g.Btn(Loc.L("Жанжин руу", "To the General"), true, 44)) g.Later(() => g.Swap(new GeneralModal()));
            }
            if (g.Btn(Loc.L("Хаах", "Close"), false, 30)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }

    // ================================================================ the chapters of defending the homeland
    public static class Chapters
    {
        public sealed class Ally { public Tx name; public Look look; public string coat; }
        public sealed class Chapter { public string id; public Tx name, year, intro, after; public List<int> waves; public List<Ally> allies; public int courage; public Look enemyLook; public string enemyCoat; }
        static List<Chapter> all;
        static Look LookOf(J l) => new Look { deel = l["deel"].S ?? "blue", skin = l["skin"].S ?? "#D9A06E", hat = l["hat"].S, face = l["face"].S, neck = l["neck"].S };
        public static List<Chapter> ALL => all ??= Data.Get("battles").Select(c => new Chapter
        {
            id = c["id"].S, name = c["name"].T, year = c["year"].T, intro = c["intro"].T, after = c["after"].T, waves = c["waves"].Select(w => w.I).ToList(),
            allies = c["allies"].Select(a => new Ally { name = a["name"].T, look = LookOf(a["look"]), coat = a["coat"].S ?? "bay" }).ToList(),
            courage = c["enemy"]["courage"].I, enemyLook = LookOf(c["enemy"]["look"]), enemyCoat = c["enemy"]["coat"].S ?? "black",
        }).ToList();
        public static Chapter ById(string id) => ALL.FirstOrDefault(c => c.id == id);
    }
    sealed class GeneralModal : Modal
    {
        public override void Draw(Game g)
        {
            var chs = Chapters.ALL;
            GUILayout.BeginHorizontal(); g.IconAt(Px.Portrait(Rules.GENERAL), 48); GUILayout.BeginVertical();
            g.Title(Loc.L("Жанжин Батмөнх", "General Batmönkh")); g.Small(Loc.L("Эх орноо хамгаалсан түүхүүд", "Stories of defending the homeland")); GUILayout.EndVertical(); GUILayout.EndHorizontal();
            g.Text(Loc.L("Анхаар! Монголчууд олон зуун жилийн турш нутаг усаа хамгаалж ирсэн. Түүх бүрийг сонсоод, нутгаа хамгаал! Дуут сум, уурга хоёр зөвхөн дайсны зоригийг мохоодог: хэн ч гэмтэхгүй.", "Attention! For centuries Mongolians have protected their land. Hear each story, then defend the land! Whistling arrows and the lasso only break the raiders’ courage: nobody gets hurt."));
            for (int i = 0; i < chs.Count; i++)
            {
                var ch = chs[i]; bool open = i == 0 || g.V.campWon.Contains(chs[i - 1].id), won = g.V.campWon.Contains(ch.id);
                g.Row(Emo.Icon(won ? "🏆" : open ? "⚔️" : "🔒"), ch.name.ToString(), ch.year + (won ? " · " + Loc.L("Хамгаалсан", "Defended") + " √" : ""), !open);
                if (open && g.SmallBtn(won ? Loc.L("Дахин", "Again") : Loc.L("Эхлэх", "Begin"))) { var c2 = ch; g.Later(() => g.Swap(new BattleIntroModal(c2))); }
                g.EndRow();
            }
            g.Small(Loc.L("Сумаа: дайсан дээр дар эсвэл F. Уурга: ойртоод E.", "Arrows: tap a raider or press F. Lasso: get close and press E."));
        }
        public override void Press(Game g) => g.Close();
    }
    sealed class BattleIntroModal : Modal
    {
        readonly Chapters.Chapter ch; public BattleIntroModal(Chapters.Chapter ch) { this.ch = ch; }
        public override void Draw(Game g)
        {
            g.Small(ch.year.ToString()); g.Title(ch.name.ToString());
            g.Fact(ch.intro.ToString(), true, Loc.L("Түүх", "The story"));
            g.Small(Loc.L($"Холбоотнууд: {string.Join(", ", ch.allies.Select(a => a.name.mn))}. {ch.waves.Count} давалгаа.", $"Allies: {string.Join(", ", ch.allies.Select(a => a.name.en))}. {ch.waves.Count} waves."));
            if (g.Btn(Loc.L("Хамгаалъя!", "Defend!"), true, 48)) g.Later(() => { g.CloseAll(); g.StartBattle(ch); });
        }
    }

    // ================================================================ the battle in Нутаг
    static readonly Vector2Int[] B_SPAWN = { new Vector2Int(54, 12), new Vector2Int(17, 2), new Vector2Int(1, 12) };
    static readonly Vector2Int[] B_TARGET = { new Vector2Int(27, 16), new Vector2Int(9, 14), new Vector2Int(4, 7), new Vector2Int(11, 7) };
    const int HERD_MAX = 5; const float ARROW_SPEED = 10, SHOOT_CD = 0.45f;
    sealed class Raider { public float x, y, homeX, homeY, speed, hitT = -9; public List<(int x, int y)> path; public int courage, max, face = 1; public bool flee, gone; public Look look; }
    sealed class Ally { public float x, y, cd; public int face = 2; public bool moving; public Look look; }
    sealed class Arrow { public float x, y, dx, dy, life; public bool mine; }
    sealed class Battle
    {
        public Chapters.Chapter ch; public int wave, toSpawn, herd = HERD_MAX, repelled, total; public float spawnT = 1.5f, breakT, cd, lassoCd; public bool over;
        public List<Raider> enemies = new List<Raider>(); public List<Ally> allies = new List<Ally>(); public List<Arrow> arrows = new List<Arrow>();
    }
    Battle battle;
    void StartBattle(Chapters.Chapter ch)
    {
        if (race != null) return;
        battle = new Battle { ch = ch, toSpawn = ch.waves[0], total = ch.waves.Sum() };
        for (int i = 0; i < ch.allies.Count; i++) { var l = ch.allies[i].look.Copy(); l.ride = "horse"; l.coat = ch.allies[i].coat; battle.allies.Add(new Ally { look = l, x = 18 + i * 2, y = 13 + i, cd = 1 + i * 0.5f }); }
        Sfx.Pop(); Toast(Loc.L($"{ch.name.mn}: 1-р давалгаа ирж байна!", $"{ch.name.en}: the first wave is coming!"));
    }
    Raider NearestEnemy(float x, float y, float max = 9) { Raider best = null; float bd = max; foreach (var e in battle.enemies) if (!e.flee) { float d = Dist(e.x, e.y, x, y); if (d < bd) { bd = d; best = e; } } return best; }
    bool ShootAt(float tx, float ty, Vector2? from = null)
    {
        var bt = battle; if (bt == null || bt.over) return false;
        var o = from ?? new Vector2(px + 0.5f, py + 0.82f);
        if (from == null) { if (bt.cd > 0) return false; bt.cd = SHOOT_CD; Sfx.Tap(); }
        float dx = tx - o.x, dy = ty - o.y, d = Mathf.Max(0.001f, Mathf.Sqrt(dx * dx + dy * dy));
        bt.arrows.Add(new Arrow { x = o.x, y = o.y, dx = dx / d, dy = dy / d, life = 1.1f, mine = from == null });
        return true;
    }
    void ShootNearest() { var bt = battle; if (bt == null) return; var e = NearestEnemy(px + 0.5f, py + 0.82f); if (e != null) ShootAt(e.x, e.y); else if (bt.cd <= 0) { bt.cd = 1.2f; Toast(Loc.L("Ойрхон дайсан алга.", "No raider nearby.")); } }
    void Lasso(Raider e) { var bt = battle; if (bt == null || bt.lassoCd > 0 || e.flee) return; bt.lassoCd = 1; e.courage -= 2; e.hitT = Time.time; Sfx.Pop(); Float(e.x - 0.5f, e.y - 0.8f, Loc.L("Уургадлаа!", "Lassoed!"), Px.Col("#f7c646")); if (e.courage <= 0) Scare(e); }
    void Scare(Raider e) { e.flee = true; e.courage = 0; battle.repelled++; Float(e.x - 0.5f, e.y - 1, Loc.L("Зориг нь мохлоо!", "Lost courage!"), Color.white); Sfx.Good(); }
    void BattleTick(float dt)
    {
        var bt = battle; if (bt == null || bt.over) return;
        bt.cd = Mathf.Max(0, bt.cd - dt); bt.lassoCd = Mathf.Max(0, bt.lassoCd - dt);
        // waves: spawn the raiders one by one from the edges of the village
        if (bt.toSpawn > 0)
        {
            bt.spawnT -= dt;
            if (bt.spawnT <= 0)
            {
                bt.spawnT = 1.6f; bt.toSpawn--; var sp = B_SPAWN[Random.Range(0, B_SPAWN.Length)]; var tg = B_TARGET[Random.Range(0, B_TARGET.Length)];
                var l = bt.ch.enemyLook.Copy(); l.ride = "horse"; l.coat = bt.ch.enemyCoat;
                bt.enemies.Add(new Raider { x = sp.x + 0.5f, y = sp.y + 0.5f, homeX = sp.x + 0.5f, homeY = sp.y + 0.5f, path = World.FindPath(sp.x, sp.y, tg.x, tg.y) ?? new List<(int, int)>(), courage = bt.ch.courage, max = bt.ch.courage, speed = 1.9f + Chapters.ALL.IndexOf(bt.ch) * 0.15f + bt.wave * 0.1f, look = l });
            }
        }
        else if (bt.enemies.Count == 0)
        {
            if (bt.wave + 1 >= bt.ch.waves.Count) { EndBattle(true); return; }
            bt.breakT += dt; if (bt.breakT > 2.5f) { bt.breakT = 0; bt.wave++; bt.toSpawn = bt.ch.waves[bt.wave]; bt.spawnT = 0.5f; Toast(Loc.L($"{bt.wave + 1}-р давалгаа!", $"Wave {bt.wave + 1}!")); }
        }
        // raiders follow the roads to the herd; scared ones ride straight home
        foreach (var e in bt.enemies)
        {
            float tx0, ty0;
            if (e.flee) { tx0 = e.homeX; ty0 = e.homeY; } else if (e.path.Count > 0) { tx0 = e.path[0].x + 0.5f; ty0 = e.path[0].y + 0.5f; }
            else { bt.herd--; e.flee = true; Sfx.Bad(); Float(e.x - 0.5f, e.y - 1, Loc.L("Хонь айлаа!", "A sheep got scared!"), Px.Col("#e14b3d")); continue; }
            float dx = tx0 - e.x, dy = ty0 - e.y, d = Mathf.Sqrt(dx * dx + dy * dy), s = (e.flee ? 3.4f : e.speed) * dt;
            if (d <= s) { e.x = tx0; e.y = ty0; if (!e.flee) e.path.RemoveAt(0); else e.gone = true; } else { e.x += dx / d * s; e.y += dy / d * s; }
            if (Mathf.Abs(dx) > 0.05f) e.face = dx < 0 ? 1 : 2;
        }
        bt.enemies.RemoveAll(e => e.gone);
        // allies ride towards the nearest raider and loose arrows
        foreach (var a in bt.allies)
        {
            var e = NearestEnemy(a.x, a.y, 30); if (e == null) { a.moving = false; continue; }
            float dx = e.x - a.x, dy = e.y - a.y, d = Mathf.Sqrt(dx * dx + dy * dy);
            if (d > 3.5f) { a.x += dx / d * 2.6f * dt; a.y += dy / d * 2.6f * dt; a.moving = true; } else a.moving = false;
            if (Mathf.Abs(dx) > 0.05f) a.face = dx < 0 ? 1 : 2;
            a.cd -= dt; if (a.cd <= 0 && d < 6) { a.cd = 1.5f + Random.value * 0.6f; float miss = Random.value < 0.3f ? 1.2f : 0; ShootAt(e.x + miss, e.y + miss * 0.5f, new Vector2(a.x, a.y)); }
        }
        // arrows: blunt whistling arrows that only take courage
        foreach (var ar in bt.arrows)
        {
            ar.x += ar.dx * ARROW_SPEED * dt; ar.y += ar.dy * ARROW_SPEED * dt; ar.life -= dt;
            foreach (var e in bt.enemies) if (!e.flee && Dist(e.x, e.y, ar.x, ar.y) < 0.6f) { e.courage--; e.hitT = Time.time; ar.life = 0; if (ar.mine) Sfx.Tap(); if (e.courage <= 0) Scare(e); break; }
        }
        bt.arrows.RemoveAll(a => a.life <= 0);
        if (bt.herd <= 0) EndBattle(false);
    }
    void EndBattle(bool won)
    {
        var bt = battle; if (bt == null || bt.over) return; bt.over = true;
        var ch = bt.ch; bool first = won && !V.campWon.Contains(ch.id);
        if (won) { if (first) V.campWon.Add(ch.id); Reward(first ? 40 : 15, first ? 60 : 20); Quest("defend"); Sfx.Win(); Confetti(80); HistoryBattleWon(ch.id); CheckAchievements(); } else Sfx.Bad();
        V.Save(); StartCoroutine(BattleOff());
        Open(new BattleEndModal(won, bt));
    }
    System.Collections.IEnumerator BattleOff() { yield return new WaitForSeconds(0.6f); battle = null; }
    sealed class BattleEndModal : Modal
    {
        readonly bool won; readonly Battle bt; public BattleEndModal(bool won, Battle bt) { this.won = won; this.bt = bt; }
        public override void Draw(Game g)
        {
            g.Picture(Emo.Icon(won ? "🏆" : "🐑"), 56);
            GUILayout.Label("<b>" + (won ? Loc.L("Нутгаа хамгааллаа!", "You defended the land!") : Loc.L("Дахин оролдоё!", "Let’s try again!")) + "</b>", new GUIStyle(g.sTitle) { alignment = TextAnchor.MiddleCenter });
            g.Text(won ? Loc.L($"{bt.repelled} дайсны зоригийг мохоож, малаа аварлаа. Хонь {bt.herd}/{HERD_MAX}", $"You broke the courage of {bt.repelled} raiders and saved the herd. Sheep {bt.herd}/{HERD_MAX}") : Loc.L("Хонинууд айсан ч бүгд эсэн мэнд, буцаад ирлээ. Холбоотнуудтайгаа хамт дахиад хамгаалъя!", "The sheep got scared, but they’re all safe and back home. Let’s defend again with your allies!"));
            if (won) g.Fact(bt.ch.after.ToString(), true, Loc.L("Түүхэнд юу болсон бэ?", "What really happened?"));
            if (g.Btn(Loc.L("Гайхалтай!", "Great!"), true, 44)) g.Later(g.Close);
        }
        public override void Press(Game g) => g.Close();
    }
    void BattleDraw()
    {
        var bt = battle; if (bt == null) return;
        foreach (var e in bt.enemies) Rider(e.look, e.face, true, e.x - 0.5f, e.y - 0.82f, e.y - 0.82f);
        foreach (var a in bt.allies) Rider(a.look, a.face, a.moving, a.x - 0.5f, a.y - 0.82f, a.y - 0.82f);
    }
    void BattleOverlay(float ts)
    {
        var bt = battle; if (bt == null) return;
        foreach (var a in bt.arrows)
        {
            var p1 = PxGui(a.x * T, a.y * T - 10); var p2 = PxGui((a.x - a.dx * 0.5f) * T, (a.y - a.dy * 0.5f) * T - 10);
            int n = Mathf.CeilToInt((p2 - p1).magnitude / 2); for (int i = 0; i <= n; i++) { var p = Vector2.Lerp(p1, p2, i / (float)Mathf.Max(1, n)); Box(new Rect(p.x - 1, p.y - 1, 2, 2), Px.Col("#3a2516")); }
            Box(new Rect(p1.x - ArtPx, p1.y - ArtPx, ArtPx * 2, ArtPx * 2), Px.Col("#f7c646"));
        }
        foreach (var e in bt.enemies) { var p = PxGui(e.x * T, e.y * T - 38); Outlined(p.x, p.y, e.flee ? ":(" : new string('♥', Mathf.Max(0, e.courage)) + new string('◊', Mathf.Max(0, e.max - e.courage)), ts * 0.9f, e.flee ? Color.white : Px.Col("#e14b3d")); }
    }
    string BattleLabel() { var bt = battle; return bt == null ? "" : $"{bt.ch.name} · {Loc.L("Давалгаа", "Wave")} {bt.wave + 1}/{bt.ch.waves.Count} · {Loc.L("Хонь", "Sheep")} {bt.herd}/{HERD_MAX} · {bt.repelled}/{bt.total}"; }
}
