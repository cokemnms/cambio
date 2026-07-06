# Roadmap — deferred features

Things intentionally left out of v1 (see [`../rules.md`](../rules.md)), to add later.

## 1. Snap / slap

Deferred from v1. Sketch of intended behavior (finalize when we build it):

- **Anytime** (even when it isn't your turn), if a card in your hand matches the
  **rank** of the current top discard, you may **snap** it — instantly send that card
  to the discard to shed it from your hand. Fewer cards generally means a lower score.
- **Wrong snap** (rank doesn't match) → **penalty**: draw a card into your hand.

Open questions to settle before implementing:

- Can you snap onto an opponent's card, or only your own?
- Race resolution when both players snap the same discard near-simultaneously.
- Interaction with the v1 end condition — snapping changes hand sizes and wrong-snaps
  pull extra cards from the deck, which affects when the deck runs out.

## 2. Classic Cambio mode (selectable)

Offer, alongside the v1 quick variant, a toggle to play the full traditional rules:

- **4 cards** each; **peek at 2** of your own at the start.
- Draw from the deck **or** take the top of the discard.
- Call **"Cambio"** on your turn to trigger everyone's final turn, then reveal.
- Deck **reshuffles** from the discard when it runs out.
- Traditional values/powers (e.g. red K = 0, black K = 13).
- **Match play** to a losing score (e.g. first to 100 loses; lowest total is champion).
- **2–6 players.**

**Implementation note:** keep all rule variation isolated in `engine/src/rules.ts` and
drive game flow through an explicit phase state machine. Done right, Classic mode is a
selectable **Rules preset** plus a few extra phase transitions (initial peek, Cambio
call, reshuffle) — not a rewrite of the engine.

## 3. Production hardening (before deploy / scale)

- **Persist game state to `room.storage` + restore in `onStart()`.** Per the PartyKit
  docs, the in-memory `Game` on the party instance is only guaranteed to live while the
  party is active and hibernation is off (our current setup). To survive redeploys,
  eviction, or enabling hibernation, serialize the game to `this.room.storage` on each
  mutation and rehydrate in `onStart()`. Deferred for v1 (short, actively-connected
  games) — deliberate tradeoff, not an oversight.
- **Enable hibernation** (`options: { hibernate: true }`) for cost/scale once storage
  persistence is in place.
- **Room-code allocation:** today the first connector to any code becomes host (join =
  create-or-join). Add real "create vs join" validation so a typo'd code fails cleanly.
