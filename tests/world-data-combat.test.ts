import { describe, expect, it } from 'vitest';
import { BOSS_ARENA_MARGIN } from '../src/data/attacks';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, PATHS, POIS, SAFE_ZONES } from '../src/data/worldMap';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { buildWalkGrid, findPath } from '../src/state/pathfind';
import { getTerrainHeight } from '../src/state/terrain';

// Design 6.1, closing the "cannot get home" defect class on the real data.
const grid = buildWalkGrid();
const cellOf = (x: number, z: number) => Math.floor(z - grid.origin) * grid.size + Math.floor(x - grid.origin);

describe('camps on the walk grid (design 6.1)', () => {
  it('every camp member home cell is open', () => {
    const closed = CAMPS.flatMap((c) => c.members.filter((m) => grid.cells[cellOf(m.x, m.z)] !== 1).map((m) => `${c.id} ${m.type} (${m.x}, ${m.z})`));
    expect(closed).toEqual([]);
  });

  it('a route exists to every home from every open cell within leash + 11 of its camp', () => {
    // findPath's moves (8 neighbours, no corner cutting) are symmetric, so one fill from each home
    // finds every cell that has a route to it; the farthest of them is then searched under the cap.
    const missing: string[] = [];
    let checked = 0;
    for (const camp of CAMPS) {
      const R = camp.radius + 4 + 11;
      for (const mem of camp.members) {
        const seen = new Uint8Array(grid.size * grid.size);
        const queue = [cellOf(mem.x, mem.z)];
        seen[queue[0]] = 1;
        for (let q = 0; q < queue.length; q++) {
          const gx = queue[q] % grid.size;
          const gz = (queue[q] / grid.size) | 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = gx + dx;
              const nz = gz + dz;
              if ((dx === 0 && dz === 0) || nx < 0 || nz < 0 || nx >= grid.size || nz >= grid.size) continue;
              const id = nz * grid.size + nx;
              if (seen[id] || grid.cells[id] !== 1) continue;
              if (dx !== 0 && dz !== 0 && (grid.cells[gz * grid.size + nx] !== 1 || grid.cells[nz * grid.size + gx] !== 1)) continue;
              seen[id] = 1;
              queue.push(id);
            }
          }
        }
        let far: [number, number] | null = null;
        let farD = -1;
        for (let id = 0; id < grid.cells.length; id++) {
          if (grid.cells[id] !== 1) continue;
          const c: [number, number] = [grid.origin + (id % grid.size) + 0.5, grid.origin + ((id / grid.size) | 0) + 0.5];
          const d = Math.hypot(c[0] - camp.x, c[1] - camp.z);
          if (d > R) continue;
          checked++;
          if (!seen[id]) missing.push(`${camp.id} ${mem.type} from (${c[0]}, ${c[1]})`);
          else if (d > farD) { farD = d; far = c; }
        }
        // The search a returning monster makes, under the monsters' cap.
        expect(findPath(grid, far!, [mem.x, mem.z], undefined, 6000), `${camp.id} ${mem.type} from the farthest cell`).not.toBeNull();
      }
    }
    expect(checked).toBeGreaterThan(10000);
    expect(missing.slice(0, 20)).toEqual([]);
  });

  it('every boss arena passes the placement criterion of design 6.4', () => {
    // decisions.ts section 3, on the live tables. Reach: 2.9 for melee monsters, 11 for the rest (monsterAi.ts).
    const WORLD = 118;
    const NODE_CLEAR = 2;
    const MAX_STEP = 0.8;
    const arenas = CAMPS.filter((c) => c.arenaRadius !== undefined);
    expect(arenas.map((c) => c.id)).toEqual(['ashmantle']);
    for (const camp of arenas) {
      const R = camp.arenaRadius!;
      const big = R + BOSS_ARENA_MARGIN;
      const { x, z } = camp;
      const fails: string[] = [];
      for (const c of CAMPS) {
        if (c === camp) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        const reach = Math.max(...c.members.map((m) => (MONSTER_TYPES[m.type].style === 'melee' ? 2.9 : 11)));
        if (d - (c.radius + 4) - big <= 0) fails.push(`margin inside the leash circle of ${c.id}`);
        if (d - (c.radius + 4 + reach) - R <= 0) fails.push(`arena inside the attack reach of ${c.id}`);
        if (c.aggressive && d - c.aggroRadius! - R <= 0) fails.push(`arena inside the aggression circle of ${c.id}`);
      }
      for (const s of SAFE_ZONES) if (Math.hypot(s.x - x, s.z - z) - s.radius - big <= 0) fails.push(`margin inside safe zone ${s.id}`);
      if (Math.abs(x) + R > WORLD || Math.abs(z) + R > WORLD) fails.push('arena past the world bound');
      let cells = 0;
      for (let id = 0; id < grid.cells.length; id++) {
        const cx = grid.origin + (id % grid.size) + 0.5;
        const cz = grid.origin + ((id / grid.size) | 0) + 0.5;
        if (Math.hypot(cx - x, cz - z) > R) continue;
        cells++;
        if (grid.cells[id] !== 1) fails.push(`arena cell (${cx}, ${cz}) blocked`);
      }
      expect(cells).toBeGreaterThan(400);
      for (const path of PATHS) {
        for (let i = 1; i < path.points.length; i++) {
          const [ax, az] = path.points[i - 1];
          const [bx, bz] = path.points[i];
          for (let k = 0; k <= 20; k++) {
            const d = Math.hypot(ax + ((bx - ax) * k) / 20 - x, az + ((bz - az) * k) / 20 - z);
            if (d - path.halfWidth - big <= 0) { fails.push(`path ${path.id} inside the margin`); break; }
          }
        }
      }
      for (const q of POIS) if (Math.hypot(q.x - x, q.z - z) - q.padRadius - big <= 0) fails.push(`pad ${q.id} inside the margin`);
      for (const n of NODE_PLACEMENTS) if (Math.hypot(n.x - x, n.z - z) - R - NODE_CLEAR <= 0) fails.push(`resource node at (${n.x}, ${n.z})`);
      let steep = 0;
      for (let dx = -R; dx <= R; dx += 0.5) {
        for (let dz = -R; dz <= R; dz += 0.5) {
          if (Math.hypot(dx, dz) > R) continue;
          const h = getTerrainHeight(x + dx, z + dz);
          steep = Math.max(steep, Math.abs(getTerrainHeight(x + dx + 1, z + dz) - h), Math.abs(getTerrainHeight(x + dx, z + dz + 1) - h));
        }
      }
      if (steep > MAX_STEP) fails.push(`ground ${steep.toFixed(2)} per unit`);
      for (const m of camp.members) {
        if (findPath(grid, [-48, 55], [m.x, m.z]) === null) fails.push(`${m.type} home unreachable from the pass's west mouth`);
      }
      expect(fails, `${camp.id} at (${x}, ${z})`).toEqual([]);
    }
  });
});
