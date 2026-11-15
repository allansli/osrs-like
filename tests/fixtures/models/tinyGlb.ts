// Tiny hand-made GLBs and their manifests, written by code so no binary is committed.
// Used by tests/model-pipeline.test.ts. Every file stays under 4 kB.
//
// MANIFEST SCHEMA (the contract scripts/models-compare.mjs must read; P3 builds to it, P4 writes real ones):
//   nodes:       { <node name>: { parent: <node name> | null, translation: [x,y,z], scale: [x,y,z] } }
//                translation within 0.0001, scale within 0.0001; parent by name
//   materials:   [material names]  (exact set)
//   toggled:     [node or mesh names the engine hides by]  (each must exist as a node name or a mesh name)
//   vertexColor: 'all' | 'none'    (COLOR_0 on every mesh primitive or on none; a mix always fails)
//   clips:       { <clip name>: { moves: [node names the clip has a channel for] } }
//   skin?:       { skeleton, bones: { <bone>: { parent: <bone> | null, translation } }, skinnedRoots: [node names],
//                  sharedClips: [clip names], limbs: [{ bone, child, direction: [x,y,z] }], maxLimbDegrees: number }
//   budget:      { triangles, meshes, materials, rawBytes, brotliBytes }  (ceilings; equal passes, over fails)
export type GltfNode = { name: string; translation?: number[]; rotation?: number[]; scale?: number[]; mesh?: number; skin?: number; extras?: Record<string, unknown>; children?: number[] };
export type GltfAccessor = { bufferView: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] };
export type GltfPrimitive = { attributes: Record<string, number>; indices: number; material: number };
export type GltfAnimation = { name: string; samplers: { input: number; output: number; interpolation: string }[]; channels: { sampler: number; target: { node: number; path: string } }[] };
export type GltfJson = {
  asset: { version: string; generator: string };
  scene: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { name: string; primitives: GltfPrimitive[] }[];
  materials: { name: string; pbrMetallicRoughness: { baseColorFactor: number[] } }[];
  accessors: GltfAccessor[];
  bufferViews: { buffer: number; byteOffset: number; byteLength: number }[];
  animations: GltfAnimation[];
  buffers?: { byteLength: number }[];
  skins?: { joints: number[]; inverseBindMatrices: number; skeleton: number }[];
};
/** The manifest shape documented at the top of this file. */
export type Manifest = {
  nodes: Record<string, { parent: string | null; translation: number[]; scale: number[] }>;
  materials: string[];
  toggled: string[];
  vertexColor: string;
  clips: Record<string, { moves: string[] }>;
  skin?: {
    skeleton: string;
    bones: Record<string, { parent: string | null; translation: number[] }>;
    skinnedRoots: string[];
    sharedClips: string[];
    limbs: { bone: string; child: string; direction: number[] }[];
    maxLimbDegrees: number;
  };
  budget: { triangles: number; meshes: number; materials: number; rawBytes: number; brotliBytes: number };
};
export type Doc = { json: GltfJson; bin: Buffer };

type Vec3 = [number, number, number];
type NodeOpts = { t?: Vec3; r?: number[]; s?: Vec3; mesh?: number; skin?: number; extras?: Record<string, unknown> };

const F32 = 5126;
const U16 = 5123;
const U8 = 5121;

class Builder {
  json: GltfJson = { asset: { version: '2.0', generator: 'tiny-fixture' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], animations: [] };
  parts: Buffer[] = [];
  len = 0;
  index = new Map<string, number>();

  accessor(data: Float32Array | Uint16Array | Uint8Array, componentType: number, type: string, count: number, minmax = false): number {
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4);
    raw.copy(padded);
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.len, byteLength: raw.length });
    this.parts.push(padded);
    this.len += padded.length;
    const acc: GltfAccessor = { bufferView: this.json.bufferViews.length - 1, componentType, count, type };
    if (minmax) {
      const f = data as Float32Array;
      acc.min = [0, 0, 0].map((_, k) => Math.min(...Array.from({ length: count }, (_, v) => f[v * 3 + k])));
      acc.max = [0, 0, 0].map((_, k) => Math.max(...Array.from({ length: count }, (_, v) => f[v * 3 + k])));
    }
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }

  node(name: string, parent: string | null, o: NodeOpts = {}): number {
    const n: GltfNode = { name };
    if (o.t) n.translation = o.t;
    if (o.r) n.rotation = o.r;
    if (o.s) n.scale = o.s;
    if (o.mesh !== undefined) n.mesh = o.mesh;
    if (o.skin !== undefined) n.skin = o.skin;
    if (o.extras) n.extras = o.extras;
    const i = this.json.nodes.push(n) - 1;
    this.index.set(name, i);
    if (parent !== null) {
      const p = this.json.nodes[this.index.get(parent)!];
      (p.children ??= []).push(i);
    }
    return i;
  }

  clip(name: string, channels: { node: string; path: 'rotation' | 'translation'; output: number }[], input: number) {
    const samplers: GltfAnimation['samplers'] = [];
    const chans: GltfAnimation['channels'] = [];
    for (const c of channels) {
      samplers.push({ input, output: c.output, interpolation: 'LINEAR' });
      chans.push({ sampler: samplers.length - 1, target: { node: this.index.get(c.node)!, path: c.path } });
    }
    this.json.animations.push({ name, samplers, channels: chans });
  }

  done(): Doc {
    this.json.buffers = [{ byteLength: this.len }];
    return { json: this.json, bin: Buffer.concat(this.parts) };
  }
}

const POS = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const IDX = new Uint16Array([0, 1, 2]);
const COL = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const TIMES = new Float32Array([0, 1]);
const QUATS = new Float32Array([0, 0, 0, 1, 0.1, 0, 0, 0.995]);
const MOVES = new Float32Array([0, 0.9, 0, 0, 0.95, 0]);

/** A static figure: 6 mesh nodes of one triangle, 2 materials, 2 clips, no skin. */
export function buildTiny(o: { colorMeshes?: 'all' | string[] } = {}): Doc {
  const b = new Builder();
  const pos = b.accessor(POS, F32, 'VEC3', 3, true);
  const idx = b.accessor(IDX, U16, 'SCALAR', 3);
  const col = b.accessor(COL, F32, 'VEC3', 3);
  const times = b.accessor(TIMES, F32, 'SCALAR', 2);
  const quats = b.accessor(QUATS, F32, 'VEC4', 2);
  b.json.materials.push({ name: 'skin', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.5, 1] } }, { name: 'cloth', pbrMetallicRoughness: { baseColorFactor: [0.2, 0.3, 0.6, 1] } });
  const mesh = (name: string, material: number) => {
    const attributes: Record<string, number> = { POSITION: pos };
    if (o.colorMeshes === 'all' || (Array.isArray(o.colorMeshes) && o.colorMeshes.includes(name))) attributes.COLOR_0 = col;
    return b.json.meshes.push({ name, primitives: [{ attributes, indices: idx, material }] }) - 1;
  };
  b.node('HeroRoot', null);
  b.node('Torso', 'HeroRoot', { t: [0, 1.2, 0], s: [1, 1, 1] });
  b.node('Torso_Body', 'Torso', { mesh: mesh('Torso_Body', 0), extras: { part: 'torso' } });
  b.node('TorsoCoat', 'Torso', { mesh: mesh('TorsoCoat', 1) });
  b.node('HeadGroup', 'Torso', { t: [0, 0.6, 0], s: [1, 1, 1] });
  b.node('Head', 'HeadGroup', { mesh: mesh('Head', 0) });
  b.node('Hair', 'HeadGroup', { mesh: mesh('Hair', 1) });
  b.node('LeftLegPivot', 'HeroRoot', { t: [-0.11, 0.9, 0], s: [1, 1, 1] });
  b.node('RightLegPivot', 'HeroRoot', { t: [0.11, 0.9, 0], s: [1, 1, 1] });
  b.node('Gear_trousers_legL_04_', 'HeroRoot', { mesh: mesh('Gear_trousers_legL_04_', 1) });
  b.clip('Idle', [{ node: 'Torso', path: 'rotation', output: quats }], times);
  b.clip('Walk', [{ node: 'LeftLegPivot', path: 'rotation', output: quats }, { node: 'RightLegPivot', path: 'rotation', output: quats }], times);
  return b.done();
}

export const TINY_BUDGET = { triangles: 6, meshes: 6, materials: 2, rawBytes: 4096, brotliBytes: 4096 };

export function tinyManifest(): Manifest {
  const n = (parent: string | null, translation: Vec3) => ({ parent, translation, scale: [1, 1, 1] });
  return {
    nodes: {
      HeroRoot: { parent: null, translation: [0, 0, 0], scale: [1, 1, 1] },
      Torso: n('HeroRoot', [0, 1.2, 0]),
      HeadGroup: n('Torso', [0, 0.6, 0]),
      LeftLegPivot: n('HeroRoot', [-0.11, 0.9, 0]),
      RightLegPivot: n('HeroRoot', [0.11, 0.9, 0])
    },
    materials: ['skin', 'cloth'],
    toggled: ['Hair', 'TorsoCoat', 'Gear_trousers_legL_04_'],
    vertexColor: 'none',
    clips: { Idle: { moves: ['Torso'] }, Walk: { moves: ['LeftLegPivot', 'RightLegPivot'] } },
    budget: { ...TINY_BUDGET }
  };
}

const SKIN_JOINTS = ['Root', 'Hips', 'Torso', 'HeadGroup', 'LeftArmPivot', 'LeftElbowPivot', 'LeftLegPivot'];
const SKIN_REST: Record<string, Vec3> = {
  Root: [0, 0, 0],
  Hips: [0, 0.9, 0],
  Torso: [0, 0.3, 0],
  HeadGroup: [0, 0.5, 0],
  LeftArmPivot: [-0.3, 0.4, 0],
  LeftElbowPivot: [-0.2, -0.5, 0],
  LeftLegPivot: [-0.11, 0, 0]
};
const SKIN_PARENT: Record<string, string> = { Root: 'Monster_tiny', Hips: 'Root', Torso: 'Hips', HeadGroup: 'Torso', LeftArmPivot: 'Torso', LeftElbowPivot: 'LeftArmPivot', LeftLegPivot: 'Hips' };

/** A skinned figure: root at the origin, 7 bones, 3 vertices, a shared `Walk` (Hips position + rotations) and `Idle`. */
export function buildTinySkin(o: { weights?: number[][]; joints?: number[][]; walkTranslationOn?: string[] } = {}): Doc {
  const b = new Builder();
  const pos = b.accessor(POS, F32, 'VEC3', 3, true);
  const idx = b.accessor(IDX, U16, 'SCALAR', 3);
  const joints = b.accessor(new Uint8Array((o.joints ?? [[0, 1, 0, 0], [2, 3, 0, 0], [4, 5, 0, 0]]).flat()), U8, 'VEC4', 3);
  const weights = b.accessor(new Float32Array((o.weights ?? [[1, 0, 0, 0], [0.5, 0.5, 0, 0], [0.25, 0.25, 0.25, 0.25]]).flat()), F32, 'VEC4', 3);
  const times = b.accessor(TIMES, F32, 'SCALAR', 2);
  const quats = b.accessor(QUATS, F32, 'VEC4', 2);
  const moves = b.accessor(MOVES, F32, 'VEC3', 2);
  // inverse bind matrices: world translation of each bone, negated (column-major)
  const world: Record<string, Vec3> = {};
  for (const j of SKIN_JOINTS) {
    const p = SKIN_PARENT[j] === 'Monster_tiny' ? [0, 0, 0] : world[SKIN_PARENT[j]];
    world[j] = [p[0] + SKIN_REST[j][0], p[1] + SKIN_REST[j][1], p[2] + SKIN_REST[j][2]];
  }
  const ibm = new Float32Array(SKIN_JOINTS.length * 16);
  SKIN_JOINTS.forEach((j, k) => ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -world[j][0], -world[j][1], -world[j][2], 1], k * 16));
  const ibmAcc = b.accessor(ibm, F32, 'MAT4', SKIN_JOINTS.length);
  b.json.materials.push({ name: 'skin', pbrMetallicRoughness: { baseColorFactor: [0.4, 0.6, 0.3, 1] } });
  b.json.meshes.push({ name: 'tinybody', primitives: [{ attributes: { POSITION: pos, JOINTS_0: joints, WEIGHTS_0: weights }, indices: idx, material: 0 }] });
  b.node('Monster_tiny', null);
  for (const j of SKIN_JOINTS) b.node(j, SKIN_PARENT[j], { t: SKIN_REST[j] });
  b.json.skins = [{ joints: SKIN_JOINTS.map((j) => b.index.get(j)!), inverseBindMatrices: ibmAcc, skeleton: b.index.get('Root')! }];
  b.node('Monster_tiny_body', 'Monster_tiny', { mesh: 0, skin: 0 });
  const walk = [
    ...(o.walkTranslationOn ?? ['Hips']).map((node) => ({ node, path: 'translation' as const, output: moves })),
    { node: 'Torso', path: 'rotation' as const, output: quats },
    { node: 'LeftArmPivot', path: 'rotation' as const, output: quats }
  ];
  b.clip('Idle', [{ node: 'Torso', path: 'rotation', output: quats }], times);
  b.clip('Walk', walk, times);
  return b.done();
}

export function tinySkinManifest(): Manifest {
  const bone = (k: string) => ({ parent: SKIN_PARENT[k] === 'Monster_tiny' ? null : SKIN_PARENT[k], translation: SKIN_REST[k] });
  const d = SKIN_REST.LeftElbowPivot;
  const len = Math.hypot(d[0], d[1], d[2]);
  return {
    nodes: {},
    materials: ['skin'],
    toggled: [],
    vertexColor: 'none',
    clips: { Idle: { moves: ['Torso'] }, Walk: { moves: ['Hips', 'Torso', 'LeftArmPivot'] } },
    skin: {
      skeleton: 'tiny',
      bones: Object.fromEntries(SKIN_JOINTS.map((j) => [j, bone(j)])),
      skinnedRoots: ['Monster_tiny'],
      sharedClips: ['Idle', 'Walk'],
      limbs: [{ bone: 'LeftArmPivot', child: 'LeftElbowPivot', direction: [d[0] / len, d[1] / len, d[2] / len] }],
      maxLimbDegrees: 20
    },
    budget: { triangles: 1, meshes: 1, materials: 1, rawBytes: 4096, brotliBytes: 4096 }
  };
}

export function nodeOf(doc: Doc, name: string): GltfNode {
  const n = doc.json.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`fixture has no node ${name}`);
  return n;
}

export function packGlb(doc: Doc): Buffer {
  const pad = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const json = pad(Buffer.from(JSON.stringify(doc.json)), 0x20);
  const bin = pad(doc.bin, 0);
  const head = Buffer.alloc(12);
  head.write('glTF', 0, 'latin1');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const chunk = (len: number, type: string) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(len, 0);
    h.write(type, 4, 'latin1');
    return h;
  };
  return Buffer.concat([head, chunk(json.length, 'JSON'), json, chunk(bin.length, 'BIN\0'), bin]);
}
