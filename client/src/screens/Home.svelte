<script lang="ts">
  import { game } from "../lib/game.svelte";
  import { session } from "../lib/session.svelte";
  import { theme } from "../lib/theme.svelte";

  let mode = $state<"online" | "local">("online");

  let name = $state(localStorage.getItem("cambio_name") ?? "");
  let code = $state(
    new URLSearchParams(location.search).get("room")?.toUpperCase() ?? ""
  );
  let nameA = $state(localStorage.getItem("cambio_name") ?? "");
  let nameB = $state("");

  const canCreate = $derived(name.trim().length > 0);
  const canJoin = $derived(canCreate && code.trim().length >= 4);
  const canLocal = $derived(
    nameA.trim().length > 0 &&
      nameB.trim().length > 0 &&
      nameA.trim().toLowerCase() !== nameB.trim().toLowerCase()
  );

  function remember() {
    localStorage.setItem("cambio_name", name.trim());
  }
  function create() {
    if (canCreate) {
      remember();
      game.create(name.trim());
    }
  }
  function join() {
    if (canJoin) {
      remember();
      game.join(code.trim(), name.trim());
    }
  }
  function startLocal() {
    if (canLocal) session.startLocal(nameA.trim(), nameB.trim());
  }
</script>

<main class="screen home">
  <div class="brand">
    <div class="brand-logo">🃏</div>
    <h1>Cambio</h1>
    <p class="tagline">Lowest hand wins. Trust your memory.</p>
  </div>

  <div class="seg mode-seg">
    <button class:on={mode === "online"} onclick={() => (mode = "online")}>Online</button>
    <button class:on={mode === "local"} onclick={() => (mode = "local")}>Pass &amp; play</button>
  </div>

  {#if mode === "online"}
    <div class="panel">
      <label class="field">
        <span>Your name</span>
        <input bind:value={name} maxlength="16" placeholder="e.g. Abdee" autocomplete="off" />
      </label>

      <button class="btn btn-primary" disabled={!canCreate} onclick={create}>
        Create a room
      </button>

      <div class="divider"><span>or join</span></div>

      <label class="field">
        <span>Room code</span>
        <input
          class="code-input"
          bind:value={code}
          maxlength="4"
          placeholder="ABCD"
          autocomplete="off"
          autocapitalize="characters"
          oninput={(e) =>
            (code = (e.currentTarget as HTMLInputElement).value.toUpperCase())}
        />
      </label>
      <button class="btn" disabled={!canJoin} onclick={join}>Join room</button>
    </div>
  {:else}
    <div class="panel">
      <p class="hint">Two players, one device — pass it around each turn.</p>
      <label class="field">
        <span>Player 1</span>
        <input bind:value={nameA} maxlength="16" placeholder="e.g. Abdee" autocomplete="off" />
      </label>
      <label class="field">
        <span>Player 2</span>
        <input bind:value={nameB} maxlength="16" placeholder="e.g. Sam" autocomplete="off" />
      </label>
      <button class="btn btn-primary btn-lg" disabled={!canLocal} onclick={startLocal}>
        Start pass &amp; play
      </button>
    </div>
  {/if}

  <div class="theme-pick">
    <span>Table style</span>
    <div class="seg">
      <button class:on={theme.current === "midnight"} onclick={() => theme.set("midnight")}>
        Midnight
      </button>
      <button class:on={theme.current === "emerald"} onclick={() => theme.set("emerald")}>
        Emerald
      </button>
    </div>
  </div>
</main>
