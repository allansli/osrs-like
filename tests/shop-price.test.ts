import { describe, expect, it } from 'vitest';
import { ITEMS, shopPrice, unitSellPrice } from '../src/data/items';
import { createDefaultState } from '../src/state/gameState';
import { buyItem, countItem } from '../src/state/inventory';
import type { GameState } from '../src/state/types';

function purse(gp: number): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.bank = [];
  state.gp = gp;
  return state;
}

describe('shopPrice (design 7.1 item 2)', () => {
  it('marks equipment up tenfold', () => {
    expect(shopPrice(ITEMS.rune_plate)).toBe(52000);
    expect(shopPrice(ITEMS.bronze_scimitar)).toBe(450);
  });

  it('leaves supplies at list price', () => {
    expect(shopPrice(ITEMS.air_rune)).toBe(6);
    expect(shopPrice(ITEMS.bronze_arrow)).toBe(8);
    expect(shopPrice(ITEMS.shark)).toBe(280);
    expect(shopPrice(ITEMS.prayer_potion)).toBe(240);
  });

  it('is 0 for no item', () => {
    expect(shopPrice(null)).toBe(0);
    expect(shopPrice(undefined)).toBe(0);
  });
});

describe('buyItem charges shopPrice for equipment', () => {
  it('52,000 GP buys one rune_plate and leaves 0', () => {
    const state = purse(52000);
    const result = buyItem(state, 'rune_plate', 1);
    expect(result.ok).toBe(true);
    expect(result.moved).toBe(1);
    expect(result.unit).toBe(52000);
    expect(result.gp).toBe(52000);
    expect(state.gp).toBe(0);
    expect(countItem(state, 'rune_plate')).toBe(1);
  });

  it('51,999 GP is refused with the price in the reason', () => {
    const state = purse(51999);
    const result = buyItem(state, 'rune_plate', 1);
    expect(result.ok).toBe(false);
    expect(result.moved).toBe(0);
    expect(result.reason).toContain((52000).toLocaleString());
    expect(state.gp).toBe(51999);
    expect(countItem(state, 'rune_plate')).toBe(0);
  });

  it('unitSellPrice(rune_plate) is still 3380', () => {
    expect(unitSellPrice(ITEMS.rune_plate)).toBe(3380);
  });
});
