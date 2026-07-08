import type { ClientMsg, GameStateView } from "@cambio/shared";

export interface Notice {
  message: string;
  kind: "info" | "warn" | "error";
}

/**
 * What the Table/App UI needs from a game backend, whether that's the online
 * PartyKit client (`GameClient`) or the in-browser engine (`LocalController`).
 * The UI reads `view` and calls `send(...)`; it doesn't care which one it is.
 */
export interface Controller {
  readonly view: GameStateView | null;
  readonly clientId: string;
  readonly isHost: boolean;
  readonly notice: Notice | null;
  send(msg: ClientMsg): void;
  leave(): void;
}
