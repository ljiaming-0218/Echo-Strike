// Browser display capabilities are optional: embedded browsers can always use
// a rotated, logical landscape viewport without fullscreen/orientation APIs.
export class DisplayMode {
  fallback = false;
  rotated = false;
  portrait = false;
  readonly mobile =
    matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 &&
      /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  constructor(readonly stage: HTMLElement) {
    this.update();
  }
  update(): void {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth),
      height = Math.round(viewport?.height ?? window.innerHeight);
    const left = viewport?.offsetLeft ?? 0,
      top = viewport?.offsetTop ?? 0;
    this.portrait = this.mobile && height > width;
    this.rotated = this.fallback && this.portrait;
    this.stage.dataset.mobile = String(this.mobile);
    this.stage.dataset.rotated = String(this.rotated);
    this.stage.dataset.compact = String((this.rotated ? width : height) <= 600);
    this.stage.dataset.narrow = String(
      (this.rotated ? height : width) <= 580 &&
        (this.rotated ? width : height) >= 601,
    );
    this.stage.style.left = `${left + (this.rotated ? width / 2 : 0)}px`;
    this.stage.style.top = `${top + (this.rotated ? height / 2 : 0)}px`;
    this.stage.style.width = `${this.rotated ? height : width}px`;
    this.stage.style.height = `${this.rotated ? width : height}px`;
    const canvas = this.stage.querySelector("canvas");
    if (canvas) {
      // Read local dimensions, not transformed getBoundingClientRect dimensions.
      const zoom = Math.min(
        this.stage.clientWidth / 1280,
        this.stage.clientHeight / 720,
      );
      canvas.style.width = `${1280 * zoom}px`;
      canvas.style.height = `${720 * zoom}px`;
    }
  }
  get needsLandscape(): boolean {
    return this.portrait && !this.rotated;
  }
  adapt(): void {
    this.fallback = true;
    this.update();
  }
  auto(): void {
    this.fallback = false;
    this.update();
  }
  async requestLandscape(): Promise<void> {
    // Invoked only by a button click. Missing/rejected capabilities are normal.
    const stage = this.stage as HTMLElement & {
      webkitRequestFullscreen?: () => void | Promise<void>;
    };
    try {
      if (!document.fullscreenElement) {
        if (stage.requestFullscreen)
          await stage.requestFullscreen({ navigationUI: "hide" });
        else await stage.webkitRequestFullscreen?.();
      }
    } catch {
      /* Embedded browsers may refuse fullscreen. */
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    };
    try {
      await orientation?.lock?.("landscape");
    } catch {
      /* The rotated fallback stays playable. */
    }
    this.update();
    if (this.needsLandscape) this.adapt();
  }
}

export function screenVector(
  x: number,
  y: number,
  rotated: boolean,
): { x: number; y: number } {
  return rotated ? { x: y, y: -x } : { x, y };
}
export function canvasPoint(
  rect: {
    left: number;
    top: number;
    right: number;
    width: number;
    height: number;
  },
  x: number,
  y: number,
  rotated: boolean,
): { x: number; y: number } {
  return rotated
    ? {
        x: ((y - rect.top) / rect.height) * 1280,
        y: ((rect.right - x) / rect.width) * 720,
      }
    : {
        x: ((x - rect.left) / rect.width) * 1280,
        y: ((y - rect.top) / rect.height) * 720,
      };
}
