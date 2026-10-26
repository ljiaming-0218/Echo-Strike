import type { App } from "../ui/App";
import { idleInput } from "../core/types";
export function attach(app: App): () => void {
  const api = {
    snapshot: () => ({
      tick: app.world.completedTicks,
      roundTick: app.world.roundTick,
      round: app.world.round,
      state: app.world.state,
      status: app.world.status,
      hp: app.world.player.hp,
      player: { x: app.world.player.x, y: app.world.player.y },
      relays: app.world.relays.map((r) => ({ x: r.x, y: r.y, hp: r.hp })),
      echoes: app.world.echoes.map((e) => ({ round: e.clip.round, hp: e.hp })),
      projectiles: app.world.projectiles.length,
      shots: app.world.stats.shots,
      events: app.world.recorder.events.length,
    }),
    advance: (n: number) => {
      for (let i = 0; i < n; i++) app.world.step(idleInput());
      app.renderUI();
    },
    prepareExit: () => {
      app.world.relays.forEach((r) => (r.hp = 0));
      app.world.echoes.forEach((e) => (e.hp = 0));
      app.world.player.x = app.world.exit.x;
      app.world.player.y = app.world.exit.y;
      app.world.roundTick = Math.max(180, app.world.roundTick);
    },
    defeat: () => {
      app.world.player.hp = 0;
      app.world.step(idleInput());
      app.renderUI();
    },
  };
  Object.assign(window, { __CHRONO_TEST__: api });
  return () => {
    Reflect.deleteProperty(window, "__CHRONO_TEST__");
  };
}
