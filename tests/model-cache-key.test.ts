import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const totals = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/model-contract/totals.json'), 'utf8'));
// Files not promoted by this pass yet keep their hand-named key; each moves to its hash at its own promotion.
const LEGACY = new Set(['hero', 'gear']);

describe('model cache keys', () => {
  for (const [name, { file, url }] of Object.entries(totals.loaders) as [string, { file: string; url: string }][]) {
    const key = /\?v=([A-Za-z0-9_.-]+)$/.exec(url)?.[1];
    if (!key) continue;
    if (LEGACY.has(name)) continue;
    it(`${name}: the ?v= key is the first 8 hex of the shipped file's SHA-256, in the loader and the manifest`, () => {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public/models', `${name}.glb`))).digest('hex');
      expect(key).toBe(hash.slice(0, 8));
      expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toContain(url);
    });
  }

  it('monsters carries a hash key', () => {
    expect(totals.loaders.monsters.url).toMatch(/\?v=[0-9a-f]{8}$/);
  });
});
