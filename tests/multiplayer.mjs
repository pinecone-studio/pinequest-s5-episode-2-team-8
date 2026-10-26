// Multiplayer test: starts server.js, opens two separate players in the village,
// and checks they see each other, share the village, and can talk with preset phrases.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = process.env.ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const dataDir = mkdtempSync(join(tmpdir(), 'naadamy-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(150); } throw new Error(`timed out waiting for: ${label}`); };

const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, HEARTBEAT_MS: '600' }, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
const port = await new Promise((res, rej) => { server.on('message', (m) => m.port && res(m.port)); server.on('exit', (c) => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server did not start')), 8000); });
// connect over the computer's Wi-Fi address like a second device would (falls back to localhost without a network)
const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
const base = `http://${lan ? lan.address : 'localhost'}:${port}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
const errors = [];
const results = [`(connected over ${base})`];
const ok = (label) => { results.push('✓ ' + label); };

async function player(name, look, room, ctxIn) {
  const ctx = ctxIn || await browser.createBrowserContext();       // separate storage = separate person
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
  if (ctxIn) await page.evaluate(() => TG.go('village'));   // same storage: the same profile again
  else await page.evaluate((name, look, room) => {
    localStorage.clear();
    const p = TG.store.addProfile({ name, age: 9, avatar: '🐎' }); TG.store.state.loggedIn = true;
    TG.store.state.settings.sound = false;
    const owned = ['deel-blue', 'deel-red', 'deel-green', 'hat-mongol', 'hat-flower', 'pet-lamb', 'neck-khadag'];
    p.village = { tips: true, tutorial: true, look, owned, xp: 200, coins: 600, room: room || 'NUTAG' };
    TG.go('village');
  }, name, look, room);
  await until(() => page.evaluate(() => TG._village.live() && TG._village.live().online), `${name} online`);
  if (!(await page.evaluate(() => TG._village.live().serverV === TG.vrules.VERSION))) throw new Error('the server and the game report different versions');
  return page;
}

try {
  const a = await player('Бат', { deel: 'red', hat: 'mongol', pet: 'lamb' });
  const b = await player('Сарнай', { deel: 'green', hat: 'flower', neck: 'khadag' });
  ok('both players connected to the server');
  const walletBefore = await a.evaluate(() => {
    const v = TG.store.active().village;
    return { coins: v.coins, xp: v.xp, revision: TG._village.live().walletRevision };
  });
  if (walletBefore.coins !== 600 || walletBefore.xp !== 200 || walletBefore.revision !== 0) throw new Error('the server did not initialize the migrated wallet');
  await a.evaluate(() => TG.villageReward(12, 7));
  await until(() => a.evaluate(() => TG._village.live().walletRevision === 1), 'server confirms reward');
  const rewardedWallet = await a.evaluate(() => ({ coins: TG.store.active().village.coins, xp: TG.store.active().village.xp }));
  if (rewardedWallet.coins !== 612 || rewardedWallet.xp !== 207) throw new Error('the server did not persist the wallet reward');
  const food = await a.evaluate(async () => {
    const item = TG.FOODS.find((entry) => entry.price > 0);
    const ok = await TG.villageEat(item.id), v = TG.store.active().village, live = TG._village.live();
    return { ok, price: item.price, coins: v.coins, xp: v.xp, revision: live.walletRevision, online: live.online };
  });
  if (!food.ok) throw new Error(`a valid wallet purchase was rejected: ${JSON.stringify(food)}`);
  await until(() => a.evaluate(() => TG._village.live().walletRevision === 3), 'server confirms spending and first-taste reward');
  const spentWallet = await a.evaluate(() => ({ coins: TG.store.active().village.coins, xp: TG.store.active().village.xp }));
  if (spentWallet.coins !== 612 - food.price || spentWallet.xp !== 212) throw new Error('the server did not persist the wallet spend and XP');
  await a.$eval('.v-pill', (button) => button.click());
  await a.waitForSelector('.v-shop');
  await a.$eval('[data-buy="hat-cap"]', (button) => button.click());
  await until(() => a.evaluate(() => TG.store.active().village.owned.includes('hat-cap') && TG._village.live().walletRevision === 4), 'server confirms shop purchase');
  const purchased = await a.evaluate(() => ({
    coins: TG.store.active().village.coins,
    ownsItem: TG.store.active().village.owned.includes('hat-cap'),
    wearingItem: TG.store.active().village.look.hat === 'cap',
  }));
  if (purchased.coins !== spentWallet.coins - 40 || !purchased.ownsItem || !purchased.wearingItem) {
    throw new Error(`the server did not atomically confirm shop ownership and payment: ${JSON.stringify(purchased)}`);
  }
  await a.evaluate(() => {
    TG.store.active().village.owned = ['deel-blue'];
    TG._village.reconnect();
  });
  await until(() => a.evaluate(() => TG._village.live().online && TG.store.active().village.owned.includes('hat-cap')), 'shop ownership restores from server');
  ok('online shop purchases atomically persist canonical ownership and wallet balance');
  await a.evaluate(() => TG._village.reconnect());
  await until(() => a.evaluate(() => TG._village.live().online), 'player reconnects');
  const restoredWallet = await a.evaluate(() => ({ coins: TG.store.active().village.coins, xp: TG.store.active().village.xp }));
  if (restoredWallet.coins !== purchased.coins || restoredWallet.xp !== spentWallet.xp) throw new Error('wallet balances did not survive reconnect');
  ok('authenticated wallet and inventory survive reconnect');
  const walletProbe = await browser.newPage();
  await walletProbe.goto(`${base}/api/hello`);
  const probeId = 'wallet-test-' + crypto.randomBytes(4).toString('hex');
  await walletProbe.evaluate((url, id, ticket) => {
    window.walletEvents = [];
    window.walletSocket = new WebSocket(url);
    window.walletSocket.addEventListener('message', (event) => window.walletEvents.push(JSON.parse(event.data)));
    window.walletSocket.addEventListener('open', () => window.walletSocket.send(JSON.stringify({
      t: 'join', room: 'NUTAG', id, ticket, name: 'Wallet test', look: {}, wallet: { coins: 40, xp: 0 },
    })));
  }, `ws://${new URL(base).host}/ws`, probeId, crypto.randomBytes(32).toString('hex'));
  await walletProbe.waitForFunction(() => window.walletEvents.some((message) => message.t === 'welcome'), { timeout: 5000 });
  const sendWalletOperation = async (op, action, coins, xp) => {
    const previous = await walletProbe.evaluate((id) => window.walletEvents.filter((message) => message.t === 'wallet-result' && message.op === id).length, op);
    await walletProbe.evaluate((operation) => window.walletSocket.send(JSON.stringify({ t: 'wallet-op', ...operation })), { op, action, coins, xp });
    await until(() => walletProbe.evaluate(({ op, previous }) => window.walletEvents.filter((message) => message.t === 'wallet-result' && message.op === op).length > previous, { op, previous }), `wallet operation ${op}`);
    return walletProbe.evaluate((id) => {
      const events = window.walletEvents.filter((message) => message.t === 'wallet-result' && message.op === id);
      return events[events.length - 1];
    }, op);
  };
  const deniedSpend = await sendWalletOperation('b'.repeat(32), 'spend', 41, 0);
  if (deniedSpend.accepted || deniedSpend.reason !== 'insufficient' || deniedSpend.wallet.coins !== 40) throw new Error('the server allowed an overspend');
  const deniedReplay = await sendWalletOperation('b'.repeat(32), 'spend', 41, 0);
  if (deniedReplay.accepted || deniedReplay.wallet.coins !== 40) throw new Error('a rejected operation was not idempotent');
  const acceptedReward = await sendWalletOperation('c'.repeat(32), 'reward', 10, 5);
  if (!acceptedReward.accepted || acceptedReward.wallet.coins !== 50 || acceptedReward.wallet.xp !== 5) throw new Error('the server rejected a valid wallet reward');
  const repeatedReward = await sendWalletOperation('c'.repeat(32), 'reward', 10, 5);
  if (!repeatedReward.accepted || repeatedReward.wallet.coins !== 50 || repeatedReward.wallet.xp !== 5 || repeatedReward.wallet.revision !== 1) {
    throw new Error('a repeated reward operation changed the wallet twice');
  }
  const sendShopPurchase = async (op, item) => {
    const previous = await walletProbe.evaluate((id) => window.walletEvents.filter((message) => message.t === 'inventory-result' && message.op === id).length, op);
    await walletProbe.evaluate((purchase) => window.walletSocket.send(JSON.stringify({ t: 'shop-buy', ...purchase })), { op, item });
    await until(() => walletProbe.evaluate(({ op, previous }) => window.walletEvents.filter((message) => message.t === 'inventory-result' && message.op === op).length > previous, { op, previous }), `shop purchase ${op}`);
    return walletProbe.evaluate((id) => {
      const events = window.walletEvents.filter((message) => message.t === 'inventory-result' && message.op === id);
      return events[events.length - 1];
    }, op);
  };
  const boughtCap = await sendShopPurchase('d'.repeat(32), 'hat-cap');
  if (!boughtCap.accepted || boughtCap.wallet.coins !== 10 || !boughtCap.inventory.owned.includes('hat-cap')) {
    throw new Error('the server did not validate and persist a shop purchase');
  }
  const repeatedCap = await sendShopPurchase('e'.repeat(32), 'hat-cap');
  if (repeatedCap.accepted || repeatedCap.reason !== 'owned' || repeatedCap.wallet.coins !== 10) {
    throw new Error('the server allowed a second purchase of an already-owned item');
  }
  const lockedCrown = await sendShopPurchase('f'.repeat(32), 'hat-crown');
  if (lockedCrown.accepted || lockedCrown.reason !== 'level' || lockedCrown.wallet.coins !== 10) {
    throw new Error('the server allowed a purchase above the player level');
  }
  await walletProbe.close();
  ok('wallet overspending is denied and transaction replays do not duplicate changes');
  if (!(await a.evaluate(() => {
    const v = TG.store.active().village;
    const saved = JSON.parse(localStorage.getItem(TG.store.KEY) || 'null');
    const profile = saved && saved.profiles.find((entry) => entry.id === TG.store.active().id);
    return /^[a-f0-9]{64}$/i.test(v.ticket || '') && profile && profile.village.ticket === v.ticket;
  }))) throw new Error('the player identity ticket was not saved on the device');
  ok('each profile keeps its private identity ticket on the device');

  const protectedId = await a.evaluate(() => TG.store.active().village.id);
  const impostor = await browser.newPage();
  await impostor.goto(`${base}/api/hello`);
  await impostor.evaluate((url, id, ticket) => {
    window.identityEvents = [];
    window.identitySocket = new WebSocket(url);
    window.identitySocket.addEventListener('message', (event) => window.identityEvents.push(JSON.parse(event.data)));
    window.identitySocket.addEventListener('open', () => window.identitySocket.send(JSON.stringify({
      t: 'join', room: 'NUTAG', id, ticket, name: 'Дуурайгч', look: {}, x: 20, y: 13,
    })));
  }, `ws://${new URL(base).host}/ws`, protectedId, crypto.randomBytes(32).toString('hex'));
  await impostor.waitForFunction(() => window.identityEvents.some((message) => message.t === 'error' && message.why === 'identity'), { timeout: 5000 });
  await sleep(100);
  if (!(await a.evaluate(() => TG._village.live().online))) throw new Error('an invalid identity ticket replaced its owner');
  await impostor.close();
  ok('an invalid ticket cannot take over a profile identity');

  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Сарнай')), 'A sees B');
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && o.look.hat === 'cap')), 'B sees A with purchased hat');
  ok('players see each other (names and outfits)');

  await a.evaluate(() => TG._village.mount('black'));
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && o.look.ride === 'horse' && o.look.coat === 'black')), 'B sees A on a black horse');
  await a.evaluate(() => TG._village.dismount());
  await until(() => b.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Бат' && !o.look.ride)), 'B sees A get off the horse');
  ok('riding a horse is visible to friends');

  await a.evaluate(() => TG._village.goTo({ x: 15, y: 13 }, null));
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && Math.abs(o.x - 15) < 0.01 && Math.abs(o.y - 13) < 0.01; }), 'B sees A move', 12000);
  ok('movement is shared live');


  await a.evaluate(() => document.querySelector('.v-bottom .v-round[aria-label="talk"]').click());
  await sleep(300);
  await a.evaluate(() => document.querySelector('.v-phrases .v-chip').click());
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && o.bubble && /Сайн уу/.test(o.bubble.text); }), 'B sees A say hi');
  ok('preset phrases appear as speech bubbles');

  await until(() => b.evaluate(() => document.querySelector('.v-talk .v-badge').textContent === '1'), 'B gets an unread badge');
  await b.evaluate(() => document.querySelector('.v-talk').click());
  await until(() => b.evaluate(() => [...document.querySelectorAll('.v-chatlog .v-chat-line')].some((x) => /Бат/.test(x.textContent) && /Сайн уу/.test(x.textContent))), "B sees A's phrase in the chat log");
  if (!(await b.evaluate(() => [...document.querySelectorAll('.v-chatlog .v-chat-line.sys')].some((x) => /Бат/.test(x.textContent))))) throw new Error('the chat log has no join line');
  if (await b.evaluate(() => !document.querySelector('.v-talk .v-badge').classList.contains('hidden'))) throw new Error('opening the chat log did not clear the badge');
  await b.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await sleep(300);
  ok('the chat log shows phrases and joins, inside the talk window, with an unread badge');

  await a.evaluate(() => document.querySelector('.v-jump').click());
  await until(() => b.evaluate(() => { const o = [...TG._village.live().others.values()][0]; return o && performance.now() - (o.jt || -1e9) < 2000; }), 'B sees A jump');
  ok('jumping shows for everyone');

  // building a ger by hand: each finished step shows for everyone, and costs no coins
  await a.evaluate(() => { const v = TG.store.active().village; v.ger.parts = { khana: 5, khaalga: 1, toono: 1, bagana: 2, uni: 9, esgii: 2, buurees: 1, buslvvr: 3 }; });
  a.evaluate(() => TG._village.build(2)).catch(() => {});
  await sleep(300);
  for (const s of ['shal', 'khana', 'khaalga']) { await a.evaluate((x) => TG.tasks.pick(x), s); await sleep(250); await a.evaluate(() => TG.tasks.finish()); await sleep(350); }
  await until(() => b.evaluate(() => { const l = TG._village.lots()[2]; return l && l.n === 'Бат' && TG.vrules.lotStage(l) === 3; }), 'B sees A\'s ger at stage 3');
  await a.evaluate(() => TG.tasks.cancel());
  if ((await a.evaluate(() => TG.store.active().village.coins)) !== purchased.coins) throw new Error('building a ger should not cost coins');
  // B started a ger on plot 2 while offline: plot 2 is A's now, so B's half-built ger moves to a free plot
  await b.evaluate(() => { const v = TG.store.active().village; v.ger.stage = 1; v.ger.lot = 2; });
  await b.evaluate(() => TG._village.reconnect());
  await until(() => b.evaluate(() => TG._village.lots().some((l, i) => i !== 2 && l && l.n === 'Сарнай' && TG.vrules.lotStage(l) === 1)), 'B re-claims a different free plot when its old one is taken');
  if ((await b.evaluate(() => TG._village.lots()[2].n)) !== 'Бат') throw new Error('a taken lot was overwritten');
  ok('building a ger syncs stage by stage; taken plots are protected; progress follows the player into a room');

  // live wrestling: A invites B, B accepts, both play exchanges until someone wins
  const bId = await b.evaluate(() => TG.store.active().village.id);
  await a.evaluate((id) => TG._village.invite(id), bId);
  await until(() => b.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].some((x) => /Барилдъя/.test(x.textContent))), 'B gets the invitation');
  await b.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /Барилдъя/.test(x.textContent)).click());
  await until(() => a.evaluate(() => !!document.querySelector('.v-wrestle')) && b.evaluate(() => !!document.querySelector('.v-wrestle')), 'both see the match');
  for (let round = 0; round < 15; round++) {
    const over = await a.evaluate(() => !!document.querySelector('.v-wrestle .row-btns'));
    if (over) break;
    for (const [pg, k] of [[a, 0], [b, 1]]) {
      await until(() => pg.evaluate(() => { const m = document.querySelector('.v-wr-moves'); return (m && !m.classList.contains('hidden')) || !!document.querySelector('.v-wrestle .row-btns'); }), 'move buttons', 6000);
      await pg.evaluate((k) => { const btns = document.querySelectorAll('.v-wr-moves .btn'); if (btns.length && !document.querySelector('.v-wrestle .row-btns')) { btns[[0, 4, 12][(k + Math.floor(Math.random() * 3)) % 3]].click(); /* timing moves: push, hip throw, knee grab */ setTimeout(() => { const go = document.querySelector('.v-wr-timing .btn'); if (go) go.click(); }, 120 + Math.random() * 300); } }, k);
    }
    await sleep(1600);
  }
  await until(() => a.evaluate(() => !!document.querySelector('.v-wrestle .row-btns')) && b.evaluate(() => !!document.querySelector('.v-wrestle .row-btns')), 'match finishes for both', 10000);
  const recs = [await a.evaluate(() => TG.store.active().village.wr), await b.evaluate(() => TG.store.active().village.wr)];
  if ((recs[0].pvpW + recs[1].pvpW) !== 1 || (recs[0].pvpL + recs[1].pvpL) !== 1) throw new Error('wrestling result not recorded exactly once: ' + JSON.stringify(recs));
  ok('live wrestling match: invite, exchanges, one winner, records saved');
  await a.screenshot({ path: join(process.env.SHOT_DIR || tmpdir(), 'village-wrestle.png') });
  await a.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await b.evaluate(() => document.querySelectorAll('.modal-x').forEach((x) => x.click()));
  await sleep(300);

  await a.screenshot({ path: join(process.env.SHOT_DIR || tmpdir(), 'village-two-players.png') });

  // a third friend whose profile remembers an old private room: they are told others are here and can join in one tap
  const c = await player('Тэмүүлэн', { deel: 'blue' }, 'ABCDE');
  await until(() => c.evaluate(() => document.querySelector('.v-net').classList.contains('alert') && /\(\+2\)/.test(document.querySelector('.v-net').textContent)), 'C is shown 2 people in another room');
  await c.evaluate(() => document.querySelector('.v-net').click()); await sleep(300);
  await c.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((x) => /NUTAG|Үндсэн Нутаг|main village/.test(x.textContent)).click());
  await until(() => c.evaluate(() => TG._village.live().online && TG._village.live().room === 'NUTAG' && TG._village.live().others.size === 2), 'C joins the main village and sees both');
  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Тэмүүлэн')), 'A sees C');
  ok('a player stuck in another room is pointed to the main village and joins in one tap');
  if (!(await c.evaluate(() => (TG._village.live().chat || []).some((l) => l.k === 'p' && l.n === 'Бат' && l.i === 0)))) throw new Error('a late joiner did not get the recent chat');
  ok("a player who joins later gets the room's recent chat");

  // the same profile opened in a second tab: the old tab steps aside, no reconnect fight
  const c2 = await player('Тэмүүлэн', null, null, c.browserContext());
  await until(() => c.evaluate(() => TG._village.live().status === 'solo'), 'old tab steps aside');
  await sleep(4000);
  if (!(await c2.evaluate(() => TG._village.live().online))) throw new Error('the newest tab lost its connection (reconnect loop)');
  if ((await a.evaluate(() => [...TG._village.live().others.values()].filter((o) => o.name === 'Тэмүүлэн').length)) !== 1) throw new Error('the same profile shows up twice');
  ok('opening the same profile twice keeps the newest tab without a reconnect loop');
  await c.close(); await c2.close();
  await until(() => a.evaluate(() => TG._village.live().others.size === 1), 'C left');

  // a phone that drops off the Wi-Fi without closing: removed by the heartbeat instead of staying as a frozen ghost
  const ghost = net.connect(port, '127.0.0.1');
  await new Promise((r) => ghost.on('connect', r));
  ghost.write(`GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\n\r\n`);
  await sleep(200);
  const payload = Buffer.from(JSON.stringify({ t: 'join', room: 'NUTAG', id: 'ghost-1', ticket: crypto.randomBytes(32).toString('hex'), name: 'Сүнс', look: {}, x: 20, y: 13 })), mask = crypto.randomBytes(4);
  const header = payload.length < 126
    ? Buffer.from([0x81, 0x80 | payload.length])
    : Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 255]);
  ghost.write(Buffer.concat([header, mask, Buffer.from(payload.map((x, i) => x ^ mask[i & 3]))]));
  ghost.pause();                                                // never answers the server's pings again
  await until(() => a.evaluate(() => [...TG._village.live().others.values()].some((o) => o.name === 'Сүнс')), 'A sees the ghost join');
  await until(() => a.evaluate(() => ![...TG._village.live().others.values()].some((o) => o.name === 'Сүнс')), 'the silent player is removed', 6000);
  ghost.destroy();
  ok('a player whose connection silently died is removed automatically');

  // chat flood guard: only one phrase a second gets through
  const spam = new WebSocket(`ws://127.0.0.1:${port}/ws`), heard = [];
  await new Promise((r) => (spam.onopen = r));
  spam.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'say' && m.id === 'spam-1') heard.push(m); };
  spam.send(JSON.stringify({ t: 'join', room: 'SPAM', id: 'spam-1', ticket: crypto.randomBytes(32).toString('hex'), name: 'Spam', look: {}, x: 20, y: 13 }));
  await sleep(200);
  for (let k = 0; k < 5; k++) spam.send(JSON.stringify({ t: 'say', k: 'e', i: 0 }));
  await sleep(400);
  spam.close();
  if (heard.length !== 1) throw new Error(`chat flood guard let ${heard.length} phrases through instead of 1`);
  ok('sending many phrases at once only lets one through');

  await b.close();
  await until(() => a.evaluate(() => TG._village.live().others.size === 0), 'A sees B leave');
  if (!(await a.evaluate(() => (TG._village.live().chat || []).some((l) => l.k === 'leave' && l.n === 'Сарнай')))) throw new Error('the chat log has no leave line');
  ok('leaving removes the player for others');
} catch (e) {
  errors.push(e.message);
}
await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
console.log(results.join('\n'));
if (errors.length) { console.error('Multiplayer test failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Multiplayer test passed.');
