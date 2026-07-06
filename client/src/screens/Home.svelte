<script lang="ts">
  import { game } from "../lib/game.svelte";

  let name = $state(localStorage.getItem("cambio_name") ?? "");
  let code = $state(
    new URLSearchParams(location.search).get("room")?.toUpperCase() ?? ""
  );

  const canCreate = $derived(name.trim().length > 0);
  const canJoin = $derived(canCreate && code.trim().length >= 4);

  function remember() {
    localStorage.setItem("cambio_name", name.trim());
  }
  function create() {
    if (!canCreate) return;
    remember();
    game.create(name.trim());
  }
  function join() {
    if (!canJoin) return;
    remember();
    game.join(code.trim(), name.trim());
  }
</script>

<main class="screen home">
  <div class="brand">
    <div class="brand-logo">🃏</div>
    <h1>Cambio</h1>
    <p class="tagline">Lowest hand wins. Trust your memory.</p>
  </div>

  <div class="panel">
    <label class="field">
      <span>Your name</span>
      <input
        bind:value={name}
        maxlength="16"
        placeholder="e.g. Abdee"
        autocomplete="off"
      />
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
</main>
