/* 7–18: split-screen math duel (two players face each other across one phone) */
(function (TG) {
  const { h, L } = TG;
  const R = TG.rand;
  function genQ(ag) {
    const young = ag === '3-6' || ag === '7-10';
    const t = young ? TG.pick(['+', '+', '-', '×']) : TG.pick(['×', '÷', '+', '-', '%', 'neg']);
    let text, ans;
    if (t === '+') { const [a, b] = young ? [R(1, 15), R(1, 15)] : [R(15, 99), R(15, 99)]; text = `${a} + ${b}`; ans = a + b; }
    else if (t === '-') { const a = young ? R(5, 20) : R(30, 120); const b = young ? R(1, a) : R(10, a); text = `${a} − ${b}`; ans = a - b; }
    else if (t === '×') { const [a, b] = young ? [R(2, 5), R(1, 10)] : [R(3, 12), R(3, 12)]; text = `${a} × ${b}`; ans = a * b; }
    else if (t === '÷') { const b = R(2, 12), c = R(2, 12); text = `${b * c} ÷ ${b}`; ans = c; }
    else if (t === '%') { const p = TG.pick([10, 20, 25, 50]), base = TG.pick([40, 60, 80, 100, 120, 200]); text = L(`${base}-ийн ${p}%`, `${p}% of ${base}`); ans = (base * p) / 100; }
    else { const a = R(1, 15), b = R(a + 1, 25); text = `${a} − ${b}`; ans = a - b; }
    const opts = new Set([ans]);
    while (opts.size < 4) { const x = ans + TG.pick([-10, -5, -3, -2, -1, 1, 2, 3, 5, 10]); if (!young || x >= 0) opts.add(x); }
    return { text, ans, opts: TG.shuffle([...opts]) };
  }

  TG.registerGame({
    id: 'mathduel', icon: '⚡', pillar: 'edu', ages: ['7-10', '11-14', '15-18'], maxPlayers: 2,
    title: { mn: 'Тооны тулаан', en: 'Math duel' },
    desc: { mn: 'Нэг утсыг хоёр талаас! Хэн нь хурдан бодох вэ?', en: 'One phone, two sides! Who solves faster?' },
    realLife: { mn: 'Дэлгүүр орохдоо нийт үнийг хэн нь түрүүлж цээжээр бодохыг уралдаарай.', en: 'At the shop, race to add up the total price in your heads.' },
    start(ctx) {
      const life = TG.lifecycle();
      return ctx.players.length >= 2 ? duel(ctx, life) : solo(ctx, life);
    },
  });

  function duel(ctx, life) {
    const players = ctx.players.slice(0, 2);
    const scores = [0, 0], total = 10;
    let qi = 0, q, locked = false;
    const counter = h('div', { class: 'hud-pill' });
    ctx.hud.replaceChildren(counter);
    const panels = players.map((p, i) => {
      const score = h('b', { class: 'dp-score' }, '0');
      const qEl = h('div', { class: 'dp-q' });
      const grid = h('div', { class: 'dp-grid' });
      const el = h('div', { class: 'duel-panel' + (i === 1 ? ' flipped' : ''), style: { '--pc': p.color } },
        h('div', { class: 'dp-head' }, h('span', null, p.emoji, ' ', p.name), score), qEl, grid);
      return { el, score, qEl, grid, frozen: false };
    });
    const next = () => {
      if (qi >= total) {
        // grade the child (players[0]) on the questions they answered, like the solo mode
        const r = scores[0] / total;
        return ctx.finish({
          stars: r >= 0.8 ? 3 : r >= 0.5 ? 2 : 1,
          scores, players,
          summary: L(`Тулаан: ${scores[0]} – ${scores[1]}`, `Duel: ${scores[0]} – ${scores[1]}`),
        });
      }
      q = genQ(ctx.ageGroup); locked = false; qi++;
      counter.textContent = `${L('Асуулт', 'Question')} ${qi}/${total}`;
      panels.forEach((pn, i) => {
        pn.el.classList.remove('win', 'lose');
        pn.qEl.textContent = q.text + ' = ?';
        pn.grid.replaceChildren(...q.opts.map((o) => h('button', { class: 'dp-btn', onclick: (e) => answer(i, o, e.currentTarget) }, o)));
      });
    };
    const answer = (i, o, btn) => {
      const pn = panels[i];
      if (locked || pn.frozen) return;
      if (o === q.ans) {
        locked = true; scores[i]++; pn.score.textContent = scores[i];
        btn.classList.add('right'); pn.el.classList.add('win'); panels[1 - i].el.classList.add('lose');
        panels[1 - i].qEl.textContent = `${q.text} = ${q.ans}`;
        TG.sfx.good(); life.later(next, 1000);
      } else {
        TG.sfx.bad(); btn.classList.add('wrong'); pn.frozen = true; pn.el.classList.add('frozen');
        life.later(() => { pn.frozen = false; pn.el.classList.remove('frozen'); }, 1300);
      }
    };
    ctx.root.replaceChildren(h('div', { class: 'duel' }, panels[1].el, h('div', { class: 'duel-mid' }, '⚡'), panels[0].el));
    next();
    return () => life.stop();
  }

  function solo(ctx, life) {
    let left = 60, score = 0, q;
    const pill = h('div', { class: 'hud-pill' });
    ctx.hud.replaceChildren(pill);
    const upd = () => (pill.textContent = `⏱ ${left}s · ⭐ ${score}`);
    const qEl = h('div', { class: 'dp-q solo' }), grid = h('div', { class: 'dp-grid' });
    const next = () => {
      q = genQ(ctx.ageGroup); qEl.textContent = q.text + ' = ?';
      grid.replaceChildren(...q.opts.map((o) => h('button', {
        class: 'dp-btn', onclick: (e) => {
          if (o === q.ans) { score++; TG.sfx.good(); upd(); next(); }
          else { TG.sfx.bad(); e.currentTarget.classList.add('wrong'); e.currentTarget.disabled = true; }
        },
      }, o)));
    };
    life.every(() => {
      left--; upd(); if (left <= 5 && left > 0) TG.sfx.tick();
      if (left <= 0) { life.stop(); const young = ctx.ageGroup === '7-10'; ctx.finish({ stars: score >= (young ? 12 : 10) ? 3 : score >= (young ? 6 : 5) ? 2 : 1, summary: L(`60 секундэд ${score} зөв хариулт`, `${score} correct in 60 seconds`) }); }
    }, 1000);
    ctx.root.replaceChildren(h('div', { class: 'duel-panel solo', style: { '--pc': ctx.players[0].color } },
      h('p', { class: 'prompt' }, L('60 секундэд аль болох олон бодлого бод! Дараа нь гэр бүлээ тулаанд урь ⚡', 'Solve as many as you can in 60 seconds! Then challenge your family ⚡')), qEl, grid));
    upd(); next();
    return () => life.stop();
  }
})(window.TG);
