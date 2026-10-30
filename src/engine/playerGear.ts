import * as THREE from 'three';
import type { ItemDef } from '../data/items';
import { LEAN_RIG } from './humanoid';
import { facetMaterial } from './materials';

export type GearSilhouette =
  | 'wizard-hat' | 'robin-hat' | 'hood' | 'sheikah-mask' | 'circlet'
  | 'helm' | 'neitiznot-helm' | 'horned-helm' | 'armadyl-helm'
  | 'plate-body' | 'bandos-chest' | 'trim-plate' | 'dhide-body' | 'robe-top' | 'tunic'
  | 'robe-skirt' | 'tassets' | 'dhide-chaps' | 'platelegs' | 'trousers'
  | 'crossbow' | 'bow' | 'ancient-bow' | 'greataxe' | 'mace' | 'wand'
  | 'staff' | 'ancient-staff' | 'ahrim-staff' | 'whip' | 'scimitar' | 'sword' | 'greatsword'
  | 'defender' | 'elysian' | 'hylian-shield' | 'kiteshield'
  | 'amulet' | 'ring'
  | 'pegasian-boots' | 'primordial-boots' | 'eternal-boots' | 'boots'
  | 'gloves' | 'ava' | 'lava-cape' | 'cape'
  | 'none';

export interface WhipRig {
  tube: THREE.Mesh;
  nodes: THREE.Mesh[];
  rest: THREE.Vector3[];
  wasLashing: boolean;
}

export interface WeaponVisual {
  group: THREE.Group;
  whipRig: WhipRig | null;
}

export interface AnchoredVisual {
  torso: THREE.Group | null;
  left: THREE.Group | null;
  right: THREE.Group | null;
}

function mat(color: number | undefined, extra: Record<string, unknown> = {}): THREE.Material {
  return facetMaterial({ color: color ?? 0x9ca3af, ...extra });
}

function glow(color: number | undefined, intensity = 0.55): THREE.Material {
  const hex = color ?? 0xfde047;
  return mat(hex, { emissive: hex, emissiveIntensity: intensity });
}

function part(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function gearSilhouette(item: ItemDef | null | undefined): GearSilhouette {
  if (!item) return 'none';
  const id = item.id;
  const kind = item.iconKind || '';

  if (item.slot === 'weapon' || ['scimitar', 'sword', 'greatsword', 'bow', 'crossbow', 'staff', 'wand', 'whip', 'greataxe', 'mace'].includes(kind)) {
    if (kind === 'crossbow') return 'crossbow';
    if (kind === 'bow') return id === 'ancient_bow' ? 'ancient-bow' : 'bow';
    if (kind === 'greataxe') return 'greataxe';
    if (kind === 'mace') return 'mace';
    if (kind === 'wand') return 'wand';
    if (kind === 'staff') {
      if (id === 'ancient_staff') return 'ancient-staff';
      if (id === 'ahrim_staff') return 'ahrim-staff';
      return 'staff';
    }
    if (kind === 'whip') return 'whip';
    if (kind === 'greatsword') return 'greatsword';
    if (kind === 'sword') return 'sword';
    return 'scimitar';
  }

  if (item.slot === 'head' || ['hat', 'hood', 'circlet', 'head'].includes(kind)) {
    if (id === 'robin_hat') return 'robin-hat';
    if (kind === 'hat') return 'wizard-hat';
    if (id === 'sheikah_mask') return 'sheikah-mask';
    if (kind === 'hood') return 'hood';
    if (kind === 'circlet') return 'circlet';
    if (id === 'neitiznot_helm') return 'neitiznot-helm';
    if (id === 'dharok_helm' || id === 'torva_helm' || id === 'dragon_helm') return 'horned-helm';
    if (id === 'armadyl_helm') return 'armadyl-helm';
    return 'helm';
  }

  if (item.slot === 'body') {
    if (id === 'bandos_chest') return 'bandos-chest';
    if (id === 'torva_body' || id === 'justiciar_body' || id === 'dragon_chain') return 'trim-plate';
    if (kind === 'dhide_body') return 'dhide-body';
    if (kind === 'robe_top') return 'robe-top';
    if (kind === 'tunic') return 'tunic';
    return 'plate-body';
  }

  if (item.slot === 'legs') {
    if (kind === 'robe_bottom') return 'robe-skirt';
    if (kind === 'tassets') return 'tassets';
    if (kind === 'dhide_chaps') return 'dhide-chaps';
    if (kind === 'trousers') return 'trousers';
    return 'platelegs';
  }

  if (item.slot === 'shield') {
    if (kind === 'defender' || id === 'dragon_defender') return 'defender';
    if (id === 'elysian_shield') return 'elysian';
    if (id === 'hylian_shield') return 'hylian-shield';
    return 'kiteshield';
  }

  if (item.slot === 'neck') return 'amulet';
  if (item.slot === 'ring') return 'ring';
  if (item.slot === 'feet') {
    if (id === 'pegasian_boots') return 'pegasian-boots';
    if (id === 'primordial_boots') return 'primordial-boots';
    if (id === 'eternal_boots') return 'eternal-boots';
    return 'boots';
  }
  if (item.slot === 'hands') return 'gloves';
  if (item.slot === 'cape') {
    if (id === 'ava_accumulator') return 'ava';
    if (id === 'fire_cape' || id === 'infernal_cape') return 'lava-cape';
    return 'cape';
  }
  return 'none';
}

export function headShowsHair(item: ItemDef | null | undefined): boolean {
  return !item || gearSilhouette(item) === 'circlet';
}

function tag(group: THREE.Group, item: ItemDef, silhouette: GearSilhouette): THREE.Group {
  group.userData.gearId = item.id;
  group.userData.silhouette = silhouette;
  return group;
}

function kiteGeometry(bevel: boolean): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.quadraticCurveTo(0.32, -0.22, 0.34, 0.28);
  shape.quadraticCurveTo(0, 0.42, -0.34, 0.28);
  shape.quadraticCurveTo(-0.32, -0.22, 0, -0.45);
  return new THREE.ExtrudeGeometry(shape, {
    depth: bevel ? 0.07 : 0.05,
    bevelEnabled: bevel,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 1
  });
}

function buildHelmShell(group: THREE.Group, item: ItemDef, withVisor: boolean): void {
  const dome = part(group, new THREE.SphereGeometry(LEAN_RIG.headRadius + 0.03, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72), mat(item.color), 0, 0.02, 0);
  dome.scale.set(1, 0.92, 1.02);
  const brow = part(group, new THREE.TorusGeometry(LEAN_RIG.headRadius + 0.012, 0.02, 6, 16), mat(item.trim), 0, -0.02, 0);
  brow.rotation.x = Math.PI / 2;
  if (withVisor) {
    const visor = part(
      group,
      new THREE.BoxGeometry(0.16, 0.04, 0.03),
      mat(0x111827),
      0, -0.015, -0.2
    );
    visor.userData.noOutline = true;
    part(group, new THREE.BoxGeometry(0.036, 0.12, 0.025), mat(item.trim), 0, -0.015, -0.21);
  }
  const plume = part(group, new THREE.SphereGeometry(0.05, 10, 8), mat(item.trim), 0, 0.22, 0.04);
  plume.scale.set(0.4, 1.5, 0.7);
}

export function buildHeadVisual(item: ItemDef): THREE.Group {
  const silhouette = gearSilhouette(item);
  const group = tag(new THREE.Group(), item, silhouette);
  const color = mat(item.color);
  const trim = mat(item.trim);

  if (silhouette === 'wizard-hat') {
    const brim = part(group, new THREE.CylinderGeometry(0.26, 0.26, 0.03, 18), color, 0, 0.06, 0);
    brim.scale.set(1, 1, 0.86);
    const peak = part(group, new THREE.ConeGeometry(0.125, 0.4, 12), color, 0, 0.26, -0.02);
    peak.rotation.x = 0.18;
    const band = part(group, new THREE.TorusGeometry(0.12, 0.016, 6, 14), trim, 0, 0.1, -0.01);
    band.rotation.x = Math.PI / 2;
    return group;
  }

  if (silhouette === 'robin-hat') {
    const cap = part(group, new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), color, 0, 0.12, 0.02);
    cap.scale.set(1.15, 0.55, 1.05);
    cap.rotation.z = -0.35;
    cap.rotation.x = 0.2;
    const feather = part(group, new THREE.ConeGeometry(0.03, 0.22, 6), mat(item.trim || 0xef4444), 0.12, 0.22, 0);
    feather.rotation.z = -0.7;
    feather.rotation.x = -0.3;
    return group;
  }

  if (silhouette === 'hood' || silhouette === 'sheikah-mask') {
    const cowl = part(group, new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), color, 0, 0.03, 0.02);
    cowl.scale.set(1.05, 1.05, 1.08);
    const hem = part(group, new THREE.TorusGeometry(0.21, 0.016, 6, 14), trim, 0, -0.06, -0.02);
    hem.rotation.x = Math.PI / 2.2;
    if (silhouette === 'sheikah-mask') {
      const mask = part(group, new THREE.BoxGeometry(0.22, 0.1, 0.05), mat(0x111827), 0, -0.06, -0.19);
      mask.userData.noOutline = true;
      [-0.07, 0.07].forEach((x) => {
        const eye = part(group, new THREE.SphereGeometry(0.028, 8, 6), glow(item.trim || 0xef4444, 0.9), x, 0.02, -0.25);
        eye.scale.set(1.4, 0.45, 0.4);
      });
    }
    return group;
  }

  if (silhouette === 'circlet') {
    const band = part(group, new THREE.TorusGeometry(LEAN_RIG.headRadius + 0.006, 0.014, 6, 18), trim, 0, 0.05, 0);
    band.rotation.x = Math.PI / 2;
    part(group, new THREE.OctahedronGeometry(0.055), glow(item.color, 0.85), 0, 0.1, -0.24);
    return group;
  }

  buildHelmShell(group, item, true);
  if (silhouette === 'neitiznot-helm') {
    [-1, 1].forEach((side) => {
      const wing = part(group, new THREE.SphereGeometry(0.08, 10, 8), mat(0xf8fafc), side * 0.22, 0.06, 0);
      wing.scale.set(0.28, 1.15, 0.7);
      wing.rotation.z = side * 0.55;
    });
  }
  if (silhouette === 'horned-helm') {
    [-1, 1].forEach((side) => {
      const horn = part(group, new THREE.ConeGeometry(0.036, 0.2, 7), trim, side * 0.14, 0.16, 0);
      horn.rotation.z = side * -0.85;
      horn.rotation.x = 0.3;
    });
    part(group, new THREE.BoxGeometry(0.22, 0.04, 0.04), trim, 0, -0.08, -0.28);
  }
  if (silhouette === 'armadyl-helm') {
    const beak = part(group, new THREE.ConeGeometry(0.055, 0.18, 7), trim, 0, -0.02, -0.24);
    beak.rotation.x = Math.PI / 2.2;
  }
  return group;
}

function pauldron(parent: THREE.Group, item: ItemDef, x: number, scale = 1): THREE.Mesh {
  const shoulderY = LEAN_RIG.shoulderY - LEAN_RIG.torsoY;
  const dome = part(parent, new THREE.SphereGeometry(0.09 * scale, 12, 10), mat(item.color), x, shoulderY + 0.02, 0);
  dome.scale.set(1.05, 0.62, 0.85);
  const rim = part(parent, new THREE.TorusGeometry(0.078 * scale, 0.012, 5, 12), mat(item.trim), x, shoulderY - 0.04, 0);
  rim.rotation.x = Math.PI / 2;
  return dome;
}

export function buildBodyVisual(item: ItemDef): AnchoredVisual {
  const silhouette = gearSilhouette(item);
  const torso = tag(new THREE.Group(), item, silhouette);
  const left = tag(new THREE.Group(), item, silhouette);
  const right = tag(new THREE.Group(), item, silhouette);
  const plateLike = silhouette === 'plate-body' || silhouette === 'bandos-chest' || silhouette === 'trim-plate';

  if (plateLike) {
    pauldron(torso, item, -LEAN_RIG.shoulderX, silhouette === 'bandos-chest' ? 0.85 : 1);
    pauldron(torso, item, LEAN_RIG.shoulderX, silhouette === 'bandos-chest' ? 1.2 : 1);
    part(torso, new THREE.BoxGeometry(0.26, 0.36, 0.05), mat(item.trim), 0, 0.04, -0.16);
    part(torso, new THREE.TorusGeometry(0.185, 0.02, 6, 14), mat(item.trim), 0, -0.34, 0).rotation.x = Math.PI / 2;
    if (silhouette === 'bandos-chest') {
      const spike = part(torso, new THREE.ConeGeometry(0.04, 0.16, 6), mat(item.trim), 0.32, 0.32, 0);
      spike.rotation.z = -0.6;
    }
    if (silhouette === 'trim-plate') {
      part(torso, new THREE.BoxGeometry(0.12, 0.12, 0.03), glow(item.trim, 0.25), 0, 0.1, -0.19);
      part(torso, new THREE.BoxGeometry(0.3, 0.045, 0.035), mat(item.color), 0, -0.14, -0.17);
    }
    return { torso, left: null, right: null };
  }

  if (silhouette === 'dhide-body') {
    [-LEAN_RIG.shoulderX, LEAN_RIG.shoulderX].forEach((x) => {
      const pad = part(torso, new THREE.SphereGeometry(0.075, 10, 8), mat(item.color), x, 0.26, -0.02);
      pad.scale.set(1.1, 0.5, 0.8);
      part(torso, new THREE.SphereGeometry(0.02, 6, 6), mat(item.trim), x, 0.28, -0.08);
    });
    part(torso, new THREE.BoxGeometry(0.32, 0.03, 0.03), mat(item.trim), 0, 0.14, -0.16);
    part(torso, new THREE.BoxGeometry(0.03, 0.32, 0.03), mat(item.trim), -0.08, 0, -0.16);
    part(torso, new THREE.BoxGeometry(0.03, 0.32, 0.03), mat(item.trim), 0.08, 0, -0.16);
    return { torso, left: null, right: null };
  }

  if (silhouette === 'robe-top') {
    const stole = part(torso, new THREE.BoxGeometry(0.36, 0.08, 0.1), mat(item.trim), 0, 0.28, -0.02);
    stole.rotation.x = 0.12;
    const cuffGeo = () => new THREE.CylinderGeometry(0.074, 0.06, 0.08, 10);
    part(left, cuffGeo(), mat(item.color), 0, -0.58, 0);
    part(left, new THREE.TorusGeometry(0.072, 0.01, 5, 10), mat(item.trim), 0, -0.62, 0).rotation.x = Math.PI / 2;
    part(right, cuffGeo(), mat(item.color), 0, -0.58, 0);
    part(right, new THREE.TorusGeometry(0.072, 0.01, 5, 10), mat(item.trim), 0, -0.62, 0).rotation.x = Math.PI / 2;
    return { torso, left, right };
  }

  part(torso, new THREE.BoxGeometry(0.05, 0.42, 0.03), mat(item.trim), -0.08, 0.02, -0.16);
  part(torso, new THREE.TorusGeometry(0.2, 0.016, 6, 12), mat(item.trim), 0, 0.26, 0).rotation.x = Math.PI / 2.1;
  part(torso, new THREE.BoxGeometry(0.32, 0.035, 0.04), mat(item.trim), 0, -0.34, -0.02);
  return { torso, left: null, right: null };
}

export function buildLegsVisual(item: ItemDef): AnchoredVisual {
  const silhouette = gearSilhouette(item);
  const torso = tag(new THREE.Group(), item, silhouette);
  const left = tag(new THREE.Group(), item, silhouette);
  const right = tag(new THREE.Group(), item, silhouette);

  if (silhouette === 'robe-skirt') {
    const skirt = part(torso, new THREE.CylinderGeometry(LEAN_RIG.skirtRadiusTop, LEAN_RIG.skirtRadiusBottom, 0.86, 16), mat(item.color), 0, -0.67, 0);
    skirt.scale.set(1, 1, 0.76);
    part(torso, new THREE.TorusGeometry(0.26, 0.014, 5, 14), mat(item.trim), 0, -1.06, 0).rotation.x = Math.PI / 2;
    part(torso, new THREE.BoxGeometry(0.03, 0.7, 0.016), mat(item.trim), 0, -0.68, -0.2);
    return { torso, left: null, right: null };
  }

  if (silhouette === 'tassets') {
    const fauld = part(torso, new THREE.CylinderGeometry(0.18, LEAN_RIG.skirtRadiusBottom, 0.18, 12), mat(item.color), 0, -0.4, 0);
    fauld.scale.set(1, 1, 0.76);
    part(torso, new THREE.BoxGeometry(0.1, 0.22, 0.03), mat(item.trim), -0.12, -0.52, -0.12);
    part(torso, new THREE.BoxGeometry(0.1, 0.22, 0.03), mat(item.trim), 0.12, -0.52, -0.12);
    [left, right].forEach((leg) => {
      part(leg, new THREE.SphereGeometry(0.065, 10, 8), mat(item.trim), 0, -0.22, -0.04).scale.set(1.05, 0.65, 0.65);
    });
    return { torso, left, right };
  }

  if (silhouette === 'dhide-chaps') {
    part(torso, new THREE.TorusGeometry(0.18, 0.018, 5, 12), mat(item.trim), 0, -0.36, 0).rotation.x = Math.PI / 2;
    part(torso, new THREE.BoxGeometry(0.06, 0.04, 0.03), mat(item.color), 0, -0.36, -0.16);
    [left, right].forEach((leg) => {
      const chap = part(leg, new THREE.BoxGeometry(0.11, 0.46, 0.04), mat(item.color), 0, -0.28, -0.05);
      chap.scale.set(1, 1, 0.8);
      part(leg, new THREE.BoxGeometry(0.05, 0.03, 0.02), mat(item.trim), 0, -0.12, -0.08);
    });
    return { torso, left, right };
  }

  if (silhouette === 'trousers') {
    part(torso, new THREE.BoxGeometry(0.26, 0.035, 0.045), mat(item.trim), 0, -0.36, 0);
    [left, right].forEach((leg, index) => {
      part(leg, new THREE.BoxGeometry(0.03, 0.5, 0.016), mat(item.trim), index === 0 ? 0.05 : -0.05, -0.32, -0.06);
    });
    return { torso, left, right };
  }

  [left, right].forEach((leg) => {
    part(leg, new THREE.SphereGeometry(0.06, 10, 8), mat(item.trim), 0, -0.4, -0.05).scale.set(1.1, 0.6, 0.7);
    part(leg, new THREE.BoxGeometry(0.09, 0.34, 0.03), mat(item.color), 0, -0.22, -0.06);
    part(leg, new THREE.BoxGeometry(0.08, 0.28, 0.025), mat(item.color), 0, -0.58, -0.05);
    part(leg, new THREE.BoxGeometry(0.08, 0.03, 0.02), mat(item.trim), 0, -0.36, -0.08);
  });
  return { torso: null, left, right };
}

function aimForward(group: THREE.Group, angle = -Math.PI / 2.45): THREE.Group {
  group.rotation.x = angle;
  return group;
}

function buildBow(item: ItemDef, ancient: boolean): THREE.Group {
  const group = new THREE.Group();
  const limb = ancient
    ? mat(item.color, { emissive: item.trim || 0x38e8ff, emissiveIntensity: 0.65 })
    : mat(item.color);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.62, 0.16),
    new THREE.Vector3(0, -0.3, -0.16),
    new THREE.Vector3(0, 0, -0.24),
    new THREE.Vector3(0, 0.3, -0.16),
    new THREE.Vector3(0, 0.62, 0.16)
  ]);
  const bow = part(group, new THREE.TubeGeometry(curve, 18, ancient ? 0.028 : 0.038, 8, false), limb);
  bow.castShadow = true;
  part(group, new THREE.SphereGeometry(0.045, 8, 6), mat(item.trim), 0, 0.62, 0.16);
  part(group, new THREE.SphereGeometry(0.045, 8, 6), mat(item.trim), 0, -0.62, 0.16);
  const stringMat = ancient ? glow(item.trim || 0x38e8ff, 0.8) : mat(0xe2e8f0);
  const string = part(group, new THREE.CylinderGeometry(0.007, 0.007, 1.2, 6), stringMat, 0, 0, 0.16);
  string.userData.noOutline = true;
  const grip = part(group, new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), mat(item.trim), 0, 0, -0.22);
  grip.userData.noOutline = false;
  return group;
}

function buildBlade(item: ItemDef, kind: 'scimitar' | 'sword' | 'greatsword'): THREE.Group {
  const group = new THREE.Group();
  const isScim = kind === 'scimitar';
  const isGreat = kind === 'greatsword';
  const len = isGreat ? 1.48 : isScim ? 1.12 : 1.2;
  const shape = new THREE.Shape();
  if (isScim) {
    shape.moveTo(-0.02, 0);
    shape.quadraticCurveTo(-0.18, len * 0.42, -0.04, len);
    shape.lineTo(0.015, len - 0.04);
    shape.quadraticCurveTo(0.05, len * 0.48, 0.055, 0);
  } else if (isGreat) {
    shape.moveTo(-0.08, 0);
    shape.lineTo(-0.1, len * 0.78);
    shape.lineTo(0, len);
    shape.lineTo(0.1, len * 0.78);
    shape.lineTo(0.08, 0);
  } else {
    shape.moveTo(-0.045, 0);
    shape.lineTo(-0.05, len * 0.84);
    shape.lineTo(0, len);
    shape.lineTo(0.05, len * 0.84);
    shape.lineTo(0.045, 0);
  }
  shape.closePath();
  const sacred = item.id === 'master_sword' || item.id === 'deity_sword';
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: isGreat ? 0.08 : 0.05,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: isScim ? 12 : 4
  });
  bladeGeo.center();
  const blade = part(group, bladeGeo, mat(item.color, sacred ? { emissive: item.color, emissiveIntensity: 0.45 } : {}), 0, len * 0.46 + 0.1, 0);
  blade.rotation.y = Math.PI / 2;
  const guardMat = mat(item.trim, sacred ? { emissive: item.trim, emissiveIntensity: 0.3 } : {});
  if (isGreat) {
    [-1, 1].forEach((side) => {
      const wing = part(group, new THREE.SphereGeometry(0.1, 10, 8), guardMat, 0, 0.08, side * 0.16);
      wing.scale.set(0.4, 1.2, 0.28);
      wing.rotation.z = side * -0.7;
    });
  } else {
    const guard = part(group, new THREE.CylinderGeometry(0.028, 0.028, isScim ? 0.34 : 0.28, 10), guardMat, 0, 0.08, 0);
    guard.rotation.x = Math.PI / 2;
  }
  part(group, new THREE.SphereGeometry(isGreat ? 0.07 : 0.05, 10, 8), guardMat, 0, -0.12, 0);
  return aimForward(group);
}

export function buildWeaponVisual(item: ItemDef): WeaponVisual {
  const silhouette = gearSilhouette(item);
  const group = tag(new THREE.Group(), item, silhouette);

  if (silhouette === 'crossbow') {
    part(group, new THREE.BoxGeometry(0.08, 0.06, 0.7), mat(item.color), 0, 0, 0.05);
    const prod = part(group, new THREE.TorusGeometry(0.22, 0.022, 6, 14, Math.PI), mat(item.trim), 0, 0, -0.24);
    prod.rotation.y = Math.PI / 2;
    const string = part(group, new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6), mat(0xe2e8f0), 0, 0, -0.24);
    string.rotation.z = Math.PI / 2;
    string.userData.noOutline = true;
    const bolt = part(group, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), glow(item.trim, 0.7), 0, 0.02, -0.02);
    bolt.rotation.x = Math.PI / 2;
    const tip = part(group, new THREE.ConeGeometry(0.02, 0.07, 6), glow(0xfef08a, 0.85), 0, 0.02, -0.18);
    tip.rotation.x = -Math.PI / 2;
    group.rotation.x = -0.45;
    return { group, whipRig: null };
  }

  if (silhouette === 'bow' || silhouette === 'ancient-bow') {
    group.add(buildBow(item, silhouette === 'ancient-bow'));
    return { group, whipRig: null };
  }

  if (silhouette === 'greataxe') {
    part(group, new THREE.CylinderGeometry(0.035, 0.045, 1.25, 8), mat(0x78350f), 0, 0.28, 0);
    const head = part(group, new THREE.TorusGeometry(0.24, 0.06, 6, 14, Math.PI * 1.45), mat(item.color), 0, 0.92, 0);
    head.rotation.y = Math.PI / 2;
    const edge = part(group, new THREE.TorusGeometry(0.27, 0.018, 5, 14, Math.PI * 1.25), glow(item.trim, 0.35), 0, 0.92, 0);
    edge.rotation.y = Math.PI / 2;
    return { group: aimForward(group, -Math.PI / 2.6), whipRig: null };
  }

  if (silhouette === 'mace') {
    part(group, new THREE.CylinderGeometry(0.03, 0.035, 0.85, 8), mat(0x44403c), 0, 0.2, 0);
    part(group, new THREE.SphereGeometry(0.11, 12, 10), mat(item.color), 0, 0.68, 0);
    for (let i = 0; i < 6; i++) {
      const spike = part(group, new THREE.ConeGeometry(0.03, 0.12, 5), mat(item.trim), 0, 0.68, 0);
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.1, 0.68, Math.sin(angle) * 0.1);
      spike.lookAt(spike.position.x * 2, 0.68, spike.position.z * 2);
    }
    return { group: aimForward(group), whipRig: null };
  }

  if (silhouette === 'wand') {
    part(group, new THREE.CylinderGeometry(0.02, 0.028, 0.55, 8), mat(0x3f3f46), 0, 0.12, 0);
    part(group, new THREE.TorusGeometry(0.04, 0.012, 6, 10), mat(item.trim), 0, 0.36, 0).rotation.x = Math.PI / 2;
    part(group, new THREE.OctahedronGeometry(0.07), glow(item.color, 0.9), 0, 0.48, 0);
    return { group: aimForward(group, -Math.PI / 2.7), whipRig: null };
  }

  if (silhouette === 'staff' || silhouette === 'ancient-staff' || silhouette === 'ahrim-staff') {
    part(group, new THREE.CylinderGeometry(0.04, 0.035, 1.55, 10), mat(item.id === 'ahrim_staff' ? item.color : 0x5c3a21), 0, 0.35, 0);
    if (silhouette === 'ancient-staff') {
      const crest = part(group, new THREE.OctahedronGeometry(0.16), glow(item.color, 0.8), 0, 1.2, 0);
      crest.rotation.z = Math.PI / 4;
      part(group, new THREE.TorusGeometry(0.18, 0.02, 5, 12), mat(item.trim), 0, 1.2, 0);
    } else if (silhouette === 'ahrim-staff') {
      part(group, new THREE.SphereGeometry(0.12, 10, 8), mat(0x1c1917), 0, 1.18, 0);
      [-0.05, 0.05].forEach((x) => part(group, new THREE.SphereGeometry(0.025, 6, 6), glow(item.trim, 0.8), x, 1.22, -0.08));
      part(group, new THREE.ConeGeometry(0.05, 0.12, 5), mat(item.trim), 0, 1.32, 0);
    } else {
      part(group, new THREE.SphereGeometry(0.15, 14, 12), glow(item.color, 0.85), 0, 1.22, 0);
      const halo = part(group, new THREE.TorusGeometry(0.22, 0.018, 6, 14), mat(item.trim), 0, 1.22, 0);
      halo.rotation.x = Math.PI / 2.4;
    }
    return { group: aimForward(group, -Math.PI / 2.8), whipRig: null };
  }

  if (silhouette === 'whip') {
    const rest = [
      new THREE.Vector3(0, 0.02, 0.02),
      new THREE.Vector3(0.07, 0.26, -0.2),
      new THREE.Vector3(-0.09, 0.46, -0.46),
      new THREE.Vector3(0.1, 0.34, -0.76),
      new THREE.Vector3(-0.02, 0.14, -1.05)
    ];
    const tube = part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rest), 22, 0.034, 8, false), mat(0x1c1917, { emissive: item.color, emissiveIntensity: 0.35 }));
    const nodes = rest.map((pt, index) => {
      const hot = index % 2 === 1;
      const node = part(
        group,
        new THREE.SphereGeometry(hot ? 0.055 : 0.04, 8, 6),
        hot ? glow(item.trim || item.color, 0.85) : mat(0x292524),
        pt.x, pt.y, pt.z
      );
      return node;
    });
    return {
      group,
      whipRig: { tube, nodes, rest: rest.map((p) => p.clone()), wasLashing: false }
    };
  }

  const bladeKind = silhouette === 'greatsword' ? 'greatsword' : silhouette === 'sword' ? 'sword' : 'scimitar';
  const blade = buildBlade(item, bladeKind);
  group.add(blade);
  group.userData.silhouette = silhouette;
  return { group, whipRig: null };
}

export function buildShieldVisual(item: ItemDef): THREE.Group {
  const silhouette = gearSilhouette(item);
  const group = tag(new THREE.Group(), item, silhouette);

  if (silhouette === 'defender') {
    part(group, new THREE.CylinderGeometry(0.03, 0.035, 0.42, 8), mat(item.color), 0, 0, 0);
    part(group, new THREE.ConeGeometry(0.05, 0.16, 6), mat(item.trim), 0, 0.28, 0);
    [-0.35, 0.35].forEach((rot) => {
      const spike = part(group, new THREE.ConeGeometry(0.028, 0.12, 5), mat(item.trim), 0, 0.05, 0);
      spike.rotation.z = rot;
    });
    group.rotation.x = -0.9;
    group.scale.setScalar(0.85);
    return group;
  }

  if (silhouette === 'elysian') {
    const shell = part(
      group,
      kiteGeometry(false),
      mat(item.color, { emissive: item.color, emissiveIntensity: 0.45, transparent: true, opacity: 0.72 })
    );
    shell.rotation.y = Math.PI / 2;
    part(group, new THREE.TorusGeometry(0.12, 0.02, 6, 12), glow(item.trim, 0.7), 0.06, 0.05, 0);
    part(group, new THREE.OctahedronGeometry(0.06), glow(item.trim, 0.9), 0.08, 0.05, 0);
    return group;
  }

  const kite = part(group, kiteGeometry(true), mat(item.color));
  kite.rotation.y = Math.PI / 2;
  if (silhouette === 'hylian-shield') {
    part(group, new THREE.TorusGeometry(0.3, 0.025, 5, 16), mat(0xfacc15), 0.05, 0.02, 0);
    part(group, new THREE.ConeGeometry(0.06, 0.16, 6), mat(0xdc2626), 0.07, 0.08, 0).rotation.x = Math.PI;
    [[-0.06, 0.16], [0.06, 0.16], [0, 0.06]].forEach(([x, y]) => {
      part(group, new THREE.ConeGeometry(0.035, 0.07, 3), mat(0xe2e8f0), 0.08, y, x);
    });
    return group;
  }

  part(group, new THREE.SphereGeometry(0.08, 10, 8), mat(item.trim), 0.06, 0.05, 0);
  part(group, new THREE.BoxGeometry(0.04, 0.36, 0.22), mat(item.trim), 0.07, 0.04, 0);
  return group;
}

export function buildAmuletVisual(item: ItemDef): THREE.Group {
  const group = tag(new THREE.Group(), item, 'amulet');
  const chain = part(group, new THREE.TorusGeometry(0.09, 0.012, 6, 16), mat(item.trim || 0xfacc15), 0, LEAN_RIG.neckY - LEAN_RIG.torsoY, -0.02);
  chain.rotation.x = Math.PI / 2.15;
  const gemMat = glow(item.color, 0.55);
  const gemZ = -0.2;
  if (item.id === 'amulet_torture') {
    part(group, new THREE.ConeGeometry(0.04, 0.1, 6), gemMat, 0, 0.26, gemZ);
    part(group, new THREE.ConeGeometry(0.032, 0.08, 5), mat(item.trim), -0.04, 0.28, gemZ + 0.02).rotation.z = 0.6;
    part(group, new THREE.ConeGeometry(0.032, 0.08, 5), mat(item.trim), 0.04, 0.28, gemZ + 0.02).rotation.z = -0.6;
  } else if (item.id === 'necklace_anguish') {
    const pendant = part(group, new THREE.TorusGeometry(0.045, 0.014, 6, 12), gemMat, 0, 0.26, gemZ);
    pendant.rotation.x = Math.PI / 2;
  } else if (item.id === 'occult_necklace') {
    part(group, new THREE.OctahedronGeometry(0.05), gemMat, 0, 0.26, gemZ);
    part(group, new THREE.TorusGeometry(0.065, 0.01, 5, 12), mat(item.trim), 0, 0.26, gemZ);
  } else if (item.id === 'amulet_power') {
    part(group, new THREE.SphereGeometry(0.045, 12, 10), gemMat, 0, 0.26, gemZ);
  } else {
    part(group, new THREE.OctahedronGeometry(item.id === 'amulet_fury' ? 0.06 : 0.048), gemMat, 0, 0.26, gemZ);
  }
  return group;
}

export function buildRingVisual(item: ItemDef): THREE.Group {
  const group = tag(new THREE.Group(), item, 'ring');
  const band = part(group, new THREE.TorusGeometry(0.038, 0.008, 6, 12), mat(item.trim), 0, LEAN_RIG.handY + 0.06, -0.02);
  band.rotation.y = Math.PI / 2;
  part(group, new THREE.OctahedronGeometry(0.02), glow(item.color, 0.85), 0, LEAN_RIG.handY + 0.1, -0.05);
  return group;
}

export function buildBootVisual(item: ItemDef, isLeft: boolean): THREE.Group {
  const silhouette = gearSilhouette(item);
  const group = tag(new THREE.Group(), item, silhouette);
  part(group, new THREE.CylinderGeometry(0.086, 0.09, 0.05, 10), mat(item.trim), 0, -0.68, 0.01);
  if (silhouette === 'pegasian-boots') {
    const wing = part(group, new THREE.SphereGeometry(0.08, 10, 8), mat(0xf8fafc), isLeft ? -0.09 : 0.09, -0.76, 0.01);
    wing.scale.set(0.28, 0.9, 1.1);
    wing.rotation.z = isLeft ? 0.7 : -0.7;
  } else if (silhouette === 'primordial-boots') {
    const spike = part(group, new THREE.ConeGeometry(0.03, 0.12, 6), glow(item.trim, 0.45), isLeft ? -0.08 : 0.08, -0.7, 0.04);
    spike.rotation.z = isLeft ? 0.9 : -0.9;
  } else if (silhouette === 'eternal-boots') {
    part(group, new THREE.OctahedronGeometry(0.04), glow(item.color, 0.8), 0, -0.7, -0.05);
  }
  return group;
}

export function buildGloveVisual(item: ItemDef): THREE.Group {
  const group = tag(new THREE.Group(), item, 'gloves');
  part(group, new THREE.CylinderGeometry(0.068, 0.072, 0.1, 10), mat(item.trim), 0, -0.58, 0);
  part(group, new THREE.TorusGeometry(0.07, 0.01, 5, 10), mat(item.color), 0, -0.52, 0).rotation.x = Math.PI / 2;
  return group;
}

function clothCape(item: ItemDef, lava: boolean): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.46, 1.22, 10, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i);
    const t = (0.61 - v) / 1.22;
    pos.setX(i, u * (0.78 + t * 0.32));
    pos.setZ(i, Math.cos(u * 4) * 0.03 + t * 0.08);
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, mat(item.color, {
    side: THREE.DoubleSide,
    ...(lava ? { emissive: item.color, emissiveIntensity: 0.35 } : {})
  }));
  cloth.castShadow = true;
  group.add(cloth);
  part(group, new THREE.BoxGeometry(0.38, 0.04, 0.03), lava ? glow(item.trim, 0.85) : mat(item.trim), 0, -0.56, 0.05);
  part(group, new THREE.SphereGeometry(0.045, 8, 6), mat(item.trim), 0, 0.56, -0.02);
  if (lava) {
    [-0.18, 0, 0.18].forEach((x) => {
      part(group, new THREE.SphereGeometry(0.035, 6, 6), glow(item.trim, 0.9), x, -0.46, 0.1);
    });
  }
  return group;
}

export function buildCapeVisual(item: ItemDef): THREE.Group {
  const silhouette = gearSilhouette(item);
  const group = tag(new THREE.Group(), item, silhouette);
  if (silhouette === 'ava') {
    part(group, new THREE.BoxGeometry(0.26, 0.36, 0.12), mat(item.color), 0, 0.08, 0.1);
    const quiver = part(group, new THREE.CylinderGeometry(0.07, 0.08, 0.55, 8), mat(item.trim), 0.16, 0.32, 0.12);
    quiver.rotation.z = -0.3;
    part(group, new THREE.ConeGeometry(0.025, 0.16, 5), mat(0xfde68a), 0.2, 0.58, 0.08).rotation.z = -0.3;
    part(group, new THREE.ConeGeometry(0.02, 0.14, 5), mat(item.color), 0.12, 0.55, 0.14).rotation.z = -0.15;
    return group;
  }
  group.add(clothCape(item, silhouette === 'lava-cape'));
  return group;
}
