import type { VisualEvent } from "../core/types";
export class AudioView {
  private context: AudioContext | null = null;
  private voices = 0;
  private lastTick = -100;
  volume = 0.3;
  reset(): void {
    this.lastTick = -100;
  }
  async unlock(): Promise<void> {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch {
      /* Browser audio support is optional. */
    }
  }
  pause(): void {
    void this.context?.suspend().catch(() => {});
  }
  play(events: readonly VisualEvent[], tick: number): void {
    const c = this.context;
    if (!c || c.state !== "running" || this.volume === 0 || this.voices >= 8)
      return;
    const event =
      events.find(
        (e) =>
          e.kind === "hit" ||
          e.kind === "hurt" ||
          e.kind === "wave" ||
          e.kind === "cycle" ||
          e.kind === "kill",
      ) ??
      (tick - this.lastTick >= 5
        ? events.find((e) => e.kind === "shot" && !e.echo)
        : undefined);
    if (!event) return;
    this.lastTick = tick;
    const frequency =
      event.kind === "hit"
        ? 820
        : event.kind === "hurt"
          ? 95
          : event.kind === "wave"
            ? 160
            : event.kind === "cycle"
              ? 620
              : event.kind === "kill"
                ? 280
                : 440;
    try {
      const osc = c.createOscillator(),
        gain = c.createGain(),
        time = c.currentTime;
      osc.type = event.kind === "hurt" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency, time);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.45, time + 0.1);
      gain.gain.setValueAtTime(this.volume * 0.06, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
      osc.connect(gain);
      gain.connect(c.destination);
      this.voices++;
      osc.onended = () => {
        this.voices--;
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(time);
      osc.stop(time + 0.13);
    } catch {
      /* A closed audio device must not stop simulation. */
    }
  }
  destroy(): void {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
