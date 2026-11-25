// Merge-only pass over the monsters (plan M0): a merge changes mesh grouping and nothing else.
// The file read is public/models/monsters.glb; the "built file" check runs in a throw-away worktree
// with the built file copied over it. The fixture is computed from the shipped file at 9a03f4e.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
type Json = {
  nodes: { name?: string; mesh?: number; children?: number[]; extras?: { noOutline?: unknown } }[];
  meshes: { name?: string; primitives: { material?: number; indices?: number; attributes: Record<string, number> }[] }[];
  materials?: { name?: string; emissiveFactor?: number[]; extensions?: { KHR_materials_emissive_strength?: { emissiveStrength?: number } } }[];
  accessors: { count: number }[];
  scenes: { nodes: number[] }[];
};
const { readGlb } = (await import(/* @vite-ignore */ pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'glb.mjs')).href)) as {
  readGlb: (p: string) => { json: Json };
};

// The engine's material-family rule: blenderMonsters.ts upgradeMonsterRigWithGltf, in its order of tests.
const FAMILIES: [string, string[]][] = [
  ['skin', ['skin', 'scale', 'chitin', 'feather']],
  ['cloth', ['cloth', 'robe']],
  ['leather', ['leather', 'fur', 'wing', 'hoof']],
  ['wood', ['wood']],
  ['bark', ['bark']],
  ['grass', ['moss', 'grass', 'leaf']],
  ['stone', ['stone']],
  ['iron', ['iron', 'bronze', 'steel']]
];
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function familyOf(json: Json, nodeName: string, meshName: string, mat: number | undefined): string {
  const m = mat === undefined ? undefined : json.materials?.[mat];
  const matName = (m?.name ?? '').toLowerCase();
  const eName = `${nodeName} ${meshName}`.toLowerCase();
  // extractEmissiveHex: the emissive colour, as 8-bit sRGB, is not black and the intensity is above 0.05.
  const hex = (m?.emissiveFactor ?? [0, 0, 0]).reduce((s, c) => s + Math.round(toSrgb(c) * 255), 0);
  const strength = m?.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
  const emissive = hex > 0 && strength > 0.05;
  if (matName.includes('glow') || eName.includes('eye') || emissive) return eName.includes('eye') ? 'eyes' : 'glow';
  for (const [fam, words] of FAMILIES) if (words.some((w) => matName.includes(w))) return fam;
  return 'plain';
}

export interface Figure {
  meshes: number;
  triangles: Record<string, number>;
  pivots: Record<string, string[]>;
  /** Meshes left by a perfect `figkit.merge_parts`: one per (pivot, material, noOutline, name class), TOGGLED names alone. */
  floor: number;
}

/** Per `Monster_*` figure: meshes (primitives), triangles per family, and the families under each pivot. */
function figures(file: string): Record<string, Figure> {
  const { json } = readGlb(file);
  const parent = new Map<number, number>();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const out: Record<string, Figure> = {};
  json.nodes.forEach((root, ri) => {
    if (!root.name?.startsWith('Monster_') || parent.has(ri)) return;
    const fig: Figure = { meshes: 0, triangles: {}, pivots: {}, floor: 0 };
    const groups = new Set<string>();
    const stack = [ri];
    while (stack.length) {
      const i = stack.pop()!;
      const node = json.nodes[i];
      stack.push(...(node.children ?? []));
      if (node.mesh === undefined) continue;
      // the owning pivot is the nearest ancestor that carries no mesh
      let p = parent.get(i)!;
      while (json.nodes[p].mesh !== undefined) p = parent.get(p)!;
      const mesh = json.meshes[node.mesh];
      for (const prim of mesh.primitives) {
        const fam = familyOf(json, node.name ?? '', mesh.name ?? '', prim.material);
        const tris = Math.floor(json.accessors[prim.indices ?? prim.attributes.POSITION].count / 3);
        fig.meshes++;
        // figkit.merge_parts: group by (parent, material, noOutline, name class); TOGGLED names never merge.
        const nm = node.name ?? '';
        const cls = ['eye', 'glow', 'gem', 'orb', 'string'].find((c) => nm.toLowerCase().includes(c)) ?? 'other';
        const toggled = /^(Hair|CrownSpike_|BackSpike_|Sideburn_|TorsoCoat$|OuterCoat_|CoatTrim_|CoatTail_|CoatTailTrim_|InnerCollar$)|_leg[LR]_04_/.test(nm);
        groups.add(toggled ? `#${i}.${fig.meshes}` : `${p}|${prim.material}|${node.extras?.noOutline ? 1 : 0}|${cls}`);
        fig.triangles[fam] = (fig.triangles[fam] ?? 0) + tris;
        const set = (fig.pivots[json.nodes[p].name ?? `#${p}`] ??= []);
        if (!set.includes(fam)) set.push(fam);
      }
    }
    fig.floor = groups.size;
    for (const k of Object.keys(fig.pivots)) fig.pivots[k].sort();
    out[root.name.slice('Monster_'.length)] = fig;
  });
  return out;
}

const today: Record<string, Figure> = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'monster-families.json'), 'utf8'));
const built = figures(path.join(ROOT, 'public', 'models', 'monsters.glb'));
const keys = Object.keys(today).sort();

describe('monster merge keeps everything but the mesh grouping', () => {
  it('the file holds the same figures as the fixture', () => {
    expect(Object.keys(built).sort()).toEqual(keys);
  });
  it.each(keys)('%s: triangles per engine material family are unchanged', (k) => {
    expect(built[k].triangles).toEqual(today[k].triangles);
  });
  it.each(keys)('%s: every pivot keeps its meshes\' families', (k) => {
    expect(built[k].pivots).toEqual(today[k].pivots);
  });
  // Red until the merge exists (plan M0). Plan: at most half of today's meshes. A figure whose
  // merge-only floor (one mesh per pivot, material, noOutline and name class, which is all
  // merge_parts may join without changing a material) exceeds half is limited to that floor.
  it.each(keys)('%s: at most half of today\'s meshes, or the merge-only floor', (k) => {
    expect(built[k].meshes).toBeLessThanOrEqual(Math.max(Math.floor(today[k].meshes / 2), today[k].floor));
  });
});
