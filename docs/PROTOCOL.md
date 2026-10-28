# Naadamy multiplayer protocol

This is how a game client (the web game today, maybe a Unity client later) talks to `server/server.js`.
It describes protocol **version 13** (`VERSION` in `web/js/village/rules.js`). Unity speaks the same protocol from `unity/Assets/Scripts/Net.cs`.

- Transport: WebSocket at `ws://<host>/ws` (`wss://` on HTTPS).
- Every message is one JSON text frame: an object with a `t` (type) field.
- Max message size: 16 KB in total, also when split over fragments. Binary frames, unknown opcodes, a continuation frame with no open message and a new message inside an unfinished one close the connection.
- Rate limit: about 20 messages per second per connection (a burst of 30 is allowed). Messages over the limit are dropped silently.
- Connection caps (per server instance): each address may hold 200 connections at once (`WS_MAX_PER_IP`) and open 300 new ones per minute (`WS_NEW_PER_MIN`), and the server holds 2000 in total (`WS_MAX_TOTAL`). Over an address cap the upgrade is refused with `429 Too Many Requests` and `Retry-After: 60`; over the total, with `503 Service Unavailable` and `Retry-After: 30`.
- The server pings every 20 s. A client that misses a ping is disconnected.
- Bad messages (unknown `t`, broken JSON, out-of-range values) are ignored, or clamped where noted.

Shared lists (phrases, emotes, looks, roofs, moves…) live in `js/village/rules.js`. Both sides load that file, so messages send **ids and indexes**, never display text.

## Before connecting

`GET /api/hello` checks that a Naadamy server is there:

```json
{ "naadamy": true, "rooms": 1, "players": 3, "nutag": 2, "urls": ["http://192.168.1.39:8000/"] }
```

`nutag` = players in the main room `NUTAG`. `urls` = LAN addresses that other devices can open.

## Family login

`POST /api/family` (JSON, at most 4 KB) lets a child play as the same player on another device. A grown-up makes a **family code** from the parent dashboard. Each child is added to the family with their 3 secret pictures. On another device, the child enters the family code, picks their name and taps the same pictures. The server then gives that device its own ticket for the child's player `id`, so it has the same coins, XP and clothes. The `login` answer also carries the child's **cloud save** (see [Cloud save](#cloud-save)): character, lessons, badges, stamps, Mongol script and the historian's quest. Other progress (the ger, dairy, fish, horse races, energy) still stays on the device it was made on.

| `act` | Fields | Answer when `ok` |
|---|---|---|
| `create` | `id, ticket, name, age, avatar, pics, pin, recovery` | `{ ok, code }`: a new family with this child in it, guarded by the grown-up `pin` |
| `join` | `code, id, ticket, name, age, avatar, pics, pin` | `{ ok, code }`: adds the child (needs `pin`), or replaces their name, age, avatar and pictures (this also lifts a lock; a child already in the family needs no `pin`) |
| `members` | `code` | `{ ok, members: [{ id, name, age, avatar, locked }], needsPin }` |
| `login` | `code, id, pics` | `{ ok, id, ticket, name, age, avatar, code, cloud, needsPin }`: `ticket` is new and belongs to this device; `cloud` is the child's cloud save. No PIN |
| `pictures` | `code, by, ticket, id, pics, pin` | `{ ok, code, left }`: gives child `id` new pictures and lifts a lock (they forgot theirs) |
| `remove` | `code, by, ticket, id, pin` | `{ ok, code, left }`: takes child `id` (another child or `by` itself) out of the family; with `left: 0` the family is deleted |
| `pin` | `code, by, ticket, pin, old?, recovery?` | `{ ok, code }`: sets the PIN to `pin`. With a PIN already, `old` must be right and `recovery` (optional) replaces the recovery code. A family without a PIN gets its first one only from its oldest child (`members[0]`), with a `recovery` code; it then can't be erased for 3 days (`too-soon`) |
| `check-pin` | `code, by, ticket, pin` | `{ ok }`: `pin` is the family's PIN (a device whose copy of the PIN is out of date asks this) |
| `recover` | `code, recovery, pin, newRecovery` | `{ ok, code }`: the recovery code sets a new `pin` (and lifts the PIN's lock), and `newRecovery` (which must differ) replaces it, so each code works once. No ticket: the code is the secret |
| `erase` | `code, by, ticket, pin, confirm` | `{ ok, erased }`: deletes the whole family; `erased` is how many children it had. See below |

- `code`: 8 letters and digits from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, shown as `ABCD-2345`. Lower case, spaces and dashes are allowed when sending it.
- `pics`: 3 picture indexes 0–8, in order (`TG.PIC_KEYS` on the web; Unity's `PicKey(i)` uses the same order). `avatar`: a mascot index 0–11. `name`: up to 20 characters.
- `pin`: the grown-up PIN, a **string** of 4–6 digits. `recovery`, `newRecovery`: 10 letters from the same alphabet as `code` (made by the app, shown as `ABCDE-FGH23`; dashes and lower case are allowed). The server keeps only salted scrypt hashes of both (`pinHash`, `pinSalt`, `recoveryHash`, `recoverySalt`, with `pinFails`, `pinUntil`, `pinLocks` on the family row) and never sends them, logs them or lists them.
- `create` and `join` need the child's own `id` and `ticket`, so only a device that already plays as that child can add or change it.
- `pictures`, `remove`, `pin`, `check-pin` and `erase` are for a grown-up on any device of the family: `by` and `ticket` are one of the family's children that this device plays as, and `id` may be any child of the family. Taking a child out doesn't erase their progress or the tickets their devices already have; they just can't log in with the code any more.
- A family made before the PIN has none: `join` keeps working with the code only, so old families keep working, and `members` and `login` say `needsPin: true` so the parent dashboard asks for one. `pictures`, `remove`, `check-pin` and `erase` answer `needs-pin` until its oldest child sets one: otherwise anyone who joined with the code could reset that child's pictures, log in as them and take the family over. Its first PIN can't erase the family for 72 hours (`too-soon`, `wait` in seconds), so the other grown-ups have time to notice.
- Acts with `by` check that the family exists and `by` is in it **before** the ticket, so an erased child's old device never registers its id again.
- A family has at most 8 children.
- After 5 wrong `login` tries, that child is locked for 15 minutes (`reason: 'locked'`, `wait` in seconds). A wrong try answers `reason: 'wrong'` with `left` tries.
- **PIN tries:** a wrong `pin` answers `reason: 'pin'` with `left` tries (a missing or malformed one is not counted). There are three counters, each with its own tries and lock, so nobody without a member's ticket can lock the grown-up out:
  - the PIN itself, for `check-pin`, `pin`, `pictures`, `remove` and `erase` (all need a member's ticket): `pin-locked`;
  - a new child `join`ing with the PIN (anyone with the code can try): `join-locked`;
  - the recovery code in `recover` (anyone with the code can try; a wrong one answers `recovery` with `left`): `recovery-locked`. A locked PIN can still be recovered.

  After 5 wrong tries the counter locks (`wait` in seconds) for 15 minutes × 2^(locks − 1), at most 24 hours: 15 min, 30 min, 1 h… The lock is checked before anything is hashed. A right try starts the tries again and takes one off the lock count; 24 hours with no wrong try forget the count. 10 recovery letters from 32 are 50 bits, safe at this rate.
- **`erase`:** `confirm` is the family code typed again (normalised like `code`). It needs `by` with a valid ticket and the PIN. In one database transaction (with JSON files: every file is read first, the family file is written last) it deletes the family row and, for every child, `naadamy_wallets`, `naadamy_wallet_ops`, `naadamy_player_progress`, `naadamy_player_tickets`, `naadamy_identities` and `naadamy_players` (JSON: `wallets.json`, `progress.json`, `device-tickets.json`, `identities.json`), frees their ger lots and drops their chat lines (each line carries its writer's `id`) in every room. It also remembers the erased ids for 30 days (`naadamy_erased`; JSON: `erased.json`): during that time the id is not taken again on first sight, so the room hello answers `{ t: 'error', why: 'erased' }` and `create`/`join` answer `reason: 'erased'`, and an old device can't bring the account back. (`identity` still means only a wrong ticket, or one of a device that dropped out of the last 8.) The transaction ends with a PostgreSQL NOTIFY on the realtime channel, `{ t: 'family-erased', ids }`, so every server instance (this one too: twice is harmless) closes their live connections (`{ t: 'error', why: 'erased' }`), takes them out of the rooms it holds and its saved copy of them, and tells the room `{ t: 'lot', act: 'free', i, lot: null }`. The server logs only a hash of the code and the time. Asking again answers `no-family`. Not covered: backups of the database, and what is saved on each device (the Unity app forgets the family on the device that erased it).
- Each address gets at most 30 requests a minute (`429`, `reason: 'busy'`). Behind Render's proxy, the last `X-Forwarded-For` entry is used.
- Other `reason` values: `invalid`, `identity`, `erased` (the id was erased with its family), `no-family`, `no-member`, `full`, `not-first` (only the oldest child sets a family's first PIN), `needs-pin`, `too-soon`, `no-recovery`, `confirm` (the typed code didn't match), `storage`.
- Pictures are stored as a salted scrypt hash. With only 729 combinations, the lock is what protects them, not the hash. The same holds for the PIN (10^4 to 10^6).

Unity also has a **device grown-up PIN** for its parent gate (`DevicePin` in `Family.cs`): a PBKDF2-SHA256 hash (20,000 rounds, at most one a frame) and salt in `AppState`, with 5 tries, then a 5-minute lock that doubles each time. Before there is one, a family device asks for the family's PIN (`check-pin`); any other device, or one that can't reach the server, asks a grown-up to type a number written in words, then to choose a PIN and write down its recovery code (shown once). Creating or joining a family, setting or changing the family PIN, or a family action that worked with a re-typed PIN makes the device PIN the family's. A family device whose PIN was changed elsewhere asks `check-pin`; "Forgot the PIN?" uses `recover` on a family device (the device's own old code there changes nothing), and the device's own recovery code otherwise. The typed PIN stays in memory only, for the parents' menu's 10 minutes; "Change PIN" always asks for the old one. A device told `no-family` for its family forgets it (the family is no longer on the server: erased, or its last child taken out); told `erased` for a child, it also drops that child's ticket and says the family was deleted. `identity` alone changes nothing.

The web client keeps `familyCode` in its stored state, and `fam` (the family code) on each profile that is in the family. Unity (`Family.cs`) keeps `familyCode` and `server` (the address it last used) in `AppState`, and `fam` in each `SaveData`; its picture codes are saved as `"0-4-2"` and sent as `[0,4,2]`. Because Unity has no page origin, its family login also asks for the server address.

## Connection flow

1. Open the WebSocket.
2. Send `join`. Nothing else works until the server answers with `welcome`.
3. Exchange messages.
4. When the socket closes, everyone in the room gets `leave`. The web client retries after 1.5 s, 3 s, 4.5 s… (at most 10 s) and sends `join` again.

## Shared values

| Name | Meaning |
|---|---|
| `id` | Player id, `[\w-]{4,24}`. The client keeps it with a random per-profile `ticket`; the server verifies the ticket before allowing the id to join or replace an existing connection. |
| `ticket` | A 32-byte random credential encoded as 64 hex characters. It is generated and stored with the local profile; the server stores only its SHA-256 hash. It is never included in public player data. Losing it means that profile cannot reclaim its online identity. |
| `room` | Room code, `^[A-Z0-9]{3,8}$` (upper-cased by the server). `NUTAG` is the main village. |
| `x`, `y` | Position in tiles (the map is `W` 56 × `H` 40), 2 decimals. The server clamps map bounds and checks the path against static collisions and the movement-speed limit. |
| `dir` | Facing direction: `0` down, `1` left, `2` right, `3` up. |
| `look` | Outfit: `{ deel, skin, title, hat, face, neck, pet, … }`. Each value must be in `DEELS` / `SKINS` / `LOOKS`; anything else becomes the default or `null` (`cleanLook`). |
| `lvl` | Player level, `1 … 99`. |
| `name` | Display name. `<` and `>` are removed, max 16 chars, default `Найз`. |

Public player object (`pub`): `{ id, name, look, lvl, x, y, dir }`.

`welcome` includes `day` in the `Asia/Ulaanbaatar` timezone, which the client uses to keep daily quest assignments consistent with the server.

## Client → server

### Presence
| `t` | Fields | What it does |
|---|---|---|
| `join` | `room, id, ticket, name, look, lvl, x?, y?, dir?` | Register or authenticate a profile's device-local identity, then enter a room. The server derives the shared level and appearance from canonical wallet/inventory state; submitted position, `lvl`, `look`, `wallet`, `inventory` and legacy `progress` are not trusted. It restores a valid active presence position or starts at the village spawn. A bad or missing ticket cannot claim an existing id. Joining again on the same connection leaves the old room first. If the authenticated `id` is already in the room, the older connection gets `replaced` and is closed. |
| `move` | `x, y, dir` | Request a new position. The server enforces movement speed and static map collisions; invalid moves receive `move-correct` with the canonical coordinates. The web client sends updates about 10 times a second while moving. |
| `jump` | (none) | Shows a jump to others. At most once every 300 ms; extra ones are dropped. |
| `look` | `look, lvl` | Changed outfit; the server derives the shared level from canonical XP and ignores the submitted `lvl`. |
| `wallet-op` | `op, action, coins, xp` | Authenticated wallet transaction. `op` is a 32-character hex idempotency key. Only `action: 'spend'` is accepted; it requires 1–10,000 coins and zero XP, and is rejected if the server balance is too low. Client-submitted rewards are denied with `reason: 'server-only'`. |
| `sync` | `op, coins, xp, owned, rod?` | Upload progress the device made since it last saw its server wallet (see **Uploading progress**). `op` is a 32-character hex idempotency key; `coins` is the net change (negative when the device spent more than it earned), `xp` the XP gained, `owned` the device's shop item ids, `rod` its fishing-rod level. |
| `shop-buy` | `op, item` | Buy a catalog shop item. The server looks up its price and level requirement in `rules.js`, checks canonical ownership and wallet balance, then atomically records ownership and deducts the price. |
| `progress-save` | legacy `revision, state` | Rejected with `reason: 'server-only'`. Gameplay progress remains local until each activity is validated by the server. Legacy progress snapshots are neither imported on join nor returned as canonical data. |
| `quest-claim` | `quest` | Legacy claim message. Known quests are rejected with `reason: 'server-only'` until the server can verify quest progress; unknown quests are rejected as `invalid`. |
| `daily-activity-claim` | `activity` | Legacy claim message. Known activities are rejected with `reason: 'server-only'` until the server can verify the interaction; unknown activities are rejected as `invalid`. |

### Chat (preset only)
| `t` | Fields | What it does |
|---|---|---|
| `say` | `k, i` | `k: 'p'` = phrase `PHRASES[i]`, `k: 'e'` = emote `EMOTES[i]`. `i` must be a valid integer index. There is **no typed text**, by design (safe for kids). Sent to everyone in the room, **including the sender**. At most **one per second** per player; extra ones are dropped silently. Added to the room's chat log. |

### Chat log
Each room keeps its last **30** lines: phrases, emotes, joins and leaves. The log is sent in `welcome.chat`, so a player who joins late sees what was said. The server saves this bounded log alongside room lots every 5 seconds when changed and on shutdown. Without `DATABASE_URL`, the store is `DATA_DIR/rooms.json`; with `DATABASE_URL`, it is the `naadamy_rooms` PostgreSQL table. PostgreSQL startup imports room codes missing from the database from the legacy JSON file without overwriting existing database rows. Older room records without a `chat` field start with an empty log. On load, entries are validated against the preset phrase/emote lists and cleaned before being sent to players.

When PostgreSQL is configured, each server records active players in `naadamy_players` and device-local identity ticket hashes in `naadamy_identities`; PostgreSQL `LISTEN`/`NOTIFY` shares room joins, leaves, moves, looks, jumps, preset chat, ger updates and wrestling messages across instances. Names, ages and raw tickets are not stored in the identity table. Wallet balances and the limited shop inventory are stored in `naadamy_wallets`; successful and rejected operation ids are recorded in `naadamy_wallet_ops` for idempotent retries. New accounts use server-defined starter wallet/inventory values; existing server-side accounts keep their saved state. Progress made on a device reaches these tables through capped `sync` uploads; `naadamy_wallets.earned` keeps today's uploaded total for the daily cap. Legacy progress records may remain in `naadamy_player_progress` or `DATA_DIR/progress.json`, but the multiplayer protocol no longer imports, returns, or updates client-reported progress. Families are in `naadamy_families` (the children as `members` jsonb, with each child's salted picture hash and wrong-try count). Tickets from family logins are in `naadamy_player_tickets`, up to 8 per player. In single-server JSON mode, ticket hashes and wallet/inventory are stored separately in `DATA_DIR/identities.json` and `DATA_DIR/wallets.json`, and families and family-login tickets in `DATA_DIR/families.json` and `DATA_DIR/device-tickets.json`. Ger claims and edits, wrestling invitations, match starts, moves, timeouts and forfeits are applied while holding a row lock on the room snapshot, so concurrent servers cannot claim one lot twice or resolve a wrestling round twice. Notifications are enqueued inside the same transaction as each wrestling update. Snapshot saves update chat without overwriting the transactionally updated ger or wrestling state. Presence expires after 60 seconds without a server heartbeat. Without PostgreSQL, room realtime behavior remains single-server and in-process.

### Wallet (coins and XP)
The server returns canonical `{ coins, xp, revision }` in `welcome.wallet` and after every `wallet-op` as `wallet-result { op, accepted, reason?, wallet }`. A successful `shop-buy` returns `inventory-result { op, accepted, wallet, inventory }`. Shop inventory is limited to owned wardrobe/pet item ids plus the fishing-rod level; official item cost and level requirements are read from `rules.js`. A successful shop purchase checks canonical balance and ownership and changes both atomically. Wallet and shop records persist across server restarts and, with PostgreSQL, across server instances. New server accounts start with the server-defined starter wallet and inventory; existing server-side accounts keep their persisted balances and ownership. Wallet and shop progress made on the device is added through `sync` (see **Uploading progress**), not taken from `join`. Balances initially imported by earlier server versions remain stored and cannot be retroactively verified.

The server enforces non-negative balances, operation size limits, shop catalog prices/levels, duplicate ownership checks and idempotency. Daily quest and ger-activity claims are rejected until their underlying gameplay can be verified by the server. Live player-versus-player wrestling rewards are determined from the server-resolved match result and granted once per match. `wallet-op` rewards are denied; other rewards reach the account through capped `sync` uploads. Client-reported progress snapshots are not persisted online. Energy and most other gameplay outcomes remain local.

### Uploading progress
Rewards (lessons, minigames, quests, home activities…) and spending happen on the device, online or not. The device remembers the server wallet and shop list it last saw; what it has on top of them is progress not uploaded yet. After `welcome`, and shortly after each reward while connected, it sends one `sync` with that difference:

- Coins and XP count against the player's daily earn cap `DAILY_EARN_CAP` (`rules.js`, per `Asia/Ulaanbaatar` day, offline and online play together). What goes over is not applied; the device keeps it and uploads it on a later day, so offline progress is never thrown away.
- Negative coins (spent on the device) come off the balance, down to zero.
- Shop items are combined with the account's: known catalog items whose level the player has reached. The fishing rod only goes up.
- The device saves the `op` with its profile and sends the same one again until it gets the answer, so a dropped connection or a reload never counts an upload twice. On the answer the device takes the server wallet and keeps anything it earned since on top.

A profile from before uploads existed (no identity ticket yet) starts from the server's starter wallet, so everything it earned is uploaded on its first join. Each server keeps its own accounts.

A log line is `{ k, id, n, i? }`:
- `k`: `'p'` phrase, `'e'` emote, `'join'`, `'leave'`.
- `id` / `n`: the player's id and name at that moment.
- `i`: the phrase or emote index (only for `'p'` and `'e'`).

A second tab of the same player (`replaced`) doesn't add a join or leave line.

### Cloud save

| `t` | Fields | Meaning |
|---|---|---|
| `cloud-save` | `cloud` | This device's copy of the child's progress outside the wallet, in the shape of `cleanCloud` in `rules.js`. The server merges it into its own copy and answers with `cloud`. A device sends it after `welcome`, then when it changes (the web at most every 3 s, Unity checks every 5 s). |

`cloud` is `{ eth, aimag, charAt, learn: { id: { done, best, family } }, ach: { id: ms }, stamps: { aimag: ms }, bichig: { id: best }, bichigMem: { id: 1 }, hist, story: { chapter: part, 'chapter:done': 1 } }`. Merging (`mergeCloud`) only adds: done stays done, best scores, `hist` and story parts go up, every badge and stamp is kept with its earliest date. The character is the exception: the most recent choice (`charAt`) wins. A finished story chapter drops its part, since replaying it starts from the beginning. So no device can erase what another earned, and sending the same copy twice changes nothing. Ids are `[\w:.-]{1,48}`, at most 200 per list; anything else is dropped. The server keeps it in the player's progress record under `cloud` (`naadamy_player_progress` or `DATA_DIR/progress.json`). The server can't check any of it; none of it is money.

### Gers (the 8 shared lots per room, `LOTS`)
| `t` | Fields | What it does |
|---|---|---|
| `ger-claim` | `i, roof, door, stage?` | Claim lot `i` (`0 … LOTS-1`). One ger per player. The server always starts at stage 1 and ignores submitted `stage`. |
| `ger-stage` | `stage` | Advance your own ger by exactly one stage. Skips, repeats and advances after completion are rejected. This checks order only; the hands-on task and material use are still client-reported. |
| `ger-style` | `roof?, door?, furn?` | Restyle your own ger. `furn` = up to 12 unique `FURNITURE` ids. |

Room lots and the recent chat log are saved every 5 seconds when changed and on shutdown. The default store is `DATA_DIR/rooms.json`; when `DATABASE_URL` is configured, PostgreSQL is authoritative and the server stores the room snapshot in `naadamy_rooms`. Ger claims and ordered stage progression are persisted atomically. Stage progression does not yet prove completion of the corresponding mini-game or charge materials.

### Live wrestling (best of 3)
| `t` | Fields | What it does |
|---|---|---|
| `wr-invite` | `to` | Invite player `to`. Both players must be free. |
| `wr-accept` | `from` | Accept an invitation you got from `from`. Starts the match. |
| `wr-decline` | `from` | Say no. |
| `wr-move` | `m, p` | Your move for this round: `m` = a `MOVES` id, `p` = power `0 … 1` (from the timing bar). One per round. |
| `wr-quit` | (none) | Give up. The other player wins, but if no round had been played yet nobody is paid. |

## Server → client

| `t` | Fields | When |
|---|---|---|
| `welcome` | `v, now, day, room, players[], lots[], chat[], look, wallet, inventory, position` | Reply to `join`. `v` = server protocol version (compare with your `VERSION`), `now` = server clock in ms, `day` = current day in `Asia/Ulaanbaatar`, `players` = everyone else as `pub`, `lots` = `LOTS` entries (`null` or a lot), `chat` = recent log lines, `look` = canonical appearance for this account, `wallet` = canonical `{ coins, xp, revision }`, `inventory` = canonical `{ owned: [shop item ids], rod }`, and `position` = server-owned spawn or active position `{ x, y, dir }`. |
| `join` | `p` | Someone entered your room (`pub`). |
| `leave` | `id` | Someone left or dropped. |
| `move` | `id, x, y, dir` | Someone moved. |
| `move-correct` | `x, y, dir` | Correct the local player after an invalid movement request. |
| `jump` | `id` | Someone jumped. |
| `look` | `id, look, lvl` | Someone changed outfit or level. |
| `say` | `id, k, i` | Someone said a phrase or emote (your own included). |
| `wallet-result` | `op, accepted, reason?, wallet` | Reply to `wallet-op`. Returns the canonical wallet after the operation. `reason` may be `insufficient`, `server-only`, `invalid` or `storage`. |
| `cloud` | `cloud` | Reply to `cloud-save`: the server's merged copy. The device merges it in the same way. |
| `sync-result` | `op, accepted, applied?, reason?, wallet, inventory` | Reply to `sync`. `applied` = `{ coins, xp }` actually added (less than sent when the daily cap is reached; coins spent stop at a zero balance). A repeated `op` returns the first answer without counting again. `reason` may be `invalid` or `storage`. |
| `inventory-result` | `op, accepted, reason?, wallet, inventory` | Reply to `shop-buy`. Returns canonical wallet and limited shop inventory. `reason` may be `owned`, `level`, `insufficient`, `invalid` or `storage`. |
| `progress-result` | `accepted, revision, reason?` | Reply to legacy `progress-save`. Current servers always return `accepted: false`, `reason: 'server-only'`, and revision `0`; no client progress is returned. |
| `census` | `total, nutag` | Player counts across the whole server; sent whenever anyone joins or leaves. |
| `lot` | `act, i, lot, by` | `act: 'claim'`, `'stage'` or `'style'`. `lot` includes `{ by, n, roof, door, furn[], stage }` (`by` = owner id, `n` = owner name). |
| `wr-invite` | `from, name` | You were invited. |
| `wr-declined` | `by, name` | Your invitation was declined. |
| `wr-start` | `id, a, b` | Match started. `a`, `b` = `{ id, name, look }`; `a` is the one who invited. |
| `wr-wait` | (none) | The other player has chosen; waiting for you. |
| `wr-result` | `ma, pa, mb, pb, r, score` | Round result. `r` = `1` a wins, `-1` b wins, `0` draw. `score` = `{ a, b }`. |
| `wr-end` | `id, winner, playerIds, reason` | Match over. `id` is the match id, `playerIds` are its participants, and `reason` is `''` (normal) or `'left'` (the other quit or dropped). The server grants each participant's idempotent match reward, except when `reason` is `'left'` and no round had been played (`rounds` is `0`; the field is the number of rounds played, draws included). Two players can still quit after one round and play again; the daily earn cap bounds what that earns. The reward counts toward the daily earn cap (`DAILY_EARN_CAP`) like uploaded progress; over it, `wallet-result` answers `accepted: false, reason: 'limit'`. |
| `quest-claim-result` | `quest, accepted, reason?, wallet` | Reply to `quest-claim`. Known quest claims return `reason: 'server-only'` until quest progress is server-verified. |
| `daily-activity-result` | `activity, day, accepted, reason?, wallet` | Reply to `daily-activity-claim`; known activities return `reason: 'server-only'` until the activity is server-verified. `day` is the server's Mongolia day. |
| `deny` | `act, why` | Request refused. `act: 'ger'` → `why: 'taken' \| 'own'`; `act: 'wr'` → `why: 'busy'`. |
| `error` | `why` | `why: 'bad-join'` = bad room code or id; `'identity'` = the ticket does not authenticate that profile id. A refused `join` doesn't change an existing room session. |
| `replaced` | (none) | Your id joined from another tab or device; this connection will close. Don't reconnect. |

### Wrestling rules (server side)
- A player who doesn't pick a move within 25 s gets a random move with power `0.15`.
- Each move beats the next half of the `MOVES` circle (`beats`). Score per side: `0.6` for a winning move, `0.3` for the same move, `0` for a losing one, plus `0.8 × power`. A gap under `0.04` is a draw (`exchange`).
- First to 2 round wins takes the match.
- The server awards the match winner 25 coins and 30 XP, and the other player 10 XP. Rewards are idempotent per match and the server-resolved winner.

## What the server trusts the client with

Good to know before building on this:
- **Identity:** the server verifies a random ticket bound to each profile id. A ticket stays on its device and cannot be recovered. A child in a family can get a new ticket on another device with the family code and their 3 pictures (see [Family login](#family-login)); without a family, a lost ticket means that profile cannot reclaim its online identity. Anyone who obtains a ticket, or the family code and a child's pictures, can act as that child. Use HTTPS/WSS outside a trusted local network.
- **Position:** the server owns spawn/active position, movement speed, and static map collision. Position enforcement is not a complete proof of every local game interaction.
- **Progress:** coins and XP balances persist server-side. Rewards are earned on the device and uploaded with `sync`; the server cannot verify them, so it limits what a device can add per day (`DAILY_EARN_CAP`) and checks shop items against the catalog and the player's level. The server denies `wallet-op` rewards, the legacy quest/ger-activity claims, and client progress snapshots. New accounts receive a fixed starter wallet and inventory; existing server-side balances and ownership remain canonical. Purchases are checked against canonical balance, ownership, catalog prices and level. Dairy/fish counts, daily quest progress, energy and other unverified gameplay outcomes stay local until the server can validate them.
- The server is the source of truth for **authenticated player ids, shared room state, wallet balances, limited shop ownership, live PvP wrestling payouts and levels derived from canonical XP**. With PostgreSQL, shared room state and account changes work across instances. Progress snapshots synchronize storage, not achievement verification. Server-verified rewards are limited to outcomes the server resolves itself (live wrestling); everything else the device earned is uploaded with `sync` and held to the daily earn cap.

## Changing the protocol

1. Change `server/server.js` and the client together.
2. Bump `VERSION` in `web/js/village/rules.js`. The web and Unity clients warn when `welcome.v` doesn't match.
3. Update this file.
4. Run `node tests/multiplayer.mjs`.
