import { test, expect } from "@playwright/test";
interface Snapshot {
  tick: number;
  state: string;
  status: string;
  hp: number;
  player: { x: number; y: number };
  echoes: number[];
  enemies: number;
  bullets: number;
  stats: { kills: number };
  events: number;
}
interface Harness {
  snapshot(): Snapshot;
  advance(n: number): void;
  survive(): void;
  defeat(): void;
}
declare global {
  interface Window {
    __ECHO_TEST__: Harness;
  }
}
const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__ECHO_TEST__.snapshot());
async function load(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__ECHO_TEST__);
  await expect(page.getByRole("button", { name: "开始行动" })).toBeVisible();
}
async function start(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "开始行动" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
}

test("keyboard movement, skills, six-second echoes, pause and explicit resume", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await start(page);
  const before = await snapshot(page);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyD");
  expect((await snapshot(page)).player.x).toBeGreaterThan(before.player.x + 15);
  await page.keyboard.press("Space");
  await expect(page.locator("#dash-cd")).toContainText("秒");
  const dashTick = (await snapshot(page)).tick;
  await expect
    .poll(async () => (await snapshot(page)).tick)
    .toBeGreaterThan(dashTick + 9);
  await page.keyboard.press("KeyQ");
  await expect(page.locator("#wave-cd")).toContainText("秒");
  await page.evaluate(() => {
    window.__ECHO_TEST__.survive();
    window.__ECHO_TEST__.advance(360);
  });
  expect((await snapshot(page)).echoes.length).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "暂停游戏" }).click();
  const tick = (await snapshot(page)).tick;
  await page.waitForTimeout(300);
  expect((await snapshot(page)).tick).toBe(tick);
  await page.getByRole("button", { name: "继续行动" }).click();
  await expect
    .poll(async () => (await snapshot(page)).tick)
    .toBeGreaterThan(tick);
  expect(errors).toEqual([]);
});

test("both upgrades, victory, restart and defeat are real world states", async ({
  page,
}) => {
  const session = await page.context().newCDPSession(page);
  const listenerCounts = async () =>
    (
      await session.send("Runtime.evaluate", {
        expression:
          "JSON.stringify([window,document].map(t=>Object.fromEntries(Object.entries(getEventListeners(t)).map(([k,v])=>[k,v.length]))))",
        includeCommandLineAPI: true,
        returnByValue: true,
      })
    ).result.value;
  await load(page);
  const listenersBefore = await listenerCounts();
  await start(page);
  await page.evaluate(() => {
    const h = window.__ECHO_TEST__;
    h.survive();
    h.advance(3600 - h.snapshot().tick);
  });
  await expect(page.getByRole("button", { name: /火力强化/ })).toBeVisible();
  await page.getByRole("button", { name: /火力强化/ }).click();
  await page.evaluate(() => {
    const h = window.__ECHO_TEST__;
    h.advance(7200 - h.snapshot().tick);
  });
  await expect(page.getByRole("button", { name: /轻量驱动/ })).toBeVisible();
  await page.getByRole("button", { name: /轻量驱动/ }).click();
  await page.evaluate(() => {
    const h = window.__ECHO_TEST__;
    h.advance(10800 - h.snapshot().tick);
  });
  await expect(
    page.getByRole("heading", { name: "你与回响，一起留下。" }),
  ).toBeVisible();
  expect((await snapshot(page)).tick).toBe(10800);
  await page.getByRole("button", { name: "再来一局" }).click();
  expect((await snapshot(page)).tick).toBeLessThan(60);
  expect((await snapshot(page)).hp).toBe(100);
  await page.evaluate(() => window.__ECHO_TEST__.defeat());
  await expect(
    page.getByRole("heading", { name: "下一次，改写过去。" }),
  ).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "再来一局" }).click();
    expect((await snapshot(page)).tick).toBeLessThan(90);
    expect(await page.locator("canvas").count()).toBe(1);
    expect(await page.locator("#interface").count()).toBe(1);
    await page.evaluate(() => window.__ECHO_TEST__.defeat());
  }
  expect(await listenerCounts()).toBe(listenersBefore);
});

test("settings survive reload and storage failure does not prevent startup", async ({
  page,
}) => {
  await load(page);
  await page.getByLabel("减少特效").check();
  await page.getByLabel("音量").fill("0");
  await page.reload();
  await expect(page.getByLabel("减少特效")).toBeChecked();
  await expect(page.getByLabel("音量")).toHaveValue("0");
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("storage denied");
    };
    Storage.prototype.setItem = () => {
      throw Error("storage denied");
    };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__ECHO_TEST__);
  await start(page);
  expect((await snapshot(page)).state).toBe("running");
});

test("touch orientation, independent joystick/skill pointers and cancellation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await load(page);
  await start(page);
  const stick = page.locator("#joystick"),
    dash = page.locator("#dash");
  const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  // CDP dispatch creates real browser pointers and pointer capture; not a physical phone.
  const cdp = await context.newCDPSession(page),
    point = {
      x: box!.x + box!.width * 0.8,
      y: box!.y + box!.height / 2,
      id: 11,
    };
  const before = await snapshot(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  const skill = await dash.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      point,
      {
        x: skill!.x + skill!.width / 2,
        y: skill!.y + skill!.height / 2,
        id: 12,
      },
    ],
  });
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(before.player.x + 10);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "请横屏后继续" }),
  ).toBeVisible();
  const tick = (await snapshot(page)).tick;
  await page.waitForTimeout(200);
  expect((await snapshot(page)).tick).toBe(tick);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "继续行动" })).toBeVisible();
  expect((await snapshot(page)).tick).toBe(tick);
  await page.getByRole("button", { name: "继续行动" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  for (const id of ["#dash", "#wave", "#pause"]) {
    const r = await page.locator(id).boundingBox();
    expect(r!.height).toBeGreaterThanOrEqual(48);
    expect(r!.width).toBeGreaterThanOrEqual(48);
  }
  await context.close();
});
