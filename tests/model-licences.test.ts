// Every third-party source under blender/examples is credited and carries its licence.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES = path.join(ROOT, 'blender', 'examples');
const credits = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8');
const entries = fs.readdirSync(EXAMPLES, { withFileTypes: true });

describe('blender/examples licences', () => {
  it('there are entries to check', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((e) => e.name))('%s is named in CREDITS.md', (name) => {
    expect(credits).toContain(name);
  });

  it.each(entries.filter((e) => e.isDirectory()).map((e) => e.name))('directory %s holds a licence file', (dir) => {
    const files = fs.readdirSync(path.join(EXAMPLES, dir));
    expect(files.some((f) => /licen[sc]e/i.test(f)), files.join(', ')).toBe(true);
  });

  it.each(entries.filter((e) => e.isFile() && e.name.endsWith('.zip')).map((e) => e.name))('zip %s holds a LICENSE member', (zip) => {
    // member names in the central directory are stored uncompressed
    expect(fs.readFileSync(path.join(EXAMPLES, zip)).includes('LICENSE')).toBe(true);
  });
});
