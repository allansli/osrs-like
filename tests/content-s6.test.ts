import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/attacks';
import { SKILLS_META } from '../src/data/skills';
import { ITEMS, unitSellPrice } from '../src/data/items';
import { SPELLS } from '../src/data/magic';
import { FORGE_RECIPES } from '../src/data/recipes';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';

// Stage 6 content rules (plan D1; design 7.4, 7.5). Every test reads the tables, so a later slice's rows are covered
// without editing this file. Its one declared kind of edit: a later test task shortens LATER_SLICE_CLOSES.

type Golden = Record<string, Record<string, string>>;
const golden = JSON.parse(readFileSync(new URL('./fixtures/s3/content-ids.golden.json', import.meta.url), 'utf8')) as Golden;

// Ids that exist before Stage 6: Stage 3's golden plus its one declared item (the Hazel Staff, tests/content-freeze.test.ts).
const PRE_ITEMS = new Set([...Object.keys(golden.ITEMS), 'hazel_staff']);
const PRE_RECIPES = new Set(Object.keys(golden.FORGE_RECIPES));
// The thirteen monster types of Stages 3 and 4 (the golden's ten, the two Stage 4 monsters and Ashmantle).
const PRE_MONSTERS = new Set(Object.keys(golden.MONSTER_TYPES).concat(['saltback_stalker', 'thornwatch_marksman', 'ashmantle']));

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const unit = (id: string) => unitSellPrice(ITEMS[id]);
const nodes = Object.entries(RESOURCE_NODES_DEF) as [string, { name: string; skill: string; item: string }][];
const monsters = Object.entries(MONSTER_TYPES);

describe('every row points at rows that exist', () => {
  it('every recipe has inputs and an output that are items, and a skill that is a skill', () => {
    for (const r of FORGE_RECIPES) {
      expect(has(SKILLS_META, r.skill), `${r.id} skill ${r.skill}`).toBe(true);
      for (const id of Object.keys(r.input)) expect(has(ITEMS, id), `${r.id} input ${id}`).toBe(true);
      if (r.output) expect(has(ITEMS, r.output), `${r.id} output ${r.output}`).toBe(true);
    }
  });

  it('every node gives an item that exists, with a skill that exists', () => {
    for (const [id, n] of nodes) {
      expect(has(ITEMS, n.item), `${id} item ${n.item}`).toBe(true);
      expect(has(SKILLS_META, n.skill), `${id} skill ${n.skill}`).toBe(true);
    }
  });

  it('every drop id is an item', () => {
    for (const [key, m] of monsters) for (const d of m.drops) if (d.id) expect(has(ITEMS, d.id), `${key} drops ${d.id}`).toBe(true);
  });
});

describe('what Stage 6 may add', () => {
  it('no monster outside the thirteen existing types drops equipment', () => {
    for (const [key, m] of monsters) {
      if (PRE_MONSTERS.has(key)) continue;
      for (const d of m.drops) if (d.id) expect(ITEMS[d.id].type, `${key} drops ${d.id}`).not.toBe('equip');
    }
  });

  it('every item added after the golden is a resource, a bar or ammunition', () => {
    for (const it of Object.values(ITEMS)) {
      if (PRE_ITEMS.has(it.id)) continue;
      expect(['resource', 'bar', 'ammo'], `${it.id} is ${it.type}`).toContain(it.type);
    }
  });
});

describe('the economy bounds (design 7.4)', () => {
  /**
   * Expected sale value of one kill's material drops: bones, food, coins, equipment and ammunition left out. Equipment
   * and the archers' arrows are Stage 3's and 4's own drops (the lesser demon's adamant pieces alone are 33% of its
   * coins, the goblin archer's arrows 27%); the design's bound (results.txt section 3) is on what Stage 6 adds, and
   * the test above holds that Stage 6 adds no equipment.
   */
  const itemValue = (key: string) =>
    MONSTER_TYPES[key].drops.reduce((sum, d) => {
      if (!d.id) return sum;
      const it = ITEMS[d.id];
      if (['bones', 'food', 'equip', 'ammo'].includes(it.type)) return sum;
      return sum + d.chance * ((d as { qty?: number }).qty ?? 1) * unit(d.id);
    }, 0);
  const meanCoins = (key: string) =>
    MONSTER_TYPES[key].drops.reduce((sum, d) => (d.gp ? sum + d.chance * ((d.gp[0] + d.gp[1]) / 2) : sum), 0);

  it('the materials a monster drops sell for at most 25% of its coins (chickens, bosses excepted)', () => {
    for (const [key] of monsters) {
      if (key === 'chicken' || has(BOSSES, key)) continue; // a boss's table is held elsewhere: Z3, U0, D3 bounds
      expect(itemValue(key), `${key}: ${itemValue(key).toFixed(1)} against coins ${meanCoins(key).toFixed(1)}`).toBeLessThanOrEqual(0.25 * meanCoins(key));
    }
  });

  it('no forging recipe added after the golden sells for less than its inputs', () => {
    const EXCEPT = ['smith_mithril_bolts', 'smith_rune_bolts'];
    for (const r of FORGE_RECIPES) {
      if (PRE_RECIPES.has(r.id) || r.kind !== 'smith' || EXCEPT.includes(r.id)) continue;
      const made = unit(r.output!) * (r.outputQty ?? 1);
      const spent = Object.entries(r.input).reduce((s, [id, q]) => s + unit(id) * q, 0);
      expect(made, `${r.id}: ${made} against inputs ${spent}`).toBeGreaterThanOrEqual(spent);
    }
  });
});

describe('the loop audit (design 7.4): every item has a way in and a way out', () => {
  // Permanent: no fishing spot or low recipe exists for them, none blocks anything (design 7.4, "what stays open").
  const OPEN = ['salmon', 'anglerfish', 'saradomin_brew', 'bronze_bolts'];
  // Closed by a later slice; each later test task removes what its slice closes. Runes: N2 (the binding recipes).
  const LATER_SLICE_CLOSES = ['air_rune', 'mind_rune', 'water_rune', 'earth_rune', 'fire_rune', 'chaos_rune', 'law_rune', 'death_rune', 'blood_rune'];

  const sources = new Set<string>();
  for (const [, n] of nodes) sources.add(n.item);
  for (const [, m] of monsters) for (const d of m.drops) if (d.id) sources.add(d.id);
  for (const r of FORGE_RECIPES) if (r.output) sources.add(r.output);
  const uses = new Set<string>();
  for (const r of FORGE_RECIPES) for (const id of Object.keys(r.input)) uses.add(id);
  for (const s of SPELLS) for (const id of Object.keys(s.runes)) uses.add(id);
  const usedBy = (id: string) =>
    uses.has(id) || ['food', 'potion', 'bones', 'ammo'].includes(ITEMS[id].type) || id.startsWith('ember_');

  const audited = Object.values(ITEMS).filter((it) => it.type !== 'equip' && !OPEN.includes(it.id) && !LATER_SLICE_CLOSES.includes(it.id));

  it('every audited item has a source: a node, a recipe or a drop', () => {
    expect(audited.filter((it) => !sources.has(it.id)).map((it) => it.id)).toEqual([]);
  });

  it('every audited item has a use: a recipe input, a spell, food, a potion, bones, ammunition or an ember', () => {
    expect(audited.filter((it) => !usedBy(it.id)).map((it) => it.id)).toEqual([]);
  });

  it('the two named lists name items that exist and are not already closed', () => {
    for (const id of [...OPEN, ...LATER_SLICE_CLOSES]) expect(has(ITEMS, id), id).toBe(true);
    for (const id of OPEN) expect(sources.has(id) && usedBy(id), `${id} is closed: remove it from OPEN`).toBe(false);
  });
});
