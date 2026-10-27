/* Naadamy — Mongolian heritage, learned together. Screens: login/register -> Нутаг (home) -> heritage school, Basar, family. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store;
  const SCREENS = {};
  let cleanup = null, screen = 'village', params = {}, parentUntil = 0;

  // ---------------- navigation ----------------
  const NAV_ORDER = ['village', 'learn', 'bichig', 'passport', 'aimag', 'achievements', 'family', 'memories'];
  const calm = () => S.state.settings.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function transition(kind, update) {
    document.documentElement.dataset.vt = kind;
    if (calm()) return update();
    if (document.startViewTransition) {
      try {
        const vt = document.startViewTransition(update);
        // Tapping two screens quickly skips the older transition, and its ready/finished
        // promises then reject with an AbortError. Nobody waits for them, so swallow the
        // rejection: otherwise it shows up as an unhandled error in the console.
        if (vt && vt.ready) vt.ready.catch(() => {});
        if (vt && vt.finished) vt.finished.catch(() => {});
        return;
      } catch (e) { /* fall through */ }
    }
    update();
    const el = document.getElementById('app').firstElementChild;
    if (el) { el.classList.remove('screen-in'); void el.offsetWidth; el.classList.add('screen-in'); }
  }
  TG.go = function (name, p = {}) {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    if (name === 'home') name = 'village';
    const a = NAV_ORDER.indexOf(screen), b = NAV_ORDER.indexOf(name);
    screen = name; params = p;
    transition(a >= 0 && b >= 0 && a !== b ? (b > a ? 'left' : 'right') : 'up', () => { render(); window.scrollTo(0, 0); });
  };
  const setCleanup = (fn) => { cleanup = fn; };
  const loggedIn = () => S.state.profiles.length && S.state.loggedIn && S.active();
  function render() {
    const root = document.documentElement, st = S.state.settings;
    root.classList.toggle('big', !!st.bigText);
    root.classList.toggle('rm', !!st.reduceMotion);
    root.lang = S.state.lang;
    if (!loggedIn() && !['auth', 'about'].includes(screen)) screen = 'auth';
    const app = document.getElementById('app');
    app.replaceChildren((SCREENS[screen] || SCREENS.village)(params));
  }
  const famName = (f) => tx(f.name);
  function toggleLang() { S.state.lang = S.state.lang === 'mn' ? 'en' : 'mn'; S.save(); render(); }

  // ---------------- shared pieces ----------------
  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#2F6BFF"/><circle cx="48" cy="15" r="5" fill="#FDB022"/><path d="M12 44 V34 Q32 16 52 34 V44 Z" fill="#fff"/><path d="M16 33 Q32 19 48 33" stroke="#F04438" stroke-width="3" fill="none"/><rect x="27.5" y="35" width="9" height="9" rx="1.5" fill="#F04438"/><rect x="10" y="44" width="44" height="4" rx="2" fill="#FDB022"/></svg>';
  function topbar() {
    const p = S.active();
    return h('header', { class: 'topbar' },
      h('button', { class: 'brand', onclick: () => TG.go('village'), 'aria-label': 'Нутаг' }, h('span', { class: 'logo', html: LOGO }), h('span', null, 'Naadamy')),
      h('div', { class: 'top-actions' },
        h('button', { class: 'lang-btn', onclick: toggleLang, 'aria-label': 'language' }, TG.icon('globe'), S.state.lang === 'mn' ? 'EN' : 'МН'),
        p && h('button', { class: 'profile-chip', onclick: () => TG.openMenu() }, h('span', { class: 'av' }, p.avatar), h('span', { class: 'pn' }, p.name))));
  }
  const NAV = [['village', 'sprout', 'Нутаг', 'Nutag'], ['learn', 'book', 'Сурах', 'Learn'], ['basar', 'heart', 'Басар', 'Basar'], ['achievements', 'sparkles', 'Амжилт', 'Badges'], ['family', 'users', 'Гэр бүл', 'Family']];
  function bottomNav() {
    return h('nav', { class: 'bottom-nav' }, NAV.map(([id, icon, mn, en]) => h('button', {
      class: 'nav-btn' + (screen === id || (id === 'learn' && (screen === 'lesson' || screen === 'bichig')) ? ' active' : ''),
      onclick: () => (id === 'family' ? openFamily() : id === 'basar' ? TG.basar.open() : TG.go(id)),
    }, id === 'basar' ? TG.basar.face(0, 26) : TG.icon(icon, 'ni'), h('span', null, L(mn, en)))));
  }
  function openFamily() {
    if (Date.now() < parentUntil) return TG.go('family');
    TG.parentGate(() => { parentUntil = Date.now() + 10 * 60 * 1000; TG.go('family'); });
  }
  const shell = (children) => h('div', { class: 'shell' }, topbar(), h('main', { class: 'page' }, children), bottomNav());

  /** Main menu (the village profile card and the profile chip). */
  TG.openMenu = () => {
    const p = S.active(); if (!p) return;
    const m = TG.MASCOTS.find((x) => x.e === p.avatar);
    const item = (icon, label, fn) => h('button', { class: 'menu-item', onclick: () => { close(); fn(); } }, h('span', { class: 'mi-i' }, icon), h('span', null, label), TG.icon('chevronRight'));
    const close = TG.modal(h('div', null,
      h('div', { class: 'menu-me' }, h('span', { class: 'av big' }, p.avatar), h('div', null, h('b', null, p.name), h('small', null, `${p.age} ${L('настай', 'years old')}${TG.ethnic.byId(p.eth) ? ' · ' + tx(TG.ethnic.byId(p.eth).name) : m ? ' · ' + tx(m.name) : ''}${TG.aimags.byId(p.aimag) ? ' · 📍 ' + tx(TG.aimags.byId(p.aimag).name) : ''}`))),
      h('div', { class: 'menu-list' },
        TG._village && TG._village.live() && item('👕', L('Хувцас', 'Wardrobe'), () => TG._village.wardrobe()),
        item('⛺', L('Нутаг', 'Nutag'), () => TG.go('village')),
        item('📚', L('Өв соёлын сургууль', 'Heritage school'), () => TG.go('learn')),
        item('✍️', L('Монгол бичгийн академи', 'Mongol script academy'), () => TG.go('bichig')),
        item('🐕', L('Басартай ярилцах', 'Talk with Basar'), () => TG.basar.open()),
        item('🏅', L('Миний амжилтууд', 'My achievements'), () => TG.go('achievements')),
        item('🛂', L('Аймгийн паспорт', 'Aimag passport'), () => TG.go('passport')),
        item('🎨', L('Дүрээ өөрчлөх', 'Change my character'), () => TG.go('create')),
        item('🍃', L('Улирлын тухай', 'About the season'), () => TG.seasons.open()),
        item('🎙️', L('Гэр бүлийн дурсамж', 'Family memory book'), () => TG.go('memories')),
        item('👨‍👩‍👧', L('Эцэг эхийн самбар', 'Parent dashboard'), openFamily),
        item('🌐', S.state.lang === 'mn' ? 'English' : 'Монгол хэл', toggleLang),
        item('ℹ️', L('Төслийн тухай', 'About the project'), () => TG.go('about'))),
      h('button', { class: 'btn ghost block', onclick: () => { close(); S.state.loggedIn = false; S.save(); TG.go('auth', { tab: 'login' }); } }, '🚪 ', L('Гарах / Профайл солих', 'Log out / switch profile'))), { cls: 'v-modal' });
  };

  // ---------------- login & register ----------------
  /** Animated steppe behind the login screen: gers, galloping foals, sheep and Basar running along. */
  function authScene() {
    const c = h('canvas', { class: 'auth-bg', width: 160, height: 90, 'aria-hidden': 'true' });
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const PX = TG.pixel, t0 = performance.now();
    const g1 = PX.gerSprite('#3f76db', '#e14b3d'), g2 = PX.gerSprite('#e14b3d', '#e9a91f');
    const loop = () => {
      if (!c.isConnected) return;
      const t = (performance.now() - t0) / 1000;
      x.save(); x.scale(160 / 120, 90 / 80); TG.scenes.bg(x, t); x.restore();
      x.drawImage(g1, 0, 0, 48, 50, 18, 50, 26, 27); x.drawImage(g2, 0, 0, 48, 50, 112, 54, 22, 23);
      [[60, 74], [76, 78], [92, 72]].forEach(([sx, sy], i) => x.drawImage(PX.animal('sheep', Math.floor(t * 2 + i) % 2), sx, sy));
      const run = (t * 22) % 220 - 30, f = 1 + Math.floor(t * 8) % 2;
      x.drawImage(PX.animal('foal', f), run, 64); x.drawImage(PX.animal('foal', 3 - f), run - 18, 67);
      x.drawImage(PX.bankhar(f), run - 42, 66);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return c;
  }

  function picPad(onPick, len = 3) {
    const sel = [], dotsEl = h('div', { class: 'pic-dots' });
    const drawDots = () => dotsEl.replaceChildren(...Array.from({ length: len }, (_, k) => h('i', { class: k < sel.length ? 'on' : '' }, sel[k] || '')));
    drawDots();
    const pad = h('div', { class: 'pic-pad' }, TG.PIC_KEYS.map((k) => h('button', { class: 'pic-key', onclick: () => {
      if (sel.length >= len) return; sel.push(k); TG.sfx.tap(); drawDots();
      if (sel.length === len) setTimeout(() => { onPick(sel.join(''), () => { sel.length = 0; drawDots(); }); }, 150);
    } }, k)));
    return h('div', null, dotsEl, pad);
  }

  SCREENS.auth = () => {
    const tab = params.tab || (S.state.profiles.length ? 'login' : 'register');
    const card = h('div', { class: 'auth-card px-card' });
    const tabs = h('div', { class: 'auth-tabs' },
      h('button', { class: tab === 'login' ? 'on' : '', disabled: !S.state.profiles.length, onclick: () => TG.go('auth', { tab: 'login' }) }, L('Нэвтрэх', 'Log in')),
      h('button', { class: tab === 'register' ? 'on' : '', onclick: () => TG.go('auth', { tab: 'register' }) }, L('Бүртгүүлэх', 'Register')));
    const enter = (p) => {
      S.state.activeId = p.id; S.state.loggedIn = true; S.save();
      TG.sfx.win();
      if (!p.eth) return TG.go('create'); // new: build your character (ethnic group, home province, outfit) first
      TG.toast(L(`Тавтай морил, ${p.name}! 🐕`, `Welcome, ${p.name}! 🐕`)); TG.go('village');
    };

    function login() {
      const list = h('div', { class: 'auth-profiles' }, S.state.profiles.map((p) => h('button', { class: 'auth-prof', onclick: () => {
        if (!p.code) return enter(p);
        card.replaceChildren(h('h2', null, `${p.avatar} ${p.name}`), h('p', { class: 'muted' }, L('Нууц 3 зургаа дарааллаар нь дар', 'Tap your 3 secret pictures in order')),
          picPad((code, reset) => { if (code === p.code) enter(p); else { TG.sfx.bad(); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); reset(); } }),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost sm', onclick: () => TG.go('auth', { tab: 'login' }) }, L('Буцах', 'Back')),
            h('button', { class: 'btn ghost sm', onclick: () => TG.parentGate(() => { p.code = null; S.save(); enter(p); }) }, L('Мартсан? (том хүн)', 'Forgot? (grown-up)'))));
      } }, h('span', { class: 'av big' }, p.avatar), h('b', null, p.name), h('small', null, `${p.age} ${L('нас', 'yrs')}${p.code ? ' · 🔒' : ''}`))));
      card.replaceChildren(h('h2', null, L('Хэн тоглох вэ?', 'Who’s playing?')), list);
    }

    function register() {
      const d = { name: '', age: 8, avatar: TG.MASCOTS[0].e, code: null, aimag: null };
      let step = 0;
      const draw = () => {
        const prog = h('div', { class: 'auth-prog' }, [0, 1, 2, 3].map((k) => h('i', { class: k <= step ? 'on' : '' })));
        const basar = (txt) => h('div', { class: 'auth-basar' }, TG.basar.face(1, 44), h('p', null, txt));
        if (step === 0) {
          const name = h('input', { class: 'input big-input', value: d.name, maxlength: 20, placeholder: L('Нэрээ бич…', 'Type your name…'), 'aria-label': L('Нэр', 'Name'), onkeydown: (e) => { if (e.key === 'Enter') go(); } });
          const err = h('div', { class: 'err' });
          const go = () => { const n = name.value.trim(); if (!n) { err.textContent = L('Нэрээ бичээрэй 🙂', 'Please write your name 🙂'); name.focus(); return; } d.name = n; step = 1; draw(); };
          card.replaceChildren(prog, basar(L('Вуф! Би Басар. Чиний нэрийг хэн гэдэг вэ?', 'Woof! I’m Basar. What’s your name?')), name, err, h('button', { class: 'btn primary big block', onclick: go }, L('Цааш →', 'Next →')));
          setTimeout(() => name.focus(), 200);
        } else if (step === 1) {
          const pickAge = (a) => { d.age = a; TG.sfx.tap(); draw(); };
          const grid = h('div', { class: 'age-grid' }, Array.from({ length: 16 }, (_, k) => k + 3).map((a) => h('button', { class: 'age-btn' + (a === d.age ? ' active' : ''), onclick: () => pickAge(a) }, a)));
          const grown = h('div', { class: 'age-grid age-grown' }, [20, 25, 30, 40, 50, 60, 70, 80].map((a) => h('button', { class: 'age-btn' + (a === d.age ? ' active' : ''), onclick: () => pickAge(a) }, a)));
          const other = h('input', { class: 'input age-other', type: 'number', inputmode: 'numeric', min: 1, step: 1, placeholder: L('Өөр нас', 'Other age'), 'aria-label': L('Өөр нас', 'Other age'), value: d.age > 18 && ![20, 25, 30, 40, 50, 60, 70, 80].includes(d.age) ? d.age : '',
            oninput: (e) => { const n = Math.floor(Number(e.target.value)); if (n >= 1) { d.age = n; grid.querySelectorAll('.active').forEach((b) => b.classList.remove('active')); grown.querySelectorAll('.active').forEach((b) => b.classList.remove('active')); } } });
          card.replaceChildren(prog, basar(L(`Сайн уу, ${d.name}! Хэдэн настай вэ? Том хүмүүс ч тоглож болно!`, `Hi ${d.name}! How old are you? Grown-ups can play too!`)), grid,
            h('div', { class: 'age-label' }, L('Том хүн', 'Grown-ups')), grown, other,
            h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => { step = 0; draw(); } }, '←'), h('button', { class: 'btn primary', onclick: () => { step = 2; draw(); } }, L('Цааш →', 'Next →'))));
        } else if (step === 2) {
          const m = TG.MASCOTS.find((x) => x.e === d.avatar);
          const grid = h('div', { class: 'mascot-grid' }, TG.MASCOTS.map((x) => h('button', { class: 'mascot' + (x.e === d.avatar ? ' active' : ''), onclick: () => { d.avatar = x.e; TG.sfx.pop && TG.sfx.pop(); draw(); } }, h('span', { class: 'm-e' }, x.e), h('small', null, tx(x.name)))));
          card.replaceChildren(prog, basar(L('Өөрийн сахиус амьтнаа сонго! ', 'Pick your mascot animal! ') + tx(m.fact)), grid,
            h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => { step = 1; draw(); } }, '←'), h('button', { class: 'btn primary', onclick: () => { step = 3; draw(); } }, L('Цааш →', 'Next →'))));
        } else {
          const finish = () => enter(S.addProfile(d));
          card.replaceChildren(prog, basar(L('Сүүлийнх нь: 3 нууц зураг сонгоод профайлаа хамгаал. Дараалал нь чухал шүү!', 'Last one: choose 3 secret pictures to protect your profile. The order matters!')),
            picPad((code) => { d.code = code; finish(); }),
            h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => { step = 2; draw(); } }, '←'), h('button', { class: 'btn ghost', onclick: finish }, L('Алгасах', 'Skip'))));
        }
      };
      draw();
    }
    tab === 'login' && S.state.profiles.length ? login() : register();
    return h('div', { class: 'auth' }, authScene(),
      h('button', { class: 'lang-btn corner', onclick: toggleLang }, S.state.lang === 'mn' ? 'EN' : 'МН'),
      h('div', { class: 'auth-wrap' },
        h('div', { class: 'auth-brand' }, h('div', { class: 'ob-logo', html: LOGO }), h('h1', null, 'Naadamy'),
          h('p', null, L('Монгол өв соёлоо гэр бүл, найзуудтайгаа хамт сурцгаая', 'Learn Mongolian heritage together with family and friends'))),
        tabs, card,
        h('button', { class: 'link-btn auth-about', onclick: () => TG.go('about') }, L('Төслийн тухай', 'About the project'))));
  };

  // ---------------- Нутаг (home), heritage school ----------------
  SCREENS.village = () => TG.villageScreen({ setCleanup });
  SCREENS.learn = () => TG.learn.hub({ shell });
  SCREENS.lesson = (p) => TG.learn.lesson({ ...p, shell, setCleanup });
  SCREENS.passport = () => TG.passport.screen({ shell });
  SCREENS.bichig = () => TG.bichig.screen({ shell });
  SCREENS.aimag = (p) => TG.passport.visit({ ...p, shell });
  SCREENS.create = () => TG.ethnic.screen({ onDone: () => { TG.toast(L('Нутагт тавтай морил! 🐕', 'Welcome to Nutag! 🐕')); TG.go('village'); } });

  // ---------------- achievements ----------------
  const fmtDay = (ts) => TG.fmtDate ? TG.fmtDate(ts) : new Date(ts).toLocaleDateString();
  function badgeGrid(p, opts = {}) {
    const AC = TG.achievements, got = p.ach || {};
    return Object.entries(AC.CATS).map(([cat, name]) => {
      const list = AC.LIST.filter((a) => a.cat === cat);
      return h('section', { class: 'ach-cat' }, h('h3', null, tx(name), h('small', null, ` ${list.filter((a) => got[a.id]).length}/${list.length}`)),
        h('div', { class: 'ach-grid' }, list.map((a) => {
          const on = !!got[a.id], pr = !on && AC.progress(a, p);
          return h('div', { class: 'ach' + (on ? ' on' : ''), title: tx(a.desc) },
            h('span', { class: 'ach-i' }, AC.badge(a)), h('b', null, tx(a.name)), h('small', null, tx(a.desc)),
            on ? h('small', { class: 'ach-date' }, '✓ ', fmtDay(got[a.id])) : pr ? h('div', { class: 'meter' }, h('span', { style: { width: Math.min(100, (pr[0] / pr[1]) * 100) + '%' } })) : null);
        })));
    });
  }
  SCREENS.achievements = () => {
    const p = S.active(); TG.achievements.check(true);
    const n = Object.keys(p.ach || {}).length, total = TG.achievements.LIST.length;
    return shell([
      h('section', { class: 'l-hero px-card' }, h('div', { class: 'ach-big' }, '🏅'),
        h('div', null, h('div', { class: 'eyebrow' }, L('Миний амжилтууд', 'My achievements')), h('h1', null, `${n} / ${total}`),
          h('p', null, L('Сурч, гэр бүлтэйгээ хамт хийж, Нутагт тоглож амжилт цуглуулаарай. Ээж, аав чинь ч харж байгаа шүү!', 'Learn, do things with your family and play in Nutag to collect badges. Your parents can see them too!')))),
      h('div', { class: 'ach-wrap' }, badgeGrid(p)),
    ]);
  };
  /** Parent view: what the child earned and learned. */
  function learnedReport(child) {
    const learn = child.learn || {}, bs = child.basar || {}, topics = bs.topics || {};
    const done = TG.learn.LESSONS.filter((l) => learn[l.id] && learn[l.id].done);
    const did = TG.vrules.handsOn(child.village), hand = TG.vrules.HANDS_ON.filter((a) => did.includes(a.id)); // done by hand in Нутаг
    const got = Object.entries(child.ach || {}).sort((a, b) => b[1] - a[1]);
    const logs = S.state.log.filter((x) => x.pid === child.id && x.k).slice(-12).reverse();
    const withTxt = (w) => !w ? '' : [w.family ? L(`гэр бүлтэйгээ ${w.family}`, `with family ${w.family}×`) : '', w.friends ? L(`найзуудтайгаа ${w.friends}`, `with friends ${w.friends}×`) : '', w.solo ? L(`ганцаараа ${w.solo}`, `alone ${w.solo}×`) : ''].filter(Boolean).join(', ');
    const logLine = (x) => {
      if (x.k === 'lesson') { const l = TG.learn.byId(x.id); return ['📚', L(`“${l ? tx(l.title) : x.id}” хичээлийг дуусгасан`, `Finished “${l ? tx(l.title) : x.id}”`)]; }
      if (x.k === 'hand') { const a = TG.vrules.HANDS_ON.find((q) => q.id === x.id); return [a ? a.icon : '✋', a ? tx(a.name) : x.id]; }
      if (x.k === 'ach') { const a = TG.achievements.byId(x.id); return ['🏅', L('Амжилт: ', 'Badge: ') + (a ? tx(a.name) : x.id)]; }
      if (x.k === 'race') return ['🐎', L(`Морин уралдаанд ${x.id}-р байр`, `Horse race: place ${x.id}`)];
      if (x.k === 'together') { const [what, mode, who] = x.id.split('|'); const l = TG.learn.byId(what); return [mode === 'family' ? '👨‍👩‍👧' : '🤝', `${l ? tx(l.title) : L('Асуулт хариулт', 'Quiz')} · ${who}`]; }
      return ['•', x.k];
    };
    return h('section', { class: 'card' },
      h('h3', null, '🏅 ', L('Амжилт ба сурсан зүйлс', 'Achievements & what they learned')),
      h('p', { class: 'muted' }, L(`${child.name} ${got.length}/${TG.achievements.LIST.length} амжилт авсан.`, `${child.name} has ${got.length}/${TG.achievements.LIST.length} badges.`)),
      got.length ? h('div', { class: 'ach-earned' }, got.map(([id, ts]) => { const a = TG.achievements.byId(id); return a ? h('span', { class: 'ach-chip', title: tx(a.desc) }, TG.achievements.badge(a, 'chip'), ' ', tx(a.name), h('small', null, fmtDay(ts))) : null; })) : h('p', { class: 'muted' }, L('Одоохондоо амжилт алга.', 'No badges yet.')),
      h('h4', null, L('Сурсан зүйлс', 'What they learned')),
      done.length || hand.length ? [done.map((l) => h('div', { class: 'learned' }, h('b', null, l.icon, ' ', tx(l.title)), withTxt(learn[l.id].with) ? h('small', null, ' · ', withTxt(learn[l.id].with)) : null,
        h('ul', null, (l.learned || []).map((t) => h('li', null, tx(t)))))),
        hand.map((a) => h('div', { class: 'learned', 'data-hand': a.id }, h('b', null, a.icon, ' ', tx(a.name)), h('small', null, ' · ', L('Нутагт гараараа', 'by hand in Нутаг')),
          h('ul', null, a.learned.map((t) => h('li', null, tx(t))))))] : h('p', { class: 'muted' }, L('Одоохондоо юу ч сураагүй байна.', 'Nothing learned yet.')),
      Object.keys(topics).length ? h('div', null, h('h4', null, L('Басарын асуултын сэдвүүд', 'Basar quiz topics')),
        Object.entries(TG.BASAR.TOPICS).map(([k, t]) => { const x = topics[k] || { right: 0, total: 0 }; return h('div', { class: 'topic-row' }, h('span', null, t.icon, ' ', tx(t.name)), h('div', { class: 'bar' }, h('span', { style: { width: (x.total ? (x.right / x.total) * 100 : 0) + '%' } })), h('b', null, `${x.right}/${x.total}`)); })) : null,
      logs.length ? h('div', null, h('h4', null, L('Сүүлийн үйл ажиллагаа', 'Recent activity')), h('ul', { class: 'activity' }, logs.map((x) => { const [i, t] = logLine(x); return h('li', null, h('span', null, i, ' ', t), h('small', null, x.d)); }))) : null);
  }


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
        S.state.memCount = (S.state.memCount || 0) + 1; S.addFamilyStars(5); close(); TG.sfx.win(); TG.confetti(40); TG.achievements && TG.achievements.check();
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

  // ---------------- family / parent dashboard ----------------
  let parentChild = null;
  SCREENS.family = () => {
    if (Date.now() >= parentUntil) { setTimeout(openFamily, 0); return shell([h('p', { class: 'muted' }, '🔒')]); }
    const st = S.state, profiles = st.profiles;
    const child = profiles.find((p) => p.id === parentChild) || S.active();
    const learn = child.learn || {}, bs = child.basar || {};
    const lessonsDone = TG.learn.LESSONS.filter((l) => learn[l.id] && learn[l.id].done).length;
    const together = TG.learn.LESSONS.filter((l) => learn[l.id] && learn[l.id].family).length;
    const hand = TG.vrules.handsOn(child.village);
    const toggle = (key, label) => h('label', { class: 'switch-row' }, h('span', null, label),
      h('input', { type: 'checkbox', class: 'switch', checked: !!st.settings[key], onchange: (e) => { st.settings[key] = e.target.checked; S.save(); render(); } }));
    const famName2 = h('input', { class: 'input', placeholder: L('Нэр (ж: Нагац эгч)', 'Name (e.g. Auntie)'), maxlength: 16 });
    let famEmoji = TG.FAMILY_EMOJIS[0];
    const emojiRow = h('div', { class: 'emoji-row' });
    const drawEmoji = () => emojiRow.replaceChildren(...TG.FAMILY_EMOJIS.map((e) => h('button', { class: 'av-btn sm' + (e === famEmoji ? ' active' : ''), onclick: () => { famEmoji = e; drawEmoji(); } }, e)));
    drawEmoji();
    const next = TG.learn.LESSONS.find((l) => !(learn[l.id] && learn[l.id].family));

    return shell([
      h('h1', { class: 'page-title' }, L('Эцэг эхийн самбар', 'Parent dashboard')),
      profiles.length > 1 ? h('div', { class: 'chips' }, profiles.map((p) => h('button', { class: 'chip' + (p.id === child.id ? ' active' : ''), onclick: () => { parentChild = p.id; render(); } }, p.avatar, ' ', p.name))) : null,
      h('section', { class: 'card highlight' },
        h('div', { class: 'ring-stat', style: { '--p': Math.round((together / TG.learn.LESSONS.length) * 100) } }, h('b', null, `${together}/${TG.learn.LESSONS.length}`)),
        h('div', null,
          h('h3', null, L('Хамтдаа хийсэн бодит ажил', 'Real-life activities done together')),
          h('p', null, next ? L(`Дараагийнх: “${tx(next.family.what)}”. Хүүхэд тань “${tx(next.title)}” хичээлээр бэлтгэнэ.`, `Next up: “${tx(next.family.what)}”. Your child prepares in the “${tx(next.title)}” lesson.`)
            : L('Бүх гэр бүлийн ажлыг хамт хийжээ. Гайхалтай! 💛', 'You have done every family activity together. Wonderful! 💛')),
          h('p', { class: 'muted' }, L('Хүүхэд “Тоглохоо боль” гэхэд “Ээж ээ, хамтдаа гэр барьцгаая!” гэж хариулдаг болох нь бидний зорилго.', 'Our goal: when you say “stop playing”, your child answers “Mom, let’s build a ger together!”')))),
      h('div', { class: 'stat-cards four' },
        h('div', { class: 'stat' }, h('small', null, L('Сурсан хичээл', 'Lessons learned')), h('b', null, `${lessonsDone}/${TG.learn.LESSONS.length}`)),
        h('div', { class: 'stat', 'data-stat': 'hand' }, h('small', null, L('Гараараа сурсан', 'Learned by hand')), h('b', null, `${hand.length}/${TG.vrules.HANDS_ON.length}`)),
        h('div', { class: 'stat' }, h('small', null, L('Басарын асуулт', 'Basar quiz')), h('b', null, `${bs.right || 0}/${bs.total || 0}`)),
        h('div', { class: 'stat' }, h('small', null, L('Амжилт', 'Badges')), h('b', null, `${Object.keys(child.ach || {}).length}/${TG.achievements.LIST.length}`))),
      h('section', { class: 'card' },
        h('h3', null, `${child.avatar} ${child.name}: `, L('хичээлүүд', 'lessons')),
        TG.aimags.byId(child.aimag) ? h('p', { class: 'muted' }, '📍 ', tx(TG.aimags.byId(child.aimag).name), ' · ', tx(TG.aimags.byId(child.aimag).fact)) : null,
        TG.learn.LESSONS.map((l) => { const pr = learn[l.id] || {}; return h('div', { class: 'fam-lesson' },
          h('span', { class: 'fl-name' }, l.icon, ' ', tx(l.title)),
          h('span', { class: 'tag' + (pr.done ? ' ok' : '') }, pr.done ? '✓ ' + L('Сурсан', 'Learned') : L('Эхлээгүй', 'Not yet')),
          pr.family ? h('span', { class: 'tag fam' }, '👨‍👩‍👧') : null); }),
        h('p', { class: 'muted', style: { marginTop: '10px' } }, L(`Басараас ${bs.asked || 0} асуулт асуусан.`, `Asked Basar ${bs.asked || 0} questions.`), ' ',
          TG.basar.ai ? L('Басар AI (Claude) ухаантай ажиллаж байна.', 'Basar is running with AI (Claude).') : L('Басар офлайн мэдлэгээр ажиллаж байна.', 'Basar is using offline knowledge.'))),
      learnedReport(child),
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
        profiles.map((p) => h('div', { class: 'child-row' }, h('span', null, p.avatar, ' ', h('b', null, p.name), ` · ${p.age} ${L('нас', 'yrs')}`, p.code ? ' · 🔒' : ''),
          h('span', null, p.code ? h('button', { class: 'link-btn', onclick: () => { p.code = null; S.save(); render(); TG.toast(L('Нууц зураг арилгалаа', 'Picture password removed')); } }, L('Нууц зураг арилгах', 'Remove password')) : null,
            profiles.length > 1 ? h('button', { class: 'link-btn danger', onclick: () => { S.removeProfile(p.id); render(); } }, L('Хасах', 'Remove')) : null))),
        h('button', { class: 'btn ghost block', onclick: () => { S.state.loggedIn = false; S.save(); TG.go('auth', { tab: 'register' }); } }, '+ ', L('Хүүхэд нэмэх', 'Add a child'))),
      h('button', { class: 'about-link', onclick: () => TG.go('about') }, h('span', null, L('Бидний зорилго, шударга үнэ', 'Our mission & fair pricing')), TG.icon('chevronRight')),
      h('button', { class: 'link-btn danger center-block', onclick: () => {
        const close = TG.modal(h('div', { class: 'center' }, h('h2', null, L('Бүх өгөгдлийг устгах уу?', 'Erase all data?')), h('p', { class: 'muted' }, L('Профайл, ахиц, тохиргоо устна.', 'Profiles, progress and settings will be erased.')),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', onclick: () => close() }, L('Болих', 'Cancel')),
            h('button', { class: 'btn danger', onclick: () => { localStorage.removeItem(S.KEY); localStorage.removeItem('togloom.v1'); location.reload(); } }, L('Устгах', 'Erase')))));
      } }, L('Бүх өгөгдлийг устгах', 'Erase all data')),
    ]);
  };
  SCREENS.parents = SCREENS.family;

  // ---------------- about / pitch ----------------
  SCREENS.about = () => {
    const back = loggedIn() ? () => TG.go('village') : () => TG.go('auth');
    const P = (icon, color, title, items) => h('div', { class: 'pillar-card', style: { '--c': color } }, h('div', { class: 'pc-icon' }, icon), h('h3', null, title), h('ul', null, items.map((i) => h('li', null, i))));
    const price = (name, amount, per, items, cls, note) => h('div', { class: 'price-card ' + (cls || '') }, h('h3', null, name), h('div', { class: 'amount' }, amount, h('small', null, per)), h('ul', null, items.map((i) => h('li', null, '✓ ', i))), note ? h('p', { class: 'pnote' }, note) : null);
    return h('div', { class: 'about' },
      h('button', { class: 'icon-btn back-fixed', onclick: back, 'aria-label': 'back' }, TG.icon('arrowLeft')),
      h('header', { class: 'about-hero' },
        h('div', { class: 'badge-pill light' }, 'Pinequest · Fine-Tune for the Future'),
        h('h1', null, 'Naadamy'),
        h('p', { class: 'big-quote' }, L('“Ээж ээ, тоглохоо больё. Хамтдаа монгол гэр барьцгаая!”', '“Mom, let’s stop playing — let’s build a Mongol ger together!”')),
        h('p', null, L('Naadamy бол хүүхэд, гэр бүл, найзууд Монголын өв соёлыг хамтдаа сурдаг тоглоом. Дэлгэц дээр сурсан зүйлээ бодит амьдрал дээр гэр бүлээрээ хийдэг.', 'Naadamy is a game where children, families and friends learn Mongolian heritage together, then do it for real at home.'))),
      h('section', null,
        h('h2', null, L('Асуудал', 'The problem')),
        h('div', { class: 'problem-grid' },
          h('div', null, '📱', h('b', null, L('Ганцаардмал дэлгэц', 'Lonely screens')), h('p', null, L('Хүүхдүүд дэлгэцийн өмнө ганцаараа өнгөрүүлэх цаг ихэсч, гэр бүлийн харилцаа багасч байна.', 'Children spend more time alone on screens and less with family.'))),
          h('div', null, '🏙️', h('b', null, L('Мартагдаж буй өв', 'Fading heritage')), h('p', null, L('Хотын олон хүүхэд гэр барих, цагаан идээ хийх, Нууц товчоог мэддэггүй болж байна.', 'Many city children no longer know how to build a ger, make dairy foods or the Secret History.'))),
          h('div', null, '💸', h('b', null, L('Үнэтэй, гадаад', 'Expensive, foreign')), h('p', null, L('Ихэнх суралцах апп үнэтэй, гадаад хэл дээр, монгол соёлгүй.', 'Most learning apps are costly, foreign and lack Mongolian culture.'))))),
      h('section', null,
        h('h2', null, L('Шийдэл', 'Our solution')),
        h('div', { class: 'pillar-grid' },
          P('⛺', '#2F6BFF', L('Нутаг', 'Nutag'), [L('Найзуудтайгаа хамт тоглох пиксел тосгон', 'A pixel village to play in with friends'), L('Өөрийн монгол гэрээ барих, бөх барилдах', 'Build your own ger, wrestle at Naadam'), L('Нэг Wi-Fi-д олуулаа тоглоно', 'Play together on the same Wi-Fi')]),
          P('🐕', '#C8483C', L('Басар — AI найз', 'Basar, the AI buddy'), [L('Монгол банхар нохой үргэлж хажууд чинь', 'A Mongolian Bankhar dog always by your side'), L('Түүх, Нууц товчоо, ёс заншлыг асуухад хариулна', 'Answers questions on history, the Secret History and customs'), L('Асуулт хариулт өгнө, интернэтгүй ч ажиллана', 'Gives quizzes and works offline too')]),
          P('📚', '#E9A91F', L('Өв соёлын сургууль', 'Heritage school'), [L('Гэр барих, цагаан идээ хийх, гэрийн ёс', 'Building a ger, dairy foods, ger manners'), L('Нууц товчооны үлгэрүүд', 'Tales from the Secret History'), L('Хичээл бүр гэр бүлийн бодит ажлаар төгсөнө', 'Every lesson ends with a real family activity')]))),
      h('section', { class: 'about-engine' },
        h('h2', null, L('Тоглоомын хөдөлгүүр: Phaser 4', 'Game engine: Phaser 4')),
        h('p', null, L('Нутаг тосгон Phaser 4 тоглоомын хөдөлгүүр дээр ажилладаг: дүр зураг, камер, удирдлага, хөдөлгөөнийг хөдөлгүүр хариуцаж, бид соёлын агуулгадаа анхаардаг.', 'The Nutag village runs on the Phaser 4 game engine: scenes, camera, controls and animation are handled by the engine, so we spend our time on the culture.')),
        h('ul', null,
          h('li', null, L('Гэрээ гараараа барих: хонь хяргаж эсгий хийх, Мужаан өвөөгөөс мод авах, алхам бүрийг өөрөө хийх', 'Build your ger by hand: shear sheep and make felt, get the wood from Grandpa Craftsman, do every step yourself')),
          h('li', null, L('Нэг дэлгэц дээр хоёулаа: тоноо хамт өргөж, эсгийгээ хамт өнхрүүлэх', 'Two players on one screen: lift the toono and roll the felt together')),
          h('li', null, L('Интернэтгүй ажиллана: хөдөлгүүр аппын дотор багтсан', 'Works offline: the engine ships inside the app')))),
      h('section', { class: 'why-human' },
        h('h2', null, L('Яагаад хиймэл оюун үүнийг орлож чадахгүй вэ?', "Why AI can't replace this")),
        h('div', { class: 'human-grid' },
          h('div', null, h('span', null, '👨‍👩‍👧'), h('b', null, L('Басар заана, гэр бүл хийнэ', 'Basar teaches, family does')), h('p', null, L('AI нохой мэдлэг өгдөг ч гэрээ ээж аавтайгаа хамт барина.', 'The AI dog shares knowledge, but you build the ger with Mom and Dad.'))),
          h('div', null, h('span', null, '🌍'), h('b', null, L('Тоглоом дэлгэцээс гадна дуусна', 'Every lesson ends off-screen')), h('p', null, L('Бяцхан гэр барих, тараг исгэх, таван сумны туршилт — гэр бүлээрээ.', 'A mini ger, homemade yogurt, the five arrows test — all as a family.'))),
          h('div', null, h('span', null, '🎙️'), h('b', null, L('Эмээгийн дуу хоолой', "Grandma's voice")), h('p', null, L('Ахмадуудын ярьсан ёс заншил, түүхийг Дурсамжийн номонд хадгална.', 'Customs and stories from elders are saved in the memory book.'))),
          h('div', null, h('span', null, '🗣️'), h('b', null, L('Басар “эмээгээсээ асуу” гэдэг', 'Basar says “ask Grandma”')), h('p', null, L('Мэдэхгүй зүйлээ Басар ахмадуудаас асуухыг урамшуулдаг.', 'When unsure, Basar encourages asking the elders.'))))),
      h('section', null,
        h('h2', null, L('Хүн бүрт тэгш хүртээмж', 'Equal access for everyone')),
        h('div', { class: 'access-grid' }, [
          ['📶', L('Офлайн ажиллана: Басар интернэтгүй ч мэдлэгээ хуваалцана', 'Works offline: Basar shares his knowledge even without internet')],
          ['📱', L('Хуучин, хямд утсан дээр ажиллана', 'Runs on old, low-cost phones')],
          ['🇲🇳', L('Монгол хэл, монгол соёл дээр суурилсан', 'Built on Mongolian language and culture')],
          ['🚫', L('Зар сурталчилгаагүй, өгөгдөл худалдахгүй', 'No ads, no selling data')],
          ['🔒', L('Профайл зөвхөн таны төхөөрөмж дээр, AI-д нэр хадгалагдахгүй', 'Profiles stay on your device; the AI keeps no names')],
          ['🧒', L('Хүүхдэд аюулгүй AI: хувийн мэдээлэл асуудаггүй', 'Kid-safe AI: never asks for personal details')],
        ].map(([i, t]) => h('div', { class: 'access-item' }, h('span', null, i), t)))),
      h('section', null,
        h('h2', null, L('Шударга үнэ', 'Fair pricing')),
        h('div', { class: 'price-grid' },
          price(L('Үнэгүй', 'Free'), '0₮', L(' / үүрд', ' / forever'), [L('Нутаг, бүх хичээл', 'Nutag and every lesson'), L('Басарын офлайн мэдлэг', 'Basar’s offline knowledge'), L('Дурсамжийн ном', 'Memory book')]),
          price(L('Гэр бүл', 'Family'), '3,900₮', L(' / сар', ' / month'), [L('Басар AI ухаалаг горим', 'Basar smart AI mode'), L('Сар бүр шинэ өв соёлын хичээл', 'New heritage lessons every month'), L('Хэвлэх гэр бүлийн картууд', 'Printable family activity cards')], 'featured',
            L('💛 Нэг гэр бүлийн төлбөр = хөдөөгийн нэг хүүхдэд үнэгүй эрх', '💛 One family plan = free access for one rural child')),
          price(L('Сургууль, сум', 'Schools & soums'), '0₮', L(' / үнэгүй', ' / free'), [L('Төрийн сургууль, цэцэрлэг', 'Public schools & kindergartens'), L('Багшийн самбар', 'Teacher dashboard'), L('Ангиараа Нутагт хамт тоглох', 'Whole class plays together in Nutag')]))),
      h('section', null,
        h('h2', null, L('Цаашдын төлөвлөгөө', 'Roadmap')),
        h('ol', { class: 'roadmap' },
          h('li', null, h('b', null, L('Одоо', 'Now')), L('Нутаг, Басар AI нохой, 4 өв соёлын хичээл, офлайн PWA', 'Nutag, Basar the AI dog, 4 heritage lessons, offline PWA')),
          h('li', null, h('b', null, L('Дараа', 'Next')), L('Монгол бичиг, морин хуур, айраг бүлэх, Цагаан сарын хичээлүүд', 'Lessons on Mongol script, morin khuur, airag and Tsagaan Sar')),
          h('li', null, h('b', null, L('Удахгүй', 'Soon')), L('Басарын дуу хоолой, өвөө эмээгийн бичсэн үлгэрүүд', 'Basar’s voice and stories recorded by grandparents')),
          h('li', null, h('b', null, L('Ирээдүй', 'Future')), L('Сургууль, сум, музейтэй хамтран ажиллах', 'Partnerships with schools, soums and museums')))),
      TG.music && TG.music.credits().length ? h('section', null,
        h('h2', null, L('Хөгжмийн зохиогчид', 'Music credits')),
        h('p', { class: 'center muted' }, L('Арын хөгжим бүгд CC0 (нийтийн өмч) лицензтэй, OpenGameArt.org-оос.', 'All background music is CC0 (public domain) from OpenGameArt.org.')),
        h('ul', { class: 'credits' }, TG.music.credits().map((c) => h('li', null, h('b', null, c.title), ' — ', c.artist, ' · ', c.license, c.source ? [' · ', h('a', { href: c.source, target: '_blank', rel: 'noopener' }, 'OpenGameArt')] : null)))) : null,
      h('footer', { class: 'about-foot' }, L('Монгол хүүхэд бүрт ❤️ · Pinecone Academy · Pinequest', 'For every Mongolian child ❤️ · Pinecone Academy · Pinequest'),
        h('div', null, h('button', { class: 'btn primary', onclick: back }, L('Эхлэх ▶', 'Start ▶')))));
  };

  // ---------------- boot ----------------
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {}));
  }
  TG.basar.check();
  render();
})(window.TG);
