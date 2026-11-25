type VoiceBase = { at: number; freq: number; slideTo?: number; dur: number; vol: number };
export type Voice =
  | (VoiceBase & { kind: 'tone'; type: OscillatorType })
  | (VoiceBase & { kind: 'noise' });

// Compact constructors for the fixed plans; slideTo is left out, not undefined, when the pitch holds.
export function tone(at: number, type: OscillatorType, freq: number, dur: number, vol: number, slideTo?: number): Voice {
  return slideTo === undefined
    ? { at, kind: 'tone', type, freq, dur, vol }
    : { at, kind: 'tone', type, freq, slideTo, dur, vol };
}

function noise(at: number, freq: number, dur: number, vol: number): Voice {
  return { at, kind: 'noise', freq, dur, vol };
}

export type Cue = 'low' | 'mid' | 'high' | 'fire';

export function cueFor(attack: { style: string }, monsterStyle: string): Cue {
  const s =
    attack.style === 'fire' ||
    attack.style === 'melee' ||
    attack.style === 'ranged' ||
    attack.style === 'magic'
      ? attack.style
      : monsterStyle;
  if (s === 'fire') return 'fire';
  if (s === 'melee') return 'low';
  if (s === 'ranged') return 'mid';
  return 'high';
}

// The engine fades every voice from vol to silence over its dur, so a rise is built from
// staggered overlapping voices with growing vol; the last one ends at windupMs, still loud.
const SWELL_STEPS = 5;
function swell(
  end: number,
  v: { kind: 'tone'; type: OscillatorType } | { kind: 'noise' },
  f0: number,
  f1: number,
  peak: number
): Voice[] {
  const out: Voice[] = [];
  for (let k = 0; k < SWELL_STEPS; k++) {
    const at = (end * k) / SWELL_STEPS;
    const dur = Math.min(end - at, (end * 2) / SWELL_STEPS);
    const f = (t: number) => f0 * Math.pow(f1 / f0, t / end);
    out.push({
      ...v,
      at,
      freq: f(at),
      slideTo: f(at + dur),
      dur,
      vol: peak * (0.3 + (0.7 * k) / (SWELL_STEPS - 1))
    });
  }
  return out;
}

export function windupPlan(attack: { windupMs: number }, cue: Cue): Voice[] {
  const end = attack.windupMs / 1000;
  if (cue === 'low') return swell(end, { kind: 'tone', type: 'square' }, 110, 165, 0.12);
  if (cue === 'mid') {
    return [
      ...swell(end, { kind: 'tone', type: 'triangle' }, 220, 330, 0.10),
      tone(end - 0.40, 'square', 750, 0.04, 0.08),
      tone(end - 0.25, 'square', 750, 0.04, 0.08),
      tone(end - 0.10, 'square', 750, 0.04, 0.08)
    ];
  }
  if (cue === 'high') {
    return [
      ...swell(end, { kind: 'tone', type: 'sine' }, 300, 600, 0.12),
      ...swell(end, { kind: 'tone', type: 'sine' }, 304, 608, 0.06)
    ].slice(0, 12);
  }
  return [
    ...swell(end, { kind: 'noise' }, 250, 700, 0.14),
    ...swell(end, { kind: 'tone', type: 'sawtooth' }, 70, 140, 0.10)
  ];
}

export function resolvePlan(cue: Cue): Voice[] {
  if (cue === 'low') {
    return [
      noise(0, 100, 0.12, 0.16),
      tone(0, 'triangle', 110, 0.15, 0.15, 45)
    ];
  }
  if (cue === 'mid') {
    return [
      tone(0, 'triangle', 440, 0.10, 0.14, 220),
      noise(0, 900, 0.08, 0.12)
    ];
  }
  if (cue === 'high') {
    return [
      tone(0, 'sine', 880, 0.35, 0.16, 440),
      tone(0, 'sine', 1760, 0.25, 0.09)
    ];
  }
  return [
    noise(0, 240, 0.35, 0.18),
    tone(0, 'sawtooth', 85, 0.30, 0.14, 40)
  ];
}

export function impactPlan(ratio: number): Voice[] {
  const leadFreq = 200 - 80 * ratio;
  const subFreq = 120 - 50 * ratio;
  return [
    tone(0, 'sawtooth', leadFreq, 0.12, 0.15, leadFreq * 0.35),
    tone(0, 'square', subFreq, 0.09, 0.11, subFreq * 0.4),
    noise(0, 1000, 0.04, 0.10)
  ];
}

export function heavyTakenPlan(): Voice[] {
  return [
    noise(0, 100, 0.20, 0.18),
    tone(0, 'sawtooth', 110, 0.25, 0.16, 40),
    tone(0.05, 'sine', 70, 0.20, 0.14, 30)
  ];
}

export function dodgedPlan(): Voice[] {
  return [
    noise(0, 600, 0.20, 0.12),
    tone(0.02, 'sine', 320, 0.18, 0.10, 180)
  ];
}

// The impact half of a resolve, picked after the roll: the thump only when the heavy dealt damage, the whoosh
// only when the hero was out of the shape. A heavy that lands and rolls 0 has only the resolve cue and its miss splat.
export function heavyImpactPlan(inShape: boolean, damage: number): Voice[] {
  if (damage > 0) return heavyTakenPlan();
  if (!inShape) return dodgedPlan();
  return [];
}

export function phasePlan(): Voice[] {
  return [
    tone(0, 'triangle', 90, 0.25, 0.16, 40),
    noise(0, 120, 0.15, 0.14),
    tone(0.30, 'sine', 300, 0.25, 0.14, 260),
    tone(0.60, 'sine', 240, 0.25, 0.14, 200),
    tone(0.90, 'sine', 180, 0.30, 0.14, 130)
  ];
}

export function bossDownPlan(): Voice[] {
  return [
    tone(0, 'triangle', 220, 1.50, 0.13, 261.63),
    tone(0.10, 'triangle', 277.18, 1.40, 0.13, 329.63),
    tone(0.20, 'triangle', 329.63, 1.30, 0.13, 392.00),
    tone(0.30, 'triangle', 440, 1.20, 0.13, 523.25)
  ];
}

export function heartbeatPlan(): Voice[] {
  return [
    tone(0, 'sine', 60, 0.12, 0.05, 40),
    tone(0.25, 'sine', 55, 0.12, 0.04, 35)
  ];
}

export function foodReadyPlan(): Voice[] {
  return [
    tone(0, 'sine', 880, 0.08, 0.10)
  ];
}
