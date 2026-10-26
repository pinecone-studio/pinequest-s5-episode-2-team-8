/* Басар: the AI buddy. A Mongolian Bankhar dog who answers questions and gives heritage quizzes.
   Uses Claude through the Naadamy server (/api/basar) when it is available, and his offline knowledge otherwise. */
(function (TG) {
  const { h, L, tx } = TG;
  const S = TG.store, B = TG.BASAR;
  const api = (TG.basar = { ai: false, checked: false, history: [] });
  const online = () => location.protocol.startsWith('http');

  api.check = () => {
    if (api.checked || !online()) return Promise.resolve(api.ai);
    api.checked = true;
    return fetch('api/basar', { cache: 'no-store' }).then((r) => r.json()).then((d) => (api.ai = !!d.ai)).catch(() => (api.ai = false));
  };
  /** The language a message is written in: Cyrillic means Mongolian, Latin letters mean English. */
  const langOf = (q) => { const c = (String(q).match(/[а-яёөү]/gi) || []).length, l = (String(q).match(/[a-z]/gi) || []).length; return c > l ? 'mn' : l > c ? 'en' : S.state.lang; };
  api.langOf = langOf;
  const LX = (lang, mn, en) => (lang === 'en' ? en : mn);
  /** Simple arithmetic Basar can do offline: "7 x 8", "what is 12 plus 5", "15 хасах 4 хэд вэ". */
  function mathAnswer(q, lang) {
    let t = ' ' + String(q).toLowerCase() + ' ';
    const w = (words, sym) => { t = t.replace(new RegExp('(^|\\s)(' + words + ')(?=\\s|$)', 'g'), ` ${sym} `); };
    t = t.replace(/[=?!,]/g, ' ');
    w("what's|what is|how much is|хэд вэ|хэд болох вэ|хэд болох|хэд|тэнцүү|equals|is", '');
    w('plus|нэмэх нь|нэмэхэд|нэмэх|нэмэл', '+'); w('minus|хасахад|хасах', '-');
    w('multiplied by|times|үржүүлэхэд|үржүүлэх|үржих|x', '*'); w('divided by|хуваахад|хуваах', '/');
    t = t.replace(/[×·]/g, '*').replace(/÷/g, '/');
    const m = t.trim().match(/^(-?\d+(?:\.\d+)?)\s*([-+*/])\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const a = +m[1], b = +m[3], op = m[2];
    if (op === '/' && b === 0) return LX(lang, 'Вуф! Тэгд хувааж болохгүй шүү!', 'Woof! You can’t divide by zero!');
    const r = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b, rs = Number.isInteger(r) ? r : +r.toFixed(3);
    return LX(lang, `Вуф! ${a} ${op === '*' ? '×' : op === '/' ? '÷' : op} ${b} = ${rs}. Сайн бодлоо! 🐾`, `Woof! ${a} ${op === '*' ? '×' : op === '/' ? '÷' : op} ${b} = ${rs}. Nice maths! 🐾`);
  }
  const post = (body) => {
    const p = S.active() || {};
    return fetch('api/basar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: S.state.lang, ...body, name: p.name, age: p.age }) })
      .then((r) => r.json());
  };
  const stats = () => { const p = S.active(); if (!p) return {}; return (p.basar = p.basar || { asked: 0, right: 0, total: 0 }); };

  /** Ask Basar something. Resolves to { text, source: 'ai' | 'offline' }. */
  api.ask = async (question) => {
    api.history.push({ role: 'user', content: question });
    stats().asked = (stats().asked || 0) + 1; S.save();
    TG.villageQuest && TG.villageQuest('basar');
    let text = null, source = 'offline';
    const lang = langOf(question);
    if (api.ai) {
      try { const r = await post({ mode: 'chat', messages: api.history, lang }); if (r.ok) { text = r.reply; source = 'ai'; } else if (r.reason === 'refusal') text = LX(lang, 'Вуф… Энэ талаар ээж аав, багшаасаа асуугаарай. Харин би чамд өөр зүйл ярьж өгье!', 'Woof… please ask a parent or teacher about that one. Ask me something else!'); }
      catch (e) { /* network trouble: fall back below */ }
    }
    if (!text) text = mathAnswer(question, lang);
    if (!text) {
      const a = B.localAnswer(question);
      text = a ? a[lang] || a.mn : LX(lang, 'Вуф! Интернэтгүй үед би Монголын өв соёл болон энгийн тооны бодлогод л хариулж чадна. Энэ асуултыг эмээ, өвөө, ээж, аавдаа асуугаарай! Эсвэл гэр, цагаан идээ, Нууц товчоо, наадмын тухай асуу.',
        'Woof! Without internet I can only answer about Mongolian heritage and simple maths. Ask your grandma, grandpa, mom or dad this one! Or ask me about gers, dairy foods, the Secret History or Naadam.');
    }
    api.history.push({ role: 'assistant', content: text });
    if (api.history.length > 20) api.history.splice(0, api.history.length - 20);
    return { text, source, lang };
  };

  const asked = [];
  /** One quiz question: { question, options[4], answer, explain, source } with plain strings. */
  api.quiz = async (topic) => {
    if (api.ai) {
      try { const r = await post({ mode: 'quiz', topic, avoid: asked }); if (r.ok) { asked.push(r.quiz.question); return { ...r.quiz, source: 'ai' }; } }
      catch (e) { /* fall back */ }
    }
    const q = B.localQuiz(topic, asked);
    asked.push(q.question.mn); if (asked.length > 30) asked.shift();
    return { topic: q.topic, question: tx(q.question), options: q.options.map(tx), answer: q.answer, explain: tx(q.explain), source: 'offline' };
  };

  // ------------------------------------------------------------ UI pieces
  api.face = (mood = 0, size = 56) => {
    const c = h('canvas', { class: 'px-icon basar-face', width: 24, height: 22, style: { width: size + 'px', height: Math.round(size * 22 / 24) + 'px' } });
    c.getContext('2d').drawImage(TG.pixel.bankharFace(mood), 0, 0);
    return c;
  };
  const badge = (source, lang) => h('span', { class: 'b-src ' + source }, source === 'ai' ? 'AI' : (lang || S.state.lang) === 'en' ? 'offline' : 'офлайн');

  /** A quiz card. onDone(correct) is called once after the child answers. */
  api.quizCard = (q, onDone) => {
    let done = false;
    const exp = h('div', { class: 'b-exp hidden' });
    const opts = q.options.map((o, i) => h('button', { class: 'b-opt', onclick: () => {
      if (done) return; done = true;
      const ok = i === q.answer;
      opts.forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
      ok ? (TG.sfx.good(), TG.buzz && TG.buzz(20)) : TG.sfx.bad();
      const st = stats(); st.total = (st.total || 0) + 1; if (ok) st.right = (st.right || 0) + 1;
      if (q.topic) { st.topics = st.topics || {}; const tp = (st.topics[q.topic] = st.topics[q.topic] || { right: 0, total: 0 }); tp.total++; if (ok) tp.right++; }
      S.save(); TG.achievements && TG.achievements.check();
      if (ok) TG.villageQuest && TG.villageQuest('quiz'); // any correct answer counts, in chat, lessons or quiz parties
      exp.replaceChildren(h('b', null, ok ? L('Зөв! Вуф вуф! 🎉', 'Correct! Woof woof! 🎉') : L('Бараг л! Зөв хариулт: ', 'Almost! The answer is: ') + (ok ? '' : q.options[q.answer])), h('p', null, q.explain));
      exp.classList.remove('hidden');
      onDone && onDone(ok);
    } }, h('span', { class: 'b-letter' }, 'АБВГ'[i]), h('span', null, o)));
    return h('div', { class: 'b-quiz' }, h('div', { class: 'b-q' }, q.question, q.source ? badge(q.source) : null), h('div', { class: 'b-opts' }, opts), exp);
  };

  /** Run n quiz questions inside `host`. With several players they take turns; onFinish(right, n, tally). */
  api.runQuiz = (host, topic, n, onFinish, players) => {
    let k = 0, right = 0;
    const multi = players && players.length > 1, tally = (players || [1]).map(() => 0);
    const next = async () => {
      if (k >= n) return onFinish && onFinish(right, n, tally);
      host.replaceChildren(h('div', { class: 'b-think' }, api.face(2, 40), h('span', null, L('Басар бодож байна…', 'Basar is thinking…'))));
      const q = await api.quiz(topic);
      if (!host.isConnected) return;
      const who = multi ? k % players.length : 0;
      k++;
      const nextBtn = h('button', { class: 'btn primary block hidden', onclick: next }, k < n ? L('Дараагийн асуулт →', 'Next question →') : L('Дуусгах', 'Finish'));
      host.replaceChildren(h('div', { class: 'b-count' }, `${k} / ${n}`), multi ? api.turnBadge(players[who]) : null,
        api.quizCard(q, (ok) => { if (ok) { right++; tally[who]++; } nextBtn.classList.remove('hidden'); }), nextBtn);
    };
    next();
  };
  api.turnBadge = (p) => h('div', { class: 'turn-badge' }, h('span', { class: 'tb-e' }, p.emoji), h('b', null, L(`${p.name}-ийн ээлж`, `${p.name}’s turn`)));
  api.scoreboard = (players, tally) => {
    const max = Math.max(...tally);
    return h('div', { class: 'l-score' }, players.map((p, i) => h('div', { class: 'ls-row' + (tally[i] === max && max > 0 ? ' top' : '') }, h('span', null, p.emoji, ' ', p.name), h('b', null, tally[i], tally[i] === max && max > 0 ? ' 👑' : ''))));
  };

  /** Pick who you learn with: alone, with family or with friends. onPick({ mode, players }). */
  api.withPicker = (onPick, opts = {}) => {
    const me = S.active() || { name: '?', avatar: '🙂' }, picked = [];
    let mode = null;
    const box = h('div', { class: 'with-picker' });
    const friends = () => (S.state.friends || []);
    const draw = () => {
      const opt = (m, icon, t1, t2) => h('button', { class: 'with-opt' + (mode === m ? ' on' : ''), onclick: () => { mode = m; picked.length = 0; if (m === 'solo') return go(); draw(); } }, h('span', { class: 'wo-i' }, icon), h('b', null, t1), h('small', null, t2));
      const kids = [
        h('h2', null, opts.title || L('Хэнтэй хамт сурах вэ?', 'Who are you learning with?')),
        h('div', { class: 'with-opts' },
          opt('solo', '🙋', L('Ганцаараа', 'On my own'), L('Өөрөө дадлага хийх', 'Practise alone')),
          opt('family', '👨‍👩‍👧', L('Гэр бүлтэйгээ', 'With family'), L('Ээлжлэн тоглож +½ шагнал', 'Take turns, +50% reward')),
          opt('friends', '🧑‍🤝‍🧑', L('Найзуудтайгаа', 'With friends'), L('Хэн илүү мэдэх вэ?', 'Who knows more?'))),
      ];
      if (mode === 'family' || mode === 'friends') {
        const list = mode === 'family' ? S.state.family.map((f) => ({ name: tx(f.name), emoji: f.emoji })) : friends().map((f) => ({ name: f.name, emoji: f.emoji || '🧒' }));
        kids.push(h('div', { class: 'label' }, mode === 'family' ? L('Хэн хамт байна? (1–3)', 'Who is with you? (1–3)') : L('Ямар найзууд? (1–3)', 'Which friends? (1–3)')),
          h('div', { class: 'fam-chips' }, list.map((f) => { const on = picked.some((x) => x.name === f.name); return h('button', { class: 'fam-chip' + (on ? ' active' : ''), onclick: () => { if (on) picked.splice(picked.findIndex((x) => x.name === f.name), 1); else { if (picked.length >= 3) picked.shift(); picked.push(f); } draw(); } }, f.emoji, ' ', f.name); })));
        if (mode === 'friends') {
          const inp = h('input', { class: 'input', maxlength: 16, placeholder: L('Найзын нэр', 'Friend’s name'), onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') add(); } });
          const add = () => { const n = inp.value.trim(); if (!n) return; S.state.friends = [...friends().filter((f) => f.name !== n), { name: n, emoji: TG.pick(['🧒', '👧', '👦', '🧑']) }].slice(-12); S.save(); picked.push({ name: n, emoji: S.state.friends[S.state.friends.length - 1].emoji }); if (picked.length > 3) picked.shift(); draw(); };
          kids.push(h('div', { class: 'inline add-friend' }, inp, h('button', { class: 'btn', onclick: add }, '+')));
        }
        kids.push(h('button', { class: 'btn primary big block', disabled: !picked.length, onclick: go }, picked.length ? L('Хамтдаа эхлэх ▶', 'Start together ▶') : L('Хамт сурах хүнээ сонго', 'Pick who joins you')));
      }
      box.replaceChildren(...kids);
    };
    const go = () => onPick({ mode, players: [{ name: me.name, emoji: me.avatar }, ...(mode === 'solo' ? [] : picked)] });
    draw();
    return box;
  };
  /** Record that the child learned together (for achievements and the parent dashboard). */
  api.noteTogether = (mode, players, what) => {
    if (!mode || mode === 'solo') return;
    const p = S.active(); if (!p) return;
    p.together = p.together || {}; p.together[mode] = (p.together[mode] || 0) + 1;
    S.logActivity && S.logActivity({ kind: 'together', id: `${what}|${mode}|${players.slice(1).map((x) => x.name).join(', ')}` });
    if (mode === 'family') S.addFamilyStars(2);
    S.save(); TG.achievements && TG.achievements.check();
  };
  /** Quiz party: a few quiz questions in turns with family or friends. */
  api.quizParty = (topic) => {
    const body = h('div');
    const close = TG.modal(body, { cls: 'v-modal basar-modal' });
    body.replaceChildren(api.withPicker(({ mode, players }) => {
      const host = h('div');
      const n = players.length > 1 ? players.length * 2 : 5;
      body.replaceChildren(h('div', { class: 'b-head' }, api.face(0, 48), h('div', null, h('h2', null, L('Басарын асуулт хариулт', 'Basar’s quiz')), h('small', null, TG.BASAR.TOPICS[topic] ? tx(TG.BASAR.TOPICS[topic].name) : L('Холимог сэдэв', 'Mixed topics')))), host);
      api.runQuiz(host, topic, n, (right, total, tally) => {
        const r = TG.villageReward ? TG.villageReward(right * (players.length > 1 ? 6 : 4), right * 6) : null;
        api.noteTogether(mode, players, 'quiz');
        TG.sfx.win(); TG.confetti(50);
        host.replaceChildren(h('div', { class: 'l-done' }, h('div', { class: 'big-emoji' }, '🎯'), h('h2', null, L(`${total} асуултаас ${right} зөв!`, `${right} of ${total} right!`)),
          players.length > 1 ? api.scoreboard(players, tally) : null, r ? h('div', { class: 'l-reward' }, `🪙 +${r.coins} · ⭐ +${r.xp} XP`) : null),
          h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: () => close() }, L('Хаах', 'Close')), h('button', { class: 'btn primary', onclick: () => { close(); api.quizParty(topic); } }, L('Дахин', 'Again'))));
      }, players);
    }, { title: L('Хэнтэй хамт асуулт хариулт тоглох вэ?', 'Who is playing the quiz?') }));
  };

  /** The chat window. opts: { prompt, topic, context } */
  api.open = (opts = {}) => {
    api.check();
    const p = S.active() || { name: '' };
    const log = h('div', { class: 'b-log', 'aria-live': 'polite' });
    const say = (who, content, extra) => {
      const row = h('div', { class: 'b-row ' + who }, who === 'basar' ? api.face(1, 34) : null, h('div', { class: 'b-bubble' }, content, extra || null));
      log.appendChild(row); log.scrollTop = log.scrollHeight;
      if (who === 'basar' && typeof content === 'string' && TG.voice) TG.voice.babble(content, 'basar');
      return row;
    };
    const input = h('input', { class: 'input b-input', maxlength: 300, placeholder: L('Монгол эсвэл англиар асуу…', 'Ask in English or Mongolian…'), 'aria-label': L('Асуулт', 'Question'),
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); } });
    let busy = false;
    async function send(text) {
      const q = (text || input.value).trim(); if (!q || busy) return;
      busy = true; input.value = '';
      say('me', q);
      const wait = say('basar', h('span', { class: 'b-dots' }, h('i'), h('i'), h('i')));
      const r = await api.ask(q);
      wait.remove(); say('basar', r.text, badge(r.source, r.lang)); TG.sfx.pop && TG.sfx.pop();
      busy = false; input.focus();
    }
    async function quizInChat(topic) {
      const holder = say('basar', h('span', { class: 'b-dots' }, h('i'), h('i'), h('i')));
      const q = await api.quiz(topic);
      holder.querySelector('.b-bubble').replaceChildren(api.quizCard(q, (ok) => {
        if (ok) { TG.villageReward && TG.villageReward(5, 8); }
        setTimeout(() => say('basar', L('Дахиад нэг асуулт уу?', 'Another one?'), h('div', { class: 'b-chips' }, h('button', { class: 'chip', onclick: () => quizInChat(topic) }, L('Тийм! 🎯', 'Yes! 🎯')))), 500);
      }));
      log.scrollTop = log.scrollHeight;
    }
    const topics = h('div', { class: 'b-chips' }, Object.entries(B.TOPICS).map(([k, t]) => h('button', { class: 'chip', onclick: () => quizInChat(k) }, t.icon, ' ', tx(t.name))));
    const suggest = h('div', { class: 'b-chips' }, B.SUGGEST.map((s) => h('button', { class: 'chip', onclick: () => send(tx(s)) }, tx(s))));
    const status = h('span', { class: 'b-status' });
    const drawStatus = () => (status.textContent = api.ai ? L('● AI ухаантай', '● AI smart mode') : L('○ Офлайн мэдлэг', '○ Offline knowledge'));
    drawStatus(); api.check().then(drawStatus);

    TG.modal(h('div', { class: 'basar-chat' },
      h('div', { class: 'b-head' }, api.face(0, 64), h('div', null, h('h2', null, L('Басар', 'Basar')), h('small', null, L('Монгол банхар нохой · Таны сурах найз', 'Mongolian Bankhar · your learning buddy')), status)),
      log,
      h('div', { class: 'b-tray' },
        h('div', { class: 'b-tray-l' }, L('Асуулт хариулт:', 'Quiz me on:')), topics,
        h('div', { class: 'b-tray-l' }, L('Асууж болох зүйлс:', 'Try asking:')), suggest),
      h('div', { class: 'b-send' }, input, h('button', { class: 'btn primary', onclick: () => send(), 'aria-label': L('Илгээх', 'Send') }, '➤'))), { cls: 'v-modal basar-modal' });

    say('basar', opts.context || L(`Вуф! Сайн уу, ${p.name}! Би Басар. Юу ч асуугаарай: Монголын түүх, Нууц товчоо, гэр, байгаль, тоо бодлого… Монголоор ч, англиар ч ойлгоно. Эсвэл доороос сэдэв сонгоод асуулт хариулт тоглоорой!`,
      `Woof! Hi ${p.name}! I’m Basar. Ask me anything: Mongolian history, the Secret History, gers, nature, maths… I understand English and Mongolian. Or pick a topic below for a quiz!`));
    if (opts.topic) quizInChat(opts.topic);
    if (opts.prompt) send(opts.prompt);
    setTimeout(() => input.focus(), 250);
  };
})(window.TG);
