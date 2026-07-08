import type { Card, Rank, Suit } from "@cambio/shared";
import { RANKS, SUITS } from "@cambio/shared";

// Portable unique-id generator: works in Node, the PartyKit worker, and the
// browser (pass-and-play runs the engine client-side). `crypto.getRandomValues`
// exists in all three; the counter guarantees uniqueness even without it.
let idCounter = 0;
function cardId(): string {
  idCounter += 1;
  const c = globalThis.crypto;
  let suffix: string;
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(4));
    suffix = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  } else {
    suffix = Math.floor(Math.random() * 0xffffffff).toString(16);
  }
  return `c${idCounter.toString(36)}-${suffix}`;
}

/** Make a specific card with a fresh unique id (used by dev/god-mode tools). */
export function makeCard(rank: Rank, suit: Suit): Card {
  return { id: cardId(), rank, suit };
}

/** Build a standard 52-card deck with unique physical ids. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: cardId(), rank, suit });
    }
  }
  return cards;
}

/** In-place Fisher-Yates shuffle. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
