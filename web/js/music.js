/* Background music: shuffled playlist from assets/music/playlist.json with gentle crossfades.
   Starts after the first tap (browsers block sound before that) and pauses when the app is hidden. */
(function (TG) {
  const S = TG.store;
  const FADE = 1500;
  let tracks = [], order = [], idx = -1, cur = null, loaded = false, started = false, listeners = [];
  const settings = () => S.state.settings;
  const enabled = () => settings().music !== false && settings().sound !== false;
  const volume = () => (typeof settings().musicVolume === 'number' ? settings().musicVolume : 0.35);
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });

  async function load() {
    if (loaded) return tracks.length > 0;
    loaded = true;
    try {
      const r = await fetch('assets/music/playlist.json', { cache: 'no-cache' });
      const j = await r.json();
      tracks = (j.tracks || []).filter((t) => t && typeof t.file === 'string' && /^[\w.\- ()]+\.(mp3|ogg|m4a|wav)$/i.test(t.file));
    } catch (e) { tracks = []; }
    if (!tracks.length) loaded = false; // e.g. the server was off: try again on the next tap instead of staying silent
    order = tracks.map((_, i) => i).sort(() => Math.random() - 0.5);
    emit();
    return tracks.length > 0;
  }
  function fade(audio, to, ms, done) {
    const from = audio.volume, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); audio.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (done) done(); };
    requestAnimationFrame(step);
  }
  function playNext() {
    if (!tracks.length || !enabled()) return;
    idx = (idx + 1) % order.length;
    const t = tracks[order[idx]];
    const a = new Audio('assets/music/' + encodeURIComponent(t.file));
    const repeats = Math.max(1, Math.min(4, t.repeat | 0 || 1));
    let loops = 0, lastT = 0, handed = false;
    a.preload = 'auto'; a.volume = 0; a.loop = repeats > 1;
    const handOff = () => { if (!handed && cur === a) { handed = true; playNext(); } };
    // short loops repeat seamlessly; near the end of the last repeat we crossfade into the next song
    a.addEventListener('timeupdate', () => {
      if (a.currentTime < lastT - 1) loops++;
      lastT = a.currentTime;
      if (loops >= repeats - 1) a.loop = false;
      if (!a.loop && a.duration && a.duration - a.currentTime < FADE / 1000 + 0.25) handOff();
    });
    a.addEventListener('ended', handOff);
    a.addEventListener('error', () => { if (cur === a) setTimeout(handOff, 500); });
    const old = cur; cur = a;
    a.play().then(() => { fade(a, volume(), FADE); emit(); }).catch(() => { started = false; cur = old; });
    if (old) fade(old, 0, FADE, () => old.pause());
  }
  async function start() {
    if (started || !enabled()) return;
    if (!(await load())) return;
    started = true;
    if (cur && cur.paused) { cur.play().then(() => fade(cur, volume(), FADE)).catch(() => {}); emit(); return; }
    if (!cur) playNext();
  }
  function stop() { started = false; if (cur) { const a = cur; fade(a, 0, 600, () => a.pause()); } emit(); }

  TG.music = {
    load,
    get available() { return tracks.length > 0; },
    get playing() { return !!cur && !cur.paused && started; },
    get title() { const t = cur && tracks[order[idx]]; return t ? `${t.title || t.file}${t.artist ? ' — ' + t.artist : ''}` : ''; },
    toggle() { settings().music = !(settings().music !== false); S.save(); if (enabled()) { started = false; start(); } else stop(); emit(); },
    next() { if (started) playNext(); },
    setVolume(v) { settings().musicVolume = Math.max(0, Math.min(1, v)); S.save(); if (cur) cur.volume = settings().musicVolume; },
    onChange(f) { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; },
    credits: () => tracks.map((t) => ({ title: t.title || t.file, artist: t.artist || '', license: t.license || '', source: t.source || '' })),
  };

  // start on the first user gesture; pause in the background
  const first = () => { start(); };
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, first, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!cur) return;
    if (document.hidden) cur.pause();
    else if (started && enabled()) cur.play().catch(() => {});
  });
  load();
})(window.TG);
