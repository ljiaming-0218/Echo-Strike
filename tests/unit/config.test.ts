import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/core/config";

describe("首版仿真配置合同", () => {
  it("6秒记录恰好360步，180秒结算对齐完整片段", () => {
    expect(CONFIG.tickRate).toBe(60);
    expect(CONFIG.clipTicks).toBe(6 * CONFIG.tickRate);
    expect(CONFIG.matchTicks).toBe(180 * CONFIG.tickRate);
    expect(CONFIG.matchTicks % CONFIG.clipTicks).toBe(0);
    expect(
      [60, 120].every(
        (seconds) => (seconds * CONFIG.tickRate) % CONFIG.clipTicks === 0,
      ),
    ).toBe(true);
  });

  it("历史窗口有界，场地足以容纳玩家和震荡波", () => {
    expect(CONFIG.maxEchoes).toBe(3);
    expect((CONFIG.maxEchoes + 1) * CONFIG.clipTicks).toBe(1440);
    expect(CONFIG.width / CONFIG.height).toBeCloseTo(16 / 9);
    expect(CONFIG.height - CONFIG.arenaInset * 2).toBeGreaterThan(2 * 110);
    expect(Object.isFrozen(CONFIG)).toBe(true);
  });
});
