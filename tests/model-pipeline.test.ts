// Pipeline tests (models pass, task P1). Red until P2 (run-blender --out, --factory-startup, guard mode)
// and P3 (scripts/models-compare.mjs, scripts/models-promote.mjs) land.
//
// Interfaces these tests fix for P2 and P3:
//   run-blender.mjs:   <mode> [target] [--out <dir>] in any order after the mode; every build, export and guard spawn
//                      ends with `-- --out <absolute dir>` (default <repo>/scratch/models-build); the export spawn
//                      also carries the target name after the `--`; every --background spawn has --factory-startup
//                      right after it; `guard` is a mode that `all` does not run.
//   models-compare:    node scripts/models-compare.mjs <built.glb> <shipped.glb> [--manifest-dir <dir>]
//                      manifest = <dir>/pending/<name>.json if it exists, else <dir>/<name>.json (default dir:
//                      tests/fixtures/model-contract), <name> = built file name without .glb. Prints and writes
//                      <built dir>/<name>.report.md with sections `## Contract`, `## Budget`, `## Drift` in that order.
//                      Exit 0 pass, 1 Contract, 2 Budget (Contract wins), 3 unreadable (no report sections at all).
//   models-promote:    node scripts/models-promote.mjs <name> [--yes] [--build-dir d] [--models-dir d] [--manifest-dir d]
//                      (defaults scratch/models-build, public/models, tests/fixtures/model-contract).
//   manifest schema:   documented in tests/fixtures/models/tinyGlb.ts.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTiny,
  buildTinySkin,
  nodeOf,
  packGlb,
  tinyManifest,
  tinySkinManifest,
  type Doc
} from './fixtures/models/tinyGlb';

const ROOT = path.resolve(__dirname, '..');
const RUN = path.join(ROOT, 'scripts', 'run-blender.mjs');
const COMPARE = path.join(ROOT, 'scripts', 'models-compare.mjs');
const PROMOTE = path.join(ROOT, 'scripts', 'models-promote.mjs');

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-pipeline-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------------
// run-blender, with the stub-Blender method of tests/run-blender.test.ts
// ---------------------------------------------------------------------------------------------

const STUB = `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
process.exit(0);
`;

describe('scripts/run-blender.mjs, build pipeline flags', () => {
  let binDir: string;
  let stub: string;
  let log: string;
  beforeEach(() => {
    binDir = path.join(dir, 'bin');
    fs.mkdirSync(binDir);
    fs.symlinkSync(process.execPath, path.join(binDir, 'node'));
    stub = path.join(dir, 'blender-stub');
    log = path.join(dir, 'argv.log');
    fs.writeFileSync(stub, STUB);
    fs.chmodSync(stub, 0o755);
  });

  const run = (args: string[]) =>
    spawnSync(process.execPath, [RUN, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
      env: { PATH: binDir, HOME: dir, BLENDER_PATH: stub, STUB_LOG: log }
    });
  const spawns = (): string[][] =>
    fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as string[])
      : [];
  const tail = (argv: string[]) => argv.slice(argv.indexOf('--') + 1);
  const outDir = () => path.join(dir, 'out');

  it('run-blender passes --out through after "--" on every build spawn', () => {
    for (const mode of ['hero', 'gear', 'monsters', 'world', 'guard']) {
      fs.rmSync(log, { force: true });
      expect(run([mode, '--out', outDir()]).status, mode).toBe(0);
      const s = spawns();
      expect(s, mode).toHaveLength(1);
      expect(s[0].indexOf('--'), `-- in ${JSON.stringify(s[0])}`).toBeGreaterThan(s[0].indexOf('--python') + 1);
      expect(tail(s[0]), mode).toEqual(['--out', outDir()]);
    }
    fs.rmSync(log, { force: true });
    expect(run(['all', '--out', outDir()]).status).toBe(0);
    const all = spawns();
    expect(all).toHaveLength(4);
    all.forEach((a) => expect(tail(a)).toEqual(['--out', outDir()]));
  });

  it('run-blender defaults --out to scratch/models-build and resolves a relative one', () => {
    expect(run(['hero']).status).toBe(0);
    expect(tail(spawns()[0])).toEqual(['--out', path.join(ROOT, 'scratch', 'models-build')]);
    fs.rmSync(log);
    expect(run(['hero', '--out', 'some/rel']).status).toBe(0);
    expect(tail(spawns()[0])).toEqual(['--out', path.join(ROOT, 'some', 'rel')]);
  });

  it('every --background spawn carries --factory-startup (the GUI open spawn is unchanged)', async () => {
    for (const args of [['hero'], ['all'], ['export', 'knight'], ['guard']]) {
      fs.rmSync(log, { force: true });
      expect(run(args).status, args.join(' ')).toBe(0);
      const s = spawns();
      expect(s.length).toBeGreaterThan(0);
      for (const argv of s) {
        const bg = argv.indexOf('--background');
        expect(bg, `--background in ${JSON.stringify(argv)}`).toBeGreaterThanOrEqual(0);
        expect(argv.indexOf('--factory-startup'), JSON.stringify(argv)).toBe(bg + 1);
      }
    }
    fs.rmSync(log, { force: true });
    expect(run(['open', 'hero']).status).toBe(0);
    const end = Date.now() + 2000;
    while (spawns().length < 1 && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
    const open = spawns();
    expect(open).toHaveLength(1);
    expect(open[0]).not.toContain('--factory-startup');
    expect(open[0]).not.toContain('--background');
  });

  it('all still spawns exactly four builds, and guard is not one of them', () => {
    expect(run(['all']).status).toBe(0);
    const all = spawns();
    expect(all).toHaveLength(4);
    expect(all.some((a) => a.some((x) => x.endsWith('export_guard.py')))).toBe(false);
  });

  it('guard is a mode', () => {
    const res = run(['guard']);
    expect(res.status).toBe(0);
    const s = spawns();
    expect(s).toHaveLength(1);
    expect(s[0][s[0].indexOf('--python') + 1].endsWith('export_guard.py')).toBe(true);
  });

  it('export passes --out and the target name', () => {
    for (const args of [['export', 'knight', '--out', outDir()], ['export', '--out', outDir(), 'knight']]) {
      fs.rmSync(log, { force: true });
      expect(run(args).status, args.join(' ')).toBe(0);
      const s = spawns();
      expect(s).toHaveLength(1);
      expect(s[0].some((a) => a.endsWith('knight.blend'))).toBe(true);
      const t = tail(s[0]);
      expect(t[t.indexOf('--out') + 1]).toBe(outDir());
      expect(t).toContain('knight');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------------------------

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

interface Setup {
  built?: Doc | Buffer;
  shipped?: Doc | Buffer;
  manifest?: unknown;
  pending?: unknown;
}

function setup(s: Setup) {
  const files = {
    build: path.join(dir, 'build'),
    models: path.join(dir, 'models'),
    contract: path.join(dir, 'contract')
  };
  fs.mkdirSync(files.build, { recursive: true });
  fs.mkdirSync(files.models, { recursive: true });
  fs.mkdirSync(path.join(files.contract, 'pending'), { recursive: true });
  const bytes = (x: Doc | Buffer) => (Buffer.isBuffer(x) ? x : packGlb(x));
  const built = bytes(s.built ?? buildTiny());
  fs.writeFileSync(path.join(files.build, 'tiny.glb'), built);
  fs.writeFileSync(path.join(files.models, 'tiny.glb'), s.shipped ? bytes(s.shipped) : built);
  fs.writeFileSync(path.join(files.contract, 'tiny.json'), JSON.stringify(s.manifest ?? tinyManifest()));
  if (s.pending) fs.writeFileSync(path.join(files.contract, 'pending', 'tiny.json'), JSON.stringify(s.pending));
  return { ...files, builtBytes: built };
}

function compare(s: Setup) {
  const f = setup(s);
  const res = spawnSync(
    process.execPath,
    [COMPARE, path.join(f.build, 'tiny.glb'), path.join(f.models, 'tiny.glb'), '--manifest-dir', f.contract],
    { cwd: ROOT, encoding: 'utf8', timeout: 20000, env: { PATH: path.dirname(process.execPath) } }
  );
  return { ...res, ...f, report: path.join(f.build, 'tiny.report.md') };
}

function section(out: string, name: 'Contract' | 'Budget' | 'Drift'): string {
  const m = new RegExp(`^## ${name}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(out);
  expect(m, `section ${name} in report:\n${out}`).not.toBeNull();
  return m![1];
}

describe('fixtures', () => {
  it('every fixture file stays under 4 kB', () => {
    for (const doc of [buildTiny(), buildTinySkin(), buildTiny({ colorMeshes: 'all' })]) {
      expect(packGlb(doc).length).toBeLessThan(4096);
    }
  });
});

describe('models-compare: Contract is the built file against its manifest', () => {
  it('a file equal to its manifest passes', () => {
    const r = compare({});
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(fs.existsSync(r.report)).toBe(true);
    expect(fs.readFileSync(r.report, 'utf8')).toContain('## Contract');
  });

  it('a missing node fails Contract', () => {
    const doc = buildTiny();
    nodeOf(doc, 'HeadGroup').name = 'HeadGroup_gone';
    const r = compare({ built: doc });
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('HeadGroup');
  });

  it('a pivot 0.001 from its manifest position fails Contract', () => {
    const inside = buildTiny();
    nodeOf(inside, 'Torso').translation = [0, 1.20005, 0];
    expect(compare({ built: inside }).status).toBe(0);
    const doc = buildTiny();
    nodeOf(doc, 'Torso').translation = [0, 1.201, 0];
    const r = compare({ built: doc });
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('Torso');
  });

  it('a pivot moved in both the file and its manifest passes Contract and shows as Drift', () => {
    const built = buildTiny();
    nodeOf(built, 'Torso').translation = [0, 1.3, 0];
    const manifest = tinyManifest();
    manifest.nodes.Torso.translation = [0, 1.3, 0];
    const r = compare({ built, shipped: buildTiny(), manifest });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(section(r.stdout, 'Contract')).not.toContain('Torso');
    expect(section(r.stdout, 'Drift')).toContain('Torso');
  });

  it('a renamed material fails Contract', () => {
    const doc = buildTiny();
    doc.json.materials[1].name = 'cloth_renamed';
    const r = compare({ built: doc });
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('cloth');
  });

  it('a missing clip fails Contract', () => {
    const doc = buildTiny();
    doc.json.animations = doc.json.animations.filter((a) => a.name !== 'Walk');
    const r = compare({ built: doc });
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('Walk');
  });

  it.each(['TorsoCoat', 'Hair', 'Gear_trousers_legL_04_'])('a merged mesh that swallowed a toggled name (%s) fails Contract', (name) => {
    const doc = buildTiny();
    nodeOf(doc, name).name = 'Merged';
    doc.json.meshes.find((m) => m.name === name)!.name = 'Merged';
    const r = compare({ built: doc });
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain(name);
  });

  it('COLOR_0 on some meshes of a file but not all fails Contract', () => {
    expect(compare({ built: buildTiny({ colorMeshes: 'all' }), manifest: { ...tinyManifest(), vertexColor: 'all' } }).status).toBe(0);
    for (const vertexColor of ['all', 'none']) {
      const r = compare({ built: buildTiny({ colorMeshes: ['Head'] }), manifest: { ...tinyManifest(), vertexColor } });
      expect(r.status, vertexColor).toBe(1);
      expect(section(r.stdout, 'Contract'), vertexColor).toContain('COLOR_0');
    }
  });
});

describe('models-compare: skin rules on a tiny skinned fixture', () => {
  const skin = (built: Doc, manifest: unknown = tinySkinManifest()) => compare({ built, manifest });

  it('the unmodified skinned fixture passes', () => {
    const r = skin(buildTinySkin());
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('a missing bone fails Contract', () => {
    const doc = buildTinySkin();
    nodeOf(doc, 'LeftElbowPivot').name = 'LeftElbow';
    const r = skin(doc);
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('LeftElbowPivot');
  });

  it('a bone whose rest rotation is not identity fails Contract', () => {
    const doc = buildTinySkin();
    nodeOf(doc, 'Torso').rotation = [0.1, 0, 0, 0.995];
    const r = skin(doc);
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('Torso');
  });

  it('a vertex whose weights sum to 0.9 fails Contract', () => {
    const r = skin(buildTinySkin({ weights: [[0.9, 0, 0, 0], [0.5, 0.5, 0, 0], [0.25, 0.25, 0.25, 0.25]] }));
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toMatch(/WEIGHTS_0|vertex/);
  });

  it('a joint index outside the skin fails Contract', () => {
    const r = skin(buildTinySkin({ joints: [[0, 1, 0, 0], [2, 3, 0, 0], [4, 7, 0, 0]] }));
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toMatch(/JOINTS_0|joint/);
  });

  it('a shared clip with a position track on a bone other than Hips fails Contract', () => {
    expect(skin(buildTinySkin({ walkTranslationOn: ['Hips'] })).status).toBe(0);
    const r = skin(buildTinySkin({ walkTranslationOn: ['Hips', 'Torso'] }));
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('Walk');
  });

  it.each([
    ['translation', [1, 0, 0]],
    ['rotation', [0, 0.7071, 0, 0.7071]],
    ['scale', [2, 2, 2]]
  ])('a skinned root node with a %s fails Contract', (key, value) => {
    const doc = buildTinySkin();
    Object.assign(nodeOf(doc, 'Monster_tiny'), { [key]: value });
    const r = skin(doc);
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('Monster_tiny');
  });

  it('a limb more than 20 degrees from the skeleton\'s reference pose fails Contract', () => {
    // the elbow moves so the upper arm points 46 degrees away; the manifest's bone positions move with it,
    // so only the limb rule can object, and a wider bound lets the same file pass
    const doc = buildTinySkin();
    nodeOf(doc, 'LeftElbowPivot').translation = [-0.5, -0.2, 0];
    const manifest = tinySkinManifest();
    manifest.skin!.bones.LeftElbowPivot.translation = [-0.5, -0.2, 0];
    expect(skin(doc, { ...manifest, skin: { ...manifest.skin, maxLimbDegrees: 90 } }).status).toBe(0);
    const r = skin(doc, manifest);
    expect(r.status).toBe(1);
    expect(section(r.stdout, 'Contract')).toContain('LeftArmPivot');
  });
});

describe('models-compare: Budget, pending manifests, Drift, unreadable files', () => {
  it('one more triangle than the budget fails Budget', () => {
    const manifest = tinyManifest();
    manifest.budget.triangles -= 1;
    const r = compare({ manifest });
    expect(r.status).toBe(2);
    expect(section(r.stdout, 'Budget')).toContain('triangles');
  });

  it('a pending manifest, when present, is the one compared against', () => {
    const built = buildTiny();
    nodeOf(built, 'Torso').translation = [0, 1.3, 0];
    const pending = tinyManifest();
    pending.nodes.Torso.translation = [0, 1.3, 0];
    expect(compare({ built, shipped: buildTiny() }).status).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    const r = compare({ built, shipped: buildTiny(), pending });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('a different generator string is Drift only', () => {
    const shipped = buildTiny();
    shipped.json.asset.generator = 'Some other exporter 4.2';
    const r = compare({ shipped });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(section(r.stdout, 'Drift')).toContain('generator');
    expect(section(r.stdout, 'Contract')).not.toContain('generator');
  });

  it('a truncated file is refused before any check', () => {
    const whole = packGlb(buildTiny());
    const r = compare({ built: whole.subarray(0, Math.floor(whole.length / 2)) });
    expect(r.status).toBe(3);
    expect(r.stdout).not.toContain('## Contract');
    expect(r.stderr).not.toBe('');
    const bad = Buffer.from(whole);
    bad.write('XXXX', 0, 'latin1');
    expect(compare({ built: bad }).status).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------
// promote
// ---------------------------------------------------------------------------------------------

describe('models-promote', () => {
  function promote(s: Setup, args: string[] = ['tiny', '--yes']) {
    const f = setup(s);
    fs.writeFileSync(path.join(f.models, 'other.glb'), 'other model bytes');
    fs.writeFileSync(path.join(f.build, 'other.glb'), 'built other bytes');
    const before = fs.readFileSync(path.join(f.models, 'tiny.glb'));
    const res = spawnSync(
      process.execPath,
      [PROMOTE, ...args, '--build-dir', f.build, '--models-dir', f.models, '--manifest-dir', f.contract],
      { cwd: ROOT, encoding: 'utf8', timeout: 20000, env: { PATH: path.dirname(process.execPath) } }
    );
    return { ...res, ...f, before };
  }
  const shippedNow = (f: { models: string }) => fs.readFileSync(path.join(f.models, 'tiny.glb'));

  it('refuses without --yes', () => {
    const r = promote({ shipped: buildTinySkin() }, ['tiny']);
    expect(r.status).not.toBe(0);
    expect(shippedNow(r).equals(r.before)).toBe(true);
  });

  it('refuses when compare fails', () => {
    const built = buildTiny();
    nodeOf(built, 'HeadGroup').name = 'HeadGroup_gone';
    const r = promote({ built, shipped: buildTinySkin() });
    expect(r.status).not.toBe(0);
    expect(shippedNow(r).equals(r.before)).toBe(true);
  });

  it('copies exactly the named file', () => {
    const r = promote({ shipped: buildTinySkin() });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(shippedNow(r).equals(r.builtBytes)).toBe(true);
    expect(fs.readdirSync(r.models).sort()).toEqual(['other.glb', 'tiny.glb']);
    expect(fs.readFileSync(path.join(r.models, 'other.glb'), 'utf8')).toBe('other model bytes');
    expect(r.stdout).toContain(sha(r.builtBytes));
    expect(r.stdout).toContain(`?v=${sha(r.builtBytes).slice(0, 8)}`);
  });

  it('moves a pending manifest over the live one in the same step', () => {
    const built = buildTiny();
    nodeOf(built, 'Torso').translation = [0, 1.3, 0];
    const pending = tinyManifest();
    pending.nodes.Torso.translation = [0, 1.3, 0];
    const r = promote({ built, shipped: buildTiny(), pending });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(r.contract, 'tiny.json'), 'utf8'))).toEqual(pending);
    expect(fs.existsSync(path.join(r.contract, 'pending', 'tiny.json'))).toBe(false);
  });

  it.each(['nosuch', '../tiny', 'tiny.glb'])('refuses a name not in the manifest (%s)', (name) => {
    const r = promote({ shipped: buildTinySkin() }, [name, '--yes']);
    expect(r.status).not.toBe(0);
    expect(shippedNow(r).equals(r.before)).toBe(true);
    expect(fs.readdirSync(r.models).sort()).toEqual(['other.glb', 'tiny.glb']);
  });
});

