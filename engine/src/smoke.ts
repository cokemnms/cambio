// Headless smoke test for the v1 engine. Run: npm run test -w @cambio/engine
import type { Card, Rank, Suit } from "@cambio/shared";
import { Game } from "./engine.js";

let pass = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("FAILED: " + msg);
  pass++;
  console.log("  ok:", msg);
}
function expectThrow(fn: () => void, msg: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, msg);
}

let seq = 0;
const C = (rank: Rank, suit: Suit = "spades"): Card => ({
  id: `${rank}${suit}${seq++}`,
  rank,
  suit,
});

/** Build a game already in "playing" with crafted hands + deck (top = last). */
function playing(hand0: Card[], hand1: Card[], deck: Card[]): Game {
  const g = new Game();
  g.addPlayer("A", "Alice");
  g.addPlayer("B", "Bob");
  g.phase = "playing";
  g.turnPhase = "draw";
  g.activeIndex = 0;
  g.players[0].hand = hand0;
  g.players[1].hand = hand1;
  g.deck = deck;
  g.discard = [];
  return g;
}

console.log("\n# lobby + deal + redaction");
{
  const g = new Game();
  g.addPlayer("A", "Alice");
  g.addPlayer("B", "Bob");
  assert(g.host?.id === "A", "first player is host");
  expectThrow(() => g.addPlayer("C", "Cara"), "3rd player rejected (2p game)");
  g.startGame("A");
  assert(g.phase === "playing", "phase is playing after start");
  assert(
    g.players.every((p) => p.hand.length === 3),
    "each player dealt 3 cards"
  );
  assert(g.deck.length === 52 - 6, "deck has 46 after dealing 6");
  assert(g.discard.length === 0, "discard starts empty (no initial flip)");
  const aView = g.buildView("A");
  const bHand = aView.players.find((p) => p.id === "B")!;
  assert(bHand.hand.every((c) => c && c.faceUp === false), "B hidden from A");
  const aHand = aView.players.find((p) => p.id === "A")!;
  assert(aHand.hand.every((c) => c && c.faceUp === false), "no start peek");
}

console.log("\n# card values");
{
  const g = playing([C("K"), C("A"), C("Q")], [C("2"), C("3"), C("4")], [C("5")]);
  const v = (r: Rank) => g.rules.cardValue(C(r));
  assert(v("A") === 1, "A = 1");
  assert(v("7") === 7, "7 = 7");
  assert(v("J") === 11, "J = 11");
  assert(v("Q") === 12, "Q = 12");
  assert(v("K") === -1, "K = -1");
}

console.log("\n# power triggers on the SWAPPED-OUT card");
{
  // Draw a 4, swap it into slot 0; the displaced 9 fires peekOwn.
  const g = playing(
    [C("9"), C("2"), C("3")],
    [C("5"), C("6"), C("7")],
    [C("K"), C("4")] // pop -> 4 drawn; K left so the game doesn't end
  );
  g.drawFromDeck("A");
  assert(g.held?.rank === "4", "drew the 4");
  g.swapHeld("A", 0);
  assert(g.players[0].hand[0]?.rank === "4", "4 is now in slot 0");
  assert(g.discard[g.discard.length - 1]?.rank === "9", "9 was discarded");
  assert(g.turnPhase === "power" && g.pendingPower === "peekOwn", "9 => peekOwn");
  g.powerPeek("A", { playerId: "A", slot: 1 });
  // Peek lingers for the peeker but is invisible to the opponent.
  assert(g.buildView("A").players[0].hand[1]?.faceUp === true, "A sees own peek");
  assert(
    g.buildView("B").players[0].hand[1]?.faceUp === false,
    "B cannot see A's peek"
  );
  assert(g.activeIndex === 1, "turn passed to B after the peek");
}

console.log("\n# direct discard: Queen blind swap");
{
  const g = playing(
    [C("2"), C("3"), C("4")],
    [C("5"), C("6"), C("7")],
    [C("K"), C("Q")]
  );
  g.drawFromDeck("A");
  g.discardHeld("A");
  assert(g.pendingPower === "queenSwap", "Q => queenSwap");
  g.powerSwap("A", { playerId: "A", slot: 0 }, { playerId: "B", slot: 0 });
  assert(g.players[0].hand[0]?.rank === "5", "A slot0 got B's 5");
  assert(g.players[1].hand[0]?.rank === "2", "B slot0 got A's 2");
  assert(g.activeIndex === 1, "turn advanced after Q");
}

console.log("\n# Jack: peek any card, then swap it with one of yours");
{
  const g = playing(
    [C("2"), C("3"), C("4")],
    [C("9"), C("6"), C("7")],
    [C("K"), C("J")]
  );
  g.drawFromDeck("A");
  g.discardHeld("A");
  assert(g.pendingPower === "jackPeekSwap", "J => jackPeekSwap");
  g.powerPeek("A", { playerId: "B", slot: 0 });
  assert(g.buildView("A").jackAwaitingSwap === true, "awaiting optional swap");
  assert(g.buildView("A").players[1].hand[0]?.faceUp === true, "A saw B's card");
  g.powerSwap("A", { playerId: "B", slot: 0 }, { playerId: "A", slot: 0 });
  assert(g.players[0].hand[0]?.rank === "9", "A took the peeked 9");
  assert(g.players[1].hand[0]?.rank === "2", "B received A's 2");
}

console.log("\n# power validation rejects illegal targets");
{
  const g = playing([C("2"), C("3"), C("4")], [C("5"), C("6"), C("7")], [C("K"), C("7")]);
  g.drawFromDeck("A");
  g.discardHeld("A"); // 7 => peekOpponent
  assert(g.pendingPower === "peekOpponent", "7 => peekOpponent");
  expectThrow(() => g.powerPeek("A", { playerId: "A", slot: 0 }), "peekOpponent rejects own card");
  expectThrow(() => g.powerPeek("B", { playerId: "A", slot: 0 }), "off-turn peek rejected");
  g.powerPeek("A", { playerId: "B", slot: 0 }); // legal
  assert(g.turnPhase !== "power", "peek resolved the power");
}

console.log("\n# full game drains the deck and scores lowest");
{
  const g = new Game();
  g.addPlayer("A", "Alice");
  g.addPlayer("B", "Bob");
  g.startGame("A");
  let guard = 0;
  while (g.phase === "playing" && guard++ < 200) {
    const me = g.activePlayer.id;
    g.drawFromDeck(me);
    if (g.turnPhase === "decide") g.discardHeld(me);
    if (g.turnPhase === "power") g.powerSkip(me);
  }
  assert(g.phase === "gameEnd", "game ended when deck emptied");
  assert(g.deck.length === 0, "deck fully drained");
  assert(g.result !== null, "result computed");
  const totals = g.result!.totals;
  const lowest = Math.min(...totals.map((t) => t.total));
  if (g.result!.winnerId) {
    const w = totals.find((t) => t.playerId === g.result!.winnerId)!;
    assert(w.total === lowest, "winner has the lowest total");
  } else {
    assert(
      totals.filter((t) => t.total === lowest).length > 1,
      "draw means tied lowest"
    );
  }
  const endView = g.buildView("A");
  assert(
    endView.players.every((p) => p.hand.every((c) => !c || c.faceUp)),
    "all cards revealed at game end"
  );
}

console.log(`\n✅ v1 engine smoke test passed (${pass} assertions).`);
