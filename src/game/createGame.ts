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
    backgroundColor: "#0e1018",
    // No Arcade/Matter physics; later simulation belongs to the pure core.
    // DisplayMode performs FIT sizing in local CSS coordinates, including rotated
    // embedded-browser layouts. The simulation and render buffer remain 1280×720.
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [BootScene, ArenaScene],
  });
}
