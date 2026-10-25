import type { Vec2 } from "../types";
export const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));
export function direction(x: number, y: number): Vec2 {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const d = Math.hypot(x, y);
  return d > 1 ? { x: x / d, y: y / d } : { x, y };
}
// Relative-motion swept circle. Returns earliest contact, including tangency.
export function sweep(
  a0: Vec2,
  a1: Vec2,
  b0: Vec2,
  b1: Vec2,
  r: number,
): number | null {
  const x = a0.x - b0.x,
    y = a0.y - b0.y,
    dx = a1.x - a0.x - (b1.x - b0.x),
    dy = a1.y - a0.y - (b1.y - b0.y);
  const c = x * x + y * y - r * r;
  if (c <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (aa < 1e-16) return null;
  const bb = 2 * (x * dx + y * dy),
    disc = bb * bb - 4 * aa * c;
  if (disc < 0) return null;
  const u = (-bb - Math.sqrt(disc)) / (2 * aa);
  return u >= 0 && u <= 1 ? u : null;
}
export function exitFraction(
  a: Vec2,
  b: Vec2,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): number {
  if (a.x < minX || a.x > maxX || a.y < minY || a.y > maxY) return 0;
  let u = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (b.x < minX) u = Math.min(u, (minX - a.x) / dx);
  if (b.x > maxX) u = Math.min(u, (maxX - a.x) / dx);
  if (b.y < minY) u = Math.min(u, (minY - a.y) / dy);
  if (b.y > maxY) u = Math.min(u, (maxY - a.y) / dy);
  return u;
}
export const lerpAngle = (a: number, b: number, t: number): number =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
