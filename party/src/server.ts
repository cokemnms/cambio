import type * as Party from "partykit/server";
import type { ClientMsg, ServerMsg } from "@cambio/shared";
import { Game, GameError } from "@cambio/engine";

/**
 * One PartyKit party per room. Holds a single authoritative Game and pushes a
 * per-connection REDACTED view after every mutation. The connection id is the
 * player's persistent clientId (PartySocket sets it), so reconnects reclaim the
 * same seat.
 */
export default class CambioServer implements Party.Server {
  game = new Game();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): void {
    const url = new URL(ctx.request.url);
    const name = (url.searchParams.get("name") ?? "Player").slice(0, 16);
    const clientId = conn.id;

    const isMember = this.game.players.some((p) => p.id === clientId);
    if (this.game.phase !== "lobby" && !isMember) {
      this.send(conn, { t: "closed", reason: "That game has already started" });
      conn.close();
      return;
    }
    try {
      this.game.addPlayer(clientId, name);
    } catch (e) {
      this.send(conn, { t: "closed", reason: errText(e) });
      conn.close();
      return;
    }
    this.broadcast();
  }

  onMessage(message: string, sender: Party.Connection): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(message) as ClientMsg;
    } catch {
      return;
    }
    try {
      this.handle(msg, sender.id);
      this.broadcast();
    } catch (e) {
      this.send(sender, { t: "notice", message: errText(e), kind: "error" });
    }
  }

  onClose(conn: Party.Connection): void {
    this.game.setConnected(conn.id, false);
    this.broadcast();
  }

  private handle(msg: ClientMsg, clientId: string): void {
    switch (msg.t) {
      case "setName": {
        const p = this.game.players.find((x) => x.id === clientId);
        if (p && msg.name.trim()) p.name = msg.name.slice(0, 16);
        break;
      }
      case "start":
        this.game.startGame(clientId);
        break;
      case "draw":
        this.game.drawFromDeck(clientId);
        break;
      case "swap":
        this.game.swapHeld(clientId, msg.slot);
        break;
      case "discard":
        this.game.discardHeld(clientId);
        break;
      case "peek":
        this.game.powerPeek(clientId, msg.target);
        break;
      case "powerSwap":
        this.game.powerSwap(clientId, msg.first, msg.second);
        break;
      case "skip":
        this.game.powerSkip(clientId);
        break;
      case "rematch":
        this.game.rematch(clientId);
        break;
      case "leave":
        this.game.removePlayer(clientId);
        break;
    }
  }

  private broadcast(): void {
    this.game.clearExpiredReveals();
    for (const conn of this.room.getConnections()) {
      const view = this.game.buildView(conn.id);
      view.roomCode = this.room.id;
      this.send(conn, { t: "state", view });
    }
  }

  private send(conn: Party.Connection, msg: ServerMsg): void {
    conn.send(JSON.stringify(msg));
  }
}

function errText(e: unknown): string {
  return e instanceof GameError ? e.message : "Something went wrong";
}
