# Naadamy multiplayer protocol

This is how a game client (the web game today, maybe a Unity client later) talks to `server.js`.
It describes protocol **version 4** (`VERSION` in `js/village/rules.js`).

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
| `id` | Player id, `[\w-]{4,24}`. The client makes it once per profile (`'u' + random + time`) and keeps it. **Not checked by the server:** anyone can claim any id. |
| `room` | Room code, `^[A-Z0-9]{3,8}$` (upper-cased by the server). `NUTAG` is the main village. |
| `x`, `y` | Position in tiles (the map is `W` 56 × `H` 40), 2 decimals. Clamped to `0.5 … W-2` / `0.5 … H-2`. |
| `dir` | Facing direction: `0` down, `1` left, `2` right, `3` up. |
| `look` | Outfit: `{ deel, skin, title, hat, face, neck, pet, … }`. Each value must be in `DEELS` / `SKINS` / `LOOKS`; anything else becomes the default or `null` (`cleanLook`). |
| `lvl` | Player level, `1 … 99`. |
| `name` | Display name. `<` and `>` are removed, max 16 chars, default `Найз`. |

Public player object (`pub`): `{ id, name, look, lvl, x, y, dir }`.

## Client → server

### Presence
| `t` | Fields | What it does |
|---|---|---|
| `join` | `room, id, name, look, lvl, x, y, dir` | Enter a room. Joining again on the same connection leaves the old room first. If the same `id` is already in the room, the older connection gets `replaced` and is closed. |
| `move` | `x, y, dir` | New position. The web client sends it about 10 times a second while moving. |
| `jump` | (none) | Shows a jump to others. At most once every 300 ms; extra ones are dropped. |
| `look` | `look, lvl` | Changed outfit or level. |

### Chat (preset only)
| `t` | Fields | What it does |
|---|---|---|
| `say` | `k, i` | `k: 'p'` = phrase `PHRASES[i]`, `k: 'e'` = emote `EMOTES[i]`. `i` must be a valid integer index. There is **no typed text**, by design (safe for kids). Sent to everyone in the room, **including the sender**. At most **one per second** per player; extra ones are dropped silently. Added to the room's chat log. |

### Chat log
Each room keeps its last **30** lines: phrases, emotes, joins and leaves. The log is sent in `welcome.chat`, so a player who joins late sees what was said. The server saves this bounded log alongside room lots every 5 seconds when changed and on shutdown. Without `DATABASE_URL`, the store is `DATA_DIR/rooms.json`; with `DATABASE_URL`, it is the `naadamy_rooms` PostgreSQL table. PostgreSQL startup imports room codes missing from the database from the legacy JSON file without overwriting existing database rows. Older room records without a `chat` field start with an empty log. On load, entries are validated against the preset phrase/emote lists and cleaned before being sent to players.

When PostgreSQL is configured, each server also records its active players in `naadamy_players` and uses PostgreSQL `LISTEN`/`NOTIFY` to share room joins, leaves, moves, looks, jumps and preset chat with the other instances. Presence expires after 60 seconds without a server heartbeat. Without PostgreSQL, the existing in-process WebSocket room behavior is unchanged. This synchronization does not make ger snapshots or live wrestling state shared; those still require a single server instance.

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

Room lots and the recent chat log are saved every 5 seconds when changed and on shutdown. The default store is `DATA_DIR/rooms.json`; when `DATABASE_URL` is configured, PostgreSQL is authoritative and the server stores the room snapshot in `naadamy_rooms`. Coins are **not** checked by the server; the client takes off `GER_PRICE` when it sees its own `lot` `buy`.

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
| `welcome` | `v, now, room, players[], lots[], chat[]` | Reply to `join`. `v` = server protocol version (compare with your `VERSION`), `now` = server clock in ms, `players` = everyone else as `pub`, `lots` = `LOTS` entries (`null` or a lot), `chat` = the room's recent log lines, oldest first (see Chat log). |
| `join` | `p` | Someone entered your room (`pub`). |
| `leave` | `id` | Someone left or dropped. |
| `move` | `id, x, y, dir` | Someone moved. |
| `jump` | `id` | Someone jumped. |
| `look` | `id, look, lvl` | Someone changed outfit or level. |
| `say` | `id, k, i` | Someone said a phrase or emote (your own included). |
| `census` | `total, nutag` | Player counts across the whole server; sent whenever anyone joins or leaves. |
| `lot` | `act, i, lot, by` | `act: 'buy'` or `'style'`. `lot` = `{ by, n, roof, door, furn[] }` (`by` = owner id, `n` = owner name). |
| `wr-invite` | `from, name` | You were invited. |
| `wr-declined` | `by, name` | Your invitation was declined. |
| `wr-start` | `id, a, b` | Match started. `a`, `b` = `{ id, name, look }`; `a` is the one who invited. |
| `wr-wait` | (none) | The other player has chosen; waiting for you. |
| `wr-result` | `ma, pa, mb, pb, r, score` | Round result. `r` = `1` a wins, `-1` b wins, `0` draw. `score` = `{ a, b }`. |
| `wr-end` | `winner, reason` | Match over. `reason`: `''` (normal) or `'left'` (the other quit or dropped). |
| `deny` | `act, why` | Request refused. `act: 'ger'` → `why: 'taken' \| 'own'`; `act: 'wr'` → `why: 'busy'`. |
| `error` | `why` | `why: 'bad-join'` = bad room code or id. A refused `join` doesn't change anything: a player already in a room stays there. |
| `replaced` | (none) | Your id joined from another tab or device; this connection will close. Don't reconnect. |

### Wrestling rules (server side)
- A player who doesn't pick a move within 25 s gets a random move with power `0.15`.
- Each move beats the next half of the `MOVES` circle (`beats`). Score per side: `0.6` for a winning move, `0.3` for the same move, `0` for a losing one, plus `0.8 × power`. A gap under `0.04` is a draw (`exchange`).
- First to 2 round wins takes the match.

## What the server trusts the client with

Good to know before building on this:
- **Identity:** `id` and `name` are taken as sent. There is no check that a player is who they say they are.
- **Position:** clamped to the map only; no speed or wall checks.
- **Progress:** XP, coins, items, dairy, fishing and quests are all on the device (`localStorage`). The server never sees them, apart from `lvl`.
- The server is the source of truth only for **who is in the room, ger lots and wrestling matches**.

## Changing the protocol

1. Change `server.js` and the client together.
2. Bump `VERSION` in `js/village/rules.js`. The web client warns when `welcome.v` doesn't match.
3. Update this file.
4. Run `node tests/multiplayer.mjs`.
