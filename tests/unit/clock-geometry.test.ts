import { describe, it, expect } from "vitest";
import { FixedStepClock } from "../../src/core/clock/FixedStepClock";
import { direction, sweep, exitFraction } from "../../src/core/math/geometry";

describe("fixed clock and numerical geometry", () => {
  it.each([30, 60, 120])(
    "%iHz advances exactly 360 steps per six seconds",
    (hz) => {
      const clock = new FixedStepClock();
      let steps = 0;
      for (let i = 0; i < hz * 6; i++)
        clock.advanceElapsed(
          1000 / hz,
          () => {
            steps++;
            return true;
          },
          () => {
            throw Error("pause");
          },
        );
      expect(steps).toBe(360);
    },
  );
  it("drops hidden time and stops catchup when world changes state", () => {
    const c = new FixedStepClock();
    let steps = 0,
      paused = 0;
    c.advanceElapsed(
      20000,
      () => {
        steps++;
        return true;
      },
      () => paused++,
    );
    expect(steps).toBe(0);
    expect(paused).toBe(1);
    c.advanceElapsed(
      100,
      () => {
        steps++;
        return false;
      },
      () => {},
    );
    expect(steps).toBe(1);
    c.advanceElapsed(
      0,
      () => {
        steps++;
        return true;
      },
      () => {},
    );
    expect(steps).toBe(1);
  });
  it("normalizes diagonals, rejects NaN input", () => {
    expect(Math.hypot(...Object.values(direction(1, 1)))).toBeCloseTo(1);
    expect(direction(NaN, 1)).toEqual({ x: 0, y: 0 });
  });
  it("sweeps fast moving circles, tangent, overlap and stationary cases", () => {
    expect(
      sweep(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 70, y: 0 },
        { x: 50, y: 0 },
        12,
      ),
    ).toBeCloseTo(58 / 120);
    expect(
      sweep(
        { x: -10, y: 5 },
        { x: 10, y: 5 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        5,
      ),
    ).toBeCloseTo(0.5);
    expect(
      sweep({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 2),
    ).toBe(0);
    expect(
      sweep(
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        2,
      ),
    ).toBe(null);
    expect(
      exitFraction({ x: 1200, y: 360 }, { x: 1300, y: 360 }, 32, 1248, 32, 688),
    ).toBeCloseTo(0.48);
  });
});
