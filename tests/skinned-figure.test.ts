// S0: the engine's skinned path (design 6.1.3, 8.3), written before it exists. Red until S1b:
// `src/engine/skinned.ts` is missing, so this file fails at import. That is the allowed red window.
// The fixture `tests/fixtures/models/skinned-pair.glb` is written by `buildPair` below: one skinned
// figure (`Monster_probe`, bones `probe_Torso` and `probe_LeftArmPivot`) and one rigid figure
// (`Monster_crate`, pivot `crate_HeadGroup`), in one file.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../src/engine/blenderMonsters';
import { disposeObject3D } from '../src/engine/dispose';
import { addCartoonOutline, isSharedOutlineMaterial } from '../src/engine/materials';
import { fixCullSpheres, hasSkin, stripClipPrefix } from '../src/engine/skinned';
import { packGlb, type Doc, type GltfNode } from './fixtures/models/tinyGlb';

const FIXTURE = path.resolve(__dirname, 'fixtures/models/skinned-pair.glb');
const F32 = 5126;
const U16 = 5123;
const U8 = 5121;

// Rest positions (figure space). Torso bone at (0, .5, 0); arm bone under it at (-.3, .4, 0), so world (-.3, .9, 0).
const VERTS: [number, number, number][] = [
  [0, 0, 0], // 0: Torso only
  [0.3, 0.6, 0], // 1: Torso only
  [-0.3, 0.9, 0], // 2: arm only, on the arm bone's own head (a turn does not move it)
  [-0.5, 1.4, 0], // 3: arm only, 0.5 above the arm bone
  [-0.1, 1.4, 0] // 4: arm only
];
const ARM_VERTEX = 3;
const TORSO_VERTEX = 0;
const QUARTER = [Math.sin(0.5), 0, 0, Math.cos(0.5)]; // one radian about x
const ID_Q = [0, 0, 0, 1];

/** The fixture file. `rootNode` lets a test move or turn the skinned root (design 6.1.1 rule 2b). */
function buildPair(rootNode: Partial<GltfNode> = {}): Doc {
  const parts: Buffer[] = [];
  let len = 0;
  const json: Doc['json'] = {
    asset: { version: '2.0', generator: 'skinned-pair-fixture' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [],
    meshes: [],
    materials: [{ name: 'skin', pbrMetallicRoughness: { baseColorFactor: [0.4, 0.6, 0.3, 1] } }],
    accessors: [],
    bufferViews: [],
    animations: []
  };
  const acc = (data: ArrayBufferView, componentType: number, type: string, count: number, minmax?: [number[], number[]]) => {
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4);
    raw.copy(padded);
    json.bufferViews.push({ buffer: 0, byteOffset: len, byteLength: raw.length });
    parts.push(padded);
    len += padded.length;
    json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType, count, type, ...(minmax ? { min: minmax[0], max: minmax[1] } : {}) });
    return json.accessors.length - 1;
  };
  const flat = VERTS.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...VERTS.map((v) => v[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...VERTS.map((v) => v[k])));
  const pos = acc(new Float32Array(flat), F32, 'VEC3', VERTS.length, [lo, hi]);
  const idx = acc(new Uint16Array([0, 1, 2, 2, 3, 4, 1, 2, 4]), U16, 'SCALAR', 9);
  const joints = acc(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), U8, 'VEC4', VERTS.length);
  const weights = acc(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), F32, 'VEC4', VERTS.length);
  const world = [[0, 0.5, 0], [-0.3, 0.9, 0]];
  const ibm = new Float32Array(32);
  world.forEach((w, k) => ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1], k * 16));
  const ibmAcc = acc(ibm, F32, 'MAT4', 2);
  const times = acc(new Float32Array([0, 1]), F32, 'SCALAR', 2);
  const rotOut = (q: number[]) => acc(new Float32Array([...ID_Q, ...q]), F32, 'VEC4', 2);
  const torsoRot = rotOut(ID_Q);
  const armRot = rotOut(QUARTER);
  const rigidPos = acc(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), F32, 'VEC3', 3, [[0, 0, 0], [1, 1, 0]]);
  const rigidIdx = acc(new Uint16Array([0, 1, 2]), U16, 'SCALAR', 3);
  json.meshes.push(
    { name: 'probe_body', primitives: [{ attributes: { POSITION: pos, JOINTS_0: joints, WEIGHTS_0: weights }, indices: idx, material: 0 }] },
    { name: 'crate_box', primitives: [{ attributes: { POSITION: rigidPos }, indices: rigidIdx, material: 0 }] }
  );
  // nodes: 0 Monster_probe, 1 Monster_crate, 2 probe_Torso, 3 probe_LeftArmPivot, 4 probe_body, 5 crate_HeadGroup, 6 crate_box
  json.nodes.push(
    { name: 'Monster_probe', children: [2, 4], ...rootNode },
    { name: 'Monster_crate', translation: [6, 0, 2], children: [5, 6] },
    { name: 'probe_Torso', translation: [0, 0.5, 0], children: [3] },
    { name: 'probe_LeftArmPivot', translation: [-0.3, 0.4, 0] },
    { name: 'probe_body', mesh: 0, skin: 0 },
    { name: 'crate_HeadGroup', translation: [0, 0.8, 0] },
    { name: 'crate_box', mesh: 1 }
  );
  json.skins = [{ joints: [2, 3], inverseBindMatrices: ibmAcc, skeleton: 2 }];
  json.animations.push({
    name: 'Wave',
    samplers: [{ input: times, output: torsoRot, interpolation: 'LINEAR' }, { input: times, output: armRot, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 2, path: 'rotation' } }, { sampler: 1, target: { node: 3, path: 'rotation' } }]
  });
  json.buffers = [{ byteLength: len }];
  return { json, bin: Buffer.concat(parts) };
}

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const parse = (bytes: ArrayBuffer): Promise<GLTF> => new Promise((resolve, reject) => new GLTFLoader().parse(bytes, '', resolve, reject));
const loadPair = () => parse(toArrayBuffer(fs.readFileSync(FIXTURE)));
const loadVariant = (rootNode: Partial<GltfNode>) => parse(toArrayBuffer(packGlb(buildPair(rootNode))));

function entity(key: string): MonsterEntityLike {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh();
  group.add(hitbox);
  return { typeKey: key, def: { bodyColor: 0x65a30d }, rig: { group, hitbox }, pos: new THREE.Vector3() };
}

function skinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && !m.userData.isOutline) out.push(m);
  });
  return out;
}
const shellOf = (mesh: THREE.Object3D) => mesh.children.find((c) => c.userData.isOutline) as THREE.SkinnedMesh | undefined;

/** An upgraded skinned instance, its one skinned mesh, and the vertex reader. */
async function skinnedInstance(gltf: GLTF) {
  const e = entity('probe');
  expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(true);
  e.rig.group.updateMatrixWorld(true);
  const mesh = skinnedMeshes(e.rig.group)[0];
  expect(mesh, 'the upgraded figure has a skinned mesh').toBeDefined();
  const vertex = (i: number) => {
    e.rig.group.updateMatrixWorld(true);
    mesh.skeleton.update();
    return mesh.getVertexPosition(i, new THREE.Vector3());
  };
  return { e, mesh, vertex };
}

beforeAll(() => {
  const bytes = packGlb(buildPair());
  expect(bytes.length, 'the fixture stays under 8 kB').toBeLessThan(8 * 1024);
  fs.writeFileSync(FIXTURE, bytes);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the skinned path (S0; red until S1b)', () => {
  it('the fixture holds one skinned and one rigid figure, and hasSkin tells them apart', async () => {
    const gltf = await loadPair();
    expect(hasSkin(gltf.scene.getObjectByName('Monster_probe')!)).toBe(true);
    expect(hasSkin(gltf.scene.getObjectByName('Monster_crate')!)).toBe(false);
  });

  it('two instances cloned from one template pose independently and the template stays at rest', async () => {
    const gltf = await loadPair();
    const template = gltf.scene.getObjectByName('Monster_probe')!;
    const a = await skinnedInstance(gltf);
    const b = await skinnedInstance(gltf);
    const rest = a.vertex(ARM_VERTEX).clone();
    expect(b.vertex(ARM_VERTEX).distanceTo(rest)).toBeLessThan(1e-5);

    a.e.rig.leftArmPivot!.rotation.x = 1;
    expect(a.vertex(ARM_VERTEX).distanceTo(rest)).toBeGreaterThan(0.1);
    expect(b.vertex(ARM_VERTEX).distanceTo(rest)).toBeLessThan(1e-5);
    expect(b.e.rig.leftArmPivot!.rotation.x).toBe(0);

    template.updateMatrixWorld(true);
    const tMesh = skinnedMeshes(template)[0];
    tMesh.skeleton.update();
    expect(tMesh.getVertexPosition(ARM_VERTEX, new THREE.Vector3()).distanceTo(rest)).toBeLessThan(1e-5);
    for (const bone of tMesh.skeleton.bones) expect(bone.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
    expect(a.mesh.skeleton).not.toBe(tMesh.skeleton);
    expect(a.mesh.skeleton.bones.every((bone) => !tMesh.skeleton.bones.includes(bone))).toBe(true);
  });

  it('bone names lose the node key\'s prefix on the clone', async () => {
    const gltf = await loadPair();
    const { e, mesh } = await skinnedInstance(gltf);
    expect(mesh.skeleton.bones.map((b) => b.name).sort()).toEqual(['LeftArmPivot', 'Torso']);
    expect(e.rig.group.getObjectByName('probe_Torso')).toBeUndefined();
    expect(e.rig.group.getObjectByName('Torso')).toBe(mesh.skeleton.bones.find((b) => b.name === 'Torso'));
    // the template keeps its own names: the strip happens on the clone
    expect(gltf.scene.getObjectByName('probe_Torso')).toBeDefined();
  });

  it('every pivot field the upgrade fills is a Bone', async () => {
    const gltf = await loadPair();
    const { e, mesh } = await skinnedInstance(gltf);
    const filled = (['headGroup', 'leftArmPivot', 'rightArmPivot', 'leftLegPivot', 'rightLegPivot', 'lWing', 'rWing'] as const)
      .map((k) => [k, e.rig[k]] as const)
      .filter(([, v]) => v);
    expect(filled.map(([k]) => k)).toContain('leftArmPivot');
    for (const [k, v] of filled) {
      expect((v as THREE.Bone).isBone, k).toBe(true);
      expect(mesh.skeleton.bones, `${k} is a bone of this instance's own skeleton`).toContain(v);
    }
  });

  it('the outline shell of a skinned mesh is a SkinnedMesh on the same skeleton and uses the skinned outline material', async () => {
    const gltf = await loadPair();
    const { mesh } = await skinnedInstance(gltf);
    const shell = shellOf(mesh)!;
    expect(shell, 'the skinned mesh has an outline shell').toBeDefined();
    expect(shell.isSkinnedMesh).toBe(true);
    expect(shell.skeleton).toBe(mesh.skeleton);
    expect(shell.bindMatrix.equals(mesh.bindMatrix)).toBe(true);
    expect(shell.geometry).toBe(mesh.geometry);
    const mat = shell.material as THREE.ShaderMaterial;
    expect(isSharedOutlineMaterial(mat)).toBe(true);
    for (const chunk of ['skinning_pars_vertex', 'skinbase_vertex', 'skinnormal_vertex', 'begin_vertex', 'skinning_vertex']) {
      expect(mat.vertexShader, chunk).toContain(`#include <${chunk}>`);
    }
    expect(mat.vertexShader).toContain('transformed');
    expect(mat.vertexShader).toContain('objectNormal');
  });

  it('a plain mesh still gets today\'s shell and today\'s outline material', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial());
    const root = new THREE.Group();
    root.add(mesh);
    addCartoonOutline(root, 0.022);
    const shell = shellOf(mesh) as THREE.Mesh;
    expect(shell).toBeDefined();
    expect((shell as unknown as THREE.SkinnedMesh).isSkinnedMesh).toBeUndefined();
    expect(shell.geometry).toBe(geo);
    const mat = shell.material as THREE.ShaderMaterial;
    expect(isSharedOutlineMaterial(mat)).toBe(true);
    expect(mat.vertexShader).not.toContain('skinning_vertex');
    expect(mat.vertexShader).toContain('modelViewMatrix * vec4(position, 1.0)');
    expect(geo.boundingSphere!.radius).toBeCloseTo(Math.sqrt(3) / 2 + 0.022 * 1.5 + 0.05, 5); // inflated once, in place
  });

  it('the skinned outline material is shared and never disposed', async () => {
    const gltf = await loadPair();
    const a = await skinnedInstance(gltf);
    const b = await skinnedInstance(gltf);
    const matA = shellOf(a.mesh)!.material as THREE.ShaderMaterial;
    const matB = shellOf(b.mesh)!.material as THREE.ShaderMaterial;
    expect(matA).toBe(matB);
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
    addCartoonOutline(plain, 0.022);
    expect(shellOf(plain)!.material).not.toBe(matA);
    const dispose = vi.spyOn(matA, 'dispose');
    disposeObject3D(a.e.rig.group);
    expect(dispose).not.toHaveBeenCalled();
    expect(isSharedOutlineMaterial(matA)).toBe(true);
  });

  it('each skinned mesh has a fixed boundingSphere of at least 1.5 times its rest radius, unchanged after a pose', async () => {
    const gltf = await loadPair();
    const rest = new THREE.BufferGeometry();
    rest.setAttribute('position', new THREE.Float32BufferAttribute(VERTS.flat(), 3));
    rest.computeBoundingSphere();
    const restRadius = rest.boundingSphere!.radius;

    const { e, mesh } = await skinnedInstance(gltf);
    const before = mesh.boundingSphere!;
    expect(before, 'set on the template, copied by the clone').not.toBeNull();
    const centre = before.center.clone();
    const radius = before.radius;
    expect(radius).toBeGreaterThanOrEqual(1.5 * restRadius - 1e-6);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 1, 5);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    e.rig.leftArmPivot!.rotation.x = 1.2;
    e.rig.group.updateMatrixWorld(true);
    mesh.skeleton.update();
    frustum.intersectsObject(mesh);
    expect(mesh.boundingSphere!.radius).toBe(radius);
    expect(mesh.boundingSphere!.center.distanceTo(centre)).toBe(0);

    // fixCullSpheres on a template does the same, and its factor argument defaults to 1.5
    const template = gltf.scene.getObjectByName('Monster_probe')!;
    fixCullSpheres(template);
    expect(skinnedMeshes(template)[0].boundingSphere!.radius).toBeGreaterThanOrEqual(1.5 * restRadius - 1e-6);
  });

  it('disposeObject3D calls dispose on each skeleton once', async () => {
    const gltf = await loadPair();
    const { e, mesh } = await skinnedInstance(gltf);
    expect(shellOf(mesh)!.skeleton).toBe(mesh.skeleton); // mesh and shell share it: still one call
    const spy = vi.spyOn(mesh.skeleton, 'dispose');
    disposeObject3D(e.rig.group);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('the rigid figure in the same file is refused with a console warning', async () => {
    const gltf = await loadPair();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const e = entity('crate');
    const before = [...e.rig.group.children];
    expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('crate');
    expect(e.rig.group.children).toEqual(before);
    expect(e.rig.group.userData.isBlenderMonster).toBeUndefined();
  });

  it('writing rotation.x on a bone moves a vertex weighted to it', async () => {
    const gltf = await loadPair();
    const { e, vertex } = await skinnedInstance(gltf);
    const armRest = vertex(ARM_VERTEX).clone();
    const torsoRest = vertex(TORSO_VERTEX).clone();
    expect(armRest.toArray()).toEqual(VERTS[ARM_VERTEX].map((v) => expect.closeTo(v, 5)));
    e.rig.leftArmPivot!.rotation.x = 0.8;
    const moved = vertex(ARM_VERTEX);
    expect(moved.distanceTo(armRest)).toBeGreaterThan(0.1);
    expect(moved.x).toBeCloseTo(armRest.x, 5); // a turn about x keeps x
    expect(vertex(TORSO_VERTEX).distanceTo(torsoRest)).toBeLessThan(1e-5);
  });

  it.each([
    ['moved', { translation: [6, 0, 2] }],
    ['turned', { rotation: [0, Math.sin(0.4), 0, Math.cos(0.4)] }],
    ['scaled', { scale: [2, 2, 2] }]
  ])('a skinned Monster_ node with a non-identity transform is refused with a warning and takes no path (%s)', async (_label, node) => {
    const gltf = await loadVariant(node as Partial<GltfNode>);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const e = entity('probe');
    const before = [...e.rig.group.children];
    expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('probe');
    expect(e.rig.group.children).toEqual(before);
    expect(e.rig.group.userData.isBlenderMonster).toBeUndefined();
    expect(e.rig.leftArmPivot).toBeFalsy();
  });

  it('adding an outline to a posed instance leaves a second instance\'s vertices unmoved and the template\'s boneInverses unchanged', async () => {
    const gltf = await loadPair();
    const template = gltf.scene.getObjectByName('Monster_probe')!;
    const tMesh = skinnedMeshes(template)[0];
    const inversesBefore = tMesh.skeleton.boneInverses.map((m) => m.toArray());
    const a = await skinnedInstance(gltf);
    const b = await skinnedInstance(gltf);
    const bRest = VERTS.map((_, i) => b.vertex(i).clone());

    a.e.rig.leftArmPivot!.rotation.x = 1;
    a.e.rig.leftArmPivot!.position.y += 0.2;
    const posed = a.vertex(ARM_VERTEX).clone();
    // a gear change re-runs addCartoonOutline mid-animation: drop the shell, add it again
    const old = shellOf(a.mesh)!;
    a.mesh.remove(old);
    addCartoonOutline(a.e.rig.group, 0.022);
    const shell = shellOf(a.mesh)!;
    expect(shell).toBeDefined();
    expect(shell).not.toBe(old);
    expect(shell.skeleton).toBe(a.mesh.skeleton);
    expect(shell.bindMatrix.equals(a.mesh.bindMatrix)).toBe(true);

    bRest.forEach((v, i) => expect(b.vertex(i).distanceTo(v), `b vertex ${i}`).toBeLessThan(1e-5));
    expect(b.mesh.skeleton.boneInverses.map((m) => m.toArray())).toEqual(inversesBefore);
    expect(tMesh.skeleton.boneInverses.map((m) => m.toArray())).toEqual(inversesBefore);
    expect(a.mesh.skeleton.boneInverses.map((m) => m.toArray())).toEqual(inversesBefore);
    expect(a.vertex(ARM_VERTEX).distanceTo(posed)).toBeLessThan(1e-5); // the posed instance did not snap back either
  });

  it('a skinned shell has its own boundingSphere, at least its mesh\'s plus the outline margin', async () => {
    const gltf = await loadPair();
    const { e, mesh } = await skinnedInstance(gltf);
    const shell = shellOf(mesh)!;
    expect(shell.boundingSphere, 'frustum culling reads the object\'s sphere, not the geometry\'s').not.toBeNull();
    expect(shell.boundingSphere).not.toBe(mesh.boundingSphere);
    const margin = 0.022 * 1.5 + 0.05; // today's rigid margin for the same thickness
    expect(shell.boundingSphere!.radius).toBeGreaterThanOrEqual(mesh.boundingSphere!.radius + margin - 1e-6);
    expect(shell.boundingSphere!.center.distanceTo(mesh.boundingSphere!.center)).toBeLessThan(1e-6);
    const radius = shell.boundingSphere!.radius;
    e.rig.leftArmPivot!.rotation.x = 1;
    e.rig.group.updateMatrixWorld(true);
    expect(shell.boundingSphere!.radius).toBe(radius);
  });

  it('a clip whose tracks carry the node key\'s prefix, stripped once by stripClipPrefix, drives the stripped bones', async () => {
    const gltf = await loadPair();
    expect(gltf.animations[0].tracks.map((t) => t.name)).toEqual(['probe_Torso.quaternion', 'probe_LeftArmPivot.quaternion']);

    // control: the unstripped clip finds no bone on the stripped instance
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const control = await skinnedInstance(await loadPair());
    const controlMixer = new THREE.AnimationMixer(control.e.rig.group);
    controlMixer.clipAction((await loadPair()).animations[0]).play();
    controlMixer.update(0.5);
    expect(control.e.rig.leftArmPivot!.quaternion.angleTo(new THREE.Quaternion())).toBe(0);

    // `clips` may be changed in place or returned: read whichever the function gives
    const result: unknown = stripClipPrefix(gltf.animations, 'probe');
    const stripped = (Array.isArray(result) ? result : gltf.animations) as THREE.AnimationClip[];
    expect(stripped[0].tracks.map((t) => t.name)).toEqual(['Torso.quaternion', 'LeftArmPivot.quaternion']);
    const again: unknown = stripClipPrefix(stripped, 'probe'); // once per library: a second call changes nothing
    expect(((Array.isArray(again) ? again : stripped) as THREE.AnimationClip[])[0].tracks.map((t) => t.name)).toEqual(['Torso.quaternion', 'LeftArmPivot.quaternion']);

    const { e, vertex } = await skinnedInstance(gltf);
    const rest = vertex(ARM_VERTEX).clone();
    const mixer = new THREE.AnimationMixer(e.rig.group);
    mixer.clipAction(stripped[0]).play();
    mixer.update(0.5);
    expect(e.rig.leftArmPivot!.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0.5, 3);
    expect(vertex(ARM_VERTEX).distanceTo(rest)).toBeGreaterThan(0.1);
  });
});
