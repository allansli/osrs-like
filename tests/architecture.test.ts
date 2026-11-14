import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

function listTs(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => f.split('\\').join('/'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f));
}

describe('architecture', () => {
  it('imports every module under src in node without throwing', async () => {
    const files = listTs(srcDir).filter((f) => {
      const rel = f.slice(srcDir.length + 1).split('\\').join('/');
      return rel !== 'main.ts' && !rel.startsWith('__tests__/');
    });
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      await import(/* @vite-ignore */ pathToFileURL(file).href);
    }
  });

  it('state and data layers do not import engine, ui or three, and do not mention document or window', () => {
    const files = [...listTs(join(srcDir, 'state')), ...listTs(join(srcDir, 'data'))];
    expect(files.length).toBeGreaterThan(10);
    const badImport = /from\s+['"](?:[^'"]*\/)?(?:engine|ui)(?:\/[^'"]*)?['"]|from\s+['"]three(?:\/[^'"]*)?['"]|import\s*\(\s*['"]three/;
    const badGlobal = /\b(?:document|window)\b/;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(badImport.test(text), `${file} imports engine, ui or three`).toBe(false);
      expect(badGlobal.test(text), `${file} mentions document or window`).toBe(false);
    }
  });
});
