import type { CardView } from "./cards.js";

export type Phase =
  | "lobby" // waiting for 2 players; host can start
  | "playing" // turns in progress
  | "gameEnd"; // deck exhausted, hands revealed, winner decided

/** Sub-state of the active player's turn. Drives which actions the UI offers. */
export type TurnPhase =
  | "draw" // must draw the one card from the deck
  | "decide" // holding the drawn card: discard it, or swap it into a slot
  | "power" // resolving the power of the card that hit the discard
  | "idle"; // not this client's decision point

export type PowerKind =
  | "peekOpponent" // 7/8 — peek one opponent card
  | "peekOwn" // 9/10 — peek one of your own
  | "jackPeekSwap" // J — peek any card, then optionally swap it with one of yours
  | "queenSwap"; // Q — blind swap any two cards

/** A player as visible to a given client (hidden cards stay hidden). */
export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Slots; length is always the hand size (3 in v1). */
  hand: (CardView | null)[];
}

/** The card currently held by the active player after drawing (redacted). */
export interface HeldCard {
  card: CardView;
}

/** A transient reveal the viewer is allowed to see (peeks). */
export interface Reveal {
  playerId: string;
  slot: number;
  card: CardView; // always faceUp
  /** ms epoch when this reveal expires on the client (for UX timers). */
  expiresAt?: number;
}

export interface PlayerTotal {
  playerId: string;
  name: string;
  total: number;
}

export interface GameResult {
  /** null == draw (equal totals). */
  winnerId: string | null;
  totals: PlayerTotal[];
}

/** Full redacted snapshot sent to one client whenever state changes. */
export interface GameStateView {
  roomCode: string;
  phase: Phase;
  players: PlayerView[];
  /** Index into players[] whose turn it is. */
  activePlayerIndex: number;
  /** "idle" for everyone except the active client. */
  turnPhase: TurnPhase;
  /** Active power being resolved (only for the active client in "power"). */
  pendingPower: PowerKind | null;
  /** For J: true once the peek is done and an optional swap may follow. */
  jackAwaitingSwap: boolean;
  /** Only populated for the client whose turn it is. */
  held: HeldCard | null;
  discardTop: CardView | null;
  deckCount: number;
  /** Cards this client is currently allowed to see face-up. */
  reveals: Reveal[];
  /** Human-readable log of recent actions. */
  log: string[];
  /** Populated at gameEnd. */
  result: GameResult | null;
  /** The client's own player id (convenience). */
  youId: string;
}

/** Lightweight lobby summary. */
export interface RoomSummary {
  code: string;
  playerCount: number;
  maxPlayers: number;
  phase: Phase;
}
