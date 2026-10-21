/* 3–10: memory pairs with Mongolian nature & culture words */
(function (TG) {
  const { h, L } = TG;
  const ITEMS = [
    ['🐎', 'Морь', 'Horse'], ['🐫', 'Тэмээ', 'Camel'], ['🐑', 'Хонь', 'Sheep'], ['🐐', 'Ямаа', 'Goat'],
    ['🐄', 'Үхэр', 'Cow'], ['🦅', 'Бүргэд', 'Eagle'], ['🏔️', 'Уул', 'Mountain'], ['🌙', 'Сар', 'Moon'],
    ['☀️', 'Нар', 'Sun'], ['🐺', 'Чоно', 'Wolf'], ['🥛', 'Сүү', 'Milk'], ['🏹', 'Нум сум', 'Bow'],
  ];

  TG.registerGame({
    id: 'memory', icon: '🃏', pillar: 'edu', ages: ['3-6', '7-10'],
    title: { mn: 'Санах ойн карт', en: 'Memory match' },
    desc: { mn: 'Ижил хос картыг олж, үгийг нь сур', en: 'Find matching pairs and learn the words' },
    realLife: { mn: 'Гэрээсээ ижил хос зүйлс (оймс, аяга) хайж олох уралдаан хамт хийгээрэй.', en: 'Race each other to find matching pairs at home (socks, cups).' },
    start(ctx) {
      const life = TG.lifecycle();
      const T = TG.makeTurns(ctx);
      const pairs = ctx.ageGroup === '3-6' ? 6 : 8;
      const deck = TG.shuffle(TG.shuffle(ITEMS).slice(0, pairs).flatMap((it) => [it, it]));
      let open = [], lock = false, moves = 0, matched = 0;
      const status = h('div', { class: 'prompt' }, L('Хоёр карт эргүүл', 'Flip two cards'));
      const grid = h('div', { class: 'memory-grid' });
      const cards = deck.map((it, idx) => {
        const label = h('span', { class: 'mc-label' }, L(it[1], it[2]));
        const c = h('button', { class: 'mcard', 'aria-label': 'card ' + (idx + 1), onclick: () => flip(c, it) },
          h('span', { class: 'mc-inner' }, h('span', { class: 'mc-back' }, '✦'), h('span', { class: 'mc-front' }, h('span', { class: 'mc-e' }, it[0]), label)));
        grid.appendChild(c); return c;
      });
      function flip(c, it) {
        if (lock || c.classList.contains('flipped')) return;
        c.classList.add('flipped'); TG.sfx.tap(); open.push({ c, it });
        if (open.length < 2) return;
        moves++; lock = true;
        const [a, b] = open; open = [];
        if (a.it === b.it) {
          a.c.classList.add('matched'); b.c.classList.add('matched'); T.add(1); matched++;
          TG.sfx.good(); TG.speak(it[1]); status.textContent = `✨ ${L(it[1], it[2])}!`;
          lock = false;
          if (matched === pairs) { life.later(end, 900); return; }
          T.next(); // hand the turn over, like the other games do after every round
        } else {
          life.later(() => { a.c.classList.remove('flipped'); b.c.classList.remove('flipped'); lock = false; T.next(); status.textContent = L('Дахиад оролдоорой', 'Try again'); }, 950);
        }
      }
      function end() {
        const stars = moves <= pairs * 1.6 ? 3 : moves <= pairs * 2.3 ? 2 : 1;
        ctx.finish({ stars, scores: T.scores, summary: L(`${moves} нүүдэлд бүгдийг олсон`, `Solved in ${moves} moves`) });
      }
      ctx.root.replaceChildren(status, grid);
      cards.forEach((c, k) => (c.style.animationDelay = k * 25 + 'ms'));
      return () => life.stop();
    },
  });
})(window.TG);
