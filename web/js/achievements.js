/* Амжилтууд: badges a child earns by learning, doing things with family, and playing in Нутаг.
   Parents see them (with dates) and what the child has learned on the parent dashboard. */
(function (TG) {
  const { L, tx } = TG;
  const S = TG.store;
  const T = (mn, en) => ({ mn, en });
  const CATS = { learn: T('Сурах', 'Learning'), family: T('Гэр бүл, найз', 'Family & friends'), nutag: T('Нутаг', 'Nutag'), naadam: T('Наадам', 'Naadam') };
  const lessons = (c) => (TG.learn ? TG.learn.LESSONS : []).filter((l) => c.learn[l.id] && c.learn[l.id].done).length;
  const famDone = (c) => (TG.learn ? TG.learn.LESSONS : []).filter((l) => c.learn[l.id] && c.learn[l.id].family).length;
  const bc = (c, unit) => (TG.bichig ? TG.bichig.ALL : []).filter((it) => (!unit || it.unit === unit) && c.p.bichig && c.p.bichig.s[it.id]).length;
  const lvl = (c) => (TG.vrules ? TG.vrules.level(c.v.xp || 0).l : 1);
  // A(id, category, emblem, name mn, name en, how mn, how en, test, progress?): every badge has its own pixel emblem (js/icons.js)
  const A = (id, cat, emblem, nm, ne, dm, de, test, prog) => ({ id, cat, emblem, name: T(nm, ne), desc: T(dm, de), test, prog });
  const LIST = [
    A('first_lesson', 'learn', 'book_open', 'Анхны хичээл', 'First lesson', 'Өв соёлын анхны хичээлээ дуусгах', 'Finish your first heritage lesson', (c) => lessons(c) >= 1),
    A('all_lessons', 'learn', 'grad_cap', 'Өв соёлын сурагч', 'Heritage scholar', 'Бүх хичээлийг дуусгах', 'Finish every lesson', (c) => TG.learn && lessons(c) >= TG.learn.LESSONS.length, (c) => [lessons(c), TG.learn ? TG.learn.LESSONS.length : 4]),
    A('bichig_first', 'learn', 'brush', 'Анхны үсэг', 'First letter', 'Монгол бичгээр анхны үсгээ бичих', 'Write your first letter in Mongol script', (c) => bc(c) >= 1),
    A('bichig_vowels', 'learn', 'script', 'Эгшиг мэддэг', 'Vowel writer', 'Монгол бичгийн 7 эгшгийг бичих', 'Write all 7 vowels in Mongol script', (c) => bc(c, 'vowel') >= 7, (c) => [bc(c, 'vowel'), 7]),
    A('bichig_master', 'learn', 'scroll', 'Бичээч', 'Scribe', 'Академийн бүх үсэг, үгийг бичих', 'Write every letter and word in the academy', (c) => TG.bichig && bc(c) >= TG.bichig.ALL.length, (c) => [bc(c), TG.bichig ? TG.bichig.ALL.length : 27]),
    A('bichig_memory', 'learn', 'brain', 'Санаж бичигч', 'From memory', '5 үсгийг загваргүй санаж бичих', 'Write 5 letters from memory', (c) => Object.keys((c.p.bichig || {}).mem || {}).length >= 5, (c) => [Object.keys((c.p.bichig || {}).mem || {}).length, 5]),
    A('ger_master', 'learn', 'ger', 'Гэрийн эзэн', 'Ger builder', 'Монгол гэр барьж сурах', 'Learn to build a Mongol ger', (c) => !!(c.learn.ger && c.learn.ger.done)),
    A('dairy', 'learn', 'milk', 'Цагаан идээчин', 'Dairy maker', 'Цагаан идээ хийж сурах', 'Learn to make dairy foods', (c) => !!(c.learn.idee && c.learn.idee.done)),
    A('manners', 'learn', 'thanks', 'Ёсон дагуу', 'Good manners', 'Гэрийн ёс заншил сурах', 'Learn ger manners', (c) => !!(c.learn.customs && c.learn.customs.done)),
    A('nuuts', 'learn', 'tome', 'Нууц товчоо судлаач', 'Secret History explorer', 'Нууц товчооны үлгэрүүдийг сонсох', 'Hear the tales of the Secret History', (c) => !!(c.learn.nuuts && c.learn.nuuts.done)),
    A('perfect', 'learn', 'hundred', 'Төгс оноо', 'Perfect score', 'Хичээлийн 3 асуултад бүгдэд нь зөв хариулах', 'Answer all 3 lesson questions right', (c) => Object.values(c.learn).some((x) => (x.best || 0) >= 3)),
    A('quiz10', 'learn', 'bulb', 'Сэргэлэн ухаан', 'Bright mind', 'Басарын 10 асуултад зөв хариулах', 'Answer 10 of Basar’s questions right', (c) => (c.b.right || 0) >= 10, (c) => [c.b.right || 0, 10]),
    A('quiz50', 'learn', 'owl', 'Мэргэн', 'Wise one', 'Басарын 50 асуултад зөв хариулах', 'Answer 50 of Basar’s questions right', (c) => (c.b.right || 0) >= 50, (c) => [c.b.right || 0, 50]),
    A('curious', 'learn', 'question', 'Сониуч', 'Curious', 'Басараас 10 асуулт асуух', 'Ask Basar 10 questions', (c) => (c.b.asked || 0) >= 10, (c) => [c.b.asked || 0, 10]),
    A('all_topics', 'learn', 'rainbow', 'Олон талт', 'All-rounder', 'Сэдэв бүрээс нэг нэг асуултад зөв хариулах', 'Get a question right in every topic', (c) => Object.keys(TG.BASAR ? TG.BASAR.TOPICS : {}).every((k) => c.b.topics && c.b.topics[k] && c.b.topics[k].right > 0),
      (c) => [Object.keys(TG.BASAR ? TG.BASAR.TOPICS : {}).filter((k) => c.b.topics && c.b.topics[k] && c.b.topics[k].right > 0).length, Object.keys(TG.BASAR ? TG.BASAR.TOPICS : {}).length]),
    A('emee', 'family', 'grandma', 'Эмээгийн зочин', 'Grandma’s guest', 'Эмээгийн гэрт ёсоор зочлох', 'Visit Grandma’s ger with good manners', (c) => (c.v.emee && c.v.emee.visits) >= 1),
    A('emee_perfect', 'family', 'tea_bowl', 'Ёсорхог хүүхэд', 'Perfect manners', 'Эмээгийн гэрт нэг ч алдаагүй зочлох', 'Visit Grandma without a single slip', (c) => (c.v.emee && c.v.emee.perfect) >= 1),
    A('family1', 'family', 'family3', 'Хамтдаа хийсэн', 'Done together', 'Гэр бүлээрээ анхны бодит ажлаа хийх', 'Do your first real activity with family', (c) => famDone(c) >= 1),
    A('family_all', 'family', 'home_garden', 'Гэр бүлийн баатар', 'Family hero', 'Бүх гэр бүлийн ажлыг хийх', 'Do every family activity', (c) => TG.learn && famDone(c) >= TG.learn.LESSONS.length, (c) => [famDone(c), TG.learn ? TG.learn.LESSONS.length : 4]),
    A('with_family', 'family', 'heart_yellow', 'Гэр бүлээрээ сурсан', 'Learned with family', 'Хичээлийг гэр бүлтэйгээ хамт үзэх', 'Do a lesson together with family', (c) => (c.tg.family || 0) >= 1),
    A('with_friends', 'family', 'handshake', 'Найзуудтайгаа сурсан', 'Learned with friends', 'Хичээл эсвэл асуулт хариултыг найзуудтайгаа хийх', 'Do a lesson or quiz with friends', (c) => (c.tg.friends || 0) >= 1),
    A('stars20', 'family', 'star', 'Од түгээгч', 'Star collector', 'Гэр бүлийн 20 од цуглуулах', 'Collect 20 family stars', () => (S.state.familyStars || 0) >= 20, () => [S.state.familyStars || 0, 20]),
    A('memory', 'family', 'mic', 'Дурсамж хадгалагч', 'Memory keeper', 'Ахмадын яриаг Дурсамжийн номонд хадгалах', 'Save an elder’s story in the memory book', () => (S.state.memCount || 0) >= 1),
    A('character', 'nutag', 'palette', 'Миний дүр', 'My character', 'Ястан, нутаг, хувцсаа сонгож дүрээ бүтээх', 'Create your character: people, province and outfit', (c) => !!c.p.eth && c.p.eth !== 'skip'),
    A('passport1', 'nutag', 'stamp', 'Анхны тамга', 'First stamp', 'Аймгийн паспортдаа анхны тамгаа авах', 'Get the first stamp in your aimag passport', (c) => TG.passport && TG.passport.stamps(c.p) >= 1),
    A('passport11', 'nutag', 'compass', 'Аялагч', 'Traveller', '11 аймгаар аялах', 'Travel to 11 provinces', (c) => TG.passport && TG.passport.stamps(c.p) >= 11, (c) => [TG.passport ? TG.passport.stamps(c.p) : 0, 11]),
    A('passport22', 'nutag', 'flag_mn', 'Монголоор бүрэн аялсан', 'All of Mongolia', 'Улаанбаатар болон 21 аймгаар бүгдээр аялах', 'Visit Ulaanbaatar and all 21 provinces', (c) => TG.passport && TG.passport.stamps(c.p) >= 22, (c) => [TG.passport ? TG.passport.stamps(c.p) : 0, 22]),
    A('seasons4', 'nutag', 'seasons', 'Дөрвөн улирал', 'Four seasons', 'Дөрвөн улирал бүрийн даалгаврыг биелүүлэх', 'Complete a season quest in all four seasons', (c) => Object.keys(c.v.seasonDone || {}).length >= 4, (c) => [Object.keys(c.v.seasonDone || {}).length, 4]),
    A('level5', 'nutag', 'star_glow', 'Нутгийн од', 'Village star', 'Нутагт 5-р түвшинд хүрэх', 'Reach level 5 in Nutag', (c) => lvl(c) >= 5, (c) => [lvl(c), 5]),
    A('taster', 'nutag', 'plate', 'Амтлагч', 'Food explorer', '8 төрлийн монгол хоол, ундаа амсах', 'Taste 8 different Mongolian foods and drinks', (c) => Object.keys(c.v.ate || {}).length >= 8, (c) => [Object.keys(c.v.ate || {}).length, 8]),
    A('defender', 'naadam', 'shield', 'Нутгийн хамгаалагч', 'Defender', 'Нутгаа хамгаалах нэг тулаанд ялах', 'Win a defend-the-homeland battle', (c) => Object.keys((c.v.camp || {}).won || {}).length >= 1),
    A('all_chapters', 'naadam', 'fortress', 'Түүхийн баатар', 'Hero of history', 'Дөрвөн бүлгийг бүгдийг нь хамгаалах', 'Defend in all four chapters', (c) => Object.keys((c.v.camp || {}).won || {}).length >= 4, (c) => [Object.keys((c.v.camp || {}).won || {}).length, 4]),
    A('historian', 'learn', 'quill', 'Залуу түүхч', 'Young historian', 'Түүхчийн 5 даалгавар биелүүлэх', 'Finish 5 of the historian’s tasks', (c) => ((c.p.hist || {}).step || 0) >= 5, (c) => [(c.p.hist || {}).step || 0, 5]),
    A('ger_built', 'nutag', 'home', 'Өөрийн гэртэй', 'Home of my own', 'Нутагт өөрийн гэрээ барих', 'Build your own ger in Nutag', (c) => !!c.v.gerBuilt),
    A('ger_perfect', 'nutag', 'home', 'Алдаагүй барьсан', 'Built without a slip', 'Нэг ч алдаагүйгээр гэрээ барих', 'Build your ger without a single mistake', (c) => !!(c.v.ger && c.v.ger.perfect)),
    A('fisher', 'nutag', 'rod', 'Загасчин', 'Fisher', '5 загас барих', 'Catch 5 fish', (c) => (c.v.fishCaught || 0) >= 5, (c) => [c.v.fishCaught || 0, 5]),
    A('rider', 'nutag', 'horse', 'Морь унаач', 'Rider', 'Морь унаж Нутгаар 200 алхам давхих', 'Ride 200 tiles around Nutag', (c) => (c.h.dist || 0) >= 200, (c) => [Math.floor(c.h.dist || 0), 200]),
    A('race_win', 'naadam', 'trophy', 'Түрүү морь', 'Winning horse', 'Морин уралдаанд түрүүлэх', 'Win a horse race', (c) => (c.h.wins || 0) >= 1),
    A('race_top5', 'naadam', 'medal_gold', 'Айргийн тав', 'Top five', '5 уралдаанд айргийн тавд орох', 'Finish in the top five in 5 races', (c) => (c.h.top5 || 0) >= 5, (c) => [c.h.top5 || 0, 5]),
    A('mergen', 'naadam', 'bow', 'Мэргэн', 'Mergen (Sharpshooter)', 'Сур харваанд 12-оос 6 онох', 'Hit 6 of 12 in archery', (c) => (c.v.arch && c.v.arch.best) >= 6, (c) => [c.v.arch ? c.v.arch.best : 0, 6]),
    A('ulsyn_mergen', 'naadam', 'target', 'Улсын мэргэн', 'State Sharpshooter', 'Сур харваанд 12 бүгдийг онох', 'Hit all 12 in archery', (c) => (c.v.arch && c.v.arch.best) >= 12, (c) => [c.v.arch ? c.v.arch.best : 0, 12]),
    A('ikh_nas', 'naadam', 'horse_head', 'Их насны уралдаан', 'Big race', 'Морин уралдааны “Их нас” ангиллыг нээх', 'Unlock the “Ikh nas” race class', (c) => (c.h.cls || 0) >= 4, (c) => [Math.min(c.h.cls || 0, 4), 4]),
    A('wr_first', 'naadam', 'arm', 'Анхны давалт', 'First win', 'Бөхийн барилдаанд анх удаа давах', 'Win your first wrestling round', (c) => (c.w.wins || 0) + (c.w.pvpW || 0) >= 1),
    A('techs7', 'naadam', 'zodog', 'Мэхний мастер', 'Technique master', '7 мэх бүрээр нэг нэг удаа давуулах', 'Score with all 7 techniques', (c) => Object.keys(c.w.techs || {}).length >= 7, (c) => [Object.keys(c.w.techs || {}).length, 7]),
    A('nachin', 'naadam', 'falcon', 'Начин', 'Nachin (Falcon)', 'Наадамд 5 даваа давах', 'Win 5 rounds at the Naadam', (c) => (c.w.best || 0) >= 5, (c) => [c.w.best || 0, 5]),
    A('zaan', 'naadam', 'elephant', 'Заан', 'Zaan (Elephant)', 'Наадамд 7 даваа давах', 'Win 7 rounds at the Naadam', (c) => (c.w.best || 0) >= 7, (c) => [c.w.best || 0, 7]),
    A('arslan', 'naadam', 'lion', 'Арслан', 'Arslan (Lion)', 'Наадамд түрүүлэх', 'Win the whole Naadam', (c) => (c.w.champ || 0) >= 1),
  ];
  const ctxOf = (p) => { const v = p.village || {}; return { p, v, learn: p.learn || {}, b: p.basar || {}, w: v.wr || {}, h: v.horse || {}, tg: p.together || {} }; };
  /** Award any newly earned badges for the active child. Returns the new ones. */
  function check(silent) {
    const p = S.active(); if (!p) return [];
    p.ach = p.ach || {};
    const c = ctxOf(p), fresh = [];
    for (const a of LIST) { if (p.ach[a.id]) continue; let ok = false; try { ok = !!a.test(c); } catch (e) { ok = false; } if (ok) { p.ach[a.id] = Date.now(); fresh.push(a); } }
    if (fresh.length) {
      S.save();
      if (!silent) fresh.forEach((a, i) => setTimeout(() => { unlockedPopup(a); TG.sfx.chime && TG.sfx.chime(); }, 700 + i * 1500));
      fresh.forEach((a) => S.logActivity && S.logActivity({ kind: 'ach', id: a.id }));
    }
    return fresh;
  }
  /** A badge picture: greyed out until earned (CSS), full colour once it is. */
  const badge = (a, cls) => (TG.icons ? TG.icons.badgeImg(a.emblem, a.cat, cls) : document.createElement('span'));
  /** The toast for a new badge: the badge itself pops in and shines. */
  function unlockedPopup(a) {
    const el = TG.h('div', { class: 'ach-pop', role: 'status' }, badge(a, 'pop'), TG.h('div', null, TG.h('small', null, L('Шинэ амжилт!', 'New achievement!')), TG.h('b', null, tx(a.name))));
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3600);
  }
  const progress = (a, p) => { if (!a.prog) return null; try { return a.prog(ctxOf(p)); } catch (e) { return null; } };
  TG.achievements = { LIST, CATS, check, progress, badge, byId: (id) => LIST.find((a) => a.id === id) };
})(window.TG);
