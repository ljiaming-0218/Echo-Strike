import type { EchoClip, Pose, RecordedAttack } from "../types";
export class EchoRecorder {
  poses: Pose[] = [];
  events: RecordedAttack[] = [];
  constructor(
    readonly startPose: Pose,
    readonly startCompletedTick: number,
  ) {}
  get canRecord(): boolean {
    return this.events.length < 256;
  }
  record(event: RecordedAttack): void {
    if (!this.canRecord) throw new Error("clip event capacity");
    this.events.push(event);
  }
  seal(clipId: number): EchoClip {
    if (this.poses.length !== 360)
      throw new Error("A clip must contain exactly 360 poses");
    const freeze = <T>(v: T): T => {
      if (v && typeof v === "object") {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
      }
      return v;
    };
    return freeze(
      structuredClone({
        schemaVersion: 1 as const,
        clipId,
        startCompletedTick: this.startCompletedTick,
        durationTicks: 360 as const,
        startPose: this.startPose,
        poses: this.poses,
        events: this.events,
      }),
    );
  }
}
