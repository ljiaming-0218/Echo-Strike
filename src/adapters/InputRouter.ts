import { direction } from "../core/math/geometry";
import type { InputCommand } from "../core/types";
export class InputRouter {
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  private dash = false;
  private wave = false;
  private joystickId: number | null = null;
  private disposers: (() => void)[] = [];
  constructor(
    private readonly canAct: () => boolean,
    onPause: () => void,
  ) {
    this.listen(window, "keydown", (raw: Event) => {
      const e = raw as KeyboardEvent;
      if (e.target instanceof HTMLInputElement) return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Escape" && !e.repeat) {
        onPause();
        return;
      }
      if (!this.canAct()) return;
      this.keys.add(e.code);
      if (!e.repeat) {
        if (e.code === "Space") this.dash = true;
        if (e.code === "KeyQ") this.wave = true;
      }
    });
    this.listen(window, "keyup", (raw: Event) => {
      this.keys.delete((raw as KeyboardEvent).code);
    });
  }
  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.disposers.push(() => target.removeEventListener(type, fn));
  }
  bindTouch(
    stick: HTMLElement,
    knob: HTMLElement,
    dash: HTMLElement,
    wave: HTMLElement,
  ): void {
    const update = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect(),
        dx = (e.clientX - r.left - r.width / 2) / (r.width * 0.36),
        dy = (e.clientY - r.top - r.height / 2) / (r.height * 0.36),
        v = direction(dx, dy);
      this.stick = Math.hypot(v.x, v.y) < 0.15 ? { x: 0, y: 0 } : v;
      knob.style.transform = `translate(${this.stick.x * 28}px,${this.stick.y * 28}px)`;
    };
    this.listen(stick, "pointerdown", (raw: Event) => {
      const e = raw as PointerEvent;
      if (!this.canAct() || this.joystickId !== null) return;
      e.preventDefault();
      this.joystickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      update(e);
    });
    this.listen(stick, "pointermove", (raw: Event) => {
      const e = raw as PointerEvent;
      if (e.pointerId === this.joystickId) update(e);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      this.listen(stick, type, (raw: Event) => {
        if ((raw as PointerEvent).pointerId !== this.joystickId) return;
        this.joystickId = null;
        this.stick = { x: 0, y: 0 };
        knob.style.transform = "";
      });
    for (const [button, kind] of [
      [dash, "dash"],
      [wave, "wave"],
    ] as const) {
      this.listen(button, "pointerdown", (raw: Event) => {
        const e = raw as PointerEvent;
        if (!this.canAct()) return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        if (kind === "dash") this.dash = true;
        else this.wave = true;
      });
      // Keyboard/accessibility activation also submits exactly one edge.
      this.listen(button, "click", (raw: Event) => {
        if ((raw as MouseEvent).detail !== 0 || !this.canAct()) return;
        if (kind === "dash") this.dash = true;
        else this.wave = true;
      });
    }
  }
  sample(): InputCommand {
    const key = (a: string, b: string) =>
      Number(this.keys.has(a) || this.keys.has(b));
    const move = direction(
      this.stick.x + key("KeyD", "ArrowRight") - key("KeyA", "ArrowLeft"),
      this.stick.y + key("KeyS", "ArrowDown") - key("KeyW", "ArrowUp"),
    );
    const input = {
      moveX: move.x,
      moveY: move.y,
      dashPressed: this.dash,
      shockwavePressed: this.wave,
    };
    this.dash = false;
    this.wave = false;
    return input;
  }
  clear(): void {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
    this.dash = false;
    this.wave = false;
    this.joystickId = null;
    document
      .querySelector<HTMLElement>("#stick-knob")
      ?.style.removeProperty("transform");
  }
  destroy(): void {
    this.clear();
    this.disposers.forEach((fn) => fn());
  }
}
