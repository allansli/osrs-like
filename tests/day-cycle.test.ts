import { describe, expect, it } from 'vitest';
import { DAY_CLOCK, DAY_KEYS, PRESET_PHASE } from '../src/data/look';
import { dayFrameAt, phaseToPreset, presetToPhase, stepPhase } from '../src/state/dayCycle';

// Plan LT1, design 5.3 and G5.3. Conventions these tests pin for LT2:
// - Vec3 and colours are plain [a, b, c] tuples; DayFrame colours are LINEAR rgb, the DayKey hex strings are sRGB.
// - DayFrame fields are named like the DayKey fields: key, keyIntensity, zenith, horizon, air, fill, bounce, exposure,
//   plus sunDir (unit vector toward the key light, the moon when keyIsMoon) and keyIsMoon.
// - stepPhase: the clock runs 1 / (dayMinutes * 60) per second, DAY_CLOCK.nightSpeed times faster while phase < sunDownBelow
//   or phase >= sunDownFrom; the result wraps into [0, 1).

type Rgb = [number, number, number];
const PHASES = [0, 0.25, 0.33, 0.5, 0.7, 0.77];
const ELEVATIONS = [50, 4, 28, 62, 16, 2];
const COLOURS = ['key', 'zenith', 'horizon', 'air', 'fill', 'bounce'] as const;
const SUN = [0.52, 0.78, 0.34];

const toLinear = (hex: string): Rgb => {
  const c = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [c(0), c(1), c(2)];
};
const angleDeg = (a: number[], b: number[]): number => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))))) * 180) / Math.PI;
};
const elevationDeg = (d: number[]): number => (Math.asin(d[1] / Math.hypot(...d)) * 180) / Math.PI;
const channels = (f: ReturnType<typeof dayFrameAt>): number[] => [
  ...COLOURS.flatMap((k) => f[k] as number[]), f.exposure, ...f.sunDir,
];

describe('day cycle', () => {
  it('has six keys at the phases and elevations of design 5.3', () => {
    expect(DAY_KEYS).toHaveLength(6);
    expect(DAY_KEYS.map((k) => k.phase)).toEqual(PHASES);
    expect(DAY_KEYS.map((k) => k.sunElevationDeg)).toEqual(ELEVATIONS);
  });

  it('has the clock and the preset phases of the plan', () => {
    expect(DAY_CLOCK).toEqual({ dayMinutes: 24, nightSpeed: 2, sunDownBelow: 0.22, sunDownFrom: 0.82 });
    expect(PRESET_PHASE).toEqual([0.7, 0.5, 0]);
  });

  it('returns each key exactly at its phase', () => {
    expect(DAY_KEYS).toHaveLength(6);
    for (const row of DAY_KEYS) {
      const f = dayFrameAt(row.phase);
      for (const name of COLOURS) {
        const want = toLinear(row[name]);
        (f[name] as number[]).forEach((v, i) => expect(v, `${row.phase} ${name}[${i}]`).toBeCloseTo(want[i], 4));
      }
      expect(f.keyIntensity, `${row.phase} intensity`).toBeCloseTo(row.keyIntensity, 4);
      expect(f.exposure, `${row.phase} exposure`).toBeCloseTo(row.exposure, 4);
    }
  });

  it('puts the key where the table says: moon at night, sun elsewhere', () => {
    expect(DAY_KEYS).toHaveLength(6);
    for (const row of DAY_KEYS) {
      const f = dayFrameAt(row.phase);
      expect(Math.hypot(...f.sunDir), `${row.phase} unit`).toBeCloseTo(1, 5);
      expect(f.keyIsMoon, `${row.phase} moon`).toBe(row.phase === 0);
      expect(Math.abs(elevationDeg(f.sunDir) - row.sunElevationDeg), `${row.phase} elevation`).toBeLessThan(6);
    }
  });

  it('is continuous across phase 1 to 0 and between keys', () => {
    const N = 1000;
    let prev = channels(dayFrameAt(0));
    for (let i = 1; i <= N; i++) {
      const f = dayFrameAt(i === N ? 1 : i / N);
      const cur = channels(f);
      cur.forEach((v, c) => expect(Math.abs(v - prev[c]), `phase ${i / N} channel ${c}`).toBeLessThanOrEqual(0.02));
      expect(Math.abs(f.keyIntensity - dayFrameAt((i - 1) / N).keyIntensity), `phase ${i / N} intensity`).toBeLessThanOrEqual(0.05);
      prev = cur;
    }
    expect(channels(dayFrameAt(1))).toEqual(channels(dayFrameAt(0)));
    expect(Math.abs(dayFrameAt(0.9999).keyIntensity - dayFrameAt(0).keyIntensity)).toBeLessThan(0.01);
  });

  it('never lifts the sun above 62 degrees, never lights from below the ground, keeps the key a unit vector', () => {
    let maxSun = -90;
    for (let i = 0; i <= 1000; i++) {
      const f = dayFrameAt(i / 1000);
      expect(Math.hypot(...f.sunDir)).toBeCloseTo(1, 5);
      expect(f.sunDir[1], `phase ${i / 1000}`).toBeGreaterThan(-0.05);
      expect(f.keyIntensity).toBeGreaterThanOrEqual(0);
      if (!f.keyIsMoon) maxSun = Math.max(maxSun, elevationDeg(f.sunDir));
    }
    expect(maxSun).toBeLessThanOrEqual(62.01);
    expect(maxSun).toBeGreaterThan(55);
  });

  it('passes within 5 degrees of the fixed direction the game has always had near phase 0.58', () => {
    const best = Math.min(...Array.from({ length: 61 }, (_, i) => angleDeg(dayFrameAt(0.55 + i / 1000).sunDir, SUN)));
    expect(best).toBeLessThanOrEqual(5);
    expect(angleDeg(dayFrameAt(0.58).sunDir, SUN)).toBeLessThanOrEqual(5);
  });

  it('hands the key from sun to moon through zero intensity', () => {
    const night = dayFrameAt(0);
    expect(night.keyIsMoon).toBe(true);
    expect(dayFrameAt(0.5).keyIsMoon).toBe(false);
    let flips = 0;
    let lowest = Infinity;
    let prev = dayFrameAt(0.5).keyIsMoon;
    for (let i = 500; i <= 1500; i++) {
      const f = dayFrameAt((i % 1000) / 1000);
      if (f.keyIsMoon !== prev) { flips++; lowest = Math.min(lowest, f.keyIntensity); prev = f.keyIsMoon; }
    }
    expect(flips, 'one sunset hand-over and one sunrise hand-over in a day').toBe(2);
    expect(lowest).toBeLessThan(0.1);
  });

  it('round-trips the three presets and maps every phase to a preset', () => {
    for (const n of [0, 1, 2]) {
      expect(presetToPhase(n)).toBe(PRESET_PHASE[n]);
      expect(phaseToPreset(presetToPhase(n))).toBe(n);
    }
    for (let i = 0; i <= 1000; i++) expect([0, 1, 2]).toContain(phaseToPreset(i / 1000));
  });

  it('steps the clock at the day rate by day and faster by night, and wraps', () => {
    const perSec = 1 / (DAY_CLOCK.dayMinutes * 60);
    expect(stepPhase(0.5, 60, DAY_CLOCK)).toBeCloseTo(0.5 + 60 * perSec, 9);
    expect(stepPhase(0.3, 10, DAY_CLOCK)).toBeCloseTo(0.3 + 10 * perSec, 9);
    expect(stepPhase(0.1, 10, DAY_CLOCK)).toBeCloseTo(0.1 + 10 * perSec * DAY_CLOCK.nightSpeed, 9);
    expect(stepPhase(0.9, 10, DAY_CLOCK)).toBeCloseTo(0.9 + 10 * perSec * DAY_CLOCK.nightSpeed, 9);
    expect(stepPhase(0.99, 60, DAY_CLOCK)).toBeCloseTo(0.99 + 60 * perSec * DAY_CLOCK.nightSpeed - 1, 9);
    expect(stepPhase(0.5, 0, DAY_CLOCK)).toBe(0.5);
  });

  it('runs one full day in about dayMinutes of game time plus the faster night', () => {
    let phase = 0.22;
    let t = 0;
    while (t < 60 * 60 && !(t > 60 && phase >= 0.22 && phase < 0.23)) { phase = stepPhase(phase, 1, DAY_CLOCK); t++; }
    const nightShare = 0.22 + (1 - DAY_CLOCK.sunDownFrom);
    const expected = (DAY_CLOCK.dayMinutes * 60) * ((1 - nightShare) + nightShare / DAY_CLOCK.nightSpeed);
    expect(Math.abs(t - expected)).toBeLessThan(3);
  });
});
