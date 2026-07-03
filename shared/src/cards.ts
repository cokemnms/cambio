// Card model. The server holds full cards; clients receive redacted CardViews.

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  /** Stable unique id for a physical card — used for animation tracking. */
  id: string;
  rank: Rank;
  suit: Suit;
}

export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/**
 * A card as seen by a particular client. When `faceUp` is false the rank/suit
 * are omitted entirely, so hidden cards cannot be read from network traffic.
 */
export interface CardView {
  id: string;
  faceUp: boolean;
  rank?: Rank;
  suit?: Suit;
  /** Scoring value under the active ruleset — only present when faceUp. */
  value?: number;
}
