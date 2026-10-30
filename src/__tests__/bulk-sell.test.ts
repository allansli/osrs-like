import { describe, expect, it } from 'vitest';
import { ITEMS, unitSellPrice } from '../data/items';
import { createDefaultState } from '../state/gameState';
import {
  countItem,
  isGatheredGood,
  isUnequippedGear,
  quoteInventorySale,
  sellInventoryMatch,
  sellItem
} from '../state/inventory';
import type { GameState } from '../state/types';

function purse(): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.gp = 0;
  return state;
}

describe('sellItem quantities', () => {
  it('sells one unstackable copy across separate slots when the quantity is higher', () => {
    const state = purse();
    state.inventory = [
      { id: 'bronze_plate', qty: 1 },
      { id: 'bronze_helm', qty: 1 },
      { id: 'bronze_plate', qty: 1 },
      { id: 'bronze_plate', qty: 1 }
    ];
    const result = sellItem(state, 'bronze_plate', 5);
    expect(result.ok).toBe(true);
    expect(result.moved).toBe(3);
    expect(result.gp).toBe(unitSellPrice(ITEMS.bronze_plate) * 3);
    expect(countItem(state, 'bronze_plate')).toBe(0);
    expect(countItem(state, 'bronze_helm')).toBe(1);
    expect(state.inventory).toHaveLength(1);
    expect(state.gp).toBe(result.gp);
  });

  it('stops at the copies on hand when selling a fixed batch', () => {
    const state = purse();
    state.inventory = [
      { id: 'logs', qty: 4 },
      { id: 'logs', qty: 3 }
    ];
    const result = sellItem(state, 'logs', 5);
    expect(result.moved).toBe(5);
    expect(countItem(state, 'logs')).toBe(2);
    expect(result.gp).toBe(unitSellPrice(ITEMS.logs) * 5);
  });

  it('sells a whole stack with all', () => {
    const state = purse();
    state.inventory = [{ id: 'bones', qty: 12 }];
    const result = sellItem(state, 'bones', 'all');
    expect(result.moved).toBe(12);
    expect(state.inventory).toHaveLength(0);
    expect(result.unit).toBe(unitSellPrice(ITEMS.bones));
    expect(result.gp).toBe(result.unit! * 12);
  });
});

describe('bulk store quotes', () => {
  it('prices ores, fish, logs, bars, and bones at 65% and leaves gear for the other button', () => {
    const state = purse();
    state.inventory = [
      { id: 'copper_ore', qty: 10 },
      { id: 'raw_shrimp', qty: 4 },
      { id: 'logs', qty: 2 },
      { id: 'iron_bar', qty: 3 },
      { id: 'bones', qty: 5 },
      { id: 'shrimp', qty: 6 },
      { id: 'air_rune', qty: 100 },
      { id: 'bronze_plate', qty: 1 },
      { id: 'bronze_plate', qty: 1 }
    ];
    const expectedResources = [
      ['copper_ore', 10],
      ['raw_shrimp', 4],
      ['logs', 2],
      ['iron_bar', 3],
      ['bones', 5]
    ].reduce((sum, [id, qty]) => sum + unitSellPrice(ITEMS[id as string]) * (qty as number), 0);
    expect(quoteInventorySale(state, isGatheredGood)).toBe(expectedResources);
    expect(isGatheredGood('shrimp')).toBe(false);
    expect(isGatheredGood('air_rune')).toBe(false);
    expect(quoteInventorySale(state, isUnequippedGear)).toBe(unitSellPrice(ITEMS.bronze_plate) * 2);

    const sold = sellInventoryMatch(state, isGatheredGood, 'empty');
    expect(sold.ok).toBe(true);
    expect(sold.gp).toBe(expectedResources);
    expect(countItem(state, 'copper_ore')).toBe(0);
    expect(countItem(state, 'raw_shrimp')).toBe(0);
    expect(countItem(state, 'shrimp')).toBe(6);
    expect(countItem(state, 'bronze_plate')).toBe(2);

    const gear = sellInventoryMatch(state, isUnequippedGear, 'empty');
    expect(gear.moved).toBe(2);
    expect(countItem(state, 'bronze_plate')).toBe(0);
    expect(countItem(state, 'shrimp')).toBe(6);
    expect(countItem(state, 'air_rune')).toBe(100);
  });
});
