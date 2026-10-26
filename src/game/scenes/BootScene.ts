import Phaser from "phaser";
import { DisplayMode } from "../../adapters/DisplayMode";
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload(): void {
    new DisplayMode(document.querySelector<HTMLElement>("#viewport")!);
    this.add
      .text(640, 315, "CHRONO HUNT", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ddcafa",
      })
      .setOrigin(0.5);
    const progress = this.add.graphics();
    this.add
      .text(640, 395, "正在接入时间实验室…", {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: "#aaa5bc",
      })
      .setOrigin(0.5);
    this.load.on("progress", (value: number) => {
      progress.clear();
      progress.fillStyle(0x30243e).fillRoundedRect(440, 362, 400, 4, 2);
      progress
        .fillStyle(0xc4a7f1)
        .fillRoundedRect(440, 362, Math.max(4, 400 * value), 4, 2);
    });
    this.load.image(
      "chrono-lab",
      import.meta.env.BASE_URL + "assets/chrono-lab.webp",
    );
    this.load.image(
      "chrono-agent",
      import.meta.env.BASE_URL + "assets/chrono-agent.webp",
    );
  }
  create(): void {
    this.scene.start("Arena");
  }
}
