import { describe, expect, it } from 'vitest';
import { rollMonsterHit } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';

// Red until A2 extracts rollMonsterHit (plan 2.3). breathCount is the value after the caller's increment.

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rand that returns the given values in order and records how many draws were taken. */
function scripted(values: number[]): { rand: () => number; draws: () => number } {
  let i = 0;
  return {
    rand: () => {
      if (i >= values.length) throw new Error('rand drawn more often than scripted');
      return values[i++];
    },
    draws: () => i
  };
}

describe('rollMonsterHit', () => {
  it('same seed gives the same result', () => {
    for (const typeKey of ['goblin', 'hill_giant', 'elvarg_dragon']) {
      for (const breath of [1, 3]) {
        const a = rollMonsterHit(typeKey, breath, createDefaultState(), seeded(42));
        const b = rollMonsterHit(typeKey, breath, createDefaultState(), seeded(42));
        expect(a).toEqual(b);
      }
    }
  });

  it('rand is drawn for the hit roll first, then the damage roll', () => {
    // hill_giant maxHit 10: damage draw 0.999 -> floor(0.999 * 11) = 10.
    const hit = scripted([0, 0.999]);
    expect(rollMonsterHit('hill_giant', 1, createDefaultState(), hit.rand).dmg).toBe(10);
    expect(hit.draws()).toBe(2);
    // Swapped order: 0.999 is spent on the hit roll, so it misses and no damage draw follows.
    const miss = scripted([0.999, 0]);
    expect(rollMonsterHit('hill_giant', 1, createDefaultState(), miss.rand).dmg).toBe(0);
    expect(miss.draws()).toBe(1);
  });

  it('hit chance is clamped to 0.12..0.82', () => {
    // Floor: chicken (atk 1) against defence 99 is about 0.067 unclamped.
    const tank = createDefaultState();
    tank.skills.defence.lvl = 99;
    expect(rollMonsterHit('chicken', 1, tank, scripted([0.119, 0.999]).rand).dmg).toBeGreaterThan(0);
    expect(rollMonsterHit('chicken', 1, tank, scripted([0.121]).rand).dmg).toBe(0);
    // Ceiling: lesser_demon (atk 64) against defence 1 is about 0.887 unclamped.
    const bare = createDefaultState();
    expect(rollMonsterHit('lesser_demon', 1, bare, scripted([0.819, 0.999]).rand).dmg).toBeGreaterThan(0);
    expect(rollMonsterHit('lesser_demon', 1, bare, scripted([0.821]).rand).dmg).toBe(0);
  });

  it('Protect from Melee cuts a melee hit to 20% through mitigateDamage', () => {
    const plain = createDefaultState();
    expect(rollMonsterHit('hill_giant', 1, plain, scripted([0, 0.999]).rand).dmg).toBe(10);
    const praying = createDefaultState();
    praying.activePrayers.add('prot_melee');
    expect(rollMonsterHit('hill_giant', 1, praying, scripted([0, 0.999]).rand).dmg).toBe(2);
  });

  it('the dragon breathes fire when breathCount % 3 is 0, through resolveDragonfire', () => {
    // elvarg_dragon: raw = max(1, floor(0.999 * 43)) = 42 on a breath turn.
    const breath = rollMonsterHit('elvarg_dragon', 3, createDefaultState(), scripted([0, 0.999]).rand);
    expect(breath).toEqual({ dmg: 42, dragonfire: true, absorbed: false });
    const warded = createDefaultState();
    warded.activePrayers.add('prot_magic');
    expect(rollMonsterHit('elvarg_dragon', 6, warded, scripted([0, 0.999]).rand)).toEqual({ dmg: 10, dragonfire: true, absorbed: true });
    // Off-turn: ordinary magic hit, maxHit 32 -> floor(0.999 * 33) = 32.
    for (const n of [1, 2, 4]) {
      expect(rollMonsterHit('elvarg_dragon', n, createDefaultState(), scripted([0, 0.999]).rand)).toEqual({ dmg: 32, dragonfire: false, absorbed: false });
    }
    // Only the dragon breathes.
    expect(rollMonsterHit('hill_giant', 3, createDefaultState(), scripted([0, 0.999]).rand).dragonfire).toBe(false);
  });

  it('a miss deals 0', () => {
    expect(rollMonsterHit('hill_giant', 1, createDefaultState(), scripted([0.999]).rand)).toEqual({ dmg: 0, dragonfire: false, absorbed: false });
    const missedBreath = rollMonsterHit('elvarg_dragon', 3, createDefaultState(), scripted([0.999]).rand);
    expect(missedBreath.dmg).toBe(0);
    expect(missedBreath.absorbed).toBe(false);
  });
});
