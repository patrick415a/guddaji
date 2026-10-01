import { SOUND_CONFIG } from '../config/soundConfig.js';

export class SoundEffects {
  constructor() {
    this.enabled = true;
    this.volume = SOUND_CONFIG.volume;
    this.master = null;
    this.context = null;
    // 모바일에서도 실제 터치/키 입력 중에 오디오를 활성화합니다.
    this.unlock = () => {
      if (!this.enabled || document.hidden) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        this.context ??= new AudioContext();
        if (!this.master) {
          this.master = this.context.createGain();
          this.master.gain.value = this.enabled ? this.volume : 0;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch { /* 오디오를 지원하지 않아도 게임은 계속합니다. */ }
    };
    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
  }

  setSettings(enabled, volume) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    // 재생 중인 짧은 효과음에도 음소거와 볼륨을 즉시 반영합니다.
    if (this.master) this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.context.currentTime, 0.015);
  }

  tone(frequency, endFrequency, duration, gain, delay = 0) {
    const context = this.context;
    if (!this.enabled || document.hidden || context?.state !== 'running') return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    // 짧은 페이드로 클릭 잡음과 날카로운 어택을 줄입니다.
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  jump() {
    const sound = SOUND_CONFIG.jump;
    this.tone(sound.frequency, sound.endFrequency, sound.duration, sound.gain);
  }

  interact() {
    const sound = SOUND_CONFIG.interact;
    sound.frequencies.forEach((frequency, index) => {
      this.tone(frequency, frequency, sound.duration, sound.gain, index * sound.spacing);
    });
  }

  dispose() {
    window.removeEventListener('pointerdown', this.unlock, true);
    window.removeEventListener('keydown', this.unlock, true);
    this.context?.close().catch(() => {});
  }
}
