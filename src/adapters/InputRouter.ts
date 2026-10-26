import { canvasPoint, screenVector } from "./DisplayMode";
import { direction } from "../core/math/geometry";
import type { InputCommand, Vec2 } from "../core/types";
export class InputRouter {
  private keys = new Set<string>();
  private move = { x: 0, y: 0 };
  private aim = -Math.PI / 2;
  private pointer: Vec2 | null = null;
  private usingTouch = false;
  private firing = false;
  private touchFiring = false;
  private dash = false;
  private pulse = false;
  private disposers: (() => void)[] = [];
  constructor(
    private readonly canAct: () => boolean,
    private readonly player: () => Vec2,
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
        if (e.code === "KeyQ") this.pulse = true;
      }
    });
    this.listen(window, "keyup", (raw: Event) =>
      this.keys.delete((raw as KeyboardEvent).code),
    );
    this.listen(window, "pointermove", (raw: Event) => {
      const e = raw as PointerEvent;
      if (e.pointerType === "touch") return;
      this.mouseAim(e);
    });
    this.listen(window, "pointerdown", (raw: Event) => {
      const e = raw as PointerEvent;
      if (
        e.pointerType === "touch" ||
        e.button !== 0 ||
        !(e.target instanceof HTMLCanvasElement) ||
        !this.canAct()
      )
        return;
      this.mouseAim(e);
      this.firing = true;
    });
    for (const type of ["pointerup", "pointercancel"])
      this.listen(window, type, (e: Event) => {
        if ((e as PointerEvent).pointerType !== "touch") this.firing = false;
      });
  }
  private mouseAim(e: PointerEvent): void {
    const rect = document.querySelector("canvas")?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    this.pointer = canvasPoint(
      rect,
      e.clientX,
      e.clientY,
      document.querySelector<HTMLElement>("#viewport")?.dataset.rotated ===
        "true",
    );
    this.usingTouch = false;
  }
  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.disposers.push(() => target.removeEventListener(type, fn));
  }
  bindTouch(
    move: HTMLElement,
    aim: HTMLElement,
    dash: HTMLElement,
    pulse: HTMLElement,
  ): void {
    for (const [element, kind] of [
      [move, "move"],
      [aim, "aim"],
    ] as const) {
      let pointer: number | null = null;
      const knob = element.querySelector<HTMLElement>(".stick-knob")!;
      const update = (e: PointerEvent) => {
        const r = element.getBoundingClientRect(),
          local = screenVector(
            e.clientX - r.left - r.width / 2,
            e.clientY - r.top - r.height / 2,
            document.querySelector<HTMLElement>("#viewport")?.dataset
              .rotated === "true",
          ),
          v = direction(
            local.x / (r.width * 0.35),
            local.y / (r.height * 0.35),
          ),
          active = Math.hypot(v.x, v.y) > 0.15;
        knob.style.transform = `translate(${v.x * 22}px,${v.y * 22}px)`;
        if (kind === "move") this.move = active ? v : { x: 0, y: 0 };
        else {
          this.touchFiring = active;
          this.usingTouch = true;
          if (active) this.aim = Math.atan2(v.y, v.x);
        }
      };
      this.listen(element, "pointerdown", (raw: Event) => {
        const e = raw as PointerEvent;
        if (!this.canAct() || pointer !== null) return;
        e.preventDefault();
        pointer = e.pointerId;
        element.setPointerCapture(pointer);
        update(e);
      });
      this.listen(element, "pointermove", (raw: Event) => {
        const e = raw as PointerEvent;
        if (e.pointerId === pointer) update(e);
      });
      const clear = () => {
        pointer = null;
        knob.style.transform = "";
        if (kind === "move") this.move = { x: 0, y: 0 };
        else this.touchFiring = false;
      };
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        this.listen(element, type, (e: Event) => {
          if ((e as PointerEvent).pointerId === pointer) clear();
        });
      this.disposers.push(clear);
      this.clears.push(clear);
    }
    for (const [element, kind] of [
      [dash, "dash"],
      [pulse, "pulse"],
    ] as const) {
      const trigger = () => {
        if (!this.canAct()) return;
        if (kind === "dash") this.dash = true;
        else this.pulse = true;
      };
      this.listen(element, "pointerdown", (e: Event) => {
        e.preventDefault();
        trigger();
      });
      this.listen(element, "click", (e: Event) => {
        if ((e as MouseEvent).detail === 0) trigger();
      });
    }
  }
  private clears: (() => void)[] = [];
  sample(): InputCommand {
    if (this.pointer && !this.usingTouch) {
      const p = this.player();
      this.aim = Math.atan2(this.pointer.y - p.y, this.pointer.x - p.x);
    }
    const key = (a: string, b: string) =>
      Number(this.keys.has(a) || this.keys.has(b));
    const m = direction(
      this.move.x + key("KeyD", "ArrowRight") - key("KeyA", "ArrowLeft"),
      this.move.y + key("KeyS", "ArrowDown") - key("KeyW", "ArrowUp"),
    );
    const input = {
      moveX: m.x,
      moveY: m.y,
      aimRad: this.aim,
      firing: this.firing || this.touchFiring || this.keys.has("KeyJ"),
      dashPressed: this.dash,
      pulsePressed: this.pulse,
    };
    this.dash = false;
    this.pulse = false;
    return input;
  }
  clear(): void {
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.firing = false;
    this.touchFiring = false;
    this.dash = false;
    this.pulse = false;
    this.clears.forEach((fn) => fn());
  }
  destroy(): void {
    this.clear();
    this.disposers.forEach((fn) => fn());
  }
}
