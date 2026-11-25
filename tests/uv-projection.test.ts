import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { albedoMaterial, assignGroundUvs, sealAlbedoUvs } from '../src/engine/textures';

const SENTINEL = Math.fround(0.123);

function propMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geometry, albedoMaterial(0xffffff, 'iron'));
}

function setSentinel(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, SENTINEL, SENTINEL);
}

function unchanged(geometry: THREE.BufferGeometry): boolean {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    if (uv.getX(i) !== SENTINEL || uv.getY(i) !== SENTINEL) return false;
  }
  return true;
}

// finding 23: track projected UVs in a WeakSet, not geometry.userData
describe('sealAlbedoUvs', () => {
  it('projects a clone of an already projected geometry', () => {
    const first = propMesh(new THREE.BoxGeometry(2, 2, 2));
    sealAlbedoUvs(first);
    const second = propMesh(first.geometry.clone());
    setSentinel(second.geometry);
    sealAlbedoUvs(second);
    expect(unchanged(second.geometry)).toBe(false);
  });

  it('does not project the same geometry twice', () => {
    const mesh = propMesh(new THREE.BoxGeometry(2, 2, 2));
    sealAlbedoUvs(mesh);
    setSentinel(mesh.geometry);
    sealAlbedoUvs(mesh);
    expect(unchanged(mesh.geometry)).toBe(true);
  });

  it('leaves a ground-projected geometry alone', () => {
    const mesh = propMesh(new THREE.BoxGeometry(2, 2, 2));
    assignGroundUvs(mesh.geometry);
    setSentinel(mesh.geometry);
    sealAlbedoUvs(mesh);
    expect(unchanged(mesh.geometry)).toBe(true);
  });
});
