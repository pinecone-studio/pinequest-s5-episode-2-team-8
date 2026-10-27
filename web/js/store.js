/* Local-only storage: profiles live on this device. Only Basar's questions go to the server (without names saved). */
(function (TG) {
  const KEY = 'naadamy.v1';
  const OLD_KEY = 'togloom.v1'; // name before the app was renamed to Naadamy
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const saveListeners = new Set();

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
    settings: { sound: true, bigText: false, reduceMotion: false },
    familyStars: 0,
    friends: [],
    missions: {},
    log: [],
  });

  function load() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw && (raw = localStorage.getItem(OLD_KEY))) { localStorage.setItem(KEY, raw); localStorage.removeItem(OLD_KEY); } // keep progress after the rename
      if (raw) {
        const s = JSON.parse(raw), d = defaults();
        delete s.usage; delete s.extend; if (s.settings) delete s.settings.screenLimit; // the screen-time limit was removed
        return Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) });
      }
    } catch (e) { /* corrupted or blocked storage: start fresh */ }
    return defaults();
  }

  TG.store = {
    KEY,
    state: load(),
    dkey,
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* storage full/blocked */ }
      for (const listener of saveListeners) listener();
    },
    onSave(listener) {
      if (typeof listener !== 'function') throw new TypeError('Save listener must be a function');
      saveListeners.add(listener);
      return () => saveListeners.delete(listener);
    },
    active() { return this.state.profiles.find((p) => p.id === this.state.activeId) || this.state.profiles[0] || null; },
    ageGroupOf(age) { return age <= 6 ? '3-6' : age <= 10 ? '7-10' : age <= 14 ? '11-14' : '15-18'; },
    addProfile({ name, age, avatar, code, aimag }) {
      const p = { id: 'p' + Date.now().toString(36), name, age, avatar, code: code || null, aimag: aimag || null, learn: {}, basar: { asked: 0, right: 0, total: 0 }, created: dkey() };
      this.state.profiles.push(p); this.state.activeId = p.id; this.save(); return p;
    },
    removeProfile(id) {
      this.state.profiles = this.state.profiles.filter((p) => p.id !== id);
      if (this.state.activeId === id) this.state.activeId = this.state.profiles[0] ? this.state.profiles[0].id : null;
      this.save();
    },
    logActivity({ kind, id }) {
      const p = this.active();
      this.state.log.push({ d: dkey(), ts: Date.now(), k: kind, id, pid: p && p.id });
      if (this.state.log.length > 2000) this.state.log.splice(0, this.state.log.length - 2000);
      this.save();
    },
    addFamilyStars(n) { this.state.familyStars += n; this.save(); },
  };
})(window.TG);
