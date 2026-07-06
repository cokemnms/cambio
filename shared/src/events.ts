import type { GameStateView } from "./state.js";

/** A card slot reference (whose hand, which position). */
export interface SlotRef {
  playerId: string;
  slot: number;
}

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
  | { t: "leave" };

/** Server → client pushes. */
export type ServerMsg =
  | { t: "state"; view: GameStateView }
  | { t: "notice"; message: string; kind?: "info" | "warn" | "error" }
  | { t: "closed"; reason: string };
