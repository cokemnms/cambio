import type { CardView } from "./cards.js";

export type Phase =
  | "lobby" // waiting for players, host can start
  | "peek" // initial peek: players look at 2 of their own cards
  | "playing" // normal turns
  | "roundEnd" // scores for the round revealed
  | "gameEnd"; // someone crossed the losing score / match over

/**
 * Sub-state of the active player's turn. Drives which actions the UI offers.
 */
export type TurnPhase =
  | "draw" // must draw from deck or take top of discard
  | "decide" // holding a drawn card: swap into hand, or discard (maybe power)
  | "power" // resolving a drawn card's power (peek / swap / spy)
  | "idle"; // not this client's decision point

export type PowerKind =
  | "peekOwn"
  | "peekOther"
  | "blindSwap"
  | "spySwap";

/** A player as visible to a given client (own hidden cards stay hidden). */
export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Slots; a slot may be null once its card has been shed (e.g. via snap). */
  hand: (CardView | null)[];
  /** Running match score across rounds. */
  score: number;
  /** True once this player has called Cambio. */
  calledCambio: boolean;
}

/** The card currently held by the active player after drawing (redacted). */
export interface HeldCard {
  card: CardView;
  /** Where it came from, so the UI can explain the options. */
  source: "deck" | "discard";
}

/** A transient reveal the viewer is allowed to see (peeks, power spies). */
export interface Reveal {
  playerId: string;
  slot: number;
  card: CardView; // always faceUp
  /** ms epoch when this reveal expires on the client (for UX timers). */
  expiresAt?: number;
}

/** Full redacted snapshot sent to one client whenever state changes. */
export interface GameStateView {
  roomCode: string;
  phase: Phase;
  players: PlayerView[];
  /** Index into players[] whose turn it is. */
  activePlayerIndex: number;
  turnPhase: TurnPhase;
  /** Active power being resolved (only for the active client in "power"). */
  pendingPower: PowerKind | null;
  /** For spySwap: true once the peek step is done and a swap may follow. */
  spyReadyToSwap: boolean;
  /** Only populated for the client whose turn it is. */
  held: HeldCard | null;
  discardTop: CardView | null;
  deckCount: number;
  /** Cards this client is currently allowed to see face-up. */
  reveals: Reveal[];
  /** Id of the player who called Cambio, if any. */
  cambioCalledBy: string | null;
  /** Human-readable log of recent actions. */
  log: string[];
  /** Populated in roundEnd / gameEnd. */
  results: RoundResult[] | null;
  /** Score at which a player loses the match. */
  losingScore: number;
  /** The client's own player id (convenience). */
  youId: string;
}

export interface RoundResult {
  playerId: string;
  name: string;
  roundPoints: number;
  totalScore: number;
  isWinner: boolean;
}

/** Lightweight lobby summary (for the join/create screens). */
export interface RoomSummary {
  code: string;
  playerCount: number;
  maxPlayers: number;
  phase: Phase;
}
