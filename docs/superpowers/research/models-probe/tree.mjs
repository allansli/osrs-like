import fs from 'node:fs';
const [,, file, ...roots] = process.argv;
const b = fs.readFileSync(file); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
const fmt = (n) => (n.translation ? ' t=' + n.translation.map(v => v.toFixed(2)).join(',') : '') + (n.rotation ? ' r=' + n.rotation.map(v => v.toFixed(2)).join(',') : '') + (n.scale ? ' s=' + n.scale.map(v => v.toFixed(2)).join(',') : '');
const walk = (i, d, meshesOnly) => { const n = j.nodes[i]; const isMesh = n.mesh !== undefined; if (!isMesh || d < 3) console.log('  '.repeat(d) + n.name + (isMesh ? ' [mesh]' : '') + fmt(n) + (n.children ? ` (${n.children.filter(c => j.nodes[c].mesh !== undefined).length} meshes)` : '')); (n.children || []).forEach(c => { if (j.nodes[c].mesh === undefined) walk(c, d + 1); }); };
j.nodes.forEach((n, i) => { if (roots.includes(n.name)) walk(i, 0); });
