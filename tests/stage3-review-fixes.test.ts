import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/state/gameState';
import { buyItem, buyRunePack } from '../src/state/inventory';

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
