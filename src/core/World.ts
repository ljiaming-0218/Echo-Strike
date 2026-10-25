import { CONFIG as C } from "./config";
import { EchoRecorder } from "./echo/EchoRecorder";
import { EchoManager } from "./echo/EchoManager";
import { clamp, direction, exitFraction, sweep } from "./math/geometry";
import { Random } from "./math/random";
import { createProjectile } from "./combat";
import type { DamageCandidate } from "./combat";
import type {
  Enemy,
  InputCommand,
  PauseReason,
  Pose,
  Projectile,
  RecordedAttack,
  Source,
  State,
  Upgrade,
  Vec2,
  VisualEvent,
} from "./types";

export interface WorldOptions {
  seed?: number;
  spawn?: boolean;
  autoShoot?: boolean;
  durationTicks?: number;
}
export class World {
  state: State = "menu";
  readonly pauses = new Set<PauseReason>();
  completedTicks = 0;
  player = {
    id: 1,
    x: 640,
    y: 360,
    px: 640,
    py: 360,
    aimRad: -Math.PI / 2,
    hp: 100,
    radius: 14,
    speed: 230,
    damage: 10,
    waveRadius: 110,
    nextShot: 0,
    nextDash: 0,
    nextWave: 0,
    dashUntil: 0,
    dashAngle: 0,
    protectedUntil: 0,
  };
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  readonly echoManager = new EchoManager();
  recorder = new EchoRecorder(this.pose, 0);
  visuals: VisualEvent[] = [];
  stats = {
    kills: 0,
    playerDamage: 0,
    echoDamage: 0,
    echoShots: 0,
    echoHits: 0,
    rejectedPlayer: 0,
    rejectedEcho: 0,
    rejectedEnemy: 0,
  };
  upgrades: Record<Upgrade, number> = { damage: 0, speed: 0, wave: 0 };
  private nextId = 2;
  private nextClipId = 0;
  private nextSpawn = 0;
  private readonly rng: Random;
  private readonly options: Required<WorldOptions>;
  constructor(options: WorldOptions = {}) {
    this.options = {
      seed: options.seed ?? 0xeca01234,
      spawn: options.spawn ?? true,
      autoShoot: options.autoShoot ?? true,
      durationTicks: options.durationTicks ?? C.matchTicks,
    };
    this.rng = new Random(this.options.seed);
  }
  get pose(): Pose {
    return {
      x: this.player.x,
      y: this.player.y,
      aimRad: this.player.aimRad,
      dashing: this.completedTicks < this.player.dashUntil,
    };
  }
  get echoes() {
    return this.echoManager.echoes;
  }
  get status(): string {
    return this.state === "running" && this.pauses.size ? "paused" : this.state;
  }
  get running(): boolean {
    return this.state === "running" && this.pauses.size === 0;
  }
  start(): void {
    if (this.state === "menu") this.state = "running";
  }
  pause(reason: PauseReason): void {
    if (this.state === "running" || this.state === "upgrade")
      this.pauses.add(reason);
  }
  clearReason(reason: PauseReason): void {
    if (this.pauses.delete(reason)) this.pauses.add("manual");
  }
  resume(): void {
    this.pauses.delete("manual");
    this.pauses.delete("performance");
  }
  upgrade(kind: Upgrade): void {
    if (this.state !== "upgrade" || this.upgrades[kind] >= 2) return;
    this.upgrades[kind]++;
    if (kind === "damage") this.player.damage += 3;
    if (kind === "speed")
      this.player.speed = 230 * (1 + 0.1 * this.upgrades.speed);
    if (kind === "wave") this.player.waveRadius += 20;
    this.state = "running";
  }
  private id(): number {
    return this.nextId++;
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
  // Also used by deterministic fixtures; no browser-only debug surface in production.
  spawnEnemy(kind: Enemy["kind"], x: number, y: number, warning = 36): Enemy {
    const hp = kind === "chaser" ? 30 : kind === "charger" ? 50 : 40;
    const e: Enemy = {
      id: this.id(),
      kind,
      x,
      y,
      px: x,
      py: y,
      hp,
      maxHp: hp,
      radius: kind === "charger" ? 20 : kind === "chaser" ? 16 : 17,
      activeAt: this.completedTicks + warning,
      phase: "chase",
      until: 0,
      angle: 0,
      nextAttack: this.completedTicks + warning + 90,
    };
    this.enemies.push(e);
    return e;
  }
  private spawn(): void {
    const t = this.completedTicks;
    if (!this.options.spawn || t < this.nextSpawn) return;
    this.nextSpawn = t + (t < 1080 ? 60 : t < 3600 ? 45 : t < 7200 ? 36 : 30);
    if (this.enemies.length >= C.enemyCap) return;
    for (let i = 0; i < 16; i++) {
      const edge = Math.floor(this.rng.next() * 4),
        along = this.rng.next();
      const x = edge < 2 ? (edge === 0 ? 55 : 1225) : 55 + 1170 * along;
      const y = edge >= 2 ? (edge === 2 ? 55 : 665) : 55 + 610 * along;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 220) continue;
      const r = this.rng.next(),
        chaser = t < 1080 ? 1 : t < 3600 ? 0.8 : t < 7200 ? 0.6 : 0.5,
        charger = t < 3600 ? 1 : t < 7200 ? 0.85 : 0.8;
      this.spawnEnemy(
        r < chaser ? "chaser" : r < charger ? "charger" : "shooter",
        x,
        y,
      );
      break;
    }
  }
  private updateEnemies(): void {
    const t = this.completedTicks,
      p = this.player;
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
      if (t < e.activeAt) continue;
      const dx = p.x - e.x,
        dy = p.y - e.y,
        d = Math.hypot(dx, dy),
        angle = Math.atan2(dy, dx);
      let speed = 0,
        moveAngle = angle;
      if (e.kind === "chaser") speed = 105;
      if (e.kind === "charger") {
        if (e.phase === "windup" && t >= e.until) {
          e.phase = "charge";
          e.until = t + 24;
        } else if (e.phase === "charge" && t >= e.until) {
          e.phase = "recover";
          e.until = t + 90;
        } else if (e.phase === "recover" && t >= e.until) e.phase = "chase";
        if (e.phase === "chase" && d <= 420) {
          e.phase = "windup";
          e.angle = angle;
          e.until = t + 36;
        }
        speed = e.phase === "charge" ? 480 : e.phase === "chase" ? 65 : 0;
        moveAngle = e.phase === "charge" ? e.angle : angle;
      }
      if (e.kind === "shooter") {
        if (e.phase === "windup" && t >= e.until) {
          const source: Source = { kind: "enemy", entityId: e.id };
          this.fire(source, e, e.angle, {
            damage: 8,
            speed: 260,
            radius: 5,
            ttlTicks: 180,
          });
          e.phase = "chase";
        } else if (e.phase === "chase" && t >= e.nextAttack) {
          e.phase = "windup";
          e.angle = angle;
          e.until = t + 24;
          e.nextAttack = t + 90;
        }
        speed = e.phase === "windup" ? 0 : d > 340 ? 75 : d < 260 ? -75 : 0;
      }
      e.x = clamp(
        e.x + (Math.cos(moveAngle) * speed) / 60,
        32 + e.radius,
        1248 - e.radius,
      );
      e.y = clamp(
        e.y + (Math.sin(moveAngle) * speed) / 60,
        32 + e.radius,
        688 - e.radius,
      );
      if (
        e.phase === "charge" &&
        (e.x === 32 + e.radius ||
          e.x === 1248 - e.radius ||
          e.y === 32 + e.radius ||
          e.y === 688 - e.radius)
      ) {
        e.phase = "recover";
        e.until = t + 90;
      }
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
    const hostile = source.kind === "enemy",
      count = this.projectiles.filter(
        (p) => !p.spent && (p.source.kind === "enemy") === hostile,
      ).length;
    if (count >= (hostile ? C.hostileProjectileCap : C.friendlyProjectileCap)) {
      if (source.kind === "echo") this.stats.rejectedEcho++;
      else if (hostile) this.stats.rejectedEnemy++;
      else this.stats.rejectedPlayer++;
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
    if (source.kind === "echo") this.stats.echoShots++;
    if (!hostile)
      this.visual("shot", origin.x, origin.y, 6, source.kind === "echo");
    return true;
  }
  private wave(
    source: Source,
    origin: Vec2,
    radius: number,
    damage: number,
    candidates: DamageCandidate[],
  ): void {
    const attackId = this.id(),
      finalDamage =
        source.kind === "echo"
          ? Math.max(1, Math.round(damage * 0.45))
          : damage;
    for (const e of this.enemies)
      if (
        this.completedTicks >= e.activeAt &&
        Math.hypot(e.x - origin.x, e.y - origin.y) <= radius + e.radius
      )
        candidates.push({
          attackId,
          targetId: e.id,
          damage: finalDamage,
          source,
        });
    this.visual("wave", origin.x, origin.y, radius, source.kind === "echo");
  }
  private playerAttacks(
    shockwave: boolean,
    dashing: boolean,
    candidates: DamageCandidate[],
  ): void {
    const p = this.player,
      t = this.completedTicks,
      source: Source = { kind: "player", entityId: p.id },
      localTick = t % 360;
    if (dashing) return;
    if (shockwave && t >= p.nextWave) {
      if (this.recorder.canRecord) {
        const event: RecordedAttack = {
          kind: "shockwave",
          seq: this.recorder.events.length,
          localTick,
          origin: { x: p.x, y: p.y },
          radius: p.waveRadius,
          damage: 18,
        };
        this.wave(source, event.origin, event.radius, event.damage, candidates);
        this.recorder.record(event);
        p.nextWave = t + 300;
      } else this.stats.rejectedPlayer++;
    }
    if (!this.options.autoShoot || t < p.nextShot) return;
    const target = this.enemies
      .filter((e) => e.activeAt <= t && Math.hypot(e.x - p.x, e.y - p.y) <= 650)
      .sort(
        (a, b) =>
          (a.x - p.x) ** 2 +
            (a.y - p.y) ** 2 -
            ((b.x - p.x) ** 2 + (b.y - p.y) ** 2) || a.id - b.id,
      )[0];
    if (!target) return;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    p.aimRad = angle;
    const origin = {
      x: clamp(p.x + 18 * Math.cos(angle), 32, 1248),
      y: clamp(p.y + 18 * Math.sin(angle), 32, 688),
    };
    const projectile = {
      damage: p.damage,
      speed: 760,
      radius: 4,
      ttlTicks: 60,
    };
    if (!this.recorder.canRecord) {
      this.stats.rejectedPlayer++;
      return;
    }
    if (this.fire(source, origin, angle, projectile)) {
      this.recorder.record({
        kind: "shot",
        seq: this.recorder.events.length,
        localTick,
        origin,
        angleRad: angle,
        projectile,
      });
      p.nextShot = t + 12;
    }
  }
  private echoAttacks(candidates: DamageCandidate[]): void {
    for (const e of [...this.echoes].reverse()) {
      while (e.eventCursor < e.clip.events.length) {
        const event = e.clip.events[e.eventCursor];
        if (!event || event.localTick > this.completedTicks % 360) break;
        e.eventCursor++;
        if (event.localTick !== this.completedTicks % 360)
          throw new Error("Skipped echo event");
        const source: Source = {
          kind: "echo",
          entityId: e.id,
          clipId: e.clip.clipId,
          loopSerial: e.loopSerial,
          eventSeq: event.seq,
        };
        if (event.kind === "shot")
          this.fire(source, event.origin, event.angleRad, event.projectile);
        else
          this.wave(
            source,
            event.origin,
            event.radius,
            event.damage,
            candidates,
          );
      }
    }
  }
  private projectilesAndContacts(
    candidates: DamageCandidate[],
  ): { damage: number; id: number }[] {
    const p = this.player,
      t = this.completedTicks,
      hits: { damage: number; id: number }[] = [];
    for (const b of this.projectiles) {
      const fresh = b.createdAtTick === t,
        a = { x: b.x, y: b.y },
        next = {
          x: b.x + (fresh ? 0 : (Math.cos(b.angle) * b.speed) / 60),
          y: b.y + (fresh ? 0 : (Math.sin(b.angle) * b.speed) / 60),
        };
      const end = exitFraction(a, next, 32, 1248, 32, 688);
      if (b.source.kind === "enemy") {
        const u = sweep(
          a,
          next,
          fresh ? p : { x: p.px, y: p.py },
          p,
          b.radius + p.radius,
        );
        if (u !== null && u <= end) {
          b.spent = true;
          hits.push({ damage: b.damage, id: b.source.entityId });
        }
      } else {
        let target: Enemy | undefined,
          best = Infinity;
        for (const e of this.enemies) {
          if (e.activeAt > t) continue;
          const u = sweep(
            a,
            next,
            fresh ? e : { x: e.px, y: e.py },
            e,
            b.radius + e.radius,
          );
          if (
            u !== null &&
            u <= end &&
            (u < best || (u === best && e.id < (target?.id ?? Infinity)))
          ) {
            best = u;
            target = e;
          }
        }
        if (target) {
          b.spent = true;
          candidates.push({
            attackId: b.id,
            targetId: target.id,
            damage: b.damage,
            source: b.source,
          });
          if (b.source.kind === "echo") this.stats.echoHits++;
        }
      }
      b.x = next.x;
      b.y = next.y;
      if (!fresh) b.remainingTicks--;
      if (end < 1 || b.remainingTicks <= 0) b.spent = true;
    }
    for (const e of this.enemies)
      if (
        e.activeAt <= t &&
        sweep(
          { x: p.px, y: p.py },
          p,
          { x: e.px, y: e.py },
          e,
          p.radius + e.radius,
        ) !== null
      )
        hits.push({ damage: e.kind === "charger" ? 18 : 10, id: e.id });
    return hits;
  }
  step(input: InputCommand): void {
    if (!this.running) return;
    this.visuals = [];
    const p = this.player,
      t = this.completedTicks,
      candidates: DamageCandidate[] = [];
    this.spawn();
    this.updateEnemies();
    p.px = p.x;
    p.py = p.y;
    const move = direction(input.moveX, input.moveY);
    const dashRequested = input.dashPressed;
    if (dashRequested && t >= p.nextDash && t >= p.dashUntil) {
      p.dashAngle = move.x || move.y ? Math.atan2(move.y, move.x) : p.aimRad;
      p.dashUntil = t + 9;
      p.nextDash = t + 180;
      this.visual("dash", p.x, p.y, 22);
    }
    const dashing = t < p.dashUntil;
    if (!dashing && (move.x || move.y)) p.aimRad = Math.atan2(move.y, move.x);
    p.x = clamp(
      p.x + (dashing ? Math.cos(p.dashAngle) * 720 : move.x * p.speed) / 60,
      46,
      1234,
    );
    p.y = clamp(
      p.y + (dashing ? Math.sin(p.dashAngle) * 720 : move.y * p.speed) / 60,
      46,
      674,
    );
    this.echoManager.sample(t % 360);
    this.playerAttacks(
      input.shockwavePressed && !dashRequested,
      dashing,
      candidates,
    );
    this.echoAttacks(candidates);
    const hits = this.projectilesAndContacts(candidates);
    for (const hit of candidates.sort((a, b) => a.attackId - b.attackId)) {
      const enemy = this.enemies.find((e) => e.id === hit.targetId);
      if (!enemy || enemy.hp <= 0) continue;
      const actual = Math.min(enemy.hp, hit.damage);
      enemy.hp -= actual;
      if (hit.source.kind === "player") this.stats.playerDamage += actual;
      else if (hit.source.kind === "echo") this.stats.echoDamage += actual;
      if (enemy.hp === 0) {
        this.stats.kills++;
        this.visual("kill", enemy.x, enemy.y, enemy.radius);
      }
    }
    if (!dashing && t >= p.protectedUntil && hits.length) {
      hits.sort((a, b) => b.damage - a.damage || a.id - b.id);
      p.hp = Math.max(0, p.hp - (hits[0]?.damage ?? 0));
      p.protectedUntil = t + 45;
      this.visual("hurt", p.x, p.y, 24);
    }
    this.recorder.poses.push({ x: p.x, y: p.y, aimRad: p.aimRad, dashing });
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.projectiles = this.projectiles.filter((b) => !b.spent);
    this.completedTicks++;
    if (p.hp <= 0) {
      this.state = "defeat";
      this.recorder = new EchoRecorder(this.pose, this.completedTicks);
      return;
    }
    if (this.completedTicks === this.options.durationTicks) {
      this.state = "victory";
      this.recorder = new EchoRecorder(this.pose, this.completedTicks);
      return;
    }
    if (this.completedTicks % 360 === 0) {
      const clip = this.recorder.seal(this.nextClipId++);
      this.echoManager.add(clip, this.id());
      this.recorder = new EchoRecorder(this.pose, this.completedTicks);
      this.visual("cycle", p.x, p.y, 40);
    }
    if (this.completedTicks === 3600 || this.completedTicks === 7200)
      this.state = "upgrade";
  }
}
