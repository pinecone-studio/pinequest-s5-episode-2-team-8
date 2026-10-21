/* All ages: calm breathing with mood check before and after */
(function (TG) {
  const { h, L } = TG;
  const MOODS = ['😟', '😐', '🙂', '😄'];
  TG.registerGame({
    id: 'breathing', icon: '🌬️', pillar: 'health', ages: ['3-6', '7-10', '11-14', '15-18'],
    title: { mn: 'Тайван амьсгал', en: 'Calm breathing' },
    desc: { mn: 'Хамтдаа амьсгалж, сэтгэлээ тайвшруул', en: 'Breathe together and calm down' },
    realLife: { mn: 'Унтахын өмнө гэр бүлээрээ 3 удаа гүнзгий амьсгалж, өдрийнхөө талархах нэг зүйлийг хэлээрэй.', en: 'Before bed, take 3 deep breaths as a family and say one thing you are grateful for.' },
    start(ctx) {
      const life = TG.lifecycle();
      const young = ctx.ageGroup === '3-6' || ctx.ageGroup === '7-10';
      // The team banner is replaced by the breathing circle, so keep who is
      // breathing together visible in the HUD for the whole exercise.
      ctx.hud.replaceChildren(h('div', { class: 'hud-pill' }, ctx.together
        ? '🤝 ' + ctx.players.map((p) => p.emoji).join(' ') + ' ' + L('Бүгд хамт амьсгана', 'Everyone breathes together')
        : '🌬️ ' + L('Амьсгал', 'Breathe')));
      const pattern = young ? [['in', 3], ['out', 4]] : [['in', 4], ['hold', 4], ['out', 4], ['hold', 3]];
      const cycles = 4;
      let before = null;
      const words = {
        in: young ? L('Бөмбөлгөө томруул… амьсгаа ав', 'Fill the balloon… breathe in') : L('Амьсгаа ав…', 'Breathe in…'),
        hold: L('Барь…', 'Hold…'),
        out: young ? L('Аажуухан үлээ…', 'Slowly blow out…') : L('Аажмаар гарга…', 'Slowly breathe out…'),
      };
      const moodPicker = (title, onPick) => h('div', { class: 'mood' }, h('p', { class: 'prompt' }, title),
        h('div', { class: 'mood-row' }, MOODS.map((m) => h('button', { class: 'mood-btn', onclick: () => { TG.sfx.tap(); onPick(m); } }, m))));

      const step1 = () => ctx.root.replaceChildren(
        ctx.together ? h('div', { class: 'team-banner' }, '🤝 ', L('Гараасаа хөтлөлцөөд нэг хэмнэлээр амьсгалаарай.', 'Hold hands and breathe in the same rhythm.')) : null,
        moodPicker(L('Яг одоо ямар байна?', 'How do you feel right now?'), (m) => { before = m; step2(); }));

      const step2 = async () => {
        const circle = h('div', { class: 'breath-circle' }, young ? '🎈' : '');
        const label = h('div', { class: 'breath-label' }, L('Бэлэн үү?', 'Ready?'));
        const count = h('div', { class: 'breath-count' });
        ctx.root.replaceChildren(h('div', { class: 'breath-wrap' }, circle), label, count);
        if (!(await life.wait(1200))) return;
        for (let c = 1; c <= cycles; c++) {
          count.textContent = `${c}/${cycles}`;
          for (const [phase, sec] of pattern) {
            label.textContent = words[phase];
            circle.style.transitionDuration = sec + 's';
            if (phase === 'in') circle.classList.add('big');
            if (phase === 'out') circle.classList.remove('big');
            if (!(await life.wait(sec * 1000))) return;
          }
        }
        TG.sfx.chime();
        ctx.root.replaceChildren(moodPicker(L('Одоо ямар байна?', 'How do you feel now?'), (after) => {
          ctx.finish({ stars: 3, summary: `${L('Өмнө', 'Before')} ${before} → ${L('Одоо', 'Now')} ${after}` });
        }));
      };
      step1();
      return () => life.stop();
    },
  });
})(window.TG);
