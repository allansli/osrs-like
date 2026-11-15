import { describe, expect, it } from 'vitest';
import { RIDGES } from '../src/data/worldMap';
import { gapDistance, ridgeSpans } from '../src/state/collision';

// Review 4: the minimap ridge stroke must leave Cinderstep Pass open.
describe('ridgeSpans', () => {
  it('no span point lies inside a gap, and the gap splits the ridge', () => {
    const ridge = RIDGES[0];
    const spans = ridgeSpans(ridge);
    expect(spans.length).toBeGreaterThanOrEqual(2);
    for (const span of spans) for (const [x, z] of span) expect(gapDistance(ridge, x, z)).toBeGreaterThan(0);
  });
});
