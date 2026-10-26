import { expect, it } from "vitest";
import { CONFIG as C, COVER } from "../../src/core/config";
it("short tactical rounds have finite history, event and projectile budgets", () => {
  expect(C.tickRate).toBe(60);
  expect(C.roundTicks / C.tickRate).toBe(12);
  expect(C.totalRounds).toBe(6);
  expect(C.maxEchoes).toBe(3);
  expect((C.maxEchoes + 1) * C.roundTicks).toBe(2880);
  expect(C.eventCap).toBeGreaterThan(C.roundTicks / C.shotInterval + 1);
  expect(C.minRoundTicks + C.exitHoldTicks).toBeLessThan(C.roundTicks);
});
it("arena and cover leave a continuous central extraction corridor", () => {
  expect(C.width / C.height).toBeCloseTo(16 / 9);
  expect(
    COVER.every(
      (r) => r.x + r.width < 640 - C.playerRadius || r.x > 640 + C.playerRadius,
    ),
  ).toBe(true);
});
