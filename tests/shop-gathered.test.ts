import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { createDefaultState } from '../src/state/gameState';
import { buyItem, countItem, isGatheredGood } from '../src/state/inventory';
import type { GameState } from '../src/state/types';

function purse(gp: number): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.bank = [];
  state.gp = gp;
  return state;
}

const GATHERED = ['copper_ore', 'raw_shrimp', 'logs', 'bronze_bar', 'bones'] as const;

describe('shop and gathered goods (finding 6)', () => {
  it.each(GATHERED)('buyItem refuses %s', (id) => {
    expect(ITEMS[id]).toBeDefined();
    expect(ITEMS[id].price).toBeGreaterThan(0);
    expect(isGatheredGood(id)).toBe(true);
    const state = purse(1_000_000);
    const result = buyItem(state, id, 1);
    expect(result.ok).toBe(false);
    expect(result.moved).toBe(0);
    expect(state.gp).toBe(1_000_000);
    expect(countItem(state, id)).toBe(0);
  });

  it.each(['air_rune', 'bronze_arrow'])('buyItem still sells %s', (id) => {
    expect(isGatheredGood(id)).toBe(false);
    const state = purse(1_000_000);
    const result = buyItem(state, id, 10);
    expect(result.ok).toBe(true);
    expect(result.moved).toBe(10);
    expect(countItem(state, id)).toBe(10);
    expect(state.gp).toBe(1_000_000 - ITEMS[id].price * 10);
  });
});
