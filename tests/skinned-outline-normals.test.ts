// S1d: the skinned outline pushes along one direction per position (plan "S3b follow-ups", S1d).
// Red until the [AGY] part lands: addCartoonOutline's skinned branch adds an `outlineNormal` attribute.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { addCartoonOutline } from '../src/engine/materials';

function skinnedOf(geometry: THREE.BufferGeometry): THREE.SkinnedMesh {
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  const w = new Array(n * 4).fill(0);
  for (let i = 0; i < n; i++) w[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
  const root = new THREE.Group();
  const bone = new THREE.Bone();
  root.add(bone);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  root.add(mesh);
  mesh.bind(new THREE.Skeleton([bone]));
  mesh.computeBoundingSphere();
  return mesh;
}

function shellOf(mesh: THREE.Mesh): THREE.Mesh {
  const shells = mesh.children.filter((c) => c.userData?.isOutline) as THREE.Mesh[];
  expect(shells).toHaveLength(1);
  return shells[0];
}

function at(g: THREE.BufferGeometry, name: string, i: number): THREE.Vector3 {
  return new THREE.Vector3().fromBufferAttribute(g.getAttribute(name), i);
}

// Snapshot of the rigid outline vertex shader before S1d; the rigid path must not change.
const RIGID_OUTLINE_VERTEX_SHADER = `
      uniform float uThickness;
      void main() {
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNorm = normalize(normalMatrix * normal);
        viewPos.xy += viewNorm.xy * uThickness;
        viewPos.z -= uThickness * 2.5 + 0.045;
        gl_Position = projectionMatrix * viewPos;
      }
    `;

describe('skinned outline normals on hard edges', () => {
  it('gives split vertices one shared outlineNormal, the normalised sum of their normals', () => {
    const g = new THREE.BoxGeometry(1, 1, 1); // 24 vertices, each corner split three ways
    const mesh = skinnedOf(g);
    addCartoonOutline(mesh, 0.03);
    const attr = g.getAttribute('outlineNormal');
    expect(attr).toBeDefined();
    expect(attr.itemSize).toBe(3);
    expect(attr.count).toBe(24);
    for (let i = 0; i < 24; i++) {
      const p = at(g, 'position', i);
      const sum = new THREE.Vector3();
      const twins: number[] = [];
      for (let j = 0; j < 24; j++) {
        if (at(g, 'position', j).distanceTo(p) < 1e-5) {
          sum.add(at(g, 'normal', j));
          twins.push(j);
        }
      }
      expect(twins).toHaveLength(3);
      sum.normalize();
      for (const j of twins) expect(at(g, 'outlineNormal', j).distanceTo(sum)).toBeLessThan(1e-5);
    }
  });

  it('keeps a vertex with no twin on its own normal', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0.6, 0.8], 3));
    addCartoonOutline(skinnedOf(g), 0.03);
    for (let i = 0; i < 3; i++) {
      expect(at(g, 'outlineNormal', i).distanceTo(at(g, 'normal', i))).toBeLessThan(1e-5);
    }
  });

  it('keeps each copy on its own normal when coincident normals sum to zero', () => {
    // as goblin_body in the s3b one-material builds: two copies at one position, opposed normals
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 0, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0.302, 0.946, -0.121, -0.302, -0.946, 0.121, 0, 0, 1], 3));
    addCartoonOutline(skinnedOf(g), 0.03);
    for (let i = 0; i < 3; i++) {
      const own = at(g, 'normal', i).normalize();
      const out = at(g, 'outlineNormal', i);
      expect(out.length()).toBeCloseTo(1, 5);
      expect(out.distanceTo(own)).toBeLessThan(1e-5);
    }
  });

  it('writes no outlineNormal for a skinned geometry without normals, so the shell is not pushed', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const mesh = skinnedOf(g);
    addCartoonOutline(mesh, 0.03);
    expect(g.getAttribute('outlineNormal')).toBeUndefined();
    expect(g.getAttribute('normal')).toBeUndefined();
    expect((shellOf(mesh) as THREE.SkinnedMesh).isSkinnedMesh).toBe(true);
  });

  it('starts the skinned outline shader from outlineNormal, not beginnormal_vertex', () => {
    const mesh = skinnedOf(new THREE.BoxGeometry(1, 1, 1));
    addCartoonOutline(mesh, 0.03);
    const shell = shellOf(mesh);
    expect((shell as THREE.SkinnedMesh).isSkinnedMesh).toBe(true);
    const vs = (shell.material as THREE.ShaderMaterial).vertexShader;
    expect(vs).toContain('attribute vec3 outlineNormal;');
    expect(vs).toContain('vec3 objectNormal = outlineNormal;');
    expect(vs).not.toContain('beginnormal_vertex');
    expect(vs.indexOf('vec3 objectNormal = outlineNormal;')).toBeLessThan(vs.indexOf('#include <skinbase_vertex>'));
    expect(vs.indexOf('vec3 objectNormal = outlineNormal;')).toBeLessThan(vs.indexOf('#include <skinnormal_vertex>'));
    expect(vs).toContain('skinnormal_vertex');
  });

  it('leaves the rigid shell and its material unchanged', () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    addCartoonOutline(mesh, 0.03);
    const shell = shellOf(mesh);
    expect((shell as THREE.SkinnedMesh).isSkinnedMesh).toBeFalsy();
    expect(g.getAttribute('outlineNormal')).toBeUndefined();
    const mat = shell.material as THREE.ShaderMaterial;
    expect(mat.vertexShader).toBe(RIGID_OUTLINE_VERTEX_SHADER);
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.depthWrite).toBe(true);
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(2);
    expect(mat.polygonOffsetUnits).toBe(2);
    expect(Object.keys(mat.uniforms).sort()).toEqual(['uColor', 'uThickness']);
    expect(mat.uniforms.uThickness.value).toBe(0.03);
  });

  it('adds nothing on a second call', () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const mesh = skinnedOf(g);
    addCartoonOutline(mesh, 0.03);
    const attr = g.getAttribute('outlineNormal');
    addCartoonOutline(mesh, 0.03);
    expect(g.getAttribute('outlineNormal')).toBe(attr);
    expect(mesh.children.filter((c) => c.userData?.isOutline)).toHaveLength(1);
  });

  it('computes the attribute once per geometry when two meshes share it', () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const a = skinnedOf(g);
    addCartoonOutline(a, 0.03);
    const attr = g.getAttribute('outlineNormal');
    const b = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
    b.bind(a.skeleton, a.bindMatrix);
    b.computeBoundingSphere();
    addCartoonOutline(b, 0.03);
    expect(g.getAttribute('outlineNormal')).toBe(attr);
  });
});
