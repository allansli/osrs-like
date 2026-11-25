// Q1: the 8-bit attribute step of the promote script (design 3.5 S10, 9.2; decision N-3), written before it exists.
// Red until `scripts/lib/glb-pack.mjs` exists: the import below fails (the allowed red window, rule 0.3.4).
// Contract: `packGlb(buffer: Buffer): Buffer` returns a new GLB with
//   NORMAL -> normalised signed bytes, WEIGHTS_n -> normalised unsigned bytes (each vertex's four sum to 255),
//   COLOR_n -> normalised unsigned bytes, `KHR_mesh_quantization` in extensionsUsed and extensionsRequired
//   (only when something was packed), everything else (POSITION, JOINTS, indices, UVs, animation, skins) untouched.
// Fixtures: `tests/fixtures/models/monsters-float.glb` (a committed copy of the unpacked, float monsters.glb: skinned, COLOR_0, so the
// conversion stays testable after the pilot is promoted through the pack step) and the shipped `gear.glb` (rigid, no colour; Q1 never packs it).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = path.resolve(__dirname, '..');
const I8 = 5120;
const U8 = 5121;

type Json = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  skins?: unknown[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  accessors: { componentType: number; normalized?: boolean; count: number }[];
  animations?: { samplers: { input: number; output: number }[] }[];
};
type Doc = { json: Json; bin: Buffer };
type ReadGlb = (b: Buffer | string) => Doc;
type ReadAccessor = (doc: Doc, i: number) => ArrayLike<number>;

const mod = (name: string) => import(/* @vite-ignore */ pathToFileURL(path.join(ROOT, 'scripts', 'lib', name)).href);
const { readGlb, readAccessor } = (await mod('glb.mjs')) as { readGlb: ReadGlb; readAccessor: ReadAccessor };
const { packGlb } = (await mod('glb-pack.mjs')) as { packGlb: (b: Buffer) => Buffer };

const fixture = (name: string) => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'models', name));
const shipped = (name: string) => fs.readFileSync(path.join(ROOT, 'public', 'models', name));
const parse = (b: Buffer): Promise<GLTF> =>
  new Promise((resolve, reject) =>
    new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', resolve, reject)
  );

/** Every (attribute name, accessor index) pair of every primitive, in file order. */
const attrs = (d: Doc) =>
  d.json.meshes.flatMap((m, mi) =>
    m.primitives.flatMap((p, pi) => Object.entries(p.attributes).map(([name, acc]) => ({ mi, pi, name, acc })))
  );
const sameArray = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.prototype.every.call(a, (v, i) => v === b[i]);

let monsters: Buffer;
let monstersPacked: Buffer;
let rigid: Buffer;
let rigidPacked: Buffer;
beforeAll(() => {
  monsters = fixture('monsters-float.glb');
  monstersPacked = packGlb(monsters);
  rigid = shipped('gear.glb');
  rigidPacked = packGlb(rigid);
});

describe('the 8-bit attribute step (Q1)', () => {
  it('normals become normalised signed bytes and the file lists KHR_mesh_quantization as used and required', () => {
    for (const buf of [monstersPacked, rigidPacked]) {
      const d = readGlb(buf);
      const normals = attrs(d).filter((a) => a.name === 'NORMAL');
      expect(normals.length).toBeGreaterThan(0);
      for (const n of normals) {
        expect(d.json.accessors[n.acc].componentType).toBe(I8);
        expect(d.json.accessors[n.acc].normalized).toBe(true);
      }
      expect(d.json.extensionsUsed).toContain('KHR_mesh_quantization');
      expect(d.json.extensionsRequired).toContain('KHR_mesh_quantization');
    }
  });

  it("weights and colours become normalised unsigned bytes and each vertex's weights still sum to 255", () => {
    const d = readGlb(monstersPacked);
    const packed = attrs(d).filter((a) => /^(WEIGHTS|COLOR)_\d+$/.test(a.name));
    expect(packed.some((a) => a.name === 'WEIGHTS_0')).toBe(true);
    expect(packed.some((a) => a.name === 'COLOR_0')).toBe(true);
    for (const a of packed) {
      expect(d.json.accessors[a.acc].componentType, a.name).toBe(U8);
      expect(d.json.accessors[a.acc].normalized, a.name).toBe(true);
    }
    for (const a of packed.filter((p) => p.name.startsWith('WEIGHTS'))) {
      const w = readAccessor(d, a.acc); // normalised bytes read back as v / 255
      for (let v = 0; v < d.json.accessors[a.acc].count; v++) {
        const sum = Math.round(255 * (w[4 * v] + w[4 * v + 1] + w[4 * v + 2] + w[4 * v + 3]));
        if (sum !== 255) expect(sum, `mesh ${a.mi} vertex ${v}`).toBe(255);
      }
    }
  });

  it('positions, joints, indices and animation data are byte-identical', () => {
    for (const [before, after] of [[monsters, monstersPacked], [rigid, rigidPacked]]) {
      const a = readGlb(before);
      const b = readGlb(after);
      expect(b.json.meshes.length).toBe(a.json.meshes.length);
      expect(b.json.skins?.length).toBe(a.json.skins?.length);
      const check = (i: number, j: number, what: string) => {
        expect(b.json.accessors[j].componentType, what).toBe(a.json.accessors[i].componentType);
        expect(sameArray(readAccessor(a, i), readAccessor(b, j)), what).toBe(true);
      };
      const A = attrs(a);
      const B = attrs(b);
      expect(B.map((x) => x.name)).toEqual(A.map((x) => x.name));
      A.forEach((x, k) => {
        if (/^(POSITION|JOINTS_\d+|TEXCOORD_\d+)$/.test(x.name)) check(x.acc, B[k].acc, `${x.name} of mesh ${x.mi}`);
      });
      a.json.meshes.forEach((m, mi) =>
        m.primitives.forEach((p, pi) => {
          if (p.indices !== undefined) check(p.indices, b.json.meshes[mi].primitives[pi].indices!, `indices of mesh ${mi}`);
        })
      );
      (a.json.animations ?? []).forEach((an, ai) =>
        an.samplers.forEach((s, si) => {
          const t = b.json.animations![ai].samplers[si];
          check(s.input, t.input, `animation ${ai} input`);
          check(s.output, t.output, `animation ${ai} output`);
        })
      );
    }
  });

  it('the bare GLTFLoader parses the packed file', async () => {
    const before = await parse(monsters);
    const after = await parse(monstersPacked);
    const count = (g: GLTF) => {
      let skinned = 0;
      let meshes = 0;
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++;
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++;
      });
      return { skinned, meshes, clips: g.animations.length };
    };
    expect(count(after).skinned).toBeGreaterThan(0);
    expect(count(after)).toEqual(count(before));
    after.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) expect(m.geometry.getAttribute('normal').normalized).toBe(true);
    });
  });

  it("every posed vertex of the packed fixture is within 0.001 of the unpacked one", async () => {
    const skinnedOf = async (b: Buffer) => {
      const g = await parse(b);
      const list: THREE.SkinnedMesh[] = [];
      g.scene.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) list.push(o as THREE.SkinnedMesh);
      });
      // The same pose on both: every bone turned by a different fixed amount about x, then z. Each shared skeleton once.
      new Set(list.map((sm) => sm.skeleton)).forEach((sk) =>
        sk.bones.forEach((bone, i) => {
          bone.rotation.x += 0.4 + 0.07 * (i % 5);
          bone.rotation.z += 0.2 - 0.05 * (i % 3);
        })
      );
      // The bones are siblings of the skinned meshes, so the whole scene's world matrices must be updated.
      g.scene.updateMatrixWorld(true);
      list.forEach((sm) => sm.skeleton.update());
      return list;
    };
    const A = await skinnedOf(monsters);
    const B = await skinnedOf(monstersPacked);
    expect(B.length).toBe(A.length);
    expect(A.length).toBeGreaterThan(0);
    let worst = 0;
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    A.forEach((sm, k) => {
      const n = sm.geometry.getAttribute('position').count;
      expect(B[k].geometry.getAttribute('position').count).toBe(n);
      for (let v = 0; v < n; v++) {
        sm.getVertexPosition(v, pa);
        B[k].getVertexPosition(v, pb);
        worst = Math.max(worst, pa.distanceTo(pb));
      }
    });
    expect(worst).toBeLessThan(0.001);
  });

  it('a file with no skin and no colour only has its normals packed', () => {
    const a = readGlb(rigid);
    const b = readGlb(rigidPacked);
    expect(a.json.skins).toBeUndefined();
    expect(attrs(a).some((x) => /^(WEIGHTS|JOINTS|COLOR)_/.test(x.name))).toBe(false);
    attrs(b).forEach((x) => {
      const acc = b.json.accessors[x.acc];
      if (x.name === 'NORMAL') expect(acc.componentType).toBe(I8);
      else expect(acc.componentType, x.name).toBe(a.json.accessors[attrs(a).find((y) => y.mi === x.mi && y.pi === x.pi && y.name === x.name)!.acc].componentType);
    });
  });

  it('a NORMAL interleaved with POSITION in one bufferView is refused, not replaced', () => {
    // One triangle, POSITION and NORMAL interleaved in one view (stride 24): valid glTF that packing the view whole would corrupt.
    const bin = Buffer.alloc(3 * 24);
    [[0, 0, 0], [1, 0, 0], [0, 1, 0]].forEach((p, i) => p.forEach((v, k) => { bin.writeFloatLE(v, i * 24 + k * 4); bin.writeFloatLE(k === 2 ? 1 : 0, i * 24 + 12 + k * 4); }));
    const json = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: bin.length }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length, byteStride: 24 }],
      accessors: [
        { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 0, byteOffset: 12, componentType: 5126, count: 3, type: 'VEC3' },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] }],
    };
    let js = Buffer.from(JSON.stringify(json));
    js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    const head = Buffer.alloc(12);
    head.writeUInt32LE(0x46546c67, 0);
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
    const chunk = (len: number, type: number) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
    const glb = Buffer.concat([head, chunk(js.length, 0x4e4f534a), js, chunk(bin.length, 0x004e4942), bin]);
    const copy = Buffer.from(glb);
    expect(() => packGlb(glb)).toThrow(/shares bufferView 0/);
    expect(glb.equals(copy)).toBe(true);
  });

  it('packing twice changes nothing', () => {
    expect(packGlb(monstersPacked).equals(monstersPacked)).toBe(true);
    expect(packGlb(rigidPacked).equals(rigidPacked)).toBe(true);
  });
});
