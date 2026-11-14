import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { tryCraft } from '../src/data/recipes';
import { resolveDragonfire } from '../src/state/adventure';
import { createDefaultState } from '../src/state/gameState';
import { BACKPACK_SIZE } from '../src/state/gameState';
import { countItem } from '../src/state/inventory';

/** Distinct stackable fillers, so every one takes its own backpack slot. */
function fillers(n: number, exclude: string[]): string[] {
  const ids = Object.values(ITEMS)
    .filter((i) => i.type !== 'equip' && !exclude.includes(i.id))
    .map((i) => i.id)
    .slice(0, n);
  expect(ids).toHaveLength(n);
  return ids;
}

function fullPack(inputs: Record<string, number>, exclude: string[]) {
  const state = createDefaultState();
  state.skills.cooking.lvl = 99;
  state.skills.smithing.lvl = 99;
  const slots = Object.entries(inputs).map(([id, qty]) => ({ id, qty }));
  const free = BACKPACK_SIZE - slots.length;
  state.inventory = [...fillers(free, [...exclude, ...Object.keys(inputs)]).map((id) => ({ id, qty: 1 })), ...slots];
  expect(state.inventory).toHaveLength(BACKPACK_SIZE);
  return state;
}

describe('resolveDragonfire ward flag (finding 7)', () => {
  it('returns reduced damage with the ward flag and no shield', () => {
    const state = createDefaultState();
    state.quests.dragonfireWard = true;
    state.equipment.shield = '';
    expect(resolveDragonfire(100, state)).toEqual({ damage: 25, absorbed: true });
  });
});

describe('crafting capacity (finding 8)', () => {
  it('succeeds when consuming one input slot frees the slot for the output', () => {
    const state = fullPack({ raw_shrimp: 1 }, ['shrimp']);
    const r = tryCraft(state, 'cook_shrimp');
    expect(r.reason).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(countItem(state, 'shrimp')).toBe(1);
    expect(countItem(state, 'raw_shrimp')).toBe(0);
  });

  it('succeeds when two input stacks free exactly the slots needed', () => {
    const state = fullPack({ arrow_shaft: 15, feather: 15 }, ['bronze_arrow']);
    const r = tryCraft(state, 'fletch_bronze_arrows');
    expect(r.reason).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(countItem(state, 'bronze_arrow')).toBe(15);
  });

  it('still refuses, and changes nothing, when the inputs free no slot', () => {
    const state = fullPack({ raw_shrimp: 2 }, ['shrimp']);
    const before = JSON.stringify(state.inventory);
    const r = tryCraft(state, 'cook_shrimp');
    expect(r.ok).toBe(false);
    expect(JSON.stringify(state.inventory)).toBe(before);
  });
});
