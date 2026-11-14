import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

const files = (readdirSync(srcDir, { recursive: true }) as string[])
  .map((f) => f.split('\\').join('/'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ rel: f, text: readFileSync(join(srcDir, f), 'utf8') }));

describe('source limits', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('no ts file under src exceeds 1000 lines', () => {
    const tooLong = files
      .map(({ rel, text }) => ({ rel, lines: text.split('\n').length }))
      .filter((f) => f.lines > 1000);
    expect(tooLong).toEqual([]);
  });

  it('no file under src contains @ts-nocheck or @ts-ignore', () => {
    const bad = files.filter(({ text }) => /@ts-(?:nocheck|ignore)/.test(text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });
});
