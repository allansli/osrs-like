import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ATTACKS } from '../src/data/attacks';
import { G } from '../src/engine/context';
import type { MonsterEntity } from '../src/engine/context';
import { clearTelegraph, showTelegraph, updateTelegraphs } from '../src/engine/telegraphs';
import { fillScale } from '../src/state/telegraph';
import { getTerrainHeight, TERRAIN_SEGMENTS, TERRAIN_SIZE } from '../src/state/terrain';

vi.mock('../src/state/terrain', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/state/terrain')>();
  return { ...real, getTerrainHeight: vi.fn(real.getTerrainHeight) };
});
const heightCalls = (): number => vi.mocked(getTerrainHeight).mock.calls.length;

// Built as worldMesh.buildTerrainAndWater builds the ground.
let terrain: THREE.Mesh | null = null;
function terrainMesh(): THREE.Mesh {
  if (terrain) return terrain;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
  terrain = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  terrain.updateMatrixWorld();
  return terrain;
}

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

describe('telegraph fill (review 7): terrain is sampled when the shape is built, never per frame', () => {
  for (const id of Object.keys(ATTACKS)) {
    it(`${id}: updateTelegraphs samples no terrain and the fill still sits on the ground`, () => {
      // A slope near the world centre, so a flat cache would be caught.
      const m = show(id, 37, -21);
      const before = heightCalls();
      for (let i = 0; i < 5; i++) updateTelegraphs((0.2 * ATTACKS[id].windupMs) / 1000);
      expect(heightCalls()).toBe(before);
      // The fill must sit 0.06 above the terrain as the mesh draws it: raycast the real terrain mesh.
      const arr = m.telegraph!.fillMesh.geometry.attributes.position.array as Float32Array;
      const ray = new THREE.Raycaster();
      for (let i = 0; i < arr.length; i += 3) {
        ray.set(new THREE.Vector3(arr[i], 500, arr[i + 2]), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(terrainMesh())[0];
        expect(Math.abs(arr[i + 1] - (hit.point.y + 0.06))).toBeLessThan(1e-3);
      }
      clearTelegraph(m);
    });
  }
});

describe('telegraph fill (review 7): lattice', () => {
  const triangles = (id: string): number => {
    const m = show(id);
    const n = m.telegraph!.fillMesh.geometry.index!.count / 3;
    clearTelegraph(m);
    return n;
  };
  it('every fill but the Ashen Nova ring is under the 400-triangle budget (design 8)', () => {
    for (const id of Object.keys(ATTACKS)) if (id !== 'ashen_nova') expect(triangles(id)).toBeLessThan(400);
  });
  it('ashen_nova stays within the ring-fill exception recorded in design section 8 (open as CALL-4.20)', () => {
    const doc = readFileSync('docs/superpowers/specs/2026-11-14-combat-weight-design.md', 'utf8');
    const row = doc.split('\n').find(l => l.startsWith('| Live telegraph meshes |'))!;
    const m = /Ashen Nova ring's fill[^|]*?at most ([\d,]+) triangles[^|]*CALL-4\.20/.exec(row);
    expect(m).not.toBeNull();
    const recorded = Number(m![1].replace(/,/g, ''));
    expect(recorded).toBeLessThan(1400);
    expect(triangles('ashen_nova')).toBeLessThanOrEqual(recorded);
  });
  // Design 6.5: fill vertices no farther apart than the terrain's own, about 1.5 units, so a slope cannot poke through.
  // Each lattice triangle has a row edge and a column edge within that spacing; the third edge is the cell diagonal.
  for (const id of Object.keys(ATTACKS)) {
    it(`${id}: at full size every fill triangle's two shorter edges are at most 1.5 units`, () => {
      const m = show(id);
      updateTelegraphs(ATTACKS[id].windupMs / 1000);
      const geo = m.telegraph!.fillMesh.geometry;
      const arr = geo.attributes.position.array as Float32Array;
      const idx = geo.index!.array;
      const d = (a: number, b: number) => Math.hypot(arr[3 * a] - arr[3 * b], arr[3 * a + 2] - arr[3 * b + 2]);
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
        const e = [d(a, b), d(b, c), d(c, a)].sort((x, y) => x - y);
        expect(e[1]).toBeLessThanOrEqual(1.5 + 1e-4);
      }
      clearTelegraph(m);
    });
  }
});

describe('telegraph sound (review 10): clearing a shape stops its wind-up voices', () => {
  it('every voice attached to the telegraph is stopped once on clear', () => {
    const m = show('overhead_slam');
    const voices = [vi.fn(), vi.fn(), vi.fn()];
    m.telegraph!.sound = voices;
    clearTelegraph(m);
    for (const v of voices) expect(v).toHaveBeenCalledTimes(1);
    clearTelegraph(m);
    for (const v of voices) expect(v).toHaveBeenCalledTimes(1);
  });
});
