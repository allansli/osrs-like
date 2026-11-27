import { describe, expect, it } from 'vitest';
import { RESOURCE_NODES_DEF } from '../src/data/world';
import { ITEMS } from '../src/data/items';
import { PRAYERS, SPELLS } from '../src/data/magic';
import { FORGE_RECIPES } from '../src/data/recipes';
import { forgeHint, unlockLine, unlocksAt } from '../src/state/unlocks';

type Unlock = ReturnType<typeof unlocksAt>[number];

const names = (skill: string, level: number) => unlocksAt(skill, level).map((u) => u.name);

describe('unlocksAt (design 7.1 item 7, G3.6)', () => {
  it('names what first becomes usable at exactly that level', () => {
    expect(names('attack', 5)).toContain('Iron Scimitar');
    expect(names('mining', 10)).toContain('Iron Ore Vein');
    expect(names('smithing', 9)).toContain('Forge Iron Platebody');
    expect(names('prayer', 30)).toContain('Protect from Melee');
    expect(names('magic', 12)).toContain('Fire Bolt');
  });

  it('returns an empty list for a level with nothing, and for an unknown skill', () => {
    expect(unlocksAt('attack', 6)).toEqual([]);
    expect(unlocksAt('nonsense', 5)).toEqual([]);
  });

  it('matches each kind to its table and skill', () => {
    const entry = (skill: string, level: number, kind: Unlock['kind']) =>
      unlocksAt(skill, level).filter((u) => u.kind === kind);
    expect(entry('attack', 5, 'gear').map((u) => u.id)).toContain('iron_scimitar');
    expect(entry('smithing', 9, 'recipe').map((u) => u.id)).toContain('smith_iron_plate');
    expect(entry('mining', 10, 'node').map((u) => u.id)).toContain('iron_rock');
    expect(entry('prayer', 30, 'prayer').map((u) => u.id)).toContain('prot_melee');
    expect(entry('magic', 12, 'spell').map((u) => u.id)).toContain('fire_bolt');
    // prayers only for prayer, spells only for magic
    expect(unlocksAt('attack', 5).some((u) => u.kind === 'prayer' || u.kind === 'spell')).toBe(false);
    expect(unlocksAt('defence', 30).some((u) => u.kind === 'prayer')).toBe(false);
    expect(unlocksAt('prayer', 30).some((u) => u.kind === 'spell')).toBe(false);
  });

  it('orders gear, recipes, nodes, prayers, spells', () => {
    const rank = { gear: 0, recipe: 1, node: 2, prayer: 3, spell: 4 } as const;
    for (const skill of ['attack', 'defence', 'smithing', 'mining', 'prayer', 'magic', 'woodcutting', 'fishing']) {
      for (let level = 1; level <= 99; level++) {
        const kinds = unlocksAt(skill, level).map((u) => rank[u.kind]);
        expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
      }
    }
  });

  it('every name comes from a data table', () => {
    const known = new Set<string>([
      ...Object.values(ITEMS).map((i) => i.name),
      ...FORGE_RECIPES.map((r) => r.name),
      ...Object.values(RESOURCE_NODES_DEF).map((n) => (n as { name: string }).name),
      ...PRAYERS.map((p) => p.name),
      ...SPELLS.map((s) => s.name)
    ]);
    for (const skill of ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'smithing', 'mining', 'woodcutting', 'fishing', 'cooking']) {
      for (let level = 1; level <= 99; level++) {
        for (const u of unlocksAt(skill, level)) expect(known.has(u.name)).toBe(true);
      }
    }
  });
});

describe('forgeHint', () => {
  it('names the recipe inputs and the Smithing level for forgeable gear', () => {
    const hint = forgeHint('iron_scimitar');
    expect(hint).not.toBeNull();
    expect(hint!.startsWith('forge: 2 ')).toBe(true);
    expect(hint!.endsWith(' at Smithing 5')).toBe(true);
    expect(forgeHint('shortbow')!.endsWith(' at Smithing 5')).toBe(true);
  });

  it('is null for an item no smith or fletch recipe makes', () => {
    // Stage 6 (D1, design 11.3 item 24): steel gear is forged now, so the case names a crossbow no recipe makes.
    expect(FORGE_RECIPES.some((r) => r.output === 'rune_crossbow')).toBe(false);
    expect(forgeHint('rune_crossbow')).toBeNull();
    expect(forgeHint('no_such_item')).toBeNull();
  });
});

describe('unlockLine', () => {
  it('is null for an empty list', () => {
    expect(unlockLine('Attack', 6, [])).toBeNull();
  });

  it('shows the shop price and the forge recipe side by side for forgeable gear', () => {
    const line = unlockLine('Attack', 5, unlocksAt('attack', 5))!;
    expect(line.startsWith('Level 5 Attack unlocks: ')).toBe(true);
    expect(line).toContain('<b>Iron Scimitar</b>');
    expect(line).toContain('shop 1,400 GP');
    expect(line).toContain('forge:');
    expect(line.endsWith('.')).toBe(true);
  });

  it('shows the shop price alone for gear with no recipe', () => {
    const line = unlockLine('Ranged', 45, unlocksAt('ranged', 45))!;
    expect(line).toContain('<b>Rune Crossbow</b> (shop 48,000 GP)');
    expect(line).not.toContain('forge');
  });

  it('puts no bracket after other kinds', () => {
    const line = unlockLine('Mining', 10, unlocksAt('mining', 10))!;
    expect(line).toContain('<b>Iron Ore Vein</b>');
    expect(line).not.toContain('shop');
  });

  it('names at most three and counts the rest', () => {
    const many: Unlock[] = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ kind: 'node', name, id: name.toLowerCase() }));
    const line = unlockLine('Mining', 40, many)!;
    for (const n of ['A', 'B', 'C']) expect(line).toContain(`<b>${n}</b>`);
    for (const n of ['D', 'E']) expect(line).not.toContain(`<b>${n}</b>`);
    expect(line).toContain('<b>A</b>, <b>B</b>, <b>C</b>');
    expect(line.endsWith(' and 2 more.')).toBe(true);
    const three = unlockLine('Mining', 40, many.slice(0, 3))!;
    expect(three).not.toContain('more');
  });
});
