import * as THREE from 'three';
import { addCartoonOutline, facetMaterial } from './materials';

/** Classic OSRS lean athletic proportions. Gear mounts in playerGear.ts use the same anchors. */
export const LEAN_RIG = {
  chestRadiusTop: 0.22,
  chestRadiusBottom: 0.165,
  chestHeight: 0.78,
  chestScaleZ: 0.68,
  beltRadius: 0.17,
  beltHeight: 0.2,
  torsoY: 1.24,
  beltY: 0.9,
  neckY: 1.69,
  neckRadiusTop: 0.052,
  neckRadiusBottom: 0.066,
  neckHeight: 0.28,
  headY: 2.02,
  headRadius: 0.195,
  shoulderX: 0.28,
  shoulderY: 1.5,
  armRadiusTop: 0.068,
  armRadiusBottom: 0.054,
  armHeight: 0.66,
  handY: -0.7,
  handRadius: 0.058,
  hipX: 0.11,
  hipY: 0.9,
  legRadiusTop: 0.085,
  legRadiusBottom: 0.062,
  thighHeight: 0.42,
  shinHeight: 0.4,
  legHeight: 0.82,
  outline: 0.016,
  skirtRadiusTop: 0.18,
  skirtRadiusBottom: 0.28
} as const;

export interface HumanoidRig {
  group: THREE.Group;
  torso: THREE.Group;
  chest: THREE.Mesh;
  belt: THREE.Mesh;
  neck: THREE.Mesh;
  headGroup: THREE.Group;
  head: THREE.Mesh;
  hairCap: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  tunicMat: THREE.MeshLambertMaterial;
  legsMat: THREE.MeshLambertMaterial;
  bootMat: THREE.MeshLambertMaterial;
  gloveMat: THREE.MeshLambertMaterial;
  hitbox: THREE.Mesh;
}

function taggedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  part: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.userData.part = part;
  return mesh;
}

export function buildHumanoidRig(
  tunicHex = 0x0284c7,
  hairHex = 0xfacc15,
  legsHex = 0xa1887f,
  scale = 1
): HumanoidRig {
  const group = new THREE.Group();
  group.scale.set(scale, scale, scale);

  const skinMat = facetMaterial({ color: 0xffd7b5 });
  const tunicMat = facetMaterial({ color: tunicHex });
  const legsMat = facetMaterial({ color: legsHex });
  const hairMat = facetMaterial({ color: hairHex });
  const bootMat = facetMaterial({ color: 0x78350f });
  const gloveMat = facetMaterial({ color: 0xf6c7a1 });
  const beltLeather = facetMaterial({ color: 0x3f2a1d });

  const torso = new THREE.Group();
  torso.position.y = LEAN_RIG.torsoY;

  const chest = taggedMesh(
    new THREE.CylinderGeometry(LEAN_RIG.chestRadiusTop, LEAN_RIG.chestRadiusBottom, LEAN_RIG.chestHeight, 16),
    tunicMat,
    'chest'
  );
  chest.scale.z = LEAN_RIG.chestScaleZ;
  torso.add(chest);

  const belt = taggedMesh(
    new THREE.CylinderGeometry(LEAN_RIG.beltRadius, LEAN_RIG.beltRadius, LEAN_RIG.beltHeight, 14),
    tunicMat,
    'belt'
  );
  belt.position.y = LEAN_RIG.beltY - LEAN_RIG.torsoY;
  belt.scale.z = 0.74;
  torso.add(belt);

  const beltStrap = taggedMesh(
    new THREE.CylinderGeometry(LEAN_RIG.beltRadius + 0.012, LEAN_RIG.beltRadius + 0.012, 0.04, 14),
    beltLeather,
    'belt-strap'
  );
  beltStrap.position.y = belt.position.y + 0.02;
  beltStrap.scale.z = 0.74;
  torso.add(beltStrap);
  group.add(torso);

  const neck = taggedMesh(
    new THREE.CylinderGeometry(LEAN_RIG.neckRadiusTop, LEAN_RIG.neckRadiusBottom, LEAN_RIG.neckHeight, 12),
    skinMat,
    'neck'
  );
  neck.position.y = LEAN_RIG.neckY;
  group.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, LEAN_RIG.headY, 0);
  const head = taggedMesh(new THREE.SphereGeometry(LEAN_RIG.headRadius, 18, 16), skinMat, 'head');
  head.scale.set(1, 1.05, 0.94);
  headGroup.add(head);

  const hairCap = taggedMesh(
    new THREE.SphereGeometry(LEAN_RIG.headRadius + 0.016, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
    'hair'
  );
  hairCap.position.y = 0.02;
  hairCap.rotation.x = 0.35;
  headGroup.add(hairCap);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
  [-0.068, 0.068].forEach((ox) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), eyeMat);
    eye.scale.set(1.1, 0.72, 0.4);
    eye.position.set(ox, 0.02, -0.178);
    eye.userData.noOutline = true;
    headGroup.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skinMat);
  nose.scale.set(0.8, 0.65, 0.85);
  nose.position.set(0, -0.03, -0.19);
  nose.userData.noOutline = true;
  headGroup.add(nose);
  group.add(headGroup);

  function createArm(isLeft: boolean): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -LEAN_RIG.shoulderX : LEAN_RIG.shoulderX, LEAN_RIG.shoulderY, 0);
    const arm = taggedMesh(
      new THREE.CylinderGeometry(LEAN_RIG.armRadiusTop, LEAN_RIG.armRadiusBottom, LEAN_RIG.armHeight, 14),
      tunicMat,
      'arm'
    );
    arm.position.y = -LEAN_RIG.armHeight / 2;
    pivot.add(arm);
    const deltoid = taggedMesh(new THREE.SphereGeometry(0.072, 12, 10), tunicMat, 'deltoid');
    deltoid.scale.set(1.05, 0.72, 0.78);
    deltoid.position.y = -0.02;
    pivot.add(deltoid);
    const hand = taggedMesh(new THREE.SphereGeometry(LEAN_RIG.handRadius, 12, 10), gloveMat, 'hand');
    hand.position.y = LEAN_RIG.handY;
    pivot.add(hand);
    return pivot;
  }

  const leftArmPivot = createArm(true);
  const rightArmPivot = createArm(false);
  group.add(leftArmPivot, rightArmPivot);

  function createLeg(isLeft: boolean): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -LEAN_RIG.hipX : LEAN_RIG.hipX, LEAN_RIG.hipY, 0);
    const thigh = taggedMesh(
      new THREE.CylinderGeometry(LEAN_RIG.legRadiusTop, 0.072, LEAN_RIG.thighHeight, 14),
      legsMat,
      'thigh'
    );
    thigh.position.y = -LEAN_RIG.thighHeight / 2;
    pivot.add(thigh);
    const shin = taggedMesh(
      new THREE.CylinderGeometry(0.068, LEAN_RIG.legRadiusBottom, LEAN_RIG.shinHeight, 14),
      legsMat,
      'shin'
    );
    shin.position.y = -(LEAN_RIG.thighHeight + LEAN_RIG.shinHeight / 2);
    pivot.add(shin);
    const boot = taggedMesh(new THREE.CylinderGeometry(0.07, 0.078, 0.15, 10), bootMat, 'boot');
    boot.position.set(0, -0.78, 0.01);
    pivot.add(boot);
    const toe = taggedMesh(new THREE.BoxGeometry(0.09, 0.055, 0.1), bootMat, 'toe');
    toe.position.set(0, -0.84, -0.04);
    pivot.add(toe);
    return pivot;
  }

  const leftLegPivot = createLeg(true);
  const rightLegPivot = createLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 2.4, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 1.18;
  hitbox.userData.isCollider = true;
  group.add(hitbox);
  addCartoonOutline(group, LEAN_RIG.outline);

  return {
    group,
    torso,
    chest,
    belt,
    neck,
    headGroup,
    head,
    hairCap,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    tunicMat,
    legsMat,
    bootMat,
    gloveMat,
    hitbox
  };
}
