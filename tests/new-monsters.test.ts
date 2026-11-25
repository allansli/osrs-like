import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MONSTER_TYPES as CATALOG_MONSTERS } from '../src/data/catalog';
import { PATTERNS } from '../src/data/attacks';
import { ITEMS } from '../src/data/items';
import { MONSTER_TYPES, type MonsterDef } from '../src/data/world';
import { CAMPS } from '../src/data/worldMap';

// Design 6.4, 6.8, 9.1 (G4.9). The three new rows are added by M3: until then the new-row cases are red.
type Row = MonsterDef & { model?: string; tint?: number; modelScale?: number };
const row = (key: string) => MONSTER_TYPES[key] as Row | undefined;
const campOf = (type: string) => CAMPS.find((c) => c.members.some((m) => m.type === type));

const GOLDEN = new URL('./fixtures/existing-dragon.golden.json', import.meta.url);
// The golden is written once, before M3, from the live tables (X05 pattern). It is never regenerated after M1.
if (process.env.UPDATE_GOLDEN === '1') {
  const dragonCamp = CAMPS.find((c) => c.id === 'dragon');
  writeFileSync(GOLDEN, JSON.stringify({ monster: MONSTER_TYPES.elvarg_dragon, camp: dragonCamp }, null, 1) + '\n');
}

describe('the existing dragon', () => {
  it("the existing dragon's row, drops and camp equal the golden", () => {
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    const live = JSON.parse(JSON.stringify({ monster: MONSTER_TYPES.elvarg_dragon, camp: CAMPS.find((c) => c.id === 'dragon') }));
    expect(live).toEqual(golden);

    const d = MONSTER_TYPES.elvarg_dragon as Row;
    expect([d.name, d.level, d.hp, d.maxHit, d.atk, d.def, d.style]).toEqual(['Elvarg the Crag Dragon', 95, 260, 32, 88, 78, 'magic']);
    expect(d.drops).toHaveLength(6);
    expect(d.pattern).toBeUndefined();
    expect(d.model).toBeUndefined();
    expect(d.tint).toBeUndefined();
    expect(golden.camp.members).toEqual([{ type: 'elvarg_dragon', x: -102, z: 100 }]);
    expect(golden.monster).not.toHaveProperty('pattern');
    expect(golden.monster).not.toHaveProperty('model');
    expect(golden.monster).not.toHaveProperty('tint');
  });
});

describe('the two shipped monsters (design 6.8)', () => {
  const giant = CATALOG_MONSTERS.hill_giant;
  const guardian = CATALOG_MONSTERS.moss_guardian;
  const between = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b);

  const cases = [
    { key: 'saltback_stalker', name: 'Saltback Stalker', level: 34, hp: 58, maxHit: 12, atk: 32, def: 28, style: 'melee', members: 3,
      pattern: ['basic', 'basic', 'basic', 'tail_lash'], model: 'scorpion', modelScale: 1.4,
      gp: [140, 340], extra: { id: 'lobster', chance: 0.4 } },
    { key: 'thornwatch_marksman', name: 'Thornwatch Marksman', level: 38, hp: 54, maxHit: 13, atk: 36, def: 26, style: 'ranged', members: 2,
      pattern: ['basic', 'basic', 'basic', 'pinning_volley'], model: 'dark_ranger', modelScale: 1.1,
      gp: [160, 400], extra: { id: 'swordfish', chance: 0.3 } }
  ];

  for (const c of cases) {
    describe(c.key, () => {
      it('has the row of 6.8', () => {
        const r = row(c.key);
        expect(r, 'row missing').toBeDefined();
        expect([r!.name, r!.level, r!.hp, r!.maxHit, r!.atk, r!.def, r!.style]).toEqual([c.name, c.level, c.hp, c.maxHit, c.atk, c.def, c.style]);
        expect(r!.model).toBe(c.model);
        expect(r!.modelScale).toBe(c.modelScale);
        expect(typeof r!.tint).toBe('number');
      });

      it('its stats lie between the giant and the guardian', () => {
        const r = row(c.key)!;
        for (const f of ['level', 'hp', 'maxHit', 'atk', 'def'] as const) {
          expect(between(r[f], giant[f], guardian[f]), `${c.key}.${f}`).toBe(true);
        }
      });

      it('has a pattern that exists, with a heavy after three basics', () => {
        const r = row(c.key)!;
        expect(r.pattern, 'pattern missing').toBeDefined();
        expect(PATTERNS[r.pattern!]).toEqual(c.pattern);
      });

      it('has an aggressive camp of the right size', () => {
        const camp = campOf(c.key);
        expect(camp, 'camp missing').toBeDefined();
        expect(camp!.members).toHaveLength(c.members);
        expect(camp!.members.every((m) => m.type === c.key)).toBe(true);
        expect(camp!.aggressive).toBe(true);
      });

      it('drops big bones, its coin range and one food, and no equipment', () => {
        const r = row(c.key)!;
        expect(r.drops).toContainEqual({ id: 'big_bones', chance: 1 });
        expect(r.drops).toContainEqual({ gp: c.gp, chance: 0.95 });
        expect(r.drops).toContainEqual(c.extra);
        if (c.key === 'thornwatch_marksman') expect(r.drops.some((d) => d.id === 'bronze_arrow')).toBe(true);
      });
    });
  }
});

describe('Ashmantle the Slag Wyrm (design 6.4)', () => {
  it('has the row of 6.4', () => {
    const r = row('ashmantle');
    expect(r, 'row missing').toBeDefined();
    expect([r!.name, r!.level, r!.hp, r!.maxHit, r!.atk, r!.def, r!.style]).toEqual(['Ashmantle the Slag Wyrm', 110, 1400, 72, 120, 78, 'magic']);
    expect(r!.model).toBe('elvarg_dragon');
    expect(typeof r!.tint).toBe('number');
    expect(r!.modelScale).toBe(1.2);
  });

  it('has an aggressive camp of one at (-102, 54) with the ranged aggression radius', () => {
    const camp = campOf('ashmantle');
    expect(camp, 'camp missing').toBeDefined();
    expect(camp!.id).toBe('ashmantle');
    expect(camp!.members).toEqual([{ type: 'ashmantle', x: -102, z: 54 }]);
    expect(camp!.aggressive).toBe(true);
    expect(camp!.aggroRadius).toBe(12);
  });

  it('gives coins, dragon bones and a shark, always, and no equipment', () => {
    const r = row('ashmantle');
    expect(r, 'row missing').toBeDefined();
    expect(r!.drops).toContainEqual({ gp: [1500, 3000], chance: 1 });
    expect(r!.drops).toContainEqual({ id: 'dragon_bones', chance: 1 });
    expect(r!.drops).toContainEqual({ id: 'shark', chance: 1 });
  });
});

const NEW = ['saltback_stalker', 'thornwatch_marksman', 'ashmantle'];

describe('models and equipment', () => {
  // the 10 species of monsters.glb: the catalog's eight plus the goblin archer and the dark ranger of world.ts
  const MODELS = Object.keys(MONSTER_TYPES).filter((k) => !NEW.includes(k));

  it('every model names one of the 10 existing monster models', () => {
    expect(MODELS).toHaveLength(10);
    for (const [key, def] of Object.entries(MONSTER_TYPES)) {
      const model = (def as Row).model;
      if (model !== undefined) expect(MODELS, `${key}.model`).toContain(model);
    }
    // the three new rows each reuse a model
    for (const key of ['saltback_stalker', 'thornwatch_marksman', 'ashmantle']) {
      expect(row(key)?.model, key).toBeDefined();
    }
  });

  it('none of the three new types drops an item with a slot (no equipment)', () => {
    for (const key of ['saltback_stalker', 'thornwatch_marksman', 'ashmantle']) {
      const r = row(key);
      expect(r, `${key} row missing`).toBeDefined();
      for (const d of r!.drops) {
        if (d.id === undefined) continue;
        const item = (ITEMS as Record<string, { slot?: string }>)[d.id];
        expect(item, `${key} drops unknown item ${d.id}`).toBeDefined();
        expect(item.slot, `${key} drops ${d.id}`).toBeUndefined();
      }
    }
  });
});
