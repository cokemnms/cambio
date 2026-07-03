# Cambio — v1 rules (this version)

A fast **2-player** memory game. This is a simplified variant of Cambio. The full
traditional ruleset is a planned future mode — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Setup

- **2 players.**
- Standard 52-card deck, shuffled.
- Each player is dealt **3 cards, face-down**. **No peeking at the start** — you don't
  know your own cards.
- The rest form the **draw deck**. The **discard pile starts empty**.

## Card values

| Card | Value |
|------|-------|
| A | 1 |
| 2–10 | face value |
| J | 11 |
| Q | 12 |
| K | **−1** |

Low (and negative) is good.

## A turn

Draw **exactly one card from the deck** (deck only — you cannot take from the discard).
Then choose one:

1. **Discard it directly** — the drawn card goes to the discard pile.
2. **Swap it into your hand** — put the drawn card into one of your 3 slots; the card it
   replaces goes to the discard pile.

**Whichever card lands on the discard pile this turn triggers its power, if it has one:**

- If you **discarded the drawn card**, the drawn card's power triggers.
- If you **swapped**, the **swapped-out (displaced) card's** power triggers.

Your hand is always 3 cards.

## Powers

Resolve the power of the card that hit the discard:

- **7 / 8** → Peek at **one of your opponent's** cards.
- **9 / 10** → Peek at **one of your own** cards.
- **J** → Peek at **any one card**, then **optionally** swap two cards (you may decline
  the swap after peeking).
- **Q** → **Blind swap** — swap any two cards without looking.
- **A, 2–6, K** → no power.

Peeks are private to the acting player and shown only briefly.

## Ending the game

- **No rounds. No "Cambio" call.**
- The game ends **when the draw deck runs out** (the discard pile is never reshuffled
  back into the deck).
- Reveal both hands, sum each player's 3 card values. **Lowest total wins.** Equal
  totals = a **draw**.

## Not in v1 (see [`docs/ROADMAP.md`](docs/ROADMAP.md))

- Snap / slap mechanic.
- A **Classic Cambio** mode with the full traditional rules (initial peek, calling
  Cambio, discard-draw, reshuffle, more players).
