import { expect, it } from "vitest";
import { World } from "../../src/core/World";
import { COVER } from "../../src/core/config";
import { segmentRect } from "../../src/core/math/geometry";
import type { Vec2 } from "../../src/core/types";
// An external, deterministic player controller. It uses ordinary inputs and
// visible poses; it never changes health, goals, clocks, bullets or history.
function walk(start: Vec2, goal: Vec2): Vec2 {
  const points = [
      start,
      goal,
      ...COVER.flatMap((r) => [
        { x: r.x - 24, y: r.y - 24 },
        { x: r.x + r.width + 24, y: r.y - 24 },
        { x: r.x - 24, y: r.y + r.height + 24 },
        { x: r.x + r.width + 24, y: r.y + r.height + 24 },
      ]),
    ],
    cost = points.map(() => Infinity),
    parent = points.map(() => -1),
    open = new Set(points.map((_, i) => i));
  cost[0] = 0;
  while (open.size) {
    const i = [...open].sort((a, b) => cost[a]! - cost[b]!)[0]!;
    open.delete(i);
    if (i === 1) break;
    for (const j of open) {
      const a = points[i]!,
        b = points[j]!;
      if (COVER.some((r) => segmentRect(a, b, r, 18) !== null)) continue;
      const next = cost[i]! + Math.hypot(a.x - b.x, a.y - b.y);
      if (next < cost[j]!) {
        cost[j] = next;
        parent[j] = i;
      }
    }
  }
  let i = 1;
  while (parent[i] !== 0 && parent[i] !== -1) i = parent[i]!;
  const p = parent[i] === -1 ? goal : points[i]!;
  return { x: p.x - start.x, y: p.y - start.y };
}
it("a real six-round campaign is winnable using only movement, manual aim and firing", () => {
  const w = new World();
  w.start();
  let commands = 0;
  while (w.state !== "victory" && w.state !== "defeat" && commands < 4320) {
    if (w.state === "review") {
      w.nextRound();
      continue;
    }
    const p = w.player,
      targets = [
        ...w.aliveEchoes.map((e) => ({
          x: e.pose.x,
          y: e.pose.y,
          vx: (e.pose.x - e.previousPose.x) * 60,
          vy: (e.pose.y - e.previousPose.y) * 60,
        })),
        ...w.relays
          .filter((r) => r.hp > 0)
          .map((r) => ({ x: r.x, y: r.y, vx: 0, vy: 0 })),
      ].sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      );
    const target = targets.find(
      (t) => !COVER.some((r) => segmentRect(p, t, r, 5) !== null),
    );
    let movement = { x: 0, y: 0 },
      aim = p.aimRad;
    if (target) {
      const d = Math.hypot(target.x - p.x, target.y - p.y) / 900;
      aim = Math.atan2(
        target.y + target.vy * d - p.y,
        target.x + target.vx * d - p.x,
      );
    } else movement = walk(p, targets[0] ?? w.exit);
    const d = Math.hypot(movement.x, movement.y);
    w.step({
      moveX: d > 4 ? movement.x / d : 0,
      moveY: d > 4 ? movement.y / d : 0,
      aimRad: aim,
      firing: !!target,
      dashPressed: false,
      pulsePressed: w.aliveEchoes.some(
        (e) => Math.hypot(e.pose.x - p.x, e.pose.y - p.y) < 150,
      ),
    });
    commands++;
  }
  expect(
    w.state,
    JSON.stringify({
      round: w.round,
      tick: w.roundTick,
      hp: w.player.hp,
      failure: w.failure,
      echoes: w.echoes.map((e) => e.hp),
      relays: w.relays.map((r) => r.hp),
    }),
  ).toBe("victory");
  expect(w.stats.echoKills).toBe(12);
  expect(w.stats.relays).toBe(18);
  expect(w.stats.rejected).toBe(0);
});
