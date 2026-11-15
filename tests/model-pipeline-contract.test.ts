// Repair tests for P3: the stricter Contract and Drift checks of scripts/models-compare.mjs and glb.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTiny, buildTinySkin, nodeOf, packGlb, tinyManifest, tinySkinManifest, type Doc } from './fixtures/models/tinyGlb';

const COMPARE = path.resolve(__dirname, '..', 'scripts', 'models-compare.mjs');
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-contract-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function compare(built: Doc, manifest: unknown, shipped?: Doc) {
  const contract = path.join(dir, 'contract');
  fs.mkdirSync(contract, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tiny.glb'), packGlb(built));
  fs.writeFileSync(path.join(dir, 'shipped.glb'), packGlb(shipped ?? built));
  fs.writeFileSync(path.join(contract, 'tiny.json'), JSON.stringify(manifest));
  const r = spawnSync(process.execPath, [COMPARE, path.join(dir, 'tiny.glb'), path.join(dir, 'shipped.glb'), '--manifest-dir', contract], {
    encoding: 'utf8',
    timeout: 20000,
    env: { PATH: path.dirname(process.execPath) }
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe('compare Contract, stricter', () => {
  it('a material the manifest does not list fails Contract', () => {
    const m = tinyManifest();
    m.materials = ['skin'];
    const r = compare(buildTiny(), m);
    expect(r.status).toBe(1);
    expect(r.out).toContain("Material 'cloth'");
  });

  it('a mesh outside the manifest name classes fails Contract', () => {
    const m = { ...tinyManifest(), meshClasses: ['^Torso', '^Head$', '^Hair$', '^Gear_'] };
    expect(compare(buildTiny(), m).status).toBe(0);
    const doc = buildTiny();
    doc.json.meshes[3].name = 'Stray';
    const r = compare(doc, m);
    expect(r.status).toBe(1);
    expect(r.out).toContain("'Stray'");
  });

  it('a missing extras key fails Contract', () => {
    expect(compare(buildTiny(), { ...tinyManifest(), extras: { Torso_Body: ['part'] } }).status).toBe(0);
    const r = compare(buildTiny(), { ...tinyManifest(), extras: { Torso_Body: ['part', 'slot'] } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("'slot'");
  });

  it('a part centre 0.02 off fails Contract, 0.005 off passes', () => {
    // Head: triangle bounds (0,0,0)..(1,1,0), centre (0.5, 0.5, 0)
    expect(compare(buildTiny(), { ...tinyManifest(), centres: { Head: [0.505, 0.5, 0] } }).status).toBe(0);
    const r = compare(buildTiny(), { ...tinyManifest(), centres: { Head: [0.52, 0.5, 0] } });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Part 'Head'");
  });

  it('a primitive with JOINTS_1 fails Contract', () => {
    const doc = buildTinySkin();
    doc.json.meshes[0].primitives[0].attributes.JOINTS_1 = doc.json.meshes[0].primitives[0].attributes.JOINTS_0;
    const r = compare(doc, tinySkinManifest());
    expect(r.status).toBe(1);
    expect(r.out).toContain('JOINTS_1');
  });

  it('a clip channel on a missing node fails Contract', () => {
    const doc = buildTiny();
    doc.json.animations[0].channels[0].target.node = 99;
    expect(compare(doc, tinyManifest()).status).toBe(1);
  });

  it('a skinned mesh whose node has no skin fails Contract', () => {
    const doc = buildTinySkin();
    delete nodeOf(doc, 'Monster_tiny_body').skin;
    const r = compare(doc, tinySkinManifest());
    expect(r.status).toBe(1);
    expect(r.out).toContain('no valid skin');
  });

  it('limbs without maxLimbDegrees refuse the manifest (exit 3)', () => {
    const m = tinySkinManifest() as { skin: { maxLimbDegrees?: number } };
    delete m.skin.maxLimbDegrees;
    expect(compare(buildTinySkin(), m).status).toBe(3);
  });
});

describe('compare Drift, stricter', () => {
  it('changed vertex data with the same triangle count shows as Drift', () => {
    const shipped = buildTiny();
    const built = buildTiny();
    // vertex 1 z moves by 0.001; the declared min/max stay, so only the byte hash can see it
    new Float32Array(built.bin.buffer, built.bin.byteOffset, 9)[5] = 0.001;
    const r = compare(built, tinyManifest(), shipped);
    expect(r.out).toContain('geometry bytes changed');
    expect(r.out).not.toContain('bounds changed');
  });

  it('a 180 degree rotation against identity shows as Drift', () => {
    const shipped = buildTiny();
    const built = buildTiny();
    nodeOf(built, 'Torso').rotation = [0, 1, 0, 0];
    const r = compare(built, tinyManifest(), shipped);
    expect(r.out).toContain("Node 'Torso' rotation changed");
  });

  it('moved bounds show as Drift', () => {
    const built = buildTiny();
    built.json.accessors[0].max = [2, 1, 0];
    const r = compare(built, tinyManifest(), buildTiny());
    expect(r.out).toContain('bounds changed');
  });
});

describe('glb reader refuses malformed input (exit 3)', () => {
  it.each([
    ['a bufferView on buffer 1', (d: Doc) => void (d.json.bufferViews[0].buffer = 1)],
    ['a bufferView with no byteLength', (d: Doc) => void delete (d.json.bufferViews[0] as { byteLength?: number }).byteLength],
    ['an indices accessor that does not exist', (d: Doc) => void (d.json.meshes[0].primitives[0].indices = 99)]
  ])('%s', (_name, mutate) => {
    const doc = buildTiny();
    mutate(doc);
    expect(compare(doc, tinyManifest()).status).toBe(3);
  });
});

describe('compare Budget per figure', () => {
  // HeroRoot holds 5 one-triangle mesh nodes, 2 materials; they all read the POSITION view (36 B) and the index view (6 B)
  const figure = (c: Record<string, number>) => ({ ...tinyManifest(), figures: { HeroRoot: c } });

  it('a figure at its ceilings passes, one triangle, mesh, material or byte over fails Budget', () => {
    const at = { triangles: 5, meshes: 5, materials: 2, rawBytes: 42 };
    expect(compare(buildTiny(), figure(at)).status).toBe(0);
    for (const metric of ['triangles', 'meshes', 'materials', 'rawBytes'] as const) {
      const r = compare(buildTiny(), figure({ ...at, [metric]: at[metric] - 1 }));
      expect(r.status, metric).toBe(2);
      expect(r.out).toContain(`'${metric}' of figure 'HeroRoot'`);
    }
  });

  it('a figure over its Brotli ceiling fails Budget', () => {
    const r = compare(buildTiny(), figure({ brotliBytes: 1 }));
    expect(r.status).toBe(2);
    expect(r.out).toContain("'brotliBytes' of figure 'HeroRoot'");
  });

  it('a subtree counts only its own meshes: HeadGroup has 2', () => {
    const m = { ...tinyManifest(), figures: { HeadGroup: { triangles: 2, meshes: 2, materials: 2 } } };
    expect(compare(buildTiny(), m).status).toBe(0);
    m.figures.HeadGroup.meshes = 1;
    expect(compare(buildTiny(), m).status).toBe(2);
  });

  it('a missing figure root fails Budget', () => {
    const r = compare(buildTiny(), { ...tinyManifest(), figures: { Monster_gone: { triangles: 9 } } });
    expect(r.status).toBe(2);
    expect(r.out).toContain("'Monster_gone'");
  });

  it('an unknown figure metric or a non-numeric ceiling refuses the manifest (exit 3)', () => {
    expect(compare(buildTiny(), figure({ triangle: 9 })).status).toBe(3);
    expect(compare(buildTiny(), { ...tinyManifest(), figures: { HeroRoot: { triangles: '9' } } }).status).toBe(3);
  });
});

describe('compare refuses keys it does not read (exit 3)', () => {
  it.each([
    ['a top-level key', { ...tinyManifest(), figure: { HeroRoot: { triangles: 1 } } }],
    ['a skin key', { ...tinySkinManifest(), skin: { ...tinySkinManifest().skin, anticipation: 0.2 } }],
    ['a clip key', { ...tinyManifest(), clips: { Idle: { moves: ['Torso'], anticipation: 0.2 } } }]
  ])('%s', (_name, manifest) => {
    const built = 'skin' in manifest ? buildTinySkin() : buildTiny();
    expect(compare(built, manifest).status).toBe(3);
  });
});

describe('compare report and Drift wording', () => {
  it('with no shipped file the report says Drift was not checked', () => {
    const contract = path.join(dir, 'contract');
    fs.mkdirSync(contract, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tiny.glb'), packGlb(buildTiny()));
    fs.writeFileSync(path.join(contract, 'tiny.json'), JSON.stringify(tinyManifest()));
    const r = spawnSync(process.execPath, [COMPARE, path.join(dir, 'tiny.glb'), '--manifest-dir', contract], {
      encoding: 'utf8',
      timeout: 20000,
      env: { PATH: path.dirname(process.execPath) }
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('No shipped file given, so Drift was not checked.');
    expect(r.stdout).not.toContain('Zero drift');
  });

  it('comparing a file under public/models writes no report there, only under scratch/models-build', () => {
    const root = path.resolve(__dirname, '..');
    const shippedDir = path.join(root, 'public', 'models');
    const scratchReport = path.join(root, 'scratch', 'models-build', 'hero.report.md');
    const before = fs.existsSync(scratchReport) ? fs.readFileSync(scratchReport) : null;
    const contract = path.join(dir, 'contract');
    fs.mkdirSync(contract, { recursive: true });
    fs.writeFileSync(path.join(contract, 'hero.json'), '{}');
    try {
      const r = spawnSync(process.execPath, [COMPARE, path.join(shippedDir, 'hero.glb'), '--manifest-dir', contract], {
        encoding: 'utf8',
        timeout: 20000,
        env: { PATH: path.dirname(process.execPath) }
      });
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(fs.existsSync(path.join(shippedDir, 'hero.report.md'))).toBe(false);
      expect(fs.readFileSync(scratchReport, 'utf8')).toContain('# Model Compare Report: hero');
    } finally {
      if (before) fs.writeFileSync(scratchReport, before);
      else fs.rmSync(scratchReport, { force: true });
    }
  });
});
