# Cambio 🃏

Online, real-time, mobile-first **Cambio** card game. Create a room, share the
4-letter code (or a link), and play live from any phone's browser.

## Stack

- **shared/** — TypeScript types shared by client & server (the network contract)
- **server/** — Node + Express + Socket.IO, authoritative game engine (clients
  never receive hidden cards — state is redacted per player)
- **client/** — Vite + React + TypeScript, mobile-first UI

## Run it locally

```bash
npm install          # installs all workspaces
npm run dev          # starts server (:3001) and client (:5173) together
```

Then open the printed **Network** URL on your phone (same Wi-Fi) — e.g.
`http://192.168.1.x:5173`. Create a room on one device, join with the code on
another.

Run them separately if you prefer:

```bash
npm run dev:server
npm run dev:client
```

## House rules

All rule tweaks live in one place: [`server/src/game/rules.ts`](server/src/game/rules.ts)
— card values, card powers, hand size, initial peeks, losing score, snap on/off.

Current defaults (standard Cambio):

- 4 cards each, peek at 2 to start
- A=1, 2–10 face value, J/Q=10, red K=0, black K=13
- Powers on discard: 7/8 peek own · 9/10 peek opponent · J/Q blind swap · K spy+swap
- Snap the discard rank anytime (wrong snap = +1 card)
- Call **Cambio** to trigger everyone's last turn; lowest total wins
- First to 100 loses the match

## Configuration

- `server`: `PORT` (default 3001), `CLIENT_ORIGIN` (CORS, default `*`)
- `client`: `VITE_SERVER_URL` (defaults to `http://<host>:3001`)
