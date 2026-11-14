import fs from 'node:fs'; import zlib from 'node:zlib';
import * as THREE from '/path/to/osrs-like-wp/MP/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/path/to/osrs-like-wp/MP/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from '/path/to/osrs-like-wp/MP/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
const parse = (f) => { const b = fs.readFileSync(f); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej)); };
const br = (f) => zlib.brotliCompressSync(fs.readFileSync(f), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;
const D = '/tmp/scratch/mp2/out/';
for (const f of ['human_static.glb', 'human_noanim.glb', 'human_skinned.glb', 'goblin_skinned.glb', 'both_same_names.glb']) console.log('bytes', f, fs.statSync(D + f).size, 'br3', br(D + f));
{ const b = fs.readFileSync(D + 'human_skinned.glb'); const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString());
  const p = j.meshes[0].primitives[0]; for (const [k, a] of Object.entries(p.attributes)) { const ac = j.accessors[a]; console.log('attr', k, ac.type, ac.componentType, ac.normalized || false, 'count', ac.count); }
  console.log('joints', j.skins[0].joints.length, 'jsonBytes', b.readUInt32LE(12), 'anim', j.animations.map(a => a.name + ':' + a.channels.length + 'ch/' + j.accessors[a.samplers[0].input].count + 'keys/' + a.samplers[0].interpolation));
  console.log('joint rest rotations', j.skins[0].joints.map(i => j.nodes[i].name + '=' + JSON.stringify(j.nodes[i].rotation || 'identity')).join(' ')); }
const g = await parse(D + 'human_skinned.glb');
let sk; g.scene.traverse(o => { if (o.isSkinnedMesh) sk = o; });
console.log('SkinnedMesh', !!sk, 'bones', sk.skeleton.bones.length, sk.skeleton.bones.map(b => b.name).join(','));
console.log('bone rest quats identity:', sk.skeleton.bones.every(b => Math.abs(b.quaternion.w) > 0.99999));
console.log('clips', g.animations.map(a => a.name + ' ' + a.duration.toFixed(2) + 's tracks=' + a.tracks.map(t => t.name).join('|')).join('\n  '));
// clone(true) vs SkeletonUtils.clone
const bad = g.scene.clone(true); let badSk; bad.traverse(o => { if (o.isSkinnedMesh) badSk = o; });
console.log('clone(true): skeleton bones belong to the clone?', badSk.skeleton.bones[0] !== sk.skeleton.bones[0], '(false = the clone still deforms by the ORIGINAL bones)');
const good = SkeletonUtils.clone(g.scene); let goodSk; good.traverse(o => { if (o.isSkinnedMesh) goodSk = o; });
console.log('SkeletonUtils.clone: own bones?', goodSk.skeleton.bones[0] !== sk.skeleton.bones[0], 'geometry shared?', goodSk.geometry === sk.geometry);
// mixer on the clone, shared clip
const rig = new THREE.Group(); [...good.children].forEach(c => rig.add(c)); rig.updateMatrixWorld(true);
const bone = (root, n) => root.getObjectByName(n);
const handV = (() => { const p = goodSk.geometry.attributes.position; let best = 0, bx = -1; for (let i = 0; i < p.count; i++) if (p.getX(i) > bx) { bx = p.getX(i); best = i; } return best; })();
const v0 = new THREE.Vector3(); goodSk.getVertexPosition(handV, v0); 
goodSk.computeBoundingSphere(); const restSphere = goodSk.boundingSphere.clone();
const mixer = new THREE.AnimationMixer(rig); const slash = mixer.clipAction(g.animations.find(a => a.name === 'Slash')); slash.play(); mixer.update(0.45 * g.animations.find(a => a.name === 'Slash').duration); rig.updateMatrixWorld(true);
const v1 = new THREE.Vector3(); goodSk.getVertexPosition(handV, v1);
console.log('after Slash@45%: RightArmPivot.rotation.x', bone(rig, 'RightArmPivot').rotation.x.toFixed(3), 'Torso.rotation.y', bone(rig, 'Torso').rotation.y.toFixed(3), '| hand vertex moved', v0.distanceTo(v1).toFixed(3), '| original untouched', sk.skeleton.bones.every(b => Math.abs(b.quaternion.w) > 0.99999));
// rigid gear on a bone
const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05)); sword.position.set(0, -0.3, 0.08); bone(rig, 'RightElbowPivot').add(sword); rig.updateMatrixWorld(true);
console.log('rigid child of elbow bone world pos', sword.getWorldPosition(new THREE.Vector3()).toArray().map(v => v.toFixed(2)).join(','));
// stale bounding sphere
const stale = goodSk.boundingSphere.clone(); goodSk.computeBoundingSphere();
console.log('boundingSphere rest r', restSphere.radius.toFixed(3), 'kept after pose (not auto-updated):', stale.equals(restSphere), 'recomputed r', goodSk.boundingSphere.radius.toFixed(3), 'centre shift', restSphere.center.distanceTo(goodSk.boundingSphere.center).toFixed(3));
// raycast against the posed skin (CPU)
const rc = new THREE.Raycaster(new THREE.Vector3(v1.x, v1.y, 5), new THREE.Vector3(0, 0, -1)); const t0 = performance.now(); const hits = rc.intersectObject(goodSk, false);
console.log('raycast posed skinned mesh hits', hits.length, 'ms', (performance.now() - t0).toFixed(1));
// a plain Mesh shell sharing the skinned geometry: no bone transform
const shell = new THREE.Mesh(goodSk.geometry); goodSk.add(shell); rig.updateMatrixWorld(true); const s1 = new THREE.Vector3(); shell.getVertexPosition(handV, s1);
console.log('plain Mesh shell vertex stays at bind pose:', s1.distanceTo(v0) < 1e-6, '(so an outline shell must be a SkinnedMesh bound to the same skeleton)');
const shell2 = new THREE.SkinnedMesh(goodSk.geometry); shell2.bind(goodSk.skeleton, goodSk.bindMatrix); goodSk.add(shell2); rig.updateMatrixWorld(true); const s2 = new THREE.Vector3(); shell2.getVertexPosition(handV, s2);
console.log('SkinnedMesh shell bound to same skeleton follows:', s2.distanceTo(v1) < 1e-4);
// same clip on a figure of other proportions
const gg = await parse(D + 'goblin_skinned.glb'); const gob = SkeletonUtils.clone(gg.scene); let gobSk; gob.traverse(o => { if (o.isSkinnedMesh) gobSk = o; });
const gm = new THREE.AnimationMixer(gob); gm.clipAction(g.animations.find(a => a.name === 'Walk')).play(); gm.update(0.33); gob.updateMatrixWorld(true);
console.log('human Walk clip on goblin (other proportions, same bone names): LeftLegPivot.rotation.x', bone(gob, 'LeftLegPivot').rotation.x.toFixed(3), 'bone local pos unchanged', bone(gob, 'LeftKneePivot').position.toArray().map(v => v.toFixed(2)).join(','), 'tracks are', [...new Set(g.animations[0].tracks.map(t => t.name.split('.')[1]))].join(','));
// two armatures with the same bone names in one file
const both = await parse(D + 'both_same_names.glb'); const names = []; both.scene.traverse(o => { if (o.isBone && /Torso/.test(o.name)) names.push(o.name); });
console.log('two rigs, same bone names, one file -> loader names', names.join(','), '| clip tracks', both.animations[0].tracks.slice(0, 3).map(t => t.name).join(','));
// skeleton dispose
console.log('Skeleton has dispose():', typeof goodSk.skeleton.dispose, '| boneTexture before render:', goodSk.skeleton.boneTexture);
