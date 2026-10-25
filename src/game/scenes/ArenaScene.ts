import Phaser from "phaser";
import { WorldView } from "../../view/WorldView";
import { App } from "../../ui/App";
export class ArenaScene extends Phaser.Scene {
  constructor() {
    super("Arena");
  }
  create(): void {
    const view = new WorldView(this),
      app = new App(view);
    app.mount();
    const update = (time: number, delta: number) =>
      app.frame(time, this.game.loop.rawDelta || delta);
    this.events.on(Phaser.Scenes.Events.UPDATE, update);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, update);
      app.destroy();
    });
  }
}
