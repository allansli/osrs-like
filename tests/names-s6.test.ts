import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/data/attacks';
import { ITEMS } from '../src/data/items';
import { FORGE_RECIPES } from '../src/data/recipes';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';

// Design 7.10 (D1). The deny-list of tests/names.test.ts, copied (the last case fails if the two differ), over the
// name of every row Stage 6 adds. Matching is a case-insensitive substring. Generic words shared with other games
// (Coal, Steel Bar) are in by the owner's rule: only the deny-list is checked. The lists of the people, quests,
// dungeons and phases join as their tables land (each later content test task reads its own table here).
const DENY = [
  'lumbridge', 'misthalin', 'varrock', 'kharid', 'korok', 'whispering', 'wilderness', 'gielinor',
  'haven', 'plaza', 'dunes', 'oasis', 'sunscorched', 'sanctuary', 'highlands', 'obsidian', 'volcanic', 'crag', 'peak',
  'emporium', 'bazaar', 'cathedral', 'river lum',
  'chicken', 'goblin', 'raider', 'scorpion', 'wizard', 'ranger', 'archer', 'giant', 'guardian', 'demon',
  'dragon', 'elvarg', 'vannaka', 'shopkeeper', 'trade master',
  'runescape', 'osrs', 'oldschool', 'runewilds', 'hylian', 'hyrule', 'zelda', 'zora', 'breath of the wild',
  'bandos', 'armadyl', 'saradomin', 'zamorak', 'guthix', 'barrows', 'dharok', 'torag', 'torva',
  'justiciar', 'inquisitor', 'ancestral', 'abyssal', 'elysian', 'fierce deity',
  'sheikah', 'masori', 'karil', 'ahrim', 'proselyte', 'zulrah', 'kodai', 'neitiznot', 'tzkal',
  'godsword', 'pegasian', 'ultor', 'tumeken', 'elidinis', "ava's", 'seers',
  'nex', 'bloodbark', 'odium'
];
const denied = (name: string) => DENY.filter((t) => name.toLowerCase().includes(t));

type Golden = Record<string, Record<string, string>>;
const golden = JSON.parse(readFileSync(new URL('./fixtures/s3/content-ids.golden.json', import.meta.url), 'utf8')) as Golden;
const PRE_ITEMS = new Set([...Object.keys(golden.ITEMS), 'hazel_staff']);
const PRE_NODES = new Set(Object.keys(golden.RESOURCE_NODES_DEF));
const PRE_MONSTERS = new Set(Object.keys(golden.MONSTER_TYPES).concat(['saltback_stalker', 'thornwatch_marksman', 'ashmantle']));
const PRE_RECIPES = new Set(Object.keys(golden.FORGE_RECIPES));
// The Stage 4 attacks (tests/names-combat.test.ts); every other attack is Stage 6's.
const PRE_ATTACKS = new Set(['basic', 'tail_lash', 'hexfall', 'pinning_volley', 'overhead_slam', 'rootquake', 'scorch_lane', 'ember_cone', 'tail_sweep', 'slag_rain', 'ashen_nova', 'slagburst']);
// Design 7.10: five recipes repeat the borrowed word of the existing item they make; those items keep their names.
const SHARED_WITH_ITEM = ['Forge Dragon Scimitar', 'Forge Dragon Platelegs', 'Forge Dragon Platebody', 'Sew Wizard Robe Skirt', 'Sew Wizard Robe Top'];

describe('names of Stage 6', () => {
  it('the deny-list is the one of tests/names.test.ts', () => {
    const src = readFileSync(new URL('./names.test.ts', import.meta.url), 'utf8');
    const block = /const DENY = \[([\s\S]*?)\];/.exec(src);
    expect(block, 'DENY not found in tests/names.test.ts').not.toBeNull();
    const theirs = [...block![1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
    expect(DENY).toEqual(theirs);
  });

  it('the deny-list catches a borrowed name and the exception list does not hide a new one', () => {
    expect(denied('Dragon Slayer')).toEqual(['dragon']);
    for (const n of SHARED_WITH_ITEM) expect(denied(n).length, n).toBeGreaterThan(0);
  });

  it('no new item, node, monster, recipe or attack name holds a deny-listed token', () => {
    const rows: [string, string][] = [];
    for (const it of Object.values(ITEMS)) if (!PRE_ITEMS.has(it.id)) rows.push([`item ${it.id}`, it.name]);
    for (const [id, n] of Object.entries(RESOURCE_NODES_DEF)) if (!PRE_NODES.has(id)) rows.push([`node ${id}`, (n as { name: string }).name]);
    for (const [id, m] of Object.entries(MONSTER_TYPES)) if (!PRE_MONSTERS.has(id)) rows.push([`monster ${id}`, m.name]);
    for (const r of FORGE_RECIPES) if (!PRE_RECIPES.has(r.id)) rows.push([`recipe ${r.id}`, r.name]);
    for (const a of Object.values(ATTACKS)) if (!PRE_ATTACKS.has(a.id)) rows.push([`attack ${a.id}`, a.name]);
    for (const [what, name] of rows) {
      if (what.startsWith('recipe') && SHARED_WITH_ITEM.includes(name)) continue;
      expect(denied(name), `${what}: ${name}`).toEqual([]);
    }
  });
});
