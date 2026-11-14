import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPS } from '../src/data/worldMap';
import { buildWalkGrid, findPath, nearestOpenCell, openStart, segmentWalkable } from '../src/state/pathfind';

const GOLDEN = new URL('./fixtures/pathfind-golden.json', import.meta.url);
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const grid = buildWalkGrid();

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function openCell(rand: () => number): [number, number] {
  for (;;) {
    const gx = Math.floor(rand() * grid.size);
    const gz = Math.floor(rand() * grid.size);
    if (grid.cells[gz * grid.size + gx] === 1) return [grid.origin + gx + 0.5, grid.origin + gz + 0.5];
  }
}

function seededPairs(): { from: [number, number]; to: [number, number] }[] {
  const rand = seeded(4242);
  const pairs: { from: [number, number]; to: [number, number] }[] = [];
  for (let i = 0; i < 200; i++) {
    // Keep pairs within 60 units so the golden stays small and the run fast.
    const from = openCell(rand);
    let to = openCell(rand);
    while (Math.hypot(to[0] - from[0], to[1] - from[1]) > 60) to = openCell(rand);
    pairs.push({ from, to });
  }
  return pairs;
}

describe('pathfinder budget', () => {
  it('a search past maxExpanded returns null', () => {
    const from: [number, number] = [-4, -3];
    const to: [number, number] = [50, -26];
    expect(findPath(grid, from, to, { expanded: 0 }, 50)).toBeNull();
  });

  it('without maxExpanded the same search returns a route', () => {
    const route = findPath(grid, [-4, -3], [50, -26], { expanded: 0 });
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(0);
  });

  it('routes equal the golden on 200 seeded pairs', () => {
    const live = seededPairs().map(({ from, to }) => findPath(grid, from, to));
    if (UPDATE) {
      writeFileSync(GOLDEN, JSON.stringify(live) + '\n');
      return;
    }
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as ([number, number][] | null)[];
    expect(golden.length).toBe(200);
    live.forEach((route, i) => {
      const want = golden[i];
      if (want === null) {
        expect(route, `pair ${i}`).toBeNull();
        return;
      }
      expect(route, `pair ${i}`).not.toBeNull();
      expect(route!.length, `pair ${i} waypoints`).toBe(want.length);
      route!.forEach((p, j) => {
        expect(Math.abs(p[0] - want[j][0]), `pair ${i} wp ${j} x`).toBeLessThan(1e-9);
        expect(Math.abs(p[1] - want[j][1]), `pair ${i} wp ${j} z`).toBeLessThan(1e-9);
      });
    });
  });

  it('a second search allocates no typed array', () => {
    const from: [number, number] = [-4, -3];
    const to: [number, number] = [-30, 20];
    expect(findPath(grid, from, to)).not.toBeNull(); // the first call may build the scratch set
    const cells = grid.size * grid.size;
    const g = globalThis as unknown as Record<string, unknown>;
    const names = ['Float64Array', 'Int32Array', 'Uint8Array'];
    const originals = names.map((n) => g[n]);
    let big = 0;
    names.forEach((n, i) => {
      g[n] = new Proxy(originals[i] as new (...a: unknown[]) => object, {
        construct(target, args, newTarget) {
          if (args[0] === cells) big++;
          return Reflect.construct(target, args, newTarget);
        }
      });
    });
    try {
      expect(findPath(grid, from, to)).not.toBeNull();
    } finally {
      names.forEach((n, i) => {
        g[n] = originals[i];
      });
    }
    expect(big).toBe(0);
  });

  it('openStart returns the point itself when its cell is open and the nearest open cell centre when not', () => {
    expect(openStart(grid, -4, -3)).toEqual([-4, -3]);
    // inside the castle's south wall: a blocked cell
    const gx = Math.floor(0 - grid.origin);
    const gz = Math.floor(-34 - grid.origin);
    expect(grid.cells[gz * grid.size + gx]).toBe(0);
    const want = nearestOpenCell(grid, 0, -34);
    expect(want).not.toBeNull();
    expect(openStart(grid, 0, -34)).toEqual(want);
  });

  it('segmentWalkable is true across open ground and along the bridge deck, false across the castle wall and across the river off the bridge', () => {
    expect(segmentWalkable(grid, [-4, -3], [-14, -3])).toBe(true);
    expect(segmentWalkable(grid, [22, 0], [34, 0])).toBe(true);
    expect(segmentWalkable(grid, [0, -40], [0, -30])).toBe(false);
    expect(segmentWalkable(grid, [20, 10], [36, 10])).toBe(false);
  });

  it('around every camp, a search to each home from 32 points at leash and leash + 11 expands at most 6000 cells', () => {
    let calls = 0;
    let worst = 0;
    for (const camp of CAMPS) {
      for (const mem of camp.members) {
        for (const R of [camp.radius + 4, camp.radius + 4 + 11]) {
          for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2;
            const from: [number, number] = [camp.x + Math.cos(ang) * R, camp.z + Math.sin(ang) * R];
            const fx = Math.floor(from[0] - grid.origin);
            const fz = Math.floor(from[1] - grid.origin);
            if (fx < 0 || fz < 0 || fx >= grid.size || fz >= grid.size || grid.cells[fz * grid.size + fx] !== 1) continue;
            const stats = { expanded: 0 };
            findPath(grid, from, [mem.x, mem.z], stats);
            calls++;
            worst = Math.max(worst, stats.expanded);
          }
        }
      }
    }
    expect(calls).toBeGreaterThan(500);
    expect(worst).toBeLessThanOrEqual(6000);
  });
});
