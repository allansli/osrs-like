import { describe, expect, it } from 'vitest';
import { MONSTER_PLACEMENTS, NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';
import { BASINS } from '../src/data/worldMap';
import { isDeepWater, isWalkable } from '../src/state/collision';
import { getTerrainHeight } from '../src/state/terrain';

const fishing = NODE_PLACEMENTS.filter((p) => p.type.startsWith('fish_'));

describe('placements', () => {
  it('every monster type has a MONSTER_TYPES entry', () => {
    for (const p of MONSTER_PLACEMENTS) {
      expect(Object.hasOwn(MONSTER_TYPES, p.type), `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });

  it('every node type has a RESOURCE_NODES_DEF entry', () => {
    for (const p of NODE_PLACEMENTS) {
      expect(Object.hasOwn(RESOURCE_NODES_DEF, p.type), `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });

  it('every monster point is walkable', () => {
    for (const p of MONSTER_PLACEMENTS) {
      expect(isWalkable(p.x, p.z), `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });

  it('every fishing point stands on unwalkable water: river by isDeepWater, or a basin', () => {
    expect(fishing.length).toBeGreaterThan(0);
    for (const p of fishing) {
      const inBasin = BASINS.some((b) => Math.hypot(p.x - b.x, p.z - b.z) <= b.radius && getTerrainHeight(p.x, p.z) < -0.34);
      expect(isDeepWater(p.x, p.z) || inBasin, `${p.type} at (${p.x}, ${p.z})`).toBe(true);
      expect(isWalkable(p.x, p.z), `${p.type} at (${p.x}, ${p.z})`).toBe(false);
    }
  });

  it('every fishing point is within 3.1 of a walkable point', () => {
    for (const p of fishing) {
      let found = false;
      for (let i = 0; i < 16 && !found; i++) {
        const a = (i / 16) * Math.PI * 2;
        found = isWalkable(p.x + Math.cos(a) * 3.1, p.z + Math.sin(a) * 3.1);
      }
      expect(found, `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });
});
