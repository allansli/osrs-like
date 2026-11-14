import { STATE } from '../state/gameState';

// ============================================================================
// 1. PROCEDURAL WEB AUDIO SYNTHESIZER
// ============================================================================
export interface SoundEffects {
  hit(): void;
  miss(): void;
  slash(): void;
  heavyChop(): void;
  crush(): void;
  whipCrack(): void;
  crossbow(): void;
  flinch(): void;
  bow(): void;
  magic(): void;
  chop(): void;
  mine(): void;
  fish(): void;
  eat(): void;
  coin(): void;
  prayer(): void;
  jump(): void;
  levelUp(): void;
}

export const SFX: SoundEffects = (() => {
  let ctx: AudioContext | null = null;

  function init(): void {
    if (!ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol = 0.12,
    slideTo: number | null = null
  ): void {
    try {
      if (!STATE.audioEnabled) return;
      init();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  return {
    hit: () => { tone(165, 'sawtooth', 0.12, 0.15, 55); tone(95, 'square', 0.09, 0.11, 42); },
    miss: () => { tone(310, 'sine', 0.11, 0.07, 175); },
    slash: () => { tone(420, 'triangle', 0.08, 0.12, 180); },
    heavyChop: () => { tone(120, 'sawtooth', 0.16, 0.18, 40); tone(65, 'square', 0.12, 0.15, 30); },
    crush: () => { tone(180, 'square', 0.11, 0.16, 50); tone(90, 'sine', 0.14, 0.14, 40); },
    whipCrack: () => { tone(880, 'sawtooth', 0.04, 0.18, 220); setTimeout(() => tone(140, 'triangle', 0.09, 0.15, 60), 25); },
    crossbow: () => { tone(720, 'square', 0.06, 0.12, 280); setTimeout(() => tone(420, 'sine', 0.09, 0.10, 160), 30); },
    flinch: () => { tone(140, 'sine', 0.10, 0.11, 80); },
    bow: () => { tone(540, 'triangle', 0.14, 0.10, 185); },
    magic: () => { tone(440, 'sine', 0.28, 0.13, 880); setTimeout(() => tone(660, 'triangle', 0.22, 0.09, 1120), 60); },
    chop: () => { tone(135, 'triangle', 0.09, 0.14, 70); },
    mine: () => { tone(980, 'square', 0.07, 0.09, 1420); setTimeout(() => tone(1320, 'sine', 0.08, 0.08), 30); },
    fish: () => { tone(360, 'sine', 0.15, 0.09, 540); },
    eat: () => { tone(240, 'sine', 0.09, 0.12, 330); setTimeout(() => tone(310, 'sine', 0.1, 0.12, 410), 80); },
    coin: () => { tone(1200, 'sine', 0.09, 0.11, 1600); setTimeout(() => tone(1650, 'sine', 0.14, 0.11), 65); },
    prayer: () => { tone(528, 'sine', 0.25, 0.12, 792); },
    jump: () => { tone(210, 'sine', 0.18, 0.1, 460); },
    levelUp: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => setTimeout(() => tone(n, 'triangle', 0.26, 0.15), i * 110));
    }
  };
})();
