export interface Settings {
  volume: number;
  reduced: boolean;
  best: number;
}
const defaults: Settings = { volume: 0.3, reduced: false, best: 0 };
export function loadSettings(): Settings {
  try {
    const v: unknown = JSON.parse(
      localStorage.getItem("echo-rush:v1") ?? "null",
    );
    if (!v || typeof v !== "object") return { ...defaults };
    const x = v as Partial<Settings>;
    return {
      volume:
        typeof x.volume === "number" && Number.isFinite(x.volume)
          ? Math.max(0, Math.min(1, x.volume))
          : defaults.volume,
      reduced: x.reduced === true,
      best:
        typeof x.best === "number" && Number.isFinite(x.best)
          ? Math.max(0, Math.floor(x.best))
          : 0,
    };
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(value: Settings): void {
  try {
    localStorage.setItem("echo-rush:v1", JSON.stringify(value));
  } catch {
    /* Storage is optional, never required to play. */
  }
}
