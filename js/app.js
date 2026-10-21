/* Naadamy — screens, navigation, family features */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const SCREENS = {};
  let cleanupGame = null, screen = 'home', params = {}, homeAge = null, homePillar = 'all', parentUntil = 0;

  // ---------------- navigation ----------------
  // smooth, direction-aware transitions between screens (View Transitions API with a CSS fallback)
  const NAV_ORDER = ['home', 'village', 'satis', 'memories', 'parents'];
  const calm = () => S.state.settings.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function transition(kind, update) {
    document.documentElement.dataset.vt = kind;
    if (calm()) return update();
    if (document.startViewTransition) { try { document.startViewTransition(update); return; } catch (e) { /* fall through */ } }
    update();
    const el = document.getElementById('app').firstElementChild;
    if (el) { el.classList.remove('screen-in'); void el.offsetWidth; el.classList.add('screen-in'); }
  }
  TG.go = function (name, p = {}) {
    if (cleanupGame) { try { cleanupGame(); } catch (e) { console.error(e); } cleanupGame = null; }
    const a = NAV_ORDER.indexOf(screen), b = NAV_ORDER.indexOf(name);
    screen = name; params = p;
    transition(a >= 0 && b >= 0 && a !== b ? (b > a ? 'left' : 'right') : 'up', () => { render(); window.scrollTo(0, 0); });
  };
  const soft = () => transition('fade', render); // tab / filter switches inside a screen
  function render() {
    const root = document.documentElement, st = S.state.settings;
    root.classList.toggle('big', !!st.bigText);
    root.classList.toggle('rm', !!st.reduceMotion);
    root.lang = S.state.lang;
    if (!S.state.profiles.length && !['onboard', 'about'].includes(screen)) screen = 'onboard';
    const app = document.getElementById('app');
    app.replaceChildren((SCREENS[screen] || SCREENS.home)(params));
  }
  const currentAge = () => homeAge || (S.active() ? S.ageGroupOf(S.active().age) : '7-10');
  const famName = (f) => tx(f.name);

  // ---------------- shared pieces ----------------
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#2F6BFF"/><circle cx="48" cy="15" r="5" fill="#FDB022"/><path d="M12 44 V34 Q32 16 52 34 V44 Z" fill="#fff"/><path d="M16 33 Q32 19 48 33" stroke="#F04438" stroke-width="3" fill="none"/><rect x="27.5" y="35" width="9" height="9" rx="1.5" fill="#F04438"/><rect x="10" y="44" width="44" height="4" rx="2" fill="#FDB022"/></svg>';

  function toggleLang() { S.state.lang = S.state.lang === 'mn' ? 'en' : 'mn'; S.save(); render(); }

  function topbar() {
    const p = S.active();
    return h('header', { class: 'topbar' },
      h('button', { class: 'brand', onclick: () => TG.go('home'), 'aria-label': 'home' }, h('span', { class: 'logo', html: LOGO }), h('span', null, 'Naadamy')),
      h('div', { class: 'top-actions' },
        h('button', { class: 'lang-btn', onclick: toggleLang, 'aria-label': 'language' }, TG.icon('globe'), S.state.lang === 'mn' ? 'EN' : 'МН'),
        p && h('button', { class: 'profile-chip', onclick: profileSwitcher }, h('span', { class: 'av' }, p.avatar), h('span', { class: 'pn' }, p.name))));
  }
  const NAV = [
    ['home', 'gamepad', 'Тоглоом', 'Play'], ['village', 'sprout', 'Нутаг', 'Village'], ['satis', 'sparkles', 'Цэгцлэе', 'Puzzles'],
    ['memories', 'book', 'Дурсамж', 'Memories'], ['parents', 'users', 'Эцэг эх', 'Parents'],
  ];
  function bottomNav() {
    return h('nav', { class: 'bottom-nav' }, NAV.map(([id, icon, mn, en]) => h('button', {
      class: 'nav-btn' + (screen === id ? ' active' : ''),
      onclick: () => (id === 'parents' ? openParents() : TG.go(id)),
    }, TG.icon(icon, 'ni'), h('span', null, L(mn, en)))));
  }
  function openParents() {
    if (Date.now() < parentUntil) return TG.go('parents');
    TG.parentGate(() => { parentUntil = Date.now() + 10 * 60 * 1000; TG.go('parents'); });
  }
  const shell = (children) => h('div', { class: 'shell' }, topbar(), h('main', { class: 'page' }, children), bottomNav());

  function ageTabs(active, onPick) {
    return h('div', { class: 'tabs', role: 'tablist' }, TG.AGE_GROUPS.map((a) => h('button', {
      class: 'tab' + (a.id === active ? ' active' : ''), role: 'tab', 'aria-selected': a.id === active ? 'true' : 'false',
      onclick: () => onPick(a.id),
    }, h('span', { class: 'te' }, a.emoji), h('span', { class: 'tt' }, tx(a.range)))));
  }

  // ---------------- family sky ----------------
  function familySky(n) {
    const W = 320, H = 150; let seed = 11;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const dipper = [[34, 34], [62, 40], [88, 50], [112, 64], [148, 58], [156, 86], [120, 92]];
    const extra = Array.from({ length: 40 }, () => [12 + rnd() * 296, 10 + rnd() * 96]).filter(([x, y]) => !(x < 170 && y < 100));
    const total = dipper.length + extra.length, lit = Math.min(n, total);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="sky-svg" role="img" aria-label="${L('Гэр бүлийн тэнгэр', 'Family sky')}">`
      + `<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101B45"/><stop offset="1" stop-color="#2E57B0"/></linearGradient></defs>`
      + `<rect width="${W}" height="${H}" rx="20" fill="url(#skyg)"/>`;
    if (lit >= 7) s += `<polyline points="${dipper.map((p) => p.join(',')).join(' ')} ${dipper[3].join(',')}" fill="none" stroke="#FFE27A" stroke-opacity=".55" stroke-width="1.2"/>`;
    [...dipper, ...extra].forEach(([x, y], i) => {
      const on = i < lit;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on ? 3 : 1.4}" fill="${on ? '#FFE27A' : '#ffffff'}" fill-opacity="${on ? 1 : 0.3}"${on ? ` class="tw" style="animation-delay:${(i % 7) * 0.4}s"` : ''}/>`;
    });
    s += `<circle cx="280" cy="30" r="13" fill="#FFF3C4"/><circle cx="286" cy="26" r="11" fill="#1A2A63"/>`
      + `<path d="M0 128 Q80 104 160 122 T320 116 V150 H0 Z" fill="#1E7A52"/>`
      + `<g transform="translate(206 92)"><path d="M0 34 V20 Q28 0 56 20 V34 Z" fill="#fff"/><path d="M4 19 Q28 3 52 19" stroke="#F04438" stroke-width="2.5" fill="none"/><rect x="23" y="21" width="10" height="13" rx="1.5" fill="#F04438"/><rect x="25.5" y="23" width="5" height="5" fill="#FDB022"/><path d="M28 5 v-6" stroke="#ccc" stroke-width="2"/></g>`
      + `</svg>`;
    const next = n < 7 ? L(`Хамтдаа тоглож ${7 - n} од цуглуулаад Долоон бурханыг гэрэлтүүл!`, `Earn ${7 - n} more stars together to light up the Big Dipper!`)
      : n < total ? L(`Бүх тэнгэрийг гэрэлтүүлэхэд ${total - n} од дутуу байна.`, `${total - n} stars until the whole sky shines.`)
        : L('Тэнгэр бүхэлдээ гэрэлтлээ! Та бол жинхэнэ хамтын гэр бүл 🎉', 'The whole sky is shining! What a family 🎉');
    return h('div', { class: 'sky-wrap' }, h('div', { html: s }),
      h('div', { class: 'sky-cap' }, h('b', null, `⭐ ${n} `, L('гэр бүлийн од', 'family stars')), h('span', null, next)));
  }

  // ---------------- onboarding ----------------
  function profileForm(onDone, submitLabel) {
    let age = 6, avatar = TG.AVATARS[0];
    const name = h('input', { class: 'input', placeholder: L('Хүүхдийн нэр', "Child's name"), maxlength: 20, 'aria-label': 'name' });
    const ageGrid = h('div', { class: 'age-grid' });
    const avGrid = h('div', { class: 'avatar-grid' });
    const drawAges = () => ageGrid.replaceChildren(...Array.from({ length: 16 }, (_, k) => k + 3).map((a) => h('button', { class: 'age-btn' + (a === age ? ' active' : ''), onclick: () => { age = a; drawAges(); } }, a)));
    const drawAv = () => avGrid.replaceChildren(...TG.AVATARS.map((e) => h('button', { class: 'av-btn' + (e === avatar ? ' active' : ''), onclick: () => { avatar = e; drawAv(); } }, e)));
    drawAges(); drawAv();
    const err = h('div', { class: 'err' });
    return h('div', { class: 'form' },
      h('label', null, L('Нэр', 'Name')), name,
      h('label', null, L('Нас', 'Age')), ageGrid,
      h('label', null, L('Дүрээ сонго', 'Pick an avatar')), avGrid, err,
      h('button', { class: 'btn primary big block', onclick: () => {
        const n = name.value.trim();
        if (!n) { err.textContent = L('Нэрээ бичээрэй 🙂', 'Please enter a name 🙂'); name.focus(); return; }
        onDone(S.addProfile({ name: n, age, avatar }));
      } }, submitLabel || L('Эхлэх 🚀', "Let's go 🚀")));
  }

  SCREENS.onboard = () => {
    let step = params.step || 0;
    if (step === 0) {
      return h('div', { class: 'onboard' },
        h('button', { class: 'lang-btn corner', onclick: toggleLang }, S.state.lang === 'mn' ? 'EN' : 'МН'),
        h('div', { class: 'ob-hero' },
          h('div', { class: 'ob-logo', html: LOGO }),
          h('div', { class: 'badge-pill' }, 'Fine-Tune for the Future · Pinequest'),
          h('h1', null, 'Naadamy'),
          h('p', { class: 'tagline' }, L('Хамтдаа тоглож, хамтдаа өсье.', 'Play together. Grow together.')),
          h('p', { class: 'ob-sub' }, L('Хүүхэд бүр, гэр бүл бүрт зориулсан, офлайн ажилладаг, монгол хэл дээрх суралцах тоглоомууд.', 'Learning games in Mongolian for every child and every family. Works offline.')),
          h('div', { class: 'pillars-mini' }, Object.values(TG.PILLARS).map((p) => h('div', { class: 'pm', style: { '--c': p.color } }, h('span', null, p.icon), tx(p.name))))),
        h('div', { class: 'ob-actions' },
          h('button', { class: 'btn primary big block', onclick: () => TG.go('onboard', { step: 1 }) }, L('Эхлэх', 'Get started')),
          h('button', { class: 'btn ghost block', onclick: () => TG.go('about') }, L('Төслийн тухай', 'About the project'))));
    }
    return h('div', { class: 'onboard' },
      h('div', { class: 'ob-card' },
        h('h2', null, L('Хэн тоглох вэ? 👋', "Who's playing? 👋")),
        h('p', { class: 'muted' }, L('Нас тань тохирох тоглоомуудыг санал болгоход тусална.', 'Age helps us suggest the right games.')),
        profileForm(() => { homeAge = null; TG.go('home'); TG.toast(L('Тавтай морил! 🎉', 'Welcome! 🎉')); })));
  };

  function profileSwitcher() {
    const close = TG.modal(h('div', null,
      h('h2', null, L('Хэн тоглож байна?', "Who's playing?")),
      h('div', { class: 'profile-list' }, S.state.profiles.map((p) => h('button', {
        class: 'profile-row' + (S.active() && p.id === S.active().id ? ' active' : ''),
        onclick: () => { S.state.activeId = p.id; S.save(); homeAge = null; close(); render(); },
      }, h('span', { class: 'av big' }, p.avatar), h('span', null, h('b', null, p.name), h('small', null, `${p.age} ${L('настай', 'years old')}`))))),
      h('button', { class: 'btn ghost block', onclick: () => { close(); addChildModal(); } }, '+ ', L('Хүүхэд нэмэх', 'Add a child'))));
  }
  function addChildModal() {
    const close = TG.modal(h('div', null, h('h2', null, L('Шинэ хүүхэд', 'New child')),
      profileForm(() => { close(); homeAge = null; render(); }, L('Нэмэх', 'Add'))));
  }

  // ---------------- home ----------------
  SCREENS.home = () => {
    const p = S.active(), ag = currentAge();
    const games = TG.gameOrder.map((id) => TG.games[id]).filter((g) => g.ages.includes(ag) && (homePillar === 'all' || g.pillar === homePillar));
    games.sort((a, b) => (b.flagship ? 1 : 0) - (a.flagship ? 1 : 0));
    const dm = TG.dailyMission(ag), done = S.missionDoneToday(dm.id);
    return shell([
      h('section', { class: 'hero' },
        h('div', { class: 'eyebrow' }, TG.fmtDate(new Date(), true)),
        h('div', { class: 'hello' }, L(`Сайн уу, ${p.name}`, `Hi, ${p.name}`), ' 👋'),
        h('p', { class: 'muted' }, L('Өнөөдөр хэнтэй хамт тоглох вэ?', 'Who will you play with today?')),
        familySky(S.state.familyStars)),
      h('section', { class: 'daily' + (done ? ' done' : '') },
        h('div', { class: 'daily-e' }, dm.emoji),
        h('div', { class: 'daily-body' },
          h('small', null, L('Өнөөдрийн гэр бүлийн даалгавар', "Today's family mission")),
          h('b', null, tx(dm.title)), h('p', null, tx(dm.desc)),
          h('button', { class: 'daily-link', onclick: () => TG.go('missions') }, L('Бүх даалгавар', 'All missions'), ' →')),
        h('button', { class: 'btn ' + (done ? 'done' : 'primary'), disabled: done, onclick: () => completeMission(dm) }, done ? '✓' : L('Хийлээ!', 'Done!'))),
      villageBanner(),
      satisBanner(ag),
      h('div', { class: 'section-head' }, h('h3', null, L('Тоглоомууд', 'Games')), h('span', { class: 'count' }, games.length)),
      ageTabs(ag, (a) => { homeAge = a; soft(); }),
      h('div', { class: 'chips' }, [['all', '✨', { mn: 'Бүгд', en: 'All' }], ...Object.entries(TG.PILLARS).map(([k, v]) => [k, v.icon, v.name])].map(([k, icon, name]) =>
        h('button', { class: 'chip' + (homePillar === k ? ' active' : ''), onclick: () => { homePillar = k; soft(); } }, icon, ' ', tx(name)))),
      h('div', { class: 'grid' }, games.map(gameCard)),
      games.length ? null : h('p', { class: 'empty' }, L('Энэ ангилалд тоглоом алга. Өөр ангилал сонгоорой.', 'No games here yet. Try another filter.')),
    ]);
  };

  function gameCard(g) {
    const P = TG.PILLARS[g.pillar];
    return h('button', { class: 'game-card' + (g.flagship ? ' flagship' : ''), style: { '--gc': P.color }, onclick: () => launch(g) },
      g.flagship ? h('span', { class: 'ribbon' }, '★ ', L('Уламжлалт', 'Tradition')) : null,
      h('div', { class: 'gc-icon' }, g.icon),
      h('div', { class: 'gc-body' },
        h('div', { class: 'gc-title' }, tx(g.title)),
        h('div', { class: 'gc-desc' }, tx(g.desc)),
        h('div', { class: 'gc-tags' }, h('span', { class: 'tag' }, P.icon, ' ', tx(P.name)), h('span', { class: 'tag fam' }, '👨‍👩‍👧 ', L('Хамтдаа', 'Together')))));
  }

  // ---------------- "Нутаг" shared village ----------------
  SCREENS.village = () => TG.villageScreen({ setCleanup: (fn) => { cleanupGame = fn; } });
  function villageBanner() {
    const vi = TG.villageInfo ? TG.villageInfo() : null;
    return h('button', { class: 'village-banner', onclick: () => TG.go('village') },
      h('div', { class: 'vb-scene', 'aria-hidden': 'true' }, TG.pixel.icon('ui:logo', 48)),
      h('div', { class: 'vb-body' },
        h('div', { class: 'eyebrow' }, L('Шинэ · Хамт тоглох', 'New · Play together')),
        h('b', null, L('Нутаг: хамтын цэцэрлэг', 'Village: grow together')),
        h('span', null, L('Найзуудтайгаа тарьж, загасчилж, хувцас, тэжээвэр аваарай', 'Plant, fish and dress up with friends')),
        vi ? h('div', { class: 'vb-stats' }, h('span', null, `⭐ ${L('Түвшин', 'Level')} ${vi.l}`), h('span', null, `🪙 ${vi.coins}`)) : null),
      h('span', { class: 'sb-go' }, TG.icon('chevronRight')));
  }

  // ---------------- "Цэгцлэе!" satisfying puzzles ----------------
  SCREENS.satis = () => TG.satisMap({ shell, ageTabs, ag: currentAge(), setAge: (a) => { homeAge = a; soft(); }, rerender: render });
  SCREENS.satisLevel = (p) => TG.satisLevel({ ...p, setCleanup: (fn) => { cleanupGame = fn; } });
  function satisBanner(ag) {
    const pr = TG.satisProgress(ag);
    return h('button', { class: 'satis-banner', onclick: () => TG.go('satis') },
      h('div', { class: 'sb-bubbles', 'aria-hidden': 'true' }, ['🫧', '🧩', '🧽', '🥛'].map((e, k) => h('span', { style: { animationDelay: k * 0.4 + 's' } }, e))),
      h('div', { class: 'sb-body' },
        h('b', null, '✨ ', L('Цэгцлэе!', 'Make it perfect!')),
        h('span', null, L(`${pr.n} тайван, сэтгэл ханамжтай түвшин`, `${pr.n} calming, satisfying levels`)),
        h('div', { class: 'meter' }, h('span', { style: { width: (pr.stars / pr.max) * 100 + '%' } }))),
      h('span', { class: 'sb-go' }, TG.icon('chevronRight')));
  }

  // ---------------- launcher ----------------
  function launch(g) {
    const p = S.active(), max = (g.maxPlayers || 4) - 1;
    let together = true; const picked = [];
    const body = h('div');
    const draw = () => {
      body.replaceChildren(
        h('div', { class: 'launch-head' }, h('div', { class: 'launch-icon' }, g.icon), h('div', null, h('h2', null, tx(g.title)), h('p', { class: 'muted' }, tx(g.desc)))),
        h('div', { class: 'mode-row' },
          h('button', { class: 'mode' + (together ? ' active' : ''), onclick: () => { together = true; draw(); } }, h('span', null, '👨‍👩‍👧'), h('b', null, L('Хамтдаа', 'Together')), h('small', null, L('+ гэр бүлийн од', '+ family stars'))),
          h('button', { class: 'mode' + (!together ? ' active' : ''), onclick: () => { together = false; draw(); } }, h('span', null, '🙋'), h('b', null, L('Ганцаараа', 'Solo')), h('small', null, L('Өөрөө дасгалжих', 'Practice alone')))),
        together ? h('div', null,
          h('p', { class: 'label' }, L(`Хэнтэй тоглох вэ? (${max} хүртэл)`, `Play with whom? (up to ${max})`)),
          h('div', { class: 'fam-chips' }, S.state.family.map((f) => {
            const on = picked.includes(f.id);
            return h('button', { class: 'fam-chip' + (on ? ' active' : ''), onclick: () => {
              if (on) picked.splice(picked.indexOf(f.id), 1);
              else { if (picked.length >= max) picked.shift(); picked.push(f.id); }
              draw();
            } }, f.emoji, ' ', famName(f));
          })),
          g.id === 'mathduel' ? h('p', { class: 'hint' }, '📱 ', L('Утсаа ширээн дээр тавиад, хоёулаа эсрэг талаас нь тоглоорой!', 'Lay the phone flat and sit facing each other!')) : null) : null,
        h('button', { class: 'btn primary big block', disabled: together && !picked.length, onclick: start },
          together && !picked.length ? L('Хамт тоглох хүнээ сонго', 'Pick who you play with') : L('Тоглох ▶', 'Play ▶')));
    };
    const start = () => {
      const players = [{ name: p.name, emoji: p.avatar, color: TG.PCOLORS[0] }];
      if (together) picked.forEach((id, i) => { const f = S.state.family.find((x) => x.id === id); players.push({ name: famName(f), emoji: f.emoji, color: TG.PCOLORS[i + 1] }); });
      close(); TG.go('play', { g, players, together });
    };
    draw();
    const close = TG.modal(body, { cls: 'launch' });
  }

  TG.launchGame = launch;

  // ---------------- play / result ----------------
  SCREENS.play = ({ g, players, together }) => {
    const hud = h('div', { class: 'hud' }), stage = h('div', { class: 'stage' });
    const t0 = Date.now(); let done = false;
    const ctx = {
      ageGroup: currentAge(), players, together, hud, root: stage, game: g,
      finish(res) {
        if (done) return; done = true;
        const stars = Math.max(1, Math.min(3, res.stars || 1));
        const reward = S.record({ gameId: g.id, pillar: g.pillar, stars, together, seconds: (Date.now() - t0) / 1000 });
        TG.go('result', { g, players: res.players || players, together, res: { ...res, stars, reward } });
      },
    };
    const el = h('div', { class: 'play-screen' },
      h('div', { class: 'play-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'back', onclick: () => confirmLeave() }, TG.icon('arrowLeft')),
        h('div', { class: 'play-title' }, g.icon, ' ', tx(g.title)), hud),
      stage);
    setTimeout(() => { if (screen === 'play' && params.g === g) cleanupGame = g.start(ctx) || null; }, 0);
    return el;
  };
  function confirmLeave() {
    const close = TG.modal(h('div', { class: 'center' },
      h('div', { class: 'big-emoji' }, '🤔'), h('h2', null, L('Тоглоомоос гарах уу?', 'Leave the game?')),
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn ghost', onclick: () => close() }, L('Үгүй, үргэлжлүүлье', 'No, keep playing')),
        h('button', { class: 'btn primary', onclick: () => { close(); TG.go('home'); } }, L('Тийм', 'Yes')))));
  }

  SCREENS.result = ({ g, players, together, res }) => {
    setTimeout(() => { TG.sfx.win(); TG.confetti(); }, 100);
    let winner = null;
    if (res.scores && players.length > 1) {
      const max = Math.max(...res.scores), ws = players.filter((_, i) => res.scores[i] === max);
      winner = ws.length > 1 ? L('Тэнцлээ! Та нар бүгдээрээ ялагчид 🤝', "It's a tie! Everyone wins 🤝") : `🏆 ${ws[0].name} ${L('түрүүллээ!', 'wins!')}`;
    }
    let claimed = false;
    const rlBtn = h('button', { class: 'btn success', onclick: () => {
      if (claimed) return; claimed = true; S.addFamilyStars(2); TG.sfx.chime();
      rlBtn.textContent = L('✓ Бодит амьдрал дээр хийлээ! +2 ⭐', '✓ Done in real life! +2 ⭐'); rlBtn.disabled = true;
    } }, L('Хийлээ! +2 ⭐', 'We did it! +2 ⭐'));
    return h('div', { class: 'result' },
      h('div', { class: 'res-icon' }, g.icon),
      h('div', { class: 'res-stars', 'aria-label': `${res.stars} stars` }, [1, 2, 3].map((k) => h('span', { class: k <= res.stars ? 'on' : '', style: { animationDelay: k * 0.18 + 's' } }, '★'))),
      h('h1', null, res.stars === 3 ? L('Гайхалтай!', 'Amazing!') : res.stars === 2 ? L('Сайн байна!', 'Well done!') : L('Сайн оролдлого!', 'Nice try!')),
      winner ? h('div', { class: 'winner' }, winner) : null,
      res.summary ? h('p', { class: 'muted' }, res.summary) : null,
      players.length > 1 && res.scores ? TG.scoreboard(players, res.scores, -1) : null,
      res.reward ? rewardChip(res.reward) : null,
      h('p', { class: 'res-msg' }, together
        ? L(`Хамтдаа өнгөрүүлсэн мөч хамгийн том шагнал. Гэр бүлийн тэнгэрт +${res.stars} од гэрэлтлээ! ✨`, `Time together is the greatest prize. +${res.stars} stars now shine in your family sky! ✨`)
        : L('Дараагийн удаа гэр бүлтэйгээ хамт тоглоорой. Тэгвэл гэр бүлийн тэнгэрт од нэмэгдэнэ ✨', 'Next time play with your family to add stars to your family sky ✨')),
      g.realLife ? h('div', { class: 'real-life' },
        h('div', { class: 'rl-head' }, '🌍 ', L('Одоо бодит амьдрал дээр', 'Now, in real life')),
        h('p', null, tx(g.realLife)), rlBtn) : null,
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn ghost', onclick: () => TG.go('home') }, '🏠 ', L('Нүүр', 'Home')),
        h('button', { class: 'btn primary', onclick: () => TG.go('play', { g, players: players.filter((x) => !x.bot), together }) }, '↻ ', L('Дахин', 'Again'))));
  };

  function rewardChip(r) {
    return h('button', { class: 'reward-chip', onclick: () => TG.go('village') },
      h('span', null, `🪙 +${r.coins}`), h('span', null, `⭐ +${r.xp} XP`), h('small', null, L('Нутагт ашиглах', 'Spend in the village'), ' →'));
  }
  TG.rewardChip = rewardChip;

  // ---------------- missions ----------------
  function completeMission(m) {
    if (S.missionDoneToday(m.id)) return;
    const r = S.completeMission(m.id); TG.sfx.win(); TG.confetti(50);
    TG.toast(L('Гайхалтай! Гэр бүлийн тэнгэрт +3 од ⭐', 'Wonderful! +3 stars in your family sky ⭐') + (r ? ` · 🪙 +${r.coins}` : ''));
    render();
  }
  SCREENS.missions = () => {
    const ag = currentAge();
    const list = TG.MISSIONS.filter((m) => m.ages.includes(ag));
    return shell([
      h('h1', { class: 'page-title' }, L('Гэр бүлийн даалгавар', 'Family missions')),
      h('p', { class: 'lead' }, L('Дэлгэцээ унтраагаад, хамтдаа хий. Даалгавар бүр гэр бүлийн тэнгэрт +3 од нэмнэ.', 'Turn off the screen and do these together. Each mission adds +3 stars to your family sky.')),
      ageTabs(ag, (a) => { homeAge = a; soft(); }),
      h('div', { class: 'mission-list' }, list.map((m) => {
        const done = S.missionDoneToday(m.id), P = TG.PILLARS[m.pillar];
        return h('div', { class: 'mission-card' + (done ? ' done' : ''), style: { '--gc': P.color } },
          h('div', { class: 'mc-e' }, m.emoji),
          h('div', { class: 'mc-body' }, h('b', null, tx(m.title)), h('p', null, tx(m.desc)), h('span', { class: 'tag' }, P.icon, ' ', tx(P.name))),
          h('button', { class: 'btn ' + (done ? 'done' : 'primary'), disabled: done, onclick: () => completeMission(m) }, done ? '✓' : L('Хийлээ', 'Done')));
      })),
    ]);
  };

  // ---------------- memory book (IndexedDB, audio stays on device) ----------------
  const DB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('no idb'));
        const r = indexedDB.open('togloom', 1); // database name from before the rename, kept so saved recordings are not lost
        r.onupgradeneeded = () => r.result.createObjectStore('memories', { keyPath: 'id' });
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => { const t = db.transaction('memories', mode); const q = fn(t.objectStore('memories')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
    },
    all() { return this.tx('readonly', (s) => s.getAll()).then((r) => (r || []).sort((a, b) => b.ts - a.ts)); },
    put(m) { return this.tx('readwrite', (s) => s.put(m)); },
    del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
  };

  SCREENS.memories = () => {
    const list = h('div', { class: 'memory-list' }, h('p', { class: 'muted' }, '…'));
    DB.all().then((items) => {
      if (!items.length) { list.replaceChildren(h('div', { class: 'empty-memory' }, h('div', { class: 'big-emoji' }, '👵📖👦'), h('p', null, L('Одоохондоо дурсамж алга. Эмээ, өвөөгөөсөө анхны түүхээ асуугаарай!', 'No memories yet. Ask your grandparents for the first story!')))); return; }
      list.replaceChildren(...items.map(memoryCard));
    }).catch(() => list.replaceChildren(h('p', { class: 'err' }, L('Энэ төхөөрөмж дээр дурсамж хадгалах боломжгүй байна.', 'Memories cannot be saved on this device.'))));
    return shell([
      h('section', { class: 'memory-hero' },
        h('h1', { class: 'page-title' }, L('Гэр бүлийн дурсамжийн ном', 'Family memory book')),
        h('p', null, L('Эмээ, өвөөгийн дуу хоолой, үлгэр, амьдралын сургамжийг үүрд хадгал. Үүнийг ямар ч хиймэл оюун орлож чадахгүй.', "Keep your grandparents' voices, stories and life lessons forever. No AI can replace this.")),
        h('button', { class: 'btn primary big', onclick: () => memoryForm() }, '🎙️ ', L('Шинэ дурсамж бичих', 'Record a new memory')),
        h('p', { class: 'privacy' }, '🔒 ', L('Бүх бичлэг зөвхөн энэ төхөөрөмж дээр хадгалагдана.', 'Recordings are stored only on this device.'))),
      list,
    ]);
  };

  function memoryCard(m) {
    const audio = m.audio ? h('audio', { controls: true, src: URL.createObjectURL(m.audio), preload: 'none' }) : null;
    return h('article', { class: 'memory-card' },
      h('div', { class: 'mem-head' }, h('span', { class: 'av big' }, m.whoEmoji || '👵'), h('div', null, h('b', null, m.who), h('small', null, TG.fmtDate(m.ts)))),
      h('blockquote', null, m.prompt),
      m.text ? h('p', { class: 'mem-text' }, m.text) : null,
      audio,
      h('button', { class: 'link-btn danger', onclick: () => {
        const close = TG.modal(h('div', { class: 'center' }, h('h2', null, L('Энэ дурсамжийг устгах уу?', 'Delete this memory?')), h('p', { class: 'muted' }, L('Буцаах боломжгүй.', 'This cannot be undone.')),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => close() }, L('Болих', 'Cancel')),
            h('button', { class: 'btn danger', onclick: () => { close(); DB.del(m.id).then(render); } }, L('Устгах', 'Delete')))));
      } }, L('Устгах', 'Delete')));
  }

  function memoryForm() {
    let pi = Math.floor(Math.random() * TG.STORY_PROMPTS.length), who = S.state.family.find((f) => f.id === 'f3') || S.state.family[0];
    let rec = null, chunks = [], blob = null, stream = null, timer = null, secs = 0;
    const promptEl = h('blockquote', { class: 'prompt-q' });
    const drawPrompt = () => (promptEl.textContent = tx(TG.STORY_PROMPTS[pi]));
    const whoRow = h('div', { class: 'fam-chips' });
    const drawWho = () => whoRow.replaceChildren(...S.state.family.map((f) => h('button', { class: 'fam-chip' + (f === who ? ' active' : ''), onclick: () => { who = f; drawWho(); } }, f.emoji, ' ', famName(f))));
    const text = h('textarea', { class: 'input', rows: 4, placeholder: L('Тэдний хэлсэн үгийг энд бичээрэй…', 'Write down what they said…') });
    const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    const recStatus = h('span', { class: 'rec-status' });
    const preview = h('div');
    const recBtn = h('button', { class: 'btn rec', onclick: () => (rec && rec.state === 'recording' ? stopRec() : startRec()) }, '● ', L('Дуу хоолой бичих', 'Record voice'));
    const stopStream = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; clearInterval(timer); };
    async function startRec() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => { blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); preview.replaceChildren(h('audio', { controls: true, src: URL.createObjectURL(blob) })); stopStream(); recBtn.textContent = '● ' + L('Дахин бичих', 'Record again'); recBtn.classList.remove('on'); recStatus.textContent = '✓'; };
        rec.start(); secs = 0; recBtn.classList.add('on'); recBtn.textContent = '■ ' + L('Зогсоох', 'Stop');
        timer = setInterval(() => { secs++; recStatus.textContent = `🔴 ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`; if (secs >= 300) stopRec(); }, 1000);
      } catch (e) { recStatus.textContent = L('Микрофон ашиглах зөвшөөрөл алга.', 'Microphone permission denied.'); }
    }
    function stopRec() { if (rec && rec.state === 'recording') rec.stop(); }
    const save = async () => {
      if (rec && rec.state === 'recording') { TG.toast(L('Эхлээд бичлэгээ зогсоогоорой.', 'Stop the recording first.')); return; }
      if (!text.value.trim() && !blob) { TG.toast(L('Бичвэр эсвэл дуу хоолой нэмээрэй.', 'Add text or a voice recording.')); return; }
      try {
        await DB.put({ id: 'm' + Date.now(), ts: Date.now(), prompt: tx(TG.STORY_PROMPTS[pi]), who: famName(who), whoEmoji: who.emoji, text: text.value.trim(), audio: blob });
        S.addFamilyStars(5); close(); TG.sfx.win(); TG.confetti(40);
        TG.toast(L('Дурсамж хадгалагдлаа! +5 ⭐', 'Memory saved! +5 ⭐')); render();
      } catch (e) { TG.toast(L('Хадгалж чадсангүй.', 'Could not save.')); }
    };
    drawPrompt(); drawWho();
    const close = TG.modal(h('div', { class: 'form' },
      h('h2', null, '🎙️ ', L('Шинэ дурсамж', 'New memory')),
      h('label', null, L('Асуулт', 'Question')),
      h('div', { class: 'prompt-row' }, promptEl, h('button', { class: 'icon-btn', 'aria-label': 'another question', onclick: () => { pi = (pi + 1) % TG.STORY_PROMPTS.length; drawPrompt(); } }, '🎲')),
      h('label', null, L('Хэн ярьж байна?', 'Who is telling?')), whoRow,
      canRec ? h('div', null, h('label', null, L('Дуу хоолой', 'Voice')), h('div', { class: 'rec-row' }, recBtn, recStatus), preview) : null,
      h('label', null, L('Тэмдэглэл', 'Notes')), text,
      h('button', { class: 'btn primary big block', onclick: save }, L('Хадгалах (+5 ⭐)', 'Save (+5 ⭐)'))), { onClose: () => { stopRec(); stopStream(); } });
  }

  // ---------------- parents dashboard ----------------
  let parentChild = null;
  SCREENS.parents = () => {
    if (Date.now() >= parentUntil) { setTimeout(openParents, 0); return shell([h('p', { class: 'muted' }, '🔒')]); }
    const st = S.state, profiles = st.profiles;
    const child = profiles.find((p) => p.id === parentChild) || S.active();
    const weekAgo = Date.now() - 7 * 864e5;
    const logs = st.log.filter((l) => l.pid === child.id);
    const week = logs.filter((l) => l.ts >= weekAgo);
    const togetherMin = Math.round(week.filter((l) => l.t).reduce((s, l) => s + l.sec, 0) / 60);
    const soloMin = Math.round(week.filter((l) => !l.t).reduce((s, l) => s + l.sec, 0) / 60);
    const pct = togetherMin + soloMin ? Math.round((togetherMin / (togetherMin + soloMin)) * 100) : 0;
    const usedMin = Math.round(S.usageToday() / 60), limit = st.settings.screenLimit;
    const maxStar = Math.max(1, ...Object.values(child.stars));

    const toggle = (key, label) => h('label', { class: 'switch-row' }, h('span', null, label),
      h('input', { type: 'checkbox', class: 'switch', checked: !!st.settings[key], onchange: (e) => { st.settings[key] = e.target.checked; S.save(); render(); } }));
    const limitLabel = h('b', null, `${limit} ${L('мин', 'min')}`);

    const famName2 = h('input', { class: 'input', placeholder: L('Нэр (ж: Нагац эгч)', 'Name (e.g. Auntie)'), maxlength: 16 });
    let famEmoji = TG.FAMILY_EMOJIS[0];
    const emojiRow = h('div', { class: 'emoji-row' });
    const drawEmoji = () => emojiRow.replaceChildren(...TG.FAMILY_EMOJIS.map((e) => h('button', { class: 'av-btn sm' + (e === famEmoji ? ' active' : ''), onclick: () => { famEmoji = e; drawEmoji(); } }, e)));
    drawEmoji();

    return shell([
      h('h1', { class: 'page-title' }, L('Эцэг эхийн самбар', 'Parent dashboard')),
      profiles.length > 1 ? h('div', { class: 'chips' }, profiles.map((p) => h('button', { class: 'chip' + (p.id === child.id ? ' active' : ''), onclick: () => { parentChild = p.id; render(); } }, p.avatar, ' ', p.name))) : null,

      h('section', { class: 'card highlight' },
        h('div', { class: 'ring-stat', style: { '--p': pct } }, h('b', null, pct + '%')),
        h('div', null,
          h('h3', null, L('Энэ 7 хоногийн хамтын цаг', 'Together time this week')),
          h('p', null, L(`Гэр бүлтэйгээ ${togetherMin} мин, ганцаараа ${soloMin} мин тоглосон.`, `${togetherMin} min with family, ${soloMin} min solo.`)),
          h('p', { class: 'muted' }, pct >= 50 ? L('Гайхалтай! Дэлгэц таны гэр бүлийг холбох гүүр болж байна 💛', 'Wonderful! The screen is a bridge that brings your family together 💛')
            : L('Зөвлөгөө: Энэ долоо хоногт 2 тоглоомыг хүүхэдтэйгээ хамт тоглоорой.', 'Tip: play 2 games together with your child this week.')))),

      h('div', { class: 'stat-cards' },
        h('div', { class: 'stat' }, h('small', null, L('Нийт тоглолт', 'Games played')), h('b', null, logs.length)),
        h('div', { class: 'stat' }, h('small', null, L('Өнөөдрийн дэлгэц', 'Screen today')), h('b', null, `${usedMin}/${limit}`), h('small', null, L('мин', 'min'))),
        h('div', { class: 'stat' }, h('small', null, L('Гэр бүлийн од', 'Family stars')), h('b', null, '⭐ ' + st.familyStars))),

      h('section', { class: 'card' },
        h('h3', null, `${child.avatar} ${child.name}: `, L('3 тулгуурын ахиц', 'progress in 3 pillars')),
        Object.entries(TG.PILLARS).map(([k, P]) => h('div', { class: 'bar-row' },
          h('span', { class: 'bar-l' }, P.icon, ' ', tx(P.name)),
          h('div', { class: 'bar' }, h('span', { style: { width: (child.stars[k] / maxStar) * 100 + '%', background: P.color } })),
          h('b', null, child.stars[k] || 0))),
        h('h4', null, L('Сүүлийн тоглолтууд', 'Recent activity')),
        logs.length ? h('ul', { class: 'activity' }, logs.slice(-8).reverse().map((l) => {
          const g = TG.games[l.g];
          return h('li', null, h('span', null, g ? g.icon : '🎮', ' ', g ? tx(g.title) : l.g), h('span', { class: 'stars-sm' }, TG.starsText(l.s)), l.t ? h('span', { class: 'tag fam' }, '🤝') : null, h('small', null, l.d));
        })) : h('p', { class: 'muted' }, L('Одоохондоо тоглоогүй байна.', 'No games yet.'))),

      h('section', { class: 'card' },
        h('h3', null, '⏱️ ', L('Эрүүл дэлгэцийн цаг', 'Healthy screen time')),
        h('p', { class: 'muted' }, L('Хязгаарт хүрэхэд апп гэр бүлийн бодит даалгавар санал болгож, амрахыг сануулна.', 'When the limit is reached, the app suggests a real-life family mission and a break.')),
        h('div', { class: 'range-row' }, h('input', { type: 'range', min: 15, max: 120, step: 15, value: limit, 'aria-label': 'limit',
          oninput: (e) => (limitLabel.textContent = `${e.target.value} ${L('мин', 'min')}`),
          onchange: (e) => { st.settings.screenLimit = +e.target.value; S.save(); render(); } }), limitLabel)),

      h('section', { class: 'card' },
        h('h3', null, '⚙️ ', L('Тохиргоо, хүртээмж', 'Settings & accessibility')),
        toggle('sound', L('🔊 Дуу', '🔊 Sound')),
        TG.music && TG.music.available ? h('label', { class: 'switch-row' }, h('span', null, L('🎵 Арын хөгжим', '🎵 Background music')),
          h('input', { type: 'checkbox', class: 'switch', checked: st.settings.music !== false, onchange: () => { TG.music.toggle(); render(); } })) : null,
        TG.music && TG.music.available ? h('div', { class: 'range-row', style: { padding: '8px 0' } }, h('span', null, L('Хөгжмийн дуу', 'Music volume')),
          h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round((typeof st.settings.musicVolume === 'number' ? st.settings.musicVolume : 0.35) * 100), 'aria-label': 'music volume', oninput: (e) => TG.music.setVolume(e.target.value / 100) })) : null,
        toggle('bigText', L('🔠 Том үсэг', '🔠 Large text')),
        toggle('reduceMotion', L('🐢 Хөдөлгөөн багасгах', '🐢 Reduce motion')),
        h('label', { class: 'switch-row' }, h('span', null, '🌐 ', L('Хэл', 'Language')), h('button', { class: 'btn ghost sm', onclick: toggleLang }, S.state.lang === 'mn' ? 'Монгол → English' : 'English → Монгол'))),

      h('section', { class: 'card' },
        h('h3', null, '👨‍👩‍👧‍👦 ', L('Гэр бүлийн гишүүд', 'Family members')),
        h('div', { class: 'fam-chips' }, st.family.map((f) => h('span', { class: 'fam-chip static' }, f.emoji, ' ', famName(f),
          st.family.length > 1 ? h('button', { class: 'x', 'aria-label': 'remove', onclick: () => { st.family = st.family.filter((x) => x !== f); S.save(); render(); } }, '×') : null))),
        h('div', { class: 'add-fam' }, emojiRow, h('div', { class: 'inline' }, famName2, h('button', { class: 'btn primary', onclick: () => {
          const n = famName2.value.trim(); if (!n) return;
          st.family.push({ id: 'f' + Date.now(), name: n, emoji: famEmoji }); S.save(); render();
        } }, '+')))),

      h('section', { class: 'card' },
        h('h3', null, '🧒 ', L('Хүүхдүүд', 'Children')),
        profiles.map((p) => h('div', { class: 'child-row' }, h('span', null, p.avatar, ' ', h('b', null, p.name), ` · ${p.age} ${L('нас', 'yrs')}`),
          profiles.length > 1 ? h('button', { class: 'link-btn danger', onclick: () => { S.removeProfile(p.id); render(); } }, L('Хасах', 'Remove')) : null)),
        h('button', { class: 'btn ghost block', onclick: addChildModal }, '+ ', L('Хүүхэд нэмэх', 'Add a child'))),

      h('button', { class: 'about-link', onclick: () => TG.go('about') }, h('span', null, L('Бидний зорилго, шударга үнэ', 'Our mission & fair pricing')), TG.icon('chevronRight')),
      h('button', { class: 'link-btn danger center-block', onclick: () => {
        const close = TG.modal(h('div', { class: 'center' }, h('h2', null, L('Бүх өгөгдлийг устгах уу?', 'Erase all data?')), h('p', { class: 'muted' }, L('Профайл, од, тохиргоо устна.', 'Profiles, stars and settings will be erased.')),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => close() }, L('Болих', 'Cancel')),
            h('button', { class: 'btn danger', onclick: () => { localStorage.removeItem(S.KEY); localStorage.removeItem('togloom.v1'); location.reload(); } }, L('Устгах', 'Erase')))));
      } }, L('Бүх өгөгдлийг устгах', 'Erase all data')),
    ]);
  };

  // ---------------- about / pitch ----------------
  SCREENS.about = () => {
    const back = S.state.profiles.length ? () => TG.go('home') : () => TG.go('onboard');
    const P = (icon, color, title, items) => h('div', { class: 'pillar-card', style: { '--c': color } }, h('div', { class: 'pc-icon' }, icon), h('h3', null, title), h('ul', null, items.map((i) => h('li', null, i))));
    const price = (name, amount, per, items, cls, note) => h('div', { class: 'price-card ' + (cls || '') }, h('h3', null, name), h('div', { class: 'amount' }, amount, h('small', null, per)), h('ul', null, items.map((i) => h('li', null, '✓ ', i))), note ? h('p', { class: 'pnote' }, note) : null);
    return h('div', { class: 'about' },
      h('button', { class: 'icon-btn back-fixed', onclick: back, 'aria-label': 'back' }, TG.icon('arrowLeft')),
      h('header', { class: 'about-hero' },
        h('div', { class: 'badge-pill light' }, 'Pinequest · Fine-Tune for the Future'),
        h('h1', null, 'Naadamy'),
        h('p', { class: 'big-quote' }, L('“Дэлгэц бол гүүр. Зорилго нь гэр бүл.”', '“The screen is a bridge. The destination is family.”')),
        h('p', null, L('Эрүүл мэнд, боловсрол, ур чадварт хүүхэд бүр тэгш хүртээмжтэй байх ёстой. Хамгийн сайн багш нь хайртай хүмүүс нь гэдэгт бид итгэдэг.', 'Every child deserves equal access to health, education and skills. We believe the best teachers are the people who love them.'))),

      h('section', null,
        h('h2', null, L('Асуудал', 'The problem')),
        h('div', { class: 'problem-grid' },
          h('div', null, '📱', h('b', null, L('Ганцаардмал дэлгэц', 'Lonely screens')), h('p', null, L('Хүүхдүүд дэлгэцийн өмнө ганцаараа өнгөрүүлэх цаг ихэсч, гэр бүлийн харилцаа багасч байна.', 'Children spend more time alone on screens and less time talking with family.'))),
          h('div', null, '🏔️', h('b', null, L('Тэгш бус хүртээмж', 'Unequal access')), h('p', null, L('Хөдөө орон нутагт интернэт сул, чанартай монгол хэл дээрх сургалтын хэрэглэгдэхүүн ховор.', 'Rural areas have weak internet and few quality learning tools in Mongolian.'))),
          h('div', null, '💸', h('b', null, L('Үнэтэй, гадаад', 'Expensive, foreign')), h('p', null, L('Ихэнх суралцах апп үнэтэй, гадаад хэл дээр, монгол соёлгүй.', 'Most learning apps are costly, in foreign languages, and lack Mongolian culture.'))))),

      h('section', null,
        h('h2', null, L('Шийдэл: 3 тулгуур', 'Our solution: 3 pillars')),
        h('div', { class: 'pillar-grid' },
          P('💚', '#12B76A', L('Эрүүл мэнд', 'Health'), [L('Эрүүл зуршил, анхны тусламж (хөлдөлт, утааны хордлого)', 'Healthy habits, first aid (frostbite, stove smoke)'), L('Сэтгэлийн эрүүл мэнд, тайван амьсгал', 'Mental health and calm breathing'), L('Эрүүл дэлгэцийн цагийн хамгаалагч', 'Built-in healthy screen-time guardian')]),
          P('📘', '#2F6BFF', L('Боловсрол', 'Education'), [L('Цагаан толгой, тоо, санах ой', 'Alphabet, numbers, memory'), L('Монгол нутаг, түүх, соёл', 'Mongolian geography, history, culture'), L('Шагай зэрэг уламжлалт тоглоом', 'Traditional games like shagai')]),
          P('🛠️', '#F08A24', L('Ур чадвар', 'Skills'), [L('Програмчлалын анхан шат', 'First steps in programming'), L('Санхүүгийн боловсрол, төсөв', 'Financial literacy and budgeting'), L('Дижитал аюулгүй байдал', 'Digital safety')]))),

      h('section', { class: 'why-human' },
        h('h2', null, L('Яагаад хиймэл оюун үүнийг орлож чадахгүй вэ?', "Why AI can't replace this")),
        h('div', { class: 'human-grid' },
          h('div', null, h('span', null, '👨‍👩‍👧'), h('b', null, L('Нэг утас, олон зүрх', 'One phone, many hearts')), h('p', null, L('Тоглоом бүр 2–4 хүн нэг төхөөрөмж дээр хамт тоглохоор бүтээгдсэн. Тооны тулаанд хоёр тал нүүр тулж тоглоно.', 'Every game is built for 2–4 people on one device. In Math Duel, players sit face to face.'))),
          h('div', null, h('span', null, '🌍'), h('b', null, L('Тоглоом дэлгэцээс гадна дуусна', 'Every game ends off-screen')), h('p', null, L('Тоглолт бүрийн төгсгөлд гэр бүлээрээ бодит амьдрал дээр хийх даалгавар өгнө.', 'Each game ends with a real-life challenge to do together.'))),
          h('div', null, h('span', null, '🎙️'), h('b', null, L('Эмээгийн дуу хоолой', "Grandma's voice")), h('p', null, L('Дурсамжийн номонд өвөө, эмээгийн түүх, дууг бичиж үеийн үед хадгална.', 'The memory book records grandparents\' stories and songs for generations.'))),
          h('div', null, h('span', null, '🗣️'), h('b', null, L('"Гэр бүлээсээ асуу"', '"Ask your family"')), h('p', null, L('Асуултын тусламж зөвхөн жинхэнэ хүнтэй ярилцсаны дараа нээгдэнэ.', 'Quiz help unlocks only after talking with a real person.'))))),

      h('section', null,
        h('h2', null, L('Хүн бүрт тэгш хүртээмж', 'Equal access for everyone')),
        h('div', { class: 'access-grid' }, [
          ['📶', L('Офлайн ажиллана: нэг ачаалсны дараа интернэтгүй тоглоно', 'Works offline: after the first load, no internet needed')],
          ['📱', L('Хуучин, хямд утсан дээр ажиллана. Хэмжээ нь маш бага', 'Runs on old, low-cost phones. Tiny download')],
          ['🇲🇳', L('Монгол хэл, монгол соёл дээр суурилсан', 'Built on Mongolian language and culture')],
          ['🚫', L('Зар сурталчилгаагүй, өгөгдөл худалдахгүй', 'No ads, no selling data')],
          ['🔒', L('Бүх мэдээлэл зөвхөн таны төхөөрөмж дээр', 'All data stays on your device')],
          ['🔠', L('Том үсэг, хөдөлгөөн багасгах, эможи тулгуурласан дизайн', 'Large text, reduced motion, emoji-first design')],
        ].map(([i, t]) => h('div', { class: 'access-item' }, h('span', null, i), t)))),

      h('section', null,
        h('h2', null, L('Шударга үнэ', 'Fair pricing')),
        h('div', { class: 'price-grid' },
          price(L('Үнэгүй', 'Free'), '0₮', L(' / үүрд', ' / forever'), [L('Бүх үндсэн тоглоом', 'All core games'), L('Офлайн горим', 'Offline mode'), L('Гэр бүлийн даалгавар', 'Family missions'), L('Дурсамжийн ном', 'Memory book')]),
          price(L('Гэр бүл', 'Family'), '3,900₮', L(' / сар', ' / month'), [L('Сар бүр шинэ тоглоом', 'New games every month'), L('Хэвлэх даалгаврын карт', 'Printable mission cards'), L('Дурсамжийн номоо хэвлэх', 'Print your memory book'), L('Дэлгэрэнгүй ахицын тайлан', 'Detailed progress reports')], 'featured',
            L('💛 Нэг гэр бүлийн төлбөр = хөдөөгийн нэг хүүхдэд үнэгүй эрх', '💛 One family plan = free access for one rural child')),
          price(L('Сургууль, сум', 'Schools & soums'), '0₮', L(' / үнэгүй', ' / free'), [L('Төрийн сургууль, цэцэрлэг', 'Public schools & kindergartens'), L('Сумын номын сан', 'Soum libraries'), L('Багшийн хяналтын самбар', 'Teacher dashboard')])),
        h('p', { class: 'center muted' }, L('Орлого багатай өрхөд Гэр бүл багцыг хүсэлтээр үнэгүй олгоно.', 'Low-income families can get the Family plan free on request.'))),

      h('section', null,
        h('h2', null, L('Цаашдын төлөвлөгөө', 'Roadmap')),
        h('ol', { class: 'roadmap' },
          h('li', null, h('b', null, L('Одоо', 'Now')), L('Прототип: 15 тоглоом, 48 түвшний "Цэгцлэе!" оньсого, олон тоглогчтой "Нутаг" тосгон, офлайн PWA', 'Prototype: 15 games, 48 puzzle levels, the multiplayer "Village", offline PWA')),
          h('li', null, h('b', null, L('Дараа', 'Next')), L('Жинхэнэ багш, өвөө эмээгийн бичсэн монгол дуу хоолой; Монгол бичгийн модуль', 'Mongolian voice-over by real teachers and grandparents; traditional Mongol script module')),
          h('li', null, h('b', null, L('Удахгүй', 'Soon')), L('Казах хэл (Баян-Өлгий), дохионы хэл, хоёр утсаар холбогдон тоглох', 'Kazakh language (Bayan-Ölgii), sign language, two-phone local play')),
          h('li', null, h('b', null, L('Ирээдүй', 'Future')), L('Сургууль, сумтай хамтран ажиллах, QPay төлбөр', 'School and soum partnerships, QPay payments')))),

      TG.music && TG.music.credits().length ? h('section', null,
        h('h2', null, L('Хөгжмийн зохиогчид', 'Music credits')),
        h('p', { class: 'center muted' }, L('Арын хөгжим бүгд CC0 (нийтийн өмч) лицензтэй, OpenGameArt.org-оос. Зохиогчдод баярлалаа!', 'All background music is CC0 (public domain) from OpenGameArt.org. Thank you to the composers!')),
        h('ul', { class: 'credits' }, TG.music.credits().map((c) => h('li', null, h('b', null, c.title), ' — ', c.artist, ' · ', c.license, c.source ? [' · ', h('a', { href: c.source, target: '_blank', rel: 'noopener' }, 'OpenGameArt')] : null)))) : null,
      h('footer', { class: 'about-foot' }, L('Монгол хүүхэд бүрт ❤️ · Pinecone Academy · Pinequest', 'For every Mongolian child ❤️ · Pinecone Academy · Pinequest'),
        h('div', null, h('button', { class: 'btn primary', onclick: back }, L('Тоглож эхлэх ▶', 'Start playing ▶')))));
  };

  // ---------------- healthy screen-time guardian ----------------
  let lastNudge = 0;
  function showTimeout() {
    if (document.querySelector('.timeout-back')) return;
    const ag = currentAge(), m = TG.dailyMission(ag);
    const el = h('div', { class: 'timeout-back' }, h('div', { class: 'timeout' },
      h('div', { class: 'big-emoji' }, '🌞'),
      h('h2', null, L('Дэлгэцээ амраах цаг боллоо!', 'Time for a screen break!')),
      h('p', null, L(`Өнөөдөр ${Math.round(S.usageToday() / 60)} минут тогллоо. Одоо нүдээ амрааж, гэр бүлтэйгээ бодит амьдрал дээр хамт юм хийцгээе.`, `You played ${Math.round(S.usageToday() / 60)} minutes today. Rest your eyes and do something real with your family.`)),
      h('div', { class: 'daily' }, h('div', { class: 'daily-e' }, m.emoji), h('div', { class: 'daily-body' }, h('b', null, tx(m.title)), h('p', null, tx(m.desc)))),
      h('button', { class: 'btn ghost block', onclick: () => TG.parentGate(() => {
        S.state.extend = { d: S.dkey(), sec: S.extraToday() + 15 * 60 }; S.save(); el.remove(); TG.toast(L('+15 минут нэмэгдлээ', '+15 minutes added'));
      }) }, '🔒 ', L('Том хүн: +15 минут', 'Grown-up: +15 minutes'))));
    document.body.appendChild(el);
  }
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !S.state.profiles.length || document.querySelector('.timeout-back')) return;
    S.tick(5);
    const used = S.usageToday();
    if (used >= S.state.settings.screenLimit * 60 + S.extraToday()) return showTimeout();
    if (used - lastNudge >= 20 * 60 && used > 60) {
      lastNudge = used;
      TG.toast(L('👀 20 минут боллоо. 20 секунд цонхоор хол харж нүдээ амраагаарай!', '👀 20 minutes! Look out the window for 20 seconds to rest your eyes.'));
    }
  }, 5000);
  lastNudge = S.usageToday();

  // ---------------- boot ----------------
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // When a new version takes over, reload once so the player sees it right away.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {}));
  }
  render();
  // a shared invite link (…?room=CODE) opens the village directly once a child profile exists
  if (new URLSearchParams(location.search).get('room') && S.state.profiles.length) TG.go('village');
})(window.TG);
