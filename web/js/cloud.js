/* Cloud save: a child's progress outside the wallet (character, lessons, badges, passport stamps, Mongol script, the
   historian's quest) in the shared shape of rules.js (cleanCloud/mergeCloud). The village connection uploads it and takes
   back the server's merged copy, so it follows the child to another device; the family login brings it along too. */
(function (TG) {
  const R = TG.vrules;

  /** A profile's progress in the shared cloud shape. */
  function of(p) {
    const learn = {};
    for (const [id, l] of Object.entries(p.learn || {})) if (l) learn[id] = { done: !!l.done, best: l.best || 0, family: l.family || 0 };
    return R.cleanCloud({
      eth: p.eth || '', aimag: p.aimag || '', charAt: p.charAt || 0,
      learn, ach: p.ach || {}, stamps: (p.passport && p.passport.stamps) || {},
      bichig: (p.bichig && p.bichig.s) || {}, bichigMem: (p.bichig && p.bichig.mem) || {},
      hist: (p.hist && p.hist.step) || 0,
    });
  }

  /** Brings a cloud copy into the profile: only adds (done, higher scores, new badges and stamps); a newer character replaces
   *  this one. True when anything changed. */
  function apply(p, cloud) {
    const before = JSON.stringify(of(p)), c = R.mergeCloud(of(p), cloud);
    if (JSON.stringify(c) === before) return false;
    if (c.charAt >= (p.charAt || 0) && (c.eth || c.aimag)) { p.eth = c.eth || p.eth; p.aimag = c.aimag || p.aimag; p.charAt = c.charAt; }
    p.learn = p.learn || {};
    for (const [id, l] of Object.entries(c.learn)) {
      const mine = p.learn[id] || (p.learn[id] = {});
      if (l.done) mine.done = true;
      if (l.best > (mine.best || 0)) mine.best = l.best;
      if (l.family > (mine.family || 0)) mine.family = l.family;
    }
    p.ach = Object.assign(p.ach || {}, c.ach);
    p.passport = p.passport || { stamps: {} }; p.passport.stamps = Object.assign(p.passport.stamps || {}, c.stamps);
    p.bichig = p.bichig || { s: {}, mem: {} };
    p.bichig.s = Object.assign(p.bichig.s || {}, c.bichig); p.bichig.mem = Object.assign(p.bichig.mem || {}, c.bichigMem);
    if (c.hist > ((p.hist && p.hist.step) || 0)) p.hist = { step: c.hist, done: false }; // a later task: start it fresh
    return true;
  }

  TG.cloud = { of, apply };
})(window.TG);
