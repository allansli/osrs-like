import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function materialKey(mat: THREE.Material): string {
  const m = mat as THREE.MeshLambertMaterial;
  const color = m.color && typeof m.color.getHex === 'function' ? m.color.getHex().toString(16) : '0';
  const albedoId = (mat.userData?.albedoId as string) || '';
  const emissive = m.emissive && typeof m.emissive.getHex === 'function' ? m.emissive.getHex().toString(16) : '0';
  const emissiveIntensity = m.emissiveIntensity !== undefined ? m.emissiveIntensity : 1;
  const shade = mat.userData?.shade ?? (m.defines?.FACET_CUT !== undefined ? 'cut' : (m.defines?.FACET_BLEND !== undefined ? 'blend' : (m.flatShading ? 'cut' : 'round')));
  const side = mat.side !== undefined ? mat.side : THREE.FrontSide;
  return `${color}|${albedoId}|${emissive}:${emissiveIntensity}|${shade}|${side}`;
}

interface GroupEntry {
  key: string;
  firstMaterial: THREE.Material;
  geometries: THREE.BufferGeometry[];
  materialsToDispose: THREE.Material[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export function mergeByMaterial(group: THREE.Group): THREE.Group {
  const toMerge: THREE.Mesh[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData?.noOutline || mesh.userData?.isCollider) return;
    toMerge.push(mesh);
  });

  if (toMerge.length === 0) return group;

  group.updateMatrixWorld(true);
  const groupInv = group.matrixWorld.clone().invert();

  const groups = new Map<string, GroupEntry>();

  for (const mesh of toMerge) {
    const relMatrix = groupInv.clone().multiply(mesh.matrixWorld);
    const isNegativeDet = relMatrix.determinant() < 0;

    const geom = mesh.geometry.clone();

    if (!geom.getAttribute('position')) {
      geom.dispose();
      continue;
    }

    if (!geom.getAttribute('normal')) {
      geom.computeVertexNormals();
    }

    if (!geom.getAttribute('uv')) {
      const posCount = geom.getAttribute('position').count;
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2));
    }

    for (const attrName of Object.keys(geom.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        geom.deleteAttribute(attrName);
      }
    }

    if (!geom.index) {
      const count = geom.getAttribute('position').count;
      const indices = count <= 65535 ? new Uint16Array(count) : new Uint32Array(count);
      for (let i = 0; i < count; i++) indices[i] = i;
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    geom.applyMatrix4(relMatrix);

    if (isNegativeDet && geom.index) {
      const idx = geom.index;
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);
        idx.setX(i + 1, c);
        idx.setX(i + 2, b);
      }
      idx.needsUpdate = true;
    }

    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const key = materialKey(origMat);
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        key,
        firstMaterial: origMat,
        geometries: [],
        materialsToDispose: [],
        castShadow: false,
        receiveShadow: false
      };
      groups.set(key, entry);
    } else {
      if (origMat !== entry.firstMaterial && !entry.materialsToDispose.includes(origMat)) {
        entry.materialsToDispose.push(origMat);
      }
    }

    if (mesh.castShadow) entry.castShadow = true;
    if (mesh.receiveShadow) entry.receiveShadow = true;
    entry.geometries.push(geom);
  }

  const newMeshes: THREE.Mesh[] = [];
  for (const entry of groups.values()) {
    const mergedGeom = mergeGeometries(entry.geometries, false);
    for (const g of entry.geometries) {
      g.dispose();
    }
    for (const m of entry.materialsToDispose) {
      m.dispose();
    }
    if (!mergedGeom) continue;

    const mergedMesh = new THREE.Mesh(mergedGeom, entry.firstMaterial);
    mergedMesh.castShadow = entry.castShadow;
    mergedMesh.receiveShadow = entry.receiveShadow;
    newMeshes.push(mergedMesh);
  }

  for (const m of toMerge) {
    m.parent?.remove(m);
  }

  function pruneEmptyContainers(obj: THREE.Object3D) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const child = obj.children[i];
      if (!(child as THREE.Mesh).isMesh) {
        pruneEmptyContainers(child);
        if (child.children.length === 0) {
          obj.remove(child);
        }
      }
    }
  }
  pruneEmptyContainers(group);

  for (const mesh of newMeshes) {
    group.add(mesh);
  }

  return group;
}
