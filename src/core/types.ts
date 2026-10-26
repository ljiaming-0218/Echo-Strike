export interface Vec2 {
  readonly x: number;
  readonly y: number;
}
export interface Pose extends Vec2 {
  readonly aimRad: number;
  readonly dashing: boolean;
}
export interface InputCommand {
  moveX: number;
  moveY: number;
  aimRad: number;
  firing: boolean;
  dashPressed: boolean;
  pulsePressed: boolean;
}
export const idleInput = (): InputCommand => ({
  moveX: 0,
  moveY: 0,
  aimRad: -Math.PI / 2,
  firing: false,
  dashPressed: false,
  pulsePressed: false,
});
export interface ProjectileSnapshot {
  readonly damage: number;
  readonly speed: number;
  readonly radius: number;
  readonly ttlTicks: number;
}
export type RecordedAttack =
  | Readonly<{
      kind: "shot";
      seq: number;
      localTick: number;
      origin: Vec2;
      angleRad: number;
      projectile: Readonly<ProjectileSnapshot>;
    }>
  | Readonly<{
      kind: "pulse";
      seq: number;
      localTick: number;
      origin: Vec2;
      radius: number;
      damage: number;
    }>;
export interface EchoClip {
  readonly clipId: number;
  readonly round: number;
  readonly startPose: Pose;
  readonly durationTicks: number;
  readonly poses: readonly Pose[];
  readonly events: readonly RecordedAttack[];
}
export interface Echo {
  id: number;
  clip: EchoClip;
  hp: number;
  pose: Pose;
  previousPose: Pose;
  eventCursor: number;
  loopSerial: number;
  lastLocalTick: number;
}
export type Source =
  | Readonly<{ kind: "player"; entityId: number }>
  | Readonly<{
      kind: "echo";
      entityId: number;
      clipId: number;
      loopSerial: number;
      eventSeq: number;
    }>;
export interface Projectile {
  id: number;
  source: Source;
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
  damage: number;
  remainingTicks: number;
  createdAtTick: number;
  spent: boolean;
}
export interface Relay {
  id: number;
  x: number;
  y: number;
  hp: number;
  radius: number;
}
export type State = "menu" | "running" | "review" | "victory" | "defeat";
export type PauseReason = "manual" | "hidden" | "portrait" | "performance";
export type VisualEvent = {
  kind: "shot" | "wave" | "hurt" | "hit" | "kill" | "cycle" | "dash";
  x: number;
  y: number;
  radius: number;
  echo: boolean;
};
