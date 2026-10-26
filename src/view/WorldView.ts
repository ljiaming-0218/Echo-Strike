import Phaser from "phaser";
import { CONFIG as C, COVER } from "../core/config";
import type { World } from "../core/World";
import type { VisualEvent } from "../core/types";
interface Effect extends VisualEvent {
  age: number;
}
export class WorldView {
  private art: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[];
  private effects: Effect[] = [];
  reduced = false;
  constructor(scene: Phaser.Scene) {
    this.art = scene.add.graphics();
    this.labels = [0, 1, 2].map(() =>
      scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ff9b86",
        })
        .setOrigin(0.5),
    );
  }
  clear(): void {
    this.effects = [];
  }
  consume(events: readonly VisualEvent[]): void {
    for (const event of events)
      if (event.kind !== "shot" && this.effects.length < C.effectCap)
        this.effects.push({ ...event, age: 0 });
  }
  render(w: World, alpha: number, delta: number): void {
    const g = this.art;
    g.clear();
    g.fillStyle(0x12141e).fillRect(48, 48, 1184, 624);
    g.lineStyle(1, 0x252735, 0.5);
    for (let x = 64; x < 1232; x += 40) g.lineBetween(x, 48, x, 672);
    for (let y = 64; y < 672; y += 40) g.lineBetween(48, y, 1232, y);
    g.lineStyle(1, 0x3d3b50).strokeRect(48, 48, 1184, 624);
    g.lineStyle(1, 0x393546, 0.7)
      .strokeCircle(640, 360, 218)
      .strokeCircle(640, 360, 208);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const major = Math.round(a / (Math.PI / 24)) % 4 === 0;
      g.lineStyle(major ? 2 : 1, 0x7d668f, 0.45);
      g.lineBetween(
        640 + Math.cos(a) * 208,
        360 + Math.sin(a) * 208,
        640 + Math.cos(a) * (major ? 194 : 202),
        360 + Math.sin(a) * (major ? 194 : 202),
      );
    }
    const phase = w.roundTick / C.roundTicks;
    g.lineStyle(3, 0xb6a2f1, 0.6).beginPath();
    g.arc(640, 360, 218, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    g.strokePath();
    for (const r of COVER) {
      g.fillStyle(0x262533).fillRoundedRect(r.x, r.y, r.width, r.height, 3);
      g.lineStyle(1, 0x696079).strokeRoundedRect(
        r.x,
        r.y,
        r.width,
        r.height,
        3,
      );
      g.lineStyle(2, 0xb6a2f1, 0.5).lineBetween(
        r.x + 12,
        r.y + 5,
        r.x + r.width - 12,
        r.y + 5,
      );
    }
    if (w.state === "menu") {
      this.labels.forEach((label) => label.setVisible(false));
      return;
    }
    const open = w.gateOpen,
      x = w.exit.x,
      y = w.exit.y;
    g.lineStyle(1, open ? 0xd6e8ab : 0x545064).strokeCircle(x, y, 40);
    g.lineStyle(2, open ? 0xd6e8ab : 0x545064).strokeRect(
      x - 22,
      y - 22,
      44,
      44,
    );
    g.fillStyle(open ? 0xc9e49a : 0x545064, open ? 0.12 : 0.05).fillCircle(
      x,
      y,
      39,
    );
    g.lineStyle(3, 0xe5efce).beginPath();
    g.arc(
      x,
      y,
      46,
      -Math.PI / 2,
      -Math.PI / 2 + (w.exitHold / C.exitHoldTicks) * Math.PI * 2,
    );
    g.strokePath();
    for (const r of w.relays) {
      if (r.hp <= 0) {
        g.lineStyle(1, 0x77716e, 0.4).strokeRect(r.x - 9, r.y - 9, 18, 18);
        continue;
      }
      g.fillStyle(0xe6be78, 0.1).fillCircle(r.x, r.y, 31);
      g.lineStyle(2, 0xe6be78).strokePoints(
        [
          { x: r.x, y: r.y - 23 },
          { x: r.x + 23, y: r.y },
          { x: r.x, y: r.y + 23 },
          { x: r.x - 23, y: r.y },
        ],
        true,
      );
      g.fillStyle(0xf2ce87).fillCircle(r.x, r.y, 5);
      g.lineStyle(2, 0xe6be78, 0.8).lineBetween(
        r.x - 15,
        r.y + 34,
        r.x - 15 + (30 * r.hp) / C.relayHP,
        r.y + 34,
      );
    }
    for (const [i, e] of w.echoes.entries()) {
      if (e.hp <= 0) {
        this.labels[i]?.setVisible(false);
        continue;
      }
      const ex = e.previousPose.x + (e.pose.x - e.previousPose.x) * alpha,
        ey = e.previousPose.y + (e.pose.y - e.previousPose.y) * alpha;
      if (!this.reduced) {
        g.lineStyle(1, 0xf88a7e, 0.25);
        g.beginPath();
        const local = e.lastLocalTick;
        let first = true;
        for (let n = Math.max(0, local - 55); n < local; n += 3) {
          const p = e.clip.poses[n];
          if (!p) continue;
          if (first) {
            g.moveTo(p.x, p.y);
            first = false;
          } else g.lineTo(p.x, p.y);
        }
        g.strokePath();
      }
      g.fillStyle(0xff8278, 0.18).fillCircle(ex, ey, 14);
      g.lineStyle(2, 0xff8e82).strokeCircle(ex, ey, 14);
      g.lineStyle(3, 0xffae9a).lineBetween(
        ex + Math.cos(e.pose.aimRad) * 9,
        ey + Math.sin(e.pose.aimRad) * 9,
        ex + Math.cos(e.pose.aimRad) * 26,
        ey + Math.sin(e.pose.aimRad) * 26,
      );
      g.lineStyle(2, 0xff8e82).lineBetween(
        ex - 15,
        ey + 23,
        ex - 15 + (30 * e.hp) / C.echoHP,
        ey + 23,
      );
      this.labels[i]
        ?.setText(`过去 #${e.clip.round}`)
        .setPosition(ex, ey - 25)
        .setVisible(true);
    }
    for (let i = w.echoes.length; i < 3; i++) this.labels[i]?.setVisible(false);
    for (const b of w.projectiles) {
      const color = b.source.kind === "echo" ? 0xff776d : 0xf2ebd8;
      g.lineStyle(3, color).lineBetween(
        b.x - Math.cos(b.angle) * 12,
        b.y - Math.sin(b.angle) * 12,
        b.x,
        b.y,
      );
      g.fillStyle(color).fillCircle(b.x, b.y, 3);
    }
    const p = w.player,
      px = p.px + (p.x - p.px) * alpha,
      py = p.py + (p.y - p.py) * alpha;
    g.fillStyle(
      0xf6efdf,
      w.completedTicks < p.protectedUntil && w.completedTicks % 8 < 4
        ? 0.45
        : 1,
    ).fillCircle(px, py, 14);
    g.lineStyle(4, 0xf4ebd6).lineBetween(
      px,
      py,
      px + 25 * Math.cos(p.aimRad),
      py + 25 * Math.sin(p.aimRad),
    );
    g.fillStyle(0x191a25).fillCircle(
      px + 5 * Math.cos(p.aimRad),
      py + 5 * Math.sin(p.aimRad),
      4,
    );
    g.lineStyle(1, 0xc5b4fb, 0.8).strokeCircle(px, py, 21);
    if (w.completedTicks < p.dashUntil)
      g.lineStyle(2, 0xe1d1ff).strokeCircle(px, py, 29);
    // Small aim reticle remains readable without relying on colour alone.
    const rx = px + Math.cos(p.aimRad) * 90,
      ry = py + Math.sin(p.aimRad) * 90;
    g.lineStyle(1, 0xf7edda, 0.5).strokeCircle(rx, ry, 5);
    for (const e of this.effects) {
      if (w.running) e.age += Math.min(delta, 100);
      const f = e.age / 350;
      if (f >= 1) continue;
      if (e.kind === "wave") {
        g.lineStyle(
          3,
          e.echo ? 0xff8c7c : 0xc6b1fa,
          (1 - f) * 0.7,
        ).strokeCircle(e.x, e.y, e.radius * (0.3 + 0.7 * f));
      } else if (!this.reduced) {
        g.lineStyle(
          2,
          e.kind === "hurt" ? 0xff786e : e.echo ? 0xff8c7c : 0xf3cf8b,
          1 - f,
        ).strokeCircle(e.x, e.y, e.radius * (0.3 + f));
      }
    }
    this.effects = this.effects.filter((e) => e.age < 350);
  }
}
