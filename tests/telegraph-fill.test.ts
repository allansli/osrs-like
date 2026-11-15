import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATTACKS } from '../src/data/attacks';
import { G } from '../src/engine/context';
import type { MonsterEntity } from '../src/engine/context';
import { clearTelegraph, showTelegraph, updateTelegraphs } from '../src/engine/telegraphs';
import { fillScale } from '../src/state/telegraph';

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

describe('telegraph fill (review 6): the ring fill grows outward from the inner edge', () => {
  const nova = ATTACKS.ashen_nova.shape;
  if (nova.type !== 'ring') throw new Error('ashen_nova is expected to be a ring');

  it('fillScale keeps every ring point between the inner edge and the outline', () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      for (const r of [nova.inner, (nova.inner + nova.outer) / 2, nova.outer]) {
        const grown = r * fillScale(nova, r, p);
        expect(grown).toBeGreaterThanOrEqual(nova.inner - 1e-9);
        expect(grown).toBeLessThanOrEqual(r + 1e-9);
      }
    }
    expect(nova.outer * fillScale(nova, nova.outer, 0)).toBeCloseTo(nova.inner, 9);
    expect(nova.outer * fillScale(nova, nova.outer, 1)).toBeCloseTo(nova.outer, 9);
  });

  it('fillScale scales circle, cone and line from the origin by progress', () => {
    for (const id of ['slagburst', 'ember_cone', 'scorch_lane']) {
      expect(fillScale(ATTACKS[id].shape, 5, 0.3)).toBe(0.3);
    }
  });

  it('ashen_nova: at a quarter of the wind-up no fill vertex lies inside the safe circle', () => {
    const m = show('ashen_nova');
    updateTelegraphs(0.25 * (ATTACKS.ashen_nova.windupMs / 1000));
    const arr = m.telegraph!.fillMesh.geometry.attributes.position.array as Float32Array;
    let maxR = 0;
    for (let i = 0; i < arr.length; i += 3) {
      const r = Math.hypot(arr[i], arr[i + 2]);
      expect(r).toBeGreaterThanOrEqual(nova.inner - 1e-3);
      maxR = Math.max(maxR, r);
    }
    expect(maxR).toBeCloseTo(nova.inner + 0.25 * (nova.outer - nova.inner), 2);
    clearTelegraph(m);
  });
});
