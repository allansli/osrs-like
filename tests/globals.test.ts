import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WINDOW_GLOBALS } from '../src/engine/runtime';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

/** Every `data-action="name"` value in the markup. */
function dataActions(source: string): Set<string> {
  return new Set([...source.matchAll(/\bdata-action\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2] ?? ''));
}

describe('window globals', () => {
  it('index.html has no inline handler attribute', () => {
    expect(html.match(/\son[a-z]+\s*=/gi) ?? []).toEqual([]);
  });

  it('every data-action in index.html names a function in WINDOW_GLOBALS', () => {
    const actions = dataActions(html);
    expect(actions.size).toBeGreaterThan(10);
    const missing = [...actions].filter((n) => !WINDOW_GLOBALS.includes(n));
    expect(missing).toEqual([]);
  });
});
