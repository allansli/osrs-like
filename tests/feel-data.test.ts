// F1: G4.6 and G4.12 of the combat-weight design (9.1). Red until F2 adds src/data/feel.ts and src/engine/reactions.ts.
// Contract F2 must meet (names fixed here):
//   HIT_STOP_MS: Record<string, number>            every hit stop, ms
//   FLASH: { peak, ms, minGapMs }                  peak 0..1 of white, duration, spacing on one body
//   KNOCK_BACK: Record<string, { amount, ms }>     mesh offsets, units and ms
//   CAMERA: { kickMax, kickMs, rumbleMs }          units and ms
//   TIER_ROWS: Record<feature, Record<tier, number | boolean>>  design section 10
//   spinOffset(spinAnim), springOffset(t, amplitude, ms), flashAmount(t)  pure curves
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as feel from '../src/data/feel';

const TIERS = ['performance', 'balanced', 'high', 'ultra'] as const;
const FEATURES = [
  'telegraphOutline',
  'telegraphFill',
  'edgeSparks',
  'impactBurst',
  'windUpPose',
  'hitStop',
  'hitFlash',
  'flinchKnockBack',
  'damageNumbers',
  'cameraKick',
  'phaseRing',
  'bossUi',
];

describe('G4.6 caps', () => {
  it('every hit stop is at most 120 ms', () => {
    const values = Object.values(feel.HIT_STOP_MS);
    expect(values.length).toBeGreaterThan(0);
    for (const ms of values) expect(ms).toBeLessThanOrEqual(120);
  });

  it('flash peaks under 0.7 and is spaced at least 350 ms on one body', () => {
    expect(feel.FLASH.peak).toBeLessThan(0.7);
    expect(feel.FLASH.peak).toBeGreaterThan(0);
    expect(feel.FLASH.minGapMs).toBeGreaterThanOrEqual(350);
    expect(feel.FLASH.ms).toBeLessThan(feel.FLASH.minGapMs);
    for (let t = 0; t <= feel.FLASH.ms * 2; t += 5) {
      const a = feel.flashAmount(t);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(feel.FLASH.peak + 1e-9);
    }
    expect(feel.flashAmount(feel.FLASH.ms)).toBe(0);
    expect(feel.flashAmount(feel.FLASH.ms + 500)).toBe(0);
  });

  it('knock-back offsets are bounded and return to 0', () => {
    const rows = Object.values(feel.KNOCK_BACK);
    expect(rows.length).toBeGreaterThan(0);
    for (const { amount, ms } of rows) {
      expect(ms).toBeGreaterThan(0);
      expect(amount).toBeGreaterThan(0);
      for (let t = 0; t <= ms; t += ms / 40) {
        expect(Math.abs(feel.springOffset(t, amount, ms))).toBeLessThanOrEqual(amount + 1e-9);
      }
      expect(feel.springOffset(0, amount, ms)).toBeCloseTo(0, 9);
      expect(feel.springOffset(ms, amount, ms)).toBeCloseTo(0, 9);
      expect(feel.springOffset(ms * 3, amount, ms)).toBe(0);
    }
  });

  it('the camera kick is capped at 0.18 units', () => {
    expect(feel.CAMERA.kickMax).toBeLessThanOrEqual(0.18);
    expect(feel.CAMERA.kickMax).toBeGreaterThan(0);
  });
});

describe('finding 14: the spin is a function of spinAnim alone', () => {
  // loop.ts decays spinAnim by dt * 2.4 per frame; the offset must not depend on dt.
  const reach = (dt: number, seconds: number): number => {
    let s = 1;
    for (let i = 0; i < Math.round(seconds / dt); i++) s = Math.max(0, s - dt * 2.4);
    return s;
  };

  it('is equal at steps of 1/30, 1/60 and 1/144 for the same elapsed time', () => {
    for (const seconds of [1 / 6, 1 / 3, 1 / 2]) {
      const offs = [1 / 30, 1 / 60, 1 / 144].map((dt) => feel.spinOffset(reach(dt, seconds)));
      expect(offs[1]).toBeCloseTo(offs[0], 6);
      expect(offs[2]).toBeCloseTo(offs[0], 6);
    }
  });

  it('is pure, starts at 0 and ends on a whole turn', () => {
    expect(feel.spinOffset(0.37)).toBe(feel.spinOffset(0.37));
    expect(feel.spinOffset(1)).toBeCloseTo(0, 9);
    const end = feel.spinOffset(0) / (Math.PI * 2);
    expect(end).toBeCloseTo(Math.round(end), 9);
    expect(feel.spinOffset(0)).toBeGreaterThan(feel.spinOffset(0.5));
  });
});

describe('G4.6 text scan: reactions never write rules positions', () => {
  it('reactions.ts does not write logic.x, logic.z or player.pos', () => {
    const src = readFileSync('src/engine/reactions.ts', 'utf8');
    expect(src).not.toMatch(/logic\.[xz]\s*(=|\+=|-=)(?!=)/);
    expect(src).not.toMatch(/player\.pos(\.[xyz])?\s*(=|\+=|-=)(?!=)/);
  });
});

describe('G4.12 tier rows (design section 10)', () => {
  it('every effect has a value for each of the four tiers', () => {
    for (const f of FEATURES) {
      const row = feel.TIER_ROWS[f];
      expect(row, f).toBeDefined();
      for (const t of TIERS) {
        expect(row[t], `${f}.${t}`).not.toBeUndefined();
        expect(['number', 'boolean']).toContain(typeof row[t]);
      }
    }
  });

  it('the telegraph outline and fill are on in all four tiers', () => {
    for (const t of TIERS) {
      expect(feel.TIER_ROWS.telegraphOutline[t]).toBe(true);
      expect(feel.TIER_ROWS.telegraphFill[t]).toBe(true);
    }
  });

  it('sparks and bursts follow the table', () => {
    expect(TIERS.map((t) => feel.TIER_ROWS.edgeSparks[t])).toEqual([0, 0, 8, 16]);
    expect(TIERS.map((t) => feel.TIER_ROWS.impactBurst[t])).toEqual([0, 6, 12, 12]);
  });
});
