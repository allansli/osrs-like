import { describe, expect, it } from 'vitest';
import { gatherChance, HP_REGEN_PER_SEC, rollDrops } from '../src/state/economy';

// Red until E3 (missing module only). Expected values are written out from the expressions the engine
// uses today: handleMonsterDeath (src/engine/actions.ts 272-288), performResourceGather (actions.ts 425).

/** A rand that hands out the scripted values in order and throws when it runs dry. */
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

describe('rollDrops', () => {
  // goblin table: bones 1.0, gp [12,36] 0.9, iron_plate 0.16, iron_legs 0.16, shrimp 0.35.
  it('a goblin with every roll at 0 drops bones, 12 GP, both iron pieces and shrimp, in table order', () => {
    const r = scripted([0, 0, 0, 0, 0, 0]);
    expect(rollDrops('goblin', r.rand)).toEqual([
      { kind: 'item', id: 'bones', qty: 1 },
      { kind: 'gp', amount: 12 },
      { kind: 'item', id: 'iron_plate', qty: 1 },
      { kind: 'item', id: 'iron_legs', qty: 1 },
      { kind: 'item', id: 'shrimp', qty: 1 }
    ]);
    expect(r.draws()).toBe(6);
  });

  it('every roll at 0.999 drops only the chance-1 entries', () => {
    const r = scripted([0.999, 0.999, 0.999, 0.999, 0.999]);
    expect(rollDrops('goblin', r.rand)).toEqual([{ kind: 'item', id: 'bones', qty: 1 }]);
    expect(r.draws()).toBe(5);
  });

  it('the coin draw follows its chance draw immediately', () => {
    // bones 0.5, gp chance 0.5 (kept), gp amount 0.999 -> 12 + floor(0.999 * 25) = 36, then the three misses.
    const r = scripted([0.5, 0.5, 0.999, 0.999, 0.999, 0.999]);
    expect(rollDrops('goblin', r.rand)).toEqual([
      { kind: 'item', id: 'bones', qty: 1 },
      { kind: 'gp', amount: 36 }
    ]);
    expect(r.draws()).toBe(6);
  });

  it('a draw equal to the chance keeps the entry', () => {
    // shrimp chance 0.35: the draw 0.35 is kept (draw <= chance).
    const r = scripted([0.999, 0.999, 0.999, 0.999, 0.35]);
    expect(rollDrops('goblin', r.rand)).toEqual([
      { kind: 'item', id: 'bones', qty: 1 },
      { kind: 'item', id: 'shrimp', qty: 1 }
    ]);
  });

  it('the number of draws is entries + kept coin entries', () => {
    // chicken: bones 1.0, cooked_chicken 0.6, gp [6,18] 0.85, feather 0.8 x5 (Stage 6, D2: appended last). 4 entries.
    const none = scripted([0.999, 0.999, 0.999, 0.999]);
    rollDrops('chicken', none.rand);
    expect(none.draws()).toBe(4);
    const withCoin = scripted([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(rollDrops('chicken', withCoin.rand)).toEqual([
      { kind: 'item', id: 'bones', qty: 1 },
      { kind: 'item', id: 'cooked_chicken', qty: 1 },
      { kind: 'gp', amount: 6 + Math.floor(0.5 * 13) },
      { kind: 'item', id: 'feather', qty: 5 }
    ]);
    expect(withCoin.draws()).toBe(5);
  });
});

describe('gatherChance', () => {
  // actions.ts 425: min(0.92, 0.50 + (level - req) * 0.02).
  it('is 0.5 at the requirement', () => expect(gatherChance(15, 15)).toBeCloseTo(0.5, 12));
  it('is 0.7 ten levels above', () => expect(gatherChance(25, 15)).toBeCloseTo(0.7, 12));
  it('reaches the 0.92 cap 21 levels above', () => expect(gatherChance(36, 15)).toBeCloseTo(0.92, 12));
  it('stays at 0.92 forty levels above', () => expect(gatherChance(55, 15)).toBe(0.92));
});

describe('regeneration', () => {
  it('HP_REGEN_PER_SEC is 0.25', () => expect(HP_REGEN_PER_SEC).toBe(0.25));
});
