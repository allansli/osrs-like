import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/state/gameState';
import { buyItem, buyRunePack, isGatheredGood, sellInventoryMatch, sellItem } from '../src/state/inventory';

/** The same pure functions the shop window's Buy, batch and rune-pack buttons call (src/ui/stations.ts). */
describe('review 3: every shop buy sets boughtWares', () => {
  it('a gear buy through buyItem sets the flag', () => {
    const state = createDefaultState();
    state.gp = 1_000_000;
    state.inventory = [];
    expect(state.quests.boughtWares).toBe(false);
    expect(buyItem(state, 'iron_scimitar', 1).ok).toBe(true);
    expect(state.quests.boughtWares).toBe(true);
  });

  it('a rune pack through buyRunePack sets the flag', () => {
    const state = createDefaultState();
    state.gp = 1_000_000;
    state.inventory = [];
    expect(buyRunePack(state, 1).ok).toBe(true);
    expect(state.quests.boughtWares).toBe(true);
  });

  it('a refused buy leaves the flag unset', () => {
    const state = createDefaultState();
    state.gp = 0;
    expect(buyItem(state, 'iron_scimitar', 1).ok).toBe(false);
    expect(buyRunePack(state, 1).ok).toBe(false);
    expect(buyItem(state, 'copper_ore', 1).ok).toBe(false);
    expect(state.quests.boughtWares).toBe(false);
  });
});

/** The shop sell panel calls sellItem; Sell all loot and Sell gear call sellInventoryMatch. */
describe('review 4: every sell sets soldWares', () => {
  it('a sale through sellItem sets the flag', () => {
    const state = createDefaultState();
    state.inventory = [{ id: 'copper_ore', qty: 3 }];
    expect(state.quests.soldWares).toBe(false);
    expect(sellItem(state, 'copper_ore', 'all').ok).toBe(true);
    expect(state.quests.soldWares).toBe(true);
  });

  it('a bulk sale through sellInventoryMatch sets the flag', () => {
    const state = createDefaultState();
    state.inventory = [{ id: 'copper_ore', qty: 3 }];
    expect(sellInventoryMatch(state, isGatheredGood).ok).toBe(true);
    expect(state.quests.soldWares).toBe(true);
  });

  it('a refused sale leaves the flag unset', () => {
    const state = createDefaultState();
    state.inventory = [];
    expect(sellItem(state, 'copper_ore', 'all').ok).toBe(false);
    expect(sellInventoryMatch(state, isGatheredGood).ok).toBe(false);
    expect(state.quests.soldWares).toBe(false);
  });
});
