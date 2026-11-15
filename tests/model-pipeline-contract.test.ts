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
