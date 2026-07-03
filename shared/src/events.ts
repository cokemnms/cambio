import type { GameStateView } from "./state.js";

/** A card slot reference (whose hand, which position). */
export interface SlotRef {
  playerId: string;
  slot: number;
}

export interface Ack<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Events the client sends to the server. Each takes an ack callback. */
export interface ClientToServerEvents {
  createRoom: (
    p: { name: string },
    ack: (r: Ack<{ roomCode: string; youId: string }>) => void
  ) => void;
  joinRoom: (
    p: { code: string; name: string },
    ack: (r: Ack<{ roomCode: string; youId: string }>) => void
  ) => void;
  leaveRoom: (ack?: (r: Ack) => void) => void;
  startGame: (ack?: (r: Ack) => void) => void;

  // Initial peek phase
  peekCard: (p: { slot: number }, ack?: (r: Ack) => void) => void;
  peekReady: (ack?: (r: Ack) => void) => void;

  // Turn actions
  drawFromDeck: (ack?: (r: Ack) => void) => void;
  takeFromDiscard: (ack?: (r: Ack) => void) => void;
  swapHeld: (p: { slot: number }, ack?: (r: Ack) => void) => void;
  discardHeld: (ack?: (r: Ack) => void) => void;

  // Power resolution (only valid in turnPhase === "power")
  powerPeek: (p: { target: SlotRef }, ack?: (r: Ack) => void) => void;
  powerSwap: (p: { first: SlotRef; second: SlotRef }, ack?: (r: Ack) => void) => void;
  powerSkip: (ack?: (r: Ack) => void) => void;

  // Anytime actions
  snap: (p: { slot: number }, ack?: (r: Ack) => void) => void;
  callCambio: (ack?: (r: Ack) => void) => void;

  // Post-round
  rematch: (ack?: (r: Ack) => void) => void;
}

/** Events the server pushes to the client. */
export interface ServerToClientEvents {
  state: (view: GameStateView) => void;
  notice: (p: { message: string; kind?: "info" | "warn" | "error" }) => void;
  roomClosed: (p: { reason: string }) => void;
}
