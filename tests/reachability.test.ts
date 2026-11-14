import { describe, expect, it } from 'vitest';
import { WORLD_REGIONS } from '../src/data/world';
import { RIDGES, type RidgeDef } from '../src/data/worldMap';
import { isWalkable } from '../src/state/collision';
import { buildWalkGrid, type WalkGrid } from '../src/state/pathfind';
import { shrineWorldPos } from '../src/state/shrines';

// Design 6.11, G2.5. The start point is the player's spawn in context.ts.
const START: [number, number] = [-4, -3];
const LAST_SHRINE = 'wilderness';

/**
 * Cells reachable from `from` on the walk grid (1-unit cells over ±118, cell centres at half units).
 * Four-neighbour fill: with no corner cutting, an eight-neighbour walk reaches exactly the same cells.
 * Uses the grid's own `size` and `walkable` predicate; the layout of `grid.cells` is B2's and is not read here.
 */
function reachable(grid: WalkGrid, from: [number, number]): (x: number, z: number) => boolean {
  const n = grid.size;
  const lo = -n / 2;
  const open = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (grid.walkable(lo + i + 0.5, lo + j + 0.5)) {
        open[i * n + j] = 1;
      }
    }
  }
  const cellOf = (x: number, z: number) => Math.floor(x - lo) * n + Math.floor(z - lo);
  const seen = new Uint8Array(n * n);
  const start = cellOf(from[0], from[1]);
  expect(open[start], 'start cell is walkable').toBe(1);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    const i = Math.floor(c / n);
    const j = c % n;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const k = ni * n + nj;
      if (open[k] && !seen[k]) {
        seen[k] = 1;
        stack.push(k);
      }
    }
  }
  return (x, z) => seen[cellOf(x, z)] === 1;
}

function nearestOnPolyline(points: [number, number][], x: number, z: number): { d: number; qx: number; qz: number } {
  let best = { d: Infinity, qx: 0, qz: 0 };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const lx = bx - ax;
    const lz = bz - az;
    const len2 = lx * lx + lz * lz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / len2));
    const qx = ax + lx * t;
    const qz = az + lz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, qx, qz };
  }
  return best;
}

/** Cinderstep Pass: across the ridge, where the nearest crest point is within the gap (plus a 1-unit margin). */
function inPass(ridge: RidgeDef, x: number, z: number): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  if (n.d > ridge.halfWidth + 1) return false;
  return ridge.gaps.some((g) => Math.hypot(n.qx - g.at[0], n.qz - g.at[1]) <= g.halfWidth + 1);
}

describe('reachability', () => {
  it('flood fill from the start point reaches every shrine', () => {
    const seen = reachable(buildWalkGrid(), START);
    for (const r of WORLD_REGIONS) {
      const s = shrineWorldPos(r);
      expect(seen(s.x, s.z), `${r.id} shrine (${s.x}, ${s.z})`).toBe(true);
    }
  });

  it('with the Cinderstep Pass cells blocked the last shrine is unreachable', () => {
    expect(RIDGES).toHaveLength(1);
    const ridge = RIDGES[0];
    expect(ridge.gaps).toHaveLength(1);
    const seen = reachable(buildWalkGrid((x: number, z: number) => isWalkable(x, z) && !inPass(ridge, x, z)), START);
    for (const r of WORLD_REGIONS) {
      const s = shrineWorldPos(r);
      expect(seen(s.x, s.z), `${r.id} shrine (${s.x}, ${s.z})`).toBe(r.id !== LAST_SHRINE);
    }
  });
});
