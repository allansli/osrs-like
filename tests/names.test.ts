import { describe, expect, it } from 'vitest';
import { BASINS, PATHS, POIS, RIDGES } from '../src/data/worldMap';

// Design 6.8, G2.8. Borrowed words found in catalog.ts and README.md: regions, monsters, NPCs, franchises.
// A new name must not contain any of them (case-insensitive substring).
const DENY = [
  // regions and their subtitles
  'lumbridge', 'misthalin', 'varrock', 'kharid', 'korok', 'whispering', 'wilderness', 'gielinor',
  'haven', 'plaza', 'dunes', 'oasis', 'sunscorched', 'sanctuary', 'highlands', 'obsidian', 'volcanic', 'crag', 'peak',
  'emporium', 'bazaar', 'cathedral', 'river lum',
  // monsters and NPCs
  'chicken', 'goblin', 'raider', 'scorpion', 'wizard', 'ranger', 'archer', 'giant', 'guardian', 'demon',
  'dragon', 'elvarg', 'vannaka', 'shopkeeper', 'trade master',
  // franchises and their proper nouns
  'runescape', 'osrs', 'oldschool', 'runewilds', 'hylian', 'hyrule', 'zelda', 'zora', 'breath of the wild',
  'bandos', 'armadyl', 'saradomin', 'zamorak', 'guthix', 'barrows', 'dharok', 'torag', 'torva',
  'justiciar', 'inquisitor', 'ancestral', 'abyssal', 'elysian', 'fierce deity',
  'sheikah', 'masori', 'karil', 'ahrim', 'proselyte', 'zulrah', 'kodai', 'neitiznot', 'tzkal',
  'godsword', 'pegasian', 'ultor', 'tumeken', 'elidinis', "ava's", 'seers',
  'nex', 'bloodbark', 'odium'
];

const denied = (name: string) => DENY.filter((t) => name.toLowerCase().includes(t));

const names = () => [...PATHS, ...RIDGES, ...BASINS, ...POIS].map((row) => row.name);

describe('names', () => {
  it('the deny-list catches a borrowed name', () => {
    expect(denied("Varrock Goblin Pass")).toEqual(['varrock', 'goblin']);
  });

  it('no name in worldMap.ts contains a deny-listed token', () => {
    // The twelve new names of design 6.8; Reedglass Tarn and Tamarisk Pool are both a basin and a POI.
    expect(new Set(names()).size).toBe(12);
    for (const name of names()) expect(denied(name), name).toEqual([]);
  });
});
