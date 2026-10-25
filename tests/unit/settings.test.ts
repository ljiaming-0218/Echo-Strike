import { afterEach, expect, it, vi } from "vitest";
import { loadSettings, saveSettings } from "../../src/ui/settings";
afterEach(() => vi.unstubAllGlobals());
it("storage failures fall back without blocking the game", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  });
  expect(loadSettings()).toEqual({ volume: 0.3, reduced: false, best: 0 });
  expect(() =>
    saveSettings({ volume: 0, reduced: true, best: 100 }),
  ).not.toThrow();
});
it("corrupt or malicious local settings cannot inject game state", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => '{"volume":20,"reduced":true,"best":-20}',
  });
  expect(loadSettings()).toEqual({ volume: 1, reduced: true, best: 0 });
  vi.stubGlobal("localStorage", { getItem: () => "{broken" });
  expect(loadSettings().volume).toBe(0.3);
});
