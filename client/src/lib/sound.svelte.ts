export type Sfx = "draw" | "discard" | "swap" | "peek" | "turn" | "win" | "lose";

/**
 * Tiny synthesized sound kit (Web Audio) — no asset files, works offline and
 * over plain-http LAN. The context is created lazily and resumed on the first
 * user gesture (browsers block autoplay). Swap for real samples later if wanted.
 */
class Sound {
  muted = $state(localStorage.getItem("cambio_muted") === "1");
  private ctx: AudioContext | null = null;

  private ac(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture to unlock audio. */
  unlock(): void {
    void this.ac();
  }

  toggle(): void {
    this.muted = !this.muted;
    localStorage.setItem("cambio_muted", this.muted ? "1" : "0");
    if (!this.muted) this.unlock();
  }

  private note(
    ctx: AudioContext,
    at: number,
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; vol?: number; glideTo?: number } = {}
  ): void {
    const { type = "sine", vol = 0.2, glideTo } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }

  play(name: Sfx): void {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case "draw":
        this.note(ctx, t, 420, 0.1, { glideTo: 640, vol: 0.16 });
        break;
      case "discard":
        this.note(ctx, t, 300, 0.13, { type: "triangle", glideTo: 150, vol: 0.22 });
        break;
      case "swap":
        this.note(ctx, t, 520, 0.08, { glideTo: 720, vol: 0.15 });
        this.note(ctx, t + 0.09, 720, 0.08, { glideTo: 520, vol: 0.15 });
        break;
      case "peek":
        this.note(ctx, t, 880, 0.14, { vol: 0.13 });
        break;
      case "turn":
        this.note(ctx, t, 660, 0.12, { vol: 0.18 });
        this.note(ctx, t + 0.12, 880, 0.18, { vol: 0.18 });
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) =>
          this.note(ctx, t + i * 0.12, f, 0.2, { vol: 0.18 })
        );
        break;
      case "lose":
        [440, 349, 262].forEach((f, i) =>
          this.note(ctx, t + i * 0.14, f, 0.24, { type: "triangle", vol: 0.2 })
        );
        break;
    }
  }
}

export const sound = new Sound();
