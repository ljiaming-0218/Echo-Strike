import { CONFIG as C } from "../config";
import type { EchoClip, Pose, RecordedAttack } from "../types";
export class EchoRecorder {
  readonly poses: Pose[] = [];
  readonly events: RecordedAttack[] = [];
  constructor(
    readonly startPose: Pose,
    readonly round: number,
  ) {}
  get canRecord(): boolean {
    return this.events.length < C.eventCap;
  }
  record(event: RecordedAttack): void {
    if (!this.canRecord) throw Error("History event limit");
    this.events.push(event);
  }
  seal(clipId: number): EchoClip {
    if (this.poses.length < 1 || this.poses.length > C.roundTicks)
      throw Error("Invalid history duration");
    const freeze = <T>(v: T): T => {
      if (v && typeof v === "object") {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
      }
      return v;
    };
    return freeze(
      structuredClone({
        clipId,
        round: this.round,
        startPose: this.startPose,
        durationTicks: this.poses.length,
        poses: this.poses,
        events: this.events,
      }),
    );
  }
}
