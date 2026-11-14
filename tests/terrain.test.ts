import { describe, expect, it } from 'vitest';
import { WORLD_REGIONS } from '../src/data/world';
import { riverCenterX } from '../src/state/collision';
import { getTerrainHeight, regionAt } from '../src/state/terrain';

describe('terrain invariants', () => {
  it('height is exactly 0 within 16 of every region centre', () => {
    for (const r of WORLD_REGIONS) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        for (const d of [0, 8, 15.9]) {
          expect(getTerrainHeight(r.x + Math.cos(ang) * d, r.z + Math.sin(ang) * d)).toBe(0);
        }
      }
    }
  });

  it('river centre at z=0 is below the water plane', () => {
    expect(getTerrainHeight(riverCenterX(0), 0)).toBeLessThan(-0.34);
  });

  it('land 28+ from every centre and outside the trough is at least 0.08', () => {
    let checked = 0;
    for (let x = -130; x <= 130; x += 1.5) {
      for (let z = -130; z <= 130; z += 1.5) {
        if (WORLD_REGIONS.some((r) => Math.hypot(x - r.x, z - r.z) < 28)) continue;
        if (Math.abs(x - riverCenterX(z)) < 6.8) continue;
        checked++;
        expect(getTerrainHeight(x, z), `(${x}, ${z})`).toBeGreaterThanOrEqual(0.08);
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('regionAt returns each region at its centre', () => {
    for (const r of WORLD_REGIONS) {
      expect(regionAt(r.x, r.z)).toBe(r);
    }
  });

  it('regionAt(40,-10) is lumbridge', () => {
    expect(regionAt(40, -10)?.id).toBe('lumbridge');
  });

  it('regionAt returns null outside every radius', () => {
    expect(regionAt(500, 500)).toBeNull();
    expect(regionAt(0, -200)).toBeNull();
  });
});
