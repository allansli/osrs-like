// Combat feel numbers and pure reaction curves (design 6.5 and section 10).
// Pure data: no engine/ui/three imports, no DOM access, no random/clock calls.

export type TierId = 'performance' | 'balanced' | 'high' | 'ultra';

export const HIT_STOP_MS = {
  heroBasic: 0,
  heroHeavy: 80,
  monsterHit: 40,
  monsterMaxHit: 70,
  monsterKill: 110,
} as const;

export const FLASH = {
  peak: 0.65,
  ms: 90,
  minGapMs: 350,
} as const;

export const FLINCH = {
  heroMs: 180,
  monsterMs: 260,
  heroLeanRad: 0.18,
} as const;

export const KNOCK_BACK = {
  heroHeavy: { amount: 0.25, ms: 150 },
  monsterHit: { amount: 0.18, ms: 150 },
  monsterMaxHit: { amount: 0.35, ms: 150 },
} as const;

export const CAMERA = {
  kickMax: 0.18,
  kickMs: 140,
  rumbleMs: 600,
  rumbleAmp: 0.08,
} as const;

export const LOW_HEALTH = {
  thresholdRatio: 0.25,
} as const;

export const TIER_ROWS: Record<string, Record<TierId, number | boolean>> = {
  telegraphOutline: { performance: true, balanced: true, high: true, ultra: true },
  telegraphFill: { performance: true, balanced: true, high: true, ultra: true },
  edgeSparks: { performance: 0, balanced: 0, high: 8, ultra: 16 },
  impactBurst: { performance: 0, balanced: 6, high: 12, ultra: 12 },
  windUpPose: { performance: true, balanced: true, high: true, ultra: true },
  hitStop: { performance: true, balanced: true, high: true, ultra: true },
  hitFlash: { performance: true, balanced: true, high: true, ultra: true },
  flinchKnockBack: { performance: true, balanced: true, high: true, ultra: true },
  damageNumbers: { performance: true, balanced: true, high: true, ultra: true },
  cameraKick: { performance: true, balanced: true, high: true, ultra: true },
  phaseRing: { performance: 1, balanced: 1, high: 2, ultra: 2 },
  bossUi: { performance: true, balanced: true, high: true, ultra: true },
};

export function spinOffset(spinAnim: number): number {
  const clamped = Math.max(0, Math.min(1, spinAnim));
  return (1 - clamped) * Math.PI * 4;
}

export function springOffset(t: number, amplitude: number, ms: number): number {
  if (t <= 0 || t >= ms || ms <= 0) return 0;
  return Math.sin((t / ms) * Math.PI) * amplitude;
}

export function flashAmount(t: number): number {
  if (t <= 0 || t >= FLASH.ms) return 0;
  return Math.sin((t / FLASH.ms) * Math.PI) * FLASH.peak;
}
