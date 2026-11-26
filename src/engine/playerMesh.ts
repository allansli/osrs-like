import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G, player } from './context';
import { getTerrainHeight } from '../state/terrain';
import { STATE } from '../state/gameState';
import { ITEMS, type ItemDef } from '../data/items';
import { buildHumanoidRig, LEAN_RIG, type HumanoidRig } from './humanoid';
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
  headShowsHair,
  type WhipRig
} from './playerGear';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoForItem, applyAlbedo, sealAlbedoUvs } from './textures';
import { getEquipmentBonuses } from '../state/combat';
import { disposeObject3D } from './dispose';
import { collectFlashMaterials } from './reactions';

export function buildPlayerCharacter(): void {
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
  player.baseYaw = player.yaw + Math.PI;
  player.meshGroup.rotation.y = player.baseYaw;
  G.scene.add(player.meshGroup);

  rebuildPlayerEquipmentMeshes();

  loadBlenderHeroTemplate().then((gltf: GLTF | null) => {
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
  loadBlenderGearTemplate().then((gearGltf: GLTF | null) => {
    if (!gearGltf) return;
    rebuildPlayerEquipmentMeshes();
  });
}

export function syncWhipGeometry(rig: WhipRig | null | undefined, stretch: number): void {
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

export type LoadoutItems = Record<string, string | ItemDef | null | undefined>;

const GEAR_KEYS = [
  'wepMesh', 'shieldMesh', 'helmMesh', 'capeMesh', 'amuletMesh', 'ringMesh',
  'bodyArmorMesh', 'bodyArmL', 'bodyArmR',
  'legsArmorMesh', 'legsArmorL', 'legsArmorR',
  'feetMeshL', 'feetMeshR', 'handsMeshL', 'handsMeshR', 'setBonusCue'
] as const;
type GearKey = (typeof GEAR_KEYS)[number];

export type MountedRig = HumanoidRig & { [K in GearKey]?: THREE.Object3D | null } & {
  whipRig?: WhipRig | null;
};

// The rig types its materials as Lambert; the recolouring below has always set metalness and roughness on them.
type PbrMat = THREE.MeshLambertMaterial & { metalness: number; roughness: number };

// Today's pivot rest positions, from LEAN_RIG; the elbow and knee sit a fixed drop below the shoulder and hip.
const ELBOW_DROP = 0.26;
const KNEE_DROP = 0.38;
const TODAY_PIVOT_REST: Record<string, [number, number, number]> = {
  Torso: [0, LEAN_RIG.torsoY, 0],
  HeadGroup: [0, LEAN_RIG.headY, 0],
  LeftArmPivot: [-LEAN_RIG.shoulderX, LEAN_RIG.shoulderY, 0],
  RightArmPivot: [LEAN_RIG.shoulderX, LEAN_RIG.shoulderY, 0],
  LeftElbowPivot: [-LEAN_RIG.shoulderX, LEAN_RIG.shoulderY - ELBOW_DROP, 0],
  RightElbowPivot: [LEAN_RIG.shoulderX, LEAN_RIG.shoulderY - ELBOW_DROP, 0],
  LeftLegPivot: [-LEAN_RIG.hipX, LEAN_RIG.hipY, 0],
  RightLegPivot: [LEAN_RIG.hipX, LEAN_RIG.hipY, 0],
  LeftKneePivot: [-LEAN_RIG.hipX, LEAN_RIG.hipY - KNEE_DROP, 0],
  RightKneePivot: [LEAN_RIG.hipX, LEAN_RIG.hipY - KNEE_DROP, 0]
};

function getBoneRestPosition(bone: THREE.Object3D, root: THREE.Object3D): THREE.Vector3 {
  let pos: THREE.Vector3 | null = null;
  root.traverse((obj) => {
    if (pos) return;
    const sm = obj as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const idx = sm.skeleton.bones.indexOf(bone as THREE.Bone);
    if (idx !== -1) pos = new THREE.Vector3().setFromMatrixPosition(sm.skeleton.boneInverses[idx].clone().invert());
  });
  if (!pos) throw new Error(`getBoneRestPosition: bone ${bone.name} is not bound by any skinned mesh under ${root.name}`);
  return pos;
}

// The one place the joint-move arithmetic lives: shift a node mounted on a skinned pivot so it sits where it did on today's rig.
function moveToTodayPivot(parent: THREE.Object3D, node: THREE.Object3D, root: THREE.Object3D): void {
  if (!(parent.name in TODAY_PIVOT_REST) || !(parent as THREE.Bone).isBone) return;
  const today = TODAY_PIVOT_REST[parent.name];
  const bone = getBoneRestPosition(parent, root);
  node.position.x += today[0] - bone.x;
  node.position.y += today[1] - bone.y;
  node.position.z += today[2] - bone.z;
}

export function mountLoadout(rig: MountedRig, items: LoadoutItems): void {
  const rArm = rig.rightArmPivot;
  const lArm = rig.leftArmPivot;
  const headG = rig.headGroup;
  const torso = rig.torso;
  const lLeg = rig.leftLegPivot;
  const rLeg = rig.rightLegPivot;

  GEAR_KEYS.forEach((key) => {
    const node = rig[key];
    // Gear geometry is per-node (blender clones are geometry.clone()d) and materials are
    // per-call; textures and the outline material are cached and the helper keeps them.
    if (node) disposeObject3D(node);
    rig[key] = null;
  });
  rig.whipRig = null;

  const mount = (parent: THREE.Object3D | null | undefined, node: THREE.Object3D | null | undefined, key: GearKey): void => {
    if (!parent || !node) return;
    moveToTodayPivot(parent, node, rig.group);
    parent.add(node);
    rig[key] = node;
  };

  const equip = (slot: string): ItemDef | null => {
    const val = items[slot];
    if (!val) return null;
    return typeof val === 'string' ? ITEMS[val] ?? null : val;
  };

  const hasSlot = (slot: string): boolean => slot in items;

  // 1. Body Armor Material
  const tunicMat = rig.tunicMat as PbrMat;
  const bodyItem = equip('body');
  if (bodyItem) {
    tunicMat.color.setHex(bodyItem.color || 0x586436);
    tunicMat.metalness = bodyItem.id === 'champion_tunic' ? 0.1 : 0.65;
    tunicMat.roughness = bodyItem.id === 'champion_tunic' ? 0.5 : 0.28;
    applyAlbedo(tunicMat, albedoForItem(bodyItem));
  } else if (hasSlot('body')) {
    tunicMat.color.setHex(0x586436);
    tunicMat.metalness = 0.08;
    tunicMat.roughness = 0.52;
    applyAlbedo(tunicMat, 'gear:cloth');
  }

  // 2. Leg Armor Material (Platelegs / Tassets / Trousers)
  const legsMat = rig.legsMat as PbrMat;
  const legsItem = equip('legs');
  if (legsItem) {
    legsMat.color.setHex(legsItem.color || 0x505c30);
    legsMat.metalness = legsItem.id === 'hylian_trousers' ? 0.05 : 0.65;
    legsMat.roughness = legsItem.id === 'hylian_trousers' ? 0.65 : 0.28;
    applyAlbedo(legsMat, albedoForItem(legsItem));
  } else if (hasSlot('legs')) {
    legsMat.color.setHex(0x505c30);
    legsMat.metalness = 0.05;
    applyAlbedo(legsMat, 'gear:cloth');
  }

  // 3. Boots Material (Feet)
  const bootMat = rig.bootMat as PbrMat;
  const feetItem = equip('feet');
  if (feetItem) {
    bootMat.color.setHex(feetItem.color || 0x342418);
    bootMat.metalness = feetItem.id === 'leather_boots' ? 0.1 : 0.65;
    applyAlbedo(bootMat, albedoForItem(feetItem));
  } else if (hasSlot('feet')) {
    bootMat.color.setHex(0x342418);
    bootMat.metalness = 0.1;
    applyAlbedo(bootMat, 'gear:leather');
  }

  // 4. Gauntlets Material (Hands & Bracers)
  const gloveMat = rig.gloveMat as PbrMat;
  const bracerMat = rig.bracerMat as PbrMat | undefined;
  const handsItem = equip('hands');
  if (handsItem) {
    gloveMat.color.setHex(handsItem.color || 0x78350f);
    gloveMat.metalness = handsItem.id === 'leather_gloves' ? 0.1 : 0.6;
    applyAlbedo(gloveMat, albedoForItem(handsItem));
    if (bracerMat) {
      bracerMat.color.setHex(handsItem.color || 0x78350f);
      bracerMat.metalness = handsItem.id === 'leather_gloves' ? 0.1 : 0.65;
      bracerMat.roughness = handsItem.id === 'leather_gloves' ? 0.65 : 0.3;
      applyAlbedo(bracerMat, albedoForItem(handsItem));
    }
  } else if (hasSlot('hands')) {
    gloveMat.color.setHex(0xf5d8c2);
    gloveMat.metalness = 0.05;
    applyAlbedo(gloveMat, 'creature:skin');
    if (bracerMat) {
      bracerMat.color.setHex(0x4e3524);
      bracerMat.metalness = 0.1;
      bracerMat.roughness = 0.65;
      applyAlbedo(bracerMat, 'gear:leather');
    }
  }

  const isBlenderHero = !!rig.leftElbowPivot;

  const weapon = equip('weapon');
  if (weapon) {
    const visual = buildWeaponVisual(weapon);
    if (rig.rightElbowPivot) {
      visual.group.position.set(0.19, -0.32, 0.08);
      visual.group.rotation.set(-0.2, 0.0, 0.1);
      mount(rig.rightElbowPivot, visual.group, 'wepMesh');
    } else {
      visual.group.position.set(0, LEAN_RIG.handY, -0.08);
      mount(rArm, visual.group, 'wepMesh');
    }
    rig.whipRig = visual.whipRig;
    if (visual.whipRig) syncWhipGeometry(visual.whipRig, 0);
  }

  const shieldItem = equip('shield');
  if (shieldItem) {
    const shield = buildShieldVisual(shieldItem);
    const defender = shield.userData.silhouette === 'defender';
    if (rig.leftElbowPivot) {
      if (defender) {
        shield.position.set(-0.19, -0.31, 0.08);
        shield.rotation.set(0, 0, 0);
      } else {
        shield.position.set(-0.20, -0.22, 0.08);
        shield.rotation.set(0, -Math.PI / 2, 0);
      }
      mount(rig.leftElbowPivot, shield, 'shieldMesh');
    } else {
      shield.position.set(defender ? 0.0 : -0.08, defender ? LEAN_RIG.handY + 0.04 : -0.46, defender ? -0.1 : -0.05);
      mount(lArm, shield, 'shieldMesh');
    }
  }

  const headItem = equip('head');
  const showHair = headShowsHair(headItem);
  if (rig.hairCap) rig.hairCap.visible = showHair;
  rig.group.traverse((ch: THREE.Object3D) => {
    if (
      ch.name.startsWith('Hair') ||
      ch.name.startsWith('CrownSpike_') ||
      ch.name.startsWith('BackSpike_') ||
      ch.name.startsWith('Sideburn_')
    ) {
      ch.visible = showHair;
    }
  });
  if (headItem) {
    const helmVisual = buildHeadVisual(headItem);
    if (isBlenderHero) {
      helmVisual.scale.set(0.74, 0.74, 0.74);
      helmVisual.position.set(0, -0.16, 0.01);
    }
    mount(headG, helmVisual, 'helmMesh');
  }

  if (bodyItem) {
    const body = buildBodyVisual(bodyItem);
    mount(torso, body.torso, 'bodyArmorMesh');
    mount(lArm, body.left, 'bodyArmL');
    mount(rArm, body.right, 'bodyArmR');
  }
  rig.group.traverse((ch: THREE.Object3D) => {
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

  if (legsItem) {
    const legs = buildLegsVisual(legsItem);
    mount(torso, legs.torso, 'legsArmorMesh');
    mount(lLeg, legs.left, 'legsArmorL');
    mount(rLeg, legs.right, 'legsArmorR');
    if (isBlenderHero) {
      [legs.left, legs.right].forEach((side) => {
        if (!side) return;
        side.traverse((ch: THREE.Object3D) => {
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
    if (rig.rightElbowPivot) {
      ringMesh.position.set(0.19, -0.32, 0.08);
      ringMesh.scale.set(1.0, 1.0, 1.0);
      mount(rig.rightElbowPivot, ringMesh, 'ringMesh');
    } else {
      ringMesh.position.set(0, 0, 0);
      mount(rArm, ringMesh, 'ringMesh');
    }
  }

  if (feetItem) {
    const bootL = buildBootVisual(feetItem, true);
    const bootR = buildBootVisual(feetItem, false);
    if (rig.leftKneePivot && rig.rightKneePivot) {
      bootL.position.set(-0.11, 0.38, -0.01);
      bootR.position.set(0.085, 0.38, -0.01);
      mount(rig.leftKneePivot, bootL, 'feetMeshL');
      mount(rig.rightKneePivot, bootR, 'feetMeshR');
    } else {
      mount(lLeg, bootL, 'feetMeshL');
      mount(rLeg, bootR, 'feetMeshR');
    }
  }
  if (!isBlenderHero && lLeg && rLeg) {
    [lLeg, rLeg].forEach((leg) => {
      leg.traverse((ch: THREE.Object3D) => {
        if (
          ch.name.startsWith('Boot_') ||
          ch.name.startsWith('BootCuff_') ||
          ch.name.startsWith('BootSole_') ||
          ch.name.startsWith('BootHeel_')
        ) {
          ch.visible = !feetItem;
        }
      });
    });
  }

  if (handsItem) {
    const gloveL = buildGloveVisual(handsItem, true);
    const gloveR = buildGloveVisual(handsItem, false);
    if (rig.leftElbowPivot && rig.rightElbowPivot) {
      gloveL.position.set(-0.18, 0.32, 0.08);
      gloveR.position.set(0.18, 0.32, 0.08);
      mount(rig.leftElbowPivot, gloveL, 'handsMeshL');
      mount(rig.rightElbowPivot, gloveR, 'handsMeshR');
    } else {
      mount(lArm, gloveL, 'handsMeshL');
      mount(rArm, gloveR, 'handsMeshR');
    }
  }
  if (!isBlenderHero && lArm && rArm) {
    [lArm, rArm].forEach((arm) => {
      arm.traverse((ch: THREE.Object3D) => {
        if (ch.name.startsWith('Bracer_') || ch.name.startsWith('BracerLace_')) {
          ch.visible = !handsItem;
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
}

export function rebuildPlayerEquipmentMeshes(): void {
  if (!player.parts || !player.parts.rightArmPivot) return;
  mountLoadout(player.parts, STATE.equipment);

  const torso = player.parts.torso;
  const currentBon = getEquipmentBonuses(STATE);
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
    moveToTodayPivot(torso, cue, player.parts.group);
    cue.userData.setBonusCue = true;
    cue.userData.noOutline = true;
    torso.add(cue);
    player.parts.setBonusCue = cue;
  }

  if (player.meshGroup) {
    addCartoonOutline(player.meshGroup, LEAN_RIG.outline);
    sealAlbedoUvs(player.meshGroup);
    collectFlashMaterials(player);
  }
}
