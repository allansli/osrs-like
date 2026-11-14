import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getTerrainHeight } from '../src/state/terrain';

const FIXTURE = new URL('./fixtures/terrain-golden.json', import.meta.url);

function sample(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 53; i++) {
    for (let j = 0; j < 53; j++) {
      out.push(getTerrainHeight(-130 + i * 5, -130 + j * 5));
    }
  }
  return out;
}

describe('terrain golden', () => {
  it('terrain matches the extraction golden', () => {
    const got = sample();
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(FIXTURE, JSON.stringify(got));
      return;
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as number[];
    expect(got).toHaveLength(53 * 53);
    expect(want).toHaveLength(got.length);
    got.forEach((v, k) => expect(Math.abs(v - want[k])).toBeLessThanOrEqual(1e-9));
  });
});
