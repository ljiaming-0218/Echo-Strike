import { CONFIG as C, COVER } from "./config";
import { EchoRecorder } from "./echo/EchoRecorder";
import { EchoManager } from "./echo/EchoManager";
import {
  clamp,
  direction,
  exitFraction,
  segmentRect,
  sweep,
} from "./math/geometry";
import { createProjectile } from "./combat";
import type {
  Echo,
  InputCommand,
  PauseReason,
  Pose,
  Projectile,
  RecordedAttack,
  Relay,
  Source,
  State,
  Vec2,
  VisualEvent,
} from "./types";

const STARTS = [
  { x: 640, y: 584 },
  { x: 220, y: 540 },
  { x: 1060, y: 540 },
  { x: 220, y: 180 },
  { x: 1060, y: 180 },
  { x: 640, y: 584 },
];
export class World {
  state: State = "menu";
  readonly pauses = new Set<PauseReason>();
  completedTicks = 0;
  roundTick = 0;
  round = 1;
  exitHold = 0;
  failure: "health" | "timeout" | null = null;
  player = {
    id: 1,
    x: 640,
    y: 584,
    px: 640,
    py: 584,
    aimRad: -Math.PI / 2,
    hp: 100,
    nextShot: 0,
    nextDash: 0,
    dashUntil: 0,
    dashAngle: 0,
    protectedUntil: 0,
    pulseAvailable: true,
  };
  exit = { x: 640, y: 136 };
  relays: Relay[] = [];
  projectiles: Projectile[] = [];
  visuals: VisualEvent[] = [];
  readonly echoManager = new EchoManager();
  recorder = new EchoRecorder(this.pose, 1);
  stats = {
    echoKills: 0,
    relays: 0,
    shots: 0,
    hits: 0,
    damageTaken: 0,
    rejected: 0,
  };
  private nextId = 2;
  private nextClip = 0;
  constructor() {
    this.makeRelays();
  }
  get pose(): Pose {
    return {
      x: this.player.x,
      y: this.player.y,
      aimRad: this.player.aimRad,
      dashing: this.completedTicks < this.player.dashUntil,
    };
  }
  get echoes(): Echo[] {
    return this.echoManager.echoes;
  }
  get aliveEchoes(): Echo[] {
    return this.echoes.filter((e) => e.hp > 0);
  }
  get gateOpen(): boolean {
    return this.relays.every((r) => r.hp <= 0) && this.aliveEchoes.length === 0;
  }
  get running(): boolean {
    return this.state === "running" && this.pauses.size === 0;
  }
  get status(): string {
    return this.state === "running" && this.pauses.size ? "paused" : this.state;
  }
  start(): void {
    if (this.state === "menu") this.state = "running";
  }
  pause(reason: PauseReason): void {
    if (this.state === "running" || this.state === "review")
      this.pauses.add(reason);
  }
  clearReason(reason: PauseReason): void {
    if (this.pauses.delete(reason)) this.pauses.add("manual");
  }
  resume(): void {
    this.pauses.delete("manual");
    this.pauses.delete("performance");
  }
  private id(): number {
    return this.nextId++;
  }
  private makeRelays(): void {
    const points = [
      { x: 344, y: 202 },
      { x: 936, y: 202 },
      { x: 640, y: 492 },
      { x: 344, y: 508 },
      { x: 936, y: 508 },
      { x: 640, y: 202 },
    ];
    const indexes = this.round % 2 ? [0, 1, 2] : [3, 4, 5];
    this.relays = indexes.map((i) => {
      const p = points[i] ?? points[0]!;
      return { id: this.id(), ...p, hp: C.relayHP, radius: 23 };
    });
  }
  nextRound(): void {
    if (this.state !== "review") return;
    this.round++;
    this.roundTick = 0;
    this.exitHold = 0;
    this.projectiles = [];
    this.visuals = [];
    const start = STARTS[this.round - 1] ?? STARTS[0]!;
    const p = this.player;
    Object.assign(p, {
      ...start,
      px: start.x,
      py: start.y,
      hp: Math.min(C.playerHP, p.hp + 20),
      nextShot: this.completedTicks,
      nextDash: this.completedTicks,
      dashUntil: 0,
      protectedUntil: this.completedTicks + 45,
      pulseAvailable: true,
    });
    this.exit = { x: 1280 - start.x, y: 720 - start.y };
    this.echoManager.reset(() => this.id());
    this.makeRelays();
    this.recorder = new EchoRecorder(this.pose, this.round);
    this.state = "running";
  }
  private visual(
    kind: VisualEvent["kind"],
    x: number,
    y: number,
    radius = 0,
    echo = false,
  ): void {
    if (this.visuals.length < C.effectCap)
      this.visuals.push({ kind, x, y, radius, echo });
  }
  private move(input: InputCommand): void {
    const p = this.player,
      t = this.completedTicks,
      m = direction(input.moveX, input.moveY);
    p.px = p.x;
    p.py = p.y;
    if (Number.isFinite(input.aimRad)) p.aimRad = input.aimRad;
    if (input.dashPressed && t >= p.nextDash) {
      p.dashAngle = m.x || m.y ? Math.atan2(m.y, m.x) : p.aimRad;
      p.dashUntil = t + C.dashTicks;
      p.nextDash = t + C.dashCooldown;
      this.visual("dash", p.x, p.y, 24);
    }
    const dash = t < p.dashUntil,
      dx =
        (dash ? Math.cos(p.dashAngle) * C.dashSpeed : m.x * C.playerSpeed) / 60,
      dy =
        (dash ? Math.sin(p.dashAngle) * C.dashSpeed : m.y * C.playerSpeed) / 60;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
    for (let i = 0; i < n; i++) {
      const oldX = p.x;
      p.x = clamp(p.x + dx / n, 62, 1218);
      if (
        COVER.some(
          (r) =>
            p.x > r.x - C.playerRadius &&
            p.x < r.x + r.width + C.playerRadius &&
            p.y > r.y - C.playerRadius &&
            p.y < r.y + r.height + C.playerRadius,
        )
      )
        p.x = oldX;
      const oldY = p.y;
      p.y = clamp(p.y + dy / n, 62, 658);
      if (
        COVER.some(
          (r) =>
            p.x > r.x - C.playerRadius &&
            p.x < r.x + r.width + C.playerRadius &&
            p.y > r.y - C.playerRadius &&
            p.y < r.y + r.height + C.playerRadius,
        )
      )
        p.y = oldY;
    }
  }
  private fire(
    source: Source,
    origin: Vec2,
    angle: number,
    snapshot: {
      damage: number;
      speed: number;
      radius: number;
      ttlTicks: number;
    },
  ): boolean {
    if (this.projectiles.length >= C.projectileCap) {
      this.stats.rejected++;
      return false;
    }
    this.projectiles.push(
      createProjectile(
        this.id(),
        source,
        origin,
        angle,
        snapshot,
        this.completedTicks,
      ),
    );
    if (source.kind === "player") this.stats.shots++;
    this.visual("shot", origin.x, origin.y, 5, source.kind === "echo");
    return true;
  }
  private pulse(
    source: Source,
    origin: Vec2,
    radius: number,
    damage: number,
  ): void {
    this.visual("wave", origin.x, origin.y, radius, source.kind === "echo");
    if (source.kind === "player") {
      for (const b of this.projectiles)
        if (
          b.source.kind === "echo" &&
          Math.hypot(b.x - origin.x, b.y - origin.y) <= radius
        )
          b.spent = true;
      for (const e of this.echoes)
        if (
          e.hp > 0 &&
          Math.hypot(e.pose.x - origin.x, e.pose.y - origin.y) <=
            radius + C.playerRadius
        )
          this.hurtEcho(e, damage);
    } else if (
      Math.hypot(this.player.x - origin.x, this.player.y - origin.y) <=
      radius + C.playerRadius
    )
      this.hurtPlayer(damage);
  }
  private hurtEcho(e: Echo, damage: number): void {
    if (e.hp <= 0) return;
    this.visual("hit", e.pose.x, e.pose.y, 18, true);
    e.hp = Math.max(0, e.hp - damage);
    if (e.hp === 0) {
      this.stats.echoKills++;
      this.visual("kill", e.pose.x, e.pose.y, 22, true);
    }
  }
  private hurtPlayer(damage: number): void {
    const p = this.player,
      t = this.completedTicks;
    if (t < p.dashUntil || t < p.protectedUntil) return;
    const d = Math.min(p.hp, damage);
    p.hp -= d;
    p.protectedUntil = t + C.invulnerabilityTicks;
    this.stats.damageTaken += d;
    this.visual("hurt", p.x, p.y, 26);
  }
  private playerAttacks(input: InputCommand): void {
    const p = this.player,
      t = this.completedTicks,
      source: Source = { kind: "player", entityId: p.id };
    if (t < p.dashUntil) return;
    if (
      input.pulsePressed &&
      !input.dashPressed &&
      p.pulseAvailable &&
      this.recorder.canRecord
    ) {
      const event: RecordedAttack = {
        kind: "pulse",
        seq: this.recorder.events.length,
        localTick: this.roundTick,
        origin: { x: p.x, y: p.y },
        radius: C.pulseRadius,
        damage: C.pulseDamage,
      };
      this.pulse(source, event.origin, event.radius, event.damage);
      this.recorder.record(event);
      p.pulseAvailable = false;
    }
    if (!input.firing || t < p.nextShot) return;
    if (!this.recorder.canRecord) {
      this.stats.rejected++;
      return;
    }
    const origin = {
      x: clamp(p.x + 20 * Math.cos(p.aimRad), 48, 1232),
      y: clamp(p.y + 20 * Math.sin(p.aimRad), 48, 672),
    };
    const projectile = {
      damage: C.shotDamage,
      speed: C.shotSpeed,
      radius: C.shotRadius,
      ttlTicks: C.shotTTL,
    };
    if (this.fire(source, origin, p.aimRad, projectile)) {
      this.recorder.record({
        kind: "shot",
        seq: this.recorder.events.length,
        localTick: this.roundTick,
        origin,
        angleRad: p.aimRad,
        projectile,
      });
      p.nextShot = t + C.shotInterval;
    }
  }
  private updateProjectiles(): void {
    for (const b of this.projectiles) {
      if (b.spent) continue;
      const fresh = b.createdAtTick === this.completedTicks,
        a = { x: b.x, y: b.y },
        end = {
          x: b.x + (fresh ? 0 : (Math.cos(b.angle) * b.speed) / 60),
          y: b.y + (fresh ? 0 : (Math.sin(b.angle) * b.speed) / 60),
        };
      let best = exitFraction(a, end, 48, 1232, 48, 672),
        blocked = best < 1;
      for (const rect of COVER) {
        const u = segmentRect(a, end, rect, b.radius);
        if (u !== null && u <= best) {
          best = u;
          blocked = true;
        }
      }
      let hit: (() => void) | undefined,
        targetId = Infinity;
      const candidate = (u: number | null, id: number, action: () => void) => {
        if (
          u !== null &&
          (u < best || (!blocked && u === best && id < targetId))
        ) {
          best = u;
          targetId = id;
          hit = action;
          blocked = false;
        }
      };
      if (b.source.kind === "player") {
        for (const r of this.relays)
          if (r.hp > 0)
            candidate(sweep(a, end, r, r, r.radius + b.radius), r.id, () => {
              this.stats.hits++;
              this.visual("hit", r.x, r.y, 20);
              r.hp = Math.max(0, r.hp - b.damage);
              if (r.hp === 0) {
                this.stats.relays++;
                this.visual("kill", r.x, r.y, 24);
              }
            });
        for (const e of this.echoes)
          if (e.hp > 0)
            candidate(
              sweep(
                a,
                end,
                fresh ? e.pose : e.previousPose,
                e.pose,
                C.playerRadius + b.radius,
              ),
              e.id,
              () => {
                this.stats.hits++;
                this.hurtEcho(e, b.damage);
              },
            );
      } else
        candidate(
          sweep(
            a,
            end,
            fresh ? this.player : { x: this.player.px, y: this.player.py },
            this.player,
            C.playerRadius + b.radius,
          ),
          1,
          () => this.hurtPlayer(b.damage),
        );
      if (hit) {
        hit();
        b.spent = true;
      } else if (blocked) b.spent = true;
      b.x = end.x;
      b.y = end.y;
      if (!fresh) b.remainingTicks--;
      if (b.remainingTicks <= 0) b.spent = true;
    }
    this.projectiles = this.projectiles.filter((b) => !b.spent);
  }
  step(input: InputCommand): void {
    if (!this.running) return;
    this.visuals = [];
    this.move(input);
    // Position snapshots and event direction are authoritative. No ghost AI.
    this.echoManager.step(this.roundTick, (e, event) => {
      const source: Source = {
        kind: "echo",
        entityId: e.id,
        clipId: e.clip.clipId,
        loopSerial: e.loopSerial,
        eventSeq: event.seq,
      };
      if (event.kind === "shot")
        this.fire(source, event.origin, event.angleRad, event.projectile);
      else this.pulse(source, event.origin, event.radius, event.damage);
    });
    this.playerAttacks(input);
    this.updateProjectiles();
    this.recorder.poses.push(this.pose);
    this.completedTicks++;
    this.roundTick++;
    if (this.player.hp <= 0) {
      this.failure = "health";
      this.state = "defeat";
      return;
    }
    if (
      this.gateOpen &&
      Math.hypot(this.player.x - this.exit.x, this.player.y - this.exit.y) <=
        C.exitRadius &&
      this.roundTick >= C.minRoundTicks
    )
      this.exitHold++;
    else this.exitHold = 0;
    if (this.exitHold >= C.exitHoldTicks) {
      if (this.round === C.totalRounds) this.state = "victory";
      else {
        this.echoManager.add(this.recorder.seal(this.nextClip++));
        this.state = "review";
        this.visual("cycle", this.player.x, this.player.y, 40);
      }
      return;
    }
    if (this.roundTick >= C.roundTicks) {
      this.failure = "timeout";
      this.state = "defeat";
    }
  }
}
