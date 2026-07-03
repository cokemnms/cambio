import type { Card } from "@cambio/shared";
import { RANKS, SUITS } from "@cambio/shared";
import { makeId } from "../util/ids.js";

/** Build a standard 52-card deck with unique physical ids. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: makeId(), rank, suit });
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
