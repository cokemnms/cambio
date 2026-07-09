import type {
  Card,
  CardView,
  GameResult,
  GameStateView,
  PlayerView,
  Rank,
  Reveal,
  SlotRef,
  Suit,
} from "@cambio/shared";
import { V1_RULES, type Power, type Rules } from "./rules.js";
import { buildDeck, shuffle } from "./deck.js";

interface EnginePlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  hand: (Card | null)[];
}

interface InternalReveal {
  viewerId: string;
  playerId: string;
  slot: number;
  expiresAt: number;
}

// A physical location a card can occupy — used by the dev rig tools to move a
// real card into a target position without ever fabricating one.
type Loc =
  | { z: "deck"; i: number }
  | { z: "discard"; i: number }
  | { z: "held" }
  | { z: "hand"; p: EnginePlayer; slot: number };

export type Phase = GameStateView["phase"];
export type TurnPhase = GameStateView["turnPhase"];

const REVEAL_MS = 6000;

export class GameError extends Error {}

/**
 * Server-authoritative Cambio (v1) game. One instance per room. All mutations go
 * through validated methods; clients only ever receive redacted views.
 */
export class Game {
  rules: Rules;
  players: EnginePlayer[] = [];
  deck: Card[] = [];
  discard: Card[] = [];
  phase: Phase = "lobby";
  turnPhase: TurnPhase = "idle";
  activeIndex = 0;
  held: Card | null = null;
  pendingPower: Power = "none";
  /** For J: the card peeked during the power, awaiting an optional swap. */
  jackPeeked: SlotRef | null = null;
  reveals: InternalReveal[] = [];
  /** Viewer ids with god-mode (see all cards). Server-gated; empty in normal play. */
  godViewers = new Set<string>();
  log: string[] = [];
  result: GameResult | null = null;

  constructor(rules: Rules = V1_RULES) {
    this.rules = rules;
  }

  // ---- Player management (lobby) --------------------------------------

  addPlayer(id: string, name: string): EnginePlayer {
    const existing = this.players.find((p) => p.id === id);
    if (existing) {
      existing.connected = true;
      if (name) existing.name = name;
      return existing;
    }
    if (this.phase !== "lobby") throw new GameError("Game already started");
    if (this.players.length >= this.rules.playerCount)
      throw new GameError("Room is full");
    const p: EnginePlayer = {
      id,
      name,
      isHost: this.players.length === 0,
      connected: true,
      hand: [],
    };
    this.players.push(p);
    return p;
  }

  /**
   * Intentional leave (the player tapped "Leave"). The seat is freed for real.
   * A transient disconnect goes through setConnected() instead, which keeps the
   * seat so the player can rejoin. Leaving mid-game aborts the room to the lobby
   * since a 2-player game can't continue a player short.
   */
  removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const { isHost: wasHost, name } = this.players[idx];
    const wasPlaying = this.phase === "playing";
    this.players.splice(idx, 1);
    if (wasHost && this.players.length > 0) this.players[0].isHost = true;
    if (wasPlaying) this.abortToLobby(`${name} left — back to the lobby`);
  }

  private abortToLobby(reason: string): void {
    this.phase = "lobby";
    this.turnPhase = "idle";
    this.activeIndex = 0;
    this.deck = [];
    this.discard = [];
    this.reveals = [];
    this.held = null;
    this.pendingPower = "none";
    this.jackPeeked = null;
    this.result = null;
    for (const p of this.players) p.hand = [];
    this.log = [reason];
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.players.find((x) => x.id === id);
    if (p) p.connected = connected;
  }

  get host(): EnginePlayer | undefined {
    return this.players.find((p) => p.isHost);
  }

  get activePlayer(): EnginePlayer {
    return this.players[this.activeIndex];
  }

  // ---- Game lifecycle -------------------------------------------------

  startGame(byId: string): void {
    if (!this.isHost(byId)) throw new GameError("Only the host can start");
    if (this.phase !== "lobby" && this.phase !== "gameEnd")
      throw new GameError("Cannot start now");
    if (this.players.length !== this.rules.playerCount)
      throw new GameError(`Need exactly ${this.rules.playerCount} players`);

    this.deck = shuffle(buildDeck());
    this.discard = [];
    this.reveals = [];
    this.result = null;
    this.held = null;
    this.pendingPower = "none";
    this.jackPeeked = null;
    this.log = [];

    for (const p of this.players) {
      p.hand = [];
      for (let i = 0; i < this.rules.handSize; i++) p.hand.push(this.deck.pop()!);
    }
    this.phase = "playing";
    this.turnPhase = "draw";
    this.activeIndex = 0;
    this.pushLog(`Game on — ${this.activePlayer.name}'s turn`);
  }

  rematch(byId: string): void {
    if (!this.isHost(byId)) throw new GameError("Only the host can restart");
    if (this.phase !== "gameEnd") throw new GameError("Game is not over");
    this.phase = "lobby";
    this.startGame(byId);
  }

  // ---- Turn actions ---------------------------------------------------

  drawFromDeck(playerId: string): void {
    this.assertActiveTurn(playerId, "draw");
    if (this.deck.length === 0) {
      this.endGame();
      return;
    }
    this.held = this.deck.pop()!;
    this.turnPhase = "decide";
    this.pushLog(`${this.activePlayer.name} drew a card`);
  }

  swapHeld(playerId: string, slot: number): void {
    this.assertActiveTurn(playerId, "decide");
    const p = this.activePlayer;
    if (slot < 0 || slot >= p.hand.length) throw new GameError("Bad slot");
    const displaced = p.hand[slot];
    p.hand[slot] = this.held;
    this.held = null;
    if (displaced) {
      this.discard.push(displaced);
      this.pushLog(`${p.name} swapped in at #${slot + 1}`);
      this.resolveDiscardPower(displaced);
    } else {
      this.endTurn();
    }
  }

  discardHeld(playerId: string): void {
    this.assertActiveTurn(playerId, "decide");
    const card = this.held!;
    this.discard.push(card);
    this.held = null;
    this.pushLog(`${this.activePlayer.name} discarded ${card.rank}`);
    this.resolveDiscardPower(card);
  }

  /** After a card reaches the discard, use its power (or end the turn). */
  private resolveDiscardPower(card: Card): void {
    const power = this.rules.cardPower(card);
    if (power === "none") {
      this.endTurn();
      return;
    }
    this.pendingPower = power;
    this.jackPeeked = null;
    this.turnPhase = "power";
    this.pushLog(`${this.activePlayer.name} uses ${card.rank}'s power`);
  }

  // ---- Power resolution ----------------------------------------------

  powerPeek(playerId: string, target: SlotRef): void {
    this.assertActiveTurn(playerId, "power");
    const owner = this.mustPlayer(target.playerId);
    if (!owner.hand[target.slot]) throw new GameError("No card there");

    if (this.pendingPower === "peekOpponent") {
      if (target.playerId === playerId)
        throw new GameError("Peek an opponent's card");
      this.addReveal(playerId, target.playerId, target.slot);
      this.pushLog(`${this.activePlayer.name} peeked an opponent's card`);
      this.endTurn();
    } else if (this.pendingPower === "peekOwn") {
      if (target.playerId !== playerId)
        throw new GameError("Peek one of your own cards");
      this.addReveal(playerId, target.playerId, target.slot);
      this.pushLog(`${this.activePlayer.name} peeked their own card`);
      this.endTurn();
    } else if (this.pendingPower === "jackPeekSwap") {
      if (this.jackPeeked) throw new GameError("Already peeked");
      this.addReveal(playerId, target.playerId, target.slot);
      this.jackPeeked = { playerId: target.playerId, slot: target.slot };
      this.pushLog(`${this.activePlayer.name} peeked a card (Jack)`);
      // stay in "power" — awaiting optional swap or skip
    } else {
      throw new GameError("This power is not a peek");
    }
  }

  powerSwap(playerId: string, first: SlotRef, second: SlotRef): void {
    this.assertActiveTurn(playerId, "power");

    if (this.pendingPower === "queenSwap") {
      if (first.playerId === second.playerId)
        throw new GameError("Swap must be between the two players");
      this.swapSlots(first, second);
      this.pushLog(this.swapLog(first, second));
      this.endTurn();
      return;
    }

    if (this.pendingPower === "jackPeekSwap") {
      if (!this.jackPeeked) throw new GameError("Peek a card first");
      // One side must be the peeked card, the other must be your own card,
      // and the two must belong to different players.
      const peeked = this.jackPeeked;
      const isPeeked = (r: SlotRef) =>
        r.playerId === peeked.playerId && r.slot === peeked.slot;
      const peekedRef = isPeeked(first) ? first : isPeeked(second) ? second : null;
      const otherRef = isPeeked(first) ? second : first;
      if (!peekedRef) throw new GameError("The swap must use the peeked card");
      if (otherRef.playerId !== playerId)
        throw new GameError("Swap the peeked card with one of your own");
      if (peekedRef.playerId === otherRef.playerId)
        throw new GameError("Swap must be between the two players");
      this.swapSlots(peekedRef, otherRef);
      this.pushLog(this.swapLog(peekedRef, otherRef));
      this.endTurn();
      return;
    }

    throw new GameError("This power cannot swap");
  }

  powerSkip(playerId: string): void {
    this.assertActiveTurn(playerId, "power");
    this.pushLog(`${this.activePlayer.name} skipped the power`);
    this.endTurn();
  }

  private swapSlots(a: SlotRef, b: SlotRef): void {
    const pa = this.mustPlayer(a.playerId);
    const pb = this.mustPlayer(b.playerId);
    if (!pa.hand[a.slot] || !pb.hand[b.slot])
      throw new GameError("No card there");
    const tmp = pa.hand[a.slot];
    pa.hand[a.slot] = pb.hand[b.slot];
    pb.hand[b.slot] = tmp;
  }

  /** Position-only swap log (both players see it — no card values leak). */
  private swapLog(a: SlotRef, b: SlotRef): string {
    const na = this.players.find((p) => p.id === a.playerId)?.name ?? "?";
    const nb = this.players.find((p) => p.id === b.playerId)?.name ?? "?";
    return `${this.activePlayer.name} swapped ${na} #${a.slot + 1} ↔ ${nb} #${b.slot + 1}`;
  }

  // ---- Turn / game end ------------------------------------------------

  private endTurn(): void {
    this.held = null;
    this.pendingPower = "none";
    this.jackPeeked = null;
    // Peeks intentionally linger past end-of-turn so the peeker can memorize
    // them; they expire by time (REVEAL_MS), not on turn change.
    // The game ends the moment the draw deck is empty.
    if (this.deck.length === 0) {
      this.endGame();
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const n = this.players.length;
    this.activeIndex = (this.activeIndex + 1) % n;
    this.turnPhase = "draw";
    this.pushLog(`${this.activePlayer.name}'s turn`);
  }

  private endGame(): void {
    this.phase = "gameEnd";
    this.turnPhase = "idle";
    this.held = null;
    this.pendingPower = "none";
    this.jackPeeked = null;
    this.reveals = [];
    const totals = this.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      total: p.hand.reduce(
        (sum, c) => sum + (c ? this.rules.cardValue(c) : 0),
        0
      ),
    }));
    const lowest = Math.min(...totals.map((t) => t.total));
    const winners = totals.filter((t) => t.total === lowest);
    this.result = {
      winnerId: winners.length === 1 ? winners[0].playerId : null,
      totals,
    };
    this.pushLog(
      winners.length === 1
        ? `${winners[0].name} wins with ${lowest}!`
        : `It's a draw at ${lowest}`
    );
  }

  // ---- Reveals --------------------------------------------------------

  private addReveal(viewerId: string, playerId: string, slot: number): void {
    this.reveals = this.reveals.filter(
      (r) =>
        !(r.viewerId === viewerId && r.playerId === playerId && r.slot === slot)
    );
    this.reveals.push({
      viewerId,
      playerId,
      slot,
      expiresAt: Date.now() + REVEAL_MS,
    });
  }

  clearExpiredReveals(): void {
    const now = Date.now();
    this.reveals = this.reveals.filter((r) => r.expiresAt > now);
  }

  // ---- Validation helpers --------------------------------------------

  private isHost(id: string): boolean {
    return this.host?.id === id;
  }

  private mustPlayer(id: string): EnginePlayer {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new GameError("Unknown player");
    return p;
  }

  private assertActiveTurn(playerId: string, expected: TurnPhase): void {
    if (this.phase !== "playing") throw new GameError("Not in play");
    if (this.activePlayer.id !== playerId) throw new GameError("Not your turn");
    if (this.turnPhase !== expected)
      throw new GameError(`Cannot do that now (${this.turnPhase})`);
  }

  private pushLog(msg: string): void {
    this.log.push(msg);
    if (this.log.length > 30) this.log.shift();
  }

  // ---- Dev / god-mode (server-gated by DEV_SECRET) -------------------

  setGodView(viewerId: string, on: boolean): void {
    if (on) this.godViewers.add(viewerId);
    else this.godViewers.delete(viewerId);
  }

  devSetSlot(playerId: string, slot: number, rank: Rank, suit: Suit): void {
    const p = this.mustPlayer(playerId);
    if (slot < 0 || slot >= p.hand.length) throw new GameError("Bad slot");
    this.rigInto({ z: "hand", p, slot }, rank, suit);
  }

  devSetHeld(rank: Rank, suit: Suit): void {
    this.rigInto({ z: "held" }, rank, suit);
  }

  devSetDeckTop(rank: Rank, suit: Suit): void {
    if (this.deck.length === 0) throw new GameError("Deck is empty");
    this.rigInto({ z: "deck", i: this.deck.length - 1 }, rank, suit);
  }

  // Move the real (rank, suit) card into `target`, swapping the evicted card
  // into the found card's old spot. Conserves the card multiset — the card must
  // already exist in play, so nothing is ever fabricated or duplicated.
  private rigInto(target: Loc, rank: Rank, suit: Suit): void {
    const src = this.findLoc(rank, suit);
    if (!src) throw new GameError(`No ${rank} of ${suit} in play to place`);
    if (this.sameLoc(src, target)) return;
    const desired = this.getAt(src); // non-null: findLoc only returns matches
    const evicted = this.getAt(target); // may be null (empty slot / held)
    this.putAt(target, desired);
    this.putAt(src, evicted);
  }

  private findLoc(rank: Rank, suit: Suit): Loc | null {
    const hit = (c: Card | null) => c !== null && c.rank === rank && c.suit === suit;
    for (let i = 0; i < this.deck.length; i++) if (hit(this.deck[i])) return { z: "deck", i };
    for (let i = 0; i < this.discard.length; i++)
      if (hit(this.discard[i])) return { z: "discard", i };
    if (hit(this.held)) return { z: "held" };
    for (const p of this.players)
      for (let slot = 0; slot < p.hand.length; slot++)
        if (hit(p.hand[slot])) return { z: "hand", p, slot };
    return null;
  }

  private getAt(loc: Loc): Card | null {
    switch (loc.z) {
      case "deck":
        return this.deck[loc.i];
      case "discard":
        return this.discard[loc.i];
      case "held":
        return this.held;
      case "hand":
        return loc.p.hand[loc.slot];
    }
  }

  private putAt(loc: Loc, card: Card | null): void {
    switch (loc.z) {
      case "deck":
        if (card === null) this.deck.splice(loc.i, 1);
        else this.deck[loc.i] = card;
        return;
      case "discard":
        if (card === null) this.discard.splice(loc.i, 1);
        else this.discard[loc.i] = card;
        return;
      case "held":
        this.held = card;
        return;
      case "hand":
        loc.p.hand[loc.slot] = card;
        return;
    }
  }

  private sameLoc(a: Loc, b: Loc): boolean {
    if (a.z === "held" && b.z === "held") return true;
    if (a.z === "deck" && b.z === "deck") return a.i === b.i;
    if (a.z === "discard" && b.z === "discard") return a.i === b.i;
    if (a.z === "hand" && b.z === "hand") return a.p === b.p && a.slot === b.slot;
    return false;
  }

  devSetTurn(playerId: string): void {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) throw new GameError("Unknown player");
    this.activeIndex = idx;
    this.turnPhase = "draw";
    this.held = null;
    this.pendingPower = "none";
    this.jackPeeked = null;
  }

  devEndGame(): void {
    if (this.phase === "playing") this.endGame();
  }

  // ---- View building (redaction) -------------------------------------

  private cardView(card: Card, faceUp: boolean): CardView {
    if (!faceUp) return { id: card.id, faceUp: false };
    return {
      id: card.id,
      faceUp: true,
      rank: card.rank,
      suit: card.suit,
      value: this.rules.cardValue(card),
    };
  }

  private canSee(viewerId: string, playerId: string, slot: number): boolean {
    if (this.godViewers.has(viewerId)) return true;
    if (this.phase === "gameEnd") return true;
    return this.reveals.some(
      (r) => r.viewerId === viewerId && r.playerId === playerId && r.slot === slot
    );
  }

  buildView(viewerId: string): GameStateView {
    const players: PlayerView[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      isHost: p.isHost,
      hand: p.hand.map((c, slot) =>
        c ? this.cardView(c, this.canSee(viewerId, p.id, slot)) : null
      ),
    }));

    const reveals: Reveal[] = [];
    for (const r of this.reveals) {
      if (r.viewerId !== viewerId) continue;
      const owner = this.players.find((p) => p.id === r.playerId);
      const card = owner?.hand[r.slot];
      if (card)
        reveals.push({
          playerId: r.playerId,
          slot: r.slot,
          card: this.cardView(card, true),
          expiresAt: r.expiresAt,
        });
    }

    const isActive = this.activePlayer?.id === viewerId && this.phase === "playing";
    const top = this.discard[this.discard.length - 1];

    return {
      roomCode: "",
      phase: this.phase,
      players,
      activePlayerIndex: this.activeIndex,
      turnPhase: isActive ? this.turnPhase : "idle",
      pendingPower:
        isActive && this.turnPhase === "power" && this.pendingPower !== "none"
          ? this.pendingPower
          : null,
      jackAwaitingSwap:
        isActive && this.pendingPower === "jackPeekSwap" && this.jackPeeked !== null,
      held: isActive && this.held ? { card: this.cardView(this.held, true) } : null,
      discardTop: top ? this.cardView(top, true) : null,
      deckCount: this.deck.length,
      reveals,
      log: this.log.slice(-8),
      result: this.result,
      youId: viewerId,
    };
  }
}
