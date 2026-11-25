import { describe, expect, it } from 'vitest';
import { ITEMS, itemCombatClass, shopPrice, unitSellPrice } from '../src/data/items';
import { FORGE_RECIPES } from '../src/data/recipes';
import { gearSilhouette } from '../src/engine/playerGear';
import { allowedStyles, canUseStyle, playerAttackProfile } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import type { GameState } from '../src/state/types';

function armed(): GameState {
  const state = createDefaultState();
  state.equipment.weapon = 'hazel_staff';
  state.activeSpell = 'wind_strike';
  return state;
}

describe('the Hazel Staff (design 7.1 item 11, G3.12)', () => {
  it('is the row the design gives', () => {
    expect(ITEMS.hazel_staff).toEqual({
      id: 'hazel_staff', name: 'Hazel Staff', type: 'equip', slot: 'weapon', iconKind: 'staff',
      style: 'magic', tier: 'bronze', mag: 4, atk: 2, str: 1, req: { magic: 1 }, price: 60,
      color: 0x7c8a4a, trim: 0x8d6b3a
    });
  });

  it('is a magic weapon', () => {
    expect(itemCombatClass(ITEMS.hazel_staff)).toBe('magic');
    expect(allowedStyles(ITEMS.hazel_staff)).toEqual(['magic']);
  });

  it('uses the existing staff model', () => {
    expect(gearSilhouette(ITEMS.hazel_staff)).toBe('staff');
    expect(gearSilhouette(ITEMS.hazel_staff)).toBe(gearSilhouette(ITEMS.fire_staff));
  });

  it('casts Wind Strike when the runes are there', () => {
    const state = armed();
    expect(canUseStyle('magic', ITEMS.hazel_staff, state).ok).toBe(true);
    state.inventory = [];
    const refused = canUseStyle('magic', ITEMS.hazel_staff, state);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('Air Rune');
    expect(refused.reason).toContain('Mind Rune');
  });

  it('Wind Strike with it hits for 6 at Magic 1', () => {
    const state = armed();
    state.combatStyle = 'magic';
    expect(playerAttackProfile(state)).toEqual({ maxHit: 6, accuracy: 21.5 });
  });

  it('costs 600 GP in the shop and sells for 39', () => {
    expect(shopPrice(ITEMS.hazel_staff)).toBe(600);
    expect(unitSellPrice(ITEMS.hazel_staff)).toBe(39);
  });

  it('no recipe makes it', () => {
    expect(FORGE_RECIPES.some((r) => r.output === 'hazel_staff')).toBe(false);
  });
});
