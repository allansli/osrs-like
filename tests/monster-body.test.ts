// B1: the optional `body` look field. Red until the [AGY] part lands: a def with a body clones
// `Monster_<body>` instead of `Monster_<model key>`.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../src/engine/blenderMonsters';

function skinnedFigure(key: string, mesh: string): THREE.Group {
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

function entity(typeKey: string, def: Record<string, unknown> = {}): MonsterEntityLike {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  group.add(hitbox);
  return { typeKey, modelKey: typeKey, def: def as MonsterEntityLike['def'], rig: { group, hitbox }, pos: new THREE.Vector3(1, 0, 1) };
}

const gltf = (): GLTF => {
  const scene = new THREE.Group();
  scene.add(skinnedFigure('goblin', 'ModelMesh'), skinnedFigure('bigbody', 'BodyMesh'));
  return { scene } as unknown as GLTF;
};

function skinMaterial(e: MonsterEntityLike): THREE.Material {
  let found: THREE.Material | undefined;
  e.rig.group.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = (o as THREE.Mesh).material as THREE.Material;
  });
  return found!;
}

describe('a def with a body', () => {
  const setup = () => {
    const e = entity('goblin', { body: 'bigbody' });
    expect(upgradeMonsterRigWithGltf(e, gltf())).toBe(true);
    return e;
  };

  it('clones Monster_<body> instead of Monster_<model key>', () => {
    const e = setup();
    expect(e.rig.group.getObjectByName('BodyMesh')).toBeDefined();
    expect(e.rig.group.getObjectByName('ModelMesh')).toBeUndefined();
  });

  it('strips the body key\'s prefix from its bones', () => {
    const e = setup();
    expect(e.rig.group.getObjectByName('Hips')).toBeDefined();
    expect(e.rig.group.getObjectByName('Arm')).toBeDefined();
    expect(e.rig.group.getObjectByName('bigbody_Hips')).toBeUndefined();
  });

  it('keeps the model key for the entity and its albedo', () => {
    const e = setup();
    expect(e.modelKey).toBe('goblin');
    const plain = entity('goblin');
    upgradeMonsterRigWithGltf(plain, gltf());
    const id = skinMaterial(plain).userData.albedoId;
    expect(id, 'goblin has a species albedo').toBeDefined();
    expect(skinMaterial(e).userData.albedoId).toBe(id);
  });
});

describe('a def with neither body nor kit', () => {
  it('is unchanged: the model key\'s node, its prefix stripped', () => {
    const e = entity('goblin');
    expect(upgradeMonsterRigWithGltf(e, gltf())).toBe(true);
    expect(e.rig.group.getObjectByName('ModelMesh')).toBeDefined();
    expect(e.rig.group.getObjectByName('BodyMesh')).toBeUndefined();
    expect(e.rig.group.getObjectByName('Hips')).toBeDefined();
  });
});
