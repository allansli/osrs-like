// S1c: one Skeleton per cloned skinned figure (plan "S3 follow-ups", S1c). Red until the [AGY] part lands:
// SkeletonUtils.clone gives every cloned SkinnedMesh its own Skeleton, and cloneFigure must re-share them.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject3D } from '../src/engine/dispose';
import { cloneFigure } from '../src/engine/skinned';

/** Two SkinnedMesh bound to one Skeleton (bones root > arm), each with its own bind matrix. */
function buildTemplate(): { root: THREE.Group; meshes: THREE.SkinnedMesh[]; arm: THREE.Bone } {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const arm = new THREE.Bone();
  arm.name = 'Arm';
  arm.position.set(0, 1, 0);
  hips.add(arm);
  root.add(hips);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([hips, arm]);

  const meshes = [0, 1].map((i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0.5, 1, 0, 0, 1.5, 0], 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const m = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
    m.name = `Part${i}`;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4().makeTranslation(i * 0.25, 0, 0));
    return m;
  });
  root.updateMatrixWorld(true);
  return { root, meshes, arm };
}

function skinnedOf(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
  });
  return out;
}

function posed(mesh: THREE.SkinnedMesh, root: THREE.Object3D): THREE.Vector3 {
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  return mesh.getVertexPosition(1, new THREE.Vector3());
}

describe('cloneFigure keeps one Skeleton per figure', () => {
  const setup = () => {
    const t = buildTemplate();
    const clone = cloneFigure(t.root)!;
    return { ...t, clone, cm: skinnedOf(clone) };
  };

  it('the clones share one Skeleton that is not the template\'s', () => {
    const { meshes, cm } = setup();
    expect(cm).toHaveLength(2);
    expect(cm[0].skeleton).toBe(cm[1].skeleton);
    expect(cm[0].skeleton).not.toBe(meshes[0].skeleton);
  });

  it('its bones are the clone\'s own bones', () => {
    const { clone, meshes, cm } = setup();
    const own = new Set<THREE.Object3D>();
    clone.traverse((o) => {
      if ((o as THREE.Bone).isBone) own.add(o);
    });
    expect(cm[0].skeleton.bones).toHaveLength(2);
    for (const b of cm[0].skeleton.bones) {
      expect(own.has(b)).toBe(true);
      expect(meshes[0].skeleton.bones).not.toContain(b);
    }
  });

  it('each clone keeps its source bindMatrix', () => {
    const { meshes, cm } = setup();
    for (let i = 0; i < 2; i++) {
      expect(cm[i].bindMatrix.equals(meshes[i].bindMatrix)).toBe(true);
    }
    expect(cm[0].bindMatrix.equals(cm[1].bindMatrix)).toBe(false);
  });

  it('posing a cloned bone moves a vertex of both clones and none of the template', () => {
    const { root, meshes, clone, cm } = setup();
    const before = cm.map((m) => posed(m, clone));
    const tBefore = meshes.map((m) => posed(m, root));
    const armBone = cm[0].skeleton.bones[1];
    armBone.rotation.z = 1;
    const after = cm.map((m) => posed(m, clone));
    const tAfter = meshes.map((m) => posed(m, root));
    for (let i = 0; i < 2; i++) {
      expect(after[i].distanceTo(before[i])).toBeGreaterThan(0.1);
      expect(tAfter[i].distanceTo(tBefore[i])).toBe(0);
    }
  });

  it('disposeObject3D disposes the shared skeleton once', () => {
    const { clone } = setup();
    const spy = vi.spyOn(THREE.Skeleton.prototype, 'dispose');
    disposeObject3D(clone);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
