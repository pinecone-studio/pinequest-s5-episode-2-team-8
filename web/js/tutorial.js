/* Naadamy — the tutorial level: Guide Bolormaa walks a new player through Нутаг.
   She talks in the story box (portrait with changing faces, her own voice), then hands over control for small
   goals: walk, jump, call Basar, drink from the well. In between she shows the buttons and answers questions.
   It starts by itself on the first visit; the "?" pill in Нутаг plays it again. */
(function (TG) {
  const { h, L } = TG;
  const T = (mn, en) => ({ mn, en });
  const S = TG.store;
  const LOOK = { deel: 'blue', skin: '#D9A06E', hat: null, face: null, neck: 'khadag', pet: null }; // Bolormaa in the village
  const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  let run = null; // { id, goalEl, glowEl, timer }
  const V = () => { const p = S.active(); return p && p.village; };
  const live = () => TG._village && TG._village.live();

  class Stopped extends Error {}
  const check = (r) => { if (!run || run.id !== r) throw new Stopped(); };

  function glow(sel) {
    if (run && run.glowEl) { run.glowEl.classList.remove('tut-glow'); const box = run.glowEl.closest('.v-more'); if (box) box.classList.remove('open'); run.glowEl = null; }
    const el = sel && document.querySelector(sel);
    if (el && run) { el.classList.add('tut-glow'); run.glowEl = el; const box = el.closest('.v-more'); if (box) box.classList.add('open'); } // buttons behind "more" pop out while the guide points at them
  }
  function target(t) { TG._village.tut(Object.assign(live().tut || {}, { target: t })); }

  /** Hand control to the player until done() is true. Shows a goal banner with a skip button. */
  function goal(r, text, done, progress) {
    check(r);
    TG.dialog.close();
    TG._village.nomin('out'); // she leaves you to it instead of tagging along
    const label = h('span'), skip = h('button', { class: 'tut-skip' }, L('Алгасах', 'Skip'));
    const el = h('div', { class: 'tut-goal', role: 'status' }, h('b', null, '🎯'), label, skip);
    document.body.appendChild(el); run.goalEl = el;
    const paint = () => { label.textContent = TG.tx(text) + (progress ? ` ${progress()}` : ''); };
    paint();
    return new Promise((resolve, reject) => {
      const end = (ok) => { clearInterval(run && run.timer); el.remove(); if (run) run.goalEl = null; ok ? resolve() : reject(new Stopped()); };
      skip.addEventListener('click', () => { TG.sfx.tap(); end(true); });
      run.timer = setInterval(() => {
        if (!run || run.id !== r || !live()) return end(false);
        if (document.querySelector('.modal-back') && !done.allowModal) return; // wait while a window is open
        paint();
        if (done()) { TG.sfx.good(); end(true); }
      }, 150);
    });
  }

  // ---------------------------------------------------------------- the lesson
  async function lesson(r, replay) {
    const name = (S.active() || {}).name || '';
    // when she points at a button in the lower half of the screen, her box moves to the top so you can see it
    const lowGlow = () => { const el = run && run.glowEl; return !!el && el.getBoundingClientRect().top > innerHeight * 0.5; };
    const say = (face, mn, en, opts = {}) => { check(r); TG._village.nomin('in'); glow(opts.glow || null); return TG.dialog.say({ who: opts.who || 'guide', face, text: T(mn, en), top: lowGlow(), free: true }).then(() => check(r)); };
    const ask = (face, mn, en, choices) => { check(r); TG._village.nomin('in'); glow(null); return TG.dialog.ask({ who: 'guide', face, text: T(mn, en), choices }).then((i) => { check(r); return i; }); };

    if (replay) {
      const pick = await ask('happy', `Дахиад уулзлаа, ${name}! Юу сонсмоор байна?`, `Hi again, ${name}! What would you like to hear about?`,
        [T('Бүгдийг эхнээс нь', 'Everything from the start'), T('Удирдлага: алхах, үсрэх', 'Controls: walking, jumping'), T('Надад асуулт байна', 'I have a question'), T('Юу ч үгүй, баярлалаа', 'Nothing, thanks')]);
      if (pick === 1) { await controls(); return finish(false); }
      if (pick === 2) { await questions(); return finish(false); }
      if (pick !== 0) return finish(false);
    }

    // hello
    await say('happy', `Сайн уу, ${name}! Би Болормаа, энэ Нутгийн хөтөч.`, `Hello, ${name}! I’m Bolormaa, the guide of this village.`);
    await say('wink', 'Энд мал саах, бөх барилдах, морь уралдуулах, монгол гэр барих бүгдийг тоглож сурна.', 'Here you learn by playing: milking, wrestling, horse racing, building a ger and more.');
    let a = await ask('tease', 'Тэгэхээр... надтай хамт Нутгаар нэг тойрох уу?', 'So... want to take a little tour with me?',
      [T('Тийм ээ, явцгаая!', 'Yes, let’s go!'), T('Нутаг гэж юу вэ?', 'What is Nutag?'), T('Би өөрөө мэднэ', 'I already know how')]);
    if (a === 1) {
      await say('think', '“Нутаг” гэдэг нь төрсөн газар, гэр орон гэсэн утгатай. Монголчууд нутгаа их хайрладаг.', '“Nutag” means your homeland, the place you come from. Mongolians love their nutag dearly.');
      await say('happy', 'Энэ бол бидний тосгон. Найзууд чинь ч энд хамт тоглож болно!', 'This is our village. Your friends can play here with you too!');
    } else if (a === 2) {
      a = await ask('surprised', 'Өө, үнэхээр үү? Тэгвэл алгасах уу?', 'Oh, really? Shall we skip it then?', [T('Тийм, алгасъя', 'Yes, skip it'), T('Үгүй, үзье', 'No, show me')]);
      if (a === 0) { await say('proud', 'За за! Мартвал дээд талын ? товчийг дараарай. Сайхан тоглоорой!', 'Okay! If you forget anything, tap the ? at the top. Have fun!', { glow: '.v-help' }); return finish(true, true); }
    }
    await controls();

    // Basar
    await say('happy', 'Хараач, энэ миний найз Басар! Монгол банхар нохой. Тэр маш ухаантай.', 'Look, this is my friend Basar! A Mongolian Bankhar dog. He is very clever.');
    await TG.dialog.say({ who: 'basar', face: 'happy', text: T('Вуф! Вуф-вуф! Сайн уу! Надаас юу ч асуугаарай!', 'Woof! Woof-woof! Hi! Ask me anything!'), free: true }); check(r);
    await say('wink', coarse ? 'Басар дээр эсвэл доод талын 🐕 товч дээр дарвал түүнтэй ярилцана. Оролдоод үз дээ!' : 'Басар дээр дарах, B товч эсвэл 🐕 товчоор түүнтэй ярилцана. Оролдоод үз дээ!', coarse ? 'Tap Basar or the 🐕 button to talk to him. Give it a try!' : 'Click Basar, press B, or use the 🐕 button to talk to him. Try it!', { glow: '.v-basar' });
    let opened = false;
    const basarDone = () => { if (document.querySelector('.modal .b-head')) opened = true; return opened && !document.querySelector('.modal-back'); };
    basarDone.allowModal = true;
    await goal(r, T('Басартай ярилц', 'Talk to Basar'), basarDone);
    glow(null);
    await say('laugh', 'Ха-ха, Басар чамд дуртай боллоо! Түүнээс хэзээ ч асууж болно.', 'Ha-ha, Basar likes you already! You can ask him anything, any time.');

    // using things: the well
    await say('neutral', coarse ? 'Аливаа зүйлийн хажууд очиход доод талд товч гарч ирнэ. Түүнийг дарвал ашиглана.' : 'Аливаа зүйлийн хажууд очиход доод талд товч гарч ирнэ. E товч дарж (эсвэл товчийг дарж) ашиглана.', coarse ? 'When you stand next to something, a button pops up at the bottom. Tap it to use it.' : 'When you stand next to something, a button pops up at the bottom. Press E (or click it) to use it.');
    await say('tease', 'Тэр худаг руу очоод ус уугаад ир. Шар сум замыг заана!', 'Go to the well and have a drink. The yellow arrow shows the way!');
    const objs = TG._village.objects(), well = objs.find((o) => o.id === 'well');
    const drank0 = (V().ate || {}).us || 0;
    target({ x: well.x, y: well.y, label: L('Худаг', 'Well') });
    await goal(r, T('Худгаас ус уу', 'Drink from the well'), () => ((V().ate || {}).us || 0) > drank0);
    target(null);
    await say('happy', 'Ам цангаагаа тайллаа! Гэр, мал, дэлгүүр, хүмүүс бүгд ингэж ажилладаг.', 'Refreshing! Gers, animals, the shop and people all work like that.');

    // the buttons
    await say('proud', 'Одоо товчнуудаа танилцъя. Энэ чиний зоос. Даалгавар хийж зоос цуглуулаад дэлгүүрээс дээл, малгай, тэжээвэр ав.', 'Now the buttons. These are your coins. Do tasks, earn coins and buy deels, hats and pets at the shop.', { glow: '.v-pills .v-pill' });
    await say('neutral', 'Энэ бол хүч 🍖. Гүйхэд багасна. Ядарвал хоол идэж, ундаа уугаарай.', 'This is your energy 🍖. Running uses it up. When you’re tired, eat or drink something.', { glow: '.v-energy' });
    await say('happy', 'Ном дээр дарвал Өв соёлын сургууль нээгдэнэ: гэр барих, цагаан идээ хийх, Нууц товчоо...', 'The book opens the Heritage School: building a ger, making dairy, the Secret History...', { glow: '.v-round[aria-label="learn"]' });
    await say('wink', 'Энэ товчийг дарвал өдрийн даалгаврууд гарна. Өдөр бүр шинэ!', 'This button shows your daily quests. New ones every day!', { glow: '.v-round[aria-label="quests"]' });
    await say('think', 'Энэ бол газрын зураг. Дарвал томорч, газар сонговол тийшээ алхана.', 'This is the map. Tap it to make it bigger, then pick a place to walk there.', { glow: '.v-mini' });
    await say('surprised', 'Энэ нүд товч бол хамгийн гайхалтай нь: бүх Нутгийг 3D-ээр өөрийн нүдээр харна!', 'And the eye button is the coolest: see the whole village in 3D, through your own eyes!', { glow: '.v-fpbtn' });
    await say('tease', 'Мартчихвал энэ ? товчийг дар. Би дахиад гүйгээд ирнэ!', 'If you forget anything, tap this ?. I’ll come running back!', { glow: '.v-help' });
    glow(null);
    await questions();
    return finish(true);

    async function controls() {
      await say('happy', coarse ? 'Эхлээд алхаж үзье! Дэлгэц дээр хуруугаа тавиад чирвэл джойстик гарч ирнэ. Очих газраа товшсон ч болно.' : 'Эхлээд алхаж үзье! WASD эсвэл сум товчоор алхана. Газар дээр дарвал тийшээ очно.',
        coarse ? 'Let’s walk first! Put your finger on the screen and drag: a joystick appears. You can also just tap where to go.' : 'Let’s walk first! Use WASD or the arrow keys. You can also click the ground to walk there.');
      const lv = live(), w0 = lv.walked || 0;
      await goal(r, T('Алхаж үзээрэй', 'Take a walk'), () => (live().walked || 0) - w0 >= 6, () => `${Math.min(6, Math.floor((live().walked || 0) - w0))}/6`);
      await say('laugh', 'Ёстой гоё! Чи хурдан хөлтэй юм аа!', 'Great job! You’ve got quick feet!');
      await say('tease', coarse ? 'Одоо үсэрцгээе! Баруун доод талын ⤒ товчийг дар.' : 'Одоо үсэрцгээе! Space товч дар.', coarse ? 'Now let’s jump! Tap the ⤒ button at the bottom right.' : 'Now let’s jump! Press Space.', { glow: coarse ? '.v-jump' : null });
      const j0 = live().me.jt || 0;
      await goal(r, T('Үсэр!', 'Jump!'), () => (live().me.jt || 0) > j0);
      glow(null);
      await say('surprised', 'Вау, ямар өндөр үсрэв! Замд чулуу таарвал үсрээд давчихна.', 'Whoa, what a jump! If a rock is in the way, you hop right over it.');
      await say('neutral', coarse ? 'Яарч байвал 🏃 товчийг асаавал гүйнэ. Гэхдээ гүйхэд хүч зарцуулдаг шүү.' : 'Яарч байвал Shift товчийг дарж байгаад гүйнэ. Гэхдээ гүйхэд хүч зарцуулдаг шүү.', coarse ? 'In a hurry? Switch on the 🏃 button to run. Running uses up energy, though.' : 'In a hurry? Hold Shift to run. Running uses up energy, though.', { glow: coarse ? '.v-run' : null });
      glow(null);
    }

    async function questions() {
      const left = [
        [T('Бөх яаж барилдах вэ?', 'How do I wrestle?'), async () => {
          await say('proud', 'Зүүн талд Наадмын талбай бий. Засуултай уулзаад барилд. Мэхээ сонгоод товч дарахад л болно.', 'The Naadam arena is to the east. Talk to the herald, pick a move and press the button. That’s all!');
          await say('wink', 'Мэх мэдэхгүй бол «Барилдаж сурах»-ыг сонго. Бүгдийг нь энгийнээр тайлбарлаад, багштай дасгал хийлгэнэ.', 'Not sure about the moves? Choose “Learn to wrestle”. Everything is explained simply, then you practise with a coach.');
          await say('happy', 'Мэх бүр өөр: зарим нь цагаа тааруулах, зарим нь хурдан дарах, зарим нь дараад барих. Эхний даваанууд амархан шүү!', 'Each move is a little game: tap on time, tap fast, or hold and let go. The first rounds are easy!');
          await say('tease', 'Ялсан хойноо бүргэд шиг дэвэхээ мартуузай! 🦅', 'And when you win, don’t forget the eagle dance! 🦅');
        }],
        [T('Морь яаж унах вэ?', 'How do I ride a horse?'), async () => {
          await say('happy', 'Гудамжны зүүн талд морины уяа бий. Морио сонгоод унана, тэгээд Нутгаар давхина!', 'There’s a horse line on the east side of the street. Pick a horse, hop on and gallop around!');
          await say('wink', coarse ? 'Уралдаанд “Чү!” товч дарж морио давхиулна. Харин морь ядарвал бага зэрэг амраагаарай.' : 'Уралдаанд Shift (эсвэл “Чү!” товч) дарж морио давхиулна. Харин морь ядарвал бага зэрэг амраагаарай.', coarse ? 'In a race, press “Chü!” to sprint. Let your horse rest a little when it gets tired.' : 'In a race, hold Shift (or the “Chü!” button) to sprint. Let your horse rest a little when it gets tired.');
        }],
        [T('Юунаас эхлэх вэ?', 'Where should I start?'), async () => {
          await say('think', 'Толгой дээрээ шар “!” тэмдэгтэй хүмүүсийг хай. Тэд чамд даалгавар өгнө.', 'Look for people with a yellow “!” over their heads. They have tasks for you.');
          await say('happy', 'Эмээгийн гэрт ч зочлоорой. Эмээ ёс заншил зааж, ааруул өгдөг!', 'Visit Grandma’s ger too. She teaches good manners and gives you aaruul!');
        }],
        [T('Чи хэн бэ?', 'Who are you?'), async () => {
          await say('proud', 'Би Болормаа! Хөдөө өссөн, морь унах, бөх барилдахыг үзэх их дуртай.', 'I’m Bolormaa! I grew up in the countryside, and I love riding and watching wrestling.');
          await say('tease', 'Нууцхан хэлэхэд... Басарыг надаас ч илүү ухаантай гэж боддог. Түүнд битгий хэлээрэй!', 'Between you and me... I think Basar is even smarter than me. Don’t tell him!');
        }],
      ];
      let first = true;
      for (;;) {
        const opts = [...left.map((q) => q[0]), T('Асуулт алга, тоглоцгооё!', 'No more questions, let’s play!')];
        const i = await ask(first ? 'happy' : 'wink', first ? 'Надаас юу асуумаар байна?' : 'Өөр юу асуух вэ?', first ? 'What would you like to ask me?' : 'Anything else?', opts);
        first = false;
        if (i < 0 || i >= left.length) return;
        const [, answer] = left.splice(i, 1)[0];
        await answer();
        if (!left.length) return;
      }
    }

    async function finish(full, skipped) {
      check(r);
      const v = V();
      const firstTime = !v.tutorial;
      v.tutorial = true; v.tips = true; S.save();
      if (full && firstTime && !skipped) {
        const got = TG.villageReward ? TG.villageReward(30, 30) : null;
        TG.confetti(50); TG.sfx.win();
        await say('laugh', `Чи бэлэн боллоо! Энэ миний бэлэг: 🪙 +${got ? got.coins : 30}. Сайхан тоглоорой!`, `You’re all set! Here’s a gift: 🪙 +${got ? got.coins : 30}. Have fun!`);
      } else if (!skipped) await say('happy', 'За, сайхан тоглоорой! Би энд л байна.', 'Okay, have fun! I’m right here.');
      stop();
    }
  }

  function start(replay) {
    const lv = live(); if (!lv || run || lv.race || lv.battle || !TG.dialog) return;
    if (document.querySelector('.modal-back')) document.querySelectorAll('.modal-back .modal-x').forEach((x) => x.click());
    const r = Math.random();
    run = { id: r, goalEl: null, glowEl: null, timer: 0 };
    if (!replay) { const v = V(); if (v && !v.tutorialSeen) { v.tutorialSeen = Date.now(); S.save(); } } // seen once: never starts by itself again
    lv.keys.clear(); lv.me.path = [];
    TG._village.tut({ guide: null, target: null }); // she pops in with her first line
    lesson(r, !!replay).catch((e) => { if (!(e instanceof Stopped)) { console.warn('tutorial', e); stop(); } });
  }
  function stop() {
    if (!run) return;
    const r = run; run = null;
    clearInterval(r.timer); if (r.goalEl) r.goalEl.remove(); if (r.glowEl) r.glowEl.classList.remove('tut-glow');
    TG.dialog && TG.dialog.close();
    const lv = TG._village && TG._village.live();
    if (lv) { TG._village.nomin('out'); if (lv.tut) lv.tut.target = null; }
    drop.next = Math.max(drop.next, Date.now() + GAP_SHORT); // no drop-in visit right after she has just talked
  }

  // ---------------------------------------------------------------- Bolormaa drops by: a quest to claim, new quests, someone with a task, now and then a tip
  const TIPS = [
    T('Ядарсан уу? 🍖 дээр дараад нэг юм идчих. Хүч чинь буцаад дүүрнэ шүү.', 'Feeling tired? Tap 🍖 and grab a snack. Your energy fills right back up.'),
    T('Эмээд зочлохоо мартаагүй биз? Ёсоор мэндэлбэл ааруул өгнө шүү, хи хи.', 'Have you visited Grandma yet? Greet her nicely and she’ll share her aaruul, hee hee.'),
    T('Морины уяанаас нэг морь аваад давхиж үзээч. Салхи нүүрэнд чинь ч гоё байдаг шүү!', 'Why not take a horse from the hitching line for a ride? The wind on your face feels amazing!'),
    T('Ямар нэг юм сонирхож байвал Басараас асуугаарай. Тэр бүхнийг мэддэг, надаас ч илүү!', 'Curious about something? Ask Basar. He knows everything, even more than me!'),
    T('Нүдэн товчийг дарвал Нутгаа 3D-ээр харна. Би анх үзэхдээ их гайхаж билээ.', 'Tap the eye button to see Nutag in 3D. It amazed me the first time I saw it.'),
    T('Наадмын талбайд Засуул чамайг хүлээж байна. Бөхийн мэх сурмаар байна уу?', 'The herald is waiting at the Naadam field. Want to learn a wrestling move?'),
  ];
  // she remembers what she has already told you (saved with your progress), so a reload never repeats it
  const memo = () => { const v = V(); v.nomin = v.nomin || { said: {}, last: 0 }; return v.nomin; };
  const drop = { next: Date.now() + 3 * 60000, busy: false };   // no visit in the first few minutes of a session
  const GAP = 5 * 60000, GAP_SHORT = 2 * 60000;                  // and plenty of room between visits
  const quiet = () => {
    const lv = live(), v = V();
    return lv && v && (v.tutorial || v.tutorialSeen) && !run && !drop.busy && !lv.race && !lv.battle && !lv.fpOpen && !lv.match && !(TG.fp && TG.fp.active()) && !(TG.scene && TG.scene.active())
      && !(TG.dialog && TG.dialog.active()) && !document.querySelector('.modal-back') && document.visibilityState === 'visible';
  };
  async function dropBy(face, text, opts = {}) {
    drop.busy = true;
    const lit = opts.glow && document.querySelector(opts.glow);
    try {
      TG._village.nomin('in');
      if (opts.target) TG._village.tut(Object.assign(live().tut || {}, { target: opts.target }));
      if (lit) lit.classList.add('tut-glow');
      await TG.dialog.say({ who: 'guide', face, text, free: true, auto: 5600 });
    } catch (e) { /* the village closed */ }
    TG.dialog.close();
    if (lit) setTimeout(() => lit.classList.remove('tut-glow'), 4000);
    if (TG._village.live()) TG._village.nomin('out');
    if (opts.target) setTimeout(() => { const lv = live(); if (lv && lv.tut && lv.tut.target === opts.target) lv.tut.target = null; }, 20000);
    drop.busy = false;
  }
  setInterval(() => {
    if (!quiet()) return;
    const now = Date.now(), m = memo(); if (now < drop.next || now - (m.last || 0) < GAP_SHORT) return;
    const said = (k) => !!m.said[k], mark = (k, gap) => { m.said[k] = now; m.last = now; drop.next = now + gap; S.save(); };
    const qs = TG._village.questsState(), name = (k) => TG.tx(qs.defs[k].t), nm = (S.active() || {}).name || '';
    const ready = qs.list.find((q) => !q.done && q.p >= qs.defs[q.k].n && !said('ready:' + qs.day + q.k));
    if (ready) {
      mark('ready:' + qs.day + ready.k, GAP_SHORT);
      return dropBy('laugh', T(`${nm}, чи “${name(ready.k)}”-ийг хийчихжээ! Ёстой шаргуу юм аа. Даалгаврын товчоос шагналаа аваарай.`, `${nm}, you finished “${name(ready.k)}”! So proud of you. Your reward is waiting under the quests button.`), { glow: '.v-round[aria-label="quests"]' });
    }
    if (now - (m.last || 0) < GAP) return;
    if (qs.seen !== qs.day && !said('new:' + qs.day)) {
      mark('new:' + qs.day, GAP);
      return dropBy('wink', T(`Өглөөний мэнд, ${nm}! Өнөөдөр шинэ даалгаврууд гарсан шүү. Нэг нь “${name(qs.list[0].k)}”. Хамт хийцгээе үү?`, `Hi again, ${nm}! There are new quests today. One is “${name(qs.list[0].k)}”. Shall we give it a go?`), { glow: '.v-round[aria-label="quests"]' });
    }
    const npc = TG._village.npcs().find((n) => n.mark === '!' && !said('npc:' + n.id));
    if (npc) {
      mark('npc:' + npc.id, GAP);
      return dropBy('think', T(`Сонсоо, ${npc.name.mn} чамаас тусламж хүсэж байна. Шар сум замыг заана, би энд л байна.`, `Psst, ${npc.name.en} could use your help. The yellow arrow shows the way, and I’m right here if you need me.`), { target: { x: npc.x, y: npc.y, label: TG.tx(npc.name) } });
    }
    if (now - (m.last || 0) > 15 * 60000 + Math.random() * 10 * 60000) {   // a friendly tip, only now and then
      const tip = TIPS.find((t, i) => !said('tip:' + i)) || TG.pick(TIPS);
      mark('tip:' + TIPS.indexOf(tip), GAP);
      return dropBy(TG.pick(['happy', 'wink', 'proud']), tip);
    }
  }, 3000);

  TG.tutorial = { start, stop, LOOK, active: () => !!run, dropBy: (face, mn, en) => dropBy(face, T(mn, en)) };
})(window.TG);
