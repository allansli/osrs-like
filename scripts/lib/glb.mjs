import fs from 'node:fs';
import zlib from 'node:zlib';

const MAX_GLB_BYTES = 8 * 1024 * 1024; // 8 MiB
const GLB_MAGIC = 0x46546c67; // 'glTF' in ASCII LE
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON' in ASCII LE
const CHUNK_TYPE_BIN = 0x004e4942; // 'BIN\0' in ASCII LE

const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};

const COMPONENT_BYTES = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4 // FLOAT
};

const TYPED_ARRAYS = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};

/**
 * Reads, parses, and validates a GLB file or buffer.
 * Enforces magic, declared lengths, bufferView ranges, and accessor bounds.
 * Refuses files > 8 MiB.
 *
 * @param {string | Buffer} input - Path to file or raw GLB Buffer
 * @returns {object} Parsed GLB representation and stats
 */
export function readGlb(input) {
  const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);

  if (buffer.length > MAX_GLB_BYTES) {
    throw new Error(`File exceeds 8 MiB limit: ${buffer.length} bytes`);
  }

  if (buffer.length < 12) {
    throw new Error(`File truncated: buffer length ${buffer.length} < 12`);
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    throw new Error(`Invalid GLB magic: 0x${magic.toString(16)}`);
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  const declaredLength = buffer.readUInt32LE(8);
  if (buffer.length !== declaredLength) {
    throw new Error(`GLB length mismatch: declared ${declaredLength}, actual ${buffer.length}`);
  }

  // Read JSON chunk (chunk 0)
  if (buffer.length < 20) {
    throw new Error('File truncated: missing JSON chunk header');
  }

  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);

  if (jsonChunkType !== CHUNK_TYPE_JSON) {
    throw new Error(`First chunk must be JSON (0x4E4F534A), got 0x${jsonChunkType.toString(16)}`);
  }

  if (20 + jsonChunkLength > buffer.length) {
    throw new Error(`JSON chunk truncated: length ${jsonChunkLength} exceeds file`);
  }

  const jsonText = buffer.subarray(20, 20 + jsonChunkLength).toString('utf8');
  let json;
  try {
    json = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON in glTF: ${err.message}`);
  }

  // Read BIN chunk (chunk 1, optional in glTF, standard in GLB)
  let bin = Buffer.alloc(0);
  const jsonPaddedLength = Math.ceil(jsonChunkLength / 4) * 4;
  let offset = 20 + jsonPaddedLength;

  // In some exporters json chunk length is already padded, so check 20 + jsonChunkLength first
  if (offset > buffer.length && 20 + jsonChunkLength <= buffer.length) {
    offset = 20 + jsonChunkLength;
  }

  if (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      throw new Error('File truncated: missing BIN chunk header');
    }

    const binChunkLength = buffer.readUInt32LE(offset);
    const binChunkType = buffer.readUInt32LE(offset + 4);

    if (binChunkType !== CHUNK_TYPE_BIN) {
      throw new Error(`Second chunk must be BIN (0x004E4942), got 0x${binChunkType.toString(16)}`);
    }

    if (offset + 8 + binChunkLength > buffer.length) {
      throw new Error(`BIN chunk truncated: length ${binChunkLength} exceeds file`);
    }

    bin = buffer.subarray(offset + 8, offset + 8 + binChunkLength);
  }

  // Validate bufferViews against BIN chunk
  if (json.bufferViews) {
    for (let i = 0; i < json.bufferViews.length; i++) {
      const bv = json.bufferViews[i];
      if (bv.buffer !== 0) {
        throw new Error(`BufferView ${i} has buffer ${bv.buffer}; a GLB has only buffer 0`);
      }
      const bvOffset = bv.byteOffset ?? 0; // glTF default
      const bvLength = bv.byteLength;
      if (!Number.isInteger(bvOffset) || !Number.isInteger(bvLength) || bvOffset < 0 || bvLength < 0) {
        throw new Error(`BufferView ${i} has invalid byteOffset ${bvOffset} or byteLength ${bvLength}`);
      }
      if (bvOffset + bvLength > bin.length) {
        throw new Error(
          `BufferView ${i} range [${bvOffset}, ${bvOffset + bvLength}] exceeds BIN chunk length ${bin.length}`
        );
      }
    }
  }

  // Validate accessors against their bufferViews
  if (json.accessors) {
    for (let i = 0; i < json.accessors.length; i++) {
      const acc = json.accessors[i];
      if (!Number.isInteger(acc.count) || acc.count < 0) {
        throw new Error(`Accessor ${i} has invalid count ${acc.count}`);
      }
      if (acc.byteOffset !== undefined && (!Number.isInteger(acc.byteOffset) || acc.byteOffset < 0)) {
        throw new Error(`Accessor ${i} has invalid byteOffset ${acc.byteOffset}`);
      }
      if (acc.bufferView !== undefined) {
        if (!json.bufferViews || !json.bufferViews[acc.bufferView]) {
          throw new Error(`Accessor ${i} references missing bufferView ${acc.bufferView}`);
        }
        const bv = json.bufferViews[acc.bufferView];
        const numComponents = TYPE_COMPONENTS[acc.type];
        if (!numComponents) {
          throw new Error(`Accessor ${i} has unknown type '${acc.type}'`);
        }
        const bytesPerComponent = COMPONENT_BYTES[acc.componentType];
        if (!bytesPerComponent) {
          throw new Error(`Accessor ${i} has unknown componentType ${acc.componentType}`);
        }

        const elementSize = numComponents * bytesPerComponent;
        const stride = bv.byteStride || elementSize;
        const accOffset = acc.byteOffset || 0;
        if (accOffset < 0) {
          throw new Error(`Accessor ${i} has negative byteOffset ${accOffset}`);
        }

        const totalBytes = acc.count === 0 ? 0 : (acc.count - 1) * stride + elementSize;
        if (accOffset + totalBytes > bv.byteLength) {
          throw new Error(
            `Accessor ${i} range [${accOffset}, ${accOffset + totalBytes}] exceeds bufferView ${acc.bufferView} length ${bv.byteLength}`
          );
        }
      }
    }
  }

  // Calculate triangle counts
  let totalTriangles = 0;
  const meshTriangles = [];
  if (json.meshes) {
    for (let m = 0; m < json.meshes.length; m++) {
      const mesh = json.meshes[m];
      let mTri = 0;
      for (const prim of mesh.primitives || []) {
        const source = prim.indices ?? prim.attributes?.POSITION;
        if (source === undefined) {
          throw new Error(`Mesh ${m} has a primitive with neither indices nor POSITION`);
        }
        const acc = json.accessors?.[source];
        if (!acc || !Number.isInteger(acc.count)) {
          throw new Error(`Mesh ${m} primitive references missing or countless accessor ${source}`);
        }
        mTri += Math.floor(acc.count / 3);
      }
      meshTriangles.push(mTri);
      totalTriangles += mTri;
    }
  }

  // Calculate per-node triangles
  const nodeTriangles = [];
  if (json.nodes) {
    for (const node of json.nodes) {
      if (node.mesh !== undefined && meshTriangles[node.mesh] !== undefined) {
        nodeTriangles.push(meshTriangles[node.mesh]);
      } else {
        nodeTriangles.push(0);
      }
    }
  }

  // Calculate bounds per mesh
  const meshBounds = [];
  if (json.meshes) {
    for (const mesh of json.meshes) {
      let min = [Infinity, Infinity, Infinity];
      let max = [-Infinity, -Infinity, -Infinity];
      for (const prim of mesh.primitives || []) {
        if (prim.attributes && prim.attributes.POSITION !== undefined) {
          const acc = json.accessors[prim.attributes.POSITION];
          if (acc && acc.min && acc.max) {
            for (let c = 0; c < 3; c++) {
              min[c] = Math.min(min[c], acc.min[c]);
              max[c] = Math.max(max[c], acc.max[c]);
            }
          }
        }
      }
      meshBounds.push({ min, max });
    }
  }

  // Brotli quality 3 size
  const brotliBytes = zlib.brotliCompressSync(buffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 3
    }
  }).length;

  return {
    json,
    bin,
    rawBytes: buffer.length,
    brotliBytes,
    triangles: totalTriangles,
    meshTriangles,
    nodeTriangles,
    meshBounds
  };
}

/**
 * Reads accessor data from a parsed GLB as a typed array.
 *
 * @param {object} doc - Parsed GLB document from readGlb
 * @param {number} accessorIndex - Index in doc.json.accessors
 * @returns {ArrayLike<number>}
 */
export function readAccessor(doc, accessorIndex) {
  const acc = doc.json.accessors[accessorIndex];
  if (!acc) throw new Error(`Accessor ${accessorIndex} not found`);

  const numComponents = TYPE_COMPONENTS[acc.type];
  const bytesPerComponent = COMPONENT_BYTES[acc.componentType];
  const elementSize = numComponents * bytesPerComponent;
  const count = acc.count;

  if (acc.bufferView === undefined) {
    const TypedArrayConstructor = TYPED_ARRAYS[acc.componentType] || Float32Array;
    return new TypedArrayConstructor(count * numComponents);
  }

  const bv = doc.json.bufferViews[acc.bufferView];
  const stride = bv.byteStride || elementSize;
  const bvOffset = bv.byteOffset || 0;
  const accOffset = acc.byteOffset || 0;
  const start = bvOffset + accOffset;

  const bin = doc.bin;
  const absOffset = bin.byteOffset + start;
  const TypedArrayConstructor = TYPED_ARRAYS[acc.componentType];

  if (stride === elementSize && absOffset % bytesPerComponent === 0 && !acc.normalized) {
    return new TypedArrayConstructor(bin.buffer, absOffset, count * numComponents);
  }

  // Strided, unaligned, or normalized data
  const out = acc.normalized ? new Float32Array(count * numComponents) : new TypedArrayConstructor(count * numComponents);
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  let outIdx = 0;

  for (let i = 0; i < count; i++) {
    const elemStart = start + i * stride;
    for (let c = 0; c < numComponents; c++) {
      const pos = elemStart + c * bytesPerComponent;
      let val;
      switch (acc.componentType) {
        case 5120:
          val = view.getInt8(pos);
          if (acc.normalized) val = Math.max(val / 127.0, -1.0);
          break;
        case 5121:
          val = view.getUint8(pos);
          if (acc.normalized) val = val / 255.0;
          break;
        case 5122:
          val = view.getInt16(pos, true);
          if (acc.normalized) val = Math.max(val / 32767.0, -1.0);
          break;
        case 5123:
          val = view.getUint16(pos, true);
          if (acc.normalized) val = val / 65535.0;
          break;
        case 5125:
          val = view.getUint32(pos, true);
          break;
        case 5126:
          val = view.getFloat32(pos, true);
          break;
      }
      out[outIdx++] = val;
    }
  }

  return out;
}
