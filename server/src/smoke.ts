// Headless smoke test: drive the engine through a full round.
import { Game } from "./game/engine.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ok:", msg);
}

const g = new Game();
g.addPlayer("A", "Alice");
g.addPlayer("B", "Bob");
assert(g.host?.id === "A", "first player is host");

g.startRound("A");
assert(g.phase === "peek", "phase is peek after start");
assert(g.players.every((p) => p.hand.length === 4), "everyone has 4 cards");
assert(g.discard.length === 1, "one card in discard to start");

// Peek + ready
g.peekCard("A", 0);
g.peekCard("A", 1);
g.peekReady("A");
g.peekCard("B", 0);
g.peekReady("B");
assert(g.phase === "playing", "phase is playing after both ready");

// Views are redacted: from A's view, B's cards are face-down.
const aView = g.buildView("A");
const bInAView = aView.players.find((p) => p.id === "B")!;
assert(bInAView.hand.every((c) => c && c.faceUp === false), "B hidden from A");

// A draws and discards (may trigger a power; skip it if so).
g.drawFromDeck("A");
assert(g.turnPhase === "decide", "A is deciding after draw");
try {
  g.discardHeld("A");
} catch {
  // held came from discard rule can't happen here; ignore
}
if (g.turnPhase === "power") {
  g.powerSkip("A");
}
assert(g.activeIndex === 1, "turn advanced to B");

// B draws and swaps into a slot.
g.drawFromDeck("B");
g.swapHeld("B", 0);
assert(g.activeIndex === 0, "turn advanced back to A");

// A calls Cambio -> last lap -> B plays -> round ends.
g.callCambio("A");
assert(g.cambioCallerId === "A", "cambio recorded");
// Now it's B's last turn.
assert(g.activeIndex === 1, "B gets last turn");
g.drawFromDeck("B");
g.swapHeld("B", 1);
assert(g.phase === "roundEnd", "round ended after last lap");
assert(g.results !== null && g.results.length === 2, "results computed");

// At round end, all cards are face-up in every view.
const endView = g.buildView("A");
assert(
  endView.players.every((p) => p.hand.every((c) => !c || c.faceUp)),
  "all cards revealed at round end"
);

console.log("\nResults:", g.results);
console.log("\n✅ Smoke test passed.");
