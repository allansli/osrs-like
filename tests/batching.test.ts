import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeByMaterial, materialKey } from '../src/engine/batching';
import { albedoMaterial } from '../src/engine/textures';

const RED = 0xaa2200;
const BLUE = 0x0022aa;

function box(x: number, y: number, z: number, mat: THREE.Material, w = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, 1), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null;
    if (g) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return n;
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh);
  });
  return found;
}

function bounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, true);
}

function byColor(root: THREE.Object3D, color: number): THREE.Mesh {
  const found = meshes(root).filter((m) => (m.material as THREE.MeshLambertMaterial).color.getHex() === color);
  expect(found).toHaveLength(1);
  return found[0];
}

// two material objects with equal parameters are one key
function sixMeshGroup(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(3, 0, -2);
  g.rotation.y = 0.4;
  const inner = new THREE.Group();
  inner.position.set(1, 2, 0);
  inner.rotation.z = 0.3;
  inner.scale.set(1.5, 1, 1);
  g.add(inner);
  g.add(box(0, 0, 0, albedoMaterial(RED, 'iron')));
  g.add(box(2, 0, 0, albedoMaterial(RED, 'iron')));
  inner.add(box(0, 1, 0, albedoMaterial(RED, 'iron')));
  g.add(box(0, 0, 3, albedoMaterial(BLUE, null)));
  const mirrored = box(-3, 0, 1, albedoMaterial(BLUE, null), 2);
  mirrored.scale.x = -1;
  g.add(mirrored);
  inner.add(box(2, 1, 1, albedoMaterial(BLUE, null)));
  return g;
}

describe('materialKey', () => {
  it('is equal for equal parameters and differs by colour, albedo id, emissive and side', () => {
    const base = materialKey(albedoMaterial(RED, 'iron'));
    expect(materialKey(albedoMaterial(RED, 'iron'))).toBe(base);
    expect(materialKey(albedoMaterial(BLUE, 'iron'))).not.toBe(base);
    expect(materialKey(albedoMaterial(RED, 'grass'))).not.toBe(base);
    expect(materialKey(albedoMaterial(RED, null))).not.toBe(base);
    expect(materialKey(albedoMaterial(RED, 'iron', { emissive: 0x112233, emissiveIntensity: 1 }))).not.toBe(base);
    expect(materialKey(albedoMaterial(RED, 'iron', { side: THREE.FrontSide }))).not.toBe(base);
  });
});

describe('mergeByMaterial', () => {
  it('turns six meshes over two keys into two meshes and keeps triangles and bounds', () => {
    const group = sixMeshGroup();
    const before = bounds(group);
    const tris = triangles(group);
    const out = mergeByMaterial(group);
    expect(meshes(out)).toHaveLength(2);
    expect(triangles(out)).toBe(tris);
    const after = bounds(out);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(Math.abs(after.min[axis] - before.min[axis])).toBeLessThan(1e-5);
      expect(Math.abs(after.max[axis] - before.max[axis])).toBeLessThan(1e-5);
    }
  });

  it('keeps triangles facing outward under a negative scale', () => {
    const out = mergeByMaterial(sixMeshGroup());
    for (const mesh of meshes(out)) {
      const g = mesh.geometry;
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      const idx = g.index;
      const tri = idx ? idx.count / 3 : pos.count / 3;
      const at = (n: number) => (idx ? idx.getX(n) : n);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      for (let t = 0; t < tri; t++) {
        const [i, j, k] = [at(t * 3), at(t * 3 + 1), at(t * 3 + 2)];
        a.fromBufferAttribute(pos, i);
        b.fromBufferAttribute(pos, j);
        c.fromBufferAttribute(pos, k);
        const face = b.sub(a).cross(c.sub(a));
        const stored = new THREE.Vector3().fromBufferAttribute(nor, i);
        expect(face.dot(stored)).toBeGreaterThan(0);
      }
    }
  });

  it('sets castShadow and receiveShadow on a merged mesh when any source had them', () => {
    const group = sixMeshGroup();
    const reds = meshes(group).filter((m) => (m.material as THREE.MeshLambertMaterial).color.getHex() === RED);
    reds[1].castShadow = true;
    reds[2].receiveShadow = true;
    const out = mergeByMaterial(group);
    expect(byColor(out, RED).castShadow).toBe(true);
    expect(byColor(out, RED).receiveShadow).toBe(true);
    expect(byColor(out, BLUE).castShadow).toBe(false);
    expect(byColor(out, BLUE).receiveShadow).toBe(false);
  });

  it('leaves noOutline and isCollider meshes unmerged', () => {
    const group = sixMeshGroup();
    const eye = box(5, 0, 0, albedoMaterial(RED, 'iron'));
    eye.userData.noOutline = true;
    const hitbox = box(6, 0, 0, albedoMaterial(RED, 'iron'));
    hitbox.userData.isCollider = true;
    group.add(eye, hitbox);
    const out = mergeByMaterial(group);
    expect(meshes(out)).toHaveLength(4);
    expect(meshes(out)).toContain(eye);
    expect(meshes(out)).toContain(hitbox);
    expect(eye.geometry.getAttribute('position').count).toBe(24);
  });

  it('merges meshes with and without uv and fills the missing attribute with zeros', () => {
    const group = new THREE.Group();
    const withUv = box(0, 0, 0, albedoMaterial(RED, null));
    const noUv = box(2, 0, 0, albedoMaterial(RED, null));
    noUv.geometry.deleteAttribute('uv');
    group.add(withUv, noUv);
    const out = mergeByMaterial(group);
    const [merged] = meshes(out);
    expect(meshes(out)).toHaveLength(1);
    const uv = merged.geometry.getAttribute('uv');
    expect(uv.count).toBe(merged.geometry.getAttribute('position').count);
    for (let i = 24; i < uv.count; i++) {
      expect(uv.getX(i)).toBe(0);
      expect(uv.getY(i)).toBe(0);
    }
  });

  it('merges an indexed and a non-indexed mesh with the same key', () => {
    const group = new THREE.Group();
    const indexed = box(0, 0, 0, albedoMaterial(RED, null));
    const flat = box(2, 0, 0, albedoMaterial(RED, null));
    flat.geometry = flat.geometry.toNonIndexed();
    group.add(indexed, flat);
    const tris = triangles(group);
    const out = mergeByMaterial(group);
    expect(meshes(out)).toHaveLength(1);
    expect(triangles(out)).toBe(tris);
  });
});
