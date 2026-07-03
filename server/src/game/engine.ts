import type {
  Card,
  CardView,
  GameStateView,
  PlayerView,
  Reveal,
  RoundResult,
  SlotRef,
} from "@cambio/shared";
import { DEFAULT_RULES, type Power, type Rules } from "./rules.js";
import { buildDeck, shuffle } from "./deck.js";

interface EnginePlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  hand: (Card | null)[];
  score: number;
  calledCambio: boolean;
  /** Slots peeked during the initial peek phase. */
  peekedSlots: number[];
  peekReady: boolean;
}

interface InternalReveal {
  viewerId: string;
  playerId: string;
  slot: number;
  expiresAt: number;
}

export type Phase = GameStateView["phase"];
export type TurnPhase = GameStateView["turnPhase"];

const REVEAL_MS = 6000;

export class GameError extends Error {}

/**
 * Server-authoritative Cambio game. One instance per room. All mutations go
 * through validated action methods; clients only ever receive redacted views.
 */
export class Game {
  rules: Rules;
  players: EnginePlayer[] = [];
  deck: Card[] = [];
  discard: Card[] = [];
  phase: Phase = "lobby";
  turnPhase: TurnPhase = "idle";
  activeIndex = 0;
  held: { card: Card; source: "deck" | "discard" } | null = null;
  pendingPower: Power = "none";
  spyPeeked = false; // for spySwap: has the peek step been done?
  cambioCallerId: string | null = null;
  reveals: InternalReveal[] = [];
  log: string[] = [];
  results: RoundResult[] | null = null;

  constructor(rules: Rules = DEFAULT_RULES) {
    this.rules = rules;
  }

  // ---- Player management (lobby) --------------------------------------

  addPlayer(id: string, name: string): EnginePlayer {
    if (this.phase !== "lobby") throw new GameError("Game already started");
    if (this.players.length >= this.rules.maxPlayers)
      throw new GameError("Room is full");
    const isHost = this.players.length === 0;
    const p: EnginePlayer = {
      id,
      name,
      isHost,
      connected: true,
      hand: [],
      score: 0,
      calledCambio: false,
      peekedSlots: [],
      peekReady: false,
    };
    this.players.push(p);
    return p;
  }

  removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const wasHost = this.players[idx].isHost;
    if (this.phase === "lobby") {
      this.players.splice(idx, 1);
    } else {
      // Mid-game: mark disconnected but keep the seat so the round can finish.
      this.players[idx].connected = false;
    }
    if (wasHost && this.players.length > 0) {
      this.players[0].isHost = true;
    }
    // If it was their turn, move on.
    if (
      this.phase === "playing" &&
      this.players[this.activeIndex] &&
      !this.players[this.activeIndex].connected &&
      this.held === null
    ) {
      this.advanceTurn();
    }
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.players.find((x) => x.id === id);
    if (p) p.connected = connected;
  }

  get host(): EnginePlayer | undefined {
    return this.players.find((p) => p.isHost);
  }

  // ---- Round lifecycle ------------------------------------------------

  startRound(byId: string): void {
    if (!this.isHost(byId)) throw new GameError("Only the host can start");
    if (this.phase !== "lobby" && this.phase !== "roundEnd")
      throw new GameError("Cannot start now");
    if (this.players.length < this.rules.minPlayers)
      throw new GameError(`Need at least ${this.rules.minPlayers} players`);

    this.deck = shuffle(buildDeck());
    this.discard = [];
    this.reveals = [];
    this.results = null;
    this.held = null;
    this.pendingPower = "none";
    this.spyPeeked = false;
    this.cambioCallerId = null;
    this.log = [];

    for (const p of this.players) {
      p.hand = [];
      p.calledCambio = false;
      p.peekedSlots = [];
      p.peekReady = false;
      for (let i = 0; i < this.rules.handSize; i++) {
        p.hand.push(this.drawCard());
      }
    }
    // Flip one card to start the discard pile.
    this.discard.push(this.drawCard());
    this.phase = "peek";
    this.turnPhase = "idle";
    this.activeIndex = 0;
    this.pushLog("New round — peek at your cards");
  }

  private drawCard(): Card {
    if (this.deck.length === 0) this.reshuffleDiscardIntoDeck();
    const c = this.deck.pop();
    if (!c) throw new GameError("Deck exhausted");
    return c;
  }

  private reshuffleDiscardIntoDeck(): void {
    if (this.discard.length <= 1) return;
    const top = this.discard.pop()!;
    this.deck = shuffle(this.discard);
    this.discard = [top];
    this.pushLog("Deck reshuffled");
  }

  // ---- Initial peek phase --------------------------------------------

  peekCard(playerId: string, slot: number): void {
    if (this.phase !== "peek") throw new GameError("Not the peek phase");
    const p = this.mustPlayer(playerId);
    if (p.peekReady) throw new GameError("You are already ready");
    if (slot < 0 || slot >= p.hand.length || !p.hand[slot])
      throw new GameError("No card there");
    if (p.peekedSlots.includes(slot)) return; // already peeked, idempotent
    if (p.peekedSlots.length >= this.rules.initialPeekCount)
      throw new GameError("No peeks left");
    p.peekedSlots.push(slot);
    this.addReveal(playerId, playerId, slot);
  }

  peekReady(playerId: string): void {
    if (this.phase !== "peek") throw new GameError("Not the peek phase");
    const p = this.mustPlayer(playerId);
    p.peekReady = true;
    // Clear this player's peek reveals now that they've committed.
    this.reveals = this.reveals.filter((r) => r.viewerId !== playerId);
    if (this.players.every((x) => x.peekReady)) {
      this.phase = "playing";
      this.turnPhase = "draw";
      this.activeIndex = 0;
      this.pushLog(`${this.players[0].name}'s turn`);
    }
  }

  // ---- Turn actions ---------------------------------------------------

  drawFromDeck(playerId: string): void {
    this.assertActiveTurn(playerId, "draw");
    const card = this.drawCard();
    this.held = { card, source: "deck" };
    this.turnPhase = "decide";
    this.addReveal(playerId, playerId, -1, card); // reveal held to self
    this.pushLog(`${this.activePlayer.name} drew from the deck`);
  }

  takeFromDiscard(playerId: string): void {
    this.assertActiveTurn(playerId, "draw");
    const card = this.discard.pop();
    if (!card) throw new GameError("Discard pile is empty");
    this.held = { card, source: "discard" };
    this.turnPhase = "decide";
    this.pushLog(`${this.activePlayer.name} took the discard`);
  }

  swapHeld(playerId: string, slot: number): void {
    this.assertActiveTurn(playerId, "decide");
    const p = this.activePlayer;
    if (slot < 0 || slot >= p.hand.length) throw new GameError("Bad slot");
    const held = this.held!;
    const outgoing = p.hand[slot];
    p.hand[slot] = held.card;
    if (outgoing) this.discard.push(outgoing);
    this.held = null;
    this.pushLog(`${p.name} swapped a card`);
    this.endTurn();
  }

  discardHeld(playerId: string): void {
    this.assertActiveTurn(playerId, "decide");
    const held = this.held!;
    if (held.source === "discard")
      throw new GameError("A card taken from the discard must be swapped in");
    this.discard.push(held.card);
    const power = this.rules.cardPower(held.card);
    this.held = null;
    if (power === "none") {
      this.pushLog(`${this.activePlayer.name} discarded ${held.card.rank}`);
      this.endTurn();
    } else {
      this.pendingPower = power;
      this.spyPeeked = false;
      this.turnPhase = "power";
      this.pushLog(
        `${this.activePlayer.name} discarded ${held.card.rank} — using its power`
      );
    }
  }

  // ---- Power resolution ----------------------------------------------

  powerPeek(playerId: string, target: SlotRef): void {
    this.assertActiveTurn(playerId, "power");
    const targetPlayer = this.mustPlayer(target.playerId);
    if (!targetPlayer.hand[target.slot]) throw new GameError("No card there");

    if (this.pendingPower === "peekOwn") {
      if (target.playerId !== playerId)
        throw new GameError("You may only peek your own card");
    } else if (this.pendingPower === "peekOther") {
      if (target.playerId === playerId)
        throw new GameError("You must peek an opponent's card");
    } else if (this.pendingPower === "spySwap") {
      // spy step — any card
    } else {
      throw new GameError("This power is not a peek");
    }

    this.addReveal(playerId, target.playerId, target.slot);
    if (this.pendingPower === "spySwap") {
      this.spyPeeked = true; // now awaits powerSwap or powerSkip
      this.pushLog(`${this.activePlayer.name} spied a card`);
    } else {
      this.pushLog(`${this.activePlayer.name} peeked a card`);
      this.endTurn();
    }
  }

  powerSwap(playerId: string, first: SlotRef, second: SlotRef): void {
    this.assertActiveTurn(playerId, "power");
    if (this.pendingPower !== "blindSwap" && this.pendingPower !== "spySwap")
      throw new GameError("This power cannot swap");
    const a = this.mustPlayer(first.playerId);
    const b = this.mustPlayer(second.playerId);
    if (!a.hand[first.slot] || !b.hand[second.slot])
      throw new GameError("No card there");
    const tmp = a.hand[first.slot];
    a.hand[first.slot] = b.hand[second.slot];
    b.hand[second.slot] = tmp;
    this.pushLog(`${this.activePlayer.name} swapped two cards`);
    this.endTurn();
  }

  powerSkip(playerId: string): void {
    this.assertActiveTurn(playerId, "power");
    this.pushLog(`${this.activePlayer.name} skipped the power`);
    this.endTurn();
  }

  // ---- Anytime actions ------------------------------------------------

  snap(playerId: string, slot: number): void {
    if (!this.rules.snapEnabled) throw new GameError("Snap is disabled");
    if (this.phase !== "playing") throw new GameError("Cannot snap now");
    const p = this.mustPlayer(playerId);
    const card = p.hand[slot];
    const top = this.discard[this.discard.length - 1];
    if (!card) throw new GameError("No card there");
    if (!top) throw new GameError("Nothing to match");

    if (card.rank === top.rank) {
      p.hand[slot] = null;
      this.discard.push(card);
      this.pushLog(`${p.name} snapped a ${card.rank}!`);
    } else {
      // Wrong snap — penalty cards.
      for (let i = 0; i < this.rules.snapPenalty; i++) {
        p.hand.push(this.drawCard());
      }
      this.pushLog(`${p.name} snapped wrong — +${this.rules.snapPenalty} card`);
    }
    this.clearExpiredReveals();
  }

  callCambio(playerId: string): void {
    this.assertActiveTurn(playerId, "draw");
    if (this.cambioCallerId) throw new GameError("Cambio already called");
    const p = this.activePlayer;
    p.calledCambio = true;
    this.cambioCallerId = playerId;
    this.pushLog(`${p.name} called CAMBIO! Last lap.`);
    this.endTurn();
  }

  // ---- Turn advancement / round end ----------------------------------

  private endTurn(): void {
    this.held = null;
    this.pendingPower = "none";
    this.spyPeeked = false;
    // Clear the active player's reveals at end of their turn.
    this.reveals = this.reveals.filter(
      (r) => r.viewerId !== this.activePlayer.id
    );
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const n = this.players.length;
    let next = this.activeIndex;
    for (let i = 0; i < n; i++) {
      next = (next + 1) % n;
      // End the round when play returns to the Cambio caller.
      if (this.cambioCallerId && this.players[next].id === this.cambioCallerId) {
        this.endRound();
        return;
      }
      if (this.players[next].connected) break;
    }
    this.activeIndex = next;
    this.turnPhase = "draw";
    this.pushLog(`${this.players[next].name}'s turn`);
  }

  private endRound(): void {
    this.phase = "roundEnd";
    this.turnPhase = "idle";
    this.reveals = [];
    const scored = this.players.map((p) => {
      const roundPoints = p.hand.reduce(
        (sum, c) => sum + (c ? this.rules.cardValue(c) : 0),
        0
      );
      return { p, roundPoints };
    });
    const lowest = Math.min(...scored.map((s) => s.roundPoints));
    for (const s of scored) s.p.score += s.roundPoints;
    this.results = scored.map((s) => ({
      playerId: s.p.id,
      name: s.p.name,
      roundPoints: s.roundPoints,
      totalScore: s.p.score,
      isWinner: s.roundPoints === lowest,
    }));
    const anyOut = this.players.some((p) => p.score >= this.rules.losingScore);
    if (anyOut) {
      this.phase = "gameEnd";
      const best = Math.min(...this.players.map((p) => p.score));
      for (const r of this.results) {
        r.isWinner = this.players.find((p) => p.id === r.playerId)!.score === best;
      }
      this.pushLog("Game over!");
    } else {
      this.pushLog("Round over");
    }
  }

  rematch(byId: string): void {
    if (!this.isHost(byId)) throw new GameError("Only the host can restart");
    if (this.phase === "gameEnd") {
      for (const p of this.players) p.score = 0;
    }
    this.phase = "lobby";
    this.turnPhase = "idle";
    this.startRound(byId);
  }

  // ---- Reveals --------------------------------------------------------

  private addReveal(
    viewerId: string,
    playerId: string,
    slot: number,
    card?: Card
  ): void {
    // slot === -1 denotes the held card (only used for view lookup).
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
    void card;
  }

  clearExpiredReveals(): void {
    const now = Date.now();
    this.reveals = this.reveals.filter((r) => r.expiresAt > now || r.slot === -1);
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

  get activePlayer(): EnginePlayer {
    return this.players[this.activeIndex];
  }

  private assertActiveTurn(playerId: string, expected: TurnPhase): void {
    if (this.phase !== "playing") throw new GameError("Not in play");
    if (this.activePlayer.id !== playerId)
      throw new GameError("Not your turn");
    if (this.turnPhase !== expected)
      throw new GameError(`Cannot do that now (${this.turnPhase})`);
  }

  private pushLog(msg: string): void {
    this.log.push(msg);
    if (this.log.length > 30) this.log.shift();
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
    if (this.phase === "roundEnd" || this.phase === "gameEnd") return true;
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
      score: p.score,
      calledCambio: p.calledCambio,
      hand: p.hand.map((c, slot) =>
        c ? this.cardView(c, this.canSee(viewerId, p.id, slot)) : null
      ),
    }));

    const reveals: Reveal[] = [];
    for (const r of this.reveals) {
      if (r.viewerId !== viewerId || r.slot < 0) continue;
      const owner = this.players.find((p) => p.id === r.playerId);
      const card = owner?.hand[r.slot];
      if (card) {
        reveals.push({
          playerId: r.playerId,
          slot: r.slot,
          card: this.cardView(card, true),
          expiresAt: r.expiresAt,
        });
      }
    }

    const isActive = this.activePlayer?.id === viewerId;
    const held =
      isActive && this.held
        ? {
            card: this.cardView(
              this.held.card,
              // Held-from-deck is hidden until you look; we reveal to self.
              true
            ),
            source: this.held.source,
          }
        : null;

    const top = this.discard[this.discard.length - 1];

    return {
      roomCode: "", // filled by Room
      phase: this.phase,
      players,
      activePlayerIndex: this.activeIndex,
      turnPhase: isActive ? this.turnPhase : "idle",
      pendingPower:
        isActive && this.turnPhase === "power" && this.pendingPower !== "none"
          ? this.pendingPower
          : null,
      spyReadyToSwap:
        isActive && this.pendingPower === "spySwap" && this.spyPeeked,
      held,
      discardTop: top ? this.cardView(top, true) : null,
      deckCount: this.deck.length,
      reveals,
      cambioCalledBy: this.cambioCallerId,
      log: this.log.slice(-8),
      results: this.results,
      losingScore: this.rules.losingScore,
      youId: viewerId,
    };
  }
}
