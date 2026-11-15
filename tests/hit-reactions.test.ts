import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { MonsterEntity } from '../src/engine/context';
import { KNOCK_BACK, springOffset } from '../src/data/feel';
import { knockBack, updateReactions } from '../src/engine/reactions';

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
