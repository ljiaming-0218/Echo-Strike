import { World } from "../core/World";
import { FixedStepClock } from "../core/clock/FixedStepClock";
import { InputRouter } from "../adapters/InputRouter";
import { AudioView } from "../view/AudioView";
import type { WorldView } from "../view/WorldView";
import type { Upgrade } from "../core/types";
import { loadSettings, saveSettings } from "./settings";

const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${name === "pause" ? '<path d="M8 5v14M16 5v14"/>' : name === "dash" ? '<path d="m13 3-8 11h7l-1 7 8-12h-7l1-6Z"/>' : name === "wave" ? '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>' : '<path d="M4 7h16M4 12h16M4 17h16"/>'}</svg>`;
const upgrades = [
  ["damage", "01", "火力强化", "基础枪伤害 +3", "留下更有力的历史弹道。"],
  ["speed", "02", "轻量驱动", "移动速度 +10%", "用更灵活的走位，重绘火线。"],
  ["wave", "03", "震荡扩容", "震荡波半径 +20", "让历史中的爆发覆盖更远。"],
] as const;
export class App {
  world = new World();
  readonly clock = new FixedStepClock();
  readonly settings = loadSettings();
  readonly audio = new AudioView();
  readonly input: InputRouter;
  private root = document.createElement("div");
  private overlay!: HTMLElement;
  private hud!: HTMLElement;
  private previousScreen = "";
  private previousTick = -1;
  private echoListKey = "";
  private discardDelta = true;
  private disposers: (() => void)[] = [];
  private testCleanup: (() => void) | undefined;
  constructor(private readonly view: WorldView) {
    this.input = new InputRouter(
      () => this.world.running,
      () => this.togglePause(),
    );
  }
  mount(): void {
    this.root.id = "interface";
    this.root.innerHTML = `<header id="hud" class="hud" hidden><div class="hud-brand">ECHO<span>RUSH</span><small>回响特攻</small></div><div class="health"><div><span>生命值</span><b id="hp-value">100 <i>/ 100</i></b></div><div class="track"><div id="hp-fill"></div></div></div><div class="time"><b id="time-value">00:00</b><span> / 03:00</span><small id="wave-stage">第一强度段</small></div><button class="icon-button" id="pause" aria-label="暂停游戏">${icon("pause")}</button></header>
      <aside id="echo-hud" class="echo-hud" hidden><div class="echo-heading"><span>回响记录</span><b id="echo-count">0 / 3</b></div><div class="track echo-track"><div id="loop-fill"></div></div><p id="loop-label">本段 0.0 / 6.0 秒</p><div id="echo-list"></div></aside>
      <div id="kills" class="kills" hidden><b id="kills-value">0</b><span>击杀</span></div>
      <footer id="controls" class="controls" hidden><div class="movement"><div id="joystick" class="joystick" aria-label="移动摇杆"><div id="stick-knob"></div></div><span><kbd>W A S D</kbd> / 方向键移动</span></div><p class="auto-note">自动瞄准 · 把敌人引入过去的火线</p><div class="skill-group"><button id="dash" class="skill" aria-label="冲刺"><span class="skill-icon">${icon("dash")}</span><span><b>冲刺</b><small id="dash-cd">SPACE · 就绪</small></span></button><button id="wave" class="skill" aria-label="震荡波"><span class="skill-icon">${icon("wave")}</span><span><b>震荡波</b><small id="wave-cd">Q · 就绪</small></span></button></div></footer>
      <section id="overlay" class="overlay" aria-live="polite"></section>`;
    document.body.append(this.root);
    if (import.meta.env.DEV) {
      const debug = document.createElement("div");
      debug.id = "debug";
      this.root.append(debug);
    }
    this.overlay = this.el("overlay");
    this.hud = this.el("hud");
    this.el("pause").onclick = () => this.togglePause();
    this.input.bindTouch(
      this.el("joystick"),
      this.el("stick-knob"),
      this.el("dash"),
      this.el("wave"),
    );
    const on = (target: EventTarget, type: string, fn: () => void) => {
      target.addEventListener(type, fn);
      this.disposers.push(() => target.removeEventListener(type, fn));
    };
    on(window, "blur", () => this.freeze("hidden"));
    on(document, "visibilitychange", () => {
      if (document.hidden) this.freeze("hidden");
      else this.world.clearReason("hidden");
    });
    on(window, "focus", () => {
      if (!document.hidden) this.world.clearReason("hidden");
    });
    on(window, "resize", () => this.orientation());
    this.orientation();
    this.renderUI();
    if (import.meta.env.MODE === "e2e")
      void import("../debug/testHarness").then(({ attach }) => {
        this.testCleanup = attach(this);
      });
  }
  private el(id: string): HTMLElement {
    const e = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!e) throw Error(`Missing UI ${id}`);
    return e;
  }
  private freeze(
    reason: "manual" | "hidden" | "portrait" | "performance",
  ): void {
    this.world.pause(reason);
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.audio.pause();
  }
  private orientation(): void {
    const portrait =
      window.innerHeight > window.innerWidth &&
      matchMedia("(pointer: coarse)").matches;
    if (portrait) this.freeze("portrait");
    else this.world.clearReason("portrait");
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.renderUI();
  }
  private togglePause(): void {
    if (this.world.running) this.freeze("manual");
    else if (this.world.state === "running") this.resume();
    this.renderUI();
  }
  private resume(): void {
    this.world.resume();
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    if (this.world.running) void this.audio.unlock();
    this.renderUI();
  }
  start(): void {
    this.world = new World();
    this.world.start();
    this.view.clear();
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.previousScreen = "";
    this.previousTick = -1;
    this.echoListKey = "reset";
    this.orientation();
    void this.audio.unlock();
    this.renderUI();
  }
  private menu(): void {
    this.world = new World();
    this.input.clear();
    this.clock.reset();
    this.view.clear();
    this.audio.pause();
    this.previousScreen = "";
    this.renderUI();
  }
  frame(_time: number, delta: number): void {
    this.view.reduced = this.settings.reduced;
    this.audio.volume = this.settings.volume;
    let alpha = 1;
    if (this.world.running) {
      if (this.discardDelta) {
        delta = 0;
        this.discardDelta = false;
      }
      alpha = this.clock.advanceElapsed(
        delta,
        () => {
          this.world.step(this.input.sample());
          this.view.consume(this.world.visuals);
          this.audio.play(this.world.visuals, this.world.completedTicks);
          return this.world.running;
        },
        () => this.freeze("performance"),
      );
    } else {
      this.clock.reset();
      this.discardDelta = true;
    }
    this.view.render(this.world, alpha, delta);
    this.renderUI();
  }
  private settingMarkup(): string {
    return `<div class="settings"><label>音量 <input id="volume" aria-label="音量" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}"></label><label class="check"><input id="reduced" type="checkbox" ${this.settings.reduced ? "checked" : ""}>减少特效</label></div>`;
  }
  private bindSettings(): void {
    const volume = this.overlay.querySelector<HTMLInputElement>("#volume"),
      reduced = this.overlay.querySelector<HTMLInputElement>("#reduced");
    if (volume)
      volume.oninput = () => {
        this.settings.volume = Number(volume.value);
        saveSettings(this.settings);
      };
    if (reduced)
      reduced.onchange = () => {
        this.settings.reduced = reduced.checked;
        saveSettings(this.settings);
      };
  }
  renderUI(): void {
    const w = this.world,
      active = w.state !== "menu";
    this.hud.hidden = !active;
    for (const id of ["echo-hud", "kills", "controls"])
      this.el(id).hidden = !active;
    if (w.completedTicks !== this.previousTick || w.completedTicks === 0) {
      this.previousTick = w.completedTicks;
      if (import.meta.env.DEV) {
        const debug = this.root.querySelector("#debug");
        if (debug)
          debug.textContent = `tick ${w.completedTicks} / local ${w.completedTicks % 360} · ${w.status} [${[...w.pauses].join(",")}] · clips ${w.echoes.map((e) => `${e.clip.clipId}:${e.loopSerial}/${e.eventCursor}`).join(" ")} · enemies ${w.enemies.length} · bullets ${w.projectiles.length} · rejected ${w.stats.rejectedPlayer}/${w.stats.rejectedEcho}/${w.stats.rejectedEnemy}`;
      }
      const seconds = w.completedTicks / 60,
        minutes = Math.floor(seconds / 60),
        second = Math.floor(seconds % 60);
      this.el("time-value").textContent =
        `${String(minutes).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
      this.el("hp-value").innerHTML = `${w.player.hp} <i>/ 100</i>`;
      this.el("hp-fill").style.width =
        `${Math.max(0, Math.min(100, w.player.hp))}%`;
      this.el("echo-count").textContent = `${w.echoes.length} / 3`;
      this.el("loop-fill").style.width = `${(w.completedTicks % 360) / 3.6}%`;
      this.el("loop-label").textContent =
        `本段 ${((w.completedTicks % 360) / 60).toFixed(1)} / 6.0 秒`;
      const echoKey = w.echoes.map((e) => e.id).join(",");
      if (echoKey !== this.echoListKey) {
        this.echoListKey = echoKey;
        this.el("echo-list").innerHTML = [...w.echoes]
          .reverse()
          .map(
            (e, i) =>
              `<div class="echo-row"><span class="echo-number">${w.echoes.length - i}</span><span>${["最近", "较早", "最早"][i]} <small>第 ${e.clip.clipId + 1} 段</small></span><span class="echo-signal">${"ı".repeat(7 - i * 2)}</span></div>`,
          )
          .join("");
      }
      this.el("kills-value").textContent = String(w.stats.kills);
      this.el("wave-stage").textContent =
        seconds < 60
          ? "第一强度段"
          : seconds < 120
            ? "第二强度段"
            : "最终强度段";
      for (const [id, next, key] of [
        ["dash", w.player.nextDash, "SPACE"],
        ["wave", w.player.nextWave, "Q"],
      ] as const) {
        const left = Math.max(0, next - w.completedTicks) / 60;
        this.el(`${id}-cd`).textContent =
          left > 0 ? `${left.toFixed(1)} 秒` : `${key} · 就绪`;
        this.el(id).classList.toggle("cooling", left > 0);
      }
    }
    const portrait =
      innerHeight > innerWidth && matchMedia("(pointer: coarse)").matches;
    const screen = portrait ? "portrait" : w.status;
    const screenKey = screen + ":" + [...w.pauses].sort().join(",");
    if (screenKey === this.previousScreen) return;
    this.previousScreen = screenKey;
    this.overlay.hidden = screen === "running";
    if (screen === "running") return;
    this.audio.pause();
    this.input.clear();
    if (screen === "portrait") {
      this.overlay.innerHTML =
        '<div class="panel orientation-panel"><div class="rotate-phone"></div><h1>请横屏后继续</h1><p>旋转手机，让过去的自己有更多发挥空间。</p></div>';
    } else if (screen === "menu") {
      this.overlay.innerHTML = `<div class="panel menu-panel"><div class="brand-symbol" aria-hidden="true"><span></span><span></span><span></span></div><h1>ECHO<span>RUSH</span></h1><h2>回响特攻</h2><p class="intro">用现在的走位，布置过去的火力。</p><div class="rules"><div><b>6<span>秒</span></b><p>记录你的行动</p></div><span class="rule-link">→</span><div><b>3<span>分身</span></b><p>循环过去的火线</p></div><span class="rule-link">→</span><div><b>180<span>秒</span></b><p>存活即胜利</p></div></div><button id="start" class="primary">开始行动 <span>↗</span></button><p class="controls-note"><kbd>WASD</kbd> 移动　<kbd>SPACE</kbd> 冲刺　<kbd>Q</kbd> 震荡波<br><span>自动开火 · 手机横屏支持摇杆与技能按钮</span></p>${this.settingMarkup()}<p class="menu-foot">单人离线竞技场 <span>本机最高击杀 ${this.settings.best}</span></p></div>`;
      this.el("start").onclick = () => this.start();
      this.bindSettings();
    } else if (screen === "paused") {
      const reason = w.pauses.has("hidden")
        ? "窗口已失焦，战场已冻结。"
        : w.pauses.has("performance")
          ? "检测到较长帧间隔，已暂停以避免跳步。"
          : "休息一下。你的回响会等你。";
      this.overlay.innerHTML = `<div class="panel pause-panel"><p class="section-index">战场暂停</p><h1>时间，停在这里。</h1><p>${reason}</p><button id="resume" class="primary" ${w.pauses.has("hidden") ? "disabled" : ""}>继续行动 <span>→</span></button><button id="menu" class="secondary">返回主菜单</button>${this.settingMarkup()}</div>`;
      this.el("resume").onclick = () => this.resume();
      this.el("menu").onclick = () => this.menu();
      this.bindSettings();
    } else if (screen === "upgrade") {
      this.overlay.innerHTML = `<div class="panel upgrade-panel"><p class="section-index">${w.completedTicks === 3600 ? "01" : "02"} / 02 · 战术升级</p><h1>给下一个自己，更多可能。</h1><p>选择一项强化。旧分身保留历史参数，新的行动记录将继承升级。</p><div class="upgrade-options">${upgrades.map(([kind, num, title, stat, description]) => `<button data-upgrade="${kind}" class="upgrade-option"><span class="upgrade-no">${num}</span><b>${title}</b><strong>${stat}</strong><p>${description}</p><small>已选 ${w.upgrades[kind]} / 2 <span>选择 →</span></small></button>`).join("")}</div></div>`;
      this.overlay
        .querySelectorAll<HTMLButtonElement>("[data-upgrade]")
        .forEach(
          (button) =>
            (button.onclick = () => {
              w.upgrade(button.dataset.upgrade as Upgrade);
              this.input.clear();
              this.clock.reset();
              this.discardDelta = true;
              void this.audio.unlock();
              this.renderUI();
            }),
        );
    } else {
      this.settings.best = Math.max(this.settings.best, w.stats.kills);
      saveSettings(this.settings);
      this.overlay.innerHTML = `<div class="panel result-panel"><p class="section-index">${screen === "victory" ? "生存完成" : "行动结束"}</p><h1>${screen === "victory" ? "你与回响，一起留下。" : "下一次，改写过去。"}</h1><p>每一段行动，都会成为下一个自己的支援。</p><div class="result-stats"><div><b>${w.stats.kills}</b><span>总击杀</span></div><div><b>${(w.completedTicks / 60).toFixed(1)}<small>s</small></b><span>存活时间</span></div><div><b>${w.stats.playerDamage}</b><span>真人伤害</span></div><div><b>${w.stats.echoDamage}</b><span>分身伤害</span></div></div><p class="result-detail">分身子弹命中率 ${w.stats.echoShots ? `${((w.stats.echoHits / w.stats.echoShots) * 100).toFixed(1)}%` : "—"} <span>含未落地弹丸 · 范围技能除外</span></p><button id="restart" class="primary">再来一局 <span>↗</span></button><button id="menu" class="secondary">返回主菜单</button></div>`;
      this.el("restart").onclick = () => this.start();
      this.el("menu").onclick = () => this.menu();
    }
    const focus = this.overlay.querySelector<HTMLButtonElement>(
      "button:not([disabled])",
    );
    focus?.focus({ preventScroll: true });
  }
  destroy(): void {
    this.input.destroy();
    this.disposers.forEach((fn) => fn());
    this.audio.destroy();
    this.testCleanup?.();
    this.root.remove();
  }
}
