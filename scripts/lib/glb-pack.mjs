import { readGlb, readAccessor } from './glb.mjs';

/**
 * Packs 8-bit attributes in a GLB buffer:
 * - NORMAL -> normalised signed bytes (componentType 5120, normalized true, stride 4)
 * - WEIGHTS_n -> normalised unsigned bytes (componentType 5121, normalized true, vertex weights sum to 255)
 * - COLOR_n -> normalised unsigned bytes (componentType 5121, normalized true)
 * - Adds KHR_mesh_quantization to extensionsUsed and extensionsRequired if anything was packed
 * - If nothing needs packing, returns the original buffer untouched
 *
 * @param {Buffer} buffer - Raw GLB buffer
 * @returns {Buffer} Packed GLB buffer
 */
export function packGlb(buffer) {
  const doc = readGlb(buffer);
  const json = doc.json;
  const bin = doc.bin;

  // Check if anything needs packing
  let needsPacking = false;
  for (const mesh of json.meshes) {
    for (const prim of mesh.primitives) {
      for (const [name, accIdx] of Object.entries(prim.attributes)) {
        const acc = json.accessors[accIdx];
        if (name === 'NORMAL') {
          if (acc.componentType !== 5120 || !acc.normalized) {
            needsPacking = true;
          }
        } else if (/^WEIGHTS_\d+$/.test(name)) {
          if (acc.componentType !== 5121 || !acc.normalized) {
            needsPacking = true;
          }
        } else if (/^COLOR_\d+$/.test(name)) {
          if (acc.componentType !== 5121 || !acc.normalized) {
            needsPacking = true;
          }
        }
      }
    }
  }

  if (!needsPacking) {
    return buffer;
  }

  // Accessor (and image) references per bufferView: a view to be packed is replaced whole, so it must have one user.
  const viewRefs = new Map();
  const ref = (bv) => { if (bv !== undefined) viewRefs.set(bv, (viewRefs.get(bv) || 0) + 1); };
  for (const a of json.accessors) {
    ref(a.bufferView);
    if (a.sparse) { ref(a.sparse.indices.bufferView); ref(a.sparse.values.bufferView); }
  }
  for (const img of json.images || []) ref(img.bufferView);

  const replBufferViews = new Map();

  for (const mesh of json.meshes) {
    for (const prim of mesh.primitives) {
      for (const [name, accIdx] of Object.entries(prim.attributes)) {
        const acc = json.accessors[accIdx];
        if (acc.bufferView === undefined) throw new Error(`glb-pack: accessor ${accIdx} (${name}) has no bufferView`);

        if (name === 'NORMAL') {
          if (acc.componentType === 5120 && acc.normalized) continue;
          if (viewRefs.get(acc.bufferView) > 1) throw new Error(`glb-pack: accessor ${accIdx} (${name}) shares bufferView ${acc.bufferView} with ${viewRefs.get(acc.bufferView) - 1} other user(s); packing would replace the whole view`);

          const vals = readAccessor(doc, accIdx);
          const count = acc.count;
          const n8 = Buffer.alloc(count * 4);
          for (let i = 0; i < count; i++) {
            const x = Math.max(-128, Math.min(127, Math.round(vals[i * 3 + 0] * 127)));
            const y = Math.max(-128, Math.min(127, Math.round(vals[i * 3 + 1] * 127)));
            const z = Math.max(-128, Math.min(127, Math.round(vals[i * 3 + 2] * 127)));
            n8.writeInt8(x, i * 4 + 0);
            n8.writeInt8(y, i * 4 + 1);
            n8.writeInt8(z, i * 4 + 2);
          }

          replBufferViews.set(acc.bufferView, n8);
          acc.componentType = 5120;
          acc.normalized = true;
          delete acc.min;
          delete acc.max;
          delete acc.byteOffset;
          json.bufferViews[acc.bufferView].byteStride = 4;
        } else if (/^WEIGHTS_\d+$/.test(name)) {
          if (acc.componentType === 5121 && acc.normalized) continue;
          if (viewRefs.get(acc.bufferView) > 1) throw new Error(`glb-pack: accessor ${accIdx} (${name}) shares bufferView ${acc.bufferView} with ${viewRefs.get(acc.bufferView) - 1} other user(s); packing would replace the whole view`);

          const vals = readAccessor(doc, accIdx);
          const count = acc.count;
          const w8 = Buffer.alloc(count * 4);
          for (let i = 0; i < count; i++) {
            const w0 = vals[i * 4 + 0];
            const w1 = vals[i * 4 + 1];
            const w2 = vals[i * 4 + 2];
            const w3 = vals[i * 4 + 3];
            const sum = w0 + w1 + w2 + w3;
            if (Math.abs(sum - 1) > 0.01) {
              throw new Error(`glb-pack: accessor ${accIdx} vertex ${i} weights sum to ${sum}`);
            }
            const q = [
              Math.round(w0 * 255),
              Math.round(w1 * 255),
              Math.round(w2 * 255),
              Math.round(w3 * 255)
            ];
            const diff = 255 - (q[0] + q[1] + q[2] + q[3]);
            let maxIdx = 0;
            for (let k = 1; k < 4; k++) {
              if (q[k] > q[maxIdx]) maxIdx = k;
            }
            q[maxIdx] += diff;
            for (let k = 0; k < 4; k++) {
              w8.writeUInt8(Math.max(0, Math.min(255, q[k])), i * 4 + k);
            }
          }

          replBufferViews.set(acc.bufferView, w8);
          acc.componentType = 5121;
          acc.normalized = true;
          delete acc.min;
          delete acc.max;
          delete acc.byteOffset;
          delete json.bufferViews[acc.bufferView].byteStride;
        } else if (/^COLOR_\d+$/.test(name)) {
          if (acc.componentType === 5121 && acc.normalized) continue;
          if (viewRefs.get(acc.bufferView) > 1) throw new Error(`glb-pack: accessor ${accIdx} (${name}) shares bufferView ${acc.bufferView} with ${viewRefs.get(acc.bufferView) - 1} other user(s); packing would replace the whole view`);

          const vals = readAccessor(doc, accIdx);
          const count = acc.count;
          if (acc.type === 'VEC4') {
            const c8 = Buffer.alloc(count * 4);
            for (let i = 0; i < count; i++) {
              for (let k = 0; k < 4; k++) {
                const v = Math.max(0, Math.min(255, Math.round(vals[i * 4 + k] * 255)));
                c8.writeUInt8(v, i * 4 + k);
              }
            }
            replBufferViews.set(acc.bufferView, c8);
            delete json.bufferViews[acc.bufferView].byteStride;
          } else if (acc.type === 'VEC3') {
            const c8 = Buffer.alloc(count * 4);
            for (let i = 0; i < count; i++) {
              for (let k = 0; k < 3; k++) {
                const v = Math.max(0, Math.min(255, Math.round(vals[i * 3 + k] * 255)));
                c8.writeUInt8(v, i * 4 + k);
              }
            }
            replBufferViews.set(acc.bufferView, c8);
            json.bufferViews[acc.bufferView].byteStride = 4;
          }

          acc.componentType = 5121;
          acc.normalized = true;
          delete acc.min;
          delete acc.max;
          delete acc.byteOffset;
        }
      }
    }
  }

  // Extensions
  if (!json.extensionsUsed) json.extensionsUsed = [];
  if (!json.extensionsUsed.includes('KHR_mesh_quantization')) {
    json.extensionsUsed.push('KHR_mesh_quantization');
  }
  if (!json.extensionsRequired) json.extensionsRequired = [];
  if (!json.extensionsRequired.includes('KHR_mesh_quantization')) {
    json.extensionsRequired.push('KHR_mesh_quantization');
  }

  // Assemble BIN chunk
  const parts = [];
  let off = 0;
  for (let i = 0; i < json.bufferViews.length; i++) {
    const bv = json.bufferViews[i];
    let data;
    if (replBufferViews.has(i)) {
      data = replBufferViews.get(i);
    } else {
      const origOffset = bv.byteOffset || 0;
      data = bin.subarray(origOffset, origOffset + bv.byteLength);
    }
    bv.byteOffset = off;
    bv.byteLength = data.length;
    parts.push(data);
    off += data.length;
    const pad = (4 - (off % 4)) % 4;
    if (pad) {
      parts.push(Buffer.alloc(pad));
      off += pad;
    }
  }

  json.buffers[0].byteLength = off;

  // Assemble GLB
  let js = Buffer.from(JSON.stringify(json));
  const jsPad = (4 - (js.length % 4)) % 4;
  if (jsPad) {
    js = Buffer.concat([js, Buffer.alloc(jsPad, 0x20)]);
  }

  const totalLength = 12 + 8 + js.length + 8 + off;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const chunk0Header = Buffer.alloc(8);
  chunk0Header.writeUInt32LE(js.length, 0);
  chunk0Header.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const chunk1Header = Buffer.alloc(8);
  chunk1Header.writeUInt32LE(off, 0);
  chunk1Header.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  const nb = Buffer.concat(parts);
  return Buffer.concat([header, chunk0Header, js, chunk1Header, nb]);
}
