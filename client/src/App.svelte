<script lang="ts">
  import { onMount } from "svelte";
  import { game } from "./lib/game.svelte";
  import { session } from "./lib/session.svelte";
  import Home from "./screens/Home.svelte";
  import Lobby from "./screens/Lobby.svelte";
  import Table from "./screens/Table.svelte";
  import PassScreen from "./screens/PassScreen.svelte";
  import DevPanel from "./screens/DevPanel.svelte";
  import { sound } from "./lib/sound.svelte";

  onMount(() => {
    game.resume();
    window.addEventListener("pointerdown", () => sound.unlock(), { once: true });
  });

  const view = $derived(session.active.view);
  const notice = $derived(session.active.notice);
</script>

{#if session.local?.passTo}
  <PassScreen />
{:else if !view}
  <Home />
{:else if view.phase === "lobby"}
  <Lobby />
{:else}
  <Table />
  {#if session.local?.reviewFor}
    <div class="review-bar">
      <span>👀 Memorize your peek…</span>
      <button class="btn btn-primary" onclick={() => session.local?.finishReview()}>Done</button>
    </div>
  {/if}
{/if}

{#if notice}
  <div class="notice notice-{notice.kind}" role="status">
    {notice.message}
  </div>
{/if}

<DevPanel />
