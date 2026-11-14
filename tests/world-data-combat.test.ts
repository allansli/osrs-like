import { describe, expect, it } from 'vitest';
import { CAMPS } from '../src/data/worldMap';
import { buildWalkGrid, findPath } from '../src/state/pathfind';

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
});
