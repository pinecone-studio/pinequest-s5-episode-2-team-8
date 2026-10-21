/* 3–14: movement break with Mongolian-inspired moves (eagle dance, archer...) */
(function (TG) {
  const { h, L } = TG;
  const MOVES = [
    { e: '🦅', mn: 'Бөхийн дэвээ', en: 'Wrestler\'s eagle dance', dmn: 'Гараа далавч шиг дэлгээд бүргэд шиг дэв!', den: 'Spread your arms like wings and dance like an eagle!' },
    { e: '🐎', mn: 'Морь шиг давхи', en: 'Gallop like a horse', dmn: 'Байрандаа давхиж, "Чү! Чү!" гэж хашгир!', den: 'Gallop in place and shout "Chüü! Chüü!"' },
    { e: '🐫', mn: 'Тэмээ шиг алх', en: 'Walk like a camel', dmn: 'Удаан, том алхаагаар өрөөгөөр алх.', den: 'Take slow, giant steps around the room.' },
    { e: '🐸', mn: 'Мэлхий шиг үсэр', en: 'Jump like a frog', dmn: 'Суугаад, дээш нь 10 удаа үсэр!', den: 'Squat down, then jump up 10 times!' },
    { e: '🌳', mn: 'Мод шиг зогс', en: 'Stand like a tree', dmn: 'Нэг хөл дээрээ зогсоод тэнцвэрээ барь.', den: 'Stand on one leg and keep your balance.' },
    { e: '🏹', mn: 'Сур харваач', en: 'Be an archer', dmn: 'Нум татаж байгаа мэт сунал. Баруун, зүүн тийш 5 удаа.', den: 'Stretch like pulling a bow. 5 times each side.' },
    { e: '☀️', mn: 'Нарыг барь', en: 'Catch the sun', dmn: 'Хөлийнхөө үзүүр дээр зогсоод гараа дээш сунга.', den: 'Stand on tiptoes and reach up high.' },
    { e: '💃', mn: 'Гэр бүлийн бүжиг', en: 'Family dance', dmn: 'Хамтдаа дуулж, бүжиглээрэй!', den: 'Sing and dance together!' },
    { e: '🐻', mn: 'Баавгай шиг мөлх', en: 'Crawl like a bear', dmn: 'Гар, хөл дээрээ мөлхөж өрөөг тойр.', den: 'Crawl on hands and feet around the room.' },
  ];
  TG.registerGame({
    id: 'move', icon: '🤸', pillar: 'health', ages: ['3-6', '7-10', '11-14'],
    title: { mn: 'Хөдөлгөөнт завсарлага', en: 'Move break' },
    desc: { mn: 'Дэлгэцээс босоод хамтдаа хөдөлцгөөе!', en: 'Get up from the screen and move together!' },
    realLife: { mn: 'Маргааш өглөө гэр бүлээрээ 5 минутын дасгал хийгээд өдрөө эхлүүлээрэй.', en: 'Start tomorrow morning with a 5-minute family workout.' },
    start(ctx) {
      const life = TG.lifecycle();
      const list = TG.shuffle(MOVES).slice(0, 5);
      const secs = ctx.ageGroup === '3-6' ? 15 : 20;
      let i = 0, left = secs, paused = false, done = 0, moving = false;
      const card = h('div', { class: 'move-card pop' });
      const ring = h('div', { class: 'ring' });
      const pauseBtn = h('button', { class: 'btn ghost', onclick: () => { paused = !paused; pauseBtn.textContent = paused ? '▶ ' + L('Үргэлжлүүлэх', 'Resume') : '⏸ ' + L('Түр зогс', 'Pause'); } }, '⏸ ' + L('Түр зогс', 'Pause'));
      const skipBtn = h('button', { class: 'btn ghost', onclick: () => nextMove(true) }, L('Алгасах ⏭', 'Skip ⏭'));
      const show = () => {
        const m = list[i]; left = secs;
        card.replaceChildren(h('div', { class: 'move-e' }, m.e), h('h2', null, L(m.mn, m.en)), h('p', null, L(m.dmn, m.den)));
        card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
        drawRing(); TG.sfx.chime();
      };
      const drawRing = () => { ring.style.setProperty('--p', (left / secs) * 100); ring.textContent = left; };
      // A move only counts when the child actually did it: skipping through all
      // five must not earn the same stars as completing all five.
      const nextMove = (skipped) => {
        if (moving) return; moving = true;
        if (!skipped) done++;
        i++;
        if (i >= list.length) {
          life.stop();
          const r = done / list.length;
          ctx.finish({ stars: r >= 0.8 ? 3 : r >= 0.5 ? 2 : 1, summary: L(`${done}/${list.length} хөдөлгөөн хийлээ 💪`, `${done}/${list.length} moves done 💪`) });
          return;
        }
        moving = false;
        show();
      };
      life.every(() => { if (paused) return; left--; drawRing(); if (left <= 3 && left > 0) TG.sfx.tick(); if (left <= 0) nextMove(false); }, 1000);
      ctx.hud.replaceChildren(h('div', { class: 'hud-pill' }, ctx.together ? '🤝 ' + L('Бүгдээрээ!', 'Everyone!') : '💪'));
      ctx.root.replaceChildren(card, ring, h('div', { class: 'row-btns' }, pauseBtn, skipBtn));
      show();
      return () => life.stop();
    },
  });
})(window.TG);
