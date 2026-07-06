<script lang="ts">
  import type { CardView } from "@cambio/shared";

  interface Props {
    card?: CardView | null;
    faceDown?: boolean;
    size?: "sm" | "md" | "lg";
    selectable?: boolean;
    selected?: boolean;
    highlight?: boolean;
    empty?: boolean;
    onclick?: () => void;
  }

  let {
    card = null,
    faceDown = false,
    size = "md",
    selectable = false,
    selected = false,
    highlight = false,
    empty = false,
    onclick,
  }: Props = $props();

  const SUIT: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  const faceUp = $derived(!!card?.faceUp && !faceDown);
  const red = $derived(card?.suit === "hearts" || card?.suit === "diamonds");
</script>

{#if empty || card === null}
  <div class="card card-{size} card-empty"></div>
{:else}
  <button
    type="button"
    class="card card-{size}"
    class:card-face={faceUp}
    class:card-back={!faceUp}
    class:card-red={red}
    class:card-selectable={selectable}
    class:card-selected={selected}
    class:card-highlight={highlight}
    disabled={!selectable && !onclick}
    {onclick}
  >
    {#if faceUp}
      <span class="card-rank">{card.rank}</span>
      <span class="card-suit">{SUIT[card.suit ?? "spades"]}</span>
    {:else}
      <span class="card-back-emblem">✦</span>
    {/if}
  </button>
{/if}
