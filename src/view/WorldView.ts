import Phaser from "phaser";
import type { World } from "../core/World";
import { lerpAngle } from "../core/math/geometry";
import type { VisualEvent } from "../core/types";
interface Effect extends VisualEvent {
  age: number;
}
export class WorldView {
  private readonly art: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  private tags: Phaser.GameObjects.Text[];
  reduced = false;
  constructor(scene: Phaser.Scene) {
    this.art = scene.add.graphics();
    this.tags = [0, 1, 2].map(() =>
      scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#76ebd6",
        })
        .setOrigin(0.5),
    );
  }
  clear(): void {
    this.effects = [];
  }
  consume(events: readonly VisualEvent[]): void {
    for (const e of events)
      if (e.kind !== "shot" && this.effects.length < 150)
        this.effects.push({ ...e, age: 0 });
  }
  render(w: World, alpha: number, delta: number): void {
    const g = this.art;
    g.clear();
    g.fillStyle(0x101c24).fillRect(32, 32, 1216, 656);
    g.lineStyle(1, 0x1b2d36, 0.65);
    for (let x = 32; x <= 1248; x += 48) g.lineBetween(x, 32, x, 688);
    for (let y = 32; y <= 688; y += 48) g.lineBetween(32, y, 1248, y);
    g.lineStyle(1.5, 0x38585f).strokeRect(32, 32, 1216, 656);
    g.lineStyle(3, 0x67dac6);
    for (const x of [32, 1248])
      for (const y of [32, 688]) {
        g.lineBetween(x, y, x + (x === 32 ? 24 : -24), y);
        g.lineBetween(x, y, x, y + (y === 32 ? 24 : -24));
      }
    const t = w.completedTicks;
    // Pose-only historical paths never participate in collision.
    for (const [i, e] of w.echoes.entries()) {
      const x = e.previousPose.x + (e.pose.x - e.previousPose.x) * alpha,
        y = e.previousPose.y + (e.pose.y - e.previousPose.y) * alpha;
      if (!this.reduced) {
        g.lineStyle(1, 0x69dfcc, 0.14);
        g.beginPath();
        const end = t % 360;
        for (let j = Math.max(0, end - 70); j < end; j += 3) {
          const p = e.clip.poses[j];
          if (!p) continue;
          if (j === Math.max(0, end - 70)) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.strokePath();
      }
      g.fillStyle(0x62ddc7, 0.12).fillCircle(x, y, 14);
      g.lineStyle(2, 0x73efda, 0.6).strokeCircle(x, y, 14);
      g.lineBetween(
        x,
        y,
        x + Math.cos(e.pose.aimRad) * 23,
        y + Math.sin(e.pose.aimRad) * 23,
      );
      this.tags[i]
        ?.setText(String(i + 1))
        .setPosition(x, y - 24)
        .setVisible(true);
    }
    for (let i = w.echoes.length; i < 3; i++) this.tags[i]?.setVisible(false);
    for (const e of w.enemies) {
      if (t < e.activeAt) {
        const f = 1 - (e.activeAt - t) / 36;
        g.lineStyle(2, 0xff9c65, 0.3 + f * 0.6);
        if (e.kind === "charger") g.strokeRect(e.x - 19, e.y - 19, 38, 38);
        else if (e.kind === "shooter")
          g.strokeTriangle(
            e.x,
            e.y - 22,
            e.x - 20,
            e.y + 14,
            e.x + 20,
            e.y + 14,
          );
        else g.strokeCircle(e.x, e.y, 18 + 8 * (1 - f));
        continue;
      }
      if (e.phase === "windup") {
        g.lineStyle(e.kind === "charger" ? 5 : 2, 0xffa473, 0.5);
        g.lineBetween(
          e.x,
          e.y,
          e.x + Math.cos(e.angle) * (e.kind === "charger" ? 180 : 240),
          e.y + Math.sin(e.angle) * (e.kind === "charger" ? 180 : 240),
        );
      }
      const x = e.px + (e.x - e.px) * alpha,
        y = e.py + (e.y - e.py) * alpha;
      g.fillStyle(
        e.kind === "chaser"
          ? 0xe16b54
          : e.kind === "charger"
            ? 0xffa063
            : 0xe6bc72,
      );
      if (e.kind === "chaser") g.fillCircle(x, y, 16);
      else if (e.kind === "charger") {
        g.fillPoints(
          [
            { x, y: y - 21 },
            { x: x + 21, y },
            { x, y: y + 21 },
            { x: x - 21, y },
          ],
          true,
        );
      } else g.fillTriangle(x, y - 19, x - 18, y + 15, x + 18, y + 15);
      g.fillStyle(0x171c24).fillCircle(x, y, 5);
      if (e.hp < e.maxHp) {
        g.fillStyle(0x462f30).fillRect(x - 18, y - 30, 36, 3);
        g.fillStyle(0xf8b995).fillRect(
          x - 18,
          y - 30,
          (36 * e.hp) / e.maxHp,
          3,
        );
      }
    }
    for (const b of w.projectiles) {
      const color =
        b.source.kind === "enemy"
          ? 0xff8c64
          : b.source.kind === "echo"
            ? 0x68ead3
            : 0xf1f6eb;
      g.lineStyle(b.radius * 1.3, color).lineBetween(
        b.x - Math.cos(b.angle) * 9,
        b.y - Math.sin(b.angle) * 9,
        b.x,
        b.y,
      );
      g.fillStyle(color).fillCircle(b.x, b.y, b.radius * 0.8);
    }
    if (w.state !== "menu") {
      const p = w.player,
        x = p.px + (p.x - p.px) * alpha,
        y = p.py + (p.y - p.py) * alpha,
        angle = lerpAngle(
          w.recorder.poses.at(-2)?.aimRad ?? p.aimRad,
          p.aimRad,
          alpha,
        );
      const dashing = t < p.dashUntil,
        protectedNow = t < p.protectedUntil;
      g.fillStyle(0xffffff, protectedNow && t % 10 < 5 ? 0.4 : 1).fillCircle(
        x,
        y,
        14,
      );
      g.lineStyle(3, 0x91f9e1).lineBetween(
        x,
        y,
        x + 23 * Math.cos(angle),
        y + 23 * Math.sin(angle),
      );
      if (dashing) {
        g.lineStyle(2, 0xadf5e5, 0.7).strokeCircle(x, y, 22);
      }
      const phase = (t % 360) / 360;
      if (phase > 5.5 / 6 && !this.reduced) {
        g.lineStyle(2, 0x78ecd2, 0.5).beginPath();
        g.arc(x, y, 31, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
        g.strokePath();
      }
    }
    const visualDelta = w.running ? Math.min(delta, 100) : 0;
    for (const e of this.effects) {
      e.age += visualDelta;
      const f = e.age / (e.kind === "wave" ? 420 : 300);
      if (f >= 1) continue;
      const color =
        e.kind === "kill" ? 0xff9b75 : e.kind === "hurt" ? 0xff7973 : 0x7be5d0;
      if (e.kind === "wave") {
        g.lineStyle(this.reduced ? 1 : 3, color, (1 - f) * 0.65).strokeCircle(
          e.x,
          e.y,
          e.radius * (0.25 + f * 0.75),
        );
      } else if (!this.reduced) {
        g.lineStyle(2, color, (1 - f) * 0.65).strokeCircle(
          e.x,
          e.y,
          e.radius * (0.5 + f),
        );
      }
    }
    this.effects = this.effects.filter(
      (e) => e.age < (e.kind === "wave" ? 420 : 300),
    );
  }
}
