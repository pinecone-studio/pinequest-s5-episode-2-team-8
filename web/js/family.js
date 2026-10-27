/* Family login: the family code a grown-up makes, which lets a child log in on another device with their 3 secret pictures
   and play as the same child there (same coins, XP and clothes). The server keeps only a hash of the pictures. */
(function (TG) {
  const { L } = TG;
  const S = TG.store;

  async function api(body) {
    if (location.protocol === 'file:') return { ok: false, reason: 'offline' };
    try {
      const r = await fetch('api/family', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return await r.json();
    } catch (e) { return { ok: false, reason: 'offline' }; }
  }

  /** A picture password as the app stores it ("🐎🥛🌙") → the indexes the server uses ([1, 2, 4]), or null. */
  function picIndexes(code) {
    const out = []; let rest = code || '';
    while (rest && out.length < 4) {
      const i = TG.PIC_KEYS.findIndex((k) => rest.startsWith(k));
      if (i < 0) return null;
      out.push(i); rest = rest.slice(TG.PIC_KEYS[i].length);
    }
    return out.length === 3 ? out : null;
  }
  const picCode = (indexes) => indexes.map((i) => TG.PIC_KEYS[i]).join('');
  const showCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
  const avatarIndex = (emoji) => Math.max(0, TG.MASCOTS.findIndex((m) => m.e === emoji));

  function why(result) {
    switch (result.reason) {
      case 'offline': return L('Сервертэй холбогдож чадсангүй. Интернэтээ шалгаарай.', 'Could not reach the server. Check the internet.');
      case 'no-family': return L('Ийм гэр бүлийн код олдсонгүй.', 'No family has this code.');
      case 'full': return L('Нэг гэр бүлд 8 хүртэл хүүхэд байна.', 'A family can have up to 8 children.');
      case 'wrong': return L(`Зураг буруу байна. ${result.left} оролдлого үлдлээ.`, `Wrong pictures. ${result.left} tries left.`);
      case 'locked': return L(`Олон удаа буруу дарлаа. ${Math.ceil(result.wait / 60)} минутын дараа дахин оролдоорой.`, `Too many wrong tries. Try again in ${Math.ceil(result.wait / 60)} minutes.`);
      case 'busy': return L('Хэт олон оролдлого. Түр хүлээгээрэй.', 'Too many tries. Wait a moment.');
      case 'identity': return L('Энэ профайлыг сервер танисангүй.', 'The server did not recognise this profile.');
      default: return L('Алдаа гарлаа. Дахин оролдоорой.', 'Something went wrong. Try again.');
    }
  }

  /** Adds a profile (that has its 3 pictures) to this device's family, or makes the family with it. */
  async function link(p) {
    const pics = picIndexes(p.code);
    if (!pics) return { ok: false, reason: 'pictures' };
    const identity = TG.villageIdentity(p);
    if (!identity.ticket) return { ok: false, reason: 'error', text: identity.why };
    const code = S.state.familyCode;
    const result = await api({ act: code ? 'join' : 'create', code, ...identity, name: p.name, age: p.age, avatar: avatarIndex(p.avatar), pics });
    if (result.ok) { S.state.familyCode = result.code; p.fam = result.code; S.save(); }
    return result;
  }

  /** The child picked on the family list logs in: the existing profile on this device, or a new one for this child. */
  async function login(code, member, pics) {
    const result = await api({ act: 'login', code, id: member.id, pics });
    if (!result.ok) return result;
    let p = S.state.profiles.find((x) => x.village && x.village.id === result.id);
    if (!p) {
      const mascot = TG.MASCOTS[result.avatar] || TG.MASCOTS[0];
      p = S.addProfile({ name: result.name, age: result.age, avatar: mascot.e, code: picCode(pics) });
      TG.villageJoinIdentity(p, result.id, result.ticket);
    } else {
      p.village.ticket = result.ticket; // this device's own ticket; the old one may have been lost
      p.code = picCode(pics);
    }
    p.fam = result.code;
    S.state.familyCode = result.code;
    S.save();
    return { ok: true, profile: p };
  }

  TG.family = { api, link, login, why, picIndexes, picCode, showCode, avatarIndex };
})(window.TG);
