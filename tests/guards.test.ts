// N1 (models pass): the castle guards are dressed hero instances (design 10.3). Red until N2.
// What must not change is read from today's createCastleGuard (src/engine/worldBuild.ts) and written here:
// the two positions in createWorld, the label, the dialogue, the 0.45 x 1.85 hitbox, the five userData keys.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G } from '../src/engine/context';
import { buildHumanoidRig } from '../src/engine/humanoid';
import { getTerrainHeight } from '../src/state/terrain';

// The loader stub: every URL asked of loadGltfOnce is recorded, and a file that exists under public/models is parsed.
const { requested, pending } = vi.hoisted(() => ({ requested: [] as string[], pending: [] as Promise<unknown>[] }));
vi.mock('../src/engine/gltf', async () => {
  const fsm = await import('node:fs');
  const pathm = await import('node:path');
  const { GLTFLoader: Loader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  return {
    loadGltfOnce(url: string): Promise<GLTF | null> {
      requested.push(url);
      const file = pathm.resolve(__dirname, '../public', url.replace(/^\//, '').split('?')[0]);
      const p = fsm.existsSync(file)
        ? (() => {
            const buf = fsm.readFileSync(file);
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            return new Promise<GLTF | null>((resolve, reject) => new Loader().parse(ab as ArrayBuffer, '', resolve, reject));
          })()
        : Promise.resolve(null);
      pending.push(p);
      return p;
    }
  };
});

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
// The templates resolve only where `window` and `document` exist; textures get an image that never loads.
vi.stubGlobal('document', { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_: string) {} }) });

import { createCastleGuard } from '../src/engine/worldBuild';
import { upgradeHumanoidRigWithGltf } from '../src/engine/blenderHero';

const NAME = 'Lumbridge Castle Guard';
const SPOTS: [number, number][] = [[-2.4, -15.3], [2.4, -15.3]]; // createWorld's two calls, in front of the gate wall (its face is at z -16.3)
const USER_DATA = {
  type: 'interactive',
  action: 'dialogue',
  name: NAME,
  dialogue: 'Halt! Welcome to Lumbridge Castle, adventurer. Keep your weapons sheathed within the courtyard.',
  interactRadius: 3.5
};
const MAX_MESHES = 35;

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await Promise.all(pending);
    await new Promise((r) => setTimeout(r, 0));
  }
};
const withoutFlag = (o: Record<string, unknown>): Record<string, unknown> => {
  const { isBlenderHero: _flag, ...rest } = o;
  return rest;
};
const bonesOf = (root: THREE.Object3D): Set<THREE.Object3D> => {
  const bones = new Set<THREE.Object3D>();
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) sm.skeleton.bones.forEach((b) => bones.add(b));
  });
  return bones;
};

let heroGltf: GLTF;
let hitboxes: THREE.Object3D[];
let roots: THREE.Object3D[];

beforeAll(async () => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models/hero.glb'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  heroGltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
});

beforeEach(async () => {
  requested.length = 0;
  pending.length = 0;
  G.scene = new THREE.Scene();
  G.worldInteractiveObjects.length = 0;
  G.npcList.length = 0;
  G.npcAnimatorsList.length = 0;
  for (const [x, z] of SPOTS) createCastleGuard(x, z, NAME, 0);
  await settle();
  G.scene.updateMatrixWorld(true);
  hitboxes = G.worldInteractiveObjects.filter((o) => o.userData.name === NAME);
  roots = hitboxes.map((h) => h.parent!);
});

describe('what stays the same', () => {
  it('builds two guards at the two spots, with the label the minimap and name tags read', () => {
    expect(hitboxes).toHaveLength(2);
    expect(G.npcList).toHaveLength(2);
    SPOTS.forEach(([x, z], i) => {
      expect(roots[i].position.toArray()).toEqual([x, getTerrainHeight(x, z), z]);
      expect(G.npcList[i]).toEqual({ pos: roots[i].position, name: NAME, color: '#94a3b8', yOffset: 2.5 });
      expect(G.npcList[i].pos).toBe(roots[i].position);
    });
  });

  it('keeps the dialogue and the five userData keys, on the figure and on the hitbox', () => {
    for (let i = 0; i < 2; i++) {
      expect(withoutFlag(roots[i].userData)).toEqual(USER_DATA);
      expect(withoutFlag(hitboxes[i].userData)).toEqual(USER_DATA);
    }
  });

  it('keeps a hitbox of 0.45 radius, 1.85 tall (8 sides), which is what is clicked', () => {
    const ref = new THREE.Box3().setFromBufferAttribute(new THREE.CylinderGeometry(0.45, 0.45, 1.85, 8).attributes.position as THREE.BufferAttribute);
    const want = ref.getSize(new THREE.Vector3());
    for (const h of hitboxes) {
      const got = new THREE.Box3().setFromObject(h).getSize(new THREE.Vector3());
      expect(got.distanceTo(want)).toBeLessThan(1e-5);
    }
  });
});

describe('dressed hero instances', () => {
  it('flags each figure isBlenderHero once the hero template has resolved', () => {
    for (const r of roots) expect(r.userData.isBlenderHero).toBe(true);
  });

  it('asks for no guard.glb', () => {
    expect(requested.filter((u) => u.includes('guard.glb'))).toEqual([]);
  });

  it('has at most 35 meshes per guard (outline shells and the hitbox not counted)', () => {
    for (const r of roots) {
      let n = 0;
      r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !m.userData.isOutline && !m.userData.isCollider && o !== hitboxes[roots.indexOf(r)]) n++;
      });
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(MAX_MESHES);
    }
  });

  it('gives each guard its own skeleton: posing one moves neither the other nor the player', () => {
    const player = buildHumanoidRig();
    expect(upgradeHumanoidRigWithGltf(player, heroGltf)).not.toBeNull();
    G.scene.add(player.group);
    const sets = [bonesOf(roots[0]), bonesOf(roots[1]), bonesOf(player.group)];
    sets.forEach((s) => expect(s.size).toBeGreaterThan(0));
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        for (const b of sets[i]) expect(sets[j].has(b)).toBe(false);
      }
    }
    for (const b of sets[0]) {
      let up: THREE.Object3D | null = b;
      while (up && up !== roots[0]) up = up.parent;
      expect(up, `bone ${b.name} hangs under its own guard`).toBe(roots[0]);
    }
    const arm = (root: THREE.Object3D) => root.getObjectByName('LeftArmPivot')!;
    const before = [arm(roots[1]).quaternion.clone(), arm(player.group).quaternion.clone()];
    arm(roots[0]).quaternion.setFromEuler(new THREE.Euler(1.2, 0, 0));
    G.scene.updateMatrixWorld(true);
    expect(arm(roots[1]).quaternion.angleTo(before[0])).toBe(0);
    expect(arm(player.group).quaternion.angleTo(before[1])).toBe(0);
  });
});
