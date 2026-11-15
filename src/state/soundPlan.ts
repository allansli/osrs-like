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

export function windupPlan(attack: { windupMs: number }, cue: Cue): Voice[] {
  const end = attack.windupMs / 1000;
  if (cue === 'low') {
    return [
      { at: 0, kind: 'tone', type: 'square', freq: 110, slideTo: 165, dur: end, vol: 0.12 }
    ];
  }
  if (cue === 'mid') {
    return [
      { at: 0, kind: 'tone', type: 'triangle', freq: 220, slideTo: 330, dur: end, vol: 0.10 },
      { at: end - 0.40, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 },
      { at: end - 0.25, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 },
      { at: end - 0.10, kind: 'tone', type: 'square', freq: 750, dur: 0.04, vol: 0.08 }
    ];
  }
  if (cue === 'high') {
    return [
      { at: 0, kind: 'tone', type: 'sine', freq: 300, slideTo: 600, dur: end, vol: 0.12 },
      { at: 0, kind: 'tone', type: 'sine', freq: 304, slideTo: 608, dur: end, vol: 0.06 }
    ];
  }
  return [
    { at: 0, kind: 'noise', freq: 350, dur: end, vol: 0.14 },
    { at: 0, kind: 'tone', type: 'sawtooth', freq: 70, slideTo: 140, dur: end, vol: 0.10 }
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
