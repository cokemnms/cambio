import { Game } from "@cambio/engine";
import type { ClientMsg, GameStateView } from "@cambio/shared";
import type { Controller, Notice } from "./controller";

/**
 * Pass-and-play: runs the engine in the browser, no server. Two players share
 * one device. The "viewer" is whoever holds the device — the active player —
 * so the board is always redacted to their perspective. Between turns a cover
 * screen (passTo) hides the board during the handoff; if a turn ends on a peek,
 * the outgoing player first gets a beat to memorize it (reviewFor).
 */
export class LocalController implements Controller {
  private g = new Game();
  private onLeave: () => void;
  private pendingActive = "";

  view = $state<GameStateView | null>(null);
  clientId = $state("");
  notice = $state<Notice | null>(null);
  passTo = $state<string | null>(null);
  reviewFor = $state<string | null>(null);
  readonly isHost = true;

  constructor(nameA: string, nameB: string, onLeave: () => void) {
    this.onLeave = onLeave;
    this.g.addPlayer("p1", (nameA || "Player 1").slice(0, 16));
    this.g.addPlayer("p2", (nameB || "Player 2").slice(0, 16));
    this.g.startGame("p1");
    this.queuePass(this.g.activePlayer.id);
    this.refresh();
  }

  get passName(): string {
    const id = this.passTo ?? this.pendingActive;
    return this.g.players.find((p) => p.id === id)?.name ?? "the next player";
  }

  send(msg: ClientMsg): void {
    if (msg.t === "leave") return this.onLeave();
    if (msg.t === "rematch") {
      try {
        this.g.rematch("p1");
      } catch {
        return;
      }
      this.reviewFor = null;
      this.queuePass(this.g.activePlayer.id);
      return this.refresh();
    }

    const actor = this.clientId;
    const before = this.g.phase === "playing" ? this.g.activePlayer.id : null;
    try {
      this.apply(msg, actor);
    } catch (e) {
      return this.flash(e instanceof Error ? e.message : "Illegal move", "error");
    }

    if (this.g.phase === "playing" && before) {
      const after = this.g.activePlayer.id;
      if (after !== before) {
        // Turn ended. If the outgoing player just peeked, let them look before
        // the board is covered; otherwise go straight to the handoff cover.
        if (this.g.reveals.some((r) => r.viewerId === before)) this.reviewFor = before;
        else this.queuePass(after);
      }
    }
    this.refresh();
  }

  /** Outgoing player is done memorizing their peek → cover and pass on. */
  finishReview(): void {
    this.reviewFor = null;
    this.queuePass(this.g.activePlayer.id);
    this.refresh();
  }

  /** The next player now holds the device. */
  ready(): void {
    this.clientId = this.pendingActive;
    this.passTo = null;
    this.refresh();
  }

  leave(): void {
    this.onLeave();
  }

  /** Testing only: drop the deck to its last few cards to reach game-end fast. */
  skipToEnd(keep = 4): void {
    if (this.g.phase !== "playing") return;
    if (this.g.deck.length > keep) this.g.deck = this.g.deck.slice(-keep);
    this.refresh();
  }

  private apply(msg: ClientMsg, id: string): void {
    switch (msg.t) {
      case "draw": this.g.drawFromDeck(id); break;
      case "swap": this.g.swapHeld(id, msg.slot); break;
      case "discard": this.g.discardHeld(id); break;
      case "peek": this.g.powerPeek(id, msg.target); break;
      case "powerSwap": this.g.powerSwap(id, msg.first, msg.second); break;
      case "skip": this.g.powerSkip(id); break;
      case "start": case "setName": case "rematch": case "leave": break;
    }
  }

  private queuePass(nextId: string): void {
    this.pendingActive = nextId;
    this.passTo = nextId;
  }

  private refresh(): void {
    const viewer = this.reviewFor || this.clientId || this.pendingActive || "p1";
    const v = this.g.buildView(viewer);
    v.roomCode = "PASS & PLAY";
    this.view = v;
  }

  private flash(message: string, kind: Notice["kind"]): void {
    this.notice = { message, kind };
    setTimeout(() => (this.notice = null), 2500);
  }
}
