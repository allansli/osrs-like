import { describe, expect, it } from 'vitest';
import { CAMPS, PATHS, RIDGES } from '../src/data/worldMap';
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
