import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject3D } from '../src/engine/dispose';
import { addCartoonOutline } from '../src/engine/materials';

function spyGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.dispose = vi.fn();
  return g;
}

function spyMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial();
  m.dispose = vi.fn();
  return m;
}

describe('disposeObject3D', () => {
  it('disposes every geometry under root once', () => {
    const root = new THREE.Group();
    const shared = spyGeometry();
    const other = spyGeometry();
    const child = new THREE.Group();
    root.add(new THREE.Mesh(shared, spyMaterial()));
    child.add(new THREE.Mesh(shared, spyMaterial()));
    child.add(new THREE.Mesh(other, spyMaterial()));
    root.add(child);

    disposeObject3D(root);

    expect(shared.dispose).toHaveBeenCalledTimes(1);
    expect(other.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes materials unless keep returns true', () => {
    const root = new THREE.Group();
    const dropped = spyMaterial();
    const kept = spyMaterial();
    const a = spyMaterial();
    const b = spyMaterial();
    root.add(new THREE.Mesh(spyGeometry(), dropped));
    root.add(new THREE.Mesh(spyGeometry(), kept));
    root.add(new THREE.Mesh(spyGeometry(), [a, b]));

    disposeObject3D(root, (m: THREE.Material) => m === kept);

    expect(dropped.dispose).toHaveBeenCalledTimes(1);
    expect(kept.dispose).not.toHaveBeenCalled();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
  });

  it('never disposes the shared outline material', () => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(spyGeometry(), spyMaterial());
    root.add(body);
    addCartoonOutline(root);
    const shell = body.children.find((c) => c.userData.isOutline) as THREE.Mesh;
    expect(shell).toBeDefined();
    const outline = shell.material as THREE.Material;
    outline.dispose = vi.fn();

    disposeObject3D(root);
    // keep returning false must not override the outline guard
    disposeObject3D(root, () => false);

    expect(outline.dispose).not.toHaveBeenCalled();
    expect((body.material as THREE.Material).dispose).toHaveBeenCalled();
  });

  it('detaches root from its parent', () => {
    const parent = new THREE.Group();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(spyGeometry(), spyMaterial()));
    parent.add(root);

    disposeObject3D(root);

    expect(root.parent).toBeNull();
    expect(parent.children).not.toContain(root);
  });
});
