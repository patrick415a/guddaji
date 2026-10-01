export class AdaptiveQuality {
  constructor(config) {
    this.config = config;
    this.mode = "auto";
    this.level = 0;
    this.environmentShadows = false;
    this.shadowTrialFailed = false;
    this.reset();
  }

  setMode(mode) {
    const levels = { high: 0, medium: 1, low: 2 };
    this.mode = mode in levels ? mode : "auto";
    this.level = this.mode === "auto" ? 0 : levels[this.mode];
    this.environmentShadows = this.mode === "high";
    this.shadowTrialFailed = this.mode !== "auto";
    this.reset();
  }

  reset() {
    this.warmup = this.config.warmupSeconds;
    this.elapsed = 0;
    this.frames = 0;
    this.slow = 0;
    this.fast = 0;
    this.shadowSlow = 0;
  }

  sample(delta) {
    if (!this.config.enabled || this.mode !== "auto" || delta <= 0) return false;
    if (delta > 0.5) { this.reset(); return false; }
    if (this.warmup > 0) { this.warmup -= delta; return false; }
    this.elapsed += delta;
    this.frames++;
    if (this.elapsed < this.config.sampleSeconds) return false;
    this.fps = this.frames / this.elapsed;
    const shadows = this.config.environmentShadows;
    this.fast = this.fps >= shadows.enableFps ? this.fast + 1 : 0;
    this.shadowSlow = this.fps < shadows.disableFps ? this.shadowSlow + 1 : 0;
    this.slow = this.fps < this.config.minimumFps ? this.slow + 1 : 0;
    this.elapsed = 0;
    this.frames = 0;
    // 그림자 비용부터 줄인 후, 그래도 느리면 기존 해상도 단계를 낮춥니다.
    if (this.environmentShadows && this.shadowSlow >= this.config.slowWindows) {
      this.environmentShadows = false;
      this.shadowTrialFailed = true;
      this.reset();
      return true;
    }
    if (!this.environmentShadows && !this.shadowTrialFailed && this.level === 0
        && this.fast >= shadows.stableWindows) {
      this.environmentShadows = true;
      this.reset();
      return true;
    }
    if (this.slow < this.config.slowWindows || this.level === this.config.tiers.length - 1) return false;
    // 반복적인 화질 오르내림을 피하고, 새로고침 시 원래 화질부터 다시 측정합니다.
    this.level++;
    this.reset();
    return true;
  }
}
