import type * as Party from "partykit/server";
import type { ClientMsg, ServerMsg } from "@cambio/shared";
import { seatKey } from "@cambio/shared";
import { Game, GameError } from "@cambio/engine";

/**
 * One PartyKit party per room. Holds a single authoritative Game and pushes a
 * per-connection REDACTED view after every mutation. The connection id is the
 * player's persistent clientId (PartySocket sets it), so reconnects reclaim the
 * same seat.
 */
export default class CambioServer implements Party.Server {
  game = new Game();
  /** Live connection id -> name-based seat key. */
  seats = new Map<string, string>();
  /** Seat key -> secret token, minted on first claim so the owner is recognized. */
  tokens = new Map<string, string>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): void {
    const url = new URL(ctx.request.url);
    const name = (url.searchParams.get("name") ?? "Player").slice(0, 16);
    const token = url.searchParams.get("token") ?? "";
    const key = seatKey(name);

    const existing = this.game.players.some((p) => p.id === key);
    const liveElsewhere = [...this.seats.values()].includes(key);
    const isOwner = this.tokens.get(key) !== undefined && token === this.tokens.get(key);

    // The name is held by a live connection and you can't prove you own it.
    if (existing && liveElsewhere && !isOwner) {
      this.send(conn, { t: "closed", reason: "That name is taken in this room" });
      conn.close();
      return;
    }
    if (this.game.phase !== "lobby" && !existing) {
      this.send(conn, { t: "closed", reason: "That game has already started" });
      conn.close();
      return;
    }
    try {
      this.game.addPlayer(key, name);
    } catch (e) {
      this.send(conn, { t: "closed", reason: errText(e) });
      conn.close();
      return;
    }

    let seatTok = this.tokens.get(key);
    if (!seatTok) {
      seatTok = newToken();
      this.tokens.set(key, seatTok);
    }
    this.seats.set(conn.id, key);
    this.send(conn, { t: "welcome", token: seatTok });
    this.broadcast();
  }

  onMessage(message: string, sender: Party.Connection): void {
    const key = this.seats.get(sender.id);
    if (!key) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(message) as ClientMsg;
    } catch {
      return;
    }
    try {
      this.handle(msg, key);
      this.broadcast();
    } catch (e) {
      this.send(sender, { t: "notice", message: errText(e), kind: "error" });
    }
  }

  onClose(conn: Party.Connection): void {
    const key = this.seats.get(conn.id);
    this.seats.delete(conn.id);
    // Only mark the seat offline if no other live connection holds it (same
    // player may be open on another device).
    if (key && ![...this.seats.values()].includes(key)) {
      this.game.setConnected(key, false);
    }
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
      case "leave": {
        const leaver = this.game.players.find((p) => p.id === clientId);
        const name = leaver?.name ?? "A player";
        const wasPlaying = this.game.phase === "playing";
        this.game.removePlayer(clientId);
        if (wasPlaying && this.game.phase === "lobby") {
          for (const conn of this.room.getConnections()) {
            if (conn.id !== clientId)
              this.send(conn, {
                t: "notice",
                message: `${name} left the game`,
                kind: "warn",
              });
          }
        }
        break;
      }
      case "dev":
        this.applyDev(msg, clientId);
        break;
    }
  }

  private applyDev(msg: Extract<ClientMsg, { t: "dev" }>, viewerKey: string): void {
    const secret = this.room.env.DEV_SECRET as string | undefined;
    if (!secret || msg.secret !== secret) return; // no secret -> channel is dead
    const a = msg.action;
    switch (a.kind) {
      case "godView": this.game.setGodView(viewerKey, a.on); break;
      case "setSlot": this.game.devSetSlot(a.target.playerId, a.target.slot, a.rank, a.suit); break;
      case "setHeld": this.game.devSetHeld(a.rank, a.suit); break;
      case "setDeckTop": this.game.devSetDeckTop(a.rank, a.suit); break;
      case "setTurn": this.game.devSetTurn(a.playerId); break;
      case "endGame": this.game.devEndGame(); break;
    }
  }

  private broadcast(): void {
    this.game.clearExpiredReveals();
    for (const conn of this.room.getConnections()) {
      const key = this.seats.get(conn.id);
      if (!key) continue;
      const view = this.game.buildView(key);
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

function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
