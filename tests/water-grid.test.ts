import { describe, expect, it } from 'vitest';
import { BASINS } from '../src/data/worldMap';
import { riverCenterX } from '../src/state/collision';
import { getTerrainHeight } from '../src/state/terrain';
import { buildWaterGrid, WATER_LEVEL } from '../src/state/waterGrid';

/*
 * Plan WT1, design 6.5 and the G5.5 row of 8.1, against src/state/waterGrid.ts.
 * The tests read the grid through its index list and per-vertex arrays only, so they do not fix the vertex layout
 * (shared or per-cell corners, flow stride 2 or 3).
 */

const grid = buildWaterGrid();
const vertexCount = grid.positions.length / 3;
const vx = (i: number) => grid.positions[i * 3];
const vz = (i: number) => grid.positions[i * 3 + 2];
const flowStride = grid.flow.length / vertexCount;
const flowAt = (i: number) => grid.flow.slice(i * flowStride, i * flowStride + flowStride);
const flowLen = (i: number) => Math.hypot(...flowAt(i));

/** Index of the vertex nearest to (x, z). */
function nearest(x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const d = Math.hypot(vx(i) - x, vz(i) - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

describe('water grid shape', () => {
  it('the water plane is -0.34', () => {
    expect(WATER_LEVEL).toBe(-0.34);
  });

  it('arrays agree: triangles in whole cells, depth per vertex, flow per vertex, indices in range', () => {
    expect(grid.index.length % 6).toBe(0);
    expect(grid.cells).toBe(grid.index.length / 6);
    expect(grid.positions.length % 3).toBe(0);
    expect(grid.depth.length).toBe(vertexCount);
    expect([2, 3]).toContain(flowStride);
    expect(Number.isInteger(flowStride)).toBe(true);
    for (const i of grid.index) expect(i >= 0 && i < vertexCount && Number.isInteger(i)).toBe(true);
    for (const v of [...grid.positions, ...grid.depth, ...grid.flow]) expect(Number.isFinite(v)).toBe(true);
  });

  it('the cell count is under 6000 and not empty', () => {
    expect(grid.cells).toBeGreaterThan(0);
    expect(grid.cells).toBeLessThan(6000);
  });

  it('is deterministic', () => {
    const again = buildWaterGrid();
    expect(again.cells).toBe(grid.cells);
    expect(again.index).toEqual(grid.index);
    expect(again.depth).toEqual(grid.depth);
  });
});

describe('every water cell has terrain below the water plane within one cell', () => {
  it('each triangle has a lattice point below WATER_LEVEL within one unit of its bounds', () => {
    for (let t = 0; t < grid.index.length; t += 3) {
      const xs = [0, 1, 2].map((k) => vx(grid.index[t + k]));
      const zs = [0, 1, 2].map((k) => vz(grid.index[t + k]));
      const x0 = Math.floor(Math.min(...xs)) - 1;
      const x1 = Math.ceil(Math.max(...xs)) + 1;
      const z0 = Math.floor(Math.min(...zs)) - 1;
      const z1 = Math.ceil(Math.max(...zs)) + 1;
      let wet = false;
      for (let x = x0; x <= x1 && !wet; x++) {
        for (let z = z0; z <= z1; z++) {
          if (getTerrainHeight(x, z) < WATER_LEVEL) { wet = true; break; }
        }
      }
      expect(wet, `triangle ${t / 3} near (${xs[0]}, ${zs[0]}) has no wet terrain within one cell`).toBe(true);
    }
  });
});

describe('depth', () => {
  it('is never negative and equals the water plane minus the terrain height, clamped at 0', () => {
    for (let i = 0; i < vertexCount; i++) {
      expect(grid.depth[i]).toBeGreaterThanOrEqual(0);
      const want = Math.max(0, WATER_LEVEL - getTerrainHeight(vx(i), vz(i)));
      expect(grid.depth[i]).toBeCloseTo(want, 4);
    }
  });

  it('is positive at the river centre', () => {
    for (const z of [-40, -10, 0, 20, 60]) {
      const i = nearest(riverCenterX(z), z);
      expect(Math.hypot(vx(i) - riverCenterX(z), vz(i) - z), `no vertex near the river at z ${z}`).toBeLessThan(1);
      expect(grid.depth[i], `river depth at z ${z}`).toBeGreaterThan(0);
    }
  });

  it('is positive at each basin centre', () => {
    for (const b of BASINS) {
      const i = nearest(b.x, b.z);
      expect(Math.hypot(vx(i) - b.x, vz(i) - b.z), `no vertex near ${b.id}`).toBeLessThan(1);
      expect(grid.depth[i], b.id).toBeGreaterThan(0);
    }
  });
});

describe('flow', () => {
  it('is a unit vector along the river and points along its tangent', () => {
    for (const z of [-40, -10, 0, 20, 60]) {
      const i = nearest(riverCenterX(z), z);
      expect(flowLen(i), `flow length at z ${z}`).toBeCloseTo(1, 4);
      // The tangent of x = riverCenterX(z) is (dx/dz, 1) up to sign, so the flow is parallel to it.
      const dx = (riverCenterX(z + 0.01) - riverCenterX(z - 0.01)) / 0.02;
      const tl = Math.hypot(dx, 1);
      const f = flowAt(i);
      const fx = f[0];
      const fz = f[flowStride - 1];
      expect(Math.abs((fx * 1 - fz * dx) / tl), `flow is off the tangent at z ${z}`).toBeLessThan(0.02);
    }
  });

  it('every vertex within 4 units of the river centre has unit flow', () => {
    for (let i = 0; i < vertexCount; i++) {
      if (Math.abs(vx(i) - riverCenterX(vz(i))) <= 4) expect(flowLen(i)).toBeCloseTo(1, 4);
    }
  });

  it('is zero in the ponds', () => {
    for (const b of BASINS) {
      let seen = 0;
      for (let i = 0; i < vertexCount; i++) {
        if (Math.hypot(vx(i) - b.x, vz(i) - b.z) <= b.radius) {
          seen++;
          expect(flowLen(i), `${b.id} vertex ${i}`).toBe(0);
        }
      }
      expect(seen, `${b.id} has vertices`).toBeGreaterThan(0);
    }
  });

  it('every flow is zero or a unit vector', () => {
    for (let i = 0; i < vertexCount; i++) {
      const l = flowLen(i);
      expect(l === 0 || Math.abs(l - 1) < 1e-4, `flow length ${l} at vertex ${i}`).toBe(true);
    }
  });
});
