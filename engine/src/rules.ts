import type { Card } from "@cambio/shared";

/**
 * ALL house-rule tweaks live here. v1 = the simplified 2-player, deck-exhaustion
 * variant (see rules.md). A future "Classic" preset would be another Rules object.
 */

export type Power =
  | "none"
  | "peekOpponent" // 7/8 — peek one opponent card
  | "peekOwn" // 9/10 — peek one of your own
  | "jackPeekSwap" // J — peek any card, then optionally swap it with one of yours
  | "queenSwap"; // Q — blind swap any two cards

export interface Rules {
  handSize: number;
  playerCount: number; // exact number of players required to start
  cardValue: (card: Card) => number;
  cardPower: (card: Card) => Power;
}

export const V1_RULES: Rules = {
  handSize: 3,
  playerCount: 2,

  cardValue: (card: Card): number => {
    const r = card.rank;
    if (r === "A") return 1;
    if (r === "J") return 11;
    if (r === "Q") return 12;
    if (r === "K") return -1;
    return Number(r);
  },

  cardPower: (card: Card): Power => {
    switch (card.rank) {
      case "7":
      case "8":
        return "peekOpponent";
      case "9":
      case "10":
        return "peekOwn";
      case "J":
        return "jackPeekSwap";
      case "Q":
        return "queenSwap";
      default:
        return "none";
    }
  },
};

export function powerLabel(power: Power): string {
  switch (power) {
    case "peekOpponent":
      return "Peek at one of your opponent's cards";
    case "peekOwn":
      return "Peek at one of your own cards";
    case "jackPeekSwap":
      return "Peek a card, then optionally swap it with one of yours";
    case "queenSwap":
      return "Swap any two cards (blind)";
    default:
      return "";
  }
}
