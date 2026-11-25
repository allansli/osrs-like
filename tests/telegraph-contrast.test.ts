import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ATTACKS } from '../src/data/attacks';
import { G } from '../src/engine/context';
import type { MonsterEntity } from '../src/engine/context';
import { clearTelegraph, showTelegraph } from '../src/engine/telegraphs';

const meshes = (m: MonsterEntity): THREE.Mesh[] =>
  (m.telegraph!.group.children as THREE.Mesh[]).filter((c) => c.isMesh);

describe('telegraph contrast', () => {
  for (const id of Object.keys(ATTACKS)) {
    it(`${id}: a halo then a band, both ignoring depth, all disposed on clear`, () => {
      G.scene = new THREE.Scene();
      const monster = { telegraph: null } as unknown as MonsterEntity;
      showTelegraph(monster, { kind: 'windup', attackId: id, ox: 0, oz: 0, dx: 0, dz: 1, ms: 1000 });
      const t = monster.telegraph!;
      const all = meshes(monster);
      const halo = t.haloMesh;
      const band = t.outlineMesh;
      expect(halo).toBeDefined();
      expect(all.indexOf(halo)).toBeLessThan(all.indexOf(band));
      expect(halo.renderOrder).toBeLessThan(band.renderOrder);
      for (const m of [halo, band]) {
        expect((m.material as THREE.Material).depthTest).toBe(false);
        expect(m.renderOrder).toBeGreaterThan(0);
      }
      expect(t.fillMesh.material as THREE.Material).toHaveProperty('depthTest', true);

      const spies = all.flatMap((m) => [
        vi.spyOn(m.geometry, 'dispose'),
        vi.spyOn(m.material as THREE.Material, 'dispose')
      ]);
      clearTelegraph(monster);
      for (const s of spies) expect(s).toHaveBeenCalled();
      expect(monster.telegraph).toBeNull();
    });
  }
});
