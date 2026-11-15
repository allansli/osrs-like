import { describe, expect, it } from 'vitest';
import { dodgedPlan, heavyImpactPlan, heavyTakenPlan } from '../src/state/soundPlan';

describe('heavy impact sound (review 11): chosen after the damage roll', () => {
  it('a heavy that deals damage plays the heavy-taken thump', () => {
    expect(heavyImpactPlan(true, 7)).toEqual(heavyTakenPlan());
  });
  it('a resolve with the hero outside the shape plays the dodge whoosh', () => {
    expect(heavyImpactPlan(false, 0)).toEqual(dodgedPlan());
  });
  it('a heavy that lands inside the shape but rolls 0 plays neither the thump nor the whoosh', () => {
    expect(heavyImpactPlan(true, 0)).toEqual([]);
  });
});
