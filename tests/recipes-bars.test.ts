import { describe, expect, it } from 'vitest';
import { performCraft, recipeById, tryCraft, FORGE_RECIPES } from '../src/data/recipes';
import { createNewGameState } from '../src/state/gameState';
import { addItem, countItem } from '../src/state/inventory';

/** Design 7.1 item 5: the inputs of every smith recipe, and the level where it unlocks. */
const SMITH_TABLE: Record<string, { input: Record<string, number>; req: number }> = {
  smith_bronze_legs: { input: { bronze_bar: 2 }, req: 1 },
  smith_bronze_plate: { input: { bronze_bar: 3 }, req: 2 },
  smith_iron_scim: { input: { iron_bar: 2 }, req: 5 },
  smith_iron_legs: { input: { iron_bar: 2 }, req: 7 },
  smith_iron_plate: { input: { iron_bar: 3 }, req: 9 },
  smith_mith_scim: { input: { mithril_bar: 3 }, req: 20 },
  smith_mith_legs: { input: { mithril_bar: 3 }, req: 22 },
  smith_mith_plate: { input: { mithril_bar: 4 }, req: 24 },
  smith_gilded_legs: { input: { rune_legs: 1, gold_bar: 3 }, req: 46 },
  smith_gilded_plate: { input: { rune_plate: 1, gold_bar: 3 }, req: 48 },
  smith_rune_scim: { input: { runite_bar: 4 }, req: 40 },
  smith_rune_legs: { input: { runite_bar: 4 }, req: 42 },
  smith_rune_plate: { input: { runite_bar: 5 }, req: 45 },
  // Stage 6, slice 1 (D1, design 7.4): steel and blacksteel, two bars for the weapon and legs, three for the body.
  smith_steel_sword: { input: { steel_bar: 2 }, req: 10 },
  smith_steel_legs: { input: { steel_bar: 2 }, req: 12 },
  smith_steel_plate: { input: { steel_bar: 3 }, req: 14 },
  smith_black_scim: { input: { black_bar: 2 }, req: 15 },
  smith_black_legs: { input: { black_bar: 2 }, req: 17 },
  smith_black_plate: { input: { black_bar: 3 }, req: 19 },
  // Stage 6, slice 3 (Z3, design 7.4): adamant, three bars for the weapon and legs, four for the body.
  smith_addy_scim: { input: { adamant_bar: 3 }, req: 30 },
  smith_addy_legs: { input: { adamant_bar: 3 }, req: 32 },
  smith_addy_plate: { input: { adamant_bar: 4 }, req: 34 }
};

function stateWith(smithing: number, items: Record<string, number>) {
  const state = createNewGameState();
  state.skills.smithing.lvl = smithing;
  for (const [id, qty] of Object.entries(items)) expect(addItem(state, id, qty).ok).toBe(true);
  return state;
}

describe('smithing takes bars (G3.4, audit finding 9)', () => {
  it('every smith recipe takes bars, or a rune piece and gold bars', () => {
    const smith = FORGE_RECIPES.filter((r) => r.id.startsWith('smith_'));
    expect(smith.map((r) => r.id).sort()).toEqual(Object.keys(SMITH_TABLE).sort());
    for (const r of smith) {
      expect(r.input, r.id).toEqual(SMITH_TABLE[r.id].input);
      expect(r.req, r.id).toBe(SMITH_TABLE[r.id].req);
    }
  });

  it('ore alone cannot forge', () => {
    const state = stateWith(2, { copper_ore: 3 });
    const result = tryCraft(state, 'smith_bronze_plate');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Bronze Bar');
    expect(countItem(state, 'copper_ore')).toBe(3);
  });

  it("bars forge and give today's XP", () => {
    const bronze = stateWith(2, { bronze_bar: 3 });
    const xp0 = bronze.skills.smithing.xp;
    const b = performCraft(bronze, 'smith_bronze_plate');
    expect(b.ok).toBe(true);
    expect(bronze.skills.smithing.xp - xp0).toBe(50);
    expect(countItem(bronze, 'bronze_plate')).toBe(1);
    expect(countItem(bronze, 'bronze_bar')).toBe(0);

    const rune = stateWith(45, { runite_bar: 5 });
    const r0 = rune.skills.smithing.xp;
    expect(performCraft(rune, 'smith_rune_plate').ok).toBe(true);
    expect(rune.skills.smithing.xp - r0).toBe(520);
    expect(countItem(rune, 'rune_plate')).toBe(1);
  });

  it('gilded platebody consumes the rune platebody and three gold bars at Smithing 48 and is refused at 47', () => {
    const early = stateWith(47, { rune_plate: 1, gold_bar: 3 });
    expect(tryCraft(early, 'smith_gilded_plate').ok).toBe(false);
    expect(countItem(early, 'rune_plate')).toBe(1);
    expect(countItem(early, 'gold_bar')).toBe(3);

    const ready = stateWith(48, { rune_plate: 1, gold_bar: 3 });
    expect(tryCraft(ready, 'smith_gilded_plate').ok).toBe(true);
    expect(countItem(ready, 'rune_plate')).toBe(0);
    expect(countItem(ready, 'gold_bar')).toBe(0);
    expect(countItem(ready, 'gilded_plate')).toBe(1);
  });

  it('smelt requirements are 1, 5, 20, 35, 40', () => {
    const reqs = ['bronze', 'iron', 'mithril', 'gold', 'runite'].map((m) => recipeById(`smelt_${m}`)?.req);
    expect(reqs).toEqual([1, 5, 20, 35, 40]);
  });

  it('bows take 1, 3, 4, 5 and 6 logs', () => {
    const bows: Array<[string, string, number]> = [
      ['fletch_shortbow', 'oak_logs', 1],
      ['fletch_willow_bow', 'willow_logs', 3],
      ['fletch_maple_bow', 'maple_logs', 4],
      ['fletch_yew_bow', 'yew_logs', 5],
      ['fletch_magic_bow', 'magic_logs', 6]
    ];
    for (const [id, log, n] of bows) expect(recipeById(id)?.input, id).toEqual({ [log]: n });
  });

  it("a smelt requirement never exceeds its metal's lowest forging requirement", () => {
    const metals: Array<[string, string[]]> = [
      ['bronze', ['smith_bronze_legs', 'smith_bronze_plate']],
      ['iron', ['smith_iron_scim', 'smith_iron_legs', 'smith_iron_plate']],
      ['mithril', ['smith_mith_scim', 'smith_mith_legs', 'smith_mith_plate']],
      ['gold', ['smith_gilded_legs', 'smith_gilded_plate']],
      ['runite', ['smith_rune_scim', 'smith_rune_legs', 'smith_rune_plate']]
    ];
    for (const [metal, forges] of metals) {
      const smelt = recipeById(`smelt_${metal}`)!;
      const lowest = Math.min(...forges.map((id) => recipeById(id)!.req));
      expect(smelt.req, metal).toBeLessThanOrEqual(lowest);
    }
  });
});
