import { STATE } from '../state/gameState';
import type { Voice } from '../state/soundPlan';

// ============================================================================
// 1. PROCEDURAL WEB AUDIO SYNTHESIZER
// ============================================================================
// Stops one scheduled voice, started or not, with a short fade.
export type VoiceStop = () => void;

export interface SoundEffects {
  play(plan: Voice[], wide: boolean): VoiceStop[];
  setMuted(muted: boolean): void;
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
  spotEmpty(): void;
  spotReturn(): void;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let liveVoices = 0;
let creationFailed = false;
let creationWarned = false;
let nodeWarned = false;

const FADE_S = 0.02;

function fadeOut(c: AudioContext, src: AudioScheduledSourceNode, gain: GainNode): VoiceStop {
  return () => {
    try {
      const now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_S);
      src.stop(now + FADE_S);
    } catch (err) {
      if (!nodeWarned) {
        nodeWarned = true;
        console.warn('Voice stop failed', err);
      }
    }
  };
}

function setupMasterChain(): void {
  masterGain = ctx!.createGain();
  masterGain.gain.setValueAtTime(1, ctx!.currentTime);
  compressor = ctx!.createDynamicsCompressor();
  masterGain.connect(compressor);
  compressor.connect(ctx!.destination);
}

function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    const bufferSize = c.sampleRate;
    noiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function tone(
  offset: number,
  freq: number,
  type: OscillatorType,
  duration: number,
  vol = 0.12,
  slideTo?: number,
  cap = 12
): VoiceStop | null {
  if (!ctx || ctx.state !== 'running' || !masterGain) return null;
  if (liveVoices >= cap) return null;

  try {
    const startTime = ctx.currentTime + offset;
    const stopTime = startTime + duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Silent until its start, so a stop before the start never blips.
    gain.gain.value = 0;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, stopTime);
    }

    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    osc.connect(gain);
    gain.connect(masterGain);

    liveVoices++;
    osc.onended = () => {
      liveVoices = liveVoices - 1;
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (err) {
        if (!nodeWarned) {
          nodeWarned = true;
          console.warn('Oscillator disconnect failed', err);
        }
      }
    };

    osc.start(startTime);
    osc.stop(stopTime);
    return fadeOut(ctx, osc, gain);
  } catch (err) {
    if (!nodeWarned) {
      nodeWarned = true;
      console.warn('Tone playback failed', err);
    }
    return null;
  }
}

function noise(
  offset: number,
  freq: number,
  duration: number,
  vol = 0.12,
  cap = 12,
  slideTo?: number
): VoiceStop | null {
  if (!ctx || ctx.state !== 'running' || !masterGain) return null;
  if (liveVoices >= cap) return null;

  try {
    const startTime = ctx.currentTime + offset;
    const stopTime = startTime + duration;
    const buffer = getNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, startTime);
    if (slideTo !== undefined) filter.frequency.linearRampToValueAtTime(slideTo, stopTime);
    filter.Q.setValueAtTime(1, startTime);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    liveVoices++;
    source.onended = () => {
      liveVoices = liveVoices - 1;
      try {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch (err) {
        if (!nodeWarned) {
          nodeWarned = true;
          console.warn('Noise disconnect failed', err);
        }
      }
    };

    source.start(startTime);
    source.stop(stopTime);
    return fadeOut(ctx, source, gain);
  } catch (err) {
    if (!nodeWarned) {
      nodeWarned = true;
      console.warn('Noise playback failed', err);
    }
    return null;
  }
}

// wide: wind-up and impact cues may use up to 16 voices (design 6.7); all others 12.
// Returns a stop for every voice it scheduled; a voice dropped by the cap or a muted context has none.
function play(plan: Voice[], wide: boolean): VoiceStop[] {
  const stops: VoiceStop[] = [];
  if (!STATE.audioEnabled) return stops;
  if (!ctx || ctx.state !== 'running' || !masterGain) return stops;

  const cap = wide ? 16 : 12;

  for (const v of plan) {
    const stop =
      v.kind === 'tone'
        ? tone(v.at, v.freq, v.type, v.dur, v.vol, v.slideTo, cap)
        : noise(v.at, v.freq, v.dur, v.vol, cap, v.slideTo);
    if (stop) stops.push(stop);
  }
  return stops;
}

export function setMuted(muted: boolean): void {
  if (!ctx || !masterGain) return;
  try {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + FADE_S);
  } catch (err) {
    if (!nodeWarned) {
      nodeWarned = true;
      console.warn('setMuted failed', err);
    }
  }
}

export function armAudioOnGesture(): void {
  const handler = () => {
    if (creationFailed) return;
    if (!ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error('this browser has no AudioContext');
        ctx = new Ctor();
        setupMasterChain();
      } catch (err) {
        creationFailed = true;
        if (!creationWarned) {
          creationWarned = true;
          console.warn('AudioContext creation failed, sound is off', err);
        }
        return;
      }
    }
    if (ctx && ctx.state !== 'running') {
      ctx.resume().catch((err) => {
        if (!nodeWarned) {
          nodeWarned = true;
          console.warn('AudioContext resume failed', err);
        }
      });
    }
  };

  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler);
}

export const SFX: SoundEffects = {
  play: (plan, wide) => play(plan, wide),
  setMuted: (muted) => setMuted(muted),
  hit: () => {
    play([
      { at: 0, kind: 'tone', freq: 165, type: 'sawtooth', dur: 0.12, vol: 0.15, slideTo: 55 },
      { at: 0, kind: 'tone', freq: 95, type: 'square', dur: 0.09, vol: 0.11, slideTo: 42 }
    ], false);
  },
  miss: () => {
    play([{ at: 0, kind: 'tone', freq: 310, type: 'sine', dur: 0.11, vol: 0.07, slideTo: 175 }], false);
  },
  slash: () => {
    play([{ at: 0, kind: 'tone', freq: 420, type: 'triangle', dur: 0.08, vol: 0.12, slideTo: 180 }], false);
  },
  heavyChop: () => {
    play([
      { at: 0, kind: 'tone', freq: 120, type: 'sawtooth', dur: 0.16, vol: 0.18, slideTo: 40 },
      { at: 0, kind: 'tone', freq: 65, type: 'square', dur: 0.12, vol: 0.15, slideTo: 30 }
    ], false);
  },
  crush: () => {
    play([
      { at: 0, kind: 'tone', freq: 180, type: 'square', dur: 0.11, vol: 0.16, slideTo: 50 },
      { at: 0, kind: 'tone', freq: 90, type: 'sine', dur: 0.14, vol: 0.14, slideTo: 40 }
    ], false);
  },
  whipCrack: () => {
    play([
      { at: 0, kind: 'tone', freq: 880, type: 'sawtooth', dur: 0.04, vol: 0.18, slideTo: 220 },
      { at: 0.025, kind: 'tone', freq: 140, type: 'triangle', dur: 0.09, vol: 0.15, slideTo: 60 }
    ], false);
  },
  crossbow: () => {
    play([
      { at: 0, kind: 'tone', freq: 720, type: 'square', dur: 0.06, vol: 0.12, slideTo: 280 },
      { at: 0.03, kind: 'tone', freq: 420, type: 'sine', dur: 0.09, vol: 0.10, slideTo: 160 }
    ], false);
  },
  flinch: () => {
    play([{ at: 0, kind: 'tone', freq: 140, type: 'sine', dur: 0.10, vol: 0.11, slideTo: 80 }], false);
  },
  bow: () => {
    play([{ at: 0, kind: 'tone', freq: 540, type: 'triangle', dur: 0.14, vol: 0.10, slideTo: 185 }], false);
  },
  magic: () => {
    play([
      { at: 0, kind: 'tone', freq: 440, type: 'sine', dur: 0.28, vol: 0.13, slideTo: 880 },
      { at: 0.06, kind: 'tone', freq: 660, type: 'triangle', dur: 0.22, vol: 0.09, slideTo: 1120 }
    ], false);
  },
  chop: () => {
    play([{ at: 0, kind: 'tone', freq: 135, type: 'triangle', dur: 0.09, vol: 0.14, slideTo: 70 }], false);
  },
  mine: () => {
    play([
      { at: 0, kind: 'tone', freq: 980, type: 'square', dur: 0.07, vol: 0.09, slideTo: 1420 },
      { at: 0.03, kind: 'tone', freq: 1320, type: 'sine', dur: 0.08, vol: 0.08 }
    ], false);
  },
  fish: () => {
    play([{ at: 0, kind: 'tone', freq: 360, type: 'sine', dur: 0.15, vol: 0.09, slideTo: 540 }], false);
  },
  spotEmpty: () => {
    play([{ at: 0, kind: 'tone', freq: 420, type: 'sine', dur: 0.16, vol: 0.08, slideTo: 210 }], false);
  },
  spotReturn: () => {
    play([{ at: 0, kind: 'tone', freq: 300, type: 'sine', dur: 0.14, vol: 0.07, slideTo: 520 }], false);
  },
  eat: () => {
    play([
      { at: 0, kind: 'tone', freq: 240, type: 'sine', dur: 0.09, vol: 0.12, slideTo: 330 },
      { at: 0.08, kind: 'tone', freq: 310, type: 'sine', dur: 0.10, vol: 0.12, slideTo: 410 }
    ], false);
  },
  coin: () => {
    play([
      { at: 0, kind: 'tone', freq: 1200, type: 'sine', dur: 0.09, vol: 0.11, slideTo: 1600 },
      { at: 0.065, kind: 'tone', freq: 1650, type: 'sine', dur: 0.14, vol: 0.11 }
    ], false);
  },
  prayer: () => {
    play([{ at: 0, kind: 'tone', freq: 528, type: 'sine', dur: 0.25, vol: 0.12, slideTo: 792 }], false);
  },
  jump: () => {
    play([{ at: 0, kind: 'tone', freq: 210, type: 'sine', dur: 0.18, vol: 0.10, slideTo: 460 }], false);
  },
  levelUp: () => {
    play([
      { at: 0, kind: 'tone', freq: 523.25, type: 'triangle', dur: 0.26, vol: 0.15 },
      { at: 0.11, kind: 'tone', freq: 659.25, type: 'triangle', dur: 0.26, vol: 0.15 },
      { at: 0.22, kind: 'tone', freq: 783.99, type: 'triangle', dur: 0.26, vol: 0.15 },
      { at: 0.33, kind: 'tone', freq: 1046.5, type: 'triangle', dur: 0.26, vol: 0.15 }
    ], false);
  }
};
