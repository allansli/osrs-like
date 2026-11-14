import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(root(path), 'utf8');
const lines = (text: string) => text.split('\n');

describe('credits and licence text', () => {
  it('CREDITS.md names the dragon by yoji and Kai by uchiha007 under CC-BY 3.0', () => {
    const credits = lines(read('CREDITS.md'));
    const dragon = credits.find((l) => /dragon/i.test(l) && /yoji/i.test(l));
    const kai = credits.find((l) => /\bkai\b/i.test(l) && /uchiha007/i.test(l));
    expect(dragon, 'a line naming the dragon and yoji').toBeDefined();
    expect(kai, 'a line naming Kai and uchiha007').toBeDefined();
    expect(dragon).toMatch(/CC[- ]BY(?:[- ]3\.0)/i);
    expect(kai).toMatch(/CC[- ]BY(?:[- ]3\.0)/i);
  });

  it('CREDITS.md names the knight as Blend Swap 28541 by Xali under CC0', () => {
    const knight = lines(read('CREDITS.md')).find((l) => /knight/i.test(l) && /28541/.test(l));
    expect(knight, 'a line naming the knight and 28541').toBeDefined();
    expect(knight).toMatch(/blend\s*swap/i);
    expect(knight).toMatch(/Xali/);
    expect(knight).toMatch(/CC0/);
  });

  it('blender/examples/knight_28541/LICENSE.txt exists', () => {
    expect(existsSync(root('blender/examples/knight_28541/LICENSE.txt'))).toBe(true);
  });

  it('README states MIT covers the code only', () => {
    expect(read('README.md')).toMatch(/MIT[^.\n]*\b(?:code|source)\b[^.\n]*\bonly\b|\bonly\b[^.\n]*\bcode\b[^.\n]*MIT/i);
  });
});
