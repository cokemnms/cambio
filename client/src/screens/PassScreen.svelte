<script lang="ts">
  import { session } from "../lib/session.svelte";
  const local = $derived(session.local);
</script>

{#if local}
  <div class="pass-overlay">
    <div class="pass-card">
      <div class="pass-emoji">🙈</div>
      <h2>Pass to {local.passName}</h2>
      <p>Hand the device over — no peeking at each other's cards.</p>
      <button class="btn btn-primary btn-lg" onclick={() => local.ready()}>
        I'm {local.passName} — ready
      </button>
    </div>
  </div>
{/if}
