import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/data/attacks';
import { MONSTER_TYPES } from '../src/data/world';

// Design 6.9 (G4.9). The owner kept every name as written (CALL-4.9, 2026-11-14).
// The list is copied from tests/names.test.ts (Stage 2, design 6.8, G2.8): importing it is not possible, so the
// last test below fails if the two lists differ. Matching is a case-insensitive substring.
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

// The eleven attacks, the boss, its title, the three phases, the blessing and the monsters of design 6.9.
const ATTACK_NAMES = ['Tail Lash', 'Hexfall', 'Pinning Volley', 'Overhead Slam', 'Rootquake', 'Scorch Lane', 'Ember Cone', 'Tail Sweep', 'Slag Rain', 'Ashen Nova', 'Slagburst'];
const OTHER_NAMES = [
  'Ashmantle the Slag Wyrm', 'Ashbreaker', 'Grounded', 'Rain of Slag', 'Fury', 'Lantern Vow',
  'Saltback Stalker', 'Thornwatch Marksman', 'Cinder Adept', 'Slag Brute'
];

describe('names of Stage 4', () => {
  it('the deny-list is the one of tests/names.test.ts', () => {
    const src = readFileSync(new URL('./names.test.ts', import.meta.url), 'utf8');
    const block = /const DENY = \[([\s\S]*?)\];/.exec(src);
    expect(block, 'DENY not found in tests/names.test.ts').not.toBeNull();
    const theirs = [...block![1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
    expect(DENY).toEqual(theirs);
  });

  it('no designed name contains a deny-listed token', () => {
    for (const name of [...ATTACK_NAMES, ...OTHER_NAMES]) expect(denied(name), name).toEqual([]);
  });

  it('every attack that exists carries a name of the list and none is deny-listed', () => {
    for (const a of Object.values(ATTACKS)) {
      expect(ATTACK_NAMES, a.id).toContain(a.name);
      expect(denied(a.name), a.name).toEqual([]);
    }
  });

  it('the three new monsters exist under their names and none is deny-listed', () => {
    const want: Record<string, string> = {
      saltback_stalker: 'Saltback Stalker',
      thornwatch_marksman: 'Thornwatch Marksman',
      ashmantle: 'Ashmantle the Slag Wyrm'
    };
    for (const [key, name] of Object.entries(want)) {
      expect(MONSTER_TYPES[key]?.name, key).toBe(name);
      expect(denied(name), name).toEqual([]);
    }
  });
});
