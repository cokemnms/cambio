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

**Implementation note:** keep all rule variation isolated in
`server/src/game/rules.ts` and drive game flow through an explicit phase state machine.
Done right, Classic mode is a selectable **Rules preset** plus a few extra phase
transitions (initial peek, Cambio call, reshuffle) — not a rewrite of the engine.
