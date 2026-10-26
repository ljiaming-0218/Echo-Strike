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
    damage: snapshot.damage,
    remainingTicks: snapshot.ttlTicks,
    createdAtTick: tick,
    spent: false,
  };
}
