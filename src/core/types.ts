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
  dashPressed: boolean;
  shockwavePressed: boolean;
}
export const idleInput = (): InputCommand => ({
  moveX: 0,
  moveY: 0,
  dashPressed: false,
  shockwavePressed: false,
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
      kind: "shockwave";
      seq: number;
      localTick: number;
      origin: Vec2;
      radius: number;
      damage: number;
    }>;
export interface EchoClip {
  readonly schemaVersion: 1;
  readonly clipId: number;
  readonly startCompletedTick: number;
  readonly durationTicks: 360;
  readonly startPose: Pose;
  readonly poses: readonly Pose[];
  readonly events: readonly RecordedAttack[];
}
export interface Echo {
  id: number;
  clip: EchoClip;
  loopSerial: number;
  eventCursor: number;
  pose: Pose;
  previousPose: Pose;
}
export type Source =
  | Readonly<{ kind: "player" | "enemy"; entityId: number }>
  | Readonly<{
      kind: "echo";
      entityId: number;
      clipId: number;
      loopSerial: number;
      eventSeq: number;
    }>;
export interface Enemy {
  id: number;
  kind: "chaser" | "charger" | "shooter";
  x: number;
  y: number;
  px: number;
  py: number;
  radius: number;
  hp: number;
  maxHp: number;
  activeAt: number;
  phase: "chase" | "windup" | "charge" | "recover";
  until: number;
  angle: number;
  nextAttack: number;
}
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
export type VisualEvent = {
  kind: "shot" | "wave" | "hurt" | "kill" | "cycle" | "dash";
  x: number;
  y: number;
  radius: number;
  echo: boolean;
};
export type State = "menu" | "running" | "upgrade" | "victory" | "defeat";
export type PauseReason = "manual" | "hidden" | "portrait" | "performance";
export type Upgrade = "damage" | "speed" | "wave";
