<script lang="ts">
  import type { CardView } from "@cambio/shared";

  interface Props {
    card?: CardView | null;
    faceDown?: boolean;
    size?: "sm" | "md" | "lg";
    selectable?: boolean;
    selected?: boolean;
    highlight?: boolean;
    peeked?: boolean;
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
    peeked = false,
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
  const glyph = $derived(SUIT[card?.suit ?? "spades"]);
</script>

{#snippet content()}
  {#if faceUp}
    <span class="card-idx">{card?.rank}<small>{glyph}</small></span>
    <span class="card-pip">{glyph}</span>
  {/if}
{/snippet}

{#if empty || card === null}
  <div class="card card-{size} card-empty"></div>
{:else if onclick}
  <button
    type="button"
    class="card card-{size}"
    class:card-face={faceUp}
    class:card-back={!faceUp}
    class:card-red={red}
    class:card-selectable={selectable}
    class:card-selected={selected}
    class:card-highlight={highlight}
    class:card-peeked={peeked}
    {onclick}
  >
    {@render content()}
  </button>
{:else}
  <div
    class="card card-{size}"
    class:card-face={faceUp}
    class:card-back={!faceUp}
    class:card-red={red}
    class:card-highlight={highlight}
    class:card-peeked={peeked}
  >
    {@render content()}
  </div>
{/if}
