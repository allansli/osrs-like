import { describe, expect, it } from 'vitest';
import { BLOOM, CAMERA_FAR, CAMERA_LIMITS, DAY_KEYS, HORIZON_APRON, REGION_LOOK, SHADOW_SUN_STEP_DEG, SKY_DOME_RADIUS, WALK_BOUND } from '../src/data/look';
import { WORLD_REGIONS } from '../src/data/world';
import { dayFrameAt, litGroundValue } from '../src/state/dayCycle';
import { TERRAIN_SIZE } from '../src/state/terrain';

// Plan LT1, design 8.1 G5.3, G5.4 (the far plane and apron rows of G5.8) and 5.3.
const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOURS = ['key', 'zenith', 'horizon', 'air', 'fill', 'bounce'] as const;

describe('look data: the day keys', () => {
  it('has six complete rows', () => {
    expect(DAY_KEYS).toHaveLength(6);
    for (const row of DAY_KEYS) {
      for (const name of COLOURS) expect(row[name], `${row.phase} ${name}`).toMatch(HEX);
      for (const n of ['phase', 'sunElevationDeg', 'keyIntensity', 'exposure'] as const) {
        expect(Number.isFinite(row[n]), `${row.phase} ${n}`).toBe(true);
      }
      expect(row.keyIntensity).toBeGreaterThan(0);
      expect(row.exposure).toBeGreaterThan(0);
    }
  });

  it('ascends in phase inside [0, 1)', () => {
    expect(DAY_KEYS).toHaveLength(6);
    expect(DAY_KEYS[0].phase).toBe(0);
    for (let i = 1; i < DAY_KEYS.length; i++) expect(DAY_KEYS[i].phase).toBeGreaterThan(DAY_KEYS[i - 1].phase);
    expect(DAY_KEYS[DAY_KEYS.length - 1].phase).toBeLessThan(1);
  });

  it('keeps the lit ground at 22 percent value or more under every key (night is a mood, CALL-V4)', () => {
    expect(DAY_KEYS).toHaveLength(6);
    for (const row of DAY_KEYS) {
      const frame = dayFrameAt(row.phase);
      expect(litGroundValue(frame, 0.3), `phase ${row.phase}`).toBeGreaterThanOrEqual(0.22);
      expect(litGroundValue(frame, 0.75), `phase ${row.phase}`).toBeGreaterThan(litGroundValue(frame, 0.3));
    }
  });
});

describe('look data: distances', () => {
  it('holds the values R0 recorded', () => {
    expect(CAMERA_LIMITS).toEqual({ pitchMin: 0.12, pitchMax: 1.15, distanceMin: 3.6, distanceMax: 26 });
    expect(WALK_BOUND).toBe(118);
    expect(CAMERA_FAR).toBe(460);
    expect(SKY_DOME_RADIUS).toBe(440);
    expect(HORIZON_APRON).toEqual({ inner: 130, outer: 240 });
    expect(SHADOW_SUN_STEP_DEG).toBe(0.5);
  });

  it('keeps the farthest apron edge a camera can see inside the far plane', () => {
    expect(WALK_BOUND * Math.SQRT2 + CAMERA_LIMITS.distanceMax + HORIZON_APRON.outer).toBeLessThan(CAMERA_FAR);
  });

  it('keeps the sky dome inside the far plane', () => {
    expect(SKY_DOME_RADIUS).toBeLessThan(CAMERA_FAR);
  });

  it('starts the apron where the terrain ends', () => {
    expect(HORIZON_APRON.inner).toBe(TERRAIN_SIZE / 2);
    expect(HORIZON_APRON.inner).toBe(130);
    expect(HORIZON_APRON.outer).toBeGreaterThan(HORIZON_APRON.inner);
  });
});

// Plan AR1, design 5.5 and 6.10. Row fields pinned for AR2: `{ id, airTint: '#rrggbb', airWeight }`.
describe('look data: region air (design 5.5)', () => {
  const rows = REGION_LOOK as unknown as Array<{ id: string; airTint: string; airWeight: number }>;

  it('has five rows, one per WORLD_REGIONS id, in order', () => {
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.id)).toEqual(WORLD_REGIONS.map((r) => r.id));
  });

  it('gives each an air tint with a weight of at most 0.2', () => {
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.airTint, row.id).toMatch(HEX);
      expect(Number.isFinite(row.airWeight), row.id).toBe(true);
      expect(row.airWeight, row.id).toBeGreaterThanOrEqual(0);
      expect(row.airWeight, row.id).toBeLessThanOrEqual(0.2);
    }
  });
});

describe('look data: bloom (design 6.10)', () => {
  // Linear, pre-exposure, full band, fill and bounce included, the way UnrealBloomPass thresholds.
  const brightestLit = Math.max(
    ...DAY_KEYS.map((row) => {
      const f = dayFrameAt(row.phase);
      const c = [0, 1, 2].map((i) => (f.keyIntensity * f.key[i] + f.fill[i] + f.bounce[i]) * 0.75);
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    })
  );

  it('has a finite threshold, strength and radius', () => {
    for (const n of ['threshold', 'strength', 'radius'] as const) expect(Number.isFinite(BLOOM[n]), n).toBe(true);
    expect(BLOOM.strength).toBeGreaterThan(0);
    expect(BLOOM.radius).toBeGreaterThanOrEqual(0);
    expect(BLOOM.radius).toBeLessThanOrEqual(1);
  });

  it('sets the threshold at least 15 percent above the brightest lit surface under any key', () => {
    expect(brightestLit).toBeGreaterThan(0);
    expect(BLOOM.threshold).toBeGreaterThanOrEqual(1.15 * brightestLit);
  });
});
