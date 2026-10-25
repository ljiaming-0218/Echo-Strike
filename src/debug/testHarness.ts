import type { App } from "../ui/App";
import { idleInput } from "../core/types";
export function attach(app: App): () => void {
  const api = {
    snapshot: () => ({
      tick: app.world.completedTicks,
      state: app.world.state,
      status: app.world.status,
      hp: app.world.player.hp,
      player: { x: app.world.player.x, y: app.world.player.y },
      echoes: app.world.echoes.map((e) => e.clip.clipId),
      enemies: app.world.enemies.length,
      bullets: app.world.projectiles.length,
      stats: { ...app.world.stats },
      events: app.world.recorder.events.length,
    }),
    advance: (n: number) => {
      for (let i = 0; i < n; i++) app.world.step(idleInput());
      app.renderUI();
    },
    survive: () => {
      app.world.player.hp = 1e9;
    },
    defeat: () => {
      app.world.player.hp = 1;
      app.world.player.protectedUntil = 0;
      app.world.spawnEnemy(
        "charger",
        app.world.player.x,
        app.world.player.y,
        0,
      );
      app.world.step(idleInput());
      app.renderUI();
    },
  };
  Object.assign(window, { __ECHO_TEST__: api });
  return () => {
    Reflect.deleteProperty(window, "__ECHO_TEST__");
  };
}
