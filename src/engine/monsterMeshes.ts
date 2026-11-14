// @ts-nocheck
import * as THREE from 'three';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoMaterial, speciesAlbedo } from './textures';
import { getTerrainHeight } from '../state/terrain';
// Bespoke OSRS × Zelda monster silhouettes. Each species owns its anatomy.
// Walk / idle / attack still drive leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot.
// Winged rigs also expose lWing / rWing for the flap in the monster update.

export function monsterPart(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function monsterPivot(x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  return pivot;
}

export function monsterHitbox(radius, height, y) {
  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = y;
  hitbox.userData.isCollider = true;
  return hitbox;
}

export function finishMonster(group, hitbox, parts) {
  group.add(hitbox);
  addCartoonOutline(group, 0.022);
  return { group, hitbox, ...parts };
}

export function glowEye(parent, x, y, z, color, radius = 0.045) {
  const eye = monsterPart(
    parent,
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshBasicMaterial({ color }),
    x, y, z
  );
  eye.userData.noOutline = true;
  return eye;
}

export function paint(color, extra = {}, family = null) {
  return family ? albedoMaterial(color, family, extra) : facetMaterial({ color, ...extra });
}

export function addQuiver(parent, x, y, z, leatherHex, fletchHex) {
  const quiver = new THREE.Group();
  quiver.position.set(x, y, z);
  quiver.rotation.x = -0.55;
  monsterPart(quiver, new THREE.CylinderGeometry(0.09, 0.12, 0.46, 10), paint(leatherHex, {}, 'leather'));
  for (let i = 0; i < 4; i++) {
    const shaft = monsterPart(
      quiver,
      new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6),
      paint(0xd6d3d1),
      (i - 1.5) * 0.04,
      0.28,
      0
    );
    monsterPart(shaft, new THREE.ConeGeometry(0.035, 0.09, 5), paint(fletchHex), 0, 0.22, 0);
  }
  parent.add(quiver);
  return quiver;
}

export function addStrungBow(pivot, length, color, bend) {
  const bow = new THREE.Group();
  bow.position.set(0.04, -0.42, -0.18);
  const half = length * 0.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -half, 0.1),
    new THREE.Vector3(0, -half * 0.45, -bend),
    new THREE.Vector3(0, 0, -bend * 1.2),
    new THREE.Vector3(0, half * 0.45, -bend),
    new THREE.Vector3(0, half, 0.1)
  ]);
  monsterPart(bow, new THREE.TubeGeometry(curve, 16, 0.03, 8, false), paint(color, {}, 'wood'));
  const string = monsterPart(
    bow,
    new THREE.CylinderGeometry(0.006, 0.006, length * 0.96, 6),
    new THREE.MeshBasicMaterial({ color: 0xe7e5e4 }),
    0, 0, 0.1
  );
  string.userData.noOutline = true;
  pivot.add(bow);
  return bow;
}

export function buildChickenMesh(def) {
  const grp = new THREE.Group();
  const bodyMat = paint(def.bodyColor, {}, speciesAlbedo('chicken'));
  const redMat = paint(def.accentColor);
  const beakMat = paint(0xf59e0b);

  const body = monsterPart(grp, new THREE.SphereGeometry(0.32, 16, 14), bodyMat, 0, 0.42, 0);
  body.scale.set(1.15, 0.9, 1.4);
  const head = monsterPart(grp, new THREE.SphereGeometry(0.16, 14, 12), bodyMat, 0, 0.74, -0.32);
  const comb = monsterPart(grp, new THREE.SphereGeometry(0.055, 8, 6), redMat, 0, 0.92, -0.3);
  comb.scale.set(0.45, 1.35, 0.7);
  const beak = monsterPart(grp, new THREE.ConeGeometry(0.05, 0.16, 8), beakMat, 0, 0.72, -0.48);
  beak.rotation.x = -Math.PI / 2;
  const wattle = monsterPart(grp, new THREE.SphereGeometry(0.045, 8, 6), redMat, 0, 0.64, -0.4);
  wattle.scale.set(0.65, 1.35, 0.55);
  const tail = monsterPart(grp, new THREE.SphereGeometry(0.12, 12, 8), bodyMat, 0, 0.5, 0.4);
  tail.scale.set(1.05, 0.5, 1.35);
  [-1, 1].forEach((side) => {
    const wing = monsterPart(grp, new THREE.SphereGeometry(0.15, 12, 10), bodyMat, side * 0.3, 0.46, 0.02);
    wing.scale.set(0.42, 0.85, 1.15);
    wing.rotation.z = side * -0.45;
  });

  function chickenLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.1 : 0.1, 0.24, 0.04);
    monsterPart(pivot, new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), beakMat, 0, -0.1, 0);
    const foot = monsterPart(pivot, new THREE.BoxGeometry(0.04, 0.02, 0.1), beakMat, 0, -0.21, -0.03);
    foot.userData.noOutline = true;
    return pivot;
  }
  const leftLegPivot = chickenLeg(true);
  const rightLegPivot = chickenLeg(false);
  grp.add(leftLegPivot, rightLegPivot);

  return finishMonster(grp, monsterHitbox(0.8, 1.5, 0.75), { leftLegPivot, rightLegPivot });
}

export function buildGoblinMesh(def, role) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 0.9);
  const skin = paint(0x65a30d, {}, speciesAlbedo('goblin'));
  const leather = paint(0x78350f, {}, 'leather');
  const rag = paint(0x92400e, {}, 'cloth');
  const dark = paint(0x451a03, {}, 'cloth');
  const iron = paint(0x9ca3af, {}, 'iron');
  const bronze = paint(0xb87333, {}, 'iron');
  const wood = paint(0x92400e, {}, 'wood');

  const torso = new THREE.Group();
  torso.position.set(0, 1.02, 0);
  torso.rotation.x = 0.32;
  group.add(torso);
  const chest = monsterPart(torso, new THREE.SphereGeometry(0.32, 16, 12), skin, 0, 0.12, 0);
  chest.scale.set(1.2, 0.82, 0.92);
  const belly = monsterPart(torso, new THREE.SphereGeometry(0.2, 14, 10), skin, 0, -0.02, -0.12);
  const vest = monsterPart(
    torso,
    new THREE.CylinderGeometry(0.28, 0.34, 0.4, 14, 1, true),
    leather,
    0, 0.1, 0.06
  );
  vest.material.side = THREE.DoubleSide;

  const cloth = monsterPart(group, new THREE.ConeGeometry(0.26, 0.38, 8, 1, true), rag, 0, 0.7, 0.04);
  cloth.material.side = THREE.DoubleSide;
  cloth.scale.set(1.15, 1, 0.62);
  const flap = monsterPart(group, new THREE.ConeGeometry(0.12, 0.32, 6, 1, true), leather, 0.1, 0.64, -0.08);
  flap.material.side = THREE.DoubleSide;
  flap.rotation.z = -0.25;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, -0.08);
  torso.add(headGroup);
  const skull = monsterPart(headGroup, new THREE.SphereGeometry(0.26, 16, 14), skin, 0, 0, 0);
  skull.scale.set(1.18, 0.9, 1.02);
  [-1, 1].forEach((side) => {
    const ear = monsterPart(headGroup, new THREE.ConeGeometry(0.1, 0.5, 8), skin, side * 0.22, 0.02, 0);
    ear.rotation.z = side * -Math.PI / 2;
    ear.rotation.y = side * 0.15;
  });
  const nose = monsterPart(headGroup, new THREE.ConeGeometry(0.055, 0.24, 8), skin, 0, -0.02, -0.2);
  nose.rotation.x = Math.PI / 2.15;
  const brow = monsterPart(headGroup, new THREE.BoxGeometry(0.34, 0.06, 0.08), skin, 0, 0.1, -0.2);
  brow.rotation.x = -0.55;
  glowEye(headGroup, -0.09, 0.02, -0.24, 0xfacc15, 0.048);
  glowEye(headGroup, 0.09, 0.02, -0.24, 0xfacc15, 0.048);

  function goblinArm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.46 : 0.46, 1.28, -0.08);
    const upper = monsterPart(pivot, new THREE.CylinderGeometry(0.075, 0.065, 0.34, 12), skin, 0, -0.18, 0);
    upper.rotation.x = 0.25;
    const fore = monsterPart(pivot, new THREE.CylinderGeometry(0.06, 0.05, 0.3, 12), skin, 0, -0.42, -0.06);
    fore.rotation.x = 0.45;
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), skin, 0, -0.58, -0.14);
    return pivot;
  }
  const leftArmPivot = goblinArm(true);
  const rightArmPivot = goblinArm(false);
  group.add(leftArmPivot, rightArmPivot);

  function goblinLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.7, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.09, 0.07, 0.32, 12), skin, 0, -0.16, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.065, 0.05, 0.28, 12), skin, 0, -0.4, 0.02);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), skin, 0, -0.56, -0.06);
    foot.scale.set(0.75, 0.5, 1.45);
    return pivot;
  }
  const leftLegPivot = goblinLeg(true);
  const rightLegPivot = goblinLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  if (role === 'archer') {
    const hood = monsterPart(headGroup, new THREE.SphereGeometry(0.3, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), dark, 0, 0.06, 0.02);
    hood.scale.set(1.05, 0.85, 1.05);
    addQuiver(group, 0.16, 1.12, 0.22, 0x451a03, 0xfef3c7);
    addStrungBow(rightArmPivot, 0.95, 0x92400e, 0.2);
  } else {
    const pauldron = monsterPart(group, new THREE.SphereGeometry(0.16, 12, 10), iron, -0.48, 1.38, -0.06);
    pauldron.scale.set(1.25, 0.62, 1);
    [-0.4, 0, 0.4].forEach((tilt) => {
      const spike = monsterPart(pauldron, new THREE.ConeGeometry(0.035, 0.16, 6), iron, 0, 0.12, 0);
      spike.rotation.z = tilt;
    });
    const spear = new THREE.Group();
    spear.position.set(0.02, -0.5, -0.12);
    spear.rotation.x = -1.05;
    monsterPart(spear, new THREE.CylinderGeometry(0.028, 0.034, 1.05, 8), wood, 0, 0.28, 0);
    const head = monsterPart(spear, new THREE.ConeGeometry(0.09, 0.32, 4), bronze, 0, 0.88, 0);
    head.rotation.y = Math.PI / 5;
    monsterPart(spear, new THREE.ConeGeometry(0.05, 0.18, 4), bronze, 0.07, 0.78, 0).rotation.z = -0.6;
    rightArmPivot.add(spear);
    const buckler = monsterPart(leftArmPivot, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), wood, -0.06, -0.5, -0.16);
    buckler.rotation.x = Math.PI / 2.2;
    monsterPart(buckler, new THREE.SphereGeometry(0.06, 10, 8), bronze, 0, 0.05, 0);
  }

  return finishMonster(group, monsterHitbox(0.85, 2.15, 1.05), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

export function buildScorpionMesh() {
  const grp = new THREE.Group();
  grp.scale.setScalar(1.28);
  const shell = paint(0xb45309, {}, speciesAlbedo('scorpion'));
  const dark = paint(0x451a03, {}, speciesAlbedo('scorpion'));
  const venom = paint(0xef4444, { emissive: 0xb91c1c, emissiveIntensity: 0.85 });

  for (let i = 0; i < 3; i++) {
    const seg = monsterPart(grp, new THREE.SphereGeometry(0.4 - i * 0.05, 16, 12), i === 0 ? dark : shell, 0, 0.52, -0.42 + i * 0.4);
    seg.scale.set(1.28, 0.55, 0.95);
  }
  const head = monsterPart(grp, new THREE.SphereGeometry(0.26, 16, 12), dark, 0, 0.5, -0.78);
  head.scale.set(1.15, 0.62, 0.9);
  glowEye(head, -0.1, 0.08, -0.18, 0xfacc15, 0.035);
  glowEye(head, 0.1, 0.08, -0.18, 0xfacc15, 0.035);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.55, 0.55),
    new THREE.Vector3(0, 1.15, 1.15),
    new THREE.Vector3(0, 1.9, 0.55),
    new THREE.Vector3(0, 2.05, -0.15)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(tailCurve, 16, 0.09, 10, false), dark);
  const barb = monsterPart(grp, new THREE.ConeGeometry(0.08, 0.34, 10), venom, 0, 1.92, -0.28);
  barb.rotation.x = -2.35;

  const stations = [-0.5, -0.16, 0.18, 0.5];
  function sideLegs(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.22 : 0.22, 0.5, 0);
    const s = isLeft ? -1 : 1;
    stations.forEach((z) => {
      const hip = new THREE.Group();
      hip.position.set(0, 0.02, z);
      const upper = monsterPart(hip, new THREE.CylinderGeometry(0.055, 0.04, 0.5, 8), dark, s * 0.18, -0.05, 0);
      upper.rotation.z = s * -1.15;
      const lower = monsterPart(hip, new THREE.CylinderGeometry(0.038, 0.024, 0.44, 8), shell, s * 0.42, -0.32, 0.02);
      lower.rotation.z = s * -0.2;
      monsterPart(hip, new THREE.SphereGeometry(0.035, 8, 6), dark, s * 0.48, -0.52, 0.04);
      pivot.add(hip);
    });
    return pivot;
  }
  const leftLegPivot = sideLegs(true);
  const rightLegPivot = sideLegs(false);
  grp.add(leftLegPivot, rightLegPivot);

  function pincer(isLeft) {
    const s = isLeft ? -1 : 1;
    const pivot = monsterPivot(s * 0.28, 0.52, -0.82);
    const arm = monsterPart(pivot, new THREE.CylinderGeometry(0.055, 0.04, 0.42, 10), shell, s * 0.06, 0, -0.16);
    arm.rotation.x = Math.PI / 2;
    [-1, 1].forEach((spread) => {
      const prong = monsterPart(pivot, new THREE.ConeGeometry(0.045, 0.3, 8), dark, s * 0.08, spread * 0.07, -0.46);
      prong.rotation.x = Math.PI / 2;
      prong.rotation.z = spread * 0.55;
    });
    return pivot;
  }
  const leftArmPivot = pincer(true);
  const rightArmPivot = pincer(false);
  grp.add(leftArmPivot, rightArmPivot);

  return finishMonster(grp, monsterHitbox(1.25, 2.2, 1.05), {
    leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot
  });
}

export function buildDarkWizard(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1);
  const robe = paint(0x1e1b4b, {}, 'cloth');
  const trim = paint(0x9333ea, { emissive: 0x6d28d9, emissiveIntensity: 0.35 });
  const charcoal = paint(0x111827);
  const wood = paint(0x44403c, {}, 'wood');

  const skirt = monsterPart(group, new THREE.CylinderGeometry(0.2, 0.68, 1.48, 18), robe, 0, 0.76, 0);
  const hem = monsterPart(group, new THREE.TorusGeometry(0.66, 0.035, 8, 18), trim, 0, 0.06, 0);
  hem.rotation.x = Math.PI / 2;
  const chest = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), robe, 0, 1.48, 0);
  chest.scale.set(1.05, 0.8, 0.85);
  monsterPart(group, new THREE.TorusGeometry(0.22, 0.03, 6, 14), trim, 0, 1.62, -0.02).rotation.x = Math.PI / 2.4;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.92, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.22, 16, 14), charcoal);
  glowEye(headGroup, -0.08, 0.02, -0.2, 0xc084fc, 0.04);
  glowEye(headGroup, 0.08, 0.02, -0.2, 0xc084fc, 0.04);
  const hat = new THREE.Group();
  headGroup.add(hat);
  const brim = monsterPart(hat, new THREE.CylinderGeometry(0.4, 0.4, 0.045, 16), robe, 0, 0.16, 0);
  const cone = monsterPart(hat, new THREE.ConeGeometry(0.18, 0.78, 12), robe, 0.04, 0.52, 0);
  cone.rotation.z = 0.22;
  monsterPart(cone, new THREE.TorusGeometry(0.12, 0.02, 6, 12), trim, 0, -0.05, 0).rotation.x = Math.PI / 2;

  const cape = monsterPart(group, new THREE.PlaneGeometry(0.55, 0.9, 4, 6), trim, 0, 1.15, 0.28);
  cape.material.side = THREE.DoubleSide;

  function sleeve(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.38 : 0.38, 1.5, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.14, 0.62, 12), robe, 0, -0.32, 0);
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), charcoal, 0, -0.64, -0.02);
    return pivot;
  }
  const leftArmPivot = sleeve(true);
  const rightArmPivot = sleeve(false);
  group.add(leftArmPivot, rightArmPivot);

  function boot(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.22, 0.04);
    monsterPart(pivot, new THREE.SphereGeometry(0.1, 10, 8), charcoal, 0, -0.06, 0.02).scale.set(0.9, 0.55, 1.3);
    return pivot;
  }
  const leftLegPivot = boot(true);
  const rightLegPivot = boot(false);
  group.add(leftLegPivot, rightLegPivot);

  const staff = new THREE.Group();
  staff.position.set(0.04, -0.35, -0.08);
  staff.rotation.x = -0.25;
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.15, 0.02),
    new THREE.Vector3(0.08, 0.4, -0.04),
    new THREE.Vector3(-0.06, 0.95, 0.02),
    new THREE.Vector3(0.05, 1.4, -0.02)
  ]);
  monsterPart(staff, new THREE.TubeGeometry(shaftCurve, 16, 0.035, 8, false), wood);
  const orb = monsterPart(
    staff,
    new THREE.SphereGeometry(0.13, 16, 12),
    paint(0xc084fc, { emissive: 0xa855f7, emissiveIntensity: 0.95 }),
    0.05, 1.55, -0.02
  );
  monsterPart(staff, new THREE.TorusGeometry(0.18, 0.018, 6, 14), trim, 0.05, 1.55, -0.02);
  rightArmPivot.add(staff);

  return finishMonster(group, monsterHitbox(0.9, 2.5, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

export function buildDarkRanger(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1);
  const cloth = paint(0x18181b, {}, 'cloth');
  const hide = paint(0x166534, {}, 'leather');
  const cloakMat = paint(0x27272a, {}, 'cloth');

  monsterPart(group, new THREE.CylinderGeometry(0.24, 0.3, 0.72, 14), cloth, 0, 1.18, 0);
  const chest = monsterPart(group, new THREE.BoxGeometry(0.62, 0.36, 0.3), hide, 0, 1.34, -0.04);
  [-0.32, 0.32].forEach((ox) => {
    const pad = monsterPart(group, new THREE.SphereGeometry(0.14, 12, 8), hide, ox, 1.52, -0.02);
    pad.scale.set(1.1, 0.7, 0.9);
  });
  const cloak = monsterPart(group, new THREE.PlaneGeometry(0.7, 1.15, 4, 6), cloakMat, 0, 1.05, 0.28);
  cloak.material.side = THREE.DoubleSide;

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.86, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.22, 16, 14), cloth);
  const hood = monsterPart(headGroup, new THREE.SphereGeometry(0.3, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), cloakMat, 0, 0.04, 0.04);
  hood.rotation.x = 0.35;
  const cowl = monsterPart(headGroup, new THREE.ConeGeometry(0.26, 0.42, 12), cloakMat, 0, 0.28, 0.06);
  cowl.rotation.x = 0.4;
  monsterPart(headGroup, new THREE.BoxGeometry(0.32, 0.14, 0.1), cloth, 0, -0.06, -0.18);
  glowEye(headGroup, -0.08, 0.03, -0.22, 0x4ade80, 0.038);
  glowEye(headGroup, 0.08, 0.03, -0.22, 0x4ade80, 0.038);

  addQuiver(group, -0.02, 1.28, 0.32, 0x292524, 0x86efac);

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.42 : 0.42, 1.5, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.08, 0.07, 0.55, 12), cloth, 0, -0.3, 0);
    monsterPart(pivot, new THREE.SphereGeometry(0.08, 10, 8), hide, 0, -0.6, -0.02);
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);
  addStrungBow(rightArmPivot, 1.2, 0x14532d, 0.28);

  function leg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.15 : 0.15, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.09, 0.5, 12), cloth, 0, -0.26, 0);
    const boot = monsterPart(pivot, new THREE.SphereGeometry(0.11, 10, 8), paint(0x1c1917, {}, 'leather'), 0, -0.54, 0.02);
    boot.scale.set(0.9, 0.6, 1.35);
    return pivot;
  }
  const leftLegPivot = leg(true);
  const rightLegPivot = leg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.88, 2.4, 1.2), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

export function buildHillGiant(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.55);
  const skin = paint(0xd6a87c, {}, speciesAlbedo('hill_giant'));
  const beardMat = paint(0x5c3a21, {}, speciesAlbedo('hill_giant'));
  const fur = paint(0x78350f, {}, speciesAlbedo('hill_giant'));
  const bone = paint(0xf5f5f4);
  const wood = paint(0x5c3a21, {}, 'wood');
  const stone = paint(0x78716c, {}, 'stone');

  const belly = monsterPart(group, new THREE.SphereGeometry(0.46, 16, 14), skin, 0, 1.12, 0.02);
  belly.scale.set(1.2, 1.05, 0.92);
  const chest = monsterPart(group, new THREE.SphereGeometry(0.4, 16, 12), skin, 0, 1.52, -0.04);
  chest.scale.set(1.4, 0.72, 0.82);
  const cloth = monsterPart(group, new THREE.ConeGeometry(0.42, 0.48, 10, 1, true), fur, 0, 0.72, 0.02);
  cloth.material.side = THREE.DoubleSide;
  const buckle = monsterPart(group, new THREE.SphereGeometry(0.11, 12, 8), bone, 0, 0.9, -0.28);
  glowEye(buckle, -0.035, 0.02, -0.08, 0x1c1917, 0.022);
  glowEye(buckle, 0.035, 0.02, -0.08, 0x1c1917, 0.022);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.02, 0);
  group.add(headGroup);
  const skull = monsterPart(headGroup, new THREE.SphereGeometry(0.28, 16, 14), skin);
  skull.scale.set(1.05, 1.02, 0.96);
  const brow = monsterPart(headGroup, new THREE.BoxGeometry(0.36, 0.07, 0.1), skin, 0, 0.08, -0.2);
  brow.rotation.x = -0.4;
  glowEye(headGroup, -0.09, 0.02, -0.25, 0x1c1917, 0.04);
  glowEye(headGroup, 0.09, 0.02, -0.25, 0x1c1917, 0.04);
  const beard = monsterPart(headGroup, new THREE.SphereGeometry(0.22, 12, 10), beardMat, 0, -0.16, -0.06);
  beard.scale.set(1.05, 1.25, 0.85);
  [-0.12, 0, 0.12].forEach((ox) => {
    const tuft = monsterPart(headGroup, new THREE.ConeGeometry(0.07, 0.28, 6), beardMat, ox, -0.38, -0.08);
    tuft.rotation.x = 0.25;
  });

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.58 : 0.58, 1.58, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.14, 0.12, 0.48, 12), skin, 0, -0.26, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.11, 0.1, 0.4, 12), skin, 0, -0.62, -0.04);
    monsterPart(pivot, new THREE.SphereGeometry(0.13, 12, 8), skin, 0, -0.84, -0.06);
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);

  const club = new THREE.Group();
  club.position.set(0.06, -0.7, -0.08);
  club.rotation.x = -1.15;
  const trunk = monsterPart(club, new THREE.CylinderGeometry(0.1, 0.18, 1.35, 8), wood, 0, 0.45, 0);
  trunk.rotation.z = 0.12;
  for (let i = 0; i < 6; i++) {
    const spike = monsterPart(trunk, new THREE.ConeGeometry(0.06, 0.22, 5), stone, 0, 0.15 + (i % 3) * 0.22, 0);
    spike.rotation.z = (i - 2) * 0.7;
    spike.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.8;
  }
  rightArmPivot.add(club);

  function leg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.22 : 0.22, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.16, 0.14, 0.42, 12), skin, 0, -0.22, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.13, 0.12, 0.36, 12), skin, 0, -0.52, 0);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.16, 12, 8), skin, 0, -0.72, -0.04);
    foot.scale.set(0.85, 0.5, 1.4);
    return pivot;
  }
  const leftLegPivot = leg(true);
  const rightLegPivot = leg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.95, 2.6, 1.3), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

export function buildMossGuardian(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.72);
  const stone = paint(0x44403c, {}, speciesAlbedo('moss_guardian'));
  const bark = paint(0x3f6212, {}, speciesAlbedo('moss_guardian'));
  const moss = paint(0x16a34a, {}, 'grass');

  const core = monsterPart(group, new THREE.SphereGeometry(0.5, 16, 14), stone, 0.06, 1.2, 0);
  core.scale.set(1.25, 1.05, 0.95);
  const barkPlate = monsterPart(group, new THREE.SphereGeometry(0.32, 14, 12), bark, -0.18, 1.35, -0.08);
  barkPlate.scale.set(1.1, 0.8, 0.7);
  const shoulderL = monsterPart(group, new THREE.SphereGeometry(0.34, 14, 12), stone, -0.48, 1.5, 0);
  const shoulderR = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), bark, 0.5, 1.42, 0.04);
  [[0.05, 1.55, 0.22], [-0.35, 1.62, 0.12], [0.28, 1.48, -0.16], [0.1, 1.15, 0.28]].forEach(([x, y, z]) => {
    const pad = monsterPart(group, new THREE.SphereGeometry(0.2, 12, 10), moss, x, y, z);
    pad.scale.set(1.2, 0.65, 1);
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0.02, 1.62, -0.18);
  group.add(headGroup);
  const crag = monsterPart(headGroup, new THREE.SphereGeometry(0.24, 12, 10), bark);
  crag.scale.set(1.15, 0.8, 0.9);
  glowEye(headGroup, -0.08, 0.02, -0.18, 0x4ade80, 0.045);
  glowEye(headGroup, 0.08, 0.02, -0.18, 0x4ade80, 0.045);
  [-1, 1].forEach((side) => {
    const antler = monsterPart(headGroup, new THREE.CylinderGeometry(0.035, 0.06, 0.5, 7), bark, side * 0.16, 0.22, 0);
    antler.rotation.z = side * -0.7;
    const branch = monsterPart(antler, new THREE.CylinderGeometry(0.02, 0.035, 0.26, 6), bark, side * 0.1, 0.08, 0);
    branch.rotation.z = side * -1.1;
    const leaf = monsterPart(branch, new THREE.SphereGeometry(0.1, 8, 6), moss, 0, 0.14, 0);
    leaf.scale.set(1.2, 0.7, 0.8);
  });

  const leftArmPivot = monsterPivot(-0.62, 1.4, 0);
  const root = monsterPart(leftArmPivot, new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), bark, -0.08, -0.38, 0);
  root.rotation.z = 0.25;
  monsterPart(leftArmPivot, new THREE.SphereGeometry(0.14, 10, 8), moss, -0.16, -0.72, -0.04);
  const rightArmPivot = monsterPivot(0.58, 1.38, 0);
  const boulder = monsterPart(rightArmPivot, new THREE.SphereGeometry(0.36, 14, 12), stone, 0.12, -0.5, -0.06);
  boulder.scale.set(1.15, 0.9, 1);
  const cap = monsterPart(boulder, new THREE.SphereGeometry(0.2, 10, 8), moss, 0.04, 0.2, -0.08);
  cap.scale.set(1.2, 0.6, 1);
  group.add(leftArmPivot, rightArmPivot);

  function rootLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.24 : 0.26, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.16, 0.2, 0.46, 8), bark, 0, -0.24, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.12, 0.16, 0.36, 7), stone, 0, -0.55, 0.02);
    [-0.1, 0.1].forEach((ox) => {
      const toe = monsterPart(pivot, new THREE.ConeGeometry(0.05, 0.18, 5), bark, ox, -0.74, -0.06);
      toe.rotation.x = Math.PI / 2;
    });
    return pivot;
  }
  const leftLegPivot = rootLeg(true);
  const rightLegPivot = rootLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(1.05, 2.5, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot
  });
}

export function buildLesserDemon(def) {
  const group = new THREE.Group();
  group.scale.setScalar(def.scale || 1.8);
  const skin = paint(0xdc2626, {}, speciesAlbedo('lesser_demon'));
  const hornMat = paint(0x111827);
  const mane = paint(0x1f2937);
  const hoofMat = paint(0x111827, {}, 'leather');

  const waist = monsterPart(group, new THREE.SphereGeometry(0.28, 14, 12), skin, 0, 1.02, 0);
  waist.scale.set(0.85, 1.15, 0.7);
  monsterPart(group, new THREE.SphereGeometry(0.22, 12, 10), skin, -0.14, 1.42, -0.08);
  monsterPart(group, new THREE.SphereGeometry(0.22, 12, 10), skin, 0.14, 1.42, -0.08);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.88, 0);
  group.add(headGroup);
  monsterPart(headGroup, new THREE.SphereGeometry(0.24, 16, 14), skin).scale.set(1.05, 0.95, 1.05);
  glowEye(headGroup, -0.08, 0.03, -0.2, 0xfde047, 0.045);
  glowEye(headGroup, 0.08, 0.03, -0.2, 0xfde047, 0.045);
  [-1, 1].forEach((side) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.1, 0.14, 0),
      new THREE.Vector3(side * 0.34, 0.36, 0.02),
      new THREE.Vector3(side * 0.16, 0.62, -0.06)
    ]);
    monsterPart(headGroup, new THREE.TubeGeometry(curve, 12, 0.055, 8, false), hornMat);
  });
  for (let i = 0; i < 5; i++) {
    const tuft = monsterPart(headGroup, new THREE.ConeGeometry(0.055, 0.26, 6), mane, (i - 2) * 0.07, 0.12, 0.12);
    tuft.rotation.x = -0.9;
  }

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.85, 0.55, 1.45, 0.2);
  wingShape.quadraticCurveTo(1.05, -0.2, 0.62, -0.48);
  wingShape.quadraticCurveTo(0.28, -0.22, 0, -0.32);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.045, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02
  });
  wingGeo.rotateX(Math.PI / 2);
  const wingMat = paint(0x111827, {}, 'leather');
  const lWing = new THREE.Mesh(wingGeo, wingMat);
  lWing.scale.x = -1;
  lWing.position.set(-0.28, 1.5, 0.12);
  lWing.castShadow = true;
  const rWing = new THREE.Mesh(wingGeo, wingMat);
  rWing.position.set(0.28, 1.5, 0.12);
  rWing.castShadow = true;
  group.add(lWing, rWing);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.95, 0.15),
    new THREE.Vector3(0.2, 0.72, 0.55),
    new THREE.Vector3(-0.12, 0.9, 0.95),
    new THREE.Vector3(0.05, 1.1, 1.25)
  ]);
  monsterPart(group, new THREE.TubeGeometry(tailCurve, 16, 0.045, 8, false), skin);
  const spade = monsterPart(group, new THREE.ConeGeometry(0.12, 0.28, 4), hornMat, 0.05, 1.16, 1.32);
  spade.scale.set(1.5, 1, 0.28);
  spade.rotation.x = 1.15;

  function arm(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.46 : 0.46, 1.48, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.09, 0.08, 0.46, 12), skin, 0, -0.24, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.07, 0.06, 0.36, 12), skin, 0, -0.56, -0.04);
    const hand = monsterPart(pivot, new THREE.SphereGeometry(0.09, 10, 8), skin, 0, -0.76, -0.06);
    [-0.05, 0.05].forEach((ox) => {
      const claw = monsterPart(hand, new THREE.ConeGeometry(0.02, 0.12, 5), hornMat, ox, -0.06, -0.06);
      claw.rotation.x = Math.PI / 2.4;
    });
    return pivot;
  }
  const leftArmPivot = arm(true);
  const rightArmPivot = arm(false);
  group.add(leftArmPivot, rightArmPivot);
  const blade = monsterPart(
    rightArmPivot,
    new THREE.BoxGeometry(0.07, 0.72, 0.16),
    paint(0x111827, { emissive: 0xf97316, emissiveIntensity: 0.55 }),
    0.02, -0.85, -0.16
  );
  blade.rotation.x = -0.7;

  function hoofLeg(isLeft) {
    const pivot = monsterPivot(isLeft ? -0.16 : 0.16, 0.78, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.1, 0.09, 0.4, 12), skin, 0, -0.2, 0);
    monsterPart(pivot, new THREE.CylinderGeometry(0.08, 0.07, 0.32, 12), skin, 0, -0.48, 0);
    [-0.045, 0.045].forEach((ox) => {
      const hoof = monsterPart(pivot, new THREE.SphereGeometry(0.06, 8, 6), hoofMat, ox, -0.66, -0.02);
      hoof.scale.set(0.7, 0.5, 1.15);
    });
    return pivot;
  }
  const leftLegPivot = hoofLeg(true);
  const rightLegPivot = hoofLeg(false);
  group.add(leftLegPivot, rightLegPivot);

  return finishMonster(group, monsterHitbox(0.95, 2.55, 1.25), {
    headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, lWing, rWing
  });
}

export function buildElvargMesh(def) {
  const grp = new THREE.Group();
  const scaleMat = paint(def.bodyColor, {}, speciesAlbedo('elvarg_dragon'));
  const goldMat = paint(def.accentColor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  const body = monsterPart(grp, new THREE.SphereGeometry(1.35, 16, 14), scaleMat, 0, 1.65, 0);
  body.scale.set(1.0, 0.85, 1.65);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.8, -1.6),
    new THREE.Vector3(0, 2.7, -2.3),
    new THREE.Vector3(0, 3.65, -2.7)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(neckCurve, 16, 0.48, 10, false), scaleMat);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.5, 1.6),
    new THREE.Vector3(0.4, 0.9, 3.2),
    new THREE.Vector3(-0.3, 0.5, 4.8)
  ]);
  monsterPart(grp, new THREE.TubeGeometry(tailCurve, 16, 0.32, 10, false), scaleMat);

  function spikesAlong(curve, count, length) {
    for (let i = 1; i < count; i++) {
      const p = curve.getPoint(i / count);
      const spike = monsterPart(grp, new THREE.ConeGeometry(0.08, length, 6), goldMat, p.x, p.y + length * 0.35, p.z);
      spike.rotation.x = -0.4;
    }
  }
  spikesAlong(neckCurve, 5, 0.42);
  spikesAlong(tailCurve, 6, 0.36);
  for (let i = 0; i < 5; i++) {
    const spike = monsterPart(grp, new THREE.ConeGeometry(0.1, 0.48, 6), goldMat, 0, 2.55, -0.85 + i * 0.42);
    spike.rotation.x = -0.2;
  }

  const head = monsterPart(grp, new THREE.SphereGeometry(0.62, 16, 14), scaleMat, 0, 3.75, -3.15);
  head.scale.set(0.88, 0.78, 1.45);
  [-0.32, 0.32].forEach((ox) => {
    const horn = monsterPart(grp, new THREE.ConeGeometry(0.14, 0.95, 10), goldMat, ox, 4.2, -2.8);
    horn.rotation.x = -0.85;
  });
  [-0.2, 0.2].forEach((ox) => {
    const eye = monsterPart(grp, new THREE.SphereGeometry(0.09, 12, 8), eyeMat, ox, 3.82, -3.85);
    eye.userData.noOutline = true;
  });

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(2.2, 0.9, 4.2, 0.4);
  wingShape.quadraticCurveTo(3.1, -0.6, 1.8, -0.9);
  wingShape.quadraticCurveTo(0.8, -0.5, 0, -0.8);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03
  });
  wingGeo.rotateX(Math.PI / 2);
  const lWing = new THREE.Mesh(wingGeo, goldMat);
  lWing.scale.x = -1;
  lWing.position.set(-0.9, 2.35, -0.4);
  lWing.castShadow = true;
  const rWing = new THREE.Mesh(wingGeo, goldMat);
  rWing.position.set(0.9, 2.35, -0.4);
  rWing.castShadow = true;
  grp.add(lWing, rWing);

  function dragonLeg(x, z) {
    const pivot = monsterPivot(x, 1.2, z);
    const s = Math.sign(x) || 1;
    const thigh = monsterPart(pivot, new THREE.CylinderGeometry(0.22, 0.15, 0.55, 12), scaleMat, s * 0.12, -0.28, 0);
    thigh.rotation.z = s * 0.4;
    monsterPart(pivot, new THREE.CylinderGeometry(0.13, 0.09, 0.48, 10), scaleMat, s * 0.28, -0.68, 0.04);
    const foot = monsterPart(pivot, new THREE.SphereGeometry(0.14, 12, 8), scaleMat, s * 0.32, -0.98, -0.05);
    foot.scale.set(1.05, 0.45, 1.35);
    [-0.08, 0, 0.08].forEach((oz) => {
      const claw = monsterPart(foot, new THREE.ConeGeometry(0.035, 0.18, 6), goldMat, 0, -0.02, -0.12 + oz);
      claw.rotation.x = Math.PI / 2;
    });
    return pivot;
  }
  const leftArmPivot = dragonLeg(-0.95, -0.85);
  const rightArmPivot = dragonLeg(0.95, -0.85);
  const leftLegPivot = dragonLeg(-0.8, 0.9);
  const rightLegPivot = dragonLeg(0.8, 0.9);
  grp.add(leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot);

  return finishMonster(grp, monsterHitbox(2.9, 4.4, 2.2), {
    leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, lWing, rWing
  });
}

export function createMonsterMesh(def, typeKey) {
  switch (typeKey) {
    case 'chicken': return buildChickenMesh(def);
    case 'goblin': return buildGoblinMesh(def, 'raider');
    case 'goblin_archer': return buildGoblinMesh(def, 'archer');
    case 'scorpion': return buildScorpionMesh();
    case 'dark_wizard': return buildDarkWizard(def);
    case 'dark_ranger': return buildDarkRanger(def);
    case 'hill_giant': return buildHillGiant(def);
    case 'moss_guardian': return buildMossGuardian(def);
    case 'lesser_demon': return buildLesserDemon(def);
    case 'elvarg_dragon': return buildElvargMesh(def);
    default:
      return buildGoblinMesh(def, 'raider');
  }
}

export function poseMonsterLimbs(m, moving, now, dt) {
  const rig = m.rig;
  if (!rig || m.isDying) return;

  const groundY = getTerrainHeight(m.pos.x, m.pos.z);

  // Flinch Reaction on Hit
  if (m.flinch > 0) {
    m.flinch = Math.max(0, m.flinch - dt * 3.8);
    const curve = Math.sin(m.flinch * Math.PI);
    rig.group.position.y = groundY + curve * 0.16;
    rig.group.rotation.x = curve * 0.24;
    if (rig.headGroup) rig.headGroup.rotation.x = -curve * 0.36;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = curve * 0.45;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = curve * 0.35;
    return;
  }
  rig.group.rotation.x = 0;

  // Distinct Attack Animations
  if (m.attackAnim > 0) {
    m.attackAnim = Math.max(0, m.attackAnim - dt * 3.2);
    const progress = Math.sin(m.attackAnim * Math.PI);
    if (m.typeKey === 'elvarg_dragon') {
      if (rig.headGroup) rig.headGroup.rotation.x = -0.35 + progress * 0.65;
      if (rig.lWing && rig.rWing) {
        rig.lWing.rotation.z = 0.2 + progress * 0.55;
        rig.rWing.rotation.z = -0.2 - progress * 0.55;
      }
      rig.group.position.y = groundY + progress * 0.32;
    } else if (m.typeKey === 'dark_wizard') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.65 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -1.45 * progress;
      if (rig.headGroup) rig.headGroup.rotation.x = -0.25 * progress;
      rig.group.position.y = groundY + progress * 0.12;
    } else if (m.typeKey === 'moss_guardian' || m.typeKey === 'hill_giant') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.8 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -1.8 * progress;
      rig.group.position.y = groundY + progress * 0.22;
    } else if (m.typeKey === 'goblin' || m.typeKey === 'hobgoblin') {
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -1.55 * progress;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = progress * 0.4;
      rig.group.position.y = groundY + progress * 0.25;
    } else {
      const slash = progress * 1.45;
      if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -slash;
      if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = slash * 0.4;
      rig.group.position.y = groundY + progress * 0.1;
    }
    return;
  }

  // Locomotion Walk Poses
  if (moving && rig.leftLegPivot && rig.rightLegPivot) {
    const s = Math.sin(now * (m.inCombatWithPlayer ? 0.01 : 0.007)) * (m.inCombatWithPlayer ? 0.52 : 0.38);
    rig.leftLegPivot.rotation.x = s;
    rig.rightLegPivot.rotation.x = -s;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = -s * 0.75;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = s * 0.75;
    rig.group.position.y = groundY + Math.abs(Math.sin(now * 0.014)) * 0.06;
    return;
  }

  // Idle Breathing & Ambient Alive Pose
  const breath = Math.sin(now * 0.003) * 0.07;
  rig.group.position.y = groundY + Math.abs(breath) * 0.04;
  if (rig.headGroup) rig.headGroup.rotation.y = Math.sin(now * 0.0016) * 0.14;
  if (rig.leftLegPivot && rig.rightLegPivot) {
    rig.leftLegPivot.rotation.x *= 0.86;
    rig.rightLegPivot.rotation.x *= 0.86;
  }
  if (rig.leftArmPivot) rig.leftArmPivot.rotation.x = breath;
  if (rig.rightArmPivot) rig.rightArmPivot.rotation.x = -breath * 0.45;
}
