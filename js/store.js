/* Local-only storage. No account, no server: family data never leaves the device. */
(function (TG) {
  const KEY = 'naadamy.v1';
  const OLD_KEY = 'togloom.v1'; // name before the app was renamed to Naadamy
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const defaults = () => ({
    lang: 'mn',
    profiles: [],
    activeId: null,
    family: [
      { id: 'f1', name: { mn: 'Ээж', en: 'Mom' }, emoji: '👩' },
      { id: 'f2', name: { mn: 'Аав', en: 'Dad' }, emoji: '👨' },
      { id: 'f3', name: { mn: 'Эмээ', en: 'Grandma' }, emoji: '👵' },
      { id: 'f4', name: { mn: 'Өвөө', en: 'Grandpa' }, emoji: '👴' },
      { id: 'f5', name: { mn: 'Ах, эгч', en: 'Sibling' }, emoji: '🧑' },
      { id: 'f6', name: { mn: 'Найз', en: 'Friend' }, emoji: '🧒' },
    ],
    settings: { screenLimit: 45, sound: true, bigText: false, reduceMotion: false },
    familyStars: 0,
    missions: {},
    log: [],
    usage: {},
    extend: null,
  });

  function load() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw && (raw = localStorage.getItem(OLD_KEY))) { localStorage.setItem(KEY, raw); localStorage.removeItem(OLD_KEY); } // keep progress after the rename
      if (raw) {
        const s = JSON.parse(raw), d = defaults();
        return Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) });
      }
    } catch (e) { /* corrupted or blocked storage: start fresh */ }
    return defaults();
  }

  TG.store = {
    KEY,
    state: load(),
    dkey,
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* storage full/blocked */ } },
    active() { return this.state.profiles.find((p) => p.id === this.state.activeId) || this.state.profiles[0] || null; },
    ageGroupOf(age) { return age <= 6 ? '3-6' : age <= 10 ? '7-10' : age <= 14 ? '11-14' : '15-18'; },
    addProfile({ name, age, avatar }) {
      const p = { id: 'p' + Date.now().toString(36), name, age, avatar, stars: { health: 0, edu: 0, skills: 0 }, created: dkey() };
      this.state.profiles.push(p); this.state.activeId = p.id; this.save(); return p;
    },
    removeProfile(id) {
      this.state.profiles = this.state.profiles.filter((p) => p.id !== id);
      if (this.state.activeId === id) this.state.activeId = this.state.profiles[0] ? this.state.profiles[0].id : null;
      this.save();
    },
    record({ gameId, pillar, stars, together, seconds }) {
      const p = this.active();
      if (p) p.stars[pillar] = (p.stars[pillar] || 0) + stars;
      if (together) this.state.familyStars += stars;
      this.state.log.push({ d: dkey(), ts: Date.now(), g: gameId, p: pillar, s: stars, t: together ? 1 : 0, sec: Math.round(seconds), pid: p && p.id });
      if (this.state.log.length > 3000) this.state.log.splice(0, this.state.log.length - 3000);
      this.save();
      return TG.onGameRecorded ? TG.onGameRecorded({ stars, together, gameId }) : null; // village coins + XP
    },
    addFamilyStars(n) { this.state.familyStars += n; this.save(); },
    missionDoneToday(id) { return this.state.missions[id] === dkey(); },
    completeMission(id) { this.state.missions[id] = dkey(); this.state.familyStars += 3; this.save(); return TG.onMissionDone ? TG.onMissionDone() : null; },
    usageToday() { return this.state.usage[dkey()] || 0; },
    extraToday() { const e = this.state.extend; return e && e.d === dkey() ? e.sec : 0; },
    tick(sec) { const k = dkey(); this.state.usage[k] = (this.state.usage[k] || 0) + sec; this.save(); },
  };
})(window.TG);
