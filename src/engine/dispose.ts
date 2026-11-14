import * as THREE from 'three';
import { isSharedOutlineMaterial } from './materials';

export function disposeObject3D(
  root: THREE.Object3D,
  keep?: (m: THREE.Material) => boolean
): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          materials.add(m);
        }
      } else {
        materials.add(mesh.material);
      }
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }

  for (const material of materials) {
    if (isSharedOutlineMaterial(material)) continue;
    if (keep && keep(material)) continue;
    material.dispose();
  }

  if (root.parent) {
    root.parent.remove(root);
  }
}
