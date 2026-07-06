<script lang="ts">
  import { game } from "../lib/game.svelte";

  let copied = $state(false);

  const view = $derived(game.view!);
  const shareUrl = $derived(
    `${location.origin}${location.pathname}?room=${view.roomCode}`
  );

  async function copyText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to legacy copy */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function share() {
    // Web Share API is secure-context-only; try it, otherwise copy the link.
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Cambio",
          text: `Join my Cambio game — room ${view.roomCode}`,
          url: shareUrl,
        });
        return;
      }
    } catch {
      /* user cancelled or unsupported — fall back to copy */
    }
    if (await copyText(shareUrl)) {
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
