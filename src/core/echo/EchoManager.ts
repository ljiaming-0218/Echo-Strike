import type { Echo, EchoClip } from "../types";
export class EchoManager {
  echoes: Echo[] = [];
  add(clip: EchoClip, id: number): void {
    if (this.echoes.length === 3) this.echoes.shift();
    this.echoes.push({
      id,
      clip,
      loopSerial: -1,
      eventCursor: 0,
      pose: clip.startPose,
      previousPose: clip.startPose,
    });
    for (const e of this.echoes) {
      e.loopSerial++;
      e.eventCursor = 0;
      e.pose = e.clip.startPose;
      e.previousPose = e.pose;
    }
  }
  sample(localTick: number): void {
    for (const e of this.echoes) {
      e.previousPose = e.pose;
      e.pose = e.clip.poses[localTick] ?? e.clip.startPose;
    }
  }
}
