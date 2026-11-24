import * as THREE from 'three';
import { G } from './context';
import { KIT_PIECES, type KitPieceId, type QualityTier } from '../data/look';
import { WOODS_TREES } from '../data/woodsTrees';
import { buildScatter, type ScatterResult } from '../state/scatter';
import { getTerrainHeight } from '../state/terrain';
import { facetMaterial } from './materials';
import { buildKitPiece, makeRng } from './floraKit';

export const FLORA_SEED = 20261114;

const ALL_PIECES: KitPieceId[] = [
  'boulder_s',
  'boulder_m',
  'boulder_l',
  'bush_a',
  'bush_b',
  'fern',
  'reed',
  'log',
  'snag',
  'sapling',
  'mushrooms',
  'backdrop_tree_a',
  'backdrop_tree_b',
  'crag_a',
  'crag_b',
];

let floraMeshes: THREE.InstancedMesh[] = [];
let woodsTreeMeshes: [THREE.InstancedMesh, THREE.InstancedMesh] | null = null;

export function getFloraMeshes(): THREE.InstancedMesh[] {
  return floraMeshes;
}

export function getWoodsTreeMeshes(): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
  return woodsTreeMeshes;
}

export function clearFlora(): void {
  for (const mesh of floraMeshes) {
    if (G.scene) G.scene.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  floraMeshes = [];
  woodsTreeMeshes = null;
}

export function buildFlora(tier: QualityTier): THREE.InstancedMesh[] {
  clearFlora();

  const dummy = new THREE.Object3D();
  const scatterResult: ScatterResult = buildScatter(FLORA_SEED, tier);

  for (let pIdx = 0; pIdx < ALL_PIECES.length; pIdx++) {
    const id = ALL_PIECES[pIdx];
    const instances = scatterResult[id];
    if (!instances || instances.length === 0) continue;

    const geoRng = makeRng(FLORA_SEED + pIdx);
    const geo = buildKitPiece(id, geoRng);
    const mat = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
    const count = instances.length;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = KIT_PIECES[id].castShadow;
    mesh.receiveShadow = true;
    mesh.userData = { kitPieceId: id };

    for (let i = 0; i < count; i++) {
      const inst = instances[i];
      const y = getTerrainHeight(inst.x, inst.z);
      dummy.position.set(inst.x, y, inst.z);
      dummy.rotation.set(0, inst.rot, 0);
      dummy.scale.set(inst.scale, inst.scale, inst.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (G.scene) G.scene.add(mesh);
    floraMeshes.push(mesh);
  }

  // Woods trees: built on every tier and never thinned, because they are walkability, not decoration.
  const rowsA: Array<{ x: number; y: number; z: number; rotY: number; scale: number }> = [];
  const rowsB: Array<{ x: number; y: number; z: number; rotY: number; scale: number }> = [];

  for (let idx = 0; idx < WOODS_TREES.length; idx++) {
    const [i, j] = WOODS_TREES[idx];
    const x = -118 + i + 0.5;
    const z = -118 + j + 0.5;
    const y = getTerrainHeight(x, z);

    // Variant, small rotation and scale chosen deterministically from cell indices
    const isB = ((i * 7 + j * 13) & 1) === 1;
    const rotY = ((i * 37 + j * 73) % 628) / 100;
    const scale = 0.92 + (((i * 17 + j * 29) % 100) / 100) * 0.16;

    if (isB) {
      rowsB.push({ x, y, z, rotY, scale });
    } else {
      rowsA.push({ x, y, z, rotY, scale });
    }
  }

  const geoA = buildKitPiece('woods_tree_a', makeRng(FLORA_SEED + 101));
  const matA = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
  const meshA = new THREE.InstancedMesh(geoA, matA, rowsA.length);
  meshA.castShadow = true;
  meshA.receiveShadow = true;
  meshA.userData = { kitPieceId: 'woods_tree_a', isWoodsTree: true };
  for (let k = 0; k < rowsA.length; k++) {
    const r = rowsA[k];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.scale, r.scale, r.scale);
    dummy.updateMatrix();
    meshA.setMatrixAt(k, dummy.matrix);
  }
  meshA.instanceMatrix.needsUpdate = true;
  if (G.scene) G.scene.add(meshA);
  floraMeshes.push(meshA);

  const geoB = buildKitPiece('woods_tree_b', makeRng(FLORA_SEED + 102));
  const matB = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
  const meshB = new THREE.InstancedMesh(geoB, matB, rowsB.length);
  meshB.castShadow = true;
  meshB.receiveShadow = true;
  meshB.userData = { kitPieceId: 'woods_tree_b', isWoodsTree: true };
  for (let k = 0; k < rowsB.length; k++) {
    const r = rowsB[k];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.scale, r.scale, r.scale);
    dummy.updateMatrix();
    meshB.setMatrixAt(k, dummy.matrix);
  }
  meshB.instanceMatrix.needsUpdate = true;
  if (G.scene) G.scene.add(meshB);
  floraMeshes.push(meshB);

  woodsTreeMeshes = [meshA, meshB];

  return floraMeshes;
}
