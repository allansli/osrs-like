import * as THREE from 'three';

interface FlinchRig { headGroup?: THREE.Object3D | null; rightArmPivot?: THREE.Object3D | null; leftArmPivot?: THREE.Object3D | null }
interface FlinchBase { head: THREE.Quaternion; right: THREE.Quaternion; left: THREE.Quaternion; applied: boolean }

// Per-monster base of the three flinched bones: three's PropertyMixer writes a bone only when its mixed value changed,
// so a constant track or a hit-stopped frame would leave last frame's flinched quaternion in place (RF1).
const flinchBases = new WeakMap<object, FlinchBase>();
const _flinchAxis = new THREE.Vector3(1, 0, 0);
const _flinchQ = new THREE.Quaternion();

/** Before the animator update: put the three bones back to their pre-flinch quaternions if a flinch was applied last frame. */
export function restoreFlinch(m: object, rig: FlinchRig): void {
  const fb = flinchBases.get(m);
  if (!fb || !fb.applied) return;
  rig.headGroup!.quaternion.copy(fb.head);
  rig.rightArmPivot!.quaternion.copy(fb.right);
  rig.leftArmPivot!.quaternion.copy(fb.left);
  fb.applied = false;
}

/** After the animator update: remember the three bones' clip pose, then multiply the flinch onto them. */
export function applyFlinch(m: object, rig: FlinchRig, curve: number): void {
  let fb = flinchBases.get(m);
  if (!fb) {
    fb = { head: new THREE.Quaternion(), right: new THREE.Quaternion(), left: new THREE.Quaternion(), applied: false };
    flinchBases.set(m, fb);
  }
  fb.head.copy(rig.headGroup!.quaternion);
  fb.right.copy(rig.rightArmPivot!.quaternion);
  fb.left.copy(rig.leftArmPivot!.quaternion);
  fb.applied = true;
  rig.headGroup!.quaternion.multiply(_flinchQ.setFromAxisAngle(_flinchAxis, -curve * 0.36));
  rig.rightArmPivot!.quaternion.multiply(_flinchQ.setFromAxisAngle(_flinchAxis, curve * 0.45));
  rig.leftArmPivot!.quaternion.multiply(_flinchQ.setFromAxisAngle(_flinchAxis, curve * 0.35));
}
