import { describe, expect, it } from 'vitest';
import { CAMPS, PATHS, POIS, RIDGES } from '../src/data/worldMap';
import { buildWalkGrid } from '../src/state/pathfind';
import { TERRAIN_SEGMENTS } from '../src/state/terrain';

// Design 6.11, G2.9, and section 8.
describe('world budget', () => {
  it('paths and ridges have at most 60 segments in total', () => {
    expect(PATHS).toHaveLength(4);
    expect(RIDGES).toHaveLength(1);
    const segments = [...PATHS, ...RIDGES].reduce((s, row) => s + row.points.length - 1, 0);
    expect(segments).toBeGreaterThanOrEqual(5);
    expect(segments).toBeLessThanOrEqual(60);
  });

  // Review 11: getTerrainHeight runs composed() (every table segment) once, then once more per pad whose
  // padRadius + PAD_SHOULDER (2, terrain.ts) covers the point.
  it('a height call makes at most 60 segment-distance evaluations, pads counted', () => {
    const segments = [...PATHS, ...RIDGES].reduce((s, row) => s + row.points.length - 1, 0);
    let mostPads = 0;
    for (let x = -118; x <= 118; x += 0.5) {
      for (let z = -118; z <= 118; z += 0.5) {
        const pads = POIS.filter((p) => p.padRadius > 0 && Math.hypot(x - p.x, z - p.z) < p.padRadius + 2).length;
        mostPads = Math.max(mostPads, pads);
      }
    }
    expect(segments * (1 + mostPads), `${segments} segments, up to ${mostPads} pads per point`).toBeLessThanOrEqual(60);
  });

  it('the walk grid has 55,696 cells', () => {
    const grid = buildWalkGrid();
    expect(grid.size).toBe(236);
    expect(grid.cells.length).toBe(55696);
  });

  it('TERRAIN_SEGMENTS is 160', () => {
    expect(TERRAIN_SEGMENTS).toBe(160);
  });

  it('CAMPS hold 36 monsters', () => {
    expect(CAMPS.reduce((s, c) => s + c.members.length, 0)).toBe(36);
  });
});
