import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { FORGE_RECIPES } from '../src/data/recipes';
import { PRAYERS, SPELLS } from '../src/data/magic';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';
import { QUEST_DEFS } from '../src/state/adventure';

const FIXTURE = new URL('./fixtures/s3/content-ids.golden.json', import.meta.url);

// Owner's decision of 2026-11-14: the Hazel Staff (task I2) is the one new item.
const DECLARED_NEW_ITEMS = [
  'hazel_staff',
  // Stage 6, slice 1 (plan D1; design 11.3 item 1): the content file's ids, each later slice's test task appends its own.
  'coal', 'steel_bar', 'black_bar', 'sting_gland', 'mire_root'
];
// Owner's decisions of 2026-11-14 (Stage 4, CALL-4.4 and CALL-4.8): the two shipped monsters and the new boss.
const DECLARED_NEW_MONSTERS = [
  'saltback_stalker', 'thornwatch_marksman', 'ashmantle',
  // Stage 6, slice 1 (plan D1).
  'cinder_adept', 'slag_brute', 'marrowjaw'
];
// Stage 6 (plan D1, design 11.3 item 1): the nodes and recipes the stage adds, subtracted exactly as the items are.
const DECLARED_NEW_NODES = ['coal_rock'];
const DECLARED_NEW_RECIPES = [
  'smelt_steel', 'smelt_black',
  'smith_steel_sword', 'smith_steel_legs', 'smith_steel_plate',
  'smith_black_scim', 'smith_black_legs', 'smith_black_plate',
  'brew_prayer', 'brew_restore', 'brew_stew'
];

type Names = Record<string, string>;
const names = (entries: [string, string][]): Names =>
  Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const keyed = (t: Record<string, unknown>): Names =>
  names(Object.entries(t).map(([k, v]) => [k, String((v as { name: string }).name)]));
const listed = (t: { id: string; name: string }[]): Names => names(t.map((e) => [e.id, e.name]));

const live: Record<string, Names> = {
  ITEMS: keyed(ITEMS),
  MONSTER_TYPES: keyed(MONSTER_TYPES),
  RESOURCE_NODES_DEF: keyed(RESOURCE_NODES_DEF),
  FORGE_RECIPES: listed(FORGE_RECIPES),
  QUEST_DEFS: listed(QUEST_DEFS),
  PRAYERS: listed(PRAYERS),
  SPELLS: listed(SPELLS)
};

if (process.env.UPDATE_GOLDEN === '1') writeFileSync(FIXTURE, JSON.stringify(live, null, 1) + '\n');
const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, Names>;

function comparable(table: string): Names {
  const got = { ...live[table] };
  if (table === 'ITEMS') for (const id of DECLARED_NEW_ITEMS) delete got[id];
  if (table === 'MONSTER_TYPES') for (const id of DECLARED_NEW_MONSTERS) delete got[id];
  if (table === 'RESOURCE_NODES_DEF') for (const id of DECLARED_NEW_NODES) delete got[id];
  if (table === 'FORGE_RECIPES') for (const id of DECLARED_NEW_RECIPES) delete got[id];
  return got;
}

describe('content freeze', () => {
  for (const table of Object.keys(live)) {
    it(`${table}: no id was added or removed`, () => {
      expect(Object.keys(comparable(table)).sort()).toEqual(Object.keys(want[table]).sort());
    });
    it(`${table}: no name changed`, () => {
      expect(comparable(table)).toEqual(want[table]);
    });
  }
});
