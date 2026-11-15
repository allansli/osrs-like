import { STATE } from '../state/gameState';
import { tone, type Voice } from '../state/soundPlan';
import { AUDIO } from '../data/feel';

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

const FADE_S = AUDIO.muteRampSecs;

function warnOnce(what: string, err: unknown): void {
  if (!nodeWarned) {
    nodeWarned = true;
    console.warn(what, err);
  }
}

function fadeOut(c: AudioContext, src: AudioScheduledSourceNode, gain: GainNode): VoiceStop {
  return () => {
    try {
      const now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_S);
      src.stop(now + FADE_S);
    } catch (err) {
      warnOnce('Voice stop failed', err);
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

// One voice: an oscillator, or looped noise through a bandpass, faded from vol to silence over dur.
// play() has checked that the context runs and the master chain exists.
function voice(c: AudioContext, out: GainNode, v: Voice): VoiceStop | null {
  try {
    const startTime = c.currentTime + v.at;
    const stopTime = startTime + v.dur;
    const gain = c.createGain();
    // Silent until its start, so a stop before the start never blips.
    gain.gain.value = 0;
    gain.gain.setValueAtTime(v.vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    let src: AudioScheduledSourceNode;
    let nodes: AudioNode[];
    if (v.kind === 'tone') {
      const osc = c.createOscillator();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.freq, startTime);
      if (v.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(v.slideTo, stopTime);
      osc.connect(gain);
      src = osc;
      nodes = [osc, gain];
    } else {
      const source = c.createBufferSource();
      source.buffer = getNoiseBuffer(c);
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(v.freq, startTime);
      if (v.slideTo !== undefined) filter.frequency.linearRampToValueAtTime(v.slideTo, stopTime);
      filter.Q.setValueAtTime(1, startTime);
      source.connect(filter);
      filter.connect(gain);
      src = source;
      nodes = [source, filter, gain];
    }
    gain.connect(out);

    liveVoices++;
    src.onended = () => {
      liveVoices = liveVoices - 1;
      try {
        for (const n of nodes) n.disconnect();
      } catch (err) {
        warnOnce(`${v.kind} disconnect failed`, err);
      }
    };

    src.start(startTime);
    src.stop(stopTime);
    return fadeOut(c, src, gain);
  } catch (err) {
    warnOnce(`${v.kind} playback failed`, err);
    return null;
  }
}

// wide: wind-up and impact cues may use up to 16 voices (design 6.7); all others 12.
// Returns a stop for every voice it scheduled; a voice dropped by the cap or a muted context has none.
function play(plan: Voice[], wide: boolean): VoiceStop[] {
  const stops: VoiceStop[] = [];
  if (!STATE.audioEnabled) return stops;
  if (!ctx || ctx.state !== 'running' || !masterGain) return stops;

  const cap = wide ? AUDIO.wideVoiceCap : AUDIO.voiceCap;

  for (const v of plan) {
    if (liveVoices >= cap) continue;
    const stop = voice(ctx, masterGain, v);
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
    warnOnce('setMuted failed', err);
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
      ctx.resume().catch((err) => warnOnce('AudioContext resume failed', err));
    }
  };

  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler);
}

// A fixed effect: one plan, played under the normal voice cap.
const fx = (...plan: Voice[]) => (): void => {
  play(plan, false);
};

export const SFX: SoundEffects = {
  play,
  setMuted,
  hit: fx(tone(0, 'sawtooth', 165, 0.12, 0.15, 55), tone(0, 'square', 95, 0.09, 0.11, 42)),
  miss: fx(tone(0, 'sine', 310, 0.11, 0.07, 175)),
  slash: fx(tone(0, 'triangle', 420, 0.08, 0.12, 180)),
  heavyChop: fx(tone(0, 'sawtooth', 120, 0.16, 0.18, 40), tone(0, 'square', 65, 0.12, 0.15, 30)),
  crush: fx(tone(0, 'square', 180, 0.11, 0.16, 50), tone(0, 'sine', 90, 0.14, 0.14, 40)),
  whipCrack: fx(tone(0, 'sawtooth', 880, 0.04, 0.18, 220), tone(0.025, 'triangle', 140, 0.09, 0.15, 60)),
  crossbow: fx(tone(0, 'square', 720, 0.06, 0.12, 280), tone(0.03, 'sine', 420, 0.09, 0.10, 160)),
  flinch: fx(tone(0, 'sine', 140, 0.10, 0.11, 80)),
  bow: fx(tone(0, 'triangle', 540, 0.14, 0.10, 185)),
  magic: fx(tone(0, 'sine', 440, 0.28, 0.13, 880), tone(0.06, 'triangle', 660, 0.22, 0.09, 1120)),
  chop: fx(tone(0, 'triangle', 135, 0.09, 0.14, 70)),
  mine: fx(tone(0, 'square', 980, 0.07, 0.09, 1420), tone(0.03, 'sine', 1320, 0.08, 0.08)),
  fish: fx(tone(0, 'sine', 360, 0.15, 0.09, 540)),
  spotEmpty: fx(tone(0, 'sine', 420, 0.16, 0.08, 210)),
  spotReturn: fx(tone(0, 'sine', 300, 0.14, 0.07, 520)),
  eat: fx(tone(0, 'sine', 240, 0.09, 0.12, 330), tone(0.08, 'sine', 310, 0.10, 0.12, 410)),
  coin: fx(tone(0, 'sine', 1200, 0.09, 0.11, 1600), tone(0.065, 'sine', 1650, 0.14, 0.11)),
  prayer: fx(tone(0, 'sine', 528, 0.25, 0.12, 792)),
  jump: fx(tone(0, 'sine', 210, 0.18, 0.10, 460)),
  levelUp: fx(tone(0, 'triangle', 523.25, 0.26, 0.15), tone(0.11, 'triangle', 659.25, 0.26, 0.15), tone(0.22, 'triangle', 783.99, 0.26, 0.15), tone(0.33, 'triangle', 1046.5, 0.26, 0.15))
};
