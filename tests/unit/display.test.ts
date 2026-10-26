import { expect, it } from "vitest";
import { canvasPoint, screenVector } from "../../src/adapters/DisplayMode";
it("rotated embedded-browser pointer coordinates match the logical landscape world", () => {
  const r = { left: 0, top: 75, right: 390, width: 390, height: 693.333333 };
  const p = canvasPoint(r, 195, 75 + 693.333333 / 2, true);
  expect(p.x).toBeCloseTo(640, 6);
  expect(p.y).toBeCloseTo(360, 6);
  expect(canvasPoint(r, 390, 75, true)).toEqual({ x: 0, y: 0 });
  expect(screenVector(0, 30, true)).toEqual({ x: 30, y: -0 });
  expect(screenVector(30, 0, true)).toEqual({ x: 0, y: -30 });
});
it("ordinary landscape aim and vectors keep their established coordinates", () => {
  expect(
    canvasPoint(
      { left: 10, top: 20, right: 1290, width: 1280, height: 720 },
      650,
      380,
      false,
    ),
  ).toEqual({ x: 640, y: 360 });
  expect(screenVector(15, -20, false)).toEqual({ x: 15, y: -20 });
});
