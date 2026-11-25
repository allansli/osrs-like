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

/** The monster fixture: the same meshes under `Monster_<key>`, material names the monster path routes by. */
export function buildColouredMonster(key: string): Doc {
  const doc = buildColouredHero();
  doc.json.nodes.find((n) => n.name === 'HeroRoot')!.name = `Monster_${key}`;
  return doc;
}

export const glbBytes = (doc: Doc): ArrayBuffer => {
  const b = packGlb(doc);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
