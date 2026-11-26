// A tiny hero-shaped GLB with COLOR_0 on every mesh, written by code (no binary is committed).
// Built on tinyGlb.ts's static figure; adds the arm pivots the hero upgrade requires and the
// `part` extras it routes role materials by. Used by tests/model-vertex-colour.test.ts.
import { buildTiny, packGlb, type Doc } from './tinyGlb';

const PARTS: Record<string, string> = {
  Torso_Body: 'skin',
  TorsoCoat: 'chest',
  Head: 'head',
  Hair: 'hair',
  Gear_trousers_legL_04_: 'boot'
};

/** The hero fixture: every role the engine recolours has at least one mesh. */
export function buildColouredHero(): Doc {
  const doc = buildTiny({ colorMeshes: 'all' });
  const nodes = doc.json.nodes;
  for (const n of nodes) if (PARTS[n.name]) n.extras = { part: PARTS[n.name] };
  const root = nodes.find((n) => n.name === 'HeroRoot')!;
  const add = (name: string, extras?: Record<string, unknown>, mesh?: number) => {
    nodes.push({ name, ...(extras ? { extras } : {}), ...(mesh !== undefined ? { mesh } : {}) });
    (root.children ??= []).push(nodes.length - 1);
  };
  add('LeftArmPivot');
  add('RightArmPivot');
  add('Hand_L', { part: 'hand' }, 0);
  add('Bracer_L', undefined, 0);
  add('Thigh_L', { part: 'thigh' }, 0);
  return doc;
}

/** The monster fixture: the same meshes under `Monster_<key>`, material names the monster path routes by.
 *  Torso_Body is skinned to the Torso bone (X0: the monster path refuses a figure with no skin). */
export function buildColouredMonster(key: string): Doc {
  const doc = buildColouredHero();
  const { json } = doc;
  json.nodes.find((n) => n.name === 'HeroRoot')!.name = `Monster_${key}`;
  const parts: Buffer[] = [doc.bin];
  let len = doc.bin.length;
  const accessor = (data: Uint8Array | Float32Array, componentType: number, type: string, count: number) => {
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    json.bufferViews.push({ buffer: 0, byteOffset: len, byteLength: raw.length });
    const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4);
    raw.copy(padded);
    parts.push(padded);
    len += padded.length;
    return json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType, count, type }) - 1;
  };
  const torso = json.nodes.findIndex((n) => n.name === 'Torso');
  const t = json.nodes[torso].translation ?? [0, 0, 0];
  const joints = accessor(new Uint8Array(12), 5121, 'VEC4', 3);
  const weights = accessor(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 5126, 'VEC4', 3);
  const ibm = accessor(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -t[0], -t[1], -t[2], 1]), 5126, 'MAT4', 1);
  json.skins = [{ joints: [torso], inverseBindMatrices: ibm, skeleton: torso }];
  const body = json.nodes.find((n) => n.name === 'Torso_Body')!;
  body.skin = 0;
  // its own mesh: mesh 0 is shared with Hand_L, Bracer_L and Thigh_L, which stay rigid children
  const src = json.meshes[body.mesh!];
  const prim = src.primitives[0];
  body.mesh = json.meshes.push({ ...src, primitives: [{ ...prim, attributes: { ...prim.attributes, JOINTS_0: joints, WEIGHTS_0: weights } }] }) - 1;
  json.buffers = [{ byteLength: len }];
  doc.bin = Buffer.concat(parts);
  return doc;
}

export const glbBytes = (doc: Doc): ArrayBuffer => {
  const b = packGlb(doc);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
