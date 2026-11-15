type VoiceBase = { at: number; freq: number; slideTo?: number; dur: number; vol: number };
export type Voice =
  | (VoiceBase & { kind: 'tone'; type: OscillatorType })
  | (VoiceBase & { kind: 'noise' });

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
      { at: end - 0.40, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 },
      { at: end - 0.25, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 },
      { at: end - 0.10, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 }
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
      { at: 0, kind: 'noise', freq: 100, dur: 0.12, vol: 0.16 },
      { at: 0, kind: 'tone', type: 'triangle', freq: 110, slideTo: 45, dur: 0.15, vol: 0.15 }
    ];
  }
  if (cue === 'mid') {
    return [
      { at: 0, kind: 'tone', type: 'triangle', freq: 440, slideTo: 220, dur: 0.10, vol: 0.14 },
      { at: 0, kind: 'noise', freq: 900, dur: 0.08, vol: 0.12 }
    ];
  }
  if (cue === 'high') {
    return [
      { at: 0, kind: 'tone', type: 'sine', freq: 880, slideTo: 440, dur: 0.35, vol: 0.16 },
      { at: 0, kind: 'tone', type: 'sine', freq: 1760, dur: 0.25, vol: 0.09 }
    ];
  }
  return [
    { at: 0, kind: 'noise', freq: 240, dur: 0.35, vol: 0.18 },
    { at: 0, kind: 'tone', type: 'sawtooth', freq: 85, slideTo: 40, dur: 0.30, vol: 0.14 }
  ];
}

export function impactPlan(ratio: number): Voice[] {
  const leadFreq = 200 - 80 * ratio;
  const subFreq = 120 - 50 * ratio;
  return [
    { at: 0, kind: 'tone', type: 'sawtooth', freq: leadFreq, slideTo: leadFreq * 0.35, dur: 0.12, vol: 0.15 },
    { at: 0, kind: 'tone', type: 'square', freq: subFreq, slideTo: subFreq * 0.4, dur: 0.09, vol: 0.11 },
    { at: 0, kind: 'noise', freq: 1000, dur: 0.04, vol: 0.10 }
  ];
}

export function heavyTakenPlan(): Voice[] {
  return [
    { at: 0, kind: 'noise', freq: 100, dur: 0.20, vol: 0.18 },
    { at: 0, kind: 'tone', type: 'sawtooth', freq: 110, slideTo: 40, dur: 0.25, vol: 0.16 },
    { at: 0.05, kind: 'tone', type: 'sine', freq: 70, slideTo: 30, dur: 0.20, vol: 0.14 }
  ];
}

export function dodgedPlan(): Voice[] {
  return [
    { at: 0, kind: 'noise', freq: 600, dur: 0.20, vol: 0.12 },
    { at: 0.02, kind: 'tone', type: 'sine', freq: 320, slideTo: 180, dur: 0.18, vol: 0.10 }
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
    { at: 0, kind: 'tone', type: 'triangle', freq: 90, slideTo: 40, dur: 0.25, vol: 0.16 },
    { at: 0, kind: 'noise', freq: 120, dur: 0.15, vol: 0.14 },
    { at: 0.30, kind: 'tone', type: 'sine', freq: 300, slideTo: 260, dur: 0.25, vol: 0.14 },
    { at: 0.60, kind: 'tone', type: 'sine', freq: 240, slideTo: 200, dur: 0.25, vol: 0.14 },
    { at: 0.90, kind: 'tone', type: 'sine', freq: 180, slideTo: 130, dur: 0.30, vol: 0.14 }
  ];
}

export function bossDownPlan(): Voice[] {
  return [
    { at: 0, kind: 'tone', type: 'triangle', freq: 220, slideTo: 261.63, dur: 1.50, vol: 0.13 },
    { at: 0.10, kind: 'tone', type: 'triangle', freq: 277.18, slideTo: 329.63, dur: 1.40, vol: 0.13 },
    { at: 0.20, kind: 'tone', type: 'triangle', freq: 329.63, slideTo: 392.00, dur: 1.30, vol: 0.13 },
    { at: 0.30, kind: 'tone', type: 'triangle', freq: 440, slideTo: 523.25, dur: 1.20, vol: 0.13 }
  ];
}

export function heartbeatPlan(): Voice[] {
  return [
    { at: 0, kind: 'tone', type: 'sine', freq: 60, slideTo: 40, dur: 0.12, vol: 0.05 },
    { at: 0.25, kind: 'tone', type: 'sine', freq: 55, slideTo: 35, dur: 0.12, vol: 0.04 }
  ];
}

export function foodReadyPlan(): Voice[] {
  return [
    { at: 0, kind: 'tone', type: 'sine', freq: 880, dur: 0.08, vol: 0.10 }
  ];
}
