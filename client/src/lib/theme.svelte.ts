export type Theme = "midnight" | "emerald";

const KEY = "cambio_theme";

/** Table style. Flips `data-theme` on <html>; all colors are CSS tokens per theme. */
class ThemeStore {
  current = $state<Theme>(
    (localStorage.getItem(KEY) as Theme | null) ?? "midnight"
  );

  constructor() {
    this.apply();
  }

  set(t: Theme): void {
    this.current = t;
    localStorage.setItem(KEY, t);
    this.apply();
  }

  toggle(): void {
    this.set(this.current === "midnight" ? "emerald" : "midnight");
  }

  get label(): string {
    return this.current === "midnight" ? "Midnight" : "Emerald";
  }

  private apply(): void {
    document.documentElement.setAttribute("data-theme", this.current);
  }
}

export const theme = new ThemeStore();
