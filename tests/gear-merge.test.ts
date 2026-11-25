// Merge-only pass over the gear (plan G2/G2b): a merge changes mesh grouping and nothing else.
// The file read is public/models/gear.glb; the "built file" check runs in a throw-away worktree
// with the built file copied over it. The fixture is computed from the shipped file at 8b7ecdd.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
type Json = {
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes: { primitives: { material?: number; indices?: number }[] }[];
  materials?: { name?: string }[];
  accessors: { count: number }[];
  scenes: { nodes: number[] }[];
};
const { readGlb } = (await import(/* @vite-ignore */ pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'glb.mjs')).href)) as {
  readGlb: (p: string) => { json: Json };
};
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'gear-families.json'), 'utf8')) as Record<string, Record<string, number>>;

// The engine's material-family rule: blenderGear.ts cloneBlenderGearNode, in its order of tests.
function familyOf(matName: string, meshName: string): string {
  const m = matName.toLowerCase();
  const n = meshName.toLowerCase();
  if (m.includes('glow') || n.includes('glow') || n.includes('eye') || n.includes('gem') || n.includes('orb')) return 'glow';
  if (m.includes('trim') || m.includes('gold')) return 'trim';
  if (m.includes('wood')) return 'wood';
  if (m.includes('leather')) return 'leather';
  if (m.includes('dark') || m.includes('charcoal')) return 'dark';
  if (m.includes('white') || m.includes('feather') || m.includes('wing')) return 'white';
  if (m.includes('crimson')) return 'crimson';
  return 'primary';
}

/** Per `Gear_*` root node: meshes (primitives) and triangles per family. */
function roots(file: string): Record<string, { meshes: number; triangles: Record<string, number> }> {
  const { json } = readGlb(file);
  const out: Record<string, { meshes: number; triangles: Record<string, number> }> = {};
  const walk = (i: number, acc: { meshes: number; triangles: Record<string, number> }) => {
    const node = json.nodes[i];
    if (node.mesh !== undefined) {
      for (const p of json.meshes[node.mesh].primitives) {
        const fam = familyOf(p.material === undefined ? '' : (json.materials?.[p.material]?.name ?? ''), node.name ?? '');
        const tris = (p.indices === undefined ? 0 : json.accessors[p.indices].count) / 3;
        acc.meshes += 1;
        acc.triangles[fam] = (acc.triangles[fam] ?? 0) + tris;
      }
    }
    for (const c of node.children ?? []) walk(c, acc);
  };
  for (let i = 0; i < json.nodes.length; i++) {
    const name = json.nodes[i].name ?? '';
    if (!name.startsWith('Gear_') || json.nodes[i].mesh !== undefined) continue;
    const acc = { meshes: 0, triangles: {} as Record<string, number> };
    walk(i, acc);
    out[name] = acc;
  }
  return out;
}

const built = roots(path.join(ROOT, 'public', 'models', 'gear.glb'));

describe('gear merge (a merge changes grouping, never triangles)', () => {
  it('the fixture lists every Gear_ root of the file', () => {
    expect(Object.keys(built).sort()).toEqual(Object.keys(fixture).sort());
  });

  it.each(Object.keys(fixture))('%s keeps its triangles per material family', (name) => {
    expect(built[name]?.triangles).toEqual(fixture[name]);
  });

  // Red until G6: today's file has up to 24 meshes per root.
  it.each(Object.keys(fixture))('%s has at most 4 meshes, or one per family when it has more than 4 families', (name) => {
    const families = Object.keys(fixture[name]).length;
    expect(built[name]?.meshes).toBeLessThanOrEqual(Math.max(4, families));
  });
});
