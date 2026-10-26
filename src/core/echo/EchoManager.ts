import { CONFIG as C } from "../config";
import type { Echo, EchoClip, RecordedAttack } from "../types";
export class EchoManager {
  readonly clips: EchoClip[] = [];
  echoes: Echo[] = [];
  add(clip: EchoClip): void {
    if (this.clips.length === C.maxEchoes) this.clips.shift();
    this.clips.push(clip);
  }
  reset(allocate: () => number): void {
    this.echoes = this.clips.map((clip) => ({
      id: allocate(),
      clip,
      hp: C.echoHP,
      pose: clip.startPose,
      previousPose: clip.startPose,
      eventCursor: 0,
      loopSerial: 0,
      lastLocalTick: -1,
    }));
  }
  // A past self loops its own actual recording, without retargeting or re-recording.
  step(tick: number, emit: (echo: Echo, event: RecordedAttack) => void): void {
    for (const e of this.echoes) {
      if (e.hp <= 0) continue;
      const local = tick % e.clip.durationTicks;
      if (local === 0) {
        if (tick > 0) e.loopSerial++;
        e.eventCursor = 0;
        e.pose = e.clip.startPose;
        e.previousPose = e.pose;
      } else e.previousPose = e.pose;
      e.pose = e.clip.poses[local] ?? e.clip.startPose;
      if (local === 0) e.previousPose = e.pose; // loop teleport never becomes a swept collision path
      e.lastLocalTick = local;
      while (e.eventCursor < e.clip.events.length) {
        const event = e.clip.events[e.eventCursor];
        if (!event || event.localTick > local) break;
        e.eventCursor++;
        if (event.localTick === local) emit(e, event);
      }
    }
  }
}
