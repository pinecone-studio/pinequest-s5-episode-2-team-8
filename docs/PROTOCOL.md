# Naadamy multiplayer protocol

This is how a game client (the web game today, maybe a Unity client later) talks to `server.js`.
It describes protocol **version 8** (`VERSION` in `js/village/rules.js`).

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
| `x`, `y` | Position in tiles (the map is `W` 56 × `H` 40), 2 decimals. Clamped to `0.5 … W-2` / `0.5 … H-2`. |
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
| `join` | `room, id, ticket, name, look, lvl, x, y, dir, wallet?, inventory?, progress?` | Register or authenticate a profile's device-local identity, then enter a room. `wallet` and `inventory` are one-time legacy seeds. `progress` seeds a bounded dairy/fish/daily-quest snapshot only when the server has no record for the player. These seeds are client-reported and not proof of prior gameplay or ownership. A bad or missing ticket cannot claim an existing id. Joining again on the same connection leaves the old room first. If the authenticated `id` is already in the room, the older connection gets `replaced` and is closed. |
| `move` | `x, y, dir` | New position. The web client sends it about 10 times a second while moving. |
| `jump` | (none) | Shows a jump to others. At most once every 300 ms; extra ones are dropped. |
| `look` | `look, lvl` | Changed outfit or level. |
| `wallet-op` | `op, action, coins, xp` | Authenticated wallet transaction. `op` is a 32-character hex idempotency key. `action: 'spend'` requires 1–10,000 coins and zero XP; `action: 'reward'` accepts 0–10,000 coins and 0–100 XP, with at least one positive amount. Spending is rejected if the server balance is too low. |
| `shop-buy` | `op, item` | Buy a catalog shop item. The server looks up its price and level requirement in `rules.js`, checks canonical ownership and wallet balance, then atomically records ownership and deducts the price. |
| `progress-save` | `revision, state` | Save bounded `produce`, `fish` and daily `quests` state. Revisions use optimistic concurrency: stale writes are rejected and the canonical server state is returned. Values are sanitized but remain client-reported gameplay progress, not proof of earned items or completed actions. |
| `quest-claim` | `quest, revision, state` | Save the latest bounded snapshot, verify the quest is assigned to this player for the current Mongolia day and its reported progress reached the target, then grant the catalog reward once. The server calculates the reward and records a namespaced idempotency key; reported progress is still not proof of gameplay. |

### Chat (preset only)
| `t` | Fields | What it does |
|---|---|---|
| `say` | `k, i` | `k: 'p'` = phrase `PHRASES[i]`, `k: 'e'` = emote `EMOTES[i]`. `i` must be a valid integer index. There is **no typed text**, by design (safe for kids). Sent to everyone in the room, **including the sender**. At most **one per second** per player; extra ones are dropped silently. Added to the room's chat log. |

### Chat log
Each room keeps its last **30** lines: phrases, emotes, joins and leaves. The log is sent in `welcome.chat`, so a player who joins late sees what was said. The server saves this bounded log alongside room lots every 5 seconds when changed and on shutdown. Without `DATABASE_URL`, the store is `DATA_DIR/rooms.json`; with `DATABASE_URL`, it is the `naadamy_rooms` PostgreSQL table. PostgreSQL startup imports room codes missing from the database from the legacy JSON file without overwriting existing database rows. Older room records without a `chat` field start with an empty log. On load, entries are validated against the preset phrase/emote lists and cleaned before being sent to players.

When PostgreSQL is configured, each server records active players in `naadamy_players` and device-local identity ticket hashes in `naadamy_identities`; PostgreSQL `LISTEN`/`NOTIFY` shares room joins, leaves, moves, looks, jumps, preset chat, ger updates and wrestling messages across instances. Names, ages and raw tickets are not stored in the identity table. Wallet balances and the limited shop inventory are stored in `naadamy_wallets`; successful and rejected operation ids are recorded in `naadamy_wallet_ops` for idempotent retries. Revisioned bounded progress snapshots are stored in `naadamy_player_progress`. Wallet/shop updates hold a row lock and commit balance, inventory, revision and operation result together; progress updates also hold a row lock and reject stale revisions. Existing local profiles seed their wallet, inventory and progress once on first connection. In single-server JSON mode, ticket hashes, wallet/inventory and progress are stored separately in `DATA_DIR/identities.json`, `DATA_DIR/wallets.json` and `DATA_DIR/progress.json`. Ger claims and edits, wrestling invitations, match starts, moves, timeouts and forfeits are applied while holding a row lock on the room snapshot, so concurrent servers cannot claim one lot twice or resolve a wrestling round twice. Notifications are enqueued inside the same transaction as each wrestling update. Snapshot saves update chat without overwriting the transactionally updated ger or wrestling state. Presence expires after 60 seconds without a server heartbeat. Without PostgreSQL, room realtime behavior remains single-server and in-process.

### Wallet (coins and XP)
The server returns canonical `{ coins, xp, revision }` in `welcome.wallet` and after every `wallet-op` as `wallet-result { op, accepted, reason?, wallet }`. A successful `shop-buy` returns `inventory-result { op, accepted, wallet, inventory }`. Shop inventory is limited to owned wardrobe/pet item ids plus the fishing-rod level; official item cost and level requirements are read from `rules.js`. A successful shop purchase checks canonical balance and ownership and changes both atomically. Wallet and shop records persist across server restarts and, with PostgreSQL, across server instances. Older profiles import their local wallet and the whitelisted portion of their owned shop items once. These migration values are client-reported and are not proof of prior earnings or ownership.

The server enforces non-negative balances, operation size limits, shop catalog prices/levels, duplicate ownership checks and idempotency. Daily quest payouts are calculated from the shared reward catalog and can be claimed only once for an assigned quest on the Mongolia day. Live player-versus-player wrestling rewards are also determined from the server-resolved match result and granted once per match. However, the browser still reports progress and reward amounts for local lessons and minigames, so reward eligibility is **not fully cheat-proof**: a modified client can claim unverified progress or request capped generic rewards repeatedly. The one-time inventory and progress seeds are also client-reported. The server persists bounded dairy/produce counts, fish counts and daily quest state, but sanitizing and synchronizing a snapshot does not verify how those items or quest progress were earned. Energy and most other gameplay outcomes remain local.

A log line is `{ k, id, n, i? }`:
- `k`: `'p'` phrase, `'e'` emote, `'join'`, `'leave'`.
- `id` / `n`: the player's id and name at that moment.
- `i`: the phrase or emote index (only for `'p'` and `'e'`).

A second tab of the same player (`replaced`) doesn't add a join or leave line.

### Gers (the 8 shared lots per room, `LOTS`)
| `t` | Fields | What it does |
|---|---|---|
| `ger-buy` | `i, roof, door` | Claim lot `i` (`0 … LOTS-1`). One ger per player. `roof` ∈ `ROOF`, `door` ∈ `DOOR` (defaults: `blue`, `red`). |
| `ger-style` | `roof?, door?, furn?` | Restyle your own ger. `furn` = up to 12 unique `FURNITURE` ids. |

Room lots and the recent chat log are saved every 5 seconds when changed and on shutdown. The default store is `DATA_DIR/rooms.json`; when `DATABASE_URL` is configured, PostgreSQL is authoritative and the server stores the room snapshot in `naadamy_rooms`. Wallet spends are authoritative, but ger lot claims and stages do not yet validate or charge their costs on the server.

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
| `welcome` | `v, now, day, room, players[], lots[], chat[], wallet, inventory, progress` | Reply to `join`. `v` = server protocol version (compare with your `VERSION`), `now` = server clock in ms, `day` = current day in `Asia/Ulaanbaatar`, `players` = everyone else as `pub`, `lots` = `LOTS` entries (`null` or a lot), `chat` = recent log lines, `wallet` = canonical `{ coins, xp, revision }`, `inventory` = canonical `{ owned: [shop item ids], rod }`, `progress` = `{ revision, state: { produce, fish, quests } }`. |
| `join` | `p` | Someone entered your room (`pub`). |
| `leave` | `id` | Someone left or dropped. |
| `move` | `id, x, y, dir` | Someone moved. |
| `jump` | `id` | Someone jumped. |
| `look` | `id, look, lvl` | Someone changed outfit or level. |
| `say` | `id, k, i` | Someone said a phrase or emote (your own included). |
| `wallet-result` | `op, accepted, reason?, wallet` | Reply to `wallet-op`. Returns the canonical wallet after the operation. `reason` may be `insufficient`, `limit`, `invalid` or `storage`. |
| `inventory-result` | `op, accepted, reason?, wallet, inventory` | Reply to `shop-buy`. Returns canonical wallet and limited shop inventory. `reason` may be `owned`, `level`, `insufficient`, `invalid` or `storage`. |
| `progress-result` | `accepted, revision, state?, reason?` | Reply to `progress-save`. On stale revision, returns `accepted: false` with the current canonical state. `reason` may be `invalid` or `storage`. |
| `census` | `total, nutag` | Player counts across the whole server; sent whenever anyone joins or leaves. |
| `lot` | `act, i, lot, by` | `act: 'buy'` or `'style'`. `lot` = `{ by, n, roof, door, furn[] }` (`by` = owner id, `n` = owner name). |
| `wr-invite` | `from, name` | You were invited. |
| `wr-declined` | `by, name` | Your invitation was declined. |
| `wr-start` | `id, a, b` | Match started. `a`, `b` = `{ id, name, look }`; `a` is the one who invited. |
| `wr-wait` | (none) | The other player has chosen; waiting for you. |
| `wr-result` | `ma, pa, mb, pb, r, score` | Round result. `r` = `1` a wins, `-1` b wins, `0` draw. `score` = `{ a, b }`. |
| `wr-end` | `id, winner, playerIds, reason` | Match over. `id` is the match id, `playerIds` are its participants, and `reason` is `''` (normal) or `'left'` (the other quit or dropped). The server grants each participant's idempotent match reward. |
| `quest-claim-result` | `quest, accepted, reason?, wallet, progress, reward?` | Reply to `quest-claim`; includes canonical wallet/progress and the fixed reward when accepted. |
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
- **Position:** clamped to the map only; no speed or wall checks.
- **Progress:** coins and XP balances persist server-side, but the one-time wallet/inventory/progress migration and generic reward requests come from the client; the server does not validate lesson/minigame results or legacy ownership. Purchases are checked against canonical balance, ownership, catalog prices and level. Bounded dairy/fish counts and daily quest state sync through revisioned snapshots, but their values are client-reported, not gameplay-validated. The shared player `lvl` is also client-reported.
- The server is the source of truth for **authenticated player ids, shared room state, wallet balances, limited shop ownership, daily quest payouts and live PvP wrestling payouts**. With PostgreSQL, shared room state and account changes work across instances. Progress snapshots synchronize storage, not achievement verification. The client still controls generic reward claims and initial migration values, so most XP/coin earning, legacy ownership, quest completion and reported levels are not cheat-proof.

## Changing the protocol

1. Change `server.js` and the client together.
2. Bump `VERSION` in `js/village/rules.js`. The web client warns when `welcome.v` doesn't match.
3. Update this file.
4. Run `node tests/multiplayer.mjs`.
