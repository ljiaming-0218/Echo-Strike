import { test, expect } from "@playwright/test";
interface Snapshot {
  tick: number;
  roundTick: number;
  round: number;
  state: string;
  status: string;
  hp: number;
  player: { x: number; y: number };
  relays: { x: number; y: number; hp: number }[];
  echoes: { round: number; hp: number }[];
  projectiles: number;
  shots: number;
  events: number;
}
interface Harness {
  snapshot(): Snapshot;
  advance(n: number): void;
  prepareExit(): void;
  defeat(): void;
}
declare global {
  interface Window {
    __CHRONO_TEST__: Harness;
  }
}
const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__CHRONO_TEST__.snapshot());
async function load(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CHRONO_TEST__);
  await expect(
    page.getByRole("button", { name: "进入时间循环" }),
  ).toBeVisible();
}
async function start(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "进入时间循环" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
}
test("manual aim and real shots destroy a relay; movement, skills and pause respond", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await start(page);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).shots).toBe(0);
  const r = (await snapshot(page)).relays[2]!,
    box = await page.locator("canvas").boundingBox();
  await page.mouse.move(
    box!.x + (r.x / 1280) * box!.width,
    box!.y + (r.y / 720) * box!.height,
  );
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).relays[2]!.hp).toBe(0);
  await page.mouse.up();
  const before = await snapshot(page);
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(before.player.x + 20);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("Space");
  await expect(page.locator("#dash-cd")).toContainText("秒");
  const dashTick = (await snapshot(page)).tick;
  await expect
    .poll(async () => (await snapshot(page)).tick)
    .toBeGreaterThan(dashTick + 9);
  await page.keyboard.press("KeyQ");
  await expect(page.locator("#pulse-cd")).toHaveText("本轮已使用");
  await page.getByRole("button", { name: "暂停游戏" }).click();
  const tick = (await snapshot(page)).tick;
  await page.waitForTimeout(250);
  expect((await snapshot(page)).tick).toBe(tick);
  await page.getByRole("button", { name: "继续追猎" }).click();
  await expect
    .poll(async () => (await snapshot(page)).tick)
    .toBeGreaterThan(tick);
  expect(errors).toEqual([]);
});
test("extraction, recorded route review, hostile self, six rounds, defeat and twenty resets", async ({
  page,
}) => {
  await load(page);
  await start(page);
  const cdp = await page.context().newCDPSession(page);
  const listeners = async () =>
    (
      await cdp.send("Runtime.evaluate", {
        expression:
          "JSON.stringify([window,document].map(t=>Object.fromEntries(Object.entries(getEventListeners(t)).map(([k,v])=>[k,v.length]))))",
        includeCommandLineAPI: true,
        returnByValue: true,
      })
    ).result.value;
  const before = await listeners();
  for (let round = 1; round <= 6; round++) {
    if (round === 1) {
      await page.keyboard.press("KeyQ");
      await expect(page.locator("#pulse-cd")).toHaveText("本轮已使用");
    }
    await page.evaluate(() => {
      window.__CHRONO_TEST__.prepareExit();
      window.__CHRONO_TEST__.advance(24);
    });
    if (round < 6) {
      await expect(
        page.getByRole("heading", { name: /刚才的你/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: "刚刚记录的行动轨迹" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: `进入第 ${round + 1} 轮` })
        .click();
      expect((await snapshot(page)).echoes.length).toBe(Math.min(round, 3));
    } else
      await expect(
        page.getByRole("heading", { name: "你已超越，过去的自己。" }),
      ).toBeVisible();
  }
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: "重写这条时间线" }).click();
    expect((await snapshot(page)).round).toBe(1);
    expect((await snapshot(page)).hp).toBe(100);
    await page.evaluate(() => window.__CHRONO_TEST__.defeat());
    await expect(
      page.getByRole("heading", { name: "过去的你，赢了这一次。" }),
    ).toBeVisible();
    expect(await page.locator("canvas").count()).toBe(1);
    expect(await page.locator("#interface").count()).toBe(1);
  }
  expect(await listeners()).toBe(before);
});
test("settings survive reload and denied storage does not block play", async ({
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
      throw Error("denied");
    };
    Storage.prototype.setItem = () => {
      throw Error("denied");
    };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__CHRONO_TEST__);
  await start(page);
  expect((await snapshot(page)).state).toBe("running");
});
test("two real touch pointers move and manually fire; orientation requires explicit resume", async ({
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
  const cdp = await context.newCDPSession(page),
    move = await page.locator("#move-stick").boundingBox(),
    aim = await page.locator("#aim-stick").boundingBox();
  const before = await snapshot(page),
    points = [
      { id: 11, x: move!.x + move!.width * 0.8, y: move!.y + move!.height / 2 },
      { id: 12, x: aim!.x + aim!.width / 2, y: aim!.y + aim!.height * 0.2 },
    ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(before.player.x + 10);
  await expect
    .poll(async () => (await snapshot(page)).shots)
    .toBeGreaterThan(0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "请横屏后继续" }),
  ).toBeVisible();
  const tick = (await snapshot(page)).tick;
  await page.waitForTimeout(180);
  expect((await snapshot(page)).tick).toBe(tick);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "继续追猎" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  for (const id of ["#dash", "#pulse", "#pause"]) {
    const rect = await page.locator(id).boundingBox();
    expect(rect!.height).toBeGreaterThanOrEqual(48);
    expect(rect!.width).toBeGreaterThanOrEqual(48);
  }
  await context.close();
});

test("actual mouse and keyboard play extracts from first round without a goal fixture", async ({
  page,
}) => {
  await load(page);
  await start(page);
  const box = (await page.locator("canvas").boundingBox())!;
  for (const index of [2, 0, 1]) {
    if (index === 1) {
      await page.keyboard.down("KeyD");
      await expect
        .poll(async () => (await snapshot(page)).player.x)
        .toBeGreaterThanOrEqual(900);
      await page.keyboard.up("KeyD");
    }
    const relay = (await snapshot(page)).relays[index]!;
    await page.mouse.move(
      box.x + (relay.x / 1280) * box.width,
      box.y + (relay.y / 720) * box.height,
    );
    await page.mouse.down();
    await expect
      .poll(async () => (await snapshot(page)).relays[index]!.hp)
      .toBe(0);
    await page.mouse.up();
  }
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => window.__CHRONO_TEST__.snapshot().player.y <= 160,
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.down("KeyA");
  await page.waitForFunction(
    () => window.__CHRONO_TEST__.snapshot().player.x <= 650,
  );
  await page.keyboard.up("KeyA");
  await expect(page.getByRole("button", { name: "进入第 2 轮" })).toBeVisible();
  expect((await snapshot(page)).state).toBe("review");
});

test("WeChat-style rejected display APIs fall back to playable rotated landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: () =>
        Promise.reject(new Error("Fullscreen disabled in embedded browser")),
    });
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: () =>
        Promise.reject(new Error("Orientation disabled in embedded browser")),
    });
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__CHRONO_TEST__);
  await expect(
    page.getByRole("heading", { name: "请横屏后继续" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "尝试全屏横屏" }).click();
  await expect(page.locator("#viewport")).toHaveAttribute(
    "data-rotated",
    "true",
  );
  await expect(page.locator("#overlay")).toBeHidden();
  const canvas = await page.locator("canvas").boundingBox();
  expect(canvas!.width).toBeLessThanOrEqual(391);
  expect(canvas!.height).toBeLessThanOrEqual(845);
  expect((await snapshot(page)).state).toBe("running");
  const cdp = await context.newCDPSession(page),
    move = await page.locator("#move-stick").boundingBox(),
    aim = await page.locator("#aim-stick").boundingBox(),
    before = await snapshot(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 31, x: move!.x + move!.width / 2, y: move!.y + move!.height * 0.8 },
      { id: 32, x: aim!.x + aim!.width * 0.8, y: aim!.y + aim!.height / 2 },
    ],
  });
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(before.player.x + 10);
  await expect
    .poll(async () => (await snapshot(page)).shots)
    .toBeGreaterThan(0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.getByRole("button", { name: "恢复自动布局" }).click();
  await expect(
    page.getByRole("heading", { name: "请横屏后继续" }),
  ).toBeVisible();
  const tick = (await snapshot(page)).tick;
  await page.waitForTimeout(100);
  expect((await snapshot(page)).tick).toBe(tick);
  await page.getByRole("button", { name: "横向适配并继续" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test("portrait users can start without fullscreen capability or browser auto-rotation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "横向适配并开始" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#viewport")).toHaveAttribute(
    "data-rotated",
    "true",
  );
  expect((await snapshot(page)).state).toBe("running");
  await context.close();
});

test("the fullscreen control requests orientation from a user click and handles the remaining portrait viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    const calls: string[] = [];
    Object.assign(window, { displayCalls: calls });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: function () {
        calls.push("fullscreen:" + navigator.userActivation.isActive);
        return Promise.resolve();
      },
    });
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: (value: string) => {
        calls.push("lock:" + value);
        return Promise.resolve();
      },
    });
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "尝试全屏横屏" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  expect(
    await page.evaluate(() => Reflect.get(window, "displayCalls")),
  ).toEqual(["fullscreen:true", "lock:landscape"]);
  await expect(page.locator("#viewport")).toHaveAttribute(
    "data-compact",
    "true",
  );
  await context.close();
});

test("adapting during a between-round review does not leave a hidden pause in the next round", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    }),
    page = await context.newPage();
  await load(page);
  await start(page);
  await page.evaluate(() => {
    window.__CHRONO_TEST__.prepareExit();
    window.__CHRONO_TEST__.advance(24);
  });
  await expect(page.getByRole("button", { name: "进入第 2 轮" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "横向适配并继续" }).click();
  await page.getByRole("button", { name: "进入第 2 轮" }).click();
  await expect(page.locator("#overlay")).toBeHidden();
  expect((await snapshot(page)).status).toBe("running");
  await context.close();
});

test("rotated landscape respects the visible viewport when embedded browser toolbars change height", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      get: () => Reflect.get(window, "visibleHeight") ?? 740,
    });
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "横向适配并开始" }).click();
  let box = (await page.locator("#viewport").boundingBox())!;
  expect(box.height).toBeCloseTo(740);
  expect(box.width).toBeCloseTo(390);
  await page.evaluate(() => {
    Object.assign(window, { visibleHeight: 700 });
    window.visualViewport?.dispatchEvent(new Event("resize"));
  });
  box = (await page.locator("#viewport").boundingBox())!;
  expect(box.height).toBeCloseTo(700);
  expect(box.y).toBeCloseTo(0);
  await context.close();
});
