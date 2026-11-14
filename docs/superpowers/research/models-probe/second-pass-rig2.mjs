import fs from 'node:fs';
const NM = '/path/to/osrs-like-wp/MP/node_modules/three';
const THREE = await import(NM + '/build/three.module.js');
const { GLTFLoader } = await import(NM + '/examples/jsm/loaders/GLTFLoader.js');
const SkeletonUtils = await import(NM + '/examples/jsm/utils/SkeletonUtils.js');
const file = process.argv[2];
const b = fs.readFileSync(file);
const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString());
console.log('node tree:', j.nodes.map((n, i) => `${i}:${n.name}${n.mesh !== undefined ? '[mesh]' : ''}${n.skin !== undefined ? '[skin]' : ''} t=${JSON.stringify(n.translation || 0)} r=${JSON.stringify(n.rotation || 0)} ch=${JSON.stringify(n.children || [])}`).join('\n  '));
const g = await new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej));
const q = (name) => { const c = g.animations.find((a) => a.name === name); const t = c.tracks.find((t) => t.name.endsWith('.quaternion')); const v = t.values; const n = v.length; return new THREE.Quaternion(v[n - 4], v[n - 3], v[n - 2], v[n - 1]); };
const ref = q('RefEmpty'), bone = q('BoneXZY');
const e = new THREE.Euler(0.3, 0.5, 0.7, 'YZX'); const fromEuler = new THREE.Quaternion().setFromEuler(e);
console.log('today pivot quat', ref.toArray().map((v) => v.toFixed(4)).join(','), '| bone XZY quat', bone.toArray().map((v) => v.toFixed(4)).join(','), '| angle between', (2 * Math.acos(Math.min(1, Math.abs(ref.dot(bone))))).toFixed(5), 'rad');
console.log('today pivot == three Euler(rx,ry,rz, "YZX")?', (2 * Math.acos(Math.min(1, Math.abs(ref.dot(fromEuler))))).toFixed(5));
const xyz = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.5, 0.7, 'ZYX'));
console.log('a bone keyed in Blender XYZ (= three ZYX) would differ by', (2 * Math.acos(Math.min(1, Math.abs(ref.dot(xyz))))).toFixed(4), 'rad');

// engine path: clone the Monster_ node, reset it, move its children into the rig group (upgradeMonsterRigWithGltf)
g.scene.updateMatrixWorld(true);
const template = g.scene.getObjectByName('Monster_probe');
let tSk; template.traverse((o) => { if (o.isSkinnedMesh) tSk = o; });
console.log('template node type', template.type, 'skinned mesh parent', tSk.parent.name, 'bindMatrix translation', new THREE.Vector3().setFromMatrixPosition(tSk.bindMatrix).toArray());
const rigGroup = (at) => { const grp = new THREE.Group(); grp.position.set(...at); return grp; };
function upgrade(at) {
  const cloned = SkeletonUtils.clone(template);
  cloned.position.set(0, 0, 0); cloned.rotation.set(0, 0, 0); cloned.scale.set(1, 1, 1);
  const grp = rigGroup(at);
  for (const ch of [...cloned.children]) grp.add(ch);
  grp.traverse((o) => { if (o.isBone) o.name = o.name.replace(/^probe_/, ''); });
  grp.updateMatrixWorld(true);
  let sk; grp.traverse((o) => { if (o.isSkinnedMesh) sk = o; });
  return { grp, sk };
}
const A = upgrade([10, 0, 10]);
const vtx = new THREE.Vector3(); let worst = 0;
const pos = A.sk.geometry.attributes.position;
for (let i = 0; i < pos.count; i++) {
  A.sk.getVertexPosition(i, vtx); const w = vtx.clone().applyMatrix4(A.sk.matrixWorld);
  const expect = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(A.sk.matrixWorld);
  worst = Math.max(worst, w.distanceTo(expect));
}
console.log('rest pose after clone + move into a group at (10,0,10): worst vertex error', worst.toFixed(6), '(a non-zero value equal to the Monster_ offset would mean bind matrices carry the file layout)');
// pose like poseMonsterLimbs
const arm = A.grp.getObjectByName('RightArmPivot'); const torso = A.grp.getObjectByName('Torso'); const elbow = A.grp.getObjectByName('RightElbowPivot');
console.log('bones after strip', A.sk.skeleton.bones.map((x) => x.name).join(','), '| arm rest quat identity', arm.quaternion.equals(new THREE.Quaternion()));
let tip = -1; for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0.2 && (tip < 0 || pos.getY(i) < pos.getY(tip))) tip = i;
const shoulderW = arm.getWorldPosition(new THREE.Vector3());
A.sk.getVertexPosition(tip, vtx); const tip0 = vtx.clone().applyMatrix4(A.sk.matrixWorld);
arm.rotation.x = 1.0; A.grp.updateMatrixWorld(true);
A.sk.getVertexPosition(tip, vtx); const tip1 = vtx.clone().applyMatrix4(A.sk.matrixWorld);
const exp1 = tip0.clone().sub(shoulderW).applyAxisAngle(new THREE.Vector3(1, 0, 0), 1.0).add(shoulderW);
console.log('dbg', tip0.toArray(), tip1.toArray(), exp1.toArray(), shoulderW.toArray(), A.sk.geometry.attributes.skinIndex.getX(tip), A.sk.skeleton.bones.map(b=>b.name)[A.sk.geometry.attributes.skinIndex.getX(tip)]);console.log('arm.rotation.x = 1: tip vertex error against a rotation about the shoulder joint', tip1.distanceTo(exp1).toFixed(6));
// rigid gear on the elbow bone vs today's pivot empties
const box = new THREE.Object3D(); box.position.set(0.19, -0.32, 0.08); elbow.add(box);
torso.rotation.y = 0.5; A.grp.updateMatrixWorld(true);
const pv = rigGroup([10, 0, 10]); const pT = new THREE.Object3D(); pT.position.set(0, 1.24, 0); pT.rotation.y = 0.5; pv.add(pT);
const pA = new THREE.Object3D(); pA.position.set(0.28, 1.5 - 1.24, 0); pA.rotation.x = 1.0; pT.add(pA);
const pE = new THREE.Object3D(); pE.position.set(0, -0.26, 0); pA.add(pE); const pB = new THREE.Object3D(); pB.position.set(0.19, -0.32, 0.08); pE.add(pB); pv.updateMatrixWorld(true);
console.log('gear on elbow bone (torso turned 0.5, arm 1.0) vs the same offsets on a pivot chain: error', box.getWorldPosition(new THREE.Vector3()).distanceTo(pB.getWorldPosition(new THREE.Vector3())).toFixed(6));
// two instances independent; template untouched; shared boneInverses
const B = upgrade([0, 0, 0]);
console.log('second instance arm at rest', B.grp.getObjectByName('RightArmPivot').quaternion.equals(new THREE.Quaternion()), '| template arm at rest', template.getObjectByName('probe_RightArmPivot').quaternion.equals(new THREE.Quaternion()));
console.log('boneInverses array shared between clones and template:', A.sk.skeleton.boneInverses === tSk.skeleton.boneInverses, '| matrices shared:', A.sk.skeleton.boneInverses[0] === tSk.skeleton.boneInverses[0]);
// outline shell bound mid-pose with the mesh's bindMatrix
const shell = new THREE.SkinnedMesh(A.sk.geometry, new THREE.MeshBasicMaterial()); shell.bind(A.sk.skeleton, A.sk.bindMatrix); A.sk.add(shell); A.grp.updateMatrixWorld(true);
const s1 = new THREE.Vector3(); shell.getVertexPosition(tip, s1); A.sk.getVertexPosition(tip, vtx);
console.log('skinned shell bound mid-pose with bindMatrix follows the mesh: error', s1.distanceTo(vtx).toFixed(6));
const shell2 = new THREE.SkinnedMesh(A.sk.geometry, new THREE.MeshBasicMaterial()); A.sk.add(shell2); shell2.bind(A.sk.skeleton); A.grp.updateMatrixWorld(true);
const s2 = new THREE.Vector3(); shell2.getVertexPosition(tip, s2); A.sk.getVertexPosition(tip, vtx);
console.log('shell bound WITHOUT bindMatrix mid-pose: error', s2.distanceTo(vtx).toFixed(4), '| template inverses changed by it:', !tSk.skeleton.boneInverses[4].equals(B.sk.skeleton.boneInverses[4]) ? 'n/a' : 'check', 'B instance tip now', (() => { B.grp.updateMatrixWorld(true); const v = new THREE.Vector3(); B.sk.getVertexPosition(tip, v); return v.distanceTo(new THREE.Vector3().fromBufferAttribute(pos, tip)).toFixed(4); })());
// culling sphere
console.log('SkinnedMesh.boundingSphere before first use', A.sk.boundingSphere, '| clone copies a template sphere:', (() => { tSk.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9); const c = upgrade([0, 0, 0]); return c.sk.boundingSphere?.radius; })());
// mixer with unprefixed track names against stripped bones
const clip = g.animations.find((a) => a.name === 'BoneXZY').clone(); clip.tracks.forEach((t) => { t.name = t.name.replace(/^probe_/, ''); });
const C = upgrade([0, 0, 0]); const mx = new THREE.AnimationMixer(C.grp); mx.clipAction(clip).play(); mx.update(clip.duration - 1e-4);
console.log('clip with stripped track names drives the stripped bone: angle to expected', (2 * Math.acos(Math.min(1, Math.abs(C.grp.getObjectByName('RightArmPivot').quaternion.dot(ref))))).toFixed(4));
console.log('track names in file:', g.animations.map((a) => a.name + ':' + a.tracks.map((t) => t.name).join('|')).join('  '));
