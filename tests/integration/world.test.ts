import { describe, it, expect } from "vitest";
import { World } from "../../src/core/World";
import { idleInput } from "../../src/core/types";
import { createProjectile } from "../../src/core/combat";
import { EchoRecorder } from "../../src/core/echo/EchoRecorder";
import { FixedStepClock } from "../../src/core/clock/FixedStepClock";
import type { InputCommand, RecordedAttack } from "../../src/core/types";
const world = () => {
  const w = new World({ spawn: false, autoShoot: false });
  w.start();
  return w;
};
function steps(w: World, n: number, input: InputCommand = idleInput()) {
  for (let i = 0; i < n; i++) w.step(input);
}
function clip(events: RecordedAttack[]) {
  const r = new EchoRecorder({ x: 300, y: 300, aimRad: 0, dashing: false }, 0);
  r.poses = Array.from({ length: 360 }, () => ({
    x: 300,
    y: 300,
    aimRad: 0,
    dashing: false,
  }));
  r.events = events;
  return r.seal(99);
}
const shot = (tick: number, seq: number): RecordedAttack => ({
  kind: "shot",
  localTick: tick,
  seq,
  origin: { x: 300, y: 300 },
  angleRad: 0,
  projectile: { damage: 10, speed: 760, radius: 4, ttlTicks: 60 },
});

describe("echo lifecycle, combat and world contracts", () => {
  it("T01 seals 359/360 and atomically retains only C1 C2 C3 at 1440", () => {
    const w = world();
    steps(w, 359);
    expect(w.echoes).toHaveLength(0);
    steps(w, 1);
    expect(w.echoes.map((e) => e.clip.clipId)).toEqual([0]);
    steps(w, 360);
    expect(w.echoes.map((e) => e.clip.clipId)).toEqual([0, 1]);
    steps(w, 360);
    expect(w.echoes.map((e) => e.clip.clipId)).toEqual([0, 1, 2]);
    steps(w, 360);
    expect(w.echoes.map((e) => e.clip.clipId)).toEqual([1, 2, 3]);
    expect(
      w.echoes.every((e) => e.eventCursor === 0 && e.pose === e.clip.startPose),
    ).toBe(true);
  });
  it("T02/T03 events 0,1,358,359 replay once each per loop with unique attack IDs", () => {
    const w = world();
    w.echoManager.add(
      clip([shot(0, 0), shot(1, 1), shot(358, 2), shot(359, 3)]),
      100,
    );
    const ids = new Set<number>();
    for (let i = 0; i < 1080; i++) {
      w.step(idleInput());
      for (const b of w.projectiles)
        if (b.source.kind === "echo") ids.add(b.id);
    }
    expect(w.stats.echoShots).toBe(12);
    expect(ids.size).toBe(12);
  });
  it("T04 echo shots cannot enter the player recorder", () => {
    const w = world();
    w.echoManager.add(clip([shot(0, 0)]), 100);
    steps(w, 360);
    expect(w.echoes.at(-1)?.clip.events).toHaveLength(0);
    expect(w.stats.echoShots).toBe(1);
  });
  it("T05/T22 pause reasons and upgrade cannot resume through hidden or portrait", () => {
    const w = world();
    w.pause("hidden");
    w.pause("portrait");
    steps(w, 60);
    expect(w.completedTicks).toBe(0);
    w.clearReason("hidden");
    w.resume();
    expect(w.running).toBe(false);
    w.clearReason("portrait");
    expect(w.running).toBe(false);
    w.resume();
    expect(w.running).toBe(true);
    w.state = "upgrade";
    w.pause("hidden");
    w.upgrade("damage");
    expect(w.running).toBe(false);
  });
  it("T06 30/60/120Hz movement and recordings agree", () => {
    const results = [30, 60, 120].map((hz) => {
      const w = world(),
        c = new FixedStepClock();
      w.player.x = 300;
      w.player.y = 300;
      for (let f = 0; f < hz * 6; f++)
        c.advanceElapsed(
          1000 / hz,
          () => {
            const i = Math.floor(w.completedTicks / 90);
            w.step({
              moveX: i === 0 ? 1 : i === 2 ? -1 : 0,
              moveY: i === 1 ? 1 : i === 3 ? -1 : 0,
              dashPressed: false,
              shockwavePressed: false,
            });
            return w.running;
          },
          () => {},
        );
      return w.echoes[0]?.clip;
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0]?.poses.at(-1)?.x).toBeCloseTo(300, 6);
    expect(results[0]?.poses.at(-1)?.y).toBeCloseTo(300, 6);
  });
  it("T07 old direction fires at current target without retargeting", () => {
    const w = world();
    w.echoManager.add(clip([shot(0, 0)]), 100);
    const target = w.spawnEnemy("chaser", 420, 300, 0);
    w.spawnEnemy("chaser", 300, 500, 0);
    steps(w, 14);
    expect(target.hp).toBe(25);
    expect(w.stats.echoDamage).toBe(5);
  });
  it("T08 snapshot deep freeze and exactly one rounding of echo damage", () => {
    const w = world(),
      history = clip([shot(0, 0)]),
      before = JSON.stringify(history);
    w.echoManager.add(history, 100);
    w.state = "upgrade";
    w.upgrade("damage");
    w.step(idleInput());
    expect(w.player.damage).toBe(13);
    expect(w.projectiles[0]?.damage).toBe(5);
    expect(JSON.stringify(history)).toBe(before);
    expect(Object.isFrozen(history.events[0])).toBe(true);
    expect(() => {
      (history.poses[0] as { x: number }).x = 20;
    }).toThrow();
  });
  it("T10 nonpiercing bullets consume on earliest enemy, deaths and overkill count once", () => {
    const w = world();
    const a = w.spawnEnemy("chaser", 400, 300, 0),
      b = w.spawnEnemy("chaser", 450, 300, 0);
    a.hp = 3;
    for (let i = 0; i < 2; i++)
      w.projectiles.push(
        createProjectile(
          100 + i,
          { kind: "player", entityId: 1 },
          { x: 300, y: 300 },
          0,
          { damage: 10, speed: 12000, radius: 4, ttlTicks: 60 },
          -1,
        ),
      );
    w.step(idleInput());
    expect(w.stats.kills).toBe(1);
    expect(w.stats.playerDamage).toBe(3);
    expect(b.hp).toBe(30);
    expect(w.projectiles).toHaveLength(0);
  });
  it("T11 wave applies once to each enemy, visual events are not damage", () => {
    const w = world();
    w.spawnEnemy("chaser", 650, 350, 0);
    w.spawnEnemy("chaser", 670, 350, 0);
    w.step({ ...idleInput(), shockwavePressed: true });
    expect(w.stats.playerDamage).toBe(36);
    steps(w, 10);
    expect(w.stats.playerDamage).toBe(36);
  });
  it("T12 deleting an echo never removes its in-flight projectiles", () => {
    const w = world();
    w.echoManager.add(clip([shot(359, 0)]), 100);
    steps(w, 360);
    const b = w.projectiles.find((p) => p.source.kind === "echo");
    expect(b).toBeDefined();
    for (let i = 0; i < 3; i++)
      w.echoManager.add({ ...clip([]), clipId: 200 + i }, 200 + i);
    expect(w.echoes.find((e) => e.id === 100)).toBeUndefined();
    const e = w.spawnEnemy("chaser", 420, 300, 0);
    steps(w, 10);
    expect(e.hp).toBe(25);
  });
  it("T13 cooldown persists across tick359 and new clip", () => {
    const w = world();
    steps(w, 359);
    w.step({ ...idleInput(), shockwavePressed: true });
    expect(w.player.nextWave).toBe(659);
    w.step({ ...idleInput(), shockwavePressed: true });
    expect(w.recorder.events).toHaveLength(0);
  });
  it("T14 dash wins simultaneous input and blocks shooting for exactly nine steps", () => {
    const w = new World({ spawn: false });
    w.start();
    w.spawnEnemy("chaser", 900, 360, 0);
    w.step({ ...idleInput(), dashPressed: true, shockwavePressed: true });
    expect(w.recorder.events).toHaveLength(0);
    steps(w, 8);
    expect(w.recorder.events).toHaveLength(0);
    w.step(idleInput());
    expect(w.recorder.events.filter((e) => e.kind === "shot")).toHaveLength(1);
    expect(w.player.nextWave).toBe(0);
  });
  it("T15 refuses full projectile capacity without recording or cooldown", () => {
    const w = new World({ spawn: false });
    w.start();
    w.spawnEnemy("chaser", 900, 360, 0);
    for (let i = 0; i < 240; i++)
      w.projectiles.push(
        createProjectile(
          100 + i,
          { kind: "player", entityId: 1 },
          { x: 100, y: 100 },
          0,
          { damage: 10, speed: 0, radius: 4, ttlTicks: 60 },
          -1,
        ),
      );
    w.step(idleInput());
    expect(w.stats.rejectedPlayer).toBe(1);
    expect(w.player.nextShot).toBe(0);
    expect(w.recorder.events).toHaveLength(0);
  });
  it.each([358, 359])(
    "T16 death after %i completed ticks takes priority over sealing",
    (n) => {
      const w = world();
      steps(w, n);
      w.player.hp = 1;
      w.spawnEnemy("chaser", w.player.x, w.player.y, 0);
      w.step(idleInput());
      expect(w.state).toBe("defeat");
      expect(w.echoes).toHaveLength(0);
      expect(w.recorder.poses).toHaveLength(0);
    },
  );
  it("T17 upgrades exactly at60/120 and victory at180 without sealing final segment", () => {
    const w = world();
    steps(w, 3600);
    expect(w.state).toBe("upgrade");
    expect(w.echoes.at(-1)?.clip.clipId).toBe(9);
    w.upgrade("damage");
    steps(w, 3600);
    expect(w.state).toBe("upgrade");
    w.upgrade("speed");
    steps(w, 3600);
    expect(w.state).toBe("victory");
    expect(w.echoes.at(-1)?.clip.clipId).toBe(28);
    expect(w.completedTicks).toBe(10800);
  });
  it("T18/T20 new seeded worlds reset IDs, PRNG, stats and results", () => {
    const run = () => {
      const w = new World();
      w.start();
      steps(w, 600);
      return {
        ticks: w.completedTicks,
        enemies: w.enemies,
        stats: w.stats,
        player: w.player,
      };
    };
    expect(run()).toEqual(run());
    const w = world();
    expect(w.spawnEnemy("chaser", 40, 40).id).toBe(2);
    expect(w.echoes).toHaveLength(0);
  });
  it("T19 multiple contacts use max damage; immune player consumes hostile bullets", () => {
    const w = world();
    w.spawnEnemy("chaser", 640, 360, 0);
    w.spawnEnemy("charger", 640, 360, 0);
    w.step(idleInput());
    expect(w.player.hp).toBe(82);
    w.projectiles.push(
      createProjectile(
        100,
        { kind: "enemy", entityId: 5 },
        w.player,
        0,
        { damage: 8, speed: 0, radius: 5, ttlTicks: 180 },
        w.completedTicks,
      ),
    );
    w.step(idleInput());
    expect(w.player.hp).toBe(82);
    expect(w.projectiles).toHaveLength(0);
  });
  it("T21 new bullet gets full TTL and cannot hit a target before emission", () => {
    const w = world();
    const b = createProjectile(
      100,
      { kind: "player", entityId: 1 },
      { x: 600, y: 200 },
      0,
      { damage: 10, speed: 760, radius: 4, ttlTicks: 60 },
      0,
    );
    w.projectiles.push(b);
    w.step(idleInput());
    expect(b.x).toBe(600);
    expect(b.remainingTicks).toBe(60);
    w.step(idleInput());
    expect(b.x).toBeCloseTo(600 + 760 / 60);
    expect(b.remainingTicks).toBe(59);
  });
  it("10-minute bounded simulation and twenty complete world resets", () => {
    const w = new World({ durationTicks: 36000 });
    w.player.hp = 1e9;
    w.start();
    for (let i = 0; i < 36000; i++) {
      if (w.state === "upgrade") w.upgrade("damage");
      w.step({
        moveX: Math.cos(i / 90),
        moveY: Math.sin(i / 90),
        dashPressed: i % 180 === 0,
        shockwavePressed: i % 300 === 0,
      });
      if (i % 360 === 0) {
        expect(w.echoes.length).toBeLessThanOrEqual(3);
        expect(w.enemies.length).toBeLessThanOrEqual(70);
        expect(
          w.projectiles.filter((b) => b.source.kind !== "enemy").length,
        ).toBeLessThanOrEqual(240);
        expect(
          w.projectiles.filter((b) => b.source.kind === "enemy").length,
        ).toBeLessThanOrEqual(120);
        expect(w.visuals.length).toBeLessThanOrEqual(150);
        expect(w.recorder.poses.length).toBeLessThan(360);
      }
    }
    expect(w.state).toBe("victory");
    expect([
      w.stats.rejectedPlayer,
      w.stats.rejectedEcho,
      w.stats.rejectedEnemy,
    ]).toEqual([0, 0, 0]);
    for (let i = 0; i < 20; i++) {
      const fresh = new World();
      expect(fresh.completedTicks).toBe(0);
      expect(fresh.projectiles.length + fresh.echoes.length).toBe(0);
    }
  });
});

describe("capacity, boundary and enemy-state regression", () => {
  it("T15 event-limit rejection does not consume skill cooldown", () => {
    const w = world();
    w.recorder.events = Array.from({ length: 256 }, (_, i) => shot(0, i));
    w.step({ ...idleInput(), shockwavePressed: true });
    expect(w.player.nextWave).toBe(0);
    expect(w.stats.rejectedPlayer).toBe(1);
    expect(w.recorder.events.length).toBe(256);
  });
  it("T17 same-tick death at 180 seconds wins over victory", () => {
    const w = world();
    steps(w, 3600);
    w.upgrade("damage");
    steps(w, 3600);
    w.upgrade("damage");
    steps(w, 3599);
    const clip = w.echoes.at(-1)?.clip.clipId;
    w.player.hp = 1;
    w.spawnEnemy("chaser", w.player.x, w.player.y, 0);
    w.step(idleInput());
    expect(w.completedTicks).toBe(10800);
    expect(w.state).toBe("defeat");
    expect(w.echoes.at(-1)?.clip.clipId).toBe(clip);
  });
  it("dash immunity still consumes a hostile projectile", () => {
    const w = world();
    w.projectiles.push(
      createProjectile(
        100,
        { kind: "enemy", entityId: 8 },
        { x: 640, y: 350 },
        0,
        { damage: 8, speed: 0, radius: 5, ttlTicks: 180 },
        0,
      ),
    );
    w.step({ ...idleInput(), dashPressed: true });
    expect(w.player.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
  });
  it("spawn at cap skips schedule, no accumulated spawn debt on clearing", () => {
    const w = new World({ autoShoot: false });
    w.player.hp = 1e9;
    w.start();
    for (let i = 0; i < 70; i++) w.spawnEnemy("chaser", 50, 50, 100000);
    steps(w, 300);
    expect(w.enemies).toHaveLength(70);
    w.enemies = [];
    w.step(idleInput());
    expect(w.enemies).toHaveLength(1);
    steps(w, 59);
    expect(w.enemies).toHaveLength(1);
  });
  it("enemy warning prevents hits, shooter locks direction and aims every90 ticks", () => {
    const w = world();
    const enemy = w.spawnEnemy("shooter", 800, 360, 0);
    steps(w, 91);
    expect(enemy.phase).toBe("windup");
    const angle = enemy.angle;
    w.player.y = 500;
    steps(w, 24);
    expect(w.projectiles[0]?.angle).toBe(angle);
    steps(w, 66);
    expect(enemy.phase).toBe("windup");
    const dormant = w.spawnEnemy("chaser", w.player.x, w.player.y, 36);
    w.step({ ...idleInput(), shockwavePressed: true });
    expect(dormant.hp).toBe(30);
  });
  it("70 enemies and forced 360-projectile fixture remains bounded", () => {
    const w = world();
    w.player.hp = 1e9;
    for (let i = 0; i < 70; i++)
      w.spawnEnemy(
        i % 3 === 0 ? "shooter" : i % 3 === 1 ? "charger" : "chaser",
        80 + (i % 10) * 110,
        80 + Math.floor(i / 10) * 80,
        0,
      );
    for (let i = 0; i < 360; i++)
      w.projectiles.push(
        createProjectile(
          1000 + i,
          i < 240
            ? { kind: "player", entityId: 1 }
            : { kind: "enemy", entityId: 8 },
          { x: 100 + (i % 80) * 14, y: 100 + Math.floor(i / 80) * 90 },
          i,
          { damage: 10, speed: 760, radius: 4, ttlTicks: 60 },
          -1,
        ),
      );
    steps(w, 180);
    expect(w.projectiles.length).toBeLessThanOrEqual(360);
    expect(w.enemies.length).toBeLessThanOrEqual(70);
    expect(Number.isFinite(w.player.x)).toBe(true);
  });
});
