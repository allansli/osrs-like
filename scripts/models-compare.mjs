import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, readAccessor, brotli3Bytes } from './lib/glb.mjs';

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const BUDGET_KEYS = ['triangles', 'meshes', 'materials', 'rawBytes', 'brotliBytes'];
const MANIFEST_KEYS = ['nodes', 'materials', 'toggled', 'meshClasses', 'extras', 'centres', 'vertexColor', 'clips', 'skin', 'budget', 'figures'];
const SKIN_KEYS = ['skeleton', 'bones', 'skinnedRoots', 'sharedClips', 'limbs', 'maxLimbDegrees', 'attackClips'];

/** A key compare does not read would pass unchecked, so it refuses the manifest (exit 3). */
function refuseUnknownKeys(obj, allowed, where) {
  for (const key of Object.keys(obj ?? {})) {
    if (!allowed.includes(key)) throw new Error(`${where} has unknown key '${key}'`);
  }
}

/** Pushes one Budget error per metric over its ceiling; an unknown metric or a non-numeric ceiling refuses (exit 3). */
function checkCeilings(ceilings, actual, where, suffix, errors) {
  refuseUnknownKeys(ceilings, BUDGET_KEYS, where);
  for (const [metric, ceiling] of Object.entries(ceilings)) {
    if (!Number.isFinite(ceiling)) throw new Error(`${where} '${metric}' is not a number`);
    if (actual[metric] > ceiling) {
      errors.push(`Budget ceiling exceeded for '${metric}'${suffix}: actual ${actual[metric]} > ceiling ${ceiling}`);
    }
  }
}

function isInside(p, dir) {
  const r = path.relative(dir, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

/** Triangles, meshes, materials, raw and Brotli quality 3 bytes of the meshes in the subtree of one root node. */
export function figureStats(doc, rootIdx) {
  const nodes = doc.json.nodes || [];
  const stack = [rootIdx];
  const seen = new Set();
  const stats = { triangles: 0, meshes: 0 };
  const materials = new Set();
  const views = new Set();
  const addAccessor = (a) => {
    const v = doc.json.accessors[a]?.bufferView;
    if (v !== undefined) views.add(v);
  };
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i)) throw new Error(`Node ${i} is reached twice under figure root ${rootIdx} (a cycle or a shared child)`);
    seen.add(i);
    const node = nodes[i];
    if (!node) throw new Error(`Node index ${i} under figure root ${rootIdx} does not exist`);
    stack.push(...(node.children || []));
    if (node.skin !== undefined) addAccessor(doc.json.skins[node.skin].inverseBindMatrices);
    if (node.mesh === undefined) continue;
    stats.triangles += doc.nodeTriangles[i];
    stats.meshes++;
    for (const prim of doc.json.meshes[node.mesh].primitives || []) {
      if (prim.material !== undefined) materials.add(prim.material);
      Object.values(prim.attributes || {}).forEach(addAccessor);
      if (prim.indices !== undefined) addAccessor(prim.indices);
    }
  }
  const bytes = Buffer.concat(
    [...views].sort((a, b) => a - b).map((v) => {
      const bv = doc.json.bufferViews[v];
      return doc.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    })
  );
  return { ...stats, materials: materials.size, rawBytes: bytes.length, brotliBytes: brotli3Bytes(bytes) };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let manifestDir = path.resolve('tests/fixtures/model-contract');
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--manifest-dir') {
      manifestDir = path.resolve(args[++i]);
    } else if (arg.startsWith('--manifest-dir=')) {
      manifestDir = path.resolve(arg.slice('--manifest-dir='.length));
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length < 1) {
    console.error('Usage: node scripts/models-compare.mjs <built.glb> [shipped.glb] [--manifest-dir <dir>]');
    process.exit(3);
  }

  return {
    builtPath: path.resolve(positional[0]),
    shippedPath: positional[1] ? path.resolve(positional[1]) : null,
    manifestDir
  };
}

function findParentNodeName(nodes, childIndex) {
  const parent = nodes.find((n) => n.children?.includes(childIndex));
  return parent ? parent.name : null;
}

function vecClose(a, b, tol = 0.0001) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) && Math.abs(v - b[i]) <= tol);
}

function vec3Close(a, b, tol = 0.0001) {
  return Array.isArray(a) && a.length === 3 && vecClose(a, b, tol);
}

/** sha256 over every accessor's bytes of one mesh (attribute names sorted, then indices), per primitive. */
function geometryHash(doc, mesh) {
  const h = createHash('sha256');
  for (const prim of mesh.primitives || []) {
    for (const key of Object.keys(prim.attributes || {}).sort()) {
      h.update(key);
      const a = readAccessor(doc, prim.attributes[key]);
      h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    }
    if (prim.indices !== undefined) {
      const a = readAccessor(doc, prim.indices);
      h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    }
  }
  return h.digest('hex');
}

function isIdentityQuat(r, tol = 0.0001) {
  if (!r) return true;
  const [x, y, z, w] = r;
  return (
    Math.abs(x) <= tol &&
    Math.abs(y) <= tol &&
    Math.abs(z) <= tol &&
    (Math.abs(w - 1) <= tol || Math.abs(w + 1) <= tol)
  );
}

function run() {
  const { builtPath, shippedPath, manifestDir } = parseArgs();

  // Read built GLB
  let built;
  try {
    built = readGlb(builtPath);
  } catch (err) {
    console.error(`Error reading built file ${builtPath}: ${err.message}`);
    process.exit(3);
  }

  // Read shipped GLB if provided and exists
  let shipped = null;
  if (shippedPath && !fs.existsSync(shippedPath)) {
    console.error(`Shipped file not found: ${shippedPath}`);
    process.exit(3);
  }
  if (shippedPath) {
    try {
      shipped = readGlb(shippedPath);
    } catch (err) {
      console.error(`Error reading shipped file ${shippedPath}: ${err.message}`);
      process.exit(3);
    }
  }

  // Load manifest
  const name = path.basename(builtPath, '.glb');
  const pendingManifestPath = path.join(manifestDir, 'pending', `${name}.json`);
  const liveManifestPath = path.join(manifestDir, `${name}.json`);
  const manifestPath = fs.existsSync(pendingManifestPath) ? pendingManifestPath : liveManifestPath;

  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest file not found: ${manifestPath} (checked pending and live)`);
    process.exit(3);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing manifest ${manifestPath}: ${err.message}`);
    process.exit(3);
  }

  refuseUnknownKeys(manifest, MANIFEST_KEYS, 'Manifest');
  refuseUnknownKeys(manifest.skin, SKIN_KEYS, 'Manifest skin');
  for (const [clipName, clipInfo] of Object.entries(manifest.clips ?? {})) {
    refuseUnknownKeys(clipInfo, ['moves'], `Manifest clip '${clipName}'`);
  }

  const contractErrors = [];
  const budgetErrors = [];
  const driftNotes = [];

  const builtNodes = built.json.nodes || [];
  const nodeIndexMap = new Map();
  builtNodes.forEach((n, idx) => {
    if (n.name) nodeIndexMap.set(n.name, idx);
  });

  // ---------------------------------------------------------------------------------------------
  // Contract Checks
  // ---------------------------------------------------------------------------------------------

  // 1. Nodes check (presence, parent, translation, scale)
  if (manifest.nodes) {
    for (const [nodeName, expected] of Object.entries(manifest.nodes)) {
      const idx = nodeIndexMap.get(nodeName);
      if (idx === undefined) {
        contractErrors.push(`Missing node '${nodeName}'`);
        continue;
      }
      const actualNode = builtNodes[idx];

      if (expected.parent !== undefined) {
        const actualParent = findParentNodeName(builtNodes, idx);
        if (actualParent !== expected.parent) {
          contractErrors.push(
            `Node '${nodeName}' parent mismatch: expected '${expected.parent}', got '${actualParent}'`
          );
        }
      }

      const actualT = actualNode.translation || [0, 0, 0];
      const expT = expected.translation || [0, 0, 0];
      if (!vec3Close(actualT, expT, 0.0001)) {
        contractErrors.push(
          `Node '${nodeName}' translation [${actualT.join(', ')}] deviates from manifest [${expT.join(', ')}]`
        );
      }

      const actualS = actualNode.scale || [1, 1, 1];
      const expS = expected.scale || [1, 1, 1];
      if (!vec3Close(actualS, expS, 0.0001)) {
        contractErrors.push(
          `Node '${nodeName}' scale [${actualS.join(', ')}] deviates from manifest [${expS.join(', ')}]`
        );
      }
    }
  }

  // 2. Materials check
  if (manifest.materials) {
    const actualMaterialNames = new Set((built.json.materials || []).map((m) => m.name));
    for (const mat of manifest.materials) {
      if (!actualMaterialNames.has(mat)) {
        contractErrors.push(`Missing material '${mat}'`);
      }
    }
    for (const mat of actualMaterialNames) {
      if (!manifest.materials.includes(mat)) {
        contractErrors.push(`Material '${mat}' is not in the manifest (materials are an exact set)`);
      }
    }
  }

  // 3. Toggled names (must exist as node name or mesh name)
  if (manifest.toggled) {
    const allNodeNames = new Set(builtNodes.map((n) => n.name));
    const allMeshNames = new Set((built.json.meshes || []).map((m) => m.name));
    for (const toggled of manifest.toggled) {
      if (!allNodeNames.has(toggled) && !allMeshNames.has(toggled)) {
        contractErrors.push(`Toggled node or mesh name '${toggled}' is missing`);
      }
    }
  }

  // 3b. Mesh name classes: every mesh name matches one manifest regex
  if (manifest.meshClasses) {
    const classes = manifest.meshClasses.map((c) => new RegExp(c));
    for (const mesh of built.json.meshes || []) {
      if (!classes.some((re) => re.test(mesh.name))) {
        contractErrors.push(`Mesh '${mesh.name}' matches no manifest mesh name class`);
      }
    }
  }

  // 3c. extras keys: { <node name>: [keys] }, each key present on that node
  if (manifest.extras) {
    for (const [nodeName, keys] of Object.entries(manifest.extras)) {
      const idx = nodeIndexMap.get(nodeName);
      if (idx === undefined) {
        contractErrors.push(`Missing node '${nodeName}' (extras)`);
        continue;
      }
      for (const key of keys) {
        if (!Object.hasOwn(builtNodes[idx].extras ?? {}, key)) {
          contractErrors.push(`Node '${nodeName}' lacks extras key '${key}'`);
        }
      }
    }
  }

  // 3d. Part centres: { <mesh node name>: [x,y,z] }, the centre of the mesh bounds scaled and moved by the node
  // (in the parent's space, tolerance 0.01). A rotated node is refused: its centre would need the rotation.
  if (manifest.centres) {
    for (const [nodeName, expected] of Object.entries(manifest.centres)) {
      const idx = nodeIndexMap.get(nodeName);
      const node = idx === undefined ? undefined : builtNodes[idx];
      if (!node || node.mesh === undefined) {
        contractErrors.push(`Part '${nodeName}' for a centre check is missing or has no mesh`);
        continue;
      }
      if (node.rotation && !isIdentityQuat(node.rotation)) {
        contractErrors.push(`Part '${nodeName}' is rotated; its centre cannot be checked`);
        continue;
      }
      const { min, max } = built.meshBounds[node.mesh];
      if (![...min, ...max].every(Number.isFinite)) {
        contractErrors.push(`Part '${nodeName}' mesh has no POSITION min/max`);
        continue;
      }
      const t = node.translation ?? [0, 0, 0];
      const sc = node.scale ?? [1, 1, 1];
      const centre = [0, 1, 2].map((c) => ((min[c] + max[c]) / 2) * sc[c] + t[c]);
      if (!vec3Close(centre, expected, 0.01)) {
        contractErrors.push(
          `Part '${nodeName}' centre [${centre.map((v) => v.toFixed(4)).join(', ')}] deviates from manifest [${expected.join(', ')}]`
        );
      }
    }
  }

  // 3e. At most 4 influences per vertex: no primitive may carry a second joint or weight set
  for (const mesh of built.json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.attributes?.JOINTS_1 !== undefined || prim.attributes?.WEIGHTS_1 !== undefined) {
        contractErrors.push(`Mesh '${mesh.name}' has JOINTS_1 or WEIGHTS_1 (at most 4 influences per vertex)`);
      }
    }
  }

  // 4. Vertex color: all or none
  let totalPrimitives = 0;
  let colorPrimitives = 0;
  for (const mesh of built.json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      totalPrimitives++;
      if (prim.attributes && prim.attributes.COLOR_0 !== undefined) {
        colorPrimitives++;
      }
    }
  }

  if (colorPrimitives > 0 && colorPrimitives < totalPrimitives) {
    contractErrors.push(
      `COLOR_0 on ${colorPrimitives} of ${totalPrimitives} mesh primitives (must be all or none)`
    );
  }
  if (manifest.vertexColor === 'all' && colorPrimitives !== totalPrimitives) {
    contractErrors.push(
      `Manifest requires vertexColor 'all', but COLOR_0 is present on ${colorPrimitives}/${totalPrimitives} primitives`
    );
  }
  if (manifest.vertexColor === 'none' && colorPrimitives > 0) {
    contractErrors.push(
      `Manifest requires vertexColor 'none', but COLOR_0 is present on ${colorPrimitives} primitives`
    );
  }

  // 5. Animations / clips
  if (manifest.clips) {
    const animations = built.json.animations || [];
    for (const [clipName, clipInfo] of Object.entries(manifest.clips)) {
      const anim = animations.find((a) => a.name === clipName);
      if (!anim) {
        contractErrors.push(`Missing clip '${clipName}'`);
        continue;
      }
      const movedNodeNames = new Set();
      for (const channel of anim.channels || []) {
        const targetNode = builtNodes[channel.target?.node];
        if (!targetNode?.name) {
          contractErrors.push(`Clip '${clipName}' has a channel whose target node is missing or unnamed`);
          continue;
        }
        movedNodeNames.add(targetNode.name);
      }
      for (const expectedNode of clipInfo.moves || []) {
        if (!movedNodeNames.has(expectedNode)) {
          contractErrors.push(`Clip '${clipName}' does not move expected node '${expectedNode}'`);
        }
      }
    }
  }

  // 6. Skin rules
  if (manifest.skin) {
    const skinDef = manifest.skin;

    // 6a. Bones: presence, parent, translation, rest rotation
    if (skinDef.bones) {
      for (const [boneName, expectedBone] of Object.entries(skinDef.bones)) {
        const idx = nodeIndexMap.get(boneName);
        if (idx === undefined) {
          contractErrors.push(`Missing bone '${boneName}'`);
          continue;
        }
        const boneNode = builtNodes[idx];

        if (expectedBone.parent !== undefined) {
          const actualParent = findParentNodeName(builtNodes, idx);
          const isExpected =
            actualParent === expectedBone.parent ||
            (expectedBone.parent === null &&
              (actualParent === null ||
                skinDef.skinnedRoots?.includes(actualParent) ||
                !skinDef.bones[actualParent]));
          if (!isExpected) {
            contractErrors.push(
              `Bone '${boneName}' parent mismatch: expected '${expectedBone.parent}', got '${actualParent}'`
            );
          }
        }

        const actualT = boneNode.translation || [0, 0, 0];
        const expT = expectedBone.translation || [0, 0, 0];
        if (!vec3Close(actualT, expT, 0.0001)) {
          contractErrors.push(
            `Bone '${boneName}' translation [${actualT.join(', ')}] deviates from manifest [${expT.join(', ')}]`
          );
        }

        if (boneNode.rotation && !isIdentityQuat(boneNode.rotation, 0.0001)) {
          contractErrors.push(
            `Bone '${boneName}' rest rotation [${boneNode.rotation.join(', ')}] is not identity`
          );
        }
      }
    }

    // 6b. Skinned roots: no translation, rotation, scale
    if (skinDef.skinnedRoots) {
      for (const rootName of skinDef.skinnedRoots) {
        const idx = nodeIndexMap.get(rootName);
        if (idx === undefined) {
          contractErrors.push(`Missing skinned root '${rootName}'`);
          continue;
        }
        const rootNode = builtNodes[idx];
        if (rootNode.translation && !vec3Close(rootNode.translation, [0, 0, 0], 0.0001)) {
          contractErrors.push(
            `Skinned root node '${rootName}' translation [${rootNode.translation.join(', ')}] must be zero`
          );
        }
        if (rootNode.rotation && !isIdentityQuat(rootNode.rotation, 0.0001)) {
          contractErrors.push(
            `Skinned root node '${rootName}' rotation [${rootNode.rotation.join(', ')}] must be identity`
          );
        }
        if (rootNode.scale && !vec3Close(rootNode.scale, [1, 1, 1], 0.0001)) {
          contractErrors.push(
            `Skinned root node '${rootName}' scale [${rootNode.scale.join(', ')}] must be [1, 1, 1]`
          );
        }
      }
    }

    // 6c. Vertex weights and joint indices
    const skins = built.json.skins || [];
    for (let m = 0; m < (built.json.meshes || []).length; m++) {
      const mesh = built.json.meshes[m];
      const meshNode = builtNodes.find((n) => n.mesh === m);
      const skinObj = meshNode?.skin === undefined ? undefined : skins[meshNode.skin];
      const maxJointIndex = (skinObj?.joints?.length ?? 0) - 1;

      for (const prim of mesh.primitives || []) {
        if (prim.attributes?.JOINTS_0 !== undefined && !skinObj) {
          contractErrors.push(`Mesh '${mesh.name}' has JOINTS_0 but its node has no valid skin`);
          continue;
        }
        if (prim.attributes && prim.attributes.WEIGHTS_0 !== undefined) {
          const weights = readAccessor(built, prim.attributes.WEIGHTS_0);
          const vertexCount = built.json.accessors[prim.attributes.WEIGHTS_0].count;
          for (let v = 0; v < vertexCount; v++) {
            const sum = weights[v * 4] + weights[v * 4 + 1] + weights[v * 4 + 2] + weights[v * 4 + 3];
            if (Math.abs(sum - 1.0) > 0.01) {
              contractErrors.push(
                `WEIGHTS_0: vertex ${v} weights sum to ${sum.toFixed(4)} (must sum to 1 ± 0.01)`
              );
              break;
            }
          }
        }

        if (prim.attributes && prim.attributes.JOINTS_0 !== undefined) {
          const joints = readAccessor(built, prim.attributes.JOINTS_0);
          const vertexCount = built.json.accessors[prim.attributes.JOINTS_0].count;
          let jointError = false;
          for (let v = 0; v < vertexCount; v++) {
            for (let c = 0; c < 4; c++) {
              const j = joints[v * 4 + c];
              if (j < 0 || j > maxJointIndex) {
                contractErrors.push(
                  `JOINTS_0: vertex ${v} joint index ${j} outside skin range 0..${maxJointIndex}`
                );
                jointError = true;
                break;
              }
            }
            if (jointError) break;
          }
        }
      }
    }

    // 6d. Shared clips: translation track only on Hips
    if (skinDef.sharedClips) {
      const animations = built.json.animations || [];
      for (const clipName of skinDef.sharedClips) {
        const anim = animations.find((a) => a.name === clipName);
        if (!anim) {
          contractErrors.push(`Shared clip '${clipName}' is missing`);
          continue;
        }
        for (const channel of anim.channels || []) {
          if (channel.target?.path === 'translation') {
            const targetNode = builtNodes[channel.target.node];
            if (targetNode?.name !== 'Hips') {
              contractErrors.push(
                `Clip '${clipName}' has position track on ${targetNode ? `bone '${targetNode.name}'` : `missing node ${channel.target.node}`} (only 'Hips' allowed)`
              );
            }
          }
        }
      }
    }

    // 6d2. Attack clips: { <clip>: anticipation seconds }. The clip must exist, the time must lie strictly inside it
    // and fall on one of its keyframes (the wind-up scrub stops there, so a time between keys would stop between poses).
    for (const [clipName, time] of Object.entries(skinDef.attackClips ?? {})) {
      if (!Number.isFinite(time) || time <= 0) throw new Error(`Manifest attack clip '${clipName}' needs a positive numeric anticipation time`);
      const anim = (built.json.animations || []).find((a) => a.name === clipName);
      if (!anim) {
        contractErrors.push(`Attack clip '${clipName}' is missing`);
        continue;
      }
      const inputs = (anim.samplers || []).map((smp) => readAccessor(built, smp.input));
      const duration = Math.max(0, ...inputs.map((t) => (t.length ? t[t.length - 1] : 0)));
      if (time >= duration) {
        contractErrors.push(`Attack clip '${clipName}' anticipation ${time} s is not before its end at ${duration} s`);
      } else if (!inputs.some((t) => Array.from(t).some((k) => Math.abs(k - time) <= 0.001))) {
        contractErrors.push(`Attack clip '${clipName}' has no keyframe at its anticipation time ${time} s`);
      }
    }

    // 6e. Limbs angle check
    if (skinDef.limbs) {
      const maxDeg = skinDef.maxLimbDegrees;
      if (!Number.isFinite(maxDeg)) {
        throw new Error('Manifest has skin.limbs but no numeric skin.maxLimbDegrees');
      }
      for (const limb of skinDef.limbs) {
        const childIdx = nodeIndexMap.get(limb.child);
        if (childIdx === undefined) {
          contractErrors.push(`Limb child bone '${limb.child}' of '${limb.bone}' not found`);
          continue;
        }
        const childNode = builtNodes[childIdx];
        const t = childNode.translation || [0, 0, 0];
        const len = Math.hypot(t[0], t[1], t[2]);
        if (len > 0.00001) {
          const actualDir = [t[0] / len, t[1] / len, t[2] / len];
          const expDir = limb.direction;
          const dot = actualDir[0] * expDir[0] + actualDir[1] * expDir[1] + actualDir[2] * expDir[2];
          const clamped = Math.max(-1, Math.min(1, dot));
          const deg = Math.acos(clamped) * (180 / Math.PI);
          if (deg > maxDeg + 0.001) {
            contractErrors.push(
              `Limb on '${limb.bone}' -> '${limb.child}' angle ${deg.toFixed(1)}° exceeds limit ${maxDeg}°`
            );
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Budget Checks
  // ---------------------------------------------------------------------------------------------

  if (manifest.budget) {
    const actualBudget = {
      triangles: built.triangles,
      meshes: built.json.meshes?.length || 0,
      materials: built.json.materials?.length || 0,
      rawBytes: built.rawBytes,
      brotliBytes: built.brotliBytes
    };

    checkCeilings(manifest.budget, actualBudget, 'Manifest budget', '', budgetErrors);
  }

  // Per figure: { <figure root node name>: { triangles, meshes, materials, rawBytes, brotliBytes } }, summed over
  // the mesh nodes under that root; bytes are the buffer views its meshes and skin read (shared views once).
  for (const [rootName, ceilings] of Object.entries(manifest.figures ?? {})) {
    const idx = nodeIndexMap.get(rootName);
    if (idx === undefined) {
      refuseUnknownKeys(ceilings, BUDGET_KEYS, `Manifest figure '${rootName}'`);
      budgetErrors.push(`Figure root '${rootName}' is missing, its budget cannot be checked`);
      continue;
    }
    checkCeilings(ceilings, figureStats(built, idx), `Manifest figure '${rootName}'`, ` of figure '${rootName}'`, budgetErrors);
  }

  // ---------------------------------------------------------------------------------------------
  // Drift Checks (built vs shipped)
  // ---------------------------------------------------------------------------------------------

  if (shipped) {
    // 1. Generator
    if (built.json.asset?.generator !== shipped.json.asset?.generator) {
      driftNotes.push(
        `generator: ${JSON.stringify(shipped.json.asset?.generator)} -> ${JSON.stringify(built.json.asset?.generator)}`
      );
    }

    // 2. Nodes
    const shippedNodes = shipped.json.nodes || [];
    for (const bNode of builtNodes) {
      if (!bNode.name) continue;
      const sNode = shippedNodes.find((n) => n.name === bNode.name);
      if (!sNode) {
        driftNotes.push(`Node '${bNode.name}' added`);
      } else {
        const bT = bNode.translation || [0, 0, 0];
        const sT = sNode.translation || [0, 0, 0];
        if (!vec3Close(bT, sT, 0.0001)) {
          driftNotes.push(
            `Node '${bNode.name}' translation changed: [${sT.join(', ')}] -> [${bT.join(', ')}]`
          );
        }
        const bR = bNode.rotation ?? [0, 0, 0, 1]; // glTF default rotation is identity
        const sR = sNode.rotation ?? [0, 0, 0, 1];
        if (!vecClose(bR, sR, 0.0001)) {
          driftNotes.push(`Node '${bNode.name}' rotation changed`);
        }
        const bS = bNode.scale || [1, 1, 1];
        const sS = sNode.scale || [1, 1, 1];
        if (!vec3Close(bS, sS, 0.0001)) {
          driftNotes.push(
            `Node '${bNode.name}' scale changed: [${sS.join(', ')}] -> [${bS.join(', ')}]`
          );
        }
      }
    }
    for (const sNode of shippedNodes) {
      if (sNode.name && !builtNodes.find((n) => n.name === sNode.name)) {
        driftNotes.push(`Node '${sNode.name}' removed`);
      }
    }

    // 2b. Per mesh: bounds and geometry hash (by mesh name)
    const shippedMeshes = shipped.json.meshes || [];
    (built.json.meshes || []).forEach((bMesh, bi) => {
      const si = shippedMeshes.findIndex((m) => m.name === bMesh.name);
      if (si < 0) {
        driftNotes.push(`Mesh '${bMesh.name}' added`);
        return;
      }
      const bb = built.meshBounds[bi];
      const sb = shipped.meshBounds[si];
      if (!vecClose(bb.min, sb.min) || !vecClose(bb.max, sb.max)) {
        driftNotes.push(
          `Mesh '${bMesh.name}' bounds changed: [${sb.min.join(', ')}]..[${sb.max.join(', ')}] -> [${bb.min.join(', ')}]..[${bb.max.join(', ')}]`
        );
      }
      if (geometryHash(built, bMesh) !== geometryHash(shipped, shippedMeshes[si])) {
        driftNotes.push(`Mesh '${bMesh.name}' geometry bytes changed`);
      }
    });
    for (const sMesh of shippedMeshes) {
      if (!(built.json.meshes || []).some((m) => m.name === sMesh.name)) {
        driftNotes.push(`Mesh '${sMesh.name}' removed`);
      }
    }

    // 3. Stats drift
    if (built.triangles !== shipped.triangles) {
      driftNotes.push(`triangles changed: ${shipped.triangles} -> ${built.triangles}`);
    }
    if (built.rawBytes !== shipped.rawBytes) {
      driftNotes.push(`rawBytes changed: ${shipped.rawBytes} -> ${built.rawBytes}`);
    }
    if (built.brotliBytes !== shipped.brotliBytes) {
      driftNotes.push(`brotliBytes changed: ${shipped.brotliBytes} -> ${built.brotliBytes}`);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Generate Report
  // ---------------------------------------------------------------------------------------------

  const report = [
    `# Model Compare Report: ${name}`,
    '',
    '## Contract',
    contractErrors.length === 0
      ? 'All contract checks passed.'
      : contractErrors.map((e) => `- FAIL: ${e}`).join('\n'),
    '',
    '## Budget',
    budgetErrors.length === 0
      ? 'All budget checks passed.'
      : budgetErrors.map((e) => `- FAIL: ${e}`).join('\n'),
    '',
    '## Drift',
    !shipped
      ? 'No shipped file given, so Drift was not checked.'
      : driftNotes.length === 0
        ? 'Zero drift detected against shipped file.'
        : driftNotes.map((d) => `- ${d}`).join('\n'),
    ''
  ].join('\n');

  // The report goes next to the built file, except inside public/ or blender/ (shipped folders, rule 0.3.2):
  // a report for a file there goes to scratch/models-build/ instead.
  let reportDir = fs.realpathSync(path.dirname(builtPath));
  if (['public', 'blender'].some((d) => isInside(reportDir, path.join(ROOT, d)))) {
    reportDir = path.join(ROOT, 'scratch', 'models-build');
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `${name}.report.md`);
  fs.writeFileSync(reportPath, report, 'utf8');
  process.stdout.write(report);

  if (contractErrors.length > 0) {
    process.exit(1);
  } else if (budgetErrors.length > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

function main() {
  if (process.argv[1] !== fileURLToPath(import.meta.url)) return; // imported for figureStats, not run
  try {
    run();
  } catch (err) {
    // Malformed input (file or manifest) is refused, never reported as a Contract difference.
    console.error(`Refused: ${err.message}`);
    process.exit(3);
  }
}

main();
