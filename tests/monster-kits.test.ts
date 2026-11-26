// B1: the optional `kit` look field. Red until the [AGY] part lands: a def with a kit gets the
// children of `Kit_<kit>` added under the bones of the same name.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../src/engine/blenderMonsters';
import { MONSTER_TYPES } from '../src/data/world';

/** A skinned `Monster_<key>` (bones `<key>_Hips` > `<key>_Arm`, one skin-material mesh) in an in-memory scene. */
function skinnedFigure(key: string, mesh = 'Body'): THREE.Group {
  const root = new THREE.Group();
  root.name = `Monster_${key}`;
  const hips = new THREE.Bone();
  hips.name = `${key}_Hips`;
  const arm = new THREE.Bone();
  arm.name = `${key}_Arm`;
  arm.position.set(0, 1, 0);
  hips.add(arm);
  root.add(hips);
  root.updateMatrixWorld(true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0.5, 1, 0, 0, 1.5, 0], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial({ name: 'skin' }));
  m.name = mesh;
  root.add(m);
  m.bind(new THREE.Skeleton([hips, arm]));
  return root;
}

function kitNode(kit: string, childNames: string[]): THREE.Group {
  const node = new THREE.Group();
  node.name = `Kit_${kit}`;
  for (const n of childNames) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ name: 'bronze' }));
    c.name = n;
    node.add(c);
  }
  return node;
}

function entity(typeKey: string, def: Record<string, unknown> = {}): MonsterEntityLike {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  group.add(hitbox);
  return { typeKey, modelKey: typeKey, def: def as MonsterEntityLike['def'], rig: { group, hitbox }, pos: new THREE.Vector3(1, 0, 1) };
}

const gltfOf = (...nodes: THREE.Object3D[]): GLTF => {
  const scene = new THREE.Group();
  nodes.forEach((n) => scene.add(n));
  return { scene } as unknown as GLTF;
};

describe('a def with a kit', () => {
  const setup = () => {
    const kit = kitNode('spiked', ['spiked_Arm', 'spiked_Stray']);
    const gltf = gltfOf(skinnedFigure('scorp'), kit);
    const e = entity('scorp', { kit: 'spiked' });
    expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(true);
    return { e, kit, group: e.rig.group };
  };

  it('keeps the model\'s own Monster_ node as the figure', () => {
    const { group } = setup();
    expect(group.getObjectByName('Body')).toBeDefined();
    expect(group.getObjectByName('Hips')).toBeDefined();
  });

  it('adds a kit child named after a bone under that bone', () => {
    const { group } = setup();
    const arm = group.getObjectByName('Arm')!;
    expect((arm as THREE.Bone).isBone).toBe(true);
    const child = arm.children.find((c) => c.name === 'spiked_Arm' && (c as THREE.Mesh).isMesh);
    expect(child, 'kit child under bone Arm').toBeDefined();
  });

  it('puts a kit child named after no bone under the root', () => {
    const { group } = setup();
    const stray = group.getObjectByName('spiked_Stray')!;
    expect(stray.parent).toBe(group);
  });

  it('adds clones, leaving the template kit node as it was', () => {
    const { kit, group } = setup();
    expect(kit.children.map((c) => c.name)).toEqual(['spiked_Arm', 'spiked_Stray']);
    expect(group.getObjectByName('spiked_Stray')).not.toBe(kit.children[1]);
  });
});

describe('a kit child without the kit prefix', () => {
  it('is refused with an error naming the kit and the child', () => {
    const gltf = gltfOf(skinnedFigure('scorp'), kitNode('spiked', ['Arm']));
    expect(() => upgradeMonsterRigWithGltf(entity('scorp', { kit: 'spiked' }), gltf)).toThrow(/Kit_spiked.*'Arm'.*spiked_/);
  });
});

describe('a def with no kit', () => {
  it('is unchanged: no Kit_ child is added even when the node exists', () => {
    const gltf = gltfOf(skinnedFigure('scorp'), kitNode('spiked', ['spiked_Arm', 'spiked_Stray']));
    const e = entity('scorp');
    expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(true);
    expect(e.rig.group.getObjectByName('spiked_Stray')).toBeUndefined();
    const arm = e.rig.group.getObjectByName('Arm')!;
    expect(arm.children).toHaveLength(0);
    expect(e.rig.group.getObjectByName('Hips')).toBeDefined();
  });
});

describe('model keys', () => {
  it('the model keys of every row equal a snapshot, so Stage 4\'s tests still see ten', () => {
    const keys = Object.fromEntries(Object.entries(MONSTER_TYPES).map(([k, d]) => [k, d.model ?? k]));
    expect(keys).toEqual({
      chicken: 'chicken',
      goblin: 'goblin',
      scorpion: 'scorpion',
      dark_wizard: 'dark_wizard',
      hill_giant: 'hill_giant',
      moss_guardian: 'moss_guardian',
      lesser_demon: 'lesser_demon',
      elvarg_dragon: 'elvarg_dragon',
      goblin_archer: 'goblin_archer',
      dark_ranger: 'dark_ranger',
      saltback_stalker: 'scorpion',
      thornwatch_marksman: 'dark_ranger',
      ashmantle: 'elvarg_dragon'
    });
    expect(new Set(Object.values(keys).filter((_, i) => i < 10)).size).toBe(10);
  });
});
