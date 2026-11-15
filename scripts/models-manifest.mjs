// Writes a first contract manifest per shipped GLB (and totals.json) from what the files hold today.
// usage: node scripts/models-manifest.mjs [--glb-dir public/models] [--out tests/fixtures/model-contract]
// Later tasks edit the manifests by hand (or in pending/); rerunning this over a rebuilt file would bless it.
import fs from 'node:fs';
import path from 'node:path';
import { readGlb } from './lib/glb.mjs';
import { figureStats } from './models-compare.mjs';

export const NAMES = ['hero', 'gear', 'monsters', 'guard', 'world'];
const MARGIN = 1.01; // per-file bytes and the total: today's value plus 1%
const HERO_CENTRES = ['Hand_L', 'Hand_R', 'Boot_L', 'Boot_R', 'Head'];
// design 8.1: mesh names the engine hides by (playerMesh.ts), and gear leg meshes hidden on the hero (the ordinal _04_)
const TOGGLED = /^(Hair|CrownSpike_|BackSpike_|Sideburn_|TorsoCoat|OuterCoat_|CoatTrim_|CoatTail_|CoatTailTrim_|InnerCollar)|_leg[LR]_04_/;
const FIGURE_ROOT = { hero: /^HeroRoot$/, monsters: /^Monster_/, guard: /^CastleGuard$/ };
// the loader of each file and the cache key it carries today, to be tied to a hash from the first promotion on
const LOADERS = {
  hero: ['src/engine/blenderHero.ts', '/models/hero.glb'],
  gear: ['src/engine/blenderGear.ts', '/models/gear.glb'],
  monsters: ['src/engine/blenderMonsters.ts', '/models/monsters.glb'],
  guard: ['src/engine/worldBuild.ts', '/models/guard.glb'],
  world: ['src/engine/blenderWorld.ts', '/models/world.glb']
};

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const vec = (a, d) => (a ?? d).map(r6);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A mesh name with every number replaced by a number pattern: Cube.012 and Cube.013 are one class. */
const meshClass = (name) => '^' + name.split(/(-?\d+)/).map((p, i) => (i % 2 ? '-?\\d+' : escape(p))).join('') + '$';

export function buildManifest(name, doc, repoRoot) {
  const nodes = doc.json.nodes;
  const parentOf = new Map();
  nodes.forEach((n, i) => (n.children || []).forEach((c) => parentOf.set(c, i)));
  const nameOfParent = (i) => (parentOf.has(i) ? nodes[parentOf.get(i)].name : null);

  // contract nodes: every node that holds no mesh (roots, pivots, mount groups), the engine looks these up by name
  const manifestNodes = {};
  nodes.forEach((n, i) => {
    if (n.mesh !== undefined) return;
    manifestNodes[n.name] = { parent: nameOfParent(i), translation: vec(n.translation, [0, 0, 0]), scale: vec(n.scale, [1, 1, 1]) };
  });

  const extras = {};
  nodes.forEach((n) => {
    if (n.extras && (name === 'hero' || n.mesh === undefined)) extras[n.name] = Object.keys(n.extras).sort();
  });

  const centres = {};
  if (name === 'hero') {
    for (const part of HERO_CENTRES) {
      const n = nodes.find((x) => x.name === part);
      if (!n || n.mesh === undefined || n.rotation) throw new Error(`hero part '${part}' is missing, has no mesh or is rotated`);
      const { min, max } = doc.meshBounds[n.mesh];
      const t = n.translation ?? [0, 0, 0];
      const s = n.scale ?? [1, 1, 1];
      centres[part] = [0, 1, 2].map((c) => r6(((min[c] + max[c]) / 2) * s[c] + t[c]));
    }
  }

  const clips = {};
  for (const anim of doc.json.animations || []) {
    const moves = new Set(anim.channels.map((c) => nodes[c.target.node].name));
    clips[anim.name] = { moves: [...moves].sort() };
  }

  const toggled = [...new Set([...nodes.map((n) => n.name), ...doc.json.meshes.map((m) => m.name)].filter((n) => TOGGLED.test(n)))].sort();

  const manifest = {
    nodes: manifestNodes,
    materials: doc.json.materials.map((m) => m.name).sort(),
    toggled,
    meshClasses: [...new Set(doc.json.meshes.map((m) => meshClass(m.name)))].sort(),
    extras,
    ...(name === 'hero' ? { centres } : {}),
    vertexColor: 'none',
    clips,
    budget: {
      triangles: doc.triangles,
      meshes: doc.json.meshes.length,
      materials: doc.json.materials.length,
      rawBytes: Math.ceil(doc.rawBytes * MARGIN),
      brotliBytes: Math.ceil(doc.brotliBytes * MARGIN)
    }
  };
  const root = FIGURE_ROOT[name];
  if (root) {
    manifest.figures = {};
    nodes.forEach((n, i) => {
      if (!root.test(n.name)) return;
      const { triangles, meshes, materials, rawBytes, brotliBytes } = figureStats(doc, i);
      manifest.figures[n.name] = { triangles, meshes, materials, rawBytes, brotliBytes };
    });
  }
  return manifest;
}

function main() {
  const args = process.argv.slice(2);
  const arg = (flag, dflt) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : dflt);
  const root = path.resolve(import.meta.dirname, '..');
  const glbDir = path.resolve(arg('--glb-dir', path.join(root, 'public', 'models')));
  const out = path.resolve(arg('--out', path.join(root, 'tests', 'fixtures', 'model-contract')));
  fs.mkdirSync(out, { recursive: true });
  const totals = { rawBytes: 0, brotliBytes: 0, loaders: {} };
  for (const name of NAMES) {
    const doc = readGlb(path.join(glbDir, `${name}.glb`));
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(buildManifest(name, doc, root), null, 2) + '\n');
    totals.rawBytes += doc.rawBytes;
    totals.brotliBytes += doc.brotliBytes;
    const [file, url] = LOADERS[name];
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const m = src.match(new RegExp(escape(url) + '(\\?v=[A-Za-z0-9_.-]+)?'));
    if (!m) throw new Error(`${file} does not load ${url}`);
    totals.loaders[name] = { file, url: m[0] };
  }
  totals.rawBytes = Math.ceil(totals.rawBytes * MARGIN);
  totals.brotliBytes = Math.ceil(totals.brotliBytes * MARGIN);
  fs.writeFileSync(path.join(out, 'totals.json'), JSON.stringify(totals, null, 2) + '\n');
  console.log(`wrote ${NAMES.length} manifests and totals.json to ${out}`);
}

if (process.argv[1] === import.meta.filename) main();
