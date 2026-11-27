// Plan Q7t: a text scan of the new interface modules and of index.html (design 7.2, rule 0.3.9).
// Red until Q8 (src/ui/dialogue.ts) and Q9 (src/ui/journal.ts) exist: a missing file fails its case on purpose.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/**
 * Inline handler attributes `index.html` holds: 0. Source: the Stage 6 baseline
 * (docs/superpowers/baseline/2026-11-14-stage6-baseline.md, section 4: "CALL-V13 was taken ... no inline handler"),
 * confirmed by tests/globals.test.ts.
 */
const INLINE_HANDLERS_AT_BASELINE = 0;

describe('interface scan (Q8, Q9)', () => {
  for (const file of ['src/ui/dialogue.ts', 'src/ui/journal.ts']) {
    it(`${file} never uses innerHTML`, () => {
      expect(read(file).match(/innerHTML/g) ?? []).toEqual([]);
    });
  }

  it('index.html holds no more inline handler attributes than the baseline', () => {
    const found = read('index.html').match(/\son[a-z]+\s*=/gi) ?? [];
    expect(found.length).toBeLessThanOrEqual(INLINE_HANDLERS_AT_BASELINE);
  });
});
