import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MONSTER_TYPES } from '../src/data/world';
import type { MonsterEntity } from '../src/engine/context';
import { upgradeMonsterRigWithGltf } from '../src/engine/blenderMonsters';
import { BlenderHeroAnimator } from '../src/engine/blenderHero';
import { poseMonsterLimbs } from '../src/engine/monsterMeshes';
import { hitStop } from '../src/engine/reactions';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

const readGlb = async (file: string): Promise<GLTF> => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models', file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
};

let monsters: GLTF;
beforeAll(async () => {
  monsters = await readGlb('monsters.glb');
});

function makeDragon(): MonsterEntity {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh();
  group.add(hitbox);
  const m = {
    typeKey: 'elvarg_dragon',
    modelKey: 'elvarg_dragon',
    def: MONSTER_TYPES.elvarg_dragon,
    rig: { group, hitbox },
    logic: { state: 'idle', windup: null },
    pos: group.position,
    flinch: 0,
    attackAnim: 0
  } as unknown as MonsterEntity;
  expect(upgradeMonsterRigWithGltf(m, monsters)).toBe(true);

  // Constant-track idle clip for the three flinched bones
  const tracks = [
    new THREE.QuaternionKeyframeTrack('HeadGroup.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])
  ];
  const constantIdle = new THREE.AnimationClip('Idle', 1, tracks);
  const rig = m.rig!;
  const pivots: Record<string, THREE.Object3D> = {};
  if (rig.headGroup) pivots.headGroup = rig.headGroup;
  if (rig.leftArmPivot) pivots.leftArmPivot = rig.leftArmPivot;
  if (rig.rightArmPivot) pivots.rightArmPivot = rig.rightArmPivot;
  (m as { animator: unknown }).animator = new BlenderHeroAnimator(rig.group, [constantIdle], pivots);

  return m;
}

describe('RF1: clip flinch compounding', () => {
  it('a clip-driven monster with a constant-track idle and a flinch run to its end returns every one of the three bones to its pre-flinch quaternion within 1e-6', () => {
    const m = makeDragon();
    const DT = 1 / 60;
    // Settle idle
    poseMonsterLimbs(m, false, 0, DT);

    const rig = m.rig!;
    const preHead = rig.headGroup!.quaternion.clone();
    const preRight = rig.rightArmPivot!.quaternion.clone();
    const preLeft = rig.leftArmPivot!.quaternion.clone();

    // Trigger flinch and run to its end
    m.flinch = 1;
    while (m.flinch > 0) {
      poseMonsterLimbs(m, false, 0, DT);
    }
    // One more frame to restore base after flinch has decayed
    poseMonsterLimbs(m, false, 0, DT);

    expect(rig.headGroup!.quaternion.angleTo(preHead)).toBeLessThan(1e-6);
    expect(rig.rightArmPivot!.quaternion.angleTo(preRight)).toBeLessThan(1e-6);
    expect(rig.leftArmPivot!.quaternion.angleTo(preLeft)).toBeLessThan(1e-6);
  });

  it('a hit stop held mid-flinch for 10 frames does not change them from frame to frame', () => {
    const m = makeDragon();
    const DT = 1 / 60;
    poseMonsterLimbs(m, false, 0, DT);

    m.flinch = 0.5;
    hitStop(m, 1000);

    // Frame 1 of hit stop
    poseMonsterLimbs(m, false, 0, DT);
    const rig = m.rig!;
    const frame1Head = rig.headGroup!.quaternion.clone();
    const frame1Right = rig.rightArmPivot!.quaternion.clone();
    const frame1Left = rig.leftArmPivot!.quaternion.clone();

    // Frames 2 to 10
    for (let i = 2; i <= 10; i++) {
      poseMonsterLimbs(m, false, 0, DT);
      expect(rig.headGroup!.quaternion.angleTo(frame1Head)).toBeLessThan(1e-6);
      expect(rig.rightArmPivot!.quaternion.angleTo(frame1Right)).toBeLessThan(1e-6);
      expect(rig.leftArmPivot!.quaternion.angleTo(frame1Left)).toBeLessThan(1e-6);
    }
  });
});
