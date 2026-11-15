import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { MonsterEntity } from '../src/engine/context';
import { CAMERA, KNOCK_BACK, springOffset } from '../src/data/feel';
import { cameraKick, cameraRumble, hitStop, knockBack, removeCameraOffsets, updateReactions } from '../src/engine/reactions';
import { G } from '../src/engine/context';
import { poseMonsterLimbs } from '../src/engine/monsterMeshes';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

function fakeMonster(yaw: number, scale: number): { monster: MonsterEntity; body: THREE.Object3D; group: THREE.Group } {
  const group = new THREE.Group();
  group.rotation.y = yaw;
  group.scale.setScalar(scale);
  const body = new THREE.Object3D();
  body.position.set(0.3, 1, -0.2);
  const hitbox = new THREE.Mesh();
  group.add(body, hitbox);
  const monster = { rig: { group, hitbox } } as unknown as MonsterEntity;
  return { monster, body, group };
}

function bodyWorld(group: THREE.Group, body: THREE.Object3D): THREE.Vector3 {
  group.updateMatrixWorld(true);
  return body.getWorldPosition(new THREE.Vector3());
}

describe('monster knock-back (review 8): the body moves along the world blow direction', () => {
  const dtMs = 50;
  for (const [yawDeg, dirX, dirZ] of [
    [90, 1, 0],
    [180, 0, -1],
    [37, 0.6, 0.8],
    [-120, -0.3, 0.5]
  ] as const) {
    it(`yaw ${yawDeg} deg, blow (${dirX}, ${dirZ}), group scale 2`, () => {
      const { monster, body, group } = fakeMonster((yawDeg * Math.PI) / 180, 2);
      const rest = bodyWorld(group, body);
      knockBack(monster, dirX, dirZ, KNOCK_BACK.monsterHit.amount);
      updateReactions(dtMs / 1000);
      const moved = bodyWorld(group, body).sub(rest);
      const len = Math.hypot(dirX, dirZ);
      const off = springOffset(dtMs, KNOCK_BACK.monsterHit.amount, KNOCK_BACK.monsterHit.ms);
      expect(moved.x).toBeCloseTo((dirX / len) * off, 6);
      expect(moved.z).toBeCloseTo((dirZ / len) * off, 6);
      expect(moved.y).toBeCloseTo(0, 6);
      updateReactions(1);
      expect(bodyWorld(group, body).distanceTo(rest)).toBeCloseTo(0, 6);
    });
  }
});

describe('monster hit stop (review 9): the flinch pose freezes while the monster is hit-stopped', () => {
  it('flinch does not decay during the stop and resumes after it', () => {
    const group = new THREE.Group();
    const m = {
      rig: { group },
      logic: { state: 'attack', windup: null },
      pos: new THREE.Vector3(0, 0, 0),
      flinch: 1,
      attackAnim: 0
    } as unknown as MonsterEntity;
    hitStop(m, 70);
    poseMonsterLimbs(m, false, 0, 0.016);
    poseMonsterLimbs(m, false, 16, 0.016);
    expect(m.flinch).toBe(1);
    updateReactions(0.1);
    poseMonsterLimbs(m, false, 116, 0.016);
    expect(m.flinch).toBeLessThan(1);
  });
});

describe('camera kick and rumble (review 12): offsets ride on top of the lerped chase camera', () => {
  // One frame as the loop runs it: offsets off, updateCamera's lerp toward its target, reactions on.
  const target = new THREE.Vector3(4, 9, -3);
  const dt = 1 / 60;
  const frame = (): void => {
    removeCameraOffsets();
    G.camera.position.lerp(target, Math.min(1, dt * 12));
    updateReactions(dt);
  };

  it('the kick shows its full spring offset each frame and leaves the camera exactly on its target', () => {
    G.camera = new THREE.PerspectiveCamera();
    G.camera.position.copy(target);
    cameraKick(1, 0, CAMERA.kickMax);
    let elapsed = 0;
    for (let i = 0; i < 30; i++) {
      frame();
      elapsed += dt * 1000;
      const want = elapsed < CAMERA.kickMs ? springOffset(elapsed, CAMERA.kickMax, CAMERA.kickMs) : 0;
      expect(G.camera.position.x - target.x).toBeCloseTo(want, 9);
      expect(G.camera.position.z).toBeCloseTo(target.z, 9);
    }
  });

  it('the rumble leaves the camera exactly on its target when it ends', () => {
    G.camera = new THREE.PerspectiveCamera();
    G.camera.position.copy(target);
    cameraRumble(200);
    for (let i = 0; i < 20; i++) frame();
    expect(G.camera.position.distanceTo(target)).toBeCloseTo(0, 9);
  });
});
