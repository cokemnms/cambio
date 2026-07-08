import type { Controller } from "./controller";
import { game } from "./game.svelte";
import { LocalController } from "./local.svelte";

/**
 * Which backend the UI is talking to. Online (PartyKit `game`) is the default;
 * pass-and-play swaps in a self-contained `LocalController`. Local is isolated:
 * no rooms, no cross-device — the only way out is back to Home.
 */
class Session {
  local = $state<LocalController | null>(null);

  get mode(): "online" | "local" {
    return this.local ? "local" : "online";
  }

  get active(): Controller {
    return this.local ?? game;
  }

  startLocal(nameA: string, nameB: string): void {
    this.local = new LocalController(nameA, nameB, () => this.exitLocal());
  }

  exitLocal(): void {
    this.local = null;
  }
}

export const session = new Session();
