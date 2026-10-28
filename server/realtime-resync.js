'use strict';
/** Every player id an instance holds in memory: sockets, remote players, chat lines, ger lot owners, here and in the saved copy. */
function heldIds(rooms, saved, localIds) {
  const ids = new Set(localIds);
  const add = (state) => {
    if (!state || typeof state !== 'object') return;
    if (Array.isArray(state.chat)) for (const line of state.chat) if (line && typeof line.id === 'string') ids.add(line.id);
    if (Array.isArray(state.lots)) for (const lot of state.lots) if (lot && typeof lot.by === 'string') ids.add(lot.by);
  };
  for (const r of rooms.values()) {
    for (const id of r.players.keys()) ids.add(id);
    for (const id of r.remotePlayers.keys()) ids.add(id);
    add(r);
  }
  for (const state of Object.values(saved)) add(state);
  return [...ids];
}

/** After the LISTEN connection came back, NOTIFYs sent while it was down are lost. Re-derive the two that matter from the database and
 *  feed them to the normal event handler: families erased meanwhile (else this instance would save their chat, lots and wallets back), and
 *  who is online in the rooms that have a player here (else leaves/joins stay missing until each player next moves).
 *  `handle` is the realtime event handler; for family-erased it returns a promise that ends when the scrub has run. */
async function resyncRealtime({ roomStore, rooms, saved, localIds, handle }) {
  const ids = heldIds(rooms, saved(), localIds());
  const erased = new Set(ids.length ? await roomStore.erasedAmong(ids) : []);
  if (erased.size) await handle({ t: 'family-erased', ids: [...erased] });
  for (const r of [...rooms.values()]) {
    if (!r.players.size) continue;
    let online;
    for (let tries = 0; tries < 3; tries++) { // a join/leave event arriving while we ask would make the answer stale
      const rev = r.presenceRev || 0;
      online = new Map((await roomStore.listPresence(r.code)).filter((player) => !erased.has(player.id)).map((player) => [player.id, player]));
      if ((r.presenceRev || 0) === rev) break;
    }
    for (const id of [...r.remotePlayers.keys()]) {
      if (!online.has(id) && !erased.has(id)) handle({ room: r.code, instanceId: '', message: { t: 'leave', id } });
    }
    for (const [id, player] of online) {
      if (!r.players.has(id) && !r.remotePlayers.has(id)) handle({ room: r.code, instanceId: '', message: { t: 'join', p: player } });
    }
  }
}

module.exports = { resyncRealtime };
