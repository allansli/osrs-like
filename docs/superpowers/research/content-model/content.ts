// Stage 6 proposed content, as data. The design document quotes these tables; model.ts checks them
// against the game's real tables and rules. Nothing here is imported by the game.
import type { Attack, BossConfig } from './boss';

// ------------------------------------------------------------------ new items (price is the list price; sells at 65%)
export const NEW_ITEMS: Record<string, { name: string; type: string; price: number }> = {
  // smithing
  coal: { name: 'Coal', type: 'resource', price: 30 },
  adamantite_ore: { name: 'Adamantite Ore', type: 'resource', price: 240 },
  steel_bar: { name: 'Steel Bar', type: 'bar', price: 140 },
  black_bar: { name: 'Blacksteel Bar', type: 'bar', price: 180 },
  adamant_bar: { name: 'Adamant Bar', type: 'bar', price: 450 },
  kiln_shard: { name: 'Kilnglass Shard', type: 'resource', price: 1200 },
  wyrmsteel_ingot: { name: 'Wyrmsteel Ingot', type: 'bar', price: 2850 },
  // crafting
  rough_hide: { name: 'Rough Hide', type: 'resource', price: 14 },
  coarse_cloth: { name: 'Coarse Cloth', type: 'resource', price: 26 },
  chitin_plate: { name: 'Chitin Plate', type: 'resource', price: 150 },
  hexed_cloth: { name: 'Hexed Cloth', type: 'resource', price: 240 },
  tough_hide: { name: 'Tough Hide', type: 'resource', price: 350 },
  cinder_silk: { name: 'Cinder Silk', type: 'resource', price: 970 },
  mossed_hide: { name: 'Mossed Hide', type: 'resource', price: 780 },
  slag_hide: { name: 'Slagscale Hide', type: 'resource', price: 1400 },
  // runebinding
  runestone: { name: 'Blank Runestone', type: 'resource', price: 10 },
  // arrow and bolt grades (ranged): any bow shoots any arrow, any crossbow any bolt; a better grade adds to the max hit (AMMO)
  iron_arrow: { name: 'Iron Arrow', type: 'ammo', price: 18 },
  mithril_arrow: { name: 'Mithril Arrow', type: 'ammo', price: 36 },
  rune_arrow: { name: 'Rune Arrow', type: 'ammo', price: 60 },
  mithril_bolts: { name: 'Mithril Bolts', type: 'ammo', price: 36 },
  rune_bolts: { name: 'Rune Bolts', type: 'ammo', price: 60 },
  // rewards: an ember is used from the backpack and gives its experience to a skill the player picks
  ember_faint: { name: 'Faint Ember', type: 'resource', price: 1 },
  ember_steady: { name: 'Steady Ember', type: 'resource', price: 1 },
  ember_bright: { name: 'Bright Ember', type: 'resource', price: 1 },
  // brewing (Cooking)
  sting_gland: { name: 'Sting Gland', type: 'resource', price: 100 },
  mire_root: { name: 'Mire Root', type: 'resource', price: 260 }
};

// ------------------------------------------------------------------ new resource nodes (data on the existing rock mesh)
export const NEW_NODES: Record<string, { name: string; skill: string; req: number; xp: number; item: string; respawn: number; kind: string; where: string }> = {
  coal_rock: { name: 'Coal Seam', skill: 'mining', req: 10, xp: 50, item: 'coal', respawn: 5500, kind: 'rock', where: 'overworld' },
  runestone_rock: { name: 'Runestone Outcrop', skill: 'mining', req: 1, xp: 20, item: 'runestone', respawn: 4500, kind: 'rock', where: 'overworld' },
  adamantite_rock: { name: 'Adamantite Vein', skill: 'mining', req: 40, xp: 210, item: 'adamantite_ore', respawn: 9000, kind: 'rock', where: 'dungeon' }
};
/** Overworld placements of the new nodes (checked by model.ts against the Stage 2 world rules). */
export const NEW_NODE_PLACEMENTS = [
  { type: 'coal_rock', x: 106, z: -6 }, { type: 'coal_rock', x: 108, z: -12 }, { type: 'coal_rock', x: 104, z: 0 },
  // R0 (2026-11-26): moved from (-44, -6) and (-48, -4). Stage 5's woods trees stand there: (-48, -4) is a tree cell and
  // (-44, -6) is 4.3 from a tree centre, under tests/woods-trees.test.ts's 4.5. The nearest spots that pass every check.
  { type: 'runestone_rock', x: -45, z: -9 }, { type: 'runestone_rock', x: -42, z: -3 }
];

// ------------------------------------------------------------------ new recipes
export type Recipe = { id: string; name: string; skill: string; req: number; xp: number; input: Record<string, number>; output: string; outputQty?: number; kind: string };
export const NEW_RECIPES: Recipe[] = [
  // Smithing: the four tiers Stage 3 left without a recipe (its F14)
  { id: 'smelt_steel', name: 'Smelt Steel Bar', skill: 'smithing', req: 10, xp: 40, input: { iron_ore: 1, coal: 1 }, output: 'steel_bar', kind: 'smelt' },
  { id: 'smelt_black', name: 'Smelt Blacksteel Bar', skill: 'smithing', req: 15, xp: 48, input: { steel_bar: 1, coal: 1 }, output: 'black_bar', kind: 'smelt' },
  { id: 'smelt_adamant', name: 'Smelt Adamant Bar', skill: 'smithing', req: 30, xp: 75, input: { adamantite_ore: 1, coal: 2 }, output: 'adamant_bar', kind: 'smelt' },
  { id: 'smelt_wyrmsteel', name: 'Smelt Wyrmsteel Ingot', skill: 'smithing', req: 60, xp: 150, input: { runite_bar: 1, kiln_shard: 1 }, output: 'wyrmsteel_ingot', kind: 'smelt' },
  { id: 'smith_steel_sword', name: 'Forge Steel Longsword', skill: 'smithing', req: 10, xp: 100, input: { steel_bar: 2 }, output: 'steel_longsword', kind: 'smith' },
  { id: 'smith_steel_legs', name: 'Forge Steel Platelegs', skill: 'smithing', req: 12, xp: 115, input: { steel_bar: 2 }, output: 'steel_legs', kind: 'smith' },
  { id: 'smith_steel_plate', name: 'Forge Steel Platebody', skill: 'smithing', req: 14, xp: 140, input: { steel_bar: 3 }, output: 'steel_plate', kind: 'smith' },
  { id: 'smith_black_scim', name: 'Forge Black Scimitar', skill: 'smithing', req: 15, xp: 125, input: { black_bar: 2 }, output: 'black_scimitar', kind: 'smith' },
  { id: 'smith_black_legs', name: 'Forge Black Platelegs', skill: 'smithing', req: 17, xp: 145, input: { black_bar: 2 }, output: 'black_legs', kind: 'smith' },
  { id: 'smith_black_plate', name: 'Forge Black Platebody', skill: 'smithing', req: 19, xp: 175, input: { black_bar: 3 }, output: 'black_plate', kind: 'smith' },
  { id: 'smith_addy_scim', name: 'Forge Adamant Scimitar', skill: 'smithing', req: 30, xp: 250, input: { adamant_bar: 3 }, output: 'addy_scimitar', kind: 'smith' },
  { id: 'smith_addy_legs', name: 'Forge Adamant Platelegs', skill: 'smithing', req: 32, xp: 290, input: { adamant_bar: 3 }, output: 'addy_legs', kind: 'smith' },
  { id: 'smith_addy_plate', name: 'Forge Adamant Platebody', skill: 'smithing', req: 34, xp: 350, input: { adamant_bar: 4 }, output: 'addy_plate', kind: 'smith' },
  { id: 'smith_wyrm_scim', name: 'Forge Dragon Scimitar', skill: 'smithing', req: 60, xp: 700, input: { wyrmsteel_ingot: 4 }, output: 'dragon_scimitar', kind: 'smith' },
  { id: 'smith_wyrm_legs', name: 'Forge Dragon Platelegs', skill: 'smithing', req: 62, xp: 800, input: { wyrmsteel_ingot: 4 }, output: 'dragon_legs', kind: 'smith' },
  { id: 'smith_wyrm_chain', name: 'Forge Dragon Platebody', skill: 'smithing', req: 65, xp: 950, input: { wyrmsteel_ingot: 5 }, output: 'dragon_chain', kind: 'smith' },
  // Ammunition tiers: one bar tips fifteen shafts
  { id: 'fletch_iron_arrows', name: 'Fletch Iron Arrows', skill: 'smithing', req: 20, xp: 45, input: { iron_bar: 1, arrow_shaft: 15, feather: 15 }, output: 'iron_arrow', outputQty: 15, kind: 'fletch' },
  { id: 'fletch_mithril_arrows', name: 'Fletch Mithril Arrows', skill: 'smithing', req: 40, xp: 110, input: { mithril_bar: 1, arrow_shaft: 15, feather: 15 }, output: 'mithril_arrow', outputQty: 15, kind: 'fletch' },
  { id: 'fletch_rune_arrows', name: 'Fletch Rune Arrows', skill: 'smithing', req: 60, xp: 240, input: { runite_bar: 1, arrow_shaft: 15, feather: 15 }, output: 'rune_arrow', outputQty: 15, kind: 'fletch' },
  { id: 'smith_mithril_bolts', name: 'Forge Mithril Bolts', skill: 'smithing', req: 40, xp: 110, input: { mithril_bar: 1 }, output: 'mithril_bolts', outputQty: 12, kind: 'smith' },
  { id: 'smith_rune_bolts', name: 'Forge Rune Bolts', skill: 'smithing', req: 60, xp: 240, input: { runite_bar: 1 }, output: 'rune_bolts', outputQty: 14, kind: 'smith' },
  // Crafting (new skill): leather and cloth
  { id: 'craft_gloves', name: 'Stitch Leather Vambraces', skill: 'crafting', req: 1, xp: 30, input: { rough_hide: 1 }, output: 'leather_gloves', kind: 'craft' },
  { id: 'craft_boots', name: 'Stitch Traveler Boots', skill: 'crafting', req: 4, xp: 45, input: { rough_hide: 2 }, output: 'leather_boots', kind: 'craft' },
  { id: 'craft_wizard_bottom', name: 'Sew Wizard Robe Skirt', skill: 'crafting', req: 6, xp: 60, input: { coarse_cloth: 3 }, output: 'wizard_bottom', kind: 'craft' },
  { id: 'craft_wizard_top', name: 'Sew Wizard Robe Top', skill: 'crafting', req: 8, xp: 75, input: { coarse_cloth: 3 }, output: 'wizard_top', kind: 'craft' },
  { id: 'craft_green_chaps', name: 'Work Green Chaps', skill: 'crafting', req: 18, xp: 140, input: { chitin_plate: 3 }, output: 'green_dhide_chaps', kind: 'craft' },
  { id: 'craft_green_body', name: 'Work Green Body', skill: 'crafting', req: 20, xp: 170, input: { chitin_plate: 3 }, output: 'green_dhide_body', kind: 'craft' },
  { id: 'craft_mystic_bottom', name: 'Sew Mystic Robe Bottom', skill: 'crafting', req: 20, xp: 170, input: { hexed_cloth: 3 }, output: 'mystic_bottom', kind: 'craft' },
  { id: 'craft_mystic_top', name: 'Sew Mystic Robe Top', skill: 'crafting', req: 22, xp: 200, input: { hexed_cloth: 3 }, output: 'mystic_top', kind: 'craft' },
  { id: 'craft_blue_chaps', name: 'Work Blue Chaps', skill: 'crafting', req: 33, xp: 300, input: { tough_hide: 3 }, output: 'blue_dhide_chaps', kind: 'craft' },
  { id: 'craft_blue_body', name: 'Work Blue Body', skill: 'crafting', req: 35, xp: 340, input: { tough_hide: 3 }, output: 'blue_dhide_body', kind: 'craft' },
  { id: 'craft_infinity_bottom', name: 'Sew Infinity Bottoms', skill: 'crafting', req: 43, xp: 430, input: { cinder_silk: 3 }, output: 'infinity_bottom', kind: 'craft' },
  { id: 'craft_infinity_top', name: 'Sew Infinity Top', skill: 'crafting', req: 45, xp: 500, input: { cinder_silk: 3 }, output: 'infinity_top', kind: 'craft' },
  { id: 'craft_red_chaps', name: 'Work Red Chaps', skill: 'crafting', req: 48, xp: 560, input: { mossed_hide: 3 }, output: 'red_dhide_chaps', kind: 'craft' },
  { id: 'craft_red_body', name: 'Work Red Body', skill: 'crafting', req: 50, xp: 640, input: { mossed_hide: 3 }, output: 'red_dhide_body', kind: 'craft' },
  { id: 'craft_black_chaps', name: 'Work Black Chaps', skill: 'crafting', req: 58, xp: 820, input: { slag_hide: 3 }, output: 'black_dhide_chaps', kind: 'craft' },
  { id: 'craft_black_body', name: 'Work Black Body', skill: 'crafting', req: 60, xp: 940, input: { slag_hide: 3 }, output: 'black_dhide_body', kind: 'craft' },
  // Runebinding (new skill): one blank stone per bind, at an altar; bones and ashes are the catalysts
  { id: 'bind_air', name: 'Bind Air Runes', skill: 'runebinding', req: 1, xp: 14, input: { runestone: 1 }, output: 'air_rune', outputQty: 4, kind: 'bind' },
  { id: 'bind_mind', name: 'Bind Mind Runes', skill: 'runebinding', req: 1, xp: 15, input: { runestone: 1 }, output: 'mind_rune', outputQty: 4, kind: 'bind' },
  { id: 'bind_water', name: 'Bind Water Runes', skill: 'runebinding', req: 5, xp: 19, input: { runestone: 1 }, output: 'water_rune', outputQty: 4, kind: 'bind' },
  { id: 'bind_earth', name: 'Bind Earth Runes', skill: 'runebinding', req: 8, xp: 23, input: { runestone: 1 }, output: 'earth_rune', outputQty: 4, kind: 'bind' },
  { id: 'bind_fire', name: 'Bind Fire Runes', skill: 'runebinding', req: 12, xp: 30, input: { runestone: 1, ashes: 1 }, output: 'fire_rune', outputQty: 4, kind: 'bind' },
  { id: 'bind_chaos', name: 'Bind Chaos Runes', skill: 'runebinding', req: 26, xp: 55, input: { runestone: 1, big_bones: 1 }, output: 'chaos_rune', outputQty: 3, kind: 'bind' },
  { id: 'bind_law', name: 'Bind Law Runes', skill: 'runebinding', req: 34, xp: 80, input: { runestone: 1, big_bones: 1 }, output: 'law_rune', outputQty: 1, kind: 'bind' },
  { id: 'bind_death', name: 'Bind Death Runes', skill: 'runebinding', req: 44, xp: 100, input: { runestone: 1, big_bones: 1 }, output: 'death_rune', outputQty: 1, kind: 'bind' },
  { id: 'bind_blood', name: 'Bind Blood Runes', skill: 'runebinding', req: 48, xp: 140, input: { runestone: 1, dragon_bones: 1 }, output: 'blood_rune', outputQty: 5, kind: 'bind' },
  // Brewing: three new Cooking recipes; ashes get a use
  { id: 'brew_prayer', name: 'Brew Prayer Restore Vial', skill: 'cooking', req: 30, xp: 110, input: { sting_gland: 1, ashes: 2 }, output: 'prayer_potion', kind: 'cook' },
  { id: 'brew_restore', name: 'Brew Super Restore Elixir', skill: 'cooking', req: 55, xp: 220, input: { mire_root: 1, ashes: 2 }, output: 'super_restore', kind: 'cook' },
  { id: 'brew_stew', name: 'Simmer Hearty Stew', skill: 'cooking', req: 60, xp: 260, input: { shark: 1, mire_root: 1 }, output: 'hearty_elixir', kind: 'cook' }
];

// ------------------------------------------------------------------ new monsters (data on existing meshes)
type Drop = { id?: string; chance: number; gp?: [number, number]; qty?: number };
export type Monster = { name: string; level: number; hp: number; maxHit: number; atk: number; def: number; style: string; model: string; modelScale: number; tintNote: string; pattern: string; drops: Drop[]; modelNeed: string };
export const NEW_MONSTERS: Record<string, Monster> = {
  cinder_adept: { name: 'Cinder Adept', level: 52, hp: 80, maxHit: 17, atk: 49, def: 36, style: 'magic', model: 'dark_wizard', modelScale: 1.08, tintNote: 'ash grey robe, ember trim',
    pattern: 'basic x3, Hexfall', drops: [{ id: 'big_bones', chance: 1 }, { gp: [230, 550], chance: 1 }, { id: 'cinder_silk', chance: 0.1 }, { id: 'ashes', chance: 0.5, qty: 2 }], modelNeed: 'a hooded caster with a brazier staff' },
  slag_brute: { name: 'Slag Brute', level: 58, hp: 112, maxHit: 19, atk: 54, def: 48, style: 'melee', model: 'hill_giant', modelScale: 1.12, tintNote: 'dark basalt skin, orange cracks',
    pattern: 'basic x2, Overhead Slam, Rootquake', drops: [{ id: 'big_bones', chance: 1 }, { gp: [340, 770], chance: 1 }, { id: 'slag_hide', chance: 0.1 }, { id: 'shark', chance: 0.4 }], modelNeed: 'a hunched, plated brute, not a recoloured hill dweller' },
  scree_skitter: { name: 'Scree Skitter', level: 30, hp: 20, maxHit: 6, atk: 30, def: 14, style: 'melee', model: 'scorpion', modelScale: 0.6, tintNote: 'pale grey shell',
    pattern: 'basic only', drops: [{ id: 'bones', chance: 1 }, { gp: [20, 60], chance: 0.6 }, { id: 'chitin_plate', chance: 0.06 }], modelNeed: 'a small, fast, many-legged body that reads at a glance in a group of eight' },
  // bosses (each also has a row in BOSSES below)
  marrowjaw: { name: 'Marrowjaw the Tollmaster', level: 40, hp: 560, maxHit: 21, atk: 52, def: 30, style: 'melee', model: 'hill_giant', modelScale: 1.3, tintNote: 'war paint, iron collar',
    pattern: 'BOSSES row', drops: [{ id: 'big_bones', chance: 1 }, { gp: [600, 1200], chance: 1 }, { id: 'tough_hide', chance: 1, qty: 3 }, { id: 'lobster', chance: 1, qty: 2 }, { id: 'runite_bar', chance: 0.125 }], modelNeed: 'a camp leader: banner pole, shoulder armour, a silhouette taller than its camp' },
  saltfang: { name: 'Matron Saltfang', level: 48, hp: 960, maxHit: 36, atk: 66, def: 42, style: 'melee', model: 'scorpion', modelScale: 2.2, tintNote: 'salt-white shell, violet sting',
    pattern: 'BOSSES row', drops: [{ id: 'big_bones', chance: 1 }, { gp: [300, 600], chance: 1 }, { id: 'sting_gland', chance: 1, qty: 3 }, { id: 'adamant_bar', chance: 0.2, qty: 3 }], modelNeed: 'a brood mother: swollen abdomen, egg clusters, a wider stance than the stalkers' },
  kiln_warden: { name: 'The Kiln Warden', level: 80, hp: 2000, maxHit: 64, atk: 110, def: 72, style: 'melee', model: 'moss_guardian', modelScale: 1.5, tintNote: 'fired clay, glowing seams, no moss',
    pattern: 'BOSSES row', drops: [{ id: 'dragon_bones', chance: 1 }, { gp: [800, 1600], chance: 1 }, { id: 'kiln_shard', chance: 0.5 }, { id: 'wyrmsteel_ingot', chance: 0.1 }], modelNeed: 'a furnace golem with an open, glowing chest: must not read as the woods creature' }
};

/** Material drops added to existing monsters (appended to the end of each table, so earlier random draws keep their order). */
export const ADDED_DROPS: Record<string, Drop[]> = {
  chicken: [{ id: 'feather', chance: 0.8, qty: 5 }],
  goblin: [{ id: 'rough_hide', chance: 0.25 }],
  goblin_archer: [{ id: 'coarse_cloth', chance: 0.18 }],
  scorpion: [{ id: 'chitin_plate', chance: 0.09 }, { id: 'sting_gland', chance: 0.1 }],
  saltback_stalker: [{ id: 'chitin_plate', chance: 0.2 }, { id: 'sting_gland', chance: 0.15 }],
  dark_wizard: [{ id: 'hexed_cloth', chance: 0.08 }],
  hill_giant: [{ id: 'tough_hide', chance: 0.1 }],
  moss_guardian: [{ id: 'mossed_hide', chance: 0.09 }, { id: 'mire_root', chance: 0.15 }]
};

// ------------------------------------------------------------------ overworld camps for the new monsters (candidates; model.ts picks)
export const NEW_CAMPS = [
  { id: 'cinder_circle', aggro: 12, members: [{ type: 'cinder_adept', x: -2, z: 67 }, { type: 'cinder_adept', x: 4, z: 74 }, { type: 'cinder_adept', x: -4, z: 77 }] },
  { id: 'brute_shelf', aggro: 9, members: [{ type: 'slag_brute', x: -6, z: 100 }, { type: 'slag_brute', x: 2, z: 104 }] },
  { id: 'tollmaster', aggro: 9, arenaRadius: 9, members: [{ type: 'marrowjaw', x: 4, z: -70 }] }
];

// ------------------------------------------------------------------ the cast
export const NPCS = [
  { id: 'bran_tolley', name: 'Bran Tolley', role: 'Gatewarden of the start town; voice of the starter chain', x: 4, z: 12, tunic: 0x7c5a2e },
  { id: 'odalys_venn', name: 'Odalys Venn', role: 'The last Lampwright; main-line quest giver', x: -8, z: -6, tunic: 0xb7791f },
  { id: 'pell_greaves', name: 'Pell Greaves', role: 'Cook and brewer at the start-town range', x: 12, z: -8, tunic: 0x8c3b2a },
  { id: 'tamsin_reeve', name: 'Tamsin Reeve', role: 'Master smith at the east forge', x: 88, z: -22, tunic: 0x475569 },
  { id: 'qadir_salthand', name: 'Qadir Salt-Hand', role: 'Tanner and caravan master in the dunes', x: 60, z: 66, tunic: 0xc2410c },
  { id: 'hesper_moth', name: 'Hesper Moth', role: 'Hermit runebinder at the hollow on the woods road', x: -52, z: -10, tunic: 0x4c5d8a },
  { id: 'corin_ashby', name: 'Corin Ashby', role: 'Warden of the cairn before the pass', x: -5, z: 48, tunic: 0x6b7280 }
];

/** The tanner's benches (Crafting stations), built from existing crate and barrel nodes. */
export const BENCHES = [{ id: 'bench_dunes', x: 62, z: 68 }, { id: 'bench_town', x: 8, z: 14 }];

// ------------------------------------------------------------------ dungeons: offset zones, rooms as rectangles in zone-local units
export type Rect = [number, number, number, number]; // minX, minZ, maxX, maxZ (local)
export type Dungeon = {
  id: string; name: string; origin: [number, number]; size: number; door: { x: number; z: number }; entry: [number, number];
  rooms: Record<string, Rect>; gates: { id: string; rect: Rect; opensWhen: string[] }[];
  camps: { id: string; room: string; aggro: number; arenaRadius?: number; members: { type: string; x: number; z: number }[] }[];
  nodes: { type: string; x: number; z: number }[]; chest: [number, number];
  /** In the game `needs` is a condition (design 7.2): this combat level, and the quest done or at one of these stages. */
  needs: { combat: number; quest: string; fromStage: number };
};
export const DUNGEONS: Dungeon[] = [
  {
    id: 'saltfang_warren', name: 'Saltfang Warren', origin: [1000, -200], size: 96, door: { x: 106, z: 74 }, entry: [12, 32],
    rooms: {
      entry: [4, 24, 20, 40], c1: [20, 29, 26, 35], nest: [26, 20, 46, 44], c2: [46, 29, 52, 35],
      gallery: [52, 20, 72, 44], c3: [59, 44, 65, 50], lair: [48, 50, 76, 78],
      c4: [33, 44, 39, 54], brood: [24, 54, 46, 76]
    },
    gates: [{ id: 'lair_gate', rect: [59, 46, 65, 48], opensWhen: ['nest', 'gallery', 'brood'] }],
    camps: [
      { id: 'nest', room: 'nest', aggro: 9, members: [[31, 26], [36, 38], [41, 27], [33, 33], [40, 36], [38, 23], [30, 40], [43, 41]].map(([x, z]) => ({ type: 'scree_skitter', x, z })) },
      { id: 'gallery', room: 'gallery', aggro: 12, members: [{ type: 'saltback_stalker', x: 58, z: 27 }, { type: 'saltback_stalker', x: 66, z: 30 }, { type: 'saltback_stalker', x: 60, z: 38 }, { type: 'thornwatch_marksman', x: 68, z: 40 }, { type: 'thornwatch_marksman', x: 67, z: 24 }] },
      { id: 'brood', room: 'brood', aggro: 9, members: [...[[28, 58], [34, 62], [42, 58], [30, 70], [38, 72], [42, 66]].map(([x, z]) => ({ type: 'scree_skitter', x, z })), { type: 'saltback_stalker', x: 35, z: 67 }, { type: 'saltback_stalker', x: 29, z: 64 }] },
      { id: 'lair', room: 'lair', aggro: 12, arenaRadius: 10, members: [{ type: 'saltfang', x: 62, z: 64 }] }
    ],
    nodes: [{ type: 'adamantite_rock', x: 51, z: 74 }, { type: 'adamantite_rock', x: 73, z: 74 }, { type: 'adamantite_rock', x: 73, z: 54 }],
    chest: [62, 75], needs: { combat: 50, quest: 'ml_salt', fromStage: 3 }
  },
  {
    id: 'underkiln', name: 'The Underkiln', origin: [1000, 200], size: 112, door: { x: -52, z: 46 }, entry: [12, 40],
    rooms: {
      entry: [4, 32, 20, 48], c1: [20, 37, 26, 43], ashhall: [26, 26, 50, 54], c2: [50, 37, 56, 43],
      forge: [56, 24, 80, 56], c3: [65, 56, 71, 62], side: [80, 34, 96, 46], kiln: [52, 62, 84, 94]
    },
    gates: [{ id: 'kiln_gate', rect: [65, 58, 71, 60], opensWhen: ['ashhall', 'forge'] }],
    camps: [
      { id: 'ashhall', room: 'ashhall', aggro: 12, members: [{ type: 'cinder_adept', x: 32, z: 32 }, { type: 'cinder_adept', x: 44, z: 34 }, { type: 'cinder_adept', x: 38, z: 48 }, ...[[30, 44], [34, 38], [44, 46], [42, 30]].map(([x, z]) => ({ type: 'scree_skitter', x, z }))] },
      { id: 'forge', room: 'forge', aggro: 9, members: [{ type: 'slag_brute', x: 62, z: 30 }, { type: 'slag_brute', x: 74, z: 34 }, { type: 'slag_brute', x: 64, z: 48 }, { type: 'cinder_adept', x: 76, z: 50 }] },
      { id: 'side', room: 'side', aggro: 9, members: [{ type: 'slag_brute', x: 84, z: 40 }, { type: 'slag_brute', x: 93, z: 38 }, { type: 'cinder_adept', x: 88, z: 44 }] },
      { id: 'kiln', room: 'kiln', aggro: 12, arenaRadius: 12, members: [{ type: 'kiln_warden', x: 68, z: 78 }] }
    ],
    nodes: [{ type: 'runite_rock', x: 82, z: 35 }, { type: 'runite_rock', x: 95, z: 45 }, { type: 'adamantite_rock', x: 95, z: 35 }],
    chest: [68, 91], needs: { combat: 72, quest: 'ml_kiln', fromStage: 3 }
  }
];
/**
 * What the end chest of a dungeon pays, EVERY clear (owner, 2026-11-14: "a dungeon is a dungeon; sometimes you have to do
 * it N times to drop a specific item"). `run` and `runGp` are paid on every clear; each `rare` entry is rolled on every
 * clear with its own chance. Nothing here is paid once: once-only rewards belong to a quest's `reward` (design 7.3, 7.6),
 * and a chest row has no field that could hold one. Equipment may appear only here, never in a monster's table, and at
 * most at Stage 3's boss cap of 0.05.
 */
export const CHESTS: Record<string, { run: { id: string; qty: [number, number] }[]; runGp: [number, number]; rare: { id: string; qty: number; chance: number }[] }> = {
  saltfang_warren: { run: [{ id: 'adamantite_ore', qty: [3, 5] }, { id: 'tough_hide', qty: [1, 2] }], runGp: [100, 300],
    rare: [{ id: 'rune_crossbow', qty: 1, chance: 0.05 }] },
  underkiln: { run: [{ id: 'kiln_shard', qty: [1, 1] }, { id: 'cinder_silk', qty: [1, 2] }], runGp: [500, 1000],
    rare: [{ id: 'kiln_shard', qty: 3, chance: 0.2 }, { id: 'bloodbark_top', qty: 1, chance: 0.04 }, { id: 'bloodbark_bottom', qty: 1, chance: 0.04 }] }
};
/** What the player is told to expect: the things worth running a dungeon or a boss for, and the recipe count that needs them. */
export const CHASES: { what: string; source: string; need: number; perRun: { always: number; chances: { qty: number; chance: number }[] } }[] = [
  { what: 'Kilnglass for the whole dragon kit (13 ingots)', source: 'underkiln', need: 13, perRun: { always: 1, chances: [{ qty: 3, chance: 0.2 }, { qty: 1, chance: 0.5 }, { qty: 1, chance: 0.1 }] } },
  { what: 'Kilnglass for one dragon scimitar (4 ingots)', source: 'underkiln', need: 4, perRun: { always: 1, chances: [{ qty: 3, chance: 0.2 }, { qty: 1, chance: 0.5 }, { qty: 1, chance: 0.1 }] } }
];

// ------------------------------------------------------------------ bosses, in the shape of Stage 4's BossConfig
const A = (a: Attack) => a;
export const BOSSES: Record<string, BossConfig & { respawnSecs: number; arenaRadius: number; question: string }> = {
  marrowjaw: {
    typeKey: 'marrowjaw', hp: NEW_MONSTERS.marrowjaw.hp, markStep: 0.25, respawnSecs: 180, arenaRadius: 9,
    question: 'Do you step off the spot? One mechanic at a time, with long warnings: the first boss teaches the language.',
    attacks: {
      toll_slam: A({ id: 'toll_slam', shape: { type: 'circle', anchor: 'target', radius: 3 }, windupMs: 1800, slots: 2, style: 'melee', power: 26, reach: 13.5 }),
      camp_sweep: A({ id: 'camp_sweep', shape: { type: 'circle', anchor: 'self', radius: 5 }, windupMs: 1900, slots: 2, style: 'melee', power: 30, reach: 5 })
    },
    phases: [
      { name: 'I The Toll', untilHpFrac: 0.5, pattern: ['basic', 'basic', 'toll_slam', 'basic'], cadenceMult: 1 },
      { name: 'II The Reckoning', untilHpFrac: 0, pattern: ['camp_sweep', 'toll_slam', 'basic', 'basic'], cadenceMult: 1 }
    ]
  },
  saltfang: {
    typeKey: 'saltfang', hp: NEW_MONSTERS.saltfang.hp, markStep: 0.25, respawnSecs: 0, arenaRadius: 10,
    question: 'Can you keep up? Its tempo rises in every phase: the fight is won by ending it, so food and damage are the plan.',
    attacks: {
      sting_arc: A({ id: 'sting_arc', shape: { type: 'cone', length: 14, halfAngleDeg: 50 }, windupMs: 1600, slots: 2, style: 'melee', power: 40, reach: 13.5 }),
      brine_spit: A({ id: 'brine_spit', shape: { type: 'circle', anchor: 'target', radius: 2.5 }, windupMs: 1400, slots: 1, style: 'pure', power: 26, reach: 13.5 })
    },
    phases: [
      { name: 'I Stirring', untilHpFrac: 0.6, pattern: ['basic', 'basic', 'sting_arc', 'basic'], cadenceMult: 1 },
      { name: 'II Roused', untilHpFrac: 0.3, pattern: ['brine_spit', 'brine_spit', 'sting_arc', 'basic', 'basic'], cadenceMult: 0.9 },
      { name: 'III Frenzy', untilHpFrac: 0, pattern: ['sting_arc', 'brine_spit', 'brine_spit', 'basic', 'sting_arc', 'basic'], cadenceMult: 0.75 }
    ]
  },
  kiln_warden: {
    typeKey: 'kiln_warden', hp: NEW_MONSTERS.kiln_warden.hp, markStep: 0.25, respawnSecs: 0, arenaRadius: 12,
    question: 'Can you hold the band? The ring burns everything far, the vent everything near: only a strip 3 to 6 units out is safe through both.',
    attacks: {
      kiln_ring: A({ id: 'kiln_ring', shape: { type: 'ring', inner: 6, outer: 20 }, windupMs: 1900, slots: 2, style: 'pure', power: 62, reach: 13.5 }),
      core_vent: A({ id: 'core_vent', shape: { type: 'circle', anchor: 'self', radius: 3.4 }, windupMs: 1600, slots: 1, style: 'pure', power: 58, reach: 3.4 }),
      hammer_arc: A({ id: 'hammer_arc', shape: { type: 'cone', length: 14, halfAngleDeg: 60 }, windupMs: 1800, slots: 2, style: 'melee', power: 56, reach: 13.5 })
    },
    phases: [
      { name: 'I Banked', untilHpFrac: 0.6, pattern: ['basic', 'basic', 'hammer_arc', 'basic', 'kiln_ring'], cadenceMult: 1 },
      { name: 'II Stoked', untilHpFrac: 0.25, pattern: ['kiln_ring', 'core_vent', 'basic', 'hammer_arc', 'basic'], cadenceMult: 1 },
      { name: 'III White Heat', untilHpFrac: 0, pattern: ['kiln_ring', 'core_vent', 'hammer_arc', 'basic', 'kiln_ring', 'core_vent'], cadenceMult: 0.85 }
    ]
  }
};

// ------------------------------------------------------------------ story quests (ids, names, order); stages are in the design.
// `combat` is the hero's COMBAT level (adventure.ts combatLevel), the number camps compare with a monster's level:
// a hero with every fighting skill at 50 and Prayer 43 is combat 62.
export const STORY_QUESTS = [
  { id: 'ml_wards', name: 'The Guttering Wards', line: 'main', giver: 'odalys_venn', region: 'lumbridge', combat: 3, stages: 4 },
  { id: 'ml_east', name: 'Iron for the East Lamp', line: 'main', giver: 'tamsin_reeve', region: 'varrock', combat: 15, stages: 5 },
  { id: 'ml_salt', name: 'Salt on the Wind', line: 'main', giver: 'qadir_salthand', region: 'desert', combat: 50, stages: 5 },
  { id: 'ml_hollow', name: 'What the Hollow Keeps', line: 'main', giver: 'hesper_moth', region: 'woods', combat: 55, stages: 5 },
  { id: 'ml_pass', name: 'The Held Pass', line: 'main', giver: 'corin_ashby', region: 'wilderness', combat: 60, stages: 4 },
  { id: 'ml_kiln', name: 'Under the Ridge', line: 'main', giver: 'corin_ashby', region: 'wilderness', combat: 72, stages: 5 },
  { id: 'ml_ash', name: 'Ashfall', line: 'main', giver: 'odalys_venn', region: 'wilderness', combat: 75, stages: 4 },
  { id: 'sq_steel', name: 'A Harder Edge', line: 'side', giver: 'tamsin_reeve', region: 'varrock', combat: 10, stages: 3 },
  { id: 'sq_hides', name: 'Nothing Wasted', line: 'side', giver: 'qadir_salthand', region: 'desert', combat: 12, stages: 3 },
  { id: 'sq_binding', name: 'Blank Stones', line: 'side', giver: 'hesper_moth', region: 'woods', combat: 3, stages: 3 },
  { id: 'sq_kettle', name: 'The Fourth Kettle', line: 'side', giver: 'pell_greaves', region: 'lumbridge', combat: 20, stages: 3 },
  { id: 'sq_toll', name: "The Tollmaster's Due", line: 'side', giver: 'bran_tolley', region: 'lumbridge', combat: 40, stages: 3 },
  { id: 'sq_vow', name: 'A Vow Kept', line: 'side', giver: 'odalys_venn', region: 'lumbridge', combat: 15, stages: 3 }
];

// ------------------------------------------------------------------ the diary
export const DIARY_REGIONS = ['lumbridge', 'varrock', 'desert', 'woods', 'wilderness'];
export const DIARY_TIERS = [{ id: 'easy', ember: 'ember_faint', xp: 1000 }, { id: 'medium', ember: 'ember_steady', xp: 7500 }, { id: 'hard', ember: 'ember_bright', xp: 40000 }];
export const DIARY_TASKS_PER_TIER = 5;

/** Every other new name the stage adds (deny-list check). */
export const OTHER_NAMES = ['Crafting', 'Runebinding', 'Warrenbreaker', 'Kilnbreaker', 'Tollbreaker', 'The Toll', 'The Reckoning', 'Stirring', 'Roused', 'Frenzy', 'Banked', 'Stoked', 'White Heat',
  'Toll Slam', 'Camp Sweep', 'Sting Arc', 'Brine Spit', 'Kiln Ring', 'Core Vent', 'Hammer Arc', 'Wardlight', 'Lampwright', 'Gatewarden', 'Wardkeeper', 'The Failing Wards'];

/**
 * Arrow and bolt grades (owner, 2026-11-14: "bows shoot arrows. Good ones and bad ones"). ANY bow shoots ANY arrow and any
 * crossbow any bolt; `power` is added to the max hit of the shot. With several grades in the backpack the best one is shot.
 * Bronze is today's arrow and adds nothing, so no bow an existing character owns is ever refused its arrows.
 */
export const AMMO: Record<string, { kind: 'arrow' | 'bolt'; power: number }> = {
  bronze_arrow: { kind: 'arrow', power: 0 }, iron_arrow: { kind: 'arrow', power: 2 }, mithril_arrow: { kind: 'arrow', power: 4 }, rune_arrow: { kind: 'arrow', power: 6 },
  bronze_bolts: { kind: 'bolt', power: 0 }, mithril_bolts: { kind: 'bolt', power: 4 }, rune_bolts: { kind: 'bolt', power: 6 }
};
/** The grade the MODEL gives a fighter of each level (the first level whose smith can make it, 5 levels in): information, not a rule. */
export const AMMO_TIERS = [
  { fromReq: 1, arrow: 'bronze_arrow', bolt: 'bronze_bolts' },
  { fromReq: 25, arrow: 'iron_arrow', bolt: 'bronze_bolts' },
  { fromReq: 45, arrow: 'mithril_arrow', bolt: 'mithril_bolts' },
  { fromReq: 70, arrow: 'rune_arrow', bolt: 'rune_bolts' }
];

// ------------------------------------------------------------------ the style rebalance (design 7.12, plan slice 6)
/** The three style numbers of the attack formula, today (Stage 3's playerAttackProfile) and after. Melee is not touched. */
export const STYLE_TODAY = { rangedBase: 2, rangedGear: 0.22, magicScale: 1 };
export const STYLE_AFTER = { rangedBase: 3, rangedGear: 0.06, magicScale: 0.5 };
/** Rune counts of the two big spells after the rebalance (today both take two of each). The two small spells keep theirs. */
export const SPELL_RUNES_AFTER: Record<string, Record<string, number>> = {
  ice_burst: { water_rune: 1, chaos_rune: 1 },
  blood_barrage: { blood_rune: 1, death_rune: 1 }
};
/** The band the three styles must stay in, levels 20 to 70, standard kit of the level: damage per second over melee's. */
export const STYLE_BAND = { ranged: [0.9, 1.35], magic: [0.95, 1.4], fastestOverSlowest: 1.4 };
