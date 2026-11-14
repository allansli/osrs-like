import { CAMPS } from './worldMap';

export interface Placement {
  type: string;
  x: number;
  z: number;
}

export const MONSTER_PLACEMENTS: Placement[] = CAMPS.flatMap((camp) =>
  camp.members.map((m) => ({ type: m.type, x: m.x, z: m.z }))
);

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
