import * as THREE from 'three';
import { solidMaterial } from './body';
import { appendDetail, boneByName, buildRegionShell, helmSilhouette, shellInflate, WEAPON_AIM, type HelmSilhouette } from './shells';
import { GEAR_DAB_SIZE, gearJitter, paletteForGear, strokeForGear, type GearItemLike } from './wandererGear';

export { helmSilhouette, WEAPON_AIM } from './shells';

/**
 * Blade runs along mesh +Y. The mesh is then turned so +Y lies on WEAPON_AIM:
 * mostly forward (+Z) and a little up the wrist (-Y), which is up once the arm hangs.
 * The handle stays at the origin, planted in the palm.
 */
export const SCIMITAR_CURVE: readonly (readonly [number, number, number])[] = [
  [0, 0.12, 0],
  [0.02, 0.32, 0.02],
  [0.07, 0.52, 0.01],
  [0.12, 0.74, -0.02]
];

export interface HeldPiece {
  bone: string;
  mesh: THREE.Mesh;
}

export interface OilKit {
  head?: GearItemLike | null;
  neck?: GearItemLike | null;
  body?: GearItemLike | null;
  legs?: GearItemLike | null;
  hands?: GearItemLike | null;
  feet?: GearItemLike | null;
  weapon?: GearItemLike | null;
  shield?: GearItemLike | null;
}

export interface OilSources {
  skin: THREE.SkinnedMesh;
  suit: THREE.SkinnedMesh;
  shoes: THREE.SkinnedMesh | null;
}

export interface OilGearBuild {
  root: THREE.Group;
  skinned: THREE.SkinnedMesh[];
  held: HeldPiece[];
}

function kindOf(item: GearItemLike | null | undefined): string {
  const id = `${item?.id ?? ''} ${item?.iconKind ?? ''}`.toLowerCase();
  if (/bow|crossbow|blowpipe/.test(id)) return 'bow';
  if (/staff|wand/.test(id)) return 'staff';
  if (/whip/.test(id)) return 'whip';
  if (/axe/.test(id)) return 'axe';
  if (/mace/.test(id)) return 'mace';
  if (/greatsword|godsword|longsword|sword/.test(id)) return 'sword';
  return 'scimitar';
}

function merge(...geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  const parts = geos.map((geo) => (geo.index ? geo.toNonIndexed() : geo));
  for (const geo of parts) count += geo.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  let offset = 0;
  for (const geo of parts) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (offset + i) * 3);
      if (n) nrm.set([n.getX(i), n.getY(i), n.getZ(i)], (offset + i) * 3);
    }
    offset += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.computeVertexNormals();
  return out;
}

function bladeSlab(width: number, length: number, curve = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.15, 0);
  shape.lineTo(width * 0.55, length * 0.15);
  shape.lineTo(width * 0.35 + curve, length);
  shape.lineTo(-width * 0.15, length * 0.92);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false });
  geo.translate(0, 0.12, -0.022);
  return geo;
}

function gripAndGuard(): THREE.BufferGeometry[] {
  const grip = new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8);
  grip.translate(0, 0.05, 0);
  const guard = new THREE.BoxGeometry(0.18, 0.018, 0.04);
  guard.translate(0, 0.12, 0);
  const pommel = new THREE.SphereGeometry(0.028, 8, 6);
  pommel.translate(0, -0.02, 0);
  return [grip, guard, pommel];
}

function weaponGeometry(kind: string): THREE.BufferGeometry {
  if (kind === 'bow') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, 0.02),
      new THREE.Vector3(0.06, 0.28, 0),
      new THREE.Vector3(0.07, 0.5, -0.01),
      new THREE.Vector3(0.04, 0.72, 0.01),
      new THREE.Vector3(0, 0.92, 0.03)
    ]);
    const stave = new THREE.TubeGeometry(curve, 14, 0.028, 7, false);
    const string = new THREE.CylinderGeometry(0.006, 0.006, 0.84, 5);
    string.translate(0, 0.48, 0.03);
    const grip = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8);
    grip.translate(0, 0.46, 0);
    return merge(stave, string, grip);
  }
  if (kind === 'staff') {
    const shaft = new THREE.CylinderGeometry(0.032, 0.038, 1.45, 10);
    shaft.translate(0, 0.55, 0);
    const head = new THREE.SphereGeometry(0.07, 12, 10);
    head.translate(0, 1.32, 0);
    const collar = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8);
    collar.translate(0, 1.18, 0);
    return merge(shaft, head, collar);
  }
  if (kind === 'axe') {
    const haft = new THREE.CylinderGeometry(0.028, 0.032, 0.7, 8);
    haft.translate(0, 0.4, 0);
    const head = new THREE.BoxGeometry(0.16, 0.12, 0.04);
    head.translate(0.06, 0.72, 0);
    return merge(haft, head, ...gripAndGuard());
  }
  if (kind === 'mace') {
    const haft = new THREE.CylinderGeometry(0.026, 0.03, 0.55, 8);
    haft.translate(0, 0.34, 0);
    const head = new THREE.SphereGeometry(0.07, 10, 8);
    head.translate(0, 0.66, 0);
    const flange = new THREE.BoxGeometry(0.14, 0.04, 0.04);
    flange.translate(0, 0.66, 0);
    return merge(haft, head, flange, ...gripAndGuard());
  }
  if (kind === 'whip') {
    const curve = new THREE.CatmullRomCurve3(SCIMITAR_CURVE.map(([x, y, z]) => new THREE.Vector3(x * 0.4, y, z)));
    return new THREE.TubeGeometry(curve, 12, 0.022, 6, false);
  }
  const length = kind === 'sword' ? 0.82 : 0.72;
  const width = kind === 'sword' ? 0.09 : 0.11;
  const curve = kind === 'scimitar' ? 0.1 : 0;
  return merge(bladeSlab(width, length, curve), ...gripAndGuard());
}

function kiteShield(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.34);
  shape.lineTo(0.22, -0.08);
  shape.lineTo(0.18, 0.22);
  shape.lineTo(0, 0.36);
  shape.lineTo(-0.18, 0.22);
  shape.lineTo(-0.22, -0.08);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1 });
  // Face normal was +Z. Turn it to -X, which is outward from the left forearm once the arm hangs.
  geo.rotateY(-Math.PI / 2);
  geo.translate(-0.1, 0.16, 0.02);
  geo.computeVertexNormals();
  return geo;
}

function aimHeld(mesh: THREE.Mesh, kind: string): void {
  const aim = kind === 'bow' || kind === 'staff'
    ? new THREE.Vector3(0, -0.82, 0.42)
    : new THREE.Vector3(...WEAPON_AIM);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim.normalize());
  // Palm of hand_r faces local -X. Sit the handle in the closed fist, not along the forearm.
  mesh.position.set(-0.02, 0.08, 0.012);
}

function paintHeld(geo: THREE.BufferGeometry, item: GearItemLike, shared: object, name: string, bone: string): HeldPiece {
  const palette = paletteForGear(item);
  const mesh = new THREE.Mesh(geo, solidMaterial(shared, palette, false));
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.layers.enable(1);
  mesh.userData.gear = true;
  mesh.userData.paint_palette = palette;
  mesh.userData.stroke_dir = strokeForGear(item);
  mesh.userData.dab_size = [0.045, 0.1];
  mesh.userData.dabCount = 180;
  mesh.userData.jitter = gearJitter(palette);
  mesh.userData.paintClass = 'gear';
  return { bone, mesh };
}

function paintShell(geo: THREE.BufferGeometry, source: THREE.SkinnedMesh, item: GearItemLike, shared: object, name: string): THREE.SkinnedMesh {
  const palette = paletteForGear(item);
  const material = solidMaterial(shared, palette, true).clone();
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1.5;
  material.polygonOffsetUnits = -1.5;
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.layers.enable(1);
  mesh.userData.gear = true;
  mesh.userData.paint_palette = palette;
  mesh.userData.stroke_dir = strokeForGear(item);
  mesh.userData.dab_size = GEAR_DAB_SIZE;
  mesh.userData.dabCount = 140;
  mesh.userData.jitter = gearJitter(palette);
  mesh.userData.paintClass = 'gear';
  mesh.bind(source.skeleton, source.bindMatrix);
  return mesh;
}

function plateDetails(source: THREE.SkinnedMesh, shell: THREE.BufferGeometry, slot: string): THREE.BufferGeometry {
  const spine = boneByName(source.skeleton, 'spine_02');
  const left = boneByName(source.skeleton, 'clavicle_l');
  const right = boneByName(source.skeleton, 'clavicle_r');
  let geo = shell;
  if (slot === 'body') {
    const ridge = new THREE.BoxGeometry(0.045, 0.32, 0.025);
    ridge.translate(0, 1.32, 0.2);
    const belt = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14);
    belt.translate(0, 1.05, 0.02);
    const pauldronL = new THREE.SphereGeometry(0.09, 10, 8);
    pauldronL.scale(1.3, 0.7, 1.1);
    pauldronL.translate(0.2, 1.48, 0.02);
    const pauldronR = pauldronL.clone();
    pauldronR.translate(-0.4, 0, 0);
    geo = appendDetail(geo, ridge, spine);
    geo = appendDetail(geo, belt, boneByName(source.skeleton, 'spine_01'));
    geo = appendDetail(geo, pauldronL, left);
    geo = appendDetail(geo, pauldronR, right);
  } else if (slot === 'legs') {
    const tassetL = new THREE.BoxGeometry(0.12, 0.16, 0.03);
    tassetL.translate(0.12, 0.92, 0.12);
    const tassetR = new THREE.BoxGeometry(0.12, 0.16, 0.03);
    tassetR.translate(-0.12, 0.92, 0.12);
    geo = appendDetail(geo, tassetL, boneByName(source.skeleton, 'thigh_l'));
    geo = appendDetail(geo, tassetR, boneByName(source.skeleton, 'thigh_r'));
  }
  return geo;
}

function helmGeometry(source: THREE.SkinnedMesh, item: GearItemLike): THREE.BufferGeometry | null {
  const kind: HelmSilhouette = helmSilhouette(item);
  const head = boneByName(source.skeleton, 'Head');
  if (kind === 'wizard') {
    const brim = new THREE.CylinderGeometry(0.22, 0.22, 0.025, 18);
    brim.translate(0, 1.72, 0.02);
    const cone = new THREE.ConeGeometry(0.11, 0.42, 14);
    cone.translate(0, 1.96, 0.02);
    const band = new THREE.TorusGeometry(0.1, 0.018, 6, 16);
    band.rotateX(Math.PI / 2);
    band.translate(0, 1.78, 0.02);
    const geo = merge(brim, cone, band);
    return weightAll(geo, head);
  }
  if (kind === 'circlet') {
    const ring = new THREE.TorusGeometry(0.11, 0.016, 6, 18);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 1.78, 0.03);
    const gem = new THREE.OctahedronGeometry(0.025);
    gem.translate(0, 1.78, 0.14);
    return weightAll(merge(ring, gem), head);
  }
  const region = kind === 'coif' || kind === 'hood' ? 'coif' : 'head';
  const built = buildRegionShell(source, region, kind === 'coif' || kind === 'hood' ? 0.016 : 0.02, 'open');
  if (!built) return null;
  let geo = built.geometry;
  const c = built.centroid;
  if (kind === 'full') {
    const brow = new THREE.BoxGeometry(0.16, 0.055, 0.04);
    brow.translate(c.x, c.y + 0.045, built.max.z + 0.01);
    const jaw = new THREE.BoxGeometry(0.15, 0.07, 0.045);
    jaw.translate(c.x, c.y - 0.07, built.max.z);
    const crest = new THREE.BoxGeometry(0.025, 0.07, 0.16);
    crest.translate(c.x, built.max.y + 0.02, c.z);
    geo = appendDetail(geo, brow, head);
    geo = appendDetail(geo, jaw, head);
    geo = appendDetail(geo, crest, head);
  } else if (kind === 'med') {
    const nasal = new THREE.BoxGeometry(0.02, 0.09, 0.03);
    nasal.translate(c.x, c.y - 0.02, built.max.z + 0.005);
    const rim = new THREE.TorusGeometry(0.12, 0.016, 6, 16);
    rim.rotateX(Math.PI / 2);
    rim.translate(c.x, c.y + 0.02, c.z);
    geo = appendDetail(geo, nasal, head);
    geo = appendDetail(geo, rim, head);
  }
  return geo;
}

function weightAll(geo: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const count = src.attributes.position.count;
  const idx = new Uint16Array(count * 4);
  const wgt = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    idx[i * 4] = bone;
    wgt[i * 4] = 1;
  }
  src.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  src.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wgt, 4));
  if (!src.attributes.normal) src.computeVertexNormals();
  return src;
}

/** Skinned shells outside the body, plus solid weapons and a shield. The cloak is not replaced. */
export function createOilGear(sources: OilSources, kit: OilKit, shared: object): OilGearBuild {
  const root = new THREE.Group();
  root.name = 'oil-gear';
  const skinned: THREE.SkinnedMesh[] = [];
  const held: HeldPiece[] = [];
  const addShell = (source: THREE.SkinnedMesh | null, region: string, item: GearItemLike | null | undefined, name: string, details = false) => {
    if (!source || !item) return;
    const built = buildRegionShell(source, region, shellInflate(item));
    if (!built) return;
    const geo = details && shellInflate(item) >= 0.022 ? plateDetails(source, built.geometry, item.slot ?? '') : built.geometry;
    skinned.push(paintShell(geo, source, item, shared, name));
  };
  addShell(sources.suit, 'torso', kit.body, 'breastplate', true);
  addShell(sources.suit, 'legs', kit.legs, 'platelegs', true);
  addShell(sources.skin, 'hands', kit.hands, 'gauntlets');
  addShell(sources.shoes, 'feet', kit.feet, 'boots');
  if (kit.head) {
    const geo = helmGeometry(sources.skin, kit.head);
    if (geo) skinned.push(paintShell(geo, sources.skin, kit.head, shared, `helm-${helmSilhouette(kit.head)}`));
  }
  if (kit.neck) {
    const ring = new THREE.TorusGeometry(0.08, 0.012, 6, 14);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 1.5, 0.06);
    const geo = weightAll(ring, boneByName(sources.skin.skeleton, 'neck_01'));
    skinned.push(paintShell(geo, sources.skin, kit.neck, shared, 'amulet'));
  }
  if (kit.shield) held.push(paintHeld(kiteShield(), kit.shield, shared, 'shield', 'lowerarm_l'));
  if (kit.weapon) {
    const kind = kindOf(kit.weapon);
    const piece = paintHeld(weaponGeometry(kind), kit.weapon, shared, 'weapon', 'hand_r');
    aimHeld(piece.mesh, kind);
    held.push(piece);
  }
  return { root, skinned, held };
}
