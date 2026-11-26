import fs from 'node:fs';
const root = process.cwd() + '/';
const { readGlb, brotli3Bytes } = await import(root + 'scripts/lib/glb.mjs');
const { figureStats } = await import(root + 'scripts/models-compare.mjs');
for (const [lab, f] of [['today', 'public/models/monsters.glb'], ['s2d', 'scratch/models-build/s3d/monsters.glb']]) {
  const buf = fs.readFileSync(f); const doc = readGlb(buf); const j = doc.json;
  const o = { lab, fileRaw: buf.length, fileBrotli: brotli3Bytes(buf), materials: j.materials.length };
  j.nodes.forEach((n, i) => { if (/^Monster_(goblin|goblin_archer)$/.test(n.name)) o[n.name] = figureStats(doc, i); });
  console.log(JSON.stringify(o));
}
