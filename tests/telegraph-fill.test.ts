import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATTACKS } from '../src/data/attacks';
import { G } from '../src/engine/context';
import type { MonsterEntity } from '../src/engine/context';
import { clearTelegraph, showTelegraph, updateTelegraphs } from '../src/engine/telegraphs';

function show(attackId: string, ox = 0, oz = 0): MonsterEntity {
  G.scene = new THREE.Scene();
  const monster = { telegraph: null } as unknown as MonsterEntity;
  const ms = ATTACKS[attackId].windupMs;
  showTelegraph(monster, { kind: 'windup', attackId, ox, oz, dx: 0, dz: 1, ms });
  return monster;
}

describe('telegraph fill (review 5): never culled by a sphere frozen at its first small frame', () => {
  for (const id of Object.keys(ATTACKS)) {
    it(`${id}: the fill mesh is not frustum-culled`, () => {
      const m = show(id);
      updateTelegraphs(0.016);
      expect(m.telegraph!.fillMesh.frustumCulled).toBe(false);
      clearTelegraph(m);
    });
  }
});
