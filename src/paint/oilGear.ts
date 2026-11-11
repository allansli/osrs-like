import * as THREE from 'three';
import { solidMaterial } from './body';
import { GEAR_DAB_SIZE, gearJitter, paletteForGear, strokeForGear, type GearItemLike } from './wandererGear';

/**
 * Blade runs toward -Y in the hand. On this rig the hand's local -Y points back up the
 * forearm, which is up and slightly forward once the arm hangs, so the weapon is held
 * rather than left dangling at the fingers.
 */
export const SCIMITAR_CURVE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0.04, -0.26, 0.07],
  [0.09, -0.52, 0.12],
  [0.14, -0.76, 0.06]
];

export const BOW_CURVE: readonly (readonly [number, number, number])[] = [
  [0, -0.7, 0.1],
  [0.08, -0.35, 0.02],
  [0.1, 0, 0],
  [0.08, 0.35, 0.02],
  [0, 0.7, 0.1]
];

export interface HeldPiece {
  bone: string;
  mesh: THREE.Mesh;
}

export interface OilKit {
  head?: GearItemLike | null;
  cape?: GearItemLike | null;
  neck?: GearItemLike | null;
  body?: GearItemLike | null;
  legs?: GearItemLike | null;
  hands?: GearItemLike | null;
  feet?: GearItemLike | null;
  weapon?: GearItemLike | null;
  shield?: GearItemLike | null;
}

function helmGeometry(kind: string): THREE.BufferGeometry {
  if (kind === 'wizard-hat' || kind === 'infinity-hat') {
    const brim = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16);
    const cone = new THREE.ConeGeometry(0.1, 0.38, 12);
    cone.translate(0, 0.22, 0);
    return merge(brim, cone);
  }
  if (kind === 'hood' || kind === 'sheikah-mask') {
    const cowl = new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
    cowl.translate(0, 0.08, 0.02);
    return cowl;
  }
  const dome = new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  dome.translate(0, 0.08, 0.02);
  return dome;
}

function breastplate(): THREE.BufferGeometry {
  const plate = new THREE.BoxGeometry(0.4, 0.36, 0.08);
  plate.translate(0, 0.04, 0.14);
  const ridge = new THREE.BoxGeometry(0.05, 0.3, 0.03);
  ridge.translate(0, 0.04, 0.19);
  return merge(plate, ridge);
}

function capeSheet(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.48, 0.85, 1, 4);
  geo.translate(0, -0.28, -0.12);
  geo.computeVertexNormals();
  return geo;
}

function leg(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.1, 0.075, 0.42, 10);
  geo.translate(0, 0.22, 0.02);
  geo.computeVertexNormals();
  return geo;
}

function boot(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(0.13, 0.14, 0.22);
  geo.translate(0, 0.06, 0.05);
  geo.computeVertexNormals();
  return geo;
}

function gauntlet(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(0.1, 0.12, 0.09);
  geo.translate(0, 0.07, 0.01);
  geo.computeVertexNormals();
  return geo;
}

function amulet(): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(0.08, 0.012, 6, 14);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.02, 0.06);
  const gem = new THREE.OctahedronGeometry(0.03);
  gem.translate(0, -0.06, 0.1);
  return merge(geo, gem);
}

function kiteShield(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.32);
  shape.lineTo(0.2, -0.06);
  shape.lineTo(0.16, 0.22);
  shape.lineTo(0, 0.34);
  shape.lineTo(-0.16, 0.22);
  shape.lineTo(-0.2, -0.06);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  geo.translate(0, 0.08, 0.12);
  geo.computeVertexNormals();
  return geo;
}

function scimitarGeo(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(SCIMITAR_CURVE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const blade = new THREE.TubeGeometry(curve, 10, 0.018, 5, false);
  const grip = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8);
  grip.translate(0, 0.06, 0);
  const guard = new THREE.BoxGeometry(0.16, 0.02, 0.03);
  guard.translate(0, -0.02, 0.02);
  return merge(blade, grip, guard);
}

function bowGeo(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(BOW_CURVE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const stave = new THREE.TubeGeometry(curve, 12, 0.016, 5, false);
  const string = new THREE.CylinderGeometry(0.004, 0.004, 1.2, 4);
  string.translate(0, 0, 0.08);
  return merge(stave, string);
}

function staffGeo(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.02, 0.025, 1.45, 8);
  geo.translate(0, 0.15, 0);
  const head = new THREE.SphereGeometry(0.06, 10, 8);
  head.translate(0, 0.9, 0);
  return merge(geo, head);
}

function merge(...geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  let count = 0;
  for (const geo of geos) count += geo.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  let o = 0;
  for (const geo of geos) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (o + i) * 3);
      if (n) nrm.set([n.getX(i), n.getY(i), n.getZ(i)], (o + i) * 3);
    }
    o += p.count;
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}

function paintHeld(geo: THREE.BufferGeometry, item: GearItemLike, shared: object, name: string, bone: string): HeldPiece {
  const palette = paletteForGear(item);
  const mesh = new THREE.Mesh(geo, solidMaterial(shared, palette, false));
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.userData.gear = true;
  mesh.userData.paint_palette = palette;
  mesh.userData.stroke_dir = strokeForGear(item);
  mesh.userData.dab_size = GEAR_DAB_SIZE;
  mesh.userData.jitter = gearJitter(palette);
  mesh.userData.paintClass = 'gear';
  return { bone, mesh };
}

function kindOf(item: GearItemLike | null | undefined): string {
  const id = `${item?.id ?? ''} ${item?.iconKind ?? ''}`.toLowerCase();
  if (/bow/.test(id)) return 'bow';
  if (/staff|wand/.test(id)) return 'staff';
  if (/whip/.test(id)) return 'whip';
  if (/crossbow|blowpipe/.test(id)) return 'bow';
  if (/hat|hood/.test(id)) return /hood/.test(id) ? 'hood' : 'wizard-hat';
  return 'plate';
}

export interface OilGearBuild {
  root: THREE.Group;
  held: HeldPiece[];
}

/** Rigid pieces on the bone that owns them. One bone keeps a plate from tearing. */
export function createOilGear(_body: THREE.SkinnedMesh, kit: OilKit, shared: object): OilGearBuild {
  const root = new THREE.Group();
  root.name = 'oil-gear';
  const held: HeldPiece[] = [];
  const add = (geo: THREE.BufferGeometry | null, item: GearItemLike | null | undefined, name: string, bone: string) => {
    if (!geo || !item) return;
    held.push(paintHeld(geo, item, shared, name, bone));
  };
  add(kit.head ? helmGeometry(kindOf(kit.head)) : null, kit.head, 'helm', 'Head');
  add(kit.cape ? capeSheet() : null, kit.cape, 'cape', 'spine_03');
  add(kit.neck ? amulet() : null, kit.neck, 'amulet', 'neck_01');
  add(kit.body ? breastplate() : null, kit.body, 'breastplate', 'spine_02');
  if (kit.legs) {
    add(leg(), kit.legs, 'plateleg-l', 'thigh_l');
    add(leg(), kit.legs, 'plateleg-r', 'thigh_r');
  }
  if (kit.hands) {
    add(gauntlet(), kit.hands, 'gauntlet-l', 'hand_l');
    add(gauntlet(), kit.hands, 'gauntlet-r', 'hand_r');
  }
  if (kit.feet) {
    add(boot(), kit.feet, 'boot-l', 'foot_l');
    add(boot(), kit.feet, 'boot-r', 'foot_r');
  }
  if (kit.shield) add(kiteShield(), kit.shield, 'shield', 'lowerarm_l');
  if (kit.weapon) {
    const kind = kindOf(kit.weapon);
    const geo = kind === 'bow' ? bowGeo() : kind === 'staff' ? staffGeo() : scimitarGeo();
    add(geo, kit.weapon, 'weapon', 'hand_r');
  }
  return { root, held };
}
