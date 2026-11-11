import * as THREE from 'three';
import type { GearItemLike } from './wandererGear';

/** Bone-space aim of a held weapon: mostly +Z (forward) and a little -Y (up once the arm hangs). */
export const WEAPON_AIM: readonly [number, number, number] = [0, -0.42, 0.91];

export type HelmSilhouette = 'full' | 'med' | 'coif' | 'wizard' | 'circlet' | 'hood';

export function helmSilhouette(item: GearItemLike & { name?: string }): HelmSilhouette {
  const blob = `${item.id ?? ''} ${item.name ?? ''} ${item.iconKind ?? ''}`.toLowerCase();
  if (/wizard|mystic|ancestral|infinity|pointed/.test(blob) || (item.iconKind === 'hat' && /hat/.test(blob))) return 'wizard';
  if (/circlet/.test(blob)) return 'circlet';
  if (/coif/.test(blob)) return 'coif';
  if (/hood|mask/.test(blob) || item.iconKind === 'hood') return 'hood';
  if (/neitiznot|sallet|med|beaked/.test(blob)) return 'med';
  return 'full';
}

export function shellInflate(item: GearItemLike): number {
  const blob = `${item.id ?? ''} ${item.iconKind ?? ''}`.toLowerCase();
  if (item.slot === 'hands') return 0.014;
  if (item.slot === 'feet') return 0.022;
  if (/robe|tunic|dhide|leather|hood|cloth/.test(blob)) return 0.016;
  if (item.slot === 'legs') return 0.024;
  return 0.028;
}

const REGION: Record<string, (name: string) => boolean> = {
  torso: (name) => /^(spine_01|spine_02|spine_03|clavicle_l|clavicle_r)$/.test(name),
  legs: (name) => /^(thigh_l|thigh_r|calf_l|calf_r)$/.test(name),
  hands: (name) => /hand_|index_|middle_|ring_|pinky_|thumb_/.test(name),
  feet: (name) => /^(foot_l|foot_r|ball_l|ball_r)$/.test(name),
  head: (name) => name === 'Head',
  coif: (name) => name === 'Head' || name === 'neck_01' || /^clavicle_/.test(name)
};

function boneIds(skeleton: THREE.Skeleton, region: string): Set<number> {
  const test = REGION[region];
  const ids = new Set<number>();
  skeleton.bones.forEach((bone, index) => {
    if (test(bone.name)) ids.add(index);
  });
  return ids;
}

function dominant(si: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, sw: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, vertex: number): number {
  const weights = [sw.getX(vertex), sw.getY(vertex), sw.getZ(vertex), sw.getW(vertex)];
  const ids = [si.getX(vertex), si.getY(vertex), si.getZ(vertex), si.getW(vertex)];
  let best = ids[0];
  let weight = -1;
  for (let k = 0; k < 4; k++) {
    if (weights[k] > weight) {
      weight = weights[k];
      best = ids[k];
    }
  }
  return best;
}

interface Stamp {
  pos: number[];
  nrm: number[];
  idx: number[];
  wgt: number[];
}

function pushVert(out: Stamp, x: number, y: number, z: number, nx: number, ny: number, nz: number, bone: number): void {
  out.pos.push(x, y, z);
  out.nrm.push(nx, ny, nz);
  out.idx.push(bone, 0, 0, 0);
  out.wgt.push(1, 0, 0, 0);
}

function stampGeometry(geo: THREE.BufferGeometry, bone: number, out: Stamp): void {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position;
  const nrm = src.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pushVert(out, pos.getX(i), pos.getY(i), pos.getZ(i), nrm ? nrm.getX(i) : 0, nrm ? nrm.getY(i) : 1, nrm ? nrm.getZ(i) : 0, bone);
  }
  if (src !== geo) src.dispose();
}

function toGeometry(out: Stamp): THREE.BufferGeometry | null {
  if (out.pos.length < 9) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.wgt, 4));
  return geo;
}

export interface ShellResult {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * A copy of the body region, pushed out along its normals, wearing the same skin weights
 * so it rides the skeleton in every clip.
 */
export function buildRegionShell(
  source: THREE.SkinnedMesh,
  region: string,
  inflate: number,
  face: 'all' | 'open' = 'all'
): ShellResult | null {
  const geo = source.geometry;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  if (!pos || !nrm || !si || !sw) return null;
  const ids = boneIds(source.skeleton, region);
  if (!ids.size) return null;
  const index = geo.index;
  const tris = index ? index.count / 3 : pos.count / 3;
  const at = (tri: number, corner: number) => (index ? index.getX(tri * 3 + corner) : tri * 3 + corner);
  const keep = (vertex: number) => ids.has(dominant(si, sw, vertex));
  let yMax = -Infinity;
  for (let i = 0; i < pos.count; i++) if (keep(i)) yMax = Math.max(yMax, pos.getY(i));
  const crown = yMax - 0.05;
  const out: Stamp = { pos: [], nrm: [], idx: [], wgt: [] };
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const centroid = new THREE.Vector3();
  let count = 0;
  for (let t = 0; t < tris; t++) {
    const a = at(t, 0);
    const b = at(t, 1);
    const c = at(t, 2);
    if (!keep(a) || !keep(b) || !keep(c)) continue;
    const verts = [a, b, c];
    if (face === 'open') {
      let z = 0;
      let y = 0;
      for (const v of verts) {
        z += nrm.getZ(v);
        y += pos.getY(v);
      }
      if (z / 3 > 0.45 && y / 3 < crown) continue;
    }
    for (const v of verts) {
      const nx = nrm.getX(v);
      const ny = nrm.getY(v);
      const nz = nrm.getZ(v);
      const x = pos.getX(v) + nx * inflate;
      const y = pos.getY(v) + ny * inflate;
      const z = pos.getZ(v) + nz * inflate;
      const bone = dominant(si, sw, v);
      const weights = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)];
      const bones = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)];
      out.pos.push(x, y, z);
      out.nrm.push(nx, ny, nz);
      out.idx.push(bones[0], bones[1], bones[2], bones[3]);
      out.wgt.push(weights[0], weights[1], weights[2], weights[3]);
      min.min(new THREE.Vector3(x, y, z));
      max.max(new THREE.Vector3(x, y, z));
      centroid.add(new THREE.Vector3(x, y, z));
      count++;
    }
  }
  if (!count) return null;
  centroid.multiplyScalar(1 / count);
  return { geometry: toGeometry(out) as THREE.BufferGeometry, centroid, min, max };
}

export function appendDetail(shell: THREE.BufferGeometry, extra: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const out: Stamp = { pos: [], nrm: [], idx: [], wgt: [] };
  const base = shell.index ? shell.toNonIndexed() : shell;
  const pos = base.attributes.position;
  const nrm = base.attributes.normal;
  const si = base.attributes.skinIndex;
  const sw = base.attributes.skinWeight;
  for (let i = 0; i < pos.count; i++) {
    out.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    out.nrm.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    out.idx.push(si.getX(i), si.getY(i), si.getZ(i), si.getW(i));
    out.wgt.push(sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i));
  }
  stampGeometry(extra, bone, out);
  if (base !== shell) base.dispose();
  shell.dispose();
  extra.dispose();
  return toGeometry(out) as THREE.BufferGeometry;
}

export function boneByName(skeleton: THREE.Skeleton, name: string): number {
  const index = skeleton.bones.findIndex((bone) => bone.name === name);
  return index < 0 ? 0 : index;
}

/** Pull the covered skin in so the shell outside it does not z-fight or poke through. */
export function underlayRegion(mesh: THREE.SkinnedMesh, region: string, amount: number): void {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  if (!pos || !nrm || !si || !sw) return;
  const saved = geo.userData.oilBind as Float32Array | undefined;
  if (!saved) {
    const copy = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) copy.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
    geo.userData.oilBind = copy;
  }
  const ids = boneIds(mesh.skeleton, region);
  for (let i = 0; i < pos.count; i++) {
    if (!ids.has(dominant(si, sw, i))) continue;
    pos.setXYZ(i, pos.getX(i) - nrm.getX(i) * amount, pos.getY(i) - nrm.getY(i) * amount, pos.getZ(i) - nrm.getZ(i) * amount);
  }
  pos.needsUpdate = true;
}

export function restoreUnderlay(mesh: THREE.SkinnedMesh): void {
  const saved = mesh.geometry.userData.oilBind as Float32Array | undefined;
  if (!saved) return;
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, saved[i * 3], saved[i * 3 + 1], saved[i * 3 + 2]);
  pos.needsUpdate = true;
}
