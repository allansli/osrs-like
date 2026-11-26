import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MonsterEntity } from '../src/engine/context';
import { poseMonsterLimbs } from '../src/engine/monsterMeshes';
import { getTerrainHeight } from '../src/state/terrain';

const GROUND = getTerrainHeight(0, 0);

function codeRig(model: string): { m: MonsterEntity; piv: Record<string, THREE.Object3D> } {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh();
  group.add(hitbox);
  const piv: Record<string, THREE.Object3D> = {};
  for (const n of ['headGroup', 'leftArmPivot', 'rightArmPivot', 'leftLegPivot', 'rightLegPivot']) {
    piv[n] = new THREE.Object3D();
    group.add(piv[n]);
  }
  const m = {
    typeKey: model,
    def: {},
    rig: { group, hitbox, ...piv },
    logic: { state: 'idle', windup: null },
    pos: new THREE.Vector3(0, 0, 0),
    flinch: 0,
    attackAnim: 0
  } as unknown as MonsterEntity;
  return { m, piv };
}

interface ExpectPose {
  y: number;
  gx?: number;
  head?: number;
  r?: number;
  l?: number;
}

function checkPose(m: MonsterEntity, piv: Record<string, THREE.Object3D>, want: ExpectPose): void {
  expect(m.rig!.group.position.y).toBeCloseTo(want.y, 6);
  expect(m.rig!.group.rotation.x).toBeCloseTo(want.gx ?? 0, 6);
  if (want.head !== undefined) expect(piv.headGroup.rotation.x).toBeCloseTo(want.head, 6);
  if (want.r !== undefined) expect(piv.rightArmPivot.rotation.x).toBeCloseTo(want.r, 6);
  if (want.l !== undefined) expect(piv.leftArmPivot.rotation.x).toBeCloseTo(want.l, 6);
}

describe('RF6: chicken code-posed path', () => {
  it('wind-up at progress 0, 0.5, 1', () => {
    const expected = [
      { p: 0, want: { y: GROUND, head: 0, r: 0, l: 0 } },
      { p: 0.5, want: { y: GROUND + 0.075, head: -0.175, r: -0.9, l: -0.9 } },
      { p: 1, want: { y: GROUND + 0.15, head: -0.35, r: -1.8, l: -1.8 } }
    ];
    for (const { p, want } of expected) {
      const { m, piv } = codeRig('chicken');
      m.logic.state = 'attack';
      (m.logic as { windup: unknown }).windup = { left: 2 * (1 - p), total: 2 };
      poseMonsterLimbs(m, false, 0, 0.016);
      checkPose(m, piv, want);
    }
  });

  it('attack at progress 0, 0.5, 1', () => {
    const cases = [
      { anim: 1, want: { y: GROUND, r: 0, l: 0 } },
      { anim: 1 / 6, want: { y: GROUND + 0.05, r: -0.725, l: 0.29 } },
      { anim: 0.5, want: { y: GROUND + 0.1, r: -1.45, l: 0.58 } }
    ];
    for (const { anim, want } of cases) {
      const { m, piv } = codeRig('chicken');
      m.logic.state = 'attack';
      m.attackAnim = anim;
      poseMonsterLimbs(m, false, 0, 0);
      checkPose(m, piv, want);
    }
  });

  it('flinch at progress 0, 0.5, 1', () => {
    const cases = [
      { f: 1, want: { y: GROUND, gx: 0, head: 0, r: 0, l: 0 } },
      { f: 0.25, want: { y: GROUND + 0.11313708, gx: 0.16970563, head: -0.25455844, r: 0.31819805, l: 0.24748737 } },
      { f: 0.5, want: { y: GROUND + 0.16, gx: 0.24, head: -0.36, r: 0.45, l: 0.35 } }
    ];
    for (const { f, want } of cases) {
      const { m, piv } = codeRig('chicken');
      m.flinch = f;
      poseMonsterLimbs(m, false, 0, 0);
      checkPose(m, piv, want);
    }
  });

  it('walk for chase and idle at progress points', () => {
    {
      const { m, piv } = codeRig('chicken');
      m.logic.state = 'chase';
      poseMonsterLimbs(m, true, 1234, 0.016);
      expect(piv.leftLegPivot.rotation.x).toBeCloseTo(-0.116710, 6);
      expect(piv.rightLegPivot.rotation.x).toBeCloseTo(0.116710, 6);
      expect(piv.leftArmPivot.rotation.x).toBeCloseTo(0.087532, 6);
      expect(piv.rightArmPivot.rotation.x).toBeCloseTo(-0.087532, 6);
      expect(m.rig!.group.position.y).toBeCloseTo(GROUND + 0.060000, 6);
    }
    {
      const { m, piv } = codeRig('chicken');
      m.logic.state = 'idle';
      poseMonsterLimbs(m, true, 1234, 0.016);
      expect(piv.leftLegPivot.rotation.x).toBeCloseTo(0.269071, 6);
      expect(piv.rightLegPivot.rotation.x).toBeCloseTo(-0.269071, 6);
      expect(piv.leftArmPivot.rotation.x).toBeCloseTo(-0.201803, 6);
      expect(piv.rightArmPivot.rotation.x).toBeCloseTo(0.201803, 6);
      expect(m.rig!.group.position.y).toBeCloseTo(GROUND + 0.060000, 6);
    }
  });

  it('idle breathing at progress points', () => {
    const { m, piv } = codeRig('chicken');
    piv.leftLegPivot.rotation.x = 0.4;
    piv.rightLegPivot.rotation.x = -0.4;
    poseMonsterLimbs(m, false, 777, 0.05);
    expect(m.rig!.group.position.y).toBeCloseTo(GROUND + 0.002029, 6);
    expect(piv.headGroup.rotation.y).toBeCloseTo(0.132555, 6);
    expect(piv.leftArmPivot.rotation.x).toBeCloseTo(0.050729, 6);
    expect(piv.rightArmPivot.rotation.x).toBeCloseTo(-0.022828, 6);
    expect(piv.leftLegPivot.rotation.x).toBeCloseTo(0.254422, 6);
    expect(piv.rightLegPivot.rotation.x).toBeCloseTo(-0.254422, 6);
  });
});
