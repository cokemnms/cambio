<script lang="ts">
  import { RANKS, SUITS } from "@cambio/shared";
  import type { DevAction, Rank, Suit } from "@cambio/shared";
  import { game } from "../lib/game.svelte";
  import { session } from "../lib/session.svelte";

  // Secret comes from the URL (?dev=SECRET) — never shipped in the bundle.
  const secret = new URLSearchParams(location.search).get("dev") ?? "";

  let open = $state(false);
  let godOn = $state(false);
  let rank = $state<Rank>("A");
  let suit = $state<Suit>("spades");
  let targetPlayer = $state("");
  let slot = $state(0);

  const view = $derived(game.view);
  const players = $derived(view?.players ?? []);
  const slots = $derived(players[0]?.hand.length ?? 3);

  function dev(action: DevAction): void {
    game.send({ t: "dev", secret, action });
  }
  function toggleGod(): void {
    godOn = !godOn;
    dev({ kind: "godView", on: godOn });
  }
  function setSlot(): void {
    const pid = targetPlayer || players[0]?.id;
    if (pid) dev({ kind: "setSlot", target: { playerId: pid, slot }, rank, suit });
  }
</script>

{#if secret && session.mode === "online" && view}
  {#if open}
    <div class="dev-panel">
      <div class="dev-head">
        <strong>🐞 God mode</strong>
        <button class="dev-x" onclick={() => (open = false)}>×</button>
      </div>

      <button class="dev-btn" class:on={godOn} onclick={toggleGod}>
        {godOn ? "God view: ON" : "God view: off"}
      </button>

      <div class="dev-row">
        <select bind:value={rank}>
          {#each RANKS as r}<option value={r}>{r}</option>{/each}
        </select>
        <select bind:value={suit}>
          {#each SUITS as s}<option value={s}>{s}</option>{/each}
        </select>
      </div>

      <div class="dev-row">
        <select bind:value={targetPlayer}>
          {#each players as p}<option value={p.id}>{p.name}</option>{/each}
        </select>
        <select bind:value={slot}>
          {#each Array(slots) as _, i}<option value={i}>slot {i}</option>{/each}
        </select>
        <button class="dev-btn" onclick={setSlot}>Set</button>
      </div>

      <div class="dev-row">
        <button class="dev-btn" onclick={() => dev({ kind: "setHeld", rank, suit })}>Set held</button>
        <button class="dev-btn" onclick={() => dev({ kind: "setDeckTop", rank, suit })}>Deck top</button>
      </div>

      <div class="dev-row">
        {#each players as p}
          <button class="dev-btn" onclick={() => dev({ kind: "setTurn", playerId: p.id })}>
            {p.name}'s turn
          </button>
        {/each}
      </div>

      <button class="dev-btn danger" onclick={() => dev({ kind: "endGame" })}>End game now</button>
    </div>
  {:else}
    <button class="dev-fab" onclick={() => (open = true)} aria-label="Dev tools">🐞</button>
  {/if}
{/if}
