// The shipped GLBs against the committed manifests (tests/fixtures/model-contract), plus compare's attack clip check.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTinySkin, packGlb, tinySkinManifest, type Doc } from './fixtures/models/tinyGlb';

const ROOT = path.resolve(__dirname, '..');
const COMPARE = path.join(ROOT, 'scripts', 'models-compare.mjs');
const CONTRACT = path.join(__dirname, 'fixtures', 'model-contract');
const NAMES = ['hero', 'gear', 'monsters', 'guard', 'world'];
// glb.mjs is a plain node script with no declaration file: a non-literal specifier and the shape this test reads.
type ReadGlb = (p: string) => { json: unknown; rawBytes: number; brotliBytes: number };
const { readGlb } = (await import(/* @vite-ignore */ pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'glb.mjs')).href)) as { readGlb: ReadGlb };
const totals = JSON.parse(fs.readFileSync(path.join(CONTRACT, 'totals.json'), 'utf8'));

function compare(glb: string, manifestDir: string) {
  const r = spawnSync(process.execPath, [COMPARE, glb, '--manifest-dir', manifestDir], {
    encoding: 'utf8',
    timeout: 60000,
    env: { PATH: path.dirname(process.execPath) }
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe('shipped files satisfy their manifest (Contract and Budget)', () => {
  // The file is copied to a temp dir so compare writes its report there, not under scratch/.
  it.each(NAMES)('%s.glb', (name) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shipped-'));
    try {
      const copy = path.join(tmp, `${name}.glb`);
      fs.copyFileSync(path.join(ROOT, 'public', 'models', `${name}.glb`), copy);
      // Shipped files are checked against the live manifests only: a pending/ manifest belongs to the built file (rule 0.3.5).
      const live = path.join(tmp, 'live');
      fs.mkdirSync(live);
      for (const f of fs.readdirSync(CONTRACT)) if (f.endsWith('.json')) fs.copyFileSync(path.join(CONTRACT, f), path.join(live, f));
      const r = compare(copy, live);
      expect(r.out).toContain('All contract checks passed.');
      expect(r.out).toContain('All budget checks passed.');
      expect(r.status).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('the five files together stay within the total ceilings', () => {
    const docs = NAMES.map((n) => readGlb(path.join(ROOT, 'public', 'models', `${n}.glb`)));
    expect(docs.reduce((s, d) => s + d.rawBytes, 0)).toBeLessThanOrEqual(totals.rawBytes);
    expect(docs.reduce((s, d) => s + d.brotliBytes, 0)).toBeLessThanOrEqual(totals.brotliBytes);
  });

  it('the manifest holds the hero contract of design 8.1', () => {
    const hero = JSON.parse(fs.readFileSync(path.join(CONTRACT, 'hero.json'), 'utf8'));
    for (const n of ['HeroRoot', 'Torso', 'HeadGroup', 'LeftArmPivot', 'RightArmPivot', 'LeftElbowPivot', 'RightElbowPivot', 'LeftLegPivot', 'RightLegPivot', 'LeftKneePivot', 'RightKneePivot']) {
      expect(hero.nodes[n], n).toBeDefined();
    }
    expect(Object.keys(hero.centres).sort()).toEqual(['Boot_L', 'Boot_R', 'Hand_L', 'Hand_R', 'Head']);
    expect(hero.toggled).toEqual(expect.arrayContaining(['Hair', 'TorsoCoat']));
    expect(Object.keys(hero.clips)).toHaveLength(10);
    expect(hero.figures.HeroRoot.triangles).toBeGreaterThan(0);
  });

  it('every loader still loads its file under the cache key the manifest notes (tied to a hash from the first promotion on)', () => {
    for (const [name, { file, url }] of Object.entries(totals.loaders) as [string, { file: string; url: string }][]) {
      expect(fs.readFileSync(path.join(ROOT, file), 'utf8'), name).toContain(url);
    }
  });

  it('no GLB JSON chunk holds a local path', () => {
    for (const name of NAMES) {
      const json = JSON.stringify(readGlb(path.join(ROOT, 'public', 'models', `${name}.glb`)).json);
      for (const frag of ['/home/', '/Users/', 'C:\\\\', '\\\\Users\\\\']) expect(json, `${name} ${frag}`).not.toContain(frag);
    }
  });
});

describe('compare: main guard', () => {
  it('run through a symlinked path, compare still checks and refuses a truncated file (exit 3)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-'));
    try {
      const link = path.join(tmp, 'repo');
      fs.symlinkSync(ROOT, link, 'dir');
      const bad = path.join(tmp, 'bad.glb');
      fs.writeFileSync(bad, 'glTF\x02\x00\x00');
      const r = spawnSync(process.execPath, [path.join(link, 'scripts', 'models-compare.mjs'), bad, bad], {
        encoding: 'utf8',
        timeout: 60000,
        env: { PATH: path.dirname(process.execPath) }
      });
      expect(r.stdout + r.stderr).toContain('File truncated');
      expect(r.status).toBe(3);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('compare: attack clip anticipation time', () => {
  function check(attackClips: Record<string, number>, built: Doc = buildTinySkin()) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'attack-'));
    try {
      fs.mkdirSync(path.join(tmp, 'c'));
      fs.writeFileSync(path.join(tmp, 'tiny.glb'), packGlb(built));
      const m = tinySkinManifest() as { skin: Record<string, unknown> };
      fs.writeFileSync(path.join(tmp, 'c', 'tiny.json'), JSON.stringify({ ...m, skin: { ...m.skin, attackClips } }));
      return compare(path.join(tmp, 'tiny.glb'), path.join(tmp, 'c'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  // the fixture's clips have keys at 0 and 1 s

  it('an anticipation time at the clip end fails Contract', () => {
    expect(check({ Walk: 1 }).status).toBe(1);
  });
  it('an anticipation time between two keyframes fails Contract', () => {
    const r = check({ Walk: 0.5 });
    expect(r.status).toBe(1);
    expect(r.out).toContain("no keyframe at its anticipation time 0.5");
  });
  it('a missing attack clip fails Contract', () => {
    const r = check({ Slash: 0.5 });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Attack clip 'Slash' is missing");
  });
  it('a non-positive anticipation time refuses the manifest (exit 3)', () => {
    expect(check({ Walk: 0 }).status).toBe(3);
  });
  it('a clip with a mid keyframe at the anticipation time passes', () => {
    const doc = buildTinySkin();
    // add a third key at 0.25 s to the Walk sampler input: a new accessor over fresh bytes
    const view = doc.json.bufferViews.length;
    const off = doc.bin.length;
    const times = Buffer.from(new Float32Array([0, 0.25, 1]).buffer);
    doc.bin = Buffer.concat([doc.bin, times]);
    doc.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: times.length });
    doc.json.buffers![0].byteLength = doc.bin.length;
    const acc = doc.json.accessors.length;
    doc.json.accessors.push({ bufferView: view, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [1] });
    const walk = doc.json.animations.find((a) => a.name === 'Walk')!;
    walk.samplers.forEach((s) => (s.input = acc));
    // outputs now have 2 values for 3 keys: compare reads only the times, so only this check is exercised
    expect(check({ Walk: 0.25 }, doc).status).toBe(0);
  });
});
