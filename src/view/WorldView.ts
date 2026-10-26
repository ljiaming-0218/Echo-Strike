import Phaser from "phaser";
import { CONFIG as C, COVER } from "../core/config";
import type { World } from "../core/World";
import type { Pose, VisualEvent } from "../core/types";
interface Effect extends VisualEvent {
  age: number;
  seed: number;
}
export class WorldView {
  private art: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[];
  private actors: Phaser.GameObjects.Image[] = [];
  private afterimages: Phaser.GameObjects.Image[] = [];
  private hasFloor = false;
  private effects: Effect[] = [];
  private serial = 0;
  reduced = false;
  constructor(scene: Phaser.Scene) {
    this.hasFloor = scene.textures.exists("chrono-lab");
    if (this.hasFloor)
      scene.add
        .image(640, 360, "chrono-lab")
        .setDisplaySize(1280, 720)
        .setDepth(-10);
    this.art = scene.add.graphics().setDepth(1);
    this.labels = [0, 1, 2].map(() =>
      scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#ffb09e",
          backgroundColor: "#111520c9",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(20),
    );
    if (scene.textures.exists("chrono-agent")) {
      this.actors = [0, 1, 2, 3].map(() =>
        scene.add
          .image(0, 0, "chrono-agent")
          .setOrigin(0.46, 0.5)
          .setDisplaySize(54, 54)
          .setDepth(10)
          .setVisible(false),
      );
      this.afterimages = [0, 1, 2].map(() =>
        scene.add
          .image(0, 0, "chrono-agent")
          .setOrigin(0.46, 0.5)
          .setDisplaySize(54, 54)
          .setTint(0xff8b83)
          .setAlpha(0.16)
          .setDepth(3)
          .setVisible(false),
      );
    }
  }
  clear(): void {
    this.effects = [];
    this.actors.forEach((a) => a.setVisible(false));
    this.afterimages.forEach((a) => a.setVisible(false));
  }
  consume(events: readonly VisualEvent[]): void {
    for (const event of events)
      if (this.effects.length < C.effectCap) {
        this.effects.push({ ...event, age: 0, seed: this.serial });
        this.serial = (this.serial + 1) % 1000;
      }
  }
  private glow(
    x: number,
    y: number,
    radius: number,
    color: number,
    strength = 0.2,
  ): void {
    for (let i = 3; i >= 1; i--)
      this.art
        .fillStyle(color, strength / (i * 3))
        .fillCircle(x, y, (radius * i) / 2);
  }
  private actor(
    index: number,
    pose: Pose,
    x: number,
    y: number,
    hostile: boolean,
    alpha = 1,
  ): void {
    const g = this.art;
    g.fillStyle(0x02040a, 0.65).fillEllipse(x + 3, y + 8, 33, 15);
    g.lineStyle(1.4, hostile ? 0xff9b83 : 0xb6cafa, 0.85).strokeCircle(
      x,
      y,
      17,
    );
    const image = this.actors[index];
    if (image) {
      image
        .setVisible(true)
        .setPosition(x, y)
        .setRotation(pose.aimRad)
        .setAlpha(alpha);
      if (hostile) image.setTint(0xff9c8f);
      else image.clearTint();
    } else {
      g.fillStyle(
        hostile ? 0xef8c80 : 0xf3ecda,
        hostile ? 0.7 : alpha,
      ).fillCircle(x, y, 14);
      g.lineStyle(3, 0xf4dfcf).lineBetween(
        x,
        y,
        x + 23 * Math.cos(pose.aimRad),
        y + 23 * Math.sin(pose.aimRad),
      );
    }
  }
  render(w: World, alpha: number, delta: number): void {
    const g = this.art;
    g.clear();
    this.actors.forEach((a) => a.setVisible(false));
    this.afterimages.forEach((a) => a.setVisible(false));
    if (!this.hasFloor) {
      g.fillStyle(0x121a28).fillRect(0, 0, 1280, 720);
      g.lineStyle(1, 0x2c364e, 0.5);
      for (let x = 48; x < 1232; x += 48) g.lineBetween(x, 48, x, 672);
      for (let y = 48; y < 672; y += 48) g.lineBetween(48, y, 1232, y);
    }
    const phase = w.roundTick / C.roundTicks,
      time = w.completedTicks / 60,
      roundColor =
        [0xb8a1ff, 0x82c6ff, 0xe4a2ed, 0x79e1d2, 0xffb788, 0xff8d9a][
          w.round - 1
        ] ?? 0xb8a1ff;
    // These rings and inset conduits are floor markings, never extra obstacles.
    g.lineStyle(2, roundColor, 0.38).strokeCircle(640, 360, 205);
    g.lineStyle(4, phase > 0.75 ? 0xff927f : roundColor, 0.9).beginPath();
    g.arc(640, 360, 214, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    g.strokePath();
    if (!this.reduced) {
      g.lineStyle(1, roundColor, 0.15).lineBetween(
        640,
        360,
        640 + Math.cos(time * 0.25) * 190,
        360 + Math.sin(time * 0.25) * 190,
      );
      this.glow(640, 360, 22, roundColor, 0.12);
    }
    for (const r of COVER) {
      g.fillStyle(0x02040b, 0.7).fillRoundedRect(
        r.x + 4,
        r.y + 7,
        r.width,
        r.height,
        4,
      );
      g.fillStyle(0x192538).fillRoundedRect(r.x, r.y, r.width, r.height, 4);
      g.fillStyle(0x2d3c54).fillRect(
        r.x + 3,
        r.y + 3,
        r.width - 6,
        r.height * 0.45,
      );
      g.lineStyle(1, 0x667a98, 0.8).strokeRoundedRect(
        r.x,
        r.y,
        r.width,
        r.height,
        4,
      );
      g.lineStyle(2, roundColor, 0.85).lineBetween(
        r.x + 12,
        r.y + 5,
        r.x + r.width - 12,
        r.y + 5,
      );
      g.fillStyle(0x8999ac);
      for (const x of [r.x + 7, r.x + r.width - 7])
        for (const y of [r.y + 7, r.y + r.height - 7]) g.fillCircle(x, y, 1.6);
      for (let i = 0; i < 4; i++)
        g.lineStyle(2, 0x0c1729, 0.8).lineBetween(
          r.x + 36 + i * 13,
          r.y + 17,
          r.x + 30 + i * 13,
          r.y + 25,
        );
    }
    if (w.state === "menu") {
      this.labels.forEach((l) => l.setVisible(false));
      return;
    }
    const open = w.gateOpen,
      x = w.exit.x,
      y = w.exit.y,
      gate = open ? 0x9ff7d2 : 0x6f7196;
    g.fillStyle(0x050b15, 0.75).fillEllipse(x, y + 12, 88, 36);
    this.glow(x, y, 30, gate, open ? 0.22 : 0.07);
    g.lineStyle(5, 0x27334a).strokeCircle(x, y, 38);
    g.lineStyle(2, gate, open ? 1 : 0.6)
      .strokeCircle(x, y, 40)
      .strokeCircle(x, y, 29);
    for (let i = 0; i < 4; i++) {
      const a = time * 0.6 + (i * Math.PI) / 2;
      g.lineStyle(4, gate, open ? 0.9 : 0.3).beginPath();
      g.arc(x, y, 35, a, a + 0.3);
      g.strokePath();
    }
    if (!open) {
      g.lineStyle(2, 0x9996b1, 0.8).strokeRoundedRect(x - 9, y - 3, 18, 15, 2);
      g.beginPath();
      g.arc(x, y - 3, 6, Math.PI, Math.PI * 2);
      g.strokePath();
    } else {
      g.lineStyle(2, 0xe0fff0)
        .lineBetween(x - 10, y + 3, x, y - 7)
        .lineBetween(x, y - 7, x + 10, y + 3);
    }
    g.lineStyle(4, 0xe6fff0).beginPath();
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
        g.lineStyle(2, 0x665a61, 0.6).strokeCircle(r.x, r.y + 5, 18);
        g.fillStyle(0x211e2a).fillCircle(r.x, r.y + 5, 14);
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1;
          g.fillStyle(0xa48564, 0.5).fillTriangle(
            r.x + Math.cos(a) * 8,
            r.y + Math.sin(a) * 8,
            r.x + Math.cos(a + 0.3) * 16,
            r.y + Math.sin(a + 0.3) * 16,
            r.x + Math.cos(a - 0.4) * 17,
            r.y + Math.sin(a - 0.4) * 17,
          );
        }
        continue;
      }
      g.fillStyle(0x030611, 0.8).fillEllipse(r.x + 3, r.y + 14, 51, 22);
      g.fillStyle(0x343341).fillEllipse(r.x, r.y + 10, 44, 20);
      g.lineStyle(1, 0xb5925c, 0.8).strokeEllipse(r.x, r.y + 10, 44, 20);
      this.glow(r.x, r.y, 23, 0xffc565, 0.2);
      const bob = this.reduced ? 0 : Math.sin(time * 2.3 + r.id) * 2;
      const top = r.y - 24 + bob,
        bottom = r.y + 15 + bob;
      g.fillStyle(r.hp < C.relayHP ? 0xffe7a7 : 0xf4c06c).fillTriangle(
        r.x,
        top,
        r.x - 17,
        r.y - 1 + bob,
        r.x,
        bottom,
      );
      g.fillStyle(0xb87a45).fillTriangle(
        r.x,
        top,
        r.x + 17,
        r.y - 1 + bob,
        r.x,
        bottom,
      );
      g.fillStyle(0xffe6ae).fillTriangle(
        r.x,
        top,
        r.x - 17,
        r.y - 1 + bob,
        r.x - 3,
        r.y - 7 + bob,
      );
      g.lineStyle(1, 0xffebc1, 0.8).strokePoints(
        [
          { x: r.x, y: top },
          { x: r.x + 17, y: r.y - 1 + bob },
          { x: r.x, y: bottom },
          { x: r.x - 17, y: r.y - 1 + bob },
        ],
        true,
      );
      g.fillStyle(0xffdfa0).fillCircle(r.x, r.y - 3 + bob, 3);
      g.lineStyle(3, 0x382d28).lineBetween(
        r.x - 17,
        r.y + 32,
        r.x + 17,
        r.y + 32,
      );
      g.lineStyle(2, 0xffd791).lineBetween(
        r.x - 17,
        r.y + 32,
        r.x - 17 + (34 * r.hp) / C.relayHP,
        r.y + 32,
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
        const last = e.lastLocalTick;
        g.lineStyle(2, 0xf28e89, 0.22);
        g.beginPath();
        let first = true;
        for (let n = Math.max(0, last - 36); n < last; n += 3) {
          const p = e.clip.poses[n];
          if (!p) continue;
          if (first) {
            g.moveTo(p.x, p.y);
            first = false;
          } else g.lineTo(p.x, p.y);
        }
        g.strokePath();
        const old = e.clip.poses[Math.max(0, last - 7)];
        if (old)
          this.afterimages[i]
            ?.setVisible(true)
            .setPosition(old.x, old.y)
            .setRotation(old.aimRad);
      }
      this.glow(ex, ey, 17, 0xf37774, 0.15);
      this.actor(i + 1, e.pose, ex, ey, true, 0.92);
      g.lineStyle(3, 0x392331).lineBetween(ex - 16, ey + 27, ex + 16, ey + 27);
      g.lineStyle(2, 0xffa18f).lineBetween(
        ex - 16,
        ey + 27,
        ex - 16 + (32 * e.hp) / C.echoHP,
        ey + 27,
      );
      this.labels[i]
        ?.setText(`过去 #${e.clip.round}`)
        .setPosition(ex, ey - 31)
        .setVisible(true);
    }
    for (let i = w.echoes.length; i < 3; i++) this.labels[i]?.setVisible(false);
    for (const b of w.projectiles) {
      const color = b.source.kind === "echo" ? 0xff7e72 : 0xe6eaff;
      this.glow(b.x, b.y, 6, color, 0.22);
      g.lineStyle(5, color, 0.15).lineBetween(
        b.x - Math.cos(b.angle) * 18,
        b.y - Math.sin(b.angle) * 18,
        b.x,
        b.y,
      );
      g.lineStyle(2, color).lineBetween(
        b.x - Math.cos(b.angle) * 10,
        b.y - Math.sin(b.angle) * 10,
        b.x,
        b.y,
      );
      g.fillStyle(0xfff5e8).fillCircle(b.x, b.y, 2);
    }
    const p = w.player,
      px = p.px + (p.x - p.px) * alpha,
      py = p.py + (p.y - p.py) * alpha;
    this.actor(
      0,
      w.pose,
      px,
      py,
      false,
      w.completedTicks < p.protectedUntil && w.completedTicks % 8 < 4 ? 0.5 : 1,
    );
    if (w.completedTicks < p.dashUntil && !this.reduced) {
      for (let i = 0; i < 3; i++) {
        const d = 20 + i * 9;
        g.lineStyle(2, 0xc0b3ff, 0.5 - i * 0.12).lineBetween(
          px - Math.cos(p.dashAngle) * d,
          py - Math.sin(p.dashAngle) * d,
          px - Math.cos(p.dashAngle) * (d + 11),
          py - Math.sin(p.dashAngle) * (d + 11),
        );
      }
    }
    const rx = px + Math.cos(p.aimRad) * 90,
      ry = py + Math.sin(p.aimRad) * 90;
    g.lineStyle(1, 0xeddfd3, 0.6).strokeCircle(rx, ry, 5);
    g.lineBetween(rx - 9, ry, rx - 6, ry)
      .lineBetween(rx + 6, ry, rx + 9, ry)
      .lineBetween(rx, ry - 9, rx, ry - 6)
      .lineBetween(rx, ry + 6, rx, ry + 9);
    for (const e of this.effects) {
      if (w.running) e.age += Math.min(delta, 100);
      const duration =
          e.kind === "shot"
            ? 85
            : e.kind === "hit"
              ? 190
              : e.kind === "wave"
                ? 440
                : 400,
        f = e.age / duration;
      if (f >= 1) continue;
      const color =
        e.kind === "hurt"
          ? 0xff746b
          : e.echo
            ? 0xffa18b
            : e.kind === "shot"
              ? 0xe8d8ff
              : 0xffd79b;
      if (e.kind === "wave") {
        g.lineStyle(4, color, (1 - f) * 0.8).strokeCircle(
          e.x,
          e.y,
          e.radius * (0.2 + 0.8 * f),
        );
        g.lineStyle(1, color, (1 - f) * 0.35).strokeCircle(
          e.x,
          e.y,
          e.radius * (0.15 + 0.7 * f),
        );
      } else if (e.kind === "shot") {
        this.glow(e.x, e.y, 10, color, (1 - f) * 0.3);
        g.fillStyle(color, 1 - f).fillCircle(e.x, e.y, 4 * (1 - f));
      } else {
        if (!this.reduced) {
          const count = e.kind === "kill" ? 9 : 5;
          for (let i = 0; i < count; i++) {
            const a = i * 2.4 + e.seed,
              d = 8 + f * (e.kind === "kill" ? 42 : 24);
            g.lineStyle(
              e.kind === "kill" ? 3 : 2,
              color,
              (1 - f) * 0.9,
            ).lineBetween(
              e.x + Math.cos(a) * d,
              e.y + Math.sin(a) * d,
              e.x + Math.cos(a) * (d + 4),
              e.y + Math.sin(a) * (d + 4),
            );
          }
        }
        g.lineStyle(
          e.kind === "kill" ? 3 : 1.5,
          color,
          (1 - f) * 0.65,
        ).strokeCircle(e.x, e.y, e.radius * (0.3 + f));
      }
    }
    this.effects = this.effects.filter(
      (e) =>
        e.age <
        (e.kind === "shot"
          ? 85
          : e.kind === "hit"
            ? 190
            : e.kind === "wave"
              ? 440
              : 400),
    );
  }
}
