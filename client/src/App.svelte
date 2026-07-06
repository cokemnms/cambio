<script lang="ts">
  import { game } from "./lib/game.svelte";
  import Home from "./screens/Home.svelte";
  import Lobby from "./screens/Lobby.svelte";
  import Table from "./screens/Table.svelte";
</script>

{#if !game.view}
  <Home />
{:else if game.view.phase === "lobby"}
  <Lobby />
{:else}
  <Table />
{/if}

{#if game.notice}
  <div class="notice notice-{game.notice.kind}" role="status">
    {game.notice.message}
  </div>
{/if}
