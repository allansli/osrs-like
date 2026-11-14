import fs from 'node:fs'; import zlib from 'node:zlib';
import * as THREE from '/path/to/osrs-like-wp/MP/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/path/to/osrs-like-wp/MP/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const q3 = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;
const src = '/tmp/scratch/mp2/out2/human_skinned.glb', dst = '/tmp/scratch/mp2/out2/human_quant.glb';
const b = fs.readFileSync(src); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString()); const bin = b.slice(20 + jl + 8);
const view = (i) => { const v = j.bufferViews[i]; return bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
const repl = new Map();
for (const m of j.meshes) for (const p of m.primitives) {
  const na = j.accessors[p.attributes.NORMAL], wa = j.accessors[p.attributes.WEIGHTS_0];
  const nv = view(na.bufferView), wv = view(wa.bufferView); const n = na.count;
  const n8 = Buffer.alloc(n * 4), w8 = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) n8.writeInt8(Math.round(nv.readFloatLE(i * 12 + k * 4) * 127), i * 4 + k);
    const w = [0, 1, 2, 3].map(k => wv.readFloatLE(i * 16 + k * 4)); const q = w.map(x => Math.round(x * 255)); let d = 255 - q.reduce((a, c) => a + c, 0); q[q.indexOf(Math.max(...q))] += d; q.forEach((x, k) => w8.writeUInt8(x, i * 4 + k)); }
  repl.set(na.bufferView, n8); repl.set(wa.bufferView, w8);
  na.componentType = 5120; na.normalized = true; j.bufferViews[na.bufferView].byteStride = 4;
  wa.componentType = 5121; wa.normalized = true;
}
j.extensionsUsed = [...(j.extensionsUsed || []), 'KHR_mesh_quantization']; j.extensionsRequired = [...(j.extensionsRequired || []), 'KHR_mesh_quantization'];
const parts = []; let off = 0;
j.bufferViews.forEach((v, i) => { const d = repl.get(i) || view(i); v.byteOffset = off; v.byteLength = d.length; parts.push(d); off += d.length; const pad = (4 - off % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } });
j.buffers[0].byteLength = off; const nb = Buffer.concat(parts); let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + nb.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4); const c2 = Buffer.alloc(8); c2.writeUInt32LE(nb.length, 0); c2.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(dst, Buffer.concat([h, c1, js, c2, nb]));
const parse = (f) => { const x = fs.readFileSync(f); return new Promise((res, rej) => new GLTFLoader().parse(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength), '', res, rej)); };
const pose = async (f) => { const g = await parse(f); let sk; g.scene.traverse(o => { if (o.isSkinnedMesh) sk = o; }); const m = new THREE.AnimationMixer(g.scene); m.clipAction(g.animations.find(a => a.name === 'Slash')).play(); m.update(0.45); g.scene.updateMatrixWorld(true); const out = []; const v = new THREE.Vector3(); for (let i = 0; i < sk.geometry.attributes.position.count; i++) { sk.getVertexPosition(i, v); out.push(v.clone()); } return { out, sk }; };
const A = await pose(src), B = await pose(dst); let worst = 0; A.out.forEach((v, i) => { worst = Math.max(worst, v.distanceTo(B.out[i])); });
console.log('bare GLTFLoader parsed the quantised file: normal array', B.sk.geometry.attributes.normal.array.constructor.name, 'weights', B.sk.geometry.attributes.skinWeight.array.constructor.name, 'normalized', B.sk.geometry.attributes.skinWeight.normalized);
console.log('raw', fs.statSync(src).size, '->', fs.statSync(dst).size, '| br3', q3(fs.readFileSync(src)), '->', q3(fs.readFileSync(dst)), '| worst posed-vertex difference (m)', worst.toFixed(5));
