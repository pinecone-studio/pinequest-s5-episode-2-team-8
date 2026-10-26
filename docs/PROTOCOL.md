# Naadamy multiplayer protocol

This is how a game client (the web game today, maybe a Unity client later) talks to `server.js`.
It describes protocol **version 12** (`VERSION` in `js/village/rules.js`).

- Transport: WebSocket at `ws://<host>/ws` (`wss://` on HTTPS).
- Every message is one JSON text frame: an object with a `t` (type) field.
- Max frame size: 16 KB. Binary frames are ignored.
- Rate limit: about 20 messages per second per connection (a burst of 30 is allowed). Messages over the limit are dropped silently.
- The server pings every 20 s. A client that misses a ping is disconnected.
- Bad messages (unknown `t`, broken JSON, out-of-range values) are ignored, or clamped where noted.

Shared lists (phrases, emotes, looks, roofs, moves…) live in `js/village/rules.js`. Both sides load that file, so messages send **ids and indexes**, never display text.

## Before connecting

`GET /api/hello` checks that a Naadamy server is there:

```json
{ "naadamy": true, "rooms": 1, "players": 3, "nutag": 2, "urls": ["http://192.168.1.39:8000/"] }
```

`nutag` = players in the main room `NUTAG`. `urls` = LAN addresses that other devices can open.

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

When PostgreSQL is configured, each server records active players in `naadamy_players` and device-local identity ticket hashes in `naadamy_identities`; PostgreSQL `LISTEN`/`NOTIFY` shares room joins, leaves, moves, looks, jumps, preset chat, ger updates and wrestling messages across instances. Names, ages and raw tickets are not stored in the identity table. Wallet balances and the limited shop inventory are stored in `naadamy_wallets`; successful and rejected operation ids are recorded in `naadamy_wallet_ops` for idempotent retries. New accounts use server-defined starter wallet/inventory values; existing server-side accounts keep their saved state. Client-local wallet and shop ownership are not migrated. Legacy progress records may remain in `naadamy_player_progress` or `DATA_DIR/progress.json`, but the multiplayer protocol no longer imports, returns, or updates client-reported progress. In single-server JSON mode, ticket hashes and wallet/inventory are stored separately in `DATA_DIR/identities.json` and `DATA_DIR/wallets.json`. Ger claims and edits, wrestling invitations, match starts, moves, timeouts and forfeits are applied while holding a row lock on the room snapshot, so concurrent servers cannot claim one lot twice or resolve a wrestling round twice. Notifications are enqueued inside the same transaction as each wrestling update. Snapshot saves update chat without overwriting the transactionally updated ger or wrestling state. Presence expires after 60 seconds without a server heartbeat. Without PostgreSQL, room realtime behavior remains single-server and in-process.

### Wallet (coins and XP)
The server returns canonical `{ coins, xp, revision }` in `welcome.wallet` and after every `wallet-op` as `wallet-result { op, accepted, reason?, wallet }`. A successful `shop-buy` returns `inventory-result { op, accepted, wallet, inventory }`. Shop inventory is limited to owned wardrobe/pet item ids plus the fishing-rod level; official item cost and level requirements are read from `rules.js`. A successful shop purchase checks canonical balance and ownership and changes both atomically. Wallet and shop records persist across server restarts and, with PostgreSQL, across server instances. New server accounts start with the server-defined starter wallet and inventory; existing server-side accounts keep their persisted balances and ownership. Client-reported local wallet and shop ownership are not imported. Balances initially imported by earlier server versions remain stored and cannot be retroactively verified.

The server enforces non-negative balances, operation size limits, shop catalog prices/levels, duplicate ownership checks and idempotency. Daily quest and ger-activity claims are rejected until their underlying gameplay can be verified by the server. Live player-versus-player wrestling rewards are determined from the server-resolved match result and granted once per match. Arbitrary client-submitted wallet rewards are denied; lesson and minigame rewards that do not yet have server-verified outcomes are unavailable while connected. Client-reported progress is not persisted online. Energy and most other gameplay outcomes remain local.

A log line is `{ k, id, n, i? }`:
- `k`: `'p'` phrase, `'e'` emote, `'join'`, `'leave'`.
- `id` / `n`: the player's id and name at that moment.
- `i`: the phrase or emote index (only for `'p'` and `'e'`).

A second tab of the same player (`replaced`) doesn't add a join or leave line.

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
| `wr-quit` | (none) | Give up. The other player wins. |

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
| `inventory-result` | `op, accepted, reason?, wallet, inventory` | Reply to `shop-buy`. Returns canonical wallet and limited shop inventory. `reason` may be `owned`, `level`, `insufficient`, `invalid` or `storage`. |
| `progress-result` | `accepted, revision, reason?` | Reply to legacy `progress-save`. Current servers always return `accepted: false`, `reason: 'server-only'`, and revision `0`; no client progress is returned. |
| `census` | `total, nutag` | Player counts across the whole server; sent whenever anyone joins or leaves. |
| `lot` | `act, i, lot, by` | `act: 'claim'`, `'stage'` or `'style'`. `lot` includes `{ by, n, roof, door, furn[], stage }` (`by` = owner id, `n` = owner name). |
| `wr-invite` | `from, name` | You were invited. |
| `wr-declined` | `by, name` | Your invitation was declined. |
| `wr-start` | `id, a, b` | Match started. `a`, `b` = `{ id, name, look }`; `a` is the one who invited. |
| `wr-wait` | (none) | The other player has chosen; waiting for you. |
| `wr-result` | `ma, pa, mb, pb, r, score` | Round result. `r` = `1` a wins, `-1` b wins, `0` draw. `score` = `{ a, b }`. |
| `wr-end` | `id, winner, playerIds, reason` | Match over. `id` is the match id, `playerIds` are its participants, and `reason` is `''` (normal) or `'left'` (the other quit or dropped). The server grants each participant's idempotent match reward. |
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
- **Identity:** the server verifies a random ticket bound to each profile id. Tickets remain on the device and cannot be recovered or used to sync a profile to another device; anyone who obtains a ticket can act as that profile. Use HTTPS/WSS outside a trusted local network.
- **Position:** the server owns spawn/active position, movement speed, and static map collision. Position enforcement is not a complete proof of every local game interaction.
- **Progress:** coins and XP balances persist server-side. The server denies generic client reward requests, client-reported quest/ger-activity claims, and client progress snapshots. New accounts receive a fixed starter wallet and inventory; existing server-side balances and ownership remain canonical. Purchases are checked against canonical balance, ownership, catalog prices and level. Dairy/fish counts, daily quest progress, energy and other unverified gameplay outcomes stay local until the server can validate them.
- The server is the source of truth for **authenticated player ids, shared room state, wallet balances, limited shop ownership, live PvP wrestling payouts and levels derived from canonical XP**. With PostgreSQL, shared room state and account changes work across instances. Progress snapshots synchronize storage, not achievement verification. Server-verified rewards are limited to outcomes the server resolves itself; lesson, minigame, quest and ger-activity wallet rewards are unavailable online until their outcomes are verified.

## Changing the protocol

1. Change `server.js` and the client together.
2. Bump `VERSION` in `js/village/rules.js`. The web client warns when `welcome.v` doesn't match.
3. Update this file.
4. Run `node tests/multiplayer.mjs`.
