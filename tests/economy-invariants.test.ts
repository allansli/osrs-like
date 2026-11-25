// Economy invariants of design G3.3 (plan M1).
import { describe, expect, it } from 'vitest';
import { GEAR_MARKUP, ITEMS, shopPrice, unitSellPrice } from '../src/data/items';
import { FORGE_RECIPES, performCraft } from '../src/data/recipes';
import { MONSTER_TYPES, WORLD_REGIONS } from '../src/data/world';
import { CAMPS } from '../src/data/worldMap';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { isBossLoot } from '../src/state/adventure';
import { createNewGameState } from '../src/state/gameState';
import { addItem } from '../src/state/inventory';
import { gatherGpPerHour, saleRatio } from './support/pacingModel';
import { NODES } from './support/starterChain';

const MAX_SALE_RATIO = 2.5;
/** Pinned by tests/phase1.test.ts (one oak log makes the oak shortbow), so it stays above the cap. */
const RATIO_EXCEPTIONS = ['fletch_shortbow'];
const MAX_FISH_RATIO = 1.5;
const MAX_GEAR_DROP = 0.02;
const MAX_BOSS_GEAR_DROP = 0.05;

describe('economy invariants (design G3.3)', () => {
  it("no recipe's output sells for more than 2.5 times its inputs", () => {
    for (const recipe of FORGE_RECIPES) {
      if (RATIO_EXCEPTIONS.includes(recipe.id)) continue;
      expect(saleRatio(recipe), recipe.id).toBeLessThanOrEqual(MAX_SALE_RATIO);
    }
  });

  it('shopPrice is never below unitSellPrice', () => {
    for (const item of Object.values(ITEMS)) expect(shopPrice(item), item.id).toBeGreaterThanOrEqual(unitSellPrice(item));
  });

  it('shopPrice equals price for runes, ammunition, food and potions', () => {
    const consumed = Object.values(ITEMS).filter((it) => ['rune', 'ammo', 'food', 'potion'].includes(it.type));
    expect(consumed.length).toBeGreaterThan(0);
    for (const item of consumed) expect(shopPrice(item), item.id).toBe(item.price);
  });

  it('equipment costs GEAR_MARKUP times its list price', () => {
    for (const item of Object.values(ITEMS).filter((it) => it.type === 'equip')) {
      expect(shopPrice(item), item.id).toBe(item.price * GEAR_MARKUP);
    }
  });

  it('no fishing spot earns more than 1.5 times the best rock or tree of a comparable level', () => {
    // Each node is taken at its own requirement and 21 levels above it, as in design table 4.5.
    const others = Object.keys(NODES).filter((k) => NODES[k].skill === 'mining' || NODES[k].skill === 'woodcutting');
    for (const spot of Object.keys(NODES).filter((k) => NODES[k].kind === 'fish')) {
      const req = NODES[spot].req;
      const comparable = others.filter((k) => NODES[k].req <= req + 10);
      for (const above of [0, 21]) {
        const best = Math.max(...comparable.map((k) => gatherGpPerHour(k, NODES[k].req + above)));
        const ratio = gatherGpPerHour(spot, req + above) / best;
        expect(ratio, `${spot} at requirement + ${above}`).toBeLessThanOrEqual(MAX_FISH_RATIO);
      }
    }
  });

  it('every non-boss equipment drop chance is at most 0.02, and the boss\'s is at most 0.05', () => {
    for (const [type, def] of Object.entries(MONSTER_TYPES)) {
      for (const entry of def.drops) {
        if (!entry.id || ITEMS[entry.id]?.type !== 'equip') continue;
        const bound = isBossLoot(type) ? MAX_BOSS_GEAR_DROP : MAX_GEAR_DROP;
        expect(entry.chance, `${type} ${entry.id}`).toBeLessThanOrEqual(bound);
      }
    }
  });

  it('bronze armour needs no gold', () => {
    const start = WORLD_REGIONS.find((r) => r.id === 'lumbridge')!;
    const safe = NODE_PLACEMENTS.filter(
      (p) =>
        p.type === 'copper_rock' &&
        Math.hypot(p.x - start.x, p.z - start.z) <= start.radius &&
        CAMPS.filter((c) => c.aggressive).every((c) => Math.hypot(p.x - c.x, p.z - c.z) > c.radius + (c.aggroRadius || 0))
    );
    expect(safe.length).toBeGreaterThan(0);

    const state = createNewGameState();
    expect(addItem(state, 'copper_ore', 5).ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(performCraft(state, 'smelt_bronze').ok, `smelt ${i + 1}`).toBe(true);
    expect(performCraft(state, 'smith_bronze_legs').ok).toBe(true);
    expect(performCraft(state, 'smith_bronze_plate').ok).toBe(true);
    expect(state.gp).toBe(0);
  });
});
