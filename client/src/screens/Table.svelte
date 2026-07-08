<script lang="ts">
  import type { PlayerView, SlotRef } from "@cambio/shared";
  import { scale } from "svelte/transition";
  import { session } from "../lib/session.svelte";
  import { theme } from "../lib/theme.svelte";
  import { sound } from "../lib/sound.svelte";
  import Card from "../lib/Card.svelte";

  const view = $derived(session.active.view!);
  const me = $derived(view.players.find((p) => p.id === session.active.clientId)!);
  const opp = $derived(view.players.find((p) => p.id !== session.active.clientId) ?? null);
  const active = $derived(view.players[view.activePlayerIndex] ?? null);
  const myTurn = $derived(
    active?.id === session.active.clientId && view.phase === "playing"
  );
  const pp = $derived(myTurn ? view.pendingPower : null);

  const canDraw = $derived(myTurn && view.turnPhase === "draw");
  const canDiscard = $derived(myTurn && view.turnPhase === "decide");

  // Local selection state for the two-step swap powers.
  let firstPick = $state<SlotRef | null>(null); // Queen: first of two cards
  let jackPeeked = $state<SlotRef | null>(null); // Jack: the card we peeked

  $effect(() => {
    if (view.turnPhase !== "power") {
      firstPick = null;
      jackPeeked = null;
    }
  });

  // ---- Turn cue + sound effects ----
  let turnFlash = $state(false);
  let wasMine = false;
  $effect(() => {
    if (myTurn && !wasMine) {
      turnFlash = true;
      sound.play("turn");
      setTimeout(() => (turnFlash = false), 600);
    }
    wasMine = myTurn;
  });

  let lastLog = "";
  $effect(() => {
    const l = view.log[view.log.length - 1] ?? "";
    if (!l || l === lastLog) return;
    lastLog = l;
    if (/drew/.test(l)) sound.play("draw");
    else if (/↔/.test(l)) sound.play("swap");
    else if (/swapped in|discarded/.test(l)) sound.play("discard");
    else if (/peek/.test(l)) sound.play("peek");
  });

  let endPlayed = false;
  $effect(() => {
    if (view.phase === "gameEnd" && view.result && !endPlayed) {
      endPlayed = true;
      sound.play(view.result.winnerId === session.active.clientId ? "win" : "lose");
    } else if (view.phase !== "gameEnd") {
      endPlayed = false;
    }
  });

  function same(a: SlotRef | null, playerId: string, slot: number): boolean {
    return !!a && a.playerId === playerId && a.slot === slot;
  }

  function selectable(playerId: string, _slot: number): boolean {
    if (!myTurn) return false;
    if (view.turnPhase === "decide") return playerId === session.active.clientId;
    if (view.turnPhase === "power") {
      if (pp === "peekOpponent") return playerId !== session.active.clientId;
      if (pp === "peekOwn") return playerId === session.active.clientId;
      if (pp === "jackPeekSwap") {
        if (!view.jackAwaitingSwap) return true; // peek any card
        // swap step: only your cards, and only if you peeked the opponent's
        return (
          playerId === session.active.clientId &&
          jackPeeked !== null &&
          jackPeeked.playerId !== session.active.clientId
        );
      }
      if (pp === "queenSwap") {
        if (!firstPick) return true; // first pick: any card
        return playerId !== firstPick.playerId; // second must be the other player
      }
    }
    return false;
  }

  function tap(playerId: string, slot: number): void {
    if (!myTurn) return;
    const target: SlotRef = { playerId, slot };
    if (view.turnPhase === "decide") {
      if (playerId === session.active.clientId) session.active.send({ t: "swap", slot });
      return;
    }
    if (view.turnPhase !== "power") return;
    if (pp === "peekOpponent" || pp === "peekOwn") {
      session.active.send({ t: "peek", target });
    } else if (pp === "jackPeekSwap") {
      if (!view.jackAwaitingSwap) {
        jackPeeked = target;
        session.active.send({ t: "peek", target });
      } else if (
        playerId === session.active.clientId &&
        jackPeeked &&
        jackPeeked.playerId !== session.active.clientId
      ) {
        session.active.send({ t: "powerSwap", first: jackPeeked, second: target });
      }
    } else if (pp === "queenSwap") {
      if (!firstPick) firstPick = target;
      else if (target.playerId === firstPick.playerId) firstPick = target; // re-pick your side
      else {
        session.active.send({ t: "powerSwap", first: firstPick, second: target });
        firstPick = null;
      }
    }
  }

  function drawCard(): void {
    if (canDraw) session.active.send({ t: "draw" });
  }
  function discardHeld(): void {
    if (canDiscard) session.active.send({ t: "discard" });
  }
  function leaveTable(): void {
    if (confirm("Leave the game?")) session.active.leave();
  }

  function hand(p: PlayerView) {
    return p.hand;
  }

  const sortedTotals = $derived(
    view.result ? [...view.result.totals].sort((a, b) => a.total - b.total) : []
  );
  const winnerText = $derived(
    !view.result
      ? ""
      : view.result.winnerId === null
        ? "Draw"
        : view.result.winnerId === session.active.clientId
          ? "You win 🏆"
          : "You lose"
  );
  const winnerSub = $derived(
    !view.result
      ? ""
      : view.result.winnerId === null
        ? "Equal hands — nobody wins."
        : view.result.winnerId === session.active.clientId
          ? "Lowest hand at the table."
          : `${view.players.find((p) => p.id === view.result!.winnerId)?.name} had the lower hand.`
  );
</script>

<main class="screen table">
  <header class="table-top">
    <button class="pill pill-btn pill-leave" onclick={leaveTable} aria-label="Leave the game">
      Leave
    </button>
    <span class="pill">Room {view.roomCode}</span>
    <button class="pill pill-btn" onclick={() => theme.toggle()} aria-label="Switch table style">
      ◐ {theme.label}
    </button>
    <button class="pill pill-btn" onclick={() => sound.toggle()} aria-label="Toggle sound">
      {sound.muted ? "🔇" : "🔊"}
    </button>
    {#if session.mode === "local"}
      <button class="pill pill-btn" onclick={() => session.local?.skipToEnd()} aria-label="Skip to end (testing)">
        ⏭ End
      </button>
    {/if}
  </header>

  {#if view.phase === "playing"}
    <div class="turn-banner" class:mine={myTurn} class:pop={turnFlash}>
      {myTurn ? "Your turn" : `${active?.name ?? "…"}'s turn`}
    </div>
  {/if}

  {#if opp}
    <section class="seat opp" class:seat-active={active?.id === opp.id}>
      <div class="seat-name">
        {opp.name}{opp.connected ? "" : " (offline)"}
      </div>
      <div class="hand">
        {#each hand(opp) as c, slot (c?.id ?? `o${slot}`)}
          <Card
            card={c}
            empty={c === null}
            size="md"
            selectable={selectable(opp.id, slot)}
            selected={same(firstPick, opp.id, slot) ||
              same(jackPeeked, opp.id, slot)}
            onclick={() => tap(opp.id, slot)}
          />
        {/each}
      </div>
    </section>
  {/if}

  <div class="middle">
    <section class="center">
      <button
        class="pile pile-btn"
        class:armed={canDraw}
        onclick={drawCard}
        aria-label="Draw from the deck"
      >
        <div class="deck"><span class="deck-count">{view.deckCount}</span></div>
        <span class="pile-label">Deck</span>
      </button>

      {#if view.held}
        <div class="pile held" transition:scale={{ duration: 200, start: 0.6 }}>
          <Card card={view.held.card} size="md" highlight />
          <span class="pile-label">Drew</span>
        </div>
      {/if}

      <button
        class="pile pile-btn"
        class:armed={canDiscard}
        onclick={discardHeld}
        aria-label="Throw the card onto the discard pile"
      >
        {#if view.discardTop}
          <Card card={view.discardTop} size="md" />
        {:else}
          <div class="card card-md card-empty"></div>
        {/if}
        <span class="pile-label">Discard</span>
      </button>
    </section>
  </div>

  <section class="seat mine" class:seat-active={myTurn}>
    <div class="seat-name">{me.name} (you)</div>
    <div class="hand">
      {#each hand(me) as c, slot (c?.id ?? `m${slot}`)}
        <Card
          card={c}
          empty={c === null}
          size="lg"
          selectable={selectable(session.active.clientId, slot)}
          selected={same(firstPick, session.active.clientId, slot) ||
            same(jackPeeked, session.active.clientId, slot)}
          onclick={() => tap(session.active.clientId, slot)}
        />
      {/each}
    </div>
  </section>

  <footer class="action-bar">
    {#if !myTurn}
      <span class="hint">{active?.name}'s turn…</span>
    {:else if view.turnPhase === "draw"}
      <span class="hint">Tap the <b>deck</b> to draw</span>
    {:else if view.turnPhase === "decide"}
      <span class="hint">Tap a card to <b>swap</b>, or the <b>discard</b> to throw it</span>
    {:else if view.turnPhase === "power"}
      <span class="hint">
        {#if pp === "peekOpponent"}Tap an opponent's card to peek
        {:else if pp === "peekOwn"}Tap one of your cards to peek
        {:else if pp === "jackPeekSwap" && !view.jackAwaitingSwap}Tap any card to peek it
        {:else if pp === "jackPeekSwap"}Tap your card to take it — or keep yours
        {:else if pp === "queenSwap"}Tap two cards to swap them
        {/if}
      </span>
      <button class="btn btn-ghost" onclick={() => session.active.send({ t: "skip" })}>
        {pp === "jackPeekSwap" && view.jackAwaitingSwap ? "Keep" : "Skip"}
      </button>
    {/if}
  </footer>

  {#if view.log.length}
    <div class="log">{view.log[view.log.length - 1]}</div>
  {/if}

  {#if view.phase === "gameEnd" && view.result}
    <div class="overlay">
      <div class="overlay-card">
        <h2>{winnerText}</h2>
        <p class="overlay-sub">{winnerSub}</p>
        <div class="results">
          {#each sortedTotals as t (t.playerId)}
            <div class="result-row" class:win={t.playerId === view.result.winnerId}>
              <span>{t.name}{t.playerId === session.active.clientId ? " (you)" : ""}</span>
              <span class="result-total">{t.total}</span>
            </div>
          {/each}
        </div>
        {#if session.active.isHost}
          <button class="btn btn-primary btn-lg" onclick={() => session.active.send({ t: "rematch" })}>
            Play again
          </button>
        {:else}
          <p class="hint">Waiting for the host…</p>
        {/if}
      </div>
    </div>
  {/if}
</main>
