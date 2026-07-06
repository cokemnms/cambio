<script lang="ts">
  import type { PlayerView, SlotRef } from "@cambio/shared";
  import { game } from "../lib/game.svelte";
  import Card from "../lib/Card.svelte";

  const view = $derived(game.view!);
  const me = $derived(view.players.find((p) => p.id === game.clientId)!);
  const opp = $derived(view.players.find((p) => p.id !== game.clientId) ?? null);
  const active = $derived(view.players[view.activePlayerIndex] ?? null);
  const myTurn = $derived(
    active?.id === game.clientId && view.phase === "playing"
  );
  const pp = $derived(myTurn ? view.pendingPower : null);

  // Local selection state for the two-step swap powers.
  let firstPick = $state<SlotRef | null>(null); // Queen: first of two cards
  let jackPeeked = $state<SlotRef | null>(null); // Jack: the card we peeked

  $effect(() => {
    if (view.turnPhase !== "power") {
      firstPick = null;
      jackPeeked = null;
    }
  });

  function same(a: SlotRef | null, playerId: string, slot: number): boolean {
    return !!a && a.playerId === playerId && a.slot === slot;
  }

  function selectable(playerId: string, _slot: number): boolean {
    if (!myTurn) return false;
    if (view.turnPhase === "decide") return playerId === game.clientId;
    if (view.turnPhase === "power") {
      if (pp === "peekOpponent") return playerId !== game.clientId;
      if (pp === "peekOwn") return playerId === game.clientId;
      if (pp === "jackPeekSwap")
        return view.jackAwaitingSwap ? playerId === game.clientId : true;
      if (pp === "queenSwap") return true;
    }
    return false;
  }

  function tap(playerId: string, slot: number): void {
    if (!myTurn) return;
    const target: SlotRef = { playerId, slot };
    if (view.turnPhase === "decide") {
      if (playerId === game.clientId) game.send({ t: "swap", slot });
      return;
    }
    if (view.turnPhase !== "power") return;
    if (pp === "peekOpponent" || pp === "peekOwn") {
      game.send({ t: "peek", target });
    } else if (pp === "jackPeekSwap") {
      if (!view.jackAwaitingSwap) {
        jackPeeked = target;
        game.send({ t: "peek", target });
      } else if (playerId === game.clientId && jackPeeked) {
        game.send({ t: "powerSwap", first: jackPeeked, second: target });
      }
    } else if (pp === "queenSwap") {
      if (!firstPick) firstPick = target;
      else {
        game.send({ t: "powerSwap", first: firstPick, second: target });
        firstPick = null;
      }
    }
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
        ? "It's a draw!"
        : view.result.winnerId === game.clientId
          ? "You win! 🏆"
          : `${view.players.find((p) => p.id === view.result!.winnerId)?.name} wins`
  );
</script>

<main class="screen table">
  <header class="table-top">
    <span class="pill">Room {view.roomCode}</span>
    <span class="pill">Deck {view.deckCount}</span>
  </header>

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

  <section class="center">
    <button
      class="pile"
      onclick={() => myTurn && view.turnPhase === "draw" && game.send({ t: "draw" })}
      aria-label="Deck"
    >
      <Card
        faceDown
        card={{ id: "deck", faceUp: false }}
        size="md"
        selectable={myTurn && view.turnPhase === "draw"}
      />
      <span class="pile-label">Deck</span>
    </button>

    <div class="pile">
      <Card card={view.discardTop} empty={!view.discardTop} size="md" />
      <span class="pile-label">Discard</span>
    </div>

    {#if view.held}
      <div class="pile held">
        <Card card={view.held.card} size="md" highlight />
        <span class="pile-label">Drew</span>
      </div>
    {/if}
  </section>

  <section class="seat mine" class:seat-active={myTurn}>
    <div class="seat-name">{me.name} (you)</div>
    <div class="hand">
      {#each hand(me) as c, slot (c?.id ?? `m${slot}`)}
        <Card
          card={c}
          empty={c === null}
          size="lg"
          selectable={selectable(game.clientId, slot)}
          selected={same(firstPick, game.clientId, slot) ||
            same(jackPeeked, game.clientId, slot)}
          onclick={() => tap(game.clientId, slot)}
        />
      {/each}
    </div>
  </section>

  <footer class="action-bar">
    {#if !myTurn}
      <span class="hint">{active?.name}'s turn…</span>
    {:else if view.turnPhase === "draw"}
      <button class="btn btn-primary" onclick={() => game.send({ t: "draw" })}>
        Draw
      </button>
    {:else if view.turnPhase === "decide"}
      <span class="hint">Tap a card to swap it in</span>
      <button class="btn" onclick={() => game.send({ t: "discard" })}>
        Discard
      </button>
    {:else if view.turnPhase === "power"}
      <span class="hint">
        {#if pp === "peekOpponent"}Tap an opponent's card to peek
        {:else if pp === "peekOwn"}Tap one of your cards to peek
        {:else if pp === "jackPeekSwap" && !view.jackAwaitingSwap}Tap any card to peek it
        {:else if pp === "jackPeekSwap"}Tap your card to take it — or keep yours
        {:else if pp === "queenSwap"}Tap two cards to swap them
        {/if}
      </span>
      <button class="btn btn-ghost" onclick={() => game.send({ t: "skip" })}>
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
        <div class="results">
          {#each sortedTotals as t (t.playerId)}
            <div class="result-row" class:win={t.playerId === view.result.winnerId}>
              <span>{t.name}{t.playerId === game.clientId ? " (you)" : ""}</span>
              <span class="result-total">{t.total}</span>
            </div>
          {/each}
        </div>
        {#if game.isHost}
          <button class="btn btn-primary btn-lg" onclick={() => game.send({ t: "rematch" })}>
            Play again
          </button>
        {:else}
          <p class="hint">Waiting for the host…</p>
        {/if}
      </div>
    </div>
  {/if}
</main>
