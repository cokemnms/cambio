import { useState } from "react";
import type { PlayerView, PowerKind, SlotRef } from "@cambio/shared";
import type { Game } from "../App";
import { Card } from "../components/Card";

const POWER_HINT: Record<PowerKind, string> = {
  peekOwn: "Tap one of YOUR cards to peek at it",
  peekOther: "Tap an OPPONENT's card to peek at it",
  blindSwap: "Tap two cards to swap them (you won't see them)",
  spySwap: "Tap any card to spy it, then swap two or skip",
};

export function Table({ game }: { game: Game }) {
  const { view, youId, actions } = game;
  const [swapFirst, setSwapFirst] = useState<SlotRef | null>(null);
  const [snapArmed, setSnapArmed] = useState(false);
  if (!view) return null;

  const myIndex = view.players.findIndex((p) => p.id === youId);
  const me = view.players[myIndex];
  const active = view.players[view.activePlayerIndex];
  const myTurn = active?.id === youId && view.phase === "playing";
  const opponents = view.players.filter((p) => p.id !== youId);

  const peeksUsed = me
    ? me.hand.filter((c) => c?.faceUp).length
    : 0;
  const peeksLeft = 2 - peeksUsed;

  const same = (a: SlotRef | null, p: string, s: number) =>
    !!a && a.playerId === p && a.slot === s;

  // Is tapping this card meaningful right now? (drives highlight)
  const isSelectable = (playerId: string, _slot: number): boolean => {
    if (snapArmed) return playerId === youId;
    if (view.phase === "peek")
      return playerId === youId && peeksLeft > 0;
    if (!myTurn) return false;
    if (view.turnPhase === "decide") return playerId === youId;
    if (view.turnPhase === "power") {
      const pp = view.pendingPower;
      if (pp === "peekOwn") return playerId === youId;
      if (pp === "peekOther") return playerId !== youId;
      if (pp === "blindSwap") return true;
      if (pp === "spySwap") return true;
    }
    return false;
  };

  const onCardTap = (playerId: string, slot: number) => {
    if (snapArmed && playerId === youId) {
      actions.snap(slot);
      setSnapArmed(false);
      return;
    }
    if (view.phase === "peek") {
      if (playerId === youId && peeksLeft > 0) actions.peekCard(slot);
      return;
    }
    if (!myTurn) return;

    if (view.turnPhase === "decide") {
      if (playerId === youId) actions.swapHeld(slot);
      return;
    }
    if (view.turnPhase === "power") {
      const pp = view.pendingPower;
      const target = { playerId, slot };
      if (pp === "peekOwn" && playerId === youId) actions.powerPeek(target);
      else if (pp === "peekOther" && playerId !== youId)
        actions.powerPeek(target);
      else if (pp === "blindSwap" || (pp === "spySwap" && view.spyReadyToSwap)) {
        if (!swapFirst) setSwapFirst(target);
        else {
          actions.powerSwap(swapFirst, target);
          setSwapFirst(null);
        }
      } else if (pp === "spySwap" && !view.spyReadyToSwap) {
        actions.powerPeek(target);
      }
    }
  };

  const renderHand = (p: PlayerView, mine: boolean) => (
    <div className={`hand ${mine ? "hand-mine" : "hand-opp"}`}>
      {p.hand.map((c, slot) => (
        <Card
          key={c?.id ?? `empty-${slot}`}
          card={c}
          empty={c === null}
          size={mine ? "lg" : "sm"}
          selectable={isSelectable(p.id, slot)}
          selected={same(swapFirst, p.id, slot)}
          onClick={() => onCardTap(p.id, slot)}
        />
      ))}
    </div>
  );

  return (
    <div className="screen table">
      {/* Top status bar */}
      <div className="table-top">
        <span className="pill">Room {view.roomCode}</span>
        {view.cambioCalledBy && (
          <span className="pill pill-alert">
            CAMBIO by{" "}
            {view.players.find((p) => p.id === view.cambioCalledBy)?.name}
          </span>
        )}
        <span className="pill">Deck {view.deckCount}</span>
      </div>

      {/* Opponents */}
      <div className="opponents">
        {opponents.map((p) => {
          const isActive = view.players[view.activePlayerIndex]?.id === p.id;
          return (
            <div
              key={p.id}
              className={`opp ${isActive ? "opp-active" : ""} ${
                !p.connected ? "opp-offline" : ""
              }`}
            >
              <div className="opp-name">
                {p.name} {p.calledCambio && "🔔"}
                <span className="opp-score">{p.score}</span>
              </div>
              {renderHand(p, false)}
            </div>
          );
        })}
      </div>

      {/* Center: deck + discard */}
      <div className="center-piles">
        <div className="pile">
          <Card
            faceDown
            card={{ id: "deck", faceUp: false }}
            size="md"
            selectable={myTurn && view.turnPhase === "draw"}
            onClick={() =>
              myTurn && view.turnPhase === "draw" && actions.drawFromDeck()
            }
          />
          <span className="pile-label">Deck</span>
        </div>
        <div className="pile">
          <Card
            card={view.discardTop}
            empty={!view.discardTop}
            size="md"
            selectable={myTurn && view.turnPhase === "draw" && !!view.discardTop}
            onClick={() =>
              myTurn &&
              view.turnPhase === "draw" &&
              view.discardTop &&
              actions.takeFromDiscard()
            }
          />
          <span className="pile-label">Discard</span>
        </div>
        {view.held && (
          <div className="pile held-pile">
            <Card card={view.held.card} size="md" highlight />
            <span className="pile-label">Drew</span>
          </div>
        )}
      </div>

      {/* My hand */}
      <div className="my-area">
        <div className="my-name">
          {me?.name} (you) · <b>{me?.score}</b>
        </div>
        {me && renderHand(me, true)}
      </div>

      {/* Action bar */}
      <ActionBar
        game={game}
        myTurn={myTurn}
        snapArmed={snapArmed}
        setSnapArmed={setSnapArmed}
      />

      {/* Log */}
      <div className="log">
        {view.log.slice(-3).map((line, i) => (
          <div key={i} className="log-line">
            {line}
          </div>
        ))}
      </div>

      {/* Results overlay */}
      {(view.phase === "roundEnd" || view.phase === "gameEnd") &&
        view.results && (
          <ResultsOverlay game={game} />
        )}
    </div>
  );
}

function ActionBar({
  game,
  myTurn,
  snapArmed,
  setSnapArmed,
}: {
  game: Game;
  myTurn: boolean;
  snapArmed: boolean;
  setSnapArmed: (v: boolean) => void;
}) {
  const { view, actions } = game;
  if (!view) return null;

  if (view.phase === "peek") {
    const me = view.players.find((p) => p.id === view.youId);
    const used = me ? me.hand.filter((c) => c?.faceUp).length : 0;
    return (
      <div className="action-bar">
        <div className="action-hint">
          Peek at {2 - used} more card{2 - used === 1 ? "" : "s"} — tap them
        </div>
        <button className="btn btn-primary" onClick={() => actions.peekReady()}>
          Ready
        </button>
      </div>
    );
  }

  const snapBtn = (
    <button
      className={`btn btn-snap ${snapArmed ? "armed" : ""}`}
      onClick={() => setSnapArmed(!snapArmed)}
    >
      {snapArmed ? "Tap a card to snap" : "⚡ Snap"}
    </button>
  );

  if (!myTurn) {
    const active = view.players[view.activePlayerIndex];
    return (
      <div className="action-bar">
        <div className="action-hint">{active?.name}'s turn…</div>
        {snapBtn}
      </div>
    );
  }

  if (view.turnPhase === "draw") {
    return (
      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => actions.drawFromDeck()}>
          Draw
        </button>
        {view.discardTop && (
          <button className="btn" onClick={() => actions.takeFromDiscard()}>
            Take discard
          </button>
        )}
        {!view.cambioCalledBy && (
          <button className="btn btn-cambio" onClick={() => actions.callCambio()}>
            Cambio!
          </button>
        )}
        {snapBtn}
      </div>
    );
  }

  if (view.turnPhase === "decide") {
    return (
      <div className="action-bar">
        <div className="action-hint">Tap your card to swap it in</div>
        {view.held?.source === "deck" && (
          <button className="btn" onClick={() => actions.discardHeld()}>
            Discard{view.held ? "" : ""}
          </button>
        )}
      </div>
    );
  }

  if (view.turnPhase === "power" && view.pendingPower) {
    return (
      <div className="action-bar">
        <div className="action-hint">{POWER_HINT[view.pendingPower]}</div>
        <button className="btn btn-ghost" onClick={() => actions.powerSkip()}>
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="action-bar">
      {snapBtn}
    </div>
  );
}

function ResultsOverlay({ game }: { game: Game }) {
  const { view, youId, actions } = game;
  if (!view?.results) return null;
  const me = view.players.find((p) => p.id === youId);
  const isHost = !!me?.isHost;
  const gameOver = view.phase === "gameEnd";
  const sorted = [...view.results].sort((a, b) => a.totalScore - b.totalScore);

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>{gameOver ? "🏆 Game Over" : "Round Over"}</h2>
        <div className="results">
          {sorted.map((r) => (
            <div
              key={r.playerId}
              className={`result-row ${r.isWinner ? "result-win" : ""}`}
            >
              <span className="result-name">
                {r.isWinner && "👑 "}
                {r.name}
              </span>
              <span className="result-round">+{r.roundPoints}</span>
              <span className="result-total">{r.totalScore}</span>
            </div>
          ))}
        </div>
        {isHost ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => actions.rematch()}
          >
            {gameOver ? "Play again" : "Next round"}
          </button>
        ) : (
          <p className="hint">Waiting for the host…</p>
        )}
      </div>
    </div>
  );
}
