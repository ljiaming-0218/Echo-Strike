export class FixedStepClock {
  private accumulator = 0;
  readonly stepMs = 1000 / 60;
  reset(): void {
    this.accumulator = 0;
  }
  advanceElapsed(
    ms: number,
    step: () => boolean,
    onPerformancePause: () => void,
  ): number {
    if (!Number.isFinite(ms) || ms < 0) return this.accumulator / this.stepMs;
    if (ms > 250) {
      this.reset();
      onPerformancePause();
      return 0;
    }
    this.accumulator += Math.min(ms, 100);
    let count = 0;
    while (this.accumulator + 1e-7 >= this.stepMs && count < 6) {
      this.accumulator = Math.max(0, this.accumulator - this.stepMs);
      count++;
      if (!step()) {
        this.reset();
        return 0;
      }
    }
    return this.accumulator / this.stepMs;
  }
}
