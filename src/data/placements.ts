export interface Placement {
  type: string;
  x: number;
  z: number;
}

export const MONSTER_PLACEMENTS: Placement[] = [
  // 1. LUMBRIDGE HAVEN
  { type: 'chicken', x: -13, z: 4 },
  { type: 'chicken', x: -16, z: 10 },
  { type: 'chicken', x: -11, z: 14 },
  { type: 'chicken', x: -17, z: 17 },
  { type: 'goblin', x: 12, z: 4 },
  { type: 'goblin', x: 15, z: 11 },
  { type: 'goblin', x: 18, z: 17 },
  { type: 'goblin', x: 10, z: 19 },
  { type: 'goblin', x: 20, z: 8 },
  { type: 'goblin_archer', x: 24, z: 13 },
  { type: 'goblin_archer', x: 27, z: 19 },

  // 2. VARROCK GRAND PLAZA
  { type: 'dark_wizard', x: 62, z: -6 },
  { type: 'dark_wizard', x: 68, z: -2 },
  { type: 'dark_wizard', x: 58, z: -14 },
  { type: 'dark_ranger', x: 74, z: -10 },
  { type: 'dark_ranger', x: 80, z: -4 },
  { type: 'hill_giant', x: 88, z: -36 },
  { type: 'hill_giant', x: 96, z: -28 },
  { type: 'hill_giant', x: 82, z: -42 },
  { type: 'hill_giant', x: 95, z: -40 },

  // 3. AL-KHARID GOLDEN DUNES
  { type: 'scorpion', x: 52, z: 54 },
  { type: 'scorpion', x: 60, z: 76 },
  { type: 'scorpion', x: 76, z: 58 },
  { type: 'scorpion', x: 82, z: 72 },
  { type: 'scorpion', x: 68, z: 84 },

  // 4. WHISPERING KOROK WOODS
  { type: 'moss_guardian', x: -64, z: -18 },
  { type: 'moss_guardian', x: -82, z: -22 },
  { type: 'moss_guardian', x: -70, z: -44 },
  { type: 'moss_guardian', x: -86, z: -38 },

  // 5. DRAGON'S PEAK WILDERNESS
  { type: 'lesser_demon', x: -56, z: 56 },
  { type: 'lesser_demon', x: -64, z: 78 },
  { type: 'lesser_demon', x: -82, z: 58 },
  { type: 'lesser_demon', x: -58, z: 84 },
  { type: 'elvarg_dragon', x: -82, z: 82 }
];

export const NODE_PLACEMENTS: Placement[] = [
  // 1. LUMBRIDGE HAVEN
  { type: 'normal_tree', x: -19, z: -2 },
  { type: 'normal_tree', x: -24, z: 8 },
  { type: 'normal_tree', x: -20, z: -11 },
  { type: 'normal_tree', x: 17, z: -11 },
  { type: 'normal_tree', x: 22, z: -4 },
  { type: 'oak_tree', x: -14, z: 24 },
  { type: 'oak_tree', x: 8, z: 26 },
  { type: 'oak_tree', x: -25, z: 20 },
  { type: 'maple_tree', x: -6, z: 22 },
  { type: 'maple_tree', x: 16, z: 24 },
  { type: 'maple_tree', x: 4, z: 30 },
  { type: 'fish_shrimp', x: 27, z: 5 },
  { type: 'fish_shrimp', x: 28, z: 14 },
  { type: 'fish_shrimp', x: 26, z: -8 },
  { type: 'fish_trout', x: 29, z: 22 },
  { type: 'fish_trout', x: 27, z: -18 },
  { type: 'copper_rock', x: -18, z: -22 },
  { type: 'copper_rock', x: -12, z: -25 },

  // 2. VARROCK GRAND PLAZA
  { type: 'iron_rock', x: 94, z: -8 },
  { type: 'iron_rock', x: 98, z: -14 },
  { type: 'iron_rock', x: 92, z: -2 },
  { type: 'mith_rock', x: 102, z: -18 },
  { type: 'mith_rock', x: 100, z: -24 },
  { type: 'willow_tree', x: 64, z: -32 },
  { type: 'willow_tree', x: 70, z: -38 },

  // 3. AL-KHARID GOLDEN DUNES
  { type: 'gold_rock', x: 85, z: 55 },
  { type: 'gold_rock', x: 88, z: 62 },
  { type: 'gold_rock', x: 82, z: 48 },
  { type: 'mith_rock', x: 54, z: 78 },
  { type: 'mith_rock', x: 58, z: 84 },

  // 4. WHISPERING KOROK WOODS
  { type: 'yew_tree', x: -60, z: -32 },
  { type: 'yew_tree', x: -66, z: -48 },
  { type: 'yew_tree', x: -88, z: -18 },
  { type: 'yew_tree', x: -92, z: -30 },
  { type: 'magic_tree', x: -75, z: -14 },
  { type: 'magic_tree', x: -84, z: -48 },
  { type: 'magic_tree', x: -95, z: -40 },
  { type: 'fish_lobster', x: 25, z: -36 },
  { type: 'fish_lobster', x: 27, z: -44 },
  { type: 'fish_shark', x: 26, z: -54 },
  { type: 'fish_shark', x: 28, z: -62 },

  // 5. DRAGON'S PEAK WILDERNESS
  { type: 'runite_rock', x: -92, z: 68 },
  { type: 'runite_rock', x: -88, z: 76 },
  { type: 'runite_rock', x: -74, z: 92 }
];
