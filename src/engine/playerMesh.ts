// @ts-nocheck
import * as THREE from 'three';
import { G, player } from './context';
import { getTerrainHeight } from '../state/terrain';
import { STATE } from '../state/gameState';
import { ITEMS } from '../data/items';
import { buildHumanoidRig, LEAN_RIG } from './humanoid';
import { loadBlenderHeroTemplate, upgradeHumanoidRigWithGltf } from './blenderHero';
import { loadBlenderGearTemplate } from './blenderGear';
import {
  buildAmuletVisual,
  buildBodyVisual,
  buildBootVisual,
  buildCapeVisual,
  buildGloveVisual,
  buildHeadVisual,
  buildLegsVisual,
  buildRingVisual,
  buildShieldVisual,
  buildWeaponVisual,
  headShowsHair
} from './playerGear';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoForItem, applyAlbedo, sealAlbedoUvs } from './textures';
import { getEquipmentBonuses } from './runtime';

export function buildPlayerCharacter() {
  const rig = buildHumanoidRig(0x586436, 0x3e2b1e, 0x505c30, 1.06);
  player.meshGroup = rig.group;
  player.parts = rig;

  const ringGeo = new THREE.RingGeometry(1.15, 2.45, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38e8ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0
  });
  const spinRing = new THREE.Mesh(ringGeo, ringMat);
  spinRing.position.y = 1.1;
  player.meshGroup.add(spinRing);
  player.parts.spinRing = spinRing;

  player.pos.y = getTerrainHeight(player.pos.x, player.pos.z);
  player.meshGroup.position.copy(player.pos);
  player.meshGroup.rotation.y = player.yaw + Math.PI;
  G.scene.add(player.meshGroup);

  rebuildPlayerEquipmentMeshes();

  loadBlenderHeroTemplate().then((gltf) => {
    if (!gltf) return;
    const animator = upgradeHumanoidRigWithGltf(rig, gltf, 0x586436, 0x3e2b1e, 0x505c30, {
      isPlayer: true,
      bootHex: 0x342418,
      skinHex: 0xf5d8c2
    });
    if (animator) {
      player.blenderAnimator = animator;
      rebuildPlayerEquipmentMeshes();
    }
  });
  loadBlenderGearTemplate().then((gearGltf) => {
    if (!gearGltf) return;
    rebuildPlayerEquipmentMeshes();
  });
}

export function syncWhipGeometry(rig, stretch) {
  if (!rig) return;
  const pts = rig.rest.map((p, i) => {
    const reach = i / Math.max(1, rig.rest.length - 1);
    const wave = Math.sin(stretch * Math.PI + i * 0.85) * 0.18 * reach * stretch;
    return new THREE.Vector3(
      p.x + wave,
      p.y + stretch * reach * 0.12,
      p.z - stretch * reach * 1.2
    );
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  if (rig.tube) {
    rig.tube.geometry.dispose();
    rig.tube.geometry = new THREE.TubeGeometry(curve, 22, 0.036, 8, false);
  }
  rig.nodes.forEach((node, i) => {
    node.position.copy(curve.getPoint(i / Math.max(1, rig.nodes.length - 1)));
  });
}

export function rebuildPlayerEquipmentMeshes() {
  if (!player.parts || !player.parts.rightArmPivot) return;
  const rArm = player.parts.rightArmPivot;
  const lArm = player.parts.leftArmPivot;
  const headG = player.parts.headGroup;
  const torso = player.parts.torso;
  const lLeg = player.parts.leftLegPivot;
  const rLeg = player.parts.rightLegPivot;

  const gearKeys = [
    'wepMesh', 'shieldMesh', 'helmMesh', 'capeMesh', 'amuletMesh', 'ringMesh',
    'bodyArmorMesh', 'bodyArmL', 'bodyArmR',
    'legsArmorMesh', 'legsArmorL', 'legsArmorR',
    'feetMeshL', 'feetMeshR', 'handsMeshL', 'handsMeshR', 'setBonusCue'
  ];
  gearKeys.forEach((key) => {
    const node = player.parts[key];
    if (node && node.parent) node.parent.remove(node);
    player.parts[key] = null;
  });
  player.parts.whipRig = null;

  const mount = (parent, node, key) => {
    if (!parent || !node) return;
    parent.add(node);
    player.parts[key] = node;
  };

  // 1. Body Armor Material
  const bodyId = STATE.equipment.body;
  if (bodyId && ITEMS[bodyId]) {
    player.parts.tunicMat.color.setHex(ITEMS[bodyId].color || 0x586436);
    player.parts.tunicMat.metalness = bodyId === 'champion_tunic' ? 0.1 : 0.65;
    player.parts.tunicMat.roughness = bodyId === 'champion_tunic' ? 0.5 : 0.28;
    applyAlbedo(player.parts.tunicMat, albedoForItem(ITEMS[bodyId]));
  } else {
    player.parts.tunicMat.color.setHex(0x586436);
    player.parts.tunicMat.metalness = 0.08;
    player.parts.tunicMat.roughness = 0.52;
    applyAlbedo(player.parts.tunicMat, 'gear:cloth');
  }

  // 2. Leg Armor Material (Platelegs / Tassets / Trousers)
  const legsId = STATE.equipment.legs;
  if (legsId && ITEMS[legsId]) {
    player.parts.legsMat.color.setHex(ITEMS[legsId].color || 0x505c30);
    player.parts.legsMat.metalness = legsId === 'hylian_trousers' ? 0.05 : 0.65;
    player.parts.legsMat.roughness = legsId === 'hylian_trousers' ? 0.65 : 0.28;
    applyAlbedo(player.parts.legsMat, albedoForItem(ITEMS[legsId]));
  } else {
    player.parts.legsMat.color.setHex(0x505c30);
    player.parts.legsMat.metalness = 0.05;
    applyAlbedo(player.parts.legsMat, 'gear:cloth');
  }

  // 3. Boots Material (Feet)
  const feetId = STATE.equipment.feet;
  if (feetId && ITEMS[feetId]) {
    player.parts.bootMat.color.setHex(ITEMS[feetId].color || 0x342418);
    player.parts.bootMat.metalness = feetId === 'leather_boots' ? 0.1 : 0.65;
    applyAlbedo(player.parts.bootMat, albedoForItem(ITEMS[feetId]));
  } else {
    player.parts.bootMat.color.setHex(0x342418);
    player.parts.bootMat.metalness = 0.1;
    applyAlbedo(player.parts.bootMat, 'gear:leather');
  }

  // 4. Gauntlets Material (Hands & Bracers)
  const handsId = STATE.equipment.hands;
  if (handsId && ITEMS[handsId]) {
    player.parts.gloveMat.color.setHex(ITEMS[handsId].color || 0x78350f);
    player.parts.gloveMat.metalness = handsId === 'leather_gloves' ? 0.1 : 0.6;
    applyAlbedo(player.parts.gloveMat, albedoForItem(ITEMS[handsId]));
    if (player.parts.bracerMat) {
      player.parts.bracerMat.color.setHex(ITEMS[handsId].color || 0x78350f);
      player.parts.bracerMat.metalness = handsId === 'leather_gloves' ? 0.1 : 0.65;
      player.parts.bracerMat.roughness = handsId === 'leather_gloves' ? 0.65 : 0.3;
      applyAlbedo(player.parts.bracerMat, albedoForItem(ITEMS[handsId]));
    }
  } else {
    player.parts.gloveMat.color.setHex(0xf5d8c2);
    player.parts.gloveMat.metalness = 0.05;
    applyAlbedo(player.parts.gloveMat, 'creature:skin');
    if (player.parts.bracerMat) {
      player.parts.bracerMat.color.setHex(0x4e3524);
      player.parts.bracerMat.metalness = 0.1;
      player.parts.bracerMat.roughness = 0.65;
      applyAlbedo(player.parts.bracerMat, 'gear:leather');
    }
  }

  const equip = (slot) => {
    const id = STATE.equipment[slot];
    return id && ITEMS[id] ? ITEMS[id] : null;
  };

  const isBlenderHero = !!player.parts.leftElbowPivot;

  const weapon = equip('weapon');
  if (weapon) {
    const visual = buildWeaponVisual(weapon);
    if (player.parts.rightElbowPivot) {
      visual.group.position.set(0.19, -0.32, 0.08);
      visual.group.rotation.set(-0.2, 0.0, 0.1);
      mount(player.parts.rightElbowPivot, visual.group, 'wepMesh');
    } else {
      visual.group.position.set(0, LEAN_RIG.handY, -0.08);
      mount(rArm, visual.group, 'wepMesh');
    }
    player.parts.whipRig = visual.whipRig;
    if (visual.whipRig) syncWhipGeometry(visual.whipRig, 0);
  }

  const shieldItem = equip('shield');
  if (shieldItem) {
    const shield = buildShieldVisual(shieldItem);
    const defender = shield.userData.silhouette === 'defender';
    if (player.parts.leftElbowPivot) {
      if (defender) {
        shield.position.set(-0.19, -0.31, 0.08);
        shield.rotation.set(0, 0, 0);
      } else {
        shield.position.set(-0.20, -0.22, 0.08);
        shield.rotation.set(0, -Math.PI / 2, 0);
      }
      mount(player.parts.leftElbowPivot, shield, 'shieldMesh');
    } else {
      shield.position.set(defender ? 0.0 : -0.08, defender ? LEAN_RIG.handY + 0.04 : -0.46, defender ? -0.1 : -0.05);
      mount(lArm, shield, 'shieldMesh');
    }
  }

  const headItem = equip('head');
  const showHair = headShowsHair(headItem);
  if (player.parts.hairCap) player.parts.hairCap.visible = showHair;
  if (headG) {
    headG.traverse((ch) => {
      if (
        ch.name.startsWith('Hair') ||
        ch.name.startsWith('CrownSpike_') ||
        ch.name.startsWith('BackSpike_') ||
        ch.name.startsWith('Sideburn_')
      ) {
        ch.visible = showHair;
      }
    });
  }
  if (headItem) {
    const helmVisual = buildHeadVisual(headItem);
    if (isBlenderHero) {
      helmVisual.scale.set(0.74, 0.74, 0.74);
      helmVisual.position.set(0, -0.16, 0.01);
    }
    mount(headG, helmVisual, 'helmMesh');
  }

  const bodyItem = equip('body');
  if (bodyItem) {
    const body = buildBodyVisual(bodyItem);
    mount(torso, body.torso, 'bodyArmorMesh');
    mount(lArm, body.left, 'bodyArmL');
    mount(rArm, body.right, 'bodyArmR');
  }
  if (torso) {
    torso.traverse((ch) => {
      if (
        ch.name === 'TorsoCoat' ||
        ch.name.startsWith('OuterCoat_') ||
        ch.name.startsWith('CoatTrim_') ||
        ch.name.startsWith('CoatTail_') ||
        ch.name.startsWith('CoatTailTrim_') ||
        ch.name === 'InnerCollar'
      ) {
        ch.visible = !bodyItem;
      }
    });
  }

  const legsItem = equip('legs');
  if (legsItem) {
    const legs = buildLegsVisual(legsItem);
    mount(torso, legs.torso, 'legsArmorMesh');
    mount(lLeg, legs.left, 'legsArmorL');
    mount(rLeg, legs.right, 'legsArmorR');
    if (isBlenderHero) {
      [legs.left, legs.right].forEach((side) => {
        if (!side) return;
        side.traverse((ch) => {
          if (ch.name.includes('_04_')) {
            ch.visible = false;
          }
        });
      });
    }
  }

  const neck = equip('neck');
  if (neck) {
    const amulet = buildAmuletVisual(neck);
    if (isBlenderHero) {
      amulet.position.set(0, -0.16, -0.04);
    }
    mount(torso, amulet, 'amuletMesh');
  }

  const ring = equip('ring');
  if (ring) {
    const ringMesh = buildRingVisual(ring);
    if (player.parts.rightElbowPivot) {
      ringMesh.position.set(0.19, -0.32, 0.08);
      ringMesh.scale.set(1.0, 1.0, 1.0);
      mount(player.parts.rightElbowPivot, ringMesh, 'ringMesh');
    } else {
      ringMesh.position.set(0, 0, 0);
      mount(rArm, ringMesh, 'ringMesh');
    }
  }

  const feet = equip('feet');
  if (feet) {
    const bootL = buildBootVisual(feet, true);
    const bootR = buildBootVisual(feet, false);
    if (player.parts.leftKneePivot && player.parts.rightKneePivot) {
      bootL.position.set(-0.11, 0.38, -0.01);
      bootR.position.set(0.085, 0.38, -0.01);
      mount(player.parts.leftKneePivot, bootL, 'feetMeshL');
      mount(player.parts.rightKneePivot, bootR, 'feetMeshR');
    } else {
      mount(lLeg, bootL, 'feetMeshL');
      mount(rLeg, bootR, 'feetMeshR');
    }
  }
  if (!isBlenderHero && lLeg && rLeg) {
    [lLeg, rLeg].forEach((leg) => {
      leg.traverse((ch) => {
        if (
          ch.name.startsWith('Boot_') ||
          ch.name.startsWith('BootCuff_') ||
          ch.name.startsWith('BootSole_') ||
          ch.name.startsWith('BootHeel_')
        ) {
          ch.visible = !feet;
        }
      });
    });
  }

  const hands = equip('hands');
  if (hands) {
    const gloveL = buildGloveVisual(hands, true);
    const gloveR = buildGloveVisual(hands, false);
    if (player.parts.leftElbowPivot && player.parts.rightElbowPivot) {
      gloveL.position.set(-0.18, 0.32, 0.08);
      gloveR.position.set(0.18, 0.32, 0.08);
      mount(player.parts.leftElbowPivot, gloveL, 'handsMeshL');
      mount(player.parts.rightElbowPivot, gloveR, 'handsMeshR');
    } else {
      mount(lArm, gloveL, 'handsMeshL');
      mount(rArm, gloveR, 'handsMeshR');
    }
  }
  if (!isBlenderHero && lArm && rArm) {
    [lArm, rArm].forEach((arm) => {
      arm.traverse((ch) => {
        if (ch.name.startsWith('Bracer_') || ch.name.startsWith('BracerLace_')) {
          ch.visible = !hands;
        }
      });
    });
  }

  const capeItem = equip('cape');
  if (capeItem) {
    const cape = buildCapeVisual(capeItem);
    if (isBlenderHero) {
      if (cape.userData.silhouette === 'ava') cape.position.set(0, 0.12, 0.02);
      else cape.position.set(0, 0.22, 0.02);
    } else {
      if (cape.userData.silhouette === 'ava') cape.position.set(0, 0.16, 0.14);
      else cape.position.set(0, 0.285, 0.175);
    }
    mount(torso, cape, 'capeMesh');
  }

  const currentBon = getEquipmentBonuses();
  if (currentBon.matchedSet && torso) {
    const isFull = currentBon.isFullKit;
    const cue = new THREE.Mesh(
      new THREE.TorusGeometry(LEAN_RIG.beltRadius + 0.03, isFull ? 0.024 : 0.016, 8, 24),
      facetMaterial({
        color: isFull ? 0x38bdf8 : 0xfde047,
        emissive: isFull ? 0x0284c7 : 0xfacc15,
        emissiveIntensity: isFull ? 0.95 : 0.7
      })
    );
    cue.rotation.x = Math.PI / 2;
    cue.position.y = LEAN_RIG.beltY - LEAN_RIG.torsoY;
    cue.userData.setBonusCue = true;
    cue.userData.noOutline = true;
    mount(torso, cue, 'setBonusCue');
  }

  if (player.meshGroup) {
    addCartoonOutline(player.meshGroup, LEAN_RIG.outline);
    sealAlbedoUvs(player.meshGroup);
  }
}
