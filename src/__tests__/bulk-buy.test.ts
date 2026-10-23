import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { createDefaultState } from '../state/gameState';
import { buyItem, buyRunePack, countItem, runePackCost } from '../state/inventory';
import { migrateLegacySave } from '../state/save';
import type { GameState, QtyMode } from '../state/types';

const BULK_QTYS = [50, 100, 500, 1000] as const;
const SAMPLE_RUNES = ['air_rune', 'fire_rune', 'death_rune', 'blood_rune'] as const;

function purse(gp: number): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.bank = [];
  state.gp = gp;
  return state;
}

function runeIds(): string[] {
  return Object.values(ITEMS).filter((it) => it.type === 'rune').map((it) => it.id);
}

describe('bulk rune purchases', () => {
  it.each(BULK_QTYS.flatMap((qty) => SAMPLE_RUNES.map((id) => [id, qty] as const)))(
    'buys %s × %i without spending the rest of the pouch',
    (id, qty) => {
      const state = purse(2_000_000);
      const price = ITEMS[id].price;
      const result = buyItem(state, id, qty);
      expect(result.ok).toBe(true);
      expect(result.moved).toBe(qty);
      expect(result.gp).toBe(price * qty);
      expect(result.unit).toBe(price);
      expect(countItem(state, id)).toBe(qty);
      expect(state.gp).toBe(2_000_000 - price * qty);
      for (const other of SAMPLE_RUNES) {
        if (other !== id) expect(countItem(state, other)).toBe(0);
      }
    }
  );

  it('caps a 1000-rune click at what the pouch can afford', () => {
    const state = purse(160 * 6 + 50);
    const result = buyItem(state, 'blood_rune', 1000);
    expect(result.ok).toBe(true);
    expect(result.moved).toBe(6);
    expect(state.gp).toBe(50);
    expect(countItem(state, 'blood_rune')).toBe(6);
  });
});

describe('buyRunePack', () => {
  it.each([100, 500])('buys ×%i of every rune when the pouch covers the pack exactly', (qty) => {
    const cost = runePackCost(qty);
    const state = purse(cost);
    const result = buyRunePack(state, qty);
    expect(result.ok).toBe(true);
    expect(result.gp).toBe(cost);
    expect(result.moved).toBe(qty * runeIds().length);
    expect(state.gp).toBe(0);
    for (const id of runeIds()) expect(countItem(state, id)).toBe(qty);
    expect(countItem(state, 'bronze_arrow')).toBe(0);
    expect(state.inventory).toHaveLength(runeIds().length);
  });

  it('defaults to 500 of every rune', () => {
    const state = purse(runePackCost(500));
    const result = buyRunePack(state);
    expect(result.ok).toBe(true);
    expect(result.moved).toBe(500 * runeIds().length);
    expect(countItem(state, 'death_rune')).toBe(500);
    expect(countItem(state, 'law_rune')).toBe(500);
  });

  it.each([100, 500])('refuses a ×%i pack that costs 1 GP more than the pouch', (qty) => {
    const cost = runePackCost(qty);
    const state = purse(cost - 1);
    const result = buyRunePack(state, qty);
    expect(result.ok).toBe(false);
    expect(result.moved).toBe(0);
    expect(state.gp).toBe(cost - 1);
    expect(state.inventory).toEqual([]);
  });

  it('refuses the pack when new rune stacks would overflow the backpack', () => {
    const state = purse(runePackCost(500));
    state.inventory = Array.from({ length: 28 }, () => ({ id: 'bronze_helm', qty: 1 }));
    const result = buyRunePack(state, 500);
    expect(result.ok).toBe(false);
    expect(state.gp).toBe(runePackCost(500));
    expect(countItem(state, 'air_rune')).toBe(0);
    expect(state.inventory).toHaveLength(28);
  });

  it('stacks a ×100 pack onto runes already in the backpack', () => {
    const state = purse(runePackCost(100));
    state.inventory = [
      { id: 'air_rune', qty: 40 },
      { id: 'blood_rune', qty: 3 }
    ];
    const result = buyRunePack(state, 100);
    expect(result.ok).toBe(true);
    expect(countItem(state, 'air_rune')).toBe(140);
    expect(countItem(state, 'blood_rune')).toBe(103);
    expect(countItem(state, 'fire_rune')).toBe(100);
    expect(countItem(state, 'chaos_rune')).toBe(100);
    expect(state.gp).toBe(0);
  });
});

describe('saved bulk quantities', () => {
  it.each([1, 5, 10, 50, 100, 500, 1000, 'all'] as const)('restores transferQty %s', (transferQty: QtyMode) => {
    const migrated = migrateLegacySave({ transferQty, gp: 25, inventory: [] });
    expect(migrated.state.transferQty).toBe(transferQty);
    expect(migrated.state.gp).toBe(25);
  });
});
