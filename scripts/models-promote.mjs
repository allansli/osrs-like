import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs() {
  const args = process.argv.slice(2);
  let yes = false;
  let buildDir = path.resolve('scratch/models-build');
  let modelsDir = path.resolve('public/models');
  let manifestDir = path.resolve('tests/fixtures/model-contract');
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--yes') {
      yes = true;
    } else if (arg === '--build-dir') {
      buildDir = path.resolve(args[++i]);
    } else if (arg.startsWith('--build-dir=')) {
      buildDir = path.resolve(arg.slice('--build-dir='.length));
    } else if (arg === '--models-dir') {
      modelsDir = path.resolve(args[++i]);
    } else if (arg.startsWith('--models-dir=')) {
      modelsDir = path.resolve(arg.slice('--models-dir='.length));
    } else if (arg === '--manifest-dir') {
      manifestDir = path.resolve(args[++i]);
    } else if (arg.startsWith('--manifest-dir=')) {
      manifestDir = path.resolve(arg.slice('--manifest-dir='.length));
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  const name = positional[0];
  return { name, yes, buildDir, modelsDir, manifestDir };
}

function main() {
  const { name, yes, buildDir, modelsDir, manifestDir } = parseArgs();

  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    console.error(`Invalid model name '${name}': must match /^[a-zA-Z0-9_-]+$/`);
    process.exit(1);
  }

  const liveManifest = path.join(manifestDir, `${name}.json`);
  const pendingManifest = path.join(manifestDir, 'pending', `${name}.json`);

  if (!fs.existsSync(liveManifest) && !fs.existsSync(pendingManifest)) {
    console.error(`Model '${name}' not found in manifest directory: ${manifestDir}`);
    process.exit(1);
  }

  if (!yes) {
    console.error(`Refusing to promote '${name}' without --yes`);
    process.exit(1);
  }

  const builtGlb = path.join(buildDir, `${name}.glb`);
  const targetGlb = path.join(modelsDir, `${name}.glb`);

  if (!fs.existsSync(builtGlb)) {
    console.error(`Built model file not found: ${builtGlb}`);
    process.exit(1);
  }

  // Run compare
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const compareScript = path.join(currentDir, 'models-compare.mjs');
  const compareRes = spawnSync(
    process.execPath,
    [compareScript, builtGlb, targetGlb, '--manifest-dir', manifestDir],
    { encoding: 'utf8' }
  );

  if (compareRes.stdout) process.stdout.write(compareRes.stdout);
  if (compareRes.stderr) process.stderr.write(compareRes.stderr);

  if (compareRes.status !== 0) {
    console.error(`Compare failed with exit code ${compareRes.status}; promotion aborted.`);
    process.exit(compareRes.status || 1);
  }

  // Atomic copy to target
  fs.mkdirSync(modelsDir, { recursive: true });
  const tmpGlb = `${targetGlb}.tmp`;
  fs.copyFileSync(builtGlb, tmpGlb);
  fs.renameSync(tmpGlb, targetGlb);

  // Copy .blend if present in buildDir and blender directory exists
  const builtBlend = path.join(buildDir, `${name}.blend`);
  const blenderDir = path.resolve('blender');
  if (fs.existsSync(blenderDir) && fs.existsSync(builtBlend)) {
    const targetBlend = path.join(blenderDir, `${name}.blend`);
    const tmpBlend = `${targetBlend}.tmp`;
    fs.copyFileSync(builtBlend, tmpBlend);
    fs.renameSync(tmpBlend, targetBlend);
  }

  // Move pending manifest over live manifest if pending exists
  if (fs.existsSync(pendingManifest)) {
    fs.renameSync(pendingManifest, liveManifest);
  }

  // Compute SHA-256 and print ?v= key
  const finalBytes = fs.readFileSync(targetGlb);
  const sha = createHash('sha256').update(finalBytes).digest('hex');
  console.log(`Promoted ${name}: ${sha}`);
  console.log(`?v=${sha.slice(0, 8)}`);
}

main();
