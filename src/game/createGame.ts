import Phaser from "phaser";
import { CONFIG } from "../core/config";
import { BootScene } from "./scenes/BootScene";
import { ArenaScene } from "./scenes/ArenaScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: "#0c1219",
    // No Arcade/Matter physics; later simulation belongs to the pure core.
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, ArenaScene],
  });
}
