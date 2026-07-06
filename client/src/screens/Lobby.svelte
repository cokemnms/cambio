<script lang="ts">
  import { game } from "../lib/game.svelte";

  let copied = $state(false);

  const view = $derived(game.view!);
  const shareUrl = $derived(
    `${location.origin}${location.pathname}?room=${view.roomCode}`
  );

  async function share() {
    const data = {
      title: "Cambio",
      text: `Join my Cambio game — room ${view.roomCode}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      throw new Error("no share");
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    }
  }
</script>

<main class="screen lobby">
  <div class="lobby-head">
    <div class="room-code">
      <span class="room-code-label">Room</span>
      <span class="room-code-value">{view.roomCode}</span>
    </div>
    <button class="btn btn-ghost" onclick={() => game.leave()}>Leave</button>
  </div>

  <button class="btn btn-share" onclick={share}>
    {copied ? "Link copied!" : "📤 Share invite"}
  </button>

  <div class="players">
    <h2>Players ({view.players.length}/2)</h2>
    {#each view.players as p (p.id)}
      <div class="player-row">
        <span class="player-dot" class:on={p.connected}></span>
        <span class="player-name">
          {p.name}{p.id === game.clientId ? " (you)" : ""}
        </span>
        {#if p.isHost}<span class="badge">Host</span>{/if}
      </div>
    {/each}
  </div>

  {#if game.isHost}
    <button
      class="btn btn-primary btn-lg"
      disabled={view.players.length < 2}
      onclick={() => game.send({ t: "start" })}
    >
      {view.players.length < 2 ? "Waiting for a player…" : "Start game"}
    </button>
  {:else}
    <p class="hint">Waiting for the host to start…</p>
  {/if}
</main>
