import fs from 'node:fs';
import path from 'node:path';
import { readGlb, readAccessor } from './lib/glb.mjs';

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

function vec3Close(a, b, tol = 0.0001) {
  return (
    Math.abs((a[0] || 0) - (b[0] || 0)) <= tol &&
    Math.abs((a[1] || 0) - (b[1] || 0)) <= tol &&
    Math.abs((a[2] || 0) - (b[2] || 0)) <= tol
  );
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

function main() {
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
  if (shippedPath && fs.existsSync(shippedPath)) {
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
        if (targetNode?.name) movedNodeNames.add(targetNode.name);
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
      const skinIndex = meshNode?.skin ?? (skins.length === 1 ? 0 : undefined);
      const skinObj = skinIndex !== undefined ? skins[skinIndex] : skins[0];
      const maxJointIndex = (skinObj?.joints?.length || 0) - 1;

      for (const prim of mesh.primitives || []) {
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
        if (!anim) continue;
        for (const channel of anim.channels || []) {
          if (channel.target?.path === 'translation') {
            const targetNode = builtNodes[channel.target.node];
            if (targetNode?.name !== 'Hips') {
              contractErrors.push(
                `Clip '${clipName}' has position track on bone '${targetNode?.name || channel.target.node}' (only 'Hips' allowed)`
              );
            }
          }
        }
      }
    }

    // 6e. Limbs angle check
    if (skinDef.limbs) {
      const maxDeg = skinDef.maxLimbDegrees ?? 20;
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

    for (const [metric, ceiling] of Object.entries(manifest.budget)) {
      const actual = actualBudget[metric];
      if (actual !== undefined && actual > ceiling) {
        budgetErrors.push(
          `Budget ceiling exceeded for '${metric}': actual ${actual} > ceiling ${ceiling}`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Drift Checks (built vs shipped)
  // ---------------------------------------------------------------------------------------------

  if (shipped) {
    // 1. Generator
    if (built.json.asset?.generator !== shipped.json.asset?.generator) {
      driftNotes.push(
        `generator: '${shipped.json.asset?.generator || 'none'}' -> '${built.json.asset?.generator || 'none'}'`
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
        const bR = bNode.rotation || [0, 0, 0, 1];
        const sR = sNode.rotation || [0, 0, 0, 1];
        if (!vec3Close(bR.slice(0, 3), sR.slice(0, 3), 0.0001) || Math.abs((bR[3] || 1) - (sR[3] || 1)) > 0.0001) {
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
    driftNotes.length === 0
      ? 'Zero drift detected against shipped file.'
      : driftNotes.map((d) => `- ${d}`).join('\n'),
    ''
  ].join('\n');

  const reportPath = path.join(path.dirname(builtPath), `${name}.report.md`);
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

main();
