# Cambio 🃏

Online, real-time, mobile-first **Cambio** card game. Spin up a room, share the
room code (or a link), and play live from any phone's browser — or pass one
device around the table.

No database, no login. Game state lives in memory, one authoritative game per
room, and every client only ever sees the cards it's allowed to see.

## Two ways to play

- **Online** — one player hosts a room and shares the code; others join from
  their own devices over the internet. Reconnect from any device by re-entering
  the same name + room code.
- **Pass & play** — a single device runs the whole game locally and hands off
  between players (with a "look away" cover between turns). No connection needed.

## Stack

A TypeScript monorepo (npm workspaces), no backend server to manage:

- **`shared/`** — the network contract: card/state/event types shared by both
  sides. Change a payload here and both consumers update against one source.
- **`engine/`** — the authoritative game logic (deck, turns, powers, scoring,
  per-viewer redaction). Pure and isomorphic, so it runs both on the server and
  in the browser for pass & play.
- **`party/`** — a [PartyKit](https://docs.partykit.io) server: one *party* per
  room. Holds the single authoritative `Game` and pushes a **redacted** view to
  each connection after every move — a hidden card's rank/suit never reaches a
  client that shouldn't see it.
- **`client/`** — [Svelte 5](https://svelte.dev) + [Vite](https://vitejs.dev),
  mobile-first. Two switchable table themes and synthesized sound effects.

The client renders state and sends intents; the server decides every outcome.

## Run it locally

```bash
npm install      # installs all workspaces
npm run dev      # runs the PartyKit server (:1999) and the client (:5173) together
```

Open the printed **Network** URL on your phone (same Wi-Fi) — e.g.
`http://192.168.1.x:5173`. Host a room on one device, join with the code on
another. Run them separately if you prefer:

```bash
npm run dev:party
npm run dev:client
```

## Test

```bash
npm test         # headless engine smoke checks (engine/src/smoke.ts)
```

These drive the `Game` engine directly and assert on phases, scores, and
redaction (hidden cards stay hidden) — no browser needed.

## Deploy

Deployed via PartyKit → Cloudflare. One command builds the client and ships both
the UI and the realtime server to the same origin:

```bash
npx partykit login   # first time only — browser GitHub auth
npm run deploy
```

It provisions `https://cambio.<your-github-username>.partykit.dev` (HTTPS/wss,
works from anywhere). Reload to pick up a new deploy — pushing to git does not
deploy on its own. In-memory rooms reset on deploy, so ship when nobody's
mid-game.

## The v1 ruleset

The current game is a simplified **2-player, deck-exhaustion** variant. All
rule tweaks live in one place — [`engine/src/rules.ts`](engine/src/rules.ts) —
so nothing rule-related is scattered into the engine or UI.

- **2 players, 3 cards each**, dealt face-down (no starting peek).
- **Card values:** A = 1 · 2–10 = face value · J = 11 · Q = 12 · **K = −1**.
- **Powers** trigger when a card is thrown onto the discard:
  - **7 / 8** — peek at one of your **opponent's** cards
  - **9 / 10** — peek at one of your **own** cards
  - **J** — peek any card, then optionally swap it with one of yours
  - **Q** — blind-swap any two cards (across the two hands)
- On your turn: draw the top card, then either **swap** it into your hand
  (discarding the replaced card) or **throw it away**. You can't swap between
  your own cards.
- **The game ends the moment the draw deck runs out.** Lowest hand total wins;
  equal totals are a draw.

No snap, no calling "Cambio", no initial peek — those belong to classic Cambio,
which is planned as a separate start-screen mode.

## Configuration

- **`VITE_PARTY_HOST`** *(client, optional)* — override the backend host. Defaults
  to `<host>:1999` in dev and the page's own origin in production.
