import type { GameStateView } from "./state.js";
import type { Rank, Suit } from "./cards.js";

/** A card slot reference (whose hand, which position). */
export interface SlotRef {
  playerId: string;
  slot: number;
}

/**
 * God-mode dev actions. Only honored by the server when the message carries the
 * correct DEV_SECRET (a server-side secret, never shipped to clients). Lets a
 * dev see everything and set any card. Inert in a normal build.
 */
export type DevAction =
  | { kind: "godView"; on: boolean }
  | { kind: "setSlot"; target: SlotRef; rank: Rank; suit: Suit }
  | { kind: "setHeld"; rank: Rank; suit: Suit }
  | { kind: "setDeckTop"; rank: Rank; suit: Suit }
  | { kind: "setTurn"; playerId: string }
  | { kind: "endGame" };

/**
 * Wire protocol. PartyKit passes raw messages (no ack callbacks), so both sides
 * speak these tagged unions. `clientId` and room come from the connection, not
 * the message.
 */

/** Client → server intents. */
export type ClientMsg =
  | { t: "setName"; name: string }
  | { t: "start" }
  | { t: "draw" }
  | { t: "swap"; slot: number }
  | { t: "discard" }
  | { t: "peek"; target: SlotRef }
  | { t: "powerSwap"; first: SlotRef; second: SlotRef }
  | { t: "skip" }
  | { t: "rematch" }
  | { t: "leave" }
  | { t: "dev"; secret: string; action: DevAction };

/** Server → client pushes. */
export type ServerMsg =
  | { t: "state"; view: GameStateView }
  | { t: "notice"; message: string; kind?: "info" | "warn" | "error" }
  | { t: "welcome"; token: string } // per-seat secret; resend on rejoin to reclaim
  | { t: "closed"; reason: string };
