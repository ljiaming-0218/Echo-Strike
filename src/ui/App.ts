import { DisplayMode } from "../adapters/DisplayMode";
import { World } from "../core/World";
import { CONFIG as C } from "../core/config";
import { FixedStepClock } from "../core/clock/FixedStepClock";
import { InputRouter } from "../adapters/InputRouter";
import { AudioView } from "../view/AudioView";
import type { WorldView } from "../view/WorldView";
import { loadSettings, saveSettings } from "./settings";
const arrow =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
export class App {
  world = new World();
  readonly clock = new FixedStepClock();
  readonly settings = loadSettings();
  readonly audio = new AudioView();
  readonly input: InputRouter;
  readonly display = new DisplayMode(
    document.querySelector<HTMLElement>("#viewport")!,
  );
  private displayPending = false;
  private root = document.createElement("div");
  private overlay!: HTMLElement;
  private screen = "";
  private hudTick = -1;
  private discardDelta = true;
  private disposers: (() => void)[] = [];
  private testCleanup: (() => void) | undefined;
  constructor(private readonly view: WorldView) {
    this.input = new InputRouter(
      () => this.world.running,
      () => this.world.player,
      () => this.togglePause(),
    );
  }
  private el(id: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!node) throw Error(`Missing UI ${id}`);
    return node;
  }
  mount(): void {
    this.root.id = "interface";
    this.root.innerHTML = `<header id="hud" class="hud" hidden><div class="small-brand">CHRONO<span>HUNT</span><small>时间追猎</small></div><div class="health"><span>当前的你 <b id="hp-value">100</b></span><div class="track"><i id="hp-fill"></i></div></div><div class="round-label">循环 <b id="round-value">01</b><span> / 06</span></div><div class="round-time"><b id="time-value">12.0</b><span>秒后闭合</span></div><button id="display" class="display-button" aria-label="全屏横屏"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button><button id="pause" class="icon-button" aria-label="暂停游戏"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button></header>
  <aside id="mission" class="mission" hidden><span class="mission-title">撤离条件</span><p id="relay-label">时间锚 0 / 3</p><p id="echo-label">敌对过去 0 / 0</p><div id="gate-label">击破所有目标，解锁出口</div></aside>
  <div id="controls" class="controls" hidden><div id="move-stick" class="stick move-stick" aria-label="移动摇杆"><div class="stick-knob"></div><span>移动</span></div><div class="desktop-help"><kbd>WASD</kbd> 移动 <span>·</span> 鼠标瞄准 / 按住左键开火</div><div class="skills"><button id="dash" aria-label="相位冲刺"><b>相位冲刺</b><small id="dash-cd">SPACE · 就绪</small></button><button id="pulse" aria-label="抹除脉冲"><b>抹除脉冲</b><small id="pulse-cd">Q · 本轮 1 次</small></button></div><div id="aim-stick" class="stick aim-stick" aria-label="瞄准射击摇杆"><div class="stick-knob"></div><span>瞄准 / 开火</span></div></div>
  <section id="overlay" class="overlay" aria-live="polite"></section>`;
    this.display.stage.append(this.root);
    this.el("display").onclick = () => this.toggleDisplay();
    this.overlay = this.el("overlay");
    this.el("pause").onclick = () => this.togglePause();
    this.input.bindTouch(
      this.el("move-stick"),
      this.el("aim-stick"),
      this.el("dash"),
      this.el("pulse"),
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
    on(window, "orientationchange", () => this.orientation());
    if (screen.orientation)
      on(screen.orientation, "change", () => this.orientation());
    on(document, "fullscreenchange", () => this.orientation());
    if (window.visualViewport)
      on(window.visualViewport, "resize", () => this.orientation());
    this.orientation();
    this.renderUI();
    if (import.meta.env.MODE === "e2e")
      void import("../debug/testHarness").then(
        ({ attach }) => (this.testCleanup = attach(this)),
      );
  }
  private freeze(
    reason: "hidden" | "portrait" | "manual" | "performance",
  ): void {
    this.world.pause(reason);
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.audio.pause();
  }
  private orientation(): void {
    this.display.update();
    if (this.display.needsLandscape) this.freeze("portrait");
    else this.world.clearReason("portrait");
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.renderUI();
  }
  private toggleDisplay(): void {
    if (this.display.rotated) {
      this.display.auto();
      this.orientation();
    } else void this.changeDisplay(true, false);
  }
  private async changeDisplay(
    native: boolean,
    proceed: boolean,
  ): Promise<void> {
    if (this.displayPending) return;
    this.displayPending = true;
    const running = this.world.running;
    if (running) this.freeze("manual");
    try {
      if (native) await this.display.requestLandscape();
      else this.display.adapt();
      this.orientation();
      if (proceed && this.world.state === "menu") this.start();
      else if (
        (running || proceed) &&
        (this.world.state === "running" || this.world.state === "review")
      )
        this.resume();
    } finally {
      this.displayPending = false;
      this.renderUI();
    }
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
    this.resetPresentation();
    this.orientation();
    void this.audio.unlock();
  }
  private resetPresentation(): void {
    this.audio.reset();
    this.screen = "";
    this.hudTick = -1;
    this.view.clear();
    this.input.clear();
    this.clock.reset();
    this.discardDelta = true;
    this.renderUI();
  }
  private next(): void {
    this.world.nextRound();
    this.resetPresentation();
    this.orientation();
    if (this.world.running) void this.audio.unlock();
  }
  private menu(): void {
    this.world = new World();
    this.resetPresentation();
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
  private settingsMarkup(display = false): string {
    return `<div class="settings"><label>音量<input id="volume" type="range" aria-label="音量" min="0" max="1" step=".05" value="${this.settings.volume}"></label><label><input id="reduced" type="checkbox" ${this.settings.reduced ? "checked" : ""}>减少特效</label>${display ? `<button id="display-menu" class="display-button">${this.display.rotated ? "恢复自动布局" : "全屏 / 横屏体验"}</button>` : ""}</div>`;
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
  private routePreview(): string {
    const clip = this.world.echoManager.clips.at(-1);
    if (!clip) return "";
    const points = clip.poses
      .filter((_, i) => i % 5 === 0)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
    const pulses = clip.events
      .filter((e) => e.kind === "pulse")
      .map(
        (e) =>
          `<circle data-pulse="true" cx="${e.origin.x}" cy="${e.origin.y}" r="${e.radius}" fill="#ef9787" fill-opacity=".05" stroke="#ef9787" stroke-width="3" stroke-dasharray="10 8"/>`,
      )
      .join("");
    return `<svg class="route-preview" viewBox="0 0 1280 720" role="img" aria-label="刚刚记录的行动轨迹"><rect x="48" y="48" width="1184" height="624" fill="#151620" stroke="#3f384f"/><polyline points="${points}" fill="none" stroke="#d4bdf8" stroke-width="5"/>${clip.events
      .filter((e) => e.kind === "shot")
      .map(
        (e) =>
          `<line x1="${e.origin.x}" y1="${e.origin.y}" x2="${e.origin.x + Math.cos(e.angleRad) * 85}" y2="${e.origin.y + Math.sin(e.angleRad) * 85}" stroke="#f19d8e" stroke-width="3" opacity=".6"/>`,
      )
      .join(
        "",
      )}${pulses}<circle cx="${clip.startPose.x}" cy="${clip.startPose.y}" r="12" fill="#ede6d7"/></svg>`;
  }
  renderUI(): void {
    const w = this.world,
      active = w.state !== "menu";
    const displayButton = this.el("display"),
      displayLabel = this.display.rotated ? "恢复自动布局" : "全屏横屏";
    displayButton.setAttribute("aria-label", displayLabel);
    displayButton.title = displayLabel;
    if (displayButton.dataset.mode !== displayLabel) {
      displayButton.dataset.mode = displayLabel;
      displayButton.innerHTML = this.display.rotated
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
    }
    for (const id of ["hud", "mission", "controls"])
      this.el(id).hidden = !active;
    if (w.completedTicks !== this.hudTick || this.hudTick === -1) {
      this.hudTick = w.completedTicks;
      this.el("hp-value").textContent = String(w.player.hp);
      this.el("hp-fill").style.width =
        `${Math.max(0, Math.min(100, w.player.hp))}%`;
      this.el("round-value").textContent = String(w.round).padStart(2, "0");
      this.el("time-value").textContent = (
        (C.roundTicks - w.roundTick) /
        60
      ).toFixed(1);
      this.el("time-value").classList.toggle(
        "urgent",
        w.roundTick > C.roundTicks - 180,
      );
      this.el("relay-label").textContent =
        `时间锚 ${w.relays.filter((r) => r.hp <= 0).length} / 3`;
      this.el("echo-label").textContent =
        `敌对过去 ${w.echoes.filter((e) => e.hp <= 0).length} / ${w.echoes.length}`;
      this.el("gate-label").textContent = w.gateOpen
        ? w.roundTick < C.minRoundTicks
          ? "出口将于第 3 秒开启"
          : "出口已解锁 · 进入光环撤离"
        : "击破所有目标，解锁出口";
      this.el("gate-label").classList.toggle("open", w.gateOpen);
      const left = Math.max(0, w.player.nextDash - w.completedTicks) / 60;
      this.el("dash-cd").textContent = left
        ? `${left.toFixed(1)} 秒`
        : "SPACE · 就绪";
      this.el("pulse-cd").textContent = w.player.pulseAvailable
        ? "Q · 本轮 1 次"
        : "本轮已使用";
      this.el("pulse").classList.toggle("spent", !w.player.pulseAvailable);
    }
    const portrait = this.display.needsLandscape;
    const state = portrait ? "portrait" : w.status,
      key = `${state}/${this.display.rotated}/${w.round}/${[...w.pauses].sort().join(",")}`;
    if (key === this.screen) return;
    this.screen = key;
    this.overlay.hidden = state === "running";
    if (state === "running") return;
    this.input.clear();
    this.audio.pause();
    if (state === "menu") {
      this.overlay.innerHTML = `<div class="menu-layout"><div class="menu-copy"><div class="wordmark">CHRONO<span>HUNT</span></div><h1>你唯一的敌人，<br>是上一轮的你。</h1><p class="intro">瞄准。开火。撤离。<br>你刚刚做过的一切，将在下一轮追猎你。</p><button id="start" class="primary">进入时间循环 ${arrow}</button><div class="menu-meta"><span>6 轮对抗</span><i></i><span>每轮最多 12 秒</span><i></i><span>最多 3 个过去</span></div></div><div class="menu-art" aria-hidden="true"><div class="orbit orbit-outer"></div><div class="orbit orbit-inner"></div><div class="self self-one"><i></i><span>现在</span></div><div class="self self-two"><i></i><span>过去 #1</span></div><div class="self self-three"><i></i><span>过去 #2</span></div><div class="cross-line line-one"></div><div class="cross-line line-two"></div><p>YOUR PAST IS ARMED.</p></div><div class="menu-bottom"><div class="howto"><span><b>01</b> 射击击破 3 个时间锚</span><span><b>02</b> 击败重演旧动作的自己</span><span><b>03</b> 在循环闭合前抵达出口</span></div><div class="input-help"><span><kbd>WASD</kbd> 移动 · 鼠标瞄准 / 左键开火</span><span><kbd>SPACE</kbd> 冲刺 · <kbd>Q</kbd> 清弹 / 伤害附近分身</span><small>手机横屏：左摇杆移动，右摇杆瞄准开火</small></div>${this.settingsMarkup(true)}</div></div>`;
      this.el("start").onclick = () => this.start();
      this.el("display-menu").onclick = () => this.toggleDisplay();
      this.bindSettings();
    } else if (state === "portrait") {
      this.overlay.innerHTML = `<div class="panel"><div class="rotate-phone"></div><h1>请横屏后继续</h1><p>微信 / QQ 内可以直接横向适配。<br>将手机横握，即可使用双摇杆。</p><div class="portrait-actions"><button id="adapt-landscape" class="primary">横向适配${w.state === "menu" ? "并开始" : "并继续"} ${arrow}</button><button id="request-landscape" class="display-button">尝试全屏横屏</button></div><p class="display-note">也可关闭系统竖屏锁定后旋转手机。<br>当前浏览器不支持全屏时，横向适配仍然可用。</p></div>`;
      this.el("adapt-landscape").onclick = () =>
        void this.changeDisplay(false, true);
      this.el("request-landscape").onclick = () =>
        void this.changeDisplay(true, true);
    } else if (state === "paused") {
      this.overlay.innerHTML = `<div class="panel compact"><span class="section-label">循环已冻结</span><h1>过去，也在等你。</h1><p>${w.pauses.has("performance") ? "检测到长帧间隔，已暂停以避免跳过行动。" : "恢复后将从同一个瞬间继续。"}</p><button id="resume" class="primary" ${w.pauses.has("hidden") ? "disabled" : ""}>继续追猎 ${arrow}</button><button id="menu" class="secondary">返回主菜单</button>${this.settingsMarkup()}</div>`;
      this.el("resume").onclick = () => this.resume();
      this.el("menu").onclick = () => this.menu();
      this.bindSettings();
    } else if (state === "review") {
      const clip = w.echoManager.clips.at(-1)!;
      this.overlay.innerHTML = `<div class="review-layout"><div><span class="section-label">第 ${w.round} 轮 · 撤离成功</span><h1>刚才的你，<br>已经站到对面。</h1><p>这段 ${(clip.durationTicks / 60).toFixed(1)} 秒的走位与 ${clip.events.filter((e) => e.kind === "shot").length} 次开火，会在下一轮循环重演。</p><p class="danger-note">记住你开过枪的地方。<br>下一轮，那里可能正是你的必经之路。</p><button id="next" class="primary">进入第 ${w.round + 1} 轮 ${arrow}</button><small class="review-hint">恢复 20 生命 · 技能补充 · 历史最多保留三段</small></div><div class="review-map">${this.routePreview()}<div><span class="legend-now"></span>你的行动轨迹 <span class="legend-past"></span>未来的敌对火线</div></div></div>`;
      this.el("next").onclick = () => this.next();
    } else {
      this.settings.best = Math.max(
        this.settings.best,
        w.round - (state === "victory" ? 0 : 1),
      );
      saveSettings(this.settings);
      this.overlay.innerHTML = `<div class="panel result"><span class="section-label">${state === "victory" ? "六轮完成 · 因果已切断" : "时间线终止"}</span><h1>${state === "victory" ? "你已超越，过去的自己。" : w.failure === "timeout" ? "循环闭合。你还在里面。" : "过去的你，赢了这一次。"}</h1><p>${state === "victory" ? "所有过去都已被击败。现在，向前走。" : w.failure === "timeout" ? "先击破时间锚与所有过去，再进入出口光环。" : "试着改变路线，利用掩体，让旧火线落空。"}</p><div class="result-stats"><div><b>${state === "victory" ? 6 : w.round - 1}<small>/6</small></b><span>完成循环</span></div><div><b>${w.stats.echoKills}</b><span>击破过去</span></div><div><b>${(w.completedTicks / 60).toFixed(1)}<small>s</small></b><span>行动用时</span></div></div><button id="restart" class="primary">重写这条时间线 ${arrow}</button><button id="menu" class="secondary">返回主菜单</button></div>`;
      this.el("restart").onclick = () => this.start();
      this.el("menu").onclick = () => this.menu();
    }
  }
  destroy(): void {
    this.input.destroy();
    this.disposers.forEach((fn) => fn());
    this.audio.destroy();
    this.testCleanup?.();
    this.root.remove();
  }
}
