import fs from 'node:fs'; import zlib from 'node:zlib';
import * as THREE from '/path/to/osrs-like-wp/MP/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/path/to/osrs-like-wp/MP/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from '/path/to/osrs-like-wp/MP/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
const q3 = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;
const D = '/tmp/scratch/mp2/out2/';
const parse = (f) => { const b = fs.readFileSync(f); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej)); };
for (const f of ['human_static.glb', 'human_noanim.glb', 'human_skinned.glb']) console.log('bytes', f, fs.statSync(D + f).size, 'br3', q3(fs.readFileSync(D + f)));
const b = fs.readFileSync(D + 'human_skinned.glb'); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString()); const bin = b.slice(20 + jl + 8);
for (const a of j.animations) { const kinds = {}; for (const c of a.channels) { const s = a.samplers[c.sampler]; const k = c.target.path + '/' + s.interpolation + '/' + j.accessors[s.input].count + 'keys'; kinds[k] = (kinds[k] || 0) + 1; } console.log('clip', a.name, JSON.stringify(kinds)); }
const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView]; return { a, data: bin.slice((v.byteOffset || 0) + (a.byteOffset || 0), (v.byteOffset || 0) + (a.byteOffset || 0) + v.byteLength) }; };
const p = j.meshes[0].primitives[0]; const n = j.accessors[p.attributes.POSITION].count;
const pos = acc(p.attributes.POSITION).data, nor = acc(p.attributes.NORMAL).data, jo = acc(p.attributes.JOINTS_0).data, we = acc(p.attributes.WEIGHTS_0).data, idx = acc(p.indices).data;
console.log('per-attribute raw/br3: pos', pos.length, q3(pos), 'nor', nor.length, q3(nor), 'joints', jo.length, q3(jo), 'weights', we.length, q3(we), 'idx', idx.length, q3(idx), 'idxType', j.accessors[p.indices].componentType);
const nf = new Float32Array(nor.buffer.slice(nor.byteOffset, nor.byteOffset + n * 12)); const n8 = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) n8.writeInt8(Math.round(nf[i * 3 + k] * 127), i * 4 + k);
const wf = new Float32Array(we.buffer.slice(we.byteOffset, we.byteOffset + n * 16)); const w8 = Buffer.alloc(n * 4); for (let i = 0; i < n * 4; i++) w8.writeUInt8(Math.round(wf[i] * 255), i);
const pf = new Float32Array(pos.buffer.slice(pos.byteOffset, pos.byteOffset + n * 12)); const p16 = Buffer.alloc(n * 8); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) p16.writeInt16LE(Math.round(pf[i * 3 + k] / 2 * 32767), i * 8 + k * 2);
const rest = b.length - pos.length - nor.length - we.length - jo.length - idx.length;
const variants = { 'as exported': [pos, nor, jo, we, idx], '8-bit normals + 8-bit weights (no decoder)': [pos, n8, jo, w8, idx], 'plus 16-bit positions': [p16, n8, jo, w8, idx] };
const anim = fs.statSync(D + 'human_skinned.glb').size - fs.statSync(D + 'human_noanim.glb').size;
for (const [k, parts] of Object.entries(variants)) { const all = Buffer.concat(parts); console.log('variant', k, 'geometry raw', all.length, 'br3', q3(all)); }
console.log('two clips cost raw', anim, 'br3', q3(fs.readFileSync(D + 'human_skinned.glb')) - q3(fs.readFileSync(D + 'human_noanim.glb')));
const g = await parse(D + 'human_skinned.glb'); console.log('tracks kinds', [...new Set(g.animations.flatMap(a => a.tracks.map(t => t.name.split('.')[1] + ':' + t.getInterpolation())))].join(','), 'trackCount', g.animations.map(a => a.tracks.length).join('/'));
const gg = await parse(D + 'goblin_skinned.glb'); const gob = SkeletonUtils.clone(gg.scene); const before = gob.getObjectByName('LeftKneePivot').position.clone();
const gm = new THREE.AnimationMixer(gob); gm.clipAction(g.animations.find(a => a.name === 'Walk')).play(); gm.update(0.33); gob.updateMatrixWorld(true);
console.log('rotation-only Walk on goblin: leg rot.x', gob.getObjectByName('LeftLegPivot').rotation.x.toFixed(3), 'knee local pos kept', before.equals(gob.getObjectByName('LeftKneePivot').position), before.toArray().map(v => v.toFixed(2)).join(','));
