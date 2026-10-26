import { expect, it, describe } from "vitest";
import { World } from "../../src/core/World";
import { CONFIG as C } from "../../src/core/config";
import { EchoRecorder } from "../../src/core/echo/EchoRecorder";
import { createProjectile } from "../../src/core/combat";
import { FixedStepClock } from "../../src/core/clock/FixedStepClock";
import { idleInput } from "../../src/core/types";
import type { InputCommand, RecordedAttack } from "../../src/core/types";
const fresh = () => {
  const w = new World();
  w.start();
  return w;
};
const step = (w: World, n: number, input: InputCommand = idleInput()) => {
  for (let i = 0; i < n; i++) w.step(input);
};
const shot = (
  tick: number,
  seq = 0,
  origin = { x: 400, y: 584 },
  angle = 0,
): RecordedAttack => ({
  kind: "shot",
  localTick: tick,
  seq,
  origin,
  angleRad: angle,
  projectile: { damage: 12, speed: 900, radius: 4, ttlTicks: 100 },
});
function history(events: RecordedAttack[], length = 360, round = 1) {
  const r = new EchoRecorder(
    { x: 400, y: 584, aimRad: 0, dashing: false },
    round,
  );
  for (let i = 0; i < length; i++)
    r.poses.push({ x: 400, y: 584, aimRad: 0, dashing: false });
  events.forEach((e) => r.record(e));
  return r.seal(round);
}
function enemy(w: World, events: RecordedAttack[] = [], length = 360) {
  w.echoManager.add(history(events, length));
  w.echoManager.reset(() => 900);
  return w.echoes[0]!;
}
function prepareExit(w: World) {
  w.relays.forEach((r) => (r.hp = 0));
  w.echoes.forEach((e) => (e.hp = 0));
  w.player.x = w.exit.x;
  w.player.y = w.exit.y;
}

describe("manual combat and hostile recorded histories", () => {
  it("does not auto-fire, follows manual aim, and records only successful attacks", () => {
    const w = fresh();
    step(w, 30);
    expect(w.projectiles).toHaveLength(0);
    expect(w.recorder.events).toHaveLength(0);
    w.step({ ...idleInput(), aimRad: 0, firing: true });
    expect(w.projectiles[0]?.angle).toBe(0);
    expect(w.recorder.events[0]?.kind).toBe("shot");
    expect(w.player.nextShot).toBe(w.completedTicks - 1 + C.shotInterval);
  });
  it("real shots destroy relays once and never consume their own player health", () => {
    const w = fresh();
    w.relays = [{ id: 20, x: 780, y: 584, hp: 24, radius: 23 }];
    step(w, 30, { ...idleInput(), aimRad: 0, firing: true });
    expect(w.relays[0]?.hp).toBe(0);
    expect(w.stats.relays).toBe(1);
    expect(w.player.hp).toBe(100);
    expect(w.stats.hits).toBe(2);
  });
  it("old shot direction hits the current player instead of retargeting", () => {
    const w = fresh();
    enemy(w, [shot(0)]);
    step(w, 20);
    expect(w.player.hp).toBe(88);
    expect(w.recorder.events).toHaveLength(0);
    expect(w.stats.damageTaken).toBe(12);
  });
  it("walking out of the historical line makes the same recording miss", () => {
    const w = fresh();
    enemy(w, [shot(0)]);
    w.player.y = 480;
    step(w, 30);
    expect(w.player.hp).toBe(100);
    expect(w.projectiles.every((p) => p.angle === 0)).toBe(true);
  });
  it("dead past selves stop firing but their in-flight bullets survive", () => {
    const w = fresh(),
      e = enemy(w, [shot(0, 0), shot(10, 1)]);
    w.step(idleInput());
    expect(w.projectiles.length).toBe(1);
    e.hp = 0;
    step(w, 19);
    expect(w.player.hp).toBe(88);
    expect(w.projectiles.filter((b) => b.createdAtTick === 10)).toHaveLength(0);
  });
  it("past selves can be shot and award one kill, not ally damage", () => {
    const w = fresh(),
      e = enemy(w);
    w.player.x = 250;
    step(w, 45, { ...idleInput(), aimRad: 0, firing: true });
    expect(e.hp).toBe(0);
    expect(w.stats.echoKills).toBe(1);
  });
  it("cover blocks hostile bullets and dash cannot tunnel through cover", () => {
    const w = fresh();
    w.player.x = 520;
    w.player.y = 360;
    enemy(w, [shot(0, 0, { x: 520, y: 220 }, Math.PI / 2)]);
    step(w, 30);
    expect(w.player.hp).toBe(100);
    const v = fresh();
    v.player.x = 520;
    v.player.y = 220;
    v.step({ ...idleInput(), moveY: 1, dashPressed: true });
    step(v, 8, { ...idleInput(), moveY: 1 });
    expect(v.player.y).toBeLessThanOrEqual(244);
  });
  it("normalization and world bounds hold even with non-finite input", () => {
    const w = fresh();
    w.step({ ...idleInput(), moveX: NaN, moveY: Infinity, aimRad: NaN });
    expect(Number.isFinite(w.player.x + w.player.y + w.player.aimRad)).toBe(
      true,
    );
    step(w, 170, { ...idleInput(), moveX: 1, moveY: 1 });
    expect(w.player.x).toBeLessThanOrEqual(1218);
    expect(w.player.y).toBeLessThanOrEqual(658);
  });
  it("pulse erases nearby hostile bullets, damages enemies once and is recorded once", () => {
    const w = fresh(),
      e = enemy(w);
    w.player.x = 450;
    w.projectiles.push(
      createProjectile(
        99,
        { kind: "echo", entityId: 900, clipId: 1, loopSerial: 0, eventSeq: 0 },
        { x: 470, y: 584 },
        0,
        { damage: 12, speed: 0, radius: 4, ttlTicks: 100 },
        -1,
      ),
    );
    w.step({ ...idleInput(), pulsePressed: true });
    expect(e.hp).toBe(12);
    expect(w.projectiles).toHaveLength(0);
    expect(w.recorder.events.filter((e) => e.kind === "pulse")).toHaveLength(1);
    step(w, 5, { ...idleInput(), pulsePressed: true });
    expect(e.hp).toBe(12);
  });
  it("past pulse can hurt current self, with the original center and radius", () => {
    const w = fresh();
    enemy(w, [
      {
        kind: "pulse",
        seq: 0,
        localTick: 0,
        origin: { x: 640, y: 584 },
        radius: 160,
        damage: 24,
      },
    ]);
    w.step(idleInput());
    expect(w.player.hp).toBe(76);
  });
  it("dash wins simultaneous input and grants exactly nine ticks of immunity", () => {
    const w = fresh();
    enemy(w, [
      {
        kind: "pulse",
        seq: 0,
        localTick: 0,
        origin: { x: 640, y: 584 },
        radius: 160,
        damage: 24,
      },
      {
        kind: "pulse",
        seq: 1,
        localTick: 9,
        origin: { x: 640, y: 480 },
        radius: 160,
        damage: 24,
      },
    ]);
    w.step({
      ...idleInput(),
      dashPressed: true,
      pulsePressed: true,
      firing: true,
    });
    expect(w.player.hp).toBe(100);
    expect(w.player.pulseAvailable).toBe(true);
    expect(w.recorder.events).toHaveLength(0);
    step(w, 9);
    expect(w.player.hp).toBe(76);
  });
  it("full projectile and event budgets reject attacks without cooldown or fake recordings", () => {
    const w = fresh();
    for (let i = 0; i < C.projectileCap; i++)
      w.projectiles.push(
        createProjectile(
          100 + i,
          { kind: "player", entityId: 1 },
          { x: 100, y: 100 },
          0,
          { damage: 12, speed: 0, radius: 4, ttlTicks: 100 },
          -1,
        ),
      );
    w.step({ ...idleInput(), firing: true });
    expect(w.stats.rejected).toBe(1);
    expect(w.player.nextShot).toBe(0);
    expect(w.recorder.events).toHaveLength(0);
    const v = fresh();
    for (let i = 0; i < C.eventCap; i++) v.recorder.events.push(shot(0, i));
    v.step({ ...idleInput(), firing: true });
    expect(v.stats.rejected).toBe(1);
  });
});
describe("round goals, recording immutability and lifecycle", () => {
  it("exit is locked by both anchors and hostile selves", () => {
    const w = fresh();
    expect(w.gateOpen).toBe(false);
    w.relays.forEach((r) => (r.hp = 0));
    const e = enemy(w);
    expect(w.gateOpen).toBe(false);
    e.hp = 0;
    expect(w.gateOpen).toBe(true);
  });
  it("early exit records actual actions and freezes for a tactical review", () => {
    const w = fresh();
    prepareExit(w);
    step(w, C.minRoundTicks + C.exitHoldTicks - 2);
    expect(w.state).toBe("running");
    step(w, 1);
    expect(w.state).toBe("review");
    const clip = w.echoManager.clips[0]!;
    expect(clip.durationTicks).toBe(203);
    expect(clip.poses).toHaveLength(203);
    expect(Object.isFrozen(clip.poses[0])).toBe(true);
    const tick = w.completedTicks;
    step(w, 50);
    expect(w.completedTicks).toBe(tick);
  });
  it("next round restores limited health, resets skills and creates hostile snapshots", () => {
    const w = fresh();
    w.player.hp = 70;
    prepareExit(w);
    step(w, 203);
    const history = w.echoManager.clips[0]!,
      snapshot = JSON.stringify(history);
    w.nextRound();
    expect(w.round).toBe(2);
    expect(w.player.hp).toBe(90);
    expect(w.echoes).toHaveLength(1);
    expect(w.echoes[0]?.hp).toBe(36);
    expect(w.projectiles).toHaveLength(0);
    expect(w.player.pulseAvailable).toBe(true);
    expect(JSON.stringify(history)).toBe(snapshot);
  });
  it("retains only the last three clips and finishes after six real extraction conditions", () => {
    const w = fresh();
    for (let round = 1; round <= 6; round++) {
      expect(w.round).toBe(round);
      prepareExit(w);
      step(w, 203);
      if (round < 6) {
        expect(w.state).toBe("review");
        w.nextRound();
      } else expect(w.state).toBe("victory");
      expect(w.echoManager.clips.length).toBeLessThanOrEqual(3);
    }
    expect(w.echoManager.clips.map((c) => c.round)).toEqual([3, 4, 5]);
  });
  it("unfinished round times out and never creates a short or empty ghost", () => {
    const w = fresh();
    step(w, C.roundTicks);
    expect(w.state).toBe("defeat");
    expect(w.failure).toBe("timeout");
    expect(w.echoManager.clips).toHaveLength(0);
  });
  it("death on the extraction step takes priority over success", () => {
    const w = fresh();
    prepareExit(w);
    step(w, 202);
    w.player.hp = 0;
    w.step(idleInput());
    expect(w.state).toBe("defeat");
    expect(w.echoManager.clips).toHaveLength(0);
  });
  it("pause reasons do not advance timers and cannot bypass portrait/hidden state", () => {
    const w = fresh();
    w.pause("portrait");
    w.pause("hidden");
    step(w, 30);
    expect(w.roundTick).toBe(0);
    w.clearReason("hidden");
    w.resume();
    expect(w.running).toBe(false);
    w.clearReason("portrait");
    expect(w.running).toBe(false);
    w.resume();
    expect(w.running).toBe(true);
  });
  it("events at tick0 and last tick fire once each loop, with unique instance IDs and no recursive recording", () => {
    const w = fresh();
    enemy(w, [shot(0, 0), shot(59, 1)], 60);
    const ids = new Set<number>();
    for (let n = 0; n < 180; n++) {
      w.step(idleInput());
      w.projectiles.forEach((b) => ids.add(b.id));
    }
    expect(ids.size).toBe(6);
    expect(w.recorder.events).toHaveLength(0);
    expect(w.echoes[0]?.loopSerial).toBe(2);
  });
  it.each([30, 60, 120])(
    "actual player tracks agree at %iHz for a fixed input sequence",
    (hz) => {
      const w = fresh(),
        clock = new FixedStepClock();
      for (let i = 0; i < hz * 2; i++)
        clock.advanceElapsed(
          1000 / hz,
          () => {
            w.step({ ...idleInput(), moveX: 1 });
            return w.running;
          },
          () => {},
        );
      expect(w.roundTick).toBe(120);
      expect(w.player.x).toBeCloseTo(1160, 6);
      expect(w.recorder.poses.length).toBe(120);
    },
  );
  it("twenty new worlds reset IDs, tapes and state without retained battle objects", () => {
    for (let n = 0; n < 20; n++) {
      const w = fresh();
      expect(w.relays[0]?.id).toBe(2);
      expect(w.round).toBe(1);
      expect(w.completedTicks).toBe(0);
      expect(w.projectiles).toHaveLength(0);
      expect(w.echoManager.clips).toHaveLength(0);
    }
  });
});
