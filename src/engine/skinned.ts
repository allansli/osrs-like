import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

function isIdentityTransform(obj: THREE.Object3D): boolean {
  return (
    obj.position.lengthSq() < 1e-8 &&
    obj.quaternion.x === 0 &&
    obj.quaternion.y === 0 &&
    obj.quaternion.z === 0 &&
    obj.quaternion.w === 1 &&
    obj.scale.x === 1 &&
    obj.scale.y === 1 &&
    obj.scale.z === 1
  );
}

export function hasSkin(node: THREE.Object3D): boolean {
  let found = false;
  node.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) found = true;
  });
  return found;
}

export function cloneFigure(node: THREE.Object3D): THREE.Object3D | null {
  if (hasSkin(node) && !isIdentityTransform(node)) {
    console.warn(`Skinned root ${node.name} has non-identity transform, refusing to clone`);
    return null;
  }
  const cloned = clone(node);
  const src: THREE.SkinnedMesh[] = [];
  const dst: THREE.SkinnedMesh[] = [];
  node.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) src.push(o as THREE.SkinnedMesh); });
  cloned.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) dst.push(o as THREE.SkinnedMesh); });
  // SkeletonUtils.clone gives each skinned mesh its own Skeleton; re-share the first one per source Skeleton.
  const shared = new Map<THREE.Skeleton, THREE.Skeleton>();
  dst.forEach((m, i) => {
    const key = src[i].skeleton;
    const first = shared.get(key);
    if (!first) shared.set(key, m.skeleton);
    else m.bind(first, m.bindMatrix.clone());
  });
  cloned.traverse((obj) => {
    const b = obj as THREE.Bone;
    if (b.isBone && b.quaternion.x === 0 && b.quaternion.y === 0 && b.quaternion.z === 0 && b.quaternion.w === 1) {
      b.rotation.set(0, 0, 0);
    }
  });
  return cloned;
}

export function stripBonePrefix(root: THREE.Object3D, key: string): void {
  const prefix = `${key}_`;
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone && obj.name.startsWith(prefix)) {
      obj.name = obj.name.slice(prefix.length);
    }
  });
}

const strippedClips = new WeakSet<THREE.AnimationClip>();

export function stripClipPrefix(clips: THREE.AnimationClip[], key: string): THREE.AnimationClip[] {
  const prefix = `${key}_`;
  for (const clip of clips) {
    if (strippedClips.has(clip)) continue;
    for (const track of clip.tracks) {
      if (track.name.startsWith(prefix)) {
        track.name = track.name.slice(prefix.length);
      }
    }
    strippedClips.add(clip);
  }
  return clips;
}

export function fixCullSpheres(template: THREE.Object3D, factor = 1.5): void {
  template.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      if (!sm.geometry.boundingSphere) {
        sm.geometry.computeBoundingSphere();
      }
      sm.boundingSphere = new THREE.Sphere(
        sm.geometry.boundingSphere!.center.clone(),
        sm.geometry.boundingSphere!.radius * factor
      );
    }
  });
}
