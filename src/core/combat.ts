import type { Projectile, ProjectileSnapshot, Source, Vec2 } from "./types";
export function createProjectile(
  id: number,
  source: Source,
  origin: Vec2,
  angle: number,
  snapshot: ProjectileSnapshot,
  tick: number,
): Projectile {
  return {
    id,
    source,
    x: origin.x,
    y: origin.y,
    angle,
    speed: snapshot.speed,
    radius: snapshot.radius,
    damage:
      source.kind === "echo"
        ? Math.max(1, Math.round(snapshot.damage * 0.45))
        : snapshot.damage,
    remainingTicks: snapshot.ttlTicks,
    createdAtTick: tick,
    spent: false,
  };
}
export interface DamageCandidate {
  attackId: number;
  targetId: number;
  damage: number;
  source: Source;
}
