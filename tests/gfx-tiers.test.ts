import { describe, expect, it } from 'vitest';
import { GFX_TIERS } from '../src/data/look';

// Plan LT1, design 8.1 G5.12 and the tier table of design 10 (CALL-V5). Field names these tests pin for LT2
// (one field per row of the table; a count of 0 or `shadowSize` 0 means the feature is off).
const IDS = ['performance', 'balanced', 'high', 'ultra'] as const;
const col = <K extends string>(field: K): unknown[] =>
  IDS.map((id) => (GFX_TIERS as unknown as Record<string, Record<string, unknown>>)[id][field]);

describe('graphics tier table', () => {
  it('has the four tiers and the same fields on each', () => {
    expect(Object.keys(GFX_TIERS)).toEqual([...IDS]);
    const shape = Object.keys(GFX_TIERS.performance).sort();
    for (const id of IDS) expect(Object.keys(GFX_TIERS[id]).sort(), id).toEqual(shape);
  });

  it('matches the pixel limits of design 10', () => {
    expect(col('pixelRatioCap')).toEqual([1, 1.25, 1.5, 2]);
    expect(col('megapixelCap')).toEqual([3.7, 6, 8.3, 16.6]);
  });

  it('matches the shadow rows: off, then 2048 at 40, 2048 at 54, 4096 at 70', () => {
    expect(col('shadowSize')).toEqual([0, 2048, 2048, 4096]);
    expect(col('shadowRange').slice(1)).toEqual([40, 54, 70]);
  });

  it('matches the path rows: direct on Low and Medium, composer with bloom on High and Ultra', () => {
    expect(col('composer')).toEqual([false, false, true, true]);
    expect(col('anisotropy')).toEqual([1, 4, 8, 16]);
  });

  it('matches the carpet, scatter, particle and light rows', () => {
    expect(col('carpetTufts')).toEqual([0, 6000, 14000, 24000]);
    expect(col('scatterDensity')).toEqual([0.5, 0.75, 1, 1]);
    expect(col('motes')).toEqual([0, 150, 400, 800]);
    expect(col('weatherParticles')).toEqual([0, 600, 1500, 3000]);
    expect(col('pointLights')).toEqual([0, 0, 2, 4]);
  });

  it('never gets cheaper going up a tier', () => {
    for (const field of ['pixelRatioCap', 'megapixelCap', 'shadowSize', 'anisotropy', 'carpetTufts', 'scatterDensity', 'motes', 'weatherParticles', 'pointLights']) {
      const v = col(field) as number[];
      for (let i = 1; i < v.length; i++) expect(v[i], field).toBeGreaterThanOrEqual(v[i - 1]);
    }
  });
});
