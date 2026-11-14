import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WINDOW_GLOBALS } from '../src/engine/runtime';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

/** Every `name(` call in every onclick attribute, skipping member calls like `event.stopPropagation(`. */
function onclickCalls(source: string): Set<string> {
  const names = new Set<string>();
  for (const attr of source.matchAll(/\bonclick\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const code = attr[1] ?? attr[2] ?? '';
    for (const call of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(call[1]);
  }
  return names;
}

describe('window globals', () => {
  it('finds onclick calls in index.html', () => {
    const calls = onclickCalls(html);
    expect(calls.size).toBeGreaterThan(10);
    expect(calls.has('stopPropagation')).toBe(false);
  });

  it('every function named in an index.html onclick is in WINDOW_GLOBALS', () => {
    const missing = [...onclickCalls(html)].filter((n) => !WINDOW_GLOBALS.includes(n));
    expect(missing).toEqual([]);
  });
});
