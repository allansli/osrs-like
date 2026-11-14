import { describe, expect, it } from 'vitest';
import { MONSTER_PLACEMENTS, NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';
import { isWalkable, riverCenterX } from '../src/state/collision';

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

  it('every fishing point is within 6.8 of riverCenterX(z)', () => {
    expect(fishing.length).toBeGreaterThan(0);
    for (const p of fishing) {
      expect(Math.abs(p.x - riverCenterX(p.z)), `${p.type} at (${p.x}, ${p.z})`).toBeLessThanOrEqual(6.8);
    }
  });

  // Known defect kept by "same coordinates", fixed in Stage 2 (design 5.7): the river's deep-water band
  // makes these two unwalkable beyond 3.1 (3.28 and 3.97 from the nearest walkable point).
  const KNOWN_DEEP = new Set(['26,-8', '28,-62']);

  it('every fishing point is within 3.1 of a walkable point', () => {
    for (const p of fishing) {
      if (KNOWN_DEEP.has(`${p.x},${p.z}`)) continue;
      let found = false;
      for (let i = 0; i < 16 && !found; i++) {
        const a = (i / 16) * Math.PI * 2;
        found = isWalkable(p.x + Math.cos(a) * 3.1, p.z + Math.sin(a) * 3.1);
      }
      expect(found, `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });
});
