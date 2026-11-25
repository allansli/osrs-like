// S1e: a painted skinned figure takes the `cut` shade (design 6.1, plan "After OM-P").
// Red until the [AGY] part lands: `upgradeMonsterRigWithGltf` does not yet add `shade: 'cut'` for a
// SkinnedMesh with a `color` attribute, so the painted skinned meshes have no FACET_CUT define.
// The fixture is built in memory (no file): one skinned figure `Monster_cutter` holding three painted
// skinned meshes (materials skin, cloth, glow, so three branches of the material step), one unpainted
// skinned mesh, and one painted rigid mesh.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../src/engine/blenderMonsters';
import { packGlb, type Doc } from './fixtures/models/tinyGlb';

const F32 = 5126;
const U16 = 5123;
const U8 = 5121;

function buildFigure(): Doc {
  const parts: Buffer[] = [];
  let len = 0;
  // tinyGlb's material type has no emissiveFactor: widen it locally (a non-fresh value passes the assignment).
  const materials: Array<Doc['json']['materials'][number] & { emissiveFactor?: number[] }> = [
    { name: 'skin', pbrMetallicRoughness: { baseColorFactor: [0.4, 0.6, 0.3, 1] } },
    { name: 'cloth', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.3, 0.2, 1] } },
    { name: 'glow', pbrMetallicRoughness: { baseColorFactor: [0.9, 0.8, 0.1, 1] }, emissiveFactor: [0.9, 0.8, 0.1] }
  ];
  const json: Doc['json'] = {
    asset: { version: '2.0', generator: 'skinned-cut-shade-fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    meshes: [],
    materials,
    accessors: [],
    bufferViews: [],
    animations: []
  };
  const acc = (data: ArrayBufferView, componentType: number, type: string, count: number, minmax?: [number[], number[]], normalized = false) => {
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4);
    raw.copy(padded);
    json.bufferViews.push({ buffer: 0, byteOffset: len, byteLength: raw.length });
    parts.push(padded);
    len += padded.length;
    json.accessors.push({
      bufferView: json.bufferViews.length - 1,
      componentType,
      count,
      type,
      ...(normalized ? { normalized: true } : {}),
      ...(minmax ? { min: minmax[0], max: minmax[1] } : {})
    } as never);
    return json.accessors.length - 1;
  };
  const pos = acc(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), F32, 'VEC3', 3, [[0, 0, 0], [1, 1, 0]]);
  const idx = acc(new Uint16Array([0, 1, 2]), U16, 'SCALAR', 3);
  const joints = acc(new Uint8Array(12), U8, 'VEC4', 3);
  const weights = acc(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), F32, 'VEC4', 3);
  const colour = acc(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]), F32, 'VEC3', 3);
  const ibm = acc(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), F32, 'MAT4', 1);
  const skinned = { POSITION: pos, JOINTS_0: joints, WEIGHTS_0: weights };
  const prim = (attributes: Record<string, number>, material: number) => ({ attributes, indices: idx, material });
  json.meshes.push(
    { name: 'painted_skin', primitives: [prim({ ...skinned, COLOR_0: colour }, 0)] },
    { name: 'painted_cloth', primitives: [prim({ ...skinned, COLOR_0: colour }, 1)] },
    { name: 'painted_glow', primitives: [prim({ ...skinned, COLOR_0: colour }, 2)] },
    { name: 'plain_skin', primitives: [prim(skinned, 0)] },
    { name: 'rigid_painted', primitives: [prim({ POSITION: pos, COLOR_0: colour }, 0)] }
  );
  // nodes: 0 root, 1 bone, 2..6 the five meshes
  json.nodes.push(
    { name: 'Monster_cutter', children: [1, 2, 3, 4, 5, 6] },
    { name: 'cutter_Torso' },
    { name: 'painted_skin', mesh: 0, skin: 0 },
    { name: 'painted_cloth', mesh: 1, skin: 0 },
    { name: 'painted_glow', mesh: 2, skin: 0 },
    { name: 'plain_skin', mesh: 3, skin: 0 },
    { name: 'rigid_painted', mesh: 4 }
  );
  json.skins = [{ joints: [1], inverseBindMatrices: ibm, skeleton: 1 }];
  json.buffers = [{ byteLength: len }];
  return { json, bin: Buffer.concat(parts) };
}

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const parse = (bytes: ArrayBuffer): Promise<GLTF> => new Promise((resolve, reject) => new GLTFLoader().parse(bytes, '', resolve, reject));

async function upgraded(): Promise<Map<string, THREE.Mesh>> {
  const gltf = await parse(toArrayBuffer(packGlb(buildFigure())));
  const group = new THREE.Group();
  const e: MonsterEntityLike = { typeKey: 'cutter', def: { bodyColor: 0x65a30d }, rig: { group, hitbox: new THREE.Mesh() }, pos: new THREE.Vector3() };
  expect(upgradeMonsterRigWithGltf(e, gltf)).toBe(true);
  const out = new Map<string, THREE.Mesh>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.isOutline) out.set(m.name, m);
  });
  return out;
}

const mat = (m: THREE.Mesh) => m.material as THREE.MeshLambertMaterial;

describe('a painted skinned mesh takes the cut shade (S1e; red until the engine passes shade: cut)', () => {
  it('every material of a painted skinned mesh has FACET_CUT and flat shading, whatever its family', async () => {
    const meshes = await upgraded();
    for (const name of ['painted_skin', 'painted_cloth', 'painted_glow']) {
      const m = meshes.get(name)!;
      expect(m, name).toBeDefined();
      expect((m as THREE.SkinnedMesh).isSkinnedMesh, `${name} is skinned`).toBe(true);
      expect(mat(m).defines, name).toHaveProperty('FACET_CUT');
      expect(mat(m).flatShading, name).toBe(true);
      expect(mat(m).vertexColors, `${name} keeps its paint`).toBe(true);
    }
  });

  it('an unpainted skinned mesh keeps the round shade', async () => {
    const m = (await upgraded()).get('plain_skin')!;
    expect((m as THREE.SkinnedMesh).isSkinnedMesh).toBe(true);
    expect(mat(m).defines ?? {}).not.toHaveProperty('FACET_CUT');
    expect(mat(m).flatShading).toBe(false);
  });

  it('a painted rigid mesh keeps the round shade', async () => {
    const m = (await upgraded()).get('rigid_painted')!;
    expect((m as THREE.SkinnedMesh).isSkinnedMesh).toBeFalsy();
    expect(mat(m).vertexColors).toBe(true);
    expect(mat(m).defines ?? {}).not.toHaveProperty('FACET_CUT');
    expect(mat(m).flatShading).toBe(false);
  });
});
