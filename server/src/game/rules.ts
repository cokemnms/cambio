import type { Card, Rank } from "@cambio/shared";
import { isRedSuit } from "@cambio/shared";

/**
 * ALL house-rule tweaks live here. Change values / powers / counts in one place.
 * These defaults are "standard" Cambio; the user's custom variations get
 * applied on top once confirmed.
 */

export type Power =
  | "none"
  | "peekOwn" // look at one of your own cards
  | "peekOther" // look at one opponent card
  | "blindSwap" // swap two cards without looking
  | "spySwap"; // look at one card, then optionally swap two

export interface Rules {
  handSize: number;
  initialPeekCount: number;
  losingScore: number;
  minPlayers: number;
  maxPlayers: number;
  /** Whether snapping (matching the discard rank) is allowed. */
  snapEnabled: boolean;
  /** Penalty cards drawn for a failed snap. */
  snapPenalty: number;
  /** Value of a card for end-of-round scoring. */
  cardValue: (card: Card) => number;
  /** Which power a card triggers when discarded directly from a draw. */
  cardPower: (card: Card) => Power;
}

export const DEFAULT_RULES: Rules = {
  handSize: 4,
  initialPeekCount: 2,
  losingScore: 100,
  minPlayers: 2,
  maxPlayers: 6,
  snapEnabled: true,
  snapPenalty: 1,

  cardValue: (card: Card): number => {
    const r = card.rank;
    if (r === "A") return 1;
    if (r === "J" || r === "Q") return 10;
    if (r === "K") return isRedSuit(card.suit) ? 0 : 13; // red K = 0, black K = 13
    return Number(r);
  },

  cardPower: (card: Card): Power => {
    switch (card.rank) {
      case "7":
      case "8":
        return "peekOwn";
      case "9":
      case "10":
        return "peekOther";
      case "J":
      case "Q":
        return "blindSwap";
      case "K":
        return "spySwap";
      default:
        return "none";
    }
  },
};

export function powerLabel(power: Power): string {
  switch (power) {
    case "peekOwn":
      return "Peek at one of your own cards";
    case "peekOther":
      return "Peek at an opponent's card";
    case "blindSwap":
      return "Swap any two cards (blind)";
    case "spySwap":
      return "Look at a card, then optionally swap two";
    default:
      return "";
  }
}

export function rankOrder(rank: Rank): number {
  const idx = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return idx.indexOf(rank);
}
