import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Plan UI2, G5.10. Fonts are shipped by UI1; this pins them.
const ROOT = new URL('../', import.meta.url).pathname;
const DIR = join(ROOT, 'src/ui/fonts');
const FAMILIES = [
  { name: 'Grenze', licence: 'LICENSE-Grenze.txt' },
  { name: 'Open Sans', licence: 'LICENSE-OpenSans.txt' },
];
const woff2 = readdirSync(DIR).filter((f) => f.endsWith('.woff2'));
const credits = readFileSync(join(ROOT, 'CREDITS.md'), 'utf8').split('\n');

describe('interface fonts', () => {
  it('the font files exist: two display weights and two text weights', () => {
    expect(woff2.sort()).toEqual(['Grenze-Bold.woff2', 'Grenze-SemiBold.woff2', 'OpenSans-Regular.woff2', 'OpenSans-SemiBold.woff2']);
  });

  it('all font files together are at most 120,000 bytes', () => {
    const total = woff2.reduce((n, f) => n + statSync(join(DIR, f)).size, 0);
    expect(total).toBeLessThanOrEqual(120_000);
  });

  it.each(FAMILIES)('$name has a licence file beside the fonts', ({ licence }) => {
    expect(existsSync(join(DIR, licence))).toBe(true);
    expect(readFileSync(join(DIR, licence), 'utf8')).toMatch(/SIL OPEN FONT LICENSE/i);
  });

  it.each(FAMILIES)('CREDITS.md has a Fonts row for $name naming a licence and a source', ({ name }) => {
    const row = credits.find((l) => l.startsWith('|') && l.includes(name));
    expect(row, `a table row naming ${name}`).toBeDefined();
    expect(row).toMatch(/Open Font License|OFL/i);
    expect(row).toMatch(/https:\/\/github\.com\//);
  });
});
